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
 *   3. Run all harnesses sequentially (a shared live server + @example.com
 *      self-clean make serial the safe ordering), collect each exit code, and
 *      exit non-zero if ANY harness failed (or if the server never came up).
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

const HARNESSES = [
  { name: 'profile (resume/profile/jobs/goals) — Task #277', script: 'scripts/task277-profile-privacy-e2e.ts' },
  { name: 'studio (leadership/executive trackers) — Task #279', script: 'scripts/task279-studio-privacy-e2e.ts' },
  { name: 'behavioural-memory (snapshots/graph) — Task #280', script: 'scripts/task280-behavioural-memory-privacy-e2e.ts' },
  { name: 'launchpad-dashboard tracker (campus/fresher) — Task #274', script: 'scripts/task274-tracker-privacy-e2e.ts' },
];

const BOOT_TIMEOUT_MS = 90_000; // server seeds at boot; give it generous headroom
const POLL_INTERVAL_MS = 1_000;

// Each harness registers two @example.com students via POST /api/register. That
// endpoint is protected by the always-on auth rate limiter (max 5 registrations
// per 60s per IP — backend/routes.ts authRegisterLimiter). Running all four
// harnesses back-to-back creates 8 accounts from one IP inside the window and a
// later harness gets a 429 during setup. The rate limiter is a real security
// control with no test bypass, so the suite stays WITHIN it: we wait past the
// register window between harnesses rather than weakening the limiter. Override
// with PRIVACY_SUITE_GAP_MS=0 when the limiter isn't in play (e.g. a context that
// disables it) to run with no inter-harness delay.
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
const INTER_HARNESS_GAP_MS = resolveGapMs();

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

  const results: { name: string; code: number }[] = [];
  try {
    for (let i = 0; i < HARNESSES.length; i++) {
      const h = HARNESSES[i];
      if (i > 0 && INTER_HARNESS_GAP_MS > 0) {
        log(`Waiting ${Math.round(INTER_HARNESS_GAP_MS / 1000)}s for the auth register rate-limit window to clear before the next harness…`);
        await sleep(INTER_HARNESS_GAP_MS);
      }
      console.log(`\n========================================================================`);
      console.log(`▶ Running privacy harness: ${h.name}`);
      console.log(`========================================================================`);
      const code = await runHarness(h.script);
      results.push({ name: h.name, code });
    }
  } finally {
    if (startedServer) await teardownBackend(startedServer);
  }

  console.log(`\n========================================================================`);
  console.log('PRIVACY E2E SUITE — SUMMARY');
  console.log(`========================================================================`);
  for (const r of results) {
    console.log(`  ${r.code === 0 ? '✅ PASS' : '❌ FAIL'}  ${r.name}`);
  }

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
