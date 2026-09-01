import logging
import numpy as np
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ..models import File, DuplicateGroup
from .embedding_service import embedding_service

logger = logging.getLogger("memora.duplicate")

class DuplicateService:
    def find_and_record_duplicates(self, db: Session) -> List[DuplicateGroup]:
        """
        Scans all files in the database to detect:
        1. Exact SHA-256 duplicates
        2. Semantic similarity duplicates
        Persists results into duplicate_groups table.
        """
        files = db.query(File).all()
        if len(files) < 2:
            return []

        existing_groups = {dg.group_key: dg for dg in db.query(DuplicateGroup).all()}
        recorded_groups: List[DuplicateGroup] = []

        # 1. Exact SHA-256 Duplicates
        hash_map: Dict[str, List[File]] = {}
        for f in files:
            if f.file_hash:
                hash_map.setdefault(f.file_hash, []).append(f)

        for f_hash, file_list in hash_map.items():
            if len(file_list) > 1:
                # Group exact pairs
                for i in range(len(file_list)):
                    for j in range(i + 1, len(file_list)):
                        file_a, file_b = file_list[i], file_list[j]
                        group_key = f"exact_{min(file_a.id, file_b.id)}_{max(file_a.id, file_b.id)}"
                        if group_key not in existing_groups:
                            group = DuplicateGroup(
                                group_key=group_key,
                                file_a_id=file_a.id,
                                file_b_id=file_b.id,
                                detection_type="Exact duplicate",
                                similarity=100.0,
                                status="unresolved"
                            )
                            db.add(group)
                            existing_groups[group_key] = group
                            recorded_groups.append(group)

        # 2. Semantic Similarity Duplicates
        # Generate or retrieve document embeddings for files
        file_vectors: Dict[int, np.ndarray] = {}
        for f in files:
            content = f"{f.name}. {f.extracted_text[:800] if f.extracted_text else ''}"
            file_vectors[f.id] = embedding_service.embed_text(content)

        file_ids = list(file_vectors.keys())
        for i in range(len(file_ids)):
            for j in range(i + 1, len(file_ids)):
                id_a, id_b = file_ids[i], file_ids[j]
                # Skip if already marked exact duplicate
                exact_key = f"exact_{min(id_a, id_b)}_{max(id_a, id_b)}"
                if exact_key in existing_groups:
                    continue

                vec_a, vec_b = file_vectors[id_a], file_vectors[id_b]
                sim = float(np.dot(vec_a, vec_b))

                # Threshold for semantic similarity
                if sim >= 0.88:
                    group_key = f"similar_{min(id_a, id_b)}_{max(id_a, id_b)}"
                    sim_pct = round(sim * 100, 1)
                    if group_key not in existing_groups:
                        group = DuplicateGroup(
                            group_key=group_key,
                            file_a_id=id_a,
                            file_b_id=id_b,
                            detection_type="Similar content",
                            similarity=sim_pct,
                            status="unresolved"
                        )
                        db.add(group)
                        existing_groups[group_key] = group
                        recorded_groups.append(group)

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error persisting duplicate groups: {e}")

        return list(existing_groups.values())

duplicate_service = DuplicateService()
