# K21 Calorie Tracker — Monorepo

Production-grade TypeScript monorepo for the K21 Calorie Tracker. Users log food
manually, from a predefined library, or by snapping a photo that an LLM analyzes
into calories + macros. Built to grow into barcode lookup, nutrition databases,
and cloud image storage.

## Architecture

```
k21-calorie-tracker/
├── api/                      # ALL backend / API code lives here
│   ├── node-api/             # Node.js + Express + TypeScript — main backend
│   │   ├── auth, meals, goals, foods, admin, analyze-food
│   │   └── talks to Postgres (Prisma) and the Python AI service
│   └── ai-service/           # Python + FastAPI — AI/image/nutrition processing
│       ├── /analyze-food (Gemini today; pluggable providers)
│       └── future: barcode, USDA FoodData Central, Open Food Facts, S3/GCS/Azure
├── apps/
│   ├── web/                  # Next.js (App Router) web app
│   └── mobile/               # Expo React Native app
├── packages/
│   ├── validation/           # @k21/validation — shared Zod schemas + types
│   ├── db/                   # @k21/db — Prisma schema, client, seed
│   └── config/               # @k21/config — shared tsconfig/eslint presets
├── docker-compose.yml        # Postgres (+ optional pgAdmin) for local dev
├── turbo.json                # Turborepo task pipeline
├── pnpm-workspace.yaml       # pnpm workspaces (JS/TS only; ai-service is Python)
└── legacy/                   # the original single-file Express app (reference)
```

### Why this shape
- **Shared contract, one source of truth.** `@k21/validation` (Zod) defines the
  nutrition/meal/admin contracts; web, mobile, and the Node API all import the
  same schemas, so the JSON shape can never drift between client and server.
- **`@k21/db` (Prisma + Postgres)** replaces `localStorage` as the durable store,
  enabling multi-device sync and real user accounts.
- **Two backends, clear split.** Node API owns app data + auth + admin. The
  Python FastAPI service owns AI/vision and future nutrition-data integrations —
  the right ecosystem for ML/image work — and the Node API calls it over HTTP.

## Prerequisites
- **Node.js ≥ 20** and **pnpm 9** (`npm i -g pnpm`)
- **Docker** (for local Postgres) — or your own Postgres
- **Python ≥ 3.11** (for `api/ai-service`)

## Quick start

```bash
# 1. Install JS/TS deps for the whole workspace
pnpm install

# 2. Configure environment
cp .env.example .env        # then fill in DB + an AI provider key

# 3. Start Postgres
pnpm docker:up

# 4. Create the schema + seed the food library
pnpm db:migrate
pnpm db:seed

# 5. Start the Python AI service (separate terminal)
cd api/ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 6. Start everything else (Node API + web + mobile) from the repo root
pnpm dev
```

| Surface         | URL / command                          |
| --------------- | -------------------------------------- |
| Web app         | http://localhost:3000                  |
| Node API        | http://localhost:4000                  |
| AI service      | http://localhost:8000 (docs: `/docs`)  |
| Mobile (Expo)   | `pnpm --filter @k21/mobile start`      |
| Postgres        | localhost:5432                         |
| pgAdmin (opt.)  | `docker compose --profile tools up -d` → http://localhost:5050 |

## Auto-start on reboot (Windows)

The stack is wired to come back automatically after a restart:

- **Postgres** runs in Docker with `restart: unless-stopped`, so it returns when
  Docker Desktop starts on login. Enable that once:
  **Docker Desktop → Settings → General → "Start Docker Desktop when you sign in".**
- **AI service, Node API, web** run under **PM2**, which resurrects them on login
  via a registered Windows startup entry.

One-time setup (idempotent):
```bash
pnpm autostart:setup        # migrates+seeds, builds, installs PM2, starts & saves, registers startup
```
After it runs (and on every reboot) the app is at **http://localhost:3000**.

Managing the running stack:
```bash
pnpm pm2:status             # see the 3 processes
pnpm pm2:logs               # tail logs
pnpm pm2:restart            # restart all three
pnpm autostart:remove       # stop processes + unregister startup (code & DB untouched)
```

After you change code, rebuild and restart so PM2 serves the new build:
```bash
pnpm build && pnpm pm2:restart
```

Demo account: **demo@k21.local / demo1234**.

## Access from other devices on the same Wi-Fi

The web calls its API **same-origin** (Next rewrites `/api/*` to the Node API
server-side), so the browser only talks to one host — no CORS, and HTTPS only
needs to terminate in front of the web app. A `k21-https` reverse proxy
(`scripts/https-proxy.mjs`, also under PM2) serves the app over TLS with a
self-signed cert covering this machine's LAN IPs.

1. **Open the firewall once (elevated):** right-click `scripts/open-firewall.ps1`
   → *Run with PowerShell* (accept the admin prompt). Opens inbound TCP **3443**
   (https), **3000** (http), and **4000** (mobile API) on the Private profile.
2. **Find this PC's Wi-Fi IP:** `ipconfig` → the Wi-Fi *IPv4 Address* (e.g. `192.168.1.248`).
3. **On the other device** (same Wi-Fi), open:
   - **`https://<that-IP>:3443`** — recommended. Accept the one-time "not private"
     warning (self-signed). **Camera (AI snap) + voice logging work here.**
   - `http://<that-IP>:3000` — plain http. Tracking works; camera/voice are
     blocked by the browser (not a secure context).

Notes:
- The Node API (`:4000`) and AI service (`:8000`) aren't called directly by the
  browser anymore — `/api/*` is proxied through Next. `:4000` only needs to be
  reachable for the **Expo mobile app**.
- If the PC's IP changes (DHCP), just use the new IP — nothing to rebuild. For a
  stable address, set a DHCP reservation on your router. (The self-signed cert
  is cached in `certs/`; delete it to regenerate for a new IP.)
- **Mobile app (Expo):** set `EXPO_PUBLIC_API_URL=http://<that-IP>:4000`.

## Security
- **Never commit `.env`.** Only `.env.example` is tracked. API keys are read from
  the environment (or the owner's admin console) and are never sent to the
  browser, logged, or written back to `.env` by the app.
- The admin console is owner-only, gated by `ADMIN_PASSWORD`.

See each package/app's own `README.md` for details.
