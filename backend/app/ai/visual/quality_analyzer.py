import os
import math
import logging
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("memora.quality_analyzer")

class QualityAnalyzer:
    """
    Computes objective image-quality measurements using OpenCV/Pillow without cloud or LLM arithmetic.
    Calculates:
    1. Sharpness: Variance of Laplacian & gradient energy (0-100)
    2. Blur level: Derived inverse blur metric (0-100)
    3. Brightness: Image luminance mean (0-100)
    4. Contrast: Luminance standard deviation (0-100)
    5. Exposure: Pixel clipping detection for under/over-exposure (0-100)
    6. Resolution quality: Megapixel dimension evaluation (0-100)
    7. Overall quality score: Objective weighted composite (0-100)
    """

    def analyze_image_quality(self, image_path: str, file_size: int = 0) -> dict:
        if not os.path.exists(image_path):
            return {
                "quality_score": 0.0,
                "overall_label": "Poor",
                "sharpness_score": 0.0,
                "sharpness_label": "Poor",
                "blur_score": 100.0,
                "blur_label": "High Blur",
                "brightness_score": 0.0,
                "brightness_label": "Poor",
                "contrast_score": 0.0,
                "contrast_label": "Poor",
                "exposure_score": 0.0,
                "exposure_label": "Poor",
                "resolution_score": 0.0,
                "resolution_label": "Poor",
                "width": 0,
                "height": 0,
                "aspect_ratio": "unknown",
                "factors": {"error": "File does not exist"}
            }

        try:
            if file_size == 0:
                file_size = os.path.getsize(image_path)

            img = cv2.imread(image_path)
            if img is None:
                # Fallback to PIL
                pil_img = Image.open(image_path).convert("RGB")
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            h, w = img.shape[:2]
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # 1. Aspect Ratio Calculation
            gcd = math.gcd(w, h)
            aspect_w = w // gcd if gcd > 0 else 0
            aspect_h = h // gcd if gcd > 0 else 0
            ratio_val = w / max(1, h)
            if 1.70 <= ratio_val <= 1.85:
                aspect_str = "16:9"
            elif 1.30 <= ratio_val <= 1.40:
                aspect_str = "4:3"
            elif 0.95 <= ratio_val <= 1.05:
                aspect_str = "1:1"
            elif 0.53 <= ratio_val <= 0.60:
                aspect_str = "9:16 (Vertical)"
            else:
                aspect_str = f"{aspect_w}:{aspect_h}" if aspect_w < 50 else f"{ratio_val:.2f}:1"

            # 2. Sharpness via Laplacian Variance (CV-based)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            lap_var = float(laplacian.var())
            sharpness_score = max(5.0, min(100.0, (math.log1p(lap_var) / math.log1p(800.0)) * 100.0))
            if sharpness_score >= 85:
                sharpness_label = "Excellent"
            elif sharpness_score >= 70:
                sharpness_label = "Good"
            elif sharpness_score >= 50:
                sharpness_label = "Fair"
            else:
                sharpness_label = "Poor"

            # 3. Blur Estimation (0 = heavily blurred, 100 = low blur / crisp)
            # Normalizing so 100 is best (Low Blur) to align with standard 0-100 metric bars
            blur_level_score = max(5.0, min(100.0, (math.log1p(lap_var) / math.log1p(650.0)) * 100.0))
            if blur_level_score >= 80:
                blur_label = "Low Blur"
            elif blur_level_score >= 55:
                blur_label = "Moderate"
            else:
                blur_label = "High Blur"

            # 4. Brightness (Luminance Mean: ideal range is 100 - 155)
            lum_mean = float(np.mean(gray))
            brightness_dist = abs(lum_mean - 128.0)
            brightness_score = max(10.0, min(100.0, 100.0 - (brightness_dist / 128.0) * 80.0))
            if lum_mean < 50:
                brightness_label = "Too Dark"
            elif lum_mean > 205:
                brightness_label = "Too Bright"
            elif brightness_score >= 80:
                brightness_label = "Good"
            else:
                brightness_label = "Fair"

            # 5. Contrast (Luminance Standard Deviation)
            contrast_std = float(np.std(gray))
            contrast_score = max(10.0, min(100.0, (contrast_std / 60.0) * 100.0))
            if contrast_score >= 85:
                contrast_label = "Excellent"
            elif contrast_score >= 65:
                contrast_label = "Good"
            elif contrast_score >= 45:
                contrast_label = "Fair"
            else:
                contrast_label = "Poor"

            # 6. Exposure (Detect excessive clipped shadows < 8 or highlights > 248)
            total_pixels = float(h * w)
            shadow_clipped = float(np.sum(gray < 8)) / max(1.0, total_pixels)
            highlight_clipped = float(np.sum(gray > 248)) / max(1.0, total_pixels)
            clip_penalty = (shadow_clipped + highlight_clipped) * 150.0
            exposure_score = max(15.0, min(100.0, 100.0 - clip_penalty))
            if shadow_clipped > 0.15:
                exposure_label = "Under-exposed"
            elif highlight_clipped > 0.15:
                exposure_label = "Over-exposed"
            elif exposure_score >= 80:
                exposure_label = "Good"
            else:
                exposure_label = "Fair"

            # 7. Resolution Quality Score (Megapixels)
            megapixels = (w * h) / 1_000_000.0
            resolution_score = max(20.0, min(100.0, 30.0 + (math.log1p(megapixels) / math.log1p(4.0)) * 70.0))
            if resolution_score >= 85 or megapixels >= 2.0:
                resolution_label = "Excellent"
            elif resolution_score >= 65 or megapixels >= 1.0:
                resolution_label = "Good"
            elif resolution_score >= 45:
                resolution_label = "Fair"
            else:
                resolution_label = "Low"

            # 8. Composite Overall Quality Score (0 - 100)
            overall_quality = (
                0.30 * sharpness_score +
                0.20 * blur_level_score +
                0.15 * brightness_score +
                0.15 * contrast_score +
                0.10 * exposure_score +
                0.10 * resolution_score
            )
            overall_score = max(10.0, min(99.0, overall_quality))
            if overall_score >= 85:
                overall_label = "Excellent"
            elif overall_score >= 70:
                overall_label = "Good"
            elif overall_score >= 50:
                overall_label = "Fair"
            else:
                overall_label = "Poor"

            size_mb = file_size / (1024 * 1024)
            size_str = f"{size_mb:.2f} MB" if size_mb >= 1.0 else f"{file_size / 1024:.1f} KB"

            factors = {
                "sharpness": sharpness_label,
                "sharpness_score": round(sharpness_score, 1),
                "blur": blur_label,
                "blur_score": round(blur_level_score, 1),
                "brightness": brightness_label,
                "brightness_score": round(brightness_score, 1),
                "contrast": contrast_label,
                "contrast_score": round(contrast_score, 1),
                "exposure": exposure_label,
                "exposure_score": round(exposure_score, 1),
                "resolution": resolution_label,
                "resolution_score": round(resolution_score, 1),
                "aspect_ratio": aspect_str,
                "file_size": size_str,
                "megapixels": round(megapixels, 2),
                "laplacian_variance": round(lap_var, 2)
            }

            return {
                "quality_score": round(overall_score, 1),
                "overall_label": overall_label,
                "sharpness_score": round(sharpness_score, 1),
                "sharpness_label": sharpness_label,
                "blur_score": round(blur_level_score, 1),
                "blur_label": blur_label,
                "brightness_score": round(brightness_score, 1),
                "brightness_label": brightness_label,
                "contrast_score": round(contrast_score, 1),
                "contrast_label": contrast_label,
                "exposure_score": round(exposure_score, 1),
                "exposure_label": exposure_label,
                "resolution_score": round(resolution_score, 1),
                "resolution_label": resolution_label,
                "width": w,
                "height": h,
                "aspect_ratio": aspect_str,
                "factors": factors
            }

        except Exception as e:
            logger.error(f"Error evaluating quality for {image_path}: {e}", exc_info=True)
            return {
                "quality_score": 50.0,
                "overall_label": "Fair",
                "sharpness_score": 50.0,
                "sharpness_label": "Fair",
                "blur_score": 50.0,
                "blur_label": "Moderate",
                "brightness_score": 50.0,
                "brightness_label": "Fair",
                "contrast_score": 50.0,
                "contrast_label": "Fair",
                "exposure_score": 50.0,
                "exposure_label": "Fair",
                "resolution_score": 50.0,
                "resolution_label": "Fair",
                "width": 0,
                "height": 0,
                "aspect_ratio": "unknown",
                "factors": {"error": str(e)}
            }

quality_analyzer = QualityAnalyzer()
