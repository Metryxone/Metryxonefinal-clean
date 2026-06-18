/**
 * Behavioural Hypothesis Engine — Phase 1 S3
 *
 * Rule-based system that generates weighted behavioural hypotheses from a
 * concern text + construct key. Each construct maps to 2–4 hypothesis templates.
 * Keyword boosters raise or lower confidence from the base weight.
 *
 * All 32 canonical constructs from the CAPADEX taxonomy are covered.
 */

import type { Pool } from 'pg';
import { CONSTRUCT_MAP, CONCERN_TO_CONSTRUCT, normalizeConcernKey } from '../data/behavioural-constructs';
import { computeConfidence, syncConfidenceScores, type ConfidenceInputs } from './confidence-engine';
import { isEnabled } from './feature-flags';
import { broadcastToSession } from './ws-broadcast';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LifecycleState = 'active' | 'weakened' | 'suspended' | 'archived' | 'reactivated';

export interface HypothesisTemplate {
  hypothesis_key:  string;        // unique within construct
  label:           string;
  base_confidence: number;        // 0–1
  base_uncertainty: number;       // 0–1
  evidence_type:   string;        // what kind of evidence supports this
  boost_keywords:  RegExp[];      // each match raises confidence +0.05 (capped at 0.95)
  dampen_keywords: RegExp[];      // each match lowers confidence -0.05 (floor 0.05)
}

export interface GeneratedHypothesis {
  id:                    string;
  construct_key:         string;
  label:                 string;
  confidence:            number;
  uncertainty:           number;
  evidence_sources:      string[];
  lifecycle_state:       LifecycleState;
  explainability_context: Record<string, unknown>;
  created_at:            string;
  updated_at:            string;
}

// ─── Hypothesis Rule Table (32 constructs × 2–4 templates) ───────────────────

const HYPOTHESIS_RULES: Record<string, HypothesisTemplate[]> = {

  // ── Cognitive cluster ──────────────────────────────────────────────────────

  ATTENTION_REGULATION: [
    {
      hypothesis_key:   'sustained_attention_deficit',
      label:            'Sustained Attention Deficit — difficulty holding focus over extended periods',
      base_confidence:  0.65,
      base_uncertainty: 0.30,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/cannot.{0,20}focus|can't.{0,20}focus|hard to focus|keep losing focus|daydream|wander/i, /short attention|always distracted|easily distracted/i],
      dampen_keywords:  [/sometimes|occasionally|mild|only when tired/i],
    },
    {
      hypothesis_key:   'selective_attention_dysregulation',
      label:            'Selective Attention Dysregulation — struggle to filter relevant from irrelevant stimuli',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/distract|noise|background|environment|phone|notification/i],
      dampen_keywords:  [/quiet room|no distraction/i],
    },
    {
      hypothesis_key:   'attentional_fatigue_pattern',
      label:            'Attentional Fatigue — focus collapses after an initial period of engagement',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'temporal_pattern',
      boost_keywords:   [/after.{0,20}min|tired quickly|stamina|endurance|burnout/i],
      dampen_keywords:  [],
    },
  ],

  WORKING_MEMORY: [
    {
      hypothesis_key:   'working_memory_overload',
      label:            'Working Memory Overload — information saturates the mental workspace',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/forget|can't remember|lose track|re-read|read again|forget what I just/i],
      dampen_keywords:  [/sometimes|now and then/i],
    },
    {
      hypothesis_key:   'chunking_failure',
      label:            'Chunking Failure — unable to organise information into meaningful units',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'academic_signal',
      boost_keywords:   [/comprehension|understand|concept|topic|make sense/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'retrieval_interference',
      label:            'Retrieval Interference — prior knowledge blocks access to new information',
      base_confidence:  0.40,
      base_uncertainty: 0.45,
      evidence_type:    'learning_signal',
      boost_keywords:   [/confus|mix up|get confused|wrong answer|interference/i],
      dampen_keywords:  [],
    },
  ],

  PROCESSING_SPEED: [
    {
      hypothesis_key:   'cognitive_processing_lag',
      label:            'Cognitive Processing Lag — thought-to-output conversion is slower than norm',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'performance_signal',
      boost_keywords:   [/slow|takes long|can't finish|run out of time|time pressure/i],
      dampen_keywords:  [/quick|fast|efficient/i],
    },
    {
      hypothesis_key:   'anxiety_induced_slowdown',
      label:            'Anxiety-Induced Processing Slowdown — stress narrows cognitive bandwidth',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/nervous|anxious|panic|stress|pressure|exam/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'output_fluency_block',
      label:            'Output Fluency Block — knows the answer but cannot produce it at pace',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'performance_signal',
      boost_keywords:   [/know it but|can't write fast|slow to respond|takes me longer|freeze up/i],
      dampen_keywords:  [],
    },
  ],

  CRITICAL_THINKING: [
    {
      hypothesis_key:   'surface_processing_dominance',
      label:            'Surface Processing Dominance — prefers memorisation over analytical reasoning',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'academic_signal',
      boost_keywords:   [/memoris|rote|by heart|just memorize|can't analyse|don't understand why/i],
      dampen_keywords:  [/analys|reason|logic|think deeply/i],
    },
    {
      hypothesis_key:   'evaluation_avoidance',
      label:            'Evaluation Avoidance — avoids critically assessing own conclusions',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/don't question|accept|just believe|not sure how to evaluate/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'assumption_blindness',
      label:            'Assumption Blindness — accepts premises without testing their validity',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/take for granted|assume|never questioned|it's obvious|of course/i],
      dampen_keywords:  [],
    },
  ],

  CREATIVITY: [
    {
      hypothesis_key:   'creative_inhibition',
      label:            'Creative Inhibition — fear of judgement suppresses idea generation',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/fear judg|scared to try|won't share|what if I'm wrong/i],
      dampen_keywords:  [/enjoy|love creating|expressive/i],
    },
    {
      hypothesis_key:   'convergent_bias',
      label:            'Convergent Thinking Bias — defaults to single correct answers vs. exploration',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/one way|correct answer|right answer|no imagination|not creative/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'idea_scarcity_pattern',
      label:            'Idea Scarcity Pattern — struggles to generate options when facing a blank page',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/blank|no ideas|can't think of|nothing comes|stuck for ideas/i],
      dampen_keywords:  [],
    },
  ],

  // ── Self-Regulation cluster ─────────────────────────────────────────────────

  EXECUTIVE_FUNCTION: [
    {
      hypothesis_key:   'planning_initiation_deficit',
      label:            'Planning & Initiation Deficit — difficulty starting or sequencing tasks',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/don't know where to start|can't begin|procrastinat|overwhelm|paralysis/i],
      dampen_keywords:  [/organised|planner|structured/i],
    },
    {
      hypothesis_key:   'time_blindness',
      label:            'Time Blindness — difficulty perceiving and managing time accurately',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/time management|lose track of time|always late|deadlines|miss deadline/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'task_switching_friction',
      label:            'Task-Switching Friction — difficulty transitioning between activities',
      base_confidence:  0.50,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/can't switch|stuck on one thing|transition|change task/i],
      dampen_keywords:  [],
    },
  ],

  IMPULSE_CONTROL: [
    {
      hypothesis_key:   'reward_sensitivity_dysregulation',
      label:            'Reward Sensitivity Dysregulation — over-response to immediate rewards',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/can't resist|impulsive|grab phone|give in|can't wait|instant/i],
      dampen_keywords:  [/patient|wait|delay gratif/i],
    },
    {
      hypothesis_key:   'inhibitory_control_weakness',
      label:            'Inhibitory Control Weakness — actions precede deliberate thought',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/react before think|blurt|interrupt|say before I think/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'delay_discounting_bias',
      label:            'Delay Discounting Bias — heavily devalues future rewards versus immediate ones',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/right now|can't wait|later never comes|want it now|put off the reward/i],
      dampen_keywords:  [],
    },
  ],

  PROCRASTINATION: [
    {
      hypothesis_key:   'task_aversion_loop',
      label:            'Task Aversion Loop — negative emotion about task triggers avoidance',
      base_confidence:  0.70,
      base_uncertainty: 0.20,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/hate|avoid|dread|don't want to|boring|hate doing/i],
      dampen_keywords:  [/enjoy|like doing|motivated/i],
    },
    {
      hypothesis_key:   'perfectionism_paralysis',
      label:            'Perfectionism Paralysis — fear of imperfect output blocks starting',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/perfect|good enough|what if it's wrong|not ready|need to be ready/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'decision_fatigue_avoidance',
      label:            'Decision Fatigue Avoidance — overwhelm from task complexity causes delay',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/too much|overwhelm|don't know where to start|complex|too big/i],
      dampen_keywords:  [],
    },
  ],

  HABIT_FORMATION: [
    {
      hypothesis_key:   'routine_instability',
      label:            'Routine Instability — habits form but collapse under minimal disruption',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/can't stick|routine breaks|no routine|inconsistent|falls apart/i],
      dampen_keywords:  [/consistent|habit|routine|structured/i],
    },
    {
      hypothesis_key:   'cue_response_mismatch',
      label:            'Cue-Response Mismatch — existing cues trigger wrong behavioural responses',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'environmental_signal',
      boost_keywords:   [/trigger|automatically|without thinking|habit loop/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'keystone_habit_absence',
      label:            'Keystone Habit Absence — no anchor routine exists to scaffold other habits',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/no structure|no schedule|nothing fixed|random day|no anchor/i],
      dampen_keywords:  [],
    },
  ],

  // ── Emotional cluster ───────────────────────────────────────────────────────

  ANXIETY: [
    {
      hypothesis_key:   'anticipatory_anxiety',
      label:            'Anticipatory Anxiety — excessive worry about future events before they occur',
      base_confidence:  0.70,
      base_uncertainty: 0.20,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/worry about|fear|scared of|nervous about|what if|dread|panic/i],
      dampen_keywords:  [/sometimes|occasional|mild/i],
    },
    {
      hypothesis_key:   'performance_anxiety',
      label:            'Performance Anxiety — fear of evaluation triggers cognitive and physical symptoms',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'contextual_signal',
      boost_keywords:   [/exam|test|perform|present|speak|judge|evaluated|results/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'generalised_worry_pattern',
      label:            'Generalised Worry Pattern — free-floating anxiety across multiple domains',
      base_confidence:  0.55,
      base_uncertainty: 0.30,
      evidence_type:    'temporal_pattern',
      boost_keywords:   [/always worry|constant|non-stop|everything|all the time/i],
      dampen_keywords:  [],
    },
  ],

  EMOTIONAL_REGULATION: [
    {
      hypothesis_key:   'emotion_suppression_tendency',
      label:            'Emotion Suppression Tendency — feelings are held inward rather than processed',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/hold in|don't show|bottle up|keep to myself|can't express/i],
      dampen_keywords:  [/talk about|express|open up/i],
    },
    {
      hypothesis_key:   'emotional_reactivity_spike',
      label:            'Emotional Reactivity Spike — small triggers cause disproportionate emotional responses',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/overreact|explode|mood swing|out of control|anger|rage|cry easily/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'emotional_numbing_pattern',
      label:            'Emotional Numbing — disconnected from or unable to access feelings',
      base_confidence:  0.45,
      base_uncertainty: 0.45,
      evidence_type:    'clinical_signal',
      boost_keywords:   [/feel nothing|numb|don't care|empty|flat|no emotion/i],
      dampen_keywords:  [],
    },
  ],

  SELF_ESTEEM: [
    {
      hypothesis_key:   'core_self_worth_deficit',
      label:            'Core Self-Worth Deficit — fundamental belief that one is inadequate or undeserving',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/not good enough|inferior|worthless|useless|can't do anything right/i],
      dampen_keywords:  [/confident|believe in myself/i],
    },
    {
      hypothesis_key:   'social_comparison_distortion',
      label:            'Social Comparison Distortion — self-assessment mediated by unfavourable peer comparison',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'social_signal',
      boost_keywords:   [/compare|everyone else|better than me|behind|ahead|inferior to/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'conditional_self_worth',
      label:            'Conditional Self-Worth — value tied solely to performance or external approval',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/only if|marks|result|approval|people think|praise|validation/i],
      dampen_keywords:  [],
    },
  ],

  RESILIENCE: [
    {
      hypothesis_key:   'recovery_capacity_impairment',
      label:            'Recovery Capacity Impairment — difficulty bouncing back after setbacks',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/can't recover|give up|takes long to recover|devastated|crushed/i],
      dampen_keywords:  [/bounce back|resilient|strong/i],
    },
    {
      hypothesis_key:   'learned_helplessness_signal',
      label:            'Learned Helplessness Signal — perceived lack of control reduces effort',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/nothing works|no point|doesn't matter|always fails|never works for me/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'rumination_after_setback',
      label:            'Rumination After Setback — replays failures instead of re-engaging',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/keep thinking about|replay|dwell|can't let go|overthink the failure/i],
      dampen_keywords:  [],
    },
  ],

  // ── Mental Wellbeing cluster ─────────────────────────────────────────────────

  STRESS_MANAGEMENT: [
    {
      hypothesis_key:   'chronic_stress_accumulation',
      label:            'Chronic Stress Accumulation — ongoing stressors without adequate recovery',
      base_confidence:  0.70,
      base_uncertainty: 0.20,
      evidence_type:    'physiological_signal',
      boost_keywords:   [/always stressed|constant pressure|non-stop|no break|exhausted|burnout/i],
      dampen_keywords:  [/manage stress|handle pressure|cope/i],
    },
    {
      hypothesis_key:   'coping_mechanism_overload',
      label:            'Coping Mechanism Overload — current coping strategies are insufficient',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/tried everything|nothing helps|keep trying|still stressed/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'pressure_externalisation',
      label:            'Pressure Externalisation — stress attributed primarily to external demands',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/family pressure|parents|school|teacher|society|expectations/i],
      dampen_keywords:  [],
    },
  ],

  MENTAL_HEALTH: [
    {
      hypothesis_key:   'subclinical_mood_disruption',
      label:            'Subclinical Mood Disruption — persistent low mood affecting daily functioning',
      base_confidence:  0.60,
      base_uncertainty: 0.35,
      evidence_type:    'clinical_signal',
      boost_keywords:   [/sad|low mood|depress|hopeless|empty|no joy|lost interest/i],
      dampen_keywords:  [/mostly okay|fine|manage/i],
    },
    {
      hypothesis_key:   'social_withdrawal_pattern',
      label:            'Social Withdrawal Pattern — progressive isolation from social engagement',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/withdrawal|isolat|alone|avoid people|keep to myself|don't want to see/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'anhedonia_signal',
      label:            'Anhedonia Signal — loss of pleasure in activities once enjoyed',
      base_confidence:  0.45,
      base_uncertainty: 0.45,
      evidence_type:    'clinical_signal',
      boost_keywords:   [/no pleasure|nothing feels fun|used to love|stopped enjoying|can't enjoy/i],
      dampen_keywords:  [],
    },
  ],

  PHYSICAL_WELLBEING: [
    {
      hypothesis_key:   'sleep_regulation_disruption',
      label:            'Sleep Regulation Disruption — poor sleep quality or quantity impairs recovery',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'physiological_signal',
      boost_keywords:   [/sleep|tired|fatigue|late night|insomnia|can't sleep|wake up tired/i],
      dampen_keywords:  [/sleep well|good sleep|rested/i],
    },
    {
      hypothesis_key:   'energy_regulation_imbalance',
      label:            'Energy Regulation Imbalance — inconsistent energy across the day',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'physiological_signal',
      boost_keywords:   [/energy|tired|crash|afternoon|run out|drain|exhausted/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'physical_inactivity_loop',
      label:            'Physical Inactivity Loop — sedentary patterns reducing cognitive and emotional capacity',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'lifestyle_signal',
      boost_keywords:   [/no exercise|don't move|sedentary|couch|no activity|inactive/i],
      dampen_keywords:  [/exercise|active|sport|gym/i],
    },
  ],

  // ── Motivation cluster ──────────────────────────────────────────────────────

  INTRINSIC_MOTIVATION: [
    {
      hypothesis_key:   'motivational_depletion',
      label:            'Motivational Depletion — internal drive has collapsed under repeated setbacks',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/no motivation|lost motivation|don't care|no interest|can't be bothered/i],
      dampen_keywords:  [/motivated|excited|driven/i],
    },
    {
      hypothesis_key:   'extrinsic_dependency',
      label:            'Extrinsic Motivation Dependency — reliance on external rewards or pressure',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/need push|need someone|reward|punishment|marks|need validation/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'value_disconnection',
      label:            'Value Disconnection — tasks feel meaningless or disconnected from personal values',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'existential_signal',
      boost_keywords:   [/pointless|meaningless|why bother|no purpose|doesn't matter to me/i],
      dampen_keywords:  [],
    },
  ],

  GOAL_ORIENTATION: [
    {
      hypothesis_key:   'goal_ambiguity_pattern',
      label:            'Goal Ambiguity — absence of clear meaningful goals creates directional vacuum',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/no goal|don't know what I want|no aim|no direction|unclear|don't know/i],
      dampen_keywords:  [/clear goal|know what I want|focused/i],
    },
    {
      hypothesis_key:   'goal_fragmentation',
      label:            'Goal Fragmentation — multiple conflicting goals reduce commitment to any single path',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/too many|conflicting|can't choose|multiple interests|pulled in different/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'goal_abandonment_pattern',
      label:            'Goal Abandonment Pattern — goals are set but dropped before completion',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/give up|quit halfway|never finish|lose interest|abandon/i],
      dampen_keywords:  [],
    },
  ],

  LEARNING_DRIVE: [
    {
      hypothesis_key:   'curiosity_depletion',
      label:            'Curiosity Depletion — intrinsic desire to learn has been extinguished by pressure',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/boring|not interested|hate studying|no curiosity|not curious/i],
      dampen_keywords:  [/curious|love learning|interested in/i],
    },
    {
      hypothesis_key:   'system_misalignment',
      label:            'System Misalignment — learning style incompatible with educational delivery',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'contextual_signal',
      boost_keywords:   [/doesn't work for me|traditional|class doesn't help|school system/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'extrinsic_pressure_fatigue',
      label:            'Extrinsic Pressure Fatigue — externally-imposed study has eroded internal drive',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/forced to study|only for marks|pressure to learn|burned out|tired of studying/i],
      dampen_keywords:  [],
    },
  ],

  // ── Social cluster ──────────────────────────────────────────────────────────

  COMMUNICATION: [
    {
      hypothesis_key:   'expressive_language_barrier',
      label:            'Expressive Language Barrier — difficulty translating thoughts into words',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'social_signal',
      boost_keywords:   [/can't express|words fail|don't know what to say|hard to articulate/i],
      dampen_keywords:  [/articulate|express well|communicate clearly/i],
    },
    {
      hypothesis_key:   'public_expression_anxiety',
      label:            'Public Expression Anxiety — fear of speaking up in group or audience contexts',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/public speaking|afraid to speak|class|meeting|presentation|crowd/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'active_listening_deficit',
      label:            'Active Listening Deficit — difficulty sustaining attention in conversation',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'social_signal',
      boost_keywords:   [/don't listen|listening|hear|pay attention|miss what they say/i],
      dampen_keywords:  [],
    },
  ],

  SOCIAL_CONFIDENCE: [
    {
      hypothesis_key:   'social_self_consciousness',
      label:            'Social Self-Consciousness — hyperawareness of self in social situations',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/self-conscious|awkward|aware of myself|being judged|people watching/i],
      dampen_keywords:  [/confident|comfortable|ease/i],
    },
    {
      hypothesis_key:   'social_avoidance_pattern',
      label:            'Social Avoidance Pattern — situations are avoided rather than faced',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/avoid|say no|cancel|don't go|skip|stay home|don't attend/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'rejection_sensitivity',
      label:            'Rejection Sensitivity — anticipates social rejection and pre-emptively withdraws',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'emotional_signal',
      boost_keywords:   [/they won't like|reject|laugh at me|judge me|not wanted/i],
      dampen_keywords:  [],
    },
  ],

  PEER_RELATIONS: [
    {
      hypothesis_key:   'peer_connection_deficit',
      label:            'Peer Connection Deficit — genuine friendships are absent or shallow',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'social_signal',
      boost_keywords:   [/no friends|few friends|lonely|isolat|can't make friends|don't belong/i],
      dampen_keywords:  [/good friends|close friends|social/i],
    },
    {
      hypothesis_key:   'peer_influence_susceptibility',
      label:            'Peer Influence Susceptibility — decisions heavily shaped by peer behaviour',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'social_signal',
      boost_keywords:   [/peer pressure|everyone does|they told me|follow|go along|can't say no/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'social_exclusion_experience',
      label:            'Social Exclusion Experience — recurrent experience of being left out by peers',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'social_signal',
      boost_keywords:   [/left out|excluded|not invited|ignored|outsider/i],
      dampen_keywords:  [],
    },
  ],

  SAFETY_THREATS: [
    {
      hypothesis_key:   'online_safety_exposure',
      label:            'Online Safety Threat Exposure — exposure to harmful digital content or actors',
      base_confidence:  0.65,
      base_uncertainty: 0.30,
      evidence_type:    'safety_signal',
      boost_keywords:   [/online|cyberbully|internet|social media|stranger|inappropriate|content/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'offline_peer_threat',
      label:            'Offline Peer Threat — physical or social bullying from peers',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'safety_signal',
      boost_keywords:   [/bully|physical|hit|threatened|harassed|intimidat/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'home_safety_concern',
      label:            'Home Safety Concern — threats to safety originate within the home environment',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'safety_signal',
      boost_keywords:   [/unsafe at home|violence at home|fights at home|scared at home|shouting at home/i],
      dampen_keywords:  [],
    },
  ],

  // ── Digital cluster ─────────────────────────────────────────────────────────

  DIGITAL_DEPENDENCY: [
    {
      hypothesis_key:   'compulsive_device_engagement',
      label:            'Compulsive Device Engagement — device use is habitual and beyond conscious control',
      base_confidence:  0.75,
      base_uncertainty: 0.15,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/addicted|can't stop|always on phone|automatic|just happen|without thinking/i],
      dampen_keywords:  [/control|limit|reduce/i],
    },
    {
      hypothesis_key:   'dopamine_reward_loop',
      label:            'Dopamine Reward Loop — digital platforms exploit neurological reward pathways',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'neurological_signal',
      boost_keywords:   [/notification|like|scroll|feed|reel|dopamine|stimulation|boredom/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'digital_displacement',
      label:            'Digital Displacement — screen time displaces essential life activities',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'lifestyle_signal',
      boost_keywords:   [/sleep|study|exercise|homework|missed|because of phone|instead of/i],
      dampen_keywords:  [],
    },
  ],

  DIGITAL_DISCIPLINE: [
    {
      hypothesis_key:   'digital_boundary_failure',
      label:            'Digital Boundary Failure — self-imposed rules collapse within hours or days',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/can't limit|tried to cut|rules don't work|keep going back|failed to stop/i],
      dampen_keywords:  [/limit|control|discipline|reduce/i],
    },
    {
      hypothesis_key:   'late_night_digital_pattern',
      label:            'Late-Night Digital Pattern — device use at night disrupts sleep and recovery',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'physiological_signal',
      boost_keywords:   [/late night|midnight|before sleep|in bed|night|sleep late/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'notification_reactivity',
      label:            'Notification Reactivity — every alert interrupts focus and pulls attention to the device',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'behavioural_pattern',
      boost_keywords:   [/notification|buzz|check phone|every alert|ping/i],
      dampen_keywords:  [],
    },
  ],

  // ── Academic cluster ────────────────────────────────────────────────────────

  EXAM_PERFORMANCE: [
    {
      hypothesis_key:   'chronic_underperformance',
      label:            'Chronic Underperformance — persistent gap between effort and exam outcomes',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'academic_signal',
      boost_keywords:   [/low marks|failing|poor results|below expectation|bad grades|dropped/i],
      dampen_keywords:  [/improving|doing better/i],
    },
    {
      hypothesis_key:   'effort_outcome_disconnect',
      label:            'Effort-Outcome Disconnect — hard work is not translating into expected results',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'academic_signal',
      boost_keywords:   [/study hard but|put in effort but|despite|even though I study/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'careless_error_pattern',
      label:            'Careless Error Pattern — marks are lost to avoidable mistakes rather than knowledge gaps',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'academic_signal',
      boost_keywords:   [/silly mistake|careless|misread|forgot to|lost marks for/i],
      dampen_keywords:  [],
    },
  ],

  EXAM_READINESS: [
    {
      hypothesis_key:   'strategic_preparation_gap',
      label:            'Strategic Preparation Gap — studying occurs without an effective exam strategy',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'academic_signal',
      boost_keywords:   [/no strategy|don't know how to study|revision|plan|technique|approach/i],
      dampen_keywords:  [/strategy|technique|plan|approach/i],
    },
    {
      hypothesis_key:   'exam_condition_anxiety',
      label:            'Exam Condition Anxiety — performance degrades specifically under test conditions',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'contextual_signal',
      boost_keywords:   [/freeze|blank|panic|forget during exam|know it but can't write|exam hall/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'time_mismanagement_in_exams',
      label:            'Time Mismanagement in Exams — unable to complete paper within allocated time',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'performance_signal',
      boost_keywords:   [/can't finish|run out of time|slow writing|time|left questions|incomplete/i],
      dampen_keywords:  [],
    },
  ],

  LEARNING_APPROACH: [
    {
      hypothesis_key:   'rote_learning_dependency',
      label:            'Rote Learning Dependency — memorisation substitutes for conceptual understanding',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'academic_signal',
      boost_keywords:   [/memorise|by heart|rote|don't understand|just mug|mug up/i],
      dampen_keywords:  [/understand|conceptual|deep learning/i],
    },
    {
      hypothesis_key:   'surface_engagement_pattern',
      label:            'Surface Engagement Pattern — tasks are completed without deep processing',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'academic_signal',
      boost_keywords:   [/just to finish|get it done|complete|tick off|don't really learn/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'passive_consumption_habit',
      label:            'Passive Consumption Habit — learning is watching/reading without active retrieval',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'academic_signal',
      boost_keywords:   [/just read|just watch|re-read|highlight|don't practice/i],
      dampen_keywords:  [],
    },
  ],

  ACADEMIC_RECOVERY: [
    {
      hypothesis_key:   'failure_identity_lock',
      label:            'Failure Identity Lock — past academic failure has become part of self-concept',
      base_confidence:  0.60,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/failed before|always fail|I'm a failure|not meant for studies|gave up/i],
      dampen_keywords:  [/trying again|recovery|comeback/i],
    },
    {
      hypothesis_key:   're_preparation_strategy_absence',
      label:            'Re-preparation Strategy Absence — no clear plan exists for academic recovery',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'academic_signal',
      boost_keywords:   [/don't know how|no plan|what to do|where to start|lost/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'support_seeking_avoidance',
      label:            'Support-Seeking Avoidance — reluctance to ask for help blocks recovery',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'social_signal',
      boost_keywords:   [/won't ask|too embarrassed|don't want help|on my own|ashamed to ask/i],
      dampen_keywords:  [],
    },
  ],

  // ── Career cluster ──────────────────────────────────────────────────────────

  CAREER_CLARITY: [
    {
      hypothesis_key:   'direction_ambiguity',
      label:            'Direction Ambiguity — no clear sense of professional identity or path',
      base_confidence:  0.70,
      base_uncertainty: 0.20,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/don't know|no direction|confused|lost|what to do|no clarity|undecided/i],
      dampen_keywords:  [/clear|decided|know what I want/i],
    },
    {
      hypothesis_key:   'identity_role_mismatch',
      label:            'Identity-Role Mismatch — current path does not align with authentic self',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'existential_signal',
      boost_keywords:   [/doesn't feel right|wrong path|not me|not my passion|forced|pressure/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'decision_paralysis',
      label:            'Decision Paralysis — fear of making the wrong choice prevents commitment',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/can't decide|afraid to choose|what if wrong|regret|miss out/i],
      dampen_keywords:  [],
    },
  ],

  SKILL_AWARENESS: [
    {
      hypothesis_key:   'skill_inventory_blindspot',
      label:            'Skill Inventory Blindspot — poor self-knowledge of actual strengths and gaps',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/don't know my strengths|don't know what I'm good at|no skills|can't identify/i],
      dampen_keywords:  [/know my strengths|self-aware/i],
    },
    {
      hypothesis_key:   'market_signal_disconnect',
      label:            'Market Signal Disconnect — academic learning does not connect to real-world skills',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'contextual_signal',
      boost_keywords:   [/marks vs skill|real world|practical|employability|job ready|theory/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'strength_underestimation',
      label:            'Strength Underestimation — discounts genuine abilities and overweights gaps',
      base_confidence:  0.45,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/not good at anything|nothing special|others are better|downplay|never enough/i],
      dampen_keywords:  [],
    },
  ],

  CAREER_GROWTH: [
    {
      hypothesis_key:   'stagnation_perception',
      label:            'Career Stagnation Perception — sense of being stuck with no forward movement',
      base_confidence:  0.60,
      base_uncertainty: 0.30,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/stuck|stagnant|no growth|going nowhere|plateau|stalled/i],
      dampen_keywords:  [/growing|progressing|moving up/i],
    },
    {
      hypothesis_key:   'advancement_barrier',
      label:            'Advancement Barrier — perceived external blocks to promotion or progression',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'contextual_signal',
      boost_keywords:   [/no promotion|passed over|no opportunity|blocked|glass ceiling|overlooked/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'growth_direction_uncertainty',
      label:            'Growth Direction Uncertainty — unclear what the next step in the career should be',
      base_confidence:  0.50,
      base_uncertainty: 0.40,
      evidence_type:    'cognitive_signal',
      boost_keywords:   [/what next|don't know how to grow|no next step|unclear path|which direction/i],
      dampen_keywords:  [],
    },
  ],

  // ── Family & Environment cluster ─────────────────────────────────────────────

  FAMILY_DYNAMICS: [
    {
      hypothesis_key:   'parental_expectation_pressure',
      label:            'Parental Expectation Pressure — family demands create chronic stress and anxiety',
      base_confidence:  0.65,
      base_uncertainty: 0.25,
      evidence_type:    'environmental_signal',
      boost_keywords:   [/parent|family|expectation|pressure from home|mother|father|sibling|comparison at home/i],
      dampen_keywords:  [/supportive|understanding|encouraging/i],
    },
    {
      hypothesis_key:   'communication_breakdown_at_home',
      label:            'Communication Breakdown at Home — poor dialogue between child and caregivers',
      base_confidence:  0.55,
      base_uncertainty: 0.35,
      evidence_type:    'social_signal',
      boost_keywords:   [/don't talk|can't talk to parent|they don't listen|no communication|argue/i],
      dampen_keywords:  [],
    },
    {
      hypothesis_key:   'overprotective_dynamic',
      label:            'Overprotective Dynamic — excessive shielding prevents autonomy development',
      base_confidence:  0.45,
      base_uncertainty: 0.45,
      evidence_type:    'environmental_signal',
      boost_keywords:   [/overprotect|helicopter|do everything for me|no independence|not allowed/i],
      dampen_keywords:  [],
    },
  ],
};

// ─── Keyword Boost Calculator ─────────────────────────────────────────────────

function applyKeywordAdjustments(
  base: number,
  text: string,
  boosts:  RegExp[],
  dampens: RegExp[],
  step = 0.05
): number {
  let conf = base;
  for (const re of boosts)   if (re.test(text)) conf = Math.min(0.95, conf + step);
  for (const re of dampens)  if (re.test(text)) conf = Math.max(0.05, conf - step);
  return Math.round(conf * 1000) / 1000;
}

// ─── Core Generation Logic ────────────────────────────────────────────────────

export interface GenerateOptions {
  sessionId:     string;
  concernText:   string;
  constructKey?: string;    // override auto-detection
  initialResponses?: Array<{ item_id: string; response_value: number }>;
}

export interface RawHypothesis {
  construct_key:         string;
  label:                 string;
  confidence:            number;
  uncertainty:           number;
  evidence_sources:      string[];
  lifecycle_state:       LifecycleState;
  explainability_context: Record<string, unknown>;
}

/**
 * Derive a confidence delta from initial_responses.
 * Average response_value across all items (0–100 scale expected):
 *  - avg < 33  → concern is significant → boost confidence +0.05
 *  - avg > 66  → concern is mild       → dampen confidence -0.05
 *  - otherwise → neutral, no adjustment
 * Also reduces uncertainty when more responses are provided (capped at -0.10).
 */
function responseAdjustment(
  initialResponses: Array<{ item_id: string; response_value: number }> | undefined,
  baseUncertainty: number
): { confidenceDelta: number; uncertainty: number } {
  if (!initialResponses || initialResponses.length === 0) {
    return { confidenceDelta: 0, uncertainty: baseUncertainty };
  }
  const sum  = initialResponses.reduce((acc, r) => acc + Number(r.response_value), 0);
  const avg  = sum / initialResponses.length;
  const confidenceDelta = avg < 33 ? +0.05 : avg > 66 ? -0.05 : 0;

  // More data → lower uncertainty (each response reduces uncertainty by 0.02, max -0.10)
  const uncertaintyReduction = Math.min(0.10, initialResponses.length * 0.02);
  const uncertainty = Math.max(0.05, baseUncertainty - uncertaintyReduction);

  return { confidenceDelta, uncertainty };
}

/**
 * Generate hypothesis objects from concern text and optional construct key.
 * Does not write to DB — caller is responsible for persistence.
 */
export function buildHypotheses(opts: GenerateOptions): RawHypothesis[] {
  const { sessionId, concernText, constructKey: suppliedKey, initialResponses } = opts;

  // 1. Resolve construct key
  let constructKey = suppliedKey;
  if (!constructKey) {
    const mapped = CONCERN_TO_CONSTRUCT[normalizeConcernKey(concernText)];
    if (mapped) {
      constructKey = mapped;
    } else {
      // Fallback: substring scan
      const lower = normalizeConcernKey(concernText);
      for (const [concern, ck] of Object.entries(CONCERN_TO_CONSTRUCT)) {
        if (lower.includes(concern) || concern.includes(lower)) {
          constructKey = ck;
          break;
        }
      }
    }
  }

  // If still no construct, derive from keyword categories
  if (!constructKey) {
    if (/screen|gaming|phone|social media|digital/i.test(concernText)) constructKey = 'DIGITAL_DEPENDENCY';
    else if (/exam|marks|study|academic/i.test(concernText)) constructKey = 'EXAM_READINESS';
    else if (/anxi|stress|worry|fear/i.test(concernText)) constructKey = 'ANXIETY';
    else if (/focus|attention|distract/i.test(concernText)) constructKey = 'ATTENTION_REGULATION';
    else if (/motivation|interest|lazy/i.test(concernText)) constructKey = 'INTRINSIC_MOTIVATION';
    else if (/social|friend|shy|speak/i.test(concernText)) constructKey = 'SOCIAL_CONFIDENCE';
    else if (/career|job|direction|future/i.test(concernText)) constructKey = 'CAREER_CLARITY';
    else constructKey = 'ATTENTION_REGULATION'; // ultimate fallback
  }

  const templates = HYPOTHESIS_RULES[constructKey] || HYPOTHESIS_RULES['ATTENTION_REGULATION'];
  const construct = CONSTRUCT_MAP[constructKey];

  const results: RawHypothesis[] = templates.map(t => {
    const keywordConf = applyKeywordAdjustments(
      t.base_confidence, concernText, t.boost_keywords, t.dampen_keywords
    );
    const { confidenceDelta, uncertainty } = responseAdjustment(initialResponses, t.base_uncertainty);
    const finalConf = Math.min(0.95, Math.max(0.05, keywordConf + confidenceDelta));

    return {
      construct_key:    constructKey!,
      label:            t.label,
      confidence:       Math.round(finalConf * 1000) / 1000,
      uncertainty:      Math.round(uncertainty * 1000) / 1000,
      evidence_sources: [t.evidence_type],
      lifecycle_state:  'active' as LifecycleState,
      explainability_context: {
        hypothesis_key:        t.hypothesis_key,
        construct_label:       construct?.label ?? constructKey,
        concern_text:          concernText.slice(0, 120),
        session_id:            sessionId,
        generated_at:          new Date().toISOString(),
        generation_method:     'rule_based_v1',
        response_count:        initialResponses?.length ?? 0,
        response_confidence_delta: confidenceDelta,
      },
    };
  });

  // Sort by confidence descending — highest confidence hypothesis first
  return results.sort((a, b) => b.confidence - a.confidence);
}

// ─── DB Persistence ───────────────────────────────────────────────────────────

/**
 * Persist a new hypothesis set for a session inside a single transaction.
 * Prior rows with lifecycle_state IN ('active','reactivated') for the same
 * session_id are archived first so that the GET active-set endpoint always
 * reflects the *current* generation only, not a mix of historical runs.
 */
export async function persistHypotheses(
  pool: Pool,
  sessionId: string,
  hypotheses: RawHypothesis[],
  tenantId?: string,
): Promise<GeneratedHypothesis[]> {
  const flagEnabled = isEnabled('confidence_engine', tenantId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Archive any existing active/reactivated hypotheses for this session
    await client.query(`
      UPDATE behavioural_hypotheses
      SET lifecycle_state        = 'archived',
          explainability_context = jsonb_set(
            explainability_context,
            '{archived_by_generation}',
            to_jsonb(now()::text)
          ),
          updated_at             = now()
      WHERE session_id      = $1
        AND lifecycle_state IN ('active','reactivated')
    `, [sessionId]);

    // Insert new hypothesis set
    const rows: GeneratedHypothesis[] = [];
    for (const h of hypotheses) {
      // When confidence_engine is enabled, run the initial confidence through
      // computeConfidence to establish a canonical baseline and produce a trace.
      // With all factor inputs at zero the formula reduces to an identity on
      // base_confidence (clamped), preserving rule-based seed values while
      // routing through the single source of truth.
      let finalConf = h.confidence;
      let finalUncertainty = h.uncertainty;
      let engineResult: ReturnType<typeof computeConfidence> | null = null;

      if (flagEnabled) {
        const inputs: ConfidenceInputs = {
          base_confidence:           h.confidence,
          evidence_depth:            0,   // no observations yet at generation time
          signal_reliability:        0,
          longitudinal_consistency:  0,
          contradiction_weighting:   0,
        };
        engineResult  = computeConfidence(inputs);
        finalConf     = engineResult.confidence;
        finalUncertainty = engineResult.uncertainty;
      }

      const { rows: [row] } = await client.query<GeneratedHypothesis>(`
        INSERT INTO behavioural_hypotheses
          (session_id, construct_key, label, confidence, uncertainty,
           evidence_sources, lifecycle_state, explainability_context)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [
        sessionId,
        h.construct_key,
        h.label,
        finalConf,
        finalUncertainty,
        JSON.stringify(h.evidence_sources),
        h.lifecycle_state,
        JSON.stringify(h.explainability_context),
      ]);
      rows.push(row);

      // Write initial confidence trace when engine is enabled
      if (flagEnabled && engineResult && row) {
        await client.query(
          `INSERT INTO confidence_traces
             (session_id, hypothesis_id, trigger_event,
              confidence_before, confidence_after,
              uncertainty_before, uncertainty_after,
              evidence_depth, signal_reliability,
              longitudinal_consistency, contradiction_weighting,
              reason_why, trace_detail)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            sessionId,
            row.id,
            'initial_generation',
            0,                         // no prior confidence
            finalConf,
            1,                         // full uncertainty before first evidence
            finalUncertainty,
            0, 0, 0, 0,               // all factor inputs zero at generation
            engineResult.reason_why,
            JSON.stringify({
              construct_key: h.construct_key,
              label:         h.label,
              generation_method: 'rule_based_v1',
              rule_based_confidence: h.confidence,
            }),
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Broadcast after successful commit — fire-and-forget, flag-gated
    broadcastToSession(sessionId, {
      type: 'hypothesis_generated',
      data: {
        count:       rows.length,
        hypotheses:  rows.map(r => ({
          id:            r.id,
          construct_key: r.construct_key,
          label:         r.label,
          confidence:    r.confidence,
        })),
      },
      explain: `${rows.length} hypothesis/hypotheses generated from concern analysis`,
    }, tenantId);

    return rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Lifecycle Functions ──────────────────────────────────────────────────────

// Maps each lifecycle action to ConfidenceInputs factor overrides.
// The delta adjusts base_confidence; factors model the epistemic effect of the action.
const LIFECYCLE_CONFIDENCE_INPUTS: Record<LifecycleState, {
  delta:                    number;
  evidence_depth:           number;
  signal_reliability:       number;
  contradiction_weighting:  number;
}> = {
  active:      { delta:  +0.10, evidence_depth: 0.05, signal_reliability: 0.70, contradiction_weighting: 0 },
  weakened:    { delta:  -0.10, evidence_depth: 0,    signal_reliability: 0.30, contradiction_weighting: 0.30 },
  suspended:   { delta:  0,     evidence_depth: 0,    signal_reliability: 0,    contradiction_weighting: 0 },
  archived:    { delta:  0,     evidence_depth: 0,    signal_reliability: 0,    contradiction_weighting: 0 },
  reactivated: { delta:  +0.05, evidence_depth: 0.03, signal_reliability: 0.60, contradiction_weighting: 0 },
};

async function updateLifecycle(
  pool: Pool,
  hypothesisId: string,
  newState: LifecycleState,
  reason: string,
  source: string,
  tenantId?: string,
): Promise<GeneratedHypothesis | null> {
  const flagEnabled = isEnabled('confidence_engine', tenantId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [current] } = await client.query<GeneratedHypothesis>(
      'SELECT * FROM behavioural_hypotheses WHERE id = $1',
      [hypothesisId]
    );
    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }

    const currentConf        = Number(current.confidence);
    const currentUncertainty = Number(current.uncertainty);
    const lcInputs           = LIFECYCLE_CONFIDENCE_INPUTS[newState];

    // Feature-flag gate: only route through computeConfidence when enabled.
    // When disabled, preserve legacy static arithmetic (simple clamp on delta)
    // so hypotheses keep their initial confidence scores unchanged by the engine.
    const ctx = (typeof current.explainability_context === 'object' && current.explainability_context !== null)
      ? { ...(current.explainability_context as Record<string, unknown>) }
      : {};

    const rawEvents = ctx['lifecycle_events'];
    const lifecycle_events: unknown[] = Array.isArray(rawEvents)
      ? [...(rawEvents as unknown[])]
      : [];

    let updated: GeneratedHypothesis | undefined;

    if (flagEnabled) {
      // Engine-driven path: compute new confidence via single source of truth
      const engineResult = computeConfidence({
        base_confidence:           Math.min(0.95, Math.max(0.05, currentConf + lcInputs.delta)),
        evidence_depth:            lcInputs.evidence_depth,
        signal_reliability:        lcInputs.signal_reliability,
        longitudinal_consistency:  0,
        contradiction_weighting:   lcInputs.contradiction_weighting,
      });

      lifecycle_events.push({
        state:            newState,
        reason,
        source,
        delta:            lcInputs.delta,
        confidence_after: engineResult.confidence,
        at:               new Date().toISOString(),
      });
      ctx.lifecycle_events = lifecycle_events;

      ({ rows: [updated] } = await client.query<GeneratedHypothesis>(`
        UPDATE behavioural_hypotheses
        SET lifecycle_state        = $1,
            confidence             = $2,
            uncertainty            = $3,
            explainability_context = $4,
            updated_at             = now()
        WHERE id = $5
        RETURNING *
      `, [newState, engineResult.confidence, engineResult.uncertainty, JSON.stringify(ctx), hypothesisId]));

      // Write confidence trace — every engine-driven confidence change is traced
      if (updated) {
        await client.query(
          `INSERT INTO confidence_traces
             (session_id, hypothesis_id, trigger_event,
              confidence_before, confidence_after,
              uncertainty_before, uncertainty_after,
              evidence_depth, signal_reliability,
              longitudinal_consistency, contradiction_weighting,
              reason_why, trace_detail)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            String(updated.session_id ?? hypothesisId),
            hypothesisId,
            'manual_override',
            currentConf,
            engineResult.confidence,
            currentUncertainty,
            engineResult.uncertainty,
            lcInputs.evidence_depth,
            lcInputs.signal_reliability,
            0,
            lcInputs.contradiction_weighting,
            engineResult.reason_why,
            JSON.stringify({
              lifecycle_action: newState,
              reason,
              source,
              delta:            lcInputs.delta,
              construct_key:    String(updated.construct_key ?? ''),
            }),
          ]
        );
      }
    } else {
      // Flag disabled: preserve initial static confidence/uncertainty — only
      // update lifecycle_state. No computeConfidence call, no trace written.
      lifecycle_events.push({
        state:            newState,
        reason,
        source,
        delta:            0,
        confidence_after: currentConf,  // unchanged
        at:               new Date().toISOString(),
      });
      ctx.lifecycle_events = lifecycle_events;

      ({ rows: [updated] } = await client.query<GeneratedHypothesis>(`
        UPDATE behavioural_hypotheses
        SET lifecycle_state        = $1,
            explainability_context = $2,
            updated_at             = now()
        WHERE id = $3
        RETURNING *
      `, [newState, JSON.stringify(ctx), hypothesisId]));
    }

    await client.query('COMMIT');
    return updated ?? null;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[hypothesis-engine] updateLifecycle error:', err);
    return null;
  } finally {
    client.release();
  }
}

export const strengthenHypothesis = (pool: Pool, id: string, reason: string, source = 'api', tenantId?: string) =>
  updateLifecycle(pool, id, 'active',       reason, source, tenantId);

export const weakenHypothesis    = (pool: Pool, id: string, reason: string, source = 'api', tenantId?: string) =>
  updateLifecycle(pool, id, 'weakened',     reason, source, tenantId);

export const suspendHypothesis   = (pool: Pool, id: string, reason: string, source = 'api', tenantId?: string) =>
  updateLifecycle(pool, id, 'suspended',    reason, source, tenantId);

export const archiveHypothesis   = (pool: Pool, id: string, reason: string, source = 'api', tenantId?: string) =>
  updateLifecycle(pool, id, 'archived',     reason, source, tenantId);

export const reactivateHypothesis = (pool: Pool, id: string, reason: string, source = 'api', tenantId?: string) =>
  updateLifecycle(pool, id, 'reactivated',  reason, source, tenantId);
