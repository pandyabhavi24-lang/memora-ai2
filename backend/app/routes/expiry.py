from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FileExpiry, File
from ..schemas import (
    ExpiryRecordResponse,
    ExpirySummaryResponse,
    ExpiryUpdateRequest,
    ExpiryConfirmRequest,
    ExpiryScanResponse,
    OllamaStatusResponse
)
from ..services.expiry_service import expiry_service

router = APIRouter(prefix="/api/expiry", tags=["File Expiry & Renewal Reminders"])


def build_record_response(rec: FileExpiry) -> ExpiryRecordResponse:
    """Helper to transform FileExpiry ORM model into ExpiryRecordResponse schema."""
    file_obj = rec.file
    return ExpiryRecordResponse(
        id=rec.id,
        file_id=rec.file_id,
        file_name=file_obj.name if file_obj else "Unknown File",
        file_path=file_obj.path if file_obj else "",
        file_extension=file_obj.extension if file_obj else "",
        document_type=rec.document_type,
        date_type=rec.date_type,
        extracted_date=rec.extracted_date,
        issue_date=rec.issue_date,
        original_text=rec.original_text,
        confidence=rec.confidence,
        extraction_method=rec.extraction_method,
        reason=rec.reason,
        status=rec.status,
        user_confirmed=rec.user_confirmed,
        reminder_enabled=rec.reminder_enabled,
        reminder_days_before=rec.reminder_days_before,
        last_notified_at=rec.last_notified_at,
        created_at=rec.created_at,
        updated_at=rec.updated_at
    )


@router.get("/ollama-status", response_model=OllamaStatusResponse)
def get_ollama_status():
    """
    Checks if local Ollama AI model is online and ready for text date analysis.
    """
    is_avail, active_model = expiry_service.is_ollama_available()
    return OllamaStatusResponse(
        available=is_avail,
        model=active_model,
        base_url=expiry_service.ollama_base_url
    )


@router.get("", response_model=List[ExpiryRecordResponse])
def list_expiries(
    status: Optional[str] = Query(None, description="Filter by status: upcoming, due_soon, expired, needs_review, all"),
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    date_type: Optional[str] = Query(None, description="Filter by date type"),
    search: Optional[str] = Query(None, description="Search term in file name or text"),
    sort_by: str = Query("date_asc", description="Sort order: date_asc, date_desc, name_asc, status"),
    db: Session = Depends(get_db)
):
    """
    List tracked file expiry and renewal records with filters and dynamic status updates.
    """
    records = expiry_service.get_expiry_records(
        db=db,
        status=status,
        document_type=document_type,
        date_type=date_type,
        search=search,
        sort_by=sort_by
    )
    return [build_record_response(r) for r in records if r.file]


@router.get("/summary", response_model=ExpirySummaryResponse)
def get_expiry_summary(db: Session = Depends(get_db)):
    """
    Get live dynamic summary counts for dashboard metrics.
    """
    counts = expiry_service.get_summary_counts(db)
    return ExpirySummaryResponse(**counts)


@router.post("/scan", response_model=ExpiryScanResponse)
def scan_files_for_expiries(db: Session = Depends(get_db)):
    """
    Triggers local AI/NLP scanning of indexed files to detect date intelligence and populate expiry records.
    """
    scan_res = expiry_service.scan_all_files(db)
    summary_resp = ExpirySummaryResponse(
        total_tracked=scan_res["total_tracked"],
        upcoming=scan_res["upcoming"],
        due_soon=scan_res["due_soon"],
        expired=scan_res["expired"],
        needs_review=scan_res["needs_review"],
        ollama_available=scan_res.get("ollama_available", False),
        ollama_model=scan_res.get("ollama_model", None)
    )
    return ExpiryScanResponse(
        files_scanned=scan_res.get("files_scanned", 0),
        expiries_detected=scan_res.get("expiries_detected", 0),
        summary=summary_resp
    )


@router.get("/reminders/due", response_model=List[ExpiryRecordResponse])
def get_due_reminders(db: Session = Depends(get_db)):
    """
    Fetches list of active due reminders for notification alerts.
    """
    due_records = expiry_service.get_due_reminders(db)
    return [build_record_response(r) for r in due_records if r.file]


@router.post("/reminders/{expiry_id}/dismiss", response_model=ExpiryRecordResponse)
def dismiss_reminder_notification(expiry_id: int, db: Session = Depends(get_db)):
    """
    Acknowledges/dismisses notification for an expiry record and sets last_notified_at.
    """
    rec = expiry_service.dismiss_reminder(db, expiry_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Expiry record not found")
    return build_record_response(rec)


@router.get("/{expiry_id}", response_model=ExpiryRecordResponse)
def get_expiry_detail(expiry_id: int, db: Session = Depends(get_db)):
    """
    Get single expiry record details.
    """
    rec = db.query(FileExpiry).filter(FileExpiry.id == expiry_id).first()
    if not rec or not rec.file:
        raise HTTPException(status_code=404, detail="Expiry record not found")
    return build_record_response(rec)


@router.put("/{expiry_id}", response_model=ExpiryRecordResponse)
def update_expiry_record(
    expiry_id: int,
    req: ExpiryUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update date, document type, reminder settings, or confirmation state of an expiry record.
    """
    update_dict = req.model_dump(exclude_unset=True)
    rec = expiry_service.update_expiry_record(db, expiry_id, update_dict)
    if not rec or not rec.file:
        raise HTTPException(status_code=404, detail="Expiry record not found")
    return build_record_response(rec)


@router.post("/{expiry_id}/confirm", response_model=ExpiryRecordResponse)
def confirm_expiry_date(
    expiry_id: int,
    req: Optional[ExpiryConfirmRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Confirms the extracted date record after user verification.
    """
    rec = expiry_service.confirm_expiry_record(db, expiry_id)
    if not rec or not rec.file:
        raise HTTPException(status_code=404, detail="Expiry record not found")
    return build_record_response(rec)


@router.post("/analyze/{file_id}", response_model=List[ExpiryRecordResponse])
def analyze_specific_file(file_id: int, db: Session = Depends(get_db)):
    """
    Analyzes or re-analyzes a specific file ID using Ollama AI + rule-based hybrid date detection.
    """
    rec = expiry_service.analyze_file(db, file_id=file_id, reanalyze=True)
    if not rec:
        raise HTTPException(status_code=404, detail="File not found or no date information could be extracted")
    records = db.query(FileExpiry).filter(FileExpiry.file_id == file_id).all()
    return [build_record_response(r) for r in records if r.file]


@router.post("/{expiry_id}/reanalyze", response_model=ExpiryRecordResponse)
def reanalyze_expiry_record(expiry_id: int, db: Session = Depends(get_db)):
    """
    Re-runs Ollama AI + rule-based analysis on the document associated with an existing expiry record.
    """
    rec = db.query(FileExpiry).filter(FileExpiry.id == expiry_id).first()
    if not rec or not rec.file_id:
        raise HTTPException(status_code=404, detail="Expiry record not found")

    updated_rec = expiry_service.analyze_file(db, file_id=rec.file_id, reanalyze=True)
    if not updated_rec or not updated_rec.file:
        raise HTTPException(status_code=500, detail="Re-analysis failed to detect date information")
    return build_record_response(updated_rec)


@router.delete("/{expiry_id}")
def delete_expiry_record(expiry_id: int, db: Session = Depends(get_db)):
    """
    Deletes an expiry record. Does not delete the underlying document file.
    """
    rec = db.query(FileExpiry).filter(FileExpiry.id == expiry_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Expiry record not found")

    db.delete(rec)
    db.commit()
    return {"message": "Expiry record deleted successfully", "id": expiry_id}
