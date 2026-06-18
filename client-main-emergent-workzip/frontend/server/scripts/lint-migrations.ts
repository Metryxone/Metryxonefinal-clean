/**
 * lint-migrations.ts
 *
 * Lightweight, DB-free lint check for migration files.
 *
 * Reads migrate.ts and migrate-competency.ts, extracts every CREATE TABLE
 * identifier using the same regex as extract-table-names.ts, then fails fast
 * if any name:
 *   - is not valid lowercase snake_case (a-z, 0-9, underscore; must start
 *     with a letter), or
 *   - is followed by a non-SQL-delimiter character suggesting the identifier
 *     was split (e.g. CREATE TABLE foo-bar would capture "foo" but the "-"
 *     after it betrays a malformed name), or
 *   - appears more than once across all migration files (duplicate), or
 *   - is missing the IF NOT EXISTS guard (a bare CREATE TABLE will crash the
 *     migration runner if it runs twice after a partial rollout or hot restart).
 *
 * Exit codes:
 *   0 — all table names are valid and unique
 *   1 — one or more violations were found
 *
 * Usage (no database required):
 *   npm run lint:migrations
 *   node --import tsx/esm scripts/lint-migrations.ts
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILES = [
  join(__dirname, '../src/db/migrate.ts'),
  join(__dirname, '../src/db/migrate-competency.ts'),
];

/**
 * Same pattern as extract-table-names.ts, but extended to:
 *   - capture group 1: the optional "IF NOT EXISTS " clause
 *   - capture group 2: the table identifier
 *   - capture group 3: the single character immediately following the identifier
 *
 * If the character after the name is not a valid SQL delimiter we know the
 * name was split.  If group 1 is absent the IF NOT EXISTS guard is missing.
 *
 * Valid SQL delimiters after a table name: whitespace, '(', end-of-string.
 */
const CREATE_TABLE_RE =
  /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)([^\s(]?)/gi;

const VALID_SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

interface TableOccurrence {
  file: string;
  name: string;
  trailingChar: string;
  hasIfNotExists: boolean;
  lineNumber: number;
  lineText: string;
}

function lint(): void {
  const occurrences: TableOccurrence[] = [];
  let hasErrors = false;

  for (const filePath of MIGRATION_FILES) {
    let src: string;
    try {
      src = readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`[lint-migrations] Cannot read file: ${filePath}`);
      console.error((err as Error).message);
      process.exit(1);
    }

    const srcLines = src.split('\n');

    CREATE_TABLE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CREATE_TABLE_RE.exec(src)) !== null) {
      const lineNumber = src.slice(0, match.index).split('\n').length;
      occurrences.push({
        file: filePath,
        name: match[2],
        trailingChar: match[3] ?? '',
        hasIfNotExists: match[1] !== undefined,
        lineNumber,
        lineText: (srcLines[lineNumber - 1] ?? '').trim(),
      });
    }
  }

  const seen = new Map<string, string>();

  for (const { file, name, trailingChar, hasIfNotExists, lineNumber, lineText } of occurrences) {
    const shortFile = file.replace(process.cwd(), '.');
    const location = `${shortFile}:${lineNumber}`;

    if (!VALID_SNAKE_CASE_RE.test(name)) {
      console.error(
        `[lint-migrations] MALFORMED table name "${name}" in ${location} — ` +
          'names must be lowercase snake_case (a-z, 0-9, underscore, starting with a letter).',
      );
      hasErrors = true;
    } else if (trailingChar !== '') {
      console.error(
        `[lint-migrations] MALFORMED table name "${name}${trailingChar}..." in ${location} — ` +
          `unexpected character "${trailingChar}" immediately after identifier; ` +
          'table names must be unquoted, schema-unqualified snake_case.',
      );
      hasErrors = true;
    }

    if (!hasIfNotExists) {
      console.error(
        `[lint-migrations] MISSING IF NOT EXISTS on CREATE TABLE "${name}" in ${location} — ` +
          'all CREATE TABLE statements must use IF NOT EXISTS to be safe against re-runs.\n' +
          `  ↳ ${lineText}`,
      );
      hasErrors = true;
    }

    if (seen.has(name)) {
      console.error(
        `[lint-migrations] DUPLICATE table name "${name}" in ${location} — ` +
          `already declared in ${seen.get(name)!.replace(process.cwd(), '.')}.`,
      );
      hasErrors = true;
    } else {
      seen.set(name, file);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(
    `[lint-migrations] OK — ${seen.size} table(s) checked across ${MIGRATION_FILES.length} file(s).`,
  );
}

lint();
