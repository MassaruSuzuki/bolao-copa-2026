# Bolão da Copa

A Brazilian football prediction pool web app where friends register, submit match score predictions, view each other's picks, and compete on a live ranking board.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bolao run dev` — run the frontend (auto-assigned port)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Auth: JWT in localStorage (`bolao_token`), 30-day lifetime
- Build: esbuild (CJS bundle for API server)

## Where things live

- `lib/db/src/schema/` — DB tables: `users`, `matches`, `predictions`
- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/api-client-react/src/generated/` — React Query hooks (auto-generated)
- `lib/api-zod/src/generated/` — Zod schemas (auto-generated)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware
- `artifacts/bolao/src/pages/` — frontend pages
- `artifacts/bolao/src/contexts/AuthContext.tsx` — auth state (token + user)
- `artifacts/bolao/src/index.css` — dark sports theme (green primary)

## Architecture decisions

- Contract-first: OpenAPI spec drives both server validation (Zod) and client hooks (React Query) — never write API types by hand.
- JWT stored in localStorage, injected via `setAuthTokenGetter` from `@workspace/api-client-react`.
- Prediction deadline: 60 minutes before match kick-off; `status !== "upcoming"` also locks picks.
- Scoring: 5 pts for exact score, 3 pts for correct result/winner, 0 pts otherwise. Computed server-side on ranking queries.
- Admin check is server-enforced on all admin routes; frontend additionally redirects non-admins away from `/admin`.

## Product

- **Auth**: register + login; JWT sessions; admin role
- **Matches**: list all matches with status filters (upcoming/live/finished); match detail page with score display
- **Predictions**: submit/update score predictions up to 1h before kick-off; see all participants' picks per match
- **Ranking**: leaderboard sorted by total points; highlights user's own row; scoring guide shown
- **Admin panel**: create matches, edit scores/status/dates via dialogs

## Seed data (dev)

- `admin@bolao.com` / `123456` — admin account
- `joao@bolao.com`, `maria@bolao.com`, `pedro@bolao.com` / `123456` — regular users
- 6 matches: 2 finished (with scores), 4 upcoming
- Predictions already seeded for finished matches so ranking is populated

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` before editing frontend code.
- `pnpm --filter @workspace/db run push` only for dev; for prod, use proper migrations.
- Do not run `pnpm run dev` at the workspace root — use the individual workflow filters or restart_workflow.
- Proxy routes all traffic through port 80; never curl service ports directly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
