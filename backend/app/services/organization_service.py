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

def is_subpath(child_path: Path, parent_path: Path) -> bool:
    r"""
    Windows-safe path containment check.
    Returns True if child_path is strictly inside or equal to parent_path,
    handling drive-letter casing differences (e.g. c:\ vs C:\) safely.
    """
    try:
        norm_child = os.path.normcase(os.path.abspath(str(child_path)))
        norm_parent = os.path.normcase(os.path.abspath(str(parent_path)))
        return os.path.commonpath([norm_child, norm_parent]) == norm_parent
    except Exception:
        return False


def format_friendly_display_path(file_path: str, root_folder_path: Optional[str] = None, root_folder_name: Optional[str] = None) -> str:
    r"""
    Converts absolute filesystem paths to clean, user-friendly relative display paths.
    Examples:
    Root: C:\Users\Rana Ruchi\OneDrive\Desktop\Ruchi
    File: C:\Users\Rana Ruchi\OneDrive\Desktop\Ruchi\Photos\Flowers\rose.jpg
    -> Ruchi / Photos / Flowers
    File in root: C:\Users\Rana Ruchi\OneDrive\Desktop\Ruchi\readme.txt
    -> Ruchi
    """
    if not file_path:
        return "Root Folder"

    try:
        abs_file = os.path.abspath(file_path)
        file_dir = os.path.dirname(abs_file)

        if root_folder_path:
            abs_root = os.path.abspath(root_folder_path)
            root_label = root_folder_name or os.path.basename(abs_root) or "Root"

            if os.path.normcase(file_dir) == os.path.normcase(abs_root):
                return root_label

            if is_subpath(Path(file_dir), Path(abs_root)):
                rel = os.path.relpath(file_dir, abs_root)
                parts = [p for p in rel.replace("\\", "/").split("/") if p and p != "."]
                if parts:
                    return f"{root_label} / {' / '.join(parts)}"
                return root_label

        # Fallback: Clean up drive letters and system parent folders
        parts = [p for p in Path(file_dir).parts if p and not p.endswith(":") and "\\" not in p and "/" not in p]
        filtered = [p for p in parts if p.lower() not in ["users", "desktop", "onedrive", "documents", "downloads"]]
        if len(filtered) >= 3:
            return " / ".join(filtered[-3:])
        elif filtered:
            return " / ".join(filtered)
        elif parts:
            return " / ".join(parts[-2:])
        return os.path.basename(file_dir) or "Root Folder"
    except Exception:
        return os.path.basename(os.path.dirname(file_path)) or "Root Folder"


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

    def analyze_files(self, db: Session, folder_id: Optional[int] = None, force_reanalyze: bool = False) -> Dict[str, int]:
        """
        Runs intelligent classification over indexed files and records organization suggestions & duplicates.
        Reuses saved analysis unless forced or file content has changed.
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
            f_tags = f.get_smart_tags()
            has_existing = f.id in existing_suggestions

            if not force_reanalyze and f_tags and has_existing:
                sug = existing_suggestions[f.id]
                suggestions_count += 1
                if sug.confidence >= 90:
                    high_confidence_count += 1
                continue

            # Run dynamic content-driven analysis
            cat_name, confidence, level, reason, smart_tags = classification_service.classify_file(
                filename=f.name,
                extension=f.extension,
                extracted_text=f.extracted_text or ""
            )

            f.set_smart_tags(smart_tags)

            category_obj = categories.get(cat_name)
            if not category_obj:
                category_obj = categories.get("Education") if ("Java" in cat_name or "Study" in cat_name) else categories.get("Other")
                if not category_obj and categories:
                    category_obj = list(categories.values())[0]

            if has_existing:
                sug = existing_suggestions[f.id]
                if sug.status == "pending":
                    sug.category_id = category_obj.id if category_obj else 1
                    sug.confidence = confidence
                    sug.confidence_level = level
                    sug.reason = reason
                    sug.set_smart_tags(smart_tags)
            else:
                sug = OrganizationSuggestion(
                    file_id=f.id,
                    category_id=category_obj.id if category_obj else 1,
                    confidence=confidence,
                    confidence_level=level,
                    reason=reason,
                    status="pending"
                )
                sug.set_smart_tags(smart_tags)
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
        """Returns formatted suggestions for frontend consumption directly from DB without re-analysis."""
        self.seed_categories(db)
        query = db.query(OrganizationSuggestion).join(File).join(OrganizationCategory)
        if status:
            query = query.filter(OrganizationSuggestion.status == status)

        suggestions = query.all()
        results = []

        for sug in suggestions:
            smart_tags = sug.get_smart_tags()
            if not smart_tags:
                smart_tags = sug.file.get_smart_tags()
                if not smart_tags:
                    _, _, _, _, smart_tags = classification_service.classify_file(
                        filename=sug.file.name,
                        extension=sug.file.extension,
                        extracted_text=sug.file.extracted_text or ""
                    )
                    sug.set_smart_tags(smart_tags)
                    sug.file.set_smart_tags(smart_tags)
                    db.commit()

            folder_path = sug.file.folder.path if sug.file and sug.file.folder else None
            folder_name = sug.file.folder.name if sug.file and sug.file.folder else None
            display_path = format_friendly_display_path(sug.file.path, folder_path, folder_name)

            results.append({
                "id": f"s-{sug.id}",
                "db_id": sug.id,
                "file_id": sug.file_id,
                "filename": sug.file.name,
                "type": sug.file.extension.upper().replace('.', ''),
                "currentPath": sug.file.path,
                "displayPath": display_path,
                "suggestedCategory": sug.category.name if sug.category else "Other",
                "smart_tags": smart_tags,
                "labels": smart_tags,
                "confidence": sug.confidence,
                "confidenceLevel": sug.confidence_level,
                "reason": sug.reason,
                "status": sug.status.capitalize() if sug.status else "Pending"
            })

        return results

    def generate_collective_folder_name(
        self,
        db: Session,
        suggestion_ids: Optional[List[str]] = None,
        file_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes ONE collective physical folder suggestion for a selected group of files
        based on common content, Smart Tags, and semantic similarity.
        """
        target_files = []
        if suggestion_ids:
            clean_ids = []
            for sid in suggestion_ids:
                raw_id = str(sid).replace("s-", "")
                if raw_id.isdigit():
                    clean_ids.append(int(raw_id))
            if clean_ids:
                sugs = db.query(OrganizationSuggestion).filter(OrganizationSuggestion.id.in_(clean_ids)).all()
                target_files = [s.file for s in sugs if s.file]
        elif file_ids:
            target_files = db.query(File).filter(File.id.in_(file_ids)).all()

        if not target_files:
            return {
                "suggested_folder_name": "Organized Files",
                "reason": "Default target folder for selected files.",
                "common_smart_tags": ["General"]
            }

        # Collect Smart Tags and textual concepts across all selected files
        all_tags = []
        tag_counts = {}
        for f in target_files:
            ftags = f.get_smart_tags()
            if not ftags:
                _, _, _, _, ftags = classification_service.classify_file(
                    filename=f.name,
                    extension=f.extension,
                    extracted_text=f.extracted_text or ""
                )
                f.set_smart_tags(ftags)
            all_tags.extend(ftags)
            for t in ftags:
                tag_counts[t] = tag_counts.get(t, 0) + 1

        # Find common Smart Tags appearing across multiple files
        sorted_common_tags = sorted(tag_counts.keys(), key=lambda t: tag_counts[t], reverse=True)
        unique_tags = list(dict.fromkeys(all_tags))[:6]

        # Synthesize a clean, meaningful collective physical folder name
        generic_descriptors = {"Study Material", "Notes", "Documents", "Files", "Programming", "General", "Images"}
        if sorted_common_tags:
            top_tag = sorted_common_tags[0]
            second_tag = sorted_common_tags[1] if len(sorted_common_tags) > 1 and tag_counts[sorted_common_tags[1]] > 0 else None

            if second_tag and second_tag not in generic_descriptors and top_tag not in generic_descriptors:
                folder_name = f"{top_tag} {second_tag}"
            elif second_tag and second_tag in generic_descriptors:
                folder_name = f"{top_tag} {second_tag}"
            elif top_tag in generic_descriptors and second_tag:
                folder_name = f"{second_tag} {top_tag}"
            else:
                folder_name = f"{top_tag} Programming" if top_tag in ["Java", "Python", "C"] else f"{top_tag} Material"

            reason = f"Synthesized based on shared content and common Smart Tags ({', '.join(sorted_common_tags[:3])}) across selected files."
        else:
            folder_name = "Organized Files"
            reason = "Default folder based on selected files."

        return {
            "suggested_folder_name": folder_name,
            "reason": reason,
            "common_smart_tags": unique_tags
        }

    def update_suggestion(
        self,
        db: Session,
        sug_id: int,
        status: Optional[str] = None,
        category_name: Optional[str] = None,
        smart_tags: Optional[List[str]] = None
    ) -> Optional[OrganizationSuggestion]:
        sug = db.query(OrganizationSuggestion).filter(OrganizationSuggestion.id == sug_id).first()
        if not sug:
            return None

        if status:
            sug.status = status.lower()
            sug.reviewed_at = datetime.utcnow()

        if smart_tags is not None:
            sug.set_smart_tags(smart_tags)
            if sug.file:
                sug.file.set_smart_tags(smart_tags)
            sug.status = "edited"
            sug.reviewed_at = datetime.utcnow()

        if category_name:
            clean_name = category_name.strip()
            cat = db.query(OrganizationCategory).filter(OrganizationCategory.name == clean_name).first()
            if not cat:
                cat = OrganizationCategory(
                    name=clean_name,
                    description=f"Custom category: {clean_name}",
                    is_active=True
                )
                db.add(cat)
                db.flush()
                logger.info(f"Created new custom organization category: '{clean_name}'")

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
        Safely supports hierarchical categories such as "ed/kt".
        """
        src_path = Path(file_obj.path).resolve()

        # 1. Determine original scanned root directory from Folder relationship
        if file_obj.folder and file_obj.folder.path:
            root_dir = Path(file_obj.folder.path).resolve()
        else:
            # Fallback if folder model is missing:
            all_cat_names = set(DEFAULT_CATEGORY_DESCRIPTIONS.keys())
            if src_path.parent.name in all_cat_names:
                root_dir = src_path.parent.parent
            else:
                root_dir = src_path.parent

        # Clean category_name to handle subcategory paths like "ed/kt" safely
        clean_cat = category_name.strip().lstrip('/\\')
        parts = [p for p in clean_cat.replace('\\', '/').split('/') if p and p != '..']

        dest_dir = root_dir
        for p in parts:
            dest_dir = dest_dir / p
        dest_dir = dest_dir.resolve()

        # Path traversal protection: ensure dest_dir is within root_dir
        if not is_subpath(dest_dir, root_dir):
            dest_dir = (root_dir / "Other").resolve()

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
                category_name = sug.category.name if sug.category else "Other"

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

    def apply_organization(
        self,
        db: Session,
        selected_ids: Optional[List[str]] = None,
        operation_type: str = "move",
        destination_folder: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Performs safe file movement or copying for approved suggestions with conflict handling & DB path updates.
        Destination is calculated relative to scanned root, ensuring idempotency and preventing nested paths.
        If destination_folder is specified, all selected files are organized into that target folder.
        Safely reuses existing physical folders without duplicating them.
        """
        op_type = "copy" if operation_type and operation_type.lower() == "copy" else "move"

        query = db.query(OrganizationSuggestion)
        if selected_ids is not None:
            clean_ids = []
            for sid in selected_ids:
                raw_id = str(sid).replace("s-", "")
                if raw_id.isdigit():
                    clean_ids.append(int(raw_id))
            if clean_ids:
                query = query.filter(OrganizationSuggestion.id.in_(clean_ids))
            else:
                return {
                    "status": "success",
                    "files_moved": 0,
                    "files_copied": 0,
                    "errors": [],
                    "message": "No selected files to organize."
                }
        else:
            query = query.filter(OrganizationSuggestion.status.in_(["accepted", "edited", "pending"]))

        query = query.filter(OrganizationSuggestion.status != "rejected")
        suggestions = query.all()

        if not suggestions:
            return {
                "status": "success",
                "files_moved": 0,
                "files_copied": 0,
                "errors": ["No matching database suggestions found for selected IDs."],
                "message": "No files were organized because selected suggestions were not found in database."
            }

        files_moved = 0
        files_copied = 0
        errors = []
        target_folder_name = destination_folder.strip().lstrip('/\\') if destination_folder and destination_folder.strip() else None

        for sug in suggestions:
            file_obj = sug.file
            src_path = Path(file_obj.path).resolve()

            # Safety check 1: Verify source exists
            if not src_path.exists() or not src_path.is_file():
                err = f"Source file does not exist: {src_path}"
                logger.error(err)
                errors.append(err)
                continue

            folder_destination = target_folder_name if target_folder_name else (sug.category.name if sug.category else "Other")
            root_dir, dest_dir, dest_file = self._get_scanned_root_and_target_path(file_obj, folder_destination)

            # Idempotency check: If file is ALREADY in destination folder, skip move/copy
            if src_path == dest_file:
                logger.info(f"File '{src_path.name}' is already in target location '{dest_file}'. Skipping operation.")
                sug.status = "accepted"
                continue

            # Safety check 2: Windows-safe path traversal protection
            if not is_subpath(dest_dir, root_dir):
                err = f"Path traversal error for {dest_dir}"
                logger.error(err)
                errors.append(err)
                continue

            # Create destination folder under scanned root (mkdir with exist_ok=True safely REUSES existing folder)
            dest_dir.mkdir(parents=True, exist_ok=True)

            # Safety check 3: Conflict resolution (append counter ONLY if dest file already exists and is not src)
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
                operation_type=op_type,
                status="pending"
            )
            db.add(op_record)
            db.flush()

            # Perform file move or copy safely
            try:
                if op_type == "copy":
                    shutil.copy2(str(src_path), str(dest_file))
                    files_copied += 1
                    logger.info(f"Successfully copied '{src_path.name}' to '{dest_file}'")
                else:
                    shutil.move(str(src_path), str(dest_file))
                    file_obj.path = str(dest_file)
                    file_obj.name = dest_file.name
                    file_obj.updated_at = datetime.utcnow()
                    files_moved += 1
                    logger.info(f"Successfully moved '{src_path.name}' to '{dest_file}'")

                sug.status = "accepted"
                sug.reviewed_at = datetime.utcnow()

                op_record.status = "completed"
                op_record.completed_at = datetime.utcnow()
            except Exception as op_err:
                op_record.status = "failed"
                op_record.error = str(op_err)
                err = f"Failed to {op_type} {src_path.name}: {op_err}"
                logger.error(err)
                errors.append(err)

        db.commit()
        return {
            "status": "success" if not errors else "partial_success",
            "files_moved": files_moved,
            "files_copied": files_copied,
            "errors": errors,
            "message": f"Successfully organized files ({files_moved} moved, {files_copied} copied)."
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

    def get_overview(self, db: Session) -> Dict[str, Any]:
        """
        Returns rich organization overview containing BOTH:
        1. Existing physical folders & subfolder hierarchy
        2. Memora AI suggested & created categories
        """
        folders = db.query(Folder).filter(Folder.is_active == True).all()
        all_files = db.query(File).all()
        suggestions = db.query(OrganizationSuggestion).join(OrganizationCategory).all()

        # 1. Existing Physical Folders
        existing_folders_list = []
        files_by_folder: Dict[int, List[File]] = {}
        for f in all_files:
            files_by_folder.setdefault(f.folder_id, []).append(f)

        for folder in folders:
            f_list = files_by_folder.get(folder.id, [])
            subfolder_counts: Dict[str, int] = {}
            for f in f_list:
                disp_path = format_friendly_display_path(f.path, folder.path, folder.name)
                subfolder_counts[disp_path] = subfolder_counts.get(disp_path, 0) + 1

            subfolders_breakdown = [
                {"name": sp.split(" / ")[-1] if " / " in sp else sp, "path": folder.path, "displayPath": sp, "fileCount": cnt, "subfolders": []}
                for sp, cnt in sorted(subfolder_counts.items(), key=lambda x: x[0])
            ]
            existing_folders_list.append({
                "name": folder.name,
                "path": folder.path,
                "displayPath": folder.name,
                "fileCount": len(f_list),
                "subfolders": subfolders_breakdown
            })

        # 2. AI Categories & Distribution
        counts: Dict[str, int] = {}
        for sug in suggestions:
            cat_name = sug.category.name if sug.category else "Other"
            counts[cat_name] = counts.get(cat_name, 0) + 1

        total_files = len(suggestions) if suggestions else len(all_files)
        categories = self.get_categories(db)

        ai_categories_list = []
        for cat in categories:
            f_count = counts.get(cat.name, 0)
            if f_count > 0:
                pct = round((f_count / total_files) * 100, 1) if total_files > 0 else 0.0
                ai_categories_list.append({
                    "category": cat.name,
                    "fileCount": f_count,
                    "totalFiles": total_files,
                    "percentage": pct
                })

        return {
            "existingFolders": existing_folders_list,
            "aiCategories": ai_categories_list,
            "totalFiles": total_files
        }

organization_service = OrganizationService()
