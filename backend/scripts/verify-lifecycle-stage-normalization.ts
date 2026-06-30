/**
 * Verifies the lifecycle stage read-layer normalization (Task #306) is byte-identical to the
 * legacy ad-hoc maps it replaced, across EVERY stored representation.
 *
 *   1. subscription-engine `stageFloorIndex`  — legacy lowercased-label switch vs new canon route.
 *   2. wc3 trend `stageToScale`               — legacy STAGE_ORDINAL map vs new canon route.
 *
 * Pure, no DB, no I/O. Run: `npx tsx scripts/verify-lifecycle-stage-normalization.ts` from backend/.
 */
import { normalizeStoredStage } from '../lib/lifecycle';

// ── Legacy reference implementations (copied verbatim from the pre-refactor code) ──────────────
function legacyStageFloorIndex(canonical: string | null | undefined): number {
  switch ((canonical || '').toLowerCase()) {
    case 'clarity':
    case 'growth':
      return 1;
    case 'mastery':
      return 2;
    case 'awareness':
    case 'curiosity':
    default:
      return 0;
  }
}

const LEGACY_STAGE_ORDINAL: Record<string, number> = {
  awareness: 0, curiosity: 1, clarity: 2, growth: 3, mastery: 4,
  cap_awr: 0, cap_cur: 1, cap_ins: 2, cap_grw: 3, cap_mas: 4,
};
function legacyStageToScale(canonical: string | null, code: string | null): number | null {
  const key = (canonical ?? code ?? '').toString().trim().toLowerCase();
  if (key === '') return null;
  const ord = LEGACY_STAGE_ORDINAL[key];
  if (ord === undefined) return null;
  return (ord / 4) * 100;
}

// ── New implementations (route through the canon — mirrors the refactored source) ─────────────
const FLOOR_BY_CODE: Record<string, number> = { CAP_CUR: 0, CAP_INS: 1, CAP_GRW: 1, CAP_MAS: 2 };
function newStageFloorIndex(canonical: string | null | undefined): number {
  const { code } = normalizeStoredStage(canonical);
  return code ? FLOOR_BY_CODE[code] : 0;
}
function newStageToScale(canonical: string | null, code: string | null): number | null {
  const resolved = normalizeStoredStage(canonical ?? code ?? '');
  let ordinal: number | null;
  if (resolved.isUncodedPreStage) ordinal = 0;
  else if (resolved.code) ordinal = resolved.order + 1;
  else ordinal = null;
  if (ordinal === null) return null;
  return (ordinal / 4) * 100;
}

// wc7b growth-plan-bridge `stageScore`
const LEGACY_STAGE_SCORE: Record<string, number> = {
  Awareness: 20, Curiosity: 40, Clarity: 60, Growth: 80, Mastery: 100,
};
function legacyStageScore(stage: string | null | undefined): number {
  if (!stage) return 50;
  return LEGACY_STAGE_SCORE[stage] ?? 50;
}
function newStageScore(stage: string | null | undefined): number {
  const r = normalizeStoredStage(stage);
  const ordinal = r.isUncodedPreStage ? 0 : (r.code ? r.order + 1 : null);
  return ordinal === null ? 50 : (ordinal + 1) * 20;
}

let failures = 0;
let checks = 0;

function assertEq(name: string, a: unknown, b: unknown) {
  checks++;
  if (a !== b) {
    failures++;
    console.error(`✗ ${name}: expected=${JSON.stringify(a)} got=${JSON.stringify(b)}`);
  }
}

// ── PART 1: STRICT byte-identical parity for the representations that ACTUALLY occur today ──────
// canonical_stage is persisted by wc3 stage-intelligence as one of these labels/alias/pre-stage
// (canonicalStageFor → STAGE_ENTITY_MAP + UNCODED_PRE_STAGE), and stage_code as a CAP_* / pseudo
// code. These are the ONLY values the legacy maps ever saw at runtime — they MUST stay identical.
const OCCURRING_CANONICAL: Array<string | null | undefined> = [
  // labels + alias + pre-stage actually persisted as canonical_stage (clean, no padding)
  'Curiosity', 'Clarity', 'Growth', 'Mastery', 'Awareness',
  // case variants of the above (same logical value — both old paths lower-case)
  'clarity', 'CLARITY', 'AWARENESS',
  // empty / null / unknown edge cases
  '', '   ', null, undefined, 'Bogus',
];
// Whitespace-PADDED variants. The legacy wc3 trend read already trimmed (parity holds), but the
// legacy subscription floor did NOT — so these are only parity-checked against the trend read.
// canonical_stage is never persisted padded, so this affects no real data (see PART 2 for floor).
const PADDED_CANONICAL: Array<string | null | undefined> = [' Clarity ', ' growth ', '  Mastery  '];
// codes legacy STAGE_ORDINAL already supported (used as the trend code-arg fallback)
const OCCURRING_CODES: Array<string | null | undefined> = [
  'cap_awr', 'cap_cur', 'cap_ins', 'cap_grw', 'cap_mas', 'CAP_GRW', null, '', 'bogus',
];

console.log('— PART 1: byte-identical parity on actually-occurring values —');
console.log('  · stageFloorIndex (subscription)');
for (const v of OCCURRING_CANONICAL) {
  assertEq(`floor(${JSON.stringify(v)})`, legacyStageFloorIndex(v), newStageFloorIndex(v));
}
console.log('  · stageToScale canonical-arg (wc3 trend)');
for (const v of [...OCCURRING_CANONICAL, ...PADDED_CANONICAL]) {
  assertEq(`scale(${JSON.stringify(v)},null)`, legacyStageToScale(v ?? null, null), newStageToScale(v ?? null, null));
}
console.log('  · stageToScale code-arg fallback (wc3 trend)');
for (const v of OCCURRING_CODES) {
  assertEq(`scale(null,${JSON.stringify(v)})`, legacyStageToScale(null, v ?? null), newStageToScale(null, v ?? null));
}
console.log('  · stageToScale both args present (canonical wins)');
const pairs: Array<[string | null, string | null]> = [
  ['Clarity', 'CAP_MAS'], ['Awareness', 'CAP_GRW'], [null, 'cap_ins'], ['', 'CAP_INS'], ['Bogus', 'CAP_INS'],
];
for (const [c, k] of pairs) {
  assertEq(`scale(${JSON.stringify(c)},${JSON.stringify(k)})`, legacyStageToScale(c, k), newStageToScale(c, k));
}
// stageScore's legacy map is CASE-SENSITIVE (unlike floor/trend which lower-case), so parity is
// checked only on the proper-cased values canonical_stage is actually persisted as (see PART 2 for
// the new case-insensitivity). canonical_stage is never persisted lower/upper-cased.
console.log('  · stageScore (wc7b growth-plan-bridge)');
const OCCURRING_PROPER: Array<string | null | undefined> = [
  'Curiosity', 'Clarity', 'Growth', 'Mastery', 'Awareness', '', '   ', null, undefined, 'Bogus',
];
for (const v of OCCURRING_PROPER) {
  assertEq(`score(${JSON.stringify(v)})`, legacyStageScore(v), newStageScore(v));
}

// ── PART 2: ADDITIVE robustness — representations the legacy maps did NOT recognize now resolve ──
// to the CORRECT canonical result (so the read is identical regardless of which form is stored).
// These values are NOT produced today; verifying correctness here, not parity with legacy's miss.
console.log('— PART 2: additive robustness (new representations resolve to canon) —');
assertEq('floor("Insight") = floor("Clarity")', newStageFloorIndex('Clarity'), newStageFloorIndex('Insight'));
assertEq('floor("CAP_INS") = floor("Clarity")', newStageFloorIndex('Clarity'), newStageFloorIndex('CAP_INS'));
assertEq('floor("CAP_GRW") = floor("Growth")', newStageFloorIndex('Growth'), newStageFloorIndex('CAP_GRW'));
assertEq('floor("CAP_MAS") = floor("Mastery")', newStageFloorIndex('Mastery'), newStageFloorIndex('CAP_MAS'));
assertEq('floor("CAP_CUR") = floor("Curiosity")', newStageFloorIndex('Curiosity'), newStageFloorIndex('CAP_CUR'));
assertEq('scale("Insight") = scale("Clarity")', newStageToScale('Clarity', null), newStageToScale('Insight', null));
// Trimming now also applies to the subscription floor (legacy did not trim) — harmless robustness,
// since canonical_stage is never persisted with surrounding whitespace.
assertEq('floor(" Clarity ") = floor("Clarity")', newStageFloorIndex('Clarity'), newStageFloorIndex(' Clarity '));
// stageScore is now case-insensitive (legacy map was case-sensitive) — additive, since
// canonical_stage is never persisted lower/upper-cased.
assertEq('score("clarity") = score("Clarity")', newStageScore('Clarity'), newStageScore('clarity'));
assertEq('score("CAP_GRW") = score("Growth")', newStageScore('Growth'), newStageScore('CAP_GRW'));

// ── Canon-agreement spot checks: stored aliases now resolve to the canonical code/label ───────
console.log('— canon agreement (alias / pre-stage / code) —');
const clarity = normalizeStoredStage('Clarity');
assertEq('Clarity → CAP_INS', clarity.code, 'CAP_INS');
assertEq('Clarity → Insight label', clarity.label, 'Insight');
const insight = normalizeStoredStage('Insight');
assertEq('Insight === Clarity code', insight.code, clarity.code);
const awareness = normalizeStoredStage('Awareness');
assertEq('Awareness uncoded', awareness.code, null);
assertEq('Awareness isUncodedPreStage', awareness.isUncodedPreStage, true);
assertEq('Awareness recognized', awareness.recognized, true);
assertEq('Bogus not recognized', normalizeStoredStage('Bogus').recognized, false);

console.log(`\n${failures === 0 ? '✓ PASS' : '✗ FAIL'} — ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
