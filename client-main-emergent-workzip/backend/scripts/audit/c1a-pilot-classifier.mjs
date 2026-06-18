// C-1A PILOT — deterministic, evidence-based facet classifiers for the pilot subset.
// SANDBOX ONLY. Derives the C-2-deferred dimensions (capability facet, behavior facet,
// signal backfill) from per-question evidence (question text + tag-grounded signal families).
// Quality gate: returns UNCLASSIFIED (confidence 0) when no evidence — NEVER fabricates.
// Context + Archetype are reused from the validated C-2 classifier (single source of truth).

export const CAPABILITY_FACETS = [
  'Emotional-Regulation', 'Self-Awareness', 'Decision-Making', 'Interpersonal',
  'Cognitive-Strategy', 'Motivation-Drive', 'Resilience-Coping', 'Adaptability',
  'Self-Management', 'Goal-Direction',
];
export const BEHAVIOR_FACETS = [
  'Avoidance', 'Help-Seeking', 'Planning-Preparation', 'Persistence', 'Withdrawal',
  'Self-Regulation', 'Reflection', 'Adaptation', 'Initiation', 'Comparison', 'Execution',
];
export const UNCLASSIFIED = 'UNCLASSIFIED';

// ordered specific -> general; each entry [facet, regex over lowercased question text]
const CAPABILITY_LEXICON = [
  ['Emotional-Regulation', /\b(emotion|feeling|anxious|anxiety|stress|overwhelm|frustrat|upset|fear|nervous|panic|calm down|mood)\b/],
  ['Resilience-Coping', /\b(cope|recover|bounce back|resilien|setback|failure|rejection|handle (pressure|difficulty|criticism)|persever|adversity)\b/],
  ['Decision-Making', /\b(decision|decide|choose|choosing|choice|which (option|path|one)|trade-?off|prioriti|commit to)\b/],
  ['Interpersonal', /\b(friend|peer|team|group|relationship|social|communicat|collaborat|conflict|belong|others')\b/],
  ['Cognitive-Strategy', /\b(think|reason|analy|problem-?solv|logic|figure out|understand the (concept|problem|material)|approach the)\b/],
  ['Motivation-Drive', /\b(motivat|drive|effort|ambition|purpose|values|why .* matter|inspir|passion|give up)\b/],
  ['Adaptability', /\b(adapt|flexible|new (situation|environment|place)|unfamiliar|uncertain|unexpected|change (in|of))\b/],
  ['Self-Management', /\b(discipline|habit|routine|consistent|self-?control|time management|focus|distract|organi[sz]e|procrastinat)\b/],
  ['Goal-Direction', /\b(career|future|direction|path|plan ahead|long-?term|aspir|where i (want|see)|goal)\b/],
  ['Self-Awareness', /\b(aware|realize|recogni[sz]e|know (myself|my (strength|weakness))|self-?percept|reflect on (my|how)|notice)\b/],
];
const BEHAVIOR_LEXICON = [
  ['Help-Seeking', /\b(ask for help|seek (help|support|guidance|advice|feedback)|reach out|turn to (others|someone)|consult)\b/],
  ['Avoidance', /\b(avoid|put off|procrastinat|delay|postpone|escape|run away|shy away|hesitat|refuse to)\b/],
  ['Withdrawal', /\b(withdraw|isolat|pull back|disengage|shut down|stop (talking|participating|trying)|keep to myself)\b/],
  ['Planning-Preparation', /\b(plan|prepare|organi[sz]e|schedule|set (a )?goal|strateg|break .* down|make a list|structure my)\b/],
  ['Persistence', /\b(keep (going|trying|at it)|persist|push through|don'?t give up|stay (with|on)|stick (with|to)|continue despite)\b/],
  ['Self-Regulation', /\b(calm (myself|down)|control (my )?(emotion|temper|reaction|anger)|manage (my )?(stress|emotion|anxiety)|breathe|regulat|soothe)\b/],
  ['Reflection', /\b(reflect|think about (why|how i)|review (my|what)|look back|consider my|self-?assess|journal)\b/],
  ['Adaptation', /\b(adapt|adjust|change (my )?(approach|plan|strategy|method)|be flexible|switch|modify how)\b/],
  ['Comparison', /\b(compare (myself|to others)|others (are|do|seem)|peers? (are|do)|everyone else|fall behind|measure up)\b/],
  ['Initiation', /\b(take (the )?(first step|initiative|action|lead|charge)|volunteer|step (up|forward)|start (a|to)|begin to)\b/],
  ['Execution', /\b(complete|finish|get .* done|follow through|deliver|carry out|do the (work|task))\b/],
];

function firstMatches(t, lexicon) {
  const hits = [];
  for (const [facet, re] of lexicon) if (re.test(t) && !hits.includes(facet)) hits.push(facet);
  return hits;
}

export function classifyCapabilityFacet({ question } = {}) {
  const hits = firstMatches((question || '').toLowerCase(), CAPABILITY_LEXICON);
  if (!hits.length) return { facet: UNCLASSIFIED, secondary: null, confidence: 0, source: 'none' };
  return { facet: hits[0], secondary: hits[1] || null, confidence: hits.length > 1 ? 0.75 : 0.6, source: 'text' };
}
export function classifyBehaviorFacet({ question } = {}) {
  const hits = firstMatches((question || '').toLowerCase(), BEHAVIOR_LEXICON);
  if (!hits.length) return { facet: UNCLASSIFIED, secondary: null, confidence: 0, source: 'none' };
  return { facet: hits[0], secondary: hits[1] || null, confidence: hits.length > 1 ? 0.75 : 0.6, source: 'text' };
}

// Signal backfill: route a question ONLY to a family the tag is actually grounded to.
// groundedFamilies: [{ signal_family, similarity, evidence_strength }] for the question's tag.
// No grounding -> UNCLASSIFIED (cannot backfill without fabrication).
const EV_CONF = { strong: 0.85, good: 0.7, moderate: 0.45, weak: 0.25 };
function familyTokens(fam) {
  return (fam || '').toLowerCase().replace(/_signals?$/, '').split('_').filter((x) => x && x.length > 3);
}
export function backfillSignal({ question } = {}, groundedFamilies = []) {
  if (!groundedFamilies.length) return { signal_family: UNCLASSIFIED, confidence: 0, source: 'no_grounding' };
  const t = (question || '').toLowerCase();
  let best = null, bestScore = -1;
  for (const g of groundedFamilies) {
    const toks = familyTokens(g.signal_family);
    const textHits = toks.filter((tok) => t.includes(tok)).length;
    // Per-question evidence is REQUIRED: tag-level grounding alone is not evidence for THIS
    // question. No text hit -> skip this family (never force-assign).
    if (textHits === 0) continue;
    // rank by text match first, then grounding similarity (real evidence, not fabricated)
    const score = textHits * 10 + (Number(g.similarity) || 0);
    if (score > bestScore) { bestScore = score; best = { ...g, textHits }; }
  }
  // Grounded tag but no per-question text evidence -> UNCLASSIFIED (never fabricate).
  if (!best) return { signal_family: UNCLASSIFIED, confidence: 0, source: 'grounding_no_text_evidence' };
  const evConf = EV_CONF[(best.evidence_strength || '').toLowerCase()] ?? 0.3;
  return { signal_family: best.signal_family, confidence: Math.min(0.9, evConf + 0.1), source: 'grounding+text' };
}

export function classifyPilotRow(row, groundedFamiliesByTag = {}) {
  const cap = classifyCapabilityFacet(row);
  const beh = classifyBehaviorFacet(row);
  const sig = backfillSignal(row, groundedFamiliesByTag[row.master_bridge_tag] || []);
  return {
    question_id: row.question_id,
    master_bridge_tag: row.master_bridge_tag || null,
    capability_facet: cap.facet,
    capability_facet_secondary: cap.secondary,
    capability_confidence: cap.confidence,
    behavior_facet: beh.facet,
    behavior_facet_secondary: beh.secondary,
    behavior_confidence: beh.confidence,
    signal_family_backfill: sig.signal_family,
    signal_confidence: sig.confidence,
    signal_source: sig.source,
  };
}
