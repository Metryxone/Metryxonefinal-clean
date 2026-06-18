/**
 * Skill Graph — Phase 5
 *
 * Pure-function helpers around `skill_adjacency`, `inferred_skills`, and
 * `skill_proficiency_levels`. Every returned suggestion carries its basis
 * + confidence + source_authority so the UI can render "why".
 */

import type { Pool } from 'pg';

export interface AdjacentSkill {
  skill_id:         string;
  canonical_name:   string;
  similarity:       number;
  transferability:  number;
  basis:            string;
  source_authority: string | null;
  evidence_ref:     Record<string, unknown>;
}

export interface InferredSkill {
  skill_id:         string;
  canonical_name:   string;
  inference_basis:  string;
  confidence:       number;
  source_authority: string | null;
}

export async function getAdjacentSkills(pool: Pool, skillId: string, limit = 20): Promise<AdjacentSkill[]> {
  const r = await pool.query(
    `SELECT sa.to_skill_id AS skill_id, s.canonical_name,
            sa.similarity::float, sa.transferability::float, sa.basis,
            sa.source_authority, sa.evidence_ref
       FROM skill_adjacency sa
       JOIN skills s ON s.id = sa.to_skill_id
      WHERE sa.is_active AND sa.from_skill_id = $1
      ORDER BY sa.transferability DESC, sa.similarity DESC
      LIMIT ${Math.min(limit, 100)}`,
    [skillId],
  );
  return r.rows;
}

export async function getInferredSkills(pool: Pool, skillIds: string[]): Promise<InferredSkill[]> {
  if (!skillIds.length) return [];
  const r = await pool.query(
    `SELECT DISTINCT ON (i.inferred_skill_id)
            i.inferred_skill_id AS skill_id, s.canonical_name,
            i.inference_basis, i.confidence::float, i.source_authority
       FROM inferred_skills i
       JOIN skills s ON s.id = i.inferred_skill_id
      WHERE i.is_active AND i.subject_skill_id = ANY($1::uuid[])
      ORDER BY i.inferred_skill_id, i.confidence DESC`,
    [skillIds],
  );
  return r.rows;
}

/**
 * Expand a user's declared skills with inferred ones. Returns the original
 * set unchanged plus inferred additions (with weight discounted by inference
 * confidence so they never count as much as declared skills).
 */
export interface ExpandedSkill {
  skill_id:        string;
  canonical_name:  string;
  source:          'declared' | 'inferred';
  weight:          number;             // 1.0 declared, ≤1.0 inferred
  inference_basis?: string;
  confidence?:     number;
}

export async function expandSkillSet(pool: Pool, declared: { id: string; canonical_name: string }[]): Promise<ExpandedSkill[]> {
  const declaredSet = new Set(declared.map(s => s.id));
  const out: ExpandedSkill[] = declared.map(s => ({
    skill_id: s.id, canonical_name: s.canonical_name, source: 'declared', weight: 1.0,
  }));
  const inferred = await getInferredSkills(pool, declared.map(s => s.id));
  for (const inf of inferred) {
    if (declaredSet.has(inf.skill_id)) continue;
    out.push({
      skill_id: inf.skill_id, canonical_name: inf.canonical_name,
      source: 'inferred', weight: inf.confidence,
      inference_basis: inf.inference_basis, confidence: inf.confidence,
    });
  }
  return out;
}

export async function getProficiencyLevel(pool: Pool, skillId: string, level: number) {
  const r = await pool.query(
    `SELECT level, descriptor, indicators FROM skill_proficiency_levels
      WHERE skill_id=$1 AND level=$2`, [skillId, level],
  );
  return r.rows[0] || null;
}
