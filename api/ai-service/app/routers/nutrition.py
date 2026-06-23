"""GET /nutrition/search — full-text search against USDA FoodData Central.

Guarded by the internal token. Returns an empty list when no USDA API key is
configured (grounding/search simply degrades rather than erroring).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..integrations.usda import FoodSearchResult, search_foods
from ..security import require_internal_token

router = APIRouter(
    prefix="/nutrition",
    tags=["nutrition"],
    dependencies=[Depends(require_internal_token)],
)


@router.get(
    "/search",
    response_model=list[FoodSearchResult],
    summary="Search foods in the USDA nutrition database.",
    description=(
        "Full-text search against USDA FoodData Central. Returns an empty list "
        "when no USDA_FDC_API_KEY is configured."
    ),
)
async def search(
    q: str = Query(..., min_length=1, description="Search query."),
) -> list[FoodSearchResult]:
    return await search_foods(q)
