import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  FolderOpen, 
  Copy, 
  Check, 
  Brain, 
  Tag,
  Folder
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { apiService } from '../services/apiService';
import { useApp } from '../context/AppContext';

export const FilePreviewModal = ({ file, onClose }) => {
  const { addToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'text'
  const [realContent, setRealContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (file && file.id) {
      fetchContent(file.id);
    }
  }, [file]);

  const fetchContent = async (fileId) => {
    setLoadingContent(true);
    try {
      const data = await apiService.getFileContent(fileId);
      setRealContent(data.extracted_text || file.extractedSnippet || 'No content extracted.');
    } catch (err) {
      setRealContent(file.extractedSnippet || 'Extracted document snippet preview.');
    } finally {
      setLoadingContent(false);
    }
  };

  if (!file) return null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path || '');
    setCopied(true);
    addToast('File path copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFile = () => {
    apiService.openFile(file.path);
  };

  const handleLocateFile = () => {
    apiService.locateFile(file.path);
  };

  return (
    <Modal
      isOpen={!!file}
      onClose={onClose}
      title={file.name}
      subtitle={file.path}
      maxWidth="max-w-3xl"
      actions={
        <>
          <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={handleCopyPath}>
            {copied ? 'Copied Path' : 'Copy Path'}
          </Button>
          <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handleLocateFile}>
            Locate
          </Button>
          <Button variant="primary" size="sm" icon={ExternalLink} onClick={handleOpenFile}>
            Open File
          </Button>
        </>
      }
    >
      <div className="space-y-5 select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between text-[11px] text-[#8BAAD7] font-mono border-b border-[rgba(139,170,215,0.14)] pb-2.5">
          <span>Memora AI Local File Inspector</span>
          <span className="text-[#38BDF8] font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse"></span>
            [Indexed & Verified]
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-[#0A1629] border border-[rgba(139,170,215,0.14)] shadow-xs">
            <div className="text-[11px] text-[#8BAAD7] font-medium mb-0.5">Format</div>
            <div className="text-xs font-semibold text-white uppercase">{file.fileExtension || file.category || 'FILE'}</div>
          </div>

          <div className="p-3 rounded-xl bg-[#0A1629] border border-[rgba(139,170,215,0.14)] shadow-xs">
            <div className="text-[11px] text-[#8BAAD7] font-medium mb-0.5">Size</div>
            <div className="text-xs font-semibold text-white font-mono">
              {file.sizeBytes ? (file.sizeBytes / 1024 / 1024).toFixed(2) + ' MB' : 'Local File'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0A1629] border border-[rgba(139,170,215,0.14)] shadow-xs">
            <div className="text-[11px] text-[#8BAAD7] font-medium mb-0.5">Modified Date</div>
            <div className="text-xs font-semibold text-white font-mono">
              {file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : 'Recent'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 shadow-xs">
            <div className="text-[11px] text-emerald-400 font-medium mb-0.5">Match Relevance</div>
            <div className="text-xs font-bold text-emerald-300 font-mono">
              {file.relevanceScore || file.score || 95}% Match
            </div>
          </div>
        </div>

        {/* Location Bar */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.14)] text-xs font-mono text-[#8BAAD7]">
          <Folder className="w-4 h-4 text-[#38BDF8] shrink-0" />
          <span className="truncate select-all text-[#DCE5F3]">{file.path}</span>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[rgba(139,170,215,0.14)] pb-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-[#3478F6]/20 text-[#60A5FA] border border-[#3478F6]/40 shadow-xs'
                : 'text-[#8BAAD7] hover:text-white hover:bg-[#0A1629]'
            }`}
          >
            AI Insight & Overview
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-[#3478F6]/20 text-[#60A5FA] border border-[#3478F6]/40 shadow-xs'
                : 'text-[#8BAAD7] hover:text-white hover:bg-[#0A1629]'
            }`}
          >
            Extracted Text Content
          </button>
        </div>

        {/* Tab Content Display */}
        {activeTab === 'summary' && (
          <div className="space-y-3.5">
            <div className="p-4 rounded-xl bg-[#0A1629] border border-[rgba(139,170,215,0.14)] shadow-xs">
              <h4 className="text-xs font-semibold text-[#38BDF8] flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-[#38BDF8]" />
                <span>AI Content Summary & Snippet</span>
              </h4>
              <p className="text-xs text-[#CBD5E1] leading-relaxed">
                {file.aiSummary || file.extractedSnippet || 'Document content indexed locally.'}
              </p>
            </div>

            {file.aiExplanation && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                <strong className="text-purple-300 block mb-1 font-semibold">Search Match Context:</strong>
                "{file.aiExplanation}"
              </div>
            )}

            {file.tags && (
              <div>
                <h4 className="text-xs font-semibold text-[#8BAAD7] mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#8BAAD7]" />
                  <span>Indexed Tags</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {file.tags.map((tag, idx) => (
                    <Badge key={idx} variant="blue" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'text' && (
          <div className="p-4 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.14)] text-xs text-[#CBD5E1] font-mono leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
            {loadingContent ? (
              <div className="text-[#8BAAD7] italic">Loading extracted content from local database...</div>
            ) : (
              realContent || 'No extracted text content.'
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
