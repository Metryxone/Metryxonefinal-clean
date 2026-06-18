/**
 * O*NET unrated-role competency derivation — unit tests
 *
 * Run with:  npx tsx backend/tests/onet-derive-competency.test.ts
 *
 * Covers the derive step that gives O*NET-unrated occupations a competency set by
 * inheriting from their closest rated SOC relatives:
 *   - SOC helpers: socBaseFromCode / socPrefixTiers (tightest→loosest tier walk).
 *   - modal proficiency band selection; oneBandBelow min-proficiency floor.
 *   - deriveUnratedRoleCompetencies end-to-end against an in-memory pool:
 *       · tightest-tier selection (detailed .01/.02 siblings before broad/minor/major)
 *       · majority adoption (freq ≥ 0.5)
 *       · min top-up (8) when the majority set is thin
 *       · max cap (25) when relatives expose a huge competency surface
 *       · modal target band + core/secondary tier threshold (weight*3.5 ≥ 3.75)
 *       · rows stamped source='onet_derived'
 *       · idempotent re-run (UPSERT in place, no duplicates)
 *       · stale-row cleanup when a role gains native 'onet' ratings
 *
 * Pure + in-memory — requires NO live DATABASE_URL and no O*NET download.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {
  deriveUnratedRoleCompetencies,
  socBaseFromCode,
  socPrefixTiers,
  modal,
  oneBandBelow,
  DERIVED_SOURCE,
  DERIVE_MIN_COMPETENCIES,
  DERIVE_MAX_COMPETENCIES,
} from '../services/onet-import';

// ── In-memory fixtures + fake pool ──────────────────────────────────────────

interface RoleRow { id: number; code: string }
interface CompRow {
  role_id: number;
  competency_id: number;
  importance_tier: string;
  weight: number;
  min_proficiency: string | null;
  target_proficiency: string | null;
  source: string;
}

/**
 * A fake pg Pool that emulates exactly the four statements
 * deriveUnratedRoleCompetencies issues:
 *   1. DELETE stale derived rows for roles that gained native 'onet' rows.
 *   2. SELECT id, code FROM ont_roles WHERE code LIKE 'ONET_%'.
 *   3. SELECT ... FROM map_role_competency WHERE source = 'onet'.
 *   4. INSERT ... ON CONFLICT (role_id, competency_id) DO UPDATE (UPSERT).
 * The link table is a Map keyed by `${role_id}|${competency_id}`.
 */
function makeFakePool(roles: RoleRow[], links: Map<string, CompRow>) {
  const key = (roleId: number, compId: number) => `${roleId}|${compId}`;

  const answer = (sqlRaw: string, params?: unknown[]): { rows: unknown[]; rowCount: number } => {
    const sql = sqlRaw.toLowerCase();

    // 1. DELETE stale derived rows for roles that now have a native 'onet' row.
    if (/^\s*delete\s+from\s+map_role_competency/.test(sql)) {
      const derivedSource = (params?.[0] as string) ?? DERIVED_SOURCE;
      const nativeRoleIds = new Set(
        [...links.values()].filter(r => r.source === 'onet').map(r => r.role_id),
      );
      let removed = 0;
      for (const [k, r] of links) {
        if (r.source === derivedSource && nativeRoleIds.has(r.role_id)) {
          links.delete(k);
          removed++;
        }
      }
      return { rows: [], rowCount: removed };
    }

    // 2. All O*NET roles.
    if (/from\s+ont_roles/.test(sql)) {
      return { rows: roles.map(r => ({ id: r.id, code: r.code })), rowCount: roles.length };
    }

    // 3. Native O*NET links only.
    if (/from\s+map_role_competency/.test(sql)) {
      const rows = [...links.values()]
        .filter(r => r.source === 'onet')
        .map(r => ({
          role_id: r.role_id,
          competency_id: r.competency_id,
          weight: r.weight,
          target_proficiency: r.target_proficiency,
        }));
      return { rows, rowCount: rows.length };
    }

    // 4. UPSERT derived rows (7 columns per row, in fixed order).
    if (/^\s*insert\s+into\s+map_role_competency/.test(sql)) {
      const vals = params ?? [];
      for (let i = 0; i < vals.length; i += 7) {
        const r: CompRow = {
          role_id: vals[i] as number,
          competency_id: vals[i + 1] as number,
          importance_tier: vals[i + 2] as string,
          weight: vals[i + 3] as number,
          min_proficiency: vals[i + 4] as string | null,
          target_proficiency: vals[i + 5] as string | null,
          source: vals[i + 6] as string,
        };
        links.set(key(r.role_id, r.competency_id), r); // ON CONFLICT DO UPDATE
      }
      return { rows: [], rowCount: vals.length / 7 };
    }

    return { rows: [], rowCount: 0 };
  };

  const query = (sql: unknown, params?: unknown) => {
    const text = typeof sql === 'string' ? sql : (sql as { text?: string })?.text ?? '';
    return Promise.resolve(answer(text, params as unknown[] | undefined));
  };

  return { query, connect: () => Promise.resolve({ query, release: () => undefined }), end: () => Promise.resolve() } as unknown as Pool;
}

/** Native 'onet' link convenience builder. */
function native(roleId: number, compId: number, weight: number, band: string | null): CompRow {
  return {
    role_id: roleId, competency_id: compId, importance_tier: 'core',
    weight, min_proficiency: null, target_proficiency: band, source: 'onet',
  };
}

function derivedRowsFor(links: Map<string, CompRow>, roleId: number): CompRow[] {
  return [...links.values()].filter(r => r.role_id === roleId && r.source === DERIVED_SOURCE);
}

// ── 1. SOC helpers ───────────────────────────────────────────────────────────

test('socBaseFromCode strips ONET_ prefix and .NN suffix', () => {
  assert.equal(socBaseFromCode('ONET_15-1252.00'), '15-1252');
  assert.equal(socBaseFromCode('ONET_15-1252.01'), '15-1252');
  assert.equal(socBaseFromCode('ONET_29-1141.00'), '29-1141');
});

test('socBaseFromCode rejects non-ONET / too-short codes', () => {
  assert.equal(socBaseFromCode('ROLE_FOO'), null);
  assert.equal(socBaseFromCode('ONET_1'), null); // base length < 2
});

test('socPrefixTiers walks tightest → loosest and dedupes', () => {
  assert.deepEqual(socPrefixTiers('15-1252'), ['15-1252', '15-125', '15-1', '15']);
});

// ── 2. modal + oneBandBelow ──────────────────────────────────────────────────

test('modal returns the most frequent value, null on empty', () => {
  assert.equal(modal(['proficient', 'proficient', 'advanced']), 'proficient');
  assert.equal(modal<string>([]), null);
});

test('oneBandBelow drops one proficiency band, floored at novice', () => {
  assert.equal(oneBandBelow('advanced'), 'proficient');
  assert.equal(oneBandBelow('proficient'), 'developing');
  assert.equal(oneBandBelow('novice'), 'novice');
  assert.equal(oneBandBelow('unknown'), 'novice'); // not found → floor
});

// ── 3. Tightest-tier selection ───────────────────────────────────────────────

test('derive prefers detailed .01/.02 siblings over broader SOC relatives', async () => {
  // Unrated role 15-1252.00; a detailed sibling .01 is rated with one distinctive
  // competency set, while a broad-group cousin (15-1253) has a different set.
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' }, // unrated target
    { id: 2, code: 'ONET_15-1252.01' }, // detailed sibling (rated)
    { id: 3, code: 'ONET_15-1253.00' }, // broad-group cousin (rated, different comps)
  ];
  const links = new Map<string, CompRow>();
  // Sibling competencies 100..107 (8 of them, all proficient).
  for (let c = 100; c < 108; c++) links.set(`2|${c}`, native(2, c, 1.2, 'proficient'));
  // Cousin competencies 200..207.
  for (let c = 200; c < 208; c++) links.set(`3|${c}`, native(3, c, 1.0, 'developing'));

  const pool = makeFakePool(roles, links);
  const res = await deriveUnratedRoleCompetencies(pool);

  assert.equal(res.rolesUnrated, 1);
  assert.equal(res.rolesDerived, 1);

  const derived = derivedRowsFor(links, 1).map(r => r.competency_id).sort((a, b) => a - b);
  // Must inherit ONLY from the detailed sibling (100..107), not the cousin (200..).
  assert.deepEqual(derived, [100, 101, 102, 103, 104, 105, 106, 107]);
});

test('derive falls through to broad/minor/major when no detailed sibling exists', async () => {
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1299.00' }, // unrated; no .NN sibling, no 15-129 broad peer
    { id: 2, code: 'ONET_15-2031.00' }, // only relative shares the 15 major group
  ];
  const links = new Map<string, CompRow>();
  for (let c = 300; c < 308; c++) links.set(`2|${c}`, native(2, c, 1.0, 'proficient'));

  const pool = makeFakePool(roles, links);
  const res = await deriveUnratedRoleCompetencies(pool);

  assert.equal(res.rolesDerived, 1);
  const derived = derivedRowsFor(links, 1).map(r => r.competency_id).sort((a, b) => a - b);
  assert.deepEqual(derived, [300, 301, 302, 303, 304, 305, 306, 307]);
});

test('derive leaves an honest gap when a role has no rated relative anywhere', async () => {
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_99-1111.00' }, // lonely major group, no relatives
  ];
  const links = new Map<string, CompRow>();
  const pool = makeFakePool(roles, links);
  const res = await deriveUnratedRoleCompetencies(pool);

  assert.equal(res.rolesUnrated, 1);
  assert.equal(res.rolesDerived, 0);
  assert.equal(res.linksDerived, 0);
  assert.equal(derivedRowsFor(links, 1).length, 0);
});

// ── 4. Majority adoption + min top-up ────────────────────────────────────────

test('majority adoption keeps comps in ≥half the relatives; min top-up fills to 8', async () => {
  // Two rated detailed siblings. Comps 1..3 appear in BOTH (freq 1.0, majority).
  // Comps 10..14 appear in only ONE (freq 0.5 — still ≥ majority 0.5).
  // We arrange exactly so the majority set is small, forcing the min top-up to 8.
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' }, // unrated
    { id: 2, code: 'ONET_15-1252.01' }, // rated sibling A
    { id: 3, code: 'ONET_15-1252.02' }, // rated sibling B
  ];
  const links = new Map<string, CompRow>();
  // Shared majority comps (freq 1.0).
  for (const c of [1, 2, 3]) {
    links.set(`2|${c}`, native(2, c, 1.0, 'proficient'));
    links.set(`3|${c}`, native(3, c, 1.0, 'proficient'));
  }
  // Sibling-A-only comps (freq 0.5 each).
  for (const c of [10, 11, 12]) links.set(`2|${c}`, native(2, c, 0.9, 'developing'));
  // Sibling-B-only comps (freq 0.5 each).
  for (const c of [20, 21, 22]) links.set(`3|${c}`, native(3, c, 0.9, 'developing'));

  const pool = makeFakePool(roles, links);
  const res = await deriveUnratedRoleCompetencies(pool);

  const derived = derivedRowsFor(links, 1);
  // 3 shared + 6 half = 9 candidates all at freq ≥ 0.5, so majority set = 9 (> min 8).
  assert.equal(derived.length, 9);
  assert.equal(res.linksDerived, 9);
});

test('min top-up adopts the top-8 by frequency even when few clear the majority bar', async () => {
  // Three rated siblings. ONE comp is shared by all (freq 1.0 → majority).
  // Ten further comps are each held by a single sibling (freq 0.33 < 0.5).
  // Majority set = 1 < min 8, so the engine tops up to the 8 highest-frequency comps.
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' }, // unrated
    { id: 2, code: 'ONET_15-1252.01' },
    { id: 3, code: 'ONET_15-1252.02' },
    { id: 4, code: 'ONET_15-1252.03' },
  ];
  const links = new Map<string, CompRow>();
  const shared = 1;
  for (const rid of [2, 3, 4]) links.set(`${rid}|${shared}`, native(rid, shared, 1.2, 'advanced'));
  // 12 single-sibling comps spread across the three siblings.
  let cid = 50;
  for (const rid of [2, 3, 4]) {
    for (let k = 0; k < 4; k++) links.set(`${rid}|${cid}`, native(rid, cid++, 0.8, 'developing'));
  }

  const pool = makeFakePool(roles, links);
  const res = await deriveUnratedRoleCompetencies(pool);

  const derived = derivedRowsFor(links, 1);
  assert.equal(derived.length, DERIVE_MIN_COMPETENCIES); // topped up to exactly 8
  assert.equal(res.linksDerived, DERIVE_MIN_COMPETENCIES);
  // The unanimous comp must always be present.
  assert.ok(derived.some(r => r.competency_id === shared));
});

// ── 5. Max cap ───────────────────────────────────────────────────────────────

test('max cap limits a relative with a huge competency surface to 25 links', async () => {
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' }, // unrated
    { id: 2, code: 'ONET_15-1252.01' }, // rated sibling with 40 comps
  ];
  const links = new Map<string, CompRow>();
  for (let c = 0; c < 40; c++) links.set(`2|${c}`, native(2, c, 1.0, 'proficient'));

  const pool = makeFakePool(roles, links);
  const res = await deriveUnratedRoleCompetencies(pool);

  const derived = derivedRowsFor(links, 1);
  assert.equal(derived.length, DERIVE_MAX_COMPETENCIES); // capped at 25
  assert.equal(res.linksDerived, DERIVE_MAX_COMPETENCIES);
});

// ── 6. Modal band + core/secondary tier + source stamp ───────────────────────

test('derived rows carry modal band, one-below min, tier threshold, and onet_derived stamp', async () => {
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' }, // unrated
    { id: 2, code: 'ONET_15-1252.01' }, // rated sibling A
    { id: 3, code: 'ONET_15-1252.02' }, // rated sibling B
  ];
  const links = new Map<string, CompRow>();
  // Competency 1: high weight (core: 1.1*3.5 = 3.85 ≥ 3.75); modal band = advanced.
  links.set('2|1', native(2, 1, 1.1, 'advanced'));
  links.set('3|1', native(3, 1, 1.1, 'proficient')); // bands [advanced, proficient] → modal=advanced (first by insertion on tie)
  // Competency 2: low weight (secondary: 0.8*3.5 = 2.8 < 3.75); modal band = developing.
  links.set('2|2', native(2, 2, 0.8, 'developing'));
  links.set('3|2', native(3, 2, 0.8, 'developing'));
  // Pad to clear the min-8 top-up with neutral comps so comps 1 & 2 stay deterministic.
  for (let c = 90; c < 96; c++) {
    links.set(`2|${c}`, native(2, c, 0.7, 'proficient'));
    links.set(`3|${c}`, native(3, c, 0.7, 'proficient'));
  }

  const pool = makeFakePool(roles, links);
  await deriveUnratedRoleCompetencies(pool);

  const comp1 = links.get('1|1')!;
  assert.ok(comp1, 'competency 1 derived');
  assert.equal(comp1.source, DERIVED_SOURCE);
  assert.equal(comp1.importance_tier, 'core');      // weight 1.1 → 1.1*3.5 ≥ 3.75
  assert.equal(comp1.target_proficiency, 'advanced'); // modal band
  assert.equal(comp1.min_proficiency, 'proficient');  // one band below advanced

  const comp2 = links.get('1|2')!;
  assert.equal(comp2.importance_tier, 'secondary');  // weight 0.8 → below threshold
  assert.equal(comp2.target_proficiency, 'developing');
  assert.equal(comp2.min_proficiency, 'novice');     // one band below developing
});

// ── 7. Idempotency ───────────────────────────────────────────────────────────

test('re-running is idempotent — UPSERT in place, no duplicate rows', async () => {
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' },
    { id: 2, code: 'ONET_15-1252.01' },
  ];
  const links = new Map<string, CompRow>();
  for (let c = 100; c < 110; c++) links.set(`2|${c}`, native(2, c, 1.0, 'proficient'));

  const pool = makeFakePool(roles, links);
  const first = await deriveUnratedRoleCompetencies(pool);
  const afterFirst = links.size;
  const second = await deriveUnratedRoleCompetencies(pool);

  assert.deepEqual(first, second);
  assert.equal(links.size, afterFirst); // no growth on the second run
});

// ── 8. Stale-row cleanup when a role gains native ratings ─────────────────────

test('stale derived rows are removed once a role gains native onet ratings', async () => {
  const roles: RoleRow[] = [
    { id: 1, code: 'ONET_15-1252.00' }, // initially unrated
    { id: 2, code: 'ONET_15-1252.01' }, // rated relative
  ];
  const links = new Map<string, CompRow>();
  for (let c = 100; c < 110; c++) links.set(`2|${c}`, native(2, c, 1.0, 'proficient'));

  const pool = makeFakePool(roles, links);
  await deriveUnratedRoleCompetencies(pool);
  assert.ok(derivedRowsFor(links, 1).length > 0, 'role 1 starts with derived rows');

  // Role 1 now gains its own NATIVE O*NET ratings (no longer unrated).
  links.set('1|500', native(1, 500, 1.3, 'expert'));

  const res = await deriveUnratedRoleCompetencies(pool);
  // The cleanup DELETE must have purged role 1's derived rows; it is no longer unrated.
  assert.equal(derivedRowsFor(links, 1).length, 0);
  assert.equal(res.rolesUnrated, 0);
  // The native row survives untouched.
  assert.ok(links.has('1|500'));
});

console.log('\n── O*NET unrated-role competency derivation tests defined ──────────────');
