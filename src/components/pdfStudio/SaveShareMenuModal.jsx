import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { 
  Save, 
  Mail, 
  Send, 
  Share2, 
  CheckCircle2, 
  FileText, 
  Download 
} from 'lucide-react';

export const SaveShareMenuModal = ({
  isOpen,
  onClose,
  pdfPath = null,
  pdfTitle = 'Document.pdf',
  onSavePDF,
  onOpenEmail,
  onOpenWhatsApp
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save / Share PDF"
      maxWidth="max-w-md"
    >
      <div className="space-y-5 text-xs">
        {/* Verification Success Card */}
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{pdfTitle}</h4>
            <p className="text-[11px] text-emerald-300/80">PDF compiled & verified physically on disk.</p>
          </div>
        </div>

        <p className="text-gray-400 text-xs">
          Choose an action to save the generated PDF locally or share it directly via Email or WhatsApp.
        </p>

        {/* Action Buttons Grid */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              if (onSavePDF) onSavePDF();
              onClose();
            }}
            className="w-full glass-panel p-3.5 rounded-xl border border-blue-500/30 hover:border-blue-500/60 bg-blue-600/10 hover:bg-blue-600/20 text-white font-semibold transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-white">Save PDF</span>
                <span className="block text-[10px] text-blue-300/70">Keep file at exported destination</span>
              </div>
            </div>
            <Badge variant="blue" size="sm">Save</Badge>
          </button>

          <button
            onClick={() => {
              onClose();
              if (onOpenEmail) onOpenEmail();
            }}
            className="w-full glass-panel p-3.5 rounded-xl border border-purple-500/30 hover:border-purple-500/60 bg-purple-600/10 hover:bg-purple-600/20 text-white font-semibold transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-white">Send via Email</span>
                <span className="block text-[10px] text-purple-300/70">Deliver via Gmail API (gmail.send)</span>
              </div>
            </div>
            <Badge variant="purple" size="sm">Gmail</Badge>
          </button>

          <button
            onClick={() => {
              onClose();
              if (onOpenWhatsApp) onOpenWhatsApp();
            }}
            className="w-full glass-panel p-3.5 rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-600/10 hover:bg-emerald-600/20 text-white font-semibold transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-white">Send via WhatsApp</span>
                <span className="block text-[10px] text-emerald-300/70">WhatsApp Business Cloud API</span>
              </div>
            </div>
            <Badge variant="emerald" size="sm">WhatsApp</Badge>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
