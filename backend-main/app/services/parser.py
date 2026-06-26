from __future__ import annotations

import io
import os

import pandas as pd
from fastapi import HTTPException, status

# ─────────────────────────────────────────────────────────────────────────────
# Upload hardening (finding #14 — File Upload Security).
#
# The Express proxy caps body size, but this FastAPI service is reachable
# directly on its own published port, so it MUST enforce its own filename and
# size validation rather than trust an upstream proxy that may be bypassed.
# ─────────────────────────────────────────────────────────────────────────────

_DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_EXTENSIONS = (".csv", ".xlsx", ".xls")


def _max_upload_bytes() -> int:
    raw = os.getenv("MAX_UPLOAD_BYTES")
    if raw:
        try:
            v = int(raw)
            if v > 0:
                return v
        except ValueError:
            pass
    return _DEFAULT_MAX_UPLOAD_BYTES


def _safe_filename(raw_name: str | None) -> str:
    """
    Reject path-traversal / NUL-byte filenames and collapse to a bare basename.

    The filename is persisted (BulkUploadJob.filename) and used to choose the
    parser, so it must never carry directory components or control characters.
    Only an explicit whitelist of spreadsheet extensions is accepted.
    """
    name = (raw_name or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A filename is required.",
        )
    if "\x00" in name or any(ord(c) < 32 for c in name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    # Collapse any path the client may have sent; reject if it still differs
    # (i.e. the original carried directory components or traversal sequences).
    base = os.path.basename(name.replace("\\", "/"))
    if base != name or base in ("", ".", ".."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename (path components are not allowed).",
        )
    if not base.lower().endswith(_ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: .csv, .xlsx, .xls",
        )
    return base


def _read_capped(file, max_bytes: int) -> bytes:
    """Read the upload stream into memory, refusing anything over the cap."""
    f = file.file
    try:
        f.seek(0)
    except Exception:
        pass

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = f.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds the maximum allowed size of {max_bytes} bytes.",
            )
        chunks.append(chunk)

    try:
        f.seek(0)
    except Exception:
        pass
    return b"".join(chunks)


def parse_upload(file, sheet_name: str | None = None) -> pd.DataFrame:
    """
    Read CSV/XLSX -> DataFrame after validating the filename and size.
    Keep everything as string first to avoid dtype surprises.
    """
    fname = _safe_filename(getattr(file, "filename", None))
    data = _read_capped(file, _max_upload_bytes())
    buf = io.BytesIO(data)

    if fname.lower().endswith(".csv"):
        return pd.read_csv(
            buf,
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
        )

    # Excel (.xlsx / .xls)
    if sheet_name:
        return pd.read_excel(buf, sheet_name=sheet_name, dtype=str)
    return pd.read_excel(buf, dtype=str)
