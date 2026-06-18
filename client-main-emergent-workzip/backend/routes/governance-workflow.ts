/**
 * Phase 5 routes — /api/gov/*
 *   /workflows, /reviews, /reviews/propose (POST), /reviews/:id/decide (POST),
 *   /methodologies, /audit, /explainability/recent
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  listWorkflows, listReviews, proposeReview, decideReview,
  listMethodologies, auditFramework, GOVERNANCE_VERSION,
} from '../services/governance-engine.js';
import { wrap, currentMethodologies } from '../services/explainability-engine.js';
import { rateLimit, requireGovAdmin } from '../services/security-middleware.js';

const send = (res: Response, data: unknown) => res.json({ ok: true, data });
const fail = (res: Response, code: number, error: string, detail?: string) =>
  res.status(code).json({ ok: false, error, detail });

export function registerGovernanceWorkflowRoutes({ app, pool }: { app: Express; pool: Pool }) {

  app.get('/api/gov/workflows', async (_req, res) => {
    try {
      const data = await listWorkflows(pool);
      send(res, wrap({ workflows: data }, {
        score_type: 'governance_workflows',
        methodology: { versions: { governance: GOVERNANCE_VERSION } },
        rationale: 'Current approval workflow definitions for ontology, role DNA, weighting and benchmark methodologies.',
      }));
    } catch (e) { fail(res, 500, 'workflows_failed', String((e as Error).message)); }
  });

  app.get('/api/gov/reviews', async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const data = await listReviews(pool, status);
      send(res, wrap({ reviews: data, status_filter: status ?? null }, {
        score_type: 'governance_reviews',
        methodology: { versions: { governance: GOVERNANCE_VERSION } },
        rationale: 'Pending/approved/rejected reviews of governance-protected entities.',
      }));
    } catch (e) { fail(res, 500, 'reviews_failed', String((e as Error).message)); }
  });

  const govMutationLimit = rateLimit({ max: 30, windowMs: 60_000, pool });
  const govAdmin = requireGovAdmin(pool);

  app.post('/api/gov/reviews/propose', govMutationLimit, govAdmin, async (req, res) => {
    try {
      const { workflow_id, entity_type, entity_id, proposer, change_diff, rationale } = req.body ?? {};
      if (!workflow_id || !entity_type || !entity_id || !proposer || !rationale)
        return fail(res, 400, 'missing_required_fields');
      const row = await proposeReview(pool, {
        workflow_id, entity_type, entity_id, proposer,
        change_diff: change_diff ?? {}, rationale,
      });
      const methVersions = await currentMethodologies(pool);
      send(res, wrap({ review: row }, {
        score_type: 'governance_review_propose',
        methodology: { versions: { governance: GOVERNANCE_VERSION, ...methVersions } },
        rationale: `Review ${row.id} created in pending state. Decision required from ${row.entity_type} workflow approver.`,
      }));
    } catch (e) { fail(res, 500, 'propose_failed', String((e as Error).message)); }
  });

  app.post('/api/gov/reviews/:id/decide', govMutationLimit, govAdmin, async (req, res) => {
    try {
      const { reviewer, decision, rationale } = req.body ?? {};
      if (!reviewer || !decision) return fail(res, 400, 'missing_reviewer_or_decision');
      if (!['approved','rejected','escalated'].includes(decision))
        return fail(res, 400, 'invalid_decision');
      const row = await decideReview(pool, {
        review_id: req.params.id, reviewer, decision, rationale,
      });
      if (!row) return fail(res, 404, 'review_not_pending');
      const methVersions = await currentMethodologies(pool);
      send(res, wrap({ review: row }, {
        score_type: 'governance_review_decide',
        methodology: { versions: { governance: GOVERNANCE_VERSION, ...methVersions } },
        rationale: `Review ${row.id} ${decision} by ${reviewer}. Audit framework captured the decision.`,
      }));
    } catch (e) { fail(res, 500, 'decide_failed', String((e as Error).message)); }
  });

  app.get('/api/gov/methodologies', async (req, res) => {
    try {
      const currentOnly = String(req.query.current ?? 'false') === 'true';
      const data = await listMethodologies(pool, currentOnly);
      send(res, wrap({ methodologies: data, current_only: currentOnly }, {
        score_type: 'methodology_registry',
        methodology: { versions: { governance: GOVERNANCE_VERSION } },
        rationale: 'Versioned methodology registry — every scoring path declares which version produced it.',
      }));
    } catch (e) { fail(res, 500, 'methodologies_failed', String((e as Error).message)); }
  });

  app.get('/api/gov/audit', async (req, res) => {
    try {
      const domain = req.query.domain ? String(req.query.domain) : null;
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10)));
      const { rows } = await pool.query(
        `SELECT id, ts::text, actor, action, entity_type, entity_id, domain, payload,
                ip_address, user_agent, request_id, outcome
           FROM gov_audit_framework
          WHERE ($1::text IS NULL OR domain = $1)
          ORDER BY ts DESC LIMIT $2`,
        [domain, limit]);
      send(res, wrap({ count: rows.length, events: rows }, {
        score_type: 'audit_framework',
        methodology: { versions: { governance: GOVERNANCE_VERSION } },
        rationale: 'Centralised cross-domain audit trail for governance, security and intelligence events.',
      }));
    } catch (e) { fail(res, 500, 'audit_failed', String((e as Error).message)); }
  });

  app.get('/api/gov/explainability/recent', async (req, res) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
      const scoreType = req.query.score_type ? String(req.query.score_type) : null;
      const { rows } = await pool.query(
        `SELECT id, score_type, entity_id, score::float AS score, contributors,
                weighting_version, methodology_version, cohort_id, confidence_tier,
                freshness_days, computed_at::text
           FROM gov_explainability_logs
          WHERE ($1::text IS NULL OR score_type = $1)
          ORDER BY computed_at DESC LIMIT $2`,
        [scoreType, limit]);
      send(res, wrap({ count: rows.length, explanations: rows }, {
        score_type: 'explainability_log',
        methodology: { versions: { governance: GOVERNANCE_VERSION } },
        rationale: 'Recent per-score contributor decompositions captured by the explainability engine.',
      }));
    } catch (e) { fail(res, 500, 'explainability_failed', String((e as Error).message)); }
  });
}
