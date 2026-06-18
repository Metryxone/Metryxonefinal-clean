/**
 * CAPADEX Phase 7 — Recommendation Intelligence pure-engine fixtures.
 * Run:  npx tsx backend/tests/recommendation-engine.test.ts
 *
 * No test runner — plain asserts so it runs anywhere tsx runs. Pure functions only
 * (no DB): catalog selection, generator category/sub_type mapping + no-orphan,
 * explainability 100% / honest chain-completeness, readiness banding + degraded cap.
 */
import assert from 'node:assert';
import {
  selectCatalog,
  type CatalogEntry,
} from '../services/pil/recommendation-catalog';
import {
  generateRecommendations,
  deepestResolvedHop,
  type ActiveConstruct,
} from '../services/pil/recommendation-generator';
import { attachRecommendationExplainability } from '../services/pil/recommendation-explainability';
import { computeRecReadiness } from '../services/pil/recommendation-builder';
import type { PipelineHop } from '../services/pil/pipeline-resolver';

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
function entry(p: Partial<CatalogEntry> & Pick<CatalogEntry, 'category' | 'sub_type' | 'anchor_construct' | 'stakeholder'>): CatalogEntry {
  return {
    recommendation_key: `${p.category}:${p.sub_type}:${p.anchor_construct}`,
    title: `T ${p.anchor_construct} ${p.sub_type}`,
    description: `D ${p.anchor_construct}`,
    rationale: `R ${p.anchor_construct}`,
    priority: 2,
    ...p,
  } as CatalogEntry;
}

const CATALOG: CatalogEntry[] = [
  entry({ category: 'career', sub_type: 'cluster', anchor_construct: 'ANXIETY', stakeholder: 'student' }),
  entry({ category: 'career', sub_type: 'pathway', anchor_construct: 'ANXIETY', stakeholder: 'student' }),
  entry({ category: 'learning', sub_type: 'course', anchor_construct: 'ANXIETY', stakeholder: 'student' }),
  entry({ category: 'project', sub_type: 'research', anchor_construct: 'ANXIETY', stakeholder: 'student' }),
  entry({ category: 'development', sub_type: 'communication', anchor_construct: 'ANXIETY', stakeholder: 'student' }),
  entry({ category: 'career', sub_type: 'cluster', anchor_construct: 'FOCUS', stakeholder: 'student' }),     // inactive construct
  entry({ category: 'career', sub_type: 'cluster', anchor_construct: 'ANXIETY', stakeholder: 'parent' }),    // other stakeholder
];

// Lineage: all hops resolved except concern_to_capability + capability_to_problem.
const HOPS: { key: string; step: number }[] = [
  { key: 'response_to_signal', step: 1 },
  { key: 'signal_to_concern', step: 2 },
  { key: 'concern_to_capability', step: 3 },
  { key: 'capability_to_problem', step: 4 },
  { key: 'problem_to_behavior', step: 5 },
  { key: 'behavior_to_archetype', step: 6 },
  { key: 'archetype_to_intervention', step: 7 },
];
const UNRESOLVED = new Set(['concern_to_capability', 'capability_to_problem']);
const lineagePartial: PipelineHop[] = HOPS.map((h) => ({
  step: h.step, key: h.key as PipelineHop['key'], label: h.key, resolved: !UNRESOLVED.has(h.key), summary: '', data: null,
}));
const lineageComplete: PipelineHop[] = HOPS.map((h) => ({
  step: h.step, key: h.key as PipelineHop['key'], label: h.key, resolved: true, summary: '', data: null,
}));
const lineageEmpty: PipelineHop[] = HOPS.map((h) => ({
  step: h.step, key: h.key as PipelineHop['key'], label: h.key, resolved: false, summary: '', data: null,
}));

const ACTIVE: ActiveConstruct[] = [{ key: 'ANXIETY', source: 'intervention' }];

// ── catalog selection ─────────────────────────────────────────────────────────
console.log('catalog-selection');
{
  const sel = selectCatalog(CATALOG, { constructs: ['ANXIETY'], stakeholder: 'student' });
  ok('selects only active construct + stakeholder', sel.every((e) => e.anchor_construct === 'ANXIETY' && e.stakeholder === 'student'));
  ok('excludes inactive constructs (no orphan)', !sel.some((e) => e.anchor_construct === 'FOCUS'));
  ok('category filter narrows', selectCatalog(CATALOG, { constructs: ['ANXIETY'], stakeholder: 'student', category: 'learning' }).every((e) => e.category === 'learning'));
  ok('empty active set → empty selection', selectCatalog(CATALOG, { constructs: [], stakeholder: 'student' }).length === 0);
}

// ── deepest resolved hop ────────────────────────────────────────────────────────
console.log('deepest-resolved-hop');
ok('caps at preferred when resolved', deepestResolvedHop(lineageComplete, 'archetype_to_intervention') === 'archetype_to_intervention');
ok('falls back below unresolved preferred', deepestResolvedHop(lineagePartial, 'capability_to_problem') === 'signal_to_concern');
ok('empty lineage → null', deepestResolvedHop(lineageEmpty, 'archetype_to_intervention') === null);

// ── generator: 4 categories + sub_type + no orphan ──────────────────────────────
console.log('generator');
{
  const set = generateRecommendations(CATALOG, ACTIVE, lineagePartial, 'student');
  ok('produces 4 categories', set.categories.length === 4 && set.categories.map((c) => c.category).join(',') === 'career,learning,project,development');
  ok('every rec anchored to an active construct (no orphan)', set.categories.every((c) => c.items.every((i) => i.anchor_construct === 'ANXIETY')));
  ok('career has 2 sub_types', new Set(set.categories.find((c) => c.category === 'career')!.items.map((i) => i.sub_type)).size === 2);
  ok('ranks are 1..n', set.categories.every((c) => c.items.every((i, idx) => i.rank === idx + 1)));
  const empty = generateRecommendations(CATALOG, [], lineagePartial, 'student');
  ok('no active constructs → all categories empty with note', empty.categories.every((c) => c.items.length === 0 && !!c.note));
}

// ── explainability: 100% coverage + honest chain completeness ───────────────────
console.log('explainability');
{
  const set = generateRecommendations(CATALOG, ACTIVE, lineagePartial, 'student');
  const traced = attachRecommendationExplainability(set, lineagePartial);
  ok('coverage = 1 (every rec has ≥1 real resolved hop)', traced.explainability.coverage === 1 && traced.explainability.fully_traceable);
  ok('every rec trace ends with rec node', traced.categories.every((c) => c.items.every((i) => i.trace[i.trace.length - 1].key === 'intervention_to_recommendation')));
  ok('trace contains only resolved hops + rec node', traced.categories.every((c) => c.items.every((i) =>
    i.trace.slice(0, -1).every((n) => !UNRESOLVED.has(n.key)))));
  ok('chain_complete false on partial lineage', traced.categories.every((c) => c.items.every((i) => i.chain_complete === false)));
  ok('unresolved_hops honestly reported (2)', traced.explainability.unresolved_hops === 2);

  const tracedComplete = attachRecommendationExplainability(generateRecommendations(CATALOG, ACTIVE, lineageComplete, 'student'), lineageComplete);
  ok('chain_complete true when all hops resolved', tracedComplete.categories.every((c) => c.items.every((i) => i.chain_complete === true)));
  ok('chain_complete_count > 0 when complete', tracedComplete.explainability.chain_complete_count > 0);

  const tracedEmpty = attachRecommendationExplainability(generateRecommendations(CATALOG, [], lineageEmpty, 'student'), lineageEmpty);
  ok('empty set coverage vacuously 1', tracedEmpty.explainability.coverage === 1 && tracedEmpty.explainability.total_recommendations === 0);
}

// ── readiness banding + degraded cap ────────────────────────────────────────────
console.log('readiness');
{
  const traced = attachRecommendationExplainability(generateRecommendations(CATALOG, ACTIVE, lineagePartial, 'student'), lineagePartial);
  const degraded = computeRecReadiness(traced.categories, traced.explainability, true);
  ok('degraded never reads as ready (capped to partial)', degraded.band !== 'ready');
  ok('degraded data_completeness = 0.5', degraded.components.data_completeness === 0.5);
  const tracedComplete = attachRecommendationExplainability(generateRecommendations(CATALOG, ACTIVE, lineageComplete, 'student'), lineageComplete);
  const ready = computeRecReadiness(tracedComplete.categories, tracedComplete.explainability, false);
  ok('non-degraded full coverage → ready', ready.band === 'ready' && ready.score >= 80);
  // Empty set: explainability is vacuously 1.0 but readiness must NOT inflate.
  const emptyTraced = attachRecommendationExplainability(generateRecommendations(CATALOG, [], lineageEmpty, 'student'), lineageEmpty);
  const empty = computeRecReadiness(emptyTraced.categories, emptyTraced.explainability, true);
  ok('empty set → thin (no inflation from vacuous coverage)', empty.band === 'thin');
  ok('empty set explainability component zeroed', empty.components.explainability === 0);
}

console.log(`\n${passed} assertions passed.`);
