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
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      iconColor: 'text-blue-400',
      subtext: 'Scanned from active directory'
    },
    {
      id: 'suggestions',
      label: 'Suggestions',
      value: suggestionsCount,
      icon: Lightbulb,
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
      iconColor: 'text-indigo-400',
      subtext: 'Category plans generated'
    },
    {
      id: 'high-confidence',
      label: 'High Confidence',
      value: highConfidenceCount,
      icon: ShieldCheck,
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
      subtext: '> 90% confidence matches'
    },
    {
      id: 'duplicates',
      label: 'Possible Duplicates',
      value: duplicatesCount,
      icon: Copy,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      iconColor: 'text-amber-400',
      subtext: 'Candidate groups flagged'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="p-5 glass-panel rounded-2xl border border-slate-800/80 bg-slate-900/80 hover:bg-slate-800/50 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`w-9 h-9 rounded-xl ${card.bgColor} ${card.borderColor} border flex items-center justify-center ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-extrabold text-white font-mono tracking-tight mb-1">
                {card.value}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
