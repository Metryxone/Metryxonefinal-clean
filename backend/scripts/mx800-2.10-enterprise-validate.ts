/**
 * MX-800 Phase 2.10 — Enterprise Intelligence Platform: validation harness.
 *
 * Fail-fast unless the enterpriseIntelligencePlatform flag is ON in THIS process (the service write paths
 * assert the flag). Run with the flag enabled:
 *   FF_ENTERPRISE_INTELLIGENCE_PLATFORM=1 npx tsx scripts/mx800-2.10-enterprise-validate.ts
 *
 * Exercises all 9 parts + the write paths (discover/register/capture), the honesty contract (null ≠ 0,
 * exact COUNT(*) not n_live_tup, metrics NOT composited, intelligence_maturity STRUCTURAL, effectiveness +
 * enterprise_optimization honest-null, Correlation ≠ Causation, Insight ≠ Decision, Connected ≠
 * Orchestrated), and the structural guarantees of this phase:
 *   (a) reads NEVER write to any existing intelligence snapshot/trail table (COUNT-before == after);
 *   (b) the eight prior intelligence ENGINES are never INVOKED (only their file existence / persisted
 *       output / read-only summaries are read — proven by every tier-trail COUNT staying unchanged);
 *   (c) it never executes/decides/modifies business logic / acts autonomously (safety flags false); and
 *   (d) /register REJECTS unsafe table identifiers (no SQL identifier injection).
 * Drops the engine's two OWN tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isEnterpriseIntelligencePlatformEnabled } from '../config/feature-flags';
import {
  getEnterpriseCatalog, getEnterpriseOrchestration, getCrossIntelligenceCorrelation,
  getEnterpriseInsights, getOrganizationalIntelligence, getEnterpriseValidation,
  getEnterpriseMetrics, getExecutiveIntelligence, getEnterpriseSummary, explainEnterprise,
  getEnterpriseRegistry, getEnterpriseCapability, discoverEnterprise, registerEnterpriseCapability,
  captureEnterpriseSnapshot, getEnterpriseSnapshots, getEnterpriseDrift,
} from '../services/enterprise-intelligence-platform';

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
  if (!isEnterpriseIntelligencePlatformEnabled()) {
    console.error('FATAL: enterpriseIntelligencePlatform flag is OFF. Re-run with FF_ENTERPRISE_INTELLIGENCE_PLATFORM=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean slate so the harness is idempotent / re-runnable.
    await pool.query('DROP TABLE IF EXISTS enterprise_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS enterprise_intelligence_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent + reads never write —');
    ok('registry table absent before any write', !(await tableExists(pool, 'enterprise_intelligence_registry')));
    const regBefore = await getEnterpriseRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'enterprise_intelligence_registry')));

    // Sentinel existing intelligence tables — exact COUNT(*) BEFORE exercising all read parts. Proves (a)
    // reads never write to any intelligence trail and (b) the eight prior ENGINES are never INVOKED. These
    // tier snapshot tables may be ABSENT (each tier creates its trail only when its own flag is ON) → null.
    const SENTINELS = [
      'platform_intelligence_audit_snapshots', 'engineering_intelligence_audit_snapshots',
      'runtime_intelligence_audit_snapshots', 'knowledge_intelligence_audit_snapshots',
      'decision_intelligence_audit_snapshots', 'predictive_intelligence_audit_snapshots',
      'recommendation_intelligence_audit_snapshots', 'continuous_learning_intelligence_audit_snapshots',
      'platform_intelligence_registry',
    ];
    const before: Record<string, number | null> = {};
    for (const t of SENTINELS) before[t] = await rawCount(pool, t);

    console.log('\n— Part 1: Enterprise Registry / Catalog (EXISTING capabilities, never created) —');
    const catalog = await getEnterpriseCatalog(pool);
    ok('catalog enumerates EXISTING enterprise intelligence capabilities (19)', Array.isArray(catalog.capabilities) && catalog.capabilities.length === 19);
    ok('capabilities grouped by domain (>1)', Array.isArray(catalog.by_domain) && catalog.by_domain.length > 1);
    ok('by_kind covers 4 enterprise kinds', catalog.by_kind && Object.keys(catalog.by_kind).length === 4);
    ok('table_count is exact-or-null (null ≠ 0)', catalog.capabilities.every((c: any) => c.table_count === null || typeof c.table_count === 'number'));
    ok('present is DERIVED (table OR engine substrate)', catalog.capabilities.every((c: any) => typeof c.present === 'boolean'));
    ok('flag_state reported (Built ≠ Activated; null when unverified)', catalog.capabilities.some((c: any) => c.governing_flag && (c.flag_state === false || c.flag_state === true || c.flag_state === null)));
    ok('intelligence_records is sum-or-null (null ≠ 0)', catalog.totals.intelligence_records === null || typeof catalog.totals.intelligence_records === 'number');

    console.log('\n— Part 2: Enterprise Orchestration (metadata-level; Connected ≠ Orchestrated) —');
    const orch = await getEnterpriseOrchestration(pool);
    ok('orchestration_kind asserts Connected ≠ Orchestrated', /Connected ≠ Orchestrated/i.test(orch.orchestration_kind));
    ok('orchestration_safety: never executes engines / re-runs tiers / decides, 0 business writes', orch.orchestration_safety?.executes_engines === false && orch.orchestration_safety?.re_runs_tiers === false && orch.orchestration_safety?.decides === false && orch.orchestration_safety?.write_paths_to_business_tables === 0);
    ok('orchestration coordinates 8 named tiers', orch.tiers && Object.keys(orch.tiers).length === 8);
    ok('composes 8 prior tiers (tier_reachability.of === 8)', orch.tier_reachability?.of === 8 && typeof orch.tier_reachability?.reachable === 'number');

    console.log('\n— Part 3: Cross-Intelligence Correlation (co-presence; Correlation ≠ Causation) —');
    const corr = await getCrossIntelligenceCorrelation(pool);
    ok('correlation_kind asserts Correlation ≠ Causation', /Correlation ≠ Causation/i.test(corr.correlation_kind));
    ok('correlation_safety: never asserts/infers causation / decides', corr.correlation_safety?.asserts_causation === false && corr.correlation_safety?.infers_causal_links === false && corr.correlation_safety?.decides === false);
    ok('8 intelligence channels surfaced side-by-side', corr.channels && Object.keys(corr.channels).length === 8);
    ok('co_presence reports populated trails as exact COUNT-or-0 (NOT a correlation coefficient)', typeof corr.co_presence?.intelligence_trails_populated === 'number' && /NOT a correlation coefficient/i.test(corr.co_presence?.note ?? ''));
    ok('composes 8 prior tiers (tier_reachability.of === 8)', corr.tier_reachability?.of === 8);

    console.log('\n— Part 4: Enterprise Insights (Insight ≠ Decision) —');
    const ins = await getEnterpriseInsights(pool);
    ok('insights_kind asserts Insight ≠ Decision', /Insight ≠ Decision/i.test(ins.insights_kind));
    ok('insights_safety: never a decision / triggers action / autonomous / modifies business logic', ins.insights_safety?.is_decision === false && ins.insights_safety?.triggers_action === false && ins.insights_safety?.autonomous === false && ins.insights_safety?.modifies_business_logic === false);
    ok('every insight is_decision:false (read-only observation)', Array.isArray(ins.insights) && ins.insights.length > 0 && ins.insights.every((i: any) => i.is_decision === false));
    ok('dormant_capabilities listed as observation (Built ≠ Activated)', Array.isArray(ins.dormant_capabilities));
    ok('composes 8 prior tiers (tier_reachability.of === 8)', ins.tier_reachability?.of === 8);

    console.log('\n— Part 5: Organizational Intelligence (surface EXISTING org/governance substrate) —');
    const org = await getOrganizationalIntelligence(pool);
    ok('organizational_safety: never decides / modifies business logic / autonomous', org.organizational_safety?.decides === false && org.organizational_safety?.modifies_business_logic === false && org.organizational_safety?.autonomous === false);
    ok('organizational capabilities expose records (null ≠ 0)', Array.isArray(org.organizational_capabilities) && org.organizational_capabilities.every((o: any) => 'records' in o));
    ok('organizational capabilities present (≥3)', org.organizational_capabilities.length >= 3);
    ok('composed_channels include governance + portfolio_product (no fabricated model)', !!org.composed_channels?.governance && !!org.composed_channels?.portfolio_product);
    ok('composes 8 prior tiers (tier_reachability.of === 8)', org.tier_reachability?.of === 8);

    console.log('\n— Part 6: Enterprise Explainability —');
    const exp = await explainEnterprise(pool, 'ei-cap-platform-intelligence');
    ok('explain returns why + evidence + structural confidence', exp.found === true && !!exp.evidence && exp.confidence?.level === 'structural');
    ok('explain has previous/current state + reason_for_change (NO CHANGE — honest)', !!exp.previous_state && !!exp.current_state && /NO CHANGE/i.test(exp.reason_for_change ?? ''));
    ok('explain has alternatives + repo/knowledge/runtime refs', Array.isArray(exp.alternatives) && Array.isArray(exp.repository_refs) && Array.isArray(exp.knowledge_refs) && Array.isArray(exp.runtime_refs));
    ok('explain asserts human-approval governance (never decides/executes/autonomous)', exp.governance?.human_approval === 'mandatory' && exp.governance?.automated_action === false && exp.governance?.executes === false && exp.governance?.decides === false && exp.governance?.autonomous === false);
    ok('evidence is COUNT-only over existing trail (null ≠ 0)', 'intelligence_records' in exp.evidence);
    const expUnknown = await explainEnterprise(pool, 'ei-cap-does-not-exist');
    ok('unknown uid → found:false (no fabrication)', expUnknown.found === false);

    console.log('\n— Part 7: Enterprise Validation (STRUCTURAL only) —');
    const val = await getEnterpriseValidation(pool);
    ok('validation_kind STRUCTURAL only (NOT maturity/effectiveness/outcome)', /STRUCTURAL only/i.test(val.validation_kind));
    ok('repository + intelligence + evidence + enterprise + knowledge + recommendation + organizational + consistency + registry checks present',
      ['repository_integrity', 'intelligence_integrity', 'evidence_integrity', 'enterprise_integrity', 'knowledge_integrity', 'recommendation_integrity', 'organizational_integrity', 'enterprise_consistency', 'registry_metadata_integrity'].every((k) => (val.checks ?? []).some((c: any) => c.check === k)));
    ok('enterprise_consistency is STRUCTURAL self-consistency NOT effectiveness', (val.checks ?? []).find((c: any) => c.check === 'enterprise_consistency')?.detail?.includes('NOT effectiveness'));
    ok('verdict ∈ {STRUCTURAL_VALIDATED,PARTIAL,ABSENT}', ['STRUCTURAL_VALIDATED', 'PARTIAL', 'ABSENT'].includes(val.verdict));

    console.log('\n— Part 8: Enterprise Metrics (6 SEPARATE, never composited) —');
    const m = await getEnterpriseMetrics(pool);
    const KEYS = ['enterprise_health', 'intelligence_maturity', 'intelligence_coverage', 'explainability_score', 'intelligence_effectiveness', 'enterprise_optimization'];
    const metricNames = (m.scores ?? []).map((s: any) => s.metric);
    ok('six separate metric scores present', KEYS.every((k) => metricNames.includes(k)) && m.scores.length === 6);
    ok('NO composite/overall score', m.composite === null && !('overall' in m) && !('score' in m));
    ok('intelligence_effectiveness is honest-NULL (outcome unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'intelligence_effectiveness')?.score === null);
    ok('enterprise_optimization is honest-NULL (longitudinal improvement unmeasurable)', (m.scores ?? []).find((s: any) => s.metric === 'enterprise_optimization')?.score === null);
    ok('intelligence_maturity axis is confidence (STRUCTURAL)', (m.scores ?? []).find((s: any) => s.metric === 'intelligence_maturity')?.axis === 'confidence');
    ok('each score pct-or-null (null ≠ 0)', (m.scores ?? []).every((s: any) => s.score === null || (typeof s.score === 'number' && s.score >= 0 && s.score <= 100)));

    console.log('\n— Part 9: Executive Intelligence (MEASURED KPIs/indicators; Dashboard ≠ Intelligence) —');
    const exe = await getExecutiveIntelligence(pool);
    ok('executive_kind asserts Dashboard ≠ Intelligence', /Dashboard ≠ Intelligence/i.test(exe.executive_kind));
    ok('executive_safety: never decides / fabricates KPIs / autonomous', exe.executive_safety?.decides === false && exe.executive_safety?.fabricates_kpis === false && exe.executive_safety?.autonomous === false);
    ok('enterprise_kpis include an honest-null unmeasurable outcome KPI', Array.isArray(exe.enterprise_kpis) && exe.enterprise_kpis.some((k: any) => k.measured === false && k.value === null));
    ok('strategic_indicators assert connected_not_orchestrated', exe.strategic_indicators?.connected_not_orchestrated?.value === true);
    ok('enterprise_trends not ready without ≥2 snapshots (null ≠ 0)', exe.enterprise_trends?.ready === false);
    ok('composes 8 prior tiers (tier_reachability.of === 8)', exe.tier_reachability?.of === 8);

    console.log('\n— Registry + discovery (catalog of enterprise intelligence CAPABILITIES) —');
    const disc = await discoverEnterprise(pool, 'validator');
    ok('discover succeeds + measures catalog (19)', disc.ok === true && disc.discovered === 19 && disc.total_catalog === 19);
    const reg = await getEnterpriseRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total === 19);
    ok('registry grouped by domain', Object.keys(reg.by_domain ?? {}).length > 1);
    const man = await registerEnterpriseCapability(pool, { enterprise_uid: 'ei-man-test', name: 'manual_enterprise', enterprise_kind: 'intelligence', domain: 'platform', physical_table: 'users', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getEnterpriseCapability(pool, 'ei-man-test');
    ok('manual owner persisted (MANAGED)', manEnt.found === true && manEnt.entry?.owner === 'qa@example.com');
    await discoverEnterprise(pool, 'validator');
    const manEnt2 = await getEnterpriseCapability(pool, 'ei-man-test');
    ok('re-discover preserves managed owner (NOT clobbered)', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Security: /register rejects unsafe table identifiers (no SQL identifier injection) —');
    const tgtBeforeInj = await rawCount(pool, 'users');
    const evil = await registerEnterpriseCapability(pool, { enterprise_uid: 'ei-evil', name: 'evil', enterprise_kind: 'intelligence', domain: 'platform', physical_table: 'users"; DROP TABLE users; --' }, 'attacker');
    ok('malicious physical_table rejected (ok:false)', evil.ok === false && /valid unquoted table identifier/i.test(evil.error ?? ''));
    ok('no row was written for the rejected payload', (await getEnterpriseCapability(pool, 'ei-evil')).found === false);
    ok('target table survived the injection attempt', (await rawCount(pool, 'users')) === tgtBeforeInj);

    console.log('\n— Summary + Audit (drift) —');
    const sum = await getEnterpriseSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.10') && !!sum.metrics);
    ok('summary asserts insight-only / never executes/decides/modifies business logic/duplicates', sum.enterprise_safety?.executes === false && sum.enterprise_safety?.decides === false && sum.enterprise_safety?.modifies_business_logic === false && sum.enterprise_safety?.autonomous === false && sum.enterprise_safety?.duplicates_engines === false && sum.enterprise_safety?.insight_only === true);
    ok('summary composes 8 prior tiers', sum.composition?.of === 8);
    const cap1 = await captureEnterpriseSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getEnterpriseDrift(pool);
    ok('drift not comparable with <2 snapshots', drift1.ready === true && drift1.comparable === false);
    const cap2 = await captureEnterpriseSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getEnterpriseDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.comparable === true && !!drift2.deltas);
    const snaps = await getEnterpriseSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log('\n— Honesty: reads NEVER write to existing intelligence tables + engines NOT invoked —');
    let untouched = true; const drifted: string[] = [];
    for (const t of SENTINELS) {
      const after = await rawCount(pool, t);
      if (before[t] !== after) { untouched = false; drifted.push(`${t}:${before[t]}→${after}`); }
    }
    ok('all sentinel intelligence tables COUNT-unchanged (no writes)', untouched, drifted.join(','));
    ok('platform_intelligence_audit_snapshots unchanged → platform engine NEVER invoked', before['platform_intelligence_audit_snapshots'] === await rawCount(pool, 'platform_intelligence_audit_snapshots'));
    ok('continuous_learning_intelligence_audit_snapshots unchanged → 2.9 engine NEVER invoked', before['continuous_learning_intelligence_audit_snapshots'] === await rawCount(pool, 'continuous_learning_intelligence_audit_snapshots'));

    console.log('\n— Cleanup (restore flag-OFF byte-identical incl. schema) —');
    await pool.query('DROP TABLE IF EXISTS enterprise_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS enterprise_intelligence_registry');
    ok('both OWN tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'enterprise_intelligence_registry')) && !(await tableExists(pool, 'enterprise_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.stack ?? e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.10 validation: ${pass} passed, ${fail} failed ===`);
  // Set exitCode and let the event loop drain (a bare process.exit() can truncate buffered stdout).
  process.exitCode = fail === 0 ? 0 : 1;
}
main();
