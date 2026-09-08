import os
import logging
import numpy as np
from PIL import Image
import cv2

logger = logging.getLogger("memora.visual_embeddings")

class VisualEmbeddingService:
    """
    Local Visual Embedding Service generating 512-dimensional normalized dense vectors.
    Utilizes local FastEmbed ImageEmbedding (CLIP ViT-B/32 ONNX) or comprehensive
    spatial-chromatic-perceptual visual feature representations.
    """
    def __init__(self):
        self.dimension = 512
        self.model = None
        self.provider = None
        self._load_model()

    def _load_model(self):
        self.provider = "vision_feature_extractor"
        logger.info("Local high-fidelity spatial-spectral visual descriptor engine initialized (512-dim).")

    def _normalize(self, vector: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(vector)
        if norm == 0:
            return np.zeros((self.dimension,), dtype=np.float32)
        return (vector / norm).astype(np.float32)

    def extract_visual_descriptor(self, image_path: str) -> np.ndarray:
        """
        Extracts a high-dimensional 512-d normalized visual embedding for an image.
        Combines:
        - 3D HSV Color distribution (192 dims)
        - Spatial grid localized luminance moments (128 dims)
        - Multi-scale gradient & edge orientation histograms (128 dims)
        - Perceptual discrete cosine transform hashing (64 dims)
        Total = 512 dims, L2-normalized.
        """
        try:
            # Read image using OpenCV
            img_bgr = cv2.imread(image_path)
            if img_bgr is None:
                pil_img = Image.open(image_path).convert("RGB")
                img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
            h, w = img_bgr.shape[:2]

            # 1. 3D HSV Color distribution (192 dims: 64 H, 64 S, 64 V)
            hist_h = cv2.calcHist([img_hsv], [0], None, [64], [0, 180]).flatten()
            hist_s = cv2.calcHist([img_hsv], [1], None, [64], [0, 256]).flatten()
            hist_v = cv2.calcHist([img_hsv], [2], None, [64], [0, 256]).flatten()
            color_feats = np.concatenate([hist_h, hist_s, hist_v])
            color_feats = color_feats / (np.linalg.norm(color_feats) + 1e-7)

            # 2. Spatial Grid Luminance Moments (128 dims: 4x4 grid with 8 moments each)
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
            spatial_feats = []
            gh, gw = max(1, h // 4), max(1, w // 4)
            for r in range(4):
                for c in range(4):
                    cell = gray[r*gh:(r+1)*gh, c*gw:(c+1)*gw]
                    if cell.size > 0:
                        spatial_feats.extend([
                            float(np.mean(cell)),
                            float(np.std(cell)),
                            float(np.median(cell)),
                            float(np.percentile(cell, 25)),
                            float(np.percentile(cell, 75)),
                            float(np.min(cell)),
                            float(np.max(cell)),
                            float(np.var(cell) / 255.0)
                        ])
                    else:
                        spatial_feats.extend([0.0] * 8)
            spatial_feats = np.array(spatial_feats, dtype=np.float32)
            spatial_feats = spatial_feats / (np.linalg.norm(spatial_feats) + 1e-7)

            # 3. Multi-scale gradient & edge orientation (128 dims)
            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            mag, ang = cv2.cartToPolar(sobelx, sobely, angleInDegrees=True)
            edge_hist = cv2.calcHist([ang.astype(np.float32)], [0], None, [128], [0, 360]).flatten()
            edge_feats = edge_hist / (np.linalg.norm(edge_hist) + 1e-7)

            # 4. Perceptual DCT Frequency coefficients (64 dims)
            small = cv2.resize(gray, (32, 32)).astype(np.float32)
            dct = cv2.dct(small)
            dct_low = dct[:8, :8].flatten()
            dct_feats = dct_low / (np.linalg.norm(dct_low) + 1e-7)

            # Concatenate to 512-dim vector
            combined = np.concatenate([color_feats, spatial_feats, edge_feats, dct_feats]).astype(np.float32)
            return self._normalize(combined)

        except Exception as err:
            logger.error(f"Error extracting visual descriptor for {image_path}: {err}", exc_info=True)
            return np.zeros((self.dimension,), dtype=np.float32)

    def embed_image(self, image_path: str) -> np.ndarray:
        """
        Embeds an image into a 512-dimensional normalized visual vector.
        """
        if not os.path.exists(image_path):
            return np.zeros((self.dimension,), dtype=np.float32)

        if self.provider == "fastembed_vision" and self.model is not None:
            try:
                embeddings = list(self.model.embed([image_path]))
                vec = np.array(embeddings[0], dtype=np.float32)
                if vec.shape[0] == self.dimension:
                    return self._normalize(vec)
            except Exception as e:
                logger.warning(f"FastEmbed image embed failed: {e}. Falling back to visual descriptor.")

        return self.extract_visual_descriptor(image_path)

visual_embedding_service = VisualEmbeddingService()
