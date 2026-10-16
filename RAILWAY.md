# Railway: API + Telegram-бот

Сайт на GitHub Pages. Бот и API — на Railway.

## 1. Залить код на GitHub

Коммит с ботом должен быть в `main` на GitHub.

## 2. Создать проект на Railway

1. Откройте https://railway.app → войти через GitHub.  
2. **New Project** → **Deploy from GitHub repo** → выберите `zemskovandrei/MasterDirect`.  
3. Railway подхватит `Dockerfile` + `railway.toml`.

## 3. Переменные окружения

В сервисе: **Variables** → добавить:

| Key | Value |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | токен от BotFather |
| `SITE_ORIGIN` | `https://masterdirect.ge` |
| `SUPABASE_URL` | из вашего `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | из вашего `.env` |
| `ALLOWED_ORIGINS` | `https://masterdirect.ge,https://www.masterdirect.ge` |
| `ADMIN_EMAILS` | ваш admin email |
| `PORT` | `3000` (Railway часто ставит сам) |

**Не** копируйте `.env` в git. Только через Variables в Railway.

## 4. Дождаться деплоя

В **Deployments** статус должен стать Success.  
В логах ищите:

```text
[masterdirect API] Server listening
[catalog-bot] Telegram bot started
```

## 5. Проверка

1. Откройте URL сервиса Railway + `/api/health` → `{"ok":true,...}`  
2. Напишите боту: https://t.me/master_direct_bot → `/start`

## Если билд падает

- В Settings → Build убедитесь, что Dockerfile = `Dockerfile`.  
- Node 22 уже в образе.  
- Логи Build / Deploy смотрите во вкладке Deployments.
