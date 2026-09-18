import os
import time
import secrets
import zipfile
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models import File, Folder, DuplicateGroup
from .scanner import calculate_sha256
from .indexing_service import indexing_service
from .image_optimizer import image_optimizer, ImageOptimizationError
from .pdf_optimizer import pdf_optimizer, PdfOptimizationError

logger = logging.getLogger("memora.storage_service")


class StorageServiceError(Exception):
    """Raised when a storage analysis, candidate generation, or replacement error occurs."""
    pass


@dataclass
class CandidateRecord:
    """Internal in-memory record for a generated optimization candidate."""
    token: str
    file_id: int
    source_path: str
    candidate_path: str
    original_size: int
    candidate_size: int
    original_hash: str
    original_mtime: float
    mode: str
    strategy: str
    is_lossless: bool
    is_format_conversion: bool
    created_at: float = field(default_factory=time.time)
    ttl_seconds: int = 900  # 15 minutes


def format_bytes(size_bytes: int) -> str:
    """Converts raw byte count into human-readable formatted string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


# Recognized Extension Groups matching Memora taxonomy
DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".pptx", ".ppt", ".xlsx", ".xls", ".csv"}
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif", ".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav"}
CODE_TEXT_EXTENSIONS = {
    ".py", ".java", ".c", ".cpp", ".hpp", ".hxx", ".cs", ".swift", ".kt", ".kts", ".rb", ".go", ".rs", ".php",
    ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".json", ".xml", ".yml", ".yaml", ".toml", ".cfg", ".conf", ".ini", ".env", ".log", ".sql",
    ".sh", ".bash", ".zsh", ".fish", ".ksh", ".ps1", ".bat", ".cmd", ".vbs"
}
ARCHIVE_EXTENSIONS = {".zip", ".7z", ".rar", ".tar", ".gz", ".bz2", ".xz"}

OPTIMIZABLE_EXTENSIONS = {
    ".jpg": "JPEG Optimization",
    ".jpeg": "JPEG Optimization",
    ".png": "PNG Optimization",
    ".bmp": "BMP to PNG Conversion",
    ".pdf": "PDF Stream Optimization"
}


class StorageService:
    """
    Central coordinator service for Memora AI Storage Analysis & Optimization V1.
    
    Coordinates:
    - Aggregate storage metrics and category breakdowns
    - Large file discovery and audit
    - Safe same-directory candidate generation (no cross-volume %TEMP% issues)
    - Two-phase staged replacement with automatic rollback on error
    - Database metadata and duplicate group synchronization
    - Standard library multi-file ZIP archiving
    """

    def __init__(self):
        self._candidate_registry: Dict[str, CandidateRecord] = {}

    # =========================================================================
    # 1. STORAGE SUMMARY & BREAKDOWN
    # =========================================================================

    def get_storage_summary(self, db: Session) -> Dict[str, Any]:
        """
        Calculates total indexed files, size, and category distribution from SQLite.
        """
        files = db.query(File).all()
        total_files = len(files)
        total_size = sum(f.size for f in files) if files else 0

        categories = {
            "Media": {"bytes": 0, "count": 0},
            "Documents": {"bytes": 0, "count": 0},
            "Code & Text": {"bytes": 0, "count": 0},
            "Archives": {"bytes": 0, "count": 0},
            "Other": {"bytes": 0, "count": 0}
        }

        optimizable_count = 0

        for f in files:
            ext = (f.extension or "").lower()
            size = f.size or 0

            if ext in MEDIA_EXTENSIONS:
                categories["Media"]["bytes"] += size
                categories["Media"]["count"] += 1
            elif ext in DOCUMENT_EXTENSIONS:
                categories["Documents"]["bytes"] += size
                categories["Documents"]["count"] += 1
            elif ext in CODE_TEXT_EXTENSIONS:
                categories["Code & Text"]["bytes"] += size
                categories["Code & Text"]["count"] += 1
            elif ext in ARCHIVE_EXTENSIONS:
                categories["Archives"]["bytes"] += size
                categories["Archives"]["count"] += 1
            else:
                categories["Other"]["bytes"] += size
                categories["Other"]["count"] += 1

            if ext in OPTIMIZABLE_EXTENSIONS:
                optimizable_count += 1

        breakdown = []
        for cat_name, cat_data in categories.items():
            pct = round((cat_data["bytes"] / total_size * 100), 1) if total_size > 0 else 0.0
            breakdown.append({
                "category": cat_name,
                "bytes": cat_data["bytes"],
                "formatted": format_bytes(cat_data["bytes"]),
                "count": cat_data["count"],
                "percentage": pct
            })

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "total_size_formatted": format_bytes(total_size),
            "category_breakdown": breakdown,
            "optimizable_candidates_count": optimizable_count
        }

    # =========================================================================
    # 2. LARGE FILES ANALYSIS
    # =========================================================================

    def get_large_files(
        self,
        db: Session,
        min_size_mb: float = 5.0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Retrieves top largest files indexed in SQLite matching minimum size threshold.
        """
        min_bytes = int(max(0.0, min_size_mb) * 1024 * 1024)
        safe_limit = max(1, min(500, limit))

        query = db.query(File).filter(File.size >= min_bytes).order_by(desc(File.size))
        total_count = query.count()
        file_records = query.limit(safe_limit).all()

        items = []
        for f in file_records:
            ext = (f.extension or "").lower()

            if ext in MEDIA_EXTENSIONS:
                cat = "Media"
            elif ext in DOCUMENT_EXTENSIONS:
                cat = "Documents"
            elif ext in CODE_TEXT_EXTENSIONS:
                cat = "Code & Text"
            elif ext in ARCHIVE_EXTENSIONS:
                cat = "Archives"
            else:
                cat = "Other"

            is_opt = ext in OPTIMIZABLE_EXTENSIONS
            opt_type = OPTIMIZABLE_EXTENSIONS.get(ext)

            items.append({
                "id": f.id,
                "name": f.name,
                "path": f.path,
                "size_bytes": f.size,
                "size_formatted": format_bytes(f.size),
                "extension": ext,
                "modified_at": f.modified_at,
                "category": cat,
                "is_optimizable": is_opt,
                "optimization_type": opt_type
            })

        return {
            "items": items,
            "total_count": total_count
        }

    # =========================================================================
    # 2b. OPTIMIZABLE FILES (INDEPENDENT OF SIZE THRESHOLD)
    # =========================================================================

    def get_optimizable_files(
        self,
        db: Session,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Retrieves files supporting individual in-place optimization (JPEG, PNG, BMP, PDF),
        independent of any minimum file size threshold.
        """
        safe_limit = max(1, min(500, limit))
        optimizable_exts = list(OPTIMIZABLE_EXTENSIONS.keys())
        optimizable_exts_upper = [e.upper() for e in optimizable_exts]
        all_exts = list(set(optimizable_exts + optimizable_exts_upper))

        query = db.query(File).filter(File.extension.in_(all_exts)).order_by(desc(File.size))
        total_count = query.count()
        file_records = query.limit(safe_limit).all()

        items = []
        for f in file_records:
            ext = (f.extension or "").lower()

            if ext in MEDIA_EXTENSIONS:
                cat = "Media"
            elif ext in DOCUMENT_EXTENSIONS:
                cat = "Documents"
            elif ext in CODE_TEXT_EXTENSIONS:
                cat = "Code & Text"
            elif ext in ARCHIVE_EXTENSIONS:
                cat = "Archives"
            else:
                cat = "Other"

            items.append({
                "id": f.id,
                "name": f.name,
                "path": f.path,
                "size_bytes": f.size,
                "size_formatted": format_bytes(f.size),
                "extension": ext,
                "modified_at": f.modified_at,
                "category": cat,
                "is_optimizable": True,
                "optimization_type": OPTIMIZABLE_EXTENSIONS.get(ext, "Optimizable")
            })

        return {
            "items": items,
            "total_count": total_count
        }

    # =========================================================================
    # 3. CANDIDATE CREATION (SAME-DIRECTORY SANDBOX)
    # =========================================================================

    def create_optimization_candidate(
        self,
        db: Session,
        file_id: int,
        mode: str = "lossless",
        lossy_quality: int = 82,
        bmp_target_format: str = "png",
        max_dimension: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generates and registers an optimization candidate in the source file's directory.
        Evaluates the meaningful savings threshold (>= 20 KB OR >= 3%).
        """
        self._purge_expired_candidates()

        file_rec = db.query(File).filter(File.id == file_id).first()
        if not file_rec:
            raise StorageServiceError(f"File record with ID {file_id} not found in database.")

        source_path = os.path.abspath(file_rec.path)
        if not os.path.exists(source_path) or not os.path.isfile(source_path):
            return {
                "status": "invalid_file",
                "file_id": file_id,
                "reason": f"Physical source file does not exist on disk: '{source_path}'"
            }

        if not os.access(source_path, os.R_OK):
            return {
                "status": "permission_denied",
                "file_id": file_id,
                "reason": f"Permission denied reading file: '{source_path}'"
            }

        ext = (file_rec.extension or os.path.splitext(source_path)[1]).lower()
        if ext not in OPTIMIZABLE_EXTENSIONS:
            if ext in ARCHIVE_EXTENSIONS or ext in {".mp4", ".mov", ".mkv", ".mp3", ".docx", ".pptx", ".xlsx"}:
                return {
                    "status": "already_compressed",
                    "file_id": file_id,
                    "reason": f"Format '{ext}' is already compressed."
                }
            elif ext in CODE_TEXT_EXTENSIONS or ext in {".txt", ".md", ".csv", ".doc", ".ppt", ".xls"}:
                return {
                    "status": "archival_candidate_only",
                    "file_id": file_id,
                    "reason": f"Plain text/document format '{ext}' can only be compressed via multi-file ZIP archive."
                }
            else:
                return {
                    "status": "unsupported",
                    "file_id": file_id,
                    "reason": f"Optimization for format '{ext}' is not supported in V1."
                }

        original_size = os.path.getsize(source_path)
        original_mtime = os.stat(source_path).st_mtime
        original_hash = file_rec.file_hash or calculate_sha256(source_path)

        # Pre-check: Skip tiny files (< 50 KB)
        if original_size < 50 * 1024 and ext != ".bmp":
            return {
                "status": "no_meaningful_savings",
                "file_id": file_id,
                "original_size": original_size,
                "original_size_formatted": format_bytes(original_size),
                "reason": "File is smaller than 50 KB threshold; optimization yields negligible savings."
            }

        # Secure Token and Same-Directory Staged Path
        token = "cand_" + secrets.token_hex(16)
        source_dir = os.path.dirname(source_path)
        base_name = os.path.basename(source_path)
        candidate_path = os.path.join(source_dir, f".{base_name}.cand_{token}.tmp")

        start_time = time.perf_counter()
        original_dims = None
        candidate_dims = None

        try:
            if ext in (".jpg", ".jpeg", ".png", ".bmp"):
                img_res = image_optimizer.optimize_image(
                    source_path=source_path,
                    candidate_path=candidate_path,
                    mode=mode,
                    lossy_quality=lossy_quality,
                    bmp_target_format=bmp_target_format,
                    max_dimension=max_dimension
                )
                candidate_size = img_res.candidate_size
                strategy_used = img_res.strategy_used
                is_lossless = img_res.is_lossless
                is_format_conv = img_res.is_format_conversion
                original_dims = f"{img_res.width}x{img_res.height}"
                candidate_dims = f"{img_res.candidate_width}x{img_res.candidate_height}" if (img_res.candidate_width and img_res.candidate_height) else original_dims

            elif ext == ".pdf":
                pdf_res = pdf_optimizer.optimize_pdf(
                    source_path=source_path,
                    candidate_path=candidate_path
                )
                candidate_size = pdf_res.candidate_size
                strategy_used = pdf_res.strategy_used
                is_lossless = pdf_res.is_lossless
                is_format_conv = False
                original_dims = None
                candidate_dims = None
            else:
                raise StorageServiceError(f"Unsupported format router for: {ext}")

            execution_time = round((time.perf_counter() - start_time) * 1000, 2)

            bytes_saved = original_size - candidate_size
            pct_saved = round((bytes_saved / original_size) * 100, 2) if original_size > 0 else 0.0

            # Meaningful Savings Threshold: Candidate must be strictly smaller AND save >= 20 KB OR >= 3%
            is_meaningful = (candidate_size < original_size) and (bytes_saved >= 20 * 1024 or pct_saved >= 3.0)

            if not is_meaningful:
                self._safe_remove(candidate_path)
                return {
                    "status": "no_meaningful_savings",
                    "file_id": file_id,
                    "original_size": original_size,
                    "original_size_formatted": format_bytes(original_size),
                    "candidate_size": candidate_size,
                    "candidate_size_formatted": format_bytes(candidate_size),
                    "bytes_saved": bytes_saved,
                    "bytes_saved_formatted": format_bytes(bytes_saved),
                    "percentage_saved": pct_saved,
                    "is_lossless": is_lossless,
                    "strategy_used": strategy_used,
                    "original_dimensions": original_dims,
                    "candidate_dimensions": candidate_dims,
                    "reason": "Candidate produced insufficient savings (< 20 KB and < 3%). Original kept."
                }

            # Register Candidate Record in memory
            self._candidate_registry[token] = CandidateRecord(
                token=token,
                file_id=file_id,
                source_path=source_path,
                candidate_path=candidate_path,
                original_size=original_size,
                candidate_size=candidate_size,
                original_hash=original_hash,
                original_mtime=original_mtime,
                mode=mode,
                strategy=strategy_used,
                is_lossless=is_lossless,
                is_format_conversion=is_format_conv
            )

            return {
                "status": "optimized",
                "file_id": file_id,
                "original_size": original_size,
                "original_size_formatted": format_bytes(original_size),
                "candidate_size": candidate_size,
                "candidate_size_formatted": format_bytes(candidate_size),
                "bytes_saved": bytes_saved,
                "bytes_saved_formatted": format_bytes(bytes_saved),
                "percentage_saved": pct_saved,
                "is_lossless": is_lossless,
                "candidate_token": token,
                "strategy_used": strategy_used,
                "execution_time_ms": execution_time,
                "original_dimensions": original_dims,
                "candidate_dimensions": candidate_dims
            }

        except (ImageOptimizationError, PdfOptimizationError) as opt_err:
            self._safe_remove(candidate_path)
            return {
                "status": "optimization_failed",
                "file_id": file_id,
                "reason": str(opt_err)
            }
        except Exception as e:
            self._safe_remove(candidate_path)
            logger.error(f"Unexpected error generating candidate for file_id {file_id}: {e}", exc_info=True)
            return {
                "status": "optimization_failed",
                "file_id": file_id,
                "reason": f"Unexpected optimization failure: {str(e)}"
            }

    # =========================================================================
    # 4. TWO-PHASE STAGED REPLACEMENT WITH ROLLBACK
    # =========================================================================

    def apply_optimization(
        self,
        db: Session,
        file_id: int,
        candidate_token: str,
        replace_original: bool = True
    ) -> Dict[str, Any]:
        """
        Applies a validated optimization candidate using two-phase staged replacement.
        Guarantees local directory rollback if filesystem or database update fails.
        """
        self._purge_expired_candidates()

        record = self._candidate_registry.get(candidate_token)
        if not record or record.file_id != file_id:
            raise StorageServiceError("Invalid or expired candidate token.")

        source_path = os.path.abspath(record.source_path)
        candidate_path = os.path.abspath(record.candidate_path)

        # Phase A: Verify filesystem state
        if not os.path.exists(candidate_path) or os.path.getsize(candidate_path) != record.candidate_size:
            self._candidate_registry.pop(candidate_token, None)
            raise StorageServiceError("Candidate file is missing or corrupted.")

        if not os.path.exists(source_path):
            self._safe_remove(candidate_path)
            self._candidate_registry.pop(candidate_token, None)
            raise StorageServiceError("Source file no longer exists on disk.")

        # Verify source file has not been modified since candidate was generated
        curr_stat = os.stat(source_path)
        if abs(curr_stat.st_mtime - record.original_mtime) > 1.0 or curr_stat.st_size != record.original_size:
            self._safe_remove(candidate_path)
            self._candidate_registry.pop(candidate_token, None)
            raise StorageServiceError("Source file was modified after candidate was generated. Optimization aborted.")

        file_rec = db.query(File).filter(File.id == file_id).first()
        if not file_rec:
            self._safe_remove(candidate_path)
            self._candidate_registry.pop(candidate_token, None)
            raise StorageServiceError("Database record for source file not found.")

        source_dir = os.path.dirname(source_path)
        base_name = os.path.basename(source_path)

        # Validate candidate is strictly smaller than original
        if record.candidate_size >= record.original_size:
            self._safe_remove(candidate_path)
            self._candidate_registry.pop(candidate_token, None)
            raise StorageServiceError("Candidate file is not smaller than original file.")

        # =====================================================================
        # Branch 1: Non-Destructive "Create New Copy" (replace_original=False)
        # =====================================================================
        if not replace_original:
            return self._apply_create_copy(
                db=db,
                record=record,
                file_rec=file_rec,
                source_path=source_path,
                candidate_path=candidate_path,
                source_dir=source_dir,
                base_name=base_name,
                candidate_token=candidate_token
            )

        # =====================================================================
        # Branch 2: Staged Replacement (replace_original=True)
        # =====================================================================
        # ---------------------------------------------------------------------
        # Case 1: In-Place Replacement (JPEG, PNG, PDF)
        # ---------------------------------------------------------------------
        if not record.is_format_conversion:
            backup_token = secrets.token_hex(8)
            backup_path = os.path.join(source_dir, f".{base_name}.orig_bak_{backup_token}")

            # Phase B: Create local staged backup in same directory
            try:
                os.replace(source_path, backup_path)
            except Exception as bak_err:
                raise StorageServiceError(f"Failed to create staged backup before replacement: {bak_err}")

            # Phase C: Atomic swap candidate -> original
            try:
                os.replace(candidate_path, source_path)

                # Phase D: Validate replacement
                if not os.path.exists(source_path) or os.path.getsize(source_path) != record.candidate_size:
                    raise RuntimeError("Replaced file verification failed.")

                # Phase E: Update SQLite metadata
                new_size = os.path.getsize(source_path)
                new_mtime = datetime.fromtimestamp(os.stat(source_path).st_mtime)
                new_hash = calculate_sha256(source_path)

                file_rec.size = new_size
                file_rec.modified_at = new_mtime
                file_rec.file_hash = new_hash

                # Invalidate stale exact duplicate pairs
                db.query(DuplicateGroup).filter(
                    ((DuplicateGroup.file_a_id == file_id) | (DuplicateGroup.file_b_id == file_id)) &
                    (DuplicateGroup.detection_type == "Exact duplicate")
                ).delete(synchronize_session=False)

                db.commit()

                # Clean up temporary backup after verified commit
                self._safe_remove(backup_path)
                self._candidate_registry.pop(candidate_token, None)

                bytes_saved = record.original_size - new_size
                pct_saved = round((bytes_saved / record.original_size) * 100, 2) if record.original_size > 0 else 0.0
                return {
                    "status": "success",
                    "file_id": file_id,
                    "new_file_id": None,
                    "original_path": source_path,
                    "final_path": source_path,
                    "original_size": record.original_size,
                    "optimized_size": new_size,
                    "final_size_bytes": new_size,
                    "bytes_saved": bytes_saved,
                    "percentage_saved": pct_saved,
                    "is_format_conversion": False,
                    "new_format": None,
                    "message": f"Successfully optimized '{base_name}' ({format_bytes(bytes_saved)} saved)."
                }

            except Exception as replace_err:
                # ROLLBACK: Instantly restore original from backup
                logger.error(f"Replacement failed for '{source_path}', rolling back: {replace_err}", exc_info=True)
                if os.path.exists(backup_path):
                    try:
                        os.replace(backup_path, source_path)
                    except Exception as rb_err:
                        logger.critical(f"FATAL: Rollback failed to restore '{source_path}' from '{backup_path}': {rb_err}")
                self._safe_remove(candidate_path)
                db.rollback()
                raise StorageServiceError(f"Optimization replacement failed; original restored: {replace_err}")

        # ---------------------------------------------------------------------
        # Case 2: Format Conversion (BMP -> PNG)
        # ---------------------------------------------------------------------
        else:
            new_ext = ".png"
            new_name = os.path.splitext(base_name)[0] + new_ext
            new_path = os.path.join(source_dir, new_name)

            # Check destination collision
            if os.path.exists(new_path) and os.path.abspath(new_path) != source_path:
                self._safe_remove(candidate_path)
                self._candidate_registry.pop(candidate_token, None)
                raise StorageServiceError(f"Target converted file already exists: '{new_path}'")

            try:
                # Move candidate into new target path
                os.replace(candidate_path, new_path)

                # Validate new file
                if not os.path.exists(new_path) or os.path.getsize(new_path) != record.candidate_size:
                    raise RuntimeError("Converted PNG verification failed.")

                # Clean old BMP vector chunks from FAISS and SQLite
                indexing_service._delete_file_chunks_and_vectors(db, file_id)

                # Invalidate duplicate groups for old file
                db.query(DuplicateGroup).filter(
                    (DuplicateGroup.file_a_id == file_id) | (DuplicateGroup.file_b_id == file_id)
                ).delete(synchronize_session=False)

                # Remove original BMP
                self._safe_remove(source_path)

                # Update database record to new format identity
                new_size = os.path.getsize(new_path)
                new_mtime = datetime.fromtimestamp(os.stat(new_path).st_mtime)
                new_hash = calculate_sha256(new_path)

                file_rec.path = new_path
                file_rec.name = new_name
                file_rec.extension = new_ext
                file_rec.size = new_size
                file_rec.modified_at = new_mtime
                file_rec.file_hash = new_hash
                file_rec.mime_type = "image/png"
                file_rec.extraction_status = "pending"

                db.commit()
                self._candidate_registry.pop(candidate_token, None)

                bytes_saved = record.original_size - new_size
                pct_saved = round((bytes_saved / record.original_size) * 100, 2) if record.original_size > 0 else 0.0
                return {
                    "status": "success",
                    "file_id": file_id,
                    "new_file_id": None,
                    "original_path": source_path,
                    "final_path": new_path,
                    "original_size": record.original_size,
                    "optimized_size": new_size,
                    "final_size_bytes": new_size,
                    "bytes_saved": bytes_saved,
                    "percentage_saved": pct_saved,
                    "is_format_conversion": True,
                    "new_format": "PNG",
                    "message": f"Successfully converted '{base_name}' to '{new_name}' ({format_bytes(bytes_saved)} saved)."
                }

            except Exception as conv_err:
                logger.error(f"Format conversion failed for '{source_path}': {conv_err}", exc_info=True)
                self._safe_remove(new_path)
                self._safe_remove(candidate_path)
                db.rollback()
                raise StorageServiceError(f"Format conversion failed; original BMP preserved: {conv_err}")

    def _apply_create_copy(
        self,
        db: Session,
        record: CandidateRecord,
        file_rec: File,
        source_path: str,
        candidate_path: str,
        source_dir: str,
        base_name: str,
        candidate_token: str
    ) -> Dict[str, Any]:
        """
        Applies an optimization candidate non-destructively by creating a new copy.
        The original physical file and its database record remain completely untouched.
        """
        stem, ext = os.path.splitext(base_name)
        target_ext = ".png" if record.is_format_conversion else ext

        # Generate non-colliding destination filename:
        # <stem>_optimized.<ext> -> <stem>_optimized (1).<ext> -> <stem>_optimized (2).<ext>...
        counter = 0
        while True:
            if counter == 0:
                cand_name = f"{stem}_optimized{target_ext}"
            else:
                cand_name = f"{stem}_optimized ({counter}){target_ext}"

            cand_path = os.path.join(source_dir, cand_name)

            # Check both filesystem and DB path uniqueness
            path_exists = os.path.exists(cand_path)
            db_exists = db.query(File).filter(File.path == cand_path).first() is not None

            if not path_exists and not db_exists:
                dest_name = cand_name
                dest_path = cand_path
                break

            counter += 1

        try:
            # Atomic same-directory move from candidate temporary path to destination
            os.replace(candidate_path, dest_path)

            # Validate newly created file
            if not os.path.exists(dest_path) or os.path.getsize(dest_path) != record.candidate_size:
                raise RuntimeError("Created copy verification failed.")

            new_size = os.path.getsize(dest_path)
            new_mtime = datetime.fromtimestamp(os.stat(dest_path).st_mtime)
            new_hash = calculate_sha256(dest_path)

            # Determine MIME type
            mime_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".bmp": "image/bmp",
                ".pdf": "application/pdf"
            }
            new_mime = mime_map.get(target_ext.lower(), file_rec.mime_type or "application/octet-stream")

            # Register as a brand new File in database
            new_file_rec = File(
                folder_id=file_rec.folder_id,
                path=dest_path,
                name=dest_name,
                extension=target_ext.lower(),
                size=new_size,
                modified_at=new_mtime,
                file_hash=new_hash,
                mime_type=new_mime,
                extraction_status="pending"
            )
            db.add(new_file_rec)
            db.commit()
            db.refresh(new_file_rec)

            self._candidate_registry.pop(candidate_token, None)

            bytes_saved = record.original_size - new_size
            pct_saved = round((bytes_saved / record.original_size) * 100, 2) if record.original_size > 0 else 0.0

            return {
                "status": "success",
                "file_id": file_rec.id,
                "new_file_id": new_file_rec.id,
                "original_path": source_path,
                "final_path": dest_path,
                "original_size": record.original_size,
                "optimized_size": new_size,
                "final_size_bytes": new_size,
                "bytes_saved": bytes_saved,
                "percentage_saved": pct_saved,
                "is_format_conversion": record.is_format_conversion,
                "new_format": target_ext.lstrip(".").upper() if record.is_format_conversion else None,
                "message": f"Successfully created optimized copy '{dest_name}' ({format_bytes(bytes_saved)} saved). Original preserved."
            }

        except Exception as copy_err:
            logger.error(f"Failed to create new optimized copy for '{source_path}': {copy_err}", exc_info=True)
            db.rollback()
            self._safe_remove(dest_path)
            self._safe_remove(candidate_path)
            self._candidate_registry.pop(candidate_token, None)
            raise StorageServiceError(f"Failed to create optimized copy; original preserved: {copy_err}")

    # =========================================================================
    # 5. MULTI-FILE ZIP ARCHIVING
    # =========================================================================

    def create_zip_archive(
        self,
        db: Session,
        file_ids: List[int],
        destination_path: str,
        compression_level: int = 9,
        overwrite: bool = False
    ) -> Dict[str, Any]:
        """
        Packages multiple database-indexed files into a compressed ZIP archive.
        Prevents path traversal and safely handles duplicate member filenames.
        """
        if not file_ids:
            raise StorageServiceError("At least one file ID must be specified.")

        if not destination_path or not isinstance(destination_path, str):
            raise StorageServiceError("Destination path must be a non-empty string.")

        if not os.path.isabs(destination_path):
            raise StorageServiceError(f"Destination path must be an absolute path: '{destination_path}'")

        dest_abs = os.path.abspath(destination_path)

        if not dest_abs.lower().endswith(".zip"):
            dest_abs += ".zip"

        dest_dir = os.path.dirname(dest_abs)
        if not os.path.exists(dest_dir):
            raise StorageServiceError(f"Destination directory does not exist: '{dest_dir}'")

        if not os.access(dest_dir, os.W_OK):
            raise StorageServiceError(f"Destination directory is not writable: '{dest_dir}'")

        if os.path.exists(dest_abs) and not overwrite:
            raise StorageServiceError(f"Destination archive already exists: '{dest_abs}'. Set overwrite=true to replace.")

        # Validate all file IDs and source files before starting write
        source_items = []
        total_original_bytes = 0

        for fid in file_ids:
            f_rec = db.query(File).filter(File.id == fid).first()
            if not f_rec:
                raise StorageServiceError(f"File ID {fid} not found in database.")

            f_path = os.path.abspath(f_rec.path)
            if not os.path.exists(f_path) or not os.path.isfile(f_path):
                raise StorageServiceError(f"Source file does not exist on disk: '{f_path}'")

            if not os.access(f_path, os.R_OK):
                raise StorageServiceError(f"Permission denied reading source file: '{f_path}'")

            if f_path == dest_abs:
                raise StorageServiceError("Destination archive cannot overwrite one of the input source files.")

            size = os.path.getsize(f_path)
            total_original_bytes += size
            source_items.append((f_path, f_rec.name))

        # Safe level bounding
        comp_level = max(0, min(9, int(compression_level if compression_level is not None else 9)))

        start_time = time.perf_counter()
        used_arcnames: Dict[str, int] = {}

        try:
            with zipfile.ZipFile(dest_abs, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=comp_level) as zf:
                for src_path, orig_name in source_items:
                    # Sanitize arcname: strip path components
                    clean_name = os.path.basename(orig_name)
                    if not clean_name:
                        clean_name = os.path.basename(src_path)

                    # Handle duplicate filenames inside archive
                    if clean_name in used_arcnames:
                        used_arcnames[clean_name] += 1
                        name_stem, name_ext = os.path.splitext(clean_name)
                        arcname = f"{name_stem} ({used_arcnames[clean_name]}){name_ext}"
                    else:
                        used_arcnames[clean_name] = 0
                        arcname = clean_name

                    zf.write(src_path, arcname=arcname)

            archive_size = os.path.getsize(dest_abs)
            execution_time = round((time.perf_counter() - start_time) * 1000, 2)

            bytes_saved = total_original_bytes - archive_size
            pct_saved = round((bytes_saved / total_original_bytes) * 100, 2) if total_original_bytes > 0 else 0.0

            return {
                "status": "success",
                "destination_path": dest_abs,
                "files_archived": len(source_items),
                "total_original_bytes": total_original_bytes,
                "archive_size_bytes": archive_size,
                "percentage_saved": pct_saved,
                "execution_time_ms": execution_time
            }

        except Exception as zip_err:
            self._safe_remove(dest_abs)
            logger.error(f"Failed to create ZIP archive '{dest_abs}': {zip_err}", exc_info=True)
            raise StorageServiceError(f"Failed to create ZIP archive: {str(zip_err)}") from zip_err

    # =========================================================================
    # INTERNAL HELPERS
    # =========================================================================

    def _safe_remove(self, file_path: Optional[str]):
        """Safely removes a file without raising exceptions."""
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.debug(f"Failed to remove file '{file_path}': {e}")

    def _purge_expired_candidates(self):
        """Purges candidate tokens older than TTL and removes orphaned candidate files."""
        now = time.time()
        expired_tokens = [
            token for token, rec in self._candidate_registry.items()
            if (now - rec.created_at) > rec.ttl_seconds
        ]
        for token in expired_tokens:
            rec = self._candidate_registry.pop(token, None)
            if rec:
                self._safe_remove(rec.candidate_path)


storage_service = StorageService()
