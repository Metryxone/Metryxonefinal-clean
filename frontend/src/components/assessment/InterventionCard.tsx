import React from 'react';

export interface InterventionCardProps {
  title: string;
  why: string;
  action: string;
  difficulty: string;
  timeline: string;
  position?: number;
  successMarker?: string;
  resistancePrediction?: string;
  phaseLabel?: string;
  className?: string;
}

const DIFFICULTY_STYLES: Record<string, { bg: string; col: string; bdr: string }> = {
  low:    { bg: '#ECFDF5', col: '#065F46', bdr: '#A7F3D0' },
  medium: { bg: '#FFFBEB', col: '#92400E', bdr: '#FDE68A' },
  high:   { bg: '#FEF2F2', col: '#991B1B', bdr: '#FECACA' },
};

function difficultyStyle(difficulty: string) {
  const key = difficulty?.toLowerCase().split('-')[0] ?? 'medium';
  return DIFFICULTY_STYLES[key] ?? DIFFICULTY_STYLES.medium;
}

export function InterventionCard({
  title, why, action, difficulty, timeline,
  position, successMarker, resistancePrediction, phaseLabel, className = '',
}: InterventionCardProps) {
  const ds = difficultyStyle(difficulty);
  const posCol = position === 1 ? '#059669' : position === 2 ? '#2563EB' : '#7C3AED';

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: '#fff', border: '1px solid #E8EBF4' }}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 flex items-start gap-3" style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFBFF' }}>
        {position !== undefined && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white" style={{ background: posCol }}>
            {position}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {phaseLabel && (
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: posCol }}>{phaseLabel}</p>
          )}
          <p className="text-[13px] font-bold leading-snug" style={{ color: '#111827', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>{title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: ds.bg, color: ds.col, border: `1px solid ${ds.bdr}` }}>
            {difficulty}
          </span>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#EEF2FA', color: '#344E86' }}>
            {timeline}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Why it works */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#6B7280' }}>Why This Works</p>
          <p className="text-[11px] leading-snug" style={{ color: '#374151' }}>{why}</p>
        </div>

        {/* Action */}
        <div className="p-2.5 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#2563EB' }}>The Action</p>
          <p className="text-[11px] leading-snug" style={{ color: '#1E40AF' }}>{action}</p>
        </div>

        {/* Success marker */}
        {successMarker && (
          <div className="flex items-start gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#ECFDF5' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} />
            </div>
            <p className="text-[10px] leading-snug" style={{ color: '#059669' }}><span className="font-bold">Success signal:</span> {successMarker}</p>
          </div>
        )}

        {/* Resistance prediction */}
        {resistancePrediction && (
          <div className="flex items-start gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#FEF2F2' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#DC2626' }} />
            </div>
            <p className="text-[10px] leading-snug" style={{ color: '#DC2626' }}><span className="font-bold">Expected resistance:</span> {resistancePrediction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
