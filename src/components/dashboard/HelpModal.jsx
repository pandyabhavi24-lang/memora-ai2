import React, { useEffect } from 'react';
import {
  HelpCircle,
  X,
  Mail,
  Sparkles,
  CheckCircle2,
  Search,
  Folder,
  Users,
  Image as ImageIcon,
  FileText,
  CalendarClock,
  ShieldCheck,
  HardDrive,
  FolderSearch
} from 'lucide-react';
import { Button } from '../common/Button';

export const SUPPORT_EMAIL = 'support@memora.ai';

const FEATURES = [
  {
    icon: Search,
    color: 'text-[#4B91FF]',
    bg: 'bg-[#3478F6]/10',
    border: 'border-[#3478F6]/25',
    title: 'Find Your Files',
    desc: 'Search using a file name or describe what you remember about a document. Filter by file type, date, or size without needing exact words.',
  },
  {
    icon: Folder,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    title: 'Manage Your Folders',
    desc: 'Choose the folders Memora can work with. Your files never leave your device — everything is read and processed locally.',
  },
  {
    icon: FolderSearch,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    title: 'Find Duplicates & Similar Files',
    desc: 'Identify duplicate documents and discover files that look alike or contain related content, all from the Organization module.',
  },
  {
    icon: Sparkles,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    title: 'Organize Your Files',
    desc: 'Get AI-powered category and tag suggestions. Accept, edit, or reject each one before any files are moved or copied.',
  },
  {
    icon: ImageIcon,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    title: 'Explore & Compare Images',
    desc: 'Find visually similar images, inspect file details, manage visual groups, and upload a reference image to find similar media in your library.',
  },
  {
    icon: FileText,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    title: 'Work with PDFs',
    desc: 'Create PDFs from scratch or from images, add text and images to pages, reorder or rotate pages, and export as PDF, PNG, or JPG.',
  },
  {
    icon: CalendarClock,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/25',
    title: 'Track Important Dates',
    desc: 'Keep track of document expiry dates. Review what\'s upcoming, due soon, or expired, and toggle per-document reminders on or off.',
  },
  {
    icon: ShieldCheck,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/25',
    title: 'Protect Your Files & Privacy',
    desc: 'Set a PIN to lock the app, exclude folders from scanning, encrypt individual files, manage backups, and review the security audit log.',
  },
  {
    icon: HardDrive,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    title: 'Save Storage Space',
    desc: 'Browse large files, compress images in lossless or lossy mode, and create ZIP archives — all with your review before any changes are made.',
  },
];

const STEPS = [
  {
    num: '1',
    color: 'text-[#4B91FF]',
    title: 'Choose Your Folders',
    desc: 'Select the folders you want Memora to work with. Only those folders will be scanned.',
  },
  {
    num: '2',
    color: 'text-purple-400',
    title: 'Find & Explore',
    desc: 'Search for files, explore images, or open a module for the task you need.',
  },
  {
    num: '3',
    color: 'text-emerald-400',
    title: 'Review Before Acting',
    desc: 'Check suggestions and selected actions carefully before making any changes to your files.',
  },
];

export const HelpModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="glass-panel w-full max-w-lg rounded-3xl border border-[rgba(139,170,215,0.22)] bg-[#0A1629] text-[#F4F7FF] shadow-2xl relative flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sticky Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[rgba(139,170,215,0.14)] px-6 pt-6 pb-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#3478F6]/15 border border-[#3478F6]/30 flex items-center justify-center text-[#4B91FF] shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B91FF]">Help &amp; Support</span>
              <h2 id="help-modal-title" className="text-lg font-extrabold text-[#F4F7FF] tracking-tight leading-none mt-0.5">
                Memora AI Assistance
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#0E1D35] hover:bg-[#132642] text-[#A7B7D0] hover:text-[#F4F7FF] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close Help Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable Body ─────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 custom-scrollbar px-6 py-5 space-y-5">

          {/* Section 1: What can I do? */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4B91FF]" />
              What can I do with Memora AI?
            </h3>
            <ul className="space-y-1.5">
              {FEATURES.map(({ icon: Icon, color, bg, border, title, desc }) => (
                <li
                  key={title}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#0E1D35] border border-[rgba(139,170,215,0.12)]"
                >
                  <div className={`w-7 h-7 rounded-lg ${bg} border ${border} flex items-center justify-center ${color} shrink-0 mt-0.5`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-[#A7B7D0] leading-relaxed">
                    <strong className="text-[#F4F7FF] font-semibold">{title}</strong>
                    {' — '}
                    {desc}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 2: Quick Guide */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#A7B7D0] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Quick Guide
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {STEPS.map(({ num, color, title, desc }) => (
                <div
                  key={num}
                  className="p-2.5 rounded-xl bg-[#0E1D35] border border-[rgba(139,170,215,0.12)] space-y-0.5"
                >
                  <span className={`text-[10px] font-bold font-mono ${color}`}>Step {num} — {title}</span>
                  <p className="text-[#A7B7D0] text-[11px] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Need Help */}
          <div className="p-3.5 rounded-2xl bg-[#0E1D35] border border-[#3478F6]/30 space-y-2.5">
            <div>
              <h4 className="text-xs font-bold text-[#4B91FF]">Need Help?</h4>
              <p className="text-[11px] text-[#A7B7D0] mt-0.5">
                If something isn't working or you need assistance with a feature, our team is available.
              </p>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Memora%20AI%20Support%20Request`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-[#3478F6] hover:bg-[#4B91FF] text-white font-semibold text-xs transition-colors shadow-md cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Support ({SUPPORT_EMAIL})</span>
            </a>
          </div>

        </div>

        {/* ── Sticky Footer ───────────────────────────────────── */}
        <div className="flex justify-end px-6 py-4 border-t border-[rgba(139,170,215,0.14)] shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
