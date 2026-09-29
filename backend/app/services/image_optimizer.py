import os
import logging
from dataclasses import dataclass
from typing import Optional
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger("memora.image_optimizer")


class ImageOptimizationError(Exception):
    """Raised when image optimization fails or encountered an unrecoverable error."""
    pass


@dataclass
class ImageOptimizationResult:
    """Metadata describing the generated image candidate."""
    source_path: str
    candidate_path: str
    original_size: int
    candidate_size: int
    source_format: str
    candidate_format: str
    width: int
    height: int
    strategy_used: str
    is_lossless: bool
    quality: Optional[int]
    is_format_conversion: bool
    candidate_width: Optional[int] = None
    candidate_height: Optional[int] = None


class ImageOptimizer:
    """
    Focused image optimization engine for Memora AI Storage Analysis & Optimization V1.
    
    Generates and validates candidate image files for:
    - JPEG (Lossless Huffman optimization or user-selected lossy quality)
    - PNG (Lossless multi-filter and max Deflate compression)
    - BMP (Lossless conversion to PNG format)
    
    Safety Rules:
    - Never overwrites or deletes the source file.
    - Preserves dimensions and color profiles unless proportional max_dimension is specified.
    - Validates candidate integrity by fully decoding the resulting file.
    - Deletes incomplete or failed candidate files on error.
    """

    SUPPORTED_INPUT_FORMATS = {"JPEG", "JPG", "PNG", "BMP"}

    def optimize_image(
        self,
        source_path: str,
        candidate_path: str,
        mode: str = "lossless",
        lossy_quality: int = 82,
        bmp_target_format: str = "png",
        max_dimension: Optional[int] = None
    ) -> ImageOptimizationResult:
        """
        Generates and validates an optimized candidate image from source_path.

        Args:
            source_path: Absolute path to the existing source image.
            candidate_path: Destination path where candidate image will be written.
            mode: 'lossless' (default) or 'lossy'.
            lossy_quality: Integer quality (65-90, default 82) used when mode='lossy'.
            bmp_target_format: Target format for BMP conversion (default 'png').
            max_dimension: Optional maximum dimension (width or height) in pixels.
                           If larger, the image is scaled down proportionally with LANCZOS.

        Returns:
            ImageOptimizationResult containing candidate metadata and sizes.

        Raises:
            ImageOptimizationError if source is invalid, format is unsupported,
            or candidate validation fails.
        """
        # 1. Source existence & path safety checks
        if not source_path or not isinstance(source_path, str):
            raise ImageOptimizationError("Source path must be a non-empty string.")

        if not os.path.exists(source_path):
            raise ImageOptimizationError(f"Source file does not exist: '{source_path}'")

        if not os.path.isfile(source_path):
            raise ImageOptimizationError(f"Source path is not a file: '{source_path}'")

        if not candidate_path or not isinstance(candidate_path, str):
            raise ImageOptimizationError("Candidate path must be a non-empty string.")

        source_abs = os.path.abspath(source_path)
        candidate_abs = os.path.abspath(candidate_path)

        if source_abs == candidate_abs:
            raise ImageOptimizationError("Candidate path must not be identical to source path.")

        # Ensure candidate directory exists
        candidate_dir = os.path.dirname(candidate_abs)
        if candidate_dir:
            os.makedirs(candidate_dir, exist_ok=True)

        original_size = os.path.getsize(source_abs)

        try:
            # 2. Open source image with Pillow and validate header
            with Image.open(source_abs) as img:
                src_format = (img.format or "").upper()
                if src_format not in self.SUPPORTED_INPUT_FORMATS:
                    raise ImageOptimizationError(
                        f"Unsupported image format: '{src_format}'. Supported formats: JPEG, PNG, BMP."
                    )

                width, height = img.size
                info = dict(img.info)

                # Calculate target dimensions with optional max_dimension (proportional Lanczos downsampling)
                target_w, target_h = width, height
                is_resized = False
                if max_dimension is not None and max_dimension > 0:
                    max_side = max(width, height)
                    if max_side > max_dimension:
                        scale = max_dimension / float(max_side)
                        target_w = max(1, round(width * scale))
                        target_h = max(1, round(height * scale))
                        is_resized = True

                work_img = img
                if is_resized:
                    resample_filter = getattr(getattr(Image, 'Resampling', None), 'LANCZOS', getattr(Image, 'LANCZOS', 1))
                    if work_img.mode == "P" and "transparency" in info:
                        work_img = work_img.convert("RGBA")
                    work_img = work_img.resize((target_w, target_h), resample=resample_filter)

                # 3. Dispatch to format-specific optimizer
                if src_format in ("JPEG", "JPG"):
                    result_meta = self._optimize_jpeg(
                        img=work_img,
                        candidate_path=candidate_abs,
                        mode=mode,
                        lossy_quality=lossy_quality,
                        info=info,
                        is_resized=is_resized
                    )
                elif src_format == "PNG":
                    result_meta = self._optimize_png(
                        img=work_img,
                        candidate_path=candidate_abs,
                        info=info,
                        is_resized=is_resized
                    )
                elif src_format == "BMP":
                    result_meta = self._convert_bmp(
                        img=work_img,
                        candidate_path=candidate_abs,
                        target_format=bmp_target_format,
                        info=info,
                        is_resized=is_resized
                    )
                else:
                    raise ImageOptimizationError(f"Unhandled format: {src_format}")

            # 4. Candidate Validation
            self._validate_candidate(
                candidate_path=candidate_abs,
                expected_format=result_meta["candidate_format"],
                expected_size=(target_w, target_h)
            )

            candidate_size = os.path.getsize(candidate_abs)

            return ImageOptimizationResult(
                source_path=source_abs,
                candidate_path=candidate_abs,
                original_size=original_size,
                candidate_size=candidate_size,
                source_format=src_format,
                candidate_format=result_meta["candidate_format"],
                width=width,
                height=height,
                strategy_used=result_meta["strategy_used"],
                is_lossless=result_meta["is_lossless"],
                quality=result_meta.get("quality"),
                is_format_conversion=result_meta["is_format_conversion"],
                candidate_width=target_w,
                candidate_height=target_h
            )

        except (ImageOptimizationError, UnidentifiedImageError) as err:
            self._cleanup_candidate(candidate_abs)
            raise ImageOptimizationError(str(err)) from err
        except Exception as err:
            self._cleanup_candidate(candidate_abs)
            logger.error(f"Unexpected error optimizing image '{source_abs}': {err}", exc_info=True)
            raise ImageOptimizationError(f"Image optimization failed: {str(err)}") from err

    def _optimize_jpeg(
        self,
        img: Image.Image,
        candidate_path: str,
        mode: str,
        lossy_quality: int,
        info: dict,
        is_resized: bool = False
    ) -> dict:
        """Executes lossless or lossy JPEG optimization."""
        # JPEG cannot safely save RGBA/transparency without dropping alpha
        if img.mode in ("RGBA", "LA", "P"):
            raise ImageOptimizationError(
                f"Cannot save image with mode '{img.mode}' directly as JPEG without losing alpha/palette data."
            )

        save_kwargs = {
            "format": "JPEG",
            "optimize": True,
        }

        # Preserve ICC color profile to prevent color shift across devices
        if "icc_profile" in info:
            save_kwargs["icc_profile"] = info["icc_profile"]

        # Safe progressive scan if already progressive
        if info.get("progressive", False):
            save_kwargs["progressive"] = True

        if mode == "lossy":
            # Bound lossy quality to safe range (65-90, default 82)
            bounded_q = max(65, min(90, int(lossy_quality or 82)))
            save_kwargs["quality"] = bounded_q
            save_kwargs["subsampling"] = 1  # 4:2:0 chroma subsampling for photographic compression
            is_lossless = False
            quality_out = bounded_q
            strategy = f"jpeg_lossy_q{bounded_q}"
            if is_resized:
                strategy += f"_max_dim_{img.size[0]}x{img.size[1]}"
        else:
            if is_resized:
                # Downsampling occurred: use high-quality encoding (95) with Huffman optimization
                save_kwargs["quality"] = 95
                is_lossless = False
                quality_out = 95
                strategy = f"jpeg_dimension_reduction_{img.size[0]}x{img.size[1]}"
            else:
                # Pure Lossless mode: optimize Huffman tables without re-quantizing if possible
                if hasattr(img, "quantization") and img.quantization:
                    save_kwargs["quality"] = "keep"
                else:
                    save_kwargs["quality"] = 95
                is_lossless = True
                quality_out = None
                strategy = "jpeg_lossless_huffman_optimization"

        # Do not include EXIF/XMP by default (strips redundant camera/GPS metadata)
        img.save(candidate_path, **save_kwargs)

        return {
            "candidate_format": "JPEG",
            "strategy_used": strategy,
            "is_lossless": is_lossless,
            "quality": quality_out,
            "is_format_conversion": False
        }

    def _optimize_png(
        self,
        img: Image.Image,
        candidate_path: str,
        info: dict,
        is_resized: bool = False
    ) -> dict:
        """Executes lossless PNG optimization using max compression & adaptive filtering."""
        save_kwargs = {
            "format": "PNG",
            "optimize": True,
            "compress_level": 9
        }

        # Preserve ICC profile
        if "icc_profile" in info:
            save_kwargs["icc_profile"] = info["icc_profile"]

        # Preserve transparency metadata if palette-based with transparency
        if "transparency" in info and img.mode != "RGBA":
            save_kwargs["transparency"] = info["transparency"]

        img.save(candidate_path, **save_kwargs)

        strategy = f"png_deflate_dimension_reduction_{img.size[0]}x{img.size[1]}" if is_resized else "png_lossless_deflate_optimization"

        return {
            "candidate_format": "PNG",
            "strategy_used": strategy,
            "is_lossless": not is_resized,
            "quality": None,
            "is_format_conversion": False
        }

    def _convert_bmp(
        self,
        img: Image.Image,
        candidate_path: str,
        target_format: str,
        info: dict,
        is_resized: bool = False
    ) -> dict:
        """Converts uncompressed BMP to lossless PNG format."""
        target_fmt_upper = (target_format or "png").upper()
        if target_fmt_upper != "PNG":
            raise ImageOptimizationError(f"Unsupported BMP conversion target format: '{target_format}'. Only PNG is supported in V1.")

        save_kwargs = {
            "format": "PNG",
            "optimize": True,
            "compress_level": 9
        }

        # Preserve palette transparency if present
        if "transparency" in info and img.mode != "RGBA":
            save_kwargs["transparency"] = info["transparency"]

        img.save(candidate_path, **save_kwargs)

        strategy = f"bmp_to_png_dimension_reduction_{img.size[0]}x{img.size[1]}" if is_resized else "bmp_to_png_conversion"

        return {
            "candidate_format": "PNG",
            "strategy_used": strategy,
            "is_lossless": not is_resized,
            "quality": None,
            "is_format_conversion": True
        }

    def _validate_candidate(
        self,
        candidate_path: str,
        expected_format: str,
        expected_size: tuple
    ):
        """
        Validates the newly created candidate file.
        Confirms file exists, has size > 0, matches dimensions, matches expected format,
        and decodes successfully without corruption.
        """
        if not os.path.exists(candidate_path):
            raise ImageOptimizationError("Candidate file was not created on disk.")

        if os.path.getsize(candidate_path) == 0:
            raise ImageOptimizationError("Candidate file was created with 0 bytes.")

        try:
            with Image.open(candidate_path) as cand_img:
                cand_format = (cand_img.format or "").upper()
                # Normalize JPG/JPEG
                if expected_format in ("JPEG", "JPG"):
                    if cand_format not in ("JPEG", "JPG"):
                        raise ImageOptimizationError(
                            f"Candidate format mismatch: expected JPEG, got '{cand_format}'."
                        )
                elif cand_format != expected_format:
                    raise ImageOptimizationError(
                        f"Candidate format mismatch: expected '{expected_format}', got '{cand_format}'."
                    )

                if cand_img.size != expected_size:
                    raise ImageOptimizationError(
                        f"Candidate dimensions mismatch: expected {expected_size}, got {cand_img.size}."
                    )

                # Force full raster pixel decoding to ensure no truncated stream
                cand_img.load()

        except Exception as val_err:
            raise ImageOptimizationError(f"Candidate validation failed: {val_err}") from val_err

    def _cleanup_candidate(self, candidate_path: str):
        """Safely removes candidate file if generation or validation failed."""
        if candidate_path and os.path.exists(candidate_path):
            try:
                os.remove(candidate_path)
            except Exception as e:
                logger.debug(f"Failed to remove temporary candidate '{candidate_path}': {e}")


image_optimizer = ImageOptimizer()
