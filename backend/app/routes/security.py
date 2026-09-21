"""
Memora AI - Security API Routes (Module 5)
==========================================
All endpoints under /api/security/

Protected endpoints require a valid session token in the
X-Session-Token header when application lock is enabled.
Backend validates the token server-side — React state alone is never trusted.
"""

import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog, ExcludedFolder, Folder, SecuritySettings
from ..services.security_service import security_service

logger = logging.getLogger("memora.routes.security")

router = APIRouter(prefix="/api/security", tags=["Security & Privacy"])


# ---------------------------------------------------------------------------
# Dependency: session guard
# ---------------------------------------------------------------------------

def require_session(
    db: Session = Depends(get_db),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    """
    FastAPI dependency that enforces server-side session validation.
    When lock is enabled, the caller MUST supply a valid session token.
    React's isAuthenticated state is NOT trusted by the backend.
    """
    settings = _get_settings(db)
    if settings.lock_enabled:
        if not security_service.validate_session(x_session_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Please unlock the application.",
            )
    return settings


def _get_settings(db: Session) -> SecuritySettings:
    """Returns the singleton SecuritySettings row, creating it if absent."""
    row = db.query(SecuritySettings).filter(SecuritySettings.id == 1).first()
    if not row:
        row = SecuritySettings(id=1, lock_enabled=False, pin_iterations=260_000)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Pydantic schemas (security-specific; no PIN echoed in responses)
# ---------------------------------------------------------------------------

class SecurityStatusResponse(BaseModel):
    lock_enabled: bool
    has_pin: bool
    session_active: bool


class SetPinRequest(BaseModel):
    pin: str
    current_pin: Optional[str] = None  # required when changing an existing PIN

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v):
        if len(v) < 4 or len(v) > 32:
            raise ValueError("PIN must be between 4 and 32 characters.")
        return v


class VerifyPinRequest(BaseModel):
    pin: str


class VerifyPinResponse(BaseModel):
    success: bool
    session_token: Optional[str] = None
    error: Optional[str] = None
    lockout_seconds: Optional[float] = None


class LockToggleRequest(BaseModel):
    enabled: bool


class ExcludedFolderResponse(BaseModel):
    id: int
    path: str
    created_at: datetime

    class Config:
        from_attributes = True


class AddExcludedFolderRequest(BaseModel):
    path: str


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    action: str
    status: str
    resource: Optional[str] = None
    details: Optional[str] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


class RemoveIndexRequest(BaseModel):
    folder_id: Optional[int] = None   # None = remove all
    scope: str = "metadata"           # "metadata" | "vectors"


class BackupRequest(BaseModel):
    destination_dir: str


class RestoreRequest(BaseModel):
    backup_path: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=SecurityStatusResponse)
def get_security_settings(
    db: Session = Depends(get_db),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    """Returns current security status. Never returns PIN hash or salt."""
    settings = _get_settings(db)
    session_active = (
        security_service.validate_session(x_session_token)
        if settings.lock_enabled
        else True
    )
    return SecurityStatusResponse(
        lock_enabled=settings.lock_enabled,
        has_pin=bool(settings.pin_hash),
        session_active=session_active,
    )


@router.post("/pin/set")
def set_pin(
    req: SetPinRequest,
    db: Session = Depends(get_db),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    """
    Set or change the application PIN.

    - If a PIN already exists, current_pin must be supplied and verified.
    - The PIN is NEVER stored; only the PBKDF2 hash and salt are saved.
    - Setting/changing PIN does NOT automatically enable lock.
    """
    settings = _get_settings(db)

    # If lock is enabled, session must be valid
    if settings.lock_enabled and not security_service.validate_session(x_session_token):
        raise HTTPException(status_code=401, detail="Authentication required.")

    # If changing an existing PIN, verify the old one first
    if settings.pin_hash:
        if not req.current_pin:
            raise HTTPException(
                status_code=400,
                detail="Current PIN is required to change an existing PIN.",
            )
        locked, remaining = security_service.check_lockout()
        if locked:
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Try again in {remaining:.0f} seconds.",
            )
        ok = security_service.verify_pin(
            req.current_pin,
            settings.pin_hash,
            settings.pin_salt,
            settings.pin_iterations,
        )
        if not ok:
            security_service.on_auth_failure()
            security_service.audit(db, "pin_change_failed", "failure",
                                   details={"reason": "incorrect_current_pin"})
            raise HTTPException(status_code=403, detail="Current PIN is incorrect.")
        security_service.on_auth_success()

    # Hash new PIN
    new_hash, new_salt = security_service.hash_pin(req.pin)
    settings.pin_hash = new_hash
    settings.pin_salt = new_salt
    settings.pin_iterations = 260_000
    db.commit()

    security_service.audit(db, "pin_changed", "success")
    logger.info("Application PIN updated.")
    return {"message": "PIN updated successfully."}


@router.delete("/pin")
def remove_pin(
    req: VerifyPinRequest,
    db: Session = Depends(get_db),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    """Remove the PIN and disable lock (requires current PIN verification)."""
    settings = _get_settings(db)
    if settings.lock_enabled and not security_service.validate_session(x_session_token):
        raise HTTPException(status_code=401, detail="Authentication required.")

    if not settings.pin_hash:
        raise HTTPException(status_code=400, detail="No PIN is currently set.")

    locked, remaining = security_service.check_lockout()
    if locked:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {remaining:.0f} seconds.",
        )

    ok = security_service.verify_pin(req.pin, settings.pin_hash, settings.pin_salt, settings.pin_iterations)
    if not ok:
        security_service.on_auth_failure()
        security_service.audit(db, "pin_remove_failed", "failure",
                               details={"reason": "incorrect_pin"})
        raise HTTPException(status_code=403, detail="PIN incorrect.")

    security_service.on_auth_success()
    settings.pin_hash = None
    settings.pin_salt = None
    settings.lock_enabled = False
    db.commit()
    security_service.invalidate_session()
    security_service.audit(db, "pin_removed", "success")
    return {"message": "PIN removed. Application lock disabled."}


@router.post("/pin/verify", response_model=VerifyPinResponse)
def verify_pin(req: VerifyPinRequest, db: Session = Depends(get_db)):
    """
    Verify the PIN and issue a session token on success.

    Progressive lockout: after 5 failures the endpoint returns 429 with
    the remaining lockout time. The session is also invalidated on failure.
    The response NEVER echoes the PIN.
    """
    locked, remaining = security_service.check_lockout()
    if locked:
        security_service.audit(db, "pin_verify_blocked", "failure",
                               details={"lockout_seconds_remaining": round(remaining, 1)})
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {remaining:.0f} seconds.",
            headers={"Retry-After": str(int(remaining))},
        )

    settings = _get_settings(db)
    if not settings.pin_hash:
        raise HTTPException(status_code=400, detail="No PIN configured.")

    ok = security_service.verify_pin(
        req.pin,
        settings.pin_hash,
        settings.pin_salt,
        settings.pin_iterations,
    )

    if ok:
        security_service.on_auth_success()
        token = security_service.create_session()
        security_service.audit(db, "pin_verified", "success")
        return VerifyPinResponse(success=True, session_token=token)
    else:
        security_service.on_auth_failure()
        locked2, remaining2 = security_service.check_lockout()
        security_service.audit(db, "pin_verify_failed", "failure",
                               details={"now_locked": locked2})
        # Generic error — does not reveal whether a hash even exists
        return VerifyPinResponse(
            success=False,
            error="Incorrect PIN." if not locked2 else
                  f"Too many failed attempts. Locked for {remaining2:.0f} seconds.",
            lockout_seconds=remaining2 if locked2 else None,
        )


@router.post("/lock/enable")
def enable_lock(
    req: LockToggleRequest,
    db: Session = Depends(get_db),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    """Enable or disable application lock. Requires a PIN to be set first."""
    settings = _get_settings(db)
    if settings.lock_enabled and not security_service.validate_session(x_session_token):
        raise HTTPException(status_code=401, detail="Authentication required.")

    if req.enabled and not settings.pin_hash:
        raise HTTPException(status_code=400, detail="Set a PIN before enabling application lock.")

    settings.lock_enabled = req.enabled
    db.commit()

    if not req.enabled:
        security_service.invalidate_session()

    action = "lock_enabled" if req.enabled else "lock_disabled"
    security_service.audit(db, action, "success")
    return {"message": f"Application lock {'enabled' if req.enabled else 'disabled'}."}


@router.post("/lock/lock-now")
def lock_now(
    db: Session = Depends(get_db),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    """
    Immediately invalidate the active session ('Lock Now').
    The session token is cleared server-side — frontend isAuthenticated alone is insufficient.
    """
    settings = _get_settings(db)
    if not settings.lock_enabled:
        raise HTTPException(status_code=400, detail="Application lock is not enabled.")
    security_service.invalidate_session()
    security_service.audit(db, "app_locked", "success")
    return {"message": "Application locked."}


# ---------------------------------------------------------------------------
# Excluded folders
# ---------------------------------------------------------------------------

@router.get("/excluded-folders", response_model=List[ExcludedFolderResponse])
def list_excluded_folders(
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    return db.query(ExcludedFolder).order_by(ExcludedFolder.created_at.desc()).all()


@router.post("/excluded-folders", response_model=ExcludedFolderResponse)
def add_excluded_folder(
    req: AddExcludedFolderRequest,
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    """
    Adds a folder to the exclusion list.

    Validation:
      - Resolves the canonical path (realpath → prevents traversal).
      - Path must exist on disk.
      - Warns (but does not block) if path is outside all approved folders
        (exclusions only affect Memora-managed locations).
      - Prevents duplicates.
    """
    try:
        real_path = security_service.resolve_path(req.path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not os.path.exists(real_path):
        raise HTTPException(status_code=400, detail="Path does not exist on disk.")

    if not os.path.isdir(real_path):
        raise HTTPException(status_code=400, detail="Path must be a directory.")

    # Check for duplicate
    existing = db.query(ExcludedFolder).filter(ExcludedFolder.path == real_path).first()
    if existing:
        raise HTTPException(status_code=409, detail="Folder is already in the exclusion list.")

    approved = security_service.get_approved_paths(db)
    inside_approved = any(security_service.is_inside(real_path, ap) for ap in approved)

    new_excl = ExcludedFolder(path=real_path)
    db.add(new_excl)
    db.commit()
    db.refresh(new_excl)

    security_service.audit(
        db, "folder_excluded", "success",
        resource=os.path.basename(real_path),
        details={
            "inside_approved_folder": inside_approved,
            "note": "Files in this folder will be skipped during future scans.",
        },
    )
    logger.info("Excluded folder added: %s", real_path)
    return new_excl


@router.delete("/excluded-folders/{folder_id}")
def remove_excluded_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    excl = db.query(ExcludedFolder).filter(ExcludedFolder.id == folder_id).first()
    if not excl:
        raise HTTPException(status_code=404, detail="Excluded folder not found.")

    path_name = os.path.basename(excl.path)
    db.delete(excl)
    db.commit()

    security_service.audit(db, "folder_exclusion_removed", "success", resource=path_name)
    return {"message": "Folder removed from exclusion list."}


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    action: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    """
    Returns audit log entries. Requires authenticated session when lock is enabled.
    Supports filtering by action and status.
    """
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if status_filter:
        query = query.filter(AuditLog.status == status_filter)
    return query.limit(min(limit, 500)).all()


@router.delete("/audit-logs")
def clear_audit_logs(
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    """
    Clears all audit log entries.

    Limitation: this clearing operation cannot itself be recorded in the
    cleared log. A log entry is written BEFORE deletion so the clearing
    event is visible in the new empty log immediately after.
    """
    # Write the clearing event first, so it persists as record #1 after deletion
    security_service.audit(db, "audit_logs_cleared", "success",
                           details={"note": "All prior audit log entries were deleted."})
    # Retrieve the just-written entry's ID so we can keep it
    latest = (
        db.query(AuditLog)
        .order_by(AuditLog.id.desc())
        .first()
    )
    keep_id = latest.id if latest else None

    q = db.query(AuditLog)
    if keep_id:
        q = q.filter(AuditLog.id != keep_id)
    deleted = q.delete(synchronize_session=False)
    db.commit()

    return {"message": f"Cleared {deleted} audit log entries.", "retained_clearing_event": True}


# ---------------------------------------------------------------------------
# Data management
# ---------------------------------------------------------------------------

@router.post("/data/remove-index")
def remove_index_data(
    req: RemoveIndexRequest,
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    """
    Removes Memora's indexed application data WITHOUT deleting original user files.

    scope='metadata': removes File, Chunk, VectorMapping records + FAISS vectors
    scope='vectors': removes only VectorMapping records + resets FAISS index
    """
    try:
        if req.scope == "metadata":
            result = security_service.remove_index_metadata(db, folder_id=req.folder_id)
            security_service.audit(
                db, "index_metadata_removed", "success",
                details={"folder_id": req.folder_id, **result},
            )
        elif req.scope == "vectors":
            result = security_service.remove_vector_data(db)
            security_service.audit(db, "vector_data_removed", "success", details=result)
        else:
            raise HTTPException(status_code=400, detail="scope must be 'metadata' or 'vectors'.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        security_service.audit(db, "data_removal_failed", "failure", error=str(e))
        raise HTTPException(status_code=500, detail=f"Data removal failed: {str(e)}")


# ---------------------------------------------------------------------------
# Backup & Restore
# ---------------------------------------------------------------------------

@router.post("/backup")
def create_backup(
    req: BackupRequest,
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    """Creates a ZIP backup of Memora application data to the specified directory."""
    try:
        result = security_service.create_backup(db, req.destination_dir)
        security_service.audit(
            db, "backup_created", "success",
            resource=os.path.basename(result["backup_path"]),
            details={
                "size_bytes": result["size_bytes"],
                "files_included": result["files_included"],
            },
        )
        return result
    except ValueError as e:
        security_service.audit(db, "backup_failed", "failure", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        security_service.audit(db, "backup_failed", "failure", error=str(e)[:256])
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@router.post("/backup/validate")
def validate_backup(req: RestoreRequest, db: Session = Depends(get_db), _=Depends(require_session)):
    """Validates a backup ZIP without restoring. Returns manifest info."""
    try:
        manifest = security_service.validate_backup(req.backup_path)
        return {"valid": True, "manifest": manifest}
    except ValueError as e:
        return {"valid": False, "error": str(e)}


@router.post("/restore")
def restore_backup(
    req: RestoreRequest,
    db: Session = Depends(get_db),
    _=Depends(require_session),
):
    """
    Restores Memora data from a validated backup.
    Creates a safety backup of current data first.
    Does NOT partially restore — if any step fails, current data is untouched.
    """
    try:
        result = security_service.restore_backup(db, req.backup_path)
        # After restore db session is invalid — re-acquire for audit
        from ..database import SessionLocal
        new_db = SessionLocal()
        try:
            security_service.audit(
                new_db, "backup_restored", "success",
                resource=os.path.basename(req.backup_path),
                details={"safety_backup": result.get("safety_backup")},
            )
        finally:
            new_db.close()
        return result
    except ValueError as e:
        security_service.audit(db, "restore_failed", "failure", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        security_service.audit(db, "restore_failed", "failure", error=str(e)[:256])
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
