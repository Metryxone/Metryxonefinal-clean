/**
 * MX-102X — Outcome Intelligence certification + founder report generator (read-only).
 *
 * Exercises the composition engine directly against the live DB and writes the deliverables to
 * backend/audit/mx-102x/:
 *   - 02_per_type_outcome_intelligence.md   per-type Coverage/Confidence/calibration/validation
 *   - 03_founder_report.md                  founder dashboard summary + success-criteria checklist
 *
 * Honest by construction: it surfaces whatever the engine measures (with ~0 realized outcomes the
 * verdict is PARTIAL, accuracy ABSTAINED). No PII is written — the engine pseudonymises ledger
 * subjects; this report prints aggregates only. Read-only: no DDL, no writes.
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  composeOverview,
  composeCertification,
  composeLedger,
  OUTCOME_INTELLIGENCE_VERSION,
  OI_K_MIN,
} from '../services/outcome-intelligence-engine';

const OUT_DIR = path.join(__dirname, '../audit/mx-102x');

function fmt(n: number | null | undefined): string {
  return n == null ? '_null (substrate unreadable — honest gap, not 0)_' : String(n);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only certification).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const overview = await composeOverview(pool);
    const cert = await composeCertification(pool);
    const ledger = await composeLedger(pool, undefined, 25);
    const now = new Date().toISOString();

    // ── 02 per-type ──────────────────────────────────────────────────────────────────────────────
    const perType: string[] = [];
    perType.push('# MX-102X — Per-Type Outcome Intelligence (Coverage ⟂ Confidence)');
    perType.push('');
    perType.push(`_Generated ${now} · engine v${OUTCOME_INTELLIGENCE_VERSION} · k_min=${OI_K_MIN} · read-only_`);
    perType.push('');
    perType.push('Coverage = realized outcomes captured (data axis). Confidence/accuracy = calibration trust,');
    perType.push('ABSTAINED until realized {prediction,outcome} pairs reach k_min. A realized outcome without a');
    perType.push('decision-time prediction counts toward Coverage only — that gap IS the Coverage≠Confidence finding.');
    perType.push('');
    perType.push('| Type | Sources | Coverage (realized) | Demo | Calibration method | Evidence pairs | Abstained | Validation |');
    perType.push('|------|---------|--------------------:|-----:|--------------------|--------------:|:---------:|------------|');
    for (const t of overview.types) {
      perType.push(
        `| **${t.label}** | ${t.sources.join(', ')} | ${fmt(t.coverage.realized)} | ${fmt(t.coverage.demo)} | ${t.calibration_method} | ${t.calibration.pairs_used} | ${t.abstained ? 'yes' : 'no'} | ${t.validation.reason ?? 'evidence-backed'} |`,
      );
    }
    perType.push('');
    for (const t of overview.types) {
      perType.push(`### ${t.label} (\`${t.type}\`)`);
      perType.push(`- **Sources**: ${t.sources.join(', ')} · table_present=${t.coverage.table_present}`);
      perType.push(`- **Coverage**: realized=${fmt(t.coverage.realized)}, demo=${fmt(t.coverage.demo)}`);
      perType.push(`- **Coverage detail**: ${Object.entries(t.coverage.detail).map(([k, v]) => `${k}=${fmt(v as number | null)}`).join(', ') || '_none_'}`);
      perType.push(`- **Calibration**: method=${t.calibration_method}, method_applies=${t.calibration.method_applies}, pairs_used=${t.calibration.pairs_used}`);
      perType.push(`- **Validation**: ${t.validation.reason ?? 'evidence-backed (≥ k_min realized predictions)'}`);
      perType.push(`- **Note**: ${t.note}`);
      perType.push('');
    }
    fs.writeFileSync(path.join(OUT_DIR, '02_per_type_outcome_intelligence.md'), perType.join('\n'));

    // ── 03 founder report ────────────────────────────────────────────────────────────────────────
    const f: string[] = [];
    f.push('# MX-102X — Outcome Intelligence Activation · Founder Report');
    f.push('');
    f.push(`_Generated ${now} · engine v${OUTCOME_INTELLIGENCE_VERSION} · k_min=${OI_K_MIN}_`);
    f.push('');
    f.push(`## Verdict: **${cert.verdict}**`);
    f.push('');
    f.push(cert.summary);
    f.push('');
    f.push('## Platform rollup');
    f.push('');
    f.push('| Metric | Value |');
    f.push('|--------|------:|');
    f.push(`| Outcome types unified | ${overview.platform.type_count} |`);
    f.push(`| Types with realized coverage | ${overview.platform.types_with_coverage} |`);
    f.push(`| Realized coverage (data axis) | ${fmt(overview.platform.realized_coverage)} |`);
    f.push(`| Evidence pairs (confidence axis) | ${overview.platform.evidence_pairs} |`);
    f.push(`| Types evidence-backed (≥ k_min) | ${overview.platform.types_evidence_backed} |`);
    f.push(`| Accuracy abstained | ${overview.platform.abstained ? 'yes' : 'no'} |`);
    f.push('');
    f.push('> **Coverage ⟂ Confidence**: these two columns are deliberately never combined. Realized');
    f.push('> coverage is how much real-world outcome data exists; evidence pairs are how much of it can');
    f.push('> empirically calibrate a prediction. With outcomes still accruing, accuracy ABSTAINS.');
    f.push('');
    f.push('## Success-criteria certification');
    f.push('');
    f.push('| # | Criterion | Status | Detail |');
    f.push('|---|-----------|:------:|--------|');
    for (const c of cert.checks) {
      f.push(`| ${c.id} | ${c.criterion} | **${c.status}** | ${c.detail} |`);
    }
    f.push('');
    f.push('## Per-type snapshot');
    f.push('');
    f.push('| Type | Coverage (realized) | Evidence pairs | Abstained |');
    f.push('|------|--------------------:|--------------:|:---------:|');
    for (const t of overview.types) {
      f.push(`| ${t.label} | ${fmt(t.coverage.realized)} | ${t.calibration.pairs_used} | ${t.abstained ? 'yes' : 'no'} |`);
    }
    f.push('');
    f.push(`## Unified ledger (most recent, pseudonymised) — ${ledger.count} row(s)`);
    f.push('');
    if (ledger.count === 0) {
      f.push('_No realized outcomes captured yet — honest empty (the app has not been deployed/used at scale)._');
    } else {
      f.push('| Type | Substrate | Kind | Value | Pred@decision | Demo | Subject |');
      f.push('|------|-----------|------|------:|--------------:|:----:|---------|');
      for (const r of (ledger.rows as any[])) {
        f.push(`| ${r.type} | ${r.substrate} | ${r.outcome_kind ?? ''} | ${r.outcome_value ?? ''} | ${r.predicted_prob_at_decision ?? '—'} | ${r.is_demo ? 'yes' : 'no'} | ${r.subject} |`);
      }
    }
    f.push('');
    f.push('---');
    f.push('');
    f.push('**Honesty contract**: Coverage and Confidence are separate axes; demo rows are excluded from');
    f.push('every realized/evidence figure; unreadable substrates degrade to null (never 0); out-of-range');
    f.push('predictions are dropped (never clamped); empirical accuracy is ABSTAINED until realized outcomes');
    f.push('reach k_min. PARTIAL here is the honest state, not a defect — and never inflated to look complete.');
    fs.writeFileSync(path.join(OUT_DIR, '03_founder_report.md'), f.join('\n'));

    console.log(`[mx102x] verdict=${cert.verdict} realized_coverage=${fmt(overview.platform.realized_coverage)} evidence_pairs=${overview.platform.evidence_pairs} → ${OUT_DIR}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
