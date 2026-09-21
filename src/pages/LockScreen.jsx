import React, { useState, useRef, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * LockScreen — shown when application lock is enabled and session is not authenticated.
 * PIN is entered locally and verified against the backend.
 * The session token returned from the backend is stored only in React state.
 */
export const LockScreen = () => {
  const { authenticate, addToast } = useApp();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Countdown display when locked out
  useEffect(() => {
    if (lockoutSeconds > 0) {
      timerRef.current = setInterval(() => {
        setLockoutSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lockoutSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin || isLoading || lockoutSeconds > 0) return;

    setIsLoading(true);
    setError('');

    const result = await authenticate(pin);

    setIsLoading(false);
    setPin(''); // Always clear the PIN field

    if (result.success) {
      addToast('Application unlocked.', 'success');
    } else {
      if (result.lockoutSeconds && result.lockoutSeconds > 0) {
        setLockoutSeconds(Math.ceil(result.lockoutSeconds));
        setError(`Too many failed attempts. Try again in ${Math.ceil(result.lockoutSeconds)}s.`);
      } else {
        setError('Incorrect PIN. Please try again.');
      }
      inputRef.current?.focus();
    }
  };

  const isDisabled = isLoading || lockoutSeconds > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0f19] select-none">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo / branding */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">MEMORA <span className="text-blue-400">AI</span></h1>
          <p className="text-sm text-gray-400 mt-1">Enter your PIN to unlock</p>
        </div>

        {/* PIN form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <Shield className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                id="lock-screen-pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                disabled={isDisabled}
                maxLength={32}
                autoComplete="off"
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error / lockout message */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{lockoutSeconds > 0 ? `Locked out — try again in ${lockoutSeconds}s` : error}</span>
            </div>
          )}

          <button
            id="lock-screen-unlock-btn"
            type="submit"
            disabled={isDisabled || !pin}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
          >
            {isLoading ? 'Verifying…' : lockoutSeconds > 0 ? `Wait ${lockoutSeconds}s` : 'Unlock'}
          </button>
        </form>

        {/* Privacy badge */}
        <p className="mt-8 text-center text-xs text-gray-600">
          100% offline · No cloud · All data is local
        </p>
      </div>
    </div>
  );
};
