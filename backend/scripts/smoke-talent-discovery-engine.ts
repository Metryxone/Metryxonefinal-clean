/**
 * Smoke test for Phase 5.4 Talent Discovery Engine.
 * Seeds a few demo employer_candidates (@example.com), exercises search / filter /
 * segmentation / pools / shortlists / saved-searches in-process against the live
 * DB, then CLEANS UP every demo row it created (cascades remove members).
 * Usage: cd backend && FF_TALENT_DISCOVERY=1 npx tsx scripts/smoke-talent-discovery-engine.ts
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  searchCandidates,
  getCandidate,
  segmentCandidates,
  createPool,
  listPools,
  getPool,
  addToPool,
  removeFromPool,
  deletePool,
  createShortlist,
  listShortlists,
  getShortlist,
  addToShortlist,
  setShortlistMemberStatus,
  removeFromShortlist,
  deleteShortlist,
  createSavedSearch,
  listSavedSearches,
  runSavedSearch,
  deleteSavedSearch,
} from '../services/talent-discovery-engine.js';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let pass = 0, fail = 0;
  const candIds: string[] = [];
  const poolIds: string[] = [];
  const slIds: string[] = [];
  const ssIds: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    if (ok) { pass++; console.log(`  PASS ${name}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };

  const su = await pool.query(`SELECT id, role FROM users WHERE role='super_admin' ORDER BY created_at LIMIT 1`);
  const actor = { id: su.rows[0]?.id as string, role: su.rows[0]?.role ?? 'super_admin' };
  check('super-admin actor resolved', !!actor.id, JSON.stringify(actor));

  try {
    // ── seed demo candidates (@example.com) ──────────────────────────────────
    const seed = [
      { name: 'SMOKE Alice', role: 'Backend Engineer', loc: 'Bangalore', stage: 'applied', ei: 82, match: 90, rating: 5, skills: ['python', 'sql'], source: 'Demo Seed' },
      { name: 'SMOKE Bob', role: 'Backend Engineer', loc: 'Pune', stage: 'screening', ei: 64, match: 70, rating: 3, skills: ['java', 'sql'], source: 'Demo Seed' },
      { name: 'SMOKE Carol', role: 'Data Scientist', loc: 'Bangalore', stage: 'applied', ei: 45, match: 55, rating: 2, skills: ['python', 'ml'], source: 'Demo Seed' },
    ];
    for (const s of seed) {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO employer_candidates (id, employer_id, name, email, location, candidate_role, stage, ei_score, match_score, rating, skills, source, created_at, updated_at)
         VALUES ($1,'demo-emp',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11, now(), now())`,
        [id, s.name, `${s.name.replace(/\s+/g, '.').toLowerCase()}@example.com`, s.loc, s.role, s.stage, s.ei, s.match, s.rating, JSON.stringify(s.skills), s.source],
      );
      candIds.push(id);
    }
    check('seeded 3 demo candidates', candIds.length === 3);

    // ── candidate_search_engine: search + filter ─────────────────────────────
    const byText = await searchCandidates(pool, { q: 'SMOKE' });
    check('search q=SMOKE finds >=3', byText.ok && byText.data.total >= 3, JSON.stringify(byText.ok && byText.data.total));
    const byRole = await searchCandidates(pool, { role: 'Backend Engineer', q: 'SMOKE' });
    check('filter role=Backend -> exactly 2', byRole.ok && byRole.data.candidates.length === 2, JSON.stringify(byRole.ok && byRole.data.candidates.map((c: any) => c.name)));
    const byEi = await searchCandidates(pool, { q: 'SMOKE', minEi: 80 });
    check('filter minEi=80 -> exactly 1 (Alice)', byEi.ok && byEi.data.candidates.length === 1 && byEi.data.candidates[0].name === 'SMOKE Alice', JSON.stringify(byEi));
    const bySkill = await searchCandidates(pool, { q: 'SMOKE', skills: ['python', 'sql'] });
    check('filter skills=[python,sql] (contains-all) -> 1 (Alice)', bySkill.ok && bySkill.data.candidates.length === 1 && bySkill.data.candidates[0].name === 'SMOKE Alice', JSON.stringify(bySkill.ok && bySkill.data.candidates.map((c: any) => c.name)));
    const sorted = await searchCandidates(pool, { q: 'SMOKE', sort: 'ei_score', dir: 'desc', limit: 2 });
    check('sort ei_score desc + limit=2', sorted.ok && sorted.data.candidates.length === 2 && sorted.data.candidates[0].name === 'SMOKE Alice', JSON.stringify(sorted));
    const one = await getCandidate(pool, candIds[0]);
    check('getCandidate by id', one.ok && one.data.id === candIds[0], '');
    const noCand = await getCandidate(pool, '00000000-0000-0000-0000-000000000000');
    check('getCandidate unknown -> not_found', !noCand.ok && noCand.code === 'not_found', '');

    // ── talent_discovery_engine: segmentation ────────────────────────────────
    const segRole = await segmentCandidates(pool, 'role', { q: 'SMOKE' });
    const backendBucket = segRole.ok ? segRole.data.segments.find((s: any) => s.bucket === 'Backend Engineer') : null;
    check('segment by role -> Backend Engineer count=2', !!backendBucket && backendBucket.count === 2, JSON.stringify(segRole));
    const segBand = await segmentCandidates(pool, 'ei_band', { q: 'SMOKE' });
    check('segment by ei_band returns buckets', segBand.ok && segBand.data.segments.length >= 1, JSON.stringify(segBand));
    const segBad = await segmentCandidates(pool, 'eye_color', {});
    check('segment unknown dimension -> invalid_input', !segBad.ok && segBad.code === 'invalid_input', JSON.stringify(segBad));

    // ── talent_pools ──────────────────────────────────────────────────────────
    const p = await createPool(pool, actor, { name: 'SMOKE Pool', description: 'demo' });
    check('createPool', p.ok && !!p.data.id && p.data.created_by === actor.id, JSON.stringify(p));
    const pid = p.ok ? p.data.id : '';
    if (pid) poolIds.push(pid);
    const addP = await addToPool(pool, actor, pid, [candIds[0], candIds[1]]);
    check('addToPool 2 members', addP.ok && addP.data.member_count === 2, JSON.stringify(addP));
    const reAddP = await addToPool(pool, actor, pid, [candIds[0]]);
    check('addToPool idempotent (no dupe)', reAddP.ok && reAddP.data.member_count === 2, JSON.stringify(reAddP));
    const phantom = await addToPool(pool, actor, pid, ['no-such-candidate']);
    check('addToPool phantom id -> invalid_input (no phantom members)', !phantom.ok && phantom.code === 'invalid_input', JSON.stringify(phantom));
    const getP = await getPool(pool, pid);
    check('getPool embeds members with candidate detail', getP.ok && getP.data.members.length === 2 && getP.data.members.every((m: any) => !!m.name), JSON.stringify(getP.ok && getP.data.members.map((m: any) => m.name)));
    const rmP = await removeFromPool(pool, pid, candIds[1]);
    check('removeFromPool', rmP.ok, JSON.stringify(rmP));
    const rmMissing = await removeFromPool(pool, pid, candIds[1]);
    check('removeFromPool already-gone -> not_found', !rmMissing.ok && rmMissing.code === 'not_found', '');
    const listP = await listPools(pool);
    check('listPools includes demo with member_count', listP.ok && listP.data.pools.some((x: any) => x.id === pid && Number(x.member_count) === 1), '');

    // ── shortlists ────────────────────────────────────────────────────────────
    const sl = await createShortlist(pool, actor, { name: 'SMOKE Shortlist', jobId: 'demo-job' });
    check('createShortlist', sl.ok && !!sl.data.id, JSON.stringify(sl));
    const sid = sl.ok ? sl.data.id : '';
    if (sid) slIds.push(sid);
    const addSl = await addToShortlist(pool, actor, sid, [candIds[0], candIds[2]]);
    check('addToShortlist 2 members', addSl.ok && addSl.data.member_count === 2, JSON.stringify(addSl));
    const statusSl = await setShortlistMemberStatus(pool, sid, candIds[0], 'interview');
    check('setShortlistMemberStatus -> interview', statusSl.ok && statusSl.data.status === 'interview', JSON.stringify(statusSl));
    const getSl = await getShortlist(pool, sid);
    check('getShortlist embeds members + status', getSl.ok && getSl.data.members.length === 2 && getSl.data.members.some((m: any) => m.status === 'interview'), JSON.stringify(getSl.ok && getSl.data.members.map((m: any) => [m.name, m.status])));
    const rmSl = await removeFromShortlist(pool, sid, candIds[2]);
    check('removeFromShortlist', rmSl.ok, JSON.stringify(rmSl));
    const listSl = await listShortlists(pool);
    check('listShortlists includes demo', listSl.ok && listSl.data.shortlists.some((x: any) => x.id === sid), '');

    // ── saved searches ──────────────────────────────────────────────────────
    const ss = await createSavedSearch(pool, actor, { name: 'SMOKE Saved', filters: { q: 'SMOKE', role: 'Backend Engineer' } });
    check('createSavedSearch', ss.ok && !!ss.data.id, JSON.stringify(ss));
    const ssid = ss.ok ? ss.data.id : '';
    if (ssid) ssIds.push(ssid);
    const runSs = await runSavedSearch(pool, ssid);
    check('runSavedSearch applies stored filters -> 2 backend', runSs.ok && runSs.data.candidates.length === 2, JSON.stringify(runSs.ok && runSs.data.candidates.map((c: any) => c.name)));
    const runSsOverride = await runSavedSearch(pool, ssid, { minEi: 80 });
    check('runSavedSearch with override narrows to 1', runSsOverride.ok && runSsOverride.data.candidates.length === 1, JSON.stringify(runSsOverride));
    const listSs = await listSavedSearches(pool);
    check('listSavedSearches includes demo', listSs.ok && listSs.data.saved_searches.some((x: any) => x.id === ssid), '');
    const runNoSs = await runSavedSearch(pool, '00000000-0000-0000-0000-000000000000');
    check('runSavedSearch unknown -> not_found', !runNoSs.ok && runNoSs.code === 'not_found', '');

    // ── cascade: deleting a candidate removes its memberships ────────────────
    await pool.query(`DELETE FROM employer_candidates WHERE id = $1`, [candIds[0]]);
    const afterCascade = await getPool(pool, pid);
    check('FK cascade: deleted candidate removed from pool', afterCascade.ok && !afterCascade.data.members.some((m: any) => m.candidate_id === candIds[0]), '');
    candIds.shift(); // already deleted

    // ── HTTP flag-OFF guard (server has FF OFF by default) ───────────────────
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r = await fetch(`${base}/api/talent-discovery-engine/candidates`);
      check('HTTP /candidates flag-gated 503 (server flag OFF)', r.status === 503, `got ${r.status}`);
      const r2 = await fetch(`${base}/api/talent-discovery-engine/_meta/status`);
      check('HTTP /_meta/status flag-gated 503', r2.status === 503, `got ${r2.status}`);
    } catch (e: any) {
      console.log('  SKIP HTTP flag-OFF guard (server unreachable):', e?.message ?? e);
    }
  } catch (e: any) {
    fail++;
    console.log('  FAIL engine threw:', e?.message ?? e);
  } finally {
    for (const id of ssIds) { try { await deleteSavedSearch(pool, id); } catch {} }
    for (const id of slIds) { try { await deleteShortlist(pool, id); } catch {} }
    for (const id of poolIds) { try { await deletePool(pool, id); } catch {} }
    for (const id of candIds) { try { await pool.query(`DELETE FROM employer_candidates WHERE id = $1`, [id]); } catch {} }
    console.log(`  cleanup: removed demo saved-searches/shortlists/pools/candidates`);
    await pool.end();
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
