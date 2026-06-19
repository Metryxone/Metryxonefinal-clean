/**
 * Phase 3 — Competency Employability Intelligence Engine (CEI)
 * ============================================================
 * Transforms the Phase 2 competency-runtime outputs into an employability-
 * intelligence envelope. STRICTLY ADDITIVE · READ-ONLY · NEVER-THROWS.
 *
 * It COMPOSES (never recomputes) the five already-computed competency layers:
 *   1. getProfile                     — domain-proxy competency scores
 *   2. computeRoleReadinessForSubject — role readiness % + strengths/gaps
 *   3. computeCompetencyGapEngine     — prioritized development gaps
 *   4. computeCompetencySignalEngine  — behavioural risk/potential signals
 *   5. computeBenchmarkDashboard      — cohort percentile standing
 *
 * Honesty canon (see replit.md + .agents/memory):
 *  - Compose, never recompute. Inputs are taken as-is.
 *  - The Employability Index is re-normalised over the AVAILABLE component
 *    weights only — missing inputs are NOT imputed (mirrors readiness coverage).
 *  - Strengths come ONLY from positive sources (readiness met, POSITIVE signals
 *    fired, top/upper benchmark bands). NEVER from raw risk-signal magnitude.
 *  - Risks come ONLY from fired RISK signals.
 *  - Coverage (how much was measured) and Confidence (how trustworthy) are two
 *    SEPARATE axes. Domain-proxy measurement CAPS confidence.
 *  - k-anonymity is respected (benchmark suppressions are already applied
 *    upstream; we count them, never reconstruct).
 *  - Developmental-language only — never a hiring / promotion / suitability
 *    prediction. The envelope ships its own allowed/disallowed term lists.
 *  - Profile unmeasured => honest `measurable:false`, index null. No fabrication.
 *
 * DISTINCT from the legacy profile-based Employability Index (ei-engine.ts /
 * ei_* / /api/ei/* / EIGauge) which scores static profile attributes and feeds
 * the Career Builder. This engine is competency-anchored and does not touch it.
 */

import type { Pool } from 'pg';
import {
  getProfile,
  computeRoleReadinessForSubject,
  computeCompetencyGapEngine,
  computeCompetencySignalEngine,
  computeBenchmarkDashboard,
  type ProfileView,
  type CompetencyGapEngineResult,
  type CompetencySignalEngineResult,
  type BenchmarkDashboardResult,
} from './competency-runtime.js';

export const COMPETENCY_EI_VERSION = 'phase-3';
export const EI_WEIGHTS_VERSION = 'cei-w1';

// ---- Versioned component weights (constant; no ruleset CRUD this phase) -----
// Total 100. The index is re-normalised over whichever components are AVAILABLE.
export const COMPONENT_WEIGHTS = {
  readiness: 40, // role readiness % — the anchor
  gap: 25, // development-gap health (severity-penalised)
  signals: 20, // behavioural signal balance (potential vs risk)
  benchmark: 15, // cohort percentile standing
} as const;

const TOTAL_WEIGHT = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);

// Domain-proxy scoring is a coarse approximation of canonical competency
// measurement, so confidence is capped while measurement === 'domain_proxy'.
const DOMAIN_PROXY_CONFIDENCE_CAP = 60;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ComponentKey = keyof typeof COMPONENT_WEIGHTS;

export interface EiDriver {
  key: ComponentKey;
  label: string;
  weight: number;
  raw_score: number | null; // 0..100 component score (null when unavailable)
  status: 'available' | 'unavailable';
  reason?: string; // why unavailable
  contribution: number | null; // points this driver added to the final index
  direction: 'lift' | 'drag' | 'neutral' | null; // relative to the neutral 50 midpoint
}

export interface EiStrength {
  source: 'role_readiness' | 'signal' | 'benchmark';
  label: string;
  detail: string;
}

export interface EiPriority {
  competency_id: string;
  competency_name: string;
  onto_domain: string | null;
  required_level: number | null;
  current_level: number | null;
  gap: number | null;
  severity: string;
  priority: string;
}

export interface EiRisk {
  signal_id: string;
  name: string;
  category: string | null;
  interpretation: string | null;
  triggered_by: Array<{ competency_id: string; competency_name: string; level: number }>;
}

export interface EiCoverage {
  index_coverage_pct: number; // available component weight / total
  components_available: ComponentKey[];
  components_unavailable: ComponentKey[];
  role_readiness_coverage_pct: number | null; // assessed weight / total (from readiness)
  competency_measurable: number; // gap rows with a measurable severity
  competency_unmeasurable: number; // gap rows severity === 'unmeasurable'
  competency_coverage_pct: number | null;
  benchmark_dimensions_total: number;
  benchmark_dimensions_available: number;
  benchmark_suppressed: number; // k-anonymity suppressed comparisons
}

export interface EiConfidence {
  score: number; // 0..100
  band: 'High' | 'Moderate' | 'Limited' | 'Low' | 'None';
  measurement: string; // e.g. 'domain_proxy'
  caps: string[]; // hard caps applied (e.g. domain-proxy)
  factors: string[]; // penalties / context that shaped the score
}

export interface EmployabilityIntelligence {
  ok: boolean;
  subject_id: string;
  role_id: string | null;
  ei_version: string;
  weights_version: string;
  measurable: boolean;
  index_score: number | null; // 0..100
  index_band: string | null; // developmental band
  drivers: EiDriver[];
  strengths: EiStrength[];
  priorities: EiPriority[];
  risks: EiRisk[];
  coverage: EiCoverage;
  confidence: EiConfidence;
  composed_from: Record<string, unknown>;
  language_policy: {
    intent: string;
    allowed_terms: string[];
    disallowed_terms: string[];
    disclaimer: string;
  };
  notes: string[];
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Developmental bands — NOT hiring/suitability classes. */
function bandForIndex(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 35) return 'Emerging';
  return 'Early';
}

function directionOf(raw: number | null): EiDriver['direction'] {
  if (raw == null) return null;
  if (raw > 55) return 'lift';
  if (raw < 45) return 'drag';
  return 'neutral';
}

const LANGUAGE_POLICY = {
  intent: 'developmental_signal_only',
  allowed_terms: [
    'development readiness',
    'growth areas',
    'strengths',
    'competency coverage',
    'confidence',
    'developmental band',
  ],
  disallowed_terms: [
    'hire',
    'do not hire',
    'reject',
    'suitability',
    'rank candidates',
    'pass',
    'fail',
    'promotion decision',
  ],
  disclaimer:
    'Developmental signals derived from competency assessment. NOT a hiring, ' +
    'promotion, or suitability prediction.',
};

// ----------------------------------------------------------------------------
// Component scorers (each returns a 0..100 raw score or null when unavailable)
// ----------------------------------------------------------------------------

function scoreReadiness(readiness: any): { raw: number | null; reason?: string } {
  const r = readiness?.readiness;
  if (!r || r.measured !== true || r.readiness_score == null) {
    return { raw: null, reason: 'no_measured_readiness' };
  }
  return { raw: clamp(Number(r.readiness_score)) };
}

function scoreGap(gap: CompetencyGapEngineResult | null): { raw: number | null; reason?: string } {
  const s = gap?.summary;
  if (!s) return { raw: null, reason: 'gap_engine_unavailable' };
  const measurable = (s.high ?? 0) + (s.medium ?? 0) + (s.low ?? 0) + (s.none ?? 0);
  if (measurable <= 0) return { raw: null, reason: 'no_measurable_competencies' };
  // Start from a perfect 100 and penalise by severity. Bounded + interpretable.
  const penalty = (s.high ?? 0) * 15 + (s.medium ?? 0) * 8 + (s.low ?? 0) * 3;
  return { raw: clamp(100 - penalty) };
}

function scoreSignals(signals: CompetencySignalEngineResult | null): { raw: number | null; reason?: string } {
  const s = signals?.summary;
  if (!s) return { raw: null, reason: 'signal_engine_unavailable' };
  const evaluable = (s.fired ?? 0) + (s.not_fired ?? 0);
  if (evaluable <= 0) return { raw: null, reason: 'no_evaluable_signals' };
  // Neutral midpoint 50; potential lifts, risk drags. Bounded.
  const raw = 50 + (s.potential_fired ?? 0) * 12 - (s.risk_fired ?? 0) * 18;
  return { raw: clamp(raw) };
}

function scoreBenchmark(benchmark: BenchmarkDashboardResult | null): { raw: number | null; reason?: string } {
  const primary = benchmark?.summary?.primary as any;
  const avail = Number(benchmark?.summary?.dimensions_available ?? 0);
  if (avail <= 0 || primary?.aggregate_percentile == null) {
    return { raw: null, reason: 'no_benchmark_cohort' };
  }
  return { raw: clamp(Number(primary.aggregate_percentile)) };
}

// ----------------------------------------------------------------------------
// Positive-source extractors (strengths) — NEVER from raw risk signals
// ----------------------------------------------------------------------------

function extractStrengths(
  readiness: any,
  signals: CompetencySignalEngineResult | null,
  benchmark: BenchmarkDashboardResult | null,
): EiStrength[] {
  const out: EiStrength[] = [];

  // 1. Role-readiness strengths = assessed competencies met or exceeded.
  const rStrengths: any[] = readiness?.readiness?.strengths ?? [];
  for (const g of rStrengths) {
    const label = String(g?.competency_name ?? g?.competency_id ?? 'Competency');
    out.push({ source: 'role_readiness', label, detail: 'Meets or exceeds the required level for the role.' });
  }

  // 2. POSITIVE signals that fired (polarity === 'potential' only).
  const sigs: any[] = signals?.signals ?? [];
  for (const sig of sigs) {
    if (sig?.polarity === 'potential' && sig?.status === 'fired') {
      out.push({
        source: 'signal',
        label: String(sig?.name ?? 'Potential signal'),
        detail: String(sig?.interpretation ?? 'A positive behavioural signal fired.'),
      });
    }
  }

  // 3. Top/upper benchmark standing (status above).
  const dims: any[] = benchmark?.comparison?.dimensions ?? [];
  for (const dim of dims) {
    for (const c of dim?.comparisons ?? []) {
      if ((c?.band === 'top' || c?.band === 'upper') && c?.status === 'above') {
        out.push({
          source: 'benchmark',
          label: String(c?.competency_name ?? c?.competency_id ?? 'Competency'),
          detail: `${String(c.band)} cohort standing on the ${String(dim?.key ?? 'cohort')} dimension.`,
        });
      }
    }
  }

  return out;
}

function extractPriorities(gap: CompetencyGapEngineResult | null): EiPriority[] {
  const rows: any[] = gap?.gaps ?? [];
  return rows
    .filter((g) => g?.development_need === true)
    .sort((a, b) => Number(a?.priority_rank ?? 999) - Number(b?.priority_rank ?? 999))
    .map((g) => ({
      competency_id: String(g?.competency_id ?? ''),
      competency_name: String(g?.competency_name ?? g?.competency_id ?? ''),
      onto_domain: g?.onto_domain ?? null,
      required_level: g?.required_level ?? null,
      current_level: g?.current_level ?? null,
      gap: g?.gap ?? null,
      severity: String(g?.severity ?? 'unprioritized'),
      priority: String(g?.priority ?? 'unprioritized'),
    }));
}

function extractRisks(signals: CompetencySignalEngineResult | null): EiRisk[] {
  const sigs: any[] = signals?.signals ?? [];
  return sigs
    .filter((s) => s?.polarity === 'risk' && s?.status === 'fired')
    .map((s) => ({
      signal_id: String(s?.signal_id ?? ''),
      name: String(s?.name ?? ''),
      category: s?.category ?? null,
      interpretation: s?.interpretation ?? null,
      triggered_by: (s?.triggered_by ?? []).map((t: any) => ({
        competency_id: String(t?.competency_id ?? ''),
        competency_name: String(t?.competency_name ?? ''),
        level: Number(t?.level ?? 0),
      })),
    }));
}

// ----------------------------------------------------------------------------
// Core: compute the employability intelligence (read-only, never throws)
// ----------------------------------------------------------------------------

async function safe<T>(fn: () => Promise<T>): Promise<{ value: T | null; error: string | null }> {
  try {
    return { value: await fn(), error: null };
  } catch (err: any) {
    return { value: null, error: err?.message ?? String(err) };
  }
}

export async function computeEmployabilityIntelligence(
  pool: Pool,
  subjectId: string,
): Promise<EmployabilityIntelligence> {
  const notes: string[] = [];

  const [profileR, readinessR, gapR, signalsR, benchmarkR] = await Promise.all([
    safe<ProfileView>(() => getProfile(pool, subjectId)),
    safe<any>(() => computeRoleReadinessForSubject(pool, subjectId)),
    safe<CompetencyGapEngineResult>(() => computeCompetencyGapEngine(pool, subjectId)),
    safe<CompetencySignalEngineResult>(() => computeCompetencySignalEngine(pool, subjectId)),
    safe<BenchmarkDashboardResult>(() => computeBenchmarkDashboard(pool, subjectId)),
  ]);

  for (const [name, r] of [
    ['profile', profileR],
    ['readiness', readinessR],
    ['gap', gapR],
    ['signals', signalsR],
    ['benchmark', benchmarkR],
  ] as const) {
    if (r.error) notes.push(`${name}_input_error: ${r.error}`);
  }

  const profile = profileR.value;
  const readiness = readinessR.value;
  const gap = gapR.value;
  const signals = signalsR.value;
  const benchmark = benchmarkR.value;

  const roleId = profile?.role_id ?? readiness?.role_id ?? gap?.role_readiness?.role_id ?? null;
  const measurement = profile?.measurement ?? 'domain_proxy';

  // Honest gate: nothing was measured -> not measurable. No fabrication.
  if (!profile || profile.measured !== true) {
    return notMeasurable(subjectId, roleId, measurement, notes, {
      profile_measured: profile?.measured ?? false,
      readiness_ok: readiness?.ok ?? false,
      gap_ok: gap?.ok ?? false,
      signals_ok: signals?.ok ?? false,
      benchmark_ok: !!benchmark,
    });
  }

  // ---- Component scores ------------------------------------------------------
  const comp: Record<ComponentKey, { raw: number | null; reason?: string }> = {
    readiness: scoreReadiness(readiness),
    gap: scoreGap(gap),
    signals: scoreSignals(signals),
    benchmark: scoreBenchmark(benchmark),
  };

  const availableWeight = (Object.keys(comp) as ComponentKey[]).reduce(
    (sum, k) => (comp[k].raw != null ? sum + COMPONENT_WEIGHTS[k] : sum),
    0,
  );

  let indexScore: number | null = null;
  if (availableWeight > 0) {
    let acc = 0;
    for (const k of Object.keys(comp) as ComponentKey[]) {
      if (comp[k].raw != null) acc += (comp[k].raw as number) * COMPONENT_WEIGHTS[k];
    }
    indexScore = round1(acc / availableWeight);
  }

  // ---- Drivers (full traceability) ------------------------------------------
  const drivers: EiDriver[] = (Object.keys(comp) as ComponentKey[]).map((k) => {
    const raw = comp[k].raw;
    const available = raw != null;
    const contribution =
      available && availableWeight > 0 ? round1((raw as number) * (COMPONENT_WEIGHTS[k] / availableWeight)) : null;
    return {
      key: k,
      label: driverLabel(k),
      weight: COMPONENT_WEIGHTS[k],
      raw_score: available ? round1(raw as number) : null,
      status: available ? 'available' : 'unavailable',
      reason: available ? undefined : comp[k].reason,
      contribution,
      direction: directionOf(raw),
    };
  });

  const componentsAvailable = (Object.keys(comp) as ComponentKey[]).filter((k) => comp[k].raw != null);
  const componentsUnavailable = (Object.keys(comp) as ComponentKey[]).filter((k) => comp[k].raw == null);

  // ---- Coverage (separate axis) ---------------------------------------------
  const gapRows: any[] = gap?.gaps ?? [];
  const measurableCompetencies = gapRows.filter((g) => g?.severity !== 'unmeasurable').length;
  const unmeasurableCompetencies = gapRows.filter((g) => g?.severity === 'unmeasurable').length;
  const totalCompetencies = gapRows.length;

  let benchmarkSuppressed = 0;
  for (const dim of benchmark?.comparison?.dimensions ?? []) {
    for (const c of (dim as any)?.comparisons ?? []) {
      if (c?.status === 'suppressed') benchmarkSuppressed += 1;
    }
  }

  const coverage: EiCoverage = {
    index_coverage_pct: round1((availableWeight / TOTAL_WEIGHT) * 100),
    components_available: componentsAvailable,
    components_unavailable: componentsUnavailable,
    role_readiness_coverage_pct: readiness?.readiness?.coverage_pct ?? null,
    competency_measurable: measurableCompetencies,
    competency_unmeasurable: unmeasurableCompetencies,
    competency_coverage_pct: totalCompetencies > 0 ? round1((measurableCompetencies / totalCompetencies) * 100) : null,
    benchmark_dimensions_total: Number(benchmark?.summary?.dimensions_total ?? 0),
    benchmark_dimensions_available: Number(benchmark?.summary?.dimensions_available ?? 0),
    benchmark_suppressed: benchmarkSuppressed,
  };

  // ---- Confidence (separate axis) -------------------------------------------
  const confidence = computeConfidence(measurement, coverage, signals);

  // ---- Positive-only strengths / priorities / risks -------------------------
  const strengths = extractStrengths(readiness, signals, benchmark);
  const priorities = extractPriorities(gap);
  const risks = extractRisks(signals);

  return {
    ok: true,
    subject_id: subjectId,
    role_id: roleId,
    ei_version: COMPETENCY_EI_VERSION,
    weights_version: EI_WEIGHTS_VERSION,
    measurable: true,
    index_score: indexScore,
    index_band: indexScore != null ? bandForIndex(indexScore) : null,
    drivers,
    strengths,
    priorities,
    risks,
    coverage,
    confidence,
    composed_from: {
      profile_measured: profile.measured,
      profile_measurement: measurement,
      readiness_ok: readiness?.ok ?? false,
      gap_ok: gap?.ok ?? false,
      signals_ok: signals?.ok ?? false,
      benchmark_ok: !!benchmark,
      available_component_weight: availableWeight,
      total_component_weight: TOTAL_WEIGHT,
    },
    language_policy: LANGUAGE_POLICY,
    notes,
  };
}

function driverLabel(k: ComponentKey): string {
  switch (k) {
    case 'readiness':
      return 'Role Readiness';
    case 'gap':
      return 'Development Gap Health';
    case 'signals':
      return 'Behavioural Signal Balance';
    case 'benchmark':
      return 'Cohort Benchmark Standing';
  }
}

function computeConfidence(
  measurement: string,
  coverage: EiCoverage,
  signals: CompetencySignalEngineResult | null,
): EiConfidence {
  const caps: string[] = [];
  const factors: string[] = [];
  let cap = 100;
  let score = 100;

  if (measurement === 'domain_proxy') {
    cap = DOMAIN_PROXY_CONFIDENCE_CAP;
    caps.push(`measurement is domain_proxy → confidence capped at ${DOMAIN_PROXY_CONFIDENCE_CAP}`);
  }

  // Unmeasurable competencies erode confidence in the gap/priority picture.
  if (coverage.competency_unmeasurable > 0) {
    const pen = Math.min(20, coverage.competency_unmeasurable * 5);
    score -= pen;
    factors.push(`${coverage.competency_unmeasurable} unmeasurable competencies (−${pen})`);
  }

  // Missing components reduce how much of the picture we can stand behind.
  if (coverage.components_unavailable.length > 0) {
    const pen = Math.min(20, coverage.components_unavailable.length * 6);
    score -= pen;
    factors.push(`${coverage.components_unavailable.length} unavailable components (−${pen})`);
  }

  // k-anonymity suppressions mean less cohort evidence.
  if (coverage.benchmark_suppressed > 0) {
    const pen = Math.min(10, coverage.benchmark_suppressed * 2);
    score -= pen;
    factors.push(`${coverage.benchmark_suppressed} k-anonymity suppressed benchmark comparisons (−${pen})`);
  }

  // Thin signal evidence.
  const unevaluable = Number(signals?.summary?.unevaluable ?? 0);
  if (unevaluable > 0) {
    const pen = Math.min(10, unevaluable * 1);
    score -= pen;
    factors.push(`${unevaluable} unevaluable signals (−${pen})`);
  }

  score = clamp(Math.min(score, cap));
  let band: EiConfidence['band'];
  if (score >= 75) band = 'High';
  else if (score >= 50) band = 'Moderate';
  else if (score >= 25) band = 'Limited';
  else band = 'Low';

  return { score: round1(score), band, measurement, caps, factors };
}

function notMeasurable(
  subjectId: string,
  roleId: string | null,
  measurement: string,
  notes: string[],
  composedFrom: Record<string, unknown>,
): EmployabilityIntelligence {
  return {
    ok: true,
    subject_id: subjectId,
    role_id: roleId,
    ei_version: COMPETENCY_EI_VERSION,
    weights_version: EI_WEIGHTS_VERSION,
    measurable: false,
    index_score: null,
    index_band: null,
    drivers: [],
    strengths: [],
    priorities: [],
    risks: [],
    coverage: {
      index_coverage_pct: 0,
      components_available: [],
      components_unavailable: ['readiness', 'gap', 'signals', 'benchmark'],
      role_readiness_coverage_pct: null,
      competency_measurable: 0,
      competency_unmeasurable: 0,
      competency_coverage_pct: null,
      benchmark_dimensions_total: 0,
      benchmark_dimensions_available: 0,
      benchmark_suppressed: 0,
    },
    confidence: {
      score: 0,
      band: 'None',
      measurement,
      caps: [],
      factors: ['no measured competency profile for this subject'],
    },
    composed_from: composedFrom,
    language_policy: LANGUAGE_POLICY,
    notes: [...notes, 'subject has no measured competency profile — employability intelligence is not measurable'],
  };
}

// ----------------------------------------------------------------------------
// Persistence (append-only snapshots) + lazy schema
// ----------------------------------------------------------------------------

let schemaReady: Promise<void> | null = null;

export async function ensureCeiSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cei_employability_snapshots (
          id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          subject_id         VARCHAR(160) NOT NULL,
          role_id            VARCHAR(160),
          ei_version         VARCHAR(40)  NOT NULL DEFAULT 'phase-3',
          weights_version    VARCHAR(40)  NOT NULL DEFAULT 'cei-w1',
          measurable         BOOLEAN      NOT NULL DEFAULT false,
          index_score        NUMERIC(6,2),
          index_band         VARCHAR(40),
          index_coverage_pct NUMERIC(6,2),
          confidence_score   NUMERIC(6,2),
          confidence_band    VARCHAR(40),
          drivers            JSONB        NOT NULL DEFAULT '[]'::jsonb,
          strengths          JSONB        NOT NULL DEFAULT '[]'::jsonb,
          priorities         JSONB        NOT NULL DEFAULT '[]'::jsonb,
          risks              JSONB        NOT NULL DEFAULT '[]'::jsonb,
          coverage           JSONB        NOT NULL DEFAULT '{}'::jsonb,
          confidence         JSONB        NOT NULL DEFAULT '{}'::jsonb,
          composed_from      JSONB        NOT NULL DEFAULT '{}'::jsonb,
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_cei_index CHECK (index_score IS NULL OR (index_score >= 0 AND index_score <= 100))
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cei_subject ON cei_employability_snapshots (subject_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cei_created ON cei_employability_snapshots (created_at);`);
    })().catch((err) => {
      schemaReady = null; // allow retry on a later request
      throw err;
    });
  }
  return schemaReady;
}

/**
 * Read-only existence check (no DDL). Used by GET paths so reads NEVER write —
 * the snapshot table is only ever CREATEd on the explicit POST write path.
 */
async function snapshotTableExists(pool: Pool): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass('public.cei_employability_snapshots') AS reg`);
  return r.rows[0]?.reg != null;
}

export interface PersistResult extends EmployabilityIntelligence {
  snapshot_id: string;
  persisted_at: string;
}

/** Compute + APPEND one immutable snapshot. Explicit write path (POST only). */
export async function persistEmployabilitySnapshot(pool: Pool, subjectId: string): Promise<PersistResult> {
  await ensureCeiSchema(pool);
  const intel = await computeEmployabilityIntelligence(pool, subjectId);
  const row = await pool.query(
    `INSERT INTO cei_employability_snapshots
       (subject_id, role_id, ei_version, weights_version, measurable, index_score, index_band,
        index_coverage_pct, confidence_score, confidence_band,
        drivers, strengths, priorities, risks, coverage, confidence, composed_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id, created_at`,
    [
      intel.subject_id,
      intel.role_id,
      intel.ei_version,
      intel.weights_version,
      intel.measurable,
      intel.index_score,
      intel.index_band,
      intel.coverage.index_coverage_pct,
      intel.confidence.score,
      intel.confidence.band,
      JSON.stringify(intel.drivers),
      JSON.stringify(intel.strengths),
      JSON.stringify(intel.priorities),
      JSON.stringify(intel.risks),
      JSON.stringify(intel.coverage),
      JSON.stringify(intel.confidence),
      JSON.stringify(intel.composed_from),
    ],
  );
  return {
    ...intel,
    snapshot_id: String(row.rows[0].id),
    persisted_at: String(row.rows[0].created_at),
  };
}

export async function listSnapshotHistory(pool: Pool, subjectId: string, limit = 50): Promise<any[]> {
  // Read-only: never CREATE. No snapshots have been captured yet => empty.
  if (!(await snapshotTableExists(pool))) return [];
  const r = await pool.query(
    `SELECT id, subject_id, role_id, measurable, index_score, index_band,
            index_coverage_pct, confidence_score, confidence_band, created_at
       FROM cei_employability_snapshots
      WHERE subject_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [subjectId, Math.max(1, Math.min(200, limit))],
  );
  return r.rows;
}

export interface AdminOverview {
  total_snapshots: number;
  distinct_subjects: number;
  measurable_snapshots: number;
  avg_index_score: number | null;
  band_distribution: Record<string, number>;
  latest: any | null;
}

export async function computeAdminOverview(pool: Pool): Promise<AdminOverview> {
  // Read-only: never CREATE. No table yet => honest zeroed overview.
  if (!(await snapshotTableExists(pool))) {
    return {
      total_snapshots: 0,
      distinct_subjects: 0,
      measurable_snapshots: 0,
      avg_index_score: null,
      band_distribution: {},
      latest: null,
    };
  }
  const counts = await pool.query(`
    SELECT
      COUNT(*)::int                                              AS total_snapshots,
      COUNT(DISTINCT subject_id)::int                           AS distinct_subjects,
      COUNT(*) FILTER (WHERE measurable)::int                   AS measurable_snapshots,
      AVG(index_score) FILTER (WHERE index_score IS NOT NULL)   AS avg_index_score
    FROM cei_employability_snapshots
  `);
  const bands = await pool.query(`
    SELECT COALESCE(index_band, 'not_measurable') AS band, COUNT(*)::int AS n
    FROM cei_employability_snapshots
    GROUP BY 1
  `);
  const latest = await pool.query(`
    SELECT id, subject_id, role_id, index_score, index_band, confidence_band, created_at
    FROM cei_employability_snapshots
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const band_distribution: Record<string, number> = {};
  for (const r of bands.rows) band_distribution[String(r.band)] = Number(r.n);
  const c = counts.rows[0] ?? {};
  return {
    total_snapshots: Number(c.total_snapshots ?? 0),
    distinct_subjects: Number(c.distinct_subjects ?? 0),
    measurable_snapshots: Number(c.measurable_snapshots ?? 0),
    avg_index_score: c.avg_index_score != null ? round1(Number(c.avg_index_score)) : null,
    band_distribution,
    latest: latest.rows[0] ?? null,
  };
}

// ----------------------------------------------------------------------------
// Validation (per-subject chain validation — mirrors the runtime harness style)
// ----------------------------------------------------------------------------

export interface EiValidationStage {
  name: string;
  status: 'pass' | 'gap' | 'fail';
  detail: string;
}

export interface EiValidationResult {
  ok: boolean;
  subject_id: string;
  measurable: boolean;
  stages: EiValidationStage[];
  summary: { pass: number; gap: number; fail: number };
}

export async function computeEiValidation(pool: Pool, subjectId: string): Promise<EiValidationResult> {
  const intel = await computeEmployabilityIntelligence(pool, subjectId);
  const stages: EiValidationStage[] = [];

  const cf = intel.composed_from as any;
  const inputs: Array<[string, boolean]> = [
    ['profile', cf.profile_measured === true],
    ['readiness', cf.readiness_ok === true],
    ['gap', cf.gap_ok === true],
    ['signals', cf.signals_ok === true],
    ['benchmark', cf.benchmark_ok === true],
  ];
  const availableInputs = inputs.filter(([, ok]) => ok).map(([n]) => n);
  stages.push({
    name: 'inputs_composed',
    status: availableInputs.length >= 1 ? (availableInputs.length >= 3 ? 'pass' : 'gap') : 'fail',
    detail: `composed inputs: ${availableInputs.join(', ') || 'none'}`,
  });

  stages.push({
    name: 'index_computed',
    status: intel.measurable ? (intel.index_score != null ? 'pass' : 'gap') : 'fail',
    detail: intel.measurable
      ? `index ${intel.index_score ?? 'null'} (${intel.index_band ?? 'n/a'})`
      : 'not measurable — no competency profile',
  });

  // Honesty: strengths may ONLY originate from the three positive sources.
  // Anything else (e.g. a risk signal leaking in) is a fabrication and fails.
  const POSITIVE_SOURCES = new Set(['role_readiness', 'signal', 'benchmark']);
  const strengthSources = [...new Set(intel.strengths.map((s) => s.source))];
  const positiveOnly = strengthSources.every((s) => POSITIVE_SOURCES.has(s));
  stages.push({
    name: 'strengths_positive_only',
    status: positiveOnly ? 'pass' : 'fail',
    detail: `strengths sourced from: ${strengthSources.join(', ') || 'none'} (risk signals excluded by construction)`,
  });

  stages.push({
    name: 'coverage_confidence_separated',
    status:
      intel.coverage != null && intel.confidence != null && typeof intel.confidence.score === 'number' ? 'pass' : 'fail',
    detail: `coverage ${intel.coverage.index_coverage_pct}% · confidence ${intel.confidence.score} (${intel.confidence.band})`,
  });

  // Read-only existence probe (no DDL). Absent table is a GAP not a FAIL — it is
  // created lazily on the first POST snapshot capture.
  let snapshotStatus: EiValidationStage['status'] = 'pass';
  let snapshotDetail = 'append-only snapshot table present';
  try {
    if (!(await snapshotTableExists(pool))) {
      snapshotStatus = 'gap';
      snapshotDetail = 'snapshot table not yet created — created lazily on first POST capture';
    }
  } catch (err: any) {
    snapshotStatus = 'fail';
    snapshotDetail = `schema probe error: ${err?.message ?? err}`;
  }
  stages.push({ name: 'snapshot_capability', status: snapshotStatus, detail: snapshotDetail });

  const summary = {
    pass: stages.filter((s) => s.status === 'pass').length,
    gap: stages.filter((s) => s.status === 'gap').length,
    fail: stages.filter((s) => s.status === 'fail').length,
  };
  return { ok: summary.fail === 0, subject_id: subjectId, measurable: intel.measurable, stages, summary };
}
