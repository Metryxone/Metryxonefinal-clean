from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import QuestionOption
from app.uploads.mappers.common import apply_aliases, to_bool, to_int
from app.uploads.mappers.alias_maps import QUESTION_OPTIONS_ALIASES


class QuestionOptionsHandler:
    upload_type = "question_options"

    def normalize(self, raw, *, defaults):
        row = apply_aliases(raw, QUESTION_OPTIONS_ALIASES)

        b = to_bool(row.get("is_correct"))
        row["is_correct"] = False if b is None else b

        so = to_int(row.get("sort_order"))
        row["sort_order"] = so or 1

        # option_score can remain string; model uses Numeric (psycopg converts)
        return row

    def validate(self, row):
        required = ["question_code", "option_code"]
        missing = [k for k in required if not row.get(k)]
        if missing:
            return False, f"Missing required field(s): {', '.join(missing)}"
        return True, None

    def upsert(self, db: Session, row):
        qcode = row["question_code"]
        ocode = row["option_code"]

        existing = db.execute(
            select(QuestionOption).where(
                (QuestionOption.question_code == qcode) &
                (QuestionOption.option_code == ocode)
            )
        ).scalar_one_or_none()

        known = {"question_code","option_code","option_text","option_score","is_correct","sort_order"}
        data = {k: v for k, v in row.items() if k in known}
        extra = {k: v for k, v in row.items() if k not in known}

        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.extra = {**(existing.extra or {}), **extra}
            return "UPDATED"

        db.add(QuestionOption(**data, extra=extra))
        return "CREATED"
