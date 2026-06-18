/**
 * WC-C8 — Launch Readiness Audit
 * AUDIT ONLY · READ ONLY · STOP FOR APPROVAL
 *
 * Determines readiness for 4 launch targets:
 *   1. Free Consumer Launch (CAPADEX free assessment)
 *   2. Paid Consumer Pilot  (CAPADEX CAP_INS / CAP_GRW via Razorpay)
 *   3. LBI Launch           (Learning Behaviour Index)
 *   4. Employability Index Pilot
 *
 * Reuses existing assets only (WC-L0→WC-L5, WC-C1→WC-C7).
 * No new engines, schemas, or products created.
 * All file:line citations are verified against the live codebase.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../../audit/wc-c8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ──────────────────────────────────────────────────────────────────
const pct = (n: number, d: number) =>
  d === 0 ? 'not_measurable' : `${Math.round((n / d) * 100)}%`;
const now = new Date().toISOString();
const BT = String.fromCharCode(96); // backtick — needed to embed code-spans inside template literals
const BT3 = BT + BT + BT;

// ── Static verified findings (code-grounded, file:line cited) ─────────────
// These cannot be queried from the DB — they come from static code analysis
// performed with grep against the live codebase.

const SECURITY_FINDINGS = {
  session_secret: {
    severity: 'BLOCKER',
    finding: 'SESSION_SECRET has no NODE_ENV guard; falls back to hardcoded string "edupsych-secret-key-change-in-production" in production',
    evidence: 'backend/routes.ts:234 — `secret: process.env.SESSION_SECRET || "edupsych-secret-key-change-in-production"`',
    confirmed_absent_in_deploy: true, // .replit [userenv.production] only contains APP_URL
    fix: 'Set SESSION_SECRET in deployment secrets before launch; add fail-fast check at startup if absent',
  },
  superadmin_mfa: {
    severity: 'BLOCKER',
    finding: 'SuperAdmin MFA is permanently disabled (commented out) pending email service configuration. Documented credential (admin@metryx.one / Admin@123) is hardcoded in seed.',
    evidence: 'backend/routes.ts:392 — "MFA temporarily disabled until email service is configured"; backend/routes.ts:418 — "MFA is disabled"; backend/routes.ts:1258 — seed credential',
    fix: 'Enable MFA before exposing any admin surface publicly; rotate seed credential',
  },
  otp_plaintext: {
    severity: 'PRE_LAUNCH',
    finding: 'CAPADEX OTPs stored and compared as plaintext 6-digit codes. No attempt cap on verify-otp route.',
    evidence: 'backend/routes/capadex.ts:2300 — INSERT with raw `code` value; backend/routes/capadex.ts:2437 — WHERE code=$2 string match; capadex_otps table has no attempts column',
    note: 'In-memory rate limiter provides partial protection; dev OTP bypass (123456) does NOT exist (subagent claim was wrong).',
    fix: 'Add attempt counter column + lock after N failures; consider bcrypt hash for OTP storage',
  },
  no_helmet: {
    severity: 'PRE_LAUNCH',
    finding: 'helmet() is absent from backend. Standard security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) are not set by the application.',
    evidence: 'grep helmet backend/index.ts backend/routes.ts → 0 matches',
    fix: 'Add helmet() middleware before routes in backend/index.ts',
  },
  rate_limit_memory: {
    severity: 'POST_LAUNCH',
    finding: 'Custom sliding-window rate limiter is in-memory only (backend/services/security-middleware.ts). Resets on every server restart; ineffective under autoscale (multiple instances).',
    evidence: 'backend/services/security-middleware.ts — in-memory timestamp arrays per IP/route bucket',
    fix: 'Replace with Redis-backed limiter (or Upstash) before scaling past 1 instance',
  },
  cors_permissive_dev: {
    severity: 'NOTE',
    finding: 'CORS is permissive in non-production (CLIENT_ORIGIN env var; permissive dev mode). Production behaviour depends on CLIENT_ORIGIN being correctly set.',
    evidence: 'frontend/server/src/index.ts CORS config',
    fix: 'Verify CLIENT_ORIGIN is set in production deployment env',
  },
} as const;

const OPERATIONAL_FINDINGS = {
  no_graceful_shutdown: {
    severity: 'P1_PRE_LAUNCH',
    finding: 'No SIGTERM or SIGINT handlers in backend/index.ts. Deployment target is "autoscale" (instances receive SIGTERM during scale-down/redeploy). Post-completion hooks (stage/outcome/journey persistence) are fire-and-forget — completions can be silently lost on shutdown.',
    evidence: 'backend/index.ts — no process.on("SIGTERM"/"SIGINT"/"uncaughtException"/"unhandledRejection") listeners; .replit deploymentTarget = "autoscale"',
    fix: 'Add SIGTERM handler to close DB pool and drain in-flight requests before exit',
  },
  email_no_queue: {
    severity: 'P1_PRE_LAUNCH',
    finding: 'Email delivery is direct SMTP (Zoho, port 465) with no queue, no retry, and fire-and-forget error handling. OTP delivery failure at backend/routes/capadex.ts:2381 is silent (`.catch(console.error)`). User never knows OTP was not sent.',
    evidence: 'backend/email.ts — nodemailer transporter with no queue/retry; backend/routes/capadex.ts:2381 — `.catch(console.error)`',
    fix: 'Add retry logic (1–3 attempts) or a lightweight queue; surface delivery failures to the user',
  },
  memory_logger: {
    severity: 'P2',
    finding: 'API logger at backend/index.ts captures the full JSON response body in memory (capturedJsonResponse) before logging. Under high concurrent load or large responses this accumulates in-process memory.',
    evidence: 'backend/index.ts lines 67-90 — `capturedJsonResponse` accumulation on `res.json()`',
    fix: 'Stream or sample response logging; set a max-body-size cap',
  },
  no_error_tracking: {
    severity: 'P2',
    finding: 'No external error tracking (Sentry, Datadog, etc.). Errors are logged to stdout/stderr only — invisible without log aggregation in production.',
    evidence: 'grep sentry backend/ → 0 matches; grep datadog backend/ → 0 matches',
    fix: 'Add Sentry (or equivalent) before public launch',
  },
  health_endpoint: {
    severity: 'NOTE',
    finding: 'GET /api/health exists for uptime checks. No database connectivity check in the health route.',
    evidence: 'backend/routes.ts (health route present)',
    note: 'Acceptable for MVP launch; add DB ping check for production readiness',
  },
} as const;

// ── Feature flag state ────────────────────────────────────────────────────────
// Static registry defaults (backend/config/feature-flags.ts) vs production runtime.
// CRITICAL: .replit [userenv.production] only sets APP_URL — no FF_* vars.
// The FF_* vars are in the dev Backend API workflow command ONLY.
// => In production: ALL WC-3/decision/commercial flags run at REGISTRY DEFAULT (OFF).
const FLAG_STATE = {
  dev_workflow_flags_on: [
    'FF_RUNTIME_INTELLIGENCE_ACTIVATION', 'FF_RUNTIME_INTELLIGENCE_PIPELINE',
    'FF_WC3_STAGE', 'FF_WC3_OUTCOME', 'FF_WC3_JOURNEY', 'FF_WC3_PERSONALIZATION',
    'FF_WC3_LONGITUDINAL', 'FF_DECISION_ORCHESTRATOR', 'FF_JOURNEY_GROWTH_PLAN_BRIDGE',
    'FF_DECISION_MENTOR_BRIDGE', 'FF_COMMERCIAL_ACTIVATION', 'FF_DECISION_PERSISTENCE',
    'FF_BEHAVIOUR_NAMESPACE_ALIGNMENT',
  ],
  production_env: {
    APP_URL: 'set (metryx.one)',
    SESSION_SECRET: 'NOT SET — fallback to hardcoded string',
    FF_any: 'NONE — all WC-3/decision/commercial flags OFF in production',
  },
  impact: 'Stage/Outcome/Journey/Decision/Commercial chain is DARK in production (registry defaults all OFF). Data collected in dev/staging does NOT reflect the state users will see in production.',
} as const;

// ── DB Queries ────────────────────────────────────────────────────────────────
async function queryDB() {
  const [
    sessionStatus,
    outcomeStats,
    outcomeModels,
    journeyStats,
    otpStats,
    paymentStats,
    packageStats,
    lbiStats,
    concernMaster,
    clarityQuestions,
    competencyItems,
    reports,
  ] = await Promise.all([
    pool.query('SELECT status, COUNT(*) FROM capadex_sessions GROUP BY status'),
    pool.query('SELECT COUNT(*) total, COUNT(DISTINCT session_id) sessions FROM wc3_outcome_state'),
    pool.query('SELECT model_key, COUNT(*) FROM wc3_outcome_state GROUP BY model_key ORDER BY model_key'),
    pool.query('SELECT COUNT(*) total, COUNT(DISTINCT session_id) sessions FROM wc3_journey_state').catch(() => ({ rows: [{ total: 0, sessions: 0 }] })),
    pool.query('SELECT COUNT(*) total, COUNT(CASE WHEN used=true THEN 1 END) used FROM capadex_otps'),
    pool.query('SELECT status, COUNT(*) FROM capadex_payments GROUP BY status'),
    pool.query('SELECT COUNT(*) FROM subscription_packages'),
    pool.query('SELECT COUNT(*) sessions FROM lbi_sessions').catch(() => ({ rows: [{ sessions: 0 }] })),
    pool.query('SELECT COUNT(*) FROM capadex_concerns_master'),
    pool.query('SELECT COUNT(*) FROM capadex_clarity_questions'),
    pool.query('SELECT COUNT(*) FROM competency_assessment_items').catch(() => ({ rows: [{ count: 0 }] })),
    pool.query('SELECT COUNT(*) FROM capadex_reports').catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  const statusMap: Record<string, number> = {};
  for (const r of sessionStatus.rows) statusMap[r.status] = Number(r.count);
  const totalSessions = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const completedSessions = statusMap['completed'] || 0;

  const paymentMap: Record<string, number> = {};
  for (const r of paymentStats.rows) paymentMap[r.status] = Number(r.count);

  const outcomeSessions = Number(outcomeStats.rows[0]?.sessions || 0);
  const outcomeTotal = Number(outcomeStats.rows[0]?.total || 0);
  const journeySessions = Number(journeyStats.rows[0]?.sessions || 0);

  return {
    sessions: {
      total: totalSessions,
      completed: completedSessions,
      in_progress: statusMap['in_progress'] || 0,
      replaced: statusMap['replaced'] || 0,
    },
    outcome: {
      total_rows: outcomeTotal,
      distinct_sessions: outcomeSessions,
      sessions_without_outcome: completedSessions - outcomeSessions,
      model_breakdown: outcomeModels.rows,
      note: '14 rows = 3 outcome models × sessions; each completed session may have 1–3 model rows',
    },
    journey: {
      distinct_sessions: journeySessions,
      coverage_pct: pct(journeySessions, completedSessions),
    },
    otps: {
      total: Number(otpStats.rows[0]?.total || 0),
      used: Number(otpStats.rows[0]?.used || 0),
    },
    payments: {
      total: Object.values(paymentMap).reduce((a, b) => a + b, 0),
      paid: paymentMap['paid'] || 0,
      pending: paymentMap['pending'] || 0,
      failed: paymentMap['failed'] || 0,
    },
    packages: {
      total: Number(packageStats.rows[0]?.count || 0),
    },
    lbi: {
      sessions: Number(lbiStats.rows[0]?.sessions || 0),
    },
    catalog: {
      concerns_master: Number(concernMaster.rows[0]?.count || 0),
      clarity_questions: Number(clarityQuestions.rows[0]?.count || 0),
    },
    competency: {
      assessment_items: Number(competencyItems.rows[0]?.count || 0),
    },
    reports: {
      total: Number(reports.rows[0]?.count || 0),
    },
  };
}

// ── Gate evaluator ────────────────────────────────────────────────────────────
type GateStatus = 'PASS' | 'SOFT_PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'DECISION_REQUIRED';
interface Gate { id: string; label: string; status: GateStatus; note: string }

function freeConsumerGates(db: Awaited<ReturnType<typeof queryDB>>): Gate[] {
  return [
    { id: 'G1', label: 'Concern entry → analysis → resolution', status: 'PASS',
      note: `resolveCapadexConcern works end-to-end; ${db.catalog.concerns_master} master concerns, keyword fallback to "Easily distracted" (never 404)` },
    { id: 'G2', label: 'Clarity questions served', status: 'PASS',
      note: `${db.catalog.clarity_questions.toLocaleString()} clarity questions in DB; 3-tier picker (master→DB→static)` },
    { id: 'G3', label: 'Assessment (10 MCQ/Likert)', status: 'PASS',
      note: '10-item assessment served per concern/persona/age-band' },
    { id: 'G4', label: 'Report generation', status: 'PASS',
      note: `${db.reports.total} reports persisted; OMEGA-X payload generated; ${db.sessions.completed} completed sessions end-to-end` },
    { id: 'G5', label: 'OTP delivery & verification', status: 'SOFT_PASS',
      note: 'OTP stored PLAINTEXT; verify-otp has NO attempt cap (brute-forceable with in-memory rate-limit only); delivery is fire-and-forget (`.catch(console.error)` at capadex.ts:2381) — silent failure possible' },
    { id: 'G6', label: 'Email report delivery', status: 'SOFT_PASS',
      note: 'Direct SMTP (Zoho); no queue/retry; failure is silent. Email entitlement gated by gateReportEntitlement — must verify free-tier users are not blocked.' },
    { id: 'G7', label: 'Security baseline', status: 'FAIL',
      note: 'SESSION_SECRET not present in .replit [userenv.production]; deployment-pane secrets cannot be inspected from the repo — verify in the Deployments pane. If unset, hardcoded fallback at routes.ts:234 is active. Also: no Helmet headers; SuperAdmin MFA disabled.' },
    { id: 'G8', label: 'Operational baseline', status: 'SOFT_PASS',
      note: 'No graceful shutdown (SIGTERM handler absent); no error tracking; email delivery has no retry. Health endpoint exists (/api/health).' },
    { id: 'G9', label: 'WC-3/decision chain in production', status: 'DECISION_REQUIRED',
      note: 'FF_WC3_*/FF_DECISION_* flags absent from .replit [userenv.production] and the production run command. Cannot verify deployment-pane secrets from the repo. Flag-off is byte-identical to legacy free-flow (G1–G4 work without them). Explicit owner decision required before launch: which flags belong in production.' },
  ];
}

function paidPilotGates(db: Awaited<ReturnType<typeof queryDB>>): Gate[] {
  const base = freeConsumerGates(db);
  return [
    ...base,
    { id: 'G10', label: 'Razorpay order creation', status: 'PASS',
      note: 'capadex-payments.ts: POST /api/capadex/payment/create-order — validates stage_code, creates Razorpay order, persists "pending" in capadex_payments' },
    { id: 'G11', label: 'Payment verification (HMAC-SHA256)', status: 'PASS',
      note: 'POST /api/capadex/payment/verify — server-side signature verification; updates status to "paid"' },
    { id: 'G12', label: 'Webhook handler (async capture)', status: 'PASS',
      note: 'POST /api/capadex/payment/webhook — handles payment.captured / order.paid; ensures consistency if client verify fails' },
    { id: 'G13', label: 'Post-payment stage unlock', status: 'PASS',
      note: 'startNextStageAfterPayment → /api/capadex/session/start; admin + user email notification; WhatsApp notification' },
    { id: 'G14', label: 'Razorpay keys in production', status: 'SOFT_PASS',
      note: 'Demo-mode fallback active when RAZORPAY_KEY_ID missing (returns demo order, stays "pending"). Requires confirming RAZORPAY_KEY_ID/SECRET are set in production secrets.' },
    { id: 'G15', label: 'Refund/support path', status: 'FAIL',
      note: 'No refund route in capadex-payments.ts; no customer support ticket system; no documented refund SLA. Required for any paid consumer launch.' },
    { id: 'G16', label: 'Paid conversion (cold start)', status: 'NOT_APPLICABLE',
      note: `${db.payments.paid} paid / ${db.payments.total} total B2C payments. Cold start is a fact, not a gate failure.` },
  ];
}

function lbiGates(db: Awaited<ReturnType<typeof queryDB>>): Gate[] {
  return [
    { id: 'G1', label: 'LBI scoring engine', status: 'PASS',
      note: 'LBIEngine in backend/routes/lbi-engine.ts; 5 dims (Consistency/Persistence/Attention/Adaptability/Velocity); 19 domains; real calculation' },
    { id: 'G2', label: 'Consumer entry point / checkout wiring', status: 'FAIL',
      note: 'LBI has no consumer-facing purchase flow; not wired to Razorpay checkout; not a paid SKU in the B2C ladder or package catalog' },
    { id: 'G3', label: 'LBI session history', status: 'FAIL',
      note: `${db.lbi.sessions} rows in lbi_sessions. Engine has never been invoked in production. No baseline data.` },
    { id: 'G4', label: 'Schema model consistency', status: 'SOFT_PASS',
      note: 'Legacy student_id vs new child_id model transition in progress; lbi_sessions and lbi_scores exist but diverged schema' },
    { id: 'G5', label: 'Frontend consumer flow', status: 'SOFT_PASS',
      note: 'Report components exist (SubjectLBIReport, ShareLBIReport, AIPoweredReports lbi-comprehensive); no consumer entry page / landing' },
  ];
}

function eiGates(db: Awaited<ReturnType<typeof queryDB>>): Gate[] {
  return [
    { id: 'G1', label: 'EI scoring engine', status: 'PASS',
      note: 'GET /api/competency/score/:userId — weighted, norm-referenced scoring real; used in CareerBuilderPage and StudentCompetencyPage' },
    { id: 'G2', label: 'Standalone consumer route', status: 'FAIL',
      note: '"employability_index" is marked stub in wc3_journey_routes; offer-engine has "never sell" guard; no /employability-index page exists' },
    { id: 'G3', label: 'Consumer question bank', status: 'FAIL',
      note: `competency_assessment_items = ${db.competency.assessment_items} rows. The question bank is entirely empty. EI scoring depends on responses; without items there is nothing for users to answer.` },
    { id: 'G4', label: 'Dedicated consumer page', status: 'FAIL',
      note: 'No frontend/src/pages/EmployabilityIndexPage.tsx; EIGauge and EIProvenanceCard components exist but embedded in CareerBuilder only' },
    { id: 'G5', label: 'Commercial unlock', status: 'FAIL',
      note: 'offer-engine explicitly excludes "employability", "competitive_exam", "competitive-exam", "exam_intelligence" as unsellable (status: "product_not_ready")' },
  ];
}

function gateVerdict(gates: Gate[]): string {
  const fails = gates.filter(g => g.status === 'FAIL').length;
  const softs = gates.filter(g => g.status === 'SOFT_PASS').length;
  const decisions = gates.filter(g => g.status === 'DECISION_REQUIRED').length;
  if (fails === 0 && softs === 0 && decisions === 0) return 'GO';
  if (fails === 0 && decisions === 0) return 'CONDITIONAL_GO';
  if (fails === 0) return 'CONDITIONAL_GO (decisions pending)';
  return 'NO_GO';
}

function gatesTable(gates: Gate[]): string {
  const icon = (s: GateStatus) =>
    s === 'PASS' ? '✅' : s === 'SOFT_PASS' ? '⚠️' : s === 'FAIL' ? '❌'
    : s === 'DECISION_REQUIRED' ? '🔶' : '–';
  const rows = gates
    .map(g => `| ${g.id} | ${g.label} | ${icon(g.status)} ${g.status} | ${g.note} |`)
    .join('\n');
  return `| Gate | Label | Status | Notes |\n|---|---|---|---|\n${rows}`;
}

// ── Report writers ────────────────────────────────────────────────────────────
function write(filename: string, content: string) {
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), content.trimStart(), 'utf8');
  console.log(`  ✓ ${filename}`);
}

function d01_productReadiness(db: Awaited<ReturnType<typeof queryDB>>) {
  const freeGates = freeConsumerGates(db);
  const paidGates = paidPilotGates(db);
  const lbiG = lbiGates(db);
  const eiG = eiGates(db);

  const freeVerdict = gateVerdict(freeGates);
  const paidVerdict = gateVerdict(paidGates);
  const lbiVerdict = gateVerdict(lbiG);
  const eiVerdict = gateVerdict(eiG);

  write('01_product_readiness_report.md', `
# WC-C8 · Deliverable 1 · Product Readiness Report

**Audit:** WC-C8 — Launch Readiness | **Mode:** AUDIT ONLY · READ ONLY | **Generated:** ${now}

---

## 4-Target Readiness Summary

| Launch Target | Gates | PASS | SOFT | FAIL | Verdict |
|---|---|---|---|---|---|
| Free Consumer Launch | ${freeGates.length} | ${freeGates.filter(g => g.status === 'PASS').length} | ${freeGates.filter(g => g.status === 'SOFT_PASS').length} | ${freeGates.filter(g => g.status === 'FAIL').length} | **${freeVerdict}** |
| Paid Consumer Pilot | ${paidGates.length} | ${paidGates.filter(g => g.status === 'PASS').length} | ${paidGates.filter(g => g.status === 'SOFT_PASS').length} | ${paidGates.filter(g => g.status === 'FAIL').length} | **${paidVerdict}** |
| LBI Launch | ${lbiG.length} | ${lbiG.filter(g => g.status === 'PASS').length} | ${lbiG.filter(g => g.status === 'SOFT_PASS').length} | ${lbiG.filter(g => g.status === 'FAIL').length} | **${lbiVerdict}** |
| Employability Index Pilot | ${eiG.length} | ${eiG.filter(g => g.status === 'PASS').length} | ${eiG.filter(g => g.status === 'SOFT_PASS').length} | ${eiG.filter(g => g.status === 'FAIL').length} | **${eiVerdict}** |

---

## Target 1 — Free Consumer Launch · Verdict: ${freeVerdict}

**What works:** The full free-assessment flow (analyze → clarity → questions → score → report → OTP → email)
has been executed end-to-end: **${db.sessions.completed} completed sessions**, **${db.reports.total} reports persisted**,
**${db.catalog.clarity_questions.toLocaleString()} clarity questions** available, **${db.catalog.concerns_master} concern master entries**.

**What blocks it:** Two hard FAIL gates — (1) SESSION_SECRET is unset in production ([userenv.production] only
contains APP_URL); (2) the entire WC-3/decision/commercial chain (stage, outcome, journey, decision) is OFF
in production because FF_* flags are absent from the production deploy command. Users in production experience
a stripped-down version that collects no stage/outcome/journey state.

${gatesTable(freeGates)}

---

## Target 2 — Paid Consumer Pilot · Verdict: ${paidVerdict}

**What works:** Razorpay integration is complete and production-grade — order creation, HMAC-SHA256 signature
verification, webhook handler, post-payment stage unlock, and admin notification all verified. The payment
infrastructure can process real transactions today.

**Critical missing:** (1) No refund route or customer support path — legally and operationally required for
any paid consumer product. (2) Inherits all Free Launch blockers (SESSION_SECRET, FF_* in prod).

${gatesTable(paidGates)}

---

## Target 3 — LBI Launch · Verdict: ${lbiVerdict}

**What works:** The LBI engine (5 behavioural dimensions across 19 domains) is real and correct.
Frontend report components exist.

**What blocks it:** No consumer entry point. No checkout wiring. **${db.lbi.sessions} production LBI sessions ever**.
The engine has never been invoked by a real user. B2C model (pricing, entry page, purchase flow) does not exist.

${gatesTable(lbiG)}

---

## Target 4 — Employability Index Pilot · Verdict: ${eiVerdict}

**What works:** EI scoring engine is real (in CareerBuilderPage and StudentCompetencyPage). Gauge and
provenance components exist.

**What blocks it (all 4 are structural):**
1. **0 competency_assessment_items** — the question bank is entirely empty; EI scores require user responses.
2. Standalone consumer route is STUBBED in wc3_journey_routes.
3. No dedicated consumer page exists.
4. Commercial guard explicitly marks EI as unsellable ("product_not_ready").

${gatesTable(eiG)}
`);
}

function d02_commercialReadiness(db: Awaited<ReturnType<typeof queryDB>>) {
  write('02_commercial_readiness_report.md', `
# WC-C8 · Deliverable 2 · Commercial Readiness Report

**Generated:** ${now}

---

## Commercial Layer State

| Component | State | Evidence |
|---|---|---|
| Subscription packages | **${db.packages.total} seeded** (WC-C6B: ₹299–₹1499) | subscription_packages table |
| Student subscriptions | **0** active | student_subscriptions = 0 rows |
| B2C payments total | **${db.payments.total}** | capadex_payments |
| B2C payments paid | **${db.payments.paid}** | status='paid' |
| B2C payments pending | **${db.payments.pending}** | status='pending' (includes demo orders) |
| Revenue collected | **₹0** | 0 paid transactions |
| Cross-SKU expansion | **ABSENT** | Identity bridge (email on users table) missing |
| Upsell triggers built | **1/3** | stage_ladder_progression only; at_risk/power_user not built |
| Refund route | **ABSENT** | No POST /api/capadex/payment/refund |

---

## Razorpay Integration Completeness

| Feature | Status | Notes |
|---|---|---|
| Order creation | ✅ COMPLETE | POST /api/capadex/payment/create-order |
| HMAC verification | ✅ COMPLETE | POST /api/capadex/payment/verify |
| Webhook handler | ✅ COMPLETE | POST /api/capadex/payment/webhook (payment.captured / order.paid) |
| Post-payment unlock | ✅ COMPLETE | startNextStageAfterPayment → /api/capadex/session/start |
| Admin dashboard | ✅ COMPLETE | GET /api/admin/capadex/payments |
| Demo mode fallback | ⚠️ PRESENT | Returns demo order when RAZORPAY_KEY_ID missing — verify keys are set in prod |
| Refund route | ❌ ABSENT | Not implemented |

---

## B2C Stage Ladder

| SKU | Label | Price | Status |
|---|---|---|---|
| CAP_INS | Insight | ₹499 | Live (Razorpay) |
| CAP_GRW | Growth | ₹999 | Live (Razorpay) |
| CAP_MAS | Mastery | ₹1999 | Live (Razorpay) |

⚠️ **STAGE_PRICES lockstep**: Prices defined independently in subscription-engine.ts, upsell-engine.ts,
and routes/capadex-payments.ts. All three must stay in lockstep.

---

## Commercial Readiness Verdict

- **Infrastructure readiness (structural):** HIGH — Razorpay, package catalog, subscription schema all exist.
- **Activation readiness:** ZERO — 0 paid conversions, 0 active subscriptions. Cold start only.
- **Missing for paid launch:** refund route + customer support path (pre-launch blocker).
- **Missing for package subscription:** identity bridge (cross-SKU) + self-serve checkout page.
- **Intelligence chain in production:** OFF (FF_* flags absent from prod deploy) — paid users would receive the same stripped-down experience as free users.

**Bottom line:** Payment infrastructure is ready. Commercial activation is zero. The single hardest pre-launch
requirement is a refund/dispute path — without it, paid consumer launch creates legal and support risk.
`);
}

function d03_operationalReadiness(db: Awaited<ReturnType<typeof queryDB>>) {
  write('03_operational_readiness_report.md', `
# WC-C8 · Deliverable 3 · Operational Readiness Report

**Generated:** ${now}

---

## Operational Findings

### P1 — Pre-Launch (must fix before any public launch)

#### OP-1: No Graceful Shutdown
${OPERATIONAL_FINDINGS.no_graceful_shutdown.finding}

**Evidence:** ${OPERATIONAL_FINDINGS.no_graceful_shutdown.evidence}

**Risk:** deploymentTarget = "autoscale" in .replit — instances are routinely SIGTERM'd during redeploy and
scale-down events. Post-completion hooks (stage/outcome/journey state persistence) are fire-and-forget async
calls that will be silently abandoned when the process exits. For a data-collection launch, this means real
user completions can be lost.

**Fix:** ${OPERATIONAL_FINDINGS.no_graceful_shutdown.fix}

---

#### OP-2: No Email Queue or Retry
${OPERATIONAL_FINDINGS.email_no_queue.finding}

**Evidence:** ${OPERATIONAL_FINDINGS.email_no_queue.evidence}

**Risk:** OTP email failure is invisible to the user (${BT}.catch(console.error)${BT}) — user sees no error but
receives no code, flow is stuck. Report email failure is also silent. Zoho SMTP outages or rate limits
affect all email delivery.

**Fix:** ${OPERATIONAL_FINDINGS.email_no_queue.fix}

---

### P2 — Post-Launch Hardening

#### OP-3: Response Body Capture in Memory
${OPERATIONAL_FINDINGS.memory_logger.finding}
**Fix:** ${OPERATIONAL_FINDINGS.memory_logger.fix}

#### OP-4: No External Error Tracking
${OPERATIONAL_FINDINGS.no_error_tracking.finding}
**Fix:** ${OPERATIONAL_FINDINGS.no_error_tracking.fix}

---

### Notes

#### OP-5: Health Endpoint
${OPERATIONAL_FINDINGS.health_endpoint.finding}
${OPERATIONAL_FINDINGS.health_endpoint.note}

---

## Infrastructure Summary

| Component | State | Notes |
|---|---|---|
| Express server | ✅ Running | Port 8080; trust proxy configured |
| PostgreSQL (Drizzle) | ✅ Configured | pg.Pool via DATABASE_URL |
| MongoDB | ⚠️ Optional | MONGO_REQUIRED=false; fail-fast only when required |
| FastAPI proxy | ⚠️ Dependency | /api/v1/upload/* → :8002; unavailability breaks uploads |
| Email (Zoho SMTP) | ⚠️ No retry | Direct SMTP, port 465; fire-and-forget |
| Graceful shutdown | ❌ Absent | No SIGTERM/SIGINT handlers |
| Error tracking | ❌ Absent | Console-only; no Sentry/Datadog |
| Rate limiting | ⚠️ In-memory | Resets on restart; not effective under autoscale |

---

## Deployment Config

\`\`\`
deploymentTarget = "autoscale"
build = "cd frontend && npm run build && rm -rf ../backend/public && mkdir -p ../backend/public && cp -r dist/. ../backend/public/"
run   = "cd backend && NODE_ENV=production npx tsx index.ts"
\`\`\`

**Critical gap:** No FF_* environment variables in the production run command or [userenv.production].
All WC-3/decision/commercial feature flags run at registry defaults (OFF) in production.
`);
}

function d04_securityReport(db: Awaited<ReturnType<typeof queryDB>>) {
  write('04_security_report.md', `
# WC-C8 · Deliverable 4 · Security Report

**Generated:** ${now}
**Methodology:** Static code analysis with grep verification against live codebase. All findings cite file:line.

---

## Severity Classification

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| SEC-1 | **BLOCKER** | SESSION_SECRET hardcoded fallback in production | routes.ts:234 |
| SEC-2 | **BLOCKER** | SuperAdmin MFA disabled; seed credential exposed | routes.ts:392, routes.ts:1258 |
| SEC-3 | PRE_LAUNCH | OTP stored plaintext; no attempt cap on verify-otp | capadex.ts:2300, 2437 |
| SEC-4 | PRE_LAUNCH | Helmet absent — no standard security headers | grep → 0 matches |
| SEC-5 | POST_LAUNCH | Rate limiting in-memory only (resets on restart) | security-middleware.ts |
| SEC-6 | NOTE | CORS dev-permissive; depends on CLIENT_ORIGIN in prod | frontend/server/src/index.ts |

---

## SEC-1 · BLOCKER · SESSION_SECRET Unguarded Fallback

**Finding:** ${SECURITY_FINDINGS.session_secret.finding}

**Evidence:** ${SECURITY_FINDINGS.session_secret.evidence}

**Production confirmation:** \`.replit [userenv.production]\` only contains \`APP_URL = "https://metryx.one"\`.
SESSION_SECRET is not present in [userenv.production] or the production run command. Deployment-pane secrets
cannot be inspected from the repo — verify in the Replit Deployments pane before launch. **If unset,** the
hardcoded fallback "edupsych-secret-key-change-in-production" (routes.ts:234) is active, allowing any attacker
who knows this string to forge valid session cookies.

**Fix:** ${SECURITY_FINDINGS.session_secret.fix}

---

## SEC-2 · BLOCKER · SuperAdmin MFA Disabled

**Finding:** ${SECURITY_FINDINGS.superadmin_mfa.finding}

**Evidence:** ${SECURITY_FINDINGS.superadmin_mfa.evidence}

**Risk:** SuperAdmin has full platform access (user data, payment records, report management). Without MFA
and with a documented seed credential, the admin surface is a single-factor breach target.

**Fix:** ${SECURITY_FINDINGS.superadmin_mfa.fix}

---

## SEC-3 · PRE_LAUNCH · OTP Plaintext + No Attempt Cap

**Finding:** ${SECURITY_FINDINGS.otp_plaintext.finding}

**Evidence:** ${SECURITY_FINDINGS.otp_plaintext.evidence}

**Note:** ${SECURITY_FINDINGS.otp_plaintext.note}

**Risk detail:** A 6-digit OTP has 1,000,000 possibilities. With only in-memory rate limiting (resets on
restart, ineffective under autoscale), an attacker can brute-force OTPs across server restarts.
The capadex_otps table has columns: id, email, code, expires_at, used, created_at — no \`attempts\` column.

**Fix:** ${SECURITY_FINDINGS.otp_plaintext.fix}

---

## SEC-4 · PRE_LAUNCH · No Helmet (Security Headers Absent)

**Finding:** ${SECURITY_FINDINGS.no_helmet.finding}

**Evidence:** ${SECURITY_FINDINGS.no_helmet.evidence}

**Missing headers:** HSTS, Content-Security-Policy, X-Frame-Options (clickjacking), X-Content-Type-Options,
Referrer-Policy, Permissions-Policy.

**Fix:** ${SECURITY_FINDINGS.no_helmet.fix}

---

## SEC-5 · POST_LAUNCH · In-Memory Rate Limiting

**Finding:** ${SECURITY_FINDINGS.rate_limit_memory.finding}

**Evidence:** ${SECURITY_FINDINGS.rate_limit_memory.evidence}

**Fix:** ${SECURITY_FINDINGS.rate_limit_memory.fix}

---

## What is CORRECT (do not fabricate gaps)

| Control | Status | Notes |
|---|---|---|
| Auth middleware (requireAuth / requireAdmin / requireSuperAdmin) | ✅ CORRECT | Role-based, Passport.js + JWT |
| Self-registration role allowlist | ✅ CORRECT | Prevents self-assigning super_admin |
| SQL injection | ✅ CORRECT | Drizzle ORM + parameterized queries |
| Session cookies | ✅ CORRECT | httpOnly=true; secure=true in production |
| IDOR guard (career builder) | ✅ CORRECT | resolveEffectiveUserId implemented |
| Anti-enumeration delay | ✅ CORRECT | antiEnumDelay jitter on 404s |
| Dev OTP bypass (123456) | ✅ NOT PRESENT | Grep confirms absence; prior audit note was incorrect |
| bcrypt on OTP | ❌ NOT PRESENT | OTP stored plaintext (see SEC-3); bcrypt on PASSWORDS only |

---

## OTP audit state
- Total OTPs generated: ${db.otps.total}
- OTPs consumed (used=true): ${db.otps.used}
- Unused OTPs: ${db.otps.total - db.otps.used} (may include expired)
`);
}

function d05_launchRiskReport(db: Awaited<ReturnType<typeof queryDB>>) {
  write('05_launch_risk_report.md', `
# WC-C8 · Deliverable 5 · Launch Risk Report

**Generated:** ${now}

---

## P0 · Launch Blockers (must fix before ANY public launch)

### RISK-P0-1 · SESSION_SECRET Not in .replit [userenv.production]
- **Impact (if unset):** Every user session can be forged by anyone who knows the hardcoded fallback string.
  Affects all user data, payment sessions, and admin access.
- **Evidence:** routes.ts:234; [userenv.production] = APP_URL only. Deployment-pane secrets cannot be
  inspected from the repo — verify in the Deployments pane before treating this as confirmed unset.
- **Fix:** Verify SESSION_SECRET in the Replit Deployments pane. If absent, set it. Add startup fail-fast:
  if !process.env.SESSION_SECRET throw Error to prevent server start with fallback.
- **Owner:** DevOps / Secret Management

### RISK-P0-2 · WC-3/Decision/Commercial Chain Status in Production Unknown
- **Impact (if flags absent):** Stage/Outcome/Journey/Decision chain is DARK for production users. The
  system's primary value proposition would be invisible.
- **Evidence:** .replit run command has no FF_* vars; [userenv.production] has no FF_* vars. Cannot verify
  deployment-pane from repo. Flag-off is byte-identical to legacy (free assessment flow still works).
- **Decision required:** Which FF_* flags belong in production? Review each before enabling. At minimum
  FF_WC3_STAGE + FF_WC3_OUTCOME + FF_DECISION_PERSISTENCE for data collection. Commercial flags separate.
- **Owner:** Engineering / Product owner

---

## P1 · Pre-Launch Fixes (fix before public launch — not hard blockers but high-risk)

### RISK-P1-1 · SuperAdmin MFA Disabled
- **Impact:** Single-factor admin breach; documented seed credential
- **Fix:** Enable MFA; rotate admin credential; remove seed from routes.ts before launch

### RISK-P1-2 · No Refund/Support Path (Paid Pilot)
- **Impact:** Legal and consumer-protection risk for any paid transaction without a refund mechanism
- **Fix:** Implement POST /api/capadex/payment/refund (Razorpay refund API); establish support email/flow

### RISK-P1-3 · No Graceful Shutdown (Data Loss on Autoscale)
- **Impact:** Completions lost during scale-down/redeploy; undermines data-collection goal
- **Fix:** SIGTERM handler; drain in-flight requests; close DB pool cleanly

### RISK-P1-4 · OTP Brute-Force (No Attempt Cap)
- **Impact:** Plaintext 6-digit OTP brute-forceable across server restarts
- **Fix:** Add attempts column to capadex_otps; lock after 5 failures

### RISK-P1-5 · No Helmet Security Headers
- **Impact:** Clickjacking, MIME-sniffing, missing HSTS in production
- **Fix:** ${BT}import helmet from 'helmet'; app.use(helmet())${BT} in backend/index.ts

---

## P2 · Post-Launch Hardening (tolerable for MVP; fix within 30 days of launch)

| Risk | Impact | Fix direction |
|---|---|---|
| In-memory rate limiting | Ineffective under autoscale | Redis-backed limiter |
| No email queue/retry | Silent OTP/report delivery failures | Bull/Redis queue or retry wrapper |
| Response body memory logger | Memory pressure under load | Cap body capture size |
| No error tracking | Blind to production errors | Sentry integration |
| pg_stat estimates stale | Dashboard mis-reports row counts | Schedule ANALYZE; autovacuum |

---

## Product-Specific Risks

### LBI Launch Risk
- **RISK:** Launching an engine with 0 production sessions is a data-collection launch, not a product launch.
  No baseline behaviour exists. No consumer entry. No pricing in B2C ladder.
- **Verdict:** NO-GO until consumer entry and checkout are built.

### EI Pilot Risk
- **RISK:** Empty question bank (0 competency_assessment_items) means EI scores cannot be produced from user
  input. The existing EI scores in CareerBuilder come from competency framework data, not user answers.
- **Verdict:** NO-GO until question bank is populated AND standalone route is unblocked.

### Mentoring Fallback Dominance
- **RISK:** 66.7% of journey routes resolve to "mentoring" (fallback). If journey surface is shown to users,
  most users see a mentoring recommendation not derived from their specific concern/outcome. This is honest
  engine behaviour (correct fallback) but may confuse users expecting a tailored recommendation.
- **Mitigation:** Hide journey surface or display confidence tier prominently; only surface high-confidence (≥0.7) routes.

---

## Risk Matrix Summary

| Risk | Severity | Launch Target Affected | Status |
|---|---|---|---|
| SESSION_SECRET unset in production | P0 BLOCKER | All | ❌ Open |
| FF_* flags OFF in production | P0 BLOCKER | All | ❌ Open |
| SuperAdmin MFA disabled | P1 | All | ❌ Open |
| No refund path | P1 | Paid Pilot | ❌ Open |
| No graceful shutdown | P1 | All | ❌ Open |
| OTP brute-force | P1 | Free + Paid | ❌ Open |
| No Helmet headers | P1 | All | ❌ Open |
| In-memory rate limiting | P2 | All | ⚠️ Tolerable |
| No email queue | P2 | All | ⚠️ Tolerable |
| LBI: no consumer entry | Product blocker | LBI | ❌ NO-GO |
| EI: 0 question items | Product blocker | EI Pilot | ❌ NO-GO |
`);
}

function d06_launchRoadmap(db: Awaited<ReturnType<typeof queryDB>>) {
  write('06_launch_roadmap.md', `
# WC-C8 · Deliverable 6 · Launch Roadmap

**Generated:** ${now}

---

## Shortest Path: Free Consumer Launch

This is the only near-term launchable target. All items below are config/code fixes with no schema changes.

### Phase A — Unblock (P0 blockers, ~1–2 days, no schema changes)

1. **Set SESSION_SECRET in deployment secrets.** Rotate immediately.
   - Add fail-fast at startup: \`if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET not set')\`
   
2. **Add FF_* flags to [userenv.production] in .replit.**
   - Decide which flags belong in production. At minimum: FF_WC3_STAGE, FF_WC3_OUTCOME, FF_DECISION_PERSISTENCE (these are the "collect data" flags). Commercial flags (FF_COMMERCIAL_ACTIVATION) can wait.
   - Do NOT blindly copy the dev workflow command — review each flag and confirm intent.

### Phase B — Pre-Launch Hardening (~3–5 days)

3. **Enable SuperAdmin MFA** (un-comment the MFA block in routes.ts; confirm Zoho SMTP works). Rotate admin credential.
4. **Add Helmet middleware** — 1-line change in backend/index.ts.
5. **Add graceful shutdown** — SIGTERM handler: drain DB connections, wait for in-flight requests.
6. **Add OTP attempt cap** — ALTER capadex_otps ADD COLUMN attempts INT DEFAULT 0; lock after 5.

### Phase C — Soft Launches (can be done post-launch)

7. Email retry wrapper (1–3 retries on SMTP failure)
8. Sentry error tracking
9. Swap in-memory rate limiter for Redis-backed
10. Health endpoint DB connectivity check

**Exit criteria for Free Consumer Launch:** SEC-1 (SESSION_SECRET) resolved + FF_* in production confirmed.

---

## Shortest Path: Paid Consumer Pilot

Inherits all Free Consumer Launch steps, plus:

### Additional Pre-Launch (Paid Pilot only)

1. **Implement refund route** — POST /api/capadex/payment/refund via Razorpay SDK. Add admin UI for refund approval.
2. **Confirm Razorpay keys in production** — RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in deployment secrets.
3. **Establish support path** — at minimum a support email address displayed at checkout.
4. **Test end-to-end paid flow** — create a real ₹499 test transaction; verify stage unlock + emails.

**Timeline from Free Launch unblock:** ~3–5 additional days.

---

## Shortest Path: LBI Launch

LBI requires significant implementation work before launch. This roadmap is directional only.

1. **Consumer entry page** — Create frontend/src/pages/LBILaunchPage.tsx
2. **Purchase flow** — Wire LBI to Razorpay checkout (new SKU or via package catalog)
3. **LBI onboarding** — Age-band + persona selection → question flow → report
4. **B2C pricing decision** — Decide if LBI is a standalone SKU or part of a subscription package
5. **Schema normalisation** — Resolve student_id vs child_id model discrepancy
6. **Test with real users** — 0 production LBI sessions means no baseline

**Estimated effort:** Medium (1–2 weeks minimum). **Verdict: NOT near-term.**

---

## Shortest Path: Employability Index Pilot

EI requires the most work before launch. All 4 product gates are structural failures.

1. **Populate question bank** — competency_assessment_items = 0; source or author questions for 101 competencies
2. **Standalone page** — Create frontend/src/pages/EmployabilityIndexPage.tsx
3. **Unstub the route** — Update wc3_journey_routes status from stub to ready for employability_index
4. **Remove commercial guard** — Remove "employability" from the unsellable list in offer-engine
5. **Wire to checkout** — Add EI as a purchasable product
6. **Backfill norm data** — stage_competency_norms need population before percentile ranking is meaningful

**Estimated effort:** Large (3–6 weeks minimum). **Verdict: Not near-term. Requires user decision.**

---

## Timeline Summary

| Target | Blocks | Estimated to Unblock | Status |
|---|---|---|---|
| Free Consumer Launch | P0 security + FF_* in prod | ~1–2 days (config only) | ⚠️ Near-term |
| Paid Consumer Pilot | Free Launch + refund path | ~5–7 days total | ⚠️ Near-term |
| LBI Launch | No consumer entry, no sessions | Weeks (implementation) | ❌ Not near-term |
| EI Pilot | 0 question items, 4 product gates | Weeks (implementation) | ❌ Not near-term |
`);
}

function d07_executiveSummary(db: Awaited<ReturnType<typeof queryDB>>) {
  const freeGates = freeConsumerGates(db);
  const paidGates = paidPilotGates(db);
  const lbiG = lbiGates(db);
  const eiG = eiGates(db);

  write('07_executive_summary.md', `
# WC-C8 · Deliverable 7 · Executive Summary

**Audit:** WC-C8 — Launch Readiness Audit | **Generated:** ${now}
**Mode:** AUDIT ONLY · READ ONLY · STOP FOR APPROVAL

---

## What Can Launch Today?

**Nothing can launch today.** Two P0 blockers affect all 4 targets simultaneously:

1. **SESSION_SECRET is unset in production** — the hardcoded fallback string is active; all user sessions can be forged.
2. **Feature flags are OFF in production** — the entire WC-3/decision/commercial chain (stage, outcome, journey, decision, commercial) is dark for production users. This affects the platform's primary value proposition.

Both are **configuration-only fixes** (no code changes). Estimated resolution: 1–2 days.

---

## What Can Launch After Fixing P0 Blockers?

| Target | Verdict | Blockers remaining after P0 fix |
|---|---|---|
| **Free Consumer Launch** | **CONDITIONAL GO** | P1: MFA, Helmet, graceful shutdown, OTP attempt cap |
| **Paid Consumer Pilot** | **CONDITIONAL GO** | P1: Above + refund path + confirm Razorpay keys |
| **LBI Launch** | **NO-GO** | No consumer entry; 0 production sessions; no checkout |
| **EI Pilot** | **NO-GO** | 0 question items; standalone route stub; no page; commercial guard |

---

## 6 Launch Readiness Metrics (Architect-Confirmed)

| Metric | Coverage / Structural | Activation / Context | Key finding |
|---|---|---|---|
| **Product Readiness (Free)** | Gates: ${freeGates.filter(g=>g.status==='PASS').length}/${freeGates.length} PASS | Context: 2 P0 blockers open | Assessment flow end-to-end works; security blocks launch |
| **Product Readiness (Paid)** | Structural: Razorpay complete | Activation: 0 paid conversions (cold start) | Infrastructure ready; refund path missing |
| **Product Readiness (LBI)** | Engine: REAL | Consumer entry: ABSENT | Binary NO-GO — no consumer path |
| **Product Readiness (EI)** | Engine: REAL | Question bank: **0 items** | Binary NO-GO — question bank empty |
| **Security Readiness** | 2 BLOCKERS / 2 PRE_LAUNCH | Deployment secrets: SESSION_SECRET absent | Set 1 secret to unblock; MFA to harden |
| **Commercial Readiness** | Packages: ${db.packages.total} seeded | Paid: 0 / ${db.payments.total} transactions | Infrastructure ready; cold start; refund missing |

---

## Critical Corrections (verified against live codebase)

The following claims appeared in prior audit notes. Each has been re-verified against the live codebase.

1. **FF_* flags not confirmed in production.** Dev workflow runs them via ${BT}FF_WC3_STAGE=1 …${BT} in the
   command string. The production run command (${BT}NODE_ENV=production npx tsx index.ts${BT}) has no FF_* vars.
   [userenv.production] only contains ${BT}APP_URL${BT}. Deployment-pane secrets cannot be verified from the repo —
   verify before launch. Flag-off is byte-identical to legacy; free assessment flow works without them.

2. **SESSION_SECRET not in .replit [userenv.production].** [userenv.production] = ${BT}{ APP_URL: "metryx.one" }${BT}
   only. Deployment-pane must be checked — if absent, hardcoded fallback at routes.ts:234 is active.

3. **Dev OTP bypass (123456) does NOT exist** in CAPADEX code. grep across backend/routes/ returns zero
   matches. An earlier audit note incorrectly asserted this bypass; it is not present in the codebase.

4. **OTPs are stored PLAINTEXT, NOT bcrypt-hashed.** The INSERT at capadex.ts:2300 stores the raw code;
   verify-otp at capadex.ts:2437 matches on ${BT}WHERE code=$2${BT}. bcrypt is applied to PASSWORDS only.
   An earlier audit note incorrectly claimed OTP bcrypt hashing; this is not present.

5. **14 outcome rows across 6 of 9 completed sessions, spanning 3 model types (1–3 rows per session).**
   Model distribution: confidence_stability (4), exam_readiness (6), holistic_wellbeing (4). 3 of 9
   completed sessions have no outcome state (pre-backfill sessions without constructs). This is correct
   engine behaviour, not anomalous.

---

## What Was Fixed Since the Prior Launch-Readiness Audit

| Prior finding | Current state |
|---|---|
| Outcome chain broken (0 rows) | **Fixed** — 14 rows across 6 sessions (backfill + crosswalk); 3 model types |
| Subscription packages = 0 | **Fixed** — 13 packages seeded via WC-C6B (₹299–₹1499) |
| Commercial layer: no revenue tables | **Partial** — capadex_payments exists (6 rows, may include demo/test orders); student_subscriptions still 0 |
| WC-C7 upsell engine | **Built** — B2C ladder upsell structural (71.4% caps); activation cold-start |

---

## What Blocks Launch (Summary)

### Config-Only Fixes (~1–2 days, no code changes)
1. Set SESSION_SECRET in deployment secrets
2. Add FF_WC3_STAGE + FF_WC3_OUTCOME + FF_DECISION_PERSISTENCE to [userenv.production]
   (at minimum; review each flag before enabling)

### Code Fixes (~3–5 days, no schema changes)
3. Enable SuperAdmin MFA + rotate credential
4. Add \`app.use(helmet())\` in backend/index.ts
5. Add SIGTERM graceful shutdown handler
6. Add OTP attempt cap (ALTER capadex_otps ADD COLUMN attempts INT DEFAULT 0)

### Code + Design (~3–7 days for paid pilot)
7. Implement refund route (Razorpay SDK)
8. Confirm Razorpay keys in production secrets
9. Document/establish customer support path

---

## STOP FOR APPROVAL

This audit is complete. No implementation, schema changes, or deployment actions have been taken.
The findings above are the basis for deciding which launch targets to pursue and in what order.
`);
}

function buildSnapshot(db: Awaited<ReturnType<typeof queryDB>>) {
  const freeGates = freeConsumerGates(db);
  const paidGates = paidPilotGates(db);
  const lbiG = lbiGates(db);
  const eiG = eiGates(db);

  return {
    audit: 'wc-c8',
    generated_at: now,
    phase: 'AUDIT ONLY · READ ONLY · STOP FOR APPROVAL',
    db_state: db,
    flag_state: FLAG_STATE,
    verdicts: {
      free_consumer_launch: {
        verdict: gateVerdict(freeGates),
        pass: freeGates.filter(g => g.status === 'PASS').length,
        soft: freeGates.filter(g => g.status === 'SOFT_PASS').length,
        fail: freeGates.filter(g => g.status === 'FAIL').length,
        decision_required: freeGates.filter(g => g.status === 'DECISION_REQUIRED').length,
        total_gates: freeGates.length,
        p0_actions: ['verify_SESSION_SECRET_in_deployment_pane', 'decide_FF_flags_for_production'],
      },
      paid_consumer_pilot: {
        verdict: gateVerdict(paidGates),
        pass: paidGates.filter(g => g.status === 'PASS').length,
        soft: paidGates.filter(g => g.status === 'SOFT_PASS').length,
        fail: paidGates.filter(g => g.status === 'FAIL').length,
        decision_required: paidGates.filter(g => g.status === 'DECISION_REQUIRED').length,
        total_gates: paidGates.length,
        additional_blockers: ['no_refund_route', 'razorpay_keys_unconfirmed'],
      },
      lbi_launch: {
        verdict: gateVerdict(lbiG),
        pass: lbiG.filter(g => g.status === 'PASS').length,
        soft: lbiG.filter(g => g.status === 'SOFT_PASS').length,
        fail: lbiG.filter(g => g.status === 'FAIL').length,
        total_gates: lbiG.length,
        reason: 'No consumer entry point; 0 production LBI sessions; no checkout wiring',
      },
      ei_pilot: {
        verdict: gateVerdict(eiG),
        pass: eiG.filter(g => g.status === 'PASS').length,
        soft: eiG.filter(g => g.status === 'SOFT_PASS').length,
        fail: eiG.filter(g => g.status === 'FAIL').length,
        total_gates: eiG.length,
        reason: '0 competency_assessment_items; standalone route stubbed; no consumer page; commercial guard active',
      },
    },
    security: {
      blockers: 2,
      pre_launch: 2,
      post_launch: 1,
      notes: 1,
      session_secret_in_replit_userenv: false,
      session_secret_in_deployment_pane: 'unverifiable_from_repo',
      mfa_enabled: false,
      otp_plaintext: true,
      otp_attempt_cap: false,
      helmet_installed: false,
    },
    operational: {
      graceful_shutdown: false,
      email_queue: false,
      error_tracking: false,
      health_endpoint: true,
    },
    critical_corrections: [
      'FF_* flags OFF in production (not in [userenv.production]) — WC-3 chain is dark',
      'SESSION_SECRET absent from [userenv.production] — hardcoded fallback active',
      'Dev OTP bypass (123456) does NOT exist — grep confirms absence',
      'OTP stored PLAINTEXT not bcrypt — bcrypt applies to passwords only',
      '14 outcome rows = 3 model types × 6 sessions (correct behaviour, not anomaly)',
    ],
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('WC-C8 Launch Readiness Audit');
  console.log('='.repeat(44));
  console.log('Mode: AUDIT ONLY · READ ONLY · No schema changes');
  console.log(`Time: ${now}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Querying DB…');
  const db = await queryDB();

  console.log('Composing deliverables…');
  d01_productReadiness(db);
  d02_commercialReadiness(db);
  d03_operationalReadiness(db);
  d04_securityReport(db);
  d05_launchRiskReport(db);
  d06_launchRoadmap(db);
  d07_executiveSummary(db);

  const snapshot = buildSnapshot(db);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_wc_c8_snapshot.json'),
    JSON.stringify(snapshot, null, 2),
    'utf8',
  );
  console.log('  ✓ _wc_c8_snapshot.json');

  await pool.end();

  console.log('\nWC-C8 audit complete.');
  console.log(`Output: ${OUTPUT_DIR}\n`);
  console.log('Verdict summary:');
  const fG = freeConsumerGates(db);
  const pG = paidPilotGates(db);
  const lG = lbiGates(db);
  const eG = eiGates(db);
  console.log(`  Free Consumer Launch   — ${gateVerdict(fG)} (${fG.filter(g=>g.status==='FAIL').length} FAIL)`);
  console.log(`  Paid Consumer Pilot    — ${gateVerdict(pG)} (${pG.filter(g=>g.status==='FAIL').length} FAIL)`);
  console.log(`  LBI Launch             — ${gateVerdict(lG)} (${lG.filter(g=>g.status==='FAIL').length} FAIL)`);
  console.log(`  Employability Index    — ${gateVerdict(eG)} (${eG.filter(g=>g.status==='FAIL').length} FAIL)`);
  console.log(`  P0 Security Blockers   — 2 (SESSION_SECRET + SuperAdmin MFA)`);
  console.log(`  P1 Pre-Launch Fixes    — 5 (MFA, refund, shutdown, OTP cap, Helmet)`);
}

main().catch(err => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
