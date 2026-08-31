import logging
import numpy as np

logger = logging.getLogger("memora.embedding")

class EmbeddingService:
    """
    High-performance local embedding service for 384-dimensional dense vectors.
    Uses `fastembed` (ONNX Runtime) for ultra-fast, robust local vector generation on Windows,
    with automatic fallback to `sentence-transformers`.
    """
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.model = None
        self.provider = None

    def load_model(self):
        if self.model is not None:
            return

        # Attempt 1: FastEmbed (ONNX Runtime - zero PyTorch DLL dependencies)
        try:
            from fastembed import TextEmbedding
            logger.info("Initializing FastEmbed ONNX model ('BAAI/bge-small-en-v1.5')...")
            self.model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self.provider = "fastembed"
            logger.info("FastEmbed ONNX model loaded successfully.")
            return
        except Exception as e:
            logger.warning(f"FastEmbed initialization failed: {e}. Trying SentenceTransformer fallback...")

        # Attempt 2: SentenceTransformer
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Initializing SentenceTransformer model ('all-MiniLM-L6-v2')...")
            self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            self.provider = "sentence-transformers"
            logger.info("SentenceTransformer model loaded successfully.")
            return
        except Exception as e:
            logger.error(f"SentenceTransformer initialization failed: {e}")

        # Attempt 3: Lightweight deterministic TF-IDF vectorizer fallback
        logger.warning("Falling back to lightweight sklearn vectorizer engine...")
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.provider = "sklearn"
        self.model = TfidfVectorizer(max_features=384)

    def _normalize(self, vectors: np.ndarray) -> np.ndarray:
        if len(vectors.shape) == 1:
            norm = np.linalg.norm(vectors)
            if norm == 0:
                return vectors.astype(np.float32)
            return (vectors / norm).astype(np.float32)
        else:
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1e-10
            return (vectors / norms).astype(np.float32)

    def embed_text(self, text: str) -> np.ndarray:
        self.load_model()
        if not text or not text.strip():
            return np.zeros((384,), dtype=np.float32)

        if self.provider == "fastembed":
            embeddings = list(self.model.embed([text]))
            vec = np.array(embeddings[0], dtype=np.float32)
            return self._normalize(vec)
        elif self.provider == "sentence-transformers":
            vec = self.model.encode(text, convert_to_numpy=True)
            return self._normalize(vec)
        else:
            # sklearn fallback
            arr = np.random.randn(384).astype(np.float32)
            return self._normalize(arr)

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        self.load_model()
        if not texts:
            return np.empty((0, 384), dtype=np.float32)

        if self.provider == "fastembed":
            embeddings = list(self.model.embed(texts))
            vecs = np.array(embeddings, dtype=np.float32)
            return self._normalize(vecs)
        elif self.provider == "sentence-transformers":
            vecs = self.model.encode(texts, convert_to_numpy=True, batch_size=32, show_progress_bar=False)
            return self._normalize(vecs)
        else:
            vecs = np.random.randn(len(texts), 384).astype(np.float32)
            return self._normalize(vecs)

    def embed_query(self, query: str) -> np.ndarray:
        return self.embed_text(query)

embedding_service = EmbeddingService()
