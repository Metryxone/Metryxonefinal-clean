import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import {
  ArrowRight, Award, CheckCircle, Download, Send, Sparkles, X,
  TrendingUp, AlertTriangle, Zap, Target, Brain, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CAPADEX_STAGES, getSubdomainInsight, stageLabel as canonicalStageLabel } from '@/lib/behavioural-insights';
import type { CapadexProgress } from '@/lib/behavioural-insights';
import { PhaseProps } from '../types';
import { StageJourneyPanel } from './StageJourneyPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

const NAVY = '#1E3A8A';
const NAVY_BG = '#EEF2FA';

function cleanName(raw: string) {
  return (raw || '')
    .replace(/^(SDI_|CAP_|LBI_)/i, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function domainLevel(pct: number): { col: string; label: string; bg: string } {
  if (pct >= 70) return { col: '#059669', label: 'Proficient', bg: '#ECFDF5' };
  if (pct >= 45) return { col: '#D97706', label: 'Developing', bg: '#FFFBEB' };
  return { col: '#DC2626', label: 'Emerging', bg: '#FEF2F2' };
}

function percentileFromScore(s: number) {
  const z = (s - 55) / 20;
  const erf = (x: number) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const val = 1 - poly * Math.exp(-x * x);
    return x >= 0 ? val : -val;
  };
  return Math.min(99, Math.max(1, Math.round(((1 + erf(z / Math.SQRT2)) / 2) * 100)));
}

function SectionLabel({ icon, text, color = NAVY }: { icon: React.ReactNode; text: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        {icon}
      </div>
      <span className="text-[10.5px] font-black uppercase tracking-widest" style={{ color: `${color}CC` }}>
        {text}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CapadexResultPhase(props: PhaseProps) {
  const {
    setPhase, selectedConcern, selectedPersona, assesseeType, userAge,
    participantName, introEmailName,
    capadexStage, capadexStageResult,
    concernIntelligence, clarifyAnswers,
    capadexUser, capadexReport, capadexPricing,
    capadexRegEmail,
    capadexRegLoading,
    capadexStageCheck,
    handleClose, handleViewCurrentReport, handleContinueToNextStage,
    handleUnlockRequest, handleSkipToNextStage,
    handleCapadexPdf, capadexPdfLoading, capadexPdfBlobUrl, capadexPdfFilename, capadexPdfError,
    handleCapadexEmailReport, capadexEmailLoading, capadexEmailSent,
    recentSessions, recentSessionsLoading, handleLoadPreviousReport,
  } = props;

  const r         = capadexStageResult!;
  const stageInfo = CAPADEX_STAGES.find(s => s.code === r.stage_code) || CAPADEX_STAGES[0];
  const ci        = concernIntelligence;
  const subs      = (r.subdomains as any[]) || [];

  const rawName   = (introEmailName || participantName || '').trim();
  const firstName = rawName.split(' ')[0] || null;

  const score      = r.score;
  const percentile = percentileFromScore(score);
  const scoreColor = score >= 75 ? '#059669' : score >= 55 ? '#D97706' : score >= 35 ? '#F97316' : '#DC2626';

  // Sorted subdomains
  const sortedSubs = [...subs].sort((a, b) => Number(a.avg_score) - Number(b.avg_score));
  const lowestSubs = sortedSubs.slice(0, 3);
  const highestSubs = [...subs].sort((a: any, b: any) => Number(b.avg_score) - Number(a.avg_score)).slice(0, 2);

  return (
    <div className="flex flex-col" style={{ maxHeight: '88vh' }}>

      {/* ══ DARK HEADER ══════════════════════════════════════════════════ */}
      <div className="shrink-0"
        style={{ background: `linear-gradient(135deg, #0F172A 0%, ${NAVY} 60%, ${stageInfo.color}CC 100%)` }}>
        <div className="px-5 pt-4 pb-5">

          {/* Top row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
              <CheckCircle size={11} className="text-white" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white">
                {stageInfo.label} Complete
              </span>
            </div>
            <button onClick={handleClose}
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <X size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
          </div>

          {/* Score + name block */}
          <div className="flex items-center gap-4 mb-5">
            {/* Score ring */}
            <div className="relative shrink-0">
              <svg width="68" height="68" viewBox="0 0 68 68">
                <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                <circle cx="34" cy="34" r="30" fill="none"
                  stroke="rgba(255,255,255,0.85)" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 188.5} 188.5`}
                  transform="rotate(-90 34 34)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[18px] font-black text-white leading-none">{score}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                {r.score_level}
              </p>
              <p className="text-[17px] font-bold text-white leading-tight truncate">
                {r.concern_name || selectedConcern}
              </p>
              {firstName && (
                <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {firstName} · {subs.length} domains assessed
                </p>
              )}
              {!firstName && (
                <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {subs.length} domains assessed
                </p>
              )}
            </div>
          </div>

          {/* Stage progress ladder — slim dot row in header */}
          <div className="flex items-center gap-1">
            {CAPADEX_STAGES.map((s, i) => {
              const prog      = (r.progress || []).find((p: CapadexProgress) => p.stage_code === s.code);
              const isComplete = prog?.status === 'completed';
              const isCurrent  = s.code === r.stage_code;
              return (
                <React.Fragment key={s.code}>
                  {i > 0 && (
                    <div className="flex-1 h-px rounded-full"
                      style={{ background: isComplete ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }} />
                  )}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center border-2"
                      style={{
                        borderColor: isComplete || isCurrent ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                        background: isComplete ? 'rgba(255,255,255,0.25)' : isCurrent ? 'rgba(255,255,255,0.15)' : 'transparent',
                      }}>
                      {isComplete
                        ? <CheckCircle size={12} className="text-white" />
                        : <span className="text-[11px] font-bold" style={{ color: isCurrent ? 'white' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>}
                    </div>
                    <span className="text-[8.5px] font-semibold uppercase tracking-wide"
                      style={{ color: isComplete || isCurrent ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                      {s.label}
                    </span>
                    {isComplete && prog?.score != null && (
                      <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{Math.round(prog.score)}</span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* ── Pending stage strip — clickable unlock cards below ladder ── */}
          {(() => {
            const STAGE_PRICES: Record<string, string> = { CAP_CUR: 'Free', CAP_INS: '₹499', CAP_GRW: '₹999', CAP_MAS: '₹1,999' };
            const STAGE_DESCS: Record<string, string> = {
              CAP_CUR: '10 questions · Clarity Intelligence report',
              CAP_INS: 'Root-cause decode · competency gap analysis',
              CAP_GRW: '30-day strategy · habit formation plan',
              CAP_MAS: 'Full 19-domain profile · expert debrief',
            };
            const pending = CAPADEX_STAGES.filter(s => {
              const prog = (r.progress || []).find((p: CapadexProgress) => p.stage_code === s.code);
              return !prog || (prog.status !== 'completed' && s.code !== r.stage_code);
            });
            if (pending.length === 0) return null;
            return (
              <div className="mt-3 flex flex-col gap-1.5">
                {pending.map((s, idx) => {
                  const isNext = idx === 0;
                  const p = capadexPricing?.[s.code];
                  return (
                    <button
                      key={s.code}
                      onClick={() => {
                        if (!isNext) return;
                        if (p) {
                          handleUnlockRequest(s.code, s.label, p.price, s.color,
                            `${s.color}10`, `${s.color}30`, p.benefits, p.price_note, p.whatsapp_number);
                        }
                      }}
                      disabled={!isNext}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
                      style={{
                        background: isNext ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                        border: isNext ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.08)',
                        cursor: isNext ? 'pointer' : 'default',
                      }}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: isNext ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)' }}>
                        {isNext
                          ? <ArrowRight size={11} className="text-white" />
                          : <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>🔒</span>}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[12px] font-bold leading-none"
                          style={{ color: isNext ? 'white' : 'rgba(255,255,255,0.3)' }}>
                          {s.label} Stage
                          <span className="ml-2 text-[10.5px] font-semibold"
                            style={{ color: isNext ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)' }}>
                            {STAGE_PRICES[s.code]}
                          </span>
                        </p>
                        <p className="text-[10px] mt-0.5 truncate"
                          style={{ color: isNext ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
                          {STAGE_DESCS[s.code]}
                        </p>
                      </div>
                      {isNext && (
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                          Unlock
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* ══ SCROLLABLE BODY ══════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAFF', scrollbarWidth: 'none' }}>

        {/* ── Report CTA (if report not yet loaded) ── */}
        {!capadexReport && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden"
            style={{ background: `linear-gradient(135deg, #1E3A8A 0%, ${stageInfo.color} 100%)` }}>
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-white leading-tight">
                  Your {stageInfo.label} report is ready
                </p>
                <p className="text-[12px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {capadexUser ? 'Tap to view the full analysis' : 'Quick email verification — under 60 seconds'}
                </p>
              </div>
              <button
                onClick={() => capadexUser ? handleViewCurrentReport() : setPhase('capadex_register')}
                className="shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5"
                style={{ background: '#fff', color: NAVY }}>
                {capadexUser ? 'View Report' : 'Get Report'} <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* ── Score summary cards ── */}
        <div className="px-4 pt-4 pb-2">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Score', value: `${score}%`, color: scoreColor, sub: r.score_level },
              { label: 'Percentile', value: `Top ${100 - percentile}%`, color: stageInfo.color, sub: 'vs all users' },
              { label: 'Domains', value: `${subs.length}`, color: NAVY, sub: 'assessed' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded-2xl px-3 py-3 text-center"
                style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
                <p className="text-[20px] font-black leading-none mb-0.5" style={{ color }}>{value}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-[9.5px] text-gray-300 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Behavioural Intelligence ── */}
        <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
          <div className="px-4 pt-4 pb-3.5">
            <SectionLabel
              icon={<Sparkles size={10} style={{ color: stageInfo.color }} />}
              text="Behavioural Intelligence"
              color={stageInfo.color}
            />
            <p className="text-[15px] leading-relaxed text-gray-700 mb-3">{r.insight}</p>

            {/* Severity + Growth readiness chips */}
            {ci && (
              <div className="flex flex-wrap gap-2">
                {ci.severity_label && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <AlertTriangle size={9} style={{ color: '#D97706' }} />
                    <span className="text-[10.5px] font-semibold" style={{ color: '#92400E' }}>
                      Severity: {ci.severity_label}
                    </span>
                  </div>
                )}
                {ci.growth_readiness && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <TrendingUp size={9} style={{ color: '#059669' }} />
                    <span className="text-[10.5px] font-semibold" style={{ color: '#064E3B' }}>
                      Growth: {ci.growth_readiness}
                    </span>
                  </div>
                )}
                {ci.risk_level && ci.risk_level !== 'low' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <Shield size={9} style={{ color: '#DC2626' }} />
                    <span className="text-[10.5px] font-semibold" style={{ color: '#991B1B' }}>
                      Risk: {ci.risk_level}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Clarity Intelligence ── */}
        {ci && (ci.detected_patterns?.length > 0 || ci.emotional_signals?.length > 0 || ci.behavioural_mirror?.length > 0) && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
            <div className="px-4 pt-4 pb-3.5">
              <SectionLabel
                icon={<Brain size={10} style={{ color: '#7C3AED' }} />}
                text="Clarity Intelligence"
                color="#7C3AED"
              />
              <p className="text-[12px] leading-relaxed mb-3" style={{ color: '#64748B' }}>
                Based on your responses before the assessment, these patterns and signals were detected:
              </p>

              {/* Detected patterns */}
              {ci.detected_patterns?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>
                    Detected Patterns
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ci.detected_patterns.map((p, i) => (
                      <span key={i}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Emotional signals */}
              {ci.emotional_signals?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>
                    Emotional Signals
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ci.emotional_signals.slice(0, 6).map((s, i) => (
                      <span key={i}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Behavioural mirror statements */}
              {ci.behavioural_mirror?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>
                    Behavioural Mirror
                  </p>
                  {ci.behavioural_mirror.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                      style={{ background: '#F8FAFF', border: '1px solid #E8ECF7' }}>
                      <div className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ background: '#7C3AED' }} />
                      <p className="text-[12.5px] leading-snug" style={{ color: '#374151' }}>{m}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Clarify Q&A synthesis */}
              {ci.clarification_questions?.length > 0 && Object.keys(clarifyAnswers).length > 0 && (
                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #EDF0F7' }}>
                  <div className="px-3 py-2" style={{ background: '#F8FAFF', borderBottom: '1px solid #EDF0F7' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                      Your Clarity Responses
                    </p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                    {ci.clarification_questions.slice(0, 4).map((q, qi) => {
                      const ans = clarifyAnswers[qi];
                      if (!ans || ans.length === 0) return null;
                      return (
                        <div key={q.id} className="px-3 py-2.5">
                          <p className="text-[11px] font-medium mb-1" style={{ color: '#94A3B8' }}>{q.question}</p>
                          <div className="flex flex-wrap gap-1">
                            {ans.map((a, ai) => (
                              <span key={ai}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: `${NAVY}10`, color: NAVY }}>
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Domain Intelligence Map ── */}
        {subs.length > 0 && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
            <div className="px-4 pt-4 pb-1">
              <SectionLabel
                icon={<Target size={10} style={{ color: NAVY }} />}
                text="Domain Intelligence Map"
                color={NAVY}
              />
            </div>

            {/* Bar chart */}
            <div className="px-4 pb-3">
              <div className="rounded-xl p-3" style={{ background: '#F8FAFF', border: '1px solid #EDF0F7' }}>
                <div className="flex gap-2 items-end" style={{ height: 88 }}>
                  {/* Y labels */}
                  <div className="flex flex-col justify-between shrink-0 text-right" style={{ height: 88, width: 22 }}>
                    {[100, 75, 50, 25, 0].map(v => (
                      <span key={v} className="text-[8px]" style={{ color: '#CBD5E1', lineHeight: 1 }}>{v}</span>
                    ))}
                  </div>
                  {/* Bars */}
                  <div className="flex-1 relative flex items-end gap-1" style={{ height: 88 }}>
                    <div className="absolute w-full" style={{ bottom: '75%', borderTop: '1.5px dashed #94A3B840', pointerEvents: 'none', left: 0 }} />
                    {subs.map((sd: any) => {
                      const pct = Math.min(100, Math.max(0, Math.round(Number(sd.avg_score) || 0)));
                      const { col } = domainLevel(pct);
                      const name = sd.subdomain_name ? cleanName(sd.subdomain_name) : cleanName(sd.subdomain_code);
                      return (
                        <div key={sd.subdomain_code || sd.subdomain_name}
                          className="flex-1 flex flex-col items-center gap-0.5" style={{ height: '100%', justifyContent: 'flex-end' }}>
                          <span className="text-[8px] font-bold leading-none" style={{ color: col }}>{pct}</span>
                          <div className="w-full rounded-t-sm"
                            style={{ height: `${Math.max(3, pct)}%`, background: col, opacity: 0.85 }} />
                          <span className="text-[7.5px] text-center leading-tight"
                            style={{ maxWidth: 32, color: '#94A3B8', overflow: 'hidden',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                            {name.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex gap-3 justify-center mt-2.5 pt-2.5" style={{ borderTop: '1px solid #EDF0F7' }}>
                  {[{ col: '#059669', l: 'Proficient' }, { col: '#D97706', l: 'Developing' }, { col: '#DC2626', l: 'Emerging' }].map(({ col, l }) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm" style={{ background: col }} />
                      <span className="text-[9px]" style={{ color: '#94A3B8' }}>{l}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <div style={{ width: 10, borderTop: '1.5px dashed #94A3B8' }} />
                    <span className="text-[9px]" style={{ color: '#94A3B8' }}>75 threshold</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Domain detail rows */}
            <div className="px-4 pb-4 space-y-2">
              {subs.map((sd: any) => {
                const pct  = Math.min(100, Math.max(0, Math.round(Number(sd.avg_score) || 0)));
                const name = sd.subdomain_name ? cleanName(sd.subdomain_name) : cleanName(sd.subdomain_code);
                const { col, label, bg } = domainLevel(pct);
                const delta = pct - 75;
                const insight = getSubdomainInsight(name, pct);
                return (
                  <div key={sd.subdomain_code || sd.subdomain_name} className="rounded-xl overflow-hidden"
                    style={{ border: `1.5px solid ${col}28`, background: '#fff' }}>
                    {/* Row header */}
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                        <span className="text-[13.5px] font-semibold text-gray-800 truncate">{name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: bg, color: col }}>{label}</span>
                        <span className="text-[15px] font-black" style={{ color: col }}>{pct}%</span>
                        <span className="text-[11.5px] font-semibold w-8 text-right"
                          style={{ color: delta >= 0 ? '#059669' : '#DC2626' }}>
                          {delta >= 0 ? `+${delta}` : delta}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mx-3 mb-2.5 rounded-full overflow-hidden" style={{ height: 5, background: '#F1F5F9' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                    </div>
                    {/* Insight text */}
                    <div className="px-3 pb-3">
                      <p className="text-[12px] leading-relaxed mb-1.5" style={{ color: '#4B5563' }}>
                        {insight.insight}
                      </p>
                      {pct < 65 && insight.action && (
                        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                          style={{ background: `${col}0C`, border: `1px solid ${col}20` }}>
                          <Zap size={10} style={{ color: col, marginTop: 2, flexShrink: 0 }} />
                          <p className="text-[11px] leading-snug" style={{ color: '#374151' }}>{insight.action}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pattern Detection ── */}
        {ci?.detected_patterns?.length > 0 && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
            <div className="px-4 pt-4 pb-4">
              <SectionLabel
                icon={<Zap size={10} style={{ color: '#D97706' }} />}
                text="Pattern Detection"
                color="#D97706"
              />
              <div className="space-y-2">
                {ci.detected_patterns.map((pattern, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: '#FEF3C7' }}>
                      <span className="text-[10px] font-black" style={{ color: '#D97706' }}>{i + 1}</span>
                    </div>
                    <p className="text-[12.5px] leading-snug flex-1" style={{ color: '#374151' }}>{pattern}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Priority Focus Areas ── */}
        {lowestSubs.length > 0 && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
            <div className="px-4 pt-4 pb-4">
              <SectionLabel
                icon={<Target size={10} style={{ color: '#DC2626' }} />}
                text="Priority Focus Areas"
                color="#DC2626"
              />
              <p className="text-[12px] mb-3" style={{ color: '#64748B' }}>
                Based on your lowest-scoring domains — action 1 is the highest-leverage place to start.
              </p>
              <div className="space-y-2.5">
                {lowestSubs.map((sd: any, i) => {
                  const pct  = Math.min(100, Math.max(0, Math.round(Number(sd.avg_score) || 0)));
                  const name = sd.subdomain_name ? cleanName(sd.subdomain_name) : cleanName(sd.subdomain_code);
                  const { col } = domainLevel(pct);
                  const insight = getSubdomainInsight(name, pct);
                  return (
                    <div key={sd.subdomain_code || sd.subdomain_name} className="flex items-start gap-3 px-3 py-3 rounded-xl"
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white text-[11px] font-black"
                        style={{ background: '#DC2626' }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-semibold" style={{ color: '#111827' }}>{name}</span>
                          <span className="text-[13px] font-black" style={{ color: col }}>{pct}%</span>
                        </div>
                        <p className="text-[12px] leading-snug" style={{ color: '#4B5563' }}>
                          {insight.action}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Standout Strengths ── */}
        {highestSubs.filter((sd: any) => Number(sd.avg_score) >= 65).length > 0 && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #EDF0F7' }}>
            <div className="px-4 pt-4 pb-4">
              <SectionLabel
                icon={<Award size={10} style={{ color: '#059669' }} />}
                text="Standout Strengths"
                color="#059669"
              />
              <div className="space-y-2">
                {highestSubs.filter((sd: any) => Number(sd.avg_score) >= 65).map((sd: any) => {
                  const pct  = Math.min(100, Math.max(0, Math.round(Number(sd.avg_score) || 0)));
                  const name = sd.subdomain_name ? cleanName(sd.subdomain_name) : cleanName(sd.subdomain_code);
                  const insight = getSubdomainInsight(name, pct);
                  return (
                    <div key={sd.subdomain_code || sd.subdomain_name}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: '#F0FDF4', border: '1px solid #A7F3D0' }}>
                      <CheckCircle size={14} style={{ color: '#059669', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <p className="text-[12.5px] font-semibold mb-0.5" style={{ color: '#065F46' }}>
                          {name} · {pct}%
                        </p>
                        <p className="text-[11.5px] leading-snug" style={{ color: '#374151' }}>{insight.insight}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Stage skip banner ── */}
        {capadexStageCheck?.has_prior_completion && (() => {
          const sc = capadexStageCheck!;
          const sessionNext = r.next_stage?.code;
          const checkNext   = sc.next_stage_code;
          const hasAdvanced = (sc.completed.length > 1 || (checkNext && checkNext !== sessionNext)) && checkNext !== capadexStage;
          if (!hasAdvanced) return null;
          const stageLabel = (c: string) => canonicalStageLabel(c);
          return (
            <div className="mx-4 mt-3 rounded-2xl p-4" style={{ background: NAVY_BG, border: `1.5px solid ${NAVY}25` }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={13} style={{ color: NAVY }} />
                <p className="text-[13px] font-bold" style={{ color: NAVY }}>
                  {sc.completed.map(stageLabel).join(' + ')} already on your account
                </p>
              </div>
              <p className="text-[12px] text-gray-500 mb-3">
                Skip ahead to the <span className="font-semibold" style={{ color: sc.next_stage_color }}>{sc.next_stage_label}</span> stage.
              </p>
              <button
                onClick={() => handleSkipToNextStage({ email: capadexRegEmail.trim() || capadexUser?.email || '' })}
                className="w-full h-9 rounded-xl text-[13px] font-bold text-white"
                style={{ background: sc.next_stage_color || NAVY }}>
                {capadexRegLoading ? 'Starting…' : `Go to ${sc.next_stage_label} Stage →`}
              </button>
            </div>
          );
        })()}

        {/* ── PDF + Email actions (when report is unlocked) ── */}
        {capadexReport && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E8EBF4', background: '#F8F9FB' }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #E8EBF4' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${stageInfo.color}18`, border: `1.5px solid ${stageInfo.color}30` }}>
                <CheckCircle size={14} style={{ color: stageInfo.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-gray-900">Your {stageInfo.label} Report is ready</p>
                <p className="text-[11px] text-gray-500">Download or email a copy to keep</p>
              </div>
              <button onClick={handleViewCurrentReport}
                className="shrink-0 text-[11.5px] font-semibold flex items-center gap-1"
                style={{ color: stageInfo.color }}>
                Full report <ArrowRight size={10} />
              </button>
            </div>
            <div className="flex gap-2.5 px-4 py-3">
              {capadexPdfError ? (
                <span className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[10px] font-medium px-2"
                  style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  ⚠ {capadexPdfError.slice(0, 50)}
                </span>
              ) : capadexPdfBlobUrl === 'PRINT' ? (
                <span className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[11px] font-medium px-2"
                  style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                  ✓ Print dialog opened
                </span>
              ) : capadexPdfBlobUrl ? (
                <a href={capadexPdfBlobUrl} download={capadexPdfFilename || 'MetryxOne_Report.pdf'}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#059669 0%,#10B981 100%)', color: '#fff', textDecoration: 'none' }}>
                  <Download size={12} />Save PDF
                </a>
              ) : (
                <button onClick={() => handleCapadexPdf()} disabled={capadexPdfLoading}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg,${NAVY} 0%,${stageInfo.color} 100%)`, color: '#fff' }}>
                  {capadexPdfLoading
                    ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Generating…</>
                    : <><Download size={12} />Download PDF</>}
                </button>
              )}
              <button onClick={handleCapadexEmailReport} disabled={capadexEmailLoading || capadexEmailSent}
                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold border transition-all hover:bg-gray-50 disabled:opacity-60"
                style={{ background: '#fff', color: capadexEmailSent ? '#059669' : NAVY, borderColor: capadexEmailSent ? '#A7F3D0' : '#D4DBF0' }}>
                {capadexEmailSent
                  ? <><CheckCircle size={12} />Sent!</>
                  : capadexEmailLoading
                  ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending…</>
                  : <><Send size={12} />Email Report</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Next Stage CTA ── */}
        <div className="mx-4 mt-3 mb-5">
          {r.next_stage ? (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, #0F172A 0%, ${r.next_stage.color}DD 100%)` }}>
              <div className="px-4 pt-4 pb-4">
                <p className="text-[10.5px] font-black uppercase tracking-widest mb-1"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  What the {r.next_stage.label} Stage unlocks
                </p>
                <p className="text-[16px] font-bold text-white leading-tight mb-1">
                  Decode the root cause beneath this pattern
                </p>
                <p className="text-[12.5px] mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {r.next_stage.desc}
                </p>
                <button
                  className="w-full h-11 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                  onClick={() => {
                    const p = capadexPricing[r.next_stage!.code];
                    if (p) {
                      handleUnlockRequest(
                        r.next_stage!.code, r.next_stage!.label,
                        p.price, r.next_stage!.color,
                        `${r.next_stage!.color}10`, `${r.next_stage!.color}30`,
                        p.benefits, p.price_note, p.whatsapp_number,
                      );
                    } else {
                      handleContinueToNextStage();
                    }
                  }}>
                  Unlock {r.next_stage.label} Stage <ArrowRight size={14} />
                </button>
                <button
                  className="w-full mt-2 text-[12.5px] font-medium text-center py-1.5"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  onClick={handleViewCurrentReport}>
                  View my {r.stage_label} report →
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 text-center"
              style={{ background: `linear-gradient(135deg, #0F172A 0%, ${NAVY} 100%)` }}>
              <Award size={26} className="mx-auto mb-3 text-white" />
              <p className="text-[17px] font-bold text-white mb-1">Full Journey Complete</p>
              <p className="text-[13px] mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                You've completed all 4 stages of the CAPADEX assessment.
              </p>
              <button
                className="w-full h-10 rounded-xl text-[14px] font-bold text-white"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                onClick={handleViewCurrentReport}>
                View Complete Report <ArrowRight size={12} className="ml-1 inline" />
              </button>
            </div>
          )}
        </div>

        {/* ── Your Stage Journey (moved from intro: shown after free Clarity assessment) ── */}
        <div className="mx-4 mb-6">
          <StageJourneyPanel
            recentSessions={recentSessions || []}
            recentSessionsLoading={!!recentSessionsLoading}
            capadexPricing={capadexPricing}
            handleUnlockRequest={handleUnlockRequest}
            handleLoadPreviousReport={handleLoadPreviousReport}
            evidenceGate={r.progress || null}
            reassessment={r.reassessment || null}
            className=""
          />
        </div>

      </div>
    </div>
  );
}
