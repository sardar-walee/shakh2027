-- SHAKH V2 / Supabase production schema
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('super_admin','captain','restaurant','supermarket','clothing','beauty','auto','customer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.post_status as enum ('pending','published','rejected','blacklisted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('new','accepted','preparing','out_for_delivery','delivered','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transaction_type as enum ('merchant_payment','delivery_fee','goods_amount','platform_fee','refund','adjustment'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', phone text, role public.app_role not null default 'customer',
 parent_id uuid references public.profiles(id) on delete set null, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.posts(
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
 section public.app_role not null, post_type text not null default 'product', title text not null, description text not null default '',
 price numeric(14,2) not null default 0, images text[] not null default '{}', delivery_fee numeric(14,2) not null default 0,
 platform_fee numeric(14,2) not null default 0, car_make text, car_model text, car_year int, car_mileage int, car_location text,
 status public.post_status not null default 'pending', rejection_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.captain_invites(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
 code text unique not null, vehicle text, plate_number text, used_by uuid references public.profiles(id) on delete set null,
 expires_at timestamptz default (now()+interval '30 days'), created_at timestamptz not null default now()
);
create table if not exists public.captains(
 id uuid primary key default gen_random_uuid(), profile_id uuid unique not null references public.profiles(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade, vehicle text, plate_number text,
 is_available boolean not null default true, total_delivery_earnings numeric(14,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.orders(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id), merchant_id uuid references public.profiles(id),
 captain_id uuid references public.profiles(id), goods_amount numeric(14,2) not null default 0, delivery_fee numeric(14,2) not null default 0,
 platform_fee numeric(14,2) not null default 0, total_amount numeric(14,2) generated always as (goods_amount+delivery_fee+platform_fee) stored,
 merchant_due numeric(14,2) generated always as (goods_amount) stored, captain_due numeric(14,2) generated always as (delivery_fee) stored,
 platform_revenue numeric(14,2) generated always as (platform_fee) stored, status public.order_status not null default 'new', notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_transactions(
 id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete set null, actor_id uuid references public.profiles(id) on delete set null,
 transaction_type public.transaction_type not null, amount numeric(14,2) not null, direction text not null check(direction in ('in','out')),
 note text not null default '', settled boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs(
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null, action text not null,
 entity_type text not null, entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='super_admin' and active); $$;
create or replace function public.my_role() returns public.app_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid(); $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'phone') on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.claim_captain_invite(p_code text) returns boolean language plpgsql security definer set search_path=public as $$ declare inv public.captain_invites; begin select * into inv from public.captain_invites where code=upper(trim(p_code)) and used_by is null and (expires_at is null or expires_at>now()) for update; if not found then return false; end if; update public.profiles set role='captain',parent_id=inv.owner_id where id=auth.uid(); insert into public.captains(profile_id,owner_id,vehicle,plate_number) values(auth.uid(),inv.owner_id,inv.vehicle,inv.plate_number) on conflict(profile_id) do update set owner_id=excluded.owner_id,vehicle=excluded.vehicle,plate_number=excluded.plate_number; update public.captain_invites set used_by=auth.uid() where id=inv.id; return true; end $$;
create or replace function public.create_order(p_customer_id uuid,p_merchant_id uuid,p_goods_amount numeric,p_delivery_fee numeric,p_platform_fee numeric,p_notes text default '') returns uuid language plpgsql security definer set search_path=public as $$ declare oid uuid; begin if auth.uid()<>p_customer_id and not public.is_admin() then raise exception 'unauthorized'; end if; insert into public.orders(customer_id,merchant_id,goods_amount,delivery_fee,platform_fee,notes) values(p_customer_id,p_merchant_id,greatest(p_goods_amount,0),greatest(p_delivery_fee,0),greatest(p_platform_fee,0),coalesce(p_notes,'')) returning id into oid; insert into public.financial_transactions(order_id,actor_id,transaction_type,amount,direction,note) values(oid,p_customer_id,'goods_amount',greatest(p_goods_amount,0),'in','پارەی کاڵا'),(oid,p_customer_id,'delivery_fee',greatest(p_delivery_fee,0),'in','پارەی گەیاندن'),(oid,p_customer_id,'platform_fee',greatest(p_platform_fee,0),'in','پارەی پلاتفۆرمی شاخ'); return oid; end $$;
create or replace function public.audit(p_action text,p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}') returns void language plpgsql security definer set search_path=public as $$ begin insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),p_action,p_entity_type,p_entity_id,coalesce(p_metadata,'{}')); end $$;

alter table public.profiles enable row level security; alter table public.posts enable row level security; alter table public.captain_invites enable row level security; alter table public.captains enable row level security; alter table public.orders enable row level security; alter table public.financial_transactions enable row level security; alter table public.audit_logs enable row level security;

drop policy if exists profiles_select on public.profiles; create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin() or parent_id=auth.uid());
drop policy if exists profiles_update on public.profiles; create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
drop policy if exists posts_select on public.posts; create policy posts_select on public.posts for select to anon,authenticated using(status='published' or author_id=auth.uid() or public.is_admin() or section=public.my_role());
drop policy if exists posts_insert on public.posts; create policy posts_insert on public.posts for insert to authenticated with check(author_id=auth.uid() and (public.is_admin() or section=public.my_role() or post_type='car'));
drop policy if exists posts_update on public.posts; create policy posts_update on public.posts for update to authenticated using(author_id=auth.uid() or public.is_admin()) with check(author_id=auth.uid() or public.is_admin());
drop policy if exists posts_delete on public.posts; create policy posts_delete on public.posts for delete to authenticated using(public.is_admin());
drop policy if exists invites_select on public.captain_invites; create policy invites_select on public.captain_invites for select to authenticated using(owner_id=auth.uid() or public.is_admin());
drop policy if exists invites_insert on public.captain_invites; create policy invites_insert on public.captain_invites for insert to authenticated with check(owner_id=auth.uid() or public.is_admin());
drop policy if exists captains_select on public.captains; create policy captains_select on public.captains for select to authenticated using(owner_id=auth.uid() or profile_id=auth.uid() or public.is_admin());
drop policy if exists captains_update on public.captains; create policy captains_update on public.captains for update to authenticated using(owner_id=auth.uid() or profile_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or profile_id=auth.uid() or public.is_admin());
drop policy if exists orders_select on public.orders; create policy orders_select on public.orders for select to authenticated using(customer_id=auth.uid() or merchant_id=auth.uid() or captain_id=auth.uid() or public.is_admin());
drop policy if exists orders_insert on public.orders; create policy orders_insert on public.orders for insert to authenticated with check(customer_id=auth.uid() or public.is_admin());
drop policy if exists orders_update on public.orders; create policy orders_update on public.orders for update to authenticated using(customer_id=auth.uid() or merchant_id=auth.uid() or captain_id=auth.uid() or public.is_admin()) with check(customer_id=auth.uid() or merchant_id=auth.uid() or captain_id=auth.uid() or public.is_admin());
drop policy if exists finance_select on public.financial_transactions; create policy finance_select on public.financial_transactions for select to authenticated using(actor_id=auth.uid() or public.is_admin());
drop policy if exists finance_admin_insert on public.financial_transactions; create policy finance_admin_insert on public.financial_transactions for insert to authenticated with check(public.is_admin());
drop policy if exists audit_admin on public.audit_logs; create policy audit_admin on public.audit_logs for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Recommended storage bucket for post images:
-- insert into storage.buckets(id,name,public) values('post-images','post-images',true) on conflict(id) do nothing;
-- Then add storage RLS policies appropriate to your deployment.
-- IMPORTANT: create the first super admin manually after signup:
-- update public.profiles set role='super_admin' where id='USER_UUID';
