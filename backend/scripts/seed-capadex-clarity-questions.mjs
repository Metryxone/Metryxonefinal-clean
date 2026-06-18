#!/usr/bin/env node
/**
 * Seed `capadex_clarity_questions` from audited_clarity_questions.csv.
 *
 * - Lazy DDL (idempotent CREATE TABLE IF NOT EXISTS via the migration SQL)
 * - TRUNCATE + chunked bulk insert wrapped in a single BEGIN/COMMIT so the
 *   table is never half-populated even when the source CSV is partial.
 * - Logs row counts + join coverage against capadex_concerns_master so the
 *   operator can verify the relational layer landed correctly.
 *
 * Usage: node backend/scripts/seed-capadex-clarity-questions.mjs
 *        [CSV_PATH=audited_clarity_questions.csv]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '../..');

const CSV_PATH = process.argv[2] || path.join(REPO_ROOT, 'audited_clarity_questions.csv');
const DDL_PATH = path.join(REPO_ROOT, 'backend/migrations/20260528_capadex_clarity_questions.sql');
const CHUNK_SIZE = 500;

const COLUMN_MAP = {
  question_id:           'question_id',
  concern_id:            'concern_id',
  concern_id_prefix:     'concern_id_prefix',
  master_bridge_tag:     'master_bridge_tag',
  Relational_Bridge_Tag: 'text_bridge_tag',
  concern:               'concern',
  Stage:                 'stage',
  question_type:         'question_type',
  narrative_style:       'narrative_style',
  question:              'question',
  response_type:         'response_type',
  'Option A':            'option_a',
  'Option B':            'option_b',
  'Option C':            'option_c',
  'Option D':            'option_d',
  'Option E':            'option_e',
  'Option A Score':      'option_a_score',
  'Option B Score':      'option_b_score',
  'Option C Score':      'option_c_score',
  'Option D Score':      'option_d_score',
  'Option E Score':      'option_e_score',
  polarity:              'polarity',
  reverse_score:         'reverse_score',
  question_weight:       'question_weight',
  low_score_anchor:      'low_score_anchor',
  high_score_anchor:     'high_score_anchor',
};
const DB_COLUMNS = Object.values(COLUMN_MAP);
const INT_COLS   = new Set(['option_a_score','option_b_score','option_c_score','option_d_score','option_e_score','source_row_index']);
const NUM_COLS   = new Set(['question_weight']);
const REQUIRED_TEXT_DEFAULTS = {
  master_bridge_tag: 'UNMAPPED', response_type: 'frequency',
  polarity: 'negative', reverse_score: 'no',
};

function coerce(col, raw) {
  if (raw === undefined || raw === null) return REQUIRED_TEXT_DEFAULTS[col] ?? null;
  const s = String(raw).trim();
  if (s === '' || s.toLowerCase() === 'nan') return REQUIRED_TEXT_DEFAULTS[col] ?? null;
  if (INT_COLS.has(col)) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (NUM_COLS.has(col)) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 1.0;
  }
  return s;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL not set'); process.exit(2);
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`✗ Audited CSV not found: ${CSV_PATH}`); process.exit(2);
  }

  console.log(`▶ Seeding capadex_clarity_questions from ${path.relative(REPO_ROOT, CSV_PATH)}`);
  const ddl = fs.readFileSync(DDL_PATH, 'utf8');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log('  → Applying lazy DDL');
    await client.query(ddl);

    const csv = fs.readFileSync(CSV_PATH, 'utf8');
    const records = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
    console.log(`  → Parsed ${records.length} rows from CSV`);

    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE capadex_clarity_questions RESTART IDENTITY');

    const cols = DB_COLUMNS.concat(['source_row_index']);
    const placeholders = (offset) =>
      cols.map((_, j) => `$${offset + j + 1}`).join(', ');

    let inserted = 0;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const values = [];
      const tuples = [];
      chunk.forEach((row, idx) => {
        const tuple = [];
        for (const [csvCol, dbCol] of Object.entries(COLUMN_MAP)) {
          tuple.push(coerce(dbCol, row[csvCol]));
        }
        tuple.push(i + idx); // source_row_index
        values.push(...tuple);
        tuples.push(`(${placeholders(values.length - cols.length)})`);
      });
      const sql = `INSERT INTO capadex_clarity_questions (${cols.join(', ')}) VALUES ${tuples.join(', ')}`;
      await client.query(sql, values);
      inserted += chunk.length;
      if (i % (CHUNK_SIZE * 4) === 0) process.stdout.write(`    … ${inserted}/${records.length}\r`);
    }
    await client.query('COMMIT');
    console.log(`\n  ✓ Inserted ${inserted} rows`);

    // Verification
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM capadex_clarity_questions)                                          AS rows,
        (SELECT COUNT(DISTINCT concern_id)        FROM capadex_clarity_questions)                 AS concerns,
        (SELECT COUNT(DISTINCT master_bridge_tag) FROM capadex_clarity_questions)                 AS bridges,
        (SELECT COUNT(*) FROM capadex_clarity_questions WHERE master_bridge_tag = 'UNMAPPED')     AS unmapped,
        (SELECT COUNT(*) FROM capadex_clarity_questions q
            WHERE EXISTS (SELECT 1 FROM capadex_concerns_master m
                          WHERE m.relational_bridge_tag = q.master_bridge_tag))                   AS joinable
    `);
    const s = stats.rows[0];
    const pct = (100 * Number(s.joinable) / Number(s.rows)).toFixed(1);
    console.log('─────────────────────────────────────');
    console.log(`  rows:              ${s.rows}`);
    console.log(`  unique concerns:   ${s.concerns}`);
    console.log(`  unique bridges:    ${s.bridges}`);
    console.log(`  UNMAPPED rows:     ${s.unmapped}`);
    console.log(`  rows joinable to master via bridge tag: ${s.joinable} (${pct}%)`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('✗ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
