/**
 * Career Graph Recommendations Backfill
 * ─────────────────────────────────────
 * Generates ranked role recommendations + skill gaps + role readiness for every
 * user who has a career profile (career_seeker_profiles). Mirrors the exact
 * orchestration of GET /api/career/recommendations so the persisted output is
 * identical to what a logged-in user would trigger on first visit.
 *
 *   buildGraphCache → resolveCurrentRole → (per neighbour) computeSkillGaps +
 *   computeReadiness → generateRecommendations (persists cg_user_recommendations,
 *   cg_user_skill_gaps, cg_user_role_readiness).
 *
 * Idempotent — engines upsert per (user, role). Chunked + observable.
 *
 * Usage:  cd backend && npx tsx scripts/career-recs-backfill.ts [--chunk=5] [--dry-run]
 */
import { Pool } from 'pg';
import { getRoleById, buildGraphCache } from '../services/career-graph-engine';
import type { CgRole } from '../services/career-graph-engine';
import { computeSkillGaps } from '../services/career-skill-gap-engine';
import { computeReadiness } from '../services/career-readiness-engine';
import { generateRecommendations } from '../services/career-recommendation-engine';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const chunkArg = args.find(a => a.startsWith('--chunk='));
const chunkSize = chunkArg ? parseInt(chunkArg.replace('--chunk=', ''), 10) : 5;

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

/** Same resolution priority as the route handler (saved path → profile → anchor). */
async function resolveCurrentRoleForUser(userId: string): Promise<CgRole | null> {
  const pathRes = await pool.query(
    `SELECT from_role_id FROM cg_user_career_path
       WHERE user_id = $1 AND from_role_id IS NOT NULL
       ORDER BY saved_at DESC LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as { from_role_id: number }[] }));
  if (pathRes.rows[0]?.from_role_id) {
    const r = await getRoleById(pool, Number(pathRes.rows[0].from_role_id));
    if (r) return r;
  }

  const profRes = await pool.query(
    `SELECT data->>'currentRole' AS cr FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as { cr: string | null }[] }));
  const crTitle = profRes.rows[0]?.cr ?? null;
  if (crTitle) {
    const roleRes = await pool.query(
      `SELECT id FROM cg_roles WHERE LOWER(title) = LOWER($1) AND is_active LIMIT 1`,
      [crTitle],
    ).catch(() => ({ rows: [] as { id: number }[] }));
    if (roleRes.rows[0]) {
      const r = await getRoleById(pool, Number(roleRes.rows[0].id));
      if (r) return r;
    }
  }

  const anchorRes = await pool.query(
    `SELECT id FROM cg_roles WHERE is_active ORDER BY demand_score DESC LIMIT 1`,
  ).catch(() => ({ rows: [] as { id: number }[] }));
  if (anchorRes.rows[0]) return getRoleById(pool, Number(anchorRes.rows[0].id));
  return null;
}

async function generateForUser(
  userId: string,
  g: Awaited<ReturnType<typeof buildGraphCache>>,
): Promise<{ recs: number; gaps: number } | null> {
  const currentRole = await resolveCurrentRoleForUser(userId);

  const readinessMap = new Map<number, Awaited<ReturnType<typeof computeReadiness>>>();
  if (currentRole) {
    const neighbours = g.adjacency.get(currentRole.id) ?? [];
    const neighbourIds = neighbours.slice(0, 12).map(e => e.to_role_id);
    for (const nid of neighbourIds) {
      const gap = await computeSkillGaps(pool, userId, nid);
      const r = await computeReadiness(pool, userId, nid, gap);
      readinessMap.set(nid, r);
    }
  }

  const bundle = await generateRecommendations(pool, userId, currentRole, g, readinessMap);
  const recs = Array.isArray((bundle as { recommendations?: unknown[] }).recommendations)
    ? (bundle as { recommendations: unknown[] }).recommendations.length
    : 0;
  return { recs, gaps: readinessMap.size };
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Career Graph Recommendations Backfill');
  console.log('══════════════════════════════════════════');
  console.log(`  Mode:       ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Chunk size: ${chunkSize}`);
  console.log(`  Started:    ${new Date().toISOString()}`);
  console.log('──────────────────────────────────────────\n');

  const before = {
    recs: await pool.query('SELECT COUNT(*) FROM cg_user_recommendations').then(r => Number(r.rows[0].count)).catch(() => 0),
    gaps: await pool.query('SELECT COUNT(*) FROM cg_user_skill_gaps').then(r => Number(r.rows[0].count)).catch(() => 0),
    readiness: await pool.query('SELECT COUNT(*) FROM cg_user_role_readiness').then(r => Number(r.rows[0].count)).catch(() => 0),
  };
  console.log('Before counts:');
  console.log(`  cg_user_recommendations: ${before.recs}`);
  console.log(`  cg_user_skill_gaps:      ${before.gaps}`);
  console.log(`  cg_user_role_readiness:  ${before.readiness}\n`);

  const usersRes = await pool.query(
    `SELECT DISTINCT user_id FROM career_seeker_profiles WHERE user_id IS NOT NULL ORDER BY user_id`,
  );
  const userIds = usersRes.rows.map((r: { user_id: string }) => String(r.user_id));
  console.log(`Eligible users (have career profiles): ${userIds.length}`);

  if (dryRun) {
    console.log('\nDRY RUN: would process', userIds.length, 'users');
    await pool.end();
    return;
  }
  if (userIds.length === 0) { console.log('No eligible users.'); await pool.end(); return; }

  const g = await buildGraphCache(pool);

  let ok = 0, failed = 0, done = 0;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async uid => {
      try {
        await generateForUser(uid, g);
        ok++;
      } catch (e) {
        failed++;
        console.warn('\n[career-recs] user', uid, (e as Error).message);
      } finally {
        done++;
        const pct = Math.round((done / userIds.length) * 100);
        process.stdout.write(`\r  Progress: ${done}/${userIds.length} (${pct}%) `);
      }
    }));
  }
  console.log('\n');

  const after = {
    recs: await pool.query('SELECT COUNT(*) FROM cg_user_recommendations').then(r => Number(r.rows[0].count)).catch(() => 0),
    gaps: await pool.query('SELECT COUNT(*) FROM cg_user_skill_gaps').then(r => Number(r.rows[0].count)).catch(() => 0),
    readiness: await pool.query('SELECT COUNT(*) FROM cg_user_role_readiness').then(r => Number(r.rows[0].count)).catch(() => 0),
  };
  const usersWithRecs = await pool.query('SELECT COUNT(DISTINCT user_id) FROM cg_user_recommendations').then(r => Number(r.rows[0].count)).catch(() => 0);

  console.log('══════════════════════════════════════════');
  console.log('  Backfill Results');
  console.log('══════════════════════════════════════════');
  console.log(`  Users processed: ${userIds.length}   ✓ ok: ${ok}   ✗ failed: ${failed}`);
  console.log(`  Users with recommendations: ${usersWithRecs}\n`);
  console.log('After counts (vs before):');
  console.log(`  cg_user_recommendations: ${before.recs} → ${after.recs}  (+${after.recs - before.recs})`);
  console.log(`  cg_user_skill_gaps:      ${before.gaps} → ${after.gaps}  (+${after.gaps - before.gaps})`);
  console.log(`  cg_user_role_readiness:  ${before.readiness} → ${after.readiness}  (+${after.readiness - before.readiness})`);
  console.log(`\n  Completed: ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════\n');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
