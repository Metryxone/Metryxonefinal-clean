/**
 * Framework Intelligence — SHRM/SFIA/NICE/CFA/PMI/Pragmatic/SAFe
 * Phase 2 Scientific Competency Intelligence (v2.0.0)
 * Read-only over sci_functional_frameworks + framework_competencies + role_mappings.
 */
import type { Pool } from 'pg';

export const FRAMEWORK_INTELLIGENCE_VERSION = '2.0.0';

export function createFrameworkIntelligence(pool: Pool) {
  async function listFrameworks() {
    const { rows } = await pool.query(
      `SELECT id, code, name, authority, function_id, description, version
         FROM sci_functional_frameworks
        WHERE deleted_at IS NULL AND is_current = true
        ORDER BY code`
    );
    return rows;
  }

  async function getFramework(id: string) {
    const fw = await pool.query(
      `SELECT * FROM sci_functional_frameworks WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    if (!fw.rows[0]) return null;
    const [domains, comps] = await Promise.all([
      pool.query(
        `SELECT * FROM sci_framework_domains WHERE framework_id = $1 AND deleted_at IS NULL ORDER BY code`, [id]),
      pool.query(
        `SELECT * FROM sci_framework_competencies WHERE framework_id = $1 AND deleted_at IS NULL ORDER BY external_code`, [id]),
    ]);
    return { ...fw.rows[0], domains: domains.rows, competencies: comps.rows };
  }

  /** Resolve a framework competency by external code OR alias (case-insensitive). */
  async function resolveCompetency(text: string) {
    const t = text.trim().toLowerCase();
    if (!t) return null;
    const { rows } = await pool.query(
      `SELECT c.*, f.code AS framework_code, f.name AS framework_name
         FROM sci_framework_competencies c
         JOIN sci_functional_frameworks f ON f.id = c.framework_id
        WHERE c.deleted_at IS NULL AND f.deleted_at IS NULL
          AND (
            LOWER(c.external_code) = $1
            OR LOWER(c.name) = $1
            OR EXISTS (
              SELECT 1 FROM sci_framework_aliases a
               WHERE a.framework_competency_id = c.id AND LOWER(a.alias) = $1
            )
          )
        LIMIT 1`,
      [t]
    );
    return rows[0] ?? null;
  }

  /** Many-to-many: given an ontology competency_id, return ALL framework rows mapped to it. */
  async function mappingsForOntologyCompetency(competencyId: string) {
    const { rows } = await pool.query(
      `SELECT c.id, c.framework_id, c.external_code, c.name, c.proficiency_level,
              f.code AS framework_code, f.name AS framework_name
         FROM sci_framework_competencies c
         JOIN sci_functional_frameworks f ON f.id = c.framework_id
        WHERE c.ontology_competency_id = $1 AND c.deleted_at IS NULL AND f.deleted_at IS NULL`,
      [competencyId]
    );
    return rows;
  }

  /** Role-level framework expectations (read-only). */
  async function expectationsForRole(roleId: string, frameworkId?: string) {
    const { rows } = await pool.query(
      `SELECT m.*, c.external_code, c.name, c.ontology_competency_id, f.code AS framework_code
         FROM sci_framework_role_mappings m
         JOIN sci_framework_competencies c ON c.id = m.framework_competency_id
         JOIN sci_functional_frameworks f ON f.id = m.framework_id
        WHERE m.role_id = $1
          ${frameworkId ? `AND m.framework_id = $2` : ''}
          AND c.deleted_at IS NULL AND f.deleted_at IS NULL
        ORDER BY m.weight DESC`,
      frameworkId ? [roleId, frameworkId] : [roleId]
    );
    return rows;
  }

  /** Score a user's competency vector through a framework lens (uses ontology mapping). */
  async function scoreThroughFramework(frameworkId: string, scores: Record<string, number>) {
    const { rows: comps } = await pool.query(
      `SELECT id, external_code, name, ontology_competency_id, proficiency_level
         FROM sci_framework_competencies
        WHERE framework_id = $1 AND deleted_at IS NULL AND ontology_competency_id IS NOT NULL`,
      [frameworkId]
    );
    const items = comps.map((c: any) => ({
      framework_competency_id: c.id,
      external_code: c.external_code,
      name: c.name,
      ontology_competency_id: c.ontology_competency_id,
      mapped_score: scores[c.ontology_competency_id] ?? null,
      proficiency_level: c.proficiency_level,
    }));
    const valid = items.filter(i => typeof i.mapped_score === 'number');
    const coverage = comps.length === 0 ? 0 : valid.length / comps.length;
    const avg = valid.length === 0 ? null
      : valid.reduce((s, i) => s + (i.mapped_score as number), 0) / valid.length;
    return { framework_id: frameworkId, items, coverage: +coverage.toFixed(3), average_score: avg };
  }

  return {
    listFrameworks,
    getFramework,
    resolveCompetency,
    mappingsForOntologyCompetency,
    expectationsForRole,
    scoreThroughFramework,
  };
}
