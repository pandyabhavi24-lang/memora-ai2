import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  FileText, 
  Trash2, 
  FolderOpen, 
  Clock, 
  Layers, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import { apiService } from '../../services/apiService';

export const PDFDraftsModal = ({
  isOpen,
  onClose,
  onOpenDraft
}) => {
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchDrafts = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.listPDFDrafts();
      setDrafts(data || []);
    } catch (err) {
      console.warn('Failed to load drafts from backend, reading local fallback:', err);
      try {
        const local = localStorage.getItem('memora_pdf_studio_draft');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.activeDocument) {
            setDrafts([{
              id: 'local_draft',
              name: parsed.activeDocument.title || 'Local Unsaved Workspace',
              document_json: JSON.stringify(parsed.activeDocument),
              page_count: parsed.activeDocument.pages?.length || 1,
              updated_at: parsed.savedAt || new Date().toISOString()
            }]);
          }
        }
      } catch (e) {
        setDrafts([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDrafts();
    }
  }, [isOpen]);

  const handleDelete = async (e, draftId) => {
    e.stopPropagation();
    setDeletingId(draftId);
    try {
      if (draftId === 'local_draft') {
        localStorage.removeItem('memora_pdf_studio_draft');
      } else {
        await apiService.deletePDFDraft(draftId);
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (err) {
      console.error('Error deleting draft:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectDraft = (draft) => {
    try {
      const docModel = typeof draft.document_json === 'string' 
        ? JSON.parse(draft.document_json) 
        : draft.document_json;
      
      onOpenDraft(docModel);
      onClose();
    } catch (err) {
      console.error('Error parsing draft document JSON:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Saved PDF Studio Drafts"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          Reopen an un-exported workspace draft to continue editing elements, text, and images.
        </p>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400" />
            <p className="text-xs font-mono">Loading saved drafts...</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="glass-panel p-8 rounded-xl text-center border border-gray-800/80 bg-gray-950/40 space-y-3">
            <AlertCircle className="w-8 h-8 text-gray-500 mx-auto" />
            <h4 className="text-sm font-semibold text-gray-300">No Drafts Found</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You haven't saved any workspace drafts yet. Click "Save Draft" in the toolbar while working on a PDF.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {drafts.map((d) => {
              const formattedDate = d.updated_at 
                ? new Date(d.updated_at).toLocaleString() 
                : 'Recently modified';

              return (
                <div
                  key={d.id}
                  onClick={() => handleSelectDraft(d)}
                  className="glass-panel p-3.5 rounded-xl border border-gray-800/80 hover:border-blue-500/50 bg-gray-900/60 hover:bg-gray-800/60 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                        {d.name || 'Untitled Draft'}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-purple-400" />
                          {d.page_count} {d.page_count === 1 ? 'Page' : 'Pages'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-400" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={FolderOpen}
                      onClick={() => handleSelectDraft(d)}
                    >
                      Open
                    </Button>
                    <button
                      onClick={(e) => handleDelete(e, d.id)}
                      disabled={deletingId === d.id}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                      title="Delete Draft"
                    >
                      {deletingId === d.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
