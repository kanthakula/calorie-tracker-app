"""POST /analyze-food — the food-image analysis contract."""

from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas import AnalyzeFoodRequest, AnalyzeFoodResponse, AnalyzeTextRequest
from ..security import require_internal_token
from ..services.analysis import analyze_food, parse_text

router = APIRouter(tags=["analyze"])

MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4MB decoded
MAX_TEXT_LEN = 500  # characters, after trimming


def _decoded_size(b64: str) -> int:
    """Decoded byte length of a base64 string without fully materializing it."""
    s = b64.strip()
    length = len(s)
    if length == 0:
        return 0
    padding = 2 if s.endswith("==") else 1 if s.endswith("=") else 0
    return (length * 3) // 4 - padding


@router.post(
    "/analyze-food",
    response_model=AnalyzeFoodResponse,
    dependencies=[Depends(require_internal_token)],
    summary="Analyze a food image and return structured nutrition.",
)
async def analyze_food_endpoint(payload: AnalyzeFoodRequest) -> AnalyzeFoodResponse:
    # Enforce the 4MB decoded-image limit before doing any provider work.
    if _decoded_size(payload.imageBase64) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is too large. Please use an image under 4MB.",
        )

    # Validate the base64 is actually decodable (cheap guard for bad input).
    try:
        base64.b64decode(payload.imageBase64, validate=True)
    except (ValueError, base64.binascii.Error):  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="imageBase64 is not valid base64.",
        )

    return await analyze_food(payload.imageBase64, payload.mimeType)


@router.post(
    "/parse-text",
    response_model=AnalyzeFoodResponse,
    dependencies=[Depends(require_internal_token)],
    summary="Parse a free-text meal description into structured nutrition.",
)
async def parse_text_endpoint(payload: AnalyzeTextRequest) -> AnalyzeFoodResponse:
    text = payload.text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="text must not be empty.",
        )
    if len(text) > MAX_TEXT_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"text is too long. Please keep it under {MAX_TEXT_LEN} characters.",
        )

    return await parse_text(text)
