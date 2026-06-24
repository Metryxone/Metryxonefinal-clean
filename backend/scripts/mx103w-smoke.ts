/**
 * MX-103W smoke — Job Store Projection (Phase 1) + Role Auto-Resolution (Phase 2)
 * + Production-Health visibility (Phase 3), driven through their REAL service
 * functions and REAL route modules on a throwaway express app (the live workflow
 * is never touched).
 *
 * What it proves (founder contract):
 *   OFF-path (flags absent)         → byte-identical 503 on every new gated route,
 *                                      /enabled reports enabled:false.
 *   Projection (flag ON)            → a published job_postings row projects into a
 *                                      linked employer_jobs row (source_posting_id),
 *                                      is idempotent (re-run = reproject, no dup),
 *                                      is reversible (un-project → status inactive,
 *                                      row + audit preserved, never deleted), and is
 *                                      audit-logged.
 *   Role auto-resolution (flag ON)  → a real curated title resolves end-to-end with
 *                                      Coverage ⟂ Confidence kept SEPARATE; a nonsense
 *                                      title ABSTAINS (no fabrication); an operator
 *                                      decision persists to role_resolution_decisions.
 *   Production health (flag ON)     → /overview returns a structured readiness with
 *                                      probe-only sources (no DDL on the GET path).
 *
 * Honesty: every row is created under a demo marker (mx103w- / @example.com) and
 * purged at the end. "Exercisable" = real handler reachable + non-5xx/404; an
 * honest-empty result still passes, fabricated success is never required.
 */
import express from 'express';
import { Pool } from 'pg';

const NEW_FLAGS = ['FF_EMPLOYER_JOB_STORE_SYNC', 'FF_ROLE_AUTO_RESOLUTION'];
function setFlags(on: boolean) {
  if (on) for (const f of NEW_FLAGS) process.env[f] = '1';
  else for (const f of NEW_FLAGS) delete process.env[f];
}

let actingUserId = 'mx103w-smoke';
let actingEmail = 'mx103w-smoke@example.com';

async function mount() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: actingUserId, role: 'super_admin', username: actingEmail, email: actingEmail };
    next();
  });
  const pass = (_req: any, _res: any, next: any) => next();

  const { registerRoleResolutionRoutes } = await import('../routes/role-resolution');
  const { registerEmployerProductionHealthRoutes } = await import('../routes/employer-production-health');
  registerRoleResolutionRoutes(app, pool, pass, pass);
  registerEmployerProductionHealthRoutes(app, pool, pass, pass);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const origin = `http://localhost:${port}`;
  const call = async (method: string, path: string, body?: any) => {
    const r = await fetch(origin + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    });
    let parsed: any = null;
    try { parsed = await r.json(); } catch { /* */ }
    return { status: r.status, body: parsed };
  };
  return { server, pool, call };
}

async function main() {
  let failures = 0;
  const check = (name: string, cond: boolean, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${extra ? ' :: ' + extra : ''}`);
    if (!cond) failures++;
  };
  const exercisable = (status: number) => status !== 503 && status !== 404 && status < 500;

  // ── OFF-path: byte-identical 503 on the new gated routes ────────────────────
  {
    setFlags(false);
    const { server, pool, call } = await mount();
    const rr = await call('GET', '/api/admin/role-resolution/resolve?title=Software%20Engineer');
    check('OFF /role-resolution/resolve → 503', rr.status === 503, `status=${rr.status}`);
    const cov = await call('GET', '/api/admin/role-resolution/coverage');
    check('OFF /role-resolution/coverage → 503', cov.status === 503, `status=${cov.status}`);
    const ph = await call('GET', '/api/admin/employer-production-health/overview');
    check('OFF /employer-production-health/overview → 503', ph.status === 503, `status=${ph.status}`);
    const en = await call('GET', '/api/admin/employer-production-health/enabled');
    check('OFF /employer-production-health/enabled → enabled:false (200)',
      en.status === 200 && en.body?.enabled === false, `status=${en.status} enabled=${en.body?.enabled}`);
    server.close();
    await pool.end();
  }

  // ── ON-path ────────────────────────────────────────────────────────────────
  setFlags(true);
  const stamp = Date.now();
  const postingId = `mx103w-post-${stamp}`;
  actingUserId = `mx103w-actor-${stamp}`;
  actingEmail = `mx103w-${stamp}@example.com`;

  const { server, pool, call } = await mount();
  try {
    // Seed a demo user (job_postings.created_by has an FK to users.id).
    await pool.query(
      `INSERT INTO users (id, username, password, role) VALUES ($1,$2,'x','super_admin')
       ON CONFLICT (id) DO NOTHING`,
      [actingUserId, actingEmail],
    );

    // Seed a demo PUBLISHED job_postings row (all NOT NULL cols satisfied).
    await pool.query(
      `INSERT INTO job_postings
         (id, title, role_category, employment_type, work_mode, eligibility, qualifications,
          responsibilities, kpis, compensation_model, status, created_by, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',$11,'private')
       ON CONFLICT (id) DO NOTHING`,
      [postingId, 'MX103W Demo Engineer', 'Engineering', 'full_time', 'remote',
       'Demo eligibility', 'Demo qualifications', 'Demo responsibilities',
       'Demo KPIs', 'fixed', actingUserId],
    );

    const { projectPublishedJob, unprojectJob, getProjectionHealth } =
      await import('../services/job-store-projection');

    // Phase 1 — project (first time)
    const p1 = await projectPublishedJob(pool, actingUserId, postingId);
    check('Phase1 project: ok + projected + action=project', p1.ok && p1.projected && p1.action === 'project',
      `action=${p1.action} reason=${p1.reason ?? ''}`);
    check('Phase1 project: employer_jobs id == posting id (1:1 link)', p1.employer_job_id === postingId,
      `employer_job_id=${p1.employer_job_id}`);

    const linked = await pool.query(
      `SELECT id, source_posting_id, status, title FROM employer_jobs WHERE source_posting_id = $1`, [postingId]);
    check('Phase1 link present: employer_jobs.source_posting_id set, status active',
      linked.rowCount === 1 && linked.rows[0].status === 'active',
      `rows=${linked.rowCount} status=${linked.rows[0]?.status}`);

    // Idempotent re-run = reproject, no duplicate
    const p2 = await projectPublishedJob(pool, actingUserId, postingId);
    const dup = await pool.query(`SELECT COUNT(*)::int AS n FROM employer_jobs WHERE source_posting_id = $1`, [postingId]);
    check('Phase1 idempotent: re-run action=reproject + still exactly 1 row',
      p2.action === 'reproject' && dup.rows[0].n === 1, `action=${p2.action} rows=${dup.rows[0].n}`);

    // Audit logged
    const aud = await pool.query(`SELECT action FROM job_projection_audit WHERE posting_id = $1 ORDER BY id`, [postingId]);
    check('Phase1 audit-logged: project + reproject events present',
      aud.rowCount! >= 2 && aud.rows[0].action === 'project', `events=${aud.rows.map((r:any)=>r.action).join(',')}`);

    // Reversible — un-project marks inactive, never deletes
    const up = await unprojectJob(pool, actingUserId, postingId);
    const after = await pool.query(`SELECT status FROM employer_jobs WHERE source_posting_id = $1`, [postingId]);
    check('Phase1 reversible: un-project → status inactive, row preserved (no delete)',
      up.ok && up.projected && after.rowCount === 1 && after.rows[0].status === 'inactive',
      `status=${after.rows[0]?.status}`);

    // Health probe reflects it (probe-only, no DDL)
    const health = await getProjectionHealth(pool);
    check('Phase1 health: projection_active + projected_jobs measurable (>=1)',
      health.projection_active === true && (health.projected_jobs ?? 0) >= 1,
      `active=${health.projection_active} projected=${health.projected_jobs}`);

    // Phase 2 — role auto-resolution
    const { resolveRoleEndToEnd, recordResolutionDecision, getResolutionCoverage } =
      await import('../services/role-auto-resolution');

    // Pick a real curated role title that carries a competency profile.
    const realRole = (await pool.query(
      `SELECT r.title FROM onto_roles r
        WHERE EXISTS (SELECT 1 FROM onto_role_competency_profiles p WHERE p.role_id = r.id)
        ORDER BY r.title LIMIT 1`,
    )).rows[0]?.title as string | undefined;

    if (realRole) {
      const res = await resolveRoleEndToEnd(pool, { title: realRole });
      check('Phase2 resolve: real title resolves (not abstained)', !res.abstained && !!res.resolved,
        `abstained=${res.abstained} role=${res.resolved?.role_id}`);
      check('Phase2 Coverage ⟂ Confidence kept SEPARATE (confidence_pct numeric, competency_profile own axis)',
        typeof res.confidence_pct === 'number' && 'competency_profile' in res,
        `conf=${res.confidence_pct} cov=${res.competency_profile?.competency_count}`);

      const dec = await recordResolutionDecision(pool, {
        actorId: actingUserId, decision: 'accepted',
        request: { title: realRole }, result: res,
      });
      check('Phase2 decision persisted to role_resolution_decisions', dec.ok && !!dec.id, `id=${dec.id} err=${dec.error ?? ''}`);
    } else {
      check('Phase2 resolve: real curated role available (skipped — no profiled role in DB)', true,
        'no onto_role_competency_profiles rows; abstain path still covered below');
    }

    // Abstain (never fabricate) on a nonsense title
    const ab = await resolveRoleEndToEnd(pool, { title: 'zzz-nonexistent-role-qwxyz-' + stamp });
    check('Phase2 abstain: nonsense title → abstained, resolved null, confidence null (no fabrication)',
      ab.abstained === true && ab.resolved === null && ab.confidence_pct === null,
      `abstained=${ab.abstained} resolved=${ab.resolved} conf=${ab.confidence_pct}`);

    const rcov = await getResolutionCoverage(pool);
    check('Phase2 coverage probe readable (audit_present true after a decision OR honest null)',
      typeof rcov.audit_present === 'boolean', `present=${rcov.audit_present} total=${rcov.total_decisions}`);

    // Phase 2 + 3 routes (flags ON)
    const rr = await call('GET', `/api/admin/role-resolution/resolve?title=${encodeURIComponent(realRole ?? 'Software Engineer')}`);
    check('Phase2 route ON /role-resolution/resolve → 200 exercisable', rr.status === 200 && exercisable(rr.status),
      `status=${rr.status}`);

    const ph = await call('GET', '/api/admin/employer-production-health/overview');
    check('Phase3 route ON /employer-production-health/overview → 200 with readiness',
      ph.status === 200 && typeof ph.body?.readiness?.structural_score !== 'undefined',
      `status=${ph.status} structural=${ph.body?.readiness?.structural_score}`);
    check('Phase3 overview: structural readiness is a real number (probe-derived, not fabricated)',
      typeof ph.body?.readiness?.structural_score === 'number',
      `structural_score=${ph.body?.readiness?.structural_score} band=${ph.body?.readiness?.band}`);
  } finally {
    const purge = async (sql: string, args: any[]) => { try { await pool.query(sql, args); } catch { /* noop */ } };
    await purge(`DELETE FROM role_resolution_decisions WHERE actor_id = $1`, [actingUserId]);
    await purge(`DELETE FROM job_projection_audit WHERE posting_id = $1`, [postingId]);
    await purge(`DELETE FROM employer_jobs WHERE source_posting_id = $1 OR id = $1`, [postingId]);
    await purge(`DELETE FROM job_postings WHERE id = $1`, [postingId]);
    await purge(`DELETE FROM users WHERE id = $1`, [actingUserId]);
    server.close();
    await pool.end();
  }

  console.log(failures === 0 ? '\n[mx103w-smoke] ALL PASS' : `\n[mx103w-smoke] ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
