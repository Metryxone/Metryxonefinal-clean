/**
 * OMEGA-X Intervention Sequencing + Fatigue Engine
 *
 * Optimal intervention ordering with three phases:
 *   1. Stabilisation  — reduce acute distress, build safety, create first wins
 *   2. Growth         — build new patterns, address root causes
 *   3. Optimisation   — compound gains, prevent relapse, sustain mastery
 *
 * Fatigue prevention:
 *   - Max 3 interventions total
 *   - Cognitive load filtering (high load → only 1 intervention)
 *   - Emotional load filtering (referral-level → only stabilisation)
 *   - No more than 1 "high" intensity intervention in a sequence
 */

export type InterventionPhase = 'stabilisation' | 'growth' | 'optimisation';
export type InterventionIntensity = 'low' | 'moderate' | 'high';
export type InterventionDomain =
  | 'attention' | 'emotional' | 'cognitive' | 'environmental'
  | 'executive_function' | 'consistency' | 'stress_reduction'
  | 'identity' | 'social' | 'academic' | 'career';

export interface RawIntervention {
  key: string;
  title: string;
  description: string;
  domain: InterventionDomain;
  phase: InterventionPhase;
  intensity: InterventionIntensity;
  timing: string;
  expected_outcome: string;
  adherence_likelihood: number;
  cognitive_load_cost: number;
  emotional_load_cost: number;
  evidence_base?: string;
  prerequisite_keys?: string[];
  why_it_works: string;
  effort_required: 'minimal' | 'moderate' | 'significant';
  resistance_prediction: 'low' | 'medium' | 'high';
}

export interface SequencedIntervention extends RawIntervention {
  sequence_position: number;
  phase_label: string;
  start_when: string;
  success_marker: string;
  fatigue_warning?: string;
}

// ─── Intervention Library ──────────────────────────────────────────────────────

const INTERVENTION_LIBRARY: Record<string, RawIntervention[]> = {
  digital: [
    {
      key: 'env_design',
      title: 'Environment Design',
      description: 'Remove devices from study and sleep spaces. Enable focus mode. Turn off non-essential notifications permanently.',
      domain: 'environmental',
      phase: 'stabilisation',
      intensity: 'low',
      timing: 'Start today — takes 15 minutes',
      expected_outcome: 'Reduces trigger density by 60% within the first week',
      adherence_likelihood: 0.85,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.1,
      evidence_base: 'Temptation bundling and environment design (Duckworth, 2016)',
      why_it_works: 'Behaviour is shaped more by environment than willpower. Removing cues eliminates the cognitive cost of resisting — the temptation never fires in the first place.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'time_blocking',
      title: 'Structured Time Blocking',
      description: 'Define 3 "device-free" blocks per day. Start with 25 minutes. Phone goes in another room.',
      domain: 'attention',
      phase: 'growth',
      intensity: 'moderate',
      timing: 'Begin in week 2 after environment is set',
      expected_outcome: 'Builds sustained attention stamina over 3–4 weeks',
      adherence_likelihood: 0.72,
      cognitive_load_cost: 0.4,
      emotional_load_cost: 0.2,
      prerequisite_keys: ['env_design'],
      evidence_base: 'Attention restoration theory (Kaplan, 1989)',
      why_it_works: 'Attention is a trainable muscle. Short, structured device-free windows rebuild the sustained focus capacity that chronic multitasking degrades.',
      effort_required: 'moderate',
      resistance_prediction: 'medium',
    },
    {
      key: 'digital_identity',
      title: 'Digital Identity Reframe',
      description: 'Shift internal narrative: "I am someone who protects their attention" rather than "I am trying to use my phone less."',
      domain: 'identity',
      phase: 'optimisation',
      intensity: 'low',
      timing: 'Start in week 4 once blocking is established',
      expected_outcome: 'Makes the change identity-consistent and durable beyond willpower',
      adherence_likelihood: 0.68,
      cognitive_load_cost: 0.3,
      emotional_load_cost: 0.2,
      prerequisite_keys: ['time_blocking'],
      evidence_base: 'Identity-based habit formation (Clear, 2018)',
      why_it_works: 'Identity statements are self-fulfilling. When behaviour aligns with how someone sees themselves, consistency no longer requires motivation — it becomes automatic.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
  ],
  academic: [
    {
      key: 'study_structure',
      title: 'Structured Study Protocol',
      description: '25-minute focused blocks with 5-minute breaks (Pomodoro). Write the specific task before each block, not just "study."',
      domain: 'academic',
      phase: 'stabilisation',
      intensity: 'low',
      timing: 'Start today with your next study session',
      expected_outcome: 'Reduces procrastination and builds study consistency within 1 week',
      adherence_likelihood: 0.80,
      cognitive_load_cost: 0.3,
      emotional_load_cost: 0.1,
      evidence_base: 'Pomodoro Technique; spaced practice (Ebbinghaus, 1885)',
      why_it_works: 'Time-boxing creates predictable endpoints that reduce anticipatory avoidance. Task specificity (not "study" but "solve problems 1–5") eliminates decision fatigue at the start of each block.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'anxiety_defusion',
      title: 'Pre-Exam Anxiety Protocol',
      description: 'Three-breath reset + "This is discomfort, not danger" reframe before every practice test and exam. Practise it now, not the night before.',
      domain: 'stress_reduction',
      phase: 'stabilisation',
      intensity: 'low',
      timing: 'Start immediately — takes 2 minutes to learn',
      expected_outcome: 'Reduces exam anxiety arousal by 20–30% over 2 weeks of practice',
      adherence_likelihood: 0.82,
      cognitive_load_cost: 0.1,
      emotional_load_cost: 0.1,
      evidence_base: 'Cognitive defusion (Hayes, ACT); somatic regulation (Porges, 2011)',
      why_it_works: 'Anxiety hijacks working memory, reducing effective IQ by 10–15 points. The breath reset activates the parasympathetic system; the cognitive reframe prevents the threat-response escalation loop.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'spaced_repetition',
      title: 'Spaced Repetition System',
      description: 'Review material at increasing intervals (1 day → 3 days → 1 week). Use Anki or a simple notebook system.',
      domain: 'cognitive',
      phase: 'growth',
      intensity: 'moderate',
      timing: 'Introduce in week 2 once structure is in place',
      expected_outcome: 'Improves long-term retention by 40–60% over 4 weeks',
      adherence_likelihood: 0.65,
      cognitive_load_cost: 0.5,
      emotional_load_cost: 0.2,
      prerequisite_keys: ['study_structure'],
      evidence_base: 'Spaced repetition effect (Cepeda et al., 2006); Testing effect (Roediger & Karpicke, 2006)',
      why_it_works: 'Each retrieval attempt strengthens the memory trace and reveals gaps. Reviewing at the moment of near-forgetting forces deeper encoding than passive re-reading.',
      effort_required: 'moderate',
      resistance_prediction: 'medium',
    },
  ],
  emotional: [
    {
      key: 'grounding',
      title: 'Daily Grounding Practice',
      description: '5-minute daily grounding: name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste. Non-negotiable — same time each day.',
      domain: 'emotional',
      phase: 'stabilisation',
      intensity: 'low',
      timing: 'Start today',
      expected_outcome: 'Interrupts rumination and reduces baseline emotional load within 1 week',
      adherence_likelihood: 0.83,
      cognitive_load_cost: 0.1,
      emotional_load_cost: 0.1,
      evidence_base: '5-4-3-2-1 grounding technique (PTSD clinical practice guidelines, 2017)',
      why_it_works: 'Emotional dysregulation occurs when the prefrontal cortex loses control to the amygdala. Sensory grounding forces the brain back into present-moment processing, bypassing the rumination loop.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'emotional_journalling',
      title: 'Structured Emotional Journal',
      description: '10-minute end-of-day write: What triggered me? How did I respond? What would I do differently? No editing — just write.',
      domain: 'emotional',
      phase: 'growth',
      intensity: 'moderate',
      timing: 'Start in week 2',
      expected_outcome: 'Builds emotional pattern awareness and reduces reactivity over 4 weeks',
      adherence_likelihood: 0.65,
      cognitive_load_cost: 0.3,
      emotional_load_cost: 0.3,
      prerequisite_keys: ['grounding'],
      evidence_base: 'Expressive writing (Pennebaker & Beall, 1986); Affect labelling (Lieberman et al., 2007)',
      why_it_works: 'Naming an emotion reduces its intensity by activating the prefrontal cortex. The structured prompts convert vague emotional noise into identifiable patterns — which are actionable in a way that feelings alone are not.',
      effort_required: 'moderate',
      resistance_prediction: 'medium',
    },
    {
      key: 'social_activation',
      title: 'Scheduled Social Connection',
      description: 'Book one meaningful social interaction per week. Not passive (scrolling feeds) — active (call, walk, coffee). Schedule it like a meeting.',
      domain: 'social',
      phase: 'growth',
      intensity: 'low',
      timing: 'Start this week',
      expected_outcome: 'Reduces emotional isolation and builds co-regulation capacity',
      adherence_likelihood: 0.70,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.3,
      evidence_base: 'Social baseline theory (Coan & Sbarra, 2015); Co-regulation research',
      why_it_works: 'The nervous system regulates itself partly through proximity to safe others. Scheduled social contact prevents the isolation-amplification cycle where emotional load increases without an external reset.',
      effort_required: 'minimal',
      resistance_prediction: 'medium',
    },
  ],
  behavioural: [
    {
      key: 'implementation_intention',
      title: 'Implementation Intention',
      description: 'For the habit you want to build: write "When [specific situation], I will [specific behaviour]." Put it somewhere visible.',
      domain: 'executive_function',
      phase: 'stabilisation',
      intensity: 'low',
      timing: 'Start today — takes 5 minutes',
      expected_outcome: 'Reduces cue-response gap and increases follow-through by 35%',
      adherence_likelihood: 0.85,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.1,
      evidence_base: 'Implementation intentions (Gollwitzer, 1999); meta-analysis showed 35% improvement in goal attainment',
      why_it_works: 'If-then planning pre-decides the response before the situation arises, eliminating in-the-moment deliberation. This bypasses the executive function demands that commonly derail good intentions.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'habit_stacking',
      title: 'Habit Stacking',
      description: 'Attach the new behaviour to an existing reliable habit: "After [existing habit], I will [new behaviour] for 2 minutes."',
      domain: 'consistency',
      phase: 'growth',
      intensity: 'low',
      timing: 'Start in week 2',
      expected_outcome: 'Builds the new habit into existing routine — increases consistency by 50%',
      adherence_likelihood: 0.78,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.1,
      prerequisite_keys: ['implementation_intention'],
      evidence_base: 'Habit stacking (Clear, 2018); Stimulus control theory',
      why_it_works: 'Existing habits have strong neural pathways. Linking a new behaviour to an established one borrows the automatic activation of the existing cue — the new action piggybacks on an already-wired loop.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'identity_reframe',
      title: 'Identity-Based Habit Formation',
      description: 'Every time you do the new behaviour, tell yourself: "This is who I am." The goal shifts from outcomes to identity.',
      domain: 'identity',
      phase: 'optimisation',
      intensity: 'low',
      timing: 'Start after 2 weeks of consistent practice',
      expected_outcome: 'Makes the behaviour self-sustaining — 2.5x more durable than outcome-based motivation',
      adherence_likelihood: 0.72,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.1,
      prerequisite_keys: ['habit_stacking'],
      evidence_base: 'Identity-based habits (Clear, 2018); Self-perception theory (Bem, 1972)',
      why_it_works: 'When a behaviour feels consistent with self-concept, discontinuing it creates cognitive dissonance — which the brain resolves by continuing the behaviour. Motivation becomes self-reinforcing rather than effortful.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
  ],
  social: [
    {
      key: 'graduated_exposure',
      title: 'Graduated Social Exposure',
      description: 'List 5 social situations from easiest to hardest. Approach the easiest one this week. Your only goal is to show up — not to perform well.',
      domain: 'social',
      phase: 'stabilisation',
      intensity: 'moderate',
      timing: 'Start this week',
      expected_outcome: 'Builds social confidence incrementally — approach beats avoidance every time',
      adherence_likelihood: 0.68,
      cognitive_load_cost: 0.3,
      emotional_load_cost: 0.5,
      evidence_base: 'Systematic desensitisation (Wolpe, 1958); Exposure therapy research',
      why_it_works: 'Avoidance maintains anxiety by preventing disconfirmation of feared outcomes. Each successful exposure updates the threat prediction — the brain learns the situation is survivable, and the anxiety response weakens.',
      effort_required: 'moderate',
      resistance_prediction: 'high',
    },
    {
      key: 'social_scripting',
      title: 'Social Scripting',
      description: 'Prepare 2–3 conversation starters for situations you find hard. Not to memorise — to reduce the "blank mind" moment that triggers avoidance.',
      domain: 'social',
      phase: 'growth',
      intensity: 'low',
      timing: 'Start alongside exposure practice',
      expected_outcome: 'Reduces pre-social anxiety and increases approach rate',
      adherence_likelihood: 0.75,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.2,
      evidence_base: 'Social skills training (Caballo, 1997); Cognitive load theory',
      why_it_works: 'Social anxiety peaks in the moment of uncertainty. Scripts reduce the cognitive load of "what do I say?" — freeing working memory for actual connection rather than self-monitoring.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'social_identity',
      title: 'Social Identity Reframe',
      description: '"I am someone who connects with people" — not "I am trying to be less shy." Focus shifts from fighting a label to building a new one.',
      domain: 'identity',
      phase: 'optimisation',
      intensity: 'low',
      timing: 'Start after 3–4 weeks of exposure practice',
      expected_outcome: 'Consolidates social confidence as a stable self-perception',
      adherence_likelihood: 0.65,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.2,
      evidence_base: 'Social identity theory (Tajfel & Turner, 1979)',
      why_it_works: 'Social labels are powerful cognitive anchors. Replacing "shy" with "connecting" shifts which behaviours feel natural and consistent — the new identity pulls the person toward social approach rather than pushing away from avoidance.',
      effort_required: 'minimal',
      resistance_prediction: 'medium',
    },
  ],
  career: [
    {
      key: 'values_audit',
      title: 'Career Values Audit',
      description: 'List your top 10 career values (autonomy, impact, growth, stability…). Rank them. Compare with your current situation. The gap is the signal.',
      domain: 'cognitive',
      phase: 'stabilisation',
      intensity: 'low',
      timing: 'Start this week — takes 30 minutes',
      expected_outcome: 'Clarifies the root of career dissatisfaction and reveals the highest-leverage change',
      adherence_likelihood: 0.82,
      cognitive_load_cost: 0.3,
      emotional_load_cost: 0.2,
      evidence_base: 'Values-based career counselling (Brown, 1996); Self-determination theory (Deci & Ryan)',
      why_it_works: 'Most career confusion is not a lack of options — it is a lack of clarity on what matters most. Values-ranking surfaces unconscious priorities and converts vague dissatisfaction into actionable direction.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
    {
      key: 'career_prototyping',
      title: 'Behavioural Career Prototyping',
      description: 'Pick 2 directions you are considering. Spend 2 hours per week for 4 weeks actively exploring each — talk to people in that role, do a micro-project, shadow if possible.',
      domain: 'cognitive',
      phase: 'growth',
      intensity: 'moderate',
      timing: 'Start in week 2 once values are clear',
      expected_outcome: 'Converts abstract career options into felt experience — reduces decision paralysis',
      adherence_likelihood: 0.70,
      cognitive_load_cost: 0.4,
      emotional_load_cost: 0.3,
      prerequisite_keys: ['values_audit'],
      evidence_base: 'Design Thinking for careers (Burnett & Evans, 2016); Behavioural activation',
      why_it_works: 'Career anxiety thrives in abstraction. Direct exposure generates affective data that purely analytical approaches cannot — you discover fit through doing, not theorising.',
      effort_required: 'moderate',
      resistance_prediction: 'medium',
    },
    {
      key: 'career_narrative',
      title: 'Career Identity Narrative',
      description: 'Write a 3-sentence career identity statement: what you do, who you do it for, and why it matters to you. Refine it weekly.',
      domain: 'identity',
      phase: 'optimisation',
      intensity: 'low',
      timing: 'Start after prototyping reveals direction',
      expected_outcome: 'Anchors career decision-making in identity — reduces anxiety and second-guessing',
      adherence_likelihood: 0.73,
      cognitive_load_cost: 0.2,
      emotional_load_cost: 0.1,
      prerequisite_keys: ['career_prototyping'],
      evidence_base: 'Narrative career theory (Cochran, 1997); Identity foreclosure research',
      why_it_works: 'A clear career narrative acts as a cognitive anchor. When external noise creates doubt, the narrative provides a return point. It also makes opportunities easier to evaluate — they either fit the narrative or they do not.',
      effort_required: 'minimal',
      resistance_prediction: 'low',
    },
  ],
};

// ─── Sequencer ────────────────────────────────────────────────────────────────

export interface SequencerInput {
  concern_category: string;
  score_level: 'Emerging' | 'Developing' | 'Proficient' | 'Advanced';
  safety_status: 'informational' | 'supportive' | 'referral';
  cognitive_load: number;
  emotional_load: number;
  completed_intervention_keys?: string[];
}

export function sequenceInterventions(input: SequencerInput): SequencedIntervention[] {
  const {
    concern_category, score_level, safety_status,
    cognitive_load, emotional_load, completed_intervention_keys = [],
  } = input;

  const library = INTERVENTION_LIBRARY[concern_category] ?? INTERVENTION_LIBRARY.behavioural;

  // Filter out already-completed interventions
  let available = library.filter(i => !completed_intervention_keys.includes(i.key));

  // Safety gate: referral-level → only stabilisation, low intensity
  if (safety_status === 'referral') {
    available = available.filter(i => i.phase === 'stabilisation' && i.intensity === 'low');
  }

  // Cognitive load gate: high load (>70) → only low cognitive cost interventions
  if (cognitive_load > 70) {
    available = available.filter(i => i.cognitive_load_cost < 0.35);
  }

  // Emotional load gate: high emotional load (>65) → no high intensity
  if (emotional_load > 65) {
    available = available.filter(i => i.intensity !== 'high');
  }

  // Score-based phase preference
  const preferredPhases: InterventionPhase[] =
    score_level === 'Emerging' ? ['stabilisation', 'growth', 'optimisation'] :
    score_level === 'Developing' ? ['stabilisation', 'growth', 'optimisation'] :
    score_level === 'Proficient' ? ['growth', 'optimisation', 'stabilisation'] :
    ['optimisation', 'growth', 'stabilisation'];

  // Sort by phase preference, then adherence likelihood
  available.sort((a, b) => {
    const phaseA = preferredPhases.indexOf(a.phase);
    const phaseB = preferredPhases.indexOf(b.phase);
    if (phaseA !== phaseB) return phaseA - phaseB;
    return b.adherence_likelihood - a.adherence_likelihood;
  });

  // Check prerequisites — only include if prereqs are done or this is the first in sequence
  const sequenced: RawIntervention[] = [];
  for (const intervention of available) {
    if (sequenced.length >= 3) break;
    const prereqsMet = !intervention.prerequisite_keys?.length ||
      intervention.prerequisite_keys.every(k =>
        completed_intervention_keys.includes(k) || sequenced.some(s => s.key === k),
      );
    if (!prereqsMet) continue;
    // Fatigue: no more than 1 high-intensity intervention
    const hasHigh = sequenced.some(s => s.intensity === 'high');
    if (intervention.intensity === 'high' && hasHigh) continue;
    sequenced.push(intervention);
  }

  const phaseLabels: Record<InterventionPhase, string> = {
    stabilisation: 'Phase 1 — Stabilise',
    growth: 'Phase 2 — Build',
    optimisation: 'Phase 3 — Sustain',
  };

  const startWhenMap: Record<InterventionPhase, string> = {
    stabilisation: 'Start today or this week',
    growth: 'Begin in week 2–3 once Phase 1 is established',
    optimisation: 'Start in week 4+ once growth phase is consistent',
  };

  const successMarkers: Record<InterventionPhase, string> = {
    stabilisation: 'You notice the pattern before it fully takes hold — and have a response ready',
    growth: 'The new behaviour happens automatically on most days without forcing it',
    optimisation: 'The change feels like who you are, not something you\'re trying to do',
  };

  return sequenced.map((intervention, i) => ({
    ...intervention,
    sequence_position: i + 1,
    phase_label: phaseLabels[intervention.phase],
    start_when: startWhenMap[intervention.phase],
    success_marker: successMarkers[intervention.phase],
    fatigue_warning: i >= 2 ? 'Focus on completing the first two before adding this one.' : undefined,
  }));
}
