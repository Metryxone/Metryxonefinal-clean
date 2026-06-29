/**
 * MX-800 Phase 2.13 — Enterprise Intelligence Integration Platform: in-process validator.
 *
 * Proves the honesty + safety contract flag-ON against the live DB:
 *   1. READS-NEVER-WRITE: exercising a heavy composing getter creates NO schema (neither this tier's nor any
 *      COMPOSED substrate engine's read-only summary getter runs DDL on a read).
 *   2. ENGINE-NEVER-INVOKED (static import surface): the service composes read-only SUMMARY getters only — it
 *      never imports an emit/scheduler/execute symbol and never subscribes to the event bus.
 *   3. INJECTION-REJECTION: isSafeTableIdentifier + register reject a malicious physical_table.
 *   4. COMPOSITION-CORRECTNESS: 14 curated services; 9 governed intelligence channels; 11 read-only summary
 *      getters composed; metrics expose 6 SEPARATE scores with NO composite and enterprise_readiness honest-null.
 *   5. WRITE PATHS: discover + audit/capture create EXACTLY the 2 owned tables; drift/snapshots read them.
 *
 * PHASED RUN (composeServices invokes 11 read-only summary getters, several of which do repository file-system
 * scanning — heavy). composeServices is memoized per-process so all heavy getters in ONE invocation reuse a
 * single composition pass, but a fresh process pays the cost once. Pass a comma-list of phases as argv[2]:
 *   cd backend && FF_ENTERPRISE_INTELLIGENCE_INTEGRATION=1 npx tsx scripts/mx800-2.13-integration-validate.ts light
 *   cd backend && FF_ENTERPRISE_INTELLIGENCE_INTEGRATION=1 npx tsx scripts/mx800-2.13-integration-validate.ts compose
 *   cd backend && FF_ENTERPRISE_INTELLIGENCE_INTEGRATION=1 npx tsx scripts/mx800-2.13-integration-validate.ts metrics
 *   cd backend && FF_ENTERPRISE_INTELLIGENCE_INTEGRATION=1 npx tsx scripts/mx800-2.13-integration-validate.ts summary,write
 *   cd backend && FF_ENTERPRISE_INTELLIGENCE_INTEGRATION=1 npx tsx scripts/mx800-2.13-integration-validate.ts drift
 * Phases: light (flag/static/injection/catalog/interop, fast) · compose · metrics · summary · write · drift.
 * Each invocation DROPs the 2 owned tables at start + end so it leaves no residue and has a clean baseline.
 */
process.env.FF_ENTERPRISE_INTELLIGENCE_INTEGRATION = process.env.FF_ENTERPRISE_INTELLIGENCE_INTEGRATION || '1';
// Widen the memo well past the run so a getter called twice in the SAME process (e.g. summary, then capture
// which composes summary) reuses the first compute. Purely a test-speed concern; does not affect any asserted
// property (the first call still genuinely executes its read logic).
process.env.EII_MEMO_TTL_MS = process.env.EII_MEMO_TTL_MS || '300000';

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  getIntegrationCatalog, getCrossIntelligenceIntegration, getEnterpriseServiceComposition,
  getPlatformInteroperability, getEnterpriseCoordination, getIntegrationValidation,
  getEnterpriseMetrics, getIntegrationSummary,
  getRegistry, discoverIntegration, registerIntegrationService,
  captureIntegrationSnapshot, getIntegrationSnapshots, getIntegrationDrift,
  isSafeTableIdentifier,
} from '../services/enterprise-intelligence-integration';
import { isEnterpriseIntelligenceIntegrationEnabled } from '../config/feature-flags';

const CATALOG_SIZE = 14;   // curated INTEGRATION_SERVICES count (file/table-verified)
const INTEL_CHANNELS = 9;  // governed intelligence channels (MX-800 2.1 / 2.3–2.10)
const SUMMARY_GETTERS = 11; // read-only summary getters composed (9 intel + 2.12-catalog + 1.41-summary)
const PHASES = (process.argv[2] || 'all').split(',').map((s) => s.trim());
const has = (p: string) => PHASES.includes('all') || PHASES.includes(p);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

async function tableSet(): Promise<Set<string>> {
  const r = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  return new Set(r.rows.map((x) => x.tablename));
}
const dropOwned = () => pool.query(`DROP TABLE IF EXISTS enterprise_integration_audit_snapshots, enterprise_integration_registry CASCADE`);

async function main() {
  console.log(`\n=== MX-800 2.13 Enterprise Intelligence Integration Validator — phases: ${PHASES.join(',')} ===`);
  ok(isEnterpriseIntelligenceIntegrationEnabled(), 'flag enterpriseIntelligenceIntegration is ON for this run');
  // `write` captures one snapshot (no end-drop), `drift` captures a second (no start-drop) then cleans up.
  const skipStartDrop = has('drift') && !has('write');
  const skipEndDrop = has('write') && !has('drift');
  if (!skipStartDrop) await dropOwned();
  const baseline = await tableSet();

  // ── LIGHT: flag / static import surface / injection guard / cheap getters (measureServices only) ──
  if (has('light')) {
    console.log('\n[light] STATIC IMPORT SURFACE (engine-never-invoked) + INJECTION + cheap-getter reads');
    const src = fs.readFileSync(path.join(process.cwd(), 'services/enterprise-intelligence-integration.ts'), 'utf8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
    ok(/getSummary as getPlatformSummary/.test(importLines), 'composes read-only SUMMARY getters (e.g. platform-intelligence getSummary)');
    ok(/buildWorkflowOverview/.test(importLines), 'composes the workflow-engine read-only buildWorkflowOverview (auxiliary)');
    ok(!/\.on\s*\(/.test(src), 'never subscribes to the event bus (.on) anywhere');
    ok(!/\bemit\b/.test(importLines), 'no emit symbol imported (composes by read-only summary, never fires an event)');
    ok(!/from\s*'\.\/ai-governance-scheduler'/.test(importLines), 'AI-governance scheduler module is NEVER imported (cannot be started)');

    ok(isSafeTableIdentifier('enterprise_integration_registry') === true, 'isSafeTableIdentifier accepts a valid table name');
    ok(isSafeTableIdentifier('users; DROP TABLE users; --') === false, 'isSafeTableIdentifier rejects a SQL-injection identifier');
    ok(isSafeTableIdentifier('"quoted"') === false, 'isSafeTableIdentifier rejects a quoted identifier');
    ok(isSafeTableIdentifier('a'.repeat(64)) === false, 'isSafeTableIdentifier rejects a >63-char identifier');
    const bad = await registerIntegrationService(pool, { name: 'x', service_kind: 'platform', integration_uid: 'eii-bad', physical_table: 'users; DROP TABLE users; --' }, 'validator');
    ok(bad.ok === false, `register rejects malicious physical_table (${bad.error ?? 'no error?!'})`);

    const before = await tableSet();
    const catalog: any = await getIntegrationCatalog(pool);
    const interop: any = await getPlatformInteroperability(pool);
    const afterReads = await tableSet();
    ok([...afterReads].filter((t) => !before.has(t)).length === 0, 'cheap read getters create NO tables');
    ok(catalog.totals?.services === CATALOG_SIZE, `catalog has ${CATALOG_SIZE} curated services (got ${catalog.totals?.services})`);
    ok(Array.isArray(interop.contracts) && interop.contracts.length === 4 && interop.contracts.every((c: any) => c.measured === true),
      `interoperability exposes 4 MEASURED descriptive contracts (got ${interop.contracts?.length})`);
    ok(interop.interoperability_safety?.enforces === false, 'interoperability contracts are DESCRIPTIVE not enforced (Standardized ≠ Enforced)');
  }

  // ── COMPOSE: substrate composition + reads-never-write around the HEAVY composing pass ──
  if (has('compose')) {
    console.log('\n[compose] COMPOSITION + READS-NEVER-WRITE (heavy summary-composing getters)');
    const before = await tableSet();
    const cross: any = await getCrossIntelligenceIntegration(pool);
    const comp: any = await getEnterpriseServiceComposition(pool);
    const coord: any = await getEnterpriseCoordination(pool);
    const val: any = await getIntegrationValidation(pool);
    const after = await tableSet();
    ok([...after].filter((t) => !before.has(t)).length === 0, 'heavy summary-composing getters create NO tables (reads-never-write)');
    ok(cross.reachability?.of === INTEL_CHANNELS, `cross-intelligence composes ${INTEL_CHANNELS} governed intelligence channels (of=${cross.reachability?.of})`);
    ok(cross.integration_safety?.invokes_engine === false && cross.integration_safety?.decides === false, 'cross-intelligence: invokes_engine=false, decides=false (Insight ≠ Decision)');
    ok(comp.totals?.getter_backed === SUMMARY_GETTERS, `service composition reports ${SUMMARY_GETTERS} read-only summary getters (got ${comp.totals?.getter_backed})`);
    ok(comp.composition_safety?.reimplements === false && comp.composition_safety?.duplicates === false, 'composition: reimplements=false, duplicates=false (Composition ≠ Duplication)');
    ok(Array.isArray(coord.coordination_routes) && coord.coordination_routes.length === CATALOG_SIZE, `coordination routes one per service (got ${coord.coordination_routes?.length})`);
    ok(coord.coordination_safety?.executes === false && coord.coordination_safety?.decides === false, 'coordination: executes=false, decides=false (Connected ≠ Orchestrated)');
    ok(['STRUCTURAL_VALIDATED', 'PARTIAL'].includes(val.verdict), `validation verdict is STRUCTURAL-only (${val.verdict})`);
  }

  // ── METRICS: 6 separate scores, no composite, enterprise_readiness honest-null ──
  if (has('metrics')) {
    console.log('\n[metrics] 6 SEPARATE measured scores, NO composite');
    const metrics: any = await getEnterpriseMetrics(pool);
    ok(metrics.composite === null, 'metrics expose NO composite/overall score');
    ok(Array.isArray(metrics.scores) && metrics.scores.length === 6, `metrics expose 6 SEPARATE scores (got ${metrics.scores?.length})`);
    const readiness = metrics.scores.find((s: any) => s.metric === 'enterprise_readiness');
    ok(readiness?.score === null && readiness?.basis?.measurable === false, 'enterprise_readiness honest-null (DEFERRED — no runtime + outcome evidence)');
    const axes = new Set(metrics.scores.map((s: any) => s.axis));
    ok(axes.has('structural') && axes.has('confidence') && axes.has('coverage') && axes.has('outcome'), 'scores span Structural ⟂ Confidence ⟂ Coverage ⟂ Outcome axes (never blended)');
  }

  // ── SUMMARY: top-level composition is gather-once + reuses the parts ──
  if (has('summary')) {
    console.log('\n[summary] top-level composition');
    const summary: any = await getIntegrationSummary(pool);
    ok(summary.totals?.services === CATALOG_SIZE, `summary totals.services === ${CATALOG_SIZE} (got ${summary.totals?.services})`);
    ok(summary.cross_intelligence?.of === INTEL_CHANNELS, `summary cross_intelligence.of === ${INTEL_CHANNELS} (got ${summary.cross_intelligence?.of})`);
    ok(typeof summary.validation?.verdict === 'string', 'summary surfaces the STRUCTURAL validation verdict');
  }

  // ── WRITE: discover + first capture create EXACTLY the 2 owned tables (no end-drop; `drift` continues) ──
  if (has('write')) {
    console.log('\n[write] WRITE PATHS create exactly the 2 owned tables');
    const disc = await discoverIntegration(pool, 'validator');
    ok(disc.ok && (disc.discovered ?? 0) === CATALOG_SIZE, `discover upserted ${CATALOG_SIZE} services (got ${disc.discovered})`);
    const reg = await getRegistry(pool);
    ok(reg.present && reg.count === CATALOG_SIZE, `registry now holds ${CATALOG_SIZE} entries (got ${reg.count})`);
    const cap = await captureIntegrationSnapshot(pool, 'validator');
    ok(!!cap.snapshot?.snapshot_uid, 'audit snapshot captured');
    const snaps = await getIntegrationSnapshots(pool, { limit: 5 });
    ok(snaps.present && (snaps.count ?? 0) >= 1, `snapshots readable (count=${snaps.count})`);
    const after = await tableSet();
    const newTables = [...after].filter((t) => !baseline.has(t)).sort();
    ok(JSON.stringify(newTables) === JSON.stringify(['enterprise_integration_audit_snapshots', 'enterprise_integration_registry']),
      `write paths created EXACTLY the 2 owned tables vs baseline (got ${JSON.stringify(newTables)})`);
  }

  // ── DRIFT: second capture (reuses `write`'s tables) + drift comparability ──
  if (has('drift')) {
    console.log('\n[drift] second snapshot + drift comparability');
    await captureIntegrationSnapshot(pool, 'validator');
    const drift: any = await getIntegrationDrift(pool);
    ok(drift.present && drift.ready === true, 'drift ready after 2 snapshots');
    const snaps = await getIntegrationSnapshots(pool, { limit: 5 });
    ok(snaps.present && (snaps.count ?? 0) >= 2, `>=2 snapshots readable (count=${snaps.count})`);
  }

  if (!skipEndDrop) {
    await dropOwned();
    console.log('\n  (cleanup) dropped the 2 owned tables — validator leaves no residue');
  } else {
    console.log('\n  (no end-drop) tables left in place for the `drift` continuation run');
  }
  console.log(`\n=== RESULT [${PHASES.join(',')}]: ${pass} passed, ${fail} failed ===`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('VALIDATOR ERROR', e); process.exit(1); });
