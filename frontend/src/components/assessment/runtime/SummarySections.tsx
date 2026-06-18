import type { SummarySection, Palette } from './types';
import { humanise } from './types';

/** Numbered section header — shared visual canon with the student runtime view. */
export function SectionHead({ n, title, color }: { n: number; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="inline-flex items-center justify-center rounded-full text-[10px] font-black shrink-0"
        style={{ width: 18, height: 18, backgroundColor: color, color: '#fff' }}
      >
        {n}
      </span>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
    </div>
  );
}

/** Severity → tone (display-only). Falls back to the accent's soft tones. */
function sevTone(sev: string | null | undefined, B: Palette) {
  const s = String(sev ?? '').toLowerCase();
  if (s === 'high') return { bg: '#FEF2F2', fg: '#B91C1C', bd: '#FECACA' };
  if (s === 'moderate') return { bg: '#FFFBEB', fg: '#B45309', bd: '#FDE68A' };
  return { bg: B.navyBg, fg: B.navy, bd: B.navyBorder };
}

/**
 * Generic, canon-styled renderer for a list of stakeholder summary sections.
 * Read-only: shows each section's items as cards (severity-toned where present) and
 * the honest empty-note when a section has no sourced content (never fabricated).
 */
export function SummarySections({
  sections,
  B,
  accent,
}: {
  sections: SummarySection[];
  B: Palette;
  accent: string;
}) {
  return (
    <div className="space-y-4">
      {sections.map((sec, idx) => (
        <div key={sec.key}>
          <SectionHead n={idx + 1} title={sec.title} color={accent} />
          {sec.items.length > 0 ? (
            <div className="space-y-2">
              {sec.items.map((it, i) => {
                const t = sevTone(it.severity, B);
                const toned = !!it.severity;
                return (
                  <div
                    key={i}
                    className="rounded-xl p-3"
                    style={{
                      background: toned ? t.bg : B.navyBg,
                      border: `1px solid ${toned ? t.bd : B.navyBorder}`,
                    }}
                  >
                    {(it.label || it.severity) && (
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {it.label && (
                          <span
                            className="text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: toned ? t.fg : accent }}
                          >
                            {it.label}
                          </span>
                        )}
                        {it.severity && (
                          <span
                            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: t.fg, color: '#fff' }}
                          >
                            {it.severity}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed" style={{ color: toned ? t.fg : B.textMid }}>
                      {humanise(it.text)}
                    </p>
                    {it.meta && (
                      <p className="text-[11px] mt-1" style={{ color: B.textMuted }}>{humanise(it.meta)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl p-3" style={{ background: B.navyBg, border: `1px dashed ${B.navyBorder}` }}>
              <p className="text-[12px] leading-relaxed" style={{ color: B.textMuted }}>{sec.note}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
