# Deployment Guide

## Local Validation

```bash
npm ci
npm run build
npm run build:api
```

## Frontend (GitHub Pages)

This repository already has workflow:
- `.github/workflows/deploy-pages.yml`

Push to `main` triggers deployment.

## API (Node + Express)

Build and run:

```bash
npm run build:api
npm run start:api
```

Required env vars are in `.env.example`.

## Required Environment Variables

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `ADMIN_EMAILS`
- `API_RATE_LIMIT_WINDOW_MS`
- `API_RATE_LIMIT_MAX`

## Production Smoke Test

1. Open home page and catalog.
2. Submit a test review.
3. Create a test job.
4. Verify cabinet login and profile access.
5. Verify legal pages:
   - `/privacy`
   - `/terms`
