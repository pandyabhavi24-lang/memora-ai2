import io
import os
import time
import logging
from dataclasses import dataclass
from typing import Optional, Tuple, List, Set, Any

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    pypdf = None
    PYPDF_AVAILABLE = False

try:
    from PIL import Image as PilImage
    PILLOW_AVAILABLE = True
except ImportError:
    PilImage = None
    PILLOW_AVAILABLE = False

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
    images_found: int = 0
    images_recompressed: int = 0
    images_downsampled: int = 0
    streams_compressed: int = 0


class PdfOptimizer:
    """
    Enhanced PDF optimization engine for Memora AI Storage Analysis & Optimization V2.

    Lossless pipeline:
    - Strips embedded XMP catalog metadata blobs, /PieceInfo private app data, and page thumbnails.
    - Re-compresses uncompressed and page content streams with FlateDecode (zlib level 9).
    - Deduplicates identical indirect objects (shared fonts, stream dicts, color spaces).

    Lossy / Balanced pipeline (adds):
    - Scans embedded image XObjects across all pages and recursive Form XObjects.
    - Re-encodes embedded JPEG, FlateDecode (PNG/raster scans), and raw/LZW images as high-quality JPEG (quality 50-95).
    - Supports resolution downsampling (max_dimension) with high-fidelity LANCZOS filter for oversized scans/photos.
    - Preserves alpha transparency and /SMasks safely to prevent black background corruption.
    - Safeguards against size regression (never replaces an image if the new version is larger).

    Safety Rules:
    - Never modifies, overwrites, or deletes the source PDF.
    - Never uses external binaries (no qpdf, no Ghostscript, no subprocess).
    - Rejects encrypted / password-protected documents cleanly.
    - Validates candidate integrity by re-reading all pages and checking mediabox.
    - Automatically cleans up any partial or failed candidate on error.
    - Per-image errors are caught; processing continues on remaining images.
    """

    _JPEG_FILTERS = {"/DCTDecode", "/DCT"}
    _FLATE_FILTERS = {"/FlateDecode", "/Fl"}
    _LZW_FILTERS = {"/LZWDecode", "/LZW"}

    def optimize_pdf(
        self,
        source_path: str,
        candidate_path: str,
        image_quality: int = 75,
        strip_metadata: bool = True,
        lossy: bool = False,
        max_dimension: Optional[int] = None,
    ) -> PdfOptimizationResult:
        """
        Generates and validates an optimized candidate PDF from source_path.

        Args:
            source_path:    Absolute path to the existing source PDF file.
            candidate_path: Destination path where candidate PDF will be written.
            image_quality:  JPEG re-encode quality for embedded images (50-95). Default: 75.
            strip_metadata: Remove XMP metadata blobs, /PieceInfo, and page thumbnails. Default: True.
            lossy:          When True, re-encodes embedded raster images at image_quality / max_dimension.
                            When False (default), only lossless structural optimizations run.
            max_dimension:  Optional maximum width or height for embedded images in pixels (e.g. 1920).

        Returns:
            PdfOptimizationResult containing candidate metadata, statistics, and sizes.

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

        candidate_dir = os.path.dirname(candidate_abs)
        if candidate_dir:
            os.makedirs(candidate_dir, exist_ok=True)

        original_size = os.path.getsize(source_abs)
        image_quality = max(50, min(95, int(image_quality)))
        max_dim = int(max_dimension) if (max_dimension and max_dimension > 0) else None

        try:
            # 2. Open source PDF with pypdf
            try:
                reader = pypdf.PdfReader(source_abs)
            except Exception as read_err:
                raise PdfOptimizationError(f"Failed to read source PDF: {read_err}") from read_err

            if getattr(reader, "is_encrypted", False):
                raise PdfOptimizationError(
                    "Encrypted or password-protected PDFs cannot be safely optimized."
                )

            page_count = len(reader.pages)
            if page_count == 0:
                raise PdfOptimizationError("Source PDF contains 0 pages.")

            # Capture source page mediaboxes for post-validation
            source_mediaboxes = []
            for p in reader.pages:
                mb = p.mediabox
                source_mediaboxes.append((float(mb.width), float(mb.height)) if mb else (0.0, 0.0))

            # 3. Clone document structure
            writer = pypdf.PdfWriter()
            writer.clone_document_from_reader(reader)

            strategies = []

            # 4. Strip XMP metadata, /PieceInfo and page thumbnails (lossless)
            if strip_metadata:
                stripped = self._strip_metadata(writer)
                if stripped:
                    strategies.append("metadata_stripped")

            # 5. Image Optimization (lossy / balanced mode with Pillow)
            images_found = 0
            images_recompressed = 0
            images_downsampled = 0

            if lossy and PILLOW_AVAILABLE:
                img_stats = self._recompress_images(
                    writer=writer,
                    quality=image_quality,
                    max_dim=max_dim
                )
                images_found = img_stats["found"]
                images_recompressed = img_stats["recompressed"]
                images_downsampled = img_stats["downsampled"]

                if images_recompressed > 0:
                    strat = f"images_optimized({images_recompressed}@q{image_quality}"
                    if images_downsampled > 0:
                        strat += f",resample={images_downsampled}"
                    strat += ")"
                    strategies.append(strat)
            elif lossy and not PILLOW_AVAILABLE:
                logger.warning("Lossy PDF requested but Pillow is not installed; falling back to lossless structural.")

            # 6. Compress content streams (lossless Flate)
            streams_compressed = 0
            for page in writer.pages:
                try:
                    page.compress_content_streams()
                    streams_compressed += 1
                except Exception as comp_err:
                    logger.debug(f"Stream compression skipped for page: {comp_err}")
            if streams_compressed > 0:
                strategies.append("content_streams_deflated")

            # 7. Deduplicate identical indirect objects
            try:
                writer.compress_identical_objects()
                strategies.append("objects_deduplicated")
            except Exception as dup_err:
                logger.debug(f"Object deduplication skipped: {dup_err}")

            # 8. Write candidate to candidate_path
            with open(candidate_abs, "wb") as f_out:
                writer.write(f_out)

            # 9. Candidate Integrity Validation
            self._validate_candidate(
                candidate_path=candidate_abs,
                expected_page_count=page_count,
                expected_mediaboxes=source_mediaboxes
            )

            candidate_size = os.path.getsize(candidate_abs)
            execution_time = round((time.perf_counter() - start_time) * 1000, 2)
            strategy_label = "+".join(strategies) if strategies else "pypdf_structural"
            is_lossless = not (lossy and images_recompressed > 0)

            return PdfOptimizationResult(
                source_path=source_abs,
                candidate_path=candidate_abs,
                original_size=original_size,
                candidate_size=candidate_size,
                page_count=page_count,
                strategy_used=strategy_label,
                is_lossless=is_lossless,
                execution_time_ms=execution_time,
                images_found=images_found,
                images_recompressed=images_recompressed,
                images_downsampled=images_downsampled,
                streams_compressed=streams_compressed
            )

        except PdfOptimizationError as err:
            self._cleanup_candidate(candidate_abs)
            raise err
        except Exception as err:
            self._cleanup_candidate(candidate_abs)
            logger.error(f"Unexpected error optimizing PDF '{source_abs}': {err}", exc_info=True)
            raise PdfOptimizationError(f"PDF optimization failed: {str(err)}") from err

    # =========================================================================
    # Internal helpers
    # =========================================================================

    def _strip_metadata(self, writer) -> bool:
        """
        Removes /Metadata (XMP blobs) and /PieceInfo (private app editing blobs)
        from document catalog, plus /Thumb (page thumbnail images) from pages.
        """
        removed = False
        try:
            if hasattr(writer, "_root_object"):
                root = writer._root_object
                if isinstance(root, dict):
                    if "/Metadata" in root:
                        del root["/Metadata"]
                        removed = True
                    if "/PieceInfo" in root:
                        del root["/PieceInfo"]
                        removed = True
        except Exception as e:
            logger.debug(f"Metadata strip skipped (root): {e}")

        for page in writer.pages:
            try:
                if "/Thumb" in page:
                    del page["/Thumb"]
                    removed = True
                if "/PieceInfo" in page:
                    del page["/PieceInfo"]
                    removed = True
            except Exception as e:
                logger.debug(f"Thumb strip skipped for page: {e}")

        return removed

    def _collect_xobjects(self, resources, processed_dict_ids: Set[int]) -> List[Tuple[Any, str]]:
        """
        Recursively discovers all image XObjects on a page or inside Form XObjects.
        Returns list of (xobject_dictionary, debug_name).
        """
        images = []
        if not resources:
            return images

        res_id = id(resources)
        if res_id in processed_dict_ids:
            return images
        processed_dict_ids.add(res_id)

        try:
            xobjects = resources.get("/XObject")
            if not xobjects:
                return images

            if hasattr(xobjects, "get_object"):
                xobjects = xobjects.get_object()

            if not isinstance(xobjects, dict):
                return images

            for name, xobj_ref in list(xobjects.items()):
                try:
                    xobj = xobj_ref.get_object() if hasattr(xobj_ref, "get_object") else xobj_ref
                    if not isinstance(xobj, dict):
                        continue

                    subtype = str(xobj.get("/Subtype", ""))
                    if subtype == "/Image":
                        images.append((xobj, str(name)))
                    elif subtype == "/Form":
                        # Recurse into form resources
                        form_res = xobj.get("/Resources")
                        if form_res:
                            if hasattr(form_res, "get_object"):
                                form_res = form_res.get_object()
                            images.extend(self._collect_xobjects(form_res, processed_dict_ids))
                except Exception as inner_err:
                    logger.debug(f"Skipping XObject resource '{name}': {inner_err}")
        except Exception as e:
            logger.debug(f"Error scanning XObjects: {e}")

        return images

    def _recompress_images(
        self,
        writer,
        quality: int,
        max_dim: Optional[int] = None
    ) -> dict:
        """
        Re-encodes embedded image XObjects across pages and nested forms.
        Supports /DCTDecode, /FlateDecode, /LZWDecode, and raw images.
        Downsamples resolution if max_dim is set and image exceeds it.
        Safeguards transparency and ensures candidate is strictly smaller.
        """
        stats = {
            "found": 0,
            "recompressed": 0,
            "downsampled": 0
        }

        processed_dict_ids: Set[int] = set()
        seen_images: Set[int] = set()

        all_images: List[Tuple[Any, str]] = []
        for page in writer.pages:
            try:
                res = page.get("/Resources")
                if res:
                    if hasattr(res, "get_object"):
                        res = res.get_object()
                    all_images.extend(self._collect_xobjects(res, processed_dict_ids))
            except Exception as e:
                logger.debug(f"Page resource extraction skipped: {e}")

        stats["found"] = len(all_images)

        for xobj, img_name in all_images:
            xobj_id = id(xobj)
            if xobj_id in seen_images:
                continue
            seen_images.add(xobj_id)

            try:
                # Safety exclusions
                if xobj.get("/ImageMask") is True:
                    continue  # 1-bit stencil mask
                if "/SMask" in xobj:
                    # Has separate soft-mask transparency — skip lossy conversion to avoid alpha loss
                    continue

                # Filter inspect
                raw_filter = xobj.get("/Filter")
                if hasattr(raw_filter, "get_object"):
                    raw_filter = raw_filter.get_object()
                if isinstance(raw_filter, pypdf.generic.ArrayObject):
                    continue  # Multi-stage chained filters — preserve as-is

                filter_name = str(raw_filter) if raw_filter is not None else ""

                # Decode into PIL Image
                img = None
                if hasattr(xobj, "decode_as_image"):
                    try:
                        img = xobj.decode_as_image()
                    except Exception as e:
                        logger.debug(f"decode_as_image fallback for {img_name}: {e}")

                if img is None:
                    try:
                        raw_data = xobj.get_data()
                        if raw_data:
                            img = PilImage.open(io.BytesIO(raw_data))
                            img.load()
                    except Exception:
                        try:
                            w = int(xobj.get("/Width", 0))
                            h = int(xobj.get("/Height", 0))
                            bpc = int(xobj.get("/BitsPerComponent", 8))
                            colorspace = xobj.get("/ColorSpace")
                            cs_str = str(colorspace) if colorspace else "/DeviceRGB"
                            mode = "RGB" if "RGB" in cs_str else "L"
                            raw_data = xobj.get_data()
                            if w > 0 and h > 0 and bpc == 8 and raw_data:
                                img = PilImage.frombytes(mode, (w, h), raw_data)
                        except Exception:
                            continue

                if img is None:
                    continue

                # Transparency check
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    # Image has alpha transparency — avoid converting to JPEG (which lacks alpha)
                    continue

                original_stream_data = getattr(xobj, "_data", None) or xobj.get_data()
                if not original_stream_data:
                    continue
                original_stream_len = len(original_stream_data)

                # Resolution Downsampling (Optional LANCZOS resize)
                downsampled = False
                orig_w, orig_h = img.size
                if max_dim and max(orig_w, orig_h) > max_dim:
                    scale = max_dim / max(orig_w, orig_h)
                    new_w = max(1, int(orig_w * scale))
                    new_h = max(1, int(orig_h * scale))
                    img = img.resize((new_w, new_h), PilImage.Resampling.LANCZOS)
                    downsampled = True

                # Normalize color format for JPEG
                if img.mode not in ("RGB", "L"):
                    try:
                        img = img.convert("RGB")
                    except Exception:
                        continue

                # Re-encode as optimized JPEG
                buf = io.BytesIO()
                img.save(
                    buf,
                    format="JPEG",
                    quality=quality,
                    optimize=True,
                    progressive=True
                )
                new_bytes = buf.getvalue()

                # Strictly only replace if candidate stream is genuinely smaller
                if len(new_bytes) >= original_stream_len:
                    continue

                # Patch the XObject dictionary in-place
                xobj._data = new_bytes
                xobj[pypdf.generic.NameObject("/Filter")] = pypdf.generic.NameObject("/DCTDecode")
                xobj[pypdf.generic.NameObject("/Length")] = pypdf.generic.NumberObject(len(new_bytes))
                xobj[pypdf.generic.NameObject("/ColorSpace")] = pypdf.generic.NameObject(
                    "/DeviceRGB" if img.mode == "RGB" else "/DeviceGray"
                )
                xobj[pypdf.generic.NameObject("/BitsPerComponent")] = pypdf.generic.NumberObject(8)
                xobj[pypdf.generic.NameObject("/Width")] = pypdf.generic.NumberObject(img.width)
                xobj[pypdf.generic.NameObject("/Height")] = pypdf.generic.NumberObject(img.height)

                # Strip obsolete predictor or decode keys from prior Flate/PNG filters
                for old_key in (
                    "/DecodeParms",
                    "/FFilter",
                    "/FDecodeParms",
                    "/Predictor",
                    "/Columns",
                    "/Colors",
                    "/Decode"
                ):
                    if old_key in xobj:
                        del xobj[old_key]

                stats["recompressed"] += 1
                if downsampled:
                    stats["downsampled"] += 1

            except Exception as item_err:
                logger.debug(f"Skipping XObject '{img_name}': {item_err}")
                continue

        return stats

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

            for idx, page in enumerate(cand_reader.pages):
                mb = page.mediabox
                if mb:
                    w, h = float(mb.width), float(mb.height)
                    exp_w, exp_h = expected_mediaboxes[idx]
                    if abs(w - exp_w) > 1.0 or abs(h - exp_h) > 1.0:
                        raise PdfOptimizationError(
                            f"Page {idx} dimensions altered: expected ({exp_w}, {exp_h}), got ({w}, {h})."
                        )

        except PdfOptimizationError:
            raise
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
