/**
 * Competency Intelligence Spine Contracts — 98X Gap Closure, Phase 2
 * (additive, flag-gated, read-only).
 *
 * WHAT THIS IS
 * ------------
 * A NEW, isolated contracts module + read-only resolver that gives every downstream
 * consumer ONE canonical competency read. Today the platform produces TWO parallel
 * scoring ledgers that no consumer unions:
 *   1. Rich/normalized scorer → `onto_competency_score_runs`
 *        per-competency (`comp_*`) normalized scores (competency_scores jsonb).
 *   2. Runtime generate→score path → `onto_competency_profiles`
 *        per-domain (`dom_*`) scaled scores (profile jsonb), 1 append-only row/run.
 *
 * The two ledgers express scores at DIFFERENT granularities (competency vs domain),
 * so a "scored subjects" read that hits only one ledger reports the other ledger's
 * subjects as unscored (the dual-ledger trap). This resolver UNIONs them: latest row
 * per subject per ledger, normalized into ONE typed object.
 *
 * HONESTY CONTRACT
 * ----------------
 * - NO new scoring math. The resolver only SELECTs + re-shapes already-persisted data.
 * - NO writes, NO DDL. Reads use a `to_regclass` probe + degrade — a missing table
 *   yields `available:false`, never an error and never a fabricated score.
 * - `null` where a value was not measured — never coerced to 0.
 * - Each ledger's own confidence/provenance is inherited and carried through; the
 *   resolver never invents a confidence it cannot source.
 */
import type { Pool } from 'pg';

export const COMPETENCY_SPINE_CONTRACTS_VERSION = '98x-phase2-1.0.0';

// ---------------------------------------------------------------------------
// Typed contracts (pure) — adopted by NEW consumers; existing consumers unchanged.
// ---------------------------------------------------------------------------

/** Which ledger a unified score came from. */
export type CompetencyLedger = 'normalized_run' | 'runtime_profile';

/** Granularity of a unified score row. */
export type CompetencyGranularity = 'competency' | 'domain';

export interface UnifiedCompetencyScore {
  /** Canonical key — `comp_*` for competency granularity, `dom_*` for domain granularity. */
  key: string;
  /** Human label where available; falls back to the key. */
  label: string;
  granularity: CompetencyGranularity;
  /** 0..100 normalized/scaled score, or null when unmeasured (never a fake 0). */
  score: number | null;
  /** Discrete proficiency level (1..5) where the ledger provides one, else null. */
  level: number | null;
  levelLabel: string | null;
  /** e.g. 'measured' | 'indeterminate' — inherited from the source ledger when present. */
  status: string | null;
  ledger: CompetencyLedger;
}

export interface UnifiedCompetencyGap {
  key: string;
  label: string;
  granularity: CompetencyGranularity;
  score: number | null;
  /** Deterministic gap band derived from the score (never a hiring/suitability verdict). */
  gapBand: 'developing' | 'emerging' | 'established' | 'unmeasured';
}

export interface UnifiedCompetencyRecommendation {
  /** Read-only developmental focus pointer (NOT a hiring/promotion recommendation). */
  focusKey: string;
  focusLabel: string;
  granularity: CompetencyGranularity;
  reason: string;
}

export interface UnifiedLedgerSnapshot {
  ledger: CompetencyLedger;
  present: boolean;
  /** Source row id (uuid for runs, integer for profiles), stringified. */
  sourceId: string | null;
  scoredAt: string | null;
  overallScore: number | null;
  overallLevel: number | null;
  /** Confidence/coverage provenance inherited from the ledger (shape varies by ledger). */
  provenance: Record<string, unknown> | null;
  scoreCount: number;
}

export interface UnifiedCompetencyProfile {
  subjectId: string;
  /** True when at least one ledger had a row for this subject. */
  resolved: boolean;
  /** Ledgers that contributed (latest row each). */
  ledgers: UnifiedLedgerSnapshot[];
  /** Union of per-key scores across both ledgers (competency + domain granularity). */
  scores: UnifiedCompetencyScore[];
  gaps: UnifiedCompetencyGap[];
  recommendations: UnifiedCompetencyRecommendation[];
  /** Best available overall score across ledgers (prefers normalized run), or null. */
  overallScore: number | null;
  overallLevel: number | null;
  /** Which ledger supplied the headline overall, or null when unmeasured. */
  overallSource: CompetencyLedger | null;
  available: boolean;
  note: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Internal helpers (read-only, degrade-by-default)
// ---------------------------------------------------------------------------
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [name]);
    return !!rows[0]?.reg;
  } catch {
    return false;
  }
}

/** Coerce to a finite number, or null. NEVER turns null/'' into 0. */
function scoreOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Public alias of the null-safe score coercion (exported for tests/consumers). */
export function isUnifiedScoreNullSafe(v: unknown): number | null {
  return scoreOrNull(v);
}

function intOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function gapBandOf(score: number | null): UnifiedCompetencyGap['gapBand'] {
  if (score == null) return 'unmeasured';
  if (score < 40) return 'developing';
  if (score < 70) return 'emerging';
  return 'established';
}

// ---------------------------------------------------------------------------
// Ledger readers — each returns the LATEST row for the subject, or null.
// ---------------------------------------------------------------------------
interface NormalizedRun {
  sourceId: string;
  scoredAt: string | null;
  overall: any;
  competencyScores: any[];
  normalization: any;
  status: string | null;
  source: string | null;
}

/** A ledger read distinguishes a MISSING table (degrade) from a present-but-empty one (honest empty). */
interface LedgerRead<T> {
  tablePresent: boolean;
  row: T | null;
}

async function readLatestNormalizedRun(pool: Pool, subjectId: string): Promise<LedgerRead<NormalizedRun>> {
  if (!(await tableExists(pool, 'onto_competency_score_runs'))) return { tablePresent: false, row: null };
  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, overall, competency_scores, normalization, status, source
         FROM onto_competency_score_runs
        WHERE subject_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1`,
      [subjectId],
    );
    if (!rows.length) return { tablePresent: true, row: null };
    const r = rows[0];
    return {
      tablePresent: true,
      row: {
        sourceId: String(r.id),
        scoredAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        overall: r.overall ?? null,
        competencyScores: Array.isArray(r.competency_scores) ? r.competency_scores : [],
        normalization: r.normalization ?? null,
        status: r.status ?? null,
        source: r.source ?? null,
      },
    };
  } catch {
    // Table exists but read failed (e.g. permission/column drift): treat as inaccessible → degrade.
    return { tablePresent: false, row: null };
  }
}

interface RuntimeProfile {
  sourceId: string;
  scoredAt: string | null;
  overallScore: number | null;
  overallLevel: number | null;
  profile: any[];
  coverage: any;
  roleId: string | null;
}

async function readLatestRuntimeProfile(pool: Pool, subjectId: string): Promise<LedgerRead<RuntimeProfile>> {
  if (!(await tableExists(pool, 'onto_competency_profiles'))) return { tablePresent: false, row: null };
  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, overall_score, overall_level, profile, coverage, role_id
         FROM onto_competency_profiles
        WHERE subject_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1`,
      [subjectId],
    );
    if (!rows.length) return { tablePresent: true, row: null };
    const r = rows[0];
    return {
      tablePresent: true,
      row: {
        sourceId: String(r.id),
        scoredAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        overallScore: scoreOrNull(r.overall_score),
        overallLevel: intOrNull(r.overall_level),
        profile: Array.isArray(r.profile) ? r.profile : [],
        coverage: r.coverage ?? null,
        roleId: r.role_id ?? null,
      },
    };
  } catch {
    // Table exists but read failed: treat as inaccessible → degrade.
    return { tablePresent: false, row: null };
  }
}

// ---------------------------------------------------------------------------
// Resolver — UNION both ledgers into one canonical profile (read-only)
// ---------------------------------------------------------------------------
export async function resolveUnifiedCompetencyProfile(
  pool: Pool,
  subjectId: string,
): Promise<UnifiedCompetencyProfile> {
  const base: UnifiedCompetencyProfile = {
    subjectId,
    resolved: false,
    ledgers: [],
    scores: [],
    gaps: [],
    recommendations: [],
    overallScore: null,
    overallLevel: null,
    overallSource: null,
    available: true,
    note:
      'Unified competency profile = latest row per ledger (onto_competency_score_runs ' +
      'per-competency comp_* + onto_competency_profiles per-domain dom_*), unioned. ' +
      'Read-only: no scoring math, no writes. null = unmeasured (never a fabricated 0).',
    version: COMPETENCY_SPINE_CONTRACTS_VERSION,
  };

  if (!subjectId) {
    return { ...base, available: true, note: 'subjectId is required.' };
  }

  const [runRead, profileRead] = await Promise.all([
    readLatestNormalizedRun(pool, subjectId),
    readLatestRuntimeProfile(pool, subjectId),
  ]);
  const run = runRead.row;
  const profile = profileRead.row;

  // Substrate availability: both ledger tables absent/inaccessible → degrade (available:false),
  // so a missing substrate is DISTINGUISHABLE from a subject with no scores (honest empty).
  const available = runRead.tablePresent || profileRead.tablePresent;
  if (!available) {
    return {
      ...base,
      available: false,
      note:
        'Competency ledger tables (onto_competency_score_runs, onto_competency_profiles) are ' +
        'not present or not readable in this environment — degraded, not empty (no scores fabricated).',
    };
  }

  const scores: UnifiedCompetencyScore[] = [];

  // --- Normalized run ledger (per-competency comp_*) ---
  if (run) {
    for (const cs of run.competencyScores) {
      const key = String(cs?.competency_id ?? '').trim();
      if (!key) continue;
      scores.push({
        key,
        label: cs?.competency_name ?? key,
        granularity: 'competency',
        score: scoreOrNull(cs?.normalized_score),
        level: intOrNull(cs?.level),
        levelLabel: cs?.level_label ?? null,
        status: cs?.level_status ?? null,
        ledger: 'normalized_run',
      });
    }
  }

  // --- Runtime profile ledger (per-domain dom_*) ---
  if (profile) {
    for (const dom of profile.profile) {
      const key = String(dom?.onto_domain ?? '').trim();
      if (!key) continue;
      scores.push({
        key,
        label: dom?.label ?? key,
        granularity: 'domain',
        score: scoreOrNull(dom?.scaled_score),
        level: intOrNull(dom?.level),
        levelLabel: null,
        status: null,
        ledger: 'runtime_profile',
      });
    }
  }

  const ledgers: UnifiedLedgerSnapshot[] = [
    {
      ledger: 'normalized_run',
      present: !!run,
      sourceId: run?.sourceId ?? null,
      scoredAt: run?.scoredAt ?? null,
      overallScore: run ? scoreOrNull(run.overall?.overall_score ?? run.overall?.score) : null,
      overallLevel: run ? intOrNull(run.overall?.overall_level ?? run.overall?.level) : null,
      provenance: run ? { status: run.status, source: run.source, normalization: run.normalization } : null,
      scoreCount: run ? run.competencyScores.length : 0,
    },
    {
      ledger: 'runtime_profile',
      present: !!profile,
      sourceId: profile?.sourceId ?? null,
      scoredAt: profile?.scoredAt ?? null,
      overallScore: profile?.overallScore ?? null,
      overallLevel: profile?.overallLevel ?? null,
      provenance: profile ? { coverage: profile.coverage, role_id: profile.roleId } : null,
      scoreCount: profile ? profile.profile.length : 0,
    },
  ];

  // Headline overall: prefer the normalized run, else the runtime profile. null if neither.
  const runOverall = ledgers[0].overallScore;
  const profileOverall = ledgers[1].overallScore;
  let overallScore: number | null = null;
  let overallLevel: number | null = null;
  let overallSource: CompetencyLedger | null = null;
  if (runOverall != null) {
    overallScore = runOverall;
    overallLevel = ledgers[0].overallLevel;
    overallSource = 'normalized_run';
  } else if (profileOverall != null) {
    overallScore = profileOverall;
    overallLevel = ledgers[1].overallLevel;
    overallSource = 'runtime_profile';
  }

  const gaps: UnifiedCompetencyGap[] = scores.map((s) => ({
    key: s.key,
    label: s.label,
    granularity: s.granularity,
    score: s.score,
    gapBand: gapBandOf(s.score),
  }));

  // Recommendations = developmental focus pointers on the lowest MEASURED scores only
  // (never fabricated from an unmeasured key; never a hiring/suitability verdict).
  const recommendations: UnifiedCompetencyRecommendation[] = scores
    .filter((s) => s.score != null && s.score < 70)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 5)
    .map((s) => ({
      focusKey: s.key,
      focusLabel: s.label,
      granularity: s.granularity,
      reason: `Measured ${Math.round(s.score as number)} (developmental focus area).`,
    }));

  const resolved = !!run || !!profile;
  return {
    ...base,
    resolved,
    ledgers,
    scores,
    gaps,
    recommendations,
    overallScore,
    overallLevel,
    overallSource,
    note: resolved
      ? base.note
      : 'No competency scores found for this subject in either ledger (honest empty; not fabricated).',
  };
}
