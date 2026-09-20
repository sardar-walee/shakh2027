-- SHAKH SUPER v4: safe checkout, notifications, and final policy cleanup.
-- Run after production_repair.sql. This migration does not delete business data.

create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
drop policy if exists "users delete own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own notifications" on public.notifications for delete using (auth.uid() = user_id);
create index if not exists notifications_user_created_at_idx on public.notifications(user_id, created_at desc);

do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('profiles','posts','orders','order_items')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "users see own profile" on public.profiles for select
using (auth.uid() = id or public.has_permission('manage_users'));
create policy "users update own profile" on public.profiles for update
using (auth.uid() = id or public.has_permission('manage_users'))
with check (public.has_permission('manage_users') or (auth.uid() = id and role = public.current_user_role()));
create policy "admins manage profiles" on public.profiles for all
using (public.has_permission('manage_users')) with check (public.has_permission('manage_users'));

create policy "public active posts" on public.posts for select
using (status = 'active' or auth.uid() = owner_id or public.has_permission('manage_posts'));
create policy "users create permitted posts" on public.posts for insert
with check (auth.uid() = owner_id and public.can_create_post(category));
create policy "owners or admins update posts" on public.posts for update
using (auth.uid() = owner_id or public.has_permission('manage_posts'))
with check (auth.uid() = owner_id or public.has_permission('manage_posts'));
create policy "owners or admins delete posts" on public.posts for delete
using (auth.uid() = owner_id or public.has_permission('manage_posts'));

create or replace function public.protect_post_moderation_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission('manage_posts') then
    if new.owner_id is distinct from old.owner_id
      or new.status is distinct from old.status
      or new.verified_by is distinct from old.verified_by
      or new.verified_at is distinct from old.verified_at then
      raise exception 'post moderation fields require permission';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_post_moderation_fields on public.posts;
create trigger protect_post_moderation_fields
before update on public.posts
for each row execute function public.protect_post_moderation_fields();

create policy "customers create orders" on public.orders for insert with check (false);
create policy "users see related orders" on public.orders for select
using (auth.uid() = customer_id or auth.uid() = captain_id or public.has_permission('manage_orders'));
create policy "captains update assigned orders" on public.orders for update
using (auth.uid() = captain_id or public.has_permission('manage_orders'))
with check (auth.uid() = captain_id or public.has_permission('manage_orders'));
create policy "users see own order items" on public.order_items for select
using (exists (select 1 from public.orders o where o.id = order_items.order_id and (o.customer_id = auth.uid() or o.captain_id = auth.uid() or public.has_permission('manage_orders'))));
create policy "users create order items" on public.order_items for insert with check (false);

create or replace function public.create_cash_order(
  p_items jsonb, p_delivery_fee numeric default 0, p_address text default null,
  p_customer_lat double precision default null, p_customer_lng double precision default null,
  p_distance_km numeric default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  current_customer uuid := auth.uid(); item jsonb; post_row record; order_id uuid;
  products_total numeric := 0; quantity integer; delivery numeric;
begin
  if current_customer is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'invalid order'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    quantity := greatest(1, least(99, (item->>'quantity')::integer));
    select id, price into post_row from public.posts where id = (item->>'post_id')::uuid and status = 'active';
    if not found then raise exception 'post unavailable'; end if;
    products_total := products_total + (post_row.price * quantity);
  end loop;
  select case when p_distance_km is null then coalesce(default_delivery_fee, 5000)
    else coalesce(default_delivery_fee, 5000) + greatest(0, p_distance_km) * coalesce(delivery_fee_per_km, 500) end
    into delivery from public.platform_settings where id = true;
  delivery := coalesce(delivery, greatest(0, p_delivery_fee));
  insert into public.orders(customer_id, status, payment_method, products_total, delivery_fee, total, delivery_address, customer_lat, customer_lng, distance_km)
  values (current_customer, 'pending', 'cash_on_delivery', products_total, delivery, products_total + delivery, p_address, p_customer_lat, p_customer_lng, p_distance_km)
  returning id into order_id;
  for item in select * from jsonb_array_elements(p_items) loop
    quantity := greatest(1, least(99, (item->>'quantity')::integer));
    select price into post_row from public.posts where id = (item->>'post_id')::uuid;
    insert into public.order_items(order_id, post_id, quantity, unit_price) values (order_id, (item->>'post_id')::uuid, quantity, post_row.price);
  end loop;
  return order_id;
end;
$$;
revoke all on function public.create_cash_order(jsonb, numeric, text, double precision, double precision, numeric) from public;
grant execute on function public.create_cash_order(jsonb, numeric, text, double precision, double precision, numeric) to authenticated;