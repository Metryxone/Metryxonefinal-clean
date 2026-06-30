import React from 'react';
import {
  CapadexQuestion, CapadexProgress, CapadexStageResult, DomainResult, Persona, PersonaKey, Question,
} from '../../lib/behavioural-insights';

export interface ConcernSuggestion {
  // Legacy `concern_areas` rows return numeric ids; master-table rows return
  // numeric ids too (via MIN(id)) — typed as `string | number` so neither path
  // trips the React `key=` typing nor the dedupe Set.
  id: string | number;
  category: string;
  concern_area: string;
  parent_worry: string;
  has_assessment: boolean;
  construct_key: string | null;
  construct_label: string | null;
  construct_cluster: string | null;
  // ── Master-table enrichment (2026-05-28) ────────────────────────────────
  // Present when `source === 'master'`. Powers the chip-click flow that
  // persists canonical identifiers into `concernMetaMap` for the
  // `/api/capadex/concern/analyze` payload (see `IntroPhase.addConcern`).
  concern_id?: string | null;
  domain?: string | null;
  concern_cluster?: string | null;
  impact_on_child?: string | null;
  source?: 'master' | 'legacy';
}

/**
 * Orchestration Context envelope — populated by /api/capadex/concern/analyze
 * (`backend/services/runtime-context.ts`). Encodes the formal actor/target
 * persona + relationship_type derived from (persona, assesseeType, age), so
 * every downstream phase reads one canonical source instead of re-deriving.
 */
export interface RuntimeContext {
  actor_persona: string;
  target_persona: string;
  relationship_type: string;
  target_age: number | null;
  session_id?: string | null;
  persisted?: boolean;
}

export interface ConcernIntelligenceResult {
  category: string;
  severity: string;
  severity_label: string;
  risk_level: string;
  growth_readiness: string;
  emotional_signals: string[];
  detected_patterns: string[];
  subdomains: string[];
  clarification_questions: Array<{ id: string; question: string; options: string[]; response_type?: string }>;
  behavioural_mirror: string[];
  intelligence_preview: string[];
  persona_detected: string;
  prefilled_answers?: Record<number, string>;
  preliminary_patterns?: { patterns: string[]; tags: string[]; source?: string };
  runtime_context?: RuntimeContext;
}

export interface CapadexStageCheck {
  completed: string[];
  has_prior_completion: boolean;
  next_stage_code: string | null;
  next_stage_label: string | null;
  next_stage_index: number;
  next_stage_color: string;
  last_session_id?: string | null;
  existing_persona?: string | null;
  persona_mismatch?: boolean;
}

export interface CapadexUserInfo {
  id: string;
  name: string;
  email: string;
}

export interface CapadexReportData {
  reportId: string;
  concernName: string;
  stageCode: string;
  stageLabel: string;
  score: number;
  rawScore: number;
  scoreLevel: string;
  insight: string;
  scoreOverride: number | null;
  headlineOverride: string | null;
  narrativeOverride: string | null;
  overrideReason: string | null;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  participantName: string;
  participantAge: number | null;
  subdomains: Array<{ subdomain_name: string; avg_score: number; item_count: number }>;
  generatedAt: string;
}

export interface RieRecommendation {
  title: string;
  expected_outcome: string;
  rec_type: string;
  domain: string;
  timing: string;
  intensity: string;
  confidence: number;
}

export interface PaymentStageData {
  code: string;
  name: string;
  price: string;
  color: string;
  bg: string;
  bdr: string;
  benefits: string[];
  note: string;
  waNum: string;
}

export interface CapadexPricingEntry {
  price: string;
  price_note: string;
  tag: string;
  description: string;
  benefits: string[];
  whatsapp_number: string;
}

export interface PhaseProps {
  phase: string;
  setPhase: React.Dispatch<React.SetStateAction<string>>;

  selectedPersona: PersonaKey | null;
  setSelectedPersona: React.Dispatch<React.SetStateAction<PersonaKey | null>>;
  // 2026-05-28 macro-track overhaul: granular sub-persona token + is_proxy
  // flag + age band, lifted from IntroPhase so the /analyze payload envelope
  // can carry the spec-canonical fields.
  primaryPersona: string | null;
  setPrimaryPersona: React.Dispatch<React.SetStateAction<string | null>>;
  // CAPADEX 3.0 Phase 1.2 — when true (personaModelAlignment flag, learned via
  // /api/capadex/public-config) IntroPhase exposes exam-aspirant sub-personas
  // and the bank resolver selects tailored sub-persona banks. Defaults to false
  // (absent) → byte-identical legacy persona behaviour.
  personaModelAlignment?: boolean;
  // CAPADEX 3.0 Persona Model EXPANSION (G-F1/G-F2) — when true
  // (personaModelExpansion flag, learned via /api/capadex/public-config)
  // IntroPhase additionally exposes first-class enterprise sub-personas
  // (People Manager / Senior Leadership / Learning & Development) and a
  // higher-ed Faculty proxy sub-persona, each with tailored banks. Defaults
  // to false (absent) → byte-identical legacy persona behaviour. Independent
  // of personaModelAlignment.
  personaModelExpansion?: boolean;
  isProxy: boolean;
  setIsProxy: React.Dispatch<React.SetStateAction<boolean>>;
  ageBand: string;
  setAgeBand: React.Dispatch<React.SetStateAction<string>>;
  // 2026-05-29 — additive enrichment fields (all optional, none gate the CTA).
  // Shipped to /api/capadex/concern/analyze as additive demographic + goal
  // context. Lifted to FreeAssessmentModal so the payload + reset live in one
  // place alongside the other intro state.
  participantGender: string;
  setParticipantGender: React.Dispatch<React.SetStateAction<string>>;
  participantCity: string;
  setParticipantCity: React.Dispatch<React.SetStateAction<string>>;
  participantGoal: string;
  setParticipantGoal: React.Dispatch<React.SetStateAction<string>>;
  goalTimeline: string;
  setGoalTimeline: React.Dispatch<React.SetStateAction<string>>;
  // Per-concern metadata keyed by the human-readable area string. Populated
  // when the user taps a suggestion chip; carries `concern_id`, `domain`,
  // `concern_cluster` so the /analyze payload can ship the canonical
  // identifiers required by `resolveCapadexConcern()`.
  concernMetaMap: Record<string, { concern_id?: string; domain?: string; concern_cluster?: string; typical_age_band?: string; growth_trend?: string; severity?: string }>;
  setConcernMetaMap: React.Dispatch<React.SetStateAction<Record<string, { concern_id?: string; domain?: string; concern_cluster?: string; typical_age_band?: string; growth_trend?: string; severity?: string }>>>;
  currentQ: number;
  setCurrentQ: React.Dispatch<React.SetStateAction<number>>;
  answers: Record<string, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  participantName: string;
  setParticipantName: React.Dispatch<React.SetStateAction<string>>;
  contextField: string;
  setContextField: React.Dispatch<React.SetStateAction<string>>;
  regEmail: string;
  setRegEmail: React.Dispatch<React.SetStateAction<string>>;

  selectedConcern: string | null;
  setSelectedConcern: React.Dispatch<React.SetStateAction<string | null>>;
  selectedConcerns: string[];
  setSelectedConcerns: React.Dispatch<React.SetStateAction<string[]>>;
  concernSearch: string;
  setConcernSearch: React.Dispatch<React.SetStateAction<string>>;
  concernSuggestions: ConcernSuggestion[];
  // 2026-05-28 — true when the search backend's persona filter yielded zero
  // master rows and re-ran without it. IntroPhase shows an explanatory note
  // so users know the visible results are adjacent, not exact-persona hits.
  concernPersonaFallback: boolean;
  showConcernSugg: boolean;
  setShowConcernSugg: React.Dispatch<React.SetStateAction<boolean>>;
  concernLoading: boolean;
  concernHighlight: number;
  setConcernHighlight: React.Dispatch<React.SetStateAction<number>>;
  famTermIdx: number;
  famTermVisible: boolean;

  userAge: string;
  setUserAge: React.Dispatch<React.SetStateAction<string>>;
  assesseeType: 'myself' | 'my-child' | 'a-student' | 'someone-else' | '';
  setAssesseeType: React.Dispatch<React.SetStateAction<'myself' | 'my-child' | 'a-student' | 'someone-else' | ''>>;
  requesterName: string;
  setRequesterName: React.Dispatch<React.SetStateAction<string>>;

  capadexSessionId: string | null;
  capadexStage: string;
  capadexStageIndex: number;
  capadexStageColor: string;
  capadexItems: CapadexQuestion[];
  capadexAnswers: Record<string, number>;
  capadexCurrentQ: number;
  setCapadexCurrentQ: React.Dispatch<React.SetStateAction<number>>;
  capadexStageResult: CapadexStageResult | null;
  capadexProgress: CapadexProgress[];
  capadexLoading: boolean;
  capadexError: string | null;
  concernIntelligence: ConcernIntelligenceResult | null;
  analyzeStep: number;
  clarifyAnswers: Record<number, string[]>;
  clarifyCurrentQ: number;

  capadexRegEmail: string;
  setCapadexRegEmail: React.Dispatch<React.SetStateAction<string>>;
  capadexPassword: string;
  setCapadexPassword: React.Dispatch<React.SetStateAction<string>>;
  capadexShowPass: boolean;
  setCapadexShowPass: React.Dispatch<React.SetStateAction<boolean>>;
  capadexRegLoading: boolean;
  capadexRegError: string | null;
  setCapadexRegError: React.Dispatch<React.SetStateAction<string | null>>;
  capadexLoginMode: boolean;
  setCapadexLoginMode: React.Dispatch<React.SetStateAction<boolean>>;
  capadexLoginOtpSent: boolean;
  capadexLoginOtpLoading: boolean;
  capadexLoginOtpError: string | null;
  capadexExistingName: string;
  capadexOtpDigits: string[];
  setCapadexOtpDigits: React.Dispatch<React.SetStateAction<string[]>>;
  capadexOtpLoading: boolean;
  capadexOtpError: string | null;
  capadexOtpTimer: number;
  capadexOtpRefs: React.RefObject<HTMLInputElement>[];
  capadexReturnEmail: string;
  setCapadexReturnEmail: React.Dispatch<React.SetStateAction<string>>;
  capadexStageCheck: CapadexStageCheck | null;
  capadexStageCheckLoading: boolean;
  capadexSkipIntent: boolean;
  setCapadexSkipIntent: React.Dispatch<React.SetStateAction<boolean>>;
  capadexUser: CapadexUserInfo | null;
  capadexReport: CapadexReportData | null;
  rieRecommendations: RieRecommendation[];
  rieHasEscalation: boolean;

  paymentStageData: PaymentStageData | null;
  selectedTier: string;
  setSelectedTier: React.Dispatch<React.SetStateAction<string>>;
  upgradeGoal: string;
  setUpgradeGoal: React.Dispatch<React.SetStateAction<string>>;
  upgradeUrgency: string;
  setUpgradeUrgency: React.Dispatch<React.SetStateAction<string>>;

  otpRefs: React.RefObject<HTMLInputElement>[];
  otpDigits: string[];
  setOtpDigits: React.Dispatch<React.SetStateAction<string[]>>;
  otpLoading: boolean;
  otpError: string | null;
  otpResendTimer: number;

  regLoading: boolean;
  regName: string;
  setRegName: React.Dispatch<React.SetStateAction<string>>;
  regPhone: string;
  setRegPhone: React.Dispatch<React.SetStateAction<string>>;
  emailExistsName: string;
  reportTab: string;
  setReportTab: React.Dispatch<React.SetStateAction<string>>;

  progress: number;
  concernWrapRef: React.RefObject<HTMLDivElement>;
  setConcernLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setConcernSuggestions: React.Dispatch<React.SetStateAction<ConcernSuggestion[]>>;

  handleAnalyseConcern: () => void;
  handleClarifyAnswer: (rankedOptions: string[]) => void;
  handleClarifyBack: () => void;
  handleBeginAssessment: () => void;
  handleCapadexAnswer: (itemId: string, value: number) => void;
  handleCompleteStage: () => void;
  handleContinueToNextStage: () => void;
  handleClose: () => void;
  handleAnswer: (value: number) => void;
  handleRegisterSubmit: (e: React.FormEvent) => void;
  handleOtpVerify: () => void;
  handleResendOtp: () => void;
  handleStageCheck: (emailInput: string) => void;
  handleSkipToNextStage: () => void;
  handleCapadexRegister: (e: React.FormEvent) => void;
  handleCapadexLoginOtpSend: () => void;
  handleCapadexOtpVerify: () => void;
  handleCapadexOtpResend: () => void;
  handlePaymentProceed: (tier: string) => void;
  handlePaymentConfirm: () => void;
  paymentConfirmLoading: boolean;
  handleViewCurrentReport: () => void;
  capadexPricing: Record<string, CapadexPricingEntry>;
  handleUnlockRequest: (stageCode: string, stageName: string, price: string, color: string, bg: string, bdr: string, benefits: string[], note: string, waNum: string) => void;

  questions: Question[];
  persona: Persona;
  computeResults: () => { domains: DomainResult[]; overallPct: number; overallLevel: string };

  deepLinkError: string | null;
  onNavigate?: (screen: string) => void;

  handleCapadexPdf: () => void;
  capadexPdfLoading: boolean;
  capadexPdfBlobUrl: string | null;
  capadexPdfFilename: string;
  capadexPdfError: string | null;
  handleCapadexEmailReport: () => void;
  capadexEmailLoading: boolean;
  capadexEmailSent: boolean;

  retrieveReportMode: boolean;
  setRetrieveReportMode: React.Dispatch<React.SetStateAction<boolean>>;
  recentSessions: Array<{
    session_id: string; concern_name: string; stage_code: string;
    score: number | null; score_level: string | null; created_at: string;
  }>;
  recentSessionsLoading: boolean;
  handleLoadPreviousReport: (sessionId: string) => void;

  introEmailStatus: 'idle' | 'checking' | 'returning' | 'new' | 'limited';
  introEmailName: string;
  introEmailVerified: boolean;
  introOtpSent: boolean;
  introOtpDigits: string[];
  setIntroOtpDigits: React.Dispatch<React.SetStateAction<string[]>>;
  introOtpLoading: boolean;
  introOtpError: string | null;
  introOtpTimer: number;
  introOtpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  handleIntroEmailCheck: (email: string, concern: string) => void;
  handleIntroSendOtp: () => void;
  handleIntroOtpVerify: () => void;
  handleIntroOtpResend: () => void;

  returningIntent: 'resume' | 'report' | null;
  setReturningIntent: (intent: 'resume' | 'report' | null) => void;

  savedSession: { concern: string; selectedConcerns: string[]; phase: string; session_id?: string; email: string; timestamp: number } | null;
  handleResumeSession: () => void;
  handleDismissResume: () => void;

  incompleteSession: {
    session_id: string; concern_name: string; answered_items: number;
    total_items: number; updated_at: string;
  } | null;
  continueLoading: boolean;
  handleContinueIncomplete: () => void;
  handleStartFresh: () => void;
}
