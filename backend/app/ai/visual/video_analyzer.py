import os
import logging
import cv2
import numpy as np
from PIL import Image
from .quality_analyzer import quality_analyzer
from .object_detector import visual_content_detector
from .visual_embeddings import visual_embedding_service

logger = logging.getLogger("memora.video_analyzer")

class VideoAnalyzer:
    """
    Local Video Intelligence Engine:
    - Analyzes MP4, MKV, MOV, AVI, WEBM, etc.
    - Intelligent representative frame sampling (e.g. 5-8 keyframes across the timeline)
    - Extracts duration, resolution, frame rate, visual quality, detected objects/scenes
    - Aggregates multi-frame embeddings into a single representative video visual vector
    """

    def analyze_video(self, video_path: str, filename: str = "", file_size: int = 0) -> dict:
        if not os.path.exists(video_path):
            return {
                "status": "failed",
                "error": f"Video file not found: {video_path}",
                "media_type": "video",
                "quality_score": 0.0
            }

        cap = None
        try:
            if file_size == 0:
                file_size = os.path.getsize(video_path)

            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return {
                    "status": "unsupported",
                    "error": "Could not open video stream (codec or format unsupported)",
                    "media_type": "video",
                    "quality_score": 0.0,
                    "duration": 0.0,
                    "width": 0,
                    "height": 0
                }

            # 1. Metadata extraction
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = float(cap.get(cv2.CAP_PROP_FPS)) or 24.0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = float(total_frames) / max(0.1, fps) if total_frames > 0 else 0.0

            # Aspect ratio
            ratio_val = width / max(1, height)
            aspect_str = "16:9" if 1.70 <= ratio_val <= 1.85 else ("4:3" if 1.30 <= ratio_val <= 1.40 else f"{ratio_val:.2f}:1")

            # 2. Sample representative frames (5 to 8 equidistant frames)
            sample_count = min(8, max(3, total_frames // 60)) if total_frames > 0 else 1
            sample_indices = np.linspace(0, max(0, total_frames - 1), sample_count, dtype=int)

            frame_embeddings = []
            frame_qualities = []
            frame_objects = set()
            frame_scenes = set()
            frame_sharpnesses = []

            temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "temp_frames")
            os.makedirs(temp_dir, exist_ok=True)

            for idx in sample_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame_bgr = cap.read()
                if not ret or frame_bgr is None:
                    continue

                # Temporary frame save for visual embedding
                temp_frame_path = os.path.join(temp_dir, f"frame_{idx}.jpg")
                cv2.imwrite(temp_frame_path, frame_bgr)

                try:
                    # Analyze frame quality
                    q_res = quality_analyzer.analyze_image_quality(temp_frame_path, file_size=0)
                    frame_qualities.append(q_res["quality_score"])
                    frame_sharpnesses.append(q_res["sharpness_score"])

                    # Analyze frame visual objects and scenes
                    c_res = visual_content_detector.analyze_visual_content(temp_frame_path, filename=filename)
                    for obj in c_res["detected_objects"]:
                        frame_objects.add(obj)
                    for scn in c_res["detected_scenes"]:
                        frame_scenes.add(scn)

                    # Frame embedding
                    f_emb = visual_embedding_service.embed_image(temp_frame_path)
                    if f_emb is not None and np.linalg.norm(f_emb) > 0:
                        frame_embeddings.append(f_emb)
                finally:
                    if os.path.exists(temp_frame_path):
                        try:
                            os.remove(temp_frame_path)
                        except Exception:
                            pass

            cap.release()
            cap = None

            # 3. Aggregate results across frames
            avg_quality = float(np.mean(frame_qualities)) if frame_qualities else 65.0
            avg_sharpness = float(np.mean(frame_sharpnesses)) if frame_sharpnesses else 150.0
            blur_score = max(0.0, min(100.0, 100.0 - (avg_sharpness / 10.0)))

            # Composite video embedding (mean normalized vector)
            if frame_embeddings:
                agg_vec = np.mean(frame_embeddings, axis=0)
                norm = np.linalg.norm(agg_vec)
                video_embedding = (agg_vec / norm).astype(np.float32) if norm > 0 else np.zeros((visual_embedding_service.dimension,), dtype=np.float32)
            else:
                video_embedding = np.zeros((visual_embedding_service.dimension,), dtype=np.float32)

            # Category estimation for video
            fn_low = filename.lower()
            if "workshop" in fn_low or "lecture" in fn_low or "class" in fn_low:
                v_category = "workshop_video"
                frame_scenes.add("workshop")
            elif "event" in fn_low or "conference" in fn_low:
                v_category = "event_video"
                frame_scenes.add("event")
            elif "tutorial" in fn_low or "screencast" in fn_low or "demo" in fn_low:
                v_category = "screen_recording"
            else:
                v_category = "video_recording"

            dur_min = int(duration // 60)
            dur_sec = int(duration % 60)
            dur_str = f"{dur_min:02d}:{dur_sec:02d}"

            quality_factors = {
                "duration": dur_str,
                "resolution": f"{width} × {height}",
                "aspect_ratio": aspect_str,
                "fps": round(fps, 1),
                "sharpness": "High" if avg_sharpness > 250 else ("Medium" if avg_sharpness > 70 else "Low"),
                "file_size": f"{file_size / (1024*1024):.2f} MB"
            }

            return {
                "status": "completed",
                "media_type": "video",
                "duration": round(duration, 2),
                "frame_rate": round(fps, 2),
                "width": width,
                "height": height,
                "aspect_ratio": aspect_str,
                "quality_score": round(avg_quality, 1),
                "sharpness_score": round(avg_sharpness, 2),
                "blur_score": round(blur_score, 1),
                "quality_factors": quality_factors,
                "visual_category": v_category,
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "detected_objects": sorted(list(frame_objects)),
                "detected_scenes": sorted(list(frame_scenes)),
                "dominant_colors": ["#1a1a2e"],
                "embedding": video_embedding
            }

        except Exception as e:
            logger.error(f"Video analysis error for {video_path}: {e}", exc_info=True)
            if cap is not None:
                cap.release()
            return {
                "status": "failed",
                "error": str(e),
                "media_type": "video",
                "duration": 0.0,
                "frame_rate": 0.0,
                "width": 0,
                "height": 0,
                "quality_score": 0.0,
                "quality_factors": {"error": str(e)},
                "visual_category": "video_recording",
                "is_screenshot": False,
                "screenshot_confidence": 0.0,
                "detected_objects": [],
                "detected_scenes": [],
                "dominant_colors": [],
                "embedding": None
            }

video_analyzer = VideoAnalyzer()
