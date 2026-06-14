-- Masters table + auth trigger for SmartBuild.Tech
-- Run in Supabase SQL editor after enabling Email auth.

create table if not exists public.masters (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  city text,
  specialty text,
  description text,
  account_type text check (account_type in ('worker', 'brigade')),
  call_out_fee text,
  whatsapp text,
  telegram text,
  instagram text,
  facebook text,
  whatsapp_phone text,
  tg_username text,
  created_at timestamptz not null default now()
);

alter table public.masters enable row level security;

drop policy if exists "Public read masters" on public.masters;
create policy "Public read masters"
  on public.masters for select
  using (true);

drop policy if exists "Master insert own row" on public.masters;
create policy "Master insert own row"
  on public.masters for insert
  with check (auth.uid() = id);

drop policy if exists "Master update own row" on public.masters;
create policy "Master update own row"
  on public.masters for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'admin@smartbuild.tech'
    );
$$;

drop policy if exists "Admin update masters" on public.masters;
create policy "Admin update masters"
  on public.masters for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "Admin delete masters" on public.masters;
create policy "Admin delete masters"
  on public.masters for delete
  using (public.is_app_admin());

create or replace function public.handle_new_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.masters (
    id,
    full_name,
    phone,
    city,
    specialty,
    description,
    account_type,
    call_out_fee,
    whatsapp,
    telegram,
    instagram,
    facebook
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'specialty', ''),
    nullif(new.raw_user_meta_data ->> 'description', ''),
    nullif(new.raw_user_meta_data ->> 'account_type', ''),
    nullif(new.raw_user_meta_data ->> 'call_out_fee', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
    nullif(new.raw_user_meta_data ->> 'telegram', ''),
    nullif(new.raw_user_meta_data ->> 'instagram', ''),
    nullif(new.raw_user_meta_data ->> 'facebook', '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    city = excluded.city,
    specialty = excluded.specialty,
    description = excluded.description,
    account_type = excluded.account_type,
    call_out_fee = excluded.call_out_fee,
    whatsapp = excluded.whatsapp,
    telegram = excluded.telegram,
    instagram = excluded.instagram,
    facebook = excluded.facebook;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_master on auth.users;
create trigger on_auth_user_created_master
  after insert on auth.users
  for each row execute function public.handle_new_master();
