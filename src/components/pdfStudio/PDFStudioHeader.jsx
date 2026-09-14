import React from 'react';
import { 
  FileText, 
  FilePlus, 
  FolderOpen, 
  Layers, 
  Download, 
  ArrowRightLeft,
  Eye,
  Save
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

export const PDFStudioHeader = ({
  hasDocument = false,
  documentTitle = 'Untitled Document',
  pageCount = 0,
  hasUnsavedChanges = false,
  onNewPDF,
  onOpenPDF,
  onAddFromMemora,
  onOpenConvert,
  onSaveDraft,
  onOpenPreview,
  onExport,
  isExporting = false
}) => {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-gray-800/80 bg-gray-900/60 backdrop-blur-md shadow-xl select-none">
      {/* Title & Status */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 border border-blue-500/30 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-white tracking-wide truncate max-w-xs md:max-w-md">
                {hasDocument ? documentTitle : 'PDF Studio'}
              </h1>
              {hasDocument ? (
                <div className="flex items-center gap-1.5">
                  <Badge variant="blue" size="sm">
                    {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
                  </Badge>
                  {hasUnsavedChanges && (
                    <Badge variant="warning" size="sm">
                      Unsaved Changes
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge variant="default" size="sm">
                  Studio Workspace
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-400 font-medium">
              Create, edit, organize, annotate, and convert your documents with precision.
            </p>
          </div>
        </div>
      </div>

      {/* Header Action Buttons */}
      <div className="flex items-center flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          icon={FilePlus}
          onClick={onNewPDF}
          title="Create a new blank PDF or compile images into a PDF"
          aria-label="Create New PDF Document"
        >
          New PDF
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={FolderOpen}
          onClick={onOpenPDF}
          title="Open a local PDF file from disk"
          aria-label="Open PDF from Disk"
        >
          Open PDF
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={Layers}
          onClick={onAddFromMemora}
          title="Import indexed PDFs, scanned docs, or images from Memora Memory Store"
          aria-label="Add Document from Memora"
        >
          Add from Memora
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={ArrowRightLeft}
          onClick={onOpenConvert}
          title="Convert PDF to images, split PDF, merge PDFs, or convert images to PDF"
          aria-label="Open Conversion Tools"
        >
          Convert
        </Button>

        {hasDocument && (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={Save}
              onClick={onSaveDraft}
              title="Save current working draft state locally in PDF Studio"
              aria-label="Save Draft Document State"
            >
              Save Draft
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={onOpenPreview}
              title="Full-screen document preview before export"
              aria-label="Preview Document"
            >
              Preview
            </Button>
          </>
        )}

        <Button
          variant={hasDocument ? "primary" : "ghost"}
          size="sm"
          icon={Download}
          onClick={onExport}
          disabled={!hasDocument || isExporting}
          title="Export final output document (PDF, PNG, or JPG)"
          aria-label="Export Document"
        >
          Export
        </Button>
      </div>
    </header>
  );
};

