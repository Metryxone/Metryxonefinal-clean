/**
 * Adaptive Difficulty Activation (MX-100X Phase 4).
 *
 * Pure, read-only engine that turns a role's SENIORITY (and, when present, the
 * runtime Role-DNA `expected_level`) into:
 *   1. a target proficiency anchor (continuous, 0–100),
 *   2. a target difficulty band + canonical rank (discretised, monotonic by level),
 *   3. level-aware readiness bands (the bar to be "Ready" rises with seniority),
 *   4. an HONEST per-domain bank-coverage analysis (does the live bank actually
 *      hold questions in the target band?).
 *
 * Why this exists: the live assessment path picked difficulty-agnostic questions
 * (always the all-`medium` 7-domain bank) and classified readiness against a
 * FIXED 85/72/58/45 ladder for every seniority. This engine activates the
 * Role/Seniority → required-proficiency → difficulty + threshold flow.
 *
 * Honesty contract:
 *   - `competency_runtime_weights` (runtime Role DNA) is consumed WHEN populated;
 *     when empty we fall back to the seniority anchor and STAMP the provenance.
 *   - The live 7-domain bank is 100% `medium`, so served difficulty CANNOT shift
 *     by level. `buildDifficultyPlan` surfaces this as an explicit `coverage_gap`
 *     per domain — it never fabricates band variety the bank does not have.
 *   - All DB access is to_regclass-probed and degrades to null/empty (never a
 *     fabricated 0). No writes, no DDL.
 */
import type { Pool } from 'pg';

export const ADAPTIVE_DIFFICULTY_ACTIVATION_VERSION = '1.0.0';

export type SeniorityBand = 'junior' | 'mid' | 'senior' | 'lead' | 'director';
/** ONE unified 3-tier difficulty ladder across the whole bank. Legacy
 *  easy/medium/hard rows are migrated to this vocabulary by the adaptive
 *  assessment seed; the aliases below keep any straggler coherent. */
export type DifficultyBand = 'foundational' | 'intermediate' | 'advanced';

/** Per-stage proficiency anchor — what a competent person at this stage typically
 *  scores. MUST stay in lockstep with STAGE_ANCHOR in competency-assessment-runtime.ts
 *  (gap analysis uses the same ladder). Senior (75) corresponds to the legacy fixed
 *  readiness ladder, so flag-ON readiness for a senior is byte-identical to flag-OFF. */
export const STAGE_ANCHOR: Record<SeniorityBand, number> = {
  junior: 55, mid: 65, senior: 75, lead: 80, director: 85,
};

/** Aliases callers may pass (career_stage values / loose seniority strings). */
const STAGE_ALIASES: Record<string, SeniorityBand> = {
  junior: 'junior', entry: 'junior', associate: 'junior', graduate: 'junior', intern: 'junior',
  mid: 'mid', 'mid-level': 'mid', midlevel: 'mid', intermediate: 'mid',
  senior: 'senior', sr: 'senior',
  lead: 'lead', staff: 'lead', principal: 'lead', manager: 'lead',
  director: 'director', head: 'director', vp: 'director', executive: 'director', exec: 'director',
};

/** Canonical rank over the UNIFIED 3-tier ladder (foundational/intermediate/
 *  advanced). Legacy vocabularies are aliased so any un-migrated straggler still
 *  ranks coherently: easy→foundational(1), medium→intermediate(2),
 *  hard→advanced(3). Unknown → 0 (never matches a target). */
export function difficultyRank(band: string | null | undefined): number {
  switch (String(band ?? '').trim().toLowerCase()) {
    case 'foundational':
    case 'easy':
      return 1;
    case 'intermediate':
    case 'medium':
      return 2;
    case 'advanced':
    case 'hard':
      return 3;
    default:
      return 0; // unknown → never matches a target (honest)
  }
}

/** Map a proficiency anchor (0–100) → target difficulty band + canonical rank
 *  on the unified 3-tier ladder. Monotonic non-decreasing by anchor:
 *  junior(55)→foundational, mid(65)→intermediate, senior+(≥75)→advanced. */
export function proficiencyToDifficulty(anchor: number): { band: DifficultyBand; rank: number; label: string } {
  const a = Math.max(0, Math.min(100, anchor));
  if (a < 60) return { band: 'foundational', rank: 1, label: 'foundational' };
  if (a < 75) return { band: 'intermediate', rank: 2, label: 'intermediate' };
  return { band: 'advanced', rank: 3, label: 'advanced' };
}

export function resolveSeniorityBand(stage: string | null | undefined): SeniorityBand {
  const key = String(stage ?? '').trim().toLowerCase();
  return STAGE_ALIASES[key] ?? 'mid';
}

export type SeniorityProfile = {
  stage_band: SeniorityBand;
  proficiency_anchor: number;
  proficiency_source: 'role_dna_expected_level' | 'seniority_anchor';
  target_difficulty: { band: DifficultyBand; rank: number; label: string };
};

/**
 * Resolve the seniority profile. When a runtime Role-DNA expected_level is
 * supplied (from competency_runtime_weights), it OVERRIDES the stage anchor and
 * the provenance is stamped accordingly; otherwise the stage anchor is used.
 */
export function resolveSeniorityProfile(
  stage: string | null | undefined,
  expectedLevelOverride?: number | null,
): SeniorityProfile {
  const band = resolveSeniorityBand(stage);
  const hasOverride = expectedLevelOverride != null && Number.isFinite(expectedLevelOverride);
  const anchor = hasOverride
    ? Math.max(0, Math.min(100, Number(expectedLevelOverride)))
    : STAGE_ANCHOR[band];
  return {
    stage_band: band,
    proficiency_anchor: anchor,
    proficiency_source: hasOverride ? 'role_dna_expected_level' : 'seniority_anchor',
    target_difficulty: proficiencyToDifficulty(anchor),
  };
}

export type ReadinessBands = {
  ready_min: number;
  near_ready_min: number;
  developing_min: number;
  emerging_min: number;
};

/** Default (legacy) readiness ladder — used when the activation flag is OFF and
 *  as the canonical anchor reference (senior). */
export const DEFAULT_READINESS_BANDS: ReadinessBands = {
  ready_min: 85, near_ready_min: 72, developing_min: 58, emerging_min: 45,
};

/**
 * Level-aware readiness bands. The bar to be "Ready" rises with seniority.
 * Calibrated so SENIOR (anchor 75) reproduces the legacy fixed ladder exactly
 * (85/72/58/45) → flag-ON is byte-identical to flag-OFF for a senior, while
 * junior gets a lower bar and director a higher bar. Monotonic in anchor on
 * every threshold; clamped to [0,100].
 */
export function levelAwareReadinessBands(anchor: number): ReadinessBands {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  // delta vs the senior baseline (anchor 75 → 0 shift → legacy ladder)
  const shift = Math.max(0, Math.min(100, anchor)) - STAGE_ANCHOR.senior;
  return {
    ready_min: clamp(DEFAULT_READINESS_BANDS.ready_min + shift),
    near_ready_min: clamp(DEFAULT_READINESS_BANDS.near_ready_min + shift),
    developing_min: clamp(DEFAULT_READINESS_BANDS.developing_min + shift),
    emerging_min: clamp(DEFAULT_READINESS_BANDS.emerging_min + shift),
  };
}

/** Classify a weighted score (0–100) against a readiness ladder. */
export function classifyReadiness(weighted: number, bands: ReadinessBands): string {
  if (weighted >= bands.ready_min) return 'Ready';
  if (weighted >= bands.near_ready_min) return 'Near-Ready';
  if (weighted >= bands.developing_min) return 'Developing';
  if (weighted >= bands.emerging_min) return 'Emerging';
  return 'Foundational';
}

/* --------------------------- bank coverage analysis -------------------------- */

const LIVE_DOMAINS = ['COG', 'COM', 'LEA', 'EXE', 'ADP', 'TEC', 'EIQ'];

export type DomainCoverage = {
  domain: string;
  approved_total: number;
  by_band: Array<{ band: string; rank: number; count: number }>;
  available_ranks: number[];
  target_band_available: boolean;
  coverage_gap: boolean;
  note: string;
};

export type DifficultyPlan = {
  ok: boolean;
  version: string;
  seniority: SeniorityProfile;
  readiness_bands: ReadinessBands;
  /** the per-competency score that meets the role's required proficiency */
  scoring_threshold: number;
  per_domain: DomainCoverage[];
  bank: {
    table_present: boolean;
    approved_total: number;
    distinct_bands: string[];
    served_difficulty_can_shift: boolean;
    note: string;
  };
  honest_notes: string[];
};

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS ok`, [name],
    );
    return !!r.rows[0]?.ok;
  } catch { return false; }
}

export type RoleDnaAnchor = {
  anchor: number | null;
  source_rows: number;
  reason: string;
};

/**
 * READ-ONLY lookup of the runtime Role-DNA expected proficiency for a role.
 * Chain: role (title OR id) → onto_roles → role_dna_profiles_v2 (is_active,
 * UUID) → competency_runtime_weights (role_dna_id UUID) → AVG(expected_level).
 * Every table is to_regclass probed; any missing table / no match / out-of-range
 * value → anchor=null with a reason (honest fallback to the stage anchor
 * downstream — never fabricated).
 *
 * Scale: `competency_runtime_weights.expected_level` is stored on a 0–100
 * proficiency scale (the runtime generator/seed write it that way — the curated
 * 1–5 `onto_role_weights.expected_level` is converted to 0–100 at seed time).
 * Values outside [0,100] are rejected (anchor=null) rather than silently coerced.
 */
export async function lookupRoleDnaAnchor(pool: Pool, role: string | null | undefined): Promise<RoleDnaAnchor> {
  const r = String(role ?? '').trim();
  if (!r) return { anchor: null, source_rows: 0, reason: 'no role supplied' };
  for (const t of ['competency_runtime_weights', 'role_dna_profiles_v2', 'onto_roles']) {
    if (!(await tableExists(pool, t))) {
      return { anchor: null, source_rows: 0, reason: `${t} absent — Role-DNA anchor unmeasurable` };
    }
  }
  try {
    const q = await pool.query<{ avg_expected: string | null; n: string }>(
      `SELECT AVG(crw.expected_level)::numeric AS avg_expected, COUNT(*)::int AS n
         FROM competency_runtime_weights crw
         JOIN role_dna_profiles_v2 dp ON dp.id = crw.role_dna_id AND dp.is_active = true
         JOIN onto_roles ro ON ro.id = dp.role_id
        WHERE crw.expected_level IS NOT NULL
          AND (lower(ro.title) = lower($1) OR lower(ro.id) = lower($1))`,
      [r],
    );
    const n = Number(q.rows[0]?.n ?? 0);
    if (n === 0) return { anchor: null, source_rows: 0, reason: 'no Role-DNA expected_level rows for this role' };
    const avg = q.rows[0]?.avg_expected != null ? Number(q.rows[0].avg_expected) : NaN;
    if (!Number.isFinite(avg) || avg < 0 || avg > 100) {
      return { anchor: null, source_rows: n, reason: `Role-DNA expected_level out of [0,100] range (avg=${avg}) — rejected, not coerced` };
    }
    return { anchor: Math.round(avg), source_rows: n, reason: `Role-DNA expected_level averaged over ${n} competencies` };
  } catch (e: any) {
    return { anchor: null, source_rows: 0, reason: `Role-DNA lookup failed: ${e?.message ?? 'error'}` };
  }
}

/**
 * Build the full difficulty plan for a (stage, role) request. READ-ONLY: probes
 * the bank, never writes. When the bank table is absent it degrades to an honest
 * "table_present:false" envelope (never a fabricated empty plan).
 */
export async function buildDifficultyPlan(
  pool: Pool,
  opts: { stage?: string | null; role?: string | null; expectedLevel?: number | null },
): Promise<DifficultyPlan> {
  const honest_notes: string[] = [];

  // Resolve the proficiency anchor: an explicit expectedLevel override wins; else
  // try the READ-ONLY Role-DNA lookup (competency_runtime_weights); else fall back
  // to the stage anchor. The lookup is byte-identical to the stage fallback while
  // the table is unpopulated (returns null → seniority_anchor).
  let effectiveExpectedLevel = opts.expectedLevel ?? null;
  if (effectiveExpectedLevel == null) {
    const dna = await lookupRoleDnaAnchor(pool, opts.role);
    if (dna.anchor != null) {
      effectiveExpectedLevel = dna.anchor;
      honest_notes.push(`Role-DNA anchor consumed: ${dna.reason}.`);
    } else {
      honest_notes.push(`Role-DNA anchor not used (${dna.reason}) — falling back to career-stage anchor.`);
    }
  }

  const seniority = resolveSeniorityProfile(opts.stage, effectiveExpectedLevel);
  const readiness_bands = levelAwareReadinessBands(seniority.proficiency_anchor);

  const present = await tableExists(pool, 'competency_question_templates');
  if (!present) {
    honest_notes.push('competency_question_templates absent — bank coverage unmeasurable (not zero).');
    return {
      ok: true, version: ADAPTIVE_DIFFICULTY_ACTIVATION_VERSION, seniority, readiness_bands,
      scoring_threshold: seniority.proficiency_anchor,
      per_domain: [],
      bank: { table_present: false, approved_total: 0, distinct_bands: [], served_difficulty_can_shift: false,
        note: 'bank table absent' },
      honest_notes,
    };
  }

  let rows: Array<{ competency_code: string; difficulty_band: string; n: number }> = [];
  try {
    const r = await pool.query<{ competency_code: string; difficulty_band: string; n: string }>(
      `SELECT competency_code, COALESCE(difficulty_band, 'unknown') AS difficulty_band, COUNT(*)::int AS n
         FROM competency_question_templates
        WHERE status = 'approved'
        GROUP BY 1, 2`,
    );
    rows = r.rows.map((x) => ({ competency_code: x.competency_code, difficulty_band: x.difficulty_band, n: Number(x.n) }));
  } catch {
    honest_notes.push('bank query failed — coverage degraded to empty (not fabricated).');
  }

  const targetRank = seniority.target_difficulty.rank;
  const per_domain: DomainCoverage[] = LIVE_DOMAINS.map((dom) => {
    const domRows = rows.filter((r) => r.competency_code === dom);
    const approved_total = domRows.reduce((a, b) => a + b.n, 0);
    const by_band = domRows
      .map((r) => ({ band: r.difficulty_band, rank: difficultyRank(r.difficulty_band), count: r.n }))
      .sort((a, b) => a.rank - b.rank);
    const available_ranks = Array.from(new Set(by_band.map((b) => b.rank))).filter((r) => r > 0).sort();
    const target_band_available = available_ranks.includes(targetRank);
    // A coverage gap exists when the domain HAS questions but none at the target rank.
    const coverage_gap = approved_total > 0 && !target_band_available;
    return {
      domain: dom,
      approved_total,
      by_band,
      available_ranks,
      target_band_available,
      coverage_gap,
      note: approved_total === 0
        ? 'no approved questions for this domain'
        : target_band_available
          ? 'target difficulty band available'
          : `target band (rank ${targetRank}) unavailable; bank holds ranks [${available_ranks.join(',') || 'none'}] — served difficulty cannot match target`,
    };
  });

  const distinctBands = Array.from(new Set(rows.map((r) => r.difficulty_band))).sort();
  const liveApprovedTotal = per_domain.reduce((a, b) => a + b.approved_total, 0);
  // The served difficulty can shift by level ONLY if the live bank holds >1 distinct
  // rank across the 7 served domains. After activation each domain carries a
  // foundational + advanced variant alongside its intermediate stock → it can shift.
  const liveRanks = Array.from(new Set(
    per_domain.flatMap((d) => d.available_ranks),
  ));
  const served_difficulty_can_shift = liveRanks.length > 1;
  if (served_difficulty_can_shift) {
    honest_notes.push(
      `Live 7-domain bank holds ${liveRanks.length} difficulty ranks [${liveRanks.slice().sort().join(',')}] — ` +
      'SERVED difficulty shifts by role level (harder/easier variants are selected via the affinity bonus).',
    );
  } else {
    honest_notes.push(
      'Live 7-domain bank holds a single difficulty rank — SERVED difficulty cannot shift by ' +
      'role level. Target difficulty + readiness/scoring thresholds DO shift; bank content is the ceiling.',
    );
  }

  return {
    ok: true,
    version: ADAPTIVE_DIFFICULTY_ACTIVATION_VERSION,
    seniority,
    readiness_bands,
    scoring_threshold: seniority.proficiency_anchor,
    per_domain,
    bank: {
      table_present: true,
      approved_total: liveApprovedTotal,
      distinct_bands: distinctBands,
      served_difficulty_can_shift,
      note: served_difficulty_can_shift
        ? 'bank holds multiple difficulty bands across served domains'
        : 'bank holds a single difficulty band across served domains (medium-only) — honest coverage ceiling',
    },
    honest_notes,
  };
}

/**
 * Difficulty-affinity bonus for a single bank row, given a target rank. Pure,
 * additive scoring term layered ON TOP of the existing affinity score when the
 * flag is ON. Returns 0 when the row's band rank is unknown (never penalises an
 * untagged row below a tagged one). On a single-band pool every row gets the
 * same bonus → selection order is unchanged (honest no-op); on the activated
 * multi-band bank the bonus favours the rows nearest the target rank.
 */
export function difficultyAffinityBonus(rowBand: string | null | undefined, targetRank: number): number {
  const r = difficultyRank(rowBand);
  if (r === 0) return 0;
  const distance = Math.abs(r - targetRank);
  // exact band → +0.6, one step away → +0.3, two+ → 0. Smaller than a role-tag
  // match (1.5) so difficulty refines WITHIN affinity tiers, never overrides them.
  if (distance === 0) return 0.6;
  if (distance === 1) return 0.3;
  return 0;
}
