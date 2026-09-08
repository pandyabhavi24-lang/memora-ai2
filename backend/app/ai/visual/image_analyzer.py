import os
import logging
from .quality_analyzer import quality_analyzer
from .object_detector import visual_content_detector
from .visual_embeddings import visual_embedding_service

logger = logging.getLogger("memora.image_analyzer")

class ImageAnalyzer:
    """
    Unified Image Analysis Pipeline for Module 3:
    1. Visual Content & Object Detection (person, nature, devices, document, etc.)
    2. Scene Understanding (indoor, outdoor, event, workshop, office)
    3. Image Classification & Screenshot Detection
    4. Comprehensive Image Quality Scoring & Sharpness Metrics
    5. 512-dimensional Visual Vector Embedding
    """

    def analyze_image(self, file_path: str, filename: str = "", file_size: int = 0) -> dict:
        if not os.path.exists(file_path):
            return {
                "status": "failed",
                "error": f"File not found: {file_path}",
                "quality": {},
                "content": {},
                "embedding": None
            }

        try:
            # 1. Quality & Resolution Analysis
            quality_data = quality_analyzer.analyze_image_quality(file_path, file_size=file_size)
            if quality_data.get("factors", {}).get("error") or quality_data.get("width", 0) == 0:
                return {
                    "status": "failed",
                    "error": quality_data.get("factors", {}).get("error", "Could not decode image"),
                    "media_type": "image",
                    "quality_score": 0.0,
                    "sharpness_score": 0.0,
                    "blur_score": 100.0,
                    "quality_factors": quality_data.get("factors", {}),
                    "visual_category": "other",
                    "is_screenshot": False,
                    "screenshot_confidence": 0.0,
                    "detected_objects": [],
                    "detected_scenes": [],
                    "dominant_colors": [],
                    "embedding": None
                }

            # 2. Content, Objects, Scenes, Screenshot Classification
            content_data = visual_content_detector.analyze_visual_content(file_path, filename=filename)

            # 3. Dense Visual Vector Embedding
            embedding_vec = visual_embedding_service.embed_image(file_path)

            return {
                "status": "completed",
                "media_type": "image",
                "width": quality_data["width"],
                "height": quality_data["height"],
                "aspect_ratio": quality_data["aspect_ratio"],
                "quality_score": quality_data["quality_score"],
                "sharpness_score": quality_data["sharpness_score"],
                "blur_score": quality_data["blur_score"],
                "quality_factors": quality_data["factors"],
                "visual_category": content_data["visual_category"],
                "is_screenshot": content_data["is_screenshot"],
                "screenshot_confidence": content_data["screenshot_confidence"],
                "detected_objects": content_data["detected_objects"],
                "detected_scenes": content_data["detected_scenes"],
                "dominant_colors": content_data["dominant_colors"],
                "embedding": embedding_vec
            }

        except Exception as e:
            logger.error(f"Image analysis error for {file_path}: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "media_type": "image",
                "quality_score": 0.0,
                "sharpness_score": 0.0,
                "blur_score": 100.0,
                "quality_factors": {"error": str(e)},
                "visual_category": "other",
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "detected_objects": [],
                "detected_scenes": [],
                "dominant_colors": [],
                "embedding": None
            }

image_analyzer = ImageAnalyzer()
