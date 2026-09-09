import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Award, 
  Folder, 
  Sparkles, 
  Clock, 
  ArrowRight,
  Brain,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { apiService } from '../services/apiService';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, setPreviewFile, folders } = useApp();

  const [stats, setStats] = useState({
    folders: 0,
    files: 0,
    chunks: 0,
    vectors: 0,
    searches: 0,
    recent_files: [],
    recent_searches: []
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const data = await apiService.getStatistics();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/results');
    }
  };

  const handleSuggestionClick = (query) => {
    setSearchQuery(query);
    navigate('/results');
  };

  return (
    <div className="space-y-6">
      {/* Hero Welcome & Quick Search Header */}
      <div className="glass-panel p-8 rounded-3xl border-blue-500/20 bg-gradient-to-r from-blue-950/20 via-gray-900/60 to-purple-950/20 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Memora AI Desktop</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome to Memora AI
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mb-6">
            Search your {stats.files} indexed local documents, scanned receipts, certificates, and notes by natural meaning.
          </p>

          {/* Quick Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask Memora... e.g. 'Show my internship resume'"
              className="w-full pl-12 pr-28 py-3.5 text-sm rounded-2xl glass-input text-white placeholder-gray-400 shadow-xl"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              Search
            </Button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
            <span className="text-gray-500 font-medium mr-1">Try asking:</span>
            {[
              'Show my internship resume',
              'Find my machine learning notes',
              'Find my cloud computing notes',
              'Show my IoT project information'
            ].map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-2.5 py-1 rounded-lg bg-gray-800/60 hover:bg-blue-600/20 text-gray-300 hover:text-blue-300 border border-gray-700/50 transition-colors"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Indexed Files</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{stats.files}</div>
          <p className="text-[11px] text-gray-500 mt-1">PDFs, DOCX, Images, Notes</p>
        </Card>

        <Card hoverEffect={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Scanned Folders</span>
            <Folder className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{stats.folders || folders.length}</div>
          <p className="text-[11px] text-gray-500 mt-1">Active scanned directories</p>
        </Card>

        <Card hoverEffect={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Vector Embeddings</span>
            <Brain className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{stats.vectors}</div>
          <p className="text-[11px] text-gray-500 mt-1">Intelligent local semantic index ({stats.chunks} chunks)</p>
        </Card>

        <Card hoverEffect={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400">Local Privacy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">100%</div>
          <p className="text-[11px] text-gray-500 mt-1">Zero cloud data upload</p>
        </Card>
      </div>

      {/* Content Split: Recent Files & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Files List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Recently Indexed & Updated Files</span>
            </h3>
            <button
              onClick={() => navigate('/search')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recent_files && stats.recent_files.length > 0 ? (
              stats.recent_files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setPreviewFile({
                    id: file.id,
                    name: file.name,
                    path: file.path,
                    fileExtension: file.extension,
                    category: file.extension.replace('.', ''),
                    sizeBytes: file.size,
                    modifiedAt: file.modified_at,
                    extractedSnippet: file.extracted_text || 'Indexed document'
                  })}
                  className="glass-panel p-4 rounded-2xl border-gray-800/80 hover:border-blue-500/40 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {['.jpg', '.jpeg', '.png', '.webp'].includes(file.extension) ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-300">
                          {file.name}
                        </h4>
                        <Badge variant="blue" size="sm">
                          {file.extension.toUpperCase().replace('.', '')}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1">{file.path}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-4 hidden sm:block">
                    <div className="text-xs text-gray-400 font-mono">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {new Date(file.modified_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-panel p-6 rounded-2xl text-center text-gray-400 text-sm">
                No files indexed yet. Select a folder to start scanning!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Categories & Recent Searches */}
        <div className="space-y-4">
          <h3 className="font-bold text-base text-white">Smart Category Index</h3>
          
          <div className="space-y-2.5">
            <div
              onClick={() => handleSuggestionClick('resume')}
              className="glass-panel p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Resumes & Credentials</h4>
                  <p className="text-[10px] text-gray-400">PDF & DOCX files</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500" />
            </div>

            <div
              onClick={() => handleSuggestionClick('notes')}
              className="glass-panel p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Folder className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Coursework & Study Notes</h4>
                  <p className="text-[10px] text-gray-400">Indexed text documents</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500" />
            </div>

            <div
              onClick={() => handleSuggestionClick('IoT')}
              className="glass-panel p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Projects & Documentation</h4>
                  <p className="text-[10px] text-gray-400">Indexed technical files</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
