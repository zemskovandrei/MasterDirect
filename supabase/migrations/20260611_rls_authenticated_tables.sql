-- RLS: authenticated select/insert + anon public access.
-- Колонка order.user_id → specialist.id (nullable для гостевых заявок).
-- Supabase → SQL Editor → Run

alter table public."order" add column if not exists user_id uuid references public.specialist(id) on delete set null;

create index if not exists order_user_id_created_at_idx
  on public."order" (user_id, created_at desc);

-- ─── specialist ─────────────────────────────────────────────────────────────
alter table public.specialist
  add column if not exists account_type text;

update public.specialist
set account_type = 'worker'
where account_type is null or trim(account_type) = '';

alter table public.specialist
  drop constraint if exists specialist_account_type_check;

alter table public.specialist
  add constraint specialist_account_type_check
  check (account_type in ('worker', 'brigade', 'furniture'));

alter table public.specialist
  alter column account_type set not null;

create index if not exists specialist_account_type_name_idx
  on public.specialist (account_type, name);

alter table public.specialist enable row level security;

drop policy if exists "Specialist authenticated read" on public.specialist;
create policy "Specialist authenticated read"
  on public.specialist for select
  to authenticated
  using (true);

drop policy if exists "Specialist authenticated insert" on public.specialist;
create policy "Specialist authenticated insert"
  on public.specialist for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Specialist authenticated update own" on public.specialist;
create policy "Specialist authenticated update own"
  on public.specialist for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Публичное чтение каталога (anon) — без него профили не видны до входа
drop policy if exists "Specialist public read" on public.specialist;
create policy "Specialist public read"
  on public.specialist for select
  to anon
  using (coalesce(is_archive, false) = false);

-- ─── order ──────────────────────────────────────────────────────────────────
alter table public."order" enable row level security;

drop policy if exists "Order authenticated read" on public."order";
create policy "Order authenticated read"
  on public."order" for select
  to authenticated
  using (true);

drop policy if exists "Order authenticated insert" on public."order";
create policy "Order authenticated insert"
  on public."order" for insert
  to authenticated
  with check (true);

drop policy if exists "Order authenticated update" on public."order";
create policy "Order authenticated update"
  on public."order" for update
  to authenticated
  using (true)
  with check (true);

-- Калькулятор на /jobs работает без входа
drop policy if exists "Order anon insert" on public."order";
create policy "Order anon insert"
  on public."order" for insert
  to anon
  with check (true);

drop policy if exists "Order public read active" on public."order";
create policy "Order public read active"
  on public."order" for select
  to anon
  using (status is distinct from 'completed');

-- ─── site_reviews ─────────────────────────────────────────────────────────────
alter table public.site_reviews enable row level security;

drop policy if exists "Reviews authenticated read" on public.site_reviews;
create policy "Reviews authenticated read"
  on public.site_reviews for select
  to authenticated
  using (true);

drop policy if exists "Reviews authenticated insert" on public.site_reviews;
create policy "Reviews authenticated insert"
  on public.site_reviews for insert
  to authenticated
  with check (true);

drop policy if exists "Reviews authenticated update" on public.site_reviews;
create policy "Reviews authenticated update"
  on public.site_reviews for update
  to authenticated
  using (true)
  with check (true);

-- Одобренные отзывы на главной — для всех
drop policy if exists "Reviews public read approved" on public.site_reviews;
create policy "Reviews public read approved"
  on public.site_reviews for select
  to anon
  using (coalesce(is_approved, false) = true);

drop policy if exists "Reviews anon insert" on public.site_reviews;
create policy "Reviews anon insert"
  on public.site_reviews for insert
  to anon
  with check (true);
