import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  Folder, 
  FolderOpen, 
  Sparkles, 
  Info, 
  Check, 
  AlertCircle,
  FileCheck
} from 'lucide-react';

export const ExportModal = ({
  isOpen,
  onClose,
  activeDocument,
  defaultFileName = 'document_export.pdf',
  onConfirmExport,
  isExporting = false
}) => {
  const [outputFormat, setOutputFormat] = useState('pdf'); // 'pdf' | 'png' | 'jpg'
  const [fileName, setFileName] = useState(defaultFileName);
  const [outputFolder, setOutputFolder] = useState('Downloads');
  const [exportRange, setExportRange] = useState('all'); // 'all' | 'custom'
  const [customPageRange, setCustomPageRange] = useState('1-5');
  const [indexWithMemora, setIndexWithMemora] = useState(true);

  if (!activeDocument) return null;

  const pageCount = activeDocument.pages?.length || 1;

  // Handle format change and update file extension accordingly
  const handleFormatChange = (fmt) => {
    setOutputFormat(fmt);
    const baseName = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
    if (fmt === 'pdf') {
      setFileName(`${baseName}.pdf`);
    } else if (fmt === 'png') {
      setFileName(`${baseName}.png`);
    } else if (fmt === 'jpg') {
      setFileName(`${baseName}.jpg`);
    }
  };

  // Browse output directory via Electron native dialog if available
  const handleBrowseOutputFolder = async () => {
    if (window.electronAPI && window.electronAPI.openDirectory) {
      try {
        const result = await window.electronAPI.openDirectory();
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          setOutputFolder(result.filePaths[0]);
        }
      } catch (err) {
        console.error('Failed to open directory dialog:', err);
      }
    } else {
      const userPath = prompt('Enter destination output folder path:', outputFolder);
      if (userPath && userPath.trim()) {
        setOutputFolder(userPath.trim());
      }
    }
  };

  const handleExportClick = async () => {
    try {
      await onConfirmExport({
        outputFormat,
        fileName,
        outputFolder,
        exportRange,
        customPageRange,
        indexWithMemora,
        pageCount
      });
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Estimate file size based on page count and format
  const estimatedSizeMb = (
    outputFormat === 'pdf' ? (pageCount * 0.35).toFixed(1) : (pageCount * 0.85).toFixed(1)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Document"
      subtitle="Configure output parameters and generate the final document file."
      maxWidth="max-w-xl"
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportClick}
            disabled={isExporting || !fileName.trim()}
            icon={Download}
          >
            {isExporting ? 'Generating Output...' : 'Export Document'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Concept Notice: Save vs Export */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-semibold text-blue-200">Save vs. Export Concept</h4>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              <strong>Save</strong> preserves your active document state & draft overlays inside PDF Studio.<br />
              <strong>Export</strong> compiles and outputs the final file to your specified output folder.
            </p>
          </div>
        </div>

        {/* Output Format Selector */}
        <div>
          <label className="block text-gray-300 font-medium mb-1.5">Output Format</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleFormatChange('pdf')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                outputFormat === 'pdf'
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-semibold shadow-md shadow-blue-500/10'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
              }`}
            >
              <FileText className="w-5 h-5 text-blue-400" />
              <span>PDF Document</span>
              <span className="text-[10px] text-gray-500 font-mono">.pdf</span>
            </button>

            <button
              type="button"
              onClick={() => handleFormatChange('png')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                outputFormat === 'png'
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 font-semibold shadow-md shadow-emerald-500/10'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
              }`}
            >
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              <span>PNG Image Series</span>
              <span className="text-[10px] text-gray-500 font-mono">.png</span>
            </button>

            <button
              type="button"
              onClick={() => handleFormatChange('jpg')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                outputFormat === 'jpg'
                  ? 'bg-amber-600/20 border-amber-500/50 text-amber-300 font-semibold shadow-md shadow-amber-500/10'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
              }`}
            >
              <ImageIcon className="w-5 h-5 text-amber-400" />
              <span>JPG Image Series</span>
              <span className="text-[10px] text-gray-500 font-mono">.jpg</span>
            </button>
          </div>
        </div>

        {/* File Name & Output Location */}
        <div className="space-y-3">
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">Export File Name</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="document_export.pdf"
              className="w-full p-2.5 rounded-xl glass-input text-white text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1.5">Output Directory / Destination</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 p-2 rounded-xl bg-gray-950/60 border border-gray-800 text-gray-300 font-mono text-xs overflow-hidden">
                <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">{outputFolder}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={FolderOpen}
                onClick={handleBrowseOutputFolder}
                type="button"
              >
                Browse...
              </Button>
            </div>
          </div>
        </div>

        {/* Page Range Selection */}
        <div>
          <label className="block text-gray-300 font-medium mb-1.5">Page Range</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setExportRange('all')}
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                exportRange === 'all'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-semibold'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              All Pages ({pageCount})
            </button>

            <button
              type="button"
              onClick={() => setExportRange('custom')}
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                exportRange === 'custom'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-semibold'
                  : 'bg-gray-950/40 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Custom Range
            </button>
          </div>

          {exportRange === 'custom' && (
            <div className="mt-2">
              <input
                type="text"
                value={customPageRange}
                onChange={(e) => setCustomPageRange(e.target.value)}
                placeholder="e.g. 1-3, 5"
                className="w-full p-2 rounded-lg glass-input text-gray-200 text-xs font-mono"
              />
            </div>
          )}
        </div>

        {/* Option: Index with Memora */}
        <div 
          onClick={() => setIndexWithMemora(v => !v)}
          className="flex items-center justify-between p-3 rounded-xl bg-gray-950/60 border border-gray-800/60 cursor-pointer hover:border-gray-700/60 transition-all"
        >
          <div className="space-y-0.5 pr-2">
            <div className="flex items-center gap-1.5 font-semibold text-gray-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Index with Memora upon Export</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              Automatically index exported file for Module 1 intelligent semantic search.
            </p>
          </div>
          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
            indexWithMemora ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 bg-gray-900'
          }`}>
            {indexWithMemora && <Check className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Export Summary Card */}
        <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800/80 space-y-2">
          <div className="flex items-center justify-between font-semibold text-gray-300 pb-1.5 border-b border-gray-800/60">
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Export Summary</span>
            </span>
            <Badge variant="blue" size="sm">Ready for Export</Badge>
          </div>

          <div className="space-y-1 text-gray-400 font-mono text-[11px]">
            <div className="flex justify-between">
              <span>Document Name:</span>
              <span className="text-white font-bold">{activeDocument.title || 'Untitled'}</span>
            </div>
            <div className="flex justify-between">
              <span>Pages Included:</span>
              <span className="text-gray-200">{exportRange === 'all' ? `${pageCount} pages` : customPageRange}</span>
            </div>
            <div className="flex justify-between">
              <span>Output Format:</span>
              <span className="text-blue-400 font-semibold uppercase">{outputFormat}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated File Size:</span>
              <span className="text-gray-200">~{estimatedSizeMb} MB</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
