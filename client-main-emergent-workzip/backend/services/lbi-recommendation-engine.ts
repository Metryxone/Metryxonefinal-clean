/**
 * LBI Recommendation Engine  (W5)
 *
 * Generates personalised recommendations from the current LBI profile + risk flags.
 * Seeds lbi_recommendation_master + lbi_intervention_library on first call.
 * Writes personalised rows to lbi_user_recommendations.
 *
 * Additive · never-throws.
 */

import pg from 'pg';
import type { RiskType } from './lbi-risk-engine';

export interface LbiRecommendation {
  id: number;
  code: string;
  title: string;
  description: string;
  action_type: string;
  target_dimension: string;
  risk_types_addressed: string[];
  estimated_impact: number;
  effort_level: 'low' | 'medium' | 'high';
  time_to_complete: string;
  priority_score: number;
  is_actioned: boolean;
  display_order: number;
}

export interface LbiIntervention {
  id: number;
  code: string;
  title: string;
  description: string;
  intervention_type: string;
  target_dimension: string;
  duration_minutes: number | null;
  frequency: string | null;
  evidence_basis: string | null;
}

// ── Schema ────────────────────────────────────────────────────────────────────

let schemaReady = false;
let masterSeeded = false;

async function ensureSchema(pool: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_recommendation_master (
      id                   SERIAL  PRIMARY KEY,
      code                 TEXT    UNIQUE NOT NULL,
      title                TEXT    NOT NULL,
      description          TEXT,
      action_type          TEXT,
      target_dimension     TEXT    NOT NULL,
      risk_types           TEXT[]  DEFAULT '{}',
      min_score_trigger    INTEGER DEFAULT 0,
      max_score_trigger    INTEGER DEFAULT 100,
      estimated_impact     INTEGER DEFAULT 5,
      effort_level         TEXT    DEFAULT 'medium',
      time_to_complete     TEXT,
      display_order        INTEGER DEFAULT 0,
      is_active            BOOLEAN DEFAULT TRUE,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS lbi_user_recommendations (
      id                 SERIAL  PRIMARY KEY,
      user_email         TEXT    NOT NULL,
      recommendation_id  INTEGER REFERENCES lbi_recommendation_master(id),
      priority_score     NUMERIC(5,2) DEFAULT 0,
      is_actioned        BOOLEAN DEFAULT FALSE,
      actioned_at        TIMESTAMPTZ,
      generated_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, recommendation_id)
    );
    CREATE TABLE IF NOT EXISTS lbi_intervention_library (
      id                 SERIAL  PRIMARY KEY,
      code               TEXT    UNIQUE NOT NULL,
      title              TEXT    NOT NULL,
      description        TEXT,
      intervention_type  TEXT,
      target_dimension   TEXT    NOT NULL,
      duration_minutes   INTEGER,
      frequency          TEXT,
      evidence_basis     TEXT,
      is_active          BOOLEAN DEFAULT TRUE,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

// ── Master Seed (idempotent) ──────────────────────────────────────────────────

async function seedMaster(pool: pg.Pool): Promise<void> {
  if (masterSeeded) return;
  const existing = await pool.query(`SELECT COUNT(*) AS n FROM lbi_recommendation_master`);
  if (Number(existing.rows[0]?.n ?? 0) >= 20) { masterSeeded = true; return; }

  await pool.query(`
    INSERT INTO lbi_recommendation_master
      (code,title,description,action_type,target_dimension,risk_types,
       min_score_trigger,max_score_trigger,estimated_impact,effort_level,time_to_complete,display_order)
    VALUES
      -- Attention dimension (attention_risk)
      ('lbi_attn_01','Practice a Daily Focus Block',
       'Dedicate 25-minute uninterrupted blocks (Pomodoro technique) to one subject per session. Place phone face-down and close unrelated tabs.',
       'micro_habit','attention_score','{"attention_risk"}',0,50,8,'low','Daily / 25 min',10),
      ('lbi_attn_02','Use Active Reading with a Pen',
       'Read with a pen in hand — underline key points, write marginal questions, and summarise each paragraph in your own words before moving on.',
       'study_technique','attention_score','{"attention_risk"}',0,60,7,'low','During study',20),
      ('lbi_attn_03','Identify Your Peak Focus Hours',
       'Track your energy and focus for one week. Schedule your most demanding tasks during the 2-hour window when you are naturally most alert.',
       'self_reflection','attention_score','{"attention_risk","disengagement_risk"}',0,55,6,'low','1 week experiment',30),
      ('lbi_attn_04','Reduce Environmental Friction',
       'Prepare your study environment before each session: clear the desk, set one clear goal, and agree with those around you that you are unavailable for 25 minutes.',
       'behavioral_change','attention_score','{"attention_risk"}',0,65,5,'low','10 min prep',40),

      -- Consistency dimension (motivation_risk)
      ('lbi_con_01','Build a Non-Negotiable Daily Anchor',
       'Choose one learning activity (e.g. 10 minutes of reading or 3 practice problems) that happens every single day — even on tired days. Consistency compounds.',
       'micro_habit','consistency_score','{"motivation_risk"}',0,45,8,'low','Daily / 10 min',50),
      ('lbi_con_02','Track Your Streak',
       'Use a paper habit tracker or an app to mark each day you study. The visual streak becomes a motivator in itself. Do not break the chain.',
       'behavioral_change','consistency_score','{"motivation_risk"}',0,50,6,'low','2 min per day',60),
      ('lbi_con_03','Pair Learning with a Reward',
       'After each consistent study session, follow immediately with something pleasurable (music, a snack, a short walk). The brain begins to associate studying with reward.',
       'behavioral_change','consistency_score','{"motivation_risk","disengagement_risk"}',0,48,5,'low','After sessions',70),
      ('lbi_con_04','Find an Accountability Partner',
       'Share your weekly study goals with someone whose opinion you value. Check in on Friday with what you achieved. Social accountability is one of the strongest behaviour change levers.',
       'social_activity','consistency_score','{"motivation_risk"}',0,55,7,'medium','Weekly check-in',80),

      -- Persistence dimension (motivation_risk)
      ('lbi_per_01','Reframe Difficulty as Progress',
       'When you feel stuck, write the sentence: "I am struggling with X, which means I am working at my edge — this is how learning happens." Keep this card at your desk.',
       'self_reflection','persistence_score','{"motivation_risk"}',0,45,7,'low','2 min when stuck',90),
      ('lbi_per_02','Use the "2-Minute Rule" for Hard Tasks',
       'When you want to avoid a difficult topic, commit to just 2 minutes. You will almost always continue beyond 2 minutes. Starting is the hardest part.',
       'micro_habit','persistence_score','{"motivation_risk","disengagement_risk"}',0,50,8,'low','Before each session',100),
      ('lbi_per_03','Celebrate Effort, Not Just Results',
       'After each study session, write one thing you tried hard at — regardless of whether you succeeded. Effort-based self-recognition builds persistence over time.',
       'self_reflection','persistence_score','{"motivation_risk"}',0,55,5,'low','2 min post-session',110),
      ('lbi_per_04','Break the Mountain into Rocks',
       'Take the topic you are avoiding most and break it into 5 sub-tasks of 15 minutes each. Schedule one sub-task per day this week. Mountains become manageable.',
       'study_technique','persistence_score','{"motivation_risk","overload_risk"}',0,60,6,'medium','Planning: 15 min',120),

      -- Adaptability dimension (overload_risk)
      ('lbi_adp_01','Study the Same Concept Three Ways',
       'For any topic you are stuck on, force yourself to learn it through three different media: read it, watch a video about it, then try to teach it back. Different formats break rigidity.',
       'study_technique','adaptability_score','{"overload_risk"}',0,40,7,'medium','Per topic: 45 min',130),
      ('lbi_adp_02','Embrace One New Study Method Per Week',
       'Try a method you have never used: spaced repetition flashcards, mind mapping, the Feynman Technique, or a study group. Exposure to variety builds cognitive flexibility.',
       'behavioral_change','adaptability_score','{"overload_risk"}',0,45,6,'low','Weekly experiment',140),
      ('lbi_adp_03','Practice "Good Enough" Submission',
       'On low-stakes tasks, deliberately submit work that is 80% polished rather than 100%. Perfectionism and rigidity are often linked — practise letting go.',
       'behavioral_change','adaptability_score','{"overload_risk"}',0,40,5,'low','Next 3 tasks',150),
      ('lbi_adp_04','Seek Out Discomfort Intentionally',
       'Once a week, deliberately attend a lecture, seminar or video in a subject area you know little about. Cognitive flexibility grows when you regularly enter uncertainty.',
       'practice_activity','adaptability_score','{"overload_risk"}',0,50,5,'medium','Weekly / 30 min',160),

      -- Velocity dimension (disengagement_risk)
      ('lbi_vel_01','Use Spaced Repetition',
       'Review material at increasing intervals: 1 day, 3 days, 7 days, 14 days. Apps like Anki automate this. Spaced practice is the most evidence-based technique for learning velocity.',
       'study_technique','velocity_score','{"disengagement_risk"}',0,45,8,'medium','Ongoing daily',170),
      ('lbi_vel_02','Interleave Practice Topics',
       'Instead of studying one subject for a full session, alternate between 2-3 related topics in the same session. Interleaving initially feels harder but doubles retention speed.',
       'study_technique','velocity_score','{"disengagement_risk"}',0,50,7,'medium','Per study session',180),
      ('lbi_vel_03','Test Yourself Before Reviewing Notes',
       'Before rereading notes on a topic, write down everything you remember first. This retrieval attempt — even when imperfect — accelerates future recall.',
       'study_technique','velocity_score','{"disengagement_risk"}',0,55,6,'low','Before review',190),
      ('lbi_vel_04','Set a "Learn One New Thing" Daily Goal',
       'Each day, commit to learning and being able to explain one new, specific concept. Focus on depth over breadth. Compound velocity over 30 days is transformative.',
       'micro_habit','velocity_score','{"disengagement_risk","motivation_risk"}',0,50,6,'low','Daily / 20 min',200)
    ON CONFLICT (code) DO UPDATE SET
      title=EXCLUDED.title, description=EXCLUDED.description,
      is_active=TRUE;
  `);

  // Intervention library (~20 rows)
  await pool.query(`
    INSERT INTO lbi_intervention_library
      (code,title,description,intervention_type,target_dimension,duration_minutes,frequency,evidence_basis)
    VALUES
      ('int_attn_01','Pomodoro Focus Blocks','25 min focused work + 5 min break. Trains attention capacity through structured intervals.','micro_habit','attention_score',25,'Daily','Cirillo (1987); meta-analysis on time-boxing and attention control'),
      ('int_attn_02','Mindful Breath Reset','60-second breath awareness before study. Shifts the nervous system from reactive to focused state.','self_reflection','attention_score',1,'Before each session','Zeidan et al. (2010), mindfulness and sustained attention'),
      ('int_attn_03','Single-Tab Study Rule','Only one browser tab open during study. Reduce cognitive switching overhead.','behavioral_change','attention_score',0,'Ongoing','Gloria Mark (2004), task-switching costs'),
      ('int_con_01','Habit Stacking','Attach the learning habit to an existing daily habit (e.g. study after breakfast). Reduces activation energy.','micro_habit','consistency_score',0,'Daily','Fogg (2019), Tiny Habits'),
      ('int_con_02','Weekly Review Ritual','5-minute Sunday review: what did I learn? what will I study this week? Sets intention and maintains momentum.','self_reflection','consistency_score',5,'Weekly','Clear (2018), Atomic Habits — review loops'),
      ('int_per_01','Growth Mindset Journaling','After a frustrating session, write: "I struggled with X. I learned Y. Next time I will try Z." Externalises effort.','self_reflection','persistence_score',5,'After hard sessions','Dweck (2006), Growth Mindset; Pennebaker (1997), expressive writing'),
      ('int_per_02','Task Decomposition Sprint','Break a feared task into ≤15-min sub-tasks. Schedule only sub-task 1. Reduces avoidance.','micro_habit','persistence_score',10,'Before hard tasks','Steel (2007), procrastination & task structure'),
      ('int_adp_01','Three-Method Rule','For any new concept, engage via ≥3 formats (read, watch, explain). Builds representational flexibility.','study_technique','adaptability_score',45,'Per new topic','Paivio (1990), dual coding theory'),
      ('int_adp_02','Weekly Method Experiment','Try one new study technique each week. Track what worked. Builds a personalised learning toolkit.','behavioral_change','adaptability_score',0,'Weekly','Dunlosky et al. (2013), study technique effectiveness'),
      ('int_vel_01','Spaced Repetition System','Review material at expanding intervals. Use Anki or Remnote. Most efficient method for long-term retention.','study_technique','velocity_score',15,'Daily','Ebbinghaus (1885); Cepeda et al. (2006), spacing effect meta-analysis'),
      ('int_vel_02','Retrieval Practice Before Review','Test yourself before re-reading. The testing effect accelerates retention by 50% vs passive re-reading.','study_technique','velocity_score',10,'Before review sessions','Roediger & Karpicke (2006), testing effect'),
      ('int_vel_03','Interleaved Practice','Mix topics within sessions. Harder short-term, significantly stronger long-term retention.','study_technique','velocity_score',0,'Per session','Kornell & Bjork (2008), interleaving benefits'),
      ('int_mot_01','Purpose Journaling','Write 3 reasons why your learning goal matters to you personally. Re-read before each study session.','self_reflection','consistency_score',5,'Weekly','Eccles & Wigfield (2002), expectancy-value motivation theory'),
      ('int_mot_02','Progress Photography','After each study session, take a photo of what you produced (notes, problems solved). Visible progress drives motivation.','behavioral_change','velocity_score',1,'After sessions','Amabile & Kramer (2011), progress principle'),
      ('int_str_01','Breath & Ground Before Assessments','Before any test: 4 counts in, 4 hold, 4 out. Lowers cortisol acutely. Do 5 cycles.','micro_habit','attention_score',2,'Before assessments','Zaccaro et al. (2018), slow breathing and anxiety reduction'),
      ('int_sr_01','Pre-Session Intention Setting','Before studying, write: what I will focus on + how long + what done looks like. 90 seconds.','self_reflection','consistency_score',2,'Before each session','Gollwitzer (1999), implementation intentions'),
      ('int_goal_01','OKR for Learning','Set one Objective (e.g. master Chapter 5) and 3 Key Results (e.g. complete all exercises, score >80% on practice test, explain to someone). Review weekly.','self_reflection','velocity_score',10,'Weekly','Doerr (2018), OKR framework adapted for learning'),
      ('int_col_01','Teach-Back Sessions','Explain a concept you just learned to a friend, sibling or study partner. Identifying what you cannot explain is the fastest route to identifying gaps.','peer_activity','velocity_score',15,'After each major topic','Whitman (1988), peer teaching; Feynman technique'),
      ('int_mem_01','Spaced Writing','After reading, close the book and write a summary from memory. Compare to source. Identify gaps. Repeat.','study_technique','velocity_score',10,'After each reading block','Karpicke & Blunt (2011), elaborative interrogation and retrieval'),
      ('int_dis_01','Curiosity Questions','Before a topic you find boring, write 3 questions you are genuinely curious about within it. Curiosity activates the dopaminergic reward loop in learning.','self_reflection','consistency_score',3,'Before disliked topics','Gruber et al. (2014), curiosity and memory')
    ON CONFLICT (code) DO UPDATE SET title=EXCLUDED.title, is_active=TRUE;
  `);

  masterSeeded = true;
}

// ── Learning style → intervention affinity multipliers (E3) ──────────────────
// Boosts/suppresses priority based on how well an action_type matches the learner's style.
// disengaged: low-effort only; reflective: analytical methods; persistent: habit/behavioural;
// exploratory: social/practice; impulsive: micro-habits, penalise high-effort.
const STYLE_MULTIPLIER: Record<string, (m: { action_type: string; effort_level: string }) => number> = {
  disengaged:  m => m.effort_level === 'low' ? 1.30 : m.effort_level === 'high' ? 0.70 : 1.00,
  reflective:  m => ['self_reflection', 'study_technique'].includes(m.action_type) ? 1.20 : 1.00,
  persistent:  m => ['micro_habit', 'behavioral_change'].includes(m.action_type) ? 1.20 : 1.00,
  exploratory: m => ['peer_activity', 'practice_activity'].includes(m.action_type) ? 1.20 : 1.00,
  impulsive:   m => m.action_type === 'micro_habit' ? 1.25 : m.effort_level === 'high' ? 0.80 : 1.00,
};

// ── Compute & Persist ─────────────────────────────────────────────────────────

export async function computeAndPersistRecommendations(
  email: string,
  pool: pg.Pool
): Promise<void> {
  try {
    await ensureSchema(pool);
    await seedMaster(pool);

    const client = await pool.connect();
    try {
      // Get current LBI scores
      const scoreRes = await client.query(
        `SELECT attention_score, consistency_score, persistence_score,
                velocity_score, adaptability_score, overall_lbi, learning_style
         FROM lbi_scores WHERE user_email=$1 LIMIT 1`,
        [email]
      );
      if (!scoreRes.rows[0]) return;

      const s = scoreRes.rows[0];
      const dimMap: Record<string, number | null> = {
        attention_score:    s.attention_score    != null ? Number(s.attention_score)    : null,
        consistency_score:  s.consistency_score  != null ? Number(s.consistency_score)  : null,
        persistence_score:  s.persistence_score  != null ? Number(s.persistence_score)  : null,
        velocity_score:     s.velocity_score     != null ? Number(s.velocity_score)     : null,
        adaptability_score: s.adaptability_score != null ? Number(s.adaptability_score) : null,
      };

      // Get active risk types
      const riskRes = await client.query(
        `SELECT risk_type FROM lbi_risk_indicators WHERE user_email=$1 AND is_active=TRUE`,
        [email]
      );
      const activeRisks = new Set<string>(riskRes.rows.map((r: any) => r.risk_type));

      // Get all active master recommendations
      const masterRes = await client.query(
        `SELECT id, code, target_dimension, min_score_trigger, max_score_trigger,
                estimated_impact, risk_types, effort_level, action_type
         FROM lbi_recommendation_master WHERE is_active=TRUE`
      );

      for (const m of masterRes.rows) {
        const dimScore = dimMap[m.target_dimension] ?? null;
        if (dimScore == null) continue;
        if (dimScore < m.min_score_trigger || dimScore > m.max_score_trigger) continue;

        // Priority = impact-weighted gap severity + risk bonus × learning style multiplier (E3)
        const gap = Math.max(0, 60 - dimScore);
        const riskBonus = (m.risk_types as string[]).some(rt => activeRisks.has(rt)) ? 15 : 0;
        const effortPenalty = m.effort_level === 'high' ? 5 : m.effort_level === 'medium' ? 2 : 0;
        const styleMultiplier = STYLE_MULTIPLIER[s.learning_style ?? 'exploratory']?.(m) ?? 1.0;
        const priority = Math.round(
          ((gap / 60) * 60 + (m.estimated_impact / 10) * 25 + riskBonus - effortPenalty) * styleMultiplier
        );

        await client.query(`
          INSERT INTO lbi_user_recommendations
            (user_email, recommendation_id, priority_score, is_actioned, generated_at)
          VALUES ($1,$2,$3,FALSE,NOW())
          ON CONFLICT (user_email, recommendation_id) DO UPDATE SET
            priority_score=$3, generated_at=NOW()
        `, [email, m.id, Math.min(100, Math.max(0, priority))]);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-rec] computeAndPersistRecommendations error:', err);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getRecommendations(
  email: string,
  pool: pg.Pool,
  limit = 10
): Promise<LbiRecommendation[]> {
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT m.id, m.code, m.title, m.description, m.action_type,
               m.target_dimension, m.risk_types, m.estimated_impact,
               m.effort_level, m.time_to_complete, m.display_order,
               ur.priority_score, ur.is_actioned
        FROM lbi_user_recommendations ur
        JOIN lbi_recommendation_master m ON m.id = ur.recommendation_id
        WHERE ur.user_email=$1 AND m.is_active=TRUE
        ORDER BY ur.priority_score DESC, m.display_order ASC
        LIMIT $2
      `, [email, limit]);

      return res.rows.map(r => ({
        id:                   r.id,
        code:                 r.code,
        title:                r.title,
        description:          r.description ?? '',
        action_type:          r.action_type ?? '',
        target_dimension:     r.target_dimension,
        risk_types_addressed: Array.isArray(r.risk_types) ? r.risk_types : [],
        estimated_impact:     Number(r.estimated_impact ?? 0),
        effort_level:         r.effort_level as 'low' | 'medium' | 'high',
        time_to_complete:     r.time_to_complete ?? '',
        priority_score:       Number(r.priority_score ?? 0),
        is_actioned:          Boolean(r.is_actioned),
        display_order:        Number(r.display_order ?? 0),
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-rec] getRecommendations error:', err);
    return [];
  }
}

export async function getInterventions(
  targetDimension: string | null,
  pool: pg.Pool
): Promise<LbiIntervention[]> {
  try {
    await ensureSchema(pool);
    await seedMaster(pool);
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, code, title, description, intervention_type, target_dimension,
                duration_minutes, frequency, evidence_basis
         FROM lbi_intervention_library
         WHERE is_active=TRUE ${targetDimension ? 'AND target_dimension=$1' : ''}
         ORDER BY id`,
        targetDimension ? [targetDimension] : []
      );
      return res.rows.map(r => ({
        id:                r.id,
        code:              r.code,
        title:             r.title,
        description:       r.description ?? '',
        intervention_type: r.intervention_type ?? '',
        target_dimension:  r.target_dimension,
        duration_minutes:  r.duration_minutes != null ? Number(r.duration_minutes) : null,
        frequency:         r.frequency ?? null,
        evidence_basis:    r.evidence_basis ?? null,
      }));
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-rec] getInterventions error:', err);
    return [];
  }
}

export async function markRecommendationActioned(
  email: string,
  recommendationId: number,
  pool: pg.Pool
): Promise<boolean> {
  try {
    await ensureSchema(pool);
    await pool.query(
      `UPDATE lbi_user_recommendations SET is_actioned=TRUE, actioned_at=NOW()
       WHERE user_email=$1 AND recommendation_id=$2`,
      [email, recommendationId]
    );
    return true;
  } catch (err) {
    console.error('[lbi-rec] markActioned error:', err);
    return false;
  }
}
