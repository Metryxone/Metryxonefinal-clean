/**
 * smoke-ei-profile-v2.ts — Phase 3.4 + 3.5 smoke test.
 *
 * Run: npx tsx backend/scripts/smoke-ei-profile-v2.ts [subjectId]
 *
 * Exercises buildEiProfile, the history round-trip, and computeRoleReadinessV2
 * against the live DB. Cleans up its own demo snapshot row afterward.
 */
import { Pool } from 'pg';
import { buildEiProfile } from '../services/ei-profile-engine.js';
import {
  persistEiProfile,
  listEiProfileHistory,
  getEiProfileSnapshot,
} from '../services/ei-profile-history.js';
import { computeRoleReadinessV2 } from '../services/role-readiness-v2.js';

async function main() {
  const subjectId = process.argv[2] ?? 'demo_subj_swe';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log(`\n=== Phase 3.4 buildEiProfile(${subjectId}) ===`);
    const profile = await buildEiProfile(pool, subjectId);
    console.log(JSON.stringify({
      version: profile.version,
      measurable: profile.measurable,
      overall_ei: profile.overall_ei,
      confidence: profile.confidence,
      dimension_scores: profile.dimension_scores?.length,
      strength_areas: profile.strength_areas?.length,
      development_areas: profile.development_areas?.length,
      critical_risks: profile.critical_risks?.length,
      growth_potential: profile.growth_potential,
      notes: profile.notes,
    }, null, 2));

    console.log(`\n=== Phase 3.4 history round-trip ===`);
    const snap = await persistEiProfile(pool, profile, 'smoke@example.com');
    console.log('persisted snapshot id:', snap.id, 'ei_score:', snap.ei_score, 'measurable:', snap.measurable);
    const hist = await listEiProfileHistory(pool, subjectId);
    console.log('history rows:', hist.length);
    const fetched = await getEiProfileSnapshot(pool, snap.id);
    console.log('fetched snapshot has profile JSON:', !!fetched?.profile, 'version:', fetched?.profile?.version);

    console.log(`\n=== Phase 3.5 computeRoleReadinessV2(${subjectId}) ===`);
    const v2 = await computeRoleReadinessV2(pool, subjectId);
    console.log(JSON.stringify({
      measurable: v2.measurable,
      role_id: v2.role_id,
      role_title: v2.role_title,
      readiness: v2.readiness,
      role_match: v2.role_match,
      role_gap_top: v2.role_gap.top_gap,
      role_gap_areas: v2.role_gap.gap_areas?.length,
      role_risk: { level: v2.role_risk.level, score: v2.role_risk.score, factors: v2.role_risk.factors?.length },
      role_potential: { level: v2.role_potential.level, score: v2.role_potential.score, factors: v2.role_potential.factors?.length },
      ei_profile_summary: v2.ei_profile_summary,
      notes: v2.notes,
    }, null, 2));

    console.log(`\n=== cleanup demo snapshot rows ===`);
    const del = await pool.query(
      `DELETE FROM ei_profile_snapshots WHERE captured_by = 'smoke@example.com' OR subject_id = $1`,
      [subjectId],
    );
    console.log('deleted rows:', del.rowCount);

    console.log('\nSMOKE OK');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
