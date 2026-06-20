-- Исправление 500 на auth/v1/signup: триггер handle_new_auth_user → specialist.
-- Supabase → SQL Editor → Run (после 20260622_specialist_registration_fix.sql).

alter table public.specialist
  add column if not exists slug text,
  add column if not exists account_type text,
  add column if not exists is_archive boolean default false,
  add column if not exists whatsapp text,
  add column if not exists telegram text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists whatsapp_phone text,
  add column if not exists tg_username text,
  add column if not exists header_bg text;

-- full_name не должен быть пустым (частая причина NOT NULL violation).
update public.specialist
set full_name = coalesce(nullif(trim(full_name), ''), 'Профиль')
where full_name is null or trim(full_name) = '';

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
  full_name text := coalesce(
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Профиль'
  );
  base_slug text := lower(regexp_replace(trim(full_name), '[^a-zA-Z0-9]+', '-', 'g'));
  slug_value text;
  wa text := nullif(meta ->> 'whatsapp', '');
  tg text := nullif(meta ->> 'telegram', '');
begin
  if account_type = 'furniture' or pro_role = 'furniture_maker' then
    account_type := 'furniture';
  elsif account_type = 'brigade' or pro_role in ('builder', 'brigade', 'company') then
    account_type := 'brigade';
  else
    account_type := 'worker';
  end if;

  if account_type = 'furniture' then
    slug_value := coalesce(nullif(base_slug, ''), 'furniture')
      || '-'
      || substr(replace(new.id::text, '-', ''), 1, 8);
  else
    slug_value := null;
  end if;

  insert into public.specialist (
    id,
    full_name,
    phone,
    city,
    specialty,
    description,
    account_type,
    slug,
    whatsapp,
    telegram,
    instagram,
    facebook,
    whatsapp_phone,
    tg_username,
    is_archive
  )
  values (
    new.id,
    full_name,
    nullif(meta ->> 'phone', ''),
    nullif(meta ->> 'city', ''),
    nullif(meta ->> 'specialty', ''),
    nullif(meta ->> 'description', ''),
    account_type,
    slug_value,
    wa,
    tg,
    nullif(meta ->> 'instagram', ''),
    nullif(meta ->> 'facebook', ''),
    wa,
    tg,
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
    facebook = excluded.facebook,
    whatsapp_phone = excluded.whatsapp_phone,
    tg_username = excluded.tg_username;

  return new;
exception
  when others then
    raise exception 'handle_new_auth_user failed for %: %', new.email, sqlerrm;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
