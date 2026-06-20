/**
 * PHASE 4.10 — Career Signal Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built
 * competency runtime (getProfile), EI profile (buildEiProfile), Phase-4.3
 * career readiness (buildCareerReadiness) and Phase-4.4 career gap
 * (buildCareerGap) engines into SEVEN developmental Career Signals:
 *
 *   Potential signals (higher = more developed):
 *     - Career Potential       — blended competency + readiness + EI
 *     - Leadership Potential   — leadership/behavioural competency + EI
 *     - Technical Potential    — technical/functional competency domain
 *     - Growth Potential       — composed DIRECTLY from EI growth_potential
 *     - Promotion Potential    — role/overall readiness + competency (DEV signal)
 *   Risk signals (higher = more development concern):
 *     - Career Risk            — readiness deficit + gap pressure
 *     - Career Stagnation Risk — growth deficit + longitudinal shallowness
 *
 * Honesty contract (non-negotiable, carried from Phase 3/4):
 *   - COMPOSES already-computed scores — it NEVER recomputes a competency / EI /
 *     readiness / gap score and NEVER fabricates a value. A signal whose declared
 *     inputs are all absent is honestly `measurable:false` with `score:null`.
 *   - Coverage (fraction of a signal's declared inputs that have REAL data) and
 *     Confidence (inherited from the weakest contributing source's band — never
 *     re-derived) are reported as TWO SEPARATE axes, never composited.
 *   - DEVELOPMENTAL SIGNALS ONLY. Even "Promotion Potential" is a developmental
 *     readiness indicator, NOT a hiring/promotion/suitability prediction — the
 *     composed engines' LANGUAGE_POLICY is surfaced unchanged and every signal
 *     carries an explicit `not_a_prediction` interpretation cap.
 *   - Config-as-data: career_signal_library (signal catalogue) and
 *     career_signal_rules (weights/bands/language) OVERRIDE the in-code defaults
 *     WHEN PRESENT. The read path probes both with to_regclass and falls back to
 *     the defaults — it NEVER CREATEs schema (GET-never-writes). The only write/
 *     DDL path is the admin CRUD (ensureCareerSignalConfigSchema), behind the gate.
 *   - Read-only & never-throws: every source call is guarded so one failing
 *     source degrades its inputs to honest-absent, never the whole envelope.
 *
 * GET-never-writes trap (see .agents/memory/career-passport-foundation-readonly.md):
 *   getProfile, buildEiProfile AND buildCareerReadiness ALL transitively call
 *   ensureCompetencyRuntimeSchema (CREATE TABLE …). They are invoked ONLY when
 *   competencyRuntimeReady(pool) is true; absent schema => all null + honest note,
 *   ZERO DDL on a read. buildCareerGap self-gates the same way.
 *
 * Byte-identical flag-OFF is enforced by the route gate (503 before any call here).
 */

import type { Pool } from 'pg';
import { LANGUAGE_POLICY } from './competency-ei-scoring-shared.js';
import { competencyRuntimeReady } from './career-gap-engine.js';
import { getProfile, type ProfileView } from './competency-runtime.js';
import { buildEiProfile, type EiProfile } from './ei-profile-engine.js';
import { buildCareerReadiness, type CareerReadinessEnvelope } from './career-readiness-aggregator.js';
import { buildCareerGap, type CareerGapEnvelope } from './career-gap-engine.js';

export const CAREER_SIGNAL_VERSION = '4.10.0';

// ---------------------------------------------------------------------------
// Config model (config-as-data with in-code defaults).
// ---------------------------------------------------------------------------

export type SignalCategory = 'potential' | 'risk';

/** Where a signal input is sourced from + how it is transformed before blending. */
export interface SignalInputSpec {
  input_key: string;
  /** Human label for the contribution. */
  label: string;
  /** Source engine. */
  source: 'competency' | 'ei' | 'readiness' | 'gap';
  /** Metric within the source (resolved by getMetric). */
  metric: string;
  /** Relative weight within the signal (only PRESENT inputs are blended). */
  weight: number;
  /** `direct` = value as-is; `invert` = 100 - value (deficit). */
  transform: 'direct' | 'invert';
}

export interface SignalDefinition {
  signal_key: string;
  label: string;
  category: SignalCategory;
  description: string;
  inputs: SignalInputSpec[];
  display_order: number;
  active: boolean;
}

export interface SignalBandRule {
  /** Inclusive lower bound (0..100). Evaluated high → low. */
  min: number;
  label: string;
}

export interface SignalRules {
  version: string;
  bands: Record<SignalCategory, SignalBandRule[]>;
  /** Per-signal-category interpretation caps surfaced on every signal. */
  interpretation: Record<SignalCategory, string>;
}

// ---- In-code defaults (the canonical seven signals + default rules) --------

export const DEFAULT_SIGNAL_LIBRARY: SignalDefinition[] = [
  {
    signal_key: 'career_potential',
    label: 'Career Potential',
    category: 'potential',
    description:
      'Composite developmental potential blended from measured competency, present career readiness and emotional-intelligence signals.',
    display_order: 1,
    active: true,
    inputs: [
      { input_key: 'competency_overall', label: 'Competency profile', source: 'competency', metric: 'overall', weight: 0.4, transform: 'direct' },
      { input_key: 'readiness_overall', label: 'Career readiness', source: 'readiness', metric: 'overall', weight: 0.35, transform: 'direct' },
      { input_key: 'ei_overall', label: 'Emotional intelligence', source: 'ei', metric: 'overall', weight: 0.25, transform: 'direct' },
    ],
  },
  {
    signal_key: 'leadership_potential',
    label: 'Leadership Potential',
    category: 'potential',
    description:
      'Developmental leadership signal from the behavioural/leadership competency domain combined with the emotional-intelligence profile.',
    display_order: 2,
    active: true,
    inputs: [
      { input_key: 'leadership_domain', label: 'Leadership / behavioural competency', source: 'competency', metric: 'domain:leadership', weight: 0.6, transform: 'direct' },
      { input_key: 'ei_overall', label: 'Emotional intelligence', source: 'ei', metric: 'overall', weight: 0.4, transform: 'direct' },
    ],
  },
  {
    signal_key: 'technical_potential',
    label: 'Technical Potential',
    category: 'potential',
    description:
      'Developmental technical signal from the technical/functional competency domain.',
    display_order: 3,
    active: true,
    inputs: [
      { input_key: 'technical_domain', label: 'Technical / functional competency', source: 'competency', metric: 'domain:technical', weight: 1.0, transform: 'direct' },
    ],
  },
  {
    signal_key: 'growth_potential',
    label: 'Growth Potential',
    category: 'potential',
    description:
      'Composed directly from the EI engine growth-potential headroom (weighted-mean improvable-dimension headroom). Never recomputed.',
    display_order: 4,
    active: true,
    inputs: [
      { input_key: 'ei_growth', label: 'EI growth headroom', source: 'ei', metric: 'growth', weight: 1.0, transform: 'direct' },
    ],
  },
  {
    signal_key: 'promotion_potential',
    label: 'Promotion Potential',
    category: 'potential',
    description:
      'DEVELOPMENTAL promotion-readiness signal from role + overall readiness and the competency profile. Not a promotion decision or prediction.',
    display_order: 5,
    active: true,
    inputs: [
      { input_key: 'readiness_role', label: 'Role readiness', source: 'readiness', metric: 'role', weight: 0.45, transform: 'direct' },
      { input_key: 'readiness_overall', label: 'Overall readiness', source: 'readiness', metric: 'overall', weight: 0.3, transform: 'direct' },
      { input_key: 'competency_overall', label: 'Competency profile', source: 'competency', metric: 'overall', weight: 0.25, transform: 'direct' },
    ],
  },
  {
    signal_key: 'career_risk',
    label: 'Career Risk',
    category: 'risk',
    description:
      'Developmental risk signal = present-readiness deficit (inverted readiness) blended with gap pressure (share of role gaps that are critical/blocking).',
    display_order: 6,
    active: true,
    inputs: [
      { input_key: 'readiness_deficit', label: 'Readiness deficit', source: 'readiness', metric: 'overall', weight: 0.5, transform: 'invert' },
      { input_key: 'gap_pressure', label: 'Gap pressure', source: 'gap', metric: 'pressure', weight: 0.5, transform: 'direct' },
    ],
  },
  {
    signal_key: 'career_stagnation_risk',
    label: 'Career Stagnation Risk',
    category: 'risk',
    description:
      'Developmental stagnation signal = growth-headroom deficit (inverted EI growth) with a longitudinal-shallowness caveat (few repeat assessments → weak progression evidence).',
    display_order: 7,
    active: true,
    inputs: [
      { input_key: 'growth_deficit', label: 'Growth headroom deficit', source: 'ei', metric: 'growth', weight: 0.7, transform: 'invert' },
      { input_key: 'longitudinal_shallowness', label: 'Longitudinal shallowness', source: 'competency', metric: 'longitudinal_shallowness', weight: 0.3, transform: 'direct' },
    ],
  },
];

export const DEFAULT_SIGNAL_RULES: SignalRules = {
  version: CAREER_SIGNAL_VERSION,
  bands: {
    potential: [
      { min: 75, label: 'High' },
      { min: 50, label: 'Moderate' },
      { min: 25, label: 'Emerging' },
      { min: 0, label: 'Early' },
    ],
    risk: [
      { min: 66, label: 'High Risk' },
      { min: 33, label: 'Moderate Risk' },
      { min: 0, label: 'Low Risk' },
    ],
  },
  interpretation: {
    potential:
      'Developmental potential signal only — indicates relative development, not a hiring/promotion/suitability prediction.',
    risk:
      'Developmental risk signal only — flags areas to develop, not a performance/termination/suitability prediction.',
  },
};

// ---------------------------------------------------------------------------
// Output model
// ---------------------------------------------------------------------------

export interface SignalInputContribution {
  input_key: string;
  label: string;
  source: string;
  metric: string;
  weight: number;
  transform: 'direct' | 'invert';
  present: boolean;
  /** Raw source value (0..100) before transform, null when absent. */
  raw_value: number | null;
  /** Value actually blended (post-transform), null when absent. */
  contribution: number | null;
}

export interface CareerSignal {
  signal_key: string;
  label: string;
  category: SignalCategory;
  description: string;
  measurable: boolean;
  /** Weighted mean over PRESENT inputs (0..100), null when no input present. */
  score: number | null;
  band: string | null;
  inputs: SignalInputContribution[];
  coverage: {
    measurable: boolean;
    /** present inputs / declared inputs (0..100). */
    coverage_pct: number;
    inputs_present: number;
    inputs_total: number;
    detail: string;
  };
  confidence: {
    band: string;
    /** 0..1 when a source exposes a numeric confidence; otherwise null. */
    value: number | null;
    basis: string;
    caps: string[];
  };
  interpretation: string;
}

export interface CareerSignalEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  signals: CareerSignal[];
  summary: {
    signals_total: number;
    signals_measurable: number;
    coverage_pct: number;
    top_potential: { signal_key: string; label: string; score: number } | null;
    top_risk: { signal_key: string; label: string; score: number } | null;
  };
  config_source: { library: 'db' | 'defaults'; rules: 'db' | 'defaults' };
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Composed sources (resolved ONCE per build, all guarded + runtime-gated).
// ---------------------------------------------------------------------------

interface ComposedSources {
  competency: ProfileView | null;
  ei: EiProfile | null;
  readiness: CareerReadinessEnvelope | null;
  gap: CareerGapEnvelope | null;
  runtimeReady: boolean;
}

function clampScore(n: unknown): number | null {
  // Guard null/undefined/'' explicitly — Number(null) === 0 (finite) would
  // otherwise silently fabricate a measured 0 from an honest-absent value.
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, v));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const LEADERSHIP_RE = /lead|behav|interpers|people|relationship|social|influence|communicat/i;
const TECHNICAL_RE = /tech|digital|function|domain|analy|data|cognit|problem|technical/i;

/** Pick a competency domain scaled_score by keyword over label + onto_domain.
 *  Returns null (honest-absent) when no domain matches — never fabricated. */
function domainScore(profile: ProfileView | null, re: RegExp): number | null {
  if (!profile?.domain_scores?.length) return null;
  const match = profile.domain_scores.find(
    (d) => re.test(String(d.label ?? '')) || re.test(String(d.onto_domain ?? '')),
  );
  return match ? clampScore(match.scaled_score) : null;
}

/** Gap pressure (0..100): share of measured role gaps that are critical OR
 *  blocking. Fully grounded in Phase-4.4 counts — no magic multipliers. Absent
 *  when gaps are not measurable; 0 (no pressure) when measurable with no gaps. */
function gapPressure(gap: CareerGapEnvelope | null): number | null {
  if (!gap?.measurable) return null;
  const total = Number(gap.summary?.total_gaps ?? 0);
  if (total <= 0) return 0;
  const critical = Number(gap.summary?.total_critical ?? 0);
  const blocking = Number(gap.summary?.total_blocking ?? 0);
  // Severe = union proxy via max(critical, blocking) so a gap counted in both
  // axes is not double-weighted beyond the total. Bounded to [0,100].
  const severe = Math.max(critical, blocking);
  return clampScore((severe / total) * 100);
}

/** Longitudinal shallowness (0..100): few repeat competency assessments => weak
 *  progression evidence => higher stagnation-risk caveat. Grounded in the real
 *  history_count; null when no competency profile exists at all. */
function longitudinalShallowness(profile: ProfileView | null): number | null {
  if (!profile?.measured) return null;
  const n = Number(profile.history_count ?? 0);
  if (!Number.isFinite(n) || n <= 1) return 100; // single (or no) datapoint — no progression evidence
  if (n === 2) return 50;
  return 0; // ≥3 assessments — longitudinal evidence present
}

/** Resolve a (source, metric) pair to a raw 0..100 value (or null = absent). */
function getMetric(sources: ComposedSources, source: string, metric: string): number | null {
  switch (source) {
    case 'competency': {
      const p = sources.competency;
      if (!p) return null;
      if (metric === 'overall') return p.measured ? clampScore(p.overall_score) : null;
      if (metric === 'longitudinal_shallowness') return longitudinalShallowness(p);
      if (metric.startsWith('domain:')) {
        const which = metric.slice('domain:'.length);
        if (which === 'leadership') return domainScore(p, LEADERSHIP_RE);
        if (which === 'technical') return domainScore(p, TECHNICAL_RE);
        return null;
      }
      return null;
    }
    case 'ei': {
      const e = sources.ei;
      if (!e) return null;
      if (metric === 'overall') return e.overall_ei?.measurable ? clampScore(e.overall_ei.ei_score) : null;
      if (metric === 'growth') return clampScore(e.growth_potential?.score);
      return null;
    }
    case 'readiness': {
      const r = sources.readiness;
      if (!r) return null;
      if (metric === 'overall') return r.overall?.measurable ? clampScore(r.overall.score) : null;
      if (metric === 'role') return r.role?.measurable ? clampScore(r.role.score) : null;
      if (metric === 'future') return r.future?.measurable ? clampScore(r.future.score) : null;
      if (metric === 'current') return r.current?.measurable ? clampScore(r.current.score) : null;
      return null;
    }
    case 'gap': {
      if (metric === 'pressure') return gapPressure(sources.gap);
      return null;
    }
    default:
      return null;
  }
}

/** Inherited confidence for a signal: weakest band among contributing sources.
 *  Confidence is NEVER re-derived — it is read from the composed engines. */
function inheritConfidence(
  def: SignalDefinition,
  present: Set<string>,
  sources: ComposedSources,
): CareerSignal['confidence'] {
  if (present.size === 0) {
    return { band: 'None', value: null, basis: 'no measurable input', caps: ['not_measurable'] };
  }
  const bandRank: Record<string, number> = { None: 0, Low: 1, Moderate: 2, Medium: 2, High: 3 };
  const caps = new Set<string>();
  let weakestBand = 'High';
  let weakestRank = 99;
  let numericValue: number | null = null;

  const usedSources = new Set(def.inputs.filter((i) => present.has(i.input_key)).map((i) => i.source));
  for (const src of usedSources) {
    let band: string | null = null;
    if (src === 'competency') {
      band = sources.competency?.measured ? 'Moderate' : null; // domain_proxy measurement
      if (band) caps.add('domain_proxy');
    } else if (src === 'ei') {
      band = sources.ei?.overall_ei?.confidence?.band ?? sources.ei?.confidence?.band ?? null;
      const c = sources.ei?.overall_ei?.confidence?.caps ?? sources.ei?.confidence?.caps;
      if (Array.isArray(c)) c.forEach((x) => caps.add(String(x)));
    } else if (src === 'readiness') {
      band = sources.readiness?.overall?.axes?.confidence?.band ?? null;
      const v = sources.readiness?.overall?.axes?.confidence?.value;
      if (typeof v === 'number') numericValue = numericValue == null ? v : Math.min(numericValue, v);
      const c = sources.readiness?.overall?.axes?.confidence?.caps;
      if (Array.isArray(c)) c.forEach((x) => caps.add(String(x)));
    } else if (src === 'gap') {
      band = sources.gap?.axes?.confidence?.band ?? null;
      const v = sources.gap?.axes?.confidence?.value;
      if (typeof v === 'number') numericValue = numericValue == null ? v : Math.min(numericValue, v);
      const c = sources.gap?.axes?.confidence?.caps;
      if (Array.isArray(c)) c.forEach((x) => caps.add(String(x)));
    }
    if (band) {
      const rank = bandRank[band] ?? 1;
      if (rank < weakestRank) {
        weakestRank = rank;
        weakestBand = band;
      }
    }
  }
  if (weakestRank === 99) weakestBand = 'Low';
  return {
    band: weakestBand,
    value: numericValue,
    basis: 'inherited from the weakest contributing source (never re-derived)',
    caps: Array.from(caps),
  };
}

function bandFor(rules: SignalRules, category: SignalCategory, score: number): string {
  const bands = [...(rules.bands[category] ?? [])].sort((a, b) => b.min - a.min);
  for (const b of bands) if (score >= b.min) return b.label;
  return bands.length ? bands[bands.length - 1].label : 'Unbanded';
}

// ---------------------------------------------------------------------------
// Config loader (read-only; to_regclass probe; falls back to defaults).
// ---------------------------------------------------------------------------

async function loadSignalLibrary(
  pool: Pool,
): Promise<{ library: SignalDefinition[]; source: 'db' | 'defaults' }> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_signal_library') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { library: DEFAULT_SIGNAL_LIBRARY, source: 'defaults' };
  const r = await pool
    .query(
      `SELECT signal_key, label, category, description, inputs, display_order, active
         FROM career_signal_library WHERE active = TRUE ORDER BY display_order ASC, signal_key ASC`,
    )
    .catch(() => ({ rows: [] as any[] }));
  if (!r.rows.length) return { library: DEFAULT_SIGNAL_LIBRARY, source: 'defaults' };
  const valid = new Set<SignalCategory>(['potential', 'risk']);
  const out: SignalDefinition[] = [];
  for (const row of r.rows as Array<Record<string, unknown>>) {
    const cat = String(row.category) as SignalCategory;
    if (!valid.has(cat)) continue;
    let inputs: SignalInputSpec[] = [];
    try {
      const raw = typeof row.inputs === 'string' ? JSON.parse(row.inputs) : row.inputs;
      if (Array.isArray(raw)) inputs = raw as SignalInputSpec[];
    } catch {
      inputs = [];
    }
    out.push({
      signal_key: String(row.signal_key),
      label: String(row.label),
      category: cat,
      description: String(row.description ?? ''),
      inputs,
      display_order: Number(row.display_order ?? 0),
      active: row.active !== false,
    });
  }
  return out.length ? { library: out, source: 'db' } : { library: DEFAULT_SIGNAL_LIBRARY, source: 'defaults' };
}

async function loadSignalRules(pool: Pool): Promise<{ rules: SignalRules; source: 'db' | 'defaults' }> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_signal_rules') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { rules: DEFAULT_SIGNAL_RULES, source: 'defaults' };
  const r = await pool
    .query(
      `SELECT bands, interpretation, version FROM career_signal_rules
        WHERE active = TRUE ORDER BY updated_at DESC, id DESC LIMIT 1`,
    )
    .catch(() => ({ rows: [] as any[] }));
  if (!r.rows.length) return { rules: DEFAULT_SIGNAL_RULES, source: 'defaults' };
  const row = r.rows[0] as Record<string, unknown>;
  try {
    const bands = typeof row.bands === 'string' ? JSON.parse(row.bands) : row.bands;
    const interpretation =
      typeof row.interpretation === 'string' ? JSON.parse(row.interpretation) : row.interpretation;
    const rules: SignalRules = {
      version: String(row.version ?? CAREER_SIGNAL_VERSION),
      bands: bands?.potential && bands?.risk ? bands : DEFAULT_SIGNAL_RULES.bands,
      interpretation:
        interpretation?.potential && interpretation?.risk
          ? interpretation
          : DEFAULT_SIGNAL_RULES.interpretation,
    };
    return { rules, source: 'db' };
  } catch {
    return { rules: DEFAULT_SIGNAL_RULES, source: 'defaults' };
  }
}

// ---------------------------------------------------------------------------
// Engine — compose the four sources ONCE, then evaluate every signal.
// ---------------------------------------------------------------------------

export async function buildCareerSignals(
  pool: Pool,
  subjectId: string,
): Promise<CareerSignalEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // GET-never-writes: getProfile, buildEiProfile and buildCareerReadiness ALL
  // transitively call ensureCompetencyRuntimeSchema (DDL). Gate every one behind
  // the read-only runtime probe so a GET can NEVER create schema.
  const runtimeReady = await competencyRuntimeReady(pool);
  let competency: ProfileView | null = null;
  let ei: EiProfile | null = null;
  let readiness: CareerReadinessEnvelope | null = null;
  let gap: CareerGapEnvelope | null = null;

  if (!runtimeReady) {
    notes.push(
      'Career signals not measurable — competency runtime schema is not initialized (read-only; no schema created).',
    );
  } else {
    competency = await getProfile(pool, sid).catch((e) => {
      notes.push(`Competency profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    ei = await buildEiProfile(pool, sid).catch((e) => {
      notes.push(`EI profile unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    readiness = await buildCareerReadiness(pool, sid).catch((e) => {
      notes.push(`Career readiness unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
    // buildCareerGap self-gates the runtime probe and degrades internally.
    gap = await buildCareerGap(pool, sid).catch((e) => {
      notes.push(`Career gap unavailable: ${e?.message ?? 'error'} (honest empty).`);
      return null;
    });
  }

  const sources: ComposedSources = { competency, ei, readiness, gap, runtimeReady };

  const [{ library, source: librarySource }, { rules, source: rulesSource }] = await Promise.all([
    loadSignalLibrary(pool),
    loadSignalRules(pool),
  ]);

  const signals: CareerSignal[] = [];
  for (const def of [...library].sort((a, b) => a.display_order - b.display_order)) {
    const present = new Set<string>();
    let weightSum = 0;
    let weighted = 0;
    const inputs: SignalInputContribution[] = def.inputs.map((spec) => {
      const raw = getMetric(sources, spec.source, spec.metric);
      const isPresent = raw != null;
      let contribution: number | null = null;
      if (isPresent) {
        contribution = spec.transform === 'invert' ? clampScore(100 - raw) : raw;
        if (contribution != null && spec.weight > 0) {
          present.add(spec.input_key);
          weightSum += spec.weight;
          weighted += contribution * spec.weight;
        }
      }
      return {
        input_key: spec.input_key,
        label: spec.label,
        source: spec.source,
        metric: spec.metric,
        weight: spec.weight,
        transform: spec.transform,
        present: isPresent,
        raw_value: raw,
        contribution,
      };
    });

    const measurable = weightSum > 0;
    const score = measurable ? round1(weighted / weightSum) : null;
    const inputsTotal = def.inputs.length;
    const inputsPresent = present.size;
    const coveragePct = inputsTotal > 0 ? Math.round((inputsPresent / inputsTotal) * 100) : 0;

    signals.push({
      signal_key: def.signal_key,
      label: def.label,
      category: def.category,
      description: def.description,
      measurable,
      score,
      band: measurable && score != null ? bandFor(rules, def.category, score) : null,
      inputs,
      coverage: {
        measurable,
        coverage_pct: coveragePct,
        inputs_present: inputsPresent,
        inputs_total: inputsTotal,
        detail: measurable
          ? `${inputsPresent}/${inputsTotal} declared inputs backed by real data`
          : 'no declared input has real data — signal not measurable',
      },
      confidence: inheritConfidence(def, present, sources),
      interpretation: rules.interpretation[def.category],
    });
  }

  const measurableSignals = signals.filter((s) => s.measurable);
  const potentials = measurableSignals.filter((s) => s.category === 'potential' && s.score != null);
  const risks = measurableSignals.filter((s) => s.category === 'risk' && s.score != null);
  const topPotential = potentials.length
    ? potentials.reduce((a, b) => (b.score! > a.score! ? b : a))
    : null;
  const topRisk = risks.length ? risks.reduce((a, b) => (b.score! > a.score! ? b : a)) : null;

  const source_versions: Record<string, string> = {
    career_signal: CAREER_SIGNAL_VERSION,
    signal_rules: rules.version,
  };
  if (competency) source_versions.competency = 'domain_proxy';
  if (ei) source_versions.ei_profile = ei.version;
  if (readiness) source_versions.career_readiness = readiness.version;
  if (gap) source_versions.career_gap = gap.version;

  if (runtimeReady && measurableSignals.length === 0) {
    notes.push(
      'No signal is measurable — no competency / EI / readiness / gap data exists for this subject (honest absence, nothing fabricated).',
    );
  }

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_SIGNAL_VERSION,
    generated_at: new Date().toISOString(),
    measurable: measurableSignals.length > 0,
    signals,
    summary: {
      signals_total: signals.length,
      signals_measurable: measurableSignals.length,
      coverage_pct: signals.length ? Math.round((measurableSignals.length / signals.length) * 100) : 0,
      top_potential: topPotential
        ? { signal_key: topPotential.signal_key, label: topPotential.label, score: topPotential.score! }
        : null,
      top_risk: topRisk
        ? { signal_key: topRisk.signal_key, label: topRisk.label, score: topRisk.score! }
        : null,
    },
    config_source: { library: librarySource, rules: rulesSource },
    language_policy:
      ei?.language_policy ?? readiness?.language_policy ?? gap?.language_policy ?? LANGUAGE_POLICY,
    source_versions,
    notes,
  };
}

/** Convenience: a single signal by key (read-only; composes once). */
export async function buildCareerSignal(
  pool: Pool,
  subjectId: string,
  signalKey: string,
): Promise<{ signal: CareerSignal | null; envelope: CareerSignalEnvelope }> {
  const envelope = await buildCareerSignals(pool, subjectId);
  const signal = envelope.signals.find((s) => s.signal_key === signalKey) ?? null;
  return { signal, envelope };
}

// ---------------------------------------------------------------------------
// Config-as-data persistence (admin CRUD — the ONLY write/DDL path).
// Reached ONLY behind the careerSignal flag gate + super-admin.
// ---------------------------------------------------------------------------

export async function ensureCareerSignalConfigSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_signal_library (
      id            BIGSERIAL PRIMARY KEY,
      signal_key    TEXT NOT NULL UNIQUE,
      label         TEXT NOT NULL,
      category      TEXT NOT NULL CHECK (category IN ('potential','risk')),
      description   TEXT NOT NULL DEFAULT '',
      inputs        JSONB NOT NULL DEFAULT '[]'::jsonb,
      display_order INTEGER NOT NULL DEFAULT 0,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_career_signal_library_order
       ON career_signal_library (display_order ASC, signal_key ASC)`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_signal_rules (
      id             BIGSERIAL PRIMARY KEY,
      rule_key       TEXT NOT NULL UNIQUE,
      version        TEXT NOT NULL DEFAULT '${CAREER_SIGNAL_VERSION}',
      bands          JSONB NOT NULL DEFAULT '{}'::jsonb,
      interpretation JSONB NOT NULL DEFAULT '{}'::jsonb,
      active         BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export interface SignalLibraryRow extends SignalDefinition {
  id: number;
  created_at: string;
  updated_at: string;
}

export async function listSignalLibrary(pool: Pool): Promise<{
  source: 'db' | 'defaults';
  items: Array<SignalDefinition & { id?: number }>;
}> {
  const probe = await pool
    .query(`SELECT to_regclass('public.career_signal_library') AS t`)
    .catch(() => ({ rows: [{ t: null }] }));
  if (!probe.rows[0]?.t) return { source: 'defaults', items: DEFAULT_SIGNAL_LIBRARY };
  const r = await pool
    .query(
      `SELECT id, signal_key, label, category, description, inputs, display_order, active,
              created_at, updated_at
         FROM career_signal_library ORDER BY display_order ASC, signal_key ASC`,
    )
    .catch(() => ({ rows: [] as any[] }));
  if (!r.rows.length) return { source: 'defaults', items: DEFAULT_SIGNAL_LIBRARY };
  return {
    source: 'db',
    items: r.rows.map((row: any) => ({
      id: Number(row.id),
      signal_key: String(row.signal_key),
      label: String(row.label),
      category: row.category,
      description: String(row.description ?? ''),
      inputs: typeof row.inputs === 'string' ? JSON.parse(row.inputs) : row.inputs,
      display_order: Number(row.display_order ?? 0),
      active: row.active !== false,
    })),
  };
}

/** Upsert one signal definition. Write path — ensures schema first. */
export async function upsertSignalDefinition(
  pool: Pool,
  def: SignalDefinition,
): Promise<SignalLibraryRow> {
  await ensureCareerSignalConfigSchema(pool);
  const r = await pool.query(
    `INSERT INTO career_signal_library (signal_key, label, category, description, inputs, display_order, active, updated_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,NOW())
     ON CONFLICT (signal_key) DO UPDATE SET
       label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description,
       inputs = EXCLUDED.inputs, display_order = EXCLUDED.display_order, active = EXCLUDED.active,
       updated_at = NOW()
     RETURNING id, signal_key, label, category, description, inputs, display_order, active, created_at, updated_at`,
    [
      def.signal_key,
      def.label,
      def.category,
      def.description ?? '',
      JSON.stringify(def.inputs ?? []),
      def.display_order ?? 0,
      def.active !== false,
    ],
  );
  const row = r.rows[0];
  return { ...row, id: Number(row.id), inputs: row.inputs } as SignalLibraryRow;
}

/** Seed the library + rules tables from the in-code defaults (idempotent). */
export async function seedCareerSignalDefaults(
  pool: Pool,
): Promise<{ library_seeded: number; rules_seeded: boolean }> {
  await ensureCareerSignalConfigSchema(pool);
  let seeded = 0;
  for (const def of DEFAULT_SIGNAL_LIBRARY) {
    await upsertSignalDefinition(pool, def);
    seeded += 1;
  }
  await pool.query(
    `INSERT INTO career_signal_rules (rule_key, version, bands, interpretation, active, updated_at)
     VALUES ('default', $1, $2::jsonb, $3::jsonb, TRUE, NOW())
     ON CONFLICT (rule_key) DO UPDATE SET
       version = EXCLUDED.version, bands = EXCLUDED.bands,
       interpretation = EXCLUDED.interpretation, active = EXCLUDED.active, updated_at = NOW()`,
    [
      DEFAULT_SIGNAL_RULES.version,
      JSON.stringify(DEFAULT_SIGNAL_RULES.bands),
      JSON.stringify(DEFAULT_SIGNAL_RULES.interpretation),
    ],
  );
  return { library_seeded: seeded, rules_seeded: true };
}

/** Update (upsert) the active rules row. Write path — ensures schema first. */
export async function upsertSignalRules(pool: Pool, rules: Partial<SignalRules>): Promise<SignalRules> {
  await ensureCareerSignalConfigSchema(pool);
  const merged: SignalRules = {
    version: rules.version ?? CAREER_SIGNAL_VERSION,
    bands: rules.bands ?? DEFAULT_SIGNAL_RULES.bands,
    interpretation: rules.interpretation ?? DEFAULT_SIGNAL_RULES.interpretation,
  };
  await pool.query(
    `INSERT INTO career_signal_rules (rule_key, version, bands, interpretation, active, updated_at)
     VALUES ('default', $1, $2::jsonb, $3::jsonb, TRUE, NOW())
     ON CONFLICT (rule_key) DO UPDATE SET
       version = EXCLUDED.version, bands = EXCLUDED.bands,
       interpretation = EXCLUDED.interpretation, active = EXCLUDED.active, updated_at = NOW()`,
    [merged.version, JSON.stringify(merged.bands), JSON.stringify(merged.interpretation)],
  );
  return merged;
}

export async function getSignalRules(pool: Pool): Promise<{ source: 'db' | 'defaults'; rules: SignalRules }> {
  const { rules, source } = await loadSignalRules(pool);
  return { source, rules };
}
