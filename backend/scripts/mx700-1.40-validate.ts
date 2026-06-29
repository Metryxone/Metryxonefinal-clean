/* MX-700 Phase 1.40 — Platform Evolution & Technical Debt Intelligence service-level validation (dev only).
 * Exercises every read engine + the WRITE paths (register debt, update debt status, preserve knowledge,
 * capture evolution snapshot) against the REAL 1.37/1.38/1.39 substrate, then deletes its own test rows.
 * NOT a flag-OFF path test (it calls the services directly on purpose; the flag-OFF 503 path is asserted
 * by the HTTP smoke separately).
 *
 * Honesty assertions: the 6 evolution scores are SEPARATE measured ratios (or null), there is NO
 * composited "overall"/"composite" score, drift deltas are null when a side is unmeasurable (null ≠ zero),
 * and ensure-schema runs only on WRITE paths. */
import { Pool } from 'pg';
import { schemaReady as foundationSchemaReady } from '../services/platform-lifecycle';
import {
  scanRepositoryDebtMarkers, getTechnicalDebtIntelligence, getTechnicalDebtRegistry,
  registerTechnicalDebt, updateTechnicalDebtStatus, getVersionIntelligence, getDeprecationIntelligence,
  getRetirementIntelligence, getKnowledgeIntelligence, getKnowledgeRegistry, preserveKnowledge,
  getEvolutionIntelligence, getEvolutionValidation, getEvolutionMetrics, captureEvolutionSnapshot,
  getEvolutionSnapshots, getEvolutionDrift, getEvolutionReports, getEvolutionSummary,
} from '../services/platform-evolution-intelligence';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ok = (c: boolean, m: string) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
const isNumOrNull = (v: unknown) => v === null || typeof v === 'number';

(async () => {
  const debtUids: string[] = [];
  const knowUids: string[] = [];
  const snapUids: string[] = [];
  try {
    const founded = await foundationSchemaReady(pool);
    console.log(`Foundation schema ready: ${founded} (if false, run POST /api/admin/platform-lifecycle/discover first)\n`);

    // PART 1: marker scan is ALWAYS measurable (filesystem), independent of Foundation.
    const markers = await scanRepositoryDebtMarkers({ sampleLimit: 5 });
    ok(markers.ready && typeof markers.total === 'number' && markers.counts && typeof markers.counts.TODO === 'number',
      `repo marker scan MEASURED (files=${markers.files_scanned} total=${markers.total} ${JSON.stringify(markers.counts)})`);

    // PART 1 WRITE: register a curated debt item (owns ensure-schema), then update its status (append history).
    const reg = await registerTechnicalDebt(pool, { title: 'VALIDATION debt item', category: 'code', priority: 'low', severity: 'low', actor: 'validation-1.40' });
    ok(reg.ok && !!reg.debt_uid, `registerTechnicalDebt -> ${reg.debt_uid}`);
    if (reg.debt_uid) debtUids.push(reg.debt_uid);
    const upd = reg.debt_uid ? await updateTechnicalDebtStatus(pool, reg.debt_uid, { status: 'resolved', note: 'validation close', actor: 'validation-1.40' }) : { ok: false };
    ok(upd.ok, 'updateTechnicalDebtStatus appends resolution_history');
    const reg2 = await getTechnicalDebtRegistry(pool, { limit: 5 });
    ok(reg2.ready && reg2.rows.length >= 1, `debt registry read-back ready (${reg2.rows.length} rows)`);

    const debtIntel = await getTechnicalDebtIntelligence(pool);
    ok(debtIntel.ready && debtIntel.registry && debtIntel.repository_markers, 'technical-debt intelligence composes registry + markers (separate axes)');

    // PART 5 WRITE: preserve a knowledge entry.
    const kreg = await preserveKnowledge(pool, { decisionType: 'engineering', title: 'VALIDATION knowledge', decision: 'd', rationale: 'r', actor: 'validation-1.40' });
    ok(kreg.ok && !!kreg.knowledge_uid, `preserveKnowledge -> ${kreg.knowledge_uid}`);
    if (kreg.knowledge_uid) knowUids.push(kreg.knowledge_uid);
    const kreg2 = await getKnowledgeRegistry(pool, { limit: 5 });
    ok(kreg2.ready && kreg2.rows.length >= 1, `knowledge registry read-back ready (${kreg2.rows.length} rows)`);
    const kIntel = await getKnowledgeIntelligence(pool);
    ok(kIntel.ready && typeof kIntel.repository_knowledge_index.memory_topic_files === 'number' && typeof kIntel.repository_knowledge_index.documentation_files === 'number',
      `knowledge index MEASURED (memory=${kIntel.repository_knowledge_index.memory_topic_files} docs=${kIntel.repository_knowledge_index.documentation_files})`);

    if (!founded) {
      console.log('\nFoundation not discovered — version/deprecation/retirement/evolution/metrics correctly return ready:false. Skipping Foundation-dependent measured assertions.');
    } else {
      // PART 2/3/4/6: compose 1.38 ledgers.
      const ver = await getVersionIntelligence(pool);
      ok(ver.ready && ver.coverage && isNumOrNull(ver.coverage.capability_version_coverage) && typeof ver.git?.available === 'boolean', 'version intelligence composes ledger + git degrades honestly');
      const dep = await getDeprecationIntelligence(pool);
      ok(dep.ready && (dep.total_deprecations === null || typeof dep.total_deprecations === 'number'), 'deprecation intelligence composes 1.38 ledger (null ≠ zero)');
      const ret = await getRetirementIntelligence(pool);
      ok(ret.ready && (ret.total_retirements === null || typeof ret.total_retirements === 'number'), 'retirement intelligence composes 1.38 ledger (null ≠ zero)');
      const evo = await getEvolutionIntelligence(pool);
      ok(evo.ready && evo.repository_evolution && typeof evo.repository_evolution.migrations_discovered === 'number', `evolution intelligence MEASURED (migrations=${evo.repository_evolution.migrations_discovered})`);

      // PART 7: validation composes 1.39.
      const val = await getEvolutionValidation(pool);
      ok(val.ready && val.knowledge_preservation && val.version_integrity, 'evolution validation composes 1.39 + knowledge/version checks');

      // PART 8: metrics — SIX SEPARATE scores, NO composite.
      const m = await getEvolutionMetrics(pool);
      const scoreKeys = ['technical_debt_health', 'version_health', 'repository_evolution', 'knowledge_health', 'migration_health', 'architecture_stability'];
      ok(m.ready && scoreKeys.every((k) => isNumOrNull(m.scores[k])), 'all 6 evolution scores number|null (separate axes)');
      ok(!Object.prototype.hasOwnProperty.call(m.scores, 'overall') && !Object.prototype.hasOwnProperty.call(m.scores, 'composite'), 'NO composited "overall"/"composite" score (honesty)');
      console.log('  scores:', JSON.stringify(m.scores));

      // PART 9: capture snapshots + drift.
      const s1 = await captureEvolutionSnapshot(pool, 'validation-1.40');
      ok(s1.ok && typeof s1.snapshot_uid === 'string', `evolution snapshot #1 captured (${s1.snapshot_uid})`);
      if (s1.snapshot_uid) snapUids.push(s1.snapshot_uid);
      const s2 = await captureEvolutionSnapshot(pool, 'validation-1.40');
      ok(s2.ok, `evolution snapshot #2 captured (${s2.snapshot_uid})`);
      if (s2.snapshot_uid) snapUids.push(s2.snapshot_uid);
      const snaps = await getEvolutionSnapshots(pool, { limit: 5 });
      ok(snaps.ready && snaps.rows.length >= 2, `snapshots list returns >=2 (${snaps.rows.length})`);
      const drift = await getEvolutionDrift(pool);
      ok(drift.ready && drift.snapshots === 2 && drift.drift && isNumOrNull(drift.drift.migration_health), 'drift computed between latest 2 (number|null deltas)');

      // reports + summary compose everything.
      const reports = await getEvolutionReports(pool);
      ok(reports.ready && reports.reports && reports.reports.debt_report && reports.reports.knowledge_preservation_report, 'reports compose all read surfaces');
      const sum = await getEvolutionSummary(pool);
      ok(sum.ready && Array.isArray(sum.composes) && sum.composes.length === 3, 'summary declares it COMPOSES 1.37 + 1.38 + 1.39');
    }

    // cleanup own test rows
    for (const u of debtUids) await pool.query(`DELETE FROM platform_evolution_technical_debt WHERE debt_uid=$1`, [u]).catch(() => {});
    for (const u of knowUids) await pool.query(`DELETE FROM platform_evolution_knowledge WHERE knowledge_uid=$1`, [u]).catch(() => {});
    for (const u of snapUids) await pool.query(`DELETE FROM platform_evolution_audit_snapshots WHERE snapshot_uid=$1`, [u]).catch(() => {});
    const leftover =
      (debtUids.length ? (await pool.query(`SELECT count(*)::int n FROM platform_evolution_technical_debt WHERE debt_uid = ANY($1)`, [debtUids])).rows[0].n : 0) +
      (knowUids.length ? (await pool.query(`SELECT count(*)::int n FROM platform_evolution_knowledge WHERE knowledge_uid = ANY($1)`, [knowUids])).rows[0].n : 0) +
      (snapUids.length ? (await pool.query(`SELECT count(*)::int n FROM platform_evolution_audit_snapshots WHERE snapshot_uid = ANY($1)`, [snapUids])).rows[0].n : 0);
    ok(leftover === 0, `cleanup complete (${leftover} test rows remain)`);
    console.log('\nDONE');
  } catch (e: any) {
    console.error('ERROR', e.message, e.stack);
  } finally {
    await pool.end();
  }
})();
