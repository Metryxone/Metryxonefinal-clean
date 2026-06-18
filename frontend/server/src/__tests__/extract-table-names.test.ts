/**
 * Unit tests for the extractMigrationTableNames() utility.
 *
 * Verifies the regex correctly detects both CREATE TABLE variants and that
 * 'schema_migrations' is always included.
 *
 * Run: node --import tsx/esm --test src/__tests__/extract-table-names.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMigrationTableNames } from '../db/extract-table-names.js';

test('extractMigrationTableNames returns a non-empty sorted array', () => {
  const tables = extractMigrationTableNames();
  assert.ok(tables.length > 0, 'should return at least one table');
  const sorted = [...tables].sort();
  assert.deepStrictEqual(tables, sorted, 'result should be sorted');
});

test('schema_migrations is always included', () => {
  const tables = extractMigrationTableNames();
  assert.ok(tables.includes('schema_migrations'), 'schema_migrations must be present');
});

test('well-known tables from migrate.ts are present', () => {
  const tables = new Set(extractMigrationTableNames());
  const expected = [
    'users',
    'otp_tokens',
    'children',
    'notifications',
    'mentor_profiles',
    'institutions',
    'student_enrollments',
  ];
  for (const t of expected) {
    assert.ok(tables.has(t), `expected table '${t}' to be in the extracted list`);
  }
});

test('well-known tables from migrate-competency.ts are present', () => {
  const tables = new Set(extractMigrationTableNames());
  const expected = [
    'competency_domains',
    'competencies',
    'career_profiles',
    'competency_scores',
    'role_weights',
    'competency_benchmarks',
    'competency_interventions',
    'job_requirements',
  ];
  for (const t of expected) {
    assert.ok(tables.has(t), `expected table '${t}' to be in the extracted list`);
  }
});

test('result contains no duplicates', () => {
  const tables = extractMigrationTableNames();
  const unique = new Set(tables);
  assert.strictEqual(tables.length, unique.size, 'result should have no duplicates');
});
