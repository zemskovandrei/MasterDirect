-- Allow specialists to append photos to their finished-work albums.

alter table if exists public.works_portfolio enable row level security;

drop policy if exists "Specialists can update own works" on public.works_portfolio;
create policy "Specialists can update own works" on public.works_portfolio
  for update to authenticated
  using (auth.uid() = specialist_id)
  with check (auth.uid() = specialist_id);

grant update on table public.works_portfolio to authenticated;

notify pgrst, 'reload schema';
