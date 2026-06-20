-- Диагностика проблем регистрации: триггер auth.users → specialist
-- Supabase → SQL Editor → Run

-- 1) Триггеры на auth.users
select
  t.tgname as trigger_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal;

-- 2) Тело функции handle_new_auth_user (если есть)
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'handle_new_auth_user';

-- 3) Пользователь по email
select id, email, email_confirmed_at, created_at, raw_user_meta_data
from auth.users
where lower(trim(email)) = lower(trim('zemskovandrei205@gmail.com'));

-- 4) Сироты specialist: строка без пользователя в auth.users
select s.*
from public.specialist s
left join auth.users u on u.id = s.id
where u.id is null;

-- 5) Сироты auth.users: пользователь без specialist (триггер мог упасть)
select u.id, u.email, u.created_at
from auth.users u
left join public.specialist s on s.id = u.id
where lower(trim(u.email)) = lower(trim('zemskovandrei205@gmail.com'))
  and s.id is null;

-- 6) Дубликаты slug у мебельщиков (частая причина 500 при INSERT)
select slug, count(*) as cnt, array_agg(id) as specialist_ids
from public.specialist
where slug is not null and trim(slug) <> ''
group by slug
having count(*) > 1;

-- 7) Колонки site_reviews (проверка is_approved)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'site_reviews'
order by ordinal_position;
