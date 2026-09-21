-- SHAKH SUPER v6: database-backed wallet ledger.
-- Run after v5_dashboard_rpc.sql. Existing wallet rows and columns are preserved.

alter table public.wallet_transactions add column if not exists direction text;
alter table public.wallet_transactions add column if not exists status text;
alter table public.wallet_transactions add column if not exists reference text;

update public.wallet_transactions
set direction = case when lower(coalesce(kind, 'credit')) in ('debit', 'expense', 'withdrawal', 'payout') then 'debit' else 'credit' end,
    status = coalesce(status, 'completed');

alter table public.wallet_transactions alter column direction set default 'credit';
alter table public.wallet_transactions alter column direction set not null;
alter table public.wallet_transactions alter column status set default 'completed';
alter table public.wallet_transactions alter column status set not null;
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_direction_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_direction_check check (direction in ('credit', 'debit'));
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_status_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_status_check check (status in ('pending', 'completed', 'failed'));
create index if not exists wallet_transactions_user_status_created_idx
  on public.wallet_transactions(user_id, status, created_at desc);

alter table public.wallet_transactions enable row level security;
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'wallet_transactions'
  loop
    execute format('drop policy if exists %I on public.wallet_transactions', policy_row.policyname);
  end loop;
end $$;

create policy "users read own wallet transactions"
on public.wallet_transactions for select
using (auth.uid() = user_id);

create or replace function public.get_wallet_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  summary jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select jsonb_build_object(
    'balance', coalesce((select sum(case when direction = 'credit' then amount else -amount end)
                         from public.wallet_transactions
                         where user_id = current_user_id and status = 'completed'), 0),
    'transactions', coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.created_at desc)
      from (
        select id, user_id, order_id, kind, direction, status, amount, note, reference, created_at
        from public.wallet_transactions
        where user_id = current_user_id
        order by created_at desc
        limit 100
      ) rows
    ), '[]'::jsonb)
  ) into summary;

  return summary;
end;
$$;

revoke all on function public.get_wallet_summary() from public;
grant execute on function public.get_wallet_summary() to authenticated;

create or replace function public.record_wallet_transaction(
  p_user_id uuid,
  p_direction text,
  p_amount numeric,
  p_status text default 'pending',
  p_reference text default null,
  p_order_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_transaction_id uuid;
begin
  if auth.uid() is null or not public.has_permission('manage_wallet') then
    raise exception 'wallet permission required';
  end if;
  if p_user_id is null or p_direction not in ('credit', 'debit')
     or p_status not in ('pending', 'completed', 'failed')
     or p_amount is null or p_amount <= 0 then
    raise exception 'invalid wallet transaction';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'wallet owner not found';
  end if;
  if p_direction = 'debit' and p_status = 'completed'
     and coalesce((select sum(case when direction = 'credit' then amount else -amount end)
                   from public.wallet_transactions
                   where user_id = p_user_id and status = 'completed'), 0) < p_amount then
    raise exception 'insufficient wallet balance';
  end if;

  insert into public.wallet_transactions(user_id, order_id, kind, direction, status, amount, note, reference)
  values (p_user_id, p_order_id, p_direction, p_direction, p_status, p_amount, p_note, p_reference)
  returning id into new_transaction_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'wallet_transaction_created', 'wallet_transaction', new_transaction_id,
          jsonb_build_object('user_id', p_user_id, 'direction', p_direction, 'status', p_status, 'amount', p_amount, 'reference', p_reference));

  return new_transaction_id;
end;
$$;

revoke all on function public.record_wallet_transaction(uuid, text, numeric, text, text, uuid, text) from public;
grant execute on function public.record_wallet_transaction(uuid, text, numeric, text, text, uuid, text) to authenticated;

insert into public.role_permissions(role, permission)
values ('admin', 'manage_wallet')
on conflict do nothing;
