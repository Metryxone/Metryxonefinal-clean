/**
 * Workforce Knowledge Graph — Phase 5
 * Maps People ↔ Skills ↔ Competencies ↔ Roles ↔ Industries ↔ Outcomes.
 * Supports adjacency discovery, influence propagation, and graph traversal.
 */

/* ── Node types ──────────────────────────────────────────────────── */
export type NodeType = 'person' | 'skill' | 'competency' | 'role' | 'industry' | 'outcome';
export type EdgeType =
  | 'has-skill'          // person → skill
  | 'maps-to'            // skill → competency
  | 'requires'           // role → competency
  | 'belongs-to'         // role → industry
  | 'leads-to'           // competency → outcome
  | 'adjacent'           // role ↔ role (bidirectional)
  | 'enables'            // skill → role
  | 'disrupts'           // ai-signal → skill (negative weight)
  | 'accelerates'        // training → competency
  | 'predicts'           // competency → outcome (with probability);

export interface GraphNode {
  id:         string;
  type:       NodeType;
  label:      string;
  properties: Record<string, unknown>;
  weight:     number;   // 0-100 importance score
}

export interface GraphEdge {
  id:      string;
  from:    string;   // node id
  to:      string;   // node id
  type:    EdgeType;
  weight:  number;   // 0-1 strength
  label?:  string;
}

export interface WorkforceGraph {
  nodes:    Map<string, GraphNode>;
  edges:    Map<string, GraphEdge>;
  // Adjacency list: nodeId → Set of connected nodeIds
  adjacency:Map<string, Set<string>>;
}

/* ── Graph builder ───────────────────────────────────────────────── */
export function createGraph(): WorkforceGraph {
  return { nodes:new Map(), edges:new Map(), adjacency:new Map() };
}

export function addNode(graph: WorkforceGraph, node: GraphNode): void {
  graph.nodes.set(node.id, node);
  if (!graph.adjacency.has(node.id)) graph.adjacency.set(node.id, new Set());
}

export function addEdge(graph: WorkforceGraph, edge: GraphEdge): void {
  graph.edges.set(edge.id, edge);
  const fromAdj = graph.adjacency.get(edge.from) ?? new Set<string>();
  fromAdj.add(edge.to);
  graph.adjacency.set(edge.from, fromAdj);
  // For bidirectional edge types
  if (edge.type === 'adjacent') {
    const toAdj = graph.adjacency.get(edge.to) ?? new Set<string>();
    toAdj.add(edge.from);
    graph.adjacency.set(edge.to, toAdj);
  }
}

/* ── Pre-built workforce ontology ─────────────────────────────────── */
export function buildWorkforceOntology(): WorkforceGraph {
  const g = createGraph();

  // Industry nodes
  const industries = ['engineering','data','product','design','finance','security','ai','hr','marketing','operations'];
  for (const ind of industries) {
    addNode(g, { id:`ind:${ind}`, type:'industry', label:ind.charAt(0).toUpperCase()+ind.slice(1), properties:{ sector:ind }, weight:70 });
  }

  // Competency nodes (from the 24-competency catalog)
  const competencies = [
    { id:'programming',    label:'Programming',           domain:'technical',    weight:90 },
    { id:'systems-design', label:'Systems Design',        domain:'technical',    weight:85 },
    { id:'cloud',          label:'Cloud & DevOps',         domain:'technical',    weight:85 },
    { id:'data-engineering',label:'Data Engineering',     domain:'technical',    weight:82 },
    { id:'security',       label:'Security',              domain:'technical',    weight:85 },
    { id:'data-analysis',  label:'Data Analysis',         domain:'analytical',   weight:78 },
    { id:'statistics',     label:'Statistics & ML',       domain:'analytical',   weight:80 },
    { id:'business-acumen',label:'Business Acumen',       domain:'analytical',   weight:76 },
    { id:'research',       label:'Research',              domain:'analytical',   weight:70 },
    { id:'writing',        label:'Writing',               domain:'communication',weight:72 },
    { id:'presentation',   label:'Presentation',          domain:'communication',weight:74 },
    { id:'stakeholder-mgmt',label:'Stakeholder Management',domain:'communication',weight:78 },
    { id:'people-mgmt',    label:'People Management',     domain:'leadership',   weight:82 },
    { id:'strategy',       label:'Strategic Thinking',    domain:'leadership',   weight:85 },
    { id:'mentoring',      label:'Mentoring',             domain:'leadership',   weight:72 },
    { id:'innovation',     label:'Innovation',            domain:'creative',     weight:74 },
    { id:'design-thinking',label:'Design Thinking',       domain:'creative',     weight:70 },
    { id:'ux-design',      label:'UX Design',             domain:'creative',     weight:72 },
    { id:'project-mgmt',   label:'Project Management',    domain:'execution',    weight:78 },
    { id:'negotiation',    label:'Negotiation',           domain:'execution',    weight:74 },
    { id:'collaboration',  label:'Collaboration',         domain:'behavioral',   weight:80 },
    { id:'resilience',     label:'Resilience',            domain:'behavioral',   weight:78 },
    { id:'drive',          label:'Drive & Ownership',     domain:'behavioral',   weight:82 },
    { id:'adaptability',   label:'Adaptability',          domain:'behavioral',   weight:80 },
  ];
  for (const comp of competencies) {
    addNode(g, { id:`comp:${comp.id}`, type:'competency', label:comp.label, properties:{ domain:comp.domain }, weight:comp.weight });
  }

  // Skill nodes
  const skills = [
    'Python','TypeScript','React','Node.js','SQL','AWS','Kubernetes','Docker','Terraform','Git',
    'Machine Learning','Data Engineering','LLMs / GenAI','RAG / Vector DBs','Prompt Engineering',
    'Cybersecurity','Figma','Agile','Product Strategy','Leadership','System Design','MLOps','Rust','Spark',
  ];
  for (const skill of skills) {
    addNode(g, { id:`skill:${skill}`, type:'skill', label:skill, properties:{}, weight:70 });
  }

  // Role nodes
  const roles = [
    { id:'swe',     label:'Software Engineer',      industry:'engineering', weight:88 },
    { id:'ml-eng',  label:'ML Engineer',            industry:'ai',          weight:90 },
    { id:'ai-eng',  label:'AI Engineer',            industry:'ai',          weight:93 },
    { id:'cloud',   label:'Cloud Architect',        industry:'engineering', weight:86 },
    { id:'cybersec',label:'Cybersecurity Engineer', industry:'security',    weight:89 },
    { id:'devops',  label:'DevOps / Platform Eng',  industry:'engineering', weight:82 },
    { id:'ds',      label:'Data Scientist',         industry:'data',        weight:84 },
    { id:'de',      label:'Data Engineer',          industry:'data',        weight:85 },
    { id:'da',      label:'Data Analyst',           industry:'data',        weight:75 },
    { id:'pm',      label:'Product Manager',        industry:'product',     weight:76 },
    { id:'ux',      label:'UX Designer',            industry:'design',      weight:70 },
    { id:'eng-mgr', label:'Engineering Manager',    industry:'engineering', weight:80 },
  ];
  for (const role of roles) {
    addNode(g, { id:`role:${role.id}`, type:'role', label:role.label, properties:{ industry:role.industry }, weight:role.weight });
  }

  // Outcome nodes
  const outcomes = [
    { id:'senior-ic',  label:'Senior Individual Contributor', weight:80 },
    { id:'tech-lead',  label:'Technical Lead',                weight:85 },
    { id:'eng-manager',label:'Engineering Manager',           weight:85 },
    { id:'architect',  label:'Principal / Architect',         weight:88 },
    { id:'cto',        label:'CTO / VP Engineering',          weight:90 },
    { id:'startup',    label:'Founder / Startup Leader',      weight:85 },
    { id:'consultant', label:'Independent Consultant',        weight:78 },
    { id:'researcher', label:'Researcher / Scientist',        weight:80 },
  ];
  for (const out of outcomes) {
    addNode(g, { id:`out:${out.id}`, type:'outcome', label:out.label, properties:{}, weight:out.weight });
  }

  // Skill → Competency edges (maps-to)
  const skillCompMap: [string,string,number][] = [
    ['Python',         'programming',      0.9], ['TypeScript',   'programming',    0.9],
    ['React',          'programming',      0.7], ['Node.js',      'programming',    0.8],
    ['SQL',            'data-analysis',    0.8], ['SQL',          'data-engineering',0.7],
    ['AWS',            'cloud',            0.9], ['Kubernetes',   'cloud',          0.85],
    ['Docker',         'cloud',            0.75],['Terraform',    'cloud',          0.8],
    ['Machine Learning','statistics',      0.9], ['LLMs / GenAI', 'statistics',     0.7],
    ['MLOps',          'cloud',            0.7], ['MLOps',        'data-engineering',0.8],
    ['Spark',          'data-engineering', 0.9], ['Cybersecurity','security',       0.95],
    ['Figma',          'ux-design',        0.9], ['Agile',        'project-mgmt',   0.8],
    ['Product Strategy','strategy',        0.8], ['Leadership',   'people-mgmt',    0.85],
    ['System Design',  'systems-design',   0.95],['Rust',         'programming',    0.8],
    ['Prompt Engineering','statistics',    0.6], ['RAG / Vector DBs','data-engineering',0.7],
  ];
  for (const [skill, comp, wt] of skillCompMap) {
    const eid = `e:skill:${skill}→comp:${comp}`;
    addEdge(g, { id:eid, from:`skill:${skill}`, to:`comp:${comp}`, type:'maps-to', weight:wt });
  }

  // Competency → Role edges (requires)
  const compRoleMap: [string,string,number][] = [
    ['programming','swe',0.9], ['systems-design','swe',0.8], ['programming','ml-eng',0.8],
    ['statistics','ml-eng',0.9], ['programming','ai-eng',0.85], ['statistics','ai-eng',0.8],
    ['cloud','cloud',0.95], ['systems-design','cloud',0.85],
    ['security','cybersec',0.95], ['programming','cybersec',0.7],
    ['cloud','devops',0.9], ['programming','devops',0.7],
    ['statistics','ds',0.9], ['data-analysis','ds',0.85], ['data-engineering','de',0.95],
    ['data-analysis','da',0.9], ['strategy','pm',0.85], ['stakeholder-mgmt','pm',0.8],
    ['ux-design','ux',0.95], ['design-thinking','ux',0.8],
    ['people-mgmt','eng-mgr',0.9], ['strategy','eng-mgr',0.85],
  ];
  for (const [comp, role, wt] of compRoleMap) {
    addEdge(g, { id:`e:comp:${comp}→role:${role}`, from:`comp:${comp}`, to:`role:${role}`, type:'requires', weight:wt });
  }

  // Role → Industry edges
  const roleIndMap: [string,string][] = [
    ['swe','engineering'],['ml-eng','ai'],['ai-eng','ai'],['cloud','engineering'],
    ['cybersec','security'],['devops','engineering'],['ds','data'],['de','data'],
    ['da','data'],['pm','product'],['ux','design'],['eng-mgr','engineering'],
  ];
  for (const [role, ind] of roleIndMap) {
    addEdge(g, { id:`e:role:${role}→ind:${ind}`, from:`role:${role}`, to:`ind:${ind}`, type:'belongs-to', weight:0.9 });
  }

  // Role adjacency edges (bidirectional)
  const adjacencies: [string,string,number][] = [
    ['swe','ml-eng',0.7],['swe','devops',0.7],['swe','cloud',0.65],
    ['ml-eng','ai-eng',0.9],['ml-eng','ds',0.7],['ds','de',0.7],
    ['da','ds',0.7],['da','de',0.5],['pm','eng-mgr',0.6],
    ['swe','eng-mgr',0.75],['cloud','devops',0.8],['cybersec','devops',0.5],
  ];
  for (const [r1, r2, wt] of adjacencies) {
    addEdge(g, { id:`e:adj:${r1}↔${r2}`, from:`role:${r1}`, to:`role:${r2}`, type:'adjacent', weight:wt });
  }

  // Competency → Outcome edges (leads-to)
  const compOutMap: [string,string,number][] = [
    ['programming','senior-ic',0.8],['systems-design','architect',0.85],
    ['people-mgmt','eng-manager',0.9],['strategy','cto',0.75],
    ['strategy','architect',0.7],['drive','startup',0.8],
    ['statistics','researcher',0.8],['innovation','startup',0.75],
    ['stakeholder-mgmt','consultant',0.8],['mentoring','eng-manager',0.75],
  ];
  for (const [comp, out, wt] of compOutMap) {
    addEdge(g, { id:`e:comp:${comp}→out:${out}`, from:`comp:${comp}`, to:`out:${out}`, type:'leads-to', weight:wt });
  }

  return g;
}

/* ── Graph traversal ─────────────────────────────────────────────── */
export function bfsNeighbours(
  graph:   WorkforceGraph,
  startId: string,
  maxDepth:number = 2,
  nodeTypes?:NodeType[],
): GraphNode[] {
  const visited = new Set<string>();
  const queue: [string, number][] = [[startId, 0]];
  const result: GraphNode[] = [];
  while (queue.length > 0) {
    const [cur, depth] = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (cur !== startId) {
      const node = graph.nodes.get(cur);
      if (node && (!nodeTypes || nodeTypes.includes(node.type))) result.push(node);
    }
    if (depth < maxDepth) {
      const adj = graph.adjacency.get(cur) ?? new Set<string>();
      for (const nxt of adj) if (!visited.has(nxt)) queue.push([nxt, depth + 1]);
    }
  }
  return result.sort((a, b) => b.weight - a.weight);
}

export function getAdjacentRoles(graph: WorkforceGraph, roleId: string): GraphNode[] {
  return bfsNeighbours(graph, `role:${roleId}`, 1, ['role']);
}

export function getSkillsForCompetency(graph: WorkforceGraph, compId: string): GraphNode[] {
  // Reverse: find all skills that map to this competency
  const result: GraphNode[] = [];
  for (const edge of graph.edges.values()) {
    if (edge.to === `comp:${compId}` && edge.type === 'maps-to') {
      const node = graph.nodes.get(edge.from);
      if (node) result.push(node);
    }
  }
  return result;
}

/* ── Influence propagation ───────────────────────────────────────── */
export interface InfluenceWave {
  sourceId:    string;
  sourceLabel: string;
  affected:    { node:GraphNode; influenceScore:number; hops:number; pathVia:string[] }[];
}

export function propagateInfluence(
  graph:     WorkforceGraph,
  sourceId:  string,
  changeType:'improvement' | 'disruption',
  magnitude: number,   // 0-1
): InfluenceWave {
  const source = graph.nodes.get(sourceId);
  const visited = new Map<string, { score:number; hops:number; path:string[] }>();
  const queue: [string, number, number, string[]][] = [[sourceId, magnitude, 0, [source?.label ?? sourceId]]];

  while (queue.length > 0) {
    const [cur, score, hops, path] = queue.shift()!;
    if (visited.has(cur) || hops > 3) continue;
    if (cur !== sourceId) visited.set(cur, { score, hops, path });
    const adj = graph.adjacency.get(cur) ?? new Set<string>();
    for (const nxt of adj) {
      if (visited.has(nxt)) continue;
      const edge = [...graph.edges.values()].find(e => e.from === cur && e.to === nxt);
      const edgeWeight = edge?.weight ?? 0.5;
      const decay = changeType === 'disruption' ? 0.6 : 0.7;
      const newScore = score * edgeWeight * decay;
      if (newScore > 0.05) {
        const nxtNode = graph.nodes.get(nxt);
        queue.push([nxt, newScore, hops + 1, [...path, nxtNode?.label ?? nxt]]);
      }
    }
  }

  const affected = [...visited.entries()].map(([id, { score, hops, path }]) => ({
    node:graph.nodes.get(id)!,
    influenceScore:Math.round(score * 100),
    hops, pathVia:path,
  })).filter(a => a.node).sort((a,b) => b.influenceScore - a.influenceScore);

  return { sourceId, sourceLabel:source?.label ?? sourceId, affected };
}

/* ── Person graph builder ────────────────────────────────────────── */
export function addPersonToGraph(
  graph:    WorkforceGraph,
  person:   { id:string; name:string; competencyLevels:Record<string,number>; currentRole?:string },
): void {
  addNode(graph, { id:`person:${person.id}`, type:'person', label:person.name, properties:{ competencyLevels:person.competencyLevels, role:person.currentRole }, weight:75 });
  for (const [compId, level] of Object.entries(person.competencyLevels)) {
    if (level > 0) {
      addEdge(graph, { id:`e:person:${person.id}→comp:${compId}`, from:`person:${person.id}`, to:`comp:${compId}`, type:'has-skill', weight:level / 5 });
    }
  }
  if (person.currentRole) {
    addEdge(graph, { id:`e:person:${person.id}→role:${person.currentRole}`, from:`person:${person.id}`, to:`role:${person.currentRole}`, type:'enables', weight:0.8 });
  }
}

/* ── Graph stats ─────────────────────────────────────────────────── */
export interface GraphStats {
  nodeCount:  number;
  edgeCount:  number;
  byType:     Record<NodeType, number>;
  density:    number;    // edges / (nodes*(nodes-1))
  topNodes:   GraphNode[];
}

export function getGraphStats(graph: WorkforceGraph): GraphStats {
  const byType: Record<NodeType, number> = { person:0, skill:0, competency:0, role:0, industry:0, outcome:0 };
  for (const n of graph.nodes.values()) byType[n.type]++;
  const n = graph.nodes.size;
  const density = n > 1 ? Math.round((graph.edges.size / (n * (n - 1))) * 1000) / 10 : 0;
  const topNodes = [...graph.nodes.values()].sort((a,b) => (graph.adjacency.get(b.id)?.size??0) - (graph.adjacency.get(a.id)?.size??0)).slice(0,5);
  return { nodeCount:n, edgeCount:graph.edges.size, byType, density, topNodes };
}
