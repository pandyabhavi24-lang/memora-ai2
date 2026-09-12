import os
import json
import logging
import numpy as np
import faiss

logger = logging.getLogger("memora.visual_faiss")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
DOCUMENT_AND_CODE_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".txt", ".rtf", ".ppt", ".pptx", ".xls", ".xlsx",
    ".csv", ".java", ".py", ".js", ".ts", ".html", ".css", ".json", ".xml", ".sql"
}

class VisualFAISSManager:
    """
    Dedicated FAISS Vector Store for Module 3 (Visual & Media Intelligence).
    Maintains an IndexFlatIP (384-dim) for normalized local sentence-transformer embeddings.
    Strictly isolated to Image and Video non-document visual media.
    """
    def __init__(self, data_dir: str = None, dimension: int = 384):
        if data_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            data_dir = os.path.join(base_dir, "data", "faiss")
        
        self.data_dir = data_dir
        self.dimension = dimension
        self.index_path = os.path.join(self.data_dir, "visual_index.faiss")
        self.map_path = os.path.join(self.data_dir, "visual_id_map.json")

        os.makedirs(self.data_dir, exist_ok=True)

        self.index = None
        # visual_faiss_id (int) -> dict: {"file_id": int, "media_type": str}
        self.faiss_to_file = {}
        self.next_faiss_id = 0

        self.load_or_create()

    def load_or_create(self):
        """Loads existing visual FAISS index & id mapping, or initializes fresh index."""
        if os.path.exists(self.index_path) and os.path.exists(self.map_path):
            try:
                loaded_index = faiss.read_index(self.index_path)
                if loaded_index.d == self.dimension:
                    self.index = loaded_index
                    with open(self.map_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        raw_map = data.get("faiss_to_file", {})
                        self.faiss_to_file = {}
                        for k, v in raw_map.items():
                            if isinstance(v, dict):
                                self.faiss_to_file[int(k)] = {
                                    "file_id": int(v.get("file_id", 0)),
                                    "media_type": v.get("media_type", "image")
                                }
                            else:
                                self.faiss_to_file[int(k)] = {
                                    "file_id": int(v),
                                    "media_type": "image"
                                }
                        self.next_faiss_id = data.get("next_faiss_id", self.index.ntotal)
                    logger.info(f"Loaded existing Visual FAISS index with {self.index.ntotal} media vectors ({self.dimension}d).")
                    return
                else:
                    logger.info(f"Visual FAISS index dimension mismatch ({loaded_index.d} != {self.dimension}). Re-initializing index.")
            except Exception as e:
                logger.error(f"Error loading Visual FAISS index: {e}. Re-initializing new visual index.", exc_info=True)

        logger.info(f"Initializing new Visual FAISS IndexFlatIP ({self.dimension}d).")
        self.index = faiss.IndexFlatIP(self.dimension)
        self.faiss_to_file = {}
        self.next_faiss_id = 0
        self.save()

    def save(self):
        """Persists visual FAISS index and mapping file to disk."""
        try:
            faiss.write_index(self.index, self.index_path)
            data = {
                "faiss_to_file": {str(k): v for k, v in self.faiss_to_file.items()},
                "next_faiss_id": self.next_faiss_id
            }
            with open(self.map_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Persisted Visual FAISS index ({self.index.ntotal} vectors) to disk.")
        except Exception as e:
            logger.error(f"Failed to save Visual FAISS index: {e}", exc_info=True)

    def add_vector(self, vector: np.ndarray, file_id: int, media_type: str = "image", extension: str = "") -> int:
        """
        Adds a single normalized visual vector (shape: 384,) to Visual FAISS.
        Strictly excludes documents/code and accepts only image and video media.
        Returns assigned visual_faiss_id.
        """
        if extension:
            ext_low = extension.lower().strip()
            if ext_low in DOCUMENT_AND_CODE_EXTENSIONS:
                raise ValueError(f"Documents ({ext_low}) are strictly prohibited from Module 3 visual FAISS index.")

        if media_type not in ["image", "video"]:
            raise ValueError(f"Invalid media_type '{media_type}'. Visual FAISS only accepts 'image' or 'video'.")

        if vector is None or vector.size == 0:
            raise ValueError("Cannot add empty vector to Visual FAISS")

        if len(vector.shape) == 1:
            vector = vector.reshape(1, -1)

        vector = vector.astype(np.float32)

        if vector.shape[1] != self.dimension:
            raise ValueError(f"Vector dimension mismatch: expected {self.dimension}, got {vector.shape[1]}")

        # Ensure vector is L2 normalized
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        faiss_id = self.index.ntotal
        self.index.add(vector)
        self.faiss_to_file[faiss_id] = {
            "file_id": file_id,
            "media_type": media_type
        }
        self.next_faiss_id = self.index.ntotal
        self.save()
        return faiss_id

    def search_similar(self, query_vector: np.ndarray, top_k: int = 10) -> list[dict]:
        """
        Searches Visual FAISS index for top_k closest visual embeddings.
        Returns list of dicts: [{'faiss_id': int, 'file_id': int, 'similarity': float}]
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        if len(query_vector.shape) == 1:
            query_vector = query_vector.reshape(1, -1)

        query_vector = query_vector.astype(np.float32)
        norm = np.linalg.norm(query_vector, axis=1, keepdims=True)
        norm[norm == 0] = 1e-10
        query_vector = query_vector / norm

        actual_k = min(top_k, self.index.ntotal)
        distances, indices = self.index.search(query_vector, actual_k)

        results = []
        for d, idx in zip(distances[0], indices[0]):
            if idx in self.faiss_to_file:
                val = self.faiss_to_file[idx]
                fid = val["file_id"] if isinstance(val, dict) else int(val)
                m_type = val.get("media_type", "image") if isinstance(val, dict) else "image"
                results.append({
                    "faiss_id": int(idx),
                    "file_id": fid,
                    "media_type": m_type,
                    "similarity": float(d),
                    "score": float(d)
                })

        return results

    def search(self, query_vector: np.ndarray, top_k: int = 10) -> list[dict]:
        """Alias for search_similar."""
        return self.search_similar(query_vector, top_k=top_k)

    def remove_file(self, file_id: int):
        """Removes a file's mapping from visual index."""
        keys_to_remove = [
            k for k, v in self.faiss_to_file.items()
            if (v.get("file_id") if isinstance(v, dict) else v) == file_id
        ]
        for k in keys_to_remove:
            del self.faiss_to_file[k]
        self.save()

    def clear(self):
        """Clears the visual FAISS index and ID mapping."""
        self.index = faiss.IndexFlatIP(self.dimension)
        self.faiss_to_file = {}
        self.next_faiss_id = 0
        self.save()

visual_faiss_manager = VisualFAISSManager()
