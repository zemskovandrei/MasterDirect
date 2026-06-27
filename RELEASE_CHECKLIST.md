# Release Checklist

## 1) Infra and Secrets
- [ ] Set production domain and HTTPS.
- [ ] Fill `.env` for API from `.env.example`.
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` only on server, never in frontend.

## 2) Database and Access
- [ ] Enable and verify RLS policies in Supabase.
- [ ] Verify admin accounts (`ADMIN_EMAILS`) are correct.
- [ ] Confirm backups/snapshots are enabled.

## 3) Build and Smoke Test
- [ ] Run `npm ci`.
- [ ] Run `npm run build`.
- [ ] Run `npm run build:api`.
- [ ] Run quick smoke test for login, jobs, reviews, cabinet, moderation.

## 4) Deploy
- [ ] Deploy frontend (GitHub Pages/Vercel/Netlify).
- [ ] Deploy API server with env vars.
- [ ] Verify CORS origins in `ALLOWED_ORIGINS`.

## 5) Monitoring and Ops
- [ ] Enable error logging for frontend and API.
- [ ] Set alerts for API 5xx and high 429 rate.
- [ ] Prepare rollback procedure to previous release.

## 6) Legal
- [ ] Review `privacy` page text with legal requirements.
- [ ] Review `terms` page text with legal requirements.
