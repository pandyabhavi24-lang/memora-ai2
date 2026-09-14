import React from 'react';
import { 
  FileText, 
  FilePlus, 
  FolderOpen, 
  Layers, 
  Sparkles, 
  Merge, 
  Type, 
  ShieldCheck,
  FileOutput
} from 'lucide-react';
import { Button } from '../common/Button';

export const PDFStudioEmptyState = ({
  onCreateNew,
  onOpenPDF,
  onAddFromMemora
}) => {
  return (
    <div className="space-y-6">
      {/* Primary Empty State Hero */}
      <div className="glass-panel p-12 rounded-2xl border border-gray-800/80 bg-gray-900/60 backdrop-blur-md text-center flex flex-col items-center justify-center space-y-6 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
          <FileText className="w-8 h-8" />
        </div>

        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-bold text-white tracking-wide">PDF Studio</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Create or open a document to get started.
          </p>
        </div>

        {/* Core Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            icon={FilePlus}
            onClick={onCreateNew}
          >
            Create New PDF
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={FolderOpen}
            onClick={onOpenPDF}
          >
            Open PDF
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={Layers}
            onClick={onAddFromMemora}
          >
            Add from Memora
          </Button>
        </div>
      </div>

      {/* Studio Capabilities Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-gray-800/60 bg-gray-900/40 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Merge className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Page Management</h4>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Reorder, split, rotate, and merge pages seamlessly within your PDF workspace.
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-gray-800/60 bg-gray-900/40 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Text & Annotations</h4>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Add custom text overlays, highlight text, insert stamps, and annotate pages.
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-gray-800/60 bg-gray-900/40 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileOutput className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Memora Pipeline Sync</h4>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Exported PDFs can be automatically registered and indexed into Memora's search system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
