-- SHAKH SUPER v3: GPS, commissions, car listing fees, dynamic post attributes, captains

alter type public.post_status add value if not exists 'pending_payment';
alter type public.post_status add value if not exists 'pending_review';

alter table public.profiles
  add column if not exists delivery_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists merchant_commission_percent numeric(5,2),
  add column if not exists captain_kind text check (captain_kind is null or captain_kind in ('shakh','merchant')),
  add column if not exists captain_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists is_active boolean not null default true;

alter table public.posts
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists images text[] not null default '{}',
  add column if not exists receipt_url text,
  add column if not exists listing_fee numeric(14,2) not null default 0,
  add column if not exists listing_fee_paid boolean not null default false,
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists verified_at timestamptz,
  add column if not exists contact_phone text,
  add column if not exists location_label text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.orders
  add column if not exists customer_lat double precision,
  add column if not exists customer_lng double precision,
  add column if not exists distance_km numeric(10,2),
  add column if not exists merchant_id uuid references public.profiles(id);

alter table public.platform_settings
  add column if not exists captain_platform_percent numeric(5,2) not null default 30,
  add column if not exists captain_share_percent numeric(5,2) not null default 70,
  add column if not exists car_listing_fee_percent numeric(5,2) not null default 3,
  add column if not exists car_listing_fee_min numeric(14,2) not null default 25000,
  add column if not exists delivery_fee_per_km numeric(14,2) not null default 500,
  add column if not exists site_domain text not null default 'daim-post.online';

create table if not exists public.post_reviews(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  action text not null check (action in ('approve','reject')),
  note text,
  created_at timestamptz default now()
);

alter table public.post_reviews enable row level security;

create policy "authenticated insert post reviews" on public.post_reviews
for insert with check (auth.uid() = reviewer_id);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "users insert own profile" on public.profiles
for insert with check (auth.uid() = id);

create policy "public read active posts or own pending" on public.posts
for select using (
  status = 'active'
  or auth.uid() = owner_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','admin')
  )
);

drop policy if exists "public active posts" on public.posts;

create policy "super admin update any post" on public.posts
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

create policy "super admin read platform settings write" on public.platform_settings
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

insert into public.role_permissions(role, permission) values
('super_admin','verify_car_posts'),
('super_admin','edit_commissions'),
('super_admin','create_shakh_captain'),
('restaurant','create_captain'),
('supermarket','create_captain'),
('fashion','create_captain'),
('beauty','create_captain'),
('car_dealer','create_captain')
on conflict do nothing;
