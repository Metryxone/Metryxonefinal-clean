import { sql } from "drizzle-orm";
import { db } from "../storage";

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════
type BlockType =
  | "reflection" | "question" | "bridge" | "insight"
  | "reassurance" | "pattern_detection" | "progression" | "closure";
type EmotionalTone = "gentle" | "reflective" | "observational" | "supportive";
type PacingSpeed  = "slow" | "medium" | "fast";
type ResponseType = "text" | "chips" | "action";
type Language     = "en" | "hi" | "hi_en" | "te" | "te_en" | "ta" | "kn" | "ml" | "mr";
type SessionMode  = "standard" | "quick_clarity" | "deep_reflection";
type DepthLevel   = 1 | 2 | 3 | 4;

interface ConversationBlock {
  id: string;
  type: BlockType;
  content: string;
  emotionalTone?: EmotionalTone;
  signalMappings?: string[];
  pacing?: { speed: PacingSpeed; delayMs: number };
}

interface DetectedPattern {
  id: string;
  label: string;
  description: string;
  confidence: number;
  signals: string[];
  category: "pattern" | "intervention" | "insight";
  type?: string;
  intensity?: "low" | "moderate" | "high";
  detection_basis?: string[];
  concern_family?: string;
}

interface QualityScore {
  engagement_depth:    number;
  emotional_resonance: number;
  pattern_clarity:     number;
  session_depth:       number;
  total:               number;
}

// ════════════════════════════════════════════════════════════════════════════
// FSM STATES + NARRATIVE LABELS
// ════════════════════════════════════════════════════════════════════════════
const RUNTIME_STATES = [
  "emotional_entry",
  "concern_recognition",
  "reflective_exploration",
  "severity_mapping",
  "emotional_contextualization",
  "behavioural_mapping",
  "pattern_emergence",
  "behavioural_synthesis",
  "reassurance",
  "clarity_generation",
  "growth_transition",
  "progression_reflection",
  "insight_transition",
  "complete",
] as const;

type RuntimeState = typeof RUNTIME_STATES[number];

const NARRATIVE_LABELS: Record<RuntimeState, string> = {
  emotional_entry:             "Here with you",
  concern_recognition:         "Getting to know what's happening",
  reflective_exploration:      "Exploring the timeline",
  severity_mapping:            "Understanding what this feels like",
  emotional_contextualization: "Noticing what makes it harder",
  behavioural_mapping:         "Looking at how you respond",
  pattern_emergence:           "Something is taking shape",
  behavioural_synthesis:       "Reflecting together",
  reassurance:                 "You're not alone in this",
  clarity_generation:          "What becomes possible",
  growth_transition:           "Your path forward",
  progression_reflection:      "Take a moment",
  insight_transition:          "There's more to explore",
  complete:                    "Conversation complete",
};

const STATE_SEQUENCE: RuntimeState[] = [
  "emotional_entry",
  "concern_recognition",
  "reflective_exploration",
  "severity_mapping",
  "emotional_contextualization",
  "behavioural_mapping",
  "pattern_emergence",
  "behavioural_synthesis",
  "reassurance",
  "clarity_generation",
  "growth_transition",
  "progression_reflection",
  "insight_transition",
  "complete",
];

// Quick Clarity — compressed 6-state flow for users who want fast understanding
const QUICK_CLARITY_SEQUENCE: RuntimeState[] = [
  "emotional_entry",
  "concern_recognition",
  "behavioural_synthesis",
  "reassurance",
  "clarity_generation",
  "insight_transition",
  "complete",
];

// ════════════════════════════════════════════════════════════════════════════
// BEHAVIOURAL ONTOLOGY
// ════════════════════════════════════════════════════════════════════════════
interface OntologyEntry {
  mapsTo: string[];
  emotionalSignals: string[];
  behaviouralIndicators: string[];
  relatedPatterns: string[];
  concernFamily: string;
}

const ONTOLOGY: Record<string, OntologyEntry> = {
  exam_stress:      { mapsTo: ["academic_performance_anxiety","evaluation_fear","cognitive_overwhelm"],       emotionalSignals: ["fear_of_failure","performance_pressure","cognitive_overload"],  behaviouralIndicators: ["memory_blocking","physical_tension","avoidance_behaviour"], relatedPatterns: ["performance_anxiety_loop","catastrophizing_pattern","avoidance_cycle"], concernFamily: "academic" },
  burnout:          { mapsTo: ["recovery_deficiency","motivation_fatigue","emotional_exhaustion"],             emotionalSignals: ["chronic_tiredness","emotional_detachment","reduced_pleasure"],    behaviouralIndicators: ["reduced_output","increased_procrastination","social_withdrawal"], relatedPatterns: ["burnout_escalation","recovery_resistance","momentum_collapse"], concernFamily: "occupational" },
  attention:        { mapsTo: ["sustained_focus_difficulty","cognitive_switching","attention_fragmentation"],  emotionalSignals: ["frustration_with_self","restlessness","task_avoidance"],          behaviouralIndicators: ["incomplete_tasks","distraction_seeking","low_output_consistency"], relatedPatterns: ["attention_fragmentation_loop","distraction_amplification","focus_collapse"], concernFamily: "cognitive" },
  social_anxiety:   { mapsTo: ["approval_seeking","evaluation_fear","social_withdrawal"],                      emotionalSignals: ["self_consciousness","anticipatory_dread","shame_avoidance"],      behaviouralIndicators: ["avoidance_of_social_contexts","over_preparation","post_event_rumination"], relatedPatterns: ["avoidance_reinforcement","social_identity_threat","shame_spiral"], concernFamily: "social" },
  career_stagnation:{ mapsTo: ["recognition_frustration","motivation_fatigue","identity_uncertainty"],         emotionalSignals: ["self_doubt","emotional_pressure","purposelessness"],              behaviouralIndicators: ["effort_without_progress","comparison_distress","disengagement"], relatedPatterns: ["career_identity_fatigue","recognition_deprivation","momentum_disruption"], concernFamily: "professional" },
  anger:            { mapsTo: ["emotional_dysregulation","boundary_frustration","helplessness"],               emotionalSignals: ["reactive_irritability","injustice_sensitivity","suppressed_expression"], behaviouralIndicators: ["verbal_escalation","withdrawal_after_outburst","internal_rumination"], relatedPatterns: ["emotional_reactivity_loop","suppression_explosion_cycle","resentment_buildup"], concernFamily: "emotional" },
  motivation:       { mapsTo: ["purposelessness","energy_depletion","goal_ambiguity"],                         emotionalSignals: ["low_initiative","activation_difficulty","anticipatory_emptiness"], behaviouralIndicators: ["inaction_despite_intention","frequent_task_abandonment","passivity"], relatedPatterns: ["activation_deficit","purpose_erosion","inertia_reinforcement"], concernFamily: "motivational" },
  relationship:     { mapsTo: ["attachment_anxiety","conflict_avoidance","emotional_distance"],                emotionalSignals: ["fear_of_abandonment","rejection_sensitivity","emotional_guardedness"], behaviouralIndicators: ["over_accommodation","emotional_suppression","distance_maintenance"], relatedPatterns: ["anxious_attachment_loop","avoidance_distancing_cycle","emotional_isolation"], concernFamily: "relational" },
  self_esteem:      { mapsTo: ["negative_self_narrative","comparison_distress","shame_avoidance"],             emotionalSignals: ["chronic_self_doubt","inadequacy_sensitivity","internal_critic_dominance"], behaviouralIndicators: ["self_deprecating_language","achievement_discounting","risk_avoidance"], relatedPatterns: ["inner_critic_loop","impostor_pattern","worth_conditionality"], concernFamily: "identity" },
  procrastination:  { mapsTo: ["perfectionism_paralysis","fear_of_failure","task_aversion"],                   emotionalSignals: ["performance_dread","overwhelm_onset","anticipatory_shame"],       behaviouralIndicators: ["task_initiation_delay","avoidance_via_substitution","last_minute_compression"], relatedPatterns: ["perfectionism_avoidance_loop","task_dread_cycle","procrastination_shame_spiral"], concernFamily: "cognitive" },
  sleep:            { mapsTo: ["rumination_loops","recovery_deficiency","anxiety_spillover"],                  emotionalSignals: ["hyperarousal","bedtime_dread","unresolved_worry"],                behaviouralIndicators: ["delayed_sleep_onset","night_waking_with_thoughts","daytime_fatigue"], relatedPatterns: ["sleep_anxiety_loop","hyperarousal_persistence","recovery_deficit"], concernFamily: "physiological" },
  screen_addiction: { mapsTo: ["impulse_regulation","reality_avoidance","dopamine_dependency"],                emotionalSignals: ["restlessness_without_screens","guilt_after_use","compulsive_checking"], behaviouralIndicators: ["screen_time_escalation","withdrawal_difficulty","offline_discomfort"], relatedPatterns: ["digital_dependency_loop","avoidance_reinforcement","attention_erosion"], concernFamily: "digital" },
};

// ════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ════════════════════════════════════════════════════════════════════════════
function detectLanguage(text: string): Language {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  // Hinglish — romanized Hindi markers
  if (/\b(nahi|bahut|acha|theek|pareshan|thaka?|zyada|mehnat|ho raha|kar raha|lag raha|padhai|samajh|tension hai|pressure hai|feel ho|nhi|hoon|hun|kuch)\b/i.test(text)) return "hi_en";
  // Telugu romanized
  if (/\b(naku|meeru|cheyyadam|ledu|chala|undi|avutundi|antunnanu|chestunnanu|paduthunna|baadhaga|kastam|anipistundi)\b/i.test(text)) return "te_en";
  return "en";
}

// ════════════════════════════════════════════════════════════════════════════
// SIGNAL EXTRACTION — English + Multilingual
// ════════════════════════════════════════════════════════════════════════════
const SIGNAL_KEYWORDS: Array<{ patterns: RegExp[]; signals: string[] }> = [
  // English
  { patterns: [/freeze|blank|mind goes blank|block/i],          signals: ["cognitive_blocking",    "evaluation_fear"] },
  { patterns: [/overwhelm|too much|drowning/i],                 signals: ["emotional_overwhelm",   "cognitive_overload"] },
  { patterns: [/tired|exhaust|drain/i],                         signals: ["fatigue",               "recovery_deficiency"] },
  { patterns: [/always|never|everyone|nobody/i],                signals: ["absolutist_thinking",   "catastrophizing"] },
  { patterns: [/can't|cannot|impossible|nothing works/i],       signals: ["helplessness",          "learned_helplessness"] },
  { patterns: [/fear|scared|afraid/i],                          signals: ["fear_signal",           "evaluation_fear"] },
  { patterns: [/pressure|stressed|stress/i],                    signals: ["performance_pressure",  "external_demands"] },
  { patterns: [/angry|anger|frustrat/i],                        signals: ["emotional_dysregulation","boundary_frustration"] },
  { patterns: [/sad|depress|low|empty/i],                       signals: ["emotional_pain",        "low_mood"] },
  { patterns: [/focus|concentrate|distract/i],                  signals: ["attention_fragmentation","focus_difficulty"] },
  { patterns: [/alone|isolat|withdraw/i],                       signals: ["social_withdrawal",     "isolation_tendency"] },
  { patterns: [/judge|judged|embarrass/i],                      signals: ["evaluation_fear",       "shame_avoidance"] },
  { patterns: [/worthless|useless|failure|loser|hate myself/i], signals: ["negative_self_narrative","shame_signal"] },
  { patterns: [/months|years|long time|forever|always been/i],  signals: ["chronic_duration",      "long_standing_pattern"] },
  { patterns: [/recently|lately|past week|this month/i],        signals: ["acute_onset",           "recent_escalation"] },
  { patterns: [/work|job|career|boss|colleague/i],              signals: ["occupational_context",  "career_domain"] },
  { patterns: [/school|exam|study|class|teacher/i],             signals: ["academic_context",      "evaluation_context"] },
  { patterns: [/friend|family|partner|relationship/i],          signals: ["relational_context",    "social_domain"] },
  { patterns: [/sleep|night|wake|rest/i],                       signals: ["sleep_disruption",      "recovery_domain"] },
  { patterns: [/push through|keep going|persist|power through/i],signals: ["avoidant_persistence", "suppression"] },
  { patterns: [/numb|detach|don't care anymore/i],              signals: ["emotional_detachment",  "dissociation_signal"] },
  { patterns: [/hurt|pain|cry|crying/i],                        signals: ["emotional_pain",        "grief_signal"] },
  { patterns: [/help|support|someone to talk/i],                signals: ["help_seeking",          "connection_need"] },
  // Hinglish / Hindi romanized
  { patterns: [/thaka|thak gaya|bahut thak|energy nahi|drain ho/i],  signals: ["fatigue",               "recovery_deficiency"] },
  { patterns: [/darr|dar lag|dara hua|dara feel|darr raha/i],         signals: ["fear_signal",           "evaluation_fear"] },
  { patterns: [/akela|alone feel|koi nahi samjhta|samjhta nahi/i],    signals: ["social_withdrawal",     "isolation_tendency"] },
  { patterns: [/samajh nahi aa|confused hoon|kuch nahi kar paa/i],    signals: ["cognitive_blocking",    "helplessness"] },
  { patterns: [/pressure hai|tension hai|stress hai|pareshan|takleef/i], signals: ["performance_pressure","external_demands"] },
  { patterns: [/bahut rona|ro diya|rona aa raha/i],                   signals: ["emotional_pain",        "grief_signal"] },
  { patterns: [/padhai mein|exam ka|school mein|study nahi ho/i],     signals: ["academic_context",      "evaluation_context"] },
  { patterns: [/kaam mein|job mein|career mein|boss ne|office/i],     signals: ["occupational_context",  "career_domain"] },
  { patterns: [/nahi badlega|kuch nahi hoga|sab bekar|koi farak nahi/i], signals: ["helplessness",       "learned_helplessness"] },
  { patterns: [/gussa|gusse mein|bahut gussa|frustration hai/i],       signals: ["emotional_dysregulation","boundary_frustration"] },
  // Telugu romanized
  { patterns: [/naku growth ledu|job lo stuck|work lo problem/i],     signals: ["occupational_context",  "career_domain"] },
  { patterns: [/chala tired|exhausted ga|energy ledu/i],              signals: ["fatigue",               "recovery_deficiency"] },
  { patterns: [/focus cheyyalekapothunna|concentrate cheyyalem/i],    signals: ["attention_fragmentation","focus_difficulty"] },
  { patterns: [/baadhaga|kastam ga|chala stress|pressure feel/i],     signals: ["performance_pressure",  "external_demands"] },
  { patterns: [/exam stress|padataniki|study cheyyalem/i],            signals: ["academic_context",      "evaluation_context"] },
];

function extractSignals(text: string): string[] {
  const found = new Set<string>();
  for (const { patterns, signals } of SIGNAL_KEYWORDS) {
    if (patterns.some(p => p.test(text))) signals.forEach(s => found.add(s));
  }
  return [...found];
}

function classifyConcern(text: string, initial?: string): string {
  const combined = ((initial || "") + " " + text).toLowerCase();
  if (/exam|test|study|academic|school|class|padhai/i.test(combined))          return "exam_stress";
  if (/burnout|exhaust|drain|depleted|overwhelm.*work/i.test(combined))        return "burnout";
  if (/focus|concentrate|distract|attention|adhd/i.test(combined))             return "attention";
  if (/social|people|embarrass|judge|anxious.*group/i.test(combined))          return "social_anxiety";
  if (/career|job|stuck|progress|promot|kaam|growth ledu/i.test(combined))     return "career_stagnation";
  if (/anger|angry|frustrat|rage|temper|gussa/i.test(combined))                return "anger";
  if (/motivat|lazy|procrastinat/i.test(combined))                             return "motivation";
  if (/sleep|insomnia|wake.*night/i.test(combined))                            return "sleep";
  if (/screen|phone|social media|scroll/i.test(combined))                      return "screen_addiction";
  if (/relationship|partner|friend.*problem/i.test(combined))                  return "relationship";
  if (/confident|self.esteem|worthless|inadequate/i.test(combined))            return "self_esteem";
  if (/procrastinat|delay|avoid.*task/i.test(combined))                        return "procrastination";
  return "general";
}

// ════════════════════════════════════════════════════════════════════════════
// PROGRESSIVE DEPTH SYSTEM (Levels 1–4)
// ════════════════════════════════════════════════════════════════════════════
function computeDepthLevel(
  signals: string[],
  turnCount: number,
  userInput: string,
): DepthLevel {
  const emotionalWords = /feel|felt|emotion|scared|tired|anxious|angry|sad|afraid|stress|overwhelm|alone|hurt|empty|thaka|pareshan|baadhaga/i.test(userInput);
  const score = signals.length + (emotionalWords ? 3 : 0) + Math.min(turnCount * 2, 10);
  if (score >= 18) return 4;
  if (score >= 12) return 3;
  if (score >= 6)  return 2;
  return 1;
}

// ════════════════════════════════════════════════════════════════════════════
// ADAPTIVE REFLECTION DENSITY
// ════════════════════════════════════════════════════════════════════════════
const HEAVY_SIGNALS = new Set([
  "shame_signal", "helplessness", "emotional_overwhelm",
  "learned_helplessness", "fear_signal", "emotional_pain",
  "grief_signal", "negative_self_narrative", "dissociation_signal",
]);

function computeEmotionalWeight(signals: string[]): number {
  return signals.filter(s => HEAVY_SIGNALS.has(s)).length;
}

type ReflectionDensity = "full" | "brief" | "skip";

function getReflectionDensity(emotionalWeight: number, turnCount: number, depthLevel: DepthLevel): ReflectionDensity {
  if (emotionalWeight >= 5)                         return "skip";
  if (emotionalWeight >= 3 || turnCount >= 8)       return "brief";
  if (depthLevel === 1)                             return "brief";
  return "full";
}

function truncateToFirst(text: string): string {
  const sentence = text.match(/^[^.!?]+[.!?]/);
  return sentence ? sentence[0] : text.slice(0, 100) + "…";
}

// ════════════════════════════════════════════════════════════════════════════
// CONVERSATION QUALITY ENGINE
// ════════════════════════════════════════════════════════════════════════════
function computeQuality(
  allSignals: string[],
  patterns: DetectedPattern[],
  turnCount: number,
  userInput: string,
): QualityScore {
  const engagement_depth    = Math.round(Math.min(allSignals.length / 10, 1) * 25);
  const emotional_resonance = /feel|felt|emotion|scared|tired|anxious|angry|sad|afraid|stress|overwhelm|alone|hurt|empty|thaka|pareshan|baadhaga/i.test(userInput) ? 25 : 10;
  const pattern_clarity     = patterns.filter(p => p.category === "pattern").length > 0 ? 25 : 0;
  const session_depth       = Math.min(turnCount * 5, 25);
  const total               = engagement_depth + emotional_resonance + pattern_clarity + session_depth;
  return { engagement_depth, emotional_resonance, pattern_clarity, session_depth, total };
}

// ════════════════════════════════════════════════════════════════════════════
// HUMAN ESCALATION DETECTION
// ════════════════════════════════════════════════════════════════════════════
interface EscalationResult {
  flag: boolean;
  reason: string;
  severity: "low" | "moderate" | "high";
}

function checkEscalation(signals: string[], userInput: string): EscalationResult {
  const text = userInput.toLowerCase();
  const activeCrisis = /hurt myself|self.harm|end it|don't want to be here|can't go on|suicid|jeena nahi|jaan dena|khud ko hurt/i.test(text);
  if (activeCrisis) {
    return { flag: true, reason: "Active crisis language detected", severity: "high" };
  }
  const hasShame        = signals.includes("shame_signal") || signals.includes("negative_self_narrative");
  const hasHelplessness = signals.includes("helplessness") || signals.includes("learned_helplessness");
  const hasChronic      = signals.includes("chronic_duration");
  const hasWorthlessness = /worthless|useless|burden|nobody cares|doesn't matter|bekar hoon|kisi ko fark nahi/i.test(text);
  if ((hasShame && hasHelplessness && hasChronic) || (hasWorthlessness && hasHelplessness)) {
    return { flag: true, reason: "Multi-factor distress pattern: shame + helplessness + chronic duration", severity: "moderate" };
  }
  return { flag: false, reason: "", severity: "low" };
}

// ════════════════════════════════════════════════════════════════════════════
// BEHAVIOURAL DRIFT DETECTION
// ════════════════════════════════════════════════════════════════════════════
interface DriftResult {
  direction: "worsening" | "stabilizing" | "recovering" | "improving" | "new_session";
  description: string;
  confidence: number;
}

function detectDrift(currentSignals: string[], previousSignals: string[]): DriftResult {
  if (!previousSignals || previousSignals.length === 0) {
    return { direction: "new_session", description: "First session recorded", confidence: 1 };
  }
  const heavyCurrent  = currentSignals.filter(s => HEAVY_SIGNALS.has(s));
  const heavyPrevious = previousSignals.filter(s => HEAVY_SIGNALS.has(s));
  const newHeavy      = heavyCurrent.filter(s => !heavyPrevious.includes(s));
  const resolvedHeavy = heavyPrevious.filter(s => !heavyCurrent.includes(s));
  const helpSeek      = currentSignals.includes("help_seeking") && !previousSignals.includes("help_seeking");
  if (newHeavy.length >= 2)      return { direction: "worsening",   description: `${newHeavy.length} new distress signals since last session`, confidence: 0.78 };
  if (resolvedHeavy.length >= 2) return { direction: "recovering",  description: `${resolvedHeavy.length} distress signals no longer present`, confidence: 0.74 };
  if (helpSeek)                  return { direction: "improving",   description: "Help-seeking behaviour detected — a positive shift", confidence: 0.71 };
  return                                { direction: "stabilizing", description: "Signal pattern broadly consistent with last session", confidence: 0.68 };
}

// ════════════════════════════════════════════════════════════════════════════
// MICRO-REFLECTION TEMPLATES (1–2 short sentences, voice-ready)
// ════════════════════════════════════════════════════════════════════════════
interface ReflectionTemplate {
  id: string;
  concernFamilies: string[];
  signalMatch?: string[];
  template: string;
  templateHi?: string;  // Hindi-natural / Hinglish version
  templateTe?: string;  // Telugu-natural romanized version
  templateTa?: string;  // Tamil-natural romanized version
  tone: EmotionalTone;
  followupIntent: "explore" | "clarify" | "contextualize";
}

const REFLECTION_TEMPLATES: ReflectionTemplate[] = [
  // Academic
  {
    id: "r_acad_01", concernFamilies: ["academic"], signalMatch: ["cognitive_blocking"],
    template: "That moment of going blank makes sense — your mind is under real pressure, not failing you.",
    templateHi: "Yeh blank ho jaana samajh mein aata hai — pressure mein aisa hi hota hai.",
    templateTe: "Aa blank feeling artham avutundi — pressure lo mind ila react avutundi.",
    templateTa: "Aa blank-aana moment puriyudhu — pressure-la mind ippadi react pannum, tholvi kadu.",
    tone: "reflective", followupIntent: "explore",
  },
  {
    id: "r_acad_02", concernFamilies: ["academic"], signalMatch: ["performance_pressure"],
    template: "It sounds like the exam has started to feel like more than just a test — like something bigger is riding on it.",
    templateHi: "Lagta hai exam sirf ek test nahi raha — kuch zyada bada feel ho raha hai.",
    templateTe: "Exam just test kaadu ani feel avutundi — daani meeda chala pedda burden undi.",
    templateTa: "Exam just oru test mattum illai-nu feel aagudhu — adha mela romba periya vishayam irukkumnu theriyudhu.",
    tone: "observational", followupIntent: "contextualize",
  },
  {
    id: "r_acad_03", concernFamilies: ["academic"],
    template: "What you're feeling in academic situations often has more to do with pressure than ability.",
    templateHi: "Jo feel ho raha hai woh capability ke baare mein nahi — pressure ke baare mein hai.",
    templateTe: "Meeru feel avutunnaadi capability gurinchi kadu — pressure gurinchi.",
    templateTa: "Neenga feel panradhu capability pattri illai — pressure pattri.",
    tone: "gentle", followupIntent: "explore",
  },
  {
    id: "r_acad_04", concernFamilies: ["academic"], signalMatch: ["evaluation_fear"],
    template: "A lot of energy goes into dreading the judgement — before it even starts.",
    templateHi: "Judgement ki anticipation mein hi itni energy waste ho jaati hai.",
    templateTe: "Judgement anticipation loney chala energy waste avutundi.",
    templateTa: "Judgement-kku munnade bhayam padave chala energy poagudhu.",
    tone: "observational", followupIntent: "explore",
  },

  // Occupational
  {
    id: "r_occ_01", concernFamilies: ["occupational"], signalMatch: ["fatigue", "recovery_deficiency"],
    template: "That kind of tired doesn't come from a bad week — it builds slowly, over a long time.",
    templateHi: "Yeh thakan ek haftey ki nahi — dheere dheere ayi hai, time ke saath.",
    templateTe: "Aa tired feeling oka vaadam nundi kadu — nidhaanam ga, time tho vasthundi.",
    templateTa: "Aa tired feeling oru vaaram-la varavillai — meellama, neram poaga vasrudhu.",
    tone: "reflective", followupIntent: "explore",
  },
  {
    id: "r_occ_02", concernFamilies: ["occupational"], signalMatch: ["emotional_detachment"],
    template: "Feeling disconnected from work you used to care about is a signal, not a character flaw.",
    templateHi: "Jo kaam pehle achha lagta tha, ab nahi lagta — yeh weakness nahi, ek signal hai.",
    templateTe: "Okappudu care chesina pani nunchi disconnect feel avataamu — idi weakness kadu, signal.",
    templateTa: "Munnaadi care pannina velai-la irundu disconnect feel aavadhu — idhu weakness illai, signal.",
    tone: "gentle", followupIntent: "contextualize",
  },
  {
    id: "r_occ_03", concernFamilies: ["occupational"],
    template: "This kind of exhaustion usually isn't fixed by rest alone — it goes deeper than that.",
    templateHi: "Sirf neend se yeh thakan nahi jayegi — kuch aur bhi chal raha hai.",
    templateTe: "Idi sirf rest tho saripodhu — idi adi chala deeper ga undi.",
    templateTa: "Idha rest mattum sari panna mudiyadhu — idhu romba azhama irukkudhu.",
    tone: "observational", followupIntent: "explore",
  },

  // Cognitive
  {
    id: "r_cog_01", concernFamilies: ["cognitive"], signalMatch: ["attention_fragmentation"],
    template: "Struggling to focus in a world designed to distract you is harder than most people admit.",
    templateHi: "Iss duniya mein focus rakhna genuinely mushkil hai — sirf tumhare saath nahi hota.",
    templateTe: "Distract cheyyadaniki design chesina world lo focus pettadam genuinely kashtam — sirf meerukaadu.",
    templateTa: "Distract pannave design aana ulaga-la focus panna romba kastam — sirf unngalukku mattum illai.",
    tone: "reflective", followupIntent: "explore",
  },
  {
    id: "r_cog_02", concernFamilies: ["cognitive"],
    template: "Difficulty with focus often isn't about effort — something else is usually underneath.",
    templateHi: "Focus problem mein zyadatar willpower nahi — kuch aur chal raha hota hai.",
    templateTe: "Focus problem lo zyadatara willpower kadu — inka emi undali anipistundi.",
    templateTa: "Focus kastam-la pera effort illai — inna enna-vo ullae irukkudhu.",
    tone: "observational", followupIntent: "contextualize",
  },

  // Social
  {
    id: "r_soc_01", concernFamilies: ["social"], signalMatch: ["evaluation_fear"],
    template: "It sounds like every interaction can feel like a performance, with an audience you can't switch off.",
    templateHi: "Lagta hai har interaction ek performance hai — ek audience jo band nahi hoti.",
    templateTe: "Prati interaction oka performance la feel avutundi — off cheyyaleني oka audience.",
    templateTa: "Oru oru interaction-um oru performance maadiri feel aagudhu — off panna mudiyadha oru audience.",
    tone: "gentle", followupIntent: "explore",
  },
  {
    id: "r_soc_02", concernFamilies: ["social"], signalMatch: ["shame_avoidance"],
    template: "What looks like shyness is often just a protective habit that made sense at some point.",
    templateHi: "Jo shyness lagti hai, woh aksar ek purani protection hai — ek aadat jo kisi time pe zaruri thi.",
    templateTe: "Shyness la kanipisedi aksar oka protection habit — oka time lo avasaramaina aadat.",
    templateTa: "Shyness maadiri theriyuradhu pera oru protective habit — onnu kaalam avasi-yam-aana oru pazhakam.",
    tone: "reflective", followupIntent: "contextualize",
  },

  // Professional
  {
    id: "r_pro_01", concernFamilies: ["professional"], signalMatch: ["recognition_frustration"],
    template: "Putting in effort and not being seen for it is genuinely painful — not just frustrating.",
    templateHi: "Itni mehnat ke baad bhi recognition na milna — yeh sirf frustration nahi, dard hai.",
    templateTe: "Chala effort petti recognition raakunda poyataamu — idi sirf frustration kadu, nijamga baadha.",
    templateTa: "Chala effort panni recognition varaama poadhu — idhu sirf frustration illai, vali.",
    tone: "reflective", followupIntent: "explore",
  },
  {
    id: "r_pro_02", concernFamilies: ["professional"],
    template: "Feeling stuck in your career starts to feel personal, even when it isn't.",
    templateHi: "Career mein stuck feel karna personal lagne lagta hai — bhale hi ho na.",
    templateTe: "Career lo stuck feel avataamu personal ga anipistundi — adhi lekunna.",
    templateTa: "Career-la stuck feel aavadhu personal-a feel aaga thoudangi — adha illaadhaalum.",
    tone: "observational", followupIntent: "contextualize",
  },

  // Emotional
  {
    id: "r_emo_01", concernFamilies: ["emotional"], signalMatch: ["emotional_dysregulation"],
    template: "Strong reactions are rarely just about the moment — they often carry older weight.",
    templateHi: "Zyada reaction sirf us moment ka nahi hota — usme purani baatein bhi hoti hain.",
    templateTe: "Strong reactions aksar sirf aa moment gurinchi kadu — vaatilo paatha weight untundi.",
    templateTa: "Strong reactions pera aa moment pattri mattum illai — adhule pazhaya baaram irukku.",
    tone: "gentle", followupIntent: "explore",
  },
  {
    id: "r_emo_02", concernFamilies: ["emotional"], signalMatch: ["emotional_pain"],
    template: "When pain comes up like this, it's usually been building quietly for a while.",
    templateHi: "Jab dard aisa ata hai, woh usually kaafi time se andar ban raha hota hai.",
    templateTe: "Idi ila vastunte, idi usually chala kaalagaa quiet ga build avutundi.",
    templateTa: "Idha maadiri vali varudhunna, idhu pera nerenga quiet-a build aagikitte irundhadhu.",
    tone: "gentle", followupIntent: "explore",
  },

  // Motivational
  {
    id: "r_mot_01", concernFamilies: ["motivational"], signalMatch: ["purposelessness"],
    template: "Losing motivation isn't laziness — it usually means effort and meaning have disconnected somewhere.",
    templateHi: "Motivation kho jaana aalas nahi hai — matlab aur kaam ka connection toot gaya hota hai.",
    templateTe: "Motivation poadaamu saalsam kadu — effort aur meaning endi kaadaa disconnect ayyindi.",
    templateTa: "Motivation poavadhu tembal illai — effort-um meaning-um enda-vO disconnect aagidhdhu.",
    tone: "reflective", followupIntent: "explore",
  },

  // Identity
  {
    id: "r_id_01", concernFamilies: ["identity"], signalMatch: ["negative_self_narrative"],
    template: "That inner critic has been trying to protect you — but its methods are outdated.",
    templateHi: "Woh andar ki awaaz jo criticize karti hai — woh protect karne ki koshish thi, par ab zaroori nahi.",
    templateTe: "Aa inner critic meeru protect cheyyataniki prayatnistaadi — kaani adhi methodsippatide kadu.",
    templateTa: "Aa inner critic unnangala protect panna try pannudhu — aana adha methods pazhaya-adhu.",
    tone: "gentle", followupIntent: "contextualize",
  },
  {
    id: "r_id_02", concernFamilies: ["identity"],
    template: "Self-doubt tends to use old evidence to judge a version of you that's already moved forward.",
    templateHi: "Self-doubt purani baatein use karke aaj ke tumhe judge karta hai — jo ab waise nahi raha.",
    templateTe: "Self-doubt paatha evidence use chesi meeru ippudu unmaina version ni judge chestaadi.",
    templateTa: "Self-doubt pazhaya evidence-a use panni, neenga ippo irukka version-a judge pannum.",
    tone: "observational", followupIntent: "explore",
  },

  // Digital
  {
    id: "r_dig_01", concernFamilies: ["digital"],
    template: "Screen time that's hard to stop is usually doing an emotional job — filling something, or avoiding something.",
    templateHi: "Phone band karna mushkil ho to woh ek kaam kar raha hota hai — kuch bharna ya kuch avoid karna.",
    templateTe: "Rokataniki kashtamaina screen time oka emotional job chestaundi — emi fill cheyyataniki leda avoid cheyyataniki.",
    templateTa: "Nirkka kasht-am-ana screen time oru emotional velai seyyudhu — enna-vo fill panna illa avoid panna.",
    tone: "observational", followupIntent: "explore",
  },

  // Physiological
  {
    id: "r_phy_01", concernFamilies: ["physiological"],
    template: "When your mind won't switch off at night, it's rarely just about sleep — it's about everything that hasn't settled.",
    templateHi: "Raat ko neend na aana sirf sleep ki baat nahi — jo din mein process nahi hua woh andar chal raha hota hai.",
    templateTe: "Raatriki mind off kaakupovadam sirf sleep gurinchi kadu — pavalinchi settle kaanidi annitiki.",
    templateTa: "Raathiri mind off aagaadhapoadhu, idhu sirf thoakkam pattri illai — ellaam settle aagaadhapoadhu.",
    tone: "reflective", followupIntent: "explore",
  },

  // General / fallback
  {
    id: "r_gen_01", concernFamilies: ["general", "relational"],
    template: "What you're carrying has been taking up more space than the people around you probably realise.",
    templateHi: "Jo tum carry kar rahe ho, uska weight logon ko andaza nahi hoga.",
    templateTe: "Meeru carry chestaunnadi chutturunnavaari andajalaku raadhu.",
    templateTa: "Neenga carry pannuradhu, unga arugilirukkavarukku therivaadhapoadhu.",
    tone: "gentle", followupIntent: "explore",
  },
  {
    id: "r_gen_02", concernFamilies: ["general"],
    template: "There's usually more underneath than what appears on the surface — and that's what makes it hard to shake.",
    templateHi: "Upar jo dikhta hai, neeche usse zyada hota hai — isliye yeh mushkil lagta hai.",
    templateTe: "Meeda kanipisedi daanikanna kelaindi zyadaa untundi — adhi valla idi shake off cheyyataniki kashtam.",
    templateTa: "Meelae theriyuradhai vida ullae romba irukkum — adhanaalae idha tholaika kasht-am.",
    tone: "reflective", followupIntent: "contextualize",
  },
  {
    id: "r_gen_03", concernFamilies: ["general"],
    template: "Putting this into words is already a step — even when it's hard to know where to start.",
    templateHi: "Yeh words mein keh dena pehle se ek kadam hai — chahe shuru kahan se karein pata na ho.",
    templateTe: "Idi words lo cheppataamu pehle nundi oka kadam — evade start cheyyaalo teliyakunda poyina.",
    templateTa: "Idha words-la solla mudinjadhu ondrE oru adiyedutthadhu — enga thodi-ngadhu-nu theriyaadhaalum.",
    tone: "supportive", followupIntent: "explore",
  },
];

function selectReflection(
  concernFamily: string,
  signals: string[],
  usedIds: string[],
  lang: Language,
): ReflectionTemplate | null {
  const candidates = REFLECTION_TEMPLATES
    .filter(t => !usedIds.includes(t.id))
    .filter(t => t.concernFamilies.includes(concernFamily) || t.concernFamilies.includes("general"))
    .sort((a, b) => {
      const aScore = (a.signalMatch || []).filter(s => signals.includes(s)).length + (a.concernFamilies.includes("general") ? 0 : 1);
      const bScore = (b.signalMatch || []).filter(s => signals.includes(s)).length + (b.concernFamilies.includes("general") ? 0 : 1);
      return bScore - aScore;
    });
  return candidates[0] || null;
}

function getReflectionContent(tmpl: ReflectionTemplate, lang: Language): string {
  if ((lang === "hi" || lang === "hi_en") && tmpl.templateHi) return tmpl.templateHi;
  if ((lang === "te" || lang === "te_en") && tmpl.templateTe) return tmpl.templateTe;
  if (lang === "ta" && tmpl.templateTa) return tmpl.templateTa;
  return tmpl.template;
}

// ════════════════════════════════════════════════════════════════════════════
// BRIDGE ENGINE — short, natural, voice-ready
// ════════════════════════════════════════════════════════════════════════════
interface BridgeTemplate {
  signalMatch: string[];
  template: string;
  templateHi?: string;
  templateTe?: string;
  templateTa?: string;
}

const BRIDGE_TEMPLATES: BridgeTemplate[] = [
  { signalMatch: ["emotional_overwhelm"],    template: "That sounds heavy.",                                                       templateHi: "Yeh bahut bhaari lag raha hai.", templateTe: "Adi chala kashtam ga undi.",                    templateTa: "Adhu romba paaramana vishayam." },
  { signalMatch: ["cognitive_blocking"],     template: "That moment of going blank — I hear you.",                                 templateHi: "Woh blank hone ka pal — samajh raha hoon.",       templateTe: "Aa blank moment — vinnanu.",             templateTa: "Aa blank-aana nerram — kettaen." },
  { signalMatch: ["fatigue"],               template: "That kind of tired goes deeper than sleep.",                                templateHi: "Yeh thakan sirf neend se nahi ayi.",              templateTe: "Aa tiredgaa feel avataniki neend matrame kaadu.", templateTa: "Aa kalipu thoakkam-ai vida azhama irukkudhu." },
  { signalMatch: ["absolutist_thinking"],   template: "'Always' and 'never' — those words show up when something feels stuck.",   templateHi: "'Hamesha' aur 'kabhi nahi' — jab kuch phas jaata hai tab aate hain yeh words.",                              templateTa: "'Eppozhum' 'epodhum illai' — idhu ottu-poana feel-la vandhidu vaarthai." },
  { signalMatch: ["helplessness"],          template: "Feeling like nothing will change is one of the heaviest things to carry.", templateHi: "Yeh feeling ki kuch nahi badlega — bahut bhaari hoti hai.",                                                  templateTa: "Enna-vo maathaadhu-nu feel aavadhu romba paaramaana vishayam." },
  { signalMatch: ["fear_signal"],           template: "That fear makes sense.",                                                   templateHi: "Yeh darr samajh mein aata hai.",                  templateTe: "Aa bayam artham avutundi.",              templateTa: "Aa bayam puriyudhu." },
  { signalMatch: ["evaluation_fear"],       template: "The dread of being judged is exhausting in itself.",                       templateHi: "Judge hone ka darr — yeh khud mein hi thaka deta hai.",                                                    templateTa: "Judge aavannu paidhura bayam sonthamavae kalaiksudhu." },
  { signalMatch: ["performance_pressure"],  template: "External pressure has a way of turning against you over time.",            templateHi: "Bahari pressure dheere dheere tumhare khilaaf ho jaata hai.",                                               templateTa: "Puratthu azhattham meellama unnga mela thirumbi varum." },
  { signalMatch: ["social_withdrawal"],     template: "Pulling away from others often signals something that needs attention.",   templateHi: "Logon se door hona aksar kuch aur kehta hai.",   templateTe: "Andari nunchi door avataamu inka emi chepputundi.", templateTa: "Marravaralai vittu vilakuradhu inna enna-vo solvadhu." },
  { signalMatch: ["shame_signal"],          template: "What you just shared takes something. I appreciate that.",                 templateHi: "Jo abhi share kiya — yeh aasaan nahi hota.",     templateTe: "Ippatike share chesindi — idi easy kadu.", templateTa: "Ippave share pannidhu — adhu easy-a illai." },
  { signalMatch: ["negative_self_narrative"],template: "The way you're talking about yourself — worth looking at that closely.", templateHi: "Tum khud ke baare mein jo bol rahe ho — isko gaur se dekhna chahiye.",                                        templateTa: "Neenga unnagala patti pesara vidam — adha kavanamaa paakka vendum." },
  { signalMatch: ["chronic_duration"],      template: "Something this long-standing isn't something you've ignored — you've been managing it.",  templateHi: "Itne time se chal raha hai — tumne ignore nahi kiya, manage kiya hai.", templateTe: "Itne kaalanga undi — ignore cheyyaledu, manage chesaaru.",   templateTa: "Ingane nera-maay irukkudhu — ignore pannalai, manage pannitenga." },
  { signalMatch: ["recent_escalation"],     template: "A sudden intensification usually means something shifted.",                 templateHi: "Achanak bada hona aksar kisi badlaav ka signal hai.",                                                       templateTa: "Tidirennu athiga-vaadhu pera enna-vo marindhana signal." },
  { signalMatch: ["occupational_context"],  template: "When work feels this way, it rarely stays just at work.",                  templateHi: "Jab kaam aisa feel hota hai, woh sirf kaam tak nahi rehta.",                                                templateTa: "Velai ippadi feel aagum-bOdhu, adhu velai-la mattum nirkaadhu." },
  { signalMatch: ["academic_context"],      template: "Academic pressure creates its own particular weight.",                     templateHi: "Padhai ka pressure apna ek alag bojh hota hai.",                                                            templateTa: "Padippu azhattham sonthamana oru baaram vaitthirukku." },
  { signalMatch: ["emotional_pain"],        template: "I hear that. That matters.",                                               templateHi: "Suna. Yeh important hai.",                        templateTe: "Vinnanu. Idi important.",                templateTa: "Kettaen. Adhu mukkiyam." },
  { signalMatch: ["help_seeking"],          template: "The fact that you're here exploring this — that means something.",         templateHi: "Tum yahan ho, yeh explore kar rahe ho — yeh apne aap mein kuch kehta hai.", templateTe: "Meeru ikkade undi explore chestaaru — idhi kuda oka ardam.", templateTa: "Neenga inga vandu explore panreenga — adhu ondrE oru arttham." },
  { signalMatch: ["dissociation_signal"],   template: "That feeling of disconnection is worth paying attention to.",              templateHi: "Disconnect feel karna — isko seriously lena chahiye.",                                                     templateTa: "Aa disconnect feel-ai kavanamaga paakka vendum." },
  { signalMatch: [],                        template: "I hear you.",                                                               templateHi: "Suna.",                                           templateTe: "Vinnanu.",                               templateTa: "Kettaen." },
];

function buildBridge(signals: string[], lang: Language = "en"): ConversationBlock {
  const match = BRIDGE_TEMPLATES
    .filter(b => b.signalMatch.length > 0)
    .find(b => b.signalMatch.some(s => signals.includes(s)))
    ?? BRIDGE_TEMPLATES[BRIDGE_TEMPLATES.length - 1];

  let content = match.template;
  if ((lang === "hi" || lang === "hi_en") && match.templateHi) content = match.templateHi;
  if ((lang === "te" || lang === "te_en") && match.templateTe) content = match.templateTe;
  if (lang === "ta" && match.templateTa) content = match.templateTa;

  return {
    id: `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "bridge",
    content,
    emotionalTone: "gentle",
    signalMappings: match.signalMatch,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// QUESTION LIBRARY — simplified, voice-ready, multilingual
// ════════════════════════════════════════════════════════════════════════════
interface QuestionBlock {
  id: string;
  state: RuntimeState;
  concernFamilies: string[];
  content: string;
  contentHi?: string;
  contentTe?: string;
  contentTa?: string;
  options?: string[];
  optionsHi?: string[];
  optionsTe?: string[];
  optionsTa?: string[];
  responseType: ResponseType;
}

const ALL_FAMILIES = [
  "academic","occupational","general","social","emotional","cognitive",
  "professional","motivational","identity","digital","physiological","relational",
];

const QUESTION_LIBRARY: QuestionBlock[] = [
  // concern_recognition
  // concern_recognition — STRUCTURED NARROWING (what feels hardest, not emotional reflection)
  {
    id: "q_cr_acad", state: "concern_recognition", concernFamilies: ["academic"],
    content: "When you say you're struggling with this, what feels hardest right now?",
    contentHi: "Jab tum kehte ho struggling kar rahe ho, abhi sabse mushkil kya lag raha hai?",
    contentTe: "Idi struggle chestunaanu antunnappudu, ippudu chaalaa kashtam ga feel avutundi?",
    contentTa: "Idha poi struggle-a irukku endra solla, ippo enna miga-vum kastam-a irukkudhu?",
    options: ["Can't focus or concentrate", "Fear of failing", "Feeling behind everyone else", "Too much to handle at once", "Lost motivation completely", "Don't know where to start"],
    optionsHi: ["Focus nahi ho raha", "Fail hone ka darr", "Sabse peeche lag raha hoon", "Ek saath bahut zyada", "Motivation bilkul nahi rahi", "Shuru kahan se karoon pata nahi"],
    optionsTe: ["Focus cheyyataamu kashtam", "Fail ayye bhayam", "Andhariki behind ga feel avutundi", "Oka saari chaalaa undi", "Motivation pooyindi", "Ekkadunchi start cheyyaalo theliyatam ledu"],
    optionsTa: ["Focus panna mudiyadhu", "Fail aagudhumo-nu bayam", "Ellorum mundhe irukkaaanga-nu feel", "Eka nerathil romba aagidum", "Motivation poachu", "Enga thoda-nguvadhu-nu theriyaadhu"],
    responseType: "chips",
  },
  {
    id: "q_cr_pro", state: "concern_recognition", concernFamilies: ["professional", "occupational"],
    content: "When you say you feel this way, what feels hardest right now?",
    contentHi: "Jab tum yeh feel karte ho, abhi sabse mushkil kya lag raha hai?",
    contentTe: "Ee feel avutunnappudu, ippudu chaalaa kashtam ga feel avutundi?",
    contentTa: "Idha feel aagudhu-nu solra, ippo enna miga-vum kastam-a irukkudhu?",
    options: ["Not growing or moving forward", "Feeling unseen or unnoticed", "Losing confidence in myself", "Financial pressure", "No clear direction", "Mentally and emotionally exhausted"],
    optionsHi: ["Aage nahi badh raha", "Koi dekh nahi raha", "Khud pe yakeen kho raha hai", "Paison ka pressure", "Direction nahi hai", "Mentally aur emotionally thaka hua"],
    optionsTe: ["Grow kaatam ledu", "Konni choodatam ledu", "Naa meeda confidence poyindi", "Financial pressure", "Clear direction ledu", "Mentally mattu emotionally exhausted"],
    optionsTa: ["Munnadi pogala", "Yaarum kaval pata maattaanga", "En meela confidence poachu", "Panam pressure", "Direction theriyaadhu", "Mentally-um emotionally-um exhausted"],
    responseType: "chips",
  },
  {
    id: "q_cr_gen", state: "concern_recognition", concernFamilies: ALL_FAMILIES,
    content: "What feels hardest about what you're carrying right now?",
    contentHi: "Jo tum le chal rahe ho, usme abhi sabse mushkil kya lag raha hai?",
    contentTe: "Meeru carry chestaandu daanilo ippudu chaalaa kashtam ga feel avutundi?",
    contentTa: "Neenga thanga irukkiradhu-la ippo enna miga-vum kastam-a irukkudhu?",
    options: ["It's emotionally draining", "Affecting my confidence", "Feeling stuck with no way out", "Can't see a way forward", "Affecting my relationships", "Feels very lonely"],
    optionsHi: ["Emotionally thaka deta hai", "Confidence pe asar hai", "Atak gaya hoon", "Raasta nahi dikh raha", "Relationships pe asar", "Bahut akela lagta hai"],
    optionsTe: ["Emotionally tire chestuundi", "Confidence affect avutundi", "Stuck feel avutundi", "Munduku choodalekutunaanu", "Relationships affect avutundi", "Chaalaa lonely ga undi"],
    optionsTa: ["Emotionally drain aagudhu", "En confidence-a affect panudhu", "Stuck-a feel aagudhu", "Vali illai-nu theriyaadhu", "Relations-a affect panudhu", "Romba lonely-a feel aagudhu"],
    responseType: "chips",
  },

  // reflective_exploration — TIMELINE (when did this get harder — genuinely different dimension from "what's hardest")
  {
    id: "q_re_acad", state: "reflective_exploration", concernFamilies: ["academic"],
    content: "When did this start feeling harder than usual — was there a turning point?",
    contentHi: "Yeh pehle se zyada mushkil kab se lagne laga — koi turning point tha?",
    contentTe: "Idi mundukante kashtamga feel avataamu eppati nundi — oka turning point undaa?",
    contentTa: "Idhu munnaai-vida kasht-am-a feel aaga eppa thoudangichu — oru turning point irundhadha?",
    options: ["It's been building gradually over months", "Something specific happened that triggered it", "It got worse around exam season", "It's been this way for as long as I remember", "It came on suddenly and recently", "Certain situations make it much worse"],
    optionsHi: ["Dheere dheere mahino se badh raha tha", "Koi specific cheez hui jisse shuru hua", "Exams ke time pe zyada ho gaya", "Jab se yaad hai tab se hai", "Haal hi mein achanak aaya", "Kuch situations mein bahut bhadh jaata hai"],
    optionsTe: ["Nelalu ga nidhaanam ga build ayyindi", "Specific emi jarigindi trigger ga", "Exam season lo worse ayyindi", "Gurtu unna nundi ila undi", "Recently suddengaa vasthundi", "Konkha situations lo chaala worse avutundi"],
    optionsTa: ["Maadham-maadham meellama build aagudhu", "Oru specific vishayam trigger-aa nadandhadhu", "Exam kaalam-la worse aagudhu", "Ninaivu irukkaadhu varai ippadi irukkudhu", "Recently tidirennu vasthirukkudhu", "Sila situations-la romba worse aagudhu"],
    responseType: "chips",
  },
  {
    id: "q_re_occ", state: "reflective_exploration", concernFamilies: ["occupational", "professional"],
    content: "When did this start to feel like more than just a difficult phase?",
    contentHi: "Yeh sirf ek mushkil phase se zyada kab lagne laga?",
    contentTe: "Idi sirf oka kashtamaina phase kante different ga feel avataamu eppati nundi?",
    contentTa: "Idhu just oru kashtam-ana phase-ai vida different-a feel aaga eppa thoudangichu?",
    options: ["When I realised I'm not growing anymore", "After a specific event or change at work", "When I stopped looking forward to things", "It's been building slowly for a long time", "When I started dreading going in", "When I noticed I'd stopped caring"],
    optionsHi: ["Jab realize kiya ki grow nahi ho raha", "Koi specific event ya badlaav ke baad", "Jab cheezein interesting nahi lagi", "Dheere dheere kaafi time se chal raha hai", "Jab jaana darne laga", "Jab parwah karna band ho gayi"],
    optionsTe: ["Mundu kante kam motivated", "Work lo inka zyada anxious", "Kొంత responsibilities avoid chestunaanu", "Focus cheyataamu kashtam", "Team nundi disconnect feel", "Physically mattu mentally exhausted"],
    optionsTa: ["Munnaadi-vida motivation illai", "Velai-la innum anxiety-va irukkudhu", "Sila pongaal-a avoid panraen", "Focus panna mudiyadhu", "Team-la irundu disconnect feel", "Udambu-um manam-um exhausted"],
    responseType: "chips",
  },
  {
    id: "q_re_gen", state: "reflective_exploration", concernFamilies: ALL_FAMILIES,
    content: "When did this start feeling harder than usual — was there a turning point?",
    contentHi: "Yeh pehle se zyada mushkil kab se laga — koi turning point tha?",
    contentTe: "Idi eppati nundi kashtamga feel avataamu — oka turning point undaa?",
    contentTa: "Idhu eppa kasht-am-a feel aaga thoudangichu — oru turning point irundhadha?",
    options: ["Something specific shifted recently", "It's been gradually building for a while", "I've felt this way for as long as I can remember", "It got noticeably worse around a particular event", "It comes and goes but always returns", "Hard to say exactly when"],
    optionsHi: ["Haal hi mein kuch specific badla", "Dheere dheere kafi samay se badh raha hai", "Jab se yaad hai tab se hai", "Kisi ghathna ke aaspaas badh gaya", "Aata jaata hai par waapas aata hai", "Theek se nahi pata kab"],
    optionsTe: ["Recently specific emi maripoyindi", "Koddikaalanga nidhaanam ga build avutundi", "Gurtu unna nundi ila undi", "Particular event aaspaas worse ayyindi", "Vasthundi pothundi kaani theestundi", "Sarini cheppataamu kashtam"],
    optionsTa: ["Recently specific enna-vo marindhudhu", "Konjam kaalam-aay meellama build aagudhu", "Ninaivu irukkaadhu varai ippadi irukkudhu", "Oru specific event samayadhil worse aagudhu", "Varudhum pogudhum aana thirumbi varudhum", "Exactly eppa-nu solla kasht-am"],
    responseType: "chips",
  },

  // severity_mapping — NATURE/CHARACTER (what does this feel like — different dimension from timeline)
  {
    id: "q_sm_01", state: "severity_mapping", concernFamilies: ALL_FAMILIES,
    content: "Does this feel more like exhaustion, pressure from outside, something you can't quiet mentally, or something harder to name?",
    contentHi: "Yeh zyada kaisi feel hoti hai — thakan, bahari pressure, dimaag ko shaant na kar paana, ya kuch aur?",
    contentTe: "Idi ela feel avutundi — exhaustion, bahari pressure, mental ga settle kaakupovadam, ya inkemi?",
    contentTa: "Idhu epadi feel aagudhu — exhaustion, puratthu pressure, mental-a settle aaga mudiyadhu, illai vera enna-vo?",
    options: ["More like deep exhaustion — I'm depleted", "More like pressure coming from outside me", "More like I can't settle or quiet my mind", "More like something is missing or lost", "More like fear or dread underneath it all", "It shifts — hard to pin down one thing"],
    optionsHi: ["Gehri thakan jaisi — khaali ho gaya hoon", "Bahari pressure jaisi", "Dimag ko shaant nahi kar paa raha", "Kuch kho gaya sa lag raha hai", "Andar se darr ya bojh hai", "Badalta rehta hai — ek cheez nahi"],
    optionsTe: ["Gehri exhaustion — depleted ga", "Bahari pressure la feel avutundi", "Mind ni settle cheyyataamu kashtam", "Emi missing la feel avutundi", "Andar fear ya dread undi", "Shifts avutundi — oka daanni cheppadam kashtam"],
    optionsTa: ["Azhama exhaustion — vaettukkaattu-pachen", "Puratthu pressure maadiri", "Mana-su settle aaga mudiyaadhu", "Enna-vo missing maadiri feel aagudhu", "Ullae bayam illa pakkam irukkudhu", "Maari maari varudhum — oru vishayam illai"],
    responseType: "chips",
  },

  // emotional_contextualization — TRIGGERS (what brings it on — different dimension from nature of the feeling)
  {
    id: "q_ec_01", state: "emotional_contextualization", concernFamilies: ALL_FAMILIES,
    content: "Is there a pattern to when it gets worse — specific situations, people, or times?",
    contentHi: "Kya koi pattern hai jab yeh zyada hota hai — koi khaas situation, log, ya waqt?",
    contentTe: "Idi worse avvadam lo oka pattern undaa — specific situations, people, ya times?",
    contentTa: "Idhu worse aagum-poadhu oru pattern irukka — specific situations, manidhar-gal, illai neram?",
    options: ["When I'm being evaluated or watched", "Around specific people or in certain places", "When I think about the future", "At certain times — mornings, nights, weekends", "Without any obvious trigger — it just is", "When I try harder or push myself"],
    optionsHi: ["Jab evaluate ya observe ho raha hoon", "Specific log ya jagah ke paas", "Future sochne par", "Khaas waqt pe — subah, raat, weekend", "Koi clear trigger nahi — bas rehta hai", "Jab zyada koshish karta hoon"],
    optionsTe: ["Evaluate ya choodabadutunnappudu", "Specific people ya environments daggara", "Future gurinchi alochistunte", "Certain times — mornings, nights, weekends", "Obvious trigger ledu — undi anthe", "Inka effort chestunte ya push chestunte"],
    optionsTa: ["Evaluate pannappudu illa paakka-pattappudu", "Specific manidhar-gal illa idangal-la", "Bhavidam pathi ninaikkum-poadhu", "Certain times — kaalai, ira-vu, weekend", "Obvious trigger illai — just irukkudhu", "Innum try pannum-poadhu illa push pannappudu"],
    responseType: "chips",
  },

  // behavioural_mapping — COPING RESPONSE (how you respond — different from what triggers it)
  {
    id: "q_bm_01", state: "behavioural_mapping", concernFamilies: ALL_FAMILIES,
    content: "When it shows up, what does your honest reaction usually look like?",
    contentHi: "Jab yeh aata hai, tumhari sacchi reaction kya hoti hai?",
    contentTe: "Idi vastunte, meeru nijamga ela react avutaaru?",
    contentTa: "Idhu varum-poadhu, unga honest reaction epadi irukkudhu?",
    options: ["I push through and try harder anyway", "I avoid or put things off", "I distract myself with something else", "I shut down or withdraw from people", "I try to act normal and hide it", "I go back and forth between pushing and giving up"],
    optionsHi: ["Phir bhi push karta hoon aur zyada try karta hoon", "Avoid karta hoon ya baar baar delay karta hoon", "Kuch aur karne lagg jaata hoon", "Band ho jaata hoon ya logo se door ho jaata hoon", "Normal dikhne ki koshish karta hoon", "Zyada try aur phir give up ke beech rehta hoon"],
    optionsTe: ["Phir bhi push chestanu inka zyada try chestanu", "Avoid chestanu ya pani baar baar delay chestanu", "Emi inkedi cheyyadam start chestanu", "Shut down avutanu ya andarinundi withdraw avutanu", "Normal ga act cheyyataniki try chestanu", "Chala try chesi give up avutunu"],
    optionsTa: ["Phir-um push panraen, innum try panraen", "Avoid panraen illa pona pona delay panraen", "Vera enna-vo pannuven", "Shut down aagidhuven illa vilakki koLLuven", "Normal-a nadikka try panraen", "Romba try panraen appuram give up aagiduven"],
    responseType: "chips",
  },

  // pattern_emergence — PATTERN RECOGNITION (does this feel familiar — different from how you respond)
  {
    id: "q_pe_01", state: "pattern_emergence", concernFamilies: ALL_FAMILIES,
    content: "Does any part of this feel familiar — like you've been here before, even if the situation was different?",
    contentHi: "Kya yeh kuch jaana-pahchaana lagta hai — jaise pehle bhi kuch aisa feel kiya ho, chahe haalat alag thi?",
    contentTe: "Ee feel lo emi familiar ga anipistundaa — situation different ayinaa kuda, idi mundu kuda experience chesaanaa?",
    contentTa: "Idhula enna-va familiar-a feel aagudha — situation different-a irundhalum, munnaadi-um ippadi irundha maadiri?",
    options: ["Yes — this keeps coming back in different forms", "It feels related to something older", "I've pushed through something similar before", "This feels new and unfamiliar", "Parts of it feel familiar, but not all", "I'm not sure"],
    optionsHi: ["Haan — yeh alag alag roop mein waapas aata rehta hai", "Kisi purani cheez se related lagta hai", "Pehle bhi aisi cheez se guzra hoon", "Yeh naya lagta hai", "Kuch familiar lagta hai, sab nahi", "Nahi pata"],
    optionsTe: ["Avunu — idi different forms lo thirigithigosthundi", "Emi paatha daanitho related ga anipistundi", "Idi maadiri daaninchi mundu kuda push chesaanu", "Idi naaki new ga anipistundi", "Konthanga familiar ga undi, antha kadu", "Teliyatam ledu"],
    optionsTa: ["Aama — idhu different forms-la thirumbi thirumbi varudhum", "Enna-va pazhayadhutho relate aagudhu", "Munnaadi-um ippadi push pannen", "Idhu puthu-a feel aagudhu", "Konjam familiar, ellaam illai", "Theriyaadhu"],
    responseType: "chips",
  },

  // behavioural_synthesis — VALIDATION CHECK (does this feel accurate — collaborative not declarative)
  {
    id: "q_bs_01", state: "behavioural_synthesis", concernFamilies: ALL_FAMILIES,
    content: "Does what I've reflected back feel close to your experience, or is something missing from that picture?",
    contentHi: "Jo maine reflect kiya — kya woh tumhare experience ke karib hai, ya kuch chhoot raha hai?",
    contentTe: "Nenu reflect chesindi meeru experience ki close ga untundaa, ya emi missing ga undaa?",
    contentTa: "Naan reflect pannidhu unga experience-ku close-a irukkudha, illa enna-va miss aagudha?",
    options: ["Yes, that feels very accurate", "Mostly — one part doesn't quite fit", "Partially — there's something else I haven't said", "Not really — it feels different to me"],
    optionsHi: ["Haan, yeh bilkul sahi lagta hai", "Zyada tar — ek hissa fit nahi hota", "Thoda — kuch aur bhi hai jo kaha nahi", "Nahi — mujhe alag lagta hai"],
    optionsTe: ["Avunu, chaala accurate ga undi", "Mostly — oka bhagam fit kaadu", "Koddiga — cheppani inka emi undi", "Kadu — naaku different ga anipistundi"],
    optionsTa: ["Aama, adhu romba accurate-a irukkudhu", "Mostly — oru part fit aaga maattudhu", "Konjam — solla-adha enna-va undi", "Illai — ennakku different-a feel aagudhu"],
    responseType: "chips",
  },

  // reassurance — INTENTIONALITY (what would feel most useful — collaborative, not interrogating)
  {
    id: "q_ra_01", state: "reassurance", concernFamilies: ALL_FAMILIES,
    content: "What would feel most useful to understand from here?",
    contentHi: "Yahan se aage kya samajhna sabse zyada useful lagega?",
    contentTe: "Ikkadi nundi emi artham chesukodaniki most useful ga anipistundi?",
    contentTa: "Ingirundhu enna purinjukkaradhu most useful-a feel aagum?",
    options: ["Why this pattern keeps returning", "Knowing I'm not alone in experiencing this", "Finding a practical way to manage it daily", "Having a clearer picture of what's underneath"],
    optionsHi: ["Yeh pattern kyun baar baar aata hai", "Yeh jaanna ki dusre bhi aisa feel karte hain", "Roz isko manage karne ka practical tarika", "Jo neeche chal raha hai woh aur clear karna"],
    optionsTe: ["Ee pattern thirigithirigostunte karana", "Idi experience chestuanna vaallaku teliyyadam", "Daily manage cheyyataniki practical tarika", "Kelaindi emi undoo mori clear ga telusukodaniki"],
    optionsTa: ["Ee pattern thirupi thirumbi varudhukku karanam", "Innum palar ippadi feel paakkaanga-nu therinjukka", "Naal-num manage panna practical vazhi", "Ullae enna irukkudhu-nu clear-a purinja"],
    responseType: "chips",
  },

  // clarity_generation — DIRECTION (what feels most true to where you want to get to)
  {
    id: "q_cg_01", state: "clarity_generation", concernFamilies: ALL_FAMILIES,
    content: "Of these, what feels most true to where you want to get to?",
    contentHi: "Inme se kaunsa sabse sach lagta hai jaahan tum pahunchna chahte ho?",
    contentTe: "Veetiloo, meeru cheradam cheppina chotu ki truth ga feel avutundi?",
    contentTa: "Ivangle-la, neenga poaga viruppadha idatthukkku most true-a feel aagudhu?",
    options: ["Building a recovery strategy step by step", "Understanding what's actually driving this", "Creating habits that don't require willpower", "One clear first step I can take this week"],
    optionsHi: ["Dheere dheere recovery strategy banana", "Jo aslaan mein chal raha hai woh samajhna", "Aise aadat banana jo willpower pe depend na kare", "Ek clear pehla kadam jo is hafte le sakta hoon"],
    optionsTe: ["Step by step recovery strategy build cheyyataamu", "Idi nijijamga enti drive chestaundo artham chesukodaniki", "Willpower require kaani habits create cheyyataamu", "Ee vaaram teesukodam ki oka clear first step"],
    optionsTa: ["Step by step recovery strategy build panna", "Idha actually enna drive panudhu-nu purinja", "Willpower venaam-na habits create panna", "Ee vaaram edutthu vekka koodiya oru clear first step"],
    responseType: "chips",
  },

  // growth_transition — ASPIRATION (what would you want back — different from direction)
  {
    id: "q_gt_01", state: "growth_transition", concernFamilies: ALL_FAMILIES,
    content: "If this lifted — even partially — what would you most want back first?",
    contentHi: "Agar yeh thoda bhi halka ho jaye — tum sabse pehle kya waapas chahoge?",
    contentTe: "Idi koddiga kuda lift ayyite — meeru sabse mundu enti waapas kavaalani undi?",
    contentTa: "Idhu konjam-aagilum lift aagidha — muthal eththa vittu vanga viruppadhu enna?",
    options: ["The ability to focus without fighting myself", "Feeling emotionally lighter", "My confidence in my own judgement", "Connection with people around me", "A sense of direction and purpose", "The energy to actually start things"],
    optionsHi: ["Khud se lad ke focus karne ki zaroorat na pade", "Emotionally halka feel karna", "Apne judgement pe yakeen", "Aaspaas ke logon se connection", "Direction aur purpose ka ehsaas", "Cheezein shuru karne ki energy"],
    optionsTe: ["Naa tho poraadakunda focus cheyyagalugudaamu", "Emotionally lighter feel avataamu", "Naa nirnayaalu meeda confidence", "Aaspaas unnavaritho connection", "Direction aur purpose feel avataamu", "Panulu start cheyyataniki energy"],
    optionsTa: ["En-pakkame poraadaama focus panna", "Emotionally light-a feel aaga", "En sondha theermaana-la confidence", "Arugilirukkavarukku connection", "Disha-um purpose-um feel aaga", "Enna-vum thodanga energy"],
    responseType: "chips",
  },

  // progression_reflection — INTEGRATION (what feels most true from the conversation)
  {
    id: "q_pr_01", state: "progression_reflection", concernFamilies: ALL_FAMILIES,
    content: "Take a moment — what feels most true to you from this conversation?",
    contentHi: "Ek pal lo — is conversation mein kya sabse sach laga tumhe?",
    contentTe: "Oka moment teesukondi — ee conversation lo meeku most true ga feel ainadi enti?",
    contentTa: "Oru nerram — ee conversation-la uungalukku most true-a feel aana-dhu enna?",
    options: ["I understand something I didn't before", "I can see a starting point now", "This is still a lot to sit with", "I'm ready to go deeper into this"],
    optionsHi: ["Kuch aise samajha jo pehle nahi samjha tha", "Ab ek starting point dikh raha hai", "Abhi bhi bahut kuch sochne wala hai", "Aur gehraai mein jaane ke liye taiyar hoon"],
    optionsTe: ["Mundu telisthundi leni emi telisindi", "Oka starting point ippudu kaanistuundi", "Idi inka chaala process cheyyaali", "Mori deep ga vellataniki ready ga unnaanu"],
    optionsTa: ["Munnaadi theriyaadha enna-va therinjukken", "Ippo oru starting point kanikkiradhu", "Idhu innum process panna chaala irukkudhu", "Ingai innum azhama poga ready-a irukkEn"],
    responseType: "chips",
  },
];

function getQuestion(state: RuntimeState, concernFamily: string): QuestionBlock | null {
  // Look for a concern-specific question first (not one that covers ALL_FAMILIES)
  const specific = QUESTION_LIBRARY.find(
    q => q.state === state &&
         q.concernFamilies.includes(concernFamily) &&
         q.concernFamilies.length < ALL_FAMILIES.length
  );
  if (specific) return specific;
  // Fall back to general question (ALL_FAMILIES or first matching state)
  const general = QUESTION_LIBRARY.find(
    q => q.state === state && q.concernFamilies.length >= ALL_FAMILIES.length
  );
  if (general) return general;
  return QUESTION_LIBRARY.find(q => q.state === state) ?? null;
}

function getQuestionContent(q: QuestionBlock, lang: Language): string {
  if ((lang === "hi" || lang === "hi_en") && q.contentHi) return q.contentHi;
  if ((lang === "te" || lang === "te_en") && q.contentTe) return q.contentTe;
  if (lang === "ta" && q.contentTa) return q.contentTa;
  return q.content;
}

function getQuestionOptions(q: QuestionBlock, lang: Language): string[] | undefined {
  if ((lang === "hi" || lang === "hi_en") && q.optionsHi) return q.optionsHi;
  if ((lang === "te" || lang === "te_en") && q.optionsTe) return q.optionsTe;
  if (lang === "ta" && q.optionsTa) return q.optionsTa;
  return q.options;
}

// ════════════════════════════════════════════════════════════════════════════
// PATTERN DETECTION ENGINE WITH EXPLAINABILITY
// ════════════════════════════════════════════════════════════════════════════
interface BehaviouralRule {
  id: string;
  requiredSignals: string[];
  threshold: number;
  pattern: string;
  label: string;
  description: string;
  confidence: number;
  intensity: "low" | "moderate" | "high";
  detectionBasis: string[];
}

const PATTERN_RULES: BehaviouralRule[] = [
  {
    id: "pr_001", requiredSignals: ["emotional_overwhelm", "cognitive_blocking"],
    threshold: 2, pattern: "performance_anxiety_loop",
    label: "Performance Anxiety Loop",
    description: "Emotional pressure is triggering a cognitive freeze — the weight of being evaluated is temporarily blocking access to what you actually know.",
    confidence: 0.84, intensity: "high",
    detectionBasis: ["Emotional overwhelm present", "Cognitive blocking reported", "Evaluation context active"],
  },
  {
    id: "pr_002", requiredSignals: ["fatigue", "recovery_deficiency"],
    threshold: 2, pattern: "burnout_escalation",
    label: "Burnout Escalation Pattern",
    description: "Your emotional, cognitive, and physical reserves have been gradually depleting — the recovery cycle hasn't been keeping up.",
    confidence: 0.81, intensity: "high",
    detectionBasis: ["Sustained fatigue detected", "Recovery deficit identified", "Depletion signals present"],
  },
  {
    id: "pr_003", requiredSignals: ["attention_fragmentation", "focus_difficulty"],
    threshold: 2, pattern: "attention_fragmentation_loop",
    label: "Attention Fragmentation Loop",
    description: "Difficulty focusing seems to be making itself worse — distraction leads to self-criticism, which makes it harder to re-engage.",
    confidence: 0.77, intensity: "moderate",
    detectionBasis: ["Attention fragmentation detected", "Focus difficulty reported", "Frustration-distraction cycle active"],
  },
  {
    id: "pr_004", requiredSignals: ["evaluation_fear", "shame_avoidance"],
    threshold: 2, pattern: "shame_avoidance_cycle",
    label: "Shame-Avoidance Cycle",
    description: "Anticipatory shame is driving avoidance — it brings short-term relief but keeps the underlying fear in place.",
    confidence: 0.79, intensity: "high",
    detectionBasis: ["Evaluation fear active", "Shame-avoidance pattern present", "Behavioural avoidance detected"],
  },
  {
    id: "pr_005", requiredSignals: ["absolutist_thinking", "helplessness"],
    threshold: 2, pattern: "cognitive_rigidity_pattern",
    label: "Cognitive Rigidity Pattern",
    description: "All-or-nothing thinking is creating a frame where partial progress feels like failure — making it hard to keep going.",
    confidence: 0.73, intensity: "moderate",
    detectionBasis: ["Absolutist language detected", "Learned helplessness present", "Progress-negation pattern active"],
  },
  {
    id: "pr_006", requiredSignals: ["performance_pressure", "negative_self_narrative"],
    threshold: 2, pattern: "inner_critic_loop",
    label: "Inner Critic Escalation",
    description: "External pressure is amplifying the inner critic — effort is increasing self-scrutiny rather than reducing it.",
    confidence: 0.76, intensity: "moderate",
    detectionBasis: ["External performance pressure detected", "Negative self-narrative active", "Self-scrutiny escalation loop identified"],
  },
  {
    id: "pr_007", requiredSignals: ["chronic_duration", "learned_helplessness"],
    threshold: 2, pattern: "entrenched_pattern",
    label: "Entrenched Behavioural Pattern",
    description: "A pattern this long-standing has developed its own internal logic — it's become a default setting, not just a response.",
    confidence: 0.71, intensity: "moderate",
    detectionBasis: ["Chronic duration confirmed", "Learned helplessness present", "Pattern entrenchment indicators active"],
  },
  {
    id: "pr_008", requiredSignals: ["suppression", "social_withdrawal"],
    threshold: 2, pattern: "isolation_suppression_cycle",
    label: "Isolation-Suppression Cycle",
    description: "Withdrawing while suppressing emotional signals creates a reinforcing loop — the less you express, the more internal pressure builds.",
    confidence: 0.74, intensity: "moderate",
    detectionBasis: ["Emotional suppression active", "Social withdrawal present", "Isolation reinforcement cycle detected"],
  },
  {
    id: "pr_009", requiredSignals: ["recovery_deficiency", "avoidant_persistence"],
    threshold: 2, pattern: "momentum_collapse",
    label: "Momentum Collapse Pattern",
    description: "Pushing through while depleted is accelerating the depletion — what looks like persistence is preventing the recovery you need.",
    confidence: 0.78, intensity: "high",
    detectionBasis: ["Recovery deficit detected", "Push-through persistence identified", "Depletion-persistence loop active"],
  },
  {
    id: "pr_010", requiredSignals: ["fear_signal", "academic_context"],
    threshold: 2, pattern: "evaluation_identity_threat",
    label: "Evaluation-Identity Threat",
    description: "Assessment results may have become tied to self-worth — making every test feel like a verdict on who you are, not just what you know.",
    confidence: 0.80, intensity: "high",
    detectionBasis: ["Fear signal present in academic context", "Identity-evaluation fusion detected", "Self-worth-outcome coupling active"],
  },
  {
    id: "pr_011", requiredSignals: ["emotional_pain", "helplessness"],
    threshold: 2, pattern: "hopelessness_drift",
    label: "Hopelessness Drift",
    description: "Emotional pain combined with feeling stuck can create a drift toward hopelessness — where positive change starts to feel impossible.",
    confidence: 0.72, intensity: "high",
    detectionBasis: ["Emotional pain present", "Helplessness signals active", "Hopelessness drift indicators detected"],
  },
];

function detectPatterns(signals: string[], turnCount: number = 0): DetectedPattern[] {
  // Minimum threshold: require at least 5 turns and 5 signals to avoid premature categorisation
  if (turnCount < 5 || signals.length < 5) return [];
  return PATTERN_RULES
    .filter(rule => rule.requiredSignals.filter(s => signals.includes(s)).length >= rule.threshold)
    .map(rule => ({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      confidence: rule.confidence,
      signals: rule.requiredSignals,
      category: "pattern" as const,
      intensity: rule.intensity,
      detection_basis: rule.detectionBasis,
    }));
}

// ════════════════════════════════════════════════════════════════════════════
// PACING ENGINE
// ════════════════════════════════════════════════════════════════════════════
function computePacing(signals: string[], emotionalWeight: number) {
  if (emotionalWeight >= 4 || signals.includes("shame_signal")) {
    return { speed: "slow" as PacingSpeed, delayMs: 1400 };
  }
  if (emotionalWeight >= 2 || signals.includes("fatigue")) {
    return { speed: "slow" as PacingSpeed, delayMs: 1100 };
  }
  return { speed: "medium" as PacingSpeed, delayMs: 750 };
}

// ════════════════════════════════════════════════════════════════════════════
// SAFETY MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════
const SAFETY_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bYou (have|are) ([a-z\s]+)\b/g, replacement: "You may be experiencing $2" },
  { pattern: /\bThis is a diagnosis\b/gi,        replacement: "This is an observation" },
  { pattern: /\bdisorder\b/gi,                   replacement: "pattern" },
  { pattern: /\bsuffering from\b/gi,             replacement: "experiencing" },
  { pattern: /\bdiagnosed with\b/gi,             replacement: "experiencing patterns consistent with" },
];

function applySafety(text: string): string {
  let s = text;
  for (const { pattern, replacement } of SAFETY_RULES) s = s.replace(pattern, replacement);
  return s;
}

// ════════════════════════════════════════════════════════════════════════════
// SYNTHESIS NARRATIVE — short, human, natural
// ════════════════════════════════════════════════════════════════════════════
const SYNTHESIS_NARRATIVE: Record<string, { en: string; hi: string; te: string; ta: string }> = {
  academic:     { en: "It sounds like being evaluated has started to feel personal — like it's measuring you, not just your knowledge.", hi: "Lagta hai evaluate hona personal feel hone laga hai — jaise tum measure ho rahe ho, sirf knowledge nahi.", te: "Evaluate avataniki personal ga feel avutundi — knowledge kadu, meeru measure avutunnaarani anipistundi.", ta: "Evaluate aavadhu personal-a feel aagudhu — knowledge mattum illa, neenga measure aavadhu maadiri irukku." },
  occupational: { en: "What you're going through sounds like a gradual depletion — not weakness, just a system that's been giving more than it gets back.", hi: "Yeh ek dheemi thakan hai — tumhari kami nahi, bas ek system jo deta zyada hai, pata zyada kam.", te: "Idi maandamaina depletion — meeru weakness kadu, ichche system endukoo return raavadam ledu.", ta: "Idhu maellama depletion aagudhu — weakness illai, kudukura system thirumba edhaiyum peravillai." },
  cognitive:    { en: "Your attention system is under real strain — not from lack of effort, but from an environment that makes focus genuinely difficult.", hi: "Tumhara focus genuinely mushkil hai — effort ki kami nahi, environment hi aisa hai.", te: "Meeru attention system nijamga strain lo undi — effort ledu ante kadu, environment ee la chesindi.", ta: "Unga attention system nijamgave strain-la irukku — effort illai-nu illai, environment-e adha kasht-paduthu." },
  social:       { en: "What you've built is a finely tuned system of self-protection in social situations. It made sense once — it's just costly now.", hi: "Logon ke beech ek protection system ban gaya hai — kabhi zaruri tha, ab sirf thaka deta hai.", te: "Social situations lo oka protection system tayariyindi — okappudu adhi avasaramai undi, ippudu costly ga avutundi.", ta: "Social situations-la oru protection system katti vecchunga — onnu kaalam avasi-yam irundhadhu, ippo costly aagudhu." },
  professional: { en: "It sounds like who you are professionally no longer matches where you currently are — and that gap creates a quiet, persistent friction.", hi: "Jo tum ho professionally, aur jahan ho abhi — dono match nahi karte. Yeh gap dheere dheere takleef deta hai.", te: "Meeru professionally evarante, ee moment lo unna chotu — rendum match avataamu ledu. Aa gap quiet ga kashtam istundi.", ta: "Neenga professionally eppadi irukeenga, ippo irukka idathu — rendom match aagala. Aa gap meellam kashtam tharudhu." },
  emotional:    { en: "The pattern seems to be one of emotional activation that's developed its own momentum — responses that feel bigger than the situation.", hi: "Emotional reactions apni ek momentum le chuki hain — response situation se bada feel hone lagta hai.", te: "Emotional activation ku swantham momentum vasthundi — response situation kanna pedda feel avutundi.", ta: "Emotional activation-ku sontham momentum varudhu — response situation-ai vida periya-va feel aagudhu." },
  motivational: { en: "The part of you that wants to move forward and the part that can't seem to start — they've become disconnected.", hi: "Woh hissa jo aage jaana chahta hai, aur woh hissa jo shuru nahi kar paa raha — dono ka connection toot gaya hai.", te: "Munduku vellalani undey vaaadu, start cheyyaleni vaaadu — rendu disconnect ayyaaru.", ta: "Munnadi poga viruppadhu, start panna mudiyaadhadhu — rendu disconnect aagittaanga." },
  identity:     { en: "The inner critic shaping how you see yourself is working from old evidence — it doesn't quite reflect who you are now.", hi: "Andar ka critic jo tumhare baare mein bolta hai, woh purani baatein hai — tum ab waise nahi raha.", te: "Meeru gurinchi judge chese inner critic paatha evidence use chestaadu — meeru ippudu ala leeru.", ta: "Unnanga pathi judge panna inner critic pazhaya evidence use panradhu — neenga ippo adha maadiri illai." },
  digital:      { en: "Your screen use has taken on an emotional job — it's filling something or avoiding something. That's worth understanding.", hi: "Screen ka istemal ek emotional kaam kar raha hai — kuch bharna ya kuch avoid karna. Yeh samajhna zaruri hai.", te: "Screen use oka emotional pani chestaundi — emi fill cheyyataniki leda avoid cheyyataniki. Idi telusukovalani avasaram.", ta: "Screen use oru emotional velai seyyudhu — enna-vo fill panna illa avoid panna. Idha purinjukka venum." },
  relational:   { en: "It sounds like you want connection, but something keeps making full openness feel risky.", hi: "Connection chahte ho, par kuch cheez poori tarah khulna mushkil bana deti hai.", te: "Connection kavali anipistundi, kaani poortiga terichukovadam risky ga feel avutundi.", ta: "Connection venumnu irukku, aana muzhusa therakkaradhu risky-a feel aagudhu." },
  physiological:{ en: "A mind that won't switch off at night is usually processing more than it can handle during the day.", hi: "Raat ko band na hone wala mind usually din mein jo process nahi hua woh sambhal raha hota hai.", te: "Raatriki band kaani mind usually pavalilo process kaanidi ippudu process chestaundi.", ta: "Ira-vula off aagaadha mind, pakalila process aagaadhatha ippave process panradhu." },
  general:      { en: "There are several layers to what you're carrying — and they become clearer the more we look together.", hi: "Jo tum carry kar rahe ho usme kai layers hain — saath dekhne pe zyada clear hota hai.", te: "Meeru carry chestaunnadi lo chala layers unnaayi — saath chuste clear avutaayi.", ta: "Neenga carry pannuvadhu-la pala layers irukku — saerndhu paarthaal clear aagum." },
};

function buildSynthesisBlocks(concernFamily: string, patterns: DetectedPattern[], lang: Language): ConversationBlock[] {
  const narrative = SYNTHESIS_NARRATIVE[concernFamily] || SYNTHESIS_NARRATIVE.general;
  const content   = (lang === "hi" || lang === "hi_en") ? narrative.hi
    : (lang === "te" || lang === "te_en") ? narrative.te
    : lang === "ta" ? narrative.ta
    : narrative.en;
  const blocks: ConversationBlock[] = [];

  const openMsg = (lang === "hi" || lang === "hi_en")
    ? "Jo tumne share kiya hai, usके baare mein kuch reflect karna chahta hoon."
    : (lang === "te" || lang === "te_en")
    ? "Meeru share chesindi anni daaninni reflect cheyyaalani undi."
    : lang === "ta"
    ? "Neenga share pannidhadha ellaam reflect pannanum-nu irukken."
    : "Based on everything you've shared, I want to reflect something back.";

  blocks.push({ id: "synth_open", type: "bridge", content: openMsg, emotionalTone: "gentle" });
  blocks.push({ id: "synth_main", type: "reflection", content: applySafety(content), emotionalTone: "reflective", pacing: { speed: "slow", delayMs: 1100 } });

  if (patterns.length > 0) {
    const patternMsg = (lang === "hi" || lang === "hi_en")
      ? `Ek pattern banta dikh raha hai: ${patterns[0].description} Yeh aksar gradually hota hai — isliye notice karna mushkil hota hai.`
      : (lang === "te" || lang === "te_en")
      ? `Oka pattern kanapadadam start avutundi: ${patterns[0].label}. Ee pattern gradually vasthundi — adhi valla notice cheyyataniki kashtam avutundi.`
      : lang === "ta"
      ? `Oru pattern theriyudhu: ${patterns[0].label}. Idhu maellama varudhu — adhanaal notice panna kasht-am aagudhu.`
      : `A possible pattern is worth noticing: ${patterns[0].description} This kind of pattern often goes unnoticed — it builds gradually, and can be mistaken for a personal failing.`;
    blocks.push({ id: "synth_pattern", type: "reflection", content: applySafety(patternMsg), emotionalTone: "observational", pacing: { speed: "slow", delayMs: 1100 } });
  }

  const closeMsg = (lang === "hi" || lang === "hi_en")
    ? "Yeh pattern samajhna matlab yeh nahin ki ise accept karo — matlab hai ki ab ek clear starting point hai."
    : (lang === "te" || lang === "te_en")
    ? "Ee pattern artham chesukోvadam accept chesukataniki kadu — ab clear starting point undi anta."
    : lang === "ta"
    ? "Idha purinjukka accept panna maatri illa — ippo clear starting point irukku."
    : "Understanding this pattern doesn't mean accepting it as permanent. It means you now have a clearer starting point.";
  blocks.push({ id: "synth_close", type: "progression", content: closeMsg, emotionalTone: "supportive", pacing: { speed: "slow", delayMs: 1000 } });
  return blocks;
}

// ════════════════════════════════════════════════════════════════════════════
// INTERVENTION LIBRARY
// ════════════════════════════════════════════════════════════════════════════
const INTERVENTIONS: Record<string, Array<{ title: string; description: string; type: string }>> = {
  academic:     [{ title: "Cognitive Decluttering",        description: "A simple daily practice to reduce exam anxiety through structured mental preparation.", type: "cognitive_reframing" }, { title: "Performance Detachment",      description: "Practical techniques to separate test performance from self-worth.", type: "identity_work" }, { title: "Incremental Exposure",        description: "Gradual re-engagement with evaluation situations to rebuild confidence through small wins.", type: "behavioural_activation" }],
  occupational: [{ title: "Recovery Architecture",         description: "Structured rest windows built into your routine to restore depleted reserves.", type: "burnout_recovery" }, { title: "Boundary Calibration",        description: "A practical framework for reclaiming energy that's leaking without return.", type: "boundary_setting" }, { title: "Meaning Reconnection",        description: "Guided reflection to reconnect daily activity with longer-term purpose.", type: "meaning_making" }],
  cognitive:    [{ title: "Attention Training",            description: "Structured focus sessions that build concentration capacity without frustration.", type: "focus_stabilization" }, { title: "Environmental Design",        description: "Strategic changes to reduce competing stimulation and restore attentional baseline.", type: "context_modification" }, { title: "Cognitive Load Mapping",      description: "Identifying when cognitive load peaks — and building recovery windows around it.", type: "load_management" }],
  social:       [{ title: "Social Risk Calibration",       description: "Gradual exposure to social situations that challenge avoidance without overwhelming.", type: "exposure_therapy" }, { title: "Inner Audience Reduction",    description: "Techniques to reduce self-consciousness and the sense of being constantly observed.", type: "self_focus_reduction" }, { title: "Post-Event Recovery",         description: "A structured wind-down practice after social interactions to reduce rumination.", type: "rumination_interruption" }],
  identity:     [{ title: "Inner Critic Mapping",          description: "Identifying the inner critic's language, origin, and triggers.", type: "self_awareness" }, { title: "Narrative Reframing",         description: "Replacing outdated self-narratives with evidence-based alternatives.", type: "cognitive_reframing" }, { title: "Worth Decoupling",            description: "Separating self-worth from performance outcomes through daily anchoring.", type: "identity_work" }],
  emotional:    [{ title: "Emotional Reset Protocol",      description: "Brief grounding practices that interrupt escalating emotional cycles early.", type: "emotional_regulation" }, { title: "Trigger Mapping",             description: "Systematically identifying what precedes emotional escalation.", type: "self_awareness" }, { title: "Expression Scaffolding",      description: "Structured ways of giving voice to emotional experience before it builds to overwhelm.", type: "emotional_expression" }],
  motivational: [{ title: "Activation Architecture",       description: "Re-engaging motivation through small, protected wins.", type: "momentum_rebuilding" }, { title: "Purpose Reconnection",        description: "Guided reflection to identify and reconnect with intrinsic motivation.", type: "meaning_making" }, { title: "Energy Mapping",              description: "Understanding when energy is naturally highest — and building habits around it.", type: "load_management" }],
};

const DEFAULT_INTERVENTIONS = [
  { title: "Pattern Awareness Practice",  description: "Daily check-ins to make the behavioural pattern visible before it takes hold.", type: "self_awareness" },
  { title: "Emotional Reset Protocol",    description: "Brief grounding practices that interrupt escalating emotional cycles early.", type: "emotional_regulation" },
  { title: "Momentum Rebuilding",         description: "Small-win sequencing that restores forward movement through structured micro-progress.", type: "momentum_rebuilding" },
];

function getInterventions(concernFamily: string): DetectedPattern[] {
  const ints = INTERVENTIONS[concernFamily] || DEFAULT_INTERVENTIONS;
  return ints.map(i => ({
    id: `int_${i.type}`, label: i.title, description: i.description, confidence: 1,
    signals: [], category: "intervention" as const, type: i.type,
  }));
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION COMPLETION PSYCHOLOGY — calm, clear, gentle
// ════════════════════════════════════════════════════════════════════════════
function buildGrowthTransitionBlocks(concernFamily: string, patterns: DetectedPattern[], lang: Language): ConversationBlock[] {
  const topPattern = patterns[0];
  const hi = lang === "hi" || lang === "hi_en";
  const te = lang === "te" || lang === "te_en";
  const ta = lang === "ta";
  return [
    {
      id: "gt_open", type: "insight",
      content: te
        ? "Ee conversation lo meeru chala layers explore chesaaru — surface feeling nundi underneath ki."
        : ta
        ? "Ee conversation-la neenga pala layers explore panneenga — surface feeling-la irundu ullE irukkiradhukku."
        : hi
        ? "Tumne is conversation mein kai layers ko explore kiya — surface se neeche tak."
        : "You've moved through several layers — from the surface feeling to what's underneath.",
      emotionalTone: "reflective",
    },
    {
      id: "gt_pattern", type: "reflection",
      content: te
        ? (topPattern
            ? `${topPattern.label} — idi ippudu unknown kadu. Artham chesukuంte idi workable avutundi.`
            : "Meeru identify chesina pattern, meaningful change ki foundation.")
        : ta
        ? (topPattern
            ? `${topPattern.label} — idha purinjukitta, workable aagum. Idhu innam unnga mela nadakkira oru vishayam illai.`
            : "Neenga purinja pattern, unmai maattatthukku oru adippadai.")
        : hi
        ? (topPattern
            ? `${topPattern.label} — yeh ab ek unknown cheez nahi rahi. Samajhne se yeh workable hoti hai.`
            : "Jo pattern tumne identify kiya hai, woh meaningful change ka foundation hai.")
        : (topPattern
            ? `The ${topPattern.label.toLowerCase()} — once understood, becomes workable. It's no longer just something that happens to you.`
            : "The pattern you've started to understand is the foundation of real change."),
      emotionalTone: "supportive",
      pacing: { speed: "slow", delayMs: 1000 },
    },
    {
      id: "gt_hope", type: "reassurance",
      content: te
        ? "Ee patterns willpower tho marchukoru — mechanism artham chesukotam tho marchukoru. Adi ippudu start ayyindi."
        : ta
        ? "Idha maatha willpower-la illai — mechanism-a purinjukitta mattum madham. Adha purinjukaradhu ippo thaan thodangi."
        : hi
        ? "Yeh patterns willpower se nahi badlte — mechanism samajhne se badlte hain. Aur woh samajhna abhi shuru hua."
        : "Change in these patterns isn't about willpower. It's about understanding the mechanism — and that understanding has just begun.",
      emotionalTone: "supportive",
      pacing: { speed: "slow", delayMs: 1100 },
    },
  ];
}

function buildProgressionReflectionBlocks(lang: Language): ConversationBlock[] {
  const hi = lang === "hi" || lang === "hi_en";
  const te = lang === "te" || lang === "te_en";
  const ta = lang === "ta";
  return [
    {
      id: "pr_reflect", type: "reflection",
      content: te
        ? "Munduku vellataniki mundu — meeru discover chesindi settle avvanikandaam. Insight feel avutunnapudu paniki vastundi."
        : ta
        ? "Munnadi pogradharku munbu — neenga discover pannidhadha settle aaga vidalam. Insight feel aagum-bOdhu velaiyaagum."
        : hi
        ? "Aage badhne se pehle — jo tumne discover kiya hai, use settle hone do. Insight tab kaam karti hai jab woh feel ho sakti hai."
        : "Before moving forward — take a moment with what you've discovered. Insight lands best when it's given space to settle.",
      emotionalTone: "gentle",
      pacing: { speed: "slow", delayMs: 1200 },
    },
    {
      id: "pr_bridge", type: "bridge",
      content: te
        ? "Ee conversation meeru work cheyyadaaniki clear behavioural map ichindi."
        : ta
        ? "Ee conversation namakku work panna clear behavioural map kuduthadhu."
        : hi
        ? "Is conversation ne ek clear behavioural map diya hai."
        : "This conversation has given us a clear map to work from.",
      emotionalTone: "observational",
    },
  ];
}

function buildInsightTransitionBlocks(lang: Language): ConversationBlock[] {
  const hi = lang === "hi" || lang === "hi_en";
  const te = lang === "te" || lang === "te_en";
  const ta = lang === "ta";
  return [
    {
      id: "it_close", type: "closure",
      content: te
        ? "Meeru ee conversation lo chaalaa clarify chesaaru. Oka concern ippudu defined, workable pattern ayyindi — idi surface layer matrame."
        : ta
        ? "Neenga ee conversation-la chaalaa purinjukitta. Oru concern ippo clear-a therijudhu — aana idhu surface mattum thaan."
        : hi
        ? "Is conversation mein tumne bahut kuch clear kiya. Jo concern tha, woh ab ek defined pattern ban gaya — lekin yeh sirf upar ki layer hai."
        : "What we've uncovered so far is meaningful — your concern has taken shape into a defined pattern. But this may only be the surface layer.",
      emotionalTone: "supportive",
      pacing: { speed: "slow", delayMs: 1200 },
    },
    {
      id: "it_invite", type: "progression",
      content: te
        ? "Insight stage ee patterns confidence, emotional resilience, decision-making, mattu long-term growth ni ela affect chestaayoo explore chestaundi — ee patterns ekkadi nundi vastooyoo, ela continue chestaaayo kuda."
        : ta
        ? "Insight stage ee patterns unga confidence, emotional resilience, decision-making-um long-term growth-um-a epadi affect panradhu-nu explore pannum — adha enga-la irundhu varudhu, epadi continue aagudhu-nu-um."
        : hi
        ? "Insight stage explore karta hai ki yeh patterns confidence, emotional resilience, decision-making aur long-term growth ko kaise affect karte hain — yeh patterns kahan se aate hain, kaise continue karte hain."
        : "The Insight stage explores how these patterns may be affecting your confidence, emotional resilience, decision-making, and long-term growth — and where they actually come from.",
      emotionalTone: "supportive",
      pacing: { speed: "slow", delayMs: 1000 },
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// FALLBACK BLOCK ENGINE
// ════════════════════════════════════════════════════════════════════════════
const FALLBACK_BLOCKS: ConversationBlock[] = [
  { id: "fb_01", type: "reflection", content: "Take a moment — I'm here. Let's continue when you're ready.", emotionalTone: "gentle" },
  { id: "fb_02", type: "question",   content: "What feels most important right now?", options: ["Understanding the pattern", "Finding a way forward", "Just being heard"], pacing: { speed: "medium", delayMs: 700 } } as any,
];

// ════════════════════════════════════════════════════════════════════════════
// RUNTIME ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════
async function processTurn(
  session: any,
  userInput: string,
  sessionMode: SessionMode = "standard",
  explicitLang?: Language,
): Promise<{
  blocks: ConversationBlock[];
  nextState: RuntimeState;
  allSignals: string[];
  allPatterns: DetectedPattern[];
  narrativeLabel: string;
  responseType: ResponseType;
  options?: string[];
  pacing: ReturnType<typeof computePacing>;
  quality: QualityScore;
  escalation: EscalationResult;
  isComplete: boolean;
  detectedLang: Language;
  depthLevel: DepthLevel;
}> {
  try {
    const currentState = session.current_state as RuntimeState;
    const prevSignals: string[] = (() => {
      try { const s = typeof session.signal_store === "string" ? JSON.parse(session.signal_store) : session.signal_store; return s?.signals || []; }
      catch { return []; }
    })();
    const usedReflectionIds: string[] = (() => {
      try { return typeof session.reflection_history === "string" ? JSON.parse(session.reflection_history) : (session.reflection_history || []); }
      catch { return []; }
    })();
    const turnCount = (session.turn_count || 0) + 1;

    // 1. Signal extraction + accumulation
    const freshSignals = extractSignals(userInput);
    const allSignals   = [...new Set([...prevSignals, ...freshSignals])];

    // 2. Language detection — explicit selection > fresh detection > stored preference
    const freshLang  = detectLanguage(userInput);
    const storedLang = (session.preferred_language || "en") as Language;
    const detectedLang: Language = explicitLang || (freshLang !== "en" ? freshLang : storedLang);

    // 3. Concern classification
    const concernKey    = classifyConcern(userInput, session.initial_concern);
    const ontology      = ONTOLOGY[concernKey];
    const concernFamily = ontology?.concernFamily || "general";

    // 4. Emotional weight + depth + pacing
    const emotionalWeight = computeEmotionalWeight(allSignals);
    const depthLevel      = computeDepthLevel(allSignals, turnCount, userInput);
    const pacing          = computePacing(allSignals, emotionalWeight);
    const density         = getReflectionDensity(emotionalWeight, turnCount, depthLevel);

    // 5. Pattern detection
    const allPatterns = detectPatterns(allSignals, turnCount);

    // 6. Quality score
    const quality = computeQuality(allSignals, allPatterns, turnCount, userInput);

    // 7. Escalation check
    const escalation = checkEscalation(allSignals, userInput);

    // 8. Next state — respect session mode
    const sequence  = sessionMode === "quick_clarity" ? QUICK_CLARITY_SEQUENCE : STATE_SEQUENCE;
    const stateIdx  = sequence.indexOf(currentState);
    const nextState = (stateIdx === -1
      ? sequence[1]
      : (sequence[stateIdx + 1] ?? "complete")
    ) as RuntimeState;

    // 9. Build blocks
    const blocks: ConversationBlock[] = [];

    // Narrowing states — no reflections or bridges, just structured progression
    const narrowingStates: RuntimeState[] = [
      "concern_recognition", "reflective_exploration", "severity_mapping",
    ];
    const skipReflectionStates: RuntimeState[] = [
      ...narrowingStates,
      "behavioural_synthesis", "growth_transition", "progression_reflection",
      "clarity_generation", "insight_transition", "complete",
    ];

    const hiLang = detectedLang === "hi" || detectedLang === "hi_en";
    const teLang = detectedLang === "te" || detectedLang === "te_en";
    const taLang = detectedLang === "ta";

    // Bridge — skip during narrowing states (just structured questions, no emotional transitions)
    const skipBridgeStates: RuntimeState[] = [...narrowingStates, "emotional_entry"];
    if (!skipBridgeStates.includes(nextState) && freshSignals.length > 0) {
      blocks.push(buildBridge(freshSignals, detectedLang));
    }

    // Reflection — EARNED. Only fires after the full narrowing sequence is complete.
    // Level 1 = skip/brief; Level 2+ = brief/full
    if (!skipReflectionStates.includes(nextState) && density !== "skip") {
      const refl = selectReflection(concernFamily, allSignals, usedReflectionIds, detectedLang);
      if (refl) {
        usedReflectionIds.push(refl.id);
        let rawContent = getReflectionContent(refl, detectedLang);
        if (density === "brief") rawContent = truncateToFirst(rawContent);
        blocks.push({ id: refl.id, type: "reflection", content: applySafety(rawContent), emotionalTone: refl.tone, pacing });
      }
    }

    // State-specific blocks
    if (nextState === "pattern_emergence" && allPatterns.length > 0) {
      const p = allPatterns[0];
      const patternMsg = hiLang
        ? `Mujhe kuch notice ho raha hai jo shayad yahan contribute kar sakta hai — kuch jo ${p.label.toLowerCase()} jaisa lagta hai. Yeh koi final conclusion nahi hai — bas kuch jo mujhe tumhare saath explore karne layak lagta hai. Kya yeh tumhe resonate karta hai?`
        : teLang
        ? `Naku ikkade contribute avutunna emi notice avutundi — ${p.label.toLowerCase()} la anipistundi. Idi final conclusion kaadu — meeru okkatho kalidhi explore cheyyataniki worthy ga feel avutundi. Meeku idi resonate avutundaa?`
        : taLang
        ? `Inga contribute panna enna-va notice panraen — ${p.label.toLowerCase()} maadiri feel aagudhu. Idhu final conclusion illai — unga-kooda kalidhi explore panna worth-a feel aagudhu. Idhu unga-lukku resonate aagudha?`
        : `I'm starting to notice something that might be contributing here — it looks like what's sometimes called ${p.label.toLowerCase()}. This isn't a final conclusion, just something worth exploring together. Does that feel true to your experience, or does something else feel closer?`;
      blocks.push({
        id: `pd_${Date.now()}`, type: "pattern_detection",
        content: patternMsg,
        emotionalTone: "observational", signalMappings: p.signals,
      });
    }

    if (nextState === "behavioural_synthesis") {
      blocks.push(...buildSynthesisBlocks(concernFamily, allPatterns, detectedLang));
    }

    if (nextState === "reassurance") {
      blocks.push({
        id: `reassure_${Date.now()}`, type: "reassurance",
        content: escalation.flag
          ? (teLang
              ? "Meeru share chesindi chala important. Direct ga okari tho maatladataniki try cheyyandi."
              : taLang
              ? "Neenga share pannadu romba mukkiyam. Nேரடியா kitta pesa try pannunga."
              : hiLang
              ? "Jo tumne share kiya woh important hai. Kisi se seedha baat karna bhi helpful ho sakta hai."
              : "What you've shared matters. Please know that talking with someone directly can also be very helpful.")
          : (teLang
              ? "Meeru describe chesindi, chala mandi quietly carry chestaaru — ela annikaalu. Idi surface ki teeyataniki chala courage kavali."
              : taLang
              ? "Neenga solradha, pala pera odunga thoonguthaanga — yaarukkum sollaama. Itha vella solla courage vendum."
              : hiLang
              ? "Jo tum le rahe ho, woh bahut log quietly le jaate hain — bina kisi ko bataye. Yeh surface pe laana apne aap mein kuch hai."
              : "What you've described is something many people carry quietly for longer than they should. Bringing it to the surface is already something meaningful."),
        emotionalTone: "supportive", pacing: { speed: "slow", delayMs: 1200 },
      });
    }

    if (nextState === "clarity_generation") {
      const clarityMsg = teLang
        ? "Meeru map chesina pattern base ga, ivi most helpful ga untaayi."
        : taLang
        ? "Neenga map pannina pattern-a vachi, ivai romba helpful-a irukkum."
        : hiLang
        ? "Tumhare pattern ke hisaab se, yeh pathways sabse zyada kaam kar sakti hain."
        : "I wonder if any of these might resonate with where you are right now — each one connects to what you've shared.";
      blocks.push({ id: `clarity_${Date.now()}`, type: "insight", content: clarityMsg, emotionalTone: "reflective" });
      allPatterns.push(...getInterventions(concernFamily));
    }

    if (nextState === "growth_transition") {
      blocks.push(...buildGrowthTransitionBlocks(concernFamily, allPatterns.filter(p => p.category === "pattern"), detectedLang));
    }

    if (nextState === "progression_reflection") {
      blocks.push(...buildProgressionReflectionBlocks(detectedLang));
    }

    if (nextState === "insight_transition") {
      // CuriosityReport — lightweight behavioural clarity summary before Insight invite
      const reportConcern = session.initial_concern || concernFamily;
      const emotionalSignals = allSignals.filter(s =>
        ["emotional_overwhelm","fatigue","self_doubt","recognition_frustration","emotional_detachment","anxiety","shame_avoidance"].includes(s)
      ).slice(0, 3);
      const behaviouralEffects = allSignals.filter(s =>
        ["avoidance","procrastination","attention_fragmentation","isolation","recovery_deficiency"].includes(s)
      ).slice(0, 3);
      const severityLevel = emotionalWeight >= 6 ? "high" : emotionalWeight >= 3 ? "moderate" : "low";
      const hiddenPattern = allPatterns.length > 0
        ? allPatterns[0].description
        : (hiLang
            ? "Ek quietly accumulating cycle detect hua hai jo surface se zyada deep chal raha hai."
            : teLang
            ? "Surface kante deeper ga quietly accumulate avutunna cycle kanapadadam start ayyindi."
            : taLang
            ? "Surface-a vida azhama quietly accumulate aagura oru cycle therivagiradu."
            : "Something seems to be accumulating quietly beneath the surface — I want to understand it better with you.");
      const insightBridge = hiLang
        ? "Yeh pattern kahan se aaya, confidence aur decisions ko kaise affect kar raha hai — yeh abhi surface ke neeche hai."
        : teLang
        ? "Ee pattern ekkadi nundi vastooyoo, confidence mattu decisions ni ela affect chestaayoo — idi ippudu surface below untundi."
        : taLang
        ? "Ee pattern enga-la varudhu, confidence-um decisions-um-a epadi affect panudhu-nu — idhu ippo surface-ku keezhae irukkudhu."
        : "Where this might originate, and whether it's affecting other areas like confidence or decisions — that's what I'd like to explore next with you.";

      blocks.push({
        id: `cr_${Date.now()}`,
        type: "curiosity_report" as any,
        content: "Behavioural Clarity Summary",
        emotionalTone: "reflective",
        pacing: { speed: "slow", delayMs: 1400 },
        reportData: {
          coreConcern: reportConcern,
          emotionalSignals: emotionalSignals.length > 0 ? emotionalSignals : ["Emotional pressure", "Confidence strain"],
          behaviouralEffects: behaviouralEffects.length > 0 ? behaviouralEffects : ["Pattern accumulation", "Motivational inconsistency"],
          severityLevel,
          hiddenPattern,
          insightBridge,
        },
      } as any);

      blocks.push(...buildInsightTransitionBlocks(detectedLang));
    }

    // Question block
    const terminal: RuntimeState[] = ["insight_transition", "complete"];
    if (!terminal.includes(nextState)) {
      const qBlock = getQuestion(nextState, concernFamily);
      if (qBlock) {
        blocks.push({
          id: qBlock.id, type: "question",
          content: getQuestionContent(qBlock, detectedLang),
          pacing: { speed: "medium", delayMs: 600 },
        });
      }
    }

    const qForResponse = getQuestion(nextState, concernFamily);
    const responseType: ResponseType = terminal.includes(nextState) ? "action" : (qForResponse?.responseType || "chips");
    const options = responseType === "chips" ? getQuestionOptions(qForResponse!, detectedLang) : undefined;

    return {
      blocks,
      nextState,
      allSignals,
      allPatterns,
      narrativeLabel: NARRATIVE_LABELS[nextState],
      responseType,
      options,
      pacing,
      quality,
      escalation,
      isComplete: nextState === "complete",
      detectedLang,
      depthLevel,
    };
  } catch (err) {
    console.error("[pragati] processTurn error:", err);
    return {
      blocks: FALLBACK_BLOCKS,
      nextState: session.current_state as RuntimeState,
      allSignals: [],
      allPatterns: [],
      narrativeLabel: NARRATIVE_LABELS[session.current_state as RuntimeState] || "Here with you",
      responseType: "chips",
      options: ["Continue", "Take a moment"],
      pacing: { speed: "medium", delayMs: 750 },
      quality: { engagement_depth: 0, emotional_resonance: 0, pattern_clarity: 0, session_depth: 0, total: 0 },
      escalation: { flag: false, reason: "", severity: "low" },
      isComplete: false,
      detectedLang: "en",
      depthLevel: 1,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DB MIGRATION
// ════════════════════════════════════════════════════════════════════════════
async function ensurePragatiColumns() {
  const cols = [
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS narrative_stage TEXT`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS pacing_level TEXT DEFAULT 'medium'`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS signal_store JSONB DEFAULT '{"signals":[]}'::jsonb`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS reflection_history JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS turn_count INTEGER DEFAULT 0`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS emotional_weight INTEGER DEFAULT 0`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS escalation_flagged BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS escalation_reason TEXT`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS drift_direction TEXT`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS conversation_blocks JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en'`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS session_mode TEXT DEFAULT 'standard'`,
    `ALTER TABLE pragati_sessions ADD COLUMN IF NOT EXISTS depth_level INTEGER DEFAULT 1`,
  ];
  for (const stmt of cols) {
    try { await db.execute(sql.raw(stmt)); } catch {}
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ════════════════════════════════════════════════════════════════════════════
export function registerPragatiRoutes(app: any) {
  ensurePragatiColumns().catch(e => console.error("[pragati] migration:", e));

  // ── Start session ──────────────────────────────────────────────────────────
  app.post("/api/pragati/session/start", async (req: any, res: any) => {
    try {
      const { email, name, initial_concern, session_mode = "standard", preferred_language, competency_context } = req.body;

      const mode: SessionMode = ["quick_clarity","deep_reflection","standard"].includes(session_mode)
        ? session_mode as SessionMode : "standard";

      // Detect language from initial concern if provided
      const initLang: Language = preferred_language
        || (initial_concern ? detectLanguage(initial_concern) : "en");

      let returningUser: any = null;
      let priorPatterns:  any[] = [];
      let priorSignals:   string[] = [];
      let drift: DriftResult = { direction: "new_session", description: "First session", confidence: 1 };

      if (email) {
        const ur = await db.execute(sql`SELECT * FROM capadex_users WHERE email = ${email} LIMIT 1`);
        if (ur.rows.length > 0) {
          returningUser = ur.rows[0];
          const pr = await db.execute(sql`SELECT signal_store, patterns, preferred_language FROM pragati_sessions WHERE email = ${email} AND current_state != 'emotional_entry' ORDER BY created_at DESC LIMIT 1`);
          if (pr.rows.length > 0) {
            const row = pr.rows[0] as any;
            try { const ss = typeof row.signal_store === "string" ? JSON.parse(row.signal_store) : row.signal_store; priorSignals = ss?.signals || []; } catch {}
            try { priorPatterns = typeof row.patterns === "string" ? JSON.parse(row.patterns) : (row.patterns || []); } catch {}
            drift = detectDrift([], priorSignals);
          }
        }
      }

      const sessionId = crypto.randomUUID();
      const hi        = initLang === "hi" || initLang === "hi_en";
      const te        = initLang === "te" || initLang === "te_en";
      const ta        = initLang === "ta";

      // Greeting blocks — natural, short, human
      const greetingBlocks: ConversationBlock[] = [];

      if (returningUser && priorPatterns.length > 0) {
        const priorLabel = priorPatterns[0]?.label || "a pattern we explored";
        greetingBlocks.push({
          id: "g_ret_01", type: "reflection",
          content: hi
            ? `Wapas aaye. Pichhli baar humne ${priorLabel.toLowerCase()} ke baare mein baat ki thi. Woh kaisi rahi?`
            : `Welcome back. Last time we were exploring the ${priorLabel.toLowerCase()}. How has that been sitting with you?`,
          emotionalTone: "gentle", pacing: { speed: "slow", delayMs: 900 },
        });
      } else if (returningUser) {
        greetingBlocks.push({
          id: "g_ret_02", type: "reflection",
          content: hi
            ? "Wapas aaye. Jahan se sahi lage, wahan se shuru karte hain."
            : "Welcome back. Let's pick up wherever feels right for you.",
          emotionalTone: "gentle", pacing: { speed: "slow", delayMs: 900 },
        });
      } else {
        greetingBlocks.push({
          id: "g_01", type: "reflection",
          content: te
            ? "Nenu Pragati ni. Meeru comfortable ga feel ayyela ikkade unna — meeru pace lo, meeru language lo."
            : ta
            ? "Naan Pragati. Neenga comfortable-a feel pannanum-nu nenaikkiren — unga pace-la, unga molila pesalam."
            : hi
            ? "Hi, main Pragati hoon. Main tumhare saath hoon — tumhari language mein, tumhari pace se."
            : "Hi, I'm Pragati — your adaptive growth intelligence guide. I'm here to help you decode what's shaping your performance, decisions, and growth momentum.",
          emotionalTone: "gentle", pacing: { speed: "slow", delayMs: 900 },
        });

        if (mode === "quick_clarity") {
          greetingBlocks.push({
            id: "g_mode", type: "bridge",
            content: te
              ? "5–7 nimishallo kొంచem clarity vasthundi — telusukovadam modupedu."
              : ta
              ? "5–7 nimidam-la konjam clarity kidaikkum — pesuvom, yosikkavendum illai."
              : hi
              ? "5–7 minute mein kuch clearer ho jayega — jaldi nahi hai, bas share karo."
              : "We'll get to something clearer in 5–7 minutes. There's no rush — just share what feels true.",
            emotionalTone: "supportive",
          });
        }
      }

      const competencyArea  = (competency_context as any)?.primaryArea as string | undefined;
          const openQuestion = competencyArea
          ? `I can see you\'re looking to strengthen your ${competencyArea.toLowerCase()}. What\'s been most affecting your progress there recently?`
          : initial_concern
          ? (te
            ? `Meeru "${initial_concern}" gurinchi cheppindi. Idi loni chaala kashtamaina vishayam enti?`
            : ta
            ? `Neenga "${initial_concern}" pattri sollineenga. Ithula enna romba kasht-padutheenga?`
            : hi
            ? `Tumne "${initial_concern}" ke baare mein bataya. Iske baare mein sabse bhaari kya raha hai?`
            : `I can see you're thinking about "${initial_concern}". What's been the hardest part of that recently?`)
        : (te
            ? "Ippudu meeru ela feel avutunnaru? Emi vishayam meeru ikkade vacchindi?"
            : ta
            ? "Ippo enna kastam-a irukku? Enna vishayam unnga manasla adipaduthirukku?"
            : hi
            ? "Aaj kya chal raha hai? Jo bhi dil mein hai, bata sakte ho."
            : "What's been feeling difficult lately?");

      greetingBlocks.push({
        id: "g_q", type: "question",
        content: openQuestion,
        pacing: { speed: "medium", delayMs: 600 },
      });

      await db.execute(sql`
        INSERT INTO pragati_sessions
          (id, email, name, initial_concern, current_state, signals, patterns,
           conversation_history, stage, stage_index, signal_store, reflection_history,
           narrative_stage, pacing_level, blocks, conversation_blocks, turn_count,
           quality_score, escalation_flagged, drift_direction, preferred_language,
           session_mode, depth_level)
        VALUES
          (${sessionId}, ${email ?? null}, ${name ?? null}, ${initial_concern ?? null},
           'emotional_entry', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb,
           'CURIOSITY', 0,
           '{"signals":[]}'::jsonb, '[]'::jsonb,
           'Here with you', 'medium',
           '[]'::jsonb, ${JSON.stringify(greetingBlocks)}::jsonb,
           0, 0, FALSE, 'new_session',
           ${initLang}, ${mode}, 1)
      `);

      res.json({
        session_id:        sessionId,
        state:             "emotional_entry",
        narrative_label:   "Mapping your growth profile",
        blocks:            greetingBlocks,
        response_type:     "text",
        is_returning_user: !!returningUser,
        prior_patterns:    priorPatterns,
        drift,
        session_mode:      mode,
        preferred_language: initLang,
      });
    } catch (err: any) {
      console.error("[pragati] start:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Respond ────────────────────────────────────────────────────────────────
  app.post("/api/pragati/session/:sessionId/respond", async (req: any, res: any) => {
    try {
      const { sessionId } = req.params;
      const userInput     = (req.body.response_text || req.body.response || "").trim();

      const rows = await db.execute(sql`SELECT * FROM pragati_sessions WHERE id = ${sessionId} LIMIT 1`);
      if (rows.rows.length === 0) return res.status(404).json({ error: "Session not found" });
      const session = rows.rows[0] as any;

      if (session.current_state === "complete") {
        return res.json({ session_id: sessionId, state: "complete", narrative_label: "Conversation complete", blocks: [], response_type: "action", is_complete: true });
      }

      const mode         = (session.session_mode || "standard") as SessionMode;
      const explicitLang = req.body.preferred_language as Language | undefined;
      const result = await processTurn(session, userInput, mode, explicitLang);

      // Build persistent conversation history
      const history: any[] = (() => {
        try { return typeof session.conversation_history === "string" ? JSON.parse(session.conversation_history) : (session.conversation_history || []); }
        catch { return []; }
      })();
      history.push({ state: session.current_state, user_response: userInput, signals: result.allSignals, timestamp: new Date().toISOString() });

      // Accumulate all conversation blocks for session recovery
      const allConvBlocks: any[] = (() => {
        try { return typeof session.conversation_blocks === "string" ? JSON.parse(session.conversation_blocks) : (session.conversation_blocks || []); }
        catch { return []; }
      })();
      allConvBlocks.push({ turn: (session.turn_count || 0) + 1, user: userInput, blocks: result.blocks, state: result.nextState });

      const usedReflections: string[] = (() => {
        try { const u = typeof session.reflection_history === "string" ? JSON.parse(session.reflection_history) : (session.reflection_history || []); return [...new Set([...u, ...result.blocks.filter(b => b.type === "reflection").map(b => b.id)])]; }
        catch { return []; }
      })();

      // Drift detection
      let priorSignals: string[] = [];
      if (session.email) {
        try {
          const ps = await db.execute(sql`SELECT signal_store FROM pragati_sessions WHERE email = ${session.email} AND id != ${sessionId} ORDER BY created_at DESC LIMIT 1`);
          if ((ps as any).rows?.length > 0) {
            const ss = (ps as any).rows[0].signal_store;
            priorSignals = (typeof ss === "string" ? JSON.parse(ss) : ss)?.signals || [];
          }
        } catch {}
      }
      const drift = detectDrift(result.allSignals, priorSignals);

      await db.execute(sql`
        UPDATE pragati_sessions SET
          current_state        = ${result.nextState},
          narrative_stage      = ${result.narrativeLabel},
          signal_store         = ${JSON.stringify({ signals: result.allSignals })}::jsonb,
          patterns             = ${JSON.stringify(result.allPatterns)}::jsonb,
          conversation_history = ${JSON.stringify(history)}::jsonb,
          conversation_blocks  = ${JSON.stringify(allConvBlocks)}::jsonb,
          reflection_history   = ${JSON.stringify(usedReflections)}::jsonb,
          pacing_level         = ${result.pacing.speed},
          turn_count           = COALESCE(turn_count, 0) + 1,
          quality_score        = ${result.quality.total},
          emotional_weight     = ${computeEmotionalWeight(result.allSignals)},
          escalation_flagged   = ${result.escalation.flag},
          escalation_reason    = ${result.escalation.reason || null},
          drift_direction      = ${drift.direction},
          preferred_language   = ${result.detectedLang},
          depth_level          = ${result.depthLevel},
          updated_at           = now()
        WHERE id = ${sessionId}
      `);

      const detectedPatterns = result.allPatterns.filter(p => p.category === "pattern");
      const interventions    = result.allPatterns.filter(p => p.category === "intervention");

      res.json({
        session_id:        sessionId,
        state:             result.nextState,
        narrative_label:   result.narrativeLabel,
        blocks:            result.blocks,
        response_type:     result.responseType,
        options:           result.options,
        detected_patterns: detectedPatterns,
        interventions,
        signal_count:      result.allSignals.length,
        pacing:            result.pacing,
        quality:           result.quality,
        escalation:        result.escalation.flag ? { flag: true, severity: result.escalation.severity } : null,
        drift,
        is_complete:       result.isComplete,
        preferred_language: result.detectedLang,
        depth_level:       result.depthLevel,
      });
    } catch (err: any) {
      console.error("[pragati] respond:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Session recovery / resume ──────────────────────────────────────────────
  app.get("/api/pragati/session/:sessionId/resume", async (req: any, res: any) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM pragati_sessions WHERE id = ${req.params.sessionId} LIMIT 1`);
      if (rows.rows.length === 0) return res.status(404).json({ error: "Session not found" });
      const session = rows.rows[0] as any;

      const convBlocks: any[] = (() => {
        try { return typeof session.conversation_blocks === "string" ? JSON.parse(session.conversation_blocks) : (session.conversation_blocks || []); }
        catch { return []; }
      })();
      const signals: string[] = (() => {
        try { const ss = typeof session.signal_store === "string" ? JSON.parse(session.signal_store) : session.signal_store; return ss?.signals || []; }
        catch { return []; }
      })();
      const patterns: DetectedPattern[] = (() => {
        try { return typeof session.patterns === "string" ? JSON.parse(session.patterns) : (session.patterns || []); }
        catch { return []; }
      })();

      const lang: Language = (session.preferred_language || "en") as Language;
      const hi = lang === "hi" || lang === "hi_en";

      const concernKey    = classifyConcern("", session.initial_concern);
      const concernFamily = ONTOLOGY[concernKey]?.concernFamily || "general";
      const resumeQ       = getQuestion(session.current_state as RuntimeState, concernFamily);

      const resumeBlocks: ConversationBlock[] = [
        {
          id: "resume_01", type: "bridge",
          content: hi ? "Wapas aaye. Wahan se shuru karte hain jahan chhoda tha." : "Welcome back. Let's continue from where you left off.",
          emotionalTone: "gentle",
        },
        ...(resumeQ ? [{
          id: "resume_q",
          type: "question" as BlockType,
          content: getQuestionContent(resumeQ, lang),
          pacing: { speed: "medium" as PacingSpeed, delayMs: 600 },
        }] : []),
      ];

      res.json({
        session_id:        session.id,
        state:             session.current_state,
        narrative_label:   session.narrative_stage || NARRATIVE_LABELS[session.current_state as RuntimeState],
        prior_turns:       convBlocks,
        resume_blocks:     resumeBlocks,
        detected_patterns: patterns.filter((p: DetectedPattern) => p.category === "pattern"),
        interventions:     patterns.filter((p: DetectedPattern) => p.category === "intervention"),
        signal_count:      signals.length,
        quality_score:     session.quality_score || 0,
        response_type:     "chips",
        options:           resumeQ ? getQuestionOptions(resumeQ, lang) : [],
        drift_direction:   session.drift_direction || "new_session",
        is_escalated:      session.escalation_flagged || false,
        preferred_language: lang,
        session_mode:      session.session_mode || "standard",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get session ────────────────────────────────────────────────────────────
  app.get("/api/pragati/session/:sessionId", async (req: any, res: any) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM pragati_sessions WHERE id = ${req.params.sessionId} LIMIT 1`);
      if (rows.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows.rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Escalations ─────────────────────────────────────────────────────
  app.get("/api/admin/pragati/escalations", async (req: any, res: any) => {
    try {
      const page   = parseInt(req.query.page  || "1");
      const limit  = parseInt(req.query.limit || "25");
      const offset = (page - 1) * limit;
      const rows   = await db.execute(sql`
        SELECT id, email, name, initial_concern, escalation_reason,
               escalation_flagged, current_state, quality_score,
               emotional_weight, created_at, updated_at
        FROM pragati_sessions
        WHERE escalation_flagged = TRUE
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const total = await db.execute(sql`SELECT COUNT(*) FROM pragati_sessions WHERE escalation_flagged = TRUE`);
      res.json({ escalations: rows.rows, total: parseInt((total.rows[0] as any).count), page, limit });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Sessions overview ───────────────────────────────────────────────
  app.get("/api/admin/pragati/sessions", async (req: any, res: any) => {
    try {
      const page   = parseInt(req.query.page  || "1");
      const limit  = parseInt(req.query.limit || "25");
      const offset = (page - 1) * limit;
      const rows   = await db.execute(sql`
        SELECT id, email, name, initial_concern, current_state, narrative_stage,
               quality_score, emotional_weight, escalation_flagged, drift_direction,
               turn_count, preferred_language, session_mode, depth_level,
               created_at, updated_at
        FROM pragati_sessions
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const stats = await db.execute(sql`
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE escalation_flagged = TRUE) as escalated,
               AVG(quality_score) as avg_quality,
               AVG(turn_count) as avg_turns,
               COUNT(*) FILTER (WHERE current_state = 'complete') as completed,
               COUNT(*) FILTER (WHERE session_mode = 'quick_clarity') as quick_clarity_count,
               COUNT(*) FILTER (WHERE preferred_language != 'en') as multilingual_count
        FROM pragati_sessions
      `);
      res.json({ sessions: rows.rows, stats: stats.rows[0] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Session detail ──────────────────────────────────────────────────
  app.get("/api/admin/pragati/sessions/:sessionId", async (req: any, res: any) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM pragati_sessions WHERE id = ${req.params.sessionId} LIMIT 1`);
      if (rows.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows.rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Resolve escalation ─────────────────────────────────────────────────────
  app.patch("/api/admin/pragati/escalations/:sessionId/resolve", async (req: any, res: any) => {
    try {
      await db.execute(sql`UPDATE pragati_sessions SET escalation_flagged = FALSE, updated_at = now() WHERE id = ${req.params.sessionId}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Ontology / config exports ──────────────────────────────────────────────
  app.get("/api/pragati/concern-graph/:concern_key", (req: any, res: any) => {
    const key   = req.params.concern_key;
    const entry = ONTOLOGY[key];
    if (!entry) return res.json({ primary: key, related_patterns: [] });
    res.json({ primary: key, maps_to: entry.mapsTo, emotional_signals: entry.emotionalSignals, related_patterns: entry.relatedPatterns, concern_family: entry.concernFamily });
  });

  app.get("/api/pragati/flow-config", (_req: any, res: any) => {
    res.json({
      states: RUNTIME_STATES,
      narrative_labels: NARRATIVE_LABELS,
      state_sequence: STATE_SEQUENCE,
      quick_clarity_sequence: QUICK_CLARITY_SEQUENCE,
      ontology_keys: Object.keys(ONTOLOGY),
      pattern_count: PATTERN_RULES.length,
      reflection_template_count: REFLECTION_TEMPLATES.length,
      supported_languages: ["en","hi","hi_en","te","te_en","ta","kn","ml","mr"],
      session_modes: ["standard","quick_clarity","deep_reflection"],
    });
  });

  app.get("/api/pragati/ontology", (_req: any, res: any) => {
    res.json({ ontology: ONTOLOGY, pattern_rules: PATTERN_RULES });
  });
}
