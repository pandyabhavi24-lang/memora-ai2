import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import File
from ..services.media_service import media_service

router = APIRouter(prefix="/api/media", tags=["Media Intelligence"])

class AnalyzeRequest(BaseModel):
    force_reanalyze: Optional[bool] = False

class RecommendationActionRequest(BaseModel):
    action: str  # keep, remove, ignore, review

class DeleteFileRequest(BaseModel):
    confirmed: bool

@router.post("/analyze")
def trigger_media_analysis(
    req: Optional[AnalyzeRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """
    Triggers local visual & media analysis in the background without blocking the UI.
    """
    force = req.force_reanalyze if req else False
    background_tasks.add_task(media_service.analyze_all_media, db, force)
    return {
        "status": "started",
        "message": "Media visual intelligence analysis started in background."
    }

@router.get("/status")
def get_media_analysis_status():
    """Returns background analysis progress, total files, and status."""
    return media_service.get_analysis_status()

@router.get("/overview")
def get_media_overview(db: Session = Depends(get_db)):
    """Returns high-level overview metrics for Module 3 dashboard."""
    return media_service.get_overview_statistics(db)

@router.get("/files")
def get_media_files(
    media_type: Optional[str] = Query(None, description="Filter by 'image', 'video', or 'all'"),
    limit: Optional[int] = Query(100, description="Max files to return"),
    db: Session = Depends(get_db)
):
    """Returns list of analyzed media files with quality scores and visual tags."""
    return media_service.get_analyzed_files(db, media_type=media_type, limit=limit)

@router.get("/groups")
def get_visual_groups(db: Session = Depends(get_db)):
    """Returns logical visual groups (e.g. Screenshots, Nature, Workshops, Events)."""
    return media_service.get_visual_groups(db)

@router.get("/recommendations")
def get_media_recommendations(db: Session = Depends(get_db)):
    """Returns AI media cleanup recommendations with reasons and recovery estimates."""
    return media_service.get_recommendations(db)

@router.post("/recommendations/{rec_id}/action")
def handle_recommendation_action(
    rec_id: int,
    req: RecommendationActionRequest,
    db: Session = Depends(get_db)
):
    """Handles user action on an AI cleanup recommendation (keep, remove, ignore)."""
    res = media_service.handle_recommendation_action(db, rec_id, req.action)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@router.get("/similar/{file_id}")
def get_similar_media(file_id: int, db: Session = Depends(get_db)):
    """Returns visually similar or duplicate media linked to a file."""
    return media_service.get_similar_media(db, file_id)

@router.get("/{file_id}")
def get_media_file_detail(file_id: int, db: Session = Depends(get_db)):
    """Returns deep visual intelligence detail for a single media file."""
    detail = media_service.get_file_detail(db, file_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Media file not found")
    return detail

@router.get("/{file_id}/thumbnail")
def get_media_thumbnail(file_id: int, db: Session = Depends(get_db)):
    """Returns the generated fast thumbnail image for a media file."""
    thumb_path = media_service.get_thumbnail_file_path(db, file_id)
    if not thumb_path or not os.path.exists(thumb_path):
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(thumb_path)

@router.get("/{file_id}/preview")
def get_media_preview(file_id: int, db: Session = Depends(get_db)):
    """Returns the full media preview file for detailed inspection."""
    file = db.query(File).filter(File.id == file_id).first()
    if not file or not os.path.exists(file.path):
        raise HTTPException(status_code=404, detail="Media file not found on disk")
    return FileResponse(file.path)

@router.post("/delete/{file_id}")
def delete_media_file(
    file_id: int,
    req: DeleteFileRequest,
    db: Session = Depends(get_db)
):
    """
    Safely deletes a media file from disk and database ONLY after explicit user confirmation.
    """
    if not req.confirmed:
        raise HTTPException(status_code=400, detail="Explicit user confirmation is required.")
    res = media_service.delete_media_file(db, file_id, confirmed=True)
    if res.get("status") == "error":
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res

