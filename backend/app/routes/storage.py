import os
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    StorageSummaryResponse,
    LargeFilesResponse,
    AllFilesResponse,
    OptimizeCandidateRequest,
    OptimizeCandidateResponse,
    OptimizeApplyRequest,
    OptimizeApplyResponse,
    ZipArchiveRequest,
    ZipArchiveResponse,
    EmailShareRequest,
    EmailShareResponse,
)
from ..services.storage_service import storage_service, StorageServiceError
from ..services.email_service import email_service

logger = logging.getLogger("memora.storage_route")

router = APIRouter(prefix="/api/storage", tags=["Storage & Optimization"])


def _handle_storage_error(e: StorageServiceError):
    """
    Translates storage service exceptions into appropriate HTTP status codes without leaking stack traces.
    """
    msg = str(e)
    msg_lower = msg.lower()
    if "not found" in msg_lower or "does not exist" in msg_lower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    elif "modified after" in msg_lower:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
    elif "exceeds" in msg_lower or ("limit" in msg_lower and "size" in msg_lower):
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=msg)
    elif "excluded" in msg_lower or "encrypted" in msg_lower or "outside" in msg_lower or "permission denied" in msg_lower:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.get("/summary", response_model=StorageSummaryResponse)
def get_storage_summary(db: Session = Depends(get_db)):
    """
    Returns aggregate storage metrics, category breakdown, and optimizable candidate count.
    """
    try:
        data = storage_service.get_storage_summary(db=db)
        return StorageSummaryResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to calculate storage summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error calculating storage summary."
        )


@router.get("/large-files", response_model=LargeFilesResponse)
def get_large_files(
    min_size_mb: float = Query(5.0, ge=0.0, description="Minimum file size in megabytes"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of files to return"),
    db: Session = Depends(get_db)
):
    """
    Returns large indexed files exceeding the minimum size threshold, sorted by size descending.
    """
    try:
        data = storage_service.get_large_files(db=db, min_size_mb=min_size_mb, limit=limit)
        return LargeFilesResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to retrieve large files: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error retrieving large files."
        )


@router.get("/optimizable-files", response_model=LargeFilesResponse)
def get_optimizable_files(
    limit: int = Query(50, ge=1, le=500, description="Maximum number of files to return"),
    db: Session = Depends(get_db)
):
    """
    Returns indexed files that support individual optimization (JPEG, PNG, BMP, PDF),
    regardless of file size threshold.
    """
    try:
        data = storage_service.get_optimizable_files(db=db, limit=limit)
        return LargeFilesResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to retrieve optimizable files: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error retrieving optimizable files."
        )


@router.get("/all-files", response_model=AllFilesResponse)
def get_all_files(
    limit: int = Query(500, ge=1, le=1000, description="Maximum number of files to return"),
    db: Session = Depends(get_db)
):
    """
    Returns ALL indexed files so the user can manually select them for
    optimization or ZIP packaging.  is_optimizable is TRUE only for
    types Memora supports: JPEG, PNG, BMP, PDF.
    """
    try:
        data = storage_service.get_all_files(db=db, limit=limit)
        return AllFilesResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to retrieve all files: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error retrieving all files."
        )


@router.post("/optimize/candidate", response_model=OptimizeCandidateResponse)
def create_optimization_candidate(
    req: OptimizeCandidateRequest,
    db: Session = Depends(get_db)
):
    """
    Generates and stages a lossless/lossy optimization candidate in the source directory.
    """
    try:
        data = storage_service.create_optimization_candidate(
            db=db,
            file_id=req.file_id,
            mode=req.mode,
            lossy_quality=req.lossy_quality,
            bmp_target_format=req.bmp_target_format,
            max_dimension=req.max_dimension,
            pdf_image_quality=req.pdf_image_quality
        )
        return OptimizeCandidateResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to create optimization candidate for file {req.file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error creating optimization candidate."
        )


@router.get("/optimize/candidate/{candidate_token}/file")
def get_candidate_file(
    candidate_token: str,
    target: str = Query("candidate", pattern=r"^(candidate|original)$")
):
    """
    Serves the candidate file or original file for preview in storage optimization comparison.
    Token-validated and strictly scoped to active registered candidate records.
    """
    record = storage_service.get_candidate_record(candidate_token)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate record not found or has expired. Please re-analyze the file."
        )

    file_path = record.candidate_path if target == "candidate" else record.source_path
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Requested file does not exist on disk: {file_path}"
        )

    ext = os.path.splitext(file_path)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".bmp": "image/bmp",
        ".webp": "image/webp"
    }
    media_type = media_types.get(ext, "application/octet-stream")
    return FastAPIFileResponse(os.path.abspath(file_path), media_type=media_type)


@router.post("/optimize/apply", response_model=OptimizeApplyResponse)
def apply_optimization(
    req: OptimizeApplyRequest,
    db: Session = Depends(get_db)
):
    """
    Applies a validated optimization candidate using two-phase staged replacement with automatic rollback.
    """
    try:
        data = storage_service.apply_optimization(
            db=db,
            file_id=req.file_id,
            candidate_token=req.candidate_token,
            replace_original=req.replace_original
        )
        return OptimizeApplyResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to apply optimization for file {req.file_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error applying optimization."
        )


@router.post("/archive/zip", response_model=ZipArchiveResponse)
def create_zip_archive(
    req: ZipArchiveRequest,
    db: Session = Depends(get_db)
):
    """
    Packages selected database-indexed files into a compressed ZIP archive.
    """
    try:
        data = storage_service.create_zip_archive(
            db=db,
            file_ids=req.file_ids,
            destination_path=req.destination_path,
            compression_level=req.compression_level,
            overwrite=req.overwrite
        )
        return ZipArchiveResponse(**data)
    except StorageServiceError as e:
        _handle_storage_error(e)
    except Exception as e:
        logger.error(f"Failed to create ZIP archive: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error creating ZIP archive."
        )


@router.post("/share/email", response_model=EmailShareResponse)
def share_files_via_email(
    req: EmailShareRequest,
    db: Session = Depends(get_db)
):
    """
    Sends selected indexed files as email attachments via configured Gmail SMTP.
    Supports 'zip' mode (packaged into one archive) and 'originals' mode.
    Guarantees temporary ZIP cleanup in finally block.
    """
    temp_zip_path = None
    try:
        attachments, temp_zip_path, total_bytes = storage_service.prepare_email_attachments(
            db=db,
            file_ids=req.file_ids,
            mode=req.mode,
            zip_filename=req.zip_filename
        )
        result = email_service.send_file_sharing_email(
            to_email=req.to_email,
            subject=req.subject or "Shared Files from Memora AI",
            message_body=req.body or "Please find the attached files shared from Memora AI.",
            attachments=attachments,
            sender_name="Memora AI"
        )
        return EmailShareResponse(
            status="success",
            sent_to=req.to_email,
            mode=req.mode,
            attachments_count=result["attachments_count"],
            total_bytes_sent=result["total_bytes_sent"],
            message=result["message"]
        )
    except StorageServiceError as e:
        _handle_storage_error(e)
    except FileNotFoundError as fnf:
        logger.error("File not found during email sharing: %s", fnf)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        err_msg = str(ve)
        if "exceeds" in err_msg.lower() or "limit" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
    except RuntimeError as re_err:
        logger.error("SMTP delivery failure: %s", re_err)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Email delivery failed. Please check your network connection and SMTP configuration."
        )
    except Exception as exc:
        logger.error("Unexpected error during email sharing: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error sending email.")
    finally:
        if temp_zip_path and os.path.exists(temp_zip_path):
            try:
                os.remove(temp_zip_path)
            except Exception as rem_err:
                logger.debug("Failed to remove temporary share ZIP '%s': %s", temp_zip_path, rem_err)
