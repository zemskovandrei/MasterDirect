-- Исправление RLS: заявки с /jobs, отзывы, каталог, загрузка файлов.
-- Supabase Dashboard → SQL Editor → Run (весь файл целиком).

-- ─── order: гости и авторизованные могут создавать заявки ───────────────────
alter table public."order" enable row level security;

drop policy if exists "Order anon insert" on public."order";
create policy "Order anon insert"
  on public."order" for insert
  to anon
  with check (true);

drop policy if exists "Order authenticated insert" on public."order";
create policy "Order authenticated insert"
  on public."order" for insert
  to authenticated
  with check (true);

drop policy if exists "Order authenticated read" on public."order";
create policy "Order authenticated read"
  on public."order" for select
  to authenticated
  using (true);

drop policy if exists "Order authenticated update" on public."order";
create policy "Order authenticated update"
  on public."order" for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Order public read active" on public."order";
create policy "Order public read active"
  on public."order" for select
  to anon
  using (status is distinct from 'completed');

-- ─── specialist: каталог + свой профиль ─────────────────────────────────────
alter table public.specialist enable row level security;

drop policy if exists "Specialist public read" on public.specialist;
create policy "Specialist public read"
  on public.specialist for select
  to anon
  using (coalesce(is_archive, false) = false);

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

-- ─── site_reviews ───────────────────────────────────────────────────────────
alter table public.site_reviews enable row level security;

drop policy if exists "Reviews anon insert" on public.site_reviews;
create policy "Reviews anon insert"
  on public.site_reviews for insert
  to anon
  with check (true);

drop policy if exists "Reviews authenticated insert" on public.site_reviews;
create policy "Reviews authenticated insert"
  on public.site_reviews for insert
  to authenticated
  with check (true);

drop policy if exists "Reviews authenticated read" on public.site_reviews;
create policy "Reviews authenticated read"
  on public.site_reviews for select
  to authenticated
  using (true);

drop policy if exists "Reviews authenticated update" on public.site_reviews;
create policy "Reviews authenticated update"
  on public.site_reviews for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Reviews public read approved" on public.site_reviews;
create policy "Reviews public read approved"
  on public.site_reviews for select
  to anon
  using (coalesce(is_approved, false) = true);

-- ─── Storage: вложения к заявкам (orders-files) ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'orders-files',
  'orders-files',
  true,
  15728640,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "orders_files_anon_insert" on storage.objects;
create policy "orders_files_anon_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'orders-files');

drop policy if exists "orders_files_public_select" on storage.objects;
create policy "orders_files_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'orders-files');

drop policy if exists "orders_files_authenticated_update" on storage.objects;
create policy "orders_files_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'orders-files')
  with check (bucket_id = 'orders-files');

-- ─── order_files: вложения к заявкам (таблица в схеме БД) ───────────────────
alter table public.order_files enable row level security;

drop policy if exists "order_files anon insert" on public.order_files;
create policy "order_files anon insert"
  on public.order_files for insert
  to anon
  with check (true);

drop policy if exists "order_files authenticated insert" on public.order_files;
create policy "order_files authenticated insert"
  on public.order_files for insert
  to authenticated
  with check (true);

drop policy if exists "order_files public read" on public.order_files;
create policy "order_files public read"
  on public.order_files for select
  to anon, authenticated
  using (true);
