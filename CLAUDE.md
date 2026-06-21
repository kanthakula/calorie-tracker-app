# K21 Calorie Tracker

## Purpose
A small web app for tracking calories. Users log food, and in a later phase the
app will use **Google's Gemini API** to analyze food images and estimate
calories/macros automatically.

## Tech Stack
- **Runtime:** Node.js
- **Server:** Express
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no frameworks)
- **AI:** Pluggable food image analysis via `llm.js`. Provider is `gemini` | `openai` |
  `anthropic` | `kimi`. SDKs: `@google/generative-ai`, `openai` (also Kimi/Moonshot via a
  custom `baseURL`), `@anthropic-ai/sdk`. The `POST /api/analyze-food` endpoint accepts a
  base64 image and returns the same structured nutrition JSON regardless of provider.
- **Config precedence:** owner's UI settings (`runtime-config.json`, gitignored, written
  by `config-store.js`) → `.env` (`LLM_PROVIDER`, `GEMINI_*`, `OPENAI_*`, `ANTHROPIC_*`,
  `KIMI_*`) → built-in defaults. Both layers are re-read per request, so changes need no
  restart. API keys are never written to `.env` by the app and never sent to the browser.
- **Admin console:** owner-only AI settings at `/admin` (`public/admin.html`), gated by
  `ADMIN_PASSWORD` in `.env`. `POST /api/admin/login` mints a short-lived in-memory token;
  `GET/POST /api/admin/config` (masked keys) and `POST /api/admin/test` require it. Regular
  users see no config UI.

## Folder Structure
The project starts minimal and grows into roughly this shape:

```
k21-calorie-tracker/
├── server.js            # Express server entry point (HTTP + self-signed HTTPS)
├── llm.js               # Multi-provider AI food analysis (gemini/openai/anthropic/kimi)
├── config-store.js      # Read/write runtime-config.json (owner's UI settings)
├── public/              # Static assets served to the browser
│   ├── index.html       # Main app UI (tracker, AI snap, food library)
│   ├── admin.html       # Owner-only AI settings console
│   └── foods.js         # Predefined food library (items + macros, by category)
├── .env                 # Secrets (API keys, ADMIN_PASSWORD) — never committed
├── runtime-config.json  # Owner's UI config incl. keys — gitignored, never committed
├── .gitignore
├── CLAUDE.md
└── package.json
```

Meal records (localStorage) carry `{ id, name, calories, type, date, protein, carbs, fat }`.
The food library provides macros; AI/manual meals default macros to 0. The daily summary
shows protein/carbs/fat totals for the selected date.

## Key Commands
- `npm install` — install dependencies
- `npm start` — start the Express server

## Coding Conventions
- Use **ES modules** (`import`/`export`), not CommonJS `require`.
- Use **async/await** for asynchronous code; avoid raw `.then()` chains.
- **No external CSS frameworks** (no Bootstrap, Tailwind, etc.) — plain CSS only.
- Keep the frontend dependency-free vanilla JS.
- Load secrets from environment variables; never hardcode keys.

## Important Rules
- **NEVER read, edit, or display the contents of `.env`** in chat output, logs,
  or commits. Treat it as write-only configuration containing secrets.
- `.env` must always stay listed in `.gitignore`.
