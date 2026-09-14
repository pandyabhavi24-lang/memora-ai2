import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  ArrowRightLeft, 
  ImageIcon, 
  Scissors, 
  FilePlus, 
  Merge, 
  Upload, 
  Download, 
  X, 
  RotateCcw, 
  RotateCw, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Eye, 
  Sparkles, 
  Check, 
  FileText, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

import { apiService } from '../../services/apiService';

export const ConvertModal = ({
  isOpen,
  onClose,
  activeDocument = null,
  selectedPageIndices = [0],
  onConfirmConversion,
  onOpenMemoraPicker
}) => {
  const [activeTool, setActiveTool] = useState('pdf-to-images'); // 'pdf-to-images' | 'split-pdf' | 'images-to-pdf' | 'merge-pdfs'

  // Tool 1: PDF -> Images State
  const [imageScope, setImageScope] = useState('all'); // 'all' | 'selected' | 'range'
  const [imageRangeStr, setImageRangeStr] = useState('1-5');
  const [imageFormat, setImageFormat] = useState('png'); // 'png' | 'jpg' | 'webp'
  const [imageDpi, setImageDpi] = useState('300');

  // Tool 2: Split PDF State
  const [splitMode, setSplitMode] = useState('every'); // 'every' | 'selected' | 'range'
  const [splitRangeStr, setSplitRangeStr] = useState('1-10');
  const [splitOutputPattern, setSplitOutputPattern] = useState('page_{n}.pdf');

  // Tool 3: Images -> PDF State
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePdfName, setImagePdfName] = useState('compiled_images.pdf');
  const imageInputRef = useRef(null);

  // Tool 4: Merge PDFs State
  const [selectedPdfs, setSelectedPdfs] = useState([]);
  const [mergedPdfName, setMergedPdfName] = useState('merged_document.pdf');
  const pdfInputRef = useRef(null);

  // Conversion Execution & Progress State
  const [isConverting, setIsConverting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [indexWithMemora, setIndexWithMemora] = useState(true);

  const totalDocPages = activeDocument?.pages?.length || 1;

  // Clean up ObjectURLs
  useEffect(() => {
    return () => {
      selectedImages.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, [selectedImages]);

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // Image Selection Handlers (Images -> PDF)
  // --------------------------------------------------------------------------
  const handleAddImages = (files) => {
    const validImgs = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      rotation: 0
    }));
    if (validImgs.length > 0) {
      setSelectedImages(prev => [...prev, ...validImgs]);
    }
  };

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
      if (prev[index]?.previewUrl) URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // --------------------------------------------------------------------------
  // PDF Multi-File Merge Selection Handlers
  // --------------------------------------------------------------------------
  const handleAddPdfs = (files) => {
    const validPdfs = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size
    }));
    if (validPdfs.length > 0) {
      setSelectedPdfs(prev => [...prev, ...validPdfs]);
    }
  };

  const handleMovePdfUp = (index) => {
    if (index <= 0) return;
    setSelectedPdfs(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMovePdfDown = (index) => {
    if (index >= selectedPdfs.length - 1) return;
    setSelectedPdfs(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleRemovePdf = (index) => {
    setSelectedPdfs(prev => prev.filter((_, i) => i !== index));
  };

  // --------------------------------------------------------------------------
  // Trigger Conversion Handlers
  // --------------------------------------------------------------------------
  const handleStartConversion = async () => {
    setIsConverting(true);
    setProgressPercent(20);
    setProgressMessage('Executing real backend conversion...');

    try {
      let result = null;
      if (activeTool === 'pdf-to-images' && activeDocument?.path) {
        result = await apiService.pdfToImages({
          source_path: activeDocument.path,
          output_dir: 'rendered_images',
          image_format: imageFormat.toUpperCase(),
          page_selection: imageScope,
          pages: selectedPageIndices
        });
      } else if (activeTool === 'split-pdf' && activeDocument?.path) {
        result = await apiService.splitPDF({
          source_path: activeDocument.path,
          output_dir: 'split_pages',
          split_mode: splitMode === 'every' ? 'every_page' : (splitMode === 'selected' ? 'selected_pages' : 'range'),
          pages: selectedPageIndices,
          register_in_db: indexWithMemora
        });
      } else if (activeTool === 'images-to-pdf' && selectedImages.length > 0) {
        const imagePaths = selectedImages.map(img => img.file?.path || img.path).filter(Boolean);
        if (imagePaths.length > 0) {
          result = await apiService.imagesToPDF({
            image_paths: imagePaths,
            output_path: imagePdfName,
            fit_to_page: true,
            register_in_db: indexWithMemora
          });
        }
      } else if (activeTool === 'merge-pdfs' && selectedPdfs.length > 0) {
        const pdfPaths = selectedPdfs.map(p => p.file?.path || p.path).filter(Boolean);
        if (pdfPaths.length > 0) {
          result = await apiService.mergePDFs({
            source_paths: pdfPaths,
            output_path: mergedPdfName,
            register_in_db: indexWithMemora
          });
        }
      }

      setProgressPercent(100);
      setProgressMessage('Conversion complete!');

      onConfirmConversion({
        tool: activeTool,
        result
      });
      onClose();
    } catch (err) {
      console.error('Conversion failed:', err);
      alert(`Conversion Failed:\n${err.message || 'Error executing conversion on backend.'}`);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Document Conversion Studio"
      subtitle="Convert PDF pages to images, split documents, compile image collections, or merge multiple PDFs."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Tool Selector Navigation Bar */}
        <div className="flex items-center gap-1.5 border-b border-gray-800/80 pb-3 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTool('pdf-to-images')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTool === 'pdf-to-images'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-blue-400" />
            <span>PDF → Images</span>
          </button>

          <button
            onClick={() => setActiveTool('split-pdf')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTool === 'split-pdf'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Scissors className="w-4 h-4 text-purple-400" />
            <span>Split PDF</span>
          </button>

          <button
            onClick={() => setActiveTool('images-to-pdf')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTool === 'images-to-pdf'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <FilePlus className="w-4 h-4 text-emerald-400" />
            <span>Images → PDF</span>
            {selectedImages.length > 0 && <Badge variant="success" size="sm">{selectedImages.length}</Badge>}
          </button>

          <button
            onClick={() => setActiveTool('merge-pdfs')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTool === 'merge-pdfs'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
            }`}
          >
            <Merge className="w-4 h-4 text-amber-400" />
            <span>Merge PDFs</span>
            {selectedPdfs.length > 0 && <Badge variant="warning" size="sm">{selectedPdfs.length}</Badge>}
          </button>
        </div>

        {/* PROGRESS LOADING OVERLAY (During Conversion Execution) */}
        {isConverting ? (
          <div className="p-10 rounded-2xl glass-panel border border-blue-500/30 text-center space-y-4 my-4 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Converting Document Pages...</h4>
              <p className="text-xs text-gray-400 font-mono">{progressMessage}</p>
            </div>
            <div className="w-full bg-gray-950/80 h-2 rounded-full border border-gray-800/80 overflow-hidden max-w-md mx-auto">
              <div 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-500 font-mono">{progressPercent}% Completed</div>
          </div>
        ) : (
          <>
            {/* =================================================================== */}
            {/* TOOL 1: PDF -> IMAGES */}
            {/* =================================================================== */}
            {activeTool === 'pdf-to-images' && (
              <div className="space-y-5">
                {activeDocument ? (
                  <div className="p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400">Source Document: </span>
                      <strong className="text-white">{activeDocument.title}</strong>
                    </div>
                    <Badge variant="blue" size="sm">{totalDocPages} Pages</Badge>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>No document currently loaded in studio workspace. Open a PDF first or select another tool.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Page Scope Selection */}
                  <div>
                    <label className="block text-gray-300 font-semibold mb-1.5">Page Selection</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-950/40 border border-gray-800 cursor-pointer hover:border-gray-700">
                        <input
                          type="radio"
                          name="imageScope"
                          value="all"
                          checked={imageScope === 'all'}
                          onChange={() => setImageScope('all')}
                          className="accent-blue-500"
                        />
                        <span className="text-gray-200">All Pages ({totalDocPages})</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-950/40 border border-gray-800 cursor-pointer hover:border-gray-700">
                        <input
                          type="radio"
                          name="imageScope"
                          value="selected"
                          checked={imageScope === 'selected'}
                          onChange={() => setImageScope('selected')}
                          className="accent-blue-500"
                        />
                        <span className="text-gray-200">
                          Selected Pages ({selectedPageIndices.length})
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-950/40 border border-gray-800 cursor-pointer hover:border-gray-700">
                        <input
                          type="radio"
                          name="imageScope"
                          value="range"
                          checked={imageScope === 'range'}
                          onChange={() => setImageScope('range')}
                          className="accent-blue-500"
                        />
                        <span className="text-gray-200">Custom Page Range</span>
                      </label>
                    </div>

                    {imageScope === 'range' && (
                      <input
                        type="text"
                        value={imageRangeStr}
                        onChange={(e) => setImageRangeStr(e.target.value)}
                        placeholder="e.g. 1-5, 8, 11-14"
                        className="w-full mt-2 p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
                      />
                    )}
                  </div>

                  {/* Output Image Format & Resolution */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 font-semibold mb-1.5">Output Format</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['png', 'jpg', 'webp'].map(fmt => (
                          <button
                            key={fmt}
                            onClick={() => setImageFormat(fmt)}
                            className={`p-2.5 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer ${
                              imageFormat === fmt
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 font-semibold mb-1.5">Resolution / DPI</label>
                      <select
                        value={imageDpi}
                        onChange={(e) => setImageDpi(e.target.value)}
                        className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-medium"
                      >
                        <option value="150">150 DPI (Standard)</option>
                        <option value="300">300 DPI (High Print Quality)</option>
                        <option value="600">600 DPI (Ultra High)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80">
                  <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={Download}
                    disabled={!activeDocument}
                    onClick={handleStartConversion}
                  >
                    Convert PDF Pages to {imageFormat.toUpperCase()} Images
                  </Button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TOOL 2: SPLIT PDF (PAGE -> SEPARATE PDF) */}
            {/* =================================================================== */}
            {activeTool === 'split-pdf' && (
              <div className="space-y-5">
                {activeDocument ? (
                  <div className="p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400">Source PDF: </span>
                      <strong className="text-white">{activeDocument.title}</strong>
                    </div>
                    <Badge variant="blue" size="sm">Pages 1–{totalDocPages}</Badge>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>No document currently loaded. Open a PDF first to perform page splitting.</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <label className="block text-gray-300 font-semibold">Split Action Mode</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => setSplitMode('every')}
                      className={`p-3.5 rounded-xl border text-left space-y-1 transition-all cursor-pointer ${
                        splitMode === 'every'
                          ? 'bg-purple-600/20 border-purple-500/40 text-purple-300 shadow-md'
                          : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <h5 className="font-bold text-white">Export Every Page</h5>
                      <p className="text-[11px] opacity-70">Creates a separate individual PDF for every single page.</p>
                    </button>

                    <button
                      onClick={() => setSplitMode('selected')}
                      className={`p-3.5 rounded-xl border text-left space-y-1 transition-all cursor-pointer ${
                        splitMode === 'selected'
                          ? 'bg-purple-600/20 border-purple-500/40 text-purple-300 shadow-md'
                          : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <h5 className="font-bold text-white">Export Selected Pages</h5>
                      <p className="text-[11px] opacity-70">Exports only active selected pages ({selectedPageIndices.length}).</p>
                    </button>

                    <button
                      onClick={() => setSplitMode('range')}
                      className={`p-3.5 rounded-xl border text-left space-y-1 transition-all cursor-pointer ${
                        splitMode === 'range'
                          ? 'bg-purple-600/20 border-purple-500/40 text-purple-300 shadow-md'
                          : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <h5 className="font-bold text-white">Export Page Range</h5>
                      <p className="text-[11px] opacity-70">Specify exact custom page interval range.</p>
                    </button>
                  </div>

                  {splitMode === 'range' && (
                    <div className="pt-2">
                      <label className="block text-gray-300 font-medium mb-1">Page Range Interval</label>
                      <input
                        type="text"
                        value={splitRangeStr}
                        onChange={(e) => setSplitRangeStr(e.target.value)}
                        placeholder="e.g. 1-10, 15-20"
                        className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="block text-gray-300 font-medium mb-1">Output Naming Pattern</label>
                    <input
                      type="text"
                      value={splitOutputPattern}
                      onChange={(e) => setSplitOutputPattern(e.target.value)}
                      className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80">
                  <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={Scissors}
                    disabled={!activeDocument}
                    onClick={handleStartConversion}
                  >
                    Split & Export PDF Pages
                  </Button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TOOL 3: IMAGES -> PDF */}
            {/* =================================================================== */}
            {activeTool === 'images-to-pdf' && (
              <div className="space-y-4 text-xs">
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/tiff"
                  className="hidden"
                  onChange={(e) => e.target.files && handleAddImages(e.target.files)}
                />

                {/* Dropzone / Upload Bar */}
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-gray-800 bg-gray-950/50 hover:border-gray-700 text-center flex flex-col items-center justify-center cursor-pointer transition-all"
                >
                  <Upload className="w-6 h-6 text-emerald-400 mb-1" />
                  <span className="font-semibold text-white">Click or Drop Real Image Files</span>
                  <span className="text-[11px] text-gray-400 mt-0.5">JPG, PNG, WEBP, BMP, TIFF</span>
                </div>

                {/* Selected Images List */}
                {selectedImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-gray-300 font-medium">
                      <span>Selected Images ({selectedImages.length})</span>
                      <button
                        onClick={() => setSelectedImages([])}
                        className="text-red-400 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {selectedImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className="flex items-center justify-between p-2.5 rounded-xl glass-panel border border-gray-800/80 bg-gray-950/60"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded bg-black border border-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                              <img
                                src={img.previewUrl}
                                alt={img.name}
                                className="w-full h-full object-contain"
                                style={{ transform: `rotate(${img.rotation}deg)` }}
                              />
                            </div>
                            <div className="truncate">
                              <h5 className="font-semibold text-white truncate">{img.name}</h5>
                              <span className="text-[10px] text-gray-400 font-mono">Page #{idx + 1}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleRotateImageLeft(idx)}
                              className="p-1 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
                              title="Rotate Left"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRotateImageRight(idx)}
                              className="p-1 hover:text-white rounded hover:bg-gray-800 cursor-pointer"
                              title="Rotate Right"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveImageUp(idx)}
                              disabled={idx === 0}
                              className="p-1 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveImageDown(idx)}
                              disabled={idx === selectedImages.length - 1}
                              className="p-1 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-300 font-medium mb-1">Compiled Output PDF Name</label>
                  <input
                    type="text"
                    value={imagePdfName}
                    onChange={(e) => setImagePdfName(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80">
                  <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={FilePlus}
                    disabled={selectedImages.length === 0}
                    onClick={handleStartConversion}
                  >
                    Compile {selectedImages.length} Image(s) to PDF
                  </Button>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TOOL 4: MERGE PDFS */}
            {/* =================================================================== */}
            {activeTool === 'merge-pdfs' && (
              <div className="space-y-4 text-xs">
                <input
                  ref={pdfInputRef}
                  type="file"
                  multiple
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files && handleAddPdfs(e.target.files)}
                />

                {/* Dropzone / Select PDFs Bar */}
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-gray-800 bg-gray-950/50 hover:border-gray-700 text-center flex flex-col items-center justify-center cursor-pointer transition-all"
                >
                  <Merge className="w-6 h-6 text-amber-400 mb-1" />
                  <span className="font-semibold text-white">Select PDF Files to Merge</span>
                  <span className="text-[11px] text-gray-400 mt-0.5">Click to browse your local computer for PDF documents</span>
                </div>

                {/* Selected PDFs List */}
                {selectedPdfs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-gray-300 font-medium">
                      <span>PDF Document Queue ({selectedPdfs.length})</span>
                      <button
                        onClick={() => setSelectedPdfs([])}
                        className="text-red-400 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {selectedPdfs.map((pdf, idx) => (
                        <div
                          key={pdf.id}
                          className="flex items-center justify-between p-2.5 rounded-xl glass-panel border border-gray-800/80 bg-gray-950/60"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 font-bold font-mono">
                              #{idx + 1}
                            </div>
                            <div className="truncate">
                              <h5 className="font-semibold text-white truncate">{pdf.name}</h5>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {(pdf.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMovePdfUp(idx)}
                              disabled={idx === 0}
                              className="p-1 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMovePdfDown(idx)}
                              disabled={idx === selectedPdfs.length - 1}
                              className="p-1 hover:text-white disabled:opacity-20 rounded hover:bg-gray-800 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemovePdf(idx)}
                              className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-gray-300 font-medium mb-1">Merged Output PDF Name</label>
                  <input
                    type="text"
                    value={mergedPdfName}
                    onChange={(e) => setMergedPdfName(e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/80">
                  <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={Merge}
                    disabled={selectedPdfs.length === 0}
                    onClick={handleStartConversion}
                  >
                    Merge {selectedPdfs.length} PDF Document(s)
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
