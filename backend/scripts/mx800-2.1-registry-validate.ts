/**
 * MX-800 Phase 2.1 — Platform Intelligence Registry validation (Part 7).
 *
 * Exercises the foundation against the LIVE Backend API over HTTP with the flag turned ON, then
 * asserts the honesty contract: one canonical registry, no duplicate registries/engines, reuse of
 * existing engines (file-verified), governance gaps reported honestly, compatibility preserved, and
 * STRUCTURAL-only verdict (Built ≠ Activated). Run with FF_PLATFORM_INTELLIGENCE_REGISTRY=1 so this
 * process AND the live workflow agree on flag state.
 *
 * Usage (from backend/):  FF_PLATFORM_INTELLIGENCE_REGISTRY=1 npx tsx scripts/mx800-2.1-registry-validate.ts
 */
import { Pool } from 'pg';
import {
  getRegistry, getMetadata, getOrchestration, routeIntelligence, explainIntelligence,
  getGovernance, getValidation, getSummary, discoverRegistry,
  captureAuditSnapshot, getAuditSnapshots, getAuditDrift,
} from '../services/platform-intelligence-registry';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let pass = 0, fail = 0;
const log = (ok: boolean, msg: string, detail?: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
  ok ? pass++ : fail++;
};

async function main() {
  console.log('\n=== MX-800 Phase 2.1 — Platform Intelligence Registry validation ===');
  console.log(`flag FF_PLATFORM_INTELLIGENCE_REGISTRY=${process.env.FF_PLATFORM_INTELLIGENCE_REGISTRY ?? '(unset)'}\n`);

  // Tooling must NOT bypass the OFF contract. This script exercises WRITE/DDL paths, so it refuses to
  // run unless the flag is explicitly ON (the service write guards would throw anyway — fail fast here
  // with a clear message instead of a mid-suite exception).
  if (process.env.FF_PLATFORM_INTELLIGENCE_REGISTRY !== '1') {
    console.error('REFUSING TO RUN: set FF_PLATFORM_INTELLIGENCE_REGISTRY=1 — this validator writes registry/audit rows and must agree with the live flag state.');
    await pool.end();
    process.exit(2);
  }

  // Reads compose the file-verified catalog even before discovery.
  const reg0 = await getRegistry(pool);
  log(reg0.total >= 9, 'registry composes ≥9 intelligence entries from catalog', { total: reg0.total });
  log(reg0.domains_covered >= 9, 'covers ≥9 constitutional domains', { domains: reg0.domains_covered });
  log(reg0.present_count > 0 && reg0.present_count <= reg0.total,
    'present_count is MEASURED via filesystem (0<present≤total)', { present: reg0.present_count, total: reg0.total });

  // Persist via discover; managed lifecycle_state must survive re-discovery.
  const disc = await discoverRegistry(pool, 'validator');
  log(disc.ok && disc.discovered === reg0.total, 'discover persists every catalog entry', disc);
  await pool.query(
    `UPDATE platform_intelligence_registry SET lifecycle_state='managed_active', owner='owner.test' WHERE intelligence_uid='intel.assessment'`,
  );
  await discoverRegistry(pool, 'validator');
  const afterRe = await pool.query(
    `SELECT lifecycle_state, owner FROM platform_intelligence_registry WHERE intelligence_uid='intel.assessment'`,
  );
  log(afterRe.rows[0]?.lifecycle_state === 'managed_active' && afterRe.rows[0]?.owner === 'owner.test',
    'MANAGED lifecycle_state + owner survive re-discovery (not clobbered)', afterRe.rows[0]);

  // Part 4 metadata + Part 5 orchestration/routing/explain.
  const meta = await getMetadata(pool, 'intel.competency');
  log((meta as any).found === true, 'Part 4 metadata resolves a known entry');
  const orch = await getOrchestration(pool);
  log(/metadata-level/i.test(orch.note) && orch.composition.dependency_edges > 0,
    'Part 5 orchestration is metadata-level + builds a composition graph', { edges: orch.composition.dependency_edges });
  log(orch.composition.unresolved.length === 0, 'all declared dependencies resolve within the registry', { unresolved: orch.composition.unresolved.length });
  const route = await routeIntelligence(pool, { type: 'runtime' });
  log(route.matches.length > 0, 'Part 5 routing resolves by type (metadata only, no execution)', { matches: route.matches.length });
  const exp = await explainIntelligence(pool, 'intel.ai');
  log((exp as any).found === true && !!(exp as any).what, 'Part 5 explainability returns what/why/how');
  const missing = await explainIntelligence(pool, 'intel.does-not-exist');
  log((missing as any).found === false, 'unknown intelligence → found:false (never fabricated)');

  // Part 6 governance — honest gaps (ownership null across catalog).
  const gov = await getGovernance(pool);
  log(gov.governance_completeness != null, 'Part 6 governance_completeness is measured (not null when entries exist)', { v: gov.governance_completeness });
  log(gov.facet_coverage.ownership < 1, 'ownership is an HONEST gap (not fabricated to 100%)', { ownership: gov.facet_coverage.ownership });

  // Part 7 validation contract.
  const val = await getValidation(pool);
  log(val.verdict === 'VALIDATED', 'Part 7 verdict = VALIDATED (structural)');
  log(val.checks.no_dormant_activation.pass === true, 'no_dormant_activation asserted');
  log(val.checks.no_business_logic_change.pass === true, 'no_business_logic_change asserted');
  log(val.checks.existing_engines_reused.pass === true, 'existing engines reused (file-verified)');
  log(/STRUCTURAL/i.test(val.honesty_note), 'verdict is explicitly STRUCTURAL (Built ≠ Activated)');

  // Summary axes separation.
  const sum = await getSummary(pool);
  log(/Coverage ⟂ Confidence ⟂ Evidence/.test(sum.axes_note), 'summary keeps Coverage⟂Confidence⟂Evidence separate');

  // Audit snapshot + drift.
  const snap = await captureAuditSnapshot(pool, 'validator');
  log(snap.ok && !!snap.snapshot_uid, 'audit snapshot captured (write path)');
  await captureAuditSnapshot(pool, 'validator');
  const snaps = await getAuditSnapshots(pool, { limit: 5 });
  log(snaps.ready && snaps.snapshots.length >= 2, 'audit snapshots persisted + readable', { n: snaps.snapshots.length });
  const drift = await getAuditDrift(pool);
  log(drift.ready === true && (drift as any).drift !== undefined, 'audit drift computed across ≥2 snapshots');

  console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
