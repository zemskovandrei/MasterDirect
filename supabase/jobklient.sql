-- Таблица заказов builders
-- Актуальные колонки (проверено через REST API):
-- id, created_at, title, client_name, phone, city, budget, category, description, status

create table if not exists public.jobklient (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title text not null,
  client_name text,
  phone text,
  city text not null,
  budget numeric,
  category text,
  description text,
  status text not null default 'New'
);

alter table public.jobklient enable row level security;

drop policy if exists "Allow public read jobklient" on public.jobklient;
create policy "Allow public read jobklient"
  on public.jobklient
  for select
  using (true);

drop policy if exists "Allow public insert jobklient" on public.jobklient;
create policy "Allow public insert jobklient"
  on public.jobklient
  for insert
  with check (true);

drop policy if exists "Allow public update jobklient" on public.jobklient;
create policy "Allow public update jobklient"
  on public.jobklient
  for update
  using (true)
  with check (true);

drop policy if exists "Allow public delete jobklient" on public.jobklient;
create policy "Allow public delete jobklient"
  on public.jobklient
  for delete
  using (true);
