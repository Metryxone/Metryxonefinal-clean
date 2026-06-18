import React from 'react';

export type InsightCardSeverity = 'low' | 'medium' | 'high';

export interface InsightCardProps {
  title: string;
  summary: string;
  details: string;
  severity?: InsightCardSeverity;
  icon?: React.ReactNode;
  className?: string;
}

const SEVERITY_STYLES: Record<InsightCardSeverity, { border: string; bg: string; badge: string; badgeText: string; dot: string }> = {
  low:    { border: '#A7F3D0', bg: '#ECFDF5', badge: '#D1FAE5', badgeText: '#065F46', dot: '#059669' },
  medium: { border: '#FDE68A', bg: '#FFFBEB', badge: '#FEF3C7', badgeText: '#92400E', dot: '#D97706' },
  high:   { border: '#FECACA', bg: '#FEF2F2', badge: '#FEE2E2', badgeText: '#991B1B', dot: '#DC2626' },
};

export function InsightCard({ title, summary, details, severity, icon, className = '' }: InsightCardProps) {
  const s = severity ? SEVERITY_STYLES[severity] : null;

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: s?.bg ?? '#fff',
        border: `1px solid ${s?.border ?? '#E8EBF4'}`,
      }}
    >
      <div className="px-4 pt-3.5 pb-3 flex items-start gap-3" style={{ borderBottom: `1px solid ${s?.border ?? '#F3F4F6'}` }}>
        {icon && (
          <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: s?.badge ?? '#EEF2FA' }}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {s && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />}
            <p className="text-[13px] font-bold leading-tight" style={{ color: '#111827', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>{title}</p>
            {severity && (
              <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0" style={{ background: s!.badge, color: s!.badgeText }}>
                {severity}
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium" style={{ color: s?.badgeText ?? '#374151' }}>{summary}</p>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>{details}</p>
      </div>
    </div>
  );
}
