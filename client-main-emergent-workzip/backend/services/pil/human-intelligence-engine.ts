/**
 * CAPADEX Problem Intelligence Layer (PIL) — Phase 3: Human Intelligence Layer
 * (pure, deterministic, rule-based — NO external AI).
 *
 * Translates the 22 curated behavioural ARCHETYPES into human-understandable,
 * real-world language so non-experts (students, parents, teachers, counselors,
 * working professionals) recognise themselves without ever meeting an assessment
 * or psychometric term. It is the "translation layer" of the spine:
 *     Archetype  ->  Human Problem · Stakeholder Narrative · Emotion Set
 *
 * EXTENSION-ONLY: the runner reads ONLY existing PIL tables (read-only) and writes
 * ONLY the three new Phase-3 tables. This module itself is pure — no DB, no I/O.
 *
 * HONESTY MODEL (quality over quantity): the human language is a CURATED,
 * archetype-keyed library hand-authored in plain conversational English. It is NOT
 * machine-paraphrased and NOT fabricated data — every line is a human translation of
 * an archetype that already exists in `archetype_library`. Three DETERMINISTIC
 * validators grade the output and are allowed to FAIL:
 *   - human realism  : a line must contain ZERO psychometric/assessment jargon and
 *                       read like natural speech (length-bounded).
 *   - duplicate rate : near-identical lines (Jaccard token overlap) are flagged.
 *   - archetype align : a line must touch the archetype's lay-vocabulary lexicon.
 * Coverage and the validators are recomputed honestly by the runner / API — never
 * tuned to force a pass.
 */

// ── Enumerations ─────────────────────────────────────────────────────────────
export type Stakeholder = 'student' | 'parent' | 'teacher' | 'counselor' | 'professional';
export const STAKEHOLDERS: Stakeholder[] = ['student', 'parent', 'teacher', 'counselor', 'professional'];

export type EmotionType = 'frustration' | 'fear' | 'motivation' | 'growth_signal' | 'success_indicator';
export const EMOTION_TYPES: EmotionType[] = ['frustration', 'fear', 'motivation', 'growth_signal', 'success_indicator'];

export type ProblemVoice = 'student' | 'professional' | 'general';
export const PROBLEM_VOICES: ProblemVoice[] = ['student', 'professional', 'general'];

export interface HumanPack {
  problems: { voice: ProblemVoice; text: string }[];
  stakeholders: { stakeholder: Stakeholder; text: string }[];
  emotions: { type: EmotionType; text: string }[];
}

// ── Curated human library (one pack per archetype_key) ───────────────────────
// Hand-authored plain-English translations of each archetype. Voice is who is
// speaking. Stakeholder narratives express the SAME archetype through five lenses.
export const HUMAN_PACKS: Record<string, HumanPack> = {
  performance_anxiety: {
    problems: [
      { voice: 'student', text: 'I blank out the moment an exam starts, even when I studied hard.' },
      { voice: 'general', text: 'My heart races and my mind goes empty right before I have to present.' },
      { voice: 'professional', text: 'I freeze up in interviews and forget everything I wanted to say.' },
      { voice: 'student', text: "The night before a big test I can't sleep because I'm so worried about messing up." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "Whenever there's a test coming up, I feel sick to my stomach and can't focus." },
      { stakeholder: 'parent', text: 'My child knows the material at home but falls apart the moment they sit the exam.' },
      { stakeholder: 'teacher', text: 'This student goes quiet and tense during tests, even on topics they clearly understand.' },
      { stakeholder: 'counselor', text: 'The student describes their mind going blank and their hands shaking before any high-stakes moment.' },
      { stakeholder: 'professional', text: "I'm good at my job day to day, but I crumble under pressure in reviews and big meetings." },
    ],
    emotions: [
      { type: 'frustration', text: "It's so frustrating to know the answer but lose it the second it counts." },
      { type: 'frustration', text: 'I hate that all my preparation disappears the moment people are watching.' },
      { type: 'fear', text: "I'm terrified of choking and embarrassing myself in front of everyone." },
      { type: 'fear', text: "I dread being judged and proven that I'm not good enough." },
      { type: 'motivation', text: 'I just want to walk into a test feeling calm and ready.' },
      { type: 'motivation', text: 'I want to show what I actually know without my nerves getting in the way.' },
      { type: 'growth_signal', text: 'Lately I managed to slow my breathing and get through a presentation without panicking.' },
      { type: 'growth_signal', text: "I'm starting to catch my worried thoughts before they spiral." },
      { type: 'success_indicator', text: 'I sat my last exam feeling nervous but stayed in control the whole time.' },
      { type: 'success_indicator', text: "I spoke up in a big meeting and my voice didn't shake once." },
    ],
  },
  career_professional_growth: {
    problems: [
      { voice: 'professional', text: 'I have no idea what the next step in my career should be.' },
      { voice: 'professional', text: "I've been in the same role for years and I'm not sure how to move up." },
      { voice: 'professional', text: 'I work hard but I keep getting passed over for promotions.' },
      { voice: 'general', text: "I don't know what kind of job actually fits me." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I'm about to graduate and I genuinely don't know what career to aim for." },
      { stakeholder: 'parent', text: 'My child finished their degree but seems lost about what work to pursue.' },
      { stakeholder: 'teacher', text: 'This student is capable but has no clear sense of where they want their career to go.' },
      { stakeholder: 'counselor', text: "The person feels stuck in their job and can't picture a path forward." },
      { stakeholder: 'professional', text: "I'm doing fine at work, but I have no clear plan for where I'm heading." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to keep working hard and still feel like I'm going nowhere." },
      { type: 'frustration', text: "I'm tired of watching others get promoted while I stay in the same place." },
      { type: 'fear', text: "I'm scared I'll wake up in ten years stuck in a job I never chose." },
      { type: 'fear', text: "I worry I've already fallen behind everyone my age." },
      { type: 'motivation', text: 'I want a career that actually feels like mine, not just a paycheck.' },
      { type: 'motivation', text: "I'd love to finally have a clear direction to work toward." },
      { type: 'growth_signal', text: "I've started mapping out the skills I'd need for the role I want." },
      { type: 'growth_signal', text: 'I recently asked my manager about a path to promotion.' },
      { type: 'success_indicator', text: 'I landed a role that lines up with where I want to go.' },
      { type: 'success_indicator', text: 'I can now describe my next career step in one clear sentence.' },
    ],
  },
  learning_comprehension: {
    problems: [
      { voice: 'student', text: "I read something three times and still can't explain it back." },
      { voice: 'student', text: 'I study for hours but none of it seems to stick.' },
      { voice: 'general', text: 'New concepts take me far longer to understand than everyone else.' },
      { voice: 'student', text: 'I take notes in class but they make no sense to me later.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I sit down to learn and the words just don't go in." },
      { stakeholder: 'parent', text: "My child spends ages studying but still can't recall it the next day." },
      { stakeholder: 'teacher', text: 'This student tries hard but struggles to grasp new ideas the first time.' },
      { stakeholder: 'counselor', text: 'The student says they understand in the moment but forget everything soon after.' },
      { stakeholder: 'professional', text: 'I find it hard to pick up new tools and processes at work.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's maddening to put in the hours and still not understand it." },
      { type: 'frustration', text: 'I hate re-reading the same page over and over with nothing sinking in.' },
      { type: 'fear', text: "I'm afraid I'm just not smart enough to keep up." },
      { type: 'fear', text: "I worry I'll forget it all the moment I need it." },
      { type: 'motivation', text: 'I really want things to finally click when I learn them.' },
      { type: 'motivation', text: 'I want to be able to explain ideas in my own words.' },
      { type: 'growth_signal', text: "I've started teaching topics to a friend to check if I really get them." },
      { type: 'growth_signal', text: "I'm beginning to connect new ideas to things I already know." },
      { type: 'success_indicator', text: 'I explained a tough topic to someone else without my notes.' },
      { type: 'success_indicator', text: 'What I studied last week actually stayed with me this time.' },
    ],
  },
  emotional_regulation: {
    problems: [
      { voice: 'general', text: 'Small things set me off and I overreact before I can stop myself.' },
      { voice: 'general', text: 'When I get overwhelmed I just shut down completely.' },
      { voice: 'general', text: 'My mood swings so fast it\u2019s hard for people around me.' },
      { voice: 'general', text: 'I get so frustrated that I snap at people I care about.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "When schoolwork piles up I get so overwhelmed I can't function." },
      { stakeholder: 'parent', text: 'My child goes from calm to a complete meltdown over the smallest thing.' },
      { stakeholder: 'teacher', text: 'This student gets visibly frustrated and gives up when a task gets hard.' },
      { stakeholder: 'counselor', text: 'The person describes their emotions taking over before they can think.' },
      { stakeholder: 'professional', text: 'When work gets stressful I lose my temper and regret it later.' },
    ],
    emotions: [
      { type: 'frustration', text: "I'm frustrated that I can't keep my cool when it matters." },
      { type: 'frustration', text: "It's exhausting feeling everything so intensely all the time." },
      { type: 'fear', text: "I'm scared of pushing people away when I lose control." },
      { type: 'fear', text: 'I worry my emotions will get the better of me at the worst moment.' },
      { type: 'motivation', text: 'I want to feel steady instead of being thrown around by my moods.' },
      { type: 'motivation', text: "I'd love to handle a hard moment without falling apart." },
      { type: 'growth_signal', text: 'I managed to step away and breathe before reacting the other day.' },
      { type: 'growth_signal', text: "I'm starting to notice what sets me off before it happens." },
      { type: 'success_indicator', text: "I stayed calm through a stressful day that would've wrecked me before." },
      { type: 'success_indicator', text: 'I felt myself getting upset and let it pass without blowing up.' },
    ],
  },
  academic_achievement: {
    problems: [
      { voice: 'student', text: 'My grades keep dropping no matter how much I revise.' },
      { voice: 'student', text: 'I do okay in class but my exam results never reflect it.' },
      { voice: 'student', text: "I'm falling behind in the subjects that matter most for my future." },
      { voice: 'student', text: "I can't seem to turn my effort into better marks." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I study but my grades just won't go up." },
      { stakeholder: 'parent', text: 'My child puts in the work but the report card never shows it.' },
      { stakeholder: 'teacher', text: 'This student participates well but underperforms on exams.' },
      { stakeholder: 'counselor', text: "The student feels defined by grades that don't match their effort." },
      { stakeholder: 'professional', text: 'Back in school I never got the marks I felt I deserved.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to work this hard for grades that won't budge." },
      { type: 'frustration', text: "I'm sick of my results not matching the effort I put in." },
      { type: 'fear', text: "I'm scared bad grades will close doors to my future." },
      { type: 'fear', text: 'I worry one bad exam will define me.' },
      { type: 'motivation', text: 'I want to finally see my hard work show up on my report card.' },
      { type: 'motivation', text: "I'd love to walk out of an exam knowing I did well." },
      { type: 'growth_signal', text: 'My last set of marks finally started moving in the right direction.' },
      { type: 'growth_signal', text: "I've changed how I revise and it's helping a little." },
      { type: 'success_indicator', text: "I got the grade I'd been working toward all term." },
      { type: 'success_indicator', text: 'My exam results finally matched the effort I put in.' },
    ],
  },
  leadership_influence: {
    problems: [
      { voice: 'professional', text: 'I have ideas for the team but I never feel able to step up and lead.' },
      { voice: 'professional', text: "When I'm in charge I struggle to get people to actually follow." },
      { voice: 'professional', text: 'I try to do everything myself instead of trusting my team.' },
      { voice: 'general', text: "I freeze when it's my turn to take the lead on a group." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'In group projects I want to lead but I just let others take over.' },
      { stakeholder: 'parent', text: 'My child has great ideas but holds back from taking charge.' },
      { stakeholder: 'teacher', text: 'This student could lead the class but shrinks from the responsibility.' },
      { stakeholder: 'counselor', text: 'The person wants to guide others but doubts anyone will listen.' },
      { stakeholder: 'professional', text: "I got promoted to lead a team and I'm struggling to step into the role." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to have a vision and not be able to rally people behind it." },
      { type: 'frustration', text: "I'm tired of doing everything myself because I can't delegate." },
      { type: 'fear', text: "I'm afraid people won't respect me if I take charge." },
      { type: 'fear', text: "I worry I'll lead badly and let the whole team down." },
      { type: 'motivation', text: 'I want to be the kind of leader people actually want to follow.' },
      { type: 'motivation', text: "I'd love to guide a team toward something we're proud of." },
      { type: 'growth_signal', text: 'I handed off a task to a teammate instead of doing it all myself.' },
      { type: 'growth_signal', text: 'I spoke up and set the direction in our last meeting.' },
      { type: 'success_indicator', text: 'My team rallied behind a plan I laid out.' },
      { type: 'success_indicator', text: 'I led a project from start to finish and people followed my lead.' },
    ],
  },
  time_self_discipline: {
    problems: [
      { voice: 'general', text: 'I put everything off until the last minute and then panic.' },
      { voice: 'general', text: 'I keep missing deadlines even when I have plenty of time.' },
      { voice: 'general', text: 'I make a plan every week and never stick to it.' },
      { voice: 'general', text: 'I waste hours and then wonder where the day went.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I always start my assignments the night before they're due." },
      { stakeholder: 'parent', text: 'My child leaves everything to the last minute and then stresses out.' },
      { stakeholder: 'teacher', text: 'This student hands work in late even when they had weeks to do it.' },
      { stakeholder: 'counselor', text: 'The person keeps setting routines and abandoning them within days.' },
      { stakeholder: 'professional', text: "I miss deadlines at work because I can't stop procrastinating." },
    ],
    emotions: [
      { type: 'frustration', text: "I'm frustrated that I keep sabotaging myself by waiting too long." },
      { type: 'frustration', text: "It's exhausting always racing the clock because I started late." },
      { type: 'fear', text: "I'm scared my procrastination will cost me something big." },
      { type: 'fear', text: 'I worry people see me as unreliable.' },
      { type: 'motivation', text: 'I want to get things done early and stop the last-minute panic.' },
      { type: 'motivation', text: "I'd love to actually stick to a routine for once." },
      { type: 'growth_signal', text: 'I started a task days before it was due for the first time in ages.' },
      { type: 'growth_signal', text: "I've kept to my schedule three days in a row." },
      { type: 'success_indicator', text: 'I finished a project ahead of the deadline with time to spare.' },
      { type: 'success_indicator', text: 'I stuck to my plan all week without falling behind.' },
    ],
  },
  motivation_drive: {
    problems: [
      { voice: 'general', text: "I can't find the energy to start anything lately." },
      { voice: 'general', text: 'I used to care about my goals and now I just feel flat.' },
      { voice: 'general', text: 'I know what I should do but I have no drive to do it.' },
      { voice: 'general', text: 'I lose interest in things halfway through.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I just can't make myself care about schoolwork anymore." },
      { stakeholder: 'parent', text: 'My child seems to have lost all motivation for things they used to love.' },
      { stakeholder: 'teacher', text: 'This student does the bare minimum and shows little interest.' },
      { stakeholder: 'counselor', text: 'The person feels stuck, with no energy to pursue anything.' },
      { stakeholder: 'professional', text: 'I drag myself through the workday with zero drive.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to want to want something and just feel nothing." },
      { type: 'frustration', text: "I'm annoyed at myself for wasting days doing nothing." },
      { type: 'fear', text: "I'm scared I've lost the spark I used to have." },
      { type: 'fear', text: "I worry I'll never get my drive back." },
      { type: 'motivation', text: 'I want to feel excited about my goals again.' },
      { type: 'motivation', text: "I'd love to wake up actually wanting to get started." },
      { type: 'growth_signal', text: 'I felt a flicker of interest in a project this week.' },
      { type: 'growth_signal', text: 'I set one small goal and actually followed through.' },
      { type: 'success_indicator', text: "I've been getting up energized to chase something that matters to me." },
      { type: 'success_indicator', text: 'I finished something I started purely because I wanted to.' },
    ],
  },
  critical_reflective_thinking: {
    problems: [
      { voice: 'general', text: "I take things at face value and don't question them enough." },
      { voice: 'general', text: 'I jump to the first answer instead of thinking it through.' },
      { voice: 'general', text: 'I struggle to step back and see why I keep making the same mistake.' },
      { voice: 'general', text: 'I find it hard to weigh different sides of a problem.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'I just memorize answers without really understanding the why.' },
      { stakeholder: 'parent', text: "My child accepts whatever they're told without thinking it through." },
      { stakeholder: 'teacher', text: 'This student gives quick answers but rarely reasons through a problem.' },
      { stakeholder: 'counselor', text: 'The person struggles to reflect on their own choices and patterns.' },
      { stakeholder: 'professional', text: "At work I react fast but don't always think decisions through." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to keep repeating mistakes I never stop to examine." },
      { type: 'frustration', text: "I'm annoyed that I accept things without digging deeper." },
      { type: 'fear', text: "I'm afraid I'm being led along because I don't question enough." },
      { type: 'fear', text: "I worry I'll make a big call without really thinking it over." },
      { type: 'motivation', text: 'I want to think things through properly instead of rushing.' },
      { type: 'motivation', text: "I'd love to understand the reasons behind what I do." },
      { type: 'growth_signal', text: 'I caught myself questioning an assumption before acting on it.' },
      { type: 'growth_signal', text: "I've started asking why instead of taking things as given." },
      { type: 'success_indicator', text: 'I worked through a tricky problem by weighing every side.' },
      { type: 'success_indicator', text: 'I reflected on a mistake and figured out how to avoid it next time.' },
    ],
  },
  confidence_self_efficacy: {
    problems: [
      { voice: 'general', text: 'I second-guess every decision I make.' },
      { voice: 'general', text: "I don't believe I'm capable of the things I want to do." },
      { voice: 'general', text: 'I talk myself out of opportunities before I even try.' },
      { voice: 'general', text: "I always assume I'll fail before I start." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I never put my hand up because I assume I'll be wrong." },
      { stakeholder: 'parent', text: 'My child is capable but constantly doubts themselves.' },
      { stakeholder: 'teacher', text: 'This student has the ability but holds back out of self-doubt.' },
      { stakeholder: 'counselor', text: "The person doesn't believe they can handle what's in front of them." },
      { stakeholder: 'professional', text: "I avoid taking on bigger work because I don't think I can do it." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to hold myself back when I know I could try." },
      { type: 'frustration', text: "I'm tired of doubting myself at every turn." },
      { type: 'fear', text: "I'm afraid I'll prove that I'm not good enough." },
      { type: 'fear', text: "I worry everyone will see that I don't belong." },
      { type: 'motivation', text: 'I want to trust myself enough to just go for it.' },
      { type: 'motivation', text: "I'd love to back myself the way others back me." },
      { type: 'growth_signal', text: 'I volunteered for something instead of talking myself out of it.' },
      { type: 'growth_signal', text: "I'm starting to believe I can handle hard things." },
      { type: 'success_indicator', text: 'I took on a challenge and proved to myself I could do it.' },
      { type: 'success_indicator', text: "I made a decision and didn't second-guess it." },
    ],
  },
  adaptability_change: {
    problems: [
      { voice: 'general', text: 'I get thrown off whenever my routine suddenly changes.' },
      { voice: 'general', text: 'I struggle to cope when plans shift at the last minute.' },
      { voice: 'general', text: 'Uncertainty makes me freeze instead of adjust.' },
      { voice: 'general', text: 'I cling to the way things were instead of adapting.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'When a teacher changes the plan I get completely thrown.' },
      { stakeholder: 'parent', text: "My child really struggles whenever there's a big change at home or school." },
      { stakeholder: 'teacher', text: 'This student gets unsettled the moment we change the routine.' },
      { stakeholder: 'counselor', text: 'The person finds any kind of change overwhelming and destabilizing.' },
      { stakeholder: 'professional', text: 'Every reorganization at work leaves me struggling to keep up.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating that I can't just roll with changes like others do." },
      { type: 'frustration', text: "I'm annoyed at how rattled I get when plans shift." },
      { type: 'fear', text: "I'm scared of what happens when everything changes at once." },
      { type: 'fear', text: "I worry I won't be able to handle the unknown." },
      { type: 'motivation', text: 'I want to handle change without it knocking me over.' },
      { type: 'motivation', text: "I'd love to feel okay even when things are uncertain." },
      { type: 'growth_signal', text: 'I rolled with a sudden change last week instead of panicking.' },
      { type: 'growth_signal', text: "I'm getting a bit more comfortable when plans shift." },
      { type: 'success_indicator', text: 'A big change came up and I adjusted without falling apart.' },
      { type: 'success_indicator', text: 'I handled an unpredictable week and stayed on my feet.' },
    ],
  },
  resilience_recovery: {
    problems: [
      { voice: 'general', text: "One failure knocks me down and I can't seem to get back up." },
      { voice: 'general', text: 'When I get rejected I want to give up entirely.' },
      { voice: 'general', text: 'Setbacks hit me so hard I struggle to try again.' },
      { voice: 'general', text: 'I take mistakes so personally that I stop trying.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'One bad grade and I feel like giving up on the whole subject.' },
      { stakeholder: 'parent', text: "My child falls apart after any setback and won't try again." },
      { stakeholder: 'teacher', text: 'This student gives up the moment something goes wrong.' },
      { stakeholder: 'counselor', text: 'The person struggles to recover after failure or rejection.' },
      { stakeholder: 'professional', text: 'A single rejection at work can derail me for weeks.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating that one setback wipes out all my momentum." },
      { type: 'frustration', text: 'I hate how long it takes me to bounce back.' },
      { type: 'fear', text: "I'm afraid of failing because I don't know if I'll recover." },
      { type: 'fear', text: "I worry the next knock will be the one I can't come back from." },
      { type: 'motivation', text: 'I want to be able to fail and get straight back up.' },
      { type: 'motivation', text: "I'd love to treat setbacks as something I can move past." },
      { type: 'growth_signal', text: 'I got knocked back and tried again the very next day.' },
      { type: 'growth_signal', text: "I'm bouncing back from disappointments a little faster now." },
      { type: 'success_indicator', text: 'I failed at something and came back stronger.' },
      { type: 'success_indicator', text: 'A rejection that used to crush me barely slowed me down.' },
    ],
  },
  identity_self_awareness: {
    problems: [
      { voice: 'general', text: "I don't really know who I am or what I want." },
      { voice: 'general', text: "I feel like I'm living a life that isn't really mine." },
      { voice: 'general', text: 'I have no sense of what actually matters to me.' },
      { voice: 'general', text: "I keep changing myself to fit whoever I'm with." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'Everyone asks what I want to be and I have no idea who I am.' },
      { stakeholder: 'parent', text: 'My child seems unsure of themselves and what they stand for.' },
      { stakeholder: 'teacher', text: "This student hasn't found a sense of who they are yet." },
      { stakeholder: 'counselor', text: 'The person feels disconnected from their own values and direction.' },
      { stakeholder: 'professional', text: "I've built a career but I'm not sure it reflects who I really am." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to feel lost about what I even want." },
      { type: 'frustration', text: "I'm tired of feeling like a different person depending on who's around." },
      { type: 'fear', text: "I'm scared I'll spend my life chasing the wrong things." },
      { type: 'fear', text: "I worry I'll never figure out what really matters to me." },
      { type: 'motivation', text: "I want to feel like I'm living as the real me." },
      { type: 'motivation', text: "I'd love to know what I truly value." },
      { type: 'growth_signal', text: "I said no to something that didn't feel like me." },
      { type: 'growth_signal', text: "I'm getting clearer on what actually matters to me." },
      { type: 'success_indicator', text: 'I made a choice that felt completely true to who I am.' },
      { type: 'success_indicator', text: 'I can finally describe what I value and want.' },
    ],
  },
  expectations_pressure: {
    problems: [
      { voice: 'general', text: "I'm crushed under everyone's expectations of me." },
      { voice: 'general', text: 'I constantly compare myself to others and come up short.' },
      { voice: 'general', text: 'I do things to please my family, not because I want to.' },
      { voice: 'general', text: "I can't enjoy anything because I'm chasing approval." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'The pressure from my parents to perform never lets up.' },
      { stakeholder: 'parent', text: 'My child is buckling under the expectations placed on them.' },
      { stakeholder: 'teacher', text: 'This student seems weighed down by pressure to live up to others.' },
      { stakeholder: 'counselor', text: 'The person measures their worth against everyone else and always loses.' },
      { stakeholder: 'professional', text: "I chase approval at work and never feel like it's enough." },
    ],
    emotions: [
      { type: 'frustration', text: "It's exhausting trying to meet expectations that are never satisfied." },
      { type: 'frustration', text: "I'm sick of measuring myself against everyone else." },
      { type: 'fear', text: "I'm afraid of disappointing the people I'm trying to please." },
      { type: 'fear', text: "I worry I'll never be enough in their eyes." },
      { type: 'motivation', text: "I want to live for myself, not other people's approval." },
      { type: 'motivation', text: "I'd love to stop comparing and just be okay as I am." },
      { type: 'growth_signal', text: 'I made a choice for me, not to please anyone else.' },
      { type: 'growth_signal', text: 'I caught myself comparing and let it go.' },
      { type: 'success_indicator', text: "I did something for myself without needing anyone's approval." },
      { type: 'success_indicator', text: 'I stopped measuring my day by how I stack up to others.' },
    ],
  },
  communication_expression: {
    problems: [
      { voice: 'general', text: "I know what I mean but I can't get the words out clearly." },
      { voice: 'general', text: 'I freeze up when I have to speak in front of people.' },
      { voice: 'general', text: 'People misunderstand me because I struggle to explain myself.' },
      { voice: 'general', text: 'I dread any kind of presentation or public speaking.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I have good ideas but I can't put them into words in class." },
      { stakeholder: 'parent', text: "My child struggles to express what they're feeling or thinking." },
      { stakeholder: 'teacher', text: "This student understands the material but can't articulate it out loud." },
      { stakeholder: 'counselor', text: 'The person finds it hard to put their thoughts into words.' },
      { stakeholder: 'professional', text: 'I struggle to get my point across clearly in meetings.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to have the idea and fumble the words." },
      { type: 'frustration', text: 'I hate being misunderstood when I know what I mean.' },
      { type: 'fear', text: "I'm scared of going blank when all eyes are on me." },
      { type: 'fear', text: "I worry I'll say it wrong and look foolish." },
      { type: 'motivation', text: 'I want to say what I mean clearly and confidently.' },
      { type: 'motivation', text: "I'd love to speak up without dreading it." },
      { type: 'growth_signal', text: 'I shared my idea in a meeting and it came out clearly.' },
      { type: 'growth_signal', text: "I'm getting better at explaining things in my own words." },
      { type: 'success_indicator', text: 'I gave a presentation and actually got my point across.' },
      { type: 'success_indicator', text: 'I spoke up clearly and people understood exactly what I meant.' },
    ],
  },
  focus_attention: {
    problems: [
      { voice: 'general', text: 'I sit down to work and get distracted within minutes.' },
      { voice: 'general', text: 'I check my phone constantly and lose my train of thought.' },
      { voice: 'general', text: "I can't concentrate long enough to finish anything." },
      { voice: 'general', text: 'My mind wanders the moment a task gets boring.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I can't focus on homework for more than five minutes." },
      { stakeholder: 'parent', text: 'My child gets distracted by everything and never finishes their work.' },
      { stakeholder: 'teacher', text: 'This student drifts off and loses focus during lessons.' },
      { stakeholder: 'counselor', text: 'The person finds it nearly impossible to concentrate for long.' },
      { stakeholder: 'professional', text: 'I lose focus at work and end up jumping between tasks.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to lose my focus the second I start." },
      { type: 'frustration', text: "I'm sick of my attention scattering everywhere." },
      { type: 'fear', text: "I'm scared my distraction is holding me back from everything." },
      { type: 'fear', text: "I worry I'll never be able to focus when it really counts." },
      { type: 'motivation', text: 'I want to sit down and actually stay on task.' },
      { type: 'motivation', text: "I'd love to get into the zone and stay there." },
      { type: 'growth_signal', text: 'I worked for a solid stretch without reaching for my phone.' },
      { type: 'growth_signal', text: 'I\u2019m catching myself when my mind starts to wander.' },
      { type: 'success_indicator', text: 'I focused for an hour straight and finished what I started.' },
      { type: 'success_indicator', text: 'I got deep into a task and barely noticed the time.' },
    ],
  },
  curiosity_innovation: {
    problems: [
      { voice: 'general', text: 'I stick to what I know and never try new ideas.' },
      { voice: 'general', text: 'I want to be creative but I always play it safe.' },
      { voice: 'general', text: "I never explore beyond exactly what's required." },
      { voice: 'general', text: "My ideas feel dull and I can't seem to come up with anything fresh." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: 'I only do what\u2019s on the worksheet and never explore further.' },
      { stakeholder: 'parent', text: 'My child used to be so curious and now just sticks to the basics.' },
      { stakeholder: 'teacher', text: 'This student rarely asks questions or experiments with new ideas.' },
      { stakeholder: 'counselor', text: "The person feels they've lost their sense of curiosity." },
      { stakeholder: 'professional', text: 'At work I default to the safe option instead of trying something new.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to feel stuck doing the same thing over and over." },
      { type: 'frustration', text: "I'm annoyed that I never let myself explore new ideas." },
      { type: 'fear', text: "I'm afraid my ideas will be laughed at if I try something different." },
      { type: 'fear', text: "I worry I'm too boring to ever be creative." },
      { type: 'motivation', text: 'I want to explore and try things just to see what happens.' },
      { type: 'motivation', text: "I'd love to come up with ideas that excite me." },
      { type: 'growth_signal', text: 'I tried a new approach instead of the usual one this week.' },
      { type: 'growth_signal', text: "I've started asking more questions about how things work." },
      { type: 'success_indicator', text: 'I came up with a fresh idea and actually ran with it.' },
      { type: 'success_indicator', text: 'I experimented with something new and it paid off.' },
    ],
  },
  decision_judgment: {
    problems: [
      { voice: 'general', text: 'I agonize over even the smallest decisions.' },
      { voice: 'general', text: "I'm so afraid of choosing wrong that I don't choose at all." },
      { voice: 'general', text: "I keep changing my mind after I've already decided." },
      { voice: 'general', text: 'I freeze when I have to make a call under time pressure.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I can't decide which subjects to pick and it's stressing me out." },
      { stakeholder: 'parent', text: 'My child struggles to make even simple choices on their own.' },
      { stakeholder: 'teacher', text: 'This student hesitates endlessly when asked to make a decision.' },
      { stakeholder: 'counselor', text: 'The person is paralyzed by the fear of making the wrong choice.' },
      { stakeholder: 'professional', text: "I sit on decisions at work far too long because I can't commit." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to waste so much time stuck between options." },
      { type: 'frustration', text: "I'm tired of second-guessing every choice I make." },
      { type: 'fear', text: "I'm scared of making the wrong call and regretting it." },
      { type: 'fear', text: 'I worry that one bad decision will ruin everything.' },
      { type: 'motivation', text: 'I want to make decisions and stick with them.' },
      { type: 'motivation', text: "I'd love to choose with confidence instead of dread." },
      { type: 'growth_signal', text: "I made a quick decision and didn't take it back." },
      { type: 'growth_signal', text: "I'm getting faster at choosing without overthinking." },
      { type: 'success_indicator', text: 'I made a tough call under pressure and stood by it.' },
      { type: 'success_indicator', text: 'I decided and moved on without looking back.' },
    ],
  },
  collaboration_teamwork: {
    problems: [
      { voice: 'general', text: 'I struggle to work with others and end up doing it alone.' },
      { voice: 'general', text: 'In group work I either take over or check out completely.' },
      { voice: 'general', text: 'I find it hard to trust teammates to do their part.' },
      { voice: 'general', text: 'I clash with people when we have to work together.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "Group projects stress me out because I can't rely on my team." },
      { stakeholder: 'parent', text: 'My child finds it hard to share and cooperate with others.' },
      { stakeholder: 'teacher', text: 'This student struggles to contribute fairly in group work.' },
      { stakeholder: 'counselor', text: 'The person finds working in a team draining and difficult.' },
      { stakeholder: 'professional', text: 'I find collaborating with my colleagues harder than doing it solo.' },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating when the team doesn't pull its weight." },
      { type: 'frustration', text: "I'm tired of feeling like I have to carry the whole group." },
      { type: 'fear', text: "I'm afraid to rely on others in case they let me down." },
      { type: 'fear', text: "I worry I don't fit in with the team." },
      { type: 'motivation', text: 'I want to work with others without it being a struggle.' },
      { type: 'motivation', text: "I'd love to feel like a real part of a team." },
      { type: 'growth_signal', text: 'I let a teammate handle their part instead of taking over.' },
      { type: 'growth_signal', text: 'I spoke up and contributed in our group this week.' },
      { type: 'success_indicator', text: 'Our team worked together smoothly and I played my part.' },
      { type: 'success_indicator', text: 'I collaborated on something and we got there together.' },
    ],
  },
  social_connection_belonging: {
    problems: [
      { voice: 'general', text: 'I find it really hard to make friends.' },
      { voice: 'general', text: "I always feel like I'm on the outside looking in." },
      { voice: 'general', text: "I feel lonely even when I'm surrounded by people." },
      { voice: 'general', text: "I want to connect with people but I don't know how." },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I eat lunch alone because I don't fit in with anyone." },
      { stakeholder: 'parent', text: 'My child seems lonely and struggles to make friends.' },
      { stakeholder: 'teacher', text: 'This student keeps to themselves and stays on the edge of the group.' },
      { stakeholder: 'counselor', text: "The person feels isolated and like they don't belong anywhere." },
      { stakeholder: 'professional', text: "I feel like an outsider at work and haven't connected with anyone." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to want friends and not know how to get there." },
      { type: 'frustration', text: "I'm tired of always feeling left out." },
      { type: 'fear', text: "I'm scared of being rejected if I reach out." },
      { type: 'fear', text: "I worry I'll always be the one on the outside." },
      { type: 'motivation', text: 'I want to feel like I genuinely belong somewhere.' },
      { type: 'motivation', text: "I'd love to have people I can really connect with." },
      { type: 'growth_signal', text: 'I started a conversation with someone new this week.' },
      { type: 'growth_signal', text: "I'm beginning to feel more at ease around people." },
      { type: 'success_indicator', text: 'I made a real friend and felt like I belonged.' },
      { type: 'success_indicator', text: 'I felt part of the group for the first time in ages.' },
    ],
  },
  networking_relationships: {
    problems: [
      { voice: 'professional', text: 'I hate networking and avoid it completely.' },
      { voice: 'professional', text: "I don't know how to build professional connections." },
      { voice: 'professional', text: 'I never follow up with people I meet.' },
      { voice: 'professional', text: 'I could use a mentor but I have no idea how to find one.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I don't know how to reach out to people who could help my career." },
      { stakeholder: 'parent', text: 'My child has no network to lean on as they start out.' },
      { stakeholder: 'teacher', text: "This student would benefit from mentors but doesn't seek them." },
      { stakeholder: 'counselor', text: 'The person struggles to build the relationships that could open doors.' },
      { stakeholder: 'professional', text: "I'm bad at staying in touch with useful contacts at work." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to watch opportunities pass because I don't know the right people." },
      { type: 'frustration', text: "I'm annoyed at myself for never keeping in touch." },
      { type: 'fear', text: "I'm afraid I'll come across as fake if I reach out." },
      { type: 'fear', text: "I worry I'm falling behind because I have no network." },
      { type: 'motivation', text: 'I want to build relationships that actually help me grow.' },
      { type: 'motivation', text: "I'd love to find a mentor I can learn from." },
      { type: 'growth_signal', text: 'I reached out to someone in my field this week.' },
      { type: 'growth_signal', text: 'I followed up with a contact instead of letting it slide.' },
      { type: 'success_indicator', text: 'I built a connection that led to a real opportunity.' },
      { type: 'success_indicator', text: "I found a mentor who's helping me move forward." },
    ],
  },
  negotiation_advocacy: {
    problems: [
      { voice: 'general', text: 'I never ask for what I deserve because I hate confrontation.' },
      { voice: 'professional', text: "I can't bring myself to negotiate my salary." },
      { voice: 'general', text: 'I let people walk over me instead of standing up for myself.' },
      { voice: 'general', text: 'I avoid conflict even when something really matters to me.' },
    ],
    stakeholders: [
      { stakeholder: 'student', text: "I never speak up when something's unfair because I don't want to argue." },
      { stakeholder: 'parent', text: "My child won't stand up for themselves when they should." },
      { stakeholder: 'teacher', text: 'This student backs down instantly rather than make their case.' },
      { stakeholder: 'counselor', text: 'The person struggles to assert their needs or set boundaries.' },
      { stakeholder: 'professional', text: "I dread negotiating and end up accepting whatever I'm offered." },
    ],
    emotions: [
      { type: 'frustration', text: "It's frustrating to stay silent and then resent it later." },
      { type: 'frustration', text: "I'm tired of letting people take advantage of me." },
      { type: 'fear', text: "I'm scared that standing up for myself will start a fight." },
      { type: 'fear', text: "I worry people won't like me if I push back." },
      { type: 'motivation', text: 'I want to ask for what I deserve without apologizing for it.' },
      { type: 'motivation', text: "I'd love to hold my ground when it matters." },
      { type: 'growth_signal', text: 'I spoke up about something unfair instead of staying quiet.' },
      { type: 'growth_signal', text: 'I set a boundary and stuck to it this week.' },
      { type: 'success_indicator', text: 'I negotiated for what I wanted and got it.' },
      { type: 'success_indicator', text: 'I stood my ground in a tough conversation and felt good about it.' },
    ],
  },
};

// ── Archetype alignment lexicon (lay vocabulary, NOT psychometric tokens) ─────
// A human line is "aligned" to its archetype if it touches any of these everyday
// words/phrases. These are the plain-English shadows of each archetype's theme —
// because the human copy deliberately AVOIDS the clinical signature tokens.
export const ALIGNMENT_LEXICON: Record<string, string[]> = {
  performance_anxiety: ['exam', 'exams', 'test', 'tests', 'interview', 'interviews', 'present', 'presentation', 'presenting', 'panic', 'panicking', 'freeze', 'froze', 'blank', 'nervous', 'nerves', 'pressure', 'worried', 'worry', 'dread', 'choking', 'shaking', 'shake', 'sick', 'tense', 'meeting', 'meetings', 'review', 'reviews', 'stakes', 'calm', 'spiral'],
  career_professional_growth: ['career', 'job', 'jobs', 'workday', 'role', 'roles', 'promotion', 'promoted', 'promotions', 'manager', 'graduate', 'degree', 'paycheck', 'workplace'],
  learning_comprehension: ['read', 'reading', 'study', 'studied', 'studying', 'learn', 'learning', 'understand', 'understanding', 'concept', 'concepts', 'notes', 'recall', 'remember', 'forget', 'explain', 'explained', 'grasp', 'stick', 'sinking', 'class', 'idea', 'ideas', 'topic', 'topics'],
  emotional_regulation: ['mood', 'moods', 'overwhelmed', 'overwhelm', 'overreact', 'meltdown', 'snap', 'temper', 'frustrated', 'calm', 'upset', 'breathe', 'stressful', 'emotions', 'cool', 'control', 'steady', 'function'],
  academic_achievement: ['grade', 'grades', 'exam', 'exams', 'marks', 'results', 'revise', 'revision', 'study', 'subject', 'subjects', 'report', 'card', 'class', 'school', 'term', 'homework', 'assignment'],
  leadership_influence: ['lead', 'leading', 'leader', 'team', 'group', 'charge', 'delegate', 'guide', 'direction', 'vision', 'follow', 'project', 'manage', 'responsibility', 'rally', 'teammate'],
  time_self_discipline: ['deadline', 'deadlines', 'procrastinate', 'procrastinating', 'procrastination', 'minute', 'plan', 'schedule', 'routine', 'routines', 'late', 'time', 'due', 'assignment', 'assignments', 'unreliable', 'clock', 'hours'],
  motivation_drive: ['motivation', 'motivated', 'drive', 'energy', 'energized', 'interest', 'goal', 'goals', 'effort', 'care', 'flat', 'spark', 'started', 'excited', 'nothing'],
  critical_reflective_thinking: ['think', 'thinking', 'question', 'questioning', 'reason', 'reasons', 'reflect', 'reflected', 'analyze', 'mistake', 'mistakes', 'assumption', 'why', 'weigh', 'weighing', 'examine'],
  confidence_self_efficacy: ['confidence', 'confidently', 'believe', 'doubt', 'doubts', 'doubting', 'capable', 'ability', 'second-guess', 'fail', 'worth', 'trust', 'insecure', 'back myself', 'belong', 'challenge'],
  adaptability_change: ['change', 'changes', 'routine', 'plans', 'plan', 'shift', 'uncertain', 'uncertainty', 'unknown', 'adapt', 'adapting', 'adjust', 'adjusted', 'flexible', 'transition', 'unpredictable', 'thrown', 'cope', 'rattled'],
  resilience_recovery: ['failure', 'fail', 'failed', 'failing', 'setback', 'setbacks', 'rejection', 'rejected', 'give up', 'giving up', 'bounce', 'recover', 'knock', 'knocked', 'try again', 'momentum', 'crush', 'stronger'],
  identity_self_awareness: ['who i am', 'myself', 'values', 'value', 'purpose', 'direction', 'matters', 'meaning', 'lost', 'real me', 'true', 'stand for'],
  expectations_pressure: ['expectations', 'pressure', 'compare', 'comparing', 'approval', 'please', 'family', 'parents', 'judge', 'enough', 'standards', 'worth', 'perform', 'others'],
  communication_expression: ['words', 'word', 'speak', 'speaking', 'say', 'express', 'explain', 'communicate', 'presentation', 'speaking', 'articulate', 'meeting', 'meetings', 'clearly', 'talk', 'voice', 'misunderstood', 'point across', 'thoughts'],
  focus_attention: ['focus', 'concentrate', 'concentration', 'distract', 'distracted', 'distraction', 'attention', 'phone', 'wander', 'wanders', 'task', 'tasks', 'finish', 'zone', 'scattering', 'lessons'],
  curiosity_innovation: ['curious', 'curiosity', 'creative', 'create', 'creativity', 'new ideas', 'idea', 'ideas', 'explore', 'experiment', 'experimented', 'try', 'questions', 'fresh', 'invent', 'imagination', 'worksheet'],
  decision_judgment: ['decision', 'decisions', 'decide', 'decided', 'choose', 'choosing', 'choice', 'choices', 'commit', 'indecisive', 'change my mind', 'wrong', 'regret', 'regretting', 'options', 'hesitate', 'hesitates', 'call'],
  collaboration_teamwork: ['team', 'teamwork', 'teammate', 'teammates', 'group', 'collaborate', 'collaborating', 'collaborated', 'cooperate', 'together', 'others', 'contribute', 'contributed', 'share', 'colleagues', 'rely'],
  social_connection_belonging: ['friends', 'friend', 'lonely', 'loneliness', 'belong', 'belonged', 'belonging', 'fit in', 'isolated', 'left out', 'connect', 'connection', 'outside', 'outsider', 'conversation'],
  networking_relationships: ['network', 'networking', 'connections', 'connection', 'contacts', 'contact', 'mentor', 'mentors', 'reach out', 'reached out', 'follow up', 'followed up', 'relationships', 'relationship', 'opportunities', 'opportunity'],
  negotiation_advocacy: ['negotiate', 'negotiating', 'negotiated', 'salary', 'deserve', 'stand up', 'standing up', 'confrontation', 'conflict', 'assert', 'boundary', 'boundaries', 'push back', 'argue', 'unfair', 'ground'],
};

// ── Tokenization (light; mirrors the behaviour engine's intent) ──────────────
const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'with', 'your', 'you',
  'on', 'at', 'by', 'about', 'is', 'are', 'be', 'more', 'less', 'their', 'when',
  'while', 'as', 'too', 'very', 'this', 'that', 'across', 'during', 'within',
  'my', 'i', 'im', 'its', 'it', 'me', 'so', 'but', 'just', 'they', 'them', 'we',
  'he', 'she', 'his', 'her', 'have', 'has', 'had', 'do', 'does', 'did', 'can',
  'cant', 'will', 'would', 'should', 'could', 'not', 'no', 'if', 'out', 'up',
  'down', 'all', 'some', 'any', 'than', 'then', 'now', 'get', 'got', 'feel',
]);
export function tokenize(s?: string | null): string[] {
  if (!s) return [];
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

// ── Validator 1 — human realism (zero psychometric jargon + natural length) ──
// Words a real student/parent/teacher/professional would NEVER use to describe
// themselves. Their presence is a strong signal the line drifted into assessment
// language and breaks the "human translation" contract.
export const PSYCHOMETRIC_WORDS = new Set([
  'assessment', 'assessments', 'assess', 'psychometric', 'construct', 'constructs',
  'trait', 'traits', 'percentile', 'percentiles', 'metric', 'metrics', 'dimension',
  'dimensions', 'competency', 'competencies', 'coherence', 'archetype', 'archetypes',
  'signal', 'signals', 'efficacy', 'self-efficacy', 'regulation', 'dysregulation',
  'reactivity', 'metacognition', 'metacognitive', 'cognition', 'affective',
  'behavioral', 'behavioural', 'indicator', 'indicators', 'variance', 'correlation',
  'factor', 'subscale', 'rubric', 'normed', 'norm', 'quotient', 'calibration',
  'ontology', 'taxonomy', 'valence', 'scoring', 'scored', 'aptitude', 'persona',
  'cohort', 'inventory', 'scale', 'subscales', 'diagnostic', 'diagnostics',
]);

export interface RealismResult {
  pass: boolean;
  jargon: string[];     // psychometric words found
  word_count: number;
  reason: string;
}
const MIN_WORDS = 4;
const MAX_WORDS = 45;

export function checkRealism(text: string): RealismResult {
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;
  const lowerTokens = new Set(tokenize(text));
  const jargon: string[] = [];
  for (const w of PSYCHOMETRIC_WORDS) {
    const t = w.includes('-') ? w : w; // hyphenated handled by tokenize splitting on '-'
    if (lowerTokens.has(t)) jargon.push(w);
    else if (w.includes('-')) { // also catch hyphenated forms split into parts
      const parts = w.split('-');
      if (parts.every((p) => lowerTokens.has(p))) jargon.push(w);
    }
  }
  const lengthOk = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;
  const pass = jargon.length === 0 && lengthOk;
  const reason = jargon.length > 0
    ? `psychometric jargon: ${jargon.join(', ')}`
    : !lengthOk ? `length ${wordCount} outside ${MIN_WORDS}-${MAX_WORDS}` : 'ok';
  return { pass, jargon, word_count: wordCount, reason };
}

// ── Validator 2 — archetype alignment (touches the lay lexicon) ──────────────
export function isAligned(text: string, archetypeKey: string): boolean {
  const lex = ALIGNMENT_LEXICON[archetypeKey];
  if (!lex || lex.length === 0) return false;
  const lower = text.toLowerCase();
  const tokens = new Set(tokenize(text));
  for (const term of lex) {
    // multi-word OR hyphenated phrases: substring match (the tokenizer would have
    // split them); single tokens: exact token match.
    if (term.includes(' ') || term.includes('-')) { if (lower.includes(term)) return true; }
    else if (tokens.has(term)) return true;
  }
  return false;
}

// ── Validator 3 — duplicate detection (Jaccard token overlap) ────────────────
export interface DuplicatePair {
  a: string;
  b: string;
  reason: 'identical' | 'semantic';
  overlap: number;
}
function stmtTokens(s: string): Set<string> {
  return new Set(tokenize(s));
}
/** Flags near-duplicate lines across a list. threshold default 0.6. */
export function detectDuplicates(statements: string[], threshold = 0.6): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  const sets = statements.map(stmtTokens);
  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      if (statements[i] === statements[j]) {
        out.push({ a: statements[i], b: statements[j], reason: 'identical', overlap: 1 });
        continue;
      }
      const a = sets[i], b = sets[j];
      if (a.size === 0 || b.size === 0) continue;
      let inter = 0; for (const t of a) if (b.has(t)) inter++;
      const ov = inter / (a.size + b.size - inter || 1);
      if (ov >= threshold) out.push({ a: statements[i], b: statements[j], reason: 'semantic', overlap: Math.round(ov * 1000) / 1000 });
    }
  }
  return out;
}

/** Set of statements that are the LATER member of at least one duplicate pair. */
export function duplicateMembers(statements: string[], threshold = 0.6): Set<string> {
  return new Set(detectDuplicates(statements, threshold).map((d) => d.b));
}

// ── Per-line quality (for "top quality examples") ────────────────────────────
export interface LineQuality {
  realism: boolean;
  aligned: boolean;
  distinct: boolean;
  word_count: number;
  score: number; // 0..5
}
export function scoreLine(text: string, archetypeKey: string, distinct: boolean): LineQuality {
  const r = checkRealism(text);
  const aligned = isAligned(text, archetypeKey);
  let score = 0;
  if (r.pass) score += 2;
  if (aligned) score += 2;
  if (distinct) score += 1;
  return { realism: r.pass, aligned, distinct, word_count: r.word_count, score };
}

// ── Coverage scorers ─────────────────────────────────────────────────────────
export interface PackCoverage {
  archetype_key: string;
  problem_count: number;
  stakeholders_covered: number;       // distinct stakeholder types present (of 5)
  emotion_categories_covered: number; // distinct emotion types present (of 5)
  problems_ok: boolean;               // >= MIN_PROBLEMS
  stakeholders_ok: boolean;           // all 5
  emotions_ok: boolean;               // all 5
}
export const MIN_PROBLEMS = 3;

export function packCoverage(archetypeKey: string, pack: HumanPack): PackCoverage {
  const stakeholders = new Set(pack.stakeholders.map((s) => s.stakeholder));
  const emotions = new Set(pack.emotions.map((e) => e.type));
  return {
    archetype_key: archetypeKey,
    problem_count: pack.problems.length,
    stakeholders_covered: stakeholders.size,
    emotion_categories_covered: emotions.size,
    problems_ok: pack.problems.length >= MIN_PROBLEMS,
    stakeholders_ok: STAKEHOLDERS.every((s) => stakeholders.has(s)),
    emotions_ok: EMOTION_TYPES.every((e) => emotions.has(e)),
  };
}

// ── Validation targets (canon — runner reports against these; may FAIL) ──────
export const VALIDATION_TARGETS = {
  human_realism: 0.85,
  duplicate_rate_max: 0.10,
  archetype_alignment: 0.85,
} as const;
