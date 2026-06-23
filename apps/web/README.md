# @k21/web — K21 Calorie Tracker (Web)

The Next.js (App Router) web client for the K21 Calorie Tracker. It's a full port of
the original single-page tracker: log meals manually, pick from a food library, snap a
photo for AI-estimated nutrition, see a daily summary + insight, and review history.

Built with **Next.js 15 + React 19 + TypeScript (strict)**. Plain CSS only (CSS Modules
+ a small global stylesheet) — no CSS framework, no chart library.

## Running

This app lives in the pnpm + Turborepo monorepo. From the repo root:

```bash
pnpm install
pnpm --filter @k21/web dev      # http://localhost:3000
```

Other scripts:

```bash
pnpm --filter @k21/web build
pnpm --filter @k21/web start
pnpm --filter @k21/web lint
pnpm --filter @k21/web typecheck
```

It expects the **Node API** to be running (default `http://localhost:4000`). Start it
from the repo (`pnpm dev` runs everything via Turborepo, or run the API package alone).

## Environment

Copy `.env.example` to `.env.local` and adjust as needed:

| Variable              | Default                 | Notes                                            |
| --------------------- | ----------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Base URL of the Node API. All paths are `/api/*`. |

`NEXT_PUBLIC_*` is exposed to the browser, so this must be a publicly reachable URL in
production.

## Auth

The Node API issues a JWT from `POST /api/auth/login` / `/register`. The token is stored
in `localStorage` and sent as `Authorization: Bearer <token>` on authed requests. A `401`
clears the token and redirects to `/login`.

Seeded demo account: **demo@k21.local** / **demo1234** (the login page has a one-click
"Use demo account" button).

## Routes

| Route      | What                                                                          |
| ---------- | ---------------------------------------------------------------------------- |
| `/`        | **Today / Tracker** — date nav, summary + goal, insight, add meal, food library, AI Snap, meals list. |
| `/history` | **History** — 7d / 14d / 30d / All range tabs, vanilla bar chart, range totals & averages. |
| `/login`   | Sign in / register (with demo shortcut).                                      |
| `/admin`   | **Owner-only** AI provider console (separate admin password + token).         |

## Structure

```
apps/web/
├── app/
│   ├── layout.tsx           # Root layout + AuthProvider
│   ├── globals.css          # Design tokens + shared primitives
│   ├── page.tsx             # Tracker (Today)
│   ├── login/page.tsx       # Login / register
│   ├── history/page.tsx     # History + chart
│   └── admin/page.tsx       # Admin console
├── components/              # SummaryCard, InsightCard, AddMealForm, FoodLibrary,
│                            #   AiSnap, MealsList, HistoryChart, DateNav, Header, … (CSS Modules)
├── lib/
│   ├── api.ts               # Typed fetch client (bearer + admin token, 401 handling, Zod validation)
│   ├── auth.ts              # Token storage + AuthProvider/useAuth
│   ├── admin.ts             # Admin-token storage (keys are NEVER stored client-side)
│   ├── image.ts             # Client-side downscale -> JPEG base64 for AI Snap
│   ├── date.ts              # ISO date helpers
│   ├── health.ts            # Category -> healthiness mapping
│   └── types.ts             # DailyInsight / MealSummary schemas (complement @k21/validation)
├── next.config.mjs
├── tsconfig.json            # extends @k21/config/tsconfig.react.json
└── package.json
```

## Design & accessibility

- Green → orange health palette via CSS custom properties (light + dark via
  `prefers-color-scheme`).
- Mobile-first responsive layouts (CSS Grid/Flex).
- Keyboard navigable; visible `:focus-visible` outlines; ARIA labels on controls,
  the progress bar, and chart bars (each bar is a focusable button with a label so the
  tooltip is keyboard-reachable).
- Animations respect `prefers-reduced-motion`.

## Notes / assumptions

- Types and schemas come from **`@k21/validation`**; API responses are validated with
  those schemas where practical. `DailyInsight` / the `/meals/summary` envelope are not
  exported from `@k21/validation`, so matching Zod schemas live in `lib/types.ts`.
- **API keys are never shown, stored, or sent by the browser.** The admin UI only
  displays masked key status (`hasKey` / `keySource`) and lets the owner submit a new key
  value (or clear a UI-stored key) to the backend.
- AI Snap downscales images client-side to ~1280px JPEG before upload to stay well under
  the 4MB limit. Capture supports file upload, clipboard paste (Ctrl+V), and the device
  camera (`capture="environment"`).
- Editing the daily goal saves it as the **standing/default goal** (`date: null`) so it
  applies to every day; the API can still override per-day.
```
