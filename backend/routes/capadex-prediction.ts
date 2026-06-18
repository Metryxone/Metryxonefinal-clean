/**
 * CAPADEX PIL — Phase 9: Predictive & Outcome Intelligence API (read-only).
 *
 *   Public read surface over the prediction engine. Every prediction is an
 *   EXPLAINABLE composition of the descriptive layers (runtime pipeline, reports,
 *   recommendations, knowledge graph) — NO black box. Routes are read-only of all
 *   domain tables (the engine's only write is an append-only audit row).
 *
 *     GET  /api/capadex/session/:id/predictions          — student-facing predictions
 *     GET  /api/capadex/session/:id/predictions/explain  — full traced prediction set
 *     GET  /api/capadex/predictions/counselor?sessions=  — cohort counselor view
 *     GET  /api/capadex/predictions/institution?sessions= — cohort institution view
 *     GET  /api/capadex/predictions/validation?sessions= — validation snapshot
 *
 *   Flag-gated by isRuntimeIntelligenceActivationEnabled(): OFF → {enabled:false}
 *   (byte-identical legacy). Strict-UUID validated; degrades gracefully; never 500s.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isRuntimeIntelligenceActivationEnabled } from '../config/feature-flags';
import { buildPredictionsForSession } from '../services/pil/prediction-engine';
import {
  buildStudentPrediction,
  buildCounselorPrediction,
  buildInstitutionPrediction,
} from '../services/pil/prediction-experience';
import {
  buildAccuracyFramework,
  rollupCoverage,
  buildPlatformCompletionAssessment,
  countRealizedOutcomes,
} from '../services/pil/prediction-validation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COHORT_CAP = 200;

function parseSessions(raw: unknown): { ids: string[]; bad: string[] } {
  const ids: string[] = [];
  const bad: string[] = [];
  for (const tok of String(raw || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (UUID_RE.test(tok)) ids.push(tok);
    else bad.push(tok);
  }
  return { ids: ids.slice(0, COHORT_CAP), bad };
}

export function registerCapadexPredictionRoutes(app: Express, pool: Pool): void {
  // GET /api/capadex/session/:id/predictions — student predictions
  app.get('/api/capadex/session/:id/predictions', async (req: Request, res: Response) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const id = String(req.params.id || '');
      if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'invalid_session_id' });
      const result = await buildStudentPrediction(pool, id).catch((err) => {
        console.warn('[prediction-student] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.warn('[prediction] unexpected:', err instanceof Error ? err.message : String(err));
      return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'unexpected_error' });
    }
  });

  // GET /api/capadex/session/:id/predictions/explain — full traced set
  app.get('/api/capadex/session/:id/predictions/explain', async (req: Request, res: Response) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const id = String(req.params.id || '');
      if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'invalid_session_id' });
      const result = await buildPredictionsForSession(pool, id).catch((err) => {
        console.warn('[prediction-explain] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.warn('[prediction] unexpected:', err instanceof Error ? err.message : String(err));
      return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'unexpected_error' });
    }
  });

  // GET /api/capadex/predictions/counselor?sessions=uuid,uuid
  app.get('/api/capadex/predictions/counselor', async (req: Request, res: Response) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const { ids, bad } = parseSessions(req.query.sessions);
      if (bad.length) return res.status(400).json({ ok: false, error: 'invalid_session_id', invalid: bad });
      if (!ids.length) return res.status(400).json({ ok: false, error: 'sessions_required' });
      const result = await buildCounselorPrediction(pool, ids).catch((err) => {
        console.warn('[prediction-counselor] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.warn('[prediction] unexpected:', err instanceof Error ? err.message : String(err));
      return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'unexpected_error' });
    }
  });

  // GET /api/capadex/predictions/institution?sessions=uuid,uuid
  app.get('/api/capadex/predictions/institution', async (req: Request, res: Response) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const { ids, bad } = parseSessions(req.query.sessions);
      if (bad.length) return res.status(400).json({ ok: false, error: 'invalid_session_id', invalid: bad });
      if (!ids.length) return res.status(400).json({ ok: false, error: 'sessions_required' });
      const result = await buildInstitutionPrediction(pool, ids).catch((err) => {
        console.warn('[prediction-institution] degraded:', err instanceof Error ? err.message : String(err));
        return null;
      });
      if (!result) return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'build_failed' });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.warn('[prediction] unexpected:', err instanceof Error ? err.message : String(err));
      return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'unexpected_error' });
    }
  });

  // GET /api/capadex/predictions/validation?sessions=uuid,uuid (sessions optional)
  app.get('/api/capadex/predictions/validation', async (req: Request, res: Response) => {
    try {
      if (!isRuntimeIntelligenceActivationEnabled()) return res.status(200).json({ ok: true, enabled: false });
      const { ids, bad } = parseSessions(req.query.sessions);
      if (bad.length) return res.status(400).json({ ok: false, error: 'invalid_session_id', invalid: bad });

      const framework = buildAccuracyFramework();
      const predictions = [];
      for (const id of ids) {
        const p = await buildPredictionsForSession(pool, id).catch(() => null);
        if (p) predictions.push(p);
      }
      const coverage = rollupCoverage(predictions);
      const realized = await countRealizedOutcomes(pool).catch(() => 0);
      coverage.outcome_coverage.with_realized_outcome = realized;
      coverage.outcome_coverage.coverage = coverage.outcome_coverage.total
        ? Math.round((realized / coverage.outcome_coverage.total) * 10000) / 10000
        : 0;
      const completion = buildPlatformCompletionAssessment(coverage, framework);

      return res.status(200).json({
        ok: true,
        enabled: true,
        generated_at: new Date().toISOString(),
        accuracy_framework: framework,
        coverage,
        platform_completion: completion,
      });
    } catch (err) {
      console.warn('[prediction] unexpected:', err instanceof Error ? err.message : String(err));
      return res.status(200).json({ ok: true, enabled: true, degraded: true, reason: 'unexpected_error' });
    }
  });
}
