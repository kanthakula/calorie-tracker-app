"""Provider dispatch + structured multi-item normalization, DB grounding, and
clamping to the hard analysis contract.

Pipeline:
  1. Vision step: a provider returns a list of detected food items + overall
     healthiness/confidence/notes.
  2. Grounding step: for each item (bounded), try to refine its nutrition from
     USDA FoodData Central, scaling per-100g nutrients by the item's grams.
     Any grounding failure (incl. no API key) degrades to the vision numbers.
  3. Normalize: clamp every value, compute ``total`` as the item sum, and set
     the overall confidence to the lowest item confidence.
"""

from __future__ import annotations

import logging
from typing import Any

from ..config import Provider, ResolvedProvider, resolve_active_provider, resolve_provider
from ..errors import UpstreamError
from ..integrations import usda
from ..schemas import (
    AnalyzeFoodResponse,
    FoodItemAnalysis,
    MealAnalysis,
    NutritionTotal,
)
from .providers import anthropic as anthropic_provider
from .providers import gemini as gemini_provider
from .providers import openai_compatible as openai_provider

logger = logging.getLogger("ai-service.analysis")

_VALID_CONFIDENCE = {"low", "medium", "high"}
_CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}
_RANK_CONFIDENCE = {0: "low", 1: "medium", 2: "high"}

# Bound external lookups so a busy image can't fan out unboundedly.
MAX_GROUNDED_ITEMS = 6


def _clamp_int(value: Any, *, lo: int, hi: int, default: int) -> int:
    """Round to int and clamp into [lo, hi]; fall back to default on garbage."""
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _clamp_float(value: Any, *, lo: float, hi: float, default: float) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _clean_str(value: Any, *, max_len: int, default: str = "") -> str:
    text = str(value).strip() if value is not None else ""
    if not text:
        text = default
    return text[:max_len]


def _norm_confidence(value: Any, *, default: str = "low") -> str:
    text = str(value).strip().lower() if value is not None else ""
    return text if text in _VALID_CONFIDENCE else default


def _normalize_item(raw: dict[str, Any]) -> FoodItemAnalysis:
    """Coerce/clamp one raw vision item to a FoodItemAnalysis (source=vision)."""
    name = _clean_str(raw.get("name"), max_len=120, default="Unknown food")
    return FoodItemAnalysis(
        name=name,
        quantityG=_clamp_float(raw.get("quantity_g"), lo=0.0, hi=5000.0, default=0.0),
        calories=_clamp_int(raw.get("calories"), lo=0, hi=10000, default=0),
        protein_g=_clamp_int(raw.get("protein_g"), lo=0, hi=1000, default=0),
        carbs_g=_clamp_int(raw.get("carbs_g"), lo=0, hi=1000, default=0),
        fat_g=_clamp_int(raw.get("fat_g"), lo=0, hi=1000, default=0),
        confidence=_norm_confidence(raw.get("confidence")),  # type: ignore[arg-type]
        source="vision",
        ref=None,
    )


def _normalize_vision(raw: dict[str, Any]) -> MealAnalysis:
    """Coerce/clamp a provider's raw output to a (pre-grounding) MealAnalysis."""
    raw_items = raw.get("items")
    items: list[FoodItemAnalysis] = []
    if isinstance(raw_items, list):
        for entry in raw_items:
            if isinstance(entry, dict):
                items.append(_normalize_item(entry))

    healthiness = _clamp_int(raw.get("healthiness_rating"), lo=1, hi=5, default=3)
    confidence = _norm_confidence(raw.get("confidence"))
    notes = _clean_str(raw.get("notes"), max_len=600)

    if not items:
        # No food detected (or model returned nothing usable).
        return MealAnalysis(
            items=[],
            total=NutritionTotal(calories=0, protein_g=0, carbs_g=0, fat_g=0),
            healthiness_rating=1,
            confidence="low",
            notes=notes or "No food detected in the image.",
        )

    return MealAnalysis(
        items=items,
        total=NutritionTotal(calories=0, protein_g=0, carbs_g=0, fat_g=0),
        healthiness_rating=healthiness,
        confidence=confidence,
        notes=notes,
    )


async def _ground_item(item: FoodItemAnalysis) -> FoodItemAnalysis:
    """Refine one item's nutrition from USDA FDC, scaling per-100g by grams.

    Never raises: any failure (incl. no API key, no match) returns the item
    unchanged with its vision numbers and ``source='vision'``.
    """
    try:
        match = await usda.search_best_match(item.name)
    except Exception:  # noqa: BLE001 - defensive; search_best_match already guards
        logger.warning("USDA grounding raised unexpectedly; keeping vision numbers.")
        return item

    if match is None or match.calories_per_100g is None:
        return item

    scale = item.quantityG / 100.0
    if scale <= 0:
        # No usable portion size to scale by; keep vision numbers.
        return item

    return FoodItemAnalysis(
        name=item.name,
        quantityG=item.quantityG,
        calories=_clamp_int(
            match.calories_per_100g * scale, lo=0, hi=10000, default=item.calories
        ),
        protein_g=_clamp_int(
            (match.protein_g_per_100g or 0.0) * scale, lo=0, hi=1000, default=item.protein_g
        ),
        carbs_g=_clamp_int(
            (match.carbs_g_per_100g or 0.0) * scale, lo=0, hi=1000, default=item.carbs_g
        ),
        fat_g=_clamp_int(
            (match.fat_g_per_100g or 0.0) * scale, lo=0, hi=1000, default=item.fat_g
        ),
        confidence=item.confidence,
        source="usda",
        ref=str(match.fdc_id) if match.fdc_id else None,
    )


async def _ground_items(items: list[FoodItemAnalysis]) -> list[FoodItemAnalysis]:
    """Ground the first ``MAX_GROUNDED_ITEMS`` items; pass the rest through."""
    grounded: list[FoodItemAnalysis] = []
    for index, item in enumerate(items):
        if index < MAX_GROUNDED_ITEMS:
            grounded.append(await _ground_item(item))
        else:
            grounded.append(item)
    return grounded


def _finalize(meal: MealAnalysis, grounded_items: list[FoodItemAnalysis]) -> MealAnalysis:
    """Compute total from items and set overall confidence to the item minimum."""
    total = NutritionTotal(
        calories=_clamp_int(
            sum(i.calories for i in grounded_items), lo=0, hi=10000, default=0
        ),
        protein_g=_clamp_int(
            sum(i.protein_g for i in grounded_items), lo=0, hi=1000, default=0
        ),
        carbs_g=_clamp_int(
            sum(i.carbs_g for i in grounded_items), lo=0, hi=1000, default=0
        ),
        fat_g=_clamp_int(
            sum(i.fat_g for i in grounded_items), lo=0, hi=1000, default=0
        ),
    )

    if grounded_items:
        min_rank = min(_CONFIDENCE_RANK[i.confidence] for i in grounded_items)
        overall_confidence = _RANK_CONFIDENCE[min_rank]
    else:
        overall_confidence = meal.confidence

    return MealAnalysis(
        items=grounded_items,
        total=total,
        healthiness_rating=meal.healthiness_rating,
        confidence=overall_confidence,  # type: ignore[arg-type]
        notes=meal.notes,
    )


async def _dispatch(
    provider: Provider,
    resolved: ResolvedProvider,
    image_base64: str,
    mime_type: str,
) -> dict[str, Any]:
    if provider == "gemini":
        return await gemini_provider.analyze(
            resolved=resolved, image_base64=image_base64, mime_type=mime_type
        )
    if provider in ("openai", "kimi"):
        return await openai_provider.analyze(
            resolved=resolved, image_base64=image_base64, mime_type=mime_type
        )
    if provider == "anthropic":
        return await anthropic_provider.analyze(
            resolved=resolved, image_base64=image_base64, mime_type=mime_type
        )
    raise UpstreamError(f"Unknown provider: {provider}")


async def _dispatch_text(
    provider: Provider,
    resolved: ResolvedProvider,
    text: str,
) -> dict[str, Any]:
    if provider == "gemini":
        return await gemini_provider.analyze_text(resolved=resolved, text=text)
    if provider in ("openai", "kimi"):
        return await openai_provider.analyze_text(resolved=resolved, text=text)
    if provider == "anthropic":
        return await anthropic_provider.analyze_text(resolved=resolved, text=text)
    raise UpstreamError(f"Unknown provider: {provider}")


async def analyze_food(
    image_base64: str,
    mime_type: str,
    *,
    provider: Provider | None = None,
) -> AnalyzeFoodResponse:
    """Run vision analysis, ground each item against a verified DB, normalize.

    Raises:
        ConfigError: provider not configured (-> 503 in the HTTP layer).
        UpstreamError: provider/network/parse failure (-> 502).
        HTTPException: provider-specific 400 (e.g. Anthropic + HEIC).
    """
    active = provider or resolve_active_provider()
    resolved = resolve_provider(active)

    try:
        raw = await _dispatch(active, resolved, image_base64, mime_type)
    except UpstreamError:
        logger.warning("Upstream failure for provider=%s model=%s", active, resolved["model"])
        raise

    try:
        meal = _normalize_vision(raw)
    except Exception as exc:  # noqa: BLE001 - malformed provider output
        logger.warning("Failed to normalize provider output for provider=%s", active)
        raise UpstreamError("AI provider returned an unexpected response.") from exc

    # Grounding is best-effort and must never fail the whole request.
    try:
        grounded_items = await _ground_items(meal.items)
    except Exception:  # noqa: BLE001 - degrade to vision numbers
        logger.warning("DB grounding failed; degrading to vision numbers.")
        grounded_items = meal.items

    finalized = _finalize(meal, grounded_items)

    return AnalyzeFoodResponse(
        **finalized.model_dump(),
        provider=active,
        model=resolved["model"],
    )


async def parse_text(
    text: str,
    *,
    provider: Provider | None = None,
) -> AnalyzeFoodResponse:
    """Parse a free-text meal description into the same MealAnalysis contract.

    Reuses the exact normalization + USDA grounding + totals logic the image
    flow uses; only the provider call differs (text in, not an image).

    Raises:
        ConfigError: provider not configured (-> 503 in the HTTP layer).
        UpstreamError: provider/network/parse failure (-> 502).
    """
    active = provider or resolve_active_provider()
    resolved = resolve_provider(active)

    try:
        raw = await _dispatch_text(active, resolved, text)
    except UpstreamError:
        logger.warning("Upstream failure for provider=%s model=%s", active, resolved["model"])
        raise

    try:
        meal = _normalize_vision(raw)
    except Exception as exc:  # noqa: BLE001 - malformed provider output
        logger.warning("Failed to normalize provider output for provider=%s", active)
        raise UpstreamError("AI provider returned an unexpected response.") from exc

    # Grounding is best-effort and must never fail the whole request.
    try:
        grounded_items = await _ground_items(meal.items)
    except Exception:  # noqa: BLE001 - degrade to vision numbers
        logger.warning("DB grounding failed; degrading to text numbers.")
        grounded_items = meal.items

    finalized = _finalize(meal, grounded_items)

    return AnalyzeFoodResponse(
        **finalized.model_dump(),
        provider=active,
        model=resolved["model"],
    )
