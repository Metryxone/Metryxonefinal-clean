/**
 * CAPADEX 3.0 — Program 3 · Phase 3.6 Assessment Science / Psychometrics / Item Intelligence — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build engineering-closure mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureAsciSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The additive
 * overlay tables are:
 *   asci_item_stats    — per-question difficulty/discrimination/distractor/facility/quality/retirement.
 *   asci_reliability   — per-assessment α/split-half/test-retest/inter-rater/SEM/CI records.
 *   asci_validity      — per-assessment face/content/construct/criterion/… validity evidence.
 *   asci_quality_flags — per-question quality-check flags (duplicate/ambiguity/bias/…).
 *   asci_blueprints    — per-assessment blueprint coverage + distribution validation.
 *   asci_governance    — question/assessment governance stage ledger (review/approval/audit).
 *   asci_repository    — versioned science-artefact catalogue.
 *
 * The PURE compute/validate helpers (computeItemAnalysis/computeReliability/computeValidity/
 * validateQuestionQuality/validateBlueprint) have NO DB + NO DDL + NO eval — they are deterministic +
 * side-effect free and REUSE the existing psychometric engines (psychometric-intelligence-engine,
 * sci-psychometric-engine, assessment-blueprint-engine). Item-level statistics ABSTAIN below k_min real
 * responses — they return { abstained:true } rather than fabricating a value. This module measures the
 * INSTRUMENT (question/assessment quality) — it NEVER scores or interprets a candidate.
 *
 * Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty).
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import { ASCI_K_MIN } from '../config/assessment-science';
import { pearsonR, variance, factorLoading, irt3PL } from './psychometric-intelligence-engine';
import { cronbachAlpha, reliabilityTier, testRetest, cohensKappa, adverseImpact, constructValidity } from './sci-psychometric-engine';
import { generateBlueprint, type BlueprintInput } from './assessment-blueprint-engine';

function assertEnabled(): void {
  if (!isFlagEnabled('assessmentScience')) {
    throw new Error('assessment_science_disabled');
  }
}

let schemaReady = false;
export async function ensureAsciSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asci_item_stats (
      id             BIGSERIAL PRIMARY KEY,
      item_key       TEXT NOT NULL,
      assessment_slug TEXT NOT NULL DEFAULT '',
      n_responses    INTEGER NOT NULL DEFAULT 0,
      difficulty     DOUBLE PRECISION,
      discrimination DOUBLE PRECISION,
      facility       DOUBLE PRECISION,
      quality_score  DOUBLE PRECISION,
      distractor     JSONB NOT NULL DEFAULT '{}'::jsonb,
      flags          JSONB NOT NULL DEFAULT '[]'::jsonb,
      retire_recommended BOOLEAN NOT NULL DEFAULT false,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      status         TEXT NOT NULL DEFAULT 'computed',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (item_key, assessment_slug)
    );
    CREATE INDEX IF NOT EXISTS asci_item_stats_assessment_idx ON asci_item_stats(assessment_slug);
    CREATE TABLE IF NOT EXISTS asci_reliability (
      id             BIGSERIAL PRIMARY KEY,
      rel_key        TEXT NOT NULL,
      assessment_slug TEXT NOT NULL DEFAULT '',
      method         TEXT NOT NULL DEFAULT 'internal_consistency',
      coefficient    DOUBLE PRECISION,
      tier           TEXT,
      sem            DOUBLE PRECISION,
      ci_low         DOUBLE PRECISION,
      ci_high        DOUBLE PRECISION,
      n_respondents  INTEGER NOT NULL DEFAULT 0,
      k_items        INTEGER NOT NULL DEFAULT 0,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (rel_key, method)
    );
    CREATE TABLE IF NOT EXISTS asci_validity (
      id             BIGSERIAL PRIMARY KEY,
      val_key        TEXT NOT NULL,
      assessment_slug TEXT NOT NULL DEFAULT '',
      validity_type  TEXT NOT NULL DEFAULT 'construct',
      coefficient    DOUBLE PRECISION,
      criterion      TEXT,
      n              INTEGER NOT NULL DEFAULT 0,
      abstained      BOOLEAN NOT NULL DEFAULT false,
      evidence       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (val_key, validity_type)
    );
    CREATE TABLE IF NOT EXISTS asci_quality_flags (
      id             BIGSERIAL PRIMARY KEY,
      flag_key       TEXT NOT NULL,
      item_key       TEXT,
      check_type     TEXT NOT NULL DEFAULT 'clarity_check',
      passed         BOOLEAN NOT NULL DEFAULT true,
      severity       TEXT NOT NULL DEFAULT 'info',
      detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (flag_key, check_type)
    );
    CREATE INDEX IF NOT EXISTS asci_quality_flags_item_idx ON asci_quality_flags(item_key);
    CREATE TABLE IF NOT EXISTS asci_blueprints (
      id             BIGSERIAL PRIMARY KEY,
      blueprint_key  TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      assessment_slug TEXT,
      valid          BOOLEAN NOT NULL DEFAULT false,
      coverage       JSONB NOT NULL DEFAULT '{}'::jsonb,
      distribution   JSONB NOT NULL DEFAULT '{}'::jsonb,
      gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
      status         TEXT NOT NULL DEFAULT 'draft',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (blueprint_key, version)
    );
    CREATE TABLE IF NOT EXISTS asci_governance (
      id             BIGSERIAL PRIMARY KEY,
      gov_key        TEXT NOT NULL,
      target_ref     TEXT,
      stage          TEXT NOT NULL DEFAULT 'scientific_review',
      status         TEXT NOT NULL DEFAULT 'pending',
      reviewer       TEXT,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (gov_key, stage)
    );
    CREATE TABLE IF NOT EXISTS asci_repository (
      id             BIGSERIAL PRIMARY KEY,
      artefact_key   TEXT NOT NULL,
      version        INTEGER NOT NULL DEFAULT 1,
      artefact_type  TEXT NOT NULL DEFAULT 'item_stats',
      ref            TEXT,
      payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
      status         TEXT NOT NULL DEFAULT 'active',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (artefact_key, version)
    );
  `);
  schemaReady = true;
}

/** null on error (unreadable), 0 on no rows (empty). null ≠ 0. */
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0] ? Object.values(rows[0])[0] : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

/**
 * Read-only helpers: NEVER touch DDL. If the overlay table is absent (flag never
 * exercised via a write), the query throws → we honestly return empty ([] / null),
 * NEVER CREATE TABLE. DDL lives ONLY on the write paths (via ensureAsciSchema).
 */
async function safeRows(pool: Pool, sql: string, params: unknown[] = []): Promise<unknown[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch {
    return [];
  }
}
async function safeRow(pool: Pool, sql: string, params: unknown[] = []): Promise<unknown> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round4 = (n: number): number => +n.toFixed(4);

// ═════════════════════════════════════════════════════════════════════════════
// PURE COMPUTE / VALIDATE — deterministic, NO DB, NO DDL, NO eval. REUSE-before-build.
// Measures INSTRUMENT quality (question/assessment) — NEVER a candidate.
// ═════════════════════════════════════════════════════════════════════════════

export const ITEM_METRIC_KEYS = [
  'difficulty', 'discrimination', 'distractor_analysis', 'item_facility', 'item_exposure',
  'item_information', 'item_quality_score', 'item_bias', 'retirement_recommendation',
] as const;

function difficultyBand(p: number): 'very_hard' | 'hard' | 'moderate' | 'easy' | 'very_easy' {
  if (p < 0.2) return 'very_hard';
  if (p < 0.4) return 'hard';
  if (p < 0.7) return 'moderate';
  if (p < 0.9) return 'easy';
  return 'very_easy';
}
function discriminationBand(d: number): 'poor' | 'marginal' | 'good' | 'excellent' {
  if (d < 0.2) return 'poor';
  if (d < 0.3) return 'marginal';
  if (d < 0.4) return 'good';
  return 'excellent';
}

export interface ItemResponseSet {
  ref?: string;                                  // item identifier
  responses: (number | null)[];                  // scored per-respondent value (keyed direction); null = missing
  max?: number;                                  // item max score (default 1)
  selections?: (string | number | null)[];       // selected option per respondent (for distractor analysis)
  optionKeys?: (string | number)[];               // valid option ids
  correctKey?: string | number;                   // correct option id
}
export interface ItemAnalysisResult {
  ref: string;
  n_responses: number;
  abstained: boolean;
  reason?: string;
  difficulty: number | null;
  difficulty_band: string | null;
  discrimination: number | null;
  discrimination_band: string | null;
  facility: number | null;
  quality_score: number | null;
  distractor: Record<string, { count: number; share: number; correct: boolean; non_functioning: boolean }> | null;
  retire_recommended: boolean;
  flags: string[];
}

/**
 * PURE per-item analysis (difficulty p-value, corrected item-total discrimination via pearsonR,
 * distractor analysis, facility, composite quality score, retirement recommendation).
 * ABSTAINS (abstained:true, all stats null) when fewer than k_min respondents answered — a value is
 * NEVER fabricated on thin data. Reuses pearsonR (psychometric-intelligence-engine).
 */
export function computeItemAnalysis(items: ItemResponseSet[], options: { k_min?: number } = {}): {
  k_min: number; item_count: number; items: ItemAnalysisResult[];
} {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : ASCI_K_MIN;
  const list = Array.isArray(items) ? items : [];
  const n = list.reduce((m, it) => Math.max(m, Array.isArray(it.responses) ? it.responses.length : 0), 0);

  // Per-respondent total across all items (sum of non-null scored values).
  const totals: number[] = [];
  for (let j = 0; j < n; j++) {
    let t = 0;
    for (const it of list) {
      const v = it.responses?.[j];
      if (v !== null && v !== undefined) t += num(v);
    }
    totals.push(t);
  }

  const out: ItemAnalysisResult[] = list.map((it, idx) => {
    const ref = it.ref || `item_${idx + 1}`;
    const max = num(it.max, 1) || 1;
    const answeredIdx: number[] = [];
    for (let j = 0; j < n; j++) {
      const v = it.responses?.[j];
      if (v !== null && v !== undefined) answeredIdx.push(j);
    }
    const answered = answeredIdx.length;
    if (answered < kMin) {
      return {
        ref, n_responses: answered, abstained: true, reason: `insufficient responses (< k_min=${kMin})`,
        difficulty: null, difficulty_band: null, discrimination: null, discrimination_band: null,
        facility: null, quality_score: null, distractor: null, retire_recommended: false, flags: [],
      };
    }
    const vals = answeredIdx.map((j) => num(it.responses![j]));
    const p = round4(mean(vals) / max);
    // Corrected item-total correlation (exclude this item from the total).
    const itemVals = vals;
    const restTotals = answeredIdx.map((j, i) => totals[j] - itemVals[i]);
    const discrimination = round4(pearsonR(itemVals, restTotals));
    const facility = round4(1 - p);

    // Distractor analysis (MCQ only).
    let distractor: ItemAnalysisResult['distractor'] = null;
    if (Array.isArray(it.selections) && Array.isArray(it.optionKeys) && it.optionKeys.length) {
      const sel = it.selections;
      const counts: Record<string, number> = {};
      let selN = 0;
      for (const s of sel) { if (s === null || s === undefined) continue; counts[String(s)] = (counts[String(s)] || 0) + 1; selN += 1; }
      distractor = {};
      for (const key of it.optionKeys) {
        const c = counts[String(key)] || 0;
        const share = selN > 0 ? round4(c / selN) : 0;
        const correct = it.correctKey !== undefined && String(key) === String(it.correctKey);
        distractor[String(key)] = { count: c, share, correct, non_functioning: !correct && share < 0.05 };
      }
    }

    // Composite quality score (0..100) — difficulty health + discrimination health + distractor health.
    const flags: string[] = [];
    let quality = 100;
    if (p < 0.15 || p > 0.95) { quality -= 30; flags.push(p > 0.95 ? 'too_easy' : 'too_hard'); }
    else if (p < 0.25 || p > 0.9) { quality -= 12; flags.push('difficulty_extreme'); }
    if (discrimination < 0.1) { quality -= 35; flags.push('non_discriminating'); }
    else if (discrimination < 0.2) { quality -= 15; flags.push('weak_discrimination'); }
    if (discrimination < 0) { quality -= 10; flags.push('negative_discrimination'); }
    if (distractor) {
      const nonFn = Object.values(distractor).filter((d) => d.non_functioning).length;
      if (nonFn > 0) { quality -= Math.min(20, nonFn * 7); flags.push(`non_functioning_distractors:${nonFn}`); }
    }
    quality = Math.max(0, Math.min(100, quality));
    const retire = discrimination < 0.1 || discrimination < 0 || p < 0.05 || p > 0.98;
    if (retire) flags.push('retire_candidate');

    return {
      ref, n_responses: answered, abstained: false,
      difficulty: p, difficulty_band: difficultyBand(p),
      discrimination, discrimination_band: discriminationBand(discrimination),
      facility, quality_score: round4(quality), distractor,
      retire_recommended: retire, flags,
    };
  });

  return { k_min: kMin, item_count: list.length, items: out };
}

export interface ReliabilityResult {
  abstained: boolean;
  reason?: string;
  n_respondents: number;
  k_items: number;
  methods: Array<{ method: string; coefficient: number | null; tier?: string | null; detail?: Record<string, unknown> }>;
  sem: number | null;
  ci: { low: number | null; high: number | null; at: number | null } | null;
}

/**
 * PURE reliability computation over a respondents × items score matrix. REUSES cronbachAlpha /
 * testRetest / cohensKappa (sci-psychometric-engine). Computes internal-consistency (α), split-half
 * (Spearman-Brown), SEM (sd_total·√(1−α)) and a 95% score CI. ABSTAINS below k_min respondents.
 */
export function computeReliability(
  matrix: number[][],
  options: { k_min?: number; retest?: { t1: number[]; t2: number[] }; raters?: { a: number[]; b: number[] } } = {},
): ReliabilityResult {
  const kMin = Number.isFinite(Number(options.k_min)) ? Number(options.k_min) : ASCI_K_MIN;
  const rows = Array.isArray(matrix) ? matrix.filter((r) => Array.isArray(r)) : [];
  const nResp = rows.length;
  const kItems = rows[0]?.length ?? 0;
  const methods: ReliabilityResult['methods'] = [];

  if (nResp < kMin || kItems < 2) {
    return {
      abstained: true, reason: `insufficient respondents (< k_min=${kMin}) or < 2 items`,
      n_respondents: nResp, k_items: kItems, methods: [], sem: null, ci: null,
    };
  }

  const alphaRes = cronbachAlpha(rows);
  const alpha = round4(alphaRes.alpha);
  methods.push({ method: 'internal_consistency', coefficient: alpha, tier: reliabilityTier(alpha), detail: { k_items: alphaRes.k_items, n_respondents: alphaRes.n_respondents } });

  // Split-half (odd/even) + Spearman-Brown correction.
  const halfA = rows.map((r) => r.filter((_, i) => i % 2 === 0).reduce((s, v) => s + num(v), 0));
  const halfB = rows.map((r) => r.filter((_, i) => i % 2 === 1).reduce((s, v) => s + num(v), 0));
  const rHalf = pearsonR(halfA, halfB);
  const sb = (1 + rHalf) !== 0 ? (2 * rHalf) / (1 + rHalf) : 0;
  methods.push({ method: 'split_half', coefficient: round4(Math.max(-1, Math.min(1, sb))), detail: { raw_half_r: round4(rHalf) } });

  if (options.retest && Array.isArray(options.retest.t1) && Array.isArray(options.retest.t2)) {
    const tr = testRetest(options.retest.t1, options.retest.t2);
    methods.push({ method: 'test_retest', coefficient: round4(tr.r), detail: { n: tr.n } });
  }
  if (options.raters && Array.isArray(options.raters.a) && Array.isArray(options.raters.b)) {
    const kp = cohensKappa(options.raters.a, options.raters.b);
    methods.push({ method: 'inter_rater', coefficient: round4(kp.kappa), detail: { agreement: kp.agreement, chance: kp.chance } });
  }

  const totals = rows.map((r) => r.reduce((s, v) => s + num(v), 0));
  const sdTotal = Math.sqrt(variance(totals));
  const sem = round4(sdTotal * Math.sqrt(Math.max(0, 1 - alpha)));
  const meanTotal = mean(totals);
  const ci = { low: round4(meanTotal - 1.96 * sem), high: round4(meanTotal + 1.96 * sem), at: round4(meanTotal) };

  return { abstained: false, n_respondents: nResp, k_items: kItems, methods, sem, ci };
}

export interface ValidityInput {
  scores?: number[];
  criterion?: number[];
  convergent?: number[];
  discriminant?: number[];
  itemScores?: number[];
  totalScores?: number[];
  contentCoverage?: number;   // 0..1 fraction of blueprint content covered
  k_min?: number;
}
export interface ValidityResult {
  evidence: Array<{ validity_type: string; coefficient: number | null; n: number; abstained: boolean; note?: string }>;
}

/**
 * PURE validity evidence. REUSES constructValidity (sci) + factorLoading/pearsonR (psychometric-
 * intelligence-engine). content = blueprint coverage passthrough. ABSTAINS per-type below k_min pairs.
 */
export function computeValidity(input: ValidityInput): ValidityResult {
  const kMin = Number.isFinite(Number(input.k_min)) ? Number(input.k_min) : ASCI_K_MIN;
  const evidence: ValidityResult['evidence'] = [];
  const pair = (type: string, x?: number[], y?: number[], fn?: (a: number[], b: number[]) => number) => {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) { evidence.push({ validity_type: type, coefficient: null, n: 0, abstained: true, note: 'inputs absent or misaligned' }); return; }
    const n = x.length;
    if (n < kMin) { evidence.push({ validity_type: type, coefficient: null, n, abstained: true, note: `insufficient pairs (< k_min=${kMin})` }); return; }
    evidence.push({ validity_type: type, coefficient: round4((fn || pearsonR)(x, y)), n, abstained: false });
  };

  if (typeof input.contentCoverage === 'number') {
    evidence.push({ validity_type: 'content', coefficient: round4(Math.max(0, Math.min(1, input.contentCoverage))), n: 0, abstained: false, note: 'blueprint content-coverage fraction' });
  }
  pair('construct', input.scores, input.criterion, (a, b) => constructValidity(a, b).r);
  pair('criterion', input.scores, input.criterion);
  pair('convergent', input.scores, input.convergent);
  pair('discriminant', input.scores, input.discriminant);
  if (Array.isArray(input.itemScores) && Array.isArray(input.totalScores) && input.itemScores.length === input.totalScores.length) {
    const n = input.itemScores.length;
    if (n >= kMin) evidence.push({ validity_type: 'factor_loading', coefficient: round4(factorLoading(input.itemScores, input.totalScores)), n, abstained: false });
    else evidence.push({ validity_type: 'factor_loading', coefficient: null, n, abstained: true, note: `insufficient pairs (< k_min=${kMin})` });
  }
  return { evidence };
}

// ── Item-information (IRT) + DIF primitives (thin reuse wrappers) ─────────────
export function itemInformation(theta: number, a: number, b: number, c: number): number {
  const p = irt3PL(theta, a, b, c);
  if (p <= c || p >= 1) return 0;
  const q = 1 - p;
  return round4((a * a) * (q / p) * Math.pow((p - c) / (1 - c), 2));
}
export function itemDif(groupAPositive: number, groupATotal: number, groupBPositive: number, groupBTotal: number) {
  return adverseImpact(groupAPositive, groupATotal, groupBPositive, groupBTotal);
}

// ── Question-quality checks (6 pure heuristics) ──────────────────────────────
export const QUALITY_CHECK_KEYS = [
  'duplicate_detection', 'ambiguity_check', 'bias_language_check', 'reading_difficulty', 'option_balance', 'clarity_check',
] as const;

const AMBIGUOUS_WORDS = ['usually', 'sometimes', 'often', 'generally', 'maybe', 'possibly', 'several', 'various', 'some', 'many'];
const BIAS_WORDS = ['he', 'she', 'him', 'her', 'guys', 'mankind', 'chairman', 'manpower'];
const norm = (s: string): string => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter(Boolean));
  const tb = new Set(norm(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export interface QuestionInput { ref?: string; text?: string; options?: string[]; correct?: unknown; type?: string; bankText?: string[] }
export interface QuestionQualityResult {
  ref: string;
  checks: Array<{ check_type: string; passed: boolean; severity: 'info' | 'warn' | 'error'; detail: string }>;
  flagged: number;
  passed: number;
}

/** PURE per-question quality validation (advisory flags only — never auto-edits). */
export function validateQuestionQuality(q: QuestionInput): QuestionQualityResult {
  const ref = q.ref || 'question';
  const text = String(q.text || '');
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
  const checks: QuestionQualityResult['checks'] = [];

  // clarity / completeness
  {
    const problems: string[] = [];
    if (!text.trim()) problems.push('missing stem');
    if (q.type !== 'open' && options.length < 2) problems.push('fewer than 2 options');
    if (q.type !== 'open' && q.correct === undefined) problems.push('no correct key');
    if (/\bnot\b|\bexcept\b/i.test(text) && !/\bNOT\b|\bEXCEPT\b/.test(text)) problems.push('negation not emphasised');
    checks.push({ check_type: 'clarity_check', passed: problems.length === 0, severity: problems.length ? 'error' : 'info', detail: problems.join('; ') || 'ok' });
  }
  // ambiguity
  {
    const hits = AMBIGUOUS_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
    const doubleBarrel = /\band\b/i.test(text) && text.split(/\band\b/i).length > 2;
    checks.push({ check_type: 'ambiguity_check', passed: hits.length === 0 && !doubleBarrel, severity: hits.length ? 'warn' : 'info', detail: hits.length ? `vague: ${hits.join(', ')}` : (doubleBarrel ? 'possible double-barrelled stem' : 'ok') });
  }
  // bias / sensitive language
  {
    const hits = BIAS_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
    checks.push({ check_type: 'bias_language_check', passed: hits.length === 0, severity: hits.length ? 'warn' : 'info', detail: hits.length ? `review gendered/biased terms: ${hits.join(', ')}` : 'ok' });
  }
  // reading difficulty
  {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
    const wps = words.length / sentences;
    const passed = wps <= 25;
    checks.push({ check_type: 'reading_difficulty', passed, severity: passed ? 'info' : 'warn', detail: `${round4(wps)} words/sentence` });
  }
  // option balance
  {
    const problems: string[] = [];
    if (options.length) {
      const lens = options.map((o) => o.length);
      const maxLen = Math.max(...lens), minLen = Math.min(...lens);
      if (minLen > 0 && maxLen / minLen > 3) problems.push('unbalanced option lengths');
      if (options.some((o) => /\ball of the above\b|\bnone of the above\b/i.test(o))) problems.push('uses all/none of the above');
    }
    checks.push({ check_type: 'option_balance', passed: problems.length === 0, severity: problems.length ? 'warn' : 'info', detail: problems.join('; ') || 'ok' });
  }
  // duplicate / near-duplicate
  {
    let maxSim = 0, near = '';
    for (const other of (q.bankText || [])) { const sim = tokenOverlap(text, other); if (sim > maxSim) { maxSim = sim; near = other; } }
    const passed = maxSim < 0.8;
    checks.push({ check_type: 'duplicate_detection', passed, severity: passed ? 'info' : 'error', detail: passed ? `max overlap ${round4(maxSim)}` : `near-duplicate (overlap ${round4(maxSim)}): "${near.slice(0, 60)}"` });
  }

  const flagged = checks.filter((c) => !c.passed).length;
  return { ref, checks, flagged, passed: checks.length - flagged };
}

// ── Blueprint validation (reuse generateBlueprint) ───────────────────────────
export interface BlueprintValidationInput extends BlueprintInput {
  actualCounts?: Record<string, number>;     // authored questions per competency
  bloom?: Record<string, number>;            // authored bloom-level distribution
  timeMinutes?: number;                      // authored total time
}
export interface BlueprintValidationResult {
  valid: boolean;
  blueprint_name: string;
  total_competencies: number;
  total_questions_planned: number;
  coverage: Array<{ competency_code: string; planned: number; actual: number | null; covered: boolean; ratio: number | null }>;
  distribution: { difficulty_band: string; estimated_duration_min: number; bloom: Record<string, number> | null; time_minutes: number | null };
  gaps: string[];
}

/** PURE blueprint validation. REUSES assessment-blueprint-engine.generateBlueprint (no duplicate engine). */
export function validateBlueprint(input: BlueprintValidationInput): BlueprintValidationResult {
  const env = generateBlueprint(input);
  const actual = input.actualCounts || {};
  const gaps: string[] = [];
  const coverage = env.competencies.map((c) => {
    const a = actual[c.competency_code];
    const has = a !== undefined && a !== null;
    const ratio = has && c.question_count_planned > 0 ? round4(num(a) / c.question_count_planned) : null;
    const covered = has ? num(a) >= Math.ceil(c.question_count_planned * 0.7) : false;
    if (!has) gaps.push(`no authored items for ${c.competency_code}`);
    else if (!covered) gaps.push(`under-covered ${c.competency_code} (${a}/${c.question_count_planned})`);
    return { competency_code: c.competency_code, planned: c.question_count_planned, actual: has ? num(a) : null, covered, ratio };
  });
  const valid = gaps.length === 0;
  return {
    valid,
    blueprint_name: env.blueprint_name,
    total_competencies: env.total_competencies,
    total_questions_planned: env.total_questions_planned,
    coverage,
    distribution: {
      difficulty_band: env.difficulty_band,
      estimated_duration_min: env.estimated_duration_min,
      bloom: input.bloom || null,
      time_minutes: typeof input.timeMinutes === 'number' ? input.timeMinutes : null,
    },
    gaps,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERLAY WRITES (flag-gated; the ONLY DDL sites) + reads
// ═════════════════════════════════════════════════════════════════════════════

export interface ItemStatInput {
  item_key: string; assessment_slug?: string; n_responses?: number; difficulty?: number | null;
  discrimination?: number | null; facility?: number | null; quality_score?: number | null;
  distractor?: unknown; flags?: unknown; retire_recommended?: boolean; abstained?: boolean; status?: string;
}
export async function saveItemStat(pool: Pool, input: ItemStatInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_item_stats (item_key, assessment_slug, n_responses, difficulty, discrimination, facility,
       quality_score, distractor, flags, retire_recommended, abstained, status)
     VALUES ($1,COALESCE($2,''),COALESCE($3,0),$4,$5,$6,$7,COALESCE($8,'{}')::jsonb,COALESCE($9,'[]')::jsonb,
       COALESCE($10,false),COALESCE($11,false),COALESCE($12,'computed'))
     ON CONFLICT (item_key, assessment_slug) DO UPDATE SET
       n_responses=EXCLUDED.n_responses, difficulty=EXCLUDED.difficulty, discrimination=EXCLUDED.discrimination,
       facility=EXCLUDED.facility, quality_score=EXCLUDED.quality_score, distractor=EXCLUDED.distractor,
       flags=EXCLUDED.flags, retire_recommended=EXCLUDED.retire_recommended, abstained=EXCLUDED.abstained,
       status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.item_key, input.assessment_slug ?? null, input.n_responses ?? null, input.difficulty ?? null,
      input.discrimination ?? null, input.facility ?? null, input.quality_score ?? null,
      input.distractor ? JSON.stringify(input.distractor) : null, input.flags ? JSON.stringify(input.flags) : null,
      input.retire_recommended ?? null, input.abstained ?? null, input.status ?? null],
  );
  return rows[0];
}
export async function listItemStats(pool: Pool, assessmentSlug?: string): Promise<unknown[]> {
  assertEnabled();
  return assessmentSlug
    ? safeRows(pool, `SELECT * FROM asci_item_stats WHERE assessment_slug=$1 ORDER BY updated_at DESC LIMIT 500`, [assessmentSlug])
    : safeRows(pool, `SELECT * FROM asci_item_stats ORDER BY updated_at DESC LIMIT 500`);
}

export interface ReliabilityInput {
  rel_key: string; assessment_slug?: string; method?: string; coefficient?: number | null; tier?: string | null;
  sem?: number | null; ci_low?: number | null; ci_high?: number | null; n_respondents?: number; k_items?: number;
  abstained?: boolean; detail?: unknown;
}
export async function saveReliability(pool: Pool, input: ReliabilityInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_reliability (rel_key, assessment_slug, method, coefficient, tier, sem, ci_low, ci_high,
       n_respondents, k_items, abstained, detail)
     VALUES ($1,COALESCE($2,''),COALESCE($3,'internal_consistency'),$4,$5,$6,$7,$8,COALESCE($9,0),COALESCE($10,0),
       COALESCE($11,false),COALESCE($12,'{}')::jsonb)
     ON CONFLICT (rel_key, method) DO UPDATE SET
       assessment_slug=EXCLUDED.assessment_slug, coefficient=EXCLUDED.coefficient, tier=EXCLUDED.tier,
       sem=EXCLUDED.sem, ci_low=EXCLUDED.ci_low, ci_high=EXCLUDED.ci_high, n_respondents=EXCLUDED.n_respondents,
       k_items=EXCLUDED.k_items, abstained=EXCLUDED.abstained, detail=EXCLUDED.detail
     RETURNING *`,
    [input.rel_key, input.assessment_slug ?? null, input.method ?? null, input.coefficient ?? null, input.tier ?? null,
      input.sem ?? null, input.ci_low ?? null, input.ci_high ?? null, input.n_respondents ?? null, input.k_items ?? null,
      input.abstained ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listReliability(pool: Pool, assessmentSlug?: string): Promise<unknown[]> {
  assertEnabled();
  return assessmentSlug
    ? safeRows(pool, `SELECT * FROM asci_reliability WHERE assessment_slug=$1 ORDER BY created_at DESC LIMIT 500`, [assessmentSlug])
    : safeRows(pool, `SELECT * FROM asci_reliability ORDER BY created_at DESC LIMIT 500`);
}

export interface ValidityRecordInput {
  val_key: string; assessment_slug?: string; validity_type?: string; coefficient?: number | null;
  criterion?: string; n?: number; abstained?: boolean; evidence?: unknown;
}
export async function saveValidity(pool: Pool, input: ValidityRecordInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_validity (val_key, assessment_slug, validity_type, coefficient, criterion, n, abstained, evidence)
     VALUES ($1,COALESCE($2,''),COALESCE($3,'construct'),$4,$5,COALESCE($6,0),COALESCE($7,false),COALESCE($8,'{}')::jsonb)
     ON CONFLICT (val_key, validity_type) DO UPDATE SET
       assessment_slug=EXCLUDED.assessment_slug, coefficient=EXCLUDED.coefficient, criterion=EXCLUDED.criterion,
       n=EXCLUDED.n, abstained=EXCLUDED.abstained, evidence=EXCLUDED.evidence
     RETURNING *`,
    [input.val_key, input.assessment_slug ?? null, input.validity_type ?? null, input.coefficient ?? null,
      input.criterion ?? null, input.n ?? null, input.abstained ?? null, input.evidence ? JSON.stringify(input.evidence) : null],
  );
  return rows[0];
}
export async function listValidity(pool: Pool, assessmentSlug?: string): Promise<unknown[]> {
  assertEnabled();
  return assessmentSlug
    ? safeRows(pool, `SELECT * FROM asci_validity WHERE assessment_slug=$1 ORDER BY created_at DESC LIMIT 500`, [assessmentSlug])
    : safeRows(pool, `SELECT * FROM asci_validity ORDER BY created_at DESC LIMIT 500`);
}

export interface QualityFlagInput { flag_key: string; item_key?: string; check_type?: string; passed?: boolean; severity?: string; detail?: unknown }
export async function saveQualityFlag(pool: Pool, input: QualityFlagInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_quality_flags (flag_key, item_key, check_type, passed, severity, detail)
     VALUES ($1,$2,COALESCE($3,'clarity_check'),COALESCE($4,true),COALESCE($5,'info'),COALESCE($6,'{}')::jsonb)
     ON CONFLICT (flag_key, check_type) DO UPDATE SET
       item_key=EXCLUDED.item_key, passed=EXCLUDED.passed, severity=EXCLUDED.severity, detail=EXCLUDED.detail
     RETURNING *`,
    [input.flag_key, input.item_key ?? null, input.check_type ?? null, input.passed ?? null, input.severity ?? null,
      input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listQualityFlags(pool: Pool, itemKey?: string): Promise<unknown[]> {
  assertEnabled();
  return itemKey
    ? safeRows(pool, `SELECT * FROM asci_quality_flags WHERE item_key=$1 ORDER BY created_at DESC LIMIT 500`, [itemKey])
    : safeRows(pool, `SELECT * FROM asci_quality_flags ORDER BY created_at DESC LIMIT 500`);
}

export interface BlueprintRecordInput {
  blueprint_key: string; version?: number; assessment_slug?: string; valid?: boolean;
  coverage?: unknown; distribution?: unknown; gaps?: unknown; status?: string;
}
export async function saveBlueprintRecord(pool: Pool, input: BlueprintRecordInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_blueprints (blueprint_key, version, assessment_slug, valid, coverage, distribution, gaps, status)
     VALUES ($1,COALESCE($2,1),$3,COALESCE($4,false),COALESCE($5,'{}')::jsonb,COALESCE($6,'{}')::jsonb,
       COALESCE($7,'[]')::jsonb,COALESCE($8,'draft'))
     ON CONFLICT (blueprint_key, version) DO UPDATE SET
       assessment_slug=EXCLUDED.assessment_slug, valid=EXCLUDED.valid, coverage=EXCLUDED.coverage,
       distribution=EXCLUDED.distribution, gaps=EXCLUDED.gaps, status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.blueprint_key, input.version ?? null, input.assessment_slug ?? null, input.valid ?? null,
      input.coverage ? JSON.stringify(input.coverage) : null, input.distribution ? JSON.stringify(input.distribution) : null,
      input.gaps ? JSON.stringify(input.gaps) : null, input.status ?? null],
  );
  return rows[0];
}
export async function listBlueprints(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM asci_blueprints ORDER BY updated_at DESC LIMIT 500`);
}

export interface GovernanceInput { gov_key: string; target_ref?: string; stage?: string; status?: string; reviewer?: string; notes?: string }
export async function saveGovernance(pool: Pool, input: GovernanceInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_governance (gov_key, target_ref, stage, status, reviewer, notes)
     VALUES ($1,$2,COALESCE($3,'scientific_review'),COALESCE($4,'pending'),$5,$6)
     ON CONFLICT (gov_key, stage) DO UPDATE SET
       target_ref=EXCLUDED.target_ref, status=EXCLUDED.status, reviewer=EXCLUDED.reviewer,
       notes=EXCLUDED.notes, updated_at=now()
     RETURNING *`,
    [input.gov_key, input.target_ref ?? null, input.stage ?? null, input.status ?? null, input.reviewer ?? null, input.notes ?? null],
  );
  return rows[0];
}
export async function listGovernance(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM asci_governance ORDER BY updated_at DESC LIMIT 500`);
}

export interface RepositoryInput { artefact_key: string; version?: number; artefact_type?: string; ref?: string; payload?: unknown; status?: string }
export async function saveRepositoryArtefact(pool: Pool, input: RepositoryInput): Promise<unknown> {
  assertEnabled();
  await ensureAsciSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO asci_repository (artefact_key, version, artefact_type, ref, payload, status)
     VALUES ($1,COALESCE($2,1),COALESCE($3,'item_stats'),$4,COALESCE($5,'{}')::jsonb,COALESCE($6,'active'))
     ON CONFLICT (artefact_key, version) DO UPDATE SET
       artefact_type=EXCLUDED.artefact_type, ref=EXCLUDED.ref, payload=EXCLUDED.payload,
       status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.artefact_key, input.version ?? null, input.artefact_type ?? null, input.ref ?? null,
      input.payload ? JSON.stringify(input.payload) : null, input.status ?? null],
  );
  return rows[0];
}
export async function listRepository(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM asci_repository ORDER BY updated_at DESC LIMIT 500`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE — read-only adoption counts (null-safe; SEPARATE axis, never a gap)
// ═════════════════════════════════════════════════════════════════════════════
export async function itemStatsCoverage(pool: Pool): Promise<{ items: number | null; assessments: number | null; abstained: number | null; retire_recommended: number | null }> {
  return {
    items: await count(pool, `SELECT COUNT(*)::int FROM asci_item_stats`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM asci_item_stats`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM asci_item_stats WHERE abstained=true`),
    retire_recommended: await count(pool, `SELECT COUNT(*)::int FROM asci_item_stats WHERE retire_recommended=true`),
  };
}
export async function reliabilityCoverage(pool: Pool): Promise<{ records: number | null; assessments: number | null; methods_used: number | null; abstained: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM asci_reliability`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM asci_reliability`),
    methods_used: await count(pool, `SELECT COUNT(DISTINCT method)::int FROM asci_reliability`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM asci_reliability WHERE abstained=true`),
  };
}
export async function validityCoverage(pool: Pool): Promise<{ records: number | null; assessments: number | null; types_used: number | null; abstained: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM asci_validity`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM asci_validity`),
    types_used: await count(pool, `SELECT COUNT(DISTINCT validity_type)::int FROM asci_validity`),
    abstained: await count(pool, `SELECT COUNT(*)::int FROM asci_validity WHERE abstained=true`),
  };
}
export async function qualityCoverage(pool: Pool): Promise<{ flags: number | null; items: number | null; failed: number | null; checks_used: number | null }> {
  return {
    flags: await count(pool, `SELECT COUNT(*)::int FROM asci_quality_flags`),
    items: await count(pool, `SELECT COUNT(DISTINCT item_key)::int FROM asci_quality_flags`),
    failed: await count(pool, `SELECT COUNT(*)::int FROM asci_quality_flags WHERE passed=false`),
    checks_used: await count(pool, `SELECT COUNT(DISTINCT check_type)::int FROM asci_quality_flags`),
  };
}
export async function blueprintCoverage(pool: Pool): Promise<{ blueprints: number | null; valid: number | null; assessments: number | null }> {
  return {
    blueprints: await count(pool, `SELECT COUNT(*)::int FROM asci_blueprints`),
    valid: await count(pool, `SELECT COUNT(*)::int FROM asci_blueprints WHERE valid=true`),
    assessments: await count(pool, `SELECT COUNT(DISTINCT assessment_slug)::int FROM asci_blueprints`),
  };
}
export async function governanceCoverage(pool: Pool): Promise<{ records: number | null; stages_used: number | null; approved: number | null }> {
  return {
    records: await count(pool, `SELECT COUNT(*)::int FROM asci_governance`),
    stages_used: await count(pool, `SELECT COUNT(DISTINCT stage)::int FROM asci_governance`),
    approved: await count(pool, `SELECT COUNT(*)::int FROM asci_governance WHERE status IN ('approved','passed')`),
  };
}
export async function repositoryCoverage(pool: Pool): Promise<{ artefacts: number | null; types_used: number | null; active: number | null }> {
  return {
    artefacts: await count(pool, `SELECT COUNT(*)::int FROM asci_repository`),
    types_used: await count(pool, `SELECT COUNT(DISTINCT artefact_type)::int FROM asci_repository`),
    active: await count(pool, `SELECT COUNT(*)::int FROM asci_repository WHERE status='active'`),
  };
}
