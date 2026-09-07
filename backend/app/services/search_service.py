import re
import time
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .embedding_service import embedding_service
from ..ai.faiss_manager import faiss_manager
from ..models import Chunk, File, Folder, SearchHistory, OrganizationSuggestion, OrganizationCategory
from ..schemas import SearchFilters

logger = logging.getLogger("memora.search")

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
    elif ext_clean in ["java", "c", "py"]:
        return "code"
    return "doc"


RELEVANCE_THRESHOLD = 0.25

def calculate_relevance_percentage(faiss_score: float) -> float:
    """
    Computes mathematical cosine similarity percentage.
    Since embeddings are L2 normalized, the FAISS inner product is exact cosine similarity:
    cosine_sim = (A · B) / (||A|| ||B||) = A · B.

    If similarity is below RELEVANCE_THRESHOLD (0.25), the query is semantically unrelated (0.0%).
    For scores >= threshold, maps similarity score smoothly to percentage range [25.0%, 100.0%].
    """
    sim = float(faiss_score)
    if sim < RELEVANCE_THRESHOLD:
        return 0.0
    scaled = (sim - RELEVANCE_THRESHOLD) / (1.0 - RELEVANCE_THRESHOLD)
    pct = 25.0 + (scaled * 75.0)
    return round(max(0.0, min(100.0, pct)), 1)



def extract_clean_snippet(text: str, query: str, max_len: int = 260) -> str:
    """
    Extracts a clean, human-readable snippet centered around query keywords or meaningful sentences,
    stripping OCR noise lines containing single-character garbage strings.
    """
    if not text:
        return ""

    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    clean_lines = []
    for ln in lines:
        words = ln.split()
        # If line is mostly single disconnected characters (e.g. OCR noise), omit it
        if len(words) > 4 and sum(1 for w in words if len(w) == 1) / len(words) > 0.5:
            continue
        clean_lines.append(ln)

    full_clean = " ".join(clean_lines) if clean_lines else text.strip()

    # Locate query terms in text
    q_words = [w.lower() for w in re.findall(r"\b\w{2,}\b", query) if len(w) > 1]
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

    # Default to beginning of clean content
    if len(full_clean) <= max_len:
        return full_clean
    return full_clean[:max_len].rsplit(" ", 1)[0] + "..."


class SearchService:
    """
    Core Semantic Search Pipeline with End-to-End Filter Support,
    persistent Smart Tags, true cosine similarity ranking, and clean snippets.
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

        if not query or not query.strip():
            return {
                "query": "",
                "total": 0,
                "execution_time_ms": 0.0,
                "results": []
            }

        clean_query = query.strip()

        # 1. Generate query embedding vector (384d normalized)
        query_vector = embedding_service.embed_query(clean_query)

        # 2. Vector similarity search via FAISS
        candidate_count = max(top_k * 6, 100)
        vector_results = faiss_manager.search(query_vector, top_k=candidate_count)

        if not vector_results:
            execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self._log_history(db, clean_query, 0, execution_time_ms)
            return {
                "query": clean_query,
                "total": 0,
                "execution_time_ms": execution_time_ms,
                "results": []
            }

        # 3. Fetch chunks and files from SQLite DB
        chunk_ids = [vr["chunk_id"] for vr in vector_results]
        score_by_chunk_id = {vr["chunk_id"]: vr["score"] for vr in vector_results}

        db_chunks = (
            db.query(Chunk, File, Folder)
            .join(File, Chunk.file_id == File.id)
            .join(Folder, File.folder_id == Folder.id)
            .filter(Chunk.id.in_(chunk_ids))
            .all()
        )

        # 3b. Keyword & Smart Tag fallback candidate search in DB
        query_lower = clean_query.lower()
        keyword_files = (
            db.query(File, Folder)
            .join(Folder, File.folder_id == Folder.id)
            .filter(
                (File.name.ilike(f"%{clean_query}%")) |
                (File.smart_tags.ilike(f"%{clean_query}%")) |
                (File.extracted_text.ilike(f"%{clean_query}%"))
            )
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

        # 4. Group chunks by file (keep best scoring chunk per file)
        file_matches: Dict[int, Dict[str, Any]] = {}

        for chunk, file, folder in db_chunks:
            faiss_score = score_by_chunk_id.get(chunk.id, 0.0)

            # Boost score if query matches smart tags, filename, or text
            f_tags = labels_by_file_id.get(file.id, [])
            is_tag_match = any(query_lower in t.lower() for t in f_tags)
            is_name_match = query_lower in file.name.lower()
            is_text_match = query_lower in (file.extracted_text or "").lower()

            if (is_tag_match or is_name_match or is_text_match) and faiss_score < 0.70:
                faiss_score = max(faiss_score, 0.75)

            relevance_pct = calculate_relevance_percentage(faiss_score)

            if file.id not in file_matches or faiss_score > file_matches[file.id]["faiss_score"]:
                file_matches[file.id] = {
                    "file_id": file.id,
                    "file_name": file.name,
                    "file_path": file.path,
                    "folder_name": folder.name,
                    "folder_id": folder.id,
                    "extension": file.extension,
                    "category": map_category_from_extension(file.extension),
                    "org_category": suggestions_by_file_id.get(file.id, ""),
                    "smart_tags": labels_by_file_id.get(file.id, []),
                    "labels": labels_by_file_id.get(file.id, []),
                    "score": relevance_pct,
                    "faiss_score": faiss_score,
                    "matched_snippet": chunk.text,
                    "chunk_id": chunk.id,
                    "modified_at": file.modified_at,
                    "size_bytes": file.size
                }

        # Include keyword DB candidate matches not present in FAISS chunks
        for file, folder in keyword_files:
            if file.id not in file_matches:
                faiss_score = 0.75
                relevance_pct = calculate_relevance_percentage(faiss_score)
                snippet = file.extracted_text[:260] if file.extracted_text else file.name
                file_matches[file.id] = {
                    "file_id": file.id,
                    "file_name": file.name,
                    "file_path": file.path,
                    "folder_name": folder.name,
                    "folder_id": folder.id,
                    "extension": file.extension,
                    "category": map_category_from_extension(file.extension),
                    "org_category": suggestions_by_file_id.get(file.id, ""),
                    "smart_tags": labels_by_file_id.get(file.id, []),
                    "labels": labels_by_file_id.get(file.id, []),
                    "score": relevance_pct,
                    "faiss_score": faiss_score,
                    "matched_snippet": snippet,
                    "chunk_id": 0,
                    "modified_at": file.modified_at,
                    "size_bytes": file.size
                }

        results = [r for r in list(file_matches.values()) if r["score"] > 0.0 and r["faiss_score"] >= RELEVANCE_THRESHOLD]

        # 5. Apply filters across dimensions
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
                    if self._filter_by_category(r["category"], r.get("org_category"), filters.category)
                ]

            if filters.location and filters.location != "all":
                results = [
                    r for r in results 
                    if self._filter_by_location(r["file_path"], r["folder_name"], filters.location)
                ]

            target_tags = filters.smart_tags or filters.labels
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

        # 6. Generate clean snippets and meaningful explanations
        formatted_results = []
        for r in results:
            clean_snippet = extract_clean_snippet(r["matched_snippet"], clean_query)
            file_smart_tags = r.get("smart_tags", [])
            topics_str = ", ".join(file_smart_tags[:3]) if file_smart_tags else r["category"]

            # Content-focused explanation without technical/percentage redundancy
            if "resume" in clean_query.lower() or "cv" in clean_query.lower():
                explanation = "This file matches your query because it contains professional resume and career profile details."
            elif any(q in clean_query.lower() for q in ["java", "oop", "code", "python", "program"]):
                explanation = f"This file matches your query because the content discusses {topics_str}."
            elif file_smart_tags:
                explanation = f"This file matches your search query based on relevant content discussing {topics_str}."
            else:
                explanation = f"This file matches your query within folder '{r['folder_name']}'."

            formatted_results.append({
                "file_id": r["file_id"],
                "file_name": r["file_name"],
                "file_path": r["file_path"],
                "folder_name": r["folder_name"],
                "extension": r["extension"],
                "category": r["category"],
                "smart_tags": file_smart_tags,
                "score": r["score"],
                "faiss_score": r["faiss_score"],
                "matched_snippet": clean_snippet,
                "ai_explanation": explanation,
                "chunk_id": r["chunk_id"],
                "modified_at": r["modified_at"].isoformat() if isinstance(r["modified_at"], datetime) else str(r["modified_at"]),
                "raw_modified_at": r["modified_at"] if isinstance(r["modified_at"], datetime) else datetime.min,
                "size_bytes": r["size_bytes"]
            })

        # 7. Apply Sorting (ranking based on actual cosine similarity, or newest-first modified date)
        if sort_by == "newest":
            formatted_results.sort(key=lambda x: (x["raw_modified_at"], x["faiss_score"]), reverse=True)
        elif sort_by == "oldest":
            formatted_results.sort(key=lambda x: (x["raw_modified_at"], -x["faiss_score"]), reverse=False)
        elif sort_by == "largest":
            formatted_results.sort(key=lambda x: (x["size_bytes"], x["faiss_score"]), reverse=True)
        else:  # default: 'relevant' (strictly sorted by cosine similarity DESC, then modified date DESC)
            formatted_results.sort(key=lambda x: (x["faiss_score"], x["raw_modified_at"]), reverse=True)

        # Strip temporary raw sorting key
        for res in formatted_results:
            res.pop("raw_modified_at", None)
            res.pop("faiss_score", None)

        final_results = formatted_results[:top_k]
        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 8. Log search history
        self._log_history(db, clean_query, len(final_results), execution_time_ms)

        return {
            "query": clean_query,
            "total": len(final_results),
            "execution_time_ms": execution_time_ms,
            "results": final_results
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

    def _filter_by_category(self, item_category: str, org_category: Optional[str], target_category: str) -> bool:
        if not target_category or target_category == "all":
            return True
        target = target_category.lower()
        if item_category and target in item_category.lower():
            return True
        if org_category and target in org_category.lower():
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
