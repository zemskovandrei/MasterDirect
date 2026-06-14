-- Brigades table for SmartBuild.Tech
-- Direct messenger columns for calculator deep links.

create table if not exists public.brigades (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  city text,
  specialty text,
  description text,
  call_out_fee text,
  whatsapp_phone text,
  tg_username text,
  whatsapp text,
  telegram text,
  instagram text,
  facebook text,
  created_at timestamptz not null default now()
);

alter table public.brigades enable row level security;

drop policy if exists "Public read brigades" on public.brigades;
create policy "Public read brigades"
  on public.brigades for select
  using (true);
