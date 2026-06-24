/**
 * MX-103X — Live Employer Ecosystem audit + founder report generator (read-only).
 *
 * Runs the audit engine directly against the live DB and writes deliverables to backend/audit/mx-103x/:
 *   - 01_employer_funnel_audit.md   per-stage Coverage ⟂ Confidence inventory (flag/substrate/real-vs-demo)
 *   - 02_founder_report.md          verdict + success-criteria checklist + demo transparency
 *
 * Honest by construction: surfaces whatever the engine measures. With demo-only data and ~0 realized
 * non-demo outcomes the verdict is PARTIAL (confidence abstains). No PII is written (aggregates only).
 * Read-only: no DDL, no writes.
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  runEmployerEcosystemAudit,
  EMPLOYER_ECOSYSTEM_AUDIT_VERSION,
  ECOSYSTEM_K_MIN,
} from '../services/employer-ecosystem-audit-engine';

const OUT_DIR = path.join(__dirname, '../audit/mx-103x');

function fmt(n: number | null | undefined): string {
  return n == null ? '_n/a (substrate absent — honest gap, not 0)_' : String(n);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only audit).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const audit = await runEmployerEcosystemAudit(pool);
    const now = audit.generatedAt;

    // ── 01 funnel audit ──────────────────────────────────────────────────────────────────────────
    const a: string[] = [];
    a.push('# MX-103X — Live Employer Ecosystem · Funnel Audit (Coverage ⟂ Confidence)');
    a.push('');
    a.push(`_Generated ${now} · engine v${EMPLOYER_ECOSYSTEM_AUDIT_VERSION} · k_min=${ECOSYSTEM_K_MIN} · read-only_`);
    a.push('');
    a.push('**Coverage** = the stage is exercisable end-to-end (gating flag ON + substrate present).');
    a.push('**Confidence** = the data behind it is trustworthy (real non-demo rows; calibration ≥ k_min).');
    a.push('The two axes are never composited. Demo rows (@example.com / `validation_loop_outcomes.is_demo`)');
    a.push('are counted separately and EXCLUDED from the confidence axis.');
    a.push('');
    a.push('| # | Stage | Status | Coverage | Confidence | Flag(s) | Real | Demo |');
    a.push('|---|-------|:------:|:--------:|:----------:|---------|-----:|-----:|');
    for (const s of audit.stages) {
      const flags = s.flags.length ? s.flags.map((f) => `${f.key}=${f.enabled ? 'on' : 'off'}`).join(', ') : '_none_';
      a.push(`| ${s.id} | **${s.name}** | ${s.status} | ${s.coverage} | ${s.confidence} | ${flags} | ${fmt(s.realRows)} | ${fmt(s.demoRows)} |`);
    }
    a.push('');
    for (const s of audit.stages) {
      a.push(`### ${s.id}. ${s.name}`);
      a.push(`- **Criterion**: ${s.criterion}`);
      a.push(`- **Status**: ${s.status} · Coverage=${s.coverage} · Confidence=${s.confidence}`);
      a.push(`- **Flags**: ${s.flags.length ? s.flags.map((f) => `${f.key}=${f.enabled ? 'on' : 'off'}`).join(', ') : 'none (not flag-gated)'}`);
      a.push(`- **Substrate**: ${s.tables.map((t) => `${t.name}=${t.present ? 'present' : 'absent'}`).join(', ')}`);
      a.push(`- **Counts**: total=${fmt(s.totalRows)}, real=${fmt(s.realRows)}, demo=${fmt(s.demoRows)}`);
      a.push(`- **Note**: ${s.note}`);
      a.push('');
    }
    fs.writeFileSync(path.join(OUT_DIR, '01_employer_funnel_audit.md'), a.join('\n'));

    // ── 02 founder report ────────────────────────────────────────────────────────────────────────
    const f: string[] = [];
    f.push('# MX-103X — Live Employer Ecosystem Activation · Founder Report');
    f.push('');
    f.push(`_Generated ${now} · engine v${EMPLOYER_ECOSYSTEM_AUDIT_VERSION} · k_min=${ECOSYSTEM_K_MIN}_`);
    f.push('');
    f.push(`## Verdict: **${audit.verdict}**`);
    f.push('');
    for (const r of audit.verdictReasons) f.push(`- ${r}`);
    f.push('');
    f.push('## Funnel rollup');
    f.push('');
    f.push('| Metric | Value |');
    f.push('|--------|------:|');
    f.push(`| Funnel stages | ${audit.summary.totalStages} |`);
    f.push(`| Operational (real data) | ${audit.summary.operational} |`);
    f.push(`| Demo-only (exercisable, no real rows) | ${audit.summary.demoOnly} |`);
    f.push(`| Gated (flag OFF → 503) | ${audit.summary.gated} |`);
    f.push(`| Gap (substrate missing) | ${audit.summary.gap} |`);
    f.push(`| Empty (reachable, no rows) | ${audit.summary.empty} |`);
    f.push(`| Coverage reachable (axis 1) | ${audit.summary.coverageReachable} / ${audit.summary.totalStages} |`);
    f.push(`| Stages with real data (axis 2) | ${audit.summary.realDataStages} / ${audit.summary.totalStages} |`);
    f.push(`| Outcome confidence calibrated | ${audit.summary.outcomeCalibrated ? 'yes' : 'no (abstained)'} |`);
    f.push('');
    f.push('> **Coverage ⟂ Confidence**: a stage can be fully reachable (Coverage) while its data is demo-only');
    f.push('> (Confidence abstains). High coverage with demo-only confidence is the honest pre-launch state —');
    f.push('> never inflated to OPERATIONAL until real non-demo outcomes accrue and calibration trusts them.');
    f.push('');
    f.push('## Success-criteria certification (8 stages)');
    f.push('');
    f.push('| # | Stage | Criterion | Status |');
    f.push('|---|-------|-----------|:------:|');
    for (const s of audit.stages) {
      f.push(`| ${s.id} | ${s.name} | ${s.criterion} | **${s.status}** |`);
    }
    f.push('');
    f.push('## Demo transparency');
    f.push('');
    f.push(audit.demoTransparency);
    f.push('');
    f.push('---');
    f.push('');
    f.push('**Honesty contract**: read-only composition; Coverage and Confidence are separate axes; demo rows');
    f.push('are excluded from the real-data / calibration axis; absent substrate degrades to null (never 0);');
    f.push(`outcome confidence ABSTAINS until ≥ ${ECOSYSTEM_K_MIN} realized non-demo outcomes. PARTIAL is the honest`);
    f.push('state pre-deployment, not a defect — and never inflated to look complete.');
    fs.writeFileSync(path.join(OUT_DIR, '02_founder_report.md'), f.join('\n'));

    console.log(`[mx103x] verdict=${audit.verdict} operational=${audit.summary.operational}/${audit.summary.totalStages} demoOnly=${audit.summary.demoOnly} gated=${audit.summary.gated} → ${OUT_DIR}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
