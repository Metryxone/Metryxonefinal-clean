from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import DEFAULT_MODULE_CODE
from app.models import QuestionBank
from app.uploads.mappers.common import apply_aliases, to_bool, to_int
from app.uploads.mappers.alias_maps import QUESTION_BANK_ALIASES


class QuestionBankHandler:
    upload_type = "question_bank"

    def normalize(self, raw, *, defaults):
        row = apply_aliases(raw, QUESTION_BANK_ALIASES)

        # module_code
        if not row.get("module_code"):
            row["module_code"] = (defaults.get("module_code") or DEFAULT_MODULE_CODE).strip()

        # Normalize enums
        if row.get("question_type"):
            row["question_type"] = str(row["question_type"]).strip().upper()

        if row.get("status"):
            row["status"] = str(row["status"]).strip().upper()

        # version
        row["version"] = to_int(row.get("version")) or 1

        # is_active derived from status if missing
        if row.get("is_active") is None:
            if row.get("status"):
                row["is_active"] = row["status"] == "ACTIVE"
            else:
                row["is_active"] = True
        else:
            b = to_bool(row.get("is_active"))
            row["is_active"] = True if b is None else b

        return row

    def validate(self, row):
        required = ["module_code", "question_code", "question_text", "question_type"]
        missing = [k for k in required if not row.get(k)]
        if missing:
            return False, f"Missing required field(s): {', '.join(missing)}"
        return True, None

    def upsert(self, db: Session, row):
        qcode = row["question_code"]

        existing = db.execute(
            select(QuestionBank).where(QuestionBank.question_code == qcode)
        ).scalar_one_or_none()

        known = {
            "module_code","question_code","question_text","question_type",
            "difficulty","bloom_level","status","version","is_active",
            "domain_code","domain_name","subdomain_code","subdomain_name",
            "age_band_code","keying","anchor","passage_text","explanation",
        }
        data = {k: v for k, v in row.items() if k in known}
        extra = {k: v for k, v in row.items() if k not in known}

        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.extra = {**(existing.extra or {}), **extra}
            return "UPDATED"

        db.add(QuestionBank(**data, extra=extra))
        return "CREATED"
