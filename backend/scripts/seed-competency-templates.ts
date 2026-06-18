/**
 * Seed competency_question_templates from the static AdaptiveQuestion bank.
 *
 * Each item lands as status='approved', source='seed' so it surfaces to users
 * immediately. Re-running is idempotent (ON CONFLICT on template_key).
 *
 * Run: tsx backend/scripts/seed-competency-templates.ts
 */
import { Pool } from 'pg';
import { ADAPTIVE_QUESTION_BANK_V2 } from '../../frontend/src/data/catalogs/assessment-question-bank-v2';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const pool = new Pool({ connectionString: url });
  let inserted = 0, updated = 0;
  for (const q of ADAPTIVE_QUESTION_BANK_V2) {
    const body = {
      prompt: q.prompt,
      options: q.options ?? [],
      best_option: q.best_option,
      depth: q.depth,
      pool_key: q.pool_key,
      role_tags: q.role_tags ?? [],
      industry_tags: q.industry_tags ?? [],
      stage_tags: q.stage_tags ?? [],
      function_tags: q.function_tags ?? [],
      origin_id: q.id,
    };
    const res = await pool.query(
      `INSERT INTO competency_question_templates
         (template_key, competency_code, question_type, template_body,
          difficulty_band, status, source)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'approved', 'seed')
       ON CONFLICT (template_key) DO UPDATE
         SET template_body   = EXCLUDED.template_body,
             difficulty_band = EXCLUDED.difficulty_band,
             updated_at      = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [q.id, q.competency_code, q.question_type, JSON.stringify(body), q.difficulty],
    );
    if (res.rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] competency_question_templates: +${inserted} inserted, ~${updated} updated, total bank=${ADAPTIVE_QUESTION_BANK_V2.length}`);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', e);
  process.exit(1);
});
