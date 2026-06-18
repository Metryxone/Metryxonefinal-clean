/**
 * Scenario Engine — Phase 4
 * Catalog of 18 workplace simulations across 6 types.
 * Each scenario is a decision tree with NPCs, prompts, and trait-tagged choices.
 */

export type SimType = 'leadership' | 'strategic' | 'conflict' | 'operational' | 'emotional-intelligence' | 'negotiation';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface DecisionChoice {
  id:            string;
  label:         string;
  subtext?:      string;
  traits: {
    courage?:        number;   // -2 to +2
    empathy?:        number;
    strategy?:       number;
    directness?:     number;
    patience?:       number;
    assertiveness?:  number;
    collaboration?:  number;
    innovation?:     number;
    accountability?: number;
  };
  npcReaction?:  string;
  outcomeHint?:  string;
  signalTags?:   string[];    // behavioral signals this choice emits
}

export interface DecisionNode {
  id:                 string;
  sequence:           number;
  prompt:             string;
  context?:           string;
  npcMessage?:        string;
  npcId?:             string;
  requiresReflection: boolean;
  timePressure?:      number;    // seconds; 0 = none
  choices:            DecisionChoice[];
}

export interface Scenario {
  id:          string;
  title:       string;
  type:        SimType;
  difficulty:  Difficulty;
  description: string;
  context:     string;
  objective:   string;
  npcIds:      string[];
  estimatedMinutes: number;
  competencyFocus: string[];    // from 24-competency catalog
  tags:        string[];
  nodes:       DecisionNode[];
}

/* ── Scenario Catalog ─────────────────────────────────────────────── */
export const SCENARIO_CATALOG: Scenario[] = [

  /* ══════════════════════════════════════════════════════════════
     LEADERSHIP SIMULATIONS
  ══════════════════════════════════════════════════════════════ */
  {
    id: 'lead-underperformer',
    title: 'The Underperforming Team Member',
    type: 'leadership', difficulty: 'intermediate',
    description: 'A previously strong engineer has missed three consecutive deadlines. The team is frustrated. You must act.',
    context: 'You manage a 6-person engineering team. Ravi — once your best performer — has missed three deadlines in six weeks. Sprint velocity is down 18%. The team is quietly resentful. Ravi has not flagged any issues.',
    objective: 'Improve performance while maintaining team morale and psychological safety.',
    npcIds: ['ravi-engineer', 'priya-executive'],
    estimatedMinutes: 12, competencyFocus: ['people-mgmt','collaboration','resilience'],
    tags: ['performance','feedback','empathy'],
    nodes: [
      {
        id:'l1-n1', sequence:1, requiresReflection:false, npcId:'ravi-engineer',
        npcMessage:'Hey — do you have a minute? I know things have been… rough lately.',
        prompt:'Ravi stops you in the corridor and opens up. How do you respond?',
        choices: [
          { id:'l1-n1-a', label:'Find a private room and listen fully', subtext:'Drop your next meeting — this matters now.', traits:{ empathy:2, patience:2, directness:0 }, npcReaction:'Ravi visibly relaxes. He mentions personal stress he had been hiding.', signalTags:['empathy','patience'] },
          { id:'l1-n1-b', label:'Schedule a 1:1 for later today', subtext:'You acknowledge, but keep walking.', traits:{ strategy:1, directness:1, empathy:0 }, npcReaction:'Ravi nods but looks slightly deflated — the moment passes.', signalTags:['prioritization'] },
          { id:'l1-n1-c', label:'Ask him to raise it in the next sprint retro', subtext:'Public forum for a private matter.', traits:{ directness:-1, empathy:-2, collaboration:-1 }, npcReaction:'Ravi goes quiet. He says "never mind" and walks away.', signalTags:['hesitation','empathy'] },
          { id:'l1-n1-d', label:'Tell him you have noticed the misses and need explanations', subtext:'Jump straight to accountability.', traits:{ directness:2, assertiveness:1, empathy:-1 }, npcReaction:'Ravi becomes defensive. The conversation ends unproductively.', signalTags:['directness','confidence'] },
        ],
      },
      {
        id:'l1-n2', sequence:2, requiresReflection:true, timePressure:90,
        prompt:'Your director messages: "We need Ravi\'s module by Friday or we delay the client launch. Fix it." You have 90 seconds to decide your next move.',
        context:'It\'s now Wednesday. Ravi\'s module is 60% complete. The client launch is worth ₹2.4Cr.',
        choices: [
          { id:'l1-n2-a', label:'Pair Ravi with a senior engineer to close the gap together', traits:{ collaboration:2, strategy:2, assertiveness:1 }, npcReaction:'Ravi appreciates the support. Progress accelerates.', signalTags:['strategy','collaboration','stress-handling'] },
          { id:'l1-n2-b', label:'Reassign the module to another engineer without telling Ravi', traits:{ directness:1, courage:-1, empathy:-2 }, npcReaction:'Ravi finds out. Trust is severely damaged.', signalTags:['confidence','hesitation'] },
          { id:'l1-n2-c', label:'Tell the director the deadline is unrealistic and push back', traits:{ courage:2, assertiveness:2, strategy:1 }, npcReaction:'Director is surprised but respects the honesty. Deadline is extended by 2 days.', signalTags:['confidence','assertiveness','stress-handling'] },
          { id:'l1-n2-d', label:'Ask Ravi to work overtime — frame it as "everyone\'s doing it"', traits:{ assertiveness:0, empathy:-1, strategy:-1 }, npcReaction:'Ravi complies but disengages further. Team morale drops.', signalTags:['hesitation'] },
        ],
      },
      {
        id:'l1-n3', sequence:3, requiresReflection:true,
        prompt:'After the crisis passes, you need to have a formal performance conversation with Ravi. What is your approach?',
        choices: [
          { id:'l1-n3-a', label:'Structure it as a two-way PIP with Ravi co-authoring goals', traits:{ collaboration:2, strategy:2, empathy:2, accountability:2 }, npcReaction:'Ravi feels ownership. Engagement improves visibly next sprint.', signalTags:['strategy','empathy','collaboration'] },
          { id:'l1-n3-b', label:'Deliver a written formal warning citing the three misses', traits:{ directness:2, accountability:2, empathy:-1 }, npcReaction:'Ravi complies formally but trust is strained.', signalTags:['directness','confidence'] },
          { id:'l1-n3-c', label:'Keep it informal — just a friendly chat with no documentation', traits:{ empathy:1, accountability:-2, strategy:-1 }, npcReaction:'The pattern repeats next quarter.', signalTags:['hesitation','empathy'] },
          { id:'l1-n3-d', label:'Involve HR from the start and let them lead', traits:{ assertiveness:-1, courage:-1, strategy:0 }, npcReaction:'Ravi feels blindsided. The relationship deteriorates.', signalTags:['hesitation'] },
        ],
      },
    ],
  },

  {
    id: 'lead-team-conflict',
    title: 'Fractured Team — Two Senior Engineers at War',
    type: 'leadership', difficulty: 'advanced',
    description: 'Two of your strongest engineers are in open conflict. Productivity is suffering. Both are threatening to quit.',
    context: 'Arjun and Meera — both senior engineers — have been arguing publicly in Slack and in standups for two weeks. Other team members have stopped contributing in calls. Two junior members have complained to HR.',
    objective: 'Resolve the conflict without losing either engineer. Restore psychological safety.',
    npcIds: ['arjun-senior', 'meera-senior'],
    estimatedMinutes: 15, competencyFocus: ['people-mgmt','collaboration','resilience','stakeholder-mgmt'],
    tags: ['conflict','team-dynamics','psychological-safety'],
    nodes: [
      {
        id:'lc2-n1', sequence:1, requiresReflection:false, npcId:'arjun-senior',
        npcMessage:'I can\'t work with someone who constantly undermines my technical decisions in front of the whole team.',
        prompt:'Arjun confronts you first. His frustration is at boiling point. What do you do first?',
        choices: [
          { id:'lc2-n1-a', label:'Listen to Arjun fully, then set up a joint mediation session', traits:{ empathy:2, strategy:2, patience:2 }, signalTags:['empathy','strategy','patience'] },
          { id:'lc2-n1-b', label:'Tell Arjun to act more professionally and move on', traits:{ directness:2, empathy:-2, patience:-1 }, signalTags:['directness','confidence'] },
          { id:'lc2-n1-c', label:'Immediately call both Arjun and Meera into a meeting together', traits:{ assertiveness:1, empathy:-1, strategy:-1 }, signalTags:['assertiveness','hesitation'] },
          { id:'lc2-n1-d', label:'Tell Arjun you will escalate to HR and let them handle it', traits:{ courage:-1, strategy:-1, empathy:0 }, signalTags:['hesitation'] },
        ],
      },
      {
        id:'lc2-n2', sequence:2, requiresReflection:true,
        prompt:'In the mediation session, Meera reveals she\'s felt excluded from architectural decisions for months and Arjun\'s public corrections feel like bullying. Arjun looks stunned. What do you do next?',
        choices: [
          { id:'lc2-n2-a', label:'Acknowledge Meera\'s experience and ask Arjun how he wants to respond', traits:{ empathy:2, strategy:2, collaboration:2, patience:2 }, signalTags:['empathy','strategy'] },
          { id:'lc2-n2-b', label:'Tell them this new information changes things — adjourn to process separately', traits:{ strategy:1, patience:2, directness:1 }, signalTags:['strategy','patience'] },
          { id:'lc2-n2-c', label:'Ask Arjun to apologise on the spot', traits:{ directness:2, empathy:0, strategy:-1 }, signalTags:['directness','confidence'] },
          { id:'lc2-n2-d', label:'Focus on team process — propose new code review norms to prevent recurrence', traits:{ strategy:2, empathy:0, collaboration:1 }, signalTags:['strategy','innovation'] },
        ],
      },
    ],
  },

  {
    id: 'lead-new-manager',
    title: 'First 30 Days as Manager',
    type: 'leadership', difficulty: 'beginner',
    description: 'You\'ve just been promoted to lead your former peers. Navigate the delicate first month.',
    context: 'You were promoted internally. Two colleagues applied for the same role. Your team includes former peers, including one who openly expected to be chosen instead.',
    objective: 'Establish credibility and trust without alienating former peers.',
    npcIds: ['kavya-peer', 'priya-executive'],
    estimatedMinutes: 10, competencyFocus: ['people-mgmt','collaboration','stakeholder-mgmt'],
    tags: ['new-manager','credibility','peer-dynamics'],
    nodes: [
      {
        id:'nm-n1', sequence:1, requiresReflection:false, npcId:'kavya-peer',
        npcMessage:'Congratulations… I guess. Though I\'m not sure what you\'ll do differently here.',
        prompt:'Kavya — who applied for your role — delivers a cold congratulations in front of others. How do you respond?',
        choices: [
          { id:'nm-n1-a', label:'Thank her warmly and privately ask for a coffee chat to understand her perspective', traits:{ empathy:2, strategy:2, courage:1 }, signalTags:['empathy','strategy'] },
          { id:'nm-n1-b', label:'Brush it off and focus on the team announcement', traits:{ directness:1, empathy:0, assertiveness:1 }, signalTags:['confidence'] },
          { id:'nm-n1-c', label:'Publicly acknowledge that Kavya was a strong candidate', traits:{ empathy:2, courage:2, directness:1 }, signalTags:['empathy','confidence','assertiveness'] },
          { id:'nm-n1-d', label:'Report Kavya\'s tone to HR pre-emptively', traits:{ courage:-1, strategy:-2, empathy:-1 }, signalTags:['hesitation'] },
        ],
      },
      {
        id:'nm-n2', sequence:2, requiresReflection:true,
        prompt:'Your director tells you to present a team improvement plan by Day 30. You could propose changes immediately to show initiative, or spend the month listening first. Which approach?',
        choices: [
          { id:'nm-n2-a', label:'Spend 3 weeks on 1:1s, then propose a collaborative plan', traits:{ strategy:2, empathy:2, patience:2, collaboration:2 }, signalTags:['strategy','empathy','patience'] },
          { id:'nm-n2-b', label:'Announce changes on Day 5 to establish authority quickly', traits:{ assertiveness:2, strategy:-1, empathy:-1 }, signalTags:['confidence','assertiveness'] },
          { id:'nm-n2-c', label:'Replicate what the previous manager did — don\'t fix what isn\'t broken', traits:{ courage:-2, innovation:-2, strategy:-1 }, signalTags:['hesitation'] },
          { id:'nm-n2-d', label:'Involve the team in co-designing the improvement plan from Day 1', traits:{ collaboration:2, innovation:2, empathy:2, courage:1 }, signalTags:['collaboration','innovation','empathy'] },
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════════════
     STRATEGIC SIMULATIONS
  ══════════════════════════════════════════════════════════════ */
  {
    id: 'strategy-resource-war',
    title: 'The Resource Allocation Battle',
    type: 'strategic', difficulty: 'advanced',
    description: 'Three product teams are competing for 4 engineers. You must allocate resources across conflicting priorities.',
    context: 'Quarter-end. Product A (₹5Cr revenue at risk), Product B (new feature promising 30% NPS lift), Product C (technical debt threatening system stability). You have 4 engineers available for 3 weeks.',
    objective: 'Make the allocation decision that best serves the organisation\'s long-term health.',
    npcIds: ['rahul-pm', 'priya-executive'],
    estimatedMinutes: 15, competencyFocus: ['strategy','business-acumen','stakeholder-mgmt','decision-making'],
    tags: ['strategy','resource-allocation','prioritization'],
    nodes: [
      {
        id:'sr-n1', sequence:1, requiresReflection:true, timePressure:120,
        prompt:'You have 4 engineers and 3 weeks. How do you allocate? Product A (revenue at risk), Product B (NPS growth), Product C (technical debt).',
        context:'Failure to address C risks a P1 outage. A delay on A risks losing the client. B\'s NPS data is internally disputed.',
        choices: [
          { id:'sr-n1-a', label:'2 on A (revenue), 2 on C (stability) — defer B', traits:{ strategy:2, business_acumen:2, assertiveness:1 }, signalTags:['strategy','prioritization','ambiguity-tolerance'] },
          { id:'sr-n1-b', label:'Split evenly: 1-1-2 with 2 on C', traits:{ strategy:1, collaboration:1, assertiveness:0 }, signalTags:['strategy','hesitation'] },
          { id:'sr-n1-c', label:'All 4 on A — protect the revenue at all costs', traits:{ strategy:0, assertiveness:2, innovation:-1 }, signalTags:['confidence','prioritization'] },
          { id:'sr-n1-d', label:'Escalate to the executive team — you\'re not resourced to make this call alone', traits:{ courage:1, strategy:1, assertiveness:-1 }, signalTags:['hesitation','strategy'] },
        ],
      },
      {
        id:'sr-n2', sequence:2, requiresReflection:true, npcId:'rahul-pm',
        npcMessage:'You\'ve deprioritised my product again. This is the third quarter in a row. My team is demotivated.',
        prompt:'Rahul, the Product B PM, confronts you. He has escalated to the CPO and is requesting an urgent call. How do you respond?',
        choices: [
          { id:'sr-n2-a', label:'Meet Rahul, acknowledge the pattern, and commit to Q-next priority with a written roadmap', traits:{ empathy:2, strategy:2, accountability:2, courage:2 }, signalTags:['empathy','strategy','confidence'] },
          { id:'sr-n2-b', label:'Let the CPO call happen — defend the decision with data', traits:{ courage:2, assertiveness:2, strategy:1 }, signalTags:['confidence','assertiveness'] },
          { id:'sr-n2-c', label:'Re-open the allocation and give Rahul 1 engineer to appease him', traits:{ strategy:-1, assertiveness:-1, empathy:1 }, signalTags:['hesitation','empathy'] },
          { id:'sr-n2-d', label:'Tell Rahul the decision is final and to trust the process', traits:{ directness:2, empathy:-1, collaboration:-1 }, signalTags:['directness','confidence'] },
        ],
      },
    ],
  },

  {
    id: 'strategy-market-entry',
    title: 'Should We Enter This Market?',
    type: 'strategic', difficulty: 'intermediate',
    description: 'Your company is considering entering a high-risk adjacent market. You must lead the go/no-go analysis.',
    context: 'The CEO has asked you to lead the analysis for entering the Southeast Asian market. TAM is ₹850Cr. Competition is fierce. Your product needs 8 months of adaptation work. Your team is already at 90% capacity.',
    objective: 'Deliver a sound go/no-go recommendation with clear tradeoffs articulated.',
    npcIds: ['priya-executive'],
    estimatedMinutes: 10, competencyFocus: ['strategy','research','business-acumen'],
    tags: ['strategy','market-analysis','risk'],
    nodes: [
      {
        id:'sme-n1', sequence:1, requiresReflection:true,
        prompt:'The CEO wants a preliminary view in 48 hours before the board meeting. What is your immediate approach?',
        choices: [
          { id:'sme-n1-a', label:'Outline a rapid 3-day analysis framework: market data, capacity reality, risk matrix', traits:{ strategy:2, innovation:2, directness:1, assertiveness:1 }, signalTags:['strategy','prioritization','ambiguity-tolerance'] },
          { id:'sme-n1-b', label:'Ask the CEO for 2 weeks to do this properly — a 48hr turnaround is reckless', traits:{ courage:2, directness:2, strategy:1 }, signalTags:['confidence','assertiveness'] },
          { id:'sme-n1-c', label:'Deliver a positive preliminary view to keep momentum, then add caveats later', traits:{ courage:-2, strategy:-2, accountability:-1 }, signalTags:['hesitation'] },
          { id:'sme-n1-d', label:'Commission external consultants immediately', traits:{ strategy:0, courage:-1, assertiveness:-1 }, signalTags:['hesitation','prioritization'] },
        ],
      },
    ],
  },

  {
    id: 'strategy-pivot-decision',
    title: 'The Pivot Moment',
    type: 'strategic', difficulty: 'advanced',
    description: 'Your product metrics have plateaued. The data suggests a pivot. Stakeholders are divided.',
    context: 'Monthly active users have been flat for 4 months. Two board members want a full product pivot. Your VP Engineering says the codebase can\'t support it in under 18 months. Your sales team says customers love the current product — it just needs better distribution.',
    objective: 'Navigate competing stakeholder views and make a clear strategic recommendation.',
    npcIds: ['priya-executive', 'rahul-pm'],
    estimatedMinutes: 14, competencyFocus: ['strategy','business-acumen','stakeholder-mgmt'],
    tags: ['pivot','strategy','stakeholders'],
    nodes: [
      {
        id:'spd-n1', sequence:1, requiresReflection:true, timePressure:90,
        prompt:'The board meeting is in 3 days. You must present a recommendation. What\'s your position?',
        choices: [
          { id:'spd-n1-a', label:'Recommend a partial pivot: new vertical with existing codebase — 6 months', traits:{ strategy:2, innovation:2, courage:2, assertiveness:1 }, signalTags:['strategy','ambiguity-tolerance','confidence'] },
          { id:'spd-n1-b', label:'No pivot — recommend a distribution/GTM overhaul first before changing product', traits:{ strategy:1, courage:2, directness:2 }, signalTags:['strategy','confidence'] },
          { id:'spd-n1-c', label:'Present all three options to the board and let them decide', traits:{ courage:-1, strategy:0, assertiveness:-1 }, signalTags:['hesitation','ambiguity-tolerance'] },
          { id:'spd-n1-d', label:'Align with the loudest board member\'s view to get through the meeting', traits:{ courage:-2, strategy:-2, accountability:-2 }, signalTags:['hesitation'] },
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════════════
     CONFLICT SIMULATIONS
  ══════════════════════════════════════════════════════════════ */
  {
    id: 'conflict-client-escalation',
    title: 'The Client Meltdown',
    type: 'conflict', difficulty: 'advanced',
    description: 'A client is furious after a missed deliverable. They are threatening to cancel a ₹3Cr contract.',
    context: 'Vikram, your largest client, has just sent a scathing email CC\'ing your CEO. The missed deliverable was partly your team\'s fault and partly caused by the client\'s own delayed approvals. The CEO has forwarded it with "Handle this — today."',
    objective: 'De-escalate the client, protect the relationship, and clarify ownership without damaging your team.',
    npcIds: ['vikram-client', 'priya-executive'],
    estimatedMinutes: 12, competencyFocus: ['stakeholder-mgmt','resilience','collaboration','writing'],
    tags: ['conflict','client','escalation'],
    nodes: [
      {
        id:'ce-n1', sequence:1, requiresReflection:false, npcId:'vikram-client',
        npcMessage:'This is completely unacceptable. We trusted you and you\'ve wasted six weeks of our time. I\'m discussing alternatives with your competitors.',
        prompt:'Vikram calls you directly, furious. The first 90 seconds of this call will set the tone. What do you say?',
        choices: [
          { id:'ce-n1-a', label:'Open with a full apology for the impact — no defensiveness yet', traits:{ empathy:2, patience:2, strategy:1, directness:1 }, npcReaction:'Vikram\'s tone softens slightly. He says "Thank you for at least admitting it."', signalTags:['empathy','stress-handling','patience'] },
          { id:'ce-n1-b', label:'Acknowledge the frustration and immediately outline a recovery plan', traits:{ strategy:2, directness:2, empathy:1 }, npcReaction:'Vikram is still upset but is listening.', signalTags:['strategy','confidence','stress-handling'] },
          { id:'ce-n1-c', label:'Respectfully but firmly point out that their delayed approvals contributed', traits:{ directness:2, courage:2, empathy:-1 }, npcReaction:'Vikram escalates further. The call ends badly.', signalTags:['directness','assertiveness'] },
          { id:'ce-n1-d', label:'Tell Vikram you\'ll have your CEO call him back personally', traits:{ courage:-1, strategy:-1, empathy:0 }, npcReaction:'Vikram says "That\'s not good enough" and hangs up.', signalTags:['hesitation'] },
        ],
      },
      {
        id:'ce-n2', sequence:2, requiresReflection:true,
        prompt:'The CEO asks you to write the recovery email to Vikram tonight. The email will be sent from the CEO\'s address. What is the substance of your recommended recovery plan?',
        choices: [
          { id:'ce-n2-a', label:'Propose a 72-hour root cause debrief + crediting one month of service fees', traits:{ strategy:2, accountability:2, empathy:2, courage:2 }, signalTags:['strategy','empathy','communication-structure'] },
          { id:'ce-n2-b', label:'Offer a full fee waiver for the delayed period + a new delivery guarantee SLA', traits:{ assertiveness:2, strategy:1, courage:2 }, signalTags:['assertiveness','strategy'] },
          { id:'ce-n2-c', label:'Apologise, restate timeline, no financial remedy — treat it as operational', traits:{ directness:1, empathy:0, strategy:-1 }, signalTags:['directness','hesitation'] },
          { id:'ce-n2-d', label:'Offer a co-creation workshop to rebuild trust with their team and redefine scope', traits:{ innovation:2, collaboration:2, empathy:2, strategy:2 }, signalTags:['innovation','collaboration','empathy'] },
        ],
      },
    ],
  },

  {
    id: 'conflict-peer-politics',
    title: 'Navigating Peer Politics',
    type: 'conflict', difficulty: 'intermediate',
    description: 'A peer manager is taking credit for your team\'s work in front of leadership.',
    context: 'In the all-hands, Shreya — a peer PM — presented your team\'s Q3 improvements as her cross-functional initiative without crediting your team. The leadership applauded. Your team is outraged and looking to you.',
    objective: 'Address the situation without escalating conflict while ensuring your team\'s contribution is recognised.',
    npcIds: ['shreya-peer', 'priya-executive'],
    estimatedMinutes: 10, competencyFocus: ['stakeholder-mgmt','collaboration','resilience'],
    tags: ['politics','credit','peer'],
    nodes: [
      {
        id:'pp-n1', sequence:1, requiresReflection:true, npcId:'shreya-peer',
        prompt:'After the meeting, how do you handle this with Shreya?',
        choices: [
          { id:'pp-n1-a', label:'Have a private, calm conversation: "I noticed X wasn\'t mentioned — what\'s the best way to correct that?"', traits:{ directness:2, empathy:1, courage:2, strategy:2 }, signalTags:['directness','assertiveness','strategy'] },
          { id:'pp-n1-b', label:'Send a follow-up email to leadership summarising your team\'s contributions with data', traits:{ strategy:2, assertiveness:2, directness:1 }, signalTags:['strategy','confidence','communication-structure'] },
          { id:'pp-n1-c', label:'Let it go — raising it will make you look petty', traits:{ courage:-2, assertiveness:-2, accountability:-1 }, signalTags:['hesitation'] },
          { id:'pp-n1-d', label:'Brief your team — then escalate to the CPO', traits:{ courage:1, strategy:-1, directness:1 }, signalTags:['directness','assertiveness'] },
        ],
      },
    ],
  },

  {
    id: 'conflict-stakeholder-misalignment',
    title: 'The Misaligned Stakeholder',
    type: 'conflict', difficulty: 'beginner',
    description: 'Two senior stakeholders have given you directly conflicting priorities. Both expect to be served first.',
    context: 'You receive an email from the Head of Sales demanding Feature X shipped this sprint. Two hours later, the CTO sends a message marking Feature Y — a technical refactor — as the top priority. Both are your direct stakeholders.',
    objective: 'Navigate the misalignment without damaging either relationship or your team\'s focus.',
    npcIds: ['rahul-pm', 'priya-executive'],
    estimatedMinutes: 8, competencyFocus: ['stakeholder-mgmt','strategy','communication'],
    tags: ['stakeholders','alignment','communication'],
    nodes: [
      {
        id:'sm-n1', sequence:1, requiresReflection:true,
        prompt:'Two senior stakeholders, conflicting priorities, same sprint. What is your first move?',
        choices: [
          { id:'sm-n1-a', label:'Request a 30-min 3-way alignment call today — come with a proposed resolution', traits:{ strategy:2, directness:2, courage:2, collaboration:2 }, signalTags:['strategy','communication-structure','confidence'] },
          { id:'sm-n1-b', label:'Go to your direct manager and ask them to arbitrate', traits:{ strategy:0, courage:-1, directness:0 }, signalTags:['hesitation'] },
          { id:'sm-n1-c', label:'Do Feature X (Sales) as it has direct revenue impact — explain to CTO afterwards', traits:{ strategy:1, directness:1, assertiveness:1 }, signalTags:['prioritization','confidence'] },
          { id:'sm-n1-d', label:'Split the sprint 50/50 and deliver neither fully', traits:{ strategy:-2, assertiveness:-1, directness:-1 }, signalTags:['hesitation','prioritization'] },
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════════════
     OPERATIONAL SIMULATIONS
  ══════════════════════════════════════════════════════════════ */
  {
    id: 'ops-project-crisis',
    title: 'Project in Freefall',
    type: 'operational', difficulty: 'advanced',
    description: 'A flagship project is 4 weeks behind, the client is watching, and the team is burning out.',
    context: 'Project Phoenix is a ₹8Cr client engagement. It\'s week 10 of a 12-week project. You\'re 4 weeks behind on 3 deliverables. Two engineers are on sick leave. The client relationship manager is calling daily.',
    objective: 'Stabilise the project and develop a credible recovery plan.',
    npcIds: ['vikram-client', 'priya-executive'],
    estimatedMinutes: 15, competencyFocus: ['project-mgmt','strategy','resilience','stakeholder-mgmt'],
    tags: ['project','crisis','recovery'],
    nodes: [
      {
        id:'pc-n1', sequence:1, requiresReflection:true, timePressure:120,
        prompt:'You need to present a recovery plan in 24 hours. You have 3 engineers and 2 weeks of buffer. What\'s your immediate triage decision?',
        choices: [
          { id:'pc-n1-a', label:'Cut scope to 3 critical deliverables — agree with client what gets deferred', traits:{ strategy:2, courage:2, directness:2, accountability:2 }, signalTags:['strategy','prioritization','confidence','stress-handling'] },
          { id:'pc-n1-b', label:'Request emergency resource from another project — accept the schedule risk', traits:{ strategy:1, courage:1, assertiveness:2 }, signalTags:['assertiveness','strategy'] },
          { id:'pc-n1-c', label:'Commit to the original scope on paper while privately preparing for a slip', traits:{ courage:-2, accountability:-2, strategy:-1 }, signalTags:['hesitation'] },
          { id:'pc-n1-d', label:'Present 3 options to the client and let them choose', traits:{ strategy:2, collaboration:2, transparency:2 }, signalTags:['strategy','communication-structure'] },
        ],
      },
      {
        id:'pc-n2', sequence:2, requiresReflection:false, npcId:'priya-executive',
        npcMessage:'I\'ve had to apologise to the client twice this week. I need to know this will not happen again.',
        prompt:'Your VP pulls you aside. She is calm but clearly disappointed. How do you respond?',
        choices: [
          { id:'pc-n2-a', label:'Acknowledge the impact fully, share the root cause analysis, commit to process changes', traits:{ accountability:2, courage:2, directness:2, strategy:2 }, signalTags:['accountability','confidence','stress-handling'] },
          { id:'pc-n2-b', label:'Explain the resourcing constraints that contributed — share the context', traits:{ directness:2, courage:1, strategy:1 }, signalTags:['directness','confidence'] },
          { id:'pc-n2-c', label:'Apologise profusely and over-promise on next steps', traits:{ courage:-1, accountability:-1 }, signalTags:['hesitation'] },
          { id:'pc-n2-d', label:'Ask for her support in escalating the resource issue to the executive team', traits:{ strategy:2, courage:2, assertiveness:1 }, signalTags:['strategy','assertiveness'] },
        ],
      },
    ],
  },

  {
    id: 'ops-scope-creep',
    title: 'Scope Creep at Scale',
    type: 'operational', difficulty: 'intermediate',
    description: 'A client keeps adding requirements with no change order. Your team is absorbing 40% extra scope for free.',
    context: 'You\'re 6 months into a 9-month implementation. The client has added 12 new requirements incrementally — none were formally raised as change requests. Your team has absorbed them. The PM says "the relationship is too important to rock the boat."',
    objective: 'Protect your team\'s capacity and address the scope problem without damaging the relationship.',
    npcIds: ['vikram-client', 'rahul-pm'],
    estimatedMinutes: 10, competencyFocus: ['project-mgmt','stakeholder-mgmt','negotiation','resilience'],
    tags: ['scope','boundaries','negotiation'],
    nodes: [
      {
        id:'sc-n1', sequence:1, requiresReflection:true,
        prompt:'You\'ve now mapped the actual vs contracted scope. You\'re absorbing ₹48L of work for free. What do you do with this data?',
        choices: [
          { id:'sc-n1-a', label:'Present the scope delta to the client and initiate a formal change order conversation', traits:{ courage:2, directness:2, strategy:2, assertiveness:2 }, signalTags:['assertiveness','confidence','strategy','communication-structure'] },
          { id:'sc-n1-b', label:'Escalate internally — get executive buy-in before approaching the client', traits:{ strategy:2, courage:1, assertiveness:1 }, signalTags:['strategy','assertiveness'] },
          { id:'sc-n1-c', label:'Continue absorbing — the margin hit is manageable and the reference is worth it', traits:{ courage:-2, strategy:-1, accountability:-1 }, signalTags:['hesitation'] },
          { id:'sc-n1-d', label:'Stop accepting new requirements without a formal change order — enforce it immediately', traits:{ directness:2, courage:2, assertiveness:2 }, signalTags:['directness','assertiveness','confidence'] },
        ],
      },
    ],
  },

  {
    id: 'ops-cross-team-dependency',
    title: 'The Broken Cross-Team Dependency',
    type: 'operational', difficulty: 'beginner',
    description: 'A critical dependency from another team is two weeks overdue. Your sprint is blocked.',
    context: 'Team Alpha was supposed to deliver an API integration 2 weeks ago. Without it, your team\'s entire next sprint is blocked. The other team lead says they\'re "working on it." Your manager expects your sprint to proceed on schedule.',
    objective: 'Unblock your team without creating inter-team conflict.',
    npcIds: ['arjun-senior'],
    estimatedMinutes: 8, competencyFocus: ['project-mgmt','collaboration','stakeholder-mgmt'],
    tags: ['dependencies','cross-team','escalation'],
    nodes: [
      {
        id:'cd-n1', sequence:1, requiresReflection:true,
        prompt:'Your sprint is blocked. Team Alpha\'s lead is unresponsive. What is your escalation strategy?',
        choices: [
          { id:'cd-n1-a', label:'Request a joint technical session with both leads to define the exact blocker and a 48hr plan', traits:{ collaboration:2, strategy:2, directness:2 }, signalTags:['collaboration','strategy','communication-structure'] },
          { id:'cd-n1-b', label:'Escalate to your manager with a written dependency risk — ask for executive sponsorship', traits:{ strategy:2, directness:2, courage:1 }, signalTags:['strategy','confidence'] },
          { id:'cd-n1-c', label:'Redesign your sprint to work around the dependency for now', traits:{ innovation:2, strategy:2, resilience:2 }, signalTags:['innovation','ambiguity-tolerance','prioritization'] },
          { id:'cd-n1-d', label:'Wait for Team Alpha — your manager will understand when they know the full picture', traits:{ courage:-1, strategy:-2 }, signalTags:['hesitation'] },
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════════════
     EMOTIONAL INTELLIGENCE SIMULATIONS
  ══════════════════════════════════════════════════════════════ */
  {
    id: 'ei-colleague-distress',
    title: 'A Colleague in Crisis',
    type: 'emotional-intelligence', difficulty: 'intermediate',
    description: 'A colleague confides that they are struggling with mental health. You\'re their manager. This is uncharted territory.',
    context: 'Ananya, a mid-level analyst on your team, pulls you aside after a team lunch. She says she\'s been struggling with anxiety for months and it\'s affecting her work. She\'s afraid of what this means for her job. She\'s crying.',
    objective: 'Respond with empathy, ensure her safety and dignity, and take the right next steps.',
    npcIds: ['ananya-report'],
    estimatedMinutes: 10, competencyFocus: ['people-mgmt','collaboration','resilience'],
    tags: ['mental-health','empathy','psychological-safety'],
    nodes: [
      {
        id:'cd-n1', sequence:1, requiresReflection:true, npcId:'ananya-report',
        npcMessage:'I\'m sorry, I shouldn\'t have said anything. Please don\'t tell anyone.',
        prompt:'Ananya has just confided in you and is now apologising for it. What do you say?',
        choices: [
          { id:'cd-n1-a', label:'Thank her for trusting you. Reassure her that her job is safe. Ask what support she needs.', traits:{ empathy:2, patience:2, strategy:1 }, npcReaction:'Ananya breathes out and says "I didn\'t know how you would react." She seems relieved.', signalTags:['empathy','patience'] },
          { id:'cd-n1-b', label:'Reassure her, then immediately suggest she contacts the company EAP helpline', traits:{ empathy:1, strategy:1, directness:1 }, npcReaction:'Ananya nods but the speed of your solution feels slightly clinical to her.', signalTags:['empathy','strategy'] },
          { id:'cd-n1-c', label:'Tell her you are required to inform HR and will do so today', traits:{ directness:2, empathy:-2, strategy:-1 }, npcReaction:'Ananya looks panicked. "I knew I shouldn\'t have said anything."', signalTags:['directness','hesitation'] },
          { id:'cd-n1-d', label:'Listen fully — then ask if she wants to just talk for a while before deciding anything', traits:{ empathy:2, patience:2, collaboration:1 }, npcReaction:'Ananya nods. The tears slow. She says "yes, please."', signalTags:['empathy','patience','communication-structure'] },
        ],
      },
    ],
  },

  {
    id: 'ei-anger-test',
    title: 'When You\'re the Angriest Person in the Room',
    type: 'emotional-intelligence', difficulty: 'advanced',
    description: 'You have just received news that will genuinely damage your career trajectory. You are in a meeting.',
    context: 'Your promotion has just been denied — you found out via a Slack message from HR while in a meeting with your team. You can feel your face flushing. The meeting continues.',
    objective: 'Regulate your emotional response in real time and make a decision about how to handle this constructively.',
    npcIds: ['priya-executive', 'arjun-senior'],
    estimatedMinutes: 8, competencyFocus: ['resilience','collaboration','stakeholder-mgmt'],
    tags: ['self-regulation','anger','composure'],
    nodes: [
      {
        id:'at-n1', sequence:1, requiresReflection:true,
        prompt:'You are in the meeting. You\'ve just read the Slack. The facilitator has asked you a question. What do you do?',
        choices: [
          { id:'at-n1-a', label:'Take a slow breath, answer the question briefly, continue normally', traits:{ resilience:2, patience:2, assertiveness:1, empathy:1 }, signalTags:['stress-handling','resilience'] },
          { id:'at-n1-b', label:'Excuse yourself briefly: "I need 2 minutes — apologies." Return composed.', traits:{ resilience:2, patience:2, directness:1, self_awareness:2 }, signalTags:['stress-handling','self-awareness'] },
          { id:'at-n1-c', label:'Continue as normal — suppress everything until the end of the day', traits:{ resilience:1, patience:1, empathy:0 }, signalTags:['stress-handling'] },
          { id:'at-n1-d', label:'Express visibly that something has come up — cut the meeting short', traits:{ directness:2, resilience:0, empathy:0 }, signalTags:['directness','stress-handling'] },
        ],
      },
    ],
  },

  {
    id: 'ei-empathy-test',
    title: 'Reading the Room',
    type: 'emotional-intelligence', difficulty: 'beginner',
    description: 'Your team\'s mood has shifted dramatically after a company-wide reorg announcement. You need to respond.',
    context: 'The company has announced a major restructuring. 15% workforce reduction. Your team is intact — but they don\'t know that yet. The all-hands was vague. Slack is silent. People are staring at screens.',
    objective: 'Read the emotional state of your team and respond in a way that restores psychological safety.',
    npcIds: ['ravi-engineer', 'kavya-peer'],
    estimatedMinutes: 8, competencyFocus: ['people-mgmt','resilience','collaboration'],
    tags: ['empathy','reorg','psychological-safety'],
    nodes: [
      {
        id:'et-n1', sequence:1, requiresReflection:true,
        prompt:'It\'s 11am. The all-hands ended an hour ago. Your team hasn\'t spoken in Slack since. What do you do?',
        choices: [
          { id:'et-n1-a', label:'Send a direct message to each person individually: "How are you doing right now?"', traits:{ empathy:2, patience:2, collaboration:1 }, signalTags:['empathy','communication-structure'] },
          { id:'et-n1-b', label:'Call an immediate 15-min team sync: "I want to hold space for how you\'re all feeling right now."', traits:{ empathy:2, courage:2, collaboration:2, directness:1 }, signalTags:['empathy','confidence','communication-structure'] },
          { id:'et-n1-c', label:'Send a team message: "I\'ve been told our team is safe — more details coming."', traits:{ directness:2, empathy:1, assertiveness:1, strategy:1 }, signalTags:['directness','communication-structure'] },
          { id:'et-n1-d', label:'Wait until you have more official information before saying anything', traits:{ patience:1, courage:-1, empathy:-1, strategy:-1 }, signalTags:['hesitation'] },
        ],
      },
    ],
  },

  /* ══════════════════════════════════════════════════════════════
     NEGOTIATION SIMULATIONS
  ══════════════════════════════════════════════════════════════ */
  {
    id: 'neg-salary',
    title: 'Negotiate Your Own Salary',
    type: 'negotiation', difficulty: 'intermediate',
    description: 'You have a competing offer. Your current company wants to retain you. The negotiation starts now.',
    context: 'You have received an offer for ₹32 LPA — ₹8 LPA above your current salary. Your manager has called you in for a retention conversation. You want to stay but only at the right number.',
    objective: 'Negotiate the best possible outcome while maintaining the relationship.',
    npcIds: ['priya-executive'],
    estimatedMinutes: 10, competencyFocus: ['negotiation','strategy','stakeholder-mgmt'],
    tags: ['negotiation','compensation','retention'],
    nodes: [
      {
        id:'ns-n1', sequence:1, requiresReflection:false, npcId:'priya-executive',
        npcMessage:'We really value you here and we\'d like to find a way to keep you. What would it take?',
        prompt:'Your manager opens the negotiation. She hasn\'t stated a number yet. This is your first move.',
        choices: [
          { id:'ns-n1-a', label:'Name the market number directly: "I\'d need to be at ₹30 LPA minimum to make this a clear decision."', traits:{ assertiveness:2, courage:2, strategy:2, directness:2 }, npcReaction:'She pauses, then says "That\'s higher than I expected, but let me see what I can do."', signalTags:['assertiveness','confidence'] },
          { id:'ns-n1-b', label:'Ask what the company\'s retention offer is first — don\'t anchor', traits:{ strategy:2, patience:2, assertiveness:1 }, npcReaction:'She mentions a 15% increase — ₹27.6 LPA. Now you negotiate from there.', signalTags:['strategy','patience'] },
          { id:'ns-n1-c', label:'Mention the competing offer explicitly: "I have an offer for ₹32 LPA and I\'d rather stay here."', traits:{ directness:2, courage:2, assertiveness:2, strategy:1 }, npcReaction:'She says "That\'s a strong offer. Let me escalate this internally."', signalTags:['directness','assertiveness','confidence'] },
          { id:'ns-n1-d', label:'Say you just need to feel "valued" — don\'t name a number', traits:{ courage:-2, assertiveness:-2, strategy:-1 }, npcReaction:'She offers a 10% increase. The conversation ends quickly.', signalTags:['hesitation'] },
        ],
      },
      {
        id:'ns-n2', sequence:2, requiresReflection:true, npcId:'priya-executive',
        npcMessage:'The best I can offer is ₹28 LPA plus an early performance review in 6 months. That\'s the ceiling right now.',
        prompt:'She\'s offered ₹28 LPA — ₹4L short of the competing offer. You have 60 seconds to respond.',
        timePressure:60,
        choices: [
          { id:'ns-n2-a', label:'Counter: "₹28L works if we add a ₹2L signing bonus and a defined promotion path."', traits:{ strategy:2, assertiveness:2, innovation:1, courage:2 }, npcReaction:'She considers. "I can do the signing bonus — let me check on the promotion path."', signalTags:['strategy','assertiveness','confidence','stress-handling'] },
          { id:'ns-n2-b', label:'Accept ₹28L — the intangibles of staying outweigh ₹4L', traits:{ patience:2, strategy:1, assertiveness:0 }, npcReaction:'She looks relieved. The deal is done.', signalTags:['patience','prioritization'] },
          { id:'ns-n2-c', label:'Decline and accept the competing offer — you know your market value', traits:{ courage:2, assertiveness:2, directness:2, strategy:2 }, npcReaction:'She respects the decision. The conversation ends professionally.', signalTags:['courage','confidence','assertiveness'] },
          { id:'ns-n2-d', label:'Ask for a week to decide — you need more time', traits:{ patience:1, assertiveness:-1, courage:-1 }, signalTags:['hesitation'] },
        ],
      },
    ],
  },

  {
    id: 'neg-vendor',
    title: 'The Vendor Negotiation',
    type: 'negotiation', difficulty: 'intermediate',
    description: 'You\'re renewing a SaaS contract. The vendor has increased pricing by 35%. You have leverage.',
    context: 'Your team runs on a critical SaaS tool. The renewal quote is ₹48L — a 35% increase. You use 60% of the features, have 2 alternative options (both require 3-month migrations), and have 45 days before the current contract lapses.',
    objective: 'Negotiate the renewal to market rate without triggering migration cost.',
    npcIds: ['vikram-client'],
    estimatedMinutes: 10, competencyFocus: ['negotiation','strategy','business-acumen'],
    tags: ['vendor','negotiation','procurement'],
    nodes: [
      {
        id:'nv-n1', sequence:1, requiresReflection:true,
        prompt:'The vendor\'s account manager is on the call. The opening number is ₹48L. Your budget is ₹36L. Go.',
        choices: [
          { id:'nv-n1-a', label:'Present a BATNA directly: "We\'re evaluating two alternatives. We need ₹36L to stay."', traits:{ strategy:2, assertiveness:2, directness:2, courage:2 }, npcReaction:'The vendor rep says "Let me bring my manager into this call."', signalTags:['strategy','assertiveness','confidence'] },
          { id:'nv-n1-b', label:'Reference the 60% feature utilisation: "We should only pay for what we use — can we restructure?"', traits:{ strategy:2, innovation:1, directness:2 }, signalTags:['strategy','ambiguity-tolerance','communication-structure'] },
          { id:'nv-n1-c', label:'Counter at ₹38L and leave room to negotiate down to ₹36L', traits:{ strategy:2, patience:2, assertiveness:1 }, signalTags:['strategy','patience'] },
          { id:'nv-n1-d', label:'Ask for a 2-week extension to "review the proposal internally"', traits:{ strategy:1, patience:1, courage:-1 }, signalTags:['hesitation','strategy'] },
        ],
      },
    ],
  },

  {
    id: 'neg-budget',
    title: 'Fight for Your Budget',
    type: 'negotiation', difficulty: 'advanced',
    description: 'Your department budget has been cut 30%. You must negotiate back critical spend to protect your team\'s roadmap.',
    context: 'The CFO has cut your department\'s budget by ₹1.2Cr in the annual planning cycle. Your hiring plan, 2 key tools, and a conference budget are at risk. You have one 45-minute slot with the CFO to make your case.',
    objective: 'Recover the highest-priority budget items with a data-driven argument.',
    npcIds: ['priya-executive'],
    estimatedMinutes: 12, competencyFocus: ['negotiation','strategy','business-acumen','presentation'],
    tags: ['budget','negotiation','executive'],
    nodes: [
      {
        id:'nb-n1', sequence:1, requiresReflection:true, npcId:'priya-executive',
        npcMessage:'I appreciate you coming in. We\'re making tough choices across all departments. Make your case.',
        prompt:'45 minutes with the CFO. Your opening 5 minutes will determine the tone. What\'s your structure?',
        choices: [
          { id:'nb-n1-a', label:'Lead with ROI data: each cut item\'s revenue/cost impact quantified', traits:{ strategy:2, directness:2, assertiveness:2, business_acumen:2 }, signalTags:['strategy','communication-structure','confidence'] },
          { id:'nb-n1-b', label:'Lead with team impact: "This cut means we lose 2 engineers and delay Product A by 6 months"', traits:{ directness:2, empathy:1, strategy:1, courage:2 }, signalTags:['communication-structure','directness'] },
          { id:'nb-n1-c', label:'Offer a compromise upfront: "I\'d accept a 15% cut if we protect these 3 items"', traits:{ strategy:2, assertiveness:1, collaboration:1, innovation:1 }, signalTags:['strategy','prioritization','negotiation'] },
          { id:'nb-n1-d', label:'Ask the CFO what their primary concern is before presenting anything', traits:{ strategy:2, empathy:2, patience:2 }, signalTags:['strategy','empathy','communication-structure'] },
        ],
      },
    ],
  },
];

/* ── Accessors ────────────────────────────────────────────────────── */
export function getScenario(id: string): Scenario | undefined {
  return SCENARIO_CATALOG.find(s => s.id === id);
}

export function getScenariosByType(type: SimType): Scenario[] {
  return SCENARIO_CATALOG.filter(s => s.type === type);
}

export function getScenariosByDifficulty(difficulty: Difficulty): Scenario[] {
  return SCENARIO_CATALOG.filter(s => s.difficulty === difficulty);
}

export function listScenarioTypes(): SimType[] {
  return ['leadership','strategic','conflict','operational','emotional-intelligence','negotiation'];
}

export const SCENARIO_TYPE_META: Record<SimType, { label: string; icon: string; description: string; colour: string }> = {
  'leadership':           { label:'Leadership',           icon:'Users',      description:'Navigate people management, performance, and team dynamics', colour:'#6366f1' },
  'strategic':            { label:'Strategic',            icon:'Target',     description:'Resource allocation, market decisions, and executive trade-offs', colour:'#8b5cf6' },
  'conflict':             { label:'Conflict Resolution',  icon:'Zap',        description:'De-escalate, negotiate, and resolve interpersonal conflicts', colour:'#ef4444' },
  'operational':          { label:'Operational',          icon:'Settings',   description:'Project crises, scope, dependencies, and execution pressure', colour:'#f59e0b' },
  'emotional-intelligence':{ label:'Emotional Intelligence', icon:'Heart',   description:'Empathy, self-regulation, and emotional resilience under pressure', colour:'#10b981' },
  'negotiation':          { label:'Negotiation',          icon:'Handshake',  description:'Salary, vendor, and budget negotiations with real stakes', colour:'#3b82f6' },
};
