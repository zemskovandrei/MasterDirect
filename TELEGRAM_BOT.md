# Telegram-бот MasterDirect

Бот: https://t.me/master_direct_bot  

После `/start` меню:

1. **📋 Разместить заказ** (`/job`) → заявка в `/jobs`
2. **⭐ Оставить отзыв** (`/review`) → модерация, потом сайт
3. **👀 Смотреть мастеров** / **📌 Смотреть заказы** → сайт
4. **👷 Я мастер — в каталог** (`/master`) → карточка в `/masters`

Выход с любого шага: **« В меню** или `/menu` / `/cancel`.

## Заказ (клиент)

1. Имя  
2. Телефон  
3. Город  
4. Вид работ  
5. Описание (≥ 10 символов)  
6. Бюджет (можно пропустить)  
7. Фото объекта (необязательно, до 3)  
8. Опубликовать → таблица `order` (`status: active`)

## Мастер

Имя → телефон → специальности → город → район → 1–5 фото → `specialist` + portfolio.

## Отзыв

Имя → тип → текст (≥ 20) → `site_reviews` (`is_approved: false`).

## Режим работы (важно: один инстанс)

Telegram допускает **либо webhook, либо polling** — и только **один** получатель.

| Где | Режим |
|-----|--------|
| **Railway (прод)** | Webhook автоматически, если есть `RAILWAY_PUBLIC_DOMAIN` (или задайте `TELEGRAM_WEBHOOK_URL`) |
| **Локально** | Polling (без `TELEGRAM_WEBHOOK_URL`). При старте webhook сбрасывается |

Не запускайте локальный бот и Railway одновременно с одним токеном.

Проверка: `GET /api/health` → `"build":"bot-stable-v5"`, `"telegramMode":"webhook"|"polling"`.

## Variables (Railway / `.env`)

```env
TELEGRAM_BOT_TOKEN=...
SITE_ORIGIN=https://masterdirect.ge
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
# Опционально (иначе на Railway возьмётся из RAILWAY_PUBLIC_DOMAIN):
# TELEGRAM_WEBHOOK_URL=https://YOUR-SERVICE.up.railway.app/api/telegram/webhook
# TELEGRAM_WEBHOOK_SECRET=случайная-строка
```

В Railway: **Settings → Networking → Generate Domain**, иначе webhook не соберётся сам.

## Команды

`/start` `/menu` · `/job` · `/review` · `/master` · `/cancel`
