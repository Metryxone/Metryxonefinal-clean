/**
 * Phase-5 Intervention Intelligence engine tests — pure, deterministic. Run with:
 *   npx tsx backend/tests/intervention-intelligence-engine.test.ts
 *
 * These assert the SHAPE and INVARIANTS of generation/scoring/projection, NOT
 * specific validator pass-rates (those are honest measurements reported by the
 * runner and are allowed to fail — never asserted to a target here).
 */
import {
  INTERVENTION_TYPES, STAKEHOLDERS, INTERVENTION_ANCHORS, HORIZON_DAYS,
  generateInterventions, scoreIntervention, interventionFlags, projectImpacts,
  outcomeStatement, alignmentHits, auditDuplicates, INTERVENTION_VALIDATION_TARGETS,
  type GeneratedIntervention,
} from '../services/pil/intervention-intelligence-engine.js';
import { isAligned, checkRealism } from '../services/pil/human-intelligence-engine.js';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

const KEYS = Object.keys(INTERVENTION_ANCHORS);
const items = generateInterventions(KEYS);

console.log('\n[intervention-intelligence-engine] generation');
ok('22 archetype anchors authored', KEYS.length === 22, `got ${KEYS.length}`);
ok('6 intervention types', INTERVENTION_TYPES.length === 6, `got ${INTERVENTION_TYPES.length}`);
ok('full cross-product = 660', items.length === KEYS.length * INTERVENTION_TYPES.length * STAKEHOLDERS.length, `got ${items.length}`);

// every archetype has all 6 intervention types AND all 5 stakeholders
{
  let allCovered = true;
  for (const k of KEYS) {
    const rows = items.filter((i) => i.archetype_key === k);
    const ty = new Set(rows.map((r) => r.intervention_type));
    const st = new Set(rows.map((r) => r.stakeholder));
    if (ty.size !== INTERVENTION_TYPES.length || st.size !== STAKEHOLDERS.length) { allCovered = false; break; }
  }
  ok('every archetype covers all 6 types × 5 stakeholders', allCovered);
}

// no empty / placeholder text + full outcome set
ok('no empty intervention text', items.every((i) => i.text.trim().length > 0));
ok('no leftover template tokens', items.every((i) => !/\$\{|\bundefined\b/.test(i.text)));
ok('every item carries a full outcome set', items.every((i) => i.expected_outcome.trim() && i.success_indicator.trim() && i.progress_indicator.trim()));
ok('no leftover tokens in outcomes', items.every((i) => !/\$\{|\bundefined\b/.test(i.expected_outcome + i.success_indicator + i.progress_indicator)));

// anchors are pronoun-neutral (no you/your); the stakeholder template owns the subject
{
  const anchorBlobs: string[] = [];
  for (const a of Object.values(INTERVENTION_ANCHORS)) {
    anchorBlobs.push(a.immediate, a.week, a.month, a.quarter, a.habit, a.skill);
  }
  const offenders = anchorBlobs.filter((s) => /\byou\b|\byour\b/i.test(s));
  ok('intervention anchors are pronoun-neutral (no you/your)', offenders.length === 0, offenders.slice(0, 3).join(' | '));
}

console.log('\n[intervention-intelligence-engine] scoring invariants');
{
  let inRange = true;
  for (const i of items) {
    const q = scoreIntervention(i.text, i.archetype_key, i.stakeholder, i);
    for (const v of [q.practicality, q.actionability, q.outcome_clarity, q.stakeholder_relevance, q.archetype_alignment]) {
      if (v < 1 || v > 5 || !Number.isInteger(v)) inRange = false;
    }
    if (q.composite < 1 || q.composite > 5) inRange = false;
  }
  ok('all five scores are integers in 1..5 and composite in range', inRange);
}
ok('scoring is deterministic', (() => {
  const a = scoreIntervention(items[0].text, items[0].archetype_key, items[0].stakeholder, items[0]);
  const b = scoreIntervention(items[0].text, items[0].archetype_key, items[0].stakeholder, items[0]);
  return JSON.stringify(a) === JSON.stringify(b);
})());

console.log('\n[intervention-intelligence-engine] impact projections');
{
  let valid = true;
  for (const i of items) {
    const q = scoreIntervention(i.text, i.archetype_key, i.stakeholder, i);
    const p = projectImpacts(i.intervention_type, q);
    if (p.confidence_impact < 0 || p.confidence_impact > 1) valid = false;
    if (p.risk_reduction_impact < 0 || p.risk_reduction_impact > 1) valid = false;
  }
  ok('projected impacts are in [0,1]', valid);
  ok('projections are deterministic', (() => {
    const q = scoreIntervention(items[0].text, items[0].archetype_key, items[0].stakeholder, items[0]);
    return JSON.stringify(projectImpacts(items[0].intervention_type, q)) === JSON.stringify(projectImpacts(items[0].intervention_type, q));
  })());
  // longer horizons project at least as much confidence as immediate (monotone by design)
  const q5 = scoreIntervention('placeholder', 'focus_attention', 'student', items[0]);
  ok('90-day horizon projects ≥ immediate confidence', projectImpacts('ninety_day', q5).confidence_impact >= projectImpacts('immediate_actions', q5).confidence_impact);
}

console.log('\n[intervention-intelligence-engine] horizon + outcome statement');
ok('timed types have positive horizons; ongoing (habit/skill) are 0', INTERVENTION_TYPES.every((t) =>
  (t === 'habit' || t === 'skill_building') ? HORIZON_DAYS[t] === 0 : HORIZON_DAYS[t] > 0));
{
  const s = outcomeStatement('feel calmer under pressure', 'parent');
  ok('parent outcome statement is third-person ("Your child")', /your child/i.test(s), s);
  const p = outcomeStatement('feel calmer under pressure', 'professional');
  ok('professional outcome statement is addressed ("You")', /\byou\b/i.test(p), p);
}

console.log('\n[intervention-intelligence-engine] alignment');
ok('alignmentHits agrees with isAligned (hits>0 ⇔ aligned)', items.every((i) => {
  const hits = alignmentHits(i.text, i.archetype_key);
  return (hits > 0) === isAligned(i.text, i.archetype_key);
}));

console.log('\n[intervention-intelligence-engine] duplicate audit');
{
  const { rows, duplicateMembers } = auditDuplicates(items);
  ok('audit returns a set of later-member indexes', duplicateMembers instanceof Set);
  ok('every dup row has a kind', rows.every((r) => ['identical', 'semantic', 'stakeholder'].includes(r.kind)));
  const withDup: GeneratedIntervention[] = [
    { ...items[0], stakeholder: 'student', text: 'do one focused 25-minute block today' },
    { ...items[0], stakeholder: 'parent', text: 'do one focused 25-minute block today' },
  ];
  const r2 = auditDuplicates(withDup);
  ok('identical text flagged + stakeholder dup recorded', r2.duplicateMembers.has(1) && r2.rows.some((r) => r.kind === 'stakeholder'));
}

console.log('\n[intervention-intelligence-engine] honest metric snapshot (NOT asserted to target)');
{
  const total = items.length;
  const practical = items.filter((i) => scoreIntervention(i.text, i.archetype_key, i.stakeholder, i).practicality >= 4).length;
  const actionable = items.filter((i) => scoreIntervention(i.text, i.archetype_key, i.stakeholder, i).actionability >= 4).length;
  const aligned = items.filter((i) => interventionFlags(i.text, i.archetype_key, i.stakeholder, i).aligned).length;
  const { duplicateMembers } = auditDuplicates(items);
  console.log(`    practicality ≥4 ${((practical / total) * 100).toFixed(1)}% (target >${INTERVENTION_VALIDATION_TARGETS.practicality * 100}%)`);
  console.log(`    actionability ≥4 ${((actionable / total) * 100).toFixed(1)}% (target >${INTERVENTION_VALIDATION_TARGETS.actionability * 100}%)`);
  console.log(`    alignment ${((aligned / total) * 100).toFixed(1)}% (target >${INTERVENTION_VALIDATION_TARGETS.archetype_alignment * 100}%)`);
  console.log(`    duplicate ${((duplicateMembers.size / total) * 100).toFixed(1)}% (target <${INTERVENTION_VALIDATION_TARGETS.duplicate_rate_max * 100}%)`);
  ok('jargon-free across the whole set (sanity)', items.every((i) => checkRealism(i.text).jargon.length === 0));
}

console.log(`\n[intervention-intelligence-engine] ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
