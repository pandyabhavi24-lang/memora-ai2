import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  FolderKanban, 
  Briefcase, 
  Award, 
  Receipt, 
  User, 
  Image as ImageIcon, 
  FileText, 
  PieChart, 
  Folder, 
  FolderTree, 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  FolderSearch,
  Code2
} from 'lucide-react';
import { organizationService } from '../../services/organizationService';

export const CategoryOverview = ({ refreshTrigger }) => {
  const [overviewData, setOverviewData] = useState({
    existingFolders: [],
    aiCategories: [],
    totalFiles: 0
  });
  const [activeTab, setActiveTab] = useState('both'); // 'both' | 'existing' | 'ai'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getOverview();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setOverviewData({
          existingFolders: Array.isArray(data.existingFolders) ? data.existingFolders : [],
          aiCategories: Array.isArray(data.aiCategories) ? data.aiCategories : [],
          totalFiles: data.totalFiles || 0
        });
      } else if (Array.isArray(data)) {
        setOverviewData({
          existingFolders: [],
          aiCategories: data,
          totalFiles: data.reduce((acc, curr) => acc + (curr.fileCount || 0), 0)
        });
      }
    } catch (err) {
      console.error('Failed to load organization overview from backend API:', err);
      setError('Unable to load overview data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [refreshTrigger]);

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Education':
        return <GraduationCap className="w-4 h-4 text-[#4B91FF]" />;
      case 'Programming':
        return <Code2 className="w-4 h-4 text-emerald-400" />;
      case 'Projects':
        return <FolderKanban className="w-4 h-4 text-[#7566F6]" />;
      case 'Work':
        return <Briefcase className="w-4 h-4 text-sky-400" />;
      case 'Certificates':
        return <Award className="w-4 h-4 text-emerald-400" />;
      case 'Finance':
        return <Receipt className="w-4 h-4 text-amber-400" />;
      case 'Personal':
        return <User className="w-4 h-4 text-pink-400" />;
      case 'Images':
        return <ImageIcon className="w-4 h-4 text-indigo-400" />;
      case 'Documents':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      default:
        return <FileText className="w-4 h-4 text-[#71839E]" />;
    }
  };

  const existingFolders = overviewData.existingFolders || [];
  const aiCategories = overviewData.aiCategories || [];
  const hasData = existingFolders.length > 0 || aiCategories.length > 0;

  return (
    <div className="rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] p-6 mb-8 shadow-xl space-y-6">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[rgba(52,120,246,0.15)] border border-[rgba(52,120,246,0.3)] flex items-center justify-center text-[#4B91FF]">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#F4F7FF] tracking-tight">
              Organization Overview
            </h2>
            <p className="text-xs text-[#A7B7D0]">
              Complete view of existing physical folders and AI-created category distribution.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center p-1 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.14)] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'both'
                ? 'bg-[#3478F6] text-white shadow-sm'
                : 'text-[#71839E] hover:text-[#F4F7FF]'
            }`}
          >
            All Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('existing')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'existing'
                ? 'bg-[#3478F6] text-white shadow-sm'
                : 'text-[#71839E] hover:text-[#F4F7FF]'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Existing Folders ({existingFolders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-[#3478F6] text-white shadow-sm'
                : 'text-[#71839E] hover:text-[#F4F7FF]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>AI Suggested / Created ({aiCategories.length})</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-7 h-7 text-[#4B91FF] animate-spin" />
          <p className="text-xs font-medium text-[#A7B7D0]">Loading organization overview...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="py-10 text-center flex flex-col items-center justify-center space-y-3 bg-[#06101F] rounded-xl border border-red-500/20 p-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-[#F4F7FF]">{error}</p>
          <button
            type="button"
            onClick={fetchOverview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E1D35] hover:bg-[#132642] text-[#F4F7FF] text-xs font-semibold border border-[rgba(139,170,215,0.18)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !hasData && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-2 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.14)] p-6">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(52,120,246,0.15)] border border-[rgba(52,120,246,0.3)] flex items-center justify-center text-[#4B91FF] mb-1">
            <FolderSearch className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#F4F7FF]">No organization data available yet.</h3>
          <p className="text-xs text-[#A7B7D0] max-w-sm">
            Analyze scanned folders to view target category and physical folder distribution.
          </p>
        </div>
      )}

      {/* Section A: Existing Physical Folders */}
      {!loading && !error && hasData && (activeTab === 'both' || activeTab === 'existing') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-amber-400" />
              <span>Existing Physical Folders</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Existing on Disk
              </span>
            </h3>
            <span className="text-[11px] text-[#71839E] font-medium">
              {existingFolders.length} root {existingFolders.length === 1 ? 'folder' : 'folders'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {existingFolders.map((folder, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.28)] transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#F4F7FF] block">
                        {folder.name}
                      </span>
                      <span className="text-[10px] text-[#71839E] font-mono block">
                        📁 {folder.displayPath}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                    {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'}
                  </span>
                </div>

                {/* Subfolders list */}
                {folder.subfolders && folder.subfolders.length > 0 && (
                  <div className="pt-2 border-t border-[rgba(139,170,215,0.1)] space-y-1.5">
                    <span className="text-[10px] text-[#71839E] font-bold uppercase tracking-wider block">
                      Subfolders / Locations:
                    </span>
                    <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                      {folder.subfolders.map((sf, sfIdx) => (
                        <div key={sfIdx} className="flex items-center justify-between text-[11px] text-[#A7B7D0] font-mono py-0.5 px-1 rounded hover:bg-[#0E1D35]">
                          <span className="truncate max-w-[180px]" title={sf.displayPath}>
                            ├── {sf.displayPath}
                          </span>
                          <span className="text-[#71839E] text-[10px] font-bold">
                            {sf.fileCount} {sf.fileCount === 1 ? 'file' : 'files'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section B: AI Created / Proposed Categories */}
      {!loading && !error && hasData && (activeTab === 'both' || activeTab === 'ai') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#4B91FF]" />
              <span>AI Created / Proposed Categories</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(52,120,246,0.15)] text-[#4B91FF] border border-[rgba(52,120,246,0.3)]">
                Memora AI
              </span>
            </h3>
            <span className="text-[11px] text-[#71839E] font-medium">
              {aiCategories.length} active {aiCategories.length === 1 ? 'category' : 'categories'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {aiCategories.map((item) => {
              const pct = item.percentage ?? (item.totalFiles ? Math.min(Math.round((item.fileCount / item.totalFiles) * 100), 100) : 0);

              return (
                <div
                  key={item.category}
                  className="p-4 bg-[#06101F] rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.28)] transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#0A1629] border border-[rgba(139,170,215,0.14)]">
                        {getCategoryIcon(item.category)}
                      </div>
                      <span className="text-xs font-bold text-[#F4F7FF]">
                        {item.category}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#4B91FF] bg-[rgba(52,120,246,0.15)] px-2 py-0.5 rounded border border-[rgba(52,120,246,0.3)]">
                      {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-[#0E1D35] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#3478F6] to-[#7566F6] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#71839E] font-mono">
                      <span>Distribution</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
