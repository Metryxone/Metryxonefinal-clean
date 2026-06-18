from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import DEFAULT_MODULE_CODE
from app.models import TaskVariant
from app.uploads.mappers.common import apply_aliases
from app.uploads.mappers.alias_maps import TASK_VARIANTS_ALIASES


class TaskVariantsHandler:
    upload_type = "task_variants"

    def normalize(self, raw, *, defaults):
        row = apply_aliases(raw, TASK_VARIANTS_ALIASES)
        if not row.get("module_code"):
            row["module_code"] = (defaults.get("module_code") or DEFAULT_MODULE_CODE).strip()
        return row

    def validate(self, row):
        required = ["variant_id", "instruction_text"]
        missing = [k for k in required if not row.get(k)]
        if missing:
            return False, f"Missing required field(s): {', '.join(missing)}"
        return True, None

    def upsert(self, db: Session, row):
        vid = row["variant_id"]

        existing = db.execute(
            select(TaskVariant).where(TaskVariant.variant_id == vid)
        ).scalar_one_or_none()

        known = {"variant_id","instruction_text","primary_target","distractors","age_band","selectivity","target","module_code"}
        data = {k: v for k, v in row.items() if k in known}
        extra = {k: v for k, v in row.items() if k not in known}

        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.extra = {**(existing.extra or {}), **extra}
            return "UPDATED"

        db.add(TaskVariant(**data, extra=extra))
        return "CREATED"
