/**
 * PHASE 5.12 — Workforce Intelligence Foundation: shared composition util.
 *
 * Deterministic, coverage-gated, honesty-first CORE shared by the three Phase 5.12 engines
 * (workforce_intelligence_engine, skill_inventory, capability_mapping). It aggregates the
 * EMPLOYER substrate — employer_jobs + employer_candidates operator columns + the skills /
 * competency_profile JSONB — at the employer → department / role level. It defines:
 *   - the typed EngineResult + ok/err helpers,
 *   - a to_regclass relExists probe (reads NEVER run DDL),
 *   - resolveWorkforceEvidence(): a single READ-ONLY, never-throws load of an employer's jobs,
 *     candidates and (optional) competency targets, strictly scoped by employer_id,
 *   - composite(): the ONLY scoring primitive — a weighted mean over the contributors that are
 *     actually PRESENT, with an explicit Coverage axis. Absent evidence ⇒ value = null (NEVER 0).
 *   - tolerant parsers for the skills / competency_profile JSONB and shared numeric folds.
 *
 * Design contract (mirrors the program):
 *   - PURE READ / compose-never-recompute. Phase 5.12 creates NO tables and writes NO rows;
 *     it folds already-recorded evidence on demand. There is no POST and no ensure-schema.
 *   - Every output is a DEVELOPMENTAL / DIRECTIONAL workforce indicator. "Team Competency
 *     Profile", "Department Readiness", "Skill Inventory", "Capability Heatmap", "Talent
 *     Distribution" name composites / aggregates of operator-recorded evidence — they are NOT
 *     hiring/promotion/suitability predictions and NOT algorithmic verdicts. Every output
 *     carries the disclaimer + provenance.
 *   - IDOR-safe: every read is strictly scoped by employer_id; cross-employer rows never leak.
 *     A candidate's department is resolved ONLY through that same employer's jobs.
 *   - never-throws: typed EngineResult; absent data degrades to honest null/empty, never fabricated.
 */

import type { Pool } from 'pg';

export const WORKFORCE_INTELLIGENCE_VERSION = '5.12.0';

export const WORKFORCE_INTELLIGENCE_DISCLAIMER =
  'Developmental workforce indicators composed from OPERATOR-RECORDED evidence (operator-entered ' +
  'candidate fields, assessment / match / EI scores, ratings, and recorded skills / competency ' +
  'profiles), aggregated by department and role. Values are deterministic, coverage-gated folds of ' +
  'human inputs — they are directional development signals, NOT predictions of hiring outcomes and ' +
  'NOT algorithmic hiring/promotion/suitability verdicts. Unmeasured signals abstain (null), never 0.';

export const PROVENANCE = 'operator_recorded_composite' as const;

// ── EngineResult ────────────────────────────────────────────────────────────
export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

export const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
export const err = (
  code: 'not_found' | 'invalid_input' | 'conflict',
  message: string,
): EngineResult => ({ ok: false, code, message });

export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

// ── infra: to_regclass probe (reads degrade; NEVER run DDL) ─────────────────
export async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

// ── banding (magnitude bands; the FIELD NAME conveys polarity) ───────────────
export type Band = 'high' | 'moderate' | 'developing' | 'low';
export function bandFor(value: number | null): Band | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 75) return 'high';
  if (value >= 50) return 'moderate';
  if (value >= 25) return 'developing';
  return 'low';
}

// ── composite: the ONLY scoring primitive ───────────────────────────────────
// A contributor is a normalized 0..100 signal with a weight. `present:false` (value null)
// contributors are EXCLUDED from the mean and reduce Coverage. Empty present-set ⇒ null.
export interface Contributor {
  key: string;
  label: string;
  weight: number;
  value: number | null; // 0..100 when present, null when unmeasured
  source: string;
}

export interface CompositeResult {
  value: number | null;
  band: Band | null;
  coverage_pct: number; // share of declared weight that is PRESENT (0 when nothing measured)
  weight_present: number;
  weight_total: number;
  contributors: Array<{
    key: string; label: string; weight: number;
    value: number | null; present: boolean; source: string;
  }>;
}

export function composite(contributors: Contributor[]): CompositeResult {
  let weightTotal = 0;
  let weightPresent = 0;
  let acc = 0;
  const shaped = contributors.map((c) => {
    const present = c.value != null && Number.isFinite(c.value as number);
    weightTotal += c.weight;
    if (present) {
      const v = clamp100(c.value as number);
      weightPresent += c.weight;
      acc += c.weight * v;
    }
    return {
      key: c.key, label: c.label, weight: c.weight,
      value: present ? clamp100(c.value as number) : null,
      present, source: c.source,
    };
  });
  const value = weightPresent > 0 ? round1(acc / weightPresent) : null;
  const coverage = weightTotal > 0 ? round1((weightPresent / weightTotal) * 100) : 0;
  return {
    value,
    band: bandFor(value),
    coverage_pct: coverage,
    weight_present: round1(weightPresent),
    weight_total: round1(weightTotal),
    contributors: shaped,
  };
}

/** Mean (%) of the present (non-null) values; null when none present. */
export function meanPresent(values: Array<number | null>): { mean: number | null; n: number } {
  let sum = 0; let n = 0;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) { sum += clamp100(v); n += 1; }
  }
  return { mean: n > 0 ? round1(sum / n) : null, n };
}

// ── normalization for operator-entered candidate numeric fields ─────────────
// match_score / assessment_score / ei_score are operator/system integers presumed 0..100.
export function normalize0to100(n: unknown): number | null {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return clamp100(v);
}
// rating is an operator 1..5 star value → 0..100. 0/absent ⇒ unmeasured (null).
export function normalizeRating(n: unknown): number | null {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return clamp100((v / 5) * 100);
}

// ── tolerant JSONB parsers (skills / competency_profile) ────────────────────
// jsonb arrives from pg already parsed (object/array) but may also be a JSON string.
function asJson(raw: unknown): any {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s === '') return null;
    try { return JSON.parse(s); } catch { return null; }
  }
  return raw;
}

/**
 * Parse a recorded skills JSONB into a de-duplicated, display-cased name list. Tolerates:
 *   ["JavaScript", "Python"] | [{name|skill|title: "X", ...}] | {"JavaScript": true, ...}.
 * Empty / unparseable ⇒ []. Names are trimmed; blanks dropped; de-duped case-insensitively.
 */
export function parseSkills(raw: unknown): string[] {
  const j = asJson(raw);
  if (j == null) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: unknown) => {
    if (typeof name !== 'string') return;
    const t = name.trim();
    if (t === '') return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  if (Array.isArray(j)) {
    for (const item of j) {
      if (typeof item === 'string') push(item);
      else if (item && typeof item === 'object') push((item as any).name ?? (item as any).skill ?? (item as any).title);
    }
  } else if (typeof j === 'object') {
    for (const k of Object.keys(j)) push(k);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export interface CompetencyEntry { name: string; value: number | null; }

/**
 * Parse a recorded competency_profile JSONB into named 0..100 entries. Tolerates:
 *   {"Communication": 72, "Leadership": 65}            (name → number 0..100)
 *   [{name|competency|skill, score|value|proficiency|level}]
 *   {competencies: [...]} | {scores: {...}}            (nested wrappers)
 * Non-numeric / absent values ⇒ value:null (the competency is named but unmeasured).
 * De-duped by name (case-insensitive, first wins). Sorted by name.
 */
export function parseCompetencyProfile(raw: unknown): CompetencyEntry[] {
  let j = asJson(raw);
  if (j == null) return [];
  // unwrap common nesting
  if (!Array.isArray(j) && typeof j === 'object') {
    if (Array.isArray((j as any).competencies)) j = (j as any).competencies;
    else if ((j as any).scores && typeof (j as any).scores === 'object') j = (j as any).scores;
  }
  const out: CompetencyEntry[] = [];
  const seen = new Set<string>();
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? clamp100(n) : null;
  };
  const push = (name: unknown, value: number | null) => {
    if (typeof name !== 'string') return;
    const t = name.trim();
    if (t === '') return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name: t, value });
  };
  if (Array.isArray(j)) {
    for (const item of j) {
      if (!item || typeof item !== 'object') continue;
      const name = (item as any).name ?? (item as any).competency ?? (item as any).skill ?? (item as any).dimension;
      const value = num((item as any).score ?? (item as any).value ?? (item as any).proficiency ?? (item as any).level);
      push(name, value);
    }
  } else if (typeof j === 'object') {
    for (const key of Object.keys(j)) push(key, num((j as any)[key]));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ── evidence bundle ─────────────────────────────────────────────────────────
export interface WorkforceJob {
  id: string;
  title: string | null;
  department: string | null;
  required_skills: string[];
}
export interface WorkforceCandidate {
  id: string;
  job_id: string | null;
  /** role label (candidate_role → job_title → resolved job.title), best available. */
  role: string | null;
  /** department resolved ONLY via this employer's job map; null when unresolved/unbound. */
  department: string | null;
  bound_to_employer_job: boolean;
  match_score: number | null;
  assessment_score: number | null;
  ei_score: number | null;
  rating: number | null;
  stage: string | null;
  competencies: CompetencyEntry[];
  skills: string[];
}
export interface CompetencyTarget {
  department: string | null;
  competency: string;
  target: number | null;
}
export interface WorkforceEvidence {
  employer_id: string;
  jobs: WorkforceJob[];
  candidates: WorkforceCandidate[];
  competency_targets: CompetencyTarget[];
}

/**
 * resolveWorkforceEvidence — single READ-ONLY load + employer-scope guard. Loads the employer's
 * jobs and candidates (and optional competency targets) strictly scoped by employer_id, so every
 * engine + the combined overview share ONE guard and ONE load (compose-never-recompute).
 * Existence: an employer is recognized if it has an organization row OR ≥1 job OR ≥1 candidate.
 */
export async function resolveWorkforceEvidence(
  pool: Pool,
  employerIdRaw: string,
): Promise<EngineResult<WorkforceEvidence>> {
  const employerId = String(employerIdRaw ?? '').trim();
  if (!employerId) return err('invalid_input', 'employerId is required');

  // ── jobs (employer-scoped) ────────────────────────────────────────────────
  const jobs: WorkforceJob[] = [];
  const jobById = new Map<string, WorkforceJob>();
  if (await relExists(pool, 'employer_jobs')) {
    try {
      const r = await pool.query(
        `SELECT id, title, department, skills FROM employer_jobs WHERE employer_id = $1`,
        [employerId],
      );
      for (const row of r.rows) {
        const job: WorkforceJob = {
          id: String(row.id),
          title: row.title ?? null,
          department: typeof row.department === 'string' && row.department.trim() !== '' ? row.department.trim() : null,
          required_skills: parseSkills(row.skills),
        };
        jobs.push(job);
        jobById.set(job.id, job);
      }
    } catch { /* degrade to empty */ }
  }

  // ── candidates (employer-scoped) ──────────────────────────────────────────
  const candidates: WorkforceCandidate[] = [];
  if (await relExists(pool, 'employer_candidates')) {
    try {
      const r = await pool.query(
        `SELECT id, job_id, candidate_role, job_title, stage,
                match_score, assessment_score, ei_score, rating,
                skills, competency_profile
           FROM employer_candidates WHERE employer_id = $1`,
        [employerId],
      );
      for (const row of r.rows) {
        const jobId = row.job_id != null ? String(row.job_id) : null;
        const job = jobId != null ? jobById.get(jobId) ?? null : null;
        const bound = job != null;
        const role =
          (typeof row.candidate_role === 'string' && row.candidate_role.trim() !== '' && row.candidate_role.trim()) ||
          (typeof row.job_title === 'string' && row.job_title.trim() !== '' && row.job_title.trim()) ||
          (job && job.title) || null;
        candidates.push({
          id: String(row.id),
          job_id: jobId,
          role: role || null,
          department: bound ? job!.department : null,
          bound_to_employer_job: bound,
          match_score: normalize0to100(row.match_score),
          assessment_score: normalize0to100(row.assessment_score),
          ei_score: normalize0to100(row.ei_score),
          rating: normalizeRating(row.rating),
          stage: typeof row.stage === 'string' && row.stage.trim() !== '' ? row.stage.trim() : null,
          competencies: parseCompetencyProfile(row.competency_profile),
          skills: parseSkills(row.skills),
        });
      }
    } catch { /* degrade to empty */ }
  }

  // ── competency targets (optional; employer_competency_roles) ──────────────
  const competency_targets: CompetencyTarget[] = [];
  if (await relExists(pool, 'employer_competency_roles')) {
    try {
      const r = await pool.query(
        `SELECT department, proficiency_targets FROM employer_competency_roles WHERE employer_id = $1`,
        [employerId],
      );
      for (const row of r.rows) {
        const dept = typeof row.department === 'string' && row.department.trim() !== '' ? row.department.trim() : null;
        const targets = parseCompetencyProfile(row.proficiency_targets);
        for (const t of targets) {
          competency_targets.push({ department: dept, competency: t.name, target: t.value });
        }
      }
    } catch { /* degrade */ }
  }

  // ── existence guard (employer recognized?) ────────────────────────────────
  let orgExists = false;
  if (jobs.length === 0 && candidates.length === 0) {
    if (await relExists(pool, 'employer_organizations')) {
      try {
        const r = await pool.query(`SELECT 1 FROM employer_organizations WHERE id = $1 LIMIT 1`, [employerId]);
        orgExists = (r.rowCount ?? 0) > 0;
      } catch { orgExists = false; }
    }
    if (!orgExists) return err('not_found', `employer ${employerId} not found`);
  }

  return ok({ employer_id: employerId, jobs, candidates, competency_targets });
}

/** Compact evidence summary echoed on every engine output (Coverage transparency). */
export function workforceSummary(ev: WorkforceEvidence) {
  const withScore = ev.candidates.filter(
    (c) => c.assessment_score != null || c.match_score != null || c.ei_score != null || c.rating != null,
  ).length;
  const withCompetency = ev.candidates.filter((c) => c.competencies.some((x) => x.value != null)).length;
  const withSkills = ev.candidates.filter((c) => c.skills.length > 0).length;
  const unbound = ev.candidates.filter((c) => !c.bound_to_employer_job).length;
  return {
    jobs: ev.jobs.length,
    candidates: ev.candidates.length,
    candidates_with_any_score: withScore,
    candidates_with_competency: withCompetency,
    candidates_with_skills: withSkills,
    candidates_unbound_to_employer_job: unbound,
    competency_targets: ev.competency_targets.length,
  };
}
