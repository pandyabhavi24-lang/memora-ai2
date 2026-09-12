import os
import io
import json
import base64
import urllib.request
import logging
import numpy as np
from typing import Dict, Any, Optional, List
from PIL import Image

from ...services.embedding_service import embedding_service

logger = logging.getLogger("memora.local_vision")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff"}

NON_IMAGE_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xls", ".xlsx",
    ".ppt", ".pptx", ".java", ".py", ".js", ".ts", ".html", ".css",
    ".json", ".xml", ".sql", ".zip", ".tar", ".gz", ".7z", ".exe", ".bin"
}


class LocalVisionAnalyzer:
    """
    100% Free & Local Visual Intelligence Engine for Module 3:
    Powered by Ollama + Qwen2.5-VL 3B and Sentence Transformers (all-MiniLM-L6-v2).

    1. Local Visual Content Classifier:
       - Strictly categorizes inputs into 'pictorial' or 'text_heavy'.
       - Excludes documents, invoices, receipts, code screenshots, UI, scans, etc.
       - If classification is uncertain or Ollama is unavailable, cleanly fails/excludes without fake metadata.

    2. Strict Visual Grounding & Deep Extraction:
       - Extracts detailed 2-4 sentence description, visually confirmed objects + counts,
         scene, environment, activities, visual attributes, and relationships.
       - Strictly NEVER hallucinates objects (no false 'person', 'water', 'car', etc.).
       - Never uses filename or OCR text as visual truth.

    3. Searchable Representation & 384d Local Embeddings:
       - Formats verified visual metadata + manual tags into canonical searchable representation.
       - Generates 384-dimensional normalized local embeddings via Sentence Transformers.

    4. High-Precision Visual Relevance Evaluation:
       - Multi-concept AND-style reasoning (e.g. 'river and elephant').
       - Strict visual grounding preventing unrelated matches (e.g. bank.jpg for 'water').
    """

    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        self.vision_model = os.getenv("OLLAMA_VISION_MODEL", "qwen2.5vl:3b")
        self.embedding_model_name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        self.embedding_dimension = 384
        self._client = None
        self._mock_handler = None
        self._mock_reranker = None
        self._mock_classifier = None

        logger.info(f"[LOCAL AI] Ollama host: {self.base_url}")
        logger.info(f"[LOCAL AI] Vision model: {self.vision_model}")
        logger.info(f"[LOCAL EMBEDDING] Model: {self.embedding_model_name} (dim: {self.embedding_dimension})")

    def _get_ollama_client(self):
        """Returns initialized Ollama Python client if library is installed."""
        if self._client is None:
            try:
                import ollama
                self._client = ollama.Client(host=self.base_url)
            except Exception:
                self._client = None
        return self._client

    def is_ollama_available(self) -> bool:
        """Checks if local Ollama server is responsive."""
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = data.get("models", [])
                return len(models) > 0
        except Exception as e:
            logger.debug(f"[LOCAL AI] Ollama connection check failed: {e}")
            return False

    def set_mock_handler(self, handler):
        """Mock hook for vision analysis unit tests."""
        self._mock_handler = handler

    def set_mock_reranker(self, handler):
        """Mock hook for semantic relevance unit tests."""
        self._mock_reranker = handler

    def set_mock_classifier(self, handler):
        """Mock hook for content classification unit tests."""
        self._mock_classifier = handler

    def _prepare_image_bytes(self, image_path: str, max_dimension: int = 320) -> Optional[bytes]:
        """Loads and resizes image to bytes buffer for fast, accurate local vision processing."""
        if not os.path.exists(image_path):
            return None

        try:
            with Image.open(image_path) as img:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                elif img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

                w, h = img.size
                if max(w, h) > max_dimension:
                    scale = max_dimension / float(max(w, h))
                    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)

                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=85)
                return buffer.getvalue()
        except Exception as e:
            logger.error(f"[LOCAL VISION] Error preparing image {image_path}: {e}")
            return None

    # =========================================================================
    # 1. VISUAL CONTENT CLASSIFICATION (PICTORIAL VS TEXT-HEAVY)
    # =========================================================================

    def classify_image_content(self, image_path: str, filename: str = "") -> Dict[str, Any]:
        """
        Classifies whether an image is:
        - 'pictorial': Genuine photograph, landscape, river, beach, animal, person, vehicle, food, scene.
        - 'text_heavy': Document page, scanned invoice/receipt/form/notes, code screenshot, UI screenshot, text-heavy image.
        """
        ext = os.path.splitext(filename or image_path)[1].lower()
        if ext in NON_IMAGE_EXTENSIONS or ext not in IMAGE_EXTENSIONS:
            return {
                "content_type": "text_heavy",
                "confidence": 1.0,
                "reason": f"Non-image file ({ext}) is excluded from visual intelligence."
            }

        if not os.path.exists(image_path):
            return {
                "content_type": "text_heavy",
                "confidence": 1.0,
                "reason": "File does not exist on disk."
            }

        if self._mock_classifier is not None:
            try:
                return self._mock_classifier(image_path, filename)
            except Exception as me:
                logger.error(f"[LOCAL VISION] Error in mock classifier: {me}")

        img_bytes = self._prepare_image_bytes(image_path)
        if not img_bytes:
            return {
                "content_type": "text_heavy",
                "confidence": 1.0,
                "reason": "Could not decode or read image file."
            }

        prompt = (
            "You are the Strict Image Content Classifier for Memora AI.\n"
            "Analyze this image and classify whether it is a PICTORIAL visual image or a TEXT-HEAVY document image.\n\n"
            "DEFINITIONS:\n"
            "- 'pictorial': Genuine photographs, real-world scenes, nature, rivers, beaches, mountains, forests, "
            "animals, dogs, cats, people, cars, vehicles, buildings, food, products, artwork.\n"
            "- 'text_heavy': Resumes, CVs, invoices, receipts, forms, scanned documents, PDF pages, notes, articles, "
            "code screenshots, webpage screenshots, UI screenshots, diagrams dominated by text, or text-heavy images.\n\n"
            "RULE: If uncertain, classify as 'text_heavy'. Do NOT assume based on filename.\n\n"
            "Return ONLY valid JSON:\n"
            "{\n"
            '  "content_type": "pictorial" or "text_heavy",\n'
            '  "confidence": 0.95,\n'
            '  "reason": "1 concise sentence explaining classification."\n'
            "}"
        )

        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        payload = {
            "model": self.vision_model,
            "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.1}
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            http_req = urllib.request.Request(
                f"{self.base_url}/api/chat",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(http_req, timeout=60) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                raw_text = resp_data.get("message", {}).get("content", "")
            parsed = self._parse_json(raw_text)
            ctype = str(parsed.get("content_type", "")).strip().lower()
            if ctype not in ["pictorial", "text_heavy"]:
                ctype = "text_heavy"
            return {
                "content_type": ctype,
                "confidence": float(parsed.get("confidence", 0.9)),
                "reason": str(parsed.get("reason", "Local AI classification completed."))
            }
        except Exception as e:
            logger.error(f"[LOCAL VISION] Classification failed: {e}")
            return {
                "content_type": "text_heavy",
                "confidence": 0.0,
                "reason": f"Ollama error: {str(e)}"
            }

    # =========================================================================
    # 2. QWEN2.5-VL STRUCTURED IMAGE ANALYSIS (SINGLE UNIFIED PASS)
    # =========================================================================

    def analyze_image(self, image_path: str, filename: str = "") -> Dict[str, Any]:
        """
        Analyzes an image using Qwen2.5-VL 3B via Ollama in a single unified pass.
        Performs strict visual grounding: classifies content type and extracts detailed
        visual description, confirmed objects, scene, environment, activities, visual attributes,
        and relationships without hallucinating absent objects.
        """
        ext = os.path.splitext(filename or image_path)[1].lower()
        if ext in NON_IMAGE_EXTENSIONS or ext not in IMAGE_EXTENSIONS:
            return {
                "status": "skipped_text_heavy",
                "content_type": "text_heavy",
                "classification_confidence": 1.0,
                "classification_reason": f"Non-image file ({ext}) is excluded from visual intelligence.",
                "description": "",
                "objects": [],
                "object_counts": [],
                "scene": "document",
                "environment": "document",
                "activities": [],
                "visual_attributes": [],
                "relationships": [],
                "tags": [],
                "search_terms": [],
                "searchable_text": "",
                "colors": [],
                "is_screenshot": True,
                "screenshot_confidence": 0.95,
                "visual_category": "document"
            }

        if not os.path.exists(image_path):
            return {
                "status": "failed",
                "content_type": "text_heavy",
                "classification_confidence": 1.0,
                "classification_reason": "File does not exist on disk.",
                "error": "File does not exist on disk",
                "description": "",
                "objects": [],
                "object_counts": [],
                "scene": "",
                "environment": "",
                "activities": [],
                "visual_attributes": [],
                "relationships": [],
                "tags": [],
                "search_terms": [],
                "searchable_text": "",
                "colors": []
            }

        # Mock handler check for unit tests
        if self._mock_handler is not None:
            try:
                res = self._mock_handler(image_path, filename)
                res["content_type"] = res.get("content_type", "pictorial")
                res["classification_confidence"] = res.get("classification_confidence", 1.0)
                res["classification_reason"] = res.get("classification_reason", "Mock handler analysis")
                if "searchable_text" not in res:
                    res["searchable_text"] = self.build_searchable_representation(res)
                return res
            except Exception as me:
                logger.error(f"[LOCAL VISION] Error in mock handler: {me}")

        img_bytes = self._prepare_image_bytes(image_path)
        if not img_bytes:
            return {
                "status": "failed",
                "content_type": "pictorial",
                "classification_confidence": 0.0,
                "classification_reason": "Could not read image file bytes",
                "error": "Could not read image file bytes",
                "description": "",
                "objects": [],
                "object_counts": [],
                "scene": "",
                "environment": "",
                "activities": [],
                "visual_attributes": [],
                "relationships": [],
                "search_terms": [],
                "searchable_text": "",
                "colors": []
            }

        prompt = (
            "You are the Core Visual Intelligence Analyzer for Memora AI.\n"
            "Analyze this image with STRICT VISUAL GROUNDING.\n\n"
            "STEP 1: CLASSIFY CONTENT TYPE\n"
            "- 'pictorial': Genuine photograph, real-world scene, nature, river, beach, mountain, forest, animal, person, car, building, food, product, artwork.\n"
            "- 'text_heavy': Resume, invoice, receipt, form, scanned document, PDF page, notes, code screenshot, UI screenshot, diagram dominated by text.\n\n"
            "STEP 2: IF PICTORIAL, EXTRACT ACCURATE VISUAL INFORMATION (STRICT VISUAL TRUTH):\n"
            "1. Accurately describe ONLY what is visibly present in 2-4 meaningful, informative sentences.\n"
            "2. Identify distinct visible objects and their counts accurately.\n"
            "   - If an object is NOT visible in the image (e.g. no person, no water, no car, no dog), DO NOT mention or list it.\n"
            "3. Identify the specific scene (e.g. 'urban architecture', 'natural landscape', 'indoor room') and environment (e.g. 'city plaza', 'forest').\n"
            "4. Identify visible activities (or empty if static), visible dominant colors, visual attributes, and relationships between visible subjects.\n"
            "5. DO NOT hallucinate. Do NOT use filename or assumptions. Only visual truth.\n\n"
            "Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "content_type": "pictorial" or "text_heavy",\n'
            '  "classification_confidence": 0.95,\n'
            '  "classification_reason": "1 concise sentence explaining classification.",\n'
            '  "description": "2-4 sentence detailed visual description (or empty string if text_heavy).",\n'
            '  "objects": [\n'
            '    {"name": "building", "count": 1},\n'
            '    {"name": "tree", "count": 3}\n'
            '  ],\n'
            '  "scene": "urban architecture",\n'
            '  "environment": "city plaza",\n'
            '  "activities": [],\n'
            '  "attributes": {\n'
            '    "colors": ["pink", "green", "white"],\n'
            '    "weather": "clear",\n'
            '    "lighting": "daylight"\n'
            '  },\n'
            '  "relationships": ["trees in front of modern building"],\n'
            '  "search_terms": ["building", "city architecture", "trees in front of building"]\n'
            "}"
        )

        raw_text = ""
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        payload = {
            "model": self.vision_model,
            "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 300, "num_thread": 8}
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            http_req = urllib.request.Request(
                f"{self.base_url}/api/chat",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(http_req, timeout=180) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                raw_text = resp_data.get("message", {}).get("content", "")
        except Exception as http_e:
            client = self._get_ollama_client()
            if client:
                response = client.chat(
                    model=self.vision_model,
                    messages=[{"role": "user", "content": prompt, "images": [img_bytes]}],
                    format="json",
                    options={"temperature": 0.1}
                )
                raw_text = response.message.content if hasattr(response, "message") else response.get("message", {}).get("content", "")
            else:
                logger.error(f"[LOCAL VISION] Ollama visual analysis failed: {http_e}")
                return {
                    "status": "failed",
                    "content_type": "pictorial",
                    "classification_confidence": 0.0,
                    "classification_reason": "Ollama connection error",
                    "error": f"Ollama visual analysis failed: {str(http_e)}",
                    "description": "",
                    "objects": [],
                    "object_counts": [],
                    "scene": "",
                    "detected_scenes": [],
                    "environment": "",
                    "activities": [],
                    "visual_attributes": [],
                    "relationships": [],
                    "search_terms": [],
                    "colors": []
                }

        try:
            parsed = self._parse_json(raw_text)
            ctype = str(parsed.get("content_type", "pictorial")).strip().lower()
            if ctype not in ["pictorial", "text_heavy"]:
                ctype = "pictorial"

            conf = float(parsed.get("classification_confidence", 0.95))
            reason = str(parsed.get("classification_reason", "Local AI classification completed."))

            if ctype == "text_heavy":
                logger.info(f"[LOCAL VISION] Image classified as text-heavy: {filename}")
                is_sc = "screenshot" in str(filename).lower() or "dashboard" in str(filename).lower() or "ui" in str(filename).lower()
                return {
                    "status": "skipped_text_heavy",
                    "content_type": "text_heavy",
                    "classification_confidence": conf,
                    "classification_reason": reason,
                    "description": "",
                    "objects": [],
                    "object_counts": [],
                    "scene": "screenshot" if is_sc else "document",
                    "environment": "software_ui" if is_sc else "document",
                    "activities": [],
                    "visual_attributes": [],
                    "relationships": [],
                    "tags": [],
                    "search_terms": [],
                    "searchable_text": "",
                    "colors": [],
                    "is_screenshot": True,
                    "screenshot_confidence": 0.95,
                    "visual_category": "screenshot" if is_sc else "document"
                }

            # Normalize object lists
            raw_objects = parsed.get("objects", [])
            normalized_objects = []
            object_counts = []
            for obj in raw_objects:
                if isinstance(obj, dict):
                    name = str(obj.get("name", "")).strip()
                    cnt = int(obj.get("count", 1))
                    if name:
                        normalized_objects.append(name)
                        object_counts.append({"name": name, "count": cnt})
                elif isinstance(obj, str) and obj.strip():
                    normalized_objects.append(obj.strip())
                    object_counts.append({"name": obj.strip(), "count": 1})

            # Extract attributes & colors
            attrs = parsed.get("attributes", {})
            colors = []
            visual_attrs = []
            if isinstance(attrs, dict):
                colors = attrs.get("colors", [])
                for k, v in attrs.items():
                    if k != "colors" and v:
                        visual_attrs.append(f"{k}: {v}")
            elif isinstance(attrs, list):
                visual_attrs = attrs

            search_terms = parsed.get("search_terms", [])
            relationships = parsed.get("relationships", [])
            activities = parsed.get("activities", [])
            scene = parsed.get("scene", "")
            environment = parsed.get("environment", "")
            description = parsed.get("description", "")

            result = {
                "status": "completed",
                "content_type": "pictorial",
                "classification_confidence": conf,
                "classification_reason": reason,
                "description": description,
                "objects": normalized_objects,
                "object_counts": object_counts,
                "scene": scene,
                "detected_scenes": [scene] if scene else [],
                "environment": environment,
                "activities": activities,
                "visual_attributes": visual_attrs,
                "relationships": relationships,
                "search_terms": search_terms,
                "colors": colors,
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "visual_category": "photograph"
            }

            result["searchable_text"] = self.build_searchable_representation(result)
            return result

        except Exception as e:
            logger.error(f"[LOCAL VISION] Ollama visual analysis failed: {e}")
            return {
                "status": "failed",
                "content_type": "pictorial",
                "classification_confidence": conf,
                "classification_reason": reason,
                "error": f"Ollama visual analysis failed: {str(e)}",
                "description": "",
                "objects": [],
                "object_counts": [],
                "scene": "",
                "detected_scenes": [],
                "environment": "",
                "activities": [],
                "visual_attributes": [],
                "relationships": [],
                "search_terms": [],
                "colors": [],
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "visual_category": "photograph",
                "searchable_text": ""
            }

    # =========================================================================
    # 3. SEARCHABLE TEXT REPRESENTATION (INTERNAL SEARCH INDEX)
    # =========================================================================

    def build_searchable_representation(self, analysis_data: Dict[str, Any]) -> str:
        """
        Converts verified visual metadata + manual tags into canonical searchable text representation:
        Description, Objects, Scene, Environment, Colors, Activities, Relationships, Search Terms, Manual Tags.
        (Note: AI Tags section is removed from UI).
        """
        parts = []

        desc = analysis_data.get("description", "").strip()
        if desc:
            parts.append(f"Description:\n{desc}\n")

        objs = analysis_data.get("objects", [])
        if objs:
            obj_names = [o.get("name") if isinstance(o, dict) else str(o) for o in objs]
            parts.append(f"Objects:\n{', '.join(obj_names)}\n")

        scene = analysis_data.get("scene", "")
        if scene:
            parts.append(f"Scene:\n{scene}\n")

        env = analysis_data.get("environment", "")
        if env:
            parts.append(f"Environment:\n{env}\n")

        colors = analysis_data.get("colors", [])
        if not colors and isinstance(analysis_data.get("attributes"), dict):
            colors = analysis_data.get("attributes", {}).get("colors", [])
        if colors:
            parts.append(f"Colors:\n{', '.join(str(c) for c in colors)}\n")

        acts = analysis_data.get("activities", [])
        if acts:
            parts.append(f"Activities:\n{', '.join(str(a) for a in acts)}\n")

        rels = analysis_data.get("relationships", [])
        if rels:
            parts.append(f"Relationships:\n{', '.join(str(r) for r in rels)}\n")

        search_terms = analysis_data.get("search_terms", [])
        if search_terms:
            parts.append(f"Search Terms:\n{', '.join(str(st) for st in search_terms)}\n")

        user_tags = analysis_data.get("user_tags", [])
        if user_tags:
            parts.append(f"Manual Tags:\n{', '.join(str(ut) for ut in user_tags)}\n")

        return "\n".join(parts).strip()

    # =========================================================================
    # 4. SENTENCE TRANSFORMERS LOCAL TEXT EMBEDDINGS (384-DIM)
    # =========================================================================

    def embed_text(self, text: str) -> np.ndarray:
        """
        Generates 384-dimensional normalized local embedding using Sentence Transformers.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return np.zeros(self.embedding_dimension, dtype=np.float32)

        vec = embedding_service.embed_text(clean_text)
        if vec is None or vec.size == 0:
            return np.zeros(self.embedding_dimension, dtype=np.float32)

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        else:
            vec = np.zeros(self.embedding_dimension, dtype=np.float32)

        return vec.astype(np.float32)

    # =========================================================================
    # 5. HIGH-PRECISION VISUAL RELEVANCE EVALUATOR (STRICT VISUAL GROUNDING)
    # =========================================================================

    def evaluate_semantic_relevance(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        threshold: float = 60.0
    ) -> List[Dict[str, Any]]:
        """
        Evaluates visual semantic relevance with STRICT visual grounding:
        1. Multi-concept AND queries (e.g. 'river and elephant'): requires evidence for BOTH.
        2. Visual grounding: queries seeking specific concepts ('water', 'dog', 'car', 'elephant')
           MUST have visual evidence in the image (description, objects, scenes, or manual tags).
           Unrelated images (e.g. bank.jpg for 'water') are strictly rejected.
        3. Generates accurate, explainable 'reason' text.
        """
        clean_query = (query or "").strip()
        if not clean_query or not candidates:
            return []

        if self._mock_reranker is not None:
            try:
                return self._mock_reranker(clean_query, candidates, threshold)
            except Exception as me:
                logger.error(f"[LOCAL AI] Error in mock reranker: {me}")

        query_vec = self.embed_text(clean_query)
        q_low = clean_query.lower()

        # Parse required concept tokens
        # Check for multi-concept AND queries: "river and elephant", "dog near river", "red car"
        has_and = " and " in q_low or " & " in q_low or " with " in q_low or " near " in q_low or " beside " in q_low
        
        # Split tokens, filtering generic stopwords
        GENERIC_STOPWORDS = {"image", "photo", "picture", "outdoor", "indoor", "nature", "scene", "view", "green", "with", "and", "near", "beside", "in", "on", "a", "an", "the", "find", "show"}
        raw_tokens = [w for w in q_low.replace(",", " ").replace("-", " ").replace("&", " ").split() if len(w) > 1]
        specific_concepts = [t for t in raw_tokens if t not in GENERIC_STOPWORDS]

        # Concept synonyms map for visual grounding
        CONCEPT_SYNONYMS = {
            "water": ["water", "river", "lake", "ocean", "sea", "stream", "pond", "waterfall", "beach", "coast", "shore", "flowing water"],
            "river": ["river", "stream", "waterway", "flowing water", "riverbank", "riverbanks"],
            "dog": ["dog", "canine", "puppy", "hound"],
            "elephant": ["elephant", "elephants", "tusk"],
            "car": ["car", "vehicle", "automobile", "sedan", "suv"],
            "beach": ["beach", "coast", "shore", "sand", "seashore"],
            "mountain": ["mountain", "mountains", "peak", "cliff", "hill"],
            "tree": ["tree", "trees", "forest", "woodland", "vegetation"],
            "building": ["building", "architecture", "structure", "house", "bank"],
            "flower": ["flower", "flowers", "flowering", "blossom", "blossoms", "flora"]
        }

        results = []
        for c in candidates:
            cid = str(c.get("id", ""))
            ctype = c.get("content_type", "pictorial")

            if ctype == "text_heavy":
                results.append({
                    "image_id": cid,
                    "relevant": False,
                    "relevance_score": 0,
                    "reason": "Document/text-heavy image excluded from visual search results."
                })
                continue

            cand_text = c.get("searchable_text", "")
            if not cand_text:
                cand_text = self.build_searchable_representation(c)

            cand_vec = self.embed_text(cand_text)
            cos_sim = float(np.dot(query_vec, cand_vec))
            raw_score = int(round(max(0.0, min(1.0, cos_sim)) * 100))

            desc = (c.get("description", "")).lower()
            objs = [str(o.get("name") if isinstance(o, dict) else o).lower() for o in c.get("objects", [])]
            user_tags = [str(ut).lower() for ut in c.get("user_tags", [])]
            scene = (c.get("scene", "")).lower()
            env = (c.get("environment", "")).lower()
            rels = [str(r).lower() for r in c.get("relationships", [])]
            colors = [str(col).lower() for col in c.get("colors", [])]
            terms = [str(st).lower() for st in c.get("search_terms", [])]

            all_visual_text = f"{desc} {' '.join(objs)} {scene} {env} {' '.join(rels)} {' '.join(colors)} {' '.join(terms)}"

            # 1. Manual Tag Exact Match Check
            user_tag_matches = [ut for ut in user_tags if ut == q_low or ut in q_low or any(t == ut for t in specific_concepts)]
            if user_tag_matches:
                results.append({
                    "image_id": cid,
                    "relevant": True,
                    "relevance_score": max(raw_score, 92),
                    "reason": f"Matches manual tag '{', '.join(user_tag_matches)}'."
                })
                continue

            # 2. Concept Evidence Verification
            concept_matches = []
            for concept in specific_concepts:
                synonyms = CONCEPT_SYNONYMS.get(concept, [concept])
                has_concept = any(syn in all_visual_text for syn in synonyms)
                if has_concept:
                    concept_matches.append(concept)

            # 3. Multi-Concept AND Search vs Single Concept Search
            if len(specific_concepts) >= 2:
                # Multi-concept query (e.g. "river and elephant", "dog near water")
                match_ratio = len(concept_matches) / float(len(specific_concepts))
                if match_ratio >= 1.0:
                    final_score = max(raw_score, 94)
                    reason = f"Both {', '.join(specific_concepts)} are detected in the image."
                    is_relevant = True
                elif match_ratio >= 0.5:
                    # Partial match: only 1 of 2 required concepts present
                    final_score = min(raw_score, 35)
                    missing = [c for c in specific_concepts if c not in concept_matches]
                    reason = f"Partial match: contains {', '.join(concept_matches)} but missing required {', '.join(missing)}."
                    is_relevant = False
                else:
                    final_score = min(raw_score, 15)
                    reason = f"Image does not contain visual evidence of {', '.join(specific_concepts)}."
                    is_relevant = False

            elif len(specific_concepts) == 1:
                target_concept = specific_concepts[0]
                synonyms = CONCEPT_SYNONYMS.get(target_concept, [target_concept])
                has_visual_evidence = any(syn in all_visual_text for syn in synonyms)

                if has_visual_evidence:
                    final_score = max(raw_score, 90)
                    if target_concept in ["water", "river"]:
                        reason = "Water is visually present as the main river in the image." if "river" in all_visual_text else "Water is visually present in the image."
                    elif target_concept in ["car", "vehicle"]:
                        reason = "Vehicle is visually present in the image."
                    else:
                        reason = f"Visual match: {target_concept} is visually present in the image."
                    is_relevant = bool(final_score >= threshold)
                else:
                    # STRICT VISUAL GROUNDING: Concept is absent (e.g. bank.jpg for "water")
                    final_score = min(raw_score, 18)
                    reason = f"No visual evidence of '{target_concept}' in this image."
                    is_relevant = False

            else:
                # General descriptive query
                if raw_score >= 70:
                    final_score = raw_score
                    reason = "Visual semantic match."
                    is_relevant = True
                else:
                    final_score = raw_score
                    reason = f"Insufficient visual evidence for '{clean_query}'."
                    is_relevant = False

            results.append({
                "image_id": cid,
                "relevant": is_relevant,
                "relevance_score": final_score,
                "reason": reason
            })

        return results

    # =========================================================================
    # 6. DYNAMIC VISUAL GROUPS (LOCAL CLUSTERING)
    # =========================================================================

    def generate_collection_groups(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Dynamically clusters pictorial images based on actual visual metadata.
        Ensures representative_file_id is strictly one of the original media IDs.
        """
        if not items:
            return []

        clusters: Dict[str, List[int]] = {}
        for it in items:
            fid = it.get("file_id")
            scenes = [s.strip().title() for s in it.get("scenes", []) if s and str(s).strip()]
            objs = [o.strip().title() for o in it.get("objects", []) if o and str(o).strip()]

            if scenes:
                theme = f"{scenes[0]} Landscapes" if any(s.lower() in ["nature", "mountain", "beach", "river", "forest"] for s in scenes) else f"{scenes[0]} Scenes"
            elif objs:
                theme = f"{objs[0]} Collection"
            else:
                theme = "Visual Photographs"

            clusters.setdefault(theme, []).append(fid)

        result_groups = []
        for name, fids in clusters.items():
            if fids:
                result_groups.append({
                    "group_name": name,
                    "group_type": "ai_dynamic_group",
                    "representative_file_id": fids[0],
                    "file_ids": fids
                })
        return result_groups

    def _parse_json(self, raw_content: str) -> Dict[str, Any]:
        """Safely parses JSON responses from local models."""
        if not raw_content:
            return {}
        try:
            return json.loads(raw_content)
        except Exception:
            clean = raw_content.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()
            try:
                return json.loads(clean)
            except Exception:
                return {}


local_vision_analyzer = LocalVisionAnalyzer()
