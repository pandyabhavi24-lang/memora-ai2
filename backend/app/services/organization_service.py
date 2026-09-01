import os
import shutil
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from sqlalchemy.orm import Session

from ..models import (
    File,
    Folder,
    OrganizationCategory,
    OrganizationSuggestion,
    DuplicateGroup,
    FileOperation
)
from .classification_service import classification_service, DEFAULT_CATEGORY_DESCRIPTIONS
from .duplicate_service import duplicate_service

logger = logging.getLogger("memora.organization")

DEFAULT_CATEGORIES = [
    ("Documents", "General textual files, notes, draft documents, and miscellaneous correspondence."),
    ("Education", "Academic notes, university study materials, lectures, course assignments, and tutorials."),
    ("Projects", "Technical project reports, software documentation, architecture specifications, and slides."),
    ("Work", "Professional documents, resumes, CVs, offer letters, and job application records."),
    ("Certificates", "Certificates of completion, training credentials, and official awards."),
    ("Finance", "Invoices, billing records, payment receipts, and financial statements."),
    ("Personal", "Personal identification documents, ID cards, passport copies, and private records."),
    ("Images", "Photos, diagrams, graphic illustrations, and screenshots."),
    ("Other", "Miscellaneous files, system text notes, and unclassified log data.")
]

class OrganizationService:
    def seed_categories(self, db: Session) -> List[OrganizationCategory]:
        """Ensure default categories are seeded in the database."""
        existing = {c.name: c for c in db.query(OrganizationCategory).all()}
        seeded = []
        for name, desc in DEFAULT_CATEGORIES:
            if name not in existing:
                cat = OrganizationCategory(name=name, description=desc, is_active=True)
                db.add(cat)
                seeded.append(cat)
        if seeded:
            db.commit()
            logger.info(f"Seeded {len(seeded)} default organization categories.")
        return db.query(OrganizationCategory).filter(OrganizationCategory.is_active == True).all()

    def get_categories(self, db: Session) -> List[OrganizationCategory]:
        self.seed_categories(db)
        return db.query(OrganizationCategory).filter(OrganizationCategory.is_active == True).all()

    def analyze_files(self, db: Session, folder_id: Optional[int] = None) -> Dict[str, int]:
        """
        Runs hybrid classification over indexed files and records organization suggestions & duplicates.
        """
        categories = {c.name: c for c in self.get_categories(db)}

        # Fetch indexed files
        query = db.query(File)
        if folder_id:
            query = query.filter(File.folder_id == folder_id)
        files = query.all()

        if not files:
            logger.info("No files found in database to analyze.")
            return {
                "files_analyzed": 0,
                "suggestions_generated": 0,
                "high_confidence": 0,
                "duplicate_groups": 0
            }

        existing_suggestions = {s.file_id: s for s in db.query(OrganizationSuggestion).all()}
        high_confidence_count = 0
        suggestions_count = 0

        for f in files:
            cat_name, confidence, level, reason = classification_service.classify_file(
                filename=f.name,
                extension=f.extension,
                extracted_text=f.extracted_text or ""
            )

            category_obj = categories.get(cat_name) or categories.get("Other")

            if f.id in existing_suggestions:
                sug = existing_suggestions[f.id]
                # Update if pending
                if sug.status == "pending":
                    sug.category_id = category_obj.id
                    sug.confidence = confidence
                    sug.confidence_level = level
                    sug.reason = reason
            else:
                sug = OrganizationSuggestion(
                    file_id=f.id,
                    category_id=category_obj.id,
                    confidence=confidence,
                    confidence_level=level,
                    reason=reason,
                    status="pending"
                )
                db.add(sug)

            suggestions_count += 1
            if confidence >= 90:
                high_confidence_count += 1

        db.commit()

        # Run duplicate detection
        duplicates = duplicate_service.find_and_record_duplicates(db)

        return {
            "files_analyzed": len(files),
            "suggestions_generated": suggestions_count,
            "high_confidence": high_confidence_count,
            "duplicate_groups": len(duplicates)
        }

    def get_suggestions(self, db: Session, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns formatted suggestions for frontend consumption."""
        self.seed_categories(db)
        query = db.query(OrganizationSuggestion).join(File).join(OrganizationCategory)
        if status:
            query = query.filter(OrganizationSuggestion.status == status)

        suggestions = query.all()
        results = []

        for sug in suggestions:
            # Map path to display format (e.g., Downloads/file.pdf)
            rel_path = sug.file.path
            try:
                rel_path = os.path.relpath(sug.file.path, start=os.path.dirname(sug.file.path))
            except Exception:
                pass

            results.append({
                "id": f"s-{sug.id}",
                "db_id": sug.id,
                "file_id": sug.file_id,
                "filename": sug.file.name,
                "type": sug.file.extension.upper().replace('.', ''),
                "currentPath": sug.file.path,
                "suggestedCategory": sug.category.name,
                "confidence": sug.confidence,
                "confidenceLevel": sug.confidence_level,
                "reason": sug.reason,
                "status": sug.status.capitalize() if sug.status else "Pending"
            })

        return results

    def update_suggestion(
        self,
        db: Session,
        sug_id: int,
        status: Optional[str] = None,
        category_name: Optional[str] = None
    ) -> Optional[OrganizationSuggestion]:
        sug = db.query(OrganizationSuggestion).filter(OrganizationSuggestion.id == sug_id).first()
        if not sug:
            return None

        if status:
            sug.status = status.lower()
            sug.reviewed_at = datetime.utcnow()

        if category_name:
            cat = db.query(OrganizationCategory).filter(OrganizationCategory.name == category_name).first()
            if cat:
                sug.category_id = cat.id
                sug.status = "edited"
                sug.reviewed_at = datetime.utcnow()

        db.commit()
        db.refresh(sug)
        return sug

    def _get_scanned_root_and_target_path(self, file_obj: File, category_name: str) -> Tuple[Path, Path, Path]:
        """
        Determines (root_dir, dest_dir, dest_file) for a file and target category.
        Ensures destination path is ALWAYS calculated relative to the ORIGINAL SCANNED ROOT,
        preventing nested paths like java/Work/Work/Finance/file.pdf.
        """
        src_path = Path(file_obj.path).resolve()

        # 1. Determine original scanned root directory from Folder relationship
        if file_obj.folder and file_obj.folder.path:
            root_dir = Path(file_obj.folder.path).resolve()
        else:
            # Fallback if folder model is missing:
            # Check if immediate parent is an active category folder name
            all_cat_names = set(DEFAULT_CATEGORY_DESCRIPTIONS.keys())
            if src_path.parent.name in all_cat_names:
                root_dir = src_path.parent.parent
            else:
                root_dir = src_path.parent

        dest_dir = (root_dir / category_name).resolve()
        dest_file = dest_dir / src_path.name

        return root_dir, dest_dir, dest_file

    def generate_preview(self, db: Session) -> List[Dict[str, Any]]:
        """
        Calculates proposed destination paths relative to scanned root without touching the filesystem.
        """
        suggestions = db.query(OrganizationSuggestion).all()
        preview_items = []

        for sug in suggestions:
            if sug.status in ["accepted", "edited", "pending"]:
                file_obj = sug.file
                category_name = sug.category.name

                root_dir, dest_dir, dest_file = self._get_scanned_root_and_target_path(file_obj, category_name)

                preview_items.append({
                    "id": f"s-{sug.id}",
                    "file_id": file_obj.id,
                    "filename": file_obj.name,
                    "currentPath": file_obj.path,
                    "suggestedCategory": category_name,
                    "proposedPath": str(dest_file),
                    "operation": "move"
                })

        return preview_items

    def apply_organization(self, db: Session, selected_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Performs safe file movement for approved suggestions with conflict handling & DB path updates.
        Destination is calculated relative to scanned root, ensuring idempotency and preventing nested paths.
        """
        query = db.query(OrganizationSuggestion).filter(
            OrganizationSuggestion.status.in_(["accepted", "edited"])
        )
        suggestions = query.all()

        files_moved = 0
        errors = []

        for sug in suggestions:
            file_obj = sug.file
            src_path = Path(file_obj.path).resolve()

            # Safety check 1: Verify source exists
            if not src_path.exists() or not src_path.is_file():
                err = f"Source file does not exist: {src_path}"
                logger.error(err)
                errors.append(err)
                continue

            category_name = sug.category.name
            root_dir, dest_dir, dest_file = self._get_scanned_root_and_target_path(file_obj, category_name)

            # Idempotency check: If file is ALREADY in target category destination folder, skip move
            if src_path == dest_file:
                logger.info(f"File '{src_path.name}' is already in target location '{dest_file}'. Skipping move.")
                continue

            # Safety check 2: Path traversal protection
            try:
                dest_dir.resolve()
            except Exception as e:
                err = f"Path resolution error for {dest_dir}: {e}"
                errors.append(err)
                continue

            # Create destination folder under scanned root
            dest_dir.mkdir(parents=True, exist_ok=True)

            # Safety check 3: Conflict resolution (append number if target exists)
            if dest_file.exists() and dest_file != src_path:
                stem = src_path.stem
                ext = src_path.suffix
                counter = 1
                while dest_file.exists():
                    dest_file = dest_dir / f"{stem} ({counter}){ext}"
                    counter += 1

            op_record = FileOperation(
                file_id=file_obj.id,
                source_path=str(src_path),
                destination_path=str(dest_file),
                operation_type="move",
                status="pending"
            )
            db.add(op_record)
            db.flush()

            # Perform file move safely
            try:
                shutil.move(str(src_path), str(dest_file))
                
                # Update file model path in database
                file_obj.path = str(dest_file)
                file_obj.name = dest_file.name
                file_obj.updated_at = datetime.utcnow()

                op_record.status = "completed"
                op_record.completed_at = datetime.utcnow()
                files_moved += 1
                logger.info(f"Successfully moved '{src_path.name}' to '{dest_file}'")
            except Exception as move_err:
                op_record.status = "failed"
                op_record.error = str(move_err)
                err = f"Failed to move {src_path.name}: {move_err}"
                logger.error(err)
                errors.append(err)

        db.commit()
        return {
            "status": "success" if not errors else "partial_success",
            "files_moved": files_moved,
            "errors": errors,
            "message": f"Successfully organized {files_moved} files. Demo/Live file operation recorded."
        }

    def get_duplicates(self, db: Session) -> List[Dict[str, Any]]:
        groups = db.query(DuplicateGroup).all()
        results = []

        for g in groups:
            def format_size(size_bytes: int) -> str:
                if size_bytes < 1024:
                    return f"{size_bytes} B"
                elif size_bytes < 1024 * 1024:
                    return f"{size_bytes / 1024:.1f} KB"
                else:
                    return f"{size_bytes / (1024 * 1024):.1f} MB"

            file_a_detail = {
                "filename": g.file_a.name,
                "path": g.file_a.path,
                "size": format_size(g.file_a.size)
            }
            file_b_detail = {
                "filename": g.file_b.name,
                "path": g.file_b.path,
                "size": format_size(g.file_b.size)
            }

            results.append({
                "id": g.group_key,
                "fileA": file_a_detail,
                "fileB": file_b_detail,
                "similarity": g.similarity,
                "detectionType": g.detection_type,
                "status": g.status.capitalize() if g.status else "Unresolved"
            })

        return results

    def get_operations(self, db: Session) -> List[Dict[str, Any]]:
        ops = db.query(FileOperation).order_by(FileOperation.created_at.desc()).all()
        results = []
        for op in ops:
            fname = op.file.name if (op.file and op.file.name) else os.path.basename(op.source_path)
            results.append({
                "id": op.id,
                "file_id": op.file_id,
                "filename": fname,
                "source_path": op.source_path,
                "destination_path": op.destination_path,
                "operation_type": op.operation_type,
                "status": op.status,
                "created_at": op.created_at
            })
        return results

    def get_overview(self, db: Session) -> List[Dict[str, Any]]:
        """
        Calculates category distribution from real organization suggestions in the database.
        Returns empty list [] if no suggestions exist yet.
        """
        suggestions = db.query(OrganizationSuggestion).join(OrganizationCategory).all()
        if not suggestions:
            return []

        counts: Dict[str, int] = {}
        for sug in suggestions:
            cat_name = sug.category.name
            counts[cat_name] = counts.get(cat_name, 0) + 1

        total_files = len(suggestions)
        categories = self.get_categories(db)

        overview = []
        for cat in categories:
            f_count = counts.get(cat.name, 0)
            if f_count > 0:
                pct = round((f_count / total_files) * 100, 1) if total_files > 0 else 0.0
                overview.append({
                    "category": cat.name,
                    "fileCount": f_count,
                    "totalFiles": total_files,
                    "percentage": pct
                })

        return overview

organization_service = OrganizationService()
