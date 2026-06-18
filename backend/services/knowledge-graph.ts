/**
 * Knowledge Graph — Phase 5
 *
 * Generic typed-edge layer over canonical entities (institutions, qualifications,
 * certifications, skills, occupations, employers, role_families). All edges
 * carry source_authority + evidence_ref + confidence so every recommendation
 * built on top of them is explainable and auditable.
 *
 * Pure functions over the `kg_edges` table — no Express dependency.
 */

import type { Pool } from 'pg';

export type KGEntityType =
  | 'institution' | 'qualification' | 'certification'
  | 'skill' | 'occupation' | 'employer' | 'role_family';

export type KGEdgeType =
  | 'qualifies_for' | 'taught_at' | 'requires_skill' | 'recommends_skill'
  | 'transferable_to' | 'prerequisite_of' | 'progresses_to' | 'accredits'
  | 'employs_for' | 'certifies_skill' | 'adjacent_to' | 'member_of_family';

export interface KGEdge {
  id:               string;
  from_type:        KGEntityType;
  from_id:          string;
  to_type:          KGEntityType;
  to_id:            string;
  edge_type:        KGEdgeType;
  weight:           number;        // 0..1
  confidence:       number;        // 0..1
  source_authority: string | null;
  source_url:       string | null;
  evidence_ref:     Record<string, unknown>;
  dataset_version:  string | null;
  is_active:        boolean;
  created_at:       string;
  updated_at:       string;
}

export async function listEdges(
  pool: Pool,
  filter: { from_type?: KGEntityType; from_id?: string; to_type?: KGEntityType; to_id?: string; edge_type?: KGEdgeType; limit?: number },
): Promise<KGEdge[]> {
  const where: string[] = ['is_active = TRUE'];
  const params: any[] = [];
  const push = (clause: string, v: any) => { params.push(v); where.push(`${clause} $${params.length}`); };
  if (filter.from_type) push('from_type =', filter.from_type);
  if (filter.from_id)   push('from_id =',   filter.from_id);
  if (filter.to_type)   push('to_type =',   filter.to_type);
  if (filter.to_id)     push('to_id =',     filter.to_id);
  if (filter.edge_type) push('edge_type =', filter.edge_type);
  const lim = Math.min(filter.limit ?? 500, 1000);
  const r = await pool.query(
    `SELECT * FROM kg_edges WHERE ${where.join(' AND ')} ORDER BY weight DESC, confidence DESC LIMIT ${lim}`,
    params,
  );
  return r.rows as KGEdge[];
}

export async function getNeighbors(
  pool: Pool,
  fromType: KGEntityType,
  fromId: string,
  edgeTypes?: KGEdgeType[],
): Promise<KGEdge[]> {
  const params: any[] = [fromType, fromId];
  let typeClause = '';
  if (edgeTypes && edgeTypes.length) {
    typeClause = `AND edge_type = ANY($3::text[])`;
    params.push(edgeTypes);
  }
  const r = await pool.query(
    `SELECT * FROM kg_edges
      WHERE is_active AND from_type=$1 AND from_id=$2 ${typeClause}
      ORDER BY weight DESC, confidence DESC LIMIT 500`,
    params,
  );
  return r.rows as KGEdge[];
}

export async function upsertEdge(
  pool: Pool,
  edge: Omit<KGEdge, 'id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean },
): Promise<KGEdge> {
  const r = await pool.query(
    `INSERT INTO kg_edges
       (from_type, from_id, to_type, to_id, edge_type, weight, confidence,
        source_authority, source_url, evidence_ref, dataset_version, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, TRUE))
     ON CONFLICT (from_type, from_id, to_type, to_id, edge_type) DO UPDATE SET
       weight = EXCLUDED.weight,
       confidence = EXCLUDED.confidence,
       source_authority = EXCLUDED.source_authority,
       source_url = EXCLUDED.source_url,
       evidence_ref = EXCLUDED.evidence_ref,
       dataset_version = EXCLUDED.dataset_version,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING *`,
    [
      edge.from_type, edge.from_id, edge.to_type, edge.to_id, edge.edge_type,
      edge.weight, edge.confidence,
      edge.source_authority, edge.source_url,
      JSON.stringify(edge.evidence_ref || {}),
      edge.dataset_version, edge.is_active,
    ],
  );
  return r.rows[0];
}

export async function deactivateEdge(pool: Pool, id: string): Promise<boolean> {
  const r = await pool.query(`UPDATE kg_edges SET is_active=FALSE, updated_at=NOW() WHERE id=$1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
