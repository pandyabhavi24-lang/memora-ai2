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
  Loader2,
  RefreshCw,
  AlertTriangle,
  FolderSearch
} from 'lucide-react';
import { organizationService } from '../../services/organizationService';

export const CategoryOverview = ({ refreshTrigger }) => {
  const [overviewData, setOverviewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationService.getOverview();
      setOverviewData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load category overview from backend API:', err);
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
        return <GraduationCap className="w-4 h-4 text-blue-400" />;
      case 'Projects':
        return <FolderKanban className="w-4 h-4 text-purple-400" />;
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
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md p-6 mb-8 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Organization Overview
            </h2>
            <p className="text-xs text-slate-400">
              Distribution of files across proposed target categories.
            </p>
          </div>
        </div>

        {!loading && !error && overviewData.length > 0 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            {overviewData.length} active {overviewData.length === 1 ? 'category' : 'categories'}
          </span>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          <p className="text-xs font-medium text-slate-400">Loading organization overview...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="py-10 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/40 rounded-xl border border-red-500/20 p-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-300">{error}</p>
          <button
            type="button"
            onClick={fetchOverview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700/80 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && overviewData.length === 0 && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-2 bg-slate-950/30 rounded-xl border border-slate-800/50 p-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-1">
            <FolderSearch className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No organization data available yet.</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Analyze scanned folders to view target category distribution.
          </p>
        </div>
      )}

      {/* Real Category Distribution Grid */}
      {!loading && !error && overviewData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewData.map((item) => {
            const pct = item.percentage ?? (item.totalFiles ? Math.min(Math.round((item.fileCount / item.totalFiles) * 100), 100) : 0);

            return (
              <div
                key={item.category}
                className="p-4 bg-slate-950/70 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                      {getCategoryIcon(item.category)}
                    </div>
                    <span className="text-xs font-bold text-slate-200">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/30">
                    {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
