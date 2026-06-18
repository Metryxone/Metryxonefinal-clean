/**
 * EP-98-W2 — TIG success-probability calibration engine (Engine 8) unit tests.
 *
 * Covers the 5 approved enhancements at the pure-function layer:
 *   • E2 — Brier + ECE on RAW predictions (null at cold_start)
 *   • E4 — isotonic (PAV) monotonicity, interpolation/clamping, status gating
 *   • E5 — borrowed global prior shifts thin-org bins, never upgrades TRUST status
 *   • status machine — cold_start / provisional / calibrated mapping behaviour
 *
 * Run with:  cd backend && npx tsx --test tests/employer-tig-calibration.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCalibrationModel,
  calibrateProbability,
  fitIsotonic,
  isotonicAt,
  bandFor,
} from '../routes/employer-tig.ts';

type Pair = { predicted: number; outcome: 0 | 1 };

// ─── status machine ─────────────────────────────────────────────────────────

test('cold_start: empty data → identity map, null metrics', () => {
  const m = buildCalibrationModel([]);
  assert.equal(m.status, 'cold_start');
  assert.equal(m.method, 'identity');
  assert.equal(m.brier, null);
  assert.equal(m.ece, null);
  assert.equal(m.totalOutcomes, 0);
  assert.ok(m.bands.every(b => b.calibratedRate === null && b.observedRate === null && b.meanPredicted === null));
  // identity: raw passes through untouched
  for (const p of [0, 0.13, 0.5, 0.87, 1]) assert.equal(calibrateProbability(p, m), p);
});

test('provisional: <30 outcomes → binned method, metrics present, status not upgraded', () => {
  const realized: Pair[] = [
    { predicted: 0.7, outcome: 1 }, { predicted: 0.65, outcome: 0 }, { predicted: 0.72, outcome: 0 },
    { predicted: 0.3, outcome: 0 }, { predicted: 0.35, outcome: 1 },
  ];
  const m = buildCalibrationModel(realized);
  assert.equal(m.status, 'provisional');
  assert.equal(m.method, 'binned');
  assert.ok(typeof m.brier === 'number' && typeof m.ece === 'number');
  assert.equal(m.isotonic, undefined); // isotonic NOT computed for provisional
  // provisional uses the α-smoothed band rate, not identity
  const b3 = m.bands.find(b => b.bandId === bandFor(0.7).id)!;
  assert.ok(b3.calibratedRate !== null);
  assert.equal(calibrateProbability(0.7, m), b3.calibratedRate);
});

test('calibrated: ≥30 outcomes → isotonic method + curve drives the mapping', () => {
  const realized: Pair[] = [];
  for (let i = 0; i < 40; i++) {
    const x = (i % 10) / 10 + 0.05;          // 0.05 … 0.95 across all bands
    realized.push({ predicted: x, outcome: x > 0.5 ? 1 : 0 });
  }
  const m = buildCalibrationModel(realized);
  assert.equal(m.status, 'calibrated');
  assert.equal(m.method, 'isotonic');
  assert.ok(Array.isArray(m.isotonic) && m.isotonic!.length >= 1);
  // the live mapping must equal the isotonic interpolation (rounded)
  for (const raw of [0.1, 0.45, 0.55, 0.9]) {
    const expected = Math.round(isotonicAt(m.isotonic!, raw) * 1000) / 1000;
    assert.equal(calibrateProbability(raw, m), expected);
  }
});

// ─── E2: Brier + ECE ────────────────────────────────────────────────────────

test('E2: Brier is mean squared error on RAW predictions', () => {
  const m = buildCalibrationModel([
    { predicted: 0.8, outcome: 1 },   // (0.8-1)^2 = 0.04
    { predicted: 0.2, outcome: 0 },   // (0.2-0)^2 = 0.04
  ]);
  assert.equal(m.brier, 0.04);
});

test('E2: ECE is sample-weighted |observed − meanPredicted| over bands', () => {
  // two cases in band b4 (0.8–1.01): meanPredicted=0.85, observed=0.5 → |0.5-0.85|=0.35, weight 1.0
  const m = buildCalibrationModel([
    { predicted: 0.8, outcome: 1 },
    { predicted: 0.9, outcome: 0 },
  ]);
  const b4 = m.bands.find(b => b.bandId === bandFor(0.85).id)!;
  assert.equal(b4.meanPredicted, 0.85);
  assert.equal(b4.observedRate, 0.5);
  assert.equal(m.ece, 0.35);
});

// ─── E4: isotonic regression ─────────────────────────────────────────────────

test('E4: fitIsotonic produces a monotone non-decreasing curve from noisy data', () => {
  // raw rates are non-monotone; PAV must pool the violators into a non-decreasing fit
  const realized: Pair[] = [
    { predicted: 0.1, outcome: 0 }, { predicted: 0.2, outcome: 1 }, // local spike
    { predicted: 0.3, outcome: 0 }, { predicted: 0.4, outcome: 0 },
    { predicted: 0.6, outcome: 1 }, { predicted: 0.7, outcome: 0 }, // local dip
    { predicted: 0.8, outcome: 1 }, { predicted: 0.9, outcome: 1 },
  ];
  const curve = fitIsotonic(realized);
  assert.ok(curve.length >= 1);
  for (let i = 1; i < curve.length; i++) {
    assert.ok(curve[i].y >= curve[i - 1].y, `y must be non-decreasing at ${i}`);
    assert.ok(curve[i].x >= curve[i - 1].x, `x must be non-decreasing at ${i}`);
  }
});

test('E4: isotonicAt interpolates between breakpoints and clamps at the ends', () => {
  const curve = [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.9 }];
  assert.equal(isotonicAt(curve, 0.0), 0.1);   // clamp low
  assert.equal(isotonicAt(curve, 1.0), 0.9);   // clamp high
  assert.ok(Math.abs(isotonicAt(curve, 0.5) - 0.5) < 1e-9); // midpoint linear interpolation
  assert.equal(isotonicAt([], 0.42), 0.42);    // empty curve → identity
});

// ─── E5: borrowed prior ──────────────────────────────────────────────────────

test('E5: a borrowed global prior shifts a thin band toward the pooled rate', () => {
  // band b3 (0.6–0.8): 5 cases, 1 positive (observed 0.2)
  const realized: Pair[] = [
    { predicted: 0.7, outcome: 1 },
    { predicted: 0.65, outcome: 0 }, { predicted: 0.72, outcome: 0 },
    { predicted: 0.68, outcome: 0 }, { predicted: 0.75, outcome: 0 },
  ];
  const b3id = bandFor(0.7).id;
  const uninformative = buildCalibrationModel(realized);
  const borrowed      = buildCalibrationModel(realized, { [b3id]: 0.2 });

  const uBand = uninformative.bands.find(b => b.bandId === b3id)!;
  const gBand = borrowed.bands.find(b => b.bandId === b3id)!;

  assert.equal(uBand.priorSource, 'uninformative');
  assert.equal(gBand.priorSource, 'global_pooled');
  // global prior (0.2) is far below the midpoint prior (0.7) → calibrated rate pulled down
  assert.ok(gBand.calibratedRate! < uBand.calibratedRate!);
  // TRUST status is gated on the org's OWN outcomes — a borrowed prior never upgrades it
  assert.equal(borrowed.status, 'provisional');
});

test('E5: a borrowed prior never lifts a cold_start org off identity', () => {
  const m = buildCalibrationModel([], { [bandFor(0.7).id]: 0.9 });
  assert.equal(m.status, 'cold_start');
  assert.equal(m.method, 'identity');
  assert.ok(m.bands.every(b => b.priorSource === 'uninformative' && b.calibratedRate === null));
  assert.equal(calibrateProbability(0.7, m), 0.7); // identity preserved
});
