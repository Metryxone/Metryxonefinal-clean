/**
 * CAPADEX 3.0 — Program 3 · Phase 3.4 Enterprise Assessment Delivery Engine (Candidate Experience Platform)
 * ───────────────────────────────────────────────────────────────────────────
 * The ONE canonical Assessment Delivery registry — a pure-data, FROZEN model that COMPOSES the
 * EXISTING assessment-runtime services (adaptive-assessment, caf-runtime, dynamic-assessment-runtime,
 * cohort-gating, notification, audit, security) under a single certified layer + an additive `ad_*`
 * overlay. NO duplicate delivery engine, NO V2, NO breaking change.
 *
 * Scope is CANDIDATE EXPERIENCE ONLY — launch · session-mgmt · candidate-experience · question-delivery ·
 * timing · response-mgmt · accessibility · delivery-modes · security · notifications · frontend · APIs.
 * It owns the candidate experience from launch until submission. It does NOT score, run psychometrics,
 * standardize, benchmark, produce norms, AI-interpret, or emit reports/analytics (that is Phase 3.5+).
 *
 * This file is DATA ONLY (no DB, no FS, no side effects). The engine
 * (`services/assessment-delivery-engine.ts`) is the SSoT for "present/absent" — it INDEPENDENTLY
 * verifies every evidence claim here against the live filesystem + DB. The registry only declares
 * the canonical model + the evidence it EXPECTS.
 *
 * SEVEN INDEPENDENT certification dimensions, each reported SEPARATELY and NEVER composited:
 *   delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend.
 *
 * Honesty: null (unknown) ≠ 0 (absent). Coverage (does an implementation exist?) ⟂ Confidence ⟂
 * Adoption (real delivered-session volume) — never composited. Genuine placeholders (coding/video/
 * simulation delivery, hardware proctoring, real adaptive routing) stay honestly PARTIAL + carried as
 * OPEN Future/Low gaps. Never fabricate.
 */

export type AdStatus = 'SUPPORTED' | 'PARTIAL' | 'DEAD_END' | 'MISSING';
export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';
export type AdAxis =
  | 'delivery_engine' | 'candidate_experience' | 'session_management'
  | 'accessibility' | 'security' | 'apis' | 'frontend';

export interface AdEvidence {
  services: string[];
  routes: string[];
  frontend: string[];
  tables: string[];
}

export interface AdDimension {
  key: AdAxis;
  label: string;
  status: AdStatus;
  statusNote: string;
  evidence: AdEvidence;
}

// ─────────────────────────────────────────────────────────────────────────────
// AXES — the seven certification dimensions (declarative descriptors)
// ─────────────────────────────────────────────────────────────────────────────
export const AD_AXES: { key: AdAxis; label: string; question: string }[] = [
  { key: 'delivery_engine', label: 'Delivery Engine / Launch', question: 'Can an assessment be launched & delivered to a candidate end-to-end?' },
  { key: 'candidate_experience', label: 'Candidate Experience', question: 'Does the candidate get welcome/instructions/consent/verify/practice/progress/navigation/completion?' },
  { key: 'session_management', label: 'Session Management', question: 'Can a session start/resume/pause/auto-save/recover/reconnect with timeout/expiry & multi-device?' },
  { key: 'accessibility', label: 'Accessibility', question: 'Is delivery WCAG-aware — keyboard/screen-reader/font/contrast/multi-language/mobile?' },
  { key: 'security', label: 'Assessment Security', question: 'Is the session secured — secure link/session validation/copy-prevention/multi-login/audit events?' },
  { key: 'apis', label: 'Delivery APIs', question: 'Do launch/session/response/progress/submission/notification APIs exist?' },
  { key: 'frontend', label: 'Candidate Frontend', question: 'Is there a candidate player UI (landing/player/timer/nav/progress/accessibility/completion)?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN sub-inventories (pure catalogs — status-only)
// ─────────────────────────────────────────────────────────────────────────────
export interface CatalogItem { key: string; label: string; status: AdStatus; note: string }

// Candidate-experience steps (11) — the ordered candidate journey from landing to completion
export const CANDIDATE_EXPERIENCE_STEPS: CatalogItem[] = [
  { key: 'welcome', label: 'Welcome screen', status: 'SUPPORTED', note: 'Landing/intro screen (AssessmentPage + IntroPhase).' },
  { key: 'instructions', label: 'Instructions', status: 'SUPPORTED', note: 'Per-assessment instruction screen bound from delivery config.' },
  { key: 'consent', label: 'Consent', status: 'SUPPORTED', note: 'Consent capture reuses consent_logs (lawful basis / purpose).' },
  { key: 'profile_verification', label: 'Profile verification', status: 'SUPPORTED', note: 'Candidate identity/profile confirm at session start.' },
  { key: 'language_selection', label: 'Language selection', status: 'SUPPORTED', note: 'Multi-language selection bound to delivery config.' },
  { key: 'accessibility_options', label: 'Accessibility options', status: 'SUPPORTED', note: 'Font scaling / contrast / keyboard options at start.' },
  { key: 'practice_questions', label: 'Practice questions', status: 'SUPPORTED', note: 'Optional warm-up before scored delivery.' },
  { key: 'progress_tracking', label: 'Progress tracking', status: 'SUPPORTED', note: 'Answered/remaining progress surfaced continuously.' },
  { key: 'question_navigation', label: 'Question navigation', status: 'SUPPORTED', note: 'Next/prev/jump within delivery rules.' },
  { key: 'section_navigation', label: 'Section navigation', status: 'SUPPORTED', note: 'Section-to-section movement per structure rules.' },
  { key: 'completion_screen', label: 'Completion screen', status: 'SUPPORTED', note: 'Submission confirmation screen at end of delivery.' },
];

// Delivery modes (6) — the kinds of assessment that can be delivered
export const DELIVERY_MODES: CatalogItem[] = [
  { key: 'academic', label: 'Academic / exam', status: 'SUPPORTED', note: 'MCQ/structured exam delivery (caf-runtime / dynamic-assessment-runtime).' },
  { key: 'psychometric', label: 'Psychometric / behavioural', status: 'SUPPORTED', note: 'CAPADEX behavioural session delivery (capadex_sessions).' },
  { key: 'survey', label: 'Survey / questionnaire', status: 'SUPPORTED', note: 'Non-scored questionnaire delivery via the same session runtime.' },
  { key: 'coding', label: 'Coding assessment', status: 'PARTIAL', note: 'PLACEHOLDER — no code editor / execution sandbox at delivery time (Future).' },
  { key: 'video', label: 'Video / recorded response', status: 'PARTIAL', note: 'PLACEHOLDER — reuses the employer voice/avatar seam; not a first-class delivery mode here (Future).' },
  { key: 'simulation', label: 'Simulation / task-based', status: 'PARTIAL', note: 'PLACEHOLDER — no interactive simulation runner at delivery time (Future).' },
];

// Question-delivery modes (7) — how questions are ordered/served within a session
export const QUESTION_DELIVERY_MODES: CatalogItem[] = [
  { key: 'sequential', label: 'Sequential', status: 'SUPPORTED', note: 'Ordered delivery in structure order.' },
  { key: 'randomized', label: 'Randomized', status: 'SUPPORTED', note: 'Shuffle order per session (caf randomization rules).' },
  { key: 'question_pools', label: 'Question pools', status: 'SUPPORTED', note: 'Draw-N-of-M pool per section at session start.' },
  { key: 'mandatory', label: 'Mandatory questions', status: 'SUPPORTED', note: 'Required-answer enforcement before advance/submit.' },
  { key: 'optional', label: 'Optional questions', status: 'SUPPORTED', note: 'Skippable questions per delivery rules.' },
  { key: 'section_rules', label: 'Section rules', status: 'SUPPORTED', note: 'Per-section min/max/select enforcement at delivery.' },
  { key: 'adaptive', label: 'Adaptive routing', status: 'PARTIAL', note: 'PLACEHOLDER — real per-response difficulty routing depends on the Phase 3.5 scoring engine (Future).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FROZEN control groups (evidence-verified — each has evidence[] the engine checks)
// ─────────────────────────────────────────────────────────────────────────────
export interface AdControl { key: string; label: string; status: AdStatus; evidence: string[] }

// Launch modes (6)
export const LAUNCH_MODES: AdControl[] = [
  { key: 'invite', label: 'Invite (candidate)', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches', 'test_assignments'] },
  { key: 'public_link', label: 'Public link', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
  { key: 'secure_link', label: 'Secure (tokenized) link', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
  { key: 'scheduled', label: 'Scheduled window', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
  { key: 'token_access', label: 'Token / access code', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
  { key: 'qr_code', label: 'QR-code entry', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
];

// Session capabilities (9)
export const SESSION_CAPABILITIES: AdControl[] = [
  { key: 'start', label: 'Start session', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions', 'capadex_sessions'] },
  { key: 'resume', label: 'Resume session', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
  { key: 'pause', label: 'Pause session', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
  { key: 'auto_save', label: 'Auto-save', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses', 'capadex_responses'] },
  { key: 'recover', label: 'Recover / restore', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
  { key: 'reconnect', label: 'Reconnect', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions', 'express_sessions'] },
  { key: 'timeout', label: 'Timeout handling', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
  { key: 'expiry', label: 'Expiry handling', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions', 'ad_launches'] },
  { key: 'multi_device', label: 'Multi-device continuity', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions', 'express_sessions'] },
];

// Timing capabilities (6)
export const TIMING_CAPS: AdControl[] = [
  { key: 'assessment_timer', label: 'Assessment timer', status: 'SUPPORTED', evidence: ['components/exam-ready/components/Timer.tsx', 'ad_sessions'] },
  { key: 'section_timer', label: 'Section timer', status: 'SUPPORTED', evidence: ['components/exam-ready/components/Timer.tsx', 'ad_sessions'] },
  { key: 'question_timer', label: 'Question timer', status: 'SUPPORTED', evidence: ['components/exam-ready/components/Timer.tsx', 'ad_sessions'] },
  { key: 'countdown', label: 'Countdown display', status: 'SUPPORTED', evidence: ['components/exam-ready/components/Timer.tsx'] },
  { key: 'grace_period', label: 'Grace period', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
  { key: 'auto_submit', label: 'Auto-submit on expiry', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
];

// Response-management capabilities (6)
export const RESPONSE_CAPS: AdControl[] = [
  { key: 'save', label: 'Save response', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses'] },
  { key: 'update', label: 'Update response', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses'] },
  { key: 'draft', label: 'Draft (unsubmitted)', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses'] },
  { key: 'final_submission', label: 'Final submission', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses', 'capadex_responses'] },
  { key: 'offline_buffer', label: 'Offline buffer', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses'] },
  { key: 'recovery', label: 'Response recovery', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_responses'] },
];

// Accessibility capabilities (7)
export const ACCESSIBILITY_CAPS: AdControl[] = [
  { key: 'wcag', label: 'WCAG-aware markup', status: 'SUPPORTED', evidence: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/QuestionRenderer.tsx'] },
  { key: 'keyboard_navigation', label: 'Keyboard navigation', status: 'SUPPORTED', evidence: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/QuestionRenderer.tsx'] },
  { key: 'screen_reader', label: 'Screen-reader labels', status: 'SUPPORTED', evidence: ['components/exam-ready/components/QuestionRenderer.tsx'] },
  { key: 'font_scaling', label: 'Font scaling', status: 'SUPPORTED', evidence: ['components/exam-ready/pages/AssessmentPage.tsx'] },
  { key: 'contrast', label: 'Contrast options', status: 'SUPPORTED', evidence: ['components/exam-ready/pages/AssessmentPage.tsx'] },
  { key: 'multi_language', label: 'Multi-language', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
  { key: 'mobile_responsive', label: 'Mobile responsive', status: 'SUPPORTED', evidence: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/QuestionRenderer.tsx'] },
];

// Security controls (6)
export const SECURITY_CONTROLS: AdControl[] = [
  { key: 'secure_session', label: 'Secure (tokenized) session', status: 'SUPPORTED', evidence: ['services/security-middleware.ts', 'services/assessment-delivery-mechanisms.ts', 'ad_launches'] },
  { key: 'session_validation', label: 'Session validation', status: 'SUPPORTED', evidence: ['services/security-middleware.ts', 'services/assessment-delivery-mechanisms.ts', 'ad_sessions'] },
  { key: 'multiple_login_detection', label: 'Multiple-login detection', status: 'SUPPORTED', evidence: ['services/assessment-delivery-mechanisms.ts', 'ad_events', 'ad_sessions'] },
  { key: 'copy_prevention', label: 'Copy / paste prevention', status: 'SUPPORTED', evidence: ['components/exam-ready/pages/AssessmentPage.tsx', 'ad_events'] },
  { key: 'audit_events', label: 'Delivery audit events', status: 'SUPPORTED', evidence: ['services/governance/unified-audit-trail.ts', 'ad_events', 'admin_audit_logs'] },
  { key: 'browser_lockdown', label: 'Browser lockdown / proctoring', status: 'PARTIAL', evidence: ['components/exam-ready/pages/AssessmentPage.tsx', 'ad_events'] },
];

// Notification types (6)
export const NOTIFICATION_TYPES: AdControl[] = [
  { key: 'invitation', label: 'Invitation', status: 'SUPPORTED', evidence: ['services/notification-engine-shared.ts', 'ad_notifications'] },
  { key: 'reminder', label: 'Reminder', status: 'SUPPORTED', evidence: ['services/notification-engine-shared.ts', 'ad_notifications'] },
  { key: 'started', label: 'Started confirmation', status: 'SUPPORTED', evidence: ['services/notification-engine-shared.ts', 'ad_notifications'] },
  { key: 'completed', label: 'Completed confirmation', status: 'SUPPORTED', evidence: ['services/notification-engine-shared.ts', 'ad_notifications'] },
  { key: 'timeout_warning', label: 'Timeout warning', status: 'SUPPORTED', evidence: ['services/notification-engine-shared.ts', 'ad_notifications'] },
  { key: 'submission_confirmation', label: 'Submission confirmation', status: 'SUPPORTED', evidence: ['services/notification-engine-shared.ts', 'ad_notifications', 'notifications'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING MODEL (10) — every delivery maps to the platform's canonical dimensions
// ─────────────────────────────────────────────────────────────────────────────
export interface MappingRow { key: string; label: string; target: string; source: string; status: AdStatus; note: string }
export const MAPPING_MODEL: MappingRow[] = [
  { key: 'authored_assessment', label: 'Authored assessment', target: 'Assessment Builder (3.3)', source: 'config/assessment-builder.ts', status: 'SUPPORTED', note: 'Delivery serves an assessment authored by the 3.3 builder (author→deliver handoff).' },
  { key: 'question_library', label: 'Question library', target: 'Question Management Platform (3.2)', source: 'config/question-management-platform.ts', status: 'SUPPORTED', note: 'Questions delivered are drawn from the canonical library.' },
  { key: 'personas', label: 'Personas', target: 'Persona model', source: 'config/customer-journey.ts', status: 'SUPPORTED', note: 'Delivery experience framed per persona (student/jobseeker/professional/…).' },
  { key: 'lifecycle', label: 'Lifecycle', target: 'Lifecycle stages', source: 'lib/lifecycle.ts', status: 'SUPPORTED', note: 'Delivery is the entry/baseline/diagnostic/re-measure touchpoint of the lifecycle.' },
  { key: 'customer_journey', label: 'Customer journey', target: 'Journey spine', source: 'config/customer-journey.ts', status: 'SUPPORTED', note: 'Delivery is the entry_assessment / re_measure step of the journey spine.' },
  { key: 'cohorts', label: 'Cohorts / batches', target: 'Cohort gating', source: 'services/cohort-gating.ts', status: 'SUPPORTED', note: 'Launch is scoped to cohorts/batches via cohort gating + test_assignments.' },
  { key: 'consent', label: 'Consent', target: 'Consent ledger', source: 'consent_logs', status: 'SUPPORTED', note: 'Candidate consent captured at delivery start (reuse consent ledger).' },
  { key: 'notifications', label: 'Notifications', target: 'Notification engine', source: 'services/notification-engine-shared.ts', status: 'SUPPORTED', note: 'Delivery lifecycle emits invitation/reminder/completion notifications.' },
  { key: 'audit', label: 'Audit trail', target: 'Unified audit trail', source: 'services/governance/unified-audit-trail.ts', status: 'SUPPORTED', note: 'Delivery + security events routed to the audit trail.' },
  { key: 'scoring_handoff', label: 'Scoring handoff', target: 'Scoring Engine (3.5)', source: 'config/assessment-delivery.ts', status: 'PARTIAL', note: 'Delivery ends at final submission; scoring/psychometrics/reports are the Phase 3.5 scope (out of this engine).' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEVEN certification DIMENSIONS — evidence anchored in REAL substrate + own overlay
// ─────────────────────────────────────────────────────────────────────────────
export const AD_DIMENSIONS: AdDimension[] = [
  {
    key: 'delivery_engine', label: 'Delivery Engine / Launch', status: 'SUPPORTED',
    statusNote: 'ONE canonical delivery/launch layer (ad_launches) composing the existing assessment runtimes (adaptive-assessment, caf-runtime, dynamic-assessment-runtime) + cohort gating — invite/link/secure/scheduled/token/qr launch, no duplicate delivery engine.',
    evidence: {
      services: ['services/adaptive-assessment.ts', 'services/cohort-gating.ts', 'services/assessment-delivery-engine.ts', 'services/assessment-delivery-mechanisms.ts'],
      routes: ['routes/adaptive-assessment.ts', 'routes/caf-runtime.ts', 'routes/dynamic-assessment-runtime.ts', 'routes/assessment-delivery.ts'],
      frontend: ['components/exam-ready/pages/AssessmentPage.tsx', 'pages/JoinSessionPage.tsx'],
      tables: ['capadex_sessions', 'test_assignments', 'batches', 'ad_launches'],
    },
  },
  {
    key: 'candidate_experience', label: 'Candidate Experience', status: 'SUPPORTED',
    statusNote: 'Eleven-step candidate journey (welcome→instructions→consent→verify→language→accessibility→practice→progress→navigation→section-navigation→completion) composing the existing candidate player + consent ledger.',
    evidence: {
      services: ['services/assessment-delivery-mechanisms.ts'],
      routes: ['routes/assessment-delivery.ts'],
      frontend: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/QuestionRenderer.tsx', 'components/assessment'],
      tables: ['capadex_sessions', 'consent_logs', 'ad_sessions'],
    },
  },
  {
    key: 'session_management', label: 'Session Management', status: 'SUPPORTED',
    statusNote: 'start/resume/pause/auto-save/recover/reconnect/timeout/expiry/multi-device over the ad_sessions overlay, composing the existing session runtime + express session store.',
    evidence: {
      services: ['services/assessment-delivery-mechanisms.ts'],
      routes: ['routes/assessment-delivery.ts'],
      frontend: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/Timer.tsx'],
      tables: ['capadex_sessions', 'express_sessions', 'ad_sessions', 'ad_responses'],
    },
  },
  {
    key: 'accessibility', label: 'Accessibility', status: 'SUPPORTED',
    statusNote: 'WCAG-aware candidate player — keyboard/screen-reader/font-scaling/contrast/multi-language/mobile-responsive delivery.',
    evidence: {
      services: ['services/assessment-delivery-mechanisms.ts'],
      routes: [],
      frontend: ['components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/QuestionRenderer.tsx'],
      tables: [],
    },
  },
  {
    key: 'security', label: 'Assessment Security', status: 'SUPPORTED',
    statusNote: 'Secure tokenized session + session validation + multiple-login detection + copy-prevention + delivery audit events (ad_events) composing security-middleware + unified audit trail. Browser lockdown / hardware proctoring is an honest PARTIAL placeholder.',
    evidence: {
      services: ['services/security-middleware.ts', 'services/governance/unified-audit-trail.ts', 'services/assessment-delivery-mechanisms.ts'],
      routes: ['routes/assessment-delivery.ts'],
      frontend: ['components/exam-ready/pages/AssessmentPage.tsx'],
      tables: ['admin_audit_logs', 'ad_events'],
    },
  },
  {
    key: 'apis', label: 'Delivery APIs', status: 'SUPPORTED',
    statusNote: 'launch/session/response/progress/submission/notification endpoints under /api/admin/assessment-delivery, composing the existing runtime routes.',
    evidence: {
      services: ['services/assessment-delivery-engine.ts'],
      routes: ['routes/assessment-delivery.ts', 'routes/adaptive-assessment.ts', 'routes/caf-runtime.ts', 'routes/dynamic-assessment-runtime.ts'],
      frontend: [],
      tables: [],
    },
  },
  {
    key: 'frontend', label: 'Candidate Frontend', status: 'SUPPORTED',
    statusNote: 'Super-admin certification console + reused candidate player (landing/player/timer/nav/progress/accessibility/completion surfaces).',
    evidence: {
      services: [],
      routes: [],
      frontend: ['components/superadmin/AssessmentDeliveryPanel.tsx', 'components/exam-ready/pages/AssessmentPage.tsx', 'components/exam-ready/components/Timer.tsx', 'components/exam-ready/components/QuestionRenderer.tsx', 'pages/JoinSessionPage.tsx'],
      tables: [],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONS — the frozen design decisions taken for this phase
// ─────────────────────────────────────────────────────────────────────────────
export interface AdDecision { id: string; title: string; decision: string; rationale: string }
export const AD_DECISIONS: AdDecision[] = [
  { id: 'AD-D1', title: 'Reuse-before-build, no duplicate delivery engine', decision: 'COMPOSE the existing runtimes (adaptive-assessment, caf-runtime, dynamic-assessment-runtime) under one certified layer + an additive ad_* overlay; do NOT fork a second delivery engine.', rationale: 'Additive/enhancement-only mandate; a parallel runtime would drift + double-maintain.' },
  { id: 'AD-D2', title: 'Scope is candidate experience only', decision: 'This engine owns launch→submission. Scoring, psychometrics, standardization, norms, benchmarking, AI-interpretation, reports & analytics are explicitly OUT (Phase 3.5+).', rationale: 'Clean seam between delivery and scoring; the scoring_handoff mapping row is the honest boundary marker.' },
  { id: 'AD-D3', title: 'Flag-gated, byte-identical OFF incl. schema', decision: 'All ad_* DDL runs ONLY on the flag-gated write paths (assertEnabled → ensureAdSchema). OFF creates 0 tables and every route 503s (503-before-auth).', rationale: 'Zero blast radius when OFF; identical to prior CAPADEX 3.0 phases.' },
  { id: 'AD-D4', title: 'Seven dimensions certified SEPARATELY', decision: 'delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend are reported independently; Coverage⟂Confidence⟂Adoption never composited.', rationale: 'Honesty mandate — a composite score hides a weak axis.' },
  { id: 'AD-D5', title: 'Genuine placeholders stay honestly PARTIAL + OPEN gaps', decision: 'Coding/video/simulation delivery, adaptive routing, and browser lockdown/hardware proctoring stay PARTIAL and are carried as OPEN Future/Low gaps — not silently claimed SUPPORTED.', rationale: 'Never inflate; these are real deferrals (adaptive routing depends on 3.5).' },
  { id: 'AD-D6', title: 'Adoption is a separate axis, never a gap', decision: 'Real delivered-session volume across the ad_* overlay is reported SEPARATELY. null (unreadable) ≠ 0 (empty); an axis being SUPPORTED with 0 adoption is honest, not a gap.', rationale: 'Engineering closure ⟂ adoption; overlay is empty until the flag runs its write paths.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GAPS — OPEN (genuine deferrals) + RESOLVED (engineering-closed via reuse)
// ─────────────────────────────────────────────────────────────────────────────
export interface AdGap { id: string; severity: GapSeverity; dimension: AdAxis; summary: string; mechanism?: string }

// OPEN gaps — genuine deferrals, none Launch-Critical. Kept honest, not padded.
export const AD_GAPS: AdGap[] = [
  { id: 'GAP-AD-1', severity: 'Future', dimension: 'delivery_engine', summary: 'Coding-assessment delivery mode (in-browser code editor + execution sandbox) is a placeholder — no runner at delivery time.' },
  { id: 'GAP-AD-2', severity: 'Future', dimension: 'delivery_engine', summary: 'Video / simulation delivery modes are placeholders — recorded-response + interactive-simulation runners are not first-class here.' },
  { id: 'GAP-AD-3', severity: 'Future', dimension: 'delivery_engine', summary: 'Real adaptive per-response routing depends on the Phase 3.5 scoring engine; delivery exposes the seam but cannot route on ability yet.' },
  { id: 'GAP-AD-4', severity: 'Low', dimension: 'security', summary: 'Browser lockdown / hardware proctoring (webcam, screen-lock, secure browser) is a placeholder — copy-prevention + audit events exist, but no OS-level lockdown.' },
];

// RESOLVED gaps — the true engineering gaps, CLOSED via reuse-before-build additive overlay.
export const RESOLVED_AD_GAPS: AdGap[] = [
  { id: 'AD-1', severity: 'High', dimension: 'delivery_engine', summary: 'No unified launch record across invite/link/secure/scheduled/token/qr.', mechanism: 'ad_launches overlay + composeLaunchModes (reuse test_assignments + cohort gating).' },
  { id: 'AD-2', severity: 'High', dimension: 'session_management', summary: 'No unified session lifecycle (resume/pause/auto-save/recover/reconnect/timeout/expiry/multi-device).', mechanism: 'ad_sessions overlay + session mechanisms (reuse capadex_sessions + express_sessions).' },
  { id: 'AD-3', severity: 'Medium', dimension: 'candidate_experience', summary: 'Candidate journey (welcome→consent→verify→practice→completion) not certified as one canonical flow.', mechanism: '11-step CANDIDATE_EXPERIENCE_STEPS catalog over the reused player + consent ledger.' },
  { id: 'AD-4', severity: 'Medium', dimension: 'security', summary: 'Delivery security events (secure session/validation/multi-login/copy-prevention) not captured as a delivery-scoped ledger.', mechanism: 'ad_events overlay + composeSecurityControls (reuse security-middleware + unified audit trail).' },
  { id: 'AD-5', severity: 'Medium', dimension: 'apis', summary: 'No unified delivery API surface (launch/session/response/progress/submission/notification).', mechanism: 'routes/assessment-delivery.ts composing the existing runtime routes under one gated surface.' },
  { id: 'AD-6', severity: 'Low', dimension: 'frontend', summary: 'No single delivery certification console.', mechanism: 'components/superadmin/AssessmentDeliveryPanel.tsx reusing the candidate player surfaces.' },
  { id: 'AD-7', severity: 'Low', dimension: 'apis', summary: 'Delivery notifications (invitation/reminder/timeout/completion) not wired to a delivery-scoped ledger.', mechanism: 'ad_notifications overlay + composeNotificationTypes (reuse notification-engine-shared).' },
];
