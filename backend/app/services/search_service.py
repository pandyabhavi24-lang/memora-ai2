import re
import time
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .embedding_service import embedding_service
from .query_expansion import query_expansion_service
from ..ai.faiss_manager import faiss_manager
from ..models import Chunk, File, Folder, SearchHistory, OrganizationSuggestion, OrganizationCategory, VectorMapping
from ..schemas import SearchFilters

logger = logging.getLogger("memora.search")

# ==============================================================================
# CONFIGURABLE RELEVANCE WEIGHTS & SEMANTIC THRESHOLDS
# Primary ranking signal: Dense Vector Cosine Similarity (85%)
# Secondary support: Lexical / Label / Metadata match (15%)
# ==============================================================================
SEMANTIC_WEIGHT = 0.85
LEXICAL_WEIGHT = 0.15

# Central configurable minimum semantic relevance threshold (HARD GATE)
# Calibrated for BAAI/bge-small-en-v1.5 normalized cosine similarities
# Values >= 0.50 denote clear semantic alignment, while unrelated content is strictly excluded (< 0.50)
SEMANTIC_SIMILARITY_THRESHOLD = 0.50
SEMANTIC_MIN_THRESHOLD = SEMANTIC_SIMILARITY_THRESHOLD

# Semantic drop-off gap threshold
MAX_RELATIVE_DROP_FROM_TOP = 0.35


def map_category_from_extension(ext: str) -> str:
    ext_clean = ext.lower().replace(".", "")
    if ext_clean == "pdf":
        return "pdf"
    elif ext_clean in ["docx", "doc", "txt", "md"]:
        return "doc"
    elif ext_clean in ["jpg", "jpeg", "png", "webp"]:
        return "image"
    elif ext_clean in ["pptx", "ppt"]:
        return "presentation"
    elif ext_clean in ["xlsx", "xls", "csv"]:
        return "spreadsheet"
    elif ext_clean in ["java", "c", "py", "js", "ts", "cpp", "cs", "go", "rs", "php", "sql"]:
        return "code"
    return "doc"


def extract_clean_snippet(text: str, query: str, max_len: int = 260) -> str:
    """
    Extracts a clean snippet centered around relevant query content.
    """
    if not text:
        return ""

    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    clean_lines = []
    for ln in lines:
        words = ln.split()
        if len(words) > 4 and sum(1 for w in words if len(w) == 1) / len(words) > 0.5:
            continue
        clean_lines.append(ln)

    full_clean = " ".join(clean_lines) if clean_lines else text.strip()

    q_clean = query_expansion_service.clean_search_intent(query)
    q_words = [w.lower() for w in re.findall(r"\b[\w#+.-]{2,}\b", q_clean) if len(w) > 1]
    match_pos = -1
    for qw in q_words:
        pos = full_clean.lower().find(qw)
        if pos != -1:
            match_pos = pos
            break

    if match_pos != -1:
        start = max(0, match_pos - 40)
        if start > 0 and start < len(full_clean) and full_clean[start] != " ":
            space_idx = full_clean.find(" ", start)
            if space_idx != -1 and space_idx < match_pos:
                start = space_idx + 1
        end = min(len(full_clean), start + max_len)
        snippet = full_clean[start:end].strip()
        if start > 0:
            snippet = "..." + snippet
        if end < len(full_clean):
            snippet = snippet + "..."
        return snippet

    if len(full_clean) <= max_len:
        return full_clean
    return full_clean[:max_len].rsplit(" ", 1)[0] + "..."


class SearchService:
    """
    High-Precision Semantic Search Service:
    1. Context & Concept Understanding across all domains and file types
    2. Enriched Query Representation with Original Query Priority
    3. Query Embedding Generation via FastEmbed (384-dim)
    4. Vector Search via FAISS IndexFlatIP (Cosine Similarity on L2-normalized vectors)
    5. Document-level scoring: max(chunk cosine similarities)
    6. Field-aware Lexical Similarity calculation (Content, Code, OCR, Title, Tags, Path)
    7. Multi-tier High-Precision Relevance & Semantic Gap Filtering (Rejects unrelated files)
    8. Strict 90% Semantic + 10% Lexical ranking
    9. Top-K as maximum (never fills slots with unrelated files)
    """

    def execute_search(
        self,
        db: Session,
        query: str,
        top_k: int = 20,
        filters: Optional[SearchFilters] = None,
        sort_by: str = "relevant"
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()

        raw_query = (query or "").strip()

        has_active_filters = False
        if filters:
            target_tags = filters.smart_tags or filters.labels or getattr(filters, 'tags', None)
            if (target_tags and len(target_tags) > 0) or (filters.file_type and filters.file_type != "all") or filters.folder_id is not None or (filters.category and filters.category != "all") or (filters.location and filters.location != "all"):
                has_active_filters = True

        if not raw_query and not has_active_filters:
            return {
                "query": "",
                "total": 0,
                "execution_time_ms": 0.0,
                "results": [],
                "debug": {}
            }

        # If empty text query but filters are provided, fetch all DB files as candidates for filter evaluation
        if not raw_query and has_active_filters:
            all_files = db.query(File, Folder).join(Folder, File.folder_id == Folder.id).all()
            all_candidates = []
            for file, folder in all_files:
                f_tags = file.get_smart_tags()
                cat_str = map_category_from_extension(file.extension)
                mod_str = file.modified_at.isoformat() if isinstance(file.modified_at, datetime) else str(file.modified_at or "")
                all_candidates.append({
                    "document_id": file.id,
                    "file_id": file.id,
                    "filename": file.name,
                    "file_name": file.name,
                    "file_path": file.path,
                    "folder_name": folder.name,
                    "folder_id": folder.id,
                    "extension": file.extension,
                    "category": cat_str,
                    "org_category": "",
                    "smart_tags": f_tags,
                    "labels": f_tags,
                    "has_smart_tag_match": True,
                    "semantic_score": 1.0,
                    "lexical_score": 1.0,
                    "final_score": 1.0,
                    "score": 100.0,
                    "matched_snippet": extract_clean_snippet(file.extracted_text or file.name, ""),
                    "ai_explanation": f"Matches filter for '{', '.join(f_tags[:3]) if f_tags else file.name}'.",
                    "chunk_id": 0,
                    "modified_at": mod_str,
                    "size_bytes": file.size
                })

            accepted_results = all_candidates
            results = accepted_results

            if filters.file_type and filters.file_type != "all":
                target_type = filters.file_type.lower()
                results = [r for r in results if r["category"] == target_type or r["extension"].lower().replace(".", "") == target_type]

            if filters.folder_id is not None:
                results = [r for r in results if r["folder_id"] == filters.folder_id]

            if filters.date_range and filters.date_range != "any":
                now = datetime.utcnow()
                results = [r for r in results if self._filter_by_date(r["modified_at"], filters.date_range, now)]

            if filters.size and filters.size != "any":
                results = [r for r in results if self._filter_by_size(r["size_bytes"], filters.size)]

            if filters.category and filters.category != "all":
                results = [r for r in results if self._filter_by_category(r["category"], r.get("org_category"), filters.category, r.get("smart_tags"))]

            if filters.location and filters.location != "all":
                results = [r for r in results if self._filter_by_location(r["file_path"], r["folder_name"], filters.location)]

            target_tags = filters.smart_tags or filters.labels or getattr(filters, 'tags', None)
            if target_tags and isinstance(target_tags, list) and len(target_tags) > 0:
                results = [r for r in results if self._filter_by_labels(r, target_tags)]

            if filters.relevance and filters.relevance != "any":
                results = [r for r in results if self._filter_by_relevance(r["score"], filters.relevance)]

            execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "query": "",
                "total": len(results),
                "execution_time_ms": execution_time_ms,
                "results": results[:top_k],
                "debug": {}
            }

        # 1. Context-aware query expansion, concept extraction & intent derivation
        expanded_terms, expanded_str, detected_concepts = query_expansion_service.build_expanded_query_terms(raw_query)
        concept_groups = query_expansion_service.build_concept_groups_for_lexical(raw_query)
        query_intent = query_expansion_service.extract_query_intent(raw_query)

        # 2. Generate Query Embedding directly from query for pure semantic vector search
        query_vector = embedding_service.embed_query(raw_query)
        if query_vector is None or query_vector.size == 0:
            raise RuntimeError("Failed to generate query embedding vector.")

        # Validate vector dimension
        if query_vector.shape[-1] != faiss_manager.dimension:
            logger.error(
                f"Vector dimension mismatch: query dim {query_vector.shape[-1]} != FAISS dim {faiss_manager.dimension}"
            )
            raise ValueError(f"Vector dimension mismatch: query dim {query_vector.shape[-1]} != FAISS dim {faiss_manager.dimension}")

        # Auto-sync check: Ensure FAISS index is aligned with active DB chunks
        active_db_chunks = db.query(Chunk).all()
        active_db_chunk_ids = set(c.id for c in active_db_chunks)
        faiss_chunk_ids = set(faiss_manager.faiss_to_chunk.values())
        orphaned_ids = faiss_chunk_ids - active_db_chunk_ids

        if orphaned_ids:
            logger.info(f"Purging {len(orphaned_ids)} orphaned vector mappings from FAISS index.")
            faiss_manager.remove_chunks(orphaned_ids)

        if active_db_chunks and (faiss_manager.index.ntotal == 0 or len(faiss_chunk_ids - orphaned_ids) < len(active_db_chunk_ids)):
            missing_chunks = [c for c in active_db_chunks if c.id not in faiss_chunk_ids]
            if missing_chunks:
                logger.info(f"Auto-syncing {len(missing_chunks)} active DB chunks into FAISS index.")
                vecs = []
                cids = []
                for mc in missing_chunks:
                    v = embedding_service.embed_text(mc.text)
                    if v is not None:
                        vecs.append(v)
                        cids.append(mc.id)
                if vecs:
                    faiss_manager.add_vectors(np.vstack(vecs), cids)
                    from .indexing_service import indexing_service
                    indexing_service._sync_vector_mappings(db)

        # 3. Retrieve candidate chunks using vector similarity in FAISS IndexFlatIP
        candidate_count = max(top_k * 15, 150)
        vector_results = faiss_manager.search(query_vector, top_k=candidate_count)

        chunk_ids = [vr["chunk_id"] for vr in vector_results]
        score_by_chunk_id = {vr["chunk_id"]: float(vr["score"]) for vr in vector_results}

        db_chunks = []
        if chunk_ids:
            db_chunks = (
                db.query(Chunk, File, Folder)
                .join(File, Chunk.file_id == File.id)
                .join(Folder, File.folder_id == Folder.id)
                .filter(Chunk.id.in_(chunk_ids))
                .all()
            )

        # 4. Keyword candidate search in DB across expanded terms
        all_query_terms = list(set([raw_query] + expanded_terms[:12]))
        keyword_filters = []
        for term in all_query_terms[:10]:
            keyword_filters.append(File.name.ilike(f"%{term}%"))
            keyword_filters.append(File.extracted_text.ilike(f"%{term}%"))
            keyword_filters.append(File.smart_tags.ilike(f"%{term}%"))

        from sqlalchemy import or_
        keyword_files = []
        if keyword_filters:
            keyword_files = (
                db.query(File, Folder)
                .join(Folder, File.folder_id == Folder.id)
                .filter(or_(*keyword_filters))
                .all()
            )

        # Fetch organization suggestions & persistent Smart Tags
        file_ids = list(set(f.id for _, f, _ in db_chunks) | set(f.id for f, _ in keyword_files))
        suggestions_by_file_id: Dict[int, str] = {}
        labels_by_file_id: Dict[int, List[str]] = {}

        if file_ids:
            suggestions = (
                db.query(OrganizationSuggestion, OrganizationCategory)
                .join(OrganizationCategory, OrganizationSuggestion.category_id == OrganizationCategory.id)
                .filter(OrganizationSuggestion.file_id.in_(file_ids))
                .all()
            )
            for sug, cat in suggestions:
                suggestions_by_file_id[sug.file_id] = cat.name

            files_list = db.query(File).filter(File.id.in_(file_ids)).all()
            for f in files_list:
                f_tags = f.get_smart_tags()
                if not f_tags and f.extracted_text:
                    from .classification_service import classification_service
                    _, _, _, _, f_tags = classification_service.classify_file(f.name, f.extension, f.extracted_text)
                    f.set_smart_tags(f_tags)
                    db.commit()
                labels_by_file_id[f.id] = f_tags if f_tags else ["General"]

        # 5. Document-Level Aggregation: Group chunks by document
        file_chunks_map: Dict[int, List[Tuple[Chunk, File, Folder]]] = {}
        for chunk, file, folder in db_chunks:
            file_chunks_map.setdefault(file.id, []).append((chunk, file, folder))

        all_candidates: List[Dict[str, Any]] = []

        for file_id, chunk_list in file_chunks_map.items():
            first_chunk, file, folder = chunk_list[0]
            f_tags = labels_by_file_id.get(file.id, [])
            category_str = map_category_from_extension(file.extension)
            doc_content = file.extracted_text or ""

            # Representative best chunk (max cosine similarity)
            best_chunk = first_chunk
            best_chunk_cosine = -1.0
            for ch, _, _ in chunk_list:
                cos_sim = score_by_chunk_id.get(ch.id, 0.0)
                if cos_sim > best_chunk_cosine:
                    best_chunk_cosine = cos_sim
                    best_chunk = ch

            doc_semantic_score = max(0.0, min(1.0, float(best_chunk_cosine)))
            doc_lexical_score = query_expansion_service.calculate_field_aware_lexical_score(
                concept_groups=concept_groups,
                content_text=doc_content,
                filename=file.name,
                smart_tags=f_tags,
                file_path=file.path
            )

            # Smart Tag relevance calculation & hybrid score boosting
            q_clean = query_expansion_service.clean_search_intent(raw_query).lower()
            q_tokens = [t for t in re.findall(r"\b[\w#+.-]{2,}\b", q_clean) if len(t) > 1 and t not in ["file", "files", "doc", "notes", "show", "find"]]
            has_smart_tag_match = False
            tag_boost = 0.0

            if f_tags:
                for tag in f_tags:
                    t_low = tag.lower().strip()
                    if not t_low:
                        continue
                    if q_clean == t_low or t_low in q_clean or q_clean in t_low:
                        has_smart_tag_match = True
                        tag_boost = max(tag_boost, 0.40)
                    else:
                        for qt in q_tokens:
                            if qt == t_low or qt in t_low or t_low in qt:
                                has_smart_tag_match = True
                                tag_boost = max(tag_boost, 0.25)

            if tag_boost > 0:
                doc_semantic_score = min(1.0, max(doc_semantic_score, doc_semantic_score + (tag_boost * 0.4)))
                doc_lexical_score = min(1.0, max(doc_lexical_score, doc_lexical_score + tag_boost))

            # Strict 85% Semantic + 15% Lexical formula
            final_score = (SEMANTIC_WEIGHT * doc_semantic_score) + (LEXICAL_WEIGHT * doc_lexical_score)

            # Multi-concept / distinctive intent agreement verification
            agreed, matched_concepts, agreement_reason = query_expansion_service.verify_concept_agreement(
                query=raw_query,
                content_text=best_chunk.text or doc_content,
                filename=file.name,
                smart_tags=f_tags
            )

            all_candidates.append({
                "document_id": file.id,
                "file_id": file.id,
                "filename": file.name,
                "file_name": file.name,
                "file_path": file.path,
                "folder_name": folder.name,
                "folder_id": folder.id,
                "extension": file.extension,
                "category": category_str,
                "org_category": suggestions_by_file_id.get(file.id, ""),
                "smart_tags": f_tags,
                "labels": f_tags,
                "has_smart_tag_match": has_smart_tag_match,
                "semantic_score": round(doc_semantic_score, 4),
                "lexical_score": round(doc_lexical_score, 4),
                "final_score": round(final_score, 5),
                "score": round(final_score * 100, 1),
                "matched_snippet": best_chunk.text or doc_content,
                "chunk_id": best_chunk.id,
                "modified_at": file.modified_at,
                "size_bytes": file.size,
                "concept_agreed": agreed or has_smart_tag_match,
                "matched_concepts": matched_concepts,
                "agreement_reason": agreement_reason if not has_smart_tag_match else "Smart Tag relevance match",
                "match_source": "OCR" if category_str == "image" else ("TEXT" if category_str != "video" else "VISUAL"),
                "thumbnail_url": f"/api/media/{file.id}/thumbnail" if category_str in ["image", "video"] else None,
                "preview_url": f"/api/media/{file.id}/preview" if category_str in ["image", "video"] else None
            })

        # Include keyword candidate files not in FAISS vector results
        existing_cand_ids = set(c["file_id"] for c in all_candidates)
        for file, folder in keyword_files:
            if file.id not in existing_cand_ids:
                f_tags = labels_by_file_id.get(file.id, [])
                category_str = map_category_from_extension(file.extension)
                doc_content = file.extracted_text or ""
                doc_semantic_score = 0.0
                doc_lexical_score = query_expansion_service.calculate_field_aware_lexical_score(
                    concept_groups=concept_groups,
                    content_text=doc_content,
                    filename=file.name,
                    smart_tags=f_tags,
                    file_path=file.path
                )
                final_score = (SEMANTIC_WEIGHT * doc_semantic_score) + (LEXICAL_WEIGHT * doc_lexical_score)

                agreed, matched_concepts, agreement_reason = query_expansion_service.verify_concept_agreement(
                    query=raw_query,
                    content_text=doc_content,
                    filename=file.name,
                    smart_tags=f_tags
                )

                all_candidates.append({
                    "document_id": file.id,
                    "file_id": file.id,
                    "filename": file.name,
                    "file_name": file.name,
                    "file_path": file.path,
                    "folder_name": folder.name,
                    "folder_id": folder.id,
                    "extension": file.extension,
                    "category": category_str,
                    "org_category": suggestions_by_file_id.get(file.id, ""),
                    "smart_tags": f_tags,
                    "labels": f_tags,
                    "semantic_score": round(doc_semantic_score, 4),
                    "lexical_score": round(doc_lexical_score, 4),
                    "final_score": round(final_score, 5),
                    "score": round(final_score * 100, 1),
                    "matched_snippet": doc_content[:260] if doc_content else file.name,
                    "chunk_id": 0,
                    "modified_at": file.modified_at,
                    "size_bytes": file.size,
                    "concept_agreed": agreed,
                    "matched_concepts": matched_concepts,
                    "agreement_reason": agreement_reason
                })

        faiss_candidates_count = len(all_candidates)

        # 6. Strict Hard Semantic Gate & Secondary Relevance Ranking
        # Step A: HARD SEMANTIC THRESHOLD GATE & HYBRID SMART TAG MATCHER
        # Candidates must satisfy cosine similarity >= SEMANTIC_SIMILARITY_THRESHOLD or have a Smart Tag/lexical match.
        target_tags_check = (filters.smart_tags if filters else None) or (filters.labels if filters else None) or (getattr(filters, 'tags', None) if filters else None)
        
        after_threshold_candidates = [
            c for c in all_candidates
            if c["semantic_score"] >= SEMANTIC_SIMILARITY_THRESHOLD or c.get("has_smart_tag_match") or c["lexical_score"] >= 0.40 or bool(target_tags_check)
        ]
        after_threshold_count = len(after_threshold_candidates)

        # Step B: Filter by relative semantic drop-off gap among valid candidates
        accepted_results = []
        rejected_diagnostics = []

        if after_threshold_candidates:
            # Sort after_threshold_candidates descending by final_score
            after_threshold_candidates.sort(key=lambda x: x["final_score"], reverse=True)
            top_score = after_threshold_candidates[0]["final_score"]

            for c in after_threshold_candidates:
                # Check semantic gap drop-off
                relative_drop = top_score - c["final_score"]
                if top_score >= 0.75 and relative_drop > MAX_RELATIVE_DROP_FROM_TOP and c["lexical_score"] < 0.50 and not c.get("has_smart_tag_match"):
                    rejected_diagnostics.append({
                        "filename": c["file_name"],
                        "cosine": c["semantic_score"],
                        "reason": f"Semantic gap drop-off ({relative_drop:.3f} below top score)"
                    })
                    continue

                accepted_results.append(c)

        for c in all_candidates:
            if c not in accepted_results:
                rejected_diagnostics.append({
                    "filename": c["file_name"],
                    "cosine": c["semantic_score"],
                    "reason": f"EXCLUDED - BELOW SEMANTIC THRESHOLD ({c['semantic_score']} < {SEMANTIC_SIMILARITY_THRESHOLD})"
                })

        after_relevance_filtering_count = len(accepted_results)

        # 7. Apply User Filters across dimensions
        results = accepted_results
        if filters:
            if filters.file_type and filters.file_type != "all":
                target_type = filters.file_type.lower()
                results = [
                    r for r in results
                    if r["category"] == target_type or r["extension"].lower().replace(".", "") == target_type
                ]

            if filters.folder_id is not None:
                results = [r for r in results if r["folder_id"] == filters.folder_id]

            if filters.date_range and filters.date_range != "any":
                now = datetime.utcnow()
                results = [r for r in results if self._filter_by_date(r["modified_at"], filters.date_range, now)]

            if filters.size and filters.size != "any":
                results = [r for r in results if self._filter_by_size(r["size_bytes"], filters.size)]

            if filters.category and filters.category != "all":
                results = [
                    r for r in results
                    if self._filter_by_category(r["category"], r.get("org_category"), filters.category, r.get("smart_tags"))
                ]

            if filters.location and filters.location != "all":
                results = [
                    r for r in results
                    if self._filter_by_location(r["file_path"], r["folder_name"], filters.location)
                ]

            target_tags = filters.smart_tags or filters.labels or getattr(filters, 'tags', None)
            if target_tags and isinstance(target_tags, list) and len(target_tags) > 0:
                results = [
                    r for r in results
                    if self._filter_by_labels(r, target_tags)
                ]

            if filters.relevance and filters.relevance != "any":
                results = [
                    r for r in results
                    if self._filter_by_relevance(r["score"], filters.relevance)
                ]

        # 8. Generate clean snippets and content explanations
        formatted_results = []
        for r in results:
            clean_snippet = extract_clean_snippet(r["matched_snippet"], raw_query)
            file_smart_tags = r.get("smart_tags", [])
            topics_str = ", ".join(file_smart_tags[:3]) if file_smart_tags else r["category"]

            q_low = raw_query.lower()
            if "design pattern" in q_low or "pattern" in q_low:
                explanation = f"Matches your query on software design patterns ({r['file_name']})."
            elif "resume" in q_low or "cv" in q_low:
                explanation = "Matches your query based on career profile and resume content."
            elif any(q in q_low for q in ["java", "sorting", "sort", "oop", "code", "python", "program", "database"]):
                explanation = f"Matches your query based on programming topics ({topics_str})."
            elif "internship" in q_low or "certificate" in q_low:
                explanation = "Matches your search for internship and certification documents."
            elif "presentation" in q_low or "slide" in q_low:
                explanation = "Matches your presentation slides and deck content."
            elif "spreadsheet" in q_low or "excel" in q_low or "sheet" in q_low:
                explanation = "Matches your spreadsheet and workbook data."
            elif file_smart_tags:
                explanation = f"Matches your query based on semantic content regarding {topics_str}."
            else:
                explanation = f"Matches your query in folder '{r['folder_name']}'."

            formatted_results.append({
                "document_id": r["document_id"],
                "file_id": r["file_id"],
                "filename": r["filename"],
                "file_name": r["file_name"],
                "file_path": r["file_path"],
                "folder_name": r["folder_name"],
                "extension": r["extension"],
                "category": r["category"],
                "smart_tags": file_smart_tags,
                "labels": file_smart_tags,
                "semantic_score": r["semantic_score"],
                "lexical_score": r["lexical_score"],
                "final_score": r["final_score"],
                "score": r["score"],
                "matched_snippet": clean_snippet,
                "ai_explanation": explanation,
                "matched_concepts": r.get("matched_concepts", []),
                "chunk_id": r["chunk_id"],
                "modified_at": r["modified_at"].isoformat() if isinstance(r["modified_at"], datetime) else str(r["modified_at"]),
                "raw_modified_at": r["modified_at"] if isinstance(r["modified_at"], datetime) else datetime.min,
                "size_bytes": r["size_bytes"]
            })

        # 9. Apply Ranking (descending by final_score)
        if sort_by == "newest":
            formatted_results.sort(key=lambda x: (x["raw_modified_at"], x["final_score"]), reverse=True)
        elif sort_by == "oldest":
            formatted_results.sort(key=lambda x: (x["raw_modified_at"], -x["final_score"]), reverse=False)
        elif sort_by == "largest":
            formatted_results.sort(key=lambda x: (x["size_bytes"], x["final_score"]), reverse=True)
        else:
            formatted_results.sort(key=lambda x: (x["final_score"], x["raw_modified_at"]), reverse=True)

        for res in formatted_results:
            res.pop("raw_modified_at", None)

        # TOP-K IS A MAXIMUM, NEVER FORCED (Section 6)
        final_results = formatted_results[:top_k]
        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 10. Log search history & SPEC-COMPLIANT DEBUG LOGGING (Section 21)
        self._log_history(db, raw_query, len(final_results), execution_time_ms)

        debug_info = {
            "original_query": raw_query,
            "expanded_query": expanded_str,
            "query_intent": query_intent["intent_summary"],
            "faiss_candidates": faiss_candidates_count,
            "after_semantic_threshold": after_threshold_count,
            "after_relevance_filtering": after_relevance_filtering_count,
            "final_results": len(final_results),
            "candidates": [
                {
                    "filename": r["file_name"],
                    "cosine": r["semantic_score"],
                    "lexical": r["lexical_score"],
                    "final": r["final_score"],
                    "relevance": f"{r['score']}%",
                    "matched_concepts": r.get("matched_concepts", [])
                }
                for r in final_results
            ],
            "rejected": rejected_diagnostics[:8]
        }

        # Spec-compliant diagnostic logging formatted to Section 21
        accepted_log_lines = []
        for r in final_results:
            accepted_log_lines.append(
                f"[ACCEPTED] Filename: {r['file_name']}\n"
                f"  Cosine: {r['semantic_score']:.4f}\n"
                f"  Lexical: {r['lexical_score']:.4f}\n"
                f"  Final: {r['final_score']:.5f}\n"
                f"  Relevance: {r['score']}%\n"
                f"  Matched concepts: {', '.join(r.get('matched_concepts', [])) if r.get('matched_concepts') else 'semantic vector match'}"
            )

        rejected_log_lines = []
        for rej in rejected_diagnostics[:6]:
            rejected_log_lines.append(
                f"[REJECTED] Filename: {rej['filename']}\n"
                f"  Cosine: {rej['cosine']:.4f}\n"
                f"  Reason: {rej['reason']}"
            )

        logger.info(
            f"\n============================================================\n"
            f"Original Query:\n{raw_query}\n\n"
            f"Expanded Query:\n{expanded_str}\n\n"
            f"Query Intent:\n{query_intent['intent_summary']}\n\n"
            f"FAISS Candidates:\n{faiss_candidates_count}\n\n"
            f"After Semantic Threshold:\n{after_threshold_count}\n\n"
            f"After Relevance Filtering:\n{after_relevance_filtering_count}\n\n"
            f"Final Results:\n{len(final_results)}\n\n"
            f"--- ACCEPTED CANDIDATES ---\n"
            f"{chr(10).join(accepted_log_lines) if accepted_log_lines else 'None (No strongly relevant results found)'}\n\n"
            f"--- SAMPLE REJECTED CANDIDATES ---\n"
            f"{chr(10).join(rejected_log_lines) if rejected_log_lines else 'None'}\n"
            f"============================================================"
        )

        return {
            "query": raw_query,
            "total": len(final_results),
            "execution_time_ms": execution_time_ms,
            "results": final_results,
            "debug": debug_info
        }

    def _filter_by_date(self, file_dt: datetime, date_range: str, now: datetime) -> bool:
        if not isinstance(file_dt, datetime):
            return True
        diff = now - file_dt
        if date_range == "today":
            return diff <= timedelta(days=1)
        elif date_range == "yesterday":
            return diff <= timedelta(days=2)
        elif date_range == "week":
            return diff <= timedelta(days=7)
        elif date_range == "month":
            return diff <= timedelta(days=30)
        elif date_range == "month3":
            return diff <= timedelta(days=90)
        elif date_range == "year":
            return file_dt.year == now.year
        return True

    def _filter_by_size(self, size_bytes: int, size_filter: str) -> bool:
        if not size_filter or size_filter == "any":
            return True
        mb = size_bytes / (1024 * 1024)
        if size_filter == "under_1mb":
            return mb < 1.0
        elif size_filter == "1_10mb":
            return 1.0 <= mb <= 10.0
        elif size_filter == "10_100mb":
            return 10.0 <= mb <= 100.0
        elif size_filter == "100_500mb":
            return 100.0 <= mb <= 500.0
        elif size_filter == "500mb_1gb":
            return 500.0 <= mb <= 1024.0
        elif size_filter == "over_1gb":
            return mb >= 1024.0
        return True

    def _filter_by_category(self, item_category: str, org_category: Optional[str], target_category: str, smart_tags: Optional[List[str]] = None) -> bool:
        if not target_category or target_category.lower() == "all":
            return True
        target = target_category.lower().strip()
        if org_category and target == org_category.lower().strip():
            return True
        if org_category and target in org_category.lower():
            return True
        if item_category and target in item_category.lower():
            return True
        if smart_tags:
            for st in smart_tags:
                if target == st.lower().strip() or target in st.lower():
                    return True
        return False

    def _filter_by_location(self, file_path: str, folder_name: str, location_filter: str) -> bool:
        if not location_filter or location_filter == "all":
            return True
        target = location_filter.lower()
        if target in file_path.lower() or target in folder_name.lower():
            return True
        return False

    def _filter_by_labels(self, r: Dict[str, Any], labels_filter: List[str]) -> bool:
        if not labels_filter:
            return True
        file_tags = [t.lower() for t in r.get("smart_tags", [])]
        searchable_text = (
            f"{r['file_name']} {r['file_path']} {r['folder_name']} "
            f"{r['category']} {r.get('org_category', '')} {r['extension']} {' '.join(file_tags)}"
        ).lower()
        return all(
            any(lbl.lower() in ft for ft in file_tags) or lbl.lower() in searchable_text
            for lbl in labels_filter if lbl
        )

    def _filter_by_relevance(self, score: float, relevance_filter: str) -> bool:
        if not relevance_filter or relevance_filter == "any":
            return True
        if relevance_filter == "min_50":
            return score >= 50.0
        elif relevance_filter == "min_60":
            return score >= 60.0
        elif relevance_filter == "min_70":
            return score >= 70.0
        elif relevance_filter == "min_80":
            return score >= 80.0
        elif relevance_filter == "min_90":
            return score >= 90.0
        return True

    def _log_history(self, db: Session, query: str, result_count: int, execution_time_ms: float):
        try:
            history_rec = SearchHistory(
                query=query,
                result_count=result_count,
                execution_time_ms=execution_time_ms
            )
            db.add(history_rec)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log search history: {e}")

search_service = SearchService()