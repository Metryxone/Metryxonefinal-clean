/**
 * Seed: Professional "Focus at Work" clarity questions.
 *
 * WHY: the free-text resolver maps "focus at work" (Working Professional) to
 * master concern CONCERN_LEA_602 ("Weak Ability to Sustain Focus During Long
 * Work Hours"), whose bridge tag is ACADEMIC_COGNITIVE. Every existing clarity
 * row under that tag belongs to academic personas (Student/Learner/Parent/…),
 * so the picker's hard persona filter emptied the pool for professionals and
 * the clarify phase dead-ended to the generic static fallback.
 *
 * FIX (data, not code): seed professional, workplace-specific clarity rows under
 * the SAME bridge tag (ACADEMIC_COGNITIVE) with `concern` set to LEA_602's
 * cluster — so they are the ONLY professional-persona rows under that tag. The
 * existing 3-tier picker (pickQuestionsFromMaster), persona + age filters,
 * Fisher–Yates shuffle, answeredIds exclusion mask and proxy reframer then serve
 * them unchanged. No schema change, no frontend change.
 *
 * Idempotent: deletes prior FAW_PROF_* rows then re-inserts.
 *
 * Run: node backend/scripts/seed-focus-at-work-clarity.mjs   (from repo root, or
 *      node scripts/seed-focus-at-work-clarity.mjs from backend/)
 */
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const CONCERN_ID = 'CONCERN_LEA_602';
const CONCERN_CLUSTER = 'Weak Ability to Sustain Focus During Long Work Hours';
const BRIDGE_TAG = 'ACADEMIC_COGNITIVE';

const QUESTIONS = [
  {
    question_id: 'FAW_PROF_001',
    question:
      'When managing competing deadlines or high-priority tasks at work, what typically breaks your focus first?',
    options: [
      'Digital interruptions (Slack, emails, phone notifications)',
      'Internal fatigue or burnout from prolonged screen time',
      'Ambiguity around which task truly takes priority',
      'Constant context-switching across different projects',
    ],
  },
  {
    question_id: 'FAW_PROF_002',
    question:
      'When you notice your focus slipping during a critical workday project, how do you typically handle the drift?',
    options: [
      'Push through the fatigue, even if output quality drops',
      'Step away completely to reset, risking timeline delays',
      'Switch to lower-cognitive tasks like sorting emails',
      'Procrastinate or browse non-work channels to escape the friction',
    ],
  },
  {
    question_id: 'FAW_PROF_003',
    question:
      'What does your executive focus or workplace concentration style look like on an average day?',
    options: [
      'Highly cyclical — deep bursts of focus followed by prolonged slumps',
      'Reactive — constantly responding to urgent workspace demands instead of deep work',
      'Anxious — focus is sustained entirely by high-pressure incoming deadlines',
      'Avoidant — struggle immensely to initiate complex tasks, leading to major delays',
    ],
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ids = QUESTIONS.map((q) => q.question_id);
    const del = await client.query(
      `DELETE FROM capadex_clarity_questions WHERE question_id = ANY($1::text[])`,
      [ids],
    );
    console.log(`Removed ${del.rowCount} pre-existing FAW_PROF_* row(s).`);

    for (const q of QUESTIONS) {
      const [a, b, c, d] = q.options;
      await client.query(
        `INSERT INTO capadex_clarity_questions (
           question_id, concern_id, concern_id_prefix, master_bridge_tag,
           text_bridge_tag, concern, stage, question_type, narrative_style,
           question, response_type,
           option_a, option_b, option_c, option_d, option_e,
           option_a_score, option_b_score, option_c_score, option_d_score, option_e_score,
           polarity, reverse_score, question_weight, source_row_index,
           created_at, updated_at
         ) VALUES (
           $1, $2, 'CONCERN', $3,
           NULL, $4, 'Clarity', 'clarity', 'reflective',
           $5, 'situational_fit',
           $6, $7, $8, $9, NULL,
           2, 2, 2, 2, 0,
           'negative', 'no', 0.950, NULL,
           now(), now()
         )`,
        [q.question_id, CONCERN_ID, BRIDGE_TAG, CONCERN_CLUSTER, q.question, a, b, c, d],
      );
      console.log(`Inserted ${q.question_id}: ${q.question.slice(0, 60)}…`);
    }

    await client.query('COMMIT');
    console.log(`\nDone — seeded ${QUESTIONS.length} professional focus-at-work clarity rows.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
