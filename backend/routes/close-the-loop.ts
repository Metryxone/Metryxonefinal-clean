/**
 * Task #292 — Close-the-Loop Outcome Core (routes).
 *
 * BASE /api/admin/close-the-loop (super-admin governance surface). Strictly additive + reversible +
 * flag-gated (`closeTheLoop`, FF_CLOSE_THE_LOOP, default OFF):
 *   - OFF → every route 503 BEFORE auth/DDL; the lazy ensure-schema is never reached → byte-identical
 *     legacy behaviour incl. schema (no table is created).
 *   - GET handlers are read-only (to_regclass PROBE, never DDL). The only write paths are the explicit
 *     POSTs, each of which delegates to a service write fn that re-asserts the flag before ensure-schema.
 *   - A global app.use('/api/admin') auth gate runs ahead of these handlers, so an unauth OFF smoke
 *     resolves to one of {401, 403, 503} — all three are honest "not exposed" outcomes.
 *
 * COMPOSES the existing validation_loop / MX-102X surfaces (binary outcomes bridge into
 * validation_loop_outcomes) — it never duplicates a calibration namespace.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  CLOSE_THE_LOOP_VERSION,
  CTL_OUTCOME_TYPES,
  CTL_REMEASURE_TRIGGERS,
  CTL_LIFECYCLE_STAGES,
  CAPABILITY_KPIS,
  composeKpiBindings,
  composeOutcomeAttribution,
  composeRemeasurement,
  composeOverview,
  composeKpiDrift,
  captureKpiSnapshot,
  readKpiSnapshots,
  recordAttributedOutcome,
  recordRemeasurement,
} from '../services/close-the-loop-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('closeTheLoop')) {
    return res.status(503).json({ ok: false, error: 'close_the_loop_disabled' });
  }
  next();
}

export function registerCloseTheLoopRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // ── Probes ──────────────────────────────────────────────────────────────────────────────────────
  app.get('/api/admin/close-the-loop/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/admin/close-the-loop/feature-flag', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      res.json({ ok: true, flag: 'closeTheLoop', enabled: isFlagEnabled('closeTheLoop'), version: CLOSE_THE_LOOP_VERSION });
    });

  // ── Catalog (static — the KPI binding framework itself) ───────────────────────────────────────────
  app.get('/api/admin/close-the-loop/catalog', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      res.json({
        ok: true, version: CLOSE_THE_LOOP_VERSION,
        outcome_types: CTL_OUTCOME_TYPES,
        remeasure_triggers: CTL_REMEASURE_TRIGGERS,
        lifecycle_stages: CTL_LIFECYCLE_STAGES,
        capability_kpis: CAPABILITY_KPIS.map(k => ({
          id: k.id, capability_key: k.capability_key, capability_label: k.capability_label,
          name: k.name, unit: k.unit, target: k.target, target_source: k.target_source,
          direction: k.direction, lifecycle_stage: k.lifecycle_stage,
          measurement_method: k.measurement.method,
        })),
        read_only: true,
      });
    });

  // ── Read surfaces (never write) ───────────────────────────────────────────────────────────────────
  app.get('/api/admin/close-the-loop/kpis', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try { res.json(await composeKpiBindings(pool)); }
      catch (err) { console.error('[close-the-loop] kpis error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });

  app.get('/api/admin/close-the-loop/outcomes', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try { res.json(await composeOutcomeAttribution(pool)); }
      catch (err) { console.error('[close-the-loop] outcomes error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });

  app.get('/api/admin/close-the-loop/remeasurement', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try { res.json(await composeRemeasurement(pool)); }
      catch (err) { console.error('[close-the-loop] remeasurement error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });

  app.get('/api/admin/close-the-loop/overview', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try { res.json(await composeOverview(pool)); }
      catch (err) { console.error('[close-the-loop] overview error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });
  // /summary alias for parity with sibling admin engines.
  app.get('/api/admin/close-the-loop/summary', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try { res.json(await composeOverview(pool)); }
      catch (err) { console.error('[close-the-loop] summary error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });

  // ── KPI snapshots (read) + drift ─────────────────────────────────────────────────────────────────
  app.get('/api/admin/close-the-loop/kpi/snapshots', flagGate, requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try { res.json(await readKpiSnapshots(pool, Number(req.query.limit) || 20)); }
      catch (err) { console.error('[close-the-loop] snapshots error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });

  app.get('/api/admin/close-the-loop/kpi/drift', flagGate, requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try { res.json(await composeKpiDrift(pool)); }
      catch (err) { console.error('[close-the-loop] drift error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
    });

  // ── Write paths (each delegates to a flag-asserting, never-throws service fn) ──────────────────────
  app.post('/api/admin/close-the-loop/outcomes', flagGate, requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const b = (req.body ?? {}) as Record<string, any>;
      const r = await recordAttributedOutcome(pool, {
        capabilityKey: String(b.capability_key ?? ''),
        lifecycleStage: b.lifecycle_stage ?? null,
        outcomeType: String(b.outcome_type ?? '').toLowerCase() as any,
        outcomeKind: b.outcome_kind === 'continuous' ? 'continuous' : 'binary',
        outcomeValue: Number(b.outcome_value),
        predictedProb: b.predicted_prob_at_decision ?? null,
        predictedBasis: b.predicted_basis ?? null,
        subjectEmail: String(b.subject_email ?? ''),
        subjectUserId: b.subject_user_id ?? null,
        source: b.source ?? 'manual',
        refId: String(b.ref_id ?? ''),
        validationRefId: b.validation_ref_id ?? null,
        detail: b.detail ?? {},
      });
      if (!r.recorded) {
        const code = r.reason === 'flag_off' ? 503 : 400;
        return res.status(code).json({ ok: false, error: r.reason });
      }
      return res.json({ ok: true, recorded: true, is_demo: r.is_demo, bridged: r.bridged, bridge_status: r.bridge_status });
    });

  app.post('/api/admin/close-the-loop/remeasurement', flagGate, requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const b = (req.body ?? {}) as Record<string, any>;
      const r = await recordRemeasurement(pool, {
        capabilityKey: String(b.capability_key ?? ''),
        assessmentRef: b.assessment_ref ?? null,
        trigger: String(b.trigger ?? '').toLowerCase() as any,
        baselineScore: b.baseline_score ?? null,
        remeasuredScore: b.remeasured_score ?? null,
        delta: b.delta ?? null,
        lifecycleStageFrom: b.lifecycle_stage_from ?? null,
        lifecycleStageTo: b.lifecycle_stage_to ?? null,
        subjectEmail: String(b.subject_email ?? ''),
        subjectUserId: b.subject_user_id ?? null,
        source: b.source ?? 'manual',
        refId: String(b.ref_id ?? ''),
        detail: b.detail ?? {},
      });
      if (!r.recorded) {
        const code = r.reason === 'flag_off' ? 503 : 400;
        return res.status(code).json({ ok: false, error: r.reason });
      }
      return res.json({ ok: true, recorded: true, is_demo: r.is_demo });
    });

  app.post('/api/admin/close-the-loop/kpi/capture', flagGate, requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const capturedBy = (req.user as any)?.email ?? (req.user as any)?.id ?? null;
      const r = await captureKpiSnapshot(pool, capturedBy);
      if (!r.ok) {
        const code = r.reason === 'flag_off' ? 503 : 500;
        return res.status(code).json({ ok: false, error: r.reason });
      }
      return res.json({ ok: true, id: r.id, summary: r.summary });
    });
}
