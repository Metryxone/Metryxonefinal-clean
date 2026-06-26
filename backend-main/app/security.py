from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException, status

# ─────────────────────────────────────────────────────────────────────────────
# Shared-secret gate for the bulk-upload service.
#
# WHY: this FastAPI service binds to 0.0.0.0:8000 and (per .replit) port 8000 is
# published externally, so its /admin/* bulk-upload endpoints are reachable on
# the public internet WITHOUT passing through the authenticated Express proxy.
# Without this gate that is an unauthenticated admin bulk-upload surface
# (High/Critical).
#
# HOW: every /admin/* request must present `X-Upload-Service-Token` matching the
# server's UPLOAD_SERVICE_TOKEN. The Express reverse-proxy injects this header
# server-side ONLY AFTER it has enforced a super-admin session, so legitimate
# first-party uploads are unchanged while direct public hits are rejected (401).
#
# This is a SECURITY CONTROL, so it defaults ON. Parity with the Node CSRF guard
# (backend/lib/csrf.ts):
#   • dev fallback to a STABLE constant so local dev is byte-identical without
#     extra config (the Express proxy uses the SAME fallback);
#   • production REQUIRES a real secret — if UPLOAD_SERVICE_TOKEN is unset the
#     gate FAILS CLOSED (503) rather than trusting a well-known dev constant;
#   • documented kill-switch UPLOAD_AUTH_DISABLED=1 disables enforcement without
#     a redeploy if it ever blocks legitimate traffic.
# ─────────────────────────────────────────────────────────────────────────────

# Must match the Express proxy's dev fallback (backend/routes.ts).
_DEV_FALLBACK_TOKEN = "dev-only-upload-token-do-not-use-in-production"


def _is_prod() -> bool:
    return (os.getenv("NODE_ENV") or os.getenv("ENV") or "").lower() == "production"


def _expected_token() -> str | None:
    """The token the caller must present, or None when prod is misconfigured."""
    tok = os.getenv("UPLOAD_SERVICE_TOKEN")
    if tok:
        return tok
    if _is_prod():
        # Fail closed: never trust a well-known public default in production.
        return None
    return _DEV_FALLBACK_TOKEN


def require_upload_auth(
    x_upload_service_token: str | None = Header(default=None),
) -> None:
    """FastAPI dependency enforcing the shared-secret on /admin/* endpoints."""
    if os.getenv("UPLOAD_AUTH_DISABLED") == "1":
        return

    expected = _expected_token()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Upload service is not configured for secure access "
                "(UPLOAD_SERVICE_TOKEN is not set)."
            ),
        )

    provided = x_upload_service_token or ""
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid upload service token.",
        )
