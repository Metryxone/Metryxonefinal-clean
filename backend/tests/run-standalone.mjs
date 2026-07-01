#!/usr/bin/env node
// Aggregate runner for the standalone (non-`node:test`) engine test scripts.
//
// These ~48 `tests/*.test.ts` files do NOT import `node:test`. They are plain
// `tsx tests/<name>.test.ts` scripts that self-assert and exit non-zero on any
// failed assertion (they use `node:assert`, so a failed assertion throws and
// crashes the process). Historically none of them were in any automated gate,
// so engine regressions could land silently. This runner spawns each one,
// aggregates pass/fail, and exits non-zero if ANY script fails.
//
// The split mirrors the existing `test:pure` / `test:db` node:test gates:
//   - PURE  : no external services — safe to run in CI (validation gate).
//   - DB    : needs a live, seeded `DATABASE_URL`.
//   - QUARANTINE : real, currently-failing, data-dependent scripts. NOT run by
//                  any gate so they never hide failures, but documented here and
//                  in tests/README.md so they are not silently lost.
//
// Usage: node tests/run-standalone.mjs <pure|db>

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// ── PURE: no live DB required — CI-safe (each verified to pass with DATABASE_URL unset) ──
const PURE = [
  'adaptive-question-pipeline',
  'admin-auth-guard',
  'archetype-intelligence-engine',
  'atomic-bridge-resolver',
  'behavior-intelligence-engine',
  'capadex-reassessment-signal',
  'career-evidence-engine',
  'cohort-gating',
  'concern-classification-engine',
  'concern-ontology-engine',
  'concern-resolver-engine',
  'concern-signal-map',
  'developmental-sanitizer',
  'feature-flags',
  'framework-admin-gate',
  'go-live-certification-route',
  'human-intelligence-engine',
  'intervention-intelligence-engine',
  'knowledge-graph',
  'knowledge-graph-explainability',
  'knowledge-graph-gap',
  'knowledge-graph-maturation',
  'knowledge-graph-similarity',
  'knowledge-graph-traversal',
  'knowledge-graph-validation',
  'launchpad-dashboard-privacy',
  'live-avatar-degradation',
  'module-access-control',
  'omega-x-scoring',
  'password-policy',
  'prediction-engine',
  'proxy-cleanup-planner',
  'rbac-enforcement',
  'recommendation-engine',
  'report-engine',
  'report-precise-competency',
  'search-intent-engine',
  'stakeholder-summary-engine',
  'strength-discovery-engine',
  'voice-screening-degradation',
];

// ── DB: require a live, seeded `DATABASE_URL` (skipped when it is absent) ──
const DB = [
  'employer-job-posting',
  'pipeline-resolver',
  'proxy-language-engine',
  'recruiter-postings-schema',
  'runtime-guidance-engine',
  'student-write-idor',
];

// ── QUARANTINE: real, data-dependent failures — NOT run by any gate (see README) ──
const QUARANTINE = [
  'archetype-governance',
  'clarity-picker-fallback',
];

const mode = (process.argv[2] || '').toLowerCase();
const suites = mode === 'pure' ? PURE : mode === 'db' ? DB : null;

if (!suites) {
  console.error('Usage: node tests/run-standalone.mjs <pure|db>');
  process.exit(2);
}

if (mode === 'db' && !process.env.DATABASE_URL) {
  console.log('[standalone:db] DATABASE_URL not set — skipping DB engine scripts (CI-safe).');
  process.exit(0);
}

console.log(`[standalone:${mode}] running ${suites.length} script(s)\n`);

const failures = [];
for (const name of suites) {
  const file = resolve(here, `${name}.test.ts`);
  process.stdout.write(`• ${name} ... `);
  const r = spawnSync('npx', ['tsx', file], {
    cwd: resolve(here, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status === 0) {
    console.log('PASS');
  } else {
    console.log(`FAIL (exit ${r.status})`);
    failures.push({ name, status: r.status, out: (r.stdout || '') + (r.stderr || '') });
  }
}

console.log('');
if (failures.length) {
  console.log(`[standalone:${mode}] ${failures.length}/${suites.length} FAILED:\n`);
  for (const f of failures) {
    console.log(`──────── ${f.name} (exit ${f.status}) ────────`);
    console.log(f.out.trim().split('\n').slice(-25).join('\n'));
    console.log('');
  }
  process.exit(1);
}

console.log(`[standalone:${mode}] all ${suites.length} script(s) passed.`);
