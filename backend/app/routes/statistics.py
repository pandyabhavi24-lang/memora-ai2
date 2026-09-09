from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Folder, File, Chunk, VectorMapping, SearchHistory
from ..schemas import StatisticsResponse, FileResponse, SearchHistoryItem

router = APIRouter(prefix="/api/statistics", tags=["Statistics"])

@router.get("", response_model=StatisticsResponse)
def get_dashboard_statistics(db: Session = Depends(get_db)):
    folder_count = db.query(Folder).filter(Folder.is_active == True).count()
    file_count = db.query(File).count()
    chunk_count = db.query(Chunk).count()
    vector_count = db.query(VectorMapping).count()
    search_count = db.query(SearchHistory).count()

    recent_files_db = db.query(File).order_by(File.modified_at.desc()).limit(5).all()
    recent_searches_db = db.query(SearchHistory).order_by(SearchHistory.created_at.desc()).limit(5).all()

    return StatisticsResponse(
        folders=folder_count,
        files=file_count,
        chunks=chunk_count,
        vectors=vector_count,
        searches=search_count,
        recent_files=[FileResponse.model_validate(f) for f in recent_files_db],
        recent_searches=[SearchHistoryItem.model_validate(s) for s in recent_searches_db]
    )
