-- Allow specialists to delete their own portfolio works from the cabinet.

alter table if exists public.portfolio_works enable row level security;

drop policy if exists "portfolio_works authenticated delete own" on public.portfolio_works;
create policy "portfolio_works authenticated delete own"
  on public.portfolio_works for delete
  to authenticated
  using (auth.uid() = specialist_id);

grant delete on table public.portfolio_works to authenticated;
notify pgrst, 'reload schema';

-- Optional: run this in Supabase → SQL Editor if hard-delete still fails.
-- Soft-delete via status='rejected' already works with the update policy.
