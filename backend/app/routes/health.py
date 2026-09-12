from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..ai.faiss_manager import faiss_manager
from ..ai.visual.visual_faiss_manager import visual_faiss_manager
from ..ai.visual.local_vision import local_vision_analyzer
from ..services.embedding_service import embedding_service

router = APIRouter(tags=["Health"])

@router.get("/health")
@router.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db_status = False
    try:
        db.execute(text("SELECT 1"))
        db_status = True
    except Exception:
        db_status = False

    faiss_status = faiss_manager.index is not None
    visual_faiss_status = visual_faiss_manager.index is not None
    ollama_available = local_vision_analyzer.is_ollama_available()
    emb_info = embedding_service.get_info()

    return {
        "status": "ok" if (db_status and faiss_status) else "degraded",
        "provider": "local",
        "ollama": ollama_available,
        "vision_model": local_vision_analyzer.vision_model,
        "vision_model_available": ollama_available,
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "embedding_dimension": embedding_service.dimension,
        "database": db_status,
        "faiss": faiss_status,
        "visual_faiss": visual_faiss_status
    }
