-- Storage bucket для вложений к заявкам из калькулятора (JPG, PNG, PDF).
-- Supabase Dashboard → SQL Editor → Run

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
