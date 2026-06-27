/**
 * Cross-org isolation regression suite (Task #230).
 *
 * Runs the three live-avatar cross-org safety scripts as a single named check:
 *   • task224 — cross-org READ isolation (IDOR on live-avatar reads)
 *   • task226 — cross-org WRITE isolation (no writing into another org's session)
 *   • task223 — live-avatar billing-cap backstop
 *
 * These were standalone tsx scripts that only ran when someone remembered to
 * invoke them by hand. This runner wires them into one regression-proof gate:
 * it executes ALL three (continuing past a failure so the full picture is
 * visible in one run) and exits non-zero if ANY of them fails. A refactor of
 * voice-screening.ts that silently drops `employer_id` scoping will fail this
 * check before it can merge/deploy.
 *
 * Run: cd backend && npm run test:isolation
 */
import { spawn } from 'child_process';
import * as path from 'path';

const SCRIPTS = [
  'task224-live-avatar-cross-org-isolation.ts',
  'task226-live-avatar-cross-org-write-isolation.ts',
  'task223-live-avatar-billing-cap.ts',
];

function runScript(file: string): Promise<number> {
  const scriptPath = path.join(__dirname, file);
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(72)}\n▶ RUNNING ${file}\n${'='.repeat(72)}`);
    const child = spawn('npx', ['tsx', scriptPath], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`Failed to start ${file}:`, err);
      resolve(1);
    });
  });
}

async function main() {
  const results: { file: string; code: number }[] = [];
  for (const file of SCRIPTS) {
    const code = await runScript(file);
    results.push({ file, code });
  }

  console.log(`\n${'='.repeat(72)}\nCROSS-ORG ISOLATION SUITE — SUMMARY\n${'='.repeat(72)}`);
  for (const { file, code } of results) {
    console.log(`${code === 0 ? 'PASS' : 'FAIL'} — ${file}${code === 0 ? '' : ` (exit ${code})`}`);
  }

  const failed = results.filter((r) => r.code !== 0);
  if (failed.length > 0) {
    console.log(`\nCROSS-ORG ISOLATION SUITE: ${failed.length} SCRIPT(S) FAILED`);
    process.exit(1);
  }
  console.log('\nCROSS-ORG ISOLATION SUITE: ALL PASS');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
