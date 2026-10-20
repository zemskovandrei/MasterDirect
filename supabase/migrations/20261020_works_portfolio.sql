-- Finished works (album / single photo) — simpler than portfolio_works before/after.

drop table if exists public.works_portfolio;

create table public.works_portfolio (
  id uuid default gen_random_uuid() primary key,
  specialist_id uuid references auth.users(id) not null default auth.uid(),
  title text,
  description text,
  image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists works_portfolio_specialist_id_idx
  on public.works_portfolio (specialist_id);

alter table public.works_portfolio enable row level security;

drop policy if exists "Public read works" on public.works_portfolio;
create policy "Public read works" on public.works_portfolio
  for select
  using (true);

drop policy if exists "Specialists can insert own works" on public.works_portfolio;
create policy "Specialists can insert own works" on public.works_portfolio
  for insert to authenticated
  with check (auth.uid() = specialist_id);

drop policy if exists "Specialists can delete own works" on public.works_portfolio;
create policy "Specialists can delete own works" on public.works_portfolio
  for delete to authenticated
  using (auth.uid() = specialist_id);

grant select on table public.works_portfolio to anon, authenticated;
grant insert, delete on table public.works_portfolio to authenticated;

notify pgrst, 'reload schema';
