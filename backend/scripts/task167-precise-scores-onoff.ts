/**
 * Task #167 — combined on/off validation for the candidate precise-scores surface.
 *
 * Registers as ONE named validation step the two complementary proofs that
 * already exist as standalone scripts, so the additive precise-scores contract
 * is checked automatically on every change (a future edit can neither silently
 * leak the surface when the flag is OFF, nor break it when the flag is ON,
 * without this step failing):
 *
 *   1. FLAG-ON  — backend/scripts/task144-e2e-precise-scores.ts
 *      Drives the REAL HTTP surface of a live backend (register → run-assessment
 *      → precise-scores) with FF_COMPETENCY_RUNTIME ON. It needs a running
 *      Backend API on :8080. If the dev "Backend API" workflow is already up we
 *      reuse it; otherwise we boot a throwaway backend with the flag ON, wait
 *      for the port, run the proof, then tear it down — so this validation is
 *      self-contained and meaningful even when no workflow is running.
 *
 *   2. FLAG-OFF — backend/scripts/task159-flag-off-precise-scores.ts
 *      Mounts the same router in-process with FF_COMPETENCY_RUNTIME forced OFF
 *      and asserts the additive surface is byte-identically hidden. Fully
 *      self-contained (no external server needed).
 *
 * Each child runs in its OWN process so their opposite FF_COMPETENCY_RUNTIME
 * settings never collide. The step exits non-zero if EITHER proof fails.
 *
 * Run: cd backend && npx tsx scripts/task167-precise-scores-onoff.ts
 */
import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import net from 'net';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(SCRIPT_DIR, '..');

const PORT = 8080;
const HOST = '127.0.0.1';
const BOOT_TIMEOUT_MS = 90_000;

function hr(title: string) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

/** Resolve when a TCP connection to host:port succeeds, or false on timeout. */
function isPortOpen(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Run a tsx script as a child process; resolve with its exit code. */
function runScript(relPath: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', relPath], {
      cwd: BACKEND_DIR,
      env,
      stdio: 'inherit',
    });
    child.once('exit', (code) => resolve(code ?? 1));
    child.once('error', (err) => {
      console.error(`Failed to spawn ${relPath}:`, err);
      resolve(1);
    });
  });
}

/** Boot a throwaway backend with the precise-scores flag ON; resolve the process or null. */
function bootBackend(): Promise<ChildProcess | null> {
  return new Promise((resolve) => {
    console.log('Booting a throwaway Backend API (FF_COMPETENCY_RUNTIME=1) for the flag-ON proof…');
    const child = spawn('npm', ['run', 'dev:server'], {
      cwd: BACKEND_DIR,
      env: { ...process.env, FF_COMPETENCY_RUNTIME: '1', PORT: String(PORT) },
      stdio: 'inherit',
    });
    child.once('error', (err) => {
      console.error('Failed to boot backend:', err);
      resolve(null);
    });
    // Give the spawn a tick to fail fast before handing it back.
    setTimeout(() => resolve(child), 200);
  });
}

async function main() {
  let onCode = 1;
  let offCode = 1;

  // ── 1) FLAG-OFF (in-process, fully self-contained) ─────────────────────────
  hr('FLAG-OFF proof — task159-flag-off-precise-scores.ts (in-process)');
  offCode = await runScript('scripts/task159-flag-off-precise-scores.ts', { ...process.env });

  // ── 2) FLAG-ON (needs a live backend on :8080; boot one if absent) ─────────
  hr('FLAG-ON proof — task144-e2e-precise-scores.ts (live HTTP)');
  const alreadyUp = await isPortOpen(HOST, PORT);
  let booted: ChildProcess | null = null;

  try {
    if (alreadyUp) {
      console.log(`Reusing the live Backend API already listening on :${PORT}.`);
    } else {
      booted = await bootBackend();
      if (!booted) {
        console.error('FLAG-ON: could not boot a backend.');
        onCode = 1;
      } else {
        const ready = await waitForPort(HOST, PORT, BOOT_TIMEOUT_MS);
        if (!ready) {
          console.error(`FLAG-ON: backend did not start listening on :${PORT} within ${BOOT_TIMEOUT_MS}ms.`);
          onCode = 1;
        }
      }
    }

    const portReady = alreadyUp || (!!booted && (await isPortOpen(HOST, PORT)));
    if (portReady) {
      onCode = await runScript('scripts/task144-e2e-precise-scores.ts', {
        ...process.env,
        SMOKE_BASE: `http://${HOST}:${PORT}`,
      });
    }
  } finally {
    if (booted && !booted.killed) {
      booted.kill('SIGTERM');
      // Escalate if it ignores SIGTERM.
      const exited = await Promise.race([
        new Promise<boolean>((r) => booted!.once('exit', () => r(true))),
        new Promise<boolean>((r) => setTimeout(() => r(false), 5000)),
      ]);
      if (!exited) booted.kill('SIGKILL');
    }
  }

  // ── Combined verdict ───────────────────────────────────────────────────────
  hr('PRECISE-SCORES ON/OFF — COMBINED RESULT');
  console.log(`FLAG-OFF (task159): ${offCode === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`FLAG-ON  (task144): ${onCode === 0 ? 'PASS' : 'FAIL'}`);
  const ok = onCode === 0 && offCode === 0;
  console.log(`\n${ok ? 'ALL PASS — on/off contract verified.' : 'FAILURE — see the failing proof above.'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
