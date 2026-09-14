-- SHAKH DATABASE / Supabase
create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum (
    'super_admin','captain','restaurant','supermarket','clothing','beauty','auto','customer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_status as enum ('pending','published','rejected','blacklisted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('new','accepted','preparing','out_for_delivery','delivered','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('merchant_payment','delivery_fee','goods_amount','platform_fee','refund','adjustment');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'customer',
  parent_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  section public.app_role not null,
  post_type text not null default 'product',
  title text not null,
  description text not null default '',
  price numeric(12,2),
  images text[] not null default '{}',
  car_make text,
  car_model text,
  car_year int,
  car_mileage int,
  car_location text,
  status public.post_status not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.captains (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vehicle text,
  plate_number text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  merchant_id uuid references public.profiles(id),
  captain_id uuid references public.profiles(id),
  goods_amount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) generated always as (goods_amount + delivery_fee + platform_fee) stored,
  merchant_due numeric(12,2) generated always as (goods_amount) stored,
  captain_due numeric(12,2) generated always as (delivery_fee) stored,
  platform_revenue numeric(12,2) generated always as (platform_fee) stored,
  status public.order_status not null default 'new',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  transaction_type public.transaction_type not null,
  amount numeric(12,2) not null,
  direction text not null check (direction in ('in','out')),
  note text not null default '',
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='super_admin' and active=true); $$;

create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id=auth.uid(); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.captains enable row level security;
alter table public.orders enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin() or parent_id=auth.uid());

drop policy if exists "profiles update own/admin" on public.profiles;
create policy "profiles update own/admin" on public.profiles for update to authenticated
using (id=auth.uid() or public.is_admin())
with check (id=auth.uid() or public.is_admin());

-- Posts
drop policy if exists "published posts public" on public.posts;
create policy "published posts public" on public.posts for select to anon, authenticated
using (status='published' or author_id=auth.uid() or public.is_admin());

drop policy if exists "users create posts in own section" on public.posts;
create policy "users create posts in own section" on public.posts for insert to authenticated
with check (
  author_id=auth.uid()
  and (public.is_admin() or section=public.my_role())
);

drop policy if exists "users edit own/admin" on public.posts;
create policy "users edit own/admin" on public.posts for update to authenticated
using (author_id=auth.uid() or public.is_admin())
with check (author_id=auth.uid() or public.is_admin());

drop policy if exists "admin delete posts" on public.posts;
create policy "admin delete posts" on public.posts for delete to authenticated
using (public.is_admin());

-- Captains
drop policy if exists "captains read" on public.captains;
create policy "captains read" on public.captains for select to authenticated
using (owner_id=auth.uid() or profile_id=auth.uid() or public.is_admin());

drop policy if exists "captains create" on public.captains;
create policy "captains create" on public.captains for insert to authenticated
with check (owner_id=auth.uid() and public.my_role() <> 'customer');

drop policy if exists "captains admin update" on public.captains;
create policy "captains admin update" on public.captains for update to authenticated
using (owner_id=auth.uid() or public.is_admin())
with check (owner_id=auth.uid() or public.is_admin());

-- Orders
drop policy if exists "orders visible" on public.orders;
create policy "orders visible" on public.orders for select to authenticated
using (customer_id=auth.uid() or merchant_id=auth.uid() or captain_id=auth.uid() or public.is_admin());

drop policy if exists "customer creates order" on public.orders;
create policy "customer creates order" on public.orders for insert to authenticated
with check (customer_id=auth.uid());

drop policy if exists "participants update orders" on public.orders;
create policy "participants update orders" on public.orders for update to authenticated
using (customer_id=auth.uid() or merchant_id=auth.uid() or captain_id=auth.uid() or public.is_admin())
with check (customer_id=auth.uid() or merchant_id=auth.uid() or captain_id=auth.uid() or public.is_admin());

-- Finance
drop policy if exists "finance visible" on public.financial_transactions;
create policy "finance visible" on public.financial_transactions for select to authenticated
using (actor_id=auth.uid() or public.is_admin());

drop policy if exists "finance admin insert" on public.financial_transactions;
create policy "finance admin insert" on public.financial_transactions for insert to authenticated
with check (public.is_admin());

drop policy if exists "audit admin" on public.audit_logs;
create policy "audit admin" on public.audit_logs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- First super admin:
-- 1) Create the account in Supabase Authentication.
-- 2) Then run:
-- update public.profiles set role='super_admin' where id='USER_UUID_HERE';
