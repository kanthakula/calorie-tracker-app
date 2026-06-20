# K21 Calorie Tracker

## Purpose
A small web app for tracking calories. Users log food, and in a later phase the
app will use **Google's Gemini API** to analyze food images and estimate
calories/macros automatically.

## Tech Stack
- **Runtime:** Node.js
- **Server:** Express
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no frameworks)
- **AI:** Pluggable food image analysis via `llm.js`. Set `LLM_PROVIDER` in `.env` to
  `gemini` | `openai` | `anthropic` | `kimi`; each provider reads its own key + model
  from `.env` (e.g. `GEMINI_API_KEY`/`GEMINI_MODEL`, `OPENAI_*`, `ANTHROPIC_*`, `KIMI_*`).
  Config is re-read from `.env` per request, so changing provider/key/model needs no
  restart. SDKs: `@google/generative-ai`, `openai` (also used for Kimi/Moonshot via a
  custom `baseURL`), `@anthropic-ai/sdk`. The `POST /api/analyze-food` endpoint accepts a
  base64 image and returns the same structured nutrition JSON regardless of provider.

## Folder Structure
The project starts minimal and grows into roughly this shape:

```
k21-calorie-tracker/
├── server.js          # Express server entry point
├── public/            # Static assets served to the browser
│   └── index.html     # App UI
├── .env               # Secrets (GEMINI_API_KEY) — never committed
├── .gitignore
├── CLAUDE.md
└── package.json
```

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
