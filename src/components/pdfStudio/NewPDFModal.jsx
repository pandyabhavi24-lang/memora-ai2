import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  FilePlus, 
  ImageIcon, 
  Layers, 
  Upload, 
  X, 
  RotateCcw, 
  RotateCw, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Eye, 
  AlertTriangle, 
  Plus, 
  Check, 
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react';

export const NewPDFModal = ({
  isOpen,
  onClose,
  onCreateBlank,
  onCreateFromImages,
  onCreateGeneratedDoc,
  onOpenMemoraPicker
}) => {
  const [activeTab, setActiveTab] = useState('blank'); // 'blank' | 'reportlab' | 'images' | 'memora'

  // Blank PDF Form State
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [pageCount, setPageCount] = useState(1);

  // ReportLab Document Generator State
  const [docTitle, setDocTitle] = useState('New Document');
  const [docAuthor, setDocAuthor] = useState('Memora AI');
  const [docPageSize, setDocPageSize] = useState('A4');
  const [docOrientation, setDocOrientation] = useState('portrait');
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [docFileName, setDocFileName] = useState('generated_document.pdf');
  const [docSections, setDocSections] = useState([
    { id: 'sec_1', type: 'heading', title: 'Executive Summary', text: '' },
    { id: 'sec_2', type: 'paragraph', text: 'This document was compiled with ReportLab in Memora AI PDF Studio.', alignment: 'left' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Images PDF Form State
  const [selectedImages, setSelectedImages] = useState([]);
  const [layoutChoice, setLayoutChoice] = useState('one_per_page'); // 'one_per_page' | 'all_on_page' | 'grid'
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fileInputRef = useRef(null);
  const sectionImageInputRef = useRef(null);
  const [activeImageSectionId, setActiveImageSectionId] = useState(null);

  const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
  const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'];

  // Clean up ObjectURLs when component unmounts or images change
  useEffect(() => {
    return () => {
      selectedImages.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, [selectedImages]);

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // Image Selection & Drag-and-Drop Handlers
  // --------------------------------------------------------------------------
  const validateAndAddImages = (files) => {
    let invalidCount = 0;

    const promises = Array.from(files).map((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const isTypeValid = SUPPORTED_IMAGE_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(ext);

      if (!isTypeValid) {
        invalidCount++;
        return Promise.resolve(null);
      }

      return new Promise((resolve) => {
        if (file.path) {
          resolve({
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            size: file.size,
            path: file.path,
            previewUrl: file.path,
            dataUrl: file.path,
            rotation: 0
          });
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id: Math.random().toString(36).substring(2, 9),
              file,
              name: file.name,
              size: file.size,
              path: '',
              previewUrl: e.target.result,
              dataUrl: e.target.result,
              rotation: 0
            });
          };
          reader.onerror = () => {
            resolve({
              id: Math.random().toString(36).substring(2, 9),
              file,
              name: file.name,
              size: file.size,
              previewUrl: URL.createObjectURL(file),
              rotation: 0
            });
          };
          reader.readAsDataURL(file);
        }
      });
    });

    Promise.all(promises).then((results) => {
      const validImageObjects = results.filter(Boolean);
      if (invalidCount > 0) {
        setErrorMessage(`${invalidCount} file(s) skipped. Supported image formats: JPG, PNG, WEBP, BMP, TIFF.`);
      }
      if (validImageObjects.length > 0) {
        setSelectedImages((prev) => [...prev, ...validImageObjects]);
      }
      setIsLoadingFiles(false);
    });
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddImages(e.target.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddImages(e.dataTransfer.files);
    }
  };

  // Image Reordering & Page Manipulation Handlers
  const handleRotateImageLeft = (index) => {
    setSelectedImages(prev => {
      const updated = [...prev];
      const cur = updated[index].rotation || 0;
      updated[index] = { ...updated[index], rotation: (cur - 90 + 360) % 360 };
      return updated;
    });
  };

  const handleRotateImageRight = (index) => {
    setSelectedImages(prev => {
      const updated = [...prev];
      const cur = updated[index].rotation || 0;
      updated[index] = { ...updated[index], rotation: (cur + 90) % 360 };
      return updated;
    });
  };

  const handleMoveImageUp = (index) => {
    if (index <= 0) return;
    setSelectedImages(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveImageDown = (index) => {
    if (index >= selectedImages.length - 1) return;
    setSelectedImages(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(prev => {
      const itemToRemove = prev[index];
      if (itemToRemove?.previewUrl) URL.revokeObjectURL(itemToRemove.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // --------------------------------------------------------------------------
  // Creation Submit Handlers
  // --------------------------------------------------------------------------
  const handleConfirmCreateBlank = () => {
    onCreateBlank({
      pageSize,
      orientation,
      pageCount: Math.max(1, Math.min(50, pageCount))
    });
    onClose();
  };

  const handleConfirmCreateFromImages = () => {
    if (selectedImages.length === 0) return;
    onCreateFromImages(selectedImages, layoutChoice);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New PDF"
      subtitle="Choose a document creation method: start with a blank document, compile real images, or import from Memora."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Source Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('blank')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'blank'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <FilePlus className="w-4 h-4" />
            <span>Blank PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('reportlab')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'reportlab'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Generate Document (ReportLab)</span>
          </button>

          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'images'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Create from Images</span>
            {selectedImages.length > 0 && (
              <Badge variant="blue" size="sm">{selectedImages.length}</Badge>
            )}
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenMemoraPicker();
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 transition-all cursor-pointer shrink-0"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Add from Memora</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 2: REPORTLAB PROFESSIONAL DOCUMENT GENERATOR */}
        {/* =================================================================== */}
        {activeTab === 'reportlab' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 text-xs flex items-start gap-2.5 text-blue-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-white block font-semibold">ReportLab Local PDF Generator</strong>
                <p className="text-[11px] text-blue-300/80 leading-relaxed">
                  Generates clean, multi-page PDFs with headings, paragraphs, images, mixed image+text layouts, margins, and automatic page numbers.
                </p>
              </div>
            </div>

            {/* Document Setup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full p-2 rounded-xl glass-input text-gray-200 text-xs"
                  placeholder="Report / Article Title"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Page Size</label>
                <select
                  value={docPageSize}
                  onChange={(e) => setDocPageSize(e.target.value)}
                  className="w-full p-2 rounded-xl glass-input text-gray-200 text-xs"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">US Letter (8.5 × 11 in)</option>
                  <option value="Legal">US Legal (8.5 × 14 in)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Orientation</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDocOrientation('portrait')}
                    className={`p-2 rounded-xl border text-xs font-medium cursor-pointer ${
                      docOrientation === 'portrait' ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold' : 'bg-gray-950/40 border-gray-800 text-gray-400'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocOrientation('landscape')}
                    className={`p-2 rounded-xl border text-xs font-medium cursor-pointer ${
                      docOrientation === 'landscape' ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold' : 'bg-gray-950/40 border-gray-800 text-gray-400'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>
            </div>

            {/* Section Builder Toolbar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">Document Sections ({docSections.length})</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDocSections(prev => [...prev, { id: 'sec_' + Math.random().toString(36).substring(2, 7), type: 'heading', title: 'New Heading', text: '' }])}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium cursor-pointer"
                  >
                    + Heading
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocSections(prev => [...prev, { id: 'sec_' + Math.random().toString(36).substring(2, 7), type: 'paragraph', text: '', alignment: 'left' }])}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium cursor-pointer"
                  >
                    + Paragraph
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocSections(prev => [...prev, { id: 'sec_' + Math.random().toString(36).substring(2, 7), type: 'image', image_path: '', image_caption: '' }])}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium cursor-pointer"
                  >
                    + Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocSections(prev => [...prev, { id: 'sec_' + Math.random().toString(36).substring(2, 7), type: 'image_and_text', layout: 'side_by_side', image_path: '', text: '' }])}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium cursor-pointer"
                  >
                    + Image + Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocSections(prev => [...prev, { id: 'sec_' + Math.random().toString(36).substring(2, 7), type: 'page_break' }])}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium cursor-pointer"
                  >
                    + Page Break
                  </button>
                </div>
              </div>

              {/* Sections List */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {docSections.map((sec, idx) => (
                  <div key={sec.id} className="p-3 rounded-xl glass-panel border border-gray-800 bg-gray-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-gray-500">#{idx + 1}</span>
                        <Badge variant="blue" size="sm">{sec.type.toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            setDocSections(prev => {
                              const arr = [...prev];
                              const t = arr[idx - 1];
                              arr[idx - 1] = arr[idx];
                              arr[idx] = t;
                              return arr;
                            });
                          }}
                          className="p-1 hover:text-white disabled:opacity-20 text-gray-400"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === docSections.length - 1}
                          onClick={() => {
                            setDocSections(prev => {
                              const arr = [...prev];
                              const t = arr[idx + 1];
                              arr[idx + 1] = arr[idx];
                              arr[idx] = t;
                              return arr;
                            });
                          }}
                          className="p-1 hover:text-white disabled:opacity-20 text-gray-400"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocSections(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 hover:text-red-400 text-gray-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Section Fields */}
                    {sec.type === 'heading' && (
                      <input
                        type="text"
                        value={sec.title || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, title: val } : s));
                        }}
                        className="w-full p-2 rounded-lg glass-input text-white text-xs font-semibold"
                        placeholder="Section Heading Title"
                      />
                    )}

                    {sec.type === 'paragraph' && (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          value={sec.text || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, text: val } : s));
                          }}
                          className="w-full p-2 rounded-lg glass-input text-gray-200 text-xs"
                          placeholder="Type paragraph text here..."
                        />
                      </div>
                    )}

                    {sec.type === 'image' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={sec.image_path || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, image_path: val } : s));
                            }}
                            className="w-full p-2 rounded-lg glass-input text-gray-300 text-xs font-mono"
                            placeholder="Image absolute file path"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.electronAPI?.openFile) {
                                const res = await window.electronAPI.openFile([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]);
                                if (!res.canceled && res.filePaths?.[0]) {
                                  const p = res.filePaths[0];
                                  setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, image_path: p } : s));
                                }
                              }
                            }}
                            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-medium shrink-0 cursor-pointer"
                          >
                            Browse
                          </button>
                        </div>
                        <input
                          type="text"
                          value={sec.image_caption || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, image_caption: val } : s));
                          }}
                          className="w-full p-2 rounded-lg glass-input text-gray-300 text-xs"
                          placeholder="Image Caption (Optional)"
                        />
                      </div>
                    )}

                    {sec.type === 'image_and_text' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sec.image_path || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, image_path: val } : s));
                              }}
                              className="w-full p-2 rounded-lg glass-input text-gray-300 text-xs font-mono"
                              placeholder="Image file path"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.electronAPI?.openFile) {
                                  const res = await window.electronAPI.openFile([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]);
                                  if (!res.canceled && res.filePaths?.[0]) {
                                    const p = res.filePaths[0];
                                    setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, image_path: p } : s));
                                  }
                                }
                              }}
                              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 font-medium shrink-0 cursor-pointer"
                            >
                              Browse
                            </button>
                          </div>
                          <select
                            value={sec.layout || 'side_by_side'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, layout: val } : s));
                            }}
                            className="p-2 rounded-lg glass-input text-xs text-gray-300"
                          >
                            <option value="side_by_side">Side by Side (Image + Text)</option>
                            <option value="stacked">Stacked (Image on Top, Text Below)</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          value={sec.text || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDocSections(prev => prev.map((s, i) => i === idx ? { ...s, text: val } : s));
                          }}
                          className="w-full p-2 rounded-lg glass-input text-gray-200 text-xs"
                          placeholder="Side/stacked accompanying text content..."
                        />
                      </div>
                    )}

                    {sec.type === 'page_break' && (
                      <div className="text-[11px] text-gray-500 font-mono text-center py-1 border border-dashed border-gray-800 rounded-lg">
                        --- Explicit Page Break ---
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Options & Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-800/80">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={includePageNumbers}
                  onChange={(e) => setIncludePageNumbers(e.target.checked)}
                  className="rounded border-gray-700 text-blue-600 focus:ring-0"
                />
                <span>Include Page Numbers ('Page X of Y')</span>
              </label>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Sparkles}
                  disabled={isGenerating}
                  onClick={async () => {
                    setIsGenerating(true);
                    try {
                      if (onCreateGeneratedDoc) {
                        await onCreateGeneratedDoc({
                          title: docTitle,
                          author: docAuthor,
                          page_size: docPageSize,
                          orientation: docOrientation,
                          include_page_numbers: includePageNumbers,
                          sections: docSections,
                          output_path: docFileName
                        });
                      }
                      onClose();
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                >
                  {isGenerating ? 'Generating...' : 'Generate PDF'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 1: BLANK PDF CONFIGURATION */}
        {/* =================================================================== */}
        {activeTab === 'blank' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Page Size */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-medium"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">US Letter (8.5 × 11 in)</option>
                  <option value="Legal">US Legal (8.5 × 14 in)</option>
                </select>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Orientation</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      orientation === 'portrait'
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold'
                        : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Portrait
                  </button>

                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      orientation === 'landscape'
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold'
                        : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Initial Page Count */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Initial Pages</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={pageCount}
                  onChange={(e) => setPageCount(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={FilePlus}
                onClick={handleConfirmCreateBlank}
              >
                Create Blank PDF Workspace
              </Button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: CREATE FROM REAL IMAGES */}
        {/* =================================================================== */}
        {activeTab === 'images' && (
          <div className="space-y-4">
            {/* Layout Choice Options */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300">Image Compilation Layout</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLayoutChoice('one_per_page')}
                  className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    layoutChoice === 'one_per_page'
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold shadow-sm'
                      : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  One image per page
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutChoice('all_on_page')}
                  className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    layoutChoice === 'all_on_page'
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold shadow-sm'
                      : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All on single page
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutChoice('grid')}
                  className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    layoutChoice === 'grid'
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold shadow-sm'
                      : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  2x3 Grid layout
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Hidden Native File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/tiff"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Drag & Drop File Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 rounded-2xl border-2 border-dashed text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragging
                  ? 'bg-blue-600/15 border-blue-500 shadow-xl shadow-blue-500/10'
                  : 'bg-gray-950/50 border-gray-800 hover:border-gray-700 hover:bg-gray-900/40'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">Drag & Drop real images here</h4>
              <p className="text-xs text-gray-400 mt-1">
                or click to browse your computer (JPG, PNG, WEBP, BMP, TIFF)
              </p>
            </div>

            {/* Selected Image Page Thumbnails List */}
            {selectedImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Prospective PDF Pages ({selectedImages.length})
                  </h4>
                  <button
                    onClick={() => setSelectedImages([])}
                    className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                  >
                    Clear All Images
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto custom-scrollbar p-1">
                  {selectedImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="group relative p-2.5 rounded-xl glass-panel border border-gray-800/80 bg-gray-950/60 flex flex-col justify-between space-y-2 select-none"
                    >
                      {/* Page Index Badge */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-blue-400">Page #{idx + 1}</span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[100px] font-mono">{img.name}</span>
                      </div>

                      {/* Image Thumbnail Frame */}
                      <div className="w-full aspect-[4/3] rounded-lg bg-black border border-gray-800 overflow-hidden flex items-center justify-center relative">
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-contain transition-transform duration-200"
                          style={{ transform: `rotate(${img.rotation}deg)` }}
                        />
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center justify-between pt-1 text-gray-400 border-t border-gray-800/60">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRotateImageLeft(idx)}
                            className="p-1 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
                            title="Rotate Left 90°"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRotateImageRight(idx)}
                            className="p-1 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
                            title="Rotate Right 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPreviewImage(img)}
                            className="p-1 hover:text-blue-400 rounded hover:bg-gray-800 cursor-pointer"
                            title="Expand Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveImageUp(idx)}
                            disabled={idx === 0}
                            className="p-1 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveImageDown(idx)}
                            disabled={idx === selectedImages.length - 1}
                            className="p-1 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                            title="Remove Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={FilePlus}
                disabled={selectedImages.length === 0}
                onClick={handleConfirmCreateFromImages}
              >
                Create PDF from {selectedImages.length} Image(s)
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal Overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative max-w-3xl max-h-[85vh] glass-panel rounded-2xl p-4 flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg bg-gray-900/80 border border-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="text-sm font-semibold text-white mb-3">{previewImage.name}</h4>
            <img
              src={previewImage.previewUrl}
              alt={previewImage.name}
              className="max-h-[70vh] object-contain rounded-lg border border-gray-800"
              style={{ transform: `rotate(${previewImage.rotation}deg)` }}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
