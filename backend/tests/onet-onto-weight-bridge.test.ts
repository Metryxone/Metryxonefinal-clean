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
} from '../services/onet-onto-weight-bridge';

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
