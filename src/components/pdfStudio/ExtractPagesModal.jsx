import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Download, Sparkles, FileText, Check } from 'lucide-react';

export const ExtractPagesModal = ({
  isOpen,
  onClose,
  selectedCount = 1,
  selectedPageNumbers = [1],
  defaultFileName = 'extracted_pages.pdf',
  onConfirmExtract
}) => {
  const [extractFileName, setExtractFileName] = useState(defaultFileName);
  const [indexWithMemora, setIndexWithMemora] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsExtracting(true);
    try {
      await onConfirmExtract({
        fileName: extractFileName,
        indexWithMemora
      });
      onClose();
    } catch (err) {
      console.error('Extraction failed:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Extract ${selectedCount === 1 ? 'Page' : `${selectedCount} Pages`}`}
      subtitle="Export selected page(s) into a separate standalone PDF document."
      maxWidth="max-w-md"
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            disabled={isExtracting}
            onClick={handleConfirm}
          >
            Extract {selectedCount === 1 ? 'Page' : `${selectedCount} Pages`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl bg-gray-950/60 border border-gray-800/60 space-y-1.5 font-mono">
          <div className="flex justify-between text-gray-300">
            <span>Pages to Extract:</span>
            <span className="text-blue-400 font-bold">
              {selectedPageNumbers.map(n => `#${n}`).join(', ')}
            </span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Total Extract Count:</span>
            <span className="text-gray-200">{selectedCount} {selectedCount === 1 ? 'Page' : 'Pages'}</span>
          </div>
        </div>

        <div>
          <label className="block text-gray-300 font-medium mb-1.5">Output PDF File Name</label>
          <input
            type="text"
            value={extractFileName}
            onChange={(e) => setExtractFileName(e.target.value)}
            className="w-full p-2.5 rounded-xl glass-input text-gray-200 text-xs font-mono font-medium"
          />
        </div>

        {/* Index with Memora Toggle */}
        <div 
          onClick={() => setIndexWithMemora(!indexWithMemora)}
          className="flex items-center justify-between p-3 rounded-xl bg-gray-950/60 border border-gray-800/60 cursor-pointer hover:border-gray-700/60 transition-all"
        >
          <div className="space-y-0.5 pr-2">
            <div className="flex items-center gap-1.5 font-semibold text-gray-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Index Extracted PDF with Memora</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              Automatically register and vector index extracted file for search.
            </p>
          </div>
          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
            indexWithMemora ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 bg-gray-900'
          }`}>
            {indexWithMemora && <Check className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>
    </Modal>
  );
};
