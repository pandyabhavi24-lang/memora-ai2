import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Cpu, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Splash = () => {
  const navigate = useNavigate();
  const { hasCompletedOnboarding } = useApp();

  useEffect(() => {
    // Simulate initial backend initialization check
    const timer = setTimeout(() => {
      if (hasCompletedOnboarding) {
        navigate('/dashboard');
      } else {
        navigate('/welcome');
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, navigate]);

  return (
    <div className="h-screen w-screen bg-[#06101F] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute w-[500px] h-[500px] bg-[#3478F6]/10 rounded-full blur-[120px] pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -bottom-20 -right-20"></div>

      {/* Main Logo Card */}
      <div className="flex flex-col items-center text-center z-10 animate-scaleUp">
        <div className="w-16 h-16 rounded-2xl bg-[#3478F6]/15 border border-[#3478F6]/30 flex items-center justify-center text-[#38BDF8] shadow-xl shadow-blue-900/30 mb-6">
          <Brain className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight mb-1.5">
          MEMORA <span className="text-[#38BDF8] font-mono">AI</span>
        </h1>
        <p className="text-xs font-medium text-[#A7B7D0] max-w-sm mb-7">
          Intelligent Local Digital Memory Assistant
        </p>

        {/* Loading Spinner & Status */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#0A1629] border border-[rgba(139,170,215,0.18)] text-xs text-[#DCE5F3] shadow-lg shadow-black/40">
          <Cpu className="w-4 h-4 text-[#38BDF8] animate-spin" />
          <span>Initializing local vector database & embedding pipeline...</span>
        </div>

        {/* Local Privacy Pledge */}
        <div className="flex items-center gap-2 mt-10 text-[11px] text-[#7E93B3] font-medium font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% Offline • Zero Data Upload • Hardware Privacy Guaranteed</span>
        </div>
      </div>
    </div>
  );
};
