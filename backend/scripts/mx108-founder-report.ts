/**
 * MX-108 — Platform Completion Certification · Founder Executive Report (read-only).
 *
 * Runs the top-level Platform Completion composer directly against the live DB and writes one
 * deliverable to backend/audit/mx-108/founder-executive-report.md:
 *   - Overall completion broken into Engineering / Content / Integration / Governance / Dashboard
 *     (each a SEPARATE honest %)
 *   - The FIVE certification dimensions (Implementation ⟂ Structural ⟂ Activation ⟂ Adoption ⟂
 *     Outcome-Confidence) reported side-by-side and NEVER composited
 *   - Per-module PASS / PARTIAL / FAIL (with the capping axis)
 *   - The content/structure probe (genome attributes · indicators · question density · Role-DNA · O*NET)
 *   - Top risks + go-live recommendation
 *
 * Honest by construction: the composer recomputes nothing — it folds whatever the existing engines
 * report and adds read-only content probes. `null` = not measurable (never coerced to 0). No raw PII is
 * written (aggregates only; any stray email is pseudonymised). Read-only: no DDL, no writes.
 *
 * Run with the platform feature flags ON so the underlying engines are exercised, e.g.:
 *   FF_PLATFORM_COMPLETION=1 FF_GO_LIVE_CERTIFICATION=1 FF_ENTERPRISE_CERTIFICATION=1 \
 *     FF_OUTCOME_INTELLIGENCE_ACTIVATION=1 FF_LIVE_EMPLOYER_ECOSYSTEM=1 FF_COMPETENCY_RUNTIME=1 \
 *     FF_REPORT_FACTORY=1 FF_AI_GOVERNANCE=1 FF_GOVERNANCE_RBAC_V2=1 npx tsx scripts/mx108-founder-report.ts
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import {
  platformCompletionFounder,
  platformCompletionCertification,
  PLATFORM_COMPLETION_VERSION,
} from '../services/platform-completion-certification';

const OUT_DIR = path.join(__dirname, '../audit/mx-108');

const RELEVANT_FLAGS = [
  'FF_PLATFORM_COMPLETION',
  'FF_GO_LIVE_CERTIFICATION',
  'FF_ENTERPRISE_CERTIFICATION',
  'FF_OUTCOME_INTELLIGENCE_ACTIVATION',
  'FF_LIVE_EMPLOYER_ECOSYSTEM',
  'FF_RUNTIME_INTELLIGENCE_ACTIVATION',
  'FF_COMMERCIAL_ACTIVATION',
  'FF_CAREER_INTELLIGENCE_ACTIVATION',
  'FF_COMPETENCY_RUNTIME',
  'FF_AI_GOVERNANCE',
  'FF_GOVERNANCE_RBAC_V2',
  'FF_REPORT_FACTORY',
];

function pct(n: number | null | undefined): string {
  return n == null ? '_n/a (not measurable — honest gap, never 0)_' : `${n}%`;
}
function num(n: number | null | undefined): string {
  return n == null ? '_n/a_' : String(n);
}
/** Irreversibly pseudonymise any stray email so no raw PII reaches the committed report. */
function maskPII(s: string): string {
  return s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    (m) => 'user_' + crypto.createHash('sha256').update(m.toLowerCase()).digest('hex').slice(0, 12));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only platform-completion certification).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const flagState = RELEVANT_FLAGS.map((f) => `${f}=${process.env[f] === '1' ? 'on' : 'off'}`);
    console.log('[mx108] flag state:', flagState.join(', '));

    const [founder, cert] = await Promise.all([
      platformCompletionFounder(pool),
      platformCompletionCertification(pool),
    ]);

    const f = founder as any;
    const c = cert as any;
    const now = new Date().toISOString();
    const o: string[] = [];

    o.push('# MX-108 — Platform Completion Certification & Founder Executive Report');
    o.push('');
    o.push(`_Generated ${now} · composer v${PLATFORM_COMPLETION_VERSION} · read-only (no DDL, no writes)_`);
    o.push('');
    o.push(`**Process flag state at run:** ${flagState.join(', ')}`);
    o.push('');
    o.push('> This composer **recomputes nothing** — it folds the headline of each existing read-only');
    o.push('> certification / activation / health composer and adds read-only content/structure probes.');
    o.push('> The **five certification dimensions** — **Implementation ⟂ Structural ⟂ Activation ⟂ Adoption ⟂');
    o.push('> Outcome-Confidence** — are reported **side-by-side and NEVER composited** into one number.');
    o.push('> The overall completion is decomposed into **Engineering / Content / Integration / Governance /');
    o.push('> Dashboard**, each a **separate honest %**. `null` = not measurable, never a fabricated 0%.');
    o.push('> Content & adoption modules are **capped at PARTIAL** by honest evidence (demo `@example.com` excluded).');
    o.push('');

    // ── Certification verdict ──────────────────────────────────────────────────────────
    o.push('## Certification verdict');
    o.push('');
    o.push(`- **Verdict (structural/module-led):** ${c.verdict ?? '_n/a_'}`);
    o.push(`- **Module summary:** ${num(c.module_summary?.pass)} PASS · ${num(c.module_summary?.partial)} PARTIAL · ${num(c.module_summary?.fail)} FAIL (of ${num(c.module_summary?.total)})`);
    o.push(`- **Go-Live certification level:** ${c.certification_level?.label ?? c.certification_level ?? '_n/a_'}`);
    o.push(`- **Go-Live recommendation:** ${c.go_live_recommendation ?? '_n/a_'}`);
    o.push('');
    o.push(`> ${c.verdict_note ?? ''}`);
    o.push('');

    // ── Overall completion breakdown ───────────────────────────────────────────────────
    const areas = f.completion?.areas ?? {};
    o.push('## Overall completion breakdown (5 SEPARATE areas)');
    o.push('');
    o.push(`**Overall completion:** ${pct(f.completion?.overall_completion_pct)} _(mean of the measurable areas — a completion measure, NOT a blend of the five dimensions)_`);
    o.push('');
    o.push('| Area | Completion % |');
    o.push('|------|:------------:|');
    o.push(`| Engineering (engines built & responsive) | ${pct(areas.engineering_pct)} |`);
    o.push(`| Content (genome / questions / indicators / Role-DNA) | ${pct(areas.content_pct)} |`);
    o.push(`| Integration (cross-module journeys) | ${pct(areas.integration_pct)} |`);
    o.push(`| Governance (security & governance structural) | ${pct(areas.governance_pct)} |`);
    o.push(`| Dashboard (command-center structural) | ${pct(areas.dashboard_pct)} |`);
    o.push('');
    const idet = f.completion?.detail ?? {};
    o.push(`- Engineering: ${num(idet.engineering?.engines_responsive)}/${num(idet.engineering?.engines_total)} composed engines responsive.`);
    o.push(`- Integration: candidate structural ${pct(idet.integration?.candidate_structural_pct)} · employer coverage ${pct(idet.integration?.employer_coverage_pct)} · broken links ${num(idet.integration?.broken_links)}.`);
    o.push('');

    // ── Five certification dimensions ──────────────────────────────────────────────────
    const d = f.dimensions ?? {};
    o.push('## The five certification dimensions (NEVER composited)');
    o.push('');
    o.push('| Dimension | Measure | Note |');
    o.push('|-----------|:-------:|------|');
    o.push(`| 1 · Implementation maturity | ${pct(d.implementation?.pct)} | overall completion incl. content |`);
    o.push(`| 2 · Structural readiness | ${pct(d.structural?.pct)} | required-table machinery present |`);
    o.push(`| 3 · Activation | ${pct(d.activation?.pct)} | flags on / machinery active (${num(d.activation?.activated_subsystems)}/${num(d.activation?.subsystems_total)} subsystems) |`);
    o.push(`| 4 · Adoption | ${pct(d.adoption?.pct)} | real non-demo usage (${num(d.adoption?.adopted_subsystems)}/${num(d.adoption?.subsystems_total)} subsystems) |`);
    o.push(`| 5 · Outcome-Confidence | **${d.outcome_confidence?.state ?? '_n/a_'}** | coverage ${pct(d.outcome_confidence?.realized_coverage)} · k_min=${num(d.outcome_confidence?.k_min)} (Coverage ⟂ Confidence) |`);
    o.push('');

    // ── Per-module verdicts ────────────────────────────────────────────────────────────
    o.push('## Per-module certification (PASS / PARTIAL / FAIL)');
    o.push('');
    o.push('| Module | Verdict | Structural | Capped by |');
    o.push('|--------|:-------:|:----------:|-----------|');
    (f.modules?.modules ?? []).forEach((m: any) => {
      o.push(`| ${m.label} | ${m.status} | ${m.structural} | ${m.capped_by ? m.capped_by.join('; ') : '—'} |`);
    });
    o.push('');

    // ── Content / structure probe ──────────────────────────────────────────────────────
    const cp = f.content_probe ?? {};
    o.push('## Content & structure probe (genuinely-new read-only measurement)');
    o.push('');
    o.push(`- **Genome:** ${num(cp.genome_total)} competencies · attribute completeness **${pct(cp.attribute_completeness_pct)}**`);
    o.push(`- **Behavioural indicators:** ${num(cp.indicators?.competencies_with_indicator)}/${num(cp.genome_total)} competencies (${pct(cp.indicators?.coverage_pct)}) · ${num(cp.indicators?.indicators_total)} indicators total`);
    o.push(`- **Question density (PRECISE active crosswalk):** ${num(cp.question_density?.precise_competencies_covered)}/${num(cp.genome_total)} competencies (${pct(cp.question_density?.precise_coverage_pct)}) · ${num(cp.question_density?.precise_active_map_rows)} active map rows`);
    o.push(`  - Template bank (draft/authoring pool, reported separately): ${num(cp.question_density?.template_bank_total)} total · ${num(cp.question_density?.template_bank_approved)} approved`);
    o.push(`- **Role-DNA:** ${num(cp.role_dna?.roles_with_dna)} roles · ${num(cp.role_dna?.requirements)} requirements · genome coverage ${pct(cp.role_dna?.genome_coverage_pct)}`);
    o.push(`- **O*NET reference library:** ${num(cp.onet_reference?.competencies)} competencies · ${num(cp.onet_reference?.roles)} roles · ${num(cp.onet_reference?.role_competency_links)} links`);
    o.push(`- **Content completion (conservative mean of measurable coverage ratios):** ${pct(cp.content_completion_pct)}`);
    o.push('');
    o.push('### Genome attribute coverage (each attribute separate)');
    o.push('');
    o.push('| Attribute | Present | Total | % |');
    o.push('|-----------|:-------:|:-----:|:-:|');
    (cp.genome_attributes ?? []).forEach((a: any) => {
      o.push(`| ${a.key} | ${num(a.present)} | ${num(a.total)} | ${pct(a.pct)} |`);
    });
    o.push('');

    // ── Top risks ──────────────────────────────────────────────────────────────────────
    o.push('## Top risks');
    o.push('');
    if ((f.top_risks ?? []).length === 0) {
      o.push('_No material risks surfaced._');
    } else {
      o.push('| Severity | Area | Risk |');
      o.push('|:--------:|:----:|------|');
      (f.top_risks ?? []).forEach((r: any) => {
        o.push(`| ${r.severity} | ${r.area} | ${maskPII(String(r.risk))} |`);
      });
    }
    o.push('');

    // ── Recommendation ─────────────────────────────────────────────────────────────────
    const rec = f.recommendation ?? {};
    o.push('## Go-live recommendation');
    o.push('');
    o.push(`- **Certification level:** ${rec.certification_level?.label ?? rec.certification_level ?? '_n/a_'}`);
    o.push(`- **Go-live recommendation:** ${rec.go_live_recommendation ?? '_n/a_'}`);
    o.push(`- **Checklist completion:** ${pct(rec.checklist_pct)}`);
    o.push('');
    o.push(`> ${maskPII(String(rec.platform_completion_note ?? ''))}`);
    o.push('');
    o.push('---');
    o.push('');
    o.push(`_${f.disclaimer ?? ''}_`);
    o.push('');

    const outPath = path.join(OUT_DIR, 'founder-executive-report.md');
    fs.writeFileSync(outPath, maskPII(o.join('\n')), 'utf8');
    console.log('[mx108] wrote', outPath);

    // Console summary (honest headline).
    console.log('[mx108] verdict:', c.verdict, '| overall completion:', f.completion?.overall_completion_pct, '%');
    console.log('[mx108] dimensions: impl', d.implementation?.pct, '| struct', d.structural?.pct, '| activation', d.activation?.pct, '| adoption', d.adoption?.pct, '| outcome', d.outcome_confidence?.state);
    console.log('[mx108] modules:', JSON.stringify(f.modules?.summary));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error('[mx108] fatal:', e); process.exit(1); });
