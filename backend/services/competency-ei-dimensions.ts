/**
 * Phase 3.2 — Competency → Employability-Intelligence (EI) Dimension Mapping
 * ==========================================================================
 * STRICTLY ADDITIVE · READ-ONLY COMPOSITION · NEVER-THROWS · NEVER FABRICATES.
 *
 * Turns the Phase-2 competency-runtime scores into employability "readiness"
 * dimensions by COMPOSING (never recomputing) the already-computed competency /
 * domain-proxy scores produced by getProfile().
 *
 *   Communication      → Communication Readiness
 *   Collaboration      → Workplace Readiness
 *   Critical Thinking  → Problem-Solving Readiness
 *   Leadership         → Leadership Readiness
 *   Learning Agility   → Future Readiness
 *
 * Three persisted config layers (canonical migration 20260619_competency_ei_mapping.sql):
 *   1. dimension_weight_rules       — EI-dimension registry + roll-up weights.
 *   2. competency_ei_mapping        — competency → dimension edges + contribution weight.
 *   3. dimension_calculation_rules  — per-dimension aggregation + coverage/confidence rules.
 *
 * Honesty canon (replit.md + .agents/memory):
 *  - Compose, never recompute. The per-competency score is the Phase-2 value as-is.
 *  - A dimension score is a weighted mean over its mapped competencies that were
 *    actually MEASURED. Unmeasured competencies are NOT imputed.
 *  - Coverage (how many mapped competencies were measured) and Confidence (how
 *    trustworthy the measurement is) are two SEPARATE axes. Domain-proxy
 *    measurement CAPS confidence; it never inflates the score.
 *  - A dimension below its coverage / min-component gate reports measurable:false
 *    with a null score — never a fabricated number.
 *  - Developmental-language only — never a hiring / promotion / suitability claim.
 *
 * Flag discipline: every DDL/seed call is reached ONLY behind the `competencyEi`
 * flag gate (see routes/competency-ei.ts). GET read paths use a to_regclass probe
 * and DEGRADE honestly when the config is not provisioned — they never run DDL.
 */

import type { Pool } from 'pg';
import { getProfile, type ProfileView } from './competency-runtime.js';
import {
  DEFAULT_BAND_THRESHOLDS,
  LANGUAGE_POLICY,
  type DimensionComponent,
  type DimensionConfidence,
  type DimensionScoringRule,
  emptyConfidence,
} from './competency-ei-scoring-shared.js';
import { scoreDimension, type ScoredDimension } from './dimension-scoring-engine.js';
import { calculateEi } from './ei-calculation-engine.js';

// Re-export shared types for backward compatibility with prior importers.
export type { DimensionComponent, DimensionConfidence } from './competency-ei-scoring-shared.js';

export const COMPETENCY_EI_DIMENSIONS_VERSION = 'phase-3.2';
export const DIMENSION_WEIGHTS_VERSION = 'cei-dim-w1';
export const DIMENSION_CALC_VERSION = 'cei-dim-calc-v1';

export const DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP = 60;

// ----------------------------------------------------------------------------
// Default seed — EI dimension registry
// ----------------------------------------------------------------------------

interface SeedDimension {
  ei_dimension_id: string;
  dimension_name: string;
  description: string;
  rollup_weight: number;
  min_coverage_pct: number;
  display_order: number;
}

export const DEFAULT_DIMENSIONS: SeedDimension[] = [
  {
    ei_dimension_id: 'dim_communication_readiness',
    dimension_name: 'Communication Readiness',
    description: 'Clarity, listening, persuasion and presentation — the ability to convey and exchange information effectively at work.',
    rollup_weight: 1.0,
    min_coverage_pct: 0,
    display_order: 1,
  },
  {
    ei_dimension_id: 'dim_workplace_readiness',
    dimension_name: 'Workplace Readiness',
    description: 'Collaboration, accountability, reliability and professional conduct — readiness to operate dependably within a team and organisation.',
    rollup_weight: 1.0,
    min_coverage_pct: 0,
    display_order: 2,
  },
  {
    ei_dimension_id: 'dim_problem_solving_readiness',
    dimension_name: 'Problem-Solving Readiness',
    description: 'Critical and analytical thinking, judgment and creativity — readiness to diagnose problems and reach sound decisions.',
    rollup_weight: 1.0,
    min_coverage_pct: 0,
    display_order: 3,
  },
  {
    ei_dimension_id: 'dim_leadership_readiness',
    dimension_name: 'Leadership Readiness',
    description: 'Direction-setting, coaching, delegation and influence — readiness to guide, develop and align others.',
    rollup_weight: 1.0,
    min_coverage_pct: 0,
    display_order: 4,
  },
  {
    ei_dimension_id: 'dim_future_readiness',
    dimension_name: 'Future Readiness',
    description: 'Learning agility, adaptability, curiosity and resilience — readiness to keep growing as roles and demands change.',
    rollup_weight: 1.0,
    min_coverage_pct: 0,
    display_order: 5,
  },
];

// ----------------------------------------------------------------------------
// Default seed — competency → dimension edges (real onto_competencies ids)
// primary anchors carry weight 2.0; supporting competencies carry 1.0.
// Only competencies that EXIST in onto_competencies are inserted (honest).
// ----------------------------------------------------------------------------

interface SeedMapping {
  competency_id: string;
  ei_dimension_id: string;
  contribution_weight: number;
}

const W_PRIMARY = 2.0;
const W_SUPPORT = 1.0;

function map(dim: string, primaries: string[], supports: string[]): SeedMapping[] {
  return [
    ...primaries.map((c) => ({ competency_id: c, ei_dimension_id: dim, contribution_weight: W_PRIMARY })),
    ...supports.map((c) => ({ competency_id: c, ei_dimension_id: dim, contribution_weight: W_SUPPORT })),
  ];
}

export const DEFAULT_MAPPINGS: SeedMapping[] = [
  ...map(
    'dim_communication_readiness',
    ['comp_communication'],
    [
      'comp_active_listening',
      'comp_listening_skills',
      'comp_written_communication',
      'comp_persuasion',
      'comp_persuasive_communication',
      'comp_presentation_skills',
      'comp_public_speaking',
      'comp_open_communication',
      'comp_assertive_communication',
      'comp_influencing_others',
      'comp_constructive_feedback',
    ],
  ),
  ...map(
    'dim_workplace_readiness',
    ['comp_collaboration', 'comp_teamwork'],
    [
      'comp_accountability',
      'comp_workplace_accountability',
      'comp_reliability',
      'comp_dependability',
      'comp_professional_demeanor',
      'comp_work_ethic',
      'comp_conscientiousness',
      'comp_ownership',
      'comp_organizational_commitment',
      'comp_time_management',
      'comp_collaboration_across_teams',
      'comp_contribution_to_team_success',
    ],
  ),
  ...map(
    'dim_problem_solving_readiness',
    ['comp_critical_thinking', 'comp_analytical_thinking'],
    [
      'comp_problem_solving',
      'comp_decision_making',
      'comp_creativity',
      'comp_conceptual_thinking',
      'comp_data_driven_decision_making',
      'comp_systems_thinking',
      'comp_root_cause_analysis',
      'comp_judgment',
      'comp_structured_thinking',
      'comp_resourcefulness',
      'comp_solution_orientation',
    ],
  ),
  ...map(
    'dim_leadership_readiness',
    ['comp_leadership'],
    [
      'comp_team_leadership',
      'comp_coaching',
      'comp_mentorship',
      'comp_delegation',
      'comp_talent_development',
      'comp_talent_management',
      'comp_stakeholder_mgmt',
      'comp_impact_and_influence',
      'comp_team_building',
      'comp_developing_people',
      'comp_leading_by_example',
      'comp_strategic_thinking',
      'comp_vision',
    ],
  ),
  ...map(
    'dim_future_readiness',
    ['comp_learning_agility', 'comp_adaptability'],
    [
      'comp_continuous_learning',
      'comp_curiosity',
      'comp_growth_mindset',
      'comp_capacity_to_learn',
      'comp_self_directed_learning',
      'comp_resilience',
      'comp_ambiguity_tolerance',
      'comp_flexibility',
      'comp_open_mindedness',
      'comp_learning_orientation',
      'comp_technology_adoption',
      'comp_change_management',
    ],
  ),
];

// ----------------------------------------------------------------------------
// Schema (lazy, idempotent) — mirrors the canonical migration
// ----------------------------------------------------------------------------

let schemaReady: Promise<void> | null = null;

export async function ensureEiDimensionSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS dimension_weight_rules (
          ei_dimension_id   VARCHAR(80)  PRIMARY KEY,
          dimension_name    VARCHAR(160) NOT NULL,
          description       TEXT         NOT NULL DEFAULT '',
          rollup_weight     NUMERIC(6,2) NOT NULL DEFAULT 1.0,
          min_coverage_pct  NUMERIC(6,2) NOT NULL DEFAULT 0,
          display_order     INTEGER      NOT NULL DEFAULT 0,
          active            BOOLEAN      NOT NULL DEFAULT true,
          version           VARCHAR(40)  NOT NULL DEFAULT 'cei-dim-w1',
          created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_dwr_rollup   CHECK (rollup_weight >= 0),
          CONSTRAINT chk_dwr_coverage CHECK (min_coverage_pct >= 0 AND min_coverage_pct <= 100)
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS competency_ei_mapping (
          id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
          competency_id       VARCHAR(120) NOT NULL,
          ei_dimension_id     VARCHAR(80)  NOT NULL,
          contribution_weight NUMERIC(6,2) NOT NULL DEFAULT 1.0,
          rationale           TEXT         NOT NULL DEFAULT '',
          source              VARCHAR(40)  NOT NULL DEFAULT 'seed',
          active              BOOLEAN      NOT NULL DEFAULT true,
          created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_cem_weight CHECK (contribution_weight >= 0),
          CONSTRAINT uq_cem UNIQUE (competency_id, ei_dimension_id)
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cem_dimension  ON competency_ei_mapping (ei_dimension_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cem_competency ON competency_ei_mapping (competency_id);`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS dimension_calculation_rules (
          ei_dimension_id             VARCHAR(80) PRIMARY KEY,
          aggregation_method          VARCHAR(40) NOT NULL DEFAULT 'weighted_mean',
          score_source                VARCHAR(40) NOT NULL DEFAULT 'domain_proxy',
          min_components              INTEGER      NOT NULL DEFAULT 1,
          domain_proxy_confidence_cap NUMERIC(6,2) NOT NULL DEFAULT 60,
          band_thresholds             JSONB        NOT NULL DEFAULT '{"excellent":80,"strong":65,"developing":50,"emerging":35}'::jsonb,
          normalization               VARCHAR(40)  NOT NULL DEFAULT 'none',
          version                     VARCHAR(40)  NOT NULL DEFAULT 'cei-dim-calc-v1',
          created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_dcr_min CHECK (min_components >= 1),
          CONSTRAINT chk_dcr_cap CHECK (domain_proxy_confidence_cap >= 0 AND domain_proxy_confidence_cap <= 100)
        );
      `);
    })().catch((err) => {
      schemaReady = null; // allow retry on a later request
      throw err;
    });
  }
  return schemaReady;
}

async function tablesExist(pool: Pool): Promise<boolean> {
  const r = await pool.query(`
    SELECT to_regclass('public.dimension_weight_rules')      AS w,
           to_regclass('public.competency_ei_mapping')       AS m,
           to_regclass('public.dimension_calculation_rules') AS c
  `);
  const row = r.rows[0] ?? {};
  return row.w != null && row.m != null && row.c != null;
}

// ----------------------------------------------------------------------------
// Seed (idempotent). Only inserts mappings whose competency EXISTS (no fabrication).
// ----------------------------------------------------------------------------

export interface SeedResult {
  dimensions_upserted: number;
  calc_rules_upserted: number;
  mappings_inserted: number;
  mappings_skipped_missing_competency: number;
}

export async function seedEiDimensionDefaults(pool: Pool): Promise<SeedResult> {
  await ensureEiDimensionSchema(pool);

  let dimensions = 0;
  for (const d of DEFAULT_DIMENSIONS) {
    await pool.query(
      `INSERT INTO dimension_weight_rules
         (ei_dimension_id, dimension_name, description, rollup_weight, min_coverage_pct, display_order, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ei_dimension_id) DO UPDATE SET
         dimension_name = EXCLUDED.dimension_name,
         description    = EXCLUDED.description,
         display_order  = EXCLUDED.display_order,
         updated_at     = now()`,
      [d.ei_dimension_id, d.dimension_name, d.description, d.rollup_weight, d.min_coverage_pct, d.display_order, DIMENSION_WEIGHTS_VERSION],
    );
    dimensions += 1;
  }

  let calc = 0;
  for (const d of DEFAULT_DIMENSIONS) {
    await pool.query(
      `INSERT INTO dimension_calculation_rules
         (ei_dimension_id, aggregation_method, score_source, min_components, domain_proxy_confidence_cap, version)
       VALUES ($1,'weighted_mean','domain_proxy',1,$2,$3)
       ON CONFLICT (ei_dimension_id) DO UPDATE SET
         aggregation_method = EXCLUDED.aggregation_method,
         updated_at         = now()`,
      [d.ei_dimension_id, DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP, DIMENSION_CALC_VERSION],
    );
    calc += 1;
  }

  let inserted = 0;
  let skipped = 0;
  for (const m of DEFAULT_MAPPINGS) {
    // INSERT ... SELECT guarantees the competency really exists in the catalogue.
    const r = await pool.query(
      `INSERT INTO competency_ei_mapping (competency_id, ei_dimension_id, contribution_weight, source)
       SELECT $1::text, $2::text, $3::numeric, 'seed'
       WHERE EXISTS (SELECT 1 FROM onto_competencies WHERE id = $1::text AND deprecated = false)
       ON CONFLICT (competency_id, ei_dimension_id) DO NOTHING`,
      [m.competency_id, m.ei_dimension_id, m.contribution_weight],
    );
    if ((r.rowCount ?? 0) > 0) inserted += 1;
    else {
      const exists = await pool.query(
        `SELECT 1 FROM competency_ei_mapping WHERE competency_id = $1 AND ei_dimension_id = $2`,
        [m.competency_id, m.ei_dimension_id],
      );
      if ((exists.rowCount ?? 0) === 0) skipped += 1; // not present AND not inserted => competency missing
    }
  }

  return {
    dimensions_upserted: dimensions,
    calc_rules_upserted: calc,
    mappings_inserted: inserted,
    mappings_skipped_missing_competency: skipped,
  };
}

// ----------------------------------------------------------------------------
// Config read (read-only; degrades when not provisioned)
// ----------------------------------------------------------------------------

export interface DimensionConfigRow {
  ei_dimension_id: string;
  dimension_name: string;
  description: string;
  rollup_weight: number;
  min_coverage_pct: number;
  display_order: number;
  active: boolean;
  aggregation_method: string;
  score_source: string;
  min_components: number;
  domain_proxy_confidence_cap: number;
  band_thresholds: Record<string, number>;
  mapped_competencies: number;
}

export interface DimensionConfig {
  provisioned: boolean;
  dimensions: DimensionConfigRow[];
  total_mappings: number;
}

export async function getDimensionConfig(pool: Pool): Promise<DimensionConfig> {
  if (!(await tablesExist(pool))) return { provisioned: false, dimensions: [], total_mappings: 0 };

  const rows = await pool.query(`
    SELECT w.ei_dimension_id, w.dimension_name, w.description, w.rollup_weight, w.min_coverage_pct,
           w.display_order, w.active,
           COALESCE(c.aggregation_method, 'weighted_mean')         AS aggregation_method,
           COALESCE(c.score_source, 'domain_proxy')                AS score_source,
           COALESCE(c.min_components, 1)                           AS min_components,
           COALESCE(c.domain_proxy_confidence_cap, 60)             AS domain_proxy_confidence_cap,
           COALESCE(c.band_thresholds, '{"excellent":80,"strong":65,"developing":50,"emerging":35}'::jsonb) AS band_thresholds,
           (SELECT COUNT(*)::int FROM competency_ei_mapping m
              WHERE m.ei_dimension_id = w.ei_dimension_id AND m.active) AS mapped_competencies
      FROM dimension_weight_rules w
      LEFT JOIN dimension_calculation_rules c ON c.ei_dimension_id = w.ei_dimension_id
     ORDER BY w.display_order, w.ei_dimension_id
  `);

  const total = await pool.query(`SELECT COUNT(*)::int AS n FROM competency_ei_mapping WHERE active`);

  return {
    provisioned: true,
    total_mappings: Number(total.rows[0]?.n ?? 0),
    dimensions: rows.rows.map((r) => ({
      ei_dimension_id: String(r.ei_dimension_id),
      dimension_name: String(r.dimension_name),
      description: String(r.description ?? ''),
      rollup_weight: Number(r.rollup_weight),
      min_coverage_pct: Number(r.min_coverage_pct),
      display_order: Number(r.display_order),
      active: Boolean(r.active),
      aggregation_method: String(r.aggregation_method),
      score_source: String(r.score_source),
      min_components: Number(r.min_components),
      domain_proxy_confidence_cap: Number(r.domain_proxy_confidence_cap),
      band_thresholds: r.band_thresholds ?? {},
      mapped_competencies: Number(r.mapped_competencies ?? 0),
    })),
  };
}

// ----------------------------------------------------------------------------
// Compute per-subject employability dimensions (read-only, never throws)
// ----------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface EmployabilityDimension {
  ei_dimension_id: string;
  dimension_name: string;
  description: string;
  measurable: boolean;
  score: number | null;
  band: string | null;
  rollup_weight: number;
  components_total: number;
  components_measured: number;
  coverage_pct: number;
  confidence: DimensionConfidence;
  components: DimensionComponent[];
  reason?: string;
}

export interface EmployabilityDimensionsResult {
  ok: boolean;
  subject_id: string;
  role_id: string | null;
  ei_version: string;
  weights_version: string;
  provisioned: boolean;
  measurable: boolean;
  measurement: string;
  overall: {
    measurable: boolean;
    index_score: number | null;
    band: string | null;
    dimensions_total: number;
    dimensions_measurable: number;
    coverage_pct: number;
    confidence: DimensionConfidence;
  };
  dimensions: EmployabilityDimension[];
  language_policy: {
    intent: string;
    allowed_terms: string[];
    disallowed_terms: string[];
    disclaimer: string;
  };
  notes: string[];
}

/**
 * Loaded, ready-to-score inputs for one subject. SHARED by the 3.2 dimensions
 * endpoint and the 3.3 employability-scoring engine so both consume identical
 * components, rules and measurement basis (single source of truth). Never throws.
 */
export interface ScoringInputs {
  provisioned: boolean;
  profile_measured: boolean;
  measurement: string;
  role_id: string | null;
  rules: DimensionScoringRule[];
  components_by_dim: Map<string, DimensionComponent[]>;
  domain_scores: { onto_domain: string; scaled_score: number }[];
  notes: string[];
}

export async function loadScoringInputs(pool: Pool, subjectId: string): Promise<ScoringInputs> {
  const notes: string[] = [];

  const config = await getDimensionConfig(pool).catch((err) => {
    notes.push(`config_read_error: ${err?.message ?? err}`);
    return { provisioned: false, dimensions: [], total_mappings: 0 } as DimensionConfig;
  });

  let profile: ProfileView | null = null;
  try {
    profile = await getProfile(pool, subjectId);
  } catch (err: any) {
    notes.push(`profile_error: ${err?.message ?? err}`);
  }

  const measurement = profile?.measurement ?? 'domain_proxy';
  const roleId = profile?.role_id ?? null;
  const profileMeasured = profile?.measured === true;

  const rules: DimensionScoringRule[] = config.dimensions
    .filter((d) => d.active)
    .map((d) => ({
      ei_dimension_id: d.ei_dimension_id,
      dimension_name: d.dimension_name,
      description: d.description,
      rollup_weight: d.rollup_weight,
      min_components: d.min_components,
      min_coverage_pct: d.min_coverage_pct,
      domain_proxy_confidence_cap: d.domain_proxy_confidence_cap,
      band_thresholds: d.band_thresholds ?? DEFAULT_BAND_THRESHOLDS,
      aggregation_method: d.aggregation_method,
      score_source: d.score_source,
    }));

  // Domain-proxy score lookup keyed by onto_domain.
  const domainScore = new Map<string, number>();
  const domainScores: { onto_domain: string; scaled_score: number }[] = [];
  for (const d of profile?.domain_scores ?? []) {
    if (d?.onto_domain != null && d?.scaled_score != null) {
      domainScore.set(String(d.onto_domain), Number(d.scaled_score));
      domainScores.push({ onto_domain: String(d.onto_domain), scaled_score: round1(Number(d.scaled_score)) });
    }
  }

  const componentsByDim = new Map<string, DimensionComponent[]>();
  if (config.provisioned && profileMeasured) {
    // Load the active edges + each competency's parent domain in one query.
    try {
      const edges = await pool.query(
        `SELECT m.ei_dimension_id, m.competency_id, m.contribution_weight,
                oc.canonical_name, oc.domain_id
           FROM competency_ei_mapping m
           JOIN onto_competencies oc ON oc.id = m.competency_id AND oc.deprecated = false
          WHERE m.active
          ORDER BY m.ei_dimension_id, m.contribution_weight DESC, oc.canonical_name`,
        [],
      );
      for (const e of edges.rows) {
        const dom = e.domain_id != null ? String(e.domain_id) : null;
        const proxy = dom != null && domainScore.has(dom) ? domainScore.get(dom)! : null;
        const comp: DimensionComponent = {
          competency_id: String(e.competency_id),
          competency_name: e.canonical_name ?? null,
          onto_domain: dom,
          contribution_weight: Number(e.contribution_weight),
          proxy_score: proxy != null ? round1(proxy) : null,
          measured: proxy != null,
        };
        const arr = componentsByDim.get(String(e.ei_dimension_id)) ?? [];
        arr.push(comp);
        componentsByDim.set(String(e.ei_dimension_id), arr);
      }
    } catch (err: any) {
      notes.push(`edges_read_error: ${err?.message ?? err}`);
    }
  }

  return {
    provisioned: config.provisioned,
    profile_measured: profileMeasured,
    measurement,
    role_id: roleId,
    rules,
    components_by_dim: componentsByDim,
    domain_scores: domainScores,
    notes,
  };
}

export async function computeEmployabilityDimensions(
  pool: Pool,
  subjectId: string,
): Promise<EmployabilityDimensionsResult> {
  const inp = await loadScoringInputs(pool, subjectId);
  const notes = [...inp.notes];

  if (!inp.provisioned) {
    notes.push('employability-dimension config not provisioned — POST /api/competency-ei/dimensions/sync to seed defaults');
    return notMeasurableResult(subjectId, inp.role_id, inp.measurement, false, notes);
  }
  if (!inp.profile_measured) {
    notes.push('subject has no measured competency profile — employability dimensions are not measurable');
    return notMeasurableResult(subjectId, inp.role_id, inp.measurement, true, notes);
  }
  if (notes.some((n) => n.startsWith('edges_read_error'))) {
    return notMeasurableResult(subjectId, inp.role_id, inp.measurement, true, notes);
  }

  // Delegate to the SAME engines used by the Phase 3.3 scoring engine, then
  // project the traced result onto the legacy dimensions shape (no trace).
  const scored: ScoredDimension[] = inp.rules.map((rule) =>
    scoreDimension(rule, inp.components_by_dim.get(rule.ei_dimension_id) ?? [], inp.measurement),
  );
  const ei = calculateEi(scored, {
    measurement: inp.measurement,
    confidence_cap: DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP,
    band_thresholds: DEFAULT_BAND_THRESHOLDS,
  });

  const dimensions: EmployabilityDimension[] = scored.map(({ trace: _trace, ...rest }) => rest);

  return {
    ok: true,
    subject_id: subjectId,
    role_id: inp.role_id,
    ei_version: COMPETENCY_EI_DIMENSIONS_VERSION,
    weights_version: DIMENSION_WEIGHTS_VERSION,
    provisioned: true,
    measurable: ei.measurable,
    measurement: inp.measurement,
    overall: {
      measurable: ei.measurable,
      index_score: ei.ei_score,
      band: ei.band,
      dimensions_total: ei.dimensions_total,
      dimensions_measurable: ei.dimensions_measurable,
      coverage_pct: ei.coverage_pct,
      confidence: ei.confidence,
    },
    dimensions,
    language_policy: LANGUAGE_POLICY,
    notes,
  };
}

function notMeasurableResult(
  subjectId: string,
  roleId: string | null,
  measurement: string,
  provisioned: boolean,
  notes: string[],
): EmployabilityDimensionsResult {
  return {
    ok: true,
    subject_id: subjectId,
    role_id: roleId,
    ei_version: COMPETENCY_EI_DIMENSIONS_VERSION,
    weights_version: DIMENSION_WEIGHTS_VERSION,
    provisioned,
    measurable: false,
    measurement,
    overall: {
      measurable: false,
      index_score: null,
      band: null,
      dimensions_total: 0,
      dimensions_measurable: 0,
      coverage_pct: 0,
      confidence: emptyConfidence(measurement, provisioned ? 'no measured competency profile for this subject' : 'config not provisioned'),
    },
    dimensions: [],
    language_policy: LANGUAGE_POLICY,
    notes,
  };
}
