/**
 * smoke-career-intelligence.ts — PHASE 4 end-to-end smoke test.
 *
 * Run: npx tsx backend/scripts/smoke-career-intelligence.ts [subjectId]
 *
 * Composes the Career Intelligence bridge for a real scored subject, prints the
 * six career surfaces (Coverage + Confidence shown separately), then runs the
 * Phase-4 validation harness and prints every area's honest PASS/WARN/FAIL.
 * Read-only: composes engines, writes nothing.
 */
import { Pool } from 'pg';
import { buildCareerIntelligence } from '../services/career-intelligence-bridge.js';
import { runCareerIntelligenceValidation } from '../services/career-intelligence-validation.js';

async function main() {
  const subjectId = process.argv[2] ?? 'demo_subj_pm';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const env = await buildCareerIntelligence(pool, subjectId);
    console.log('='.repeat(72));
    console.log(`CAREER INTELLIGENCE  v${env.version}  subject=${env.subject_id}  measurable=${env.measurable}`);
    console.log('='.repeat(72));
    console.log('top axes:', JSON.stringify(env.axes));
    console.log('\n-- career_readiness --');
    console.log('  role:', JSON.stringify({ ...env.career_readiness.role, axes: undefined }));
    console.log('  industries:', env.career_readiness.industries.measurable_count, '/', env.career_readiness.industries.available_count, 'of', env.career_readiness.industries.items.length);
    console.log('  functions:', env.career_readiness.functions.measurable_count, '/', env.career_readiness.functions.available_count, 'of', env.career_readiness.functions.items.length);
    console.log('\n-- career_pathways --  gating_gaps:', env.career_pathways.gating_gaps.length, ' headroom:', env.career_pathways.growth_headroom.length);
    console.log('\n-- career_planning --  focus:', env.career_planning.focus_areas.length, ' plan_actions:', env.career_planning.plan_actions.length, ' growth_plan_inputs.overall_ei:', env.career_planning.growth_plan_inputs.overall_ei);
    console.log('\n-- career_growth --  potential:', JSON.stringify(env.career_growth.growth_potential.level), env.career_growth.growth_potential.score, ' history:', JSON.stringify(env.career_growth.history));
    console.log('\n-- career_development --  accounting:', JSON.stringify(env.career_development.accounting));
    console.log('\n-- career_builder --  overall_ei:', env.career_builder.overall_ei, env.career_builder.overall_band, ' surfaces:', env.career_builder.surfaces.length, ' emitted:', env.career_builder.emitted_recommendations);
    console.log('\nsource_versions:', JSON.stringify(env.source_versions));
    console.log('language_policy present:', !!env.language_policy && Array.isArray((env.language_policy as any).disallowed_terms));

    const val = await runCareerIntelligenceValidation(pool, subjectId);
    console.log('\n' + '='.repeat(72));
    console.log(`CAREER INTELLIGENCE VALIDATION  v${val.version}  summary=`, JSON.stringify(val.summary));
    console.log('='.repeat(72));
    for (const area of val.areas) {
      const meas = area.measurable == null ? '' : `  measurable=${area.measurable}`;
      console.log(`\n[${String(area.status).toUpperCase().padEnd(4)}] ${area.id}${meas}  — ${area.label}`);
      for (const c of area.checks) {
        console.log(`    · ${String(c.status).toUpperCase().padEnd(4)} ${c.label}: ${c.detail}`);
      }
      for (const n of area.notes ?? []) console.log(`    note: ${n}`);
    }
    const counts = val.areas.reduce((a: Record<string, number>, x) => { a[x.status] = (a[x.status] ?? 0) + 1; return a; }, {});
    console.log('\nAREA STATUS COUNTS:', JSON.stringify(counts));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
