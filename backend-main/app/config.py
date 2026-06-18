import os
from dotenv import load_dotenv
from sqlalchemy.engine import URL

load_dotenv()

def build_db_url() -> str:
    """
    Resolution order:
      1) DATABASE_URL (full SQLAlchemy URL)
      2) DB_* parts (host/port/name/user/password)
    """
    direct = os.getenv("DATABASE_URL")
    if direct:
        return direct

    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "5432"))
    name = os.getenv("DB_NAME", "metryxone")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "root123")

    query = {}
    sslmode = os.getenv("DB_SSLMODE")
    if sslmode:
        query["sslmode"] = sslmode

    url = "postgresql://{user}:{password}@{host}:{port}/{name}".format(
        user=user,
        password=password,
        host=host,
        port=port,
        name=name,
    )
    if query:
        url += "?" + "&".join([f"{k}={v}" for k, v in query.items()])
    return str(url)

DATABASE_URL = build_db_url()
ADMIN_DB_NAME = os.getenv("DB_ADMIN_NAME", "postgres")
DEFAULT_MODULE_CODE = os.getenv("DEFAULT_MODULE_CODE", "EXAM_READY")