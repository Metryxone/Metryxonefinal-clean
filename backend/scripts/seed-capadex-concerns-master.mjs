/**
 * seed-capadex-concerns-master.mjs
 *
 * Idempotent loader for the audited CAPADEX concerns catalogue.
 * - Applies lazy DDL (CREATE TABLE IF NOT EXISTS) so it self-bootstraps
 *   regardless of whether the canonical migration has run.
 * - Reads `audited_capadex_concerns.csv` produced by
 *   `scripts/audit_capadex_concerns.py`.
 * - TRUNCATEs + bulk-inserts (chunked) for deterministic re-runs.
 *
 * Run:
 *   node backend/scripts/seed-capadex-concerns-master.mjs
 *   node backend/scripts/seed-capadex-concerns-master.mjs ./audited_capadex_concerns.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

const { Pool } = pg;
const CSV_PATH = process.argv[2] || path.resolve('audited_capadex_concerns.csv');
const CHUNK = 100;

const DDL = `
CREATE TABLE IF NOT EXISTS capadex_concerns_master (
  id                       SERIAL PRIMARY KEY,
  concern_id               TEXT NOT NULL,
  domain                   TEXT NOT NULL,
  concern_cluster          TEXT NOT NULL,
  relevance_in_india       TEXT,
  parent_anxiety_level     TEXT,
  growth_trend             TEXT,
  severity                 TEXT,
  capadex_priority         TEXT,
  common_indian_context    TEXT,
  primary_persona          TEXT,
  contextual_modifier      TEXT,
  concern_category         TEXT,
  intelligence_layer       TEXT,
  signal_cluster           TEXT,
  assessment_dimension     TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  root_cause_group         TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  intervention_lens        TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  capability_mapping       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  relational_bridge_tag    TEXT NOT NULL,
  age_min                  INTEGER,
  age_max                  INTEGER,
  source_row_index         INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_concern_id_idx ON capadex_concerns_master(concern_id);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_domain_idx     ON capadex_concerns_master(domain);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_bridge_idx     ON capadex_concerns_master(relational_bridge_tag);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_persona_idx    ON capadex_concerns_master(primary_persona);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_age_idx        ON capadex_concerns_master(age_min, age_max);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_severity_idx   ON capadex_concerns_master(severity);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_priority_idx   ON capadex_concerns_master(capadex_priority);
`;

const COL_ORDER = [
  'concern_id', 'domain', 'concern_cluster', 'relevance_in_india',
  'parent_anxiety_level', 'growth_trend', 'severity', 'capadex_priority',
  'common_indian_context', 'primary_persona', 'contextual_modifier',
  'concern_category', 'intelligence_layer', 'signal_cluster',
  'assessment_dimension', 'root_cause_group', 'intervention_lens',
  'capability_mapping', 'relational_bridge_tag', 'age_min', 'age_max',
  'source_row_index',
];

// CSV header (from audit script) → DB column name.
const HEADER_MAP = {
  'Concern ID':            'concern_id',
  'Domain':                'domain',
  'Concern Cluster':       'concern_cluster',
  'Relevance in India':    'relevance_in_india',
  'Parent Anxiety Level':  'parent_anxiety_level',
  'Growth Trend':          'growth_trend',
  'Severity':              'severity',
  'CAPADEX Priority':      'capadex_priority',
  'Common Indian Context': 'common_indian_context',
  'Primary Persona':       'primary_persona',
  'Contextual Modifier':   'contextual_modifier',
  'Concern Category':      'concern_category',
  'Intelligence Layer':    'intelligence_layer',
  'Signal Cluster':        'signal_cluster',
  'Assessment Dimension':  'assessment_dimension',
  'Root Cause Group':      'root_cause_group',
  'Intervention Lens':     'intervention_lens',
  'Capability Mapping':    'capability_mapping',
  'Relational_Bridge_Tag': 'relational_bridge_tag',
  'age_min':               'age_min',
  'age_max':               'age_max',
};

const ROUTING_FALLBACK = 'UNASSIGNED_ROUTING_NODE';
const ROUTING = new Set(['assessment_dimension', 'root_cause_group', 'intervention_lens', 'capability_mapping']);

function normaliseRow(raw, idx) {
  const out = { source_row_index: idx + 1 };
  for (const [csvCol, dbCol] of Object.entries(HEADER_MAP)) {
    let v = raw[csvCol];
    if (v === undefined || v === null) v = '';
    v = String(v).trim();
    if (dbCol === 'age_min' || dbCol === 'age_max') {
      out[dbCol] = v === '' || v.toLowerCase() === 'nan' ? null : Number.parseInt(v, 10);
      if (Number.isNaN(out[dbCol])) out[dbCol] = null;
    } else if (ROUTING.has(dbCol)) {
      out[dbCol] = v === '' ? ROUTING_FALLBACK : v;
    } else {
      out[dbCol] = v === '' ? null : v;
    }
  }
  for (const required of ['concern_id', 'domain', 'concern_cluster', 'relational_bridge_tag']) {
    if (!out[required]) out[required] = required === 'concern_id'
      ? `CONCERN_UNKNOWN_${idx + 1}`
      : 'UNCLASSIFIED';
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL not set');
    process.exit(2);
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`✗ Audited CSV not found: ${CSV_PATH}`);
    console.error('  Run `python3 scripts/audit_capadex_concerns.py` first.');
    process.exit(2);
  }

  console.log(`▸ Reading ${CSV_PATH} ...`);
  const text = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: false });
  console.log(`  ✓ Parsed ${records.length} rows`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log('▸ Applying lazy DDL ...');
    await client.query(DDL);

    console.log('▸ BEGIN transaction (TRUNCATE + bulk insert atomic) ...');
    await client.query('BEGIN');
    let inserted = 0;
    try {
      await client.query('TRUNCATE TABLE capadex_concerns_master RESTART IDENTITY');
      console.log(`▸ Bulk inserting (chunks of ${CHUNK}) ...`);
      for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK).map((r, k) => normaliseRow(r, i + k));
        const values = [];
        const placeholders = chunk.map((row, ri) => {
          const base = ri * COL_ORDER.length;
          const slots = COL_ORDER.map((_, ci) => `$${base + ci + 1}`);
          for (const col of COL_ORDER) values.push(row[col] ?? null);
          return `(${slots.join(',')})`;
        });
        const sql = `INSERT INTO capadex_concerns_master (${COL_ORDER.join(',')}) VALUES ${placeholders.join(',')}`;
        await client.query(sql, values);
        inserted += chunk.length;
        if (inserted % 500 === 0 || inserted === records.length) {
          process.stdout.write(`  · inserted ${inserted}/${records.length}\r`);
        }
      }
      await client.query('COMMIT');
      console.log(`\n  ✓ COMMIT — inserted ${inserted} rows atomically`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`\n  ✗ ROLLBACK — insert failed after ${inserted} rows; table left in pre-seed state`);
      throw err;
    }

    const stats = await client.query(`
      SELECT
        COUNT(*)::int                                                    AS total,
        COUNT(DISTINCT concern_id)::int                                  AS distinct_ids,
        COUNT(DISTINCT domain)::int                                      AS distinct_domains,
        COUNT(DISTINCT relational_bridge_tag)::int                       AS distinct_bridges,
        COUNT(*) FILTER (WHERE age_min IS NULL)::int                     AS missing_age,
        COUNT(*) FILTER (WHERE assessment_dimension = 'UNASSIGNED_ROUTING_NODE')::int AS unassigned_dim,
        COUNT(*) FILTER (WHERE
             assessment_dimension = 'UNASSIGNED_ROUTING_NODE'
          OR root_cause_group     = 'UNASSIGNED_ROUTING_NODE'
          OR intervention_lens    = 'UNASSIGNED_ROUTING_NODE'
          OR capability_mapping   = 'UNASSIGNED_ROUTING_NODE'
        )::int AS unassigned_any_routing
      FROM capadex_concerns_master
    `);
    console.log('\n══ POST-SEED STATS ══');
    console.table(stats.rows);
    console.log('✓ Seed complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
