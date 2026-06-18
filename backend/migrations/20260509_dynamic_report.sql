-- S9: Dynamic Reporting Engine
-- Adds dynamic_report column to capadex_reports and creates governed insight_templates table

ALTER TABLE capadex_reports
  ADD COLUMN IF NOT EXISTS dynamic_report JSONB;

CREATE TABLE IF NOT EXISTS insight_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  construct_key     TEXT        NOT NULL,
  confidence_band   TEXT        NOT NULL CHECK (confidence_band IN ('high', 'moderate', 'low')),
  persona           TEXT        NOT NULL CHECK (persona IN ('student', 'parent', 'teacher', 'counsellor')),
  insight_text      TEXT        NOT NULL,
  why_generated     TEXT        NOT NULL,
  growth_opportunity TEXT       NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_templates_lookup
  ON insight_templates (construct_key, confidence_band, persona);

-- ─── Seed: 60+ governed insight templates ─────────────────────────────────────
-- Covers 15 key constructs × up to 4 confidence_band/persona combinations each

INSERT INTO insight_templates (construct_key, confidence_band, persona, insight_text, why_generated, growth_opportunity) VALUES

-- ── ATTENTION_REGULATION ─────────────────────────────────────────────────────
('ATTENTION_REGULATION', 'high',     'student',
 'Your attention regulation is a genuine strength — you can sustain focus across demanding tasks and recover quickly when distracted.',
 'High confidence hypothesis supported by consistent behavioural signals and self-report alignment.',
 'Channel this strength into long-form, high-complexity work that others find difficult to sustain.'),

('ATTENTION_REGULATION', 'moderate', 'student',
 'Your attention holds well in structured settings but tends to fragment under pressure or in low-stimulation environments.',
 'Moderate confidence: signals show a context-dependent pattern rather than a global deficit.',
 'Identify the two or three specific conditions where focus breaks down — targeted changes there will create the biggest shift.'),

('ATTENTION_REGULATION', 'low',      'student',
 'Sustained focus is the area that needs the most attention in your profile. Concentration drifts frequently and recovery is slower than you would like.',
 'Low confidence hypothesis — more sessions needed to confirm; current signals suggest attention is the primary challenge.',
 'Begin with a single 15-minute focused session daily. Consistency matters more than duration at this stage.'),

('ATTENTION_REGULATION', 'low',      'counsellor',
 'Attention regulation appears to be a primary concern for this individual. Current signals suggest frequent drift and difficulty sustaining engagement beyond short intervals.',
 'Emerging hypothesis based on initial session data; further assessment will sharpen this picture.',
 'Consider structured attention-training exercises and environmental modifications before exploring other interventions.'),

('ATTENTION_REGULATION', 'moderate', 'parent',
 'Your child''s attention pattern shows real strengths in structured settings but consistent challenges in self-directed tasks.',
 'Moderate confidence: context-dependency is the defining signal.',
 'Support predictable routines and reduce transition points — these are the highest-leverage environmental adjustments.'),

-- ── WORKING_MEMORY ───────────────────────────────────────────────────────────
('WORKING_MEMORY', 'high',     'student',
 'You can hold and manipulate multiple pieces of information in mind simultaneously — a cognitive strength that underpins academic performance.',
 'High confidence: multiple signals align with strong working memory indicators.',
 'Use this advantage for multi-step problems and complex planning tasks that stretch your capacity further.'),

('WORKING_MEMORY', 'moderate', 'student',
 'Working memory is functional but loses reliability under load — when too much is happening at once, the ability to track steps and details degrades.',
 'Moderate confidence: load-dependent failure pattern detected across signals.',
 'Externalise working memory by writing steps, checklists, and reminders — this removes the cognitive overhead and frees capacity.'),

('WORKING_MEMORY', 'low',      'student',
 'Holding information in mind while doing something else — like following multi-step instructions — is consistently difficult and creates downstream errors.',
 'Low confidence hypothesis at this stage; initial signals suggest working memory load is a primary limiting factor.',
 'Start with written lists and numbered steps for all multi-part tasks. Build the externalisation habit before attempting to train the capacity directly.'),

('WORKING_MEMORY', 'low',      'counsellor',
 'Working memory load appears to be a limiting factor for this individual. Tasks requiring simultaneous information-holding are likely creating disproportionate cognitive strain.',
 'Emerging signal pattern — further assessment recommended to confirm.',
 'Scaffolding (written steps, reduced instruction length, check-ins at key points) will provide immediate relief while the underlying pattern is confirmed.'),

-- ── PROCESSING_SPEED ─────────────────────────────────────────────────────────
('PROCESSING_SPEED', 'high',     'student',
 'You process information quickly and accurately — this gives you a genuine speed advantage in timed tasks and rapid-decision environments.',
 'High confidence: timing signals and response accuracy align with fast processing indicators.',
 'Pair your speed with deliberate checking — high-speed processing can sometimes skip validation steps.'),

('PROCESSING_SPEED', 'moderate', 'student',
 'Processing speed is adequate but variable — you perform well when given sufficient time but can rush or stall when pressed.',
 'Moderate confidence: context-dependent processing pattern detected.',
 'Practice timed exercises at slightly below comfort pace to build consistent speed without sacrificing accuracy.'),

('PROCESSING_SPEED', 'low',      'counsellor',
 'Processing speed appears below the expected range for this individual''s profile. Responses are slower under time pressure and accuracy drops significantly in high-load conditions.',
 'Emerging hypothesis — low confidence at this stage; needs cross-session confirmation.',
 'Accommodations such as extended time and reduced task chunk size are likely to produce immediate improvement in demonstrated performance.'),

-- ── EXECUTIVE_FUNCTION ───────────────────────────────────────────────────────
('EXECUTIVE_FUNCTION', 'high',     'student',
 'Your executive function is a clear strength — you can plan, sequence tasks, manage time, and adapt when plans change.',
 'High confidence: signals show consistent planning initiation and low task-switching friction.',
 'Apply this capacity to your most complex, multi-week goals — this is the leverage point where your profile outperforms.'),

('EXECUTIVE_FUNCTION', 'moderate', 'student',
 'Executive function holds up well in routine situations but breaks down under increased demand — complex projects or shifting priorities tend to create overload.',
 'Moderate confidence: demand-threshold pattern detected across multiple signals.',
 'Use a weekly review to map the week''s top three priorities before they arrive. Pre-planning reduces the real-time cognitive demand.'),

('EXECUTIVE_FUNCTION', 'low',      'student',
 'Planning, organising, and following through consistently are the areas where your profile shows the most significant challenge right now.',
 'Low confidence hypothesis — signals are strong but limited to initial session data.',
 'Start with one external system — a single to-do list used daily. Building the habit of externalisation is the foundation for everything else.'),

('EXECUTIVE_FUNCTION', 'low',      'parent',
 'Executive function is appearing as a significant challenge for your child — organising tasks, managing time, and following through consistently all require additional support.',
 'Emerging hypothesis based on initial signals; the pattern will sharpen with further sessions.',
 'External scaffolding (visual schedules, checklists, and predictable routines) will provide the most immediate relief.'),

('EXECUTIVE_FUNCTION', 'moderate', 'teacher',
 'This student''s executive function works well in structured tasks but degrades when independent planning is required.',
 'Moderate confidence: teacher-context signals and self-report are partially aligned.',
 'Breaking down complex assignments into explicit sub-steps with interim deadlines significantly reduces the executive load.'),

-- ── IMPULSE_CONTROL ──────────────────────────────────────────────────────────
('IMPULSE_CONTROL', 'high',     'student',
 'Impulse control is a genuine strength in your profile — you can resist immediate urges in favour of longer-term outcomes even under pressure.',
 'High confidence: inhibitory signals show consistent override of impulsive responses.',
 'Use this strength consciously in high-stakes decisions — it is a rare advantage worth protecting.'),

('IMPULSE_CONTROL', 'moderate', 'student',
 'You can resist impulses in calm conditions, but when stress or boredom increases, the control weakens and immediate gratification wins more often.',
 'Moderate confidence: condition-dependent failure pattern clearly visible in signals.',
 'Identify your two highest-risk trigger conditions and pre-plan one alternative response for each. Pre-commitment is more effective than real-time willpower.'),

('IMPULSE_CONTROL', 'low',      'student',
 'Impulse control is consistently below threshold — urges tend to override intentions, especially in low-structure or high-distraction environments.',
 'Low confidence — initial signals are strong but one-session data; confirmation needed.',
 'Reduce decision-making friction by removing triggers from your environment. The impulse is harder to resist when the stimulus is always present.'),

('IMPULSE_CONTROL', 'low',      'counsellor',
 'Inhibitory control appears to be a primary challenge. The individual is likely aware of the pattern but lacks effective real-time strategies to interrupt it.',
 'Emerging hypothesis — initial session signals suggest this is the primary self-regulation concern.',
 'Stimulus control and environmental restructuring are the highest-leverage first interventions at this confidence level.'),

-- ── EMOTIONAL_REGULATION ─────────────────────────────────────────────────────
('EMOTIONAL_REGULATION', 'high',     'student',
 'Emotional regulation is a real strength — you manage difficult emotions without them significantly altering your behaviour or decisions.',
 'High confidence: consistent self-report and low emotional volatility signals across sessions.',
 'Use this strength as a foundation to take on higher-stakes situations where emotional regulation creates a direct performance advantage.'),

('EMOTIONAL_REGULATION', 'moderate', 'student',
 'Emotional regulation works well in day-to-day situations but stacks of pressure or social difficulty create moments where emotions drive the response.',
 'Moderate confidence: threshold-triggered emotional pattern visible in signals.',
 'Build a 90-second rule: before responding to anything emotionally loaded, pause for 90 seconds. That window is enough to shift from reactive to intentional.'),

('EMOTIONAL_REGULATION', 'low',      'student',
 'Regulating strong emotions — especially frustration, anxiety, and disappointment — is the highest-priority growth area in your current profile.',
 'Low confidence — emerging pattern from initial assessment; further confirmation needed.',
 'Identify the physical signal that precedes an emotional response (tense shoulders, shallow breath). Catching that cue is the first step to interrupting the chain.'),

('EMOTIONAL_REGULATION', 'low',      'counsellor',
 'Emotional dysregulation appears to be a significant driver of behavioural difficulty for this individual. Responses are disproportionate and recovery time is extended.',
 'Emerging hypothesis — initial signals are consistent but low-volume.',
 'Psychoeducation on the emotion-behaviour link and co-regulation strategies are the recommended starting points.'),

('EMOTIONAL_REGULATION', 'moderate', 'parent',
 'Your child''s emotional regulation is developing but shows clear stress points — particularly around disappointment, conflict, and high-pressure moments.',
 'Moderate confidence: parent-reported and self-reported signals partially align.',
 'Validate emotions before redirecting behaviour. Emotional validation dramatically reduces the intensity and duration of dysregulation episodes.'),

-- ── ANXIETY ──────────────────────────────────────────────────────────────────
('ANXIETY', 'high',     'student',
 'Anxiety is playing a significant role in your current experience. It is showing up as a high-confidence signal across multiple areas of your behavioural profile.',
 'High confidence: anxiety indicators are consistent and cross-validated across signal types.',
 'The goal at this stage is not to eliminate anxiety but to reduce its interference with functioning. Targeted, low-intensity strategies are more effective than trying to suppress the anxiety directly.'),

('ANXIETY', 'moderate', 'student',
 'Anxiety is present and is creating measurable interference with performance in specific situations — particularly high-stakes or unfamiliar ones.',
 'Moderate confidence: context-specific anxiety signals detected.',
 'Map your highest-anxiety triggers precisely. Targeted preparation for those exact situations is more effective than general anxiety management.'),

('ANXIETY', 'low',      'counsellor',
 'Anxiety may be a contributing factor for this individual based on early signals. Low confidence at this stage — further exploration is recommended before drawing conclusions.',
 'Emerging signal — initial data suggests anxiety may be present but not yet clearly differentiated from general stress or performance concern.',
 'A structured clinical conversation to explore the nature, frequency, and interference level of anxious responses will clarify whether this hypothesis holds.'),

('ANXIETY', 'moderate', 'parent',
 'Anxiety signals are present in your child''s profile at a moderate confidence level. The anxiety appears to be situationally triggered rather than pervasive.',
 'Moderate confidence: situational pattern is consistent across multiple signal sources.',
 'Reduce performance pressure in the short term and support consistent, low-stakes engagement with the anxiety-triggering situation.'),

-- ── STRESS_MANAGEMENT ────────────────────────────────────────────────────────
('STRESS_MANAGEMENT', 'high',     'student',
 'Your stress management is a high-confidence strength — you perform well under pressure and recover without the residual carry-over that derails most people.',
 'High confidence: stress-response and recovery signals are consistently within functional range.',
 'Your pressure-handling capacity is an asset — deploy it deliberately in high-stakes situations where others struggle.'),

('STRESS_MANAGEMENT', 'moderate', 'student',
 'You manage moderate stress reasonably well, but when demands stack up — or recovery time is cut short — the system shows clear strain.',
 'Moderate confidence: threshold pattern visible in stress-response signals.',
 'Prioritise recovery between demanding periods. Stress capacity is finite; the goal is building recovery speed, not resistance.'),

('STRESS_MANAGEMENT', 'low',      'student',
 'Stress management is the most urgent area in your current profile — pressure is converting quickly into functional impairment in multiple areas.',
 'Low confidence — one-session data; the signal is clear but requires cross-session confirmation.',
 'Start with one daily decompression practice. Even 10 minutes of genuine recovery per day changes the stress accumulation trajectory significantly.'),

('STRESS_MANAGEMENT', 'low',      'teacher',
 'This student''s profile suggests stress management is significantly below the expected range. Academic pressure may be compounding the effect disproportionately.',
 'Emerging hypothesis — low confidence; further observation recommended.',
 'Reducing visible performance pressure and providing early, non-evaluative feedback can meaningfully reduce the stress load in the academic environment.'),

-- ── RESILIENCE ────────────────────────────────────────────────────────────────
('RESILIENCE', 'high',     'student',
 'Resilience is a clear strength in your profile — you recover from setbacks without extended derailment and maintain forward momentum through difficulty.',
 'High confidence: recovery-speed and persistence signals are consistently in the high range.',
 'Use this resilience to take on challenges with a higher failure probability — your recovery capacity makes risk-taking safer than it is for most people.'),

('RESILIENCE', 'moderate', 'student',
 'Resilience is functional but setbacks leave a heavier footprint than is ideal — recovery happens, but slowly, and the experience reduces willingness to try again.',
 'Moderate confidence: recovery delay pattern detected across signal sources.',
 'After each setback, write one concrete learning. This simple step accelerates recovery by anchoring meaning to the experience.'),

('RESILIENCE', 'low',      'student',
 'Recovering from difficulty is taking longer than is functionally healthy — setbacks are creating extended periods of disengagement or avoidance.',
 'Low confidence — initial session data; needs confirmation across further sessions.',
 'Build a defined recovery ritual — one specific action you take after a hard experience. Having a protocol reduces decision-making burden during low-resilience periods.'),

('RESILIENCE', 'low',      'counsellor',
 'Low resilience is appearing as a possible primary concern. Setbacks appear to be triggering disproportionate and extended periods of disengagement.',
 'Emerging hypothesis — low confidence at this stage.',
 'Reframing exercises (exploring what was learned vs what was lost) are an evidence-backed starting point at this confidence level.'),

-- ── DIGITAL_DEPENDENCY ───────────────────────────────────────────────────────
('DIGITAL_DEPENDENCY', 'high',     'student',
 'Digital dependency is a high-confidence finding in your profile — device use is structurally interfering with focus, sleep, and face-to-face engagement.',
 'High confidence: multiple signals align with compulsive and habitual device use patterns.',
 'Environmental restructuring — not willpower — is the highest-leverage intervention. Remove the device from the highest-risk contexts first.'),

('DIGITAL_DEPENDENCY', 'moderate', 'student',
 'Digital habits are creating intermittent interference — control is present in some contexts but collapses in others, particularly boredom and emotional stress.',
 'Moderate confidence: context-triggered pattern visible in digital-use signals.',
 'Identify the emotional state or situation that consistently precedes device pick-up. That''s the intervention point — address the need being met, not the device itself.'),

('DIGITAL_DEPENDENCY', 'low',      'parent',
 'Early signals suggest digital dependency may be developing, though confidence is low at this stage. Monitoring patterns over time will clarify this picture.',
 'Emerging hypothesis — initial assessment data only.',
 'Establishing clear digital boundaries and screen-free periods now — before patterns consolidate — is significantly easier than reversing established habits later.'),

('DIGITAL_DEPENDENCY', 'moderate', 'counsellor',
 'Digital dependency is emerging as a moderate-confidence concern. The pattern appears habitual rather than compulsive at this stage.',
 'Moderate confidence: habitual patterns visible; compulsive indicators absent.',
 'A usage diary and structured reflection on the emotional needs being met by device use will surface the most productive intervention points.'),

-- ── INTRINSIC_MOTIVATION ─────────────────────────────────────────────────────
('INTRINSIC_MOTIVATION', 'high',     'student',
 'Intrinsic motivation is a genuine strength — you engage with meaningful work for its own sake and sustain effort without requiring external pressure.',
 'High confidence: self-directed engagement signals are consistently high.',
 'Protect this motivation by maintaining connection between work and personal meaning. External pressure, if dominant, can erode intrinsic drive over time.'),

('INTRINSIC_MOTIVATION', 'moderate', 'student',
 'Motivation is present but selective — it shows up reliably for work that feels relevant or interesting, and largely disappears when it doesn''t.',
 'Moderate confidence: relevance-dependent motivation pattern is the dominant signal.',
 'Connect upcoming tasks to a concrete personal outcome that matters. The motivation follows the meaning — not the task itself.'),

('INTRINSIC_MOTIVATION', 'low',      'student',
 'Intrinsic motivation is significantly reduced in your current profile — the drive to engage and persist is not showing up reliably across tasks.',
 'Low confidence hypothesis — initial signals suggest motivation is the primary concern but further sessions are needed.',
 'Start by identifying one activity in your day that still feels internally rewarding. That''s the anchor point to build back from.'),

('INTRINSIC_MOTIVATION', 'low',      'teacher',
 'This student''s profile suggests low intrinsic motivation is limiting engagement with academic work. Extrinsic pressure is unlikely to be effective at this level.',
 'Low confidence — initial assessment only.',
 'Connecting coursework to student-identified interests or goals, even tangentially, creates more engagement than external incentives at this motivational level.'),

-- ── GOAL_ORIENTATION ─────────────────────────────────────────────────────────
('GOAL_ORIENTATION', 'high',     'student',
 'Goal orientation is a high-confidence strength — you set meaningful goals, maintain commitment, and sustain effort even when progress is slow.',
 'High confidence: goal-maintenance and effort signals are consistently strong.',
 'Apply this capacity to longer time horizons — 6-to-12-month goals where your goal-holding ability becomes a compounding advantage.'),

('GOAL_ORIENTATION', 'moderate', 'student',
 'You can set goals effectively but struggle to maintain them when progress stalls or the goal feels distant.',
 'Moderate confidence: goal-maintenance-under-difficulty pattern is the key signal.',
 'Use milestone markers at every 20% of progress — visible markers of advancement prevent the motivational collapse that comes from only measuring against the end state.'),

('GOAL_ORIENTATION', 'low',      'student',
 'Setting and holding meaningful goals is currently one of the most significant challenges in your behavioural profile.',
 'Low confidence — initial session only; needs confirmation.',
 'Start with a goal that is achievable in 7 days. Success builds the goal-setting muscle more reliably than ambitious goal-setting training.'),

-- ── PROCRASTINATION ──────────────────────────────────────────────────────────
('PROCRASTINATION', 'high',     'student',
 'Procrastination is showing up as a high-confidence behavioural pattern — delay is consistent, tasks accumulate, and the resulting pressure compounds the problem.',
 'High confidence: avoidance and delay signals align across multiple signal types.',
 'Procrastination is almost always driven by a specific negative emotion (fear, overwhelm, boredom) — identifying that emotion is more effective than focusing on the behaviour.'),

('PROCRASTINATION', 'moderate', 'student',
 'Procrastination is present and selective — it targets specific types of tasks and intensifies under perceived difficulty or low interest.',
 'Moderate confidence: task-specific avoidance pattern detected.',
 'Use a two-minute rule: if a task takes under two minutes, do it immediately. For longer tasks, commit only to starting — not finishing.'),

('PROCRASTINATION', 'low',      'counsellor',
 'Procrastination may be a contributing factor in this individual''s profile — early signals suggest avoidance patterns are developing, though low confidence at this stage.',
 'Emerging hypothesis from initial signals.',
 'Exploring the emotional experience associated with delayed tasks will clarify whether this is avoidance-based procrastination or an executive function difficulty.'),

-- ── SOCIAL_CONFIDENCE ────────────────────────────────────────────────────────
('SOCIAL_CONFIDENCE', 'high',     'student',
 'Social confidence is a genuine strength — you engage in group settings, express your views clearly, and maintain composure in social demands.',
 'High confidence: social engagement and expression signals are consistently in the high range.',
 'Use this strength to take on visible leadership roles — your social confidence creates a platform that amplifies the impact of your other strengths.'),

('SOCIAL_CONFIDENCE', 'moderate', 'student',
 'Social confidence is present in familiar settings but drops significantly in new environments, larger groups, or when status dynamics are heightened.',
 'Moderate confidence: context-dependent social confidence pattern is the dominant signal.',
 'Low-stakes repeated exposure to the specific contexts that trigger confidence drop is more effective than general confidence-building exercises.'),

('SOCIAL_CONFIDENCE', 'low',      'student',
 'Social confidence is showing up as a significant challenge — social situations create disproportionate anxiety and avoidance that limits your participation and connections.',
 'Low confidence — initial session data; one-signal assessment.',
 'Identify one social context where you feel marginally more comfortable than others. That is the starting point, not the stretch goal.'),

-- ── SELF_ESTEEM ───────────────────────────────────────────────────────────────
('SELF_ESTEEM', 'high',     'student',
 'Self-esteem is a clear strength in your profile — you approach challenges with a stable sense of your own worth and capability.',
 'High confidence: self-evaluation signals are consistently positive and stable.',
 'Protect this self-esteem by building it on demonstrated competence — attribute successes to your effort and strategies, not luck.'),

('SELF_ESTEEM', 'moderate', 'student',
 'Self-esteem is stable in familiar or successful contexts but vulnerable when you face criticism, comparison, or repeated difficulty.',
 'Moderate confidence: conditional self-esteem pattern is the dominant signal.',
 'Build a competence file — a record of specific things you have done well. In low-esteem moments, evidence beats self-talk.'),

('SELF_ESTEEM', 'low',      'student',
 'Self-esteem is currently one of the most important areas in your profile — a persistent negative self-evaluation is limiting your willingness to try, persist, and recover.',
 'Low confidence — one session; the signal is clear but needs cross-session confirmation.',
 'Start with one action per day that creates genuine competence evidence. Small, real successes rebuild self-esteem more reliably than positive thinking.'),

('SELF_ESTEEM', 'low',      'counsellor',
 'Low self-esteem is appearing as a possible primary driver of the presenting difficulties. The individual''s self-evaluation appears to be consistently and disproportionately negative.',
 'Emerging hypothesis — initial signals are consistent.',
 'Cognitive restructuring targeting self-evaluation patterns and attribution style are the recommended starting clinical entry points.'),

-- ── CAREER_CLARITY ───────────────────────────────────────────────────────────
('CAREER_CLARITY', 'high',     'student',
 'Career clarity is a genuine strength — you have a clear sense of direction, your values are aligned with your goals, and your decisions reflect that clarity.',
 'High confidence: directional commitment signals are consistent.',
 'Use this clarity as a filter — evaluate decisions and opportunities against whether they move you toward or away from your defined direction.'),

('CAREER_CLARITY', 'moderate', 'student',
 'Career direction is partially clear — you have a general sense of where you want to go, but specific path, skills, and decision-making criteria are still developing.',
 'Moderate confidence: partial clarity pattern detected.',
 'Test your direction through low-stakes exploration — conversations with people in the roles you''re considering, short projects, or structured research.'),

('CAREER_CLARITY', 'low',      'student',
 'Career clarity is currently limited — the absence of direction is creating decision paralysis and reducing motivation for near-term effort.',
 'Low confidence — initial session only.',
 'Start by mapping what you are certain you do not want — clarity about the negatives is often the fastest path to positive direction.'),

-- ── FAMILY_DYNAMICS ──────────────────────────────────────────────────────────
('FAMILY_DYNAMICS', 'moderate', 'parent',
 'Family environment factors are showing up as a moderate-confidence contributor to the patterns in this profile.',
 'Moderate confidence: family context signals partially align with the presenting behavioural pattern.',
 'Small changes in communication patterns at home — particularly around expectations and autonomy — often produce disproportionate improvements in behavioural outcomes.'),

('FAMILY_DYNAMICS', 'moderate', 'counsellor',
 'Family dynamics appear to be a contributing factor in this profile. The home environment may be amplifying or maintaining the presenting difficulty.',
 'Moderate confidence hypothesis from initial signals.',
 'A structured family context conversation will clarify whether the home environment is a protective factor, a neutral factor, or an active contributor to the pattern.');
