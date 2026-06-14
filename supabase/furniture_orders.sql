-- Furniture orders / companies for SmartBuild.Tech
-- Catalog rows use full_name; calculator inserts use client_name + client_phone.

create table if not exists public.furniture_orders (
  id uuid primary key default gen_random_uuid(),
  slug text,
  full_name text,
  client_name text,
  client_phone text,
  furniture_type text,
  work_type text,
  phone text,
  city text,
  specialty text,
  description text,
  whatsapp_phone text,
  tg_username text,
  whatsapp text,
  telegram text,
  instagram text,
  facebook text,
  created_at timestamptz not null default now()
);

create unique index if not exists furniture_orders_slug_key
  on public.furniture_orders (slug)
  where slug is not null;

alter table public.furniture_orders enable row level security;

drop policy if exists "Public read furniture_orders" on public.furniture_orders;
create policy "Public read furniture_orders"
  on public.furniture_orders for select
  using (true);

drop policy if exists "Public insert furniture_orders" on public.furniture_orders;
create policy "Public insert furniture_orders"
  on public.furniture_orders for insert
  with check (true);

-- Requires public.is_app_admin() from supabase/masters.sql
drop policy if exists "Admin delete furniture_orders" on public.furniture_orders;
create policy "Admin delete furniture_orders"
  on public.furniture_orders for delete
  using (public.is_app_admin());

drop policy if exists "Admin update furniture_orders" on public.furniture_orders;
create policy "Admin update furniture_orders"
  on public.furniture_orders for update
  using (public.is_app_admin())
  with check (public.is_app_admin());
