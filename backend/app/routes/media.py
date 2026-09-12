import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import File
from ..services.media_service import media_service

router = APIRouter(prefix="/api/media", tags=["Media Intelligence"])

class AnalyzeRequest(BaseModel):
    force_reanalyze: Optional[bool] = False

class VisualSearchRequest(BaseModel):
    query: str
    threshold: Optional[float] = 60.0
    top_k: Optional[int] = 20

class UpdateTagsRequest(BaseModel):
    user_tags: List[str]
    ai_tags: Optional[List[str]] = None

class CreateGroupRequest(BaseModel):
    group_name: str
    file_ids: List[int]
    representative_file_id: Optional[int] = None

class RecommendationActionRequest(BaseModel):
    action: str  # keep, remove, ignore, review

class DeleteFileRequest(BaseModel):
    confirmed: bool

# =============================================================================
# STATIC ROUTES FIRST (To avoid route shadowing by /{file_id})
# =============================================================================

@router.post("/search")
def search_visual_media(
    req: VisualSearchRequest,
    db: Session = Depends(get_db)
):
    """
    Module 3 Local AI Visual Search:
    1. Query -> Sentence Transformer text embedding (384d) -> Visual FAISS Top-K Candidate Retrieval
    2. Local Semantic Cosine Similarity & Relevance Evaluation
    3. Strict precision thresholding and false-positive elimination
    """
    return media_service.search_visual_media(
        db=db,
        query=req.query,
        threshold=req.threshold if req.threshold is not None else 60.0,
        top_k=req.top_k if req.top_k is not None else 20
    )

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
    return media_service.get_analyzed_files(db, media_type=media_type, limit=limit or 100)

@router.get("/groups")
def get_visual_groups(db: Session = Depends(get_db)):
    """Returns dynamic visual groups."""
    return media_service.get_visual_groups(db)

@router.post("/groups/create")
def create_custom_visual_group(
    req: CreateGroupRequest,
    db: Session = Depends(get_db)
):
    """
    Creates a user-defined visual group of selected pictorial images.
    Preserves original files byte-for-byte and sets original image cover.
    """
    res = media_service.create_custom_visual_group(
        db,
        group_name=req.group_name,
        file_ids=req.file_ids,
        representative_file_id=req.representative_file_id
    )
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@router.delete("/groups/{group_id}")
def delete_visual_group(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Removes a visual group without deleting original files."""
    res = media_service.delete_visual_group(db, group_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

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

@router.get("/recent")
def get_recently_checked_media(
    limit: Optional[int] = Query(12, description="Max recent items"),
    db: Session = Depends(get_db)
):
    """Returns list of recently inspected genuine pictorial images."""
    return media_service.get_recently_checked_media(db, limit=limit or 12)

@router.get("/similar/{file_id}")
def get_similar_media(file_id: int, db: Session = Depends(get_db)):
    """Returns visually similar or duplicate media linked to a file."""
    return media_service.get_similar_media(db, file_id)

@router.post("/similar-image")
async def find_similar_by_external_image(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db)
):
    """
    Temporary External Image Similarity Query:
    1. Receives external image from user's local disk
    2. Understands image locally via Qwen2.5-VL 3B (Ollama)
    3. Generates 384-dimensional local Sentence Transformer embedding
    4. Compares against Memora pictorial-image library embeddings
    5. Returns ranked similar matches with semantic similarity %
    6. External image is NEVER saved to user's library or database
    """
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file uploaded")
    
    res = media_service.find_similar_by_external_image(
        db=db,
        image_bytes=image_bytes,
        filename=file.filename or "query_image.jpg"
    )
    return res

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

# =============================================================================
# DYNAMIC MEDIA ITEM ROUTES
# =============================================================================

@router.get("/{file_id}")
def get_media_file_detail(file_id: int, db: Session = Depends(get_db)):
    """Returns deep visual intelligence detail for a single media file."""
    detail = media_service.get_file_detail(db, file_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Media file not found")
    return detail

@router.post("/{file_id}/inspect")
def record_inspected_file(file_id: int, db: Session = Depends(get_db)):
    """Records that this pictorial image was inspected in Visual Inspector."""
    res = media_service.record_inspected_file(db, file_id)
    detail = media_service.get_file_detail(db, file_id)
    if detail:
        return {**res, "detail": detail}
    return res

@router.get("/{file_id}/tags")
def get_media_tags(file_id: int, db: Session = Depends(get_db)):
    """Returns separate AI generated tags and user-created tags for an image."""
    return media_service.get_file_tags(db, file_id)

@router.post("/{file_id}/tags")
def update_media_tags(
    file_id: int,
    req: UpdateTagsRequest,
    db: Session = Depends(get_db)
):
    """
    Updates tags for an image, persists to database, updates searchable text,
    and updates the dense Visual FAISS vector in-place.
    """
    res = media_service.update_file_tags(db, file_id, req.user_tags, req.ai_tags)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

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
