/**
 * Smoke — MX-100X Phase 4 Adaptive Assessment Activation.
 *
 * Asserts:
 *   A. flag-OFF HTTP contract: GET /api/competency/assessment/difficulty-plan → 503
 *      BEFORE any auth (the Backend API workflow keeps the flag OFF).
 *   B. flag-OFF /select payload is byte-identical (NO `difficulty_plan` key) — proves
 *      the additive surface is invisible when OFF. (401 if unauth is also acceptable;
 *      the contract we care about is "no difficulty_plan leakage when OFF".)
 *   C. service-level monotonicity + guards (pure, no HTTP) — anchors, target ranks,
 *      readiness bands, override provenance, single-band no-op, unknown-band guard.
 *
 * Run with the workflow flag OFF (default). Exits non-zero on any failure.
 */
import {
  resolveSeniorityProfile,
  levelAwareReadinessBands,
  classifyReadiness,
  DEFAULT_READINESS_BANDS,
  difficultyAffinityBonus,
  STAGE_ANCHOR,
  type SeniorityBand,
} from '../services/adaptive-difficulty-activation';

const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); }

async function main() {
  /* A. flag-OFF HTTP 503 on the new route */
  try {
    const r = await fetch(`${BASE}/api/competency/assessment/difficulty-plan?stage=senior`);
    check('A. difficulty-plan 503 when flag OFF', r.status === 503, `got HTTP ${r.status}`);
  } catch (e: any) {
    check('A. difficulty-plan 503 when flag OFF', false, `fetch failed: ${e?.message}`);
  }

  /* B. flag-OFF /select must NOT leak a difficulty_plan key */
  try {
    const r = await fetch(`${BASE}/api/competency/questions/select?total=7&stage=director`);
    if (r.status === 401 || r.status === 403) {
      check('B. /select no difficulty_plan leak (OFF)', true, `auth-gated (HTTP ${r.status}) — no payload to leak`);
    } else {
      const body = await r.json().catch(() => ({}));
      check('B. /select no difficulty_plan leak (OFF)', !('difficulty_plan' in body), `keys: ${Object.keys(body).join(',')}`);
    }
  } catch (e: any) {
    check('B. /select no difficulty_plan leak (OFF)', false, `fetch failed: ${e?.message}`);
  }

  /* C. pure service guarantees */
  const levels: SeniorityBand[] = ['junior', 'mid', 'senior', 'lead', 'director'];
  const anchors = levels.map((l) => resolveSeniorityProfile(l).proficiency_anchor);
  const ranks = levels.map((l) => resolveSeniorityProfile(l).target_difficulty.rank);
  const readyMins = levels.map((l) => levelAwareReadinessBands(STAGE_ANCHOR[l]).ready_min);

  check('C1. anchor monotonic', anchors.every((v, i) => i === 0 || v >= anchors[i - 1]), anchors.join(','));
  check('C2. target rank monotonic', ranks.every((v, i) => i === 0 || v >= ranks[i - 1]), ranks.join(','));
  check('C3. ready_min monotonic', readyMins.every((v, i) => i === 0 || v >= readyMins[i - 1]), readyMins.join(','));
  check('C4. senior bands == legacy ladder',
    JSON.stringify(levelAwareReadinessBands(STAGE_ANCHOR.senior)) === JSON.stringify(DEFAULT_READINESS_BANDS));
  const ov = resolveSeniorityProfile('junior', 90);
  check('C5. expected_level override + provenance',
    ov.proficiency_anchor === 90 && ov.proficiency_source === 'role_dna_expected_level');
  check('C6. same score, different class by level',
    classifyReadiness(80, levelAwareReadinessBands(STAGE_ANCHOR.junior)) !==
    classifyReadiness(80, levelAwareReadinessBands(STAGE_ANCHOR.director)));
  // single-band no-op: on an all-'medium' pool the bonus is uniform across rows for
  // a fixed level, so adding it preserves the affinity ordering (cannot re-rank).
  // Prove it: three rows with distinct affinity scores, all band 'medium' → after the
  // bonus the relative order is unchanged for EVERY level.
  const noOpHolds = levels.every((l) => {
    const rank = resolveSeniorityProfile(l).target_difficulty.rank;
    const affinities = [1.5, 0.7, -0.4];
    const biased = affinities.map((a) => a + difficultyAffinityBonus('medium', rank));
    const orderBefore = [...affinities.keys()].sort((i, j) => affinities[j] - affinities[i]);
    const orderAfter = [...biased.keys()].sort((i, j) => biased[j] - biased[i]);
    return JSON.stringify(orderBefore) === JSON.stringify(orderAfter);
  });
  check('C7. single-band selection no-op (ordering preserved)', noOpHolds);
  check('C8. matcher discriminates on variety',
    difficultyAffinityBonus('advanced', 4) > difficultyAffinityBonus('medium', 4) &&
    difficultyAffinityBonus('easy', 4) === 0);
  check('C9. unknown band → 0 (no penalty)', difficultyAffinityBonus('xyz', 3) === 0);

  /* report */
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed}/${results.length} smoke checks passed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
