/**
 * TASK #70 — Hiring insights stay DEVELOPMENTAL and PRIVATE across organizations
 *            (flag-ON, authenticated, LIVE-ROUTE integration).
 *
 * WHY THIS EXISTS
 * ---------------
 * `smoke-employer-competency-intelligence.ts` proves the flag-OFF 503 contract and exercises
 * the pure service derivations directly. What it does NOT prove is that the honesty + privacy
 * contract holds when the flag is ON and a real authenticated session hits the REAL Express
 * route (`/api/v2/employer/competency-match/:candidateId/:jobId/intelligence`). A refactor of
 * the org-scoped resolver, the auth wiring, or the intelligence composer could leak another
 * organization's candidate/job or let verdict-style language slip into the recommendation
 * without the service-level smoke ever noticing. This harness closes that gap end-to-end:
 *
 *   1. CROSS-ORG IDOR (the privacy contract) — as an authenticated caller from org A:
 *        • a POSITIVE control: org A reading its OWN candidate+job → 200 (proves the 404s
 *          below are scoping, not a blanket failure),
 *        • org A reading org B's candidate+job → 404,
 *        • org A reading a mixed pair (own candidate + foreign job, and vice-versa) → 404.
 *      No cross-org existence leak: a foreign/out-of-scope row is indistinguishable from a
 *      missing one (both 404).
 *
 *   2. NO VERDICT LANGUAGE (the honesty contract) — the hiring recommendation returned by the
 *      LIVE route must never emit hire/no-hire or suitability-verdict terms in its affirmative
 *      fields; only the `disclaimer` field is allowed to name them (it exists to say the output
 *      is NOT a hiring verdict).
 *
 *   3. BENCHMARK k-ANONYMITY (the privacy contract, cohort side) — the Role DNA benchmark on
 *      the LIVE payload must obey the k-anonymity invariant regardless of the cohort's real
 *      state: available ⟹ (sampleSize ≥ BENCHMARK_K_MIN AND not suppressed AND percentiles
 *      present); suppressed ⟹ (unavailable AND cohort unknown/below the floor); a cohort that
 *      is unknown or < BENCHMARK_K_MIN can NEVER be released. This asserts the gate against the
 *      route without mutating the shared `ti_role_benchmarks` substrate. The exhaustive
 *      per-case gate (unknown / <k / ≥k / absent) is proven at the engine level in the smoke.
 *
 * HONESTY / ISOLATION
 * -------------------
 * - The flag `employerCompetencyHiring` defaults OFF and is deliberately absent from the
 *   Backend API workflow command (dev stays byte-identical-OFF). Rather than flip the shared
 *   :8080 workflow, this harness boots its OWN isolated backend instance on a dedicated port
 *   with FF_EMPLOYER_COMPETENCY_HIRING=1, exercises it, then SIGKILLs it. Dev's OFF default is
 *   never touched and the regression is fully self-contained.
 * - Readiness is a COMBINED probe: the flag-gated `/feature-flag` route returns 200 only when
 *   the instance is up AND the flag is ON (503 while booting or flag-OFF). No fixed sleeps.
 * - Every artifact is @example.com / e2e-prefixed and removed on exit (throwaway user + both
 *   orgs' seeded candidate/job rows). No shared reference data is written.
 * - The harness is ALLOWED to fail (non-zero exit) — no number is tuned to force a pass.
 *
 * Run: cd backend && npx tsx scripts/task70-employer-competency-intelligence-e2e.ts
 */
import { spawn, type ChildProcess } from 'child_process';
import { Pool } from 'pg';
import { BENCHMARK_K_MIN } from '../services/employer-competency-intelligence';

const PORT = Number(process.env.E2E_PORT ?? 8291);
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const FLAG_PROBE = '/api/v2/employer/competency-match/feature-flag';
const BOOT_TIMEOUT_MS = 120_000;
const POLL_MS = 800;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     \u2713 ${msg}`);
  else { failures += 1; console.error(`     \u2717 FAIL: ${msg}`); }
}

// ── Minimal cookie jar + CSRF-aware fetch (mirrors the SPA's signed double-submit) ──
const jar = new Map<string, string>();
function applySetCookie(res: Response) {
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
  const csrf = jar.get('mx.csrf');
  if (csrf && method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(csrf);
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  applySetCookie(res);
  let json: any = null;
  const text = await res.text();
  if (text) { try { json = JSON.parse(text); } catch { json = text; } }
  return { status: res.status, json };
}

// ── Isolated flag-ON backend lifecycle ──
function bootBackend(): ChildProcess {
  console.log(`Booting an isolated flag-ON Backend API on :${PORT} (FF_EMPLOYER_COMPETENCY_HIRING=1)…`);
  const child = spawn('npx', ['tsx', 'index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), FF_EMPLOYER_COMPETENCY_HIRING: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group → kill the whole tree (npx → tsx → node) on teardown
  });
  child.stdout?.on('data', (b: Buffer) => process.stdout.write(`[server] ${b}`));
  child.stderr?.on('data', (b: Buffer) => process.stderr.write(`[server] ${b}`));
  return child;
}

/** Combined readiness+flag probe: /feature-flag is flag-gated, so a 200 with
 *  employerCompetencyHiring:true means the instance is up AND the flag is ON. */
async function waitForFlagOn(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}${FLAG_PROBE}`);
      if (res.status === 200) {
        const j: any = await res.json().catch(() => null);
        if (j?.feature_flag?.employerCompetencyHiring === true) return true;
      }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

async function teardownBackend(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  console.log('\nTearing down the isolated Backend API instance…');
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch { resolve(); return; }
    setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch { /* already gone */ }
    }, 8_000).unref();
  });
}

// ── Test fixtures (all purgeable) ──
const RUN = Date.now().toString(36);
const USER_A = `e2e70_${RUN}`;
const PW = `E2eEmp!${RUN}aA9`; // satisfies the password complexity policy
const EMAIL_A = `e2e70.orgA.${RUN}@example.com`;
const ORG_B = `e2e70-orgB-${RUN}`; // a DIFFERENT organization's employer_id (synthetic, purgeable)

const CAND_A = `e2e70-candA-${RUN}`;
const JOB_A = `e2e70-jobA-${RUN}`;
const CAND_B = `e2e70-candB-${RUN}`;
const JOB_B = `e2e70-jobB-${RUN}`;

let orgA = ''; // org A's employer_id === the registered user's id (employerOrgId → req.user.id)

// Any verdict-style language that must NEVER appear in an affirmative recommendation field.
const VERDICT_RE = /(hire\/no-hire|no[-_\s]?hire|strong[-_\s]?hire|pass\/fail|pass or fail|suitability|\bsuitable\b|\bunsuitable\b|guaranteed performance|validated hiring prediction)/i;

async function cleanup() {
  try {
    await pool.query('DELETE FROM employer_candidates WHERE employer_id = ANY($1::text[])', [[orgA, ORG_B].filter(Boolean)]).catch(() => {});
    await pool.query('DELETE FROM employer_jobs WHERE employer_id = ANY($1::text[])', [[orgA, ORG_B].filter(Boolean)]).catch(() => {});
    if (orgA) await pool.query('DELETE FROM users WHERE id = $1', [orgA]).catch(() => {});
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

async function seedCandidate(id: string, employerId: string, name: string) {
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, name, email, candidate_role, stage)
     VALUES ($1,$2,$3,$4,'Software Engineer','Applied')
     ON CONFLICT (id) DO UPDATE SET employer_id = EXCLUDED.employer_id`,
    [id, employerId, name, `${id}@example.com`],
  );
}
async function seedJob(id: string, employerId: string, title: string) {
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, status)
     VALUES ($1,$2,$3,'active')
     ON CONFLICT (id) DO UPDATE SET employer_id = EXCLUDED.employer_id`,
    [id, employerId, title],
  );
}

async function main() {
  console.log('TASK #70 — hiring insights stay developmental + private across orgs (flag-ON HTTP path)');
  console.log(`base=${BASE}  run=${RUN}\n`);
  await cleanup();

  // 1 — bootstrap CSRF cookie/token (needed for the register POST)
  step('Bootstrap CSRF token');
  {
    const r = await api('GET', '/api/csrf-token');
    assert(r.status === 200 && !!jar.get('mx.csrf'), `GET /api/csrf-token issued mx.csrf cookie (status ${r.status})`);
  }

  // 2 — register a throwaway user for org A (auto-logs in → sets mx.sid session cookie).
  //     employerOrgId() resolves the org scope from req.user.id, so this user's id IS org A.
  step('Register + auto-login org A user (org scope = user id)');
  {
    const r = await api('POST', '/api/register', {
      username: USER_A, password: PW, fullName: 'E2E 70 Org A', role: 'employer', email: EMAIL_A,
    });
    orgA = String(r.json?.id ?? '');
    assert(r.status === 200 && !!orgA, `POST /api/register created org A user + session (status ${r.status})`);
    assert(!!jar.get('mx.sid'), 'session cookie mx.sid present after register');
  }
  if (!orgA) { console.error('\n❌ could not establish org A session — aborting.'); return; }

  // 3 — seed a candidate+job for org A (own scope) AND for org B (a DIFFERENT employer_id).
  //     Both pairs EXIST in the tables; only the employer_id scope differs — so a 404 below
  //     proves org-scoping, not row-absence.
  step('Seed candidate+job for org A (own) and org B (foreign)');
  {
    await seedCandidate(CAND_A, orgA, 'Org A Candidate');
    await seedJob(JOB_A, orgA, 'Software Engineer');
    await seedCandidate(CAND_B, ORG_B, 'Org B Candidate');
    await seedJob(JOB_B, ORG_B, 'Software Engineer');
    const n = await pool.query(
      'SELECT COUNT(*)::int c FROM employer_candidates WHERE id = ANY($1::text[])',
      [[CAND_A, CAND_B]],
    );
    assert(Number(n.rows[0].c) === 2, `both candidates seeded (n=${n.rows[0].c})`);
  }

  // 4 — POSITIVE control: org A reads its OWN candidate+job → 200 (the 404s below are scoping).
  let ownPayload: any = null;
  step('POSITIVE control: org A reads its OWN candidate+job → expect 200');
  {
    const r = await api('GET', `/api/v2/employer/competency-match/${CAND_A}/${JOB_A}/intelligence`);
    assert(r.status === 200 && r.json?.ok === true && !!r.json?.intelligence,
      `GET own /intelligence → 200 with intelligence payload (status ${r.status})`);
    ownPayload = r.json?.intelligence ?? null;
  }

  // 5 — CROSS-ORG IDOR: org A must NOT read org B's rows (or any mixed pair) → 404 each.
  step('CROSS-ORG IDOR: org A reading org B / mixed pairs → expect 404 (no existence leak)');
  {
    const foreign = await api('GET', `/api/v2/employer/competency-match/${CAND_B}/${JOB_B}/intelligence`);
    assert(foreign.status === 404, `foreign candidate+job → 404 (got ${foreign.status})`);

    const mixed1 = await api('GET', `/api/v2/employer/competency-match/${CAND_A}/${JOB_B}/intelligence`);
    assert(mixed1.status === 404, `own candidate + foreign job → 404 (got ${mixed1.status})`);

    const mixed2 = await api('GET', `/api/v2/employer/competency-match/${CAND_B}/${JOB_A}/intelligence`);
    assert(mixed2.status === 404, `foreign candidate + own job → 404 (got ${mixed2.status})`);

    // The foreign 404 must not differ from a truly-missing 404 (no existence oracle).
    const missing = await api('GET', `/api/v2/employer/competency-match/e2e70-nope-${RUN}/e2e70-nope-${RUN}/intelligence`);
    assert(missing.status === 404, `truly-missing pair → 404 (got ${missing.status})`);
    assert(foreign.json?.error === missing.json?.error,
      `foreign 404 body is indistinguishable from missing 404 body (no existence leak)`);
  }

  // 6 — NO VERDICT LANGUAGE on the live hiring recommendation (affirmative fields only).
  step('HONESTY: live hiring recommendation emits no verdict language in affirmative fields');
  {
    const hr = ownPayload?.hiringRecommendation ?? null;
    assert(!!hr, 'hiringRecommendation present on the live payload');
    if (hr) {
      const { disclaimer, ...affirmative } = hr;
      const affirmativeText = JSON.stringify(affirmative).toLowerCase();
      assert(!VERDICT_RE.test(affirmativeText),
        `no hire/no-hire or suitability verdict term in affirmative fields (scanned ${Object.keys(affirmative).join(',')})`);
      assert(typeof disclaimer === 'string' && /not a hiring/i.test(disclaimer) && /verdict/i.test(disclaimer),
        'disclaimer explicitly states the output is NOT a hiring verdict');
    }
    // Also scan the interview recommendation notes (no disclaimer field there).
    const ir = ownPayload?.interviewRecommendation ?? null;
    if (ir) {
      assert(!VERDICT_RE.test(JSON.stringify(ir).toLowerCase()),
        'no verdict language in the interview recommendation either');
    }
  }

  // 7 — BENCHMARK k-ANONYMITY invariant on the live payload (cohort privacy).
  step(`PRIVACY: live Role DNA benchmark obeys the k-anonymity invariant (k>=${BENCHMARK_K_MIN})`);
  {
    const b = ownPayload?.benchmark ?? null;
    assert(!!b, 'benchmark present on the live payload');
    if (b) {
      const n = b.sampleSize;
      const belowFloor = n == null || Number(n) < BENCHMARK_K_MIN;
      // available ⟹ cohort confirmed ≥ k AND not suppressed AND percentiles present.
      const availableImpliesReleased =
        b.available !== true || (n != null && Number(n) >= BENCHMARK_K_MIN && b.suppressed === false && b.percentiles != null);
      assert(availableImpliesReleased,
        `benchmark available only when cohort >= ${BENCHMARK_K_MIN}, not suppressed, percentiles present (available=${b.available}, n=${n}, suppressed=${b.suppressed})`);
      // suppressed ⟹ not available AND cohort unknown/below floor.
      const suppressedImpliesWithheld = b.suppressed !== true || (b.available === false && belowFloor);
      assert(suppressedImpliesWithheld,
        `suppressed benchmark is withheld + below/unknown floor (suppressed=${b.suppressed}, available=${b.available}, n=${n})`);
      // below/unknown floor ⟹ never released (either suppressed or honest abstain).
      const belowFloorNeverReleased = !belowFloor || b.available === false;
      assert(belowFloorNeverReleased,
        `cohort unknown or < ${BENCHMARK_K_MIN} is never released (n=${n}, available=${b.available})`);
      assert(b.kMin === BENCHMARK_K_MIN, `benchmark advertises k_min=${BENCHMARK_K_MIN} (got ${b.kMin})`);
    }
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — the live flag-ON route keeps hiring insights org-private (404 cross-org, no existence leak), developmental (no verdict language), and k-anonymous (benchmark invariant)'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

async function run() {
  let child: ChildProcess | null = null;
  try {
    child = bootBackend();
    const ready = await waitForFlagOn(Date.now() + BOOT_TIMEOUT_MS);
    if (!ready) {
      console.error(`\n❌ isolated Backend API never became flag-ON-ready on :${PORT} within ${BOOT_TIMEOUT_MS / 1000}s.`);
      failures += 1;
      return;
    }
    await main();
  } catch (e) {
    console.error('E2E ERROR:', e);
    failures += 1;
  } finally {
    await cleanup();
    await pool.end();
    await teardownBackend(child);
    process.exit(failures === 0 ? 0 : 1);
  }
}

run();
