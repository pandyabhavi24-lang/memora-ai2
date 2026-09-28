import React, { useState, useRef, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, AlertTriangle, Mail, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { securityService } from '../services/securityService';

/**
 * LockScreen Component (Module 5)
 * Handles:
 *   1. First-time PIN setup (when no PIN exists)
 *   2. PIN authentication (normal unlock)
 *   3. Forgot PIN workflow (recovery email -> 6-digit reset code -> new PIN)
 */
export const LockScreen = () => {
  const { hasPin, authenticate, setSessionToken, setIsAuthenticated, refreshSecuritySettings, addToast } = useApp();

  // Mode: 'setup' | 'unlock' | 'forgot_email' | 'forgot_code' | 'forgot_new_pin'
  const [mode, setMode] = useState(hasPin ? 'unlock' : 'setup');

  // Input states
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  // UI states
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!hasPin) {
      setMode('setup');
    } else if (mode === 'setup' && hasPin) {
      setMode('unlock');
    }
  }, [hasPin]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  // Countdown timer when locked out
  useEffect(() => {
    if (lockoutSeconds > 0) {
      timerRef.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutSeconds]);

  // 1. Handle First-Time PIN Setup
  const handleFirstTimeSetup = async (e) => {
    e.preventDefault();
    setError('');
    if (pin.length < 4) {
      setError('PIN must be at least 4 characters long.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    if (!recoveryEmail || !recoveryEmail.includes('@') || !recoveryEmail.includes('.')) {
      setError('A valid recovery email address is required.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await securityService.setPin(pin, null, recoveryEmail.trim());
      if (res.session_token) {
        setSessionToken(res.session_token);
        setIsAuthenticated(true);
      }
      addToast('PIN and recovery email configured successfully.', 'success');
      await refreshSecuritySettings();
    } catch (err) {
      setError(err.message || 'Failed to create PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Normal PIN Unlock
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    if (!pin || isLoading || lockoutSeconds > 0) return;

    setIsLoading(true);
    setError('');

    const result = await authenticate(pin);

    setIsLoading(false);
    setPin('');

    if (result.success) {
      addToast('Application unlocked.', 'success');
    } else {
      if (result.lockoutSeconds && result.lockoutSeconds > 0) {
        setLockoutSeconds(Math.ceil(result.lockoutSeconds));
        setError(`Too many failed attempts. Try again in ${Math.ceil(result.lockoutSeconds)}s.`);
      } else {
        setError(result.error || 'Incorrect PIN. Please try again.');
      }
      inputRef.current?.focus();
    }
  };

  // 3. Handle Send Reset Code (Forgot PIN)
  const handleSendResetCode = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!recoveryEmail || !recoveryEmail.includes('@') || !recoveryEmail.includes('.')) {
      setError('Please enter a valid recovery email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await securityService.forgotPin(recoveryEmail.trim());
      setInfoMessage(res.message || 'If the recovery email is configured, a reset code has been sent.');
      setMode('forgot_code');
    } catch (err) {
      setError(err.message || 'Unable to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Verify Reset Code
  const handleVerifyResetCode = async (e) => {
    e.preventDefault();
    setError('');

    if (!resetCode || resetCode.trim().length !== 6) {
      setError('Please enter the full 6-digit reset code.');
      return;
    }

    setIsLoading(true);
    try {
      await securityService.verifyResetCode(resetCode.trim());
      setMode('forgot_new_pin');
    } catch (err) {
      setError(err.message || 'Invalid or expired reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Reset PIN Submit
  const handleResetPinSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPin.length < 4) {
      setError('New PIN must be at least 4 characters long.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setError('New PINs do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await securityService.resetPin(resetCode.trim(), newPin);
      addToast('PIN reset successfully. Please enter your new PIN to unlock.', 'success');
      setMode('unlock');
      setPin('');
      setNewPin('');
      setConfirmNewPin('');
      setResetCode('');
      setError('');
      setInfoMessage('');
    } catch (err) {
      setError(err.message || 'Failed to reset PIN. Please try requesting a new code.');
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || lockoutSeconds > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0f19] select-none">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo / branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            MEMORA <span className="text-blue-400">AI</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'setup' && 'Secure your Memora'}
            {mode === 'unlock' && 'Enter your PIN to unlock'}
            {mode === 'forgot_email' && 'Forgot your PIN?'}
            {mode === 'forgot_code' && 'Enter Reset Code'}
            {mode === 'forgot_new_pin' && 'Create New PIN'}
          </p>
        </div>

        {/* ===================================================================
            STATE 1: FIRST-TIME PIN SETUP
           =================================================================== */}
        {mode === 'setup' && (
          <form onSubmit={handleFirstTimeSetup} className="space-y-4">
            <div className="text-xs font-semibold text-gray-300 mb-1">Create your PIN</div>

            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <Shield className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                id="setup-new-pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="New PIN (min 4 chars)"
                minLength={4}
                maxLength={32}
                required
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="text-gray-500 hover:text-gray-300"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <Shield className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                id="setup-confirm-pin"
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm PIN"
                maxLength={32}
                required
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
            </div>

            <div className="pt-2">
              <div className="text-xs font-semibold text-gray-300 mb-1">Recovery Email</div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  id="setup-recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="setup-submit-btn"
              type="submit"
              disabled={isLoading || !pin || !confirmPin || !recoveryEmail}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
            >
              {isLoading ? 'Creating PIN…' : 'Create PIN & Continue'}
            </button>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed mt-2">
              Your PIN is securely protected and cannot be viewed later.
              A recovery email is required if you forget your PIN.
            </p>
          </form>
        )}

        {/* ===================================================================
            STATE 2: NORMAL UNLOCK SCREEN
           =================================================================== */}
        {mode === 'unlock' && (
          <form onSubmit={handleUnlockSubmit} className="space-y-4">
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
                  onClick={() => setShowPin((v) => !v)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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

            <div className="text-center pt-2">
              <button
                type="button"
                id="forgot-pin-btn"
                onClick={() => {
                  setError('');
                  setInfoMessage('');
                  setMode('forgot_email');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Forgot PIN?
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================
            STATE 3: FORGOT PIN — STEP 1: RECOVERY EMAIL
           =================================================================== */}
        {mode === 'forgot_email' && (
          <form onSubmit={handleSendResetCode} className="space-y-4">
            <p className="text-xs text-gray-400 mb-2">
              Enter your recovery email to receive a 6-digit reset code:
            </p>

            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <Mail className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                id="forgot-email-input"
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="Enter recovery email"
                required
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="send-reset-code-btn"
              type="submit"
              disabled={isLoading || !recoveryEmail}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
            >
              {isLoading ? 'Sending Code…' : 'Send Reset Code'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('unlock');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Unlock
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================
            STATE 4: FORGOT PIN — STEP 2: VERIFY RESET CODE
           =================================================================== */}
        {mode === 'forgot_code' && (
          <form onSubmit={handleVerifyResetCode} className="space-y-4">
            {infoMessage && (
              <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
                <span>{infoMessage}</span>
              </div>
            )}

            <p className="text-xs text-gray-400">
              Enter the 6-digit code sent to your recovery email:
            </p>

            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <KeyRound className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                id="reset-code-input"
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code (e.g. 123456)"
                maxLength={6}
                required
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm font-mono tracking-widest outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="verify-code-btn"
              type="submit"
              disabled={isLoading || resetCode.length !== 6}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
            >
              {isLoading ? 'Verifying Code…' : 'Verify Code'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('forgot_email');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Email
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================
            STATE 5: FORGOT PIN — STEP 3: CREATE NEW PIN
           =================================================================== */}
        {mode === 'forgot_new_pin' && (
          <form onSubmit={handleResetPinSubmit} className="space-y-4">
            <p className="text-xs text-gray-400">
              Code verified! Create your new PIN:
            </p>

            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <Shield className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                ref={inputRef}
                id="reset-new-pin"
                type={showPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New PIN (min 4 chars)"
                minLength={4}
                maxLength={32}
                required
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="text-gray-500 hover:text-gray-300"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-gray-900/80 border border-gray-700/80 focus-within:border-blue-500/60 transition-colors">
              <Shield className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                id="reset-confirm-new-pin"
                type={showPin ? 'text' : 'password'}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value)}
                placeholder="Confirm New PIN"
                maxLength={32}
                required
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="reset-pin-submit-btn"
              type="submit"
              disabled={isLoading || !newPin || !confirmNewPin}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
            >
              {isLoading ? 'Resetting PIN…' : 'Reset PIN'}
            </button>
          </form>
        )}

        {/* Privacy note */}
        <p className="mt-8 text-center text-xs text-gray-600 leading-relaxed px-2">
          Email recovery requires sending a one-time reset code to your configured recovery email. Your files, OCR data, embeddings, search data and audit data are not sent.
        </p>
      </div>
    </div>
  );
};
