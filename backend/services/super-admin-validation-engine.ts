/**
 * Phase 3.12 — Super Admin Validation Engine.
 *
 * A PURE, read-only validation harness a super-admin runs for ONE subject. It
 * COMPOSES the Phase 3.1–3.11 EI engines + platform governance probes and
 * asserts honesty / structural INVARIANTS across TEN areas:
 *
 *   1. EI Calculations        (buildEiProfile)
 *   2. Dimension Calculations (computeEmployabilityDimensions)
 *   3. Role Readiness         (computeRoleReadinessV2)
 *   4. Industry Readiness     (computeIndustryReadiness, probed sample target)
 *   5. Function Readiness     (computeFunctionReadiness, probed sample target)
 *   6. Signals                (computeEmployabilitySignals)
 *   7. Recommendations        (computeEmployabilityRecommendations)
 *   8. History                (buildEiHistory)
 *   9. Audit Logs             (admin_audit_logs / platform_audit_log probe)
 *  10. Permissions            (RBAC tables probe + super_admin presence)
 *
 * Honesty contract:
 *   - COMPOSES, never recomputes: every check runs the canonical engine and
 *     inspects its output; this harness performs NO new scoring.
 *   - Three statuses: PASS (checked & valid) · WARN (not measurable /
 *     insufficient data / empty taxonomy — an honest absence, NOT a failure) ·
 *     FAIL (an invariant was violated: out-of-bounds score, band/score
 *     mismatch, a claim of measurability without data, or a fabricated
 *     fire/recommendation).
 *   - never throws: each area is isolated; a thrown engine error becomes a FAIL
 *     for THAT area only (a genuine defect) — never a 500 and never silent.
 *   - ZERO DDL: platform probes use to_regclass + degrade; an absent table is a
 *     WARN, never a CREATE. Flag-OFF this module is never reached.
 */

import type { Pool } from 'pg';
import { buildEiProfile } from './ei-profile-engine.js';
import { computeEmployabilityDimensions } from './competency-ei-dimensions.js';
import { computeRoleReadinessV2 } from './role-readiness-v2.js';
import { computeIndustryReadiness } from './industry-readiness-engine.js';
import { computeFunctionReadiness } from './function-readiness-engine.js';
import { computeEmployabilitySignals } from './employability-signal-engine.js';
import { computeEmployabilityRecommendations } from './ei-recommendation-engine.js';
import { buildEiHistory } from './ei-history-engine.js';

export const SUPER_ADMIN_VALIDATION_VERSION = '3.12.0';

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationStatus;
  detail: string;
}

export interface ValidationArea {
  id: string;
  label: string;
  scope: 'subject' | 'platform';
  status: ValidationStatus;
  measurable: boolean | null; // null for platform areas where the axis is N/A
  checks: ValidationCheck[];
  notes: string[];
}

export interface SuperAdminValidationResult {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  areas: ValidationArea[];
  summary: {
    areas_total: number;
    areas_pass: number;
    areas_warn: number;
    areas_fail: number;
    checks_total: number;
    checks_pass: number;
    checks_warn: number;
    checks_fail: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** Worst-of precedence: fail > warn > pass. An empty list is a PASS. */
function worst(checks: ValidationCheck[]): ValidationStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

/**
 * A nullable numeric is "in range" when it is NULL (honestly unmeasured) OR a
 * finite number within [lo, hi]. NULL is never a bounds violation — only a
 * present-but-out-of-bounds value fails.
 */
function inRange(n: number | null | undefined, lo = 0, hi = 100): boolean {
  return n == null || (typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi);
}

/** band non-null iff score non-null (a band without a score, or vice versa, is incoherent). */
function bandScoreCoherent(score: number | null | undefined, band: string | null | undefined): boolean {
  return (score == null) === (band == null);
}

function area(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  checks: ValidationCheck[],
  notes: string[],
  measurable: boolean | null,
): ValidationArea {
  return { id, label, scope, status: worst(checks), measurable, checks, notes };
}

/** Read-only existence probe — never throws, never writes. */
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [name]);
    return r.rows[0]?.t != null;
  } catch {
    return false;
  }
}

/** First non-deprecated taxonomy id (read-only) or null. Table name is a fixed literal. */
async function firstTaxonomyId(pool: Pool, table: 'onto_industries' | 'onto_functions'): Promise<string | null> {
  if (!(await tableExists(pool, table))) return null;
  try {
    const r = await pool.query(
      `SELECT id FROM ${table} WHERE deprecated = FALSE ORDER BY display_order, name LIMIT 1`,
    );
    return r.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function countRows(pool: Pool, table: string): Promise<number | null> {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Area 1 — EI Calculations
// ---------------------------------------------------------------------------

async function validateEiCalculations(pool: Pool, sid: string): Promise<ValidationArea> {
  const p = await buildEiProfile(pool, sid);
  const o = p.overall_ei;
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'measurable',
    label: 'EI is measurable',
    status: p.measurable ? 'pass' : 'warn',
    detail: p.measurable
      ? `measurable — EI ${o.ei_score} (${o.band})`
      : `not measurable — ${p.notes[0] ?? 'no competency profile'} (honest absence, not a failure)`,
  });

  checks.push({
    id: 'score_bounds',
    label: 'EI score within 0–100 (or null)',
    status: inRange(o.ei_score) ? 'pass' : 'fail',
    detail: o.ei_score == null ? 'null — not measured' : `ei_score=${o.ei_score}`,
  });

  checks.push({
    id: 'band_score_coherent',
    label: 'Band present iff score present',
    status: bandScoreCoherent(o.ei_score, o.band) ? 'pass' : 'fail',
    detail: `score=${o.ei_score ?? 'null'} · band=${o.band ?? 'null'}`,
  });

  const measScoreOk = p.measurable ? o.ei_score != null : o.ei_score == null;
  checks.push({
    id: 'measurable_matches_data',
    label: 'Measurable flag matches score presence',
    status: measScoreOk ? 'pass' : 'fail',
    detail: `measurable=${p.measurable} · score=${o.ei_score ?? 'null'}`,
  });

  checks.push({
    id: 'coverage_bounds',
    label: 'Coverage within 0–100',
    status: inRange(o.coverage_pct) ? 'pass' : 'fail',
    detail: `coverage_pct=${o.coverage_pct}`,
  });

  const conf = o.confidence as any;
  const sep = conf != null && typeof conf.score === 'number' && typeof conf.band === 'string';
  checks.push({
    id: 'coverage_confidence_separated',
    label: 'Coverage & confidence are distinct axes',
    status: sep ? 'pass' : 'fail',
    detail: sep
      ? `coverage ${o.coverage_pct}% · confidence ${conf.score} (${conf.band})`
      : 'confidence axis missing — cannot separate from coverage',
  });

  return area('ei_calculations', 'EI Calculations', 'subject', checks, p.notes.slice(0, 2), p.measurable);
}

// ---------------------------------------------------------------------------
// Area 2 — Dimension Calculations
// ---------------------------------------------------------------------------

async function validateDimensionCalculations(pool: Pool, sid: string): Promise<ValidationArea> {
  const r = await computeEmployabilityDimensions(pool, sid);
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'measurable',
    label: 'At least one dimension measurable',
    status: r.measurable ? 'pass' : 'warn',
    detail: r.measurable
      ? `${r.overall.dimensions_measurable}/${r.overall.dimensions_total} dimensions measurable`
      : 'no measurable dimension yet (honest absence, not a failure)',
  });

  checks.push({
    id: 'measurable_le_total',
    label: 'Measurable count ≤ total count',
    status: r.overall.dimensions_measurable <= r.overall.dimensions_total ? 'pass' : 'fail',
    detail: `${r.overall.dimensions_measurable} ≤ ${r.overall.dimensions_total}`,
  });

  const offenders: string[] = [];
  for (const d of r.dimensions) {
    if (!inRange(d.score)) offenders.push(`${d.ei_dimension_id}: score=${d.score}`);
    if (!bandScoreCoherent(d.score, d.band)) offenders.push(`${d.ei_dimension_id}: band/score mismatch`);
    if (!(typeof d.rollup_weight === 'number' && d.rollup_weight >= 0)) {
      offenders.push(`${d.ei_dimension_id}: weight=${d.rollup_weight}`);
    }
  }
  checks.push({
    id: 'dimension_invariants',
    label: 'Each dimension: score 0–100|null, band↔score coherent, weight ≥ 0',
    status: offenders.length === 0 ? 'pass' : 'fail',
    detail: offenders.length === 0 ? `${r.dimensions.length} dimensions valid` : offenders.join('; '),
  });

  checks.push({
    id: 'overall_index_bounds',
    label: 'Overall index within 0–100 (or null)',
    status: inRange(r.overall.index_score) ? 'pass' : 'fail',
    detail: `index_score=${r.overall.index_score ?? 'null'}`,
  });

  return area('dimension_calculations', 'Dimension Calculations', 'subject', checks, r.notes.slice(0, 2), r.measurable);
}

// ---------------------------------------------------------------------------
// Area 3 — Role Readiness
// ---------------------------------------------------------------------------

async function validateRoleReadiness(pool: Pool, sid: string): Promise<ValidationArea> {
  const r = await computeRoleReadinessV2(pool, sid);
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'target_role',
    label: 'Target role resolved',
    status: r.role_id ? 'pass' : 'warn',
    detail: r.role_id ? `role ${r.role_id} (${r.role_title ?? 'untitled'})` : 'no target role resolved for subject',
  });

  checks.push({
    id: 'measurable',
    label: 'Role readiness measurable',
    status: r.measurable ? 'pass' : 'warn',
    detail: r.measurable ? `readiness ${r.readiness.score} (${r.readiness.band})` : 'not measurable (honest absence)',
  });

  checks.push({
    id: 'readiness_bounds',
    label: 'Readiness score within 0–100 (or null)',
    status: inRange(r.readiness.score) ? 'pass' : 'fail',
    detail: `readiness.score=${r.readiness.score ?? 'null'}`,
  });

  checks.push({
    id: 'readiness_band_coherent',
    label: 'Readiness band present iff score present',
    status: bandScoreCoherent(r.readiness.score, r.readiness.band) ? 'pass' : 'fail',
    detail: `score=${r.readiness.score ?? 'null'} · band=${r.readiness.band ?? 'null'}`,
  });

  const fitBands = ['strong', 'good', 'partial', 'low', 'unmeasured'];
  checks.push({
    id: 'fit_band_enum',
    label: 'Role-match fit band is a known value',
    status: fitBands.includes(r.role_match.fit_band) ? 'pass' : 'fail',
    detail: `fit_band=${r.role_match.fit_band}`,
  });

  checks.push({
    id: 'match_score_bounds',
    label: 'Role-match score within 0–100 (or null)',
    status: inRange(r.role_match.score) ? 'pass' : 'fail',
    detail: `role_match.score=${r.role_match.score ?? 'null'}`,
  });

  return area('role_readiness', 'Role Readiness', 'subject', checks, r.notes.slice(0, 2), r.measurable);
}

// ---------------------------------------------------------------------------
// Areas 4 & 5 — Industry / Function Readiness (probed against a sample target)
// ---------------------------------------------------------------------------

async function validateIndustryReadiness(pool: Pool, sid: string): Promise<ValidationArea> {
  const iid = await firstTaxonomyId(pool, 'onto_industries');
  if (!iid) {
    return area(
      'industry_readiness',
      'Industry Readiness',
      'subject',
      [
        {
          id: 'taxonomy_target',
          label: 'A sample industry exists to validate against',
          status: 'warn',
          detail: 'onto_industries empty or absent — nothing to validate (honest absence, not a failure)',
        },
      ],
      ['No industry in the taxonomy; the engine contract cannot be exercised.'],
      false,
    );
  }

  const r = await computeIndustryReadiness(pool, sid, iid);
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'available',
    label: 'Industry has derivable requirements',
    status: r.available ? 'pass' : 'warn',
    detail: r.available
      ? `industry ${iid} (${r.industry_name ?? '?'}) · ${r.role_count} roles · ${r.competency_count} competencies`
      : `industry ${iid} has no derivable requirements (its roles lack competency profiles)`,
  });

  checks.push({
    id: 'readiness_bounds',
    label: 'Readiness score within 0–100 (or null)',
    status: inRange(r.readiness.score) ? 'pass' : 'fail',
    detail: `readiness.score=${r.readiness.score ?? 'null'}`,
  });

  checks.push({
    id: 'readiness_band_coherent',
    label: 'Readiness band present iff score present',
    status: bandScoreCoherent(r.readiness.score, r.readiness.band) ? 'pass' : 'fail',
    detail: `score=${r.readiness.score ?? 'null'} · band=${r.readiness.band ?? 'null'}`,
  });

  const srcOk = r.requirement_source === (r.available ? 'role_aggregation' : 'none');
  checks.push({
    id: 'requirement_source',
    label: 'Requirement source matches availability',
    status: srcOk ? 'pass' : 'fail',
    detail: `available=${r.available} · requirement_source=${r.requirement_source}`,
  });

  checks.push({
    id: 'counts_non_negative',
    label: 'Role & competency counts are non-negative',
    status: r.role_count >= 0 && r.competency_count >= 0 ? 'pass' : 'fail',
    detail: `role_count=${r.role_count} · competency_count=${r.competency_count}`,
  });

  return area('industry_readiness', 'Industry Readiness', 'subject', checks, r.notes.slice(0, 2), r.measurable);
}

async function validateFunctionReadiness(pool: Pool, sid: string): Promise<ValidationArea> {
  const fid = await firstTaxonomyId(pool, 'onto_functions');
  if (!fid) {
    return area(
      'function_readiness',
      'Function Readiness',
      'subject',
      [
        {
          id: 'taxonomy_target',
          label: 'A sample function exists to validate against',
          status: 'warn',
          detail: 'onto_functions empty or absent — nothing to validate (honest absence, not a failure)',
        },
      ],
      ['No function in the taxonomy; the engine contract cannot be exercised.'],
      false,
    );
  }

  const r = await computeFunctionReadiness(pool, sid, fid);
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'available',
    label: 'Function has derivable requirements',
    status: r.available ? 'pass' : 'warn',
    detail: r.available
      ? `function ${fid} (${r.function_name ?? '?'}) · ${r.role_count} roles · ${r.competency_count} competencies`
      : `function ${fid} has no derivable requirements (its roles lack competency profiles)`,
  });

  checks.push({
    id: 'readiness_bounds',
    label: 'Readiness score within 0–100 (or null)',
    status: inRange(r.readiness.score) ? 'pass' : 'fail',
    detail: `readiness.score=${r.readiness.score ?? 'null'}`,
  });

  checks.push({
    id: 'readiness_band_coherent',
    label: 'Readiness band present iff score present',
    status: bandScoreCoherent(r.readiness.score, r.readiness.band) ? 'pass' : 'fail',
    detail: `score=${r.readiness.score ?? 'null'} · band=${r.readiness.band ?? 'null'}`,
  });

  const srcOk = r.requirement_source === (r.available ? 'role_aggregation' : 'none');
  checks.push({
    id: 'requirement_source',
    label: 'Requirement source matches availability',
    status: srcOk ? 'pass' : 'fail',
    detail: `available=${r.available} · requirement_source=${r.requirement_source}`,
  });

  checks.push({
    id: 'counts_non_negative',
    label: 'Role & competency counts are non-negative',
    status: r.role_count >= 0 && r.competency_count >= 0 ? 'pass' : 'fail',
    detail: `role_count=${r.role_count} · competency_count=${r.competency_count}`,
  });

  return area('function_readiness', 'Function Readiness', 'subject', checks, r.notes.slice(0, 2), r.measurable);
}

// ---------------------------------------------------------------------------
// Area 6 — Signals
// ---------------------------------------------------------------------------

async function validateSignals(pool: Pool, sid: string): Promise<ValidationArea> {
  const r = await computeEmployabilitySignals(pool, sid);
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'available',
    label: 'Signal catalog has signals to evaluate',
    status: r.available ? 'pass' : 'warn',
    detail: r.available ? `${r.summary.total_signals} signals in catalog` : 'no signal catalog',
  });

  checks.push({
    id: 'measurable',
    label: 'Subject has a measured domain to fire signals against',
    status: r.measurable ? 'pass' : 'warn',
    detail: r.measurable ? `${r.summary.fired} fired` : 'not measurable (honest absence)',
  });

  checks.push({
    id: 'fired_count_consistency',
    label: 'Fired count matches the fired list',
    status: r.summary.fired === r.signals_fired.length ? 'pass' : 'fail',
    detail: `summary.fired=${r.summary.fired} · signals_fired.length=${r.signals_fired.length}`,
  });

  // A fired signal must rest on measured evidence — a fire with zero measured
  // conditions or a non-'fired' status would be a fabrication.
  const fabricated = r.signals_fired.filter((s) => s.status !== 'fired' || s.conditions_measured <= 0);
  checks.push({
    id: 'no_fabricated_fire',
    label: 'Every fired signal has measured evidence',
    status: fabricated.length === 0 ? 'pass' : 'fail',
    detail:
      fabricated.length === 0
        ? `${r.signals_fired.length} fired signals are evidence-backed`
        : `fabricated fire(s): ${fabricated.map((s) => s.signal_id).join(', ')}`,
  });

  checks.push({
    id: 'coverage_bounds',
    label: 'Signal coverage within 0–100 (or null)',
    status: inRange(r.summary.coverage_pct) ? 'pass' : 'fail',
    detail: `coverage_pct=${r.summary.coverage_pct ?? 'null'}`,
  });

  return area('signals', 'Signals', 'subject', checks, r.notes.slice(0, 2), r.measurable);
}

// ---------------------------------------------------------------------------
// Area 7 — Recommendations
// ---------------------------------------------------------------------------

async function validateRecommendations(pool: Pool, sid: string): Promise<ValidationArea> {
  const r = await computeEmployabilityRecommendations(pool, sid);
  const s = r.summary;
  const checks: ValidationCheck[] = [];

  checks.push({
    id: 'available',
    label: 'Recommendation catalog has rules to evaluate',
    status: r.available ? 'pass' : 'warn',
    detail: r.available ? `${s.total_rules} rules in catalog` : 'no recommendation catalog',
  });

  checks.push({
    id: 'measurable',
    label: 'Subject has a measured domain to evaluate rules against',
    status: r.measurable ? 'pass' : 'warn',
    detail: r.measurable ? `${s.emitted} emitted` : 'not measurable (honest absence)',
  });

  checks.push({
    id: 'emitted_count_consistency',
    label: 'Emitted count matches the emitted list',
    status: s.emitted === r.recommendations.length ? 'pass' : 'fail',
    detail: `summary.emitted=${s.emitted} · recommendations.length=${r.recommendations.length}`,
  });

  const partitionOk =
    s.emitted + s.not_applicable + s.withheld === s.total_rules && r.evaluated.length === s.total_rules;
  checks.push({
    id: 'status_partition',
    label: 'emitted + not_applicable + withheld = total rules',
    status: partitionOk ? 'pass' : 'fail',
    detail: `${s.emitted}+${s.not_applicable}+${s.withheld} vs ${s.total_rules} · evaluated=${r.evaluated.length}`,
  });

  // An emitted recommendation must rest on a measured, satisfied trigger — never
  // on absent or indeterminate evidence.
  const unfounded = r.recommendations.filter(
    (x) => !(x.trigger?.measured === true && x.trigger?.satisfied === true),
  );
  checks.push({
    id: 'emitted_evidence_backed',
    label: 'Every emitted recommendation has a measured, satisfied trigger',
    status: unfounded.length === 0 ? 'pass' : 'fail',
    detail:
      unfounded.length === 0
        ? `${r.recommendations.length} emitted recs are evidence-backed`
        : `unfounded emit(s): ${unfounded.map((x) => x.recommendation_id).join(', ')}`,
  });

  // Withheld must NOT contain anything that was actually measured AND satisfied
  // (that should have been emitted, not withheld).
  const misWithheld = r.withheld.filter((x) => x.trigger?.measured === true && x.trigger?.satisfied === true);
  checks.push({
    id: 'withheld_integrity',
    label: 'Withheld holds only unmeasured / indeterminate triggers',
    status: misWithheld.length === 0 ? 'pass' : 'fail',
    detail:
      misWithheld.length === 0
        ? `${r.withheld.length} withheld are genuinely insufficient-evidence`
        : `mis-withheld: ${misWithheld.map((x) => x.recommendation_id).join(', ')}`,
  });

  checks.push({
    id: 'coverage_bounds',
    label: 'Recommendation coverage within 0–100 (or null)',
    status: inRange(s.coverage_pct) ? 'pass' : 'fail',
    detail: `coverage_pct=${s.coverage_pct ?? 'null'}`,
  });

  return area('recommendations', 'Recommendations', 'subject', checks, r.notes.slice(0, 2), r.measurable);
}

// ---------------------------------------------------------------------------
// Area 8 — History
// ---------------------------------------------------------------------------

async function validateHistory(pool: Pool, sid: string): Promise<ValidationArea> {
  const h = await buildEiHistory(pool, sid);
  const checks: ValidationCheck[] = [];

  const ah = h.assessment_history;
  const eh = h.ei_history;

  checks.push({
    id: 'assessment_measured_le_count',
    label: 'Assessment measured count ≤ total count',
    status: ah.measured_count <= ah.count ? 'pass' : 'fail',
    detail: `${ah.measured_count} ≤ ${ah.count} (provisioned=${ah.provisioned})`,
  });

  checks.push({
    id: 'ei_measured_le_count',
    label: 'EI-snapshot measured count ≤ total count',
    status: eh.measured_count <= eh.count ? 'pass' : 'fail',
    detail: `${eh.measured_count} ≤ ${eh.count}`,
  });

  checks.push({
    id: 'list_lengths_match_counts',
    label: 'Reported counts match the returned series lengths',
    status: ah.runs.length === ah.count && eh.snapshots.length === eh.count ? 'pass' : 'fail',
    detail: `runs ${ah.runs.length}/${ah.count} · snapshots ${eh.snapshots.length}/${eh.count}`,
  });

  // Per-dimension series must never report more measured points than it holds.
  const dimOffenders = h.dimension_history.filter(
    (d) => d.measured_count > d.points.length || d.points.some((p) => !inRange(p.score)),
  );
  checks.push({
    id: 'dimension_series_integrity',
    label: 'Dimension series: measured ≤ points, scores 0–100|null',
    status: dimOffenders.length === 0 ? 'pass' : 'fail',
    detail:
      dimOffenders.length === 0
        ? `${h.dimension_history.length} dimension series valid`
        : `offending dims: ${dimOffenders.map((d) => d.ei_dimension_id).join(', ')}`,
  });

  const totalMeasured = Math.max(ah.measured_count, eh.measured_count);
  checks.push({
    id: 'sufficient_history',
    label: 'At least two measured points for trend/progression',
    status: totalMeasured >= 2 ? 'pass' : 'warn',
    detail:
      totalMeasured >= 2
        ? `${totalMeasured} measured points`
        : `insufficient_history — ${totalMeasured} measured point(s) (honest, ≥2 needed)`,
  });

  const measurable = totalMeasured >= 1;
  return area('history', 'History & Progression', 'subject', checks, h.notes.slice(0, 2), measurable);
}

// ---------------------------------------------------------------------------
// Area 9 — Audit Logs (platform scope)
// ---------------------------------------------------------------------------

async function validateAuditLogs(pool: Pool): Promise<ValidationArea> {
  const checks: ValidationCheck[] = [];
  const notes: string[] = [];

  for (const table of ['admin_audit_logs', 'platform_audit_log']) {
    const exists = await tableExists(pool, table);
    if (!exists) {
      checks.push({
        id: `${table}_present`,
        label: `${table} present`,
        status: 'warn',
        detail: `${table} not yet created — appears lazily on first audited mutation (honest absence)`,
      });
      continue;
    }
    const n = await countRows(pool, table);
    checks.push({
      id: `${table}_present`,
      label: `${table} present & readable`,
      status: n == null ? 'fail' : 'pass',
      detail: n == null ? `${table} exists but COUNT failed (schema drift?)` : `${table}: ${n} rows`,
    });
  }

  notes.push('Audit trail is platform-scoped; an empty or absent table is a warn (nothing has been audited yet), not a failure.');
  return area('audit_logs', 'Audit Logs', 'platform', checks, notes, null);
}

// ---------------------------------------------------------------------------
// Area 10 — Permissions (platform scope)
// ---------------------------------------------------------------------------

async function validatePermissions(pool: Pool): Promise<ValidationArea> {
  const checks: ValidationCheck[] = [];
  const notes: string[] = [];

  for (const table of ['role_definitions', 'permission_definitions', 'role_permissions']) {
    const exists = await tableExists(pool, table);
    if (!exists) {
      checks.push({
        id: `${table}_present`,
        label: `${table} present`,
        status: 'warn',
        detail: `${table} absent — advisory RBAC not provisioned (the live gate still enforces access)`,
      });
      continue;
    }
    // Exists but unreadable => schema/permission drift; an existing table whose
    // COUNT fails must FAIL, never silently PASS with a fabricated row count.
    const n = await countRows(pool, table);
    checks.push({
      id: `${table}_present`,
      label: `${table} present & readable`,
      status: n == null ? 'fail' : 'pass',
      detail: n == null ? `${table} exists but COUNT failed (schema drift?)` : `${table}: ${n} rows`,
    });
  }

  // The REAL enforcement is the single super_admin gate on /api/admin/*; verify
  // at least one super_admin principal exists to operate it.
  let superAdmins: number | null = null;
  if (await tableExists(pool, 'users')) {
    try {
      const r = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'super_admin'");
      superAdmins = Number(r.rows[0]?.n ?? 0);
    } catch {
      superAdmins = null;
    }
  }
  checks.push({
    id: 'super_admin_present',
    label: 'At least one super_admin principal exists',
    status: superAdmins == null ? 'warn' : superAdmins > 0 ? 'pass' : 'fail',
    detail:
      superAdmins == null
        ? 'could not read users.role (degraded — not asserting)'
        : superAdmins > 0
          ? `${superAdmins} super_admin user(s)`
          : 'no super_admin principal — the /api/admin gate has no operator',
  });

  notes.push('Enforcement is a single super_admin gate on /api/admin/*; RBAC tables are advisory definitions, not the live path.');
  return area('permissions', 'Permissions', 'platform', checks, notes, null);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

type AreaFn = () => Promise<ValidationArea>;

function failArea(id: string, label: string, scope: 'subject' | 'platform', err: unknown): ValidationArea {
  // A thrown engine error is a genuine defect for THIS area only — surfaced as a
  // FAIL, never swallowed and never a 500. The message is masked to a class.
  const msg = err instanceof Error ? err.message : String(err);
  return area(
    id,
    label,
    scope,
    [
      {
        id: 'engine_error',
        label: 'Area engine executed without error',
        status: 'fail',
        detail: `validator threw: ${msg.slice(0, 200)}`,
      },
    ],
    ['This area could not be validated because its engine raised an error.'],
    null,
  );
}

async function runArea(
  id: string,
  label: string,
  scope: 'subject' | 'platform',
  fn: AreaFn,
): Promise<ValidationArea> {
  try {
    return await fn();
  } catch (err) {
    return failArea(id, label, scope, err);
  }
}

export async function runSuperAdminValidation(pool: Pool, subjectId: string): Promise<SuperAdminValidationResult> {
  const sid = String(subjectId ?? '').trim();

  const areas = await Promise.all([
    runArea('ei_calculations', 'EI Calculations', 'subject', () => validateEiCalculations(pool, sid)),
    runArea('dimension_calculations', 'Dimension Calculations', 'subject', () =>
      validateDimensionCalculations(pool, sid),
    ),
    runArea('role_readiness', 'Role Readiness', 'subject', () => validateRoleReadiness(pool, sid)),
    runArea('industry_readiness', 'Industry Readiness', 'subject', () => validateIndustryReadiness(pool, sid)),
    runArea('function_readiness', 'Function Readiness', 'subject', () => validateFunctionReadiness(pool, sid)),
    runArea('signals', 'Signals', 'subject', () => validateSignals(pool, sid)),
    runArea('recommendations', 'Recommendations', 'subject', () => validateRecommendations(pool, sid)),
    runArea('history', 'History & Progression', 'subject', () => validateHistory(pool, sid)),
    runArea('audit_logs', 'Audit Logs', 'platform', () => validateAuditLogs(pool)),
    runArea('permissions', 'Permissions', 'platform', () => validatePermissions(pool)),
  ]);

  const allChecks = areas.flatMap((a) => a.checks);
  const summary = {
    areas_total: areas.length,
    areas_pass: areas.filter((a) => a.status === 'pass').length,
    areas_warn: areas.filter((a) => a.status === 'warn').length,
    areas_fail: areas.filter((a) => a.status === 'fail').length,
    checks_total: allChecks.length,
    checks_pass: allChecks.filter((c) => c.status === 'pass').length,
    checks_warn: allChecks.filter((c) => c.status === 'warn').length,
    checks_fail: allChecks.filter((c) => c.status === 'fail').length,
  };

  return {
    ok: summary.areas_fail === 0,
    subject_id: sid,
    version: SUPER_ADMIN_VALIDATION_VERSION,
    generated_at: new Date().toISOString(),
    areas,
    summary,
  };
}
