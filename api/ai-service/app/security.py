"""Internal-token auth. Every non-health endpoint requires the shared secret
that the Node API (the only public gateway) sends as ``x-internal-token``.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from .config import get_internal_token


async def require_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """FastAPI dependency: 401 unless the header matches AI_INTERNAL_TOKEN."""
    expected = get_internal_token()
    provided = x_internal_token or ""
    # Constant-time comparison to avoid leaking timing information.
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal token.",
        )
