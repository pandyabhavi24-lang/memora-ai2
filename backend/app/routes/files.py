from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import File, Chunk
from ..schemas import FileResponse, FileDetailResponse, FileTagsUpdate

router = APIRouter(prefix="/api/files", tags=["Files"])

@router.get("", response_model=List[FileResponse])
def list_files(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    files = db.query(File).offset(skip).limit(limit).all()
    return files

@router.get("/{file_id}", response_model=FileDetailResponse)
def get_file_detail(file_id: int, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == file_id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    chunk_count = db.query(Chunk).filter(Chunk.file_id == file_id).count()

    return FileDetailResponse(
        id=file_rec.id,
        folder_id=file_rec.folder_id,
        path=file_rec.path,
        name=file_rec.name,
        extension=file_rec.extension,
        size=file_rec.size,
        modified_at=file_rec.modified_at,
        file_hash=file_rec.file_hash,
        mime_type=file_rec.mime_type,
        extraction_status=file_rec.extraction_status,
        smart_tags=file_rec.get_smart_tags(),
        extracted_text=file_rec.extracted_text,
        chunk_count=chunk_count,
        created_at=file_rec.created_at,
        updated_at=file_rec.updated_at
    )

@router.get("/{file_id}/content")
def get_file_content(file_id: int, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == file_id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "file_id": file_rec.id,
        "name": file_rec.name,
        "path": file_rec.path,
        "extension": file_rec.extension,
        "extraction_status": file_rec.extraction_status,
        "extracted_text": file_rec.extracted_text or "No extracted text available."
    }

@router.put("/{file_id}/tags")
@router.patch("/{file_id}/tags")
def update_file_tags(file_id: int, req: FileTagsUpdate, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == file_id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    clean_tags = []
    seen = set()
    for t in req.tags:
        if t and str(t).strip():
            trimmed = str(t).strip()
            if trimmed.lower() not in seen:
                seen.add(trimmed.lower())
                clean_tags.append(trimmed)

    file_rec.set_smart_tags(clean_tags)

    from ..models import OrganizationSuggestion
    suggestions = db.query(OrganizationSuggestion).filter(OrganizationSuggestion.file_id == file_id).all()
    for sug in suggestions:
        sug.set_smart_tags(clean_tags)
        sug.status = "edited"

    db.commit()
    db.refresh(file_rec)

    return {
        "status": "success",
        "file_id": file_id,
        "smart_tags": file_rec.get_smart_tags(),
        "message": "Smart tags updated successfully"
    }

@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    import os
    import logging
    from ..services.indexing_service import indexing_service
    from ..models import OrganizationSuggestion, DuplicateGroup

    logger = logging.getLogger("memora.routes.files")

    # 1. Validate the existing File record
    file_rec = db.query(File).filter(File.id == file_id).first()
    if not file_rec:
        raise HTTPException(
            status_code=404,
            detail=f"File record with ID {file_id} not found in database."
        )

    # 2. Resolve and validate actual physical path
    file_path = file_rec.path
    file_name = file_rec.name

    # 3. Check physical file existence and attempt physical deletion
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as err:
            logger.error(f"Failed to delete physical file from disk '{file_path}': {err}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete physical file from disk: {str(err)}"
            )

        # 4. Verify the file no longer exists
        if os.path.exists(file_path):
            raise HTTPException(
                status_code=500,
                detail="Physical file deletion failed; file still exists on disk."
            )
        logger.info(f"Successfully deleted physical file from disk: '{file_path}'")
    else:
        logger.warning(f"Physical file '{file_path}' was already missing from disk. Proceeding with DB/index cleanup.")

    # 5. ONLY after successful physical deletion, update FAISS, SQLite chunks, vector mappings & DB records
    try:
        # Remove FAISS vectors, VectorMapping, and Chunk records using existing indexing service
        indexing_service._delete_file_chunks_and_vectors(db, file_id)

        # Remove related OrganizationSuggestions
        db.query(OrganizationSuggestion).filter(OrganizationSuggestion.file_id == file_id).delete(synchronize_session=False)

        # Remove related DuplicateGroups where this file is file_a or file_b
        db.query(DuplicateGroup).filter(
            (DuplicateGroup.file_a_id == file_id) | (DuplicateGroup.file_b_id == file_id)
        ).delete(synchronize_session=False)

        # Delete File record from SQLite DB
        db.delete(file_rec)
        db.commit()

        logger.info(f"Completed DB metadata and FAISS vector index cleanup for file_id {file_id} ('{file_name}').")
        return {
            "status": "success",
            "message": f"Successfully deleted '{file_name}' from disk and vector index.",
            "file_id": file_id,
            "path": file_path
        }
    except Exception as cleanup_err:
        db.rollback()
        logger.error(f"Error cleaning up database/index records for file_id {file_id}: {cleanup_err}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Physical file was deleted, but metadata/FAISS cleanup failed: {str(cleanup_err)}"
        )
