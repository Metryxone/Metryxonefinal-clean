from fastapi import FastAPI
from app.bootstrap import bootstrap_all
from app.routers.upload import router as upload_router
from app.routers.admin_upload import router as admin_upload_router
from app.routers.llm_proxy import router as llm_proxy_router
app = FastAPI(title="MetryxOne Bulk Upload", version="3.0")

@app.on_event("startup")
def on_startup():
    bootstrap_all()

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(admin_upload_router)
app.include_router(llm_proxy_router)
# app.include_router(upload_router)
