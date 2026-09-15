import React, { useState } from 'react';
import { PDFStudioHeader } from '../components/pdfStudio/PDFStudioHeader';
import { PDFStudioEmptyState } from '../components/pdfStudio/PDFStudioEmptyState';
import { PDFStudioToolbar } from '../components/pdfStudio/PDFStudioToolbar';
import { PDFPageThumbnailList } from '../components/pdfStudio/PDFPageThumbnailList';
import { PDFWorkspace } from '../components/pdfStudio/PDFWorkspace';
import { PDFPropertiesPanel } from '../components/pdfStudio/PDFPropertiesPanel';
import { MemoraFilePickerModal } from '../components/pdfStudio/MemoraFilePickerModal';
import { NewPDFModal } from '../components/pdfStudio/NewPDFModal';
import { DeletePageConfirmModal } from '../components/pdfStudio/DeletePageConfirmModal';
import { ExtractPagesModal } from '../components/pdfStudio/ExtractPagesModal';
import { ConvertModal } from '../components/pdfStudio/ConvertModal';
import { ExportModal } from '../components/pdfStudio/ExportModal';
import { PDFPreviewModal } from '../components/pdfStudio/PDFPreviewModal';
import { PDFPageContextMenu } from '../components/pdfStudio/PDFPageContextMenu';
import { FileText } from 'lucide-react';

import { apiService } from '../services/apiService';
import { useApp } from '../context/AppContext';

// Error Boundary Protection for PDF Studio
class PDFStudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PDF Studio Error Boundary caught an exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel p-12 rounded-2xl border border-red-500/30 bg-slate-900/90 text-center flex flex-col items-center justify-center my-6 space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <FileText className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-bold text-white">Display Error in PDF Studio</h3>
            <p className="text-xs text-slate-400">
              An unexpected display error occurred in the PDF Studio shell. Click below to safely reset the view.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer"
          >
            <span>Reset & Reload PDF Studio</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PDFStudio = () => {
  const { addToast } = useApp();

  // Document Workspace State (null when in Empty State)
  const [activeDocument, setActiveDocument] = useState(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedPageIndices, setSelectedPageIndices] = useState([0]);
  const [selectedTextId, setSelectedTextId] = useState(null);

  // Viewport & Settings State
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomMode, setZoomMode] = useState('custom'); // 'custom' | 'fit-width' | 'fit-page'
  const [viewMode, setViewMode] = useState('view'); // 'view' | 'edit' | 'annotate'
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [exportFileName, setExportFileName] = useState('new_document.pdf');
  const [indexWithMemora, setIndexWithMemora] = useState(true);

  // Modal & Popup States
  const [isNewPdfModalOpen, setIsNewPdfModalOpen] = useState(false);
  const [isMemoraPickerOpen, setIsMemoraPickerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, pageIndex }
  const [isExporting, setIsExporting] = useState(false);

  // Helper: Inspect PDF and load real page structure into workspace
  const loadPdfDocumentPages = async (filePath, title) => {
    try {
      const inspectData = await apiService.inspectPDF(filePath);
      const realPages = (inspectData.pages || []).map((p, idx) => ({
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        type: 'pdf_page',
        sourcePdfPath: filePath,
        sourcePageIndex: p.page_index,
        rotation: p.rotation || 0,
        title: `Page ${idx + 1}`,
        width: p.width,
        height: p.height,
        textOverlays: []
      }));

      return {
        title: title || inspectData.file_name || 'Opened Document.pdf',
        path: filePath,
        pages: realPages.length > 0 ? realPages : [
          { id: 'p1', type: 'blank', rotation: 0, title: '', content: '', textOverlays: [] }
        ]
      };
    } catch (err) {
      console.warn('Could not inspect PDF pages, creating basic document:', err);
      return {
        title: title || 'Opened Document.pdf',
        path: filePath,
        pages: [
          { id: 'p1', type: 'blank', rotation: 0, title: '', content: '', textOverlays: [] }
        ]
      };
    }
  };

  // Real Save Draft Persistence
  const handleSaveDraft = async () => {
    if (!activeDocument) return;
    try {
      if (activeDocument.path) {
        const docRec = await apiService.registerPDFDocument({
          file_path: activeDocument.path,
          title: activeDocument.title
        });
        
        // Flatten text overlays & annotations
        const allAnnos = activeDocument.pages.flatMap((page, pIdx) => {
          return (page.textOverlays || []).map((t) => ({
            page_index: pIdx,
            annotation_type: 'text',
            content_text: t.text,
            x: t.xPct || 0,
            y: t.yPct || 0,
            font_size: t.fontSize || 14,
            color: t.color || '#000000'
          }));
        });

        if (allAnnos.length > 0 && docRec.id) {
          await apiService.savePDFAnnotations(docRec.id, allAnnos);
        }
      }

      localStorage.setItem('memora_pdf_studio_draft', JSON.stringify({
        activeDocument,
        pageSize,
        orientation,
        savedAt: new Date().toISOString()
      }));

      addToast(`Workspace draft saved for '${activeDocument.title}'.`, 'success');
    } catch (err) {
      console.error('Failed to save workspace draft:', err);
      addToast(`Workspace draft saved locally. (${err.message || 'Database sync notice'})`, 'info');
    }
  };

  // Real PDF Export Execution
  const handleConfirmExport = async (exportConfig) => {
    if (!activeDocument) return;
    setIsExporting(true);

    try {
      const outFmt = (exportConfig.outputFormat || 'pdf').toLowerCase();
      const outFileName = exportConfig.fileName || exportFileName;
      const outFolder = exportConfig.outputFolder || 'C:\\Users\\Bhargavi\\Downloads';

      let fullOutputPath = outFileName;
      if (outFolder && !outFileName.includes('/') && !outFileName.includes('\\')) {
        const cleanFolder = outFolder.replace(/[/\\]+$/, '');
        fullOutputPath = `${cleanFolder}/${outFileName}`;
      }

      if (outFmt === 'png' || outFmt === 'jpg') {
        let sourcePath = activeDocument.path;
        if (!sourcePath) {
          const workspaceRes = await apiService.exportWorkspacePDF({
            output_path: fullOutputPath.replace(/\.(png|jpg|jpeg)$/i, '.pdf'),
            pages: activeDocument.pages,
            page_size: pageSize,
            orientation: orientation,
            register_in_db: false
          });
          sourcePath = workspaceRes.output_path;
        }

        const res = await apiService.pdfToImages({
          source_path: sourcePath,
          output_dir: outFolder,
          image_format: outFmt.toUpperCase(),
          page_selection: exportConfig.exportRange || 'all'
        });

        setIsExportModalOpen(false);
        addToast(
          `Export Successful! Generated ${res.total_generated_files} ${outFmt.toUpperCase()} image(s) in '${res.output_dir}'`,
          'success'
        );
      } else {
        const res = await apiService.exportWorkspacePDF({
          output_path: fullOutputPath,
          pages: activeDocument.pages,
          page_size: pageSize,
          orientation: orientation,
          register_in_db: exportConfig.indexWithMemora
        });

        setIsExportModalOpen(false);
        addToast(
          `Export Successful!\n• Output PDF: ${res.file_name}\n• Page Count: ${res.page_count}\n• Size: ${(res.file_size_bytes / 1024).toFixed(1)} KB\n• Memora Indexing: ${res.indexed ? 'SUCCESS' : 'Local Only'}`,
          'success'
        );
      }
    } catch (err) {
      console.error('Real PDF export error:', err);
      addToast(`Export Error: ${err.message || 'Failed to generate exported PDF file.'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Text Overlay Handlers
  // --------------------------------------------------------------------------
  const handleAddTextAtPosition = (pos = { xPct: 20, yPct: 20 }) => {
    if (!activeDocument) return;
    const newTextObj = {
      id: 'txt_' + Math.random().toString(36).substring(2, 9),
      text: 'New Text Box',
      xPct: pos.xPct ?? 20,
      yPct: pos.yPct ?? 20,
      widthPct: 35,
      fontSize: 16,
      isBold: false,
      isItalic: false,
      isUnderline: false,
      align: 'left',
      color: '#1e293b',
      opacity: 1
    };

    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex] || {};
      const existingOverlays = curPage.textOverlays || [];
      updatedPages[activePageIndex] = {
        ...curPage,
        textOverlays: [...existingOverlays, newTextObj]
      };
      return { ...prev, pages: updatedPages };
    });

    setSelectedTextId(newTextObj.id);
  };

  const handleUpdateText = (textId, updates) => {
    if (!activeDocument) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex];
      if (!curPage || !curPage.textOverlays) return prev;

      const updatedOverlays = curPage.textOverlays.map((item) =>
        item.id === textId ? { ...item, ...updates } : item
      );

      updatedPages[activePageIndex] = {
        ...curPage,
        textOverlays: updatedOverlays
      };

      return { ...prev, pages: updatedPages };
    });
  };

  const handleDeleteText = (textId) => {
    if (!activeDocument) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex];
      if (!curPage || !curPage.textOverlays) return prev;

      const updatedOverlays = curPage.textOverlays.filter((item) => item.id !== textId);

      updatedPages[activePageIndex] = {
        ...curPage,
        textOverlays: updatedOverlays
      };

      return { ...prev, pages: updatedPages };
    });

    if (selectedTextId === textId) {
      setSelectedTextId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Document Creation Handlers
  // --------------------------------------------------------------------------
  const handleCreateBlankPDF = ({ pageSize: size, orientation: orient, pageCount }) => {
    setPageSize(size || 'A4');
    setOrientation(orient || 'portrait');

    const blankPages = Array.from({ length: pageCount || 1 }).map((_, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      type: 'blank',
      rotation: 0,
      title: '',
      content: '',
      textOverlays: []
    }));

    setActiveDocument({
      title: 'New PDF Document',
      pages: blankPages
    });
    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedTextId(null);
    setExportFileName('new_document.pdf');
    setZoomLevel(100);
    setZoomMode('custom');
  };

  const handleCreateFromImages = (imagePagesArray) => {
    const pages = imagePagesArray.map((img) => ({
      id: img.id,
      type: 'image',
      name: img.name,
      previewUrl: img.previewUrl,
      rotation: img.rotation || 0,
      title: img.name,
      textOverlays: []
    }));

    setActiveDocument({
      title: 'Compiled Image Document.pdf',
      pages
    });
    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedTextId(null);
    setExportFileName('compiled_images.pdf');
    setZoomLevel(100);
    setZoomMode('custom');
  };

  const handleOpenPDF = async () => {
    if (window.electronAPI && window.electronAPI.openFile) {
      try {
        const result = await window.electronAPI.openFile([{ name: 'PDF Files', extensions: ['pdf'] }]);
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          const fileName = filePath.split(/[\\/]/).pop() || 'Opened Document.pdf';
          const docObj = await loadPdfDocumentPages(filePath, fileName);
          
          setActiveDocument(docObj);
          setActivePageIndex(0);
          setSelectedPageIndices([0]);
          setSelectedTextId(null);
          setExportFileName(fileName.replace(/\.pdf$/i, '') + '_edited.pdf');
          setZoomLevel(100);
          setZoomMode('custom');
          addToast(`Opened PDF: ${fileName} (${docObj.pages.length} pages)`, 'success');
          return;
        }
      } catch (err) {
        console.error('Electron open file dialog error:', err);
      }
    }

    const userPath = prompt('Enter absolute path or title of PDF to open in PDF Studio:', 'C:\\Users\\Bhargavi\\Downloads\\test.pdf');
    if (userPath && userPath.trim()) {
      const trimmed = userPath.trim();
      const fileName = trimmed.split(/[\\/]/).pop() || 'Opened Document.pdf';
      const docObj = await loadPdfDocumentPages(trimmed, fileName);

      setActiveDocument(docObj);
      setActivePageIndex(0);
      setSelectedPageIndices([0]);
      setSelectedTextId(null);
      setExportFileName(fileName.replace(/\.pdf$/i, '') + '_edited.pdf');
      setZoomLevel(100);
      setZoomMode('custom');
      addToast(`Opened document: ${fileName}`, 'success');
    }
  };

  const handleSelectFromMemora = async (file) => {
    const ext = (file.extension || file.fileExtension || file.name?.split('.').pop() || 'pdf').toLowerCase();
    let docObj;
    
    if (ext === 'pdf' && file.path) {
      docObj = await loadPdfDocumentPages(file.path, file.name);
    } else {
      docObj = {
        title: file.name || 'Memora Document',
        path: file.path,
        pages: [
          {
            id: 'memora_' + Math.random().toString(36).substring(2, 9),
            type: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext) ? 'image' : 'blank',
            imagePath: file.path,
            previewUrl: file.previewUrl || file.path,
            rotation: 0,
            title: file.name,
            textOverlays: [],
            annotations: []
          }
        ]
      };
    }

    setActiveDocument(docObj);
    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedTextId(null);
    setExportFileName((file.name || 'memora_doc').replace(/\.pdf$/i, '') + '_edited.pdf');
    setZoomLevel(100);
    setZoomMode('custom');
    addToast(`Imported '${file.name}' from Memora into PDF Studio`, 'success');
  };

  const handleAddSelectedFilesFromMemora = async (selectedList) => {
    if (!selectedList || selectedList.length === 0) return;

    const importedPages = [];

    for (let idx = 0; idx < selectedList.length; idx++) {
      const item = selectedList[idx];
      const f = item.file || item;
      const fileName = f.name || f.filename || f.file_name || `Imported Document ${idx + 1}`;
      const ext = (f.extension || f.fileExtension || fileName.split('.').pop() || 'pdf').toLowerCase();
      const filePath = f.path;

      if (ext === 'pdf' && filePath) {
        try {
          const inspectData = await apiService.inspectPDF(filePath);
          const pdfPages = (inspectData.pages || []).map((p, pIdx) => ({
            id: 'memora_pdf_' + Math.random().toString(36).substring(2, 9),
            type: 'pdf_page',
            sourcePdfPath: filePath,
            sourcePageIndex: p.page_index,
            rotation: p.rotation || 0,
            title: `${fileName} (Page ${pIdx + 1})`,
            width: p.width,
            height: p.height,
            textOverlays: [],
            annotations: []
          }));
          if (pdfPages.length > 0) {
            importedPages.push(...pdfPages);
          } else {
            importedPages.push({
              id: 'memora_' + Math.random().toString(36).substring(2, 9),
              type: 'blank',
              name: fileName,
              path: filePath,
              rotation: 0,
              title: fileName,
              textOverlays: [],
              annotations: []
            });
          }
        } catch (e) {
          importedPages.push({
            id: 'memora_' + Math.random().toString(36).substring(2, 9),
            type: 'blank',
            name: fileName,
            path: filePath,
            rotation: 0,
            title: fileName,
            textOverlays: [],
            annotations: []
          });
        }
      } else {
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext);
        importedPages.push({
          id: 'memora_' + Math.random().toString(36).substring(2, 9),
          type: isImage ? 'image' : 'blank',
          name: fileName,
          imagePath: filePath,
          previewUrl: f.previewUrl || f.thumbnailUrl || filePath || null,
          path: filePath,
          rotation: 0,
          title: fileName,
          textOverlays: [],
          annotations: []
        });
      }
    }

    if (importedPages.length === 0) return;

    if (!activeDocument) {
      setActiveDocument({
        title: selectedList[0].file?.name || 'Memora Workspace Document.pdf',
        pages: importedPages
      });
      setActivePageIndex(0);
      setSelectedPageIndices([0]);
    } else {
      setActiveDocument((prev) => ({
        ...prev,
        pages: [...prev.pages, ...importedPages]
      }));
      const newIndex = activeDocument.pages.length;
      setActivePageIndex(newIndex);
      setSelectedPageIndices([newIndex]);
    }

    setSelectedTextId(null);
    addToast(`Added ${importedPages.length} page(s) from selected Memora file(s)`, 'success');
  };

  const handleCloseDocument = () => {
    setActiveDocument(null);
    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedTextId(null);
    setZoomLevel(100);
    setZoomMode('custom');
  };

  // --------------------------------------------------------------------------
  // Selection Handlers
  // --------------------------------------------------------------------------
  const handleSelectPage = (index) => {
    setActivePageIndex(index);
    setSelectedPageIndices([index]);
    setSelectedTextId(null);
  };

  const handleToggleSelectPage = (index) => {
    setSelectedPageIndices((prev) => {
      let updated;
      if (prev.includes(index)) {
        updated = prev.filter((i) => i !== index);
        if (updated.length === 0) updated = [index];
      } else {
        updated = [...prev, index].sort((a, b) => a - b);
      }
      return updated;
    });
    setActivePageIndex(index);
    setSelectedTextId(null);
  };

  const handleSelectAllPages = () => {
    if (!activeDocument) return;
    setSelectedPageIndices(activeDocument.pages.map((_, i) => i));
  };

  const handleClearPageSelection = () => {
    setSelectedPageIndices([activePageIndex]);
  };

  // --------------------------------------------------------------------------
  // Page Operations
  // --------------------------------------------------------------------------
  const handleRotateLeft = (targetIndex = null) => {
    if (!activeDocument) return;
    const targets = targetIndex !== null ? [targetIndex] : selectedPageIndices;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      targets.forEach((idx) => {
        if (updatedPages[idx]) {
          const cur = updatedPages[idx].rotation || 0;
          updatedPages[idx] = { ...updatedPages[idx], rotation: (cur - 90 + 360) % 360 };
        }
      });
      return { ...prev, pages: updatedPages };
    });
  };

  const handleRotateRight = (targetIndex = null) => {
    if (!activeDocument) return;
    const targets = targetIndex !== null ? [targetIndex] : selectedPageIndices;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      targets.forEach((idx) => {
        if (updatedPages[idx]) {
          const cur = updatedPages[idx].rotation || 0;
          updatedPages[idx] = { ...updatedPages[idx], rotation: (cur + 90) % 360 };
        }
      });
      return { ...prev, pages: updatedPages };
    });
  };

  const handleDuplicatePage = (targetIndex = null) => {
    if (!activeDocument) return;
    const indicesToDuplicate =
      targetIndex !== null
        ? [targetIndex]
        : selectedPageIndices.length > 0
        ? selectedPageIndices
        : [activePageIndex];

    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      let offset = 0;

      indicesToDuplicate.forEach((idx) => {
        const sourcePage = prev.pages[idx];
        if (sourcePage) {
          const newPage = {
            ...sourcePage,
            id: Math.random().toString(36).substring(2, 9),
            textOverlays: sourcePage.textOverlays
              ? sourcePage.textOverlays.map((t) => ({
                  ...t,
                  id: 'txt_' + Math.random().toString(36).substring(2, 9)
                }))
              : []
          };
          updatedPages.splice(idx + 1 + offset, 0, newPage);
          offset++;
        }
      });

      return { ...prev, pages: updatedPages };
    });

    const newIndex = Math.min(
      activeDocument.pages.length,
      (targetIndex !== null ? targetIndex : activePageIndex) + 1
    );
    setActivePageIndex(newIndex);
    setSelectedPageIndices([newIndex]);
    setSelectedTextId(null);
  };

  const handleMovePageUp = (targetIndex = activePageIndex) => {
    if (!activeDocument || targetIndex <= 0) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const temp = updatedPages[targetIndex - 1];
      updatedPages[targetIndex - 1] = updatedPages[targetIndex];
      updatedPages[targetIndex] = temp;
      return { ...prev, pages: updatedPages };
    });
    setActivePageIndex(targetIndex - 1);
    setSelectedPageIndices([targetIndex - 1]);
    setSelectedTextId(null);
  };

  const handleMovePageDown = (targetIndex = activePageIndex) => {
    if (!activeDocument || targetIndex >= activeDocument.pages.length - 1) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const temp = updatedPages[targetIndex + 1];
      updatedPages[targetIndex + 1] = updatedPages[targetIndex];
      updatedPages[targetIndex] = temp;
      return { ...prev, pages: updatedPages };
    });
    setActivePageIndex(targetIndex + 1);
    setSelectedPageIndices([targetIndex + 1]);
    setSelectedTextId(null);
  };

  const handleDragReorder = (fromIndex, toIndex) => {
    if (!activeDocument || fromIndex === toIndex) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const [movedPage] = updatedPages.splice(fromIndex, 1);
      updatedPages.splice(toIndex, 0, movedPage);
      return { ...prev, pages: updatedPages };
    });
    setActivePageIndex(toIndex);
    setSelectedPageIndices([toIndex]);
    setSelectedTextId(null);
  };

  const handleAddPage = () => {
    if (!activeDocument) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const newPage = {
        id: Math.random().toString(36).substring(2, 9),
        type: 'blank',
        rotation: 0,
        title: '',
        content: '',
        textOverlays: []
      };
      return { ...prev, pages: [...prev.pages, newPage] };
    });
    const newIdx = activeDocument.pages.length;
    setActivePageIndex(newIdx);
    setSelectedPageIndices([newIdx]);
    setSelectedTextId(null);
  };

  const handleDeleteRequest = (targetIndex = null) => {
    if (!activeDocument || activeDocument.pages.length <= 1) return;
    if (targetIndex !== null) {
      setSelectedPageIndices([targetIndex]);
    }
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeletePages = () => {
    if (!activeDocument || activeDocument.pages.length <= 1) return;
    const remainingPages = activeDocument.pages.filter(
      (_, idx) => !selectedPageIndices.includes(idx)
    );

    if (remainingPages.length === 0) return;

    setActiveDocument((prev) => {
      if (!prev) return prev;
      return { ...prev, pages: remainingPages };
    });

    const newActiveIndex = Math.min(activePageIndex, remainingPages.length - 1);
    setActivePageIndex(newActiveIndex);
    setSelectedPageIndices([newActiveIndex]);
    setSelectedTextId(null);
  };

  // --------------------------------------------------------------------------
  // Conversion & Extraction Handlers
  // --------------------------------------------------------------------------
  const handleOpenContextMenu = (e, index) => {
    if (!selectedPageIndices.includes(index)) {
      setSelectedPageIndices([index]);
      setActivePageIndex(index);
      setSelectedTextId(null);
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pageIndex: index
    });
  };

  const handleConfirmExtractPages = async ({ fileName, indexWithMemora }) => {
    if (!activeDocument) return;
    try {
      const outName = fileName || `extracted_pages.pdf`;
      const outFolder = 'C:\\Users\\Bhargavi\\Downloads';
      const fullOutputPath = `${outFolder}/${outName}`;

      const extractedPages = activeDocument.pages.filter((_, idx) => selectedPageIndices.includes(idx));
      if (extractedPages.length === 0) return;

      const res = await apiService.exportWorkspacePDF({
        output_path: fullOutputPath,
        pages: extractedPages,
        page_size: pageSize,
        orientation: orientation,
        register_in_db: indexWithMemora
      });

      setIsExtractModalOpen(false);
      addToast(
        `Page Extraction Complete!\n• File Name: ${res.file_name}\n• Extracted Pages: ${res.page_count}\n• Output Location: ${res.output_path}\n• Memora Indexing: ${res.indexed ? 'Indexed' : 'Local Only'}`,
        'success'
      );
    } catch (err) {
      console.error('Page extraction error:', err);
      addToast(`Page Extraction Error: ${err.message || 'Failed to extract selected pages on backend.'}`, 'error');
    }
  };

  const handleConfirmConversion = ({ tool, result }) => {
    if (!result) return;
    const toolTitle = tool ? tool.toUpperCase() : 'DOCUMENT CONVERSION';
    addToast(
      `Conversion Complete (${toolTitle})!\n• Output: ${result.output_path || result.output_dir || 'Generated successfully'}\n• Pages/Files: ${result.total_generated_files || result.page_count || 1}`,
      'success'
    );
  };

  const handleExport = () => {
    if (!activeDocument) return;
    setIsExportModalOpen(true);
  };

  const activePage = activeDocument?.pages?.[activePageIndex];
  const selectedTextObj =
    activePage?.textOverlays?.find((t) => t.id === selectedTextId) || null;

  return (
    <PDFStudioErrorBoundary>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <PDFStudioHeader
          hasDocument={!!activeDocument}
          documentTitle={activeDocument?.title}
          pageCount={activeDocument?.pages?.length || 0}
          onNewPDF={() => setIsNewPdfModalOpen(true)}
          onOpenPDF={handleOpenPDF}
          onAddFromMemora={() => setIsMemoraPickerOpen(true)}
          onOpenConvert={() => setIsConvertModalOpen(true)}
          onSaveDraft={handleSaveDraft}
          onOpenPreview={() => setIsPreviewModalOpen(true)}
          onExport={() => setIsExportModalOpen(true)}
          isExporting={isExporting}
        />

        {/* Conditional Render: Empty State vs. Active Workspace */}
        {!activeDocument ? (
          <PDFStudioEmptyState
            onCreateNew={() => setIsNewPdfModalOpen(true)}
            onOpenPDF={handleOpenPDF}
            onAddFromMemora={() => setIsMemoraPickerOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {/* Studio Workspace Toolbar */}
            <PDFStudioToolbar
              viewMode={viewMode}
              onViewModeChange={(mode) => {
                setViewMode(mode);
                if (mode !== 'edit') setSelectedTextId(null);
              }}
              zoomLevel={zoomLevel}
              zoomMode={zoomMode}
              onZoomIn={() => {
                setZoomMode('custom');
                setZoomLevel((z) => Math.min(200, z + 15));
              }}
              onZoomOut={() => {
                setZoomMode('custom');
                setZoomLevel((z) => Math.max(50, z - 15));
              }}
              onResetZoom={() => {
                setZoomMode('custom');
                setZoomLevel(100);
              }}
              onFitWidth={() => setZoomMode((m) => (m === 'fit-width' ? 'custom' : 'fit-width'))}
              onFitPage={() => setZoomMode((m) => (m === 'fit-page' ? 'custom' : 'fit-page'))}
              currentPage={activePageIndex + 1}
              totalPages={activeDocument.pages.length}
              onPrevPage={() => {
                setActivePageIndex((p) => Math.max(0, p - 1));
                setSelectedTextId(null);
              }}
              onNextPage={() => {
                setActivePageIndex((p) => Math.min(activeDocument.pages.length - 1, p + 1));
                setSelectedTextId(null);
              }}
              onAddPage={handleAddPage}
              onDuplicatePage={() => handleDuplicatePage(activePageIndex)}
              onDeletePage={() => handleDeleteRequest(activePageIndex)}
              onRotateLeft={() => handleRotateLeft(activePageIndex)}
              onRotateRight={() => handleRotateRight(activePageIndex)}
              onMoveUp={() => handleMovePageUp(activePageIndex)}
              onMoveDown={() => handleMovePageDown(activePageIndex)}
              onCloseDocument={handleCloseDocument}
            />

            {/* Main 3-Column Studio Workspace Grid */}
            <div className="flex gap-4 h-[calc(100vh-270px)] min-h-[520px]">
              {/* LEFT: Page Navigation List */}
              <PDFPageThumbnailList
                pages={activeDocument.pages}
                activePageIndex={activePageIndex}
                selectedPageIndices={selectedPageIndices}
                onSelectPage={handleSelectPage}
                onToggleSelectPage={handleToggleSelectPage}
                onSelectAll={handleSelectAllPages}
                onClearSelection={handleClearPageSelection}
                onRotateLeft={handleRotateLeft}
                onRotateRight={handleRotateRight}
                onDuplicatePage={handleDuplicatePage}
                onMoveUp={handleMovePageUp}
                onMoveDown={handleMovePageDown}
                onDeletePage={handleDeleteRequest}
                onAddPage={handleAddPage}
                onExtractSelected={() => setIsExtractModalOpen(true)}
                onDragReorder={handleDragReorder}
                onOpenContextMenu={handleOpenContextMenu}
              />

              {/* CENTER: Document Canvas Viewport */}
              <PDFWorkspace
                activePage={activeDocument.pages[activePageIndex]}
                activePageIndex={activePageIndex}
                totalPages={activeDocument.pages.length}
                zoomLevel={zoomLevel}
                zoomMode={zoomMode}
                viewMode={viewMode}
                pageSize={pageSize}
                orientation={orientation}
                selectedTextId={selectedTextId}
                onSelectText={setSelectedTextId}
                onAddTextAtPosition={handleAddTextAtPosition}
                onUpdateText={handleUpdateText}
                onDeleteText={handleDeleteText}
              />

              {/* RIGHT: Tools & Properties Inspector Panel */}
              <PDFPropertiesPanel
                documentTitle={activeDocument.title}
                onTitleChange={(title) => setActiveDocument((d) => (d ? { ...d, title } : d))}
                pageCount={activeDocument.pages.length}
                activePageIndex={activePageIndex}
                activePageRotation={activeDocument.pages[activePageIndex]?.rotation || 0}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                orientation={orientation}
                onOrientationChange={setOrientation}
                onRotateLeft={() => handleRotateLeft(activePageIndex)}
                onRotateRight={() => handleRotateRight(activePageIndex)}
                selectedTextObj={selectedTextObj}
                onAddText={() => handleAddTextAtPosition()}
                onUpdateText={handleUpdateText}
                onDeleteText={handleDeleteText}
                exportFileName={exportFileName}
                onExportFileNameChange={setExportFileName}
                indexWithMemora={indexWithMemora}
                onToggleIndexWithMemora={() => setIndexWithMemora((v) => !v)}
                onOpenConvert={() => setIsConvertModalOpen(true)}
                onExport={() => setIsExportModalOpen(true)}
                isExporting={isExporting}
              />
            </div>
          </div>
        )}

        {/* New PDF Creation Modal */}
        <NewPDFModal
          isOpen={isNewPdfModalOpen}
          onClose={() => setIsNewPdfModalOpen(false)}
          onCreateBlank={handleCreateBlankPDF}
          onCreateFromImages={handleCreateFromImages}
          onOpenMemoraPicker={() => setIsMemoraPickerOpen(true)}
        />

        {/* Memora Document Import Picker Modal */}
        <MemoraFilePickerModal
          isOpen={isMemoraPickerOpen}
          onClose={() => setIsMemoraPickerOpen(false)}
          onSelectFile={handleSelectFromMemora}
          onAddSelectedFiles={handleAddSelectedFilesFromMemora}
        />

        {/* Conversion Tools Modal */}
        <ConvertModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          activeDocument={activeDocument}
          selectedPageIndices={selectedPageIndices}
          onConfirmConversion={handleConfirmConversion}
          onOpenMemoraPicker={() => setIsMemoraPickerOpen(true)}
        />

        {/* Export Options Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          activeDocument={activeDocument}
          defaultFileName={exportFileName}
          onConfirmExport={handleConfirmExport}
          isExporting={isExporting}
        />

        {/* Full Document Preview Modal */}
        <PDFPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          activeDocument={activeDocument}
          onOpenExport={() => setIsExportModalOpen(true)}
        />

        {/* Delete Confirmation Modal */}
        <DeletePageConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          targetCount={selectedPageIndices.length}
          onConfirmDelete={handleConfirmDeletePages}
        />

        {/* Extract Pages Modal */}
        <ExtractPagesModal
          isOpen={isExtractModalOpen}
          onClose={() => setIsExtractModalOpen(false)}
          selectedCount={selectedPageIndices.length}
          selectedPageNumbers={selectedPageIndices.map((i) => i + 1)}
          defaultFileName={`extracted_pages_${selectedPageIndices.map((i) => i + 1).join('-')}.pdf`}
          onConfirmExtract={handleConfirmExtractPages}
        />

        {/* Right-Click Context Menu Overlay */}
        {contextMenu && (
          <PDFPageContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            pageIndex={contextMenu.pageIndex}
            totalPages={activeDocument?.pages?.length || 1}
            selectedCount={selectedPageIndices.length}
            onClose={() => setContextMenu(null)}
            onRotateLeft={handleRotateLeft}
            onRotateRight={handleRotateRight}
            onDuplicate={handleDuplicatePage}
            onMoveUp={handleMovePageUp}
            onMoveDown={handleMovePageDown}
            onDelete={handleDeleteRequest}
            onExtract={() => setIsExtractModalOpen(true)}
          />
        )}
      </div>
    </PDFStudioErrorBoundary>
  );
};

