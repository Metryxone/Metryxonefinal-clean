/* MX-700 Phase 1.43 — Platform Lifecycle Intelligence Production Certification & Enterprise Integration.
 *
 * CLI report generator (dev only). Runs the READ-ONLY certification composer against the REAL 1.37–1.42
 * substrate and writes the MEASURED certification deliverables to backend/audit/mx-700/. It enables the
 * lifecycle tier flags FOR THIS PROCESS ONLY (env override) so dormant-but-built tiers report their true
 * activation rather than reading as "not integrated"; the flags DO NOT seed any data (dormant substrate
 * stays honestly empty). NO writes/DDL — the composer is read-only.
 *
 * Honesty: numbers are MEASURED (getters + repository scan); the four readiness axes are NEVER composited;
 * Production-Ready is WITHHELD by design; null ≠ 0. */

// Enable the full lifecycle program for THIS process before importing the flag registry consumers.
for (const f of [
  'FF_PLATFORM_LIFECYCLE_FOUNDATION', 'FF_PLATFORM_LIFECYCLE_MANAGEMENT', 'FF_PLATFORM_LIFECYCLE_INTELLIGENCE',
  'FF_PLATFORM_EVOLUTION_INTELLIGENCE', 'FF_PLATFORM_LIFECYCLE_AUTOMATION', 'FF_PLATFORM_LIFECYCLE_OPERATIONS',
  'FF_PLATFORM_LIFECYCLE_CERTIFICATION',
]) process.env[f] = '1';

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { composeCertification } from '../services/platform-lifecycle-certification';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'audit', 'mx-700');

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'YES' : 'NO';
  return String(v);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const cert = await composeCertification(pool);

    // 1) Machine-readable certification (the authoritative deliverable).
    fs.writeFileSync(path.join(OUT_DIR, 'phase-1.43-certification.json'), JSON.stringify(cert, null, 2));

    // 2) Founder certification report (markdown).
    const a = cert.part1_integration;
    const q = cert.part8_quality;
    const r = cert.part9_production_readiness;
    const lines: string[] = [];
    lines.push('# MX-700 Phase 1.43 — Platform Lifecycle Intelligence Production Certification');
    lines.push('');
    lines.push(`_Generated: ${cert.meta.generated_at} · Single source of truth: ${cert.meta.single_source_of_truth}_`);
    lines.push('');
    lines.push(`**Overall verdict: ${cert.verdict.overall} · Production-Ready: ${cert.verdict.production_ready ? 'YES' : 'WITHHELD'}**`);
    lines.push('');
    lines.push('> ' + cert.verdict.reason);
    lines.push('');
    lines.push('## Honesty contract');
    for (const h of cert.meta.honesty_contract) lines.push(`- ${h}`);
    lines.push('');

    lines.push('## Pre-integration audit (tier inventory)');
    lines.push('| Tier | Name | Flag present | Default OFF | Route reg. | Service | Migration | Getter callable | Substrate ready |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const t of cert.pre_integration_audit.tiers) {
      lines.push(`| ${t.tier} | ${t.name} | ${fmt(t.flag_present)} | ${fmt(t.flag_default_off)} | ${fmt(t.route_registered)} | ${fmt(t.service_present)} | ${fmt(t.migration_present)} | ${fmt(t.getter_callable)} | ${fmt(t.getter_ready)} |`);
    }
    lines.push('');

    lines.push('## Part 1 — End-to-end integration');
    lines.push(`- Tiers integrated: **${a.tiers_integrated}/${a.tiers_total}** · Integration complete: **${fmt(a.integration_complete)}** · Composer callable: **${fmt(a.composer_callable)}**`);
    lines.push(`- ${a.note}`);
    lines.push('');

    lines.push('## Part 2 — Production hardening / stability (separate measured scores)');
    lines.push(`- lifecycle_stability: ${fmt(cert.part2_hardening.stability_scores.lifecycle_stability)} · repository_stability: ${fmt(cert.part2_hardening.stability_scores.repository_stability)} · automation_health: ${fmt(cert.part2_hardening.stability_scores.automation_health)}`);
    lines.push(`- migrations on disk: ${fmt(cert.part2_hardening.migration_count)} · feature-flags load: ${fmt(cert.part2_hardening.feature_flags_load_ok)}`);
    lines.push(`- ${cert.part2_hardening.note}`);
    lines.push('');

    lines.push('## Part 4 — Compatibility (structural)');
    for (const [k, v] of Object.entries<any>(cert.part4_compatibility)) {
      if (k === 'note') continue;
      lines.push(`- **${k}**: ${v.status} — ${v.basis}`);
    }
    lines.push(`- _${cert.part4_compatibility.note}_`);
    lines.push('');

    lines.push('## Part 6 — Performance (honest)');
    lines.push(`- composition_latency_ms: ${fmt(cert.part6_performance.composition_latency_ms)} · throughput_rps: ${fmt(cert.part6_performance.throughput_rps)} · p95_latency_ms: ${fmt(cert.part6_performance.p95_latency_ms)}`);
    lines.push(`- ${cert.part6_performance.note}`);
    lines.push('');

    lines.push('## Part 8 — Quality certification');
    lines.push(`- No duplicate architecture: ${fmt(q.no_duplicate_architecture.measured)} · No business-logic change: ${fmt(q.no_business_logic_change.measured)} · No dormant activation: ${fmt(q.no_dormant_capability_activation.measured)}`);
    lines.push(`- Lifecycle service files: ${q.no_duplicate_lifecycle_services.evidence.join(', ')}`);
    lines.push(`- Lifecycle route files: ${q.no_duplicate_apis.evidence.join(', ')}`);
    lines.push('');

    lines.push('## Part 9 — Production readiness (four axes, never composited)');
    lines.push(`- structural_quality: ${fmt(r.axes.structural_quality)} · integration: ${fmt(r.axes.integration)} · validation: ${fmt(r.axes.validation)} · production_confidence: ${fmt(r.axes.production_confidence)}`);
    lines.push(`- **Verdict: ${r.verdict} · Production-Ready: ${r.production_ready ? 'YES' : 'WITHHELD'}**`);
    lines.push(`- ${r.note}`);
    lines.push('');

    lines.push('## Part 10 — Final certification reports');
    for (const [k, v] of Object.entries<any>(cert.part10_final_certification)) {
      if (k === 'note') continue;
      lines.push(`- **${k}**: ${v.verdict} — ${v.basis}`);
    }
    lines.push('');

    fs.writeFileSync(path.join(OUT_DIR, 'phase-1.43-founder-certification.md'), lines.join('\n'));

    console.log('Wrote:');
    console.log(`  ${path.join(OUT_DIR, 'phase-1.43-certification.json')}`);
    console.log(`  ${path.join(OUT_DIR, 'phase-1.43-founder-certification.md')}`);
    console.log('');
    console.log(`Overall verdict: ${cert.verdict.overall} · Production-Ready: ${cert.verdict.production_ready ? 'YES' : 'WITHHELD'}`);
    console.log(`Tiers integrated: ${a.tiers_integrated}/${a.tiers_total}`);
  } catch (e: any) {
    console.error('CERTIFICATION SCRIPT FAILED:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
