"""GET /barcode/{code} — resolve a UPC/EAN barcode to product + nutrition.

Backed by Open Food Facts (no API key needed). Guarded by the internal token,
like every non-health endpoint. Returns HTTP 200 with ``found=false, item=null``
when the product is unknown; 400 when the code is not 6-14 digits.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..integrations.barcode import lookup_barcode
from ..schemas import BarcodeProduct
from ..security import require_internal_token

router = APIRouter(
    prefix="/barcode",
    tags=["barcode"],
    dependencies=[Depends(require_internal_token)],
)


@router.get(
    "/{code}",
    response_model=BarcodeProduct,
    summary="Look up a product by barcode (Open Food Facts).",
    description=(
        "Resolve a UPC/EAN barcode to product + nutrition via Open Food Facts. "
        "Returns found=false with item=null when the product is unknown."
    ),
)
async def get_barcode(code: str) -> BarcodeProduct:
    normalized = (code or "").strip()
    if not (normalized.isdigit() and 6 <= len(normalized) <= 14):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode must be 6 to 14 digits.",
        )
    return await lookup_barcode(normalized)
