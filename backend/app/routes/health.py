from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..ai.faiss_manager import faiss_manager
from ..services.embedding_service import embedding_service

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = False
    try:
        db.execute(text("SELECT 1"))
        db_status = True
    except Exception:
        db_status = False

    faiss_status = faiss_manager.index is not None
    embedding_status = True

    return {
        "status": "ok" if (db_status and faiss_status) else "degraded",
        "database": db_status,
        "faiss": faiss_status,
        "embedding_model": embedding_status
    }
