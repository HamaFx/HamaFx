# Hama Fx API V2 (Vercel Functions)

Base path: `/api/v2`

## Health
- `GET /health`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Portfolio/Trading
- `GET /portfolio`
- `PUT /portfolio`
- `POST /orders`
- `GET /orders`
- `DELETE /orders/:id`
- `POST /positions/:id/close`
- `GET /trades`

## User Data
- `GET /settings`
- `PUT /settings`
- `GET /watchlists`
- `POST /watchlists`
- `PUT /watchlists`
- `PATCH /watchlists/:id`
- `DELETE /watchlists/:id`
- `GET /alerts`
- `POST /alerts`
- `PUT /alerts`
- `PATCH /alerts/:id`
- `DELETE /alerts/:id`
- `GET /chat`
- `POST /chat`
- `PUT /chat`
- `DELETE /chat`
- `GET /audit`

## Full State Sync
- `GET /state`
- `PUT /state`

## Migration
- `POST /migrate/import`

## Market/News Proxy
- `GET /market/crypto`
- `GET /market/forex`
- `GET /news`

## Cron
- `GET /cron/maintenance` (requires `CRON_SECRET`)
