/**
 * Phase 3.10 — EI Dashboard Engine
 * ----------------------------------------------------------------------------
 * A consolidated dashboard that COMPOSES (never recomputes) every prior EI
 * engine exactly once, plus a NEW Trend Analysis sub-engine over the EI profile
 * snapshot history, then projects the single composed result into two
 * audience-scoped views:
 *
 *   - ei_dashboard           → buildEiDashboard      (neutral / full composition)
 *   - candidate_ei_dashboard → buildCandidateEiDashboard (self-facing, encouraging,
 *                              hides admin diagnostics / coverage denominators /
 *                              withheld config ledgers / language-policy debug)
 *   - admin_ei_dashboard     → buildAdminEiDashboard (full + honesty diagnostics:
 *                              coverage axes, withheld/not_applicable ledgers,
 *                              language policy, data-availability flags)
 *
 * Honesty contract:
 *   - Coverage (data exists) and emitted/firing (what triggered) are SEPARATE axes.
 *   - NULL + reason is NEVER coerced to a fabricated 0.
 *   - Trend needs >= 2 measured snapshots, else status 'insufficient_history'
 *     (we never invent a slope from a single point).
 *   - candidate projection redacts diagnostics but NEVER fabricates — an
 *     unmeasured section is honestly surfaced as "not yet measured".
 *
 * Additive · never-throws · flag-gated by the caller (competencyEi / FF_COMPETENCY_EI) ·
 * byte-identical flag-OFF (this file defines NO schema; the route gate keeps it dark).
 */

import type { Pool } from 'pg';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { computeRoleReadinessV2, type RoleReadinessV2 } from './role-readiness-v2.js';
import { listIndustryReadiness, type IndustryReadiness } from './industry-readiness-engine.js';
import { listFunctionReadiness, type FunctionReadiness } from './function-readiness-engine.js';
import { computeEmployabilitySignals } from './employability-signal-engine.js';
import { computeEmployabilityRecommendations } from './ei-recommendation-engine.js';
import { listEiProfileHistory, type EiProfileSnapshotRow } from './ei-profile-history.js';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';

export const EI_DASHBOARD_ENGINE_VERSION = '3.10.0';

const round1 = (n: number) => Math.round(n * 10) / 10;
const STABLE_BAND = 1.0; // points of EI movement considered "stable" (no real change)

// ---------------------------------------------------------------------------
// Trend Analysis sub-engine (PURE — composes the EI profile snapshot history)
// ---------------------------------------------------------------------------

export interface EiTrendPoint {
  snapshot_id: number;
  captured_at: string;
  ei_score: number | null;
  band: string | null;
  confidence_score: number | null;
  strength_count: number;
  development_count: number;
  risk_count: number;
}

export interface EiTrend {
  available: boolean;
  status: 'ready' | 'insufficient_history' | 'unavailable';
  direction: 'improving' | 'declining' | 'stable' | null;
  delta: number | null; // latest.ei_score - first.ei_score (measured points only)
  confidence_delta: number | null;
  strength_delta: number | null;
  development_delta: number | null;
  risk_delta: number | null; // a rising risk count is a concern (not inverted here; raw)
  first: { captured_at: string; ei_score: number | null; band: string | null } | null;
  latest: { captured_at: string; ei_score: number | null; band: string | null } | null;
  snapshots_total: number;
  snapshots_measured: number;
  points: EiTrendPoint[];
  message: string;
}

/**
 * computeEiTrend — pure trend derivation over snapshot rows.
 * Snapshots are user-captured (explicit POST), so this reflects captured
 * history, not a continuous stream. We disclose that and never fabricate a
 * slope from fewer than two MEASURED points.
 */
export function computeEiTrend(rows: EiProfileSnapshotRow[]): EiTrend {
  const all = Array.isArray(rows) ? [...rows] : [];
  // Sort ascending by capture time (history endpoint returns newest-first).
  all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const points: EiTrendPoint[] = all.map((r) => ({
    snapshot_id: r.id,
    captured_at: r.created_at,
    ei_score: r.ei_score, // already null-preserving in mapHeadline
    band: r.ei_band,
    confidence_score: r.confidence_score,
    strength_count: r.strength_count,
    development_count: r.development_count,
    risk_count: r.risk_count,
  }));

  // Only MEASURED points (ei_score present) can anchor a trend. NULL stays NULL.
  const measured = points.filter((p) => p.ei_score != null);

  if (measured.length < 2) {
    return {
      available: false,
      status: 'insufficient_history',
      direction: null,
      delta: null,
      confidence_delta: null,
      strength_delta: null,
      development_delta: null,
      risk_delta: null,
      first: measured[0]
        ? { captured_at: measured[0].captured_at, ei_score: measured[0].ei_score, band: measured[0].band }
        : null,
      latest: measured[0]
        ? { captured_at: measured[0].captured_at, ei_score: measured[0].ei_score, band: measured[0].band }
        : null,
      snapshots_total: points.length,
      snapshots_measured: measured.length,
      points,
      message:
        measured.length === 0
          ? 'No measured snapshots captured yet — trend is unavailable (not fabricated). Capture profile snapshots over time to build a trend.'
          : 'Only one measured snapshot captured — at least two are required to establish a trend (not fabricated).',
    };
  }

  const first = measured[0];
  const latest = measured[measured.length - 1];
  const delta = round1((latest.ei_score as number) - (first.ei_score as number));
  const direction: EiTrend['direction'] =
    delta > STABLE_BAND ? 'improving' : delta < -STABLE_BAND ? 'declining' : 'stable';

  const confidence_delta =
    first.confidence_score != null && latest.confidence_score != null
      ? round1(latest.confidence_score - first.confidence_score)
      : null;

  return {
    available: true,
    status: 'ready',
    direction,
    delta,
    confidence_delta,
    strength_delta: latest.strength_count - first.strength_count,
    development_delta: latest.development_count - first.development_count,
    risk_delta: latest.risk_count - first.risk_count,
    first: { captured_at: first.captured_at, ei_score: first.ei_score, band: first.band },
    latest: { captured_at: latest.captured_at, ei_score: latest.ei_score, band: latest.band },
    snapshots_total: points.length,
    snapshots_measured: measured.length,
    points,
    message: `EI ${direction} by ${Math.abs(delta)} point(s) across ${measured.length} measured snapshot(s) (captured history, not continuous).`,
  };
}

// ---------------------------------------------------------------------------
// Composed dashboard (the ei_dashboard deliverable)
// ---------------------------------------------------------------------------

interface ReadinessRollup {
  assessed: number; // taxonomy entries evaluated
  measurable_count: number; // entries with an actual measured score
  best: { id: string; name: string | null; score: number | null; band: string | null } | null;
  items: { id: string; name: string | null; measurable: boolean; score: number | null; band: string | null }[];
  notes: string[];
}

export interface EiDashboard {
  ok: boolean;
  subject_id: string;
  audience: 'full' | 'candidate' | 'admin';
  version: string;
  generated_at: string;
  measurable: boolean;
  overall_ei: EiProfile['overall_ei'];
  dimensions: EiProfile['dimension_scores'];
  profile_highlights: {
    strengths: EiProfile['strength_areas'];
    development_areas: EiProfile['development_areas'];
    critical_risks: EiProfile['critical_risks'];
    growth_potential: EiProfile['growth_potential'];
  };
  role_readiness: {
    available: boolean;
    role_id: string | null;
    role_title: string | null;
    readiness: RoleReadinessV2['readiness'];
    role_match: RoleReadinessV2['role_match'];
  };
  industry_readiness: ReadinessRollup;
  function_readiness: ReadinessRollup;
  signals: Awaited<ReturnType<typeof computeEmployabilitySignals>>;
  recommendations: Awaited<ReturnType<typeof computeEmployabilityRecommendations>>;
  trend: EiTrend;
  coverage: EiProfile['coverage'];
  confidence: EiProfile['confidence'];
  language_policy: typeof LANGUAGE_POLICY;
  notes: string[];
}

function rollupReadiness(
  items: { id: string; name: string | null; measurable: boolean; readiness: { measured: boolean; score: number | null; band: string | null } }[],
  notes: string[],
): ReadinessRollup {
  const measured = items.filter((i) => i.readiness.measured && i.readiness.score != null);
  let best: ReadinessRollup['best'] = null;
  for (const i of measured) {
    if (best == null || (i.readiness.score as number) > (best.score as number)) {
      best = { id: i.id, name: i.name, score: i.readiness.score, band: i.readiness.band };
    }
  }
  return {
    assessed: items.length,
    measurable_count: measured.length,
    best,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      measurable: i.measurable,
      score: i.readiness.score,
      band: i.readiness.band,
    })),
    notes,
  };
}

/**
 * buildEiDashboard — composes EVERY prior engine exactly once. Each composition
 * is individually guarded so one failing engine degrades only its own section
 * (never-throws contract). The two audience projections consume THIS result —
 * they never re-call the engines.
 */
export async function buildEiDashboard(pool: Pool, subjectId: string): Promise<EiDashboard> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // 1) Overall EI + Dimension Scores + highlights + coverage/confidence ------
  const profile = await buildEiProfile(pool, sid).catch((e: any) => {
    notes.push(`EI profile could not be composed: ${e?.message ?? 'unknown error'} (section degraded, not fabricated).`);
    return null;
  });

  // 2) Role Readiness V2 -----------------------------------------------------
  const roleV2 = await computeRoleReadinessV2(pool, sid).catch(() => null);

  // 3) Industry Readiness ----------------------------------------------------
  const industryList = await listIndustryReadiness(pool, sid).catch(() => null);

  // 4) Function Readiness ----------------------------------------------------
  const functionList = await listFunctionReadiness(pool, sid).catch(() => null);

  // 5) Signals (3.8) ---------------------------------------------------------
  const signals = await computeEmployabilitySignals(pool, sid).catch(() => null);

  // 6) Recommendations (3.9) -------------------------------------------------
  const recommendations = await computeEmployabilityRecommendations(pool, sid).catch(() => null);

  // 7) Trend Analysis (NEW — composes snapshot history) ----------------------
  const history = await listEiProfileHistory(pool, sid).catch(() => [] as EiProfileSnapshotRow[]);
  const trend = computeEiTrend(history);

  const measurable = !!profile?.measurable;
  if (!measurable) {
    notes.push(
      profile?.notes?.[0] ??
        'Subject has no measured employability profile — dashboard sections that require measured scores are honestly unmeasured (not fabricated).',
    );
  }

  const industryRollup = rollupReadiness(
    (industryList?.industries ?? []).map((r: IndustryReadiness) => ({
      id: r.industry_id,
      name: r.industry_name,
      measurable: r.measurable,
      readiness: r.readiness,
    })),
    industryList?.notes ?? ['Industry readiness unavailable — engine degraded (not fabricated).'],
  );

  const functionRollup = rollupReadiness(
    (functionList?.functions ?? []).map((r: FunctionReadiness) => ({
      id: r.function_id,
      name: r.function_name,
      measurable: r.measurable,
      readiness: r.readiness,
    })),
    functionList?.notes ?? ['Function readiness unavailable — engine degraded (not fabricated).'],
  );

  const emptyConfidence = { band: 'low', score: 0, reasons: [] } as unknown as EiProfile['confidence'];

  return {
    ok: true,
    subject_id: sid,
    audience: 'full',
    version: EI_DASHBOARD_ENGINE_VERSION,
    generated_at: new Date().toISOString(),
    measurable,
    overall_ei:
      profile?.overall_ei ?? {
        measurable: false,
        ei_score: null,
        band: null,
        coverage_pct: 0,
        confidence: emptyConfidence,
      },
    dimensions: profile?.dimension_scores ?? [],
    profile_highlights: {
      strengths: profile?.strength_areas ?? [],
      development_areas: profile?.development_areas ?? [],
      critical_risks: profile?.critical_risks ?? [],
      growth_potential:
        profile?.growth_potential ?? ({ level: null, summary: null, drivers: [] } as unknown as EiProfile['growth_potential']),
    },
    role_readiness: {
      available: !!roleV2 && roleV2.readiness.measured,
      role_id: roleV2?.role_id ?? profile?.role_id ?? null,
      role_title: roleV2?.role_title ?? null,
      readiness: roleV2?.readiness ?? { measured: false, score: null, band: null, label: null, coverage_pct: null },
      role_match:
        roleV2?.role_match ?? ({ fit_band: 'unmeasured', label: 'Unmeasured', score: null, capped_by_critical: false } as RoleReadinessV2['role_match']),
    },
    industry_readiness: industryRollup,
    function_readiness: functionRollup,
    signals:
      signals ??
      ({
        ok: true,
        subject_id: sid,
        signals: [],
        summary: { total_signals: 0, fired: 0, positive_fired: 0, risk_fired: 0, indeterminate: 0, coverage_pct: null },
        notes: ['Signals engine degraded — unavailable (not fabricated).'],
      } as any),
    recommendations:
      recommendations ??
      ({
        ok: true,
        subject_id: sid,
        recommendations: [],
        not_applicable: [],
        withheld: [],
        summary: { total_rules: 0, emitted: 0, not_applicable: 0, withheld: 0, coverage_pct: null },
        notes: ['Recommendation engine degraded — unavailable (not fabricated).'],
      } as any),
    trend,
    coverage: profile?.coverage ?? { dimensions_total: 0, dimensions_measurable: 0, coverage_pct: 0 },
    confidence: profile?.confidence ?? emptyConfidence,
    language_policy: LANGUAGE_POLICY,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Audience projections (PURE — consume one composed EiDashboard, no re-call)
// ---------------------------------------------------------------------------

export interface CandidateEiDashboard {
  ok: boolean;
  subject_id: string;
  audience: 'candidate';
  version: string;
  generated_at: string;
  measurable: boolean;
  status: 'ready' | 'unmeasured';
  headline: {
    overall_ei: number | null;
    band: string | null;
    summary: string;
  };
  dimensions: { id: string; name: string; score: number | null; band: string | null }[];
  top_strengths: EiProfile['strength_areas'];
  focus_areas: EiProfile['development_areas'];
  growth_potential: EiProfile['growth_potential'];
  role_readiness: { role_title: string | null; band: string | null; label: string | null; fit: string };
  industry_best: ReadinessRollup['best'];
  function_best: ReadinessRollup['best'];
  supportive_signals: { id: string; label: string; kind: string; meaning: string }[];
  recommendations: { category: string; priority: string | number; title: string; summary: string }[];
  trend: {
    available: boolean;
    direction: EiTrend['direction'];
    delta: number | null;
    points: { captured_at: string; ei_score: number | null; band: string | null }[];
    message: string;
  };
  disclaimer: string;
}

/**
 * buildCandidateEiDashboard — self-facing projection. Encouraging, actionable,
 * and honest: it hides admin diagnostics (coverage denominators, withheld config
 * ledgers, language-policy debug, confidence internals) but NEVER fabricates an
 * unmeasured value — those surface as a friendly "not yet measured".
 */
export function projectCandidate(full: EiDashboard): CandidateEiDashboard {
  const measurable = full.measurable;
  const recs = (full.recommendations?.recommendations ?? []).map((r: any) => ({
    category: r.category,
    priority: r.priority ?? 'standard',
    title: r.title,
    summary: r.description,
  }));

  const supportive = (full.signals?.signals ?? [])
    .filter((s: any) => s.fired === true)
    .map((s: any) => ({
      id: s.signal_id,
      label: s.name,
      kind: s.polarity,
      meaning: s.rationale ?? '',
    }));

  return {
    ok: true,
    subject_id: full.subject_id,
    audience: 'candidate',
    version: full.version,
    generated_at: full.generated_at,
    measurable,
    status: measurable ? 'ready' : 'unmeasured',
    headline: {
      overall_ei: full.overall_ei.ei_score,
      band: full.overall_ei.band,
      summary: measurable
        ? `Your overall employability indicator is ${full.overall_ei.ei_score} (${full.overall_ei.band}). This is a developmental snapshot you can grow.`
        : 'Complete an assessment to generate your employability dashboard — nothing is shown until it can be honestly measured.',
    },
    dimensions: (full.dimensions ?? []).map((d) => ({
      id: d.ei_dimension_id,
      name: d.dimension_name,
      score: d.score,
      band: d.band,
    })),
    top_strengths: (full.profile_highlights.strengths ?? []).slice(0, 3),
    focus_areas: (full.profile_highlights.development_areas ?? []).slice(0, 3),
    growth_potential: full.profile_highlights.growth_potential,
    role_readiness: {
      role_title: full.role_readiness.role_title,
      band: full.role_readiness.readiness.band,
      label: full.role_readiness.readiness.label,
      fit: full.role_readiness.role_match.fit_band,
    },
    industry_best: full.industry_readiness.best,
    function_best: full.function_readiness.best,
    supportive_signals: supportive,
    recommendations: recs,
    trend: {
      available: full.trend.available,
      direction: full.trend.direction,
      delta: full.trend.delta,
      points: full.trend.points.map((p) => ({ captured_at: p.captured_at, ei_score: p.ei_score, band: p.band })),
      message: full.trend.message,
    },
    disclaimer:
      'These are developmental signals to guide your growth — never a hiring, promotion, or suitability prediction.',
  };
}

export interface AdminEiDashboard extends EiDashboard {
  audience: 'admin';
  diagnostics: {
    profile: { measurable: boolean; coverage_pct: number; confidence_band: string };
    role_readiness: { available: boolean; coverage_pct: number | null };
    industry_readiness: { assessed: number; measurable_count: number };
    function_readiness: { assessed: number; measurable_count: number };
    signals: { total: number; fired: number; coverage_pct: number | null };
    recommendations: { emitted: number; not_applicable: number; withheld: number; coverage_pct: number | null };
    trend: { status: EiTrend['status']; snapshots_total: number; snapshots_measured: number };
    data_availability: { section: string; available: boolean; reason: string | null }[];
  };
}

/**
 * buildAdminEiDashboard — full honesty view. Returns the entire composed
 * dashboard PLUS an explicit diagnostics block (coverage axes, ledger counts,
 * data-availability flags) so an operator can see Coverage vs firing separately.
 */
export function projectAdmin(full: EiDashboard): AdminEiDashboard {
  const sig: any = full.signals?.summary ?? {};
  const rec: any = full.recommendations?.summary ?? {};

  return {
    ...full,
    audience: 'admin',
    diagnostics: {
      profile: {
        measurable: full.measurable,
        coverage_pct: full.coverage?.coverage_pct ?? 0,
        confidence_band: (full.confidence as any)?.band ?? 'low',
      },
      role_readiness: {
        available: full.role_readiness.available,
        coverage_pct: full.role_readiness.readiness.coverage_pct,
      },
      industry_readiness: {
        assessed: full.industry_readiness.assessed,
        measurable_count: full.industry_readiness.measurable_count,
      },
      function_readiness: {
        assessed: full.function_readiness.assessed,
        measurable_count: full.function_readiness.measurable_count,
      },
      signals: { total: sig.total_signals ?? 0, fired: sig.fired ?? 0, coverage_pct: sig.coverage_pct ?? null },
      recommendations: {
        emitted: rec.emitted ?? 0,
        not_applicable: rec.not_applicable ?? 0,
        withheld: rec.withheld ?? 0,
        coverage_pct: rec.coverage_pct ?? null,
      },
      trend: {
        status: full.trend.status,
        snapshots_total: full.trend.snapshots_total,
        snapshots_measured: full.trend.snapshots_measured,
      },
      data_availability: [
        { section: 'overall_ei', available: full.measurable, reason: full.measurable ? null : 'no measured profile' },
        {
          section: 'role_readiness',
          available: full.role_readiness.available,
          reason: full.role_readiness.available ? null : 'role unmeasured or absent',
        },
        {
          section: 'industry_readiness',
          available: full.industry_readiness.measurable_count > 0,
          reason: full.industry_readiness.measurable_count > 0 ? null : 'no measurable industries',
        },
        {
          section: 'function_readiness',
          available: full.function_readiness.measurable_count > 0,
          reason: full.function_readiness.measurable_count > 0 ? null : 'no measurable functions',
        },
        {
          section: 'signals',
          available: (sig.total_signals ?? 0) > 0,
          reason: (sig.total_signals ?? 0) > 0 ? null : 'signals engine degraded',
        },
        {
          section: 'recommendations',
          available: (rec.total_rules ?? 0) > 0,
          reason: (rec.total_rules ?? 0) > 0 ? null : 'recommendation engine degraded',
        },
        {
          section: 'trend',
          available: full.trend.available,
          reason: full.trend.available ? null : full.trend.status,
        },
      ],
    },
  };
}

/** Convenience composers — compose ONCE, then project (compose-never-recompute). */
export async function buildCandidateEiDashboard(pool: Pool, subjectId: string): Promise<CandidateEiDashboard> {
  const full = await buildEiDashboard(pool, subjectId);
  return projectCandidate(full);
}

export async function buildAdminEiDashboard(pool: Pool, subjectId: string): Promise<AdminEiDashboard> {
  const full = await buildEiDashboard(pool, subjectId);
  return projectAdmin(full);
}
