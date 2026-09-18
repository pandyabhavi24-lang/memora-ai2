import os
import time
import logging
from dataclasses import dataclass
from typing import Optional

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    pypdf = None
    PYPDF_AVAILABLE = False

logger = logging.getLogger("memora.pdf_optimizer")


class PdfOptimizationError(Exception):
    """Raised when PDF optimization fails or encounters an unrecoverable validation error."""
    pass


@dataclass
class PdfOptimizationResult:
    """Metadata describing the generated PDF optimization candidate."""
    source_path: str
    candidate_path: str
    original_size: int
    candidate_size: int
    page_count: int
    strategy_used: str
    is_lossless: bool
    execution_time_ms: float


class PdfOptimizer:
    """
    Focused PDF optimization engine for Memora AI Storage Analysis & Optimization V1.
    
    Performs pure Python lossless structural PDF optimization using pypdf:
    - Re-compresses uncompressed page and content streams using FlateDecode.
    - Deduplicates identical indirect objects (shared fonts, stream dicts).
    - Preserves document layout, pages, annotations, fonts, and metadata.
    
    Safety Rules:
    - Never modifies, overwrites, or deletes the source PDF.
    - Never uses external binaries (no qpdf, no Ghostscript, no subprocess).
    - Rejects encrypted / password-protected documents cleanly.
    - Validates candidate integrity by re-reading all pages and checking mediabox.
    - Automatically cleans up any partial or failed candidate on error.
    """

    def optimize_pdf(
        self,
        source_path: str,
        candidate_path: str
    ) -> PdfOptimizationResult:
        """
        Generates and validates an optimized candidate PDF from source_path.

        Args:
            source_path: Absolute path to the existing source PDF file.
            candidate_path: Destination path where candidate PDF will be written.

        Returns:
            PdfOptimizationResult containing candidate metadata and sizes.

        Raises:
            PdfOptimizationError if source is invalid, encrypted, or validation fails.
        """
        if not PYPDF_AVAILABLE:
            raise PdfOptimizationError("pypdf library is not installed in environment.")

        start_time = time.perf_counter()

        # 1. Source existence & path safety checks
        if not source_path or not isinstance(source_path, str):
            raise PdfOptimizationError("Source path must be a non-empty string.")

        if not os.path.exists(source_path):
            raise PdfOptimizationError(f"Source file does not exist: '{source_path}'")

        if not os.path.isfile(source_path):
            raise PdfOptimizationError(f"Source path is not a file: '{source_path}'")

        if not source_path.lower().endswith(".pdf"):
            raise PdfOptimizationError(f"Source file does not have a .pdf extension: '{source_path}'")

        if not candidate_path or not isinstance(candidate_path, str):
            raise PdfOptimizationError("Candidate path must be a non-empty string.")

        source_abs = os.path.abspath(source_path)
        candidate_abs = os.path.abspath(candidate_path)

        if source_abs == candidate_abs:
            raise PdfOptimizationError("Candidate path must not be identical to source path.")

        # Ensure candidate directory exists
        candidate_dir = os.path.dirname(candidate_abs)
        if candidate_dir:
            os.makedirs(candidate_dir, exist_ok=True)

        original_size = os.path.getsize(source_abs)

        try:
            # 2. Open source PDF with pypdf and inspect header
            try:
                reader = pypdf.PdfReader(source_abs)
            except Exception as read_err:
                raise PdfOptimizationError(f"Failed to read source PDF: {read_err}") from read_err

            # Check encryption
            if getattr(reader, "is_encrypted", False):
                raise PdfOptimizationError(
                    "Encrypted or password-protected PDFs cannot be safely optimized in V1."
                )

            page_count = len(reader.pages)
            if page_count == 0:
                raise PdfOptimizationError("Source PDF contains 0 pages.")

            # Capture source page mediaboxes for post-validation comparison
            source_mediaboxes = []
            for p in reader.pages:
                mb = p.mediabox
                source_mediaboxes.append((float(mb.width), float(mb.height)) if mb else (0.0, 0.0))

            # 3. Create writer and clone document structure
            writer = pypdf.PdfWriter()
            writer.clone_document_from_reader(reader)

            # 4. Stream compression on content streams
            for page in writer.pages:
                try:
                    page.compress_content_streams()
                except Exception as comp_err:
                    logger.debug(f"Stream compression skipped for page: {comp_err}")

            # 5. Deduplicate identical indirect objects (fonts, duplicate resources)
            try:
                writer.compress_identical_objects()
            except Exception as dup_err:
                logger.debug(f"Object deduplication skipped: {dup_err}")

            # 6. Write candidate to candidate_path
            with open(candidate_abs, "wb") as f_out:
                writer.write(f_out)

            # 7. Candidate Integrity Validation
            self._validate_candidate(
                candidate_path=candidate_abs,
                expected_page_count=page_count,
                expected_mediaboxes=source_mediaboxes
            )

            candidate_size = os.path.getsize(candidate_abs)
            execution_time = round((time.perf_counter() - start_time) * 1000, 2)

            return PdfOptimizationResult(
                source_path=source_abs,
                candidate_path=candidate_abs,
                original_size=original_size,
                candidate_size=candidate_size,
                page_count=page_count,
                strategy_used="pypdf_stream_deflate_and_deduplicate",
                is_lossless=True,
                execution_time_ms=execution_time
            )

        except PdfOptimizationError as err:
            self._cleanup_candidate(candidate_abs)
            raise err
        except Exception as err:
            self._cleanup_candidate(candidate_abs)
            logger.error(f"Unexpected error optimizing PDF '{source_abs}': {err}", exc_info=True)
            raise PdfOptimizationError(f"PDF optimization failed: {str(err)}") from err

    def _validate_candidate(
        self,
        candidate_path: str,
        expected_page_count: int,
        expected_mediaboxes: list
    ):
        """
        Validates the newly written candidate PDF.
        Confirms file existence, size > 0, structural read by PdfReader,
        page count equality, and that every page can be accessed with intact mediabox.
        """
        if not os.path.exists(candidate_path):
            raise PdfOptimizationError("Candidate PDF file was not created on disk.")

        if os.path.getsize(candidate_path) == 0:
            raise PdfOptimizationError("Candidate PDF was created with 0 bytes.")

        try:
            cand_reader = pypdf.PdfReader(candidate_path)

            if getattr(cand_reader, "is_encrypted", False):
                raise PdfOptimizationError("Candidate PDF became unexpectedly encrypted.")

            cand_pages = len(cand_reader.pages)
            if cand_pages != expected_page_count:
                raise PdfOptimizationError(
                    f"Candidate page count mismatch: expected {expected_page_count}, got {cand_pages}."
                )

            # Iterate every page to verify stream integrity and dimensions
            for idx, page in enumerate(cand_reader.pages):
                # Verify mediabox exists and matches
                mb = page.mediabox
                if mb:
                    w, h = float(mb.width), float(mb.height)
                    exp_w, exp_h = expected_mediaboxes[idx]
                    if abs(w - exp_w) > 1.0 or abs(h - exp_h) > 1.0:
                        raise PdfOptimizationError(
                            f"Page {idx} dimensions altered: expected ({exp_w}, {exp_h}), got ({w}, {h})."
                        )

        except Exception as val_err:
            raise PdfOptimizationError(f"Candidate PDF validation failed: {val_err}") from val_err

    def _cleanup_candidate(self, candidate_path: str):
        """Safely removes candidate file if generation or validation failed."""
        if candidate_path and os.path.exists(candidate_path):
            try:
                os.remove(candidate_path)
            except Exception as e:
                logger.debug(f"Failed to remove temporary candidate '{candidate_path}': {e}")


pdf_optimizer = PdfOptimizer()
