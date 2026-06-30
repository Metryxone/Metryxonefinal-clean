/**
 * CAPADEX 3.0 — Phase 1.8 · Program-1 Product Certification scan.
 * Read-only repo + (via composed getters) DB scan. SSoT for every number in the deliverables.
 *
 * Audits + certifies everything built in Phases 1.1–1.7 against the frozen Product Blueprint:
 *   - per-phase structural presence (config/service/routes on disk) + route-registration +
 *     public-config wiring + read-only getter callability (each phase getter invoked EXACTLY ONCE),
 *   - duplicate / parallel-architecture scan (Enhancement-Only proof),
 *   - Product Traceability Matrix (chain node → providing phases/domains + INTACT/PARTIAL/BREAK),
 *   - FOUR INDEPENDENT certification axes (Structural ⟂ Functional Integration ⟂ Product Maturity ⟂
 *     Enterprise Launch Readiness) — NEVER composited; Launch Readiness WITHHELD (null),
 *   - gap register + severity rollup, STRUCTURAL verdict (Production-Ready WITHHELD).
 *
 * The composer reads engines by existence / persisted-output and NEVER invokes/activates them.
 * This script self-enables the relevant flags IN-PROCESS so flag descriptors read true while it runs
 * (composers are flag-independent read-only; flags don't seed data). It writes NOTHING to the DB.
 *
 * Emits `backend/audit/capadex-3.0-program1-certification/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-1.8-program1-certification-scan.ts
 */
process.env.FF_PRODUCT_TRACEABILITY_CERTIFICATION = '1';
process.env.FF_PERSONA_MODEL_ALIGNMENT = process.env.FF_PERSONA_MODEL_ALIGNMENT ?? '1';
process.env.FF_ASSESSMENT_FRAMEWORK_COMPLETION = process.env.FF_ASSESSMENT_FRAMEWORK_COMPLETION ?? '1';
process.env.FF_CUSTOMER_JOURNEY_COMPLETION = process.env.FF_CUSTOMER_JOURNEY_COMPLETION ?? '1';
process.env.FF_PROGRESSION_ENGINE_COMPLETION = process.env.FF_PROGRESSION_ENGINE_COMPLETION ?? '1';
process.env.FF_OUTCOME_FRAMEWORK_KPI_ENGINE = process.env.FF_OUTCOME_FRAMEWORK_KPI_ENGINE ?? '1';
process.env.FF_AI_RECOMMENDATION_REPORT_ORCHESTRATION = process.env.FF_AI_RECOMMENDATION_REPORT_ORCHESTRATION ?? '1';

import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { composeCertification, summarizeCertification } from '../services/program1-certification-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Gather each phase getter EXACTLY ONCE: compose certification once, derive summary purely.
    const certification = await composeCertification(pool);
    const summary = summarizeCertification(certification);

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      capstone: true,
      flags_enabled_in_process: [
        'FF_PRODUCT_TRACEABILITY_CERTIFICATION', 'FF_PERSONA_MODEL_ALIGNMENT',
        'FF_ASSESSMENT_FRAMEWORK_COMPLETION', 'FF_CUSTOMER_JOURNEY_COMPLETION',
        'FF_PROGRESSION_ENGINE_COMPLETION', 'FF_OUTCOME_FRAMEWORK_KPI_ENGINE',
        'FF_AI_RECOMMENDATION_REPORT_ORCHESTRATION',
      ],
      certification,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.0-program1-certification');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    console.log('── CAPADEX 1.8 Program-1 Product Certification scan ──');
    console.log(`verdict: ${summary.verdict_label}`);
    console.log(`structural: ${summary.structural_pct}%  phases ${summary.phases_present}  routes ${summary.routes_registered}  getters ${summary.getters_ok}`);
    console.log(`traceability: intact ${summary.traceability.intact}  partial ${summary.traceability.partial}  breaks ${summary.traceability.breaks}  / ${summary.traceability.total}`);
    console.log(`maturity managed_or_above: ${summary.maturity_managed_or_above}  duplicate_clean: ${summary.duplicate_clean}`);
    console.log('gap rollup:', JSON.stringify(summary.gap_rollup));
    console.log(`enterprise_launch_readiness: ${summary.enterprise_launch_readiness}  production_ready: ${summary.production_ready}`);
    for (const p of certification.phases) {
      console.log(
        `  ${p.phase.padEnd(4)} ${p.maturity_label.padEnd(22)} ` +
        `struct ${p.structural_present ? 'Y' : 'N'} ` +
        `reg ${p.route_registered === null ? '-' : p.route_registered ? 'Y' : 'N'} ` +
        `pcfg ${p.public_config_wired === null ? '-' : p.public_config_wired ? 'Y' : 'N'} ` +
        `getter ${p.getter_callable === null ? '-' : p.getter_callable ? 'Y' : 'N'}` +
        (p.getter_error ? ` ERR:${p.getter_error}` : ''),
      );
    }
    console.log('wrote', path.join(dir, 'scan.json'));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
