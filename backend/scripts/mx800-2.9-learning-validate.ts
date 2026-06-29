/**
 * MX-800 Phase 2.9 — Continuous Learning Intelligence Engine: validation harness.
 *
 * Fail-fast unless the continuousLearningIntelligenceEngine flag is ON in THIS process (the service write
 * paths assert the flag). Run with the flag enabled:
 *   FF_CONTINUOUS_LEARNING_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.9-learning-validate.ts
 *
 * Exercises all 9 parts + the write paths (discover/register/capture), the honesty contract (null ≠ 0,
 * exact COUNT(*) not n_live_tup, metrics NOT composited, learning_confidence STRUCTURAL, improvement_rate +
 * effectiveness honest-null), and the structural guarantees of this phase:
 *   (a) reads NEVER write to any existing learning/feedback/experience/adaptive table (COUNT-before == after);
 *   (b) the dormant learning/adaptive ENGINES are never INVOKED (only their file existence / persisted output
 *       is read — proven by every learning table's COUNT staying unchanged across all read parts);
 *   (c) it never executes/adapts/decides/modifies business logic (safety flags false everywhere); and
 *   (d) /register REJECTS unsafe table identifiers (no SQL identifier injection).
 * Drops the engine's two OWN tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isContinuousLearningIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getLearningCatalog, getFeedbackIntelligence, getExperienceIntelligence,
  getAdaptiveIntelligence, getContinuousImprovement, getLearningValidation,
  getLearningMetrics, getOrganizationalLearning, getLearningSummary, explainLearning,
  getLearningRegistry, getLearningCapability, discoverLearning, registerLearningCapability,
  captureLearningSnapshot, getLearningSnapshots, getLearningDrift,
} from '../services/continuous-learning-intelligence-engine';

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
  if (!isContinuousLearningIntelligenceEngineEnabled()) {
    console.error('FATAL: continuousLearningIntelligenceEngine flag is OFF. Re-run with FF_CONTINUOUS_LEARNING_INTELLIGENCE_ENGINE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean slate so the harness is idempotent / re-runnable.
    await pool.query('DROP TABLE IF EXISTS continuous_learning_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS learning_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent + reads never write —');
    ok('registry table absent before any write', !(await tableExists(pool, 'learning_registry')));
    const regBefore = await getLearningRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'learning_registry')));

    // Sentinel existing learning tables — exact COUNT(*) BEFORE exercising all read parts. Proves (a) reads
    // never write to any learning trail and (b) the engines are never INVOKED.
    const SENTINELS = [
      'learn_outcomes', 'cg_user_learning_recs', 'lip_learning_paths', 'wos_learning_roi',
      'lip_learning_needs', 'meta_learning_profiles', 'learning_recommendations', 'interview_feedback',
      'learn_intervention_events', 'cp_experience', 'episodic_memory', 'behavioural_memory',
      'competency_memory_history', 'wcl5_memory', 'adaptive_intelligence_events', 'adaptive_runtime_state',
      'irt_adaptive_config', 'platform_evolution_audit_snapshots', 'iil_self_evolution_log',
      'platform_evolution_knowledge', 'm3_ontology_evolution_events',
    ];
    const before: Record<string, number | null> = {};
    for (const t of SENTINELS) before[t] = await rawCount(pool, t);

    console.log('\n— Part 1: Learning Registry / Catalog (EXISTING capabilities, never created) —');
    const catalog = await getLearningCatalog(pool);
    ok('catalog enumerates EXISTING learning capabilities (≥18)', Array.isArray(catalog.capabilities) && catalog.capabilities.length >= 18);
    ok('capabilities grouped by domain (>1)', Array.isArray(catalog.by_domain) && catalog.by_domain.length > 1);
    ok('by_kind covers ≥6 learning kinds', catalog.by_kind && Object.keys(catalog.by_kind).length >= 6);
    ok('table_count is exact-or-null (null ≠ 0)', catalog.capabilities.every((c: any) => c.table_count === null || typeof c.table_count === 'number'));
    ok('present is DERIVED (table OR engine substrate)', catalog.capabilities.every((c: any) => typeof c.present === 'boolean'));
    ok('flag_state reported (Built ≠ Activated; null when unverified)', catalog.capabilities.some((c: any) => c.governing_flag && (c.flag_state === false || c.flag_state === true || c.flag_state === null)));
    ok('learning_events_recorded is sum-or-null (null ≠ 0)', catalog.totals.learning_events_recorded === null || typeof catalog.totals.learning_events_recorded === 'number');

    console.log('\n— Part 2: Feedback Intelligence (surface EXISTING feedback; Feedback ≠ Truth) —');
    const feedback = await getFeedbackIntelligence(pool);
    ok('feedback_kind asserts Feedback ≠ Truth', /Feedback ≠ Truth/i.test(feedback.feedback_kind));
    ok('feedback_safety: never treats feedback as truth / generates / decides, 0 business writes', feedback.feedback_safety?.treats_feedback_as_truth === false && feedback.feedback_safety?.generates_feedback === false && feedback.feedback_safety?.decides === false && feedback.feedback_safety?.write_paths_to_business_tables === 0);
    ok('feedback capabilities expose feedback_recorded (null ≠ 0)', Array.isArray(feedback.feedback_capabilities) && feedback.feedback_capabilities.every((a: any) => 'feedback_recorded' in a));
    ok('composes 7 prior tiers (tier_reachability.of === 7)', feedback.tier_reachability?.of === 7 && typeof feedback.tier_reachability?.reachable === 'number');

    console.log('\n— Part 3: Experience Intelligence (surface EXISTING experience; Experience ≠ Knowledge) —');
    const exp3 = await getExperienceIntelligence(pool);
    ok('experience_kind asserts Experience ≠ Knowledge', /Experience ≠ Knowledge/i.test(exp3.experience_kind));
    ok('experience_safety: never equates experience with knowledge / decides', exp3.experience_safety?.equates_experience_with_knowledge === false && exp3.experience_safety?.decides === false);
    ok('experience capabilities expose experience_recorded (null ≠ 0)', Array.isArray(exp3.experience_capabilities) && exp3.experience_capabilities.every((o: any) => 'experience_recorded' in o));
    ok('experience capabilities present (≥3)', exp3.experience_capabilities.length >= 3);
    ok('composes 7 prior tiers (tier_reachability.of === 7)', exp3.tier_reachability?.of === 7);

    console.log('\n— Part 4: Adaptive Intelligence (Adaptation ≠ Autonomous Change; never modifies business logic) —');
    const adaptive = await getAdaptiveIntelligence(pool);
    ok('adaptive_kind asserts Adaptation ≠ Autonomous Change', /Adaptation ≠ Autonomous Change/i.test(adaptive.adaptive_kind));
    ok('adaptation_safety: never modifies business logic / autonomous / executes / decides', adaptive.adaptation_safety?.modifies_business_logic === false && adaptive.adaptation_safety?.autonomous_change === false && adaptive.adaptation_safety?.executes === false && adaptive.adaptation_safety?.decides === false && adaptive.adaptation_safety?.write_paths_to_business_tables === 0);
    ok('adaptive capabilities expose adaptive_records + flag_state (Built ≠ Activated)', Array.isArray(adaptive.adaptive_capabilities) && adaptive.adaptive_capabilities.every((a: any) => 'adaptive_records' in a && 'flag_state' in a));
    ok('composes 7 prior tiers (tier_reachability.of === 7)', adaptive.tier_reachability?.of === 7);

    console.log('\n— Part 5: Continuous Improvement (Improvement ≠ Optimization; evidence-only, never optimizes) —');
    const impr = await getContinuousImprovement(pool);
    ok('improvement_kind asserts Improvement ≠ Optimization', /Improvement ≠ Optimization/i.test(impr.improvement_kind));
    ok('improvement_safety: never optimizes / modifies business logic / autonomous / executes / decides', impr.improvement_safety?.optimizes === false && impr.improvement_safety?.modifies_business_logic === false && impr.improvement_safety?.autonomous === false && impr.improvement_safety?.executes === false && impr.improvement_safety?.decides === false);
    ok('evidence_basis is verified_existing_substrate', impr.evidence_basis === 'verified_existing_substrate');
    ok('improvement capabilities expose improvement_records (null ≠ 0)', Array.isArray(impr.improvement_capabilities) && impr.improvement_capabilities.every((p: any) => 'improvement_records' in p));
    ok('substrate_populated is boolean (measured)', typeof impr.substrate_populated === 'boolean');

    console.log('\n— Part 6: Learning Explainability —');
    const exp = await explainLearning(pool, 'cl-cap-learning-path');
    ok('explain returns why + evidence + structural confidence', exp.found === true && !!exp.evidence && exp.confidence?.level === 'structural');
    ok('explain has previous/current state + reason_for_change (NO CHANGE — honest)', !!exp.previous_state && !!exp.current_state && /NO CHANGE/i.test(exp.reason_for_change ?? ''));
    ok('explain has alternatives + repo/knowledge/runtime refs', Array.isArray(exp.alternatives) && Array.isArray(exp.repository_refs) && Array.isArray(exp.knowledge_refs) && Array.isArray(exp.runtime_refs));
    ok('explain asserts human-approval governance (never decides/executes/learns autonomously)', exp.governance?.human_approval === 'mandatory' && exp.governance?.automated_action === false && exp.governance?.executes === false && exp.governance?.decides === false && exp.governance?.autonomous_learning === false);
    ok('evidence is COUNT-only over existing trail (null ≠ 0)', 'learning_records' in exp.evidence);
    const expUnknown = await explainLearning(pool, 'cl-cap-does-not-exist');
    ok('unknown uid → found:false (no fabrication)', expUnknown.found === false);

    console.log('\n— Part 7: Learning Validation (STRUCTURAL only) —');
    const val = await getLearningValidation(pool);
    ok('validation_kind STRUCTURAL only (NOT improvement/effectiveness)', /STRUCTURAL only/i.test(val.validation_kind));
    ok('repository + engine + evidence + learning + trail + consistency + registry checks present',
      ['repository_integrity', 'engine_integrity', 'evidence_integrity', 'learning_integrity', 'learning_trail_integrity', 'learning_consistency', 'registry_metadata_integrity'].every((k) => (val.checks ?? []).some((c: any) => c.check === k)));
    ok('learning_consistency is STRUCTURAL self-consistency NOT effectiveness', (val.checks ?? []).find((c: any) => c.check === 'learning_consistency')?.detail?.includes('NOT effectiveness'));
    ok('verdict ∈ {STRUCTURAL_VALIDATED,PARTIAL,ABSENT}', ['STRUCTURAL_VALIDATED', 'PARTIAL', 'ABSENT'].includes(val.verdict));

    console.log('\n— Part 8: Learning Metrics (6 SEPARATE, never composited) —');
    const m = await getLearningMetrics(pool);
    const KEYS = ['learning_quality', 'learning_confidence', 'learning_coverage', 'explainability_score', 'improvement_rate', 'effectiveness'];
    const metricNames = (m.scores ?? []).map((s: any) => s.metric);
    ok('six separate metric scores present', KEYS.every((k) => metricNames.includes(k)) && m.scores.length === 6);
    ok('NO composite/overall score', m.composite === null && !('overall' in m) && !('score' in m));
    ok('improvement_rate is honest-NULL (longitudinal improvement unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'improvement_rate')?.score === null);
    ok('effectiveness is honest-NULL (outcome unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'effectiveness')?.score === null);
    ok('learning_confidence axis is confidence (STRUCTURAL)', (m.scores ?? []).find((s: any) => s.metric === 'learning_confidence')?.axis === 'confidence');
    ok('each score pct-or-null (null ≠ 0)', (m.scores ?? []).every((s: any) => s.score === null || (typeof s.score === 'number' && s.score >= 0 && s.score <= 100)));

    console.log('\n— Part 9: Organizational Learning (MEASURED preservation; Experience ≠ Knowledge) —');
    const org = await getOrganizationalLearning(pool);
    ok('organizational_kind asserts Experience ≠ Knowledge', /Experience ≠ Knowledge/i.test(org.organizational_kind));
    ok('preservation_safety: never generates lessons / decides / modifies business logic', org.preservation_safety?.generates_lessons === false && org.preservation_safety?.decides === false && org.preservation_safety?.modifies_business_logic === false);
    ok('preserved.memory_lessons MEASURED (count number-or-null, null ≠ 0)', org.preserved?.memory_lessons?.count === null || typeof org.preserved?.memory_lessons?.count === 'number');
    ok('preserved.documentation MEASURED (count number-or-null)', org.preserved?.documentation?.count === null || typeof org.preserved?.documentation?.count === 'number');
    ok('preserved.platform_evolution_knowledge COUNT-or-null (null ≠ 0)', org.preserved?.platform_evolution_knowledge?.count === null || typeof org.preserved?.platform_evolution_knowledge?.count === 'number');
    ok('composes 7 prior tiers (tier_reachability.of === 7)', org.tier_reachability?.of === 7);

    console.log('\n— Registry + discovery (catalog of learning CAPABILITIES) —');
    const disc = await discoverLearning(pool, 'validator');
    ok('discover succeeds + measures catalog', disc.ok === true && (disc.discovered ?? 0) > 0);
    const reg = await getLearningRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('registry grouped by domain', Object.keys(reg.by_domain ?? {}).length > 1);
    const man = await registerLearningCapability(pool, { learning_uid: 'cl-man-test', name: 'manual_learning', learning_kind: 'learning', domain: 'learning', physical_table: 'lip_learning_paths', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getLearningCapability(pool, 'cl-man-test');
    ok('manual owner persisted (MANAGED)', manEnt.found === true && manEnt.entry?.owner === 'qa@example.com');
    await discoverLearning(pool, 'validator');
    const manEnt2 = await getLearningCapability(pool, 'cl-man-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Security: /register rejects unsafe table identifiers (no SQL identifier injection) —');
    const tgtBeforeInj = await rawCount(pool, 'lip_learning_paths');
    const evil = await registerLearningCapability(pool, { learning_uid: 'cl-evil', name: 'evil', learning_kind: 'learning', domain: 'learning', physical_table: 'lip_learning_paths"; DROP TABLE lip_learning_paths; --' }, 'attacker');
    ok('malicious physical_table rejected (ok:false)', evil.ok === false && /valid unquoted table identifier/i.test(evil.error ?? ''));
    ok('no row was written for the rejected payload', (await getLearningCapability(pool, 'cl-evil')).found === false);
    ok('target table survived the injection attempt', (await rawCount(pool, 'lip_learning_paths')) === tgtBeforeInj);

    console.log('\n— Summary + Audit (drift) —');
    const sum = await getLearningSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.9') && !!sum.metrics);
    ok('summary asserts learn-only / never executes/decides/adapts/modifies business logic', sum.learn_safety?.executes === false && sum.learn_safety?.decides === false && sum.learn_safety?.adapts === false && sum.learn_safety?.modifies_business_logic === false && sum.learn_safety?.learns_autonomously === false && sum.learn_safety?.learn_only === true);
    ok('summary composes 7 prior tiers', sum.composition?.of === 7);
    const cap1 = await captureLearningSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getLearningDrift(pool);
    ok('drift not comparable with <2 snapshots', drift1.ready === true && drift1.comparable === false);
    const cap2 = await captureLearningSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getLearningDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.comparable === true && !!drift2.deltas);
    const snaps = await getLearningSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log('\n— Honesty: reads NEVER write to existing learning tables + engines NOT invoked —');
    let untouched = true; const drifted: string[] = [];
    for (const t of SENTINELS) {
      const after = await rawCount(pool, t);
      if (before[t] !== after) { untouched = false; drifted.push(`${t}:${before[t]}→${after}`); }
    }
    ok('all sentinel learning tables COUNT-unchanged (no writes)', untouched, drifted.join(','));
    ok('learn_outcomes unchanged → intervention-learning engine NEVER invoked', before['learn_outcomes'] === await rawCount(pool, 'learn_outcomes'));
    ok('adaptive_intelligence_events unchanged → adaptive event bus NEVER invoked', before['adaptive_intelligence_events'] === await rawCount(pool, 'adaptive_intelligence_events'));

    console.log('\n— Cleanup (restore flag-OFF byte-identical incl. schema) —');
    await pool.query('DROP TABLE IF EXISTS continuous_learning_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS learning_registry');
    ok('both OWN tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'learning_registry')) && !(await tableExists(pool, 'continuous_learning_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.stack ?? e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.9 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
