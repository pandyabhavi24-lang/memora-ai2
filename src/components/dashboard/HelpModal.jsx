import React, { useEffect } from 'react';
import { HelpCircle, X, Mail, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';

export const SUPPORT_EMAIL = 'support@memora.ai';

export const HelpModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div 
        className="glass-panel w-full max-w-lg rounded-3xl border border-blue-500/30 bg-slate-900/95 text-white p-6 sm:p-8 shadow-2xl relative space-y-6 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background glow accent */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Help & Support</span>
              <h2 id="help-modal-title" className="text-lg font-extrabold text-white tracking-tight">
                Memora AI Assistance
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Help Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: What can I do with Memora AI? */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            What can I do with Memora AI?
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <span><strong>Search files using natural language</strong> — Ask questions or search by intent without needing exact filenames.</span>
            </li>
            <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
              <span><strong>Add folders and let Memora read their contents</strong> — Safely index your local documents offline.</span>
            </li>
            <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <span><strong>Find similar or duplicate files</strong> — Identify exact copies and related documents effortlessly.</span>
            </li>
            <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span><strong>Organize files with AI suggestions</strong> — Get smart category tags and clean folder recommendations.</span>
            </li>
          </ul>
        </div>

        {/* Section 2: Quick Guide */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Quick Guide
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-blue-400 font-mono">1. Add a folder</span>
              <p className="text-slate-300 text-[11px]">Select any directory on your computer to begin.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-purple-400 font-mono">2. Let Memora process</span>
              <p className="text-slate-300 text-[11px]">Memora securely reads and indexes file contents.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-amber-400 font-mono">3. Search in your words</span>
              <p className="text-slate-300 text-[11px]">Type natural queries into the search bar.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-400 font-mono">4. Review results</span>
              <p className="text-slate-300 text-[11px]">Inspect recommendations and organize your data.</p>
            </div>
          </div>
        </div>

        {/* Section 3: Need Help & Contact Support */}
        <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/20 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-blue-300">Need Help?</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">
              If something isn't working or you don't understand a feature, we're here to help.
            </p>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Memora%20AI%20Support%20Request`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-lg cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Contact Support ({SUPPORT_EMAIL})</span>
          </a>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800/80">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
