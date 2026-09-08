import os
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ...models import File, MediaAnalysis, MediaSimilarity, MediaRecommendation

logger = logging.getLogger("memora.media_recommender")

class MediaRecommender:
    """
    AI Media Cleanup Recommendation Engine for Module 3.
    Evaluates multi-factor signals (visual similarity, quality score differences,
    file size differentials, resolution gaps) to provide explainable cleanup advice.
    NEVER deletes files automatically — sets recommendations for explicit user review.
    """

    def generate_recommendations(self, db: Session) -> int:
        """
        Scans pairwise similarities and quality analyses to generate explainable recommendations.
        """
        # Clear existing pending recommendations
        db.query(MediaRecommendation).filter(MediaRecommendation.status == "pending").delete()
        db.commit()

        similarities = db.query(MediaSimilarity).filter(MediaSimilarity.similarity_score >= 85.0).all()
        created_count = 0
        recommended_file_ids = set()

        for sim in similarities:
            file_a = db.query(File).filter(File.id == sim.file_a_id).first()
            file_b = db.query(File).filter(File.id == sim.file_b_id).first()
            if not file_a or not file_b:
                continue

            analysis_a = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file_a.id).first()
            analysis_b = db.query(MediaAnalysis).filter(MediaAnalysis.file_id == file_b.id).first()
            if not analysis_a or not analysis_b:
                continue

            # Compare quality and size
            q_a = analysis_a.quality_score
            q_b = analysis_b.quality_score
            size_a = file_a.size
            size_b = file_b.size

            # Scenario 1: Exact Duplicate (100% or hash match)
            if sim.similarity_type == "exact" or sim.similarity_score >= 99.0:
                # Recommend keeping file_a and removing file_b (or the one in a subfolder)
                target_to_remove = file_b if file_b.id not in recommended_file_ids else file_a
                target_to_keep = file_a if target_to_remove.id == file_b.id else file_b

                rec = MediaRecommendation(
                    file_id=target_to_remove.id,
                    target_better_file_id=target_to_keep.id,
                    action="remove",
                    recommendation_score=98.0,
                    reason=f"Exact duplicate detected ({sim.similarity_score}% visual match with '{target_to_keep.name}'). Retaining one copy will free redundant storage.",
                    potential_storage_recovery=target_to_remove.size,
                    status="pending"
                )
                db.add(rec)
                recommended_file_ids.add(target_to_remove.id)
                created_count += 1
                continue

            # Scenario 2: Near-duplicate with quality difference
            # File B has significantly lower quality than File A, and uses storage
            if sim.similarity_score >= 88.0:
                if q_a > (q_b + 8.0) and file_b.id not in recommended_file_ids:
                    size_diff_mb = (size_b - size_a) / (1024 * 1024)
                    size_note = f" and uses {size_diff_mb:.1f} MB extra storage" if size_diff_mb > 0.5 else ""
                    
                    rec = MediaRecommendation(
                        file_id=file_b.id,
                        target_better_file_id=file_a.id,
                        action="review",
                        recommendation_score=min(95.0, sim.similarity_score),
                        reason=f"This media is {sim.similarity_score}% visually similar to '{file_a.name}', but has lower estimated quality ({q_b:.0f} vs {q_a:.0f}){size_note}.",
                        potential_storage_recovery=file_b.size,
                        status="pending"
                    )
                    db.add(rec)
                    recommended_file_ids.add(file_b.id)
                    created_count += 1

                elif q_b > (q_a + 8.0) and file_a.id not in recommended_file_ids:
                    size_diff_mb = (size_a - size_b) / (1024 * 1024)
                    size_note = f" and uses {size_diff_mb:.1f} MB extra storage" if size_diff_mb > 0.5 else ""

                    rec = MediaRecommendation(
                        file_id=file_a.id,
                        target_better_file_id=file_b.id,
                        action="review",
                        recommendation_score=min(95.0, sim.similarity_score),
                        reason=f"This media is {sim.similarity_score}% visually similar to '{file_b.name}', but has lower estimated quality ({q_a:.0f} vs {q_b:.0f}){size_note}.",
                        potential_storage_recovery=file_a.size,
                        status="pending"
                    )
                    db.add(rec)
                    recommended_file_ids.add(file_a.id)
                    created_count += 1

                # Scenario 3: Near-duplicate with nearly identical quality, but one file is significantly larger
                elif abs(q_a - q_b) <= 8.0:
                    if size_b > (size_a * 1.5) and (size_b - size_a) > (1024 * 1024) and file_b.id not in recommended_file_ids:
                        rec = MediaRecommendation(
                            file_id=file_b.id,
                            target_better_file_id=file_a.id,
                            action="review",
                            recommendation_score=85.0,
                            reason=f"'{file_a.name}' provides nearly identical visual quality ({q_a:.0f} vs {q_b:.0f}) while using {(size_b - size_a)/(1024*1024):.1f} MB less storage.",
                            potential_storage_recovery=file_b.size - size_a,
                            status="pending"
                        )
                        db.add(rec)
                        recommended_file_ids.add(file_b.id)
                        created_count += 1

        db.commit()
        return created_count

media_recommender = MediaRecommender()
