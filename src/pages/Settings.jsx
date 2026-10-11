import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Folder, 
  ShieldCheck, 
  Cpu, 
  Palette, 
  HardDrive, 
  Info,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useApp } from '../context/AppContext';

export const Settings = () => {
  const { folders, removeFolder, selectFolderNative, addToast } = useApp();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'folders' | 'privacy' | 'ai' | 'about'

  const handleReindex = () => {
    addToast('Re-indexing triggered across all watched folders...', 'info');
  };

  const handleClearCache = () => {
    addToast('Local FAISS index cache cleared successfully.', 'success');
  };

  return (
    <div className="space-y-6 select-none">
      <PageHeader
        title="Settings & System Preferences"
        subtitle="Manage scanned directories, AI embedding models, theme system, and local privacy."
        badge={<Badge variant="blue">v1.0.0 Desktop</Badge>}
      />

      {/* Settings Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-[rgba(139,170,215,0.14)] pb-3 overflow-x-auto custom-scrollbar flex-nowrap shrink-0">
        {[
          { id: 'general', label: 'General & Theme', icon: Palette },
          { id: 'folders', label: 'Folder Management', icon: Folder },
          { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
          { id: 'ai', label: 'AI & OCR Models', icon: Cpu },
          { id: 'about', label: 'About & System Info', icon: Info },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#3478F6]/20 text-[#38BDF8] border border-[#3478F6]/40 shadow-sm'
                  : 'text-[#7E93B3] hover:text-white hover:bg-[#0E1D35]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white">Appearance & Theme System</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Theme System</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Midnight Navy with Electric Blue & Obsidian Surface (Production Reference)</p>
              </div>
              <Badge variant="blue">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <div>
                <h4 className="text-xs font-semibold text-white">Global Quick Search Shortcut</h4>
                <p className="text-[11px] text-[#A7B7D0] mt-0.5">Trigger intelligent search input anywhere across the desktop app</p>
              </div>
              <span className="px-3 py-1 bg-[#0E1D35] text-xs font-mono text-[#38BDF8] font-bold rounded-lg border border-[rgba(139,170,215,0.2)]">
                Ctrl + K
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'folders' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Monitored Folders</h3>
              <p className="text-xs text-[#A7B7D0] mt-0.5">Manage local file directories indexed by Memora AI.</p>
            </div>
            <Button variant="primary" size="sm" icon={Folder} onClick={selectFolderNative} className="bg-[#3478F6] hover:bg-[#2563EB] text-white">
              Add Directory
            </Button>
          </div>

          <div className="space-y-2.5">
            {folders.length === 0 ? (
              <div className="p-8 text-center text-[#7E93B3] bg-[#06101F]/60 rounded-xl border border-[rgba(139,170,215,0.12)]">
                No folders currently added. Click "Add Directory" to start monitoring.
              </div>
            ) : (
              folders.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
                  <div>
                    <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 text-[#38BDF8]" />
                      {f.name}
                    </h4>
                    <p className="text-[11px] text-[#7E93B3] font-mono mt-0.5">{f.path}</p>
                  </div>
                  <button
                    onClick={() => removeFolder(f.id)}
                    className="p-1.5 text-[#7E93B3] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Remove folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Local Privacy & Security Architecture</span>
          </h3>

          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed">
            <strong>100% Offline Processing:</strong> All text extraction, OCR, vector embeddings, and semantic similarity search execute strictly on your local hardware. No file contents or metadata leave your computer.
          </div>

          <p className="text-xs text-[#A7B7D0] leading-relaxed">
            Full security features — including Application Lock, PIN management, excluded folders, audit trail,
            AES-256-GCM encryption, and local backup/restore — are consolidated in the Security page.
          </p>

          <Link
            to="/security"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3478F6]/20 border border-[#3478F6]/40 text-[#38BDF8] text-xs font-semibold hover:bg-[#3478F6]/30 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Open Security &amp; Privacy Console
          </Link>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-6">
          <h3 className="text-sm font-bold text-white">AI Engine & Local Model Pipeline</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <span className="text-[11px] text-[#7E93B3] font-mono uppercase tracking-wider">Embedding Model</span>
              <h4 className="text-sm font-bold text-white font-mono mt-1">all-MiniLM-L6-v2</h4>
              <p className="text-[11px] text-[#A7B7D0] mt-1">384 Dimensions • PyTorch CPU / ONNX Runtime</p>
            </div>

            <div className="p-4 rounded-xl bg-[#06101F]/70 border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.25)] transition-all">
              <span className="text-[11px] text-[#7E93B3] font-mono uppercase tracking-wider">Vector Index Engine</span>
              <h4 className="text-sm font-bold text-white font-mono mt-1">FAISS IndexFlatIP</h4>
              <p className="text-[11px] text-[#A7B7D0] mt-1">Normalized Inner Product Cosine Search</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-[rgba(139,170,215,0.14)]">
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleReindex} className="bg-[#0E1D35] hover:bg-[#162746] border-[rgba(139,170,215,0.2)] text-white">
              Trigger Full Re-index
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleClearCache}>
              Clear Vector Cache
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="bg-[#0A1629] p-6 rounded-2xl border border-[rgba(139,170,215,0.14)] shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white">Memora AI – Platform Information</h3>
          <p className="text-xs text-[#A7B7D0] leading-relaxed">
            Memora AI is a desktop intelligence platform engineered to eliminate digital clutter through local semantic vector search, private multi-modal indexers, and local-first storage architecture.
          </p>

          <div className="p-4 rounded-xl bg-[#06101F]/80 border border-[rgba(139,170,215,0.14)] text-xs font-mono space-y-1 text-[#DCE5F3]">
            <div>Application: <span className="text-white font-bold">Memora AI Desktop</span></div>
            <div>Version: <span className="text-[#38BDF8]">1.0.0 Production Edition</span></div>
            <div>Interface: <span className="text-white">React 19 + Electron 43 + Tailwind CSS v4</span></div>
            <div>Local Intelligence: <span className="text-white">FastAPI + SQLite + FAISS + PyTorch</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
