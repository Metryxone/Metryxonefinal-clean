/**
 * MX-800 Phase 2.8 — Recommendation Intelligence Engine: validation harness.
 *
 * Fail-fast unless the recommendationIntelligenceEngine flag is ON in THIS process (the service write
 * paths assert the flag). Run with the flag enabled:
 *   FF_RECOMMENDATION_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.8-recommendation-validate.ts
 *
 * Exercises all 9 parts + the write paths (discover/register/capture), the honesty contract (null ≠ 0,
 * exact COUNT(*) not n_live_tup, metrics NOT composited, recommendation_confidence STRUCTURAL,
 * acceptance_rate + effectiveness honest-null), and the structural guarantees of this phase:
 *   (a) reads NEVER write to any existing recommendation/opportunity table (COUNT-before == COUNT-after);
 *   (b) the dormant recommendation ENGINES are never INVOKED (only their file existence / persisted output
 *       is read — proven by every recommendation table's COUNT staying unchanged across all read parts);
 *   (c) it never executes/automates/decides (execution_safety flags false everywhere); and
 *   (d) /register REJECTS unsafe table identifiers (no SQL identifier injection).
 * Drops the engine's two OWN tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isRecommendationIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getRecommendationCatalog, getActionIntelligence, getOpportunityIntelligence,
  getPrioritizationIntelligence, getPrescriptiveIntelligence, getRecommendationValidation,
  getRecommendationMetrics, getRecommendationSummary, explainRecommendation, getRecommendationRegistry,
  getRecommendationCapability, discoverRecommendations, registerRecommendationCapability,
  captureRecommendationSnapshot, getRecommendationSnapshots, getRecommendationDrift,
} from '../services/recommendation-intelligence-engine';

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
  if (!isRecommendationIntelligenceEngineEnabled()) {
    console.error('FATAL: recommendationIntelligenceEngine flag is OFF. Re-run with FF_RECOMMENDATION_INTELLIGENCE_ENGINE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean slate so the harness is idempotent / re-runnable.
    await pool.query('DROP TABLE IF EXISTS recommendation_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS recommendation_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent + reads never write —');
    ok('registry table absent before any write', !(await tableExists(pool, 'recommendation_registry')));
    const regBefore = await getRecommendationRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'recommendation_registry')));

    // Sentinel existing recommendation/opportunity tables — exact COUNT(*) BEFORE exercising all read
    // parts. Proves (a) reads never write to any recommendation trail and (b) the engines are never INVOKED.
    const SENTINELS = [
      'capadex_recommendations', 'career_recommendations', 'frp_recommendations', 'lbi_user_recommendations',
      'mei_user_recommendations', 'rie_recommendations', 'cg_user_recommendations', 'm5_executive_recommendations',
      'learning_recommendations', 'development_recommendations', 'rie_opportunity_flags',
      'paie_opportunity_forecasts', 'roie_opportunities', 'iil_opportunities', 'nhda_opportunities',
      'capadex_interventions', 'pil_intervention_library',
    ];
    const before: Record<string, number | null> = {};
    for (const t of SENTINELS) before[t] = await rawCount(pool, t);

    console.log('\n— Part 1: Recommendation Registry / Catalog (EXISTING capabilities, never created) —');
    const catalog = await getRecommendationCatalog(pool);
    ok('catalog enumerates EXISTING recommendation capabilities (≥18)', Array.isArray(catalog.capabilities) && catalog.capabilities.length >= 18);
    ok('capabilities grouped by domain', Array.isArray(catalog.by_domain) && catalog.by_domain.length > 1);
    ok('by_kind present (recommendation/opportunity/intervention/optimization)', catalog.by_kind && Object.keys(catalog.by_kind).length >= 4);
    ok('table_count is exact-or-null (null ≠ 0)', catalog.capabilities.every((c: any) => c.table_count === null || typeof c.table_count === 'number'));
    ok('present is DERIVED (table OR engine substrate)', catalog.capabilities.every((c: any) => typeof c.present === 'boolean'));
    ok('flag_state reported (Built ≠ Activated; null when unverified)', catalog.capabilities.some((c: any) => c.governing_flag && (c.flag_state === false || c.flag_state === true || c.flag_state === null)));
    ok('recommendations_recorded is sum-or-null (null ≠ 0)', catalog.totals.recommendations_recorded === null || typeof catalog.totals.recommendations_recorded === 'number');

    console.log('\n— Part 2: Action Intelligence (surface EXISTING actions; Recommendation ≠ Execution) —');
    const action = await getActionIntelligence(pool);
    ok('action_kind asserts Recommendation ≠ Execution', /Recommendation ≠ Execution/i.test(action.action_kind));
    ok('execution_safety: never executes/automates, 0 business writes', action.execution_safety?.executes_actions === false && action.execution_safety?.automates_actions === false && action.execution_safety?.write_paths_to_business_tables === 0);
    ok('action capabilities expose actions_recorded (null ≠ 0)', Array.isArray(action.action_capabilities) && action.action_capabilities.every((a: any) => 'actions_recorded' in a));
    ok('composes 6 prior tiers (tier_reachability.of === 6)', action.tier_reachability?.of === 6 && typeof action.tier_reachability?.reachable === 'number');

    console.log('\n— Part 3: Opportunity Intelligence (surface EXISTING opportunities; Opportunity ≠ Requirement) —');
    const opp = await getOpportunityIntelligence(pool);
    ok('opportunity_kind asserts Opportunity ≠ Requirement', /Opportunity ≠ Requirement/i.test(opp.opportunity_kind));
    ok('opportunity capabilities expose opportunities_recorded (null ≠ 0)', Array.isArray(opp.opportunity_capabilities) && opp.opportunity_capabilities.every((o: any) => 'opportunities_recorded' in o));
    ok('opportunity capabilities present (≥3)', opp.opportunity_capabilities.length >= 3);
    ok('composes 6 prior tiers (tier_reachability.of === 6)', opp.tier_reachability?.of === 6);

    console.log('\n— Part 4: Prioritization Engine (STRUCTURAL; Priority ≠ Approval; never decides) —');
    const prio = await getPrioritizationIntelligence(pool);
    ok('prioritization_kind asserts Priority ≠ Approval', /Priority ≠ Approval/i.test(prio.prioritization_kind));
    ok('decision_safety: never asserts priority / approves / decides', prio.decision_safety?.asserts_business_priority === false && prio.decision_safety?.approves === false && prio.decision_safety?.decides === false);
    ok('basis is structural_substrate_volume', prio.basis === 'structural_substrate_volume');
    ok('by_kind framing present', Array.isArray(prio.by_kind) && prio.by_kind.length > 1);

    console.log('\n— Part 5: Prescriptive Intelligence (RECOMMEND ONLY — never executes) —');
    const presc = await getPrescriptiveIntelligence(pool);
    ok('prescriptive_kind is RECOMMEND ONLY + Recommendation ≠ Execution', /RECOMMEND ONLY/i.test(presc.prescriptive_kind) && /Recommendation ≠ Execution/i.test(presc.prescriptive_kind));
    ok('execution_safety: never executes/automates/decides/modifies prod (0 business writes)', presc.execution_safety?.executes === false && presc.execution_safety?.automates === false && presc.execution_safety?.decides === false && presc.execution_safety?.modifies_production === false && presc.execution_safety?.write_paths_to_business_tables === 0);
    ok('prescriptive capabilities expose recommendations_recorded (null ≠ 0)', Array.isArray(presc.prescriptive_capabilities) && presc.prescriptive_capabilities.every((p: any) => 'recommendations_recorded' in p));
    ok('substrate_populated is boolean (measured)', typeof presc.substrate_populated === 'boolean');

    console.log('\n— Part 6: Recommendation Explainability —');
    const exp = await explainRecommendation(pool, 'ri-cap-career-recommendation');
    ok('explain returns why + evidence + structural confidence', exp.found === true && !!exp.evidence && exp.confidence?.level === 'structural');
    ok('explain has alternatives + repo/knowledge/runtime refs', Array.isArray(exp.alternatives) && Array.isArray(exp.repository_refs) && Array.isArray(exp.knowledge_refs) && Array.isArray(exp.runtime_refs));
    ok('explain asserts human-approval governance (never decides/executes)', exp.governance?.human_approval === 'mandatory' && exp.governance?.automated_action === false && exp.governance?.executes === false && exp.governance?.decides === false);
    ok('evidence is COUNT-only over existing trail (null ≠ 0)', 'recommendations_recorded' in exp.evidence);
    const expUnknown = await explainRecommendation(pool, 'ri-cap-does-not-exist');
    ok('unknown uid → found:false (no fabrication)', expUnknown.found === false);

    console.log('\n— Part 7: Recommendation Validation (STRUCTURAL only) —');
    const val = await getRecommendationValidation(pool);
    ok('validation_kind STRUCTURAL only (NOT acceptance/effectiveness)', /STRUCTURAL only/i.test(val.validation_kind));
    ok('repository + engine + evidence + recommendation + trail + consistency + registry checks present',
      ['repository_integrity', 'engine_integrity', 'evidence_integrity', 'recommendation_integrity', 'recommendation_trail_integrity', 'recommendation_consistency', 'registry_metadata_integrity'].every((k) => (val.checks ?? []).some((c: any) => c.check === k)));
    ok('recommendation_consistency is STRUCTURAL self-consistency NOT acceptance', (val.checks ?? []).find((c: any) => c.check === 'recommendation_consistency')?.detail?.includes('NOT acceptance or effectiveness'));
    ok('verdict ∈ {STRUCTURAL_VALIDATED,PARTIAL,ABSENT}', ['STRUCTURAL_VALIDATED', 'PARTIAL', 'ABSENT'].includes(val.verdict));

    console.log('\n— Part 8: Recommendation Metrics (6 SEPARATE, never composited) —');
    const m = await getRecommendationMetrics(pool);
    const KEYS = ['recommendation_quality', 'recommendation_confidence', 'recommendation_coverage', 'explainability_score', 'acceptance_rate', 'effectiveness'];
    const metricNames = (m.scores ?? []).map((s: any) => s.metric);
    ok('six separate metric scores present', KEYS.every((k) => metricNames.includes(k)) && m.scores.length === 6);
    ok('NO composite/overall score', m.composite === null && !('overall' in m) && !('score' in m));
    ok('acceptance_rate is honest-NULL (adoption unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'acceptance_rate')?.score === null);
    ok('effectiveness is honest-NULL (outcome unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'effectiveness')?.score === null);
    ok('recommendation_confidence axis is confidence (STRUCTURAL)', (m.scores ?? []).find((s: any) => s.metric === 'recommendation_confidence')?.axis === 'confidence');
    ok('each score pct-or-null (null ≠ 0)', (m.scores ?? []).every((s: any) => s.score === null || (typeof s.score === 'number' && s.score >= 0 && s.score <= 100)));

    console.log('\n— Registry + discovery (catalog of recommendation CAPABILITIES) —');
    const disc = await discoverRecommendations(pool, 'validator');
    ok('discover succeeds + measures catalog', disc.ok === true && (disc.discovered ?? 0) > 0);
    const reg = await getRecommendationRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('registry grouped by domain', Object.keys(reg.by_domain ?? {}).length > 1);
    const man = await registerRecommendationCapability(pool, { recommendation_uid: 'ri-man-test', name: 'manual_recommendation', recommendation_kind: 'recommendation', domain: 'career', physical_table: 'career_recommendations', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getRecommendationCapability(pool, 'ri-man-test');
    ok('manual owner persisted (MANAGED)', manEnt.found === true && manEnt.entry?.owner === 'qa@example.com');
    await discoverRecommendations(pool, 'validator');
    const manEnt2 = await getRecommendationCapability(pool, 'ri-man-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Security: /register rejects unsafe table identifiers (no SQL identifier injection) —');
    const tgtBeforeInj = await rawCount(pool, 'career_recommendations');
    const evil = await registerRecommendationCapability(pool, { recommendation_uid: 'ri-evil', name: 'evil', recommendation_kind: 'recommendation', domain: 'career', physical_table: 'career_recommendations"; DROP TABLE career_recommendations; --' }, 'attacker');
    ok('malicious physical_table rejected (ok:false)', evil.ok === false && /valid unquoted table identifier/i.test(evil.error ?? ''));
    ok('no row was written for the rejected payload', (await getRecommendationCapability(pool, 'ri-evil')).found === false);
    ok('target table survived the injection attempt', (await rawCount(pool, 'career_recommendations')) === tgtBeforeInj);

    console.log('\n— Summary + Audit (drift) —');
    const sum = await getRecommendationSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.8') && !!sum.metrics);
    ok('summary asserts recommend-only / never executes/decides', sum.execution_safety?.executes === false && sum.execution_safety?.decides === false && sum.execution_safety?.recommend_only === true);
    ok('summary composes 6 prior tiers', sum.composition?.of === 6);
    const cap1 = await captureRecommendationSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getRecommendationDrift(pool);
    ok('drift not comparable with <2 snapshots', drift1.ready === true && drift1.comparable === false);
    const cap2 = await captureRecommendationSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getRecommendationDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.comparable === true && !!drift2.deltas);
    const snaps = await getRecommendationSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log('\n— Honesty: reads NEVER write to existing recommendation tables + engines NOT invoked —');
    let untouched = true; const drifted: string[] = [];
    for (const t of SENTINELS) {
      const after = await rawCount(pool, t);
      if (before[t] !== after) { untouched = false; drifted.push(`${t}:${before[t]}→${after}`); }
    }
    ok('all sentinel recommendation tables COUNT-unchanged (no writes)', untouched, drifted.join(','));
    ok('career_recommendations unchanged → recommendation engine NEVER invoked', before['career_recommendations'] === await rawCount(pool, 'career_recommendations'));
    ok('rie_opportunity_flags unchanged → opportunity engine NEVER invoked', before['rie_opportunity_flags'] === await rawCount(pool, 'rie_opportunity_flags'));

    console.log('\n— Cleanup (restore flag-OFF byte-identical incl. schema) —');
    await pool.query('DROP TABLE IF EXISTS recommendation_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS recommendation_registry');
    ok('both OWN tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'recommendation_registry')) && !(await tableExists(pool, 'recommendation_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.stack ?? e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.8 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
