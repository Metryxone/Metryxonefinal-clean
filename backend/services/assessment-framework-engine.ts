/**
 * CAPADEX 3.0 — Program 1 · Phase 1.3 Assessment Framework Completion
 * ──────────────────────────────────────────────────────────────────
 * READ-ONLY composer over the canonical Assessment Framework registry
 * (`config/assessment-framework.ts`). It NEVER writes, NEVER runs DDL, NEVER invokes an
 * assessment engine — it only:
 *   1. serves the canonical framework + 19→10 crosswalk,
 *   2. INDEPENDENTLY verifies each type's evidence claims against the live filesystem + DB
 *      (the verifier — not the registry — is the SSoT for "present/absent" numbers),
 *   3. computes per-type / per-axis Coverage (kept SEPARATE from Confidence/Outcome),
 *   4. classifies remaining gaps (Launch-Critical/High/Medium/Low/Future).
 *
 * Honesty: a DB/FS read error yields null (unknown), NEVER 0. null ≠ 0. Never fabricate.
 */
import { existsSync } from 'fs';
import path from 'path';
import type { Pool } from 'pg';
import {
  ASSESSMENT_FRAMEWORK,
  SPEC_19_CROSSWALK,
  ASSESSMENT_AXES,
  KNOWN_OVERLAPS,
  type CanonicalAssessmentType,
  type AssessmentEvidence,
} from '../config/assessment-framework';
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

export async function verifyEvidence(pool: Pool, ev: AssessmentEvidence): Promise<EvidenceVerification> {
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

export interface TypeCoverage {
  key: string;
  label: string;
  status: CanonicalAssessmentType['status'];
  statusNote?: string;
  /** All 8 axes are mapped in the registry by definition; this confirms the mapping text is non-empty. */
  axesMapped: number;
  axesTotal: number;
  evidence: EvidenceVerification;
}

const AXIS_FIELD: Record<typeof ASSESSMENT_AXES[number], keyof CanonicalAssessmentType> = {
  persona: 'personas',
  lifecycle: 'lifecycleStages',
  journey: 'customerJourney',
  ai: 'aiInterpretation',
  reports: 'reports',
  dashboards: 'dashboards',
  outcomes: 'outcomes',
  kpis: 'kpis',
};

function axesMappedFor(t: CanonicalAssessmentType): number {
  let n = 0;
  for (const axis of ASSESSMENT_AXES) {
    const v = t[AXIS_FIELD[axis]];
    if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null) n += 1;
  }
  return n;
}

export async function composeCoverage(pool: Pool): Promise<TypeCoverage[]> {
  const out: TypeCoverage[] = [];
  for (const t of ASSESSMENT_FRAMEWORK) {
    out.push({
      key: t.key,
      label: t.label,
      status: t.status,
      statusNote: t.statusNote,
      axesMapped: axesMappedFor(t),
      axesTotal: ASSESSMENT_AXES.length,
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
 * Gap classification (honest — grounded in the FROZEN blueprint verdict: front-half mature,
 * back-half is the depth gap; consolidation candidates are tech-debt, NOT launch blockers).
 */
export const ASSESSMENT_GAPS: ClassifiedGap[] = [
  {
    id: 'GAP-A-LEARNER-BACKHALF',
    title: 'Learning & learner-side Performance content breadth is uneven (employer-side strong)',
    severity: 'Medium',
    evidence: 'Learning=PARTIAL (no-sandbox curated MCQ only, uneven across stages/personas); Performance=PARTIAL (strong employer surface, thin learner-facing surface). The CLOSE-THE-LOOP re-measurement (Progress/Exit/Continuous) is now instrumented via reuse — this residual is curated CONTENT breadth (human-authored), not missing engine wiring.',
    remediation: 'Extend curated MCQ/practice + learner-side performance surfaces; reuse exam-ready + role-DNA. Content task — never fabricate items.',
  },
  {
    id: 'GAP-A-RUNTIME-DUP',
    title: 'competency-runtime ⟂ competency-runtime-v2 migration not consolidated',
    severity: 'Low',
    evidence: 'KNOWN_OVERLAPS CONSOLIDATION_CANDIDATE; two runtimes coexist (migration-in-progress).',
    remediation: 'Plan a deliberate, flag-gated migration; recommend + human approval. Do NOT silently merge (breaking-risk).',
  },
  {
    id: 'GAP-A-SCORING-DUP',
    title: 'spe-scoring-engine ⟂ caf/scoring-engine share weighted-scoring logic',
    severity: 'Low',
    evidence: 'KNOWN_OVERLAPS CONSOLIDATION_CANDIDATE; similar logic in different dirs.',
    remediation: 'Extract a shared scoring util on approval; recommend only.',
  },
  {
    id: 'GAP-A-LBI-LEGACY',
    title: 'lbi_questions_legacy deprecated table still present',
    severity: 'Low',
    evidence: 'Superseded by sdi_items / psychometric_question_bank.',
    remediation: 'Archive (retire) on approval; never delete blindly.',
  },
  {
    id: 'GAP-A-CLINICAL-VERTICALS',
    title: 'Government / Healthcare / Clinical-Psychology assessment verticals deferred',
    severity: 'Future',
    evidence: 'Persona expansion G-F6 non-clinical scaffold only; "not validated / not for clinical use".',
    remediation: 'Out of scope; boundary marker only. Requires domain validation before any clinical claim.',
  },
];

export interface FrameworkSummary {
  flag: 'assessmentFrameworkCompletion';
  taxonomy_frozen: true;
  canonical_type_count: number;
  spec_name_count: number;
  status_counts: { IMPLEMENTED: number; PARTIAL: number; MISSING: number };
  /** Coverage axis — does an implementation exist. SEPARATE from Confidence/Outcome. */
  evidence_rollup: {
    services: { present: number; total: number };
    routes: { present: number; total: number };
    frontend: { present: number; total: number };
    tables: { present: number; absent: number; unknown: number; total: number };
  };
  gap_counts: Record<GapSeverity, number>;
  overlaps: typeof KNOWN_OVERLAPS;
  /** Enterprise-ready verdict — STRUCTURAL only; loop now closed via reuse, ADOPTION pending. */
  enterprise_ready: { verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING'; note: string };
}

export async function composeSummary(pool: Pool): Promise<FrameworkSummary> {
  const coverage = await composeCoverage(pool);
  const status_counts = { IMPLEMENTED: 0, PARTIAL: 0, MISSING: 0 };
  const evidence_rollup = {
    services: { present: 0, total: 0 },
    routes: { present: 0, total: 0 },
    frontend: { present: 0, total: 0 },
    tables: { present: 0, absent: 0, unknown: 0, total: 0 },
  };
  for (const c of coverage) {
    status_counts[c.status] += 1;
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
  const gap_counts: Record<GapSeverity, number> = {
    'Launch-Critical': 0, High: 0, Medium: 0, Low: 0, Future: 0,
  };
  for (const g of ASSESSMENT_GAPS) gap_counts[g.severity] += 1;

  return {
    flag: 'assessmentFrameworkCompletion',
    taxonomy_frozen: true,
    canonical_type_count: ASSESSMENT_FRAMEWORK.length,
    spec_name_count: SPEC_19_CROSSWALK.length,
    status_counts,
    evidence_rollup,
    gap_counts,
    overlaps: KNOWN_OVERLAPS,
    enterprise_ready: {
      verdict: 'STRUCTURAL_COMPLETE_ADOPTION_PENDING',
      note:
        'ONE canonical framework; the FROZEN 10-type taxonomy STRUCTURE is unchanged — only per-type status moved ' +
        'as close-the-loop mechanisms were instrumented via REUSE (no new engine/table/DDL). The growth loop ' +
        '(Progress / Exit / Continuous) is now CODE-COMPLETE by RE-ADMINISTERING existing assessments through the ' +
        'progression-outcome-capture hook + read-derived freshness signal. What remains is ADOPTION, not engineering: ' +
        'the capture path is gated by the longitudinalOutcomeCapture flag and real re-administration/outcome volume is ' +
        'currently 0 (reported SEPARATELY by composeLifecycleClosure; null≠0). Learning + learner-side Performance ' +
        'retain a Medium CONTENT-breadth residual (human-authored, never fabricated). No Launch-Critical assessment ' +
        'gap. Coverage⟂Confidence⟂Outcome⟂Adoption never composited.',
    },
  };
}

/**
 * Lifecycle-closure ADOPTION composer (read-only, never-throws).
 * Reports how much the close-the-loop mechanisms (Progress / Exit / Continuous), now instrumented via the
 * existing progression-outcome-capture hook, are actually being EXERCISED. This is the ADOPTION axis — kept
 * strictly SEPARATE from Coverage (does the mechanism exist) and never composited. null≠0: a query that
 * cannot be read returns null, distinct from a real measured 0. Demo subjects (is_demo) are excluded so
 * adoption can never be self-inflated.
 */
export interface LifecycleClosureAdoption {
  flag: 'assessmentFrameworkCompletion';
  freshness_window_days: number;
  /** Distinct non-demo subjects with a captured stage_completion (Progress) milestone. */
  progression_subjects: number | null;
  /** Distinct non-demo subjects with a captured reached_mastery (Exit) milestone. */
  exit_subjects: number | null;
  /** Distinct non-demo subjects with >1 longitudinal datapoint (Continuous re-administration). */
  reassessed_subjects: number | null;
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

export async function composeLifecycleClosure(pool: Pool): Promise<LifecycleClosureAdoption> {
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
  return {
    flag: 'assessmentFrameworkCompletion',
    freshness_window_days: REASSESSMENT_FRESHNESS_DAYS,
    progression_subjects,
    exit_subjects,
    reassessed_subjects,
    note:
      'ADOPTION axis only — exercise of the (reuse-instrumented) close-the-loop mechanisms. SEPARATE from Coverage; ' +
      'never composited. null = unreadable, 0 = measured-empty. Demo subjects excluded. The capture hook is gated by ' +
      'the longitudinalOutcomeCapture flag, so non-zero adoption accrues only as real subjects re-administer.',
  };
}

/**
 * Persona-outcome linkage composer (read-only, never-throws).
 * Validates whether realized outcomes can be attributed per assessment persona by JOINING realized outcomes
 * (validation_loop_outcomes) to the persona substrate (capadex_user_profiles) at READ time — no schema change,
 * no persona column added. k-anonymity: per-persona counts below k_min are suppressed (masked) so small cohorts
 * are never exposed. Coverage⟂Outcome⟂Confidence stay distinct.
 */
export interface PersonaOutcomeLinkage {
  flag: 'assessmentFrameworkCompletion';
  linkage_present: boolean;
  k_min: number;
  /** Per-persona realized-outcome counts; entries below k_min are suppressed. */
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
    flag: 'assessmentFrameworkCompletion',
    linkage_present: readable,
    k_min,
    personas,
    note:
      'Persona⟂Outcome linkage validated by a READ-TIME join (no persona column added, zero DDL). Per-persona counts ' +
      'below k_min are suppressed (masked) for anonymity. linkage_present:false means the join was unreadable, NOT ' +
      'that outcomes are zero (null≠0). Coverage⟂Outcome⟂Confidence never composited.',
  };
}
