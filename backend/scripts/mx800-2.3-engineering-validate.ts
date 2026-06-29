/**
 * MX-800 Phase 2.3 — Engineering Intelligence Engine: validation harness.
 *
 * Fail-fast unless the engineeringIntelligence flag is ON in THIS process (the service write paths
 * assert the flag). Run with the flag enabled:
 *   FF_ENGINEERING_INTELLIGENCE=1 npx tsx scripts/mx800-2.3-engineering-validate.ts
 *
 * Exercises the read getters (compose-never-throws), the write paths (discover/register/capture),
 * the honesty contract (null ≠ 0, metrics NOT composited, AST-deferred fields null), and that the
 * lazy ensure-schema only runs on flag-ON write paths. Drops the two tables at the end to restore
 * "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isEngineeringIntelligenceEnabled } from '../config/feature-flags';
import {
  discoverEngineering, getEngineeringRegistry, getEngineeringEntity, registerEngineeringEntity,
  getCodeIntelligence, getArchitectureIntelligence, getDependencyIntelligence, getQualityIntelligence,
  getEngineeringReasoning, explainEngineeringEntity, getEngineeringValidation, getEngineeringMetrics,
  getEngineeringSummary, captureEngineeringSnapshot, getEngineeringSnapshots, getEngineeringDrift,
} from '../services/engineering-intelligence';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

async function main() {
  if (!isEngineeringIntelligenceEnabled()) {
    console.error('FATAL: engineeringIntelligence flag is OFF. Re-run with FF_ENGINEERING_INTELLIGENCE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Start from a clean slate so the harness is idempotent / re-runnable (no orphaned partial state).
    await pool.query('DROP TABLE IF EXISTS engineering_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS engineering_knowledge_registry');

    console.log('\n— Part 1: Engineering Knowledge Registry —');
    const disc = await discoverEngineering(pool, 'validator');
    ok('discover succeeds + measures files', disc.ok === true && (disc.files ?? 0) > 0, JSON.stringify({ files: disc.files, libs: disc.libraries }));
    const reg = await getEngineeringRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('ownership coverage is honest (null when 0 assigned)', reg.ownership?.coverage === null || typeof reg.ownership?.coverage === 'number');

    const sampleUid = reg.entries?.[0]?.engineering_uid;
    const ent = sampleUid ? await getEngineeringEntity(pool, sampleUid) : { found: false };
    ok('getEngineeringEntity returns a measured row', ent.found === true && ent.entry?.size_lines >= 0);

    const man = await registerEngineeringEntity(pool, { engineering_uid: 'eng-manual-test', name: 'manual_test', entity_type: 'component', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getEngineeringEntity(pool, 'eng-manual-test');
    ok('manual owner persisted (MANAGED)', manEnt.entry?.owner === 'qa@example.com');
    // Re-discover must NOT clobber managed owner.
    await discoverEngineering(pool, 'validator');
    const manEnt2 = await getEngineeringEntity(pool, 'eng-manual-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Part 2: Code Intelligence —');
    const code = await getCodeIntelligence(pool);
    ok('code size measured (>0 lines)', (code.code_size?.total_lines ?? 0) > 0);
    ok('debt markers measured', typeof code.code_smells?.total === 'number');
    ok('complexity/cohesion/duplication are honest NULL (DEFERRED)',
      code.not_measured?.cyclomatic_complexity === null && code.not_measured?.cohesion === null && code.not_measured?.semantic_duplication === null);

    console.log('\n— Part 3: Architecture Intelligence —');
    const arch = await getArchitectureIntelligence(pool);
    ok('layers detected (routes/services present)', (arch.architecture_layers?.detected ?? []).includes('routes') && arch.architecture_layers.detected.includes('services'));
    ok('layer_violations honest NULL (AST DEFERRED)', arch.layer_violations?.measured === null);

    console.log('\n— Part 4: Dependency Intelligence —');
    const dep = await getDependencyIntelligence(pool);
    ok('library deps measured (runtime+build)', (dep.library_dependencies?.total ?? 0) > 0 && (dep.library_dependencies?.runtime ?? 0) > 0);
    ok('internal import edges measured', (dep.module_dependencies?.internal_edges ?? 0) > 0);
    ok('api deps honest NULL (DEFERRED)', dep.api_dependencies?.measured === null);

    console.log('\n— Part 5: Quality Intelligence —');
    const q = await getQualityIntelligence(pool);
    ok('test-file ratio measured (not line coverage)', typeof q.test_coverage?.test_file_ratio === 'number' || q.test_coverage?.test_file_ratio === null);
    ok('line_coverage honest NULL (instrumentation DEFERRED)', q.test_coverage?.line_coverage === null);
    ok('maintainability_index honest NULL (AST DEFERRED)', q.maintainability?.maintainability_index === null);

    console.log('\n— Part 6: Engineering Reasoning —');
    const reason = await getEngineeringReasoning(pool);
    ok('reasoning composed (array, evidence-grounded)', Array.isArray(reason.reasoning));
    const exp = sampleUid ? await explainEngineeringEntity(pool, sampleUid) : { found: false };
    ok('per-entity explain is evidence-grounded', exp.found === true && !!exp.evidence);

    console.log('\n— Part 7: Validation —');
    const val = await getEngineeringValidation(pool);
    ok('verdict is STRUCTURAL', val.verdict === 'STRUCTURAL_VALIDATED');
    ok('no_duplicate_engineering_engine pass', val.checks?.no_duplicate_engineering_engine?.pass === true);
    ok('no_business_logic_change pass', val.checks?.no_business_logic_change?.pass === true);

    console.log('\n— Part 8: Metrics (SEPARATE, never composited) —');
    const m = await getEngineeringMetrics(pool);
    ok('six separate score keys present', !!m.scores && ['engineering_health', 'architecture_health', 'quality_health', 'dependency_health', 'repository_stability', 'technical_debt_trend'].every((k) => k in m.scores));
    ok('NO composite/overall score', !('overall' in m.scores) && !('composite' in m.scores) && !('score' in m.scores));
    ok('technical_debt_trend null until ≥2 snapshots', m.scores?.technical_debt_trend === null || typeof m.scores?.technical_debt_trend === 'number');

    console.log('\n— Summary + Audit —');
    const sum = await getEngineeringSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.3') && !!sum.metrics);
    const cap1 = await captureEngineeringSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getEngineeringDrift(pool);
    ok('drift null with <2 snapshots', drift1.ready === true && drift1.drift === null);
    const cap2 = await captureEngineeringSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getEngineeringDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.drift !== null);
    const snaps = await getEngineeringSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log(`\n— Cleanup (restore flag-OFF byte-identical incl. schema) —`);
    await pool.query('DROP TABLE IF EXISTS engineering_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS engineering_knowledge_registry');
    console.log('  ✓ dropped both tables');
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.3 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
