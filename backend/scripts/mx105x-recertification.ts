/**
 * MX-105X — Enterprise Certification & Platform Activation · recertification report (read-only).
 *
 * Runs the top-level composer directly against the live DB and writes a single deliverable to
 * backend/audit/mx-105x/recertification-report.md:
 *   - Enterprise verdict (PASS/PARTIAL/FAIL) + structural %
 *   - The FOUR separate axes per subsystem (Structural ⟂ Activation ⟂ Adoption ⟂ Outcome-Confidence)
 *   - Unified candidate+employer journey + outcome readiness + 12-category health + 12 founder metrics
 *
 * Honest by construction: the composer recomputes nothing — it folds whatever the existing engines
 * report. Verdict axis is STRUCTURAL only; activation/adoption/outcome-confidence are reported
 * alongside, never composited. null = not measurable (never coerced to 0). No PII is written
 * (aggregates only). Read-only: no DDL, no writes.
 *
 * Run with the platform feature flags ON so the underlying engines are exercised, e.g.:
 *   FF_ENTERPRISE_CERTIFICATION=1 FF_OUTCOME_INTELLIGENCE_ACTIVATION=1 FF_LIVE_EMPLOYER_ECOSYSTEM=1 \
 *     npx tsx scripts/mx105x-recertification.ts
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  overview,
  recertification,
  unifiedJourney,
  outcomeReadiness,
  commandCenter,
  founderCommandCenter,
  ENTERPRISE_CERTIFICATION_VERSION,
} from '../services/enterprise-certification';

const OUT_DIR = path.join(__dirname, '../audit/mx-105x');

// The flags that gate the engines this composer folds — printed so the report is interpretable.
const RELEVANT_FLAGS = [
  'FF_ENTERPRISE_CERTIFICATION',
  'FF_OUTCOME_INTELLIGENCE_ACTIVATION',
  'FF_LIVE_EMPLOYER_ECOSYSTEM',
  'FF_RUNTIME_INTELLIGENCE_ACTIVATION',
  'FF_COMMERCIAL_ACTIVATION',
  'FF_CAREER_INTELLIGENCE_ACTIVATION',
  'FF_REPORT_FACTORY',
];

function fmt(n: number | null | undefined): string {
  return n == null ? '_n/a (not measurable — honest gap, never 0)_' : String(n);
}
function pct(n: number | null | undefined): string {
  return n == null ? '_n/a_' : `${n}%`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only recertification).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const flagState = RELEVANT_FLAGS.map((f) => `${f}=${process.env[f] === '1' ? 'on' : 'off'}`);
    console.log('[mx105x] flag state:', flagState.join(', '));

    const [ov, cert, journey, outcomes, cmd, founder] = await Promise.all([
      overview(pool),
      recertification(pool),
      unifiedJourney(pool),
      outcomeReadiness(pool),
      commandCenter(pool),
      founderCommandCenter(pool),
    ]);

    const now = new Date().toISOString();
    const o: string[] = [];
    o.push('# MX-105X — Enterprise Certification & Platform Activation · Recertification Report');
    o.push('');
    o.push(`_Generated ${now} · composer v${ENTERPRISE_CERTIFICATION_VERSION} · read-only (no DDL, no writes)_`);
    o.push('');
    o.push(`**Process flag state at run:** ${flagState.join(', ')}`);
    o.push('');
    o.push('> This composer **recomputes nothing** — it folds the headline of each existing engine.');
    o.push('> The four axes are reported **separately and never composited**:');
    o.push('> **Structural** (required tables present) ⟂ **Activation** (gating flag on) ⟂');
    o.push('> **Adoption** (live rows) ⟂ **Outcome-Confidence** (calibrated/provisional/abstained).');
    o.push('> The headline verdict is **structural only**. `null` = not measurable, never 0.');
    o.push('');

    // ── Enterprise verdict ──────────────────────────────────────────────────────────
    o.push('## Enterprise verdict');
    o.push('');
    o.push(`- **Verdict (structural axis):** ${cert.verdict} — ${cert.target}`);
    o.push(`- **Enterprise structural readiness:** ${pct(cert.enterprise_structural_pct)} ` +
      `(${cert.structural_tables_present}/${cert.structural_tables_total} required tables present)`);
    o.push(`- **Subsystems:** ${cert.summary.pass} PASS · ${cert.summary.partial} PARTIAL · ${cert.summary.fail} FAIL ` +
      `(of ${cert.summary.total})`);
    o.push(`- **Activated (flag on):** ${cert.summary.activated}/${cert.summary.total} · ` +
      `**Adopted (live rows):** ${cert.summary.adopted}/${cert.summary.total}`);
    o.push('');
    o.push(`_${cert.axes_note}_`);
    o.push('');

    // ── Per-subsystem 4-axis table ──────────────────────────────────────────────────
    o.push('## Subsystems — four separate axes');
    o.push('');
    o.push('| Subsystem | Status | Structural | Activation | Adoption | Outcome-Confidence |');
    o.push('|-----------|:------:|:----------:|:----------:|:--------:|:------------------:|');
    for (const s of cert.subsystems) {
      const struct = `${s.structural.present}/${s.structural.total}`;
      const act = s.activation.switched_on ? (s.activation.always_on ? 'on (always)' : 'on') : 'off';
      const adopt = fmt(s.adoption.live_rows);
      const oc = s.outcome_confidence.applies ? s.outcome_confidence.state : '—';
      o.push(`| ${s.label} | ${s.status} | ${struct} | ${act} | ${adopt} | ${oc} |`);
    }
    o.push('');
    for (const s of cert.subsystems) {
      if (s.structural.missing.length > 0) {
        o.push(`- **${s.label}** missing tables: ${s.structural.missing.join(', ')}`);
      }
    }
    o.push('');

    // ── Unified journey ─────────────────────────────────────────────────────────────
    o.push('## Unified journey (candidate + employer)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(journey, null, 2));
    o.push('```');
    o.push('');

    // ── Outcome readiness ───────────────────────────────────────────────────────────
    o.push('## Outcome readiness (folds MX-102X)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(outcomes, null, 2));
    o.push('```');
    o.push('');

    // ── Command center (12 health categories) ───────────────────────────────────────
    o.push('## Command center — health categories');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(cmd, null, 2));
    o.push('```');
    o.push('');

    // ── Founder command center (12 metrics) ─────────────────────────────────────────
    o.push('## Founder command center — metrics');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(founder, null, 2));
    o.push('```');
    o.push('');

    o.push('## Overview (folded headline)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(ov, null, 2));
    o.push('```');
    o.push('');

    const report = o.join('\n');
    // PII guard: the composer returns aggregates only, but mask any stray email just in case.
    const masked = report.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'user_masked');
    fs.writeFileSync(path.join(OUT_DIR, 'recertification-report.md'), masked);
    console.log(`[mx105x] verdict=${cert.verdict} structural=${pct(cert.enterprise_structural_pct)} ` +
      `→ ${path.join(OUT_DIR, 'recertification-report.md')}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[mx105x] failed:', e);
  process.exit(1);
});
