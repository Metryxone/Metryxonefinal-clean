/**
 * MX-201 P3 — Real-data, no-fabrication backfill (governed, additive, reversible).
 *
 * Populates ONLY crosswalks that are derivable from REAL existing data:
 *   1. onto_competency_onet_crosswalk  — canonical genome (onto_) ↔ O*NET library (ont_)
 *      via O*NET element-id (high confidence) or exact canonical-name (medium).
 *      This bridge makes 137 genome competencies reach map_role_competency (52,362 real
 *      role↔competency weightings) — genuine downstream role signal, zero fabrication.
 *   2. onto_competency_resource_map     — genome ↔ cg_skill_resource_map by skill_key overlap.
 *   3. onto_competency_certification_map — genome ↔ rr_certifications via shared role profiles.
 *
 * It does NOT author behavioural indicators / evidence / learning outcomes — that is genuine
 * knowledge content with no data source here; fabricating it is refused by design.
 *
 * Every row is stamped source='mx201'. Fully reversible:  npx tsx scripts/mx201-p3-real-backfill.ts --rollback
 */
import { Pool } from 'pg';

const SOURCE = 'mx201';
const ROLLBACK = process.argv.includes('--rollback');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (ROLLBACK) { await rollback(pool); return; }

    // ---- DDL: additive crosswalk homes (idempotent) -------------------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onto_competency_onet_crosswalk (
        id bigserial PRIMARY KEY,
        competency_id text NOT NULL,
        ont_competency_id integer NOT NULL,
        onet_code text,
        match_method text NOT NULL,
        confidence text NOT NULL,
        source text NOT NULL DEFAULT 'mx201',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (competency_id, ont_competency_id)
      )`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onto_competency_resource_map (
        id bigserial PRIMARY KEY,
        competency_id text NOT NULL,
        resource_id integer NOT NULL,
        skill_key text NOT NULL,
        match_method text NOT NULL,
        source text NOT NULL DEFAULT 'mx201',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (competency_id, resource_id)
      )`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onto_competency_certification_map (
        id bigserial PRIMARY KEY,
        competency_id text NOT NULL,
        certification_id bigint NOT NULL,
        role_id text NOT NULL,
        source text NOT NULL DEFAULT 'mx201',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (competency_id, certification_id, role_id)
      )`);

    const before = await counts(pool);

    // ---- 1. O*NET crosswalk: element-id (high) then exact-name (medium) -----------------
    const elem = await pool.query(`
      INSERT INTO onto_competency_onet_crosswalk (competency_id, ont_competency_id, onet_code, match_method, confidence, source)
      SELECT DISTINCT o.id, e.id, e.external_ref, 'element_id', 'high', $1
      FROM onto_competencies o
      JOIN ont_competencies e ON (o.scoring_metadata->>'onet_element_id') = e.external_ref
      WHERE o.deprecated IS NOT TRUE
      ON CONFLICT (competency_id, ont_competency_id) DO NOTHING`, [SOURCE]);
    // exact_name: ONLY unambiguous one-to-one name matches (a name mapping to >1 O*NET
    // competency is skipped, not arbitrarily resolved — abstain beats a fabricated link).
    const name = await pool.query(`
      INSERT INTO onto_competency_onet_crosswalk (competency_id, ont_competency_id, onet_code, match_method, confidence, source)
      SELECT o.id, u.id, u.external_ref, 'exact_name', 'medium', $1
      FROM onto_competencies o
      JOIN (
        SELECT lower(trim(name)) nm, min(id) id, min(external_ref) external_ref
        FROM ont_competencies
        GROUP BY lower(trim(name))
        HAVING count(*) = 1
      ) u ON u.nm = lower(trim(o.canonical_name))
      WHERE o.deprecated IS NOT TRUE
        AND NOT EXISTS (SELECT 1 FROM onto_competency_onet_crosswalk x WHERE x.competency_id = o.id)
      ON CONFLICT (competency_id, ont_competency_id) DO NOTHING`, [SOURCE]);

    // transparency: how many exact-name candidates were skipped as ambiguous
    const ambiguous = await pool.query(`
      SELECT count(*)::int n FROM onto_competencies o
      WHERE o.deprecated IS NOT TRUE
        AND NOT EXISTS (SELECT 1 FROM onto_competency_onet_crosswalk x WHERE x.competency_id = o.id)
        AND lower(trim(o.canonical_name)) IN (
          SELECT lower(trim(name)) FROM ont_competencies GROUP BY lower(trim(name)) HAVING count(*) > 1
        )`);

    // ---- 2. Learning resources: genome ↔ cg_skill_resource_map by skill_key --------------
    const res = await pool.query(`
      INSERT INTO onto_competency_resource_map (competency_id, resource_id, skill_key, match_method, source)
      SELECT DISTINCT o.id, m.resource_id, m.skill_key, 'skill_key_exact', $1
      FROM onto_competencies o
      JOIN cg_skill_resource_map m
        ON lower(trim(m.skill_key)) = lower(trim(o.slug))
        OR lower(trim(m.skill_key)) = lower(trim(o.canonical_name))
      WHERE o.deprecated IS NOT TRUE
      ON CONFLICT (competency_id, resource_id) DO NOTHING`, [SOURCE]);

    // ---- 3. Certifications: genome ↔ rr_certifications via shared role profiles -----------
    const cert = await pool.query(`
      INSERT INTO onto_competency_certification_map (competency_id, certification_id, role_id, source)
      SELECT DISTINCT p.competency_id, c.id, c.role_id, $1
      FROM onto_role_competency_profiles p
      JOIN rr_certifications c ON c.role_id = p.role_id
      WHERE p.active IS TRUE
      ON CONFLICT (competency_id, certification_id, role_id) DO NOTHING`, [SOURCE]);

    const after = await counts(pool);

    // ---- Honest reachability metric ------------------------------------------------------
    const reach = await pool.query(`
      SELECT count(DISTINCT x.competency_id)::int n
      FROM onto_competency_onet_crosswalk x
      JOIN map_role_competency m ON m.competency_id = x.ont_competency_id
      WHERE x.source = $1`, [SOURCE]);

    console.log('=== MX-201 P3 real-data backfill ===');
    console.log('inserted onet element_id rows :', elem.rowCount);
    console.log('inserted onet exact_name rows :', name.rowCount, `(skipped ${ambiguous.rows[0].n} ambiguous name candidates)`);
    console.log('inserted resource rows        :', res.rowCount);
    console.log('inserted certification rows   :', cert.rowCount);
    console.log('\ntable totals (source=mx201):');
    console.table({ before, after });
    console.log('\nHONEST: genome competencies now reaching real map_role_competency weights via crosswalk:', reach.rows[0].n, '/ 419');
    console.log('NOTE: behavioural indicators / evidence / learning outcomes NOT authored (no data source; fabrication refused).');
  } finally {
    await pool.end();
  }
}

async function counts(pool: Pool) {
  const r = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM onto_competency_onet_crosswalk WHERE source=$1) onet,
      (SELECT count(*)::int FROM onto_competency_resource_map WHERE source=$1) resources,
      (SELECT count(*)::int FROM onto_competency_certification_map WHERE source=$1) certs`, [SOURCE]);
  return r.rows[0];
}

async function rollback(pool: Pool) {
  const a = await pool.query(`DELETE FROM onto_competency_onet_crosswalk WHERE source=$1`, [SOURCE]);
  const b = await pool.query(`DELETE FROM onto_competency_resource_map WHERE source=$1`, [SOURCE]);
  const c = await pool.query(`DELETE FROM onto_competency_certification_map WHERE source=$1`, [SOURCE]);
  console.log('=== MX-201 P3 ROLLBACK (source=mx201) ===');
  console.log('deleted onet:', a.rowCount, 'resources:', b.rowCount, 'certs:', c.rowCount);
  // NOTE: pool closed by main()'s finally — do not end here (avoids double-close).
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
