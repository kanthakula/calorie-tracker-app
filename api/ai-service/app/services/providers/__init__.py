"""Per-provider analysis implementations.

Each module exposes::

    async def analyze(*, resolved, image_base64, mime_type) -> dict

returning the provider's raw JSON dict (unnormalized). Normalization/clamping
happens in app.services.analysis.
"""
