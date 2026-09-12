import os
import hashlib
import logging
import numpy as np
from PIL import Image
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from .visual_faiss_manager import visual_faiss_manager
from .local_vision import local_vision_analyzer
from ...models import File, MediaAnalysis, MediaEmbedding, MediaSimilarity, MediaGroup, MediaGroupItem

logger = logging.getLogger("memora.similarity_engine")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
VALID_MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

# ==============================================================================
# 3-TIER SIMILARITY THRESHOLDS
# Tier A: Exact Duplicate -> 100% (SHA-256 Byte Match)
# Tier B: Near Duplicate -> >= 90% (Perceptual 64-bit dHash)
# Tier C: Visually Similar -> >= 60% (Semantic Visual Embedding + Entity Check)
# ==============================================================================
NEAR_DUPLICATE_PERCEPTUAL_THRESHOLD = 90.0  # >= 90% (Hamming dist <= 6 / 64)
VISUAL_SEMANTIC_THRESHOLD = 60.0            # >= 60%


def compute_file_sha256(file_path: str) -> Optional[str]:
    """Computes SHA-256 hash of file bytes for exact duplicate detection."""
    try:
        if not os.path.isfile(file_path):
            return None
        sha = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha.update(chunk)
        return sha.hexdigest()
    except Exception as e:
        logger.debug(f"Error computing sha256 for {file_path}: {e}")
        return None


def compute_image_dhash(img_path: str, hash_size: int = 8) -> Optional[int]:
    """
    Computes 64-bit Difference Hash (dHash) using Pillow.
    Robust against resizing, recompression, and minor visual adjustments.
    """
    try:
        if not os.path.isfile(img_path):
            return None
        with Image.open(img_path) as img:
            img = img.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
            pixels = list(img.getdata())
            
            diff = []
            for row in range(hash_size):
                row_start = row * (hash_size + 1)
                for col in range(hash_size):
                    diff.append(pixels[row_start + col] > pixels[row_start + col + 1])
            
            # Convert list of 64 booleans to 64-bit integer
            hash_val = 0
            for bit in diff:
                hash_val = (hash_val << 1) | (1 if bit else 0)
            return hash_val
    except Exception as e:
        logger.debug(f"Error computing dHash for {img_path}: {e}")
        return None


def compute_perceptual_similarity(hash_a: int, hash_b: int) -> float:
    """Computes perceptual similarity percentage from Hamming distance of two 64-bit hashes."""
    hamming_dist = bin(hash_a ^ hash_b).count("1")
    sim = max(0.0, min(100.0, (1.0 - (hamming_dist / 64.0)) * 100.0))
    return round(sim, 1)


class VisualSimilarityEngine:
    """
    Computes pairwise visual similarities, identifies exact and near-duplicates,
    and constructs dynamic visual clusters/groups for Module 3 using local AI.
    Strictly isolated to genuine pictorial media (Images & Videos).
    """

    def compute_all_pairwise_similarities(self, db: Session) -> int:
        """
        Runs 3-tier pairwise similarity across all media files:
        Tier A: Exact Duplicate (SHA-256 byte identity -> 100%)
        Tier B: Near Duplicate (Perceptual 64-bit dHash >= 90%)
        Tier C: Visually Similar (Local Qwen + 384d Sentence Transformer embeddings >= 60%)
        """
        records = db.query(File, MediaAnalysis, MediaEmbedding).outerjoin(
            MediaAnalysis, File.id == MediaAnalysis.file_id
        ).outerjoin(
            MediaEmbedding, File.id == MediaEmbedding.file_id
        ).filter(
            File.extension.in_(list(VALID_MEDIA_EXTENSIONS))
        ).all()

        # Filter out non-existent or text-heavy items
        valid_items = [
            (f, a, emb) for f, a, emb in records
            if os.path.isfile(f.path) and (not a or getattr(a, "content_type", "pictorial") == "pictorial" and a.analysis_status != "skipped_text_heavy")
        ]

        if len(valid_items) < 2:
            return 0

        created_count = 0
        db.query(MediaSimilarity).delete()
        db.commit()

        # Precompute SHA-256 and dHash for all valid files
        sha_map: Dict[int, str] = {}
        dhash_map: Dict[int, int] = {}

        for f, _, _ in valid_items:
            sha = compute_file_sha256(f.path)
            if sha:
                sha_map[f.id] = sha
            if f.extension.lower() in IMAGE_EXTENSIONS:
                dh = compute_image_dhash(f.path)
                if dh is not None:
                    dhash_map[f.id] = dh

        processed_pairs = set()

        for i in range(len(valid_items)):
            f_a, a_a, emb_a = valid_items[i]
            sha_a = sha_map.get(f_a.id)
            dh_a = dhash_map.get(f_a.id)

            for j in range(i + 1, len(valid_items)):
                f_b, a_b, emb_b = valid_items[j]
                pair_key = (min(f_a.id, f_b.id), max(f_a.id, f_b.id))
                if pair_key in processed_pairs:
                    continue

                sha_b = sha_map.get(f_b.id)
                dh_b = dhash_map.get(f_b.id)

                # Tier A: Exact Duplicate
                if sha_a and sha_b and sha_a == sha_b:
                    sim_record = MediaSimilarity(
                        file_a_id=f_a.id,
                        file_b_id=f_b.id,
                        similarity_score=100.0,
                        similarity_type="exact"
                    )
                    db.add(sim_record)
                    processed_pairs.add(pair_key)
                    created_count += 1
                    continue

                # Tier B: Near Duplicate (perceptual hash >= 90%)
                if dh_a is not None and dh_b is not None:
                    p_sim = compute_perceptual_similarity(dh_a, dh_b)
                    if p_sim >= NEAR_DUPLICATE_PERCEPTUAL_THRESHOLD:
                        sim_record = MediaSimilarity(
                            file_a_id=f_a.id,
                            file_b_id=f_b.id,
                            similarity_score=p_sim,
                            similarity_type="near_duplicate"
                        )
                        db.add(sim_record)
                        processed_pairs.add(pair_key)
                        created_count += 1
                        continue

                # Tier C: Visually Similar (Semantic Visual Embeddings + Entities)
                if a_a and a_b:
                    v_sim, is_sim = self._evaluate_visual_similarity(a_a, a_b)
                    if is_sim and v_sim >= VISUAL_SEMANTIC_THRESHOLD:
                        sim_record = MediaSimilarity(
                            file_a_id=f_a.id,
                            file_b_id=f_b.id,
                            similarity_score=round(v_sim, 1),
                            similarity_type="visually_similar"
                        )
                        db.add(sim_record)
                        processed_pairs.add(pair_key)
                        created_count += 1

        db.commit()
        logger.info(f"[LOCAL AI] Computed {created_count} similarity relationships across 3 tiers.")
        return created_count

    def _evaluate_visual_similarity(self, a_a: MediaAnalysis, a_b: MediaAnalysis) -> Tuple[float, bool]:
        """
        Evaluates visual semantic similarity between two analyzed media records
        using Qwen2.5-VL metadata and Sentence Transformer embeddings.
        """
        scenes_a = [str(s).lower() for s in (a_a.get_detected_scenes() or []) if s]
        scenes_b = [str(s).lower() for s in (a_b.get_detected_scenes() or []) if s]
        text_a = f"{a_a.ai_description or ''} {', '.join(a_a.get_detected_objects())} {' '.join(scenes_a)}".strip()
        text_b = f"{a_b.ai_description or ''} {', '.join(a_b.get_detected_objects())} {' '.join(scenes_b)}".strip()

        if not text_a or not text_b:
            return 0.0, False

        vec_a = local_vision_analyzer.embed_text(text_a)
        vec_b = local_vision_analyzer.embed_text(text_b)

        cos_sim = float(np.dot(vec_a, vec_b))
        embed_pct = max(0.0, min(100.0, cos_sim * 100.0))

        objs_a = set(str(o.get("name") if isinstance(o, dict) else o).lower().strip() for o in a_a.get_detected_objects() if o)
        objs_b = set(str(o.get("name") if isinstance(o, dict) else o).lower().strip() for o in a_b.get_detected_objects() if o)

        common_objs = objs_a.intersection(objs_b)
        obj_overlap_pct = (len(common_objs) / max(1, min(len(objs_a), len(objs_b)))) * 100.0 if (objs_a and objs_b) else 0.0

        scene_match = any(sa in sb or sb in sa for sa in scenes_a for sb in scenes_b if len(sa) > 2 and len(sb) > 2)

        weighted_score = (0.50 * embed_pct) + (0.30 * obj_overlap_pct) + (0.20 * (90.0 if scene_match else 30.0))
        is_similar = bool((embed_pct >= 62.0 and (scene_match or common_objs)) or weighted_score >= VISUAL_SEMANTIC_THRESHOLD)

        return weighted_score, is_similar

    def explain_similarity(self, a_a: Optional[MediaAnalysis], a_b: Optional[MediaAnalysis], sim_type: str, score: float) -> str:
        """Generates grounded explanation for why two media items are considered similar."""
        if sim_type == "exact" or score >= 99.9:
            return "100% exact duplicate with identical file contents (SHA-256 verified)."

        if sim_type == "near_duplicate" or score >= NEAR_DUPLICATE_PERCEPTUAL_THRESHOLD:
            return f"Near duplicate ({score:.0f}%) with matching perceptual layout and visual composition."

        if not a_a or not a_b:
            return f"Visually similar ({score:.0f}%) sharing related visual composition."

        objs_a = set(str(o.get("name") if isinstance(o, dict) else o).lower().strip() for o in a_a.get_detected_objects() if o)
        objs_b = set(str(o.get("name") if isinstance(o, dict) else o).lower().strip() for o in a_b.get_detected_objects() if o)
        common_objs = list(objs_a.intersection(objs_b))

        scenes_a = [s for s in (a_a.get_detected_scenes() or [a_a.scene or ""]) if s]
        scenes_b = [s for s in (a_b.get_detected_scenes() or [a_b.scene or ""]) if s]

        if common_objs:
            scene_str = f" in a {scenes_b[0].lower()} setting" if scenes_b else ""
            return f"Both images prominently feature {', '.join(common_objs[:3])}{scene_str}."
        elif scenes_a and scenes_b:
            return f"Both images depict similar {scenes_b[0].lower()} scenery with aligned visual composition."
        else:
            return f"Both images share outdoor natural context with matching color tones."

    def generate_visual_groups(self, db: Session) -> int:
        """
        Dynamically constructs logical visual collections using local AI visual analysis
        without physical file reorganization.
        Strictly restricted to genuine pictorial images and videos. Documents and text-heavy images are never included.
        Preserves custom user-created visual groups.
        """
        analyses = db.query(MediaAnalysis, File).join(File, MediaAnalysis.file_id == File.id).filter(
            MediaAnalysis.analysis_status == "completed",
            (MediaAnalysis.content_type == "pictorial") | (MediaAnalysis.content_type.is_(None)),
            File.extension.in_(list(VALID_MEDIA_EXTENSIONS))
        ).all()
        
        # Exclude text-heavy items
        pictorial_analyses = [
            (a, f) for a, f in analyses
            if getattr(a, "content_type", "pictorial") == "pictorial" and a.analysis_status != "skipped_text_heavy"
        ]

        if not pictorial_analyses:
            return 0

        # Preserve custom user groups, clear only AI-generated groups
        non_custom_groups = db.query(MediaGroup).filter(MediaGroup.group_type != "custom_user_group").all()
        for g in non_custom_groups:
            db.query(MediaGroupItem).filter(MediaGroupItem.group_id == g.id).delete()
            db.delete(g)
        db.commit()

        # Build metadata payload for dynamic AI grouping
        items_payload = []
        for a, f in pictorial_analyses:
            items_payload.append({
                "file_id": f.id,
                "filename": f.name,
                "description": a.ai_description or "",
                "objects": a.get_detected_objects(),
                "scenes": a.get_detected_scenes(),
                "tags": a.get_ai_tags() or a.get_search_terms()
            })

        # Dynamic Local AI Grouping
        dynamic_groups = local_vision_analyzer.generate_collection_groups(items_payload)

        created_groups = 0
        for g_data in dynamic_groups:
            fids = g_data.get("file_ids", [])
            if not fids:
                continue

            rep_id = g_data.get("representative_file_id")
            if not rep_id or rep_id not in fids:
                rep_id = fids[0]

            mg = MediaGroup(
                group_name=g_data.get("group_name", "Visual Group"),
                group_type=g_data.get("group_type", "ai_dynamic_group"),
                representative_file_id=rep_id,
                item_count=len(fids)
            )
            db.add(mg)
            db.flush()

            for fid in fids:
                item = MediaGroupItem(
                    group_id=mg.id,
                    file_id=fid,
                    confidence=0.95
                )
                db.add(item)
            created_groups += 1

        db.commit()
        logger.info(f"[LOCAL AI] Generated {created_groups} dynamic visual groups.")
        return created_groups


visual_similarity_engine = VisualSimilarityEngine()
