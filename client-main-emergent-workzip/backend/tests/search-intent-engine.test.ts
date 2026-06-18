/**
 * Phase-4 Search Intent engine tests — pure, deterministic. Run with:
 *   npx tsx backend/tests/search-intent-engine.test.ts
 *
 * These assert the SHAPE and INVARIANTS of generation/scoring, NOT specific
 * validator pass-rates (those are honest measurements reported by the runner and
 * are allowed to fail — never asserted to a target here).
 */
import {
  INTENT_TYPES, STAKEHOLDERS, SEARCH_ANCHORS,
  generateSearchIntents, scoreSearchIntent, intentFlags, auditDuplicates,
  alignmentHits, SEARCH_VALIDATION_TARGETS,
  type GeneratedIntent,
} from '../services/pil/search-intent-engine.js';
import { isAligned, checkRealism } from '../services/pil/human-intelligence-engine.js';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

const KEYS = Object.keys(SEARCH_ANCHORS);
const intents = generateSearchIntents(KEYS);

console.log('\n[search-intent-engine] generation');
ok('22 archetype anchors authored', KEYS.length === 22, `got ${KEYS.length}`);
ok('full cross-product produced', intents.length === KEYS.length * INTENT_TYPES.length * STAKEHOLDERS.length, `got ${intents.length}`);

// every archetype has all 5 intent types AND all 5 stakeholders
{
  let allCovered = true;
  for (const k of KEYS) {
    const rows = intents.filter((i) => i.archetype_key === k);
    const it = new Set(rows.map((r) => r.intent_type));
    const st = new Set(rows.map((r) => r.stakeholder));
    if (it.size !== INTENT_TYPES.length || st.size !== STAKEHOLDERS.length) { allCovered = false; break; }
  }
  ok('every archetype covers all 5 intents × 5 stakeholders', allCovered);
}

// no empty / placeholder phrases
ok('no empty phrases', intents.every((i) => i.search_phrase.trim().length > 0));
ok('no leftover template tokens', intents.every((i) => !/\$\{|\bundefined\b/.test(i.search_phrase)));

// grammar regression: "why does (my child|a student|a client) X" must be BASE form,
// never a 3rd-person-singular verb (no "...does my child freezes/studies/has...").
{
  const offenders = intents.filter((i) =>
    /^why does (my child|a student|a client) \w+(s|es|ies)\b/.test(i.search_phrase)
    && !/^why does (my child|a student|a client) (focus|address|process|access|express|progress|stress|discuss)\b/.test(i.search_phrase),
  );
  ok('diagnostic "does ..." templates use base-form verbs (no 3rd-person-s)', offenders.length === 0,
    offenders.slice(0, 3).map((o) => o.search_phrase).join(' | '));
}

console.log('\n[search-intent-engine] scoring invariants');
{
  let inRange = true;
  for (const i of intents) {
    const q = scoreSearchIntent(i.search_phrase, i.archetype_key, i.intent_type);
    for (const v of [q.search_realism, q.human_language, q.archetype_alignment, q.intent_clarity]) {
      if (v < 1 || v > 5 || !Number.isInteger(v)) inRange = false;
    }
    if (q.composite < 1 || q.composite > 5) inRange = false;
  }
  ok('all four scores are integers in 1..5 and composite in range', inRange);
}
ok('scoring is deterministic', (() => {
  const a = scoreSearchIntent(intents[0].search_phrase, intents[0].archetype_key, intents[0].intent_type);
  const b = scoreSearchIntent(intents[0].search_phrase, intents[0].archetype_key, intents[0].intent_type);
  return JSON.stringify(a) === JSON.stringify(b);
})());

// jargon must tank both realism + human language
{
  const q = scoreSearchIntent('improve metacognitive regulation and self-efficacy calibration', 'focus_attention', 'help_seeking');
  ok('psychometric jargon scores low realism & human language', q.search_realism <= 2 && q.human_language <= 3, JSON.stringify(q));
}

console.log('\n[search-intent-engine] alignment');
ok('alignmentHits agrees with isAligned (hits>0 ⇔ aligned)', intents.every((i) => {
  const hits = alignmentHits(i.search_phrase, i.archetype_key);
  return (hits > 0) === isAligned(i.search_phrase, i.archetype_key);
}));

console.log('\n[search-intent-engine] duplicate audit');
{
  const { rows, duplicateMembers } = auditDuplicates(intents);
  ok('audit returns a set of later-member indexes', duplicateMembers instanceof Set);
  ok('every dup row has a kind', rows.every((r) => ['identical', 'semantic', 'stakeholder'].includes(r.kind)));
  // identical phrases must be caught
  const withDup: GeneratedIntent[] = [
    { archetype_key: 'focus_attention', stakeholder: 'student', intent_type: 'help_seeking', search_phrase: 'how do I stay focused?' },
    { archetype_key: 'focus_attention', stakeholder: 'parent', intent_type: 'help_seeking', search_phrase: 'how do I stay focused?' },
  ];
  const r2 = auditDuplicates(withDup);
  ok('identical phrase flagged + stakeholder dup recorded', r2.duplicateMembers.has(1) && r2.rows.some((r) => r.kind === 'stakeholder'));
}

console.log('\n[search-intent-engine] honest metric snapshot (NOT asserted to target)');
{
  const total = intents.length;
  const realism = intents.filter((i) => intentFlags(i.search_phrase, i.archetype_key, i.intent_type).realism_pass).length;
  const aligned = intents.filter((i) => intentFlags(i.search_phrase, i.archetype_key, i.intent_type).aligned).length;
  const { duplicateMembers } = auditDuplicates(intents);
  const realismRate = realism / total, alignRate = aligned / total, dupRate = duplicateMembers.size / total;
  console.log(`    realism ${(realismRate * 100).toFixed(1)}% (target ≥${SEARCH_VALIDATION_TARGETS.search_realism * 100}%)`);
  console.log(`    alignment ${(alignRate * 100).toFixed(1)}% (target ≥${SEARCH_VALIDATION_TARGETS.archetype_alignment * 100}%)`);
  console.log(`    duplicate ${(dupRate * 100).toFixed(1)}% (target ≤${SEARCH_VALIDATION_TARGETS.duplicate_rate_max * 100}%)`);
  ok('jargon-free across the whole set (sanity)', intents.every((i) => checkRealism(i.search_phrase).jargon.length === 0));
}

console.log(`\n[search-intent-engine] ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
