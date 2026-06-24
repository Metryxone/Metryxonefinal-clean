/**
 * MX-106X — Production Readiness & Go-Live Certification · go-live report (read-only).
 *
 * Runs the top-level Go-Live composer directly against the live DB and writes one deliverable to
 * backend/audit/mx-106x/go-live-certification-report.md:
 *   - Go-Live certificate (5-level ladder) + 9 yes/no questions + recommendation
 *   - The SIX separate readiness axes (Structural ⟂ Activation ⟂ Adoption ⟂ Operational ⟂ Outcome ⟂ Market)
 *   - Scalability certification (structural/config; load = not_measurable)
 *   - Security & Governance certification (formal RBAC advisory; live super_admin gate authoritative)
 *   - Super Admin Go-Live Center (per-domain health + launch readiness) + Founder Go-Live Center
 *
 * Honest by construction: the composer recomputes nothing — it folds whatever the existing engines
 * report (MX-105X enterprise-certification + governance/tenant/health/operational/outcome). The six
 * axes are reported separately and NEVER composited. The overall is checklist completion (share of 9
 * questions = YES), NOT an average of the axes. null = not measurable (never coerced to 0). No PII is
 * written (aggregates only). Read-only: no DDL, no writes.
 *
 * Run with the platform feature flags ON so the underlying engines are exercised, e.g.:
 *   FF_GO_LIVE_CERTIFICATION=1 FF_ENTERPRISE_CERTIFICATION=1 FF_OUTCOME_INTELLIGENCE_ACTIVATION=1 \
 *     FF_LIVE_EMPLOYER_ECOSYSTEM=1 npx tsx scripts/mx106x-go-live-certification.ts
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  goLiveOverview,
  sixAxisReadiness,
  scalabilityCertification,
  securityGovernanceCertification,
  goLiveCertification,
  goLiveCommandCenter,
  founderGoLiveCenter,
  GO_LIVE_CERTIFICATION_VERSION,
} from '../services/go-live-certification';

const OUT_DIR = path.join(__dirname, '../audit/mx-106x');

// The flags that gate the engines this composer folds — printed so the report is interpretable.
const RELEVANT_FLAGS = [
  'FF_GO_LIVE_CERTIFICATION',
  'FF_ENTERPRISE_CERTIFICATION',
  'FF_OUTCOME_INTELLIGENCE_ACTIVATION',
  'FF_LIVE_EMPLOYER_ECOSYSTEM',
  'FF_RUNTIME_INTELLIGENCE_ACTIVATION',
  'FF_COMMERCIAL_ACTIVATION',
  'FF_CAREER_INTELLIGENCE_ACTIVATION',
  'FF_AI_GOVERNANCE',
  'FF_GOVERNANCE_RBAC_V2',
  'FF_ENTERPRISE_ANALYTICS',
  'FF_REPORT_FACTORY',
];

function pct(n: number | null | undefined): string {
  return n == null ? '_n/a (not measurable — honest gap, never 0)_' : `${n}%`;
}
function num(n: number | null | undefined): string {
  return n == null ? '_n/a_' : String(n);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only go-live certification).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const flagState = RELEVANT_FLAGS.map((f) => `${f}=${process.env[f] === '1' ? 'on' : 'off'}`);
    console.log('[mx106x] flag state:', flagState.join(', '));

    const [ov, axesView, scal, secg, cert, cmd, founder] = await Promise.all([
      goLiveOverview(pool),
      sixAxisReadiness(pool),
      scalabilityCertification(pool),
      securityGovernanceCertification(pool),
      goLiveCertification(pool),
      goLiveCommandCenter(pool),
      founderGoLiveCenter(pool),
    ]);

    const now = new Date().toISOString();
    const o: string[] = [];
    o.push('# MX-106X — Production Readiness & Go-Live Certification Report');
    o.push('');
    o.push(`_Generated ${now} · composer v${GO_LIVE_CERTIFICATION_VERSION} · read-only (no DDL, no writes)_`);
    o.push('');
    o.push(`**Process flag state at run:** ${flagState.join(', ')}`);
    o.push('');
    o.push('> This composer **recomputes nothing** — it folds the headline of each existing engine');
    o.push('> (MX-105X enterprise-certification + governance / tenant / health / operational / outcome).');
    o.push('> The **six readiness axes** are reported **separately and never composited**:');
    o.push('> **Structural** (machinery present) ⟂ **Activation** (gating flags on) ⟂ **Adoption** (live rows) ⟂');
    o.push('> **Operational** (config/runtime substrate) ⟂ **Outcome** (realized coverage + calibrated confidence) ⟂');
    o.push('> **Market** (real commercial evidence). The overall is **checklist completion** (share of the 9');
    o.push('> go-live questions answered YES) — **NOT** an average of the axes. `null` = not measurable, never 0.');
    o.push('> Live evidence that cannot be measured (load capacity, real customers) is reported as `not_measurable`.');
    o.push('');

    // ── Go-Live certificate ──────────────────────────────────────────────────────────
    o.push('## Go-Live certificate');
    o.push('');
    o.push(`- **Certification level:** ${(cert as any).level?.label ?? '_n/a_'} (level ${(cert as any).level?.index ?? '?'} / 4)`);
    o.push(`- **Checklist completion:** ${pct((cert as any).overall_checklist_pct)} ` +
      `(${(cert as any).summary?.answered_yes}/${(cert as any).summary?.total} questions = YES · ` +
      `${(cert as any).summary?.answered_no} no · ${(cert as any).summary?.abstained} abstained)`);
    o.push(`- **Recommendation:** ${(cert as any).recommendation ?? '_n/a_'}`);
    o.push('');
    o.push('### 9 go-live questions (yes / no / abstain)');
    o.push('');
    o.push('| # | Question | Axis | Answer |');
    o.push('|:-:|----------|:----:|:------:|');
    ((cert as any).questions ?? []).forEach((q: any, i: number) => {
      o.push(`| ${i + 1} | ${q.question} | ${q.axis} | ${q.answer} |`);
    });
    o.push('');
    o.push('### Cumulative gates (an abstain is NOT a yes — it cannot advance a gate)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify((cert as any).gates ?? null, null, 2));
    o.push('```');
    o.push('');

    // ── Six-axis readiness ───────────────────────────────────────────────────────────
    o.push('## Six-axis readiness (separate axes — never composited)');
    o.push('');
    o.push('| Axis | Status | Score | Note |');
    o.push('|------|:------:|:-----:|------|');
    for (const a of ((axesView as any).axes ?? [])) {
      o.push(`| ${a.label} | ${a.status} | ${a.score == null ? '_n/a_' : `${a.score}%`} | ${a.note ?? ''} |`);
    }
    o.push('');
    o.push(`_${(axesView as any).axes_note}_`);
    o.push('');

    // ── Scalability ──────────────────────────────────────────────────────────────────
    o.push('## Scalability certification (structural/config only — load = not_measurable)');
    o.push('');
    o.push(`- **Verdict:** ${(scal as any).verdict} · **Structural readiness:** ${pct((scal as any).structural_readiness_pct)} ` +
      `(${(scal as any).structural_dimensions_ready}/${(scal as any).structural_dimensions_total} dimensions)`);
    o.push(`- **Tenants:** ${num((scal as any).dimensions?.multi_tenant?.tenant_count)} · ` +
      `**Health snapshots:** ${num((scal as any).dimensions?.health_monitoring?.snapshot_count)}`);
    o.push(`- _${(scal as any).axes_note}_`);
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(scal, null, 2));
    o.push('```');
    o.push('');

    // ── Security & governance ────────────────────────────────────────────────────────
    o.push('## Security & Governance certification (formal RBAC advisory; live super_admin gate authoritative)');
    o.push('');
    o.push(`- **Verdict:** ${(secg as any).verdict} · **Structural readiness:** ${pct((secg as any).structural_readiness_pct)} ` +
      `(${(secg as any).structural_dimensions_ready}/${(secg as any).structural_dimensions_total} dimensions)`);
    o.push(`- _${(secg as any).rbac_enforcement_note}_`);
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(secg, null, 2));
    o.push('```');
    o.push('');

    // ── Super Admin Go-Live Center ───────────────────────────────────────────────────
    o.push('## Super Admin Go-Live Center (per-domain health + launch readiness)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(cmd, null, 2));
    o.push('```');
    o.push('');

    // ── Founder Go-Live Center ───────────────────────────────────────────────────────
    o.push('## Founder Go-Live Center (executive %s + top gaps/risks + recommendation)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(founder, null, 2));
    o.push('```');
    o.push('');

    // ── Overview ─────────────────────────────────────────────────────────────────────
    o.push('## Overview (folded headline)');
    o.push('');
    o.push('```json');
    o.push(JSON.stringify(ov, null, 2));
    o.push('```');
    o.push('');

    const report = o.join('\n');
    // PII guard (defense-in-depth): the composer already scrubs folded detail to aggregates only,
    // but as a final belt-and-braces pass mask any stray email, UUID, or IPv4 before writing.
    const masked = report
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'user_masked')
      .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, 'id_masked')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'ip_masked');
    fs.writeFileSync(path.join(OUT_DIR, 'go-live-certification-report.md'), masked);
    console.log(`[mx106x] level=${(cert as any).level?.label} checklist=${pct((cert as any).overall_checklist_pct)} ` +
      `scalability=${(scal as any).verdict} security=${(secg as any).verdict} ` +
      `→ ${path.join(OUT_DIR, 'go-live-certification-report.md')}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[mx106x] failed:', e);
  process.exit(1);
});
