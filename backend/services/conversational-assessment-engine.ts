/**
 * Conversational Assessment Engine — turn-based dialogue runtime that
 * extracts behavioural signals deterministically (no LLM calls).
 * Caller starts a session, sends user responses, receives next probe.
 */
export const CONVERSATIONAL_ENGINE_VERSION = '5.0.0';

export type Turn = {
  turn: number;
  asked_at: string;
  question: string;
  competency_target: string;     // canonical: COG/COM/LEA/EXE/ADP/TEC/EIQ
  response?: string;
  responded_at?: string;
  extracted_signals?: Record<string, number>;
  flags?: string[];              // 'contradiction' | 'shallow' | 'rich'
};

export type ConversationState = {
  state: 'open' | 'closed' | 'escalated';
  turns: Turn[];
  detected_competencies: Record<string, { level: number; confidence: number }>;
  contradiction_count: number;
  quality_score: number;
};

const PROBE_BANK: Record<string, string[]> = {
  LEA: [
    'Tell me about a time you led a team through ambiguity. What was the hardest call you had to make?',
    'Describe a conflict between two team members you mediated. What did you learn?',
    'When did you last grow a direct report from underperforming to thriving?',
  ],
  COM: [
    'Walk me through how you would explain a complex technical concept to a non-technical stakeholder.',
    'Describe a time you had to deliver difficult news to senior leadership.',
  ],
  EXE: [
    'Tell me about a project where the scope ballooned. How did you re-baseline?',
    'Describe the most operationally complex thing you have shipped end-to-end.',
  ],
  COG: [
    'Walk me through a decision where you had to choose between two technically sound architectures.',
    'Describe a problem you solved by reframing it after initial attempts failed.',
  ],
  ADP: [
    'Tell me about the largest pivot you have lived through. What surprised you?',
    'Describe how you onboarded into a domain you had no prior exposure to.',
  ],
  TEC: [
    'Tell me about the most technically demanding system you have designed.',
    'Describe a bug or outage you root-caused that others had given up on.',
  ],
  EIQ: [
    'Describe a moment you misread the emotional state of a colleague. What changed afterwards?',
    'Tell me about feedback that genuinely hurt and how you metabolised it.',
  ],
};

const CANONICAL = ['COG','COM','LEA','EXE','ADP','TEC','EIQ'] as const;

export function startConversation(): ConversationState {
  return { state: 'open', turns: [], detected_competencies: {}, contradiction_count: 0, quality_score: 0 };
}

/** Pick next competency probe — round-robin biased to under-explored. */
export function chooseNextProbe(state: ConversationState): { question: string; competency_target: string } {
  const counts: Record<string, number> = Object.fromEntries(CANONICAL.map((k) => [k, 0]));
  for (const t of state.turns) counts[t.competency_target] = (counts[t.competency_target] ?? 0) + 1;
  const target = CANONICAL.slice().sort((a, b) => counts[a] - counts[b])[0];
  const bank = PROBE_BANK[target];
  const question = bank[counts[target] % bank.length];
  return { question, competency_target: target };
}

/** Inject a new question into state and return updated state + turn. */
export function appendProbe(state: ConversationState, probe: { question: string; competency_target: string }): ConversationState {
  const turn: Turn = {
    turn: state.turns.length + 1,
    asked_at: new Date().toISOString(),
    question: probe.question,
    competency_target: probe.competency_target,
  };
  return { ...state, turns: [...state.turns, turn] };
}

/** Score a response deterministically (length + signal words + specificity). */
export function scoreResponse(response: string, target: string): { level: number; signals: Record<string, number>; flags: string[] } {
  const text = (response ?? '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const flags: string[] = [];

  if (wc < 25) flags.push('shallow');
  if (wc > 120) flags.push('rich');

  const specifics = (text.match(/\b(\d+%|\$\d|\d+\s*(people|engineers|weeks|months|quarters|customers))/gi) ?? []).length;
  const reflective = /\b(i learned|i realised|in hindsight|i would|i changed)/i.test(text) ? 1 : 0;
  const concrete = /\b(led|built|shipped|reduced|migrated|hired|launched)/i.test(text) ? 1 : 0;

  const depth = Math.min(40, Math.round(wc / 4));
  const score = Math.max(0, Math.min(100, depth + specifics * 8 + reflective * 12 + concrete * 10));

  const signals: Record<string, number> = { depth, specifics, reflective, concrete };
  // Boost target competency, soft side-evidence to COM
  return { level: score, signals: { ...signals, [target]: score, COM: Math.min(100, score * 0.4) }, flags };
}

/** Detect contradiction vs prior turn for the same competency (level delta > 35). */
function detectContradiction(state: ConversationState, target: string, newLevel: number): boolean {
  const prior = state.turns.filter((t) => t.competency_target === target && t.extracted_signals);
  if (!prior.length) return false;
  const avg = prior.reduce((s, t) => s + (t.extracted_signals?.[target] ?? 0), 0) / prior.length;
  return Math.abs(avg - newLevel) > 35;
}

export function recordResponse(state: ConversationState, response: string): { state: ConversationState; turn: Turn } {
  const lastIdx = state.turns.length - 1;
  if (lastIdx < 0) throw new Error('no open probe to respond to');
  const last = state.turns[lastIdx];
  const target = last.competency_target;
  const scored = scoreResponse(response, target);

  const isContradiction = detectContradiction(state, target, scored.level);
  if (isContradiction) scored.flags.push('contradiction');

  const updatedTurn: Turn = { ...last, response, responded_at: new Date().toISOString(), extracted_signals: scored.signals, flags: scored.flags };

  // Update detected_competencies running average
  const det = { ...state.detected_competencies };
  const prior = det[target];
  const n = state.turns.filter((t) => t.competency_target === target && t.extracted_signals).length + 1;
  const priorLevel = prior?.level ?? 0;
  const newLevel = Math.round((priorLevel * (n - 1) + scored.level) / n);
  const newConf = Math.min(0.95, 0.4 + 0.1 * n); // grows with turn count
  det[target] = { level: newLevel, confidence: Math.round(newConf * 1000) / 1000 };

  // Quality score = weighted mean depth across all responses
  const allResponses = [...state.turns.slice(0, lastIdx), updatedTurn].filter((t) => t.extracted_signals);
  const qs = allResponses.length ? Math.round(allResponses.reduce((s, t) => s + (t.extracted_signals?.depth ?? 0), 0) / allResponses.length * 2.5) : 0;

  return {
    state: {
      ...state,
      turns: [...state.turns.slice(0, lastIdx), updatedTurn],
      detected_competencies: det,
      contradiction_count: state.contradiction_count + (isContradiction ? 1 : 0),
      quality_score: Math.min(100, qs),
    },
    turn: updatedTurn,
  };
}
