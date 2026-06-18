/**
 * Confidence & Reasoning Engine Routes — Phase 1 S4
 *
 * GET   /api/bios/confidence/:sessionId/trace   — ordered confidence evolution
 * PATCH /api/bios/confidence/:sessionId/update  — apply delta from trigger event
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnabled } from '../services/feature-flags';
import {
  onNewAnswer,
  onSignalDetected,
  onContradictionDetected,
  onLongitudinalMatch,
  getConfidenceTrace,
  confidenceBand,
} from '../services/confidence-engine';

const VALID_TRIGGERS = [
  'new_answer',
  'signal_detected',
  'contradiction_detected',
  'longitudinal_match',
] as const;

type TriggerEvent = typeof VALID_TRIGGERS[number];

export function registerConfidenceEngineRoutes(app: Express, pool: Pool): void {

  // ── GET /api/bios/confidence/:sessionId/trace ──────────────────────────────
  // Returns the full ordered confidence evolution for a session.
  // Optional QS: ?hypothesis_id=<uuid> to filter to one hypothesis.
  app.get('/api/bios/confidence/:sessionId/trace', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const hypothesisId  = typeof req.query.hypothesis_id === 'string'
      ? req.query.hypothesis_id : undefined;

    const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

    if (!isEnabled('confidence_engine', tenantId)) {
      return res.json({
        session_id:  sessionId,
        traces:      [],
        count:       0,
        flag_active: false,
      });
    }

    try {
      const traces = await getConfidenceTrace(pool, sessionId, hypothesisId);
      // Enrich each trace row with the qualitative band on both sides of the
      // transition so the evolution reads as weak→moderate→strong, not just numbers.
      const enriched = traces.map(t => ({
        ...t,
        band_before: confidenceBand(Number(t.confidence_before)),
        band_after:  confidenceBand(Number(t.confidence_after)),
      }));
      return res.json({
        session_id:    sessionId,
        hypothesis_id: hypothesisId ?? null,
        traces:        enriched,
        count:         enriched.length,
        flag_active:   true,
      });
    } catch (err) {
      console.error('[confidence-engine] trace error:', err);
      return res.status(500).json({ error: 'Failed to retrieve confidence trace' });
    }
  });

  // ── PATCH /api/bios/confidence/:sessionId/update ───────────────────────────
  // Body: {
  //   hypothesis_id: string,
  //   trigger_event: TriggerEvent,
  //   -- for new_answer:           answer_value, max_value
  //   -- for signal_detected:      signal_strength, signal_type
  //   -- for contradiction_detected: contradiction_score, contradiction_type
  //   -- for longitudinal_match:   match_score, prior_session_id
  // }
  app.patch('/api/bios/confidence/:sessionId/update', async (req: Request, res: Response) => {
    const { sessionId }   = req.params;
    const tenantId = (String(req.body?.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;

    if (!isEnabled('confidence_engine', tenantId)) {
      return res.status(200).json({
        session_id:  sessionId,
        updated:     null,
        flag_active: false,
        message:     'confidence_engine flag is disabled — no update applied',
      });
    }

    const {
      hypothesis_id,
      trigger_event,
    } = req.body ?? {};

    if (!hypothesis_id || typeof hypothesis_id !== 'string') {
      return res.status(400).json({ error: 'hypothesis_id is required' });
    }

    if (!VALID_TRIGGERS.includes(trigger_event as TriggerEvent)) {
      return res.status(400).json({
        error: `trigger_event must be one of: ${VALID_TRIGGERS.join(', ')}`,
      });
    }

    try {
      let result;

      switch (trigger_event as TriggerEvent) {
        case 'new_answer': {
          const { answer_value, max_value } = req.body;
          if (typeof answer_value !== 'number' || typeof max_value !== 'number') {
            return res.status(400).json({ error: 'answer_value and max_value (numbers) required for new_answer' });
          }
          result = await onNewAnswer(pool, hypothesis_id, sessionId, answer_value, max_value, tenantId);
          break;
        }
        case 'signal_detected': {
          const { signal_strength, signal_type } = req.body;
          if (typeof signal_strength !== 'number') {
            return res.status(400).json({ error: 'signal_strength (number 0–1) required for signal_detected' });
          }
          result = await onSignalDetected(pool, hypothesis_id, sessionId, signal_strength, signal_type ?? 'unknown', tenantId);
          break;
        }
        case 'contradiction_detected': {
          const { contradiction_score, contradiction_type } = req.body;
          if (typeof contradiction_score !== 'number') {
            return res.status(400).json({ error: 'contradiction_score (number 0–1) required for contradiction_detected' });
          }
          result = await onContradictionDetected(pool, hypothesis_id, sessionId, contradiction_score, contradiction_type ?? 'response_inconsistency', tenantId);
          break;
        }
        case 'longitudinal_match': {
          const { match_score, prior_session_id } = req.body;
          if (typeof match_score !== 'number' || !prior_session_id) {
            return res.status(400).json({ error: 'match_score (number 0–1) and prior_session_id required for longitudinal_match' });
          }
          result = await onLongitudinalMatch(pool, hypothesis_id, sessionId, match_score, prior_session_id, tenantId);
          break;
        }
      }

      if (!result) {
        return res.status(404).json({ error: 'Hypothesis not found or confidence update failed' });
      }

      return res.json({
        session_id:    sessionId,
        hypothesis_id,
        trigger_event,
        updated:       result,
        flag_active:   true,
      });
    } catch (err) {
      console.error('[confidence-engine] update error:', err);
      return res.status(500).json({ error: 'Failed to apply confidence update' });
    }
  });
}
