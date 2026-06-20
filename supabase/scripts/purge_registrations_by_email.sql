-- Удалить все регистрации по email (auth + specialist + отзывы).
-- Supabase → SQL Editor → Run

do $$
declare
  target_email text := 'zemskovandrei205@gmail.com';
  uid uuid;
begin
  for uid in
    select id from auth.users where lower(trim(email)) = lower(trim(target_email))
  loop
    delete from public.site_reviews where master_id = uid;
    delete from public.specialist where id = uid;
    delete from auth.users where id = uid;
    raise notice 'Deleted user %', uid;
  end loop;
end $$;
