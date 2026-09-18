import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  HardDrive, 
  Copy, 
  Folder, 
  Sparkles, 
  RefreshCw, 
  HelpCircle, 
  Bell, 
  FolderPlus, 
  FolderTree, 
  BarChart3, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { apiService } from '../services/apiService';
import { organizationService } from '../services/organizationService';
import { HelpModal } from '../components/dashboard/HelpModal';
import { FileDistributionChart } from '../components/dashboard/FileDistributionChart';
import { WorkflowPipeline } from '../components/dashboard/WorkflowPipeline';

// Helper for human-readable byte sizes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const { 
    searchQuery, 
    setSearchQuery, 
    executeSearch, 
    folders, 
    selectFolderNative
  } = useApp();

  // Primary Data States
  const [stats, setStats] = useState({
    folders: 0,
    files: 0,
    chunks: 0,
    vectors: 0,
    searches: 0,
    total_size_bytes: 0,
    recent_files: [],
    recent_searches: []
  });

  const [duplicateCount, setDuplicateCount] = useState(0);
  const [scanStatus, setScanStatus] = useState({
    status: 'idle',
    files_found: 0,
    files_processed: 0,
    files_failed: 0,
    progress_percentage: 100,
    current_file: ''
  });

  const [healthStatus, setHealthStatus] = useState({
    status: 'ok',
    database: true,
    faiss: true,
    embedding_model: true
  });

  const [categories, setCategories] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadAllDashboardData();
  }, []);

  const loadAllDashboardData = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const [
        statsRes,
        overviewRes,
        scanStatusRes,
        duplicatesRes,
        suggestionsRes,
        healthRes
      ] = await Promise.allSettled([
        apiService.getStatistics(),
        organizationService.getOverview(),
        apiService.getScanStatus(),
        organizationService.getDuplicates(),
        organizationService.getSuggestions(),
        apiService.getHealth()
      ]);

      // 1. Statistics
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }

      // 2. Organization Categories / File Distribution
      if (overviewRes.status === 'fulfilled' && overviewRes.value && overviewRes.value.aiCategories) {
        setCategories(overviewRes.value.aiCategories);
      }

      // 3. Scan Status
      if (scanStatusRes.status === 'fulfilled' && scanStatusRes.value) {
        setScanStatus(scanStatusRes.value);
      }

      // 4. Duplicate Files Count
      if (duplicatesRes.status === 'fulfilled' && Array.isArray(duplicatesRes.value)) {
        setDuplicateCount(duplicatesRes.value.length);
      }

      // 5. Suggestions
      if (suggestionsRes.status === 'fulfilled' && Array.isArray(suggestionsRes.value)) {
        setSuggestions(suggestionsRes.value);
      }

      // 6. System Health Check
      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealthStatus(healthRes.value);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      executeSearch(searchQuery);
      navigate('/results');
    }
  };

  // Full Page Error State
  if (hasError) {
    return (
      <div className="glass-panel p-8 rounded-3xl border-red-500/30 text-center space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Engine Connection Error</h2>
        <p className="text-xs text-gray-400">
          Memora could not connect to the local FastAPI backend. Verify backend service status.
        </p>
        <Button variant="primary" size="md" onClick={loadAllDashboardData} className="mx-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    );
  }

  // Calculate real system operational status
  const systemOperationalLabel = healthStatus.status === 'ok' 
    ? 'Ready' 
    : (healthStatus.status === 'degraded' ? 'Needs Attention' : 'Unavailable');

  const systemOperationalColor = healthStatus.status === 'ok'
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : (healthStatus.status === 'degraded' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10');

  return (
    <div className="flex flex-col justify-between h-[calc(100vh-4.5rem)] overflow-y-auto lg:overflow-hidden p-0.5 space-y-2.5 w-full mx-auto select-none">
      
      {/* ==========================================================
          A. TOP HEADER (BALANCED ALIGNMENT)
      ========================================================== */}
      <div className="glass-panel px-4 py-2.5 rounded-2xl border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-md shadow-black/20 relative z-[60]">
        
        {/* Title & Short Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-none">
              Dashboard
            </h1>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Your files, organized.
            </p>
          </div>
        </div>

        {/* Center Compact Search Bar */}
        <form onSubmit={handleHeaderSearchSubmit} className="relative flex-1 max-w-md mx-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-16 py-1.5 text-xs rounded-xl glass-input text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500 border-slate-800"
            aria-label="Search files..."
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all cursor-pointer shadow-sm"
          >
            Search
          </button>
        </form>

        {/* Right Side Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Rescan Button */}
          <button
            type="button"
            onClick={() => navigate('/scan')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Rescan Folders — Trigger automated file scan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanStatus.status === 'scanning' ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>

          {/* Help Trigger */}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
            title="Help & Support Modal"
            aria-label="Help & Support Modal"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </button>

          {/* Notification Bell */}
          <div className="relative z-[60]">
            <button
              type="button"
              onClick={() => setShowNotifications(prev => !prev)}
              className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer relative"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-400" />
              {duplicateCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-72 p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs shadow-2xl shadow-black/90 z-[100] backdrop-blur-2xl ring-1 ring-white/10 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-bold text-xs">
                  <span className="text-slate-200">System Notifications</span>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-white text-[11px] font-mono"
                  >
                    &times; Close
                  </button>
                </div>
                {duplicateCount > 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1.5">
                    <p className="font-semibold text-xs text-amber-200">{duplicateCount} Duplicate File Group{duplicateCount === 1 ? '' : 's'} Detected</p>
                    <p className="text-[10px] text-slate-300 leading-snug">AI identified copies that can be organized or cleaned up.</p>
                    <button 
                      onClick={() => { setShowNotifications(false); navigate('/organize'); }}
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline text-[11px] font-bold mt-1"
                    >
                      Review in Organization &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="p-3 text-center text-slate-400 text-xs">
                    <p className="font-semibold text-slate-300">All quiet</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">No active alerts or warnings.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================================
          B. STATISTIC CARDS (LARGER 15% READABLE NUMBERS)
      ========================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
        
        {/* Stat 1: Total Files */}
        <div 
          className="glass-panel p-3.5 rounded-xl border-slate-800 hover:border-blue-500/40 hover:bg-slate-900/80 transition-all duration-200 group relative cursor-pointer overflow-hidden shadow-md shadow-black/20"
          onMouseEnter={() => setActiveTooltip('stat-files')}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={() => navigate('/folders')}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Files</span>
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-[1.65rem] font-black text-white font-mono leading-tight tracking-tight">
            {stats.files !== undefined ? stats.files : '—'}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">Total indexed files</p>

          {activeTooltip === 'stat-files' && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 p-2 rounded-lg bg-slate-950/95 border border-slate-700 text-white text-[11px] shadow-xl z-50 pointer-events-none">
              <span className="font-bold text-blue-400">Files</span> — Total indexed documents & media.
            </div>
          )}
        </div>

        {/* Stat 2: Storage Used */}
        <div 
          className="glass-panel p-3.5 rounded-xl border-slate-800 hover:border-purple-500/40 hover:bg-slate-900/80 transition-all duration-200 group relative cursor-pointer overflow-hidden shadow-md shadow-black/20"
          onMouseEnter={() => setActiveTooltip('stat-storage')}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={() => navigate('/folders')}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Storage</span>
            <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-[1.65rem] font-black text-white font-mono leading-tight tracking-tight">
            {stats.total_size_bytes ? formatBytes(stats.total_size_bytes) : '—'}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">Total storage used</p>

          {activeTooltip === 'stat-storage' && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 p-2 rounded-lg bg-slate-950/95 border border-slate-700 text-white text-[11px] shadow-xl z-50 pointer-events-none">
              <span className="font-bold text-purple-400">Storage</span> — Total disk space of scanned files.
            </div>
          )}
        </div>

        {/* Stat 3: Duplicate Groups */}
        <div 
          className="glass-panel p-3.5 rounded-xl border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/80 transition-all duration-200 group relative cursor-pointer overflow-hidden shadow-md shadow-black/20"
          onMouseEnter={() => setActiveTooltip('stat-duplicates')}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={() => navigate('/organize')}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Duplicates</span>
            <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <Copy className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-[1.65rem] font-black text-white font-mono leading-tight tracking-tight">
            {duplicateCount !== undefined ? duplicateCount : '—'}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">Potential duplicate groups</p>

          {activeTooltip === 'stat-duplicates' && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 p-2 rounded-lg bg-slate-950/95 border border-slate-700 text-white text-[11px] shadow-xl z-50 pointer-events-none">
              <span className="font-bold text-amber-400">Duplicates</span> — Groups of duplicate files detected by AI.
            </div>
          )}
        </div>

        {/* Stat 4: Monitored Folders */}
        <div 
          className="glass-panel p-3.5 rounded-xl border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-200 group relative cursor-pointer overflow-hidden shadow-md shadow-black/20"
          onMouseEnter={() => setActiveTooltip('stat-folders')}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={() => navigate('/folders')}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Folders</span>
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <Folder className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-[1.65rem] font-black text-white font-mono leading-tight tracking-tight">
            {stats.folders !== undefined ? stats.folders : folders.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">Monitored folders</p>

          {activeTooltip === 'stat-folders' && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 p-2 rounded-lg bg-slate-950/95 border border-slate-700 text-white text-[11px] shadow-xl z-50 pointer-events-none">
              <span className="font-bold text-emerald-400">Folders</span> — Directories registered for automated indexing.
            </div>
          )}
        </div>
      </div>

      {/* ==========================================================
          C. MEMORA AI WORKFLOW / STATUS SECTION
      ========================================================== */}
      <div className="shrink-0">
        <WorkflowPipeline 
          folderCount={stats.folders || folders.length}
          fileCount={stats.files}
          suggestionCount={suggestions.length}
          isScanning={scanStatus.status === 'scanning'}
        />
      </div>

      {/* ==========================================================
          D & E. MAIN DASHBOARD GRID (PIE CHART, QUICK ACTIONS, SYSTEM STATUS)
      ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-[210px]">
        
        {/* File Overview Donut Chart (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <FileDistributionChart 
            categories={categories} 
            isLoading={isLoading} 
            hasError={hasError}
            onRetry={loadAllDashboardData}
          />
        </div>

        {/* Quick Actions (4 Cols) */}
        <div className="lg:col-span-4 glass-panel p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-lg shadow-black/20">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Quick Actions</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Fast Navigation</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Action 1: Search */}
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-blue-600/20 text-slate-200 border border-slate-800 hover:border-blue-500/40 text-left transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
                title="Search Files — Natural language search query"
              >
                <Search className="w-4 h-4 text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-white">Search</div>
                  <div className="text-[10px] text-slate-400">Semantic search</div>
                </div>
              </button>

              {/* Action 2: Organize */}
              <button
                type="button"
                onClick={() => navigate('/organize')}
                className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-amber-600/20 text-slate-200 border border-slate-800 hover:border-amber-500/40 text-left transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
                title="Organize Files — Smart organization suggestions"
              >
                <FolderTree className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-white">Organize</div>
                  <div className="text-[10px] text-slate-400">Smart taxonomy</div>
                </div>
              </button>

              {/* Action 3: Media */}
              <button
                type="button"
                onClick={() => navigate('/media')}
                className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-emerald-600/20 text-slate-200 border border-slate-800 hover:border-emerald-500/40 text-left transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
                title="Media Intelligence — File content and intelligence processing"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-white">Media</div>
                  <div className="text-[10px] text-slate-400">OCR & Visual</div>
                </div>
              </button>

              {/* Action 4: PDF Studio */}
              <button
                type="button"
                onClick={() => navigate('/pdf-studio')}
                className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-purple-600/20 text-slate-200 border border-slate-800 hover:border-purple-500/40 text-left transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
                title="PDF Studio — Document tools & page editing"
              >
                <FileText className="w-4 h-4 text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-white">PDF Studio</div>
                  <div className="text-[10px] text-slate-400">Document tools</div>
                </div>
              </button>
            </div>
          </div>

          {/* Add Folder Button */}
          <button
            type="button"
            onClick={selectFolderNative}
            className="w-full mt-2 p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>Add New Directory</span>
          </button>
        </div>

        {/* System Status (3 Cols) */}
        <div className="lg:col-span-3 glass-panel p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-lg shadow-black/20">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>System Status</span>
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${systemOperationalColor}`}>
                {systemOperationalLabel}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              {/* Search Engine Status */}
              <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Search Engine</span>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Ready
                </span>
              </div>

              {/* Indexed Files Count */}
              <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Indexed Files</span>
                <span className="text-xs sm:text-[13px] font-mono font-black text-white">
                  {stats.files}
                </span>
              </div>

              {/* Monitored Folders */}
              <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Monitored Folders</span>
                <span className="text-xs sm:text-[13px] font-mono font-black text-blue-400">
                  {stats.folders || folders.length}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy Footnote */}
          <div className="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-[10px] text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>Local & Private — 100% offline</span>
          </div>
        </div>

      </div>

      {/* Help Modal */}
      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
};
