/**
 * Phase 4 routes — /api/longitudinal/*
 *   /history, /velocity, /trajectory, /maturity, /trends
 * Demo mode: ?demo=true&user_id=demo_user_alpha
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  getUserHistory, getUserVelocity, getUserTrajectory, getMaturityTracking,
  LONGITUDINAL_VERSION, TRAJECTORY_VERSION,
} from '../services/longitudinal-engine.js';
import { getBenchmarkTrends } from '../services/workforce-analytics.js';
import { wrap, currentMethodologies, decomposeWeightedComposite, buildRationale, logExplanation } from '../services/explainability-engine.js';
import { auditFramework } from '../services/governance-engine.js';

const DEMO_USERS = ['demo_user_alpha','demo_user_beta','demo_user_gamma','demo_user_delta','demo_user_epsilon'];
const resolveUser = (req: Request): string => {
  const explicit = String(req.query.user_id ?? '');
  if (explicit) return explicit;
  if (String(req.query.demo) === 'true') return DEMO_USERS[0];
  return '';
};

const send = (res: Response, data: unknown) => res.json({ ok: true, data });
const fail = (res: Response, code: number, error: string, detail?: string) =>
  res.status(code).json({ ok: false, error, detail });

export function registerLongitudinalRoutes({ app, pool }: { app: Express; pool: Pool }) {

  app.get('/api/longitudinal/history', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return fail(res, 400, 'missing_user_id');
      const competency = req.query.competency_id ? String(req.query.competency_id) : undefined;
      const data = await getUserHistory(pool, userId, competency);
      await auditFramework(pool, { action: 'longitudinal.history', entity_type: 'user', entity_id: userId,
        domain: 'longitudinal', payload: { competency } });
      send(res, wrap({ user_id: userId, histories: data }, {
        score_type: 'history',
        methodology: { versions: { longitudinal: LONGITUDINAL_VERSION } },
        rationale: 'Append-only competency observations sourced from CAPADEX, Pragati and benchmark events.',
      }));
    } catch (e) { fail(res, 500, 'history_failed', String((e as Error).message)); }
  });

  app.get('/api/longitudinal/velocity', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return fail(res, 400, 'missing_user_id');
      const data = await getUserVelocity(pool, userId);
      await auditFramework(pool, { action: 'longitudinal.velocity', entity_type: 'user', entity_id: userId, domain: 'longitudinal' });
      send(res, wrap({ user_id: userId, velocity: data }, {
        score_type: 'velocity',
        methodology: { versions: { longitudinal: LONGITUDINAL_VERSION, trajectory: TRAJECTORY_VERSION } },
        rationale: 'Rate of change in points per 30 days, with EWMA momentum and consistency.',
      }));
    } catch (e) { fail(res, 500, 'velocity_failed', String((e as Error).message)); }
  });

  app.get('/api/longitudinal/trajectory', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return fail(res, 400, 'missing_user_id');
      const horizon = Math.min(24, Math.max(1, parseInt(String(req.query.horizon_months ?? '6'), 10)));
      const data = await getUserTrajectory(pool, userId, horizon);
      const methVersions = await currentMethodologies(pool);
      await auditFramework(pool, { action: 'longitudinal.trajectory', entity_type: 'user', entity_id: userId,
        domain: 'longitudinal', payload: { horizon } });
      // explainability snapshot — top trajectory contributors
      const contributors = data.slice(0, 5).map(t => ({
        feature_id: t.competency_id, feature_label: t.canonical_name,
        value: t.current, weight: 1 / data.length,
        contribution: Math.round((t.projection_upper - t.baseline) * 100) / 100,
        band: t.trajectory_type,
      }));
      await logExplanation(pool, {
        score_type: 'trajectory', entity_id: userId,
        contributors, weighting_version: 'n/a',
        methodology_version: TRAJECTORY_VERSION,
        confidence_tier: data[0]?.confidence_band ?? 'provisional',
      });
      send(res, wrap({ user_id: userId, horizon_months: horizon, trajectories: data }, {
        score_type: 'trajectory',
        methodology: { versions: { trajectory: TRAJECTORY_VERSION, ...methVersions } },
        contributors,
        rationale: buildRationale('trajectory', data[0]?.current ?? 0, contributors),
      }));
    } catch (e) { fail(res, 500, 'trajectory_failed', String((e as Error).message)); }
  });

  app.get('/api/longitudinal/maturity', async (req, res) => {
    try {
      const userId = resolveUser(req);
      if (!userId) return fail(res, 400, 'missing_user_id');
      const data = await getMaturityTracking(pool, userId);
      await auditFramework(pool, { action: 'longitudinal.maturity', entity_type: 'user', entity_id: userId, domain: 'longitudinal' });
      send(res, wrap({ user_id: userId, maturity: data }, {
        score_type: 'maturity',
        methodology: { versions: { longitudinal: LONGITUDINAL_VERSION } },
        rationale: 'Maturity-level transitions inferred from competency score thresholds (1-5).',
      }));
    } catch (e) { fail(res, 500, 'maturity_failed', String((e as Error).message)); }
  });

  app.get('/api/longitudinal/trends', async (req, res) => {
    try {
      const cohort = String(req.query.cohort_id ?? '');
      const comp = String(req.query.competency_id ?? '');
      if (!cohort || !comp) return fail(res, 400, 'missing_cohort_or_competency');
      const months = Math.min(24, parseInt(String(req.query.months ?? '6'), 10));
      const data = await getBenchmarkTrends(pool, { cohort_id: cohort, competency_id: comp, months });
      await auditFramework(pool, { action: 'longitudinal.trends', entity_type: 'cohort', entity_id: cohort,
        domain: 'longitudinal', payload: { competency_id: comp } });
      send(res, wrap({ cohort_id: cohort, competency_id: comp, trends: data }, {
        score_type: 'benchmark_trend',
        methodology: { versions: { longitudinal: LONGITUDINAL_VERSION } },
        cohort: { id: cohort, n: data[data.length - 1]?.sample_size ?? 0, confidence_tier: 'B' },
        rationale: 'Empirical cohort distribution snapshots — month over month.',
      }));
    } catch (e) { fail(res, 500, 'trends_failed', String((e as Error).message)); }
  });
}
