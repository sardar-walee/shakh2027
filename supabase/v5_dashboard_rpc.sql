-- SHAKH SUPER v5: controlled dashboard data access.
-- Run after v4_production_hardening.sql. No existing rows are deleted.

insert into public.role_permissions(role, permission) values
  ('admin', 'manage_users'),
  ('admin', 'manage_orders'),
  ('admin', 'view_audit_logs')
on conflict do nothing;

drop policy if exists "merchants see related orders" on public.orders;
create policy "merchants see related orders" on public.orders
for select using (
  exists (
    select 1
    from public.order_items oi
    join public.posts p on p.id = oi.post_id
    where oi.order_id = orders.id and p.owner_id = auth.uid()
  )
);

drop policy if exists "authorized users read audit logs" on public.audit_logs;
create policy "authorized users read audit logs" on public.audit_logs
for select using (public.has_permission('view_audit_logs'));

create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_role public.app_role;
  dashboard jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select role into current_role from public.profiles where id = current_user_id;
  if current_role is null then
    raise exception 'profile not found';
  end if;

  with visible_posts as (
    select p.*
    from public.posts p
    where p.owner_id = current_user_id
       or public.has_permission('manage_posts')
  ),
  visible_orders as (
    select o.*
    from public.orders o
    where o.customer_id = current_user_id
       or o.captain_id = current_user_id
       or exists (
         select 1
         from public.order_items oi
         join public.posts p on p.id = oi.post_id
         where oi.order_id = o.id and p.owner_id = current_user_id
       )
       or public.has_permission('manage_orders')
  ),
  wallet_rows as (
    select wt.*
    from public.wallet_transactions wt
    where wt.user_id = current_user_id
    order by wt.created_at desc
    limit 50
  )
  select jsonb_build_object(
    'role', current_role,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = current_user_id),
    'stats', jsonb_build_object(
      'users', case when public.has_permission('manage_users') then (select count(*) from public.profiles) else null end,
      'posts', (select count(*) from visible_posts),
      'active_posts', (select count(*) from visible_posts where status = 'active'),
      'orders', (select count(*) from visible_orders),
      'pending_orders', (select count(*) from visible_orders where status = 'pending'),
      'completed_orders', (select count(*) from visible_orders where status = 'delivered'),
      'revenue', coalesce((select sum(case when current_role = 'captain' then captain_amount when current_role in ('restaurant','supermarket','fashion','beauty','car_dealer') then merchant_amount else total end) from visible_orders), 0),
      'platform_revenue', case when public.has_permission('manage_orders') then coalesce((select sum(platform_fee) from public.orders), 0) else null end,
      'unread_notifications', (select count(*) from public.notifications where user_id = current_user_id and is_read = false)
    ),
    'orders', coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc) from (select * from visible_orders order by created_at desc limit 50) row_data), '[]'::jsonb),
    'wallet', jsonb_build_object(
      'balance', coalesce((select sum(amount) from public.wallet_transactions where user_id = current_user_id), 0),
      'transactions', coalesce((select jsonb_agg(to_jsonb(wallet_rows) order by wallet_rows.created_at desc) from wallet_rows), '[]'::jsonb)
    ),
    'audit_logs', case when public.has_permission('view_audit_logs') then
      coalesce((select jsonb_agg(to_jsonb(log_rows) order by log_rows.created_at desc) from (select * from public.audit_logs order by created_at desc limit 100) log_rows), '[]'::jsonb)
      else '[]'::jsonb end
  ) into dashboard;

  return dashboard;
end;
$$;

revoke all on function public.get_dashboard_data() from public;
grant execute on function public.get_dashboard_data() to authenticated;
