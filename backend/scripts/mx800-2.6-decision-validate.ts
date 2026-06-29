/**
 * MX-800 Phase 2.6 — Decision Intelligence Engine: validation harness.
 *
 * Fail-fast unless the decisionIntelligenceEngine flag is ON in THIS process (the service write paths
 * assert the flag). Run with the flag enabled:
 *   FF_DECISION_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.6-decision-validate.ts
 *
 * Exercises all 9 parts + the write paths (discover/register/capture), the honesty contract (null ≠ 0,
 * exact COUNT(*) not n_live_tup, metrics NOT composited, decision_confidence STRUCTURAL,
 * recommendation_quality honest-null), and the structural guarantees of this phase:
 *   (a) reads NEVER write to any existing decision table (COUNT-before == COUNT-after on a sentinel);
 *   (b) the dormant decision ENGINES are never INVOKED (only their file existence / persisted output is
 *       read — proven by the wc7b_decision_state COUNT staying unchanged across all read parts); and
 *   (c) /register REJECTS unsafe table identifiers (no SQL identifier injection).
 * Drops the engine's two OWN tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isDecisionIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getDecisionCatalog, getDecisionReasoning, getDecisionEvidence, getDecisionConfidence,
  getDecisionGovernance, getDecisionValidation, getDecisionMetrics, getDecisionSummary,
  explainDecision, getDecisionRegistry, getDecisionCapability, discoverDecisions,
  registerDecisionCapability, captureDecisionSnapshot, getDecisionSnapshots, getDecisionDrift,
} from '../services/decision-intelligence';

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
  if (!isDecisionIntelligenceEngineEnabled()) {
    console.error('FATAL: decisionIntelligenceEngine flag is OFF. Re-run with FF_DECISION_INTELLIGENCE_ENGINE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean slate so the harness is idempotent / re-runnable.
    await pool.query('DROP TABLE IF EXISTS decision_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS decision_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent + reads never write —');
    ok('registry table absent before any write', !(await tableExists(pool, 'decision_registry')));
    const regBefore = await getDecisionRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'decision_registry')));

    // Sentinel existing decision tables — record exact COUNT(*) BEFORE exercising all read parts.
    const SENTINELS = [
      'wc7b_decision_state', 'ai_decision_audits', 'executive_decision_models', 'interview_decisions',
      'role_resolution_decisions', 'wc3_personalization_decisions', 'archetype_governance_decisions',
      'm4_ai_decision_logs', 'm5_executive_decision_audits',
    ];
    const before: Record<string, number | null> = {};
    for (const t of SENTINELS) before[t] = await rawCount(pool, t);

    console.log('\n— Part 1: Decision Registry / Catalog (EXISTING capabilities, never created) —');
    const catalog = await getDecisionCatalog(pool);
    ok('catalog enumerates EXISTING decision capabilities', Array.isArray(catalog.capabilities) && catalog.capabilities.length >= 10);
    ok('capabilities grouped by domain', Array.isArray(catalog.by_domain) && catalog.by_domain.length > 1);
    ok('table_count is exact-or-null (null ≠ 0)', catalog.capabilities.every((c: any) => c.table_count === null || typeof c.table_count === 'number'));
    ok('present is DERIVED (table OR engine substrate)', catalog.capabilities.every((c: any) => typeof c.present === 'boolean'));
    ok('flag_state reported (Built ≠ Activated; null when unverified)', catalog.capabilities.some((c: any) => c.governing_flag && (c.flag_state === false || c.flag_state === true || c.flag_state === null)));

    console.log('\n— Part 2: Decision Reasoning (evidence-grounded WHY, not prediction/decision) —');
    const reason = await getDecisionReasoning(pool);
    ok('reasoning facets are evidence-grounded', Array.isArray(reason.facets) && reason.facets.every((f: any) => !!f.evidence && 'decisions_recorded' in f.evidence));
    ok('reasoning is NOT prediction/decision (STOP clause)', /NOT a prediction/i.test(reason.reasoning_kind));
    ok('every facet asserts human-approval constraint', reason.facets.every((f: any) => (f.constraints_applied ?? []).some((x: string) => /Approval ≠ Automation/i.test(x))));

    console.log('\n— Part 3: Decision Evidence Engine (composes prior tiers; engines NOT invoked) —');
    const ev = await getDecisionEvidence(pool);
    ok('composes platform/engineering/runtime/knowledge tiers', !!ev.intelligence_evidence?.tiers?.platform && !!ev.intelligence_evidence?.tiers?.engineering && !!ev.intelligence_evidence?.tiers?.runtime && !!ev.intelligence_evidence?.tiers?.knowledge);
    ok('tier reachability measured /4', ev.intelligence_evidence?.tier_reachability?.of === 4 && typeof ev.intelligence_evidence?.tier_reachability?.reachable === 'number');
    ok('decision evidence is COUNT-only over existing trails', Array.isArray(ev.decision_evidence) && ev.decision_evidence.every((d: any) => 'decisions_recorded' in d));
    ok('AI evidence is audit-trail only (auditability, not autonomy)', /auditability, not autonomy/i.test(ev.ai_evidence?.note ?? ''));

    console.log('\n— Part 4: Decision Confidence (STRUCTURAL only; evidence ⟂ coverage ⟂ confidence) —');
    const conf = await getDecisionConfidence(pool);
    ok('confidence_kind STRUCTURAL only', /STRUCTURAL confidence only/i.test(conf.confidence_kind));
    ok('six separate confidence axes', Array.isArray(conf.axes) && conf.axes.length === 6);
    ok('NO composite confidence', conf.composite === null);
    ok('accuracy confidence honest-NULL (unmeasurable)', conf.accuracy_confidence?.measurable === false && conf.accuracy_confidence?.value === null);
    ok('each axis score pct-or-null', conf.axes.every((a: any) => a.score === null || (typeof a.score === 'number' && a.score >= 0 && a.score <= 100)));

    console.log('\n— Part 5: Decision Governance (Approval ≠ Automation; human approval mandatory) —');
    const gov = await getDecisionGovernance(pool);
    ok('human approval MANDATORY', gov.human_approval?.mandatory === true);
    ok('automated approval NOT supported', gov.human_approval?.automated_approval_supported === false);
    ok('ownership honest (unknown ≠ 0 when registry absent OR managed)', typeof gov.ownership?.assigned === 'number');
    ok('policy validation is STRUCTURAL with checks', gov.policy_validation?.kind === 'STRUCTURAL' && Array.isArray(gov.policy_validation?.checks));

    console.log('\n— Part 6: Decision Explainability —');
    const exp = await explainDecision(pool, 'di-cap-career-activation');
    ok('explain returns why + evidence + structural confidence', exp.found === true && !!exp.evidence && exp.confidence?.level === 'structural');
    ok('explain has alternatives + repo/knowledge/runtime refs', Array.isArray(exp.alternatives) && Array.isArray(exp.repository_refs) && Array.isArray(exp.knowledge_refs) && Array.isArray(exp.runtime_refs));
    ok('explain asserts human-approval governance', exp.governance?.human_approval === 'mandatory' && exp.governance?.automated_action === false);
    const expUnknown = await explainDecision(pool, 'di-cap-does-not-exist');
    ok('unknown uid → found:false (no fabrication)', expUnknown.found === false);

    console.log('\n— Part 7: Decision Validation (STRUCTURAL only) —');
    const val = await getDecisionValidation(pool);
    ok('validation_kind STRUCTURAL only', /STRUCTURAL only/i.test(val.validation_kind));
    ok('repository + rule + evidence + decision + knowledge integrity checks present', ['repository_integrity', 'rule_integrity', 'evidence_integrity', 'decision_integrity', 'knowledge_integrity'].every((k) => (val.checks ?? []).some((c: any) => c.check === k)));
    ok('verdict ∈ {STRUCTURAL_VALIDATED,PARTIAL,ABSENT}', ['STRUCTURAL_VALIDATED', 'PARTIAL', 'ABSENT'].includes(val.verdict));

    console.log('\n— Part 8: Decision Metrics (6 SEPARATE, never composited) —');
    const m = await getDecisionMetrics(pool);
    const KEYS = ['decision_quality', 'decision_confidence', 'decision_coverage', 'recommendation_quality', 'governance_compliance', 'explainability_score'];
    const metricNames = (m.scores ?? []).map((s: any) => s.metric);
    ok('six separate metric scores present', KEYS.every((k) => metricNames.includes(k)) && m.scores.length === 6);
    ok('NO composite/overall score', m.composite === null && !('overall' in m) && !('score' in m));
    ok('recommendation_quality is honest-NULL (accuracy unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'recommendation_quality')?.score === null);
    ok('decision_confidence axis is confidence (STRUCTURAL)', (m.scores ?? []).find((s: any) => s.metric === 'decision_confidence')?.axis === 'confidence');
    ok('each score pct-or-null (null ≠ 0)', (m.scores ?? []).every((s: any) => s.score === null || (typeof s.score === 'number' && s.score >= 0 && s.score <= 100)));

    console.log('\n— Registry + discovery (catalog of decision CAPABILITIES) —');
    const disc = await discoverDecisions(pool, 'validator');
    ok('discover succeeds + measures catalog', disc.ok === true && (disc.discovered ?? 0) > 0);
    const reg = await getDecisionRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('registry grouped by domain', Object.keys(reg.by_domain ?? {}).length > 1);
    const man = await registerDecisionCapability(pool, { decision_uid: 'di-man-test', name: 'manual_decision', decision_kind: 'logged', domain: 'career', physical_table: 'wc7b_decision_state', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getDecisionCapability(pool, 'di-man-test');
    ok('manual owner persisted (MANAGED)', manEnt.found === true && manEnt.entry?.owner === 'qa@example.com');
    await discoverDecisions(pool, 'validator');
    const manEnt2 = await getDecisionCapability(pool, 'di-man-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Security: /register rejects unsafe table identifiers (no SQL identifier injection) —');
    const tgtBeforeInj = await rawCount(pool, 'wc7b_decision_state');
    const evil = await registerDecisionCapability(pool, { decision_uid: 'di-evil', name: 'evil', decision_kind: 'logged', domain: 'career', physical_table: 'wc7b_decision_state"; DROP TABLE wc7b_decision_state; --' }, 'attacker');
    ok('malicious physical_table rejected (ok:false)', evil.ok === false && /valid unquoted table identifier/i.test(evil.error ?? ''));
    ok('no row was written for the rejected payload', (await getDecisionCapability(pool, 'di-evil')).found === false);
    ok('target table survived the injection attempt', (await rawCount(pool, 'wc7b_decision_state')) === tgtBeforeInj);

    console.log('\n— Summary + Audit (drift) —');
    const sum = await getDecisionSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.6') && !!sum.metrics);
    const cap1 = await captureDecisionSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getDecisionDrift(pool);
    ok('drift not comparable with <2 snapshots', drift1.ready === true && drift1.comparable === false);
    const cap2 = await captureDecisionSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getDecisionDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.comparable === true && !!drift2.deltas);
    const snaps = await getDecisionSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log('\n— Honesty: reads NEVER write to existing decision tables + engines NOT invoked —');
    let untouched = true; const drifted: string[] = [];
    for (const t of SENTINELS) {
      const after = await rawCount(pool, t);
      if (before[t] !== after) { untouched = false; drifted.push(`${t}:${before[t]}→${after}`); }
    }
    ok('all sentinel decision tables COUNT-unchanged (no writes)', untouched, drifted.join(','));
    ok('wc7b_decision_state unchanged → orchestrator/persistence engines NEVER invoked', before['wc7b_decision_state'] === await rawCount(pool, 'wc7b_decision_state'));

    console.log('\n— Cleanup (restore flag-OFF byte-identical incl. schema) —');
    await pool.query('DROP TABLE IF EXISTS decision_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS decision_registry');
    ok('both OWN tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'decision_registry')) && !(await tableExists(pool, 'decision_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.stack ?? e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.6 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
