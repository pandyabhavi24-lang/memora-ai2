import React from 'react';
import { Files, Lightbulb, ShieldCheck, Copy } from 'lucide-react';

export const OrganizationSummary = ({
  filesAnalyzed = 24,
  suggestionsCount = 18,
  highConfidenceCount = 14,
  duplicatesCount = 3
}) => {
  const cards = [
    {
      id: 'analyzed',
      label: 'Files Analyzed',
      value: filesAnalyzed,
      icon: Files,
      bgColor: 'bg-[rgba(52,120,246,0.12)]',
      borderColor: 'border-[rgba(52,120,246,0.25)]',
      iconColor: 'text-[#4B91FF]',
      subtext: 'Scanned from monitored paths'
    },
    {
      id: 'suggestions',
      label: 'Suggestions',
      value: suggestionsCount,
      icon: Lightbulb,
      bgColor: 'bg-[rgba(117,102,246,0.12)]',
      borderColor: 'border-[rgba(117,102,246,0.25)]',
      iconColor: 'text-[#7566F6]',
      subtext: 'Organization suggestions'
    },
    {
      id: 'high-confidence',
      label: 'High Confidence',
      value: highConfidenceCount,
      icon: ShieldCheck,
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
      subtext: '> 90% confidence score'
    },
    {
      id: 'duplicates',
      label: 'Possible Duplicates',
      value: duplicatesCount,
      icon: Copy,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      iconColor: 'text-amber-400',
      subtext: 'Candidate duplicate groups'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="p-4 rounded-2xl border border-[rgba(139,170,215,0.14)] bg-[#0A1629] hover:border-[rgba(139,170,215,0.28)] transition-all duration-150 flex flex-col justify-between shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#71839E] uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-8 h-8 rounded-xl ${card.bgColor} ${card.borderColor} border flex items-center justify-center ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#F4F7FF] font-mono tracking-tight mb-0.5">
                {card.value}
              </div>
              <p className="text-[11px] text-[#A7B7D0] font-normal">
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
