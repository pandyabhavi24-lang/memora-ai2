import os
import re
import logging
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("memora.object_detector")

class VisualContentDetector:
    """
    Local Computer Vision Content & Scene Understanding Engine.
    Detects:
    1. Objects: person, tree, sky, building, vehicle, laptop, mobile, animal, document, etc.
    2. Scene context: indoor, outdoor, classroom, workshop, office, event, nature, street, etc.
    3. Screenshot Detection: UI patterns, synthetic straight lines, solid bars, standard display ratios.
    4. Image Classification: photograph, screenshot, scanned_document, event_photo, project_image, certificate.
    """

    def __init__(self):
        # Color ranges in HSV for scene & environmental understanding
        self.HSV_PROFILES = {
            "sky_blue": ((95, 40, 100), (135, 255, 255)),
            "vegetation_green": ((35, 40, 40), (85, 255, 255)),
            "skin_tones": ((0, 30, 60), (25, 170, 255)),
            "earth_brown": ((10, 40, 30), (25, 200, 180)),
            "water_cyan": ((80, 50, 50), (105, 255, 255)),
            "night_dark": ((0, 0, 0), (180, 255, 40))
        }

    def detect_screenshot(self, img_bgr: np.ndarray) -> tuple[bool, float, dict]:
        """
        Detects if an image is a screenshot using structural and chromatic computer vision indicators:
        - Synthetic straight horizontal/vertical borders (UI window borders, toolbars)
        - Palette quantization / solid color regions
        - Aspect ratios matching standard monitors (16:9, 16:10, 1920x1080, 1366x768)
        - Low chromatic variance within rectangular blocks
        """
        try:
            h, w = img_bgr.shape[:2]
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

            # 1. Edge orientation analysis: Screenshots have heavy strict horizontal & vertical lines
            edges = cv2.Canny(gray, 50, 150)
            lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=max(w, h) // 8, maxLineGap=10)
            
            strict_axis_aligned_lines = 0
            total_lines = len(lines) if lines is not None else 0

            if lines is not None:
                for line in lines:
                    coords = line[0] if len(line) == 1 else line
                    x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
                    dx = abs(x2 - x1)
                    dy = abs(y2 - y1)
                    if dx < 3 or dy < 3:  # Perfectly vertical or horizontal
                        strict_axis_aligned_lines += 1

            axis_aligned_ratio = strict_axis_aligned_lines / max(1, total_lines)

            # 2. Solid color blocks / UI regions
            # Downscale and compute unique color palette size
            small = cv2.resize(img_bgr, (128, 128))
            unique_colors = len(np.unique(small.reshape(-1, 3), axis=0))
            palette_sparsity = 1.0 - min(1.0, unique_colors / 3000.0)

            # 3. Standard screen aspect ratio match
            aspect = w / max(1, h)
            is_screen_ratio = (
                abs(aspect - 1.777) < 0.05 or  # 16:9
                abs(aspect - 1.6) < 0.05 or    # 16:10
                abs(aspect - 2.16) < 0.08 or   # Mobile 19.5:9
                abs(aspect - 1.333) < 0.05     # 4:3
            )

            # 4. Corner uniformity (browser bars, taskbars)
            top_bar = gray[:max(1, h // 20), :]
            top_bar_std = float(np.std(top_bar))

            # Composite screenshot probability
            score = 0.0
            if strict_axis_aligned_lines >= 8 and axis_aligned_ratio > 0.50:
                score += 0.50
            elif strict_axis_aligned_lines >= 5 and axis_aligned_ratio > 0.40:
                score += 0.30

            if palette_sparsity > 0.60 and strict_axis_aligned_lines >= 6:
                score += 0.25
            if is_screen_ratio and strict_axis_aligned_lines >= 5:
                score += 0.15
            if top_bar_std < 8.0 and strict_axis_aligned_lines >= 5:  # Flat top toolbar
                score += 0.15

            confidence = min(0.98, max(0.05, score))
            is_screenshot = confidence >= 0.50 and strict_axis_aligned_lines >= 6

            details = {
                "axis_aligned_lines": strict_axis_aligned_lines,
                "palette_sparsity": round(palette_sparsity, 2),
                "is_screen_ratio": is_screen_ratio,
                "top_bar_uniformity": round(top_bar_std, 2)
            }

            return is_screenshot, round(confidence, 2), details

        except Exception as e:
            logger.error(f"Error in screenshot detection: {e}")
            return False, 0.0, {}

    def analyze_visual_content(self, image_path: str, filename: str = "") -> dict:
        """
        Analyzes visual content, detects objects, identifies scenes, and classifies media.
        """
        if not os.path.exists(image_path):
            return {
                "category": "other",
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "detected_objects": [],
                "detected_scenes": [],
                "dominant_colors": []
            }

        try:
            img_bgr = cv2.imread(image_path)
            if img_bgr is None:
                pil_img = Image.open(image_path).convert("RGB")
                img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            h, w = img_bgr.shape[:2]
            total_pixels = max(1, h * w)
            img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

            detected_objects = []
            detected_scenes = []

            # 1. Screenshot Detection
            is_screenshot, sc_confidence, sc_details = self.detect_screenshot(img_bgr)

            # 2. Color Distribution & Environment Analysis
            color_coverage = {}
            for name, (lower, upper) in self.HSV_PROFILES.items():
                mask = cv2.inRange(img_hsv, np.array(lower), np.array(upper))
                coverage = float(np.count_nonzero(mask)) / total_pixels
                color_coverage[name] = coverage

            # Sky / Outdoors
            if color_coverage["sky_blue"] > 0.12:
                detected_objects.append("sky")
                detected_scenes.append("outdoor")

            # Vegetation / Trees / Nature
            if color_coverage["vegetation_green"] > 0.10:
                detected_objects.append("tree")
                detected_objects.append("nature")
                detected_scenes.append("nature")

            # Water / Marine
            if color_coverage["water_cyan"] > 0.15:
                detected_objects.append("water")
                detected_scenes.append("outdoor")

            # 3. People / Faces Detection via Haar cascades or skin color clustering
            face_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.py" if hasattr(cv2, "data") else ""
            face_count = 0
            if hasattr(cv2, "data") and os.path.exists(cv2.data.haarcascades + "haarcascade_frontalface_default.xml"):
                face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                face_count = len(faces)

            if face_count > 0 or color_coverage["skin_tones"] > 0.08:
                detected_objects.append("person")
                if face_count >= 3:
                    detected_objects.append("group")
                    detected_scenes.append("event")
                elif face_count == 1:
                    detected_objects.append("portrait")

            # 4. Text & Document / Certificate structure
            # High edge density in rectangular text bands indicates documents/slides/certificates
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            text_like_boxes = 0
            for cnt in contours:
                x, y, bw, bh = cv2.boundingRect(cnt)
                if bw > 20 and bh > 5 and bh < 60 and bw / max(1, bh) > 1.5:
                    text_like_boxes += 1

            if text_like_boxes > 30 and not is_screenshot:
                detected_objects.append("document")
                detected_scenes.append("office")

            # 5. Electronic Devices & Tech / Classroom / Workshop Context
            # Look for rectangular display panels or projector frames
            rectangles = 0
            for cnt in contours:
                approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
                if len(approx) == 4 and cv2.contourArea(cnt) > (total_pixels * 0.03):
                    rectangles += 1

            if rectangles >= 1 and (is_screenshot or text_like_boxes > 15):
                detected_objects.append("display")
                if "person" in detected_objects or "document" in detected_objects:
                    detected_objects.append("laptop")
                    detected_scenes.append("workshop")

            # 6. Dominant Colors (Top 3 hex colors)
            pixels = img_bgr.reshape(-1, 3)
            # Sample 2000 pixels for fast histogram extraction
            sample_idx = np.random.choice(pixels.shape[0], min(2000, pixels.shape[0]), replace=False)
            sampled = pixels[sample_idx]
            mean_b, mean_g, mean_r = np.mean(sampled, axis=0)
            dominant_hex = f"#{int(mean_r):02x}{int(mean_g):02x}{int(mean_b):02x}"

            # 7. Image Classification Category
            fn_low = filename.lower()
            if is_screenshot:
                category = "screenshot"
            elif "certificate" in fn_low or "cert" in fn_low or (text_like_boxes > 40 and "document" in detected_objects and len(contours) < 200):
                category = "certificate"
                detected_objects.append("certificate")
            elif "scanned" in fn_low or (text_like_boxes > 50 and not is_screenshot):
                category = "scanned_document"
            elif face_count >= 2 or "event" in fn_low or "workshop" in fn_low:
                category = "event_photo"
                detected_scenes.append("event")
            elif "project" in fn_low or "code" in fn_low or "diagram" in fn_low:
                category = "project_image"
            elif "tree" in detected_objects or "sky" in detected_objects or "nature" in detected_objects:
                category = "photograph"
                if "outdoor" not in detected_scenes:
                    detected_scenes.append("outdoor")
            elif "person" in detected_objects:
                category = "photograph"
            else:
                category = "photograph" if not is_screenshot else "screenshot"

            # Default scene if empty
            if not detected_scenes:
                detected_scenes.append("indoor" if is_screenshot or "office" in detected_scenes else "outdoor")

            # Deduplicate items
            clean_objects = sorted(list(set(detected_objects)))
            clean_scenes = sorted(list(set(detected_scenes)))

            return {
                "visual_category": category,
                "is_screenshot": is_screenshot,
                "screenshot_confidence": sc_confidence,
                "detected_objects": clean_objects,
                "detected_scenes": clean_scenes,
                "dominant_colors": [dominant_hex]
            }

        except Exception as e:
            logger.error(f"Error in visual content detection for {image_path}: {e}", exc_info=True)
            return {
                "visual_category": "other",
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "detected_objects": [],
                "detected_scenes": ["general"],
                "dominant_colors": ["#808080"]
            }

visual_content_detector = VisualContentDetector()
