/**
 * Phase 3 — Career Mobility & Pathway Intelligence routes (read-only).
 *
 * Endpoints (all GET under `/api/mobility/*`):
 *   /roles                  — list ontology roles (convenience for UI)
 *   /compare                — compare current vs target role
 *   /graph                  — mobility graph from current role across all targets
 *   /adjacent               — adjacent roles with adjacency basis
 *   /transitions            — directed canonical transitions
 *   /transferability        — competency × competency transferability rows
 *   /pathways               — list curated developmental pathways
 *   /pathway/:id            — personalised pathway projection
 *   /maturity/:competency   — 5-level capability maturity for a competency
 *   /recommendations        — ranked developmental recommendations
 *   /report                 — full bundle (comparison + pathways + recs)
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { compareRoles, adjacentRoles, mobilityGraph, MOBILITY_VERSION } from '../services/mobility-engine.js';
import { listPathways, personalisedPathway, getMaturity, PATHWAY_VERSION } from '../services/pathway-engine.js';
import { generateRecommendations, fullMobilityReport, RECOMMENDATION_VERSION } from '../services/recommendation-engine.js';
import { demoUserScores } from '../services/adaptive-benchmark.js';

function send(res: Response, data: unknown) {
  res.json({ ok: true,
    versions: { mobility: MOBILITY_VERSION, pathway: PATHWAY_VERSION, recommendation: RECOMMENDATION_VERSION },
    data });
}
function fail(res: Response, code: number, error: string, detail?: unknown) {
  res.status(code).json({ ok: false, error, detail });
}

async function parseScores(req: Request, pool: Pool): Promise<Record<string, number>> {
  const raw = req.query.scores;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  if (req.query.demo === 'true') {
    const { rows } = await pool.query<{ id: string }>(`SELECT id FROM onto_competencies`);
    return demoUserScores(String(req.query.session_id ?? 'demo'), rows.map(r => r.id));
  }
  return {};
}

async function audit(pool: Pool, e: { event_type: string; endpoint: string; req: Request;
                                       from?: string|null; to?: string|null; resp?: Record<string, unknown> }) {
  try {
    await pool.query(
      `INSERT INTO mobility_audit_logs
         (event_type, endpoint, session_id, from_role_id, to_role_id, request_summary, response_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ e.event_type, e.endpoint,
        String(e.req.query.session_id ?? '') || null,
        e.from ?? null, e.to ?? null,
        { query: pick(e.req.query, ['from_role_id','to_role_id','pathway_id','competency_id','demo','seniority','layer_id']) },
        e.resp ?? {},
      ]);
  } catch { /* never break the response */ }
}
function pick<T extends Record<string, any>>(obj: T, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export function registerMobilityRoutes({ app, pool }: { app: Express; pool: Pool }) {

  // GET /api/mobility/roles -------------------------------------------------
  app.get('/api/mobility/roles', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, title, role_family_id, layer_id, seniority FROM onto_roles WHERE deprecated = false ORDER BY title`);
      await audit(pool, { event_type: 'mobility.roles', endpoint: '/api/mobility/roles', req, resp: { count: rows.length } });
      send(res, rows);
    } catch (e) { fail(res, 500, 'roles_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/compare ----------------------------------------------
  app.get('/api/mobility/compare', async (req, res) => {
    try {
      const from = String(req.query.from_role_id ?? '');
      const to   = String(req.query.to_role_id ?? '');
      if (!from || !to) return fail(res, 400, 'from_and_to_role_required');
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const cmp = await compareRoles(pool, { from_role_id: from, to_role_id: to, user_scores: scores });
      await audit(pool, { event_type: 'mobility.compare', endpoint: '/api/mobility/compare', req,
                          from, to, resp: { mobility_score: cmp.mobility_score, gaps: cmp.competency_gaps.length } });
      send(res, cmp);
    } catch (e) { fail(res, 500, 'compare_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/graph ------------------------------------------------
  app.get('/api/mobility/graph', async (req, res) => {
    try {
      const from = String(req.query.from_role_id ?? '');
      if (!from) return fail(res, 400, 'from_role_id_required');
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const g = await mobilityGraph(pool, { from_role_id: from, user_scores: scores });
      await audit(pool, { event_type: 'mobility.graph', endpoint: '/api/mobility/graph', req,
                          from, resp: { targets: g.length } });
      send(res, g);
    } catch (e) { fail(res, 500, 'graph_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/adjacent ---------------------------------------------
  app.get('/api/mobility/adjacent', async (req, res) => {
    try {
      const roleId = String(req.query.role_id ?? '');
      if (!roleId) return fail(res, 400, 'role_id_required');
      const rows = await adjacentRoles(pool, roleId);
      await audit(pool, { event_type: 'mobility.adjacent', endpoint: '/api/mobility/adjacent', req,
                          from: roleId, resp: { adjacents: rows.length } });
      send(res, rows);
    } catch (e) { fail(res, 500, 'adjacent_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/transitions ------------------------------------------
  app.get('/api/mobility/transitions', async (req, res) => {
    try {
      const fromId = typeof req.query.from_role_id === 'string' ? String(req.query.from_role_id) : null;
      const { rows } = await pool.query(
        `SELECT t.*, fr.title AS from_title, tr.title AS to_title
           FROM mobility_role_transitions t
           JOIN onto_roles fr ON fr.id = t.from_role_id
           JOIN onto_roles tr ON tr.id = t.to_role_id
          WHERE ($1::text IS NULL OR t.from_role_id = $1)
          ORDER BY t.from_role_id, t.difficulty`,
        [fromId]);
      await audit(pool, { event_type: 'mobility.transitions', endpoint: '/api/mobility/transitions', req,
                          from: fromId, resp: { count: rows.length } });
      send(res, rows);
    } catch (e) { fail(res, 500, 'transitions_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/transferability --------------------------------------
  app.get('/api/mobility/transferability', async (req, res) => {
    try {
      const src = typeof req.query.source_competency_id === 'string' ? String(req.query.source_competency_id) : null;
      const { rows } = await pool.query(
        `SELECT m.source_competency_id, sc.canonical_name AS source_name,
                m.target_competency_id, tc.canonical_name AS target_name,
                m.transferability_score::float AS transferability_score,
                m.transfer_type, m.rationale, m.basis
           FROM mobility_transferability_maps m
           JOIN onto_competencies sc ON sc.id = m.source_competency_id
           JOIN onto_competencies tc ON tc.id = m.target_competency_id
          WHERE ($1::text IS NULL OR m.source_competency_id = $1)
          ORDER BY m.transferability_score DESC`, [src]);
      await audit(pool, { event_type: 'mobility.transferability', endpoint: '/api/mobility/transferability', req,
                          resp: { count: rows.length, source: src } });
      send(res, rows);
    } catch (e) { fail(res, 500, 'transferability_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/pathways ---------------------------------------------
  app.get('/api/mobility/pathways', async (req, res) => {
    try {
      const rows = await listPathways(pool);
      await audit(pool, { event_type: 'mobility.pathways', endpoint: '/api/mobility/pathways', req, resp: { count: rows.length } });
      send(res, rows);
    } catch (e) { fail(res, 500, 'pathways_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/pathway/:id ------------------------------------------
  app.get('/api/mobility/pathway/:id', async (req, res) => {
    try {
      const pathway_id = req.params.id;
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const r = await personalisedPathway(pool, { pathway_id, user_scores: scores });
      if (!r) return fail(res, 404, 'pathway_not_found');
      await audit(pool, { event_type: 'mobility.pathway', endpoint: '/api/mobility/pathway/:id', req,
                          resp: { pathway_id, steps: r.steps.length } });
      send(res, r);
    } catch (e) { fail(res, 500, 'pathway_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/maturity/:competency ---------------------------------
  app.get('/api/mobility/maturity/:competency', async (req, res) => {
    try {
      const competency_id = req.params.competency;
      const levels = await getMaturity(pool, competency_id);
      if (!levels.length) return fail(res, 404, 'no_maturity_for_competency');
      await audit(pool, { event_type: 'mobility.maturity', endpoint: '/api/mobility/maturity/:competency', req,
                          resp: { competency_id, levels: levels.length } });
      send(res, { competency_id, levels });
    } catch (e) { fail(res, 500, 'maturity_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/recommendations --------------------------------------
  app.get('/api/mobility/recommendations', async (req, res) => {
    try {
      const from = String(req.query.from_role_id ?? '');
      const to   = String(req.query.to_role_id ?? '');
      if (!from || !to) return fail(res, 400, 'from_and_to_role_required');
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const r = await generateRecommendations(pool, { from_role_id: from, to_role_id: to, user_scores: scores });
      await audit(pool, { event_type: 'mobility.recommendations', endpoint: '/api/mobility/recommendations', req,
                          from, to, resp: { recommendations: r.recommendations.length } });
      send(res, r);
    } catch (e) { fail(res, 500, 'recommendations_failed', String((e as Error).message)); }
  });

  // GET /api/mobility/report -----------------------------------------------
  app.get('/api/mobility/report', async (req, res) => {
    try {
      const from = String(req.query.from_role_id ?? '');
      const to   = String(req.query.to_role_id ?? '');
      if (!from || !to) return fail(res, 400, 'from_and_to_role_required');
      const scores = await parseScores(req, pool);
      if (!Object.keys(scores).length) return fail(res, 400, 'scores_or_demo_required');
      const r = await fullMobilityReport(pool, { from_role_id: from, to_role_id: to, user_scores: scores });
      await audit(pool, { event_type: 'mobility.report', endpoint: '/api/mobility/report', req,
                          from, to, resp: { recommendations: r.recommendations.length,
                                            mobility_score: r.comparison.mobility_score } });
      send(res, r);
    } catch (e) { fail(res, 500, 'report_failed', String((e as Error).message)); }
  });
}
