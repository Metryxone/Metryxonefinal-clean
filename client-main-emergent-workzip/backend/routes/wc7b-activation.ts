/**
 * CAPADEX WC-7B Tier A — Activation Intelligence read surface (Deliverable 1).
 *
 *   GET /api/capadex/session/:id/activation
 *     Returns the unified per-session ACTIVATION ENVELOPE composed by the Decision
 *     Orchestrator (WC-3 L1 Stage + L2 Outcome + L3 Journey → one decision + product /
 *     growthPlan / mentor / subscription activation slots).
 *
 *   Flag-gated by isDecisionOrchestratorEnabled(): OFF → {enabled:false} (byte-identical
 *   legacy). Strict-UUID validated (→ 400). Read-only; degrades gracefully; never 500s.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isDecisionOrchestratorEnabled } from '../config/feature-flags';
import { buildActivationEnvelope } from '../services/wc7b/decision-orchestrator';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerWc7bActivationRoutes(app: Express, pool: Pool): void {
  app.get('/api/capadex/session/:id/activation', async (req: Request, res: Response) => {
    if (!isDecisionOrchestratorEnabled()) {
      return res.status(200).json({ enabled: false });
    }
    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'invalid_uuid_format' });
    }
    try {
      const envelope = await buildActivationEnvelope(pool, id);
      if (envelope === null) {
        return res.status(404).json({ enabled: true, error: 'session_not_found' });
      }
      return res.status(200).json(envelope);
    } catch (err) {
      // never 500 — honest degraded envelope marker.
      console.warn('[wc7b-activation] failed, degrading:', err instanceof Error ? err.message : String(err));
      return res.status(200).json({ enabled: true, degraded: true, reason: 'orchestrator_error', session_id: id });
    }
  });
}
