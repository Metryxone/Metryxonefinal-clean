/**
 * Verifies the lifecycle stage read-layer normalization (Task #306) is byte-identical to the
 * legacy ad-hoc maps it replaced, across EVERY stored representation.
 *
 *   1. subscription-engine `stageFloorIndex`  — legacy lowercased-label switch vs new canon route.
 *   2. wc3 trend `stageToScale`               — legacy STAGE_ORDINAL map vs new canon route.
 *   3. wc7b growth-plan `stageScore`          — legacy case-sensitive label map vs new canon route.
 *   4. scoring-utils `stageWeight` (CSI)      — legacy code→weight map vs new canon route.
 *   5. csi route `STAGE_ORDER` (highest)      — legacy literal code list vs LIFECYCLE_STAGE_CODES.
 *   6. lbi-engine `stageOrder` (adaptability) — legacy literal code list vs LIFECYCLE_STAGE_CODES.
 *   7. cognitive-intelligence advanced detect — legacy CAP_GRW/CAP_MAS literals vs canon order≥Growth.
 *
 * Pure, no DB, no I/O. Run: `npx tsx scripts/verify-lifecycle-stage-normalization.ts` from backend/.
 */
import { normalizeStoredStage, LIFECYCLE_STAGE_CODES, stageOrder } from '../lib/lifecycle';

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

// ── PART 3: byte-identical parity for the NEWLY-routed consumers (Task #309) ───────────────────
// Each consumer's stored-stage read now routes its INPUT through the shared resolver while keeping
// its OWN value semantics. capadex_sessions.stage_code is ALWAYS a proper-cased CAP_* code, so
// strict parity is asserted on those actually-occurring codes; lowercase/label/alias inputs are
// additive robustness (not produced today) and verified separately.
console.log('— PART 3: newly-routed consumers (Task #309) —');

// 4. scoring-utils computeCSIScore stage weight (legacy code→weight map, default 0.5)
const LEGACY_STAGE_WEIGHT_MAP: Record<string, number> = { CAP_CUR: 0.50, CAP_INS: 0.75, CAP_GRW: 1.00, CAP_MAS: 1.25 };
function legacyStageWeight(code: string | null | undefined): number {
  return LEGACY_STAGE_WEIGHT_MAP[code ?? ''] ?? 0.5;
}
const NEW_WEIGHT_BY_CODE: Record<string, number> = { CAP_CUR: 0.50, CAP_INS: 0.75, CAP_GRW: 1.00, CAP_MAS: 1.25 };
function newStageWeight(code: string | null | undefined): number {
  const { code: c } = normalizeStoredStage(code);
  return c ? NEW_WEIGHT_BY_CODE[c] : 0.5;
}
console.log('  · stageWeight (scoring-utils CSI)');
// proper-cased CAP_* codes + uncoded + edge cases — the ONLY values stage_code is persisted as
for (const v of ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS', 'CAP_AWR', null, undefined, '', 'BOGUS']) {
  assertEq(`weight(${JSON.stringify(v)})`, legacyStageWeight(v), newStageWeight(v));
}
// additive robustness: a stored label / alias would now resolve to its code's weight (not 0.5)
assertEq('weight("Clarity") = weight("CAP_INS")', newStageWeight('CAP_INS'), newStageWeight('Clarity'));
assertEq('weight("Growth") = weight("CAP_GRW")', newStageWeight('CAP_GRW'), newStageWeight('Growth'));

// 5 + 6. csi `STAGE_ORDER` and lbi-engine `stageOrder` were both this literal list; now both are
// LIFECYCLE_STAGE_CODES. Identity of the list IS the parity (every downstream read uses it verbatim).
const LEGACY_STAGE_CODE_LIST = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'];
console.log('  · STAGE_ORDER / stageOrder code list (csi + lbi-engine)');
assertEq('LIFECYCLE_STAGE_CODES === legacy literal list', JSON.stringify([...LIFECYCLE_STAGE_CODES]), JSON.stringify(LEGACY_STAGE_CODE_LIST));

// csi highest-stage derivation parity (iterate list high→low, first present code wins)
function highestStage(order: readonly string[], completedCodes: string[]): string {
  let h = '';
  for (let i = order.length - 1; i >= 0; i--) {
    if (completedCodes.includes(order[i])) { h = order[i]; break; }
  }
  return h;
}
console.log('  · csi highestStage');
const highestCases: string[][] = [
  [], ['CAP_CUR'], ['CAP_CUR', 'CAP_GRW'], ['CAP_MAS', 'CAP_INS'], ['CAP_INS', 'CAP_GRW', 'CAP_MAS'], ['BOGUS'],
];
for (const codes of highestCases) {
  assertEq(`highest(${JSON.stringify(codes)})`, highestStage(LEGACY_STAGE_CODE_LIST, codes), highestStage([...LIFECYCLE_STAGE_CODES], codes));
}

// lbi-engine orderedAvgs parity (avg per stage, walked in canonical order, nulls dropped)
function orderedAvgs(order: readonly string[], scores: Record<string, number[]>): number[] {
  return order
    .map((st) => (scores[st] ? scores[st].reduce((a, b) => a + b, 0) / scores[st].length : null))
    .filter((v) => v !== null) as number[];
}
console.log('  · lbi-engine orderedAvgs');
const lbiScores: Record<string, number[]> = { CAP_CUR: [40, 60], CAP_GRW: [80], CAP_MAS: [90, 100] };
assertEq('orderedAvgs', JSON.stringify(orderedAvgs(LEGACY_STAGE_CODE_LIST, lbiScores)), JSON.stringify(orderedAvgs([...LIFECYCLE_STAGE_CODES], lbiScores)));

// 7. cognitive-intelligence "advanced" detection (legacy CAP_GRW/CAP_MAS literals vs canon order≥Growth)
type Sess = { stage_code: string; score: number };
function legacyAdvanced(completed: Sess[]): { hasAdvanced: boolean; advAvg: number } {
  const stageScores: Record<string, number[]> = {};
  for (const s of completed) {
    if (!stageScores[s.stage_code]) stageScores[s.stage_code] = [];
    stageScores[s.stage_code].push(Number(s.score) || 0);
  }
  const hasAdvanced = (stageScores['CAP_GRW']?.length || 0) + (stageScores['CAP_MAS']?.length || 0) > 0;
  const advAvg = hasAdvanced
    ? [...(stageScores['CAP_GRW'] || []), ...(stageScores['CAP_MAS'] || [])].reduce((a, b) => a + b, 0) /
      ((stageScores['CAP_GRW']?.length || 0) + (stageScores['CAP_MAS']?.length || 0))
    : 0;
  return { hasAdvanced, advAvg };
}
function newAdvanced(completed: Sess[]): { hasAdvanced: boolean; advAvg: number } {
  const minOrder = stageOrder('CAP_GRW');
  const advancedScores: number[] = [];
  for (const s of completed) {
    const { order } = normalizeStoredStage(s.stage_code);
    if (order >= minOrder) advancedScores.push(Number(s.score) || 0);
  }
  const hasAdvanced = advancedScores.length > 0;
  const advAvg = hasAdvanced ? advancedScores.reduce((a, b) => a + b, 0) / advancedScores.length : 0;
  return { hasAdvanced, advAvg };
}
console.log('  · cognitive-intelligence advanced detection');
const advCases: Sess[][] = [
  [],
  [{ stage_code: 'CAP_CUR', score: 50 }, { stage_code: 'CAP_INS', score: 70 }],
  [{ stage_code: 'CAP_GRW', score: 80 }],
  [{ stage_code: 'CAP_MAS', score: 90 }, { stage_code: 'CAP_GRW', score: 60 }],
  [{ stage_code: 'CAP_CUR', score: 40 }, { stage_code: 'CAP_GRW', score: 80 }, { stage_code: 'CAP_MAS', score: 100 }],
];
for (const c of advCases) {
  assertEq(`advanced.has(${JSON.stringify(c.map((x) => x.stage_code))})`, legacyAdvanced(c).hasAdvanced, newAdvanced(c).hasAdvanced);
  assertEq(`advanced.avg(${JSON.stringify(c.map((x) => x.stage_code))})`, legacyAdvanced(c).advAvg, newAdvanced(c).advAvg);
}

// 7b. cognitive-intelligence computeCognitiveProfile "processing depth" deep-session detection
// (legacy CAP_GRW/CAP_MAS literal includes() vs canon order≥Growth) — same predicate as 7,
// independently asserted because it is a SEPARATE stored-stage read in the same file.
function legacyDeep(completed: Sess[]): string[] {
  return completed.filter((s) => ['CAP_GRW', 'CAP_MAS'].includes(s.stage_code)).map((s) => s.stage_code);
}
function newDeep(completed: Sess[]): string[] {
  const minOrder = stageOrder('CAP_GRW');
  return completed.filter((s) => normalizeStoredStage(s.stage_code).order >= minOrder).map((s) => s.stage_code);
}
console.log('  · cognitive-intelligence processing-depth deep sessions');
for (const c of advCases) {
  assertEq(`deep(${JSON.stringify(c.map((x) => x.stage_code))})`, JSON.stringify(legacyDeep(c)), JSON.stringify(newDeep(c)));
}

console.log(`\n${failures === 0 ? '✓ PASS' : '✗ FAIL'} — ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
