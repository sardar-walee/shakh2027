-- SHAKH SUPER production repair / idempotent migration
-- Run this AFTER the baseline schema/migrations. It fixes the two recurring
-- structural problems: category being tied to the user-role enum, and
-- client-side role simulation. It also installs deterministic RLS.

create extension if not exists "pgcrypto";

-- 1) Ensure all application roles exist. PostgreSQL enum values are added only
-- when missing, so this is safe to re-run.
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='app_role' and e.enumlabel='admin')
  then alter type public.app_role add value 'admin'; end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='app_role' and e.enumlabel='captain')
  then alter type public.app_role add value 'captain'; end if;
end $$;

-- 2) Posts belong to a marketplace SECTION, not a user ROLE.
-- Converting category to text prevents PostgreSQL enum errors when a section
-- is introduced that is not an authentication role.
do $$
declare ctype text;
begin
  select data_type into ctype
  from information_schema.columns
  where table_schema='public' and table_name='posts' and column_name='category';
  if ctype = 'USER-DEFINED' then
    alter table public.posts alter column category type text using category::text;
  end if;
end $$;

alter table public.posts
  drop constraint if exists posts_category_check;

alter table public.posts
  add constraint posts_category_check
  check (category in ('restaurant','supermarket','fashion','beauty','car_dealer'));

-- 3) Add any missing core columns expected by the application.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.posts add column if not exists description text;
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists price numeric(14,2) not null default 0;
alter table public.posts add column if not exists currency text not null default 'IQD';
alter table public.posts add column if not exists status text not null default 'active';
alter table public.posts add column if not exists created_at timestamptz default now();

-- 4) Repair the auth profile trigger. New users are always customers until an
-- authorized admin promotes them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.phone,
    'customer'
  )
  on conflict (id) do update
    set full_name = case
      when coalesce(public.profiles.full_name,'')='' then excluded.full_name
      else public.profiles.full_name
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users created before the trigger existed.
insert into public.profiles(id, full_name, phone, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name',''), u.phone, 'customer'
from auth.users u
left join public.profiles p on p.id=u.id
where p.id is null
on conflict (id) do nothing;

-- 5) Security helpers. They use SECURITY DEFINER so RLS on profiles does not
-- recursively block authorization checks.
create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer
set search_path=public
as $$
  select role from public.profiles where id=auth.uid();
$$;

create or replace function public.has_permission(required_permission text)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists (
    select 1 from public.role_permissions rp
    where rp.role = public.current_user_role()
      and (rp.permission='*' or rp.permission=required_permission)
  );
$$;

create or replace function public.can_create_post(section text)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select public.current_user_role() = 'super_admin'::public.app_role
      or (
        public.current_user_role()::text = section
        and section in ('restaurant','supermarket','fashion','beauty','car_dealer')
      );
$$;

-- 6) Deterministic RLS for posts. Everyone may read active posts; only the
-- correct section role or super_admin may create. Owners/admins can update;
-- super_admin can delete/block.
alter table public.posts enable row level security;
drop policy if exists "public active posts" on public.posts;
drop policy if exists "users create permitted posts" on public.posts;
drop policy if exists "owners or admins update posts" on public.posts;
drop policy if exists "owners or admins delete posts" on public.posts;

create policy "public active posts"
on public.posts for select
using (status='active' or auth.uid()=owner_id or public.current_user_role()='super_admin');

create policy "users create permitted posts"
on public.posts for insert
with check (
  auth.uid()=owner_id
  and public.can_create_post(category)
);

create policy "owners or admins update posts"
on public.posts for update
using (
  auth.uid()=owner_id
  or public.current_user_role()='super_admin'
  or public.has_permission('manage_posts')
)
with check (
  auth.uid()=owner_id
  or public.current_user_role()='super_admin'
  or public.has_permission('manage_posts')
);

create policy "owners or admins delete posts"
on public.posts for delete
using (
  auth.uid()=owner_id
  or public.current_user_role()='super_admin'
  or public.has_permission('manage_posts')
);

-- 7) Profiles: users can read/update their own profile; admins/super_admin can
-- manage users. A normal user cannot promote themselves.
alter table public.profiles enable row level security;
drop policy if exists "users see own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;

create policy "users see own profile"
on public.profiles for select using (auth.uid()=id or public.has_permission('manage_users'));

create policy "users update own profile"
on public.profiles for update
using (auth.uid()=id or public.has_permission('manage_users'))
with check (
  (auth.uid()=id and role=public.current_user_role())
  or public.has_permission('manage_users')
);

create policy "admins manage profiles"
on public.profiles for all
using (public.has_permission('manage_users'))
with check (public.has_permission('manage_users'));

-- 8) Orders and order-items: customer creates their own cash order; customer,
-- assigned captain, and authorized managers can read. No client can assign
-- themselves as captain.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
drop policy if exists "customers create orders" on public.orders;
drop policy if exists "users see related orders" on public.orders;
drop policy if exists "captains update assigned orders" on public.orders;
drop policy if exists "users see own order items" on public.order_items;
drop policy if exists "users create order items" on public.order_items;

create policy "customers create orders"
on public.orders for insert
with check (
  auth.uid()=customer_id
  and payment_method='cash_on_delivery'
  and captain_id is null
);

create policy "users see related orders"
on public.orders for select
using (
  auth.uid()=customer_id
  or auth.uid()=captain_id
  or public.has_permission('manage_orders')
);

create policy "captains update assigned orders"
on public.orders for update
using (auth.uid()=captain_id or public.has_permission('manage_orders'))
with check (auth.uid()=captain_id or public.has_permission('manage_orders'));

create policy "users see own order items"
on public.order_items for select
using (
  exists (
    select 1 from public.orders o
    where o.id=order_items.order_id
      and (o.customer_id=auth.uid() or o.captain_id=auth.uid()
           or public.has_permission('manage_orders'))
  )
);

create policy "users create order items"
on public.order_items for insert
with check (
  exists (
    select 1 from public.orders o
    where o.id=order_items.order_id and o.customer_id=auth.uid()
  )
);

-- 9) Realtime publication: add tables only if not already members.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='posts'
  ) then alter publication supabase_realtime add table public.posts; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='orders'
  ) then alter publication supabase_realtime add table public.orders; end if;
end $$;

-- 10) Useful indexes for the public feed and order dashboards.
create index if not exists posts_active_created_at_idx on public.posts(status,created_at desc);
create index if not exists posts_category_created_at_idx on public.posts(category,created_at desc);
create index if not exists orders_customer_created_at_idx on public.orders(customer_id,created_at desc);
create index if not exists orders_captain_created_at_idx on public.orders(captain_id,created_at desc);
