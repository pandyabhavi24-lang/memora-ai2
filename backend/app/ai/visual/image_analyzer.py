import os
import logging
from .quality_analyzer import quality_analyzer
from .local_vision import local_vision_analyzer
from .visual_embeddings import visual_embedding_service

logger = logging.getLogger("memora.image_analyzer")

class ImageAnalyzer:
    """
    Unified Image Analysis Pipeline for Module 3:
    1. Visual Content Classification: Strictly separates PICTORIAL visual images from TEXT-HEAVY document/screenshot captures.
    2. Local Vision Intelligence (Qwen2.5-VL 3B via Ollama): Extracts rich structured visual metadata.
    3. Dense Semantic Text Representation: Builds rich searchable representation for Sentence Transformers embedding.
    4. Image Quality & Sharpness Metrics: Evaluates Laplacian variance, blur, resolution, and aspect ratio.
    5. Strict Index Isolation: Text-heavy images produce NO visual vector (embedding=None) and never enter visual FAISS.
    """

    def analyze_image(self, file_path: str, filename: str = "", file_size: int = 0) -> dict:
        if not os.path.exists(file_path):
            return {
                "status": "failed",
                "error": f"File not found: {file_path}",
                "content_type": "text_heavy",
                "classification_confidence": 1.0,
                "classification_reason": "File does not exist on disk",
                "quality": {},
                "content": {},
                "embedding": None
            }

        try:
            # 1. Quality & Resolution Analysis (Local)
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
                    "content_type": "text_heavy",
                    "classification_confidence": 1.0,
                    "classification_reason": "Corrupted or unreadable image file",
                    "visual_category": "other",
                    "is_screenshot": False,
                    "screenshot_confidence": 0.0,
                    "description": "",
                    "detected_objects": [],
                    "object_counts": [],
                    "detected_scenes": [],
                    "dominant_colors": [],
                    "environment": "unknown",
                    "activities": [],
                    "visual_attributes": [],
                    "relationships": [],
                    "tags": [],
                    "search_terms": [],
                    "searchable_text": "",
                    "embedding": None
                }

            # 2. Local Vision Intelligence & Content Classification (Pictorial vs Text-Heavy)
            vision_data = local_vision_analyzer.analyze_image(file_path, filename=filename)
            content_type = vision_data.get("content_type", "pictorial")
            class_conf = vision_data.get("classification_confidence", 1.0)
            class_reason = vision_data.get("classification_reason", "")

            # 3. Dense Text & Visual Vector: Generated ONLY for genuine pictorial images
            embedding_vec = None
            if content_type == "pictorial" and vision_data.get("status") != "failed":
                searchable_text = vision_data.get("searchable_text", "")
                if searchable_text:
                    embedding_vec = local_vision_analyzer.embed_text(searchable_text)
                else:
                    embedding_vec = visual_embedding_service.embed_image(file_path)
            else:
                searchable_text = ""
                logger.info(f"[LOCAL VISION] Skipping vector generation for text-heavy or failed image: {filename}")

            return {
                "status": vision_data.get("status", "completed"),
                "content_type": content_type,
                "classification_confidence": class_conf,
                "classification_reason": class_reason,
                "media_type": "image",
                "width": quality_data["width"],
                "height": quality_data["height"],
                "aspect_ratio": quality_data["aspect_ratio"],
                "quality_score": quality_data["quality_score"],
                "sharpness_score": quality_data["sharpness_score"],
                "blur_score": quality_data["blur_score"],
                "quality_factors": quality_data["factors"],
                "visual_category": vision_data.get("visual_category", "photograph"),
                "is_screenshot": vision_data.get("is_screenshot", False),
                "screenshot_confidence": vision_data.get("screenshot_confidence", 0.0),
                "description": vision_data.get("description", ""),
                "detected_objects": vision_data.get("objects", []),
                "object_counts": vision_data.get("object_counts", []),
                "detected_scenes": [vision_data.get("scene")] if isinstance(vision_data.get("scene"), str) and vision_data.get("scene") else vision_data.get("detected_scenes", []),
                "scene": vision_data.get("scene", "general"),
                "environment": vision_data.get("environment", "general"),
                "activities": vision_data.get("activities", []),
                "visual_attributes": vision_data.get("visual_attributes", []),
                "relationships": vision_data.get("relationships", []),
                "tags": vision_data.get("tags", []),
                "search_terms": vision_data.get("search_terms", []),
                "dominant_colors": vision_data.get("colors", []),
                "searchable_text": searchable_text,
                "embedding": embedding_vec,
                "error": vision_data.get("error")
            }

        except Exception as e:
            logger.error(f"[LOCAL VISION] Image analysis error for {file_path}: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "media_type": "image",
                "quality_score": 0.0,
                "sharpness_score": 0.0,
                "blur_score": 100.0,
                "quality_factors": {"error": str(e)},
                "content_type": "text_heavy",
                "classification_confidence": 0.9,
                "classification_reason": f"Analysis failed with exception: {str(e)}",
                "visual_category": "other",
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "description": "",
                "detected_objects": [],
                "object_counts": [],
                "detected_scenes": [],
                "dominant_colors": [],
                "environment": "unknown",
                "activities": [],
                "visual_attributes": [],
                "relationships": [],
                "tags": [],
                "search_terms": [],
                "searchable_text": "",
                "embedding": None
            }

image_analyzer = ImageAnalyzer()
