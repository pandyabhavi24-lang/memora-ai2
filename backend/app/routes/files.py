from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import File, Chunk
from ..schemas import FileResponse, FileDetailResponse

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

@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    file_rec = db.query(File).filter(File.id == file_id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    db.delete(file_rec)
    db.commit()
    return {"message": f"File {file_id} deleted"}
