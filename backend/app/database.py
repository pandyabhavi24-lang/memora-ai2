import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "memora.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db_schema():
    """
    Safely adds missing columns using ALTER TABLE if not already present.
    Also ensures the security_settings singleton row exists.
    """
    import sqlite3
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # --- files table (existing) ---
        cursor.execute("PRAGMA table_info(files);")
        file_cols = [row[1] for row in cursor.fetchall()]
        if file_cols and "smart_tags" not in file_cols:
            cursor.execute("ALTER TABLE files ADD COLUMN smart_tags TEXT;")
            conn.commit()

        # --- organization_suggestions table (existing) ---
        cursor.execute("PRAGMA table_info(organization_suggestions);")
        sug_cols = [row[1] for row in cursor.fetchall()]
        if sug_cols and "smart_tags" not in sug_cols:
            cursor.execute("ALTER TABLE organization_suggestions ADD COLUMN smart_tags TEXT;")
            conn.commit()

        # --- security_settings table (Module 5) ---
        cursor.execute("PRAGMA table_info(security_settings);")
        sec_cols = [row[1] for row in cursor.fetchall()]
        if sec_cols:
            if "pin_iterations" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN pin_iterations INTEGER DEFAULT 260000;")
            if "recovery_email" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN recovery_email TEXT;")
            if "recovery_email_verified" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN recovery_email_verified INTEGER DEFAULT 0;")
            if "reset_code_hash" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN reset_code_hash TEXT;")
            if "reset_code_expires_at" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN reset_code_expires_at TIMESTAMP;")
            if "reset_code_attempts" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN reset_code_attempts INTEGER DEFAULT 0;")
            if "reset_code_used_at" not in sec_cols:
                cursor.execute("ALTER TABLE security_settings ADD COLUMN reset_code_used_at TIMESTAMP;")
            conn.commit()

        # Ensure the singleton settings row exists
        cursor.execute("SELECT COUNT(*) FROM security_settings WHERE id = 1;")
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO security_settings (id, lock_enabled, pin_iterations) VALUES (1, 0, 260000);"
            )
            conn.commit()

        conn.close()
    except Exception as e:
        import logging
        logging.getLogger("memora.database").warning(f"init_db_schema check warning: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

