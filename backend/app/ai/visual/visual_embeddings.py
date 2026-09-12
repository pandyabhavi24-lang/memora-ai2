import os
import logging
import numpy as np
from PIL import Image
import cv2

logger = logging.getLogger("memora.visual_embeddings")

class VisualEmbeddingService:
    """
    Local Visual Feature Descriptor generating 384-dimensional normalized dense vectors.
    """
    def __init__(self):
        self.dimension = 384
        self.provider = "vision_feature_extractor"
        logger.info(f"Local spatial-spectral visual descriptor engine initialized ({self.dimension}-dim).")

    def _normalize(self, vector: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(vector)
        if norm == 0:
            return np.zeros((self.dimension,), dtype=np.float32)
        return (vector / norm).astype(np.float32)

    def extract_visual_descriptor(self, image_path: str) -> np.ndarray:
        """
        Extracts a 384-dimensional normalized visual embedding for an image.
        - 3D HSV Color distribution (144 dims: 48 H, 48 S, 48 V)
        - Spatial grid localized luminance moments (96 dims: 4x4 grid with 6 moments each)
        - Multi-scale gradient & edge orientation histograms (96 dims)
        - Perceptual discrete cosine transform frequency coefficients (48 dims)
        Total = 384 dims, L2-normalized.
        """
        try:
            img_bgr = cv2.imread(image_path)
            if img_bgr is None:
                pil_img = Image.open(image_path).convert("RGB")
                img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
            h, w = img_bgr.shape[:2]

            # 1. 3D HSV Color distribution (144 dims: 48 H, 48 S, 48 V)
            hist_h = cv2.calcHist([img_hsv], [0], None, [48], [0, 180]).flatten()
            hist_s = cv2.calcHist([img_hsv], [1], None, [48], [0, 256]).flatten()
            hist_v = cv2.calcHist([img_hsv], [2], None, [48], [0, 256]).flatten()
            color_feats = np.concatenate([hist_h, hist_s, hist_v])
            color_feats = color_feats / (np.linalg.norm(color_feats) + 1e-7)

            # 2. Spatial Grid Luminance Moments (96 dims: 4x4 grid with 6 moments each)
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
                            float(np.min(cell)),
                            float(np.max(cell)),
                            float(np.var(cell) / 255.0)
                        ])
                    else:
                        spatial_feats.extend([0.0] * 6)
            spatial_feats = np.array(spatial_feats, dtype=np.float32)
            spatial_feats = spatial_feats / (np.linalg.norm(spatial_feats) + 1e-7)

            # 3. Multi-scale gradient & edge orientation (96 dims)
            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            mag, ang = cv2.cartToPolar(sobelx, sobely, angleInDegrees=True)
            edge_hist = cv2.calcHist([ang.astype(np.float32)], [0], None, [96], [0, 360]).flatten()
            edge_feats = edge_hist / (np.linalg.norm(edge_hist) + 1e-7)

            # 4. Perceptual DCT Frequency coefficients (48 dims)
            small = cv2.resize(gray, (32, 32)).astype(np.float32)
            dct = cv2.dct(small)
            dct_low = dct[:8, :6].flatten()
            dct_feats = dct_low / (np.linalg.norm(dct_low) + 1e-7)

            # Concatenate to 384-dim vector
            combined = np.concatenate([color_feats, spatial_feats, edge_feats, dct_feats]).astype(np.float32)
            return self._normalize(combined)

        except Exception as err:
            logger.error(f"Error extracting visual descriptor for {image_path}: {err}", exc_info=True)
            return np.zeros((self.dimension,), dtype=np.float32)

    def embed_image(self, image_path: str) -> np.ndarray:
        """Embeds an image into a 384-dimensional normalized visual vector."""
        if not os.path.exists(image_path):
            return np.zeros((self.dimension,), dtype=np.float32)
        return self.extract_visual_descriptor(image_path)

visual_embedding_service = VisualEmbeddingService()
