/**
 * Smoke test — Competency → Skill Intelligence (98X Gap Closure, Phase 5).
 *
 * Service-level (direct, flag-agnostic) + HTTP flag-OFF contract.
 *   npx tsx scripts/smoke-competency-skill-intelligence.ts
 *
 * Assumes the comp_skill_map seed has been applied (run scripts/seed-comp-skill-map.ts --apply
 * first). Asserts: seed dry-run is honest, chain resolves a mapped competency end-to-end,
 * UNCLASSIFIED competency yields honestly-empty downstream hops, unknown id is honest, coverage
 * reports, and the HTTP routes 503 when the flag is OFF.
 */
import { Pool } from 'pg';
import {
  seedCompSkillMap,
  resolveCompetencySkillChain,
  getCompetencySkillCoverage,
} from '../services/competency-skill-intelligence';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

async function httpFlagOff() {
  const base = process.env.SMOKE_BASE || 'http://localhost:8080';
  const paths = [
    '/api/v2/competency-skill/feature-flag',
    '/api/v2/competency-skill/_meta/versions',
    '/api/v2/competency-skill/coverage',
    '/api/v2/competency-skill/chain/onet_2_a_1_a',
  ];
  console.log('\n[HTTP] flag-OFF contract (expect 503 on every route):');
  for (const p of paths) {
    try {
      const r = await fetch(base + p);
      check(`${p} → 503`, r.status === 503, `(got ${r.status})`);
    } catch (e) {
      check(`${p} → reachable`, false, `(${(e as Error).message})`);
    }
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('[service] seed dry-run:');
    const dry = await seedCompSkillMap(pool, false);
    check('dry-run writes nothing', dry.apply === false && dry.note.includes('dry-run'));
    check('competencies counted', dry.competencies_total > 0, `(${dry.competencies_total})`);
    check('skills counted', dry.skills_total > 0, `(${dry.skills_total})`);
    check('matched ≤ total (honest)', dry.matched_competencies <= dry.competencies_total);
    check('unclassified accounted', dry.matched_competencies + dry.unclassified_competencies === dry.competencies_total);
    console.log(`    coverage=${dry.coverage_pct}% matched=${dry.matched_competencies} unclassified=${dry.unclassified_competencies}`);

    console.log('\n[service] coverage metric:');
    const cov = await getCompetencySkillCoverage(pool);
    check('coverage available (seed applied)', cov.available, '(run seed --apply first)');
    if (cov.available) {
      check('coverage_pct in 0..100', cov.coverage_pct >= 0 && cov.coverage_pct <= 100, `(${cov.coverage_pct})`);
      check('with_skill ≤ total', cov.competencies_with_skill <= cov.competencies_total);
      console.log(`    ${cov.competencies_with_skill}/${cov.competencies_total} = ${cov.coverage_pct}%`);
    }

    // Find one mapped competency + one UNCLASSIFIED competency from the live crosswalk.
    const mapped = await pool.query(
      `SELECT competency_id FROM comp_skill_map WHERE skill_key IS NOT NULL ORDER BY confidence DESC LIMIT 1`,
    ).then((r) => r.rows[0]?.competency_id as string | undefined).catch(() => undefined);
    const unclassified = await pool.query(
      `SELECT competency_id FROM comp_skill_map WHERE skill_key IS NULL LIMIT 1`,
    ).then((r) => r.rows[0]?.competency_id as string | undefined).catch(() => undefined);

    console.log('\n[service] chain — mapped competency:', mapped ?? '(none)');
    if (mapped) {
      const chain = await resolveCompetencySkillChain(pool, mapped);
      check('chain resolved', chain.resolved && chain.competency != null);
      check('skills hop available', chain.hops.skills.available);
      check('skills hop has ≥1 skill', chain.hops.skills.count >= 1, `(${chain.hops.skills.count})`);
      check('learning hop available', chain.hops.learning.available);
      check('certifications hop available', chain.hops.certifications.available);
      check('roles hop available', chain.hops.roles.available);
      check('career_paths hop available', chain.hops.career_paths.available);
      console.log(`    skills=${chain.hops.skills.count} learning=${chain.hops.learning.count} certs=${chain.hops.certifications.count} roles=${chain.hops.roles.count} paths=${chain.hops.career_paths.count}`);
    } else {
      console.log('    (no mapped competency — seed may be UNCLASSIFIED-heavy; honest if genome is abstract)');
    }

    console.log('\n[service] chain — UNCLASSIFIED competency:', unclassified ?? '(none)');
    if (unclassified) {
      const chain = await resolveCompetencySkillChain(pool, unclassified);
      check('UNCLASSIFIED resolves competency', chain.resolved);
      check('UNCLASSIFIED has 0 skills', chain.hops.skills.count === 0);
      check('UNCLASSIFIED downstream honestly empty', chain.hops.learning.count === 0 && chain.hops.roles.count === 0);
      check('UNCLASSIFIED hops still marked available', chain.hops.learning.available && chain.hops.roles.available);
    }

    console.log('\n[service] chain — unknown competency id:');
    const unknown = await resolveCompetencySkillChain(pool, 'definitely_not_a_real_competency_xyz');
    check('unknown is honest (resolved=false)', unknown.resolved === false && unknown.competency === null);
    check('unknown skills empty', unknown.hops.skills.count === 0);

    await httpFlagOff();
  } finally {
    await pool.end();
  }
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
