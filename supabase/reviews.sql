-- Reviews table for builders

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references public.masters (id) on delete set null,
  client_name text not null,
  review_text text not null,
  rating smallint,
  kind text not null default 'review',
  performer_type text,
  performer_type_key text,
  performer_name text,
  before_image text,
  after_image text,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_master_id_idx on public.reviews (master_id);
create index if not exists reviews_is_approved_idx on public.reviews (is_approved);

alter table public.reviews enable row level security;

drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews"
  on public.reviews for select
  using (is_approved = true);

drop policy if exists "Anyone can submit review" on public.reviews;
create policy "Anyone can submit review"
  on public.reviews for insert
  with check (is_approved = false);

drop policy if exists "Admin read all reviews" on public.reviews;
create policy "Admin read all reviews"
  on public.reviews for select
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    or auth.email() in (
      select unnest(string_to_array(coalesce(current_setting('app.admin_emails', true), ''), ','))
    )
  );

drop policy if exists "Admin update reviews" on public.reviews;
create policy "Admin update reviews"
  on public.reviews for update
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (true);

drop policy if exists "Admin delete reviews" on public.reviews;
create policy "Admin delete reviews"
  on public.reviews for delete
  using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
