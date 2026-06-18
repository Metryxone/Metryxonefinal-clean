/**
 * CAPADEX PIL — Phase 2.2 archetype governance regression tests.
 *
 *   npx tsx backend/tests/archetype-governance.test.ts
 *
 * Two layers:
 *   A. PURE applyGovernance unit tests (no DB) — byte-identical identity transform with
 *      zero decisions; reassign/resolve_unmatched/reject/approve semantics; skip guards.
 *   B. DB-backed compute guarantee — computeArchetypeResult with [] decisions reproduces
 *      the Phase-2.1 baseline (2151 assigned / 338 unmatched) byte-for-byte, and a single
 *      synthetic resolve_unmatched decision survives a recompute (the "survives re-run"
 *      canon). Layer B is skipped gracefully when DATABASE_URL is absent.
 */
import { Pool } from 'pg';
import {
  applyGovernance, type GovernanceDecision,
} from '../services/pil/archetype-governance.js';
import { computeArchetypeResult } from '../services/pil/archetype-pipeline.js';
import {
  ARCHETYPES, type Assignment, type ConcernContext,
} from '../services/pil/archetype-intelligence-engine.js';

let passed = 0;
let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}
function eq(a: unknown, b: unknown, msg: string): void {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

const KEY_A = ARCHETYPES[0].key;
const KEY_B = ARCHETYPES[1].key;

function asg(partial: Partial<Assignment> & { concernId: string }): Assignment {
  return {
    concernId: partial.concernId,
    archetypeKey: partial.archetypeKey ?? null,
    score: partial.score ?? 0,
    tokenMatches: partial.tokenMatches ?? 0,
    method: partial.method ?? 'unmatched',
    grounding: partial.grounding ?? 'name_only',
    bestScore: partial.bestScore ?? 0,
    bestArchetypeKey: partial.bestArchetypeKey ?? KEY_A,
  };
}
function ctx(id: string, over: Partial<ConcernContext> = {}): ConcernContext {
  return { concernId: id, concernName: id, canonicalType: 'Problem', behaviorCounts: {}, ...over };
}

function pureTests(): void {
  console.log('\n[A] applyGovernance — pure');

  // A1 — zero decisions is an identity transform (byte-identical guarantee).
  {
    const base = [
      asg({ concernId: 'c1', archetypeKey: KEY_A, score: 0.7, method: 'signature', grounding: 'direct_cpb', bestScore: 0.7, bestArchetypeKey: KEY_A }),
      asg({ concernId: 'c2', archetypeKey: null, bestScore: 0.2, bestArchetypeKey: KEY_B }),
    ];
    const ctxOf = new Map([['c1', ctx('c1')], ['c2', ctx('c2')]]);
    const r = applyGovernance(base, ctxOf, []);
    eq(r.assignments, base, 'zero decisions → assignments unchanged');
    eq(r.governedIds.size, 0, 'zero decisions → no governed ids');
    eq(r.summary.active, 0, 'zero decisions → active 0');
    ok(r.assignments !== base, 'returns a fresh array (inputs not mutated by reference)');
  }

  // A2 — resolve_unmatched pulls an unmatched concern into a target archetype.
  {
    const base = [asg({ concernId: 'u1', archetypeKey: null, bestScore: 0.31, bestArchetypeKey: KEY_B })];
    const ctxOf = new Map([['u1', ctx('u1', { hasDirectCapabilityProblem: true })]]);
    const d: GovernanceDecision = { concernId: 'u1', decisionType: 'resolve_unmatched', targetArchetypeKey: KEY_A, rationale: 't', decidedBy: 'tester' };
    const r = applyGovernance(base, ctxOf, [d]);
    const a = r.assignments[0];
    eq(a.archetypeKey, KEY_A, 'resolve → archetypeKey = target');
    eq(a.method, 'human_override', 'resolve → method human_override');
    eq(a.score, 0.31, 'resolve → recovers bestScore as effective score');
    eq(a.grounding, 'direct_cpb', 'resolve → recovers honest grounding from ctx');
    ok(r.governedIds.has('u1'), 'resolve → id is governed');
    eq(r.summary.resolve_unmatched, 1, 'resolve → counted');
  }

  // A3 — reassign moves an already-matched concern; keeps its score.
  {
    const base = [asg({ concernId: 'm1', archetypeKey: KEY_A, score: 0.6, method: 'signature', grounding: 'direct_cpb', bestScore: 0.6, bestArchetypeKey: KEY_A })];
    const ctxOf = new Map([['m1', ctx('m1')]]);
    const d: GovernanceDecision = { concernId: 'm1', decisionType: 'reassign', targetArchetypeKey: KEY_B, rationale: 't', decidedBy: 'tester' };
    const r = applyGovernance(base, ctxOf, [d]);
    eq(r.assignments[0].archetypeKey, KEY_B, 'reassign → archetypeKey = target');
    eq(r.assignments[0].method, 'human_override', 'reassign → method human_override');
    eq(r.assignments[0].score, 0.6, 'reassign → keeps existing score (not unmatched)');
    eq(r.summary.reassign, 1, 'reassign → counted');
  }

  // A4 — reject drops a matched concern back to unmatched.
  {
    const base = [asg({ concernId: 'r1', archetypeKey: KEY_A, score: 0.5, method: 'signature', grounding: 'direct_cpb', bestScore: 0.5, bestArchetypeKey: KEY_A })];
    const ctxOf = new Map([['r1', ctx('r1')]]);
    const d: GovernanceDecision = { concernId: 'r1', decisionType: 'reject', targetArchetypeKey: null, rationale: 't', decidedBy: 'tester' };
    const r = applyGovernance(base, ctxOf, [d]);
    eq(r.assignments[0].archetypeKey, null, 'reject → archetypeKey null (back to unmatched)');
    ok(r.rejectedIds.has('r1'), 'reject → id in rejectedIds');
    eq(r.summary.reject, 1, 'reject → counted');
  }

  // A5 — approve is sign-off only (no routing change).
  {
    const base = [asg({ concernId: 'a1', archetypeKey: KEY_A, score: 0.5, method: 'signature', grounding: 'direct_cpb', bestScore: 0.5, bestArchetypeKey: KEY_A })];
    const ctxOf = new Map([['a1', ctx('a1')]]);
    const d: GovernanceDecision = { concernId: 'a1', decisionType: 'approve', targetArchetypeKey: null, rationale: 't', decidedBy: 'tester' };
    const r = applyGovernance(base, ctxOf, [d]);
    eq(r.assignments[0].archetypeKey, KEY_A, 'approve → routing unchanged');
    eq(r.assignments[0].method, 'signature', 'approve → method unchanged');
    ok(r.governedIds.has('a1'), 'approve → id governed (signed off)');
    eq(r.summary.approve, 1, 'approve → counted');
  }

  // A6 — skip guards: unknown concern + invalid target.
  {
    const base = [asg({ concernId: 'k1', archetypeKey: null, bestScore: 0.1, bestArchetypeKey: KEY_A })];
    const ctxOf = new Map([['k1', ctx('k1')]]);
    const decisions: GovernanceDecision[] = [
      { concernId: 'ghost', decisionType: 'approve', targetArchetypeKey: null, rationale: '', decidedBy: 't' },
      { concernId: 'k1', decisionType: 'reassign', targetArchetypeKey: 'NOPE', rationale: '', decidedBy: 't' },
    ];
    const r = applyGovernance(base, ctxOf, decisions);
    eq(r.summary.skipped, 2, 'skip → unknown concern + invalid target both skipped');
    eq(r.assignments[0].archetypeKey, null, 'skip → invalid target leaves assignment untouched');
  }
}

async function dbTests(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('\n[B] DB compute — SKIPPED (no DATABASE_URL)');
    return;
  }
  console.log('\n[B] computeArchetypeResult — DB-backed');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const baseline = await computeArchetypeResult(pool, []);
    eq(baseline.assignedCount, 2151, 'baseline (0 decisions) → 2151 assigned');
    eq(baseline.unmatchedCount, 338, 'baseline (0 decisions) → 338 unmatched');
    eq(baseline.governance.active, 0, 'baseline → 0 active decisions');

    // A previously-unmatched concern resolved into an archetype survives the recompute.
    const u = baseline.unmatchedRows[0];
    ok(!!u, 'baseline has at least one unmatched concern to resolve');
    const target = ARCHETYPES[0].key;
    const withDecision = await computeArchetypeResult(pool, [
      { concernId: u.id, decisionType: 'resolve_unmatched', targetArchetypeKey: target, rationale: 'test', decidedBy: 'tester' },
    ]);
    eq(withDecision.assignedCount, 2152, 'resolve survives recompute → +1 assigned');
    eq(withDecision.unmatchedCount, 337, 'resolve survives recompute → -1 unmatched');
    ok(withDecision.governedIds.has(u.id), 'resolved concern is marked governed');
    const moved = withDecision.assignments.find((a) => a.concernId === u.id);
    eq(moved?.archetypeKey, target, 'resolved concern now in target archetype');
    eq(moved?.method, 'human_override', 'resolved concern method = human_override');

    // A reject drops an assigned concern back to unmatched.
    const assignedRow = baseline.assignments.find((a) => a.archetypeKey != null)!;
    const withReject = await computeArchetypeResult(pool, [
      { concernId: assignedRow.concernId, decisionType: 'reject', targetArchetypeKey: null, rationale: 'test', decidedBy: 'tester' },
    ]);
    eq(withReject.assignedCount, 2150, 'reject → -1 assigned');
    eq(withReject.unmatchedCount, 339, 'reject → +1 unmatched');
    ok(withReject.unmatchedRows.some((r) => r.id === assignedRow.concernId && /rejected/i.test(r.reason)), 'rejected concern carries human-reject reason');
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  console.log('=== PIL 2.2 archetype governance tests ===');
  pureTests();
  await dbTests();
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
