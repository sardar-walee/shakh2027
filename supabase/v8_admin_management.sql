-- SHAKH SUPER v8: server-protected admin management.
-- Run after v7_car_payment_verification.sql. No destructive deletes.

insert into public.role_permissions(role, permission) values
  ('admin', 'manage_users'),
  ('admin', 'manage_posts'),
  ('admin', 'manage_orders'),
  ('admin', 'view_audit_logs')
on conflict do nothing;

drop function if exists public.get_admin_management_data();
create or replace function public.get_admin_management_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not (
    public.has_permission('manage_users') or public.has_permission('manage_posts')
    or public.has_permission('manage_orders') or public.has_permission('view_audit_logs')
  ) then
    raise exception 'admin permission required';
  end if;

  select jsonb_build_object(
    'users', case when public.has_permission('manage_users') then coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.created_at desc)
      from (
        select p.id, p.full_name, p.phone, p.role, p.is_active, p.created_at, u.email
        from public.profiles p
        left join auth.users u on u.id = p.id
        order by p.created_at desc limit 500
      ) rows
    ), '[]'::jsonb) else '[]'::jsonb end,
    'posts', case when public.has_permission('manage_posts') then coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.created_at desc)
      from (
        select p.id, p.owner_id, p.title, p.category, p.price, p.status, p.payment_status,
               p.listing_fee_paid, p.created_at, pr.full_name as owner_name
        from public.posts p
        left join public.profiles pr on pr.id = p.owner_id
        order by p.created_at desc limit 500
      ) rows
    ), '[]'::jsonb) else '[]'::jsonb end,
    'orders', case when public.has_permission('manage_orders') then coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.created_at desc)
      from (
        select o.id, o.customer_id, o.captain_id, o.merchant_id, o.status,
               o.products_total, o.delivery_fee, o.platform_fee, o.total, o.created_at,
               cp.full_name as customer_name, cap.full_name as captain_name
        from public.orders o
        left join public.profiles cp on cp.id = o.customer_id
        left join public.profiles cap on cap.id = o.captain_id
        order by o.created_at desc limit 500
      ) rows
    ), '[]'::jsonb) else '[]'::jsonb end,
    'captains', case when public.has_permission('manage_users') then coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.created_at desc)
      from (
        select p.id, p.full_name, p.phone, p.is_active, p.captain_kind, p.captain_owner_id,
               p.created_at, u.email
        from public.profiles p
        left join auth.users u on u.id = p.id
        where p.role = 'captain'
        order by p.created_at desc limit 500
      ) rows
    ), '[]'::jsonb) else '[]'::jsonb end,
    'audit_logs', case when public.has_permission('view_audit_logs') then coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.created_at desc)
      from (
        select id, actor_id, action, entity_type, entity_id, metadata, created_at
        from public.audit_logs order by created_at desc limit 500
      ) rows
    ), '[]'::jsonb) else '[]'::jsonb end,
    'permissions', case when public.current_user_role() = 'super_admin'::public.app_role then coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.role, rows.permission)
      from (select role, permission from public.role_permissions) rows
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into result;

  return result;
end;
$$;

drop function if exists public.admin_set_user_active(uuid, boolean);
create or replace function public.admin_set_user_active(p_user_id uuid, p_is_active boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('manage_users') then raise exception 'user management permission required'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot change own active status'; end if;
  if public.current_user_role() = 'admin'::public.app_role
     and exists (select 1 from public.profiles where id = p_user_id and role in ('admin', 'super_admin')) then
    raise exception 'admin cannot change privileged user status';
  end if;
  update public.profiles set is_active = p_is_active where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_is_active then 'user_activated' else 'user_deactivated' end, 'profile', p_user_id, jsonb_build_object('is_active', p_is_active));
  return true;
end;
$$;

drop function if exists public.admin_set_captain_active(uuid, boolean);
create or replace function public.admin_set_captain_active(p_captain_id uuid, p_is_active boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('manage_users') then raise exception 'captain management permission required'; end if;
  update public.profiles set is_active = p_is_active where id = p_captain_id and role = 'captain';
  if not found then raise exception 'captain not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_is_active then 'captain_activated' else 'captain_deactivated' end, 'profile', p_captain_id, jsonb_build_object('is_active', p_is_active));
  return true;
end;
$$;

drop function if exists public.admin_moderate_post(uuid, text);
create or replace function public.admin_moderate_post(p_post_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare next_status text;
begin
  if auth.uid() is null or not public.has_permission('manage_posts') then raise exception 'post management permission required'; end if;
  if p_action not in ('approve', 'block', 'restore') then raise exception 'invalid moderation action'; end if;
  next_status := case p_action when 'approve' then 'active' when 'block' then 'blocked' else 'active' end;
  update public.posts set status = next_status,
    verified_by = case when p_action = 'approve' then auth.uid() else verified_by end,
    verified_at = case when p_action = 'approve' then now() else verified_at end
    where id = p_post_id;
  if not found then raise exception 'post not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'post_' || p_action, 'post', p_post_id, jsonb_build_object('status', next_status));
  return true;
end;
$$;

drop function if exists public.admin_set_order_status(uuid, text);
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('manage_orders') then raise exception 'order management permission required'; end if;
  if p_status not in ('pending','accepted','preparing','out_for_delivery','delivered','cancelled') then raise exception 'invalid order status'; end if;
  update public.orders set status = p_status::public.order_status where id = p_order_id;
  if not found then raise exception 'order not found'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'order_status_changed', 'order', p_order_id, jsonb_build_object('status', p_status));
  return true;
end;
$$;

revoke all on function public.get_admin_management_data() from public;
revoke all on function public.admin_set_user_active(uuid, boolean) from public;
revoke all on function public.admin_set_captain_active(uuid, boolean) from public;
revoke all on function public.admin_moderate_post(uuid, text) from public;
revoke all on function public.admin_set_order_status(uuid, text) from public;
grant execute on function public.get_admin_management_data() to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function public.admin_set_captain_active(uuid, boolean) to authenticated;
grant execute on function public.admin_moderate_post(uuid, text) to authenticated;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;
