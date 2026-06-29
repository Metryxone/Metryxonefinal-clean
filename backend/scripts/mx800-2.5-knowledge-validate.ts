/**
 * MX-800 Phase 2.5 — Knowledge Intelligence Engine: validation harness.
 *
 * Fail-fast unless the knowledgeIntelligenceEngine flag is ON in THIS process (the service write
 * paths assert the flag). Run with the flag enabled:
 *   FF_KNOWLEDGE_INTELLIGENCE_ENGINE=1 npx tsx scripts/mx800-2.5-knowledge-validate.ts
 *
 * Exercises all 9 read parts + the write paths (discover/register/capture), the honesty contract
 * (null ≠ 0, exact COUNT(*) not n_live_tup, metrics NOT composited, knowledge_confidence STRUCTURAL,
 * contextual-meaning honest-null), and the two structural guarantees of this phase:
 *   (a) the Enterprise Knowledge Graph is COMPUTED ON READ, never materialized (no duplicate KG); and
 *   (b) reads NEVER write to any existing knowledge table (COUNT-before == COUNT-after on a sentinel).
 * Drops the engine's two OWN tables at the end to restore "flag OFF byte-identical incl. schema".
 */
import { Pool } from 'pg';
import { isKnowledgeIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getKnowledgeGraph, getSemanticIntelligence, getOntologyIntelligence, getKnowledgeReasoning,
  getKnowledgeContext, getKnowledgeValidation, getKnowledgeMetrics, getKnowledgeSummary,
  explainKnowledgeSource, getKnowledgeRegistry, getKnowledgeSource, discoverKnowledge,
  registerKnowledgeSource, captureKnowledgeSnapshot, getKnowledgeSnapshots, getKnowledgeDrift,
} from '../services/knowledge-intelligence';

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
  if (!isKnowledgeIntelligenceEngineEnabled()) {
    console.error('FATAL: knowledgeIntelligenceEngine flag is OFF. Re-run with FF_KNOWLEDGE_INTELLIGENCE_ENGINE=1.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Clean slate so the harness is idempotent / re-runnable.
    await pool.query('DROP TABLE IF EXISTS knowledge_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS knowledge_source_registry');

    console.log('\n— Pre-flight: flag OFF leaves schema absent + reads never write —');
    ok('registry table absent before any write', !(await tableExists(pool, 'knowledge_source_registry')));
    const regBefore = await getKnowledgeRegistry(pool);
    ok('registry read degrades to ready:false (GET never writes)', regBefore.ready === false);
    ok('GET read did NOT create the table', !(await tableExists(pool, 'knowledge_source_registry')));

    // Sentinel existing knowledge tables — record exact COUNT(*) BEFORE exercising all read parts.
    const SENTINELS = ['ont_competencies', 'onto_competencies', 'map_role_competency', 'kg_edges', 'sci_competency_relationships'];
    const before: Record<string, number | null> = {};
    for (const t of SENTINELS) before[t] = await rawCount(pool, t);

    console.log('\n— Part 1: Enterprise Knowledge Graph (computed-on-read, NOT materialized) —');
    const graph = await getKnowledgeGraph(pool);
    ok('graph projection computed_on_read', graph.computed_on_read === true);
    ok('graph NOT materialized (no duplicate KG/ontology)', graph.materialized === false);
    ok('nodes/edges MEASURED (number or honest-null)', (graph.totals.nodes === null || typeof graph.totals.nodes === 'number') && (graph.totals.edges === null || typeof graph.totals.edges === 'number'));
    ok('per-domain breakdown present', Array.isArray(graph.by_domain) && graph.by_domain.length > 0);
    ok('source catalog enumerated (present vs count)', Array.isArray(graph.sources) && graph.sources.length >= 40);

    console.log('\n— Part 2: Semantic Intelligence —');
    const sem = await getSemanticIntelligence(pool);
    ok('semantic relationship stores enumerated', Array.isArray(sem.relationship_stores) && sem.relationship_stores.length > 0);
    ok('contextual-meaning honest-NULL (NLP DEFERRED)', sem.contextual_meaning?.measurable === false && sem.contextual_meaning?.value === null);
    ok('distributions are measured-or-null (never fabricated)', 'onto_relationship_type' in (sem.distributions ?? {}));

    console.log('\n— Part 3: Ontology Intelligence (cross-ontology, never replace) —');
    const ont = await getOntologyIntelligence(pool);
    ok('cross-ontology bridge mapping measured', !!ont.cross_ontology_mapping);
    ok('bridge coverage pct is ratio-or-null (null ≠ 0)', ont.cross_ontology_mapping.role_bridge_coverage_pct === null || typeof ont.cross_ontology_mapping.role_bridge_coverage_pct === 'number');
    ok('structural validation verdict STRUCTURAL', ont.structural_validation?.verdict === 'STRUCTURAL');
    ok('referential orphan scan honest-NULL (DEFERRED)', ont.structural_validation?.referential_orphan_scan?.measurable === false);
    ok('evolution reads version stores', Array.isArray(ont.evolution?.version_stores));

    console.log('\n— Part 4: Knowledge Reasoning (evidence-grounded WHY, not prediction) —');
    const reason = await getKnowledgeReasoning(pool);
    ok('reasoning facets are evidence-grounded', Array.isArray(reason.facets) && reason.facets.every((f: any) => !!f.evidence?.table));
    ok('reasoning is NOT prediction/decision (STOP clause)', /NOT prediction/i.test(reason.reasoning_kind));

    console.log('\n— Part 5: Context Intelligence (composes prior tiers) —');
    const ctx = await getKnowledgeContext(pool);
    ok('composes platform/engineering/runtime tiers', !!ctx.tiers?.platform && !!ctx.tiers?.engineering && !!ctx.tiers?.runtime);
    ok('tier reachability measured /3', ctx.tier_reachability?.of === 3 && typeof ctx.tier_reachability?.reachable === 'number');

    console.log('\n— Part 6: Knowledge Validation (STRUCTURAL only) —');
    const val = await getKnowledgeValidation(pool);
    ok('validation_kind STRUCTURAL only', /STRUCTURAL only/i.test(val.validation_kind));
    ok('repository_integrity check present', (val.checks ?? []).some((c: any) => c.check === 'repository_integrity'));
    ok('verdict ∈ {STRUCTURAL_VALIDATED,PARTIAL,ABSENT}', ['STRUCTURAL_VALIDATED', 'PARTIAL', 'ABSENT'].includes(val.verdict));

    console.log('\n— Part 7: Knowledge Metrics (6 SEPARATE, never composited) —');
    const m = await getKnowledgeMetrics(pool);
    const KEYS = ['knowledge_completeness', 'relationship_coverage', 'ontology_health', 'semantic_consistency', 'knowledge_confidence', 'context_quality'];
    const metricNames = (m.scores ?? []).map((s: any) => s.metric);
    ok('six separate metric scores present', KEYS.every((k) => metricNames.includes(k)) && m.scores.length === 6);
    ok('NO composite/overall score', m.composite === null && !('overall' in m) && !('score' in m));
    ok('knowledge_confidence is STRUCTURAL axis', (m.scores ?? []).find((s: any) => s.metric === 'knowledge_confidence')?.axis === 'confidence');
    ok('each score is pct-or-null (null ≠ 0)', (m.scores ?? []).every((s: any) => s.score === null || (typeof s.score === 'number' && s.score >= 0 && s.score <= 100)));

    console.log('\n— Part 8: Knowledge Explainability —');
    const exp = await explainKnowledgeSource(pool, 'ki-src-map_role_competency');
    ok('explain returns evidence + structural confidence', exp.found === true && !!exp.evidence && exp.confidence?.level === 'structural');
    ok('explain has alternatives + repo refs', Array.isArray(exp.alternatives) && Array.isArray(exp.repository_refs));
    const expUnknown = await explainKnowledgeSource(pool, 'ki-src-does-not-exist');
    ok('unknown uid → found:false (no fabrication)', expUnknown.found === false);

    console.log('\n— Registry + discovery (catalog of knowledge SOURCES) —');
    const disc = await discoverKnowledge(pool, 'validator');
    ok('discover succeeds + measures catalog', disc.ok === true && (disc.discovered ?? 0) > 0);
    const reg = await getKnowledgeRegistry(pool);
    ok('registry ready after discover', reg.ready === true && reg.total > 0);
    ok('registry grouped by domain', Object.keys(reg.by_domain ?? {}).length > 1);
    const man = await registerKnowledgeSource(pool, { knowledge_uid: 'ki-man-test', name: 'manual_src', physical_table: 'ont_competencies', source_type: 'entity', domain: 'taxonomy', graph_role: 'node', owner: 'qa@example.com' }, 'validator');
    ok('manual register succeeds', man.ok === true);
    const manEnt = await getKnowledgeSource(pool, 'ki-man-test');
    ok('manual owner persisted (MANAGED)', manEnt.found === true && manEnt.entry?.owner === 'qa@example.com');
    await discoverKnowledge(pool, 'validator');
    const manEnt2 = await getKnowledgeSource(pool, 'ki-man-test');
    ok('re-discover preserves managed owner', manEnt2.entry?.owner === 'qa@example.com');

    console.log('\n— Security: /register rejects unsafe table identifiers (no SQL identifier injection) —');
    const ontBeforeInj = await rawCount(pool, 'ont_competencies');
    const evil = await registerKnowledgeSource(pool, { knowledge_uid: 'ki-evil', name: 'evil', physical_table: 'ont_competencies"; DROP TABLE ont_competencies; --', source_type: 'entity', domain: 'taxonomy', graph_role: 'node' }, 'attacker');
    ok('malicious physical_table rejected (ok:false)', evil.ok === false && /valid unquoted table identifier/i.test(evil.error ?? ''));
    ok('no row was written for the rejected payload', (await getKnowledgeSource(pool, 'ki-evil')).found === false);
    ok('target table survived the injection attempt', (await rawCount(pool, 'ont_competencies')) === ontBeforeInj);

    console.log('\n— Summary + Audit (drift) —');
    const sum = await getKnowledgeSummary(pool);
    ok('summary composes all parts', sum.phase?.includes('2.5') && !!sum.metrics);
    const cap1 = await captureKnowledgeSnapshot(pool, 'validator');
    ok('audit capture #1 succeeds', cap1.ok === true);
    const drift1 = await getKnowledgeDrift(pool);
    ok('drift not comparable with <2 snapshots', drift1.ready === true && drift1.comparable === false);
    const cap2 = await captureKnowledgeSnapshot(pool, 'validator');
    ok('audit capture #2 succeeds', cap2.ok === true);
    const drift2 = await getKnowledgeDrift(pool);
    ok('drift computed with ≥2 snapshots', drift2.ready === true && drift2.comparable === true && !!drift2.deltas);
    const snaps = await getKnowledgeSnapshots(pool, { limit: 5 });
    ok('snapshots listed', snaps.ready === true && snaps.snapshots.length >= 2);

    console.log('\n— Honesty: reads NEVER write to existing knowledge tables —');
    let untouched = true; const drifted: string[] = [];
    for (const t of SENTINELS) {
      const after = await rawCount(pool, t);
      if (before[t] !== after) { untouched = false; drifted.push(`${t}:${before[t]}→${after}`); }
    }
    ok('all sentinel knowledge tables COUNT-unchanged (no writes/duplication)', untouched, drifted.join(','));

    console.log('\n— Cleanup (restore flag-OFF byte-identical incl. schema) —');
    await pool.query('DROP TABLE IF EXISTS knowledge_intelligence_audit_snapshots');
    await pool.query('DROP TABLE IF EXISTS knowledge_source_registry');
    ok('both OWN tables dropped (0 tables, byte-identical OFF)', !(await tableExists(pool, 'knowledge_source_registry')) && !(await tableExists(pool, 'knowledge_intelligence_audit_snapshots')));
  } catch (e: any) {
    fail++; console.error('UNCAUGHT', e?.stack ?? e?.message ?? e);
  } finally {
    await pool.end();
  }

  console.log(`\n=== MX-800 2.5 validation: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
