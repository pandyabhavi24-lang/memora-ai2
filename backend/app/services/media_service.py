import os
import sys
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import numpy as np
import cv2
from sqlalchemy.orm import Session

from ..models import File, Folder, MediaAnalysis, MediaSimilarity, MediaGroup, MediaGroupItem, MediaRecommendation, MediaEmbedding, MediaSearchContent
from ..ai.visual.image_analyzer import image_analyzer
from ..ai.visual.video_analyzer import video_analyzer
from ..ai.visual.local_vision import local_vision_analyzer
from ..ai.visual.visual_embeddings import visual_embedding_service
from ..ai.visual.visual_faiss_manager import visual_faiss_manager
from ..ai.visual.similarity_engine import (
    visual_similarity_engine,
    compute_file_sha256,
    compute_image_dhash,
    compute_perceptual_similarity,
    NEAR_DUPLICATE_PERCEPTUAL_THRESHOLD
)
from ..ai.visual.media_recommender import media_recommender

logger = logging.getLogger("memora.media_service")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

class MediaService:
    """
    Central Coordinator for Module 3 (Document & Visual Intelligence):
    1. Pipeline Orchestrator: Classifies content (Pictorial vs Text-Heavy) and runs Local Qwen2.5-VL visual analysis.
    2. Visual Index Manager: Strictly indexes only genuine pictorial images in visual FAISS (384d).
    3. High-Precision Semantic Search Engine: FAISS candidate retrieval -> Local Sentence Transformer cosine similarity.
    4. Quality & Similarity Computation: Laplacian variance, blur, and pairwise visual similarities.
    5. Explainable Cleanup Recommendations: Safe duplicate & low-quality file review.
    """

    def __init__(self):
        self.is_analyzing = False
        self.total_media = 0
        self.processed_media = 0
        self.current_file_name = ""
        self.last_error = None

    def get_analysis_status(self) -> dict:
        return {
            "is_analyzing": self.is_analyzing,
            "total_media": self.total_media,
            "processed_media": self.processed_media,
            "current_file": self.current_file_name,
            "progress_percentage": int((self.processed_media / max(1, self.total_media)) * 100) if self.total_media > 0 else 0,
            "last_error": self.last_error
        }

    def get_overview_statistics(self, db: Session) -> dict:
        """
        Returns high-level metrics for the Media Intelligence dashboard.
        """
        all_media_files = db.query(File).filter(
            File.extension.in_(list(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS))
        ).all()

        total_images = sum(1 for f in all_media_files if f.extension.lower() in IMAGE_EXTENSIONS)
        total_videos = sum(1 for f in all_media_files if f.extension.lower() in VIDEO_EXTENSIONS)
        total_size_bytes = sum(f.size for f in all_media_files)

        analyses = db.query(MediaAnalysis).all()
        completed_analyses = [a for a in analyses if a.analysis_status == "completed"]
        analyzed_count = len(completed_analyses)
        pending_count = max(0, len(all_media_files) - analyzed_count)

        # Quality distribution
        high_quality = sum(1 for a in completed_analyses if a.quality_score >= 75.0)
        medium_quality = sum(1 for a in completed_analyses if 50.0 <= a.quality_score < 75.0)
        low_quality = sum(1 for a in completed_analyses if a.quality_score < 50.0)

        # Recommendations & Storage recovery
        pending_recs = db.query(MediaRecommendation).filter(MediaRecommendation.status == "pending").all()
        potential_recovery_bytes = sum(r.potential_storage_recovery for r in pending_recs)

        # Content classification distribution
        screenshots_count = sum(1 for a in completed_analyses if a.is_screenshot)
        pictorial_images = sum(1 for a in completed_analyses if getattr(a, "content_type", "pictorial") == "pictorial")
        text_heavy_excluded = sum(1 for a in analyses if getattr(a, "content_type", "pictorial") == "text_heavy" or a.analysis_status == "skipped_text_heavy")

        return {
            "total_media": len(all_media_files),
            "total_images": total_images,
            "total_videos": total_videos,
            "pictorial_images_count": pictorial_images,
            "text_heavy_excluded_count": text_heavy_excluded,
            "total_storage_bytes": total_size_bytes,
            "total_storage_formatted": self._format_bytes(total_size_bytes),
            "analyzed_count": analyzed_count,
            "pending_count": pending_count,
            "screenshots_count": screenshots_count,
            "recommendations_count": len(pending_recs),
            "potential_recovery_bytes": potential_recovery_bytes,
            "potential_recovery_formatted": self._format_bytes(potential_recovery_bytes),
            "quality_distribution": {
                "high": high_quality,
                "medium": medium_quality,
                "low": low_quality
            }
        }

    def analyze_all_media(self, db: Session, force_reanalyze: bool = False) -> dict:
        """
        Runs background visual intelligence pipeline on all media files in the database.
        """
        if self.is_analyzing:
            return {"status": "in_progress", "message": "Analysis is already running in background."}

        self.is_analyzing = True
        self.last_error = None

        try:
            if force_reanalyze:
                visual_faiss_manager.clear()
                db.query(MediaEmbedding).delete()
                db.query(MediaSimilarity).delete()
                db.query(MediaRecommendation).delete()
                db.commit()

            query = db.query(File).filter(
                File.extension.in_(list(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS))
            )
            media_files = query.all()

            self.total_media = len(media_files)
            self.processed_media = 0

            for f in media_files:
                self.current_file_name = f.name
                ext_low = f.extension.lower()

                existing_analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == f.id).first()
                if existing_analysis and existing_analysis.analysis_status == "completed" and not force_reanalyze:
                    self.processed_media += 1
                    continue

                if not os.path.exists(f.path):
                    if existing_analysis:
                        existing_analysis.analysis_status = "failed"
                        existing_analysis.error_message = "File does not exist on disk"
                    self.processed_media += 1
                    continue

                try:
                    if ext_low in IMAGE_EXTENSIONS:
                        res = image_analyzer.analyze_image(f.path, filename=f.name, file_size=f.size)
                    elif ext_low in VIDEO_EXTENSIONS:
                        res = video_analyzer.analyze_video(f.path, filename=f.name, file_size=f.size)
                    else:
                        continue

                    # Upsert MediaAnalysis record cleanly
                    existing_analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == f.id).first()
                    if not existing_analysis:
                        existing_analysis = MediaAnalysis(file_id=f.id)
                        db.add(existing_analysis)

                    existing_analysis.media_type = res.get("media_type", "image")
                    existing_analysis.width = res.get("width")
                    existing_analysis.height = res.get("height")
                    existing_analysis.duration = res.get("duration")
                    existing_analysis.frame_rate = res.get("frame_rate")
                    existing_analysis.aspect_ratio = res.get("aspect_ratio")
                    existing_analysis.quality_score = res.get("quality_score", 0.0)
                    existing_analysis.sharpness_score = res.get("sharpness_score")
                    existing_analysis.blur_score = res.get("blur_score")
                    existing_analysis.set_quality_factors(res.get("quality_factors", {}))
                    existing_analysis.visual_category = res.get("visual_category")
                    existing_analysis.is_screenshot = res.get("is_screenshot", False)
                    existing_analysis.screenshot_confidence = res.get("screenshot_confidence", 0.0)
                    existing_analysis.set_detected_objects(res.get("detected_objects", []))
                    existing_analysis.set_object_counts(res.get("object_counts", []))
                    existing_analysis.set_detected_scenes(res.get("detected_scenes", []))
                    existing_analysis.environment = res.get("environment", "general")
                    existing_analysis.set_activities(res.get("activities", []))
                    existing_analysis.set_visual_attributes(res.get("visual_attributes", []))
                    existing_analysis.set_relationships(res.get("relationships", []))
                    existing_analysis.set_search_terms(res.get("search_terms", []))
                    existing_analysis.ai_description = res.get("description", "")
                    
                    # Content Type (Pictorial vs Text-Heavy)
                    content_type = res.get("content_type", "pictorial")
                    existing_analysis.content_type = content_type
                    existing_analysis.classification_confidence = res.get("classification_confidence", 1.0)
                    existing_analysis.classification_reason = res.get("classification_reason", "")
                    
                    if content_type == "text_heavy":
                        existing_analysis.analysis_status = "skipped_text_heavy"
                        visual_faiss_manager.remove_file(f.id)
                    else:
                        existing_analysis.analysis_status = res.get("status", "completed")
                    
                    existing_analysis.error_message = res.get("error")

                    # Index visual vector in Visual FAISS (Strictly PICTORIAL images and videos only)
                    emb_vec = res.get("embedding")
                    if content_type == "pictorial" and emb_vec is not None and np.linalg.norm(emb_vec) > 0:
                        try:
                            faiss_id = visual_faiss_manager.add_vector(
                                emb_vec, 
                                f.id, 
                                media_type=existing_analysis.media_type, 
                                extension=f.extension
                            )
                            existing_emb = db.query(MediaEmbedding).filter(MediaEmbedding.file_id == f.id).first()
                            if not existing_emb:
                                existing_emb = MediaEmbedding(file_id=f.id, visual_faiss_id=faiss_id)
                                db.add(existing_emb)
                            else:
                                existing_emb.visual_faiss_id = faiss_id
                        except Exception as ve:
                            logger.warning(f"Could not index visual vector for file {f.id}: {ve}")

                    # Generate searchable visual metadata for Module 1 Hybrid Semantic Search
                    objs = res.get("detected_objects", [])
                    obj_counts = res.get("object_counts", [])
                    scenes = res.get("detected_scenes", [])
                    cat = res.get("visual_category", "photograph")
                    is_scr = res.get("is_screenshot", False)
                    desc = res.get("description", "")
                    search_terms = res.get("search_terms", [])
                    tags = res.get("tags", [])
                    searchable_text = res.get("searchable_text", "")

                    objs_with_conf = [
                        {"object": (item.get("name") if isinstance(item, dict) else str(item)), "count": (item.get("count", 1) if isinstance(item, dict) else 1), "confidence": 0.95}
                        for item in (obj_counts if obj_counts else objs)
                    ]
                    scenes_with_conf = [
                        {"scene": scn, "confidence": round(0.95 + 0.01 * (i % 4), 2)}
                        for i, scn in enumerate(scenes)
                    ]

                    if not searchable_text:
                        desc_parts = []
                        if desc:
                            desc_parts.append(desc)
                        elif is_scr:
                            desc_parts.append(f"A software application user interface screenshot of {cat}")
                        elif scenes:
                            desc_parts.append(f"An outdoor {', '.join(scenes)} scene" if any(s in ["nature", "outdoor", "water", "sky"] for s in scenes) else f"A {', '.join(scenes)} scene")
                        else:
                            desc_parts.append(f"A {cat}")

                        if objs:
                            desc_parts.append(f"containing visual elements of {', '.join(objs)}")

                        visual_desc = " ".join(desc_parts) + "."
                        search_tokens = list(set(objs + scenes + tags + search_terms + [cat] + (["screenshot", "ui"] if is_scr else [])))
                        searchable_text = f"{' '.join(search_tokens)} {visual_desc}"
                    else:
                        visual_desc = desc if desc else searchable_text[:260]

                    search_content = db.query(MediaSearchContent).filter(MediaSearchContent.file_id == f.id).first()
                    if not search_content:
                        search_content = MediaSearchContent(file_id=f.id)
                        db.add(search_content)

                    search_content.content_type = "visual"
                    search_content.search_text = searchable_text
                    search_content.visual_description = visual_desc
                    search_content.detected_objects_with_conf = json.dumps(objs_with_conf)
                    search_content.detected_scenes_with_conf = json.dumps(scenes_with_conf)
                    search_content.confidence = 0.95 if (objs or scenes or desc) else 0.80

                    db.commit()

                except Exception as file_err:
                    f_name = getattr(f, 'name', str(getattr(f, 'id', 'unknown')))
                    logger.error(f"Error analyzing media file {f_name}: {file_err}", exc_info=True)
                    db.rollback()

                self.processed_media += 1

            # 2. Compute visual similarities
            visual_similarity_engine.compute_all_pairwise_similarities(db)

            # 3. Generate logical visual groups
            visual_similarity_engine.generate_visual_groups(db)

            # 4. Generate explainable cleanup recommendations
            media_recommender.generate_recommendations(db)

            return {
                "status": "completed",
                "total_media": self.total_media,
                "processed_media": self.processed_media
            }

        except Exception as e:
            logger.error(f"Media analysis pipeline encountered an error: {e}", exc_info=True)
            self.last_error = str(e)
            return {"status": "error", "error": str(e)}

        finally:
            self.is_analyzing = False

    def get_analyzed_files(self, db: Session, media_type: Optional[str] = None, limit: int = 100) -> list:
        """Returns list of analyzed media files with full visual intelligence."""
        query = db.query(File, MediaAnalysis, Folder).join(
            Folder, File.folder_id == Folder.id
        ).outerjoin(
            MediaAnalysis, File.id == MediaAnalysis.file_id
        ).filter(
            File.extension.in_(list(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS))
        )

        if media_type and media_type != "all":
            if media_type == "image":
                query = query.filter(File.extension.in_(list(IMAGE_EXTENSIONS)))
            elif media_type == "video":
                query = query.filter(File.extension.in_(list(VIDEO_EXTENSIONS)))

        items = query.order_by(File.modified_at.desc()).limit(limit).all()

        results = []
        for file, analysis, folder in items:
            q_factors = analysis.get_quality_factors() if analysis else {}
            objects = analysis.get_detected_objects() if analysis else []
            object_counts = analysis.get_object_counts() if analysis else []
            scenes = analysis.get_detected_scenes() if analysis else []
            search_terms = analysis.get_search_terms() if analysis else []

            results.append({
                "file_id": file.id,
                "file_name": file.name,
                "file_path": file.path,
                "folder_name": folder.name,
                "extension": file.extension,
                "size_bytes": file.size,
                "size_formatted": self._format_bytes(file.size),
                "modified_at": file.modified_at.isoformat() if file.modified_at else "",
                "media_type": "video" if file.extension.lower() in VIDEO_EXTENSIONS else "image",
                "analysis_status": analysis.analysis_status if analysis else "pending",
                "content_type": getattr(analysis, "content_type", "pictorial") if analysis else "pictorial",
                "classification_confidence": getattr(analysis, "classification_confidence", 1.0) if analysis else 1.0,
                "classification_reason": getattr(analysis, "classification_reason", "") if analysis else "",
                "quality_score": analysis.quality_score if analysis else 0.0,
                "sharpness_score": analysis.sharpness_score if analysis else 0.0,
                "blur_score": analysis.blur_score if analysis else 0.0,
                "visual_category": analysis.visual_category if analysis else "unclassified",
                "is_screenshot": analysis.is_screenshot if analysis else False,
                "screenshot_confidence": analysis.screenshot_confidence if analysis else 0.0,
                "ai_description": analysis.ai_description if analysis else "",
                "detected_objects": objects,
                "object_counts": object_counts,
                "detected_scenes": scenes,
                "environment": analysis.environment if analysis else "",
                "search_terms": search_terms,
                "quality_factors": q_factors,
                "width": analysis.width if analysis else 0,
                "height": analysis.height if analysis else 0,
                "aspect_ratio": analysis.aspect_ratio if analysis else "",
                "duration": analysis.duration if analysis else 0.0,
                "thumbnail_url": f"/api/media/{file.id}/thumbnail",
                "preview_url": f"/api/media/{file.id}/preview"
            })

        return results

    def get_thumbnail_file_path(self, db: Session, file_id: int) -> Optional[str]:
        file = db.query(File).filter(File.id == file_id).first()
        if not file or not os.path.exists(file.path):
            return None

        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "media_cache")
        os.makedirs(cache_dir, exist_ok=True)
        thumb_path = os.path.join(cache_dir, f"thumb_{file_id}.jpg")

        if os.path.exists(thumb_path):
            return thumb_path

        ext_low = file.extension.lower()
        if ext_low in IMAGE_EXTENSIONS:
            try:
                img = cv2.imread(file.path)
                if img is None:
                    from PIL import Image
                    pil_img = Image.open(file.path).convert("RGB")
                    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

                h, w = img.shape[:2]
                scale = min(300.0 / max(1, w), 300.0 / max(1, h), 1.0)
                new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
                resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                cv2.imwrite(thumb_path, resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
                return thumb_path
            except Exception as e:
                logger.warning(f"Failed to generate thumbnail for {file.path}: {e}")
                return file.path

        elif ext_low in VIDEO_EXTENSIONS:
            try:
                cap = cv2.VideoCapture(file.path)
                if cap.isOpened():
                    ret, frame = cap.read()
                    cap.release()
                    if ret and frame is not None:
                        h, w = frame.shape[:2]
                        scale = min(300.0 / max(1, w), 300.0 / max(1, h), 1.0)
                        resized = cv2.resize(frame, (max(1, int(w * scale)), max(1, int(h * scale))))
                        cv2.imwrite(thumb_path, resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        return thumb_path
            except Exception as e:
                logger.warning(f"Failed to generate video thumbnail for {file.path}: {e}")

        return file.path

    def get_file_detail(self, db: Session, file_id: int) -> Optional[dict]:
        """Returns deep visual analysis for a single media file."""
        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            return None

        logger.info(
            f"[MEDIA DEBUG] media_id: {file.id}, filename: {file.name}, "
            f"database_file_path: {file.path}, resolved_original_path: {file.path}, "
            f"frontend_image_url: /api/media/{file.id}/preview"
        )

        folder = db.query(Folder).filter(Folder.id == file.folder_id).first()
        analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file.id).first()

        similar_items = self.get_similar_media(db, file_id)
        rec = db.query(MediaRecommendation).filter(MediaRecommendation.file_id == file.id).first()
        
        rec_data = None
        if rec:
            rec_data = {
                "id": rec.id,
                "action": rec.action,
                "reason": rec.reason,
                "score": rec.recommendation_score,
                "potential_recovery_bytes": rec.potential_storage_recovery,
                "potential_recovery_formatted": self._format_bytes(rec.potential_storage_recovery),
                "status": rec.status
            }

        return {
            "file_id": file.id,
            "file_name": file.name,
            "file_path": file.path,
            "folder_name": folder.name if folder else "",
            "extension": file.extension,
            "size_bytes": file.size,
            "size_formatted": self._format_bytes(file.size),
            "modified_at": file.modified_at.isoformat() if file.modified_at else "",
            "media_type": "video" if file.extension.lower() in VIDEO_EXTENSIONS else "image",
            "analysis_status": analysis.analysis_status if analysis else "pending",
            "content_type": getattr(analysis, "content_type", "pictorial") if analysis else "pictorial",
            "classification_confidence": getattr(analysis, "classification_confidence", 1.0) if analysis else 1.0,
            "classification_reason": getattr(analysis, "classification_reason", "") if analysis else "",
            "quality_score": analysis.quality_score if analysis else 0.0,
            "sharpness_score": analysis.sharpness_score if analysis else 0.0,
            "blur_score": analysis.blur_score if analysis else 0.0,
            "visual_category": analysis.visual_category if analysis else "unclassified",
            "ai_description": analysis.ai_description if analysis else "",
            "description": analysis.ai_description if analysis else "",
            "ai_tags": analysis.get_ai_tags() if analysis else (analysis.get_detected_objects() if analysis else []),
            "user_tags": analysis.get_user_tags() if analysis else [],
            "detected_objects": analysis.get_detected_objects() if analysis else [],
            "object_counts": analysis.get_object_counts() if analysis else [],
            "detected_scenes": analysis.get_detected_scenes() if analysis else [],
            "environment": analysis.environment if analysis else "",
            "activities": analysis.get_activities() if analysis else [],
            "search_terms": analysis.get_search_terms() if analysis else [],
            "quality_factors": analysis.get_quality_factors() if analysis else {},
            "width": analysis.width if analysis else 0,
            "height": analysis.height if analysis else 0,
            "aspect_ratio": analysis.aspect_ratio if analysis else "",
            "duration": analysis.duration if analysis else 0.0,
            "frame_rate": analysis.frame_rate if analysis else 0.0,
            "thumbnail_url": f"/api/media/{file.id}/thumbnail",
            "preview_url": f"/api/media/{file.id}/preview",
            "similar_media_count": len(similar_items),
            "similar_media": similar_items,
            "recommendation": rec_data
        }

    def get_similar_media(self, db: Session, file_id: int) -> list:
        similarities = db.query(MediaSimilarity).filter(
            (MediaSimilarity.file_a_id == file_id) | (MediaSimilarity.file_b_id == file_id)
        ).order_by(MediaSimilarity.similarity_score.desc()).all()

        this_analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file_id).first()

        results = []
        for sim in similarities:
            other_id = sim.file_b_id if sim.file_a_id == file_id else sim.file_a_id
            other_file = db.query(File).filter(File.id == other_id).first()
            if not other_file:
                continue

            other_analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == other_id).first()
            why_sim = visual_similarity_engine.explain_similarity(
                this_analysis, other_analysis, sim.similarity_type, sim.similarity_score
            )

            results.append({
                "file_id": other_file.id,
                "file_name": other_file.name,
                "file_path": other_file.path,
                "size_bytes": other_file.size,
                "size_formatted": self._format_bytes(other_file.size),
                "similarity_score": sim.similarity_score,
                "similarity_type": sim.similarity_type,
                "why_similar": why_sim,
                "quality_score": other_analysis.quality_score if other_analysis else 0.0,
                "visual_category": other_analysis.visual_category if other_analysis else "image",
                "thumbnail_url": f"/api/media/{other_file.id}/thumbnail",
                "preview_url": f"/api/media/{other_file.id}/preview"
            })

        return results

    def get_visual_groups(self, db: Session) -> list:
        groups = db.query(MediaGroup).all()
        results = []

        for g in groups:
            items = db.query(MediaGroupItem, File, MediaAnalysis).join(
                File, MediaGroupItem.file_id == File.id
            ).outerjoin(
                MediaAnalysis, File.id == MediaAnalysis.file_id
            ).filter(
                MediaGroupItem.group_id == g.id
            ).all()

            file_list = []
            for item, file, analysis in items:
                file_list.append({
                    "file_id": file.id,
                    "file_name": file.name,
                    "file_path": file.path,
                    "size_formatted": self._format_bytes(file.size),
                    "quality_score": analysis.quality_score if analysis else 0.0,
                    "visual_category": analysis.visual_category if analysis else "photo",
                    "is_screenshot": analysis.is_screenshot if analysis else False
                })

            rep_file = db.query(File).filter(File.id == g.representative_file_id).first() if g.representative_file_id else None

            results.append({
                "id": g.id,
                "group_name": g.group_name,
                "group_type": g.group_type,
                "item_count": len(file_list),
                "representative_file_path": rep_file.path if rep_file else (file_list[0]["file_path"] if file_list else ""),
                "items": file_list
            })

        return results

    def get_recommendations(self, db: Session) -> list:
        recs = db.query(MediaRecommendation, File).join(
            File, MediaRecommendation.file_id == File.id
        ).filter(
            MediaRecommendation.status == "pending"
        ).order_by(
            MediaRecommendation.recommendation_score.desc()
        ).all()

        results = []
        for rec, file in recs:
            better_file = db.query(File).filter(File.id == rec.target_better_file_id).first() if rec.target_better_file_id else None
            analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file.id).first()
            better_analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == better_file.id).first() if better_file else None

            results.append({
                "id": rec.id,
                "file_id": file.id,
                "file_name": file.name,
                "file_path": file.path,
                "size_bytes": file.size,
                "size_formatted": self._format_bytes(file.size),
                "action": rec.action,
                "score": rec.recommendation_score,
                "reason": rec.reason,
                "potential_storage_recovery": rec.potential_storage_recovery,
                "potential_storage_recovery_formatted": self._format_bytes(rec.potential_storage_recovery),
                "quality_score": analysis.quality_score if analysis else 0.0,
                "target_better_file": {
                    "file_id": better_file.id,
                    "file_name": better_file.name,
                    "file_path": better_file.path,
                    "size_formatted": self._format_bytes(better_file.size),
                    "quality_score": better_analysis.quality_score if better_analysis else 0.0
                } if better_file else None,
                "status": rec.status,
                "created_at": rec.created_at.isoformat() if rec.created_at else ""
            })

        return results

    def handle_recommendation_action(self, db: Session, recommendation_id: int, action: str) -> dict:
        rec = db.query(MediaRecommendation).filter(MediaRecommendation.id == recommendation_id).first()
        if not rec:
            return {"status": "error", "message": "Recommendation not found"}

        if action in ["keep", "ignore"]:
            rec.status = action
            rec.reviewed_at = datetime.utcnow()
            db.commit()
            return {"status": "success", "message": f"Recommendation marked as '{action}'"}

        elif action == "remove":
            rec.status = "approved_for_removal"
            rec.reviewed_at = datetime.utcnow()
            db.commit()
            return {"status": "success", "message": "File approved for removal. Confirm deletion to proceed."}

        return {"status": "error", "message": f"Invalid action: {action}"}

    def delete_media_file(self, db: Session, file_id: int, confirmed: bool = False) -> dict:
        if not confirmed:
            return {"status": "error", "message": "Explicit user confirmation is required for file deletion."}

        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            return {"status": "error", "message": "File not found in database"}

        file_path = file.path
        file_name = file.name
        freed_bytes = file.size

        try:
            if os.path.exists(file_path):
                os.remove(file_path)

            visual_faiss_manager.remove_file(file.id)
            db.delete(file)
            db.commit()

            return {
                "status": "success",
                "message": f"Successfully deleted '{file_name}' and freed {self._format_bytes(freed_bytes)} of storage.",
                "freed_bytes": freed_bytes
            }
        except Exception as e:
            logger.error(f"Error deleting media file {file_path}: {e}", exc_info=True)
            db.rollback()
            return {"status": "error", "message": f"Failed to delete file from disk: {str(e)}"}

    def open_media_file(self, db: Session, file_id: int) -> dict:
        """
        Launches the exact physical image file in the host operating system's default native application.
        Resolves canonical path, verifies file existence, and calls native OS opener.
        """
        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            return {"status": "error", "message": "Media record not found in database."}

        canonical_path = os.path.abspath(file.path)
        if not os.path.exists(canonical_path):
            return {"status": "error", "message": "Original file not found on disk."}

        try:
            import subprocess
            if sys.platform == "win32":
                os.startfile(canonical_path)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", canonical_path])
            else:
                subprocess.Popen(["xdg-open", canonical_path])
            return {
                "status": "success",
                "message": f"Opened '{file.name}' in native OS viewer.",
                "path": canonical_path,
                "file_id": file.id,
                "media_id": file.id
            }
        except Exception as e:
            logger.error(f"Failed to open file {canonical_path}: {e}", exc_info=True)
            return {"status": "error", "message": f"Failed to open original file: {str(e)}"}

    # =========================================================================
    # PART 10-18: MODULE 3 TWO-STAGE VISUAL SEARCH ENGINE
    # =========================================================================

    def search_visual_media(
        self,
        db: Session,
        query: str,
        threshold: float = 60.0,
        top_k: int = 20
    ) -> dict:
        """
        MODULE 3 VISUAL SEARCH PIPELINE:
        1. Generate OpenAI text embedding for search query.
        2. Retrieve Top-K candidate pictorial images from Visual FAISS Index.
        3. Send candidates' human-readable visual metadata to OpenAI Semantic Judge.
        4. Apply strict relevance policy (relevant == True AND relevance_score >= threshold).
        5. Return ranked high-precision results with explainable reasons and zero-result suggestions.
        """
        clean_query = (query or "").strip()
        if not clean_query:
            return {
                "query": "",
                "threshold": threshold,
                "total_candidates": 0,
                "relevant_count": 0,
                "filtered_count": 0,
                "pictorial_images_count": 0,
                "text_heavy_excluded_count": 0,
                "results": [],
                "suggested_queries": ["river", "dog", "beach", "mountain", "car"]
            }

        logger.info(f"[Module3] Query: {clean_query}")

        # 1. Generate local Sentence Transformer embedding for search query (384-dim)
        query_vec = local_vision_analyzer.embed_text(clean_query)

        # 2. Stage 1 Retrieval: Search Visual FAISS for Top-K candidates
        faiss_matches = []
        if visual_faiss_manager.index is not None and visual_faiss_manager.index.ntotal > 0:
            faiss_matches = visual_faiss_manager.search_similar(query_vec, top_k=top_k)

        logger.info(f"[Module3] FAISS candidates: {len(faiss_matches)}")

        candidate_map = {}
        for m in faiss_matches:
            candidate_map[m["file_id"]] = float(m.get("similarity", 0.0))

        # Query candidates from DB (Strictly PICTORIAL images & videos)
        candidate_files = []
        if candidate_map:
            candidate_files = db.query(File, MediaAnalysis, Folder).join(
                Folder, File.folder_id == Folder.id
            ).outerjoin(
                MediaAnalysis, File.id == MediaAnalysis.file_id
            ).filter(
                File.id.in_(list(candidate_map.keys())),
                File.extension.in_(list(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS)),
                (MediaAnalysis.content_type == "pictorial") | (MediaAnalysis.content_type.is_(None)),
                MediaAnalysis.analysis_status != "skipped_text_heavy"
            ).all()

        # If FAISS was empty or missing some indexed files, pool all analyzed PICTORIAL media files
        if not candidate_files:
            candidate_files = db.query(File, MediaAnalysis, Folder).join(
                Folder, File.folder_id == Folder.id
            ).outerjoin(
                MediaAnalysis, File.id == MediaAnalysis.file_id
            ).filter(
                File.extension.in_(list(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS)),
                (MediaAnalysis.content_type == "pictorial") | (MediaAnalysis.content_type.is_(None)),
                MediaAnalysis.analysis_status != "skipped_text_heavy"
            ).limit(top_k).all()

        all_analyses = db.query(MediaAnalysis).all()
        pictorial_images_count = sum(1 for a in all_analyses if getattr(a, "content_type", "pictorial") == "pictorial" and a.analysis_status == "completed")
        text_heavy_excluded_count = sum(1 for a in all_analyses if getattr(a, "content_type", "pictorial") == "text_heavy" or a.analysis_status == "skipped_text_heavy")

        if not candidate_files:
            logger.info(f"[Module3] Relevant candidates: 0")
            logger.info(f"[Module3] Filtered candidates: 0")
            return {
                "query": clean_query,
                "threshold": threshold,
                "total_candidates": 0,
                "relevant_count": 0,
                "filtered_count": 0,
                "pictorial_images_count": pictorial_images_count,
                "text_heavy_excluded_count": text_heavy_excluded_count,
                "results": [],
                "suggested_queries": ["river", "dog", "beach", "mountain", "car"]
            }

        # Format candidates for Local Semantic Evaluation
        candidate_payload = []
        candidate_lookup = {}

        for file, analysis, folder in candidate_files:
            fid_str = str(file.id)
            objs = analysis.get_detected_objects() if analysis else []
            counts = analysis.get_object_counts() if analysis else []
            scenes = analysis.get_detected_scenes() if analysis else []
            attrs = analysis.get_visual_attributes() if analysis else []
            rels = analysis.get_relationships() if analysis else []
            terms = analysis.get_search_terms() if analysis else []
            acts = analysis.get_activities() if analysis else []
            desc = analysis.ai_description if (analysis and analysis.ai_description) else ""
            ctype = getattr(analysis, "content_type", "pictorial") if analysis else "pictorial"

            ai_tags = analysis.get_ai_tags() if analysis else (objs or terms)
            user_tags = analysis.get_user_tags() if analysis else []

            cand_dict = {
                "id": fid_str,
                "file_id": file.id,
                "filename": file.name,
                "content_type": ctype,
                "description": desc,
                "objects": objs,
                "object_counts": counts,
                "scene": ", ".join(scenes) if scenes else "general",
                "environment": analysis.environment if analysis else "general",
                "activities": acts,
                "visual_attributes": attrs,
                "relationships": rels,
                "tags": ai_tags or terms or objs,
                "ai_tags": ai_tags,
                "user_tags": user_tags,
                "search_terms": terms,
                "visual_category": analysis.visual_category if analysis else "photograph",
                "is_screenshot": analysis.is_screenshot if analysis else False,
                "faiss_similarity": candidate_map.get(file.id, 0.5)
            }
            candidate_payload.append(cand_dict)
            candidate_lookup[fid_str] = (file, analysis, folder, cand_dict)

        # 3. Local Semantic Relevance Evaluation (Cosine Similarity)
        logger.info(f"[Module3] Local semantic evaluation started for query: '{clean_query}'")
        rerank_evals = local_vision_analyzer.evaluate_semantic_relevance(
            query=clean_query,
            candidates=candidate_payload,
            threshold=threshold
        )

        # 4. Strict Relevance Filtering & Ranking
        final_results = []
        filtered_count = 0

        for item in rerank_evals:
            iid = str(item.get("image_id", ""))
            rel = bool(item.get("relevant", False))
            score = int(item.get("relevance_score", 0))
            reason = item.get("reason", "Matches search query.")

            if not rel or score < threshold:
                filtered_count += 1
                continue

            if iid in candidate_lookup:
                file, analysis, folder, cand = candidate_lookup[iid]
                faiss_sim = cand.get("faiss_similarity", 0.5)
                hybrid_score = int(round(score * 0.90 + max(0.0, min(1.0, faiss_sim)) * 10))
                relevance_label = "Direct Match" if score >= 90 else ("Strong Match" if score >= 75 else "Related")

                final_results.append({
                    "file_id": file.id,
                    "file_name": file.name,
                    "file_path": file.path,
                    "folder_name": folder.name if folder else "",
                    "extension": file.extension,
                    "size_bytes": file.size,
                    "size_formatted": self._format_bytes(file.size),
                    "relevance_score": score,
                    "semantic_score": score,
                    "hybrid_score": hybrid_score,
                    "faiss_similarity": round(faiss_sim * 100, 1),
                    "relevance_label": relevance_label,
                    "content_type": getattr(analysis, "content_type", "pictorial") if analysis else "pictorial",
                    "classification_confidence": getattr(analysis, "classification_confidence", 1.0) if analysis else 1.0,
                    "classification_reason": getattr(analysis, "classification_reason", "") if analysis else "",
                    "match_reason": reason,
                    "ai_description": analysis.ai_description if analysis else "",
                    "detected_objects": analysis.get_detected_objects() if analysis else [],
                    "object_counts": analysis.get_object_counts() if analysis else [],
                    "detected_scenes": analysis.get_detected_scenes() if analysis else [],
                    "environment": analysis.environment if analysis else "",
                    "visual_attributes": analysis.get_visual_attributes() if analysis else [],
                    "relationships": analysis.get_relationships() if analysis else [],
                    "ai_tags": analysis.get_ai_tags() if analysis else [],
                    "user_tags": analysis.get_user_tags() if analysis else [],
                    "search_terms": analysis.get_search_terms() if analysis else [],
                    "quality_score": analysis.quality_score if analysis else 0.0,
                    "visual_category": analysis.visual_category if analysis else "photograph",
                    "width": analysis.width if analysis else 0,
                    "height": analysis.height if analysis else 0,
                    "thumbnail_url": f"/api/media/{file.id}/thumbnail",
                    "preview_url": f"/api/media/{file.id}/preview"
                })

        final_results.sort(key=lambda x: (x["relevance_score"], x["hybrid_score"]), reverse=True)

        logger.info(f"[Module3] Relevant candidates: {len(final_results)}")
        logger.info(f"[Module3] Filtered candidates: {filtered_count}")

        suggested = ["river", "dog", "beach", "mountain", "sunset", "red car"] if len(final_results) == 0 else []

        return {
            "query": clean_query,
            "threshold": threshold,
            "total_candidates": len(candidate_files),
            "relevant_count": len(final_results),
            "filtered_count": filtered_count,
            "pictorial_images_count": pictorial_images_count,
            "text_heavy_excluded_count": text_heavy_excluded_count,
            "results": final_results,
            "suggested_queries": suggested
        }

    # =========================================================================
    # PART 36-49: EDITABLE IMAGE TAGS SYSTEM
    # =========================================================================

    def get_file_tags(self, db: Session, file_id: int) -> dict:
        """Returns separate AI generated tags and user-created tags for an image."""
        analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file_id).first()
        if not analysis:
            return {"file_id": file_id, "ai_tags": [], "user_tags": []}

        ai_tags = analysis.get_ai_tags()
        if not ai_tags and analysis.detected_objects:
            ai_tags = analysis.get_detected_objects()

        return {
            "file_id": file_id,
            "ai_tags": ai_tags,
            "user_tags": analysis.get_user_tags()
        }

    def update_file_tags(
        self,
        db: Session,
        file_id: int,
        user_tags: List[str],
        ai_tags: Optional[List[str]] = None
    ) -> dict:
        """
        Updates tags for a pictorial image:
        - Normalizes & deduplicates tags
        - Persists changes to database
        - Updates searchable semantic text representation
        - Recomputes 512-dim embedding and updates Visual FAISS vector in-place
        """
        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            return {"status": "error", "message": f"File {file_id} not found."}

        analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file_id).first()
        if not analysis:
            analysis = MediaAnalysis(file_id=file_id, content_type="pictorial", analysis_status="completed")
            db.add(analysis)

        # Normalize and deduplicate tags (preserving original case display)
        def clean_tag_list(raw_list):
            seen = set()
            cleaned = []
            for t in (raw_list or []):
                val = str(t).strip()
                if val and val.lower() not in seen:
                    seen.add(val.lower())
                    cleaned.append(val)
            return cleaned

        clean_user_tags = clean_tag_list(user_tags)
        analysis.set_user_tags(clean_user_tags)

        if ai_tags is not None:
            clean_ai_tags = clean_tag_list(ai_tags)
            analysis.set_ai_tags(clean_ai_tags)
        else:
            clean_ai_tags = analysis.get_ai_tags()

        # Rebuild rich searchable semantic representation incorporating user tags
        analysis_dict = {
            "description": analysis.ai_description or "",
            "objects": analysis.get_detected_objects(),
            "object_counts": analysis.get_object_counts(),
            "scene": ", ".join(analysis.get_detected_scenes()),
            "environment": analysis.environment or "",
            "activities": analysis.get_activities(),
            "visual_attributes": analysis.get_visual_attributes(),
            "relationships": analysis.get_relationships(),
            "ai_tags": clean_ai_tags,
            "user_tags": clean_user_tags,
            "search_terms": analysis.get_search_terms()
        }
        searchable_text = local_vision_analyzer.build_searchable_representation(analysis_dict)

        # Update dense 384-dim vector in Visual FAISS if pictorial
        if analysis.content_type == "pictorial" and analysis.analysis_status != "skipped_text_heavy":
            try:
                emb_vec = local_vision_analyzer.embed_text(searchable_text)
                if emb_vec is not None and np.linalg.norm(emb_vec) > 0:
                    faiss_id = visual_faiss_manager.add_vector(
                        emb_vec,
                        file.id,
                        media_type=analysis.media_type or "image",
                        extension=file.extension
                    )
                    existing_emb = db.query(MediaEmbedding).filter(MediaEmbedding.file_id == file.id).first()
                    if not existing_emb:
                        existing_emb = MediaEmbedding(file_id=file.id, visual_faiss_id=faiss_id)
                        db.add(existing_emb)
                    else:
                        existing_emb.visual_faiss_id = faiss_id
            except Exception as e:
                logger.warning(f"Failed to update FAISS embedding for file {file_id}: {e}")

        # Update fast keyword search index if present
        search_record = db.query(MediaSearchContent).filter(MediaSearchContent.file_id == file.id).first()
        if search_record:
            search_tokens = list(set(clean_ai_tags + clean_user_tags + analysis.get_detected_objects()))
            search_record.searchable_text = f"{' '.join(search_tokens)} {analysis.ai_description or ''}"
            search_record.smart_tags = json.dumps(clean_user_tags + clean_ai_tags)

        db.commit()
        logger.info(f"[Module3] Tags updated for file {file_id}: AI={clean_ai_tags}, User={clean_user_tags}")

        return {
            "status": "success",
            "file_id": file_id,
            "ai_tags": clean_ai_tags,
            "user_tags": clean_user_tags,
            "message": "Tags saved successfully and semantic index updated."
        }

    # =========================================================================
    # PART 15: RECENTLY CHECKED PICTORIAL IMAGES
    # =========================================================================

    def record_inspected_file(self, db: Session, file_id: int) -> dict:
        """Records when user inspects a pictorial image."""
        analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file_id).first()
        if not analysis:
            return {"status": "skipped", "message": "Analysis not found."}

        if getattr(analysis, "content_type", "pictorial") == "text_heavy" or analysis.analysis_status == "skipped_text_heavy":
            return {"status": "skipped", "message": "Text-heavy images excluded from visual recent history."}

        analysis.recently_inspected_at = datetime.utcnow()
        db.commit()
        return {"status": "success", "file_id": file_id, "inspected_at": analysis.recently_inspected_at.isoformat()}

    def get_recently_checked_media(self, db: Session, limit: int = 12) -> list:
        """Returns list of recently inspected genuine pictorial images (most recent first)."""
        recent_analyses = db.query(MediaAnalysis, File).join(
            File, MediaAnalysis.file_id == File.id
        ).filter(
            (MediaAnalysis.content_type == "pictorial") | (MediaAnalysis.content_type.is_(None)),
            MediaAnalysis.analysis_status != "skipped_text_heavy",
            MediaAnalysis.recently_inspected_at.isnot(None)
        ).order_by(
            MediaAnalysis.recently_inspected_at.desc()
        ).limit(limit).all()

        results = []
        for analysis, file in recent_analyses:
            results.append({
                "file_id": file.id,
                "file_name": file.name,
                "file_path": file.path,
                "size_formatted": self._format_bytes(file.size),
                "ai_description": analysis.ai_description or "",
                "ai_tags": analysis.get_ai_tags(),
                "user_tags": analysis.get_user_tags(),
                "quality_score": analysis.quality_score,
                "inspected_at": analysis.recently_inspected_at.isoformat() if analysis.recently_inspected_at else "",
                "thumbnail_url": f"/api/media/{file.id}/thumbnail",
                "preview_url": f"/api/media/{file.id}/preview"
            })
        return results

    # =========================================================================
    # PART 16-19: CUSTOM VISUAL GROUPS & ORIGINAL IMAGE COVERS
    # =========================================================================

    def create_custom_visual_group(
        self,
        db: Session,
        group_name: str,
        file_ids: List[int],
        representative_file_id: Optional[int] = None
    ) -> dict:
        """
        Creates a custom visual group of genuine pictorial images.
        Does NOT move, copy, or modify any files on disk.
        Cover image is guaranteed to be one of the original images in the group.
        """
        clean_name = (group_name or "").strip()
        if not clean_name:
            return {"status": "error", "message": "Group name cannot be empty."}

        if not file_ids:
            return {"status": "error", "message": "Please select at least one pictorial image."}

        # Manual grouping is independent from AI classification: all library media files are allowed
        files = db.query(File).filter(File.id.in_(file_ids)).all()
        if len(files) == 0:
            return {"status": "error", "message": "No valid files found for the given IDs."}

        valid_file_ids = [f.id for f in files]
        if not valid_file_ids:
            return {"status": "error", "message": "Please select at least one media file from the library."}

        # Representative cover MUST be one of the original selected images
        rep_id = representative_file_id if (representative_file_id and representative_file_id in valid_file_ids) else valid_file_ids[0]

        group = MediaGroup(
            group_name=clean_name,
            group_type="custom_user_group",
            representative_file_id=rep_id,
            item_count=len(valid_file_ids)
        )
        db.add(group)
        db.flush()

        for fid in valid_file_ids:
            item = MediaGroupItem(
                group_id=group.id,
                file_id=fid,
                confidence=1.0
            )
            db.add(item)

        db.commit()
        logger.info(f"[Module3] Created custom visual group '{clean_name}' (ID: {group.id}) with {len(valid_file_ids)} images.")

        return {
            "status": "success",
            "group_id": group.id,
            "group_name": group.group_name,
            "item_count": len(valid_file_ids),
            "representative_file_id": rep_id,
            "message": f"Visual group '{clean_name}' created successfully."
        }

    def delete_visual_group(self, db: Session, group_id: int) -> dict:
        """Deletes a visual group record without touching physical files on disk."""
        group = db.query(MediaGroup).filter(MediaGroup.id == group_id).first()
        if not group:
            return {"status": "error", "message": "Visual group not found."}

        group_name = group.group_name
        db.delete(group)
        db.commit()
        return {"status": "success", "message": f"Visual group '{group_name}' removed."}

    def find_similar_by_external_image(self, db: Session, image_bytes: bytes, filename: str = "query_image.jpg") -> dict:
        """
        Finds visually and semantically similar images in the Memora pictorial library
        using a temporary external query image (Phase 1, Phase 2, Phase 3 pipeline).
        The external image is NEVER stored in the database or copied to library folders.
        """
        import tempfile
        ext = os.path.splitext(filename)[1].lower() or ".jpg"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            # 1. Analyze external image using Local Qwen2.5-VL (Phase 2)
            analysis_res = local_vision_analyzer.analyze_image(tmp_path, filename=filename)

            if analysis_res.get("content_type") == "text_heavy":
                return {
                    "status": "rejected_text_heavy",
                    "message": "Query image is a document or text-heavy screenshot, not a pictorial image.",
                    "query_analysis": analysis_res,
                    "results": []
                }

            q_desc = (analysis_res.get("description", "")).strip()
            q_objs = [str(o.get("name") if isinstance(o, dict) else o).lower().strip() for o in analysis_res.get("objects", []) if o]
            q_scenes = [s.lower().strip() for s in (analysis_res.get("detected_scenes") or [analysis_res.get("scene", "")]) if s]
            q_env = (analysis_res.get("environment", "")).lower().strip()
            q_colors = [c.lower().strip() for c in analysis_res.get("colors", []) if c]
            q_tags = [t.lower().strip() for t in (analysis_res.get("ai_tags") or analysis_res.get("tags") or []) if t]

            searchable_text = analysis_res.get("searchable_text", "")
            if not searchable_text:
                searchable_text = local_vision_analyzer.build_searchable_representation(analysis_res)

            # 2. Precompute hashes of external query image
            q_sha = compute_file_sha256(tmp_path)
            q_dhash = compute_image_dhash(tmp_path)

            # 3. Generate 384-dimensional query embedding
            query_vec = local_vision_analyzer.embed_text(searchable_text)

            # 4. Retrieve all analyzed pictorial images
            analyzed_records = db.query(File, MediaAnalysis, Folder).join(
                Folder, File.folder_id == Folder.id
            ).outerjoin(
                MediaAnalysis, File.id == MediaAnalysis.file_id
            ).filter(
                File.extension.in_(list(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS)),
                (MediaAnalysis.content_type == "pictorial") | (MediaAnalysis.content_type.is_(None)),
                MediaAnalysis.analysis_status == "completed"
            ).all()

            results = []
            for file, analysis, folder in analyzed_records:
                if not analysis:
                    continue

                # Tier A: Exact Duplicate check (SHA-256)
                c_sha = compute_file_sha256(file.path)
                if q_sha and c_sha and q_sha == c_sha:
                    results.append({
                        "file_id": file.id,
                        "file_name": file.name,
                        "filename": file.name,
                        "file_path": file.path,
                        "similarity_score": 100,
                        "similarity_type": "exact",
                        "similarity_label": "Exact Duplicate",
                        "why_similar": "100% exact duplicate with identical file contents (SHA-256 verified).",
                        "ai_description": analysis.ai_description,
                        "quality_score": analysis.quality_score,
                        "thumbnail_url": f"/api/media/{file.id}/thumbnail",
                        "preview_url": f"/api/media/{file.id}/preview"
                    })
                    continue

                # Tier B: Near Duplicate check (Perceptual 64-bit dHash >= 90%)
                if q_dhash is not None and file.extension.lower() in IMAGE_EXTENSIONS:
                    c_dh = compute_image_dhash(file.path)
                    if c_dh is not None:
                        p_sim = compute_perceptual_similarity(q_dhash, c_dh)
                        if p_sim >= NEAR_DUPLICATE_PERCEPTUAL_THRESHOLD:
                            pct_score = int(round(p_sim))
                            results.append({
                                "file_id": file.id,
                                "file_name": file.name,
                                "filename": file.name,
                                "file_path": file.path,
                                "similarity_score": pct_score,
                                "similarity_type": "near_duplicate",
                                "similarity_label": "Near Duplicate",
                                "why_similar": f"Near duplicate ({pct_score}%) with matching perceptual layout and visual composition.",
                                "ai_description": analysis.ai_description,
                                "quality_score": analysis.quality_score,
                                "thumbnail_url": f"/api/media/{file.id}/thumbnail",
                                "preview_url": f"/api/media/{file.id}/preview"
                            })
                            continue

                # Tier C: Visually Similar (Semantic Local AI Embeddings + Grounded Visual Entities)
                c_desc = (analysis.ai_description or "").strip()
                c_objs = [str(o.get("name") if isinstance(o, dict) else o).lower().strip() for o in analysis.get_detected_objects() if o]
                c_scenes = [s.lower().strip() for s in (analysis.get_detected_scenes() or []) if s]
                c_env = (analysis.environment or "").lower().strip()
                c_tags = [t.lower().strip() for t in (analysis.get_ai_tags() + analysis.get_user_tags()) if t]

                cand_text = analysis.ai_description or ""
                cand_tags_str = " ".join(c_tags + c_objs)
                cand_full = f"Description: {cand_text}\nObjects: {cand_tags_str}\nScene: {', '.join(c_scenes)}"

                cand_vec = local_vision_analyzer.embed_text(cand_full)
                cos_sim = float(np.dot(query_vec, cand_vec))
                raw_embed_score = max(0.0, min(1.0, cos_sim)) * 100.0

                # Deep Verification: Multi-factor visual feature comparison
                # A. Object overlap
                common_objs = [o for o in q_objs if any(o in co or co in o for co in c_objs)]
                obj_score = (len(common_objs) / max(1, len(q_objs))) * 100.0 if q_objs else 50.0

                # B. Scene & Environment match
                scene_match = any(qs in cs or cs in qs for qs in q_scenes for cs in c_scenes if len(qs) > 2 and len(cs) > 2)
                env_match = bool(q_env and c_env and (q_env in c_env or c_env in q_env))
                scene_score = 100.0 if (scene_match and env_match) else (80.0 if (scene_match or env_match) else 30.0)

                # C. Tag overlap
                common_tags = [t for t in q_tags if t in c_tags]
                tag_score = (len(common_tags) / max(1, len(q_tags))) * 100.0 if q_tags else 50.0

                # Combined Weighted Similarity Score (0 - 100)
                weighted_score = (
                    0.45 * raw_embed_score +
                    0.25 * obj_score +
                    0.15 * scene_score +
                    0.15 * tag_score
                )
                pct_score = int(round(max(10.0, min(99.0, weighted_score))))

                # Categorical Label & Why Similar Explanation
                if pct_score >= 88:
                    label = "Very Similar"
                    if common_objs:
                        why_reason = f"Both images prominently feature {', '.join(common_objs[:3])} in a {c_scenes[0] if c_scenes else 'natural'} setting."
                    else:
                        why_reason = f"Both images share close visual composition and a {c_scenes[0] if c_scenes else 'matching'} environment."
                elif pct_score >= 75:
                    label = "Similar"
                    if common_objs:
                        why_reason = f"Both images contain {', '.join(common_objs[:2])}, though lighting and perspective differ."
                    else:
                        why_reason = f"Both images depict similar {c_scenes[0] if c_scenes else 'scenic'} context with aligned color tones."
                elif pct_score >= 58:
                    label = "Related"
                    if common_objs:
                        why_reason = f"Related visual themes sharing {common_objs[0]}, but with different background elements."
                    else:
                        why_reason = "Both images share outdoor natural context, but primary subjects differ."
                else:
                    label = "Weak Similarity"
                    why_reason = "Minimal visual or conceptual overlap."

                results.append({
                    "file_id": file.id,
                    "file_name": file.name,
                    "filename": file.name,
                    "file_path": file.path,
                    "similarity_score": pct_score,
                    "similarity_type": "visually_similar",
                    "similarity_label": label,
                    "why_similar": why_reason,
                    "ai_description": analysis.ai_description,
                    "quality_score": analysis.quality_score,
                    "thumbnail_url": f"/api/media/{file.id}/thumbnail",
                    "preview_url": f"/api/media/{file.id}/preview"
                })

            # Sort descending by similarity score
            results.sort(key=lambda x: x["similarity_score"], reverse=True)

            return {
                "status": "success",
                "query_description": analysis_res.get("description", ""),
                "query_analysis": {
                    "description": analysis_res.get("description", ""),
                    "objects": analysis_res.get("objects", []),
                    "scene": analysis_res.get("scene", ""),
                    "environment": analysis_res.get("environment", "")
                },
                "total_matches": len(results),
                "similar_media": results[:12],
                "results": results[:12]
            }

        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    def _format_bytes(self, size_bytes: int) -> str:
        if size_bytes <= 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB", "TB"]
        idx = 0
        val = float(size_bytes)
        while val >= 1024.0 and idx < len(units) - 1:
            val /= 1024.0
            idx += 1
        return f"{val:.1f} {units[idx]}"

media_service = MediaService()
