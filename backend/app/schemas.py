from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator

# Folder Schemas
class FolderBase(BaseModel):
    path: str
    name: Optional[str] = None

class FolderCreate(FolderBase):
    pass

class FolderResponse(BaseModel):
    id: int
    path: str
    name: str
    file_count: int = 0
    scan_status: str = "ready"
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


# File Schemas
class FileResponse(BaseModel):
    id: int
    folder_id: int
    path: str
    name: str
    extension: str
    size: int
    modified_at: datetime
    file_hash: str
    mime_type: Optional[str] = None
    extraction_status: str
    smart_tags: List[str] = []
    created_at: datetime
    updated_at: datetime

    @field_validator('smart_tags', mode='before')
    @classmethod
    def parse_smart_tags(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                import json
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return []

    class Config:
        from_attributes = True

class FileDetailResponse(FileResponse):
    extracted_text: Optional[str] = None
    chunk_count: int = 0


# Search Schemas
class SearchFilters(BaseModel):
    file_type: Optional[str] = None
    folder_id: Optional[int] = None
    date_range: Optional[str] = None
    size: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    labels: Optional[List[str]] = None
    smart_tags: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    relevance: Optional[str] = None

class FileTagsUpdate(BaseModel):
    tags: List[str] = []

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 20
    filters: Optional[SearchFilters] = None
    sort_by: Optional[str] = "relevant"

from typing import List, Optional, Dict, Any

class SearchResultItem(BaseModel):
    document_id: Optional[int] = None
    file_id: int
    filename: Optional[str] = None
    file_name: str
    file_path: str
    folder_name: str
    extension: str
    category: str
    smart_tags: List[str] = []
    semantic_score: Optional[float] = 0.0
    lexical_score: Optional[float] = 0.0
    final_score: Optional[float] = 0.0
    score: float
    matched_snippet: str
    ai_explanation: str
    chunk_id: int
    modified_at: str
    size_bytes: int

class SearchResponse(BaseModel):
    query: str
    total: int
    execution_time_ms: float
    results: List[SearchResultItem]
    debug: Optional[Dict[str, Any]] = None



# Search History Schema
class SearchHistoryItem(BaseModel):
    id: int
    query: str
    result_count: int
    execution_time_ms: float
    created_at: datetime

    class Config:
        from_attributes = True


# Scan Status Schema
class ScanStatusResponse(BaseModel):
    status: str  # idle, scanning, complete, failed
    files_found: int = 0
    files_processed: int = 0
    files_failed: int = 0
    chunks_created: int = 0
    vectors_created: int = 0
    current_file: Optional[str] = ""
    progress_percentage: int = 0
    error_message: Optional[str] = None


# Dashboard Statistics Schema
class StatisticsResponse(BaseModel):
    folders: int
    files: int
    chunks: int
    vectors: int
    searches: int
    recent_files: List[FileResponse]
    recent_searches: List[SearchHistoryItem]


# ==========================================
# MODULE 2 SCHEMAS - INTELLIGENT ORGANIZATION
# ==========================================

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class CategoryOverviewItem(BaseModel):
    category: str
    fileCount: int
    totalFiles: int
    percentage: float


class PhysicalFolderOverviewItem(BaseModel):
    name: str
    path: str
    displayPath: str
    fileCount: int
    subfolders: List[Dict[str, Any]] = []


class OrganizationOverviewResponse(BaseModel):
    existingFolders: List[PhysicalFolderOverviewItem] = []
    aiCategories: List[CategoryOverviewItem] = []
    totalFiles: int = 0


class SuggestionItemResponse(BaseModel):
    id: str
    db_id: int
    file_id: int
    filename: str
    type: str
    currentPath: str
    displayPath: Optional[str] = None
    suggestedCategory: str
    smart_tags: List[str] = []
    labels: List[str] = []
    confidence: int
    confidenceLevel: str
    reason: str
    status: str

    class Config:
        from_attributes = True


class SuggestionUpdate(BaseModel):
    status: Optional[str] = None  # Accepted, Rejected, Edited, Pending
    suggestedCategory: Optional[str] = None
    smart_tags: Optional[List[str]] = None


class CollectiveFolderRequest(BaseModel):
    suggestion_ids: Optional[List[str]] = None
    file_ids: Optional[List[int]] = None


class CollectiveFolderResponse(BaseModel):
    suggested_folder_name: str
    reason: str
    common_smart_tags: List[str] = []


class AnalyzeRequest(BaseModel):
    folder_id: Optional[int] = None
    folder_path: Optional[str] = None


class AnalysisSummaryResponse(BaseModel):
    files_analyzed: int
    suggestions_generated: int
    high_confidence: int
    duplicate_groups: int


class OrganizationPreviewItem(BaseModel):
    id: str
    file_id: int
    filename: str
    currentPath: str
    suggestedCategory: str
    proposedPath: str
    operation: str = "move"


class OrganizationPreviewResponse(BaseModel):
    items: List[OrganizationPreviewItem]
    total_files: int


class OrganizationApplyRequest(BaseModel):
    suggestion_ids: Optional[List[str]] = None
    operation_type: Optional[str] = "move"
    destination_folder: Optional[str] = None


class OrganizationApplyResponse(BaseModel):
    status: str
    files_moved: int = 0
    files_copied: int = 0
    errors: List[str] = []
    message: str


class DuplicateFileDetail(BaseModel):
    filename: str
    path: str
    size: str


class DuplicateGroupResponse(BaseModel):
    id: str
    fileA: DuplicateFileDetail
    fileB: DuplicateFileDetail
    similarity: float
    detectionType: str
    status: str


class FileOperationResponse(BaseModel):
    id: int
    file_id: Optional[int]
    filename: str
    source_path: str
    destination_path: str
    operation_type: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
