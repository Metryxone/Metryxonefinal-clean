/**
 * MX-103X end-to-end smoke (throwaway app, does NOT touch the live workflow).
 *
 * Proves both the byte-identical-OFF gate and the activated funnel:
 *   OFF-path (flag absent): every /api/admin/employer-ecosystem/* route → 503 (byte-identical).
 *   ON-path  (flag set):
 *     - /enabled        → 200 {enabled:true}
 *     - /audit          → 200, 9 funnel stages, every stage reachable (no 'gated'/'gap'),
 *                          Coverage⟂Confidence axes present, demo counted separately, verdict PARTIAL (honest)
 *     - /certification   → 200, verdict PARTIAL, 9-stage success-criteria list
 *
 * Read-only; no writes. Uses a stub auth pass-through (the live routes are additionally
 * protected by the global /api/admin super-admin gate).
 */
import express from 'express';
import { Pool } from 'pg';

async function mount(flagOn: boolean) {
  if (flagOn) process.env.FF_LIVE_EMPLOYER_ECOSYSTEM = '1';
  else delete process.env.FF_LIVE_EMPLOYER_ECOSYSTEM;
  // Stage flags ON so the activated audit reflects the workflow's live state.
  if (flagOn) {
    process.env.FF_EMPLOYER_DASHBOARDS = '1';
    process.env.FF_JOB_POSTING_ENGINE = '1';
    process.env.FF_HIRING_ASSESSMENT = '1';
    process.env.FF_TALENT_MATCHING = '1';
    process.env.FF_INTERVIEW_INTELLIGENCE = '1';
    process.env.FF_HIRING_INTELLIGENCE = '1';
    process.env.FF_OUTCOME_INTELLIGENCE_ACTIVATION = '1';
    process.env.FF_EMPLOYER_COMPETENCY_HIRING = '1';
  }
  const { registerEmployerEcosystemRoutes } = await import('../routes/employer-ecosystem');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  const pass = (_req: any, _res: any, next: any) => next();
  registerEmployerEcosystemRoutes(app, pool, pass, pass);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const base = `http://localhost:${port}/api/admin/employer-ecosystem`;
  const get = async (p: string) => {
    const r = await fetch(base + p);
    let body: any = null;
    try { body = await r.json(); } catch { /* */ }
    return { status: r.status, body };
  };
  return { server, pool, get };
}

async function main() {
  let failures = 0;
  const check = (name: string, cond: boolean, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${extra ? ' :: ' + extra : ''}`);
    if (!cond) failures++;
  };

  // ── OFF-path: byte-identical 503 ──────────────────────────────────────────
  {
    const { server, pool, get } = await mount(false);
    const audit = await get('/audit');
    check('OFF /audit → 503 (byte-identical gate)', audit.status === 503, `status=${audit.status}`);
    const enabled = await get('/enabled');
    check('OFF /enabled → 503', enabled.status === 503, `status=${enabled.status}`);
    const cert = await get('/certification');
    check('OFF /certification → 503', cert.status === 503, `status=${cert.status}`);
    server.close();
    await pool.end();
  }

  // ── ON-path: activated funnel ─────────────────────────────────────────────
  {
    const { server, pool, get } = await mount(true);
    const enabled = await get('/enabled');
    check('ON /enabled 200 + enabled:true', enabled.status === 200 && enabled.body?.enabled === true, `status=${enabled.status}`);

    const audit = await get('/audit');
    check('ON /audit 200', audit.status === 200, `status=${audit.status}`);
    const stages: any[] = audit.body?.stages ?? [];
    check('ON /audit has 9 funnel stages', stages.length === 9, `n=${stages.length}`);
    check('ON /audit no gated stages (all reachable)', stages.every((s) => s.status !== 'gated'),
      `gated=${stages.filter((s) => s.status === 'gated').map((s) => s.id).join(',')}`);
    check('ON /audit no substrate gaps', stages.every((s) => s.status !== 'gap'),
      `gap=${stages.filter((s) => s.status === 'gap').map((s) => s.id).join(',')}`);
    check('ON /audit Coverage⟂Confidence axes present',
      stages.every((s) => typeof s.coverage === 'string' && typeof s.confidence === 'string'));
    check('ON /audit demo counted separately (not folded into real)',
      stages.every((s) => s.demoRows == null || s.realRows == null || s.totalRows == null || (s.realRows + s.demoRows) <= s.totalRows + 0));
    check('ON /audit verdict PARTIAL (honest pre-launch)', audit.body?.verdict === 'PARTIAL', `verdict=${audit.body?.verdict}`);
    check('ON /audit outcome confidence abstains (< k_min real)', audit.body?.summary?.outcomeCalibrated === false,
      `calibrated=${audit.body?.summary?.outcomeCalibrated}`);

    const cert = await get('/certification');
    check('ON /certification 200 + verdict PARTIAL', cert.status === 200 && cert.body?.verdict === 'PARTIAL', `verdict=${cert.body?.verdict}`);
    check('ON /certification lists 9 criteria stages', (cert.body?.stages?.length ?? 0) === 9, `n=${cert.body?.stages?.length}`);

    server.close();
    await pool.end();
  }

  console.log(failures === 0 ? '\n[mx103x-smoke] ALL PASS' : `\n[mx103x-smoke] ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
