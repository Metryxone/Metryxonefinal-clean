from sqlalchemy import text
from sqlalchemy.engine import create_engine
from app.config import ADMIN_DB_NAME
from app.db import Base, engine

def create_database_if_missing():
    try:
        target_db = engine.url.database
        if not target_db:
            return
        admin_url = engine.url.set(database=ADMIN_DB_NAME)
        admin_engine = create_engine(admin_url, future=True, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname=:d"), {"d": target_db}).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{target_db}"'))
    except Exception:
        return

def bootstrap_tables():
    Base.metadata.create_all(bind=engine)

def bootstrap_all():
    create_database_if_missing()
    bootstrap_tables()
