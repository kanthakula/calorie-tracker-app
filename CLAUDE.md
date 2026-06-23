# K21 Calorie Tracker

## Purpose
Production-grade calorie tracker. Users log food manually, from a predefined
library, or by snapping a photo that an LLM analyzes into calories + macros.
Designed to grow into barcode lookup, nutrition databases, and cloud image
storage.

## Architecture (TypeScript monorepo — pnpm + Turborepo)
```
k21-calorie-tracker/
├── api/                  # ALL backend / API code lives here
│   ├── node-api/         # Node.js + Express + TS — main backend & gateway
│   └── ai-service/       # Python + FastAPI — AI/image/nutrition processing
├── apps/
│   ├── web/              # Next.js (App Router) web app
│   └── mobile/           # Expo React Native app
├── packages/
│   ├── validation/       # @k21/validation — shared Zod schemas + types (the contract)
│   ├── db/               # @k21/db — Prisma schema, client, seed
│   └── config/           # @k21/config — shared tsconfig/eslint presets
├── docker-compose.yml    # Postgres (+ optional pgAdmin) for local dev
├── turbo.json, pnpm-workspace.yaml, tsconfig.base.json
└── legacy/               # original single-file Express app (reference only)
```

### How the pieces fit
- **`@k21/validation`** is the single source of truth: Zod schemas + inferred
  types imported by web, mobile, and the Node API. Request/response shapes are
  validated end to end and cannot drift.
- **`@k21/db`** (Prisma + Postgres) is the durable store (replaces localStorage):
  `User`, `Meal`, `DailyGoal`, `FoodItem`. `Meal.date` is ISO `YYYY-MM-DD`.
- **Node API** owns app data + auth (JWT) + the owner admin console. It is the
  only public gateway. It does **not** hold provider keys.
- **AI service (FastAPI)** owns all AI/vision and future nutrition-data work and
  holds the LLM provider keys. The Node API proxies `/api/analyze-food` and the
  admin AI-config endpoints to it.

## Tech Stack
- **Monorepo:** pnpm workspaces + Turborepo. Node ≥ 20 (use Corepack for pnpm).
- **Web:** Next.js 15 App Router, React 18.3, vanilla CSS (CSS Modules) — no CSS frameworks, no chart library.
- **Mobile:** Expo SDK 52 + Expo Router, React Native 0.76, React 18.3.
- **Node API:** Express + TypeScript, helmet/cors/morgan, JWT auth (bcrypt), Zod validation, rate-limited analyze route.
- **AI service:** FastAPI + Pydantic. Pluggable provider in `LLM_PROVIDER` = `gemini` | `openai` | `anthropic` | `kimi`. SDKs: `google-generativeai`, `openai` (also Kimi/Moonshot via custom `base_url`), `anthropic`. Returns the same structured nutrition JSON regardless of provider.
- **DB/ORM:** PostgreSQL + Prisma. **Validation:** Zod (shared). **Containers:** Docker Compose for Postgres.

### Config precedence (AI providers — read per request, no restart needed)
owner's AI-service runtime config (`runtime-config.json`, gitignored) → environment
variables (`LLM_PROVIDER`, `GEMINI_*`, `OPENAI_*`, `ANTHROPIC_*`, `KIMI_*`) →
built-in defaults. Default models: gemini `gemini-2.5-flash`, openai `gpt-4o-mini`,
anthropic `claude-opus-4-8`, kimi `moonshot-v1-8k-vision-preview`.

### Admin console (owner only)
Owner-only AI settings in the web app at `/admin`, gated by `ADMIN_PASSWORD`.
Node `POST /api/admin/login` mints a short-lived in-memory token; `GET/POST
/api/admin/config` (masked keys) and `POST /api/admin/test` require it and are
proxied to the AI service. Regular users never see config UI.

## Key Commands
- `corepack enable` then `pnpm install` — install the workspace
- `pnpm docker:up` — start Postgres; `pnpm db:migrate` + `pnpm db:seed` — schema + food library
- `pnpm dev` — run Node API + web (+ packages in watch) via Turborepo
- AI service: `cd api/ai-service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
- `pnpm --filter @k21/mobile start` — Expo; `pnpm build` / `pnpm typecheck` / `pnpm test` — workspace-wide

## Coding Conventions
- **TypeScript everywhere** (strict). ES modules (`import`/`export`), `async/await`, no raw `.then()` chains.
- **No external CSS frameworks** (no Bootstrap/Tailwind) and **no chart library** — plain CSS + hand-rolled charts.
- Shared types/validation come from `@k21/validation`; DB access via `@k21/db`.
- Load secrets from environment variables; never hardcode keys.

## Important Rules
- **NEVER read, edit, or display the contents of any `.env`** in chat output,
  logs, or commits. Treat it as write-only configuration containing secrets.
  When a command needs `DATABASE_URL`/keys, rely on the process environment — do
  not open `.env`.
- **API keys never reach the browser**, are never logged, and are never written
  to `.env` by the app. Provider keys live only in the AI service (env or its
  gitignored `runtime-config.json`); config responses are masked (`hasKey`/`keySource`).
- `.env`, `runtime-config.json`, and `certs/` must stay gitignored.
- The contract in `@k21/validation` is authoritative — change it there first,
  rebuild, then update consumers.
```
Meal records: { id, name, calories, type, date (YYYY-MM-DD), protein, carbs, fat, health, source }.
The food library provides macros; AI/manual meals default macros to 0. AI scans
return protein/carbs/fat + a 1–5 healthiness rating. The daily summary shows
P/C/F totals and a tailored "insight" suggestion for the selected date.
```
