# Telegram-бот MasterDirect

Один бот, три сценария. Регистрация на сайте не нужна.

После `/start` меню:

1. **👷 Я мастер — в каталог** — анкета в `/masters`
2. **📋 Разместить заказ** — заявка в `/jobs`
3. **⭐ Оставить отзыв** — в `site_reviews` на модерацию

Команды: `/start` `/menu` · `/master` · `/job` · `/review` · `/cancel`

## Мастер → каталог

1. Имя  
2. Телефон  
3. Специальности (несколько)  
4. Город + район  
5. 1–5 фото работ  

Пишет в `specialist` + фото в bucket `portfolio` / `portfolio_works`.

## Клиент → заказ

1. Имя  
2. Телефон  
3. Город  
4. Категория работ  
5. Описание  
6. Бюджет (можно пропустить)  
7. Фото объекта (необязательно, до 3)  

Пишет в таблицу `order` (`status: active`) + опционально `orders-files` / `order_files`.

## Отзыв

1. Имя  
2. Тип: отзыв о работе / идея по сайту  
3. Текст (от 20 символов)  

Пишет в `site_reviews` с `is_approved: false` — на сайте появится после модерации админом.

## Настройка

1. [@BotFather](https://t.me/BotFather) → токен  
2. Variables на Railway (или `.env`):

```env
TELEGRAM_BOT_TOKEN=...
SITE_ORIGIN=https://masterdirect.ge
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # legacy service_role
```

`SUPABASE_URL` — **только** origin, без `/rest/v1`.

3. После деплоя `/api/health` → `"build":"menu-job-review-v1"`.

## Важно

- Публикуем только то, что человек прислал сам.  
- Чужие объявления с барахолок / чатов — нельзя.  
- Токен бота не светить в чатах и не коммитить в git.
