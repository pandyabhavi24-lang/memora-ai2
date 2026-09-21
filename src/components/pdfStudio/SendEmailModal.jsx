import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Mail, 
  Send, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Lock, 
  ExternalLink,
  LogOut,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { apiService } from '../../services/apiService';

export const SendEmailModal = ({
  isOpen,
  onClose,
  pdfPath = null,
  pdfTitle = 'Document.pdf',
  onVerifyAndExport = null,
  addToast = () => {}
}) => {
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState(`PDF Document: ${pdfTitle}`);
  const [message, setMessage] = useState('Please find attached the PDF document generated with Memora AI PDF Studio.');
  const [isSending, setIsSending] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Gmail OAuth status state
  // { configured: bool, connected: bool, email: string|null, status: 'connected'|'not_connected'|'reconnect_required'|'unconfigured', message: string }
  const [authStatus, setAuthStatus] = useState({ configured: false, connected: false, email: null, status: 'not_connected' });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const checkAuthStatus = async () => {
    try {
      const res = await apiService.getEmailStatus();
      setAuthStatus(res);
      return res;
    } catch (err) {
      console.warn('Email status check notice:', err);
      setAuthStatus({ configured: false, connected: false, email: null, status: 'not_connected' });
      return null;
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsCheckingAuth(true);
      checkAuthStatus();
      if (pdfTitle) {
        setSubject(`PDF Document: ${pdfTitle}`);
      }

      // Listen for message event from OAuth popup/redirect callback window
      const handleMessage = (event) => {
        if (event.data && event.data.type === 'GMAIL_AUTH_SUCCESS') {
          addToast(`Gmail connected: ${event.data.email || 'Authorized'}!`, 'success');
          checkAuthStatus();
        }
      };
      window.addEventListener('message', handleMessage);

      // Polling check every 2.5s while modal is open if not connected
      const pollInterval = setInterval(() => {
        if (!authStatus.connected) {
          checkAuthStatus();
        }
      }, 2500);

      return () => {
        window.removeEventListener('message', handleMessage);
        clearInterval(pollInterval);
      };
    }
  }, [isOpen, pdfTitle]);

  const handleConnectGmail = async () => {
    try {
      const res = await apiService.getEmailAuthUrl();
      if (res.auth_url) {
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(res.auth_url);
        } else {
          window.open(res.auth_url, '_blank', 'width=650,height=750');
        }
        addToast('Opening Google OAuth in system browser...', 'info');
      } else {
        addToast(res.message || 'Gmail OAuth Client credentials not configured on backend.', 'warning');
      }
    } catch (err) {
      console.error('Error fetching Gmail auth URL:', err);
      addToast(`OAuth Configuration Notice: ${err.message}`, 'error');
    }
  };

  const handleDisconnectGmail = async () => {
    setIsDisconnecting(true);
    try {
      const res = await apiService.disconnectEmail();
      addToast(res.message || 'Disconnected Gmail account.', 'info');
      await checkAuthStatus();
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
      addToast(`Disconnect Error: ${err.message}`, 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!toEmail || !toEmail.includes('@')) {
      addToast('Please enter a valid recipient email address.', 'warning');
      return;
    }

    if (!authStatus.connected) {
      if (authStatus.status === 'reconnect_required') {
        addToast('Gmail authorization has expired. Please click Reconnect Gmail.', 'warning');
      } else {
        addToast('Please connect your Gmail account via Google OAuth first.', 'warning');
      }
      return;
    }

    setIsSending(true);

    try {
      let activePdfPath = pdfPath;
      if (!activePdfPath && onVerifyAndExport) {
        activePdfPath = await onVerifyAndExport();
      }

      if (!activePdfPath) {
        throw new Error('No verified PDF document available to send.');
      }

      const res = await apiService.sendPDFEmail({
        to: toEmail,
        subject,
        message,
        pdf_path: activePdfPath
      });

      addToast(res.message || `PDF successfully delivered to ${toEmail} via Gmail API!`, 'success');
      onClose();
    } catch (err) {
      console.error('Email delivery error:', err);
      addToast(`Gmail Error: ${err.message || 'Failed to deliver PDF via Gmail API.'}`, 'error');
      // Re-verify auth status in case token was revoked
      checkAuthStatus();
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send PDF via Email"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSend} className="space-y-4">
        {/* Gmail OAuth Connection Header Banner */}
        {isCheckingAuth ? (
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Checking Gmail OAuth connection...
            </span>
          </div>
        ) : authStatus.connected ? (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-medium text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Gmail Account Connected (gmail.send)</span>
              </div>
              <Badge variant="success" size="sm">Active</Badge>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-500/20 text-xs">
              <div className="flex items-center gap-1.5 text-gray-300 truncate">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-[11px] truncate text-emerald-200">
                  {authStatus.email || 'Authenticated User'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleDisconnectGmail}
                disabled={isDisconnecting}
                className="text-[11px] text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Disconnect this Google account"
              >
                {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : authStatus.status === 'reconnect_required' ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Gmail Authorization Expired
              </span>
              <Badge variant="amber" size="sm">Expired</Badge>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Your Google OAuth authorization token has expired or was revoked. Reconnect your account to continue sending PDFs.
            </p>
            <button
              type="button"
              onClick={handleConnectGmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect Gmail</span>
            </button>
          </div>
        ) : !authStatus.configured ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                Google OAuth Credentials Required
              </span>
              <Badge variant="amber" size="sm">Unconfigured</Badge>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              To send emails via Gmail, configure <strong>GOOGLE_CLIENT_ID</strong> & <strong>GOOGLE_CLIENT_SECRET</strong> in <code>backend/.env</code> or place <code>credentials.json</code> in the <code>backend/</code> folder.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-400" />
                Connect Your Gmail Account
              </span>
              <Badge variant="blue" size="sm">OAuth 2.0</Badge>
            </div>
            <p className="text-[11px] text-blue-200/80 leading-relaxed">
              Authorize your own Google account via standard OAuth (minimum <code>gmail.send</code> scope). Each user authenticates individually with no hardcoded credentials.
            </p>
            <button
              type="button"
              onClick={handleConnectGmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-md shadow-blue-500/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Connect Gmail Account</span>
            </button>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              To (Recipient Email) <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Message Body</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add an optional message..."
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* PDF Attachment Verification Card */}
          <div className="p-3 rounded-xl bg-gray-950/80 border border-gray-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-gray-200 font-semibold truncate block">{pdfTitle}</span>
                <span className="text-[10px] text-gray-500 block font-mono">Attachment: Verified PDF Document</span>
              </div>
            </div>
            <Badge variant="blue" size="sm">PDF</Badge>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800/60">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={isSending ? Loader2 : Send}
            type="submit"
            disabled={isSending || !authStatus.connected}
            className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            {isSending ? 'Sending...' : 'Send PDF via Gmail'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
