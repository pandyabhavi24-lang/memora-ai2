import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarClock, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  ExternalLink, 
  Edit3, 
  Bell, 
  BellOff, 
  Check, 
  Trash2, 
  X, 
  ShieldAlert, 
  Sparkles,
  Calendar,
  FileCheck,
  ChevronDown
} from 'lucide-react';
import { apiService } from '../services/apiService';

export const FileExpiry = () => {
  const [expiries, setExpiries] = useState([]);
  const [summary, setSummary] = useState({
    total_tracked: 0,
    upcoming: 0,
    due_soon: 0,
    expired: 0,
    needs_review: 0
  });
  const [ollamaStatus, setOllamaStatus] = useState({ available: false, model: '', base_url: '' });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [dateTypeFilter, setDateTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_asc');

  // Detail / Edit Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    document_type: '',
    date_type: '',
    extracted_date: '',
    reminder_enabled: true,
    reminder_days_before: 30,
    user_confirmed: false
  });
  const [modalSaving, setModalSaving] = useState(false);

  // Load Expiries & Summary
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [recordsData, summaryData, ollamaData] = await Promise.all([
        apiService.getExpiries({
          status: statusFilter,
          document_type: docTypeFilter,
          date_type: dateTypeFilter,
          search: searchQuery,
          sort_by: sortBy
        }),
        apiService.getExpirySummary(),
        apiService.getOllamaExpiryStatus()
      ]);
      setExpiries(recordsData || []);
      setSummary(summaryData || { total_tracked: 0, upcoming: 0, due_soon: 0, expired: 0, needs_review: 0 });
      setOllamaStatus(ollamaData || { available: false, model: '', base_url: '' });
    } catch (err) {
      console.error('Failed to fetch expiry records:', err);
      setError('Could not load expiry records. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, docTypeFilter, dateTypeFilter, sortBy]);

  // Debounced Search Trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Scan Action
  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const res = await apiService.scanExpiries();
      await fetchData();
    } catch (err) {
      console.error('Scanning failed:', err);
      setError('Document scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  // Quick Date Confirmation
  const handleConfirmDate = async (e, recordId) => {
    e.stopPropagation();
    try {
      await apiService.confirmExpiryDate(recordId);
      await fetchData();
    } catch (err) {
      console.error('Failed to confirm date:', err);
    }
  };

  // Quick Reminder Toggle
  const handleToggleReminder = async (e, record) => {
    e.stopPropagation();
    try {
      await apiService.updateExpiryRecord(record.id, {
        reminder_enabled: !record.reminder_enabled
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
    }
  };

  // Open Edit Modal
  const openEditModal = (record) => {
    setSelectedRecord(record);
    const dateFormatted = record.extracted_date ? new Date(record.extracted_date).toISOString().split('T')[0] : '';
    setEditForm({
      document_type: record.document_type || 'Other',
      date_type: record.date_type || 'Expiry',
      extracted_date: dateFormatted,
      reminder_enabled: record.reminder_enabled ?? true,
      reminder_days_before: record.reminder_days_before || 30,
      user_confirmed: record.user_confirmed || false
    });
    setIsModalOpen(true);
  };

  // Save Modal Form
  const handleSaveModal = async () => {
    if (!selectedRecord) return;
    try {
      setModalSaving(true);
      await apiService.updateExpiryRecord(selectedRecord.id, editForm);
      setIsModalOpen(false);
      setSelectedRecord(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to save expiry record:', err);
      alert('Failed to save changes. Please check date format.');
    } finally {
      setModalSaving(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async () => {
    if (!selectedRecord) return;
    if (!window.confirm('Are you sure you want to remove expiry tracking for this document? The original file will not be deleted.')) return;
    try {
      setModalSaving(true);
      await apiService.deleteExpiryRecord(selectedRecord.id);
      setIsModalOpen(false);
      setSelectedRecord(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete expiry record:', err);
    } finally {
      setModalSaving(false);
    }
  };

  // Re-analyze specific record using Ollama AI
  const handleReanalyzeRecord = async (e, recordId) => {
    if (e) e.stopPropagation();
    try {
      setModalSaving(true);
      const updated = await apiService.reanalyzeExpiryRecord(recordId);
      if (updated && isModalOpen) {
        setSelectedRecord(updated);
        const dateFormatted = updated.extracted_date ? new Date(updated.extracted_date).toISOString().split('T')[0] : '';
        setEditForm({
          document_type: updated.document_type || 'Other',
          date_type: updated.date_type || 'Expiry',
          extracted_date: dateFormatted,
          reminder_enabled: updated.reminder_enabled ?? true,
          reminder_days_before: updated.reminder_days_before || 30,
          user_confirmed: updated.user_confirmed || false
        });
      }
      await fetchData();
    } catch (err) {
      console.error('Failed to re-analyze record:', err);
      alert('Re-analysis failed. Please check backend log or Ollama status.');
    } finally {
      setModalSaving(false);
    }
  };

  // Launch File in Native Application / Shell
  const handleOpenFile = (e, filePath) => {
    e.stopPropagation();
    if (!filePath) return;
    if (window.electronAPI && window.electronAPI.openPath) {
      window.electronAPI.openPath(filePath);
    } else {
      alert(`Opening file: ${filePath}`);
    }
  };

  // Helper for Days Remaining calculation
  const getDaysRemainingText = (dateStr) => {
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
  };

  // Helper for Status Badge Styling
  const getStatusBadge = (status, userConfirmed) => {
    if (!userConfirmed && status === 'needs_review') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <AlertCircle className="w-3.5 h-3.5" /> Review
        </span>
      );
    }
    switch (status) {
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </span>
        );
      case 'due_soon':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> Due Soon
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Upcoming
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">
            {status}
          </span>
        );
    }
  };

  const documentTypes = ['All', 'Insurance', 'Passport', 'Visa', 'Driving Licence', 'Certificate', 'Subscription', 'Warranty', 'Contract', 'Government ID', 'Other'];
  const statusTypes = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Due Soon', value: 'due_soon' },
    { label: 'Expired', value: 'expired' },
    { label: 'Needs Review', value: 'needs_review' }
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2.5">
              <CalendarClock className="w-7 h-7 text-blue-500" /> Expiry & Reminders
            </h1>
            {ollamaStatus.available ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Ollama AI Active ({ollamaStatus.model})
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                title="Local Ollama AI offline. Using safe rule-based date detection fallback."
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Ollama Offline (Rule-based Fallback)
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Track important document dates and manage renewal reminders locally.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning Documents...' : 'Scan Documents'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upcoming Card */}
        <div
          onClick={() => setStatusFilter('upcoming')}
          className={`p-4 rounded-2xl bg-gray-900/90 border transition-all cursor-pointer ${
            statusFilter === 'upcoming'
              ? 'border-blue-500 shadow-lg shadow-blue-500/10'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Upcoming</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{summary.upcoming}</div>
          <p className="text-xs text-gray-400 mt-1">Valid documents</p>
        </div>

        {/* Due Soon Card */}
        <div
          onClick={() => setStatusFilter('due_soon')}
          className={`p-4 rounded-2xl bg-gray-900/90 border transition-all cursor-pointer ${
            statusFilter === 'due_soon'
              ? 'border-amber-500 shadow-lg shadow-amber-500/10'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Due Soon</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">{summary.due_soon}</div>
          <p className="text-xs text-gray-400 mt-1">Expiring within reminder window</p>
        </div>

        {/* Expired Card */}
        <div
          onClick={() => setStatusFilter('expired')}
          className={`p-4 rounded-2xl bg-gray-900/90 border transition-all cursor-pointer ${
            statusFilter === 'expired'
              ? 'border-red-500 shadow-lg shadow-red-500/10'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expired</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-red-400 mt-2">{summary.expired}</div>
          <p className="text-xs text-gray-400 mt-1">Past expiration date</p>
        </div>

        {/* Needs Review Card */}
        <div
          onClick={() => setStatusFilter('needs_review')}
          className={`p-4 rounded-2xl bg-gray-900/90 border transition-all cursor-pointer ${
            statusFilter === 'needs_review'
              ? 'border-purple-500 shadow-lg shadow-purple-500/10'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Needs Review</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-purple-400 mt-2">{summary.needs_review}</div>
          <p className="text-xs text-gray-400 mt-1">Unconfirmed extractions</p>
        </div>
      </div>

      {/* Review Banner Alert */}
      {summary.needs_review > 0 && statusFilter !== 'needs_review' && (
        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-purple-400 shrink-0" />
            <p className="text-sm text-purple-200">
              <span className="font-semibold">{summary.needs_review} document dates</span> need user confirmation to ensure accuracy.
            </p>
          </div>
          <button
            onClick={() => setStatusFilter('needs_review')}
            className="text-xs font-medium text-purple-300 hover:text-white underline cursor-pointer shrink-0"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search document name or date text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Dropdown Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {statusTypes.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>

          {/* Doc Type Filter */}
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {documentTypes.map((dt) => (
              <option key={dt} value={dt}>{dt === 'All' ? 'All Document Types' : dt}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="date_asc">Sort: Earliest Date</option>
            <option value="date_desc">Sort: Latest Date</option>
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
      </div>

      {/* Expiry Records Table */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm">Loading document expiry records...</p>
          </div>
        ) : expiries.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 text-gray-500 flex items-center justify-center mx-auto">
              <CalendarClock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-200">No expiry dates found</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'all' || docTypeFilter !== 'all'
                  ? 'No documents match your filter criteria. Try resetting search or filters.'
                  : 'Click "Scan Documents" to analyze your indexed files for expiration and renewal dates.'}
              </p>
            </div>
            {!(searchQuery || statusFilter !== 'all' || docTypeFilter !== 'all') && (
              <button
                onClick={handleScan}
                disabled={scanning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                Scan Documents Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 bg-gray-950/40 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Relevant Date</th>
                  <th className="py-3.5 px-4">Date Type</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Reminder</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-sm">
                {expiries.map((record) => {
                  const dateObj = new Date(record.extracted_date);
                  const dateFormatted = dateObj.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const remainingText = getDaysRemainingText(record.extracted_date);

                  return (
                    <tr
                      key={record.id}
                      onClick={() => openEditModal(record)}
                      className="hover:bg-gray-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Document Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-blue-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-200 group-hover:text-blue-400 transition-colors truncate max-w-xs" title={record.file_name}>
                              {record.file_name}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate max-w-xs" title={record.file_path}>
                              {record.file_path}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700/60">
                          {record.document_type}
                        </span>
                      </td>

                      {/* Relevant Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-gray-200 font-semibold">{dateFormatted}</div>
                        <div className="text-xs text-gray-400 leading-tight">{remainingText}</div>
                      </td>

                      {/* Date Type */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-gray-300 font-medium">
                          {record.date_type}
                        </span>
                      </td>

                      {/* Extraction Method */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {record.extraction_method === 'ollama' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Sparkles className="w-3 h-3" /> Ollama AI
                            </span>
                          ) : record.extraction_method === 'hybrid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Sparkles className="w-3 h-3" /> Hybrid AI
                            </span>
                          ) : record.extraction_method === 'user_manual' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Manual
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-800 text-gray-400 border border-gray-700">
                              Rule-based
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 font-mono">
                            {Math.round((record.confidence || 0.85) * 100)}% conf
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(record.status, record.user_confirmed)}
                      </td>

                      {/* Reminder */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleReminder(e, record)}
                          title={record.reminder_enabled ? `Reminder set (${record.reminder_days_before} days before)` : 'Reminder disabled'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            record.reminder_enabled
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                              : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
                          }`}
                        >
                          {record.reminder_enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                          {record.reminder_enabled ? `${record.reminder_days_before}d before` : 'Off'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {!record.user_confirmed && (
                            <button
                              type="button"
                              onClick={(e) => handleConfirmDate(e, record.id)}
                              title="Confirm Extracted Date"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(record)}
                            title="Edit Date Details"
                            className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenFile(e, record.file_path)}
                            title="Open Document"
                            className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Detail Modal */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Date Details & Settings</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Document File Info */}
              <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1">
                <div className="text-xs text-gray-400 font-medium">Document File</div>
                <div className="text-sm font-semibold text-gray-200 truncate">{selectedRecord.file_name}</div>
                <div className="text-xs text-gray-500 font-mono truncate">{selectedRecord.file_path}</div>
              </div>

              {/* Form Controls Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Document Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Document Type</label>
                  <select
                    value={editForm.document_type}
                    onChange={(e) => setEditForm({ ...editForm, document_type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    {documentTypes.filter(t => t !== 'All').map((dt) => (
                      <option key={dt} value={dt}>{dt}</option>
                    ))}
                  </select>
                </div>

                {/* Date Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Date Type</label>
                  <select
                    value={editForm.date_type}
                    onChange={(e) => setEditForm({ ...editForm, date_type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    {['Expiry', 'Renewal', 'Due', 'Issue', 'Start', 'Other'].map((dt) => (
                      <option key={dt} value={dt}>{dt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Extracted Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Tracked Date</label>
                <input
                  type="date"
                  value={editForm.extracted_date}
                  onChange={(e) => setEditForm({ ...editForm, extracted_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Reminder Settings */}
              <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-gray-200">Enable Reminders</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.reminder_enabled}
                    onChange={(e) => setEditForm({ ...editForm, reminder_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {editForm.reminder_enabled && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
                    <label className="text-xs text-gray-400">Reminder Timing</label>
                    <select
                      value={editForm.reminder_days_before}
                      onChange={(e) => setEditForm({ ...editForm, reminder_days_before: Number(e.target.value) })}
                      className="px-2.5 py-1 bg-gray-950 border border-gray-800 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value={30}>30 days before</option>
                      <option value={14}>14 days before</option>
                      <option value={7}>7 days before</option>
                      <option value={1}>1 day before</option>
                    </select>
                  </div>
                )}
              </div>

              {/* AI Understanding & Reasoning */}
              {selectedRecord.reason && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                  <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" /> AI Understanding & Context
                  </div>
                  <p className="text-xs text-blue-200 leading-relaxed font-sans">
                    {selectedRecord.reason}
                  </p>
                </div>
              )}

              {/* Original Context Snippet */}
              {selectedRecord.original_text && (
                <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                    <span>Extracted Evidence</span>
                    <span className="text-blue-400 font-mono">
                      {selectedRecord.extraction_method === 'ollama' ? 'Ollama AI' : 'Rule-based'} • {Math.round((selectedRecord.confidence || 0.85) * 100)}% Confidence
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 font-mono italic leading-relaxed bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                    "{selectedRecord.original_text}"
                  </p>
                </div>
              )}

              {/* Confirmation Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900/40 border border-gray-800">
                <span className="text-xs text-gray-400">Verification State</span>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, user_confirmed: !editForm.user_confirmed })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    editForm.user_confirmed
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {editForm.user_confirmed ? 'Confirmed by User' : 'Unconfirmed (Click to Confirm)'}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={modalSaving}
                className="px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleReanalyzeRecord(e, selectedRecord.id)}
                  disabled={modalSaving}
                  title="Re-run Ollama AI + Rule-based detection"
                  className="px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${modalSaving ? 'animate-spin' : ''}`} /> Re-analyze AI
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={modalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                >
                  {modalSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
