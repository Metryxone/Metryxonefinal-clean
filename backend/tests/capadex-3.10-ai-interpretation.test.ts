/**
 * CAPADEX 3.0 — Program 3 · Phase 3.10 Enterprise AI Interpretation & Explainability — TEST SUITE
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * The runnable suite backing the `testing` dimension of the Phase-3.10 certification
 * (config/ai-interpretation.ts). It exercises the PURE reuse-before-build mechanisms +
 * the read-only composer against the live DB. NOTHING here fabricates, executes an engine,
 * or writes: every mechanism is deterministic and every unknown stays null (null ≠ 0).
 *
 * UNIT (no DB):
 *   matchRule / selectInterpretationRule (deterministic condition predicate + priority/version
 *     tie-break, NO eval) · renderInterpretation (grounded {{token}} whitelist substitution —
 *     ungrounded tokens stripped, never fabricated) · computeConfidence (evidence-completeness
 *     score + band + ABSTAIN below confidence floor / k_min, null ≠ 0) · detectUnsupportedClaims
 *     (numeric hallucination guard — numbers absent from grounded values flagged) · verifyReferences
 *     (unresolved refs dropped, never fabricated) · composeExplanation (8-facet, dropped refs → null)
 *     · evaluateInterpretationFormula (3.8 structured-AST composite index — NO eval; valid + invalid)
 *     · a source-level no-eval guard.
 *
 * INTEGRATION (needs DATABASE_URL): composeSummary / composeDimensions read-only composition —
 *   11 dimensions all SUPPORTED, verdict STRUCTURAL_COMPLETE_ADOPTION_PENDING, 0 Launch-Critical.
 *   Skipped honestly when DATABASE_URL is absent (never fabricated as passing).
 *
 * Run with:  npx tsx --test backend/tests/capadex-3.10-ai-interpretation.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  matchRule,
  selectInterpretationRule,
  renderInterpretation,
  computeConfidence,
  detectUnsupportedClaims,
  verifyReferences,
  composeExplanation,
  evaluateInterpretationFormula,
  type InterpretationRule,
} from '../services/ai-interpretation-mechanisms';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── matchRule / selectInterpretationRule — deterministic predicate + priority tie-break ───────
test('matchRule: field/op predicate holds and fails deterministically (NO eval)', () => {
  assert.equal(matchRule({ field: 'score', op: 'gte', value: 70 }, { score: 80 }), true);
  assert.equal(matchRule({ field: 'score', op: 'gte', value: 70 }, { score: 50 }), false);
  assert.equal(matchRule({ field: 'score', op: 'between', min: 40, max: 60 }, { score: 50 }), true);
  assert.equal(matchRule({ field: 'score', op: 'between', min: 40, max: 60 }, { score: 61 }), false);
});

test('matchRule: mismatched kind/persona/lifecycle facet → false', () => {
  assert.equal(matchRule({ kind: 'score' }, { kind: 'skill' }), false);
  assert.equal(matchRule({ persona: 'student' }, { persona: 'professional' }), false);
  assert.equal(matchRule({ lifecycle: 'entry' }, { lifecycle: 'growth' }), false);
});

test('selectInterpretationRule: highest-priority matching rule wins; no match → null', () => {
  const rules: InterpretationRule[] = [
    { rule_key: 'r_any', priority: 1, condition: { field: 'score', op: 'gte', value: 0 }, template: 'any' },
    { rule_key: 'r_high', priority: 5, condition: { field: 'score', op: 'gte', value: 70 }, template: 'high {{score}}' },
  ];
  assert.equal(selectInterpretationRule(rules, { score: 80 })?.rule_key, 'r_high'); // both match, priority 5 wins
  assert.equal(selectInterpretationRule(rules, { score: 50 })?.rule_key, 'r_any'); // only r_any matches
  assert.equal(selectInterpretationRule(rules, { score: -1 }), null); // r_any needs >= 0
  assert.equal(selectInterpretationRule([], { score: 80 }), null);
});

// ── renderInterpretation — grounded {{token}} whitelist substitution, never fabricated ────────
test('renderInterpretation: substitutes grounded tokens, STRIPS ungrounded (never fabricated)', () => {
  const r = renderInterpretation('Your score is {{score}} and {{secret}} matters', { score: 80, secret: 'x' }, ['score']);
  assert.ok(r.text.includes('80'), r.text);
  assert.ok(!r.text.includes('{{'), 'no placeholder leaks');
  assert.ok(!r.text.includes('x'), 'ungrounded token value must NOT appear');
  assert.deepEqual(r.tokens_used, ['score']);
});

// ── computeConfidence — evidence completeness, band, ABSTAIN, null ≠ 0 ────────────────────────
test('computeConfidence: full evidence → score 1, band high, not abstained, no human_review', () => {
  const c = computeConfidence({ a: true, b: true }, ['a', 'b']);
  assert.equal(c.score, 1);
  assert.equal(c.band, 'high');
  assert.equal(c.abstained, false);
  assert.equal(c.human_review, false);
  assert.deepEqual(c.missing, []);
  assert.equal(c.reason, 'ok');
});

test('computeConfidence: partial evidence lists present/missing honestly', () => {
  const c = computeConfidence({ a: true, b: false }, ['a', 'b']);
  assert.equal(c.score, 0.5);
  assert.deepEqual(c.present, ['a']);
  assert.deepEqual(c.missing, ['b']);
  assert.equal(c.human_review, true); // band !== high
});

test('computeConfidence: no required facets → score null (unknown ≠ 0), abstained', () => {
  const c = computeConfidence({}, []);
  assert.equal(c.score, null);
  assert.equal(c.band, null);
  assert.equal(c.abstained, true);
  assert.equal(c.reason, 'no_required_facets');
});

test('computeConfidence: cohort below k_min → ABSTAINS regardless of score', () => {
  const c = computeConfidence({ a: true, b: true }, ['a', 'b'], { cohortSize: 5 });
  assert.equal(c.abstained, true);
  assert.match(c.reason, /cohort_below_k_min\(5<30\)/);
});

// ── detectUnsupportedClaims — numeric hallucination guard ─────────────────────────────────────
test('detectUnsupportedClaims: number absent from grounded values is flagged', () => {
  const d = detectUnsupportedClaims(
    'You scored 80 at the 84th percentile, better than 999 peers.',
    { score: 80, percentile: 84 },
    ['score', 'percentile'],
  );
  assert.deepEqual(d.claims, ['999']);
  assert.equal(d.count, 1);
});

test('detectUnsupportedClaims: every number grounded → count 0 (no false positive)', () => {
  const d = detectUnsupportedClaims('score 80 at percentile 84', { score: 80, percentile: 84 }, ['score', 'percentile']);
  assert.equal(d.count, 0);
  assert.deepEqual(d.claims, []);
});

test('detectUnsupportedClaims: rounded grounded value tolerated (84 matches 84.13)', () => {
  const d = detectUnsupportedClaims('84 percentile', { percentile: 84.13 }, ['percentile']);
  assert.equal(d.count, 0);
});

// ── verifyReferences — unresolved refs dropped, never fabricated ──────────────────────────────
test('verifyReferences: drops null / empty / NaN, keeps real provenance', () => {
  const r = verifyReferences({ a: 1, b: null, c: '', d: NaN, e: 'ok' });
  assert.deepEqual(r.verified, { a: 1, e: 'ok' });
  assert.deepEqual(r.dropped.sort(), ['b', 'c', 'd']);
});

// ── composeExplanation — 8-facet, dropped refs → null, confidence rationale ───────────────────
test('composeExplanation: verified refs kept, unresolved → null (honest), confidence rationale present', () => {
  const conf = computeConfidence({ a: true, b: true }, ['a', 'b']);
  const e = composeExplanation({
    why: 'because the standardized score is high',
    evidence_basis: [{ facet: 'score', value: 80 }],
    data_sources: ['cra_scores'],
    rule_reference: { key: 'r_high', version: 2 },
    score_reference: 55,
    benchmark_reference: null,
    confidence: conf,
  });
  assert.equal(e.why, 'because the standardized score is high');
  assert.deepEqual(e.data_sources, ['cra_scores']);
  assert.equal(e.rule_reference, 'r_high@v2');
  assert.equal(e.score_reference, 55);
  assert.equal(e.benchmark_reference, null); // unresolved → honest null
  assert.equal(e.assessment_reference, null);
  assert.ok(e.confidence_rationale && (e.confidence_rationale as { band: string }).band === 'high');
});

// ── evaluateInterpretationFormula — 3.8 structured-AST composite index, NO eval ───────────────
test('evaluateInterpretationFormula: valid canonical AST evaluates deterministically', () => {
  // 70 + (x * 0.5) with x=40 → 90 — canonical FormulaNode shape (op/var/const).
  const ast = {
    type: 'op', op: '+',
    args: [
      { type: 'const', value: 70 },
      { type: 'op', op: '*', args: [{ type: 'var', name: 'x' }, { type: 'const', value: 0.5 }] },
    ],
  };
  const r = evaluateInterpretationFormula(ast, { x: 40 });
  assert.equal(r.valid, true);
  assert.equal(r.value, 90);
  assert.equal(r.error, null);
});

test('evaluateInterpretationFormula: invalid AST → valid:false / value:null / error set (never fabricated)', () => {
  const r = evaluateInterpretationFormula({ type: 'bogus_node' }, {});
  assert.equal(r.valid, false);
  assert.equal(r.value, null);
  assert.ok(r.error !== null && String(r.error).length > 0);
});

test('no-eval guard: interpretation mechanism source contains NO eval / new Function', () => {
  const src = readFileSync(path.resolve(__dirname, '../services/ai-interpretation-mechanisms.ts'), 'utf8');
  assert.ok(!/\beval\s*\(/.test(src), 'must not call eval()');
  assert.ok(!/new\s+Function\s*\(/.test(src), 'must not use new Function()');
});

// ── INTEGRATION — read-only engine composition against the live DB ────────────────────────────
test('composeSummary / composeDimensions: 11 dimensions SUPPORTED, honest verdict', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL absent — integration composition skipped (honest, not a pass)');
    return;
  }
  const { Pool } = await import('pg');
  const { composeSummary, composeDimensions } = await import('../services/ai-interpretation-engine');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dims = await composeDimensions(pool);
    assert.equal(dims.dimension_count, 11);
    assert.equal(dims.status_counts.SUPPORTED, 11);
    assert.equal(dims.dimensions.length, 11);

    const summary = await composeSummary(pool);
    assert.equal(summary.flag, 'aiInterpretation');
    assert.equal(summary.k_min, 30);
    assert.equal(summary.dimensions.dimension_count, 11);
    assert.equal(summary.dimensions.status_counts.SUPPORTED, 11);
    assert.equal(summary.enterprise_ready.verdict, 'STRUCTURAL_COMPLETE_ADOPTION_PENDING');
    assert.equal(summary.gap_counts['Launch-Critical'], 0);
    assert.equal(summary.ready_for_certification.ready, true);
  } finally {
    await pool.end();
  }
});
