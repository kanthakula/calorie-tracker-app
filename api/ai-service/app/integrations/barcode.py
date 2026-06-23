"""Barcode -> product lookup via Open Food Facts.

Resolves a UPC/EAN barcode to the :class:`BarcodeProduct` contract shape that
the Node API consumes. Computes a single ``FoodItemAnalysis`` for the product,
preferring per-serving nutrition and falling back to per-100g.
"""

from __future__ import annotations

from ..schemas import BarcodeProduct, FoodItemAnalysis
from .open_food_facts import ProductInfo, fetch_product

__all__ = ["lookup_barcode"]


def _clamp_int(value: float | None, *, lo: int, hi: int, default: int = 0) -> int:
    if value is None:
        return default
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _clamp_float(value: float | None, *, lo: float, hi: float, default: float) -> float:
    if value is None:
        return default
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _build_item(info: ProductInfo) -> FoodItemAnalysis:
    """Build the product's nutrition item, preferring per-serving values."""
    name = (info.name or "Unknown product").strip()[:120] or "Unknown product"

    has_serving = info.serving_quantity_g is not None and (
        info.calories_serving is not None
        or info.protein_g_serving is not None
        or info.carbs_g_serving is not None
        or info.fat_g_serving is not None
    )

    if has_serving:
        quantity = _clamp_float(
            info.serving_quantity_g, lo=0.0, hi=5000.0, default=100.0
        )
        calories = _clamp_int(info.calories_serving, lo=0, hi=10000)
        protein = _clamp_int(info.protein_g_serving, lo=0, hi=1000)
        carbs = _clamp_int(info.carbs_g_serving, lo=0, hi=1000)
        fat = _clamp_int(info.fat_g_serving, lo=0, hi=1000)
    else:
        quantity = 100.0
        calories = _clamp_int(info.calories_per_100g, lo=0, hi=10000)
        protein = _clamp_int(info.protein_g_per_100g, lo=0, hi=1000)
        carbs = _clamp_int(info.carbs_g_per_100g, lo=0, hi=1000)
        fat = _clamp_int(info.fat_g_per_100g, lo=0, hi=1000)

    return FoodItemAnalysis(
        name=name,
        quantityG=quantity,
        calories=calories,
        protein_g=protein,
        carbs_g=carbs,
        fat_g=fat,
        confidence="high",
        source="barcode",
        ref=info.code,
    )


async def lookup_barcode(code: str) -> BarcodeProduct:
    """Resolve a barcode to a :class:`BarcodeProduct`.

    Always returns a BarcodeProduct: ``found=False, item=None`` when the product
    is unknown. The caller (router) is responsible for validating the code.
    """
    info = await fetch_product(code)
    if info is None:
        return BarcodeProduct(
            found=False,
            barcode=code,
            name="Unknown product",
            item=None,
        )

    return BarcodeProduct(
        found=True,
        barcode=code,
        name=(info.name or "Unknown product").strip()[:200] or "Unknown product",
        brand=info.brand,
        serving=info.serving,
        item=_build_item(info),
    )
