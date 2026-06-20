# K21 Calorie Tracker

## Purpose
A small web app for tracking calories. Users log food, and in a later phase the
app will use **Google's Gemini API** to analyze food images and estimate
calories/macros automatically.

## Tech Stack
- **Runtime:** Node.js
- **Server:** Express
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no frameworks)
- **AI (later phase):** Google Gemini API for food image analysis

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
