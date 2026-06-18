// Phase 9 — prediction-engine pure-model tests (run: npx tsx tests/prediction-engine.test.ts)
import {
  predict,
  predictReadiness,
  predictInterventionImpact,
  deriveFutureRisks,
  deriveGrowthOpportunities,
  deriveRecommendedPriorities,
  matchDimension,
  dimensionsFor,
  severityToNumber,
  type PredictionInput,
  type PredInputChainStage,
} from '../services/pil/prediction-engine';
import { LINEAGE_SPINE } from '../services/pil/graph-traversal-engine';

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, extra ?? ''); }
}
function approx(a: number, b: number, eps = 1e-9) { return Math.abs(a - b) < eps; }

function stages(resolved: number): PredInputChainStage[] {
  return (LINEAGE_SPINE as readonly string[]).map((c, i) => ({
    category: c, label: i < resolved ? `${c} x` : null, resolved: i < resolved,
  }));
}

function makeInput(over: Partial<PredictionInput> = {}): PredictionInput {
  return {
    source: 'session',
    subject_id: 's1',
    concern_label: 'Career anxiety',
    archetype_key: 'A1',
    archetype_name: 'The Striver',
    signals: [],
    strengths: [],
    interventions: [],
    active_constructs: [],
    chain: { source: 'pipeline', anchor: 'c1', stages: stages(7), resolved_hops: 7, total_hops: 7, degraded: false },
    ...over,
  };
}

console.log('Phase 9 prediction-engine tests\n');

// 1. severity mapping
ok('severityToNumber high>moderate>low', severityToNumber('high') > severityToNumber('moderate') && severityToNumber('moderate') > severityToNumber('low'));
ok('severityToNumber numeric passthrough 0..1', approx(severityToNumber(0.42), 0.42));
ok('severityToNumber 0..100 normalized', approx(severityToNumber(80), 0.8));
ok('severityToNumber unknown → neutral 0.5', severityToNumber('???') === 0.5);

// 2. lexicon matching (curated, no generic META)
ok('career token matches', matchDimension('interview networking job', 'career').length >= 2);
ok('learning token matches', matchDimension('exam study habits', 'learning').length >= 1);
ok('future returns [] (overall)', matchDimension('anything', 'future').length === 0);
ok('dimensionsFor multi', dimensionsFor('leadership and learning skill').includes('leadership') && dimensionsFor('leadership and learning skill').includes('learning'));

// 3. neutral baseline with no evidence
const neutral = predictReadiness('future', makeInput());
ok('no-evidence readiness == base 0.5', approx(neutral.score, 0.5));
ok('no-evidence confidence low (no relevant evidence)', neutral.confidence_band === 'low');

// 4. monotonicity: more risk ⇒ lower readiness
const lowRisk = makeInput({ signals: [{ key: 'k', label: 'overthinking', severity: 0.3, strength: 0.5, confidence: 0.8, active: true }] });
const highRisk = makeInput({ signals: [{ key: 'k', label: 'overthinking', severity: 0.9, strength: 0.5, confidence: 0.8, active: true }] });
ok('higher severity ⇒ lower future readiness', predictReadiness('future', highRisk).score < predictReadiness('future', lowRisk).score);

// 5. inactive signals don't count
const inactive = makeInput({ signals: [{ key: 'k', label: 'x', severity: 0.9, strength: 0.5, confidence: 0.8, active: false }] });
ok('inactive signal ignored ⇒ baseline', approx(predictReadiness('future', inactive).score, 0.5));

// 6. strengths raise readiness
const withStrength = makeInput({ strengths: [{ label: 'Resilience', evidence: 'bounced back', confidence: 0.9 }] });
ok('strength raises future readiness above base', predictReadiness('future', withStrength).score > 0.5);

// 7. intervention uplift only affects expected outcome, not current
const withIv = makeInput({
  signals: [{ key: 'k', label: 'job stress', severity: 0.8, strength: 0.5, confidence: 0.8, active: true }],
  interventions: [{ key: 'iv1', title: 'Interview coaching for career', construct: 'career_readiness', expected_impact: 0.8, confidence: 0.9, addressable_severity: 0.8 }],
});
const careerPred = predictReadiness('career', withIv);
ok('expected outcome >= current (uplift)', careerPred.expected_outcome.score >= careerPred.score);
ok('uplift > 0 when relevant intervention present', careerPred.expected_outcome.uplift > 0);
ok('intervention lever surfaced', careerPred.intervention_levers.length === 1);

// 8. chain completeness drives confidence
const full = makeInput({ strengths: [{ label: 'Career planning', evidence: 'set goals', confidence: 0.9 }], chain: { source: 'pipeline', anchor: 'c', stages: stages(7), resolved_hops: 7, total_hops: 7, degraded: false } });
const degraded = makeInput({ strengths: [{ label: 'Career planning', evidence: 'set goals', confidence: 0.9 }], chain: { source: 'pipeline', anchor: 'c', stages: stages(2), resolved_hops: 2, total_hops: 7, degraded: true } });
ok('full chain ⇒ higher confidence than degraded', predictReadiness('career', full).confidence > predictReadiness('career', degraded).confidence);
ok('degraded flagged', predictReadiness('career', degraded).degraded === true);

// 9. intervention impact prediction ranking + math
const impacts = predictInterventionImpact(makeInput({
  interventions: [
    { key: 'a', title: 'low', construct: 'x', expected_impact: 0.2, confidence: 0.5, addressable_severity: 0.4 },
    { key: 'b', title: 'high', construct: 'y', expected_impact: 0.9, confidence: 0.9, addressable_severity: 0.9 },
  ],
}));
ok('impacts ranked by predicted_reduction desc', impacts[0].key === 'b');
ok('predicted_impact = expected×confidence', approx(impacts[0].predicted_impact, 0.81));

// 10. future risks: mitigable vs persistent
const risks = deriveFutureRisks(makeInput({
  signals: [
    { key: 'r1', label: 'career doubt', severity: 0.7, strength: 0.5, confidence: 0.8, active: true },
    { key: 'r2', label: 'study avoidance', severity: 0.6, strength: 0.5, confidence: 0.8, active: true },
  ],
  interventions: [{ key: 'iv', title: 'career coaching', construct: 'career', expected_impact: 0.7, confidence: 0.8, addressable_severity: 0.7 }],
}));
ok('risks derived from active signals', risks.length === 2);
ok('projected >= current severity', risks.every((r) => r.projected_if_unaddressed >= r.severity));

// 11. growth from strengths only
const growth = deriveGrowthOpportunities(makeInput({ strengths: [{ label: 'Curiosity', evidence: 'explores', confidence: 0.8 }] }));
ok('growth derived from strengths', growth.length === 1 && growth[0].label === 'Curiosity');

// 12. priorities ranked
const prios = deriveRecommendedPriorities(makeInput({
  interventions: [
    { key: 'a', title: 'a', construct: 'x', expected_impact: 0.3, confidence: 0.5, addressable_severity: 0.5 },
    { key: 'b', title: 'b', construct: 'y', expected_impact: 0.9, confidence: 0.9, addressable_severity: 0.9 },
  ],
}));
ok('priority rank 1 is highest impact', prios[0].rank === 1 && prios[0].key === 'b');

// 13. determinism
const i = makeInput({ signals: [{ key: 'k', label: 'job stress', severity: 0.7, strength: 0.5, confidence: 0.8, active: true }], strengths: [{ label: 'Resilience', evidence: 'e', confidence: 0.8 }] });
const r1 = JSON.stringify({ ...predict(i), generated_at: '' });
const r2 = JSON.stringify({ ...predict(i), generated_at: '' });
ok('predict() is deterministic', r1 === r2);

// 14. never-throws on empty input
let threw = false;
try {
  const empty = makeInput({ chain: { source: 'none', anchor: null, stages: stages(0), resolved_hops: 0, total_hops: 7, degraded: true } });
  const res = predict(empty);
  ok('empty input yields 4 readiness dims', res.readiness.length === 4);
  ok('empty input explainability score 0', res.explainability.score === 0 || res.explainability.predictions_traced === 0);
} catch { threw = true; }
ok('predict() never throws on empty', !threw);

// 15. full set shape
const full2 = predict(makeInput({
  signals: [{ key: 'k', label: 'career doubt', severity: 0.6, strength: 0.5, confidence: 0.8, active: true }],
  strengths: [{ label: 'Resilience', evidence: 'e', confidence: 0.8 }],
  interventions: [{ key: 'iv', title: 'career coaching', construct: 'career', expected_impact: 0.7, confidence: 0.8, addressable_severity: 0.6 }],
}));
ok('has all output sections', !!full2.readiness && !!full2.intervention_impact && !!full2.future_risks && !!full2.growth_opportunities && !!full2.recommended_priorities && !!full2.expected_outcomes);
ok('explainability score in 0..1', full2.explainability.score >= 0 && full2.explainability.score <= 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
