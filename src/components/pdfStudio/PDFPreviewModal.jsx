import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Eye, 
  Download, 
  FileText, 
  Loader2, 
  X, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';
import { apiService } from '../../services/apiService';

export const PDFPreviewModal = ({
  isOpen,
  onClose,
  activeDocument,
  pageSize = 'A4',
  orientation = 'portrait',
  onOpenExport
}) => {
  const [isCompiling, setIsCompiling] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [compiledInfo, setCompiledInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const compileRealPreviewPDF = async () => {
      if (!isOpen || !activeDocument || !activeDocument.pages || activeDocument.pages.length === 0) {
        return;
      }

      setIsCompiling(true);
      setErrorMessage('');
      setPreviewUrl(null);
      setCompiledInfo(null);

      try {
        const tempPath = `preview_temp_${Date.now()}.pdf`;
        const res = await apiService.exportWorkspacePDF({
          output_path: tempPath,
          pages: activeDocument.pages,
          page_size: pageSize,
          orientation: orientation,
          register_in_db: false
        });

        if (!isMounted) return;

        if (res && res.output_path) {
          setCompiledInfo(res);
          const fullUrl = `http://localhost:8000/api/pdf/preview-file?file_path=${encodeURIComponent(res.output_path)}`;
          setPreviewUrl(fullUrl);
        } else {
          throw new Error('Preview compilation returned invalid response.');
        }
      } catch (err) {
        console.error('Real PDF Preview compilation error:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to compile real PDF preview with ReportLab.');
        }
      } finally {
        if (isMounted) setIsCompiling(false);
      }
    };

    compileRealPreviewPDF();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeDocument, pageSize, orientation]);

  if (!isOpen || !activeDocument) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview: ${activeDocument.title || activeDocument.name || 'Untitled Document'}`}
      subtitle="ReportLab Real PDF Preview — Verified Output matching exact final PDF export."
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Header Metadata Pill Bar */}
        <div className="flex items-center justify-between bg-gray-950/80 px-4 py-2 rounded-xl border border-gray-800 text-xs">
          <div className="flex items-center gap-2 text-gray-300 font-mono">
            <Badge variant="blue" size="sm">ReportLab Engine</Badge>
            <span>•</span>
            <span>{activeDocument.pages?.length || 0} Pages</span>
            <span>•</span>
            <span>{pageSize} ({orientation})</span>
          </div>

          {compiledInfo && (
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified File: {(compiledInfo.file_size_bytes / 1024).toFixed(1)} KB
            </span>
          )}
        </div>

        {/* Real Compiled PDF Preview Viewer */}
        <div className="bg-gray-950 rounded-2xl border border-gray-800/80 min-h-[520px] h-[65vh] flex items-center justify-center relative overflow-hidden select-none">
          {isCompiling ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-gray-400">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Compiling Real PDF Preview...</h4>
                <p className="text-xs text-gray-500 mt-1 font-mono">Rendering text elements & images via ReportLab</p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-red-400 max-w-md">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <h4 className="text-sm font-bold text-white">Preview Rendering Error</h4>
              <p className="text-xs text-red-300 font-mono">{errorMessage}</p>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title="Real PDF Studio Preview"
              className="w-full h-full rounded-2xl border-0 bg-white"
            />
          ) : (
            <div className="text-xs text-gray-500 font-mono">No preview available.</div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800/60">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close Preview
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={Download}
            onClick={() => {
              onClose();
              if (onOpenExport) onOpenExport();
            }}
          >
            Export Document
          </Button>
        </div>
      </div>
    </Modal>
  );
};
