import React from 'react';
import {
  ArrowRight, CheckCircle, ChevronDown, ChevronUp, Lock, MessageCircle, Phone, Target,
} from 'lucide-react';
import { CAPADEX_STAGES } from '@/lib/behavioural-insights';

type Session = {
  session_id: string;
  stage_code: string;
  concern_name: string;
  score_level?: string | null;
  score?: number | null;
  created_at: string;
};

type PricingEntry = {
  price?: string;
  price_note?: string;
  tag?: string;
  benefits?: string[];
  description?: string;
  whatsapp_number?: string;
};

export interface StageJourneyPanelProps {
  recentSessions: Session[];
  recentSessionsLoading: boolean;
  capadexPricing: Record<string, PricingEntry> | null | undefined;
  handleUnlockRequest: (
    code: string, label: string, price: string, accent: string, bg: string, bdr: string,
    benefits: string[], priceNote: string, waNum: string,
  ) => void;
  handleLoadPreviousReport: (sessionId: string) => void;
  className?: string;
}

export function StageJourneyPanel({
  recentSessions,
  recentSessionsLoading,
  capadexPricing,
  handleUnlockRequest,
  handleLoadPreviousReport,
  className,
}: StageJourneyPanelProps) {
  const [expandedStage, setExpandedStage] = React.useState<string | null>(null);

  // Auto-expand the "next" stage once sessions are loaded
  React.useEffect(() => {
    if (recentSessionsLoading) return;
    const mastSess = recentSessions.find(r => r.stage_code === 'CAP_MAS');
    const grwSess  = recentSessions.find(r => r.stage_code === 'CAP_GRW');
    const isCovered = (code: string) =>
      !!recentSessions.find(r => r.stage_code === code) ||
      (!!mastSess && code !== 'CAP_MAS') ||
      (!!grwSess && (code === 'CAP_INS' || code === 'CAP_GRW'));
    const nextStage = CAPADEX_STAGES.find((s, i) => {
      if (isCovered(s.code)) return false;
      if (i === 0) return true;
      return isCovered(CAPADEX_STAGES[i - 1].code);
    });
    if (nextStage && expandedStage === null) setExpandedStage(nextStage.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentSessions, recentSessionsLoading]);

  return (
    <div className={className ?? 'mt-5'}>
      {/* Header */}
      {(() => {
        const _mast = recentSessions.find(s => s.stage_code === 'CAP_MAS');
        const _grw  = recentSessions.find(s => s.stage_code === 'CAP_GRW');
        const _cov  = CAPADEX_STAGES.filter(s =>
          !!recentSessions.find(r => r.stage_code === s.code) ||
          (!!_mast && s.code !== 'CAP_MAS') ||
          (!!_grw  && (s.code === 'CAP_INS' || s.code === 'CAP_GRW'))
        ).length;
        return (
          <div className="flex items-center gap-2 mb-3">
            <Target size={13} style={{ color: '#344E86' }} />
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#344E86' }}>
              Your Stage Journey
            </p>
            {recentSessionsLoading
              ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" style={{ color: '#344E86' }} />
              : _cov > 0 && (
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#344E86' }}>
                  {_cov} / {CAPADEX_STAGES.length} complete
                </span>
              )
            }
          </div>
        );
      })()}

      {/* Stage accordion cards */}
      <div className="flex flex-col gap-2">
        {CAPADEX_STAGES.map((stage, idx) => {
          const session        = recentSessions.find(s => s.stage_code === stage.code);
          const masterySession = recentSessions.find(s => s.stage_code === 'CAP_MAS');
          const growthSession  = recentSessions.find(s => s.stage_code === 'CAP_GRW');
          const isCompleted    = !!session;

          const covered = (code: string): boolean =>
            !!recentSessions.find(s => s.stage_code === code) ||
            (!!masterySession && code !== 'CAP_MAS') ||
            (!!growthSession  && (code === 'CAP_INS' || code === 'CAP_GRW'));

          const curDone = covered('CAP_CUR');

          const isIncludedViaMastery = !isCompleted && !!masterySession && stage.code !== 'CAP_MAS';
          const isIncludedViaGrowth  = !isCompleted && !isIncludedViaMastery && !!growthSession && stage.code === 'CAP_INS';

          const isGrowthBundle  = stage.code === 'CAP_GRW' && !covered('CAP_GRW') && curDone && !covered('CAP_INS');
          const isMasteryBundle = stage.code === 'CAP_MAS' && !covered('CAP_MAS') && !covered('CAP_GRW');

          const prevCovered = idx === 0 ? true : covered(CAPADEX_STAGES[idx - 1].code);
          const isNext      = !covered(stage.code) && prevCovered && !isGrowthBundle && !isMasteryBundle;

          const isExpanded  = expandedStage === stage.code;
          const pricing     = capadexPricing?.[stage.code];
          const masteryPricing = capadexPricing?.['CAP_MAS'];
          const waNum       = pricing?.whatsapp_number || '919999999999';
          const price       = pricing?.price || ({ CAP_CUR: 'Free', CAP_INS: '₹499', CAP_GRW: '₹999', CAP_MAS: '₹1,999' } as Record<string, string>)[stage.code] || '';
          const masteryPrice = masteryPricing?.price || '₹1,999';
          const masteryWaNum = masteryPricing?.whatsapp_number || waNum;
          const scoreLabel  = session?.score_level || (session?.score != null ? `${Math.round(session.score)}` : null);
          const date        = session ? new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
          const masteryDate = masterySession ? new Date(masterySession.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

          const tag       = pricing?.tag || '';
          const priceNote = pricing?.price_note || '';
          const masteryTag       = masteryPricing?.tag || '';
          const masteryPriceNote = masteryPricing?.price_note || '';

          const STAGE_COLORS: Record<string, { accent: string; bg: string; bdr: string }> = {
            CAP_CUR: { accent: '#344E86', bg: '#EEF2FF', bdr: '#C7D2FE' },
            CAP_INS: { accent: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' },
            CAP_GRW: { accent: '#0F766E', bg: '#F0FDFA', bdr: '#6EE7B7' },
            CAP_MAS: { accent: '#D97706', bg: '#FFFBEB', bdr: '#FCD34D' },
          };
          const sc = STAGE_COLORS[stage.code] || STAGE_COLORS['CAP_CUR'];
          const mc = STAGE_COLORS['CAP_MAS'];

          const TAG_STYLE: Record<string, { bg: string; color: string }> = {
            'Entry Stage':      { bg: '#E5E7EB', color: '#374151' },
            'Most Impactful':   { bg: '#EDE9FE', color: '#5B21B6' },
            'Best Value':       { bg: '#CCFBF1', color: '#0F766E' },
            'Complete Package': { bg: '#FEF3C7', color: '#B45309' },
          };
          const tagStyle = TAG_STYLE[tag] || null;

          const STAGE_DESCS: Record<string, string> = {
            CAP_CUR: 'A 10-question behavioural assessment that surfaces how your concern shows up across key life domains — producing a structured Clarity Intelligence report with domain scores, detected patterns and priority focus areas.',
            CAP_INS: 'Decodes the specific root causes, competency gaps and behavioural patterns holding you back — with precision that generic assessments cannot reach. Answers 10 focused questions calibrated to your role and concern.',
            CAP_GRW: 'Moves you from awareness to action. 30-day personalised strategy built around your exact behavioural pattern — with habit formation, stage-by-stage intervention map and progress checkpoints.',
            CAP_MAS: 'Your complete behavioural intelligence profile. Full 19-domain assessment, longitudinal memory linking all prior stages, and a 1-on-1 analyst debrief session included.',
          };

          const STAGE_BENEFITS: Record<string, string[]> = {
            CAP_CUR: ['Personalised Behavioural Intelligence Report', 'Pattern identification across key dimensions', 'Benchmark vs 10,000+ real profiles', 'Dimensional score breakdown with severity indicators'],
            CAP_INS: ['Competency gap analysis mapped to your target role', 'Root-cause pattern identification — not surface symptoms', 'Exact triggers, drivers and leverage points', 'CV positioning intelligence based on actual behavioural strengths'],
            CAP_GRW: ['Personalised 30-day habit & strategy plan', 'Stage-by-stage intervention map', 'Progress checkpoints and milestone tracking', 'Behaviour replacement — not just suppression'],
            CAP_MAS: ['Everything in Insight + Growth stages', 'Full 19-domain behavioural intelligence profile', '1-on-1 analyst debrief session included', 'Career or academic readiness intelligence map'],
          };

          const MASTERY_INCLUDES = [
            { stage: 'Curiosity', desc: 'Behavioural Intelligence Report · domain scores · patterns' },
            { stage: 'Insight', desc: 'Root-cause decode · competency gaps · triggers' },
            { stage: 'Growth', desc: '30-day strategy · intervention map · checkpoints' },
            { stage: 'Mastery', desc: 'Full 19-domain profile · 1-on-1 analyst debrief' },
          ];

          const benefits   = pricing?.benefits?.length ? pricing.benefits! : STAGE_BENEFITS[stage.code] || [];
          const desc       = pricing?.description || STAGE_DESCS[stage.code] || '';
          const waMsg      = encodeURIComponent(`Hi, I'd like to know more about the CAPADEX ${stage.label} stage and how it can help me.`);
          const waLink     = `https://wa.me/${waNum}?text=${waMsg}`;
          const aiMsg      = encodeURIComponent(`Hi, I have a question about the CAPADEX ${stage.label} assessment stage.`);
          const aiLink     = `https://wa.me/${waNum}?text=${aiMsg}`;
          const masteryWaMsg = encodeURIComponent(`Hi, I'd like to go directly to the CAPADEX Mastery bundle (all stages included). Can you guide me?`);
          const masteryWaLink = `https://wa.me/${masteryWaNum}?text=${masteryWaMsg}`;

          const doUnlock = () => handleUnlockRequest(
            stage.code, stage.label, price, sc.accent, sc.bg, sc.bdr, benefits, priceNote, waNum
          );
          const doUnlockGrowthBundle = () => handleUnlockRequest(
            'CAP_GRW', 'Growth Bundle', price, '#0F766E', '#F0FDFA', '#6EE7B7',
            benefits, priceNote || 'one-time · includes Insight', waNum
          );
          const doUnlockMasteryBundle = () => handleUnlockRequest(
            'CAP_MAS', 'Mastery Bundle', masteryPrice, mc.accent, mc.bg, mc.bdr,
            masteryPricing?.benefits || [], masteryPriceNote || 'one-time · full roadmap', masteryWaNum
          );

          // ── Completed stage ──────────────────────────────────
          if (isCompleted) {
            return (
              <div key={stage.code} className="rounded-xl overflow-hidden transition-all"
                style={{ border: '1.5px solid #A7F3D0', backgroundColor: '#F0FDF4' }}>
                <button
                  className="w-full text-left px-3.5 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                    <CheckCircle size={14} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold" style={{ color: '#065F46' }}>{stage.label}</p>
                      {scoreLabel && (
                        <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>{scoreLabel}</span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
                      {session!.concern_name}{date ? ` · ${date}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11.5px] font-semibold flex items-center gap-1" style={{ color: '#059669' }}>View <ArrowRight size={10} /></span>
                    {isExpanded ? <ChevronUp size={13} style={{ color: '#059669' }} /> : <ChevronDown size={13} style={{ color: '#059669' }} />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#A7F3D0' }}>
                    <p className="text-[11.5px] mt-3 mb-2.5 leading-relaxed" style={{ color: '#374151' }}>{STAGE_DESCS[stage.code]}</p>
                    <div className="flex flex-col gap-1 mb-3">
                      {benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <CheckCircle size={11} className="shrink-0 mt-0.5" style={{ color: '#059669' }} />
                          <span className="text-[11px]" style={{ color: '#374151' }}>{b}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleLoadPreviousReport(session!.session_id)}
                      className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12.5px] font-bold text-white transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#059669' }}
                    >
                      View {stage.label} Report <ArrowRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // ── Included via Mastery bundle ───────────────────────
          if (isIncludedViaMastery) {
            return (
              <div key={stage.code} className="rounded-xl overflow-hidden transition-all"
                style={{ border: '1.5px solid #A7F3D0', backgroundColor: '#F0FDF4' }}>
                <button
                  className="w-full text-left px-3.5 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                    <CheckCircle size={14} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold" style={{ color: '#065F46' }}>{stage.label}</p>
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide" style={{ backgroundColor: '#6EE7B7', color: '#064E3B' }}>Via Mastery</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
                      Included · {masteryDate || 'active'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px]" style={{ color: '#059669' }}>Included ✓</span>
                    {isExpanded ? <ChevronUp size={13} style={{ color: '#059669' }} /> : <ChevronDown size={13} style={{ color: '#059669' }} />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#A7F3D0' }}>
                    <div className="flex items-start gap-2 mt-3 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#D1FAE5', border: '1px solid #6EE7B7' }}>
                      <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: '#059669' }} />
                      <p className="text-[11.5px] leading-relaxed" style={{ color: '#065F46' }}>
                        This stage is covered by your <strong>Mastery Bundle</strong>. All Mastery assessments include the full {stage.label} stage content.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 mb-3">
                      {benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <CheckCircle size={11} className="shrink-0 mt-0.5" style={{ color: '#059669' }} />
                          <span className="text-[11px]" style={{ color: '#374151' }}>{b}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleLoadPreviousReport(masterySession!.session_id)}
                      className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12.5px] font-bold text-white transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#059669' }}
                    >
                      View Mastery Report <ArrowRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // ── Included via Growth bundle ────────────────────────
          if (isIncludedViaGrowth) {
            return (
              <div key={stage.code} className="rounded-xl overflow-hidden transition-all"
                style={{ border: '1.5px solid #A7F3D0', backgroundColor: '#F0FDF4' }}>
                <button
                  className="w-full text-left px-3.5 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#D1FAE5' }}>
                    <CheckCircle size={14} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold" style={{ color: '#065F46' }}>{stage.label}</p>
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide" style={{ backgroundColor: '#6EE7B7', color: '#064E3B' }}>Via Growth</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
                      Included · {growthSession ? new Date(growthSession.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'active'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px]" style={{ color: '#059669' }}>Included ✓</span>
                    {isExpanded ? <ChevronUp size={13} style={{ color: '#059669' }} /> : <ChevronDown size={13} style={{ color: '#059669' }} />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#A7F3D0' }}>
                    <div className="flex items-start gap-2 mt-3 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#D1FAE5', border: '1px solid #6EE7B7' }}>
                      <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: '#059669' }} />
                      <p className="text-[11.5px] leading-relaxed" style={{ color: '#065F46' }}>
                        This stage is covered by your <strong>Growth Bundle</strong>. The Growth stage includes all Insight stage content.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 mb-3">
                      {benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <CheckCircle size={11} className="shrink-0 mt-0.5" style={{ color: '#059669' }} />
                          <span className="text-[11px]" style={{ color: '#374151' }}>{b}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleLoadPreviousReport(growthSession!.session_id)}
                      className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12.5px] font-bold text-white transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#059669' }}
                    >
                      View Growth Report <ArrowRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // ── Next (unlockable) stage ──────────────────────────
          if (isNext) {
            const showMasteryShortcut = stage.code !== 'CAP_MAS';
            return (
              <div key={stage.code} className="rounded-xl overflow-hidden"
                style={{ border: `1.5px solid ${sc.bdr}`, backgroundColor: sc.bg }}>
                <button
                  className="w-full text-left px-3.5 py-3 flex items-center gap-3"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bdr }}>
                    <ArrowRight size={14} style={{ color: sc.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold" style={{ color: sc.accent }}>{stage.label}</p>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ backgroundColor: sc.accent, color: '#fff' }}>NEXT</span>
                      {tagStyle && tag && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: tagStyle.bg, color: tagStyle.color }}>{tag}</span>
                      )}
                      <span className="text-[11px] font-bold" style={{ color: sc.accent }}>{price}</span>
                    </div>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: '#6B7280' }}>
                      {priceNote || pricing?.description?.split('.')[0] || desc.split('.')[0]}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={13} style={{ color: sc.accent }} /> : <ChevronDown size={13} style={{ color: sc.accent }} />}
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#C7D2FE' }}>
                    <p className="text-[11.5px] mt-3 mb-2.5 leading-relaxed" style={{ color: '#374151' }}>{desc}</p>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: '#344E86' }}>What you get</p>
                    <div className="flex flex-col gap-1.5 mb-3">
                      {benefits.map((b, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#C7D2FE' }}>
                            <CheckCircle size={9} style={{ color: '#344E86' }} />
                          </div>
                          <span className="text-[11px]" style={{ color: '#374151' }}>{b}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={doUnlock}
                      className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-bold text-white mb-2 transition-all active:scale-[0.98]"
                      style={{ backgroundColor: sc.accent }}
                    >
                      Unlock {stage.label} · {price} <ArrowRight size={12} />
                    </button>
                    {showMasteryShortcut && (
                      <button
                        onClick={doUnlockMasteryBundle}
                        className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold mb-2 transition-all active:scale-[0.98]"
                        style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                      >
                        ✦ Or skip to Mastery Bundle · {masteryPrice} — all stages included
                      </button>
                    )}
                    <div className="flex gap-2">
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold transition-all active:scale-[0.98] no-underline"
                        style={{ backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                        <Phone size={11} /> WhatsApp Counsellor
                      </a>
                      <a href={aiLink} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold transition-all active:scale-[0.98] no-underline"
                        style={{ backgroundColor: '#EEF2FF', color: '#344E86', border: '1px solid #C7D2FE' }}>
                        <MessageCircle size={11} /> Ask AI Coach
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // ── Growth bundle (available when CUR done, skips INS) ───
          if (isGrowthBundle) {
            const GROWTH_INCLUDES = [
              { stage: 'Insight', desc: 'Root-cause decode · competency gaps · triggers' },
              { stage: 'Growth', desc: '30-day strategy · intervention map · checkpoints' },
            ];
            const growthWaMsg  = encodeURIComponent(`Hi, I'd like to go directly to the CAPADEX Growth bundle (includes Insight). Can you guide me?`);
            const growthWaLink = `https://wa.me/${waNum}?text=${growthWaMsg}`;
            return (
              <div key={stage.code} className="rounded-xl overflow-hidden"
                style={{ border: '1.5px solid #6EE7B7', backgroundColor: '#F0FDFA' }}>
                <button
                  className="w-full text-left px-3.5 py-3 flex items-center gap-3"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base" style={{ backgroundColor: '#CCFBF1' }}>
                    ⬆
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold" style={{ color: '#134E4A' }}>{stage.label}</p>
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide" style={{ backgroundColor: '#14B8A6', color: '#fff' }}>BUNDLE</span>
                      <span className="text-[11px] font-bold" style={{ color: '#0F766E' }}>{price}</span>
                    </div>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: '#0F766E' }}>
                      Includes Insight stage — skip ahead with one purchase
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={13} style={{ color: '#0F766E' }} /> : <ChevronDown size={13} style={{ color: '#0F766E' }} />}
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#6EE7B7' }}>
                    <div className="flex items-start gap-2 mt-3 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#CCFBF1', border: '1px solid #6EE7B7' }}>
                      <span className="shrink-0 mt-0.5 text-sm">⬆</span>
                      <p className="text-[11.5px] leading-relaxed" style={{ color: '#134E4A' }}>
                        <strong>Growth is a bundle.</strong> One purchase covers both Insight and Growth stage content — no need to buy Insight separately.
                      </p>
                    </div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: '#0F766E' }}>Stages included</p>
                    <div className="flex flex-col gap-1.5 mb-3">
                      {GROWTH_INCLUDES.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black" style={{ backgroundColor: '#6EE7B7', color: '#134E4A' }}>
                            {i + 1}
                          </div>
                          <div>
                            <span className="text-[11.5px] font-semibold" style={{ color: '#134E4A' }}>{item.stage}</span>
                            <span className="text-[11px] ml-1" style={{ color: '#0F766E' }}>· {item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={doUnlockGrowthBundle}
                      className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-bold text-white mb-2 transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#0F766E' }}
                    >
                      Unlock Growth Bundle · {price} <ArrowRight size={12} />
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={doUnlockMasteryBundle}
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold transition-all active:scale-[0.98]"
                        style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                      >
                        ✦ Or go full Mastery · {masteryPrice}
                      </button>
                      <a href={growthWaLink} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold no-underline transition-all"
                        style={{ backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                        <Phone size={11} /> Counsellor
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // ── Mastery bundle (always available, not yet purchased) ──
          if (isMasteryBundle) {
            return (
              <div key={stage.code} className="rounded-xl overflow-hidden"
                style={{ border: '1.5px solid #FCD34D', backgroundColor: '#FFFBEB' }}>
                <button
                  className="w-full text-left px-3.5 py-3 flex items-center gap-3"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base" style={{ backgroundColor: '#FEF3C7' }}>
                    ✦
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold" style={{ color: '#92400E' }}>{stage.label}</p>
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide" style={{ backgroundColor: '#F59E0B', color: '#fff' }}>BUNDLE</span>
                      <span className="text-[11px] font-bold" style={{ color: '#B45309' }}>{masteryPrice}</span>
                    </div>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: '#B45309' }}>
                      Includes all 4 stages — skip straight to the complete package
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={13} style={{ color: '#B45309' }} /> : <ChevronDown size={13} style={{ color: '#B45309' }} />}
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#FCD34D' }}>
                    <div className="flex items-start gap-2 mt-3 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }}>
                      <span className="shrink-0 mt-0.5 text-sm">✦</span>
                      <p className="text-[11.5px] leading-relaxed" style={{ color: '#78350F' }}>
                        <strong>Mastery is the complete package.</strong> You can unlock it directly — it includes all Curiosity, Insight and Growth stage content, plus the full 19-domain assessment and a 1-on-1 expert debrief.
                      </p>
                    </div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: '#B45309' }}>All stages included</p>
                    <div className="flex flex-col gap-1.5 mb-3">
                      {MASTERY_INCLUDES.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black" style={{ backgroundColor: '#FCD34D', color: '#78350F' }}>
                            {i + 1}
                          </div>
                          <div>
                            <span className="text-[11.5px] font-semibold" style={{ color: '#92400E' }}>{item.stage}</span>
                            <span className="text-[11px] ml-1" style={{ color: '#B45309' }}>· {item.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={doUnlockMasteryBundle}
                      className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-bold text-white mb-2 transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#D97706' }}
                    >
                      Unlock Mastery Bundle · {masteryPrice} <ArrowRight size={12} />
                    </button>
                    <a href={masteryWaLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold w-full no-underline transition-all"
                      style={{ backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>
                      <Phone size={11} /> Chat with a counsellor about Mastery
                    </a>
                  </div>
                )}
              </div>
            );
          }

          // ── Locked stage (non-Mastery) ────────────────────────
          return (
            <div key={stage.code} className="rounded-xl overflow-hidden transition-all"
              style={{ border: '1px dashed #E5E7EB', backgroundColor: '#FAFAFA' }}>
              <button
                className="w-full text-left px-3.5 py-3 flex items-center gap-3"
                onClick={() => setExpandedStage(isExpanded ? null : stage.code)}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#F3F4F6' }}>
                  <Lock size={13} style={{ color: '#9CA3AF' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold" style={{ color: '#9CA3AF' }}>{stage.label}</p>
                    <span className="text-[10.5px] font-semibold" style={{ color: '#9CA3AF' }}>{price}</span>
                  </div>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: '#D1D5DB' }}>
                    {desc.split('.')[0]}
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={13} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={13} style={{ color: '#9CA3AF' }} />}
              </button>
              {isExpanded && (
                <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: '#E5E7EB' }}>
                  <p className="text-[11.5px] mt-3 mb-2.5 leading-relaxed" style={{ color: '#9CA3AF' }}>{desc}</p>
                  <div className="flex flex-col gap-1.5 mb-3">
                    {benefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Lock size={10} className="shrink-0 mt-0.5" style={{ color: '#D1D5DB' }} />
                        <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{b}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setExpandedStage('CAP_MAS')}
                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold mb-2 transition-all active:scale-[0.98]"
                    style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1.5px solid #FCD34D' }}
                  >
                    ✦ Skip to Mastery Bundle · {masteryPrice} — includes {stage.label}
                  </button>
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11.5px] font-semibold w-full no-underline transition-all"
                    style={{ backgroundColor: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                    <Phone size={11} /> Ask a counsellor about this stage
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
