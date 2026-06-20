-- Удаление своего аккаунта (профиль + auth). Выполните в Supabase SQL Editor.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.site_reviews where master_id = uid;
  delete from public.specialist where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;
