/**
 * Password policy — unit test (offline / deterministic).
 *
 * Covers validatePasswordComplexity() only — the ALWAYS-enforced, network-free
 * layer. The HIBP breach check (checkPasswordBreached) is intentionally NOT
 * exercised here because it depends on a live external API; it is verified by
 * manual smoke test instead.
 *
 * Run with:  npx tsx backend/tests/password-policy.test.ts
 */

import assert from 'node:assert/strict';

import {
  validatePasswordComplexity,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '../lib/password-policy';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  \u2713 ${name}`);
};

console.log('password-policy: complexity rules');

check('accepts a strong, mixed-class password', () => {
  const r = validatePasswordComplexity('Zx9!qWv2_Lm7tR');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.errors.length, 0);
});

check('rejects a too-short password', () => {
  const r = validatePasswordComplexity('Ab1!xY');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(`${PASSWORD_MIN_LENGTH}`)));
});

check('rejects an over-long password', () => {
  const r = validatePasswordComplexity('Aa1!'.repeat(40)); // 160 chars
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(`${PASSWORD_MAX_LENGTH}`)));
});

check('requires lowercase', () => {
  const r = validatePasswordComplexity('ABC123!@#XYZ');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.toLowerCase().includes('lowercase')));
});

check('requires uppercase', () => {
  const r = validatePasswordComplexity('abc123!@#xyz');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.toLowerCase().includes('uppercase')));
});

check('requires a number', () => {
  const r = validatePasswordComplexity('AbcDef!@#xyz');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.toLowerCase().includes('number')));
});

check('requires a symbol', () => {
  const r = validatePasswordComplexity('AbcDef123xyz');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.toLowerCase().includes('symbol')));
});

check('rejects a common password even if long', () => {
  const r = validatePasswordComplexity('password123');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.toLowerCase().includes('common')));
});

check('rejects the legacy default admin credential', () => {
  const r = validatePasswordComplexity('admin123');
  assert.equal(r.ok, false);
});

check('rejects a password containing the username', () => {
  const r = validatePasswordComplexity('Jdoe!Secret9X', { identifier: 'jdoe' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.toLowerCase().includes('username') || e.toLowerCase().includes('email')));
});

check('rejects a password containing the email local-part', () => {
  const r = validatePasswordComplexity('Alice99!Strong', { identifier: 'alice@example.com' });
  assert.equal(r.ok, false);
});

check('does not flag a short identifier (<4 chars) as a substring', () => {
  const r = validatePasswordComplexity('Zx9!qWv2_Lm7tR', { identifier: 'al@example.com' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

check('handles non-string / empty input without throwing', () => {
  const r = validatePasswordComplexity('' as any);
  assert.equal(r.ok, false);
  const r2 = validatePasswordComplexity(undefined as any);
  assert.equal(r2.ok, false);
});

console.log(`\npassword-policy: ${passed} checks passed.`);
