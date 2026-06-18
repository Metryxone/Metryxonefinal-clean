/**
 * Phase 3 — Market Intelligence + Evidence + Mobility + Dynamic Ontology routes
 * Mounted at /api/m3/*. Every response wrapped in explainability envelope.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { wrap } from '../services/explainability-engine';
import { createMarketIntelligence, MARKET_INTELLIGENCE_VERSION } from '../services/m3-market-intelligence';
import { createRoleNormalization, ROLE_NORMALIZATION_VERSION } from '../services/m3-role-normalization';
import { createMarketDemand, MARKET_DEMAND_VERSION } from '../services/m3-market-demand';
import { createEvidenceGraph, EVIDENCE_GRAPH_VERSION } from '../services/m3-evidence-graph';
import { createDynamicOntology, DYNAMIC_ONTOLOGY_VERSION } from '../services/m3-dynamic-ontology';
import { createCareerMobility, CAREER_MOBILITY_VERSION } from '../services/m3-career-mobility';
import { createConfidenceV2, CONFIDENCE_V2_VERSION } from '../services/m3-confidence-v2';

const METHOD_VERSIONS = {
  market_intelligence: MARKET_INTELLIGENCE_VERSION,
  role_normalization:  ROLE_NORMALIZATION_VERSION,
  market_demand:       MARKET_DEMAND_VERSION,
  evidence_graph:      EVIDENCE_GRAPH_VERSION,
  dynamic_ontology:    DYNAMIC_ONTOLOGY_VERSION,
  career_mobility:     CAREER_MOBILITY_VERSION,
  confidence_v2:       CONFIDENCE_V2_VERSION,
};

function parseJson(v: any): any { try { return v ? JSON.parse(String(v)) : null; } catch { return null; } }

export function registerMarketIntelligencePhase3Routes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;
  const mi  = createMarketIntelligence(pool);
  const rn  = createRoleNormalization(pool);
  const md  = createMarketDemand(pool);
  const eg  = createEvidenceGraph(pool);
  const dyn = createDynamicOntology(pool);
  const cm  = createCareerMobility(pool);
  const cv2 = createConfidenceV2(pool);

  async function audit(domain: string, action: string, subject: string | null, req: Request, payload: any = {}) {
    try {
      const id = `m3a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
      await pool.query(
        `INSERT INTO m3_audit_logs(id, domain, action, subject_id, payload, request_id, ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, domain, action, subject, JSON.stringify(payload),
         (req.headers['x-request-id'] as string) ?? null, req.ip ?? null]);
    } catch { /* non-blocking */ }
  }

  function guard(handler: (req: Request) => Promise<any>, scoreType: string, rationale: string) {
    return async (req: Request, res: Response) => {
      try {
        const data = await handler(req);
        const wrapped = wrap({ data }, {
          score_type: scoreType, score: null, contributors: [],
          methodology: { versions: METHOD_VERSIONS }, rationale,
        });
        res.json({ ok: true, ...wrapped });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' });
      }
    };
  }

  // ── Market Intelligence (read) ─────────────────────────────────────
  app.get('/api/m3/sources',            guard(() => mi.listSources(),                 'm3_sources',   'Registered ingestion sources with trust scores'));
  app.get('/api/m3/market-roles',       guard((req) => mi.listMarketRoles(+(req.query.limit ?? 50)), 'm3_market_roles', 'Observed market roles ranked by posting volume'));
  app.get('/api/m3/market-competencies',guard(() => mi.listMarketCompetencies(),      'm3_market_comps','Market-observed competencies joined with global demand'));
  app.get('/api/m3/skill-demand',       guard((req) => mi.skillDemand(String(req.query.geo ?? 'GLOBAL')), 'm3_skill_demand','Per-competency demand snapshot for a geography'));
  app.get('/api/m3/salary-trends',      guard((req) => mi.salaryTrends(req.query.geo ? String(req.query.geo) : undefined), 'm3_salary','Salary percentiles and YoY change by role'));
  app.get('/api/m3/role-trends',        guard(() => mi.roleTrends(),                  'm3_role_trends','Hiring velocity by role from job-posting analytics'));
  app.get('/api/m3/emerging',           guard(() => mi.emergingCompetencies(),        'm3_emerging','Emerging competencies with detection evidence'));
  app.get('/api/m3/industry-demand',    guard(() => mi.industryDemand(),              'm3_ind_demand','Industry × role-family growth'));
  app.get('/api/m3/geography-demand',   guard(() => mi.geographyDemand(),             'm3_geo_demand','Geography × role-family demand'));

  // Ingest (POST) — appends to history; non-destructive
  app.post('/api/m3/ingest', async (req, res) => {
    try {
      const body = req.body ?? {};
      if (!body.raw_title || !body.source_code) return res.status(400).json({ ok: false, error: 'raw_title and source_code required' });
      const out = await mi.ingestPosting(body);
      await audit('ingest', 'posting', body.raw_title, req, body);
      res.json({ ok: true, ...wrap({ data: out }, {
        score_type: 'm3_ingest', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Append-only ingestion — resolved via exact/alias; unmatched titles logged as emerging candidates',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ── AI Role Normalization ──────────────────────────────────────────
  app.get('/api/m3/normalize/resolve', guard(async (req) => {
    const title = String(req.query.title ?? '').trim();
    if (!title) throw new Error('title required');
    return rn.resolveTitle(title, req.query.session_id ? String(req.query.session_id) : undefined);
  }, 'm3_normalize_resolve', 'Resolve a raw job title via exact→alias→16-dim cosine embedding'));

  app.get('/api/m3/normalize/similar', guard(async (req) => {
    const title = String(req.query.title ?? '').trim();
    if (!title) throw new Error('title required');
    return rn.similar(title, +(req.query.k ?? 5));
  }, 'm3_normalize_similar', 'Cosine-ranked nearest market roles to a raw title'));

  app.get('/api/m3/normalize/clusters', guard(() => rn.clusters(), 'm3_clusters', 'Lightweight semantic clusters over the market role corpus'));

  // ── Market Demand Scoring ──────────────────────────────────────────
  app.get('/api/m3/demand/competency', guard((req) => md.competencyDemand(req.query.competency ? String(req.query.competency) : undefined),
    'm3_demand_competency', 'Composite market demand per competency'));
  app.get('/api/m3/demand/role',       guard(() => md.roleDemand(),    'm3_demand_role',     'Composite market score per role'));
  app.get('/api/m3/demand/forecasts',  guard(() => md.forecasts(),     'm3_forecasts',       'Future skill forecasts ranked by score'));
  app.get('/api/m3/demand/velocity',   guard(() => md.velocity(),      'm3_velocity',        'Direction × magnitude of market velocity'));

  app.post('/api/m3/demand/recompute', async (req, res) => {
    try {
      const { competency_id, hiring_frequency, salary_velocity, industry_growth, future_relevance, automation_risk } = req.body ?? {};
      if (!competency_id) return res.status(400).json({ ok: false, error: 'competency_id required' });
      const out = await md.recomputeCompetency(String(competency_id), {
        hiring_frequency: +hiring_frequency, salary_velocity: +salary_velocity,
        industry_growth: +industry_growth, future_relevance: +future_relevance, automation_risk: +automation_risk,
      });
      await audit('demand', 'recompute', competency_id, req, req.body);
      res.json({ ok: true, ...wrap({ data: out }, {
        score_type: 'm3_demand_recompute', score: out.market_demand, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Composite = 0.30·hiring + 0.20·salary + 0.20·industry + 0.25·future − 0.15·automation',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ── Evidence Graph ─────────────────────────────────────────────────
  app.get('/api/m3/evidence/sources', guard(() => eg.sources(),
    'm3_evidence_sources', 'Catalogue of evidence sources with trust weights'));

  app.get('/api/m3/evidence/:subject_id', guard(async (req) =>
    eg.listEvidence(String(req.params.subject_id), req.query.competency ? String(req.query.competency) : undefined),
    'm3_evidence_list', 'Evidence nodes for a subject (optional ?competency=)'));

  app.get('/api/m3/evidence/:subject_id/graph', guard((req) => eg.graph(String(req.params.subject_id)),
    'm3_evidence_graph', 'Evidence node + link graph for a subject'));

  app.get('/api/m3/evidence/:subject_id/confidence', guard((req) => eg.confidence(String(req.params.subject_id)),
    'm3_evidence_confidence', 'Per-competency aggregated evidence strength + verification level'));

  app.post('/api/m3/evidence/add', async (req, res) => {
    try {
      const out = await eg.addEvidence(req.body);
      await audit('evidence', 'add', req.body?.subject_id, req, req.body);
      res.json({ ok: true, ...wrap({ data: out }, {
        score_type: 'm3_evidence_add', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Evidence weight = observed_strength × source.trust_weight; aggregated confidence refreshed',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ── Dynamic Ontology ───────────────────────────────────────────────
  app.get('/api/m3/dyn/emerging-roles',  guard((req) => dyn.emergingRoles(+(req.query.threshold ?? 70)),  'm3_dyn_roles', 'Emerging role candidates above threshold'));
  app.get('/api/m3/dyn/emerging-skills', guard((req) => dyn.emergingSkills(+(req.query.threshold ?? 70)), 'm3_dyn_skills','Emerging skill candidates above threshold'));
  app.get('/api/m3/dyn/deprecated',      guard(() => dyn.deprecated(),                                    'm3_dyn_deprec','Deprecated competencies'));
  app.get('/api/m3/dyn/events',          guard(() => dyn.events(),                                        'm3_dyn_events','Ontology evolution event log (proposals only — onto_* untouched)'));

  app.post('/api/m3/dyn/propose', async (req, res) => {
    try {
      const out = await dyn.proposeEvent(req.body);
      await audit('dyn_ontology', 'propose', req.body?.target_id, req, req.body);
      res.json({ ok: true, ...wrap({ data: out }, {
        score_type: 'm3_dyn_propose', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Proposes change event for governance review; never mutates onto_* directly',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/m3/dyn/review', async (req, res) => {
    try {
      const { kind, id, status } = req.body ?? {};
      if (!['role','skill'].includes(kind) || !id || !status) return res.status(400).json({ ok: false, error: 'kind, id, status required' });
      const out = await dyn.reviewCandidate(kind, id, status);
      await audit('dyn_ontology', 'review', id, req, req.body);
      res.json({ ok: true, ...wrap({ data: out }, {
        score_type: 'm3_dyn_review', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS }, rationale: 'Candidate status update',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ── Career Mobility ────────────────────────────────────────────────
  app.get('/api/m3/mobility/adjacent/:role_id', guard((req) => cm.adjacent(String(req.params.role_id)),
    'm3_mobility_adjacent', 'Adjacent roles with capability/market/composite scores'));

  app.get('/api/m3/mobility/paths', guard(async (req) => {
    const target = String(req.query.to ?? '');
    if (!target) throw new Error('to required');
    return cm.pathsTo(target, +(req.query.depth ?? 3));
  }, 'm3_mobility_paths', 'BFS depth-capped paths into a target role (cycle-safe, cumulative-strength)'));

  app.get('/api/m3/mobility/transitions', guard(() => cm.transitions(), 'm3_transitions', 'Directed transition probabilities + median months'));
  app.get('/api/m3/mobility/career-paths',  guard(() => cm.careerPaths(),  'm3_career_paths','Canonical career path sequences'));
  app.get('/api/m3/mobility/capability-adjacency', guard(() => cm.capabilityAdjacency(), 'm3_cap_adj','Competency-level adjacency'));

  app.get('/api/m3/mobility/recommend', guard(async (req) => {
    const roleId = String(req.query.role ?? '');
    const scores = parseJson(req.query.scores) ?? { TEC: 70, LEA: 60, EIQ: 65, STR: 60, COM: 65, ADP: 65, COG: 70 };
    if (!roleId) throw new Error('role required');
    return cm.recommend(roleId, scores);
  }, 'm3_mobility_recommend', 'Mobility recommendations grounded in capability similarity + market adjacency + user readiness'));

  // ── Confidence v2 (market-aware) ───────────────────────────────────
  app.get('/api/m3/confidence/vector', guard(async (req) => {
    const subject = String(req.query.subject_id ?? 'demo_user');
    const scores = parseJson(req.query.scores) ?? { TEC: 70, LEA: 60, EIQ: 65, STR: 60, COM: 65, ADP: 65, COG: 70 };
    return cv2.vector(subject, scores);
  }, 'm3_confidence_v2', 'v2 confidence: assessment_reliability + evidence + history + market_validation + benchmark stability'));

  // ── Meta ───────────────────────────────────────────────────────────
  app.get('/api/m3/_meta/versions', (_req, res) => res.json({ ok: true, data: METHOD_VERSIONS }));
}
