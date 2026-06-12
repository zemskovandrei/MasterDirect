-- Policies for public job listings (jobklient).
-- Run in Supabase SQL editor if update/delete from the site returns 401/403.

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
