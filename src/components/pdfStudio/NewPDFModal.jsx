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
  onOpenMemoraPicker
}) => {
  const [activeTab, setActiveTab] = useState('blank'); // 'blank' | 'images' | 'memora'

  // Blank PDF Form State
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [pageCount, setPageCount] = useState(1);

  // Images PDF Form State
  const [selectedImages, setSelectedImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fileInputRef = useRef(null);

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
    setErrorMessage('');
    setIsLoadingFiles(true);
    const validImageObjects = [];
    let invalidCount = 0;

    Array.from(files).forEach((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const isTypeValid = SUPPORTED_IMAGE_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(ext);

      if (isTypeValid) {
        validImageObjects.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
          rotation: 0
        });
      } else {
        invalidCount++;
      }
    });

    if (invalidCount > 0) {
      setErrorMessage(`${invalidCount} file(s) skipped. Supported image formats: JPG, PNG, WEBP, BMP, TIFF.`);
    }

    if (validImageObjects.length > 0) {
      setSelectedImages((prev) => [...prev, ...validImageObjects]);
    }
    setIsLoadingFiles(false);
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
    onCreateFromImages(selectedImages);
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
        <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
          <button
            onClick={() => setActiveTab('blank')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'blank'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <FilePlus className="w-4 h-4" />
            <span>Blank PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Add from Memora</span>
          </button>
        </div>

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
