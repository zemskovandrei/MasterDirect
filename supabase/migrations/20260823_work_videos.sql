-- Optional work videos on specialist public pages.

create table if not exists public.work_videos (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null,
  title text,
  video_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists work_videos_specialist_id_idx
  on public.work_videos (specialist_id);

alter table public.work_videos enable row level security;

drop policy if exists "work_videos public read" on public.work_videos;
create policy "work_videos public read"
  on public.work_videos for select
  to anon, authenticated
  using (true);

drop policy if exists "work_videos authenticated insert" on public.work_videos;
create policy "work_videos authenticated insert"
  on public.work_videos for insert
  to authenticated
  with check (auth.uid() = specialist_id);

drop policy if exists "work_videos authenticated delete own" on public.work_videos;
create policy "work_videos authenticated delete own"
  on public.work_videos for delete
  to authenticated
  using (auth.uid() = specialist_id);

grant select on table public.work_videos to anon, authenticated;
grant insert, delete on table public.work_videos to authenticated;
notify pgrst, 'reload schema';

update storage.buckets
set file_size_limit = greatest(coalesce(file_size_limit, 0), 83886080)
where id = 'portfolio';

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct x)
  from unnest(
    allowed_mime_types || array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
  ) as x
)
where id = 'portfolio'
  and allowed_mime_types is not null;
