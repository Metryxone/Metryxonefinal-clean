/**
 * Behavioral Signal Engine — Phase 4
 * Extracts and scores 7 behavioral signals from decision choices
 * and reflection text. Maps signals to EI dimensions and competencies.
 */

import type { DecisionRecord }  from './decisionEngine';
import type { ReflectionRecord } from './reflectionEngine';

/* ── Signal definitions ───────────────────────────────────────────── */
export type SignalId =
  | 'hesitation'
  | 'ambiguity-tolerance'
  | 'empathy'
  | 'confidence'
  | 'prioritization-quality'
  | 'stress-handling'
  | 'communication-structure';

export type EIDimension =
  | 'self-awareness'
  | 'self-regulation'
  | 'motivation'
  | 'empathy'
  | 'social-skill';

export interface SignalEvidence {
  source:       'decision' | 'reflection' | 'timing';
  nodeId?:      string;
  observation:  string;
  polarity:     'positive' | 'negative' | 'neutral';
  weight:       number;    // 0-1 contribution to final score
}

export interface BehavioralSignal {
  id:              SignalId;
  label:           string;
  score:           number;          // 0-100
  band:            'exceptional' | 'strong' | 'developing' | 'limited';
  eiDimension:     EIDimension;
  competencyIds:   string[];        // from 24-competency catalog
  evidence:        SignalEvidence[];
  insight:         string;          // human-readable insight about the signal
  growthPrompt:    string;          // what to practice to improve
}

export interface BehavioralSignalReport {
  signals:              BehavioralSignal[];
  overallBehavioralEI:  number;     // 0-100 weighted composite
  eiDimensionScores:    Record<EIDimension, number>;
  competencyMapping:    { competencyId: string; evidenceScore: number; signals: SignalId[] }[];
  dominantBehavior:     string;
  behavioralArchetype:  string;     // e.g. "Empathetic Strategist", "Decisive Operator"
  archetypeDescription: string;
  leadershipSignals:    { signal: string; strength: 'strong' | 'emerging' | 'absent' }[];
}

/* ── Signal metadata ──────────────────────────────────────────────── */
const SIGNAL_META: Record<SignalId, { label:string; eiDimension:EIDimension; competencyIds:string[]; growthPrompt:string }> = {
  'hesitation':           { label:'Decisiveness',         eiDimension:'self-regulation', competencyIds:['resilience','drive'], growthPrompt:'Practice pre-mortem analysis to build decision confidence before the pressure arrives.' },
  'ambiguity-tolerance':  { label:'Ambiguity Tolerance',  eiDimension:'self-regulation', competencyIds:['resilience','strategy'], growthPrompt:'Build explicit frameworks for deciding when you have "enough" information to act.' },
  'empathy':              { label:'Empathy',               eiDimension:'empathy',         competencyIds:['collaboration','people-mgmt','mentoring'], growthPrompt:'After each conversation, reflect on what the other person was feeling — not just what they said.' },
  'confidence':           { label:'Confidence & Presence', eiDimension:'self-awareness',  competencyIds:['drive','presentation','stakeholder-mgmt'], growthPrompt:'Practice stating your position before explaining your reasoning — lead with conviction.' },
  'prioritization-quality':{ label:'Prioritisation Quality', eiDimension:'motivation',   competencyIds:['strategy','business-acumen','project-mgmt'], growthPrompt:'Use a 2×2 (impact × urgency) matrix explicitly before every major allocation decision.' },
  'stress-handling':      { label:'Stress Resilience',    eiDimension:'self-regulation', competencyIds:['resilience','drive','people-mgmt'], growthPrompt:'Build a personal "pre-game" routine that activates calm cognitive function under high-stakes pressure.' },
  'communication-structure':{ label:'Communication Clarity', eiDimension:'social-skill', competencyIds:['writing','presentation','stakeholder-mgmt'], growthPrompt:'Apply the BLUF structure (Bottom Line Up Front) for every written and verbal executive communication.' },
};

/* ── Score a single signal from decisions ─────────────────────────── */
function scoreHesitation(decisions: DecisionRecord[]): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  let hesitationCount = 0;
  for (const d of decisions) {
    const tags = d.choice.signalTags ?? [];
    if (tags.includes('hesitation')) {
      hesitationCount++;
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`Chose "${d.choice.label.slice(0,50)}" — deferral or avoidance signal detected`, polarity:'negative', weight:0.25 });
    } else if (tags.includes('confidence') || tags.includes('assertiveness') || tags.includes('directness')) {
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`Chose "${d.choice.label.slice(0,50)}" — decisive action taken`, polarity:'positive', weight:0.25 });
    }
  }
  const n = Math.max(1, decisions.length);
  const raw = Math.round(100 - (hesitationCount / n) * 80);
  return { score:Math.min(100, Math.max(0, raw)), evidence };
}

function scoreAmbiguityTolerance(decisions: DecisionRecord[]): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  let ambCount = 0;
  for (const d of decisions) {
    const tags = d.choice.signalTags ?? [];
    if (tags.includes('ambiguity-tolerance')) {
      ambCount++;
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`Acted decisively under incomplete information`, polarity:'positive', weight:0.3 });
    }
  }
  const tpDecisions = decisions.filter(d => d.timeTaken !== undefined);
  if (tpDecisions.length > 0) {
    evidence.push({ source:'timing', observation:`Faced ${tpDecisions.length} time-pressured decision(s)`, polarity:'neutral', weight:0.2 });
    ambCount += tpDecisions.filter(d => (d.timeTaken ?? 0) < 45000).length;
  }
  const n = Math.max(1, decisions.length);
  const base = 40 + (ambCount / n) * 60;
  return { score:Math.min(100, Math.round(base)), evidence };
}

function scoreEmpathy(decisions: DecisionRecord[]): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  let empCount = 0, antiEmpCount = 0;
  for (const d of decisions) {
    const tags = d.choice.signalTags ?? [];
    if (tags.includes('empathy') || tags.includes('patience')) {
      empCount++;
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`"${d.choice.label.slice(0,50)}" — stakeholder perspective prioritised`, polarity:'positive', weight:0.3 });
    }
    const traitEmp = (d.choice.traits as Record<string,number>)['empathy'] ?? 0;
    if (traitEmp < -1) {
      antiEmpCount++;
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`Choice showed low empathy signal (trait: ${traitEmp})`, polarity:'negative', weight:0.2 });
    }
  }
  const n = Math.max(1, decisions.length);
  const score = Math.min(100, Math.max(0, Math.round(50 + (empCount - antiEmpCount * 0.7) / n * 50)));
  return { score, evidence };
}

function scoreConfidence(decisions: DecisionRecord[]): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  let confCount = 0;
  for (const d of decisions) {
    const tags = d.choice.signalTags ?? [];
    const hasConf = tags.some(t => ['confidence','assertiveness','directness','courage'].includes(t));
    const hasHes  = tags.includes('hesitation');
    if (hasConf)  { confCount += 1;   evidence.push({ source:'decision', nodeId:d.nodeId, observation:`"${d.choice.label.slice(0,50)}" — confident / assertive choice`, polarity:'positive', weight:0.25 }); }
    if (hasHes)   { confCount -= 0.5; evidence.push({ source:'decision', nodeId:d.nodeId, observation:'Hesitation signal detected', polarity:'negative', weight:0.15 }); }
  }
  const n = Math.max(1, decisions.length);
  return { score:Math.min(100, Math.max(0, Math.round(50 + (confCount / n) * 50))), evidence };
}

function scorePrioritizationQuality(decisions: DecisionRecord[]): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  let prioCount = 0;
  for (const d of decisions) {
    const tags = d.choice.signalTags ?? [];
    if (tags.includes('prioritization') || tags.includes('strategy')) {
      prioCount++;
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`"${d.choice.label.slice(0,50)}" — strategic prioritisation signal`, polarity:'positive', weight:0.3 });
    }
    if (tags.includes('hesitation') && tags.length === 1) {
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:'Failed to prioritise — deferred decision', polarity:'negative', weight:0.2 });
    }
  }
  const n = Math.max(1, decisions.length);
  return { score:Math.min(100, Math.max(0, Math.round(40 + (prioCount / n) * 60))), evidence };
}

function scoreStressHandling(decisions: DecisionRecord[]): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  const tpDecisions = decisions.filter(d => d.timeTaken !== undefined);
  if (tpDecisions.length === 0) {
    return { score:60, evidence:[{ source:'decision', observation:'No time-pressured decisions in this scenario — stress handling inferred from choice quality', polarity:'neutral', weight:0 }] };
  }
  let totalScore = 0;
  for (const d of tpDecisions) {
    const tags = d.choice.signalTags ?? [];
    const stressTag = tags.includes('stress-handling');
    const qualityBonus = stressTag ? 20 : 0;
    const timeTaken = d.timeTaken ?? 60000;
    // Fast decisions (under 40s) get a speed bonus, slow over-time get penalty
    const speedScore = timeTaken < 40000 ? 80 : timeTaken < 80000 ? 60 : 40;
    const decisionScore = Math.min(100, speedScore + qualityBonus);
    totalScore += decisionScore;
    evidence.push({ source:'timing', nodeId:d.nodeId, observation:`Decided in ${Math.round(timeTaken/1000)}s under time pressure — quality: ${stressTag?'strong':'moderate'}`, polarity:stressTag?'positive':'neutral', weight:0.35 });
  }
  return { score:Math.round(totalScore / tpDecisions.length), evidence };
}

function scoreCommunicationStructure(
  decisions:   DecisionRecord[],
  reflections: ReflectionRecord[],
): { score:number; evidence:SignalEvidence[] } {
  const evidence: SignalEvidence[] = [];
  let baseScore = 50;
  for (const d of decisions) {
    if ((d.choice.signalTags ?? []).includes('communication-structure')) {
      baseScore += 8;
      evidence.push({ source:'decision', nodeId:d.nodeId, observation:`Chose structured, clear communication approach`, polarity:'positive', weight:0.2 });
    }
  }
  // Reflections heavily influence this signal
  for (const r of reflections) {
    const boost = Math.round((r.qualityScore - 50) * 0.3);
    baseScore += boost;
    evidence.push({ source:'reflection', observation:`Reflection quality: ${r.qualityScore}/100 (${r.wordCount} words, tradeoffs: ${r.tradeoffCount})`, polarity:r.qualityScore>=60?'positive':'neutral', weight:0.3 });
  }
  return { score:Math.min(100, Math.max(0, Math.round(baseScore))), evidence };
}

/* ── Band classification ──────────────────────────────────────────── */
function toBand(score: number): BehavioralSignal['band'] {
  if (score >= 80) return 'exceptional';
  if (score >= 60) return 'strong';
  if (score >= 40) return 'developing';
  return 'limited';
}

/* ── Insight generator ────────────────────────────────────────────── */
const INSIGHTS: Record<SignalId, (score:number) => string> = {
  'hesitation':           s => s >= 70 ? 'You demonstrate strong decisiveness — you act when others waver.' : s >= 50 ? 'Your decisiveness is situational — consistent under clear information, less so under ambiguity.' : 'Hesitation is your dominant pattern. This signals risk-aversion that limits leadership effectiveness.',
  'ambiguity-tolerance':  s => s >= 70 ? 'You navigate ambiguous situations with confidence and structured thinking.' : s >= 50 ? 'You tolerate ambiguity adequately — further practice will build this into a genuine strength.' : 'You seek certainty before acting. In high-velocity environments, this creates bottlenecks.',
  'empathy':              s => s >= 70 ? 'You consistently factor in the emotional and relational context of your decisions.' : s >= 50 ? 'Your empathy appears selective — stronger in 1:1 settings than in high-pressure decisions.' : 'Empathy signals were largely absent. This limits trust-building with emotionally intelligent stakeholders.',
  'confidence':           s => s >= 70 ? 'You communicate and decide with clear confidence — a key leadership differentiator.' : s >= 50 ? 'Your confidence is situationally variable. High-stakes moments would benefit from a stronger position stance.' : 'Low confidence signals undermine your credibility even when your thinking is sound.',
  'prioritization-quality': s => s >= 70 ? 'You demonstrate strong prioritisation instincts — you identify what matters and act accordingly.' : s >= 50 ? 'Your prioritisation is adequate but shows gaps in trade-off articulation.' : 'Your prioritisation defaults to comfort over impact. Build more deliberate frameworks for high-stakes decisions.',
  'stress-handling':      s => s >= 70 ? 'You perform at or above your baseline under pressure — a rare and valuable trait.' : s >= 50 ? 'Moderate stress performance — you function adequately but with some degradation in decision quality.' : 'Stress significantly reduces your decision quality. Resilience training and pre-game routines will help.',
  'communication-structure': s => s >= 70 ? 'Your communications are clear, structured, and contextually calibrated — high impact.' : s >= 50 ? 'Your communication is adequate but could benefit from stronger logical sequencing.' : 'Communication signals show lack of structure. Executives and clients make inferences from how you communicate.',
};

/* ── Archetype detection ──────────────────────────────────────────── */
const ARCHETYPES: { label:string; requires:Partial<Record<SignalId,number>>; description:string }[] = [
  { label:'Empathetic Strategist',  requires:{ empathy:65, 'prioritization-quality':65 }, description:'Balances human considerations with strategic clarity. Rare combination valued in cross-functional leadership.' },
  { label:'Decisive Operator',      requires:{ hesitation:70, 'stress-handling':65 },     description:'Acts fast and performs under pressure. Thrives in execution-heavy, high-velocity environments.' },
  { label:'Composed Negotiator',    requires:{ confidence:65, 'ambiguity-tolerance':65 },  description:'Holds position with calm assurance even in ambiguous negotiations. High stakeholder credibility.' },
  { label:'People-First Leader',    requires:{ empathy:75, hesitation:50 },               description:'Prioritises psychological safety and team morale. Builds high-retention, high-trust teams.' },
  { label:'Strategic Thinker',      requires:{ 'prioritization-quality':70, 'ambiguity-tolerance':60 }, description:'Sees through complexity to identify leverage points. Trusted advisor to executive teams.' },
  { label:'Resilient Executor',     requires:{ 'stress-handling':70, hesitation:60 },     description:'Delivers reliably under conditions that derail others. High operational trust.' },
  { label:'Structured Communicator',requires:{ 'communication-structure':70, confidence:60 }, description:'Conveys complexity with clarity. Highly effective in board, client, and cross-functional contexts.' },
  { label:'Developing Leader',      requires:{},                                           description:'Early-stage leadership signals present. Focused coaching will accelerate the journey.' },
];

function detectArchetype(signals: BehavioralSignal[]): { label:string; description:string } {
  const scoreMap: Partial<Record<SignalId,number>> = Object.fromEntries(signals.map(s => [s.id, s.score])) as Partial<Record<SignalId,number>>;
  for (const arch of ARCHETYPES) {
    const qualifies = Object.entries(arch.requires).every(([k, v]) => (scoreMap[k as SignalId] ?? 0) >= (v ?? 0));
    if (qualifies && Object.keys(arch.requires).length > 0) return { label:arch.label, description:arch.description };
  }
  return { label:'Developing Leader', description:ARCHETYPES[ARCHETYPES.length-1].description };
}

/* ── Leadership signals ───────────────────────────────────────────── */
function detectLeadershipSignals(signals: BehavioralSignal[]): BehavioralSignalReport['leadershipSignals'] {
  const scoreMap = Object.fromEntries(signals.map(s => [s.id, s.score]));
  return [
    { signal:'Executive Presence',    strength: (scoreMap['confidence']??0)>=70 && (scoreMap['communication-structure']??0)>=60 ? 'strong' : (scoreMap['confidence']??0)>=50 ? 'emerging' : 'absent' },
    { signal:'Emotional Agility',     strength: (scoreMap['empathy']??0)>=70 && (scoreMap['stress-handling']??0)>=60 ? 'strong' : (scoreMap['empathy']??0)>=50 ? 'emerging' : 'absent' },
    { signal:'Strategic Thinking',    strength: (scoreMap['prioritization-quality']??0)>=70 ? 'strong' : (scoreMap['prioritization-quality']??0)>=50 ? 'emerging' : 'absent' },
    { signal:'Resilience Under Fire', strength: (scoreMap['stress-handling']??0)>=70 ? 'strong' : (scoreMap['stress-handling']??0)>=50 ? 'emerging' : 'absent' },
    { signal:'Decisive Action',       strength: (scoreMap['hesitation']??0)>=70 ? 'strong' : (scoreMap['hesitation']??0)>=50 ? 'emerging' : 'absent' },
  ];
}

/* ── Main engine ──────────────────────────────────────────────────── */
export function runBehavioralSignalEngine(
  decisions:   DecisionRecord[],
  reflections: ReflectionRecord[],
): BehavioralSignalReport {
  const scored: { id:SignalId; score:number; evidence:SignalEvidence[] }[] = [
    { id:'hesitation',             ...scoreHesitation(decisions) },
    { id:'ambiguity-tolerance',    ...scoreAmbiguityTolerance(decisions) },
    { id:'empathy',                ...scoreEmpathy(decisions) },
    { id:'confidence',             ...scoreConfidence(decisions) },
    { id:'prioritization-quality', ...scorePrioritizationQuality(decisions) },
    { id:'stress-handling',        ...scoreStressHandling(decisions) },
    { id:'communication-structure',...scoreCommunicationStructure(decisions, reflections) },
  ];

  const signals: BehavioralSignal[] = scored.map(s => ({
    id:            s.id,
    label:         SIGNAL_META[s.id].label,
    score:         s.score,
    band:          toBand(s.score),
    eiDimension:   SIGNAL_META[s.id].eiDimension,
    competencyIds: SIGNAL_META[s.id].competencyIds,
    evidence:      s.evidence,
    insight:       INSIGHTS[s.id](s.score),
    growthPrompt:  SIGNAL_META[s.id].growthPrompt,
  }));

  // EI dimension scores
  const eiDims: EIDimension[] = ['self-awareness','self-regulation','motivation','empathy','social-skill'];
  const eiDimensionScores: Record<EIDimension, number> = {} as Record<EIDimension, number>;
  for (const dim of eiDims) {
    const dimSignals = signals.filter(s => s.eiDimension === dim);
    eiDimensionScores[dim] = dimSignals.length > 0
      ? Math.round(dimSignals.reduce((s, v) => s + v.score, 0) / dimSignals.length)
      : 50;
  }

  // Overall behavioral EI: weighted average
  const weights: Record<EIDimension, number> = { 'self-awareness':0.20, 'self-regulation':0.25, motivation:0.15, empathy:0.20, 'social-skill':0.20 };
  const overallBehavioralEI = Math.round(Object.entries(eiDimensionScores).reduce((s, [k, v]) => s + v * (weights[k as EIDimension] ?? 0.2), 0));

  // Competency mapping
  const compMap: Record<string, { score:number; signals:SignalId[] }> = {};
  for (const sig of signals) {
    for (const compId of sig.competencyIds) {
      if (!compMap[compId]) compMap[compId] = { score:0, signals:[] };
      compMap[compId].score = Math.round((compMap[compId].score + sig.score) / 2);
      compMap[compId].signals.push(sig.id);
    }
  }
  const competencyMapping = Object.entries(compMap).map(([compId, { score, signals }]) => ({ competencyId:compId, evidenceScore:score, signals }));

  // Dominant behavior
  const topSignal = [...signals].sort((a, b) => b.score - a.score)[0];
  const dominantBehavior = topSignal?.label ?? 'Developing';

  // Archetype
  const archetype = detectArchetype(signals);

  return {
    signals, overallBehavioralEI, eiDimensionScores, competencyMapping,
    dominantBehavior, behavioralArchetype:archetype.label, archetypeDescription:archetype.description,
    leadershipSignals: detectLeadershipSignals(signals),
  };
}
