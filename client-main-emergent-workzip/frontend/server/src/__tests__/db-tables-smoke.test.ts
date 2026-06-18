/**
 * Startup smoke test: calls runStartupMigrations() — the same function used
 * by server/src/index.ts at boot — then asserts every expected DB table exists.
 *
 * Catches regressions where a CREATE TABLE statement is dropped from a
 * migration or where runStartupMigrations() itself is broken.
 *
 * The expected table list is derived automatically from the migration source
 * files (server/src/db/migrate.ts and server/src/db/migrate-competency.ts)
 * so it stays in sync whenever a new CREATE TABLE statement is added.
 *
 * Run: node --import tsx/esm --test src/__tests__/db-tables-smoke.test.ts
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../db/client.js';
import { runStartupMigrations } from '../db/startup-migrations.js';
import { extractMigrationTableNames } from '../db/extract-table-names.js';

after(async () => {
  await pool.end();
});

const REQUIRED_TABLES: string[] = extractMigrationTableNames();

test('runStartupMigrations() creates all required tables', async () => {
  await runStartupMigrations();

  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'`,
  );

  const existing = new Set(result.rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));

  assert.deepStrictEqual(
    missing,
    [],
    `Tables missing after migrations:\n  ${missing.join('\n  ')}\n\n` +
      `Present: ${[...existing].sort().join(', ')}`,
  );
});
