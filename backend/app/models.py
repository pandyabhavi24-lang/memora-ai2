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


# ==========================================
# MODULE 5 MODELS - SECURITY & PRIVACY
# ==========================================

class SecuritySettings(Base):
    """Stores application security configuration. Only ONE row exists (singleton)."""
    __tablename__ = "security_settings"

    id = Column(Integer, primary_key=True, default=1)
    # PIN stored only as PBKDF2-HMAC-SHA256 hash — NEVER plaintext
    pin_hash = Column(String, nullable=True)   # hex-encoded derived key
    pin_salt = Column(String, nullable=True)   # hex-encoded 32-byte random salt
    lock_enabled = Column(Boolean, default=False, nullable=False)
    pin_iterations = Column(Integer, default=260000, nullable=False)  # documented iteration count
    recovery_email = Column(String, nullable=True)
    recovery_email_verified = Column(Boolean, default=False, nullable=False)
    reset_code_hash = Column(String, nullable=True)
    reset_code_expires_at = Column(DateTime, nullable=True)
    reset_code_attempts = Column(Integer, default=0, nullable=False)
    reset_code_used_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExcludedFolder(Base):
    """Paths explicitly excluded from scanning/indexing by the user."""
    __tablename__ = "excluded_folders"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, nullable=False, index=True)  # resolved/canonical path
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """
    Security and data-operation audit trail.
    NEVER stores: PINs, passwords, session tokens, file contents, OCR text.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)   # e.g. "pin_verified", "folder_added"
    status = Column(String, nullable=False)               # "success" | "failure"
    resource = Column(String, nullable=True)              # safe path/name — NO secrets
    details = Column(Text, nullable=True)                 # JSON metadata — NO secrets
    error = Column(Text, nullable=True)                   # error message if status=failure
