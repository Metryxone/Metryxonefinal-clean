/**
 * MX-107A — Competency Match Intelligence validation harness.
 *
 * Runs the READ-ONLY composers live against the shared DB and writes a PII-masked,
 * honesty-first audit report to backend/audit/mx-107a/. Reports the HONEST verdict:
 * the framework is unified and operationally matchable today, but canonical comp-level
 * PRECISION (7/419 competencies, 25 mapped questions) and live activation volume are
 * data efforts — so canonical precision is reported PARTIAL, never fabricated to 100%.
 *
 * Run (flag ON so the report reflects the activated surface):
 *   cd backend && FF_COMPETENCY_MATCH_INTELLIGENCE=1 npx tsx scripts/mx107a-crosswalk-validation.ts
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  CMI_VERSION,
  composeCrosswalkCoverage,
  composeSuperAdmin,
  composeFounder,
  composeCertification,
} from '../services/competency-match-intelligence.js';

function maskPII(s: string): string {
  return s
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'user_masked')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'id_masked')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'ip_masked');
}

function fmtPct(v: number | null): string {
  return v === null ? '_null (not measurable)_' : `${v}%`;
}
function fmtNum(v: number | null): string {
  return v === null ? '_null (absent)_' : String(v);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[mx107a] DATABASE_URL not set — cannot run validation.');
    process.exit(1);
  }
  const flagOn = process.env.FF_COMPETENCY_MATCH_INTELLIGENCE === '1';
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const coverage = await composeCrosswalkCoverage(pool);
    const superAdmin = await composeSuperAdmin(pool);
    const founder = await composeFounder(pool);
    const cert = await composeCertification(pool);

    const h = coverage.headline;
    const lines: string[] = [];
    lines.push('# MX-107A — Competency Match Intelligence: Crosswalk Validation');
    lines.push('');
    lines.push(`- **Generated:** ${new Date().toISOString()}`);
    lines.push(`- **Composer version:** ${CMI_VERSION}`);
    lines.push(`- **Flag (FF_COMPETENCY_MATCH_INTELLIGENCE):** ${flagOn ? 'ON' : 'OFF (composers run directly; routes would 503)'} `);
    lines.push(`- **Mode:** READ-ONLY composition (no recompute, no DDL, no writes).`);
    lines.push('');
    lines.push(`## Overall verdict: **${cert.overall_verdict}**`);
    lines.push('');
    lines.push(`PASS ${cert.summary.pass} · PARTIAL ${cert.summary.partial} · FAIL ${cert.summary.fail} (of ${cert.summary.total})`);
    lines.push('');
    lines.push('> The HONEST verdict is **PARTIAL**: the chain runs off ONE canonical framework and is');
    lines.push('> operationally matchable today (domain-proxy), but canonical comp-level **precision**');
    lines.push('> and live **activation** volume are data efforts — never fabricated by composition.');
    lines.push('');

    lines.push('## Headline axes (Precise ⟂ Operational — never composited)');
    lines.push('');
    lines.push('| Axis | Value |');
    lines.push('| --- | --- |');
    lines.push(`| PRECISE competency coverage (mapped/genome) | ${fmtPct(h.precise_competency_coverage_pct)} |`);
    lines.push(`| OPERATIONAL competency coverage (domain-proxy) | ${fmtPct(h.operational_competency_coverage_pct)} |`);
    lines.push(`| PRECISE requirement reachability | ${fmtPct(h.precise_requirement_reachability_pct)} |`);
    lines.push(`| OPERATIONAL requirement reachability | ${fmtPct(h.operational_requirement_reachability_pct)} |`);
    lines.push('');

    lines.push('## Phase 1 — Crosswalk coverage (hop by hop)');
    lines.push('');
    for (const hop of coverage.hops) {
      lines.push(`### ${hop.hop}  _(axis: ${hop.axis})_`);
      lines.push(`- present: ${hop.present} · coverage: ${fmtPct(hop.coverage_pct)}`);
      const counts = Object.entries(hop.counts).map(([k, v]) => `${k}=${fmtNum(v as number | null)}`).join(' · ');
      lines.push(`- counts: ${counts}`);
      lines.push(`- ${hop.note}`);
      lines.push('');
    }

    lines.push('## Phase 5 — Super Admin coverage console');
    lines.push('');
    for (const [key, c] of Object.entries<any>(superAdmin.coverage)) {
      lines.push(`- **${c.label}** (${key}) — available: ${c.available}`);
      lines.push(`  - ${c.note}`);
    }
    lines.push('');

    lines.push('## Phase 6 — Founder dashboard');
    lines.push('');
    const mr = founder.matchReachability;
    lines.push(`- Avg PRECISE reachability: ${fmtPct(mr.average_precise_reachability_pct)} · Avg OPERATIONAL reachability: ${fmtPct(mr.average_operational_reachability_pct)} (roles measured: ${mr.roles_measured})`);
    lines.push(`- Live employer match: **${founder.liveMatch.state}** — ${founder.liveMatch.note}`);
    lines.push('');
    lines.push('| Role | Precise reach % | Operational reach % | Reqs |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of founder.highestMatchRoles) {
      lines.push(`| ${r.role_title ?? r.role_id} | ${fmtPct(r.precise_reachable_pct)} | ${fmtPct(r.proxy_reachable_pct)} | ${r.requirement_count} |`);
    }
    lines.push('');

    lines.push('## Phase 8 — Certification questions');
    lines.push('');
    for (const q of cert.questions) {
      lines.push(`### ${q.verdict} — ${q.question}`);
      lines.push(`- ${q.evidence}`);
      lines.push('');
    }
    lines.push('## Honesty ceiling (explicit)');
    lines.push('');
    lines.push('- PRECISE comp_*-level scoring is reachable only where questions carry an authored');
    lines.push('  competency map. Today that is a small fraction of the 419-competency genome — this is a');
    lines.push('  DATA-mapping effort (approve more tagged questions), NOT something composition can close.');
    lines.push('- The OPERATIONAL (domain-proxy) match path scores curated Role DNA today and is reported');
    lines.push('  on a SEPARATE axis so canonical precision is never inflated.');
    lines.push('- Live activation (real scored subjects) is below k_min=30 in dev — reported PARTIAL, not 100%.');
    lines.push('');
    lines.push('---');
    lines.push('_Read-only composition. Developmental signals only — NOT hiring/promotion predictions._');

    const auditDir = path.join(process.cwd(), 'audit', 'mx-107a');
    fs.mkdirSync(auditDir, { recursive: true });
    const reportPath = path.join(auditDir, 'crosswalk-validation-report.md');
    fs.writeFileSync(reportPath, maskPII(lines.join('\n')), 'utf8');

    console.log(`[mx107a] Overall verdict: ${cert.overall_verdict} (PASS ${cert.summary.pass} / PARTIAL ${cert.summary.partial} / FAIL ${cert.summary.fail})`);
    console.log(`[mx107a] Precise comp coverage: ${fmtPct(h.precise_competency_coverage_pct)} · Operational: ${fmtPct(h.operational_competency_coverage_pct)}`);
    console.log(`[mx107a] Precise req reachability: ${fmtPct(h.precise_requirement_reachability_pct)} · Operational: ${fmtPct(h.operational_requirement_reachability_pct)}`);
    console.log(`[mx107a] Report → ${reportPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[mx107a] fatal:', err);
  process.exit(1);
});
