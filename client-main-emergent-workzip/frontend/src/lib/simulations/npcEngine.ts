/**
 * NPC Engine — Phase 4
 * Adaptive stakeholder profiles with personality, emotional escalation,
 * persuasion styles, and dynamic reactions.
 */

export type StakeholderType = 'manager' | 'executive' | 'client' | 'coworker' | 'difficult-stakeholder';
export type NPCArchetype    = 'supportive' | 'neutral' | 'demanding' | 'volatile' | 'strategic';
export type EmotionalState  = 'calm' | 'stressed' | 'hostile' | 'enthusiastic' | 'uncertain' | 'relieved' | 'disappointed';
export type PersuasionStyle = 'data-driven' | 'relationship' | 'authority' | 'empathy' | 'vision';

export interface NPCPersonality {
  assertiveness: number;   // 0-100
  emotionality:  number;   // 0-100 (high = highly emotional)
  rationality:   number;   // 0-100
  openness:      number;   // 0-100 (receptive to new ideas)
  patience:      number;   // 0-100
}

export interface NPCProfile {
  id:               string;
  name:             string;
  role:             string;
  stakeholderType:  StakeholderType;
  archetype:        NPCArchetype;
  personality:      NPCPersonality;
  persuasionStyle:  PersuasionStyle;
  baseState:        EmotionalState;
  avatar:           string;    // initials for avatar display
  bio:              string;
  escalationTriggers:   string[];   // signalTags that escalate this NPC
  deEscalationTriggers: string[];   // signalTags that calm this NPC
  stateMessages: Record<EmotionalState, string[]>;
}

/* ── NPC Catalog — 12 stakeholders ───────────────────────────────── */
export const NPC_CATALOG: NPCProfile[] = [
  /* ── MANAGERS ─────────────────────────────────────────────────── */
  {
    id:'priya-executive', name:'Priya Sharma', role:'VP Engineering / Director',
    stakeholderType:'manager', archetype:'demanding',
    personality:{ assertiveness:85, emotionality:40, rationality:80, openness:60, patience:50 },
    persuasionStyle:'data-driven', baseState:'stressed', avatar:'PS',
    bio:'Results-driven executive with high standards and low tolerance for ambiguity. Respects directness and data.',
    escalationTriggers:['hesitation','indirect-response'],
    deEscalationTriggers:['accountability','strategy','confidence'],
    stateMessages:{
      calm:['I\'m listening. What\'s the plan?','Walk me through your thinking.'],
      stressed:['I need this resolved — today.','This is not what I expected to hear.'],
      hostile:['I\'ve had to apologise on your behalf twice this week.','I\'m losing confidence in this team.'],
      enthusiastic:['This is exactly the kind of thinking I was hoping for.','Good. Let\'s move forward.'],
      uncertain:['I\'m not sure this approach is right, but let\'s see.','There are risks I\'m not comfortable with yet.'],
      relieved:['Okay. That helps. Thank you for being straight with me.','Good — I appreciate the clarity.'],
      disappointed:['I expected more from you here.','We\'ll have to revisit this.'],
    },
  },
  {
    id:'ravi-engineer', name:'Ravi Kapoor', role:'Senior Engineer',
    stakeholderType:'coworker', archetype:'neutral',
    personality:{ assertiveness:45, emotionality:70, rationality:65, openness:75, patience:55 },
    persuasionStyle:'relationship', baseState:'uncertain', avatar:'RK',
    bio:'Previously a high performer now going through a difficult personal period. Values psychological safety.',
    escalationTriggers:['directness-without-empathy','public-criticism'],
    deEscalationTriggers:['empathy','patience','collaboration'],
    stateMessages:{
      calm:['I\'m okay. Just… processing things.','Thanks for asking.'],
      stressed:['I know I\'ve been struggling. I\'m aware.','I don\'t want to let the team down.'],
      hostile:['I said I\'m fine. Can we just get back to work?'],
      enthusiastic:['Actually — I think I have an idea for this.','This helps. Really.'],
      uncertain:['I\'m not sure I can commit to that timeline.','I want to be honest with you.'],
      relieved:['I\'m glad you know. I was afraid to say anything.','Thank you for understanding.'],
      disappointed:['I guess I shouldn\'t have expected different.',''],
    },
  },
  /* ── EXECUTIVES ────────────────────────────────────────────────── */
  {
    id:'anand-ceo', name:'Anand Mehta', role:'CEO',
    stakeholderType:'executive', archetype:'strategic',
    personality:{ assertiveness:90, emotionality:30, rationality:90, openness:70, patience:35 },
    persuasionStyle:'vision', baseState:'calm', avatar:'AM',
    bio:'Visionary and demanding. Expects crisp communication, first-principles thinking, and no excuses.',
    escalationTriggers:['hedging','over-explanation'],
    deEscalationTriggers:['strategy','accountability','directness'],
    stateMessages:{
      calm:['Give me the headline.','What\'s the recommendation?'],
      stressed:['I need a decision, not a committee report.','We\'re burning time.'],
      hostile:['This is not acceptable. Fix it.','I don\'t want to hear about problems — only solutions.'],
      enthusiastic:['Now that\'s thinking. Let\'s do it.','This is what I\'ve been waiting to hear.'],
      uncertain:['I\'m not convinced yet. Convince me.','What am I missing here?'],
      relieved:['Alright. You\'ve earned the trust back.','Good.'],
      disappointed:['I expected this to be further along.',''],
    },
  },
  /* ── CLIENTS ───────────────────────────────────────────────────── */
  {
    id:'vikram-client', name:'Vikram Nair', role:'Head of Operations (Client)',
    stakeholderType:'client', archetype:'volatile',
    personality:{ assertiveness:90, emotionality:85, rationality:55, openness:40, patience:25 },
    persuasionStyle:'relationship', baseState:'stressed', avatar:'VN',
    bio:'High-stakes client under internal pressure. Escalates quickly when he feels disrespected or misled.',
    escalationTriggers:['excuses','hesitation','defensive-response'],
    deEscalationTriggers:['empathy','accountability','clarity'],
    stateMessages:{
      calm:['Okay. I\'m listening. But I need specifics.','We\'ve had a good run — let\'s sort this out.'],
      stressed:['Do you understand what this delay means for us?','We\'re taking heat internally because of this.'],
      hostile:['This is completely unacceptable. I\'m looking at alternatives.','You\'ve wasted six weeks of our time.'],
      enthusiastic:['Now we\'re talking. This is what I needed to hear.','If you can deliver that, you\'ll have our loyalty.'],
      uncertain:['I\'m still not sure I believe this timeline.','What\'s your contingency if this slips again?'],
      relieved:['Okay. That\'s actually reasonable. Let\'s move forward.','Thank you for being straight with me.'],
      disappointed:['I expected more from your team.',''],
    },
  },
  /* ── COWORKERS ─────────────────────────────────────────────────── */
  {
    id:'arjun-senior', name:'Arjun Bose', role:'Senior Engineer',
    stakeholderType:'coworker', archetype:'demanding',
    personality:{ assertiveness:80, emotionality:60, rationality:75, openness:50, patience:40 },
    persuasionStyle:'data-driven', baseState:'stressed', avatar:'AB',
    bio:'Technically brilliant, opinionated, and frustrated with what he sees as disrespect of his expertise.',
    escalationTriggers:['dismissal','lack-of-attribution'],
    deEscalationTriggers:['acknowledgment','strategy','directness'],
    stateMessages:{
      calm:['Let\'s be methodical about this.','I have some data that might help.'],
      stressed:['I\'ve raised this three times. I need to know it\'s being heard.','I can\'t work with someone who undermines me.'],
      hostile:['If this doesn\'t change, I\'m exploring other options.','I don\'t feel respected here.'],
      enthusiastic:['Yes — this is the right approach. Let\'s go.','Now I feel heard.'],
      uncertain:['I\'m not sure this is the right call, but I\'ll trust the process.',''],
      relieved:['Thank you for taking this seriously.','I appreciate you listening.'],
      disappointed:['I don\'t think this is going to change anything.',''],
    },
  },
  {
    id:'meera-senior', name:'Meera Rao', role:'Senior Engineer',
    stakeholderType:'coworker', archetype:'neutral',
    personality:{ assertiveness:55, emotionality:65, rationality:70, openness:80, patience:65 },
    persuasionStyle:'empathy', baseState:'uncertain', avatar:'MR',
    bio:'Highly competent but feeling marginalised and uncredited. Expresses frustration indirectly.',
    escalationTriggers:['dismissal','exclusion'],
    deEscalationTriggers:['inclusion','acknowledgment','empathy'],
    stateMessages:{
      calm:['I\'m open to how we approach this.','Let me know what you need.'],
      stressed:['I just feel like my input doesn\'t matter here.','I\'m not sure I\'m in the right place.'],
      hostile:['I\'ve been feeling this way for months and nobody\'s noticed.'],
      enthusiastic:['I didn\'t realise you saw my contribution that way. Thank you.'],
      uncertain:['I\'m not sure if I should say this, but…',''],
      relieved:['That means a lot. Genuinely.',''],
      disappointed:['I\'ll do what\'s asked, but I want it noted.',''],
    },
  },
  /* ── DIFFICULT STAKEHOLDERS ────────────────────────────────────── */
  {
    id:'rahul-pm', name:'Rahul Desai', role:'Product Manager',
    stakeholderType:'difficult-stakeholder', archetype:'demanding',
    personality:{ assertiveness:85, emotionality:70, rationality:65, openness:45, patience:30 },
    persuasionStyle:'authority', baseState:'stressed', avatar:'RD',
    bio:'Ambitious PM who believes his product is always the priority. Escalates quickly to the CPO when blocked.',
    escalationTriggers:['deprioritization','vague-response'],
    deEscalationTriggers:['commitment','timeline','accountability'],
    stateMessages:{
      calm:['What\'s the plan for my product this sprint?','I just need clarity on timelines.'],
      stressed:['This is the third time you\'ve deprioritised my product.','I\'m going to have to take this to the CPO.'],
      hostile:['I\'m done having the same conversation. I\'m escalating.','This is affecting my team\'s morale.'],
      enthusiastic:['Finally. This is what I\'ve been asking for.','Let\'s lock this in writing.'],
      uncertain:['I\'ll believe it when I see it.',''],
      relieved:['Okay. This is what I needed. Thank you.',''],
      disappointed:['Another delay. Noted.',''],
    },
  },
  {
    id:'kavya-peer', name:'Kavya Singh', role:'Senior Analyst / Peer Manager',
    stakeholderType:'difficult-stakeholder', archetype:'volatile',
    personality:{ assertiveness:70, emotionality:80, rationality:50, openness:40, patience:35 },
    persuasionStyle:'relationship', baseState:'uncertain', avatar:'KS',
    bio:'Passed over for a promotion she believed she deserved. Will test authority and look for opportunities to undermine.',
    escalationTriggers:['authority-assertion','exclusion'],
    deEscalationTriggers:['acknowledgment','empathy','inclusion'],
    stateMessages:{
      calm:['Fine. What do you need from me?',''],
      stressed:['This isn\'t how I expected things to work out.',''],
      hostile:['With all due respect — I\'m not sure you\'re the right person to be telling me this.','I\'m documenting this conversation.'],
      enthusiastic:['Actually, that\'s a good idea. I can support that.',''],
      uncertain:['I\'ll see how this plays out.',''],
      relieved:['I appreciate you being upfront with me.','That\'s more than I expected.'],
      disappointed:['I guess some things never change.',''],
    },
  },
  /* ── ADDITIONAL STAKEHOLDERS ────────────────────────────────────── */
  {
    id:'shreya-peer', name:'Shreya Iyer', role:'Peer Product Manager',
    stakeholderType:'difficult-stakeholder', archetype:'strategic',
    personality:{ assertiveness:75, emotionality:45, rationality:80, openness:60, patience:60 },
    persuasionStyle:'vision', baseState:'calm', avatar:'SI',
    bio:'Political operator. Skilled at building visibility. Does not always attribute contributions accurately.',
    escalationTriggers:['public-accusation','direct-confrontation'],
    deEscalationTriggers:['private-resolution','acknowledgment'],
    stateMessages:{
      calm:['I don\'t see it the same way, but let\'s talk.','What\'s your concern exactly?'],
      stressed:['I didn\'t intend to misrepresent anything.','Let\'s not make this bigger than it is.'],
      hostile:['I\'m not going to be accused of something I didn\'t do deliberately.',''],
      enthusiastic:['Let\'s co-present next time — that\'s a great idea.',''],
      uncertain:['I\'m not sure what the best path forward is.',''],
      relieved:['I\'m glad we talked privately. This would have gotten messy.',''],
      disappointed:['I thought we were past this.',''],
    },
  },
  {
    id:'ananya-report', name:'Ananya Verma', role:'Mid-level Analyst',
    stakeholderType:'coworker', archetype:'neutral',
    personality:{ assertiveness:30, emotionality:90, rationality:60, openness:85, patience:70 },
    persuasionStyle:'empathy', baseState:'uncertain', avatar:'AV',
    bio:'Talented but struggling with anxiety. Needs psychological safety to perform at her best.',
    escalationTriggers:['clinical-response','lack-of-empathy','hr-threat'],
    deEscalationTriggers:['empathy','reassurance','patience'],
    stateMessages:{
      calm:['Thank you. I feel better talking about it.','I needed that.'],
      stressed:['I\'m sorry — I shouldn\'t have said anything.','I just don\'t know what to do.'],
      hostile:[],
      enthusiastic:['You\'re the first manager who\'s really listened.',''],
      uncertain:['I\'m not sure what you\'ll think of me now.','Will this affect my performance review?'],
      relieved:['I\'ve been carrying this alone for months.','Thank you for not making this weird.'],
      disappointed:['I knew this was a mistake.',''],
    },
  },
];

/* ── Emotional State Machine ──────────────────────────────────────── */
export interface NPCState {
  npcId:          string;
  currentState:   EmotionalState;
  escalationLevel:number;   // 0-3 (0=calm, 3=maximum escalation)
  stateHistory:   { state: EmotionalState; reason: string; turn: number }[];
}

export function initNPCState(npcId: string): NPCState {
  const npc = getNPC(npcId);
  return { npcId, currentState: npc?.baseState ?? 'calm', escalationLevel:0, stateHistory:[] };
}

export function updateNPCState(
  state:     NPCState,
  signalTags:string[],
  turn:      number,
): NPCState {
  const npc = getNPC(state.npcId);
  if (!npc) return state;

  let newState = state.currentState;
  let newLevel = state.escalationLevel;
  let reason   = '';

  const hasEscalation   = signalTags.some(t => npc.escalationTriggers.includes(t));
  const hasDeEscalation = signalTags.some(t => npc.deEscalationTriggers.includes(t));

  if (hasEscalation) {
    newLevel = Math.min(3, newLevel + 1);
    reason   = `Triggered by: ${signalTags.find(t => npc.escalationTriggers.includes(t))}`;
    newState = newLevel >= 3 ? 'hostile' : newLevel >= 2 ? 'stressed' : 'uncertain';
  } else if (hasDeEscalation) {
    newLevel = Math.max(0, newLevel - 1);
    reason   = `De-escalated by: ${signalTags.find(t => npc.deEscalationTriggers.includes(t))}`;
    newState = newLevel === 0 ? 'calm' : newLevel === 1 ? 'uncertain' : 'stressed';
    if (newLevel === 0 && state.escalationLevel >= 2) newState = 'relieved';
  }

  // Emotional arc: supportive NPCs move to enthusiastic on positive signals
  if (npc.archetype === 'supportive' && signalTags.includes('empathy')) newState = 'enthusiastic';

  return {
    ...state,
    currentState:    newState,
    escalationLevel: newLevel,
    stateHistory:    [...state.stateHistory, { state:newState, reason, turn }],
  };
}

export function getNPCMessage(npcId: string, state: EmotionalState): string {
  const npc = getNPC(npcId);
  if (!npc) return '';
  const msgs = npc.stateMessages[state];
  if (!msgs || msgs.length === 0) return npc.stateMessages['calm'][0] ?? '';
  return msgs[Math.floor(Math.random() * msgs.length)];
}

export function getNPC(id: string): NPCProfile | undefined {
  return NPC_CATALOG.find(n => n.id === id);
}

export function getNPCsByType(type: StakeholderType): NPCProfile[] {
  return NPC_CATALOG.filter(n => n.stakeholderType === type);
}

/* ── Persuasion alignment ─────────────────────────────────────────── */
export function persuasionAlignmentScore(
  npcId:     string,
  signalTags:string[],
): number {
  const npc = getNPC(npcId);
  if (!npc) return 50;
  const alignMap: Record<PersuasionStyle, string[]> = {
    'data-driven':  ['strategy','prioritization','communication-structure'],
    'relationship': ['empathy','patience','collaboration'],
    'authority':    ['directness','assertiveness','accountability'],
    'empathy':      ['empathy','patience','stress-handling'],
    'vision':       ['innovation','strategy','confidence'],
  };
  const aligned = alignMap[npc.persuasionStyle] ?? [];
  const matches = signalTags.filter(t => aligned.includes(t)).length;
  return Math.min(100, 50 + matches * 15);
}
