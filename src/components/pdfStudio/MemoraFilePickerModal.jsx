import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Check, 
  Layers, 
  AlertTriangle, 
  Loader2, 
  Folder, 
  FileCheck,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { semanticSearchService } from '../../services/semanticSearchService';
import { apiService } from '../../services/apiService';
import { useApp } from '../../context/AppContext';

export const MemoraFilePickerModal = ({
  isOpen,
  onClose,
  onSelectFile,
  onAddSelectedFiles
}) => {
  const { recentFiles = [] } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all'); // 'all' | 'pdf' | 'image' | 'scanned'
  const [selectedFolder, setSelectedFolder] = useState('all');
  
  // Results & API Async States
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Selection & Mode State
  // Map of fileId -> { fileObj, pdfImportMode: 'entire' | 'pages', pageRange: string }
  const [selectedFilesMap, setSelectedFilesMap] = useState({});

  // --------------------------------------------------------------------------
  // API Integration Boundary: Search Memora Vector Store
  // --------------------------------------------------------------------------
  const performMemoraSearch = async (query, typeFilter, folderFilter) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (query && query.trim().length > 0) {
        // Execute real Module 1 Semantic Search API
        const response = await semanticSearchService.search(query, {
          fileType: typeFilter !== 'all' ? typeFilter : null,
          folder: folderFilter !== 'all' ? folderFilter : null
        });

        const transformed = (response.results || []).map(r => r.file || r);
        setResults(transformed);
      } else {
        // Fetch real Memora files via PDF Studio file endpoint
        try {
          const res = await apiService.getMemoraFilesForPDFStudio({
            file_type: typeFilter !== 'all' ? typeFilter : null
          });
          if (res && res.files && res.files.length > 0) {
            setResults(res.files);
          } else {
            setResults(recentFiles || []);
          }
        } catch (e) {
          setResults(recentFiles || []);
        }
      }
    } catch (err) {
      console.warn('Memora API search error in file picker:', err);
      setErrorMessage('Could not query local Memora index. Showing recent local documents.');
      setResults(recentFiles || []);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Load and Search Debounce
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      performMemoraSearch(searchQuery, fileTypeFilter, selectedFolder);
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, searchQuery, fileTypeFilter, selectedFolder]);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFilesMap({});
      setSearchQuery('');
      setFileTypeFilter('all');
      setSelectedFolder('all');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // --------------------------------------------------------------------------
  // Client-side Filter Layer (Applied over API/Recent Results)
  // --------------------------------------------------------------------------
  const filteredResults = results.filter(file => {
    const name = (file.name || file.filename || file.file_name || '').toLowerCase();
    const ext = (file.extension || file.fileExtension || file.name?.split('.').pop() || '').toLowerCase();
    const folderPath = (file.path || file.folderName || '').toLowerCase();

    // Type Filter
    if (fileTypeFilter === 'pdf' && ext !== 'pdf') return false;
    if (fileTypeFilter === 'image' && !['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'].includes(ext)) return false;
    if (fileTypeFilter === 'scanned' && !file.isScanned && ext !== 'pdf') return false;

    // Folder Filter
    if (selectedFolder !== 'all' && !folderPath.includes(selectedFolder.toLowerCase())) return false;

    return true;
  });

  // --------------------------------------------------------------------------
  // Selection Handlers
  // --------------------------------------------------------------------------
  const toggleSelectFile = (fileObj) => {
    const fileId = fileObj.id || fileObj.file_id || fileObj.path;
    setSelectedFilesMap(prev => {
      const updated = { ...prev };
      if (updated[fileId]) {
        delete updated[fileId];
      } else {
        updated[fileId] = {
          file: fileObj,
          importMode: 'entire', // 'entire' | 'pages'
          pageRange: '1-5'
        };
      }
      return updated;
    });
  };

  const handleUpdateFileOption = (fileId, key, value) => {
    setSelectedFilesMap(prev => {
      if (!prev[fileId]) return prev;
      return {
        ...prev,
        [fileId]: {
          ...prev[fileId],
          [key]: value
        }
      };
    });
  };

  const handleSelectAll = () => {
    const newMap = {};
    filteredResults.forEach(f => {
      const id = f.id || f.file_id || f.path;
      newMap[id] = { file: f, importMode: 'entire', pageRange: '1-5' };
    });
    setSelectedFilesMap(newMap);
  };

  const handleClearSelection = () => {
    setSelectedFilesMap({});
  };

  // --------------------------------------------------------------------------
  // Final Confirmation Action
  // --------------------------------------------------------------------------
  const handleConfirmAdd = () => {
    const selectedList = Object.values(selectedFilesMap);
    if (selectedList.length === 0) return;

    if (onAddSelectedFiles) {
      onAddSelectedFiles(selectedList);
    } else if (onSelectFile && selectedList.length > 0) {
      // Single file fallback for backwards compatibility
      onSelectFile(selectedList[0].file);
    }

    onClose();
  };

  const selectedCount = Object.keys(selectedFilesMap).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Document from Memora"
      subtitle="Search and import indexed PDFs, scanned documents, and images directly from your MemoraAI memory store."
      maxWidth="max-w-2xl"
      actions={
        <>
          <div className="flex items-center gap-2 mr-auto">
            {selectedCount > 0 && (
              <span className="text-xs text-blue-400 font-semibold font-mono flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                <FileCheck className="w-3.5 h-3.5" />
                <span>{selectedCount} item{selectedCount > 1 ? 's' : ''} selected</span>
              </span>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={selectedCount === 0}
            onClick={handleConfirmAdd}
            icon={Sparkles}
          >
            Add Selected ({selectedCount})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Memora files by name, OCR text, or topic..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl glass-input placeholder-gray-500 text-white font-medium shadow-sm focus:border-blue-500/50"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {/* Filter Toolbar & Quick Selects */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-950/60 p-2 rounded-xl border border-gray-800/60 text-xs">
          {/* File Type Filter Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFileTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                fileTypeFilter === 'all'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Types
            </button>

            <button
              onClick={() => setFileTypeFilter('pdf')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                fileTypeFilter === 'pdf'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              PDFs
            </button>

            <button
              onClick={() => setFileTypeFilter('image')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                fileTypeFilter === 'image'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Images
            </button>

            <button
              onClick={() => setFileTypeFilter('scanned')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                fileTypeFilter === 'scanned'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Scanned Docs
            </button>
          </div>

          {/* Quick Selection Actions */}
          <div className="flex items-center gap-2">
            {filteredResults.length > 0 && (
              <button
                onClick={selectedCount === filteredResults.length ? handleClearSelection : handleSelectAll}
                className="text-[11px] text-gray-400 hover:text-blue-400 transition-colors cursor-pointer font-mono"
              >
                {selectedCount === filteredResults.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Results List Viewport */}
        <div className="space-y-2 h-80 overflow-y-auto custom-scrollbar pr-1">
          {isLoading ? (
            <div className="py-12 text-center space-y-3 glass-panel rounded-xl border border-gray-800/80">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-xs text-gray-400 font-medium">Loading Memora documents & media files...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            filteredResults.map((fileObj) => {
              const fileId = fileObj.id || fileObj.file_id || fileObj.path;
              const fileName = fileObj.name || fileObj.filename || fileObj.file_name || 'Document.pdf';
              const filePath = fileObj.path || fileObj.filePath || fileObj.folderName || 'Indexed Store';
              const ext = (fileObj.extension || fileObj.fileExtension || fileName.split('.').pop() || 'pdf').toLowerCase().replace(/^\./, '');
              const isPdf = ext === 'pdf';
              const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif'].includes(ext);
              const isSelected = !!selectedFilesMap[fileId];
              const selectedConfig = selectedFilesMap[fileId];
              const sizeInKb = fileObj.size ? (fileObj.size > 1048576 ? `${(fileObj.size / 1048576).toFixed(1)} MB` : `${Math.round(fileObj.size / 1024)} KB`) : null;
              const previewSrc = fileObj.previewUrl || fileObj.thumbnailUrl || (isImage && filePath ? `file://${filePath.replace(/\\/g, '/')}` : null);

              return (
                <div
                  key={fileId}
                  className={`p-3 rounded-xl border transition-all space-y-2 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 shadow-md shadow-blue-500/10'
                      : 'bg-gray-900/40 border-gray-800/60 hover:bg-gray-800/40 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Checkbox & File Info */}
                    <div 
                      onClick={() => toggleSelectFile(fileObj)}
                      className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer"
                    >
                      <div className="shrink-0 text-gray-400 hover:text-blue-400 transition-colors">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600" />
                        )}
                      </div>

                      {/* File Icon or Thumbnail Preview */}
                      <div className="w-10 h-10 rounded-lg bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center text-blue-400 shrink-0 relative">
                        {isImage && previewSrc ? (
                          <img 
                            src={previewSrc} 
                            alt={fileName} 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : isPdf ? (
                          <FileText className="w-5 h-5 text-blue-400" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>

                      <div className="truncate flex-1">
                        <h4 className="text-xs font-semibold text-white truncate">{fileName}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 truncate">
                          <span className="truncate flex items-center gap-1">
                            <Folder className="w-3 h-3 text-gray-500 shrink-0" />
                            <span className="truncate">{filePath}</span>
                          </span>
                          {sizeInKb && (
                            <span className="text-[10px] bg-gray-800/80 px-1.5 py-0.2 rounded text-gray-400 font-mono shrink-0">
                              {sizeInKb}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* File Extension Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={isPdf ? 'blue' : isImage ? 'emerald' : 'purple'} size="sm">
                        {ext.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Contextual Import Options for Selected PDFs */}
                  {isSelected && isPdf && (
                    <div className="pt-2 border-t border-blue-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Import Mode:</span>
                        <select
                          value={selectedConfig.importMode}
                          onChange={(e) => handleUpdateFileOption(fileId, 'importMode', e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded px-2 py-0.5 text-[11px] text-gray-200"
                        >
                          <option value="entire">Select Entire PDF</option>
                          <option value="pages">Select Specific Pages</option>
                        </select>
                      </div>

                      {selectedConfig.importMode === 'pages' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-400">Page Range:</span>
                          <input
                            type="text"
                            value={selectedConfig.pageRange}
                            onChange={(e) => handleUpdateFileOption(fileId, 'pageRange', e.target.value)}
                            placeholder="e.g. 1-3, 5"
                            className="w-24 bg-gray-950 border border-gray-800 rounded px-2 py-0.5 text-[11px] text-gray-200 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center glass-panel rounded-xl border border-dashed border-gray-800 space-y-2">
              <Layers className="w-8 h-8 text-gray-500 mx-auto mb-1" />
              <h4 className="text-xs font-semibold text-gray-300">No Files Found</h4>
              <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
                No indexed files or images match the current filter. Add document folders or upload images to see them here.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
