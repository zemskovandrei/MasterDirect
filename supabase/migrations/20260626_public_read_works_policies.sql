-- Public read policies for gallery works tables.
-- Run in Supabase SQL Editor if these policies are missing in production.

-- ─── portfolio_works ───────────────────────────────────────────────────────
alter table if exists public.portfolio_works enable row level security;

drop policy if exists "portfolio_works public read" on public.portfolio_works;
create policy "portfolio_works public read"
  on public.portfolio_works for select
  to anon, authenticated
  using (
    -- keep rejected works hidden from public feed
    coalesce(status, 'not_requested') <> 'rejected'
  );

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

-- ─── works (legacy table) ──────────────────────────────────────────────────
alter table if exists public.works enable row level security;

drop policy if exists "works public read" on public.works;
create policy "works public read"
  on public.works for select
  to anon, authenticated
  using (
    coalesce(status, 'not_requested') <> 'rejected'
  );

drop policy if exists "works authenticated insert" on public.works;
create policy "works authenticated insert"
  on public.works for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "works authenticated update own" on public.works;
create policy "works authenticated update own"
  on public.works for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
