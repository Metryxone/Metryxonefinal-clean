/**
 * VX-D1 — Workforce Knowledge Graph
 * wkg_nodes / wkg_edges — typed nodes + named relationships.
 * Node types: Industry/Dept/Role/RoleFamily/Capability/Competency/Concern/Signal/
 *             Assessment/LearningAsset/Certification/CareerPath/FutureSkill/Outcome
 * Relationships: HAS_ROLE/BELONGS_TO/HAS_CAPABILITY/HAS_COMPETENCY/HAS_CONCERN/
 *                HAS_SIGNAL/REQUIRES/RELATED_TO/NEXT_ROLE/SUPPORTED_BY/FUTURE_OF/PREDICTS
 * Flag-gated FF_CAREER_GRAPH=1. Never-throws. Read-only graph. Additive.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 300_000;
const gc = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < TTL ? e.data as T : null; };
const sc = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });
const bc = () => cache.clear();

export const WKG_NODE_TYPES = ['Industry', 'Department', 'Role', 'RoleFamily', 'Capability', 'Competency', 'Concern', 'Signal', 'Assessment', 'LearningAsset', 'Certification', 'CareerPath', 'FutureSkill', 'Outcome'] as const;
export const WKG_RELATIONSHIP_TYPES = ['HAS_ROLE', 'BELONGS_TO', 'HAS_CAPABILITY', 'HAS_COMPETENCY', 'HAS_CONCERN', 'HAS_SIGNAL', 'REQUIRES', 'RELATED_TO', 'NEXT_ROLE', 'NEXT_SKILL', 'SUPPORTED_BY', 'FUTURE_OF', 'PREDICTS', 'ASSESSED_BY', 'DEVELOPS_VIA'] as const;

let ready = false;
async function ensureSchema(pool: Pool) {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wkg_nodes (
      id SERIAL PRIMARY KEY,
      node_type TEXT NOT NULL,
      node_key TEXT NOT NULL,
      node_label TEXT NOT NULL,
      description TEXT,
      properties JSONB DEFAULT '{}',
      source_table TEXT,
      source_id TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(node_type, node_key)
    );
    CREATE TABLE IF NOT EXISTS wkg_edges (
      id SERIAL PRIMARY KEY,
      from_node_id INTEGER NOT NULL REFERENCES wkg_nodes(id) ON DELETE CASCADE,
      to_node_id INTEGER NOT NULL REFERENCES wkg_nodes(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      weight NUMERIC(5,4) DEFAULT 1.0,
      confidence NUMERIC(5,4) DEFAULT 1.0,
      properties JSONB DEFAULT '{}',
      source TEXT DEFAULT 'curated',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(from_node_id, to_node_id, relationship_type)
    );
    CREATE INDEX IF NOT EXISTS idx_wkg_nodes_type ON wkg_nodes(node_type);
    CREATE INDEX IF NOT EXISTS idx_wkg_nodes_key ON wkg_nodes(node_key);
    CREATE INDEX IF NOT EXISTS idx_wkg_edges_from ON wkg_edges(from_node_id);
    CREATE INDEX IF NOT EXISTS idx_wkg_edges_to ON wkg_edges(to_node_id);
    CREATE INDEX IF NOT EXISTS idx_wkg_edges_rel ON wkg_edges(relationship_type);
  `);
  ready = true;
}

async function materializeFromTalentTables(pool: Pool): Promise<{ nodes: number; edges: number }> {
  let nodesCreated = 0; let edgesCreated = 0;

  const upsertNode = async (node_type: string, node_key: string, node_label: string, properties: Record<string, unknown> = {}, source_table = '', source_id = ''): Promise<number | null> => {
    const row = await pool.query('INSERT INTO wkg_nodes(node_type,node_key,node_label,properties,source_table,source_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(node_type,node_key) DO UPDATE SET node_label=EXCLUDED.node_label,properties=EXCLUDED.properties,updated_at=NOW() RETURNING id', [node_type, node_key, node_label, JSON.stringify(properties), source_table, source_id]).catch(() => null);
    if (row?.rows[0]) nodesCreated++;
    return row?.rows[0]?.id || null;
  };

  const upsertEdge = async (fromId: number, toId: number, rel: string, weight = 1.0): Promise<void> => {
    const r = await pool.query('INSERT INTO wkg_edges(from_node_id,to_node_id,relationship_type,weight) VALUES($1,$2,$3,$4) ON CONFLICT(from_node_id,to_node_id,relationship_type) DO NOTHING RETURNING id', [fromId, toId, rel, weight]).catch(() => null);
    if (r?.rows[0]) edgesCreated++;
  };

  // Materialize Capabilities
  const caps = await pool.query('SELECT capability_code, capability_name, cluster_code, automation_risk_level FROM capability_master WHERE is_active=true').catch(() => ({ rows: [] }));
  const capIds: Record<string, number> = {};
  for (const c of caps.rows) { const id = await upsertNode('Capability', c.capability_code, c.capability_name, { cluster: c.cluster_code, automation_risk: c.automation_risk_level }, 'capability_master', c.capability_code); if (id) capIds[c.capability_code] = id; }

  // Materialize Role Families
  const rfs = await pool.query('SELECT id, family_code, family_name FROM talent_role_families').catch(() => ({ rows: [] }));
  const rfIds: Record<string, number> = {};
  for (const rf of rfs.rows) { const id = await upsertNode('RoleFamily', rf.family_code, rf.family_name, {}, 'talent_role_families', String(rf.id)); if (id) rfIds[rf.family_code] = id; }

  // Materialize Competencies
  const comps = await pool.query('SELECT competency_code, competency_name, blueprint_key, future_relevance FROM competency_dna_master').catch(() => ({ rows: [] }));
  const compIds: Record<string, number> = {};
  for (const c of comps.rows) { const id = await upsertNode('Competency', c.competency_code, c.competency_name, { blueprint: c.blueprint_key, future_relevance: c.future_relevance }, 'competency_dna_master', c.competency_code); if (id) compIds[c.competency_code] = id; }

  // Materialize Concerns
  const concerns = await pool.query('SELECT concern_key, concern_name, competency_code, severity_level FROM talent_concern_master WHERE is_active=true').catch(() => ({ rows: [] }));
  const concernIds: Record<string, number> = {};
  for (const c of concerns.rows) { const id = await upsertNode('Concern', c.concern_key, c.concern_name, { severity: c.severity_level }, 'talent_concern_master', c.concern_key); if (id) concernIds[c.concern_key] = id; }

  // Materialize Signals
  const sigs = await pool.query('SELECT signal_key, signal_name, signal_category, signal_type FROM talent_signal_master WHERE is_active=true LIMIT 100').catch(() => ({ rows: [] }));
  const sigIds: Record<string, number> = {};
  for (const s of sigs.rows) { const id = await upsertNode('Signal', s.signal_key, s.signal_name, { category: s.signal_category, type: s.signal_type }, 'talent_signal_master', s.signal_key); if (id) sigIds[s.signal_key] = id; }

  // Materialize Capability→Competency edges (HAS_COMPETENCY via blueprint)
  for (const comp of comps.rows) {
    const compId = compIds[comp.competency_code];
    if (!compId) continue;
    // Link to role families via blueprint_key
    for (const [rfKey, rfId] of Object.entries(rfIds)) {
      if (rfKey === comp.blueprint_key) await upsertEdge(rfId, compId, 'HAS_COMPETENCY', 0.9);
    }
  }

  // Competency→Concern edges (HAS_CONCERN)
  for (const c of concerns.rows) {
    const concernId = concernIds[c.concern_key];
    const compId = compIds[c.competency_code];
    if (concernId && compId) await upsertEdge(compId, concernId, 'HAS_CONCERN', 0.85);
  }

  // Capability dependency edges (REQUIRES)
  const deps = await pool.query('SELECT from_capability, to_capability, dependency_type, strength FROM capability_dependency_master').catch(() => ({ rows: [] }));
  for (const d of deps.rows) {
    const fromId = capIds[d.from_capability]; const toId = capIds[d.to_capability];
    if (fromId && toId) await upsertEdge(fromId, toId, d.dependency_type === 'prerequisite' ? 'REQUIRES' : 'RELATED_TO', Number(d.strength));
  }

  // Future skill nodes from future_demand_master
  const future = await pool.query('SELECT DISTINCT skill_name, role_family_key, disruption_risk FROM future_demand_master LIMIT 20').catch(() => ({ rows: [] }));
  const futureIds: Record<string, number> = {};
  for (const f of future.rows) { const id = await upsertNode('FutureSkill', `FS_${f.skill_name.replace(/\s+/g, '_').toUpperCase().slice(0, 20)}`, f.skill_name, { disruption_risk: f.disruption_risk }, 'future_demand_master'); if (id) futureIds[f.skill_name] = id; }

  // RoleFamily→FutureSkill FUTURE_OF edges
  for (const f of future.rows) {
    const rfId = rfIds[f.role_family_key]; const futureId = futureIds[f.skill_name];
    if (rfId && futureId) await upsertEdge(rfId, futureId, 'FUTURE_OF', 0.75);
  }

  return { nodes: nodesCreated, edges: edgesCreated };
}

export function registerVXWorkforceKnowledgeGraphRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn) {
  const guard = (req: Request, res: Response, next: () => void) => { if (!flagOn()) return res.status(503).json({ error: `${FLAG} off` }); next(); };
  let schemaReady = false;
  async function ensureReady() { if (!schemaReady) { await ensureSchema(pool); schemaReady = true; } }

  app.get('/api/admin/vx/wkg/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    const cached = gc<unknown>('wkg_overview'); if (cached) return res.json(cached);
    try {
      const [nodes, edges, byType, byRel] = await Promise.all([
        pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_active) as active FROM wkg_nodes'),
        pool.query('SELECT COUNT(*) as total FROM wkg_edges WHERE is_active=true'),
        pool.query('SELECT node_type, COUNT(*) as count FROM wkg_nodes WHERE is_active=true GROUP BY node_type ORDER BY count DESC'),
        pool.query('SELECT relationship_type, COUNT(*) as count FROM wkg_edges WHERE is_active=true GROUP BY relationship_type ORDER BY count DESC'),
      ]);
      const payload = { nodes: nodes.rows[0], edges: edges.rows[0], by_node_type: byType.rows, by_relationship: byRel.rows };
      sc('wkg_overview', payload); res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/wkg/nodes', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { node_type, search, page = '1', limit = '50' } = req.query as Record<string, string>;
      const p: unknown[] = ['true']; const w: string[] = ['is_active=$1'];
      if (node_type) { p.push(node_type); w.push(`node_type=$${p.length}`); }
      if (search) { p.push(`%${search}%`); w.push(`node_label ILIKE $${p.length}`); }
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const rows = await pool.query(`SELECT * FROM wkg_nodes WHERE ${w.join(' AND ')} ORDER BY node_type, node_label LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, parseInt(limit), offset]);
      res.json({ nodes: rows.rows, total: rows.rows.length, page: parseInt(page) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/wkg/nodes/:id/neighbors', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { depth = '1', rel_type } = req.query as Record<string, string>;
      const relFilter = rel_type ? `AND e.relationship_type=$2` : '';
      const p: unknown[] = [req.params.id]; if (rel_type) p.push(rel_type);
      const rows = await pool.query(
        `SELECT n.*, e.relationship_type, e.weight, 'outbound' as direction FROM wkg_nodes n JOIN wkg_edges e ON e.to_node_id=n.id WHERE e.from_node_id=$1 AND e.is_active=true ${relFilter}
         UNION ALL
         SELECT n.*, e.relationship_type, e.weight, 'inbound' as direction FROM wkg_nodes n JOIN wkg_edges e ON e.from_node_id=n.id WHERE e.to_node_id=$1 AND e.is_active=true ${relFilter}
         ORDER BY weight DESC`, p
      );
      res.json({ node_id: req.params.id, depth: parseInt(depth), neighbors: rows.rows, count: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/wkg/edges', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { relationship_type, page = '1', limit = '100' } = req.query as Record<string, string>;
      const p: unknown[] = []; const w: string[] = ['e.is_active=true'];
      if (relationship_type) { p.push(relationship_type); w.push(`e.relationship_type=$${p.length}`); }
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const rows = await pool.query(`SELECT e.*, fn.node_label as from_label, fn.node_type as from_type, tn.node_label as to_label, tn.node_type as to_type FROM wkg_edges e JOIN wkg_nodes fn ON fn.id=e.from_node_id JOIN wkg_nodes tn ON tn.id=e.to_node_id WHERE ${w.join(' AND ')} ORDER BY e.weight DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`, [...p, parseInt(limit), offset]);
      res.json({ edges: rows.rows, total: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/wkg/nodes', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { node_type, node_key, node_label, description, properties = {} } = req.body;
      if (!node_type || !node_key || !node_label) return res.status(400).json({ error: 'node_type, node_key, node_label required' });
      const row = await pool.query('INSERT INTO wkg_nodes(node_type,node_key,node_label,description,properties) VALUES($1,$2,$3,$4,$5) ON CONFLICT(node_type,node_key) DO UPDATE SET node_label=EXCLUDED.node_label RETURNING *', [node_type, node_key, node_label, description, JSON.stringify(properties)]);
      bc(); res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/wkg/edges', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      const { from_node_id, to_node_id, relationship_type, weight = 1.0, properties = {} } = req.body;
      if (!from_node_id || !to_node_id || !relationship_type) return res.status(400).json({ error: 'from_node_id, to_node_id, relationship_type required' });
      const row = await pool.query('INSERT INTO wkg_edges(from_node_id,to_node_id,relationship_type,weight,properties) VALUES($1,$2,$3,$4,$5) ON CONFLICT(from_node_id,to_node_id,relationship_type) DO UPDATE SET weight=EXCLUDED.weight RETURNING *', [from_node_id, to_node_id, relationship_type, weight, JSON.stringify(properties)]);
      bc(); res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post('/api/admin/vx/wkg/materialize', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await ensureReady().catch(() => null);
    try {
      bc();
      const result = await materializeFromTalentTables(pool);
      res.json({ message: 'Knowledge graph materialized from talent tables', ...result, materialized_at: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/vx/wkg/schema', requireAuth, requireSuperAdmin, guard, (_req: Request, res: Response) => {
    res.json({ node_types: WKG_NODE_TYPES, relationship_types: WKG_RELATIONSHIP_TYPES, description: 'Workforce Knowledge Graph — typed node/relationship schema' });
  });

  console.log('[vx-workforce-knowledge-graph] VX-D1 routes registered — wkg_nodes + wkg_edges + materialize endpoint');
}
