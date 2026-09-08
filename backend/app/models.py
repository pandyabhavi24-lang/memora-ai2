from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from .database import Base

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    files = relationship("File", back_populates="folder", cascade="all, delete-orphan")


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)
    path = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    extension = Column(String, nullable=False, index=True)
    size = Column(Integer, nullable=False)
    modified_at = Column(DateTime, nullable=False)
    file_hash = Column(String, nullable=False, index=True)
    mime_type = Column(String, nullable=True)
    extracted_text = Column(Text, nullable=True)
    extraction_status = Column(String, default="pending")  # pending, success, failed, skipped
    smart_tags = Column(Text, nullable=True)  # JSON-encoded list of strings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    folder = relationship("Folder", back_populates="files")
    chunks = relationship("Chunk", back_populates="file", cascade="all, delete-orphan")
    suggestions = relationship("OrganizationSuggestion", back_populates="file", cascade="all, delete-orphan")

    def get_smart_tags(self) -> list:
        if not self.smart_tags:
            return []
        try:
            import json
            tags = json.loads(self.smart_tags)
            return tags if isinstance(tags, list) else []
        except Exception:
            return [t.strip() for t in self.smart_tags.split(",") if t.strip()]

    def set_smart_tags(self, tags: list):
        import json
        if isinstance(tags, list):
            clean = []
            seen = set()
            for t in tags:
                if t and str(t).strip():
                    item = str(t).strip()
                    if item.lower() not in seen:
                        seen.add(item.lower())
                        clean.append(item)
            self.smart_tags = json.dumps(clean)
        else:
            self.smart_tags = json.dumps([])



class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    word_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File", back_populates="chunks")
    vector_mapping = relationship("VectorMapping", back_populates="chunk", uselist=False, cascade="all, delete-orphan")


class VectorMapping(Base):
    __tablename__ = "vector_mappings"

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, ForeignKey("chunks.id", ondelete="CASCADE"), nullable=False, unique=True)
    faiss_id = Column(Integer, nullable=False, unique=True, index=True)

    chunk = relationship("Chunk", back_populates="vector_mapping")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, nullable=False, index=True)
    result_count = Column(Integer, nullable=False)
    execution_time_ms = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ==========================================
# MODULE 2 MODELS - INTELLIGENT ORGANIZATION
# ==========================================

class OrganizationCategory(Base):
    __tablename__ = "organization_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    suggestions = relationship("OrganizationSuggestion", back_populates="category")


class OrganizationSuggestion(Base):
    __tablename__ = "organization_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("organization_categories.id", ondelete="CASCADE"), nullable=False)
    confidence = Column(Integer, nullable=False)  # 0 to 100
    confidence_level = Column(String, nullable=False)  # High, Medium, Low
    reason = Column(Text, nullable=False)
    status = Column(String, default="pending", index=True)  # pending, accepted, rejected, edited
    smart_tags = Column(Text, nullable=True)  # JSON-encoded list of strings
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    file = relationship("File", back_populates="suggestions")
    category = relationship("OrganizationCategory", back_populates="suggestions")

    def get_smart_tags(self) -> list:
        if self.smart_tags:
            try:
                import json
                tags = json.loads(self.smart_tags)
                if isinstance(tags, list) and tags:
                    return tags
            except Exception:
                pass
        if self.file:
            return self.file.get_smart_tags()
        return []

    def set_smart_tags(self, tags: list):
        import json
        if isinstance(tags, list):
            clean = []
            seen = set()
            for t in tags:
                if t and str(t).strip():
                    item = str(t).strip()
                    if item.lower() not in seen:
                        seen.add(item.lower())
                        clean.append(item)
            self.smart_tags = json.dumps(clean)
            if self.file:
                self.file.set_smart_tags(clean)
        else:
            self.smart_tags = json.dumps([])



class DuplicateGroup(Base):
    __tablename__ = "duplicate_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_key = Column(String, unique=True, index=True, nullable=False)
    file_a_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    file_b_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    detection_type = Column(String, nullable=False)  # exact, similar
    similarity = Column(Float, nullable=False)  # e.g., 96.0 or 100.0
    status = Column(String, default="unresolved", index=True)  # unresolved, kept_both, resolved
    created_at = Column(DateTime, default=datetime.utcnow)

    file_a = relationship("File", foreign_keys=[file_a_id])
    file_b = relationship("File", foreign_keys=[file_b_id])


class FileOperation(Base):
    __tablename__ = "file_operations"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    source_path = Column(String, nullable=False)
    destination_path = Column(String, nullable=False)
    operation_type = Column(String, nullable=False, default="move")  # move, copy
    status = Column(String, nullable=False, default="pending")  # pending, completed, failed, reverted
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    file = relationship("File")


# ==============================================================================
# MODULE 3 MODELS - VISUAL & MEDIA INTELLIGENCE
# ==============================================================================

class MediaAnalysis(Base):
    """
    Stores comprehensive visual & quality intelligence for images and videos.
    """
    __tablename__ = "media_analyses"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    media_type = Column(String, nullable=False, default="image")  # image, video
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # in seconds for videos
    frame_rate = Column(Float, nullable=True)
    aspect_ratio = Column(String, nullable=True)  # e.g., "16:9", "4:3", "1:1"
    
    # Quality & Sharpness metrics
    quality_score = Column(Float, nullable=False, default=0.0)  # 0 to 100
    sharpness_score = Column(Float, nullable=True)  # Laplacian variance / gradient
    blur_score = Column(Float, nullable=True)  # Estimated blur factor 0-100
    quality_factors = Column(Text, nullable=True)  # JSON breakdown (e.g. {"sharpness": "High", "resolution": "4000x3000"})
    
    # Visual classification & content
    visual_category = Column(String, nullable=True)  # photograph, screenshot, scanned_document, event_photo, project_image, etc.
    is_screenshot = Column(Boolean, default=False, index=True)
    screenshot_confidence = Column(Float, default=0.0)
    
    detected_objects = Column(Text, nullable=True)  # JSON-encoded list of objects (e.g. ["person", "laptop", "tree"])
    detected_scenes = Column(Text, nullable=True)  # JSON-encoded list of scenes (e.g. ["indoor", "workshop", "office"])
    dominant_colors = Column(Text, nullable=True)  # JSON-encoded hex colors
    
    analysis_status = Column(String, default="pending", index=True)  # pending, completed, failed, unsupported
    error_message = Column(Text, nullable=True)
    model_version = Column(String, default="1.0.0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    file = relationship("File")

    def get_detected_objects(self) -> list:
        if not self.detected_objects:
            return []
        try:
            import json
            objs = json.loads(self.detected_objects)
            return objs if isinstance(objs, list) else []
        except Exception:
            return []

    def set_detected_objects(self, objs: list):
        import json
        self.detected_objects = json.dumps(objs if isinstance(objs, list) else [])

    def get_detected_scenes(self) -> list:
        if not self.detected_scenes:
            return []
        try:
            import json
            scenes = json.loads(self.detected_scenes)
            return scenes if isinstance(scenes, list) else []
        except Exception:
            return []

    def set_detected_scenes(self, scenes: list):
        import json
        self.detected_scenes = json.dumps(scenes if isinstance(scenes, list) else [])

    def get_quality_factors(self) -> dict:
        if not self.quality_factors:
            return {}
        try:
            import json
            qf = json.loads(self.quality_factors)
            return qf if isinstance(qf, dict) else {}
        except Exception:
            return {}

    def set_quality_factors(self, factors: dict):
        import json
        self.quality_factors = json.dumps(factors if isinstance(factors, dict) else {})


class MediaEmbedding(Base):
    """
    Maps a media file to its visual vector position in the separate Visual FAISS index.
    """
    __tablename__ = "media_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    visual_faiss_id = Column(Integer, nullable=False, unique=True, index=True)
    vector_dimension = Column(Integer, default=512)
    model_version = Column(String, default="clip-vit-b-32")
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File")


class MediaSimilarity(Base):
    """
    Pairwise visual similarity scores between media files.
    """
    __tablename__ = "media_similarities"

    id = Column(Integer, primary_key=True, index=True)
    file_a_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    file_b_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    similarity_score = Column(Float, nullable=False)  # 0.0 to 100.0%
    similarity_type = Column(String, nullable=False)  # exact, near_duplicate, visually_similar
    created_at = Column(DateTime, default=datetime.utcnow)

    file_a = relationship("File", foreign_keys=[file_a_id])
    file_b = relationship("File", foreign_keys=[file_b_id])


class MediaRecommendation(Base):
    """
    AI-driven explainable cleanup recommendations (e.g. redundant lower-quality media).
    Requires explicit manual user approval. Never auto-deletes files.
    """
    __tablename__ = "media_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    target_better_file_id = Column(Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False, default="review")  # keep, review, remove, ignore
    recommendation_score = Column(Float, nullable=False)  # 0.0 to 100.0
    reason = Column(Text, nullable=False)
    potential_storage_recovery = Column(Integer, default=0)  # in bytes
    status = Column(String, default="pending", index=True)  # pending, kept, removed, ignored
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File", foreign_keys=[file_id])
    target_better_file = relationship("File", foreign_keys=[target_better_file_id])


class MediaGroup(Base):
    """
    Logical visual clusters of related media without physical directory movement.
    """
    __tablename__ = "media_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String, nullable=False)  # e.g. "Workshop Series", "Nature & Outdoors", "Screenshots"
    group_type = Column(String, nullable=False, default="visual_cluster")  # category, similarity, screenshot, event
    representative_file_id = Column(Integer, ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    item_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    representative_file = relationship("File")
    items = relationship("MediaGroupItem", back_populates="group", cascade="all, delete-orphan")


class MediaGroupItem(Base):
    __tablename__ = "media_group_items"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("media_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("MediaGroup", back_populates="items")
    file = relationship("File")


class MediaSearchContent(Base):
    """
    Searchable textual and conceptual representation of visual media generated by Module 3
    for consumption by Module 1 Hybrid Semantic Search.
    """
    __tablename__ = "media_search_content"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    content_type = Column(String, default="visual")  # visual, visual_ocr_hybrid
    search_text = Column(Text, nullable=False)  # e.g., "person tree mountain sky lake outdoor nature landscape photograph"
    visual_description = Column(Text, nullable=True)  # e.g., "An outdoor landscape containing mountains, trees, sky, and water."
    detected_objects_with_conf = Column(Text, nullable=True)  # JSON: [{"object": "tree", "confidence": 0.94}, ...]
    detected_scenes_with_conf = Column(Text, nullable=True)  # JSON: [{"scene": "nature", "confidence": 0.96}, ...]
    source = Column(String, default="module3")
    confidence = Column(Float, default=0.9)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    file = relationship("File")

    def get_objects_with_confidence(self) -> list:
        if not self.detected_objects_with_conf:
            return []
        try:
            import json
            objs = json.loads(self.detected_objects_with_conf)
            return objs if isinstance(objs, list) else []
        except Exception:
            return []

    def get_scenes_with_confidence(self) -> list:
        if not self.detected_scenes_with_conf:
            return []
        try:
            import json
            scns = json.loads(self.detected_scenes_with_conf)
            return scns if isinstance(scns, list) else []
        except Exception:
            return []


