import React, { useState, useEffect } from 'react';
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
  ExternalLink 
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
  const [message, setMessage] = useState('Please find the attached PDF document generated with Memora AI PDF Studio.');
  const [isSending, setIsSending] = useState(false);

  // Gmail OAuth status state
  const [authStatus, setAuthStatus] = useState({ configured: false, connected: false });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const checkAuthStatus = async () => {
    setIsCheckingAuth(true);
    try {
      const res = await apiService.getEmailStatus();
      setAuthStatus(res);
    } catch (err) {
      console.warn('Email status check notice:', err);
      setAuthStatus({ configured: false, connected: false });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkAuthStatus();
      if (pdfTitle) {
        setSubject(`PDF Document: ${pdfTitle}`);
      }
    }
  }, [isOpen, pdfTitle]);

  const handleConnectGmail = async () => {
    try {
      const res = await apiService.getEmailAuthUrl();
      if (res.auth_url) {
        window.open(res.auth_url, '_blank', 'width=600,height=700');
      } else {
        addToast(res.message || 'Gmail OAuth Client credentials not configured on backend.', 'warning');
      }
    } catch (err) {
      console.error('Error fetching Gmail auth URL:', err);
      addToast(`OAuth Configuration Notice: ${err.message}`, 'error');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!toEmail || !toEmail.includes('@')) {
      addToast('Please enter a valid recipient email address.', 'warning');
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

      addToast(res.message || `PDF successfully emailed to ${toEmail}!`, 'success');
      onClose();
    } catch (err) {
      console.error('Email sending error:', err);
      addToast(`Email Error: ${err.message || 'Failed to send PDF via Gmail API.'}`, 'error');
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
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Gmail API Connected (gmail.send scope)</span>
            </div>
            <Badge variant="success" size="sm">Connected</Badge>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                Gmail Account Authorization Required
              </span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Connect your Gmail account using Google OAuth 2.0 to deliver PDFs directly from backend.
            </p>
            <button
              type="button"
              onClick={handleConnectGmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer"
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
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
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
            <label className="block text-gray-300 font-semibold mb-1">Message</label>
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
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Send PDF'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
