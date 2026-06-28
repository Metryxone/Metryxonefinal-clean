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
 * [userenv.development] (FF_CAREER_LAUNCHPAD, FF_EMPLOYABILITY_STUDIO, FF_LAUNCHPAD_DASHBOARD).
 *
 * Flag preflight (Task #287): regardless of which path is taken, the runner first probes
 * each required flag's ungated /enabled endpoint on the LIVE target and ABORTS with a
 * dedicated exit code (2) and a clear "flag X is OFF" message if any is not ON — BEFORE
 * any harness runs. This stops a missing flag on the already-running workflow (case 1,
 * which trusts that workflow's env) from making a flag-gated harness 503 on flag-gating
 * and the run look "green" for the wrong reason (false pass), and it distinguishes a flag
 * MISconfig from a real cross-user leak (the harnesses' own exit 1). Run against the live
 * workflow when in doubt.
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

/** Feature flags the flag-gated harnesses require ON to exercise the REAL privacy
 *  logic instead of 503-ing on flag-gating. On the live-server path these come from
 *  the running workflow's env (.replit [userenv.development]); when we auto-boot a
 *  temporary instance ourselves (headless/CI), the spawned process only inherits the
 *  runner's env, which may not carry them — so we set them explicitly there. We do NOT
 *  override flags already present in the runner env (a deliberate FF_*=0 still wins).
 *
 *  Each entry also carries the harness's ungated `/enabled` probe endpoint (always
 *  200 `{enabled:<bool>}` regardless of flag state — platform convention), which the
 *  preflight below hits against the LIVE target BEFORE any harness runs. This catches
 *  the case the auto-boot defaulting cannot: the live-server path (case 1) trusts the
 *  already-running workflow's env, so if that workflow is missing one of these flags
 *  the harness would still 503 on flag-gating and the run could look "green" for the
 *  wrong reason. The preflight fails LOUDLY (and with a verdict distinct from a privacy
 *  regression) so a missing flag can never masquerade as either a pass or a leak.
 *    - FF_CAREER_LAUNCHPAD     → Employability Studio harness (#279)
 *    - FF_EMPLOYABILITY_STUDIO → Employability Studio harness (#279)
 *    - FF_LAUNCHPAD_DASHBOARD  → Launchpad tracker harness (#274) */
const REQUIRED_HARNESS_FLAGS = [
  { env: 'FF_CAREER_LAUNCHPAD', flag: 'careerLaunchpad', probe: '/api/career-launchpad/enabled', harness: 'studio (leadership/executive trackers) — Task #279' },
  { env: 'FF_EMPLOYABILITY_STUDIO', flag: 'employabilityStudio', probe: '/api/employability-studio/enabled', harness: 'studio (leadership/executive trackers) — Task #279' },
  { env: 'FF_LAUNCHPAD_DASHBOARD', flag: 'launchpadDashboard', probe: '/api/launchpad-dashboard/enabled', harness: 'launchpad-dashboard tracker (campus/fresher) — Task #274' },
] as const;

// Distinct exit code so a flag-config problem is never confused with a privacy
// regression (the harnesses themselves exit 1 on a real cross-user leak). A
// missing required flag is an OPERATOR/config error, not a security finding.
const FLAG_PREFLIGHT_EXIT_CODE = 2;

/** Probe each required flag's ungated `/enabled` endpoint on the LIVE target and
 *  return its observed state. Works identically for the live-server and auto-boot
 *  paths because it runs only after the target is confirmed reachable. An endpoint
 *  that is unreachable or doesn't return `{enabled:true}` is treated as NOT ON so a
 *  flag we cannot positively verify never silently passes the gate. */
async function preflightRequiredFlags(): Promise<
  { env: string; flag: string; probe: string; harness: string; enabled: boolean | null; status: number | string }[]
> {
  const out: { env: string; flag: string; probe: string; harness: string; enabled: boolean | null; status: number | string }[] = [];
  for (const f of REQUIRED_HARNESS_FLAGS) {
    let enabled: boolean | null = null;
    let status: number | string = 'unreachable';
    try {
      const res = await fetch(`${BASE}${f.probe}`, { method: 'GET' });
      status = res.status;
      if (res.status === 200) {
        const body = (await res.json().catch(() => null)) as { enabled?: unknown } | null;
        enabled = body?.enabled === true;
      }
    } catch {
      status = 'unreachable';
    }
    out.push({ env: f.env, flag: f.flag, probe: f.probe, harness: f.harness, enabled, status });
  }
  return out;
}

function bootBackend(): ChildProcess {
  log('Backend API not reachable on :8080 — booting a temporary instance (npx tsx index.ts)…');
  const flagEnv: Record<string, string> = {};
  for (const f of REQUIRED_HARNESS_FLAGS) {
    // Only set a default when the runner hasn't already provided the flag, so an
    // explicit FF_*=0 in the environment is still honoured (no verdict weakening).
    if (process.env[f.env] == null) flagEnv[f.env] = '1';
  }
  const enabled = REQUIRED_HARNESS_FLAGS.filter((f) => flagEnv[f.env] === '1').map((f) => f.env);
  if (enabled.length) {
    log(`  enabling flag-gated harness flags for the temporary instance: ${enabled.join(', ')}`);
  }
  const child = spawn('npx', ['tsx', 'index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, ...flagEnv },
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

  // ── Preflight: BEFORE running any harness, confirm the LIVE target actually has
  // each required feature flag ON. This runs identically for the live-server and
  // auto-boot paths (the target is reachable in both). Without it, the live-server
  // path trusts the running workflow's env: a missing flag would make a flag-gated
  // harness 503 on flag-gating, which can look "green" for the wrong reason. We fail
  // LOUDLY here with a verdict distinct from a privacy regression so a config gap is
  // never reported as a leak (nor silently passes). ──
  log('Preflight: verifying each flag-gated harness has its required feature flag ON…');
  const flagStates = await preflightRequiredFlags();
  for (const r of flagStates) {
    const mark = r.enabled === true ? '✅ ON ' : r.enabled === false ? '❌ OFF' : '❌ ???';
    const detail =
      r.enabled === true ? '' : r.enabled === false ? '' : ` (probe ${r.probe} → status ${r.status})`;
    console.log(`  ${mark}  ${r.env} (${r.flag})${detail}`);
  }
  const notOn = flagStates.filter((r) => r.enabled !== true);
  if (notOn.length) {
    console.error('\n❌ PRIVACY SUITE PREFLIGHT FAILED — required feature flag(s) are not ON:');
    for (const r of notOn) {
      const why = r.enabled === false ? 'is OFF' : `could not be verified (probe ${r.probe} → status ${r.status})`;
      console.error(`   • ${r.env} ${why} — needed by ${r.harness}.`);
    }
    console.error(
      '\n   This is NOT a privacy regression. With the flag OFF the flag-gated harness 503s on',
    );
    console.error(
      '   flag-gating rather than exercising the real per-student isolation, so the run would',
    );
    console.error('   be meaningless (false pass) or a confusing false fail. Enable the flag(s) — on the');
    console.error('   live Backend API workflow via .replit [userenv.development]; on the auto-boot path the');
    console.error('   suite sets them unless you explicitly pass FF_*=0 — then re-run.');
    if (startedServer) await teardownBackend(startedServer);
    process.exit(FLAG_PREFLIGHT_EXIT_CODE);
  }
  log('Preflight passed — all required feature flags are ON.\n');

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
