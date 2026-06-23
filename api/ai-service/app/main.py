"""FastAPI application entry point for the K21 AI service.

Wires routers, CORS, and exception handlers that map the custom errors to the
contract status codes (ConfigError -> 503, UpstreamError -> 502).
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .errors import ConfigError, UpstreamError
from .routers import admin, analyze, barcode, nutrition

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="K21 Calorie Tracker — AI Service",
    version=__version__,
    description=(
        "Owns all AI/image/nutrition processing. Called by the Node API over "
        "HTTP. Holds provider API keys (env + gitignored runtime config) which "
        "are NEVER returned to any caller."
    ),
)

# The Node API is the only intended caller (server-to-server). CORS is open by
# default but restrictable via AI_CORS_ORIGINS (comma-separated). Auth is the
# x-internal-token header, not CORS.
_origins_env = os.environ.get("AI_CORS_ORIGINS", "*").strip()
_allow_origins = ["*"] if _origins_env in ("", "*") else [
    o.strip() for o in _origins_env.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ConfigError)
async def _config_error_handler(_: Request, exc: ConfigError) -> JSONResponse:
    # Provider not configured — caller-fixable. Message is safe (no key).
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(UpstreamError)
async def _upstream_error_handler(_: Request, exc: UpstreamError) -> JSONResponse:
    # Real cause already logged server-side; return a generic safe message.
    logger.error("UpstreamError: %s", exc)
    return JSONResponse(
        status_code=502,
        content={"detail": "The AI provider could not process this request."},
    )


@app.get("/health", tags=["health"], summary="Liveness check (open, no auth).")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


app.include_router(analyze.router)
app.include_router(admin.router)
app.include_router(barcode.router)
app.include_router(nutrition.router)
