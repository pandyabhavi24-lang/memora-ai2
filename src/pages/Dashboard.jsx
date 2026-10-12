import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  CheckCircle2,
  CalendarClock,
  Clock,
  ExternalLink,
  FolderOpen,
  Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDataCache } from '../context/DataCacheContext';
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

// Helper for human-readable days remaining
function getDaysRemainingText(dateStr) {
  if (!dateStr) return '';
  const target = new Date(dateStr);
  const now = new Date();
  const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((targetDateOnly - nowDateOnly) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays > 1) return `in ${diffDays} days`;
  if (diffDays === -1) return 'Expired yesterday';
  return `${Math.abs(diffDays)} days ago`;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const { 
    folders, 
    selectFolderNative,
    recentlyOpenedFiles,
    recordOpenedFile
  } = useApp();
  const { dashboardData, fetchDashboardData } = useDataCache();

  // Primary Data States (initialized from cache for instant zero-spinner render)
  const [stats, setStats] = useState(dashboardData.stats);
  const [duplicateCount, setDuplicateCount] = useState(dashboardData.duplicateCount);
  const [scanStatus, setScanStatus] = useState(dashboardData.scanStatus);
  const [healthStatus, setHealthStatus] = useState(dashboardData.healthStatus);
  const [categories, setCategories] = useState(dashboardData.categories);
  const [suggestions, setSuggestions] = useState([]);

  // Expiry State
  const [expirySummary, setExpirySummary] = useState(dashboardData.expirySummary);
  const [nextExpiry, setNextExpiry] = useState(dashboardData.nextExpiry);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(!dashboardData.isLoaded);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(dashboardData.hasError && !dashboardData.isLoaded);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellButtonRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, right: 16 });

  const updatePopoverPosition = () => {
    if (!bellButtonRef.current) return;
    const rect = bellButtonRef.current.getBoundingClientRect();
    const right = Math.max(16, window.innerWidth - rect.right);
    const top = rect.bottom + 8;
    setPopoverCoords({ top, right });
  };

  useEffect(() => {
    if (!showNotifications) return;

    updatePopoverPosition();

    const handleClickOutside = (event) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    const handleWindowChange = () => {
      updatePopoverPosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [showNotifications]);

  // Sync state with shared cache whenever cache updates
  useEffect(() => {
    if (dashboardData.isLoaded) {
      setStats(dashboardData.stats);
      setCategories(dashboardData.categories);
      setDuplicateCount(dashboardData.duplicateCount);
      setScanStatus(dashboardData.scanStatus);
      setHealthStatus(dashboardData.healthStatus);
      setExpirySummary(dashboardData.expirySummary);
      setNextExpiry(dashboardData.nextExpiry);
      setIsLoading(false);
      setHasError(false);
    }
  }, [dashboardData]);

  const loadAllDashboardData = async (force = false) => {
    const isFirstVisit = !dashboardData.isLoaded;
    if (isFirstVisit) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      await fetchDashboardData({ forceRefresh: force });
      setHasError(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      // Only show full blocking error if we had no cached data at all
      if (isFirstVisit) {
        setHasError(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllDashboardData(false);
  }, []);

  const handleOpenRecentFile = (fileItem) => {
    if (fileItem && fileItem.path) {
      apiService.openFile(fileItem.path);
      recordOpenedFile(fileItem);
    }
  };

  const handleLocateRecentFile = (fileItem) => {
    if (fileItem && fileItem.path) {
      apiService.locateFile(fileItem.path);
    }
  };

  // Full Page Error State — ONLY when no usable cached data is available
  if (hasError && !dashboardData.isLoaded) {
    return (
      <div className="glass-panel p-8 rounded-2xl border-red-500/30 bg-[#0A1629] text-center space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#F4F7FF]">Engine Connection Error</h2>
        <p className="text-xs text-[#A7B7D0]">
          Memora could not connect to the local FastAPI backend. Verify that the backend service is running.
        </p>
        <Button variant="primary" size="md" onClick={loadAllDashboardData} className="mx-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    );
  }

  const systemOperationalLabel = healthStatus.status === 'ok' 
    ? 'Ready' 
    : (healthStatus.status === 'degraded' ? 'Needs Attention' : 'Offline');

  const systemOperationalColor = healthStatus.status === 'ok'
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : (healthStatus.status === 'degraded' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10');

  // Combined recent files (local app history or backend stats recent files)
  const combinedRecentFiles = (recentlyOpenedFiles && recentlyOpenedFiles.length > 0)
    ? recentlyOpenedFiles.slice(0, 4)
    : (stats.recent_files || []).slice(0, 4);

  const totalNotificationAlerts = 
    (duplicateCount > 0 ? 1 : 0) +
    ((expirySummary.due_soon > 0 || expirySummary.expired > 0) ? 1 : 0) +
    (scanStatus.status === 'scanning' ? 1 : 0);

  return (
    <div className="space-y-2 sm:space-y-2.5 pb-2 w-full mx-auto select-none">
      
      {/* 1. Welcome & Status Header (Compact, 44px) */}
      <div className="glass-panel px-3.5 py-2 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        
        {/* Title & Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#3478F6] to-[#7566F6] flex items-center justify-center text-white shadow-xs shrink-0 border border-[#4B91FF]/30">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#F4F7FF] tracking-tight truncate">
                Intelligent Digital Memory
              </h1>
              <span className={`text-[9px] font-semibold px-2 py-0.2 rounded-full border shrink-0 ${systemOperationalColor}`}>
                {systemOperationalLabel}
              </span>
            </div>
            <p className="text-[10px] text-[#A7B7D0] font-normal truncate hidden sm:block">
              Local knowledge base and semantic workspace overview
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/scan')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3478F6]/15 hover:bg-[#3478F6]/25 border border-[#3478F6]/30 text-[#4B91FF] text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Rescan Folders — Trigger local file scan"
          >
            <RefreshCw className={`w-3 h-3 ${scanStatus.status === 'scanning' ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] text-[#A7B7D0] hover:text-[#F4F7FF] border border-[rgba(139,170,215,0.14)] transition-all cursor-pointer"
            title="Help & Shortcuts"
            aria-label="Help & Shortcuts"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Anchored Notification Bell */}
          <div className="relative">
            <button
              ref={bellButtonRef}
              type="button"
              onClick={() => {
                setShowNotifications(prev => {
                  const next = !prev;
                  if (next) updatePopoverPosition();
                  return next;
                });
              }}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer relative ${
                showNotifications 
                  ? 'bg-[#132642] text-[#F4F7FF] border-[#3478F6]/50 shadow-xs' 
                  : 'bg-[#0E1D35] hover:bg-[#132642] text-[#A7B7D0] hover:text-[#F4F7FF] border-[rgba(139,170,215,0.14)]'
              }`}
              title="Notifications & System Alerts"
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <Bell className="w-3.5 h-3.5" />
              {totalNotificationAlerts > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black flex items-center justify-center border border-[#06101F]">
                  {totalNotificationAlerts}
                </span>
              )}
            </button>

            {/* Portal-rendered Notification Popover attached to document.body */}
            {showNotifications && createPortal(
              <div 
                ref={popoverRef}
                style={{
                  position: 'fixed',
                  top: `${popoverCoords.top}px`,
                  right: `${popoverCoords.right}px`,
                  zIndex: 99999,
                  maxWidth: 'calc(100vw - 32px)'
                }}
                className="w-80 sm:w-92 p-3.5 rounded-2xl bg-[#0A1629] border border-[rgba(139,170,215,0.25)] text-[#F4F7FF] text-xs shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none ring-1 ring-black/50"
                role="region"
                aria-label="Activity Alerts"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#3478F6]/20 border border-[#3478F6]/30 flex items-center justify-center text-[#4B91FF]">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#F4F7FF]">Activity Alerts</span>
                      <span className="text-[10px] text-[#71839E] ml-1.5 font-normal">Real-time status</span>
                    </div>
                    {totalNotificationAlerts > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {totalNotificationAlerts}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-[#A7B7D0] hover:text-[#F4F7FF] hover:bg-[#0E1D35] px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors border border-transparent hover:border-[rgba(139,170,215,0.14)]"
                  >
                    Close <span className="text-[9px] opacity-60 ml-0.5">(Esc)</span>
                  </button>
                </div>

                {/* Popover Notifications Body */}
                <div className="max-h-76 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
                  {duplicateCount > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-amber-200">Duplicates Detected</span>
                        <span className="text-[10px] font-mono font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {duplicateCount} groups
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A7B7D0] leading-snug">
                        Identical or high-similarity files identified in your local folders.
                      </p>
                      <button 
                        onClick={() => { setShowNotifications(false); navigate('/organize'); }}
                        className="inline-flex items-center gap-1 text-[#4B91FF] hover:underline text-[11px] font-bold pt-0.5 cursor-pointer"
                      >
                        Review in Organization &rarr;
                      </button>
                    </div>
                  )}

                  {(expirySummary.due_soon > 0 || expirySummary.expired > 0) && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-red-200">Document Expiries</span>
                        <span className="text-[10px] font-mono font-semibold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-500/20">
                          {expirySummary.expired > 0 ? `${expirySummary.expired} expired` : `${expirySummary.due_soon} due soon`}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A7B7D0] leading-snug">
                        Important certificates, contracts, or IDs require attention.
                      </p>
                      <button 
                        onClick={() => { setShowNotifications(false); navigate('/expiry'); }}
                        className="inline-flex items-center gap-1 text-[#4B91FF] hover:underline text-[11px] font-bold pt-0.5 cursor-pointer"
                      >
                        Open Expiry & Reminders &rarr;
                      </button>
                    </div>
                  )}

                  {scanStatus.status === 'scanning' && (
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 text-[#4B91FF] animate-spin" />
                          <span className="font-bold text-xs text-blue-200">Ingestion Active</span>
                        </div>
                        <span className="text-[10px] font-mono text-blue-400">
                          {scanStatus.progress_percentage || 0}%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A7B7D0] leading-snug truncate" title={scanStatus.current_file}>
                        {scanStatus.current_file || 'Scanning documents & media...'}
                      </p>
                    </div>
                  )}

                  {totalNotificationAlerts === 0 && (
                    <div className="py-6 text-center text-[#71839E] text-xs space-y-1.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-[#A7B7D0]">All Systems Optimal</p>
                      <p className="text-[10px] text-[#71839E]">No active warnings, duplicate alerts, or expired files.</p>
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Statistics Grid (5 Compact KPI Cards Strip) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
        
        {/* Stat 1: Total Files */}
        <div 
          className="glass-panel p-2.5 rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-[#3478F6]/40 bg-[#0A1629] hover:bg-[#0E1D35] transition-all duration-150 group cursor-pointer shadow-xs"
          onClick={() => navigate('/folders')}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71839E]">Indexed Files</span>
            <div className="p-1 rounded-md bg-[#3478F6]/10 text-[#4B91FF] group-hover:scale-105 transition-transform">
              <FileText className="w-3 h-3" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#F4F7FF] font-mono tracking-tight leading-tight">
            {stats.files !== undefined ? stats.files : '—'}
          </div>
          <p className="text-[9px] text-[#A7B7D0] font-medium truncate">Documents & media</p>
        </div>

        {/* Stat 2: Storage Used */}
        <div 
          className="glass-panel p-2.5 rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-purple-500/40 bg-[#0A1629] hover:bg-[#0E1D35] transition-all duration-150 group cursor-pointer shadow-xs"
          onClick={() => navigate('/storage-optimization')}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71839E]">Storage Size</span>
            <div className="p-1 rounded-md bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <HardDrive className="w-3 h-3" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#F4F7FF] font-mono tracking-tight leading-tight">
            {stats.total_size_bytes ? formatBytes(stats.total_size_bytes) : '—'}
          </div>
          <p className="text-[9px] text-[#A7B7D0] font-medium truncate">Scanned local space</p>
        </div>

        {/* Stat 3: Monitored Folders */}
        <div 
          className="glass-panel p-2.5 rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-emerald-500/40 bg-[#0A1629] hover:bg-[#0E1D35] transition-all duration-150 group cursor-pointer shadow-xs"
          onClick={() => navigate('/folders')}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71839E]">Folders</span>
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <Folder className="w-3 h-3" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#F4F7FF] font-mono tracking-tight leading-tight">
            {stats.folders !== undefined ? stats.folders : folders.length}
          </div>
          <p className="text-[9px] text-[#A7B7D0] font-medium truncate">Monitored roots</p>
        </div>

        {/* Stat 4: Chunks / Vectors */}
        <div 
          className="glass-panel p-2.5 rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-cyan-500/40 bg-[#0A1629] hover:bg-[#0E1D35] transition-all duration-150 group cursor-pointer shadow-xs"
          onClick={() => navigate('/search')}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71839E]">Vector Chunks</span>
            <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
              <Layers className="w-3 h-3" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#F4F7FF] font-mono tracking-tight leading-tight">
            {stats.chunks || stats.vectors || stats.files * 2 || 0}
          </div>
          <p className="text-[9px] text-[#A7B7D0] font-medium truncate">FAISS index vectors</p>
        </div>

        {/* Stat 5: Duplicate Groups */}
        <div 
          className="glass-panel p-2.5 rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-amber-500/40 bg-[#0A1629] hover:bg-[#0E1D35] transition-all duration-150 group cursor-pointer shadow-xs col-span-2 sm:col-span-1"
          onClick={() => navigate('/organize')}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71839E]">Duplicates</span>
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Copy className="w-3 h-3" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#F4F7FF] font-mono tracking-tight leading-tight">
            {duplicateCount !== undefined ? duplicateCount : '—'}
          </div>
          <p className="text-[9px] text-[#A7B7D0] font-medium truncate">Detected clusters</p>
        </div>
      </div>

      {/* 3. Workflow Pipeline Stepper (Compact Sleek Bar) */}
      <WorkflowPipeline 
        folderCount={stats.folders || folders.length}
        fileCount={stats.files}
        suggestionCount={suggestions.length}
        isScanning={scanStatus.status === 'scanning'}
      />

      {/* 4. Core Intelligence Workspace (Middle: Categories & Expiry side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5">
        
        {/* Left Column (7 cols): File Overview Donut Chart */}
        <div className="lg:col-span-7 h-52 sm:h-56">
          <FileDistributionChart 
            categories={categories} 
            isLoading={isLoading} 
            hasError={hasError}
            onRetry={loadAllDashboardData}
          />
        </div>

        {/* Right Column (5 cols): Expiry Alerts Card */}
        <div className="lg:col-span-5 h-52 sm:h-56">
          <div 
            onClick={() => navigate('/expiry')}
            className="glass-panel p-3 rounded-xl border border-[rgba(139,170,215,0.14)] hover:border-[#3478F6]/40 bg-[#0A1629] hover:bg-[#0E1D35] transition-all duration-150 cursor-pointer shadow-xs relative overflow-hidden group h-full flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-1.5 mb-2">
                <h3 className="font-bold text-[11px] text-[#F4F7FF] uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-[#4B91FF] group-hover:scale-105 transition-transform" />
                  <span>Expiry & Renewal Alerts</span>
                </h3>
                <span className="text-[10px] text-[#4B91FF] font-semibold group-hover:underline">
                  View &rarr;
                </span>
              </div>

              {/* Metric Counts Grid */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="p-1.5 rounded-lg bg-[#06101F] border border-[rgba(139,170,215,0.14)] text-center">
                  <div className="text-[9px] text-[#71839E] font-semibold uppercase">Upcoming</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-0.5 leading-none">{expirySummary.upcoming}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-[#06101F] border border-[rgba(139,170,215,0.14)] text-center">
                  <div className="text-[9px] text-[#71839E] font-semibold uppercase">Due Soon</div>
                  <div className="text-sm font-black text-amber-400 font-mono mt-0.5 leading-none">{expirySummary.due_soon}</div>
                </div>
                <div className="p-1.5 rounded-lg bg-[#06101F] border border-[rgba(139,170,215,0.14)] text-center">
                  <div className="text-[9px] text-[#71839E] font-semibold uppercase">Expired</div>
                  <div className="text-sm font-black text-red-400 font-mono mt-0.5 leading-none">{expirySummary.expired}</div>
                </div>
              </div>

              {/* Next Expiry Highlight */}
              <div className="p-2 rounded-lg bg-[#06101F] border border-[rgba(139,170,215,0.14)] space-y-1">
                <div className="flex items-center justify-between text-[9px] font-semibold text-[#71839E]">
                  <span>NEXT UPCOMING EXPIRY</span>
                  {nextExpiry && (
                    <span className="text-[#4B91FF] font-mono">{nextExpiry.date_type}</span>
                  )}
                </div>

                {nextExpiry ? (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#F4F7FF] truncate max-w-[170px]" title={nextExpiry.file_name}>
                        {nextExpiry.file_name}
                      </div>
                      <div className="text-[10px] text-[#71839E] font-mono">
                        {new Date(nextExpiry.extracted_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                      nextExpiry.status === 'due_soon'
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : (nextExpiry.status === 'expired'
                            ? 'text-red-400 bg-red-500/10 border-red-500/30'
                            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30')
                    }`}>
                      {getDaysRemainingText(nextExpiry.extracted_date)}
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-[#71839E] italic py-0.5">No upcoming document expiries detected.</p>
                )}
              </div>
            </div>

            <div className="text-[9px] text-[#71839E] flex items-center justify-between pt-1 border-t border-[rgba(139,170,215,0.12)]">
              <span>Tracked Records: {expirySummary.total_tracked}</span>
              {expirySummary.needs_review > 0 && (
                <span className="text-purple-400 font-semibold">{expirySummary.needs_review} Needs Review</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 5. Lower Section: Recent Files & Module Shortcuts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5">
        
        {/* Left Column (7 cols): Recent Files */}
        <div className="lg:col-span-7 h-48 sm:h-52">
          <div className="glass-panel p-3 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] h-full flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-1.5 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#4B91FF]" />
                  <h3 className="text-[11px] font-bold text-[#F4F7FF] uppercase tracking-wider">
                    Recent Files & Documents
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="text-[10px] text-[#4B91FF] hover:underline font-semibold cursor-pointer"
                >
                  Browse All &rarr;
                </button>
              </div>

              {combinedRecentFiles.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#71839E]">
                  No recently accessed files. Search or open a document to view history here.
                </div>
              ) : (
                <div className="divide-y divide-[rgba(139,170,215,0.08)]">
                  {combinedRecentFiles.map((file, idx) => {
                    const fileName = file.name || file.filename || (file.path ? file.path.split(/[/\\]/).pop() : `File ${idx + 1}`);
                    const filePath = file.path || '';
                    return (
                      <div 
                        key={file.id || idx}
                        className="py-1 flex items-center justify-between gap-2.5 hover:bg-[#0E1D35]/80 px-1.5 rounded-lg transition-colors group"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#71839E] shrink-0 group-hover:text-[#4B91FF] transition-colors" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#F4F7FF] truncate max-w-[280px]" title={fileName}>
                              {fileName}
                            </p>
                            <p className="text-[9px] text-[#71839E] font-mono truncate max-w-[280px]" title={filePath}>
                              {filePath}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {filePath && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLocateRecentFile(file)}
                                className="p-1 rounded text-[#71839E] hover:text-[#F4F7FF] hover:bg-[#132642] transition-colors cursor-pointer"
                                title="Locate in folder"
                              >
                                <FolderOpen className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRecentFile(file)}
                                className="p-1 rounded text-[#71839E] hover:text-[#4B91FF] hover:bg-[#132642] transition-colors cursor-pointer"
                                title="Open file"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Module Shortcuts */}
        <div className="lg:col-span-5 h-48 sm:h-52">
          <div className="glass-panel p-3 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] h-full flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] pb-1 mb-1.5">
                <h3 className="font-bold text-[11px] text-[#F4F7FF] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#4B91FF]" />
                  <span>Module Shortcuts</span>
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-[#3478F6]/40 text-left transition-all cursor-pointer group"
                >
                  <Search className="w-3 h-3 text-[#4B91FF] mb-0.5 group-hover:scale-105 transition-transform" />
                  <div className="font-bold text-[11px] text-[#F4F7FF] truncate">Search</div>
                  <div className="text-[8px] text-[#71839E] truncate">Semantic query</div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/organize')}
                  className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-amber-500/40 text-left transition-all cursor-pointer group"
                >
                  <FolderTree className="w-3 h-3 text-amber-400 mb-0.5 group-hover:scale-105 transition-transform" />
                  <div className="font-bold text-[11px] text-[#F4F7FF] truncate">Organize</div>
                  <div className="text-[8px] text-[#71839E] truncate">Tags & duplicates</div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/media')}
                  className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-emerald-500/40 text-left transition-all cursor-pointer group"
                >
                  <BarChart3 className="w-3 h-3 text-emerald-400 mb-0.5 group-hover:scale-105 transition-transform" />
                  <div className="font-bold text-[11px] text-[#F4F7FF] truncate">Media Intel</div>
                  <div className="text-[8px] text-[#71839E] truncate">OCR & vision</div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/pdf-studio')}
                  className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-indigo-500/40 text-left transition-all cursor-pointer group"
                >
                  <FileText className="w-3 h-3 text-indigo-400 mb-0.5 group-hover:scale-105 transition-transform" />
                  <div className="font-bold text-[11px] text-[#F4F7FF] truncate">PDF Studio</div>
                  <div className="text-[8px] text-[#71839E] truncate">Edit & convert</div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/storage-optimization')}
                  className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-purple-500/40 text-left transition-all cursor-pointer group"
                >
                  <HardDrive className="w-3 h-3 text-purple-400 mb-0.5 group-hover:scale-105 transition-transform" />
                  <div className="font-bold text-[11px] text-[#F4F7FF] truncate">Storage Opt</div>
                  <div className="text-[8px] text-[#71839E] truncate">Compress space</div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/expiry')}
                  className="p-1.5 rounded-lg bg-[#0E1D35] hover:bg-[#132642] border border-[rgba(139,170,215,0.14)] hover:border-cyan-500/40 text-left transition-all cursor-pointer group"
                >
                  <CalendarClock className="w-3 h-3 text-cyan-400 mb-0.5 group-hover:scale-105 transition-transform" />
                  <div className="font-bold text-[11px] text-[#F4F7FF] truncate">Expiry</div>
                  <div className="text-[8px] text-[#71839E] truncate">Reminders</div>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={selectFolderNative}
              className="w-full mt-1.5 py-1.5 px-2 rounded-lg bg-[#3478F6]/10 hover:bg-[#3478F6]/20 border border-[#3478F6]/30 text-[#4B91FF] text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Local Folder to Index</span>
            </button>
          </div>
        </div>

      </div>

      {/* 6. System Status Footer Bar (Ultra Sleek 28px) */}
      <div className="glass-panel px-3 py-1.5 rounded-xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-[10px] text-[#F4F7FF] uppercase tracking-wider">
              System Telemetry
            </span>
          </div>
          <span className={`text-[9px] font-semibold px-2 py-0.2 rounded-full border ${systemOperationalColor}`}>
            {systemOperationalLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
          <div className="px-2 py-0.5 rounded-lg bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] flex items-center gap-1.5 text-[10px]">
            <span className="text-[#A7B7D0]">Engine:</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          </div>

          <div className="px-2 py-0.5 rounded-lg bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] flex items-center gap-1.5 text-[10px]">
            <span className="text-[#A7B7D0]">Indexed:</span>
            <span className="font-mono font-bold text-[#F4F7FF]">{stats.files}</span>
          </div>

          <div className="px-2 py-0.5 rounded-lg bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] flex items-center gap-1.5 text-[10px]">
            <span className="text-[#A7B7D0]">Folders:</span>
            <span className="font-mono font-bold text-[#4B91FF]">{stats.folders || folders.length}</span>
          </div>
        </div>

        <div className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>100% Local &bull; Offline Privacy</span>
        </div>
      </div>

      {/* Help & Shortcuts Modal */}
      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
};
