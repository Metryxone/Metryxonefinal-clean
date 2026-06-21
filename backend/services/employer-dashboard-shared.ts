/**
 * PHASE 5.13 — Employer Dashboards: shared composition util.
 *
 * A PURE READ / compose-never-recompute layer that assembles operator-recorded employer evidence
 * into role-scoped DASHBOARD payloads (employer / recruiter / talent). It reuses the Phase 5.12
 * workforce evidence + engines wholesale and only ADDS the dashboard-specific reads it needs
 * (per-job status) and the funnel / score-distribution folds. It defines:
 *   - the dashboard VERSION + disclaimer (reuses the 5.12 EngineResult/ok/err + PROVENANCE),
 *   - the canonical hiring funnel stage taxonomy + a case-insensitive canonStage (real candidate
 *     stages may be lower-cased or use synonyms — they are bucketed, never fabricated),
 *   - a job-status normalizer (employer_jobs.status default 'Active' ⇒ open),
 *   - resolveDashboardEvidence(): ONE read that composes resolveWorkforceEvidence (jobs/candidates/
 *     targets, IDOR-scoped, existence guard) + an employer-scoped job-status map + the skills ref,
 *   - score-distribution + rate folds (Coverage axis; unmeasured ⇒ null, never 0).
 *
 * Design contract (mirrors the program):
 *   - PURE READ. Phase 5.13 creates NO tables and writes NO rows. No POST, no ensure-schema, no DDL.
 *   - Dashboards are read-only AGGREGATIONS of operator-recorded evidence — developmental /
 *     operational views, NOT hiring/promotion/suitability predictions or verdicts.
 *   - IDOR-safe: every read scoped by employer_id (delegated to the 5.12 resolver + a scoped status read).
 *   - never-throws: typed EngineResult; absent data degrades to honest null/empty, never fabricated.
 */

import type { Pool } from 'pg';
import {
  type EngineResult, type WorkforceEvidence,
  ok, round1, relExists, bandFor, meanPresent,
  resolveWorkforceEvidence, PROVENANCE,
} from './workforce-intelligence-shared';
import { loadSkillReference, type SkillReference } from './skill-inventory-engine';

export const EMPLOYER_DASHBOARD_VERSION = '5.13.0';

export const EMPLOYER_DASHBOARD_DISCLAIMER =
  'Read-only employer dashboards: deterministic, coverage-gated AGGREGATIONS of operator-recorded ' +
  'evidence (jobs, candidate pipeline stages, operator-entered assessment / match / EI scores, ' +
  'ratings, and recorded skills / competency profiles). These are operational + developmental ' +
  'views to support human decisions — they are NOT predictions of hiring outcomes and NOT ' +
  'algorithmic hiring/promotion/suitability verdicts. Unmeasured signals abstain (null), never 0.';

export { PROVENANCE };

// ── hiring funnel taxonomy ───────────────────────────────────────────────────
// Canonical ordered pipeline (mirrors employer-portal PIPELINE_STAGES). Terminal stages are
// outcomes (a human decision); the active funnel is everything up to & including Offer.
export const FUNNEL_STAGES = ['Applied', 'Screened', 'Interview', 'Assessment', 'Offer', 'Hired', 'Rejected'] as const;
export const FUNNEL_ACTIVE = ['Applied', 'Screened', 'Interview', 'Assessment', 'Offer'] as const;
export const TERMINAL_STAGES = new Set<string>(['Hired', 'Rejected']);

/** Bucket a raw candidate stage into a canonical funnel stage (case-insensitive + common
 *  synonyms). Unknown / absent ⇒ null (counted as 'unknown', never coerced into a real stage). */
export function canonStage(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === '') return null;
  for (const s of FUNNEL_STAGES) if (s.toLowerCase() === t) return s;
  switch (t) {
    case 'apply': case 'application': case 'applications': case 'new': case 'sourced': return 'Applied';
    case 'screening': case 'screen': case 'shortlisted': case 'shortlist': return 'Screened';
    case 'interviewing': case 'interviews': return 'Interview';
    case 'assessing': case 'assessments': case 'test': case 'testing': return 'Assessment';
    case 'offered': case 'offer extended': return 'Offer';
    case 'hire': case 'hired/joined': case 'joined': case 'accepted': return 'Hired';
    case 'reject': case 'rejected/declined': case 'declined': case 'withdrawn': return 'Rejected';
    default: return null;
  }
}

export type JobStatus = 'open' | 'closed' | 'draft' | 'on_hold' | 'other';
/** Normalize employer_jobs.status (default 'Active'). NULL/empty ⇒ open (matches the column default). */
export function normJobStatus(raw: string | null | undefined): JobStatus {
  if (raw == null) return 'open';
  const t = String(raw).trim().toLowerCase();
  if (t === '') return 'open';
  if (t === 'active' || t === 'open' || t === 'published' || t === 'live') return 'open';
  if (t === 'closed' || t === 'filled' || t === 'archived' || t === 'expired') return 'closed';
  if (t === 'draft') return 'draft';
  if (t === 'on hold' || t === 'on_hold' || t === 'paused' || t === 'hold') return 'on_hold';
  return 'other';
}

// ── dashboard evidence (composes 5.12 + the dashboard-specific reads) ─────────
export interface DashboardEvidence {
  workforce: WorkforceEvidence;
  /** raw employer_jobs.status keyed by job id (employer-scoped); absent job ⇒ undefined. */
  jobStatusById: Map<string, string | null>;
  skillRef: SkillReference;
}

/**
 * resolveDashboardEvidence — ONE read-only, never-throws load for every dashboard. Composes the
 * 5.12 workforce evidence (IDOR-scoped jobs/candidates/targets + existence guard) and only ADDS
 * an employer-scoped per-job status map + the global skills reference. compose-never-recompute.
 */
export async function resolveDashboardEvidence(
  pool: Pool,
  employerIdRaw: string,
): Promise<EngineResult<DashboardEvidence>> {
  const wf = await resolveWorkforceEvidence(pool, employerIdRaw);
  if (!wf.ok) return wf;

  const jobStatusById = new Map<string, string | null>();
  if (await relExists(pool, 'employer_jobs')) {
    try {
      const r = await pool.query(
        `SELECT id, status FROM employer_jobs WHERE employer_id = $1`,
        [wf.data.employer_id],
      );
      for (const row of r.rows) {
        jobStatusById.set(String(row.id), typeof row.status === 'string' && row.status.trim() !== '' ? row.status.trim() : null);
      }
    } catch { /* degrade to empty status map */ }
  }

  let skillRef: SkillReference;
  try { skillRef = await loadSkillReference(pool); }
  catch { skillRef = new Map(); }

  return ok({ workforce: wf.data, jobStatusById, skillRef });
}

// ── shared folds ─────────────────────────────────────────────────────────────
/** Coverage-gated distribution of a 0..100 operator score across the band buckets. */
export function scoreDistribution(values: Array<number | null>, total: number) {
  const mp = meanPresent(values);
  const by_band: Record<string, number> = { high: 0, moderate: 0, developing: 0, low: 0 };
  let measured = 0;
  for (const v of values) {
    const b = bandFor(v);
    if (b != null) { by_band[b] += 1; measured += 1; }
  }
  return {
    mean: mp.mean,
    band: bandFor(mp.mean),
    measured,
    total,
    coverage_pct: total > 0 ? round1((measured / total) * 100) : 0,
    by_band,
  };
}

/** Percentage rate that ABSTAINS (null) when the denominator is 0 — never a fabricated 0%. */
export function rate(numer: number, denom: number): number | null {
  return denom > 0 ? round1((numer / denom) * 100) : null;
}
