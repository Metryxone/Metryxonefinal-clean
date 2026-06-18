-- S9 supplement: templates for remaining 15 constructs (completing all 32)
-- Missing: CRITICAL_THINKING, CREATIVITY, HABIT_FORMATION, MENTAL_HEALTH,
-- PHYSICAL_WELLBEING, LEARNING_DRIVE, COMMUNICATION, PEER_RELATIONS,
-- SAFETY_THREATS, DIGITAL_DISCIPLINE, EXAM_PERFORMANCE, EXAM_READINESS,
-- LEARNING_APPROACH, ACADEMIC_RECOVERY, SKILL_AWARENESS

INSERT INTO insight_templates
  (construct_key, confidence_band, persona, insight_text, why_generated, growth_opportunity)
VALUES

-- ── CRITICAL_THINKING ─────────────────────────────────────────────────────────
('CRITICAL_THINKING', 'high', 'student',
 'Critical thinking is a genuine strength — you analyse information carefully, question assumptions, and evaluate evidence before forming conclusions.',
 'High confidence: multi-signal alignment across analytical reasoning indicators.',
 'Seek out arguments with strong opposing evidence. Engaging with difficult positions deepens this strength further.'),

('CRITICAL_THINKING', 'moderate', 'student',
 'Critical thinking is functional but tends to default to the first plausible explanation when time pressure or high confidence in an answer reduces careful evaluation.',
 'Moderate confidence: selective analysis pattern — depth varies with stakes and familiarity.',
 'Practise the "steelman" discipline: before accepting any conclusion, construct the strongest possible argument against it.'),

('CRITICAL_THINKING', 'low', 'student',
 'Evaluating information critically — identifying assumptions, weighing evidence, and recognising logical gaps — is an area where the profile shows significant room for development.',
 'Low confidence — initial signal pattern; needs cross-session confirmation.',
 'Start with one piece of content daily: ask "What is the assumption here? What evidence would change this conclusion?" The habit builds the skill.'),

('CRITICAL_THINKING', 'low', 'counsellor',
 'Critical thinking capacity appears limited in the initial profile — information tends to be accepted without active evaluation of its basis or alternatives.',
 'Emerging hypothesis — initial signals only.',
 'Structured guided questioning exercises (Socratic dialogue, "what-if" prompts) are effective starting points for building this capacity.'),

-- ── CREATIVITY ────────────────────────────────────────────────────────────────
('CREATIVITY', 'high', 'student',
 'Creative thinking and curiosity are genuine strengths — you naturally generate novel ideas and approach problems from multiple angles.',
 'High confidence: strong divergent thinking and exploratory signals across the assessment.',
 'Apply creative thinking to your highest-stakes problems first — that is where this strength creates disproportionate value.'),

('CREATIVITY', 'moderate', 'student',
 'Creative thinking is present but tends to get suppressed under pressure, evaluation, or when working in highly structured environments.',
 'Moderate confidence: context-dependent creativity pattern is the primary signal.',
 'Create low-evaluation spaces for idea generation — separate the divergent phase (generating ideas) from the critical phase (evaluating them).'),

('CREATIVITY', 'low', 'student',
 'Creative and exploratory thinking is currently constrained — the tendency is toward safe, familiar approaches even when a new angle might serve better.',
 'Low confidence — one session; initial pattern.',
 'Spend five minutes each day asking "What else could this be?" about a familiar problem. The muscle builds with consistent low-stakes use.'),

('CREATIVITY', 'low', 'teacher',
 'This student''s creative and exploratory thinking appears constrained — convergent thinking dominates even in tasks that invite open-ended responses.',
 'Emerging hypothesis — initial assessment only.',
 'Open-ended tasks with explicit "no wrong answer" framing can begin to lower the evaluative anxiety that suppresses creative output.'),

-- ── HABIT_FORMATION ──────────────────────────────────────────────────────────
('HABIT_FORMATION', 'high', 'student',
 'Habit formation is a clear strength — you can build consistent behavioural routines and sustain them through disruption.',
 'High confidence: routine-maintenance and consistency signals are aligned.',
 'Use this capacity to systematically build one new high-leverage habit per month — your profile suggests this is a compounding advantage.'),

('HABIT_FORMATION', 'moderate', 'student',
 'You can establish routines but they degrade under pressure, disruption, or when the habit isn''t immediately rewarding.',
 'Moderate confidence: disruption-vulnerability pattern in habit maintenance.',
 'Reduce the habit to its smallest executable form — one that requires almost no motivation. The key is continuity, not intensity.'),

('HABIT_FORMATION', 'low', 'student',
 'Building and sustaining consistent behavioural routines is one of the most significant developmental challenges in your current profile.',
 'Low confidence — initial signals only.',
 'Start with a two-minute daily habit attached to something you already do automatically. The cue matters more than the action at this stage.'),

('HABIT_FORMATION', 'low', 'parent',
 'Habit formation appears to be a significant challenge for your child — routines break down quickly and require consistent external support to maintain.',
 'Emerging hypothesis — initial signals.',
 'Environmental design (placing cues visibly, reducing friction, building habits into the environment rather than relying on memory) is the most effective support at this stage.'),

-- ── MENTAL_HEALTH ─────────────────────────────────────────────────────────────
('MENTAL_HEALTH', 'high', 'student',
 'Overall psychological wellbeing is showing as a genuine strength — mood is generally stable, and recovery from emotional difficulty happens without extended disruption.',
 'High confidence: wellbeing signals are consistently positive across the assessment.',
 'Protect the conditions that sustain this wellbeing — particularly sleep, physical activity, and connection. They compound over time.'),

('MENTAL_HEALTH', 'moderate', 'student',
 'Psychological wellbeing is generally maintained but shows vulnerability under sustained stress, isolation, or cumulative difficulty.',
 'Moderate confidence: threshold-dependent wellbeing pattern detected.',
 'Identify the two or three conditions most strongly associated with your lower-wellbeing periods and address those specifically.'),

('MENTAL_HEALTH', 'low', 'student',
 'Psychological wellbeing is a priority area in this profile — mood stability and emotional resilience are both showing strain.',
 'Low confidence — initial session; confirmation needed before drawing strong conclusions.',
 'Start with the basics: sleep quality, physical movement, and at least one conversation per day that isn''t task-focused. These are the highest-leverage wellbeing inputs.'),

('MENTAL_HEALTH', 'low', 'counsellor',
 'Psychological wellbeing appears significantly compromised in this individual''s current profile. The pattern warrants careful clinical assessment.',
 'Emerging hypothesis — low confidence at this stage.',
 'A structured wellbeing assessment and risk screening are recommended before proceeding with other intervention strategies.'),

('MENTAL_HEALTH', 'moderate', 'parent',
 'Your child''s psychological wellbeing shows some signs of strain — it is generally maintained but shows vulnerability at certain pressure points.',
 'Moderate confidence: stress-threshold wellbeing pattern.',
 'Consistent predictable support (not pressure) at high-stress moments — exams, conflict, transitions — is the highest-leverage parental intervention.'),

-- ── PHYSICAL_WELLBEING ───────────────────────────────────────────────────────
('PHYSICAL_WELLBEING', 'high', 'student',
 'Physical wellbeing habits are well-established — sleep, movement, and energy management are all working effectively and supporting cognitive performance.',
 'High confidence: physical wellbeing signals are consistently strong.',
 'Use your physical foundation deliberately — protect sleep during high-stress periods when others sacrifice it, and use movement as a cognitive tool.'),

('PHYSICAL_WELLBEING', 'moderate', 'student',
 'Physical habits are adequate but inconsistent — sleep, movement, and recovery get deprioritised when demands increase.',
 'Moderate confidence: demand-driven physical habit degradation is the primary pattern.',
 'Non-negotiable sleep is the highest-priority physical habit. A consistent wake time (even on weekends) has more downstream cognitive benefit than any other single change.'),

('PHYSICAL_WELLBEING', 'low', 'student',
 'Physical wellbeing habits are significantly impacting cognitive and emotional performance in this profile — sleep, movement, and recovery are not in an adequate state.',
 'Low confidence — initial session pattern.',
 'Start with sleep: set a consistent bedtime and wake time for 7 days. The cognitive benefits of improved sleep are measurable within one week.'),

('PHYSICAL_WELLBEING', 'low', 'counsellor',
 'Physical wellbeing markers appear significantly below functional baseline in this profile — sleep disruption and physical deactivation are likely contributing to the presenting difficulties.',
 'Emerging hypothesis — initial session data.',
 'Physical wellbeing intervention (particularly sleep hygiene and structured movement) should be included in any holistic plan alongside psychological support.'),

-- ── LEARNING_DRIVE ───────────────────────────────────────────────────────────
('LEARNING_DRIVE', 'high', 'student',
 'Curiosity and enthusiasm for learning are genuine strengths — you seek new knowledge beyond what is required and engage deeply with subjects that interest you.',
 'High confidence: curiosity and exploration signals are consistently strong.',
 'Direct this learning drive into one area where you can develop genuine expertise — depth compounds more than breadth over time.'),

('LEARNING_DRIVE', 'moderate', 'student',
 'Learning curiosity is present but selective — it activates reliably for interesting or self-relevant content and largely disappears for obligatory or repetitive material.',
 'Moderate confidence: interest-dependency pattern in learning engagement.',
 'Find the interesting angle in the material that currently feels least engaging. There is always one — finding it activates the intrinsic learning system.'),

('LEARNING_DRIVE', 'low', 'student',
 'The drive to learn beyond the minimum required is currently low in this profile — curiosity and exploration are not showing as active.',
 'Low confidence — initial pattern only.',
 'Find one question you are genuinely curious about today — not for any assessment, just for yourself. Following that thread is how the learning drive gets restarted.'),

('LEARNING_DRIVE', 'low', 'teacher',
 'Learning curiosity appears disengaged in this student''s current profile — exploration and self-directed inquiry are not showing as active.',
 'Emerging hypothesis — initial assessment.',
 'Connecting curriculum content to student-identified real-world questions or genuine curiosities creates the most reliable re-engagement pathway.'),

-- ── COMMUNICATION ─────────────────────────────────────────────────────────────
('COMMUNICATION', 'high', 'student',
 'Communication is a clear strength — you express ideas clearly, adjust your style to the audience, and feel confident in verbal and written communication.',
 'High confidence: expression and self-report signals are consistently strong.',
 'Use this strength in situations where others struggle to articulate themselves — leadership, mediation, and explanation are high-value applications.'),

('COMMUNICATION', 'moderate', 'student',
 'Communication works well in low-stakes, familiar contexts but becomes less reliable under scrutiny, unfamiliarity, or when the message is complex or emotionally charged.',
 'Moderate confidence: context-dependent communication pattern.',
 'Prepare for high-stakes communication the same way you prepare for high-stakes tasks — write or speak the key points out loud before the actual moment.'),

('COMMUNICATION', 'low', 'student',
 'Expressing thoughts clearly and confidently — both verbally and in writing — is an area where the profile shows significant room for development.',
 'Low confidence — initial pattern.',
 'Start with writing: one paragraph per day expressing what you think about something. Writing forces clarity in ways that speaking does not.'),

('COMMUNICATION', 'moderate', 'teacher',
 'This student shows communication difficulties in structured settings — ideas appear to be present but the ability to express them reliably under academic conditions is inconsistent.',
 'Moderate confidence: structured-setting communication pattern.',
 'Low-stakes verbal and written practice (ungraded pair-shares, brief unassessed journal entries) reduces the performance anxiety that suppresses communication in formal settings.'),

-- ── PEER_RELATIONS ────────────────────────────────────────────────────────────
('PEER_RELATIONS', 'high', 'student',
 'Peer relationships are a genuine strength — you navigate social groups effectively, build trust, and handle interpersonal conflict without significant lasting damage.',
 'High confidence: social navigation signals are consistently strong.',
 'Invest your strong peer relationship skills in lower-status groups — bringing people together across social divisions is a rare and valuable capability.'),

('PEER_RELATIONS', 'moderate', 'student',
 'Peer relationships work well in stable conditions but show friction during conflict, competition, or when social dynamics shift.',
 'Moderate confidence: stability-dependent peer relationship pattern.',
 'Identify the one type of interpersonal situation that most reliably creates friction. Preparation and pre-planned response reduce the impact significantly.'),

('PEER_RELATIONS', 'low', 'student',
 'Navigating peer relationships is currently one of the more significant challenges in this profile — friction, isolation, or repeated conflict are creating ongoing difficulty.',
 'Low confidence — initial session pattern.',
 'Focus on one relationship — not the group. One genuine, low-expectations connection is a more reliable foundation than broader social effort at this stage.'),

('PEER_RELATIONS', 'low', 'parent',
 'Peer relationship difficulties are showing up as a significant concern in your child''s profile — social isolation, conflict, or exclusion appear to be active issues.',
 'Emerging hypothesis — initial signals.',
 'Low-stakes structured shared activities (not unstructured social time) create the easiest conditions for positive peer interaction at this difficulty level.'),

-- ── SAFETY_THREATS ───────────────────────────────────────────────────────────
('SAFETY_THREATS', 'high', 'counsellor',
 'Safety and threat exposure signals are appearing at high confidence in this profile — this warrants immediate professional assessment and structured support.',
 'High confidence: threat exposure and safety signals are consistent and cross-validated.',
 'Structured clinical safety assessment is the immediate priority. Pastoral and safeguarding protocols should be activated in parallel with therapeutic support.'),

('SAFETY_THREATS', 'moderate', 'counsellor',
 'Threat exposure signals are present at moderate confidence — this may include exposure to bullying, inappropriate content, or unsafe online interactions.',
 'Moderate confidence: threat exposure pattern detected across signals.',
 'A structured safety conversation exploring online and offline threat experiences will clarify the nature and severity and guide the appropriate response level.'),

('SAFETY_THREATS', 'moderate', 'parent',
 'Signals in your child''s profile suggest possible exposure to threatening experiences — online bullying, inappropriate content, or unsafe interactions may be a factor.',
 'Moderate confidence: threat exposure pattern emerging.',
 'An open, non-judgmental conversation about online and offline experiences — without immediate consequences — is more likely to surface the relevant information than direct questioning.'),

('SAFETY_THREATS', 'low', 'student',
 'Some signals in your profile suggest you may be experiencing situations that feel threatening or unsafe. This is taken seriously.',
 'Low confidence — initial signal; professional follow-up is recommended.',
 'You do not have to manage this alone. Speaking to a trusted adult — a counsellor, teacher, or parent — is always a valid and important option.'),

-- ── DIGITAL_DISCIPLINE ───────────────────────────────────────────────────────
('DIGITAL_DISCIPLINE', 'high', 'student',
 'Digital discipline is a genuine strength — you use technology intentionally, manage screen time effectively, and maintain clear boundaries around device use.',
 'High confidence: intentional technology use signals are consistent.',
 'Pair this discipline with regular review of whether your digital habits are still creating value proportional to their cost. Discipline without review can become rigid.'),

('DIGITAL_DISCIPLINE', 'moderate', 'student',
 'Digital discipline works in structured conditions but breaks down in unstructured time, late evenings, or when stress creates escape-seeking behaviour.',
 'Moderate confidence: time/context-dependent discipline failure pattern.',
 'Identify your highest-risk digital moment daily — that exact moment is the intervention point. Pre-plan one alternative action for it.'),

('DIGITAL_DISCIPLINE', 'low', 'student',
 'Managing screen time and maintaining intentional digital habits is one of the primary challenges in the current profile.',
 'Low confidence — initial session pattern.',
 'Start by auditing your daily screen time honestly. Data-based awareness is the prerequisite for any effective change — you cannot manage what you have not measured.'),

('DIGITAL_DISCIPLINE', 'low', 'parent',
 'Digital discipline appears to be significantly underdeveloped in your child''s profile — screen time management requires substantial external support.',
 'Emerging hypothesis — initial signals.',
 'Environmental controls (device-free zones, scheduled no-screen periods) are more effective than rules and restrictions at this stage of digital self-regulation development.'),

-- ── EXAM_PERFORMANCE ─────────────────────────────────────────────────────────
('EXAM_PERFORMANCE', 'high', 'student',
 'Exam performance is a genuine strength — your actual results consistently reflect your preparation level and capability.',
 'High confidence: performance-preparation alignment signals are strong.',
 'Focus on maintaining the conditions that produced this performance — particularly exam-environment practice and recovery between assessments.'),

('EXAM_PERFORMANCE', 'moderate', 'student',
 'Exam performance is adequate but inconsistent — preparation quality does not always convert into results, suggesting something in the exam environment is interfering.',
 'Moderate confidence: preparation-performance gap pattern is the key signal.',
 'Practise under exam conditions: timed, silent, with no notes. The gap between study conditions and exam conditions is often where results are lost.'),

('EXAM_PERFORMANCE', 'low', 'student',
 'Exam performance is significantly below what your preparation level suggests — something in the assessment environment is suppressing the ability to demonstrate what you know.',
 'Low confidence — initial signal pattern.',
 'Exam anxiety is a solvable problem. Timed mock exams with immediate review (not result-focus but process-focus) rebuild exam performance progressively.'),

('EXAM_PERFORMANCE', 'low', 'teacher',
 'This student''s exam performance appears significantly below their demonstrated knowledge level in classroom settings — performance anxiety or exam strategy gaps are likely contributors.',
 'Emerging hypothesis — initial assessment.',
 'Mock exam conditions with low stakes and high support (immediate, constructive feedback on approach rather than result) are the most reliable intervention.'),

-- ── EXAM_READINESS ───────────────────────────────────────────────────────────
('EXAM_READINESS', 'high', 'student',
 'Exam readiness is strong — your preparation quality, revision strategy, and execution under assessment conditions are all functioning effectively.',
 'High confidence: preparation quality and strategy signals are consistently high.',
 'Refine your strategy for your weakest subject area — strong readiness overall means targeted effort there creates disproportionate overall improvement.'),

('EXAM_READINESS', 'moderate', 'student',
 'Exam preparation has clear strengths but significant gaps — some areas are well-prepared and others receive inadequate attention or use ineffective revision methods.',
 'Moderate confidence: selective preparation pattern detected.',
 'Audit your revision: list your subjects, rate your confidence 1–10, and allocate your next study week in inverse order — most time to lowest confidence subjects.'),

('EXAM_READINESS', 'low', 'student',
 'Exam readiness is significantly below where it needs to be — preparation quality, consistency, and strategy all need immediate attention.',
 'Low confidence — initial signal pattern.',
 'Start by making a realistic list of what needs to be covered. Having an explicit map of the gap reduces the anxiety that prevents starting.'),

('EXAM_READINESS', 'low', 'parent',
 'Your child''s exam preparation appears significantly inadequate — both the quality and consistency of revision are areas needing support.',
 'Emerging hypothesis — initial signals.',
 'A structured but supportive revision schedule, co-created with your child rather than imposed, creates more consistent adherence than top-down plans.'),

-- ── LEARNING_APPROACH ────────────────────────────────────────────────────────
('LEARNING_APPROACH', 'high', 'student',
 'Your learning approach is a genuine strength — you engage with material deeply, seek understanding rather than surface recall, and make connections across concepts.',
 'High confidence: deep processing and conceptual connection signals are consistently strong.',
 'Apply your strong learning approach to the subjects you find least interesting — that is where the gap between your potential and current performance is largest.'),

('LEARNING_APPROACH', 'moderate', 'student',
 'Learning approach works well for topics of genuine interest but defaults to surface-level rote processing when motivation or clarity is low.',
 'Moderate confidence: interest-dependent depth pattern detected.',
 'Ask "why does this work?" rather than "what is this?" for at least one concept per study session. The why question forces deeper processing regardless of initial interest.'),

('LEARNING_APPROACH', 'low', 'student',
 'Learning is primarily surface-level in this profile — information is being memorised for recall rather than processed for understanding, which limits retention and application.',
 'Low confidence — initial signal pattern.',
 'After each study session, close your notes and write (in your own words) the three most important ideas and how they connect. This one habit shifts processing depth significantly.'),

('LEARNING_APPROACH', 'low', 'teacher',
 'This student''s learning approach appears primarily surface-level — rote memorisation and reproduction rather than comprehension and application.',
 'Emerging hypothesis — initial signals.',
 'Tasks that require explanation (teaching back, application problems, synthesis questions) reliably push surface learners toward deeper processing.'),

-- ── ACADEMIC_RECOVERY ────────────────────────────────────────────────────────
('ACADEMIC_RECOVERY', 'high', 'student',
 'Academic recovery is a clear strength — when things go wrong academically, you regroup, re-strategise, and restore performance without extended derailment.',
 'High confidence: recovery speed and re-engagement signals are consistently strong.',
 'Use your recovery capacity to take on academic challenges with higher failure probability — your resilience makes the risk more manageable than for most people.'),

('ACADEMIC_RECOVERY', 'moderate', 'student',
 'Academic recovery is functional but slow — setbacks create a period of disengagement before re-engagement, and the gap is longer than is ideal.',
 'Moderate confidence: recovery delay pattern is the primary signal.',
 'Build a defined post-setback routine: one specific action you take within 24 hours of an academic disappointment. The protocol removes the decision burden during low-motivation periods.'),

('ACADEMIC_RECOVERY', 'low', 'student',
 'Recovering from academic setbacks — failed assessments, falling behind, receiving poor feedback — is currently one of the most significant challenges in this profile.',
 'Low confidence — initial signal pattern.',
 'The recovery process starts with honest analysis, not catastrophising or denial. After a setback, write three sentences: what happened, what you missed, what you will do differently.'),

('ACADEMIC_RECOVERY', 'low', 'counsellor',
 'Academic recovery capacity appears significantly impaired in this individual''s current profile. Setbacks are triggering extended disengagement rather than productive re-engagement.',
 'Emerging hypothesis — initial signals.',
 'Reframing setbacks as information (rather than judgment) and building structured re-engagement protocols are the recommended starting intervention points.'),

-- ── SKILL_AWARENESS ──────────────────────────────────────────────────────────
('SKILL_AWARENESS', 'high', 'student',
 'Skill awareness is a genuine strength — you have a clear and realistic understanding of what you are actually good at, where your gaps are, and how to leverage your strengths.',
 'High confidence: self-assessment accuracy signals are consistently calibrated.',
 'Use this awareness to focus your development effort precisely — your accurate self-map prevents wasted effort on areas of low priority or high existing competence.'),

('SKILL_AWARENESS', 'moderate', 'student',
 'Skill awareness is present but imprecise — there is a reasonable general picture but specific strengths and gaps are not clearly identified or actively used in decision-making.',
 'Moderate confidence: generalised-rather-than-specific awareness pattern.',
 'Ask three people who know your work well: "What do I do better than most people I know?" and "Where do I most often fall short?" Their answers will surface what self-reflection misses.'),

('SKILL_AWARENESS', 'low', 'student',
 'Clear awareness of your actual skills, strengths, and employability gaps is limited in this profile — the self-map is incomplete or inaccurate in ways that affect decisions.',
 'Low confidence — initial signals only.',
 'Start by listing five specific things you have done in the last year that went well — not "I''m good at maths" but "I explained the concept to three people and they all understood it." Specificity builds accuracy.'),

('SKILL_AWARENESS', 'low', 'counsellor',
 'Skill self-awareness appears significantly underdeveloped — this individual may be operating with an inaccurate self-map that affects academic and career decision-making.',
 'Emerging hypothesis — initial signals.',
 'Structured strengths-based interviews (exploring past successes in detail) and validated skill inventories are the recommended diagnostic starting points.');
