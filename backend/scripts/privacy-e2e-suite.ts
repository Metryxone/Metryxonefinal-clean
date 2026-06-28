/**
 * PRIVACY E2E SUITE RUNNER — wires the per-student IDOR regressions into one
 * named validation step (Task #282).
 *
 * Tasks #277/#279/#280/#274 each added a LIVE two-student IDOR e2e against the running
 * Backend API for a distinct per-student store:
 *   - task277-profile-privacy-e2e.ts            (resume/profile/jobs/goals)
 *   - task279-studio-privacy-e2e.ts             (Leadership/Executive Studio trackers)
 *   - task280-behavioural-memory-privacy-e2e.ts (behavioural-memory snapshots + graph)
 *   - task274-tracker-privacy-e2e.ts            (Launchpad Dashboard cross-device tracker)
 *
 * Each is a standalone tsx script that hits http://localhost:8080 exactly as a
 * browser would (live session-auth + CSRF + real Postgres), exits non-zero on a
 * cross-user leak/overwrite, and self-cleans its @example.com test data on exit.
 * On their own they only protect users if someone remembers to run them. This
 * runner makes them a repeatable CI-style check: an auth-middleware or
 * proxy-rewrite regression upstream of ANY of these per-student stores fails the
 * step before it ships.
 *
 * Behaviour:
 *   1. If the Backend API is already reachable on :8080 (the dev workflow is up),
 *      run against it as-is and DO NOT touch the running server.
 *   2. Otherwise, boot the backend in-process (`npx tsx index.ts`), wait for it to
 *      report ready, run the suite, then tear DOWN only the server this runner
 *      started (the dev workflow, if any, is never disturbed).
 *   3. Run the harnesses sequentially (a shared live server + @example.com
 *      self-clean make serial the safe ordering), collect each exit code, and
 *      exit non-zero if ANY harness failed (or if the server never came up).
 *
 * Speed (Task #284): each harness registers two @example.com students via the
 * live POST /api/register, which is protected by the always-on auth rate limiter
 * (max 5 registrations / 60s / IP — backend/routes.ts authRegisterLimiter). The
 * limiter is a real security control with NO test bypass, so we keep it fully
 * intact and never spoof X-Forwarded-For. Instead of pausing 65s between EVERY
 * harness, the runner packs harnesses into BATCHES whose combined registrations
 * stay at or under the register window limit, runs each batch back-to-back with
 * no delay, and only waits one window between batches. With four 2-registration
 * harnesses (8 total) that is two batches of two (4 registrations each) = a single
 * ~65s wait between them instead of three back-to-back waits, materially cutting
 * the wall-clock time while exercising the identical live register/auth path. The
 * register path is still hit for real every time; nothing is mocked or relaxed.
 *
 * Measured runtime (live Backend API on :8080, clean register window): the three
 * original harnesses ran ~73s end-to-end (down from ~140s under the previous
 * wait-between-every-harness design); the fourth harness (Task #274) joins the
 * second batch, so it adds its own run time but NO extra inter-batch wait. The
 * suite prints the actual total
 * runtime in its summary on every run. A cross-user leak still fails the step
 * (the verdict is the union of the harnesses' own exit codes — see Honesty below).
 *
 * Honesty: this runner adds NO assertions of its own — it is pure orchestration.
 * The pass/fail verdict is exactly the union of the harnesses' own exit
 * codes, so it cannot mask a real privacy regression.
 *
 * Operator note: the PREFERRED way to run this is with the Backend API workflow
 * already up on :8080 (case 1) — then the suite uses that server's real env/flags.
 * The auto-boot (case 2) is a FALLBACK for headless/CI runs; it inherits whatever
 * env the runner has, so a flag-gated surface (e.g. task279 if its careerLaunchpad flag
 * or task274 if its launchpadDashboard flag is OFF) could fail on flag-gating rather than
 * a true privacy regression. The live Backend API workflow enables these via .replit
 * [userenv.development] (FF_CAREER_LAUNCHPAD, FF_EMPLOYABILITY_STUDIO, FF_LAUNCHPAD_DASHBOARD);
 * each flag-gated harness probes its /enabled route and fails honestly (never a false pass)
 * if the flag is OFF. Run against the live workflow when in doubt.
 *
 * Run:  cd backend && npx tsx scripts/privacy-e2e-suite.ts
 */

import { spawn, type ChildProcess } from 'child_process';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const HEALTH_URL = `${BASE}/api/health`;

// `registrations` is how many POST /api/register calls each harness makes during
// setup (each registers two students A and B). The batch packer below uses it to
// keep every batch at or under the register window limit.
const HARNESSES = [
  { name: 'profile (resume/profile/jobs/goals) — Task #277', script: 'scripts/task277-profile-privacy-e2e.ts', registrations: 2 },
  { name: 'studio (leadership/executive trackers) — Task #279', script: 'scripts/task279-studio-privacy-e2e.ts', registrations: 2 },
  { name: 'behavioural-memory (snapshots/graph) — Task #280', script: 'scripts/task280-behavioural-memory-privacy-e2e.ts', registrations: 2 },
  { name: 'launchpad-dashboard tracker (campus/fresher) — Task #274', script: 'scripts/task274-tracker-privacy-e2e.ts', registrations: 2 },
];

// The live POST /api/register limiter allows max 5 registrations per 60s per IP
// (backend/routes.ts authRegisterLimiter). We pack harnesses into batches that
// stay at or under this so each batch runs back-to-back with no inter-harness
// delay, and we only wait one register window BETWEEN batches. Keeping a 1-count
// safety margin below the hard 5 absorbs any stray registration the suite isn't
// counting and guarantees we never trip the limiter we are deliberately honouring.
const REGISTER_WINDOW_LIMIT = 5;
const REGISTER_BATCH_CAP = REGISTER_WINDOW_LIMIT - 1; // 4 → two 2-reg harnesses per batch

type Harness = (typeof HARNESSES)[number];

// Greedily pack harnesses (in declared order) into batches whose combined
// registration count never exceeds REGISTER_BATCH_CAP. A single harness that on
// its own exceeds the cap still gets its own batch (it relies on its own internal
// spacing) rather than being dropped.
function packBatches(harnesses: Harness[], cap: number): Harness[][] {
  const batches: Harness[][] = [];
  let current: Harness[] = [];
  let running = 0;
  for (const h of harnesses) {
    if (current.length > 0 && running + h.registrations > cap) {
      batches.push(current);
      current = [];
      running = 0;
    }
    current.push(h);
    running += h.registrations;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const BOOT_TIMEOUT_MS = 90_000; // server seeds at boot; give it generous headroom
const POLL_INTERVAL_MS = 1_000;

// Each harness registers two @example.com students via POST /api/register. That
// endpoint is protected by the always-on auth rate limiter (max 5 registrations
// per 60s per IP — backend/routes.ts authRegisterLimiter). Running all four
// harnesses back-to-back creates 8 accounts from one IP inside the window and a
// later harness gets a 429 during setup. The rate limiter is a real security
// control with no test bypass, so the suite stays WITHIN it: harnesses are packed
// into register-window batches (see packBatches) and we wait past the register
// window ONLY BETWEEN batches rather than weakening the limiter. This is the gap
// used between batches. Override with PRIVACY_SUITE_GAP_MS=0 when the limiter
// isn't in play (e.g. a context that disables it) to run with no delay at all.
function resolveGapMs(): number {
  if (process.env.PRIVACY_SUITE_GAP_MS === undefined) return 65_000;
  const n = Number(process.env.PRIVACY_SUITE_GAP_MS);
  // Reject NaN/negative so a typo can't silently turn off the spacing and cause
  // false rate-limit failures. Only an explicit 0 disables the delay.
  if (!Number.isFinite(n) || n < 0) {
    log(`Ignoring invalid PRIVACY_SUITE_GAP_MS="${process.env.PRIVACY_SUITE_GAP_MS}" — falling back to 65000ms.`);
    return 65_000;
  }
  return n;
}
const INTER_BATCH_GAP_MS = resolveGapMs();

function log(msg: string) {
  console.log(`[privacy-e2e-suite] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isReachable(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET' });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForReady(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await isReachable()) return true;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

function bootBackend(): ChildProcess {
  log('Backend API not reachable on :8080 — booting a temporary instance (npx tsx index.ts)…');
  const child = spawn('npx', ['tsx', 'index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group so we can kill the whole tree on teardown
  });
  // Surface server output (prefixed) so a boot failure is visible in the log.
  child.stdout?.on('data', (b: Buffer) => process.stdout.write(`[server] ${b}`));
  child.stderr?.on('data', (b: Buffer) => process.stderr.write(`[server] ${b}`));
  return child;
}

function runHarness(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', script], {
      cwd: process.cwd(),
      env: { ...process.env, E2E_BASE_URL: BASE },
      stdio: 'inherit',
    });
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`     ✗ harness ${script} terminated by signal ${signal}`);
        resolve(1);
      } else {
        resolve(code ?? 1);
      }
    });
    child.on('error', (err) => {
      console.error(`     ✗ failed to launch ${script}: ${err.message}`);
      resolve(1);
    });
  });
}

async function teardownBackend(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  log('Tearing down the temporary Backend API instance…');
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    child.once('exit', done);
    try {
      // Kill the whole process group (npx → tsx → node) we created with detached.
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {
      done();
      return;
    }
    // Force-kill if graceful shutdown stalls.
    setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch { /* already gone */ }
    }, 12_000).unref();
  });
}

async function main() {
  console.log('PRIVACY E2E SUITE — per-student IDOR regressions (Tasks #277/#279/#280/#274)');
  console.log(`base=${BASE}\n`);

  let startedServer: ChildProcess | null = null;

  const alreadyUp = await isReachable();
  if (alreadyUp) {
    log('Backend API already reachable on :8080 — running against the live server.');
  } else {
    startedServer = bootBackend();
    const ready = await waitForReady(Date.now() + BOOT_TIMEOUT_MS);
    if (!ready) {
      console.error('\n❌ Backend API never became reachable on :8080 — cannot run the privacy suite.');
      await teardownBackend(startedServer);
      process.exit(1);
    }
    log('Backend API is up and ready.');
  }

  const batches = packBatches(HARNESSES, REGISTER_BATCH_CAP);
  const startedAt = Date.now();
  log(
    `Packed ${HARNESSES.length} harness(es) into ${batches.length} register-window batch(es) ` +
    `(cap ${REGISTER_BATCH_CAP} registrations/batch; only ${Math.max(0, batches.length - 1)} inter-batch wait(s) needed).`,
  );

  const results: { name: string; code: number }[] = [];
  try {
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      if (b > 0 && INTER_BATCH_GAP_MS > 0) {
        log(`Waiting ${Math.round(INTER_BATCH_GAP_MS / 1000)}s for the auth register rate-limit window to clear before the next batch…`);
        await sleep(INTER_BATCH_GAP_MS);
      }
      const regs = batch.reduce((n, h) => n + h.registrations, 0);
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`▶ Batch ${b + 1}/${batches.length} — ${batch.length} harness(es), ${regs} registration(s)`);
      console.log(`------------------------------------------------------------------------`);
      // Within a batch the harnesses still run SERIALLY (a shared live server +
      // @example.com self-clean make serial the safe ordering); the only thing the
      // batching removes is the rate-limit wait BETWEEN harnesses of the same batch.
      for (const h of batch) {
        console.log(`\n========================================================================`);
        console.log(`▶ Running privacy harness: ${h.name}`);
        console.log(`========================================================================`);
        const code = await runHarness(h.script);
        results.push({ name: h.name, code });
      }
    }
  } finally {
    if (startedServer) await teardownBackend(startedServer);
  }

  const elapsedS = Math.round((Date.now() - startedAt) / 1000);

  console.log(`\n========================================================================`);
  console.log('PRIVACY E2E SUITE — SUMMARY');
  console.log(`========================================================================`);
  for (const r of results) {
    console.log(`  ${r.code === 0 ? '✅ PASS' : '❌ FAIL'}  ${r.name}`);
  }
  console.log(`\n  Ran ${results.length} harness(es) in ${batches.length} batch(es); total runtime ${elapsedS}s.`);

  const failed = results.filter((r) => r.code !== 0).length;
  if (failed === 0) {
    console.log('\n✅ ALL PRIVACY HARNESSES PASSED — no cross-user leak/overwrite detected.');
    process.exit(0);
  } else {
    console.error(`\n❌ ${failed} PRIVACY HARNESS(ES) FAILED — see output above. This blocks the change.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('PRIVACY E2E SUITE RUNNER ERROR:', e);
  process.exit(1);
});
