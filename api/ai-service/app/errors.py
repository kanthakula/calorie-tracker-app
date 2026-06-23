"""Custom exception types mapped to HTTP status codes by app.main.

  - ConfigError   -> 503 (the selected provider is not configured; caller-fixable)
  - UpstreamError -> 502 (provider/network failure; generic safe message)
"""

from __future__ import annotations


class ConfigError(Exception):
    """Raised when the selected provider is not configured (e.g. no API key).

    The HTTP layer turns this into a 503 with the message shown to the caller,
    so the message must be safe (never contains a key).
    """


class UpstreamError(Exception):
    """Raised on any provider/network failure.

    The HTTP layer turns this into a 502 with a generic, safe message. The real
    underlying error is logged server-side only — never returned to the caller.
    """
