from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SearchHistory
from ..schemas import SearchRequest, SearchResponse, SearchHistoryItem
from ..services.search_service import search_service

router = APIRouter(prefix="/api/search", tags=["Search"])

@router.post("", response_model=SearchResponse)
def perform_search(search_req: SearchRequest, db: Session = Depends(get_db)):
    results_data = search_service.execute_search(
        db=db,
        query=search_req.query,
        top_k=search_req.top_k or 20,
        filters=search_req.filters,
        sort_by=search_req.sort_by or "relevant"
    )
    return SearchResponse(**results_data)

@router.get("/health")
def semantic_search_health_check(db: Session = Depends(get_db)):
    """
    Dedicated diagnostic health check for semantic search components:
    embedding model, FAISS vector index, database, chunk mappings.
    """
    from ..models import File, Chunk
    from ..ai.faiss_manager import faiss_manager
    from ..services.embedding_service import embedding_service

    model_info = embedding_service.get_info()
    db_ok = False
    doc_count = 0
    chunk_count = 0

    try:
        doc_count = db.query(File).count()
        chunk_count = db.query(Chunk).count()
        db_ok = True
    except Exception:
        db_ok = False

    faiss_ok = faiss_manager.index is not None
    faiss_vectors = faiss_manager.index.ntotal if faiss_ok else 0
    mapping_ok = len(faiss_manager.faiss_to_chunk) == faiss_vectors

    return {
        "status": "ok" if (db_ok and faiss_ok and model_info["loaded"]) else "degraded",
        "embedding_model_loaded": model_info["loaded"],
        "embedding_provider": model_info["provider"],
        "embedding_model_name": model_info["model_name"],
        "embedding_dimension": model_info["dimension"],
        "faiss_loaded": faiss_ok,
        "faiss_vectors": faiss_vectors,
        "metadata_mapping": mapping_ok,
        "database": db_ok,
        "indexed_documents": doc_count,
        "embedded_chunks": chunk_count
    }


@router.get("/tags", response_model=List[str])
def get_available_tags(db: Session = Depends(get_db)):
    """Return all unique smart tags currently stored across files in the database."""
    from ..models import File
    files = db.query(File).filter(File.smart_tags.isnot(None)).all()
    unique_tags = set()
    for f in files:
        for tag in f.get_smart_tags():
            if tag and tag.strip():
                unique_tags.add(tag.strip())
    return sorted(list(unique_tags), key=lambda x: x.lower())

@router.get("/history", response_model=List[SearchHistoryItem])
def get_search_history(db: Session = Depends(get_db)):
    history = db.query(SearchHistory).order_by(SearchHistory.created_at.desc()).limit(15).all()
    return history

@router.delete("/history/{history_id}")
def delete_search_history_item(history_id: int, db: Session = Depends(get_db)):
    item = db.query(SearchHistory).filter(SearchHistory.id == history_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="History item not found")
    db.delete(item)
    db.commit()
    return {"message": "Search history item removed"}

@router.delete("/history")
def clear_all_search_history(db: Session = Depends(get_db)):
    db.query(SearchHistory).delete()
    db.commit()
    return {"message": "All search history cleared"}
