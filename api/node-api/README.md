# @k21/node-api

The main backend — **Express + TypeScript**. Owns app data and auth; acts as the
**gateway** to the Python AI service (so provider keys live in exactly one place).

## Responsibilities
- **Auth** — register/login (bcrypt + JWT), `GET /api/auth/me`.
- **Meals** — CRUD + `GET /api/meals/summary?date=` (totals + goal + daily insight).
- **Goals** — standing default + per-date overrides.
- **Foods** — the predefined library (categories + search).
- **Analyze** — `POST /api/analyze-food` forwards the image to the AI service.
- **Admin** — owner-only AI provider/model config, proxied to the AI service.

## Endpoints
| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET    | `/api/health` | – | liveness |
| GET    | `/api/health/ai` | – | downstream AI service liveness |
| POST   | `/api/auth/register` | – | `{ email, password, name? }` |
| POST   | `/api/auth/login` | – | returns `{ user, token }` |
| GET    | `/api/auth/me` | user | |
| GET    | `/api/meals?date=` or `?from=&to=` | user | |
| POST   | `/api/meals` | user | `CreateMeal` |
| PATCH  | `/api/meals/:id` | user | `UpdateMeal` |
| DELETE | `/api/meals/:id` | user | |
| GET    | `/api/meals/summary?date=` | user | totals + insight |
| GET/PUT| `/api/goal` | user | |
| GET    | `/api/foods`, `/api/foods/categories` | user | |
| POST   | `/api/analyze-food` | user | rate-limited; ≤4MB image |
| POST   | `/api/admin/login` | – | mints admin token |
| GET/POST | `/api/admin/config` | admin | masked; keys never returned |
| POST   | `/api/admin/test` | admin | live provider check |

## Layout
```
src/
├── index.ts              # server bootstrap
├── app.ts                # express assembly (helmet, cors, json, routes, errors)
├── env.ts                # validated env (loads repo-root .env)
├── lib/                  # errors, jwt
├── middleware/           # auth (JWT), admin (token), validate (zod)
├── services/             # auth, meal, goal, food, insight, ai-service client
└── routes/               # one router per resource
```

## Dev
```bash
pnpm --filter @k21/node-api dev      # tsx watch on :4000
pnpm --filter @k21/node-api test     # vitest
```
Requires Postgres (`pnpm docker:up` + `pnpm db:migrate`) and ideally the AI
service running for `/analyze-food`. All requests share the same Zod contract via
`@k21/validation`, so request/response shapes are validated end to end.

## Security
- Provider API keys are **never** handled here — they live in the AI service env.
- Errors are sanitized before responding; secrets are never logged.
