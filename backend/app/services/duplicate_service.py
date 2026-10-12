import os
import re
import difflib
import unicodedata
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from ..models import File, DuplicateGroup
from .embedding_service import embedding_service
from .scanner import is_valid_user_file, calculate_sha256

logger = logging.getLogger("memora.duplicate")


def normalize_extracted_text(text: Optional[str]) -> str:
    """
    Normalizes extracted document text consistently:
    - Applies Unicode NFKC normalization.
    - Strips non-printable control characters while preserving newlines & tabs.
    - Collapses repeated spaces, tabs, and excess line breaks.
    - Preserves words, numbers, and meaningful punctuation.
    - Converts to lowercase for consistent comparison.
    """
    if not text or not isinstance(text, str):
        return ""

    # Unicode NFKC normalization
    normalized = unicodedata.normalize("NFKC", text)

    # Remove non-printable control characters except newline and tab
    clean_chars = [
        ch for ch in normalized
        if ch in ("\n", "\t") or not unicodedata.category(ch).startswith("C")
    ]
    normalized = "".join(clean_chars)

    # Standardize line endings
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse multiple horizontal whitespace characters into a single space
    normalized = re.sub(r"[ \t]+", " ", normalized)

    # Collapse 3+ consecutive newlines into 2
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)

    return normalized.strip().lower()


def calculate_lexical_similarity(norm_a: str, norm_b: str) -> float:
    """
    Computes a balanced lexical similarity score [0.0 - 1.0] combining:
    1. Word token Jaccard similarity.
    2. Character/token SequenceMatcher ratio.
    Dampens short boilerplate text to avoid false positives on trivial snippets.
    """
    if not norm_a or not norm_b:
        return 0.0

    if norm_a == norm_b:
        return 1.0

    # Tokenize alphanumeric words
    tokens_a = set(re.findall(r"\b\w+\b", norm_a))
    tokens_b = set(re.findall(r"\b\w+\b", norm_b))

    if not tokens_a or not tokens_b:
        return 0.0

    # Token Jaccard overlap
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    jaccard = (intersection / union) if union > 0 else 0.0

    # Sequence alignment ratio (quick prune if word overlap is under 15%)
    if jaccard < 0.15:
        seq_ratio = jaccard
    else:
        seq_a = norm_a[:2000]
        seq_b = norm_b[:2000]
        seq_ratio = difflib.SequenceMatcher(None, seq_a, seq_b).ratio()

    # Balanced lexical average
    lexical = 0.5 * jaccard + 0.5 * seq_ratio

    # Safeguard against short boilerplate (e.g. "Page 1" or common headers)
    max_len = max(len(norm_a), len(norm_b))
    if max_len < 35 and norm_a != norm_b:
        lexical = lexical * 0.4

    return max(0.0, min(1.0, lexical))


def calculate_semantic_similarity(
    norm_a: str,
    norm_b: str,
    vec_a: Optional[np.ndarray],
    vec_b: Optional[np.ndarray]
) -> float:
    """
    Calculates cosine similarity between document content embeddings.
    Only evaluates body text (not contaminated by filenames).
    """
    if not norm_a or not norm_b or len(norm_a) < 10 or len(norm_b) < 10:
        return 0.0

    if vec_a is None or vec_b is None:
        return 0.0

    try:
        dot = float(np.dot(vec_a, vec_b))
        return max(0.0, min(1.0, dot))
    except Exception as e:
        logger.warning(f"Failed to calculate embedding cosine similarity: {e}")
        return 0.0


def compare_file_pair(
    file_a: File,
    file_b: File,
    norm_a: str,
    norm_b: str,
    vec_a: Optional[np.ndarray],
    vec_b: Optional[np.ndarray]
) -> Optional[Dict[str, Any]]:
    """
    Compares two files using reliable multi-tier detection:
    Tier 1: Byte-for-byte SHA-256 match -> Exact duplicate (100%)
    Tier 2: Identical extracted text (different hashes) -> Identical text content (99%)
    Tier 3: Content similarity >= 85% -> Highly similar
    Tier 4: Content similarity >= 70% and < 85% -> Similar content
    Below 70% -> None (not a duplicate candidate)
    """
    # -------------------------------------------------------------
    # Tier 1: Byte-for-byte identical files (SHA-256 cryptographic match)
    # -------------------------------------------------------------
    hash_a = file_a.file_hash
    hash_b = file_b.file_hash

    # Ensure hashes exist if file is physically present
    if not hash_a and file_a.path and os.path.exists(file_a.path):
        hash_a = calculate_sha256(file_a.path)
        file_a.file_hash = hash_a
    if not hash_b and file_b.path and os.path.exists(file_b.path):
        hash_b = calculate_sha256(file_b.path)
        file_b.file_hash = hash_b

    is_hash_match = bool(hash_a and hash_b and hash_a.strip().lower() == hash_b.strip().lower())

    if is_hash_match:
        text_matches = (norm_a == norm_b)
        return {
            "detection_type": "Exact duplicate",
            "similarity": 100.0,
            "is_hash_match": True,
            "is_text_match": text_matches,
            "lexical_similarity": 100.0 if (norm_a and norm_b) else (100.0 if text_matches else None),
            "semantic_similarity": 100.0 if (vec_a is not None and vec_b is not None) else (100.0 if text_matches else None),
            "reason": "Identical file content at the byte level (verified SHA-256 hash match)."
        }

    # -------------------------------------------------------------
    # Tier 2: Different files with identical extracted text
    # -------------------------------------------------------------
    has_meaningful_text = bool(norm_a and norm_b and len(norm_a) >= 15 and len(norm_b) >= 15)
    is_text_match = bool(has_meaningful_text and norm_a == norm_b)

    if is_text_match:
        return {
            "detection_type": "Identical text content",
            "similarity": 99.0,
            "is_hash_match": False,
            "is_text_match": True,
            "lexical_similarity": 100.0,
            "semantic_similarity": 100.0 if (vec_a is not None and vec_b is not None) else None,
            "reason": "Extracted and normalized text content is identical, but file binary structure/metadata differs."
        }

    # -------------------------------------------------------------
    # Tier 3 & 4: Different content similarity calculation
    # -------------------------------------------------------------
    if not has_meaningful_text:
        # Neither file has enough extracted text to establish similarity
        return None

    lex_sim = calculate_lexical_similarity(norm_a, norm_b)
    has_embeddings = (vec_a is not None and vec_b is not None)
    sem_sim = calculate_semantic_similarity(norm_a, norm_b, vec_a, vec_b) if has_embeddings else 0.0

    # Hybrid content similarity: 55% lexical, 45% semantic
    if has_embeddings:
        combined = (0.55 * lex_sim + 0.45 * sem_sim) * 100.0
    else:
        combined = lex_sim * 100.0

    combined_score = round(combined, 1)

    # Different text must never claim 100%
    combined_score = min(98.5, combined_score)

    if combined_score >= 85.0:
        return {
            "detection_type": "Highly similar",
            "similarity": combined_score,
            "is_hash_match": False,
            "is_text_match": False,
            "lexical_similarity": round(lex_sim * 100.0, 1),
            "semantic_similarity": round(sem_sim * 100.0, 1) if has_embeddings else None,
            "reason": f"High content overlap ({lex_sim*100.0:.1f}% lexical, {sem_sim*100.0:.1f}% semantic)."
        }
    elif combined_score >= 70.0:
        return {
            "detection_type": "Similar content",
            "similarity": combined_score,
            "is_hash_match": False,
            "is_text_match": False,
            "lexical_similarity": round(lex_sim * 100.0, 1),
            "semantic_similarity": round(sem_sim * 100.0, 1) if has_embeddings else None,
            "reason": f"Moderate content overlap ({lex_sim*100.0:.1f}% lexical, {sem_sim*100.0:.1f}% semantic)."
        }

    # Below 70.0% is not considered a duplicate candidate
    return None


class DuplicateService:
    def find_and_record_duplicates(self, db: Session) -> List[DuplicateGroup]:
        """
        Scans all files in the database to detect:
        1. Exact SHA-256 byte duplicates (100%, 'Exact duplicate')
        2. Identical text content with different hashes (99%, 'Identical text content')
        3. High or moderate content similarity ('Highly similar', 'Similar content')
        
        Dynamically updates or invalidates stale duplicate groups in SQLite.
        """
        files = [f for f in db.query(File).all() if is_valid_user_file(f)]
        if len(files) < 2:
            # Clean up all groups if fewer than 2 valid files
            for dg in db.query(DuplicateGroup).all():
                db.delete(dg)
            try:
                db.commit()
            except Exception:
                db.rollback()
            return []

        valid_file_ids = set(f.id for f in files)
        file_map = {f.id: f for f in files}

        # Clean up orphan groups where file_a or file_b no longer exists
        all_db_groups = db.query(DuplicateGroup).all()
        for dg in all_db_groups:
            if dg.file_a_id not in valid_file_ids or dg.file_b_id not in valid_file_ids:
                db.delete(dg)
        db.commit()

        # Map existing groups by canonical pair key: (min_id, max_id)
        existing_groups = db.query(DuplicateGroup).all()
        existing_by_pair: Dict[Tuple[int, int], DuplicateGroup] = {}
        for dg in existing_groups:
            pair_key = (min(dg.file_a_id, dg.file_b_id), max(dg.file_a_id, dg.file_b_id))
            existing_by_pair[pair_key] = dg

        # Pre-process normalized text and embeddings for all files
        normalized_texts: Dict[int, str] = {}
        file_vectors: Dict[int, Optional[np.ndarray]] = {}
        texts_to_embed = []
        ids_to_embed = []

        for f in files:
            norm = normalize_extracted_text(f.extracted_text)
            normalized_texts[f.id] = norm

            # Embed only the pure text content (first 1500 chars), avoiding filename bias
            if norm and len(norm) >= 15:
                texts_to_embed.append(norm[:1500])
                ids_to_embed.append(f.id)
            else:
                file_vectors[f.id] = None

        if texts_to_embed:
            try:
                batch_vecs = embedding_service.embed_documents(texts_to_embed)
                for fid, vec in zip(ids_to_embed, batch_vecs):
                    file_vectors[fid] = vec
            except Exception as e:
                logger.warning(f"Batch embedding failed: {e}")
                for fid in ids_to_embed:
                    file_vectors[fid] = None

        active_pair_keys = set()
        file_ids = sorted(list(valid_file_ids))

        # Evaluate all pairwise combinations
        for i in range(len(file_ids)):
            for j in range(i + 1, len(file_ids)):
                id_a, id_b = file_ids[i], file_ids[j]
                file_a = file_map[id_a]
                file_b = file_map[id_b]
                pair_key = (id_a, id_b)

                norm_a = normalized_texts.get(id_a, "")
                norm_b = normalized_texts.get(id_b, "")
                vec_a = file_vectors.get(id_a)
                vec_b = file_vectors.get(id_b)

                comp_result = compare_file_pair(
                    file_a=file_a,
                    file_b=file_b,
                    norm_a=norm_a,
                    norm_b=norm_b,
                    vec_a=vec_a,
                    vec_b=vec_b
                )

                if comp_result is not None:
                    active_pair_keys.add(pair_key)
                    # Determine clean group key prefix
                    if comp_result["is_hash_match"]:
                        prefix = "exact"
                    elif comp_result["is_text_match"]:
                        prefix = "idtext"
                    else:
                        prefix = "similar"

                    group_key = f"{prefix}_{id_a}_{id_b}"

                    if pair_key in existing_by_pair:
                        # Update existing record in place
                        dg = existing_by_pair[pair_key]
                        dg.group_key = group_key
                        dg.detection_type = comp_result["detection_type"]
                        dg.similarity = comp_result["similarity"]
                        dg.is_hash_match = comp_result["is_hash_match"]
                        dg.is_text_match = comp_result["is_text_match"]
                        dg.lexical_similarity = comp_result["lexical_similarity"]
                        dg.semantic_similarity = comp_result["semantic_similarity"]
                        dg.reason = comp_result["reason"]
                    else:
                        # Create new record
                        dg = DuplicateGroup(
                            group_key=group_key,
                            file_a_id=id_a,
                            file_b_id=id_b,
                            detection_type=comp_result["detection_type"],
                            similarity=comp_result["similarity"],
                            status="unresolved",
                            is_hash_match=comp_result["is_hash_match"],
                            is_text_match=comp_result["is_text_match"],
                            lexical_similarity=comp_result["lexical_similarity"],
                            semantic_similarity=comp_result["semantic_similarity"],
                            reason=comp_result["reason"]
                        )
                        db.add(dg)
                        existing_by_pair[pair_key] = dg

        # Delete any existing groups that no longer qualify as duplicate candidates
        for pair_key, dg in list(existing_by_pair.items()):
            if pair_key not in active_pair_keys:
                logger.info(f"Invalidating stale duplicate group: {dg.group_key} (files no longer meet duplicate threshold)")
                db.delete(dg)
                del existing_by_pair[pair_key]

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error persisting duplicate groups: {e}")

        return list(existing_by_pair.values())


duplicate_service = DuplicateService()
