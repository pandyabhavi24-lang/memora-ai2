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
    match_source: Optional[str] = "TEXT"  # TEXT, OCR, VISUAL, HYBRID
    visual_match_details: Optional[Dict[str, Any]] = None
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None
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
    total_size_bytes: Optional[int] = 0
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
    id: Optional[int] = None
    file_id: Optional[int] = None
    db_id: Optional[int] = None
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


# ==========================================
# MODULE 4 SCHEMAS - PDF STUDIO
# ==========================================

class PDFHealthResponse(BaseModel):
    status: str
    pypdf_available: bool
    pil_available: bool
    reportlab_available: bool = True
    version: str = "1.0.0"


class PDFInspectRequest(BaseModel):
    file_path: str


class PDFPageInfo(BaseModel):
    page_index: int
    width: float
    height: float
    rotation: int = 0


class PDFInspectResponse(BaseModel):
    file_path: str
    file_name: str
    file_size_bytes: int
    page_count: int
    encrypted: bool
    pages: List[PDFPageInfo]
    metadata: dict = {}


class PDFCreateBlankRequest(BaseModel):
    file_name: str
    output_dir: Optional[str] = None
    page_count: Optional[int] = 1
    page_size: Optional[str] = "A4"  # A4, Letter, Legal
    orientation: Optional[str] = "portrait"  # portrait, landscape
    folder_id: Optional[int] = None
    register_in_db: Optional[bool] = True


class PDFPageAction(BaseModel):
    action: str  # rotate, delete, duplicate, add_blank, add_source, reorder
    page_index: Optional[int] = None
    target_index: Optional[int] = None
    degrees: Optional[int] = None  # 90, 180, 270
    page_size: Optional[str] = "A4"
    orientation: Optional[str] = "portrait"
    source_pdf_path: Optional[str] = None
    source_page_index: Optional[int] = None


class PDFManipulateRequest(BaseModel):
    source_path: str
    output_path: Optional[str] = None
    actions: List[PDFPageAction]
    sync_db: Optional[bool] = True


class PDFReorderRequest(BaseModel):
    source_path: str
    output_path: Optional[str] = None
    new_page_order: List[int]
    sync_db: Optional[bool] = True


class PDFExtractPagesRequest(BaseModel):
    source_path: str
    output_path: str
    pages: List[int]
    sync_db: Optional[bool] = True


class PDFMergeRequest(BaseModel):
    source_paths: List[str]
    output_path: str
    folder_id: Optional[int] = None
    register_in_db: Optional[bool] = True


class PDFAlternateRequest(BaseModel):
    pdf1_path: str
    pdf2_path: str
    start_with: Optional[str] = "pdf1"  # "pdf1" or "pdf2"
    output_path: str
    folder_id: Optional[int] = None
    register_in_db: Optional[bool] = True


class PDFAlternatePreviewRequest(BaseModel):
    pdf1_path: str
    pdf2_path: str
    start_with: Optional[str] = "pdf1"  # "pdf1" or "pdf2"


class PDFAlternatePageOrder(BaseModel):
    output_page: int
    source: str
    source_page: int
    source_path: str
    label: str


class PDFAlternatePreviewResponse(BaseModel):
    status: str
    total_pages: int
    pdf1_page_count: int
    pdf2_page_count: int
    start_with: str
    page_order: List[PDFAlternatePageOrder]


class PDFGenerateSection(BaseModel):
    type: str = "paragraph"  # 'title', 'heading', 'paragraph', 'image', 'image_and_text', 'page_break', 'spacer'
    title: Optional[str] = None
    text: Optional[str] = None
    image_path: Optional[str] = None
    image_caption: Optional[str] = None
    image_width: Optional[float] = None
    image_height: Optional[float] = None
    layout: Optional[str] = "stacked"  # 'stacked', 'side_by_side'
    font_size: Optional[float] = None
    alignment: Optional[str] = "left"  # 'left', 'center', 'right', 'justify'


class PDFGenerateDocumentRequest(BaseModel):
    output_path: str
    title: Optional[str] = "Document"
    author: Optional[str] = "Memora AI"
    subject: Optional[str] = None
    page_size: Optional[str] = "A4"  # A4, Letter, Legal
    orientation: Optional[str] = "portrait"  # portrait, landscape
    margin_points: Optional[float] = 36.0
    include_page_numbers: Optional[bool] = True
    sections: List[PDFGenerateSection] = []
    folder_id: Optional[int] = None
    register_in_db: Optional[bool] = True


class PDFSplitRequest(BaseModel):
    source_path: str
    output_dir: str
    split_mode: str  # every_page, selected_pages, range
    pages: Optional[List[int]] = None


class PDFImagesToPDFRequest(BaseModel):
    image_paths: List[str]
    output_path: str
    page_size: Optional[str] = None  # auto or A4, Letter, Legal
    orientation: Optional[str] = "portrait"
    fit_to_page: Optional[bool] = False
    folder_id: Optional[int] = None
    register_in_db: Optional[bool] = True


class PDFToImagesRequest(BaseModel):
    source_path: str
    output_dir: str
    image_format: str = "PNG"  # PNG, JPG, WebP
    page_selection: str = "all"  # all, selected, range
    pages: Optional[List[int]] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    quality: Optional[int] = 95


class PDFSplitToPagesRequest(BaseModel):
    source_path: str
    output_dir: str
    split_mode: str = "every_page"  # every_page, selected_pages, range
    pages: Optional[List[int]] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    naming_prefix: Optional[str] = None
    register_in_db: Optional[bool] = True


class PDFMultiConversionResponse(BaseModel):
    status: str
    source_path: str
    total_generated_files: int
    output_dir: str
    generated_files: List[str]
    message: str


class PDFOperationResponse(BaseModel):
    status: str
    output_path: str
    file_name: str
    page_count: int
    file_size_bytes: int
    file_id: Optional[int] = None
    pdf_document_id: Optional[int] = None
    verified: bool = True
    indexed: bool = False
    message: str


class PDFWorkspaceElementSchema(BaseModel):
    id: Optional[str] = None
    type: str = "text"  # 'text', 'image'
    x: float = 0.0  # points from left
    y: float = 0.0  # points from top
    width: float = 200.0  # width in points
    height: float = 50.0  # height in points
    # Text properties
    text: Optional[str] = None
    fontSize: Optional[float] = 14.0
    font_size: Optional[float] = None
    fontWeight: Optional[str] = "normal"  # 'bold' | 'normal'
    font_weight: Optional[str] = None
    fontStyle: Optional[str] = "normal"  # 'italic' | 'normal'
    font_style: Optional[str] = None
    textAlign: Optional[str] = "left"  # 'left' | 'center' | 'right' | 'justify'
    text_align: Optional[str] = None
    color: Optional[str] = "#1e293b"
    lineHeight: Optional[float] = 1.3
    # Image properties
    imagePath: Optional[str] = None
    image_path: Optional[str] = None
    previewUrl: Optional[str] = None
    aspectRatio: Optional[float] = 1.0
    zIndex: Optional[int] = 1
    z_index: Optional[int] = None
    opacity: Optional[float] = 1.0


class PDFWorkspacePageSchema(BaseModel):
    id: Optional[str] = None
    type: str = "blank"  # blank, image, pdf_page
    source_pdf_path: Optional[str] = None
    source_page_index: Optional[int] = 0
    image_path: Optional[str] = None
    preview_url: Optional[str] = None
    path: Optional[str] = None
    rotation: Optional[int] = 0
    title: Optional[str] = None
    elements: Optional[List[PDFWorkspaceElementSchema]] = []
    textOverlays: Optional[List[dict]] = []
    text_overlays: Optional[List[dict]] = []
    annotations: Optional[List[dict]] = []


class PDFWorkspaceExportRequest(BaseModel):
    output_path: str
    pages: List[PDFWorkspacePageSchema]
    page_size: Optional[str] = "A4"
    orientation: Optional[str] = "portrait"
    include_page_numbers: Optional[bool] = False
    title: Optional[str] = "Memora Document"
    register_in_db: Optional[bool] = True
    folder_id: Optional[int] = None



class PDFPageRecordResponse(BaseModel):
    id: int
    pdf_document_id: int
    page_index: int
    original_page_number: Optional[int] = None
    width: float
    height: float
    rotation: int
    source_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PDFDocumentRecordResponse(BaseModel):
    id: int
    file_id: Optional[int] = None
    working_file_path: str
    title: str
    page_count: int
    is_draft: bool
    has_annotations: bool
    created_at: datetime
    updated_at: datetime
    pages: List[PDFPageRecordResponse] = []

    class Config:
        from_attributes = True


class PDFPageUpdateSchema(BaseModel):
    rotation: Optional[int] = None
    page_index: Optional[int] = None


class PDFAnnotationCreateSchema(BaseModel):
    page_index: int
    annotation_type: str  # text, highlight, draw, line, arrow, rectangle, circle, note
    content_text: Optional[str] = None
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    width: Optional[float] = 0.0
    height: Optional[float] = 0.0
    x2: Optional[float] = None
    y2: Optional[float] = None
    color: Optional[str] = "#000000"
    fill_color: Optional[str] = None
    stroke_width: Optional[float] = 2.0
    font_size: Optional[float] = 14.0
    font_family: Optional[str] = "Helvetica"
    font_style: Optional[str] = "normal"  # bold, italic, normal
    alignment: Optional[str] = "left"  # left, center, right
    opacity: Optional[float] = 1.0
    points: Optional[List[List[float]]] = None  # for freehand drawing [[x1,y1], [x2,y2]...]
    properties: Optional[dict] = {}


class PDFAnnotationResponse(BaseModel):
    id: int
    pdf_document_id: int
    page_index: int
    annotation_type: str
    content_text: Optional[str] = None
    properties_json: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PDFBatchSaveAnnotationsRequest(BaseModel):
    annotations: List[PDFAnnotationCreateSchema]


class PDFExportWithAnnotationsRequest(BaseModel):
    source_path: str
    output_path: str
    annotations: Optional[List[PDFAnnotationCreateSchema]] = None
    flatten: Optional[bool] = True
    register_in_db: Optional[bool] = True


class PDFDocumentCreateSchema(BaseModel):
    file_path: str
    title: Optional[str] = None
    file_id: Optional[int] = None


class PDFDraftCreateSchema(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = "Untitled PDF"
    document_json: str
    page_count: Optional[int] = 1


class PDFDraftResponse(BaseModel):
    id: str
    name: str
    document_json: str
    page_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PDFMemoraFilesQuerySchema(BaseModel):
    file_type: Optional[str] = "all"  # pdf, image, scanned, all
    folder_id: Optional[int] = None
    query: Optional[str] = None
    limit: Optional[int] = 50
    offset: Optional[int] = 0


class PDFMemoraFilesResponseSchema(BaseModel):
    total: int
    files: List[FileResponse]


class PDFExportImageComparisonRequest(BaseModel):
    image_paths: List[str]
    output_path: str
    title: Optional[str] = "Image Comparison Report"
    similarity_score: Optional[float] = None
    notes: Optional[str] = None
    folder_id: Optional[int] = None
    register_in_db: Optional[bool] = True


# ==============================================================================
# MODULE 5 SCHEMAS - FILE EXPIRY & RENEWAL REMINDERS
# ==============================================================================

class ExpiryRecordResponse(BaseModel):
    id: int
    file_id: int
    file_name: str
    file_path: str
    file_extension: str
    document_type: str
    date_type: str
    extracted_date: datetime
    issue_date: Optional[datetime] = None
    original_text: Optional[str] = None
    confidence: float
    extraction_method: str
    reason: Optional[str] = None
    status: str
    user_confirmed: bool
    reminder_enabled: bool
    reminder_days_before: int
    last_notified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpirySummaryResponse(BaseModel):
    total_tracked: int
    upcoming: int
    due_soon: int
    expired: int
    needs_review: int
    files_scanned: Optional[int] = None
    expiries_detected: Optional[int] = None
    ollama_available: Optional[bool] = False
    ollama_model: Optional[str] = None


class ExpiryUpdateRequest(BaseModel):
    document_type: Optional[str] = None
    date_type: Optional[str] = None
    extracted_date: Optional[str] = None
    reminder_enabled: Optional[bool] = None
    reminder_days_before: Optional[int] = None
    user_confirmed: Optional[bool] = None
    reason: Optional[str] = None


class OllamaStatusResponse(BaseModel):
    available: bool
    model: str = ""
    base_url: str = ""


class ExpiryConfirmRequest(BaseModel):
    confirmed: bool = True


class ExpiryScanResponse(BaseModel):
    files_scanned: int
    expiries_detected: int
    summary: ExpirySummaryResponse






