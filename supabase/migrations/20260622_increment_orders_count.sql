-- Add a persistent completed-orders counter for specialists and expose an RPC to increment it.
-- Run in Supabase SQL Editor or via migration deploy.

alter table public.specialist
  add column if not exists orders_count integer not null default 0;

update public.specialist s
set orders_count = coalesce(c.completed_count, 0)
from (
  select user_id, count(*)::integer as completed_count
  from public."order"
  where user_id is not null
    and status = 'completed'
  group by user_id
) as c
where c.user_id = s.id;

create or replace function public.increment_orders_count(row_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if row_id is null then
    raise exception 'row_id is required';
  end if;

  update public.specialist
  set orders_count = coalesce(orders_count, 0) + 1
  where id = row_id
  returning orders_count into new_count;

  if new_count is null then
    raise exception 'Specialist not found: %', row_id;
  end if;

  return new_count;
end;
$$;

revoke all on function public.increment_orders_count(uuid) from public;
grant execute on function public.increment_orders_count(uuid) to authenticated;
