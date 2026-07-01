/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Observability, Monitoring & Operational Readiness.
 *
 * SSoT SCAN. Read-only: composes the operational-readiness engine against the LIVE FS+DB and writes
 * ONE measurement artifact `backend/audit/program-2-operational-readiness/scan.json`. The deliverable
 * generator reads ONLY this file, so the 16 deliverables can NEVER drift from the measurement.
 *
 * Run from backend/ with the flag ON:
 *   FF_OPERATIONAL_READINESS=1 DATABASE_URL=... npx tsx scripts/program2-2.5-operational-readiness-scan.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import pg from 'pg';
import {
  composeCoverage, composeCertification, composeAdoption, composeGaps, composeValidation, composeSummary,
} from '../services/operational-readiness-engine';
import {
  OPERATIONAL_AXES, OPERATIONAL_DOMAINS, OPERATIONAL_DECISIONS, OPERATIONAL_MODEL_META,
} from '../config/operational-readiness-model';

async function main() {
  if (process.env.FF_OPERATIONAL_READINESS !== '1') {
    console.warn('[scan] FF_OPERATIONAL_READINESS is not 1 — the composer is flag-gated; the snapshot capture path would refuse. Coverage/certification composers are read-only and run regardless, but set the flag for a faithful scan.');
  }
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error('DATABASE_URL required for the scan (evidence is verified vs the live DB).');
  const pool = new pg.Pool({ connectionString: conn, max: 4 });

  const [coverage, certification, adoption, gaps, validation, summary] = await Promise.all([
    composeCoverage(pool), composeCertification(pool), composeAdoption(pool),
    Promise.resolve(composeGaps()), composeValidation(pool), composeSummary(pool),
  ]);

  // Evidence rollup across ALL domains (Coverage axis only).
  const roll = { services: { present: 0, total: 0 }, routes: { present: 0, total: 0 }, frontend: { present: 0, total: 0 }, tables: { present: 0, total: 0, absent: 0 } };
  for (const c of coverage) {
    roll.services.present += c.evidence.services.present; roll.services.total += c.evidence.services.total;
    roll.routes.present += c.evidence.routes.present; roll.routes.total += c.evidence.routes.total;
    roll.frontend.present += c.evidence.frontend.present; roll.frontend.total += c.evidence.frontend.total;
    roll.tables.present += c.evidence.tables.present; roll.tables.total += c.evidence.tables.total;
    roll.tables.absent += c.evidence.tables.absentList.length;
  }

  const scan = {
    generated_at: new Date().toISOString(),
    meta: OPERATIONAL_MODEL_META,
    axes: OPERATIONAL_AXES,
    domains: OPERATIONAL_DOMAINS,
    decisions: OPERATIONAL_DECISIONS,
    coverage,
    certification,
    adoption,
    gaps,
    validation,
    summary,
    evidence_rollup: roll,
    flag_state_at_scan: process.env.FF_OPERATIONAL_READINESS === '1',
  };

  const DIR = path.join(process.cwd(), 'audit', 'program-2-operational-readiness');
  mkdirSync(DIR, { recursive: true });
  const OUT = path.join(DIR, 'scan.json');
  writeFileSync(OUT, JSON.stringify(scan, null, 2));
  await pool.end();

  console.log(`[scan] wrote ${OUT}`);
  console.log(`[scan] domains: ${coverage.length} · status: ${JSON.stringify(summary.status_counts)}`);
  console.log(`[scan] certification scores (SEPARATE, never combined): ${JSON.stringify(summary.certification_scores)}`);
  console.log(`[scan] gaps: ${JSON.stringify(summary.gap_counts)} · verdict: ${summary.enterprise_ready.verdict}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
