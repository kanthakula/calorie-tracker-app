"""Gemini provider via google-generativeai.

Sends inline image bytes (vision) or the user's text + the shared prompt and
requests a JSON response.
"""

from __future__ import annotations

import base64
from typing import Any

from ...config import ResolvedProvider
from ...errors import ConfigError, UpstreamError
from ..prompt import (
    FULL_PROMPT,
    FULL_TEXT_PROMPT,
    RESPONSE_JSON_SCHEMA,
    parse_provider_json,
)


async def analyze(
    *,
    resolved: ResolvedProvider,
    image_base64: str,
    mime_type: str,
) -> dict[str, Any]:
    if not resolved["api_key"]:
        raise ConfigError("Gemini is not configured. Add a Gemini API key.")

    try:
        import google.generativeai as genai
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise UpstreamError("Gemini SDK is not installed.") from exc

    try:
        image_bytes = base64.b64decode(image_base64, validate=True)
    except (ValueError, base64.binascii.Error) as exc:  # type: ignore[attr-defined]
        raise UpstreamError("Could not decode the provided image.") from exc

    try:
        genai.configure(api_key=resolved["api_key"])
        model = genai.GenerativeModel(
            model_name=resolved["model"],
            system_instruction=FULL_PROMPT,
        )
        response = await model.generate_content_async(
            [
                {"mime_type": mime_type, "data": image_bytes},
                "Analyze this food image and return the JSON object.",
            ],
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": RESPONSE_JSON_SCHEMA,
            },
        )
        text = (getattr(response, "text", "") or "").strip()
        return parse_provider_json(text)
    except (ConfigError, UpstreamError):
        raise
    except Exception as exc:  # noqa: BLE001 - normalize to a safe upstream error
        # Never surface the raw error/key to callers; caller logs server-side.
        raise UpstreamError("Gemini request failed.") from exc


async def analyze_text(
    *,
    resolved: ResolvedProvider,
    text: str,
) -> dict[str, Any]:
    if not resolved["api_key"]:
        raise ConfigError("Gemini is not configured. Add a Gemini API key.")

    try:
        import google.generativeai as genai
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise UpstreamError("Gemini SDK is not installed.") from exc

    try:
        genai.configure(api_key=resolved["api_key"])
        model = genai.GenerativeModel(
            model_name=resolved["model"],
            system_instruction=FULL_TEXT_PROMPT,
        )
        response = await model.generate_content_async(
            [
                "Parse this meal description and return the JSON object:\n\n" + text,
            ],
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": RESPONSE_JSON_SCHEMA,
            },
        )
        result = (getattr(response, "text", "") or "").strip()
        return parse_provider_json(result)
    except (ConfigError, UpstreamError):
        raise
    except Exception as exc:  # noqa: BLE001 - normalize to a safe upstream error
        # Never surface the raw error/key to callers; caller logs server-side.
        raise UpstreamError("Gemini request failed.") from exc
