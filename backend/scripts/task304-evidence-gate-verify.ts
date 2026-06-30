/**
 * Task #304 — Evidence-gated progression: deterministic verification of the
 * pure evidence-gate service (no DB, no HTTP). Proves the ON enrichment logic
 * for every verdict + the GAP-P1 re-measurement signal, and that OFF is not
 * touched (the service is only reached when the flag is ON — proven separately
 * by the HTTP OFF smoke).
 */
import {
  evaluateStageEvidence,
  enrichProgressWithEvidence,
  EVIDENCE_FRESHNESS_DAYS,
  type LegacyProgressStage,
} from '../services/capadex/evidence-gate';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const NOW = new Date('2026-06-30T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

console.log('\n[1] evaluateStageEvidence — per-verdict');
const verified = evaluateStageEvidence({ status: 'completed', score: 72, updatedAt: daysAgo(10) }, EVIDENCE_FRESHNESS_DAYS, NOW);
check('completed+score → verified', verified.verdict === 'verified', verified.verdict);
check('verified coverage.has_score true', verified.coverage.has_score === true);
check('verified confidence.level verified', verified.confidence.level === 'verified', verified.confidence.level);
check('verified not due_for_remeasurement', verified.due_for_remeasurement === false);

const stale = evaluateStageEvidence({ status: 'completed', score: 55, updatedAt: daysAgo(EVIDENCE_FRESHNESS_DAYS + 30) }, EVIDENCE_FRESHNESS_DAYS, NOW);
check('completed+stale → verified verdict', stale.verdict === 'verified', stale.verdict);
check('stale due_for_remeasurement true (GAP-P1)', stale.due_for_remeasurement === true);
check('stale confidence.level provisional', stale.confidence.level === 'provisional', stale.confidence.level);
check('stale confidence.fresh false', stale.confidence.fresh === false);

const insufficient = evaluateStageEvidence({ status: 'completed', score: null, updatedAt: daysAgo(5) }, EVIDENCE_FRESHNESS_DAYS, NOW);
check('completed+no-score → insufficient_evidence', insufficient.verdict === 'insufficient_evidence', insufficient.verdict);
check('insufficient coverage.has_score false', insufficient.coverage.has_score === false);
check('insufficient due_for_remeasurement true', insufficient.due_for_remeasurement === true);

const inprog = evaluateStageEvidence({ status: 'in_progress', score: null, updatedAt: daysAgo(1) }, EVIDENCE_FRESHNESS_DAYS, NOW);
check('in_progress → in_progress', inprog.verdict === 'in_progress', inprog.verdict);

const absent = evaluateStageEvidence(undefined, EVIDENCE_FRESHNESS_DAYS, NOW);
check('absent → not_started', absent.verdict === 'not_started', absent.verdict);

console.log('\n[2] informational below_reference_band is NON-gating (strengths-canon)');
const low = evaluateStageEvidence({ status: 'completed', score: 12, updatedAt: daysAgo(3) }, EVIDENCE_FRESHNESS_DAYS, NOW);
check('low score still verdict=verified (NOT blocked by concern magnitude)', low.verdict === 'verified', low.verdict);
check('low score flagged informational.below_reference_band', low.informational.below_reference_band === true);

console.log('\n[3] enrichProgressWithEvidence — GAP-P2 advancement gate');
const STAGES: LegacyProgressStage[] = [
  { stage_code: 'CAP_CUR', stage_label: 'Curiosity', stage_index: 0, stage_color: '#3B82F6', status: 'completed', score: 70 },
  { stage_code: 'CAP_INS', stage_label: 'Insight',   stage_index: 1, stage_color: '#10B981', status: 'available', score: null },
  { stage_code: 'CAP_GRW', stage_label: 'Growth',    stage_index: 2, stage_color: '#F59E0B', status: 'locked',    score: null },
  { stage_code: 'CAP_MAS', stage_label: 'Mastery',   stage_index: 3, stage_color: '#8B5CF6', status: 'locked',    score: null },
];

// Case A: CUR verified → INS available (unlocked).
const a = enrichProgressWithEvidence(STAGES, {
  CAP_CUR: { status: 'completed', score: 70, updatedAt: daysAgo(5) },
}, EVIDENCE_FRESHNESS_DAYS, NOW);
check('A: CUR gate verified', a[0].gate.verdict === 'verified');
check('A: INS available (prior verified)', a[1].status === 'available', a[1].status);
check('A: INS gate not_started', a[1].gate.verdict === 'not_started', a[1].gate.verdict);
check('A: every stage carries a gate', a.every(s => !!s.gate));

// Case B: CUR completed but NO score → INS locked + blocked (evidence gate bites).
const b = enrichProgressWithEvidence(STAGES, {
  CAP_CUR: { status: 'completed', score: null, updatedAt: daysAgo(5) },
}, EVIDENCE_FRESHNESS_DAYS, NOW);
check('B: CUR insufficient_evidence', b[0].gate.verdict === 'insufficient_evidence', b[0].gate.verdict);
check('B: INS LOCKED (prior not verified)', b[1].status === 'locked', b[1].status);
check('B: INS gate blocked', b[1].gate.verdict === 'blocked', b[1].gate.verdict);

// Case C: no evidence at all → CUR available (i=0), rest blocked.
const c = enrichProgressWithEvidence(STAGES, {}, EVIDENCE_FRESHNESS_DAYS, NOW);
check('C: CUR available at index 0', c[0].status === 'available', c[0].status);
check('C: INS blocked (no prior evidence)', c[1].gate.verdict === 'blocked', c[1].gate.verdict);

console.log('\n[4] legacy shape preserved (additive only)');
check('keeps stage_code/label/index/color/status/score', ['stage_code','stage_label','stage_index','stage_color','status','score'].every(k => k in a[0]));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
