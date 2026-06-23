"""Pydantic models. The MealAnalysis / item shapes are a hard contract shared
with the Node API (validated with Zod) and the frontend — do not change field
names or bounds without updating every consumer.

Field-name precision matters: ``quantityG`` is camelCase, while the macro
fields ``protein_g`` / ``carbs_g`` / ``fat_g`` are snake_case. Keep both exact.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Provider = Literal["gemini", "openai", "anthropic", "kimi"]
Confidence = Literal["low", "medium", "high"]
ItemSource = Literal["vision", "usda", "openfoodfacts", "barcode", "manual"]
MimeType = Literal[
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
]


# ---------------------------------------------------------------------------
# Analyze food
# ---------------------------------------------------------------------------


class AnalyzeFoodRequest(BaseModel):
    imageBase64: str = Field(..., min_length=1)
    mimeType: MimeType


class AnalyzeTextRequest(BaseModel):
    """Free-text meal description to parse into the MealAnalysis contract.

    Bounds (non-empty, length <= 500) are enforced in the route so the failure
    is a 400 with a clear message rather than a 422 validation envelope.
    """

    text: str


class FoodItemAnalysis(BaseModel):
    """One detected food item, normalized/clamped to the contract bounds."""

    name: str = Field(..., min_length=1, max_length=120)
    quantityG: float = Field(..., ge=0, le=5000)
    calories: int = Field(..., ge=0, le=10000)
    protein_g: int = Field(..., ge=0, le=1000)
    carbs_g: int = Field(..., ge=0, le=1000)
    fat_g: int = Field(..., ge=0, le=1000)
    confidence: Confidence
    source: ItemSource
    ref: str | None = None


class NutritionTotal(BaseModel):
    """Sum of all item nutrition values."""

    calories: int = Field(..., ge=0, le=10000)
    protein_g: int = Field(..., ge=0, le=1000)
    carbs_g: int = Field(..., ge=0, le=1000)
    fat_g: int = Field(..., ge=0, le=1000)


class MealAnalysis(BaseModel):
    """The normalized/clamped multi-item analysis returned for every provider."""

    items: list[FoodItemAnalysis]
    total: NutritionTotal
    healthiness_rating: int = Field(..., ge=1, le=5)
    confidence: Confidence
    notes: str = Field(..., max_length=600)


class AnalyzeFoodResponse(MealAnalysis):
    """MealAnalysis plus the provider/model that produced it."""

    provider: Provider
    model: str


# ---------------------------------------------------------------------------
# Barcode
# ---------------------------------------------------------------------------


class BarcodeProduct(BaseModel):
    """Open Food Facts product lookup result."""

    found: bool
    barcode: str
    name: str = Field(..., min_length=1, max_length=200)
    brand: str | None = None
    serving: str | None = None
    item: FoodItemAnalysis | None = None


# ---------------------------------------------------------------------------
# Admin config
# ---------------------------------------------------------------------------


class ProviderStatus(BaseModel):
    """Masked, per-provider status. Never contains a key value."""

    id: Provider
    model: str
    defaultModel: str
    hasKey: bool
    keySource: Literal["ui", "env", "none"]


class AdminConfig(BaseModel):
    """Masked config returned by GET /admin/config."""

    activeProvider: Provider
    providers: list[ProviderStatus]
    kimiBaseURL: str


class UpdateAdminConfig(BaseModel):
    """Partial admin update. A key value of null clears that provider's key."""

    provider: Provider | None = None
    models: dict[str, str] | None = None
    keys: dict[str, str | None] | None = None
    kimiBaseURL: str | None = None


class AdminTestResponse(BaseModel):
    ok: Literal[True] = True
    provider: Provider
    model: str
    sample: AnalyzeFoodResponse
