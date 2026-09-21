-- SHAKH SUPER v9: non-destructive compatibility repair for existing projects.
-- Run this only after inspecting the live schema and before rerunning v5/v8.
-- It does not create the baseline enum types and does not delete data.

do $$
begin
  if to_regclass('public.order_items') is null then
    raise exception 'public.order_items is missing; apply the baseline schema first';
  end if;
  if to_regclass('public.posts') is null then
    raise exception 'public.posts is missing; apply the baseline schema first';
  end if;
end $$;

alter table public.order_items add column if not exists post_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_post_id_fkey'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_post_id_fkey
      foreign key (post_id) references public.posts(id);
  end if;
end $$;

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select nullif(role::text, '')::public.app_role
  from public.profiles
  where id = auth.uid();
$$;

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
using (auth.uid() = id or public.has_permission('manage_users'))
with check (
  public.has_permission('manage_users')
  or (auth.uid() = id and role::text = public.current_user_role()::text)
);

create index if not exists order_items_post_id_idx on public.order_items(post_id);