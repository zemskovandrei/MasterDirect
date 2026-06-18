-- Регистрация исполнителей: specialist / brigades / furniture_orders
-- Запустите в Supabase SQL Editor для проекта FlooringLeader.

-- ─── RLS: вставка и обновление своей строки ───

drop policy if exists "Specialist insert own row" on public.specialist;
create policy "Specialist insert own row"
  on public.specialist for insert
  with check (auth.uid() = id);

drop policy if exists "Specialist update own row" on public.specialist;
create policy "Specialist update own row"
  on public.specialist for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Brigade insert own row" on public.brigades;
create policy "Brigade insert own row"
  on public.brigades for insert
  with check (auth.uid() = id);

drop policy if exists "Brigade update own row" on public.brigades;
create policy "Brigade update own row"
  on public.brigades for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Furniture owner insert" on public.furniture_orders;
create policy "Furniture owner insert"
  on public.furniture_orders for insert
  with check (auth.uid() = id or id is not null);

drop policy if exists "Furniture owner update" on public.furniture_orders;
create policy "Furniture owner update"
  on public.furniture_orders for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── Триггер: профиль в нужную таблицу при signUp ───

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  account_type text := coalesce(meta ->> 'account_type', '');
  pro_role text := coalesce(meta ->> 'pro_role', '');
  full_name text := coalesce(meta ->> 'full_name', '');
  slug text := lower(regexp_replace(trim(full_name), '[^a-zA-Z0-9]+', '-', 'g'));
begin
  if account_type = 'furniture' or pro_role = 'furniture_maker' then
    insert into public.furniture_orders (
      id, slug, full_name, client_name, phone, client_phone,
      city, specialty, description, furniture_type, work_type,
      whatsapp, telegram, instagram, facebook
    )
    values (
      new.id,
      nullif(slug, ''),
      full_name,
      full_name,
      nullif(meta ->> 'phone', ''),
      nullif(meta ->> 'phone', ''),
      nullif(meta ->> 'city', ''),
      nullif(meta ->> 'specialty', ''),
      nullif(meta ->> 'description', ''),
      nullif(meta ->> 'specialty', ''),
      'profile',
      nullif(meta ->> 'whatsapp', ''),
      nullif(meta ->> 'telegram', ''),
      nullif(meta ->> 'instagram', ''),
      nullif(meta ->> 'facebook', '')
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      client_name = excluded.client_name,
      phone = excluded.phone,
      client_phone = excluded.client_phone,
      city = excluded.city,
      specialty = excluded.specialty,
      description = excluded.description,
      whatsapp = excluded.whatsapp,
      telegram = excluded.telegram,
      instagram = excluded.instagram,
      facebook = excluded.facebook;

  elsif account_type = 'brigade' or pro_role in ('builder', 'brigade', 'company') then
    insert into public.brigades (
      id, full_name, phone, city, specialty, description,
      whatsapp, telegram, instagram, facebook
    )
    values (
      new.id,
      full_name,
      nullif(meta ->> 'phone', ''),
      nullif(meta ->> 'city', ''),
      nullif(meta ->> 'specialty', ''),
      nullif(meta ->> 'description', ''),
      nullif(meta ->> 'whatsapp', ''),
      nullif(meta ->> 'telegram', ''),
      nullif(meta ->> 'instagram', ''),
      nullif(meta ->> 'facebook', '')
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      city = excluded.city,
      specialty = excluded.specialty,
      description = excluded.description,
      whatsapp = excluded.whatsapp,
      telegram = excluded.telegram,
      instagram = excluded.instagram,
      facebook = excluded.facebook;

  else
    insert into public.specialist (
      id, full_name, phone, city, specialty, description, account_type,
      whatsapp, telegram, instagram, facebook, is_archive
    )
    values (
      new.id,
      full_name,
      nullif(meta ->> 'phone', ''),
      nullif(meta ->> 'city', ''),
      nullif(meta ->> 'specialty', ''),
      nullif(meta ->> 'description', ''),
      coalesce(nullif(account_type, ''), 'worker'),
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
      whatsapp = excluded.whatsapp,
      telegram = excluded.telegram,
      instagram = excluded.instagram,
      facebook = excluded.facebook;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
