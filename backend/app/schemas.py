from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

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
    created_at: datetime
    updated_at: datetime

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

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 20
    filters: Optional[SearchFilters] = None
    sort_by: Optional[str] = "relevant"

class SearchResultItem(BaseModel):
    file_id: int
    file_name: str
    file_path: str
    folder_name: str
    extension: str
    category: str
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


class SuggestionItemResponse(BaseModel):
    id: str
    db_id: int
    file_id: int
    filename: str
    type: str
    currentPath: str
    suggestedCategory: str
    confidence: int
    confidenceLevel: str
    reason: str
    status: str

    class Config:
        from_attributes = True


class SuggestionUpdate(BaseModel):
    status: Optional[str] = None  # Accepted, Rejected, Edited, Pending
    suggestedCategory: Optional[str] = None


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


class OrganizationApplyResponse(BaseModel):
    status: str
    files_moved: int
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
