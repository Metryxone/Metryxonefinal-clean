/**
 * PHASE 5 — Talent Intelligence Aggregator (additive, read-only, compose-only).
 *
 * A strictly additive consolidation surface for the "Talent Intelligence & Hiring
 * Platform". It COMPOSES the already-built Phase-5 components into ONE coherent
 * read model. It NEVER recomputes a score, NEVER writes, NEVER runs DDL, and
 * NEVER throws — every probe is wrapped so a missing/unreadable table degrades to
 * an honest `absent`/`missing` section instead of a 500.
 *
 * Honesty contract (mirrors the platform-wide convention):
 *   - Coverage  = does the underlying data EXIST? (table present + row count)
 *   - Confidence = is the data SUFFICIENT / calibrated? (volume / calibration)
 *   These are reported as SEPARATE axes and are NEVER composited into one number.
 *   Absent data is reported as absent — never fabricated, never coerced to 0.
 *
 * The seven mission components and the tables they read (read-only):
 *   1. Employer Intelligence      → employer_jobs, employer_candidates, ep98_role_intelligence
 *   2. Recruiter Intelligence     → recruiter_interactions, hiring_outcomes
 *   3. Job Architecture           → ep98_role_intelligence, employer_jobs
 *   4. Talent Matching            → ep98_hiring_assessments, tig_calibration
 *   5. Assessment-led Hiring      → lbi_scores, employer_candidates (assessment_*)
 *   6. Hiring Intelligence        → ep98_hiring_assessments (6-dim match + 7 predictions)
 *   7. Workforce Intelligence     → p4_workforce_analytics, p5_workforce_intelligence
 */

import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags.js';

export const TALENT_INTELLIGENCE_VERSION = '5.0.0';

export type CoverageState = 'missing' | 'absent' | 'present';
export type ConfidenceBand = 'none' | 'provisional' | 'sufficient' | 'calibrated';

export interface SourceProbe {
  table: string;
  exists: boolean;
  rows: number | null; // null => could not be read (never fabricated to 0)
  note?: string;
}

export interface ComponentSummary {
  key: string;
  label: string;
  coverage: CoverageState; // data exists?
  confidence: ConfidenceBand; // data sufficient/calibrated?
  flags: Record<string, boolean>; // gating flags (transparency)
  sources: SourceProbe[];
  notes: string[];
}

export interface TalentIntelligenceOverview {
  version: string;
  scope: { kind: 'platform' | 'org'; org_id: string | null };
  components: ComponentSummary[];
  rollup: {
    components_total: number;
    components_with_data: number; // coverage === 'present'
    components_missing: number; // coverage === 'missing'
    confidence_distribution: Record<ConfidenceBand, number>;
    honest_state: string;
  };
  _meta: {
    read_only: true;
    composed: true;
    generated_at: string;
    disclaimer: string;
  };
}

// ---- low-level helpers (never throw) ---------------------------------------

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

/**
 * Read-only count probe. Returns:
 *   exists=false             → table not present (Coverage: missing)
 *   exists=true, rows=number → present (rows>0 = Coverage: present, else absent)
 *   exists=true, rows=null   → present but unreadable (honest, never coerced to 0)
 */
async function probe(
  pool: Pool,
  table: string,
  where?: string,
  params: unknown[] = [],
): Promise<SourceProbe> {
  const exists = await tableExists(pool, table);
  if (!exists) return { table, exists: false, rows: null, note: 'table not present' };
  try {
    const sql = `SELECT count(*)::int AS n FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const r = await pool.query(sql, params);
    const n = r.rows?.[0]?.n;
    return { table, exists: true, rows: typeof n === 'number' ? n : null };
  } catch (e: any) {
    return { table, exists: true, rows: null, note: `unreadable: ${e?.message ?? 'error'}` };
  }
}

function sumRows(probes: SourceProbe[]): number {
  // Only counts readable probes; null (unreadable/missing) contributes nothing
  // but is NOT treated as a real 0 (see coverageFrom).
  return probes.reduce((acc, p) => acc + (typeof p.rows === 'number' ? p.rows : 0), 0);
}

function coverageFrom(probes: SourceProbe[]): CoverageState {
  const anyExists = probes.some((p) => p.exists);
  if (!anyExists) return 'missing'; // none of the backing tables exist
  const anyData = probes.some((p) => typeof p.rows === 'number' && p.rows > 0);
  return anyData ? 'present' : 'absent'; // tables exist but empty => honest 'absent'
}

// ---- per-component composition (read-only) ---------------------------------

async function buildEmployer(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  const jobs = await probe(pool, 'employer_jobs', orgWhere ? `employer_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const cands = await probe(pool, 'employer_candidates', orgWhere ? `employer_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const roleIntel = await probe(pool, 'ep98_role_intelligence', orgWhere ? `org_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const sources = [jobs, cands, roleIntel];
  const candN = typeof cands.rows === 'number' ? cands.rows : 0;
  const coverage = coverageFrom(sources);
  const confidence: ConfidenceBand = candN >= 30 ? 'sufficient' : candN > 0 ? 'provisional' : 'none';
  return {
    key: 'employer_intelligence',
    label: 'Employer Intelligence',
    coverage,
    confidence,
    flags: { runtimeIntelligenceActivation: isFlagEnabled('runtimeIntelligenceActivation') },
    sources,
    notes:
      coverage === 'present'
        ? [`${candN} candidate record(s); ${typeof jobs.rows === 'number' ? jobs.rows : '?'} job posting(s).`]
        : ['Schema present but no employer jobs/candidates recorded — honest empty state.'],
  };
}

async function buildRecruiter(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  // recruiter_interactions / hiring_outcomes are hashed-recruiter/employer keyed,
  // so they are NOT directly org-scoped here (no plain org_id column).
  const inter = await probe(pool, 'recruiter_interactions');
  const outcomes = await probe(pool, 'hiring_outcomes');
  const sources = [inter, outcomes];
  const total = sumRows(sources);
  const coverage = coverageFrom(sources);
  const confidence: ConfidenceBand = total >= 30 ? 'sufficient' : total > 0 ? 'provisional' : 'none';
  return {
    key: 'recruiter_intelligence',
    label: 'Recruiter Intelligence',
    coverage,
    confidence,
    flags: { predictiveIntelligenceV2: isFlagEnabled('predictiveIntelligenceV2') },
    sources,
    notes:
      coverage === 'present'
        ? [`${typeof inter.rows === 'number' ? inter.rows : '?'} interaction(s); ${typeof outcomes.rows === 'number' ? outcomes.rows : '?'} hiring outcome(s).`]
        : ['Schema present but no recruiter interactions / hiring outcomes recorded.'],
  };
}

async function buildJobArchitecture(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  const roleIntel = await probe(pool, 'ep98_role_intelligence', orgWhere ? `org_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const jobs = await probe(pool, 'employer_jobs', orgWhere ? `employer_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const sources = [roleIntel, jobs];
  const coverage = coverageFrom(sources);
  const intelN = typeof roleIntel.rows === 'number' ? roleIntel.rows : 0;
  const confidence: ConfidenceBand = intelN >= 10 ? 'sufficient' : intelN > 0 ? 'provisional' : 'none';
  return {
    key: 'job_architecture',
    label: 'Job Architecture',
    coverage,
    confidence,
    flags: {
      competencyGraphRuntime: isFlagEnabled('competencyGraphRuntime'),
      roleDNARuntimeEnabled: isFlagEnabled('roleDNARuntimeEnabled'),
    },
    sources,
    notes:
      coverage === 'present'
        ? [`${intelN} computed role-intelligence record(s).`]
        : ['Role-DNA/graph engines live (flags ON) but no role analyses computed yet.'],
  };
}

async function buildTalentMatching(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  const assess = await probe(pool, 'ep98_hiring_assessments', orgWhere ? `org_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const calib = await probe(pool, 'tig_calibration', orgWhere ? `org_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const sources = [assess, calib];
  const coverage = coverageFrom(sources);
  // Confidence is gated on TIG calibration status, NOT raw match volume.
  let confidence: ConfidenceBand = 'none';
  let calibNote = 'No TIG calibration rows — match scores are uncalibrated (directional only).';
  try {
    if (calib.exists) {
      const c = await pool.query(
        `SELECT count(*) FILTER (WHERE status='calibrated')::int AS calibrated,
                count(*)::int AS total
           FROM tig_calibration${orgWhere ? ` WHERE org_id ${orgWhere}` : ''}`,
        orgWhere ? orgParams : [],
      );
      const calibrated = c.rows?.[0]?.calibrated ?? 0;
      const total = c.rows?.[0]?.total ?? 0;
      if (calibrated > 0) {
        confidence = 'calibrated';
        calibNote = `${calibrated}/${total} TIG band(s) calibrated.`;
      } else if (total > 0) {
        confidence = 'provisional';
        calibNote = `${total} TIG band(s) present but none calibrated yet.`;
      }
    }
  } catch {
    /* never-throws: leave confidence='none' */
  }
  return {
    key: 'talent_matching',
    label: 'Talent Matching',
    coverage,
    confidence,
    flags: { careerMatch: isFlagEnabled('careerMatch'), competencyGraphRuntime: isFlagEnabled('competencyGraphRuntime') },
    sources,
    notes: [calibNote],
  };
}

async function buildAssessmentLedHiring(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  const lbi = await probe(pool, 'lbi_scores'); // keyed by user_email, not org
  const assessed = await probe(
    pool,
    'employer_candidates',
    orgWhere ? `employer_id ${orgWhere} AND assessment_score IS NOT NULL` : 'assessment_score IS NOT NULL',
    orgWhere ? orgParams : [],
  );
  const sources = [lbi, assessed];
  const coverage = coverageFrom(sources);
  const lbiN = typeof lbi.rows === 'number' ? lbi.rows : 0;
  const confidence: ConfidenceBand = lbiN >= 30 ? 'sufficient' : lbiN > 0 ? 'provisional' : 'none';
  return {
    key: 'assessment_led_hiring',
    label: 'Assessment-led Hiring',
    coverage,
    confidence,
    flags: { adaptiveAssessmentRuntimeV2: isFlagEnabled('adaptiveAssessmentRuntimeV2') },
    sources,
    notes:
      coverage === 'present'
        ? [`${lbiN} LBI score row(s); ${typeof assessed.rows === 'number' ? assessed.rows : '?'} assessed candidate(s).`]
        : ['Adaptive assessment + LBI engines live but no assessment scores recorded yet.'],
  };
}

async function buildHiringIntelligence(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  const assess = await probe(pool, 'ep98_hiring_assessments', orgWhere ? `org_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const sources = [assess];
  const coverage = coverageFrom(sources);
  const n = typeof assess.rows === 'number' ? assess.rows : 0;
  const confidence: ConfidenceBand = n >= 30 ? 'sufficient' : n > 0 ? 'provisional' : 'none';
  return {
    key: 'hiring_intelligence',
    label: 'Hiring Intelligence',
    coverage,
    confidence,
    flags: { aiInferenceV2: isFlagEnabled('aiInferenceV2') },
    sources,
    notes:
      coverage === 'present'
        ? [`${n} hiring-assessment record(s) (6-dim match + 7 predictions each).`]
        : ['6-dim match + 7-prediction engine present but no hiring assessments computed yet.'],
  };
}

async function buildWorkforce(pool: Pool, orgWhere: string | null, orgParams: unknown[]): Promise<ComponentSummary> {
  // tenant-keyed; org param maps to tenant_id when supplied.
  const p4 = await probe(pool, 'p4_workforce_analytics', orgWhere ? `tenant_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const p5 = await probe(pool, 'p5_workforce_intelligence', orgWhere ? `tenant_id ${orgWhere}` : undefined, orgWhere ? orgParams : []);
  const sources = [p4, p5];
  const coverage = coverageFrom(sources);
  const total = sumRows(sources);
  const confidence: ConfidenceBand = total >= 30 ? 'sufficient' : total > 0 ? 'provisional' : 'none';
  return {
    key: 'workforce_intelligence',
    label: 'Workforce Intelligence',
    coverage,
    confidence,
    flags: {
      workforceOSV2: isFlagEnabled('workforceOSV2'),
      enterpriseWorkforceOSV2: isFlagEnabled('enterpriseWorkforceOSV2'),
    },
    sources,
    notes:
      coverage === 'present'
        ? [`${typeof p4.rows === 'number' ? p4.rows : '?'} analytics + ${typeof p5.rows === 'number' ? p5.rows : '?'} intelligence metric row(s).`]
        : ['Workforce OS engines live but no workforce metrics recorded yet.'],
  };
}

// ---- public API ------------------------------------------------------------

export async function buildTalentIntelligenceOverview(
  pool: Pool,
  orgId?: string | null,
): Promise<TalentIntelligenceOverview> {
  const org = orgId && String(orgId).trim() ? String(orgId).trim() : null;
  const orgWhere = org ? '= $1' : null;
  const orgParams = org ? [org] : [];

  const components = await Promise.all([
    buildEmployer(pool, orgWhere, orgParams),
    buildRecruiter(pool, orgWhere, orgParams),
    buildJobArchitecture(pool, orgWhere, orgParams),
    buildTalentMatching(pool, orgWhere, orgParams),
    buildAssessmentLedHiring(pool, orgWhere, orgParams),
    buildHiringIntelligence(pool, orgWhere, orgParams),
    buildWorkforce(pool, orgWhere, orgParams),
  ]);

  const confidence_distribution: Record<ConfidenceBand, number> = {
    none: 0,
    provisional: 0,
    sufficient: 0,
    calibrated: 0,
  };
  components.forEach((c) => {
    confidence_distribution[c.confidence] += 1;
  });
  const withData = components.filter((c) => c.coverage === 'present').length;
  const missing = components.filter((c) => c.coverage === 'missing').length;

  const honest_state =
    withData === 0
      ? 'All seven components are scaffolded but carry no operational data (schema present, rows absent). Engine/API-level only.'
      : `${withData}/7 component(s) carry operational data.`;

  return {
    version: TALENT_INTELLIGENCE_VERSION,
    scope: { kind: org ? 'org' : 'platform', org_id: org },
    components,
    rollup: {
      components_total: components.length,
      components_with_data: withData,
      components_missing: missing,
      confidence_distribution,
      honest_state,
    },
    _meta: {
      read_only: true,
      composed: true,
      generated_at: new Date().toISOString(),
      disclaimer:
        'Composed read-only view. Coverage (data exists) and Confidence (data sufficient/calibrated) are separate axes; absent data is reported as absent, never fabricated.',
    },
  };
}

export interface CandidateTalentView {
  version: string;
  candidate_id: string;
  found: boolean;
  candidate: Record<string, unknown> | null;
  hiring_assessment: Record<string, unknown> | null; // from ep98_hiring_assessments
  lbi: Record<string, unknown> | null; // from lbi_scores (by email)
  coverage: { profile: boolean; hiring_assessment: boolean; lbi: boolean };
  confidence: ConfidenceBand;
  notes: string[];
  _meta: { read_only: true; composed: true; generated_at: string };
}

export async function buildCandidateTalentView(
  pool: Pool,
  candidateId: string,
): Promise<CandidateTalentView> {
  const id = String(candidateId ?? '').trim();
  const base: CandidateTalentView = {
    version: TALENT_INTELLIGENCE_VERSION,
    candidate_id: id,
    found: false,
    candidate: null,
    hiring_assessment: null,
    lbi: null,
    coverage: { profile: false, hiring_assessment: false, lbi: false },
    confidence: 'none',
    notes: [],
    _meta: { read_only: true, composed: true, generated_at: new Date().toISOString() },
  };
  if (!id) {
    base.notes.push('No candidate id supplied.');
    return base;
  }

  // 1) candidate profile (read-only)
  let email: string | null = null;
  try {
    if (await tableExists(pool, 'employer_candidates')) {
      const r = await pool.query(
        `SELECT id, employer_id, job_id, job_title, name, email, candidate_role, stage,
                ei_score, match_score, assessment_score, assessment_sent, capadex_session_id
           FROM employer_candidates WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (r.rows?.[0]) {
        base.candidate = r.rows[0];
        base.coverage.profile = true;
        base.found = true;
        email = r.rows[0].email ?? null;
      }
    }
  } catch (e: any) {
    base.notes.push(`candidate read failed: ${e?.message ?? 'error'}`);
  }

  // 2) hiring assessment (read-only, by candidate_id)
  try {
    if (await tableExists(pool, 'ep98_hiring_assessments')) {
      const r = await pool.query(
        `SELECT fit_score, competency_match, behavior_match, culture_match, potential_match,
                growth_match, readiness_score, success_probability, retention_probability,
                performance_prediction, leadership_prediction, ramp_up_days, computed_at
           FROM ep98_hiring_assessments WHERE candidate_id = $1
          ORDER BY computed_at DESC NULLS LAST LIMIT 1`,
        [id],
      );
      if (r.rows?.[0]) {
        base.hiring_assessment = r.rows[0];
        base.coverage.hiring_assessment = true;
      }
    }
  } catch (e: any) {
    base.notes.push(`hiring assessment read failed: ${e?.message ?? 'error'}`);
  }

  // 3) LBI (read-only, by email)
  try {
    if (email && (await tableExists(pool, 'lbi_scores'))) {
      const r = await pool.query(
        `SELECT overall_lbi, consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, learning_style, sessions_analyzed, calculated_at
           FROM lbi_scores WHERE user_email = $1
          ORDER BY calculated_at DESC NULLS LAST LIMIT 1`,
        [email],
      );
      if (r.rows?.[0]) {
        base.lbi = r.rows[0];
        base.coverage.lbi = true;
      }
    }
  } catch (e: any) {
    base.notes.push(`lbi read failed: ${e?.message ?? 'error'}`);
  }

  // Confidence: how many of the three evidence sources resolved.
  const present = [base.coverage.profile, base.coverage.hiring_assessment, base.coverage.lbi].filter(Boolean).length;
  base.confidence = present >= 3 ? 'sufficient' : present > 0 ? 'provisional' : 'none';
  if (!base.found) base.notes.push('No candidate found for this id — honest empty result (no fabrication).');

  return base;
}
