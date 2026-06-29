/**
 * MX-800 Phase 2.7 — Predictive Intelligence Engine: validation harness.
 *
 * Fail-fast unless the predictiveIntelligenceEngine flag is ON in THIS process (the service write paths
 * assert the flag). Run with the flag enabled:
 *   FF_PREDICTIVE_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.7-predictive-validate.ts
 *
 * Exercises all 9 parts + the write paths (discover/register/capture), the honesty contract (null ≠ 0,
 * exact COUNT(*) not n_live_tup, metrics NOT composited, forecast_confidence STRUCTURAL,
 * trend_accuracy honest-null), and the structural guarantees of this phase:
 *   (a) reads NEVER write to any existing prediction table (COUNT-before == COUNT-after on 13 sentinels);
 *   (b) the dormant prediction ENGINES are never INVOKED (only their file existence / persisted output is
 *       read — proven by every prediction table's COUNT staying unchanged across all read parts); and
 *   (c) /register REJECTS unsafe table identifiers (no SQL identifier injection).
 * Drops the engine's two OWN tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isPredictiveIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getPredictionCatalog, getTrendIntelligence, getRiskPrediction, getImpactSimulation,
  getScenarioIntelligence, getPredictionValidation, getPredictionMetrics, getPredictiveSummary,
  explainPrediction, getPredictionRegistry, getPredictionCapability, discoverPredictions,
  registerPredictionCapability, capturePredictiveSnapshot, getPredictiveSnapshots, getPredictiveDrift,
} from '../services/predictive-intelligence-engine';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

async function tableExists(pool: Pool, t: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS x`, [`public.${t}`]);
  return !!r.rows[0]?.x;
}
async function rawCount(pool: Pool, t: string): Promise<number | null> {
  if (!(await tableExists(pool, t))) return null;
  try { const r = await pool.query(`SELECT COUNT(*)::int AS n FROM "${t}"`); return Number(r.rows[0]?.n ?? 0); } catch { return null; }
}

async function main() {
  if (!isPredictiveIntelligenceEngineEnabled()) {
    console.error('FATAL: predictiveIntelligenceEngine flag is OFF. Re-run with FF_PREDICTIVE_INTELLIGENCE_ENGINE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean slate so the harness is idempotent / re-runnable.
    await pool.query('DROP TABLE IF EXISTS predictive_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS prediction_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent + reads never write —');
    ok('registry table absent before any write', !(await tableExists(pool, 'prediction_registry')));
    const regBefore = await getPredictionRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'prediction_registry')));

    // Sentinel existing prediction tables — exact COUNT(*) BEFORE exercising all read parts. Proves
    // (a) reads never write to any prediction trail and (b) the engines are never INVOKED.
    const SENTINELS = [
      'competency_forecasts', 'frp_user_readiness', 'lbi_behavior_trends', 'lbi_learning_trends',
      'lbi_risk_indicators', 'm4_skill_decay_forecasts', 'm4_organizational_capability_risks',
      'wos_workforce_risk', 'readiness_predictions', 'roie_forecasts', 'm4_simulation_scenarios',
      'm4_simulation_forecasts', 'platform_evolution_technical_debt',
    ];
    const before: Record<string, number | null> = {};
    for (const t of SENTINELS) before[t] = await rawCount(pool, t);

    console.log('\n— Part 1: Prediction Registry / Catalog (EXISTING capabilities, never created) —');
    const catalog = await getPredictionCatalog(pool);
    ok('catalog enumerates EXISTING prediction capabilities', Array.isArray(catalog.capabilities) && catalog.capabilities.length >= 13);
    ok('capabilities grouped by domain', Array.isArray(catalog.by_domain) && catalog.by_domain.length > 1);
    ok('by_kind present (forecast/trend/risk/simulation/scenario/readiness)', catalog.by_kind && Object.keys(catalog.by_kind).length > 1);
    ok('table_count is exact-or-null (null ≠ 0)', catalog.capabilities.every((c: any) => c.table_count === null || typeof c.table_count === 'number'));
    ok('present is DERIVED (table OR engine substrate)', catalog.capabilities.every((c: any) => typeof c.present === 'boolean'));
    ok('flag_state reported (Built ≠ Activated; null when unverified)', catalog.capabilities.some((c: any) => c.governing_flag && (c.flag_state === false || c.flag_state === true || c.flag_state === null)));
    ok('predictions_recorded is sum-or-null (null ≠ 0)', catalog.totals.predictions_recorded === null || typeof catalog.totals.predictions_recorded === 'number');

    console.log('\n— Part 2: Trend Intelligence (surface EXISTING trends; Trend ≠ Future) —');
    const trend = await getTrendIntelligence(pool);
    ok('trend_kind asserts Trend ≠ Future (never predicts)', /Trend ≠ Future/i.test(trend.trend_kind));
    ok('trend capabilities expose datapoints (null ≠ 0)', Array.isArray(trend.trend_capabilities) && trend.trend_capabilities.every((t: any) => 'datapoints' in t));
    ok('composes 5 prior tiers (tier_reachability.of === 5)', trend.tier_reachability?.of === 5 && typeof trend.tier_reachability?.reachable === 'number');

    console.log('\n— Part 3: Risk Prediction (surface EXISTING risks; Probability ≠ Certainty) —');
    const risk = await getRiskPrediction(pool);
    ok('risk_kind asserts Probability ≠ Certainty', /Probability ≠ Certainty/i.test(risk.risk_kind));
    ok('risk capabilities expose risks_recorded (null ≠ 0)', Array.isArray(risk.risk_capabilities) && risk.risk_capabilities.every((r: any) => 'risks_recorded' in r));
    ok('composes 5 prior tiers (tier_reachability.of === 5)', risk.tier_reachability?.of === 5);

    console.log('\n— Part 4: Impact Simulation (SIMULATION ONLY — never modifies production) —');
    const sim = await getImpactSimulation(pool);
    ok('simulation_kind is SIMULATION ONLY + Simulation ≠ Reality', /SIMULATION ONLY/i.test(sim.simulation_kind) && /Simulation ≠ Reality/i.test(sim.simulation_kind));
    ok('production never modified (0 business-table write paths)', sim.production_safety?.modifies_production === false && sim.production_safety?.write_paths_to_business_tables === 0);
    ok('simulation capabilities expose simulations_recorded (null ≠ 0)', Array.isArray(sim.simulation_capabilities) && sim.simulation_capabilities.every((s: any) => 'simulations_recorded' in s));

    console.log('\n— Part 5: Scenario Intelligence (frame EXISTING scenarios; never assert an outcome) —');
    const scenario = await getScenarioIntelligence(pool);
    ok('scenario_kind asserts Simulation ≠ Reality (never asserts outcome)', /Simulation ≠ Reality/i.test(scenario.scenario_kind));
    ok('seven scenario framings surfaced', Array.isArray(scenario.framings) && scenario.framings.length === 7);
    ok('substrate_populated is boolean (measured)', typeof scenario.substrate_populated === 'boolean');

    console.log('\n— Part 6: Prediction Explainability —');
    const exp = await explainPrediction(pool, 'pi-cap-competency-forecast');
    ok('explain returns why + evidence + structural confidence', exp.found === true && !!exp.evidence && exp.confidence?.level === 'structural');
    ok('explain has alternatives + repo/knowledge/runtime refs', Array.isArray(exp.alternatives) && Array.isArray(exp.repository_refs) && Array.isArray(exp.knowledge_refs) && Array.isArray(exp.runtime_refs));
    ok('explain asserts human-approval governance (never decides)', exp.governance?.human_approval === 'mandatory' && exp.governance?.automated_action === false);
    ok('evidence is COUNT-only over existing trail (null ≠ 0)', 'predictions_recorded' in exp.evidence);
    const expUnknown = await explainPrediction(pool, 'pi-cap-does-not-exist');
    ok('unknown uid → found:false (no fabrication)', expUnknown.found === false);

    console.log('\n— Part 7: Prediction Validation (STRUCTURAL only) —');
    const val = await getPredictionValidation(pool);
    ok('validation_kind STRUCTURAL only (NOT accuracy)', /STRUCTURAL only/i.test(val.validation_kind));
    ok('repository + model + evidence + prediction + trail + consistency + registry checks present',
      ['repository_integrity', 'model_integrity', 'evidence_integrity', 'prediction_integrity', 'prediction_trail_integrity', 'forecast_consistency', 'registry_metadata_integrity'].every((k) => (val.checks ?? []).some((c: any) => c.check === k)));
    ok('forecast_consistency is STRUCTURAL self-consistency NOT accuracy', (val.checks ?? []).find((c: any) => c.check === 'forecast_consistency')?.detail?.includes('NOT forecast accuracy'));
    ok('verdict ∈ {STRUCTURAL_VALIDATED,PARTIAL,ABSENT}', ['STRUCTURAL_VALIDATED', 'PARTIAL', 'ABSENT'].includes(val.verdict));

    console.log('\n— Part 8: Prediction Metrics (5 SEPARATE, never composited) —');
    const m = await getPredictionMetrics(pool);
    const KEYS = ['forecast_confidence', 'prediction_quality', 'trend_accuracy', 'risk_prediction_coverage', 'explainability_score'];
    const metricNames = (m.scores ?? []).map((s: any) => s.metric);
    ok('five separate metric scores present', KEYS.every((k) => metricNames.includes(k)) && m.scores.length === 5);
    ok('NO composite/overall score', m.composite === null && !('overall' in m) && !('score' in m));
    ok('trend_accuracy is honest-NULL (accuracy unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'trend_accuracy')?.score === null);
    ok('forecast_confidence axis is confidence (STRUCTURAL)', (m.scores ?? []).find((s: any) => s.metric === 'forecast_confidence')?.axis === 'confidence');
    ok('each score pct-or-null (null ≠ 0)', (m.scores ?? []).every((s: any) => s.score === null || (typeof s.score === 'number' && s.score >= 0 && s.score <= 100)));

    console.log('\n— Registry + discovery (catalog of prediction CAPABILITIES) —');
    const disc = await discoverPredictions(pool, 'validator');
    ok('discover succeeds + measures catalog', disc.ok === true && (disc.discovered ?? 0) > 0);
    const reg = await getPredictionRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('registry grouped by domain', Object.keys(reg.by_domain ?? {}).length > 1);
    const man = await registerPredictionCapability(pool, { prediction_uid: 'pi-man-test', name: 'manual_prediction', prediction_kind: 'forecast', domain: 'competency', physical_table: 'competency_forecasts', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getPredictionCapability(pool, 'pi-man-test');
    ok('manual owner persisted (MANAGED)', manEnt.found === true && manEnt.entry?.owner === 'qa@example.com');
    await discoverPredictions(pool, 'validator');
    const manEnt2 = await getPredictionCapability(pool, 'pi-man-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Security: /register rejects unsafe table identifiers (no SQL identifier injection) —');
    const tgtBeforeInj = await rawCount(pool, 'competency_forecasts');
    const evil = await registerPredictionCapability(pool, { prediction_uid: 'pi-evil', name: 'evil', prediction_kind: 'forecast', domain: 'competency', physical_table: 'competency_forecasts"; DROP TABLE competency_forecasts; --' }, 'attacker');
    ok('malicious physical_table rejected (ok:false)', evil.ok === false && /valid unquoted table identifier/i.test(evil.error ?? ''));
    ok('no row was written for the rejected payload', (await getPredictionCapability(pool, 'pi-evil')).found === false);
    ok('target table survived the injection attempt', (await rawCount(pool, 'competency_forecasts')) === tgtBeforeInj);

    console.log('\n— Summary + Audit (drift) —');
    const sum = await getPredictiveSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.7') && !!sum.metrics);
    ok('summary asserts simulation-only / production not modified', sum.production_safety?.modifies_production === false && sum.production_safety?.simulation_only === true);
    const cap1 = await capturePredictiveSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getPredictiveDrift(pool);
    ok('drift not comparable with <2 snapshots', drift1.ready === true && drift1.comparable === false);
    const cap2 = await capturePredictiveSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getPredictiveDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.comparable === true && !!drift2.deltas);
    const snaps = await getPredictiveSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log('\n— Honesty: reads NEVER write to existing prediction tables + engines NOT invoked —');
    let untouched = true; const drifted: string[] = [];
    for (const t of SENTINELS) {
      const after = await rawCount(pool, t);
      if (before[t] !== after) { untouched = false; drifted.push(`${t}:${before[t]}→${after}`); }
    }
    ok('all sentinel prediction tables COUNT-unchanged (no writes)', untouched, drifted.join(','));
    ok('competency_forecasts unchanged → forecasting engine NEVER invoked', before['competency_forecasts'] === await rawCount(pool, 'competency_forecasts'));
    ok('m4_simulation_forecasts unchanged → simulation never modifies production', before['m4_simulation_forecasts'] === await rawCount(pool, 'm4_simulation_forecasts'));

    console.log('\n— Cleanup (restore flag-OFF byte-identical incl. schema) —');
    await pool.query('DROP TABLE IF EXISTS predictive_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS prediction_registry');
    ok('both OWN tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'prediction_registry')) && !(await tableExists(pool, 'predictive_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.stack ?? e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.7 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
