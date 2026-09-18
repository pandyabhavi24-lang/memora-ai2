import os
import logging
from typing import List, Dict, Any, Optional
from PIL import Image

logger = logging.getLogger("memora.pdf_service")

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    logger.warning("pypdf is not installed. PDF Studio backend operations will be limited.")

try:
    import reportlab
    from reportlab.lib.pagesizes import A4, letter, legal, landscape, portrait
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
        PageBreak, Table, TableStyle, KeepTogether, HRFlowable, Frame
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab is not installed. PDF Generation capabilities will be limited.")


if REPORTLAB_AVAILABLE:
    class NumberedCanvas(canvas.Canvas):
        """
        Two-pass canvas to dynamically compute total page count and draw 'Page X of Y'.
        """
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_number(num_pages)
                super().showPage()
            super().save()

        def draw_page_number(self, page_count):
            self.saveState()
            self.setFont("Helvetica", 9)
            self.setFillColor(colors.HexColor("#64748b"))
            
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(self._pagesize[0] - 36, 24, page_text)
            
            # Subtle footer line
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(36, 38, self._pagesize[0] - 36, 38)
            self.restoreState()
else:
    NumberedCanvas = None


class PdfService:
    """
    Core backend service for Module 4 — PDF Studio.
    Provides robust, safe, local PDF operations:
    - Path validation and integrity checks
    - Document inspection (metadata, page metrics, rotation)
    - Blank document generation
    - ReportLab professional PDF generation (text, images, mixed layouts)
    - Page operations (rotate, reorder, delete, duplicate)
    - PDF Merging, Interleaving/Alternating, and Splitting
    - Images to PDF conversion
    """

    @staticmethod
    def is_ready() -> Dict[str, Any]:
        return {
            "pypdf_available": PYPDF_AVAILABLE,
            "pil_available": True,
            "reportlab_available": REPORTLAB_AVAILABLE,
            "status": "ready" if (PYPDF_AVAILABLE and REPORTLAB_AVAILABLE) else "degraded"
        }

    @staticmethod
    def validate_pdf_path(file_path: str) -> str:
        """
        Validates file path existence, file extension, and PDF readability.
        """
        if not file_path or not isinstance(file_path, str):
            raise ValueError("File path must be a non-empty string.")

        abs_path = os.path.abspath(file_path)

        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"File not found: {abs_path}")

        if not os.path.isfile(abs_path):
            raise ValueError(f"Path is not a file: {abs_path}")

        if not abs_path.lower().endswith(".pdf"):
            raise ValueError(f"File is not a PDF document: {abs_path}")

        if not PYPDF_AVAILABLE:
            raise RuntimeError("pypdf library is unavailable.")

        try:
            reader = pypdf.PdfReader(abs_path)
            # Access pages count to verify header integrity
            _ = len(reader.pages)
        except Exception as e:
            logger.error(f"Failed to parse PDF header for {abs_path}: {e}")
            raise ValueError(f"Corrupted or unreadable PDF document: {e}")

        return abs_path

    def inspect_pdf(self, file_path: str) -> Dict[str, Any]:
        """
        Extracts structural page details, dimensions, and metadata from a PDF file.
        """
        abs_path = self.validate_pdf_path(file_path)
        reader = pypdf.PdfReader(abs_path)

        file_name = os.path.basename(abs_path)
        file_size = os.path.getsize(abs_path)
        is_encrypted = reader.is_encrypted

        pages_info = []
        for idx, page in enumerate(reader.pages):
            width = float(page.mediabox.width) if page.mediabox else 0.0
            height = float(page.mediabox.height) if page.mediabox else 0.0
            rotation = page.get('/Rotate', 0)
            if isinstance(rotation, int):
                rot_val = rotation
            else:
                try:
                    rot_val = int(rotation)
                except Exception:
                    rot_val = 0

            pages_info.append({
                "page_index": idx,
                "width": round(width, 2),
                "height": round(height, 2),
                "rotation": rot_val
            })

        metadata = {}
        if reader.metadata:
            for k, v in reader.metadata.items():
                clean_key = str(k).lstrip('/')
                metadata[clean_key] = str(v)

        return {
            "file_path": abs_path,
            "file_name": file_name,
            "file_size_bytes": file_size,
            "page_count": len(reader.pages),
            "encrypted": is_encrypted,
            "pages": pages_info,
            "metadata": metadata
        }

    @staticmethod
    def get_page_dimensions(page_size: str = "A4", orientation: str = "portrait") -> tuple:
        """
        Returns (width_pt, height_pt) for standard page sizes:
        A4: 595.28 x 841.89 pt
        Letter: 612.0 x 792.0 pt
        Legal: 612.0 x 1008.0 pt
        """
        size_key = (page_size or "A4").upper().strip()
        orient_key = (orientation or "portrait").lower().strip()

        sizes = {
            "A4": (595.28, 841.89),
            "LETTER": (612.0, 792.0),
            "LEGAL": (612.0, 1008.0)
        }

        w, h = sizes.get(size_key, sizes["A4"])
        if orient_key == "landscape":
            return (h, w)
        return (w, h)

    def create_blank_pdf(
        self,
        file_name: str,
        output_dir: Optional[str] = None,
        page_count: int = 1,
        page_size: str = "A4",
        orientation: str = "portrait",
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Creates a blank PDF document with configurable page dimensions (A4, Letter, Legal) and orientation.
        """
        if not PYPDF_AVAILABLE:
            raise RuntimeError("pypdf is required to create PDF files.")

        if not file_name.lower().endswith(".pdf"):
            file_name += ".pdf"

        if not output_dir:
            output_dir = os.path.join(os.path.expanduser("~"), "Documents")
        
        os.makedirs(output_dir, exist_ok=True)
        target_path = os.path.abspath(os.path.join(output_dir, file_name))

        width, height = self.get_page_dimensions(page_size, orientation)

        writer = pypdf.PdfWriter()
        for _ in range(max(1, page_count)):
            writer.add_blank_page(width=width, height=height)

        with open(target_path, "wb") as f:
            writer.write(f)

        file_id = None
        pdf_doc_id = None

        if db and register_in_db:
            file_id = self.register_file_in_memora_db(db, target_path, folder_id)
            pdf_doc = self.register_or_get_document_record(db, target_path, title=file_name, file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": target_path,
            "file_name": os.path.basename(target_path),
            "page_count": max(1, page_count),
            "file_size_bytes": os.path.getsize(target_path),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully created {page_size} ({orientation}) blank PDF with {page_count} page(s)."
        }

    def manipulate_pages(
        self,
        source_path: str,
        actions: List[Dict[str, Any]],
        output_path: Optional[str] = None,
        db=None,
        sync_db: bool = True
    ) -> Dict[str, Any]:
        """
        Applies page-level operations (rotate, delete, duplicate, add_blank, add_source) to a PDF safely.
        """
        abs_source = self.validate_pdf_path(source_path)
        reader = pypdf.PdfReader(abs_source)
        total_pages = len(reader.pages)

        if not actions:
            raise ValueError("No page actions provided.")

        if not output_path:
            output_path = abs_source

        abs_output = os.path.abspath(output_path)

        # Validate action page indices
        deleted_indices = set()
        for a in actions:
            act_type = a.get("action")
            idx = a.get("page_index")

            if act_type in ("rotate", "delete", "duplicate"):
                if idx is None or not isinstance(idx, int) or idx < 0 or idx >= total_pages:
                    raise ValueError(f"Invalid page index {idx} for action '{act_type}'. Total pages: {total_pages}.")

            if act_type == "delete":
                deleted_indices.add(idx)

            if act_type == "rotate":
                deg = a.get("degrees")
                if deg not in (90, 180, 270, 360, -90, -180, -270):
                    raise ValueError(f"Invalid rotation degrees {deg}. Must be 90, 180, or 270.")

        if len(deleted_indices) >= total_pages:
            raise ValueError("Cannot delete all pages from a PDF document.")

        writer = pypdf.PdfWriter()

        for idx, page in enumerate(reader.pages):
            if idx in deleted_indices:
                continue

            # Check rotation actions
            rot_actions = [a for a in actions if a.get("action") == "rotate" and a.get("page_index") == idx]
            for ra in rot_actions:
                deg = ra.get("degrees", 90)
                page.rotate(deg)

            writer.add_page(page)

            # Check duplication action
            dup_actions = [a for a in actions if a.get("action") == "duplicate" and a.get("page_index") == idx]
            for _ in dup_actions:
                dup_page = pypdf.PdfReader(abs_source).pages[idx]
                writer.add_page(dup_page)

            # Check add_blank action at target_index
            blank_actions = [a for a in actions if a.get("action") == "add_blank" and a.get("target_index") == idx]
            for ba in blank_actions:
                w, h = self.get_page_dimensions(ba.get("page_size", "A4"), ba.get("orientation", "portrait"))
                writer.add_blank_page(width=w, height=h)

            # Check add_source action at target_index
            src_actions = [a for a in actions if a.get("action") == "add_source" and a.get("target_index") == idx]
            for sa in src_actions:
                src_path = sa.get("source_pdf_path")
                src_idx = sa.get("source_page_index", 0)
                if src_path and os.path.exists(src_path):
                    src_reader = pypdf.PdfReader(src_path)
                    if 0 <= src_idx < len(src_reader.pages):
                        writer.add_page(src_reader.pages[src_idx])

        # Write to temp file first for file safety
        temp_out = abs_output + ".tmp"
        os.makedirs(os.path.dirname(abs_output), exist_ok=True)
        with open(temp_out, "wb") as f:
            writer.write(f)

        # Replace target safely
        if os.path.exists(abs_output):
            os.remove(abs_output)
        os.rename(temp_out, abs_output)

        final_reader = pypdf.PdfReader(abs_output)
        final_page_count = len(final_reader.pages)

        file_id = None
        pdf_doc_id = None

        if db and sync_db:
            file_id = self.register_file_in_memora_db(db, abs_output)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": final_page_count,
            "file_size_bytes": os.path.getsize(abs_output),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully applied page operations on {os.path.basename(abs_output)}."
        }

    def reorder_pages(
        self,
        source_path: str,
        new_page_order: List[int],
        output_path: Optional[str] = None,
        db=None,
        sync_db: bool = True
    ) -> Dict[str, Any]:
        """
        Reorders physical pages in a PDF document according to a specified 0-based page sequence.
        """
        abs_source = self.validate_pdf_path(source_path)
        reader = pypdf.PdfReader(abs_source)
        total_pages = len(reader.pages)

        if not new_page_order:
            raise ValueError("Page order sequence cannot be empty.")

        for idx in new_page_order:
            if not isinstance(idx, int) or idx < 0 or idx >= total_pages:
                raise ValueError(f"Invalid page index {idx} in page order. Must be between 0 and {total_pages - 1}.")

        if not output_path:
            output_path = abs_source

        abs_output = os.path.abspath(output_path)
        writer = pypdf.PdfWriter()

        for idx in new_page_order:
            writer.add_page(reader.pages[idx])

        temp_out = abs_output + ".tmp"
        os.makedirs(os.path.dirname(abs_output), exist_ok=True)
        with open(temp_out, "wb") as f:
            writer.write(f)

        if os.path.exists(abs_output):
            os.remove(abs_output)
        os.rename(temp_out, abs_output)

        final_reader = pypdf.PdfReader(abs_output)
        final_page_count = len(final_reader.pages)

        file_id = None
        pdf_doc_id = None

        if db and sync_db:
            file_id = self.register_file_in_memora_db(db, abs_output)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": final_page_count,
            "file_size_bytes": os.path.getsize(abs_output),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully reordered pages for {os.path.basename(abs_output)}."
        }

    def extract_pages(
        self,
        source_path: str,
        pages: List[int],
        output_path: str,
        db=None,
        sync_db: bool = True
    ) -> Dict[str, Any]:
        """
        Creates a new PDF document containing only the specified page indices.
        """
        abs_source = self.validate_pdf_path(source_path)
        reader = pypdf.PdfReader(abs_source)
        total_pages = len(reader.pages)

        if not pages:
            raise ValueError("No page indices specified for extraction.")

        valid_indices = []
        for idx in pages:
            if not isinstance(idx, int) or idx < 0 or idx >= total_pages:
                raise ValueError(f"Page index {idx} out of bounds (0 to {total_pages - 1}).")
            valid_indices.append(idx)

        abs_output = os.path.abspath(output_path)
        writer = pypdf.PdfWriter()

        for idx in valid_indices:
            writer.add_page(reader.pages[idx])

        temp_out = abs_output + ".tmp"
        os.makedirs(os.path.dirname(abs_output), exist_ok=True)
        with open(temp_out, "wb") as f:
            writer.write(f)

        if os.path.exists(abs_output):
            os.remove(abs_output)
        os.rename(temp_out, abs_output)

        final_reader = pypdf.PdfReader(abs_output)
        final_page_count = len(final_reader.pages)

        file_id = None
        pdf_doc_id = None

        if db and sync_db:
            file_id = self.register_file_in_memora_db(db, abs_output)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": final_page_count,
            "file_size_bytes": os.path.getsize(abs_output),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully extracted {len(valid_indices)} page(s) into {os.path.basename(abs_output)}."
        }

    def merge_pdfs(
        self,
        source_paths: List[str],
        output_path: str,
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Merges multiple PDF files in user-defined order into a single target output PDF.
        Validates path existence, PDF header readability, output directory writability,
        and registers the output file in Memora DB. Source files are preserved intact.
        """
        if not source_paths or not isinstance(source_paths, list) or len(source_paths) < 2:
            raise ValueError("At least two source PDF paths are required for merging.")

        validated_paths = [self.validate_pdf_path(p) for p in source_paths]

        abs_output = os.path.abspath(output_path)
        output_dir = os.path.dirname(abs_output)
        if not output_dir:
            output_dir = os.getcwd()

        os.makedirs(output_dir, exist_ok=True)
        if not os.access(output_dir, os.W_OK):
            raise PermissionError(f"Target directory '{output_dir}' is not writable.")

        writer = pypdf.PdfWriter()
        for path in validated_paths:
            writer.append(path)

        temp_out = abs_output + ".tmp"
        with open(temp_out, "wb") as f:
            writer.write(f)
        writer.close()

        if os.path.exists(abs_output):
            os.remove(abs_output)
        os.rename(temp_out, abs_output)

        final_reader = pypdf.PdfReader(abs_output)
        final_page_count = len(final_reader.pages)

        file_id = None
        pdf_doc_id = None

        if db and register_in_db:
            file_id = self.register_file_in_memora_db(db, abs_output, folder_id)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": final_page_count,
            "file_size_bytes": os.path.getsize(abs_output),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully merged {len(source_paths)} PDF files into {os.path.basename(abs_output)}."
        }

    def alternate_pages(
        self,
        pdf1_path: str,
        pdf2_path: str,
        output_path: str,
        start_with: str = "pdf1",
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Interleaves pages from two PDF files into a single output PDF.
        Supports:
        - A -> B -> A -> B (start_with == 'pdf1')
        - B -> A -> B -> A (start_with == 'pdf2')
        - Unequal page counts (never discards remaining pages)
        """
        if not pdf1_path or not pdf2_path:
            raise ValueError("Both pdf1_path and pdf2_path must be provided.")

        abs_p1 = self.validate_pdf_path(pdf1_path)
        abs_p2 = self.validate_pdf_path(pdf2_path)

        abs_output = os.path.abspath(output_path)
        if abs_output == abs_p1 or abs_output == abs_p2:
            raise ValueError("Output path cannot be the same as any source PDF path.")

        start_mode = (start_with or "pdf1").lower().strip()
        if start_mode not in ("pdf1", "pdf2"):
            raise ValueError("start_with must be either 'pdf1' or 'pdf2'.")

        reader1 = pypdf.PdfReader(abs_p1)
        reader2 = pypdf.PdfReader(abs_p2)

        p1_pages = list(reader1.pages)
        p2_pages = list(reader2.pages)

        if len(p1_pages) == 0:
            raise ValueError(f"PDF 1 '{os.path.basename(abs_p1)}' contains no pages.")
        if len(p2_pages) == 0:
            raise ValueError(f"PDF 2 '{os.path.basename(abs_p2)}' contains no pages.")

        writer = pypdf.PdfWriter()
        max_len = max(len(p1_pages), len(p2_pages))

        for i in range(max_len):
            if start_mode == "pdf1":
                if i < len(p1_pages):
                    writer.add_page(p1_pages[i])
                if i < len(p2_pages):
                    writer.add_page(p2_pages[i])
            else:
                if i < len(p2_pages):
                    writer.add_page(p2_pages[i])
                if i < len(p1_pages):
                    writer.add_page(p1_pages[i])

        os.makedirs(os.path.dirname(abs_output), exist_ok=True)
        temp_out = abs_output + ".tmp"
        with open(temp_out, "wb") as f:
            writer.write(f)
        writer.close()

        if os.path.exists(abs_output):
            os.remove(abs_output)
        os.rename(temp_out, abs_output)

        final_reader = pypdf.PdfReader(abs_output)
        final_page_count = len(final_reader.pages)
        expected_count = len(p1_pages) + len(p2_pages)

        if final_page_count != expected_count:
            raise RuntimeError(f"Expected {expected_count} pages in output PDF, but found {final_page_count}.")

        file_id = None
        pdf_doc_id = None

        if db and register_in_db:
            file_id = self.register_file_in_memora_db(db, abs_output, folder_id)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": final_page_count,
            "file_size_bytes": os.path.getsize(abs_output),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "verified": True,
            "message": f"Successfully alternated pages ({start_mode}) between '{os.path.basename(abs_p1)}' ({len(p1_pages)} pgs) and '{os.path.basename(abs_p2)}' ({len(p2_pages)} pgs) into {os.path.basename(abs_output)} ({final_page_count} pages)."
        }

    def preview_alternate_pages(
        self,
        pdf1_path: str,
        pdf2_path: str,
        start_with: str = "pdf1"
    ) -> Dict[str, Any]:
        """
        Generates preview sequence of page ordering before executing alternate pages export.
        """
        if not pdf1_path or not pdf2_path:
            raise ValueError("Both pdf1_path and pdf2_path must be provided.")

        abs_p1 = self.validate_pdf_path(pdf1_path)
        abs_p2 = self.validate_pdf_path(pdf2_path)

        start_mode = (start_with or "pdf1").lower().strip()
        if start_mode not in ("pdf1", "pdf2"):
            raise ValueError("start_with must be either 'pdf1' or 'pdf2'.")

        reader1 = pypdf.PdfReader(abs_p1)
        reader2 = pypdf.PdfReader(abs_p2)

        c1 = len(reader1.pages)
        c2 = len(reader2.pages)

        order_list = []
        out_idx = 1
        max_len = max(c1, c2)

        for i in range(max_len):
            if start_mode == "pdf1":
                if i < c1:
                    order_list.append({
                        "output_page": out_idx,
                        "source": "PDF 1",
                        "source_page": i + 1,
                        "source_path": abs_p1,
                        "label": f"PDF 1 — Page {i + 1}"
                    })
                    out_idx += 1
                if i < c2:
                    order_list.append({
                        "output_page": out_idx,
                        "source": "PDF 2",
                        "source_page": i + 1,
                        "source_path": abs_p2,
                        "label": f"PDF 2 — Page {i + 1}"
                    })
                    out_idx += 1
            else:
                if i < c2:
                    order_list.append({
                        "output_page": out_idx,
                        "source": "PDF 2",
                        "source_page": i + 1,
                        "source_path": abs_p2,
                        "label": f"PDF 2 — Page {i + 1}"
                    })
                    out_idx += 1
                if i < c1:
                    order_list.append({
                        "output_page": out_idx,
                        "source": "PDF 1",
                        "source_page": i + 1,
                        "source_path": abs_p1,
                        "label": f"PDF 1 — Page {i + 1}"
                    })
                    out_idx += 1

        return {
            "status": "success",
            "total_pages": c1 + c2,
            "pdf1_page_count": c1,
            "pdf2_page_count": c2,
            "start_with": start_mode,
            "page_order": order_list
        }

    def generate_document_with_reportlab(
        self,
        output_path: str,
        title: str = "Document",
        author: str = "Memora AI",
        subject: Optional[str] = None,
        page_size: str = "A4",
        orientation: str = "portrait",
        margin_points: float = 36.0,
        include_page_numbers: bool = True,
        sections: Optional[List[Dict[str, Any]]] = None,
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Generates a clean, professional PDF document using ReportLab:
        - Text paragraphs with automatic text wrapping and typography
        - Headings and Titles
        - Images with aspect-ratio preservation
        - Image + Text mixed layouts
        - Multiple pages with page numbering
        - Validates output PDF on disk
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab library is required for PDF generation.")

        if not output_path or not isinstance(output_path, str):
            raise ValueError("Output path must be a non-empty string.")

        abs_output = os.path.abspath(output_path)
        if not abs_output.lower().endswith(".pdf"):
            abs_output += ".pdf"

        os.makedirs(os.path.dirname(abs_output), exist_ok=True)

        # Page size resolution
        sz_name = (page_size or "A4").upper().strip()
        orient = (orientation or "portrait").lower().strip()

        if sz_name == "LETTER":
            base_size = letter
        elif sz_name == "LEGAL":
            base_size = legal
        else:
            base_size = A4

        doc_size = landscape(base_size) if orient == "landscape" else portrait(base_size)
        margins = max(18.0, float(margin_points or 36.0))

        doc = SimpleDocTemplate(
            abs_output,
            pagesize=doc_size,
            leftMargin=margins,
            rightMargin=margins,
            topMargin=margins + (10 if include_page_numbers else 0),
            bottomMargin=margins + (15 if include_page_numbers else 0),
            title=title,
            author=author,
            subject=subject or ""
        )

        styles = getSampleStyleSheet()
        
        # Custom typography styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=24,
            leading=28,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=14
        )
        
        h1_style = ParagraphStyle(
            'DocH1',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#1e293b'),
            spaceBefore=14,
            spaceAfter=8
        )

        h2_style = ParagraphStyle(
            'DocH2',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=colors.HexColor('#334155'),
            spaceBefore=10,
            spaceAfter=6
        )

        body_style = ParagraphStyle(
            'DocBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor('#1e293b'),
            spaceAfter=10
        )

        caption_style = ParagraphStyle(
            'DocCaption',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#64748b'),
            alignment=TA_CENTER,
            spaceBefore=4,
            spaceAfter=10
        )

        story = []
        
        # Available content width and height
        content_width = doc_size[0] - (2 * margins)
        content_height = doc_size[1] - (2 * margins)

        # Add Document Title if provided
        if title and title.strip():
            story.append(Paragraph(title.strip(), title_style))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1'), spaceBefore=2, spaceAfter=14))

        if sections:
            for sec in sections:
                s_data = sec.dict() if hasattr(sec, "dict") else dict(sec)
                s_type = (s_data.get("type") or "paragraph").lower().strip()

                if s_type == "title":
                    t_text = s_data.get("title") or s_data.get("text") or ""
                    if t_text:
                        story.append(Paragraph(t_text, title_style))
                        story.append(Spacer(1, 8))

                elif s_type in ("heading", "h1"):
                    h_text = s_data.get("title") or s_data.get("text") or ""
                    if h_text:
                        story.append(Paragraph(h_text, h1_style))

                elif s_type == "h2":
                    h_text = s_data.get("title") or s_data.get("text") or ""
                    if h_text:
                        story.append(Paragraph(h_text, h2_style))

                elif s_type in ("paragraph", "text"):
                    p_text = s_data.get("text") or ""
                    if p_text:
                        align_str = (s_data.get("alignment") or "left").lower()
                        p_style = ParagraphStyle('CustomP', parent=body_style)
                        if align_str == "center":
                            p_style.alignment = TA_CENTER
                        elif align_str == "right":
                            p_style.alignment = TA_RIGHT
                        elif align_str == "justify":
                            p_style.alignment = TA_JUSTIFY

                        f_size = s_data.get("font_size")
                        if f_size:
                            p_style.fontSize = float(f_size)
                            p_style.leading = float(f_size) * 1.35

                        # Escape XML entities for safe ReportLab markup
                        clean_text = p_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                        clean_text = clean_text.replace("\n", "<br/>")
                        story.append(Paragraph(clean_text, p_style))

                elif s_type == "image":
                    img_path = s_data.get("image_path") or s_data.get("path")
                    if img_path and os.path.exists(img_path):
                        try:
                            with Image.open(img_path) as pil_img:
                                orig_w, orig_h = pil_img.size

                            aspect = orig_w / max(1.0, orig_h)
                            max_w = min(content_width, float(s_data.get("image_width") or content_width))
                            max_h = min(content_height * 0.7, float(s_data.get("image_height") or (content_height * 0.7)))

                            calc_w = max_w
                            calc_h = calc_w / aspect
                            if calc_h > max_h:
                                calc_h = max_h
                                calc_w = calc_h * aspect

                            rl_img = RLImage(img_path, width=calc_w, height=calc_h)
                            
                            caption = s_data.get("image_caption") or s_data.get("title")
                            if caption:
                                story.append(KeepTogether([
                                    rl_img,
                                    Paragraph(caption, caption_style)
                                ]))
                            else:
                                story.append(rl_img)
                                story.append(Spacer(1, 8))
                        except Exception as e:
                            logger.error(f"Failed to add image '{img_path}' to ReportLab PDF: {e}")

                elif s_type in ("image_and_text", "mixed"):
                    img_path = s_data.get("image_path")
                    text_content = s_data.get("text") or ""
                    layout = (s_data.get("layout") or "stacked").lower()

                    if img_path and os.path.exists(img_path):
                        with Image.open(img_path) as pil_img:
                            orig_w, orig_h = pil_img.size

                        aspect = orig_w / max(1.0, orig_h)

                        if layout == "side_by_side":
                            img_col_w = content_width * 0.45
                            text_col_w = content_width * 0.52

                            img_w = img_col_w
                            img_h = img_w / aspect
                            if img_h > content_height * 0.4:
                                img_h = content_height * 0.4
                                img_w = img_h * aspect

                            rl_img = RLImage(img_path, width=img_w, height=img_h)
                            clean_text = text_content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
                            p_flow = Paragraph(clean_text, body_style)

                            table = Table([[rl_img, p_flow]], colWidths=[img_col_w, text_col_w])
                            table.setStyle(TableStyle([
                                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                ('LEFTPADDING', (1, 0), (1, 0), 12),
                                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                                ('TOPPADDING', (0, 0), (-1, -1), 0),
                                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                            ]))
                            story.append(KeepTogether(table))
                            story.append(Spacer(1, 10))
                        else:
                            # Stacked
                            max_w = min(content_width, content_width * 0.8)
                            img_w = max_w
                            img_h = img_w / aspect
                            if img_h > content_height * 0.45:
                                img_h = content_height * 0.45
                                img_w = img_h * aspect

                            rl_img = RLImage(img_path, width=img_w, height=img_h)
                            story.append(rl_img)
                            if text_content:
                                clean_text = text_content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
                                story.append(Spacer(1, 6))
                                story.append(Paragraph(clean_text, body_style))
                            story.append(Spacer(1, 10))

                elif s_type == "page_break":
                    story.append(PageBreak())

                elif s_type == "spacer":
                    sp_h = float(s_data.get("height") or 14)
                    story.append(Spacer(1, sp_h))

        if not story:
            story.append(Paragraph("Blank Document", body_style))

        # Build PDF
        canvas_maker = NumberedCanvas if (include_page_numbers and NumberedCanvas) else canvas.Canvas
        doc.build(story, canvasmaker=canvas_maker)

        # Verification
        if not os.path.exists(abs_output):
            raise RuntimeError(f"ReportLab failed to create physical PDF at '{abs_output}'.")

        size_bytes = os.path.getsize(abs_output)
        if size_bytes == 0:
            raise RuntimeError(f"Generated PDF file at '{abs_output}' is empty (0 bytes).")

        verify_reader = pypdf.PdfReader(abs_output)
        actual_pages = len(verify_reader.pages)

        file_id = None
        pdf_doc_id = None

        if db and register_in_db:
            file_id = self.register_file_in_memora_db(db, abs_output, folder_id)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": actual_pages,
            "file_size_bytes": size_bytes,
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "verified": True,
            "message": f"Successfully generated ReportLab PDF '{os.path.basename(abs_output)}' with {actual_pages} page(s)."
        }


    def pdf_to_images(
        self,
        source_path: str,
        output_dir: str,
        image_format: str = "PNG",
        page_selection: str = "all",
        pages: Optional[List[int]] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
        quality: int = 95
    ) -> Dict[str, Any]:
        """
        Renders/extracts pages of a PDF into real image files (PNG, JPG, WebP).
        Supports page selection (all, selected, range) with memory-efficient writing.
        """
        import io
        from PIL import Image, ImageDraw

        abs_source = self.validate_pdf_path(source_path)
        reader = pypdf.PdfReader(abs_source)
        total_pages = len(reader.pages)

        fmt_clean = (image_format or "PNG").upper().strip()
        if fmt_clean in ("JPG", "JPEG"):
            fmt_ext = ".jpg"
            save_fmt = "JPEG"
        elif fmt_clean == "WEBP":
            fmt_ext = ".webp"
            save_fmt = "WEBP"
        else:
            fmt_ext = ".png"
            save_fmt = "PNG"

        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(abs_source))[0]

        # Resolve target page indices
        target_indices = []
        if page_selection == "all":
            target_indices = list(range(total_pages))
        elif page_selection == "selected" and pages:
            target_indices = [p for p in pages if isinstance(p, int) and 0 <= p < total_pages]
        elif page_selection == "range":
            start_idx = max(0, start_page if start_page is not None else 0)
            end_idx = min(total_pages - 1, end_page if end_page is not None else total_pages - 1)
            if start_idx <= end_idx:
                target_indices = list(range(start_idx, end_idx + 1))

        if not target_indices:
            target_indices = list(range(total_pages))

        generated_files = []

        for idx in target_indices:
            page = reader.pages[idx]
            out_filename = f"{base_name}_page_{idx + 1}{fmt_ext}"
            out_filepath = os.path.abspath(os.path.join(output_dir, out_filename))

            # Attempt embedded raster image extraction
            extracted = False
            if hasattr(page, "images") and page.images:
                try:
                    for img_count, img_obj in enumerate(page.images):
                        pil_img = Image.open(io.BytesIO(img_obj.data))
                        if pil_img.mode in ("RGBA", "P") and save_fmt in ("JPEG", "JPG"):
                            pil_img = pil_img.convert("RGB")
                        
                        sub_name = f"{base_name}_page_{idx + 1}{fmt_ext}" if img_count == 0 else f"{base_name}_page_{idx + 1}_img_{img_count + 1}{fmt_ext}"
                        sub_path = os.path.abspath(os.path.join(output_dir, sub_name))
                        
                        save_kwargs = {}
                        if save_fmt in ("JPEG", "WEBP"):
                            save_kwargs["quality"] = quality

                        pil_img.save(sub_path, format=save_fmt, **save_kwargs)
                        pil_img.close()
                        generated_files.append(sub_path)
                        extracted = True
                        break  # extract primary image per page
                except Exception as ex:
                    logger.warning(f"Embedded image extraction failed for page {idx + 1}: {ex}")
                    extracted = False

            # Fallback: Render page canvas/text preview to PIL Image if no embedded image
            if not extracted:
                w_pt = float(page.mediabox.width) if page.mediabox else 612.0
                h_pt = float(page.mediabox.height) if page.mediabox else 792.0

                canvas_w = int(w_pt * 1.5)
                canvas_h = int(h_pt * 1.5)

                canvas = Image.new("RGB", (canvas_w, canvas_h), color="white")
                draw = ImageDraw.Draw(canvas)

                page_text = page.extract_text() or ""
                lines = [line.strip() for line in page_text.splitlines() if line.strip()]

                draw.rectangle([10, 10, canvas_w - 10, canvas_h - 10], outline="#cccccc", width=2)
                draw.text((20, 20), f"{base_name} — Page {idx + 1}", fill="#1e293b")

                y_pos = 50
                for line in lines[:35]:
                    draw.text((20, y_pos), line[:90], fill="#334155")
                    y_pos += 18

                save_kwargs = {}
                if save_fmt in ("JPEG", "WEBP"):
                    save_kwargs["quality"] = quality

                canvas.save(out_filepath, format=save_fmt, **save_kwargs)
                canvas.close()
                generated_files.append(out_filepath)

        return {
            "status": "success",
            "source_path": abs_source,
            "total_generated_files": len(generated_files),
            "output_dir": output_dir,
            "generated_files": generated_files,
            "message": f"Successfully converted PDF pages to {len(generated_files)} {fmt_clean} image file(s)."
        }

    def split_pdf(
        self,
        source_path: str,
        output_dir: str,
        split_mode: str = "every_page",
        pages: Optional[List[int]] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
        naming_prefix: Optional[str] = None,
        db=None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Splits a PDF document into separate page PDFs (every page, selected pages, or page range).
        Validates page selection ranges, output directory writability, and avoids filename collisions.
        """
        abs_source = self.validate_pdf_path(source_path)
        reader = pypdf.PdfReader(abs_source)
        total_pages = len(reader.pages)

        abs_output_dir = os.path.abspath(output_dir)
        os.makedirs(abs_output_dir, exist_ok=True)
        if not os.access(abs_output_dir, os.W_OK):
            raise PermissionError(f"Target directory '{abs_output_dir}' is not writable.")

        prefix = naming_prefix or os.path.splitext(os.path.basename(abs_source))[0]
        mode_clean = (split_mode or "every_page").lower().strip()

        created_files = []

        if mode_clean == "every_page":
            for idx, page in enumerate(reader.pages):
                writer = pypdf.PdfWriter()
                writer.add_page(page)
                out_name = f"{prefix}_page_{idx + 1}.pdf"
                out_path = os.path.abspath(os.path.join(abs_output_dir, out_name))
                with open(out_path, "wb") as f:
                    writer.write(f)
                created_files.append(out_path)

        elif mode_clean == "selected_pages":
            if not pages or not isinstance(pages, list):
                raise ValueError("No valid page indices list provided for 'selected_pages' split mode.")
            
            valid_indices = []
            for p in pages:
                if not isinstance(p, int) or p < 0 or p >= total_pages:
                    raise ValueError(f"Page index {p} out of bounds (0 to {total_pages - 1}).")
                valid_indices.append(p)

            for idx in valid_indices:
                writer = pypdf.PdfWriter()
                writer.add_page(reader.pages[idx])
                out_name = f"{prefix}_page_{idx + 1}.pdf"
                out_path = os.path.abspath(os.path.join(abs_output_dir, out_name))
                with open(out_path, "wb") as f:
                    writer.write(f)
                created_files.append(out_path)

        elif mode_clean == "range":
            if start_page is None or end_page is None:
                raise ValueError("start_page and end_page parameters are required for 'range' split mode.")
            if not isinstance(start_page, int) or not isinstance(end_page, int):
                raise ValueError("start_page and end_page must be integers.")
            if start_page < 0 or end_page >= total_pages or start_page > end_page:
                raise ValueError(f"Invalid page range [{start_page}, {end_page}] for document with {total_pages} pages.")

            writer = pypdf.PdfWriter()
            for idx in range(start_page, end_page + 1):
                writer.add_page(reader.pages[idx])
            out_name = f"{prefix}_pages_{start_page + 1}_to_{end_page + 1}.pdf"
            out_path = os.path.abspath(os.path.join(abs_output_dir, out_name))
            with open(out_path, "wb") as f:
                writer.write(f)
            created_files.append(out_path)

        else:
            raise ValueError(f"Unsupported split mode '{split_mode}'. Supported modes: every_page, selected_pages, range.")

        if db and register_in_db:
            for out_f in created_files:
                f_id = self.register_file_in_memora_db(db, out_f)
                self.register_or_get_document_record(db, out_f, title=os.path.basename(out_f), file_id=f_id)

        first_output = created_files[0] if created_files else ""
        return {
            "status": "success",
            "source_path": abs_source,
            "output_path": first_output,
            "output_dir": abs_output_dir,
            "file_name": os.path.basename(first_output) if first_output else "",
            "page_count": len(created_files),
            "total_generated_files": len(created_files),
            "generated_files": created_files,
            "file_size_bytes": os.path.getsize(first_output) if first_output and os.path.exists(first_output) else 0,
            "message": f"Successfully split document into {len(created_files)} output PDF file(s)."
        }


    def validate_image_file(self, image_path: str) -> str:
        """
        Validates image file existence, extension, and readable integrity.
        """
        if not image_path or not isinstance(image_path, str):
            raise ValueError("Image path must be a non-empty string.")

        abs_path = os.path.abspath(image_path)
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Image file not found: {abs_path}")

        valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
        ext = os.path.splitext(abs_path)[1].lower()
        if ext not in valid_exts:
            raise ValueError(f"Unsupported image format '{ext}'. Supported: PNG, JPG, WebP, BMP, TIFF.")

        try:
            with Image.open(abs_path) as img:
                img.verify()
        except Exception as e:
            raise ValueError(f"Corrupted or unreadable image file '{abs_path}': {e}")

        return abs_path

    def images_to_pdf(
        self,
        image_paths: List[str],
        output_path: str,
        page_size: Optional[str] = None,
        orientation: str = "portrait",
        fit_to_page: bool = False,
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Converts multiple image files (PNG, JPG, WebP) into a multi-page PDF document.
        Validates image integrity and registers output file in Memora DB if requested.
        """
        if not image_paths:
            raise ValueError("At least one image path must be provided.")

        validated_paths = [self.validate_image_file(p) for p in image_paths]

        pil_images = []
        for img_path in validated_paths:
            try:
                img = Image.open(img_path)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                if fit_to_page and page_size:
                    target_w, target_h = self.get_page_dimensions(page_size, orientation)
                    img.thumbnail((int(target_w), int(target_h)), Image.Resampling.LANCZOS)

                pil_images.append(img)
            except Exception as e:
                raise ValueError(f"Failed to process image '{img_path}': {e}")

        if not pil_images:
            raise ValueError("No valid images were available for PDF conversion.")

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        first_img = pil_images[0]
        other_imgs = pil_images[1:] if len(pil_images) > 1 else []

        first_img.save(output_path, "PDF", save_all=True, append_images=other_imgs)

        for img in pil_images:
            img.close()

        final_reader = pypdf.PdfReader(output_path) if PYPDF_AVAILABLE else None
        page_count = len(final_reader.pages) if final_reader else len(pil_images)

        file_id = None
        pdf_doc_id = None

        if db and register_in_db:
            file_id = self.register_file_in_memora_db(db, output_path, folder_id)
            pdf_doc = self.register_or_get_document_record(db, output_path, title=os.path.basename(output_path), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": output_path,
            "file_name": os.path.basename(output_path),
            "page_count": page_count,
            "file_size_bytes": os.path.getsize(output_path),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully compiled {len(pil_images)} image(s) into {os.path.basename(output_path)}."
        }

    def register_file_in_memora_db(self, db, file_path: str, folder_id: Optional[int] = None) -> Optional[int]:
        """
        Registers an output PDF in Memora's core `files` table, extracts text (including EasyOCR for scanned PDFs),
        and indexes chunks & embeddings into existing FAISS index and vector_mappings table.
        Skips registration if the file is in a temporary directory or test output path.
        """
        import hashlib
        from datetime import datetime
        from ..models import File, Folder, Chunk
        from .extractor import TextExtractor
        from .chunker import chunk_text
        from .embedding_service import embedding_service
        from ..ai.faiss_manager import faiss_manager
        from .indexing_service import IndexingService
        from .scanner import is_temp_or_test_path

        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            return None

        if is_temp_or_test_path(abs_path):
            logger.info(f"Skipping DB registration for temporary/test file '{abs_path}'")
            return None

        size = os.path.getsize(abs_path)
        mtime = datetime.fromtimestamp(os.path.getmtime(abs_path))

        # Calculate SHA256 hash
        hasher = hashlib.sha256()
        with open(abs_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        file_hash = hasher.hexdigest()

        # Resolve folder_id
        if not folder_id:
            parent_dir = os.path.dirname(abs_path)
            matching_folder = db.query(Folder).filter(Folder.path == parent_dir).first()
            if matching_folder:
                folder_id = matching_folder.id
            else:
                first_folder = db.query(Folder).filter(Folder.is_active == True).first()
                if first_folder:
                    folder_id = first_folder.id

        if not folder_id:
            return None

        # Check existing File record
        file_rec = db.query(File).filter(File.path == abs_path).first()
        extracted_text, status_str = TextExtractor.extract_from_pdf(abs_path)

        if not file_rec:
            file_rec = File(
                folder_id=folder_id,
                path=abs_path,
                name=os.path.basename(abs_path),
                extension=".pdf",
                size=size,
                modified_at=mtime,
                file_hash=file_hash,
                mime_type="application/pdf",
                extracted_text=extracted_text,
                extraction_status=status_str
            )
            db.add(file_rec)
        else:
            file_rec.size = size
            file_rec.modified_at = mtime
            file_rec.file_hash = file_hash
            file_rec.extracted_text = extracted_text
            file_rec.extraction_status = status_str

        # Generate and persist dynamic Smart Tags
        try:
            from .classification_service import classification_service
            _, _, _, _, smart_tags = classification_service.classify_file(
                filename=file_rec.name,
                extension=file_rec.extension,
                extracted_text=extracted_text or ""
            )
            file_rec.set_smart_tags(smart_tags)
        except Exception as cls_err:
            logger.warning(f"Classification skipped for PDF Studio file '{abs_path}': {cls_err}")

        db.commit()
        db.refresh(file_rec)

        # Automatic Indexing into existing Chunk / Embedding / FAISS Pipeline
        if extracted_text and extracted_text.strip():
            try:
                # Remove prior chunks for re-indexed files to maintain vector integrity
                existing_chunks = db.query(Chunk).filter(Chunk.file_id == file_rec.id).all()
                if existing_chunks:
                    indexer = IndexingService()
                    indexer._delete_file_chunks_and_vectors(db, file_rec.id)

                chunk_objs = chunk_text(extracted_text, chunk_size=400, overlap=50)
                if chunk_objs:
                    chunk_records = []
                    texts_to_embed = []
                    for c in chunk_objs:
                        ch_rec = Chunk(
                            file_id=file_rec.id,
                            chunk_index=c["chunk_index"],
                            text=c["text"],
                            word_count=c["word_count"]
                        )
                        db.add(ch_rec)
                        chunk_records.append(ch_rec)
                        texts_to_embed.append(c["text"])

                    db.commit()
                    for ch_rec in chunk_records:
                        db.refresh(ch_rec)

                    vectors = embedding_service.embed_documents(texts_to_embed)
                    chunk_ids = [ch.id for ch in chunk_records]
                    faiss_manager.add_vectors(vectors, chunk_ids)

                    indexer = IndexingService()
                    indexer._sync_vector_mappings(db)

                    file_rec.extraction_status = "success"
                    db.commit()
            except Exception as idx_err:
                logger.error(f"Indexing failed for PDF Studio document '{abs_path}': {idx_err}", exc_info=True)
                file_rec.extraction_status = "indexing_failed"
                try:
                    db.commit()
                except Exception:
                    db.rollback()

        return file_rec.id

    # ==========================================
    # DATABASE PERSISTENCE METHODS
    # ==========================================

    def register_or_get_document_record(self, db, file_path: str, title: Optional[str] = None, file_id: Optional[int] = None):
        """
        Creates or updates a persistent PDFDocument and PDFPage records in SQLite db.
        Reuses existing Memora File record if linked or found by path.
        """
        from ..models import File, PDFDocument, PDFPage

        abs_path = self.validate_pdf_path(file_path)
        inspect_data = self.inspect_pdf(abs_path)

        # Look up existing File record if file_id is not specified
        if not file_id:
            existing_file = db.query(File).filter(File.path == abs_path).first()
            if existing_file:
                file_id = existing_file.id

        doc_title = title or inspect_data["file_name"]

        # Check existing PDFDocument
        pdf_doc = db.query(PDFDocument).filter(PDFDocument.working_file_path == abs_path).first()

        if not pdf_doc:
            pdf_doc = PDFDocument(
                file_id=file_id,
                working_file_path=abs_path,
                title=doc_title,
                page_count=inspect_data["page_count"],
                is_draft=True
            )
            db.add(pdf_doc)
            db.flush()  # assign ID

        else:
            pdf_doc.title = doc_title
            pdf_doc.page_count = inspect_data["page_count"]
            if file_id:
                pdf_doc.file_id = file_id

        # Sync PDFPage records
        existing_pages = {p.page_index: p for p in pdf_doc.pages}
        for page_meta in inspect_data["pages"]:
            idx = page_meta["page_index"]
            if idx not in existing_pages:
                new_page = PDFPage(
                    pdf_document_id=pdf_doc.id,
                    page_index=idx,
                    original_page_number=idx + 1,
                    width=page_meta["width"],
                    height=page_meta["height"],
                    rotation=page_meta["rotation"],
                    source_file_path=abs_path
                )
                db.add(new_page)
            else:
                existing_pages[idx].width = page_meta["width"]
                existing_pages[idx].height = page_meta["height"]
                existing_pages[idx].rotation = page_meta["rotation"]

        db.commit()
        db.refresh(pdf_doc)
        return pdf_doc

    def get_document_record(self, db, doc_id: int):
        """
        Retrieves a PDFDocument record by ID with ordered pages.
        """
        from ..models import PDFDocument
        return db.query(PDFDocument).filter(PDFDocument.id == doc_id).first()

    def get_document_by_path(self, db, file_path: str):
        """
        Retrieves a PDFDocument record by working file path.
        """
        from ..models import PDFDocument
        abs_path = os.path.abspath(file_path)
        return db.query(PDFDocument).filter(PDFDocument.working_file_path == abs_path).first()

    def update_page_metadata(self, db, doc_id: int, page_index: int, rotation: Optional[int] = None, new_index: Optional[int] = None):
        """
        Updates metadata (rotation and page sequence index) for a specific PDF page.
        """
        from ..models import PDFPage
        page = db.query(PDFPage).filter(
            PDFPage.pdf_document_id == doc_id,
            PDFPage.page_index == page_index
        ).first()

        if not page:
            raise FileNotFoundError(f"PDF Page {page_index} not found for Document ID {doc_id}")

        if rotation is not None:
            page.rotation = rotation

        if new_index is not None:
            page.page_index = new_index

        db.commit()
        db.refresh(page)
        return page

    # ==========================================
    # ANNOTATION & TEXT EDITING METHODS
    # ==========================================

    @staticmethod
    def validate_annotation_payload(anno: Dict[str, Any], max_pages: Optional[int] = None) -> Dict[str, Any]:
        """
        Validates page_index, coordinates, dimensions, text length, annotation type, and malformed fields.
        """
        allowed_types = {"text", "highlight", "draw", "line", "arrow", "rectangle", "circle", "note"}
        
        anno_type = str(anno.get("annotation_type", "")).lower().strip()
        if not anno_type or anno_type not in allowed_types:
            raise ValueError(f"Invalid annotation type '{anno_type}'. Supported: {', '.join(sorted(allowed_types))}.")

        page_idx = anno.get("page_index")
        if page_idx is None or not isinstance(page_idx, int) or page_idx < 0:
            raise ValueError(f"Invalid page_index '{page_idx}'. Must be a non-negative integer.")

        if max_pages is not None and page_idx >= max_pages:
            raise ValueError(f"page_index {page_idx} out of bounds for document with {max_pages} page(s).")

        # Validate numeric coordinates
        for num_field in ["x", "y", "width", "height", "x2", "y2", "stroke_width", "font_size", "opacity"]:
            val = anno.get(num_field)
            if val is not None:
                try:
                    float_val = float(val)
                    if num_field in ("width", "height", "stroke_width", "font_size") and float_val < 0:
                        raise ValueError(f"Field '{num_field}' cannot be negative.")
                    if num_field == "opacity" and not (0.0 <= float_val <= 1.0):
                        raise ValueError(f"Opacity must be between 0.0 and 1.0.")
                except (ValueError, TypeError) as te:
                    if isinstance(te, ValueError) and "cannot be negative" in str(te):
                        raise
                    raise ValueError(f"Field '{num_field}' must be a valid number.")

        # Text length validation
        text_content = anno.get("content_text")
        if text_content is not None:
            if not isinstance(text_content, str):
                text_content = str(text_content)
            if len(text_content) > 10000:
                raise ValueError("Annotation content_text exceeds maximum allowed length of 10,000 characters.")

        # Validate freehand drawing points
        points = anno.get("points")
        if points is not None:
            if not isinstance(points, list):
                raise ValueError("Freehand drawing points must be a list of coordinate pairs.")
            for p in points:
                if not isinstance(p, (list, tuple)) or len(p) < 2:
                    raise ValueError("Each point in freehand drawing must contain at least [x, y] numbers.")
                try:
                    _ = float(p[0])
                    _ = float(p[1])
                except (ValueError, TypeError):
                    raise ValueError("Point coordinates must be valid numbers.")

        return anno

    def save_annotations_to_db(self, db, document_id: int, annotations: List[Dict[str, Any]]) -> List[Any]:
        """
        Persists annotation objects associated with a specific PDF document and page.
        """
        import json
        from ..models import PDFDocument, PDFAnnotation

        pdf_doc = db.query(PDFDocument).filter(PDFDocument.id == document_id).first()
        if not pdf_doc:
            raise FileNotFoundError(f"PDF Document record ID {document_id} not found.")

        # Clear existing annotations for clean document state synchronization
        db.query(PDFAnnotation).filter(PDFAnnotation.pdf_document_id == document_id).delete()

        created_records = []
        for raw_anno in annotations:
            validated = self.validate_annotation_payload(raw_anno, max_pages=pdf_doc.page_count)
            
            # Extract standard fields
            page_idx = validated["page_index"]
            a_type = validated["annotation_type"]
            c_text = validated.get("content_text", "")

            # Package visual/coordinate properties into properties_json
            props = {
                "x": float(validated.get("x", 0.0) or 0.0),
                "y": float(validated.get("y", 0.0) or 0.0),
                "width": float(validated.get("width", 0.0) or 0.0),
                "height": float(validated.get("height", 0.0) or 0.0),
                "x2": float(validated.get("x2")) if validated.get("x2") is not None else None,
                "y2": float(validated.get("y2")) if validated.get("y2") is not None else None,
                "color": str(validated.get("color", "#000000")),
                "fill_color": str(validated.get("fill_color")) if validated.get("fill_color") else None,
                "stroke_width": float(validated.get("stroke_width", 2.0) or 2.0),
                "font_size": float(validated.get("font_size", 14.0) or 14.0),
                "font_family": str(validated.get("font_family", "Helvetica")),
                "font_style": str(validated.get("font_style", "normal")),
                "alignment": str(validated.get("alignment", "left")),
                "opacity": float(validated.get("opacity", 1.0) if validated.get("opacity") is not None else 1.0),
                "points": validated.get("points"),
                "properties": validated.get("properties", {})
            }

            db_anno = PDFAnnotation(
                pdf_document_id=document_id,
                page_index=page_idx,
                annotation_type=a_type,
                content_text=c_text,
                properties_json=json.dumps(props)
            )
            db.add(db_anno)
            created_records.append(db_anno)

        pdf_doc.has_annotations = len(created_records) > 0
        db.commit()
        for rec in created_records:
            db.refresh(rec)

        return created_records

    def get_annotations_for_document(self, db, document_id: int, page_index: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Retrieves persistent annotations associated with a specific PDF document and page index.
        """
        import json
        from ..models import PDFDocument, PDFAnnotation

        pdf_doc = db.query(PDFDocument).filter(PDFDocument.id == document_id).first()
        if not pdf_doc:
            raise FileNotFoundError(f"PDF Document record ID {document_id} not found.")

        query = db.query(PDFAnnotation).filter(PDFAnnotation.pdf_document_id == document_id)
        if page_index is not None:
            query = query.filter(PDFAnnotation.page_index == page_index)

        records = query.all()
        result = []
        for r in records:
            props = {}
            if r.properties_json:
                try:
                    props = json.loads(r.properties_json)
                except Exception:
                    props = {}

            item = {
                "id": r.id,
                "pdf_document_id": r.pdf_document_id,
                "page_index": r.page_index,
                "annotation_type": r.annotation_type,
                "content_text": r.content_text,
                "properties_json": r.properties_json,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
                "x": props.get("x", 0.0),
                "y": props.get("y", 0.0),
                "width": props.get("width", 0.0),
                "height": props.get("height", 0.0),
                "x2": props.get("x2"),
                "y2": props.get("y2"),
                "color": props.get("color", "#000000"),
                "fill_color": props.get("fill_color"),
                "stroke_width": props.get("stroke_width", 2.0),
                "font_size": props.get("font_size", 14.0),
                "font_family": props.get("font_family", "Helvetica"),
                "font_style": props.get("font_style", "normal"),
                "alignment": props.get("alignment", "left"),
                "opacity": props.get("opacity", 1.0),
                "points": props.get("points")
            }
            result.append(item)

        return result

    @staticmethod
    def _parse_rgba_color(color_str: str, alpha_factor: float = 1.0) -> tuple:
        """
        Parses color hex string or color names into PIL RGBA tuple (R, G, B, A).
        """
        alpha_val = int(255 * max(0.0, min(1.0, alpha_factor)))
        if not color_str or not isinstance(color_str, str):
            return (0, 0, 0, alpha_val)

        c = color_str.strip().lstrip("#")
        if len(c) == 6:
            try:
                r = int(c[0:2], 16)
                g = int(c[2:4], 16)
                b = int(c[4:6], 16)
                return (r, g, b, alpha_val)
            except ValueError:
                pass
        elif len(c) == 8:
            try:
                r = int(c[0:2], 16)
                g = int(c[2:4], 16)
                b = int(c[4:6], 16)
                a = int(c[6:8], 16)
                return (r, g, b, int(a * (alpha_val / 255.0)))
            except ValueError:
                pass

        named = {
            "yellow": (255, 235, 59),
            "red": (244, 67, 54),
            "green": (76, 175, 80),
            "blue": (33, 150, 243),
            "black": (0, 0, 0),
            "white": (255, 255, 255),
            "orange": (255, 152, 0),
            "purple": (156, 39, 176)
        }
        if color_str.lower() in named:
            r, g, b = named[color_str.lower()]
            return (r, g, b, alpha_val)

        return (0, 0, 0, alpha_val)

    @staticmethod
    def _get_font(font_size_px: float, is_bold: bool = False):
        from PIL import ImageFont
        font_names = []
        if is_bold:
            font_names.extend(["arialbd.ttf", "calibrib.ttf", "segoeuib.ttf"])
        font_names.extend(["arial.ttf", "calibri.ttf", "segoeui.ttf", "DejaVuSans.ttf"])

        for fname in font_names:
            for sys_path in [
                fname,
                os.path.join("C:\\Windows\\Fonts", fname),
                os.path.join("/usr/share/fonts", fname),
                os.path.join("/System/Library/Fonts", fname)
            ]:
                try:
                    return ImageFont.truetype(sys_path, int(max(8, font_size_px)))
                except Exception:
                    pass
        return ImageFont.load_default()

    def resolve_and_validate_image(self, img_source: str, elem_id: str = "image") -> tuple:
        """
        Resolves image source (file path, file:// URL, or base64 data URL) into a verified physical file.
        Validates image with Pillow. Raises ValueError if unresolvable or corrupted.
        Returns (resolved_file_path, is_temporary_flag).
        """
        import base64
        import tempfile
        from PIL import Image

        if not img_source or not isinstance(img_source, str):
            raise ValueError(f"Image element '{elem_id}' has missing or empty image source reference.")

        clean_source = img_source.strip()

        # Handle file:// URLs
        if clean_source.startswith("file:///"):
            clean_source = clean_source[8:]
        elif clean_source.startswith("file://"):
            clean_source = clean_source[7:]

        # Handle base64 Data URLs
        if clean_source.startswith("data:image/"):
            try:
                header, base64_data = clean_source.split(",", 1)
                img_bytes = base64.b64decode(base64_data)
                t_fd, temp_img_path = tempfile.mkstemp(suffix="_base64.png")
                os.close(t_fd)
                with open(temp_img_path, "wb") as f:
                    f.write(img_bytes)

                with Image.open(temp_img_path) as pil_img:
                    pil_img.verify()
                return (temp_img_path, True)
            except Exception as b64_err:
                raise ValueError(f"Failed to decode or validate base64 image payload for element '{elem_id}': {b64_err}")

        # Handle unresolved blob: URLs
        if clean_source.startswith("blob:"):
            raise ValueError(f"Image element '{elem_id}' contains an unresolved browser blob URL '{clean_source}'. Original file path or base64 data must be provided.")

        # Validate local disk file existence
        abs_path = os.path.abspath(clean_source)
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Image element '{elem_id}' file not found at original path: '{clean_source}'")

        try:
            with Image.open(abs_path) as pil_img:
                pil_img.verify()
        except Exception as pil_err:
            raise ValueError(f"Image element '{elem_id}' at '{abs_path}' is corrupted or unreadable: {pil_err}")

        return (abs_path, False)

    def export_workspace_pdf(
        self,
        output_path: str,
        pages: List[Dict[str, Any]],
        page_size: str = "A4",
        orientation: str = "portrait",
        include_page_numbers: bool = False,
        title: str = "Memora Document",
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Compiles physical PDF from PDF Studio workspace state:
        - Assembles base pages (PDF pages, image pages, blank pages) in exact workspace sequence.
        - Uses ReportLab for vector text rendering, exact font metrics, text wrapping, and image placement.
        - Uses Pillow for image validation, orientation, and format normalization.
        - Renders elements (text boxes, resizable images) at exact (x, y, w, h) coordinates.
        - Verifies physical output file exists, is non-empty, and is a valid readable PDF with matching page count.
        - Registers and indexes in Memora DB if requested.
        """
        import tempfile
        import html
        from PIL import Image

        if not PYPDF_AVAILABLE and not REPORTLAB_AVAILABLE:
            raise RuntimeError("PDF libraries (pypdf or reportlab) are required for PDF Studio backend operations.")

        if not pages:
            raise ValueError("Workspace page sequence cannot be empty.")

        abs_output = os.path.abspath(output_path)
        os.makedirs(os.path.dirname(abs_output), exist_ok=True)

        writer = pypdf.PdfWriter()
        temp_files_to_clean = []

        try:
            for idx, raw_page in enumerate(pages):
                p_data = raw_page.dict() if hasattr(raw_page, "dict") else dict(raw_page)
                p_type = p_data.get("type", "blank")
                rotation = int(p_data.get("rotation", 0) or 0) % 360

                base_page = None
                src_pdf = p_data.get("source_pdf_path") or p_data.get("path")
                src_idx = int(p_data.get("source_page_index", 0) or 0)
                img_bg_path = p_data.get("image_path") or (p_data.get("path") if p_type == "image" else None)

                # Determine base page dimensions
                default_w, default_h = self.get_page_dimensions(page_size, orientation)

                if (p_type == "pdf_page" or (src_pdf and str(src_pdf).lower().endswith(".pdf"))) and src_pdf and os.path.exists(src_pdf):
                    try:
                        reader = pypdf.PdfReader(src_pdf)
                        if 0 <= src_idx < len(reader.pages):
                            base_page = reader.pages[src_idx]
                            if rotation != 0:
                                base_page.rotate(rotation)
                    except Exception as ex:
                        logger.warning(f"Failed to read source PDF page at '{src_pdf}' index {src_idx}: {ex}")

                # Collect elements on this page
                raw_elements = p_data.get("elements") or []
                elements = [e.dict() if hasattr(e, "dict") else dict(e) for e in raw_elements]

                # Convert legacy textOverlays if elements is empty
                if not elements:
                    legacy_text = p_data.get("textOverlays") or p_data.get("text_overlays") or []
                    for t_item in legacy_text:
                        td = dict(t_item)
                        text_str = str(td.get("text", "")).strip()
                        if text_str:
                            x_pct = float(td.get("xPct", 10.0) or 10.0)
                            y_pct = float(td.get("yPct", 10.0) or 10.0)
                            w_pct = float(td.get("widthPct", 35.0) or 35.0)
                            elements.append({
                                "type": "text",
                                "x": (x_pct / 100.0) * default_w,
                                "y": (y_pct / 100.0) * default_h,
                                "width": max(50.0, (w_pct / 100.0) * default_w),
                                "height": max(30.0, float(td.get("fontSize", 16.0)) * 2.5),
                                "text": text_str,
                                "fontSize": float(td.get("fontSize", 16.0) or 16.0),
                                "fontWeight": "bold" if td.get("isBold") else "normal",
                                "fontStyle": "italic" if td.get("isItalic") else "normal",
                                "textAlign": td.get("align", "left"),
                                "color": td.get("color", "#1e293b"),
                                "zIndex": 10
                            })

                    # If page was marked as single background image, add as element if not already present
                    if p_type == "image" and img_bg_path and os.path.exists(img_bg_path):
                        elements.append({
                            "type": "image",
                            "x": 36.0,
                            "y": 36.0,
                            "width": default_w - 72.0,
                            "height": default_h - 72.0,
                            "imagePath": img_bg_path,
                            "zIndex": 0
                        })

                # Determine working page dimensions
                page_w = float(base_page.mediabox.width) if (base_page and base_page.mediabox) else default_w
                page_h = float(base_page.mediabox.height) if (base_page and base_page.mediabox) else default_h

                # Build ReportLab canvas for elements / annotations
                t_fd, temp_rl_pdf = tempfile.mkstemp(suffix="_rl_page.pdf")
                os.close(t_fd)
                temp_files_to_clean.append(temp_rl_pdf)

                rl_canvas = canvas.Canvas(temp_rl_pdf, pagesize=(page_w, page_h))

                # Sort elements by zIndex
                sorted_elements = sorted(elements, key=lambda el: int(el.get("zIndex", 1) or el.get("z_index", 1) or 1))

                for elem in sorted_elements:
                    e_type = str(elem.get("type", "text")).lower()
                    x = float(elem.get("x", 0.0) or 0.0)
                    y = float(elem.get("y", 0.0) or 0.0)
                    w = max(10.0, float(elem.get("width", 100.0) or 100.0))
                    h = max(10.0, float(elem.get("height", 50.0) or 50.0))

                    # Convert screen coordinates (top-left origin) to PDF coordinates (bottom-left origin)
                    pdf_x = max(0.0, min(page_w - 10.0, x))
                    pdf_y = max(0.0, min(page_h - 10.0, page_h - y - h))

                    if e_type == "image":
                        img_source = elem.get("source") or elem.get("imagePath") or elem.get("image_path") or elem.get("previewUrl")
                        elem_id = str(elem.get("id", "image"))
                        
                        resolved_path, is_temp = self.resolve_and_validate_image(img_source, elem_id=elem_id)
                        if is_temp:
                            temp_files_to_clean.append(resolved_path)

                        try:
                            with Image.open(resolved_path) as pil_img:
                                if pil_img.mode in ("CMYK", "P", "RGBA"):
                                    pil_rgb = pil_img.convert("RGB")
                                    t_img_fd, temp_normalized_img = tempfile.mkstemp(suffix="_rgb.png")
                                    os.close(t_img_fd)
                                    temp_files_to_clean.append(temp_normalized_img)
                                    pil_rgb.save(temp_normalized_img, "PNG")
                                    resolved_path = temp_normalized_img

                                rl_canvas.drawImage(
                                    resolved_path,
                                    pdf_x,
                                    pdf_y,
                                    width=w,
                                    height=h,
                                    mask='auto',
                                    preserveAspectRatio=False
                                )
                        except Exception as img_err:
                            logger.error(f"Failed to render image element '{elem_id}' at '{resolved_path}' in ReportLab: {img_err}")
                            raise ValueError(f"Failed to embed image '{elem.get('fileName', 'image')}' into PDF: {img_err}")

                    elif e_type == "text":
                        text_val = str(elem.get("text", "")).strip()
                        if text_val:
                            font_size = float(elem.get("fontSize") or elem.get("font_size") or 14.0)
                            font_weight = str(elem.get("fontWeight") or elem.get("font_weight") or "normal").lower()
                            font_style = str(elem.get("fontStyle") or elem.get("font_style") or "normal").lower()
                            text_align_str = str(elem.get("textAlign") or elem.get("text_align") or "left").lower()
                            color_hex = str(elem.get("color", "#1e293b"))

                            is_bold = "bold" in font_weight
                            is_italic = "italic" in font_style

                            font_name = "Helvetica-Bold" if (is_bold and not is_italic) else \
                                        "Helvetica-Oblique" if (is_italic and not is_bold) else \
                                        "Helvetica-BoldOblique" if (is_bold and is_italic) else \
                                        "Helvetica"

                            align_code = TA_CENTER if text_align_str == "center" else \
                                         TA_RIGHT if text_align_str == "right" else \
                                         TA_JUSTIFY if text_align_str == "justify" else \
                                         TA_LEFT

                            escaped_text = html.escape(text_val).replace("\n", "<br/>")

                            try:
                                hex_color = colors.HexColor(color_hex)
                            except Exception:
                                hex_color = colors.HexColor("#1e293b")

                            p_style = ParagraphStyle(
                                name=f"style_{elem.get('id', 'txt')}_{idx}",
                                fontName=font_name,
                                fontSize=font_size,
                                leading=font_size * 1.25,
                                textColor=hex_color,
                                alignment=align_code
                            )

                            p_flowable = Paragraph(escaped_text, p_style)
                            frame = Frame(
                                pdf_x,
                                pdf_y,
                                w,
                                h,
                                id=f"f_{elem.get('id', 'txt')}_{idx}",
                                leftPadding=0,
                                rightPadding=0,
                                topPadding=0,
                                bottomPadding=0
                            )
                            frame.addFromList([p_flowable], rl_canvas)

                rl_canvas.showPage()
                rl_canvas.save()

                # Read the generated ReportLab page
                rl_reader = pypdf.PdfReader(temp_rl_pdf)
                rl_page = rl_reader.pages[0]

                if base_page is not None:
                    base_page.merge_page(rl_page)
                    writer.add_page(base_page)
                else:
                    if rotation != 0:
                        rl_page.rotate(rotation)
                    writer.add_page(rl_page)

            # Write to temporary output and atomically rename
            temp_out = abs_output + ".tmp"
            with open(temp_out, "wb") as f:
                writer.write(f)

            if os.path.exists(abs_output):
                os.remove(abs_output)
            os.rename(temp_out, abs_output)

            # Physical Verification
            if not os.path.exists(abs_output):
                raise RuntimeError(f"Physical PDF output file was not created at '{abs_output}'.")

            file_size_bytes = os.path.getsize(abs_output)
            if file_size_bytes <= 0:
                raise RuntimeError(f"Created PDF file at '{abs_output}' is empty (0 bytes).")

            with open(abs_output, "rb") as verify_f:
                magic_header = verify_f.read(5)
                if magic_header != b"%PDF-":
                    raise RuntimeError(f"Created file '{abs_output}' has an invalid PDF header: {magic_header}")

            verify_reader = pypdf.PdfReader(abs_output)
            final_page_count = len(verify_reader.pages)
            if final_page_count != len(pages):
                logger.warning(f"Page count mismatch in exported PDF: expected {len(pages)}, got {final_page_count}.")

            # Memora DB Registration & Indexing
            file_id = None
            pdf_doc_id = None
            indexed = False

            if db and register_in_db:
                try:
                    file_id = self.register_file_in_memora_db(db, abs_output, folder_id)
                    pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
                    pdf_doc_id = pdf_doc.id
                    indexed = file_id is not None
                except Exception as idx_err:
                    logger.error(f"Memora indexing failed for '{abs_output}': {idx_err}", exc_info=True)
                    indexed = False

            return {
                "status": "success",
                "output_path": abs_output,
                "file_name": os.path.basename(abs_output),
                "page_count": final_page_count,
                "file_size_bytes": file_size_bytes,
                "file_id": file_id,
                "pdf_document_id": pdf_doc_id,
                "verified": True,
                "indexed": indexed,
                "message": f"Successfully compiled and verified PDF document '{os.path.basename(abs_output)}' ({final_page_count} page(s))."
            }

        finally:
            for tmp_f in temp_files_to_clean:
                if os.path.exists(tmp_f):
                    try:
                        os.remove(tmp_f)
                    except Exception:
                        pass
                        pass

    def export_pdf_with_annotations(
        self,
        source_path: str,
        output_path: str,
        annotations: Optional[List[Dict[str, Any]]] = None,
        db=None,
        register_in_db: bool = True,
        flatten: bool = True
    ) -> Dict[str, Any]:
        """
        Exports a real PDF file containing physically rendered text overlay, highlights, shapes, drawings, and notes.
        Merges transparent RGBA vector overlay canvas onto each original PDF page.
        """
        import math
        import tempfile
        from PIL import Image, ImageDraw, ImageFont

        abs_source = self.validate_pdf_path(source_path)
        reader = pypdf.PdfReader(abs_source)
        total_pages = len(reader.pages)

        # Validate incoming annotation payloads
        validated_annos = []
        if annotations:
            for a in annotations:
                validated_annos.append(self.validate_annotation_payload(a, max_pages=total_pages))

        # Group annotations by page_index
        annos_by_page = {}
        for a in validated_annos:
            idx = a["page_index"]
            if idx not in annos_by_page:
                annos_by_page[idx] = []
            annos_by_page[idx].append(a)

        writer = pypdf.PdfWriter()

        for idx, base_page in enumerate(reader.pages):
            page_annos = annos_by_page.get(idx, [])

            if not page_annos:
                writer.add_page(base_page)
                continue

            # Calculate physical page dimensions in points (72 pt/inch)
            w_pt = float(base_page.mediabox.width) if base_page.mediabox else 595.28
            h_pt = float(base_page.mediabox.height) if base_page.mediabox else 841.89

            # Scale up for crisp rendering (dpi_scale = 2.0 => 144 DPI)
            scale = 2.0
            canvas_w = int(w_pt * scale)
            canvas_h = int(h_pt * scale)

            overlay_img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay_img, "RGBA")

            for a in page_annos:
                a_type = a["annotation_type"]
                x = float(a.get("x", 0.0) or 0.0) * scale
                y = float(a.get("y", 0.0) or 0.0) * scale
                w = float(a.get("width", 0.0) or 0.0) * scale
                h = float(a.get("height", 0.0) or 0.0) * scale
                x2 = float(a.get("x2", 0.0) or 0.0) * scale if a.get("x2") is not None else None
                y2 = float(a.get("y2", 0.0) or 0.0) * scale if a.get("y2") is not None else None

                color_str = a.get("color", "#000000")
                fill_color_str = a.get("fill_color")
                stroke_width = float(a.get("stroke_width", 2.0) or 2.0) * scale
                opacity = float(a.get("opacity", 1.0) if a.get("opacity") is not None else 1.0)
                font_size = float(a.get("font_size", 14.0) or 14.0) * scale
                text_content = a.get("content_text", "")

                rgba_stroke = self._parse_rgba_color(color_str, opacity)
                rgba_fill = self._parse_rgba_color(fill_color_str, opacity) if fill_color_str else None

                if a_type == "text":
                    try:
                        font_obj = ImageFont.load_default()
                    except Exception:
                        font_obj = None

                    if text_content:
                        draw.text((x, y), text_content, fill=rgba_stroke, font=font_obj)

                elif a_type == "highlight":
                    # Translucent yellow or custom highlight
                    hl_color = self._parse_rgba_color(color_str or "#ffff00", alpha_factor=0.4 * opacity)
                    draw.rectangle([x, y, x + max(10.0, w), y + max(10.0, h)], fill=hl_color)

                elif a_type == "draw":
                    # Freehand pen drawing
                    points = a.get("points")
                    if points and len(points) >= 2:
                        flat_pts = []
                        for pt in points:
                            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                                flat_pts.append((float(pt[0]) * scale, float(pt[1]) * scale))
                        if len(flat_pts) >= 2:
                            draw.line(flat_pts, fill=rgba_stroke, width=max(1, int(stroke_width)))

                elif a_type == "line":
                    tx2 = x2 if x2 is not None else (x + w)
                    ty2 = y2 if y2 is not None else (y + h)
                    draw.line([(x, y), (tx2, ty2)], fill=rgba_stroke, width=max(1, int(stroke_width)))

                elif a_type == "arrow":
                    tx2 = x2 if x2 is not None else (x + w)
                    ty2 = y2 if y2 is not None else (y + h)
                    draw.line([(x, y), (tx2, ty2)], fill=rgba_stroke, width=max(1, int(stroke_width)))
                    
                    # Draw Arrowhead polygon at (tx2, ty2)
                    angle = math.atan2(ty2 - y, tx2 - x)
                    arrow_len = max(14.0 * scale, stroke_width * 3.5)
                    left_x = tx2 - arrow_len * math.cos(angle - math.pi / 6)
                    left_y = ty2 - arrow_len * math.sin(angle - math.pi / 6)
                    right_x = tx2 - arrow_len * math.cos(angle + math.pi / 6)
                    right_y = ty2 - arrow_len * math.sin(angle + math.pi / 6)
                    draw.polygon([(tx2, ty2), (left_x, left_y), (right_x, right_y)], fill=rgba_stroke)

                elif a_type == "rectangle":
                    draw.rectangle(
                        [x, y, x + max(1.0, w), y + max(1.0, h)],
                        outline=rgba_stroke,
                        fill=rgba_fill,
                        width=max(1, int(stroke_width))
                    )

                elif a_type == "circle":
                    draw.ellipse(
                        [x, y, x + max(1.0, w), y + max(1.0, h)],
                        outline=rgba_stroke,
                        fill=rgba_fill,
                        width=max(1, int(stroke_width))
                    )

                elif a_type == "note":
                    note_w = max(36.0 * scale, w)
                    note_h = max(36.0 * scale, h)
                    note_bg = (255, 235, 59, int(230 * opacity))
                    note_border = (251, 192, 45, int(255 * opacity))
                    
                    draw.rectangle([x, y, x + note_w, y + note_h], fill=note_bg, outline=note_border, width=2)
                    # Folded corner
                    draw.polygon(
                        [(x + note_w - (8.0 * scale), y), (x + note_w, y + (8.0 * scale)), (x + note_w - (8.0 * scale), y + (8.0 * scale))],
                        fill=note_border
                    )
                    if text_content:
                        draw.text((x + (4.0 * scale), y + (4.0 * scale)), text_content[:40], fill=(0, 0, 0, int(255 * opacity)))

            # Save overlay image as 1-page PDF
            temp_overlay_fd, temp_overlay_pdf = tempfile.mkstemp(suffix="_overlay.pdf")
            os.close(temp_overlay_fd)
            try:
                # Save at 144 DPI (72 * scale) so page size pt matches (w_pt, h_pt)
                overlay_img.save(temp_overlay_pdf, "PDF", dpi=(144, 144))
                overlay_reader = pypdf.PdfReader(temp_overlay_pdf)
                if len(overlay_reader.pages) > 0:
                    base_page.merge_page(overlay_reader.pages[0])
            finally:
                if os.path.exists(temp_overlay_pdf):
                    try:
                        os.remove(temp_overlay_pdf)
                    except Exception:
                        pass
                overlay_img.close()

            writer.add_page(base_page)

        abs_output = os.path.abspath(output_path)
        os.makedirs(os.path.dirname(abs_output), exist_ok=True)
        
        temp_out = abs_output + ".tmp"
        with open(temp_out, "wb") as f:
            writer.write(f)

        if os.path.exists(abs_output):
            os.remove(abs_output)
        os.rename(temp_out, abs_output)

        final_reader = pypdf.PdfReader(abs_output)
        final_page_count = len(final_reader.pages)

        file_id = None
        pdf_doc_id = None

        if db and register_in_db:
            file_id = self.register_file_in_memora_db(db, abs_output)
            pdf_doc = self.register_or_get_document_record(db, abs_output, title=os.path.basename(abs_output), file_id=file_id)
            pdf_doc_id = pdf_doc.id

        return {
            "status": "success",
            "output_path": abs_output,
            "file_name": os.path.basename(abs_output),
            "page_count": final_page_count,
            "file_size_bytes": os.path.getsize(abs_output),
            "file_id": file_id,
            "pdf_document_id": pdf_doc_id,
            "message": f"Successfully exported PDF with {len(validated_annos)} annotation/text object(s) onto {os.path.basename(abs_output)}."
        }

    # ==========================================
    # MEMORA CORE FILE SYSTEM INTEGRATION
    # ==========================================

    @staticmethod
    def validate_path_safety(file_path: str) -> str:
        """
        Validates path against path traversal, null bytes, and unsafe file access.
        Returns clean absolute path.
        """
        if not file_path or not isinstance(file_path, str):
            raise ValueError("File path must be a non-empty string.")

        if "\0" in file_path:
            raise ValueError("Path traversal attempt detected (null byte).")

        cleaned = os.path.abspath(file_path)

        if ".." in file_path.split(os.sep) or ".." in file_path.split("/"):
            raise ValueError("Path traversal attempt detected ('..').")

        return cleaned

    def get_memora_files(
        self,
        db,
        file_type: str = "all",
        folder_id: Optional[int] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Queries real existing Memora files from core `files` table for PDF Studio integration.
        Supports filtering by file_type (pdf, image, scanned, all), folder_id, and query search string.
        """
        from ..models import File

        db_query = db.query(File)

        if folder_id:
            db_query = db_query.filter(File.folder_id == folder_id)

        ft_clean = (file_type or "all").lower().strip()
        if ft_clean == "pdf":
            db_query = db_query.filter(File.extension == ".pdf")
        elif ft_clean == "image":
            db_query = db_query.filter(File.extension.in_([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]))
        elif ft_clean == "scanned":
            db_query = db_query.filter(File.extension.in_([".pdf", ".png", ".jpg", ".jpeg", ".tiff"]))

        if query and query.strip():
            search_str = f"%{query.strip()}%"
            db_query = db_query.filter(File.name.ilike(search_str))

        total = db_query.count()
        files = db_query.order_by(File.modified_at.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "files": files
        }

    def search_memora_files_for_pdf_studio(self, db, query: str, top_k: int = 20, file_type: Optional[str] = None):
        """
        Reuses Module 1 search_service to perform semantic / hybrid search over Memora files for PDF Studio.
        Avoids creating duplicate embeddings or search indices.
        """
        from .search_service import search_service
        from ..schemas import SearchFilters

        filters = SearchFilters(file_type=file_type) if file_type else None
        return search_service.execute_search(db, query=query, top_k=top_k, filters=filters)

    def export_image_comparison_to_pdf(
        self,
        image_paths: List[str],
        output_path: str,
        title: str = "Image Comparison Report",
        similarity_score: Optional[float] = None,
        notes: Optional[str] = None,
        db=None,
        folder_id: Optional[int] = None,
        register_in_db: bool = True
    ) -> Dict[str, Any]:
        """
        Exports Module 3 image comparison results into a structured PDF document via PDF Studio.
        Combines comparison images onto PDF pages with annotated metadata overlay without altering Module 3 algorithms.
        """
        if not image_paths:
            raise ValueError("At least one image path is required for comparison PDF export.")

        validated_paths = [self.validate_image_file(p) for p in image_paths]

        # Use PDF Studio images_to_pdf base generator
        res_base = self.images_to_pdf(
            image_paths=validated_paths,
            output_path=output_path,
            page_size="A4",
            fit_to_page=True,
            db=None,
            folder_id=folder_id,
            register_in_db=False
        )

        annotations = [
            {
                "page_index": 0,
                "annotation_type": "text",
                "content_text": title or "Image Comparison Report",
                "x": 30.0,
                "y": 30.0,
                "font_size": 20.0,
                "color": "#0f172a"
            }
        ]

        if similarity_score is not None:
            annotations.append({
                "page_index": 0,
                "annotation_type": "note",
                "content_text": f"Visual Similarity: {similarity_score:.1f}%",
                "x": 30.0,
                "y": 60.0,
                "width": 180.0,
                "height": 40.0
            })

        if notes:
            annotations.append({
                "page_index": 0,
                "annotation_type": "text",
                "content_text": notes,
                "x": 30.0,
                "y": 110.0,
                "font_size": 12.0,
                "color": "#334155"
            })

        # Apply annotation metadata overlay & auto-register in Memora DB
        return self.export_pdf_with_annotations(
            source_path=output_path,
            output_path=output_path,
            annotations=annotations,
            db=db,
            register_in_db=register_in_db
        )

    # ==========================================
    # PDF STUDIO DRAFTS PERSISTENCE
    # ==========================================

    def save_draft(self, db, draft_id: Optional[str], name: str, document_json: str, page_count: int = 1):
        import uuid
        import json
        from ..models import PDFDraft

        if not draft_id or draft_id == "null":
            draft_id = f"draft_{uuid.uuid4().hex[:10]}"

        try:
            _ = json.loads(document_json)
        except Exception as je:
            raise ValueError(f"Invalid document model JSON for draft: {je}")

        draft = db.query(PDFDraft).filter(PDFDraft.id == draft_id).first()
        if draft:
            draft.name = name or draft.name
            draft.document_json = document_json
            draft.page_count = page_count
        else:
            draft = PDFDraft(
                id=draft_id,
                name=name or "Untitled PDF",
                document_json=document_json,
                page_count=page_count
            )
            db.add(draft)

        db.commit()
        db.refresh(draft)
        return draft

    def list_drafts(self, db):
        from ..models import PDFDraft
        return db.query(PDFDraft).order_by(PDFDraft.updated_at.desc()).all()

    def get_draft(self, db, draft_id: str):
        from ..models import PDFDraft
        draft = db.query(PDFDraft).filter(PDFDraft.id == draft_id).first()
        if not draft:
            raise FileNotFoundError(f"PDF Draft '{draft_id}' not found.")
        return draft

    def delete_draft(self, db, draft_id: str):
        from ..models import PDFDraft
        draft = db.query(PDFDraft).filter(PDFDraft.id == draft_id).first()
        if not draft:
            raise FileNotFoundError(f"PDF Draft '{draft_id}' not found.")
        db.delete(draft)
        db.commit()
        return {"status": "success", "message": f"Draft '{draft_id}' deleted."}


pdf_service = PdfService()





