/**
 * Scientific Competency Intelligence — Phase 2 routes
 * Mounted under /api/sci/*. Read-only against sci_* tables.
 * Every response wraps via explainability-engine.wrap() with methodology
 * versions and the platform-wide language policy envelope.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { createBarsEngine, BARS_ENGINE_VERSION } from '../services/bars-engine.js';
import { createFrameworkIntelligence, FRAMEWORK_INTELLIGENCE_VERSION } from '../services/framework-intelligence.js';
import { createCompetencyGraphEngine, COMPETENCY_GRAPH_VERSION } from '../services/competency-graph-engine.js';
import { createSciPsychometricEngine, SCI_PSYCHOMETRIC_VERSION, cronbachAlpha, reliabilityTier, cohensKappa, adverseImpact, testRetest } from '../services/sci-psychometric-engine.js';
import { createConfidenceEngine, CONFIDENCE_ENGINE_VERSION, computeConfidence } from '../services/competency-confidence-engine.js';
import { createSciGapIntelligence, SCI_GAP_INTELLIGENCE_VERSION } from '../services/sci-gap-intelligence.js';
import { wrap } from '../services/explainability-engine.js';

const METHOD_VERSIONS = {
  bars_engine:           BARS_ENGINE_VERSION,
  framework_intelligence:FRAMEWORK_INTELLIGENCE_VERSION,
  competency_graph:      COMPETENCY_GRAPH_VERSION,
  sci_psychometric:      SCI_PSYCHOMETRIC_VERSION,
  confidence_engine:     CONFIDENCE_ENGINE_VERSION,
  sci_gap_intelligence:  SCI_GAP_INTELLIGENCE_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: [
    'developmental readiness',
    'capability proximity',
    'evidence-weighted confidence',
    'reliability tier',
    'behavioural anchor',
  ],
  disallowed: [
    'hiring outcome', 'promotion likelihood', 'candidate suitability', 'pass/fail',
  ],
};

function parseScores(raw: any): Record<string, number> | null {
  if (!raw) return null;
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (o && typeof o === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(o)) if (typeof v === 'number') out[k] = v;
      return out;
    }
  } catch { /* ignore */ }
  return null;
}

function demoScores(): Record<string, number> {
  return { EIQ: 62, COM: 58, COG: 71, EXE: 66, LEA: 48, STR: 41, LBI: 55, ADP: 60, TEC: 64 };
}

export function registerScientificCompetencyRoutes({ app, pool }: { app: Express; pool: Pool }) {
  const bars = createBarsEngine(pool);
  const frameworks = createFrameworkIntelligence(pool);
  const graph = createCompetencyGraphEngine(pool);
  const psych = createSciPsychometricEngine(pool);
  const confidence = createConfidenceEngine(pool);
  const gaps = createSciGapIntelligence(pool);

  async function audit(domain: string, op: string, entityId: string | null, req: Request, payload: any = {}) {
    try {
      await pool.query(
        `INSERT INTO sci_audit_logs (domain, operation, entity_id, payload, request_id, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [domain, op, entityId, JSON.stringify(payload), req.headers['x-request-id'] ?? null, req.ip ?? null]
      );
    } catch { /* never block reads */ }
  }

  function guard(handler: (req: Request) => Promise<any>, scoreType: string, rationale: string) {
    return async (req: Request, res: Response) => {
      try {
        const data = await handler(req);
        const wrapped = wrap({ data }, {
          score_type: scoreType,
          score: null,
          contributors: [],
          methodology: { versions: METHOD_VERSIONS },
          rationale,
        });
        res.json({ ok: true, ...wrapped });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' });
      }
    };
  }

  // ── BARS ────────────────────────────────────────────────────────────
  app.get('/api/sci/bars/layers', guard(async (req) => {
    const out = await bars.listLayers();
    await audit('bars', 'list_layers', null, req);
    return out;
  }, 'bars_read', 'BARS role-layer enumeration'));

  app.get('/api/sci/bars/competencies', guard(async () => bars.listCompetencies(),
    'bars_read', 'BARS competency enumeration'));

  app.get('/api/sci/bars/:competency_id/:role_layer', guard(async (req) => {
    const anchors = await bars.getAnchors(String(req.params.competency_id), String(req.params.role_layer));
    await audit('bars', 'get_anchors', req.params.competency_id as string, req, { layer: req.params.role_layer });
    return anchors;
  }, 'bars_read', 'BARS behavioural anchors for competency × layer'));

  app.get('/api/sci/bars/:competency_id/:role_layer/resolve', guard(async (req) => {
    const score = Number(req.query.score ?? 50);
    return bars.describeProficiency(String(req.params.competency_id), String(req.params.role_layer), score);
  }, 'bars_resolve', 'BARS proficiency resolution from raw score'));

  app.get('/api/sci/bars/:role_layer/map', guard(async (req) => {
    const scores = parseScores(req.query.scores) ?? demoScores();
    return bars.mapScores(String(req.params.role_layer), scores);
  }, 'bars_map', 'BARS score-vector → anchor mapping'));

  // ── Functional frameworks ──────────────────────────────────────────
  app.get('/api/sci/frameworks', guard(async (req) => {
    const out = await frameworks.listFrameworks();
    await audit('framework', 'list', null, req, { count: out.length });
    return out;
  }, 'framework_list', 'Functional frameworks catalogue (SHRM/SFIA/NICE/CFA/PMI/Pragmatic/SAFe)'));

  app.get('/api/sci/frameworks/:id', guard(async (req) => {
    await audit('framework', 'detail', String(req.params.id), req);
    return frameworks.getFramework(String(req.params.id));
  }, 'framework_detail', 'Framework detail with domains + competencies'));

  app.get('/api/sci/frameworks/resolve/:text', guard(async (req) =>
    frameworks.resolveCompetency(String(req.params.text)),
    'framework_resolve', 'Fuzzy resolution of framework competency by code / name / alias'));

  app.get('/api/sci/frameworks/mappings/:competency_id', guard(async (req) =>
    frameworks.mappingsForOntologyCompetency(String(req.params.competency_id)),
    'framework_mappings', 'Frameworks mapped to a given ontology competency'));

  app.get('/api/sci/frameworks/:id/role/:role_id', guard(async (req) =>
    frameworks.expectationsForRole(String(req.params.role_id), String(req.params.id)),
    'framework_role_expectations', 'Framework-specific role expectations'));

  app.get('/api/sci/frameworks/:id/score', guard(async (req) => {
    const scores = parseScores(req.query.scores) ?? demoScores();
    return frameworks.scoreThroughFramework(String(req.params.id), scores);
  }, 'framework_score', 'Score user competency vector through framework lens'));

  // ── Competency graph ────────────────────────────────────────────────
  app.get('/api/sci/graph/edges', guard(async () => graph.allEdges(),
    'graph_edges', 'Full competency dependency edge set'));

  app.get('/api/sci/graph/adjacent/:competency_id', guard(async (req) =>
    graph.adjacent(String(req.params.competency_id)),
    'graph_adjacent', 'Adjacent competencies (1-hop in/out)'));

  app.get('/api/sci/graph/paths', guard(async (req) => {
    const from = String(req.query.from ?? '');
    const to   = String(req.query.to ?? '');
    const maxDepth = Math.min(8, Math.max(1, Number(req.query.max_depth ?? 5)));
    if (!from || !to) throw new Error('from and to are required');
    return graph.traversePaths(from, to, maxDepth);
  }, 'graph_paths', 'BFS dependency paths between two competencies (depth-capped)'));

  app.get('/api/sci/graph/influence', guard(async (req) => {
    const scores = parseScores(req.query.scores) ?? demoScores();
    return graph.influenceLift(scores);
  }, 'graph_influence', 'Influence-weighted score-lift estimate per competency'));

  app.get('/api/sci/graph/sequence/:target', guard(async (req) => {
    const scores = parseScores(req.query.scores) ?? demoScores();
    return graph.sequenceInterventions(String(req.params.target), scores,
      Math.min(10, Math.max(1, Number(req.query.max_steps ?? 5))));
  }, 'graph_sequence', 'Intervention sequencing to develop a target competency'));

  app.get('/api/sci/graph/evolution-paths', guard(async (req) =>
    graph.listEvolutionPaths(req.query.target_role_id as string | undefined),
    'graph_evolution', 'Canonical capability evolution paths'));

  // ── Psychometrics ──────────────────────────────────────────────────
  app.get('/api/sci/psychometrics/demo', guard(async (req) => {
    const seed = Number(req.query.seed ?? 42);
    return psych.fullDiagnostics(seed);
  }, 'psychometrics_demo', 'Full demo psychometric diagnostics (α + retest + κ + AIR)'));

  app.post('/api/sci/psychometrics/cronbach', async (req, res) => {
    try {
      const matrix = req.body?.responses;
      if (!Array.isArray(matrix) || !Array.isArray(matrix[0])) {
        return res.status(400).json({ ok: false, error: 'responses must be a 2D numeric matrix' });
      }
      const a = cronbachAlpha(matrix);
      const data = { ...a, reliability_tier: reliabilityTier(a.alpha) };
      await audit('psychometric', 'cronbach', null, req, { k: a.k_items, n: a.n_respondents });
      res.json({ ok: true, ...wrap({ data }, {
        score_type: 'psychometrics_cronbach', score: a.alpha, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Cronbach alpha = k/(k-1) × (1 − Σ Var(i) / Var(total))',
      })});
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' });
    }
  });

  app.post('/api/sci/psychometrics/kappa', async (req, res) => {
    try {
      const { rater_a, rater_b } = req.body ?? {};
      if (!Array.isArray(rater_a) || !Array.isArray(rater_b)) {
        return res.status(400).json({ ok: false, error: 'rater_a and rater_b required (numeric arrays)' });
      }
      const data = cohensKappa(rater_a, rater_b);
      res.json({ ok: true, ...wrap({ data }, {
        score_type: 'psychometrics_kappa', score: data.kappa, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Cohen kappa κ = (Pa − Pe) / (1 − Pe)',
      })});
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/sci/psychometrics/adverse-impact', async (req, res) => {
    try {
      const { group_a_positive, group_a_total, group_b_positive, group_b_total } = req.body ?? {};
      const data = adverseImpact(+group_a_positive, +group_a_total, +group_b_positive, +group_b_total);
      res.json({ ok: true, ...wrap({ data }, {
        score_type: 'psychometrics_adverse_impact', score: data.ratio, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Four-fifths rule: ratio = groupB/groupA selection rate; ≥0.80 passes',
      })});
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/sci/psychometrics/test-retest', async (req, res) => {
    try {
      const { t1, t2 } = req.body ?? {};
      if (!Array.isArray(t1) || !Array.isArray(t2)) {
        return res.status(400).json({ ok: false, error: 't1 and t2 numeric arrays required' });
      }
      const data = testRetest(t1, t2);
      res.json({ ok: true, ...wrap({ data }, {
        score_type: 'psychometrics_test_retest', score: data.r, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Test-retest reliability = Pearson r across two administrations',
      })});
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.get('/api/sci/psychometrics/assessment/:assessment_id', guard(async (req) =>
    psych.listResults(String(req.params.assessment_id)),
    'psychometrics_history', 'Historical psychometric results for an assessment'));

  // ── Confidence engine ──────────────────────────────────────────────
  app.post('/api/sci/confidence/compute', async (req, res) => {
    try {
      const components = req.body?.components ?? {
        reliability: 0.78, behavioral_consistency: 0.72, evidence_validation: 0.65,
        historical_stability: 0.7, benchmark_confidence: 0.6,
      };
      const data = computeConfidence(components, req.body?.weights);
      res.json({ ok: true, ...wrap({ data }, {
        score_type: 'competency_confidence', score: data.confidence,
        contributors: Object.entries(data.components).map(([k, v]) => ({
          source: k, value: v as number, weight: (data.weights as any)[k], rationale: `${k} component`,
        })),
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Confidence = Σ w_i · component_i (reliability/consistency/evidence/history/benchmark)',
      })});
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.get('/api/sci/confidence/vector', guard(async (req) => {
    const scores = parseScores(req.query.scores) ?? demoScores();
    const sessionId = String(req.query.session_id ?? 'demo');
    const persist = String(req.query.persist ?? '') === 'true';
    const vec = confidence.scoreVector(sessionId, scores);
    if (persist && sessionId !== 'demo') {
      for (const row of vec) {
        try {
          await confidence.persist(sessionId, row.competency_id, row.raw_score, {
            confidence: row.confidence, reliability_tier: row.reliability_tier,
            evidence_strength: row.evidence_strength, components: row.components, weights: row.weights,
          });
        } catch { /* non-blocking */ }
      }
    }
    return { session_id: sessionId, persisted: persist && sessionId !== 'demo', items: vec };
  }, 'confidence_vector', 'Confidence-weighted bundle for an entire competency vector (persists snapshots when ?persist=true and a real session_id is supplied)'));

  app.get('/api/sci/confidence/session/:session_id', guard(async (req) =>
    confidence.listForSession(String(req.params.session_id)),
    'confidence_session', 'Persisted confidence snapshots for a session'));

  // ── Gap intelligence ───────────────────────────────────────────────
  app.get('/api/sci/gaps/compute', guard(async (req) => {
    const current = parseScores(req.query.current) ?? demoScores();
    const expected = parseScores(req.query.expected) ?? {
      EIQ: 70, COM: 70, COG: 72, EXE: 72, LEA: 70, STR: 65, LBI: 70, ADP: 70, TEC: 70,
    };
    return gaps.computeGaps(current, expected);
  }, 'gaps_compute', 'Typed gap analysis with dependency-aware prioritisation'));

  // ── Methodology meta ───────────────────────────────────────────────
  app.get('/api/sci/_meta/versions', (_req, res) => {
    res.json({ ok: true, data: METHOD_VERSIONS, language_policy: LANGUAGE_POLICY });
  });
}
