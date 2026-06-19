/**
 * Phase 3.3 — EMPLOYABILITY SCORING ENGINE
 *                                   (deliverable: employability_scoring_engine)
 * ============================================================================
 * Orchestrates the explicit, end-to-end employability scoring CHAIN for one
 * subject and emits a single TRANSPARENT · EXPLAINABLE · TRACEABLE · AUDITABLE
 * artifact:
 *
 *     Tier 1  Competency Scores   (per-competency domain-proxy inputs)
 *        │        ↓ feeds
 *     Tier 2  Dimension Scores    (dimension_scoring_engine, weighted mean)
 *        │        ↓ rolls up
 *     Tier 3  EI Score            (ei_calculation_engine, weighted roll-up)
 *
 * COMPOSE, NEVER RECOMPUTE: this engine reuses loadScoringInputs() and the
 * exact scoreDimension()/calculateEi() functions that back the Phase 3.2
 * dimensions endpoint, so the scoring artifact and the dimensions endpoint can
 * never disagree.
 *
 * Read-only & never-throws. The one WRITE path is persistScoringRun() (the
 * audit ledger), guarded by ensureScoringRunSchema() and only reached from an
 * explicit POST .../run when the flag is ON. GET read paths use a to_regclass
 * probe and DEGRADE honestly — they never run DDL.
 *
 * Honesty canon: Coverage (how much measured) and Confidence (how trustworthy)
 * are SEPARATE axes; an unmeasured competency/dimension is NEVER imputed — it
 * is reported measurable:false with a reason and contributes nothing.
 */

import type { Pool } from 'pg';
import {
  COMPETENCY_EI_DIMENSIONS_VERSION,
  DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP,
  DIMENSION_WEIGHTS_VERSION,
  loadScoringInputs,
} from './competency-ei-dimensions.js';
import {
  DEFAULT_BAND_THRESHOLDS,
  LANGUAGE_POLICY,
  type CalcStep,
  type DimensionConfidence,
  round1,
} from './competency-ei-scoring-shared.js';
import { scoreDimension, type ScoredDimension } from './dimension-scoring-engine.js';
import { calculateEi, type EiCalculation } from './ei-calculation-engine.js';

export const SCORING_ENGINE_VERSION = 'phase-3.3';

// ----------------------------------------------------------------------------
// Tier 1 — competency-level scores (the inputs feeding the dimensions)
// ----------------------------------------------------------------------------

export interface CompetencyScoreEntry {
  competency_id: string;
  competency_name: string | null;
  onto_domain: string | null;
  proxy_score: number | null;
  measured: boolean;
  feeds_dimensions: { ei_dimension_id: string; contribution_weight: number }[];
}

export interface ScoringChainTrace {
  pipeline: string;
  measurement: string;
  steps: CalcStep[];
}

export interface EmployabilityScore {
  ok: boolean;
  subject_id: string;
  role_id: string | null;
  scoring_version: string;
  ei_version: string;
  weights_version: string;
  provisioned: boolean;
  measurable: boolean;
  measurement: string;
  // Tier 1 → Tier 2 → Tier 3
  competency_scores: {
    total: number;
    measured: number;
    coverage_pct: number;
    entries: CompetencyScoreEntry[];
  };
  dimension_scores: ScoredDimension[];
  ei: EiCalculation;
  // Top-line convenience mirror of the EI tier
  summary: {
    measurable: boolean;
    ei_score: number | null;
    ei_band: string | null;
    coverage_pct: number;
    confidence: DimensionConfidence;
    dimensions_total: number;
    dimensions_measurable: number;
  };
  chain_trace: ScoringChainTrace;
  language_policy: typeof LANGUAGE_POLICY;
  generated_at: string;
  notes: string[];
}

function emptyArtifact(
  subjectId: string,
  roleId: string | null,
  measurement: string,
  provisioned: boolean,
  notes: string[],
): EmployabilityScore {
  const ei = calculateEi([], {
    measurement,
    confidence_cap: DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP,
    band_thresholds: DEFAULT_BAND_THRESHOLDS,
  });
  return {
    ok: true,
    subject_id: subjectId,
    role_id: roleId,
    scoring_version: SCORING_ENGINE_VERSION,
    ei_version: COMPETENCY_EI_DIMENSIONS_VERSION,
    weights_version: DIMENSION_WEIGHTS_VERSION,
    provisioned,
    measurable: false,
    measurement,
    competency_scores: { total: 0, measured: 0, coverage_pct: 0, entries: [] },
    dimension_scores: [],
    ei,
    summary: {
      measurable: false,
      ei_score: null,
      ei_band: null,
      coverage_pct: 0,
      confidence: ei.confidence,
      dimensions_total: 0,
      dimensions_measurable: 0,
    },
    chain_trace: {
      pipeline: 'competency_scores → dimension_scores → ei_score',
      measurement,
      steps: [
        {
          n: 1,
          label: 'precondition',
          value: provisioned ? 'no measured competency profile' : 'config not provisioned',
          note: 'chain not measurable — no scores produced (never imputed)',
        },
      ],
    },
    language_policy: LANGUAGE_POLICY,
    generated_at: new Date().toISOString(),
    notes,
  };
}

/**
 * Compute the full employability scoring chain for one subject. Read-only;
 * never throws (degrades to an honest non-measurable artifact).
 */
export async function computeEmployabilityScore(
  pool: Pool,
  subjectId: string,
): Promise<EmployabilityScore> {
  const inp = await loadScoringInputs(pool, subjectId);
  const notes = [...inp.notes];

  if (!inp.provisioned) {
    notes.push('employability-dimension config not provisioned — POST /api/competency-ei/dimensions/sync to seed defaults');
    return emptyArtifact(subjectId, inp.role_id, inp.measurement, false, notes);
  }
  if (!inp.profile_measured) {
    notes.push('subject has no measured competency profile — employability scoring is not measurable');
    return emptyArtifact(subjectId, inp.role_id, inp.measurement, true, notes);
  }
  if (notes.some((n) => n.startsWith('edges_read_error'))) {
    return emptyArtifact(subjectId, inp.role_id, inp.measurement, true, notes);
  }

  // --- Tier 1: competency-level scores (unique competencies + where they feed)
  const compMap = new Map<string, CompetencyScoreEntry>();
  for (const rule of inp.rules) {
    for (const c of inp.components_by_dim.get(rule.ei_dimension_id) ?? []) {
      let entry = compMap.get(c.competency_id);
      if (!entry) {
        entry = {
          competency_id: c.competency_id,
          competency_name: c.competency_name,
          onto_domain: c.onto_domain,
          proxy_score: c.proxy_score,
          measured: c.measured,
          feeds_dimensions: [],
        };
        compMap.set(c.competency_id, entry);
      }
      entry.feeds_dimensions.push({
        ei_dimension_id: rule.ei_dimension_id,
        contribution_weight: c.contribution_weight,
      });
    }
  }
  const compEntries = [...compMap.values()].sort((a, b) => a.competency_id.localeCompare(b.competency_id));
  const compMeasured = compEntries.filter((c) => c.measured).length;
  const compCoverage = compEntries.length > 0 ? round1((compMeasured / compEntries.length) * 100) : 0;

  // --- Tier 2: dimension scores (same engine as the 3.2 dimensions endpoint)
  const dimensionScores: ScoredDimension[] = inp.rules.map((rule) =>
    scoreDimension(rule, inp.components_by_dim.get(rule.ei_dimension_id) ?? [], inp.measurement),
  );

  // --- Tier 3: EI roll-up
  const ei = calculateEi(dimensionScores, {
    measurement: inp.measurement,
    confidence_cap: DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP,
    band_thresholds: DEFAULT_BAND_THRESHOLDS,
  });

  const chainSteps: CalcStep[] = [
    {
      n: 1,
      label: 'Tier 1 · competency scores',
      expr: `${compMeasured}/${compEntries.length} competencies measured`,
      value: compCoverage,
      note: `domain-proxy scores feeding ${inp.rules.length} dimension(s)`,
    },
    {
      n: 2,
      label: 'Tier 2 · dimension scores',
      expr: 'weighted mean of measured components per dimension',
      value: `${ei.dimensions_measurable}/${ei.dimensions_total} dimensions measurable`,
    },
    {
      n: 3,
      label: 'Tier 3 · EI score',
      expr: 'weighted roll-up over measurable dimensions',
      value: ei.ei_score,
      note: ei.band ?? 'not measurable',
    },
  ];

  return {
    ok: true,
    subject_id: subjectId,
    role_id: inp.role_id,
    scoring_version: SCORING_ENGINE_VERSION,
    ei_version: COMPETENCY_EI_DIMENSIONS_VERSION,
    weights_version: DIMENSION_WEIGHTS_VERSION,
    provisioned: true,
    measurable: ei.measurable,
    measurement: inp.measurement,
    competency_scores: {
      total: compEntries.length,
      measured: compMeasured,
      coverage_pct: compCoverage,
      entries: compEntries,
    },
    dimension_scores: dimensionScores,
    ei,
    summary: {
      measurable: ei.measurable,
      ei_score: ei.ei_score,
      ei_band: ei.band,
      coverage_pct: ei.coverage_pct,
      confidence: ei.confidence,
      dimensions_total: ei.dimensions_total,
      dimensions_measurable: ei.dimensions_measurable,
    },
    chain_trace: {
      pipeline: 'competency_scores → dimension_scores → ei_score',
      measurement: inp.measurement,
      steps: chainSteps,
    },
    language_policy: LANGUAGE_POLICY,
    generated_at: new Date().toISOString(),
    notes,
  };
}

// ----------------------------------------------------------------------------
// Audit ledger — employability_scoring_runs (append-only)
// ----------------------------------------------------------------------------

let scoringSchemaReady = false;

/** Lazily ensure the audit table (mirrors migrations/20260619_*). WRITE path only. */
export async function ensureScoringRunSchema(pool: Pool): Promise<void> {
  if (scoringSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employability_scoring_runs (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_id           VARCHAR(160) NOT NULL,
      role_id              VARCHAR(160),
      measurable           BOOLEAN NOT NULL DEFAULT false,
      measurement          VARCHAR(40) NOT NULL DEFAULT 'domain_proxy',
      ei_score             NUMERIC(6,2),
      ei_band              VARCHAR(40),
      coverage_pct         NUMERIC(6,2) NOT NULL DEFAULT 0,
      confidence_score     NUMERIC(6,2) NOT NULL DEFAULT 0,
      confidence_band      VARCHAR(40),
      dimensions_total     INTEGER NOT NULL DEFAULT 0,
      dimensions_measurable INTEGER NOT NULL DEFAULT 0,
      scoring_version      VARCHAR(40) NOT NULL,
      weights_version      VARCHAR(40) NOT NULL,
      trace                JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT employability_scoring_runs_ei_score_chk
        CHECK (ei_score IS NULL OR (ei_score >= 0 AND ei_score <= 100)),
      CONSTRAINT employability_scoring_runs_coverage_chk
        CHECK (coverage_pct >= 0 AND coverage_pct <= 100),
      CONSTRAINT employability_scoring_runs_confidence_chk
        CHECK (confidence_score >= 0 AND confidence_score <= 100)
    );
    CREATE INDEX IF NOT EXISTS idx_employability_scoring_runs_subject
      ON employability_scoring_runs (subject_id, created_at DESC);
  `);
  scoringSchemaReady = true;
}

async function scoringTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass('public.employability_scoring_runs') AS reg`);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

export interface ScoringRunRecord {
  id: string;
  subject_id: string;
  role_id: string | null;
  measurable: boolean;
  measurement: string;
  ei_score: number | null;
  ei_band: string | null;
  coverage_pct: number;
  confidence_score: number;
  confidence_band: string | null;
  dimensions_total: number;
  dimensions_measurable: number;
  scoring_version: string;
  weights_version: string;
  created_at: string;
}

function toRunRecord(row: any): ScoringRunRecord {
  return {
    id: String(row.id),
    subject_id: String(row.subject_id),
    role_id: row.role_id ?? null,
    measurable: row.measurable === true,
    measurement: String(row.measurement),
    ei_score: row.ei_score != null ? Number(row.ei_score) : null,
    ei_band: row.ei_band ?? null,
    coverage_pct: row.coverage_pct != null ? Number(row.coverage_pct) : 0,
    confidence_score: row.confidence_score != null ? Number(row.confidence_score) : 0,
    confidence_band: row.confidence_band ?? null,
    dimensions_total: Number(row.dimensions_total ?? 0),
    dimensions_measurable: Number(row.dimensions_measurable ?? 0),
    scoring_version: String(row.scoring_version),
    weights_version: String(row.weights_version),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/** Compute + persist one audit run. WRITE path (ensures schema first). */
export async function persistScoringRun(
  pool: Pool,
  subjectId: string,
): Promise<{ run_id: string; artifact: EmployabilityScore }> {
  await ensureScoringRunSchema(pool);
  const artifact = await computeEmployabilityScore(pool, subjectId);
  const r = await pool.query(
    `INSERT INTO employability_scoring_runs
       (subject_id, role_id, measurable, measurement, ei_score, ei_band,
        coverage_pct, confidence_score, confidence_band,
        dimensions_total, dimensions_measurable, scoring_version, weights_version, trace)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     RETURNING id`,
    [
      artifact.subject_id,
      artifact.role_id,
      artifact.measurable,
      artifact.measurement,
      artifact.ei.ei_score,
      artifact.ei.band,
      artifact.summary.coverage_pct,
      artifact.summary.confidence.score,
      artifact.summary.confidence.band,
      artifact.summary.dimensions_total,
      artifact.summary.dimensions_measurable,
      artifact.scoring_version,
      artifact.weights_version,
      JSON.stringify(artifact),
    ],
  );
  return { run_id: String(r.rows[0].id), artifact };
}

/** Read run history for a subject (read-only; degrades to [] when unprovisioned). */
export async function listScoringRuns(
  pool: Pool,
  subjectId: string,
  limit = 50,
): Promise<{ provisioned: boolean; runs: ScoringRunRecord[] }> {
  if (!(await scoringTableExists(pool))) return { provisioned: false, runs: [] };
  try {
    const r = await pool.query(
      `SELECT id, subject_id, role_id, measurable, measurement, ei_score, ei_band,
              coverage_pct, confidence_score, confidence_band,
              dimensions_total, dimensions_measurable, scoring_version, weights_version, created_at
         FROM employability_scoring_runs
        WHERE subject_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [subjectId, Math.max(1, Math.min(200, limit))],
    );
    return { provisioned: true, runs: r.rows.map(toRunRecord) };
  } catch {
    return { provisioned: false, runs: [] };
  }
}

/** Fetch one full persisted run (with trace). Read-only; null when absent. */
export async function getScoringRun(
  pool: Pool,
  runId: string,
): Promise<{ provisioned: boolean; run: (ScoringRunRecord & { trace: any }) | null }> {
  if (!(await scoringTableExists(pool))) return { provisioned: false, run: null };
  try {
    const r = await pool.query(
      `SELECT id, subject_id, role_id, measurable, measurement, ei_score, ei_band,
              coverage_pct, confidence_score, confidence_band,
              dimensions_total, dimensions_measurable, scoring_version, weights_version, created_at, trace
         FROM employability_scoring_runs
        WHERE id = $1`,
      [runId],
    );
    if (r.rowCount === 0) return { provisioned: true, run: null };
    return { provisioned: true, run: { ...toRunRecord(r.rows[0]), trace: r.rows[0].trace ?? {} } };
  } catch {
    return { provisioned: false, run: null };
  }
}
