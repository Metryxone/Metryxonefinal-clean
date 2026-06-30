/**
 * Task #304 — Evidence-gated progression: deterministic verification of the
 * pure evidence-gate service (no DB, no HTTP). Proves the ON enrichment logic
 * for every verdict, the composed readiness (competency-scoring scoreToLevelBand)
 * + data-sufficiency (cohort-gating applyKAnonymity) axes, and the GAP-P1
 * re-measurement signal. OFF is not touched (the service is only reached when the
 * flag is ON — proven separately by the HTTP OFF smoke).
 */
import {
  evaluateStageEvidence,
  enrichProgressWithEvidence,
  EVIDENCE_FRESHNESS_DAYS,
  STAGE_READINESS_MIN_BAND,
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
const verified = evaluateStageEvidence({ status: 'completed', score: 72, updatedAt: daysAgo(10) }, { now: NOW });
check('completed+score(meets bar) → verified', verified.verdict === 'verified', verified.verdict);
check('verified coverage.has_score true', verified.coverage.has_score === true);
check('verified confidence.level verified', verified.confidence.level === 'verified', verified.confidence.level);
check('verified not due_for_remeasurement', verified.due_for_remeasurement === false);

const stale = evaluateStageEvidence({ status: 'completed', score: 55, updatedAt: daysAgo(EVIDENCE_FRESHNESS_DAYS + 30) }, { now: NOW });
check('completed+stale(meets bar) → verified verdict', stale.verdict === 'verified', stale.verdict);
check('stale due_for_remeasurement true (GAP-P1)', stale.due_for_remeasurement === true);
check('stale confidence.level provisional', stale.confidence.level === 'provisional', stale.confidence.level);
check('stale confidence.fresh false', stale.confidence.fresh === false);

const insufficient = evaluateStageEvidence({ status: 'completed', score: null, updatedAt: daysAgo(5) }, { now: NOW });
check('completed+no-score → insufficient_evidence', insufficient.verdict === 'insufficient_evidence', insufficient.verdict);
check('insufficient coverage.has_score false', insufficient.coverage.has_score === false);
check('insufficient due_for_remeasurement true', insufficient.due_for_remeasurement === true);

const inprog = evaluateStageEvidence({ status: 'in_progress', score: null, updatedAt: daysAgo(1) }, { now: NOW });
check('in_progress → in_progress', inprog.verdict === 'in_progress', inprog.verdict);

const absent = evaluateStageEvidence(undefined, { now: NOW });
check('absent → not_started', absent.verdict === 'not_started', absent.verdict);

console.log('\n[2] readiness — composed via competency-scoring scoreToLevelBand (score vs threshold)');
const ready = evaluateStageEvidence({ status: 'completed', score: 85, updatedAt: daysAgo(3) }, { now: NOW });
check('score 85 → readiness band 5', ready.readiness.band === 5, String(ready.readiness.band));
check('score 85 → label Advanced', ready.readiness.label === 'Advanced', String(ready.readiness.label));
check('score 85 → meets_threshold true', ready.readiness.meets_threshold === true);

const belowBar = evaluateStageEvidence({ status: 'completed', score: 25, updatedAt: daysAgo(3) }, { now: NOW });
check('score 25 (below band 3) → readiness band 2', belowBar.readiness.band === 2, String(belowBar.readiness.band));
check('score 25 → meets_threshold false', belowBar.readiness.meets_threshold === false);
check('completed but below bar → verdict below_bar', belowBar.verdict === 'below_bar', belowBar.verdict);
check('min_band reported = STAGE_READINESS_MIN_BAND', belowBar.readiness.min_band === STAGE_READINESS_MIN_BAND);
check('no-score → readiness band null (unmeasurable, never floored)', insufficient.readiness.band === null);

console.log('\n[3] data-sufficiency — composed via cohort-gating applyKAnonymity (NON-gating)');
const masked = evaluateStageEvidence({ status: 'completed', score: 70, updatedAt: daysAgo(3) }, { now: NOW, cohortN: 10 });
check('cohortN 10 → data_sufficiency masked', masked.confidence.data_sufficiency.status === 'masked', masked.confidence.data_sufficiency.status);
check('cohortN 10 → verdict STILL verified (data-sufficiency never gates)', masked.verdict === 'verified', masked.verdict);
const prov = evaluateStageEvidence({ status: 'completed', score: 70, updatedAt: daysAgo(3) }, { now: NOW, cohortN: 45 });
check('cohortN 45 → data_sufficiency provisional', prov.confidence.data_sufficiency.status === 'provisional', prov.confidence.data_sufficiency.status);
const ver = evaluateStageEvidence({ status: 'completed', score: 70, updatedAt: daysAgo(3) }, { now: NOW, cohortN: 150 });
check('cohortN 150 → data_sufficiency verified', ver.confidence.data_sufficiency.status === 'verified', ver.confidence.data_sufficiency.status);

console.log('\n[4] enrichProgressWithEvidence — GAP-P2 advancement gate');
const STAGES: LegacyProgressStage[] = [
  { stage_code: 'CAP_CUR', stage_label: 'Curiosity', stage_index: 0, stage_color: '#3B82F6', status: 'completed', score: 70 },
  { stage_code: 'CAP_INS', stage_label: 'Insight',   stage_index: 1, stage_color: '#10B981', status: 'available', score: null },
  { stage_code: 'CAP_GRW', stage_label: 'Growth',    stage_index: 2, stage_color: '#F59E0B', status: 'locked',    score: null },
  { stage_code: 'CAP_MAS', stage_label: 'Mastery',   stage_index: 3, stage_color: '#8B5CF6', status: 'locked',    score: null },
];

// Case A: CUR verified (score meets bar) → INS available (unlocked).
const a = enrichProgressWithEvidence(STAGES, {
  CAP_CUR: { status: 'completed', score: 70, updatedAt: daysAgo(5) },
}, { now: NOW });
check('A: CUR gate verified', a[0].gate.verdict === 'verified');
check('A: INS available (prior verified)', a[1].status === 'available', a[1].status);
check('A: INS gate not_started', a[1].gate.verdict === 'not_started', a[1].gate.verdict);
check('A: every stage carries a gate', a.every(s => !!s.gate));

// Case B: CUR completed but NO score → INS locked + blocked (evidence gate bites).
const b = enrichProgressWithEvidence(STAGES, {
  CAP_CUR: { status: 'completed', score: null, updatedAt: daysAgo(5) },
}, { now: NOW });
check('B: CUR insufficient_evidence', b[0].gate.verdict === 'insufficient_evidence', b[0].gate.verdict);
check('B: INS LOCKED (prior not verified)', b[1].status === 'locked', b[1].status);
check('B: INS gate blocked', b[1].gate.verdict === 'blocked', b[1].gate.verdict);

// Case C: CUR completed but readiness BELOW bar → INS locked + blocked (readiness gate bites).
const cc = enrichProgressWithEvidence(STAGES, {
  CAP_CUR: { status: 'completed', score: 18, updatedAt: daysAgo(5) },
}, { now: NOW });
check('C: CUR below_bar', cc[0].gate.verdict === 'below_bar', cc[0].gate.verdict);
check('C: INS LOCKED (prior below bar)', cc[1].status === 'locked', cc[1].status);
check('C: INS gate blocked', cc[1].gate.verdict === 'blocked', cc[1].gate.verdict);
check('C: INS blocked reason mentions readiness', /readiness/i.test(cc[1].gate.reason), cc[1].gate.reason);

// Case D: no evidence at all → CUR available (i=0), rest blocked.
const d = enrichProgressWithEvidence(STAGES, {}, { now: NOW });
check('D: CUR available at index 0', d[0].status === 'available', d[0].status);
check('D: INS blocked (no prior evidence)', d[1].gate.verdict === 'blocked', d[1].gate.verdict);

console.log('\n[5] legacy shape preserved (additive only)');
check('keeps stage_code/label/index/color/status/score', ['stage_code','stage_label','stage_index','stage_color','status','score'].every(k => k in a[0]));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
