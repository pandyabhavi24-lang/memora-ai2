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
    """Safely adds missing columns to SQLite tables if not already present."""
    import sqlite3
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check files table
        cursor.execute("PRAGMA table_info(files);")
        file_cols = [row[1] for row in cursor.fetchall()]
        if file_cols and "smart_tags" not in file_cols:
            cursor.execute("ALTER TABLE files ADD COLUMN smart_tags TEXT;")
            conn.commit()

        # Check organization_suggestions table
        cursor.execute("PRAGMA table_info(organization_suggestions);")
        sug_cols = [row[1] for row in cursor.fetchall()]
        if sug_cols and "smart_tags" not in sug_cols:
            cursor.execute("ALTER TABLE organization_suggestions ADD COLUMN smart_tags TEXT;")
            conn.commit()

        # Check media_analyses table
        cursor.execute("PRAGMA table_info(media_analyses);")
        media_cols = [row[1] for row in cursor.fetchall()]
        if media_cols:
            if "ai_description" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN ai_description TEXT;")
            if "object_counts" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN object_counts TEXT;")
            if "environment" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN environment VARCHAR;")
            if "activities" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN activities TEXT;")
            if "visual_attributes" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN visual_attributes TEXT;")
            if "relationships" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN relationships TEXT;")
            if "search_terms" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN search_terms TEXT;")
            if "content_type" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN content_type VARCHAR DEFAULT 'pictorial';")
            if "classification_confidence" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN classification_confidence FLOAT DEFAULT 1.0;")
            if "classification_reason" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN classification_reason TEXT;")
            if "ai_tags" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN ai_tags TEXT;")
            if "user_tags" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN user_tags TEXT;")
            if "recently_inspected_at" not in media_cols:
                cursor.execute("ALTER TABLE media_analyses ADD COLUMN recently_inspected_at DATETIME;")
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
