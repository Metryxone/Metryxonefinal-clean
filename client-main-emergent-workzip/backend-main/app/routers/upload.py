from __future__ import annotations

from typing import Any

from fastapi import APIRouter, UploadFile, File, Form, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.db import get_db
from app.bootstrap import bootstrap_all
from app.services.parser import parse_upload
from app.services.validator import (
    validate_upload_type,
    validate_question_bank,
    validate_question_options,
    validate_task_variants,
)
from app.services.inserter import (
    upsert_question_bank,
    upsert_question_option,
    upsert_task_variant,
)
from app.models import BulkUploadJob, BulkUploadRow

templates = Jinja2Templates(directory="app/templates")
router = APIRouter(prefix="/admin", tags=["admin"])

_ALIAS_MAP: dict[str, dict[str, str]] = {
    "question_bank": {
        "modulecode": "module_code",
        "questioncode": "question_code",
        "questiontext": "question_text",
        "questiontype": "question_type",
        "domaincode": "domain_code",
        "subdomaincode": "subdomain_code",
        "agebandcode": "age_band",
        "ageband": "age_band",
    },
    "question_options": {
        "questioncode": "question_code",
        "optioncode": "option_code",
        "optiontext": "option_text",
        "optionscore": "option_score",
        "iscorrect": "is_correct",
        "sortorder": "sort_order",
    },
    "task_variants": {
        "variantid": "variant_id",
        "instruction": "instruction_text",
        "instructiontext": "instruction_text",
        "primarytarget": "primary_target",
        "ageband": "age_band",
        "modulecode": "module_code",
    },
}

def _norm_key(k: Any) -> str:
    s = str(k or "").strip()
    s = s.replace(" ", "").replace("-", "").replace("/", "")
    return s.lower()

def _to_bool(v: Any) -> bool | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in {"", "none", "null"}:
        return None
    if s in {"1", "true", "yes", "y", "active"}:
        return True
    if s in {"0", "false", "no", "n", "inactive"}:
        return False
    return None

def _to_int(v: Any) -> int | None:
    if v is None:
        return None
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if s == "":
        return None
    try:
        return int(float(s))
    except Exception:
        return None

def normalize_row(upload_type: str, row: dict) -> dict:
    aliases = _ALIAS_MAP.get(upload_type, {})
    out: dict[str, Any] = {}

    for k, v in row.items():
        nk = _norm_key(k)
        target = aliases.get(nk)
        if not target:
            target = str(k).strip().replace(" ", "_").replace("-", "_").lower()
        out[target] = v

    for k, v in list(out.items()):
        if isinstance(v, str):
            vv = v.strip()
            out[k] = vv if vv != "" else None

    if "is_active" in out:
        out["is_active"] = _to_bool(out["is_active"])
    if "is_correct" in out:
        out["is_correct"] = _to_bool(out["is_correct"]) or False
    if "version" in out:
        out["version"] = _to_int(out["version"])
    if "option_score" in out:
        out["option_score"] = _to_int(out["option_score"])
    if "sort_order" in out:
        out["sort_order"] = _to_int(out["sort_order"]) or 1

    return out

@router.post("/bootstrap")
def bootstrap():
    bootstrap_all()
    return {"status": "ok"}

@router.get("/upload", response_class=HTMLResponse)
def upload_page(request: Request):
    return templates.TemplateResponse("upload.html", {"request": request})

@router.post("/upload")
async def upload(
    upload_type: str = Form(...),
    sheet_name: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ok, err = validate_upload_type(upload_type)
    if not ok:
        return {"status": "error", "message": err}

    df = parse_upload(file, sheet_name=sheet_name if sheet_name else None)
    df = df.fillna("")

    job = BulkUploadJob(
        upload_type=upload_type,
        filename=file.filename or "",
        status="RECEIVED",
        extra={"sheet_name": sheet_name, "rows_detected": int(len(df))},
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    errors = 0
    actions = {"CREATED": 0, "UPDATED": 0}

    for i, raw_row in enumerate(df.to_dict(orient="records"), start=1):
        raw_row = {str(k).strip(): v for k, v in raw_row.items()}
        row = normalize_row(upload_type, raw_row)

        status, err_msg = "OK", None

        try:
            with db.begin_nested():
                if upload_type == "question_bank":
                    valid, err_msg = validate_question_bank(row)
                    if valid:
                        action = upsert_question_bank(db, row)
                        actions[action] += 1

                elif upload_type == "question_options":
                    valid, err_msg = validate_question_options(row)
                    if valid:
                        action = upsert_question_option(db, row)
                        actions[action] += 1

                else:
                    valid, err_msg = validate_task_variants(row)
                    if valid:
                        action = upsert_task_variant(db, row)
                        actions[action] += 1

                if not valid:
                    status = "ERROR"
                    errors += 1

        except Exception as ex:
            status = "ERROR"
            errors += 1
            err_msg = f"{type(ex).__name__}: {ex}"

        db.add(BulkUploadRow(job_id=job.id, row_num=i, status=status, error=err_msg, raw=row))

    job.status = "COMMITTED" if errors == 0 else "VALIDATED"
    job.error_count = errors
    job.meta = {**(job.meta or {}), "actions": actions}

    db.commit()

    return {"status": "ok", "job_id": job.id, "rows": int(len(df)), "errors": errors, "actions": actions}
