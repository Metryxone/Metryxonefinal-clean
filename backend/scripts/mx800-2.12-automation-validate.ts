/**
 * MX-800 Phase 2.12 — Intelligence Automation & Governance Orchestration Platform: in-process validator.
 *
 * Proves the honesty + safety contract flag-ON against the live DB:
 *   1. READS-NEVER-WRITE: exercising a heavy composing getter creates NO schema (no engine — neither this
 *      tier's nor any COMPOSED substrate engine's — runs DDL on a read).
 *   2. ENGINES-NEVER-INVOKED (static import surface): the service never imports an emit/scheduler/listApprovals/
 *      notification symbol — it composes by file-existence + persisted output read-only.
 *   3. INJECTION-REJECTION: isSafeTableIdentifier + register reject a malicious physical_table.
 *   4. COMPOSITION-CORRECTNESS: substrate (10 channels) + governed tiers (9, incl. 2.11 honest non-getter)
 *      compose; metrics expose 6 SEPARATE scores with NO composite and effectiveness/optimization honest-null.
 *   5. WRITE PATHS: discover + audit/capture create EXACTLY the 2 owned tables; drift/snapshots read them.
 *
 * PHASED RUN (the substrate composition does ~30-55s of repository file-system scanning PER heavy getter —
 * governance/metrics/summary/workflow are each independently heavy and share no cross-getter cache, so all
 * getters in one process would exceed any reasonable timeout). Pass a comma-list of phases as argv[2]:
 *   cd backend && FF_INTELLIGENCE_AUTOMATION_GOVERNANCE=1 npx tsx scripts/mx800-2.12-automation-validate.ts light,gov
 *   cd backend && FF_INTELLIGENCE_AUTOMATION_GOVERNANCE=1 npx tsx scripts/mx800-2.12-automation-validate.ts metrics
 *   cd backend && FF_INTELLIGENCE_AUTOMATION_GOVERNANCE=1 npx tsx scripts/mx800-2.12-automation-validate.ts summary,write
 * Phases: light (flag/static/injection/catalog/approval/event, fast) · gov · metrics · summary · write.
 * Each invocation DROPs the 2 owned tables at start + end so it leaves no residue and has a clean baseline.
 */
process.env.FF_INTELLIGENCE_AUTOMATION_GOVERNANCE = process.env.FF_INTELLIGENCE_AUTOMATION_GOVERNANCE || '1';
// Widen the memo well past the run so a getter called twice in the SAME process (e.g. summary, then capture
// which composes summary) reuses the first compute. Purely a test-speed concern; does not affect any
// asserted property (the first call still genuinely executes its read logic).
process.env.IAG_MEMO_TTL_MS = process.env.IAG_MEMO_TTL_MS || '300000';

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAutomationGovernanceCatalog, getGovernanceOrchestration, getEventOrchestration, getApprovalWorkflows,
  getAutomationGovernanceMetrics, getAutomationGovernanceSummary,
  getAutomationGovernanceRegistry, discoverAutomationGovernance, registerAutomationGovernanceCapability,
  captureAutomationGovernanceSnapshot, getAutomationGovernanceSnapshots, getAutomationGovernanceDrift,
  isSafeTableIdentifier,
} from '../services/intelligence-automation-governance';
import { isIntelligenceAutomationGovernanceEnabled } from '../config/feature-flags';

const CATALOG_SIZE = 18; // curated AUTOMATION_SOURCES count (file/table-verified)
const PHASES = (process.argv[2] || 'all').split(',').map((s) => s.trim());
const has = (p: string) => PHASES.includes('all') || PHASES.includes(p);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

async function tableSet(): Promise<Set<string>> {
  const r = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  return new Set(r.rows.map((x) => x.tablename));
}
const dropOwned = () => pool.query(`DROP TABLE IF EXISTS automation_governance_audit_snapshots, automation_governance_registry CASCADE`);

async function main() {
  console.log(`\n=== MX-800 2.12 Automation & Governance Validator — phases: ${PHASES.join(',')} ===`);
  ok(isIntelligenceAutomationGovernanceEnabled(), 'flag intelligenceAutomationGovernance is ON for this run');
  // Each capture composes the summary fresh (~55s, no memo reuse), so the 2 captures drift needs are split
  // across two invocations: `write` leaves the tables in place (no end-drop), `drift` reuses them (no
  // start-drop) and cleans up at the end.
  const skipStartDrop = has('drift') && !has('write');
  const skipEndDrop = has('write') && !has('drift');
  if (!skipStartDrop) await dropOwned();
  const baseline = await tableSet();

  // ── LIGHT: flag / static import surface / injection guard / cheap getters ──
  if (has('light')) {
    console.log('\n[light] STATIC IMPORT SURFACE (engines-never-invoked) + INJECTION + cheap-getter reads');
    const src = fs.readFileSync(path.join(process.cwd(), 'services/intelligence-automation-governance.ts'), 'utf8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
    ok(/import\s*\{\s*ADAPTIVE_EVENTS\s*\}\s*from\s*'\.\/adaptive-event-bus'/.test(importLines), 'event bus import is ADAPTIVE_EVENTS const ONLY (no on/emit/initEventBus imported)');
    ok(!/from\s*'\.\/ai-governance-scheduler'/.test(importLines), 'AI-governance scheduler module is NEVER imported (cannot be started)');
    ok(!/\blistApprovals\b/.test(importLines), 'listApprovals is NEVER imported (would run ensureGovernanceSchema DDL)');
    ok(!/\bemit\b/.test(importLines) && !/\.on\s*\(/.test(src), 'no emit imported + no .on subscribe call anywhere');
    ok(!/from\s*'\.\/notification-engine'/.test(importLines), 'notification engine is NEVER imported (compose by existence only)');

    ok(isSafeTableIdentifier('automation_governance_registry') === true, 'isSafeTableIdentifier accepts a valid table name');
    ok(isSafeTableIdentifier('users; DROP TABLE users; --') === false, 'isSafeTableIdentifier rejects a SQL-injection identifier');
    ok(isSafeTableIdentifier('"quoted"') === false, 'isSafeTableIdentifier rejects a quoted identifier');
    ok(isSafeTableIdentifier('a'.repeat(64)) === false, 'isSafeTableIdentifier rejects a >63-char identifier');
    const bad = await registerAutomationGovernanceCapability(pool, { name: 'x', physical_table: 'users; DROP TABLE users; --' }, 'validator');
    ok(bad.ok === false, `register rejects malicious physical_table (${bad.error ?? 'no error?!'})`);

    const before = await tableSet();
    const catalog: any = await getAutomationGovernanceCatalog(pool);
    const approval: any = await getApprovalWorkflows(pool);
    const evt: any = await getEventOrchestration(pool);
    const afterReads = await tableSet();
    ok([...afterReads].filter((t) => !before.has(t)).length === 0, 'cheap read getters create NO tables');
    ok(catalog.totals?.capabilities === CATALOG_SIZE, `catalog has ${CATALOG_SIZE} curated capabilities (got ${catalog.totals?.capabilities})`);
    ok(approval.approval_safety?.runs_ddl === false && approval.approval_safety?.executes === false, 'approval workflows: runs_ddl=false, executes=false');
    ok(evt.event_safety?.emits_events === false && evt.event_safety?.starts_scheduler === false, 'event orchestration: emits_events=false, starts_scheduler=false');
  }

  // ── GOV: substrate + governed tiers + reads-never-write around a HEAVY getter ──
  if (has('gov')) {
    console.log('\n[gov] COMPOSITION + READS-NEVER-WRITE (heavy substrate-composing getter)');
    const before = await tableSet();
    const gov: any = await getGovernanceOrchestration(pool);
    const after = await tableSet();
    ok([...after].filter((t) => !before.has(t)).length === 0, 'heavy substrate-composing getter creates NO tables (reads-never-write)');
    ok(gov.substrate_reachability?.of === 10, `automation substrate composes 10 channels (of=${gov.substrate_reachability?.of})`);
    ok(gov.governed_intelligence_tiers?.of === 9, `governed intelligence tiers compose 9 (of=${gov.governed_intelligence_tiers?.of})`);
    ok(Array.isArray(gov.governed_intelligence_tiers?.non_getter_tiers) && gov.governed_intelligence_tiers.non_getter_tiers.length === 1, '2.11 honestly reported as a non-getter tier');
  }

  // ── METRICS: 6 separate scores, no composite, eff/opt honest-null ──
  if (has('metrics')) {
    console.log('\n[metrics] 6 SEPARATE measured scores, NO composite');
    const metrics: any = await getAutomationGovernanceMetrics(pool);
    ok(metrics.composite === null, 'metrics expose NO composite/overall score');
    ok(Array.isArray(metrics.scores) && metrics.scores.length === 6, `metrics expose 6 SEPARATE scores (got ${metrics.scores?.length})`);
    const eff = metrics.scores.find((s: any) => s.metric === 'automation_effectiveness');
    const opt = metrics.scores.find((s: any) => s.metric === 'governance_optimization');
    ok(eff?.score === null && eff?.basis?.measurable === false, 'automation_effectiveness honest-null (DEFERRED — no runtime evidence)');
    ok(opt?.score === null && opt?.basis?.measurable === false, 'governance_optimization honest-null (DEFERRED — no runtime evidence)');
  }

  // ── SUMMARY: top-level safety flags ──
  if (has('summary')) {
    console.log('\n[summary] automation_safety flags');
    const summary: any = await getAutomationGovernanceSummary(pool);
    ok(summary.automation_safety?.decides === false && summary.automation_safety?.executes === false && summary.automation_safety?.autonomous === false,
      'summary automation_safety: decides/executes/autonomous all false (Automation≠Autonomy, Orchestration≠Decision)');
  }

  // ── WRITE: discover + first capture create EXACTLY the 2 owned tables (no end-drop; `drift` continues) ──
  if (has('write')) {
    console.log('\n[write] WRITE PATHS create exactly the 2 owned tables');
    const disc = await discoverAutomationGovernance(pool, 'validator');
    ok(disc.ok && (disc.discovered ?? 0) === CATALOG_SIZE, `discover upserted ${CATALOG_SIZE} capabilities (got ${disc.discovered})`);
    const reg = await getAutomationGovernanceRegistry(pool);
    ok(reg.ready && reg.total === CATALOG_SIZE, `registry now holds ${CATALOG_SIZE} entries (got ${reg.total})`);
    const cap = await captureAutomationGovernanceSnapshot(pool, 'validator');
    ok(!!cap.snapshot_uid, 'audit snapshot captured');
    const snaps = await getAutomationGovernanceSnapshots(pool, { limit: 5 });
    ok(snaps.ready && snaps.total >= 1, `snapshots readable (total=${snaps.total})`);
    const after = await tableSet();
    const newTables = [...after].filter((t) => !baseline.has(t)).sort();
    ok(JSON.stringify(newTables) === JSON.stringify(['automation_governance_audit_snapshots', 'automation_governance_registry']),
      `write paths created EXACTLY the 2 owned tables vs baseline (got ${JSON.stringify(newTables)})`);
  }

  // ── DRIFT: second capture (reuses `write`'s tables) + drift comparability ──
  if (has('drift')) {
    console.log('\n[drift] second snapshot + drift comparability');
    await captureAutomationGovernanceSnapshot(pool, 'validator');
    const drift: any = await getAutomationGovernanceDrift(pool);
    ok(drift.comparable === true, 'drift comparable after 2 snapshots');
    const snaps = await getAutomationGovernanceSnapshots(pool, { limit: 5 });
    ok(snaps.ready && snaps.total >= 2, `>=2 snapshots readable (total=${snaps.total})`);
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
