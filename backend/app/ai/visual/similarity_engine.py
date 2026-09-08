import logging
import numpy as np
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from .visual_faiss_manager import visual_faiss_manager
from ...models import File, MediaAnalysis, MediaEmbedding, MediaSimilarity, MediaGroup, MediaGroupItem

logger = logging.getLogger("memora.similarity_engine")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
VALID_MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

# ==============================================================================
# CONFIGURABLE SIMILARITY THRESHOLDS
# ==============================================================================
EXACT_DUPLICATE_THRESHOLD = 0.985  # >= 98.5%
NEAR_DUPLICATE_THRESHOLD = 0.880   # >= 88.0%
VISUAL_SIMILAR_THRESHOLD = 0.700   # >= 70.0%

class VisualSimilarityEngine:
    """
    Computes pairwise visual similarities, identifies exact and near-duplicates,
    and constructs logical visual clusters/groups for Module 3.
    Strictly isolated to non-document visual media (Images & Videos).
    """

    def compute_all_pairwise_similarities(self, db: Session) -> int:
        """
        Runs vector similarity queries across all media embeddings in Visual FAISS.
        Stores significant similarity links in `media_similarities`.
        Strictly excludes any non-image/non-video files.
        """
        embeddings = db.query(MediaEmbedding, File).join(File, MediaEmbedding.file_id == File.id).filter(
            File.extension.in_(list(VALID_MEDIA_EXTENSIONS))
        ).all()
        if not embeddings or len(embeddings) < 2:
            return 0

        created_count = 0

        # Load all vectors from FAISS
        total_vectors = visual_faiss_manager.index.ntotal
        if total_vectors < 2:
            return 0

        # Clear old similarities
        db.query(MediaSimilarity).delete()
        db.commit()

        seen_pairs = set()

        for emb, file_a in embeddings:
            try:
                # Re-construct vector from index
                vec = visual_faiss_manager.index.reconstruct(emb.visual_faiss_id)
                matches = visual_faiss_manager.search_similar(vec, top_k=min(20, total_vectors))

                for match in matches:
                    other_fid = match["file_id"]
                    if other_fid == emb.file_id:
                        continue

                    # Verify other file is also valid visual media
                    other_file = db.query(File).filter(File.id == other_fid).first()
                    if not other_file or other_file.extension.lower() not in VALID_MEDIA_EXTENSIONS:
                        continue

                    pair_key = tuple(sorted([emb.file_id, other_fid]))
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    cos_sim = float(match["similarity"])
                    sim_pct = round(max(0.0, min(100.0, cos_sim * 100.0)), 1)

                    if cos_sim >= EXACT_DUPLICATE_THRESHOLD:
                        sim_type = "exact"
                    elif cos_sim >= NEAR_DUPLICATE_THRESHOLD:
                        sim_type = "near_duplicate"
                    elif cos_sim >= VISUAL_SIMILAR_THRESHOLD:
                        sim_type = "visually_similar"
                    else:
                        continue

                    sim_record = MediaSimilarity(
                        file_a_id=emb.file_id,
                        file_b_id=other_fid,
                        similarity_score=sim_pct,
                        similarity_type=sim_type
                    )
                    db.add(sim_record)
                    created_count += 1

            except Exception as e:
                logger.error(f"Error computing similarity for file {emb.file_id}: {e}")

        db.commit()
        return created_count

    def generate_visual_groups(self, db: Session) -> int:
        """
        Constructs logical visual collections (e.g. Screenshots, Nature, Events, Near-Duplicates)
        without physical file reorganization.
        Strictly restricted to images and videos. Documents are never included.
        """
        analyses = db.query(MediaAnalysis, File).join(File, MediaAnalysis.file_id == File.id).filter(
            MediaAnalysis.analysis_status == "completed",
            File.extension.in_(list(VALID_MEDIA_EXTENSIONS))
        ).all()
        if not analyses:
            return 0

        # Clear existing groups
        db.query(MediaGroupItem).delete()
        db.query(MediaGroup).delete()
        db.commit()

        # Group buckets
        groups_map: Dict[str, Dict[str, Any]] = {}

        for a, f in analyses:
            # Bucket by screenshot
            if a.is_screenshot:
                g_key = "Screenshots & Captures"
                g_type = "screenshot"
            elif "nature" in a.get_detected_scenes() or "tree" in a.get_detected_objects():
                g_key = "Nature & Outdoor Photography"
                g_type = "nature"
            elif "event" in a.get_detected_scenes() or a.visual_category == "event_photo":
                g_key = "Events & Gatherings"
                g_type = "event"
            elif "workshop" in a.get_detected_scenes() or "laptop" in a.get_detected_objects():
                g_key = "Workshops & Tech Media"
                g_type = "workshop"
            elif a.visual_category == "scanned_document" or a.visual_category == "certificate":
                g_key = "Scanned Images & Receipts"
                g_type = "scanned_media"
            elif a.media_type == "video":
                g_key = "Video Recordings"
                g_type = "video"
            else:
                g_key = "General Photos"
                g_type = "photo"

            if g_key not in groups_map:
                groups_map[g_key] = {
                    "type": g_type,
                    "representative_id": a.file_id,
                    "items": []
                }
            groups_map[g_key]["items"].append(a.file_id)

        created_groups = 0
        for name, g_data in groups_map.items():
            if len(g_data["items"]) == 0:
                continue
            mg = MediaGroup(
                group_name=name,
                group_type=g_data["type"],
                representative_file_id=g_data["representative_id"],
                item_count=len(g_data["items"])
            )
            db.add(mg)
            db.flush()

            for fid in g_data["items"]:
                item = MediaGroupItem(
                    group_id=mg.id,
                    file_id=fid,
                    confidence=0.95
                )
                db.add(item)
            created_groups += 1

        db.commit()
        return created_groups

visual_similarity_engine = VisualSimilarityEngine()
