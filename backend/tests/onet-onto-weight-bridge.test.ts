/**
 * O*NET → Role-DNA weight bridge — unit + live-DB tests
 *
 * Run with:  npx tsx backend/tests/onet-onto-weight-bridge.test.ts
 *
 * Covers services/onet-onto-weight-bridge.ts, which maps real O*NET-derived
 * competency links (map_role_competency.source='onet_derived', ont_* namespace)
 * across into the user-facing Role-DNA table (onto_role_weights, onto_*
 * namespace) so the "Estimated / inherited" honesty badge on
 * OntologyExplorerPage / CareerMobilityPage fires on genuinely estimated rows.
 *
 *   Layer A (pure): profToLevel / PROFICIENCY_TO_LEVEL band → level mapping.
 *   Layer B (live DB, skipped without DATABASE_URL): inside a ROLLBACK-only
 *     transaction —
 *       · a derived link that name-matches across namespaces is bridged and
 *         stamped source='onet_derived';
 *       · curated weights are never touched (count + sources unchanged);
 *       · a competency the profile already curates is NOT overwritten (curated
 *         always wins);
 *       · the run is idempotent (a second run yields the same derived rows).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import {
  profToLevel,
  PROFICIENCY_TO_LEVEL,
  bridgeOnetDerivedWeights,
  buildCompetencyMatcher,
} from '../services/onet-onto-weight-bridge';
import { resolveOntRole } from '../services/role-crosswalk';

/**
 * Build a fully self-contained onto_* fixture (role + current DNA profile +
 * competency) with UNIQUE, multi-word names.
 *
 * The naming differences / ambiguous-resolution tests must resolve their curated
 * onto role title to *their own* ont_* fixtures. Against a real seeded DB that is
 * only possible with a unique title: a reused real role title (e.g. "Backend
 * Engineer") legitimately resolves to a real linkable O*NET alias occupation
 * (e.g. "Software Developers", 25 competencies) that correctly outranks a test
 * fixture — so the bridge would (correctly) bridge the real role, not the
 * fixture, and the assertion on the fixture pair would spuriously fail. A unique
 * title guarantees the fixture is the ONLY resolution, making the test both
 * deterministic and an honest exercise of the intended bridge behaviour.
 *
 * FK anchors (role family / layer / competency domain+family) are reused from the
 * existing ontology so the helper stays valid if the seed's ids change.
 */
async function seedSyntheticOntoFixture(client: any) {
  // Short suffix: ont_*.code is varchar(30), so keep the prefixed test codes
  // (e.g. "TEST_AMBIG_PARTIAL_<uniq>") within that bound. Uniqueness only needs
  // to hold inside this rolled-back transaction.
  const uniq = 'zt' + Math.random().toString(36).slice(2, 8);
  const roleTitle = `ZZ Bridge Test Role ${uniq}`; // multi-word + unique
  const compName = `ZZ Bridge Test Competency ${uniq}`; // multi-word + unique
  const roleId = `test_role_${uniq}`;
  const profileId = `test_prof_${uniq}`;
  const compId = `test_comp_${uniq}`;

  const rf = await client.query(
    `SELECT role_family_id, layer_id FROM onto_roles LIMIT 1`);
  const cf = await client.query(
    `SELECT domain_id, family_id FROM onto_competencies LIMIT 1`);
  if (!rf.rows.length || !cf.rows.length) return null;
  const { role_family_id, layer_id } = rf.rows[0];
  const { domain_id, family_id } = cf.rows[0];

  await client.query(
    `INSERT INTO onto_roles (id, role_family_id, layer_id, title)
     VALUES ($1, $2, $3, $4)`,
    [roleId, role_family_id, layer_id, roleTitle]);
  await client.query(
    `INSERT INTO onto_dna_profiles (id, role_id, is_current) VALUES ($1, $2, TRUE)`,
    [profileId, roleId]);
  await client.query(
    `INSERT INTO onto_competencies
       (id, canonical_name, slug, domain_id, family_id, scientific_type,
        definition, trainability, stability_level, complexity_level)
     VALUES ($1, $2, $3, $4, $5, 'cognitive', 'Test bridge competency', 'high',
             'state_like', 3)`,
    [compId, compName, `slug-${uniq}`, domain_id, family_id]);

  return { uniq, roleTitle, compName, roleId, profileId, compId };
}

// ── Layer A: pure proficiency → level mapping ───────────────────────────────

test('profToLevel maps every O*NET band to its onto level', () => {
  assert.equal(profToLevel('novice'), 1);
  assert.equal(profToLevel('developing'), 2);
  assert.equal(profToLevel('proficient'), 3);
  assert.equal(profToLevel('advanced'), 4);
  assert.equal(profToLevel('expert'), 5);
  // Case / whitespace tolerant.
  assert.equal(profToLevel('  Advanced '), 4);
  // Unknown / null → neutral middle band, never a throw.
  assert.equal(profToLevel(null), 3);
  assert.equal(profToLevel(undefined), 3);
  assert.equal(profToLevel('not-a-band'), 3);
  assert.equal(Object.keys(PROFICIENCY_TO_LEVEL).length, 5);
});

// ── Layer A: pure competency name matcher (casing/punctuation + synonyms) ────

test('buildCompetencyMatcher tolerates casing/punctuation and known synonyms', () => {
  const onto = [
    { id: 'C_LISTEN', canonical_name: 'Listening' },
    { id: 'C_PROBLEM', canonical_name: 'Problem Solving' },
    { id: 'C_MATH', canonical_name: 'Mathematics' },
    { id: 'C_PROG', canonical_name: 'Programming' },
  ];
  const match = buildCompetencyMatcher(onto);

  // Exact, but case / whitespace / punctuation insensitive (the OLD bridge's
  // lower(btrim(...)) would miss the hyphen variant).
  assert.equal(match('Listening')?.id, 'C_LISTEN');
  assert.equal(match('  listening ')?.id, 'C_LISTEN');
  assert.equal(match('Problem-Solving')?.id, 'C_PROBLEM');
  assert.equal(match('PROBLEM SOLVING')?.matchType, 'exact');

  // Known synonyms: the O*NET element name → curated competency.
  const al = match('Active Listening');
  assert.equal(al?.id, 'C_LISTEN');
  assert.equal(al?.matchType, 'synonym');
  assert.equal(match('Complex Problem Solving')?.id, 'C_PROBLEM');
  assert.equal(match('Numeracy')?.id, 'C_MATH');
  assert.equal(match('coding')?.id, 'C_PROG');

  // No genuine match → null (an honest gap, never fabricated).
  assert.equal(match('Underwater Basket Weaving'), null);
  assert.equal(match(''), null);
});

// ── Layer B: live-DB bridge inside a ROLLBACK-only transaction ──────────────

test('bridgeOnetDerivedWeights brings O*NET-derived links into onto_role_weights (additive, idempotent)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('no DATABASE_URL — skipping live-DB bridge test');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find an onto_role with a current DNA profile, and a published onto
    // competency that profile does NOT already curate (so the bridge can add
    // it). Skip gracefully if the dev ontology seed isn't present.
    const target = await client.query(`
      SELECT oro.id AS role_id, oro.title, p.id AS profile_id, oc.id AS comp_id, oc.canonical_name
        FROM onto_roles oro
        JOIN onto_dna_profiles p ON p.role_id = oro.id AND p.is_current = TRUE
        JOIN onto_competencies oc ON oc.deprecated = FALSE
       WHERE oro.deprecated = FALSE
         AND NOT EXISTS (SELECT 1 FROM onto_role_weights w
                          WHERE w.dna_profile_id = p.id AND w.competency_id = oc.id)
       LIMIT 1`);
    if (!target.rows.length) {
      t.skip('no eligible onto role/competency fixture in this DB');
      return;
    }
    const { role_id, title, profile_id, comp_id, canonical_name } = target.rows[0];

    const beforeCurated = await client.query(
      `SELECT COUNT(*)::int n FROM onto_role_weights WHERE source <> 'onet_derived'`);
    const curatedCount = beforeCurated.rows[0].n;

    // Stand up the ont_* (O*NET) side: a role with the SAME title and a
    // competency with the SAME name as the onto fixtures, plus an onet_derived
    // link between them.
    const ontRole = await client.query(
      `INSERT INTO ont_roles (code, title, status, is_active)
       VALUES ('TEST_BRIDGE_ROLE', $1, 'published', true) RETURNING id`, [title]);
    const ontComp = await client.query(
      `INSERT INTO ont_competencies (code, name, category, competency_type, is_active, status)
       VALUES ('TEST_BRIDGE_COMP', $1, 'behavioral', 'behavioral', true, 'published') RETURNING id`,
      [canonical_name]);
    await client.query(
      `INSERT INTO map_role_competency (role_id, competency_id, importance_tier, weight, target_proficiency, source, is_active)
       VALUES ($1, $2, 'core', 1.2, 'advanced', 'onet_derived', true)`,
      [ontRole.rows[0].id, ontComp.rows[0].id]);

    // Run the bridge twice — it must be idempotent.
    const r1 = await bridgeOnetDerivedWeights(client as unknown as Pool);
    assert.equal(r1.ok, true);
    const r2 = await bridgeOnetDerivedWeights(client as unknown as Pool);
    assert.equal(r2.ok, true);
    assert.equal(r1.linksBridged, r2.linksBridged, 'bridge is idempotent');

    // The derived row landed on the right profile/competency with real provenance.
    const got = await client.query(
      `SELECT weight::float AS weight, expected_level, source
         FROM onto_role_weights WHERE dna_profile_id = $1 AND competency_id = $2`,
      [profile_id, comp_id]);
    assert.equal(got.rows.length, 1, 'derived weight inserted for the matched pair');
    assert.equal(got.rows[0].source, 'onet_derived');
    assert.equal(got.rows[0].expected_level, 4, "advanced band → level 4");
    assert.ok(got.rows[0].weight > 0, 'weight normalised to a positive fraction');

    // Curated rows are never touched (count unchanged, none flipped to derived).
    const afterCurated = await client.query(
      `SELECT COUNT(*)::int n FROM onto_role_weights WHERE source <> 'onet_derived'`);
    assert.equal(afterCurated.rows[0].n, curatedCount, 'curated weights untouched');

    // Curated always wins: re-point the derived link at a competency the profile
    // already curates and confirm the curated row is NOT overwritten.
    const curated = await client.query(
      `SELECT w.competency_id, w.weight::float AS weight, c.canonical_name
         FROM onto_role_weights w JOIN onto_competencies c ON c.id = w.competency_id
        WHERE w.dna_profile_id = $1 AND w.source = 'curated' LIMIT 1`, [profile_id]);
    if (curated.rows.length) {
      const cur = curated.rows[0];
      await client.query(`UPDATE ont_competencies SET name = $1 WHERE id = $2`,
        [cur.canonical_name, ontComp.rows[0].id]);
      await bridgeOnetDerivedWeights(client as unknown as Pool);
      const stillCurated = await client.query(
        `SELECT weight::float AS weight, source FROM onto_role_weights
          WHERE dna_profile_id = $1 AND competency_id = $2`, [profile_id, cur.competency_id]);
      assert.equal(stillCurated.rows[0].source, 'curated', 'curated row not overwritten');
      assert.equal(stillCurated.rows[0].weight, cur.weight, 'curated weight preserved');
    }
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
});

// ── Layer B: synonym/fuzzy matching + honest unmatched reporting ─────────────

test('bridgeOnetDerivedWeights bridges across naming differences and reports gaps', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('no DATABASE_URL — skipping live-DB bridge test');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fx = await seedSyntheticOntoFixture(client);
    if (!fx) {
      t.skip('no ontology seed present in this DB');
      return;
    }

    // Stand up the ont_* side with NAMING DIFFERENCES the old exact-match bridge
    // (lower(btrim(...)) only) would have silently dropped: the role title is
    // upper-cased with trailing punctuation, and the competency name is
    // upper-cased with spaces swapped for hyphens. normalize() makes both
    // resolve, proving the matching is now tolerant of minor naming differences.
    const fuzzyTitle = `  ${fx.roleTitle.toUpperCase()}. `;
    const fuzzyComp = fx.compName.toUpperCase().replace(/ /g, '-');
    assert.notEqual(fuzzyComp.toLowerCase().trim(), fx.compName.toLowerCase().trim(),
      'fixture must actually differ from the canonical name (else it is not testing fuzziness)');

    const ontRole = await client.query(
      `INSERT INTO ont_roles (code, title, status, is_active)
       VALUES ($1, $2, 'published', true) RETURNING id`,
      [`TEST_FUZZY_ROLE_${fx.uniq}`, fuzzyTitle]);
    const ontComp = await client.query(
      `INSERT INTO ont_competencies (code, name, category, competency_type, is_active, status)
       VALUES ($1, $2, 'behavioral', 'behavioral', true, 'published') RETURNING id`,
      [`TEST_FUZZY_COMP_${fx.uniq}`, fuzzyComp]);
    await client.query(
      `INSERT INTO map_role_competency (role_id, competency_id, importance_tier, weight, target_proficiency, source, is_active)
       VALUES ($1, $2, 'core', 1.0, 'proficient', 'onet_derived', true)`,
      [ontRole.rows[0].id, ontComp.rows[0].id]);

    const r = await bridgeOnetDerivedWeights(client as unknown as Pool);
    assert.equal(r.ok, true);

    // The fuzzily-named derived link landed on the right curated pair.
    const got = await client.query(
      `SELECT source, expected_level FROM onto_role_weights
        WHERE dna_profile_id = $1 AND competency_id = $2`, [fx.profileId, fx.compId]);
    assert.equal(got.rows.length, 1, 'derived weight bridged despite naming differences');
    assert.equal(got.rows[0].source, 'onet_derived');
    assert.equal(got.rows[0].expected_level, 3, 'proficient band → level 3');

    // Honest reporting fields are populated so coverage gaps stay visible.
    assert.ok((r.rolesMatched ?? 0) >= 1, 'at least the fixture role matched');
    assert.equal(typeof r.rolesUnmatched, 'number');
    assert.ok(Array.isArray(r.unmatchedRoles), 'unmatched roles reported as an array');
    assert.equal(typeof r.competenciesMatched, 'number');
    assert.equal(typeof r.competenciesUnmatched, 'number');
    assert.ok(Array.isArray(r.unmatchedCompetencies), 'unmatched competencies reported as an array');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
});

// ── Layer B: "Business Analyst" curated crosswalk — resolves to an O*NET
//    occupation that carries estimated (onet_derived) links so the estimated
//    profile lights up instead of the role staying honestly unmatched ─────────

test('Business Analyst resolves to a derived-link O*NET occupation and gets an estimated profile', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('no DATABASE_URL — skipping live-DB crosswalk test');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // The onto Role-DNA role must exist for this to be meaningful; skip if the
    // ontology seed isn't present in this DB.
    const ba = await client.query(
      `SELECT oro.id, p.id AS profile_id
         FROM onto_roles oro
         JOIN onto_dna_profiles p ON p.role_id = oro.id AND p.is_current = TRUE
        WHERE oro.id = 'role_business_analyst' AND oro.deprecated = FALSE`);
    if (!ba.rows.length) {
      t.skip('no role_business_analyst onto role/profile in this DB');
      return;
    }
    const profileId = ba.rows[0].profile_id;

    // The crosswalk must resolve "Business Analyst" to at least one O*NET
    // occupation that carries onet_derived (estimated) links — otherwise the
    // bridge has nothing to inherit and the role stays unmatched.
    const derivedRoleRows = await client.query<{ role_id: number }>(
      `SELECT DISTINCT role_id FROM map_role_competency
        WHERE source = 'onet_derived' AND is_active = TRUE`);
    const derivedRoleIds = new Set<number>(derivedRoleRows.rows.map((r) => r.role_id));
    const candidates = await resolveOntRole(client as unknown as Pool, 'Business Analyst');
    const linkable = candidates.find((c) => derivedRoleIds.has(c.id));
    if (!linkable) {
      // The O*NET library may not be imported in this DB; that is an honest
      // environment gap, not a crosswalk failure, so skip rather than fail.
      t.skip('no O*NET occupation with derived links resolves for Business Analyst in this DB (library not imported?)');
      return;
    }
    assert.ok(linkable.matchType === 'alias' || linkable.matchType === 'exact_title',
      'Business Analyst resolves via the curated alias (not a fabricated fuzzy match)');

    // Running the bridge must produce estimated (onet_derived) weight rows for
    // the Business Analyst DNA profile — the "estimated skill profile" the role
    // was previously missing.
    const r = await bridgeOnetDerivedWeights(client as unknown as Pool);
    assert.equal(r.ok, true);
    const w = await client.query(
      `SELECT COUNT(*)::int n FROM onto_role_weights
        WHERE dna_profile_id = $1 AND source = 'onet_derived'`, [profileId]);
    assert.ok(w.rows[0].n > 0, 'Business Analyst now carries estimated (inherited) weights');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
});

// ── Layer B: ambiguous role resolution — prefer the role that actually has the
//    O*NET-derived links over an exact-title role that has none ──────────────

test('bridgeOnetDerivedWeights prefers the linkable role when an exact-title role has no derived links', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('no DATABASE_URL — skipping live-DB bridge test');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fx = await seedSyntheticOntoFixture(client);
    if (!fx) {
      t.skip('no ontology seed present in this DB');
      return;
    }

    // Two ont_* roles resolve from the SAME curated title:
    //   A — EXACT title, but its only link is a NON-derived (manual) one, so it
    //       carries NO O*NET-derived estimates.
    //   B — a partial-title synonym ("<title> Specialist"), carrying the real
    //       onet_derived link we want bridged.
    // The crosswalk ranks A above B (exact_title beats partial_title), so a naive
    // "best match" would select A and bridge nothing. The fix must instead pick B
    // because it is the only *linkable* role (the one that actually has derived
    // links). A unique fixture title guarantees these are the only two candidates,
    // so this deterministically isolates the linkable-preference behaviour.
    const exactRole = await client.query(
      `INSERT INTO ont_roles (code, title, status, is_active)
       VALUES ($1, $2, 'published', true) RETURNING id`,
      [`TEST_AMBIG_EXACT_${fx.uniq}`, fx.roleTitle]);
    const partialRole = await client.query(
      `INSERT INTO ont_roles (code, title, status, is_active)
       VALUES ($1, $2, 'published', true) RETURNING id`,
      [`TEST_AMBIG_PARTIAL_${fx.uniq}`, `${fx.roleTitle} Specialist`]);

    // Competency that the derived link (on role B) targets — matches the curated
    // competency by name so it can bridge.
    const derivedComp = await client.query(
      `INSERT INTO ont_competencies (code, name, category, competency_type, is_active, status)
       VALUES ($1, $2, 'behavioral', 'behavioral', true, 'published') RETURNING id`,
      [`TEST_AMBIG_COMP_${fx.uniq}`, fx.compName]);
    // A throwaway competency for role A's NON-derived link (so A has links, just
    // none that are onet_derived).
    const manualComp = await client.query(
      `INSERT INTO ont_competencies (code, name, category, competency_type, is_active, status)
       VALUES ($1, 'Test Ambig Manual Skill', 'behavioral', 'behavioral', true, 'published') RETURNING id`,
      [`TEST_AMBIG_MANUAL_${fx.uniq}`]);

    await client.query(
      `INSERT INTO map_role_competency (role_id, competency_id, importance_tier, weight, target_proficiency, source, is_active)
       VALUES ($1, $2, 'core', 1.0, 'proficient', 'manual', true)`,
      [exactRole.rows[0].id, manualComp.rows[0].id]);
    await client.query(
      `INSERT INTO map_role_competency (role_id, competency_id, importance_tier, weight, target_proficiency, source, is_active)
       VALUES ($1, $2, 'core', 1.0, 'advanced', 'onet_derived', true)`,
      [partialRole.rows[0].id, derivedComp.rows[0].id]);

    const r = await bridgeOnetDerivedWeights(client as unknown as Pool);
    assert.equal(r.ok, true);

    // The derived link from role B WAS bridged onto the curated pair — proving
    // we chose the linkable role, not the exact-title role with no estimates.
    const got = await client.query(
      `SELECT source, expected_level FROM onto_role_weights
        WHERE dna_profile_id = $1 AND competency_id = $2`, [fx.profileId, fx.compId]);
    assert.equal(got.rows.length, 1, 'derived weight bridged from the linkable (partial-title) role');
    assert.equal(got.rows[0].source, 'onet_derived');
    assert.equal(got.rows[0].expected_level, 4, 'advanced band → level 4');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
});
