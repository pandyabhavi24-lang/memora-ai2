import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    CategoryResponse,
    CategoryOverviewItem,
    SuggestionItemResponse,
    SuggestionUpdate,
    AnalyzeRequest,
    AnalysisSummaryResponse,
    OrganizationPreviewItem,
    OrganizationPreviewResponse,
    OrganizationApplyRequest,
    OrganizationApplyResponse,
    DuplicateGroupResponse,
    FileOperationResponse
)
from ..services.organization_service import organization_service

logger = logging.getLogger("memora.routes.organization")

router = APIRouter(
    prefix="/api/organization",
    tags=["Intelligent Organization"]
)

@router.post("/analyze", response_model=AnalysisSummaryResponse)
def analyze_organization(
    req: Optional[AnalyzeRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Analyzes scanned files, classifies categories, and detects exact/semantic duplicates.
    Does NOT modify the filesystem.
    """
    try:
        folder_id = req.folder_id if req else None
        summary = organization_service.analyze_files(db, folder_id=folder_id)
        return summary
    except Exception as e:
        logger.error(f"Error during organization analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while analyzing files: {str(e)}"
        )

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """Returns active organization categories."""
    return organization_service.get_categories(db)

@router.get("/suggestions", response_model=List[SuggestionItemResponse])
def get_suggestions(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns generated file organization suggestions."""
    return organization_service.get_suggestions(db, status=status_filter)

@router.patch("/suggestions/{suggestion_id}")
def update_suggestion(
    suggestion_id: str,
    update_data: SuggestionUpdate,
    db: Session = Depends(get_db)
):
    """
    Updates suggestion status (accepted, rejected, edited) and/or category assignment.
    Does NOT modify the filesystem.
    """
    # Clean ID format if prefixed with 's-'
    raw_id = suggestion_id.replace("s-", "")
    try:
        db_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid suggestion ID format")

    updated = organization_service.update_suggestion(
        db,
        sug_id=db_id,
        status=update_data.status,
        category_name=update_data.suggestedCategory
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Organization suggestion not found")

    return {"message": "Suggestion updated successfully", "id": suggestion_id}

@router.post("/preview", response_model=OrganizationPreviewResponse)
def preview_organization(db: Session = Depends(get_db)):
    """
    Generates proposed file relocation paths for user review.
    Does NOT modify the filesystem.
    """
    items = organization_service.generate_preview(db)
    return {
        "items": items,
        "total_files": len(items)
    }

@router.post("/apply", response_model=OrganizationApplyResponse)
def apply_organization(
    req: Optional[OrganizationApplyRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Executes safe file relocation for user-approved suggestions.
    This is the ONLY operation that modifies files on disk.
    """
    try:
        selected_ids = req.suggestion_ids if req else None
        operation_type = req.operation_type if req and req.operation_type else "move"
        result = organization_service.apply_organization(db, selected_ids=selected_ids, operation_type=operation_type)
        return result
    except Exception as e:
        logger.error(f"Error applying organization plan: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply organization plan: {str(e)}"
        )

@router.get("/duplicates", response_model=List[DuplicateGroupResponse])
def get_duplicates(db: Session = Depends(get_db)):
    """Returns detected exact and semantic duplicate candidate file groups."""
    return organization_service.get_duplicates(db)

@router.get("/operations", response_model=List[FileOperationResponse])
def get_operations(db: Session = Depends(get_db)):
    """Returns history log of executed file organization operations."""
    return organization_service.get_operations(db)

@router.get("/overview", response_model=List[CategoryOverviewItem])
def get_overview(db: Session = Depends(get_db)):
    """Returns real organization summary category distribution."""
    return organization_service.get_overview(db)
