/* MX-800 Phase 2.14 — Enterprise Intelligence Platform Production Certification, Maturity Assessment &
 * Release Baseline. FINAL phase of the MX-800 program.
 *
 * CLI report generator (dev only). Runs the READ-ONLY certification composer against the REAL MX-800
 * 2.1–2.13 substrate and writes the MEASURED certification deliverables to backend/audit/mx-800/. It enables
 * the MX-800 tier flags FOR THIS PROCESS ONLY (env override) so dormant-but-built tiers report their true
 * activation rather than reading as "not integrated"; the flags DO NOT seed any data (dormant substrate
 * stays honestly empty). NO writes/DDL — the composer is read-only.
 *
 * Honesty: numbers are MEASURED (tier getters + repository scan); the four readiness axes are NEVER
 * composited; Production-Ready is WITHHELD by design; maturity ceiling is Managed (Levels 4–5 WITHHELD);
 * null ≠ 0. */

// Enable the full MX-800 intelligence program for THIS process before importing the flag registry consumers.
for (const f of [
  'FF_PLATFORM_INTELLIGENCE_REGISTRY', 'FF_ENGINEERING_INTELLIGENCE', 'FF_RUNTIME_INTELLIGENCE_ENGINE',
  'FF_KNOWLEDGE_INTELLIGENCE_ENGINE', 'FF_DECISION_INTELLIGENCE_ENGINE', 'FF_PREDICTIVE_INTELLIGENCE_ENGINE',
  'FF_RECOMMENDATION_INTELLIGENCE_ENGINE', 'FF_CONTINUOUS_LEARNING_INTELLIGENCE_ENGINE',
  'FF_ENTERPRISE_INTELLIGENCE_PLATFORM', 'FF_PLATFORM_INTELLIGENCE_OPERATIONS',
  'FF_INTELLIGENCE_AUTOMATION_GOVERNANCE', 'FF_ENTERPRISE_INTELLIGENCE_INTEGRATION',
  'FF_ENTERPRISE_INTELLIGENCE_CERTIFICATION',
]) process.env[f] = '1';

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { composeCertification } from '../services/enterprise-intelligence-certification';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'audit', 'mx-800');

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
    fs.writeFileSync(path.join(OUT_DIR, 'phase-2.14-certification.json'), JSON.stringify(cert, null, 2));

    // 2) Founder certification report (markdown).
    const a = cert.part1_integration;
    const q = cert.part_quality;
    const r = cert.part_production_readiness_axes;
    const m = cert.part7_maturity;
    const b = cert.part8_release_baseline;
    const lines: string[] = [];
    lines.push('# MX-800 Phase 2.14 — Enterprise Intelligence Platform Production Certification, Maturity Assessment & Release Baseline');
    lines.push('');
    lines.push(`_Generated: ${cert.meta.generated_at} · Single source of truth: ${cert.meta.single_source_of_truth} · FINAL MX-800 phase_`);
    lines.push('');
    lines.push(`**Overall verdict: ${cert.verdict.overall} · Production-Ready: ${cert.verdict.production_ready ? 'YES' : 'WITHHELD'}**`);
    lines.push('');
    lines.push('> ' + cert.verdict.reason);
    lines.push('');
    lines.push('## Honesty contract');
    for (const h of cert.meta.honesty_contract) lines.push(`- ${h}`);
    lines.push('');

    lines.push('## Pre-certification audit (tier inventory)');
    lines.push('| Tier | Name | Flag present | Default OFF | Route reg. | Service | Migration | Getter callable | Substrate ready |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const t of cert.pre_certification_audit.tiers) {
      lines.push(`| ${t.tier} | ${t.name} | ${fmt(t.flag_present)} | ${fmt(t.flag_default_off)} | ${fmt(t.route_registered)} | ${fmt(t.service_present)} | ${fmt(t.migration_present)} | ${fmt(t.getter_callable)} | ${fmt(t.getter_ready)} |`);
    }
    lines.push('');

    lines.push('## Part 1 — End-to-end integration');
    lines.push(`- Tiers integrated: **${a.tiers_integrated}/${a.tiers_total}** · Integration complete: **${fmt(a.integration_complete)}** · Composer callable: **${fmt(a.composer_callable)}**`);
    lines.push(`- ${a.note}`);
    lines.push('');

    lines.push('## Part 2 — Production readiness / stability (separate measured scores)');
    for (const [k, v] of Object.entries<any>(cert.part2_production_readiness.stability)) {
      if (v && typeof v === 'object' && 'measured' in v) lines.push(`- **${k}**: ${fmt(v.measured)} — ${v.basis}`);
      else lines.push(`- **${k}**: ${fmt(v)}`);
    }
    lines.push(`- migrations on disk: ${fmt(cert.part2_production_readiness.migration_count)} · feature-flags load: ${fmt(cert.part2_production_readiness.feature_flags_load_ok)}`);
    lines.push('');

    lines.push('## Part 4 — Compatibility (structural)');
    for (const [k, v] of Object.entries<any>(cert.part4_compatibility)) {
      if (k === 'note') continue;
      lines.push(`- **${k}**: ${v.status} — ${v.basis}`);
    }
    lines.push('');

    lines.push('## Part 6 — Performance (honest)');
    lines.push(`- composition_latency_ms: ${fmt(cert.part6_performance.composition_latency_ms)} · throughput_rps: ${fmt(cert.part6_performance.throughput_rps)} · p95_latency_ms: ${fmt(cert.part6_performance.p95_latency_ms)}`);
    lines.push(`- ${cert.part6_performance.note}`);
    lines.push('');

    lines.push('## Part 7 — Platform maturity assessment (ceiling Managed; Levels 4–5 WITHHELD)');
    lines.push(`- Platform maturity FLOOR: **${m.platform_maturity_floor.level_name} (Level ${m.platform_maturity_floor.level})** — ${m.platform_maturity_floor.note}`);
    lines.push(`- Ceiling: **${m.ceiling.level_name} (Level ${m.ceiling.level})** — ${m.ceiling.basis}`);
    lines.push('');
    lines.push('| Tier | Name | Maturity level | Basis |');
    lines.push('|---|---|---|---|');
    for (const d of m.per_domain) lines.push(`| ${d.tier} | ${d.name} | ${d.level_name} (L${d.level}) | ${d.basis} |`);
    lines.push('');
    for (const w of m.levels_withheld) lines.push(`- **Level ${w.level} ${w.level_name}**: ${w.reason}`);
    lines.push('');

    lines.push('## Part 8 — Release baseline (measured snapshot + phase freeze)');
    lines.push(`- Repository: ${fmt(b.repository_baseline.service_files)} service files · ${fmt(b.repository_baseline.route_files)} route files`);
    lines.push(`- Database: ${fmt(b.database_baseline.migration_files)} migration files`);
    lines.push(`- Feature flags: ${fmt(b.metadata_baseline.feature_flags_total)} total (${fmt(b.metadata_baseline.feature_flags_on)} ON / ${fmt(b.metadata_baseline.feature_flags_off)} OFF)`);
    lines.push(`- Documentation: ${fmt(b.documentation_baseline.docs_md_files)} docs · ${fmt(b.documentation_baseline.memory_md_files)} memory files`);
    lines.push(`- repository_commit: ${fmt(b.repository_commit)} · baseline_frozen: ${fmt(b.baseline_frozen)}`);
    lines.push(`- Frozen phases: ${b.platform_baseline.frozen_phases.join(', ')}`);
    lines.push('');

    lines.push('## Part — Quality certification');
    lines.push(`- No duplicate architecture: ${fmt(q.no_duplicate_architecture.measured)} · No business-logic change: ${fmt(q.no_business_logic_change.measured)} · No dormant activation: ${fmt(q.no_dormant_capability_activation.measured)}`);
    lines.push(`- Tier service files: ${cert.duplicate_scan.tier_service_files.join(', ')}`);
    lines.push(`- Duplicate variants found: services=${cert.duplicate_scan.duplicate_service_variants.length}, routes=${cert.duplicate_scan.duplicate_route_variants.length}`);
    lines.push('');

    lines.push('## Production readiness (four axes, never composited)');
    lines.push(`- structural_quality: ${fmt(r.axes.structural_quality)} · integration: ${fmt(r.axes.integration)} · validation: ${fmt(r.axes.validation)} · production_confidence: ${fmt(r.axes.production_confidence)}`);
    lines.push(`- **Verdict: ${r.verdict} · Production-Ready: ${r.production_ready ? 'YES' : 'WITHHELD'}**`);
    lines.push(`- ${r.note}`);
    lines.push('');

    lines.push('## Program completion (Definition of Done)');
    const dod = cert.part10_definition_of_done.definition_of_done;
    for (const [k, v] of Object.entries<any>(dod)) lines.push(`- **${k}**: ${fmt(v)}`);
    lines.push('');
    lines.push(`- ${cert.part10_definition_of_done.program_completion.note}`);
    lines.push('');

    fs.writeFileSync(path.join(OUT_DIR, 'phase-2.14-founder-certification.md'), lines.join('\n'));

    console.log('Wrote:');
    console.log(`  ${path.join(OUT_DIR, 'phase-2.14-certification.json')}`);
    console.log(`  ${path.join(OUT_DIR, 'phase-2.14-founder-certification.md')}`);
    console.log('');
    console.log(`Overall verdict: ${cert.verdict.overall} · Production-Ready: ${cert.verdict.production_ready ? 'YES' : 'WITHHELD'}`);
    console.log(`Tiers integrated: ${a.tiers_integrated}/${a.tiers_total}`);
    console.log(`Platform maturity floor: ${m.platform_maturity_floor.level_name} · ceiling: ${m.ceiling.level_name}`);
  } catch (e: any) {
    console.error('CERTIFICATION SCRIPT FAILED:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
