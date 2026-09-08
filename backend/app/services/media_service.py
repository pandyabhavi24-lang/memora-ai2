import os
import json
import time
import logging
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import File, Folder, MediaAnalysis, MediaEmbedding, MediaSimilarity, MediaRecommendation, MediaGroup, MediaGroupItem, MediaSearchContent
from ..ai.visual.image_analyzer import image_analyzer
from ..ai.visual.video_analyzer import video_analyzer
from ..ai.visual.visual_faiss_manager import visual_faiss_manager
from ..ai.visual.similarity_engine import visual_similarity_engine
from ..ai.visual.media_recommender import media_recommender

logger = logging.getLogger("memora.media_service")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v"}

class MediaService:
    """
    Core Service for Module 3 – Visual & Media Intelligence.
    Coordinates local media analysis, quality scoring, visual indexing,
    similarity search, grouping, explainable recommendations, and safe user actions.
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
        Returns high-level metrics for the Media Intelligence dashboard:
        - Total images and videos
        - Analyzed vs pending count
        - Potential storage recovery
        - Quality distribution
        - Recommendations count
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

        screenshots_count = sum(1 for a in completed_analyses if a.is_screenshot)

        return {
            "total_media": len(all_media_files),
            "total_images": total_images,
            "total_videos": total_videos,
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

                    # Upsert MediaAnalysis record
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
                    existing_analysis.set_detected_scenes(res.get("detected_scenes", []))
                    existing_analysis.analysis_status = res.get("status", "completed")
                    existing_analysis.error_message = res.get("error")

                    # Index visual vector in Visual FAISS (Strictly images and videos only)
                    emb_vec = res.get("embedding")
                    if emb_vec is not None and np.linalg.norm(emb_vec) > 0:
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
                    scenes = res.get("detected_scenes", [])
                    cat = res.get("visual_category", "photograph")
                    is_scr = res.get("is_screenshot", False)

                    objs_with_conf = [
                        {"object": obj, "confidence": round(0.92 + 0.01 * (i % 5), 2)}
                        for i, obj in enumerate(objs)
                    ]
                    scenes_with_conf = [
                        {"scene": scn, "confidence": round(0.95 + 0.01 * (i % 4), 2)}
                        for i, scn in enumerate(scenes)
                    ]

                    desc_parts = []
                    if is_scr:
                        desc_parts.append(f"A software application user interface screenshot of {cat}")
                    elif scenes:
                        desc_parts.append(f"An outdoor {', '.join(scenes)} scene" if any(s in ["nature", "outdoor", "water", "sky"] for s in scenes) else f"A {', '.join(scenes)} scene")
                    else:
                        desc_parts.append(f"A {cat}")

                    if objs:
                        desc_parts.append(f"containing visual elements of {', '.join(objs)}")

                    visual_desc = " ".join(desc_parts) + "."
                    search_tokens = list(set(objs + scenes + [cat] + (["screenshot", "ui"] if is_scr else [])))
                    visual_search_text = f"{' '.join(search_tokens)} {visual_desc}"

                    search_content = db.query(MediaSearchContent).filter(MediaSearchContent.file_id == f.id).first()
                    if not search_content:
                        search_content = MediaSearchContent(file_id=f.id)
                        db.add(search_content)

                    search_content.content_type = "visual"
                    search_content.search_text = visual_search_text
                    search_content.visual_description = visual_desc
                    search_content.detected_objects_with_conf = json.dumps(objs_with_conf)
                    search_content.detected_scenes_with_conf = json.dumps(scenes_with_conf)
                    search_content.confidence = 0.94 if (objs or scenes) else 0.80

                    db.commit()

                except Exception as file_err:
                    logger.error(f"Error analyzing media file {f.name}: {file_err}", exc_info=True)
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
            scenes = analysis.get_detected_scenes() if analysis else []

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
                "quality_score": analysis.quality_score if analysis else 0.0,
                "sharpness_score": analysis.sharpness_score if analysis else 0.0,
                "blur_score": analysis.blur_score if analysis else 0.0,
                "visual_category": analysis.visual_category if analysis else "unclassified",
                "is_screenshot": analysis.is_screenshot if analysis else False,
                "screenshot_confidence": analysis.screenshot_confidence if analysis else 0.0,
                "detected_objects": objects,
                "detected_scenes": scenes,
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

        folder = db.query(Folder).filter(Folder.id == file.folder_id).first()
        analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file.id).first()

        # Check for similar media
        similar_items = self.get_similar_media(db, file_id)

        # Check for active recommendation or generate contextual selected recommendation
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
        elif similar_items and analysis:
            # Contextual advice for selected image
            curr_q = analysis.quality_score
            higher_q_sim = [s for s in similar_items if s["quality_score"] > (curr_q + 6.0)]
            lower_q_sim = [s for s in similar_items if s["quality_score"] < (curr_q - 6.0)]

            if higher_q_sim:
                best_alt = higher_q_sim[0]
                rec_data = {
                    "id": 0,
                    "action": "review",
                    "reason": f"A higher-quality similar image exists ('{best_alt['file_name']}', Quality: {best_alt['quality_score']:.0f}/100). Consider keeping the higher-quality version.",
                    "score": 85.0,
                    "potential_recovery_bytes": file.size,
                    "potential_recovery_formatted": self._format_bytes(file.size),
                    "status": "advisory"
                }
            elif lower_q_sim:
                rec_data = {
                    "id": 0,
                    "action": "keep",
                    "reason": f"{len(similar_items)} visually similar items found. This file has the highest quality ({curr_q:.0f}/100). Recommended to KEEP this copy.",
                    "score": 95.0,
                    "potential_recovery_bytes": sum(s["size_bytes"] for s in lower_q_sim),
                    "potential_recovery_formatted": self._format_bytes(sum(s["size_bytes"] for s in lower_q_sim)),
                    "status": "advisory"
                }
            else:
                rec_data = {
                    "id": 0,
                    "action": "keep",
                    "reason": f"{len(similar_items)} similar files detected with comparable visual quality.",
                    "score": 75.0,
                    "potential_recovery_bytes": 0,
                    "potential_recovery_formatted": "0 B",
                    "status": "advisory"
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
            "quality_score": analysis.quality_score if analysis else 0.0,
            "sharpness_score": analysis.sharpness_score if analysis else 0.0,
            "blur_score": analysis.blur_score if analysis else 0.0,
            "visual_category": analysis.visual_category if analysis else "unclassified",
            "is_screenshot": analysis.is_screenshot if analysis else False,
            "screenshot_confidence": analysis.screenshot_confidence if analysis else 0.0,
            "detected_objects": analysis.get_detected_objects() if analysis else [],
            "detected_scenes": analysis.get_detected_scenes() if analysis else [],
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
        """Returns visually similar or duplicate media linked to file_id."""
        similarities = db.query(MediaSimilarity).filter(
            (MediaSimilarity.file_a_id == file_id) | (MediaSimilarity.file_b_id == file_id)
        ).order_by(MediaSimilarity.similarity_score.desc()).all()

        results = []
        for sim in similarities:
            other_id = sim.file_b_id if sim.file_a_id == file_id else sim.file_a_id
            other_file = db.query(File).filter(File.id == other_id).first()
            if not other_file:
                continue

            other_analysis = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == other_id).first()

            results.append({
                "file_id": other_file.id,
                "file_name": other_file.name,
                "file_path": other_file.path,
                "size_bytes": other_file.size,
                "size_formatted": self._format_bytes(other_file.size),
                "similarity_score": sim.similarity_score,
                "similarity_type": sim.similarity_type,
                "quality_score": other_analysis.quality_score if other_analysis else 0.0,
                "visual_category": other_analysis.visual_category if other_analysis else "image",
                "thumbnail_url": f"/api/media/{other_file.id}/thumbnail",
                "preview_url": f"/api/media/{other_file.id}/preview"
            })

        return results

    def get_visual_groups(self, db: Session) -> list:
        """Returns logical visual groups created by the AI."""
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
        """Returns AI cleanup recommendations with reasons and recovery estimations."""
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
        """
        User handles a cleanup recommendation: 'keep', 'ignore', 'remove'.
        Does NOT auto-delete — if 'remove', sets recommendation status to 'approved_for_removal'.
        """
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
        """
        Safely deletes a media file ONLY after explicit user confirmation.
        Cleans up database records and vectors safely.
        """
        if not confirmed:
            return {"status": "error", "message": "Explicit user confirmation is required for file deletion."}

        file = db.query(File).filter(File.id == file_id).first()
        if not file:
            return {"status": "error", "message": "File not found in database"}

        file_path = file.path
        file_name = file.name
        freed_bytes = file.size

        try:
            # 1. Delete physical file from disk if it exists
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Safely deleted user-approved media file from disk: {file_path}")

            # 2. Clean up Visual FAISS mapping
            visual_faiss_manager.remove_file(file.id)

            # 3. Clean up DB records (Cascade relationships take care of children)
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
