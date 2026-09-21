import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Folder, File
from ..schemas import FolderCreate, FolderResponse
from ..services.indexing_service import indexing_service
from ..services.security_service import security_service

router = APIRouter(prefix="/api/folders", tags=["Folders"])

@router.get("", response_model=List[FolderResponse])
def list_folders(db: Session = Depends(get_db)):
    folders = db.query(Folder).filter(Folder.is_active == True).all()
    result = []
    for f in folders:
        file_count = db.query(File).filter(File.folder_id == f.id).count()
        result.append(FolderResponse(
            id=f.id,
            path=f.path,
            name=f.name,
            file_count=file_count,
            scan_status="indexed" if file_count > 0 else "ready",
            created_at=f.created_at,
            updated_at=f.updated_at,
            is_active=f.is_active
        ))
    return result

@router.post("", response_model=FolderResponse)
def add_folder(folder_in: FolderCreate, db: Session = Depends(get_db)):
    # Use realpath to resolve symlinks/junctions before storing
    abs_path = os.path.realpath(os.path.abspath(folder_in.path))
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=400, detail=f"Folder path does not exist on disk: {abs_path}")

    existing = db.query(Folder).filter(Folder.path == abs_path).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            db.refresh(existing)
        file_count = db.query(File).filter(File.folder_id == existing.id).count()
        return FolderResponse(
            id=existing.id,
            path=existing.path,
            name=existing.name,
            file_count=file_count,
            scan_status="ready",
            created_at=existing.created_at,
            updated_at=existing.updated_at,
            is_active=existing.is_active
        )

    folder_name = folder_in.name or os.path.basename(abs_path) or abs_path
    new_folder = Folder(path=abs_path, name=folder_name, is_active=True)
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    security_service.audit(
        db, "folder_added", "success",
        resource=os.path.basename(abs_path),
        details={"path": abs_path}
    )

    return FolderResponse(
        id=new_folder.id,
        path=new_folder.path,
        name=new_folder.name,
        file_count=0,
        scan_status="ready",
        created_at=new_folder.created_at,
        updated_at=new_folder.updated_at,
        is_active=new_folder.is_active
    )

@router.delete("/{folder_id}")
def remove_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    folder_name = folder.name
    folder_path = folder.path
    db.delete(folder)
    db.commit()

    security_service.audit(
        db, "folder_removed", "success",
        resource=folder_name,
        details={"path": folder_path}
    )
    return {"message": f"Folder {folder_id} deleted successfully"}

@router.post("/{folder_id}/scan")
def trigger_folder_scan(folder_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    background_tasks.add_task(indexing_service.run_folder_indexing, folder_id)
    return {"message": f"Scan triggered for folder '{folder.name}'"}
