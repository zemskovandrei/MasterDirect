-- Опционально: модерация отзывов (если нужна колонка is_approved в site_reviews).
-- Без этой миграции приложение показывает все отзывы как опубликованные.

alter table public.site_reviews
  add column if not exists is_approved boolean not null default true;

create index if not exists site_reviews_is_approved_idx
  on public.site_reviews (is_approved, created_at desc);
