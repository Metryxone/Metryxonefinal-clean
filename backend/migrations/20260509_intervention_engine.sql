-- S10: Intervention Engine
-- 1. Governed intervention library
CREATE TABLE IF NOT EXISTS intervention_library (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  construct_key      text        NOT NULL,
  confidence_band    text        NOT NULL CHECK (confidence_band IN ('high','moderate','low')),
  emotional_load_band text       NOT NULL CHECK (emotional_load_band IN ('high','moderate','low')),
  persona            text        NOT NULL CHECK (persona IN ('student','parent','teacher','counsellor')),
  intervention_text  text        NOT NULL,
  rationale          text        NOT NULL,
  safety_level       text        NOT NULL CHECK (safety_level IN ('informational','supportive','referral')),
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_il_construct      ON intervention_library(construct_key);
CREATE INDEX IF NOT EXISTS idx_il_safety         ON intervention_library(safety_level);
CREATE INDEX IF NOT EXISTS idx_il_active         ON intervention_library(is_active);

-- 2. Add source column to capadex_recommendations
ALTER TABLE capadex_recommendations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'rule_engine';
CREATE INDEX IF NOT EXISTS idx_capadex_recs_source ON capadex_recommendations(source);

-- 3. Seed ≥40 governed intervention templates
INSERT INTO intervention_library
  (construct_key, confidence_band, emotional_load_band, persona, intervention_text, rationale, safety_level)
VALUES

-- ── ATTENTION_REGULATION ─────────────────────────────────────────────────────
('ATTENTION_REGULATION','low','high','student',
 'Your attention profile shows real difficulty holding focus, and the emotional load right now is adding to that. Try one thing: find a very quiet space, set a 10-minute timer, and do only one task. When it ends, take a 3-minute walk. That cycle — focus, move, repeat — is the most effective reset for this pattern.',
 'Low confidence in attention regulation combined with high emotional load indicates compounded attention disruption. A structured focus-recovery cycle addresses both.',
 'supportive'),

('ATTENTION_REGULATION','moderate','moderate','student',
 'Attention regulation is functional but inconsistent. The most reliable improvement at this level is working with your environment: remove your phone from the room, close unneeded tabs, and work in blocks of 25 minutes with 5-minute movement breaks.',
 'Moderate confidence suggests the capacity exists but is situationally impaired. Environmental design is the most effective lever at this stage.',
 'informational'),

('ATTENTION_REGULATION','high','low','teacher',
 'This student''s attention regulation is strong and emotional load is low — an ideal condition for stretch tasks. Assign complex, multi-step work that requires sustained focus. This is the window to develop depth rather than breadth.',
 'High confidence with low emotional load: the student is in an optimal state for demanding cognitive work. Capitalise on this.',
 'informational'),

-- ── ANXIETY ──────────────────────────────────────────────────────────────────
('ANXIETY','low','high','student',
 'Your anxiety profile, combined with high emotional load, suggests you are in a period of significant stress. The priority right now is not pushing through — it is reducing physiological activation. Try: 4-7-8 breathing (inhale 4s, hold 7s, exhale 8s) twice daily. Then speak to your school counsellor this week.',
 'Low confidence in anxiety management with high emotional load warrants both immediate coping support and a pathway to professional guidance.',
 'supportive'),

('ANXIETY','low','high','counsellor',
 'This individual''s anxiety profile, combined with high emotional load, warrants a careful, supported conversation. When anxiety and emotional load are both high, self-management strategies alone are insufficient — a guided pastoral conversation with a trained counsellor is the appropriate next step before any skill-based work begins.',
 'Low confidence + high load: the pattern indicates the individual needs supported conversation, not additional self-directed strategies. Pastoral guidance is the appropriate entry point.',
 'referral'),

('ANXIETY','moderate','moderate','parent',
 'Your child is showing moderate anxiety signals. The most helpful thing you can do right now is maintain predictable routines, reduce performance-related pressure, and create one daily moment of genuine non-evaluative connection — a conversation with no agenda.',
 'Moderate anxiety with moderate emotional load in a family context responds most effectively to environmental stability and reduced evaluative pressure from caregivers.',
 'informational'),

('ANXIETY','high','low','student',
 'Managing anxiety is clearly a well-developed skill for you — your strategies are working and emotional load is manageable. Use this strength actively: if you notice anxiety rising, you have the tools. Share your techniques with someone who is struggling.',
 'High confidence in anxiety management with low load: this is a strength to acknowledge and leverage socially.',
 'informational'),

-- ── IMPULSE_CONTROL ──────────────────────────────────────────────────────────
('IMPULSE_CONTROL','low','high','student',
 'High emotional load is significantly amplifying impulse control difficulty. When emotional load is high, the brain''s impulse-inhibition circuit is functionally overridden. The intervention is to reduce load first: identify what is driving the emotional weight and address that before working on impulse control directly.',
 'Impulse control under high emotional load is a load-management problem, not a character problem. Addressing load is the prerequisite.',
 'supportive'),

('IMPULSE_CONTROL','moderate','moderate','student',
 'Your impulse control is improving but breaks down under moderate pressure. Try implementation intentions: write "When I feel the urge to [distraction], I will [specific substitute action]." This pre-plans the response so it doesn''t require willpower in the moment.',
 'Moderate impulse control responds well to if-then planning, which bypasses the need for real-time decision-making under moderate emotional load.',
 'informational'),

-- ── EXECUTIVE_FUNCTION ───────────────────────────────────────────────────────
('EXECUTIVE_FUNCTION','low','high','student',
 'When emotional load is high, executive function — planning, organising, prioritising — is significantly impaired. This is not a permanent state. Write down three tasks in priority order each morning. Do only the first one until it is done. This externalises the executive function your working brain is struggling to maintain.',
 'External organisation systems compensate for executive function impairment under high emotional load by reducing the cognitive demands of self-management.',
 'supportive'),

('EXECUTIVE_FUNCTION','moderate','moderate','teacher',
 'This student shows developing executive function with moderate emotional load. Scaffolded task structures — explicit templates, step-by-step guides, visible checklists — reduce the cognitive overhead that is limiting independent task management.',
 'Moderate executive function in students responds most reliably to structured scaffolds that reduce the working memory demands of self-organisation.',
 'informational'),

('EXECUTIVE_FUNCTION','high','low','student',
 'Executive function is a genuine strength and emotional load is low — you are operating in an optimal state. Use this to tackle your most complex or postponed tasks. This is the best time to plan the next 2-3 weeks in detail.',
 'Peak state: high executive function, low load. Encourage maximising productivity on highest-priority work.',
 'informational'),

-- ── PROCRASTINATION ──────────────────────────────────────────────────────────
('PROCRASTINATION','low','high','student',
 'Procrastination is severe right now, and high emotional load is feeding it. When anxiety is high, avoidance feels like protection. The entry point is the smallest possible action: open the document, write one sentence, then stop. The starting problem is the whole problem.',
 'Severe procrastination with high emotional load is driven by avoidance of negative affect. Minimising task initiation cost bypasses the avoidance cycle.',
 'supportive'),

('PROCRASTINATION','moderate','moderate','student',
 'You can start tasks but delay under uncertainty or lack of motivation. The "2-minute rule": if a task takes less than 2 minutes, do it now. For larger tasks, schedule a specific start time (not a due date). Starting at 9:00am is more actionable than "today".',
 'Moderate procrastination responds to reducing task-initiation friction and converting vague deadlines into specific start commitments.',
 'informational'),

('PROCRASTINATION','high','low','parent',
 'Your child has strong task-initiation habits and low emotional load — a positive state. Acknowledge this explicitly. Positive reinforcement of the anti-procrastination behaviour (starting promptly, working through difficulty) strengthens the pattern.',
 'High competence, low load: caregivers reinforce the behaviour by naming and appreciating it specifically.',
 'informational'),

-- ── EMOTIONAL_REGULATION ─────────────────────────────────────────────────────
('EMOTIONAL_REGULATION','low','high','counsellor',
 'This individual shows significantly impaired emotional regulation under currently high emotional load. The priority is stabilisation — not skill-building. Grounding techniques (5-4-3-2-1 sensory grounding, box breathing) should be offered immediately. If the emotional state is prolonged or accompanied by withdrawal, professional assessment is warranted.',
 'Low emotional regulation under high load is a stability risk. Grounding > skill development at this phase.',
 'referral'),

('EMOTIONAL_REGULATION','moderate','moderate','student',
 'Your emotional regulation is developing — you can manage moderate emotional situations but lose control under sustained pressure. The daily practice is labelling: when you feel an emotion, name it specifically (not "bad" but "frustrated because I don''t understand this"). Precise labelling reduces emotional intensity measurably.',
 'Affect labelling activates the prefrontal cortex and reduces amygdala activation, the mechanism behind the regulation difficulty at moderate levels.',
 'informational'),

('EMOTIONAL_REGULATION','high','low','student',
 'Emotional regulation is a genuine strength. When others around you lose composure under pressure, you tend to stay steady. Use this deliberately — become the stabilising presence in group situations where emotions run high.',
 'High regulation, low load: this is a social-emotional leadership asset. Encourage deliberate application.',
 'informational'),

-- ── SELF_ESTEEM ──────────────────────────────────────────────────────────────
('SELF_ESTEEM','low','high','student',
 'Low self-esteem under high emotional load creates a reinforcing cycle: feeling bad about yourself makes difficulties feel permanent. The first step is evidence-based: write three things you have done in the last month that required effort or skill — not outcomes, but actions. Read them before any high-stakes task.',
 'Contingent self-esteem under high load responds to evidence-based self-affirmation that separates performance from worth.',
 'supportive'),

('SELF_ESTEEM','low','high','counsellor',
 'Low self-worth combined with high emotional load warrants careful attention and a supported wellbeing check-in. When self-esteem is very low and load is high, confidence-building activities are less effective than a genuine, safe pastoral conversation that creates space to be heard without judgement.',
 'Low self-esteem + high emotional load is a pattern that benefits from supported pastoral attention before any skill-building or confidence interventions are introduced.',
 'referral'),

('SELF_ESTEEM','moderate','moderate','parent',
 'Your child''s self-esteem is developing but fragile. The most powerful thing you can do is give process praise (praising effort and strategy, not intelligence or outcomes) and reduce comparative language ("your sister" or "top students") which undermines developing self-worth.',
 'Developing self-esteem in young people is most damaged by comparative and outcome-focused parental feedback.',
 'informational'),

-- ── RESILIENCE ───────────────────────────────────────────────────────────────
('RESILIENCE','low','high','student',
 'Resilience is low and emotional load is high — you are in the hardest part of the cycle. The priority is not "bouncing back" right now, it is reducing the load that is making recovery impossible. Identify one thing you can remove from your obligations this week and remove it.',
 'Resilience cannot develop while the baseline load exceeds capacity. Load reduction is the prerequisite for recovery.',
 'supportive'),

('RESILIENCE','moderate','moderate','teacher',
 'This student has moderate resilience — setbacks create disruption but recovery does eventually happen. Create explicit recovery moments: after a difficult test or assignment, a brief low-stakes "reset" activity before the next challenge gives the resilience system time to restore.',
 'Resilience in developing students is not unlimited. Intentional recovery time between demands is an instructional design intervention.',
 'informational'),

-- ── STRESS_MANAGEMENT ────────────────────────────────────────────────────────
('STRESS_MANAGEMENT','low','high','student',
 'Stress management is significantly underdeveloped and emotional load is high — this is the combination most likely to cause burnout. Immediate priorities: reduce caffeine, ensure 8 hours of sleep tonight, and tell one person how you are feeling. These are not luxuries, they are the baseline for any other intervention to work.',
 'Low stress management with high load creates burnout risk. Physiological restoration is the necessary first step.',
 'supportive'),

('STRESS_MANAGEMENT','moderate','moderate','student',
 'Stress management is functional but breaks down when multiple demands stack up. Build a "pressure audit": list all current obligations and rate each 1-10 for urgency. Drop or defer anything rated below 5. Visible load management prevents the stack overflow.',
 'Moderate stress management under moderate load benefits from explicit load-reduction strategies rather than only coping skills.',
 'informational'),

-- ── INTRINSIC_MOTIVATION ─────────────────────────────────────────────────────
('INTRINSIC_MOTIVATION','low','high','student',
 'Motivation has dropped significantly, and emotional load is making everything feel pointless. This is not a character flaw — it is the psychology of sustained pressure with no visible progress. Find one tiny thing that used to interest you and spend 10 minutes on it today. Not for any outcome. Just to feel curiosity again.',
 'Motivational depletion under high load is a psychological safety response, not laziness. Re-engagement starts with intrinsic curiosity, not external goals.',
 'supportive'),

('INTRINSIC_MOTIVATION','moderate','moderate','teacher',
 'This student shows selective motivation — engaged when interested, disengaged when not. Connect mandatory content to the student''s identified interests. Ask: "What does this topic connect to that you actually care about?" and make that the entry point.',
 'Interest-driven framing activates intrinsic motivation even in low-interest subjects by connecting to the student''s existing motivational system.',
 'informational'),

('INTRINSIC_MOTIVATION','high','low','student',
 'Motivation is strong and emotional load is low — you are in the best state to tackle your most ambitious goals. Use this window. Set a stretch goal that would genuinely excite you if you achieved it, and start on it today.',
 'Peak motivation + low load = optimal window for ambitious goal pursuit. Capitalise before conditions change.',
 'informational'),

-- ── GOAL_ORIENTATION ─────────────────────────────────────────────────────────
('GOAL_ORIENTATION','low','high','student',
 'Goal-setting feels overwhelming right now, and emotional load is amplifying that. Reduce the scope: set one goal for today only. Not this week, not this month — today. What is one thing that, if you did it, would make tomorrow slightly easier? Do that.',
 'High load narrows planning horizon adaptively. Ultra-short goal horizons (daily) are more achievable under load than longer-term goals.',
 'supportive'),

('GOAL_ORIENTATION','moderate','moderate','student',
 'Goal orientation is developing — you set goals but struggle to maintain them under pressure. Use the OKR approach: define one Objective (what you want to achieve) and three Key Results (specific, measurable outcomes). Review weekly on the same day and time.',
 'Structured goal frameworks reduce the cognitive effort of self-directed goal pursuit and create natural review cycles.',
 'informational'),

-- ── SOCIAL_CONFIDENCE ────────────────────────────────────────────────────────
('SOCIAL_CONFIDENCE','low','high','student',
 'Social confidence is low and emotional load is high — social situations feel threatening right now. Don''t force high-interaction settings. Start with one safe relationship: one person you can talk to without performing. Invest in that one connection before expanding.',
 'Social anxiety under high load requires a minimal-exposure, high-safety entry point. Forced social exposure at this level worsens avoidance.',
 'supportive'),

('SOCIAL_CONFIDENCE','moderate','moderate','parent',
 'Your child shows developing social confidence with some situational anxiety. Avoid pressuring social performance ("why don''t you talk to them?") and instead create low-stakes social environments — small groups, structured shared activities — where success is more likely.',
 'Developing social confidence in young people is most supported by engineered success experiences rather than direct encouragement.',
 'informational'),

-- ── DIGITAL_DEPENDENCY ───────────────────────────────────────────────────────
('DIGITAL_DEPENDENCY','low','high','student',
 'Digital dependency is high and emotional load is compounding it — screens are likely being used as an emotional regulation tool. The intervention is not restriction but replacement: identify what feeling you are seeking (calm, stimulation, connection) and find one offline way to get it.',
 'Digital dependency under high load is emotion-driven, not willpower-driven. Need replacement addresses the underlying function.',
 'supportive'),

('DIGITAL_DEPENDENCY','moderate','moderate','parent',
 'Your child''s digital use is in the developing range — there is some self-regulation but it breaks down in unstructured time. Environmental design is more effective than restriction: create phone-free zones (dinner table, bedroom), and phone-free times (first and last hour of day), without making screens the enemy.',
 'Parental environmental design is more effective than rule-enforcement for developing digital self-regulation in adolescents.',
 'informational'),

-- ── CAREER_CLARITY ───────────────────────────────────────────────────────────
('CAREER_CLARITY','low','moderate','student',
 'Career direction feels very unclear right now. That is normal and not a failure — most people your age don''t have it figured out either. The useful move is not to decide, but to explore: interview one person doing work that sounds remotely interesting. The information beats the anxiety.',
 'Career ambiguity at developing stage is normal. Exploration (not decision) is the developmentally appropriate intervention.',
 'informational'),

('CAREER_CLARITY','moderate','moderate','counsellor',
 'This individual has some career direction but significant uncertainty. Strengths-based exploration (identifying what energises them, not just what they are good at) is more generative at this stage than aptitude matching. Try: "Describe a time you felt fully engaged in something — what were you doing?"',
 'Moderate career clarity benefits from intrinsic interest exploration more than external aptitude assessment.',
 'informational'),

-- ── WORKING_MEMORY ───────────────────────────────────────────────────────────
('WORKING_MEMORY','low','high','student',
 'Working memory is struggling, and high emotional load is making it worse — stress measurably reduces working memory capacity. Externalise everything: write down tasks, instructions, and ideas immediately. Don''t rely on remembering anything right now. Your phone''s notes app is your working memory.',
 'Working memory is directly impaired by stress hormones. External memory systems are a functional compensation strategy under high load.',
 'informational'),

('WORKING_MEMORY','moderate','moderate','teacher',
 'This student''s working memory is developing. Chunking — breaking instructions into 2-3 step sequences (not 6-7) — and visual organisers significantly reduce the working memory demand of instructional tasks.',
 'Chunking and visual scaffolds are evidence-based working memory compensations for students in the developing range.',
 'informational'),

-- ── PROCESSING_SPEED ─────────────────────────────────────────────────────────
('PROCESSING_SPEED','low','high','student',
 'Processing speed is low and emotional load is high — this is the combination that makes timed tasks feel impossible. Advocate for yourself: request extended time on assessments if available. This is not an advantage, it is removing an artificial barrier.',
 'Low processing speed under load creates compounding disadvantage in timed settings. Self-advocacy for accommodations is the appropriate intervention.',
 'supportive'),

('PROCESSING_SPEED','moderate','moderate','parent',
 'Your child processes information at a moderate pace — adequate in most settings but showing difficulty under time pressure. Avoid rushing their responses at home. Waiting an extra 10 seconds after asking a question — silently — changes the dynamic significantly.',
 'Parental response latency directly models and enables the child''s natural processing pace, reducing speed-related anxiety.',
 'informational'),

-- ── FAMILY_DYNAMICS ──────────────────────────────────────────────────────────
('FAMILY_DYNAMICS','low','high','student',
 'Family relationship difficulties are creating significant emotional load. When home is a source of stress, everything else becomes harder. You don''t have to resolve the family situation, but you do need one safe space outside of it — a teacher, a counsellor, a friend''s parent. Please identify that person this week.',
 'Family stress without a compensating safe relationship is a significant wellbeing risk factor. Safe adult identification is the immediate priority.',
 'referral'),

('FAMILY_DYNAMICS','moderate','moderate','counsellor',
 'Family dynamics are a contributing factor to this individual''s current difficulties. A parental consultation (with the student''s informed consent) to share observations and coordinate supportive strategies at home can reduce the home-school stress gap.',
 'Family-school coordination, when safe and consented, reduces the compounding effect of home and school stressors.',
 'supportive'),

-- ── HABIT_FORMATION ──────────────────────────────────────────────────────────
('HABIT_FORMATION','low','high','student',
 'Building habits is very difficult right now, and high emotional load is the main reason — habit formation requires cognitive stability that stress depletes. Focus on one 2-minute habit only: the smallest possible version of the habit you want to build. Consistency matters infinitely more than intensity at this stage.',
 'Habit formation requires cognitive resources that are depleted by high emotional load. Micro-habits require minimal resources while building neural grooves.',
 'informational'),

('HABIT_FORMATION','moderate','moderate','student',
 'Habit formation is developing — you can build habits but they break down under disruption. Use "never miss twice": one missed day is allowed, two in a row is the line you do not cross. This rule is more effective than perfectionistic all-or-nothing thinking.',
 'The "never miss twice" rule maintains habit continuity by removing the catastrophising that causes habit abandonment after a single failure.',
 'informational'),

-- ── CRITICAL_THINKING ────────────────────────────────────────────────────────
('CRITICAL_THINKING','low','moderate','student',
 'Critical thinking is an area to develop. Start with one daily practice: when you encounter an opinion or claim, ask "What evidence would change this conclusion?" You don''t need to find the answer — just ask the question. The habit of questioning builds the skill.',
 'Critical thinking at low confidence requires habit formation around questioning, not instruction in complex analytical frameworks.',
 'informational'),

('CRITICAL_THINKING','high','low','teacher',
 'This student demonstrates strong critical thinking. Challenge them with arguments they instinctively agree with and ask them to steelman the opposing view. The next growth edge is applying critical rigor to their own positions, not just to others''.',
 'High confidence critical thinkers most benefit from applying their skills to their own positions — the hardest and most valuable application.',
 'informational'),

-- ── MENTAL_HEALTH ────────────────────────────────────────────────────────────
('MENTAL_HEALTH','low','high','counsellor',
 'Wellbeing indicators at this level, combined with high emotional load, indicate a priority pastoral concern. A warm, structured check-in conversation — creating a genuine safe space — is the most appropriate first step. Understand what is happening for this individual before introducing any strategy or skill-building support.',
 'Low wellbeing with high emotional load is the highest-priority flag in this framework. A pastoral wellbeing conversation takes priority over any skill-based intervention at this level.',
 'referral'),

('MENTAL_HEALTH','moderate','moderate','student',
 'Psychological wellbeing shows some strain. The most evidence-supported daily practices at this level are: 20 minutes of physical movement (any form), 7-9 hours of consistent sleep, and one meaningful conversation per day. These are not wellness suggestions — they are the physiological base without which any other improvement is difficult.',
 'Moderate wellbeing benefits most from physiological foundations: movement, sleep, and connection are the highest-leverage interventions.',
 'supportive'),

-- ── LEARNING_APPROACH ────────────────────────────────────────────────────────
('LEARNING_APPROACH','low','moderate','student',
 'Learning is happening at a surface level — memorising rather than understanding. After your next study session, close your notes and write three sentences: what was the main idea, why does it matter, and what does it connect to? This single practice shifts processing depth significantly.',
 'The elaboration technique (writing connections and implications) is the most reliable method for shifting surface learners to deeper processing.',
 'informational'),

('LEARNING_APPROACH','high','low','teacher',
 'This student uses deep learning strategies effectively. Give them tasks that require synthesis across topics or disciplines — they are ready for complexity that rewards cross-domain thinking.',
 'Deep learning strategies at high confidence require higher-order application challenges to continue developing.',
 'informational'),

-- ── EXAM_READINESS ───────────────────────────────────────────────────────────
('EXAM_READINESS','low','high','student',
 'Exam preparation is significantly underdeveloped and emotional load is amplifying the difficulty. Start with one action today: list the three topics you are most uncertain about on paper. That list is the beginning of a plan. The act of making the list reduces the anxiety slightly.',
 'Exam anxiety combined with inadequate preparation creates paralysis. A concrete next action (topic list) breaks the paralysis loop.',
 'supportive'),

('EXAM_READINESS','moderate','moderate','parent',
 'Your child''s exam preparation has gaps. The most effective parent action right now is logistics support, not academic pressure: provide quiet study time, manage family disruptions during study periods, and ask "what do you need?" rather than "are you studying?"',
 'Parental exam support is most effective through environmental facilitation and needs-based questions, not academic monitoring.',
 'informational'),

-- ── COMMUNICATION ────────────────────────────────────────────────────────────
('COMMUNICATION','low','high','student',
 'Communication is difficult right now, and high emotional load is making it worse — when emotional activation is high, language access and clarity both decrease. Focus on written communication first: email or message rather than speaking when possible. Writing externalises the thinking that anxiety scrambles.',
 'High emotional load impairs expressive language directly. Written communication bypasses real-time verbal processing difficulties.',
 'supportive'),

('COMMUNICATION','moderate','moderate','teacher',
 'This student communicates effectively one-on-one but struggles in group or assessed settings. Low-stakes verbal practice — pair shares, brief ungraded presentations, small-group discussion — reduces the performance anxiety that suppresses public communication.',
 'Public communication development requires progressive exposure in low-stakes settings to reduce performance anxiety incrementally.',
 'informational'),

-- ── PEER_RELATIONS ───────────────────────────────────────────────────────────
('PEER_RELATIONS','low','high','student',
 'Peer relationships are difficult right now, and emotional load is making social situations feel threatening. You don''t need to solve the social situation — you need one relationship. One person you can be honest with. That one connection is the foundation everything else can build from.',
 'Social difficulties under high load should focus on depth (one safe relationship) not breadth (general social skills). Minimising social threat is the priority.',
 'supportive'),

('PEER_RELATIONS','low','high','counsellor',
 'Peer relationship difficulties at this level, combined with high emotional load, indicate a priority pastoral concern. A structured, safe conversation exploring what the social difficulties actually look like for this individual is the necessary first step — listening and understanding the pattern before designing any support response.',
 'Peer difficulties under high load may have situational causes (isolation, exclusion, or conflict) that require pastoral understanding before any individual skills intervention is appropriate.',
 'referral'),

-- ── SKILL_AWARENESS ──────────────────────────────────────────────────────────
('SKILL_AWARENESS','low','moderate','student',
 'You don''t yet have a clear picture of your actual strengths. Here''s a quick exercise: ask three people who know your work — teachers, peers, family — to name one thing you do better than most people they know. Their answers will show you what you cannot see from the inside.',
 'External feedback is more accurate than introspective self-assessment for developing skill awareness, especially when the baseline self-map is incomplete.',
 'informational'),

('SKILL_AWARENESS','moderate','low','counsellor',
 'This individual has partial skill awareness — they know some strengths but the map is incomplete or inaccurate. A structured strengths inventory (VIA Character Strengths or StrengthsFinder) combined with a debrief conversation surfaces what self-reflection misses.',
 'Validated strengths inventories are more reliable than introspection alone for individuals with incomplete self-awareness.',
 'informational'),

-- ── DIGITAL_DISCIPLINE ───────────────────────────────────────────────────────
('DIGITAL_DISCIPLINE','low','high','student',
 'Digital self-discipline is low and emotional load is high — screens are likely providing emotional relief, not entertainment. The most effective intervention is not restriction but recognition: log what you were feeling before picking up your phone for the next 3 days. The pattern reveals the function.',
 'Digital overuse under high emotional load is often emotion-regulation behaviour. Awareness of the antecedent emotion is the entry point for change.',
 'supportive'),

-- ── EXAM_PERFORMANCE ─────────────────────────────────────────────────────────
('EXAM_PERFORMANCE','low','high','student',
 'Exam performance is low and emotional load is high — the pattern suggests performance anxiety is the primary driver. The intervention is to make assessments feel less threatening: take 3 practice tests under low-stakes conditions (no consequences, self-scored, no comparison). Familiarity reduces the threat response.',
 'Exam performance anxiety responds to progressive desensitisation through low-stakes rehearsal of exam conditions.',
 'supportive'),

-- ── ACADEMIC_RECOVERY ────────────────────────────────────────────────────────
('ACADEMIC_RECOVERY','low','high','student',
 'Academic recovery is very difficult right now — setbacks feel catastrophic and emotional load is preventing re-engagement. The immediate priority is not catching up, it is stabilising. Tell your teacher you are struggling. That conversation is the first step of recovery.',
 'Academic recovery under high load requires a supported re-engagement pathway. Self-disclosure to a trusted teacher activates support structures.',
 'supportive'),

('ACADEMIC_RECOVERY','moderate','moderate','teacher',
 'This student has some capacity to recover from academic setbacks but the recovery is slow. Build a defined re-engagement protocol after each assessment: a specific conversation about what happened, what they will do differently, and one achievable next action. The protocol removes the ambiguity that extends disengagement.',
 'Recovery protocols reduce the time between setback and re-engagement by replacing open-ended uncertainty with structured next steps.',
 'informational'),

-- ── PHYSICAL_WELLBEING ───────────────────────────────────────────────────────
('PHYSICAL_WELLBEING','low','high','student',
 'Physical wellbeing is significantly affecting everything else. The single highest-impact change you can make today is this: set a consistent wake time for tomorrow and every day this week — regardless of when you go to bed. A consistent wake time is the fastest way to stabilise sleep architecture.',
 'Consistent wake time is the evidence-based anchor for circadian rhythm stabilisation, which underpins cognitive and emotional function.',
 'informational'),

-- ── SAFETY_THREATS ───────────────────────────────────────────────────────────
('SAFETY_THREATS','low','high','counsellor',
 'Safety threat signals at high emotional load indicate an urgent pastoral priority. A private, confidential conversation exploring both online and offline safety experiences is required. If any disclosure is made, safeguarding protocols must be followed immediately.',
 'Safety threat indicators at high load are a mandatory professional action item. Safeguarding protocol activation takes priority over all other interventions.',
 'referral'),

('SAFETY_THREATS','moderate','moderate','parent',
 'Signals suggest your child may be experiencing threatening situations — possibly online. The most effective approach is an open, non-judgmental conversation that begins with listening, not questions. Starting with "I''ve noticed something seems to be worrying you lately — I''m here when you''re ready to talk" is more likely to be met than direct questioning.',
 'Adolescents disclose safety threats more readily to caregivers who signal availability and non-judgment rather than those who ask direct questions.',
 'supportive'),

-- ── CREATIVITY ───────────────────────────────────────────────────────────────
('CREATIVITY','low','moderate','student',
 'Creative thinking is constrained right now. Start with one daily practice: pick any ordinary object and list five non-obvious uses for it. This forces the brain into divergent mode. The habit builds the neural pathway — consistency beats intensity here.',
 'Divergent thinking practice (creative object exercises) activates the default mode network and builds divergent thinking capacity over time.',
 'informational'),

-- ── LEARNING_DRIVE ───────────────────────────────────────────────────────────
('LEARNING_DRIVE','low','high','student',
 'The drive to learn has significantly diminished, and emotional load is the primary reason — when emotional resources are depleted, curiosity shuts down as a protective response. The way back is not forcing learning — it is finding one thing you are genuinely curious about and following it, with no obligation to produce anything.',
 'Curiosity is a casualty of high emotional load. Non-obligatory exploration is the re-entry point because it carries no performance stakes.',
 'supportive');
