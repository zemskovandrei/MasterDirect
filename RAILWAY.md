# Railway: API + Telegram-бот

Сайт на GitHub Pages. Бот и API — на Railway.

## 1. Залить код на GitHub

Коммит с ботом должен быть в `main` на GitHub.

## 2. Создать / обновить проект на Railway

1. https://railway.app → GitHub → репо `zemskovandrei/MasterDirect`.  
2. Railway подхватит `Dockerfile` + `railway.toml`.  
3. **Settings → Networking → Generate Domain** (публичный HTTPS обязателен для webhook).

## 3. Переменные окружения

| Key | Value |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | токен от BotFather |
| `SITE_ORIGIN` | `https://masterdirect.ge` |
| `SUPABASE_URL` | только `https://ВАШ_PROJECT.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | legacy **`service_role`** (`eyJ…`) |
| `ALLOWED_ORIGINS` | `https://masterdirect.ge,https://www.masterdirect.ge` |
| `ADMIN_EMAILS` | ваш admin email |
| `PORT` | `3000` (часто ставит сам) |
| `TELEGRAM_WEBHOOK_SECRET` | любая длинная случайная строка (рекомендуется) |

Webhook URL **не обязателен**: при наличии `RAILWAY_PUBLIC_DOMAIN` бот сам поставит  
`https://<домен>/api/telegram/webhook`.

Или задайте явно:

`TELEGRAM_WEBHOOK_URL=https://ВАШ-ДОМЕН.up.railway.app/api/telegram/webhook`

## 4. Деплой

В логах должно быть:

```text
[masterdirect API] Server listening
[masterdirect API] telegramMode=webhook url=https://...
[catalog-bot] Telegram bot started
[catalog-bot] webhook set: https://...
```

## 5. Проверка

1. `https://ВАШ-URL.up.railway.app/api/health`  
   → `"ok":true`, `"build":"bot-stable-v5"`, `"telegramMode":"webhook"`  
2. https://t.me/master_direct_bot → `/start` → меню с **Разместить заказ**

## Если бот снова «только анкета мастера»

Значит отвечает **старый** инстанс. Сделайте **Redeploy** последнего деплоя и убедитесь, что локально `npm run start:api` / туннель **не** запущены с тем же токеном.
