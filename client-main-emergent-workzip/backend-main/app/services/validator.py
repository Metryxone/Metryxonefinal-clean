from __future__ import annotations
from typing import Iterable

ALLOWED_UPLOAD_TYPES = {"question_bank", "question_options", "task_variants"}

def validate_upload_type(upload_type: str):
    if upload_type not in ALLOWED_UPLOAD_TYPES:
        return False, f"Invalid upload_type. Allowed: {sorted(ALLOWED_UPLOAD_TYPES)}"
    return True, None

def _missing_fields(row: dict, required: Iterable[str]) -> list[str]:
    missing = []
    for r in required:
        v = row.get(r)
        if v is None:
            missing.append(r)
            continue
        if isinstance(v, str) and v.strip() == "":
            missing.append(r)
    return missing

def validate_question_bank(row: dict):
    required = ["module_code", "question_code", "question_text", "question_type"]
    missing = _missing_fields(row, required)
    if missing:
        return False, f"Missing required field(s): {', '.join(missing)}"
    return True, None

def validate_question_options(row: dict):
    required = ["question_code", "option_code"]
    missing = _missing_fields(row, required)
    if missing:
        return False, f"Missing required field(s): {', '.join(missing)}"
    return True, None

def validate_task_variants(row: dict):
    required = ["variant_id", "instruction_text"]
    missing = _missing_fields(row, required)
    if missing:
        return False, f"Missing required field(s): {', '.join(missing)}"
    return True, None
