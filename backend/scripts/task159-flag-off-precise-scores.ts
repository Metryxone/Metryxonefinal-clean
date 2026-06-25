/**
 * Task #159 — flag-OFF proof for the candidate precise-scores surface.
 *
 * task144-e2e-precise-scores.ts proves the flag-ON path (the Backend API
 * workflow always runs with FF_COMPETENCY_RUNTIME=1, so it can only ever
 * exercise flag-ON). This test is its byte-identical-OFF counterpart: it
 * mounts the SAME real router (registerCompetencyAssessmentRuntime) on a
 * throwaway in-process Express app with the competencyRuntime flag forced
 * OFF, then drives the two flag-gated endpoints over real HTTP and asserts
 * the additive surface is fully hidden:
 *
 *   1. POST /api/competency/run-assessment — the response MUST NOT carry a
 *      `precise` key at all (the bridge never runs; flag-OFF is byte-identical
 *      to the legacy payload). The plain scores still persist.
 *   2. GET  /api/competency/precise-scores — MUST return
 *      { enabled:false, hasPrecise:false, precise:[], domains:[] } and never
 *      resolve a subject or surface any score.
 *
 * Why in-process instead of hitting the live workflow: the live Backend API
 * runs with the flag ON, so it can never demonstrate the OFF contract. We set
 * FF_COMPETENCY_RUNTIME=0 in THIS process (isFlagEnabled reads process.env at
 * call time) and assert the flag really is OFF first, so the test is a real
 * gate proof, not a tautology.
 *
 * Self-cleaning: uses an @example.com user_id and DELETEs every row it creates
 * (cra_scores, cra_profiles, onto_competency_score_runs) before AND after, and
 * additionally asserts NO precise run leaked into onto_competency_score_runs.
 *
 * Run: npx tsx backend/scripts/task159-flag-off-precise-scores.ts
 */

// Force the flag OFF for THIS process BEFORE any handler reads it. isFlagEnabled
// resolves FF_COMPETENCY_RUNTIME live (not at import), so this fully disables it
// even if the ambient shell exported FF_COMPETENCY_RUNTIME=1.
process.env.FF_COMPETENCY_RUNTIME = '0';

import express from 'express';
import type { AddressInfo } from 'net';
import { Pool } from 'pg';
import { registerCompetencyAssessmentRuntime } from '../routes/competency-assessment-runtime.js';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';

const EMAIL = 'task159-flagoff@example.com';

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

async function cleanup(pool: Pool) {
  // onto ledger keyed by email subject; cra_* keyed by our user_id (== EMAIL here).
  await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM cra_scores WHERE user_id = $1`, [EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM cra_profiles WHERE user_id = $1`, [EMAIL]).catch(() => {});
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Honest gate proof: this whole test is meaningless unless the flag is really OFF.
  assert(isCompetencyRuntimeEnabled() === false, 'competencyRuntime flag is OFF for this process (not a tautology)');

  // Minimal app: the real router + a fake auth that injects a fixed candidate
  // identity (username == email so any subject resolution would use the email).
  const app = express();
  app.use(express.json());
  const requireAuth = (req: any, _res: any, next: any) => {
    req.user = { id: EMAIL, username: EMAIL };
    next();
  };
  registerCompetencyAssessmentRuntime({ app, pool, requireAuth });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const BASE = `http://127.0.0.1:${port}`;

  try {
    await cleanup(pool); // clean slate (idempotent re-runs)

    // 1) Submit a real assessment with the flag OFF. Mapped CRA codes that WOULD
    //    become precise scores when ON — proving they do NOT when OFF.
    const scores = [
      { competencyCode: 'COG01', rawScore: 82, confidence: 0.9 }, // -> comp_critical_thinking (ON only)
      { competencyCode: 'COG02', rawScore: 55, confidence: 0.8 }, // -> comp_problem_solving    (ON only)
      { competencyCode: 'EIQ05', rawScore: 30, confidence: 0.7 }, // -> comp_conflict_resolution(ON only)
    ];
    const run = await fetch(`${BASE}/api/competency/run-assessment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scores }),
    });
    const runBody = await run.json().catch(() => ({}));
    assert(run.ok, `POST run-assessment accepted with flag OFF (HTTP ${run.status})`);
    assert(runBody?.data?.saved === scores.length, `plain scores still persist (saved=${runBody?.data?.saved})`);
    // The byte-identical-OFF contract: NO `precise` key at all (not false, ABSENT).
    assert(
      runBody?.data && !('precise' in runBody.data),
      `run-assessment response has NO 'precise' key (got keys: ${Object.keys(runBody?.data ?? {}).join(',')})`,
    );

    // 2) Read precise-scores with the flag OFF — the surface is fully hidden.
    const ps = await fetch(`${BASE}/api/competency/precise-scores`);
    const psBody = await ps.json().catch(() => ({}));
    assert(ps.ok, `GET precise-scores returned with flag OFF (HTTP ${ps.status})`);
    assert(psBody?.enabled === false, `precise-scores enabled=false (got ${psBody?.enabled})`);
    assert(psBody?.hasPrecise === false, `hasPrecise=false (got ${psBody?.hasPrecise})`);
    assert(Array.isArray(psBody?.precise) && psBody.precise.length === 0, `precise:[] empty (got ${JSON.stringify(psBody?.precise)})`);
    assert(Array.isArray(psBody?.domains) && psBody.domains.length === 0, `domains:[] empty (got ${JSON.stringify(psBody?.domains)})`);
    // Flag-OFF must short-circuit BEFORE subject resolution: no resolver leak.
    assert(!('resolved' in psBody) && !('overall' in psBody), 'no subject/overall leaked from the resolver when OFF');

    // 3) Honesty: flag-OFF must NOT have written any precise run to the ledger.
    const leak = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM onto_competency_score_runs WHERE subject_id = $1`,
      [EMAIL],
    );
    assert(Number(leak.rows[0]?.n ?? '0') === 0, `no precise run leaked into onto_competency_score_runs (got ${leak.rows[0]?.n})`);
  } finally {
    await cleanup(pool);
    server.close();
    await pool.end();
  }

  console.log(failures === 0 ? '\nFLAG-OFF: ALL PASS' : `\nFLAG-OFF: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
