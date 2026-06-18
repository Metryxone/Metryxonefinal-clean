/**
 * Mounted at /api/career/assessment/*.
 * Bridges Competency Assessment completions into the Phase 1-5 pipelines.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { wrap } from '../services/explainability-engine';
import { createAssessmentWriter, ASSESSMENT_WRITER_VERSION } from '../services/assessment-writer';
import { orchestrateAssessmentCompletion } from '../services/competency-intelligence-orchestrator';
import { runAdaptiveRuntime } from '../services/unified-adaptive-runtime-orchestrator';
import { isAdaptiveRuntimeAuthorityEnabled, isAdaptiveOrchestrationV2Enabled } from '../config/feature-flags';
import { triggerMEIChain } from '../services/mei-chain-trigger';

const METHOD_VERSIONS = { assessment_writer: ASSESSMENT_WRITER_VERSION };

/** Fire-and-forget orchestration after a snapshot write. Never blocks the
 *  HTTP response and never throws. Each stage is independently gated. */
function fanOutAdaptiveOrchestration(pool: Pool, userId: string, sessionId?: string | null) {
  const numericId = Number(userId);
  // Phase 1–4: existing orchestrator (UCIP rebuild + graph + cascade events)
  if (isAdaptiveOrchestrationV2Enabled() && Number.isFinite(numericId)) {
    orchestrateAssessmentCompletion(pool, { userId: numericId, assessmentId: sessionId ?? undefined })
      .catch((err) => console.warn('[assessment-writer] orchestrateAssessmentCompletion failed:', (err as Error).message));
  }
  // Phase 5: unified adaptive runtime (fusion + calibration + memory + narratives)
  if (isAdaptiveRuntimeAuthorityEnabled()) {
    runAdaptiveRuntime(pool, userId, { stage: 'shadow' })
      .catch((err) => console.warn('[assessment-writer] runAdaptiveRuntime failed:', (err as Error).message));
  }
  // W1: MEI chain — compute EI score → recommendations → UCIP (post-assessment trigger)
  triggerMEIChain(pool, userId)
    .catch((err) => console.warn('[assessment-writer] triggerMEIChain failed:', (err as Error).message));
}

export function registerAssessmentWriterRoutes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;
  const writer = createAssessmentWriter(pool);

  // POST — write a snapshot
  app.post('/api/career/assessment/snapshot', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const userId = String(body.user_id ?? body.userId ?? '').trim();
      if (!userId) return res.status(400).json({ ok: false, error: 'user_id is required' });

      const rawScores = body.scores ?? {};
      const scores: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawScores)) {
        const n = Number(v);
        if (Number.isFinite(n)) scores[String(k)] = n;
      }
      if (Object.keys(scores).length === 0) {
        return res.status(400).json({ ok: false, error: 'scores must be a non-empty {competency_id: number} object' });
      }

      const result = await writer.writeSnapshot({
        userId,
        orgId: body.org_id ?? body.orgId ?? null,
        roleId: body.role_id ?? body.roleId ?? null,
        scores,
        reliability: body.reliability,
        source: body.source ?? 'assessment',
        sessionId: body.session_id ?? body.sessionId,
        assessmentVersion: body.assessment_version,
      });

      // Kick off downstream intelligence orchestration (non-blocking, flag-gated)
      fanOutAdaptiveOrchestration(pool, userId, body.session_id ?? body.sessionId ?? null);

      res.json({
        ok: true,
        ...wrap({ data: result }, {
          score_type: 'assessment_snapshot',
          score: result.composite_score,
          contributors: [],
          methodology: { versions: METHOD_VERSIONS },
          rationale: 'Assessment snapshot written to longitudinal history and latest-score store.',
        }),
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'snapshot_failed' });
    }
  });

  // GET — latest snapshot for a user
  app.get('/api/career/assessment/snapshot/:user_id', async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.user_id);
      const snap = await writer.latestSnapshot(userId);
      res.json({ ok: true, ...wrap({ data: snap }, {
        score_type: 'assessment_snapshot_latest', score: snap?.composite_score ?? null,
        contributors: [], methodology: { versions: METHOD_VERSIONS },
        rationale: 'Latest persisted assessment snapshot header.',
      }) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'lookup_failed' });
    }
  });

  // GET — snapshot history
  app.get('/api/career/assessment/snapshots/:user_id', async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.user_id);
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const rows = await writer.snapshotHistory(userId, limit);
      res.json({ ok: true, ...wrap({ data: rows }, {
        score_type: 'assessment_snapshot_history', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Append-only assessment snapshot headers in reverse chronological order.',
      }) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'lookup_failed' });
    }
  });

  // GET — real user scores resolved from store (for client display)
  app.get('/api/career/assessment/scores/:user_id', async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.user_id);
      const scores = await writer.realUserScores(userId);
      res.json({ ok: true, ...wrap({ data: { user_id: userId, scores: scores ?? {}, has_data: !!scores } }, {
        score_type: 'user_competency_scores', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Latest persisted competency scores by code (assessment or self-rated).',
      }) });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? 'lookup_failed' });
    }
  });

  app.get('/api/career/assessment/_meta/version', (_req, res) => {
    res.json({ ok: true, data: METHOD_VERSIONS });
  });
}
