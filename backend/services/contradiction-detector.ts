/**
 * Contradiction Detector — Phase 2.
 *
 * Surface behavioural inconsistencies between claims and evidence without
 * making any assertion about hiring suitability. Output is a developmental
 * flag the user can use to strengthen their narrative.
 *
 * Rules (composable, declarative):
 *   - leadership_without_ownership       — leadership claim but ownership signal absent
 *   - strategy_without_systems_thinking  — strategy claim but no systems framing
 *   - inflated_project_scale             — superlative scale w/o supporting numbers
 *   - inconsistent_timelines             — overlapping experience timelines
 *   - quantification_gap                 — quantified-outcomes signal far below peers
 *   - hedging_dominant                   — hedging language overshadows ownership
 *
 * Output:
 *   {
 *     contradiction_score:  0..1 (composite — higher = more contradiction)
 *     contradiction_flags[] (per-rule explanations + evidence pointers)
 *   }
 */

import type { EvidenceSource } from './evidence-extractor.js';
import type { SignalKey, SignalScore } from './behavioral-signal-engine.js';

export const CONTRADICTION_VERSION = '2.0.0';

export interface ContradictionFlag {
  rule_id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  /** Optional pointer back to the offending source for UI provenance. */
  source_ids?: string[];
  developmental_action?: string;
}

export interface ContradictionResult {
  contradiction_score: number;        // 0..1
  contradiction_flags: ContradictionFlag[];
  rules_evaluated: number;
}

interface Rule {
  id: string;
  evaluate: (ctx: { sources: EvidenceSource[]; scores: SignalScore[] }) => ContradictionFlag | null;
  weight: number;                     // contribution to composite score
}

const HEDGE_RE    = /\b(i think|i guess|maybe|sort of|kind of|probably|might|perhaps)\b/gi;
const OWNERSHIP_RE = /\b(i (owned|led|drove|delivered|shipped|launched|built|created))\b/gi;
const LEAD_CLAIM_RE = /\b(led|leading|leadership of|head of|manag(ed|ing) (a )?team)\b/i;
const STRATEGY_RE   = /\b(strategy|strategic|roadmap|long.?term plan)\b/i;
const SUPERLATIVE_RE = /\b(largest|biggest|most (significant|critical)|massive|huge|record(.| )?breaking)\b/i;
const NUMERIC_RE    = /\b\d{2,}\s?(%|x|k|cr|lakh|crore|million|bn|rs\.?|\$|usd|inr)?\b/i;

function findSignal(scores: SignalScore[], key: SignalKey): SignalScore | undefined {
  return scores.find(s => s.signal_key === key);
}

const RULES: Rule[] = [
  // ── leadership_without_ownership ─────────────────────────────────────────
  {
    id: 'leadership_without_ownership',
    weight: 0.25,
    evaluate: ({ sources, scores }) => {
      const leadClaim = sources.some(s => LEAD_CLAIM_RE.test(s.text));
      if (!leadClaim) return null;
      const ownership = findSignal(scores, 'ownership_signals');
      if (ownership && ownership.behavioural_strength >= 0.35) return null;
      return {
        rule_id: 'leadership_without_ownership',
        severity: ownership ? 'medium' : 'high',
        title: 'Leadership claim without supporting ownership signals',
        detail: ownership
          ? `You claim leadership experience but your ownership-signal strength is only ${(ownership.behavioural_strength * 100).toFixed(0)}%. Add first-person, action-verb examples (I owned, I delivered, I shipped).`
          : `You claim leadership experience but the narrative carries no first-person ownership signals. Add concrete "I owned / I led / I delivered …" examples with outcomes.`,
        source_ids: sources.filter(s => LEAD_CLAIM_RE.test(s.text)).slice(0, 3).map(s => s.source_id),
        developmental_action: 'Rewrite at least two experience bullets to start with a first-person action verb and end with a measurable outcome.',
      };
    },
  },

  // ── strategy_without_systems_thinking ────────────────────────────────────
  {
    id: 'strategy_without_systems_thinking',
    weight: 0.20,
    evaluate: ({ sources, scores }) => {
      const strategyClaim = sources.some(s => STRATEGY_RE.test(s.text));
      if (!strategyClaim) return null;
      const sysFraming  = findSignal(scores, 'systems_framing');
      const secondOrder = findSignal(scores, 'second_order_reasoning');
      const aggregate = (sysFraming?.behavioural_strength ?? 0) + (secondOrder?.behavioural_strength ?? 0);
      if (aggregate >= 0.4) return null;
      return {
        rule_id: 'strategy_without_systems_thinking',
        severity: aggregate > 0 ? 'medium' : 'high',
        title: 'Strategy claim with thin systems-thinking evidence',
        detail: `Your narrative mentions strategy but contains few systems-framing or second-order-reasoning cues. Add at least one example showing trade-offs, feedback loops, or downstream consequences of a decision you made.`,
        source_ids: sources.filter(s => STRATEGY_RE.test(s.text)).slice(0, 3).map(s => s.source_id),
        developmental_action: 'Augment one strategy bullet with a "this trade-off cost us X in exchange for Y" or "the downstream effect was …" clause.',
      };
    },
  },

  // ── inflated_project_scale ───────────────────────────────────────────────
  {
    id: 'inflated_project_scale',
    weight: 0.20,
    evaluate: ({ sources }) => {
      const offenders: string[] = [];
      for (const s of sources) {
        if (!SUPERLATIVE_RE.test(s.text)) continue;
        if (NUMERIC_RE.test(s.text))      continue;
        offenders.push(s.source_id);
      }
      if (offenders.length === 0) return null;
      return {
        rule_id: 'inflated_project_scale',
        severity: offenders.length > 1 ? 'medium' : 'low',
        title: 'Scale claim without supporting numbers',
        detail: `${offenders.length} item(s) describe a project as "largest / biggest / most significant" but contain no quantitative anchor (users, revenue, %, $). Add a concrete number so the claim survives scrutiny.`,
        source_ids: offenders.slice(0, 5),
        developmental_action: 'Replace each superlative with a measurable: revenue, user count, % improvement, time saved, scope (people/teams).',
      };
    },
  },

  // ── inconsistent_timelines ───────────────────────────────────────────────
  {
    id: 'inconsistent_timelines',
    weight: 0.10,
    evaluate: ({ sources }) => {
      // Pull overlapping date ranges from resume sources only.
      const ranges = sources
        .filter(s => s.source_type === 'resume')
        .map(s => extractDateRange(s.text))
        .filter((r): r is { start: number; end: number; id: string } => r !== null);
      const overlaps: string[] = [];
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const a = ranges[i], b = ranges[j];
          if (a.start < b.end && b.start < a.end) overlaps.push(`${a.id} ↔ ${b.id}`);
        }
      }
      if (overlaps.length === 0) return null;
      return {
        rule_id: 'inconsistent_timelines',
        severity: overlaps.length > 2 ? 'high' : 'medium',
        title: 'Overlapping experience timelines',
        detail: `${overlaps.length} experience entry pair(s) overlap in dates. Confirm whether these were concurrent or whether a date is incorrect.`,
        source_ids: overlaps.slice(0, 5),
        developmental_action: 'Mark overlapping roles as concurrent (consulting / advisory / part-time) or correct the date ranges.',
      };
    },
  },

  // ── quantification_gap ───────────────────────────────────────────────────
  {
    id: 'quantification_gap',
    weight: 0.15,
    evaluate: ({ scores }) => {
      const q = findSignal(scores, 'quantified_outcomes');
      if (!q) {
        return {
          rule_id: 'quantification_gap',
          severity: 'high',
          title: 'No quantified outcomes detected',
          detail: 'Your narrative contains no numeric outcomes (%, $, time saved, scope). Quantified outcomes are the single highest-leverage edit you can make.',
          developmental_action: 'Add at least 3 numeric outcomes across resume + projects (revenue, users, %, $, time).',
        };
      }
      if (q.behavioural_strength < 0.40) {
        return {
          rule_id: 'quantification_gap',
          severity: 'medium',
          title: 'Quantified-outcome signal is thin',
          detail: `Your quantified-outcomes strength is ${(q.behavioural_strength * 100).toFixed(0)}% — well below the level expected at the next stage.`,
          developmental_action: 'Convert 3 vague impact statements into measurable ones (% change, $ saved, count moved).',
        };
      }
      return null;
    },
  },

  // ── hedging_dominant ────────────────────────────────────────────────────
  {
    id: 'hedging_dominant',
    weight: 0.10,
    evaluate: ({ sources }) => {
      let hedges = 0, ownership = 0;
      for (const s of sources) {
        hedges    += countMatches(s.text, HEDGE_RE);
        ownership += countMatches(s.text, OWNERSHIP_RE);
      }
      if (hedges <= 1) return null;
      if (ownership >= hedges * 2) return null;
      return {
        rule_id: 'hedging_dominant',
        severity: hedges > ownership * 2 ? 'medium' : 'low',
        title: 'Hedging language overshadows ownership',
        detail: `Found ${hedges} hedge phrase(s) vs ${ownership} ownership phrase(s). Replace "I think / I guess / sort of" with first-person action verbs.`,
        developmental_action: 'Audit your narrative for "I think / I guess / maybe" and replace with the concrete action you took.',
      };
    },
  },
];

export function detectContradictions(
  sources: EvidenceSource[],
  scores: SignalScore[],
): ContradictionResult {
  const flags: ContradictionFlag[] = [];
  let weightSum = 0;
  let weightHit = 0;
  for (const r of RULES) {
    weightSum += r.weight;
    const flag = r.evaluate({ sources, scores });
    if (flag) {
      flags.push(flag);
      // severity multiplier
      const sev = flag.severity === 'high' ? 1.0 : flag.severity === 'medium' ? 0.65 : 0.35;
      weightHit += r.weight * sev;
    }
  }
  return {
    contradiction_score: round3(weightSum === 0 ? 0 : weightHit / weightSum),
    contradiction_flags: flags,
    rules_evaluated: RULES.length,
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────

function countMatches(text: string, re: RegExp): number {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let count = 0; let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m[0].length === 0) { r.lastIndex++; continue; }
    count++;
    if (count > 200) break;
  }
  return count;
}

const YEAR_RE = /\b(20\d{2}|19\d{2})(?:\s*[-–to]+\s*(20\d{2}|19\d{2}|present|current))?/i;

function extractDateRange(text: string): { start: number; end: number; id: string } | null {
  const m = YEAR_RE.exec(text);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const endRaw = (m[2] ?? '').toLowerCase();
  const end = (endRaw === 'present' || endRaw === 'current' || endRaw === '')
    ? new Date().getFullYear()
    : parseInt(endRaw, 10);
  if (!isFinite(start) || !isFinite(end)) return null;
  return { start, end, id: text.slice(0, 32) };
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }

// Exposed for tests
export const __TEST__ = { RULES, extractDateRange, countMatches };
