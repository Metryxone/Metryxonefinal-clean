/**
 * Career Simulation Routes — Phase 4
 * AI Simulation & Behavioral Intelligence Ecosystem.
 * All scenario, NPC, scoring and signal logic is self-contained / inline.
 */

import type { Express } from 'express';

/* ── Types ────────────────────────────────────────────────────────── */
type SimType   = 'leadership' | 'strategic' | 'conflict' | 'operational' | 'emotional-intelligence' | 'negotiation';
type Difficulty= 'beginner'   | 'intermediate' | 'advanced';

interface Choice {
  id: string; label: string; subtext?: string;
  traits: Record<string, number>;
  npcReaction?: string;
  signalTags?: string[];
}
interface Node {
  id: string; sequence: number; prompt: string; context?: string;
  npcMessage?: string; npcId?: string;
  requiresReflection: boolean; timePressure?: number;
  choices: Choice[];
}
interface Scenario {
  id: string; title: string; type: SimType; difficulty: Difficulty;
  description: string; context: string; objective: string;
  npcIds: string[]; estimatedMinutes: number;
  competencyFocus: string[]; tags: string[]; nodes: Node[];
}

interface Session {
  sessionId: string; scenarioId: string; userId?: string;
  startedAt: number; completedAt?: number;
  decisions: { nodeId: string; choiceId: string; choiceLabel: string; signalTags: string[]; traits: Record<string, number>; timeTaken?: number; timestamp: number }[];
  reflections: { promptId: string; nodeId: string; response: string; wordCount: number; tradeoffCount: number; qualityScore: number; timestamp: number }[];
  currentNodeIndex: number;
  npcStates: Record<string, { state: string; escalationLevel: number }>;
  completed: boolean;
  report?: unknown;
}

/* ── Abbreviated scenario catalog (key scenario per type) ─────────── */
const SCENARIOS: Scenario[] = [
  /* LEADERSHIP */
  {
    id:'lead-underperformer', title:'The Underperforming Team Member', type:'leadership', difficulty:'intermediate',
    description:'A previously strong engineer has missed three consecutive deadlines. The team is frustrated.',
    context:'Ravi — once your best performer — has missed three deadlines in six weeks. Sprint velocity is down 18%.',
    objective:'Improve performance while maintaining team morale and psychological safety.',
    npcIds:['ravi-engineer','priya-executive'], estimatedMinutes:12,
    competencyFocus:['people-mgmt','collaboration','resilience'], tags:['performance','feedback','empathy'],
    nodes:[
      { id:'l1-n1', sequence:1, requiresReflection:false, npcId:'ravi-engineer',
        npcMessage:'Hey — do you have a minute? I know things have been rough lately.',
        prompt:'Ravi stops you in the corridor and opens up. How do you respond?',
        choices:[
          { id:'a', label:'Find a private room and listen fully', subtext:'Drop your next meeting — this matters now.', traits:{ empathy:2,patience:2,directness:0 }, npcReaction:'Ravi relaxes and shares personal stress he had been hiding.', signalTags:['empathy','patience'] },
          { id:'b', label:'Schedule a 1:1 for later today', traits:{ strategy:1,directness:1,empathy:0 }, npcReaction:'Ravi nods but looks slightly deflated.', signalTags:['prioritization'] },
          { id:'c', label:'Ask him to raise it in the next sprint retro', traits:{ directness:-1,empathy:-2,collaboration:-1 }, npcReaction:'Ravi goes quiet and walks away.', signalTags:['hesitation','empathy'] },
          { id:'d', label:'Tell him you have noticed the misses and need explanations', traits:{ directness:2,assertiveness:1,empathy:-1 }, npcReaction:'Ravi becomes defensive.', signalTags:['directness','confidence'] },
        ] },
      { id:'l1-n2', sequence:2, requiresReflection:true, timePressure:90,
        prompt:'Director messages: "Fix Ravi\'s module by Friday or we delay the client launch." You have 90 seconds.',
        choices:[
          { id:'a', label:'Pair Ravi with a senior engineer to close the gap', traits:{ collaboration:2,strategy:2,assertiveness:1 }, signalTags:['strategy','collaboration','stress-handling'] },
          { id:'b', label:'Reassign the module without telling Ravi', traits:{ directness:1,courage:-1,empathy:-2 }, signalTags:['confidence','hesitation'] },
          { id:'c', label:'Tell the director the deadline is unrealistic — push back', traits:{ courage:2,assertiveness:2,strategy:1 }, signalTags:['confidence','assertiveness','stress-handling'] },
          { id:'d', label:'Ask Ravi to work overtime — "everyone is doing it"', traits:{ assertiveness:0,empathy:-1,strategy:-1 }, signalTags:['hesitation'] },
        ] },
      { id:'l1-n3', sequence:3, requiresReflection:true,
        prompt:'You need a formal performance conversation with Ravi. What is your approach?',
        choices:[
          { id:'a', label:'Two-way PIP with Ravi co-authoring the goals', traits:{ collaboration:2,strategy:2,empathy:2,accountability:2 }, signalTags:['strategy','empathy','collaboration'] },
          { id:'b', label:'Deliver a written formal warning citing the three misses', traits:{ directness:2,accountability:2,empathy:-1 }, signalTags:['directness','confidence'] },
          { id:'c', label:'Keep it informal — just a friendly chat, no documentation', traits:{ empathy:1,accountability:-2,strategy:-1 }, signalTags:['hesitation','empathy'] },
          { id:'d', label:'Involve HR from the start and let them lead', traits:{ assertiveness:-1,courage:-1,strategy:0 }, signalTags:['hesitation'] },
        ] },
    ],
  },
  /* STRATEGIC */
  {
    id:'strategy-resource-war', title:'The Resource Allocation Battle', type:'strategic', difficulty:'advanced',
    description:'Three product teams are competing for 4 engineers. You must allocate across conflicting priorities.',
    context:'Product A (₹5Cr revenue at risk), Product B (NPS feature), Product C (critical technical debt). You have 4 engineers for 3 weeks.',
    objective:'Make the allocation decision that best serves the organisation\'s long-term health.',
    npcIds:['rahul-pm','priya-executive'], estimatedMinutes:15,
    competencyFocus:['strategy','business-acumen','stakeholder-mgmt'], tags:['strategy','resource','prioritization'],
    nodes:[
      { id:'sr-n1', sequence:1, requiresReflection:true, timePressure:120,
        prompt:'4 engineers, 3 weeks, 3 competing products. Product A=revenue risk, Product B=NPS, Product C=stability. How do you allocate?',
        choices:[
          { id:'a', label:'2 on A (revenue), 2 on C (stability) — defer B', traits:{ strategy:2,business_acumen:2,assertiveness:1 }, signalTags:['strategy','prioritization','ambiguity-tolerance'] },
          { id:'b', label:'Split evenly: 1-1-2 with 2 on C', traits:{ strategy:1,collaboration:1 }, signalTags:['strategy','hesitation'] },
          { id:'c', label:'All 4 on A — protect revenue at all costs', traits:{ strategy:0,assertiveness:2 }, signalTags:['confidence','prioritization'] },
          { id:'d', label:'Escalate to executive team — not your decision alone', traits:{ courage:1,strategy:1,assertiveness:-1 }, signalTags:['hesitation','strategy'] },
        ] },
      { id:'sr-n2', sequence:2, requiresReflection:true, npcId:'rahul-pm',
        npcMessage:'You\'ve deprioritised my product again. Third quarter in a row. My team is demotivated and I\'m going to the CPO.',
        prompt:'Rahul has escalated to the CPO. How do you respond?',
        choices:[
          { id:'a', label:'Meet Rahul, acknowledge the pattern, commit to Q-next priority with a written roadmap', traits:{ empathy:2,strategy:2,accountability:2,courage:2 }, signalTags:['empathy','strategy','confidence'] },
          { id:'b', label:'Let the CPO call happen — defend the decision with data', traits:{ courage:2,assertiveness:2,strategy:1 }, signalTags:['confidence','assertiveness'] },
          { id:'c', label:'Re-open the allocation and give Rahul 1 engineer to appease him', traits:{ strategy:-1,assertiveness:-1,empathy:1 }, signalTags:['hesitation','empathy'] },
          { id:'d', label:'Tell Rahul the decision is final and to trust the process', traits:{ directness:2,empathy:-1,collaboration:-1 }, signalTags:['directness','confidence'] },
        ] },
    ],
  },
  /* CONFLICT */
  {
    id:'conflict-client-escalation', title:'The Client Meltdown', type:'conflict', difficulty:'advanced',
    description:'A client is furious after a missed deliverable. They are threatening to cancel a ₹3Cr contract.',
    context:'Vikram has CC\'d your CEO on a scathing email. The miss was partly your team\'s fault, partly the client\'s delayed approvals.',
    objective:'De-escalate the client, protect the relationship, and clarify ownership without damaging your team.',
    npcIds:['vikram-client','priya-executive'], estimatedMinutes:12,
    competencyFocus:['stakeholder-mgmt','resilience','collaboration'], tags:['conflict','client','escalation'],
    nodes:[
      { id:'ce-n1', sequence:1, requiresReflection:false, npcId:'vikram-client',
        npcMessage:'This is completely unacceptable. We trusted you and you\'ve wasted six weeks of our time. I\'m looking at alternatives.',
        prompt:'Vikram calls you directly, furious. The first 90 seconds will set the tone. What do you say?',
        choices:[
          { id:'a', label:'Open with a full apology for the impact — no defensiveness yet', traits:{ empathy:2,patience:2,strategy:1,directness:1 }, npcReaction:'Vikram\'s tone softens slightly.', signalTags:['empathy','stress-handling','patience'] },
          { id:'b', label:'Acknowledge the frustration and immediately outline a recovery plan', traits:{ strategy:2,directness:2,empathy:1 }, npcReaction:'Vikram is still upset but is listening.', signalTags:['strategy','confidence','stress-handling'] },
          { id:'c', label:'Respectfully point out their delayed approvals contributed to this', traits:{ directness:2,courage:2,empathy:-1 }, npcReaction:'Vikram escalates further.', signalTags:['directness','assertiveness'] },
          { id:'d', label:'Tell Vikram you\'ll have your CEO call him personally', traits:{ courage:-1,strategy:-1 }, npcReaction:'Vikram says "Not good enough" and hangs up.', signalTags:['hesitation'] },
        ] },
      { id:'ce-n2', sequence:2, requiresReflection:true,
        prompt:'The CEO asks you to write the recovery email to Vikram tonight. What is your recommended plan?',
        choices:[
          { id:'a', label:'72-hour root cause debrief + credit one month of service fees', traits:{ strategy:2,accountability:2,empathy:2,courage:2 }, signalTags:['strategy','empathy','communication-structure'] },
          { id:'b', label:'Full fee waiver for delayed period + new delivery guarantee SLA', traits:{ assertiveness:2,strategy:1,courage:2 }, signalTags:['assertiveness','strategy'] },
          { id:'c', label:'Apologise, restate timeline — no financial remedy', traits:{ directness:1,strategy:-1 }, signalTags:['directness','hesitation'] },
          { id:'d', label:'Offer a co-creation workshop to rebuild trust and redefine scope', traits:{ innovation:2,collaboration:2,empathy:2,strategy:2 }, signalTags:['innovation','collaboration','empathy'] },
        ] },
    ],
  },
  /* OPERATIONAL */
  {
    id:'ops-project-crisis', title:'Project in Freefall', type:'operational', difficulty:'advanced',
    description:'A flagship project is 4 weeks behind, client watching, team burning out.',
    context:'Project Phoenix: ₹8Cr client, week 10 of 12. 4 weeks behind on 3 deliverables. 2 engineers on sick leave.',
    objective:'Stabilise the project and develop a credible recovery plan.',
    npcIds:['vikram-client','priya-executive'], estimatedMinutes:15,
    competencyFocus:['project-mgmt','strategy','resilience','stakeholder-mgmt'], tags:['project','crisis','recovery'],
    nodes:[
      { id:'pc-n1', sequence:1, requiresReflection:true, timePressure:120,
        prompt:'Recovery plan needed in 24 hours. 3 engineers, 2 weeks buffer. What is your triage decision?',
        choices:[
          { id:'a', label:'Cut scope to 3 critical deliverables — agree with client what gets deferred', traits:{ strategy:2,courage:2,directness:2,accountability:2 }, signalTags:['strategy','prioritization','confidence','stress-handling'] },
          { id:'b', label:'Request emergency resource from another project', traits:{ strategy:1,courage:1,assertiveness:2 }, signalTags:['assertiveness','strategy'] },
          { id:'c', label:'Commit to original scope on paper while privately preparing for a slip', traits:{ courage:-2,accountability:-2,strategy:-1 }, signalTags:['hesitation'] },
          { id:'d', label:'Present 3 options to the client and let them choose', traits:{ strategy:2,collaboration:2 }, signalTags:['strategy','communication-structure'] },
        ] },
      { id:'pc-n2', sequence:2, requiresReflection:false, npcId:'priya-executive',
        npcMessage:'I\'ve had to apologise to the client twice this week. I need to know this will not happen again.',
        prompt:'Your VP pulls you aside. Calm but clearly disappointed. How do you respond?',
        choices:[
          { id:'a', label:'Acknowledge the impact fully, share root cause, commit to process changes', traits:{ accountability:2,courage:2,directness:2,strategy:2 }, signalTags:['accountability','confidence','stress-handling'] },
          { id:'b', label:'Explain the resourcing constraints that contributed', traits:{ directness:2,courage:1,strategy:1 }, signalTags:['directness','confidence'] },
          { id:'c', label:'Apologise profusely and over-promise on next steps', traits:{ courage:-1,accountability:-1 }, signalTags:['hesitation'] },
          { id:'d', label:'Ask for her support in escalating the resource issue', traits:{ strategy:2,courage:2,assertiveness:1 }, signalTags:['strategy','assertiveness'] },
        ] },
    ],
  },
  /* EMOTIONAL INTELLIGENCE */
  {
    id:'ei-colleague-distress', title:'A Colleague in Crisis', type:'emotional-intelligence', difficulty:'intermediate',
    description:'A colleague confides that they are struggling with mental health. You\'re their manager.',
    context:'Ananya pulls you aside after lunch. She\'s been struggling with anxiety for months, afraid it\'ll affect her job. She\'s crying.',
    objective:'Respond with empathy, ensure her safety and dignity, and take the right next steps.',
    npcIds:['ananya-report'], estimatedMinutes:10,
    competencyFocus:['people-mgmt','collaboration','resilience'], tags:['mental-health','empathy','psychological-safety'],
    nodes:[
      { id:'ecd-n1', sequence:1, requiresReflection:true, npcId:'ananya-report',
        npcMessage:'I\'m sorry, I shouldn\'t have said anything. Please don\'t tell anyone.',
        prompt:'Ananya has just confided in you and is now apologising for it. What do you say?',
        choices:[
          { id:'a', label:'Thank her for trusting you. Reassure her job is safe. Ask what support she needs.', traits:{ empathy:2,patience:2,strategy:1 }, npcReaction:'Ananya breathes out and seems relieved.', signalTags:['empathy','patience'] },
          { id:'b', label:'Reassure her, then suggest she contacts the company EAP helpline', traits:{ empathy:1,strategy:1,directness:1 }, npcReaction:'She nods but the speed of your solution feels slightly clinical.', signalTags:['empathy','strategy'] },
          { id:'c', label:'Tell her you are required to inform HR and will do so today', traits:{ directness:2,empathy:-2,strategy:-1 }, npcReaction:'"I knew I shouldn\'t have said anything."', signalTags:['directness','hesitation'] },
          { id:'d', label:'Listen fully — then ask if she wants to just talk before deciding anything', traits:{ empathy:2,patience:2,collaboration:1 }, npcReaction:'The tears slow. She says "yes, please."', signalTags:['empathy','patience','communication-structure'] },
        ] },
    ],
  },
  /* NEGOTIATION */
  {
    id:'neg-salary', title:'Negotiate Your Own Salary', type:'negotiation', difficulty:'intermediate',
    description:'You have a competing offer. Your company wants to retain you. The negotiation starts now.',
    context:'You have an offer for ₹32 LPA — ₹8L above your current salary. Your manager wants to retain you.',
    objective:'Negotiate the best possible outcome while maintaining the relationship.',
    npcIds:['priya-executive'], estimatedMinutes:10,
    competencyFocus:['negotiation','strategy','stakeholder-mgmt'], tags:['negotiation','compensation','retention'],
    nodes:[
      { id:'ns-n1', sequence:1, requiresReflection:false, npcId:'priya-executive',
        npcMessage:'We really value you here and we\'d like to find a way to keep you. What would it take?',
        prompt:'Your manager opens the negotiation — no number stated yet. This is your first move.',
        choices:[
          { id:'a', label:'Name the number directly: "I\'d need ₹30 LPA minimum."', traits:{ assertiveness:2,courage:2,strategy:2,directness:2 }, npcReaction:'"That\'s higher than expected — let me see what I can do."', signalTags:['assertiveness','confidence'] },
          { id:'b', label:'Ask what the company\'s retention offer is first — don\'t anchor', traits:{ strategy:2,patience:2,assertiveness:1 }, npcReaction:'She mentions a 15% increase — ₹27.6 LPA.', signalTags:['strategy','patience'] },
          { id:'c', label:'Mention the competing offer directly: "I have ₹32 LPA and I\'d rather stay."', traits:{ directness:2,courage:2,assertiveness:2,strategy:1 }, npcReaction:'"That\'s strong. Let me escalate internally."', signalTags:['directness','assertiveness','confidence'] },
          { id:'d', label:'Say you need to feel "valued" — don\'t name a number', traits:{ courage:-2,assertiveness:-2,strategy:-1 }, npcReaction:'She offers 10% and the conversation ends quickly.', signalTags:['hesitation'] },
        ] },
      { id:'ns-n2', sequence:2, requiresReflection:true, npcId:'priya-executive', timePressure:60,
        npcMessage:'Best I can do is ₹28 LPA plus an early performance review in 6 months. That\'s the ceiling.',
        prompt:'She\'s offered ₹28 LPA — ₹4L short of the competing offer. 60 seconds to respond.',
        choices:[
          { id:'a', label:'Counter: "₹28L works if we add a ₹2L signing bonus and a defined promotion path."', traits:{ strategy:2,assertiveness:2,innovation:1,courage:2 }, npcReaction:'"I can do the signing bonus — let me check the promotion path."', signalTags:['strategy','assertiveness','confidence','stress-handling'] },
          { id:'b', label:'Accept ₹28L — the intangibles outweigh ₹4L', traits:{ patience:2,strategy:1 }, signalTags:['patience','prioritization'] },
          { id:'c', label:'Decline and accept the competing offer', traits:{ courage:2,assertiveness:2,directness:2,strategy:2 }, npcReaction:'She respects the decision. Ends professionally.', signalTags:['courage','confidence','assertiveness'] },
          { id:'d', label:'Ask for a week to decide', traits:{ patience:1,assertiveness:-1,courage:-1 }, signalTags:['hesitation'] },
        ] },
    ],
  },
];

/* ── NPC catalog (inline subset) ─────────────────────────────────── */
const NPCS: Record<string, { name:string; role:string; escalationTriggers:string[]; deEscTriggers:string[]; baseState:string }> = {
  'ravi-engineer':   { name:'Ravi Kapoor',    role:'Senior Engineer',         escalationTriggers:['directness-without-empathy'], deEscTriggers:['empathy','patience'],            baseState:'uncertain' },
  'priya-executive': { name:'Priya Sharma',   role:'VP Engineering / Director',escalationTriggers:['hesitation'],                deEscTriggers:['accountability','confidence'],    baseState:'stressed' },
  'vikram-client':   { name:'Vikram Nair',    role:'Head of Operations',       escalationTriggers:['hesitation','excuses'],       deEscTriggers:['empathy','accountability'],       baseState:'stressed' },
  'rahul-pm':        { name:'Rahul Desai',    role:'Product Manager',          escalationTriggers:['deprioritization'],           deEscTriggers:['commitment','accountability'],    baseState:'stressed' },
  'ananya-report':   { name:'Ananya Verma',   role:'Mid-level Analyst',        escalationTriggers:['hr-threat','lack-of-empathy'],deEscTriggers:['empathy','reassurance','patience'],baseState:'uncertain' },
};

/* ── In-memory session store ──────────────────────────────────────── */
const sessions = new Map<string, Session>();
function uid(): string { return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`; }

/* ── Scoring helpers ──────────────────────────────────────────────── */
function scoreChoice(choice: Choice): number {
  const raw = Object.values(choice.traits).reduce((s, v) => s + (v ?? 0), 0);
  return Math.min(100, Math.max(0, Math.round(((raw + 16) / 32) * 100)));
}
function optimalChoice(node: Node): string {
  return node.choices.reduce((best, ch) => {
    const bs = Object.values(best.traits).reduce((s,v) => s+(v??0), 0);
    const cs = Object.values(ch.traits).reduce((s,v) => s+(v??0), 0);
    return cs > bs ? ch : best;
  }, node.choices[0]).id;
}

/* ── Behavioral signal computation ───────────────────────────────── */
function computeSignals(decisions: Session['decisions'], reflections: Session['reflections']): Record<string, number> {
  const sigCounts: Record<string, number> = {};
  const n = Math.max(1, decisions.length);
  for (const d of decisions) for (const t of d.signalTags) sigCounts[t] = (sigCounts[t] ?? 0) + 1;

  const hesitationScore = Math.min(100, Math.max(0, 100 - Math.round((sigCounts['hesitation'] ?? 0) / n * 80)));
  const empathyScore    = Math.min(100, Math.max(0, 50 + Math.round(((sigCounts['empathy'] ?? 0) - (sigCounts['hesitation'] ?? 0) * 0.3) / n * 50)));
  const confidenceScore = Math.min(100, Math.max(0, 50 + Math.round(((sigCounts['confidence'] ?? 0) + (sigCounts['assertiveness'] ?? 0) - (sigCounts['hesitation'] ?? 0) * 0.5) / n * 40)));
  const strategyScore   = Math.min(100, Math.max(0, 40 + Math.round(((sigCounts['strategy'] ?? 0) + (sigCounts['prioritization'] ?? 0)) / n * 60)));
  const stressScore     = decisions.filter(d => d.timeTaken !== undefined).length > 0
    ? Math.min(100, Math.round(50 + (sigCounts['stress-handling'] ?? 0) * 15))
    : 60;
  const reflQuality     = reflections.length > 0
    ? Math.round(reflections.reduce((s, r) => s + r.qualityScore, 0) / reflections.length)
    : 50;
  const ambiguity       = Math.min(100, 40 + Math.round((sigCounts['ambiguity-tolerance'] ?? 0) / n * 60));

  return { hesitation:hesitationScore, empathy:empathyScore, confidence:confidenceScore, strategy:strategyScore, stressHandling:stressScore, communicationStructure:reflQuality, ambiguityTolerance:ambiguity };
}

function updateNPCState(session: Session, signalTags: string[], npcId?: string): void {
  if (!npcId) return;
  const npc = NPCS[npcId];
  if (!npc) return;
  const cur = session.npcStates[npcId] ?? { state:npc.baseState, escalationLevel:0 };
  const escalated = signalTags.some(t => npc.escalationTriggers.includes(t));
  const calmed    = signalTags.some(t => npc.deEscTriggers.includes(t));
  let lvl = cur.escalationLevel;
  if (escalated) lvl = Math.min(3, lvl + 1);
  if (calmed)    lvl = Math.max(0, lvl - 1);
  const state = lvl >= 3 ? 'hostile' : lvl >= 2 ? 'stressed' : lvl === 0 && calmed ? 'relieved' : 'uncertain';
  session.npcStates[npcId] = { state, escalationLevel:lvl };
}

function buildReport(session: Session): unknown {
  const scenario = SCENARIOS.find(s => s.id === session.scenarioId);
  if (!scenario) return {};
  const decisions  = session.decisions;
  const n          = Math.max(1, decisions.length);
  const scores     = decisions.map(d => {
    const node = scenario.nodes.find(nd => nd.id === d.nodeId);
    const ch   = node?.choices.find(c => c.id === d.choiceId);
    return ch ? scoreChoice(ch) : 50;
  });
  const avgScore    = Math.round(scores.reduce((s, v) => s + v, 0) / n);
  const optimalPct  = Math.round(decisions.filter(d => {
    const node = scenario.nodes.find(nd => nd.id === d.nodeId);
    return node && optimalChoice(node) === d.choiceId;
  }).length / n * 100);
  const signals     = computeSignals(decisions, session.reflections);
  const overallEI   = Math.round(Object.values(signals).reduce((s, v) => s + v, 0) / Object.values(signals).length);
  const overallLabel= avgScore >= 80 ? 'excellent' : avgScore >= 65 ? 'good' : avgScore >= 50 ? 'mixed' : 'poor';
  const stakeOutcomes = scenario.npcIds.map(npcId => {
    const npc = NPCS[npcId];
    const state = session.npcStates[npcId] ?? { state:'neutral', escalationLevel:0 };
    const sat = Math.max(20, Math.min(95, 60 - state.escalationLevel * 15 + (signals.empathy > 65 ? 15 : 0)));
    return { npcId, name:npc?.name??npcId, role:npc?.role??'', satisfactionScore:sat, finalState:state.state, outcomeLabel: sat>=75?'satisfied':sat>=50?'neutral':'dissatisfied' };
  });
  const archetype =
    signals.empathy >= 65 && signals.strategy >= 65 ? 'Empathetic Strategist' :
    signals.hesitation >= 70 && signals.stressHandling >= 65 ? 'Decisive Operator' :
    signals.confidence >= 65 && signals.ambiguityTolerance >= 65 ? 'Composed Negotiator' :
    signals.empathy >= 75 ? 'People-First Leader' :
    signals.strategy >= 70 ? 'Strategic Thinker' : 'Developing Leader';
  const reflQuality = session.reflections.length
    ? Math.round(session.reflections.reduce((s, r) => s + r.qualityScore, 0) / session.reflections.length) : 0;
  return {
    sessionId:session.sessionId, scenarioId:session.scenarioId, scenarioTitle:scenario.title,
    scenarioType:scenario.type, completedAt:session.completedAt,
    overallScore:avgScore, overallLabel, optimalPct,
    behavioralSignals:signals, overallBehavioralEI:overallEI,
    behavioralArchetype:archetype,
    stakeholderOutcomes:stakeOutcomes,
    reflectionQuality:{ avgScore:reflQuality, reflectionsSubmitted:session.reflections.length, depthLabel:reflQuality>=75?'deep':reflQuality>=55?'moderate':reflQuality>=35?'surface':'minimal' },
    leadershipSignals:[
      { signal:'Executive Presence',    strength:(signals.confidence??0)>=70&&(signals.communicationStructure??0)>=60?'strong':(signals.confidence??0)>=50?'emerging':'absent' },
      { signal:'Emotional Agility',     strength:(signals.empathy??0)>=70&&(signals.stressHandling??0)>=60?'strong':(signals.empathy??0)>=50?'emerging':'absent' },
      { signal:'Strategic Thinking',    strength:(signals.strategy??0)>=70?'strong':(signals.strategy??0)>=50?'emerging':'absent' },
      { signal:'Resilience Under Fire', strength:(signals.stressHandling??0)>=70?'strong':(signals.stressHandling??0)>=50?'emerging':'absent' },
      { signal:'Decisive Action',       strength:(signals.hesitation??0)>=70?'strong':(signals.hesitation??0)>=50?'emerging':'absent' },
    ],
    keyDecisions:decisions.map(d => {
      const node = scenario.nodes.find(nd => nd.id === d.nodeId);
      const ch   = node?.choices.find(c => c.id === d.choiceId);
      const s    = ch ? scoreChoice(ch) : 50;
      return { nodeId:d.nodeId, choiceLabel:d.choiceLabel, score:s, impact:s>=65?'positive':s<40?'negative':'neutral', signalTags:d.signalTags };
    }),
    competencyMapping:scenario.competencyFocus.map(c => ({ competencyId:c, evidenceScore:Math.round((overallEI + avgScore) / 2) })),
    growthPrompts:[
      signals.hesitation < 60 ? 'Practice pre-mortem analysis to build decision confidence before pressure arrives.' : null,
      signals.empathy < 60    ? 'After each conversation, reflect on what the other person was feeling — not just what they said.' : null,
      signals.strategy < 60   ? 'Use a 2×2 (impact × urgency) matrix explicitly before every major allocation decision.' : null,
      reflQuality < 55        ? 'Practice BLUF (Bottom Line Up Front) structured reflection after every real-world decision.' : null,
    ].filter(Boolean),
  };
}

/* ── Reflection quality scoring ───────────────────────────────────── */
const TRADEOFF_WORDS = ['however','but','trade-off','tradeoff','sacrifice','cost','risk','downside','alternative','instead','though','whereas','despite','accepted','gave up'];
const STAKEHOLDER_WORDS = ['team','client','manager','colleague','stakeholder','executive','ravi','priya','vikram','arjun','meera','rahul','ananya'];
function scoreReflection(text: string): { wordCount:number; tradeoffCount:number; qualityScore:number } {
  const wordCount    = text.trim().split(/\s+/).filter(Boolean).length;
  const lower        = text.toLowerCase();
  const tradeoffs    = TRADEOFF_WORDS.filter(w => lower.includes(w)).length;
  const stakeholders = STAKEHOLDER_WORDS.filter(w => lower.includes(w)).length;
  const hasNumbers   = /\d+\s?(weeks?|months?|days?|lpa|cr|%)/i.test(text) ? 1 : 0;
  const quality      = Math.min(100, Math.round(
    Math.min(40, wordCount * 0.5) + Math.min(25, tradeoffs * 8) + Math.min(20, stakeholders * 5) + hasNumbers * 15,
  ));
  return { wordCount, tradeoffCount:tradeoffs, qualityScore:quality };
}

/* ── Route registration ───────────────────────────────────────────── */
export function registerCareerSimulationRoutes(app: Express): void {

  /* GET /api/career/simulations/catalog */
  app.get('/api/career/simulations/catalog', (_req, res) => {
    const types: SimType[] = ['leadership','strategic','conflict','operational','emotional-intelligence','negotiation'];
    const byType = types.map(type => ({
      type, label:type.charAt(0).toUpperCase()+type.slice(1).replace(/-/g,' '),
      scenarios: SCENARIOS.filter(s => s.type === type).map(s => ({
        id:s.id, title:s.title, difficulty:s.difficulty, description:s.description,
        estimatedMinutes:s.estimatedMinutes, competencyFocus:s.competencyFocus,
        tags:s.tags, nodeCount:s.nodes.length,
      })),
    }));
    res.json({ catalog:byType, totalScenarios:SCENARIOS.length });
  });

  /* GET /api/career/simulations/npcs */
  app.get('/api/career/simulations/npcs', (_req, res) => {
    res.json({ npcs: Object.entries(NPCS).map(([id, npc]) => ({ id, ...npc })) });
  });

  /* POST /api/career/simulations/start */
  app.post('/api/career/simulations/start', (req, res) => {
    try {
      const { scenarioId, simulationType, userId } = req.body as { scenarioId?:string; simulationType?:string; userId?:string };
      const scenario = SCENARIOS.find(s => s.id === (scenarioId ?? simulationType))
        ?? (simulationType ? SCENARIOS.find(s => s.type === simulationType) : undefined);
      if (!scenario) return res.status(404).json({ error:'Scenario not found', availableIds:SCENARIOS.map(s=>s.id), availableTypes:[...new Set(SCENARIOS.map(s=>s.type))] });
      const sessionId = uid();
      const session: Session = {
        sessionId, scenarioId:scenario.id, userId, startedAt:Date.now(),
        decisions:[], reflections:[], currentNodeIndex:0,
        npcStates:Object.fromEntries(scenario.npcIds.map(id => [id, { state:NPCS[id]?.baseState??'calm', escalationLevel:0 }])),
        completed:false,
      };
      sessions.set(sessionId, session);
      const firstNode = scenario.nodes[0];
      res.json({ sessionId, scenario:{ id:scenario.id, title:scenario.title, type:scenario.type, context:scenario.context, objective:scenario.objective, estimatedMinutes:scenario.estimatedMinutes, nodeCount:scenario.nodes.length }, currentNode:firstNode, npcStates:session.npcStates });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* GET /api/career/simulations/session/:id */
  app.get('/api/career/simulations/session/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error:'Session not found' });
    const scenario = SCENARIOS.find(s => s.id === session.scenarioId)!;
    const currentNode = session.completed ? null : scenario.nodes[session.currentNodeIndex] ?? null;
    res.json({ session:{ sessionId:session.sessionId, scenarioId:session.scenarioId, completed:session.completed, decisionsCount:session.decisions.length, reflectionsCount:session.reflections.length, currentNodeIndex:session.currentNodeIndex, totalNodes:scenario.nodes.length }, currentNode, npcStates:session.npcStates });
  });

  /* POST /api/career/simulations/session/:id/decide */
  app.post('/api/career/simulations/session/:id/decide', (req, res) => {
    try {
      const session = sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error:'Session not found' });
      if (session.completed) return res.status(400).json({ error:'Session already completed' });
      const scenario = SCENARIOS.find(s => s.id === session.scenarioId)!;
      const { choiceId, timeTaken } = req.body as { choiceId?:string; timeTaken?:number };
      const node   = scenario.nodes[session.currentNodeIndex];
      if (!node)   return res.status(400).json({ error:'No current decision node' });
      const choice = node.choices.find(c => c.id === choiceId);
      if (!choice) return res.status(400).json({ error:'Invalid choiceId', validIds:node.choices.map(c=>c.id) });

      const tags = choice.signalTags ?? [];
      session.decisions.push({ nodeId:node.id, choiceId, choiceLabel:choice.label, signalTags:tags, traits:choice.traits, timeTaken, timestamp:Date.now() });
      if (node.npcId) updateNPCState(session, tags, node.npcId);
      session.currentNodeIndex++;

      const nextNode       = scenario.nodes[session.currentNodeIndex] ?? null;
      const isComplete     = !nextNode;
      const choiceScore    = scoreChoice(choice);
      const isOptimal      = optimalChoice(node) === choiceId;

      res.json({
        choiceScore, isOptimal, optimalChoiceId:optimalChoice(node),
        npcReaction:choice.npcReaction ?? null,
        npcStates:session.npcStates,
        requiresReflection:node.requiresReflection,
        nextNode, sessionComplete:isComplete,
        progress:{ current:session.currentNodeIndex, total:scenario.nodes.length },
      });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/simulations/session/:id/reflect */
  app.post('/api/career/simulations/session/:id/reflect', (req, res) => {
    try {
      const session = sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error:'Session not found' });
      const { nodeId, response } = req.body as { nodeId?:string; response?:string };
      if (!response || response.trim().length < 10) return res.status(400).json({ error:'Response too short (min 10 chars)' });
      const { wordCount, tradeoffCount, qualityScore } = scoreReflection(response);
      const record = { promptId:`rp_${nodeId??'general'}_${Date.now()}`, nodeId:nodeId??'general', response, wordCount, tradeoffCount, qualityScore, timestamp:Date.now() };
      session.reflections.push(record);
      const depthLabel = qualityScore>=75?'deep':qualityScore>=55?'moderate':qualityScore>=35?'surface':'minimal';
      const feedback   = qualityScore>=75?'Outstanding depth — your reasoning transparency reflects strong meta-cognitive awareness.' : qualityScore>=55?'Good reflection. To deepen: name one explicit trade-off and what you would change.' : qualityScore>=35?'Brief reflection. Aim for 80+ words and explicitly name the trade-off you accepted.' : 'Very surface. Practice: what I chose, why, and what I would need to see to choose differently.';
      res.json({ logged:true, qualityScore, wordCount, tradeoffCount, depthLabel, feedback });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/simulations/session/:id/complete */
  app.post('/api/career/simulations/session/:id/complete', (req, res) => {
    try {
      const session = sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error:'Session not found' });
      session.completed   = true;
      session.completedAt = Date.now();
      session.report      = buildReport(session);
      res.json({ completed:true, sessionId:session.sessionId, report:session.report });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* GET /api/career/simulations/session/:id/report */
  app.get('/api/career/simulations/session/:id/report', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error:'Session not found' });
    if (!session.completed) return res.status(400).json({ error:'Session not yet completed — call /complete first' });
    res.json(session.report ?? buildReport(session));
  });

  /* GET /api/career/simulations/type-meta */
  app.get('/api/career/simulations/type-meta', (_req, res) => {
    res.json({
      types:[
        { type:'leadership',            label:'Leadership',           description:'Navigate people management, performance, and team dynamics', colour:'#6366f1', icon:'Users' },
        { type:'strategic',             label:'Strategic',            description:'Resource allocation, market decisions, executive trade-offs', colour:'#8b5cf6', icon:'Target' },
        { type:'conflict',              label:'Conflict Resolution',  description:'De-escalate, negotiate, resolve interpersonal conflicts',     colour:'#ef4444', icon:'Zap' },
        { type:'operational',           label:'Operational',          description:'Project crises, scope, dependencies, execution pressure',     colour:'#f59e0b', icon:'Settings' },
        { type:'emotional-intelligence',label:'Emotional Intelligence',description:'Empathy, self-regulation, resilience under pressure',        colour:'#10b981', icon:'Heart' },
        { type:'negotiation',           label:'Negotiation',          description:'Salary, vendor, and budget negotiations with real stakes',    colour:'#3b82f6', icon:'Handshake' },
      ],
    });
  });
}
