#!/usr/bin/env tsx
/**
 * scripts/db-inventory.ts
 *
 * Queries the live database for all tables + row counts, then cross-references
 * against backend/shared/schema.ts, frontend/server/src/db/schema.ts, and
 * backend/migrations/*.sql. Outputs a CSV to stdout and a summary to stderr.
 *
 * Row counts: uses exact COUNT(*) per table (slower but accurate for audit).
 * pg_stat_user_tables.n_live_tup is only an autovacuum estimate and can be
 * stale — not suitable for audit artifacts.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/db-inventory.ts > inventory.csv
 *   # or, if DATABASE_URL is already in environment:
 *   npx tsx scripts/db-inventory.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

// ESM-safe __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

/** Strip single-line and block comments from TypeScript/SQL source before regex. */
function stripComments(src: string, lang: 'ts' | 'sql' = 'ts'): string {
  if (lang === 'sql') {
    return src.replace(/--[^\n]*/g, '');
  }
  let stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
  stripped = stripped.replace(/\/\/[^\n]*/g, '');
  return stripped;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // ── 1. Fetch all public table names ───────────────────────────────────────
  const { rows: tableNames } = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  // ── 2. Exact row count per table ──────────────────────────────────────────
  // Uses COUNT(*) for accuracy — n_live_tup is a stale autovacuum estimate.
  const liveSet = new Map<string, number>();
  for (const { table_name } of tableNames) {
    const { rows } = await client.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM "${table_name}"`
    );
    liveSet.set(table_name, parseInt(rows[0].cnt, 10));
  }

  await client.end();

  // ── 3. Extract table names from schema files (comments stripped) ───────────
  const WORKSPACE = join(__dirname, '..');

  function extractTablesFromDrizzle(filePath: string): Set<string> {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const src = stripComments(raw, 'ts');
      const matches = [...src.matchAll(/pgTable\(\s*["']([^"']+)["']/g)];
      return new Set(matches.map(m => m[1]));
    } catch {
      return new Set();
    }
  }

  function extractTablesFromSQL(dir: string): Set<string> {
    const tables = new Set<string>();
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.sql'));
      for (const file of files) {
        const raw = readFileSync(join(dir, file), 'utf8');
        const src = stripComments(raw, 'sql');
        const matches = [...src.matchAll(
          /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi
        )];
        for (const m of matches) tables.add(m[1].toLowerCase());
      }
    } catch { /* ignore */ }
    return tables;
  }

  const backendSchemaTables = extractTablesFromDrizzle(
    join(WORKSPACE, 'backend/shared/schema.ts')
  );
  const frontendSchemaTables = extractTablesFromDrizzle(
    join(WORKSPACE, 'frontend/server/src/db/schema.ts')
  );
  const migrationTables = extractTablesFromSQL(
    join(WORKSPACE, 'backend/migrations')
  );

  // ── 4. Build CSV output ────────────────────────────────────────────────────
  // row_count is exact (COUNT(*) per table, not pg_stat estimate).
  const CSV_HEADER =
    'table_name,row_count_exact,in_backend_schema,in_frontend_schema,in_migrations,status';
  const lines: string[] = [CSV_HEADER];

  const allTables = new Set<string>([
    ...liveSet.keys(),
    ...backendSchemaTables,
    ...frontendSchemaTables,
    ...migrationTables,
  ]);

  const DEPRECATED_TABLES = new Set(['lbi_questions_legacy']);

  for (const table of [...allTables].sort()) {
    const inLive = liveSet.has(table);
    const rowCount = inLive ? liveSet.get(table)! : -1;
    const inBackend = backendSchemaTables.has(table);
    const inFrontend = frontendSchemaTables.has(table);
    const inMigrations = migrationTables.has(table);

    let status: string;
    if (!inLive && DEPRECATED_TABLES.has(table)) {
      status = 'deprecated-dropped';
    } else if (!inLive) {
      status = 'schema-only';
    } else if (DEPRECATED_TABLES.has(table)) {
      status = rowCount === 0 ? 'deprecated-empty' : 'deprecated-has-data';
    } else if (!inBackend && !inFrontend && !inMigrations) {
      status = 'live-undocumented';
    } else {
      status = 'active';
    }

    lines.push(
      [
        table,
        inLive ? rowCount : 'N/A',
        inBackend ? 'YES' : 'NO',
        inFrontend ? 'YES' : 'NO',
        inMigrations ? 'YES' : 'NO',
        status,
      ].join(',')
    );
  }

  console.log(lines.join('\n'));

  // ── 5. Print summary to stderr ─────────────────────────────────────────────
  const liveCount = liveSet.size;
  const schemaOnlyCount = lines.filter(l => l.endsWith(',schema-only')).length;
  const undocumentedCount = lines.filter(l => l.endsWith(',live-undocumented')).length;
  const deprecatedCount = lines.filter(l => l.includes(',deprecated-')).length;

  console.error(`
┌─────────────────────────────────────────────┐
│            DB INVENTORY SUMMARY             │
├─────────────────────────────────────────────┤
│  Live tables total     : ${String(liveCount).padEnd(17)}│
│  In backend schema     : ${String(backendSchemaTables.size).padEnd(17)}│
│  In frontend schema    : ${String(frontendSchemaTables.size).padEnd(17)}│
│  In migrations         : ${String(migrationTables.size).padEnd(17)}│
│  Schema-only (no live) : ${String(schemaOnlyCount).padEnd(17)}│
│  Live undocumented     : ${String(undocumentedCount).padEnd(17)}│
│  Deprecated tables     : ${String(deprecatedCount).padEnd(17)}│
│                                             │
│  Row counts: exact COUNT(*), not estimates  │
└─────────────────────────────────────────────┘
`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
