/**
 * Career Graph Engine — in-memory adjacency list + BFS/Dijkstra traversal.
 * Never throws; always returns degraded output with confidence field.
 * Table refs: cg_roles, cg_role_edges, cg_tracks, cg_track_waypoints
 */

import type { Pool } from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CgRole {
  id: number;
  role_key: string;
  title: string;
  seniority: string;
  function_area: string;
  industry_tags: string[];
  avg_salary_inr: number | null;
  demand_score: number;
  automation_risk: number;
  growth_30mo: number;
  is_active: boolean;
}

export interface CgEdge {
  id: number;
  from_role_id: number;
  to_role_id: number;
  edge_type: string;
  transition_probability: number;
  avg_months_transition: number;
  difficulty: string;
}

export interface CgTrack {
  id: number;
  track_key: string;
  name: string;
  description: string | null;
  function_area: string;
  estimated_years: number;
  waypoints: Array<{ role_id: number; role_key: string; title: string; seniority: string; step_order: number; is_optional: boolean }>;
}

export interface GraphNeighbour {
  role: CgRole;
  edge_type: string;
  avg_months_transition: number;
  transition_probability: number;
  direction: 'forward' | 'backward';
}

export interface DijkstraPath {
  from_role_id: number;
  to_role_id: number;
  hop_count: number;
  path_role_ids: number[];
  edge_types: string[];
  total_months: number;
  total_cost: number;
}

// ── In-memory graph cache (30-min TTL) ────────────────────────────────────

export interface GraphCache {
  roles: Map<number, CgRole>;
  rolesByKey: Map<string, CgRole>;
  edges: CgEdge[];
  adjacency: Map<number, CgEdge[]>;   // from → edges
  reverseAdj: Map<number, CgEdge[]>;  // to → edges
  builtAt: number;
}

let cache: GraphCache | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isCacheValid(): boolean {
  return !!cache && Date.now() - cache.builtAt < CACHE_TTL_MS;
}

export async function buildGraphCache(pool: Pool): Promise<GraphCache> {
  if (isCacheValid()) return cache!;

  try {
    const [rolesRes, edgesRes] = await Promise.all([
      pool.query<CgRole>(`
        SELECT id, role_key, title, seniority, function_area, industry_tags,
               avg_salary_inr, demand_score::float, automation_risk::float,
               growth_30mo::float, is_active
        FROM cg_roles WHERE is_active = true ORDER BY id
      `),
      pool.query<CgEdge>(`
        SELECT id, from_role_id, to_role_id, edge_type,
               transition_probability::float, avg_months_transition, difficulty
        FROM cg_role_edges ORDER BY id
      `),
    ]);

    const roles = new Map<number, CgRole>();
    const rolesByKey = new Map<string, CgRole>();
    const adjacency = new Map<number, CgEdge[]>();
    const reverseAdj = new Map<number, CgEdge[]>();

    for (const r of rolesRes.rows) {
      roles.set(r.id, r);
      rolesByKey.set(r.role_key, r);
    }
    for (const e of edgesRes.rows) {
      if (!adjacency.has(e.from_role_id)) adjacency.set(e.from_role_id, []);
      adjacency.get(e.from_role_id)!.push(e);
      if (!reverseAdj.has(e.to_role_id)) reverseAdj.set(e.to_role_id, []);
      reverseAdj.get(e.to_role_id)!.push(e);
    }

    cache = { roles, rolesByKey, edges: edgesRes.rows, adjacency, reverseAdj, builtAt: Date.now() };
    return cache;
  } catch {
    // Return empty cache on error — never throw
    return {
      roles: new Map(), rolesByKey: new Map(), edges: [],
      adjacency: new Map(), reverseAdj: new Map(), builtAt: Date.now(),
    };
  }
}

export function invalidateGraphCache(): void {
  cache = null;
}

// ── BFS reachability (up to maxHops) ──────────────────────────────────────

export function bfsReachable(
  g: GraphCache,
  fromId: number,
  maxHops = 3
): Set<number> {
  const visited = new Set<number>([fromId]);
  let frontier = [fromId];
  for (let hop = 0; hop < maxHops; hop++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const e of g.adjacency.get(id) ?? []) {
        if (!visited.has(e.to_role_id)) {
          visited.add(e.to_role_id);
          next.push(e.to_role_id);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  visited.delete(fromId);
  return visited;
}

// ── Dijkstra optimal path ─────────────────────────────────────────────────
// cost = difficulty_multiplier × avg_months (hard paths cost proportionally more)

function difficultyMultiplier(d: string): number {
  return d === 'easy' ? 0.7 : d === 'hard' ? 1.5 : 1.0; // medium = 1.0
}

export function dijkstra(
  g: GraphCache,
  fromId: number,
  toId: number,
  maxHops = 4
): DijkstraPath | null {
  if (fromId === toId) return null;

  // dist[id] = { cost, months, hops, path, edgeTypes }
  type State = { cost: number; months: number; hops: number; path: number[]; edgeTypes: string[] };
  const dist = new Map<number, State>();
  dist.set(fromId, { cost: 0, months: 0, hops: 0, path: [fromId], edgeTypes: [] });

  // Simple priority queue using sorted array (graph is small < 300 nodes)
  const queue: Array<{ id: number } & State> = [{ id: fromId, cost: 0, months: 0, hops: 0, path: [fromId], edgeTypes: [] }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    if (cur.hops > maxHops) continue;
    if (cur.id === toId) {
      return {
        from_role_id: fromId,
        to_role_id: toId,
        hop_count: cur.hops,
        path_role_ids: cur.path,
        edge_types: cur.edgeTypes,
        total_months: cur.months,
        total_cost: cur.cost,
      };
    }
    const curBest = dist.get(cur.id);
    if (curBest && curBest.cost < cur.cost) continue; // stale

    for (const e of g.adjacency.get(cur.id) ?? []) {
      const edgeCost = difficultyMultiplier(e.difficulty) * e.avg_months_transition;
      const newCost = cur.cost + edgeCost;
      const existing = dist.get(e.to_role_id);
      if (!existing || newCost < existing.cost) {
        const newState = {
          cost: newCost,
          months: cur.months + e.avg_months_transition,
          hops: cur.hops + 1,
          path: [...cur.path, e.to_role_id],
          edgeTypes: [...cur.edgeTypes, e.edge_type],
        };
        dist.set(e.to_role_id, newState);
        queue.push({ id: e.to_role_id, ...newState });
      }
    }
  }
  return null; // unreachable
}

// ── Quick-win finder (readiness ≥ 70 within 1-hop) ────────────────────────

export function findQuickWins(
  g: GraphCache,
  fromId: number,
  readinessMap: Map<number, number> // roleId → readiness score
): CgRole[] {
  const out: CgRole[] = [];
  for (const e of g.adjacency.get(fromId) ?? []) {
    if (e.edge_type === 'promotion' || e.edge_type === 'lateral') {
      const role = g.roles.get(e.to_role_id);
      if (!role) continue;
      const readiness = readinessMap.get(e.to_role_id) ?? 0;
      if (readiness >= 70) out.push(role);
    }
  }
  return out;
}

// ── Stretch goal finder (2–3 hops away) ───────────────────────────────────

export function findStretchGoals(g: GraphCache, fromId: number): CgRole[] {
  // BFS 2-3 hops
  const hop1 = new Set<number>();
  for (const e of g.adjacency.get(fromId) ?? []) hop1.add(e.to_role_id);

  const hop2 = new Set<number>();
  for (const id of hop1) {
    for (const e of g.adjacency.get(id) ?? []) {
      if (!hop1.has(e.to_role_id) && e.to_role_id !== fromId) hop2.add(e.to_role_id);
    }
  }

  const hop3 = new Set<number>();
  for (const id of hop2) {
    for (const e of g.adjacency.get(id) ?? []) {
      if (!hop1.has(e.to_role_id) && !hop2.has(e.to_role_id) && e.to_role_id !== fromId) hop3.add(e.to_role_id);
    }
  }

  const stretchIds = new Set([...hop2, ...hop3]);
  return [...stretchIds].map(id => g.roles.get(id)).filter(Boolean) as CgRole[];
}

// ── Track membership lookup ────────────────────────────────────────────────

export async function findTracksForRole(pool: Pool, roleId: number): Promise<CgTrack[]> {
  try {
    const r = await pool.query(`
      SELECT t.id, t.track_key, t.name, t.description, t.function_area, t.estimated_years,
             w.step_order, w.is_optional, r.id AS wrid, r.role_key AS wrrk, r.title AS wrt, r.seniority AS wrs
      FROM cg_tracks t
      JOIN cg_track_waypoints w ON w.track_id = t.id
      JOIN cg_roles r ON r.id = w.role_id
      WHERE t.id IN (
        SELECT track_id FROM cg_track_waypoints WHERE role_id = $1
      ) AND t.is_active = true
      ORDER BY t.id, w.step_order
    `, [roleId]);

    const trackMap = new Map<number, CgTrack>();
    for (const row of r.rows) {
      if (!trackMap.has(row.id)) {
        trackMap.set(row.id, {
          id: row.id, track_key: row.track_key, name: row.name,
          description: row.description, function_area: row.function_area,
          estimated_years: row.estimated_years, waypoints: [],
        });
      }
      trackMap.get(row.id)!.waypoints.push({
        role_id: row.wrid, role_key: row.wrrk, title: row.wrt,
        seniority: row.wrs, step_order: row.step_order, is_optional: row.is_optional,
      });
    }
    return [...trackMap.values()];
  } catch { return []; }
}

// ── Public: get role by key or id ─────────────────────────────────────────

export async function getRoleByKey(pool: Pool, roleKey: string): Promise<CgRole | null> {
  const g = await buildGraphCache(pool);
  return g.rolesByKey.get(roleKey) ?? null;
}

export async function getRoleById(pool: Pool, roleId: number): Promise<CgRole | null> {
  const g = await buildGraphCache(pool);
  return g.roles.get(roleId) ?? null;
}

// ── Public: list roles (paginated) ────────────────────────────────────────

export async function listRoles(
  pool: Pool,
  opts: { function_area?: string; seniority?: string; industry?: string; limit?: number; offset?: number }
): Promise<{ roles: CgRole[]; total: number }> {
  try {
    const conds: string[] = ['is_active = true'];
    const params: unknown[] = [];
    let i = 1;
    if (opts.function_area) { conds.push(`function_area = $${i++}`); params.push(opts.function_area); }
    if (opts.seniority)     { conds.push(`seniority = $${i++}`);     params.push(opts.seniority); }
    if (opts.industry)      { conds.push(`$${i++} = ANY(industry_tags)`); params.push(opts.industry); }
    const where = `WHERE ${conds.join(' AND ')}`;
    const limit  = Math.min(opts.limit  ?? 50, 200);
    const offset = opts.offset ?? 0;

    const [data, cnt] = await Promise.all([
      pool.query(
        `SELECT id, role_key, title, seniority, function_area, industry_tags,
                avg_salary_inr, demand_score::float, automation_risk::float, growth_30mo::float, is_active
         FROM cg_roles ${where} ORDER BY function_area, seniority, title
         LIMIT $${i++} OFFSET $${i}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS n FROM cg_roles ${where}`, params),
    ]);
    return { roles: data.rows, total: Number(cnt.rows[0]?.n ?? 0) };
  } catch { return { roles: [], total: 0 }; }
}

// ── Public: get neighbours ────────────────────────────────────────────────

export async function getNeighbours(pool: Pool, roleId: number): Promise<GraphNeighbour[]> {
  const g = await buildGraphCache(pool);
  const out: GraphNeighbour[] = [];

  for (const e of [...(g.adjacency.get(roleId) ?? []), ...(g.reverseAdj.get(roleId) ?? [])]) {
    const neighbourId = e.from_role_id === roleId ? e.to_role_id : e.from_role_id;
    const role = g.roles.get(neighbourId);
    if (!role) continue;
    out.push({
      role,
      edge_type: e.edge_type,
      avg_months_transition: e.avg_months_transition,
      transition_probability: e.transition_probability,
      direction: e.from_role_id === roleId ? 'forward' : 'backward',
    });
  }

  // Deduplicate (forward wins)
  const seen = new Map<number, GraphNeighbour>();
  for (const n of out) {
    const existing = seen.get(n.role.id);
    if (!existing || n.direction === 'forward') seen.set(n.role.id, n);
  }

  return [...seen.values()].sort((a, b) => b.transition_probability - a.transition_probability).slice(0, 30);
}

// ── Public: get Dijkstra paths ────────────────────────────────────────────

export async function getPaths(
  pool: Pool,
  fromRoleId: number,
  toRoleId: number
): Promise<DijkstraPath[]> {
  const g = await buildGraphCache(pool);
  const path = dijkstra(g, fromRoleId, toRoleId);
  return path ? [path] : [];
}

// ── Public: list all tracks with waypoints ────────────────────────────────

export async function listTracks(pool: Pool): Promise<CgTrack[]> {
  try {
    const r = await pool.query(`
      SELECT t.id, t.track_key, t.name, t.description, t.function_area, t.estimated_years,
             w.step_order, w.is_optional,
             r.id AS wrid, r.role_key AS wrrk, r.title AS wrt, r.seniority AS wrs
      FROM cg_tracks t
      LEFT JOIN cg_track_waypoints w ON w.track_id = t.id
      LEFT JOIN cg_roles r ON r.id = w.role_id
      WHERE t.is_active = true
      ORDER BY t.id, w.step_order
    `);
    const trackMap = new Map<number, CgTrack>();
    for (const row of r.rows) {
      if (!trackMap.has(row.id)) {
        trackMap.set(row.id, {
          id: row.id, track_key: row.track_key, name: row.name,
          description: row.description, function_area: row.function_area,
          estimated_years: row.estimated_years, waypoints: [],
        });
      }
      if (row.wrid) {
        trackMap.get(row.id)!.waypoints.push({
          role_id: row.wrid, role_key: row.wrrk, title: row.wrt,
          seniority: row.wrs, step_order: row.step_order, is_optional: row.is_optional,
        });
      }
    }
    return [...trackMap.values()];
  } catch { return []; }
}
