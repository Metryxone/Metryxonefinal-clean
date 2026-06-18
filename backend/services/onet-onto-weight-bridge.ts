/**
 * O*NET → Role-DNA weight bridge.
 *
 * The app runs TWO disjoint competency ontologies:
 *   - `onto_*` (text ids: role_*, comp_*) — the CURATED ontology the user-facing
 *     Role-DNA pane (OntologyExplorerPage) and Capability Heatmap
 *     (CareerMobilityPage) read via getRoleDNA / getRoleVector → onto_role_weights.
 *   - `ont_*`  (integer ids) — the O*NET-imported library (RolesPanel /
 *     role-crosswalk) where REAL O*NET-derived links live in
 *     map_role_competency.source = 'onet_derived' (estimated weights inherited
 *     from related SOC occupations by deriveUnratedRoleCompetencies).
 *
 * The two never met, so the user pages' "Estimated / inherited" honesty badge
 * could never fire. This bridge maps the O*NET-derived links across the two
 * namespaces (role by title, competency by name) and writes them into
 * onto_role_weights stamped source='onet_derived', so the badge lights up on the
 * genuinely estimated competencies — and ONLY those.
 *
 * Discipline:
 *   - ADDITIVE: a curated (dna_profile_id, competency_id) weight ALWAYS wins; a
 *     derived row is inserted only for competencies the profile doesn't curate.
 *   - HONEST: only rows that genuinely match across both namespaces bridge. No
 *     name match ⇒ no row (an honest gap, never fabricated).
 *   - IDEMPOTENT: every run rebuilds the onet_derived rows from scratch; curated
 *     rows are never touched.
 */

import type { Pool } from 'pg';

/** O*NET proficiency band → onto_role_weights.expected_level (1..5). */
export const PROFICIENCY_TO_LEVEL: Record<string, number> = {
  novice: 1,
  developing: 2,
  proficient: 3,
  advanced: 4,
  expert: 5,
};

/** Map an O*NET target-proficiency band to the onto integer level (defaults to 3). */
export function profToLevel(band: string | null | undefined): number {
  if (!band) return 3;
  return PROFICIENCY_TO_LEVEL[band.toLowerCase().trim()] ?? 3;
}

// Lazy ensure-schema mirroring 20261212_onto_role_weights_source.sql (no runner).
let sourceColumnReady: Promise<void> | null = null;
export function ensureOntoRoleWeightSourceColumn(pool: Pool): Promise<void> {
  if (!sourceColumnReady) {
    sourceColumnReady = pool
      .query(
        `ALTER TABLE onto_role_weights
           ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'curated'`,
      )
      .then(() => undefined)
      .catch((err) => {
        // Reset so a transient failure can retry on the next read.
        sourceColumnReady = null;
        throw err;
      });
  }
  return sourceColumnReady;
}

export interface BridgeResult {
  /** onet_derived weight rows present in onto_role_weights after the rebuild. */
  linksBridged: number;
  ok: boolean;
  error?: string;
}

/**
 * Rebuild the O*NET-derived rows in onto_role_weights from map_role_competency.
 * Idempotent and additive. Returns 0 honestly when nothing bridges (e.g. the
 * O*NET library has not been imported, or no names align across the ontologies).
 */
export async function bridgeOnetDerivedWeights(pool: Pool): Promise<BridgeResult> {
  try {
    await ensureOntoRoleWeightSourceColumn(pool);

    // Clear prior derived rows only — curated weights are never touched. This
    // keeps the bridge idempotent and drops any link that no longer qualifies
    // (e.g. a competency that has since gained a curated weight, or a role that
    // gained native O*NET ratings so its estimates were retired upstream).
    await pool.query(`DELETE FROM onto_role_weights WHERE source = 'onet_derived'`);

    // One additive pass. Role match = identical title across namespaces;
    // competency match = identical name. Estimated weights are normalised to a
    // per-profile fraction (window over the matched derived set) so they read on
    // the same scale as curated weights; the level is mapped from the O*NET
    // target proficiency band. NOT EXISTS guarantees curated rows win, and the
    // window only spans the rows that will actually be inserted.
    const { rowCount } = await pool.query(
      `
      WITH derived AS (
        SELECT p.id            AS dna_profile_id,
               oc.id           AS competency_id,
               mrc.weight::float AS raw_weight,
               mrc.target_proficiency AS band
          FROM onto_roles oro
          JOIN onto_dna_profiles p   ON p.role_id = oro.id AND p.is_current = TRUE
          JOIN ont_roles orn         ON lower(btrim(orn.title)) = lower(btrim(oro.title))
          JOIN map_role_competency mrc ON mrc.role_id = orn.id
                                      AND mrc.source = 'onet_derived'
                                      AND mrc.is_active = TRUE
          JOIN ont_competencies oce  ON oce.id = mrc.competency_id
          JOIN onto_competencies oc  ON lower(btrim(oc.canonical_name)) = lower(btrim(oce.name))
         WHERE oro.deprecated = FALSE
           AND oc.deprecated = FALSE
           AND NOT EXISTS (
                 SELECT 1 FROM onto_role_weights w
                  WHERE w.dna_profile_id = p.id AND w.competency_id = oc.id
               )
      )
      INSERT INTO onto_role_weights
            (dna_profile_id, competency_id, weight, expected_level, rationale, source)
      SELECT dna_profile_id,
             competency_id,
             ROUND((raw_weight / NULLIF(SUM(raw_weight) OVER (PARTITION BY dna_profile_id), 0))::numeric, 4),
             CASE lower(btrim(COALESCE(band, '')))
               WHEN 'novice'     THEN 1
               WHEN 'developing' THEN 2
               WHEN 'proficient' THEN 3
               WHEN 'advanced'   THEN 4
               WHEN 'expert'     THEN 5
               ELSE 3
             END,
             'Estimated from a related O*NET occupation (inherited)',
             'onet_derived'
        FROM derived
      ON CONFLICT (dna_profile_id, competency_id) DO NOTHING
      `,
    );

    return { linksBridged: rowCount ?? 0, ok: true };
  } catch (err: any) {
    console.error('[onet-onto-weight-bridge] error:', err);
    return { linksBridged: 0, ok: false, error: err?.message ?? 'bridge failed' };
  }
}
