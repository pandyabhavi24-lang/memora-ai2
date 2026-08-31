import os
import json
import logging
import numpy as np
import faiss

logger = logging.getLogger("memora.faiss")

class FAISSManager:
    """
    Manages FAISS IndexFlatIP (384-dim) for inner-product vector similarity search on normalized embeddings.
    Persists index binary and FAISS ID <-> chunk_id mapping JSON to backend/data/faiss/.
    """
    def __init__(self, data_dir: str = None, dimension: int = 384):
        if data_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            data_dir = os.path.join(base_dir, "data", "faiss")
        
        self.data_dir = data_dir
        self.dimension = dimension
        self.index_path = os.path.join(self.data_dir, "index.faiss")
        self.map_path = os.path.join(self.data_dir, "faiss_id_map.json")

        os.makedirs(self.data_dir, exist_ok=True)

        self.index = None
        # faiss_id (str) -> chunk_id (int)
        self.faiss_to_chunk = {}
        # next available FAISS integer ID
        self.next_faiss_id = 0

        self.load_or_create()

    def load_or_create(self):
        """Loads existing FAISS index & id mapping, or initializes fresh index."""
        if os.path.exists(self.index_path) and os.path.exists(self.map_path):
            try:
                self.index = faiss.read_index(self.index_path)
                with open(self.map_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.faiss_to_chunk = {int(k): int(v) for k, v in data.get("faiss_to_chunk", {}).items()}
                    self.next_faiss_id = data.get("next_faiss_id", 0)
                logger.info(f"Loaded existing FAISS index with {self.index.ntotal} vectors.")
                return
            except Exception as e:
                logger.error(f"Error loading FAISS index: {e}. Re-initializing new index.", exc_info=True)

        logger.info("Initializing new FAISS IndexFlatIP (384d).")
        self.index = faiss.IndexFlatIP(self.dimension)
        self.faiss_to_chunk = {}
        self.next_faiss_id = 0
        self.save()

    def save(self):
        """Persists the FAISS index and mapping file to disk."""
        try:
            faiss.write_index(self.index, self.index_path)
            data = {
                "faiss_to_chunk": {str(k): v for k, v in self.faiss_to_chunk.items()},
                "next_faiss_id": self.next_faiss_id
            }
            with open(self.map_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Persisted FAISS index ({self.index.ntotal} vectors) to disk.")
        except Exception as e:
            logger.error(f"Failed to save FAISS index: {e}", exc_info=True)

    def add_vectors(self, vectors: np.ndarray, chunk_ids: list[int]) -> list[tuple[int, int]]:
        """
        Adds vectors (shape: N, 384) to FAISS index.
        Assumes vectors are already L2-normalized float32.
        Returns list of tuples: [(faiss_id, chunk_id), ...]
        """
        if vectors.size == 0 or len(chunk_ids) == 0:
            return []

        if len(vectors.shape) == 1:
            vectors = vectors.reshape(1, -1)

        vectors = vectors.astype(np.float32)
        count = vectors.shape[0]

        # Verify dimension
        if vectors.shape[1] != self.dimension:
            raise ValueError(f"Vector dimension mismatch: expected {self.dimension}, got {vectors.shape[1]}")

        start_id = self.next_faiss_id
        assigned = []

        # IndexFlatIP does not support custom IDs directly in standard flat index unless using IndexIDMap,
        # but IndexFlatIP maintains strict sequential index pos (0..N-1).
        # To maintain alignment, we add vectors sequentially to IndexFlatIP and record mapping.
        self.index.add(vectors)

        for i in range(count):
            faiss_id = start_id + i
            chunk_id = chunk_ids[i]
            self.faiss_to_chunk[faiss_id] = chunk_id
            assigned.append((faiss_id, chunk_id))

        self.next_faiss_id += count
        self.save()
        return assigned

    def search(self, query_vector: np.ndarray, top_k: int = 20) -> list[dict]:
        """
        Searches FAISS index for top_k closest vectors to normalized query_vector.
        Returns list of dicts: [{'faiss_id': int, 'chunk_id': int, 'score': float}]
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        if len(query_vector.shape) == 1:
            query_vector = query_vector.reshape(1, -1)

        query_vector = query_vector.astype(np.float32)

        # Normalize query vector if needed
        norm = np.linalg.norm(query_vector, axis=1, keepdims=True)
        norm[norm == 0] = 1e-10
        query_vector = query_vector / norm

        actual_k = min(top_k, self.index.ntotal)
        distances, indices = self.index.search(query_vector, actual_k)

        results = []
        for i in range(actual_k):
            faiss_id = int(indices[0][i])
            if faiss_id < 0:
                continue
            score = float(distances[0][i])
            chunk_id = self.faiss_to_chunk.get(faiss_id)
            if chunk_id is not None:
                results.append({
                    "faiss_id": faiss_id,
                    "chunk_id": chunk_id,
                    "score": score
                })

        return results

    def remove_chunks(self, chunk_ids_to_remove: set[int]):
        """
        Rebuilds index omitting specified chunk IDs.
        """
        if not chunk_ids_to_remove or self.index.ntotal == 0:
            return

        # Fetch all vectors if needed, or rebuild. Since IndexFlatIP stores raw vectors:
        try:
            ntotal = self.index.ntotal
            all_vectors = np.zeros((ntotal, self.dimension), dtype=np.float32)
            for i in range(ntotal):
                all_vectors[i] = self.index.reconstruct(i)

            new_vectors = []
            new_faiss_to_chunk = {}
            new_id = 0

            for i in range(ntotal):
                chunk_id = self.faiss_to_chunk.get(i)
                if chunk_id is not None and chunk_id not in chunk_ids_to_remove:
                    new_vectors.append(all_vectors[i])
                    new_faiss_to_chunk[new_id] = chunk_id
                    new_id += 1

            self.index = faiss.IndexFlatIP(self.dimension)
            if len(new_vectors) > 0:
                new_vecs_np = np.vstack(new_vectors).astype(np.float32)
                self.index.add(new_vecs_np)

            self.faiss_to_chunk = new_faiss_to_chunk
            self.next_faiss_id = new_id
            self.save()
            logger.info(f"Removed chunks {chunk_ids_to_remove}. Rebuilt index with {self.index.ntotal} vectors.")
        except Exception as e:
            logger.error(f"Error rebuilding FAISS index during removal: {e}", exc_info=True)


faiss_manager = FAISSManager()
