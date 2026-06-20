/**
 * PHASE 4.3 — Career Readiness Aggregator.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built readiness
 * engines into ONE unified career-readiness envelope across four readiness types:
 *
 *   - Current Readiness — present-state employability (EI overall, ei-profile-engine).
 *   - Future Readiness  — Future Readiness Index / FRI (frp-readiness-engine).
 *   - Role Readiness    — readiness against the anchor role (role-readiness-v2).
 *   - Growth Readiness  — growth potential / headroom (ei-profile-engine).
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed scores — never recomputes, never fabricates, never
 *     zero-fills an absent measure.
 *   - Coverage (data exists) and Confidence (trustworthy) are reported as TWO
 *     SEPARATE axes, never composited into one number.
 *   - FRP fabrication guard: the FRI composer returns DEFAULT axis scores (~40)
 *     even with no underlying data, but exposes `confidence = real_sources / 5`.
 *     A Future block with zero real-data confidence is reported `measurable:false`
 *     with a `null` score — the default composite is NEVER surfaced as real.
 *   - Read-only & never-throws: every engine call is guarded; one failing source
 *     degrades its block to an honest unmeasured (with a note), never the whole
 *     envelope. ZERO DDL in the compose path — persistence is an explicit POST.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion/suitability
 *     predictions (the underlying engines' language_policy is surfaced unchanged).
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY, emptyConfidence, type DimensionConfidence } from './competency-ei-scoring-shared.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { computeRoleReadinessV2, type RoleReadinessV2 } from './role-readiness-v2.js';
import { computeFutureReadinessIndex, type FRIResult } from './frp-readiness-engine.js';

export const CAREER_READINESS_VERSION = '4.3.0';

export type ReadinessType = 'current' | 'future' | 'role' | 'growth';

/** Developmental readiness band — neutral language, NEVER a hiring verdict. */
export type ReadinessBand = 'Advanced' | 'Proficient' | 'Developing' | 'Emerging' | 'Unmeasured';

function bandFromScore(score: number | null): ReadinessBand {
  if (score == null || !Number.isFinite(score)) return 'Unmeasured';
  if (score >= 80) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

/** The two honesty axes, surfaced together but NEVER composited into one number. */
export interface CoverageConfidence {
  coverage: {
    measurable: boolean;
    coverage_pct: number | null;
    detail: string;
  };
  confidence: {
    band: DimensionConfidence['band'] | 'None';
    /** 0..1 fraction of real (non-default) signals, when the source exposes it. */
    value: number | null;
    basis: string;
    caps: string[];
  };
}

export interface ReadinessBlock {
  type: ReadinessType;
  label: string;
  measurable: boolean;
  score: number | null;
  band: ReadinessBand | string | null;
  axes: CoverageConfidence;
  /** Type-specific honest extras (components, provenance, gaps) — never fabricated. */
  detail: Record<string, unknown>;
  notes: string[];
}

export interface CareerReadinessEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  /** True when at least one readiness block is measurable. */
  measurable: boolean;
  /** Composite over the measurable PRESENT-readiness blocks (current/future/role).
   *  Growth is a potential/headroom axis and is intentionally excluded from the
   *  present-readiness composite. */
  overall: {
    measurable: boolean;
    score: number | null;
    band: ReadinessBand;
    contributing: ReadinessType[];
    basis: string;
  };
  current: ReadinessBlock;
  future: ReadinessBlock;
  role: ReadinessBlock;
  growth: ReadinessBlock;
  source_versions: Record<string, string>;
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function eiAxes(
  measurable: boolean,
  coveragePct: number | null,
  confidence: DimensionConfidence | null,
  coverageDetail: string,
): CoverageConfidence {
  const conf = confidence ?? emptyConfidence('domain_proxy', 'no measured competency profile');
  const caps = Array.isArray(conf?.caps) ? conf.caps : [];
  return {
    coverage: { measurable, coverage_pct: coveragePct, detail: coverageDetail },
    confidence: {
      band: measurable ? (conf?.band ?? 'None') : 'None',
      value: null,
      basis: conf?.measurement || 'no measured competency profile',
      caps,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Aggregator — compose every readiness engine ONCE for one subject (read-only).
// ---------------------------------------------------------------------------

export async function buildCareerReadiness(
  pool: Pool,
  subjectId: string,
): Promise<CareerReadinessEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Compose each source ONCE; each guarded so one failure never sinks the envelope.
  const profile = await buildEiProfile(pool, sid).catch((e) => {
    notes.push(`EI profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });
  const role = await computeRoleReadinessV2(pool, sid).catch(() => null);
  const fri = await computeFutureReadinessIndex(sid, pool).catch(() => null);

  const current = buildCurrentBlock(profile);
  const future = buildFutureBlock(fri);
  const roleBlock = buildRoleBlock(role);
  const growth = buildGrowthBlock(profile);

  // Present-readiness composite over MEASURABLE current/future/role only.
  const present: ReadinessBlock[] = [current, future, roleBlock].filter((b) => b.measurable && b.score != null);
  const overallMeasurable = present.length > 0;
  const overallScore = overallMeasurable
    ? round1(present.reduce((a, b) => a + (b.score as number), 0) / present.length)
    : null;
  const contributing = present.map((b) => b.type);

  const measurable = current.measurable || future.measurable || roleBlock.measurable || growth.measurable;

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_READINESS_VERSION,
    generated_at: new Date().toISOString(),
    measurable,
    overall: {
      measurable: overallMeasurable,
      score: overallScore,
      band: bandFromScore(overallScore),
      contributing,
      basis: overallMeasurable
        ? `unweighted mean of ${present.length} measurable present-readiness block(s): ${contributing.join(', ')}`
        : 'no measurable present-readiness block (current/future/role)',
    },
    current,
    future,
    role: roleBlock,
    growth,
    source_versions: collectVersions(profile, role, fri),
    language_policy: profile?.language_policy ?? LANGUAGE_POLICY,
    notes,
  };
}

function collectVersions(
  profile: EiProfile | null,
  role: RoleReadinessV2 | null,
  fri: FRIResult | null,
): Record<string, string> {
  const out: Record<string, string> = { career_readiness: CAREER_READINESS_VERSION };
  if (profile) out.ei_profile = profile.version;
  if (role) out.role_readiness = role.version;
  if (fri) out.future_readiness = 'frp';
  return out;
}

// --- Current Readiness (EI overall) -----------------------------------------

function buildCurrentBlock(profile: EiProfile | null): ReadinessBlock {
  const notes: string[] = [];
  const measurable = profile?.overall_ei.measurable ?? false;
  if (!profile) notes.push('Current readiness unavailable — no EI profile (honest absence).');
  else if (!measurable) notes.push('Current readiness not yet measurable — no measured competency profile.');

  const score = measurable ? (profile?.overall_ei.ei_score ?? null) : null;
  return {
    type: 'current',
    label: 'Current Readiness',
    measurable,
    score,
    band: measurable ? (profile?.overall_ei.band ?? bandFromScore(score)) : 'Unmeasured',
    axes: eiAxes(
      measurable,
      profile?.overall_ei.coverage_pct ?? null,
      profile?.overall_ei.confidence ?? null,
      measurable
        ? `${profile?.coverage.dimensions_measurable}/${profile?.coverage.dimensions_total} EI dimensions measured`
        : 'EI profile not provisioned',
    ),
    detail: {
      source: 'ei_profile_engine.overall_ei',
      dimensions_total: profile?.coverage.dimensions_total ?? 0,
      dimensions_measurable: profile?.coverage.dimensions_measurable ?? 0,
    },
    notes,
  };
}

// --- Future Readiness (FRP / FRI) -------------------------------------------

/**
 * Honest substrate count for the FRI axes.
 *
 * The FRP engine's own `confidence` is OPTIMISTIC: its real-source filter only
 * excludes `default*`/`error*`/`no_*` prefixes, so zero-data sentinels such as
 * `capadex_session_count:0` (0 sessions), `wcl0_dims_empty`, and
 * `role_not_in_catalog` are counted as "real". We re-classify each axis against
 * the source string that the engine ACTUALLY emits when grounded, so a subject
 * with no Future-Readiness substrate scores 0 here (and is reported unmeasured)
 * — we never surface FRP's default ~40 composite as a real score. This re-derives
 * only the Coverage/Confidence axes; the composite itself stays FRP's, unchanged.
 */
function friRealSignalCount(prov: Record<string, unknown>): number {
  const s = (k: string) => String(prov?.[k] ?? '');
  let n = 0;
  if (s('skill_durability') === 'frp_user_skill_profile') n++;
  if (s('adaptability') === 'wcl0_user_intelligence') n++;
  if (s('market_alignment').startsWith('industry_forecast:')) n++;
  const lv = s('learning_velocity');
  const lvReal =
    lv === 'lip_readiness_snapshot' ||
    lv === 'competency_single_assessment' ||
    lv.startsWith('competency_progression:') ||
    lv.startsWith('frp_skill_activity:') ||
    (lv.startsWith('capadex_session_count:') && lv !== 'capadex_session_count:0');
  if (lvReal) n++;
  if (s('role_resilience').startsWith('automation_risk:')) n++;
  return n;
}

function buildFutureBlock(fri: FRIResult | null): ReadinessBlock {
  const notes: string[] = [];
  // FRP returns default axis scores (~40) even with no data. We compute an honest
  // substrate count from provenance (stricter than FRP's optimistic confidence)
  // and treat zero substrate as UNMEASURED: surface a null score, NEVER the
  // default composite. This is the fabrication guard.
  const realCount = fri ? friRealSignalCount(fri.provenance ?? {}) : 0;
  const confValue = realCount / 5;
  const measurable = !!fri && realCount > 0;
  if (!fri) notes.push('Future readiness unavailable — FRP engine returned no result (honest absence).');
  else if (!measurable) {
    notes.push('Future readiness not measurable — no real Future-Readiness signals (FRP profile/forecast absent); default composite suppressed, not surfaced as a real score.');
  }

  const score = measurable ? Math.round(fri!.composite) : null;
  return {
    type: 'future',
    label: 'Future Readiness',
    measurable,
    score,
    band: measurable ? (fri!.band ?? bandFromScore(score)) : 'Unmeasured',
    axes: {
      coverage: {
        measurable,
        coverage_pct: measurable ? Math.round(confValue * 100) : null,
        detail: measurable
          ? `${Math.round(confValue * 5)}/5 Future-Readiness signals backed by real data`
          : 'no real Future-Readiness signals',
      },
      confidence: {
        band: measurable ? (confValue >= 0.6 ? 'High' : confValue >= 0.3 ? 'Moderate' : 'Low') : 'None',
        value: fri ? round1(confValue) : null,
        basis: 'fraction of FRI axes (skill durability / adaptability / market alignment / learning velocity / role resilience) backed by real data',
        caps: measurable ? [] : ['no_real_signals'],
      },
    },
    detail: measurable
      ? {
          source: 'frp_readiness_engine',
          axes: {
            skill_durability: fri!.skill_durability,
            adaptability: fri!.adaptability,
            market_alignment: fri!.market_alignment,
            learning_velocity: fri!.learning_velocity,
            role_resilience: fri!.role_resilience,
          },
          provenance: fri!.provenance,
        }
      : { source: 'frp_readiness_engine', provenance: fri?.provenance ?? null },
    notes,
  };
}

// --- Role Readiness (role-readiness-v2) -------------------------------------

function buildRoleBlock(role: RoleReadinessV2 | null): ReadinessBlock {
  const notes: string[] = [];
  const measurable = role?.measurable ?? false;
  if (!role) notes.push('Role readiness unavailable — no measured competency profile (honest absence).');
  else if (!measurable) notes.push('Role readiness not measurable — no anchor role or no measured profile.');

  const score = measurable ? (role?.readiness.score ?? null) : null;
  return {
    type: 'role',
    label: 'Role Readiness',
    measurable,
    score,
    band: measurable ? (role?.readiness.band ?? bandFromScore(score)) : 'Unmeasured',
    axes: eiAxes(
      measurable,
      role?.readiness.coverage_pct ?? null,
      role?.ei_profile_summary.confidence ?? null,
      measurable ? 'role readiness measured against role requirements' : 'role readiness not measurable',
    ),
    detail: {
      source: 'role_readiness_v2',
      role_id: role?.role_id ?? null,
      role_title: role?.role_title ?? null,
      fit_band: role?.role_match.fit_band ?? 'unmeasured',
      capped_by_critical: role?.role_match.capped_by_critical ?? false,
      blocking_gaps: role?.role_gap.blocking_gaps ?? 0,
    },
    notes,
  };
}

// --- Growth Readiness (EI growth potential) ---------------------------------

function buildGrowthBlock(profile: EiProfile | null): ReadinessBlock {
  const notes: string[] = [];
  const gp = profile?.growth_potential ?? null;
  const measurable = (profile?.measurable ?? false) && gp?.score != null;
  if (!profile) notes.push('Growth readiness unavailable — no EI profile (honest absence).');
  else if (!measurable) notes.push('Growth readiness not measurable — growth potential requires a measured EI profile.');

  const score = measurable ? (gp?.score ?? null) : null;
  return {
    type: 'growth',
    label: 'Growth Readiness',
    measurable,
    score,
    band: measurable ? (gp?.level ?? 'Unmeasured') : 'Unmeasured',
    axes: eiAxes(
      profile?.measurable ?? false,
      profile?.overall_ei.coverage_pct ?? null,
      profile?.confidence ?? null,
      'growth potential = weighted headroom across improvable EI dimensions',
    ),
    detail: {
      source: 'ei_profile_engine.growth_potential',
      level: gp?.level ?? 'Unmeasured',
      improvable_dimensions: gp?.improvable_dimensions ?? [],
      drivers: gp?.drivers ?? [],
      reason: gp?.reason ?? 'no measured competency profile',
    },
    notes,
  };
}

// ---------------------------------------------------------------------------
// Append-only history persistence (explicit POST path only — NEVER on a GET).
// The DDL here is reached ONLY behind the careerReadiness flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerReadinessHistorySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_readiness_history (
      id              BIGSERIAL PRIMARY KEY,
      subject_id      TEXT NOT NULL,
      overall_score   NUMERIC,
      overall_band    TEXT,
      current_score   NUMERIC,
      current_band    TEXT,
      future_score    NUMERIC,
      future_band     TEXT,
      role_score      NUMERIC,
      role_band       TEXT,
      growth_score    NUMERIC,
      growth_level    TEXT,
      measurable      BOOLEAN NOT NULL DEFAULT FALSE,
      snapshot        JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_readiness_history_subject
       ON career_readiness_history (subject_id, created_at DESC)`,
  );
}

export interface ReadinessHistoryRow {
  id: number;
  subject_id: string;
  overall_score: number | null;
  overall_band: string | null;
  current_score: number | null;
  current_band: string | null;
  future_score: number | null;
  future_band: string | null;
  role_score: number | null;
  role_band: string | null;
  growth_score: number | null;
  growth_level: string | null;
  measurable: boolean;
  created_at: string;
}

/** Append-only — NEVER updates an existing row. Mirrors cg_readiness_history. */
export async function persistCareerReadinessSnapshot(
  pool: Pool,
  env: CareerReadinessEnvelope,
): Promise<ReadinessHistoryRow> {
  await ensureCareerReadinessHistorySchema(pool);
  const r = await pool.query(
    `INSERT INTO career_readiness_history
       (subject_id, overall_score, overall_band,
        current_score, current_band, future_score, future_band,
        role_score, role_band, growth_score, growth_level,
        measurable, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, subject_id, overall_score, overall_band,
               current_score, current_band, future_score, future_band,
               role_score, role_band, growth_score, growth_level,
               measurable, created_at`,
    [
      env.subject_id,
      env.overall.score,
      env.overall.band,
      env.current.score,
      env.current.band,
      env.future.score,
      env.future.band,
      env.role.score,
      env.role.band,
      env.growth.score,
      typeof env.growth.band === 'string' ? env.growth.band : null,
      env.measurable,
      JSON.stringify(env),
    ],
  );
  return r.rows[0] as ReadinessHistoryRow;
}

/** Read-only history. Uses a to_regclass probe so a GET NEVER triggers DDL —
 *  if no snapshot has ever been taken the table is absent => honest empty. */
export async function listCareerReadinessHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: ReadinessHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_readiness_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, overall_score, overall_band,
              current_score, current_band, future_score, future_band,
              role_score, role_band, growth_score, growth_level,
              measurable, created_at
       FROM career_readiness_history
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as ReadinessHistoryRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as ReadinessHistoryRow[] };
}
