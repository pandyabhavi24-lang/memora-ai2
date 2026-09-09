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
    <div className="h-screen w-screen bg-[#0b0f19] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -bottom-20 -right-20"></div>

      {/* Main Logo Card */}
      <div className="flex flex-col items-center text-center z-10 animate-scaleUp">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 mb-6 border border-blue-400/30 animate-pulse">
          <Brain className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-black text-white tracking-wider mb-2">
          MEMORA <span className="text-gradient">AI</span>
        </h1>
        <p className="text-sm font-medium text-gray-400 max-w-sm mb-8">
          Intelligent Local Digital Memory Assistant
        </p>

        {/* Loading Spinner & Status */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-full glass-panel border-gray-700/60 text-xs text-gray-300">
          <Cpu className="w-4 h-4 text-blue-400 animate-spin" />
          <span>Initializing local vector database & embedding models...</span>
        </div>

        {/* Local Privacy Pledge */}
        <div className="flex items-center gap-2 mt-12 text-[11px] text-gray-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% Offline • Zero Data Upload • Hardware Privacy Guaranteed</span>
        </div>
      </div>
    </div>
  );
};
