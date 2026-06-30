import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRuntimeSync } from "@/hooks/useRuntimeSync";
import metryxLogo from "@/assets/metryx-logo-transparent.png";
import { notificationService } from '@/lib/notifications/service';
import { CONCERN_OPTIONS, CONCERN_QUESTIONS } from './assessmentConcerns';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Key } from "lucide-react";
import GrowthJourneyModal from "./GrowthJourneyModal";
import { CapadexReportPhase } from "./assessment/phases/CapadexReportPhase";
import { CapadexReliefModal } from "./assessment/CapadexReliefModal";
import { AssessmentModalContext } from "@/contexts/AssessmentModalContext";
import { IntroPhase } from "./assessment/phases/IntroPhase";
import { QuestionsPhase } from "./assessment/phases/QuestionsPhase";
import { CapadexAnalyzePhase } from "./assessment/phases/CapadexAnalyzePhase";
import { CapadexClarifyPhase } from "./assessment/phases/CapadexClarifyPhase";
import { CapadexBridgePhase } from "./assessment/phases/CapadexBridgePhase";
import { CapadexPreviewPhase } from "./assessment/phases/CapadexPreviewPhase";
import { CapadexQPhase } from "./assessment/phases/CapadexQPhase";
import { CapadexResultPhase } from "./assessment/phases/CapadexResultPhase";
import { AnalyzingPhase } from "./assessment/phases/AnalyzingPhase";
import { RegisterPhase } from "./assessment/phases/RegisterPhase";
import { OtpPhase } from "./assessment/phases/OtpPhase";
import { ReportPhase } from "./assessment/phases/ReportPhase";
import { CapadexRegisterPhase } from "./assessment/phases/CapadexRegisterPhase";
import { CapadexOtpPhase } from "./assessment/phases/CapadexOtpPhase";
import { CapadexPaymentPhase } from "./assessment/phases/CapadexPaymentPhase";
import { CapadexInsProfilePhase } from "./assessment/phases/CapadexInsProfilePhase";
import { CapadexCurProfilePhase } from "./assessment/phases/CapadexCurProfilePhase";
import { CapadexGrwProfilePhase } from "./assessment/phases/CapadexGrwProfilePhase";
import { CapadexMasProfilePhase } from "./assessment/phases/CapadexMasProfilePhase";
import { CapadexPackageSelectionPhase } from "./assessment/phases/CapadexPackageSelectionPhase";
import {
  BRAND, CAPADEX_STAGES, PERSONAS, QUESTION_BANKS, RATING_OPTIONS,
  DOMAIN_ICONS, LOCKED_DOMAINS_BY_PERSONA, FAM_TERMS, UPGRADE_TIERS,
  getLevel, buildInsightNarrative, getAgeRange, getSubdomainInsight, generatePatternDetection,
  type CapadexQuestion, type CapadexProgress, type CapadexStageResult,
  type PersonaKey, type DomainResult,
} from '@/lib/behavioural-insights';

// sessionStorage key for clarity ids already shown this session. Sent to
// `/analyze` as `answeredIds` so the backend excludes them from the next batch
// (prevents the same clarity questions repeating across re-runs / concerns).
const SEEN_CLARITY_KEY = 'mx-capadex-seen-clarity';

interface FreeAssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (screen: string) => void;
  initialPersona?: PersonaKey;
  initialConcern?: string;
  initialName?: string;
  initialAge?: string;
  initialAssesseeType?: 'myself' | 'someone-else';
  initialSessionId?: string;
  initialEmail?: string;
  onNewAssessmentStarted?: () => void;
}


export function FreeAssessmentModal({ open, onOpenChange, onNavigate, initialPersona, initialConcern, initialName, initialAge, initialAssesseeType, initialSessionId, initialEmail, onNewAssessmentStarted }: FreeAssessmentModalProps) {
  const [selectedPersona, setSelectedPersona] = useState<PersonaKey | null>(initialPersona || null);
  // 2026-05-28 macro-track overhaul: granular sub-persona token + is_proxy flag
  // + age band. Lifted to modal-level so the /analyze payload envelope can ship
  // the exact spec fields (primary_persona / is_proxy / target_age_band).
  const [primaryPersona, setPrimaryPersona] = useState<string | null>(null);
  // Per-concern canonical metadata (concern_id / domain / cluster) keyed by
  // the human-readable area string. Populated when the user taps a suggestion
  // chip; spread into /api/capadex/concern/analyze so backend resolution and
  // `resolveCapadexConcern()` fallback can route on the master-table ID.
  const [concernMetaMap, setConcernMetaMap] = useState<Record<string, { concern_id?: string; domain?: string; concern_cluster?: string; typical_age_band?: string; growth_trend?: string; severity?: string }>>({});
  const [isProxy, setIsProxy] = useState<boolean>(false);
  const [ageBand, setAgeBand] = useState<string>('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [phase, setPhase] = useState<"intro" | "questions" | "analyzing" | "register" | "otp" | "report" | "capadex_q" | "capadex_result" | "capadex_register" | "capadex_otp" | "capadex_report" | "capadex_analyze" | "capadex_clarify" | "capadex_bridge" | "capadex_packages" | "capadex_preview" | "capadex_payment" | "capadex_cur_profile" | "capadex_ins_profile" | "capadex_grw_profile" | "capadex_mas_profile" | "capadex_relief">("intro");
  // Module 2 — Safety Circuit Breaker. When /respond returns safety_intercept:true
  // we set this to the envelope so the relief overlay can render the support_resources
  // message + counsellor_routing CTA. Cleared on session reset / modal close.
  const [safetyIntercept, setSafetyIntercept] = useState<null | {
    message: string;
    action_type: string;
  }>(null);
  const getProfilePhase = (stageCode: string): string => {
    switch (stageCode) {
      case 'CAP_CUR': return 'capadex_cur_profile';
      case 'CAP_INS': return 'capadex_ins_profile';
      case 'CAP_GRW': return 'capadex_grw_profile';
      case 'CAP_MAS': return 'capadex_mas_profile';
      default:        return 'capadex_q';
    }
  };
  const [participantName, setParticipantName] = useState("");
  const [contextField, setContextField] = useState("");
  const [reportTab, setReportTab] = useState<"results" | "unlock">("results");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['','','','','','']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [upgradeGoal, setUpgradeGoal] = useState('');
  const [upgradeUrgency, setUpgradeUrgency] = useState('');
  const [emailExistsName, setEmailExistsName] = useState<string | null>(null);
  const [selectedConcern, setSelectedConcern] = useState<string | null>(null);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [concernSearch, setConcernSearch] = useState('');
  // Shape mirrors `ConcernSuggestion` in assessment/types.ts — master-table
  // rows (`source:'master'`) carry `concern_id` / `domain` / `concern_cluster`
  // so chip-tap can persist canonical identifiers into `concernMetaMap`.
  // 2026-05-28 — persona-fallback flag mirrors the backend response field of
  // the same name; surfaced as a note in IntroPhase when hybrid filter
  // dropped the persona constraint.
  const [concernPersonaFallback, setConcernPersonaFallback] = useState<boolean>(false);
  const [concernSuggestions, setConcernSuggestions] = useState<Array<{
    id: string | number;
    category: string;
    concern_area: string;
    parent_worry: string;
    has_assessment: boolean;
    construct_key: string | null;
    construct_label: string | null;
    construct_cluster: string | null;
    concern_id?: string | null;
    domain?: string | null;
    concern_cluster?: string | null;
    impact_on_child?: string | null;
    source?: 'master' | 'legacy';
  }>>([]);
  const [showConcernSugg, setShowConcernSugg] = useState(false);
  const [concernLoading, setConcernLoading] = useState(false);
  const [concernHighlight, setConcernHighlight] = useState(-1);
  const [famTermIdx, setFamTermIdx] = useState(0);
  const [famTermVisible, setFamTermVisible] = useState(true);
  const [userAge, setUserAge] = useState('');
  // 2026-05-29 — additive enrichment fields (optional): demographic + goal
  // context. None gate the CTA; spread into the /analyze payload as additive
  // signals and reset on session reset.
  const [participantGender, setParticipantGender] = useState('');
  const [participantCity, setParticipantCity] = useState('');
  const [participantGoal, setParticipantGoal] = useState('');
  const [goalTimeline, setGoalTimeline] = useState('');
  const [assesseeType, setAssesseeType] = useState<'myself' | 'my-child' | 'a-student' | 'someone-else' | ''>('');
  // Orchestration Context — populated by /api/capadex/concern/analyze. Carries
  // the formal actor_persona / target_persona / relationship_type derived from
  // (persona, assesseeType, age) so every downstream phase reads from one
  // canonical source instead of re-deriving on every unmount/remount. Null
  // until analyze completes; phases must default-guard.
  const [runtimeContext, setRuntimeContext] = useState<{
    actor_persona: string;
    target_persona: string;
    relationship_type: string;
    target_age: number | null;
    persisted?: boolean;
  } | null>(null);
  const [requesterName, setRequesterName] = useState('');
  const [capadexSessionId, setCapadexSessionId] = useState<string | null>(null);
  const [showPacingCue, setShowPacingCue] = useState(false);
  const [capadexStage, setCapadexStage] = useState('CAP_CUR');
  const [capadexStageIndex, setCapadexStageIndex] = useState(0);
  const [capadexStageColor, setCapadexStageColor] = useState('#3B82F6');
  const [capadexItems, setCapadexItems] = useState<CapadexQuestion[]>([]);
  const [capadexAnswers, setCapadexAnswers] = useState<Record<string, number>>({});
  const [capadexCurrentQ, setCapadexCurrentQ] = useState(0);
  const [questionTimings, setQuestionTimings] = useState<Record<string, { response_time_ms: number; answer_changed: boolean; response_value: number }>>({});
  const questionShownAtRef = useRef<number>(Date.now());
  // Behavioral Signal Ingestion Buffer (Adv. #1): per-question cumulative
  // backtrack counter. Increments when the user changes a previously selected
  // answer for the SAME question. Posted fire-and-forget to /api/signals/telemetry
  // on every answer event. text_edit_count is wired through but stays 0 — the
  // per-question UI is choice-only; reserve for future freeform follow-ups.
  const capadexBacktrackRef = useRef<Record<string, number>>({});
  const [capadexStageResult, setCapadexStageResult] = useState<CapadexStageResult | null>(null);
  const [capadexProgress, setCapadexProgress] = useState<CapadexProgress[]>([]);
  const [capadexLoading, setCapadexLoading] = useState(false);
  const [capadexError, setCapadexError]   = useState<string | null>(null);

  // ── Concern Intelligence (conversational flow) ─────────────────────────────
  interface ConcernIntelligenceResult {
    category: string; severity: string; severity_label: string;
    risk_level: string; growth_readiness: string;
    emotional_signals: string[]; detected_patterns: string[];
    subdomains: string[];
    clarification_questions: Array<{ id: string; question: string; options: string[]; response_type?: string }>;
    behavioural_mirror: string[]; intelligence_preview: string[];
    persona_detected: string;
    prefilled_answers?: Record<number, string>;
    preliminary_patterns?: { patterns: string[]; tags: string[]; source?: string };
    adaptive_enabled?: boolean;
  }
  const [concernIntelligence, setConcernIntelligence] = useState<ConcernIntelligenceResult | null>(null);
  const [analyzeStep,    setAnalyzeStep]    = useState(0);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string[]>>({});
  const [clarifyCurrentQ, setClarifyCurrentQ] = useState(0);
  // ── Adaptive Questioning (Phase B) ──────────────────────────────────────────
  // When `/analyze` reports `adaptive_enabled` (backend flag ON) we drive the
  // clarify phase incrementally via `/adaptive-next` instead of walking the
  // static batch. Every adaptive call is fallback-safe: on `enabled:false`, a
  // network error, or a duplicate/empty pick we fall back to the next unshown
  // batch question so the experience NEVER breaks. `adaptiveMode` is only armed
  // when there are no prefilled answers (prefill uses the batch flow as before).
  const [adaptiveMode, setAdaptiveMode] = useState(false);
  const adaptiveFullBatchRef = useRef<Array<{ id: string; question: string; options: string[]; response_type?: string }>>([]);
  const adaptivePayloadRef = useRef<Record<string, unknown> | null>(null);
  const ADAPTIVE_MAX_QUESTIONS = 12;

  // CAPADEX registration + report state
  const [capadexRegEmail, setCapadexRegEmail] = useState('');
  const [capadexPassword, setCapadexPassword] = useState('');
  const [capadexShowPass, setCapadexShowPass] = useState(false);
  const [capadexRegLoading, setCapadexRegLoading] = useState(false);
  const [capadexRegError, setCapadexRegError] = useState<string | null>(null);
  const [capadexLoginMode, setCapadexLoginMode] = useState(false);
  const [capadexLoginOtpSent, setCapadexLoginOtpSent] = useState(false);
  const [capadexLoginOtpLoading, setCapadexLoginOtpLoading] = useState(false);
  const [capadexLoginOtpError, setCapadexLoginOtpError] = useState<string | null>(null);
  const [capadexExistingName, setCapadexExistingName] = useState('');
  const [capadexOtpDigits, setCapadexOtpDigits] = useState<string[]>(['','','','','','']);
  const [capadexOtpLoading, setCapadexOtpLoading] = useState(false);
  const [capadexOtpError, setCapadexOtpError] = useState<string | null>(null);
  const [capadexOtpTimer, setCapadexOtpTimer] = useState(0);
  const capadexOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  // ── Stage-skip (returning user) ────────────────────────────────────────
  const [capadexReturnEmail, setCapadexReturnEmail] = useState('');
  const [capadexStageCheck, setCapadexStageCheck] = useState<{
    completed: string[];
    has_prior_completion: boolean;
    next_stage_code: string | null;
    next_stage_label: string | null;
    next_stage_index: number;
    next_stage_color: string;
    last_session_id?: string | null;
    existing_persona?: string | null;
    persona_mismatch?: boolean;
  } | null>(null);
  const [capadexStageCheckLoading, setCapadexStageCheckLoading] = useState(false);
  const [capadexSkipIntent, setCapadexSkipIntent] = useState(false);
  const [retrieveReportMode, setRetrieveReportMode] = useState(false);
  const [recentSessions, setRecentSessions] = useState<Array<{
    session_id: string; concern_name: string; stage_code: string;
    score: number | null; score_level: string | null; created_at: string;
  }>>([]);
  const [recentSessionsLoading, setRecentSessionsLoading] = useState(false);
  const [capadexUser, setCapadexUser] = useState<{ id: string; name: string; email: string } | null>(null);
  // ── Returning user intent shortcut ────────────────────────────────────
  const [returningIntent, setReturningIntent] = useState<'resume' | 'report' | null>(null);

  // ── Intro-phase: early email check + OTP verification ────────────────
  const [introEmailStatus, setIntroEmailStatus] = useState<'idle' | 'checking' | 'returning' | 'new' | 'limited'>('idle');
  const [introEmailName, setIntroEmailName] = useState('');
  const [introEmailVerified, setIntroEmailVerified] = useState(false);
  const [introOtpSent, setIntroOtpSent] = useState(false);
  const [introOtpDigits, setIntroOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [introOtpLoading, setIntroOtpLoading] = useState(false);
  const [introOtpError, setIntroOtpError] = useState<string | null>(null);
  const [introOtpTimer, setIntroOtpTimer] = useState(0);
  const introOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  // ── Incomplete Curiosity session (detected after OTP verify) ─────────
  const [incompleteSession, setIncompleteSession] = useState<{
    session_id: string; concern_name: string; answered_items: number;
    total_items: number; updated_at: string;
  } | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);

  // ── Resume: saved draft from a previous session ───────────────────────
  const DRAFT_KEY = 'capadex_draft';
  const [savedSession, setSavedSession] = useState<{
    concern: string; selectedConcerns: string[]; phase: string;
    session_id?: string; email: string; timestamp: number;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Expire after 48 hours
      if (Date.now() - parsed.timestamp > 48 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return parsed;
    } catch { return null; }
  });
  const [capadexReport, setCapadexReport] = useState<{
    reportId: string; concernName: string; stageCode: string; stageLabel: string;
    score: number; rawScore: number; scoreLevel: string;
    insight: string;
    scoreOverride: number | null; headlineOverride: string | null;
    narrativeOverride: string | null; overrideReason: string | null;
    reviewStatus: string; reviewedBy: string | null;
    reviewedAt: string | null; publishedAt: string | null;
    participantName: string; participantAge: number | null;
    subdomains: Array<{ subdomain_name: string; avg_score: number; item_count: number }>;
    generatedAt: string;
  } | null>(null);
  const [omegaReport, setOmegaReport] = useState<Record<string, unknown> | null>(null);
  // RIE action plan for the user-facing report
  const [rieRecommendations, setRieRecommendations] = useState<Array<{
    title: string; expected_outcome: string; rec_type: string;
    domain: string; timing: string; intensity: string; confidence: number;
  }>>([]);
  const [rieHasEscalation, setRieHasEscalation] = useState(false);
  const [rieActionPlanCopied, setRieActionPlanCopied] = useState(false);
  const [rieActionPlanPdfLoading, setRieActionPlanPdfLoading] = useState(false);
  const [rieActionPlanSharing, setRieActionPlanSharing] = useState(false);
  const [rieActionPlanShared, setRieActionPlanShared] = useState(false);
  const [rieActionPlanDesktopCopied, setRieActionPlanDesktopCopied] = useState(false);

  useEffect(() => {
    if (phase !== 'capadex_report' || !capadexSessionId) return;
    let cancelled = false;
    const fetchRecs = async (attempt: number) => {
      try {
        const r = await fetch(`/api/capadex/session/${capadexSessionId}/recommendations`);
        if (cancelled) return;
        const data = r.ok ? await r.json() : { recommendations: [], has_escalation: false };
        if (cancelled) return;
        const recs = data.recommendations || [];
        setRieRecommendations(recs);
        setRieHasEscalation(data.has_escalation || false);
        if (recs.length === 0 && attempt < 2) {
          setTimeout(() => { if (!cancelled) fetchRecs(attempt + 1); }, 3000);
        }
      } catch {
        if (!cancelled && attempt < 2) {
          setTimeout(() => fetchRecs(attempt + 1), 3000);
        }
      }
    };
    fetchRecs(0);
    return () => { cancelled = true; };
  }, [phase, capadexSessionId]);

  // Global counsellor WhatsApp number from platform settings
  const [counsellorNumber, setCounsellorNumber] = useState('919999999999');
  const [wsRuntimeEnabled, setWsRuntimeEnabled] = useState(false);
  const [cogLoadEnabled, setCogLoadEnabled]     = useState(false);
  useEffect(() => {
    fetch('/api/capadex/public-config')
      .then(r => r.json())
      .then((cfg: { counsellor_whatsapp_number?: string; websocket_runtime?: boolean; cognitive_load_engine?: boolean }) => {
        if (cfg.counsellor_whatsapp_number) setCounsellorNumber(cfg.counsellor_whatsapp_number);
        if (cfg.websocket_runtime)    setWsRuntimeEnabled(true);
        if (cfg.cognitive_load_engine) setCogLoadEnabled(true);
      })
      .catch(() => {});
  }, []);

  // Live cognitive runtime sync — active only during assessment questions and when feature flag enabled.
  // Passes guestKey = capadexSessionId as a capability token so the WS server can verify
  // the caller owns this session without requiring a full authenticated session cookie.
  const { latestEvent: runtimeEvent } = useRuntimeSync(
    capadexSessionId,
    wsRuntimeEnabled && phase === 'capadex_q',
    capadexSessionId ? { guestKey: capadexSessionId } : undefined,
  );

  // Handle pacing cues from cognitive load alerts.
  // Dual-flag guard: `wsRuntimeEnabled` gates the WS connection (websocket_runtime flag);
  // `cogLoadEnabled` independently gates the pacing cue UI (cognitive_load_engine flag).
  // Both flags are read from /api/capadex/public-config on mount.
  useEffect(() => {
    if (!cogLoadEnabled || !runtimeEvent || runtimeEvent.type !== 'cognitive_load_alert') return;
    const action = runtimeEvent.data?.recommended_action as string | undefined;
    if (action === 'shorten_flow' || action === 'offer_break') {
      setShowPacingCue(true);
    }
  }, [runtimeEvent]);

  // Live pricing fetched from API — keyed by stage_code
  const [capadexPricing, setCapadexPricing] = useState<Record<string, {
    price: string; price_note: string; tag: string; description: string;
    benefits: string[]; whatsapp_number: string;
  }>>({});
  useEffect(() => {
    fetch('/api/capadex/pricing')
      .then(r => r.json())
      .then((rows: Array<{ stage_code: string; price: string; price_note: string; tag: string; description: string; benefits: string[]; whatsapp_number: string }>) => {
        const map: Record<string, typeof rows[0]> = {};
        rows.forEach(r => { map[r.stage_code] = r; });
        setCapadexPricing(map);
      })
      .catch(() => {});
  }, []);

  const [showGrowthJourney, setShowGrowthJourney] = useState(false);
  const [unlockSubmitted, setUnlockSubmitted] = useState<Set<string>>(new Set());
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [paymentStageData, setPaymentStageData] = useState<{
    code: string; name: string; price: string; color: string; bg: string; bdr: string;
    benefits: string[]; note: string; waNum: string;
  } | null>(null);
  const [paymentConfirmLoading, setPaymentConfirmLoading] = useState(false);

  const handleUnlockRequest = (stageCode: string, stageName: string, price: string, color: string, bg: string, bdr: string, benefits: string[], note: string, waNum: string) => {
    setPaymentStageData({ code: stageCode, name: stageName, price, color, bg, bdr, benefits, note, waNum });
    setPhase('capadex_payment');
  };

  const handlePaymentProceed = (tier: string) => {
    setSelectedTier(tier);
  };

  // ── Launch next stage after successful payment ────────────────────────
  const startNextStageAfterPayment = async (email: string) => {
    const resolvedConcernName = capadexStageResult?.concern_name || capadexReport?.concernName || selectedConcern;
    const resp = await fetch('/api/capadex/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concern_name: resolvedConcernName,
        user_age: parseInt(userAge, 10) || 18,
        persona: selectedPersona || null,
        guest_email: email,
        guest_name: participantName.trim() || capadexReport?.participantName || null,
        // Ontology anchor for Phase 1 reverse-weighting prerequisites — sourced from
        // the /concern/analyze response captured in concernIntelligence. Server
        // falls back to detectCategory(concern_name) if absent.
        construct_key: concernIntelligence?.construct_key || null,
      }),
    });
    const data = await resp.json();
    if (resp.ok && data.session_id) {
      setCapadexSessionId(data.session_id);
      setCapadexStage(data.stage_code);
      setCapadexStageIndex(data.stage_index);
      setCapadexStageColor(data.stage_color || paymentStageData?.color || '#344E86');
      setCapadexItems(data.questions || []);
      setCapadexProgress(data.progress || []);
      setCapadexAnswers({});
      capadexBacktrackRef.current = {}; // reset per-session telemetry counters
      setCapadexCurrentQ(0);
      setCapadexStageResult(null);
      setPhase(getProfilePhase(data.stage_code));
    } else {
      setCapadexError(data.error || 'Could not start next stage. Please try again.');
      setPhase('capadex_report');
    }
  };

  // ── Main payment handler — Razorpay checkout ──────────────────────────
  const handlePaymentConfirm = async () => {
    if (!paymentStageData) return;
    setPaymentConfirmLoading(true);

    const email = capadexRegEmail.trim() || regEmail.trim();

    // If no email yet — collect it first, then come back to payment
    if (!email) {
      setCapadexSkipIntent(true);
      setPaymentConfirmLoading(false);
      setPhase('capadex_register');
      return;
    }

    const name         = participantName.trim() || capadexReport?.participantName || '';
    const concernName  = capadexReport?.concernName || selectedConcern || '';

    try {
      // Create Razorpay order on the server
      const orderResp = await fetch('/api/capadex/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_code:       paymentStageData.code,
          session_id:       capadexSessionId,
          email,
          participant_name: name,
          concern_name:     concernName,
        }),
      });
      const orderData = await orderResp.json();
      if (!orderResp.ok) {
        setCapadexError(orderData.error || 'Could not create payment. Please try again.');
        setPaymentConfirmLoading(false);
        return;
      }

      // Demo mode (Razorpay not yet configured) — skip checkout, start stage directly
      if (!orderData.razorpay_configured) {
        setUnlockSubmitted(prev => new Set([...prev, paymentStageData.code]));
        await startNextStageAfterPayment(email);
        setPaymentConfirmLoading(false);
        return;
      }

      // Open Razorpay checkout
      const rzpOptions = {
        key:          orderData.razorpay_key_id,
        amount:       orderData.amount_paise,
        currency:     'INR',
        name:         'MetryxOne',
        description:  `${orderData.stage_name} Stage — ${concernName}`,
        order_id:     orderData.order_id,
        prefill: {
          name,
          email,
        },
        theme: { color: paymentStageData.color || '#344E86' },
        modal: { backdropclose: false },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Verify payment signature on backend
          try {
            const verifyResp = await fetch('/api/capadex/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                payment_id:          orderData.payment_id,
                email,
                participant_name:    name,
                concern_name:        concernName,
                stage_code:          paymentStageData.code,
              }),
            });
            const verifyData = await verifyResp.json();
            if (!verifyResp.ok || !verifyData.ok) {
              setCapadexError(verifyData.error || 'Payment verification failed. Please contact support.');
              setPaymentConfirmLoading(false);
              return;
            }
            setUnlockSubmitted(prev => new Set([...prev, paymentStageData.code]));
            await startNextStageAfterPayment(email);
          } catch (_) {
            setCapadexError('Payment verified but could not start stage. Please contact support.');
          } finally {
            setPaymentConfirmLoading(false);
          }
        },
      };

      const Razorpay = (window as unknown as { Razorpay: new (opts: unknown) => { open(): void } }).Razorpay;
      if (!Razorpay) {
        setCapadexError('Payment gateway failed to load. Please refresh and try again.');
        setPaymentConfirmLoading(false);
        return;
      }
      const rzp = new Razorpay(rzpOptions);
      rzp.open();
      // Loading spinner stays until handler() resolves or user closes modal
    } catch (err) {
      setCapadexError('Could not initiate payment. Please try again.');
      setPaymentConfirmLoading(false);
    }
  };

  const [capadexPdfLoading, setCapadexPdfLoading] = useState(false);
  const [capadexPdfBlobUrl, setCapadexPdfBlobUrl] = useState<string | null>(null);
  const [capadexPdfFilename, setCapadexPdfFilename] = useState<string>('');
  const [capadexPdfError, setCapadexPdfError] = useState<string | null>(null);
  const [capadexEmailSent, setCapadexEmailSent] = useState(false);
  const [capadexEmailLoading, setCapadexEmailLoading] = useState(false);
  const capadexReportRef = useRef<HTMLDivElement>(null);
  const actionPlanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setFamTermVisible(false);
      setTimeout(() => {
        setFamTermIdx(i => (i + 1) % FAM_TERMS.length);
        setFamTermVisible(true);
      }, 350);
    }, 2400);
    return () => clearInterval(iv);
  }, []);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const concernWrapRef = useRef<HTMLDivElement>(null);
  const heroAutoStartRef = useRef(false);

  useEffect(() => {
    if (initialPersona) setSelectedPersona(initialPersona);
  }, [initialPersona]);

  useEffect(() => {
    if (initialConcern && open) {
      setSelectedConcern(initialConcern);
      setConcernSearch(initialConcern);
      // Auto-trigger analysis — pass concern text directly, skipping age requirement
      // (age is collected later in capadex_preview before the assessment starts)
      setTimeout(() => handleAnalyseConcern(initialConcern), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConcern, open]);

  const [deepLinkLoading, setDeepLinkLoading] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  // Auto-load report when arriving via email deep-link (?session=<id>&tab=report)
  useEffect(() => {
    if (!initialSessionId || !open) return;
    let cancelled = false;
    setDeepLinkLoading(true);
    setDeepLinkError(null);
    const fetchDeepLinkReport = async () => {
      try {
        const resp = await fetch(`/api/capadex/report/${initialSessionId}`);
        if (cancelled) return;
        if (!resp.ok) {
          setDeepLinkLoading(false);
          setDeepLinkError('This report link has expired or is no longer available. You can start a new assessment below.');
          return;
        }
        const data = await resp.json();
        if (cancelled) return;
        setDeepLinkLoading(false);
        setCapadexSessionId(initialSessionId);
        setCapadexReport(data);
        setPhase('capadex_report');
        fetch(`/api/capadex/report/${initialSessionId}/omega`)
          .then(r => r.ok ? r.json() : null)
          .then(omega => { if (omega && !cancelled) setOmegaReport(omega); })
          .catch(() => {});
      } catch {
        if (!cancelled) {
          setDeepLinkLoading(false);
          setDeepLinkError('Could not load your report. Please check your connection and try again.');
        }
      }
    };
    fetchDeepLinkReport();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, open]);

  useEffect(() => {
    if (!open) return;
    if (initialName) setParticipantName(initialName);
    if (initialAge) setUserAge(initialAge);
    if (initialAssesseeType) {
      setAssesseeType(initialAssesseeType === 'someone-else' ? 'someone-else' : 'myself');
    }
    // Employer invite: pre-bind the candidate's email so the completed session
    // attaches back to their card (capadex_sessions.guest_email join). Set BOTH the
    // CAPADEX-flow email (capadexRegEmail — primary visible/binding field) and the
    // legacy regEmail so the session guest_email and the OTP/report email stay aligned.
    // The candidate still verifies via OTP, so they can change it — prefill is a convenience.
    if (initialEmail) { setRegEmail(initialEmail); setCapadexRegEmail(initialEmail); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialAge, initialAssesseeType, initialEmail]);

  // Auto-start assessment when arriving at capadex_preview with all hero data pre-filled
  useEffect(() => {
    if (phase !== 'capadex_preview') return;
    if (!initialName || !initialAge || heroAutoStartRef.current) return;
    const ageVal = parseInt(userAge, 10);
    const ageRange = getAgeRange(selectedPersona, assesseeType as 'myself' | 'my-child' | 'a-student' | 'someone-else' | '');
    const ageOk = userAge !== '' && !isNaN(ageVal) && ageVal >= ageRange.min && ageVal <= ageRange.max;
    const canBegin = !!assesseeType && !!participantName.trim() && ageOk;
    if (canBegin) {
      heroAutoStartRef.current = true;
      handleBeginAssessment();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, participantName, userAge, assesseeType, selectedPersona]);

  // ── Auto stage-check when entering preview with a known email ──────────
  // If the user already logged in earlier in this session, we know their
  // email and can silently check whether they have completed stages for
  // the current concern — no manual input needed at all.
  useEffect(() => {
    if (phase !== 'capadex_preview') return;
    if (capadexStageCheck !== null) return; // already have a result
    const knownEmail = capadexRegEmail.trim() || capadexUser?.email || '';
    if (!knownEmail || !selectedConcern) return;
    handleStageCheck(knownEmail);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, capadexRegEmail, capadexUser, selectedConcern]);

  // ── Auto-load recent sessions when the report phase is active ────────
  // So "My Reports" switcher populates automatically without extra steps.
  useEffect(() => {
    if (phase !== 'capadex_report') return;
    if (recentSessions.length > 0) return; // already loaded
    const email = capadexUser?.email || capadexRegEmail.trim();
    if (!email) return;
    handleLoadRecentSessions({ email });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, capadexUser, capadexRegEmail]);

  // ── Refresh stage-check after completing a stage ──────────────────────
  // When entering the result phase the previous stage-check is stale (it was
  // fetched before the just-completed session existed). Re-fetch so the banner
  // reflects the NEW completion state (e.g. after Insight → next is Growth).
  useEffect(() => {
    if (phase !== 'capadex_result') return;
    const knownEmail = capadexRegEmail.trim() || capadexUser?.email || '';
    if (!knownEmail || !selectedConcern) return;
    handleStageCheck(knownEmail);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    // Only reset concern when persona changes from the intro screen.
    // During the active capadex flow (analyze/clarify/preview/q) persona may be
    // set from the API response — we must NOT wipe the concern at that point.
    if (phase !== 'intro') return;
    setSelectedConcern(null);
    setConcernSearch('');
    setConcernSuggestions([]);
    setConcernPersonaFallback(false);
    setShowConcernSugg(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona]);

  // Persona-aware assessee options helper
  const getAssesseeOptions = (persona: string | null): Array<{ key: 'myself' | 'my-child' | 'a-student' | 'someone-else'; label: string }> => {
    if (persona === 'parent')       return [{ key: 'my-child', label: 'My Child' }, { key: 'myself', label: 'Myself' }, { key: 'someone-else', label: 'Someone Else' }];
    if (persona === 'teacher')      return [{ key: 'a-student', label: 'A Student' }, { key: 'myself', label: 'Myself' }, { key: 'someone-else', label: 'Someone Else' }];
    if (persona === 'student')      return [{ key: 'myself', label: 'Myself' }, { key: 'someone-else', label: 'Someone Else' }];
    if (persona === 'professional') return [{ key: 'myself', label: 'Myself' }, { key: 'someone-else', label: 'Someone Else' }];
    if (persona === 'campus')       return [{ key: 'myself', label: 'Myself' }, { key: 'someone-else', label: 'Someone Else' }];
    if (persona === 'jobseeker')    return [{ key: 'myself', label: 'Myself' }, { key: 'someone-else', label: 'Someone Else' }];
    // default (unknown / null) — show all four
    return [
      { key: 'myself', label: 'Myself' },
      { key: 'my-child', label: 'My Child' },
      { key: 'a-student', label: 'A Student' },
      { key: 'someone-else', label: 'Someone Else' },
    ];
  };

  // Auto-select assesseeType as soon as persona is chosen — no need to wait for preview
  useEffect(() => {
    const validOptions = getAssesseeOptions(selectedPersona).map(o => o.key);
    const currentIsValid = assesseeType && validOptions.includes(assesseeType as typeof validOptions[number]);
    if (!currentIsValid) {
      if (selectedPersona === 'parent') setAssesseeType('my-child');
      else if (selectedPersona === 'teacher') setAssesseeType('a-student');
      else setAssesseeType('myself');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona]);

  // Debounced live search for concern areas — filtered by persona + age
  useEffect(() => {
    if (concernSearch.length < 1) {
      setConcernSuggestions([]);
      setConcernPersonaFallback(false);
      setShowConcernSugg(false);
      return;
    }
    setConcernLoading(true);
    const t = setTimeout(async () => {
      try {
        const personaParam = selectedPersona ? `&persona=${encodeURIComponent(selectedPersona)}` : '';
        // 2026-05-28 — sub-persona drives the hybrid persona filter on the
        // master search (PERSONA_AFFINITY map in short-assessments.ts).
        // Backend re-runs without the filter on zero rows and sets
        // `personaFallback=true` in the response.
        const subPersonaParam = primaryPersona ? `&subPersona=${encodeURIComponent(primaryPersona)}` : '';
        const ageParam = userAge ? `&age=${encodeURIComponent(userAge)}` : '';
        // ── Keyword extraction ───────────────────────────────────────────
        // Users type natural sentences ("Curious about my career starting")
        // but the backend scores on substring + construct hits. Strip common
        // English + first-person stop-words so meaningful nouns survive.
        // Fallback to raw query if extraction empties the input.
        const STOPWORDS = new Set([
          'i','im','am','my','me','mine','myself','we','our','you','your','their',
          'a','an','the','this','that','these','those','it','its',
          'is','are','was','were','be','being','been','do','does','did',
          'have','has','had','will','would','could','should','can','may','might',
          'and','or','but','so','if','then','than','as','of','to','for','from','with',
          'about','on','in','at','by','into','over','under','out','up','down',
          'feel','feeling','feels','felt','want','wanting','need','needing','needs',
          'curious','wondering','thinking','trying','starting','beginning','start',
          'really','very','quite','just','also','maybe','perhaps','please','kind','sort',
        ]);
        const extracted = concernSearch.toLowerCase()
          .replace(/[^a-z0-9\s/-]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 1 && !STOPWORDS.has(w))
          .join(' ').trim();
        const qToSend = extracted.length >= 2 ? extracted : concernSearch;
        const r = await fetch(`/api/concerns/search?q=${encodeURIComponent(qToSend)}${personaParam}${subPersonaParam}${ageParam}`);
        const data = await r.json();
        let suggestions = (data.concerns || []).slice(0, 8);
        // Aggregate persona-fallback flag across the primary + secondary
        // keyword retries below — if ANY hop fell back, we surface the note.
        let aggregatedFallback = !!data.personaFallback;
        // Secondary fallback: if extraction returned 0 hits but raw query has
        // meaningful keywords, retry with each top keyword individually.
        if (suggestions.length === 0 && extracted.length > 0) {
          const keywords = extracted.split(' ').filter(Boolean).slice(0, 3);
          for (const kw of keywords) {
            if (suggestions.length >= 4) break;
            const r2 = await fetch(`/api/concerns/search?q=${encodeURIComponent(kw)}${personaParam}${subPersonaParam}${ageParam}`);
            const d2 = await r2.json();
            if (d2.personaFallback) aggregatedFallback = true;
            const seen = new Set(suggestions.map((s: any) => s.id));
            for (const c of (d2.concerns || [])) {
              if (!seen.has(c.id)) { suggestions.push(c); seen.add(c.id); }
              if (suggestions.length >= 8) break;
            }
          }
        }
        setConcernSuggestions(suggestions);
        setConcernPersonaFallback(aggregatedFallback);
        setShowConcernSugg(true);
      } catch {
        setConcernSuggestions([]);
        setConcernPersonaFallback(false);
      } finally {
        setConcernLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
    // 2026-05-28 — `primaryPersona` must be a dep so switching between sub-
    // personas that share a legacy persona (e.g. competitive_aspirant ↔
    // skill_development_learner both map to 'student') still refetches with
    // the new persona filter.
  }, [concernSearch, selectedPersona, primaryPersona, userAge]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (concernWrapRef.current && !concernWrapRef.current.contains(e.target as Node)) {
        setShowConcernSugg(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const id = setTimeout(() => setOtpResendTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [otpResendTimer]);

  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  // Re-check for incomplete session any time email verification is confirmed
  // (covers page-refresh / dismissed-banner scenarios where the OTP verify
  //  already ran but incompleteSession state was lost)
  // Also loads completed reports so the user can jump straight to them.
  useEffect(() => {
    if (!introEmailVerified || !capadexRegEmail.trim()) return;
    const email = capadexRegEmail.trim();
    if (!incompleteSession) {
      fetch(`/api/capadex/auth/incomplete-session?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .catch(() => ({}))
        .then(d => {
          if (d.has_incomplete && d.session) setIncompleteSession(d.session);
        });
    }
    handleLoadRecentSessions({ email });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introEmailVerified]);

  const safeTimeout = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setSelectedPersona(initialPersona || null);
    setSelectedConcern(null);
    setCurrentQ(0);
    setAnswers({});
    setPhase("intro");
    setParticipantName("");
    setContextField("");
    setAssesseeType('');
    setRequesterName('');
    setReportTab("results");
    setRegName("");
    setRegEmail("");
    setRegPhone("");
    setRegLoading(false);
    setOtpDigits(['','','','','','']);
    setOtpLoading(false);
    setOtpError(null);
    setOtpResendTimer(0);
    setSelectedTier(null);
    setUpgradeGoal('');
    setUpgradeUrgency('');
    setEmailExistsName(null);
    setSelectedConcerns([]);
    setConcernSearch('');
    setConcernSuggestions([]);
    setConcernPersonaFallback(false);
    setShowConcernSugg(false);
    setIncompleteSession(null);
    setUserAge('');
    setParticipantGender('');
    setParticipantCity('');
    setParticipantGoal('');
    setGoalTimeline('');
    // 2026-05-28 lifted intro state — must reset on close/reopen so prior
    // selection doesn't leak into a fresh session.
    setPrimaryPersona(null);
    setConcernMetaMap({});
    setIsProxy(false);
    setAgeBand('');
    setCapadexSessionId(null);
    setCapadexStage('CAP_CUR');
    setCapadexStageIndex(0);
    setCapadexStageColor('#3B82F6');
    setCapadexItems([]);
    setCapadexAnswers({});
    capadexBacktrackRef.current = {}; // reset per-session telemetry counters
    setCapadexCurrentQ(0);
    setCapadexStageResult(null);
    setCapadexProgress([]);
    setCapadexLoading(false);
    setCapadexError(null);
    setConcernIntelligence(null);
    // Clear orchestration context so a fresh assessment never inherits the
    // prior run's actor/target persona (architect-flagged stale-state bug).
    setRuntimeContext(null);
    setAnalyzeStep(0);
    heroAutoStartRef.current = false;
    setClarifyAnswers({});
    setClarifyCurrentQ(0);
    setAdaptiveMode(false);
    adaptiveFullBatchRef.current = [];
    adaptivePayloadRef.current = null;
    setRieRecommendations([]);
    setRieHasEscalation(false);
    setCapadexReturnEmail('');
    setCapadexStageCheck(null);
    setCapadexStageCheckLoading(false);
    setCapadexSkipIntent(false);
    // CAPADEX register / OTP state
    setCapadexRegEmail('');
    setCapadexRegError(null);
    setCapadexLoginMode(false);
    setCapadexLoginOtpSent(false);
    setCapadexLoginOtpError(null);
    setCapadexExistingName('');
    setCapadexOtpDigits(['','','','','','']);
    setCapadexOtpError(null);
    setCapadexOtpTimer(0);
    setRetrieveReportMode(false);
    setRecentSessions([]);
    setCapadexUser(null);
    setCapadexPdfLoading(false);
    setCapadexEmailSent(false);
    // Intro-phase email/OTP state
    setIntroEmailStatus('idle');
    setIntroEmailName('');
    setIntroEmailVerified(false);
    setIntroOtpSent(false);
    setIntroOtpDigits(['', '', '', '', '', '']);
    setIntroOtpError(null);
    setIntroOtpTimer(0);
    setReturningIntent(null);
  }, [initialPersona]);

  const handleAnalyseConcern = async (concernTextOverride?: string) => {
    const concernText = concernTextOverride ?? selectedConcern;
    if (!concernText) return;
    // Age is validated when provided but no longer hard-blocks the flow —
    // the session start endpoint accepts an empty/null age gracefully.
    if (!concernTextOverride && userAge) {
      const age = parseInt(userAge, 10);
      const ageRng = getAgeRange(selectedPersona, selectedPersona === 'parent' ? 'my-child' : 'myself');
      if (isNaN(age) || age < ageRng.min || age > ageRng.max) {
        setCapadexError(ageRng.label);
        return;
      }
    }
    setSelectedConcern(concernText);
    setAnalyzeStep(0);
    setClarifyAnswers({});
    setClarifyCurrentQ(0);
    setAdaptiveMode(false);
    adaptiveFullBatchRef.current = [];
    adaptivePayloadRef.current = null;
    setConcernIntelligence(null);
    setCapadexError(null);
    // User is deliberately starting a new assessment — clear any stored deep-link session
    onNewAssessmentStarted?.();
    setPhase('capadex_analyze');
    // Clear any prior orchestration context before re-deriving — guards
    // against stale state leaking into allPhaseProps if analyze fails or the
    // server omits runtime_context on retry.
    setRuntimeContext(null);
    // Build additional concerns list (excluding primary)
    const additionalConcerns = selectedConcerns.filter(c => c !== concernText);
    // Clarity-question history for this session. `/analyze` returns a batch per
    // concern, so de-duplication is across analyze calls (re-runs / multiple
    // concerns), not per-question. Persisted in sessionStorage so it survives
    // modal remounts and clears on tab close. Sent as `answeredIds`; backend
    // excludes these ids then shuffles the remaining pool.
    let seenClarityIds: string[] = [];
    try {
      const stored = JSON.parse(sessionStorage.getItem(SEEN_CLARITY_KEY) || '[]');
      if (Array.isArray(stored)) seenClarityIds = stored.filter((x): x is string => typeof x === 'string');
    } catch { seenClarityIds = []; }
    try {
      const analyzeBody: Record<string, unknown> = {
          // ── Legacy keys (kept for downstream phases + back-compat) ──
          concern_text: concernText,
          persona: selectedPersona,
          age: userAge ? parseInt(userAge, 10) : undefined,
          additional_concerns: additionalConcerns.length > 0 ? additionalConcerns : undefined,
          assessee_type: assesseeType || undefined,
          actor_persona:
            selectedPersona === 'parent' ? 'PARENT'
            : selectedPersona === 'teacher' ? 'TEACHER'
            : 'self',
          target_persona:
            selectedPersona === 'parent' || selectedPersona === 'teacher' ? 'STUDENT' : 'self',
          relationship_type:
            selectedPersona === 'parent' ? 'parent_child'
            : selectedPersona === 'teacher' ? 'teacher_student'
            : 'direct',
          session_id: capadexSessionId || undefined,
          // ── 2026-05-28 macro-track envelope (spec-canonical fields) ──
          // The new IntroPhase ships the granular sub-persona token + is_proxy
          // flag + age band; backend re-derives runtime_context from these.
          primary_persona:    primaryPersona || undefined,        // 'competitive_aspirant' | 'parent' | 'mid_career_professional' …
          is_proxy:           primaryPersona ? isProxy : undefined,
          target_age_band:    ageBand || undefined,               // '6-14' | '14-17' | '17-24' | '24-45' | '45+'
          assessee_name:      participantName?.trim() || undefined,
          contextual_anchor:  contextField?.trim() || undefined,  // institution / domain
          // 2026-05-29 additive enrichment — optional demographic + goal context.
          participant_gender: participantGender || undefined,
          participant_city:   participantCity?.trim() || undefined,
          goal_text:          participantGoal?.trim() || undefined,
          goal_timeline:      goalTimeline || undefined,
          raw_concern_text:   concernText || undefined,
          // Canonical master-table identifiers for the primary concern when the
          // user tapped a suggestion chip (vs. typing free text). Powers exact
          // routing in `resolveCapadexConcern()` instead of keyword fallback.
          concern_id:         concernMetaMap[concernText]?.concern_id || undefined,
          domain_name:        concernMetaMap[concernText]?.domain || undefined,
          concern_cluster:    concernMetaMap[concernText]?.concern_cluster || undefined,
          typical_age_band:   concernMetaMap[concernText]?.typical_age_band || undefined,
          // Clarity ids already shown this session — backend excludes them so
          // re-runs/other concerns don't repeat the same questions.
          answeredIds:        seenClarityIds.length > 0 ? seenClarityIds : undefined,
      };
      const resp = await fetch('/api/capadex/concern/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyzeBody),
      });
      const data = await resp.json();
      // Stash the resolved canonical id so /adaptive-next routes to the SAME
      // clarity pool the analyze batch came from.
      adaptivePayloadRef.current = { ...analyzeBody, concern_id: data.resolved_concern_id ?? analyzeBody.concern_id };
      // Record the batch we're about to show so the next analyze excludes them.
      try {
        const returnedIds = (data.clarification_questions || [])
          .map((q: { id?: string }) => q?.id)
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
        if (returnedIds.length > 0) {
          const merged = Array.from(new Set([...seenClarityIds, ...returnedIds])).slice(-200);
          sessionStorage.setItem(SEEN_CLARITY_KEY, JSON.stringify(merged));
        }
      } catch { /* sessionStorage unavailable — variety degrades gracefully */ }
      // Capture orchestration context envelope so all downstream phases can
      // read formal actor/target persona + relationship from a single source
      // (instead of re-deriving from selectedPersona+assesseeType themselves).
      if (data.runtime_context) {
        setRuntimeContext(data.runtime_context);
      }
      if (!selectedPersona && data.persona_detected) {
        setSelectedPersona(data.persona_detected as PersonaKey);
      }
      // ── Arm Adaptive Questioning ───────────────────────────────────────────
      // Only when the backend flag is ON, there's a batch to fall back on, and
      // there are no prefilled answers (prefill keeps the deterministic batch
      // flow). In adaptive mode we show ONLY the opener and let `/adaptive-next`
      // drive every subsequent question; the full batch is retained in a ref as
      // the graceful-degradation fallback.
      const batch: Array<{ id: string; question: string; options: string[]; response_type?: string }> =
        Array.isArray(data.clarification_questions) ? data.clarification_questions : [];
      const hasPrefill = data.prefilled_answers && Object.keys(data.prefilled_answers).length > 0;
      adaptiveFullBatchRef.current = batch;
      if (data.adaptive_enabled && batch.length > 0 && !hasPrefill) {
        setAdaptiveMode(true);
        setClarifyAnswers({});
        setClarifyCurrentQ(0);
        setConcernIntelligence({ ...data, clarification_questions: [batch[0]] });
      } else {
        setAdaptiveMode(false);
        setConcernIntelligence(data);
      }
      // Pre-fill answers inferred from persona + age and find first unanswered question
      const prefilled: Record<number, string> = data.prefilled_answers || {};
      if (Object.keys(prefilled).length > 0) {
        setClarifyAnswers(prefilled);
        const totalQs = (data.clarification_questions || []).length;
        let firstUnanswered = totalQs;
        for (let i = 0; i < totalQs; i++) {
          if (!(i in prefilled)) { firstUnanswered = i; break; }
        }
        setClarifyCurrentQ(firstUnanswered < totalQs ? firstUnanswered : 0);
        // All questions pre-filled — skip clarify, go straight to assessment
        if (firstUnanswered >= totalQs) {
          safeTimeout(() => handleBeginAssessment(), 350);
          return;
        }
      }
      // Has clarification questions — brief fade then show them
      safeTimeout(() => setPhase('capadex_clarify'), 350);
    } catch {
      setCapadexError('Could not analyse concern. Please try again.');
      setPhase('intro');
    }
  };

  const handleClarifyBack = () => {
    const questions = concernIntelligence?.clarification_questions || [];
    const prefilled = concernIntelligence?.prefilled_answers || {};
    const visibleIndices = questions.map((_, i) => i).filter(i => !(i in prefilled));
    const currentVisiblePos = visibleIndices.indexOf(clarifyCurrentQ);
    if (currentVisiblePos <= 0) {
      setPhase('intro');
    } else {
      const prevQ = visibleIndices[currentVisiblePos - 1];
      setClarifyCurrentQ(prevQ);
      setClarifyAnswers(prev => { const next = { ...prev }; delete next[prevQ]; return next; });
    }
  };

  // Distress proxy for an answered clarity question: the index of the chosen
  // (top-ranked) option normalised to 0..1, where the LAST option = max
  // intensity. This is valid because the backend trait-inference only attributes
  // an answer to a trait when the STEM carries distress keywords, and those
  // stems use ascending-intensity option scales. Unknown/odd shapes → neutral.
  const deriveAdaptiveValue = (
    q: { options?: string[] } | undefined,
    ranked: string[] | undefined,
  ): number => {
    const opts = q?.options;
    if (!Array.isArray(opts) || opts.length < 2 || !ranked || ranked.length === 0) return 0.5;
    const idx = opts.indexOf(ranked[0]);
    if (idx < 0) return 0.5;
    return idx / (opts.length - 1);
  };

  // Adaptive clarify driver — only runs when `adaptiveMode` is armed. Calls
  // `/adaptive-next` with the answers so far and appends the next best question.
  // Every failure mode (flag off, network error, duplicate/empty pick, cap hit)
  // degrades gracefully to the next unshown batch question or finishes.
  const advanceAdaptive = async (
    questions: Array<{ id: string; question: string; options: string[]; response_type?: string }>,
    answers: Record<number, string[]>,
  ) => {
    const shownIds = new Set(questions.map(q => q?.id).filter((id): id is string => typeof id === 'string' && id.length > 0));
    const priorAnswers = questions
      .map((q, i) => {
        const ranked = answers[i];
        if (!q?.id || !ranked || ranked.length === 0) return null;
        return {
          id: q.id,
          question: q.question,
          response_value: deriveAdaptiveValue(q, ranked),
          response_label: ranked[0],
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const finish = () => safeTimeout(() => setPhase('capadex_bridge'), 300);
    const appendAndAdvance = (nextQ: { id: string; question: string; options: string[]; response_type?: string }) => {
      const newIndex = questions.length;
      setConcernIntelligence(prev =>
        prev ? { ...prev, clarification_questions: [...(prev.clarification_questions || []), nextQ] } : prev,
      );
      safeTimeout(() => setClarifyCurrentQ(newIndex), 280);
    };
    const fallbackBatch = () => {
      const next = adaptiveFullBatchRef.current.find(q => q?.id && !shownIds.has(q.id));
      if (next) appendAndAdvance(next); else finish();
    };

    if (questions.length >= ADAPTIVE_MAX_QUESTIONS) { finish(); return; }
    const payload = adaptivePayloadRef.current;
    if (!payload) { fallbackBatch(); return; }

    try {
      const resp = await fetch('/api/capadex/concern/adaptive-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          prior_answers: priorAnswers,
          answeredIds: Array.from(new Set([
            ...(Array.isArray(payload.answeredIds) ? (payload.answeredIds as string[]) : []),
            ...shownIds,
          ])),
        }),
      });
      if (!resp.ok) { fallbackBatch(); return; }
      const data = await resp.json();
      if (!data || data.enabled === false) { fallbackBatch(); return; }
      if (data.done === true) { finish(); return; }
      const nq = data.next_question;
      if (!nq || typeof nq.id !== 'string' || shownIds.has(nq.id) || !Array.isArray(nq.options)) {
        fallbackBatch();
        return;
      }
      appendAndAdvance(nq);
    } catch {
      fallbackBatch();
    }
  };

  const handleClarifyAnswer = (rankedOptions: string[]) => {
    const newAnswers = { ...clarifyAnswers, [clarifyCurrentQ]: rankedOptions };
    setClarifyAnswers(newAnswers);
    const questions = concernIntelligence?.clarification_questions || [];
    if (adaptiveMode) {
      void advanceAdaptive(questions, newAnswers);
      return;
    }
    const prefilled = concernIntelligence?.prefilled_answers || {};
    const visibleIndices = questions.map((_, i) => i).filter(i => !(i in prefilled));
    const currentVisiblePos = visibleIndices.indexOf(clarifyCurrentQ);
    const nextVisibleIdx = visibleIndices[currentVisiblePos + 1];
    if (nextVisibleIdx !== undefined) {
      safeTimeout(() => setClarifyCurrentQ(nextVisibleIdx), 280);
    } else {
      // Done — show personal bridge screen before starting assessment
      safeTimeout(() => setPhase('capadex_bridge'), 300);
    }
  };


  const handleBeginAssessment = async () => {
    if (!selectedConcern) return;
    // Age and assesseeType are optional — sensible defaults applied below
    const effectiveAssesseeType = assesseeType || 'myself';
    const effectiveParticipantName = participantName.trim() || '';
    const age = userAge ? parseInt(userAge, 10) : null;
    if (age !== null) {
      const ageRange = getAgeRange(selectedPersona, effectiveAssesseeType);
      if (isNaN(age) || age < ageRange.min || age > ageRange.max) {
        setCapadexError(ageRange.label);
        return;
      }
    }

    setCapadexLoading(true);
    setCapadexError(null);

    // ── Guard: use the cached stage-check result (populated by the blur
    // handler in the preview email field).  If the user is a returning user
    // for this concern, skip straight to login without starting a new session.
    if (capadexStageCheck?.has_prior_completion) {
      setCapadexLoading(false);
      setCapadexSkipIntent(true);
      setCapadexLoginMode(true);
      setPhase('capadex_register');
      return;
    }

    const typedEmail = capadexRegEmail.trim();
    try {
      const additionalConcernsForSession = selectedConcerns.filter(c => c !== selectedConcern);
      const resp = await fetch('/api/capadex/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern_name: selectedConcern,
          user_age: age,
          persona: selectedPersona || null,
          guest_email: typedEmail || regEmail.trim() || null,
          guest_name: effectiveParticipantName || null,
          additional_concerns: additionalConcernsForSession.length > 0 ? additionalConcernsForSession : undefined,
          construct_key: concernIntelligence?.construct_key || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.session_id) {
        setCapadexError(data.error || 'Could not start assessment. Please try again.');
        return;
      }
      setCapadexSessionId(data.session_id);
      setCapadexStage(data.stage_code);
      setCapadexStageIndex(data.stage_index);
      setCapadexStageColor(data.stage_color || '#3B82F6');
      setCapadexItems(data.questions || []);
      setCapadexProgress(data.progress || []);
      setCapadexAnswers({});
      capadexBacktrackRef.current = {}; // reset per-session telemetry counters
      setCapadexCurrentQ(0);
      // Save draft to localStorage for resume on next open
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          concern: selectedConcern,
          selectedConcerns,
          phase: 'capadex_q',
          session_id: data.session_id,
          email: typedEmail || regEmail.trim() || '',
          timestamp: Date.now(),
        }));
      } catch { /* ignore localStorage errors */ }
      setPhase(getProfilePhase(data.stage_code));
    } catch (err) {
      setCapadexError('Network error — please check your connection and try again.');
    } finally {
      setCapadexLoading(false);
    }
  };

  const handleCapadexAnswer = (itemId: string, value: number) => {
    const responseTimeMs = Date.now() - questionShownAtRef.current;
    const alreadyAnswered = capadexAnswers[itemId] != null;
    setQuestionTimings(prev => ({
      ...prev,
      [itemId]: { response_time_ms: responseTimeMs, answer_changed: alreadyAnswered, response_value: value },
    }));
    const newAnswers = { ...capadexAnswers, [itemId]: value };
    setCapadexAnswers(newAnswers);

    // ── Telemetry fire-and-forget ────────────────────────────────────────────
    // Cumulative backtrack count = number of times the user has changed their
    // answer for THIS question. First selection = 0; every subsequent change
    // increments. We post the running total so the server-side upsert always
    // reflects the latest snapshot (ON CONFLICT DO UPDATE on cumulative cols).
    // hesitation_ms is the elapsed time since the question was shown — server
    // takes GREATEST() across re-sends so the longest pause wins.
    //
    // Never awaited. .catch silences network errors so a telemetry blip can't
    // freeze the assessment UI (and we don't want to surface them to the user).
    if (alreadyAnswered) {
      capadexBacktrackRef.current[itemId] = (capadexBacktrackRef.current[itemId] || 0) + 1;
    } else if (capadexBacktrackRef.current[itemId] == null) {
      capadexBacktrackRef.current[itemId] = 0;
    }
    if (capadexSessionId) {
      fetch('/api/signals/telemetry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true, // survives navigation away from the modal mid-fire
        body: JSON.stringify({
          session_id:      capadexSessionId,
          question_id:     String(itemId),
          hesitation_ms:   responseTimeMs,
          backtrack_count: capadexBacktrackRef.current[itemId] || 0,
          text_edit_count: 0, // choice-only UI; reserved for future freeform items
        }),
      }).catch(() => { /* swallowed — never block the user */ });
    }
    if (capadexCurrentQ < capadexItems.length - 1) {
      // Not the last question — advance after brief delay and reset timer
      safeTimeout(() => {
        setCapadexCurrentQ(q => q + 1);
        questionShownAtRef.current = Date.now();
      }, 220);
    } else {
      // On the last question — always auto-submit regardless of total answered count
      safeTimeout(() => doCompleteStage(newAnswers), 420);
    }
  };

  const doCompleteStage = async (answersSnapshot: Record<string, number>) => {
    if (!capadexSessionId) return;
    setCapadexLoading(true);
    // Snapshot timings before state resets, then clear the live buffer
    // IMMEDIATELY. The snapshot preserves this stage's data for the awaited
    // ingest below; clearing now (rather than after the await) prevents a late
    // ingest resolution from wiping timings the user has already started
    // collecting for the next stage (questionTimings is global, not scoped).
    const timingsSnapshot = { ...questionTimings };
    setQuestionTimings({});
    try {
      const responses = Object.entries(answersSnapshot).map(([item_id, response_value]) => ({ item_id, response_value }));
      // ── Module 2 — Safety Circuit Breaker check on /respond ──────────────
      // The server may return a safety_intercept envelope INSTEAD of the standard
      // {ok, answered} shape when Channel A (text-based crisis language) or
      // Channel B (telemetry-derived crisis_risk / emotional_breakdown_risk >= 0.80)
      // trips. We must break out of the questionnaire loop before calling /complete
      // and mount the relief overlay so the user is routed to counsellor support
      // rather than shown a normal report on a terminated session.
      const respondRes = await fetch(`/api/capadex/session/${capadexSessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      let respondJson: any = null;
      try { respondJson = await respondRes.json(); } catch { /* tolerate empty body */ }
      if (respondJson && respondJson.safety_intercept === true) {
        setSafetyIntercept({
          message:     respondJson?.support_resources?.message     || 'Your well-being is our priority. Please pause and reach out for support.',
          action_type: respondJson?.support_resources?.action_type || 'counsellor_routing',
        });
        setPhase('capadex_relief');
        setCapadexLoading(false);
        return; // Halt — do not advance to /complete or report.
      }
      const resp = await fetch(`/api/capadex/session/${capadexSessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await resp.json();
      setCapadexStageResult(result);
      setCapadexProgress(result.progress || capadexProgress);
      setPhase('capadex_result');

      // Persist behavioural signals BEFORE the report is read. The BIOS report
      // synthesis reads capadex_signal_profiles at report time, so the ingest
      // must complete before the silent pre-fetch below — otherwise behavioural
      // signals are missing on the first report load for already-authed users.
      // Awaited but fully guarded: the user is already on the result screen, so
      // this adds no perceived latency, and a telemetry failure must never brick
      // the journey (we log a warning and proceed regardless).
      try {
        const ingestRes = await fetch('/api/signals/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: capadexSessionId,
            concern_text: selectedConcern,
            timings: timingsSnapshot,
            stage_code: result.stage_code,
            persona: selectedPersona,
          }),
        });
        if (!ingestRes.ok) {
          console.warn('[capadex] signal ingest rejected (non-blocking):', ingestRes.status);
        }
      } catch (ingestErr) {
        console.warn('[capadex] signal ingest failed (non-blocking):', ingestErr);
      }

      // If the user is already authenticated (verified OTP in intro or a prior stage),
      // silently pre-fetch the report so the register gate is never shown.
      const authedEmail = capadexUser?.email || capadexRegEmail.trim();
      if (authedEmail && capadexSessionId) {
        fetch(`/api/capadex/report/${capadexSessionId}?email=${encodeURIComponent(authedEmail)}`)
          .then(r => r.ok ? r.json() : null)
          .then(rData => { if (rData) setCapadexReport(rData); })
          .catch(() => {});
      }
    } catch (err) {
      console.error('CAPADEX complete error:', err);
    } finally {
      setCapadexLoading(false);
    }
  };

  const handleCompleteStage = async () => doCompleteStage(capadexAnswers);

  const handleContinueToNextStage = async () => {
    if (!capadexStageResult?.next_stage) {
      setPhase('capadex_register');
      return;
    }
    const age = parseInt(userAge, 10);
    const resolvedConcernName = capadexStageResult?.concern_name || capadexReport?.concernName || selectedConcern;
    setCapadexLoading(true);
    try {
      const resp = await fetch('/api/capadex/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern_name: resolvedConcernName,
          user_age: age,
          persona: selectedPersona || null,
          guest_email: capadexRegEmail.trim() || regEmail.trim() || null,
          guest_name: participantName.trim() || null,
          construct_key: concernIntelligence?.construct_key || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.session_id) return;
      setCapadexSessionId(data.session_id);
      setCapadexStage(data.stage_code);
      setCapadexStageIndex(data.stage_index);
      setCapadexStageColor(data.stage_color || '#3B82F6');
      setCapadexItems(data.questions || []);
      setCapadexProgress(data.progress || []);
      setCapadexAnswers({});
      capadexBacktrackRef.current = {}; // reset per-session telemetry counters
      setCapadexCurrentQ(0);
      setCapadexStageResult(null);
      setPhase(getProfilePhase(data.stage_code));
    } catch (err) {
      console.error('CAPADEX next stage error:', err);
    } finally {
      setCapadexLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    safeTimeout(reset, 300);
  };

  const questions = (() => {
    if (!selectedPersona) return QUESTION_BANKS.student;
    if (selectedConcern && CONCERN_QUESTIONS[selectedPersona]?.[selectedConcern]) {
      return CONCERN_QUESTIONS[selectedPersona][selectedConcern];
    }
    return QUESTION_BANKS[selectedPersona];
  })();
  const persona = selectedPersona ? PERSONAS.find(p => p.key === selectedPersona)! : PERSONAS[0];

  const handleAnswer = (value: number) => {
    const newAnswers = { ...answers, [questions[currentQ].id]: value };
    setAnswers(newAnswers);
    if (currentQ < questions.length - 1) {
      safeTimeout(() => setCurrentQ(currentQ + 1), 250);
    } else {
      setPhase("analyzing");
      safeTimeout(() => setPhase("register"), 2500);
    }
  };

  const sendOtpToEmail = async (force = false) => {
    setRegLoading(true);
    setEmailExistsName(null);
    try {
      const resp = await fetch('/api/auth/assessment-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim(), force }),
      });
      if (resp.status === 409) {
        const data = await resp.json().catch(() => ({}));
        if (data.error === 'EMAIL_EXISTS') {
          setEmailExistsName(data.firstName ?? '');
          return;
        }
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to send code');
      }
      setOtpDigits(['','','','','','']);
      setOtpError(null);
      setOtpResendTimer(60);
      setPhase("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send verification code';
      setOtpError(msg);
    } finally {
      setRegLoading(false);
    }
  };

  const handleRegisterSubmit = () => sendOtpToEmail(false);

  const handleOtpVerify = async () => {
    const code = otpDigits.join('');
    if (code.length < 6) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const resp = await fetch('/api/auth/assessment-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim(), otp: code }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error ?? 'Invalid code');
      notificationService.fireTestSubmitted('Free Behavioral Assessment');
      notificationService.fireReportPublished('LBI Behavioural', 'Free Behavioral Assessment');
      setPhase("report");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    setOtpError(null);
    try {
      const resp = await fetch('/api/auth/assessment-otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim() }),
      });
      if (!resp.ok) throw new Error('Resend failed');
      setOtpDigits(['','','','','','']);
      setOtpResendTimer(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch {
      setOtpError('Could not resend code. Please try again.');
    }
  };

  // ── CAPADEX OTP timer countdown ───────────────────────────────────────
  useEffect(() => {
    if (capadexOtpTimer <= 0) return;
    const t = setTimeout(() => setCapadexOtpTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [capadexOtpTimer]);

  // ── Intro OTP timer countdown ─────────────────────────────────────────
  useEffect(() => {
    if (introOtpTimer <= 0) return;
    const t = setTimeout(() => setIntroOtpTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [introOtpTimer]);

  // ── CAPADEX: stage-check for returning users ─────────────────────────
  // Checks whether the user has already completed any stage for the current
  // concern so the frontend can offer to skip directly to the next stage.
  const handleStageCheck = async (emailInput: string) => {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput.trim() || !emailRx.test(emailInput.trim()) || !selectedConcern) return;
    setCapadexStageCheckLoading(true);
    setCapadexStageCheck(null);
    try {
      const resp = await fetch(
        `/api/capadex/stage-check?email=${encodeURIComponent(emailInput.trim())}&concern=${encodeURIComponent(selectedConcern)}&persona=${encodeURIComponent(selectedPersona || '')}`
      );
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) setCapadexStageCheck(data);
    } catch { /* silent */ } finally {
      setCapadexStageCheckLoading(false);
    }
  };

  // ── CAPADEX: skip-to-next-stage after successful OTP login ────────────
  // Called after OTP verification when capadexSkipIntent is true.
  // Starts a fresh session for the correct next stage (backend auto-advances
  // based on completed stages for that email+concern), then goes to capadex_q.
  const handleSkipToNextStage = async (user: { email: string }) => {
    const age = parseInt(userAge, 10) || 18;
    // Use the stored/resolved concern name so the backend stage-advance query
    // correctly finds completed sessions regardless of keyword-resolution differences.
    const resolvedConcernName = capadexStageResult?.concern_name || capadexReport?.concernName || selectedConcern;
    setCapadexRegLoading(true);
    try {
      const resp = await fetch('/api/capadex/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concern_name: resolvedConcernName,
          user_age: age,
          persona: selectedPersona || null,
          guest_email: user.email,
          guest_name: participantName.trim() || null,
          construct_key: concernIntelligence?.construct_key || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.session_id) {
        setCapadexOtpError(data.error || 'Could not start the next stage. Please try again.');
        return;
      }
      setCapadexSessionId(data.session_id);
      setCapadexStage(data.stage_code);
      setCapadexStageIndex(data.stage_index);
      setCapadexStageColor(data.stage_color || '#344E86');
      setCapadexItems(data.questions || []);
      setCapadexProgress(data.progress || []);
      setCapadexAnswers({});
      capadexBacktrackRef.current = {}; // reset per-session telemetry counters
      setCapadexCurrentQ(0);
      setCapadexStageResult(null);
      setCapadexSkipIntent(false);
      setCapadexStageCheck(null);
      setCapadexReturnEmail('');
      setPhase(getProfilePhase(data.stage_code));
    } catch {
      setCapadexOtpError('Network error — please check your connection.');
    } finally {
      setCapadexRegLoading(false);
    }
  };

  // ── CAPADEX: send OTP (register) ─────────────────────────────────────
  const handleCapadexRegister = async () => {
    setCapadexRegError(null);
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(capadexRegEmail)) { setCapadexRegError('Please enter a valid email address.'); return; }
    // Password is no longer required — backend generates one automatically (OTP-only flow)
    setCapadexRegLoading(true);
    try {
      const resp = await fetch('/api/capadex/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: capadexRegEmail.trim(),
          name: participantName.trim() || regName.trim() || '',
          session_id: capadexSessionId || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 409 && (data.error === 'EMAIL_EXISTS' || data.error === 'FREE_ASSESSMENT_LIMIT')) {
        setCapadexExistingName(data.name || '');
        setCapadexLoginMode(true);
        setCapadexPassword('');
        setCapadexRegError(null);
        // If the limit was hit it means they already completed Curiosity —
        // after they log in via OTP, route them to their next stage directly.
        if (data.error === 'FREE_ASSESSMENT_LIMIT') setCapadexSkipIntent(true);
        return;
      }
      if (!resp.ok) throw new Error(data.error || 'Registration failed');
      setCapadexOtpDigits(['','','','','','']);
      setCapadexOtpError(null);
      setCapadexOtpTimer(60);
      setPhase('capadex_otp');
      setTimeout(() => capadexOtpRefs.current[0]?.focus(), 120);
    } catch (err: unknown) {
      setCapadexRegError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setCapadexRegLoading(false);
    }
  };

  // ── CAPADEX: login via OTP (existing account) ────────────────────────
  const handleCapadexLoginOtpSend = async () => {
    setCapadexLoginOtpError(null);
    if (!capadexRegEmail.trim()) { setCapadexLoginOtpError('Please enter your email.'); return; }
    setCapadexLoginOtpLoading(true);
    try {
      const resp = await fetch('/api/capadex/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: capadexRegEmail.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Could not send code');
      setCapadexOtpDigits(['','','','','','']);
      setCapadexOtpError(null);
      setCapadexOtpTimer(60);
      setCapadexLoginOtpSent(true);
      setTimeout(() => capadexOtpRefs.current[0]?.focus(), 80);
    } catch (err: unknown) {
      setCapadexLoginOtpError(err instanceof Error ? err.message : 'Could not send code. Please try again.');
    } finally {
      setCapadexLoginOtpLoading(false);
    }
  };

  // ── CAPADEX: verify OTP ───────────────────────────────────────────────
  const handleCapadexOtpVerify = async () => {
    const code = capadexOtpDigits.join('');
    if (code.length < 6) return;
    setCapadexOtpLoading(true);
    setCapadexOtpError(null);
    try {
      const resp = await fetch('/api/capadex/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: capadexRegEmail.trim(), otp: code, session_id: capadexSessionId || null }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Verification failed');
      setCapadexUser(data.user);
      if (capadexSkipIntent) {
        await handleSkipToNextStage(data.user);
        return;
      }
      if (retrieveReportMode) {
        await handleLoadRecentSessions(data.user, true);
        return;
      }
      await loadCapadexReport(data.user);
    } catch (err: unknown) {
      setCapadexOtpError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setCapadexOtpLoading(false);
    }
  };

  // ── CAPADEX: resend OTP ───────────────────────────────────────────────
  const handleCapadexOtpResend = async () => {
    if (capadexOtpTimer > 0) return;
    setCapadexOtpError(null);
    try {
      await fetch('/api/capadex/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: capadexRegEmail.trim() }),
      });
      setCapadexOtpDigits(['','','','','','']);
      setCapadexOtpTimer(60);
      setTimeout(() => capadexOtpRefs.current[0]?.focus(), 80);
    } catch { setCapadexOtpError('Could not resend code. Please try again.'); }
  };

  // ── CAPADEX: load & store report ─────────────────────────────────────
  const loadCapadexReport = async (user?: { email: string }, sessionIdOverride?: string, goToResult = false) => {
    const sid = sessionIdOverride || capadexSessionId;
    if (!sid) return;
    const email = user?.email || capadexUser?.email || capadexRegEmail.trim();
    try {
      const resp = await fetch(`/api/capadex/report/${sid}?email=${encodeURIComponent(email)}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Could not load report');
      // Always sync the session ID so Email / PDF actions target the visible report
      setCapadexSessionId(sid);
      setCapadexReport(data);

      if (goToResult) {
        // Reconstruct capadexStageResult from the loaded report so CapadexResultPhase
        // can render the full structured report (domains, patterns, next-stage CTA).
        const STAGE_COLORS: Record<string, string> = {
          CAP_CUR: '#3B82F6', CAP_INS: '#10B981', CAP_GRW: '#F59E0B', CAP_MAS: '#8B5CF6',
        };
        const stageCode  = data.stageCode  || data.stage_code  || 'CAP_CUR';
        const stageLabel = data.stageLabel || data.stage_label || 'Curiosity';
        const stageIdx   = CAPADEX_STAGES.findIndex(s => s.code === stageCode);
        const nextS      = stageIdx >= 0 && stageIdx < CAPADEX_STAGES.length - 1
          ? CAPADEX_STAGES[stageIdx + 1] : null;
        const sc         = data.score ?? data.rawScore ?? 0;
        const levelColor = sc >= 75 ? '#10B981' : sc >= 50 ? '#F59E0B' : '#EF4444';
        const reconstructed: CapadexStageResult = {
          session_id:  sid,
          stage_code:  stageCode,
          stage_label: stageLabel,
          stage_index: stageIdx >= 0 ? stageIdx : 0,
          score:       sc,
          score_level: data.scoreLevel || data.score_level || '',
          level_color: levelColor,
          insight:     data.insight || '',
          subdomains:  data.subdomains || [],
          next_stage:  nextS ? {
            code:  nextS.code,
            label: nextS.label,
            index: stageIdx + 1,
            color: STAGE_COLORS[nextS.code] || nextS.color,
            desc:  nextS.desc,
          } : null,
          concern_name: data.concernName || data.concern_name || '',
          progress: CAPADEX_STAGES.map((s, i) => ({
            stage_code:  s.code,
            stage_label: s.label,
            stage_index: i,
            stage_color: STAGE_COLORS[s.code] || s.color,
            status: i < stageIdx ? 'completed' : i === stageIdx ? 'completed' : i === stageIdx + 1 ? 'available' : 'locked',
            score: i === stageIdx ? sc : null,
          })) as CapadexProgress[],
          // Task #307 — carry the read-only re-assessment eligibility signal through the
          // revisit reconstruction so the reminder banner appears when reopening a previous
          // report. Null/absent when longitudinalOutcomeCapture is OFF (no banner).
          reassessment: data.reassessment || null,
        };
        if (data.concernName || data.concern_name) {
          setSelectedConcern(data.concernName || data.concern_name);
        }
        if (data.participantName) setParticipantName(data.participantName);
        setCapadexStageResult(reconstructed);
        setPhase('capadex_result');
      } else {
        setPhase('capadex_report');
      }

      // Fetch OMEGA enrichment non-blocking
      fetch(`/api/capadex/report/${sid}/omega`)
        .then(r => r.ok ? r.json() : null)
        .then(omega => { if (omega) setOmegaReport(omega); })
        .catch(() => {});
      const concernForCheck = data.concernName || data.concern_name || selectedConcern;
      if (email && concernForCheck) {
        handleStageCheck(email).catch(() => {});
      }
    } catch (err: unknown) {
      setCapadexOtpError(err instanceof Error ? err.message : 'Could not load report');
    }
  };

  // ── CAPADEX: view report for the current session (called from result phase) ──
  // Always fetches fresh data so completing Insight/Growth/Mastery shows the
  // correct stage report — not a stale Curiosity one.
  const handleViewCurrentReport = () => {
    const email = capadexUser?.email || capadexRegEmail.trim();
    if (email) {
      loadCapadexReport({ email });
    } else {
      setPhase('capadex_register');
    }
  };

  // ── Intro-phase: early email check (returning user detection) ────────
  const handleIntroEmailCheck = async (email: string, concern: string) => {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRx.test(email)) return;
    setIntroEmailStatus('checking');
    setIntroEmailVerified(false);
    setIntroOtpSent(false);
    setIntroOtpDigits(['', '', '', '', '', '']);
    setIntroOtpError(null);
    try {
      const r = await fetch(`/api/capadex/auth/check-email?email=${encodeURIComponent(email)}`);
      const d = await r.json().catch(() => ({}));
      if (d.at_limit) {
        setIntroEmailName(d.name || '');
        setIntroEmailStatus('limited');
      } else if (d.has_free_assessment) {
        setIntroEmailName(d.name || '');
        setIntroEmailStatus('returning');
      } else {
        setIntroEmailStatus('new');
      }
    } catch {
      setIntroEmailStatus('idle');
    }
  };

  // ── Intro-phase: send OTP (new + returning users both go through here) ─
  const handleIntroSendOtp = async () => {
    const email = capadexRegEmail.trim();
    if (!email) return;
    setIntroOtpLoading(true);
    setIntroOtpError(null);
    try {
      const resp = await fetch('/api/capadex/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: participantName.trim() || undefined }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (data.error === 'FREE_ASSESSMENT_LIMIT') {
          setIntroEmailName(data.name || '');
          setIntroEmailStatus('limited');
          return;
        }
        throw new Error(data.error || 'Could not send code. Please try again.');
      }
      setIntroOtpSent(true);
      setIntroOtpDigits(['', '', '', '', '', '']);
      setIntroOtpTimer(60);
      // Focus first OTP box
      setTimeout(() => introOtpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setIntroOtpError(err instanceof Error ? err.message : 'Failed to send code. Try again.');
    } finally {
      setIntroOtpLoading(false);
    }
  };

  // ── Intro-phase: verify OTP → unlock Analyse button (or execute returning intent) ──
  const handleIntroOtpVerify = async () => {
    const code = introOtpDigits.join('');
    if (code.length < 6) return;
    setIntroOtpLoading(true);
    setIntroOtpError(null);
    const email = capadexRegEmail.trim();
    try {
      const resp = await fetch('/api/capadex/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Verification failed');
      if (data.user) setCapadexUser(data.user);
      setIntroEmailVerified(true);
      setIntroOtpError(null);

      // ── Returning-user shortcut: execute intent immediately ──────────
      if (returningIntent === 'resume') {
        const icResp = await fetch(`/api/capadex/auth/incomplete-session?email=${encodeURIComponent(email)}`);
        const icData = await icResp.json().catch(() => ({}));
        if (!icData.has_incomplete) {
          setIntroOtpError('No assessment in progress found for this email.');
          return;
        }
        const session = icData.session;
        const loadResp = await fetch(`/api/capadex/session/${session.session_id}/load`);
        if (!loadResp.ok) { setIntroOtpError('Could not load your session. Please try again.'); return; }
        const ld = await loadResp.json();
        setCapadexSessionId(ld.session_id);
        setSelectedConcern(ld.concern_name);
        setSelectedConcerns([ld.concern_name]);
        setCapadexStage(ld.stage_code);
        setCapadexStageIndex(ld.stage_index);
        setCapadexStageColor(ld.stage_color);
        setCapadexItems(ld.questions || []);
        setCapadexAnswers(ld.prior_answers || {});
        setIncompleteSession(null);
        if (ld.answered_items >= ld.total_items) {
          const cr = await fetch(`/api/capadex/session/${ld.session_id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const result = await cr.json();
          setCapadexStageResult(result);
          setCapadexProgress(result.progress || []);
          const authedEmail = data.user?.email || email;
          fetch(`/api/capadex/report/${ld.session_id}?email=${encodeURIComponent(authedEmail)}`)
            .then(r => r.ok ? r.json() : null).then(rd => { if (rd) setCapadexReport(rd); }).catch(() => {});
          setPhase('capadex_result');
        } else {
          setCapadexCurrentQ(ld.answered_items || 0);
          setCapadexStageResult(null);
          setPhase('capadex_q');
        }
        return;
      }

      if (returningIntent === 'report') {
        const rResp = await fetch(`/api/capadex/user/recent-sessions?email=${encodeURIComponent(email)}`);
        const rData = await rResp.json().catch(() => ({ sessions: [] }));
        let sessions: Array<{ session_id: string; concern_name: string; stage_code: string; score: number | null; score_level: string | null; created_at: string }> = rData.sessions || [];

        // ── Fallback: session fully answered but never marked completed ──
        // (happens when the user closed the browser after the last question)
        if (sessions.length === 0) {
          const icResp = await fetch(`/api/capadex/auth/incomplete-session?email=${encodeURIComponent(email)}`);
          const icData = await icResp.json().catch(() => ({}));
          if (icData.has_incomplete && icData.session && icData.session.answered_items >= icData.session.total_items) {
            // All questions answered — complete the session now, then show the report
            const sid = icData.session.session_id;
            const completeResp = await fetch(`/api/capadex/session/${sid}/complete`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
            });
            const completeData = await completeResp.json().catch(() => ({}));
            if (!completeResp.ok) {
              setIntroOtpError(completeData.error || 'Could not complete your assessment. Please try again.');
              return;
            }
            setCapadexStageResult(completeData);
            setCapadexProgress(completeData.progress || []);
            // Re-fetch the now-completed sessions list
            const rResp2 = await fetch(`/api/capadex/user/recent-sessions?email=${encodeURIComponent(email)}`);
            const rData2 = await rResp2.json().catch(() => ({ sessions: [] }));
            sessions = rData2.sessions || [];
          }
        }

        if (sessions.length === 0) {
          setIntroOtpError('No completed reports found for this email. If you have an unfinished assessment, use "Continue Stage Analysis" instead.');
          return;
        }
        setRecentSessions(sessions);
        // Load the most recent report inline so errors surface in introOtpError
        const target = sessions[0];
        const reportResp = await fetch(`/api/capadex/report/${target.session_id}?email=${encodeURIComponent(email)}`);
        const reportData = await reportResp.json().catch(() => ({}));
        if (!reportResp.ok) {
          setIntroOtpError(reportData.error || 'Could not load your report. Please try again.');
          return;
        }
        setCapadexSessionId(target.session_id);
        setCapadexReport(reportData);
        fetch(`/api/capadex/report/${target.session_id}/omega`)
          .then(r => r.ok ? r.json() : null)
          .then(omega => { if (omega) setOmegaReport(omega); })
          .catch(() => {});
        setPhase('capadex_report');
        return;
      }

      // ── Normal flow: check for incomplete session, unlock Analyse ────
      try {
        const icResp = await fetch(`/api/capadex/auth/incomplete-session?email=${encodeURIComponent(email)}`);
        const icData = await icResp.json().catch(() => ({}));
        if (icData.has_incomplete && icData.session) setIncompleteSession(icData.session);
      } catch { /* non-blocking */ }
    } catch (err: unknown) {
      setIntroOtpError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setIntroOtpLoading(false);
    }
  };

  // ── Continue incomplete Curiosity session ────────────────────────────
  const handleContinueIncomplete = async () => {
    if (!incompleteSession) return;
    setContinueLoading(true);
    try {
      const resp = await fetch(`/api/capadex/session/${incompleteSession.session_id}/load`);
      if (!resp.ok) throw new Error('Could not load session');
      const data = await resp.json();
      setCapadexSessionId(data.session_id);
      setSelectedConcern(data.concern_name);
      setSelectedConcerns([data.concern_name]);
      setCapadexStage(data.stage_code);
      setCapadexStageIndex(data.stage_index);
      setCapadexStageColor(data.stage_color);
      setCapadexItems(data.questions || []);
      const prior: Record<string, number> = data.prior_answers || {};
      setCapadexAnswers(prior);
      setIncompleteSession(null);

      const allAnswered = data.answered_items >= data.total_items;
      if (allAnswered) {
        // All questions already answered — complete the session directly
        const completeResp = await fetch(`/api/capadex/session/${data.session_id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await completeResp.json();
        setCapadexStageResult(result);
        setCapadexProgress(result.progress || []);
        // Pre-fetch report if user is already authenticated
        const authedEmail = capadexUser?.email || capadexRegEmail.trim();
        if (authedEmail) {
          fetch(`/api/capadex/report/${data.session_id}?email=${encodeURIComponent(authedEmail)}`)
            .then(r => r.ok ? r.json() : null)
            .then(rData => { if (rData) setCapadexReport(rData); })
            .catch(() => {});
        }
        setPhase('capadex_result');
      } else {
        setCapadexCurrentQ(data.answered_items || 0);
        setCapadexStageResult(null);
        setPhase('capadex_q');
      }
    } catch {
      setContinueLoading(false);
    } finally {
      setContinueLoading(false);
    }
  };

  // ── Dismiss incomplete session prompt (start fresh) ──────────────────
  const handleStartFresh = () => {
    setIncompleteSession(null);
    setTimeout(() => handleAnalyseConcern(), 80);
  };

  // ── Intro-phase: resend OTP ───────────────────────────────────────────
  const handleIntroOtpResend = async () => {
    if (introOtpTimer > 0) return;
    setIntroOtpError(null);
    try {
      await fetch('/api/capadex/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: capadexRegEmail.trim() }),
      });
      setIntroOtpDigits(['', '', '', '', '', '']);
      setIntroOtpTimer(60);
    } catch { /* silent */ }
  };

  // ── Resume: restore a previously saved draft ──────────────────────────
  const handleResumeSession = async () => {
    if (!savedSession) return;
    // Clear draft immediately so dismiss works even on error
    setSavedSession(null);
    localStorage.removeItem(DRAFT_KEY);

    setSelectedConcern(savedSession.concern);
    setSelectedConcerns(savedSession.selectedConcerns || [savedSession.concern]);
    if (savedSession.email) setCapadexRegEmail(savedSession.email);

    if (savedSession.session_id) {
      // Load the session via the /load endpoint (same as handleContinueIncomplete)
      setCapadexLoading(true);
      try {
        const resp = await fetch(`/api/capadex/session/${savedSession.session_id}/load`);
        if (!resp.ok) throw new Error('Could not load session');
        const data = await resp.json();
        setCapadexSessionId(data.session_id);
        setSelectedConcern(data.concern_name);
        setSelectedConcerns([data.concern_name]);
        setCapadexStage(data.stage_code);
        setCapadexStageIndex(data.stage_index);
        setCapadexStageColor(data.stage_color);
        setCapadexItems(data.questions || []);
        setCapadexAnswers(data.prior_answers || {});
        setCapadexCurrentQ(data.answered_items || 0);
        setCapadexStageResult(null);
        setPhase('capadex_q');
      } catch {
        // Load failed — fall back to re-running analysis from the concern
        handleAnalyseConcern(savedSession.concern);
      } finally {
        setCapadexLoading(false);
      }
    } else {
      // No session_id yet — re-run analysis to create a new session
      handleAnalyseConcern(savedSession.concern);
    }
  };

  const handleDismissResume = () => {
    setSavedSession(null);
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleLoadRecentSessions = async (user?: { email: string }, autoNavigate = false) => {
    const email = user?.email || capadexUser?.email || capadexRegEmail.trim();
    if (!email) return;
    setRecentSessionsLoading(true);
    try {
      const resp = await fetch(`/api/capadex/user/recent-sessions?email=${encodeURIComponent(email)}`);
      const data = await resp.json().catch(() => ({}));
      setRecentSessions(data.sessions || []);
      // Only auto-jump to the single session when explicitly requested (e.g. retrieveReportMode).
      // The intro-email verification path MUST NOT auto-navigate — the user may be starting
      // a brand-new concern assessment and should stay on the intro screen.
      if (autoNavigate && data.sessions?.length === 1) {
        await loadCapadexReport(user, data.sessions[0].session_id);
      }
    } catch { setRecentSessions([]); }
    finally { setRecentSessionsLoading(false); }
  };

  const handleLoadPreviousReport = async (sessionId: string) => {
    const email = capadexUser?.email || capadexRegEmail.trim();
    await loadCapadexReport(email ? { email } : undefined, sessionId, true);
  };

  // ── CAPADEX: email report ─────────────────────────────────────────────
  const handleCapadexEmailReport = async () => {
    if (!capadexSessionId || capadexEmailLoading) return;
    setCapadexEmailLoading(true);
    try {
      // Generate PDF as base64 to attach to the email
      let pdfBase64: string | null = null;
      try {
        pdfBase64 = await handleCapadexPdf(true);
      } catch { /* proceed without attachment if PDF generation fails */ }

      const resp = await fetch(`/api/capadex/report/${capadexSessionId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: capadexRegEmail.trim() || capadexUser?.email,
          name: participantName.trim() || capadexUser?.name || '',
          ...(pdfBase64 ? { pdfBase64 } : {}),
        }),
      });
      if (resp.ok) {
        setCapadexEmailSent(true);
        setTimeout(() => setCapadexEmailSent(false), 3000);
      }
    } catch { /* silent */ } finally { setCapadexEmailLoading(false); }
  };

  // ── CAPADEX: download PDF (returnBase64=true → return base64 string instead of saving) ─────
  const handleCapadexPdf = async (returnBase64 = false): Promise<string | null> => {
    console.log('[PDF] called — report:', !!capadexReport, 'loading:', capadexPdfLoading);
    if (!capadexReport || capadexPdfLoading) return null;
    setCapadexPdfError(null);
    setCapadexPdfBlobUrl(null);
    setCapadexPdfLoading(true);

    const rpt       = capadexReport;
    const safe      = rpt.concernName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const published = rpt.reviewStatus === 'published';
    const filename  = `MetryxOne_${safe}_Report${published ? '_ExpertReviewed' : ''}.pdf`;

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // ── Palette ─────────────────────────────────────────────────────────
      const navy:    [number,number,number] = [52, 78, 134];
      const navyDk:  [number,number,number] = [30, 47, 82];
      const navyBg:  [number,number,number] = [238, 242, 250];
      const navyBdr: [number,number,number] = [212, 219, 240];
      const teal:    [number,number,number] = [13, 148, 136];
      const white:   [number,number,number] = [255, 255, 255];
      const textDk:  [number,number,number] = [30, 43, 74];
      const textMd:  [number,number,number] = [74, 85, 104];
      const textMu:  [number,number,number] = [148, 163, 184];
      const green:   [number,number,number] = [5, 150, 105];
      const amber:   [number,number,number] = [217, 119, 6];
      const red:     [number,number,number] = [220, 38, 38];

      const score     = Math.round(rpt.score);
      const scoreCol: [number,number,number] = score >= 80 ? navy : score >= 60 ? [37,99,235] : score >= 40 ? amber : red;
      const levelStr  = rpt.scoreLevel || (score >= 80 ? 'Advanced' : score >= 60 ? 'Proficient' : score >= 40 ? 'Developing' : 'Emerging');
      const stageLabel = rpt.stageLabel || rpt.stageCode || 'Curiosity';
      const name       = (rpt.participantName || '').split(' ')[0] || 'You';

      const PW = 210; const ML = 14; const MR = 14; const CW = PW - ML - MR;
      let y = 0;

      // ── Helpers ──────────────────────────────────────────────────────────
      const wrap = (text: string, x: number, yp: number, w: number, fs: number, col: [number,number,number], bold = false): number => {
        doc.setFontSize(fs); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...col);
        const ls = doc.splitTextToSize(text, w); doc.text(ls, x, yp);
        return yp + ls.length * (fs * 0.42) + 1.5;
      };

      const checkPage = (needed: number) => {
        if (y + needed > 278) {
          doc.addPage(); y = 18;
          doc.setFillColor(...navyBg); doc.rect(0, 0, PW, 10, 'F');
          doc.setFillColor(...navy);   doc.rect(0, 0, 3, 10, 'F');
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
          doc.text(`MetryxOne · CAPADEX Report — ${rpt.concernName}`, ML + 5, 7);
        }
      };

      const sectionHeader = (title: string, accent: [number,number,number] = navy) => {
        checkPage(16);
        doc.setFillColor(...accent); doc.rect(ML, y, 3, 9, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accent);
        doc.text(title.toUpperCase(), ML + 6, y + 6.5);
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.2);
        doc.line(ML + 6, y + 9, ML + CW, y + 9);
        y += 14;
      };

      // ─────────────────────────────────────────────────────────────────────
      // HEADER — dark bar + white hero (score LEFT, concern RIGHT)
      // ─────────────────────────────────────────────────────────────────────
      doc.setFillColor(...navyDk); doc.rect(0, 0, PW, 20, 'F');
      doc.setFillColor(...navy);   doc.rect(0, 0, 4, 20, 'F');
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text('MetryxOne', ML + 5, 12);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text('Behavioural Intelligence Report', ML + 5, 18);
      const dateStr = new Date(rpt.generatedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.setFontSize(7); doc.setTextColor(180, 195, 220);
      doc.text(dateStr, PW - MR, 12, { align: 'right' });
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, 20, PW, 20);

      // Hero section — white background, score circle LEFT + concern RIGHT
      y = 26;
      // Score circle (filled circle, center-left)
      const circCX = ML + 18; const circCY = y + 17;
      doc.setFillColor(...scoreCol); doc.circle(circCX, circCY, 14, 'F');
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text(String(score), circCX, circCY + 2.5, { align: 'center' });
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...white);
      doc.text('/100', circCX, circCY + 9, { align: 'center' });
      // Level badge below circle
      doc.setFillColor(...scoreCol); doc.rect(circCX - 13, circCY + 17, 26, 6, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text(levelStr.toUpperCase(), circCX, circCY + 21.5, { align: 'center' });

      // Right side — level pill + concern name + subtitle
      const infoX = ML + 40; const infoW = ML + CW - infoX - 2;
      // Small level pill (teal)
      doc.setFillColor(232, 252, 248); doc.rect(infoX, y, 40, 5.5, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...teal);
      doc.text(`${stageLabel.toUpperCase()} STAGE`, infoX + 2, y + 4);
      // Concern name
      const cnLines = doc.splitTextToSize(rpt.concernName, infoW);
      doc.setFontSize(19); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDk);
      doc.text(cnLines, infoX, y + 13);
      const cnH = cnLines.length * 8;
      // Subtitle
      const agePart = rpt.participantAge ? ` · Age ${rpt.participantAge}` : '';
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text(`Prepared for ${rpt.participantName || 'Participant'}${agePart} · ${stageLabel} Assessment`, infoX, y + cnH + 16);
      y = Math.max(y + cnH + 26, circCY + 32);
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, y, PW, y);
      y += 6;

      // ─────────────────────────────────────────────────────────────────────
      // 1. INTRODUCTION
      // ─────────────────────────────────────────────────────────────────────
      sectionHeader('Introduction', navy);
      y = wrap(
        `This report presents the ${stageLabel} Stage results for ${rpt.participantName || 'the participant'} — the first stage of MetryxOne's CAPADEX behavioural intelligence assessment. The ${stageLabel} Stage measures self-awareness and pattern recognition across key cognitive and behavioural domains related to ${rpt.concernName}.`,
        ML, y, CW, 10.5, textDk
      ); y += 3;
      y = wrap(
        'This is a standardised, science-backed report. Results are confidential and intended to support professional development, coaching, or clinical guidance — not for diagnostic purposes.',
        ML, y, CW, 9, textMd
      ); y += 4;
      // Meta pill row
      doc.setFillColor(...navyBg); doc.rect(ML, y, CW, 10, 'F');
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.2); doc.rect(ML, y, CW, 10, 'S');
      const metaItems = [
        { label: 'PARTICIPANT', value: rpt.participantName || '—', x: ML + 4 },
        { label: 'STAGE',       value: stageLabel,                  x: ML + 72 },
        { label: 'DATE',        value: new Date(rpt.generatedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), x: ML + 116 },
      ];
      metaItems.forEach(({ label, value, x }) => {
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textMu);
        doc.text(label, x, y + 4);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDk);
        doc.text(value, x, y + 8.5);
      });
      y += 15;

      // ─────────────────────────────────────────────────────────────────────
      // 2. WHAT IS BEING ASSESSED
      // ─────────────────────────────────────────────────────────────────────
      checkPage(50);
      sectionHeader('What Is Being Assessed', teal);
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDk);
      doc.text(rpt.concernName, ML, y); y += 7;
      const cl2 = rpt.concernName.toLowerCase();
      const concernDesc = /attention|distract|focus/.test(cl2)
        ? `Attention management encompasses the ability to sustain, direct, and regulate focus across tasks and environments. It covers a spectrum from momentary lapses to sustained concentration challenges — affecting academic performance, productivity, and daily functioning.`
        : /screen|phone|social|gaming|internet/.test(cl2)
        ? `Screen time behaviour refers to patterns of digital device use — including frequency, duration, emotional triggers, and the ability to self-regulate usage. It examines the relationship between digital habits and overall wellbeing, productivity, and social functioning.`
        : `This assessment examines the behavioural and cognitive dimensions of "${rpt.concernName}" — including self-awareness, pattern recognition, regulation strategies, and growth capacity. Understanding these dimensions provides a foundation for targeted, evidence-based support.`;
      y = wrap(concernDesc, ML, y, CW, 9.5, textMd); y += 5;
      // Domain tags — 2 columns
      const domains = (rpt.subdomains || []).map(sd => sd.subdomain_name || sd.subdomain_code || '');
      if (domains.length > 0) {
        const tagH = 7; const tagGap = 2.5; const colW = (CW - 3) / 2;
        for (let r = 0; r < Math.ceil(domains.length / 2); r++) {
          checkPage(tagH + tagGap + 2);
          [0, 1].forEach(ci => {
            const d = domains[r * 2 + ci];
            if (!d) return;
            const tx = ML + ci * (colW + 3);
            doc.setFillColor(...navyBg); doc.rect(tx, y, colW, tagH, 'F');
            doc.setDrawColor(...navyBdr); doc.setLineWidth(0.2); doc.rect(tx, y, colW, tagH, 'S');
            doc.setFillColor(...navy); doc.circle(tx + 5, y + tagH / 2, 1.3, 'F');
            doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textDk);
            doc.text(d, tx + 9.5, y + tagH / 2 + 0.8);
          });
          y += tagH + tagGap;
        }
        y += 3;
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3. YOUR [CONCERN] REPORT — methodology narrative
      // ─────────────────────────────────────────────────────────────────────
      checkPage(50);
      sectionHeader(`Your ${rpt.concernName} Report`, navy);
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDk);
      doc.text(`${name}, here's what your answers revealed.`, ML, y); y += 7;
      y = wrap(
        `You answered questions honestly about ${rpt.concernName}. This report maps those responses across ${rpt.subdomains.length} behavioural dimensions — benchmarked against 10,000+ people with the same concern — so you can see clearly where you stand, and what to do about it.`,
        ML, y, CW, 9.5, textMd
      ); y += 3;
      y = wrap(
        'Scores run 0–100. The 75-point line is the standard threshold. Anything below it shows where the most meaningful growth can happen. Anything above it shows what you can build from.',
        ML, y, CW, 9.5, textMd
      ); y += 5;
      // Stats row
      const stats = [{ label: 'Domains Assessed', value: String(rpt.subdomains.length) }, { label: 'Framework', value: 'SDI™' }, { label: 'Benchmark Pool', value: '10K+' }];
      const statW = (CW - 4) / 3;
      stats.forEach(({ label, value }, si) => {
        const sx = ML + si * (statW + 2);
        doc.setFillColor(...navyBg); doc.rect(sx, y, statW, 14, 'F');
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.2); doc.rect(sx, y, statW, 14, 'S');
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
        doc.text(value, sx + statW / 2, y + 8, { align: 'center' });
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text(label, sx + statW / 2, y + 12.5, { align: 'center' });
      }); y += 18;
      // Performance bands
      const bands: Array<{ label: string; range: string; col: [number,number,number]; bg: [number,number,number] }> = [
        { label: 'Emerging',   range: '0 – 39',   col: red,            bg: [254, 226, 226] },
        { label: 'Developing', range: '40 – 59',  col: amber,          bg: [254, 243, 199] },
        { label: 'Proficient', range: '60 – 79',  col: [37,99,235],    bg: [219, 234, 254] },
        { label: 'Advanced',   range: '80 – 100', col: navy,           bg: navyBg          },
      ];
      const bandW = (CW - 6) / 4;
      checkPage(14);
      bands.forEach(({ label, range, col, bg }, bi) => {
        const bx = ML + bi * (bandW + 2);
        doc.setFillColor(...bg); doc.rect(bx, y, bandW, 12, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...col);
        doc.text(label, bx + bandW / 2, y + 5.5, { align: 'center' });
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text(range, bx + bandW / 2, y + 10, { align: 'center' });
      }); y += 16;

      // ─────────────────────────────────────────────────────────────────────
      // 4. OVERALL SCORE
      // ─────────────────────────────────────────────────────────────────────
      checkPage(40);
      sectionHeader('Overall Score', scoreCol);
      // Score circle (left)
      const sc2CX = ML + 14; const sc2CY = y + 14;
      doc.setFillColor(...scoreCol); doc.circle(sc2CX, sc2CY, 12, 'F');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text(String(score), sc2CX, sc2CY + 2, { align: 'center' });
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...white);
      doc.text('/100', sc2CX, sc2CY + 7, { align: 'center' });
      // Score context text (right of circle)
      const scoreCtxMap: Record<string, string> = {
        Advanced:   `A score of ${score} is among the highest for this concern — reflecting strong self-awareness and cognitive regulation. This is a meaningful result that signals real capacity for growth at the next level.`,
        Proficient: `A score of ${score} reflects above-average self-awareness and solid performance. There are genuine strengths here, alongside specific areas where targeted support would produce measurable change.`,
        Developing: `A score of ${score} reflects an emerging pattern — enough awareness to identify the concern, with clear room for structured development. This is exactly the stage where the Insight assessment creates the biggest impact.`,
        Emerging:   `A score of ${score} marks an important starting point. Recognising the pattern is the hardest step — and it has been taken. Everything that follows builds from this honest baseline.`,
      };
      const scoreCtx = scoreCtxMap[levelStr] || scoreCtxMap['Developing'];
      const scRX = ML + 30; const scRW = CW - 30 + ML - ML;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...scoreCol);
      doc.text(levelStr, scRX, y + 5);
      y = wrap(scoreCtx, scRX, y + 10, CW - 32, 9.5, textMd);
      y = Math.max(y, sc2CY + 16);
      y += 3;
      // Score progress bar
      const barTotalW = CW; const barH = 5;
      doc.setFillColor(230, 232, 240); doc.rect(ML, y, barTotalW, barH, 'F');
      doc.setFillColor(...scoreCol); doc.rect(ML, y, barTotalW * score / 100, barH, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text('0', ML, y + barH + 4);
      doc.text('100', ML + barTotalW, y + barH + 4, { align: 'right' });
      y += barH + 8;
      if (published) {
        doc.setFillColor(209, 250, 229); doc.rect(ML, y, CW, 9, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...green);
        doc.text('✓  Expert-Reviewed Report — Reviewed and calibrated by a MetryxOne analyst.', ML + 4, y + 6);
        y += 13;
      }

      // ─────────────────────────────────────────────────────────────────────
      // 5. ASSESSMENT FINDING — narrative
      // ─────────────────────────────────────────────────────────────────────
      checkPage(50);
      sectionHeader('Assessment Finding', scoreCol);
      const narrativeCat2 = /attention|distract|focus/.test(cl2) ? 'attention' : /screen|phone|social|gaming/.test(cl2) ? 'screen' : /career|job|profession|workplace|purpose|direction|burnout/.test(cl2) ? 'career' : 'default';
      const normLevel = (levelStr === 'Mastery' ? 'Advanced' : levelStr) as 'Advanced' | 'Proficient' | 'Developing' | 'Emerging';
      const narrativeMap: Record<string, Record<string, { headline: string; story: string }>> = {
        career: {
          Advanced:   { headline: `${name} has real professional clarity — the question is what to do with it.`,
            story: `These results show strong self-awareness around "${rpt.concernName}". That clarity is a genuine advantage. The Insight stage maps the exact drivers and builds a precise picture of what career moves are actually available.` },
          Proficient: { headline: `${name} understands the professional situation — and there's more precision available.`,
            story: `Solid professional awareness around "${rpt.concernName}" is visible here. The Insight stage goes further — identifying the specific patterns, triggers, and leverage points that turn general awareness into a decisive career move.` },
          Developing: { headline: `${name}'s results reveal the real shape of the "${rpt.concernName}" challenge.`,
            story: `These results are an honest picture of where things stand. The clarity may be uncomfortable — but it's exactly the kind of signal that, when understood properly, creates real forward movement. The Insight stage finds what's actually driving this pattern.` },
          Emerging:   { headline: `${name}'s results point to something worth understanding at a deeper level.`,
            story: `The "${rpt.concernName}" pattern has more structure to it than it may appear. Behind it are specific drivers — professional, psychological, situational — that general reflection alone can't surface.` },
        },
        default: {
          Advanced:   { headline: `${name} shows strong awareness — and there's a deeper layer waiting to be understood.`,
            story: `These results reveal genuine self-awareness around "${rpt.concernName}". The Insight stage will show what sits beneath that awareness — the patterns, the triggers, the exact levers to pull.` },
          Proficient: { headline: `${name} is doing well — and the Insight stage will show exactly what to do next.`,
            story: `The results are solid. The Insight stage takes that foundation and builds a precise picture of what's holding the ceiling and how to break through it.` },
          Developing: { headline: `${name}'s results reveal something important about "${rpt.concernName}".`,
            story: `These Curiosity results are the first honest look at what's really going on. The Insight stage goes several layers deeper — finding the root cause, not just the symptoms.` },
          Emerging:   { headline: `${name}'s results are the beginning of a real breakthrough.`,
            story: `Every significant change starts with accurate information. These results have created that starting point. The Insight stage builds the complete map of the "${rpt.concernName}" pattern.` },
        },
      };
      const nm = narrativeMap[narrativeCat2]?.[normLevel] || narrativeMap['default'][normLevel] || narrativeMap['default']['Developing'];
      const headline = (published && rpt.headlineOverride) ? rpt.headlineOverride : nm.headline;
      const story    = (published && rpt.narrativeOverride) ? rpt.narrativeOverride : nm.story;
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...textDk);
      const hlLines = doc.splitTextToSize(headline, CW); doc.text(hlLines, ML, y);
      y += hlLines.length * 5.5 + 3;
      y = wrap(story, ML, y, CW, 10, textMd); y += 5;
      // "What this looks like in your daily life"
      checkPage(30);
      doc.setFillColor(...navyBg); doc.rect(ML, y, CW, 8, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
      doc.text('WHAT THIS LOOKS LIKE IN YOUR DAILY LIFE', ML + 4, y + 5.5);
      y += 11;
      const dailyLines: string[] = normLevel === 'Emerging'
        ? ["The pattern feels bigger than willpower — it shows up even when you're actively trying to stop it.",
           "There's often a sense of being stuck in a loop without a clear way out of it.",
           "Awareness is there, but turning it into consistent change has been the hard part."]
        : normLevel === 'Developing'
        ? ["You have good days and harder days — the pattern isn't constant, but it isn't resolved either.",
           "You can manage it when you really focus, but it costs more effort than it should.",
           "You're aware of the issue. That awareness is your biggest asset right now."]
        : normLevel === 'Proficient'
        ? ["You handle this well most of the time — but specific triggers still catch you.",
           "Others would say you manage fine. You know the edges where it still breaks down.",
           "The growth here is precision and consistency, not foundation."]
        : ["Your results show real strength — this concern isn't significantly disrupting your daily life.",
           "The value of going deeper is understanding the edge cases where things still occasionally slip.",
           "At this level, the growth is about optimisation — building on what already works well."];
      dailyLines.forEach(line => {
        checkPage(7);
        doc.setFillColor(...scoreCol); doc.circle(ML + 2.5, y - 0.5, 1.2, 'F');
        y = wrap(line, ML + 6, y, CW - 6, 9.5, textMd);
        y += 1;
      });
      y += 4;

      // ─────────────────────────────────────────────────────────────────────
      // 6. DIMENSION SCORES — table with coloured bars
      // ─────────────────────────────────────────────────────────────────────
      if ((rpt.subdomains || []).length > 0) {
        checkPage(20);
        sectionHeader('Dimension Scores', navy);
        // Table header
        const COL = { dim: ML + 3, score: ML + 112, level: ML + 128, bar: ML + 155 };
        const BAR_W = CW - (COL.bar - ML) - 2;
        doc.setFillColor(...navy); doc.rect(ML, y, CW, 8, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
        doc.text('Dimension',  COL.dim,   y + 5.5);
        doc.text('Score',      COL.score, y + 5.5);
        doc.text('Level',      COL.level, y + 5.5);
        doc.text('Progress',   COL.bar,   y + 5.5);
        y += 9;
        (rpt.subdomains || []).forEach((sd, idx) => {
          checkPage(8);
          const sc   = Math.round(Number(sd.avg_score) || 0);
          const lvC: [number,number,number] = sc >= 75 ? green : sc >= 50 ? amber : red;
          const lvL  = sc >= 75 ? 'Proficient' : sc >= 50 ? 'Developing' : 'Emerging';
          const rowH = 8;
          doc.setFillColor(idx % 2 === 0 ? 245 : 255, idx % 2 === 0 ? 246 : 255, idx % 2 === 0 ? 250 : 255);
          doc.rect(ML, y, CW, rowH, 'F');
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textDk);
          doc.text(sd.subdomain_name || sd.subdomain_code || '—', COL.dim, y + 5.5);
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...lvC);
          doc.text(String(sc), COL.score, y + 5.5);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
          doc.text(lvL, COL.level, y + 5.5);
          // Bar track (grey) — same pattern as OMEGA PDF
          doc.setFillColor(229, 231, 235); doc.roundedRect(COL.bar, y + 2.5, BAR_W, 3, 0.5, 0.5, 'F');
          if (sc > 0) { doc.setFillColor(...lvC); doc.roundedRect(COL.bar, y + 2.5, BAR_W * sc / 100, 3, 0.5, 0.5, 'F'); }
          y += rowH;
        });
        y += 5;
      }

      // ─────────────────────────────────────────────────────────────────────
      // 7. RECOMMENDED NEXT STEPS
      // ─────────────────────────────────────────────────────────────────────
      if (rieRecommendations && rieRecommendations.length > 0) {
        checkPage(20);
        sectionHeader('Recommended Next Steps', green);
        const DOMAIN_COLORS: Record<string, [number,number,number]> = {
          learning:[37,99,235], behavioural:navy, engagement:[13,148,136],
          emotional:[124,58,237], resilience:[5,150,105], employability:[217,119,6],
          leadership:[52,78,134], recovery:[220,38,38],
        };
        rieRecommendations.forEach((rec, i) => {
          const col = DOMAIN_COLORS[rec.domain] || navy;
          const titleLines = doc.splitTextToSize(rec.title, CW - 18);
          const outLines   = doc.splitTextToSize(rec.expected_outcome, CW - 18);
          const cardH = Math.max(28, 6 + titleLines.length * 4.8 + 2 + outLines.length * 4 + 8);
          checkPage(cardH + 4);
          // Card border accent
          doc.setFillColor(...col); doc.rect(ML, y, 3, cardH, 'F');
          doc.setFillColor(248, 249, 252); doc.rect(ML + 3, y, CW - 3, cardH, 'F');
          doc.setDrawColor(...col); doc.setLineWidth(0.2); doc.rect(ML, y, CW, cardH, 'S');
          // Number circle
          doc.setFillColor(...col); doc.circle(ML + 10, y + 9, 4, 'F');
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
          doc.text(String(i + 1), ML + 10, y + 10.5, { align: 'center' });
          let cy3 = y + 7;
          doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...col);
          doc.text(titleLines, ML + 18, cy3); cy3 += titleLines.length * 4.8 + 2;
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
          doc.text(outLines, ML + 18, cy3); cy3 += outLines.length * 4 + 3;
          doc.setFontSize(8); doc.setTextColor(...textMu);
          doc.text(`Timing: ${rec.timing}  ·  ${rec.intensity} intensity`, ML + 18, cy3);
          y += cardH + 4;
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // 8. ESCALATION / EXPERT REVIEWED
      // ─────────────────────────────────────────────────────────────────────
      if (rieHasEscalation) {
        checkPage(16);
        doc.setFillColor(254, 242, 242); doc.rect(ML, y, CW, 14, 'F');
        doc.setDrawColor(254, 202, 202); doc.setLineWidth(0.25); doc.rect(ML, y, CW, 14, 'S');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...red);
        doc.text('Counsellor Recommended', ML + 5, y + 6);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        doc.text('Your results suggest a conversation with a qualified counsellor would be beneficial.', ML + 5, y + 11.5);
        y += 18;
      }

      // ── FOOTER on every page ─────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...navyBg); doc.rect(0, 284, PW, 13, 'F');
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, 284, PW, 284);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text('MetryxOne · Behavioural Intelligence Platform · metryx.one', ML, 291);
        doc.text(`Page ${p} of ${totalPages}`, PW - MR, 291, { align: 'right' });
      }

      // ── Save / return ────────────────────────────────────────────────────
      if (returnBase64 === true) {
        setCapadexPdfLoading(false);
        return doc.output('datauristring');
      }
      doc.save(filename);
      const blob = doc.output('blob');
      const url  = URL.createObjectURL(blob);
      setCapadexPdfBlobUrl(prev => { if (prev && prev !== 'PRINT') URL.revokeObjectURL(prev); return url; });
      setCapadexPdfFilename(filename);
      return null;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF] generation failed:', msg);
      setCapadexPdfError(msg);
      return null;
    } finally {
      setCapadexPdfLoading(false);
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
        setRieActionPlanDesktopCopied(true);
        setTimeout(() => setRieActionPlanDesktopCopied(false), 2500);
        return;
      }

      let sharePayload: ShareData = { title: shareTitle, text: shareText };

      if (actionPlanRef.current) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(actionPlanRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
          });
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const file = new File([blob], 'action-plan.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              sharePayload = { title: shareTitle, text: shareText, files: [file] };
            }
          }
        } catch (_) {
        }
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
      const grayLt:  [number,number,number] = [243, 244, 246];

      const DOMAIN_COLORS: Record<string, [number,number,number]> = {
        learning:      [37, 99, 235],
        behavioural:   navy,
        engagement:    [13, 148, 136],
        emotional:     [124, 58, 237],
        resilience:    [5, 150, 105],
        employability: [217, 119, 6],
        leadership:    [52, 78, 134],
        recovery:      [220, 38, 38],
      };

      const PW = 210; const ML = 14; const MR = 14; const CW = PW - ML - MR;
      let y = 0;

      const wrap = (text: string, x: number, yp: number, w: number, fs: number,
                    col: [number,number,number], style: string = 'normal'): number => {
        doc.setFontSize(fs); doc.setFont('helvetica', style); doc.setTextColor(...col);
        const lines = doc.splitTextToSize(text, w);
        doc.text(lines, x, yp);
        return yp + lines.length * (fs * 0.42) + 1.5;
      };

      const checkPage = (needed: number) => {
        if (y + needed > 278) {
          doc.addPage(); y = 14;
          doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3);
          doc.line(0, 0, PW, 0);
        }
      };

      // ── Header ──
      doc.setFillColor(...white); doc.rect(0, 0, PW, 22, 'F');
      doc.setFillColor(...navy); doc.rect(0, 0, 3, 22, 'F');
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.4);
      doc.line(0, 22, PW, 22);

      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
      doc.text('MetryxOne', ML + 2, 10);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text('Behavioural Intelligence', ML + 2, 16.5);

      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
      doc.text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), PW - MR, 10, { align: 'right' });

      y = 29;

      // ── Title block ──
      doc.setFillColor(...navyBg); doc.roundedRect(ML, y, CW, 18, 2, 2, 'F');
      doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.roundedRect(ML, y, CW, 18, 2, 2, 'S');
      doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navyDk);
      doc.text('Your Action Plan', ML + 6, y + 8);
      if (capadexReport) {
        const participantName = capadexReport.participantName || '';
        const concern         = capadexReport.concernName || '';
        const subtitle        = [participantName, concern].filter(Boolean).join(' · ');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
        doc.text(subtitle, ML + 6, y + 14.5);
      }
      y += 24;

      // ── Intro text ──
      y = wrap(
        'Based on your assessment, here are personalised next steps to support your growth:',
        ML, y, CW, 9, textMd
      );
      y += 4;

      // ── Recommendations ──
      rieRecommendations.forEach((rec, i) => {
        const col = DOMAIN_COLORS[rec.domain] || navy;

        // Pre-measure wrapped text to compute dynamic card height
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(rec.title, CW - 20);
        const titleH = titleLines.length * 4.6;

        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
        const outLines = doc.splitTextToSize(rec.expected_outcome, CW - 20);
        const outH = outLines.length * 4.0;

        // top-pad(5) + title + gap(2) + outcome + gap(3) + timing-row(5) + bottom-pad(4)
        const cardH = Math.max(28, 5 + titleH + 2 + outH + 3 + 5 + 4);

        checkPage(cardH + 4);

        // Card background + left accent bar + card fill
        doc.setFillColor(...col); doc.roundedRect(ML, y, 2.5, cardH, 1, 1, 'F');
        doc.setFillColor(255, 255, 255); doc.roundedRect(ML + 2.5, y, CW - 2.5, cardH, 0, 1, 'F');
        doc.setDrawColor(...col); doc.setLineWidth(0.2);
        doc.roundedRect(ML, y, CW, cardH, 1, 1, 'S');

        // Step number circle
        doc.setFillColor(...col);
        doc.circle(ML + 9, y + 8, 3.5, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
        doc.text(String(i + 1), ML + 9, y + 9.3, { align: 'center' });

        // Title
        let cy = y + 7;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...col);
        doc.text(titleLines, ML + 16, cy);
        cy += titleH + 2;

        // Outcome
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMd);
        doc.text(outLines, ML + 16, cy);
        cy += outH + 3;

        // Timing & intensity row
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text(`Timing: ${rec.timing}`, ML + 16, cy);
        const timW = doc.getTextWidth(`Timing: ${rec.timing}`);
        doc.text(`·  ${rec.intensity} intensity`, ML + 16 + timW + 2, cy);

        y += cardH + 4;
      });

      // ── Escalation note (if present) ──
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

      // ── Footer ──
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...navyBg); doc.rect(0, 283, PW, 14, 'F');
        doc.setDrawColor(...navyBdr); doc.setLineWidth(0.3); doc.line(0, 283, PW, 283);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMu);
        doc.text('MetryxOne · Behavioural Intelligence Platform · metryx.one', ML, 290);
        doc.text('Confidential — for personal use only', PW - MR, 290, { align: 'right' });
      }

      const concern = capadexReport?.concernName || 'ActionPlan';
      const safe = concern.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      doc.save(`MetryxOne_ActionPlan_${safe}.pdf`);
    } catch (err) {
      console.error('Action plan PDF error:', err);
    } finally {
      setRieActionPlanPdfLoading(false);
    }
  };

  const computeResults = (): { domains: DomainResult[]; overallPct: number; overallLevel: string } => {
    const domains: DomainResult[] = questions.map(q => {
      const score = answers[q.id] || 0;
      const percentage = Math.round((score / 5) * 100);
      const { level, color } = getLevel(percentage);
      return { domain: q.domain, label: q.domainLabel, score, percentage, level, color };
    });
    const answeredValues = Object.values(answers);
    const totalScore = answeredValues.reduce((a, b) => a + b, 0);
    const overallPct = answeredValues.length > 0 ? Math.round((totalScore / (answeredValues.length * 5)) * 100) : 0;
    const overallLevel = overallPct >= 80 ? "Strong" : overallPct >= 60 ? "On Track" : overallPct >= 40 ? "Developing" : "Needs Attention";
    return { domains, overallPct, overallLevel };
  };

  const progress = ((currentQ + (answers[questions[currentQ]?.id] ? 1 : 0)) / questions.length) * 100;
  const displaySubject = participantName.trim() || (selectedPersona === 'teacher' ? 'my students' : 'you');
  const lockedDomains = selectedPersona ? LOCKED_DOMAINS_BY_PERSONA[selectedPersona] : LOCKED_DOMAINS_BY_PERSONA.student;

  // All phase props passed to extracted phase components
  const allPhaseProps = {
    phase, setPhase, selectedPersona, setSelectedPersona,
    primaryPersona, setPrimaryPersona, isProxy, setIsProxy, ageBand, setAgeBand,
    participantGender, setParticipantGender, participantCity, setParticipantCity,
    participantGoal, setParticipantGoal, goalTimeline, setGoalTimeline,
    concernMetaMap, setConcernMetaMap,
    currentQ, setCurrentQ,
    answers, setAnswers, participantName, setParticipantName, contextField, setContextField,
    regEmail, setRegEmail, selectedConcern, setSelectedConcern, selectedConcerns, setSelectedConcerns, concernSearch,
    setConcernSearch, concernSuggestions, concernPersonaFallback, showConcernSugg, setShowConcernSugg,
    concernLoading, concernHighlight, setConcernHighlight, famTermIdx, famTermVisible,
    userAge, setUserAge, assesseeType, setAssesseeType, requesterName, setRequesterName,
    runtimeContext, setRuntimeContext,
    capadexSessionId, capadexStage, capadexStageIndex, capadexStageColor, capadexItems,
    capadexAnswers, capadexCurrentQ, setCapadexCurrentQ, capadexStageResult, capadexProgress, capadexLoading,
    capadexError, concernIntelligence, analyzeStep, clarifyAnswers, clarifyCurrentQ,
    capadexRegEmail, setCapadexRegEmail, capadexPassword, setCapadexPassword,
    capadexShowPass, setCapadexShowPass, capadexRegLoading, capadexRegError,
    setCapadexRegError, capadexLoginMode, setCapadexLoginMode, capadexLoginOtpSent,
    capadexLoginOtpLoading, capadexLoginOtpError, capadexExistingName,
    capadexOtpDigits, setCapadexOtpDigits, capadexOtpLoading, capadexOtpError,
    capadexOtpTimer, capadexOtpRefs, capadexReturnEmail, setCapadexReturnEmail,
    capadexStageCheck, capadexStageCheckLoading, capadexSkipIntent, setCapadexSkipIntent,
    capadexUser, capadexReport, rieRecommendations, rieHasEscalation,
    paymentStageData, selectedTier, setSelectedTier, upgradeGoal, setUpgradeGoal,
    upgradeUrgency, setUpgradeUrgency, otpRefs, otpDigits, setOtpDigits, otpLoading,
    otpError, otpResendTimer, regLoading, regName, setRegName, regPhone, setRegPhone,
    emailExistsName, handleAnalyseConcern, handleClarifyAnswer, handleClarifyBack, handleBeginAssessment,
    handleCapadexAnswer, handleCompleteStage, handleContinueToNextStage, handleClose,
    handleAnswer, handleRegisterSubmit, handleOtpVerify, handleResendOtp,
    handleStageCheck, handleSkipToNextStage, handleCapadexRegister,
    handleCapadexLoginOtpSend, handleCapadexOtpVerify, handleCapadexOtpResend,
    handlePaymentProceed, questions, persona, computeResults,
    deepLinkError, onNavigate,
    progress, concernWrapRef, setConcernLoading, setConcernSuggestions,
    reportTab, setReportTab,
    handleCapadexPdf, capadexPdfLoading, capadexPdfBlobUrl, capadexPdfFilename, capadexPdfError,
    handleCapadexEmailReport, capadexEmailLoading, capadexEmailSent,
    handlePaymentConfirm, paymentConfirmLoading,
    handleViewCurrentReport,
    capadexPricing, handleUnlockRequest,
    retrieveReportMode, setRetrieveReportMode,
    recentSessions, recentSessionsLoading,
    handleLoadPreviousReport,
    introEmailStatus, introEmailName, introEmailVerified, introOtpSent,
    introOtpDigits, setIntroOtpDigits, introOtpLoading, introOtpError,
    introOtpTimer, introOtpRefs,
    handleIntroEmailCheck, handleIntroSendOtp, handleIntroOtpVerify, handleIntroOtpResend,
    returningIntent,
    setReturningIntent: (intent: 'resume' | 'report' | null) => {
      if (intent !== null) {
        setIntroEmailVerified(false);
        setIntroOtpSent(false);
        setIntroOtpDigits(['', '', '', '', '', '']);
        setIntroOtpError(null);
      }
      setReturningIntent(intent);
    },
    savedSession, handleResumeSession, handleDismissResume,
    incompleteSession, continueLoading, handleContinueIncomplete, handleStartFresh,
  };


  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl w-full p-0 gap-0 border-0 rounded-2xl [&>button]:hidden max-h-[95vh] flex flex-col overflow-hidden"
        data-testid="free-assessment-modal"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Radix a11y: DialogContent requires a Title + Description for screen
            readers. Visually hidden (sr-only) — visual headings live inside
            each phase component. */}
        <DialogTitle className="sr-only">CAPADEX Behavioural Assessment</DialogTitle>
        <DialogDescription className="sr-only">
          Free behavioural intelligence assessment — choose your persona, share your
          concern, and get a confidential clarity report.
        </DialogDescription>

        {/* ─── INTRO ─── */}
        {/* Deep-link loading overlay — shown while fetching report from email link */}
        {deepLinkLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
            <div className="w-10 h-10 rounded-full border-3 border-[#344E86] border-t-transparent animate-spin" />
            <p className="text-[14px] font-medium" style={{ color: '#344E86' }}>Loading your report…</p>
          </div>
        )}

        {phase === "intro" && <IntroPhase {...allPhaseProps} />}
        {/* ─── QUESTIONS ─── */}
        {phase === "questions" && <QuestionsPhase {...allPhaseProps} />}
        {/* ─── CAPADEX ANALYZE ─── */}
        {phase === "capadex_analyze" && <CapadexAnalyzePhase {...allPhaseProps} />}
        {/* ─── CAPADEX CLARIFY ─── */}
        {phase === "capadex_clarify" && <CapadexClarifyPhase {...allPhaseProps} />}
        {/* ─── CAPADEX BRIDGE ─── */}
        {phase === "capadex_bridge" && <CapadexBridgePhase {...allPhaseProps} />}
        {/* ─── CAPADEX PACKAGE SELECTION ─── */}
        {phase === "capadex_packages" && <CapadexPackageSelectionPhase {...allPhaseProps} />}
        {/* ─── CAPADEX PREVIEW ─── */}
        {phase === "capadex_preview" && <CapadexPreviewPhase {...allPhaseProps} />}
        {/* ─── CAPADEX PRE-ASSESSMENT PROFILING ─── */}
        {phase === "capadex_cur_profile" && <CapadexCurProfilePhase {...allPhaseProps} />}
        {phase === "capadex_ins_profile" && <CapadexInsProfilePhase {...allPhaseProps} />}
        {phase === "capadex_grw_profile" && <CapadexGrwProfilePhase {...allPhaseProps} />}
        {phase === "capadex_mas_profile" && <CapadexMasProfilePhase {...allPhaseProps} />}
        {/* ─── CAPADEX QUESTIONS ─── */}
        {phase === "capadex_q" && (
          <>
            {showPacingCue && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
                style={{ background: 'rgba(52,78,134,0.96)', maxWidth: 380 }}>
                <span className="text-lg">🧘</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium leading-snug">Take your time — there's no rush.</p>
                  <p className="text-blue-200 text-xs mt-0.5">You can pause and continue at any moment.</p>
                </div>
                <button onClick={() => setShowPacingCue(false)}
                  className="text-blue-300 hover:text-white transition-colors text-base font-bold ml-1 flex-shrink-0"
                  aria-label="Dismiss pacing cue">✕</button>
              </div>
            )}
            <CapadexQPhase {...allPhaseProps} />
          </>
        )}
        {/* ─── CAPADEX STAGE RESULT ─── */}
        {phase === "capadex_result" && <CapadexResultPhase {...allPhaseProps} />}
        {/* ─── CAPADEX SAFETY RELIEF (Module 2 — circuit breaker tripped) ─── */}
        {phase === "capadex_relief" && (
          // ── Soft-landing safety modal (Module 2 — circuit breaker tripped) ──
          //   Replaces the prior rose/amber alert with a grounding sage/teal
          //   palette and a two-track action profile:
          //     · Primary  → direct counsellor routing (high-priority emerald)
          //     · Secondary → in-place breathing exercise (low-friction, no nav)
          //   The breathing card unfolds inline so the user never has to leave
          //   the safe surface to decompress.
          <CapadexReliefModal
            message={safetyIntercept?.message}
            onClose={() => { setSafetyIntercept(null); handleClose(); }}
          />
        )}
        {/* ─── ANALYZING ─── */}
        {phase === "analyzing" && <AnalyzingPhase {...allPhaseProps} />}
        {/* ─── REGISTRATION GATE ─── */}
        {phase === "register" && <RegisterPhase {...allPhaseProps} />}
        {/* ─── OTP VERIFICATION ─── */}
        {phase === "otp" && <OtpPhase {...allPhaseProps} />}
        {/* ─── REPORT ─── */}
        {phase === "report" && <ReportPhase {...allPhaseProps} />}
        {/* ─── CAPADEX REGISTRATION GATE ─── */}
        {phase === "capadex_register" && <CapadexRegisterPhase {...allPhaseProps} />}
        {/* ─── CAPADEX OTP VERIFICATION ─── */}
        {phase === "capadex_otp" && <CapadexOtpPhase {...allPhaseProps} />}
        {/* ─── CAPADEX PAYMENT ─── */}
        {phase === "capadex_payment" && <CapadexPaymentPhase {...allPhaseProps} />}
        {/* ─── CAPADEX REPORT ─── */}
        {phase === "capadex_report" && capadexReport && (
          <CapadexReportPhase
            capadexReport={capadexReport}
            rieRecommendations={rieRecommendations}
            rieHasEscalation={rieHasEscalation}
            rieActionPlanCopied={rieActionPlanCopied}
            setRieActionPlanCopied={setRieActionPlanCopied}
            rieActionPlanPdfLoading={rieActionPlanPdfLoading}
            setRieActionPlanPdfLoading={setRieActionPlanPdfLoading}
            rieActionPlanSharing={rieActionPlanSharing}
            setRieActionPlanSharing={setRieActionPlanSharing}
            rieActionPlanShared={rieActionPlanShared}
            setRieActionPlanShared={setRieActionPlanShared}
            rieActionPlanDesktopCopied={rieActionPlanDesktopCopied}
            capadexRegEmail={capadexRegEmail || capadexUser?.email || ''}
            capadexSessionId={capadexSessionId}
            selectedConcern={selectedConcern}
            participantName={participantName}
            setShowGrowthJourney={setShowGrowthJourney}
            handleClose={handleClose}
            capadexReportRef={capadexReportRef}
            handleCapadexPdf={handleCapadexPdf}
            capadexPdfLoading={capadexPdfLoading}
            capadexPdfBlobUrl={capadexPdfBlobUrl}
            capadexPdfFilename={capadexPdfFilename}
            capadexPdfError={capadexPdfError}
            handleCapadexEmailReport={handleCapadexEmailReport}
            capadexEmailLoading={capadexEmailLoading}
            capadexEmailSent={capadexEmailSent}
            capadexPricing={capadexPricing}
            handleUnlockRequest={handleUnlockRequest}
            counsellorNumber={counsellorNumber}
            recentSessions={recentSessions}
            recentSessionsLoading={recentSessionsLoading}
            handleLoadPreviousReport={handleLoadPreviousReport}
            omegaReport={omegaReport}
            onNavigate={onNavigate}
            claritySource={(concernIntelligence as { clarity_source?: string } | null)?.clarity_source}
            selectedPersona={selectedPersona}
            assesseeType={assesseeType}
            userAge={userAge}
          />
        )}

      </DialogContent>
    </Dialog>

    {/* ── Growth Journey Modal ── */}
    {showGrowthJourney && capadexSessionId && capadexRegEmail && (
      <GrowthJourneyModal
        sessionId={capadexSessionId}
        userName={capadexReport?.participantName || undefined}
        onClose={() => setShowGrowthJourney(false)}
      />
    )}
    </>
  );
}
