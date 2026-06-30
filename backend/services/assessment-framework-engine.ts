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
    id: 'GAP-A-EXIT',
    title: 'Exit Assessment not instrumented (no stage/lifecycle exit gate event)',
    severity: 'High',
    evidence: 'config/assessment-framework.ts exit.status=MISSING; no exit-gate re-administration surface in repo.',
    remediation: 'Re-administer existing baseline/competency assessments at the evidence-gated stage boundary — NO new engine.',
  },
  {
    id: 'GAP-A-CONTINUOUS',
    title: 'Continuous Assessment has no scheduler/trigger (interval re-administration absent)',
    severity: 'High',
    evidence: 'Longitudinal/Bayesian substrate exists (longitudinal_patterns) but no scheduled re-run of assessments.',
    remediation: 'Add an interval trigger that re-administers existing assessments; reuse longitudinal substrate.',
  },
  {
    id: 'GAP-A-PROGRESS',
    title: 'Progress is not systematically re-administered (deltas exist, cadence does not)',
    severity: 'Medium',
    evidence: 'employability_scoring_runs deltas present; no systematic re-run policy → Progress = PARTIAL.',
    remediation: 'Define a re-measurement cadence per stage; reuse employability_scoring_runs + longitudinal_patterns.',
  },
  {
    id: 'GAP-A-LEARNER-BACKHALF',
    title: 'Learning & Performance are thin on the learner back-half (strong employer-side)',
    severity: 'Medium',
    evidence: '08_ASSESSMENT_BLUEPRINT: Learning PARTIAL (uneven), Performance PARTIAL (strong employer, thin learner).',
    remediation: 'Extend curated MCQ/practice + learner-side performance surfaces; reuse exam-ready + role-DNA.',
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
    id: 'GAP-A-OUTCOME-PERSONA',
    title: 'Realized outcomes carry no persona dimension',
    severity: 'Medium',
    evidence: 'validation_loop_outcomes has no persona column → outcome cannot be attributed per persona (G-F5 honest-null).',
    remediation: 'Add a persona dimension to outcome capture (future); currently abstains honestly.',
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
  /** Enterprise-ready verdict — STRUCTURAL only; back-half is forward work. */
  enterprise_ready: { verdict: 'STRUCTURAL_COMPLETE_BACKHALF_PENDING'; note: string };
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
      verdict: 'STRUCTURAL_COMPLETE_BACKHALF_PENDING',
      note:
        'ONE canonical framework; front-half (Entry/Baseline/Diagnostic/Behaviour/Competency + employer Performance) ' +
        'is IMPLEMENTED and non-duplicative. NOT yet fully enterprise-ready: the closed growth loop (systematic ' +
        'Progress, Exit, Continuous) is forward work — to be instrumented by RE-ADMINISTERING existing assessments, ' +
        'not net-new engines. No Launch-Critical assessment gap. Coverage⟂Confidence⟂Outcome never composited.',
    },
  };
}
