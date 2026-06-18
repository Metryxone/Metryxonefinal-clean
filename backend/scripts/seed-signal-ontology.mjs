#!/usr/bin/env node
/**
 * seed-signal-ontology.mjs — 4-tier Behavioural Signal Ontology seeder.
 *
 * Reads the 4 audited_*.csv files at repo root, applies lazy DDL from
 * 20260528_signal_ontology_tables.sql, TRUNCATEs the 4 tables in FK-safe
 * order, and bulk-inserts in 500-row chunks inside one BEGIN/COMMIT.
 *
 * Idempotent — re-running TRUNCATEs and re-loads cleanly.
 *
 * Usage: node backend/scripts/seed-signal-ontology.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { parse } from 'csv-parse/sync';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');
const MIG_FILE   = join(REPO_ROOT, 'backend', 'migrations', '20260528_signal_ontology_tables.sql');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not set');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Column maps (target_col → source_col_in_csv) ───────────────────────────
const DOMAIN_COLS = [
  'domain_id', 'domain_name', 'domain_purpose', 'primary_focus',
  'key_behavioral_scope', 'example_signal_families', 'core_risk_areas',
  'intervention_orientation', 'longitudinal_importance',
  'adaptive_runtime_importance', 'relational_bridge_tag',
];
const FAMILY_COLS = [
  'family_id', 'domain_id', 'Domain', 'family_name',
  'family_purpose', 'key_behavioral_scope', 'relational_bridge_tag',
];
const FAMILY_DB_COLS = [
  'family_id', 'domain_id', 'domain', 'family_name',
  'family_purpose', 'key_behavioral_scope', 'relational_bridge_tag',
];
const SIGNAL_COLS = [
  'signal_id', 'signal_name', 'domain', 'signal_family', 'category',
  'detection_type', 'source_types', 'severity_weight', 'confidence_weight',
  'persistence_weight', 'volatility', 'adaptive_importance',
  'intervention_priority', 'behavioral_meaning', 'hidden_pattern_contribution',
  'amplification_rules', 'contradiction_links', 'related_signals',
  'recovery_indicator', 'longitudinal_impact', 'risk_mapping',
  'relational_bridge_tag',
];
const ATOMIC_COLS = [
  'atomic_signal_id', 'family_id', 'domain_id', 'domain_name', 'family_name',
  'atomic_signal_name', 'signal_label', 'signal_definition', 'signal_category',
  'detection_type', 'primary_behavioral_scope', 'secondary_behavioral_scope',
  'severity_weight', 'confidence_weight', 'persistence_weight', 'volatility',
  'adaptive_importance', 'intervention_priority', 'emotional_sensitivity',
  'cognitive_load_impact', 'longitudinal_importance', 'recovery_indicator',
  'hidden_pattern_contribution', 'amplification_rules', 'suppression_rules',
  'contradiction_links', 'related_signals', 'progression_risk', 'regression_risk',
  'risk_mapping', 'intervention_mapping', 'telemetry_sources', 'question_sources',
  'runtime_visibility', 'explainability_level', 'persona_sensitivity',
  'cultural_context_fit', 'execution_relevance', 'employability_relevance',
  'learning_relevance', 'behavioral_examples', 'signal_status',
  'age_min', 'age_max', 'relational_bridge_tag',
];

// Columns that should arrive as numeric (REAL); blanks → null
const NUMERIC_COLS = new Set([
  'severity_weight', 'confidence_weight', 'persistence_weight',
  'age_min', 'age_max',
]);

function loadCsv(path) {
  if (!existsSync(path)) {
    console.error(`FATAL: missing ${path} — run scripts/import_signal_ontology.py first.`);
    process.exit(1);
  }
  return parse(readFileSync(path, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });
}

function coerce(value, col) {
  if (value === undefined || value === null || value === '') {
    return NUMERIC_COLS.has(col) ? null : '';
  }
  if (NUMERIC_COLS.has(col)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

async function chunkedInsert(client, table, dbCols, csvCols, rows, chunkSize = 500) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const values = [];
    const placeholders = [];
    slice.forEach((row, ri) => {
      const start = ri * dbCols.length;
      placeholders.push(
        `(${dbCols.map((_, ci) => `$${start + ci + 1}`).join(',')})`
      );
      dbCols.forEach((db, ci) => {
        const srcCol = csvCols[ci];
        values.push(coerce(row[srcCol], db));
      });
    });
    const sql = `INSERT INTO ${table} (${dbCols.join(',')}) VALUES ${placeholders.join(',')}`;
    await client.query(sql, values);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    // Lazy DDL
    console.log('→ applying migration DDL');
    await client.query(readFileSync(MIG_FILE, 'utf-8'));

    // Load CSVs
    const domains  = loadCsv(join(REPO_ROOT, 'audited_domains.csv'));
    const families = loadCsv(join(REPO_ROOT, 'audited_families.csv'));
    const signals  = loadCsv(join(REPO_ROOT, 'audited_signals.csv'));
    const atomic   = loadCsv(join(REPO_ROOT, 'audited_atomic_signals.csv'));
    console.log(`→ loaded csv: ${domains.length} domains, ${families.length} families, ${signals.length} signals, ${atomic.length} atomic`);

    await client.query('BEGIN');
    try {
      // FK-safe order: truncate leaves first
      await client.query('TRUNCATE capadex_atomic_signals, capadex_signals, capadex_families, capadex_domains RESTART IDENTITY CASCADE');

      await chunkedInsert(client, 'capadex_domains',        DOMAIN_COLS,    DOMAIN_COLS, domains);
      console.log(`  ✓ inserted ${domains.length} domains`);
      await chunkedInsert(client, 'capadex_families',       FAMILY_DB_COLS, FAMILY_COLS, families);
      console.log(`  ✓ inserted ${families.length} families`);
      await chunkedInsert(client, 'capadex_signals',        SIGNAL_COLS,    SIGNAL_COLS, signals);
      console.log(`  ✓ inserted ${signals.length} signals`);
      await chunkedInsert(client, 'capadex_atomic_signals', ATOMIC_COLS,    ATOMIC_COLS, atomic);
      console.log(`  ✓ inserted ${atomic.length} atomic signals`);

      // Promote NOT VALID FKs to validated — guarantees every future insert
      // has a real parent. Audit pipeline ensures all rows already qualify.
      await client.query('ALTER TABLE capadex_families       VALIDATE CONSTRAINT fk_capadex_families_domain');
      await client.query('ALTER TABLE capadex_atomic_signals VALIDATE CONSTRAINT fk_capadex_atomic_family');
      await client.query('ALTER TABLE capadex_atomic_signals VALIDATE CONSTRAINT fk_capadex_atomic_domain');
      console.log('  ✓ validated 3 FK constraints');

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Stats
    const { rows: stats } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM capadex_domains)         AS domains,
        (SELECT COUNT(*) FROM capadex_families)        AS families,
        (SELECT COUNT(*) FROM capadex_signals)         AS signals,
        (SELECT COUNT(*) FROM capadex_atomic_signals)  AS atomic,
        (SELECT COUNT(DISTINCT relational_bridge_tag) FROM capadex_atomic_signals) AS atomic_buckets,
        (SELECT COUNT(*) FROM capadex_atomic_signals WHERE relational_bridge_tag = 'GENERAL_CONCERN') AS atomic_general
    `);
    const s = stats[0];
    console.log('\n========= SEED COMPLETE =========');
    console.log(`domains          : ${s.domains}`);
    console.log(`families         : ${s.families}`);
    console.log(`signals          : ${s.signals}`);
    console.log(`atomic signals   : ${s.atomic}`);
    console.log(`atomic buckets   : ${s.atomic_buckets}`);
    console.log(`general_concern  : ${s.atomic_general} (${(s.atomic_general/s.atomic*100).toFixed(1)}%)`);
    console.log('=================================');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('FATAL seed error:', err);
  process.exit(1);
});
