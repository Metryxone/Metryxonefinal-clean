/**
 * Decision Engine — Phase 4
 * Evaluates user choices, identifies optimal paths,
 * accumulates trait vectors, and extracts behavioral signals from decisions.
 */

import type { DecisionChoice, DecisionNode, Scenario } from './scenarioEngine';

/* ── Session tracking ─────────────────────────────────────────────── */
export interface DecisionRecord {
  nodeId:      string;
  choiceId:    string;
  choice:      DecisionChoice;
  timestamp:   number;
  timeTaken?:  number;        // ms; set if time pressure was active
  traitVector: Record<string, number>;
}

export interface SessionDecisionState {
  sessionId:   string;
  scenarioId:  string;
  decisions:   DecisionRecord[];
  currentNodeIndex: number;
  cumulativeTraits: Record<string, number>;
  signalsSoFar:     Record<string, number>;  // signalTag → cumulative count
  completed:        boolean;
}

/* ── Optimal choice computation ───────────────────────────────────── */
export function computeOptimalChoice(node: DecisionNode): string {
  // Optimal = highest combined positive trait score
  let best = node.choices[0].id;
  let bestScore = -Infinity;
  for (const ch of node.choices) {
    const score = Object.values(ch.traits).reduce((s, v) => s + (v ?? 0), 0);
    if (score > bestScore) { bestScore = score; best = ch.id; }
  }
  return best;
}

export function scoreChoice(choice: DecisionChoice): number {
  const raw = Object.values(choice.traits).reduce((s, v) => s + (v ?? 0), 0);
  // Normalise: max possible is ~16 (8 traits × +2 each)
  return Math.min(100, Math.max(0, Math.round(((raw + 16) / 32) * 100)));
}

/* ── Trait accumulation ───────────────────────────────────────────── */
export function accumulateTraits(
  current:  Record<string, number>,
  choice:   DecisionChoice,
): Record<string, number> {
  const next = { ...current };
  for (const [trait, val] of Object.entries(choice.traits)) {
    next[trait] = (next[trait] ?? 0) + (val ?? 0);
  }
  return next;
}

export function normaliseTraits(raw: Record<string, number>, decisionCount: number): Record<string, number> {
  if (decisionCount === 0) return raw;
  const result: Record<string, number> = {};
  for (const [trait, val] of Object.entries(raw)) {
    // Each trait can be -2 to +2 per decision; normalise to 0-100
    const maxPossible = 2 * decisionCount;
    result[trait] = Math.min(100, Math.max(0, Math.round(((val + maxPossible) / (maxPossible * 2)) * 100)));
  }
  return result;
}

/* ── Decision path analysis ───────────────────────────────────────── */
export interface DecisionPathAnalysis {
  totalDecisions:   number;
  avgChoiceScore:   number;
  optimalChoices:   number;     // how many decisions matched the optimal choice
  optimalPct:       number;
  traitProfile:     Record<string, number>;   // normalised 0-100
  dominantTraits:   string[];
  weakTraits:       string[];
  signalCounts:     Record<string, number>;   // cumulative signal tags
  hesitationCount:  number;
  timePressurePerformance: number | null;  // 0-100 or null if no time pressure
}

export function analyseDecisionPath(
  decisions:  DecisionRecord[],
  scenario:   Scenario,
): DecisionPathAnalysis {
  const n = decisions.length;
  if (n === 0) return {
    totalDecisions:0, avgChoiceScore:0, optimalChoices:0, optimalPct:0,
    traitProfile:{}, dominantTraits:[], weakTraits:[], signalCounts:{},
    hesitationCount:0, timePressurePerformance:null,
  };

  // Choice scores
  const scores = decisions.map(d => scoreChoice(d.choice));
  const avgChoiceScore = Math.round(scores.reduce((s, v) => s + v, 0) / n);

  // Optimal matches
  let optCount = 0;
  for (const d of decisions) {
    const node = scenario.nodes.find(nd => nd.id === d.nodeId);
    if (node && computeOptimalChoice(node) === d.choiceId) optCount++;
  }
  const optimalPct = Math.round((optCount / n) * 100);

  // Cumulative traits
  let rawTraits: Record<string, number> = {};
  for (const d of decisions) rawTraits = accumulateTraits(rawTraits, d.choice);
  const traitProfile = normaliseTraits(rawTraits, n);

  // Sort traits
  const sorted    = Object.entries(traitProfile).sort(([,a],[,b]) => b - a);
  const dominant  = sorted.slice(0, 3).filter(([,v]) => v >= 60).map(([k]) => k);
  const weak      = sorted.slice(-3).filter(([,v]) => v < 40).map(([k]) => k);

  // Signal counts
  const signalCounts: Record<string, number> = {};
  for (const d of decisions) {
    for (const tag of d.choice.signalTags ?? []) {
      signalCounts[tag] = (signalCounts[tag] ?? 0) + 1;
    }
  }
  const hesitationCount = signalCounts['hesitation'] ?? 0;

  // Time pressure performance
  const tpDecisions = decisions.filter(d => {
    const node = scenario.nodes.find(nd => nd.id === d.nodeId);
    return (node?.timePressure ?? 0) > 0 && d.timeTaken !== undefined;
  });
  let timePressurePerformance: number | null = null;
  if (tpDecisions.length > 0) {
    const tpScores = tpDecisions.map(d => {
      const node = scenario.nodes.find(nd => nd.id === d.nodeId)!;
      const budget = (node.timePressure ?? 60) * 1000;
      const taken  = d.timeTaken ?? budget;
      // Score: optimal choice + took less than 80% of available time = 100
      const timeScore   = Math.max(0, Math.round((1 - Math.min(1, taken / budget)) * 40));
      const choiceScore = scoreChoice(d.choice);
      return Math.min(100, choiceScore + timeScore);
    });
    timePressurePerformance = Math.round(tpScores.reduce((s, v) => s + v, 0) / tpDecisions.length);
  }

  return {
    totalDecisions: n, avgChoiceScore, optimalChoices: optCount, optimalPct,
    traitProfile, dominantTraits: dominant, weakTraits: weak,
    signalCounts, hesitationCount, timePressurePerformance,
  };
}

/* ── Session helpers ──────────────────────────────────────────────── */
export function initDecisionSession(sessionId: string, scenarioId: string): SessionDecisionState {
  return { sessionId, scenarioId, decisions:[], currentNodeIndex:0, cumulativeTraits:{}, signalsSoFar:{}, completed:false };
}

export function recordDecision(
  state:  SessionDecisionState,
  nodeId: string,
  choice: DecisionChoice,
  timeTaken?: number,
): SessionDecisionState {
  const record: DecisionRecord = {
    nodeId, choiceId:choice.id, choice, timestamp:Date.now(), timeTaken,
    traitVector: { ...choice.traits } as Record<string, number>,
  };
  const newTraits = accumulateTraits(state.cumulativeTraits, choice);
  const newSignals = { ...state.signalsSoFar };
  for (const tag of choice.signalTags ?? []) newSignals[tag] = (newSignals[tag] ?? 0) + 1;
  return {
    ...state,
    decisions:       [...state.decisions, record],
    currentNodeIndex:state.currentNodeIndex + 1,
    cumulativeTraits:newTraits,
    signalsSoFar:    newSignals,
  };
}

export function getCurrentNode(state: SessionDecisionState, scenario: Scenario): DecisionNode | null {
  return scenario.nodes[state.currentNodeIndex] ?? null;
}

export function isScenarioComplete(state: SessionDecisionState, scenario: Scenario): boolean {
  return state.currentNodeIndex >= scenario.nodes.length;
}
