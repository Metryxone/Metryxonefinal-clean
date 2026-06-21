/**
 * PHASE 5.8 — Candidate Comparison Engine (services).
 *
 * candidate_comparison_engine — compares two (or more) employer candidates for a
 * job across SIX developmental dimensions by COMPOSING engines that already exist,
 * never recomputing the underlying intelligence:
 *
 *   Competencies     — parsed from employer_candidates.competency_profile (proxy).
 *   EI               — employer_candidates.ei_score (recorded summary).
 *   Career Readiness — buildCareerReadiness (composed readiness blocks).
 *   Signals          — buildCareerSignals (developmental career signals).
 *   Strengths        — discoverStrengths (CSI positive_factors / longitudinal ONLY).
 *   Gaps             — buildCareerGap (typed competency gap buckets).
 *
 * Persistence (write path only): a saved comparison view (comparison_dashboard)
 * and a generated comparison report (comparison_reports).
 *
 * Design contract (mirrors the program):
 *   - Additive + flag-gated (`candidateComparison`). The two net-new tables are
 *     created by a lazy ensureComparisonSchema() that runs ONLY on a POST/write
 *     path. GET reads use a to_regclass probe and degrade — they NEVER run DDL.
 *   - compose-never-recompute: every dimension reads/derives from existing
 *     substrate or an existing read-only engine; nothing is re-scored here.
 *   - GET-never-writes: the DDL-risky composers (buildCareerReadiness /
 *     buildCareerSignals / buildCareerGap reach the unguarded competency-runtime
 *     ensure-schema) are gated behind competencyRuntimeReady() — when the runtime
 *     is not provisioned those dimensions degrade to unmeasured, no DDL runs.
 *   - super-admin gated + IDOR-safe: a candidate is only compared within its own
 *     job (candidateInJob); cross-job candidates are omitted, never silently mixed.
 *   - never-throws: every op returns a typed EngineResult; every composed source
 *     is guarded and degrades to honest unmeasured. Absent evidence is reported,
 *     NEVER fabricated; unmeasured is null, never coerced to 0.
 *   - Honesty: Coverage (is there evidence) and Confidence (how trustworthy) are
 *     SEPARATE per-dimension axes. The output is a DEVELOPMENTAL comparison — NOT
 *     a hire / reject / suitability verdict.
 */

import type { Pool } from 'pg';
import { competencyRuntimeReady, buildCareerGap } from './career-gap-engine.js';
import { buildCareerReadiness } from './career-readiness-aggregator.js';
import { buildCareerSignals } from './career-signal-engine.js';
import { discoverStrengths } from './strength-discovery-engine.js';

export const CANDIDATE_COMPARISON_ENGINE_VERSION = '5.8.0';

const DEVELOPMENTAL_DISCLAIMER =
  'Developmental comparison of assessment evidence only — NOT a hiring, rejection, ' +
  'ranking-for-selection, or suitability verdict.';

export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
const err = (code: 'not_found' | 'invalid_input' | 'conflict', message: string): EngineResult =>
  ({ ok: false, code, message });

const r1 = (n: number) => Math.round(n * 10) / 10;

// ── honesty helpers ─────────────────────────────────────────────────────────
// null/undefined/'' must stay null (Number(null) === 0 would fabricate a measured 0).
function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function band(score: number | null): string {
  if (score == null) return 'Unmeasured';
  if (score >= 80) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

function confidenceBand(trust: number | null): string {
  if (trust == null) return 'None';
  if (trust >= 0.75) return 'High';
  if (trust >= 0.45) return 'Moderate';
  if (trust > 0) return 'Low';
  return 'None';
}

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

// ── lazy ensure-schema (WRITE PATH ONLY — never reached from a GET) ──────────
let schemaReady = false;
export async function ensureComparisonSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comparison_dashboard (
      id            BIGSERIAL PRIMARY KEY,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      name          TEXT,
      candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comparison_dashboard_job ON comparison_dashboard (job_id);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comparison_reports (
      id            BIGSERIAL PRIMARY KEY,
      dashboard_id  BIGINT,
      employer_id   TEXT,
      job_id        TEXT NOT NULL,
      candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      format        TEXT NOT NULL DEFAULT 'json',
      report        JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_by  TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comparison_reports_job       ON comparison_reports (job_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comparison_reports_dashboard ON comparison_reports (dashboard_id);`);
  schemaReady = true;
}

// ── substrate reads (read-only, never-throws) ───────────────────────────────
interface JobRow { id: string; employer_id: string | null; title: string | null; status: string | null; }
interface CandidateRow {
  id: string;
  employer_id: string | null;
  job_id: string | null;
  name: string | null;
  email: string | null;
  ei_score: number | null;
  assessment_score: number | null;
  competency_profile: any;
  capadex_session_id: string | null;
}

async function readJob(pool: Pool, id: string): Promise<JobRow | null> {
  if (!(await relExists(pool, 'employer_jobs'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id, employer_id, title, status FROM employer_jobs WHERE id = $1`, [id],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function readCandidate(pool: Pool, id: string): Promise<CandidateRow | null> {
  if (!(await relExists(pool, 'employer_candidates'))) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id, employer_id, job_id, name, email, ei_score, assessment_score,
              competency_profile, capadex_session_id
         FROM employer_candidates WHERE id = $1`, [id],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// IDOR/job-scoping: a candidate belongs to a job ONLY when its job_id strictly
// matches. A cross-job OR unbound (null job_id) candidate is NEVER compared
// against the job — the contract requires the candidate to belong to the job.
function candidateInJob(c: CandidateRow, jobId: string): boolean {
  return c.job_id != null && String(c.job_id) === String(jobId);
}

// ── per-dimension result shape ──────────────────────────────────────────────
export type DimensionKey =
  | 'competencies' | 'ei' | 'career_readiness' | 'signals' | 'strengths' | 'gaps';

interface DimItem { label: string; detail?: string; score?: number | null }

export interface DimensionResult {
  dimension: DimensionKey;
  label: string;
  measurable: boolean;
  /** Representative 0..100 score for score-based dims; null for list dims / unmeasured. */
  score: number | null;
  band: string | null;
  /** Count of evidenced items for list dims (strengths/signals/gaps); else null. */
  item_count: number | null;
  items: DimItem[];
  coverage: { measurable: boolean; coverage_pct: number | null; detail: string };
  confidence: { band: string; value: number | null; basis: string };
  source: string;
  notes: string[];
}

const DIM_LABELS: Record<DimensionKey, string> = {
  competencies: 'Competencies',
  ei: 'Emotional Intelligence',
  career_readiness: 'Career Readiness',
  signals: 'Career Signals',
  strengths: 'Strengths',
  gaps: 'Development Gaps',
};

function unmeasuredDim(dim: DimensionKey, source: string, detail: string, note?: string): DimensionResult {
  return {
    dimension: dim,
    label: DIM_LABELS[dim],
    measurable: false,
    score: null,
    band: 'Unmeasured',
    item_count: dim === 'competencies' || dim === 'ei' ? null : 0,
    items: [],
    coverage: { measurable: false, coverage_pct: null, detail },
    confidence: { band: 'None', value: null, basis: 'no evidence present' },
    source,
    notes: note ? [note] : [],
  };
}

// ── competency_profile parsing (defensive — shape varies) ───────────────────
function parseCompetencyMap(raw: any): Map<string, number> {
  const map = new Map<string, number>();
  if (raw == null) return map;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return map; }
  }
  const put = (k: unknown, v: number | null) => {
    if (k != null && v != null) map.set(String(k), v);
  };
  if (Array.isArray(obj)) {
    for (const e of obj) {
      if (!e || typeof e !== 'object') continue;
      const name = e.name ?? e.competency ?? e.competency_id ?? e.code ?? e.label ?? e.key;
      put(name, num(e.score ?? e.level ?? e.value ?? e.proficiency));
    }
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') {
        put(k, num((v as any).score ?? (v as any).level ?? (v as any).value ?? (v as any).proficiency));
      } else {
        put(k, num(v));
      }
    }
  }
  return map;
}

// Normalise a heterogeneous competency map to 0..100 (handles 0..1, 0..5, 0..100).
function normalizeCompetency(map: Map<string, number>): { score: number | null; items: DimItem[] } {
  if (map.size === 0) return { score: null, items: [] };
  const maxRaw = Math.max(...Array.from(map.values()));
  const factor = maxRaw <= 1 ? 100 : maxRaw <= 5 ? 20 : 1;
  const items: DimItem[] = [];
  let sum = 0;
  for (const [k, v] of map.entries()) {
    const s = Math.max(0, Math.min(100, r1(v * factor)));
    sum += s;
    items.push({ label: k, score: s });
  }
  items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { score: r1(sum / map.size), items };
}

// ── dimension builders (each guarded never-throws) ──────────────────────────
function buildCompetencyDim(c: CandidateRow): DimensionResult {
  const map = parseCompetencyMap(c.competency_profile);
  if (map.size === 0) {
    return unmeasuredDim('competencies', 'employer_candidates.competency_profile',
      'no competency_profile recorded for candidate');
  }
  const { score, items } = normalizeCompetency(map);
  return {
    dimension: 'competencies',
    label: DIM_LABELS.competencies,
    measurable: score != null,
    score,
    band: band(score),
    item_count: null,
    items,
    coverage: { measurable: true, coverage_pct: null, detail: `${map.size} competencies recorded (profile proxy)` },
    confidence: { band: 'Low', value: 0.4, basis: 'candidate competency_profile (self/derived proxy, not a scored run)' },
    source: 'employer_candidates.competency_profile',
    notes: [],
  };
}

function buildEiDim(c: CandidateRow): DimensionResult {
  const s = num(c.ei_score);
  if (s == null) {
    return unmeasuredDim('ei', 'employer_candidates.ei_score', 'no ei_score recorded for candidate');
  }
  return {
    dimension: 'ei',
    label: DIM_LABELS.ei,
    measurable: true,
    score: r1(s),
    band: band(s),
    item_count: null,
    items: [],
    coverage: { measurable: true, coverage_pct: 100, detail: 'recorded EI summary score' },
    confidence: { band: 'Moderate', value: 0.6, basis: 'employer_candidates.ei_score (recorded summary)' },
    source: 'employer_candidates.ei_score',
    notes: [],
  };
}

async function buildReadinessDim(pool: Pool, subject: string | null, runtimeReady: boolean): Promise<DimensionResult> {
  if (!subject) return unmeasuredDim('career_readiness', 'career-readiness-aggregator', 'candidate has no resolvable subject identity');
  if (!runtimeReady) return unmeasuredDim('career_readiness', 'career-readiness-aggregator', 'competency runtime not provisioned', 'readiness gated behind competencyRuntimeReady() (GET-never-writes)');
  try {
    const env = await buildCareerReadiness(pool, subject);
    if (!env?.overall?.measurable || env.overall.score == null) {
      return unmeasuredDim('career_readiness', 'career-readiness-aggregator', 'no measurable readiness for subject');
    }
    const contributing = Array.isArray(env.overall.contributing) ? env.overall.contributing : [];
    return {
      dimension: 'career_readiness',
      label: DIM_LABELS.career_readiness,
      measurable: true,
      score: r1(env.overall.score),
      band: env.overall.band ?? band(env.overall.score),
      item_count: contributing.length,
      items: contributing.map((t: string) => ({ label: String(t) })),
      coverage: { measurable: true, coverage_pct: null, detail: `composed over ${contributing.length} readiness block(s)` },
      confidence: { band: 'Moderate', value: 0.5, basis: 'composed present-readiness blocks' },
      source: 'career-readiness-aggregator',
      notes: [],
    };
  } catch {
    return unmeasuredDim('career_readiness', 'career-readiness-aggregator', 'readiness composition unavailable (honest empty)');
  }
}

async function buildSignalsDim(pool: Pool, subject: string | null, runtimeReady: boolean): Promise<DimensionResult> {
  if (!subject) return unmeasuredDim('signals', 'career-signal-engine', 'candidate has no resolvable subject identity');
  if (!runtimeReady) return unmeasuredDim('signals', 'career-signal-engine', 'competency runtime not provisioned', 'signals gated behind competencyRuntimeReady() (GET-never-writes)');
  try {
    const env = await buildCareerSignals(pool, subject);
    const measurableSignals = Array.isArray(env?.signals) ? env.signals.filter((s: any) => s.measurable && s.score != null) : [];
    if (!env?.measurable || measurableSignals.length === 0) {
      return unmeasuredDim('signals', 'career-signal-engine', 'no measurable career signals for subject');
    }
    const items: DimItem[] = measurableSignals
      .map((s: any) => ({ label: s.label ?? s.signal_key, score: num(s.score), detail: s.band ?? undefined }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return {
      dimension: 'signals',
      label: DIM_LABELS.signals,
      measurable: true,
      score: null,
      band: null,
      item_count: items.length,
      items,
      coverage: { measurable: true, coverage_pct: num(env.summary?.coverage_pct), detail: `${items.length}/${env.summary?.signals_total ?? items.length} signals measurable` },
      confidence: { band: 'Moderate', value: 0.5, basis: 'composed developmental career signals' },
      source: 'career-signal-engine',
      notes: [],
    };
  } catch {
    return unmeasuredDim('signals', 'career-signal-engine', 'signal composition unavailable (honest empty)');
  }
}

async function buildStrengthsDim(pool: Pool, scope: string | null): Promise<DimensionResult> {
  if (!scope) return unmeasuredDim('strengths', 'strength-discovery-engine', 'candidate has no email or session to scope strengths');
  try {
    const prof = await discoverStrengths(pool, scope);
    const all = [
      ...(prof.strengths ?? []),
      ...(prof.resilience ?? []),
      ...(prof.coping ?? []),
      ...(prof.success_patterns ?? []),
    ];
    if (all.length === 0) {
      return unmeasuredDim('strengths', 'strength-discovery-engine', 'no CSI positive_factors / longitudinal strengths for scope');
    }
    const items: DimItem[] = all.map((s: any) => ({
      label: s.label,
      detail: s.evidence,
      score: s.confidence != null ? r1(Number(s.confidence) * 100) : null,
    }));
    const avgConf = all.reduce((a, s: any) => a + (Number(s.confidence) || 0), 0) / all.length;
    return {
      dimension: 'strengths',
      label: DIM_LABELS.strengths,
      measurable: true,
      score: null,
      band: null,
      item_count: items.length,
      items,
      coverage: { measurable: true, coverage_pct: null, detail: `${items.length} evidence-traced strength(s)` },
      confidence: { band: confidenceBand(avgConf), value: r1(avgConf), basis: 'CSI positive_factors / longitudinal growth (canonical strengths)' },
      source: 'strength-discovery-engine',
      notes: [],
    };
  } catch {
    return unmeasuredDim('strengths', 'strength-discovery-engine', 'strength discovery unavailable (honest empty)');
  }
}

async function buildGapsDim(pool: Pool, subject: string | null, runtimeReady: boolean): Promise<DimensionResult> {
  if (!subject) return unmeasuredDim('gaps', 'career-gap-engine', 'candidate has no resolvable subject identity');
  if (!runtimeReady) return unmeasuredDim('gaps', 'career-gap-engine', 'competency runtime not provisioned', 'gaps gated behind competencyRuntimeReady() (GET-never-writes)');
  try {
    const env = await buildCareerGap(pool, subject);
    if (!env?.measurable) {
      return unmeasuredDim('gaps', 'career-gap-engine', 'no measurable competency gaps for subject');
    }
    const buckets = env.buckets ?? {};
    const items: DimItem[] = [];
    for (const b of Object.values<any>(buckets)) {
      for (const g of (b?.items ?? [])) {
        items.push({ label: g.competency_name ?? g.label ?? g.competency_id ?? 'gap', detail: b.label, score: num(g.gap ?? g.gap_size ?? g.magnitude) });
      }
    }
    for (const g of (env.unclassified ?? [])) {
      items.push({ label: (g as any).competency_name ?? (g as any).label ?? 'gap', detail: 'unclassified', score: num((g as any).gap) });
    }
    return {
      dimension: 'gaps',
      label: DIM_LABELS.gaps,
      measurable: true,
      score: null,
      band: null,
      item_count: num(env.summary?.total_gaps) ?? items.length,
      items: items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      coverage: { measurable: true, coverage_pct: num(env.summary?.classified_pct), detail: `${env.summary?.total_gaps ?? items.length} gap(s); ${env.summary?.total_critical ?? 0} critical` },
      confidence: { band: 'Moderate', value: 0.5, basis: 'composed typed competency gap buckets' },
      source: 'career-gap-engine',
      notes: [],
    };
  } catch {
    return unmeasuredDim('gaps', 'career-gap-engine', 'gap composition unavailable (honest empty)');
  }
}

// ── subject / scope resolution (best-effort, never-throws) ──────────────────
// Career engines key on a subject identity and strengths key on an email/session
// scope. Employer candidates only carry email + capadex_session_id, so resolution
// is best-effort: when nothing resolves, the subject-keyed dimensions are honestly
// reported unmeasured (never fabricated).
function resolveCandidateSubject(c: CandidateRow): { subject: string | null; scope: string | null } {
  const email = c.email ? String(c.email).trim().toLowerCase() : null;
  const session = c.capadex_session_id ? String(c.capadex_session_id).trim() : null;
  return {
    subject: email || session || null,
    scope: email || session || null,
  };
}

// ── per-candidate comparison profile (read-only, composes everything ONCE) ──
export interface CandidateComparisonProfile {
  candidate_id: string;
  name: string | null;
  job_id: string | null;
  subject_resolution: { subject: string | null; scope: string | null; runtime_ready: boolean };
  dimensions: Record<DimensionKey, DimensionResult>;
  measurable_dimensions: number;
  generated_at: string;
}

export async function buildCandidateComparisonProfile(
  pool: Pool,
  c: CandidateRow,
): Promise<CandidateComparisonProfile> {
  const { subject, scope } = resolveCandidateSubject(c);
  const runtimeReady = await competencyRuntimeReady(pool).catch(() => false);

  const [readiness, signals, strengths, gaps] = await Promise.all([
    buildReadinessDim(pool, subject, runtimeReady),
    buildSignalsDim(pool, subject, runtimeReady),
    buildStrengthsDim(pool, scope),
    buildGapsDim(pool, subject, runtimeReady),
  ]);

  const dimensions: Record<DimensionKey, DimensionResult> = {
    competencies: buildCompetencyDim(c),
    ei: buildEiDim(c),
    career_readiness: readiness,
    signals,
    strengths,
    gaps,
  };

  const measurable = (Object.values(dimensions) as DimensionResult[]).filter((d) => d.measurable).length;

  return {
    candidate_id: c.id,
    name: c.name,
    job_id: c.job_id,
    subject_resolution: { subject, scope, runtime_ready: runtimeReady },
    dimensions,
    measurable_dimensions: measurable,
    generated_at: new Date().toISOString(),
  };
}

// ── comparison (read-only) ──────────────────────────────────────────────────
const SCORE_DIMS: DimensionKey[] = ['competencies', 'ei', 'career_readiness'];
const LIST_DIMS: DimensionKey[] = ['signals', 'strengths', 'gaps'];
const ALL_DIMS: DimensionKey[] = ['competencies', 'ei', 'career_readiness', 'signals', 'strengths', 'gaps'];

interface DimComparison {
  dimension: DimensionKey;
  label: string;
  kind: 'score' | 'list';
  per_candidate: {
    candidate_id: string;
    name: string | null;
    measurable: boolean;
    score: number | null;
    band: string | null;
    item_count: number | null;
    coverage_pct: number | null;
    confidence_band: string;
  }[];
  /** Higher representative score (score dims) / more evidenced items (strengths/signals). null for gaps + ties + <2 measurable. */
  leader: string | null;
  /** Gaps only: informational, candidate with the FEWEST development gaps (NOT a suitability verdict). */
  fewest_gaps: string | null;
  basis: string;
  note: string | null;
}

function compareDimension(dim: DimensionKey, profiles: CandidateComparisonProfile[]): DimComparison {
  const kind: 'score' | 'list' = SCORE_DIMS.includes(dim) ? 'score' : 'list';
  const per_candidate = profiles.map((p) => {
    const d = p.dimensions[dim];
    return {
      candidate_id: p.candidate_id,
      name: p.name,
      measurable: d.measurable,
      score: d.score,
      band: d.band,
      item_count: d.item_count,
      coverage_pct: d.coverage.coverage_pct,
      confidence_band: d.confidence.band,
    };
  });

  let leader: string | null = null;
  let fewest_gaps: string | null = null;
  let note: string | null = null;
  let basis: string;

  if (kind === 'score') {
    basis = 'higher representative 0..100 score among candidates with measurable evidence';
    const measured = per_candidate.filter((c) => c.measurable && c.score != null);
    if (measured.length >= 2) {
      const top = measured.reduce((a, b) => ((b.score as number) > (a.score as number) ? b : a));
      const tie = measured.filter((c) => (c.score as number) === (top.score as number)).length > 1;
      leader = tie ? null : top.candidate_id;
      if (tie) note = 'tie on representative score — no single leader.';
    } else {
      note = 'fewer than two candidates have measurable evidence — no comparison possible.';
    }
  } else if (dim === 'gaps') {
    basis = 'gap counts are developmental; fewer gaps is informational, not a suitability verdict';
    const measured = per_candidate.filter((c) => c.measurable && c.item_count != null);
    if (measured.length >= 2) {
      const min = measured.reduce((a, b) => ((b.item_count as number) < (a.item_count as number) ? b : a));
      const tie = measured.filter((c) => (c.item_count as number) === (min.item_count as number)).length > 1;
      fewest_gaps = tie ? null : min.candidate_id;
    } else {
      note = 'fewer than two candidates have measurable gaps — no comparison possible.';
    }
  } else {
    // strengths / signals: more evidenced items = more developmental evidence (not a verdict).
    basis = 'more evidenced items among candidates with measurable evidence (developmental, not a verdict)';
    const measured = per_candidate.filter((c) => c.measurable && c.item_count != null);
    if (measured.length >= 2) {
      const top = measured.reduce((a, b) => ((b.item_count as number) > (a.item_count as number) ? b : a));
      const tie = measured.filter((c) => (c.item_count as number) === (top.item_count as number)).length > 1;
      leader = tie ? null : top.candidate_id;
      if (tie) note = 'tie on evidenced-item count — no single leader.';
    } else {
      note = 'fewer than two candidates have measurable evidence — no comparison possible.';
    }
  }

  return { dimension: dim, label: DIM_LABELS[dim], kind, per_candidate, leader, fewest_gaps, basis, note };
}

function itemLabelSet(p: CandidateComparisonProfile, dim: DimensionKey): Set<string> {
  return new Set((p.dimensions[dim].items ?? []).map((i) => i.label.toLowerCase()));
}

function overlap(profiles: CandidateComparisonProfile[], dim: DimensionKey) {
  const sets = profiles.map((p) => ({ id: p.candidate_id, set: itemLabelSet(p, dim) }));
  const nonEmpty = sets.filter((s) => s.set.size > 0);
  let shared: string[] = [];
  if (nonEmpty.length >= 2) {
    shared = Array.from(nonEmpty[0].set).filter((label) => nonEmpty.every((s) => s.set.has(label)));
  }
  const sharedSet = new Set(shared);
  const unique: Record<string, string[]> = {};
  for (const s of sets) unique[s.id] = Array.from(s.set).filter((l) => !sharedSet.has(l));
  return { shared, unique };
}

export interface CandidateComparison {
  ok: true;
  job_id: string;
  version: string;
  generated_at: string;
  candidate_count: number;
  candidates: CandidateComparisonProfile[];
  dimensions: DimComparison[];
  strengths_overlap: { shared: string[]; unique: Record<string, string[]> };
  gaps_overlap: { shared: string[]; unique: Record<string, string[]> };
  leaders: Record<DimensionKey, string | null>;
  measurable_summary: { dimension: DimensionKey; measurable_candidates: number }[];
  wrong_job: string[];
  language_policy: string;
  notes: string[];
}

export async function compareCandidates(
  pool: Pool,
  jobId: string,
  candidateIds: string[],
): Promise<EngineResult<CandidateComparison>> {
  const jid = String(jobId ?? '').trim();
  if (!jid) return err('invalid_input', 'jobId is required');
  const ids = Array.from(new Set((candidateIds ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)));
  if (ids.length < 2) return err('invalid_input', 'at least two candidate ids are required to compare');

  const profiles: CandidateComparisonProfile[] = [];
  const wrongJob: string[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const c = await readCandidate(pool, id);
    if (!c) { notFound.push(id); continue; }
    if (!candidateInJob(c, jid)) { wrongJob.push(id); continue; }
    profiles.push(await buildCandidateComparisonProfile(pool, c));
  }

  if (profiles.length < 2) {
    const parts: string[] = [];
    if (notFound.length) parts.push(`not found: ${notFound.join(', ')}`);
    if (wrongJob.length) parts.push(`not attached to job ${jid}: ${wrongJob.join(', ')}`);
    return err('invalid_input',
      `need at least two comparable candidates in job ${jid}; have ${profiles.length}${parts.length ? ` (${parts.join('; ')})` : ''}`);
  }

  const dimensions = ALL_DIMS.map((d) => compareDimension(d, profiles));
  const leaders = Object.fromEntries(dimensions.map((d) => [d.dimension, d.leader])) as Record<DimensionKey, string | null>;
  const measurable_summary = ALL_DIMS.map((d) => ({
    dimension: d,
    measurable_candidates: profiles.filter((p) => p.dimensions[d].measurable).length,
  }));

  const notes: string[] = [DEVELOPMENTAL_DISCLAIMER];
  if (wrongJob.length) notes.push(`Omitted ${wrongJob.length} candidate(s) not attached to job ${jid}.`);
  if (notFound.length) notes.push(`Omitted ${notFound.length} candidate id(s) not found.`);

  return ok({
    ok: true,
    job_id: jid,
    version: CANDIDATE_COMPARISON_ENGINE_VERSION,
    generated_at: new Date().toISOString(),
    candidate_count: profiles.length,
    candidates: profiles,
    dimensions,
    strengths_overlap: overlap(profiles, 'strengths'),
    gaps_overlap: overlap(profiles, 'gaps'),
    leaders,
    measurable_summary,
    wrong_job: wrongJob,
    language_policy: DEVELOPMENTAL_DISCLAIMER,
    notes,
  });
}

// ── persistence: comparison_dashboard (saved view) ──────────────────────────
export interface SaveDashboardInput {
  jobId: string;
  candidateIds: string[];
  name?: string | null;
  createdBy?: string | null;
}

export async function saveComparisonDashboard(
  pool: Pool,
  input: SaveDashboardInput,
): Promise<EngineResult> {
  const cmp = await compareCandidates(pool, input.jobId, input.candidateIds);
  if (!cmp.ok) return cmp;

  await ensureComparisonSchema(pool);
  const job = await readJob(pool, String(input.jobId).trim());
  const employerId = job?.employer_id ?? null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO comparison_dashboard (employer_id, job_id, name, candidate_ids, snapshot, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       RETURNING id, employer_id, job_id, name, candidate_ids, created_by, created_at, updated_at`,
      [
        employerId,
        String(input.jobId).trim(),
        input.name ?? null,
        JSON.stringify(cmp.data.candidates.map((c) => c.candidate_id)),
        JSON.stringify(cmp.data),
        input.createdBy ?? null,
      ],
    );
    const row = rows[0];
    return ok({ ...row, id: String(row.id), comparison: cmp.data });
  } catch (e: any) {
    return err('conflict', `failed to save comparison dashboard: ${e?.message ?? 'error'}`);
  }
}

export async function getComparisonDashboard(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'comparison_dashboard'))) return err('not_found', `dashboard ${id} not found`);
  const n = Number(id);
  if (!Number.isFinite(n)) return err('invalid_input', 'dashboard id must be numeric');
  try {
    const { rows } = await pool.query(`SELECT * FROM comparison_dashboard WHERE id = $1`, [n]);
    if (!rows[0]) return err('not_found', `dashboard ${id} not found`);
    return ok({ ...rows[0], id: String(rows[0].id) });
  } catch (e: any) {
    return err('invalid_input', `failed to read dashboard: ${e?.message ?? 'error'}`);
  }
}

export async function listComparisonDashboards(pool: Pool, jobId: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'comparison_dashboard'))) return ok({ job_id: jobId, dashboards: [] });
  try {
    const { rows } = await pool.query(
      `SELECT id, employer_id, job_id, name, candidate_ids, created_by, created_at, updated_at
         FROM comparison_dashboard WHERE job_id = $1 ORDER BY created_at DESC`, [String(jobId).trim()],
    );
    return ok({ job_id: jobId, dashboards: rows.map((r) => ({ ...r, id: String(r.id) })) });
  } catch {
    return ok({ job_id: jobId, dashboards: [] });
  }
}

// ── persistence: comparison_reports (generated report) ──────────────────────
export interface GenerateReportInput {
  jobId: string;
  candidateIds: string[];
  dashboardId?: string | number | null;
  format?: string | null;
  generatedBy?: string | null;
}

export async function generateComparisonReport(
  pool: Pool,
  input: GenerateReportInput,
): Promise<EngineResult> {
  const cmp = await compareCandidates(pool, input.jobId, input.candidateIds);
  if (!cmp.ok) return cmp;

  await ensureComparisonSchema(pool);
  const job = await readJob(pool, String(input.jobId).trim());
  const dashId = input.dashboardId != null && Number.isFinite(Number(input.dashboardId)) ? Number(input.dashboardId) : null;

  const report = {
    title: `Candidate comparison — job ${input.jobId}`,
    job: { id: String(input.jobId).trim(), title: job?.title ?? null },
    generated_at: new Date().toISOString(),
    version: CANDIDATE_COMPARISON_ENGINE_VERSION,
    candidate_count: cmp.data.candidate_count,
    dimensions: cmp.data.dimensions,
    leaders: cmp.data.leaders,
    strengths_overlap: cmp.data.strengths_overlap,
    gaps_overlap: cmp.data.gaps_overlap,
    measurable_summary: cmp.data.measurable_summary,
    candidates: cmp.data.candidates,
    language_policy: DEVELOPMENTAL_DISCLAIMER,
    notes: cmp.data.notes,
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO comparison_reports (dashboard_id, employer_id, job_id, candidate_ids, format, report, generated_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7)
       RETURNING id, dashboard_id, employer_id, job_id, candidate_ids, format, generated_by, created_at`,
      [
        dashId,
        job?.employer_id ?? null,
        String(input.jobId).trim(),
        JSON.stringify(cmp.data.candidates.map((c) => c.candidate_id)),
        input.format ?? 'json',
        JSON.stringify(report),
        input.generatedBy ?? null,
      ],
    );
    const row = rows[0];
    return ok({ ...row, id: String(row.id), dashboard_id: row.dashboard_id == null ? null : String(row.dashboard_id), report });
  } catch (e: any) {
    return err('conflict', `failed to generate comparison report: ${e?.message ?? 'error'}`);
  }
}

export async function getComparisonReport(pool: Pool, id: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'comparison_reports'))) return err('not_found', `report ${id} not found`);
  const n = Number(id);
  if (!Number.isFinite(n)) return err('invalid_input', 'report id must be numeric');
  try {
    const { rows } = await pool.query(`SELECT * FROM comparison_reports WHERE id = $1`, [n]);
    if (!rows[0]) return err('not_found', `report ${id} not found`);
    const row = rows[0];
    return ok({ ...row, id: String(row.id), dashboard_id: row.dashboard_id == null ? null : String(row.dashboard_id) });
  } catch (e: any) {
    return err('invalid_input', `failed to read report: ${e?.message ?? 'error'}`);
  }
}

export async function listComparisonReports(pool: Pool, jobId: string): Promise<EngineResult> {
  if (!(await relExists(pool, 'comparison_reports'))) return ok({ job_id: jobId, reports: [] });
  try {
    const { rows } = await pool.query(
      `SELECT id, dashboard_id, employer_id, job_id, candidate_ids, format, generated_by, created_at
         FROM comparison_reports WHERE job_id = $1 ORDER BY created_at DESC`, [String(jobId).trim()],
    );
    return ok({
      job_id: jobId,
      reports: rows.map((r) => ({ ...r, id: String(r.id), dashboard_id: r.dashboard_id == null ? null : String(r.dashboard_id) })),
    });
  } catch {
    return ok({ job_id: jobId, reports: [] });
  }
}
