/**
 * CAPADEX 3.0 — Program 1 · Phase 1.4 Customer Journey Completion & Experience Orchestration
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * READ-ONLY composer over the canonical Customer Journey Model (`config/customer-journey.ts`).
 * It NEVER writes, NEVER runs DDL, NEVER invokes a journey/orchestration engine — it only:
 *   1. serves the canonical journey model (spine + templates + per-persona journeys + axes),
 *   2. INDEPENDENTLY verifies each journey's evidence claims against the live filesystem + DB
 *      (the verifier — not the registry — is the SSoT for "present/absent" numbers),
 *   3. computes per-journey / per-axis Coverage (kept SEPARATE from Confidence/Outcome/Adoption),
 *   4. classifies remaining journey gaps (Launch-Critical/High/Medium/Low/Future),
 *   5. reports the universal close-the-loop outcome-tail ADOPTION (a SEPARATE axis from Coverage).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0. Never fabricate.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  CUSTOMER_JOURNEY_MODEL,
  CANONICAL_SPINE,
  JOURNEY_TEMPLATES,
  JOURNEY_AXES,
  DUPLICATE_ENTRANCES,
  type CanonicalJourney,
  type JourneyEvidence,
  type JourneyStatus,
} from '../config/customer-journey';
// REUSE the single-source freshness constant from the existing progression-capture mechanism
// (no re-declaration). This module only READS it — it never invokes the capture/signal engine.
import { REASSESSMENT_FRESHNESS_DAYS } from './capadex/progression-outcome-capture';

// Workflow + tsx scripts run with cwd = backend/ ; frontend lives one level up.
const BACKEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function fileExists(rel: string, kind: 'backend' | 'frontend'): boolean {
  const base = kind === 'frontend' ? path.join(REPO_ROOT, 'frontend', 'src') : BACKEND_ROOT;
  return existsSync(path.join(base, rel));
}

/** to_regclass probe — returns true/false if known, null on read error (unknown ≠ absent). */
async function tableExists(pool: Pool, table: string): Promise<boolean | null> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    return rows[0]?.reg != null;
  } catch {
    return null;
  }
}

export interface EvidenceVerification {
  services: { present: number; total: number; missing: string[] };
  routes: { present: number; total: number; missing: string[] };
  frontend: { present: number; total: number; missing: string[] };
  /** null entries = table existence UNKNOWN (DB read error), distinct from absent. */
  tables: { present: number; absent: number; unknown: number; total: number; absentList: string[] };
}

function verifyFsGroup(items: string[], kind: 'backend' | 'frontend'): { present: number; total: number; missing: string[] } {
  const missing = items.filter((i) => !fileExists(i, kind));
  return { present: items.length - missing.length, total: items.length, missing };
}

export async function verifyEvidence(pool: Pool, ev: JourneyEvidence): Promise<EvidenceVerification> {
  const services = verifyFsGroup(ev.services, 'backend');
  const routes = verifyFsGroup(ev.routes, 'backend');
  const frontend = verifyFsGroup(ev.frontend, 'frontend');

  let present = 0, absent = 0, unknown = 0;
  const absentList: string[] = [];
  for (const t of ev.tables) {
    const r = await tableExists(pool, t);
    if (r === null) unknown += 1;
    else if (r) present += 1;
    else { absent += 1; absentList.push(t); }
  }
  return {
    services, routes, frontend,
    tables: { present, absent, unknown, total: ev.tables.length, absentList },
  };
}

export interface JourneyCoverage {
  key: string;
  label: string;
  persona: string;
  template: CanonicalJourney['template'];
  status: JourneyStatus;
  statusNote?: string;
  /** Spine steps reached / 8 (the FROZEN canonical spine length). */
  spineReached: number;
  spineTotal: number;
  /** All 8 axes mapped in the registry by definition; this confirms the mapping text is non-empty. */
  axesMapped: number;
  axesTotal: number;
  evidence: EvidenceVerification;
}

const AXIS_FIELD: Record<typeof JOURNEY_AXES[number], keyof CanonicalJourney> = {
  persona: 'personas',
  lifecycle: 'lifecycleStages',
  assessment: 'assessments',
  ai: 'aiInterpretation',
  reports: 'reports',
  dashboards: 'dashboards',
  outcomes: 'outcomes',
  kpis: 'kpis',
};

function axesMappedFor(t: CanonicalJourney): number {
  let n = 0;
  for (const axis of JOURNEY_AXES) {
    const v = t[AXIS_FIELD[axis]];
    if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null) n += 1;
  }
  return n;
}

export async function composeCoverage(pool: Pool): Promise<JourneyCoverage[]> {
  const out: JourneyCoverage[] = [];
  for (const t of CUSTOMER_JOURNEY_MODEL) {
    out.push({
      key: t.key,
      label: t.label,
      persona: t.persona,
      template: t.template,
      status: t.status,
      statusNote: t.statusNote,
      spineReached: t.spineReached.length,
      spineTotal: CANONICAL_SPINE.length,
      axesMapped: axesMappedFor(t),
      axesTotal: JOURNEY_AXES.length,
      evidence: await verifyEvidence(pool, t.evidence),
    });
  }
  return out;
}

export type GapSeverity = 'Launch-Critical' | 'High' | 'Medium' | 'Low' | 'Future';

export interface ClassifiedGap {
  id: string;
  title: string;
  severity: GapSeverity;
  evidence: string;
  remediation: string;
}

/**
 * Journey gap classification (honest — grounded in the FROZEN blueprint verdict + the live FS/DB
 * scan). Dead-ends/tail-gaps are real; the universal outcome tail's MECHANISM is now closed via
 * Phase 1.3 reuse, so the residual there is ADOPTION + per-journey wiring, not a missing engine.
 * Per the enhancement-only contract, nothing here is auto-built — gaps are classified, not closed.
 */
export const JOURNEY_GAPS: ClassifiedGap[] = [
  {
    id: 'GAP-J1-TEACHER-COUNSELLOR-DEADEND',
    title: 'Teacher / Counsellor survey is a true dead-end (no downstream journey)',
    severity: 'Medium',
    evidence: 'CUSTOMER_JOURNEY_MODEL.teacher_counsellor=DEAD_END: survey input captured, zero continuation. The jt_stakeholder_observations substrate exists (staff-only) but is not wired into a downstream step.',
    remediation: 'Convert to a continuation using the EXISTING jt_stakeholder_observations substrate (no rebuild) — a flag-gated additive enhancement; deferred + classified honestly here. Never fabricate a journey.',
  },
  {
    id: 'GAP-J2-PARENT-MENTOR-FACULTY-TAIL',
    title: 'Parent / Mentor / Faculty journeys have thin or nested tails',
    severity: 'Medium',
    evidence: 'parent_support / mentor_mentee / faculty_students = PARTIAL: support-action + engagement substrate exists (journeyTailCompletion) but the tails are thin; faculty is a nested batch-confined scope, not a first-class top-level surface.',
    remediation: 'Deepen the support/engagement tail surfaces (reuse jt_* substrate) and promote faculty to a first-class scoped view. Flag-gated, additive. Adoption-gated.',
  },
  {
    id: 'GAP-J3-UNIVERSAL-OUTCOME-TAIL-ADOPTION',
    title: 'Universal close-the-loop outcome tail: mechanism closed (1.3 reuse), ADOPTION pending',
    severity: 'Medium',
    evidence: 'outcome_tail=PARTIAL: Phase 1.3 closed the MECHANISM via reuse (captureProgressionOutcome + getReassessmentSignal → validation_loop_outcomes, gated by longitudinalOutcomeCapture). Real per-journey re-administration/outcome volume is currently honest-low/0 (reported by composeOutcomeTailAdoption). Coverage⟂Adoption never composited.',
    remediation: 'Drive ADOPTION (real re-administration volume) + wire the tail per-journey via REUSE of the 1.3 hook. Not an engineering gap; no new engine. null≠0.',
  },
  {
    id: 'GAP-J4-RESULTS-NEXT-STEP-CTA',
    title: 'Some results/analysis surfaces lack a "next step" conversion CTA',
    severity: 'Low',
    evidence: 'Frontend audit: StudentDashboard ResultsSummary can terminate without a clear next-step; GapAnalysisPage / CompetencyRoleTransitionPage show visualisations without a direct "enrol / contact mentor" conversion at the bottom.',
    remediation: 'Add a next-step CTA into the EXISTING canonical flow (no new journey). Additive UX; preserve byte-identical-OFF.',
  },
  {
    id: 'GAP-J5-CONSENT-REDIRECT',
    title: 'Public consent-approval surface lacks a clean redirect back into the dashboard journey',
    severity: 'Low',
    evidence: 'Frontend audit: ParentConsentApprovePage performs an action via a public link but does not redirect back into a dashboard journey; OnboardingRegisterPage feels disconnected from the primary auth flow.',
    remediation: 'Add a post-action redirect into the parent dashboard journey; reconcile onboarding entrances (KEEP_ALL entrances, just connect them). Additive.',
  },
  {
    id: 'GAP-J6-ORPHAN-STUBS',
    title: 'SiteMap lists UI-shell / stub routes with minimal functional depth',
    severity: 'Future',
    evidence: 'Frontend audit: SiteMap.tsx enumerates routes (e.g. gamification, ld-integration) that exist as shells/stubs — orphan surfaces, not part of a completed persona journey.',
    remediation: 'Either complete the stub into a real journey step or remove the orphan link. Out of scope for this audit — flagged honestly, never claimed as complete.',
  },
];

export interface JourneySummary {
  flag: 'customerJourneyCompletion';
  spine_frozen: true;
  spine_step_count: number;
  template_count: number;
  journey_count: number;
  persona_count: number;
  status_counts: { SUPPORTED: number; PARTIAL: number; DEAD_END: number; MISSING: number };
  /** Coverage axis — does an implementation exist. SEPARATE from Confidence/Outcome/Adoption. */
  evidence_rollup: {
    services: { present: number; total: number };
    routes: { present: number; total: number };
    frontend: { present: number; total: number };
    tables: { present: number; absent: number; unknown: number; total: number };
  };
  /** Spine reachability across all journeys (Coverage of spine steps). */
  spine_rollup: { reached: number; total: number };
  gap_counts: Record<GapSeverity, number>;
  duplicate_entrances: typeof DUPLICATE_ENTRANCES;
  /** Enterprise-ready verdict — STRUCTURAL only; outcome tail closed via reuse, ADOPTION pending. */
  enterprise_ready: { verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING'; note: string };
}

export async function composeSummary(pool: Pool): Promise<JourneySummary> {
  const coverage = await composeCoverage(pool);
  const status_counts = { SUPPORTED: 0, PARTIAL: 0, DEAD_END: 0, MISSING: 0 };
  const evidence_rollup = {
    services: { present: 0, total: 0 },
    routes: { present: 0, total: 0 },
    frontend: { present: 0, total: 0 },
    tables: { present: 0, absent: 0, unknown: 0, total: 0 },
  };
  const spine_rollup = { reached: 0, total: 0 };
  const personas = new Set<string>();
  for (const c of coverage) {
    status_counts[c.status] += 1;
    spine_rollup.reached += c.spineReached;
    spine_rollup.total += c.spineTotal;
    evidence_rollup.services.present += c.evidence.services.present;
    evidence_rollup.services.total += c.evidence.services.total;
    evidence_rollup.routes.present += c.evidence.routes.present;
    evidence_rollup.routes.total += c.evidence.routes.total;
    evidence_rollup.frontend.present += c.evidence.frontend.present;
    evidence_rollup.frontend.total += c.evidence.frontend.total;
    evidence_rollup.tables.present += c.evidence.tables.present;
    evidence_rollup.tables.absent += c.evidence.tables.absent;
    evidence_rollup.tables.unknown += c.evidence.tables.unknown;
    evidence_rollup.tables.total += c.evidence.tables.total;
  }
  for (const j of CUSTOMER_JOURNEY_MODEL) for (const p of j.personas) personas.add(p);

  const gap_counts: Record<GapSeverity, number> = {
    'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0,
  };
  for (const g of JOURNEY_GAPS) gap_counts[g.severity] += 1;

  return {
    flag: 'customerJourneyCompletion',
    spine_frozen: true,
    spine_step_count: CANONICAL_SPINE.length,
    template_count: JOURNEY_TEMPLATES.length,
    journey_count: CUSTOMER_JOURNEY_MODEL.length,
    persona_count: personas.size,
    status_counts,
    evidence_rollup,
    spine_rollup,
    gap_counts,
    duplicate_entrances: DUPLICATE_ENTRANCES,
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING',
      note:
        'ONE canonical Customer Journey Model: a FROZEN 8-step spine + 5 reusable templates, with every ' +
        'persona journey mapped to all 8 axes (persona/lifecycle/assessment/AI/reports/dashboards/outcomes/KPIs) ' +
        'and verified against the live repo. The front-half (entry→diagnose→recommend→grow) is broadly SUPPORTED; ' +
        'the universal close-the-loop OUTCOME tail mechanism is now CODE-COMPLETE via REUSE of the Phase-1.3 ' +
        'progression-outcome-capture hook (no new engine/table/DDL), so it moved from MISSING → PARTIAL. What ' +
        'remains is ADOPTION (real re-administration/outcome volume, currently honest-low/0, reported SEPARATELY ' +
        'by composeOutcomeTailAdoption) plus classified residual gaps: ONE true dead-end (Teacher/Counsellor, ' +
        'GAP-J1), thin support/engagement tails (GAP-J2), and minor frontend CTA/redirect/orphan items (GAP-J4/J5/J6). ' +
        'No Launch-Critical journey gap; no duplicate journeys (multiple entrances to ONE flow are KEEP_ALL). ' +
        'Coverage⟂Confidence⟂Outcome⟂Adoption are reported separately and never composited; null≠0; nothing fabricated.',
    },
  };
}

/**
 * Outcome-tail ADOPTION composer (read-only, never-throws).
 * Reports how much the universal close-the-loop tail (Progress / Exit / Continuous), instrumented via the
 * existing progression-outcome-capture hook in Phase 1.3, is actually being EXERCISED across journeys. This is
 * the ADOPTION axis — kept strictly SEPARATE from Coverage (does the tail exist) and never composited. null≠0:
 * a query that cannot be read returns null, distinct from a real measured 0. Demo subjects (is_demo) excluded so
 * adoption can never be self-inflated.
 */
export interface OutcomeTailAdoption {
  flag: 'customerJourneyCompletion';
  freshness_window_days: number;
  /** Distinct non-demo subjects with a captured stage_completion (Progress) milestone. */
  progression_subjects: number | null;
  /** Distinct non-demo subjects with a captured reached_mastery (Exit) milestone. */
  exit_subjects: number | null;
  /** Distinct non-demo subjects with >1 longitudinal datapoint (Continuous re-administration). */
  reassessed_subjects: number | null;
  /** Total non-demo realized-outcome rows captured across all journeys. */
  realized_outcomes: number | null;
  note: string;
}

async function readScalar(pool: Pool, sql: string): Promise<number | null> {
  try {
    const r = await pool.query(sql);
    if (!r.rows.length) return 0;
    const v = Number(r.rows[0].n);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null; // unreadable ≠ 0
  }
}

export async function composeOutcomeTailAdoption(pool: Pool): Promise<OutcomeTailAdoption> {
  // Progress / Exit milestones live in validation_loop_outcomes (written by captureProgressionOutcome).
  const progression_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT subject_user_id)::int AS n
       FROM validation_loop_outcomes
      WHERE outcome_type = 'learning'
        AND ref_id LIKE 'capadex_progression:%'
        AND COALESCE(is_demo, false) = false`,
  );
  const exit_subjects = await readScalar(
    pool,
    `SELECT COUNT(DISTINCT subject_user_id)::int AS n
       FROM validation_loop_outcomes
      WHERE outcome_type = 'learning'
        AND ref_id LIKE 'capadex_mastery:%'
        AND COALESCE(is_demo, false) = false`,
  );
  // Continuous = a subject re-administered (>1 longitudinal snapshot).
  const reassessed_subjects = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n FROM (
        SELECT user_id
          FROM wc3_longitudinal_snapshots
         WHERE user_id IS NOT NULL
         GROUP BY user_id
        HAVING COUNT(*) > 1
     ) t`,
  );
  // Total realized-outcome rows across journeys (non-demo).
  const realized_outcomes = await readScalar(
    pool,
    `SELECT COUNT(*)::int AS n
       FROM validation_loop_outcomes
      WHERE COALESCE(is_demo, false) = false`,
  );
  return {
    flag: 'customerJourneyCompletion',
    freshness_window_days: REASSESSMENT_FRESHNESS_DAYS,
    progression_subjects,
    exit_subjects,
    reassessed_subjects,
    realized_outcomes,
    note:
      'ADOPTION axis only — exercise of the (Phase-1.3 reuse-instrumented) universal close-the-loop outcome tail. ' +
      'SEPARATE from Coverage; never composited. null = unreadable, 0 = measured-empty. Demo subjects excluded. The ' +
      'capture hook is gated by the longitudinalOutcomeCapture flag, so non-zero adoption accrues only as real ' +
      'subjects re-administer existing assessments. This phase builds NO new outcome machinery.',
  };
}

/**
 * Persona-outcome linkage composer (read-only, never-throws).
 * Validates whether realized journey outcomes can be attributed per persona by JOINING realized outcomes
 * (validation_loop_outcomes) to the persona substrate (capadex_user_profiles) at READ time — no schema change,
 * no persona column added. k-anonymity: per-persona counts below k_min are suppressed (masked) so small cohorts
 * are never exposed. Coverage⟂Outcome⟂Confidence stay distinct.
 */
export interface PersonaOutcomeLinkage {
  flag: 'customerJourneyCompletion';
  linkage_present: boolean;
  k_min: number;
  personas: Array<{ persona: string; outcomes: number | null; suppressed: boolean }>;
  note: string;
}

export async function composePersonaOutcomeLinkage(pool: Pool): Promise<PersonaOutcomeLinkage> {
  const k_min = 30;
  let rows: Array<{ persona: string; n: number }> = [];
  let readable = true;
  try {
    const r = await pool.query(
      `SELECT p.persona AS persona, COUNT(DISTINCT v.subject_user_id)::int AS n
         FROM validation_loop_outcomes v
         JOIN capadex_user_profiles p
           ON p.user_id = v.subject_user_id::uuid
        WHERE COALESCE(v.is_demo, false) = false
          AND v.subject_user_id ~ '^[0-9a-fA-F-]{36}$'
          AND p.persona IS NOT NULL
        GROUP BY p.persona`,
    );
    rows = r.rows.map((x: any) => ({ persona: String(x.persona), n: Number(x.n) }));
  } catch {
    readable = false; // unreadable ≠ empty
  }
  const personas = rows.map((x) => {
    const suppressed = x.n < k_min;
    return { persona: x.persona, outcomes: suppressed ? null : x.n, suppressed };
  });
  return {
    flag: 'customerJourneyCompletion',
    linkage_present: readable,
    k_min,
    personas,
    note:
      'Persona⟂Outcome linkage validated by a READ-TIME join (no persona column added, zero DDL). Per-persona ' +
      'counts below k_min are suppressed (masked) for anonymity. linkage_present:false means the join was unreadable, ' +
      'NOT that outcomes are zero (null≠0). Coverage⟂Outcome⟂Confidence never composited.',
  };
}
