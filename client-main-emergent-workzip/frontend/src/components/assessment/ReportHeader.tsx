import React from 'react';

export interface ReportHeaderProps {
  title: string;
  summary: string;
  stage: string;
  score?: number;
  participantName?: string;
  generatedAt?: string;
  reportVersion?: string;
  reliabilityScore?: number;
  className?: string;
}

const STAGE_META: Record<string, { label: string; color: string; bg: string; bdr: string }> = {
  CAP_CUR: { label: 'Curiosity',  color: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE' },
  CAP_INS: { label: 'Insight',    color: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' },
  CAP_GRW: { label: 'Growth',     color: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' },
  CAP_MAS: { label: 'Mastery',    color: '#344E86', bg: '#EEF2FA', bdr: '#D4DBF0' },
};

export function ReportHeader({
  title, summary, stage, score, participantName, generatedAt,
  reportVersion, reliabilityScore, className = '',
}: ReportHeaderProps) {
  const sm = STAGE_META[stage] ?? STAGE_META.CAP_CUR;
  const scoreColor = score !== undefined
    ? score >= 80 ? '#344E86' : score >= 60 ? '#2563EB' : score >= 40 ? '#D97706' : '#DC2626'
    : '#344E86';
  const dateStr = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ background: '#fff', border: '1px solid #E8EBF4' }}>
      {/* Stage accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${sm.color}, ${sm.color}80)` }} />

      <div className="px-5 pt-4 pb-4">
        {/* Stage badge + date row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: sm.bg, border: `1px solid ${sm.bdr}` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: sm.color }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: sm.color }}>{sm.label} Stage</span>
          </div>
          <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{dateStr}</span>
        </div>

        {/* Title */}
        <p className="text-[20px] font-black leading-tight mb-1" style={{ color: '#111827', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", letterSpacing: '-0.01em' }}>
          {title}
        </p>

        {/* Summary */}
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#4B5563' }}>{summary}</p>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {score !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: scoreColor }} />
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{score}/100</span>
            </div>
          )}
          {participantName && (
            <span className="text-[11px]" style={{ color: '#6B7280' }}>Prepared for <span className="font-semibold" style={{ color: '#374151' }}>{participantName}</span></span>
          )}
          {reportVersion && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>v{reportVersion}</span>
          )}
          {reliabilityScore !== undefined && (
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: reliabilityScore >= 0.8 ? '#059669' : reliabilityScore >= 0.6 ? '#D97706' : '#DC2626' }} />
              <span className="text-[9px] font-semibold" style={{ color: '#6B7280' }}>{Math.round(reliabilityScore * 100)}% reliability</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
