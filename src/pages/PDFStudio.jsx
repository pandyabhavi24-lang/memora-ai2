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
import { PDFDraftsModal } from '../components/pdfStudio/PDFDraftsModal';
import { CameraCaptureModal } from '../components/pdfStudio/CameraCaptureModal';
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

const createInitialDocument = () => {
  const newDocId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  return {
    id: newDocId,
    name: 'Untitled PDF',
    title: 'Untitled PDF',
    status: 'new',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pages: [
      {
        id: 'page_1_' + Math.random().toString(36).substring(2, 7),
        type: 'blank',
        rotation: 0,
        title: 'Page 1',
        width: 595.28,
        height: 841.89,
        content: '',
        elements: [],
        textOverlays: []
      }
    ]
  };
};

export const PDFStudio = () => {
  const { addToast } = useApp();

  // Document Workspace State (Initialized to safe blank A4 document)
  const [activeDocument, setActiveDocument] = useState(createInitialDocument);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedPageIndices, setSelectedPageIndices] = useState([0]);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedTextId, setSelectedTextId] = useState(null);

  // Viewport & Settings State
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomMode, setZoomMode] = useState('fit-page'); // 'custom' | 'fit-width' | 'fit-page'
  const [viewMode, setViewMode] = useState('edit'); // 'view' | 'edit' | 'annotate'
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [exportFileName, setExportFileName] = useState('untitled_document.pdf');
  const [indexWithMemora, setIndexWithMemora] = useState(true);

  // Modal & Popup States
  const [isNewPdfModalOpen, setIsNewPdfModalOpen] = useState(false);
  const [isMemoraPickerOpen, setIsMemoraPickerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertModalInitialTool, setConvertModalInitialTool] = useState('pdf-to-images');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [exportedPdfPath, setExportedPdfPath] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, pageIndex }
  const [isExporting, setIsExporting] = useState(false);

  const hiddenImageInputRef = React.useRef(null);

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
      const draftId = activeDocument.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
      const draftName = activeDocument.title || activeDocument.name || 'Untitled PDF';
      const pageCount = activeDocument.pages?.length || 1;

      // Save to SQLite DB via PDFDraft API
      await apiService.savePDFDraft({
        id: draftId,
        name: draftName,
        document_json: JSON.stringify(activeDocument),
        page_count: pageCount
      });

      localStorage.setItem('memora_pdf_studio_draft', JSON.stringify({
        activeDocument,
        pageSize,
        orientation,
        savedAt: new Date().toISOString()
      }));

      addToast(`Workspace draft saved for '${draftName}'.`, 'success');
    } catch (err) {
      console.error('Failed to save workspace draft:', err);
      addToast(`Workspace draft saved locally. (${err.message || 'Database sync notice'})`, 'info');
    }
  };

  const handleOpenDraft = (draftModel) => {
    if (!draftModel) return;
    setActiveDocument(draftModel);
    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedElementId(null);
    setSelectedTextId(null);
    setExportFileName((draftModel.title || draftModel.name || 'Untitled') + '.pdf');
    setZoomLevel(100);
    setZoomMode('fit-page');
    setViewMode('edit');
    addToast(`Restored draft: '${draftModel.title || draftModel.name || 'Draft'}'`, 'success');
  };

  const handleCaptureFromCamera = (imageDataUrl) => {
    if (!activeDocument || !imageDataUrl) return;
    const targetW = 320;
    const targetH = 240;
    const newImgObj = {
      id: 'img_' + Math.random().toString(36).substring(2, 9),
      type: 'image',
      x: Math.round((595 - targetW) / 2),
      y: Math.round((842 - targetH) / 2),
      width: targetW,
      height: targetH,
      imagePath: imageDataUrl,
      previewUrl: imageDataUrl,
      fileName: `Camera_Capture_${Date.now()}.png`,
      aspectRatio: targetW / targetH,
      zIndex: 5
    };

    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex] || {};
      const existingElements = curPage.elements || [];
      updatedPages[activePageIndex] = {
        ...curPage,
        elements: [...existingElements, newImgObj]
      };
      return { ...prev, pages: updatedPages };
    });

    setSelectedElementId(newImgObj.id);
    addToast('Camera image added to current page!', 'success');
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
        setExportedPdfPath(res.output_path);
        setIsSaveShareMenuOpen(true);
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
  // Unified Element Handlers (Text & Resizable Images)
  // --------------------------------------------------------------------------
  const handleAddTextAtPosition = (pos = { x: 50, y: 80 }) => {
    if (!activeDocument) return;
    const newTextObj = {
      id: 'txt_' + Math.random().toString(36).substring(2, 9),
      type: 'text',
      x: Math.round(pos?.x ?? 50),
      y: Math.round(pos?.y ?? 80),
      width: 320,
      height: 48,
      text: 'Double-click to edit text',
      fontSize: 18,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#1e293b',
      lineHeight: 1.3,
      zIndex: 10
    };

    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex] || {};
      const existingElements = curPage.elements || [];
      const existingOverlays = curPage.textOverlays || [];
      updatedPages[activePageIndex] = {
        ...curPage,
        elements: [...existingElements, newTextObj],
        textOverlays: [...existingOverlays, {
          id: newTextObj.id,
          text: newTextObj.text,
          xPct: (newTextObj.x / 595) * 100,
          yPct: (newTextObj.y / 842) * 100,
          widthPct: (newTextObj.width / 595) * 100,
          fontSize: newTextObj.fontSize,
          isBold: true,
          color: newTextObj.color
        }]
      };
      return { ...prev, pages: updatedPages };
    });

    setSelectedElementId(newTextObj.id);
    setSelectedTextId(newTextObj.id);
  };

  const handleAddImageAtPosition = (file, pos = null) => {
    if (!activeDocument || !file) return;

    const processImageObj = (imgSrc, naturalW, naturalH) => {
      const aspect = (naturalW / (naturalH || 1)) || 1.33;
      const targetW = 280;
      const targetH = Math.round(targetW / aspect);
      const newImgObj = {
        id: 'img_' + Math.random().toString(36).substring(2, 9),
        type: 'image',
        x: Math.round(pos?.x ?? (595 - targetW) / 2),
        y: Math.round(pos?.y ?? 120),
        width: targetW,
        height: targetH,
        imagePath: file.path || imgSrc,
        previewUrl: imgSrc,
        source: file.path || imgSrc,
        fileName: file.name || 'Inserted Image',
        aspectRatio: aspect,
        zIndex: 2
      };

      setActiveDocument((prev) => {
        if (!prev) return prev;
        const updatedPages = [...prev.pages];
        const curPage = updatedPages[activePageIndex] || {};
        const existingElements = curPage.elements || [];
        updatedPages[activePageIndex] = {
          ...curPage,
          elements: [...existingElements, newImgObj]
        };
        return { ...prev, pages: updatedPages };
      });

      setSelectedElementId(newImgObj.id);
      addToast(`Added image: ${file.name || 'Image'}`, 'success');
    };

    if (file.path) {
      const img = new window.Image();
      img.onload = () => processImageObj(file.path, img.width, img.height);
      img.onerror = () => processImageObj(file.path, 400, 300);
      img.src = file.path;
    } else {
      const reader = new FileReader();
      reader.onload = (re) => {
        const dataUrl = re.target.result;
        const img = new window.Image();
        img.onload = () => processImageObj(dataUrl, img.width, img.height);
        img.onerror = () => processImageObj(dataUrl, 400, 300);
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddImageClick = async () => {
    if (window.electronAPI && window.electronAPI.openFile) {
      try {
        const result = await window.electronAPI.openFile([
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] }
        ]);
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          const fileName = filePath.split(/[\\/]/).pop() || 'Inserted Image';
          const newImgObj = {
            id: 'img_' + Math.random().toString(36).substring(2, 9),
            type: 'image',
            x: 157, // (595 - 280) / 2
            y: 120,
            width: 280,
            height: 200,
            imagePath: filePath,
            previewUrl: filePath,
            fileName,
            aspectRatio: 1.4,
            zIndex: 2
          };

          setActiveDocument((prev) => {
            if (!prev) return prev;
            const updatedPages = [...prev.pages];
            const curPage = updatedPages[activePageIndex] || {};
            const existingElements = curPage.elements || [];
            updatedPages[activePageIndex] = {
              ...curPage,
              elements: [...existingElements, newImgObj]
            };
            return { ...prev, pages: updatedPages };
          });

          setSelectedElementId(newImgObj.id);
          addToast(`Added image: ${fileName}`, 'success');
          return;
        }
      } catch (err) {
        console.error('Electron image open error:', err);
      }
    }
    hiddenImageInputRef.current?.click();
  };

  const handleHiddenImageSelected = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleAddImageAtPosition(file);
      e.target.value = '';
    }
  };

  const handleUpdateElement = (elementId, updates) => {
    if (!activeDocument) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex];
      if (!curPage) return prev;

      const curElements = curPage.elements || [];
      const updatedElements = curElements.map((el) =>
        el.id === elementId ? { ...el, ...updates } : el
      );

      const curTextOverlays = curPage.textOverlays || [];
      const updatedTextOverlays = curTextOverlays.map((t) =>
        t.id === elementId ? {
          ...t,
          ...updates,
          ...(updates.x ? { xPct: (updates.x / 595) * 100 } : {}),
          ...(updates.y ? { yPct: (updates.y / 842) * 100 } : {}),
          ...(updates.width ? { widthPct: (updates.width / 595) * 100 } : {})
        } : t
      );

      updatedPages[activePageIndex] = {
        ...curPage,
        elements: updatedElements,
        textOverlays: updatedTextOverlays
      };

      return { ...prev, pages: updatedPages };
    });
  };

  const handleDeleteElement = (elementId) => {
    if (!activeDocument) return;
    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const curPage = updatedPages[activePageIndex];
      if (!curPage) return prev;

      const curElements = curPage.elements || [];
      const filteredElements = curElements.filter((el) => el.id !== elementId);

      const curTextOverlays = curPage.textOverlays || [];
      const filteredTextOverlays = curTextOverlays.filter((t) => t.id !== elementId);

      updatedPages[activePageIndex] = {
        ...curPage,
        elements: filteredElements,
        textOverlays: filteredTextOverlays
      };

      return { ...prev, pages: updatedPages };
    });

    if (selectedElementId === elementId) setSelectedElementId(null);
    if (selectedTextId === elementId) setSelectedTextId(null);
  };

  const handleDuplicateElement = (elementId) => {
    if (!activeDocument) return;
    const curPage = activeDocument.pages[activePageIndex];
    if (!curPage) return;
    const elem = (curPage.elements || []).find((e) => e.id === elementId);
    if (!elem) return;

    const dup = {
      ...elem,
      id: (elem.type === 'image' ? 'img_' : 'txt_') + Math.random().toString(36).substring(2, 9),
      x: Math.min(595 - (elem.width || 100), (elem.x || 50) + 20),
      y: Math.min(842 - (elem.height || 50), (elem.y || 50) + 20)
    };

    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const page = updatedPages[activePageIndex];
      updatedPages[activePageIndex] = {
        ...page,
        elements: [...(page.elements || []), dup]
      };
      return { ...prev, pages: updatedPages };
    });

    setSelectedElementId(dup.id);
  };

  // Legacy aliases
  const handleUpdateText = (id, upd) => handleUpdateElement(id, upd);
  const handleDeleteText = (id) => handleDeleteElement(id);

  // --------------------------------------------------------------------------
  // Document Creation Handlers
  // --------------------------------------------------------------------------
  const handleCreateBlankPDF = ({ pageSize: size, orientation: orient, pageCount } = {}) => {
    const selectedSize = size || 'A4';
    const selectedOrient = orient || 'portrait';
    setPageSize(selectedSize);
    setOrientation(selectedOrient);

    const isLandscape = selectedOrient === 'landscape';
    const w = isLandscape ? 841.89 : 595.28;
    const h = isLandscape ? 595.28 : 841.89;

    const newDocId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const count = Math.max(1, Math.min(50, pageCount || 1));

    const blankPages = Array.from({ length: count }).map((_, i) => ({
      id: 'page_' + (i + 1) + '_' + Math.random().toString(36).substring(2, 7),
      type: 'blank',
      rotation: 0,
      title: `Page ${i + 1}`,
      width: w,
      height: h,
      content: '',
      elements: [],
      textOverlays: []
    }));

    // Reset document state to brand new
    setActiveDocument({
      id: newDocId,
      name: 'Untitled PDF',
      title: 'Untitled PDF',
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pages: blankPages
    });

    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedElementId(null);
    setSelectedTextId(null);
    setExportFileName('untitled_document.pdf');
    setZoomLevel(100);
    setZoomMode('fit-page');
    setViewMode('edit');
    addToast('New PDF document created with 1 blank A4 page.', 'success');
  };

  const handleCreateFromImages = (imagePagesArray, layoutChoice = 'one_per_page') => {
    if (!imagePagesArray || imagePagesArray.length === 0) return;

    const newDocId = 'doc_img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    let pages = [];

    if (layoutChoice === 'one_per_page') {
      // 5 images -> 5 pages, each page containing 1 full-bleed/centered image element
      pages = imagePagesArray.map((img, idx) => {
        const imgSrc = img.path || img.dataUrl || img.previewUrl || '';
        return {
          id: 'page_' + (idx + 1) + '_' + Math.random().toString(36).substring(2, 7),
          type: 'image',
          name: img.name || `Page ${idx + 1}`,
          rotation: img.rotation || 0,
          title: `Page ${idx + 1}`,
          width: 595.28,
          height: 841.89,
          previewUrl: imgSrc,
          imagePath: imgSrc,
          elements: [
            {
              id: 'img_' + Math.random().toString(36).substring(2, 9),
              type: 'image',
              x: 36,
              y: 36,
              width: 595.28 - 72,
              height: 841.89 - 72,
              previewUrl: imgSrc,
              imagePath: imgSrc,
              source: imgSrc,
              fileName: img.name || `Image ${idx + 1}`,
              aspectRatio: 1.0,
              zIndex: 1
            }
          ],
          textOverlays: []
        };
      });
    } else if (layoutChoice === 'all_on_page') {
      // All images on single page
      const elements = imagePagesArray.map((img, idx) => {
        const offset = idx * 25;
        const imgSrc = img.path || img.dataUrl || img.previewUrl || '';
        return {
          id: 'img_' + Math.random().toString(36).substring(2, 9),
          type: 'image',
          x: 40 + offset,
          y: 40 + offset,
          width: 280,
          height: 200,
          previewUrl: imgSrc,
          imagePath: imgSrc,
          source: imgSrc,
          fileName: img.name || `Image ${idx + 1}`,
          aspectRatio: 1.4,
          zIndex: idx + 1
        };
      });

      pages = [
        {
          id: 'page_1_' + Math.random().toString(36).substring(2, 7),
          type: 'image',
          title: 'Page 1',
          width: 595.28,
          height: 841.89,
          elements,
          textOverlays: []
        }
      ];
    } else if (layoutChoice === 'grid') {
      // 2x3 Grid layout on single page
      const cols = 2;
      const cellW = 240;
      const cellH = 220;
      const startX = 40;
      const startY = 40;
      const gapX = 35;
      const gapY = 35;

      const elements = imagePagesArray.map((img, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const imgSrc = img.path || img.dataUrl || img.previewUrl || '';
        return {
          id: 'img_' + Math.random().toString(36).substring(2, 9),
          type: 'image',
          x: startX + c * (cellW + gapX),
          y: startY + r * (cellH + gapY),
          width: cellW,
          height: cellH,
          previewUrl: imgSrc,
          imagePath: imgSrc,
          source: imgSrc,
          fileName: img.name || `Image ${idx + 1}`,
          aspectRatio: cellW / cellH,
          zIndex: idx + 1
        };
      });

      pages = [
        {
          id: 'page_1_' + Math.random().toString(36).substring(2, 7),
          type: 'image',
          title: 'Page 1',
          width: 595.28,
          height: 841.89,
          elements,
          textOverlays: []
        }
      ];
    }

    setActiveDocument({
      id: newDocId,
      name: 'Compiled Images PDF',
      title: 'Compiled Images PDF',
      status: 'unsaved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pages
    });

    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedElementId(null);
    setSelectedTextId(null);
    setExportFileName('compiled_images.pdf');
    setZoomLevel(100);
    setZoomMode('fit-page');
    setViewMode('edit');
    addToast(`Created document from ${imagePagesArray.length} image(s) [${layoutChoice}]`, 'success');
  };

  const handleCreateGeneratedPDF = async (docConfig) => {
    try {
      const res = await apiService.generatePDF(docConfig);
      if (res && res.output_path) {
        addToast(
          `ReportLab Document Generated!\n• File: ${res.file_name}\n• Pages: ${res.page_count}\n• Output: ${res.output_path}`,
          'success'
        );
        try {
          const loadedDoc = await loadPdfDocumentPages(res.output_path, res.file_name);
          setActiveDocument(loadedDoc);
          setActivePageIndex(0);
          setSelectedPageIndices([0]);
          setSelectedTextId(null);
          setExportFileName(res.file_name.replace(/\.pdf$/i, '') + '_edited.pdf');
          setZoomLevel(100);
          setZoomMode('custom');
        } catch (loadErr) {
          console.warn('Could not auto-load newly generated PDF into workspace:', loadErr);
        }
      }
      setIsNewPdfModalOpen(false);
    } catch (err) {
      console.error('ReportLab document generation error:', err);
      addToast(`Document Generation Failed: ${err.message || 'Unknown error occurred'}`, 'error');
      throw err;
    }
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

  const handleAlignElement = (elementId, alignment) => {
    if (!activeDocument) return;
    const curPage = activeDocument.pages[activePageIndex];
    if (!curPage) return;
    const elem = (curPage.elements || []).find((e) => e.id === elementId);
    if (!elem) return;

    const pageWidth = curPage.width || 595.28;
    const pageHeight = curPage.height || 841.89;
    const margin = 36; // 0.5 inch margin

    let updates = {};
    if (alignment === 'left') {
      updates.x = margin;
    } else if (alignment === 'center') {
      updates.x = Math.max(0, Math.round((pageWidth - (elem.width || 200)) / 2));
    } else if (alignment === 'right') {
      updates.x = Math.max(0, Math.round(pageWidth - margin - (elem.width || 200)));
    } else if (alignment === 'top') {
      updates.y = margin;
    } else if (alignment === 'middle') {
      updates.y = Math.max(0, Math.round((pageHeight - (elem.height || 200)) / 2));
    } else if (alignment === 'bottom') {
      updates.y = Math.max(0, Math.round(pageHeight - margin - (elem.height || 200)));
    } else if (alignment === 'fit-width') {
      updates.x = margin;
      updates.width = pageWidth - (margin * 2);
      if (elem.aspectRatio) {
        updates.height = Math.round(updates.width / elem.aspectRatio);
      }
    } else if (alignment === 'fit-page') {
      updates.x = margin;
      updates.y = margin;
      updates.width = pageWidth - (margin * 2);
      updates.height = pageHeight - (margin * 2);
    }

    handleUpdateElement(elementId, updates);
  };

  const handleAddSubtitleBelowImage = (imageElem) => {
    if (!activeDocument || !imageElem) return;
    const startY = (imageElem.y || 40) + (imageElem.height || 300) + 16;
    const startX = imageElem.x || 40;
    const elemWidth = imageElem.width || 515;

    const subtitleId = 'txt_sub_' + Math.random().toString(36).substring(2, 9);
    const descId = 'txt_desc_' + Math.random().toString(36).substring(2, 9);

    const subtitleElem = {
      id: subtitleId,
      type: 'text',
      content: 'Subtitle Title',
      x: startX,
      y: Math.min(800, startY),
      width: Math.min(elemWidth, 400),
      height: 30,
      fontSize: 18,
      fontFamily: 'Helvetica',
      isBold: true,
      color: '#1e293b',
      align: 'left',
      zIndex: (imageElem.zIndex || 1) + 1
    };

    const descElem = {
      id: descId,
      type: 'text',
      content: 'Enter detailed description or caption here...',
      x: startX,
      y: Math.min(820, startY + 36),
      width: Math.min(elemWidth, 500),
      height: 40,
      fontSize: 12,
      fontFamily: 'Helvetica',
      isBold: false,
      color: '#475569',
      align: 'left',
      zIndex: (imageElem.zIndex || 1) + 2
    };

    setActiveDocument((prev) => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      const page = updatedPages[activePageIndex];
      updatedPages[activePageIndex] = {
        ...page,
        elements: [...(page.elements || []), subtitleElem, descElem]
      };
      return { ...prev, pages: updatedPages };
    });

    setSelectedElementId(subtitleId);
    setSelectedTextId(subtitleId);
    addToast('Added subtitle and description text below image', 'success');
  };

  const handleApplyPageLayout = (layoutType) => {
    if (!activeDocument) return;
    const curPage = activeDocument.pages[activePageIndex];
    if (!curPage) return;
    const imageElements = (curPage.elements || []).filter(e => e.type === 'image');
    if (imageElements.length === 0) {
      addToast('No images on this page to rearrange.', 'info');
      return;
    }

    const pageWidth = curPage.width || 595.28;
    const pageHeight = curPage.height || 841.89;
    const margin = 36;
    const usableW = pageWidth - margin * 2;
    const usableH = pageHeight - margin * 2;

    let updatedElements = [...(curPage.elements || [])];

    if (layoutType === 'grid2x2') {
      const cols = 2;
      const gap = 20;
      const cellW = (usableW - gap) / 2;
      const cellH = (usableH - gap) / 2;

      imageElements.forEach((img, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const newX = Math.round(margin + c * (cellW + gap));
        const newY = Math.round(margin + r * (cellH + gap));
        
        updatedElements = updatedElements.map(el => 
          el.id === img.id ? { ...el, x: newX, y: newY, width: Math.round(cellW), height: Math.round(cellH) } : el
        );
      });
      addToast('Applied 2x2 grid layout to images', 'success');
    } else if (layoutType === 'equal_spacing_v') {
      const count = imageElements.length;
      const totalImgH = imageElements.reduce((acc, el) => acc + (el.height || 150), 0);
      const gap = count > 1 ? Math.max(10, Math.floor((usableH - totalImgH) / (count - 1))) : 20;
      let currentY = margin;

      imageElements.forEach((img) => {
        updatedElements = updatedElements.map(el =>
          el.id === img.id ? { ...el, x: margin, y: currentY } : el
        );
        currentY += (img.height || 150) + gap;
      });
      addToast('Applied vertical equal spacing to images', 'success');
    } else if (layoutType === 'equal_spacing_h') {
      const count = imageElements.length;
      const totalImgW = imageElements.reduce((acc, el) => acc + (el.width || 200), 0);
      const gap = count > 1 ? Math.max(10, Math.floor((usableW - totalImgW) / (count - 1))) : 20;
      let currentX = margin;

      imageElements.forEach((img) => {
        updatedElements = updatedElements.map(el =>
          el.id === img.id ? { ...el, x: currentX, y: margin } : el
        );
        currentX += (img.width || 200) + gap;
      });
      addToast('Applied horizontal equal spacing to images', 'success');
    }

    setActiveDocument(prev => {
      if (!prev) return prev;
      const updatedPages = [...prev.pages];
      updatedPages[activePageIndex] = {
        ...curPage,
        elements: updatedElements
      };
      return { ...prev, pages: updatedPages };
    });
  };

  const handleSelectFromMemora = async (file) => {
    const ext = (file.extension || file.fileExtension || file.name?.split('.').pop() || 'pdf').toLowerCase().replace(/^\./, '');
    let docObj;
    
    if (ext === 'pdf' && file.path) {
      docObj = await loadPdfDocumentPages(file.path, file.name);
    } else {
      const isImg = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif'].includes(ext);
      const imgSrc = file.previewUrl || file.path;
      docObj = {
        title: file.name || 'Memora Document',
        name: file.name || 'Memora Document',
        path: file.path,
        pages: [
          {
            id: 'memora_' + Math.random().toString(36).substring(2, 9),
            type: isImg ? 'image' : 'blank',
            imagePath: file.path,
            previewUrl: imgSrc,
            rotation: 0,
            title: file.name,
            width: 595.28,
            height: 841.89,
            elements: isImg ? [
              {
                id: 'img_' + Math.random().toString(36).substring(2, 9),
                type: 'image',
                x: 36,
                y: 36,
                width: 595.28 - 72,
                height: 841.89 - 72,
                previewUrl: imgSrc,
                imagePath: file.path,
                source: file.path,
                fileName: file.name,
                aspectRatio: 1.0,
                zIndex: 1
              }
            ] : [],
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
    setSelectedElementId(null);
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
      const ext = (f.extension || f.fileExtension || fileName.split('.').pop() || 'pdf').toLowerCase().replace(/^\./, '');
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
            width: p.width || 595.28,
            height: p.height || 841.89,
            elements: [],
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
              width: 595.28,
              height: 841.89,
              elements: [],
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
            width: 595.28,
            height: 841.89,
            elements: [],
            textOverlays: [],
            annotations: []
          });
        }
      } else {
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif'].includes(ext);
        const previewUrl = f.previewUrl || f.thumbnailUrl || filePath || null;
        importedPages.push({
          id: 'memora_' + Math.random().toString(36).substring(2, 9),
          type: isImage ? 'image' : 'blank',
          name: fileName,
          imagePath: filePath,
          previewUrl: previewUrl,
          path: filePath,
          rotation: 0,
          title: fileName,
          width: 595.28,
          height: 841.89,
          elements: isImage ? [
            {
              id: 'img_' + Math.random().toString(36).substring(2, 9),
              type: 'image',
              x: 36,
              y: 36,
              width: 595.28 - 72,
              height: 841.89 - 72,
              previewUrl: previewUrl,
              imagePath: filePath,
              source: filePath,
              fileName: fileName,
              aspectRatio: 1.0,
              zIndex: 1
            }
          ] : [],
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
    setSelectedElementId(null);
    addToast(`Added ${importedPages.length} page(s) from selected Memora file(s)`, 'success');
  };

  const handleCloseDocument = () => {
    const blankDoc = createInitialDocument();
    setActiveDocument(blankDoc);
    setActivePageIndex(0);
    setSelectedPageIndices([0]);
    setSelectedElementId(null);
    setSelectedTextId(null);
    setExportFileName('untitled_document.pdf');
    setZoomLevel(100);
    setZoomMode('fit-page');
    setViewMode('edit');
    addToast('Reset workspace to blank document.', 'info');
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
  const selectedElementObj =
    activePage?.elements?.find((el) => el.id === (selectedElementId || selectedTextId)) ||
    null;
  const selectedTextObj =
    activePage?.elements?.find((el) => el.id === (selectedElementId || selectedTextId) && el.type === 'text') ||
    activePage?.textOverlays?.find((t) => t.id === (selectedElementId || selectedTextId)) ||
    null;

  return (
    <PDFStudioErrorBoundary>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <PDFStudioHeader
          hasDocument={!!activeDocument}
          documentTitle={activeDocument?.title || activeDocument?.name}
          pageCount={activeDocument?.pages?.length || 0}
          onNewPDF={() => setIsNewPdfModalOpen(true)}
          onOpenPDF={handleOpenPDF}
          onOpenDrafts={() => setIsDraftsModalOpen(true)}
          onAddText={() => handleAddTextAtPosition()}
          onAddImage={handleAddImageClick}
          onAddFromMemora={() => setIsMemoraPickerOpen(true)}
          onOpenAlternate={() => {
            setConvertModalInitialTool('alternate-pages');
            setIsConvertModalOpen(true);
          }}
          onOpenConvert={() => {
            setConvertModalInitialTool('pdf-to-images');
            setIsConvertModalOpen(true);
          }}
          onSaveDraft={handleSaveDraft}
          onOpenPreview={() => setIsPreviewModalOpen(true)}
          onExport={() => setIsExportModalOpen(true)}
          isExporting={isExporting}
        />

        {/* Hidden File Input for Native/Web Image Picking */}
        <input
          type="file"
          ref={hiddenImageInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleHiddenImageSelected}
        />

        {/* Conditional Render: Empty State vs. Active Workspace */}
        {!activeDocument ? (
          <PDFStudioEmptyState
            onCreateNew={() => setIsNewPdfModalOpen(true)}
            onOpenPDF={handleOpenPDF}
            onOpenDrafts={() => setIsDraftsModalOpen(true)}
            onAddFromMemora={() => setIsMemoraPickerOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {/* Studio Workspace Toolbar */}
            <PDFStudioToolbar
              viewMode={viewMode}
              onViewModeChange={(mode) => {
                setViewMode(mode);
                if (mode !== 'edit') {
                  setSelectedElementId(null);
                  setSelectedTextId(null);
                }
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
                setSelectedElementId(null);
                setSelectedTextId(null);
              }}
              onNextPage={() => {
                setActivePageIndex((p) => Math.min(activeDocument.pages.length - 1, p + 1));
                setSelectedElementId(null);
                setSelectedTextId(null);
              }}
              onAddPage={handleAddPage}
              onDuplicatePage={() => handleDuplicatePage(activePageIndex)}
              onDeletePage={() => handleDeleteRequest(activePageIndex)}
              onRotateLeft={() => handleRotateLeft(activePageIndex)}
              onRotateRight={() => handleRotateRight(activePageIndex)}
              onMoveUp={() => handleMovePageUp(activePageIndex)}
              onMoveDown={() => handleMovePageDown(activePageIndex)}
              onAddText={() => handleAddTextAtPosition()}
              onAddImage={handleAddImageClick}
              onAddFromCamera={() => setIsCameraModalOpen(true)}
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
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                selectedTextId={selectedTextId}
                onSelectText={setSelectedTextId}
                onAddTextAtPosition={handleAddTextAtPosition}
                onAddImageAtPosition={handleAddImageAtPosition}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onDuplicateElement={handleDuplicateElement}
                onUpdateText={handleUpdateText}
                onDeleteText={handleDeleteText}
              />

              {/* RIGHT: Tools & Properties Inspector Panel */}
              <PDFPropertiesPanel
                documentTitle={activeDocument.title}
                onTitleChange={(title) => setActiveDocument((d) => (d ? { ...d, title } : d))}
                pageCount={activeDocument.pages.length}
                activePageIndex={activePageIndex}
                activePage={activePage}
                activePageRotation={activeDocument.pages[activePageIndex]?.rotation || 0}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                orientation={orientation}
                onOrientationChange={setOrientation}
                onRotateLeft={() => handleRotateLeft(activePageIndex)}
                onRotateRight={() => handleRotateRight(activePageIndex)}
                selectedElementObj={selectedElementObj}
                selectedTextObj={selectedTextObj}
                onAddText={() => handleAddTextAtPosition()}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onDuplicateElement={handleDuplicateElement}
                onAlignElement={handleAlignElement}
                onAddSubtitleBelowImage={handleAddSubtitleBelowImage}
                onApplyPageLayout={handleApplyPageLayout}
                onUpdateText={handleUpdateText}
                onDeleteText={handleDeleteText}
                exportFileName={exportFileName}
                onExportFileNameChange={setExportFileName}
                indexWithMemora={indexWithMemora}
                onToggleIndexWithMemora={() => setIndexWithMemora((v) => !v)}
                onOpenConvert={() => {
                  setConvertModalInitialTool('pdf-to-images');
                  setIsConvertModalOpen(true);
                }}
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
          onCreateGeneratedDoc={handleCreateGeneratedPDF}
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
          initialTool={convertModalInitialTool}
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

        {/* Drafts Manager Modal */}
        <PDFDraftsModal
          isOpen={isDraftsModalOpen}
          onClose={() => setIsDraftsModalOpen(false)}
          onOpenDraft={handleOpenDraft}
        />

        {/* Camera Capture Modal */}
        <CameraCaptureModal
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          onCaptureImage={handleCaptureFromCamera}
        />
      </div>
    </PDFStudioErrorBoundary>
  );
};

