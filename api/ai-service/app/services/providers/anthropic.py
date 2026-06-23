"""Anthropic provider via the anthropic SDK.

Anthropic accepts only jpeg/png/gif/webp images. HEIC/HEIF raise a clear,
caller-fixable error (mapped to 400 by the router) before any network call.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

from ...config import ResolvedProvider
from ...errors import ConfigError, UpstreamError
from ..prompt import FULL_PROMPT, FULL_TEXT_PROMPT, parse_provider_json

# Media types Anthropic's image blocks accept.
_ANTHROPIC_SUPPORTED = {"image/jpeg", "image/png", "image/gif", "image/webp"}


async def analyze(
    *,
    resolved: ResolvedProvider,
    image_base64: str,
    mime_type: str,
) -> dict[str, Any]:
    if mime_type not in _ANTHROPIC_SUPPORTED:
        # 400: caller-fixable (use a different format). Not a config/upstream issue.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Anthropic supports only JPEG, PNG, GIF, or WebP images. "
                "Please convert HEIC/HEIF before analyzing, or select a "
                "different provider."
            ),
        )

    if not resolved["api_key"]:
        raise ConfigError("Anthropic is not configured. Add an Anthropic API key.")

    try:
        from anthropic import AsyncAnthropic
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise UpstreamError("Anthropic SDK is not installed.") from exc

    try:
        client = AsyncAnthropic(api_key=resolved["api_key"])
        message = await client.messages.create(
            model=resolved["model"],
            max_tokens=1024,
            system=FULL_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analyze this food image and return the JSON object.",
                        },
                    ],
                }
            ],
        )
        text = "".join(
            block.text for block in message.content if getattr(block, "type", "") == "text"
        ).strip()
        return parse_provider_json(text)
    except HTTPException:
        raise
    except (ConfigError, UpstreamError):
        raise
    except Exception as exc:  # noqa: BLE001 - normalize to a safe upstream error
        raise UpstreamError("Anthropic request failed.") from exc


async def analyze_text(
    *,
    resolved: ResolvedProvider,
    text: str,
) -> dict[str, Any]:
    # No image, so no media-type restriction applies to the text path.
    if not resolved["api_key"]:
        raise ConfigError("Anthropic is not configured. Add an Anthropic API key.")

    try:
        from anthropic import AsyncAnthropic
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise UpstreamError("Anthropic SDK is not installed.") from exc

    try:
        client = AsyncAnthropic(api_key=resolved["api_key"])
        message = await client.messages.create(
            model=resolved["model"],
            max_tokens=1024,
            system=FULL_TEXT_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Parse this meal description and return the JSON "
                        "object:\n\n" + text
                    ),
                }
            ],
        )
        result = "".join(
            block.text for block in message.content if getattr(block, "type", "") == "text"
        ).strip()
        return parse_provider_json(result)
    except (ConfigError, UpstreamError):
        raise
    except Exception as exc:  # noqa: BLE001 - normalize to a safe upstream error
        raise UpstreamError("Anthropic request failed.") from exc
