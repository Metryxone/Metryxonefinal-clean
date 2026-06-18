/**
 * Tests for atomic-bridge-resolver (run: npx tsx backend/tests/atomic-bridge-resolver.test.ts)
 */
import {
  resolveNegativeAtomicBridge,
  NEGATIVE_FAMILY_BRIDGE_MAP,
  RESOLVER_TARGET_TAGS,
  GENERAL_CONCERN_TAG,
} from '../services/atomic-bridge-resolver';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error('  ✗ FAIL:', msg); }
}

// ── Curated families resolve to their mapped tag ─────────────────────────────
assert(resolveNegativeAtomicBridge('procrastination_signals').resolved_tag === 'DISCIPLINE_HABITS',
  'procrastination → DISCIPLINE_HABITS');
assert(resolveNegativeAtomicBridge('self_worth_signals').resolved_tag === 'SELF_WORTH',
  'self_worth → SELF_WORTH');
assert(resolveNegativeAtomicBridge('communication_anxiety_signals').resolved_tag === 'COMMUNICATION_EXPRESSION',
  'communication_anxiety → COMMUNICATION_EXPRESSION');
assert(resolveNegativeAtomicBridge('procrastination_signals').route === 'family_curated',
  'curated route label');

// ── Whitespace tolerance ─────────────────────────────────────────────────────
assert(resolveNegativeAtomicBridge('  burnout_signals  ').resolved_tag === 'LIFESTYLE_PRESSURE',
  'trims whitespace');

// ── Ambiguous / capability / ethics families are flagged, never guessed ──────
for (const fam of [
  'confusion_signals', 'reasoning_signals', 'problem_solving_signals',
  'professional_ethics_signals', 'integrity_under_observation_signals',
  'evaluation_anxiety_signals', 'decision_signals', 'unknown_family_xyz',
]) {
  const r = resolveNegativeAtomicBridge(fam);
  assert(r.resolved_tag === null && r.route === 'flagged_review', `${fam} → flagged`);
}

// ── Empty / nullish input never throws and is flagged ────────────────────────
assert(resolveNegativeAtomicBridge('').resolved_tag === null, 'empty → flagged');
// @ts-expect-error testing nullish robustness
assert(resolveNegativeAtomicBridge(undefined).resolved_tag === null, 'undefined → flagged');

// ── Invariants ───────────────────────────────────────────────────────────────
assert(GENERAL_CONCERN_TAG === 'GENERAL_CONCERN', 'catch-all constant');
assert(!Object.values(NEGATIVE_FAMILY_BRIDGE_MAP).includes(GENERAL_CONCERN_TAG),
  'never maps a family back to GENERAL_CONCERN');
for (const [fam, tag] of Object.entries(NEGATIVE_FAMILY_BRIDGE_MAP)) {
  assert(typeof tag === 'string' && tag.length > 0 && tag === tag.toUpperCase(),
    `target tag for ${fam} is a non-empty UPPER tag`);
  assert(RESOLVER_TARGET_TAGS.has(tag), `${tag} present in RESOLVER_TARGET_TAGS`);
}

console.log(`\natomic-bridge-resolver: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
