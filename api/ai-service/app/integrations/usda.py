"""USDA FoodData Central (FDC) nutrition-database integration.

API key from env ``USDA_FDC_API_KEY``. Used to GROUND vision-estimated food
items against verified per-100g nutrient data. All calls are best-effort and
bounded by a short timeout; any failure (or a missing key) means the caller
keeps the vision numbers.

HARD RULE: the API key is never logged or returned to any caller.
"""

from __future__ import annotations

import logging
import os

import httpx
from pydantic import BaseModel

logger = logging.getLogger("ai-service.usda")

DEFAULT_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

# Short per-request timeout so grounding never blocks the analysis for long.
DEFAULT_TIMEOUT_SECONDS = 6.0

# USDA FDC nutrient numbers (the "nutrientNumber" field, a string).
_NUTRIENT_ENERGY_KCAL = "1008"
_NUTRIENT_PROTEIN = "1003"
_NUTRIENT_CARBS = "1005"
_NUTRIENT_FAT = "1004"


def base_url() -> str:
    return (os.environ.get("USDA_FDC_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def api_key() -> str | None:
    """The USDA FDC API key, or None if not configured (never logged)."""
    value = os.environ.get("USDA_FDC_API_KEY")
    return value.strip() if value and value.strip() else None


def _timeout_seconds() -> float:
    raw = os.environ.get("USDA_FDC_TIMEOUT_SECONDS")
    if raw:
        try:
            return max(1.0, float(raw))
        except ValueError:
            pass
    return DEFAULT_TIMEOUT_SECONDS


class FoodSearchResult(BaseModel):
    """A single food hit from USDA FoodData Central, with per-100g nutrients."""

    fdc_id: int
    description: str
    brand: str | None = None
    calories_per_100g: float | None = None
    protein_g_per_100g: float | None = None
    carbs_g_per_100g: float | None = None
    fat_g_per_100g: float | None = None
    source: str = "usda_fdc"


def _extract_nutrients(food: dict) -> dict[str, float | None]:
    """Pull per-100g energy/macros from a /foods/search food entry.

    USDA search results report ``foodNutrients`` per 100g (the standard basis).
    """
    out: dict[str, float | None] = {
        "calories_per_100g": None,
        "protein_g_per_100g": None,
        "carbs_g_per_100g": None,
        "fat_g_per_100g": None,
    }
    for nut in food.get("foodNutrients") or []:
        if not isinstance(nut, dict):
            continue
        number = str(nut.get("nutrientNumber") or "")
        value = nut.get("value")
        if value is None:
            continue
        try:
            num = float(value)
        except (TypeError, ValueError):
            continue
        if number == _NUTRIENT_ENERGY_KCAL:
            out["calories_per_100g"] = num
        elif number == _NUTRIENT_PROTEIN:
            out["protein_g_per_100g"] = num
        elif number == _NUTRIENT_CARBS:
            out["carbs_g_per_100g"] = num
        elif number == _NUTRIENT_FAT:
            out["fat_g_per_100g"] = num
    return out


async def search_best_match(query: str) -> FoodSearchResult | None:
    """Search FDC for ``query`` and return the best match with per-100g nutrients.

    Returns None when there is no API key, no result, or any error occurs. Never
    raises — grounding must degrade gracefully to the vision numbers.
    """
    key = api_key()
    if not key:
        return None

    name = (query or "").strip()
    if not name:
        return None

    params = {
        "api_key": key,
        "query": name,
        "pageSize": 1,
        "requireAllWords": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=_timeout_seconds()) as client:
            resp = await client.get(f"{base_url()}/foods/search", params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:  # noqa: BLE001 - any failure -> skip grounding (no key leak)
        logger.warning("USDA search failed; skipping grounding for this item.")
        return None

    foods = data.get("foods") if isinstance(data, dict) else None
    if not foods:
        return None
    food = foods[0]
    if not isinstance(food, dict):
        return None

    nutrients = _extract_nutrients(food)
    return FoodSearchResult(
        fdc_id=int(food.get("fdcId") or 0),
        description=str(food.get("description") or name)[:200],
        brand=(str(food.get("brandOwner")) if food.get("brandOwner") else None),
        **nutrients,
    )


async def search_foods(query: str) -> list[FoodSearchResult]:
    """Public search used by the /nutrition/search router.

    Returns a (possibly empty) list of matches. Raises NotImplementedError-free:
    when no key is configured it simply returns an empty list.
    """
    match = await search_best_match(query)
    return [match] if match else []
