-- Портфолио «до / после» — постоянное хранение в Supabase

create table if not exists public.portfolio_works (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  owner_type text not null check (owner_type in ('worker', 'brigade', 'furniture')),
  title text not null default '',
  description text not null default '',
  before_image_url text not null,
  after_image_url text not null,
  verification_status text not null default 'not_requested',
  client_contact text,
  verification_token text,
  verification_code text,
  verified_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_works_owner_id_idx on public.portfolio_works (owner_id);
create index if not exists portfolio_works_created_at_idx on public.portfolio_works (created_at desc);

alter table public.portfolio_works enable row level security;

drop policy if exists "Portfolio works public read" on public.portfolio_works;
create policy "Portfolio works public read"
  on public.portfolio_works for select
  using (true);

drop policy if exists "Portfolio works owner insert" on public.portfolio_works;
create policy "Portfolio works owner insert"
  on public.portfolio_works for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Portfolio works owner update" on public.portfolio_works;
create policy "Portfolio works owner update"
  on public.portfolio_works for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Portfolio works owner delete" on public.portfolio_works;
create policy "Portfolio works owner delete"
  on public.portfolio_works for delete
  using (auth.uid() = owner_id);

drop policy if exists "Portfolio works admin manage" on public.portfolio_works;
create policy "Portfolio works admin manage"
  on public.portfolio_works for all
  using (coalesce(auth.jwt() ->> 'email', '') = 'admin@smartbuild.tech')
  with check (coalesce(auth.jwt() ->> 'email', '') = 'admin@smartbuild.tech');
