-- Политики и триггер для регистрации в specialist.
-- Выполните в Supabase SQL Editor, если регистрация падает с ошибкой RLS.

alter table public.specialist
  add column if not exists slug text,
  add column if not exists account_type text,
  add column if not exists is_archive boolean default false;

drop policy if exists "Specialist public read" on public.specialist;
create policy "Specialist public read"
  on public.specialist for select
  using (coalesce(is_archive, false) = false);

drop policy if exists "Specialist insert own row" on public.specialist;
create policy "Specialist insert own row"
  on public.specialist for insert
  with check (auth.uid() = id);

drop policy if exists "Specialist update own row" on public.specialist;
create policy "Specialist update own row"
  on public.specialist for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  account_type text := coalesce(nullif(meta ->> 'account_type', ''), 'worker');
  pro_role text := coalesce(meta ->> 'pro_role', '');
  full_name text := coalesce(meta ->> 'full_name', '');
  slug text := lower(regexp_replace(trim(full_name), '[^a-zA-Z0-9]+', '-', 'g'));
begin
  if account_type = 'furniture' or pro_role = 'furniture_maker' then
    account_type := 'furniture';
  elsif account_type = 'brigade' or pro_role in ('builder', 'brigade', 'company') then
    account_type := 'brigade';
  else
    account_type := 'worker';
  end if;

  insert into public.specialist (
    id, full_name, phone, city, specialty, description, account_type, slug,
    whatsapp, telegram, instagram, facebook, is_archive
  )
  values (
    new.id,
    full_name,
    nullif(meta ->> 'phone', ''),
    nullif(meta ->> 'city', ''),
    nullif(meta ->> 'specialty', ''),
    nullif(meta ->> 'description', ''),
    account_type,
    case when account_type = 'furniture' then nullif(slug, '') else null end,
    nullif(meta ->> 'whatsapp', ''),
    nullif(meta ->> 'telegram', ''),
    nullif(meta ->> 'instagram', ''),
    nullif(meta ->> 'facebook', ''),
    false
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    city = excluded.city,
    specialty = excluded.specialty,
    description = excluded.description,
    account_type = excluded.account_type,
    slug = coalesce(excluded.slug, public.specialist.slug),
    whatsapp = excluded.whatsapp,
    telegram = excluded.telegram,
    instagram = excluded.instagram,
    facebook = excluded.facebook;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
