import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    PDFHealthResponse,
    PDFInspectRequest,
    PDFInspectResponse,
    PDFCreateBlankRequest,
    PDFManipulateRequest,
    PDFMergeRequest,
    PDFAlternateRequest,
    PDFAlternatePreviewRequest,
    PDFAlternatePreviewResponse,
    PDFGenerateDocumentRequest,
    PDFSplitRequest,
    PDFImagesToPDFRequest,
    PDFOperationResponse,
    PDFDocumentCreateSchema,
    PDFDocumentRecordResponse,
    PDFPageRecordResponse,
    PDFPageUpdateSchema,
    PDFReorderRequest,
    PDFExtractPagesRequest,
    PDFToImagesRequest,
    PDFSplitToPagesRequest,
    PDFMultiConversionResponse,
    PDFBatchSaveAnnotationsRequest,
    PDFAnnotationResponse,
    PDFExportWithAnnotationsRequest,
    FileResponse,
    FolderResponse,
    SearchRequest,
    SearchResponse,
    PDFMemoraFilesQuerySchema,
    PDFMemoraFilesResponseSchema,
    PDFExportImageComparisonRequest,
    PDFWorkspaceExportRequest,
    PDFDraftCreateSchema,
    PDFDraftResponse
)
from ..services.pdf_service import pdf_service

from fastapi.responses import FileResponse as FastAPIFileResponse
from ..database import get_db

logger = logging.getLogger("memora.pdf_route")

router = APIRouter(prefix="/api/pdf", tags=["PDF Studio"])


@router.get("/preview-file")
def get_pdf_preview_file(file_path: str):
    """
    Serves a physical compiled PDF file for PDF Studio preview viewer.
    """
    import os
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Preview file not found: {file_path}")
    return FastAPIFileResponse(os.path.abspath(file_path), media_type="application/pdf")


@router.get("/health", response_model=PDFHealthResponse)
def pdf_studio_health():
    """
    Returns operational health status and dependency readiness for PDF Studio.
    """
    try:
        health_info = pdf_service.is_ready()
        return PDFHealthResponse(
            status=health_info["status"],
            pypdf_available=health_info["pypdf_available"],
            pil_available=health_info["pil_available"],
            reportlab_available=health_info.get("reportlab_available", True),
            version="1.0.0"
        )
    except Exception as e:
        logger.error(f"Error checking PDF Studio health: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check PDF Studio service health."
        )


@router.post("/inspect", response_model=PDFInspectResponse)
def inspect_pdf_document(req: PDFInspectRequest):
    """
    Inspects a local PDF document and returns page metrics, rotation, dimensions, and metadata.
    """
    try:
        data = pdf_service.inspect_pdf(req.file_path)
        return PDFInspectResponse(**data)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error inspecting PDF file '{req.file_path}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to process or read PDF document structure."
        )


@router.post("/create-blank", response_model=PDFOperationResponse)
def create_blank_pdf(req: PDFCreateBlankRequest, db: Session = Depends(get_db)):
    """
    Creates a new blank PDF file with standard page dimensions (A4, Letter, Legal) and orientation.
    """
    try:
        res = pdf_service.create_blank_pdf(
            file_name=req.file_name,
            output_dir=req.output_dir,
            page_count=req.page_count or 1,
            page_size=req.page_size or "A4",
            orientation=req.orientation or "portrait",
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to create blank PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred while creating blank PDF file."
        )


@router.post("/manipulate", response_model=PDFOperationResponse)
def manipulate_pdf_pages(req: PDFManipulateRequest, db: Session = Depends(get_db)):
    """
    Performs page manipulations (rotate, delete, duplicate, add_blank, add_source) on a PDF document.
    """
    try:
        actions_dict = [a.model_dump() for a in req.actions]
        res = pdf_service.manipulate_pages(
            source_path=req.source_path,
            actions=actions_dict,
            output_path=req.output_path,
            db=db,
            sync_db=req.sync_db if req.sync_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to manipulate PDF pages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to apply requested page operations: {e}"
        )


@router.post("/reorder", response_model=PDFOperationResponse)
def reorder_pdf_pages(req: PDFReorderRequest, db: Session = Depends(get_db)):
    """
    Reorders physical pages in a PDF document according to a specified page sequence.
    """
    try:
        res = pdf_service.reorder_pages(
            source_path=req.source_path,
            new_page_order=req.new_page_order,
            output_path=req.output_path,
            db=db,
            sync_db=req.sync_db if req.sync_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to reorder PDF pages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred while reordering PDF pages."
        )


@router.post("/extract-pages", response_model=PDFOperationResponse)
def extract_pdf_pages(req: PDFExtractPagesRequest, db: Session = Depends(get_db)):
    """
    Creates a new PDF containing only the specified page indices.
    """
    try:
        res = pdf_service.extract_pages(
            source_path=req.source_path,
            pages=req.pages,
            output_path=req.output_path,
            db=db,
            sync_db=req.sync_db if req.sync_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to extract PDF pages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred while extracting PDF pages."
        )


@router.post("/merge", response_model=PDFOperationResponse)
def merge_pdf_documents(req: PDFMergeRequest, db: Session = Depends(get_db)):
    """
    Merges multiple PDF documents into a single target output PDF.
    """
    try:
        res = pdf_service.merge_pdfs(
            source_paths=req.source_paths,
            output_path=req.output_path,
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to merge PDF files: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred during PDF merging operation."
        )


@router.post("/alternate", response_model=PDFOperationResponse)
def alternate_pdf_pages(req: PDFAlternateRequest, db: Session = Depends(get_db)):
    """
    Interleaves pages from two PDF documents in alternating sequence (A->B->A->B or B->A->B->A).
    Preserves all remaining pages if document lengths differ.
    """
    try:
        res = pdf_service.alternate_pages(
            pdf1_path=req.pdf1_path,
            pdf2_path=req.pdf2_path,
            output_path=req.output_path,
            start_with=req.start_with or "pdf1",
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to alternate PDF pages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred during PDF alternating operation."
        )


@router.post("/alternate/preview", response_model=PDFAlternatePreviewResponse)
def preview_alternate_pdf_pages(req: PDFAlternatePreviewRequest):
    """
    Generates preview mapping of interleaved page sequence before executing alternate export.
    """
    try:
        res = pdf_service.preview_alternate_pages(
            pdf1_path=req.pdf1_path,
            pdf2_path=req.pdf2_path,
            start_with=req.start_with or "pdf1"
        )
        return PDFAlternatePreviewResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate alternate pages preview: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred generating alternate pages preview."
        )


@router.post("/generate", response_model=PDFOperationResponse)
def generate_pdf_document(req: PDFGenerateDocumentRequest, db: Session = Depends(get_db)):
    """
    Generates a structured, professional PDF document using ReportLab (Text, Images, Image+Text, Headings).
    """
    try:
        sections_dict = [s.model_dump() for s in req.sections] if req.sections else []
        res = pdf_service.generate_document_with_reportlab(
            output_path=req.output_path,
            title=req.title or "Document",
            author=req.author or "Memora AI",
            subject=req.subject,
            page_size=req.page_size or "A4",
            orientation=req.orientation or "portrait",
            margin_points=req.margin_points if req.margin_points is not None else 36.0,
            include_page_numbers=req.include_page_numbers if req.include_page_numbers is not None else True,
            sections=sections_dict,
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to generate ReportLab PDF document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred generating PDF document with ReportLab."
        )



@router.post("/convert/pdf-to-images", response_model=PDFMultiConversionResponse)
def convert_pdf_to_images(req: PDFToImagesRequest):
    """
    Renders/extracts pages of a PDF document into real image files (PNG, JPG, WebP).
    """
    try:
        res = pdf_service.pdf_to_images(
            source_path=req.source_path,
            output_dir=req.output_dir,
            image_format=req.image_format or "PNG",
            page_selection=req.page_selection or "all",
            pages=req.pages,
            start_page=req.start_page,
            end_page=req.end_page,
            quality=req.quality or 95
        )
        return PDFMultiConversionResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to convert PDF to images: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred converting PDF document to images."
        )


@router.post("/split", response_model=PDFMultiConversionResponse)
def split_pdf_document(req: PDFSplitToPagesRequest, db: Session = Depends(get_db)):
    """
    Splits a PDF document into separate page PDF files (every page, selected pages, or page range).
    """
    try:
        res = pdf_service.split_pdf(
            source_path=req.source_path,
            output_dir=req.output_dir,
            split_mode=req.split_mode or "every_page",
            pages=req.pages,
            start_page=req.start_page,
            end_page=req.end_page,
            naming_prefix=req.naming_prefix,
            db=db,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFMultiConversionResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to split PDF document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred during PDF splitting operation."
        )


@router.post("/images-to-pdf", response_model=PDFOperationResponse)
def convert_images_to_pdf(req: PDFImagesToPDFRequest, db: Session = Depends(get_db)):
    """
    Converts one or more image files (PNG, JPG, WebP) into a combined PDF file.
    """
    try:
        res = pdf_service.images_to_pdf(
            image_paths=req.image_paths,
            output_path=req.output_path,
            page_size=req.page_size,
            orientation=req.orientation or "portrait",
            fit_to_page=req.fit_to_page or False,
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to convert images to PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred converting image files to PDF."
        )


# ==========================================
# DATABASE PERSISTENCE ENDPOINTS
# ==========================================

@router.post("/documents", response_model=PDFDocumentRecordResponse)
def create_or_register_pdf_document(req: PDFDocumentCreateSchema, db: Session = Depends(get_db)):
    """
    Creates or registers a persistent PDF document record and its pages in SQLite database.
    """
    try:
        doc = pdf_service.register_or_get_document_record(
            db=db,
            file_path=req.file_path,
            title=req.title,
            file_id=req.file_id
        )
        return PDFDocumentRecordResponse.model_validate(doc)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to register PDF document record: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error registering PDF document in database."
        )


@router.get("/documents/{document_id}", response_model=PDFDocumentRecordResponse)
def get_pdf_document_record(document_id: int, db: Session = Depends(get_db)):
    """
    Retrieves a persistent PDF Studio document record and its page metadata.
    """
    doc = pdf_service.get_document_record(db=db, doc_id=document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PDF document record ID {document_id} not found."
        )
    return PDFDocumentRecordResponse.model_validate(doc)


@router.get("/documents/{document_id}/pages", response_model=list[PDFPageRecordResponse])
def get_pdf_document_pages(document_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the ordered page list for a persistent PDF document record.
    """
    doc = pdf_service.get_document_record(db=db, doc_id=document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PDF document record ID {document_id} not found."
        )
    return [PDFPageRecordResponse.model_validate(p) for p in doc.pages]


@router.patch("/documents/{document_id}/pages/{page_index}", response_model=PDFPageRecordResponse)
def update_pdf_page_metadata(document_id: int, page_index: int, req: PDFPageUpdateSchema, db: Session = Depends(get_db)):
    """
    Updates persistent rotation and sequence index metadata for a specific PDF page.
    """
    try:
        updated_page = pdf_service.update_page_metadata(
            db=db,
            doc_id=document_id,
            page_index=page_index,
            rotation=req.rotation,
            new_index=req.page_index
        )
        return PDFPageRecordResponse.model_validate(updated_page)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as e:
        logger.error(f"Failed to update PDF page metadata: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating page metadata in database."
        )


@router.post("/documents/{document_id}/annotations", response_model=list[PDFAnnotationResponse])
def save_pdf_annotations(document_id: int, req: PDFBatchSaveAnnotationsRequest, db: Session = Depends(get_db)):
    """
    Saves and associates annotation and text objects with a specific PDF document and page index.
    """
    try:
        annos_dict = [a.model_dump() for a in req.annotations]
        records = pdf_service.save_annotations_to_db(db=db, document_id=document_id, annotations=annos_dict)
        return [PDFAnnotationResponse.model_validate(r) for r in records]
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to save annotations for Document {document_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid annotation payload or failed to persist: {e}"
        )


@router.get("/documents/{document_id}/annotations", response_model=list[PDFAnnotationResponse])
def get_pdf_annotations(document_id: int, page_index: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retrieves stored annotation and text objects for a PDF document, optionally filtered by page_index.
    """
    try:
        results = pdf_service.get_annotations_for_document(db=db, document_id=document_id, page_index=page_index)
        return [PDFAnnotationResponse.model_validate(r) for r in results]
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as e:
        logger.error(f"Failed to retrieve annotations for Document {document_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching document annotations."
        )


@router.post("/export-with-annotations", response_model=PDFOperationResponse)
def export_pdf_with_annotations(req: PDFExportWithAnnotationsRequest, db: Session = Depends(get_db)):
    """
    Generates a real physical PDF file containing requested text overlay, highlights, shapes, drawings, and notes.
    """
    try:
        annos_dict = [a.model_dump() for a in req.annotations] if req.annotations else []
        res = pdf_service.export_pdf_with_annotations(
            source_path=req.source_path,
            output_path=req.output_path,
            annotations=annos_dict,
            db=db,
            register_in_db=req.register_in_db if req.register_in_db is not None else True,
            flatten=req.flatten if req.flatten is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to export PDF with annotations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to export PDF with annotations: {e}"
        )


@router.post("/export-workspace", response_model=PDFOperationResponse)
def export_workspace_pdf(req: PDFWorkspaceExportRequest, db: Session = Depends(get_db)):
    """
    Compiles physical PDF directly from complete PDF Studio frontend workspace state.
    Assembles base pages (PDF pages, image pages, blank pages), applies text overlays and annotations,
    verifies output file on disk, and registers in Memora database if requested.
    """
    try:
        pages_dict = [p.model_dump() for p in req.pages]
        res = pdf_service.export_workspace_pdf(
            output_path=req.output_path,
            pages=pages_dict,
            page_size=req.page_size or "A4",
            orientation=req.orientation or "portrait",
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to export workspace PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to export workspace PDF: {e}"
        )


# ==========================================
# MEMORA FILE SYSTEM INTEGRATION ENDPOINTS
# ==========================================

@router.get("/memora/files", response_model=PDFMemoraFilesResponseSchema)
def get_memora_files_for_pdf_studio(
    file_type: Optional[str] = "all",
    folder_id: Optional[int] = None,
    query: Optional[str] = None,
    limit: Optional[int] = 50,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db)
):
    """
    Retrieves real existing Memora files (PDFs, images, documents) from core file system for PDF Studio.
    """
    try:
        res = pdf_service.get_memora_files(
            db=db,
            file_type=file_type or "all",
            folder_id=folder_id,
            query=query,
            limit=limit or 50,
            offset=offset or 0
        )
        return PDFMemoraFilesResponseSchema(
            total=res["total"],
            files=[FileResponse.model_validate(f) for f in res["files"]]
        )
    except Exception as e:
        logger.error(f"Failed to retrieve Memora files for PDF Studio: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching files from Memora file system."
        )


@router.post("/memora/search", response_model=SearchResponse)
def search_memora_files_for_pdf_studio(req: SearchRequest, db: Session = Depends(get_db)):
    """
    Reuses Module 1 semantic/hybrid search infrastructure to find relevant files for PDF Studio.
    """
    try:
        file_type = req.filters.file_type if req.filters else None
        res_data = pdf_service.search_memora_files_for_pdf_studio(
            db=db,
            query=req.query,
            top_k=req.top_k or 20,
            file_type=file_type
        )
        return SearchResponse(**res_data)
    except Exception as e:
        logger.error(f"Failed to search Memora files for PDF Studio: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error executing search over Memora files."
        )



@router.get("/memora/folders", response_model=list[FolderResponse])
def get_memora_folders_for_pdf_studio(db: Session = Depends(get_db)):
    """
    Retrieves active folders from Memora file system for PDF Studio folder selection.
    """
    try:
        from ..models import Folder
        folders = db.query(Folder).filter(Folder.is_active == True).all()
        return [FolderResponse.model_validate(f) for f in folders]
    except Exception as e:
        logger.error(f"Failed to retrieve Memora folders for PDF Studio: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching folders from Memora file system."
        )


@router.post("/export-image-comparison", response_model=PDFOperationResponse)
def export_image_comparison_to_pdf(req: PDFExportImageComparisonRequest, db: Session = Depends(get_db)):
    """
    Exports Module 3 image comparison results into a physical PDF document using PDF Studio.
    """
    try:
        res = pdf_service.export_image_comparison_to_pdf(
            image_paths=req.image_paths,
            output_path=req.output_path,
            title=req.title or "Image Comparison Report",
            similarity_score=req.similarity_score,
            notes=req.notes,
            db=db,
            folder_id=req.folder_id,
            register_in_db=req.register_in_db if req.register_in_db is not None else True
        )
        return PDFOperationResponse(**res)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to export image comparison PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error exporting image comparison to PDF."
        )


# ==========================================
# PDF STUDIO REAL DRAFTS PERSISTENCE
# ==========================================

@router.post("/drafts", response_model=PDFDraftResponse)
def save_pdf_draft(req: PDFDraftCreateSchema, db: Session = Depends(get_db)):
    """
    Persists document model JSON for PDF Studio real draft functionality.
    """
    try:
        draft = pdf_service.save_draft(
            db=db,
            draft_id=req.id,
            name=req.name or "Untitled PDF",
            document_json=req.document_json,
            page_count=req.page_count or 1
        )
        return PDFDraftResponse.model_validate(draft)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to save PDF draft: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save workspace draft.")


@router.get("/drafts", response_model=list[PDFDraftResponse])
def list_pdf_drafts(db: Session = Depends(get_db)):
    """
    Lists all saved workspace drafts for PDF Studio.
    """
    try:
        drafts = pdf_service.list_drafts(db=db)
        return [PDFDraftResponse.model_validate(d) for d in drafts]
    except Exception as e:
        logger.error(f"Failed to list PDF drafts: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list workspace drafts.")


@router.get("/drafts/{draft_id}", response_model=PDFDraftResponse)
def get_pdf_draft(draft_id: str, db: Session = Depends(get_db)):
    """
    Fetches exact document model JSON for a specific PDF draft.
    """
    try:
        draft = pdf_service.get_draft(db=db, draft_id=draft_id)
        return PDFDraftResponse.model_validate(draft)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as e:
        logger.error(f"Failed to fetch draft '{draft_id}': {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch workspace draft.")


@router.delete("/drafts/{draft_id}")
def delete_pdf_draft(draft_id: str, db: Session = Depends(get_db)):
    """
    Deletes a saved workspace draft.
    """
    try:
        return pdf_service.delete_draft(db=db, draft_id=draft_id)
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as e:
        logger.error(f"Failed to delete draft '{draft_id}': {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete workspace draft.")


# ==========================================
# EMAIL SHARING ENDPOINTS (GMAIL OAUTH 2.0)
# ==========================================

from ..services.email_service import email_service


@router.get("/email/status")
def get_email_auth_status():
    """
    Checks if Gmail OAuth is configured and connected.
    """
    return {
        "configured": email_service.is_configured(),
        "connected": email_service.is_connected()
    }


@router.get("/email/auth-url")
def get_email_auth_url(redirect_uri: Optional[str] = "http://localhost:8000/api/pdf/email/oauth-callback"):
    """
    Returns Google OAuth 2.0 authorization URL for gmail.send scope.
    """
    return email_service.get_auth_url(redirect_uri=redirect_uri or "http://localhost:8000/api/pdf/email/oauth-callback")


@router.post("/email/oauth-callback")
def handle_email_oauth_callback(payload: dict):
    """
    Exchanges OAuth authorization code for credentials token.
    """
    code = payload.get("code")
    redirect_uri = payload.get("redirect_uri", "http://localhost:8000/api/pdf/email/oauth-callback")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth authorization code is required.")
    try:
        return email_service.handle_oauth_callback(code=code, redirect_uri=redirect_uri)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/email/send")
def send_pdf_via_email(payload: dict):
    """
    Sends verified PDF file to recipient via Gmail API.
    """
    to_email = payload.get("to")
    subject = payload.get("subject", "Memora AI PDF Document")
    message = payload.get("message", "")
    pdf_path = payload.get("pdf_path")

    if not to_email or not pdf_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient email ('to') and 'pdf_path' are required.")

    try:
        return email_service.send_pdf_email(
            to_email=to_email,
            subject=subject,
            message_body=message,
            pdf_path=pdf_path
        )
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(re))
    except Exception as e:
        logger.error(f"Error sending PDF via Email: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send email: {e}")


# ==========================================
# WHATSAPP SHARING ENDPOINTS (CLOUD API)
# ==========================================

from ..services.whatsapp_service import whatsapp_service


@router.get("/whatsapp/status")
def get_whatsapp_status():
    """
    Checks if WhatsApp Cloud API is configured in backend environment.
    """
    return whatsapp_service.get_status()


@router.post("/whatsapp/send")
def send_pdf_via_whatsapp(payload: dict):
    """
    Sends verified PDF file via official WhatsApp Business Cloud API.
    """
    phone_number = payload.get("phone_number")
    pdf_path = payload.get("pdf_path")
    caption = payload.get("caption")

    if not phone_number or not pdf_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'phone_number' and 'pdf_path' are required.")

    try:
        return whatsapp_service.send_pdf_document(
            phone_number=phone_number,
            pdf_path=pdf_path,
            caption=caption
        )
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))
    except Exception as e:
        logger.error(f"Error sending PDF via WhatsApp: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send WhatsApp message: {e}")





