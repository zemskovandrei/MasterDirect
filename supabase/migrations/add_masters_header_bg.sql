-- Цвет шапки профиля мастера (настраивается владельцем профиля)
alter table public.masters
  add column if not exists header_bg text;
