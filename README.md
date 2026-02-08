# Hama Fx

AI-driven forex and crypto paper-trading platform built with React + Vite (frontend) and Vercel Functions + Neon + Upstash (V2 backend).

## Start Here

- Canonical docs index: `docs/README.md`
- AI/system overview: `docs/AI_PROJECT_GUIDE.md`
- API + env reference: `docs/API_RUNTIME_REFERENCE.md`
- Customization guide: `docs/AI_CUSTOMIZATION_GUIDE.md`

## Quick Commands

```bash
npm install
npm run dev
npm run check
npm run e2e:smoke
```

## Runtime Modes

Set `VITE_BACKEND_MODE`:

- `off`: local-first V1 behavior
- `shadow`: local UX + background backend sync
- `on`: backend-auth + backend state is source of truth

## Stack

- Frontend: React 19, TypeScript, Vite 7, Tailwind 4, Zustand, Recharts, Lightweight Charts
- Backend: Vercel Functions (`/api/v2/*`), Drizzle ORM, Neon Postgres, Upstash Redis, Zod validation
- AI providers (backend orchestrated): Groq, Gemini, Scitely (`AI_PROVIDER=auto|groq|gemini|scitely`)

## Notes

- Historical planning docs are in `docs/archive/`.
- For current truth, use `docs/README.md` and source code.
