import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Send, 
  MessageSquare, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Phone 
} from 'lucide-react';
import { apiService } from '../../services/apiService';

export const SendWhatsAppModal = ({
  isOpen,
  onClose,
  pdfPath = null,
  pdfTitle = 'Document.pdf',
  onVerifyAndExport = null,
  addToast = () => {}
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [caption, setCaption] = useState(`Document: ${pdfTitle} (sent via Memora AI PDF Studio)`);
  const [isSending, setIsSending] = useState(false);

  // WhatsApp status state
  const [waStatus, setWaStatus] = useState({ configured: false, message: '' });
  const [isChecking, setIsChecking] = useState(true);

  const checkWhatsAppStatus = async () => {
    setIsChecking(true);
    try {
      const res = await apiService.getWhatsAppStatus();
      setWaStatus(res);
    } catch (err) {
      console.warn('WhatsApp status check notice:', err);
      setWaStatus({ configured: false, message: 'WhatsApp API status check failed.' });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkWhatsAppStatus();
      if (pdfTitle) {
        setCaption(`Document: ${pdfTitle} (sent via Memora AI PDF Studio)`);
      }
    }
  }, [isOpen, pdfTitle]);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!phoneNumber || phoneNumber.trim().length < 10) {
      addToast('Please enter a valid phone number with country code (e.g. +919876543210).', 'warning');
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

      const res = await apiService.sendPDFWhatsApp({
        phone_number: phoneNumber,
        pdf_path: activePdfPath,
        caption
      });

      if (res.status === 'unconfigured') {
        addToast(res.message || 'WhatsApp is not connected. Configure WhatsApp Business API.', 'warning');
      } else {
        addToast(res.message || `PDF successfully delivered to +${phoneNumber} via WhatsApp!`, 'success');
        onClose();
      }
    } catch (err) {
      console.error('WhatsApp delivery error:', err);
      addToast(`WhatsApp Error: ${err.message || 'Failed to deliver PDF document via WhatsApp Cloud API.'}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send PDF via WhatsApp"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSend} className="space-y-4">
        {/* WhatsApp Connection Configuration Banner */}
        {isChecking ? (
          <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              Checking WhatsApp Cloud API connection...
            </span>
          </div>
        ) : waStatus.configured ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>WhatsApp Business API Active</span>
            </div>
            <Badge variant="success" size="sm">Connected</Badge>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>WhatsApp Business API Unconfigured</span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              WhatsApp is not connected. Please set WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID in backend .env file.
            </p>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              Recipient Phone Number (with Country Code) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+919876543210"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Format: +[CountryCode][Number] (e.g., +91 98765 43210)</p>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Caption / Message</label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add document caption..."
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Attachment Preview */}
          <div className="p-3 rounded-xl bg-gray-950/80 border border-gray-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-gray-200 font-semibold truncate block">{pdfTitle}</span>
                <span className="text-[10px] text-gray-500 block font-mono">Attachment: Verified PDF Document</span>
              </div>
            </div>
            <Badge variant="emerald" size="sm">PDF</Badge>
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
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isSending ? 'Sending...' : 'Send PDF'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
