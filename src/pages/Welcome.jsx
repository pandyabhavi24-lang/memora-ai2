import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Search, Sparkles, ArrowRight, Lock, EyeOff } from 'lucide-react';
import { Button } from '../components/common/Button';

export const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#06101F] flex flex-col justify-between p-8 select-none relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute w-[600px] h-[600px] bg-[#3478F6]/10 rounded-full blur-[140px] pointer-events-none top-0 right-0"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none bottom-0 left-0"></div>

      {/* Header Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#3478F6]/15 border border-[#3478F6]/30 flex items-center justify-center text-[#38BDF8] shadow-sm">
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="font-bold text-white text-base tracking-tight">MEMORA <span className="text-[#38BDF8] font-mono">AI</span></span>
      </div>

      {/* Hero Section */}
      <div className="max-w-3xl mx-auto my-auto text-center py-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3478F6]/10 border border-[#3478F6]/25 text-xs font-semibold text-[#38BDF8] mb-6 shadow-sm">
          <ShieldCheck className="w-4 h-4" />
          <span>Local-First Intelligent File Memory</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6 leading-tight">
          Search your digital life by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4B91FF] via-[#38BDF8] to-cyan-300">meaning</span>, not just filename.
        </h1>

        <p className="text-base text-[#A7B7D0] max-w-xl mx-auto mb-10 leading-relaxed">
          Stop struggling to remember file titles like <code className="text-[#38BDF8] bg-[#0E1D35] px-2 py-0.5 rounded text-xs font-mono border border-[rgba(139,170,215,0.2)]">Resume_v3_final.pdf</code>. Ask Memora AI using natural concepts like <span className="text-white italic">"Show my latest internship resume"</span> or <span className="text-white italic">"Find my machine learning lecture notes"</span>.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left">
          <div className="bg-[#0A1629] p-5 rounded-2xl border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.28)] hover:bg-[#0E1D35]/50 transition-all shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-[#3478F6]/15 border border-[#3478F6]/30 text-[#38BDF8] flex items-center justify-center mb-3">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1">Semantic AI Search</h3>
            <p className="text-xs text-[#A7B7D0] leading-relaxed">
              Understand concept context across documents, PDFs, notes, and visual images.
            </p>
          </div>

          <div className="bg-[#0A1629] p-5 rounded-2xl border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.28)] hover:bg-[#0E1D35]/50 transition-all shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1">100% Local Execution</h3>
            <p className="text-xs text-[#A7B7D0] leading-relaxed">
              All files, OCR text, and vector indices stay strictly on your local computer.
            </p>
          </div>

          <div className="bg-[#0A1629] p-5 rounded-2xl border border-[rgba(139,170,215,0.14)] hover:border-[rgba(139,170,215,0.28)] hover:bg-[#0E1D35]/50 transition-all shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1">Bounded Folder Access</h3>
            <p className="text-xs text-[#A7B7D0] leading-relaxed">
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
          className="shadow-xl shadow-blue-900/40 px-8 py-3.5 bg-[#3478F6] hover:bg-[#2563EB] text-white font-semibold"
        >
          Configure Folders & Begin Setup
        </Button>
      </div>

      {/* Footer Disclaimer */}
      <div className="text-center text-xs text-[#7E93B3] font-mono">
        Memora AI v1.0 • Desktop Client • Windows x64
      </div>
    </div>
  );
};
