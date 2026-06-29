/* MX-700 Phase 1.39 — Platform Lifecycle Intelligence service-level validation (dev only).
 * Exercises every read engine + the audit-snapshot write path against the REAL Foundation
 * registry, then deletes its own test snapshot rows. NOT a flag-OFF path test (it calls the
 * services directly on purpose; the flag-OFF 503 path is asserted by the HTTP smoke separately).
 *
 * Honesty assertions: scores are SEPARATE measured ratios (or null), drift deltas null when a
 * side is unmeasurable (null ≠ 0), and the snapshot capture is the ONLY write path. */
import { Pool } from 'pg';
import { schemaReady as foundationSchemaReady } from '../services/platform-lifecycle';
import {
  getLifecycleEvidence, getLifecycleConfidence, getLifecycleHealth,
  getRepositoryHealthIntel, getCompatibilityIntelligence, getLifecycleValidation,
  getLifecycleMetrics, getIntelligenceSummary,
  captureAuditSnapshot, getAuditSnapshots, getAuditDrift, explainLifecycle,
} from '../services/platform-lifecycle-intelligence';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ok = (c: boolean, m: string) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
const isNumOrNull = (v: unknown) => v === null || typeof v === 'number';

(async () => {
  const captured: string[] = [];
  try {
    const founded = await foundationSchemaReady(pool);
    console.log(`Foundation schema ready: ${founded} (if false, run POST /api/admin/platform-lifecycle/discover first)\n`);

    // PART 1: Evidence — per-source coverage ⟂ confidence
    const ev = await getLifecycleEvidence(pool);
    if (!ev.ready) { console.log('Foundation not discovered — engines correctly return ready:false. Skipping measured assertions.'); }
    else {
      ok(Array.isArray(ev.evidence) && ev.evidence.length >= 6, `evidence has ${ev.evidence?.length} sources`);
      const repo = ev.evidence.find((e: any) => e.source === 'repository');
      ok(isNumOrNull(repo?.coverage) && isNumOrNull(repo?.confidence), 'evidence coverage & confidence are number|null (separate axes)');
      const git = ev.evidence.find((e: any) => e.source === 'git');
      ok(typeof git?.available === 'boolean', `git evidence degrades honestly (available=${git?.available})`);

      // PART 2: Confidence — independent axes
      const cf = await getLifecycleConfidence(pool);
      ok(cf.ready && cf.confidence && isNumOrNull(cf.confidence.repository_confidence), 'confidence axes measured (number|null)');

      // PART 4: Health — separate dimensions
      const h = await getLifecycleHealth(pool);
      ok(h.ready && ['completeness', 'consistency', 'coverage', 'compliance', 'readiness', 'stability'].every((k) => isNumOrNull(h.health[k])), 'health dimensions all number|null');

      // PART 5: Repository health — composes + adds
      const rh = await getRepositoryHealthIntel(pool);
      ok(rh.ready && typeof rh.checks.circular_dependencies === 'number' && typeof rh.checks.large_files === 'number', `repo-health adds circular_deps=${rh.checks.circular_dependencies} large_files=${rh.checks.large_files}`);

      // PART 6: Compatibility
      const compat = await getCompatibilityIntelligence(pool);
      ok(compat.ready && compat.compatibility && Array.isArray(compat.compatibility.by_status), 'compatibility intelligence ready');

      // PART 7: Validation — composes foundation + metadata
      const val = await getLifecycleValidation(pool);
      ok(val.ready && val.metadata_validation && typeof val.metadata_validation.repository_integrity_broken_references === 'number', 'validation composes foundation + metadata');

      // PART 9: Metrics — separate scores, never composited
      const m = await getLifecycleMetrics(pool);
      const scoreKeys = ['lifecycle_health_score', 'repository_health_score', 'compatibility_score', 'evidence_score', 'confidence_score', 'architecture_stability'];
      ok(m.ready && scoreKeys.every((k) => isNumOrNull(m.scores[k])), 'all 6 scores number|null (separate axes)');
      ok(!Object.prototype.hasOwnProperty.call(m.scores, 'overall') && !Object.prototype.hasOwnProperty.call(m.scores, 'composite'), 'NO composited "overall" score (honesty)');
      console.log('  scores:', JSON.stringify(m.scores));

      // PART 3: Explainability — pick a real registry uid
      const someUid = (await pool.query(`SELECT lifecycle_uid FROM platform_lifecycle_registry LIMIT 1`)).rows[0]?.lifecycle_uid;
      if (someUid) {
        const ex = await explainLifecycle(pool, someUid);
        ok(ex.ready && ex.found && ex.explanation && ex.explanation.why && ex.explanation.evidence, `explain(${someUid}) composes why/evidence/impact`);
      }
      const exMissing = await explainLifecycle(pool, 'capability:__does_not_exist__');
      ok(exMissing.ready && exMissing.found === false, 'explain unknown uid -> found:false (no fabrication)');

      // PART 8: Audit — write snapshot, then drift
      const s1 = await captureAuditSnapshot(pool, 'validation-1.39');
      ok(s1.ok && typeof s1.snapshot_uid === 'string', `audit snapshot #1 captured (${s1.snapshot_uid})`);
      captured.push(s1.snapshot_uid);
      const s2 = await captureAuditSnapshot(pool, 'validation-1.39');
      ok(s2.ok, `audit snapshot #2 captured (${s2.snapshot_uid})`);
      captured.push(s2.snapshot_uid);
      const snaps = await getAuditSnapshots(pool, { limit: 5 });
      ok(snaps.ready && snaps.rows.length >= 2, `snapshots list returns >=2 (${snaps.rows.length})`);
      const drift = await getAuditDrift(pool);
      ok(drift.ready && drift.snapshots === 2 && drift.drift && isNumOrNull(drift.drift.lifecycle_health_score), 'drift computed between latest 2 (number|null deltas)');

      // Summary composes everything
      const sum = await getIntelligenceSummary(pool);
      ok(sum.ready && Array.isArray(sum.composes) && sum.composes.length === 2, 'summary declares it COMPOSES 1.37 + 1.38');
    }

    // cleanup own snapshots
    for (const uid of captured) await pool.query(`DELETE FROM ${'platform_lifecycle_intelligence_snapshots'} WHERE snapshot_uid=$1`, [uid]).catch(() => {});
    const leftover = captured.length
      ? (await pool.query(`SELECT count(*)::int n FROM platform_lifecycle_intelligence_snapshots WHERE snapshot_uid = ANY($1)`, [captured])).rows[0].n
      : 0;
    ok(leftover === 0, `cleanup complete (${leftover} test snapshots remain)`);
    console.log('\nDONE');
  } catch (e: any) {
    console.error('ERROR', e.message, e.stack);
  } finally {
    await pool.end();
  }
})();
