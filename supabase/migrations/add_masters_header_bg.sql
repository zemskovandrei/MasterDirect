-- Цвет шапки профиля (настраивается владельцем профиля)
alter table public.specialist
  add column if not exists header_bg text;
