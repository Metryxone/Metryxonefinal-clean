/**
 * MX-106X — Production Readiness & Go-Live Certification (read-only TOP-LEVEL composer).
 * ─────────────────────────────────────────────────────────────────────────────────────
 * A SUPERSET of MX-105X. This module COMPOSES (never recomputes) the already-built
 * engine READ paths into one production-readiness picture:
 *   • MX-105X enterprise-certification views — recertification / unified journey /
 *     outcome readiness / command center / founder center.
 *   • Existing read-only governance readers — buildEnterpriseGovernance,
 *     buildSecurityCenterView, getCertificationSummary (question certification).
 *   • Existing read-only platform reader — buildPlatformOperationalView.
 *   • Light to_regclass-probed SELECTs for multi-tenant / health-monitoring substrate
 *     and real-commercial (market) evidence.
 *
 * CANON (do not violate):
 *   • GET-only / compose-never-recompute. NO DDL, NO ensure-schema, NO row writes.
 *   • Never throws — every sub-call is wrapped (safe / .catch) and degrades to null.
 *   • SIX readiness axes are kept SEPARATE and NEVER composited:
 *       Structural ⟂ Activation ⟂ Adoption ⟂ Operational ⟂ Outcome ⟂ Market.
 *     Coverage ⟂ Confidence likewise.
 *   • null = not measurable, NEVER a fabricated 0. Live evidence that cannot be measured
 *     (load tests, real customers) → status 'not_measurable', score null.
 *   • Flag OFF → routes 503 before this module is ever reached → byte-identical legacy.
 */

import type { Pool } from 'pg';
import {
  recertification,
  unifiedJourney,
  outcomeReadiness,
  commandCenter,
  founderCommandCenter,
  ENTERPRISE_CERTIFICATION_VERSION,
} from './enterprise-certification';
import { buildPlatformOperationalView } from './platform/platform-operational-view';
import { buildEnterpriseGovernance } from './governance/enterprise-governance-engine';
import { buildSecurityCenterView } from './governance/security-center-view';
import { getCertificationSummary } from './question-certification';

export const GO_LIVE_CERTIFICATION_VERSION = '106.0.0';
export const GO_LIVE_K_MIN = 30;
export const GO_LIVE_DISCLAIMER =
  'Production-readiness certification composes existing engine read paths only. It recomputes ' +
  'no score and writes no data. The six readiness axes (Structural ⟂ Activation ⟂ Adoption ⟂ ' +
  'Operational ⟂ Outcome ⟂ Market) are reported separately and never composited. Unmeasurable ' +
  'live evidence (load tests, real customers) is reported as not_measurable, never an invented score.';

// ── Local read-only primitives (mirrors the MX-105X composer; never writes) ───────────

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

/** to_regclass existence probe. Returns false on any error (never throws). */
async function tablePresent(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    return r.rows?.[0]?.reg != null;
  } catch { return false; }
}

/** Guarded scalar read. Probes `guard` table first; null on absence OR any error (never a fake 0). */
async function scalar(pool: Pool, guard: string, sql: string): Promise<number | null> {
  try {
    if (!(await tablePresent(pool, guard))) return null;
    const r = await pool.query(sql);
    const v = r.rows?.[0]?.n;
    return v == null ? null : Number(v);
  } catch { return null; }
}

/** Percentage with an honest denominator. null when not measurable (denominator missing/0). */
function rate(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null || den === 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

// ── AXIS 1–6 — SIX-AXIS READINESS (each axis SEPARATE, never composited) ──────────────

export async function sixAxisReadiness(pool: Pool) {
  const cert = await safe(() => recertification(pool));
  const outcome = await safe(() => outcomeReadiness(pool));
  const ops = await safe(() => buildPlatformOperationalView(pool));

  // — Structural (from MX-105X enterprise structural %) —
  const structuralPct = (cert as any)?.enterprise_structural_pct ?? null;
  const structural = {
    axis: 'structural',
    label: 'Structural',
    measurable: structuralPct != null,
    score: structuralPct,
    status: structuralPct == null ? 'not_measurable'
      : structuralPct >= 90 ? 'ready' : structuralPct >= 60 ? 'partial' : 'not_ready',
    evidence: {
      tables_present: (cert as any)?.structural_tables_present ?? null,
      tables_total: (cert as any)?.structural_tables_total ?? null,
      subsystems_pass: (cert as any)?.summary?.pass ?? null,
      subsystems_total: (cert as any)?.summary?.total ?? null,
    },
    source: 'MX-105X recertification.enterprise_structural_pct',
    note: 'Required-table presence across all enterprise subsystems.',
  };

  // — Activation (share of subsystems switched on) —
  const subsTotal = (cert as any)?.summary?.total ?? null;
  const activated = (cert as any)?.summary?.activated ?? null;
  const activationPct = rate(activated, subsTotal);
  const activation = {
    axis: 'activation',
    label: 'Activation',
    measurable: activationPct != null,
    score: activationPct,
    status: activationPct == null ? 'not_measurable'
      : activationPct >= 90 ? 'ready' : activationPct >= 60 ? 'partial' : 'not_ready',
    evidence: { activated_subsystems: activated, subsystems_total: subsTotal },
    source: 'MX-105X recertification.summary.activated',
    note: 'Subsystems whose feature flag is switched on (always-on subsystems count as activated).',
  };

  // — Adoption (share of subsystems with live non-demo rows) — 0 is honest dormancy, not failure —
  const adopted = (cert as any)?.summary?.adopted ?? null;
  const adoptionPct = rate(adopted, subsTotal);
  const adoption = {
    axis: 'adoption',
    label: 'Adoption',
    measurable: adoptionPct != null,
    score: adoptionPct,
    status: adoptionPct == null ? 'not_measurable'
      : adoptionPct === 0 ? 'dormant' : adoptionPct >= 60 ? 'ready' : 'partial',
    evidence: { adopted_subsystems: adopted, subsystems_total: subsTotal },
    source: 'MX-105X recertification.summary.adopted',
    note: 'Subsystems carrying live (non-demo) rows. Zero = honest pre-launch dormancy, not a failure.',
  };

  // — Operational (structural/config readiness from the operational view; NOT a load metric) —
  const opsDegraded = (ops as any)?.degraded === true;
  const opsSub = (ops as any)?.substrate ?? null;
  const opsSubKeys = opsSub ? Object.keys(opsSub) : [];
  const opsSubPresent = opsSubKeys.filter((k) => (opsSub as any)[k] === true).length;
  const opsStructPct = opsSubKeys.length ? rate(opsSubPresent, opsSubKeys.length) : null;
  const operational = {
    axis: 'operational',
    label: 'Operational',
    measurable: ops != null && opsStructPct != null && !opsDegraded,
    score: opsStructPct,
    status: ops == null || opsDegraded ? 'not_measurable'
      : opsStructPct == null ? 'not_measurable'
      : opsStructPct >= 90 ? 'ready' : opsStructPct >= 60 ? 'partial' : 'not_ready',
    evidence: {
      substrate_present: opsSubPresent,
      substrate_total: opsSubKeys.length,
      sessions_total: (ops as any)?.operational?.sessions_total ?? null,
      active_sessions: (ops as any)?.operational?.active_sessions ?? null,
      data_quality_measurable: (ops as any)?.data_quality?.measurable ?? null,
      growth_measurable: (ops as any)?.growth_trend?.measurable ?? null,
    },
    source: 'Phase 6.10 buildPlatformOperationalView (structural/config readiness)',
    note: 'Structural/config readiness of the operational substrate. Load capacity under stress is reported separately and is not_measurable (no live load test).',
  };

  // — Outcome (realized-type coverage + evidence-backed confidence — Coverage ⟂ Confidence) —
  const realizedCoverage = (outcome as any)?.coverage?.realized_coverage ?? null;
  const evidenceBacked = (outcome as any)?.confidence?.evidence_backed ?? null;
  const outcomeAxis = {
    axis: 'outcome',
    label: 'Outcome',
    measurable: realizedCoverage != null,
    score: realizedCoverage,
    confidence: {
      evidence_backed: evidenceBacked === true,
      state: evidenceBacked === true ? 'calibrated'
        : realizedCoverage != null && realizedCoverage > 0 ? 'provisional' : 'abstained',
      k_min: GO_LIVE_K_MIN,
    },
    status: realizedCoverage == null ? 'not_measurable'
      : evidenceBacked === true ? 'ready'
      : realizedCoverage > 0 ? 'partial' : 'dormant',
    evidence: { realized_coverage: realizedCoverage, verdict: (outcome as any)?.verdict ?? null },
    source: 'MX-105X outcomeReadiness (composes MX-102X)',
    note: 'Coverage (realized outcome types seen) and Confidence (evidence-backed / calibrated ≥ k_min) are SEPARATE axes.',
  };

  // — Market (real commercial evidence; not_measurable unless real customers/revenue exist) —
  const realRevenueEvents = await scalar(pool, 'capadex_payments', 'SELECT count(*)::int AS n FROM capadex_payments');
  const realEmployers = await scalar(
    pool, 'employer_candidates',
    "SELECT count(*)::int AS n FROM employer_candidates WHERE coalesce(email,'') NOT ILIKE '%@example.com'",
  );
  const marketEvidence = (realRevenueEvents ?? 0) > 0 || (realEmployers ?? 0) > 0;
  const market = {
    axis: 'market',
    label: 'Market',
    measurable: marketEvidence, // a market-share % has no honest denominator — only presence of real commercial evidence
    score: null as number | null, // NEVER fabricate a market-readiness percentage
    status: marketEvidence ? 'evidence_present' : 'not_measurable',
    evidence: { real_revenue_events: realRevenueEvents, real_employers_non_demo: realEmployers },
    source: 'Read-only probes of capadex_payments + employer_candidates (non-demo)',
    note: 'Market readiness requires real customers / revenue / market-share evidence that cannot be fabricated. Reported as not_measurable until live commercial evidence exists. No invented percentage.',
  };

  const axes = [structural, activation, adoption, operational, outcomeAxis, market];
  return {
    view: 'six_axis_readiness',
    version: GO_LIVE_CERTIFICATION_VERSION,
    axes,
    axes_note: 'Structural ⟂ Activation ⟂ Adoption ⟂ Operational ⟂ Outcome ⟂ Market — six SEPARATE axes, NEVER composited into a single score.',
    read_only: true,
  };
}

// ── PHASE 4 — SCALABILITY CERTIFICATION (structural/config readiness; load not_measurable) ─────

export async function scalabilityCertification(pool: Pool) {
  const ops = await safe(() => buildPlatformOperationalView(pool));

  // Multi-tenant substrate
  const tenantsPresent = await tablePresent(pool, 'tenants');
  const tenantCount = await scalar(pool, 'tenants', 'SELECT count(*)::int AS n FROM tenants');
  const multi_tenant = {
    measurable: tenantsPresent,
    structural_ready: tenantsPresent,
    substrate_present: tenantsPresent,
    tenant_count: tenantCount,
    note: 'Multi-tenant isolation substrate (tenants table) present = structurally ready for multi-org onboarding.',
  };

  // Tenant / user growth trend (from operational view)
  const tenant_growth = {
    measurable: (ops as any)?.growth_trend?.measurable ?? false,
    new_users_30d: (ops as any)?.growth_trend?.new_users_30d ?? null,
    prev_30d: (ops as any)?.growth_trend?.prev_30d ?? null,
    growth_pct: (ops as any)?.growth_trend?.growth_pct ?? null,
    note: 'Signup growth over trailing 30d windows. Measurable only when the users substrate exists.',
  };

  // Health monitoring substrate
  const healthSnapshotsPresent = await tablePresent(pool, 'health_snapshots');
  const healthSnapshotCount = await scalar(pool, 'health_snapshots', 'SELECT count(*)::int AS n FROM health_snapshots');
  const health_monitoring = {
    measurable: healthSnapshotsPresent,
    structural_ready: healthSnapshotsPresent,
    substrate_present: healthSnapshotsPresent,
    snapshot_count: healthSnapshotCount,
    note: 'Platform health-snapshot history substrate present = monitoring instrumented (separate from real-time alerting).',
  };

  // Current operational throughput (config readiness, NOT load capacity)
  const operational_throughput = {
    measurable: ops != null && (ops as any)?.degraded !== true && (ops as any)?.operational?.sessions_total != null,
    sessions_total: (ops as any)?.operational?.sessions_total ?? null,
    responses_total: (ops as any)?.operational?.responses_total ?? null,
    active_sessions: (ops as any)?.operational?.active_sessions ?? null,
    note: 'Current live throughput. A snapshot of present volume — NOT a projection of capacity under load.',
  };

  const data_quality = {
    measurable: (ops as any)?.data_quality?.measurable ?? false,
    avg_reliability_index: (ops as any)?.data_quality?.avg_reliability_index ?? null,
    runtime_contexts: (ops as any)?.data_quality?.runtime_contexts ?? null,
  };

  // Load capacity — genuinely unmeasurable without a live load/stress test. Never fabricate.
  const load_capacity = {
    measurable: false,
    status: 'not_measurable',
    note: 'No live load / stress test evidence exists. Throughput, latency, and concurrency under load CANNOT be fabricated and are reported as not_measurable.',
  };

  // Structural readiness = share of structural dimensions present (multi-tenant + health monitoring + operational substrate).
  const structuralDims = [
    multi_tenant.structural_ready,
    health_monitoring.structural_ready,
    operational_throughput.measurable,
  ];
  const structuralReady = structuralDims.filter(Boolean).length;
  const structuralPct = rate(structuralReady, structuralDims.length);
  const verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_MEASURABLE' =
    structuralPct == null ? 'NOT_MEASURABLE'
      : structuralPct >= 90 ? 'PASS' : structuralPct >= 60 ? 'PARTIAL' : 'FAIL';

  return {
    view: 'scalability_certification',
    version: GO_LIVE_CERTIFICATION_VERSION,
    dimensions: { multi_tenant, tenant_growth, health_monitoring, operational_throughput, data_quality, load_capacity },
    structural_readiness_pct: structuralPct,
    structural_dimensions_ready: structuralReady,
    structural_dimensions_total: structuralDims.length,
    verdict,
    verdict_axis: 'structural/config',
    axes_note: 'Verdict reflects STRUCTURAL/CONFIG scalability readiness only. Load capacity under stress is a SEPARATE axis and is not_measurable here.',
    read_only: true,
  };
}

// ── PHASE 5 — SECURITY & GOVERNANCE CERTIFICATION ─────────────────────────────────────

export async function securityGovernanceCertification(pool: Pool) {
  const gov = await safe(() => buildEnterpriseGovernance(pool));
  const sec = await safe(() => buildSecurityCenterView(pool));
  const qcert = await safe(() => getCertificationSummary(pool));

  // RBAC — formal RBAC is ADVISORY; the live users.role super_admin gate is authoritative. We do NOT change enforcement.
  const rbacRoles = (sec as any)?.rbac?.roles ?? null;
  const rbacPerms = (sec as any)?.rbac?.permissions ?? null;
  const rbac = {
    measurable: rbacRoles != null,
    structural_ready: (rbacRoles ?? 0) > 0 && (rbacPerms ?? 0) > 0,
    roles: rbacRoles,
    permissions: rbacPerms,
    grants: (sec as any)?.rbac?.grants ?? null,
    live_super_admins: (sec as any)?.live_vs_formal?.live_super_admins ?? null,
    enforcement: 'advisory',
    note: (sec as any)?.live_vs_formal?.note
      ?? 'Formal RBAC is advisory; the live users.role super_admin gate is the authoritative enforcement boundary. These are separate axes — MX-106X does not change enforcement.',
  };

  // Audit trail
  const audit = {
    measurable: gov != null,
    data_governance_events_30d: (gov as any)?.headline?.data_governance_events_30d ?? null,
    detail: (gov as any)?.audit ?? null,
    note: 'Governance audit-trail activity over the trailing 30 days.',
  };

  // Approval workflows
  const approvals = {
    measurable: gov != null,
    total: (gov as any)?.approvals?.totals?.total ?? null,
    pending: (gov as any)?.approvals?.totals?.pending ?? null,
    pending_headline: (gov as any)?.headline?.pending_approvals ?? null,
    note: 'Approval-workflow throughput. Pending count is informational, not a blocker by itself.',
  };

  // Compliance posture index (measurable pillars only)
  const compliance = {
    measurable: (gov as any)?.compliance?.measurable ?? false,
    score: (gov as any)?.compliance?.score ?? null,
    pillars: (gov as any)?.compliance?.pillars ?? null,
    note: 'Transparent compliance posture over measurable pillars only; null when no pillar is measurable (governance not yet activated).',
  };

  // Data governance
  const data_governance = { detail: (gov as any)?.data_governance ?? null };

  // AI governance (governance-v2) — structural substrate probes ONLY (those engines persist; we never call them).
  const aiGovTables = [
    'model_governance_registry',
    'ai_decision_audits',
    'fairness_evaluations',
    'psychometric_models',
    'reliability_validation_models',
    'competency_validity_models',
    'explainability_chains',
  ];
  const aiGovPresence: Record<string, boolean> = {};
  for (const t of aiGovTables) aiGovPresence[t] = await tablePresent(pool, t);
  const aiGovPresent = Object.values(aiGovPresence).filter(Boolean).length;
  const ai_governance = {
    measurable: aiGovPresent > 0,
    substrate_present: aiGovPresent,
    substrate_total: aiGovTables.length,
    structural_pct: rate(aiGovPresent, aiGovTables.length),
    tables: aiGovPresence,
    note: 'AI-governance substrate (explainability / fairness / psychometrics / model registry). Structural presence only — those engines mutate, so MX-106X probes their tables read-only and never invokes them.',
  };

  // Question certification (assessment governance)
  const question_certification = {
    measurable: (qcert as any)?.ok === true,
    certified: (qcert as any)?.certified ?? null,
    needs_review: (qcert as any)?.needs_review ?? null,
    failed: (qcert as any)?.failed ?? null,
    total: (qcert as any)?.total ?? null,
    note: (qcert as any)?.confidence_note ?? 'Question-certification posture over the assessment bank.',
  };

  // Structural readiness = share of governance dimensions structurally present.
  const dims = [
    rbac.structural_ready,
    (audit.data_governance_events_30d ?? null) != null,
    ai_governance.measurable,
    question_certification.measurable,
  ];
  const structuralReady = dims.filter(Boolean).length;
  const structuralPct = rate(structuralReady, dims.length);
  const verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_MEASURABLE' =
    structuralPct == null ? 'NOT_MEASURABLE'
      : structuralPct >= 90 ? 'PASS' : structuralPct >= 60 ? 'PARTIAL' : 'FAIL';

  return {
    view: 'security_governance_certification',
    version: GO_LIVE_CERTIFICATION_VERSION,
    dimensions: { rbac, audit, approvals, compliance, data_governance, ai_governance, question_certification },
    structural_readiness_pct: structuralPct,
    structural_dimensions_ready: structuralReady,
    structural_dimensions_total: dims.length,
    verdict,
    verdict_axis: 'structural/config',
    rbac_enforcement_note: 'Formal RBAC is ADVISORY; the live super_admin gate is authoritative. MX-106X composes the existing advisory engines and does NOT change enforcement.',
    read_only: true,
  };
}

// ── PHASE 9 — FINAL GO-LIVE CERTIFICATION (9 yes/no questions + 5-level ladder) ───────

type Answer = 'yes' | 'no' | 'abstain';

function answerFromBool(b: boolean | null | undefined): Answer {
  if (b == null) return 'abstain';
  return b ? 'yes' : 'no';
}

export async function goLiveCertification(pool: Pool) {
  const [cert, journey, outcome, scal, secg] = await Promise.all([
    safe(() => recertification(pool)),
    safe(() => unifiedJourney(pool)),
    safe(() => outcomeReadiness(pool)),
    safe(() => scalabilityCertification(pool)),
    safe(() => securityGovernanceCertification(pool)),
  ]);

  const subsystems: any[] = (cert as any)?.subsystems ?? [];
  const subStatus = (key: string): string | null => subsystems.find((s) => s.key === key)?.status ?? null;

  // Q1 — Platform core (super admin + auth) structurally ready
  const q1Status = subStatus('super_admin');
  const q1 = q1Status == null ? null : q1Status === 'PASS';

  // Q2 — Competency framework + assessment engine structurally ready
  const q2cf = subStatus('competency_framework');
  const q2ae = subStatus('assessment_engine');
  const q2 = q2cf == null && q2ae == null ? null : (q2cf === 'PASS' && q2ae === 'PASS');

  // Q3 — Candidate journey end-to-end structurally functional
  const candPct = (journey as any)?.candidate?.completion?.structural_pct ?? null;
  const brokenLinks: any[] = (journey as any)?.broken_links ?? [];
  const candBroken = brokenLinks.filter((b) => String(b?.surface ?? '').toLowerCase().includes('candidate')).length;
  const q3 = candPct == null ? null : (candPct >= 90 && candBroken === 0);

  // Q4 — Employer journey end-to-end structurally functional
  const empPct = (journey as any)?.employer?.completion?.coverage_pct ?? null;
  const empBroken = brokenLinks.filter((b) => String(b?.surface ?? '').toLowerCase().includes('employer')).length;
  const q4 = empPct == null ? null : (empPct >= 90 && empBroken === 0);

  // Q5 — Enterprise certification PASS (structural ≥ 90%)
  const certVerdict = (cert as any)?.verdict ?? null;
  const q5 = certVerdict == null ? null : certVerdict === 'PASS';

  // Q6 — Security & governance structurally ready
  const secVerdict = (secg as any)?.verdict ?? null;
  const q6 = secVerdict == null || secVerdict === 'NOT_MEASURABLE' ? null : (secVerdict === 'PASS');

  // Q7 — Scalability / multi-tenant structurally ready
  const scalVerdict = (scal as any)?.verdict ?? null;
  const q7 = scalVerdict == null || scalVerdict === 'NOT_MEASURABLE' ? null : (scalVerdict === 'PASS');

  // Q8 — Real adoption present (live non-demo data across subsystems)
  const adopted = (cert as any)?.summary?.adopted ?? null;
  const q8 = adopted == null ? null : adopted > 0;

  // Q9 — Outcome intelligence evidence-backed / calibrated
  const evidenceBacked = (outcome as any)?.confidence?.evidence_backed ?? null;
  const q9 = evidenceBacked == null ? null : evidenceBacked === true;

  const questions = [
    { id: 'platform_core_ready', axis: 'structural', question: 'Is the platform core (super admin + authentication) structurally ready?', answer: answerFromBool(q1), evidence: { super_admin_subsystem: q1Status } },
    { id: 'assessment_ready', axis: 'structural', question: 'Are the competency framework and assessment engine structurally ready?', answer: answerFromBool(q2), evidence: { competency_framework: q2cf, assessment_engine: q2ae } },
    { id: 'candidate_journey_ready', axis: 'structural', question: 'Is the candidate journey end-to-end structurally functional?', answer: answerFromBool(q3), evidence: { candidate_structural_pct: candPct, candidate_broken_links: candBroken } },
    { id: 'employer_journey_ready', axis: 'structural', question: 'Is the employer journey end-to-end structurally functional?', answer: answerFromBool(q4), evidence: { employer_coverage_pct: empPct, employer_broken_links: empBroken } },
    { id: 'enterprise_certification_pass', axis: 'structural', question: 'Does the platform pass enterprise certification (structural ≥ 90%)?', answer: answerFromBool(q5), evidence: { enterprise_verdict: certVerdict, structural_pct: (cert as any)?.enterprise_structural_pct ?? null } },
    { id: 'security_governance_ready', axis: 'governance', question: 'Are security and governance structurally ready?', answer: answerFromBool(q6), evidence: { security_verdict: secVerdict, structural_pct: (secg as any)?.structural_readiness_pct ?? null } },
    { id: 'scalability_ready', axis: 'operational', question: 'Is the platform structurally ready to scale (multi-tenant + monitoring)?', answer: answerFromBool(q7), evidence: { scalability_verdict: scalVerdict, structural_pct: (scal as any)?.structural_readiness_pct ?? null } },
    { id: 'real_adoption_present', axis: 'adoption', question: 'Is there real adoption (live non-demo data)?', answer: answerFromBool(q8), evidence: { adopted_subsystems: adopted } },
    { id: 'outcome_evidence_backed', axis: 'outcome', question: 'Is outcome intelligence evidence-backed / calibrated (≥ k_min realized outcomes)?', answer: answerFromBool(q9), evidence: { evidence_backed: evidenceBacked, k_min: GO_LIVE_K_MIN } },
  ];

  const answered_yes = questions.filter((q) => q.answer === 'yes').length;
  const answered_no = questions.filter((q) => q.answer === 'no').length;
  const abstained = questions.filter((q) => q.answer === 'abstain').length;

  // 5-level ladder (cumulative gates). An abstain is NOT a yes — it cannot advance a gate.
  const yes = (a: Answer) => a === 'yes';
  const q = (id: string) => questions.find((x) => x.id === id)!.answer;

  const gateProductionReady = yes(q('platform_core_ready')) && yes(q('assessment_ready'))
    && yes(q('candidate_journey_ready')) && yes(q('employer_journey_ready'));
  const gateEnterpriseReady = gateProductionReady && yes(q('enterprise_certification_pass'))
    && yes(q('security_governance_ready')) && yes(q('scalability_ready'));
  const gateMarketReady = gateEnterpriseReady && yes(q('real_adoption_present'));
  const gateOutcomeValidated = gateMarketReady && yes(q('outcome_evidence_backed'));

  const LEVELS = [
    { index: 0, key: 'prototype', label: 'Prototype' },
    { index: 1, key: 'production_ready', label: 'Production Ready' },
    { index: 2, key: 'enterprise_ready', label: 'Enterprise Ready' },
    { index: 3, key: 'market_ready', label: 'Market Ready' },
    { index: 4, key: 'outcome_validated', label: 'Outcome Validated' },
  ];
  const levelIndex = gateOutcomeValidated ? 4 : gateMarketReady ? 3 : gateEnterpriseReady ? 2 : gateProductionReady ? 1 : 0;
  const level = LEVELS[levelIndex];

  const RECOMMENDATIONS: Record<number, string> = {
    0: 'NOT READY for production. Core structural gates (platform / assessment / candidate / employer journeys) are not all met. Resolve the unmet structural questions before any launch.',
    1: 'PRODUCTION READY for a controlled launch of the core candidate + employer journeys. Enterprise, security, and scalability gates must be met before enterprise/multi-tenant onboarding.',
    2: 'ENTERPRISE READY — structurally certified for enterprise/multi-tenant onboarding. Real adoption (live non-demo customers) is required to advance to Market Ready.',
    3: 'MARKET READY — structurally certified with real adoption present. Outcome evidence (≥ k_min realized outcomes, calibrated) is required to advance to Outcome Validated.',
    4: 'OUTCOME VALIDATED — the highest certification level: structurally certified, adopted, and outcome-evidence-backed.',
  };

  return {
    view: 'go_live_certification',
    version: GO_LIVE_CERTIFICATION_VERSION,
    disclaimer: GO_LIVE_DISCLAIMER,
    questions,
    summary: { total: questions.length, answered_yes, answered_no, abstained },
    overall_checklist_pct: rate(answered_yes, questions.length),
    overall_note: 'Overall = share of the 9 go-live questions answered YES (checklist completion). It is reported ALONGSIDE the six axes — it is NOT an average of them.',
    level: { ...level },
    ladder: LEVELS,
    gates: { production_ready: gateProductionReady, enterprise_ready: gateEnterpriseReady, market_ready: gateMarketReady, outcome_validated: gateOutcomeValidated },
    recommendation: RECOMMENDATIONS[levelIndex],
    read_only: true,
  };
}

// ── PHASE 7 — SUPER ADMIN GO-LIVE CENTER (per-domain health + Launch Readiness) ───────

export async function goLiveCommandCenter(pool: Pool) {
  const [cc, axes, scal, secg, gocert] = await Promise.all([
    safe(() => commandCenter(pool)),
    safe(() => sixAxisReadiness(pool)),
    safe(() => scalabilityCertification(pool)),
    safe(() => securityGovernanceCertification(pool)),
    safe(() => goLiveCertification(pool)),
  ]);

  return {
    view: 'go_live_command_center',
    version: GO_LIVE_CERTIFICATION_VERSION,
    disclaimer: GO_LIVE_DISCLAIMER,
    // Per-domain platform health (reuse MX-105X's 12-category command center verbatim).
    domains: (cc as any)?.categories ?? null,
    domain_summary: (cc as any)?.summary ?? null,
    // Launch readiness panel — composed, axes kept separate.
    launch_readiness: {
      axes: (axes as any)?.axes ?? null,
      scalability: scal ? { verdict: (scal as any).verdict, structural_pct: (scal as any).structural_readiness_pct, load_capacity: 'not_measurable' } : null,
      security_governance: secg ? { verdict: (secg as any).verdict, structural_pct: (secg as any).structural_readiness_pct, rbac_enforcement: 'advisory' } : null,
      certification_level: gocert ? { ...(gocert as any).level, overall_checklist_pct: (gocert as any).overall_checklist_pct } : null,
      recommendation: (gocert as any)?.recommendation ?? null,
    },
    read_only: true,
  };
}

// ── PHASE 8 — FOUNDER GO-LIVE CENTER (executive %s + Top Risks/Gaps + Recommendation) ─

export async function founderGoLiveCenter(pool: Pool) {
  const [founder, axes, cert, scal, secg, journey, gocert] = await Promise.all([
    safe(() => founderCommandCenter(pool)),
    safe(() => sixAxisReadiness(pool)),
    safe(() => recertification(pool)),
    safe(() => scalabilityCertification(pool)),
    safe(() => securityGovernanceCertification(pool)),
    safe(() => unifiedJourney(pool)),
    safe(() => goLiveCertification(pool)),
  ]);

  const axisScore = (name: string): number | null =>
    ((axes as any)?.axes ?? []).find((a: any) => a.axis === name)?.score ?? null;

  // Executive percentages — each from its OWN axis. Overall = go-live checklist completion (NOT a blend of axes).
  const executive = {
    overall_checklist_pct: (gocert as any)?.overall_checklist_pct ?? null,
    structural_pct: axisScore('structural'),
    activation_pct: axisScore('activation'),
    adoption_pct: axisScore('adoption'),
    operational_pct: axisScore('operational'),
    outcome_coverage_pct: axisScore('outcome'),
    outcome_confidence: ((axes as any)?.axes ?? []).find((a: any) => a.axis === 'outcome')?.confidence ?? null,
    market: ((axes as any)?.axes ?? []).find((a: any) => a.axis === 'market') ?? null,
    enterprise_certification_pct: (cert as any)?.enterprise_structural_pct ?? null,
    note: 'Each percentage is from its own SEPARATE axis. overall_checklist_pct is go-live checklist completion (share of 9 questions = YES), NOT an average of the axes.',
  };

  // Top Gaps — subsystems with missing structural tables (FAIL first, then PARTIAL).
  const subs: any[] = (cert as any)?.subsystems ?? [];
  const topGaps = subs
    .filter((s) => s.status === 'FAIL' || s.status === 'PARTIAL')
    .sort((a, b) => (a.status === 'FAIL' ? -1 : 1) - (b.status === 'FAIL' ? -1 : 1))
    .slice(0, 8)
    .map((s) => ({ key: s.key, label: s.label, status: s.status, missing_tables: s.structural?.missing ?? null }));

  // Top Risks — wired but switched OFF (activation false) + structural broken links.
  const offRisks = subs
    .filter((s) => s.activation?.switched_on === false && s.structural?.ok === true)
    .slice(0, 6)
    .map((s) => ({ type: 'activation_off', key: s.key, label: s.label, detail: 'Structurally present but feature flag is OFF.' }));
  const brokenLinks: any[] = (journey as any)?.broken_links ?? [];
  const linkRisks = brokenLinks.slice(0, 6).map((b: any) => ({ type: 'broken_link', detail: b }));
  const topRisks = [...offRisks, ...linkRisks].slice(0, 10);

  return {
    view: 'founder_go_live_center',
    version: GO_LIVE_CERTIFICATION_VERSION,
    disclaimer: GO_LIVE_DISCLAIMER,
    executive,
    certification_level: (gocert as any)?.level ?? null,
    go_live_recommendation: (gocert as any)?.recommendation ?? null,
    scalability: scal ? { verdict: (scal as any).verdict, structural_pct: (scal as any).structural_readiness_pct } : null,
    security_governance: secg ? { verdict: (secg as any).verdict, structural_pct: (secg as any).structural_readiness_pct } : null,
    top_gaps: topGaps,
    top_risks: topRisks,
    founder_metrics: (founder as any)?.metrics ?? null,
    read_only: true,
  };
}

// ── OVERVIEW — fold the headline of every Go-Live view ────────────────────────────────

export async function goLiveOverview(pool: Pool) {
  const [axes, scal, secg, gocert] = await Promise.all([
    safe(() => sixAxisReadiness(pool)),
    safe(() => scalabilityCertification(pool)),
    safe(() => securityGovernanceCertification(pool)),
    safe(() => goLiveCertification(pool)),
  ]);

  return {
    ok: true,
    view: 'overview',
    version: GO_LIVE_CERTIFICATION_VERSION,
    enterprise_certification_version: ENTERPRISE_CERTIFICATION_VERSION,
    disclaimer: GO_LIVE_DISCLAIMER,
    six_axis: ((axes as any)?.axes ?? []).map((a: any) => ({ axis: a.axis, label: a.label, measurable: a.measurable, score: a.score, status: a.status })),
    scalability: scal ? { verdict: (scal as any).verdict, structural_pct: (scal as any).structural_readiness_pct } : null,
    security_governance: secg ? { verdict: (secg as any).verdict, structural_pct: (secg as any).structural_readiness_pct } : null,
    certification: gocert ? {
      level: (gocert as any).level,
      overall_checklist_pct: (gocert as any).overall_checklist_pct,
      answered_yes: (gocert as any).summary?.answered_yes,
      abstained: (gocert as any).summary?.abstained,
      total: (gocert as any).summary?.total,
      recommendation: (gocert as any).recommendation,
    } : null,
    read_only: true,
  };
}
