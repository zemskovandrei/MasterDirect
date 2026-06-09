-- Таблица профилей исполнителей для SmartBuild.Tech
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('worker', 'brigade', 'furniture')),
  name text not null,
  specialty text not null,
  description text not null,
  city text,
  avatar_url text,
  phone text,
  whatsapp text,
  telegram text,
  instagram text,
  facebook text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Демо-политики для локальной разработки (уточните под продакшен)
create policy "Public read profiles"
  on public.profiles for select
  using (true);

create policy "Public insert profiles"
  on public.profiles for insert
  with check (true);

create policy "Public update profiles"
  on public.profiles for update
  using (true);

create policy "Public delete profiles"
  on public.profiles for delete
  using (true);
