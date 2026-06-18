/**
 * Parses CREATE TABLE statements from the migration source files and returns
 * a sorted, de-duplicated list of table names.
 *
 * This is used by the DB smoke test so the expected-tables list stays
 * automatically in sync whenever a new CREATE TABLE statement is added.
 *
 * Convention: migration files should use unquoted, snake_case identifiers and
 * prefer `CREATE TABLE IF NOT EXISTS <name>`.  Schema-qualified names (e.g.
 * `public.my_table`) and quoted identifiers (e.g. `"my-table"`) are not
 * extracted by this utility and should be avoided in migrations.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILES = [
  join(__dirname, 'migrate.ts'),
  join(__dirname, 'migrate-competency.ts'),
];

/**
 * Matches both:
 *   CREATE TABLE IF NOT EXISTS tablename
 *   CREATE TABLE tablename
 * Captures the first bare-word identifier that follows, ignoring quoted or
 * schema-qualified names (not used in this codebase).
 */
const CREATE_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;

/**
 * Returns the set of table names declared with CREATE TABLE (with or without
 * IF NOT EXISTS) across all migration files, plus 'schema_migrations' which
 * the migration runner always creates directly (not via the migrations array).
 */
export function extractMigrationTableNames(): string[] {
  const names = new Set<string>(['schema_migrations']);

  for (const filePath of MIGRATION_FILES) {
    const src = readFileSync(filePath, 'utf-8');
    let match: RegExpExecArray | null;
    CREATE_TABLE_RE.lastIndex = 0;
    while ((match = CREATE_TABLE_RE.exec(src)) !== null) {
      names.add(match[1]);
    }
  }

  return [...names].sort();
}
