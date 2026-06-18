// C-2 Question Semantic Enrichment — committed, reproducible populate script.
// Usage:  node backend/scripts/audit/c2-enrichment-run.mjs
// Requires: DATABASE_URL in env. Idempotent (TRUNCATE + re-populate); safe to re-run.
// Additive + reversible: writes ONLY to capadex_question_enrichment; reverts via DROP TABLE.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { classifyQuestion } from './c2-enrichment-classifier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ddl = fs.readFileSync(path.join(__dirname, 'c2-enrichment-schema.sql'), 'utf8');
  await pool.query(ddl);
  await pool.query('TRUNCATE capadex_question_enrichment');

  const PAGE = 5000;
  let off = 0, total = 0;
  for (;;) {
    const { rows } = await pool.query(
      `SELECT question_id, master_bridge_tag, narrative_style, response_type, question_type, question
       FROM capadex_clarity_questions ORDER BY question_id LIMIT $1 OFFSET $2`,
      [PAGE, off],
    );
    if (rows.length === 0) break;
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000).map(classifyQuestion);
      const vals = [];
      const params = [];
      chunk.forEach((e, k) => {
        const b = k * 9;
        vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`);
        params.push(e.question_id, e.master_bridge_tag, e.context_primary, e.context_secondary,
          e.context_confidence, e.context_source, e.archetype, e.archetype_confidence, e.archetype_source);
      });
      await pool.query(
        `INSERT INTO capadex_question_enrichment
         (question_id,master_bridge_tag,context_primary,context_secondary,context_confidence,context_source,archetype,archetype_confidence,archetype_source)
         VALUES ${vals.join(',')} ON CONFLICT (question_id) DO UPDATE SET
           master_bridge_tag=EXCLUDED.master_bridge_tag, context_primary=EXCLUDED.context_primary,
           context_secondary=EXCLUDED.context_secondary, context_confidence=EXCLUDED.context_confidence,
           context_source=EXCLUDED.context_source, archetype=EXCLUDED.archetype,
           archetype_confidence=EXCLUDED.archetype_confidence, archetype_source=EXCLUDED.archetype_source`,
        params,
      );
    }
    total += rows.length;
    off += PAGE;
    if (rows.length < PAGE) break;
  }
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int n FROM capadex_question_enrichment');
  console.log(`C-2 enrichment populated: ${n} rows (processed ${total}).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
