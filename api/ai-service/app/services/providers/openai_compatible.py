"""OpenAI + Kimi (Moonshot) provider via the openai SDK.

Kimi/Moonshot is OpenAI-compatible: the same client is used with ``base_url``
set to the Kimi base URL. Images are sent as a ``data:`` URL.
"""

from __future__ import annotations

from typing import Any

from ...config import ResolvedProvider
from ...errors import ConfigError, UpstreamError
from ..prompt import FULL_PROMPT, FULL_TEXT_PROMPT, parse_provider_json


async def analyze(
    *,
    resolved: ResolvedProvider,
    image_base64: str,
    mime_type: str,
) -> dict[str, Any]:
    provider_id = resolved["id"]
    if not resolved["api_key"]:
        label = "Kimi" if provider_id == "kimi" else "OpenAI"
        raise ConfigError(f"{label} is not configured. Add a {label} API key.")

    try:
        from openai import AsyncOpenAI
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise UpstreamError("OpenAI SDK is not installed.") from exc

    client_kwargs: dict[str, Any] = {"api_key": resolved["api_key"]}
    if provider_id == "kimi":
        client_kwargs["base_url"] = resolved["kimi_base_url"]

    data_url = f"data:{mime_type};base64,{image_base64}"

    try:
        client = AsyncOpenAI(**client_kwargs)
        completion = await client.chat.completions.create(
            model=resolved["model"],
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": FULL_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this food image and return the JSON object.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                },
            ],
        )
        text = (completion.choices[0].message.content or "").strip()
        return parse_provider_json(text)
    except (ConfigError, UpstreamError):
        raise
    except Exception as exc:  # noqa: BLE001 - normalize to a safe upstream error
        label = "Kimi" if provider_id == "kimi" else "OpenAI"
        raise UpstreamError(f"{label} request failed.") from exc


async def analyze_text(
    *,
    resolved: ResolvedProvider,
    text: str,
) -> dict[str, Any]:
    provider_id = resolved["id"]
    if not resolved["api_key"]:
        label = "Kimi" if provider_id == "kimi" else "OpenAI"
        raise ConfigError(f"{label} is not configured. Add a {label} API key.")

    try:
        from openai import AsyncOpenAI
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise UpstreamError("OpenAI SDK is not installed.") from exc

    client_kwargs: dict[str, Any] = {"api_key": resolved["api_key"]}
    if provider_id == "kimi":
        client_kwargs["base_url"] = resolved["kimi_base_url"]

    try:
        client = AsyncOpenAI(**client_kwargs)
        completion = await client.chat.completions.create(
            model=resolved["model"],
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": FULL_TEXT_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Parse this meal description and return the JSON "
                        "object:\n\n" + text
                    ),
                },
            ],
        )
        result = (completion.choices[0].message.content or "").strip()
        return parse_provider_json(result)
    except (ConfigError, UpstreamError):
        raise
    except Exception as exc:  # noqa: BLE001 - normalize to a safe upstream error
        label = "Kimi" if provider_id == "kimi" else "OpenAI"
        raise UpstreamError(f"{label} request failed.") from exc
