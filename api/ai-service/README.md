# K21 Calorie Tracker — AI Service

Python **FastAPI** microservice that owns **all** AI / image / nutrition
processing for the K21 Calorie Tracker monorepo.

The **Node API is the only public gateway**; it calls this service over HTTP
(server-to-server) with a shared internal token. This service holds the LLM
provider API keys (via environment variables + a gitignored runtime config) and
**never returns or logs a key**.

It exposes food-image analysis today, plus clearly-marked **future** stubs for
barcode lookup, USDA FoodData Central / Open Food Facts nutrition databases, and
S3/GCS/Azure image storage.

## Endpoints

| Method | Path             | Auth (`x-internal-token`) | Description |
|--------|------------------|:--------:|-------------|
| GET    | `/health`        | no  | Liveness: `{ "status": "ok", "service": "ai-service" }` |
| POST   | `/analyze-food`  | yes | Analyze a base64 food image -> structured nutrition JSON (the hard contract). |
| GET    | `/admin/config`  | yes | **Masked** AI config (active provider, per-provider model/defaultModel/hasKey/keySource, kimiBaseURL). Keys never included. |
| POST   | `/admin/config`  | yes | Update provider/models/keys/kimiBaseURL. Persists to `runtime-config.json` only. Returns `{ "ok": true }`. |
| POST   | `/admin/test`    | yes | Runs a tiny real analysis against the active provider using a 2×2 PNG. |
| GET    | `/barcode/{code}`| yes | **FUTURE** — returns `501` today. |
| GET    | `/nutrition/search?q=` | yes | **FUTURE** — returns `501` today. |

Interactive docs: **`/docs`** (Swagger) and **`/redoc`**.

### `POST /analyze-food`

Request:
```json
{ "imageBase64": "<base64>", "mimeType": "image/jpeg" }
```
`mimeType` ∈ `image/jpeg | image/png | image/webp | image/heic | image/heif`.
Decoded image must be **≤ 4 MB** (else `400`).

Response (exact shape — other apps depend on it):
```json
{
  "food_name": "Grilled chicken salad",
  "estimated_calories": 420,
  "protein_g": 35,
  "carbs_g": 18,
  "fat_g": 22,
  "healthiness_rating": 4,
  "portion_recommendation": "A reasonable single serving; pair with water.",
  "confidence": "medium",
  "notes": "Dressing amount is estimated and may vary.",
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

Every provider's raw output is **coerced and clamped** to the bounds above
(numbers rounded to ints and clamped; `confidence` defaults to `low`;
`healthiness_rating` defaults to `3` when missing). If no food is detected:
`food_name = "No food detected"`, all numbers `0`, `healthiness_rating = 1`,
`confidence = "low"`.

### Status codes

| Code | Meaning |
|------|---------|
| 400  | Bad request (invalid base64, image > 4 MB, or HEIC/HEIF sent to Anthropic). |
| 401  | Missing/invalid `x-internal-token`. |
| 502  | Provider/network failure (generic safe message; real error logged server-side only). |
| 503  | Selected provider is not configured (no API key). |

## Providers

| Provider   | SDK | Default model | Notes |
|------------|-----|---------------|-------|
| `gemini`   | `google-generativeai` | `gemini-2.5-flash` | Inline image bytes + JSON response. |
| `openai`   | `openai` | `gpt-4o-mini` | Chat completions, `json_object`, image as data URL. |
| `kimi`     | `openai` (custom `base_url`) | `moonshot-v1-8k-vision-preview` | Moonshot is OpenAI-compatible; default base URL `https://api.moonshot.ai/v1`. |
| `anthropic`| `anthropic` | `claude-opus-4-8` | Image block (base64). Accepts only jpeg/png/gif/webp — HEIC/HEIF → `400`. |

### Config precedence (highest first), re-read **per request**
1. **Owner runtime config** — `runtime-config.json` (gitignored), written by the
   admin endpoints. Holds provider selection, per-provider model, per-provider
   key, and the Kimi base URL.
2. **Environment variables** — `LLM_PROVIDER`, `GEMINI_API_KEY`/`GEMINI_MODEL`,
   `OPENAI_API_KEY`/`OPENAI_MODEL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`,
   `KIMI_API_KEY`/`KIMI_MODEL`/`KIMI_BASE_URL`.
3. **Built-in defaults.**

The repo-root `.env` is loaded if present, but its values are only ever passed to
the SDKs — never read into logs or HTTP responses.

Other environment variables:
- `AI_INTERNAL_TOKEN` — shared secret for `x-internal-token` (default
  `dev-internal-token`; set a real value in production).
- `AI_CORS_ORIGINS` — comma-separated allowed origins (default `*`).
- `RUNTIME_CONFIG_PATH` — override the runtime-config.json location.
- Future: `OPEN_FOOD_FACTS_BASE_URL`, `USDA_FDC_API_KEY`, `STORAGE_PROVIDER`,
  `LOCAL_STORAGE_DIR`, cloud-storage bucket vars.

## Run locally

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open <http://localhost:8000/docs>.

## Docker

```bash
docker build -t k21-ai-service .
docker run -p 8000:8000 --env-file ../../.env k21-ai-service
```

## Security notes

- **Keys are never returned or logged.** Config responses are masked — they
  expose only `hasKey` (bool) and `keySource` (`ui` | `env` | `none`).
- The app **never reads, edits, prints, or logs `.env`** contents or any key
  value. `.env` stays gitignored.
- `runtime-config.json` may contain keys written via the admin UI and is
  **gitignored** (root `.gitignore` plus this service's `.gitignore`). It is
  never committed and never shipped in the Docker image (see `.dockerignore`).
- Upstream failures return a generic message; the real error is logged
  server-side only.

## Project layout

```
api/ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, CORS, exception handlers, /health
│   ├── config.py               # env + runtime-config.json + precedence resolver
│   ├── errors.py               # ConfigError (503), UpstreamError (502)
│   ├── schemas.py              # Pydantic models (the analysis contract)
│   ├── security.py             # require_internal_token dependency
│   ├── services/
│   │   ├── analysis.py         # provider dispatch + normalize/clamp
│   │   ├── prompt.py           # shared prompt + tolerant JSON parsing
│   │   └── providers/
│   │       ├── gemini.py
│   │       ├── openai_compatible.py   # openai + kimi
│   │       └── anthropic.py
│   ├── routers/
│   │   ├── analyze.py
│   │   ├── admin.py
│   │   ├── barcode.py          # FUTURE (501)
│   │   └── nutrition.py        # FUTURE (501)
│   └── integrations/           # FUTURE stubs
│       ├── barcode.py
│       ├── usda.py
│       ├── open_food_facts.py
│       └── storage.py
├── requirements.txt
├── Dockerfile
├── .dockerignore
├── .gitignore
├── pyproject.toml
└── README.md
```
