/**
 * Verification — lifecycle "one rulebook" consolidation (#309 / #310 / CAP_ADV).
 *
 * Pure + offline (no DB, no flags). Asserts:
 *  PART 1 (#310 casing guarantee) — canonicalStoredLabel + canonicalStageFor normalize any
 *          recognized stage representation to the proper-cased STORED label, are byte-identical
 *          for the CAP_* codes the live path actually feeds, and degrade honestly otherwise.
 *  PART 2 (#309 entitlement)      — entitlement-bridge sources its stage order from the canon
 *          (no local literal array) and the canon order is unchanged.
 *  PART 3 (CAP_ADV)               — lde-evolution emits ONLY canonical cap_codes (no 5th code).
 *
 * Run: cd backend && npx tsx scripts/verify-lifecycle-rulebook-consolidation.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  LIFECYCLE_STAGE_CODES,
  canonicalStoredLabel,
} from '../lib/lifecycle';
import { canonicalStageFor } from '../services/wc3/stage-intelligence';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; }
  else { fail++; failures.push(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}

// ── PART 1 — #310 casing guarantee ────────────────────────────────────────────
// canonicalStoredLabel: every recognized representation → proper-cased STORED label.
check('storedLabel clarity', canonicalStoredLabel('clarity'), 'Clarity');
check('storedLabel CLARITY', canonicalStoredLabel('CLARITY'), 'Clarity');
check('storedLabel insight→Clarity (stored alias form)', canonicalStoredLabel('Insight'), 'Clarity');
check('storedLabel cap_ins→Clarity', canonicalStoredLabel('cap_ins'), 'Clarity');
check('storedLabel awareness', canonicalStoredLabel('  AwArEnEsS '), 'Awareness');
check('storedLabel cap_awr→Awareness', canonicalStoredLabel('CAP_AWR'), 'Awareness');
check('storedLabel curiosity', canonicalStoredLabel('curiosity'), 'Curiosity');
check('storedLabel growth', canonicalStoredLabel('GROWTH'), 'Growth');
check('storedLabel mastery', canonicalStoredLabel('mastery'), 'Mastery');
check('storedLabel cap_mas', canonicalStoredLabel('cap_mas'), 'Mastery');
check('storedLabel unrecognized→null', canonicalStoredLabel('something_else'), null);
check('storedLabel empty→null', canonicalStoredLabel(''), null);
check('storedLabel null→null', canonicalStoredLabel(null), null);

// canonicalStageFor: BYTE-IDENTICAL for the CAP_* codes / null the live path feeds.
check('stageFor CAP_CUR', canonicalStageFor('CAP_CUR'), 'Curiosity');
check('stageFor CAP_INS', canonicalStageFor('CAP_INS'), 'Clarity');
check('stageFor CAP_GRW', canonicalStageFor('CAP_GRW'), 'Growth');
check('stageFor CAP_MAS', canonicalStageFor('CAP_MAS'), 'Mastery');
check('stageFor null→Awareness', canonicalStageFor(null), 'Awareness');
check('stageFor undefined→Awareness', canonicalStageFor(undefined), 'Awareness');
check('stageFor garbage→Awareness (unchanged degrade)', canonicalStageFor('zzz'), 'Awareness');
// canonicalStageFor: NEW guarantee — recognized odd-cased reps no longer mis-degrade.
check('stageFor clarity→Clarity (was Awareness)', canonicalStageFor('clarity'), 'Clarity');
check('stageFor cap_mas (lower)→Mastery', canonicalStageFor('cap_mas'), 'Mastery');
check('stageFor Insight→Clarity', canonicalStageFor('Insight'), 'Clarity');

// ── PART 2 — #309 entitlement bridge sources canon ────────────────────────────
check('canon order unchanged', [...LIFECYCLE_STAGE_CODES], ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS']);
const entSrc = readFileSync(join(__dirname, '..', 'services', 'entitlement-bridge.ts'), 'utf8');
check('entitlement imports LIFECYCLE_STAGE_CODES', /LIFECYCLE_STAGE_CODES/.test(entSrc), true);
check('entitlement STAGE_ORDER = LIFECYCLE_STAGE_CODES', /STAGE_ORDER[^=]*=\s*LIFECYCLE_STAGE_CODES/.test(entSrc), true);
check('entitlement has NO local 4-code literal array',
  /\[\s*'CAP_CUR'\s*,\s*'CAP_INS'\s*,\s*'CAP_GRW'\s*,\s*'CAP_MAS'\s*\]/.test(entSrc), false);
check('entitlement has NO private StageCode union literal',
  /type\s+StageCode\s*=\s*'CAP_CUR'/.test(entSrc), false);

// ── PART 3 — CAP_ADV reconciliation ───────────────────────────────────────────
const ldeSrc = readFileSync(join(__dirname, '..', 'routes', 'lde-evolution.ts'), 'utf8');
check('lde has NO CAP_ADV', /CAP_ADV/.test(ldeSrc), false);
const capCodes = [...ldeSrc.matchAll(/cap_code:\s*'([^']+)'/g)].map(m => m[1]);
check('lde emits ≥1 cap_code', capCodes.length > 0, true);
const canonSet = new Set<string>(LIFECYCLE_STAGE_CODES as readonly string[]);
const nonCanon = capCodes.filter(c => !canonSet.has(c));
check('lde cap_codes all canonical', nonCanon, []);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n=== Lifecycle rulebook consolidation verification ===');
if (failures.length) console.log(failures.join('\n'));
console.log(`\n${pass}/${pass + fail} checks PASS` + (fail ? ` — ${fail} FAILED` : ''));
process.exit(fail ? 1 : 0);
