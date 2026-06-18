// C-1A PILOT — committed, reproducible pilot enrichment (SANDBOX ONLY).
// Usage: node backend/scripts/audit/c1a-pilot-enrich.mjs
// Requires DATABASE_URL. Idempotent. Writes ONLY to pilot_c1a_enrichment (revert = DROP TABLE).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { classifyArchetype, classifyContext } from './c2-enrichment-classifier.mjs';
import { classifyPilotRow } from './c1a-pilot-classifier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PILOT_TAGS = [
  'EMOTIONAL_REGULATION', 'CAREER_READINESS', 'DISCIPLINE_HABITS', 'SOCIAL_EMOTIONAL',
  'CONFIDENCE_SELF', 'MOTIVATION_VALUES', 'ADJUSTMENT_COPING', 'THINKING_QUALITY',
  'LIFESTYLE_PRESSURE', 'LEARNING_ADAPTABILITY',
];

async function main() {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(fs.readFileSync(path.join(__dirname, 'c1a-pilot-schema.sql'), 'utf8'));
  await pool.query('TRUNCATE pilot_c1a_enrichment');

  // Load real grounding evidence per pilot tag (the ONLY allowed signal-backfill source).
  const { rows: gr } = await pool.query(
    `SELECT bridge_tag, signal_family, AVG(similarity) similarity,
       CASE MAX(CASE evidence_strength WHEN 'weak' THEN 1 WHEN 'moderate' THEN 2
                                       WHEN 'good' THEN 3 WHEN 'strong' THEN 4 ELSE 0 END)
            WHEN 4 THEN 'strong' WHEN 3 THEN 'good' WHEN 2 THEN 'moderate'
            WHEN 1 THEN 'weak' ELSE 'unknown' END AS evidence_strength
     FROM capadex_bridge_tag_signal_grounding WHERE bridge_tag = ANY($1)
     GROUP BY bridge_tag, signal_family`,
    [PILOT_TAGS],
  );
  const groundedByTag = {};
  for (const g of gr) (groundedByTag[g.bridge_tag] ||= []).push(g);

  const { rows } = await pool.query(
    `SELECT question_id, master_bridge_tag, narrative_style, response_type, question
     FROM capadex_clarity_questions WHERE master_bridge_tag = ANY($1) ORDER BY question_id`,
    [PILOT_TAGS],
  );

  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000).map((r) => {
      const ctx = classifyContext(r);
      const arch = classifyArchetype(r);
      const pilot = classifyPilotRow(r, groundedByTag);
      return { ...pilot, context_primary: ctx.context_primary, archetype: arch.archetype };
    });
    const vals = []; const params = [];
    chunk.forEach((e, k) => {
      const b = k * 13;
      vals.push(`(${Array.from({ length: 13 }, (_, j) => `$${b + j + 1}`).join(',')})`);
      params.push(e.question_id, e.master_bridge_tag, e.context_primary, e.archetype,
        e.capability_facet, e.capability_facet_secondary, e.capability_confidence,
        e.behavior_facet, e.behavior_facet_secondary, e.behavior_confidence,
        e.signal_family_backfill, e.signal_confidence, e.signal_source);
    });
    await pool.query(
      `INSERT INTO pilot_c1a_enrichment
       (question_id,master_bridge_tag,context_primary,archetype,capability_facet,capability_facet_secondary,
        capability_confidence,behavior_facet,behavior_facet_secondary,behavior_confidence,
        signal_family_backfill,signal_confidence,signal_source)
       VALUES ${vals.join(',')} ON CONFLICT (question_id) DO NOTHING`,
      params,
    );
  }
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM pilot_c1a_enrichment');
  console.log(`C-1A pilot enriched: ${n} rows across ${PILOT_TAGS.length} tags. Grounded tags: ${Object.keys(groundedByTag).join(', ') || '(none)'}.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
