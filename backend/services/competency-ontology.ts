/**
 * Competency Ontology & Workforce Taxonomy — Phase 1 service.
 *
 * Read-only public APIs for the foundational reference data:
 *   - capability domains, competency families, canonical onto_competencies
 *   - aliases (normalisation), behavioral indicators, proficiency levels
 *   - workforce taxonomy: industry → function → subfunction → role_family → role
 *   - organizational layers + complexity calibration
 *   - role DNA + role competency weights
 *   - capability models + competency relationship graph
 *
 * Backward-compatible: never touches existing tables; only NEW tables defined
 * in migration 20260523_competency_ontology_phase1.sql.
 */

import type { Pool } from 'pg';

export const ONTOLOGY_VERSION = '1.0.0';

// ------------------ Types ---------------------------------------------------
export interface CompetencyDomain {
  id: string; name: string; scientific_type: string; description: string;
  display_order: number; deprecated: boolean;
}
export interface CompetencyFamily {
  id: string; domain_id: string; name: string; description: string;
  display_order: number; deprecated: boolean;
}
export interface Competency {
  id: string; canonical_name: string; slug: string;
  domain_id: string; family_id: string;
  scientific_type: string; definition: string;
  trainability: 'low'|'moderate'|'high';
  stability_level: 'trait_like'|'state_like'|'dynamic';
  complexity_level: number;
  leadership_relevance: number;
  role_relevance: Record<string, unknown>;
  scoring_metadata: Record<string, unknown>;
  benchmark_metadata: Record<string, unknown>;
  legal_classification: string;
  version: string; deprecated: boolean;
  aliases?: string[];
  indicators?: { indicator: string; proficiency_level: number; display_order: number }[];
}
export interface OrganizationalLayer {
  id: string; name: string; display_order: number;
  capability_expectations: string; cognitive_complexity: string;
  behavioral_expectations: string; strategic_expectations: string;
  decision_scope: string; ambiguity_tolerance: string;
  leadership_accountability: string;
  minimum_score: number; median_score: number;
  high_performer_score: number; exceptional_score: number;
}
export interface JobRole {
  id: string; role_family_id: string; layer_id: string;
  title: string; seniority: string | null; description: string | null;
  deprecated: boolean;
}
export interface RoleDNA {
  role: JobRole;
  role_family: { id: string; name: string };
  subfunction: { id: string; name: string };
  function: { id: string; name: string };
  industry: { id: string; name: string };
  layer: OrganizationalLayer;
  profile: { id: string; version: string; is_current: boolean };
  weights: {
    competency_id: string; canonical_name: string; domain_id: string;
    family_id: string; weight: number; expected_level: number;
    rationale: string | null;
  }[];
  weight_sum: number;
}

// ------------------ Service -------------------------------------------------
export function createOntologyService(pool: Pool) {
  return {
    async listDomains(): Promise<CompetencyDomain[]> {
      const { rows } = await pool.query(
        `SELECT id, name, scientific_type, description, display_order, deprecated
         FROM onto_domains
         WHERE deprecated = FALSE
         ORDER BY display_order, name`,
      );
      return rows;
    },

    async listFamilies(domainId?: string): Promise<CompetencyFamily[]> {
      const { rows } = await pool.query(
        `SELECT id, domain_id, name, description, display_order, deprecated
         FROM onto_families
         WHERE deprecated = FALSE
           AND ($1::text IS NULL OR domain_id = $1)
         ORDER BY display_order, name`,
        [domainId ?? null],
      );
      return rows;
    },

    async listCompetencies(params: { domainId?: string; familyId?: string; search?: string }): Promise<Competency[]> {
      const { domainId, familyId, search } = params;
      const { rows } = await pool.query(
        `SELECT c.*
         FROM onto_competencies c
         WHERE c.deprecated = FALSE
           AND ($1::text IS NULL OR c.domain_id = $1)
           AND ($2::text IS NULL OR c.family_id = $2)
           AND ($3::text IS NULL OR
                c.canonical_name ILIKE '%' || $3 || '%' OR
                EXISTS (
                  SELECT 1 FROM onto_aliases a
                  WHERE a.competency_id = c.id AND a.alias ILIKE '%' || $3 || '%'
                ))
         ORDER BY c.canonical_name`,
        [domainId ?? null, familyId ?? null, search ?? null],
      );
      return rows;
    },

    async getCompetency(id: string): Promise<Competency | null> {
      const { rows } = await pool.query(
        `SELECT * FROM onto_competencies WHERE id = $1`, [id],
      );
      if (!rows.length) return null;
      const comp = rows[0] as Competency;
      const [aliases, indicators] = await Promise.all([
        pool.query(`SELECT alias FROM onto_aliases WHERE competency_id = $1 ORDER BY alias`, [id]),
        pool.query(`SELECT indicator, proficiency_level, display_order
                    FROM onto_indicators
                    WHERE competency_id = $1
                    ORDER BY proficiency_level, display_order`, [id]),
      ]);
      comp.aliases = aliases.rows.map((r: any) => r.alias);
      comp.indicators = indicators.rows;
      return comp;
    },

    async resolveAlias(rawName: string): Promise<Competency | null> {
      const norm = rawName.trim().toLowerCase();
      const { rows } = await pool.query(
        `SELECT c.*
         FROM onto_competencies c
         JOIN onto_aliases a ON a.competency_id = c.id
         WHERE c.deprecated = FALSE
           AND (LOWER(c.canonical_name) = $1 OR a.alias_normalized = $1)
         LIMIT 1`,
        [norm],
      );
      return rows[0] ?? null;
    },

    async listProficiencyLevels() {
      const { rows } = await pool.query(`SELECT * FROM onto_proficiency_levels ORDER BY level`);
      return rows;
    },

    async listLayers(): Promise<OrganizationalLayer[]> {
      const { rows } = await pool.query(
        `SELECT * FROM onto_layers ORDER BY display_order`,
      );
      return rows;
    },

    async listIndustries() {
      const { rows } = await pool.query(
        `SELECT id, name, description, display_order
         FROM onto_industries WHERE deprecated = FALSE
         ORDER BY display_order, name`,
      );
      return rows;
    },

    async listFunctions(industryId?: string) {
      const { rows } = await pool.query(
        `SELECT id, industry_id, name, description, display_order
         FROM onto_functions
         WHERE deprecated = FALSE
           AND ($1::text IS NULL OR industry_id = $1)
         ORDER BY display_order, name`,
        [industryId ?? null],
      );
      return rows;
    },

    async listSubfunctions(functionId?: string) {
      const { rows } = await pool.query(
        `SELECT id, function_id, name, description, display_order
         FROM onto_subfunctions
         WHERE deprecated = FALSE
           AND ($1::text IS NULL OR function_id = $1)
         ORDER BY display_order, name`,
        [functionId ?? null],
      );
      return rows;
    },

    async listRoleFamilies(subfunctionId?: string) {
      const { rows } = await pool.query(
        `SELECT id, subfunction_id, name, description, display_order
         FROM onto_role_families
         WHERE deprecated = FALSE
           AND ($1::text IS NULL OR subfunction_id = $1)
         ORDER BY display_order, name`,
        [subfunctionId ?? null],
      );
      return rows;
    },

    async listRoles(params: { roleFamilyId?: string; layerId?: string; industryId?: string }) {
      const { roleFamilyId, layerId, industryId } = params;
      const { rows } = await pool.query(
        `SELECT r.id, r.role_family_id, r.layer_id, r.title, r.seniority,
                r.description, r.deprecated,
                rf.name AS role_family_name,
                sf.name AS subfunction_name,
                f.name  AS function_name,
                i.id    AS industry_id,
                i.name  AS industry_name,
                l.name  AS layer_name
         FROM onto_roles r
         JOIN onto_role_families rf          ON rf.id = r.role_family_id
         JOIN onto_subfunctions sf ON sf.id = rf.subfunction_id
         JOIN onto_functions f     ON f.id  = sf.function_id
         JOIN onto_industries i              ON i.id  = f.industry_id
         JOIN onto_layers l   ON l.id  = r.layer_id
         WHERE r.deprecated = FALSE
           AND ($1::text IS NULL OR r.role_family_id = $1)
           AND ($2::text IS NULL OR r.layer_id = $2)
           AND ($3::text IS NULL OR i.id = $3)
         ORDER BY i.display_order, f.display_order, sf.display_order,
                  rf.display_order, l.display_order, r.display_order, r.title`,
        [roleFamilyId ?? null, layerId ?? null, industryId ?? null],
      );
      return rows;
    },

    async getRoleDNA(roleId: string): Promise<RoleDNA | null> {
      const role = await pool.query(
        `SELECT r.*, rf.name AS rf_name, sf.id AS sf_id, sf.name AS sf_name,
                f.id AS f_id, f.name AS f_name,
                i.id AS i_id, i.name AS i_name
         FROM onto_roles r
         JOIN onto_role_families rf          ON rf.id = r.role_family_id
         JOIN onto_subfunctions sf ON sf.id = rf.subfunction_id
         JOIN onto_functions f     ON f.id  = sf.function_id
         JOIN onto_industries i              ON i.id  = f.industry_id
         WHERE r.id = $1 AND r.deprecated = FALSE`,
        [roleId],
      );
      if (!role.rows.length) return null;
      const r = role.rows[0];

      const layerRes = await pool.query(
        `SELECT * FROM onto_layers WHERE id = $1`, [r.layer_id],
      );
      const profileRes = await pool.query(
        `SELECT id, version, is_current FROM onto_dna_profiles
         WHERE role_id = $1 AND is_current = TRUE
         ORDER BY created_at DESC LIMIT 1`,
        [roleId],
      );
      if (!profileRes.rows.length) {
        return {
          role: r, role_family: { id: r.role_family_id, name: r.rf_name },
          subfunction: { id: r.sf_id, name: r.sf_name },
          function: { id: r.f_id, name: r.f_name },
          industry: { id: r.i_id, name: r.i_name },
          layer: layerRes.rows[0],
          profile: { id: '', version: '', is_current: false },
          weights: [], weight_sum: 0,
        };
      }
      const profile = profileRes.rows[0];
      const weights = await pool.query(
        `SELECT w.competency_id, c.canonical_name, c.domain_id, c.family_id,
                w.weight::float AS weight, w.expected_level, w.rationale
         FROM onto_role_weights w
         JOIN onto_competencies c ON c.id = w.competency_id
         WHERE w.dna_profile_id = $1
         ORDER BY w.weight DESC`,
        [profile.id],
      );
      const weight_sum = weights.rows.reduce((s: number, x: any) => s + Number(x.weight), 0);
      return {
        role: r, role_family: { id: r.role_family_id, name: r.rf_name },
        subfunction: { id: r.sf_id, name: r.sf_name },
        function: { id: r.f_id, name: r.f_name },
        industry: { id: r.i_id, name: r.i_name },
        layer: layerRes.rows[0],
        profile,
        weights: weights.rows,
        weight_sum: Math.round(weight_sum * 1000) / 1000,
      };
    },

    async listRelationships(competencyId?: string) {
      const { rows } = await pool.query(
        `SELECT cr.source_id, cr.target_id, cr.relationship_type, cr.strength::float AS strength, cr.notes,
                cs.canonical_name AS source_name, ct.canonical_name AS target_name
         FROM onto_relationships cr
         JOIN onto_competencies cs ON cs.id = cr.source_id
         JOIN onto_competencies ct ON ct.id = cr.target_id
         WHERE ($1::text IS NULL OR cr.source_id = $1 OR cr.target_id = $1)
         ORDER BY cr.strength DESC`,
        [competencyId ?? null],
      );
      return rows;
    },

    async listCapabilityModels() {
      const { rows } = await pool.query(
        `SELECT * FROM onto_capability_models WHERE deprecated = FALSE ORDER BY name`,
      );
      return rows;
    },
  };
}
export type OntologyService = ReturnType<typeof createOntologyService>;
