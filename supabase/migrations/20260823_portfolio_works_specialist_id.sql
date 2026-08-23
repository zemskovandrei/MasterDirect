-- Live schema uses specialist_id (not owner_id). Align RLS with that.

alter table if exists public.portfolio_works enable row level security;

drop policy if exists "portfolio_works public read" on public.portfolio_works;
create policy "portfolio_works public read"
  on public.portfolio_works for select
  to anon, authenticated
  using (coalesce(status, '') is distinct from 'rejected');

drop policy if exists "portfolio_works authenticated insert" on public.portfolio_works;
create policy "portfolio_works authenticated insert"
  on public.portfolio_works for insert
  to authenticated
  with check (auth.uid() = specialist_id);

drop policy if exists "portfolio_works authenticated update own" on public.portfolio_works;
create policy "portfolio_works authenticated update own"
  on public.portfolio_works for update
  to authenticated
  using (auth.uid() = specialist_id)
  with check (auth.uid() = specialist_id);
