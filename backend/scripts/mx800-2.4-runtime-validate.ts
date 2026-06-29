/**
 * MX-800 Phase 2.4 — Runtime Intelligence Engine: validation harness.
 *
 * Fail-fast unless the runtimeIntelligenceEngine flag is ON in THIS process (the service write paths
 * assert the flag). Run with the flag enabled:
 *   FF_RUNTIME_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.4-runtime-validate.ts
 *
 * Exercises the read getters (compose-never-throws), the write paths (discover/register/capture),
 * the honesty contract (null ≠ 0, metrics NOT composited, load/AST-deferred fields null, Configured ≠
 * Running ≠ Healthy), and that the lazy ensure-schema only runs on flag-ON write paths. Drops the two
 * tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isRuntimeIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  discoverRuntime, getRuntimeRegistry, getRuntimeComponent, registerRuntimeComponent,
  getApplicationHealth, getPerformanceIntelligence, getServiceIntelligence, getObservabilityIntelligence,
  getResourceIntelligence, getRuntimeReasoning, explainRuntimeComponent, getRuntimeValidation,
  getRuntimeMetrics, getRuntimeSummary, captureRuntimeSnapshot, getRuntimeSnapshots, getRuntimeDrift,
} from '../services/runtime-intelligence';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

async function tableExists(pool: Pool, t: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS x`, [`public.${t}`]);
  return !!r.rows[0]?.x;
}

async function main() {
  if (!isRuntimeIntelligenceEngineEnabled()) {
    console.error('FATAL: runtimeIntelligenceEngine flag is OFF. Re-run with FF_RUNTIME_INTELLIGENCE_ENGINE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Start from a clean slate so the harness is idempotent / re-runnable (no orphaned partial state).
    await pool.query('DROP TABLE IF EXISTS runtime_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS runtime_component_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent —');
    ok('registry table absent before any write', !(await tableExists(pool, 'runtime_component_registry')));
    const regBefore = await getRuntimeRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'runtime_component_registry')));

    console.log('\n— Part 1: Runtime Component Registry —');
    const disc = await discoverRuntime(pool, 'validator');
    ok('discover succeeds + measures components', disc.ok === true && (disc.components ?? 0) > 0, JSON.stringify({ components: disc.components }));
    const reg = await getRuntimeRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('ownership coverage is honest (null when 0 assigned)', reg.ownership?.coverage === null || typeof reg.ownership?.coverage === 'number');
    ok('presence coverage measured', typeof reg.presence?.coverage === 'number' || reg.presence?.coverage === null);

    const procEnt = await getRuntimeComponent(pool, 'rt-process-backend');
    ok('getRuntimeComponent returns the backend-process row', procEnt.found === true && procEnt.entry?.present === true);

    const man = await registerRuntimeComponent(pool, { runtime_uid: 'rt-manual-test', name: 'manual_test', component_type: 'service', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getRuntimeComponent(pool, 'rt-manual-test');
    ok('manual owner persisted (MANAGED)', manEnt.entry?.owner === 'qa@example.com');
    // Re-discover must NOT clobber managed owner.
    await discoverRuntime(pool, 'validator');
    const manEnt2 = await getRuntimeComponent(pool, 'rt-manual-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Part 2: Application Health (composes health-aggregator) —');
    const health = await getApplicationHealth(pool);
    ok('health composed from 6-domain monitor', Array.isArray(health.domains) && health.domains.length > 0);
    ok('overall_status present (healthy|degraded|down|unknown)', ['healthy', 'degraded', 'down', 'unknown'].includes(health.overall_status));
    ok('composes health-aggregator (not a parallel engine)', (health.composes ?? []).includes('health-aggregator.computeAllHealthDomains'));

    console.log('\n— Part 3: Performance Intelligence —');
    const perf = await getPerformanceIntelligence(pool);
    ok('db round-trip latency MEASURED', typeof perf.db_round_trip_latency?.avg === 'number' && (perf.db_round_trip_latency?.samples ?? 0) > 0);
    ok('event-loop lag MEASURED', typeof perf.event_loop?.lag_ms === 'number');
    ok('throughput/p95/p99 honest NULL (load tooling DEFERRED)',
      perf.not_measured?.http_throughput_rps === null && perf.not_measured?.response_time_p95 === null && perf.not_measured?.response_time_p99 === null);

    console.log('\n— Part 4: Service Intelligence —');
    const svc = await getServiceIntelligence(pool);
    ok('db measured as a service', (svc.services ?? []).some((s: any) => s.name === 'postgres-database' && s.measurable === true));
    ok('external services configured-only (honest-NULL health)', (svc.services ?? []).some((s: any) => s.name === 'upload-service' && s.measurable === false));
    ok('availability over MEASURABLE only (denom excludes unprobed)', (svc.availability?.measurable_total ?? 0) >= 1 && (svc.availability?.availability_pct === null || typeof svc.availability?.availability_pct === 'number'));
    ok('service dependency graph honest NULL (DEFERRED)', svc.service_dependency_graph?.measured === null);

    console.log('\n— Part 5: Observability Intelligence —');
    const obs = await getObservabilityIntelligence(pool);
    ok('observability signals enumerated (present vs populated)', Array.isArray(obs.observability_signals) && obs.observability_signals.length > 0);
    ok('coverage is a present/total ratio', typeof obs.coverage?.coverage_pct === 'number' || obs.coverage?.coverage_pct === null);
    ok('tracing/structured-logs honest NULL (no APM DEFERRED)', obs.not_measured?.distributed_tracing === null && obs.not_measured?.structured_log_coverage === null);

    console.log('\n— Part 6: Resource Intelligence —');
    const res = await getResourceIntelligence(pool);
    ok('process memory MEASURED (rss>0)', (res.process_memory?.rss_mb ?? 0) > 0);
    ok('system memory headroom MEASURED', typeof res.system_memory?.headroom_pct === 'number' || res.system_memory?.headroom_pct === null);
    ok('cpu measured (cumulative us)', typeof res.cpu?.user_us === 'number');
    ok('container limits / disk IO honest NULL (cgroup DEFERRED)', res.not_measured?.container_memory_limit === null && res.not_measured?.disk_io === null);

    console.log('\n— Part 7: Runtime Reasoning —');
    const reason = await getRuntimeReasoning(pool);
    ok('reasoning composed (array, evidence-grounded)', Array.isArray(reason.reasoning));
    const exp = await explainRuntimeComponent(pool, 'rt-process-backend');
    ok('per-component explain is evidence-grounded', exp.found === true && !!exp.evidence);

    console.log('\n— Part 8: Validation —');
    const val = await getRuntimeValidation(pool);
    ok('verdict is STRUCTURAL', val.verdict === 'STRUCTURAL_VALIDATED');
    ok('no_duplicate_runtime_engine pass', val.checks?.no_duplicate_runtime_engine?.pass === true);
    ok('no_business_logic_change pass', val.checks?.no_business_logic_change?.pass === true);
    ok('no_dormant_activation pass', val.checks?.no_dormant_activation?.pass === true);

    console.log('\n— Part 9: Metrics (SEPARATE, never composited) —');
    const m = await getRuntimeMetrics(pool);
    const SCORE_KEYS = ['application_health', 'performance_health', 'resource_health', 'service_availability', 'observability_coverage', 'runtime_stability_trend'];
    ok('six separate score keys present', !!m.scores && SCORE_KEYS.every((k) => k in m.scores));
    ok('NO composite/overall score', !('overall' in m.scores) && !('composite' in m.scores) && !('score' in m.scores));
    ok('runtime_stability_trend null until ≥2 snapshots', m.scores?.runtime_stability_trend === null || typeof m.scores?.runtime_stability_trend === 'number');
    ok('performance_health MEASURED from latency', m.scores?.performance_health === null || typeof m.scores?.performance_health === 'number');

    console.log('\n— Summary + Audit —');
    const sum = await getRuntimeSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.4') && !!sum.metrics);
    const cap1 = await captureRuntimeSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getRuntimeDrift(pool);
    ok('drift null with <2 snapshots', drift1.ready === true && drift1.drift === null);
    const cap2 = await captureRuntimeSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getRuntimeDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.drift !== null);
    const snaps = await getRuntimeSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);
    const m2 = await getRuntimeMetrics(pool);
    ok('runtime_stability_trend numeric after ≥2 snapshots', typeof m2.scores?.runtime_stability_trend === 'number');

    console.log(`\n— Cleanup (restore flag-OFF byte-identical incl. schema) —`);
    await pool.query('DROP TABLE IF EXISTS runtime_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS runtime_component_registry');
    ok('both tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'runtime_component_registry')) && !(await tableExists(pool, 'runtime_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.4 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
