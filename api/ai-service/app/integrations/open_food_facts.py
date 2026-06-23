"""Open Food Facts product fetch helper.

Open Food Facts is a free, open product database (no API key needed). The base
URL comes from env ``OPEN_FOOD_FACTS_BASE_URL`` (falls back to the public API).
Used to resolve barcodes to product + nutrition.
"""

from __future__ import annotations

import logging
import os

import httpx
from pydantic import BaseModel

logger = logging.getLogger("ai-service.open_food_facts")

DEFAULT_BASE_URL = "https://world.openfoodfacts.org"

DEFAULT_TIMEOUT_SECONDS = 6.0


def base_url() -> str:
    """Resolve the Open Food Facts base URL (env-overridable)."""
    return (os.environ.get("OPEN_FOOD_FACTS_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def _timeout_seconds() -> float:
    raw = os.environ.get("OPEN_FOOD_FACTS_TIMEOUT_SECONDS")
    if raw:
        try:
            return max(1.0, float(raw))
        except ValueError:
            pass
    return DEFAULT_TIMEOUT_SECONDS


class ProductInfo(BaseModel):
    """Normalized product info from a barcode/product lookup.

    Nutrition is provided both per-serving (when Open Food Facts reports it) and
    per-100g, so the caller can pick the most accurate basis.
    """

    code: str
    name: str | None = None
    brand: str | None = None
    serving: str | None = None
    serving_quantity_g: float | None = None
    # Per-serving nutrition (when available).
    calories_serving: float | None = None
    protein_g_serving: float | None = None
    carbs_g_serving: float | None = None
    fat_g_serving: float | None = None
    # Per-100g nutrition (fallback basis).
    calories_per_100g: float | None = None
    protein_g_per_100g: float | None = None
    carbs_g_per_100g: float | None = None
    fat_g_per_100g: float | None = None
    image_url: str | None = None
    source: str = "open_food_facts"


def _num(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _map_product(code: str, product: dict) -> ProductInfo:
    nutriments = product.get("nutriments") or {}
    name = product.get("product_name") or None
    brand = product.get("brands") or None
    serving = product.get("serving_size") or None

    return ProductInfo(
        code=code,
        name=str(name) if name else None,
        brand=str(brand) if brand else None,
        serving=str(serving) if serving else None,
        serving_quantity_g=_num(product.get("serving_quantity")),
        calories_serving=_num(nutriments.get("energy-kcal_serving")),
        protein_g_serving=_num(nutriments.get("proteins_serving")),
        carbs_g_serving=_num(nutriments.get("carbohydrates_serving")),
        fat_g_serving=_num(nutriments.get("fat_serving")),
        calories_per_100g=_num(nutriments.get("energy-kcal_100g")),
        protein_g_per_100g=_num(nutriments.get("proteins_100g")),
        carbs_g_per_100g=_num(nutriments.get("carbohydrates_100g")),
        fat_g_per_100g=_num(nutriments.get("fat_100g")),
        image_url=(str(product.get("image_url")) if product.get("image_url") else None),
    )


async def fetch_product(code: str) -> ProductInfo | None:
    """Fetch a product by barcode from Open Food Facts.

    Returns None when the product is not found (``status == 0``) or on any error.
    """
    url = f"{base_url()}/api/v2/product/{code}.json"
    try:
        async with httpx.AsyncClient(timeout=_timeout_seconds()) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
    except Exception:  # noqa: BLE001 - treat any failure as "not found"
        logger.warning("Open Food Facts lookup failed for the requested code.")
        return None

    if not isinstance(data, dict):
        return None
    if data.get("status") == 0 or data.get("status") == "0":
        return None
    product = data.get("product")
    if not isinstance(product, dict):
        return None
    return _map_product(code, product)
