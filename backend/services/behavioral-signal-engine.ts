/**
 * Behavioural Micro-Signal Engine — Phase 2.
 *
 * Decomposes ontology competencies into observable behavioural micro-signals
 * and computes a five-dimensional score for each signal:
 *
 *   { frequency, confidence, evidence_count, recency_weight, behavioural_strength }
 *
 * Read-only pure functions — no DB writes. The evidence-extractor feeds raw
 * `EvidenceHit[]` into `scoreSignal()` to produce a `SignalScore`. The
 * orchestrator (and stage-guidance) consumes `SignalScore[]` and uses them to
 * personalise rationale, surface contradictions, and project recommendations.
 *
 * Language policy: developmental indicators only — never asserts hiring or
 * promotion outcomes.
 */

export const BSIG_VERSION = '2.0.0';

export type SignalKey =
  // stakeholder_management
  | 'escalation_timing'           | 'expectation_alignment'
  | 'tradeoff_framing'            | 'executive_summarisation'
  | 'influence_without_authority'
  // communication
  | 'structured_responses'        | 'quantified_outcomes'
  | 'narrative_clarity'           | 'concise_reasoning'
  // leadership
  | 'ownership_signals'           | 'accountability_consistency'
  | 'conflict_navigation'         | 'ambiguity_handling'
  // collaboration / interpersonal
  | 'active_listening_cues'       | 'cross_functional_signals'
  // systems_thinking
  | 'systems_framing'             | 'second_order_reasoning'
  // learning_agility
  | 'reflective_learning'         | 'fast_iteration'
  // adaptability / emotional_regulation
  | 'reframing_under_pressure'    | 'composure_signals'
  // execution / accountability
  | 'follow_through_signals'      | 'commitment_specificity';

export interface SignalDefinition {
  key: SignalKey;
  label: string;
  /** Ontology competency this micro-signal rolls up into. */
  competency_id: string;
  description: string;
  /** Regex patterns used by the evidence extractor (case-insensitive). */
  patterns: RegExp[];
  /** Negative patterns that lower confidence (e.g. hedging). */
  negative_patterns?: RegExp[];
  /** Quantitative cue (numbers, %, $) earns a confidence bonus. */
  expects_quantifier?: boolean;
}

/**
 * Canonical taxonomy — 23 micro-signals across 10 ontology competencies.
 *
 * Pattern design notes:
 *   - All patterns are deliberately lexical/phrasal (no model dependency).
 *   - Word boundaries (`\b`) avoid sub-word false positives.
 *   - `expects_quantifier` signals award a confidence bonus when the
 *     surrounding text contains numeric evidence (handled by the extractor).
 */
export const SIGNAL_TAXONOMY: SignalDefinition[] = [
  // ── stakeholder_management (ontology: comp_stakeholder_mgmt — fallback comp_collaboration) ──
  { key: 'escalation_timing', label: 'Escalation timing',
    competency_id: 'comp_collaboration',
    description: 'Raises risks/blockers early to the right level.',
    patterns: [/\bescalat(ed|ing|ion)\b/i, /\braised (the )?risk(s)?\b/i,
               /\bflagged (early|to leadership)\b/i, /\bsurfac(ed|ing) (a )?blocker\b/i] },
  { key: 'expectation_alignment', label: 'Expectation alignment',
    competency_id: 'comp_collaboration',
    description: 'Explicitly aligns scope, success criteria, and timelines.',
    patterns: [/\balign(ed|ing)? expectations\b/i, /\bset success criteria\b/i,
               /\bscoping (call|conversation|workshop)\b/i, /\bstakeholder kick.?off\b/i] },
  { key: 'tradeoff_framing', label: 'Trade-off framing',
    competency_id: 'comp_collaboration',
    description: 'Frames decisions as explicit trade-offs with rationale.',
    patterns: [/\btrade.?off(s)?\b/i, /\bcost vs benefit\b/i, /\boptions analysis\b/i,
               /\bdecision (memo|brief|document)\b/i] },
  { key: 'executive_summarisation', label: 'Executive summarisation',
    competency_id: 'comp_collaboration',
    description: 'Condenses complex updates into a leadership-ready summary.',
    patterns: [/\bexec(utive)? summary\b/i, /\btl;?dr\b/i, /\bone.?pager\b/i,
               /\bboard (update|brief|deck)\b/i] },
  { key: 'influence_without_authority', label: 'Influence without authority',
    competency_id: 'comp_collaboration',
    description: 'Moves outcomes through persuasion rather than positional power.',
    patterns: [/\binfluenc(ed|ing) (cross|across) (teams|orgs?)\b/i,
               /\bbuilt consensus\b/i, /\brall(ied|ying) stakeholders\b/i,
               /\bwithout (formal )?authority\b/i] },

  // ── communication ──
  { key: 'structured_responses', label: 'Structured responses',
    competency_id: 'comp_active_listening',
    description: 'Answers follow a clear frame (STAR / situation-action-result).',
    patterns: [/\b(situation|task|action|result)\b/i, /\bstar (format|method|framework)\b/i,
               /\bfirstly,? .* secondly,?\b/i, /\b(step \d|phase \d)\b/i] },
  { key: 'quantified_outcomes', label: 'Quantified outcomes',
    competency_id: 'comp_active_listening',
    description: 'Outcomes carry numbers, percentages, or currency anchors.',
    patterns: [/\b\d+(\.\d+)?\s?%/i, /\b(rs\.?|usd|inr)\s?\$?\d/i,
               /[\$£€]\s?\d/i, /\b\d+(\.\d+)?\s?(k|m|bn|cr|lakh|crore|million|billion)\b/i,
               /\b\d+x\b/i, /\bincreased (by )?\$?\d/i, /\breduced (by )?\$?\d/i,
               /\bsaved \$?\d/i, /\bdrove \$?\d/i],
    expects_quantifier: true },
  { key: 'narrative_clarity', label: 'Narrative clarity',
    competency_id: 'comp_active_listening',
    description: 'Tells the why-what-how with cause-and-effect linkage.',
    patterns: [/\bbecause\b/i, /\bwhich led to\b/i, /\bresulting in\b/i,
               /\bso that\b/i, /\bas a result\b/i] },
  { key: 'concise_reasoning', label: 'Concise reasoning',
    competency_id: 'comp_active_listening',
    description: 'Reaches the point without padding or hedging.',
    patterns: [/\bin short\b/i, /\bbottom line\b/i, /\bnet[: ]/i],
    negative_patterns: [/\b(i guess|maybe|sort of|kind of|i think maybe)\b/i] },

  // ── leadership ──
  { key: 'ownership_signals', label: 'Ownership signals',
    competency_id: 'comp_accountability',
    description: 'Uses first-person ownership with action verbs.',
    patterns: [/\bi (owned|led|drove|delivered|shipped|launched)\b/i,
               /\bdirectly responsible\b/i, /\bowner(ship)? of\b/i,
               /\bend.?to.?end ownership\b/i] },
  { key: 'accountability_consistency', label: 'Accountability consistency',
    competency_id: 'comp_accountability',
    description: 'Acknowledges what went wrong as well as what went right.',
    patterns: [/\bin hindsight\b/i, /\bi (missed|underestimated)\b/i,
               /\blesson(s)? learned\b/i, /\bretro(spective)?\b/i,
               /\bi should have\b/i] },
  { key: 'conflict_navigation', label: 'Conflict navigation',
    competency_id: 'comp_emotional_regulation',
    description: 'Surfaces disagreement constructively and seeks resolution.',
    patterns: [/\bdisagree(d|ment)?\b/i, /\bconflict\b/i, /\bmediat(ed|ing)\b/i,
               /\bresolved (a|the) dispute\b/i, /\bdifficult conversation\b/i] },
  { key: 'ambiguity_handling', label: 'Ambiguity handling',
    competency_id: 'comp_adaptability',
    description: 'Makes progress when scope or requirements are unclear.',
    patterns: [/\bambig(uous|uity)\b/i, /\bundefined (scope|problem)\b/i,
               /\bzero.?to.?one\b/i, /\bgreenfield\b/i, /\bno playbook\b/i] },

  // ── collaboration / interpersonal ──
  { key: 'active_listening_cues', label: 'Active listening cues',
    competency_id: 'comp_active_listening',
    description: 'Paraphrases, asks clarifying questions, names assumptions.',
    patterns: [/\bwhat i'?m hearing is\b/i, /\bto clarify\b/i, /\bjust to (confirm|check)\b/i,
               /\bso you('?re| are) saying\b/i] },
  { key: 'cross_functional_signals', label: 'Cross-functional signals',
    competency_id: 'comp_collaboration',
    description: 'Worked across functions (eng × product × design × ops).',
    patterns: [/\bcross.?functional\b/i, /\bworking with (engineering|product|design|sales|ops|legal|finance)\b/i,
               /\b(eng|product|design) partner(s)?\b/i] },

  // ── systems_thinking ──
  { key: 'systems_framing', label: 'Systems framing',
    competency_id: 'comp_systems_thinking',
    description: 'Sees parts as a system with feedback loops.',
    patterns: [/\bsystem(s)? (view|perspective|level|map)\b/i, /\bfeedback loop\b/i,
               /\bupstream|downstream\b/i, /\broot cause\b/i] },
  { key: 'second_order_reasoning', label: 'Second-order reasoning',
    competency_id: 'comp_systems_thinking',
    description: 'Considers consequences beyond the immediate outcome.',
    patterns: [/\bsecond.?order\b/i, /\bdownstream (effect|impact)\b/i,
               /\bunintended consequence(s)?\b/i, /\bripple effect\b/i] },

  // ── learning_agility ──
  { key: 'reflective_learning', label: 'Reflective learning',
    competency_id: 'comp_learning_agility',
    description: 'Names what was learned and how it changed behaviour.',
    patterns: [/\bi learned\b/i, /\b(took )?away (the )?lesson\b/i,
               /\bchanged (my )?approach\b/i, /\bnow i (do|always|never)\b/i] },
  { key: 'fast_iteration', label: 'Fast iteration',
    competency_id: 'comp_learning_agility',
    description: 'Cycles through prototype-feedback-improve quickly.',
    patterns: [/\biterat(ed|ing|ion)\b/i, /\bshipp(ed|ing) (weekly|daily)\b/i,
               /\bv\d (release|cut|build)\b/i, /\brapid (prototype|cycle)\b/i] },

  // ── adaptability / emotional_regulation ──
  { key: 'reframing_under_pressure', label: 'Reframing under pressure',
    competency_id: 'comp_adaptability',
    description: 'Shifts framing when the original plan stops working.',
    patterns: [/\bpivot(ed|ing)?\b/i, /\bre.?prioritis(ed|ing|e)\b/i,
               /\bchanged direction\b/i, /\bcourse.?corrected\b/i] },
  { key: 'composure_signals', label: 'Composure signals',
    competency_id: 'comp_emotional_regulation',
    description: 'Stays calm and structured under stress.',
    patterns: [/\bunder pressure\b/i, /\bkept (calm|composed|level.?headed)\b/i,
               /\bhigh.?stakes\b/i, /\btriage(d|ing)?\b/i] },

  // ── execution / accountability ──
  { key: 'follow_through_signals', label: 'Follow-through signals',
    competency_id: 'comp_accountability',
    description: 'Closes the loop on commitments.',
    patterns: [/\bdeliver(ed|ing)? on (time|commitment|scope)\b/i,
               /\bclosed the loop\b/i, /\bon.?time delivery\b/i,
               /\bhit (the )?(deadline|milestone)\b/i] },
  { key: 'commitment_specificity', label: 'Commitment specificity',
    competency_id: 'comp_accountability',
    description: 'Names dates, scope, and owners explicitly.',
    patterns: [/\bby (q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|next (week|month|quarter))\b/i,
               /\bbefore (the )?(eod|eow|eom)\b/i, /\bowner: \w/i],
    expects_quantifier: true },
];

export const SIGNALS_BY_KEY: Record<SignalKey, SignalDefinition> =
  Object.fromEntries(SIGNAL_TAXONOMY.map(s => [s.key, s])) as Record<SignalKey, SignalDefinition>;

export function signalsForCompetency(competency_id: string): SignalDefinition[] {
  return SIGNAL_TAXONOMY.filter(s => s.competency_id === competency_id);
}

// ─── Evidence + Scoring ────────────────────────────────────────────────────

export type EvidenceSourceType =
  'interview_transcript' | 'simulation' | 'resume' | 'project_description' |
  'goal' | 'profile_summary' | 'job_note';

export interface EvidenceHit {
  signal_key: SignalKey;
  source_type: EvidenceSourceType;
  /** Stable id of the source (job id, goal id, transcript id …). May be ''. */
  source_id: string;
  /** A short verbatim snippet (≤ 240 chars) for UI provenance. */
  snippet: string;
  /** ISO date of the source event (or extraction time as fallback). */
  occurred_at: string;
  /** 0..1 — strength of the pattern match (boosted by negation/quantifier cues). */
  match_strength: number;
}

export interface SignalScore {
  signal_key: SignalKey;
  label: string;
  competency_id: string;
  frequency: number;            // count of evidence hits (raw)
  confidence: number;           // 0..1 — match-quality average
  evidence_count: number;       // distinct sources contributing evidence
  recency_weight: number;       // 0..1 — half-life decay over 180 days
  behavioural_strength: number; // 0..1 — composite of the four above
  evidence: EvidenceHit[];      // top 3 most recent + highest-confidence hits
}

const HALF_LIFE_DAYS = 180;
const RECENCY_K = Math.LN2 / HALF_LIFE_DAYS;

function recencyDecay(isoDate: string, now: Date = new Date()): number {
  const t = Date.parse(isoDate);
  if (!isFinite(t)) return 0.5;
  const days = Math.max(0, (now.getTime() - t) / 86_400_000);
  return Math.exp(-RECENCY_K * days);
}

/** Squash a positive integer into 0..1 with diminishing returns. */
function softCount(n: number, k = 4): number {
  return n <= 0 ? 0 : 1 - Math.exp(-n / k);
}

/**
 * Compute a SignalScore for a single signal given a list of evidence hits.
 * Pure function — no IO. Safe to unit-test.
 */
export function scoreSignal(signal_key: SignalKey, hits: EvidenceHit[], now: Date = new Date()): SignalScore {
  const def = SIGNALS_BY_KEY[signal_key];
  if (!def) throw new Error(`unknown_signal_key: ${signal_key}`);
  const frequency = hits.length;
  const distinctSources = new Set(hits.map(h => `${h.source_type}:${h.source_id || h.snippet.slice(0, 40)}`));
  const evidence_count = distinctSources.size;

  let confSum = 0;
  let recencySum = 0;
  for (const h of hits) {
    confSum     += h.match_strength;
    recencySum  += recencyDecay(h.occurred_at, now);
  }
  const confidence     = frequency === 0 ? 0 : confSum / frequency;
  const recency_weight = frequency === 0 ? 0 : recencySum / frequency;

  // Composite — weight more toward independent-source evidence than raw
  // frequency to discourage gaming.
  const behavioural_strength = round01(
    0.30 * softCount(frequency, 4) +
    0.30 * softCount(evidence_count, 2) +
    0.25 * confidence +
    0.15 * recency_weight,
  );

  const evidence = [...hits]
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)
                 || b.match_strength - a.match_strength)
    .slice(0, 3);

  return {
    signal_key,
    label: def.label,
    competency_id: def.competency_id,
    frequency,
    confidence:        round01(confidence),
    evidence_count,
    recency_weight:    round01(recency_weight),
    behavioural_strength,
    evidence,
  };
}

/** Build a competency-level rollup (mean strength) from its child signals. */
export interface CompetencyRollup {
  competency_id: string;
  signal_count: number;
  mean_strength: number;
  weakest_signal: SignalKey | null;
  strongest_signal: SignalKey | null;
}

export function rollupCompetency(competency_id: string, scores: SignalScore[]): CompetencyRollup {
  const own = scores.filter(s => s.competency_id === competency_id);
  if (own.length === 0) {
    return { competency_id, signal_count: 0, mean_strength: 0,
             weakest_signal: null, strongest_signal: null };
  }
  const sorted = [...own].sort((a, b) => a.behavioural_strength - b.behavioural_strength);
  const mean = own.reduce((s, x) => s + x.behavioural_strength, 0) / own.length;
  return {
    competency_id,
    signal_count: own.length,
    mean_strength: round01(mean),
    weakest_signal: sorted[0].signal_key,
    strongest_signal: sorted[sorted.length - 1].signal_key,
  };
}

function round01(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
}
