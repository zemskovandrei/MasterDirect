-- Аварийный вариант: отключить триггер, чтобы signup не падал с 500.
-- Профиль создаётся из приложения при первом входе (syncAuthProfileFromUser).
-- Supabase → SQL Editor → Run

drop trigger if exists on_auth_user_created_profile on auth.users;

-- Вернуть триггер после исправления схемы:
-- выполните supabase/migrations/20260625_signup_trigger_hardening.sql
