from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Any
from sqlalchemy.orm import Session

@dataclass
class RowResult:
    status: str                 # OK/ERROR
    error: str | None
    action: str | None          # CREATED/UPDATED/None
    normalized: dict[str, Any]

class UploadHandler(Protocol):
    upload_type: str
    def normalize(self, raw: dict[str, Any], *, defaults: dict[str, Any]) -> dict[str, Any]: ...
    def validate(self, row: dict[str, Any]) -> tuple[bool, str | None]: ...
    def upsert(self, db: Session, row: dict[str, Any]) -> str: ...

def process_rows(
    db: Session,
    handler: UploadHandler,
    rows: list[dict[str, Any]],
    *,
    defaults: dict[str, Any],
):
    errors = 0
    actions = {"CREATED": 0, "UPDATED": 0}
    results: list[RowResult] = []

    for _, raw in enumerate(rows, start=1):
        try:
            row = handler.normalize(raw, defaults=defaults)
            ok, msg = handler.validate(row)
            if not ok:
                errors += 1
                results.append(RowResult("ERROR", msg, None, row))
                continue

            with db.begin_nested():  # per-row savepoint
                action = handler.upsert(db, row)

            actions[action] += 1
            results.append(RowResult("OK", None, action, row))

        except Exception as ex:
            errors += 1
            results.append(RowResult("ERROR", f"{type(ex).__name__}: {ex}", None, raw))

    return results, errors, actions
