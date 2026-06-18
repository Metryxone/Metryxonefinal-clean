import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { RuntimeExplainability, Palette } from './types';
import { humanise, prettify } from './types';

/**
 * Explainability view — the full Response→Signal→Concern→Capability→Problem→
 * Behavior→Archetype→Intervention lineage, plus a per-recommendation "Why am I
 * seeing this?" expander that shows the resolved hop chain behind each suggestion.
 * Read-only; unresolved hops are shown honestly (greyed), never hidden.
 */
export function ExplainabilityPanel({ data, B }: { data: RuntimeExplainability | null; B: Palette }) {
  const [openRec, setOpenRec] = useState<number | null>(null);
  if (!data || data.enabled === false) return null;

  const lineage = data.lineage ?? [];
  const recs = data.recommendations ?? [];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
      <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
        <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
        <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>How This Was Worked Out</span>
      </div>

      <div className="px-4 py-3.5 space-y-4">
        <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
          Every insight here is traced back to your responses through an explainable chain — nothing is invented. Below is the full path from what you answered to what we recommend.
        </p>

        {/* Lineage chain */}
        {lineage.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: B.navy }}>Reasoning Lineage</p>
            <div className="space-y-1.5">
              {lineage.map((hop) => (
                <div
                  key={hop.step}
                  className="rounded-xl p-3 flex items-start gap-2.5"
                  style={{
                    background: hop.resolved ? B.navyBg : '#F8FAFC',
                    border: `1px solid ${hop.resolved ? B.navyBorder : B.divider}`,
                    opacity: hop.resolved ? 1 : 0.7,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full text-[10px] font-black shrink-0 mt-0.5"
                    style={{ width: 18, height: 18, backgroundColor: hop.resolved ? B.navy : B.textMuted, color: '#fff' }}
                  >
                    {hop.step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold" style={{ color: hop.resolved ? B.navy : B.textMuted }}>{hop.label}</p>
                    <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: B.textMid }}>{humanise(hop.summary)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-recommendation "Why am I seeing this?" */}
        {recs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: B.navy }}>Why Am I Seeing This?</p>
            <div className="space-y-2">
              {recs.map((rec, i) => {
                const open = openRec === i;
                return (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${B.navyBorder}` }}>
                    <button
                      type="button"
                      onClick={() => setOpenRec(open ? null : i)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2"
                      style={{ background: open ? B.navyBg : '#ffffff' }}
                    >
                      {open
                        ? <ChevronDown size={15} className="shrink-0 mt-0.5" style={{ color: B.navy }} />
                        : <ChevronRight size={15} className="shrink-0 mt-0.5" style={{ color: B.navy }} />}
                      <span className="min-w-0">
                        <span className="block text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: B.navy }}>{prettify(rec.intervention_type)}</span>
                        <span className="block text-[13px] leading-relaxed" style={{ color: B.textMid }}>{humanise(rec.intervention_text)}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="px-3 py-2.5 space-y-1.5" style={{ borderTop: `1px solid ${B.divider}`, background: '#FCFDFF' }}>
                        {rec.why.length > 0 ? rec.why.map((w) => (
                          <div key={w.step} className="flex items-start gap-2">
                            <span className="text-[10px] font-bold shrink-0 mt-0.5" style={{ color: B.navy }}>{w.step}.</span>
                            <p className="text-[12px] leading-relaxed" style={{ color: B.textMid }}>
                              <span className="font-semibold" style={{ color: B.navy }}>{w.label}:</span> {humanise(w.summary)}
                            </p>
                          </div>
                        )) : (
                          <p className="text-[12px]" style={{ color: B.textMuted }}>No resolved reasoning chain for this recommendation.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
