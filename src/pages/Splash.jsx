import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ShieldCheck } from 'lucide-react';
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
        {/* Full Memora AI logo — wordmark + tagline included in image */}
        <img
          src="/memora-ai-logo.png"
          alt="Memora AI — Your Files • Smarter • Always"
          className="w-56 h-56 object-contain mb-4 drop-shadow-2xl"
          draggable={false}
        />

        {/* Loading Spinner & Status */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#0A1629] border border-[rgba(139,170,215,0.18)] text-xs text-[#DCE5F3] shadow-lg shadow-black/40">
          <Cpu className="w-4 h-4 text-[#38BDF8] animate-spin" />
          <span>Starting up Memora...</span>
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
