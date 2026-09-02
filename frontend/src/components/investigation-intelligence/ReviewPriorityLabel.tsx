import React from 'react';

interface ReviewPriorityLabelProps {
  tier: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_ROUTINE' | string;
  score?: number;
  showScore?: boolean;
}

export const ReviewPriorityLabel: React.FC<ReviewPriorityLabelProps> = ({
  tier,
  score,
  showScore = true,
}) => {
  let badgeColor = 'bg-slate-700/60 text-slate-300 border-slate-600';
  let dotColor = 'bg-slate-400';
  let labelText = 'Suggested Review: P2 Routine';

  if (tier === 'P0_CRITICAL' || tier === 'P0') {
    badgeColor = 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse';
    dotColor = 'bg-red-500';
    labelText = 'Suggested Review: P0 Critical';
  } else if (tier === 'P1_HIGH' || tier === 'P1') {
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-500';
    labelText = 'Suggested Review: P1 High Priority';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeColor}`}
      title="Suggested review priority / Requires investigator assessment"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{labelText}</span>
      {showScore && score !== undefined && (
        <span className="opacity-80 font-mono">({score.toFixed(2)})</span>
      )}
    </span>
  );
};
