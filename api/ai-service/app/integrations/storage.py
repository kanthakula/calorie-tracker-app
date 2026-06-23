"""FUTURE: image storage with a pluggable provider switch.

``STORAGE_PROVIDER`` env selects the backend: ``local`` | ``s3`` | ``gcs`` |
``azure``. The local backend is implemented (writes to a folder and returns a
``file://`` URL); cloud backends raise NotImplementedError with TODOs.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Literal

StorageProvider = Literal["local", "s3", "gcs", "azure"]

_MIME_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/gif": ".gif",
}


def storage_provider() -> StorageProvider:
    value = (os.environ.get("STORAGE_PROVIDER") or "local").strip().lower()
    if value in ("local", "s3", "gcs", "azure"):
        return value  # type: ignore[return-value]
    return "local"


def _local_dir() -> Path:
    return Path(os.environ.get("LOCAL_STORAGE_DIR") or "./uploads").resolve()


async def upload_image(
    *,
    data: bytes,
    mime_type: str,
    key: str | None = None,
) -> str:
    """Store an image and return a URL/identifier for it.

    Args:
        data: raw image bytes.
        mime_type: e.g. ``image/jpeg``.
        key: optional object key/filename; a UUID is generated when omitted.

    Returns:
        A URL string referencing the stored object.

    Raises:
        NotImplementedError: for cloud providers (s3/gcs/azure) — see TODOs.
    """
    provider = storage_provider()
    ext = _MIME_EXT.get(mime_type, "")
    object_key = key or f"{uuid.uuid4().hex}{ext}"

    if provider == "local":
        target_dir = _local_dir()
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / object_key
        path.write_bytes(data)
        return path.as_uri()

    if provider == "s3":
        # TODO: use boto3/aioboto3; PutObject to env S3_BUCKET with the mime
        # type; return https://{bucket}.s3.{region}.amazonaws.com/{key} or a
        # presigned URL.
        raise NotImplementedError("S3 storage backend is not implemented yet.")

    if provider == "gcs":
        # TODO: use google-cloud-storage; upload_from_string to env GCS_BUCKET;
        # return the public or signed URL.
        raise NotImplementedError("GCS storage backend is not implemented yet.")

    if provider == "azure":
        # TODO: use azure-storage-blob; upload to env AZURE_STORAGE_CONTAINER;
        # return the blob URL (optionally with a SAS token).
        raise NotImplementedError("Azure storage backend is not implemented yet.")

    raise NotImplementedError(f"Unknown storage provider: {provider}")
