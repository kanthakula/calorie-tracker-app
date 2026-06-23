"""Admin config endpoints. All require the internal token.

Config responses are MASKED — keys are NEVER included; only hasKey/keySource.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import (
    active_kimi_base_url,
    resolve_active_provider,
    resolve_all_providers,
    update_runtime_config,
)
from ..schemas import (
    AdminConfig,
    AdminTestResponse,
    ProviderStatus,
    UpdateAdminConfig,
)
from ..security import require_internal_token
from ..services.analysis import analyze_food

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_internal_token)],
)

# 2x2 transparent PNG used for the live provider test.
_TEST_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EI"
    "wDiqEAB3CAILXAYjpQAAAABJRU5ErkJggg=="
)


@router.get("/config", response_model=AdminConfig, summary="Masked AI config.")
async def get_config() -> AdminConfig:
    providers = [
        ProviderStatus(
            id=p["id"],
            model=p["model"],
            defaultModel=p["default_model"],
            hasKey=p["api_key"] is not None,
            keySource=p["key_source"],
        )
        for p in resolve_all_providers()
    ]
    return AdminConfig(
        activeProvider=resolve_active_provider(),
        providers=providers,
        kimiBaseURL=active_kimi_base_url(),
    )


@router.post("/config", summary="Update AI config (persisted to runtime-config.json).")
async def update_config(payload: UpdateAdminConfig) -> dict[str, bool]:
    update_runtime_config(
        provider=payload.provider,
        models=payload.models,
        keys=payload.keys,
        kimi_base_url=payload.kimiBaseURL,
    )
    return {"ok": True}


@router.post(
    "/test",
    response_model=AdminTestResponse,
    summary="Run a tiny real analysis against the active provider.",
)
async def test_provider() -> AdminTestResponse:
    active = resolve_active_provider()
    # PNG is accepted by every provider (including Anthropic).
    sample = await analyze_food(_TEST_PNG_B64, "image/png", provider=active)
    return AdminTestResponse(provider=sample.provider, model=sample.model, sample=sample)
