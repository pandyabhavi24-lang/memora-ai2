import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, HardDrive, Search, Sparkles, ArrowRight, Lock, EyeOff } from 'lucide-react';
import { Button } from '../components/common/Button';

export const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-between p-8 select-none relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none top-0 right-0"></div>

      {/* Header Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="font-bold text-white tracking-wide">MEMORA AI</span>
      </div>

      {/* Hero Section */}
      <div className="max-w-3xl mx-auto my-auto text-center py-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-6">
          <ShieldCheck className="w-4 h-4" />
          <span>Privacy-First AI Digital Assistant</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6 leading-tight">
          Search your digital life by <span className="text-gradient">meaning</span>, not just filename.
        </h1>

        <p className="text-base text-gray-300 max-w-xl mx-auto mb-10 leading-relaxed">
          Stop struggling to remember file titles like <code className="text-blue-300 bg-blue-950/60 px-1.5 py-0.5 rounded text-xs font-mono">Resume_v3_final.pdf</code>. Ask Memora AI using natural concepts like <span className="text-gray-100 italic">"Show my latest internship resume"</span> or <span className="text-gray-100 italic">"Find my machine learning notes"</span>.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left">
          <div className="glass-panel p-5 rounded-2xl border-gray-800/80">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1">Semantic AI Search</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Understand concept context across documents, PDFs, notes, and visual images.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border-gray-800/80">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1">100% Local Execution</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              All files, OCR text, and vector indices stay strictly on your local computer.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border-gray-800/80">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1">Bounded Folder Access</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Memora AI scans strictly the specific local directories you explicitly select.
            </p>
          </div>
        </div>

        {/* CTA Action */}
        <Button
          variant="primary"
          size="lg"
          icon={ArrowRight}
          onClick={() => navigate('/folders')}
          className="shadow-xl shadow-blue-600/30 px-8 py-3.5"
        >
          Configure Folders & Begin Setup
        </Button>
      </div>

      {/* Footer Disclaimer */}
      <div className="text-center text-xs text-gray-500 font-mono">
        Memora AI v1.0 • Desktop Client • Windows x64
      </div>
    </div>
  );
};
