/**
 * CAPADEX PIL — Phase 8: Knowledge Graph builder (read-only of intelligence).
 *
 *   Loads every CAPADEX intelligence asset and stitches the REAL linkage rows
 *   between them into one typed, provenance-stamped graph. The graph is built
 *   deterministically from SELECTs; assembly is a pure function so it can be
 *   tested without a DB. An optional, best-effort `materialize` snapshots the
 *   built graph into pil_kg_nodes / pil_kg_edges (delete-all + chunked bulk insert).
 *
 * CANON (strict):
 *   - READ-ONLY of intelligence: only SELECTs against existing tables; the sole
 *     writes are the optional snapshot into the dedicated kg_* tables.
 *   - Every edge is backed by a real row and provenance-stamped. An asset with no
 *     real linkage simply has no edges — never a fabricated one.
 *   - DETERMINISTIC: stable id helpers + ordered loaders → same DB, same graph.
 *   - NEVER throws past the orchestrator boundary; loaders degrade to empty.
 */
import type { Pool } from 'pg';
import {
  type KnowledgeGraph,
  type KGNode,
  type KGEdge,
  type NodeType,
  type EdgeRelation,
  nodeId,
  edgeId,
} from './knowledge-graph-schema';

// ── Lazy schema (mirrors migration 20261202) ─────────────────────────────────
let schemaReady = false;
export async function ensureKnowledgeGraphSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pil_kg_nodes (
      node_id    TEXT PRIMARY KEY,
      node_type  TEXT NOT NULL,
      node_key   TEXT NOT NULL,
      label      TEXT,
      attrs      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pil_kg_edges (
      edge_id    TEXT PRIMARY KEY,
      source_id  TEXT NOT NULL,
      target_id  TEXT NOT NULL,
      relation   TEXT NOT NULL,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pil_kg_nodes_type   ON pil_kg_nodes (node_type);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_edges_source ON pil_kg_edges (source_id);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_edges_target ON pil_kg_edges (target_id);
    CREATE INDEX IF NOT EXISTS idx_pil_kg_edges_rel    ON pil_kg_edges (relation);
  `);
  schemaReady = true;
}

// ── Raw row shapes loaded from the DB ────────────────────────────────────────
export interface GraphInputs {
  domains:   { domain_id: string; domain_name: string | null; bridge: string | null }[];
  families:  { family_id: string; family_name: string | null; domain_id: string | null; bridge: string | null }[];
  atomics:   { atomic_signal_id: string; label: string | null; family_id: string | null; domain_id: string | null; bridge: string | null }[];
  signals:   { signal_id: string; signal_name: string | null; bridge: string | null }[];
  concerns:  { concern_id: string; pk: number; label: string | null; domain: string | null; cluster: string | null; bridge: string | null }[];
  clarity:   { question_id: string; question: string | null; bridge: string | null }[];
  concernSignal: { concern_id: string; signal_ref: string; score: number | null; confidence: number | null }[];
  concernClarity: { id: string; concern_id: string; bridge: string | null; match_method: string | null; score: number | null; question_count: number | null }[];
  capabilities:  { concern_id: string; capability_name: string | null; problem_concern_id: string; problem_name: string | null; confidence: number | null; mapping_id: number }[];
  cpb: { mapping_id: number; problem_concern_id: string; problem_name: string | null; behavior_id: number }[];
  behaviors: { behavior_id: number; concern_id: string; statement: string | null; category: string | null }[];
  archetypes:{ archetype_key: string; archetype_name: string | null; category: string | null }[];
  archetypeConcern: { archetype_key: string; concern_id: string; map_id: number }[];
  problems:  { problem_id: number; statement: string | null; archetype_key: string | null }[];
  emotions:  { emotion_id: number; statement: string | null; emotion_type: string | null; archetype_key: string | null }[];
  intents:   { intent_id: number; phrase: string | null; archetype_key: string | null; problem_id: number | null }[];
  interventions: { intervention_id: number; text: string | null; archetype_key: string | null; problem_id: number | null; type: string | null }[];
  competencies:  { id: string; name: string | null; comp_domain: string | null; comp_family: string | null }[];
  recommendations: { recommendation_key: string; title: string | null; category: string | null; anchor_construct: string | null }[];
  runtimeInterventions: { id: string; construct_key: string; persona: string | null; confidence_band: string | null }[];
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown): string | null => (v == null ? null : String(v));

// ── Read-only loaders (each degrades to [] on error) ─────────────────────────
async function safeRows<T>(pool: Pool, sql: string, map: (r: any) => T): Promise<T[]> {
  try {
    const { rows } = await pool.query(sql);
    return rows.map(map);
  } catch (err) {
    console.warn('[kg-builder] loader degraded:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

export async function loadGraphInputs(pool: Pool): Promise<GraphInputs> {
  const [
    domains, families, atomics, signals, concerns, clarity, concernSignal,
    capabilities, behaviors, archetypes, archetypeConcern, problems, emotions,
    intents, interventions, competencies, recommendations, runtimeInterventions,
    concernClarity, cpb,
  ] = await Promise.all([
    safeRows(pool, `SELECT domain_id, domain_name, relational_bridge_tag FROM capadex_domains ORDER BY domain_id`,
      (r) => ({ domain_id: String(r.domain_id), domain_name: str(r.domain_name), bridge: str(r.relational_bridge_tag) })),
    safeRows(pool, `SELECT family_id, family_name, domain_id, relational_bridge_tag FROM capadex_families ORDER BY family_id`,
      (r) => ({ family_id: String(r.family_id), family_name: str(r.family_name), domain_id: str(r.domain_id), bridge: str(r.relational_bridge_tag) })),
    safeRows(pool, `SELECT atomic_signal_id, signal_label, atomic_signal_name, family_id, domain_id, relational_bridge_tag FROM capadex_atomic_signals ORDER BY atomic_signal_id`,
      (r) => ({ atomic_signal_id: String(r.atomic_signal_id), label: str(r.signal_label) || str(r.atomic_signal_name), family_id: str(r.family_id), domain_id: str(r.domain_id), bridge: str(r.relational_bridge_tag) })),
    safeRows(pool, `SELECT signal_id, signal_name, relational_bridge_tag FROM capadex_signals ORDER BY signal_id`,
      (r) => ({ signal_id: String(r.signal_id), signal_name: str(r.signal_name), bridge: str(r.relational_bridge_tag) })),
    safeRows(pool, `SELECT id, concern_id, display_label, domain, concern_cluster, relational_bridge_tag FROM capadex_concerns_master ORDER BY id`,
      (r) => ({ concern_id: String(r.concern_id), pk: Number(r.id), label: str(r.display_label) || String(r.concern_id), domain: str(r.domain), cluster: str(r.concern_cluster), bridge: str(r.relational_bridge_tag) })),
    safeRows(pool, `SELECT question_id, question, master_bridge_tag FROM capadex_clarity_questions ORDER BY question_id`,
      (r) => ({ question_id: String(r.question_id), question: str(r.question), bridge: str(r.master_bridge_tag) })),
    // tier3 ONLY — the only concern_signal_map tier whose signal_ref joins a real signal node.
    safeRows(pool, `SELECT m.concern_id, m.signal_ref, m.score, m.confidence
                      FROM capadex_concern_signal_map m
                      JOIN capadex_signals s ON s.signal_id = m.signal_ref
                     WHERE m.signal_tier = 'tier3'
                     ORDER BY m.concern_id, m.signal_ref`,
      (r) => ({ concern_id: String(r.concern_id), signal_ref: String(r.signal_ref), score: num(r.score), confidence: num(r.confidence) })),
    safeRows(pool, `SELECT mapping_id, capability_concern_id, capability_name, problem_concern_id, problem_name, confidence_score
                      FROM capability_problem_map ORDER BY mapping_id`,
      (r) => ({ concern_id: String(r.capability_concern_id), capability_name: str(r.capability_name), problem_concern_id: String(r.problem_concern_id), problem_name: str(r.problem_name), confidence: num(r.confidence_score), mapping_id: Number(r.mapping_id) })),
    safeRows(pool, `SELECT behavior_id, concern_id, behavior_statement, behavior_category FROM behavior_library ORDER BY behavior_id`,
      (r) => ({ behavior_id: Number(r.behavior_id), concern_id: String(r.concern_id), statement: str(r.behavior_statement), category: str(r.behavior_category) })),
    safeRows(pool, `SELECT archetype_key, archetype_name, primary_behavior_category FROM archetype_library ORDER BY archetype_key`,
      (r) => ({ archetype_key: String(r.archetype_key), archetype_name: str(r.archetype_name), category: str(r.primary_behavior_category) })),
    safeRows(pool, `SELECT map_id, archetype_key, concern_id FROM archetype_concern_map ORDER BY map_id`,
      (r) => ({ archetype_key: String(r.archetype_key), concern_id: String(r.concern_id), map_id: Number(r.map_id) })),
    safeRows(pool, `SELECT problem_id, problem_statement, archetype_key FROM human_problem_library ORDER BY problem_id`,
      (r) => ({ problem_id: Number(r.problem_id), statement: str(r.problem_statement), archetype_key: str(r.archetype_key) })),
    safeRows(pool, `SELECT emotion_id, statement, emotion_type, archetype_key FROM human_emotion_library ORDER BY emotion_id`,
      (r) => ({ emotion_id: Number(r.emotion_id), statement: str(r.statement), emotion_type: str(r.emotion_type), archetype_key: str(r.archetype_key) })),
    safeRows(pool, `SELECT intent_id, search_phrase, archetype_key, problem_id FROM search_intents ORDER BY intent_id`,
      (r) => ({ intent_id: Number(r.intent_id), phrase: str(r.search_phrase), archetype_key: str(r.archetype_key), problem_id: num(r.problem_id) })),
    safeRows(pool, `SELECT intervention_id, intervention_text, archetype_key, problem_id, intervention_type FROM pil_intervention_library ORDER BY intervention_id`,
      (r) => ({ intervention_id: Number(r.intervention_id), text: str(r.intervention_text), archetype_key: str(r.archetype_key), problem_id: num(r.problem_id), type: str(r.intervention_type) })),
    safeRows(pool, `SELECT id, canonical_name, domain_id, family_id FROM onto_competencies ORDER BY id`,
      (r) => ({ id: String(r.id), name: str(r.canonical_name), comp_domain: str(r.domain_id), comp_family: str(r.family_id) })),
    safeRows(pool, `SELECT recommendation_key, title, category, anchor_construct FROM recommendation_library ORDER BY recommendation_key`,
      (r) => ({ recommendation_key: String(r.recommendation_key), title: str(r.title), category: str(r.category), anchor_construct: str(r.anchor_construct) })),
    safeRows(pool, `SELECT id, construct_key, persona, confidence_band FROM intervention_library ORDER BY id`,
      (r) => ({ id: String(r.id), construct_key: String(r.construct_key), persona: str(r.persona), confidence_band: str(r.confidence_band) })),
    // concern↔clarity resolution map (hard, scored linkage — distinct from the structural bridge tag)
    safeRows(pool, `SELECT id, master_concern_id, relational_bridge_tag, match_method, score, question_count
                      FROM capadex_concern_clarity_map
                     WHERE master_concern_id IS NOT NULL
                     ORDER BY id`,
      (r) => ({ id: String(r.id), concern_id: String(r.master_concern_id), bridge: str(r.relational_bridge_tag), match_method: str(r.match_method), score: num(r.score), question_count: num(r.question_count) })),
    // capability → problem → behavior chain (behavior_id FK → behavior_library)
    safeRows(pool, `SELECT mapping_id, problem_id, problem_name, behavior_id
                      FROM capability_problem_behavior_map ORDER BY mapping_id`,
      (r) => ({ mapping_id: Number(r.mapping_id), problem_concern_id: String(r.problem_id), problem_name: str(r.problem_name), behavior_id: Number(r.behavior_id) })),
  ]);
  return {
    domains, families, atomics, signals, concerns, clarity, concernSignal, concernClarity,
    capabilities, cpb, behaviors, archetypes, archetypeConcern, problems, emotions,
    intents, interventions, competencies, recommendations, runtimeInterventions,
  };
}

// ── Pure assembly (no DB; fully testable) ────────────────────────────────────
export function assembleGraph(inputs: GraphInputs, generatedAt?: string): KnowledgeGraph {
  const nodes = new Map<string, KGNode>();
  const edges = new Map<string, KGEdge>();

  const addNode = (type: NodeType, key: string, label: string | null, attrs?: Record<string, unknown>) => {
    const id = nodeId(type, key);
    if (!nodes.has(id)) nodes.set(id, { id, type, key: String(key), label: label ?? String(key), attrs });
    return id;
  };
  const addEdge = (relation: EdgeRelation, source: string, target: string, table: string, ref?: string | number) => {
    // Only ever link two nodes that actually exist — never dangle an edge.
    if (!nodes.has(source) || !nodes.has(target)) return;
    // CONTRACT: one edge per REAL linkage ROW. The provenance ref (the source
    // row's PK) discriminates multiple rows that resolve to the SAME
    // (relation, source, target) — e.g. several concern_clarity_map rows pointing
    // one concern at the same bridge tag — so no real row is silently collapsed.
    // The structural edgeId stays the readable prefix; the ref makes id row-unique.
    const id = `${edgeId(relation, source, target)}#${table}:${ref ?? ''}`;
    if (!edges.has(id)) edges.set(id, { id, source, target, relation, provenance: { table, ref } });
  };
  const tagNode = (tag: string | null): string | null => {
    const t = (tag ?? '').trim();
    if (!t || t === '__orphan__') return null;
    return addNode('bridge_tag', t, t);
  };

  // Nodes + intra-ontology structural edges -----------------------------------
  for (const d of inputs.domains) {
    const id = addNode('domain', d.domain_id, d.domain_name);
    const bt = tagNode(d.bridge);
    if (bt) addEdge('tagged_with', id, bt, 'capadex_domains', d.domain_id);
  }
  for (const f of inputs.families) {
    const id = addNode('family', f.family_id, f.family_name);
    if (f.domain_id) addEdge('family_belongs_to_domain', id, nodeId('domain', f.domain_id), 'capadex_families', f.family_id);
    const bt = tagNode(f.bridge);
    if (bt) addEdge('tagged_with', id, bt, 'capadex_families', f.family_id);
  }
  for (const a of inputs.atomics) {
    const id = addNode('atomic_signal', a.atomic_signal_id, a.label);
    if (a.family_id) addEdge('atomic_belongs_to_family', id, nodeId('family', a.family_id), 'capadex_atomic_signals', a.atomic_signal_id);
    if (a.domain_id) addEdge('atomic_belongs_to_domain', id, nodeId('domain', a.domain_id), 'capadex_atomic_signals', a.atomic_signal_id);
    const bt = tagNode(a.bridge);
    if (bt) addEdge('tagged_with', id, bt, 'capadex_atomic_signals', a.atomic_signal_id);
  }
  for (const s of inputs.signals) {
    const id = addNode('signal', s.signal_id, s.signal_name);
    const bt = tagNode(s.bridge);
    if (bt) addEdge('tagged_with', id, bt, 'capadex_signals', s.signal_id);
  }
  for (const c of inputs.concerns) {
    const id = addNode('concern', c.concern_id, c.label, { domain: c.domain, cluster: c.cluster });
    const bt = tagNode(c.bridge);
    if (bt) addEdge('tagged_with', id, bt, 'capadex_concerns_master', c.concern_id);
  }
  for (const q of inputs.clarity) {
    const id = addNode('clarity_question', q.question_id, q.question);
    const bt = tagNode(q.bridge);
    if (bt) addEdge('tagged_with', id, bt, 'capadex_clarity_questions', q.question_id);
  }

  // Concern → Signal (tier3) ---------------------------------------------------
  for (const m of inputs.concernSignal) {
    addEdge('concern_activates_signal', nodeId('concern', m.concern_id), nodeId('signal', m.signal_ref),
      'capadex_concern_signal_map', `${m.concern_id}->${m.signal_ref}`);
  }

  // Concern → Clarity resolution (hard, scored — distinct from structural tag) -
  for (const m of inputs.concernClarity) {
    const bt = tagNode(m.bridge);
    if (bt) addEdge('concern_resolves_clarity', nodeId('concern', m.concern_id), bt, 'capadex_concern_clarity_map', m.id);
  }

  // Concern → Capability → Problem framing chain ------------------------------
  for (const cap of inputs.capabilities) {
    const capId = addNode('capability', cap.concern_id, cap.capability_name, { confidence: cap.confidence });
    addEdge('concern_framed_as_capability', nodeId('concern', cap.concern_id), capId, 'capability_problem_map', cap.mapping_id);
    const probId = addNode('problem_framing', cap.problem_concern_id, cap.problem_name);
    addEdge('capability_addresses_problem', capId, probId, 'capability_problem_map', cap.mapping_id);
  }

  // Behavior → Concern ---------------------------------------------------------
  for (const b of inputs.behaviors) {
    const id = addNode('behavior', b.behavior_id, b.statement, { category: b.category });
    addEdge('behavior_indicates_concern', id, nodeId('concern', b.concern_id), 'behavior_library', b.behavior_id);
  }

  // Problem framing → Behavior (capability→problem→behavior chain completion) --
  for (const m of inputs.cpb) {
    const probId = addNode('problem_framing', m.problem_concern_id, m.problem_name);
    addEdge('problem_manifests_behavior', probId, nodeId('behavior', m.behavior_id), 'capability_problem_behavior_map', m.mapping_id);
  }

  // Archetypes + Archetype → Concern ------------------------------------------
  for (const a of inputs.archetypes) addNode('archetype', a.archetype_key, a.archetype_name, { category: a.category });
  for (const m of inputs.archetypeConcern) {
    addEdge('archetype_covers_concern', nodeId('archetype', m.archetype_key), nodeId('concern', m.concern_id), 'archetype_concern_map', m.map_id);
  }

  // Problems / Emotions / Intents / Interventions → Archetype (+ Problem) ------
  for (const p of inputs.problems) {
    const id = addNode('problem', p.problem_id, p.statement);
    if (p.archetype_key) addEdge('problem_belongs_to_archetype', id, nodeId('archetype', p.archetype_key), 'human_problem_library', p.problem_id);
  }
  for (const e of inputs.emotions) {
    const id = addNode('emotion', e.emotion_id, e.statement, { emotion_type: e.emotion_type });
    if (e.archetype_key) addEdge('emotion_belongs_to_archetype', id, nodeId('archetype', e.archetype_key), 'human_emotion_library', e.emotion_id);
  }
  for (const i of inputs.intents) {
    const id = addNode('search_intent', i.intent_id, i.phrase);
    if (i.archetype_key) addEdge('intent_for_archetype', id, nodeId('archetype', i.archetype_key), 'search_intents', i.intent_id);
    if (i.problem_id != null) addEdge('intent_for_problem', id, nodeId('problem', i.problem_id), 'search_intents', i.intent_id);
  }
  for (const v of inputs.interventions) {
    const id = addNode('intervention', v.intervention_id, v.text, { type: v.type });
    if (v.archetype_key) addEdge('intervention_for_archetype', id, nodeId('archetype', v.archetype_key), 'pil_intervention_library', v.intervention_id);
    if (v.problem_id != null) addEdge('intervention_for_problem', id, nodeId('problem', v.problem_id), 'pil_intervention_library', v.intervention_id);
  }

  // Statically-disconnected assets (honest: nodes with no fabricated edges) ----
  for (const c of inputs.competencies) {
    addNode('competency', c.id, c.name, { comp_domain: c.comp_domain, comp_family: c.comp_family });
  }

  // Construct-anchored region (runtime-bound; its own component) ---------------
  for (const r of inputs.recommendations) {
    const id = addNode('recommendation', r.recommendation_key, r.title, { category: r.category });
    if (r.anchor_construct) {
      const cid = addNode('construct', r.anchor_construct, r.anchor_construct);
      addEdge('recommendation_anchored_on_construct', id, cid, 'recommendation_library', r.recommendation_key);
    }
  }
  for (const ri of inputs.runtimeInterventions) {
    const id = addNode('runtime_intervention', ri.id, `${ri.construct_key} · ${ri.persona ?? 'any'} · ${ri.confidence_band ?? 'any'}`, { persona: ri.persona, confidence_band: ri.confidence_band });
    const cid = addNode('construct', ri.construct_key, ri.construct_key);
    addEdge('runtime_intervention_for_construct', id, cid, 'intervention_library', ri.id);
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    built_at: generatedAt ?? new Date().toISOString(),
  };
}

// ── Best-effort materialization (snapshot into pil_kg_nodes / pil_kg_edges) ──────────
const CHUNK = 1000;

export async function materializeKnowledgeGraph(pool: Pool, graph: KnowledgeGraph): Promise<{ nodes: number; edges: number }> {
  await ensureKnowledgeGraphSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pil_kg_edges');
    await client.query('DELETE FROM pil_kg_nodes');

    for (let i = 0; i < graph.nodes.length; i += CHUNK) {
      const slice = graph.nodes.slice(i, i + CHUNK);
      const vals: unknown[] = [];
      const tuples = slice.map((n, j) => {
        const b = j * 5;
        vals.push(n.id, n.type, n.key, n.label ?? null, JSON.stringify(n.attrs ?? {}));
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5}::jsonb)`;
      });
      await client.query(
        `INSERT INTO pil_kg_nodes (node_id,node_type,node_key,label,attrs) VALUES ${tuples.join(',')}
           ON CONFLICT (node_id) DO NOTHING`,
        vals,
      );
    }
    for (let i = 0; i < graph.edges.length; i += CHUNK) {
      const slice = graph.edges.slice(i, i + CHUNK);
      const vals: unknown[] = [];
      const tuples = slice.map((e, j) => {
        const b = j * 5;
        vals.push(e.id, e.source, e.target, e.relation, JSON.stringify(e.provenance ?? {}));
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5}::jsonb)`;
      });
      await client.query(
        `INSERT INTO pil_kg_edges (edge_id,source_id,target_id,relation,provenance) VALUES ${tuples.join(',')}
           ON CONFLICT (edge_id) DO NOTHING`,
        vals,
      );
    }
    await client.query('COMMIT');
    return { nodes: graph.nodes.length, edges: graph.edges.length };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn('[kg-builder] materialize degraded:', err instanceof Error ? err.message : String(err));
    return { nodes: 0, edges: 0 };
  } finally {
    client.release();
  }
}

// ── Orchestrator: build the in-memory graph (never throws) ────────────────────
export async function buildKnowledgeGraph(pool: Pool): Promise<KnowledgeGraph> {
  try {
    const inputs = await loadGraphInputs(pool);
    return assembleGraph(inputs);
  } catch (err) {
    console.warn('[kg-builder] build degraded:', err instanceof Error ? err.message : String(err));
    return { nodes: [], edges: [], built_at: new Date().toISOString() };
  }
}
