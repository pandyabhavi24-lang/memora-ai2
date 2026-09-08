import os
import math
import logging
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("memora.quality_analyzer")

class QualityAnalyzer:
    """
    Computes an explainable AI & computer-vision quality assessment for images and video frames.
    Produces:
    - quality_score: 0 to 100
    - sharpness_score: Laplacian variance
    - blur_score: Estimated blur index 0-100
    - explainable factors dictionary
    """

    def analyze_image_quality(self, image_path: str, file_size: int = 0) -> dict:
        if not os.path.exists(image_path):
            return {
                "quality_score": 0.0,
                "sharpness_score": 0.0,
                "blur_score": 100.0,
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

            # 2. Sharpness via Laplacian Variance
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            lap_var = float(laplacian.var())

            # Tenengrad gradient energy for edge crispness
            gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            tenengrad = float(np.mean(gx**2 + gy**2))

            # 3. Blur Estimation (0 = perfectly sharp, 100 = heavily blurred)
            # High lap_var (>500) -> very low blur; low lap_var (<50) -> high blur
            blur_index = max(0.0, min(100.0, 100.0 - (math.log1p(lap_var) / math.log1p(1200.0) * 100.0)))

            # 4. Contrast and Dynamic Range (Standard deviation of luminance)
            contrast_std = float(np.std(gray))
            contrast_score = min(100.0, max(15.0, (contrast_std / 50.0) * 100.0))

            # 5. Resolution Score (Standard HD is 1080p ~2MP, 4K ~8MP)
            megapixels = (w * h) / 1_000_000.0
            resolution_score = min(100.0, max(25.0, 35.0 + (math.log1p(megapixels) / math.log1p(6.0)) * 65.0))

            # 6. Composite Quality Score (0 - 100)
            # Weights: Sharpness (35%), Resolution (30%), Contrast (20%), Low Blur (15%)
            sharpness_component = min(100.0, max(10.0, (math.log1p(lap_var) / math.log1p(500.0)) * 100.0))
            composite_quality = (
                0.35 * sharpness_component +
                0.30 * resolution_score +
                0.20 * contrast_score +
                0.15 * (100.0 - blur_index)
            )
            quality_score = max(5.0, min(99.0, composite_quality))

            # Textual Quality Factors
            sharpness_label = "High" if lap_var > 300 else ("Medium" if lap_var > 80 else "Low")
            blur_label = "Low" if blur_index < 30 else ("Moderate" if blur_index < 65 else "High")
            res_label = f"{w} × {h} ({megapixels:.1f} MP)"
            
            size_mb = file_size / (1024 * 1024)
            size_str = f"{size_mb:.2f} MB" if size_mb >= 1.0 else f"{file_size / 1024:.1f} KB"

            factors = {
                "sharpness": sharpness_label,
                "blur": blur_label,
                "resolution": res_label,
                "aspect_ratio": aspect_str,
                "file_size": size_str,
                "megapixels": round(megapixels, 2),
                "contrast": "Good" if contrast_std > 40 else "Low",
                "laplacian_variance": round(lap_var, 2)
            }

            return {
                "quality_score": round(quality_score, 1),
                "sharpness_score": round(lap_var, 2),
                "blur_score": round(blur_index, 1),
                "width": w,
                "height": h,
                "aspect_ratio": aspect_str,
                "factors": factors
            }

        except Exception as e:
            logger.error(f"Error evaluating quality for {image_path}: {e}", exc_info=True)
            return {
                "quality_score": 50.0,
                "sharpness_score": 50.0,
                "blur_score": 50.0,
                "width": 0,
                "height": 0,
                "aspect_ratio": "unknown",
                "factors": {"error": str(e)}
            }

quality_analyzer = QualityAnalyzer()
