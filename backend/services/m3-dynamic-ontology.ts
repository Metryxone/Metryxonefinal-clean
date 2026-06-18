/**
 * Phase 3 — Dynamic Ontology Engine (v3.0.0)
 *
 * Read/promote candidates from m3_emerging_role_candidates and
 * m3_emerging_skill_candidates. NEVER auto-writes to onto_* tables —
 * proposes change events into m3_ontology_evolution_events for governance review.
 */
import type { Pool } from 'pg';
export const DYNAMIC_ONTOLOGY_VERSION = '3.0.0';

export function createDynamicOntology(pool: Pool) {
  async function emergingRoles(threshold = 70) {
    return (await pool.query(
      `SELECT * FROM m3_emerging_role_candidates WHERE emergence_score >= $1 ORDER BY emergence_score DESC`,
      [threshold])).rows;
  }
  async function emergingSkills(threshold = 70) {
    return (await pool.query(
      `SELECT * FROM m3_emerging_skill_candidates WHERE emergence_score >= $1 ORDER BY emergence_score DESC`,
      [threshold])).rows;
  }
  async function deprecated() {
    return (await pool.query(`SELECT * FROM m3_deprecated_competencies ORDER BY deprecated_at DESC`)).rows;
  }
  async function events() {
    return (await pool.query(`SELECT * FROM m3_ontology_evolution_events ORDER BY detected_at DESC LIMIT 200`)).rows;
  }

  /** Propose an ontology evolution event (does NOT touch onto_*). */
  async function proposeEvent(input: { event_type: string; target_id?: string; payload?: any; actor?: string }) {
    const id = `moee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
    await pool.query(
      `INSERT INTO m3_ontology_evolution_events(id, event_type, target_id, payload, approved)
       VALUES ($1,$2,$3,$4,false)`,
      [id, input.event_type, input.target_id ?? null, JSON.stringify(input.payload ?? {})]);
    const auditId = `moca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
    await pool.query(
      `INSERT INTO m3_ontology_change_audits(id, event_id, actor, action, before, after)
       VALUES ($1,$2,$3,'propose',NULL,$4)`,
      [auditId, id, input.actor ?? 'system', JSON.stringify(input.payload ?? {})]);
    return { event_id: id, audit_id: auditId };
  }

  /** Mark a candidate as under-review. Promotion to onto_* is a separate manual governance step. */
  async function reviewCandidate(kind: 'role' | 'skill', id: string, status: 'under_review' | 'promoted' | 'rejected') {
    const table = kind === 'role' ? 'm3_emerging_role_candidates' : 'm3_emerging_skill_candidates';
    await pool.query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [status, id]);
    return { id, status };
  }

  return { emergingRoles, emergingSkills, deprecated, events, proposeEvent, reviewCandidate };
}
