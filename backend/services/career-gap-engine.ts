/**
 * PHASE 4.4 — Career Gap Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built role
 * readiness gap analysis (role-readiness-v2 → Phase 2 role readiness) and the
 * additive competency-TYPE classification (onto_competency_type_map) into ONE
 * unified Career Gap view across the five competency TYPES the product surfaces:
 *
 *   - Skill Gaps        — competency TYPE `technical`
 *   - Behavioral Gaps   — competency TYPE `behavioral`
 *   - Cognitive Gaps    — competency TYPE `cognitive`
 *   - Functional Gaps   — competency TYPE `functional`
 *   - Future Skill Gaps — competency TYPE `future_skills`, enriched (separately)
 *                         with a forward-looking FRP/FRI signal.
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed gaps — it NEVER recomputes a readiness/gap score
 *     and NEVER fabricates a competency level.
 *   - Type classification is NEVER invented: a gapped competency with no
 *     `onto_competency_type_map` row falls into an honest `unclassified` bucket
 *     and LOWERS the classified-coverage axis. (The classification table is
 *     flag-gated/seeded separately and may be empty in some environments.)
 *   - Coverage (how much we could classify / measure) and Confidence (how
 *     trustworthy the underlying readiness measurement is) are reported as TWO
 *     SEPARATE axes, never composited into one number.
 *   - Future-Skill bucket: competency-level future_skills gaps come from the role
 *     requirements; the FRP/FRI forward signal is surfaced SEPARATELY and only
 *     when it is backed by REAL data (reusing the 4.3 fabrication guard
 *     `friRealSignalCount`) — FRP's default ~40 composite is never surfaced.
 *   - Read-only & never-throws: every source call is guarded; one failing source
 *     degrades its part to an honest empty/unmeasured, never the whole envelope.
 *     ZERO DDL in the compose path — persistence is an explicit POST.
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion/suitability
 *     predictions (the composed engines' language_policy is surfaced unchanged).
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import { computeRoleReadinessV2, type RoleReadinessV2 } from './role-readiness-v2.js';
import { computeFutureReadinessIndex, type FRIResult } from './frp-readiness-engine.js';
import { friRealSignalCount } from './career-readiness-aggregator.js';

export const CAREER_GAP_VERSION = '4.4.0';

/** The five canonical competency TYPES (onto_competency_types.type_key). */
export type GapTypeKey = 'technical' | 'behavioral' | 'cognitive' | 'functional' | 'future_skills';

export const GAP_TYPE_ORDER: GapTypeKey[] = [
  'technical',
  'behavioral',
  'cognitive',
  'functional',
  'future_skills',
];

/** User-facing labels — the product's wording for each TYPE bucket. */
export const GAP_TYPE_LABELS: Record<GapTypeKey, string> = {
  technical: 'Skill Gaps',
  behavioral: 'Behavioral Gaps',
  cognitive: 'Cognitive Gaps',
  functional: 'Functional Gaps',
  future_skills: 'Future Skill Gaps',
};

export interface GapItem {
  competency_id: string;
  competency_name: string | null;
  type_key: GapTypeKey | 'unclassified';
  required_level: number;
  actual_level: number | null;
  /** required − actual, clamped ≥ 0. Re-shaped from the readiness gap, not recomputed. */
  gap: number;
  criticality: string;
  blocking: boolean;
  /** Provenance of the TYPE assignment (null when unclassified). */
  type_confidence: string | null;
  type_provenance: string | null;
}

export interface GapBucket {
  type_key: GapTypeKey;
  label: string;
  measurable: boolean;
  items: GapItem[];
  gap_count: number;
  critical_count: number;
  blocking_count: number;
  max_gap: number | null;
  mean_gap: number | null;
  notes: string[];
}

/** Honest forward-looking signal for the Future-Skill bucket — kept SEPARATE
 *  from competency-level future_skills gaps and only emitted with real data. */
export interface FutureOutlook {
  measurable: boolean;
  composite: number | null;
  band: string | null;
  /** FRI axes (0–100; lower = more future-readiness development needed). */
  axes: Record<string, number> | null;
  /** Axes flagged as forward development areas (axis value below threshold). */
  development_areas: Array<{ axis: string; value: number }>;
  real_signal_count: number;
  basis: string;
}

export interface CoverageConfidence {
  coverage: {
    measurable: boolean;
    /** Fraction of gapped competencies we could assign to a TYPE (0–100). */
    classified_pct: number | null;
    detail: string;
  };
  confidence: {
    band: string;
    /** 0..1 — inherited from the readiness measurement (never re-derived here). */
    value: number | null;
    basis: string;
    caps: string[];
  };
}

export interface CareerGapEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  target_career: {
    role_id: string | null;
    role_title: string | null;
    source: string;
  };
  required: {
    total_gaps: number;
    measured_against: string;
  };
  /** The five TYPE buckets, always present (empty + measurable:false when absent). */
  buckets: Record<GapTypeKey, GapBucket>;
  /** Gapped competencies with no TYPE-map row — honest, never forced into a bucket. */
  unclassified: GapItem[];
  summary: {
    total_gaps: number;
    total_critical: number;
    total_blocking: number;
    classified_pct: number | null;
    most_material: GapItem | null;
  };
  future_outlook: FutureOutlook;
  axes: CoverageConfidence;
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function emptyBucket(type: GapTypeKey): GapBucket {
  return {
    type_key: type,
    label: GAP_TYPE_LABELS[type],
    measurable: false,
    items: [],
    gap_count: 0,
    critical_count: 0,
    blocking_count: 0,
    max_gap: null,
    mean_gap: null,
    notes: [],
  };
}

function emptyBuckets(): Record<GapTypeKey, GapBucket> {
  return {
    technical: emptyBucket('technical'),
    behavioral: emptyBucket('behavioral'),
    cognitive: emptyBucket('cognitive'),
    functional: emptyBucket('functional'),
    future_skills: emptyBucket('future_skills'),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isCriticalGap(g: GapItem): boolean {
  const c = String(g.criticality ?? '').toLowerCase();
  return g.blocking || c === 'critical' || c === 'high';
}

/**
 * EVERY relation (tables AND explicit indexes) created by the shared Phase-2
 * `ensureCompetencyRuntimeSchema`. The read path is only safe to enter when ALL
 * of them already exist — otherwise the transitive ensure would CREATE the
 * missing one(s) via `CREATE TABLE/INDEX IF NOT EXISTS`. Kept in lockstep with
 * the engine's DDL so NO schema object can ever be created on a GET.
 * (Primary-key indexes are created atomically inside the CREATE TABLE IF NOT
 * EXISTS statements, so they need no separate probe.)
 */
export const COMPETENCY_RUNTIME_RELATIONS = [
  // tables
  'onto_assessment_instances',
  'onto_assessment_responses',
  'onto_competency_scores',
  'onto_competency_profiles',
  // explicit CREATE INDEX statements
  'idx_oai_subject',
  'idx_oai_blueprint',
  'uq_oar_instance_q',
  'idx_oar_instance',
  'idx_ocs_instance',
  'idx_ocs_subject',
  'idx_ocp_subject',
  'idx_ocp_instance',
] as const;

/**
 * Read-only probe for the competency-runtime schema. Used to gate the role
 * readiness composition so a GET can NEVER trigger schema-creating DDL (the
 * shared Phase-2 engine ensures its schema unconditionally). Returns true ONLY
 * when EVERY runtime relation (table + index) already exists, so the transitive
 * ensure is a complete no-op (every IF NOT EXISTS finds its object). Uses
 * to_regclass so a missing relation degrades to `false` instead of throwing —
 * never DDLs.
 */
async function competencyRuntimeReady(pool: Pool): Promise<boolean> {
  const probe = await pool
    .query(
      `SELECT count(*)::int AS n
         FROM unnest($1::text[]) AS rel
        WHERE to_regclass('public.' || rel) IS NOT NULL`,
      [COMPETENCY_RUNTIME_RELATIONS as unknown as string[]],
    )
    .catch(() => ({ rows: [{ n: 0 }] }));
  return Number(probe.rows[0]?.n ?? 0) === COMPETENCY_RUNTIME_RELATIONS.length;
}

/** Fetch TYPE assignments for a set of competency ids. Read-only; degrades to an
 *  empty map (every competency → unclassified) when the table is absent/empty. */
async function loadTypeMap(
  pool: Pool,
  competencyIds: string[],
): Promise<Map<string, { type_key: GapTypeKey; confidence: string; provenance: string }>> {
  const out = new Map<string, { type_key: GapTypeKey; confidence: string; provenance: string }>();
  const ids = Array.from(new Set(competencyIds.filter((x) => x)));
  if (ids.length === 0) return out;
  // to_regclass probe so a missing table never throws and a GET never DDLs.
  const probe = await pool
    .query(`SELECT to_regclass('public.onto_competency_type_map') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return out;
  const r = await pool
    .query(
      `SELECT competency_id, type_key, confidence, provenance
         FROM onto_competency_type_map
        WHERE competency_id = ANY($1::varchar[])`,
      [ids],
    )
    .catch(() => ({ rows: [] as any[] }));
  const valid = new Set<GapTypeKey>(GAP_TYPE_ORDER);
  for (const row of r.rows as Array<Record<string, unknown>>) {
    const tk = String(row.type_key) as GapTypeKey;
    if (!valid.has(tk)) continue; // never coerce an unknown type into a bucket
    out.set(String(row.competency_id), {
      type_key: tk,
      confidence: String(row.confidence ?? ''),
      provenance: String(row.provenance ?? ''),
    });
  }
  return out;
}

function finalizeBucket(b: GapBucket): GapBucket {
  const deltas = b.items.map((i) => i.gap).filter((n) => Number.isFinite(n));
  b.gap_count = b.items.length;
  b.critical_count = b.items.filter(isCriticalGap).length;
  b.blocking_count = b.items.filter((i) => i.blocking).length;
  b.max_gap = deltas.length ? Math.max(...deltas) : null;
  b.mean_gap = deltas.length ? round1(deltas.reduce((a, c) => a + c, 0) / deltas.length) : null;
  b.measurable = b.items.length > 0;
  // Sort within a bucket: blocking/critical first, then largest gap, then id (stable).
  b.items.sort(
    (a, c) =>
      Number(isCriticalGap(c)) - Number(isCriticalGap(a)) ||
      c.gap - a.gap ||
      a.competency_id.localeCompare(c.competency_id),
  );
  return b;
}

// --- Future outlook (FRP/FRI forward signal — fabrication-guarded) -----------

function buildFutureOutlook(fri: FRIResult | null): FutureOutlook {
  const realCount = fri ? friRealSignalCount(fri.provenance ?? {}) : 0;
  const measurable = !!fri && realCount > 0;
  if (!measurable) {
    return {
      measurable: false,
      composite: null,
      band: null,
      axes: null,
      development_areas: [],
      real_signal_count: realCount,
      basis:
        'no real Future-Readiness signals (FRP profile/forecast absent); default composite suppressed, not surfaced',
    };
  }
  const axes: Record<string, number> = {
    skill_durability: fri!.skill_durability,
    adaptability: fri!.adaptability,
    market_alignment: fri!.market_alignment,
    learning_velocity: fri!.learning_velocity,
    role_resilience: fri!.role_resilience,
  };
  // Lower axis value = more future-readiness development needed.
  const development_areas = Object.entries(axes)
    .filter(([, v]) => Number.isFinite(v) && v < 50)
    .map(([axis, value]) => ({ axis, value: Math.round(value) }))
    .sort((a, b) => a.value - b.value);
  return {
    measurable: true,
    composite: Math.round(fri!.composite),
    band: fri!.band ?? null,
    axes,
    development_areas,
    real_signal_count: realCount,
    basis: `${realCount}/5 FRI axes backed by real data`,
  };
}

// ---------------------------------------------------------------------------
// Engine — compose role readiness + type classification for one subject.
// ---------------------------------------------------------------------------

export async function buildCareerGap(pool: Pool, subjectId: string): Promise<CareerGapEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // Compose each source ONCE; each guarded so one failure never sinks the envelope.
  //
  // GET-never-writes: computeRoleReadinessV2 transitively calls
  // ensureCompetencyRuntimeSchema (CREATE TABLE …) inside the shared Phase-2
  // engine. We probe for the competency-runtime core table FIRST so this read
  // path can NEVER create schema: absent => skip the call entirely and report
  // role gaps as honestly unmeasured (no DDL); present => the transitive ensure
  // is a no-op (IF NOT EXISTS finds the tables) so nothing is created/mutated.
  const runtimeReady = await competencyRuntimeReady(pool);
  let role: RoleReadinessV2 | null = null;
  if (!runtimeReady) {
    notes.push(
      'Career gaps not measurable — competency runtime schema is not initialized (read-only; no schema created).',
    );
  } else {
    role = await computeRoleReadinessV2(pool, sid).catch((e) => {
      notes.push(`Role readiness unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null as RoleReadinessV2 | null;
    });
  }
  const fri = await computeFutureReadinessIndex(sid, pool).catch(() => null as FRIResult | null);

  const future_outlook = buildFutureOutlook(fri);
  const buckets = emptyBuckets();
  const unclassified: GapItem[] = [];

  const measurable = role?.measurable === true;
  const targetCareer = {
    role_id: role?.role_id ?? null,
    role_title: role?.role_title ?? null,
    source: 'role_readiness_v2 (subject anchor role)',
  };

  if (!role) {
    notes.push('Career gaps unavailable — no role readiness (honest absence).');
  } else if (!measurable) {
    notes.push(
      role.role_id
        ? 'Career gaps not measurable — role linked but no scored competency profile.'
        : 'Career gaps not measurable — no anchor role linked for this subject.',
    );
  }

  // Map readiness gap areas → typed GapItems. role_gap.gap_areas are competencies
  // where required > actual; we re-shape (never recompute) and classify by TYPE.
  const rawGaps = measurable ? role!.role_gap.gap_areas ?? [] : [];
  const typeMap = await loadTypeMap(
    pool,
    rawGaps.map((g) => g.competency_id),
  );

  let classified = 0;
  for (const g of rawGaps) {
    const required = Number(g.required_level);
    const actual = g.actual_level == null ? null : Number(g.actual_level);
    const gapDelta = g.gap != null ? Math.max(0, Number(g.gap)) : Math.max(0, required - (actual ?? 0));
    const tm = typeMap.get(g.competency_id) ?? null;
    const item: GapItem = {
      competency_id: g.competency_id,
      competency_name: g.competency_name ?? null,
      type_key: tm ? tm.type_key : 'unclassified',
      required_level: required,
      actual_level: actual,
      gap: gapDelta,
      criticality: String(g.criticality ?? 'standard'),
      blocking: !!g.blocking,
      type_confidence: tm ? tm.confidence : null,
      type_provenance: tm ? tm.provenance : null,
    };
    if (tm) {
      classified += 1;
      buckets[tm.type_key].items.push(item);
    } else {
      unclassified.push(item);
    }
  }

  for (const t of GAP_TYPE_ORDER) finalizeBucket(buckets[t]);
  unclassified.sort(
    (a, c) =>
      Number(isCriticalGap(c)) - Number(isCriticalGap(a)) ||
      c.gap - a.gap ||
      a.competency_id.localeCompare(c.competency_id),
  );

  const totalGaps = rawGaps.length;
  const totalCritical = [
    ...GAP_TYPE_ORDER.flatMap((t) => buckets[t].items),
    ...unclassified,
  ].filter(isCriticalGap).length;
  const totalBlocking = rawGaps.filter((g) => !!g.blocking).length;
  const classifiedPct = totalGaps > 0 ? Math.round((classified / totalGaps) * 100) : null;

  // Most material gap = largest critical/blocking, else largest gap overall.
  const allItems = [...GAP_TYPE_ORDER.flatMap((t) => buckets[t].items), ...unclassified];
  const mostMaterial = allItems.length
    ? [...allItems].sort(
        (a, c) =>
          Number(isCriticalGap(c)) - Number(isCriticalGap(a)) ||
          c.gap - a.gap ||
          a.competency_id.localeCompare(c.competency_id),
      )[0]
    : null;

  if (totalGaps > 0 && classifiedPct === 0) {
    notes.push(
      'No competency TYPE classification available (onto_competency_type_map empty/absent) — all gaps reported as unclassified; classified-coverage is honestly 0%.',
    );
  }

  const confValue = role?.ei_profile_summary.confidence?.value ?? null;
  const axes: CoverageConfidence = {
    coverage: {
      measurable,
      classified_pct: classifiedPct,
      detail: measurable
        ? `${classified}/${totalGaps} gapped competencies classified into a competency TYPE`
        : 'no measurable role gap to classify',
    },
    confidence: {
      band: measurable ? (role?.ei_profile_summary.confidence?.band ?? 'None') : 'None',
      value: typeof confValue === 'number' ? confValue : null,
      basis: measurable
        ? 'inherited from role-readiness measurement (re-shaped, never recomputed)'
        : 'role gap not measurable',
      caps: measurable ? [] : ['not_measurable'],
    },
  };

  const source_versions: Record<string, string> = { career_gap: CAREER_GAP_VERSION };
  if (role) source_versions.role_readiness = role.version;
  if (fri) source_versions.future_readiness = 'frp';

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_GAP_VERSION,
    generated_at: new Date().toISOString(),
    measurable,
    target_career: targetCareer,
    required: { total_gaps: totalGaps, measured_against: 'role_readiness_v2.role_gap.gap_areas' },
    buckets,
    unclassified,
    summary: {
      total_gaps: totalGaps,
      total_critical: totalCritical,
      total_blocking: totalBlocking,
      classified_pct: classifiedPct,
      most_material: mostMaterial,
    },
    future_outlook,
    axes,
    language_policy: role?.language_policy ?? LANGUAGE_POLICY,
    source_versions,
    notes,
  };
}

// ---------------------------------------------------------------------------
// career_gap_prioritization — deterministic ordering of which gaps to address.
// Pure re-shape of the envelope; introduces NO new scores beyond an explicit,
// transparent priority rank derived from gap size + criticality.
// ---------------------------------------------------------------------------

export type PriorityBand = 'now' | 'next' | 'later';

export interface PrioritizedGap {
  rank: number;
  competency_id: string;
  competency_name: string | null;
  type_key: GapTypeKey | 'unclassified';
  type_label: string;
  gap: number;
  criticality: string;
  blocking: boolean;
  priority_score: number;
  priority_band: PriorityBand;
  rationale: string;
}

export interface CareerGapPrioritization {
  subject_id: string;
  version: string;
  measurable: boolean;
  items: PrioritizedGap[];
  bands: { now: number; next: number; later: number };
  notes: string[];
}

function typeLabel(t: GapTypeKey | 'unclassified'): string {
  return t === 'unclassified' ? 'Unclassified' : GAP_TYPE_LABELS[t];
}

export function prioritizeCareerGaps(env: CareerGapEnvelope): CareerGapPrioritization {
  const all: GapItem[] = [...GAP_TYPE_ORDER.flatMap((t) => env.buckets[t].items), ...env.unclassified];

  const scored = all.map((g) => {
    // Transparent weighting: criticality multiplies the gap size.
    const weight = g.blocking ? 3 : isCriticalGap(g) ? 2 : 1;
    const priority_score = round1(g.gap * weight);
    const band: PriorityBand = g.blocking || isCriticalGap(g) ? 'now' : g.gap >= 2 ? 'next' : 'later';
    const rationale = g.blocking
      ? 'blocking/critical gap — address first'
      : isCriticalGap(g)
        ? 'high-criticality gap'
        : g.gap >= 2
          ? 'sizeable gap on a standard requirement'
          : 'minor gap';
    return {
      competency_id: g.competency_id,
      competency_name: g.competency_name,
      type_key: g.type_key,
      type_label: typeLabel(g.type_key),
      gap: g.gap,
      criticality: g.criticality,
      blocking: g.blocking,
      priority_score,
      priority_band: band,
      rationale,
    };
  });

  scored.sort(
    (a, b) =>
      b.priority_score - a.priority_score ||
      Number(b.blocking) - Number(a.blocking) ||
      a.competency_id.localeCompare(b.competency_id),
  );

  const items: PrioritizedGap[] = scored.map((s, i) => ({ rank: i + 1, ...s }));
  const bands = {
    now: items.filter((i) => i.priority_band === 'now').length,
    next: items.filter((i) => i.priority_band === 'next').length,
    later: items.filter((i) => i.priority_band === 'later').length,
  };

  return {
    subject_id: env.subject_id,
    version: env.version,
    measurable: env.measurable,
    items,
    bands,
    notes: env.measurable
      ? ['Priority = gap size × criticality weight (blocking ×3, critical/high ×2, else ×1). Developmental ordering only.']
      : ['Not measurable — no role gap to prioritise.'],
  };
}

// ---------------------------------------------------------------------------
// career_gap_dashboard — UI-ready projection composed from the envelope (+ an
// optional prioritization). Pure; never re-queries, never recomputes.
// ---------------------------------------------------------------------------

export interface CareerGapDashboardCard {
  type_key: GapTypeKey;
  label: string;
  measurable: boolean;
  gap_count: number;
  critical_count: number;
  max_gap: number | null;
  mean_gap: number | null;
  top_items: GapItem[];
}

export interface CareerGapDashboard {
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  target_career: CareerGapEnvelope['target_career'];
  headline: {
    total_gaps: number;
    critical_gaps: number;
    blocking_gaps: number;
    classified_pct: number | null;
    most_material: GapItem | null;
  };
  categories: CareerGapDashboardCard[];
  unclassified_count: number;
  top_priorities: PrioritizedGap[];
  future_outlook: FutureOutlook;
  honesty: {
    coverage: CoverageConfidence['coverage'];
    confidence: CoverageConfidence['confidence'];
    notes: string[];
  };
  language_policy: typeof LANGUAGE_POLICY;
}

export function buildCareerGapDashboard(
  env: CareerGapEnvelope,
  prioritization?: CareerGapPrioritization,
): CareerGapDashboard {
  const prio = prioritization ?? prioritizeCareerGaps(env);
  const categories: CareerGapDashboardCard[] = GAP_TYPE_ORDER.map((t) => {
    const b = env.buckets[t];
    return {
      type_key: t,
      label: b.label,
      measurable: b.measurable,
      gap_count: b.gap_count,
      critical_count: b.critical_count,
      max_gap: b.max_gap,
      mean_gap: b.mean_gap,
      top_items: b.items.slice(0, 3),
    };
  });

  return {
    subject_id: env.subject_id,
    version: env.version,
    generated_at: env.generated_at,
    measurable: env.measurable,
    target_career: env.target_career,
    headline: {
      total_gaps: env.summary.total_gaps,
      critical_gaps: env.summary.total_critical,
      blocking_gaps: env.summary.total_blocking,
      classified_pct: env.summary.classified_pct,
      most_material: env.summary.most_material,
    },
    categories,
    unclassified_count: env.unclassified.length,
    top_priorities: prio.items.slice(0, 5),
    future_outlook: env.future_outlook,
    honesty: {
      coverage: env.axes.coverage,
      confidence: env.axes.confidence,
      notes: env.notes,
    },
    language_policy: env.language_policy,
  };
}

// ---------------------------------------------------------------------------
// Append-only history persistence (explicit POST path only — NEVER on a GET).
// The DDL here is reached ONLY behind the careerGap flag gate.
// ---------------------------------------------------------------------------

export async function ensureCareerGapHistorySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_gap_history (
      id                BIGSERIAL PRIMARY KEY,
      subject_id        TEXT NOT NULL,
      role_id           TEXT,
      role_title        TEXT,
      total_gaps        INTEGER NOT NULL DEFAULT 0,
      total_critical    INTEGER NOT NULL DEFAULT 0,
      total_blocking    INTEGER NOT NULL DEFAULT 0,
      classified_pct    NUMERIC,
      technical_gaps    INTEGER NOT NULL DEFAULT 0,
      behavioral_gaps   INTEGER NOT NULL DEFAULT 0,
      cognitive_gaps    INTEGER NOT NULL DEFAULT 0,
      functional_gaps   INTEGER NOT NULL DEFAULT 0,
      future_skill_gaps INTEGER NOT NULL DEFAULT 0,
      unclassified_gaps INTEGER NOT NULL DEFAULT 0,
      measurable        BOOLEAN NOT NULL DEFAULT FALSE,
      snapshot          JSONB NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_gap_history_subject
       ON career_gap_history (subject_id, created_at DESC)`,
  );
}

export interface CareerGapHistoryRow {
  id: number;
  subject_id: string;
  role_id: string | null;
  role_title: string | null;
  total_gaps: number;
  total_critical: number;
  total_blocking: number;
  classified_pct: number | null;
  technical_gaps: number;
  behavioral_gaps: number;
  cognitive_gaps: number;
  functional_gaps: number;
  future_skill_gaps: number;
  unclassified_gaps: number;
  measurable: boolean;
  created_at: string;
}

/** Append-only — NEVER updates an existing row. */
export async function persistCareerGapSnapshot(
  pool: Pool,
  env: CareerGapEnvelope,
): Promise<CareerGapHistoryRow> {
  await ensureCareerGapHistorySchema(pool);
  const r = await pool.query(
    `INSERT INTO career_gap_history
       (subject_id, role_id, role_title, total_gaps, total_critical, total_blocking,
        classified_pct, technical_gaps, behavioral_gaps, cognitive_gaps,
        functional_gaps, future_skill_gaps, unclassified_gaps, measurable, snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, subject_id, role_id, role_title, total_gaps, total_critical,
               total_blocking, classified_pct, technical_gaps, behavioral_gaps,
               cognitive_gaps, functional_gaps, future_skill_gaps, unclassified_gaps,
               measurable, created_at`,
    [
      env.subject_id,
      env.target_career.role_id,
      env.target_career.role_title,
      env.summary.total_gaps,
      env.summary.total_critical,
      env.summary.total_blocking,
      env.summary.classified_pct,
      env.buckets.technical.gap_count,
      env.buckets.behavioral.gap_count,
      env.buckets.cognitive.gap_count,
      env.buckets.functional.gap_count,
      env.buckets.future_skills.gap_count,
      env.unclassified.length,
      env.measurable,
      JSON.stringify(env),
    ],
  );
  return r.rows[0] as CareerGapHistoryRow;
}

/** Read-only history. Uses a to_regclass probe so a GET NEVER triggers DDL —
 *  if no snapshot has ever been taken the table is absent => honest empty. */
export async function listCareerGapHistory(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ exists: boolean; count: number; items: CareerGapHistoryRow[] }> {
  const sid = String(subjectId ?? '').trim();
  const probe = await pool
    .query(`SELECT to_regclass('public.career_gap_history') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { exists: false, count: 0, items: [] };
  const r = await pool
    .query(
      `SELECT id, subject_id, role_id, role_title, total_gaps, total_critical,
              total_blocking, classified_pct, technical_gaps, behavioral_gaps,
              cognitive_gaps, functional_gaps, future_skill_gaps, unclassified_gaps,
              measurable, created_at
       FROM career_gap_history
       WHERE subject_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sid, Math.max(1, Math.min(200, limit))],
    )
    .catch(() => ({ rows: [] as CareerGapHistoryRow[] }));
  return { exists: true, count: r.rows.length, items: r.rows as CareerGapHistoryRow[] };
}
