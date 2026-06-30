/**
 * Guarantees the CANONICAL STAGE WRITERS only ever emit EXACT proper-cased canonical stored
 * labels (Task #310). The read-layer normalization (Task #306) is proven byte-identical to the
 * legacy ad-hoc maps ONLY while `canonical_stage` is persisted as a clean proper-cased label
 * ('Awareness' | 'Curiosity' | 'Clarity' | 'Growth' | 'Mastery') with no surrounding whitespace.
 * If a writer ever stored ' clarity ' / 'CLARITY' / a raw 'CAP_*' code, that assumption would
 * break silently. This test fails LOUDLY (exit 1) if any writer path could persist such a value.
 *
 * Writers covered (per Task #310 + the actual call graph):
 *   1. `canonicalStageFor`  (stage-intelligence)        → wc3_stage_state / wc3_stage_progression.canonical_stage
 *   2. `captureLongitudinalSnapshot` write-site guard    → wc3_longitudinal_snapshots.canonical_stage
 *   3. outcome-model insert source                       → wc3_outcome_state.current_stage / desired_stage
 *
 * Pure, no DB, no I/O. Run: `npx tsx scripts/verify-canonical-stage-writers.ts` from backend/.
 */
import {
  STORED_STAGE_ORDER,
  UNCODED_PRE_STAGE,
  INSIGHT_DISPLAY_ALIAS,
  LIFECYCLE_STAGE_CODES,
  isCanonicalStoredStage,
  toCanonicalStoredStage,
} from '../lib/lifecycle';
import { canonicalStageFor, STAGE_ENTITY_MAP, WC3_PROGRESSION_ORDER } from '../services/wc3/stage-intelligence';

let failures = 0;
let checks = 0;

function assert(name: string, cond: boolean, detail?: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** The ONLY values any writer is permitted to persist into a stage string column. */
const ALLOWED = new Set<string>(STORED_STAGE_ORDER);

/** Adversarial non-canonical representations a future writer might accidentally pass through. */
const NON_CANONICAL_SAMPLES = [
  ' Clarity ', '  Mastery  ', 'clarity', 'CLARITY', 'growth', 'GROWTH',
  'CAP_INS', 'cap_ins', 'CAP_CUR', 'cap_grw', 'CAP_MAS', 'cap_awr',
  'Insight', 'insight', ' awareness', 'Awareness ',
];

console.log('— PART A: canonicalStageFor only ever returns a canonical stored label —');
// Exhaustive over every coded stage + the uncoded path (null/undefined) + unknown junk.
const stageCodeInputs: Array<string | null | undefined> = [
  ...LIFECYCLE_STAGE_CODES, ...LIFECYCLE_STAGE_CODES.map((c) => c.toLowerCase()),
  null, undefined, '', '   ', 'CAP_AWR', 'NOT_A_CODE', 'random',
];
for (const code of stageCodeInputs) {
  const out = canonicalStageFor(code);
  assert(`canonicalStageFor(${JSON.stringify(code)}) ∈ STORED_STAGE_ORDER`, ALLOWED.has(out), `got ${JSON.stringify(out)}`);
  assert(`canonicalStageFor(${JSON.stringify(code)}) isCanonicalStoredStage`, isCanonicalStoredStage(out), `got ${JSON.stringify(out)}`);
}
// Recognised codes map to the EXPECTED stored label (alias-aware: CAP_INS → 'Clarity').
assert('CAP_CUR → Curiosity', canonicalStageFor('CAP_CUR') === 'Curiosity');
assert('CAP_INS → Clarity (alias)', canonicalStageFor('CAP_INS') === INSIGHT_DISPLAY_ALIAS);
assert('CAP_GRW → Growth', canonicalStageFor('CAP_GRW') === 'Growth');
assert('CAP_MAS → Mastery', canonicalStageFor('CAP_MAS') === 'Mastery');
assert('null → Awareness (uncoded pre-stage)', canonicalStageFor(null) === UNCODED_PRE_STAGE);

console.log('— PART B: STAGE_ENTITY_MAP + progression order are all canonical labels —');
for (const [code, label] of Object.entries(STAGE_ENTITY_MAP)) {
  assert(`STAGE_ENTITY_MAP[${code}]=${JSON.stringify(label)} ∈ STORED_STAGE_ORDER`, ALLOWED.has(label));
}
assert('WC3_PROGRESSION_ORDER === STORED_STAGE_ORDER (single source)', WC3_PROGRESSION_ORDER === STORED_STAGE_ORDER);
for (const s of WC3_PROGRESSION_ORDER) {
  assert(`outcome desired_stage source ${JSON.stringify(s)} isCanonicalStoredStage`, isCanonicalStoredStage(s));
}

console.log('— PART C: toCanonicalStoredStage (write-site guard) never yields a non-canonical string —');
// Every recognised representation coerces to its proper stored label; junk → null.
const coerceCases: Array<[string | null | undefined, string | null]> = [
  ['Curiosity', 'Curiosity'], ['Clarity', 'Clarity'], ['Growth', 'Growth'], ['Mastery', 'Mastery'], ['Awareness', 'Awareness'],
  [' Clarity ', 'Clarity'], ['CLARITY', 'Clarity'], ['clarity', 'Clarity'],
  ['CAP_INS', 'Clarity'], ['cap_ins', 'Clarity'], ['Insight', 'Clarity'], ['insight', 'Clarity'],
  ['CAP_CUR', 'Curiosity'], ['CAP_GRW', 'Growth'], ['CAP_MAS', 'Mastery'],
  ['cap_awr', 'Awareness'], [' awareness ', 'Awareness'],
  ['', null], ['   ', null], [null, null], [undefined, null], ['Bogus', null], ['CAP_XXX', null],
];
for (const [input, expected] of coerceCases) {
  const out = toCanonicalStoredStage(input);
  assert(`toCanonicalStoredStage(${JSON.stringify(input)}) = ${JSON.stringify(expected)}`, out === expected, `got ${JSON.stringify(out)}`);
  assert(`toCanonicalStoredStage(${JSON.stringify(input)}) is null|canonical`, out === null || isCanonicalStoredStage(out), `got ${JSON.stringify(out)}`);
}

console.log('— PART D: isCanonicalStoredStage rejects every non-canonical casing/whitespace variant —');
for (const v of NON_CANONICAL_SAMPLES) {
  assert(`isCanonicalStoredStage(${JSON.stringify(v)}) === false`, isCanonicalStoredStage(v) === false);
}
for (const v of STORED_STAGE_ORDER) {
  assert(`isCanonicalStoredStage(${JSON.stringify(v)}) === true`, isCanonicalStoredStage(v) === true);
}
assert('isCanonicalStoredStage(null) === false', isCanonicalStoredStage(null) === false);
assert('isCanonicalStoredStage(undefined) === false', isCanonicalStoredStage(undefined) === false);

console.log('— PART E: longitudinal write-site guard coerces caller input to canon (incl. raw stage_code) —');
// Mirror the guard in captureLongitudinalSnapshot: every value a caller could pass (incl. the raw
// stage_code 'CAP_INS' that the user-intelligence backfill historically passed) must land canon|null.
const callerInputs: Array<string | null | undefined> = [
  ...STORED_STAGE_ORDER, 'CAP_INS', 'CAP_CUR', 'CAP_GRW', 'CAP_MAS', ' Clarity ', 'CLARITY', null, undefined, '', 'junk',
];
for (const input of callerInputs) {
  const persisted = toCanonicalStoredStage(input ?? null); // exactly what the guard persists
  assert(`guard persists null|canonical for ${JSON.stringify(input)}`, persisted === null || isCanonicalStoredStage(persisted), `got ${JSON.stringify(persisted)}`);
}

console.log(`\n${failures === 0 ? '✓ PASS' : '✗ FAIL'} — ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
