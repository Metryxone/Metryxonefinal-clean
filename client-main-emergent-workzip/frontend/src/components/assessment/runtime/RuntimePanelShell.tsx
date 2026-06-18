import type { ReactNode } from 'react';
import type { Palette } from './types';

/**
 * Shared outer card for the runtime stakeholder panels — header with an accent
 * rule + optional archetype pill, an intro blurb, and an honest "general guidance"
 * note when the bundle is degraded (concern couldn't be fully mapped). Keeps the
 * visual canon identical to the student runtime view.
 */
export function RuntimePanelShell({
  B,
  accent,
  title,
  archetypeName,
  degraded,
  blurb,
  children,
}: {
  B: Palette;
  accent: string;
  title: string;
  archetypeName: string | null;
  degraded: boolean;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
      <div
        className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-2"
        style={{ borderBottom: `1px solid ${B.divider}` }}
      >
        <div className="flex items-center gap-2">
          <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: accent }} />
          <span className="text-[11px] font-black uppercase" style={{ color: accent, letterSpacing: '0.14em' }}>{title}</span>
        </div>
        {archetypeName && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: B.navyBg, color: B.navy, border: `1px solid ${B.navyBorder}` }}
          >
            {archetypeName}
          </span>
        )}
      </div>
      <div className="px-4 py-3.5 space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{blurb}</p>
        {degraded && (
          <div className="rounded-xl p-3.5" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.navy }}>General guidance</p>
            <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
              We couldn't map a full runtime profile for this specific concern yet, so the items below are a starting point. A short conversation with a counsellor or mentor can help turn these into a plan that fits.
            </p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
