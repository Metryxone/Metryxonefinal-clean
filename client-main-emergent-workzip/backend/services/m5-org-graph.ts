import type { Pool } from 'pg';

export const ORG_GRAPH_VERSION = '5.0.0';

export function createOrgGraph(pool: Pool) {
  async function nodes(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_graph_nodes WHERE org_id=$1 ORDER BY node_type, label`, [orgId]);
    return r.rows;
  }

  async function relationships(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_organizational_relationships WHERE org_id=$1`, [orgId]);
    return r.rows;
  }

  async function departmentGraph(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_department_relationship_graph WHERE org_id=$1 ORDER BY collaboration_strength DESC`,
      [orgId]);
    return r.rows;
  }

  async function leadershipInfluence(orgId: string) {
    const r = await pool.query(
      `SELECT * FROM m5_leadership_influence_graph WHERE org_id=$1 ORDER BY influence_score DESC`,
      [orgId]);
    return r.rows;
  }

  // Capability concentration risk: if collaboration ties concentrate ≥40% on a single dept,
  // organizational capability is concentrated → fragility risk.
  async function concentrationRisk(orgId: string) {
    const edges = await departmentGraph(orgId);
    if (!edges.length) return { org_id: orgId, concentration_index: 0, fragile_nodes: [] };
    const weight: Record<string, number> = {};
    for (const e of edges) {
      const w = +e.collaboration_strength;
      weight[e.dept_a] = (weight[e.dept_a] ?? 0) + w;
      weight[e.dept_b] = (weight[e.dept_b] ?? 0) + w;
    }
    const total = Object.values(weight).reduce((s, x) => s + x, 0) || 1;
    const shares = Object.entries(weight)
      .map(([dept, w]) => ({ dept, share: +(w / total).toFixed(3) }))
      .sort((a, b) => b.share - a.share);
    const concentration = shares.length ? +(shares[0].share).toFixed(3) : 0;
    const fragile = shares.filter(s => s.share >= 0.40).map(s => s.dept);
    return { org_id: orgId, concentration_index: concentration, dept_shares: shares, fragile_nodes: fragile };
  }

  return { nodes, relationships, departmentGraph, leadershipInfluence, concentrationRisk };
}
