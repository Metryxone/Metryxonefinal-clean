import { ChevronRight } from 'lucide-react';
import type { Palette } from './types';
import { humanise, prettify } from './types';

// Student runtime view data shapes (mirror the report's GuidanceBundle + the
// activated emotional signals pulled from the pipeline resolver).
export interface StudentGuidance {
  enabled?: boolean;
  degraded?: boolean;
  archetype?: { key: string; name: string | null } | null;
  human_problems?: { voice: string; problem_statement: string }[];
  behaviours?: { behavior_statement: string; behavior_category: string | null }[];
  search_intents?: { intent_type: string; search_phrase: string }[];
  interventions?: { type: string; text: string }[];
  action_plan?: {
    plan_title: string | null;
    step_immediate: string | null; step_week: string | null;
    step_month: string | null; step_quarter: string | null;
    total_days: number | null;
  } | null;
  growth_pathway?: { summary: string | null; stage_count: number | null } | null;
}

export interface StudentSignal {
  signal_key: string;
  signal_type: string;
  severity: string | null;
  lifecycle_state: string | null;
}

/**
 * Student-facing runtime view — six fixed sections (Top Archetypes · Key Problems ·
 * Emotional Indicators · Immediate Actions · 7-Day Plan · Growth Opportunities).
 * Read-only over the admin-authored PIL guidance chain + activated signals. Hidden
 * when there's nothing to show AND the bundle isn't degraded; a degraded bundle
 * still renders partial content + a general-support card (never blank).
 */
export function StudentIntelligencePanel({
  guidance,
  emotionalSignals,
  B,
}: {
  guidance: StudentGuidance | null;
  emotionalSignals: StudentSignal[];
  B: Palette;
}) {
  const g = guidance;
  if (!g || g.enabled === false) return null;

  const archetype  = g.archetype ?? null;
  const problems   = g.human_problems ?? [];
  const behaviours = g.behaviours ?? [];
  const intents    = g.search_intents ?? [];
  const ivs        = g.interventions ?? [];
  const plan       = g.action_plan ?? null;
  const pathway    = g.growth_pathway ?? null;
  const emo        = emotionalSignals;

  const IV_LABEL: Record<string, string> = {
    immediate_actions: 'Immediate', seven_day: '7-day',
    thirty_day: '30-day', ninety_day: '90-day',
    habit: 'Habit', skill_building: 'Skill',
  };

  const immediateItems: Array<{ label: string; text: string }> = [
    ...(plan?.step_immediate ? [{ label: 'Today', text: plan.step_immediate }] : []),
    ...ivs.filter(v => v.type === 'immediate_actions').map(v => ({ label: 'Action', text: v.text })),
  ];
  const sevenDayItems: Array<{ label: string; text: string }> = [
    ...(plan?.step_week ? [{ label: 'This week', text: plan.step_week }] : []),
    ...ivs.filter(v => v.type === 'seven_day').map(v => ({ label: '7-day', text: v.text })),
  ];
  const longerIvs = ivs.filter(v => !['immediate_actions', 'seven_day'].includes(v.type));
  const growthItems: Array<{ label: string; text: string }> = [
    ...(pathway?.summary ? [{ label: pathway.stage_count ? `Where this leads · ${pathway.stage_count} stages` : 'Where this leads', text: pathway.summary }] : []),
    ...(plan?.step_month ? [{ label: 'This month', text: plan.step_month }] : []),
    ...(plan?.step_quarter ? [{ label: 'This quarter', text: plan.step_quarter }] : []),
    ...longerIvs.map(v => ({ label: IV_LABEL[v.type] ?? prettify(v.type), text: v.text })),
  ];

  const sevTone = (sev: string | null): { bg: string; fg: string; bd: string } => {
    const s = String(sev ?? '').toLowerCase();
    if (s === 'high' || s === 'severe' || s === 'critical') return { bg: '#FEF2F2', fg: '#B91C1C', bd: '#FECACA' };
    if (s === 'moderate' || s === 'elevated') return { bg: '#FFFBEB', fg: '#B45309', bd: '#FDE68A' };
    return { bg: B.navyBg, fg: B.navy, bd: B.navyBorder };
  };

  const hasContent =
    !!archetype || problems.length || emo.length || behaviours.length ||
    immediateItems.length || sevenDayItems.length || growthItems.length || intents.length;
  if (!hasContent && !g.degraded) return null;
  const showFallback = !!g.degraded;

  const SectionHead = ({ n, title, color = B.navy }: { n: number; title: string; color?: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <span className="inline-flex items-center justify-center rounded-full text-[10px] font-black shrink-0" style={{ width: 18, height: 18, backgroundColor: color, color: '#fff' }}>{n}</span>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
      <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
        <div className="flex items-center gap-2">
          <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
          <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Your Runtime View</span>
        </div>
        {archetype?.name && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: B.navyBg, color: B.navy, border: `1px solid ${B.navyBorder}` }}>{archetype.name}</span>
        )}
      </div>
      <div className="px-4 py-3.5 space-y-4">
        {hasContent && (
          <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
            A snapshot mapped from your responses — the pattern behind this concern, how it tends to show up, and the concrete moves that shift it.
          </p>
        )}

        {showFallback && (
          <div className="rounded-xl p-3.5" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.navy }}>General guidance</p>
            <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
              {hasContent
                ? "We couldn't map a full runtime profile for this specific concern yet, so the items below are a starting point. A short conversation with a counsellor or mentor can help turn these into a plan that fits you."
                : "We couldn't map a detailed runtime profile for this specific concern yet — your responses didn't line up closely enough with one of our mapped patterns. That's common, and it doesn't mean nothing's actionable. A good next step is a short conversation with a counsellor, mentor, or someone you trust to talk through what you're noticing."}
            </p>
          </div>
        )}

        {/* 1 · Top Archetypes */}
        {archetype && (
          <div>
            <SectionHead n={1} title="Top Archetypes" />
            <div className="rounded-xl p-3.5" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
              <p className="text-[14px] font-bold" style={{ color: B.navy }}>{archetype.name ?? prettify(archetype.key)}</p>
              <p className="text-[12px] leading-relaxed mt-1" style={{ color: B.textMid }}>The behavioural pattern your responses align with most closely.</p>
            </div>
          </div>
        )}

        {/* 2 · Key Problems */}
        {problems.length > 0 && (
          <div>
            <SectionHead n={2} title="Key Problems" />
            <div className="space-y-2">
              {problems.map((p, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
                  <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{humanise(p.problem_statement)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3 · Emotional Indicators */}
        {(emo.length > 0 || behaviours.length > 0) && (
          <div>
            <SectionHead n={3} title="Emotional Indicators" />
            {emo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {emo.map((s, i) => {
                  const t = sevTone(s.severity);
                  return (
                    <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>
                      {prettify(s.signal_key)}
                      {s.severity && <span className="ml-1 font-medium opacity-70">· {prettify(s.severity)}</span>}
                    </span>
                  );
                })}
              </div>
            )}
            {behaviours.length > 0 && (
              <div className="space-y-1.5">
                {behaviours.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ChevronRight size={14} className="shrink-0 mt-0.5" style={{ color: B.navy }} />
                    <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
                      {humanise(b.behavior_statement)}
                      {b.behavior_category && (
                        <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full align-middle" style={{ backgroundColor: B.navyBg, color: B.navy }}>{prettify(b.behavior_category)}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4 · Immediate Actions */}
        {immediateItems.length > 0 && (
          <div>
            <SectionHead n={4} title="Immediate Actions" color={B.teal} />
            <div className="space-y-2">
              {immediateItems.map((it, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: B.tealBg, border: `1px solid ${B.tealBorder}` }}>
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full mt-0.5" style={{ backgroundColor: B.teal, color: '#fff' }}>{it.label}</span>
                    <p className="text-[13px] leading-relaxed" style={{ color: B.tealText }}>{humanise(it.text)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5 · 7-Day Plan */}
        {sevenDayItems.length > 0 && (
          <div>
            <SectionHead n={5} title="7-Day Plan" color="#059669" />
            {(plan?.plan_title || plan?.total_days) && (
              <p className="text-[11px] font-medium -mt-1 mb-2" style={{ color: B.textMuted }}>
                {plan?.plan_title || 'Action plan'}
                {plan?.total_days ? ` · ${plan.total_days}-day plan` : ''}
              </p>
            )}
            <div className="space-y-2">
              {sevenDayItems.map((it, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: '#F0FDF4', border: '1px solid #A7F3D0' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#059669' }}>{it.label}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{humanise(it.text)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6 · Growth Opportunities */}
        {(growthItems.length > 0 || intents.length > 0) && (
          <div>
            <SectionHead n={6} title="Growth Opportunities" />
            <div className="space-y-2">
              {growthItems.map((it, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: B.navy }}>{it.label}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{humanise(it.text)}</p>
                </div>
              ))}
            </div>
            {intents.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {intents.map((it, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: B.navyBg, color: B.navy, border: `1px solid ${B.navyBorder}` }}>{it.search_phrase}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
