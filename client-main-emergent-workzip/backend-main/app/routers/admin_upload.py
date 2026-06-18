from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, Form, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.db import get_db
from app.bootstrap import bootstrap_all
from app.services.parser import parse_upload
from app.uploads.registry import get_handler
from app.uploads.base import process_rows
from app.models import BulkUploadJob, BulkUploadRow

templates = Jinja2Templates(directory="app/templates")
router = APIRouter(prefix="/admin", tags=["admin"])


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
    module_code: str | None = Form(None),
    sheet_name: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    handler = get_handler(upload_type)

    df = parse_upload(file, sheet_name=sheet_name if sheet_name else None)
    df = df.fillna("")
    rows = df.to_dict(orient="records")

    job = BulkUploadJob(
        upload_type=upload_type,
        filename=file.filename or "",
        status="RECEIVED",
        extra={"sheet_name": sheet_name, "rows_detected": int(len(df))},
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    results, errors, actions = process_rows(
        db,
        handler,
        rows,
        defaults={"module_code": module_code},
    )

    for i, rr in enumerate(results, start=1):
        db.add(
            BulkUploadRow(
                job_id=job.id,
                row_num=i,
                status=rr.status,
                error=rr.error,
                raw=rr.normalized if isinstance(rr.normalized, dict) else {"raw": rr.normalized},
            )
        )

    job.status = "COMMITTED" if errors == 0 else "VALIDATED"
    job.error_count = errors
    job.extra = {**(job.extra or {}), "actions": actions}

    db.commit()

    return {
        "status": "ok",
        "job_id": str(job.id),
        "rows": int(len(rows)),
        "errors": errors,
        "actions": actions,
    }
