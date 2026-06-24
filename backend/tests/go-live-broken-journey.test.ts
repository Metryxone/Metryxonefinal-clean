/**
 * MX-106X — Go-Live Certification · broken-journey-step regression guard.
 *
 * Locks the behaviour that the Go-Live certificate's candidate (Q3) and employer (Q4) journey
 * questions CANNOT resolve to "yes" while the unified journey reports a structural break on that
 * surface. A key-name mismatch had previously made these filters silently ignore real breaks
 * (the broken-link filter is keyed on `surface`). This test feeds `goLiveCertification()` a
 * controlled `unifiedJourney` result so a future refactor of the unified-journey shape can't
 * reopen the gap.
 *
 * Pure, DB-free: `unifiedJourney` is injected via the optional `deps` override, and an inert fake
 * pool lets every OTHER composed engine (recertification / outcome / scalability / security)
 * degrade to null inside their `safe()` wrappers — so Q3/Q4 are derived ONLY from the journey.
 *
 * Run with:  cd backend && npx tsx --test tests/go-live-broken-journey.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { goLiveCertification } from '../services/go-live-certification';

// An inert pool: any query rejects, so every real composed engine degrades to null via safe().
// Q3/Q4 therefore depend solely on the injected unifiedJourney result.
const inertPool: any = {
  async query() {
    throw new Error('inert pool — no real engine should read the DB in this test');
  },
};

/** Build a fake unifiedJourney() that returns a fixed result regardless of the pool. */
function fakeJourney(result: any) {
  return async (_pool: any) => result;
}

/** Pull a question's answer out of the certification result by its stable id. */
function answerOf(cert: any, id: string): string {
  const q = cert.questions.find((x: any) => x.id === id);
  assert.ok(q, `question ${id} present in the certification`);
  return q.answer;
}

test('a broken link on each surface forces BOTH candidate (Q3) and employer (Q4) journey questions to "no"', async () => {
  // Both surfaces report full structural/coverage %, but each carries a structural break.
  // The completion % alone would say "yes" — the broken-link filter must override it to "no".
  const journey = {
    view: 'unified_journey',
    candidate: { completion: { structural_pct: 100 } },
    employer: { completion: { coverage_pct: 100 } },
    broken_links: [
      { surface: 'candidate', step: 'Assessment intake', reason: 'structural machinery absent' },
      { surface: 'employer', step: 'Interview scheduling', reason: 'substrate absent (flag on, table missing)' },
    ],
  };

  const cert = await goLiveCertification(inertPool, { unifiedJourney: fakeJourney(journey) });

  assert.equal(answerOf(cert, 'candidate_journey_ready'), 'no', 'candidate broken link → Q3 no');
  assert.equal(answerOf(cert, 'employer_journey_ready'), 'no', 'employer broken link → Q4 no');

  // A broken journey can never advance the lowest structural gate.
  assert.equal(cert.gates.production_ready, false, 'production-ready gate stays closed with broken journeys');
});

test('zero broken links with ≥90% completion lets BOTH journey questions resolve to "yes"', async () => {
  const journey = {
    view: 'unified_journey',
    candidate: { completion: { structural_pct: 90 } },  // exactly at the 90% threshold
    employer: { completion: { coverage_pct: 95 } },
    broken_links: [],
  };

  const cert = await goLiveCertification(inertPool, { unifiedJourney: fakeJourney(journey) });

  assert.equal(answerOf(cert, 'candidate_journey_ready'), 'yes', 'clean candidate journey at 90% → Q3 yes');
  assert.equal(answerOf(cert, 'employer_journey_ready'), 'yes', 'clean employer journey at 95% → Q4 yes');
});

test('broken links are filtered PER surface — a candidate break does not fail the employer question (and vice versa)', async () => {
  // Only the candidate surface is broken; the employer surface is clean and ≥90%.
  const candidateBroken = {
    candidate: { completion: { structural_pct: 100 } },
    employer: { completion: { coverage_pct: 100 } },
    broken_links: [{ surface: 'candidate', step: 'Report delivery', reason: 'structural machinery absent' }],
  };
  let cert = await goLiveCertification(inertPool, { unifiedJourney: fakeJourney(candidateBroken) });
  assert.equal(answerOf(cert, 'candidate_journey_ready'), 'no', 'candidate break → Q3 no');
  assert.equal(answerOf(cert, 'employer_journey_ready'), 'yes', 'employer untouched by a candidate break → Q4 yes');

  // Mirror: only the employer surface is broken.
  const employerBroken = {
    candidate: { completion: { structural_pct: 100 } },
    employer: { completion: { coverage_pct: 100 } },
    broken_links: [{ surface: 'employer', step: 'Offer issuance', reason: 'substrate absent (flag on, table missing)' }],
  };
  cert = await goLiveCertification(inertPool, { unifiedJourney: fakeJourney(employerBroken) });
  assert.equal(answerOf(cert, 'candidate_journey_ready'), 'yes', 'candidate untouched by an employer break → Q3 yes');
  assert.equal(answerOf(cert, 'employer_journey_ready'), 'no', 'employer break → Q4 no');
});

test('the broken-link filter keys on `surface` — a mismatched key does NOT count as a break', async () => {
  // Guards against re-introducing a key-name mismatch the OTHER direction: the certification reads
  // `surface`, so a link emitted under a wrong key would (correctly, for this contract) be ignored.
  // This pins the contract that `surface` is the authoritative key the filter must honour.
  const wrongKey = {
    candidate: { completion: { structural_pct: 100 } },
    employer: { completion: { coverage_pct: 100 } },
    broken_links: [{ area: 'candidate', step: 'mislabelled', reason: 'wrong key name' }],
  };
  const cert = await goLiveCertification(inertPool, { unifiedJourney: fakeJourney(wrongKey) });
  const q3 = cert.questions.find((x: any) => x.id === 'candidate_journey_ready');
  assert.equal(q3.answer, 'yes', 'a link missing the `surface` key is not counted (contract pinned on `surface`)');
  assert.equal(q3.evidence.candidate_broken_links, 0, 'broken-link count keys on `surface`, not arbitrary keys');
});
