import uuid
from fastapi import FastAPI, Request
from app.bootstrap import bootstrap_all
from app.routers.upload import router as upload_router
from app.routers.admin_upload import router as admin_upload_router
app = FastAPI(title="MetryxOne Bulk Upload", version="3.0")


# Ops 2.5 (Operational Readiness) — correlation-id propagation. Reads the x-request-id /
# x-correlation-id injected by the Node API proxy so a request can be traced Node→FastAPI,
# and echoes it back on the response. Generates one if absent. Read-only / non-breaking.
@app.middleware("http")
async def correlation_id_mw(request: Request, call_next):
    rid = (
        request.headers.get("x-request-id")
        or request.headers.get("x-correlation-id")
        or f"fastapi_{uuid.uuid4().hex[:12]}"
    )
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


@app.on_event("startup")
def on_startup():
    bootstrap_all()

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(admin_upload_router)
# app.include_router(upload_router)
