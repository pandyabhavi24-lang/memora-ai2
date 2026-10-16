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
      setError('Couldn\'t load reminders. Please try again.');
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
      await apiService.scanExpiries();
      await fetchData();
    } catch (err) {
      console.error('Scanning failed:', err);
      setError('Something went wrong. Please try again.');
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
    const dateObj = record.extracted_date ? new Date(record.extracted_date) : null;
    const dateFormatted = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';
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
        const dateObj = updated.extracted_date ? new Date(updated.extracted_date) : null;
        const dateFormatted = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';
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
      alert('Re-analysis failed. Please try again.');
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
    if (isNaN(target.getTime())) return '';
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
    { label: 'Check Details', value: 'needs_review' }
  ];

  return (
    <div className="space-y-5 pb-8 select-none">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(139,170,215,0.14)] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#3478F6]/15 border border-[#3478F6]/30 flex items-center justify-center text-[#38BDF8]">
                <CalendarClock className="w-5 h-5" />
              </div>
              Document Reminders
            </h1>
            {ollamaStatus.available ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Date Analysis Active
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                title="Date detection is running in basic mode."
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Basic Date Detection Active
              </span>
            )}
          </div>
          <p className="text-sm text-[#A7B7D0] mt-1.5">
            Track critical document renewal deadlines and manage intelligent local alerts.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3478F6] hover:bg-[#2563EB] text-white font-medium text-sm transition-all shadow-lg shadow-blue-900/30 border border-blue-400/20 disabled:opacity-50 cursor-pointer"
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
          className={`p-4 rounded-2xl bg-[#0A1629] border transition-all cursor-pointer ${
            statusFilter === 'upcoming'
              ? 'border-[#3478F6] shadow-lg shadow-blue-500/10 ring-1 ring-[#3478F6]/30'
              : 'border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.3)] hover:bg-[#0E1D35]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7E93B3] uppercase tracking-wider font-mono">Upcoming</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-[#38BDF8] flex items-center justify-center border border-blue-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-extrabold text-white mt-2">{summary.upcoming}</div>
          <p className="text-xs text-[#A7B7D0] mt-1">Valid documents tracked</p>
        </div>

        {/* Due Soon Card */}
        <div
          onClick={() => setStatusFilter('due_soon')}
          className={`p-4 rounded-2xl bg-[#0A1629] border transition-all cursor-pointer ${
            statusFilter === 'due_soon'
              ? 'border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
              : 'border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.3)] hover:bg-[#0E1D35]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7E93B3] uppercase tracking-wider font-mono">Due Soon</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-extrabold text-amber-400 mt-2">{summary.due_soon}</div>
          <p className="text-xs text-[#A7B7D0] mt-1">Expiring within reminder window</p>
        </div>

        {/* Expired Card */}
        <div
          onClick={() => setStatusFilter('expired')}
          className={`p-4 rounded-2xl bg-[#0A1629] border transition-all cursor-pointer ${
            statusFilter === 'expired'
              ? 'border-red-500 shadow-lg shadow-red-500/10 ring-1 ring-red-500/30'
              : 'border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.3)] hover:bg-[#0E1D35]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7E93B3] uppercase tracking-wider font-mono">Expired</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-extrabold text-red-400 mt-2">{summary.expired}</div>
          <p className="text-xs text-[#A7B7D0] mt-1">Past expiration date</p>
        </div>

        {/* Needs Review Card */}
        <div
          onClick={() => setStatusFilter('needs_review')}
          className={`p-4 rounded-2xl bg-[#0A1629] border transition-all cursor-pointer ${
            statusFilter === 'needs_review'
              ? 'border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
              : 'border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.3)] hover:bg-[#0E1D35]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7E93B3] uppercase tracking-wider font-mono">Check Details</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-extrabold text-purple-400 mt-2">{summary.needs_review}</div>
          <p className="text-xs text-[#A7B7D0] mt-1">Dates to Check</p>
        </div>
      </div>

      {/* Review Banner Alert */}
      {summary.needs_review > 0 && statusFilter !== 'needs_review' && (
        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-purple-400 shrink-0" />
            <p className="text-sm text-purple-200">
              <span className="font-semibold text-white">{summary.needs_review} document dates</span> need confirmation to ensure alert accuracy.
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
      <div className="p-4 rounded-2xl bg-[#0A1629] border border-[rgba(139,170,215,0.14)] flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7E93B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search document title or extracted date text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-sm text-[#DCE5F3] placeholder-[#7E93B3] focus:outline-none focus:border-[#3478F6] transition-colors"
          />
        </div>

        {/* Dropdown Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-xs text-[#DCE5F3] focus:outline-none focus:border-[#3478F6] cursor-pointer"
          >
            {statusTypes.map((st) => (
              <option key={st.value} value={st.value} className="bg-[#0A1629] text-[#DCE5F3]">{st.label}</option>
            ))}
          </select>

          {/* Doc Type Filter */}
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="px-3 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-xs text-[#DCE5F3] focus:outline-none focus:border-[#3478F6] cursor-pointer"
          >
            {documentTypes.map((dt) => (
              <option key={dt} value={dt} className="bg-[#0A1629] text-[#DCE5F3]">{dt === 'All' ? 'All Document Types' : dt}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-xs text-[#DCE5F3] focus:outline-none focus:border-[#3478F6] cursor-pointer"
          >
            <option value="date_asc" className="bg-[#0A1629] text-[#DCE5F3]">Sort: Earliest Date</option>
            <option value="date_desc" className="bg-[#0A1629] text-[#DCE5F3]">Sort: Latest Date</option>
            <option value="name_asc" className="bg-[#0A1629] text-[#DCE5F3]">Sort: Name (A-Z)</option>
            <option value="status" className="bg-[#0A1629] text-[#DCE5F3]">Sort: Status</option>
          </select>
        </div>
      </div>

      {/* Expiry Records Table */}
      <div className="bg-[#0A1629] border border-[rgba(139,170,215,0.14)] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-[#A7B7D0] space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#3478F6]" />
            <p className="text-sm">Loading document expiry records...</p>
          </div>
        ) : expiries.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0E1D35] text-[#7E93B3] flex items-center justify-center mx-auto border border-[rgba(139,170,215,0.12)]">
              <CalendarClock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">No expiry dates found</h3>
              <p className="text-sm text-[#A7B7D0] mt-1 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'all' || docTypeFilter !== 'all'
                  ? 'No documents match your filter criteria. Try resetting search or filters.'
                  : 'Click "Scan Documents" to analyze your indexed files for expiration and renewal dates.'}
              </p>
            </div>
            {!(searchQuery || statusFilter !== 'all' || docTypeFilter !== 'all') && (
              <button
                onClick={handleScan}
                disabled={scanning}
                className="px-4 py-2 bg-[#3478F6] hover:bg-[#2563EB] text-white font-medium text-xs rounded-xl transition-colors cursor-pointer shadow-md shadow-blue-900/30"
              >
                Scan Documents Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[rgba(139,170,215,0.14)] text-[11px] font-mono font-semibold text-[#7E93B3] bg-[#06101F]/80 uppercase tracking-wider">
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
              <tbody className="divide-y divide-[rgba(139,170,215,0.1)] text-sm">
                {expiries.map((record) => {
                  const dateObj = record.extracted_date ? new Date(record.extracted_date) : null;
                  const isValidDate = dateObj && !isNaN(dateObj.getTime());
                  const dateFormatted = isValidDate
                    ? dateObj.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'N/A';
                  const remainingText = isValidDate ? getDaysRemainingText(record.extracted_date) : '';

                  return (
                    <tr
                      key={record.id}
                      onClick={() => openEditModal(record)}
                      className="hover:bg-[#0E1D35]/50 transition-colors cursor-pointer group"
                    >
                      {/* Document Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#0E1D35] border border-[rgba(139,170,215,0.14)] flex items-center justify-center text-[#38BDF8] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white group-hover:text-[#4B91FF] transition-colors truncate max-w-xs" title={record.file_name}>
                              {record.file_name}
                            </div>
                            <div className="text-[11px] text-[#7E93B3] font-mono truncate max-w-xs" title={record.file_path}>
                              {record.file_path}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#06101F] text-[#DCE5F3] border border-[rgba(139,170,215,0.16)]">
                          {record.document_type}
                        </span>
                      </td>

                      {/* Relevant Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-white font-bold">{dateFormatted}</div>
                        <div className="text-xs text-[#7E93B3] leading-tight font-medium mt-0.5">{remainingText}</div>
                      </td>

                      {/* Date Type */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-[#DCE5F3] font-medium">
                          {record.date_type}
                        </span>
                      </td>

                      {/* Extraction Method */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {record.extraction_method === 'ollama' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Sparkles className="w-3 h-3" /> AI Detected
                            </span>
                          ) : record.extraction_method === 'hybrid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Sparkles className="w-3 h-3" /> Auto Detected
                            </span>
                          ) : record.extraction_method === 'user_manual' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Manually Added
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#0E1D35] text-[#A7B7D0] border border-[rgba(139,170,215,0.14)]">
                              Auto Detected
                            </span>
                          )}
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
                              ? 'bg-[#3478F6]/15 text-[#38BDF8] border-[#3478F6]/40 hover:bg-[#3478F6]/25'
                              : 'bg-[#0E1D35] text-[#7E93B3] border-[rgba(139,170,215,0.12)] hover:text-white'
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
                            className="p-1.5 rounded-lg bg-[#0E1D35] text-[#A7B7D0] hover:text-white hover:bg-[#162746] border border-[rgba(139,170,215,0.16)] transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenFile(e, record.file_path)}
                            title="Open Document"
                            className="p-1.5 rounded-lg bg-[#0E1D35] text-[#A7B7D0] hover:text-white hover:bg-[#162746] border border-[rgba(139,170,215,0.16)] transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#06101F]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0A1629] border border-[rgba(139,170,215,0.2)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[rgba(139,170,215,0.14)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#3478F6]/15 border border-[#3478F6]/30 text-[#38BDF8] flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Date Details & Settings</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#7E93B3] hover:text-white hover:bg-[#0E1D35] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Document File Info */}
              <div className="p-3.5 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.14)] space-y-1">
                <div className="text-xs text-[#7E93B3] font-semibold uppercase tracking-wider font-mono">Document File</div>
                <div className="text-sm font-semibold text-white truncate">{selectedRecord.file_name}</div>
                <div className="text-xs text-[#A7B7D0] font-mono truncate">{selectedRecord.file_path}</div>
              </div>

              {/* Form Controls Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Document Type */}
                <div>
                  <label className="block text-xs font-semibold text-[#DCE5F3] mb-1">Document Type</label>
                  <select
                    value={editForm.document_type}
                    onChange={(e) => setEditForm({ ...editForm, document_type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-sm text-[#DCE5F3] focus:outline-none focus:border-[#3478F6]"
                  >
                    {documentTypes.filter(t => t !== 'All').map((dt) => (
                      <option key={dt} value={dt} className="bg-[#0A1629] text-[#DCE5F3]">{dt}</option>
                    ))}
                  </select>
                </div>

                {/* Date Type */}
                <div>
                  <label className="block text-xs font-semibold text-[#DCE5F3] mb-1">Date Type</label>
                  <select
                    value={editForm.date_type}
                    onChange={(e) => setEditForm({ ...editForm, date_type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-sm text-[#DCE5F3] focus:outline-none focus:border-[#3478F6]"
                  >
                    {['Expiry', 'Renewal', 'Due', 'Issue', 'Start', 'Other'].map((dt) => (
                      <option key={dt} value={dt} className="bg-[#0A1629] text-[#DCE5F3]">{dt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Extracted Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-[#DCE5F3] mb-1">Tracked Date</label>
                <input
                  type="date"
                  value={editForm.extracted_date}
                  onChange={(e) => setEditForm({ ...editForm, extracted_date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-xl text-sm text-[#DCE5F3] focus:outline-none focus:border-[#3478F6] font-mono"
                />
              </div>

              {/* Reminder Settings */}
              <div className="p-3.5 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#38BDF8]" />
                    <span className="text-xs font-semibold text-white">Enable Reminders</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.reminder_enabled}
                    onChange={(e) => setEditForm({ ...editForm, reminder_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-[#06101F] border-[rgba(139,170,215,0.3)] text-[#3478F6] focus:ring-0 cursor-pointer"
                  />
                </div>

                {editForm.reminder_enabled && (
                  <div className="flex items-center justify-between pt-2 border-t border-[rgba(139,170,215,0.12)]">
                    <label className="text-xs text-[#A7B7D0]">Reminder Timing</label>
                    <select
                      value={editForm.reminder_days_before}
                      onChange={(e) => setEditForm({ ...editForm, reminder_days_before: Number(e.target.value) })}
                      className="px-2.5 py-1 bg-[#06101F] border border-[rgba(139,170,215,0.16)] rounded-lg text-xs text-[#DCE5F3] focus:outline-none focus:border-[#3478F6] cursor-pointer"
                    >
                      <option value={30} className="bg-[#0A1629]">30 days before</option>
                      <option value={14} className="bg-[#0A1629]">14 days before</option>
                      <option value={7} className="bg-[#0A1629]">7 days before</option>
                      <option value={1} className="bg-[#0A1629]">1 day before</option>
                    </select>
                  </div>
                )}
              </div>

              {/* AI Understanding & Reasoning */}
              {selectedRecord.reason && (
                <div className="p-3.5 rounded-xl bg-[#3478F6]/10 border border-[#3478F6]/25 space-y-1">
                  <div className="text-[11px] font-semibold text-[#38BDF8] uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" /> Detection Details
                  </div>
                  <p className="text-xs text-[#93C5FD] leading-relaxed">
                    {selectedRecord.reason}
                  </p>
                </div>
              )}

              {/* Original Context Snippet */}
              {selectedRecord.original_text && (
                <div className="p-3.5 rounded-xl bg-[#06101F] border border-[rgba(139,170,215,0.14)] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#7E93B3] font-semibold uppercase tracking-wider font-mono">
                    <span>Extracted Evidence</span>
                    <span className="text-[#38BDF8]">
                      {selectedRecord.extraction_method === 'ollama' ? 'AI Detected' : 'Auto Detected'}
                    </span>
                  </div>
                  <p className="text-xs text-[#DCE5F3] font-mono italic leading-relaxed bg-[#0A1629] p-2.5 rounded-lg border border-[rgba(139,170,215,0.1)]">
                    "{selectedRecord.original_text}"
                  </p>
                </div>
              )}

              {/* Confirmation Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)]">
                <span className="text-xs text-[#A7B7D0]">Verification State</span>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, user_confirmed: !editForm.user_confirmed })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    editForm.user_confirmed
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {editForm.user_confirmed ? 'Confirmed by User' : 'Not yet confirmed — click to confirm'}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[rgba(139,170,215,0.14)] bg-[#06101F]/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={modalSaving}
                className="px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/25 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleReanalyzeRecord(e, selectedRecord.id)}
                  disabled={modalSaving}
                  title="Re-analyze dates"
                  className="px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/25 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${modalSaving ? 'animate-spin' : ''}`} /> Re-analyze AI
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#A7B7D0] hover:text-white hover:bg-[#0E1D35] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={modalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-[#3478F6] hover:bg-[#2563EB] text-white transition-colors cursor-pointer shadow-lg shadow-blue-900/30 border border-blue-400/20 flex items-center gap-1.5"
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
