from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import QuestionBank, QuestionOption, TaskVariant

def split_known_extra(row: dict, known: set[str]):
    known_data, extra = {}, {}
    for k, v in row.items():
        if k in known:
            known_data[k] = v
        else:
            extra[k] = v
    return known_data, extra

def upsert_question_bank(db: Session, row: dict) -> str:
    known = {
        "module_code","question_code","question_text","question_type",
        "domain_code","subdomain_code","difficulty","age_band",
        "is_active","version"
    }
    data, extra = split_known_extra(row, known)

    existing = db.execute(
        select(QuestionBank).where(QuestionBank.question_code == data["question_code"])
    ).scalar_one_or_none()

    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        existing.extra = {**(existing.extra or {}), **extra}
        return "UPDATED"

    db.add(QuestionBank(**data, extra=extra))
    return "CREATED"

def upsert_question_option(db: Session, row: dict) -> str:
    """
    Upsert by (question_code, option_code). Prevents duplicates on repeated uploads.
    """
    known = {"question_code","option_code","option_text","is_correct","option_score","sort_order"}
    data, extra = split_known_extra(row, known)

    existing = db.execute(
        select(QuestionOption).where(
            (QuestionOption.question_code == data["question_code"]) &
            (QuestionOption.option_code == data["option_code"])
        )
    ).scalar_one_or_none()

    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        existing.extra = {**(existing.extra or {}), **extra}
        return "UPDATED"

    db.add(QuestionOption(**data, extra=extra))
    return "CREATED"

def upsert_task_variant(db: Session, row: dict) -> str:
    known = {"variant_id","instruction_text","primary_target","distractors","age_band","selectivity","target","module_code"}
    data, extra = split_known_extra(row, known)

    existing = db.execute(
        select(TaskVariant).where(TaskVariant.variant_id == data["variant_id"])
    ).scalar_one_or_none()

    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        existing.extra = {**(existing.extra or {}), **extra}
        return "UPDATED"

    db.add(TaskVariant(**data, extra=extra))
    return "CREATED"
