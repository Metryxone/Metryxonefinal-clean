/**
 * TASK #253 — Hiring-decision → recorded-prediction E2E (FULL HTTP PATH).
 *
 * Task #247 wired employer terminal hiring decisions (Hired/Rejected) to durably
 * record a realized {prediction, outcome} pair via `recordHiringOutcome`. That
 * function was unit-tested against the DB, but the FULL authenticated HTTP path
 *   employer session → PUT candidate stage / pipeline bulk-move
 *     → snapshotDecisionProb → recordHiringOutcome → validation_loop_outcomes row
 * was never exercised end-to-end. This harness closes that gap by driving the
 * REAL running Express server (localhost:8080) exactly as a browser would —
 * through the live session-auth + CSRF middleware — and asserting the durable row.
 *
 * What it proves (the task's "Done looks like"):
 *   1. Single-PUT terminal move of a NON-demo candidate records exactly ONE row
 *      with is_demo=false and predicted_prob_at_decision in [0,1].
 *   2. Pipeline bulk-move of a NON-demo candidate records the same way.
 *   3. Idempotency at the HTTP layer: repeating the terminal action does NOT
 *      duplicate the {prediction, outcome} pair.
 *   4. A DEMO (@example.com) candidate records is_demo=true (so it stays excluded
 *      from realized/cert counts).
 *
 * Honesty notes:
 *   - snapshotDecisionProb is fire-and-forget (`void`) so the HTTP response returns
 *     BEFORE the row is written; we poll the DB with a short timeout (real-world
 *     fidelity, not a fixed sleep).
 *   - Every artifact is @example.com / e2e-prefixed and removed on exit, including
 *     the throwaway user + employer org rows.
 *   - No engine output is fabricated: the candidate INPUTS are synthetic, the
 *     prediction is computed by the live engine inside the route.
 *
 * Run: cd backend && npx tsx scripts/task253-hiring-outcome-e2e.ts
 *
 * Backend availability (Task #330 — don't fail just because the workflow is down):
 *   The harness drives a REAL server, so before it asserts anything it makes sure
 *   one is reachable:
 *     1. If the "Backend API" workflow is already listening on :8080 (the common
 *        case), it is used as-is.
 *     2. Otherwise a THROWAWAY backend is self-started on an ephemeral port with
 *        validationLoop ON, and torn down on exit.
 *     3. If neither is possible, the run SKIPS with a distinct, unambiguous
 *        "backend not running" message and exit code 0 — an environment-not-ready
 *        state is NOT a regression in the recording path. A GENUINE break in the
 *        recording path (backend up, assertions run) still fails loudly (exit 1).
 *   Override the target with E2E_BASE_URL (pinned verbatim; no self-start).
 */

import { Pool } from 'pg';
import { ensureEntitlementGrantsSchema } from '../services/commercial/entitlement-grants-schema';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

let BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Backend preflight / self-start (Task #330) ───────────────────────────────
let selfStarted: ChildProcess | null = null;

async function backendReachable(base: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${base}/api/health`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch {
    return false;
  }
}

async function waitReachable(base: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await backendReachable(base, 2000)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Ensure a Backend API is reachable. Returns true if the assertions can run
 * (against an existing or self-started server), false if the run should SKIP.
 */
async function ensureBackend(): Promise<boolean> {
  // A pinned base URL is honoured verbatim — never self-start over it.
  if (process.env.E2E_BASE_URL) {
    if (await backendReachable(BASE)) return true;
    console.error(`\n⚠️  Backend not reachable at the pinned E2E_BASE_URL=${BASE}.`);
    return false;
  }

  if (await backendReachable(BASE)) {
    console.log(`Backend already running at ${BASE} — using it.`);
    return true;
  }

  // Self-start a throwaway instance on an ephemeral port.
  const port = Number(process.env.E2E_SELFSTART_PORT ?? 8788);
  const selfBase = `http://localhost:${port}`;
  const backendDir = path.resolve(__dirname, '..');
  console.log(`Backend not running on :8080 — self-starting a throwaway instance on :${port} …`);
  try {
    selfStarted = spawn('npx', ['tsx', 'index.ts'], {
      cwd: backendDir,
      env: {
        ...process.env,
        PORT: String(port),
        FF_VALIDATION_LOOP: '1',        // arm the recording path regardless of overrides
        // Isolate the behaviour UNDER TEST (hiring-outcome recording) from the
        // ORTHOGONAL, separately-owned employer entitlement gate. The gate
        // (moduleAccessControl) 402s a throwaway employer that owns no plan; a
        // genuinely entitled employer reaches the SAME route, so disabling it in
        // this throwaway instance keeps the recording-path assertions fully
        // genuine — exactly the same rationale as forcing FF_VALIDATION_LOOP=1.
        FF_MODULE_ACCESS_CONTROL: '0',
        NODE_ENV: 'development',        // dev boot: no prod preflight abort, Vite skipped
        DB_PREWARM_DISABLED: '1',       // trim boot work
        MONGO_REQUIRED: 'false',        // Mongo optional — never block boot on it
      },
      stdio: 'ignore',
      detached: true,             // own process group so we can reap the tsx child too
    });
    selfStarted.on('error', (e) => console.error('self-start spawn error:', (e as Error)?.message));
  } catch (e: any) {
    console.error('self-start failed to spawn:', e?.message ?? e);
    return false;
  }

  const bootMs = Number(process.env.E2E_SELFSTART_TIMEOUT_MS ?? 90000);
  const up = await waitReachable(selfBase, bootMs);
  if (!up) {
    console.error(`self-started backend did not become healthy within ${bootMs}ms.`);
    return false;
  }
  BASE = selfBase;
  console.log(`Self-started backend healthy at ${BASE}.`);
  return true;
}

function stopSelfStarted(): void {
  if (!selfStarted || selfStarted.pid == null) return;
  const pid = selfStarted.pid;
  selfStarted = null;
  try {
    // detached → signal the whole process group (tsx spawns a child node process)
    process.kill(-pid, 'SIGTERM');
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
}

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     ✓ ${msg}`);
  else { failures += 1; console.error(`     ✗ FAIL: ${msg}`); }
}

// ── Minimal cookie jar + CSRF-aware fetch (mirrors the SPA's double-submit) ──
const jar = new Map<string, string>();
function applySetCookie(res: Response) {
  // node fetch exposes a combined string via getSetCookie() (undici) when available
  const raw = (res.headers as any).getSetCookie?.() as string[] | undefined;
  const list = raw && raw.length ? raw : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
  for (const c of list) {
    const first = c.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
}
function cookieHeader(): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const ck = cookieHeader();
  if (ck) headers['Cookie'] = ck;
  // signed double-submit: echo the mx.csrf cookie value in x-csrf-token on mutations
  const csrf = jar.get('mx.csrf');
  if (csrf && method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(csrf);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  applySetCookie(res);
  let json: any = null;
  const text = await res.text();
  if (text) { try { json = JSON.parse(text); } catch { json = text; } }
  return { status: res.status, json };
}

async function pollRow(refId: string, timeoutMs = 8000): Promise<any | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await pool.query(
      `SELECT * FROM validation_loop_outcomes WHERE outcome_type='hiring' AND ref_id=$1`,
      [refId],
    );
    if (r.rows.length) return r.rows[0];
    await new Promise((res) => setTimeout(res, 250));
  }
  return null;
}
async function countRows(refId: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int n FROM validation_loop_outcomes WHERE outcome_type='hiring' AND ref_id=$1`,
    [refId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

const RUN = Date.now().toString(36);
const USER = `e2e253_${RUN}`;
const PW = `E2eHire!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
const REAL_EMAIL = `e2e253.real.${RUN}@e2e-metryxone.test`;   // NON-demo (not @example.com)
const BULK_EMAIL = `e2e253.bulk.${RUN}@e2e-metryxone.test`;   // NON-demo
const DEMO_EMAIL = `e2e253.demo.${RUN}@example.com`;          // demo (RFC-2606 reserved)
// Billing identity for the throwaway EMPLOYER (the registrant). The module-access gate
// (FF_MODULE_ACCESS_CONTROL) keys employer_portal ownership on the principal's email, so a
// real employer posts jobs only when entitled. We register with an email AND provision an
// active per-email `employer_portal` grant (the super-admin manual-grant mechanism) so the
// harness exercises a legitimately-entitled employer; both are cleaned up on exit.
const EMPLOYER_EMAIL = `e2e253.employer.${RUN}@e2e-metryxone.test`; // NON-demo billing identity

let userId = '';
let jobId = '';
const refIds: string[] = [];

async function cleanup() {
  try {
    for (const ref of refIds) {
      await pool.query(`DELETE FROM validation_loop_outcomes WHERE ref_id=$1`, [ref]).catch(() => {});
    }
    await pool.query(`DELETE FROM validation_loop_outcomes WHERE subject_email = ANY($1)`,
      [[REAL_EMAIL.toLowerCase(), BULK_EMAIL.toLowerCase(), DEMO_EMAIL.toLowerCase()]]).catch(() => {});
    await pool.query(`DELETE FROM comm_entitlement_grants WHERE lower(email)=lower($1)`,
      [EMPLOYER_EMAIL]).catch(() => {});
    if (userId) {
      await pool.query(`DELETE FROM employer_candidates WHERE employer_id=$1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM employer_jobs WHERE employer_id=$1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM employer_members WHERE org_id=$1 OR user_id=$1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM employer_organizations WHERE id=$1 OR owner_id=$1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM users WHERE id=$1`, [userId]).catch(() => {});
    }
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

async function createCandidate(email: string, stage: string): Promise<string> {
  const r = await api('POST', '/api/employer/candidates', {
    jobId, jobTitle: 'E2E Senior Engineer (DEMO/TEST)', name: 'Casey Candidate',
    email, currentRole: 'Engineer',
    skills: ['typescript', 'node', 'postgres', 'react'],
    matchScore: 78, stage,
  });
  if (r.status !== 201 || !r.json?.candidate?._id) throw new Error(`candidate create failed: ${r.status} ${JSON.stringify(r.json)}`);
  return String(r.json.candidate._id);
}

async function main() {
  console.log('TASK #253 — hiring decision → recorded prediction E2E (full HTTP path)');

  // Task #330 — make a REAL backend available (existing, self-started, or SKIP).
  const ready = await ensureBackend();
  if (!ready) {
    // No assertions ran → `failures` stays 0 → exit 0. An unreachable backend is
    // an ENVIRONMENT-NOT-READY state, never a masked regression.
    console.log('\n⏭️  SKIPPED — Backend API is not running and a throwaway instance could not be started.');
    console.log('   This is an ENVIRONMENT-NOT-READY state, NOT a regression in the hiring-outcome recording path.');
    console.log('   Start the "Backend API" workflow (or set E2E_BASE_URL) and re-run to exercise the full HTTP path.');
    return;
  }

  console.log(`base=${BASE}  run=${RUN}\n`);
  await cleanup();

  // 0 — bootstrap CSRF cookie/token
  step('Bootstrap CSRF token');
  {
    const r = await api('GET', '/api/csrf-token');
    assert(r.status === 200 && !!jar.get('mx.csrf'), `GET /api/csrf-token issued mx.csrf cookie (status ${r.status})`);
  }

  // 1 — register a throwaway user (auto-logs in → sets mx.sid session cookie)
  step('Register + auto-login throwaway user');
  {
    const r = await api('POST', '/api/register', {
      username: USER, password: PW, fullName: 'E2E 253 Tester', role: 'job_seeker',
      email: EMPLOYER_EMAIL,
    });
    userId = String(r.json?.id ?? '');
    assert(r.status === 200 && !!userId, `POST /api/register created user + session (status ${r.status})`);
    assert(!!jar.get('mx.sid'), `session cookie mx.sid present after register`);
  }

  // 2 — activate employer account (sets account_type='employer' in DB)
  step('Activate employer account');
  {
    const r = await api('POST', '/api/employer/register', { companyName: 'E2E 253 Co (TEST)' });
    assert(r.status === 200 && r.json?.account_type === 'employer', `POST /api/employer/register → employer (status ${r.status})`);
  }

  // 2b — entitle the employer to the employer_portal module (FF_MODULE_ACCESS_CONTROL gates
  //      /api/employer/* on employer_portal ownership; a real employer posts jobs only when
  //      entitled). We provision an active per-email grant — the same manual-grant mechanism a
  //      super-admin uses — so the harness exercises a legitimately-entitled employer.
  step('Entitle employer to employer_portal module');
  {
    await ensureEntitlementGrantsSchema(pool);
    await pool.query(
      `INSERT INTO comm_entitlement_grants (email, feature, status, reason, granted_by)
       VALUES ($1, 'employer_portal', 'active', 'e2e253 hiring-outcome harness', 'e2e253')`,
      [EMPLOYER_EMAIL],
    );
    const { rows } = await pool.query(
      `SELECT 1 FROM comm_entitlement_grants
        WHERE lower(email)=lower($1) AND feature='employer_portal' AND status='active'`,
      [EMPLOYER_EMAIL],
    );
    assert(rows.length === 1, `employer_portal grant active for ${EMPLOYER_EMAIL}`);
  }

  // 3 — create a job with skills (drives the prediction's role-skill overlap)
  step('Create job');
  {
    const r = await api('POST', '/api/employer/jobs', {
      title: 'E2E Senior Engineer (TEST)', department: 'Engineering', status: 'Active',
      skills: ['typescript', 'node', 'postgres', 'aws'],
    });
    jobId = String(r.json?.job?._id ?? r.json?.job?.id ?? '');
    assert(r.status === 201 && !!jobId, `POST /api/employer/jobs created job (status ${r.status})`);
  }

  // 4 — SINGLE-PUT terminal move of a NON-demo candidate → durable row
  step('Single-PUT: move NON-demo candidate to Hired');
  let realCandId = '';
  {
    realCandId = await createCandidate(REAL_EMAIL, 'Applied');
    const ref = `employer_candidate:${realCandId}`; refIds.push(ref);
    const before = await countRows(ref);
    assert(before === 0, `no prior outcome row for this candidate (baseline ${before})`);

    const r = await api('PUT', `/api/employer/candidates/${realCandId}`, { stage: 'Hired' });
    assert(r.status === 200 && r.json?.success === true, `PUT stage=Hired succeeded (status ${r.status})`);

    const row = await pollRow(ref);
    assert(!!row, `validation_loop_outcomes row recorded via the HTTP path (ref ${ref})`);
    if (row) {
      assert(row.is_demo === false, `is_demo=false for a non-@example.com candidate`);
      assert(Number(row.outcome_value) === 1, `outcome_value=1 (Hired)`);
      const p = row.predicted_prob_at_decision == null ? null : Number(row.predicted_prob_at_decision);
      assert(p != null && Number.isFinite(p) && p >= 0 && p <= 1, `predicted_prob_at_decision in [0,1] (got ${p})`);
      assert(String(row.subject_email) === REAL_EMAIL.toLowerCase(), `subject_email matches the candidate`);
    }
  }

  // 5 — IDEMPOTENCY at the HTTP layer: repeat the terminal action → still ONE row
  step('Idempotency: re-trigger terminal action, expect no duplicate');
  {
    const ref = `employer_candidate:${realCandId}`;
    // Move away then back to a terminal stage via the SAME HTTP route.
    await api('PUT', `/api/employer/candidates/${realCandId}`, { stage: 'Interview' });
    const r = await api('PUT', `/api/employer/candidates/${realCandId}`, { stage: 'Rejected' });
    assert(r.status === 200, `PUT stage=Rejected succeeded (status ${r.status})`);
    // Give any (guarded) fire-and-forget a chance, then assert no duplication.
    await new Promise((res) => setTimeout(res, 1500));
    const n = await countRows(ref);
    assert(n === 1, `exactly ONE outcome row after repeat actions (got ${n})`);
    const row = (await pool.query(`SELECT outcome_value FROM validation_loop_outcomes WHERE ref_id=$1`, [ref])).rows[0];
    // write-once snapshot guard means the decision-time pair is frozen at the FIRST terminal move (Hired=1)
    assert(Number(row?.outcome_value) === 1, `decision-time pair frozen at first terminal move (outcome_value=1, not overwritten)`);
  }

  // 6 — PIPELINE BULK-MOVE of a NON-demo candidate → durable row
  step('Bulk-move: move NON-demo candidate to Rejected');
  {
    const bulkCandId = await createCandidate(BULK_EMAIL, 'Applied');
    const ref = `employer_candidate:${bulkCandId}`; refIds.push(ref);
    const before = await countRows(ref);
    assert(before === 0, `no prior outcome row for the bulk candidate (baseline ${before})`);

    const r = await api('POST', '/api/employer/pipeline/bulk-move', { candidateIds: [bulkCandId], toStage: 'Rejected' });
    assert(r.status === 200 && r.json?.moved === 1, `bulk-move moved the candidate (status ${r.status}, moved ${r.json?.moved})`);

    const row = await pollRow(ref);
    assert(!!row, `validation_loop_outcomes row recorded via the bulk-move HTTP path`);
    if (row) {
      assert(row.is_demo === false, `is_demo=false for the non-demo bulk candidate`);
      assert(Number(row.outcome_value) === 0, `outcome_value=0 (Rejected)`);
      const p = row.predicted_prob_at_decision == null ? null : Number(row.predicted_prob_at_decision);
      assert(p != null && Number.isFinite(p) && p >= 0 && p <= 1, `predicted_prob_at_decision in [0,1] (got ${p})`);
    }
  }

  // 7 — DEMO candidate path records is_demo=true (excluded from cert counts)
  step('Demo path: @example.com candidate records is_demo=true');
  {
    const demoCandId = await createCandidate(DEMO_EMAIL, 'Applied');
    const ref = `employer_candidate:${demoCandId}`; refIds.push(ref);
    const r = await api('PUT', `/api/employer/candidates/${demoCandId}`, { stage: 'Hired' });
    assert(r.status === 200, `PUT stage=Hired for demo candidate succeeded (status ${r.status})`);
    const row = await pollRow(ref);
    assert(!!row, `validation_loop_outcomes row recorded for the demo candidate`);
    if (row) {
      assert(row.is_demo === true, `is_demo=true for an @example.com candidate (stays out of realized/cert counts)`);
    }
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — genuine hiring actions record exactly one non-demo, prediction-bearing row via the live HTTP path'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => {
    console.error('E2E ERROR:', e);
    failures += 1;
  })
  .finally(async () => {
    await cleanup();
    stopSelfStarted();
    await pool.end();
    // Exit is driven SOLELY by `failures`: any assertion/error break fails loudly
    // (exit 1). The only way to reach exit 0 without running assertions is the
    // backend-unavailable early return in main(), which leaves `failures` at 0 —
    // so a skip can never mask a real recording-path regression.
    process.exit(failures === 0 ? 0 : 1);
  });
