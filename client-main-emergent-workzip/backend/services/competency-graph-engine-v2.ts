/**
 * Competency Graph Engine V2 — builds and queries graph relationships
 * between competencies, roles, pathways, readiness states, capabilities.
 * Backed by competency_graph_nodes + competency_graph_edges.
 */
import type { Pool } from 'pg';

export const COMPETENCY_GRAPH_VERSION = '4.0.0';

export type NodeKind = 'competency' | 'role' | 'pathway' | 'readiness' | 'capability';
export type EdgeKind = 'requires' | 'enables' | 'adjacent' | 'develops_into' | 'gap_for';

export type GraphNode = { id: string; node_kind: NodeKind; node_key: string; label: string | null; attrs: Record<string, unknown> };
export type GraphEdge = { id: string; from_node: string; to_node: string; edge_kind: EdgeKind; weight: number; attrs: Record<string, unknown> };

export async function upsertNode(pool: Pool, node: { kind: NodeKind; key: string; label?: string; attrs?: Record<string, unknown> }): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO competency_graph_nodes (node_kind, node_key, label, attrs)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (node_kind, node_key) DO UPDATE SET label = COALESCE(EXCLUDED.label, competency_graph_nodes.label), attrs = competency_graph_nodes.attrs || EXCLUDED.attrs
     RETURNING id`,
    [node.kind, node.key, node.label ?? null, JSON.stringify(node.attrs ?? {})],
  );
  return r.rows[0].id;
}

export async function upsertEdge(pool: Pool, edge: { fromId: string; toId: string; kind: EdgeKind; weight?: number; attrs?: Record<string, unknown> }): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO competency_graph_edges (from_node, to_node, edge_kind, weight, attrs)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (from_node, to_node, edge_kind) DO UPDATE SET weight = EXCLUDED.weight, attrs = competency_graph_edges.attrs || EXCLUDED.attrs
     RETURNING id`,
    [edge.fromId, edge.toId, edge.kind, edge.weight ?? 1.0, JSON.stringify(edge.attrs ?? {})],
  );
  return r.rows[0].id;
}

export async function getNeighbors(pool: Pool, opts: { nodeKind: NodeKind; nodeKey: string; edgeKind?: EdgeKind; limit?: number }): Promise<Array<GraphNode & { edge_kind: EdgeKind; weight: number }>> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 25));
  const params: unknown[] = [opts.nodeKind, opts.nodeKey, limit];
  let edgeFilter = '';
  if (opts.edgeKind) { params.splice(2, 0, opts.edgeKind); edgeFilter = 'AND e.edge_kind = $3'; }
  const limitIdx = params.length;
  try {
    const r = await pool.query(
      `SELECT n2.id, n2.node_kind, n2.node_key, n2.label, n2.attrs, e.edge_kind, e.weight
       FROM competency_graph_nodes n1
       JOIN competency_graph_edges e ON e.from_node = n1.id
       JOIN competency_graph_nodes n2 ON n2.id = e.to_node
       WHERE n1.node_kind = $1 AND n1.node_key = $2 ${edgeFilter}
       ORDER BY e.weight DESC LIMIT $${limitIdx}`,
      params,
    );
    return r.rows as never;
  } catch {
    return [];
  }
}

export async function snapshotStats(pool: Pool): Promise<{ nodes: number; edges: number; by_kind: Record<string, number> }> {
  try {
    const [n, e, k] = await Promise.all([
      pool.query<{ c: string }>('SELECT COUNT(*)::text c FROM competency_graph_nodes'),
      pool.query<{ c: string }>('SELECT COUNT(*)::text c FROM competency_graph_edges'),
      pool.query<{ node_kind: string; c: string }>('SELECT node_kind, COUNT(*)::text c FROM competency_graph_nodes GROUP BY node_kind'),
    ]);
    const byKind: Record<string, number> = {};
    for (const row of k.rows) byKind[row.node_kind] = Number(row.c);
    return { nodes: Number(n.rows[0].c), edges: Number(e.rows[0].c), by_kind: byKind };
  } catch {
    return { nodes: 0, edges: 0, by_kind: {} };
  }
}

/** Bootstrap canonical 7-domain competency nodes if graph is empty. */
export async function seedCanonicalCompetencies(pool: Pool): Promise<number> {
  const CANON = [
    { key: 'COG', label: 'Cognitive Reasoning' },
    { key: 'COM', label: 'Communication' },
    { key: 'LEA', label: 'Leadership' },
    { key: 'EXE', label: 'Execution' },
    { key: 'ADP', label: 'Adaptability' },
    { key: 'TEC', label: 'Technical Mastery' },
    { key: 'EIQ', label: 'Emotional Intelligence' },
  ];
  let count = 0;
  for (const c of CANON) {
    try { await upsertNode(pool, { kind: 'competency', key: c.key, label: c.label, attrs: { canonical: true } }); count++; } catch { /* ignore */ }
  }
  return count;
}
