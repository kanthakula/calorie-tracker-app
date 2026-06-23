"""Configuration: env loading, runtime-config.json read/write, and the
precedence resolver.

Precedence (highest first), re-read per request so changes need no restart:
  1. owner's runtime config file ``runtime-config.json`` (gitignored).
  2. environment variables.
  3. built-in defaults.

HARD RULE: never read, print, or log the contents of any ``.env`` file or any
API key value. Secret values are only ever passed to provider SDKs and to the
masking helpers (which return booleans, never the key itself).
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal, TypedDict

from dotenv import load_dotenv

Provider = Literal["gemini", "openai", "anthropic", "kimi"]

PROVIDERS: tuple[Provider, ...] = ("gemini", "openai", "anthropic", "kimi")

DEFAULT_MODELS: dict[Provider, str] = {
    "gemini": "gemini-2.5-flash",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-opus-4-8",
    "kimi": "moonshot-v1-8k-vision-preview",
}

# Kimi/Moonshot is OpenAI-compatible — used via the OpenAI SDK with this base URL.
KIMI_DEFAULT_BASE_URL = "https://api.moonshot.ai/v1"

# Per-provider environment variable names.
ENV_KEY_NAMES: dict[Provider, str] = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "kimi": "KIMI_API_KEY",
}
ENV_MODEL_NAMES: dict[Provider, str] = {
    "gemini": "GEMINI_MODEL",
    "openai": "OPENAI_MODEL",
    "anthropic": "ANTHROPIC_MODEL",
    "kimi": "KIMI_MODEL",
}

# Repo root is three levels up from app/ (app/ -> ai-service/ -> api/ -> root).
_APP_DIR = Path(__file__).resolve().parent
_SERVICE_DIR = _APP_DIR.parent
_REPO_ROOT = _SERVICE_DIR.parent.parent

# runtime-config.json lives beside the service (gitignored). Allow override.
RUNTIME_CONFIG_PATH = Path(
    os.environ.get("RUNTIME_CONFIG_PATH", str(_SERVICE_DIR / "runtime-config.json"))
)

# Load the repo-root .env if present. We never read its values ourselves; we
# only let python-dotenv populate os.environ for the SDKs/resolver to consume.
_ROOT_ENV = _REPO_ROOT / ".env"
if _ROOT_ENV.exists():
    load_dotenv(_ROOT_ENV)
# Also load a local .env in the service dir if someone keeps one there.
_LOCAL_ENV = _SERVICE_DIR / ".env"
if _LOCAL_ENV.exists():
    load_dotenv(_LOCAL_ENV)


def get_internal_token() -> str:
    """Shared secret required on internal endpoints (from the Node API)."""
    return os.environ.get("AI_INTERNAL_TOKEN", "dev-internal-token")


KeySource = Literal["ui", "env", "none"]


class ResolvedProvider(TypedDict):
    id: Provider
    model: str
    default_model: str
    api_key: str | None
    key_source: KeySource
    kimi_base_url: str  # only meaningful for kimi, harmless otherwise


# ---------------------------------------------------------------------------
# runtime-config.json I/O
# ---------------------------------------------------------------------------


def _read_runtime_config() -> dict:
    """Read the owner's UI config. Returns {} when the file is missing/invalid.

    Shape (all optional):
      {
        "provider": "gemini"|"openai"|"anthropic"|"kimi",
        "models":   { "<provider>": "<model>" },
        "keys":     { "<provider>": "<api-key>" },
        "kimiBaseURL": "https://..."
      }
    """
    try:
        with RUNTIME_CONFIG_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _write_runtime_config(data: dict) -> None:
    RUNTIME_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = RUNTIME_CONFIG_PATH.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
    tmp.replace(RUNTIME_CONFIG_PATH)


# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------


def resolve_active_provider() -> Provider:
    """The active provider, re-read per request."""
    cfg = _read_runtime_config()
    candidate = cfg.get("provider") or os.environ.get("LLM_PROVIDER")
    if candidate in PROVIDERS:
        return candidate  # type: ignore[return-value]
    return "gemini"


def _resolve_key(provider: Provider, cfg: dict) -> tuple[str | None, KeySource]:
    ui_keys = cfg.get("keys") or {}
    ui_value = ui_keys.get(provider)
    if isinstance(ui_value, str) and ui_value.strip():
        return ui_value.strip(), "ui"
    env_value = os.environ.get(ENV_KEY_NAMES[provider])
    if env_value and env_value.strip():
        return env_value.strip(), "env"
    return None, "none"


def _resolve_model(provider: Provider, cfg: dict) -> str:
    ui_models = cfg.get("models") or {}
    ui_value = ui_models.get(provider)
    if isinstance(ui_value, str) and ui_value.strip():
        return ui_value.strip()
    env_value = os.environ.get(ENV_MODEL_NAMES[provider])
    if env_value and env_value.strip():
        return env_value.strip()
    return DEFAULT_MODELS[provider]


def _resolve_kimi_base_url(cfg: dict) -> str:
    ui_value = cfg.get("kimiBaseURL")
    if isinstance(ui_value, str) and ui_value.strip():
        return ui_value.strip()
    env_value = os.environ.get("KIMI_BASE_URL")
    if env_value and env_value.strip():
        return env_value.strip()
    return KIMI_DEFAULT_BASE_URL


def resolve_provider(provider: Provider) -> ResolvedProvider:
    """Fully resolve one provider's config (model, key, key source, base url)."""
    cfg = _read_runtime_config()
    api_key, key_source = _resolve_key(provider, cfg)
    return ResolvedProvider(
        id=provider,
        model=_resolve_model(provider, cfg),
        default_model=DEFAULT_MODELS[provider],
        api_key=api_key,
        key_source=key_source,
        kimi_base_url=_resolve_kimi_base_url(cfg),
    )


def resolve_all_providers() -> list[ResolvedProvider]:
    return [resolve_provider(p) for p in PROVIDERS]


# ---------------------------------------------------------------------------
# Admin updates (persist to runtime-config.json only)
# ---------------------------------------------------------------------------


def update_runtime_config(
    *,
    provider: Provider | None = None,
    models: dict[str, str] | None = None,
    keys: dict[str, str | None] | None = None,
    kimi_base_url: str | None = None,
) -> None:
    """Apply a partial admin update and persist it.

    Keys are written ONLY to runtime-config.json (gitignored), never to .env.
    A key value of ``None`` clears that provider's key; a non-empty string sets
    it; an empty/whitespace string is ignored.
    """
    cfg = _read_runtime_config()

    if provider is not None:
        cfg["provider"] = provider

    if models:
        existing_models = dict(cfg.get("models") or {})
        for key, value in models.items():
            if key in PROVIDERS and isinstance(value, str) and value.strip():
                existing_models[key] = value.strip()
        cfg["models"] = existing_models

    if keys:
        existing_keys = dict(cfg.get("keys") or {})
        for key, value in keys.items():
            if key not in PROVIDERS:
                continue
            if value is None:
                existing_keys.pop(key, None)  # clear
            elif isinstance(value, str) and value.strip():
                existing_keys[key] = value.strip()
            # empty string -> ignore (no change)
        cfg["keys"] = existing_keys

    if kimi_base_url is not None and kimi_base_url.strip():
        cfg["kimiBaseURL"] = kimi_base_url.strip()

    _write_runtime_config(cfg)


def active_kimi_base_url() -> str:
    return _resolve_kimi_base_url(_read_runtime_config())
