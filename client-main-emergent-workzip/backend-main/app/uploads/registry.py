from __future__ import annotations

from app.uploads.handlers.question_bank import QuestionBankHandler
from app.uploads.handlers.question_options import QuestionOptionsHandler
from app.uploads.handlers.task_variants import TaskVariantsHandler

_HANDLERS = {
    "question_bank": QuestionBankHandler(),
    "question_options": QuestionOptionsHandler(),
    "task_variants": TaskVariantsHandler(),
}

def get_handler(upload_type: str):
    h = _HANDLERS.get(upload_type)
    if not h:
        raise ValueError(f"Invalid upload_type: {upload_type}")
    return h
