/**
 * PHASE 5 — Talent Intelligence Aggregator smoke test (engine-level, no HTTP).
 *
 * Verifies the honesty/compose contract WITHOUT mutating live data:
 *   - aggregator never throws (read-only, to_regclass-probed)
 *   - all seven components are always reported
 *   - Coverage (data exists) and Confidence (sufficient/calibrated) are SEPARATE
 *   - absent data => coverage 'absent'/'missing' + confidence 'none' (never fabricated 0)
 *   - org scoping flows through; unknown candidate => found:false (no fabrication)
 *
 * Run: cd backend && npx tsx scripts/smoke-talent-intelligence.ts
 */

import { Pool } from 'pg';
import {
  TALENT_INTELLIGENCE_VERSION,
  buildTalentIntelligenceOverview,
  buildCandidateTalentView,
} from '../services/talent-intelligence-aggregator.js';
import {
  TALENT_FUNNEL_VERSION,
  FUNNEL_MIN_SAMPLE,
  buildTalentFunnel,
} from '../services/talent-funnel-intelligence.js';

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${msg}`);
  }
}

const EXPECTED_KEYS = [
  'employer_intelligence',
  'recruiter_intelligence',
  'job_architecture',
  'talent_matching',
  'assessment_led_hiring',
  'hiring_intelligence',
  'workforce_intelligence',
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Phase 5 — Talent Intelligence Aggregator smoke\n');

    // ---- Platform overview (read-only, never throws) ---------------------
    console.log('Platform overview:');
    const ov = await buildTalentIntelligenceOverview(pool);
    ok(ov.version === TALENT_INTELLIGENCE_VERSION, `version is ${TALENT_INTELLIGENCE_VERSION}`);
    ok(ov.components.length === 7, `seven components reported (got ${ov.components.length})`);
    ok(
      EXPECTED_KEYS.every((k) => ov.components.some((c) => c.key === k)),
      'all seven canonical component keys present',
    );
    ok(ov.scope.kind === 'platform' && ov.scope.org_id === null, 'platform scope when no org supplied');
    ok(ov._meta.read_only === true && ov._meta.composed === true, 'meta flags: read_only + composed');

    // ---- Coverage vs Confidence as SEPARATE axes ------------------------
    console.log('\nHonesty axes:');
    ok(
      ov.components.every((c) => ['missing', 'absent', 'present'].includes(c.coverage)),
      'every component has a valid Coverage state',
    );
    ok(
      ov.components.every((c) => ['none', 'provisional', 'sufficient', 'calibrated'].includes(c.confidence)),
      'every component has a valid Confidence band',
    );
    ok(
      ov.components.every((c) => 'coverage' in c && 'confidence' in c),
      'Coverage and Confidence are distinct fields (never composited)',
    );
    // With an empty/fragmented DB, components must NOT fabricate confidence.
    ok(
      ov.components.every((c) => (c.coverage === 'present' ? true : c.confidence === 'none')),
      'no data => confidence none (never fabricated)',
    );
    ok(
      ov.components.every((c) => Array.isArray(c.sources) && c.sources.length > 0),
      'every component cites its backing source table(s)',
    );
    ok(
      ov.components.every((c) =>
        c.sources.every((s) => s.exists === false ? s.rows === null : true),
      ),
      'missing tables report rows:null (never coerced to 0)',
    );
    ok(typeof ov.rollup.honest_state === 'string' && ov.rollup.honest_state.length > 0, 'honest rollup state present');
    const distSum = Object.values(ov.rollup.confidence_distribution).reduce((a, b) => a + b, 0);
    ok(distSum === 7, `confidence distribution sums to 7 (got ${distSum})`);

    // ---- Org scoping flows through --------------------------------------
    console.log('\nOrg scoping:');
    const orgOv = await buildTalentIntelligenceOverview(pool, 'smoke_no_such_org');
    ok(orgOv.scope.kind === 'org' && orgOv.scope.org_id === 'smoke_no_such_org', 'org scope echoed');
    ok(orgOv.components.length === 7, 'org-scoped overview still reports seven components');

    // ---- Candidate view (read-only, no fabrication) --------------------
    console.log('\nCandidate view:');
    const cand = await buildCandidateTalentView(pool, `smoke_no_such_candidate_${Date.now()}`);
    ok(cand.found === false, 'unknown candidate => found:false');
    ok(
      cand.candidate === null && cand.hiring_assessment === null && cand.lbi === null,
      'no fabricated candidate / assessment / lbi',
    );
    ok(cand.confidence === 'none', 'unknown candidate => confidence none');
    ok(
      cand.coverage.profile === false && cand.coverage.hiring_assessment === false && cand.coverage.lbi === false,
      'coverage all false for unknown candidate',
    );
    const empty = await buildCandidateTalentView(pool, '');
    ok(empty.found === false && empty.notes.length > 0, 'empty candidate id => honest empty + note');

    // ---- Step 4: Talent Funnel Intelligence (read-only, composing) -----
    console.log('\nTalent Funnel Intelligence:');
    const funnel = await buildTalentFunnel(pool);
    ok(funnel.version === TALENT_FUNNEL_VERSION, `funnel version is ${TALENT_FUNNEL_VERSION}`);
    ok(FUNNEL_MIN_SAMPLE === 30, 'sufficiency threshold is 30 (Provisional below)');
    ok(funnel.ladder.length === 6, `six canonical ladder rungs (got ${funnel.ladder.length})`);
    ok(['missing', 'absent', 'present'].includes(funnel.coverage), 'funnel has a valid Coverage state');
    ok(['none', 'provisional', 'sufficient', 'calibrated'].includes(funnel.confidence), 'funnel has a valid Confidence band');
    // Empty/low-volume DB => rates must NOT be fabricated.
    ok(
      funnel.sample_size >= FUNNEL_MIN_SAMPLE
        ? true
        : funnel.overall_hire_rate_pct === null || funnel.confidence !== 'sufficient',
      'below-threshold sample never claims sufficient confidence / stable rate',
    );
    ok(
      funnel.total_candidates === 0
        ? funnel.confidence === 'none' && funnel.overall_offer_rate_pct === null
        : true,
      'empty funnel => confidence none + null rates (never fabricated 0%)',
    );
    ok(
      funnel.ladder[0].pass_through_pct === null,
      'first ladder rung has no pass-through (no prior stage)',
    );
    ok(typeof funnel.methodology === 'string' && /snapshot/i.test(funnel.methodology), 'methodology discloses snapshot approximation');
    ok(funnel._meta.read_only === true && funnel._meta.composed === true, 'funnel meta: read_only + composed');
    const orgFunnel = await buildTalentFunnel(pool, 'smoke_no_such_org');
    ok(orgFunnel.scope.kind === 'org' && orgFunnel.scope.org_id === 'smoke_no_such_org', 'funnel org scope echoed');

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(1);
});
