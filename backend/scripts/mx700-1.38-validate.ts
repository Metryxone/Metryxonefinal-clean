/* MX-700 Phase 1.38 — service-level validation (dev only). Exercises the compose
 * flow against the REAL Foundation registry, then deletes its own test rows.
 * NOT a flag-OFF path test (it calls the service directly on purpose). */
import { Pool } from 'pg';
import {
  ensureManagementSchema, getManagementSummary, getEntityLifecycle,
  registerEntity, setVersion, getVersionHistory, recordEvolution, getEvolution,
  deprecateEntity, getDeprecation, retireEntity, getEntityLifecycleDetail,
} from '../services/platform-lifecycle-management';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TEST = 'test:plm-1.38-validation';
const DEP = 'test:plm-1.38-dependent';
const ok = (c: boolean, m: string) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);

async function cleanup() {
  for (const uid of [TEST, DEP]) {
    await pool.query(`DELETE FROM platform_lifecycle_evolution WHERE lifecycle_uid=$1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM platform_lifecycle_version_ledger WHERE lifecycle_uid=$1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM platform_lifecycle_deprecation WHERE lifecycle_uid=$1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM platform_lifecycle_retirement WHERE lifecycle_uid=$1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM platform_lifecycle_relationships WHERE from_uid=$1 OR to_uid=$1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM platform_lifecycle_state_history WHERE lifecycle_uid=$1`, [uid]).catch(() => {});
    await pool.query(`DELETE FROM platform_lifecycle_registry WHERE lifecycle_uid=$1`, [uid]).catch(() => {});
  }
}

(async () => {
  try {
    await cleanup();
    await ensureManagementSchema(pool);
    const tbls = (await pool.query(
      `SELECT count(*)::int n FROM unnest(ARRAY['platform_lifecycle_deprecation','platform_lifecycle_retirement','platform_lifecycle_version_ledger','platform_lifecycle_evolution']) t WHERE to_regclass('public.'||t) IS NOT NULL`)).rows[0].n;
    ok(tbls === 4, `4 management tables present (got ${tbls})`);

    const sum = await getManagementSummary(pool);
    ok(sum.ready && sum.foundation_ready && sum.management_ready, 'summary ready (foundation+management)');
    console.log('  views:', sum.views.map((v: any) => `${v.view}=${v.registry_count}${v.derived ? '(derived)' : ''}`).join(' '));
    console.log('  by_entity_type:', JSON.stringify(sum.by_entity_type));

    for (const v of ['feature', 'capability', 'module', 'api', 'model'] as const) {
      const r = await getEntityLifecycle(pool, v, { limit: 1 });
      ok(r.ready && typeof r.total === 'number', `view ${v}: ready, total=${r.total}, derived=${r.derived}`);
    }

    // register (PART 1) — net-new feature entity
    const reg = await registerEntity(pool, { uid: TEST, entityType: 'feature', identifier: 'plm-validation-feature', state: 'active', actor: 'validation' });
    ok(reg.ok && reg.created === true && reg.state === 'active', 'registerEntity created (state=active)');

    // version (PART 6)
    await setVersion(pool, TEST, { currentVersion: 'v1.0.0', releaseStatus: 'released', actor: 'validation' });
    await setVersion(pool, TEST, { currentVersion: 'v1.1.0', previousVersion: 'v1.0.0', releaseStatus: 'released', actor: 'validation' });
    const vh = await getVersionHistory(pool, TEST);
    ok(vh.ready && vh.rows.length === 2 && vh.rows[0].current_version === 'v1.1.0', `version ledger append-only (${vh.rows.length} rows, latest=${vh.rows[0]?.current_version})`);
    const regVer = (await pool.query(`SELECT current_version FROM platform_lifecycle_registry WHERE lifecycle_uid=$1`, [TEST])).rows[0].current_version;
    ok(regVer === 'v1.1.0', `registry authoritative current_version updated (${regVer})`);

    // evolution (PART 9)
    await recordEvolution(pool, TEST, { evolutionType: 'enhancement', summary: 'added X', fromValue: 'v1.0.0', toValue: 'v1.1.0', actor: 'validation' });
    const ev = await getEvolution(pool, { uid: TEST });
    ok(ev.ready && ev.rows.length === 1 && ev.rows[0].evolution_type === 'enhancement', `evolution log recorded (${ev.rows.length})`);

    // deprecate (PART 7) — composes transitionState
    const dep = await deprecateEntity(pool, TEST, { policy: 'sunset-30d', reason: 'superseded', replacementReference: 'newFeature', actor: 'validation' });
    ok(dep.ok && dep.transition?.ok, 'deprecateEntity composed transitionState');
    const depState = (await pool.query(`SELECT lifecycle_state, deprecation_status FROM platform_lifecycle_registry WHERE lifecycle_uid=$1`, [TEST])).rows[0];
    ok(depState.lifecycle_state === 'deprecated', `registry lifecycle_state=deprecated (${depState.lifecycle_state}, dep_status=${depState.deprecation_status})`);
    const dg = await getDeprecation(pool, { uid: TEST });
    ok(dg.ready && dg.rows.length === 1 && dg.rows[0].replacement_reference === 'newFeature', 'deprecation metadata stored');

    // retirement (PART 8) — dependency validation
    await registerEntity(pool, { uid: DEP, entityType: 'module', identifier: 'plm-validation-dependent', actor: 'validation' });
    await pool.query(`INSERT INTO platform_lifecycle_relationships (from_uid,to_uid,relationship_type,evidence) VALUES ($1,$2,'depends_on','validation') ON CONFLICT DO NOTHING`, [DEP, TEST]);
    const blocked = await retireEntity(pool, TEST, { approvalStatus: 'approved', approvedBy: 'validation', actor: 'validation' });
    ok(!blocked.ok && blocked.error === 'has_active_dependents' && (blocked.dependents?.length ?? 0) === 1, `retire BLOCKED by measured dependency (${blocked.error})`);
    const forced = await retireEntity(pool, TEST, { approvalStatus: 'approved', approvedBy: 'validation', archiveReference: 'archive/plm', force: true, actor: 'validation' });
    ok(forced.ok && forced.transition?.ok, 'retire forced through (records dependency snapshot)');
    const retState = (await pool.query(`SELECT lifecycle_state FROM platform_lifecycle_registry WHERE lifecycle_uid=$1`, [TEST])).rows[0].lifecycle_state;
    ok(retState === 'retired', `registry lifecycle_state=retired (${retState})`);

    // full detail composition
    const detail = await getEntityLifecycleDetail(pool, TEST);
    ok(detail.ready && detail.found && detail.deprecation && detail.retirement && detail.versions.length === 2 && detail.evolution.length === 1 && detail.state_history.length >= 3,
      `detail composes all tiers (versions=${detail.versions.length} evolution=${detail.evolution.length} history=${detail.state_history.length})`);

    // unknown entity honesty
    const unk = await deprecateEntity(pool, 'test:does-not-exist-xyz', { reason: 'x' });
    ok(!unk.ok && unk.error === 'unknown_entity', 'unknown entity -> honest error (no fabrication)');

    await cleanup();
    const leftover = (await pool.query(`SELECT count(*)::int n FROM platform_lifecycle_registry WHERE lifecycle_uid IN ($1,$2)`, [TEST, DEP])).rows[0].n;
    ok(leftover === 0, `cleanup complete (${leftover} test rows remain)`);
    console.log('\nDONE');
  } catch (e: any) {
    console.error('ERROR', e.message, e.stack);
  } finally {
    await pool.end();
  }
})();
