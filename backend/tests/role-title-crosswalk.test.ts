/**
 * Role Title Crosswalk — unit tests for the honesty rules (Task #104).
 *
 * The free-text title → curated Role-DNA crosswalk (`resolveCuratedRoleByTitle`)
 * carries subtle honesty rules that were verified manually during the build but
 * had no standing test:
 *   • abstains (never guesses) when there is no defensible match;
 *   • keeps seniority distinct ("Senior Backend Engineer" vs "Backend Engineer");
 *   • refuses to cross-match on generic words alone ("Product Manager" vs
 *     "Project Manager" share only the generic token "manager");
 *   • flags anything but an exact title hit as Estimated;
 *   • carries Coverage (the role's profiled competencies) and Confidence (title-
 *     resolution trust) as SEPARATE fields, never composited.
 *
 * These tests drive the resolver against a SEEDED FIXTURE of curated roles via a
 * tiny fake pg `Pool`, so they are deterministic and do NOT depend on live dev
 * DB row counts (or on DATABASE_URL being set at all). The backend runs on tsx
 * with no typecheck gate, so this runtime test is the only regression safety net.
 *
 * Run with:  cd backend && npx tsx --test tests/role-title-crosswalk.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';

import {
  resolveCuratedRoleByTitle,
  getMatchableCuratedRoles,
  normalizeTitle,
} from '../services/role-title-crosswalk';

// ── Seeded fixture: curated roles that carry an active competency profile ─────
// Shape mirrors the columns getMatchableCuratedRoles SELECTs (id, title,
// seniority, competency_count, weight_total). The competency_count values differ
// so tie-breaks are observable, but no assertion depends on a live row count.
interface FixtureRole {
  id: string;
  title: string;
  seniority: string | null;
  competency_count: number;
  weight_total: number;
}

const FIXTURE_ROLES: FixtureRole[] = [
  { id: 'role_be_eng', title: 'Backend Engineer', seniority: 'mid', competency_count: 8, weight_total: 100 },
  { id: 'role_sr_be_eng', title: 'Senior Backend Engineer', seniority: 'senior', competency_count: 9, weight_total: 100 },
  { id: 'role_fe_eng', title: 'Frontend Engineer', seniority: 'mid', competency_count: 7, weight_total: 100 },
  { id: 'role_pm', title: 'Product Manager', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_data_analyst', title: 'Data Analyst', seniority: 'mid', competency_count: 5, weight_total: 100 },
];

/**
 * A minimal fake pg Pool that answers only the two queries the crosswalk runs:
 *   1. the `to_regclass` substrate probe (roleCompetencyProfileTablesReady);
 *   2. the matchable-roles SELECT (joins onto_role_competency_profiles rcp).
 * Anything else returns an empty result. `tablesReady:false` simulates an absent
 * substrate so we can prove the "no curated roles" abstain path too.
 */
function makeFakePool(
  roleRows: FixtureRole[],
  { tablesReady = true }: { tablesReady?: boolean } = {},
): Pool {
  return {
    query: async (sql: any) => {
      const text = String(sql);
      if (text.includes('to_regclass')) {
        return tablesReady
          ? { rows: [{ a: 'onto_role_competency_profiles', b: 'onto_roles', c: 'onto_competencies' }] }
          : { rows: [{ a: null, b: null, c: null }] };
      }
      if (text.includes('onto_role_competency_profiles rcp')) {
        return { rows: roleRows };
      }
      return { rows: [] };
    },
  } as unknown as Pool;
}

const pool = makeFakePool(FIXTURE_ROLES);

// ── normalizeTitle: pure helper (no DB) ─────────────────────────────────────

test('normalizeTitle lowercases, strips punctuation/diacritics, collapses space', () => {
  assert.equal(normalizeTitle('  Sr. Back-End  Engineer!! '), 'sr back end engineer');
  assert.equal(normalizeTitle('Señor Developer'), 'senor developer');
  assert.equal(normalizeTitle(''), '');
  assert.equal(normalizeTitle('   '), '');
  assert.equal(normalizeTitle('@#$%^&*'), '');
});

// ── getMatchableCuratedRoles degrades honestly when the substrate is absent ──

test('getMatchableCuratedRoles returns [] when the substrate is absent (no fabrication)', async () => {
  const empty = makeFakePool(FIXTURE_ROLES, { tablesReady: false });
  assert.deepEqual(await getMatchableCuratedRoles(empty), []);
});

test('getMatchableCuratedRoles maps the fixture rows when the substrate is present', async () => {
  const rows = await getMatchableCuratedRoles(pool);
  assert.equal(rows.length, FIXTURE_ROLES.length);
  const be = rows.find((r) => r.id === 'role_be_eng');
  assert.ok(be);
  assert.equal(be!.title, 'Backend Engineer');
  assert.equal(be!.competency_count, 8);
});

// ── 1. Exact match ──────────────────────────────────────────────────────────

test('exact title match resolves with match_type exact_title and estimated:false', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Backend Engineer');
  assert.ok(res.resolved, 'an exact title must resolve');
  assert.equal(res.resolved!.role_id, 'role_be_eng');
  assert.equal(res.resolved!.match_type, 'exact_title');
  assert.equal(res.resolved!.estimated, false, 'an exact hit is authoritative, not Estimated');
  assert.equal(res.resolved!.confidence_label, 'high');
});

test('exact match is abbreviation-tolerant ("Sr. Backend Engineer" → Senior Backend Engineer)', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Sr. Backend Engineer');
  assert.ok(res.resolved);
  assert.equal(res.resolved!.role_id, 'role_sr_be_eng', '"Sr." canonicalises to "Senior" and hits the senior role exactly');
  assert.equal(res.resolved!.match_type, 'exact_title');
  assert.equal(res.resolved!.estimated, false);
});

// ── 2. Alias match ──────────────────────────────────────────────────────────

test('alias match resolves via a known synonym and is flagged Estimated', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Backend Developer');
  assert.ok(res.resolved, 'a known alias must resolve');
  assert.equal(res.resolved!.role_id, 'role_be_eng', '"Backend Developer" bridges to "Backend Engineer"');
  assert.equal(res.resolved!.match_type, 'alias');
  assert.equal(res.resolved!.estimated, true, 'anything but an exact hit is Estimated');
});

// ── 3. Partial match ────────────────────────────────────────────────────────

test('partial match resolves on a shared distinctive token and is flagged Estimated', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Frontend Web Engineer');
  assert.ok(res.resolved, 'a shared distinctive token ("frontend") yields a partial match');
  assert.equal(res.resolved!.role_id, 'role_fe_eng');
  assert.equal(res.resolved!.match_type, 'partial_title');
  assert.equal(res.resolved!.estimated, true);
  // A partial overlap is lower-trust than an exact hit.
  assert.ok(res.resolved!.confidence_pct < 92, 'partial confidence is below an exact hit');
});

// ── 4. Seniority disambiguation (distinct, both directions) ──────────────────

test('seniority stays distinct: a base title does NOT resolve to the senior role', async () => {
  const base = await resolveCuratedRoleByTitle(pool, 'Backend Engineer');
  assert.equal(base.resolved!.role_id, 'role_be_eng', 'base title → base role');

  const senior = await resolveCuratedRoleByTitle(pool, 'Senior Backend Engineer');
  assert.equal(senior.resolved!.role_id, 'role_sr_be_eng', 'senior title → senior role');
  assert.equal(senior.resolved!.match_type, 'exact_title');

  assert.notEqual(base.resolved!.role_id, senior.resolved!.role_id, 'the two seniorities never collapse together');
});

// ── 5. Generic-token abstain (the "Product Manager" vs "Project Manager" rule)

test('generic-token-only overlap ABSTAINS ("Project Manager" vs "Product Manager")', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Project Manager');
  assert.equal(res.resolved, null, 'a shared generic "manager" alone must not cross-match');
  assert.equal(res.candidates_considered, FIXTURE_ROLES.length, 'it considered the roles, then honestly abstained');
  assert.match(res.note, /abstain/i);
});

// ── 6. Empty / garbage title abstain ────────────────────────────────────────

test('empty title abstains with a "nothing to crosswalk" note and zero considered', async () => {
  const res = await resolveCuratedRoleByTitle(pool, '   ');
  assert.equal(res.resolved, null);
  assert.deepEqual(res.alternatives, []);
  assert.equal(res.candidates_considered, 0);
  assert.match(res.note, /empty/i);
});

test('punctuation-only title normalises to empty and abstains', async () => {
  const res = await resolveCuratedRoleByTitle(pool, '!!! @#$ ***');
  assert.equal(res.resolved, null);
  assert.equal(res.candidates_considered, 0);
});

test('garbage title with no shared meaning abstains (never fabricates)', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Qwerty Zxcvb Plumbus');
  assert.equal(res.resolved, null);
  assert.equal(res.candidates_considered, FIXTURE_ROLES.length, 'roles were considered, no defensible match found');
  assert.match(res.note, /abstain/i);
});

test('abstains honestly when no curated roles carry a profile (substrate empty)', async () => {
  const empty = makeFakePool(FIXTURE_ROLES, { tablesReady: false });
  const res = await resolveCuratedRoleByTitle(empty, 'Backend Engineer');
  assert.equal(res.resolved, null);
  assert.equal(res.candidates_considered, 0);
  assert.match(res.note, /no curated roles/i);
});

// ── 7. Coverage and Confidence are SEPARATE fields ──────────────────────────

test('Coverage (profile) and Confidence (title trust) are carried as separate fields', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Backend Engineer');
  assert.ok(res.resolved);
  const m = res.resolved!;
  // Confidence axis — title-resolution trust.
  assert.equal(typeof m.confidence_pct, 'number');
  assert.ok(m.confidence_pct > 0 && m.confidence_pct <= 100);
  assert.ok(['high', 'medium', 'low'].includes(m.confidence_label));
  // Coverage axis — the role's profiled competencies (a DIFFERENT, independent
  // signal). These are distinct keys, never folded into the confidence number.
  assert.equal(typeof m.competency_count, 'number');
  assert.equal(m.competency_count, 8);
  assert.equal(typeof m.weight_total, 'number');
  assert.ok('competency_count' in m && 'confidence_pct' in m, 'both axes are present and separate');
  // The note explicitly frames them as separate axes.
  assert.match(res.note, /separate axes/i);
});

// ── 8. Spelling / spacing variants resolve via the alias map (Task #106) ─────
// A fuller fixture covering the curated roles the expansion adds, so spacing /
// spelling variants ("Front End Developer", "ML Engineer", …) have a real target.
const VARIANT_FIXTURE: FixtureRole[] = [
  { id: 'role_software_eng', title: 'Software Engineer', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_sr_software_eng', title: 'Senior Software Engineer', seniority: 'senior', competency_count: 7, weight_total: 100 },
  { id: 'role_be_eng', title: 'Backend Engineer', seniority: 'mid', competency_count: 8, weight_total: 100 },
  { id: 'role_fe_eng', title: 'Frontend Engineer', seniority: 'mid', competency_count: 7, weight_total: 100 },
  { id: 'role_fullstack_eng', title: 'Full Stack Engineer', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_devops_eng', title: 'DevOps Engineer', seniority: 'mid', competency_count: 7, weight_total: 100 },
  { id: 'role_qa_eng', title: 'QA Engineer', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_data_analyst', title: 'Data Analyst', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_data_scientist', title: 'Data Scientist', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_pm', title: 'Product Manager', seniority: 'mid', competency_count: 6, weight_total: 100 },
  { id: 'role_project_manager', title: 'Project Manager', seniority: 'mid', competency_count: 6, weight_total: 100 },
];
const vpool = makeFakePool(VARIANT_FIXTURE);

const VARIANT_CASES: { input: string; expect: string }[] = [
  { input: 'Front End Developer', expect: 'role_fe_eng' },
  { input: 'Front End Dev', expect: 'role_fe_eng' },
  { input: 'Frontend Developer', expect: 'role_fe_eng' },
  { input: 'Backend Developer', expect: 'role_be_eng' },
  { input: 'Back End Dev', expect: 'role_be_eng' },
  { input: 'Software Developer', expect: 'role_software_eng' },
  { input: 'Sr. Software Developer', expect: 'role_sr_software_eng' },
  { input: 'Full Stack Developer', expect: 'role_fullstack_eng' },
  { input: 'Fullstack Engineer', expect: 'role_fullstack_eng' },
  { input: 'Dev Ops Engineer', expect: 'role_devops_eng' },
  { input: 'Quality Assurance Engineer', expect: 'role_qa_eng' },
  { input: 'Test Engineer', expect: 'role_qa_eng' },
  { input: 'ML Engineer', expect: 'role_data_scientist' },
  { input: 'Machine Learning Engineer', expect: 'role_data_scientist' },
];

for (const { input, expect } of VARIANT_CASES) {
  test(`variant "${input}" resolves to ${expect} (Estimated, via alias)`, async () => {
    const res = await resolveCuratedRoleByTitle(vpool, input);
    assert.ok(res.resolved, `"${input}" must resolve, not abstain`);
    assert.equal(res.resolved!.role_id, expect, `"${input}" → ${expect}`);
    assert.equal(res.resolved!.estimated, true, 'an aliased spelling variant is Estimated, never authoritative');
  });
}

test('the new aliases do NOT collapse genuinely distinct roles (PM vs Project Manager)', async () => {
  const product = await resolveCuratedRoleByTitle(vpool, 'Product Manager');
  assert.equal(product.resolved!.role_id, 'role_pm', 'Product Manager → Product Manager (exact)');
  const project = await resolveCuratedRoleByTitle(vpool, 'Project Manager');
  assert.equal(project.resolved!.role_id, 'role_project_manager', 'Project Manager → Project Manager (exact), never Product');
  assert.notEqual(product.resolved!.role_id, project.resolved!.role_id, 'the two never cross-match');
});

// ── Alternatives are ranked and exclude the resolved pick ────────────────────

test('alternatives are returned for transparency and exclude the resolved role', async () => {
  const res = await resolveCuratedRoleByTitle(pool, 'Backend Engineer');
  assert.ok(res.resolved);
  for (const alt of res.alternatives) {
    assert.notEqual(alt.role_id, res.resolved!.role_id, 'the chosen role is not also listed as an alternative');
  }
});
