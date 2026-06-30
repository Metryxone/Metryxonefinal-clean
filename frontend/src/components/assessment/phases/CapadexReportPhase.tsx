import React, { useRef, useState, useEffect } from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import {
  TrendingUp, BarChart3, Award, Download, CheckCircle, ArrowRight, ChevronRight,
  Heart, Brain, Target, Lock, Sparkles, Star, Shield, Users, Clock,
  AlertTriangle, X, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BRAND, METRYX_NAVY, CAPADEX_STAGES, STAGE_CODE_TO_LABEL, UPGRADE_TIERS, getSubdomainInsight,
  generatePatternDetection, type DomainResult,
} from '@/lib/behavioural-insights';
import { StudentIntelligencePanel } from '@/components/assessment/runtime/StudentIntelligencePanel';
import { ParentIntelligencePanel } from '@/components/assessment/runtime/ParentIntelligencePanel';
import { CounselorIntelligencePanel } from '@/components/assessment/runtime/CounselorIntelligencePanel';
import { ExplainabilityPanel } from '@/components/assessment/runtime/ExplainabilityPanel';
import { IntelligenceLayers } from '@/components/shared/IntelligenceLayers';
import type { RuntimeSummary, RuntimeExplainability, StakeholderLens } from '@/components/assessment/runtime/types';

interface CapadexReportData {
  reportId: string; concernName: string; stageCode: string; stageLabel: string;
  score: number; rawScore: number; scoreLevel: string; insight: string;
  scoreOverride: number | null; headlineOverride: string | null;
  narrativeOverride: string | null; overrideReason: string | null;
  reviewStatus: string; reviewedBy: string | null; reviewedAt: string | null;
  publishedAt: string | null; participantName: string; participantAge: number | null;
  subdomains: Array<{ subdomain_name: string; avg_score: number; item_count: number }>;
  generatedAt: string;
  // BIOS behavioural intelligence — null when no signal profile exists for the session
  behavioral_signals?: {
    emotional_load: number; cognitive_load: number; engagement_score: number;
    volatility_score: number; rapid_answer: boolean; has_profile: boolean;
  } | null;
  linguistic_context?: {
    absolutism_score: number; intensity_score: number; certainty_score: number;
    has_linguistic: boolean;
  } | null;
  behavioral_archetype?: {
    key: string; label: string; summary: string;
    tone: 'caution' | 'observe' | 'positive';
  } | null;
}
interface RieRecommendation {
  title: string; expected_outcome: string; rec_type: string;
  domain: string; timing: string; intensity: string; confidence: number;
}

interface RecentSession {
  session_id: string; concern_name: string; stage_code: string;
  score: number | null; score_level: string | null; created_at: string;
}

interface CapadexReportPhaseProps {
  capadexReport: CapadexReportData;
  rieRecommendations: RieRecommendation[];
  rieHasEscalation: boolean;
  rieActionPlanCopied: boolean;
  setRieActionPlanCopied: (v: boolean) => void;
  rieActionPlanPdfLoading: boolean;
  setRieActionPlanPdfLoading: (v: boolean) => void;
  rieActionPlanSharing: boolean;
  setRieActionPlanSharing: (v: boolean) => void;
  rieActionPlanShared: boolean;
  setRieActionPlanShared: (v: boolean) => void;
  rieActionPlanDesktopCopied: boolean;
  capadexRegEmail: string;
  capadexSessionId: string | null;
  selectedConcern: string | null;
  participantName: string;
  setShowGrowthJourney: (v: boolean) => void;
  handleClose: () => void;
  capadexReportRef: React.RefObject<HTMLDivElement>;
  handleCapadexPdf: () => void;
  capadexPdfLoading: boolean;
  capadexPdfBlobUrl?: string | null;
  capadexPdfFilename?: string;
  capadexPdfError?: string | null;
  handleCapadexEmailReport: () => void;
  capadexEmailLoading: boolean;
  capadexEmailSent: boolean;
  capadexPricing: Record<string, { price: string; price_note: string; tag: string; description: string; benefits: string[]; whatsapp_number: string; }>;
  handleUnlockRequest: (stageCode: string, stageName: string, price: string, color: string, bg: string, bdr: string, benefits: string[], note: string, waNum: string) => void;
  counsellorNumber: string;
  recentSessions: RecentSession[];
  recentSessionsLoading: boolean;
  handleLoadPreviousReport: (sessionId: string) => void;
  omegaReport?: Record<string, unknown> | null;
  selectedPersona?: string | null;
  assesseeType?: string;
  userAge?: string;
  onNavigate?: (screen: string) => void;
  // Backend clarity-question provenance ('master_curated' | 'adaptive_bank' |
  // 'static_fallback'). `capadexReport` itself does not carry it, so the modal
  // forwards it from `concernIntelligence` for the provenance pill.
  claritySource?: string;
}

export function CapadexReportPhase({
  capadexReport, rieRecommendations, rieHasEscalation,
  rieActionPlanCopied, setRieActionPlanCopied,
  rieActionPlanPdfLoading, setRieActionPlanPdfLoading,
  rieActionPlanSharing, setRieActionPlanSharing,
  rieActionPlanShared, setRieActionPlanShared, rieActionPlanDesktopCopied,
  capadexRegEmail, capadexSessionId, selectedConcern, participantName,
  setShowGrowthJourney, handleClose, capadexReportRef,
  handleCapadexPdf, capadexPdfLoading, capadexPdfBlobUrl, capadexPdfFilename, capadexPdfError, handleCapadexEmailReport,
  capadexEmailLoading, capadexEmailSent,
  capadexPricing, handleUnlockRequest, counsellorNumber,
  recentSessions, recentSessionsLoading, handleLoadPreviousReport,
  omegaReport,
  selectedPersona, assesseeType, userAge,
  onNavigate, claritySource,
}: CapadexReportPhaseProps) {
  const actionPlanRef = useRef<HTMLDivElement>(null);
  const [desktopCopied, setDesktopCopied] = useState(false);
  const [omegaPdfLoading, setOmegaPdfLoading] = useState(false);

  // ── OMEGA-X composite payload (Module 1: Real-Time UI Rendering Bridge) ──
  // Fetched on mount from /api/capadex/session/:id/omega-x. Server returns a
  // fully-initialised 8-layer skeleton when the column is empty, so this state
  // is safe to map without optional-chain forests downstream. Skeleton fallback
  // here too as a belt-and-braces guard against fetch failure (e.g. offline).
  type OmegaXPayload = {
    demographic:  { early_career?: boolean; college_student?: boolean };
    identity:     { professional?: boolean; student?: boolean };
    behavioural:  { overthinking?: number; avoidance_loop?: number; perfectionism?: number; procrastination_pattern?: number; indecisiveness?: number };
    cognitive:    { analytical?: number; structured?: number };
    emotional:    { anxious_achiever?: number; emotionally_balanced?: number };
    capability:   { leadership_potential?: number; adaptive_problem_solver?: number };
    risk:         { burnout_risk?: number; disengagement_risk?: number };
    longitudinal: { growth_oriented?: boolean };
    _telemetry_inputs?: { avg_hesitation_ms?: number; total_backtracks?: number; telemetry_rows?: number };
  };
  const OMEGA_X_EMPTY: OmegaXPayload = {
    demographic: {}, identity: {}, behavioural: {}, cognitive: {},
    emotional: {}, capability: {}, risk: {}, longitudinal: {},
  };

  // ── OMEGA-X Animated Progress Ring ────────────────────────────────────────
  // Smooth circular progress indicator used for the four behavioural intensity
  // widgets. Values in [0,1] are clamped and rendered as a percentage; the
  // stroke-dashoffset is transitioned (700ms ease-out) so the ring "fills"
  // gently rather than snapping. A warm non-clinical tooltip surfaces on
  // hover/focus via native `title` for guaranteed accessibility — no JS
  // popover machinery to maintain. Defaults render at 0% if the source key
  // is missing so the panel never breaks on the skeleton payload.
  const OmegaProgressRing = ({
    label, value, tone, tooltip,
  }: { label: string; value: number; tone: string; tooltip: string }) => {
    const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
    const R = 26;
    const C = 2 * Math.PI * R;
    const dash = C * (1 - pct / 100);
    return (
      <div
        className="flex flex-col items-center gap-1.5 p-3 rounded-xl"
        style={{ background: '#FFFFFF', border: '1px solid #E8EBF4', transition: 'border-color 0.25s ease-in-out' }}
        title={tooltip}
      >
        <div className="relative" style={{ width: 64, height: 64 }} aria-label={`${label}: ${pct} out of 100`}>
          <svg viewBox="0 0 64 64" width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={32} cy={32} r={R} fill="none" stroke="#E8EBF4" strokeWidth={6} />
            <circle
              cx={32} cy={32} r={R} fill="none" stroke={tone} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={dash}
              style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
            <span className="text-[15px] font-bold" style={{ color: tone }}>{pct}</span>
            <span className="text-[8px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>/ 100</span>
          </div>
        </div>
        <div className="text-[10.5px] font-semibold text-center" style={{ color: '#475569' }}>{label}</div>
      </div>
    );
  };
  const [omegaXPayload, setOmegaXPayload] = useState<OmegaXPayload>(OMEGA_X_EMPTY);
  const [omegaXIsSkeleton, setOmegaXIsSkeleton] = useState(false);
  const [omegaXLoading, setOmegaXLoading] = useState(false);

  // ── Phase 6: Runtime Intelligence Activation ("Your Growth Path") ──────────
  // Read-only surface of the admin-authored PIL guidance chain. Fetched on mount
  // from /api/capadex/session/:id/guidance. Flag OFF → `{enabled:false}` so the
  // whole section stays hidden and the report is byte-identical to legacy. Any
  // fetch failure / degraded marker also hides it — never blanks the report.
  type GuidanceBundle = {
    enabled?: boolean; degraded?: boolean;
    archetype?: { key: string; name: string | null } | null;
    human_problems?: Array<{ voice: string; problem_statement: string }>;
    behaviours?: Array<{ behavior_statement: string; behavior_category: string | null }>;
    search_intents?: Array<{ intent_type: string; search_phrase: string }>;
    interventions?: Array<{ type: string; text: string }>;
    action_plan?: {
      plan_title: string | null; step_immediate: string | null; step_week: string | null;
      step_month: string | null; step_quarter: string | null; total_days: number | null;
    } | null;
    growth_pathway?: { summary: string | null; stage_count: number | null } | null;
  };
  const [guidance, setGuidance] = useState<GuidanceBundle | null>(null);

  // ── Phase 6B: Student Runtime View — "Emotional Indicators" ────────────────
  // The activated behavioural signals captured for this session (e.g. emotional
  // overload, placement anxiety) come from the read-only pipeline resolver's
  // first hop (Response → Signal). Flag OFF / failure → empty list → the
  // Emotional Indicators row simply doesn't render. Never blanks the report.
  type EmotionalSignal = { signal_key: string; signal_type: string; severity: string | null; lifecycle_state: string | null };
  const [emotionalSignals, setEmotionalSignals] = useState<EmotionalSignal[]>([]);

  // ── Phase 6B: Runtime Intelligence Experience Layer ────────────────────────
  // A stakeholder toggle (Student / Parent / Counselor) over the SAME read-only
  // runtime intelligence, plus an explainability ("Why am I seeing this?") view.
  // `runtime-summary` powers Parent/Counselor; the Student view keeps its richer
  // existing data path (guidance + emotionalSignals). All flag-gated: OFF →
  // {enabled:false} → only the legacy student view shows, byte-identical.
  const [stakeholderLens, setStakeholderLens] = useState<StakeholderLens>('student');
  const [runtimeSummary, setRuntimeSummary] = useState<RuntimeSummary | null>(null);
  const [explainData, setExplainData] = useState<RuntimeExplainability | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  useEffect(() => {
    if (!capadexSessionId) return;
    let cancelled = false;
    fetch(`/api/capadex/session/${capadexSessionId}/guidance`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then(j => { if (!cancelled) setGuidance(j as GuidanceBundle); })
      .catch(err => { if (!cancelled) console.warn('[guidance] fetch failed, section hidden:', err); });
    return () => { cancelled = true; };
  }, [capadexSessionId]);

  useEffect(() => {
    // Clear any prior session's indicators up front so a session switch (or a
    // flag-off / failed fetch) can never leak stale signals into this report.
    setEmotionalSignals([]);
    if (!capadexSessionId) return;
    let cancelled = false;
    fetch(`/api/capadex/session/${capadexSessionId}/pipeline`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then((j: { enabled?: boolean; hops?: Array<{ key: string; data: { signals?: EmotionalSignal[] } | null }> }) => {
        if (cancelled) return;
        if (j?.enabled === false) { setEmotionalSignals([]); return; }
        const hop = (j?.hops ?? []).find(h => h.key === 'response_to_signal');
        const raw = (hop?.data?.signals ?? []) as EmotionalSignal[];
        // Surface the activated emotional/behavioural signals only — skip the
        // GENERAL_CONCERN catch-all and the implicit telemetry signals (rapid
        // answers / hesitation) which aren't student-meaningful indicators.
        const emo = raw.filter(s =>
          s.signal_type === 'activated' &&
          s.signal_key !== 'GENERAL_CONCERN' &&
          !!s.lifecycle_state,
        );
        setEmotionalSignals(emo);
      })
      .catch(err => { if (!cancelled) { console.warn('[pipeline] fetch failed, emotional indicators hidden:', err); setEmotionalSignals([]); } });
    return () => { cancelled = true; };
  }, [capadexSessionId]);

  // Phase 6B: all-stakeholder runtime summary (powers Parent/Counselor views).
  useEffect(() => {
    setRuntimeSummary(null);
    setStakeholderLens('student');
    if (!capadexSessionId) return;
    let cancelled = false;
    fetch(`/api/capadex/session/${capadexSessionId}/runtime-summary`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then((j: RuntimeSummary & { enabled?: boolean }) => {
        if (cancelled) return;
        if (j?.enabled === false || !j?.summaries) { setRuntimeSummary(null); return; }
        setRuntimeSummary(j);
      })
      .catch(err => { if (!cancelled) { console.warn('[runtime-summary] fetch failed, stakeholder toggle hidden:', err); setRuntimeSummary(null); } });
    return () => { cancelled = true; };
  }, [capadexSessionId]);

  // Phase 6B: explainability lineage ("Why am I seeing this?").
  useEffect(() => {
    setExplainData(null);
    setExplainOpen(false);
    if (!capadexSessionId) return;
    let cancelled = false;
    fetch(`/api/capadex/session/${capadexSessionId}/runtime-explainability`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then((j: RuntimeExplainability & { enabled?: boolean }) => {
        if (cancelled) return;
        if (j?.enabled === false) { setExplainData(null); return; }
        setExplainData(j);
      })
      .catch(err => { if (!cancelled) { console.warn('[runtime-explainability] fetch failed, explainability hidden:', err); setExplainData(null); } });
    return () => { cancelled = true; };
  }, [capadexSessionId]);

  useEffect(() => {
    if (!capadexSessionId) return;
    let cancelled = false;
    setOmegaXLoading(true);
    fetch(`/api/capadex/session/${capadexSessionId}/omega-x`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then(j => {
        if (cancelled) return;
        setOmegaXPayload((j?.omega_x_payload as OmegaXPayload) || OMEGA_X_EMPTY);
        setOmegaXIsSkeleton(!!j?.is_skeleton);
      })
      .catch(err => {
        // Network/server failure — keep the empty skeleton; widgets render at zero
        // rather than blanking the section. Logged for diagnostics only.
        if (!cancelled) console.warn('[omega-x] fetch failed, using empty skeleton:', err);
      })
      .finally(() => { if (!cancelled) setOmegaXLoading(false); });
    return () => { cancelled = true; };
  }, [capadexSessionId]);

  /* ── Section 11: Full OMEGA Report PDF (cover page + 4 sections) ── */
  const handleOmegaReportPdf = async () => {
    if (!omegaReport || omegaPdfLoading) return;
    setOmegaPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const navy:   [number,number,number] = [52, 78, 134];
      const navyDk: [number,number,number] = [30, 47, 82];
      const navyBg: [number,number,number] = [238, 242, 250];
      const navyBdr:[number,number,number] = [212, 219, 240];
      const textDk: [number,number,number] = [30, 43, 74];
      const textMd: [number,number,number] = [74, 85, 104];
      const textMu: [number,number,number] = [148, 163, 184];
      const white:  [number,number,number] = [255, 255, 255];
      const green:  [number,number,number] = [5, 150, 105];
      const red:    [number,number,number] = [220, 38, 38];
      const PW = 210; const ML = 14; const MR = 14; const CW = PW - ML - MR;
      let y = 0;

      const wrap = (text: string, x: number, yp: number, w: number, fs: number, col: [number,number,number], style = 'normal'): number => {
        doc.setFontSize(fs); doc.setFont('helvetica', style); doc.setTextColor(...col);
        const ls = doc.splitTextToSize(text, w); doc.text(ls, x, yp);
        return yp + ls.length * (fs * 0.42) + 1.5;
      };
      const checkPage = (needed: number) => { if (y + needed > 275) { doc.addPage(); y = 26; addPageHeader(); } };
      const addPageHeader = () => {
        doc.setFillColor(...white); doc.rect(0, 0, PW, 18, 'F');
        doc.setFillColor(...navy); doc.rect(0, 0, 3, 18, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
        doc.text('MetryxOne · CAPADEX Behavioural Intelligence Report', ML + 2, 11);
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, 18, PW, 18);
      };
      const addSectionHeader = (title: string, accent: [number,number,number] = navy) => {
        checkPage(16);
        doc.setFillColor(...accent); doc.rect(ML, y, 3, 9, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accent);
        doc.text(title.toUpperCase(), ML + 6, y + 6.5);
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.2); doc.line(ML + 6, y + 9, ML + CW, y + 9);
        y += 14;
      };

      // ── COVER PAGE ────────────────────────────────────────────────────────
      doc.setFillColor(...navyDk); doc.rect(0, 0, PW, 297, 'F');
      doc.setFillColor(...navy); doc.rect(0, 0, 8, 297, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text('MetryxOne', ML + 6, 22);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text('Behavioural Intelligence Engine™', ML + 6, 30);
      doc.setDrawColor(52, 78, 134); doc.setLineWidth(0.5); doc.line(ML + 6, 38, PW - MR, 38);
      doc.setFillColor(52, 78, 134); doc.roundedRect(ML + 6, 50, 62, 8, 1.5, 1.5, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text('OMEGA-X  INTELLIGENCE REPORT', ML + 10.5, 55.5);
      const concern = String(omegaReport.concern_name ?? capadexReport.concernName);
      doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      const cLines = doc.splitTextToSize(concern, CW - 20);
      doc.text(cLines, ML + 6, 80);
      const scoreVal = Number(omegaReport.score ?? capadexReport.score);
      const levelStr = String(omegaReport.score_level ?? capadexReport.scoreLevel);
      const stageStr = String(omegaReport.stage_label ?? capadexReport.stageLabel ?? capadexReport.stageCode);
      doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text(`${stageStr} Stage  ·  ${levelStr}  ·  ${scoreVal}/100`, ML + 6, 110);
      const scCol: [number,number,number] = scoreVal >= 80 ? navy : scoreVal >= 60 ? [37, 99, 235] : scoreVal >= 40 ? [217, 119, 6] : red;
      doc.setFillColor(...scCol); doc.circle(PW - MR - 22, 92, 17, 'F');
      doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text(String(scoreVal), PW - MR - 22, 95, { align: 'center' });
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...white);
      doc.text('/100', PW - MR - 22, 101.5, { align: 'center' });
      doc.setDrawColor(52, 78, 134); doc.setLineWidth(0.4); doc.line(ML + 6, 122, PW - MR, 122);
      const pName = String(omegaReport.participant_name ?? capadexReport.participantName);
      const genAt = String(omegaReport.generated_at ?? capadexReport.generatedAt);
      const dateStr = new Date(genAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text('Prepared for', ML + 6, 132);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text(pName, ML + 6, 141);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text(dateStr, ML + 6, 149);
      const rv = String(omegaReport.report_version ?? '2.1-omega');
      const sv = String(omegaReport.scoring_version ?? '1.4-calibrated');
      doc.setFontSize(6.5); doc.setTextColor(74, 85, 104);
      doc.text(`Report v${rv}  ·  Scoring v${sv}  ·  Confidential — prepared exclusively for ${pName}`, ML + 6, 281);

      // ── PAGE 2: RECOGNITION → SEVERITY (S5 canonical) ────────────────────
      doc.addPage(); addPageHeader(); y = 26;
      const canonical = omegaReport.canonical as { recognition?: { text: string }; reassurance?: { text: string }; meaning?: { text: string }; severity?: { level: string; text: string }; forecast?: { text: string } } | undefined;
      addSectionHeader('Recognition', navy);
      if (canonical?.recognition?.text) { y = wrap(canonical.recognition.text, ML, y, CW, 10.5, textDk); y += 5; }
      addSectionHeader('Reassurance', green);
      if (canonical?.reassurance?.text) { y = wrap(canonical.reassurance.text, ML, y, CW, 10.5, textDk); y += 5; }
      addSectionHeader('Meaning', [124, 58, 237]);
      if (canonical?.meaning?.text) { y = wrap(canonical.meaning.text, ML, y, CW, 10.5, textDk); y += 5; }
      if (canonical?.severity) {
        checkPage(20);
        doc.setFillColor(...navyBg); doc.roundedRect(ML, y, CW, 15, 2, 2, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu);
        doc.text(`SEVERITY: ${canonical.severity.level.toUpperCase()}`, ML + 4, y + 6);
        y = wrap(canonical.severity.text, ML + 4, y + 11, CW - 8, 9, textMd); y += 3;
      }

      // ── PAGE 3: FORECAST ──────────────────────────────────────────────────
      doc.addPage(); addPageHeader(); y = 26;
      const fc = omegaReport.forecast as { trajectory: string; growth_probability: number; outlook_6_weeks: string; outlook_3_months: string; next_milestone: string; risk_window: string; key_risk_factors: string[]; key_growth_enablers: string[] } | undefined;
      addSectionHeader('Forecast Intelligence', [124, 58, 237]);
      if (fc) {
        doc.setFillColor(...navyBg); doc.roundedRect(ML, y, CW, 14, 2, 2, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
        doc.text(`Trajectory: ${fc.trajectory.toUpperCase()}  ·  Growth Probability: ${fc.growth_probability}%`, ML + 4, y + 5.5);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
        doc.text(`Recovery Timeline: ${fc.trajectory === 'improving' ? 'On track' : 'With intervention: 4–8 weeks'}`, ML + 4, y + 11);
        y += 18;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu); doc.text('6-WEEK OUTLOOK', ML, y); y += 4;
        y = wrap(fc.outlook_6_weeks, ML, y, CW, 10, textDk); y += 5;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu); doc.text('3-MONTH OUTLOOK', ML, y); y += 4;
        y = wrap(fc.outlook_3_months, ML, y, CW, 10, textDk); y += 5;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor([37, 99, 235] as [number,number,number]); doc.text('NEXT MILESTONE', ML, y); y += 4;
        y = wrap(fc.next_milestone, ML, y, CW, 10, textDk); y += 5;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...red); doc.text('CRITICAL RISK WINDOW', ML, y); y += 4;
        y = wrap(fc.risk_window, ML, y, CW, 10, textDk); y += 5;
        if (fc.key_risk_factors?.length) {
          doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...red); doc.text('RISK FACTORS', ML, y); y += 4;
          fc.key_risk_factors.forEach(rf => { y = wrap(`• ${rf}`, ML + 3, y, CW - 3, 9, textMd); }); y += 3;
        }
        if (fc.key_growth_enablers?.length) {
          doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...green); doc.text('GROWTH ENABLERS', ML, y); y += 4;
          fc.key_growth_enablers.forEach(ge => { y = wrap(`• ${ge}`, ML + 3, y, CW - 3, 9, textMd); }); y += 3;
        }
      }

      // ── PAGE 4: COGNITIVE PROFILE ─────────────────────────────────────────
      doc.addPage(); addPageHeader(); y = 26;
      addSectionHeader('Cognitive Profile', navy);
      const subs = omegaReport.subdomains as Array<{ name: string; score: number }> | undefined;
      if (subs?.length) {
        doc.setFillColor(...navy); doc.rect(ML, y, CW, 8, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
        ['Subdomain', 'Score', 'Level', 'Bar'].forEach((h, i) => doc.text(h, ML + [3, 90, 114, 145][i], y + 5.5));
        y += 9;
        subs.forEach((sd, idx) => {
          checkPage(8);
          doc.setFillColor(...(idx % 2 === 0 ? navyBg as [number,number,number] : white)); doc.rect(ML, y, CW, 7, 'F');
          const sc = sd.score;
          const lvC: [number,number,number] = sc >= 75 ? green : sc >= 50 ? [217, 119, 6] : red;
          doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textDk); doc.text(sd.name, ML + 3, y + 4.8);
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...lvC); doc.text(`${sc}%`, ML + 90, y + 4.8);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd); doc.text(sc >= 75 ? 'Proficient' : sc >= 50 ? 'Developing' : 'Emerging', ML + 114, y + 4.8);
          doc.setFillColor(229, 231, 235); doc.roundedRect(ML + 145, y + 2, 35, 3, 0.5, 0.5, 'F');
          doc.setFillColor(...lvC); doc.roundedRect(ML + 145, y + 2, 35 * sc / 100, 3, 0.5, 0.5, 'F');
          y += 7.2;
        });
        y += 4;
      }

      // ── PAGE 5: INTERVENTIONS ─────────────────────────────────────────────
      doc.addPage(); addPageHeader(); y = 26;
      addSectionHeader('Intervention Sequence', green);
      type RawIv = { title?: string; description?: string; why_it_works?: string; timing?: string; effort_required?: string; phase_label?: string; success_marker?: string; resistance_prediction?: string };
      const ivSeq = omegaReport.intervention_sequence as RawIv[] | undefined;
      const canonIv = canonical?.interventions as Array<{ title: string; why: string; action: string; difficulty: string; timeline: string }> | undefined;
      const items = ivSeq?.length
        ? ivSeq.slice(0, 5).map(iv => ({ title: iv.title ?? '', why: iv.why_it_works ?? '', action: iv.description ?? '', difficulty: iv.effort_required ?? 'medium', timeline: iv.timing ?? '', phase: iv.phase_label ?? '', success: iv.success_marker ?? '', resist: iv.resistance_prediction ?? '' }))
        : (canonIv ?? []).slice(0, 3).map(iv => ({ title: iv.title, why: iv.why, action: iv.action, difficulty: iv.difficulty, timeline: iv.timeline, phase: '', success: '', resist: '' }));
      if (!items.length) {
        // S8 Rule 3: No interventions — honestly-orphaned concern. Show general,
        // explicitly low-confidence guidance, clearly distinguished from measured intelligence.
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu);
        doc.text('GENERAL GUIDANCE — LOW CONFIDENCE', ML, y); y += 5;
        y = wrap('We could not detect a specific, measurable behavioural pattern for this concern from the responses, so no personalised interventions are shown. The general starting points below are not based on a measured pattern but apply broadly.', ML, y, CW, 10, textMd);
        y += 4;
        ['Establish a consistent daily routine with fixed start and end times.', 'Reduce the highest-priority environmental trigger for 5 consecutive days.', 'Practice 5-minute intentional reflection at the end of each day on what worked.'].forEach((a, i) => {
          y = wrap(`${i + 1}. ${a}`, ML + 3, y, CW - 3, 10, textDk); y += 3;
        });
      } else {
        const ivCols: [number,number,number][] = [[5,150,105],[37,99,235],[124,58,237],[217,119,6],[220,38,38]];
        items.forEach((iv, i) => {
          checkPage(38);
          const ic = ivCols[i] ?? navy;
          doc.setFillColor(...ic); doc.rect(ML, y, 3, 9, 'F');
          doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu);
          doc.text(iv.phase || `Step ${i + 1}`, ML + 6, y + 4);
          doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDk);
          doc.text(iv.title, ML + 6, y + 10); y += 14;
          if (iv.why) { doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu); doc.text('WHY IT WORKS', ML + 6, y); y += 3; y = wrap(iv.why, ML + 6, y, CW - 6, 9, textDk); y += 2; }
          if (iv.action) { doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(37, 99, 235); doc.text('THE ACTION', ML + 6, y); y += 3; y = wrap(iv.action, ML + 6, y, CW - 6, 9, textDk); y += 2; }
          const meta: string[] = [];
          if (iv.difficulty) meta.push(`Effort: ${iv.difficulty}`);
          if (iv.timeline) meta.push(`Timeline: ${iv.timeline}`);
          if (meta.length) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu); doc.text(meta.join('   ·   '), ML + 6, y); y += 3.5; }
          if (iv.success) { doc.setFontSize(8); doc.setTextColor(...green); doc.text(`✓ ${iv.success}`, ML + 6, y); y += 3.5; }
          if (iv.resist) { doc.setFontSize(8); doc.setTextColor(...red); doc.text(`⚠ ${iv.resist}`, ML + 6, y); y += 3.5; }
          doc.setDrawColor(...navyBdr); doc.setLineWidth(0.2); doc.line(ML, y + 2, ML + CW, y + 2); y += 7;
        });
      }

      doc.save(`CAPADEX-${concern.replace(/\s+/g, '-')}-Report.pdf`);
    } catch (err) {
      console.error('[omega-pdf]', err);
    } finally {
      setOmegaPdfLoading(false);
    }
  };

  const handleCopyActionPlan = () => {
    if (rieRecommendations.length === 0) return;
    const lines: string[] = ['Your Action Plan', ''];
    lines.push('Based on your assessment, here are personalised next steps to support your growth:', '');
    rieRecommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec.title}`);
      lines.push(`   ${rec.expected_outcome}`);
      lines.push(`   Timing: ${rec.timing}  ·  Intensity: ${rec.intensity}`);
      lines.push('');
    });
    if (rieHasEscalation) {
      lines.push('Note: Your results suggest speaking with a qualified counsellor would be beneficial.');
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setRieActionPlanCopied(true);
      setTimeout(() => setRieActionPlanCopied(false), 2500);
    });
  };

  const handleShareActionPlan = async () => {
    if (rieRecommendations.length === 0 && !rieHasEscalation) return;
    setRieActionPlanSharing(true);
    try {
      const lines: string[] = ['📋 My Action Plan — MetryxOne', ''];
      lines.push('Based on my CAPADEX behavioural assessment:', '');
      rieRecommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec.title}`);
        lines.push(`   ${rec.expected_outcome}`);
        lines.push(`   Timing: ${rec.timing}  ·  Intensity: ${rec.intensity}`);
        lines.push('');
      });
      if (rieHasEscalation) {
        lines.push('⚠️ Note: My results suggest speaking with a qualified counsellor would be beneficial.');
        lines.push('');
      }
      lines.push('— Generated by MetryxOne Behavioural Intelligence');
      const shareText = lines.join('\n');
      const shareTitle = 'My Action Plan — MetryxOne';
      const isMobile = typeof window !== 'undefined' &&
        (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
      const canShare = isMobile && typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      if (!canShare) {
        await navigator.clipboard.writeText(shareText);
        setDesktopCopied(true);
        setTimeout(() => setDesktopCopied(false), 2500);
        return;
      }
      let sharePayload: ShareData = { title: shareTitle, text: shareText };
      if (actionPlanRef.current) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(actionPlanRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const file = new File([blob], 'action-plan.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              sharePayload = { title: shareTitle, text: shareText, files: [file] };
            }
          }
        } catch (_) {}
      }
      try {
        await navigator.share(sharePayload);
        setRieActionPlanShared(true);
        setTimeout(() => setRieActionPlanShared(false), 2500);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          await navigator.clipboard.writeText(shareText);
          setRieActionPlanShared(true);
          setTimeout(() => setRieActionPlanShared(false), 2500);
        }
      }
    } finally {
      setRieActionPlanSharing(false);
    }
  };

  const handleDownloadActionPlan = async () => {
    if (rieRecommendations.length === 0 || rieActionPlanPdfLoading) return;
    setRieActionPlanPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const navy:    [number,number,number] = [52, 78, 134];
      const navyDk:  [number,number,number] = [30, 47, 82];
      const navyBg:  [number,number,number] = [238, 242, 250];
      const navyBdr: [number,number,number] = [212, 219, 240];
      const teal:    [number,number,number] = [16, 185, 129];
      const textDk:  [number,number,number] = [30, 43, 74];
      const textMd:  [number,number,number] = [74, 85, 104];
      const textMu:  [number,number,number] = [148, 163, 184];
      const white:   [number,number,number] = [255, 255, 255];
      const DOMAIN_COLORS: Record<string, [number,number,number]> = {
        learning:[37,99,235], behavioural:navy, engagement:[13,148,136],
        emotional:[124,58,237], resilience:[5,150,105], employability:[217,119,6],
        leadership:[52,78,134], recovery:[220,38,38],
      };
      const PW = 210; const ML = 14; const MR = 14; const CW = PW - ML - MR;
      let y = 0;
      const wrap = (text: string, x: number, yp: number, w: number, fs: number, col: [number,number,number], style = 'normal'): number => {
        doc.setFontSize(fs); doc.setFont('helvetica', style); doc.setTextColor(...col);
        const ls = doc.splitTextToSize(text, w); doc.text(ls, x, yp);
        return yp + ls.length * (fs * 0.42) + 1.5;
      };
      const checkPage = (needed: number) => {
        if (y + needed > 278) { doc.addPage(); y = 14; doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, 0, PW, 0); }
      };
      doc.setFillColor(...white); doc.rect(0, 0, PW, 22, 'F');
      doc.setFillColor(...navy); doc.rect(0, 0, 3, 22, 'F');
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.4); doc.line(0, 22, PW, 22);
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
      doc.text('MetryxOne', ML + 2, 10);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text('Behavioural Intelligence', ML + 2, 16.5);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), PW - MR, 10, { align: 'right' });
      y = 29;
      doc.setFillColor(...navyBg); doc.roundedRect(ML, y, CW, 18, 2, 2, 'F');
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.roundedRect(ML, y, CW, 18, 2, 2, 'S');
      doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navyDk);
      doc.text('Your Action Plan', ML + 6, y + 8);
      const subtitle = [rpt.participantName, rpt.concernName].filter(Boolean).join(' · ');
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
      doc.text(subtitle, ML + 6, y + 14.5);
      y += 24;
      y = wrap('Based on your assessment, here are personalised next steps to support your growth:', ML, y, CW, 9, textMd);
      y += 4;
      rieRecommendations.forEach((rec, i) => {
        const col = DOMAIN_COLORS[rec.domain] || navy;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(rec.title, CW - 20);
        const titleH = titleLines.length * 4.6;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        const outLines = doc.splitTextToSize(rec.expected_outcome, CW - 20);
        const outH = outLines.length * 4.0;
        const cardH = Math.max(28, 5 + titleH + 2 + outH + 3 + 5 + 4);
        checkPage(cardH + 4);
        doc.setFillColor(...col); doc.roundedRect(ML, y, 2.5, cardH, 1, 1, 'F');
        doc.setFillColor(255, 255, 255); doc.roundedRect(ML + 2.5, y, CW - 2.5, cardH, 0, 1, 'F');
        doc.setDrawColor(...col); doc.setLineWidth(0.2); doc.roundedRect(ML, y, CW, cardH, 1, 1, 'S');
        doc.setFillColor(...col); doc.circle(ML + 9, y + 8, 3.5, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
        doc.text(String(i + 1), ML + 9, y + 9.3, { align: 'center' });
        let cy = y + 7;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...col);
        doc.text(titleLines, ML + 16, cy); cy += titleH + 2;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
        doc.text(outLines, ML + 16, cy); cy += outH + 3;
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text(`Timing: ${rec.timing}`, ML + 16, cy);
        const timW = doc.getTextWidth(`Timing: ${rec.timing}`);
        doc.text(`·  ${rec.intensity} intensity`, ML + 16 + timW + 2, cy);
        y += cardH + 4;
      });
      if (rieHasEscalation) {
        checkPage(18);
        doc.setFillColor(254, 242, 242); doc.roundedRect(ML, y, CW, 14, 1.5, 1.5, 'F');
        doc.setDrawColor(254, 202, 202); doc.setLineWidth(0.25); doc.roundedRect(ML, y, CW, 14, 1.5, 1.5, 'S');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(153, 27, 27);
        doc.text('Counsellor Recommended', ML + 5, y + 6);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(185, 28, 28);
        doc.text('Your results suggest a conversation with a qualified counsellor would be beneficial.', ML + 5, y + 11.5);
        y += 18;
      }
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...navyBg); doc.rect(0, 283, PW, 14, 'F');
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, 283, PW, 283);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text('MetryxOne · Behavioural Intelligence Platform · metryx.one', ML, 290);
        doc.text('Confidential — for personal use only', PW - MR, 290, { align: 'right' });
      }
      const safe = rpt.concernName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      doc.save(`MetryxOne_ActionPlan_${safe}.pdf`);
    } catch (err) {
      console.error('Action plan PDF error:', err);
    } finally {
      setRieActionPlanPdfLoading(false);
    }
  };

  // ── Brand palette — hoisted so all IIFEs and JSX sections can access it ──
  const B = { navy:'#344E86', navyDark:'#1E2F52', navyBg:'#EEF2FA', navyBorder:'#D4DBF0',
    teal:'#0D9488', tealBg:'#F0FDFA', tealBorder:'#CCFBF1', tealText:'#134E4A',
    amber:'#D97706', amberBg:'#FFFBEB', amberBorder:'#FDE68A', amberText:'#78350F',
    red:'#DC2626', redBg:'#FEF2F2', redBorder:'#FECACA',
    textPrimary:'#1E2B4A', textMid:'#4A5568', textMuted:'#94A3B8', divider:'#F0F2F7' };
  const rpt = capadexReport;
  const score = Math.round(rpt.score);
  const pctColor = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const paidStages = [
    { code: 'CAP_INS', label: 'Insight',  color: '#10B981', price: 'Paid', icon: TrendingUp,
      tagline: 'Uncover the patterns behind your Curiosity results',
      benefits: ['Deep pattern analysis', 'Root cause mapping', 'Personalised insight report'] },
    { code: 'CAP_GRW', label: 'Growth',   color: '#F59E0B', price: 'Paid', icon: BarChart3,
      tagline: 'Build targeted strategies and lasting habits',
      benefits: ['Action plan creation', 'Habit-building roadmap', 'Progress tracking framework'] },
    { code: 'CAP_MAS', label: 'Mastery',  color: '#8B5CF6', price: 'Paid', icon: Award,
      tagline: 'Achieve peak performance and sustained excellence',
      benefits: ['Peak performance blueprint', 'Long-term mastery path', 'Expert coaching alignment'] },
  ];

  // ── Hoisted concern-category helpers (used both inside IIFEs and in outer JSX) ──
  const cl = rpt.concernName.toLowerCase();
  const isAttention = /attention|distract|focus|span|fidget|restless|wander/.test(cl);
  const isScreen    = /screen|phone|social|gaming|internet|digital/.test(cl);
  const isCareer    = /career|job|role|profession|transition|stuck|workplace|employ|purpose|direction|leadership|promotion|burnout|meaning|identity/.test(cl);
  const isAcademic  = (() => {
    if (assesseeType === 'a-student' || assesseeType === 'my-child') return true;
    if (selectedPersona === 'student' || selectedPersona === 'teacher' || selectedPersona === 'campus') return true;
    const age = parseInt(userAge ?? '', 10);
    if (!isNaN(age) && age < 22 && selectedPersona !== 'jobseeker' && selectedPersona !== 'professional') return true;
    return false;
  })();
  const narrativeCat = isAttention ? 'attention' : isScreen ? 'screen' : isCareer ? 'career' : 'default';
  const teaserMap: Record<string, string[]> = {
    attention: [
      `Why does focus drop at specific times — and what can be done in those exact moments?`,
      `What emotional or environmental trigger is behind the attention pattern — it's almost never what people guess.`,
      `How does this attention profile compare to 10,000+ others — and what separates the top performers?`,
    ],
    screen: [
      `What emotional need is screen use actually meeting — and what healthier habit can replace it?`,
      `What is the exact trigger-loop behind these screen habits — mapped to time of day and situation?`,
      `What is the one boundary change that would reclaim the most time — based on this specific pattern?`,
    ],
    career: [
      `Which specific competencies are creating friction in this career transition — and what is the exact gap between your current profile and your target role?`,
      `How does your behavioural pattern compare to verified professional standards for your sector — and where does your potential sit relative to that benchmark?`,
      `Which internal blocks versus structural circumstances are actually driving "${rpt.concernName}" — and what is within your direct control to change right now?`,
    ],
    default: [
      `What is the root cause behind the "${rpt.concernName}" pattern — and why surface habits haven't fixed it?`,
      `Which specific triggers are driving the pattern — and when is the best moment to intervene?`,
      `What does the full behavioural profile look like across all 19 domains — and what does it predict?`,
    ],
  };
  const teasers = teaserMap[narrativeCat] || teaserMap['default'];

  return (

  <div id="capadex-report-root" className="max-h-[85vh] overflow-y-auto" ref={capadexReportRef} style={{ background: '#ffffff' }}>
    {/* ── Report header — clean white card ── */}
    <div className="px-5 pt-4 pb-4" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8EBF4' }}>
      {/* Logo row */}
      <div className="flex items-center justify-between mb-4">
        <img src={metryxLogo} alt="MetryxOne" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
        <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={15} /></button>
      </div>
      {/* Score + concern details */}
      {(() => {
        const s = parseInt(score) || 0;
        const circ = 2 * Math.PI * 28;
        const filled = (circ * s / 100).toFixed(2);
        const levelColor = s >= 80 ? '#344E86' : s >= 60 ? '#2563EB' : s >= 40 ? '#D97706' : '#DC2626';
        const levelLabel = s >= 80 ? 'Advanced' : s >= 60 ? 'Proficient' : s >= 40 ? 'Developing' : 'Emerging';
        return (
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
    <svg width="80" height="80" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r="34" fill="none" stroke={`${levelColor}12`} strokeWidth="10" />
      <circle cx="42" cy="42" r="28" fill="#F8F9FB" stroke="#E8EBF4" strokeWidth="8" />
      <circle cx="42" cy="42" r="28" fill="none" stroke={levelColor} strokeWidth="8"
        strokeDasharray={`${filled} ${circ.toFixed(2)}`}
        strokeLinecap="round" transform="rotate(-90 42 42)"
        style={{ filter: `drop-shadow(0 0 4px ${levelColor}50)` }}
      />
      <text x="42" y="38" textAnchor="middle" fill="#111827" fontSize="19" fontWeight="800" fontFamily="'Plus Jakarta Sans','DM Sans',sans-serif">{s}</text>
      <text x="42" y="51" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily="'Plus Jakarta Sans','DM Sans',sans-serif">/100</text>
    </svg>
            </div>
            <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1.5 flex-wrap mb-2">
      <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${levelColor}12`, border: `1px solid ${levelColor}30` }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: levelColor }} />
        <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: levelColor }}>{levelLabel}</span>
      </div>
      {(() => {
        // Provenance pill — mirrors CapadexClarifyPhase / CapadexBridgePhase.
        const prov = claritySource === 'master_curated'
          ? { label: 'Tailored to your concern', tone: '#0E9384' }
          : claritySource === 'adaptive_bank' || claritySource === 'static_fallback'
            ? { label: 'General behavioural cluster', tone: '#94A3B8' }
            : null;
        if (!prov) return null;
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ color: prov.tone, backgroundColor: `${prov.tone}10`, border: `1px solid ${prov.tone}30` }}
            title={claritySource === 'master_curated'
              ? 'These questions were mapped directly to the master concern you selected.'
              : 'No curated questions exist for this exact concern yet — using the closest behavioural cluster.'}>
            {prov.label}
          </span>
        );
      })()}
    </div>
    <p className="text-[20px] font-bold leading-tight" style={{ color: '#111827', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", letterSpacing: '-0.01em' }}>{rpt.concernName}</p>
    <p className="text-[13px] mt-1" style={{ color: '#9CA3AF', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>
      {rpt.participantName ? `Prepared for ${rpt.participantName}` : 'Personalised Report'} · Curiosity Assessment
    </p>
            </div>
          </div>
        );
      })()}
      {onNavigate && (
        <div data-pdf-hide="true" className="mt-4 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
             style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div className="text-[12px]" style={{ color: '#1E40AF' }}>
            <span className="font-semibold">Go deeper:</span> map this snapshot onto your full competency profile.
          </div>
          <button
            onClick={() => { handleClose(); onNavigate('career-builder?tab=assessment'); }}
            data-testid="capadex-take-competency-assessment"
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:brightness-110 active:scale-95 whitespace-nowrap"
            style={{ background: '#0B3C5D' }}>
            Take Competency Assessment →
          </button>
        </div>
      )}
    </div>

    {/* ── OMEGA-X Behavioural Intelligence Widgets (Module 1) ──
        Reads omegaXPayload state (fetched from /api/capadex/session/:id/omega-x).
        Renders four animated progress rings (Overthinking, Indecisiveness,
        Perfectionism, Burnout) with warm non-clinical tooltips on the title
        and the ring itself. Defaults to 0 on missing keys — every layer is
        optional in the type so the skeleton response keeps this section
        render-safe. Hidden in PDF export to avoid duplicating data that
        lives in the dedicated OMEGA report. */}
    {capadexSessionId && (
      <div data-pdf-hide="true" className="px-5 py-4" style={{ background: '#FAFBFD', borderBottom: '1px solid #E8EBF4' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5" style={{ color: METRYX_NAVY }} />
            <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: METRYX_NAVY }}>
              Behavioural Intelligence
            </span>
            {omegaXIsSkeleton && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>
                Preliminary
              </span>
            )}
          </div>
          {omegaXLoading && <span className="text-[9px]" style={{ color: '#94A3B8' }}>Loading…</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              label: 'Overthinking',  value: omegaXPayload.behavioural?.overthinking  ?? 0, tone: '#7C3AED',
              tip: 'How often your mind cycles back over a decision. High does not mean wrong — it means your brain is being careful.',
            },
            {
              label: 'Indecisiveness', value: omegaXPayload.behavioural?.indecisiveness ?? 0, tone: '#0EA5E9',
              tip: 'A measure of how long you pause before committing. Pauses are wisdom — this just tracks them.',
            },
            {
              label: 'Perfectionism', value: omegaXPayload.behavioural?.perfectionism ?? 0, tone: '#0891B2',
              tip: 'How tightly you re-check your answers. A trait, not a flaw — we surface it so you can pace yourself kindly.',
            },
            {
              label: 'Burnout Risk',  value: omegaXPayload.risk?.burnout_risk         ?? 0, tone: '#DC2626',
              tip: 'An estimate of mental load right now. If high, this is your cue to rest — not a verdict on your career.',
            },
          ].map(({ label, value, tone, tip }) => (
            <OmegaProgressRing key={label} label={label} value={value} tone={tone} tooltip={tip} />
          ))}
        </div>
      </div>
    )}

    {/* ── PDF + EMAIL ACTION BAR ── */}
    <div data-pdf-hide="true" className="px-5 py-3 space-y-2" style={{ background: '#F8F9FB', borderBottom: '1px solid #E8EBF4' }}>
      {/* Row 1: Action plan PDF + Email */}
      <div className="flex items-center gap-2.5">
        {capadexPdfError ? (
          <span className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[10px] font-medium px-2 truncate"
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            title={capadexPdfError}>
            ⚠ {capadexPdfError.slice(0, 80)}
          </span>
        ) : capadexPdfBlobUrl === 'PRINT' ? (
          <span className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[11px] font-medium px-2"
            style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
            ✓ Print dialog opened — choose "Save as PDF"
          </span>
        ) : capadexPdfBlobUrl ? (
          <a
            href={capadexPdfBlobUrl}
            download={capadexPdfFilename || 'MetryxOne_Report.pdf'}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', color: '#fff', boxShadow: '0 2px 10px rgba(5,150,105,0.25)', textDecoration: 'none' }}
          >
            <Download size={13} />Save PDF
          </a>
        ) : (
          <button
            onClick={() => handleCapadexPdf()}
            disabled={capadexPdfLoading}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #344E86 0%, #2563EB 100%)', color: '#fff', boxShadow: '0 2px 10px rgba(52,78,134,0.22)' }}
          >
            {capadexPdfLoading
              ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Generating…</>
              : <><Download size={13} />Download Report PDF</>
            }
          </button>
        )}
        <button
          onClick={handleCapadexEmailReport}
          disabled={capadexEmailLoading || capadexEmailSent}
          className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold border transition-all hover:bg-gray-50 disabled:opacity-60"
          style={{ background: '#fff', color: capadexEmailSent ? '#059669' : '#344E86', borderColor: capadexEmailSent ? '#A7F3D0' : '#D4DBF0' }}
        >
          {capadexEmailSent
            ? <><CheckCircle size={13} />Sent!</>
            : capadexEmailLoading
            ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending…</>
            : <><Send size={13} />Email Report</>
          }
        </button>
      </div>
      {/* Row 2: Section 11 — Full OMEGA Intelligence Report PDF */}
      {omegaReport && (
        <button
          onClick={handleOmegaReportPdf}
          disabled={omegaPdfLoading}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold border transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: omegaPdfLoading ? '#F5F3FF' : 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}
        >
          {omegaPdfLoading
            ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg><span style={{ color: '#7C3AED' }}>Building Full Report PDF…</span></>
            : <><Download size={13} />Download Full OMEGA-X Intelligence Report</>
          }
        </button>
      )}
    </div>

    {/* ── Section 10: Stagger animation keyframes ── */}
    <style>{`
      @keyframes capadex-fade-up {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .capadex-section { animation: capadex-fade-up 0.42s ease both; }
    `}</style>

    {/* ── Section 8: Error Handling Rules ── */}

    {/* Rule 2: Low confidence disclaimer */}
    {omegaReport && (() => {
      const rel = Number((omegaReport.calibration as Record<string,unknown>)?.reliability_score ?? 1);
      if (rel >= 0.6) return null;
      return (
        <div className="mx-5 mt-3 px-4 py-3 rounded-xl flex items-start gap-3 capadex-section" style={{ animationDelay: '0.05s', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <AlertTriangle size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-[11px] font-bold mb-0.5" style={{ color: '#92400E' }}>Indicative Results — Lower Confidence</p>
            <p className="text-[10px] leading-snug" style={{ color: '#78350F' }}>
              Your response reliability is {Math.round(rel * 100)}%. These results are directionally valid but should be treated as initial indicators. A fuller assessment with more consistent responses will increase confidence. Conflicting or rushed responses reduce reliability.
            </p>
          </div>
        </div>
      );
    })()}

    {/* Rule 4: Conflicting signals note */}
    {omegaReport && (() => {
      const cont = omegaReport.contradictions as { has_contradictions?: boolean; reliability_impact?: string; interpretation?: string } | undefined;
      if (!cont?.has_contradictions || cont.reliability_impact === 'none' || cont.reliability_impact === 'minor') return null;
      return (
        <div className="mx-5 mt-3 px-4 py-3 rounded-xl flex items-start gap-3 capadex-section" style={{ animationDelay: '0.08s', background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <Shield size={14} style={{ color: '#7C3AED', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-[11px] font-bold mb-0.5" style={{ color: '#5B21B6' }}>Conflicting Signal Pattern Detected</p>
            <p className="text-[10px] leading-snug" style={{ color: '#4C1D95' }}>
              {cont.interpretation ?? 'Some response inconsistencies were detected. The strongest signal cluster has been prioritised. Your results remain directionally valid — the contradictions have been factored into your confidence score.'}
            </p>
          </div>
        </div>
      );
    })()}

    {/* Rule 1: Incomplete data fallback narrative */}
    {(() => {
      const hasSubdomains = rpt.subdomains && rpt.subdomains.length > 0;
      if (hasSubdomains) return null;
      return (
        <div className="mx-5 mt-3 px-4 py-3 rounded-xl capadex-section" style={{ animationDelay: '0.1s', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p className="text-[11px] font-bold mb-1" style={{ color: '#065F46' }}>Partial Assessment Complete</p>
          <p className="text-[10px] leading-snug" style={{ color: '#064E3B' }}>
            Your overall score and level have been calculated from available responses. Subdomain-level intelligence requires completion of the full assessment. Your results above are a valid starting point — the complete picture requires the full stage assessment.
          </p>
        </div>
      );
    })()}

    {/* Rule 3: No interventions — show generic baseline actions */}
    {omegaReport && (() => {
      const seq = omegaReport.intervention_sequence as unknown[] | undefined;
      if (seq && seq.length > 0) return null;
      return (
        <div className="mx-5 mt-3 rounded-xl overflow-hidden capadex-section" style={{ animationDelay: '0.12s', background: '#fff', border: '1px solid #E8EBF4' }}>
          <div className="px-4 pt-3 pb-2.5 flex items-center gap-2" style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
            <Sparkles size={13} style={{ color: '#2563EB', flexShrink: 0 }} />
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#1D4ED8' }}>General Guidance — Low Confidence</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] leading-snug mb-2.5" style={{ color: '#374151' }}>
              We could not detect a specific, measurable behavioural pattern for this concern from your responses, so no personalised intelligence is shown. The general, evidence-informed starting points below are <strong>not based on a measured pattern</strong> but apply broadly while a fuller picture develops.
            </p>
            {[
              { action: 'Establish one fixed anchor behaviour you repeat at the same time each day — consistency precedes change.', timing: 'Start today' },
              { action: 'Identify the single most common trigger for your concern pattern and reduce one exposure to it for 5 days.', timing: 'Days 1–5' },
              { action: 'Practise 5 minutes of structured reflection at day-end — write one thing you noticed about your own pattern.', timing: 'Daily' },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-2.5 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black text-white mt-0.5" style={{ background: '#2563EB' }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] leading-snug" style={{ color: '#111827' }}>{b.action}</p>
                  <p className="text-[9px] mt-0.5 font-semibold" style={{ color: '#6B7280' }}>{b.timing}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })()}

    {/* ── REPORT BODY ── */}
    {(() => {
      const normalisedLevel = rpt.scoreLevel === 'Mastery' ? 'Advanced' : rpt.scoreLevel;
      const lvl = normalisedLevel as 'Advanced' | 'Proficient' | 'Developing' | 'Emerging';
      const name = rpt.participantName ? rpt.participantName.split(' ')[0] : 'You';

      /* ── Subdomain insight using shared behavioural-insights library ── */
      const getDomainInfo = (domainName: string, score: number) => {
        const ins = getSubdomainInsight(domainName, Math.min(100, Math.max(0, Math.round(score))));
        return { label: ins.title, strongDesc: ins.insight, buildingDesc: ins.insight };
      };


      const strongDomains  = rpt.subdomains.filter(sd => Math.round(Number(sd.avg_score)) >= 70);
      const buildingDomains = rpt.subdomains.filter(sd => Math.round(Number(sd.avg_score)) < 70);

      /* ── Narrative headline ── */
      const narrativeMap: Record<string, Record<string, { headline: string; story: string }>> = {
        attention: {
          Advanced:   { headline: `${name} has strong natural focus — but there are hidden patterns worth uncovering.`, story: `These Curiosity results show real self-awareness and attention endurance. Yet even the strongest focus has invisible drivers — specific triggers, emotional links, and time-of-day patterns — that only the Insight stage can reveal.` },
          Proficient: { headline: `${name} manages attention well — the question is what's holding the ceiling.`, story: `Functioning above average means the gap between current performance and potential is narrow but significant. The Insight stage is built to find exactly what's creating that ceiling.` },
          Developing: { headline: `${name}'s attention has clear strengths — and a hidden gap creating the struggle.`, story: `These results show some solid foundations, but something is consistently pulling focus off-track. It's rarely what people think it is. The Insight stage finds the real cause.` },
          Emerging:   { headline: `${name}'s attention pattern is telling an important story — one worth understanding fully.`, story: `The Curiosity results are just the surface. Behind every attention struggle is a specific pattern of triggers, timing, and habits. The Insight stage maps that pattern precisely so real change becomes possible.` },
        },
        screen: {
          Advanced:   { headline: `${name} has strong screen-time awareness — but awareness alone rarely creates change.`, story: `These results show clear understanding of what's happening with screen habits. The Insight stage goes deeper — uncovering the emotional needs being met and building a personalised replacement strategy.` },
          Proficient: { headline: `${name} is managing screen time reasonably — but something keeps pulling attention back.`, story: `There is more awareness here than most, yet the pull persists. The Insight stage reveals why — and delivers a pattern-specific plan, not generic advice.` },
          Developing: { headline: `${name}'s screen habits have a pattern — and patterns can be decoded and changed.`, story: `What feels like a willpower problem is almost always a trigger-and-reward cycle. The Insight stage maps that specific cycle so it can be interrupted at exactly the right moment.` },
          Emerging:   { headline: `${name}'s relationship with screens is more complex than it appears on the surface.`, story: `There are emotional and environmental drivers behind these screen habits that generic tips will never address. The Insight stage is where the real map gets drawn.` },
        },
        career: {
          Advanced:   { headline: `${name}'s potential is measurable — and the Insight Stage will map the exact gap to the next level.`, story: `Strong self-awareness around "${rpt.concernName}" is visible in these results. That awareness is a genuine advantage, but awareness alone is not a career transition strategy. The Insight stage decodes the specific competency gap between your current profile and the verified standard for your target role — and builds the precise roadmap for closing it.` },
          Proficient: { headline: `${name}'s profile has clear strengths — and a precise competency gap worth understanding.`, story: `Solid professional self-awareness is visible here around "${rpt.concernName}". The Insight stage goes further — running a competency benchmarking analysis to identify the exact gap between your current behavioural profile and verified professional standards. Not generic advice. A precise gap map.` },
          Developing: { headline: `${name}'s results reveal exactly why this career situation keeps repeating.`, story: `The "${rpt.concernName}" pattern has a specific structure — not bad luck, not lack of effort. The Curiosity results establish the baseline. The Insight stage decodes the competency gap: which specific capabilities your profile is missing relative to your target role, and what it would take to close that gap in 90 days.` },
          Emerging:   { headline: `${name}'s results point to a competency gap that can be decoded — and closed.`, story: `Behind "${rpt.concernName}" is a specific pattern of professional friction — driven by a gap between current behavioural profile and the competency standard for the role being targeted. The Insight stage is where MetryxOne maps that gap precisely: role by role, capability by capability, with a clear path forward.` },
        },
        default: {
          Advanced:   { headline: `${name} shows strong awareness — and there's a deeper layer waiting to be understood.`, story: `These Curiosity results reveal genuine self-awareness around "${rpt.concernName}". The Insight stage will show what sits beneath that awareness — the patterns, the triggers, the exact levers to pull.` },
          Proficient: { headline: `${name} is doing well — and the Insight stage will show exactly what to do next.`, story: `The results are solid. The Insight stage takes that foundation and builds a precise picture of what's holding the ceiling and how to break through it.` },
          Developing: { headline: `${name}'s results reveal something important about "${rpt.concernName}".`, story: `These Curiosity results are the first honest look at what's really going on. The Insight stage goes several layers deeper — finding the root cause, not just the symptoms.` },
          Emerging:   { headline: `${name}'s Curiosity results are the beginning of a real breakthrough.`, story: `Every significant change starts with accurate information. These results have created that starting point. The Insight stage builds the complete map of the "${rpt.concernName}" pattern.` },
        },
      };
      const narrativeComputed = narrativeMap[narrativeCat]?.[lvl] || narrativeMap['default']?.[lvl] || narrativeMap['default']['Developing'];
      const isExpertReviewed = rpt.reviewStatus === 'published';
      const narrative = {
        headline: (isExpertReviewed && rpt.headlineOverride) ? rpt.headlineOverride : narrativeComputed.headline,
        story:    (isExpertReviewed && rpt.narrativeOverride) ? rpt.narrativeOverride : narrativeComputed.story,
      };

      /* ── Brand score-level palette: Advanced=navy · Proficient=blue · Developing=amber · Emerging=red ── */
      const lvlCol = { Advanced:'#344E86', Proficient:'#2563EB', Developing:'#D97706', Emerging:'#DC2626' } as Record<string,string>;
      const lvlBg  = { Advanced:'#EEF2FA', Proficient:'#EFF6FF', Developing:'#FFFBEB', Emerging:'#FEF2F2' } as Record<string,string>;
      const lvlBdr = { Advanced:'#D4DBF0', Proficient:'#BFDBFE', Developing:'#FDE68A', Emerging:'#FECACA' } as Record<string,string>;

      /* ── Score context ── */
      const scoreNum = parseInt(score) || 0;
      const accentCol = lvlCol[lvl] ?? B.navy;
      const accentBg  = lvlBg[lvl]  ?? B.navyBg;
      const accentBdr = lvlBdr[lvl] ?? B.navyBorder;
      const scoreContextMap: Record<string, string> = {
        Advanced:   `A score of ${scoreNum} is among the highest for this concern — reflecting strong self-awareness and cognitive regulation. This is a meaningful result that signals real capacity for growth at the next level.`,
        Proficient: `A score of ${scoreNum} reflects above-average self-awareness and solid performance. There are genuine strengths here, alongside specific areas where targeted support would produce measurable change.`,
        Developing: `A score of ${scoreNum} reflects an emerging pattern — enough awareness to identify the concern, with clear room for structured development. This is exactly the stage where the Insight assessment creates the biggest impact.`,
        Emerging:   `A score of ${scoreNum} marks an important starting point. Recognising the pattern is the hardest step — and it has been taken. Everything that follows builds from this honest baseline.`,
      };
      const scoreCtx = scoreContextMap[lvl] || scoreContextMap['Developing'];

      /* ── Key findings ── */
      const sortedDomains = [...rpt.subdomains].sort((a, b) => Number(b.avg_score) - Number(a.avg_score));
      const topDomain   = sortedDomains[0];
      const focusDomain = sortedDomains[sortedDomains.length - 1];
      const topInfo   = topDomain   ? getDomainInfo(topDomain.subdomain_name, Number(topDomain.avg_score))     : null;
      const focusInfo = (focusDomain && Number(focusDomain.avg_score) < 70) ? getDomainInfo(focusDomain.subdomain_name, Number(focusDomain.avg_score)) : null;

      /* ── Concern description (dynamic by topic) ── */
      const concernAbout = isAttention
        ? `Attention management encompasses the ability to sustain, direct, and regulate focus across tasks and environments. It covers a spectrum from momentary lapses to sustained concentration challenges — affecting academic performance, productivity, and daily functioning.`
        : isScreen
        ? `Screen time behaviour refers to patterns of digital device use — including frequency, duration, emotional triggers, and the ability to self-regulate usage. It examines the relationship between digital habits and overall wellbeing, productivity, and social functioning.`
        : isCareer
        ? `This assessment decodes the behavioural and competency dimensions of "${rpt.concernName}" — mapping the specific gap between your current profile and verified professional standards for your target role. Understanding this gap with precision is what separates effective career transitions from repeated friction.`
        : `This assessment examines the behavioural and cognitive dimensions of "${rpt.concernName}" — including self-awareness, pattern recognition, regulation strategies, and growth capacity. Understanding these dimensions provides a foundation for targeted, evidence-based development.`;

      return (
        <div style={{ fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", color: B.textPrimary, background: '#ffffff' }}>

          {/* ══ 1. INTRODUCTION ══ */}
          <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
            <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
    <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
    <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Introduction</span>
            </div>
            <div className="px-4 py-3.5 space-y-2">
    <p className="text-[14px] leading-relaxed" style={{ color: B.textMid }}>
      This report presents the <strong style={{ color: B.textPrimary }}>Curiosity Stage</strong> results for <strong style={{ color: B.textPrimary }}>{rpt.participantName || 'the participant'}</strong> — the first stage of MetryxOne's CAPADEX potential decoding framework. The Curiosity Stage establishes your baseline across key cognitive and behavioural domains related to <strong style={{ color: accentCol }}>{rpt.concernName}</strong>, creating the foundation for precise competency mapping in the Insight Stage.
    </p>
    <p className="text-[13px] leading-relaxed" style={{ color: B.textMuted }}>
      MetryxOne is a potential decoding platform — not a wellness service. These results are used to identify the gap between current behaviour and measurable professional potential, and to build a precise roadmap for closing it.
    </p>
    <div className="flex flex-wrap gap-3 pt-1">
      {[
        { label: 'Participant', value: rpt.participantName || 'Anonymous' },
        { label: 'Stage', value: 'Curiosity' },
        { label: 'Date', value: new Date(rpt.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: B.textMuted }}>{label}:</span>
          <span className="text-[12px] font-bold" style={{ color: B.textPrimary }}>{value}</span>
        </div>
      ))}
    </div>
            </div>
          </div>

          {/* ══ 2. WHAT IS BEING ASSESSED ══ */}
          <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
            <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
    <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
    <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>What is Being Assessed</span>
            </div>
            <div className="px-4 py-3.5">
    <p className="text-[15px] font-bold mb-1.5" style={{ color: B.textPrimary }}>{rpt.concernName}</p>
    <p className="text-[13px] leading-relaxed mb-3" style={{ color: B.textMid }}>{concernAbout}</p>
    {rpt.subdomains.length > 0 && (
      <div className="grid grid-cols-2 gap-2">
        {rpt.subdomains.map(sd => {
          const info = getDomainInfo(sd.subdomain_name, Number(sd.avg_score));
          return (
            <div key={sd.subdomain_name} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: B.navy }} />
              <span className="text-[12px] font-medium leading-tight" style={{ color: B.textPrimary }}>{info.label}</span>
            </div>
          );
        })}
      </div>
    )}
            </div>
          </div>

          {/* ══ 2b. BEHAVIOURAL INTELLIGENCE OVERVIEW ══ */}
          {rpt.behavioral_signals?.has_profile && (() => {
            const bs = rpt.behavioral_signals!;
            const lc = rpt.linguistic_context;
            const arch = rpt.behavioral_archetype;
            // Load colour bands: <=40 green, 41-70 orange, >70 red
            const loadColor = (v: number) =>
              v <= 40 ? { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' }
              : v <= 70 ? { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' }
              : { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' };
            const archTone = arch
              ? (arch.tone === 'positive'
                  ? { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' }
                  : arch.tone === 'caution'
                  ? { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' }
                  : { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' })
              : null;
            // Linguistic precision factor is a 0..1 absolutism score → scale to 0..100
            const precision = Math.round((Number(lc?.absolutism_score) || 0) * 100);
            const gauges = [
              { label: 'Emotional Burden Index', value: Math.round(bs.emotional_load) },
              { label: 'Cognitive Processing Pace', value: Math.round(bs.cognitive_load) },
              { label: 'Engagement Fidelity', value: Math.round(bs.engagement_score) },
              { label: 'Linguistic Precision Factor', value: precision },
            ];
            return (
              <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
                  <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Behavioural Intelligence Overview</span>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-[12px] leading-relaxed mb-3" style={{ color: B.textMid }}>
                    Beyond your answers, we observed <em>how</em> you responded. These are developmental signals only — not a diagnosis.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {gauges.map(({ label, value }) => {
                      const c = loadColor(value);
                      return (
                        <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: c.bg, border: `1px solid ${c.bdr}` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold leading-tight" style={{ color: B.textPrimary }}>{label}</span>
                            <span className="text-[12px] font-black" style={{ color: c.col }}>{value}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#fff' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, value))}%`, background: c.col }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {arch && archTone && (
                    <div className="mt-3 rounded-lg px-3.5 py-3" style={{ background: archTone.bg, border: `1px solid ${archTone.bdr}` }}>
                      <p className="text-[11px] font-black uppercase mb-1" style={{ color: archTone.col, letterSpacing: '0.08em' }}>{arch.label}</p>
                      <p className="text-[12px] leading-relaxed" style={{ color: B.textMid }}>{arch.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ 3. METHODOLOGY ══ */}
          <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
            <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
    <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
    <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Your {rpt.concernName} Report</span>
            </div>
            <div className="px-4 py-3.5 space-y-2">
    {(() => {
      const fn = rpt.participantName ? rpt.participantName.split(' ')[0] : '';
      return (
        <p className="text-[16px] font-bold leading-snug" style={{ color: B.navyDark, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>
          {fn ? `${fn}, here's what your answers revealed.` : "Here's what your answers revealed."}
        </p>
      );
    })()}
    <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
      You answered questions honestly about <strong style={{ color: B.navyDark }}>{rpt.concernName}</strong>. This report maps those responses across {rpt.subdomains.length} behavioural dimensions — benchmarked against 10,000+ people with the same concern — so you can see clearly where you stand, and what to do about it.
    </p>
    <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
      Scores run 0–100. The 75-point line is the standard threshold. Anything below it shows where the most meaningful growth can happen. Anything above it shows what you can build from.
    </p>
    <div className="grid grid-cols-3 gap-2 pt-1">
      {[
        { label: 'Domains Assessed', value: `${rpt.subdomains.length}` },
        { label: 'Framework', value: 'SDI™' },
        { label: 'Benchmark Pool', value: '10K+' },
      ].map(({ label, value }) => (
        <div key={label} className="text-center py-2.5 px-2 rounded-lg" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
          <p className="text-[20px] font-black leading-none mb-1" style={{ color: B.navy }}>{value}</p>
          <p className="text-[11px] leading-tight" style={{ color: B.textMuted }}>{label}</p>
        </div>
      ))}
    </div>
    {/* Performance bands legend */}
    <div className="pt-1 grid grid-cols-4 gap-1.5">
      {[
        { label: 'Emerging', range: '0 – 39', col: '#EF4444', bg: '#FEF2F2' },
        { label: 'Developing', range: '40 – 59', col: '#F59E0B', bg: '#FFFBEB' },
        { label: 'Proficient', range: '60 – 79', col: '#3B82F6', bg: '#EFF6FF' },
        { label: 'Advanced', range: '80 – 100', col: B.navy, bg: B.navyBg },
      ].map(({ label, range, col, bg }) => (
        <div key={label} className="text-center py-2 rounded-lg" style={{ background: bg, border: `1px solid ${col}25` }}>
          <p className="text-[11px] font-bold" style={{ color: col }}>{label}</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>{range}</p>
        </div>
      ))}
    </div>
            </div>
          </div>

          {/* ══ 4. OVERALL SCORE — Donut + bar ══ */}
          <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: accentBg, border: `1.5px solid ${accentBdr}` }}>
            <div style={{ height: 3, background: accentCol }} />
            <div className="px-4 pt-3.5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${accentBdr}` }}>
    <div className="flex items-center gap-2">
      <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: accentCol }} />
      <span className="text-[12px] font-medium" style={{ color: accentCol }}>Overall Score</span>
    </div>
    {rpt.scoreOverride != null && (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>Calibrated</span>
    )}
            </div>
            <div className="px-4 py-4 flex gap-4 items-center">
    {/* Large donut */}
    <div className="shrink-0">
      {(() => {
        const r2 = 40; const cx2 = 52; const cy2 = 52;
        const circ2 = 2 * Math.PI * r2;
        const filled2 = (circ2 * scoreNum / 100).toFixed(2);
        return (
          <svg width="104" height="104" viewBox="0 0 104 104">
            <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={`${accentCol}18`} strokeWidth="13" />
            <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={accentCol} strokeWidth="13"
              strokeDasharray={`${filled2} ${circ2.toFixed(2)}`}
              strokeLinecap="round" transform={`rotate(-90 ${cx2} ${cy2})`}
              style={{ filter: `drop-shadow(0 0 5px ${accentCol}50)` }}
            />
            <text x={cx2} y={cy2 - 7} textAnchor="middle" fill={accentCol} fontSize="23" fontWeight="800" fontFamily="'Plus Jakarta Sans','DM Sans',sans-serif">{scoreNum}</text>
            <text x={cx2} y={cy2 + 9} textAnchor="middle" fill="#9CA3AF" fontSize="10" fontFamily="'Plus Jakarta Sans','DM Sans',sans-serif">/100</text>
            <text x={cx2} y={cy2 + 22} textAnchor="middle" fill={accentCol} fontSize="9" fontWeight="700" fontFamily="'Plus Jakarta Sans','DM Sans',sans-serif">{scoreNum}%</text>
          </svg>
        );
      })()}
    </div>
    {/* Score context */}
    <div className="flex-1 min-w-0">
      <span className="inline-block text-[12px] font-medium px-2.5 py-1 rounded-lg mb-2" style={{ backgroundColor: `${accentCol}14`, color: accentCol }}>{normalisedLevel}</span>
      <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{scoreCtx}</p>
      {isExpertReviewed && rpt.scoreOverride != null && (
        <p className="text-[11px] mt-1.5" style={{ color: B.textMuted }}>System: {rpt.rawScore} · Expert: {scoreNum}</p>
      )}
      {/* OMEGA calibration percentile — k-anonymity gated (k<30 hide · 30–99 amber pulsing · ≥100 emerald verified) */}
      {omegaReport && (() => {
        const cal = omegaReport.calibration as Record<string, unknown> | undefined;
        const pct = cal?.overall_percentile as number | undefined;
        const ci = cal?.confidence_interval as number[] | undefined;
        const cohortSize = Number(cal?.cohort_size ?? 0);
        const conf = omegaReport.insight_confidence as Record<string, unknown> | undefined;
        if (pct == null) return null;
        // Prefer Phase 2 backend `cohort_status` flag when supplied — it
        // applies the canonical k-anonymity gate (countCohort → applyKAnonymity)
        // and is the single source of truth. Fall back to size-based derivation
        // so older report envelopes without the field still render correctly.
        const backendStatus = (cal?.cohort_status ?? omegaReport.cohort_status) as
          'masked' | 'provisional' | 'verified' | undefined;
        const kTier: 'hidden' | 'provisional' | 'verified' =
          backendStatus === 'verified' ? 'verified'
          : backendStatus === 'provisional' ? 'provisional'
          : backendStatus === 'masked' ? 'hidden'
          : cohortSize >= 100 ? 'verified' : cohortSize >= 30 ? 'provisional' : 'hidden';
        const confLevel = conf?.overall as string | undefined;
        const confColors: Record<string, string> = { High: '#059669', Moderate: '#D97706', Low: '#DC2626' };
        const confBgs: Record<string, string> = { High: '#ECFDF5', Moderate: '#FFFBEB', Low: '#FEF2F2' };
        const confBdrs: Record<string, string> = { High: '#A7F3D0', Moderate: '#FDE68A', Low: '#FECACA' };
        // Multiplier matrix legend — derive weight tokens from available calibration signals (developmental signal framing only).
        const reliability = Number(cal?.reliability_score ?? 0);
        const mem = omegaReport.longitudinal_memory as { session_count?: number } | null | undefined;
        const persistenceTok = mem && Number(mem.session_count ?? 0) > 1
          ? `Tracked · ${mem.session_count} sessions`
          : 'Single-session window';
        const confidenceTok = reliability >= 0.8 ? 'High' : reliability >= 0.6 ? 'Moderate' : 'Indicative';
        return (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {kTier === 'verified' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
                  Top {100 - pct}% of peer group · Verified Cohort Norm (k-anonymity met)
                </span>
              )}
              {kTier === 'provisional' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                  ~ Top {100 - pct}% · Provisional · cohort building (n={cohortSize})
                </span>
              )}
              {kTier === 'hidden' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }}>
                  Peer comparison locked — building a privacy-safe cohort (n&lt;30)
                </span>
              )}
              {kTier !== 'hidden' && ci && ci.length === 2 && (
                <span className="text-[10px] font-medium" style={{ color: B.textMuted }}>95% CI: {ci[0]}–{ci[1]}</span>
              )}
            </div>
            {confLevel && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: confBgs[confLevel], color: confColors[confLevel], border: `1px solid ${confBdrs[confLevel]}` }}>
                  {confLevel} confidence
                </span>
                <span className="text-[10px]" style={{ color: B.textMuted }}>{conf?.evidence_summary as string}</span>
              </div>
            )}
            {/* 3-Way Multiplier Matrix legend — disclosure footnote explaining the scoring mechanics */}
            <details className="group mt-1">
              <summary className="text-[10px] font-semibold cursor-pointer select-none inline-flex items-center gap-1" style={{ color: '#4F46E5' }}>
                <span style={{ borderBottom: '1px dashed currentColor' }}>How this score is weighted</span>
                <span className="text-[9px] opacity-70 group-open:hidden">▾</span>
                <span className="text-[9px] opacity-70 hidden group-open:inline">▴</span>
              </summary>
              <div className="mt-1.5 p-2.5 rounded-lg space-y-1.5" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                <p className="text-[10px] leading-snug" style={{ color: '#4338CA' }}>
                  Developmental signal only — not a hiring or placement prediction. Three structural multipliers shape this score:
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="px-1.5 py-1 rounded-md text-center" style={{ background: '#fff', border: '1px solid #E0E7FF' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#6366F1' }}>w_severity</p>
                    <p className="text-[9px] mt-0.5 font-semibold" style={{ color: '#111827' }}>{scoreNum < 40 ? 'High' : scoreNum < 65 ? 'Moderate' : 'Mild'}</p>
                    <p className="text-[8px] mt-0.5 leading-tight" style={{ color: B.textMuted }}>Active friction-point impact</p>
                  </div>
                  <div className="px-1.5 py-1 rounded-md text-center" style={{ background: '#fff', border: '1px solid #E0E7FF' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#6366F1' }}>w_confidence</p>
                    <p className="text-[9px] mt-0.5 font-semibold" style={{ color: '#111827' }}>{confidenceTok}</p>
                    <p className="text-[8px] mt-0.5 leading-tight" style={{ color: B.textMuted }}>Profile + cohort stability</p>
                  </div>
                  <div className="px-1.5 py-1 rounded-md text-center" style={{ background: '#fff', border: '1px solid #E0E7FF' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#6366F1' }}>w_persistence</p>
                    <p className="text-[9px] mt-0.5 font-semibold" style={{ color: '#111827' }}>{persistenceTok}</p>
                    <p className="text-[8px] mt-0.5 leading-tight" style={{ color: B.textMuted }}>Long-term memory decay rate</p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        );
      })()}
    </div>
            </div>
            {/* Progress bar */}
            <div className="px-4 pb-3">
    <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: `${accentCol}15` }}>
      <div className="h-full rounded-full" style={{ width: `${scoreNum}%`, background: accentCol }} />
    </div>
    <div className="flex justify-between mt-1">
      <span className="text-[10px]" style={{ color: B.textMuted }}>0</span>
      <span className="text-[10px]" style={{ color: B.textMuted }}>100</span>
    </div>
            </div>
            {/* Expert reviewed badge */}
            {isExpertReviewed && (
    <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#059669' }}>
        <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white"><path d="M5 8.5L2 5.5l.7-.7L5 7.1l4.3-4.3.7.7z"/></svg>
      </div>
      <div>
        <p className="text-[13px] font-medium" style={{ color: '#065F46' }}>Expert-Reviewed Report</p>
        <p className="text-[12px]" style={{ color: '#065F46', opacity: 0.75 }}>Reviewed and calibrated by a MetryxOne analyst.{rpt.publishedAt ? ` Published ${new Date(rpt.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}</p>
      </div>
    </div>
            )}
          </div>

          {/* ══ 5. ASSESSMENT FINDING ══ */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${B.divider}` }}>
            <div className="flex items-center gap-2 mb-3">
    <div className="rounded-full shrink-0" style={{ width: 3, height: 16, backgroundColor: accentCol }} />
    <p className="text-[12px] font-medium" style={{ color: accentCol, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>
      {isExpertReviewed ? 'Expert Assessment' : 'Assessment Finding'}
    </p>
    {isExpertReviewed && (
      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>✦ Analyst-reviewed</span>
    )}
            </div>
            <p className="text-[17px] font-bold leading-snug mb-2" style={{ color: B.navyDark, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", letterSpacing: '-0.01em' }}>{narrative.headline}</p>
            <p className="text-[14px] font-normal leading-relaxed" style={{ color: B.textMid }}>{narrative.story}</p>

            {/* Daily life translation block */}
            <div className="mt-3 rounded-xl p-3.5" style={{ background: `${accentCol}0A`, border: `1px solid ${accentCol}22` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: accentCol }}>What this looks like in your daily life</p>
              {(() => {
                const lines = normalisedLevel === 'Emerging'
                  ? [
                      'The pattern feels bigger than willpower — it shows up even when you\'re actively trying to stop it.',
                      'There\'s often a sense of being stuck in a loop without a clear way out of it.',
                      'Awareness is there, but turning it into consistent change has been the hard part.',
                    ]
                  : normalisedLevel === 'Developing'
                  ? [
                      'You have good days and harder days — the pattern isn\'t constant, but it isn\'t resolved either.',
                      'You can manage it when you really focus, but it costs more effort than it should.',
                      'You\'re aware of the issue. That awareness is your biggest asset right now.',
                    ]
                  : normalisedLevel === 'Proficient'
                  ? [
                      'You handle this well most of the time — but specific triggers, moods, or environments still catch you.',
                      'Others would say you manage fine. You know the edges where it still breaks down.',
                      'You\'re not starting from zero — the growth here is precision and consistency, not foundation.',
                    ]
                  : [
                      'Your results show real strength — this concern isn\'t significantly disrupting your daily life.',
                      'The value of going deeper is understanding the edge cases where things still occasionally slip.',
                      'At this level, the growth is about optimisation — building on what already works well.',
                    ];
                return (
                  <ul className="space-y-2">
                    {lines.map((line, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentCol }} />
                        <span className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{line}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>

          {/* ══ OMEGA-X: SAFETY ESCALATION BANNER ══ */}
          {omegaReport && (() => {
            const safety = omegaReport.safety as Record<string, unknown> | undefined;
            if (!safety || safety.status === 'safe') return null;
            const isReferral = safety.status === 'referral';
            const bgCol = isReferral ? '#FEF2F2' : '#FFFBEB';
            const bdrCol = isReferral ? '#FECACA' : '#FDE68A';
            const txtCol = isReferral ? '#991B1B' : '#92400E';
            const iconBg = isReferral ? '#DC2626' : '#D97706';
            return (
              <div className="mx-5 mt-4 rounded-xl p-4 flex gap-3" style={{ background: bgCol, border: `1.5px solid ${bdrCol}` }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: iconBg }}>
                  <svg viewBox="0 0 16 16" className="w-4 h-4 fill-white"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3.5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4.5zm0 7a1 1 0 100-2 1 1 0 000 2z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold mb-1" style={{ color: txtCol }}>
                    {isReferral ? 'Professional Support Recommended' : 'A Note From Your Report'}
                  </p>
                  <p className="text-[12px] leading-relaxed" style={{ color: txtCol, opacity: 0.9 }}>
                    {safety.escalation_message as string}
                  </p>
                  {isReferral && (
                    <p className="text-[11px] mt-2 font-semibold" style={{ color: txtCol }}>
                      Please speak to a trusted adult, counsellor, or helpline — you don't have to navigate this alone.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: CAUSAL CHAIN VISUAL INTELLIGENCE ══ */}
          {omegaReport && (() => {
            const ontology = omegaReport.ontology as Record<string, unknown> | undefined;
            const causalChain = ontology?.causal_chain as Array<{ from: string; from_label: string; to: string; to_label: string; edge_type: string; weight: number; explanation: string }> | undefined;
            if (!causalChain || causalChain.length === 0) return null;
            return (
              <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: accentCol }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: accentCol, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Behavioural Causal Chain</span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accentCol}12`, color: accentCol }}>OMEGA-X</span>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[12px] mb-3" style={{ color: B.textMuted }}>How your concern patterns connect and reinforce each other:</p>
                  <div className="space-y-3">
                    {causalChain.slice(0, 5).map((link, i) => {
                      const strengthPct = Math.round((link.weight || 0.5) * 100);
                      const strengthCol = strengthPct >= 70 ? '#DC2626' : strengthPct >= 40 ? '#D97706' : '#059669';
                      return (
                        <div key={i}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-center flex-shrink-0" style={{ background: `${accentCol}12`, color: accentCol, minWidth: 76 }}>
                              {link.from_label || link.from.replace(/_/g, ' ')}
                            </div>
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <div className="text-[9px] font-medium px-1.5 py-0.5 rounded-full mb-0.5 whitespace-nowrap" style={{ background: `${strengthCol}14`, color: strengthCol }}>
                                {link.edge_type.replace(/_/g, ' ')} · {strengthPct}%
                              </div>
                              <div className="w-full flex items-center gap-0.5">
                                <div className="flex-1 h-px" style={{ background: strengthCol }} />
                                <svg viewBox="0 0 6 6" style={{ width: 6, height: 6, fill: strengthCol, flexShrink: 0 }}><polygon points="0,0 6,3 0,6"/></svg>
                              </div>
                            </div>
                            <div className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-center flex-shrink-0" style={{ background: '#F1F5F9', color: '#475569', minWidth: 76 }}>
                              {link.to_label || link.to.replace(/_/g, ' ')}
                            </div>
                          </div>
                          {link.explanation && (
                            <p className="text-[10px] mt-1 leading-relaxed pl-1" style={{ color: B.textMuted }}>{link.explanation}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: TRIGGER ECOSYSTEM CARD ══ */}
          {omegaReport && (() => {
            const ontology = omegaReport.ontology as Record<string, unknown> | undefined;
            const triggerNodes = ontology?.trigger_nodes as Array<{ node_key: string; label: string; node_type: string; description: string }> | undefined;
            const protectiveNodes = ontology?.protective_nodes as Array<{ node_key: string; label: string; node_type: string; description: string }> | undefined;
            const hasNodes = (triggerNodes && triggerNodes.length > 0) || (protectiveNodes && protectiveNodes.length > 0);
            if (!hasNodes) return null;
            const nodeTypeColors: Record<string, { bg: string; col: string }> = {
              trigger: { bg: '#FEF2F2', col: '#DC2626' },
              reinforcement: { bg: '#FFF7ED', col: '#C2410C' },
              vulnerability: { bg: '#FDF4FF', col: '#7C3AED' },
              protective_factor: { bg: '#ECFDF5', col: '#059669' },
              stability_marker: { bg: '#EFF6FF', col: '#2563EB' },
              behaviour: { bg: '#F0FDF4', col: '#16A34A' },
              cognitive: { bg: '#EFF6FF', col: '#2563EB' },
              emotional: { bg: '#FDF4FF', col: '#7C3AED' },
            };
            return (
              <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#7C3AED' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#7C3AED', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Trigger Ecosystem</span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>Ontology Map</span>
                </div>
                <div className="px-4 py-4 space-y-4">
                  {triggerNodes && triggerNodes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#DC2626' }}>Active Triggers</p>
                      <div className="space-y-2">
                        {triggerNodes.slice(0, 4).map(node => {
                          const dc = nodeTypeColors[node.node_type] || { bg: '#F8FAFC', col: '#475569' };
                          return (
                            <div key={node.node_key} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: dc.bg, border: `1px solid ${dc.col}20` }}>
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: dc.col }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold" style={{ color: dc.col }}>{node.label}</p>
                                {node.description && <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: B.textMuted }}>{node.description}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {protectiveNodes && protectiveNodes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#059669' }}>Protective Factors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {protectiveNodes.slice(0, 4).map(node => (
                          <div key={node.node_key} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D025' }}>
                            {node.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: STAGE-DIFFERENTIATED CONTRACT ══ */}
          {omegaReport && (() => {
            const contract = omegaReport.stage_contract as Record<string, unknown> | undefined;
            if (!contract) return null;
            const stage = rpt.stageCode;
            const stageColors: Record<string, { bg: string; col: string; bdr: string; icon: string }> = {
              CAP_CUR: { bg: '#EFF6FF', col: '#2563EB', bdr: '#BFDBFE', icon: '🔍' },
              CAP_INS: { bg: '#FDF4FF', col: '#7C3AED', bdr: '#E9D5FF', icon: '🧠' },
              CAP_GRW: { bg: '#ECFDF5', col: '#059669', bdr: '#A7F3D0', icon: '🌱' },
              CAP_MAS: { bg: B.navyBg, col: B.navy, bdr: B.navyBorder, icon: '⭐' },
            };
            const sc = stageColors[stage] || stageColors.CAP_CUR;
            // sections is a plain object keyed by section name; convert to displayable entries
            const sectionsObj = contract.sections as Record<string, { headline?: string; body?: string; primary_trigger?: string; trigger_description?: string; early_warnings?: string[]; normalisation_note?: string }> | undefined;
            if (!sectionsObj || Object.keys(sectionsObj).length === 0) return null;
            const sectionEntries = Object.entries(sectionsObj);
            return (
              <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: sc.bg, border: `1.5px solid ${sc.bdr}` }}>
                <div style={{ height: 3, background: sc.col }} />
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${sc.bdr}` }}>
                  <span className="text-base">{sc.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: sc.col, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>
                    {rpt.stageLabel} Intelligence
                  </span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sc.col}18`, color: sc.col }}>{stage}</span>
                </div>
                <div className="px-4 py-4 space-y-4">
                  {sectionEntries.map(([key, sec]) => {
                    const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const bullets: string[] = [];
                    if (sec.headline) bullets.push(sec.headline);
                    if (sec.body) bullets.push(sec.body);
                    if (sec.normalisation_note) bullets.push(sec.normalisation_note);
                    if (sec.primary_trigger) bullets.push(`Primary trigger: ${sec.primary_trigger}`);
                    if (sec.trigger_description) bullets.push(sec.trigger_description);
                    if (sec.early_warnings) bullets.push(...sec.early_warnings);
                    return (
                      <div key={key}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: sc.col }}>{title}</p>
                        <div className="space-y-1.5">
                          {bullets.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: sc.col }} />
                              <span className="text-[12px] leading-relaxed" style={{ color: B.textMid }}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: INTERVENTION SEQUENCE ══ */}
          {omegaReport && (() => {
            // intervention_sequence is a flat SequencedIntervention[] array
            const interventions = omegaReport.intervention_sequence as Array<{
              key: string; title: string; description: string; phase: string;
              phase_label: string; intensity: string; timing: string; start_when: string;
              success_marker: string; expected_outcome: string;
              sequence_position: number; fatigue_warning?: string;
            }> | undefined;
            if (!interventions || interventions.length === 0) return null;
            const phaseOrder = ['stabilisation', 'growth', 'optimisation'];
            const phaseColors: Record<string, string> = { stabilisation: '#2563EB', growth: '#059669', optimisation: B.navy };
            const phaseBgs: Record<string, string> = { stabilisation: '#EFF6FF', growth: '#ECFDF5', optimisation: B.navyBg };
            const phaseBdrs: Record<string, string> = { stabilisation: '#BFDBFE', growth: '#A7F3D0', optimisation: B.navyBorder };
            const grouped: Record<string, typeof interventions> = {};
            for (const intv of interventions) {
              if (!grouped[intv.phase]) grouped[intv.phase] = [];
              grouped[intv.phase].push(intv);
            }
            const lastItem = interventions[interventions.length - 1];
            return (
              <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#059669' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#059669', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Personalised Intervention Plan</span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>{interventions.length} steps</span>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {phaseOrder.filter(ph => grouped[ph]?.length).map((ph, pi) => {
                    const pc = phaseColors[ph] || '#64748B';
                    const pbg = phaseBgs[ph] || '#F8FAFC';
                    const pbdr = phaseBdrs[ph] || '#E2E8F0';
                    const phLabel = grouped[ph][0].phase_label;
                    return (
                      <div key={ph} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${pbdr}` }}>
                        <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: pbg }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0" style={{ background: pc }}>{pi + 1}</div>
                          <span className="text-[12px] font-bold" style={{ color: pc }}>{phLabel}</span>
                        </div>
                        <div className="px-3 py-3 space-y-3">
                          {grouped[ph].map(intv => {
                            const intensityCol = intv.intensity === 'high' ? '#DC2626' : intv.intensity === 'moderate' ? '#D97706' : '#059669';
                            const intensityBg = intv.intensity === 'high' ? '#FEF2F2' : intv.intensity === 'moderate' ? '#FFFBEB' : '#ECFDF5';
                            return (
                              <div key={intv.key} className="flex gap-2.5">
                                <div className="w-1 rounded-full flex-shrink-0" style={{ background: pc, minHeight: 32, alignSelf: 'stretch' }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <span className="text-[12px] font-semibold" style={{ color: B.navyDark }}>{intv.title}</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: intensityBg, color: intensityCol }}>{intv.intensity}</span>
                                  </div>
                                  <p className="text-[11px] leading-relaxed" style={{ color: B.textMuted }}>{intv.description}</p>
                                  <p className="text-[10px] mt-1 font-medium" style={{ color: pc }}>⏰ {intv.start_when}</p>
                                  {intv.success_marker && (
                                    <p className="text-[10px] mt-0.5 italic" style={{ color: B.textMuted }}>✓ {intv.success_marker}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {lastItem?.fatigue_warning && (
                    <div className="rounded-lg px-3 py-2.5 flex gap-2 items-start" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <span className="text-[13px] flex-shrink-0">💡</span>
                      <p className="text-[11px] leading-relaxed" style={{ color: '#92400E' }}>{lastItem.fatigue_warning}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: INSIGHT CONFIDENCE SUMMARY ══ */}
          {omegaReport && (() => {
            // insight_confidence is a flat object: { overall, score, explanation, evidence_summary }
            const conf = omegaReport.insight_confidence as { overall: string; score: number; explanation: string; evidence_summary: string } | undefined;
            if (!conf || !conf.overall) return null;
            const confColors: Record<string, string> = { High: '#059669', Moderate: '#D97706', Low: '#DC2626' };
            const confBgs: Record<string, string> = { High: '#ECFDF5', Moderate: '#FFFBEB', Low: '#FEF2F2' };
            const confBdrs: Record<string, string> = { High: '#A7F3D0', Moderate: '#FDE68A', Low: '#FECACA' };
            const cc = confColors[conf.overall] || '#64748B';
            const cbg = confBgs[conf.overall] || '#F8FAFC';
            const cbdr = confBdrs[conf.overall] || '#E2E8F0';
            const barWidth = Math.round(conf.score * 100);
            return (
              <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#D97706' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#D97706', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Report Confidence</span>
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: cbg, color: cc, border: `1px solid ${cbdr}` }}>{conf.overall}</span>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[12px] leading-relaxed mb-3" style={{ color: B.textMid }}>{conf.explanation}</p>
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium" style={{ color: B.textMuted }}>Confidence score</span>
                      <span className="text-[11px] font-bold" style={{ color: cc }}>{barWidth}%</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: `${cc}18` }}>
                      <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: cc }} />
                    </div>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: cbg, border: `1px solid ${cbdr}` }}>
                    <p className="text-[10px] font-medium" style={{ color: cc }}>{conf.evidence_summary}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: QUALITY VALIDATION GATE ══ */}
          {omegaReport && (() => {
            const qv = omegaReport.quality_validation as { gate: string; overall_score: number; summary: string; dimensions: Record<string, { score: number; issues: string[] }> } | undefined;
            if (!qv) return null;
            const gateColors: Record<string, { col: string; bg: string; bdr: string; label: string }> = {
              pass:   { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0', label: 'Quality Verified' },
              review: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', label: 'Under Review' },
              fail:   { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', label: 'Quality Check Failed' },
            };
            const gc = gateColors[qv.gate] || gateColors['review'];
            const dims = [
              { key: 'scientific',   label: 'Scientific',   icon: '🔬' },
              { key: 'safety',       label: 'Safety',       icon: '🛡️' },
              { key: 'narrative',    label: 'Narrative',    icon: '✍️' },
              { key: 'intervention', label: 'Interventions',icon: '🎯' },
              { key: 'readability',  label: 'Readability',  icon: '📖' },
            ];
            return (
              <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: gc.col }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: gc.col, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Report Quality</span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: gc.bg, color: gc.col, border: `1px solid ${gc.bdr}` }}>{gc.label} · {qv.overall_score}/100</span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {dims.map(d => {
                      const dim = qv.dimensions[d.key];
                      if (!dim) return null;
                      const sc = dim.score;
                      const dimCol = sc >= 80 ? '#059669' : sc >= 60 ? '#D97706' : '#DC2626';
                      return (
                        <div key={d.key} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          <span className="text-[10px]">{d.icon}</span>
                          <span className="text-[10px] font-medium" style={{ color: B.textMuted }}>{d.label}</span>
                          <span className="text-[11px] font-bold" style={{ color: dimCol }}>{sc}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: B.textMuted }}>{qv.summary}</p>
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: CONTRADICTION INTELLIGENCE ══ */}
          {omegaReport && (() => {
            const contra = omegaReport.contradictions as { count: number; has_contradictions: boolean; reliability_impact: string; interpretation: string; events: Array<{ type: string; severity: string; description: string; affected_subdomains: string[] }> } | undefined;
            if (!contra) return null;
            const impactColors: Record<string, { col: string; bg: string; bdr: string }> = {
              none:        { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' },
              minor:       { col: '#0284C7', bg: '#F0F9FF', bdr: '#BAE6FD' },
              moderate:    { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' },
              significant: { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' },
            };
            const ic = impactColors[contra.reliability_impact] || impactColors['minor'];
            const typeLabels: Record<string, string> = {
              score_reversal:       'Score Reversal',
              emotional_masking:    'Emotional Masking',
              self_perception_bias: 'Self-Perception Bias',
              defensive_answering:  'Defensive Answering',
            };
            return (
              <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: ic.col }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: ic.col, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Response Intelligence</span>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ic.bg, color: ic.col, border: `1px solid ${ic.bdr}` }}>
                    {contra.count === 0 ? 'Consistent' : `${contra.count} variation${contra.count > 1 ? 's' : ''} · ${contra.reliability_impact} impact`}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[12px] leading-relaxed mb-2" style={{ color: B.textMid }}>{contra.interpretation}</p>
                  {/* Cognitive load — derived from Likert tap-timing telemetry (auto-advances vs. delayed interactions) */}
                  {(() => {
                    const tel = omegaXPayload._telemetry_inputs;
                    const hesMs = Number(tel?.avg_hesitation_ms ?? 0);
                    const backtracks = Number(tel?.total_backtracks ?? 0);
                    const rows = Number(tel?.telemetry_rows ?? 0);
                    if (!rows) return null;
                    const loadBand: 'Low' | 'Steady' | 'Elevated' | 'High' =
                      hesMs < 1200 && backtracks <= 1 ? 'Low'
                      : hesMs < 2400 && backtracks <= 3 ? 'Steady'
                      : hesMs < 4000 || backtracks <= 6 ? 'Elevated'
                      : 'High';
                    const bandTone: Record<string, { col: string; bg: string; bdr: string; note: string }> = {
                      Low:      { col: '#047857', bg: '#ECFDF5', bdr: '#A7F3D0', note: 'Quick, confident taps — low cognitive strain on this run.' },
                      Steady:   { col: '#0284C7', bg: '#F0F9FF', bdr: '#BAE6FD', note: 'Healthy pacing — considered responses without over-deliberation.' },
                      Elevated: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', note: 'Noticeable deliberation — some items required real cognitive work.' },
                      High:     { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', note: 'High strain detected — frequent re-considers. Worth pacing kindly.' },
                    };
                    const bt = bandTone[loadBand];
                    return (
                      <div className="mb-2 p-2.5 rounded-lg" style={{ background: bt.bg, border: `1px solid ${bt.bdr}` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: bt.col, color: '#fff' }}>Cognitive load</span>
                          <span className="text-[11px] font-bold" style={{ color: bt.col }}>{loadBand}</span>
                          <span className="ml-auto text-[9px] font-medium tabular-nums" style={{ color: bt.col, opacity: 0.85 }}>
                            ~{Math.round(hesMs)} ms hesitation · {backtracks} re-consider{backtracks === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="text-[10px] leading-snug" style={{ color: bt.col, opacity: 0.9 }}>{bt.note}</p>
                      </div>
                    );
                  })()}
                  {contra.has_contradictions && contra.events.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {contra.events.slice(0, 3).map((ev, i) => (
                        <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5" style={{
                            background: ev.severity === 'high' ? '#FEF2F2' : ev.severity === 'medium' ? '#FFFBEB' : '#F0F9FF',
                            color: ev.severity === 'high' ? '#DC2626' : ev.severity === 'medium' ? '#D97706' : '#0284C7',
                          }}>{ev.severity}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold" style={{ color: '#374151' }}>{typeLabels[ev.type] || ev.type}</p>
                            {ev.affected_subdomains?.length > 0 && (
                              <p className="text-[10px]" style={{ color: B.textMuted }}>Areas: {ev.affected_subdomains.slice(0, 2).join(', ')}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: BEHAVIOURAL MEMORY ══ */}
          {omegaReport && (() => {
            const mem = omegaReport.longitudinal_memory as {
              session_count: number;
              is_returning_user: boolean;
              behavioural_drift: { direction: string; slope: number; confidence: string; first_csi: number; last_csi: number } | null;
              recurring_constructs: Array<{ construct_key: string; frequency: number; avg_score: number; trend: string }>;
              resilience_recoveries: Array<{ rebound_points: number; concern_name: string }>;
              growth_patterns: Array<{ improvement: number; sessions_span: number; concern_name: string }>;
              first_seen: string | null;
              last_seen: string | null;
            } | null | undefined;
            if (!mem || !mem.is_returning_user) return null;
            const driftColors: Record<string, { col: string; icon: string }> = {
              improving: { col: '#059669', icon: '↑' },
              stable:    { col: '#0284C7', icon: '→' },
              declining: { col: '#D97706', icon: '↓' },
            };
            const dc = mem.behavioural_drift ? (driftColors[mem.behavioural_drift.direction] || driftColors['stable']) : null;
            return (
              <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#7C3AED' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#7C3AED', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Behavioural Memory</span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                    {mem.session_count} assessment{mem.session_count > 1 ? 's' : ''} · returning
                  </span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {/* Drift indicator */}
                  {mem.behavioural_drift && dc && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[18px] font-black shrink-0" style={{ background: `${dc.col}12`, color: dc.col }}>{dc.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold" style={{ color: '#111827' }}>
                          {mem.behavioural_drift.direction === 'improving' ? 'Positive trajectory detected' :
                           mem.behavioural_drift.direction === 'declining' ? 'Declining pattern flagged' :
                           'Stable behavioural pattern'}
                        </p>
                        <p className="text-[11px]" style={{ color: B.textMuted }}>
                          {Math.round(mem.behavioural_drift.first_csi)} → {Math.round(mem.behavioural_drift.last_csi)} across {mem.session_count} sessions · {mem.behavioural_drift.confidence} confidence
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Recurring constructs */}
                  {mem.recurring_constructs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.textMuted }}>Recurring patterns across sessions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mem.recurring_constructs.slice(0, 4).map((rc, i) => {
                          const trendCol = rc.trend === 'improving' ? '#059669' : rc.trend === 'declining' ? '#DC2626' : '#D97706';
                          return (
                            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                              <span className="text-[10px] font-semibold" style={{ color: '#92400E' }}>{rc.construct_key.split('/')[0]}</span>
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded-full" style={{ background: `${trendCol}15`, color: trendCol }}>
                                {rc.trend === 'improving' ? '↑' : rc.trend === 'declining' ? '↓' : '→'} {rc.avg_score}
                              </span>
                              <span className="text-[9px]" style={{ color: '#92400E' }}>×{rc.frequency}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Resilience recoveries */}
                  {mem.resilience_recoveries.length > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                      <span className="text-[14px] shrink-0">💪</span>
                      <p className="text-[11px] leading-snug" style={{ color: '#065F46' }}>
                        <strong>Resilience detected:</strong> You've recovered +{mem.resilience_recoveries[0].rebound_points} points after a low period on "{mem.resilience_recoveries[0].concern_name}". That recovery is evidence this system works for you.
                      </p>
                    </div>
                  )}
                  {/* Growth patterns */}
                  {mem.growth_patterns.length > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <span className="text-[14px] shrink-0">📈</span>
                      <p className="text-[11px] leading-snug" style={{ color: '#1E40AF' }}>
                        <strong>Growth pattern:</strong> +{mem.growth_patterns[0].improvement} point improvement over {mem.growth_patterns[0].sessions_span} sessions on "{mem.growth_patterns[0].concern_name}".
                      </p>
                    </div>
                  )}
                  {mem.recurring_constructs.length === 0 && mem.resilience_recoveries.length === 0 && mem.growth_patterns.length === 0 && (
                    <p className="text-[12px]" style={{ color: B.textMuted }}>
                      Welcome back. Your earlier sessions are being compared to build your longitudinal behavioural profile. More insights appear as your history grows.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: FORECAST INTELLIGENCE ══ */}
          {omegaReport && (() => {
            const fc = omegaReport.forecast as {
              trajectory: string; outlook_6_weeks: string; outlook_3_months: string;
              recovery_timeline_weeks: number; growth_probability: number;
              risk_window: string; next_milestone: string;
              key_risk_factors: string[]; key_growth_enablers: string[];
            } | undefined;
            if (!fc) return null;
            const trajMap: Record<string, { bg: string; col: string; bdr: string; icon: string; label: string }> = {
              improving:  { bg: '#ECFDF5', col: '#059669', bdr: '#A7F3D0', icon: '↑', label: 'Improving' },
              stable:     { bg: '#EFF6FF', col: '#2563EB', bdr: '#BFDBFE', icon: '→', label: 'Stable' },
              plateauing: { bg: '#FFFBEB', col: '#D97706', bdr: '#FDE68A', icon: '—', label: 'Plateauing' },
              declining:  { bg: '#FEF2F2', col: '#DC2626', bdr: '#FECACA', icon: '↓', label: 'Declining' },
              volatile:   { bg: '#F5F3FF', col: '#7C3AED', bdr: '#DDD6FE', icon: '~', label: 'Volatile' },
            };
            const tc = trajMap[fc.trajectory] ?? trajMap.stable;
            const gpPct = Math.min(100, Math.max(0, fc.growth_probability));
            const gpCol = gpPct >= 70 ? '#059669' : gpPct >= 50 ? '#D97706' : '#DC2626';
            return (
              <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg, #7C3AED, #2563EB)' }} />
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#7C3AED' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#7C3AED', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Forecast Intelligence</span>
                  <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: tc.bg, border: `1px solid ${tc.bdr}` }}>
                    <span className="text-[13px] font-black" style={{ color: tc.col }}>{tc.icon}</span>
                    <span className="text-[10px] font-bold" style={{ color: tc.col }}>{tc.label}</span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {/* Growth probability bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: B.textMid }}>Growth Probability</span>
                      <span className="text-[13px] font-black" style={{ color: gpCol }}>{gpPct}%</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#F1F5F9' }}>
                      <div className="h-full rounded-full" style={{ width: `${gpPct}%`, background: gpCol }} />
                    </div>
                  </div>
                  {/* 6-week outlook */}
                  <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: B.textMuted }}>6-Week Outlook</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#111827' }}>{fc.outlook_6_weeks}</p>
                  </div>
                  {/* 3-month outlook */}
                  <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: B.textMuted }}>3-Month Outlook</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#374151' }}>{fc.outlook_3_months}</p>
                  </div>
                  {/* Next milestone + risk window */}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <span className="text-[13px] shrink-0">🎯</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#1D4ED8' }}>Next Milestone</p>
                        <p className="text-[11px] leading-snug" style={{ color: '#1E40AF' }}>{fc.next_milestone}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <span className="text-[13px] shrink-0">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#DC2626' }}>Critical Risk Window</p>
                        <p className="text-[11px] leading-snug" style={{ color: '#991B1B' }}>{fc.risk_window}</p>
                      </div>
                    </div>
                  </div>
                  {/* Risk factors + growth enablers */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#DC2626' }}>Risk Factors</p>
                      <div className="space-y-1">
                        {(fc.key_risk_factors ?? []).map((rf, i) => (
                          <div key={i} className="px-2 py-1.5 rounded-lg text-[9px] leading-tight" style={{ background: '#FEF2F2', color: '#991B1B' }}>{rf}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#059669' }}>Growth Enablers</p>
                      <div className="space-y-1">
                        {(fc.key_growth_enablers ?? []).map((ge, i) => (
                          <div key={i} className="px-2 py-1.5 rounded-lg text-[9px] leading-tight" style={{ background: '#ECFDF5', color: '#065F46' }}>{ge}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ══ OMEGA-X: BEHAVIOURAL INTELLIGENCE REPORT (12-field arc) ══ */}
          {omegaReport && (() => {
            const ri = omegaReport.report_intelligence as Record<string, unknown> | undefined;
            if (!ri) return null;
            type RISection = { headline?: string; body?: string; daily_experience?: string; internal_state?: string; external_behaviour?: string; effort_vs_outcome?: string; primary_cause?: { label: string; explanation: string }; contributing_factors?: string[]; not_a_flaw?: string; not_permanent?: string; not_failure?: string; not_inability?: string; current_narrative?: string; reframe?: string; identity_shift?: string; in_daily_life?: string; pattern?: string; trajectory?: string; emotional_reframe?: string; normalisation?: string };
            const recognition  = ri.recognition  as RISection | undefined;
            const reassurance  = ri.reassurance  as RISection | undefined;
            const meaning      = ri.meaning      as RISection | undefined;
            const causation    = ri.causation    as RISection | undefined;
            const identity     = ri.identity     as RISection | undefined;
            const whatNotIs    = ri.what_this_is_not as RISection | undefined;
            const stageColor = { CAP_CUR: '#2563EB', CAP_INS: '#2563EB', CAP_GRW: '#059669', CAP_MAS: B.navy }[rpt.stageCode] ?? B.navy;
            const arcSteps = [
              { emoji: '🔍', label: 'Recognition',  col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE',
                lines: [recognition?.headline, recognition?.body, recognition?.normalisation].filter(Boolean) as string[] },
              { emoji: '🛡️', label: 'Reassurance',  col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0',
                lines: [reassurance?.body, reassurance?.emotional_reframe].filter(Boolean) as string[] },
              { emoji: '💡', label: 'Meaning',       col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A',
                lines: [meaning?.daily_experience, meaning?.effort_vs_outcome].filter(Boolean) as string[] },
              { emoji: '🔗', label: 'Causation',     col: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE',
                lines: causation?.primary_cause ? [`${causation.primary_cause.label}: ${causation.primary_cause.explanation}`, causation.why_previous_approaches_failed as string | undefined].filter(Boolean) as string[] : [] },
              { emoji: '🪞', label: 'Identity',      col: '#0891B2', bg: '#ECFEFF', bdr: '#A5F3FC',
                lines: [identity?.reframe, identity?.identity_shift].filter(Boolean) as string[] },
              { emoji: '✅', label: 'What This Is Not', col: '#16A34A', bg: '#F0FDF4', bdr: '#BBF7D0',
                lines: [whatNotIs?.not_a_flaw, whatNotIs?.not_permanent, whatNotIs?.not_inability].filter(Boolean) as string[] },
            ].filter(s => s.lines.length > 0);
            if (arcSteps.length === 0) return null;
            return (
              <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1.5px solid ${stageColor}30` }}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${stageColor}, #7C3AED)` }} />
                <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: stageColor }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: stageColor, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Behavioural Intelligence Report</span>
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${stageColor}12`, color: stageColor }}>Recognition → Hope</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {arcSteps.map((step, idx) => (
                    <div key={step.label} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center" style={{ width: 28, flexShrink: 0 }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0" style={{ background: step.bg, border: `1.5px solid ${step.bdr}` }}>
                          {step.emoji}
                        </div>
                        {idx < arcSteps.length - 1 && (
                          <div className="flex-1 mt-1" style={{ width: 2, background: `${step.col}20`, minHeight: 12, borderRadius: 1 }} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: step.col }}>{step.label}</p>
                        {step.lines.map((line, li) => (
                          <p key={li} className={`text-[11px] leading-relaxed ${li < step.lines.length - 1 ? 'mb-1.5' : ''}`} style={{ color: li === 0 ? '#111827' : '#374151' }}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ══ 6. COGNITIVE PROFILE — Bar graph with level scale ══ */}
          {rpt.subdomains.length > 0 && (() => {
            const domains = rpt.subdomains;
            const pts = domains.map(sd => Math.min(100, Math.max(0, Math.round(Number(sd.avg_score)))));
            return (
    <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>

      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${B.divider}` }}>
        <div className="flex items-center gap-2">
          <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
          <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Cognitive Profile</span>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: B.navyBg, color: B.textMuted, border: `1px solid ${B.navyBorder}` }}>{domains.length} domains</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-4 py-2" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ width: 108, flexShrink: 0 }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Competency</span>
        </div>
        <div className="flex-1 relative flex items-center justify-end pr-1">
          <div className="absolute flex flex-col items-center" style={{ left: '75%', transform: 'translateX(-50%)', top: '50%', marginTop: -6 }}>
            <div style={{ width: 1.5, height: 10, borderLeft: '1.5px dashed #94A3B8' }} />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>75 Threshold</span>
        </div>
        <div style={{ width: 38, textAlign: 'right', flexShrink: 0 }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Score %</span>
        </div>
        <div style={{ width: 26, textAlign: 'right', flexShrink: 0 }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>Δ75</span>
        </div>
      </div>

      {/* Domain rows */}
      {domains.map((sd, i) => {
        const pct  = pts[i];
        const info = getDomainInfo(sd.subdomain_name, pct);
        const col  = pct >= 70 ? '#14B8A6' : pct >= 40 ? '#F59E0B' : '#EF4444';
        const delta    = pct - 75;
        const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
        const deltaCol = delta >= 0 ? '#14B8A6' : delta >= -15 ? '#F59E0B' : '#EF4444';
        // Emotional heatmap: intensity derived from distance below threshold + contradiction flags
        const emoIntensity = pct < 40 ? 'high' : pct < 60 ? 'medium' : pct < 75 ? 'low' : 'none';
        const emoHeatBg: Record<string, string> = { high: '#FEF2F2', medium: '#FFFBEB', low: '#F0F9FF', none: 'transparent' };
        const emoHeatLabel: Record<string, string> = { high: 'High load', medium: 'Moderate', low: 'Low', none: '' };
        const emoHeatCol: Record<string, string> = { high: '#DC2626', medium: '#D97706', low: '#0284C7', none: '' };
        const contradictions = omegaReport?.contradictions as { events: Array<{ affected_subdomains: string[] }> } | undefined;
        const isContradicted = contradictions?.events?.some(e =>
          e.affected_subdomains?.some(sub => sub.toLowerCase().includes(sd.subdomain_name.toLowerCase().split(' ')[0]) || sd.subdomain_name.toLowerCase().includes(sub.toLowerCase()))
        ) ?? false;
        const explainChain = (omegaReport?.explainability_chain as Array<{ subdomain: string; observation: string; interpretation: string; intervention: string; confidence: string }> | undefined) ?? [];
        const explainEntry = explainChain.find(e =>
          e.subdomain?.toLowerCase() === sd.subdomain_name?.toLowerCase() ||
          sd.subdomain_name?.toLowerCase().includes(e.subdomain?.toLowerCase() ?? '') ||
          e.subdomain?.toLowerCase().includes(sd.subdomain_name?.toLowerCase() ?? '')
        );
        return (
          <div key={sd.subdomain_name} style={{ borderTop: '1px solid #F9FAFB', background: emoIntensity !== 'none' ? emoHeatBg[emoIntensity] : undefined }}>
            {/* Main score row */}
            <div className="flex items-center px-4 py-2.5">
              <div style={{ width: 108, flexShrink: 0 }}>
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-semibold leading-tight" style={{ color: '#111827', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>{info.label}</p>
                  {isContradicted && (
                    <span title="Response variation detected in this area" className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>~</span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{sd.subdomain_name}</p>
              </div>
              <div className="flex-1 relative mx-2">
                <div className="rounded-full overflow-hidden" style={{ height: 7, backgroundColor: '#F3F4F6' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: col }} />
                </div>
                {/* Emotional heat band below bar */}
                {emoIntensity !== 'none' && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="rounded-full flex-1" style={{ height: 3, background: `linear-gradient(90deg, ${emoHeatCol[emoIntensity]}40 0%, ${emoHeatCol[emoIntensity]}18 100%)` }} />
                    <span className="text-[8px] font-semibold shrink-0" style={{ color: emoHeatCol[emoIntensity] }}>{emoHeatLabel[emoIntensity]}</span>
                  </div>
                )}
                <div className="absolute" style={{ left: '75%', top: emoIntensity !== 'none' ? '30%' : '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                  <div style={{ width: 2, height: 14, backgroundColor: '#475569', borderRadius: 1, opacity: 0.45 }} />
                </div>
              </div>
              <div style={{ width: 38, textAlign: 'right', flexShrink: 0 }}>
                <span className="text-[15px] font-bold" style={{ color: col, fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>{pct}%</span>
              </div>
              <div style={{ width: 26, textAlign: 'right', flexShrink: 0 }}>
                <span className="text-[13px] font-bold" style={{ color: deltaCol }}>{deltaStr}</span>
              </div>
            </div>
            {/* Explainability insight row */}
            {explainEntry && (
              <div className="mx-4 mb-2.5 px-3 py-2 rounded-lg flex gap-2" style={{ background: pct < 50 ? '#FEF2F2' : pct < 75 ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${pct < 50 ? '#FECACA' : pct < 75 ? '#FDE68A' : '#BBF7D0'}` }}>
                <div className="shrink-0 w-1 rounded-full self-stretch" style={{ background: col }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: col }}>Explainability · {explainEntry.confidence}</p>
                  <p className="text-[10px] leading-snug mb-1" style={{ color: '#374151' }}>{explainEntry.interpretation}</p>
                  <p className="text-[9px] leading-snug" style={{ color: '#6B7280' }}>{explainEntry.intervention}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Level Scale ── */}
      <div className="px-4 pt-3 pb-3.5" style={{ borderTop: '1px solid #F3F4F6' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Performance Scale</p>
        <div className="relative">
          <div className="flex rounded-full overflow-hidden" style={{ height: 8 }}>
            <div style={{ width: '40%', backgroundColor: '#EF4444' }} />
            <div style={{ width: '20%', backgroundColor: '#F59E0B' }} />
            <div style={{ width: '20%', backgroundColor: '#3B82F6' }} />
            <div style={{ width: '20%', backgroundColor: B.navy }} />
          </div>
          {[40, 60, 80].map(tick => (
            <div key={tick} className="absolute" style={{ left: `${tick}%`, top: 0, bottom: 0, width: 2, backgroundColor: '#fff', transform: 'translateX(-50%)' }} />
          ))}
        </div>
        <div className="flex mt-1.5">
          <div style={{ width: '40%' }} className="text-center">
            <span className="text-[10px] font-bold" style={{ color: '#EF4444' }}>EMERGING</span>
            <span className="block text-[9px]" style={{ color: '#9CA3AF' }}>0 – 39</span>
          </div>
          <div style={{ width: '20%' }} className="text-center">
            <span className="text-[10px] font-bold" style={{ color: '#F59E0B' }}>DEVELOPING</span>
            <span className="block text-[9px]" style={{ color: '#9CA3AF' }}>40 – 59</span>
          </div>
          <div style={{ width: '20%' }} className="text-center">
            <span className="text-[10px] font-bold" style={{ color: '#3B82F6' }}>PROFICIENT</span>
            <span className="block text-[9px]" style={{ color: '#9CA3AF' }}>60 – 79</span>
          </div>
          <div style={{ width: '20%' }} className="text-center">
            <span className="text-[10px] font-bold" style={{ color: B.navy }}>ADVANCED</span>
            <span className="block text-[9px]" style={{ color: '#9CA3AF' }}>80 – 100</span>
          </div>
        </div>
      </div>

      {/* Domain insight descriptions — rich per-score interpretations */}
      <div className="px-4 pt-3 pb-3.5 space-y-3" style={{ borderTop: `1px solid ${B.divider}`, background: B.navyBg }}>
        {domains.map((sd, i) => {
          const pct = pts[i];
          const ins = getSubdomainInsight(sd.subdomain_name, pct);
          const col = pct >= 70 ? '#14B8A6' : pct >= 40 ? '#F59E0B' : '#EF4444';
          const tierBg = pct >= 70 ? '#F0FDF9' : pct >= 40 ? '#FFFBEB' : '#FEF2F2';
          const tierLabel = pct >= 70 ? 'Strength' : pct >= 40 ? 'Developing' : 'Needs Focus';
          return (
            <div key={sd.subdomain_name} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${col}20`, background: '#fff' }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: tierBg, borderBottom: `1px solid ${col}18` }}>
      <div className="flex items-center gap-2">
        <div className="rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: col }} />
        <span className="text-[12px] font-bold" style={{ color: '#111827' }}>{ins.title}</span>
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${col}18`, color: col }}>{tierLabel} · {pct}%</span>
              </div>
              <div className="px-3 py-2.5">
      <p className="text-[12px] leading-relaxed" style={{ color: '#374151' }}>{ins.insight}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: `1px solid ${B.divider}` }}>
        <span className="text-[11px] flex items-center gap-1.5 font-medium" style={{ color: B.textMuted }}>
          <svg viewBox="0 0 12 12" style={{ width: 10, height: 10, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="4.5" width="9" height="6.5" rx="1"/><path d="M3.5 4.5V3a2.5 2.5 0 015 0v1.5"/></svg>
          Data is private and confidential
        </span>
        <span className="text-[11px] font-semibold" style={{ color: B.navy }}>Curiosity Stage ›</span>
      </div>
    </div>
            );
          })()}

          {/* ── PATTERN ANALYSIS + KEY FINDINGS + ACTIONS ── */}
          {rpt.subdomains.length > 0 && (() => {
            const scored = rpt.subdomains.map(sd => ({
    sd,
    pct: Math.min(100, Math.max(0, Math.round(Number(sd.avg_score)))),
    ins: getSubdomainInsight(sd.subdomain_name, Math.min(100, Math.max(0, Math.round(Number(sd.avg_score))))),
            })).sort((a, b) => b.pct - a.pct);

            const top = scored[0];
            const bottom = scored[scored.length - 1];
            const topScore = top?.pct ?? 0;
            const bottomScore = bottom?.pct ?? 0;

            // Composite pattern intelligence from shared utility
            const domainResults: DomainResult[] = scored.map(s => ({
              domain: s.sd.subdomain_name,
              label: s.ins.title,
              score: s.pct,
              percentage: s.pct,
              level: s.pct >= 80 ? 'Strong' : s.pct >= 60 ? 'On Track' : s.pct >= 40 ? 'Developing' : 'Needs Support',
              color: s.pct >= 70 ? '#14B8A6' : s.pct >= 40 ? '#F59E0B' : '#EF4444',
            }));
            const patternIntel = generatePatternDetection(domainResults);

            // Pattern detection
            const byName = (kw: string) => scored.find(s => s.sd.subdomain_name.toLowerCase().includes(kw));
            const metacog = byName('metacog') || byName('self-aware') || byName('awareness') || byName('monitor');
            const inhibit = byName('inhibit') || byName('impulse') || byName('control');
            const endure  = byName('endur') || byName('stamin') || byName('span');
            const selfEff = byName('effica') || byName('confid') || byName('belief');
            const exec    = byName('exec') || byName('follow') || byName('discipl');
            const stress  = byName('stress') || byName('pressur') || byName('anxi');

            let patternName = '';
            let patternDesc = '';

            if (metacog && inhibit && metacog.pct >= 58 && inhibit.pct < 50) {
    patternName = 'The Knowledge-Action Gap';
    patternDesc = `Your self-awareness score (${metacog.pct}%) is noticeably higher than your impulse control score (${inhibit.pct}%). You can see the pattern clearly — you know when it starts — but you can't stop it in the moment. This gap between knowing and doing is the most precisely addressable pattern in this assessment. It has a specific solution path.`;
            } else if (metacog && inhibit && metacog.pct < 45 && inhibit.pct < 45) {
    patternName = 'The Autopilot Pattern';
    patternDesc = `Both self-monitoring (${metacog.pct}%) and impulse control (${inhibit.pct}%) are below the development threshold. The behaviour is running largely below conscious awareness — which is why willpower alone hasn't worked. The pattern needs to be surfaced before it can be changed.`;
            } else if (selfEff && exec && selfEff.pct < 50 && exec.pct < 55) {
    patternName = 'The Confidence-Performance Loop';
    patternDesc = `Low confidence (${selfEff.pct}%) and low follow-through (${exec.pct}%) are reinforcing each other. Reduced belief leads to reduced effort, which produces lower results, which further reduces belief. This self-confirming loop needs to be interrupted at the belief level first — results follow from there.`;
            } else if (stress && inhibit && stress.pct < 50 && inhibit.pct < 50) {
    patternName = 'The Stress-Overflow Pattern';
    patternDesc = `Pressure handling (${stress.pct}%) and impulse control (${inhibit.pct}%) are both below the development threshold. Stress is overflowing into the ability to regulate behaviour — which compounds the original concern. Stress regulation is the entry point here; impulse control strengthens naturally as stress load decreases.`;
            } else if (endure && inhibit && endure.pct >= 62 && inhibit.pct < 50) {
    patternName = 'The Sustained-but-Distracted Pattern';
    patternDesc = `Your focus stamina (${endure.pct}%) is solid — you can stay at a task — but impulse control (${inhibit.pct}%) means you're frequently pulled off course while doing it. The effort is real but often redirected. The intervention here is environmental, not motivational.`;
            } else if (topScore - bottomScore > 35) {
    patternName = 'Clear Strengths, Clear Gaps';
    patternDesc = `There's a ${topScore - bottomScore}-point spread between your strongest area (${top.ins.title}: ${topScore}%) and your lowest (${bottom.ins.title}: ${bottomScore}%). The strengths are real and usable. The gap isn't a personality trait — it's a specific skill that responds well to targeted development.`;
            } else {
    patternName = 'Evenly Spread — System-Level Issue';
    patternDesc = `All domains are in a similar performance band, which means the issue isn't one missing skill — it's a missing system. Consistency and structure, more than any individual improvement, would create the biggest shift from this baseline.`;
            }

            // Actions: take from the 3 lowest-scoring domains
            const actionSources = [...scored].sort((a, b) => a.pct - b.pct).slice(0, 3);

            return (
    <>
      {/* Pattern Analysis */}
      <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1.5px solid ${B.navyBorder}` }}>
        <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ background: B.navyBg, borderBottom: `1px solid ${B.navyBorder}` }}>
          <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
          <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Behavioural Pattern Detected</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-[15px] font-bold mb-2" style={{ color: '#111827' }}>{patternName}</p>
          {/* OMEGA-X data traceability — atomic signal count + primary/secondary behavioural scopes from ontology */}
          {omegaReport && (() => {
            const ont = omegaReport.ontology as { active_node_count?: number; trigger_nodes?: { label: string }[]; protective_nodes?: { label: string }[]; causal_chain?: { from_label: string }[] } | undefined;
            const subs = omegaReport.subdomains as { item_count?: number }[] | undefined;
            const atomicCount = ont?.active_node_count ?? (subs ? subs.reduce((acc, s) => acc + Number(s.item_count ?? 0), 0) : 0);
            const primaryScope = ont?.trigger_nodes?.[0]?.label;
            const secondaryScope = ont?.protective_nodes?.[0]?.label ?? ont?.causal_chain?.[0]?.from_label;
            if (!atomicCount && !primaryScope) return null;
            return (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                {atomicCount > 0 && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', letterSpacing: '0.02em' }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#4338CA' }} />
                    Derived from {atomicCount} atomic telemetry signal{atomicCount === 1 ? '' : 's'}
                  </span>
                )}
                {primaryScope && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    Primary scope · {primaryScope}
                  </span>
                )}
                {secondaryScope && secondaryScope !== primaryScope && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#E0F2FE', color: '#075985', border: '1px solid #BAE6FD' }}>
                    Secondary scope · {secondaryScope}
                  </span>
                )}
              </div>
            );
          })()}
          <p className="text-[13px] leading-relaxed" style={{ color: '#374151' }}>{patternDesc}</p>
          {(patternIntel.riskFlags.length > 0 || patternIntel.growthIndicators.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {patternIntel.riskFlags.map(f => (
                <span key={f} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
              {patternIntel.growthIndicators.map(g => (
                <span key={g} className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                  {g.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          {/* Industrial Derailer Index — Friction Accelerator: bottom-scoring sub-domains surfaced as velocity limiters */}
          {(() => {
            const limiters = [...scored]
              .filter(s => s.pct < 55)
              .sort((a, b) => a.pct - b.pct)
              .slice(0, 3);
            if (limiters.length === 0) return null;
            return (
              <div className="mt-3 rounded-lg p-2.5" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#EA580C', color: '#fff' }}>Friction accelerator</span>
                  <span className="text-[10px] font-semibold" style={{ color: '#9A3412' }}>Velocity limiters on your readiness score</span>
                </div>
                <p className="text-[10px] leading-snug mb-1.5" style={{ color: '#9A3412' }}>
                  Developmental signals — these are the specific behavioural frictions holding back forward motion. Not a verdict; a map for where targeted work pays off most.
                </p>
                <div className="space-y-1.5">
                  {limiters.map((s) => {
                    const drag = 75 - s.pct;
                    return (
                      <div key={s.sd.subdomain_name} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: '#111827' }}>{s.ins.title}</p>
                          <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ background: '#FED7AA' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, drag * 1.4)}%`, background: 'linear-gradient(90deg, #EA580C 0%, #DC2626 100%)' }} />
                          </div>
                        </div>
                        <span className="text-[10px] font-bold shrink-0 tabular-nums" style={{ color: '#9A3412' }}>−{drag} pts drag</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Strength / Focus row */}
        <div className="grid grid-cols-2 gap-0" style={{ borderTop: `1px solid ${B.divider}` }}>
          <div className="px-4 py-3" style={{ borderRight: `1px solid ${B.divider}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#14B8A6' }}>{top.pct >= 65 ? 'Standout Strength' : 'Relative Strength'}</p>
            <p className="text-[13px] font-bold leading-snug" style={{ color: '#111827' }}>{top.ins.title}</p>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#6B7280' }}>{top.pct >= 65 ? 'Performing well — a real foundation to build from.' : 'Your highest-scoring area. Build here as you close the gaps below.'}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#EF4444' }}>Priority Focus Area</p>
            <p className="text-[13px] font-bold leading-snug" style={{ color: '#111827' }}>{bottom.ins.title}</p>
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#6B7280' }}>{getSubdomainInsight(bottom.sd.subdomain_name, bottom.pct).insight}</p>
          </div>
        </div>
      </div>

      {/* What Changes From Here */}
      <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1.5px solid #D1FAE5` }}>
        <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ background: '#ECFDF5', borderBottom: '1px solid #D1FAE5' }}>
          <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#059669' }} />
          <span className="text-[11px] font-black uppercase" style={{ color: '#059669', letterSpacing: '0.14em' }}>What Changes From Here</span>
        </div>
        <div className="px-4 py-3.5 space-y-2.5">
          <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>
            Understanding your pattern — not just recognising it — is what creates real, lasting change. Here's what becomes possible when you move from curiosity to action.
          </p>
          {([
            {
              timeframe: 'First 2 weeks',
              outcome: normalisedLevel === 'Emerging'
                ? 'You stop fighting the pattern with willpower alone and start working with a strategy that actually matches your profile.'
                : normalisedLevel === 'Developing'
                ? 'The good days become more consistent — because you\'ll know exactly what conditions make them happen.'
                : normalisedLevel === 'Proficient'
                ? 'The remaining gaps close faster once you know their specific trigger — not just their general category.'
                : 'You identify the edge cases worth addressing, and act on them with precision rather than guesswork.',
              col: '#059669', bg: '#F0FDF4', bdr: '#A7F3D0',
            },
            {
              timeframe: 'After 30 days',
              outcome: normalisedLevel === 'Emerging'
                ? 'The loop begins to break. You start noticing the pattern before it takes hold — which is exactly when change is possible.'
                : normalisedLevel === 'Developing'
                ? 'The effort required to manage this reduces — because the strategy fits you, not a generic template.'
                : normalisedLevel === 'Proficient'
                ? 'What used to require conscious effort becomes more automatic, freeing up energy for other things.'
                : 'The strengths you already have deepen and compound — because you understand their root, not just their output.',
              col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE',
            },
            {
              timeframe: 'Long term',
              outcome: normalisedLevel === 'Emerging'
                ? `"${rpt.concernName}" stops feeling like a permanent problem and starts feeling like a solved one.`
                : normalisedLevel === 'Developing'
                ? `"${rpt.concernName}" moves from something you manage to something you've genuinely outgrown.`
                : normalisedLevel === 'Proficient'
                ? 'You move from managing this well to mastering it — with clear understanding of what made the difference.'
                : 'Your model of yourself becomes more complete. That self-knowledge becomes a compounding advantage.',
              col: B.navy, bg: B.navyBg, bdr: B.navyBorder,
            },
          ] as const).map(({ timeframe, outcome, col, bg, bdr }) => (
            <div key={timeframe} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${bdr}` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: col }}>{timeframe}</p>
              <p className="text-[13px] leading-relaxed" style={{ color: B.textMid }}>{outcome}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Starting Actions */}
      <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: `1px solid ${B.navyBorder}` }}>
        <div className="px-4 pt-3.5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${B.divider}` }}>
          <div className="flex items-center gap-2">
            <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#059669' }} />
            <span className="text-[11px] font-black uppercase" style={{ color: '#059669', letterSpacing: '0.14em' }}>Where to Start — Right Now</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>3 actions</span>
        </div>
        <div className="px-4 py-3 space-y-3">
          <p className="text-[12px] leading-relaxed" style={{ color: '#6B7280' }}>
            Based on your lowest-scoring domains. Action 1 is the highest-leverage place to begin — do it today, not this week.
          </p>
          {actionSources.map((s, idx) => (
            <div
              key={s.sd.subdomain_name}
              className="flex items-start gap-3"
              style={idx === 0 ? { background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 12px' } : {}}
            >
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ backgroundColor: idx === 0 ? '#059669' : B.navyBg, color: idx === 0 ? '#fff' : B.navy, border: `1px solid ${idx === 0 ? '#059669' : B.navyBorder}` }}>{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: idx === 0 ? '#059669' : '#9CA3AF' }}>{s.ins.title} · {s.pct}%</p>
                  {idx === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#059669', color: '#fff' }}>Start today</span>}
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: '#111827' }}>{s.ins.action}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: `1px solid ${B.divider}`, background: '#ECFDF530' }}>
          <svg viewBox="0 0 12 12" style={{ width: 10, height: 10, color: '#059669', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="4.5"/><path d="M6 4v2.5L7.5 8"/></svg>
          <span className="text-[11px]" style={{ color: '#6B7280' }}>Start with action 1. Doing something small today beats planning something big later.</span>
        </div>
      </div>
    </>
            );
          })()}

          {/* ══ RUNTIME INTELLIGENCE EXPERIENCE LAYER (Phase 6B) ══
              Stakeholder toggle (Student / Parent / Counsellor) over the same
              read-only runtime intelligence, plus an explainability view. The
              Student view keeps its richer existing data path (guidance +
              activated signals); Parent/Counsellor are fed by the all-stakeholder
              runtime-summary. Flag OFF / no runtime-summary → only the Student
              view renders (no toggle) so the legacy report is byte-identical. */}
          <div className="mx-5 mt-5 space-y-3">
            {runtimeSummary?.summaries && (
              <div className="flex items-center gap-1 p-1 rounded-xl" role="tablist" aria-label="Stakeholder view" style={{ background: B.navyBg, border: `1px solid ${B.navyBorder}` }}>
                {([
                  ['student', 'For You'],
                  ['parent', 'For Parents'],
                  ['counselor', 'For Counsellors'],
                ] as [StakeholderLens, string][]).map(([key, label]) => {
                  const active = stakeholderLens === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStakeholderLens(key)}
                      className="flex-1 text-[12px] font-bold py-2 rounded-lg transition-all"
                      style={{ backgroundColor: active ? B.navy : 'transparent', color: active ? '#fff' : B.navy }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {stakeholderLens === 'student' && (
              <StudentIntelligencePanel guidance={guidance} emotionalSignals={emotionalSignals} B={B} />
            )}
            {stakeholderLens === 'parent' && runtimeSummary?.summaries && (
              <ParentIntelligencePanel summary={runtimeSummary.summaries.parent} B={B} />
            )}
            {stakeholderLens === 'counselor' && runtimeSummary?.summaries && (
              <CounselorIntelligencePanel summary={runtimeSummary.summaries.counselor} B={B} />
            )}

            {explainData && explainData.enabled !== false && (
              <>
                <button
                  type="button"
                  onClick={() => setExplainOpen(o => !o)}
                  className="w-full text-left px-4 py-3 rounded-xl flex items-center justify-between gap-2"
                  style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}
                >
                  <span className="flex items-center gap-2">
                    <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
                    <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Why am I seeing this?</span>
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: B.navy }}>{explainOpen ? 'Hide' : 'Show'}</span>
                </button>
                {explainOpen && <ExplainabilityPanel data={explainData} B={B} />}
              </>
            )}
          </div>

          {/* ══ YOUR ACTION PLAN (RIE recommendations) ══ */}
          {(rieRecommendations.length > 0 || rieHasEscalation) && (
            <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
    <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
      <div className="flex items-center gap-2">
        <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.teal }} />
        <span className="text-[11px] font-black uppercase" style={{ color: B.teal, letterSpacing: '0.14em' }}>Your Action Plan</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopyActionPlan}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            backgroundColor: rieActionPlanCopied ? '#ECFDF5' : B.navyBg,
            color: rieActionPlanCopied ? '#059669' : B.navy,
            border: `1px solid ${rieActionPlanCopied ? '#A7F3D0' : B.navyBorder}`,
          }}
        >
          {rieActionPlanCopied ? (
            <>
              <svg viewBox="0 0 16 16" style={{ width: 11, height: 11, flexShrink: 0 }} fill="currentColor">
      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" style={{ width: 11, height: 11, flexShrink: 0 }} fill="currentColor">
      <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
              </svg>
              Copy plan
            </>
          )}
        </button>
        {(() => {
          const isDesktopSuccess = rieActionPlanDesktopCopied || desktopCopied;
          const isMobileSuccess  = rieActionPlanShared;
          const isSuccess = isDesktopSuccess || isMobileSuccess;
          return (
            <button
              onClick={handleShareActionPlan}
              disabled={rieActionPlanSharing}
              title={!isSuccess && !rieActionPlanSharing ? 'On mobile: opens share sheet  ·  On desktop: copies to clipboard' : undefined}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                backgroundColor: isSuccess ? '#ECFDF5' : B.navyBg,
                color: isSuccess ? '#059669' : B.navy,
                border: `1px solid ${isSuccess ? '#A7F3D0' : B.navyBorder}`,
                opacity: rieActionPlanSharing ? 0.6 : 1,
                cursor: rieActionPlanSharing ? 'not-allowed' : 'pointer',
              }}
            >
              {isDesktopSuccess ? (
                <>
                  <svg viewBox="0 0 16 16" style={{ width: 11, height: 11, flexShrink: 0 }} fill="currentColor">
      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                  </svg>
                  Copied — paste anywhere!
                </>
              ) : isMobileSuccess ? (
                <>
                  <svg viewBox="0 0 16 16" style={{ width: 11, height: 11, flexShrink: 0 }} fill="currentColor">
      <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                  </svg>
                  Shared!
                </>
              ) : rieActionPlanSharing ? (
                <>
                  <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, flexShrink: 0, animation: 'spin 1s linear infinite' }} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Sharing…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" style={{ width: 11, height: 11, flexShrink: 0 }} fill="currentColor">
      <path d="M13.5 1a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 2.5a2.5 2.5 0 11.603 1.628l-6.718 3.12a2.499 2.499 0 010 1.504l6.718 3.12a2.5 2.5 0 11-.488.876l-6.718-3.12a2.5 2.5 0 110-3.256l6.718-3.12A2.5 2.5 0 0111 2.5zm-8.5 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm11 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                  </svg>
                  Share
                </>
              )}
            </button>
          );
        })()}
        {rieRecommendations.length > 0 && (
          <button
            onClick={handleDownloadActionPlan}
            disabled={rieActionPlanPdfLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              backgroundColor: B.navyBg,
              color: B.navy,
              border: `1px solid ${B.navyBorder}`,
              opacity: rieActionPlanPdfLoading ? 0.6 : 1,
              cursor: rieActionPlanPdfLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {rieActionPlanPdfLoading ? (
              <>
      <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, flexShrink: 0, animation: 'spin 1s linear infinite' }} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Generating…
              </>
            ) : (
              <>
      <svg viewBox="0 0 16 16" style={{ width: 11, height: 11, flexShrink: 0 }} fill="currentColor">
        <path fillRule="evenodd" d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/>
      </svg>
      Download plan
              </>
            )}
          </button>
        )}
      </div>
    </div>
    <div ref={actionPlanRef} className="px-4 pt-3 pb-1">
      <p className="text-[13px] leading-relaxed mb-3" style={{ color: B.textMid }}>
        Based on your assessment, here are personalised next steps to support your growth:
      </p>
      {rieRecommendations.length > 0 && (
        <div className="space-y-2.5 mb-3">
          {rieRecommendations.map((rec, i) => {
            const domainColors: Record<string, { col: string; bg: string; bdr: string }> = {
              learning:      { col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE' },
              behavioural:   { col: B.navy,   bg: B.navyBg, bdr: B.navyBorder },
              engagement:    { col: '#0D9488', bg: '#F0FDFA', bdr: '#CCFBF1' },
              emotional:     { col: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' },
              resilience:    { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' },
              employability: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' },
              leadership:    { col: '#344E86', bg: '#EEF2FA', bdr: '#D4DBF0' },
              recovery:      { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' },
            };
            const dc = domainColors[rec.domain] || domainColors['behavioural'];
            return (
              <div key={i} className="rounded-xl p-3.5" style={{ background: dc.bg, border: `1px solid ${dc.bdr}` }}>
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold mt-0.5" style={{ backgroundColor: dc.col }}>{i + 1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-snug mb-1" style={{ color: dc.col }}>{rec.title}</p>
          <p className="text-[12px] leading-relaxed" style={{ color: B.textMid }}>{rec.expected_outcome}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${dc.col}12`, color: dc.col }}>
              {rec.timing}
            </span>
            <span className="text-[10px] font-medium capitalize" style={{ color: B.textMuted }}>{rec.intensity} intensity</span>
          </div>
        </div>
      </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    {/* Counsellor CTA — shown only if escalation requires human support */}
    {rieHasEscalation && (
      <div className="mx-4 mb-4 rounded-xl p-3.5 flex items-start gap-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
          <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }} fill="none">
            <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 12a1 1 0 110-2 1 1 0 010 2zm1-4H9V6h2v4z" fill="#DC2626"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold mb-0.5" style={{ color: '#991B1B' }}>Talk to a Counsellor</p>
          <p className="text-[12px] leading-relaxed mb-2" style={{ color: '#B91C1C' }}>
            Your assessment signals indicate that a conversation with a qualified counsellor would be beneficial. This is a supportive step — not a diagnosis.
          </p>
          <a
            href={`https://wa.me/${counsellorNumber}?text=Hi!%20I%20completed%20a%20CAPADEX%20assessment%20and%20would%20like%20to%20speak%20with%20a%20counsellor.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#DC2626', color: '#fff' }}
          >
            <svg viewBox="0 0 20 20" style={{ width: 12, height: 12, flexShrink: 0 }} fill="white">
              <path d="M10 0C4.477 0 0 4.477 0 10c0 1.763.46 3.418 1.265 4.857L0 20l5.293-1.243A9.953 9.953 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm5.09 13.857c-.214.6-1.246 1.143-1.714 1.2-.443.053-.996.075-1.607-.1-.37-.11-.845-.257-1.454-.504-2.557-1.1-4.226-3.671-4.354-3.843-.129-.171-1.043-1.386-1.043-2.643 0-1.257.657-1.875.9-2.128.214-.229.471-.286.629-.286.157 0 .314 0 .457.007.143.007.343-.057.536.414.2.486.686 1.686.743 1.8.057.114.1.25.014.4-.086.143-.129.229-.257.371-.129.143-.271.32-.386.43-.129.121-.262.25-.114.49.15.243.657 1.079 1.407 1.75.971.864 1.793 1.136 2.043 1.264.243.129.386.107.529-.064.143-.172.614-.714.779-.957.164-.243.329-.2.557-.121.229.079 1.457.686 1.7.814.243.129.4.193.457.3.057.107.057.614-.157 1.214z"/>
            </svg>
            Request counsellor support
          </a>
        </div>
      </div>
    )}
            </div>
          )}

          {/* ── WHAT CURIOSITY CANNOT SHOW YOU ── */}
          <div className="mx-5 mt-5 rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
            <div className="px-4 pt-3.5 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${B.divider}` }}>
    <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
    <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>
      {isCareer ? 'Competency Intelligence — What Curiosity Cannot Show You' : 'What the Insight Stage Reveals'}
    </span>
            </div>
            <div className="px-4 pt-3 pb-1">
    <p className="text-[17px] font-bold leading-snug mb-2" style={{ color: '#111827', letterSpacing: '-0.01em' }}>
      {isCareer
        ? 'Your potential is not the problem. The gap is.'
        : 'This is what Curiosity cannot show you.'}
    </p>
    {isCareer && (
      <p className="text-[13px] leading-relaxed mb-3" style={{ color: B.textMid }}>
        MetryxOne decodes the specific competency gap between where you are and where you need to be — mapping your exact behavioural profile against verified professional standards for your target role and sector.
      </p>
    )}
            </div>
            <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
    {teasers.map((q, i) => (
      <div key={i} className="flex items-start gap-3 px-4 py-3">
        <span className="text-[12px] font-bold shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: B.navy }}>{i + 1}</span>
        <p className="text-[14px] leading-relaxed" style={{ color: '#6B7280' }}>{q}</p>
      </div>
    ))}
            </div>
          </div>

          {/* ── STAGE PRICING CARDS ── */}
          <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
            <div className="px-4 pt-3.5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${B.divider}` }}>
    <div className="flex items-center gap-2">
      <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: B.navy }} />
      <span className="text-[11px] font-black uppercase" style={{ color: B.navy, letterSpacing: '0.14em' }}>Decode Your Full Potential — Next Stages</span>
    </div>
            </div>
            <div className="px-4 pt-1 pb-2">
    <p className="text-[13px] py-2.5 leading-relaxed" style={{ color: B.textMid }}>
      {isCareer
        ? 'The Curiosity Stage maps where you are. The Insight Stage identifies the exact competency gap. Growth builds your transition plan. Mastery positions you for the role.'
        : 'The Curiosity Stage is just the beginning. Each subsequent stage reveals a deeper layer — from root-cause patterns to personalised strategies and peak performance mastery.'}
    </p>
            </div>

            {/* Stage cards — pricing from API; desc/benefits are persona-aware */}
            {([
    {
      stage: 'Insight',
      code: 'CAP_INS',
      num: 2,
      col: '#2563EB',
      bg: '#EFF6FF',
      bdr: '#BFDBFE',
      tagCol: '#2563EB',
      defaults: {
        price: '₹499', note: 'one-time · results in 24 hrs', tag: 'Most Popular', whatsapp_number: '919999999999',
        desc: isAcademic
          ? 'MetryxOne decodes the specific cognitive gaps and behavioural patterns affecting your academic performance — with precision that generic advice cannot reach.'
          : isCareer
          ? 'MetryxOne decodes the specific competency gaps and behavioural patterns holding you back — with precision that generic assessments and career coaches cannot reach.'
          : 'MetryxOne decodes the specific behavioural patterns driving your concern — with precision that generic support cannot reach.',
        benefits: isAcademic
          ? ['Root-cause pattern behind academic and study performance','Subject-specific cognitive gap analysis','Trigger identification for avoidance and procrastination','Longitudinal memory linking to your Curiosity patterns']
          : isCareer
          ? ['Competency gap analysis mapped to your target role','Behavioural benchmark vs verified professional standards','Root-cause pattern identification — not surface symptoms','Exact triggers, drivers, and leverage points for career change']
          : ['Root-cause pattern decoded from your Curiosity profile','Specific trigger identification for your concern','Personalised ranked action plan','Longitudinal memory linking to your Curiosity patterns'],
      },
    },
    {
      stage: 'Growth',
      code: 'CAP_GRW',
      num: 3,
      col: '#D97706',
      bg: '#FFFBEB',
      bdr: '#FDE68A',
      tagCol: '#D97706',
      defaults: {
        price: '₹999', note: 'one-time · includes Insight', tag: 'Best Value', whatsapp_number: '919999999999',
        desc: isAcademic
          ? 'Move from awareness to action. Get a personalised academic improvement strategy built around your exact behavioural pattern.'
          : 'Move from awareness to action. Get a personalised 30-day strategy built around your exact pattern.',
        benefits: isAcademic
          ? ['Personalised 30-day academic improvement strategy','Learning-style adapted study plan','Exam performance and stress management roadmap','Progress milestone framework for the academic year']
          : ['Personalised 30-day habit & strategy plan','Stage-by-stage intervention map','Progress checkpoints and milestone tracking','Behaviour replacement — not just suppression'],
      },
    },
    {
      stage: 'Mastery',
      code: 'CAP_MAS',
      num: 4,
      col: B.navy,
      bg: B.navyBg,
      bdr: B.navyBorder,
      tagCol: B.navy,
      defaults: {
        price: '₹1,999', note: 'one-time · full roadmap', tag: 'Complete Package', whatsapp_number: '919999999999',
        desc: isAcademic
          ? 'Your complete academic and behavioural intelligence profile — with 1-on-1 counsellor debrief and a long-term development roadmap.'
          : 'Your complete behavioural intelligence profile — with 1-on-1 expert debrief and career or academic guidance.',
        benefits: isAcademic
          ? ['Full 19-domain academic and behavioural readiness profile','1-on-1 counsellor debrief session included','Parent and teacher action guide','Long-term career readiness foundation map']
          : ['Everything in Insight + Growth stages','Full 19-domain behavioural intelligence profile','1-on-1 analyst debrief session included','Career or academic readiness intelligence map'],
      },
    },
            ] as const).map(({ stage, num, col, bg, bdr, tagCol, defaults, code }) => {
    const live = capadexPricing[code] || {};
    const price    = live.price        || defaults.price;
    const note     = live.price_note   || defaults.note;
    const tag      = live.tag          || defaults.tag;
    const waNum    = live.whatsapp_number || defaults.whatsapp_number;
    // For academic and career contexts always use persona-aware content; for general fall back to API data
    const desc     = (isAcademic || isCareer) ? defaults.desc : (live.description || defaults.desc);
    const benefits = (isAcademic || isCareer) ? defaults.benefits : ((live.benefits && live.benefits.length > 0) ? live.benefits : defaults.benefits);
    return (
    <div key={stage} className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ border: `1.5px solid ${bdr}`, background: bg }}>
      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${bdr}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-medium shrink-0" style={{ backgroundColor: col }}>{num}</div>
          <span className="text-[15px] font-medium" style={{ color: col }}>{stage}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${col}15`, color: col, border: `1px solid ${bdr}` }}>{tag}</span>
          <div className="text-right">
            <span className="text-[18px] font-semibold leading-none" style={{ color: col }}>{price}</span>
          </div>
        </div>
      </div>
      {/* Description */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[13px] leading-relaxed mb-2.5" style={{ color: B.textMid }}>{desc}</p>
        <p className="text-[10px] font-medium mb-2" style={{ color: B.textMuted }}>What you get</p>
        <div className="space-y-1.5 mb-3">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <svg viewBox="0 0 12 12" style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2 }} fill="none">
      <circle cx="6" cy="6" r="6" fill={col} opacity="0.15"/>
      <path d="M3.5 6l1.8 1.8 3.2-3.2" stroke={col} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[13px] leading-snug" style={{ color: B.textMid }}>{b}</span>
            </div>
          ))}
        </div>
        {isCareer && (() => {
          const careerBuilderSvcs: Record<string, { name: string; desc: string }[]> = {
            CAP_INS: [
              { name: 'Competency Benchmarking', desc: 'Compare your specific competencies against verified industry standards for your role and seniority.' },
              { name: 'Job Market Prediction', desc: 'Identify which roles and sectors are the strongest fit for your behavioural profile — and which reproduce the same friction.' },
            ],
            CAP_GRW: [
              { name: 'Job Studio', desc: 'Profile-matched CV positioning, interview preparation, and personal narrative — built on your actual behavioural strengths, not what merely sounds good on paper.' },
            ],
            CAP_MAS: [
              { name: 'Career Transition Modelling', desc: 'Simulate potential career moves using your Mastery-stage behavioural profile to predict which transitions are most aligned and most likely to produce lasting satisfaction.' },
            ],
          };
          const svcs = careerBuilderSvcs[code];
          if (!svcs) return null;
          return (
            <div className="mt-1 mb-3 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#F0FDF4 0%,#ECFDF5 100%)', border: '1.5px solid #6EE7B7' }}>
              <div className="px-3 pt-2.5 pb-2 flex items-center justify-between" style={{ borderBottom: '1px solid #A7F3D0' }}>
                <p className="text-[9.5px] font-black uppercase tracking-widest" style={{ color: '#059669', letterSpacing: '0.1em' }}>
                  Career Builder — Unlocks at this stage
                </p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>MetryxOne Service</span>
              </div>
              <div className="px-3 py-2.5">
                {svcs.map((svc, i) => (
                  <div key={i} className={`flex items-start gap-2${i > 0 ? ' mt-2.5' : ''}`}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#10B981' }} />
                    <div>
                      <p className="text-[12px] font-semibold leading-snug" style={{ color: '#065F46' }}>{svc.name}</p>
                      <p className="text-[11px] leading-snug mt-0.5" style={{ color: '#047857' }}>{svc.desc}</p>
                    </div>
                  </div>
                ))}
                <a
                  href={`https://wa.me/919999999999?text=${encodeURIComponent(`Hi! I'm interested in the ${svcs[0]?.name} service for my concern: ${capadexReport?.concernName || selectedConcern || ''}. Can you share more details?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full h-8 mt-3 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80"
                  style={{ background: '#059669', color: '#fff' }}
                >
                  <svg viewBox="0 0 20 20" style={{ width: 13, height: 13, flexShrink: 0 }} fill="white">
                    <path d="M10 0C4.477 0 0 4.477 0 10c0 1.763.46 3.418 1.265 4.857L0 20l5.293-1.243A9.953 9.953 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm5.09 13.857c-.214.6-1.246 1.143-1.714 1.2-.443.053-.996.075-1.607-.1-.37-.11-.845-.257-1.454-.504-2.557-1.1-4.226-3.671-4.354-3.843-.129-.171-1.043-1.386-1.043-2.643 0-1.257.657-1.875.9-2.128.214-.229.471-.286.629-.286.157 0 .314 0 .457.007.143.007.343-.057.536.414.2.486.686 1.686.743 1.8.057.114.1.25.014.4-.086.143-.129.229-.257.371-.129.143-.271.32-.386.43-.129.121-.262.25-.114.49.15.243.657 1.079 1.407 1.75.971.864 1.793 1.136 2.043 1.264.243.129.386.107.529-.064.143-.172.614-.714.779-.957.164-.243.329-.2.557-.121.229.079 1.457.686 1.7.814.243.129.4.193.457.3.057.107.057.614-.157 1.214z"/>
                  </svg>
                  Talk to a Career Specialist
                </a>
              </div>
            </div>
          );
        })()}
        <p className="text-[11px] mb-2.5" style={{ color: B.textMuted }}>{note}</p>
      </div>
      {/* CTA */}
      <div className="px-4 pb-3.5 space-y-2">
        <button
          onClick={() => handleUnlockRequest(code, stage, price, col, bg, bdr, benefits, note, waNum)}
          className="flex items-center justify-center gap-2 w-full h-10 rounded-xl text-[15px] font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: col }}
        >
          <svg viewBox="0 0 14 14" style={{ width: 13, height: 13 }} fill="none">
            <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="white" strokeWidth="1.4"/>
            <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Unlock {stage} — {price}
        </button>
        {/* WhatsApp chatbot help link */}
        <a
          href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Hi! I'd like to know more about the ${stage} stage (${price}) for my concern: ${capadexReport?.concernName || selectedConcern || ''}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full h-8 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{ color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0' }}
        >
          <svg viewBox="0 0 20 20" style={{ width: 14, height: 14, flexShrink: 0 }} fill="#15803D">
            <path d="M10 0C4.477 0 0 4.477 0 10c0 1.763.46 3.418 1.265 4.857L0 20l5.293-1.243A9.953 9.953 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm5.09 13.857c-.214.6-1.246 1.143-1.714 1.2-.443.053-.996.075-1.607-.1-.37-.11-.845-.257-1.454-.504-2.557-1.1-4.226-3.671-4.354-3.843-.129-.171-1.043-1.386-1.043-2.643 0-1.257.657-1.875.9-2.128.214-.229.471-.286.629-.286.157 0 .314 0 .457.007.143.007.343-.057.536.414.2.486.686 1.686.743 1.8.057.114.1.25.014.4-.086.143-.129.229-.257.371-.129.143-.271.32-.386.43-.129.121-.262.25-.114.49.15.243.657 1.079 1.407 1.75.971.864 1.793 1.136 2.043 1.264.243.129.386.107.529-.064.143-.172.614-.714.779-.957.164-.243.329-.2.557-.121.229.079 1.457.686 1.7.814.243.129.4.193.457.3.057.107.057.614-.157 1.214z"/>
          </svg>
          Have a question? Chat with us
        </a>
      </div>
    </div>
    );
            })}

            {/* Trust bar */}
            <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-1">
    {['Expert-reviewed', 'Confidential', 'DPDP Compliant'].map((t, i) => (
      <span key={i} className="text-[11px] flex items-center gap-1" style={{ color: B.textMuted }}>
        <svg viewBox="0 0 10 10" style={{ width: 9, height: 9 }} fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={B.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {t}
      </span>
    ))}
            </div>
          </div>

          {/* ── SOCIAL PROOF ── */}
          <div className="mx-5 mt-4 rounded-xl px-4 py-4" style={{ background: '#ffffff', border: `1px solid ${B.navyBorder}` }}>
            <p className="text-[11px] font-medium mb-2" style={{ color: '#9CA3AF' }}>What users say</p>
            <p className="text-[14px] leading-relaxed italic mb-2" style={{ color: '#374151' }}>
    {isCareer
      ? `"I had been in the same loop for two years. The competency gap analysis showed me exactly what was missing — not in a vague way, but role by role, skill by skill."`
      : `"I thought I knew my patterns. The Insight report showed me things I never would have figured out on my own."`}
            </p>
            <p className="text-[12px]" style={{ color: '#9CA3AF' }}>
              {isCareer ? '— MetryxOne user, career transition completed' : '— MetryxOne user, after completing Insight'}
            </p>
          </div>

          {/* ── MY REPORTS ── */}
          {recentSessions.length > 1 && (
            <div className="mx-5 mt-5">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EBF4' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: '#F8F9FB', borderBottom: '1px solid #E8EBF4' }}>
                  <div className="rounded-full shrink-0" style={{ width: 3, height: 14, backgroundColor: '#344E86' }} />
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#344E86' }}>My Reports</span>
                </div>
                <div className="divide-y" style={{ borderColor: '#F0F2F7' }}>
                  {recentSessions.map(s => {
                    const isCurrent = s.session_id === capadexSessionId;
                    const lvl = s.score_level === 'Mastery' ? 'Advanced' : (s.score_level || '');
                    const lvlCol: Record<string,string> = { Advanced:'#344E86', Proficient:'#2563EB', Developing:'#D97706', Emerging:'#DC2626' };
                    const stageLabel: Record<string,string> = STAGE_CODE_TO_LABEL;
                    const col = lvlCol[lvl] ?? '#6B7280';
                    return (
                      <button
                        key={s.session_id}
                        onClick={() => !isCurrent && handleLoadPreviousReport(s.session_id)}
                        disabled={isCurrent || recentSessionsLoading}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default"
                        style={{ background: isCurrent ? '#EEF2FA' : undefined }}
                        onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = '#F8F9FB'; }}
                        onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = ''; }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[14px]"
                          style={{ background: `${col}12`, color: col }}>
                          {s.score !== null ? Math.round(s.score) : '—'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate" style={{ color: '#1E2B4A' }}>{s.concern_name}</p>
                          <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                            {stageLabel[s.stage_code] || s.stage_code}
                            {lvl ? ` · ${lvl}` : ''}
                            {' · '}{new Date(s.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                          </p>
                        </div>
                        {isCurrent
                          ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#344E8614', color: '#344E86' }}>Viewing</span>
                          : <ArrowRight size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
                        }
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── YOUR GROWTH JOURNEY CTA ── */}
          {capadexSessionId && capadexRegEmail && (
            <div className="mx-5 mt-4 mb-2">
    <button
      onClick={() => setShowGrowthJourney(true)}
      className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold transition-all hover:opacity-90"
      style={{ background: 'linear-gradient(135deg, #344E86 0%, #2563EB 100%)', color: '#fff', boxShadow: '0 4px 14px rgba(52,78,134,0.25)' }}
    >
      <TrendingUp size={15} />
      View Your Growth Journey
    </button>
    <p className="text-center text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>
      See your longitudinal development trajectory and insights
    </p>
            </div>
          )}

          {/* ── INTELLIGENCE LAYERS ── */}
          {capadexSessionId && (
            <div className="mx-4 mt-4">
              <IntelligenceLayers sessionId={capadexSessionId} title="Deep Intelligence Layers" compact />
            </div>
          )}

          {/* ── REPORT META + FOOTER ── */}
          <div className="mx-4 mt-4 mb-4 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EBF4' }}>
            <div className="flex">
    {[
      { label: 'Report ID',  value: rpt.reportId.slice(0, 8).toUpperCase(), mono: true },
      { label: 'Generated',  value: new Date(rpt.generatedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }), mono: false },
      { label: 'Stage',      value: 'Curiosity', mono: false, accent: true },
    ].map(({ label, value, mono, accent }, idx) => (
      <div key={label} className="flex-1 px-3 py-3 text-center" style={{ borderLeft: idx > 0 ? '1px solid #F3F4F6' : 'none' }}>
        <p className="text-[10px] font-medium mb-1" style={{ color: '#9CA3AF' }}>{label}</p>
        <p className="text-[12px] truncate font-medium" style={{ color: accent ? '#344E86' : mono ? '#111827' : '#6B7280', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>{value}</p>
      </div>
    ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pb-5">
            {['DPDP Compliant', 'Confidential', 'Secure'].map((tag, i) => (
    <span key={i} className="text-[11px]" style={{ color: '#9CA3AF' }}>{i > 0 ? '· ' : ''}{tag}</span>
            ))}
          </div>
        </div>
      );
    })()}
  </div>
  );
}
