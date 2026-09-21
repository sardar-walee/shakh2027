-- SHAKH SUPER v7: server-verified customer car listing payments.
-- Run after v6_wallet_hardening.sql. Existing posts and payment data are preserved.

alter table public.posts add column if not exists payment_reference text;
alter table public.posts add column if not exists payment_status text not null default 'not_required';
alter table public.posts add column if not exists paid_at timestamptz;
alter table public.posts
  drop constraint if exists posts_payment_status_check;
alter table public.posts
  add constraint posts_payment_status_check check (payment_status in ('not_required', 'pending', 'verified', 'failed'));

create table if not exists public.car_listing_payment_attempts(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  payment_reference text not null unique,
  expected_amount numeric(14,2) not null,
  currency text not null default 'IQD',
  status text not null default 'pending',
  provider_status text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint car_payment_attempt_status_check check (status in ('pending', 'verified', 'failed', 'replayed'))
);

alter table public.car_listing_payment_attempts enable row level security;
drop policy if exists "customers read own car payment attempts" on public.car_listing_payment_attempts;
create policy "customers read own car payment attempts"
on public.car_listing_payment_attempts for select
using (auth.uid() = customer_id);
create index if not exists car_payment_attempts_post_idx
  on public.car_listing_payment_attempts(post_id, created_at desc);

-- A customer may create only an unpaid pending car post. Verification is the
-- only path that can make it reviewable and mark the fee as paid.
drop policy if exists "customers create pending car posts" on public.posts;
create policy "customers create pending car posts"
on public.posts for insert
with check (
  auth.uid() = owner_id
  and category = 'car_dealer'
  and status = 'pending_payment'
  and listing_fee_paid = false
  and payment_status = 'pending'
);

create or replace function public.protect_post_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.has_permission('manage_posts') then
    if new.owner_id is distinct from old.owner_id
      or new.status is distinct from old.status
      or new.verified_by is distinct from old.verified_by
      or new.verified_at is distinct from old.verified_at
      or new.listing_fee_paid is distinct from old.listing_fee_paid
      or new.payment_status is distinct from old.payment_status
      or new.payment_reference is distinct from old.payment_reference
      or new.paid_at is distinct from old.paid_at then
      raise exception 'post moderation or payment fields require permission';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.resolve_car_listing_payment(
  p_attempt_id uuid,
  p_provider_reference text,
  p_provider_amount numeric,
  p_provider_currency text,
  p_provider_status text,
  p_provider_payload jsonb,
  p_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.car_listing_payment_attempts;
  post_row public.posts;
  new_status text;
begin
  select * into attempt_row
  from public.car_listing_payment_attempts
  where id = p_attempt_id
  for update;
  if not found then raise exception 'payment attempt not found'; end if;
  if attempt_row.status <> 'pending' then
    update public.car_listing_payment_attempts
      set status = 'replayed', provider_status = p_provider_status,
          provider_payload = coalesce(p_provider_payload, '{}'::jsonb)
      where id = attempt_row.id and attempt_row.status <> 'verified';
    raise exception 'payment attempt already resolved';
  end if;

  select * into post_row from public.posts where id = attempt_row.post_id for update;
  if not found or post_row.owner_id <> attempt_row.customer_id then raise exception 'payment ownership mismatch'; end if;
  if post_row.listing_fee_paid or post_row.payment_status = 'verified' then raise exception 'listing already paid'; end if;

  if not p_verified
     or p_provider_reference is null
     or p_provider_reference <> attempt_row.payment_reference
     or p_provider_amount is null
     or p_provider_amount <> attempt_row.expected_amount
     or upper(coalesce(p_provider_currency, '')) <> upper(attempt_row.currency) then
    update public.car_listing_payment_attempts
      set status = 'failed', provider_status = p_provider_status,
          provider_payload = coalesce(p_provider_payload, '{}'::jsonb)
      where id = attempt_row.id;
    update public.posts
      set payment_status = 'failed'
      where id = attempt_row.post_id;
    return jsonb_build_object('verified', false, 'status', 'failed');
  end if;

  update public.car_listing_payment_attempts
    set status = 'verified', provider_status = p_provider_status,
        provider_payload = coalesce(p_provider_payload, '{}'::jsonb), verified_at = now()
    where id = attempt_row.id;
  update public.posts
    set listing_fee = attempt_row.expected_amount, listing_fee_paid = true, payment_status = 'verified', payment_reference = attempt_row.payment_reference,
        paid_at = now(), status = 'pending_review'
    where id = attempt_row.post_id;
  return jsonb_build_object('verified', true, 'status', 'verified', 'post_id', attempt_row.post_id);
end;
$$;

revoke all on function public.resolve_car_listing_payment(uuid, text, numeric, text, text, jsonb, boolean) from public;
grant execute on function public.resolve_car_listing_payment(uuid, text, numeric, text, text, jsonb, boolean) to service_role;
