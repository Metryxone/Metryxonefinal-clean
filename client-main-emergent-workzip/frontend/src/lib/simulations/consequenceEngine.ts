/**
 * Consequence Engine — Phase 4
 * Computes outcomes, stakeholder satisfaction, cascading effects,
 * and narrative consequences from completed decision paths.
 */

import type { Scenario }              from './scenarioEngine';
import type { DecisionRecord }         from './decisionEngine';
import { scoreChoice, computeOptimalChoice } from './decisionEngine';
import { getNPC }                      from './npcEngine';

/* ── Output types ─────────────────────────────────────────────────── */
export interface StakeholderOutcome {
  npcId:            string;
  name:             string;
  role:             string;
  satisfactionScore:number;    // 0-100
  finalState:       string;
  keyMoment:        string;    // which decision most affected them
  outcomeLabel:     'delighted' | 'satisfied' | 'neutral' | 'dissatisfied' | 'hostile';
}

export interface CascadingEffect {
  type:    'positive' | 'negative' | 'neutral';
  domain:  string;   // e.g. "team morale", "client trust", "delivery risk"
  effect:  string;
  severity:'high' | 'medium' | 'low';
}

export interface ConsequenceOutput {
  overallScore:         number;    // 0-100
  overallLabel:         'excellent' | 'good' | 'mixed' | 'poor' | 'critical';
  immediateNarrative:   string;
  longTermNarrative:    string;
  stakeholderOutcomes:  StakeholderOutcome[];
  cascadingEffects:     CascadingEffect[];
  keyDecisions: {
    nodeId:    string;
    label:     string;
    impact:    'positive' | 'negative' | 'neutral';
    magnitude: 'high' | 'medium' | 'low';
  }[];
  recommendedReflections: string[];
}

/* ── Stakeholder satisfaction model ──────────────────────────────── */
function computeStakeholderSatisfaction(
  npcId:     string,
  decisions: DecisionRecord[],
  scenario:  Scenario,
): number {
  const npc = getNPC(npcId);
  if (!npc) return 50;

  let score = 50;
  for (const d of decisions) {
    const node = scenario.nodes.find(nd => nd.id === d.nodeId);
    if (!node) continue;

    // Did the choice align with this NPC's persuasion style?
    const signalTags = d.choice.signalTags ?? [];
    const alignMap: Record<string, string[]> = {
      'data-driven':  ['strategy','prioritization','communication-structure'],
      'relationship': ['empathy','patience','collaboration'],
      'authority':    ['directness','assertiveness','accountability'],
      'empathy':      ['empathy','patience','stress-handling'],
      'vision':       ['innovation','strategy','confidence'],
    };
    const aligned = alignMap[npc.persuasionStyle] ?? [];
    const matchCount = signalTags.filter(t => aligned.includes(t)).length;
    score += matchCount * 8;

    // Escalation triggers reduce satisfaction
    const escalationHits = signalTags.filter(t => npc.escalationTriggers.includes(t)).length;
    score -= escalationHits * 12;

    // De-escalation triggers increase it
    const deEscHits = signalTags.filter(t => npc.deEscalationTriggers.includes(t)).length;
    score += deEscHits * 8;

    // Is this NPC involved in this node?
    if (node.npcId === npcId) {
      const choiceScore = scoreChoice(d.choice);
      score += (choiceScore - 50) * 0.3;
    }
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function satisfactionLabel(score: number): StakeholderOutcome['outcomeLabel'] {
  if (score >= 80) return 'delighted';
  if (score >= 65) return 'satisfied';
  if (score >= 45) return 'neutral';
  if (score >= 25) return 'dissatisfied';
  return 'hostile';
}

/* ── Cascading effects generator ──────────────────────────────────── */
function buildCascadingEffects(
  decisions:  DecisionRecord[],
  scenario:   Scenario,
): CascadingEffect[] {
  const effects: CascadingEffect[] = [];
  const sigCounts: Record<string, number> = {};
  for (const d of decisions) {
    for (const t of d.choice.signalTags ?? []) sigCounts[t] = (sigCounts[t] ?? 0) + 1;
  }

  const avgScore = decisions.reduce((s, d) => s + scoreChoice(d.choice), 0) / Math.max(1, decisions.length);

  if ((sigCounts['empathy'] ?? 0) >= 2)
    effects.push({ type:'positive', domain:'team morale', effect:'Team members feel psychologically safe — retention risk reduced', severity:'medium' });
  if ((sigCounts['hesitation'] ?? 0) >= 2)
    effects.push({ type:'negative', domain:'leadership credibility', effect:'Repeated hesitation signals lack of conviction to stakeholders', severity:'high' });
  if ((sigCounts['strategy'] ?? 0) >= 2)
    effects.push({ type:'positive', domain:'delivery quality', effect:'Strategic framing of decisions reduces downstream rework probability', severity:'medium' });
  if ((sigCounts['assertiveness'] ?? 0) >= 2)
    effects.push({ type:'positive', domain:'stakeholder alignment', effect:'Assertive positioning sets clearer expectations and reduces ambiguity', severity:'medium' });
  if ((sigCounts['stress-handling'] ?? 0) >= 1 && avgScore >= 65)
    effects.push({ type:'positive', domain:'executive trust', effect:'Performing under pressure increases leadership credibility with senior stakeholders', severity:'high' });
  if (avgScore < 40)
    effects.push({ type:'negative', domain:'client / team relationship', effect:'Pattern of suboptimal choices creates trust deficit requiring active repair', severity:'high' });
  if (avgScore >= 75)
    effects.push({ type:'positive', domain:'career trajectory', effect:'High-quality decision-making signals readiness for increased scope and responsibility', severity:'high' });

  const typeOrder = { negative:0, positive:1, neutral:2 };
  return effects.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}

/* ── Narrative generation ─────────────────────────────────────────── */
function buildNarrative(
  score:    number,
  scenario: Scenario,
  decisions:DecisionRecord[],
): { immediate: string; longTerm: string } {
  const type = scenario.type;
  const dominant = decisions.reduce((best, d) => scoreChoice(d.choice) > scoreChoice(best.choice) ? d : best, decisions[0]);
  const dominantTitle = dominant?.choice.label ?? 'your approach';

  const immediateMap: Record<string, string> = {
    leadership:            `Your leadership decisions navigated the team dynamic with ${score >= 70 ? 'clarity and care' : score >= 50 ? 'reasonable judgement' : 'some missteps'}. The team's response was shaped most by your choice to "${dominantTitle}".`,
    strategic:             `Your strategic allocation decision landed with ${score >= 70 ? 'strong stakeholder alignment' : score >= 50 ? 'moderate confidence' : 'notable friction'}. The critical moment was when you chose to "${dominantTitle}".`,
    conflict:              `The conflict scenario resolved with ${score >= 70 ? 'de-escalation and renewed trust' : score >= 50 ? 'partial resolution' : 'unresolved tension'}. Your most defining move was "${dominantTitle}".`,
    operational:           `Under operational pressure, your decisions led to a ${score >= 70 ? 'credible recovery and team confidence' : score >= 50 ? 'manageable but tense outcome' : 'situation that requires further intervention'}. Pivotal: "${dominantTitle}".`,
    'emotional-intelligence':`Your emotional intelligence response created a ${score >= 70 ? 'safe and empathetic environment' : score >= 50 ? 'competent but slightly clinical' : 'tense and uncomfortable'} dynamic. The key moment: "${dominantTitle}".`,
    negotiation:           `The negotiation concluded with a ${score >= 70 ? 'favourable outcome and preserved relationship' : score >= 50 ? 'workable but suboptimal deal' : 'poor outcome that may require reopening'}. Defining move: "${dominantTitle}".`,
  };

  const longTermMap: Record<string, string> = {
    leadership:            score >= 70 ? 'The team\'s trust in your leadership has strengthened. Expect higher engagement and psychological safety in future interactions.' : 'Some team members remain uncertain about your leadership style. Consistent follow-through will be critical.',
    strategic:             score >= 70 ? 'Your ability to navigate competing priorities signals strategic maturity. Stakeholders will bring you into future decisions earlier.' : 'The decision exposed prioritisation gaps. Developing a more systematic framework for trade-offs will prevent recurrence.',
    conflict:              score >= 70 ? 'The conflict resolution builds your reputation as a safe escalation point. Both parties are more likely to resolve future tensions early.' : 'Unresolved tension may resurface. Address it proactively — unresolved conflict compounds.',
    operational:           score >= 70 ? 'Delivering under pressure demonstrates execution maturity. This builds sponsor confidence for higher-stakes assignments.' : 'Operational gaps need process solutions — build runbooks, escalation paths, and buffer protocols before the next crisis.',
    'emotional-intelligence': score >= 70 ? 'Your emotional intelligence response will be remembered. This individual will perform at a higher level with your support.' : 'Emotional signals from your team deserve more attention. Practice \'leader as listener\' habits to build psychological safety.',
    negotiation:           score >= 70 ? 'Effective negotiation strengthens your position and signals confidence. Future stakeholders will expect the same clarity.' : 'Negotiation gaps cost real value. Study anchoring, BATNA articulation, and silence as tools before the next high-stakes conversation.',
  };

  return {
    immediate: immediateMap[type] ?? `Your decision sequence produced a ${score >= 70 ? 'positive' : score >= 50 ? 'mixed' : 'challenging'} outcome.`,
    longTerm:  longTermMap[type]  ?? 'Continue building on the patterns that worked and address the areas where hesitation or misalignment appeared.',
  };
}

/* ── Key decision identification ──────────────────────────────────── */
function identifyKeyDecisions(decisions: DecisionRecord[], scenario: Scenario): ConsequenceOutput['keyDecisions'] {
  return decisions.map(d => {
    const node       = scenario.nodes.find(nd => nd.id === d.nodeId);
    const optimalId  = node ? computeOptimalChoice(node) : null;
    const chScore    = scoreChoice(d.choice);
    const isOptimal  = optimalId === d.choiceId;
    return {
      nodeId: d.nodeId,
      label:  node?.prompt.slice(0, 70) + '…' ?? d.nodeId,
      impact: chScore >= 65 ? 'positive' : chScore < 40 ? 'negative' : 'neutral',
      magnitude: isOptimal ? 'high' : chScore < 35 ? 'high' : 'medium',
    } as const;
  });
}

/* ── Recommended reflections ──────────────────────────────────────── */
const REFLECTION_PROMPTS: Record<string, string> = {
  hesitation:            'You deferred or avoided action in key moments. What made direct action feel risky?',
  empathy:               'You demonstrated strong empathy. How did reading the emotional state of others change your approach?',
  strategy:              'You thought several moves ahead. What trade-offs did you consciously accept, and why?',
  assertiveness:         'You were direct and confident. Where did assertiveness create value, and where might it have overridden someone\'s needs?',
  'stress-handling':     'You performed under time pressure. What was your internal process for cutting through uncertainty?',
  'communication-structure': 'Your communication was clear and structured. How did the structure of your message shape the other party\'s response?',
  'ambiguity-tolerance': 'You acted on incomplete information. How did you distinguish between productive risk and recklessness?',
};

function buildReflectionPrompts(sigCounts: Record<string, number>): string[] {
  return Object.entries(sigCounts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 3)
    .map(([tag]) => REFLECTION_PROMPTS[tag])
    .filter(Boolean);
}

/* ── Main engine ──────────────────────────────────────────────────── */
export function runConsequenceEngine(
  decisions: DecisionRecord[],
  scenario:  Scenario,
): ConsequenceOutput {
  if (decisions.length === 0) {
    return {
      overallScore:0, overallLabel:'poor', immediateNarrative:'No decisions recorded.',
      longTermNarrative:'', stakeholderOutcomes:[], cascadingEffects:[], keyDecisions:[], recommendedReflections:[],
    };
  }

  // Overall score: avg choice score weighted by node position (later decisions worth more)
  const weights  = decisions.map((_, i) => 1 + i * 0.3);
  const totalWt  = weights.reduce((s, v) => s + v, 0);
  const overallScore = Math.round(
    decisions.reduce((s, d, i) => s + scoreChoice(d.choice) * weights[i], 0) / totalWt,
  );

  const overallLabel: ConsequenceOutput['overallLabel'] =
    overallScore >= 80 ? 'excellent' : overallScore >= 65 ? 'good' :
    overallScore >= 50 ? 'mixed'     : overallScore >= 30 ? 'poor' : 'critical';

  // Stakeholder outcomes
  const stakeholderOutcomes: StakeholderOutcome[] = scenario.npcIds.map(npcId => {
    const npc  = getNPC(npcId);
    const sat  = computeStakeholderSatisfaction(npcId, decisions, scenario);
    const node = decisions.find(d => scenario.nodes.find(n => n.id === d.nodeId)?.npcId === npcId);
    return {
      npcId, name:npc?.name ?? npcId, role:npc?.role ?? '',
      satisfactionScore:sat, finalState:sat >= 70?'calm':sat>=50?'neutral':'stressed',
      keyMoment:node?.choice.label.slice(0, 60) ?? 'Multiple interactions',
      outcomeLabel: satisfactionLabel(sat),
    };
  });

  // Cascading effects
  const cascadingEffects = buildCascadingEffects(decisions, scenario);

  // Key decisions
  const keyDecisions = identifyKeyDecisions(decisions, scenario);

  // Narrative
  const { immediate, longTerm } = buildNarrative(overallScore, scenario, decisions);

  // Reflection prompts
  const sigCounts: Record<string, number> = {};
  for (const d of decisions) for (const t of d.choice.signalTags ?? []) sigCounts[t] = (sigCounts[t] ?? 0) + 1;
  const reflections = buildReflectionPrompts(sigCounts);

  return {
    overallScore, overallLabel,
    immediateNarrative: immediate, longTermNarrative: longTerm,
    stakeholderOutcomes, cascadingEffects, keyDecisions,
    recommendedReflections: reflections,
  };
}
