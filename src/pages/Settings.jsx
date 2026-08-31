import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Folder, 
  ShieldCheck, 
  Cpu, 
  Palette, 
  HardDrive, 
  Info,
  RefreshCw,
  Trash2,
  CheckCircle2
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
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
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
        <div className="glass-panel p-6 rounded-2xl border-gray-800/80 space-y-6">
          <h3 className="text-sm font-bold text-white">Appearance & Theme System</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <div>
                <h4 className="text-xs font-semibold text-gray-200">Theme System</h4>
                <p className="text-[11px] text-gray-400">Dark Mode Glassmorphic Obsidian Theme (Default)</p>
              </div>
              <Badge variant="blue">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <div>
                <h4 className="text-xs font-semibold text-gray-200">Global Shortcut Hotkey</h4>
                <p className="text-[11px] text-gray-400">Trigger quick search input anywhere using Ctrl+K / Cmd+K</p>
              </div>
              <span className="px-2 py-1 bg-gray-800 text-xs font-mono text-gray-300 rounded border border-gray-700">
                Ctrl + K
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'folders' && (
        <div className="glass-panel p-6 rounded-2xl border-gray-800/80 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Scanned Folder Paths</h3>
              <p className="text-xs text-gray-400">Add or remove local directories scanned by Memora AI.</p>
            </div>
            <Button variant="secondary" size="sm" icon={Folder} onClick={selectFolderNative}>
              Add Directory
            </Button>
          </div>

          <div className="space-y-2.5">
            {folders.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">{f.name}</h4>
                  <p className="text-[11px] text-gray-400 font-mono">{f.path}</p>
                </div>
                <button
                  onClick={() => removeFolder(f.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="glass-panel p-6 rounded-2xl border-gray-800/80 space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Local Processing Guarantee</span>
          </h3>

          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed">
            <strong>100% Offline Processing Architecture:</strong> All document text extractions, OpenCV image processing, EasyOCR calculations, Sentence Transformer embeddings, and FAISS similarity lookup take place strictly on your local CPU/GPU hardware. No data is ever transmitted to remote cloud APIs.
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="glass-panel p-6 rounded-2xl border-gray-800/80 space-y-6">
          <h3 className="text-sm font-bold text-white">AI Engine & Model Status</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-[11px] text-gray-400">Embedding Model</span>
              <h4 className="text-sm font-bold text-white font-mono mt-1">all-MiniLM-L6-v2</h4>
              <p className="text-[11px] text-gray-400 mt-1">384 Dimensions • PyTorch CPU/ONNX</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-[11px] text-gray-400">Vector Index Engine</span>
              <h4 className="text-sm font-bold text-white font-mono mt-1">FAISS IndexFlatIP</h4>
              <p className="text-[11px] text-gray-400 mt-1">Normalized Inner Product Cosine Search</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleReindex}>
              Trigger Full Re-index
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={handleClearCache}>
              Clear Vector Cache
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="glass-panel p-6 rounded-2xl border-gray-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white">Memora AI – Project Metadata</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Memora AI is a Final Year Capstone Project designed and built by a 6-member student engineering team. It solves digital information overload through local semantic vector search.
          </p>

          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 text-xs font-mono space-y-1 text-gray-300">
            <div>Application: Memora AI Desktop</div>
            <div>Version: 1.0.0 Phase 2 Frontend</div>
            <div>Stack: React 19 + Electron 34 + Tailwind CSS</div>
            <div>Architecture: Decoupled REST Service Boundary</div>
          </div>
        </div>
      )}
    </div>
  );
};
