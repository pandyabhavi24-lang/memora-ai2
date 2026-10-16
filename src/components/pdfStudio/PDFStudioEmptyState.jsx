import { 
  FileText, 
  FilePlus, 
  FolderOpen, 
  Layers, 
  Sparkles, 
  Merge, 
  Type, 
  ShieldCheck,
  FileOutput,
  Save
} from 'lucide-react';
import { Button } from '../common/Button';

export const PDFStudioEmptyState = ({
  onCreateNew,
  onOpenPDF,
  onOpenDrafts,
  onAddFromMemora
}) => {
  return (
    <div className="space-y-6">
      {/* Primary Empty State Hero */}
      <div className="p-12 rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629]/90 backdrop-blur-md text-center flex flex-col items-center justify-center space-y-6 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#3478F6]/20 to-[#7566F6]/20 border border-[#3478F6]/30 flex items-center justify-center text-[#4B91FF] shadow-lg shadow-[#3478F6]/10">
          <FileText className="w-8 h-8" />
        </div>

        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-bold text-[#F4F7FF] tracking-wide">PDF Studio</h2>
          <p className="text-sm text-[#A7B7D0] leading-relaxed">
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

          {onOpenDrafts && (
            <Button
              variant="secondary"
              size="md"
              icon={Save}
              onClick={onOpenDrafts}
            >
              Drafts
            </Button>
          )}

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
        <div className="p-5 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629]/70 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-[#3478F6]/15 border border-[#3478F6]/30 flex items-center justify-center text-[#4B91FF]">
            <Merge className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F4F7FF]">Page Management</h4>
            <p className="text-xs text-[#A7B7D0] mt-1 leading-relaxed">
              Reorder, split, rotate, and merge pages seamlessly within your PDF workspace.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629]/70 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-[#7566F6]/15 border border-[#7566F6]/30 flex items-center justify-center text-[#C4B5FD]">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F4F7FF]">Text & Annotations</h4>
            <p className="text-xs text-[#A7B7D0] mt-1 leading-relaxed">
              Add custom text overlays, highlight text, insert stamps, and annotate pages.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629]/70 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileOutput className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F4F7FF]">Save &amp; Find Later</h4>
            <p className="text-xs text-[#A7B7D0] mt-1 leading-relaxed">
              Exported PDFs are saved to your computer and can be made searchable inside Memora.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
