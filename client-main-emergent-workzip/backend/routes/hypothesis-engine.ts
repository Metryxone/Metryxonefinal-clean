/**
 * Behavioural Hypothesis Engine Routes — Phase 1 S3
 *
 * POST   /api/bios/hypotheses/generate          — generate hypothesis set for a session
 * GET    /api/bios/hypotheses/:sessionId         — get active hypothesis set
 * PATCH  /api/bios/hypotheses/:sessionId/:id     — update lifecycle state
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnabled } from '../services/feature-flags';
import { confidenceBand } from '../services/confidence-engine';
import {
  CONCERN_TO_CONSTRUCT,
  CONSTRUCT_MAP,
  normalizeConcernKey,
  constructToLegacyCategory,
} from '../data/behavioural-constructs';
import {
  buildHypotheses,
  persistHypotheses,
  strengthenHypothesis,
  weakenHypothesis,
  suspendHypothesis,
  archiveHypothesis,
  reactivateHypothesis,
  type GeneratedHypothesis,
} from '../services/hypothesis-engine';
import { updateState, snapshotState, type HypothesisEntry } from '../services/cognitive-state';

export function registerHypothesisEngineRoutes(app: Express, pool: Pool): void {

  // ── POST /api/bios/hypotheses/generate ─────────────────────────────────────
  // Body: { session_id, concern_text, construct_key?, initial_responses? }
  // Returns: { hypotheses[], fallback: false } or { fallback: true } when disabled.
  app.post('/api/bios/hypotheses/generate', async (req: Request, res: Response) => {
    const tenantId = (String(req.body?.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;

    const { session_id, concern_text, construct_key, initial_responses } = req.body ?? {};

    // Feature-flag guard — fall back to category-based routing when disabled
    if (!isEnabled('hypothesis_engine', tenantId)) {
      // Invoke existing category-routing logic and return meaningful fallback
      const rawKey        = typeof concern_text === 'string' ? concern_text : '';
      const mappedKey     = CONCERN_TO_CONSTRUCT[normalizeConcernKey(rawKey)] ?? null;
      const construct     = mappedKey ? CONSTRUCT_MAP[mappedKey] : null;
      const category      = mappedKey ? constructToLegacyCategory(mappedKey) : 'general';
      return res.json({
        fallback:          true,
        fallback_reason:   'hypothesis_engine flag disabled — using category-based routing',
        category,
        construct_key:     mappedKey,
        construct_label:   construct?.label ?? null,
        hypotheses:        [],
      });
    }

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'session_id is required' });
    }
    if (!concern_text || typeof concern_text !== 'string') {
      return res.status(400).json({ error: 'concern_text is required' });
    }

    try {
      // 1. Session existence check against capadex_sessions (the canonical session table).
      //    - If the session is found we have full referential coherence and can also
      //      sync active_hypotheses back into cognitive_runtime_state.
      //    - If not found (e.g. integration tests or future non-CAPADEX callers) we
      //      log a warning but still generate hypotheses — behavioural_hypotheses.session_id
      //      is text (no hard FK) so orphan prevention is enforced at the app layer.
      const { rows: sessionRows } = await pool.query(
        'SELECT id FROM capadex_sessions WHERE id::text = $1 LIMIT 1',
        [session_id]
      );
      const isCapadexSession = sessionRows.length > 0;
      if (!isCapadexSession) {
        console.warn(`[hypothesis-engine] session_id ${session_id} not found in capadex_sessions — proceeding without state sync`);
      }

      // 2. Build hypotheses from rule table (no DB read required)
      const rawHypotheses = buildHypotheses({
        sessionId:        session_id,
        concernText:      concern_text,
        constructKey:     construct_key,
        initialResponses: Array.isArray(initial_responses) ? initial_responses : undefined,
      });

      // 3. Persist inside a transaction — archives prior active set first
      const persisted = await persistHypotheses(pool, session_id, rawHypotheses, tenantId);

      // 4. Write current active set into cognitive_runtime_state.active_hypotheses
      const activeEntries: HypothesisEntry[] = persisted
        .filter(h => h.lifecycle_state === 'active')
        .map(h => ({
          id:              String(h.id),
          construct_key:   h.construct_key,
          label:           h.label,
          confidence:      Number(h.confidence),
          uncertainty:     Number(h.uncertainty),
          lifecycle_state: h.lifecycle_state as HypothesisEntry['lifecycle_state'],
        }));

      // Only sync to cognitive_runtime_state for verified CAPADEX sessions
      // (those sessions have a valid FK-anchored row in capadex_sessions).
      // Merge active_hypotheses AND confidence_scores in a single updateState
      // call to avoid a last-write-wins race between two concurrent writes.
      if (isCapadexSession) {
        const confidenceScores: Record<string, number> = {};
        for (const h of persisted) {
          if (h.lifecycle_state !== 'archived') {
            const k = String(h.construct_key);
            const c = Number(h.confidence);
            if (!confidenceScores[k] || c > confidenceScores[k]) confidenceScores[k] = c;
          }
        }
        updateState(pool, session_id,
          { active_hypotheses: activeEntries, confidence_scores: confidenceScores },
          `hypotheses_generated:${rawHypotheses[0]?.construct_key ?? 'unknown'}`)
          .then(() => snapshotState(pool, session_id, 'hypotheses_generated', 'hypothesis_engine'))
          .catch(err => console.error('[hypothesis-engine] state sync error:', err));
      }

      // Phase 0B: surface confidence bands only when the band-owning
      // confidence engine is enabled, so legacy consumers see a byte-identical
      // payload when it is off.
      const bandsOn = isEnabled('confidence_engine', tenantId);
      return res.status(201).json({
        fallback:    false,
        session_id,
        construct_key: persisted[0]?.construct_key ?? null,
        hypotheses:  persisted.map(h => bandsOn
          ? { ...h, confidence_band: confidenceBand(Number(h.confidence)) }
          : { ...h }),
        count:       persisted.length,
      });
    } catch (err) {
      console.error('[hypothesis-engine] generate error:', err);
      return res.status(500).json({ error: 'Failed to generate hypotheses' });
    }
  });

  // ── GET /api/bios/hypotheses/:sessionId ────────────────────────────────────
  // Returns the current active hypothesis set by default (active + reactivated).
  // Pass ?lifecycle_state=<value> to filter to a specific state,
  // or ?all=true to retrieve every hypothesis regardless of lifecycle state.
  app.get('/api/bios/hypotheses/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { lifecycle_state, all } = req.query as { lifecycle_state?: string; all?: string };
    const tenantId = (String(req.headers['x-tenant-id'] ?? '')).trim() || undefined;

    try {
      const params: unknown[] = [sessionId];
      let whereClause: string;

      if (lifecycle_state) {
        const valid = ['active','weakened','suspended','archived','reactivated'];
        if (!valid.includes(lifecycle_state)) {
          return res.status(400).json({ error: `lifecycle_state must be one of: ${valid.join(', ')}` });
        }
        whereClause = `session_id = $1 AND lifecycle_state = $2`;
        params.push(lifecycle_state);
      } else if (all === 'true') {
        whereClause = `session_id = $1`;
      } else {
        // Default: return current active hypothesis set only
        whereClause = `session_id = $1 AND lifecycle_state IN ('active','reactivated')`;
      }

      const { rows } = await pool.query<GeneratedHypothesis>(
        `SELECT * FROM behavioural_hypotheses WHERE ${whereClause}
         ORDER BY confidence DESC, created_at ASC`,
        params
      );

      // Phase 0B: band enrichment gated behind the confidence engine flag so
      // a flag-off response is byte-identical to the legacy payload.
      const bandsOn = isEnabled('confidence_engine', tenantId);
      return res.json({
        session_id:  sessionId,
        hypotheses:  rows.map(h => bandsOn
          ? { ...h, confidence_band: confidenceBand(Number(h.confidence)) }
          : { ...h }),
        count:       rows.length,
      });
    } catch (err) {
      console.error('[hypothesis-engine] get error:', err);
      return res.status(500).json({ error: 'Failed to retrieve hypotheses' });
    }
  });

  // ── PATCH /api/bios/hypotheses/:sessionId/:hypothesisId ───────────────────
  // Body: { action: 'strengthen'|'weaken'|'suspend'|'archive'|'reactivate', reason, source? }
  app.patch('/api/bios/hypotheses/:sessionId/:hypothesisId', async (req: Request, res: Response) => {
    const { sessionId, hypothesisId } = req.params;
    const { action, reason, source }  = req.body ?? {};

    const validActions = ['strengthen','weaken','suspend','archive','reactivate'] as const;
    type ValidAction = typeof validActions[number];

    if (!validActions.includes(action as ValidAction)) {
      return res.status(400).json({
        error: `action must be one of: ${validActions.join(', ')}`,
      });
    }
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'reason is required' });
    }

    try {
      // Verify hypothesis belongs to session
      const { rows: check } = await pool.query(
        'SELECT id FROM behavioural_hypotheses WHERE id = $1 AND session_id = $2',
        [hypothesisId, sessionId]
      );
      if (check.length === 0) {
        return res.status(404).json({ error: 'Hypothesis not found for this session' });
      }

      const src = (typeof source === 'string' && source.trim()) ? source.trim() : 'api';
      let updated: GeneratedHypothesis | null = null;

      const tenantIdPatch = (String(req.body?.tenant_id ?? req.headers['x-tenant-id'] ?? '')).trim() || undefined;
      switch (action as ValidAction) {
        case 'strengthen':  updated = await strengthenHypothesis(pool, hypothesisId, reason, src, tenantIdPatch); break;
        case 'weaken':      updated = await weakenHypothesis(pool, hypothesisId, reason, src, tenantIdPatch);     break;
        case 'suspend':     updated = await suspendHypothesis(pool, hypothesisId, reason, src, tenantIdPatch);    break;
        case 'archive':     updated = await archiveHypothesis(pool, hypothesisId, reason, src, tenantIdPatch);    break;
        case 'reactivate':  updated = await reactivateHypothesis(pool, hypothesisId, reason, src, tenantIdPatch); break;
      }

      if (!updated) {
        return res.status(500).json({ error: 'Lifecycle update failed' });
      }

      // Sync active set + confidence_scores back to cognitive_runtime_state in a
      // single updateState call — avoids a last-write-wins race that occurs when
      // two concurrent writes each read the same old state and clobber each other.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (UUID_RE.test(sessionId)) {
        Promise.all([
          pool.query<GeneratedHypothesis>(
            `SELECT * FROM behavioural_hypotheses
             WHERE session_id = $1 AND lifecycle_state IN ('active','reactivated')
             ORDER BY confidence DESC`,
            [sessionId]
          ),
          pool.query<{ construct_key: string; confidence: string }>(
            `SELECT construct_key, MAX(confidence) AS confidence
             FROM behavioural_hypotheses
             WHERE session_id = $1 AND lifecycle_state NOT IN ('archived')
             GROUP BY construct_key`,
            [sessionId]
          ),
        ]).then(([activeRes, confRes]) => {
          const entries: HypothesisEntry[] = activeRes.rows.map(h => ({
            id:              String(h.id),
            construct_key:   h.construct_key,
            label:           h.label,
            confidence:      Number(h.confidence),
            uncertainty:     Number(h.uncertainty),
            lifecycle_state: h.lifecycle_state as HypothesisEntry['lifecycle_state'],
          }));
          const confidenceScores: Record<string, number> = {};
          for (const r of confRes.rows) confidenceScores[r.construct_key] = Number(r.confidence);
          return updateState(pool, sessionId,
            { active_hypotheses: entries, confidence_scores: confidenceScores },
            `hypothesis_${action}:${hypothesisId.slice(-8)}`);
        }).catch(err => console.error('[hypothesis-engine] state sync error:', err));
      }

      return res.json({
        session_id:    sessionId,
        hypothesis_id: hypothesisId,
        action,
        updated,
      });
    } catch (err) {
      console.error('[hypothesis-engine] patch error:', err);
      return res.status(500).json({ error: 'Failed to update hypothesis lifecycle' });
    }
  });
}
