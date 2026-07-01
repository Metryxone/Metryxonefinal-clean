/**
 * CAPADEX Stage-Price Lockstep — Regression Test
 *
 * Guards the recurring cross-boundary drift risk documented in
 * .agents/memory/stage-price-canonical-source.md: the customer-facing UI prices
 * live in the Vite frontend (`frontend/src/lib/behavioural-insights.ts`), while
 * the price actually charged is owned by the backend canonical source
 * (`backend/config/stage-pricing.ts` → `routes/capadex-payments.ts`). Because the
 * Vite frontend CANNOT import backend modules, the two lists are hand-mirrored
 * and could silently drift — the UI could show one price while the Razorpay
 * order charges another.
 *
 * This test imports the backend canonical STAGE_PRICES and parses the frontend
 * `CAPADEX_STAGE_PRICES_INR` map (by reading the source text — the frontend file
 * imports React/lucide-react and cannot be imported into a Node test) and the
 * derived `UPGRADE_TIERS` display strings, then asserts every mapped value is
 * identical across all three. A price change in EITHER file without the other
 * fails this test.
 *
 * Tier key ↔ backend stage code: clarity→CAP_INS, growth→CAP_GRW, mastery→CAP_MAS.
 *
 * Run with:  npx tsx --test backend/tests/stage-price-lockstep.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { STAGE_PRICES, PURCHASABLE_LADDER } from '../config/stage-pricing';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_FILE = path.resolve(__dirname, '../../frontend/src/lib/behavioural-insights.ts');

/** Frontend tier key → backend canonical stage code. */
const TIER_TO_STAGE: Record<string, string> = {
  clarity: 'CAP_INS',
  growth: 'CAP_GRW',
  mastery: 'CAP_MAS',
};

const feSource = readFileSync(FE_FILE, 'utf8');

/**
 * Extract a `key: <number>,` value from inside the `CAPADEX_STAGE_PRICES_INR`
 * object literal. Anchored to that block so unrelated numbers elsewhere in the
 * file can never be matched.
 */
function parseFePriceMap(): Record<string, number> {
  const block = feSource.match(/CAPADEX_STAGE_PRICES_INR[^=]*=\s*{([^}]*)}/);
  assert.ok(block, 'CAPADEX_STAGE_PRICES_INR object literal not found in frontend behavioural-insights.ts');
  const out: Record<string, number> = {};
  for (const key of Object.keys(TIER_TO_STAGE)) {
    const m = block[1].match(new RegExp(`\\b${key}\\s*:\\s*(\\d+)`));
    assert.ok(m, `CAPADEX_STAGE_PRICES_INR is missing a numeric price for "${key}"`);
    out[key] = Number(m[1]);
  }
  return out;
}

test('frontend CAPADEX_STAGE_PRICES_INR matches backend STAGE_PRICES', () => {
  const fePrices = parseFePriceMap();
  for (const [tierKey, stageCode] of Object.entries(TIER_TO_STAGE)) {
    const backend = STAGE_PRICES[stageCode];
    assert.equal(
      typeof backend,
      'number',
      `Backend STAGE_PRICES has no price for stage "${stageCode}" (mapped from frontend tier "${tierKey}")`,
    );
    assert.equal(
      fePrices[tierKey],
      backend,
      `Price drift: frontend "${tierKey}" (₹${fePrices[tierKey]}) != backend ${stageCode} (₹${backend}). ` +
        `Update frontend/src/lib/behavioural-insights.ts CAPADEX_STAGE_PRICES_INR and backend/config/stage-pricing.ts together.`,
    );
  }
});

test('frontend UPGRADE_TIERS display strings equal the frontend price map', () => {
  // The display strings are derived via formatInr(...), so this proves the map
  // is genuinely wired into what the customer sees (not just a dormant const).
  const fePrices = parseFePriceMap();
  for (const key of Object.keys(TIER_TO_STAGE)) {
    const expected = `₹${fePrices[key].toLocaleString('en-IN')}`;
    // Find the UPGRADE_TIERS entry with this key and confirm its price wires to
    // formatInr(CAPADEX_STAGE_PRICES_INR.<key>) OR the exact display string.
    const entry = feSource.match(new RegExp(`key:\\s*'${key}'[\\s\\S]{0,400}?price:\\s*([^,]+),`));
    assert.ok(entry, `UPGRADE_TIERS entry for "${key}" not found`);
    const priceExpr = entry[1].trim();
    const wiresToMap = priceExpr === `formatInr(CAPADEX_STAGE_PRICES_INR.${key})`;
    const literalMatches = priceExpr === `'${expected}'` || priceExpr === `"${expected}"`;
    assert.ok(
      wiresToMap || literalMatches,
      `UPGRADE_TIERS "${key}" price expression (${priceExpr}) neither derives from ` +
        `CAPADEX_STAGE_PRICES_INR nor equals the expected display string "${expected}".`,
    );
  }
});

test('every purchasable backend stage has a frontend price mirror', () => {
  // If a new purchasable rung is added to the backend ladder, it must gain a
  // frontend mirror + a TIER_TO_STAGE mapping here — otherwise a chargeable
  // stage would have no verified UI price.
  const mappedStages = new Set(Object.values(TIER_TO_STAGE));
  for (const stageCode of PURCHASABLE_LADDER) {
    assert.ok(
      mappedStages.has(stageCode),
      `Backend PURCHASABLE_LADDER stage "${stageCode}" has no frontend price mirror mapping. ` +
        `Add it to CAPADEX_STAGE_PRICES_INR (frontend) and TIER_TO_STAGE (this test).`,
    );
  }
});
