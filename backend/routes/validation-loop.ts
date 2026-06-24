/**
 * PHASE 7 — Validation Loop routes (structural, outcome-pending).
 *
 * Closes the front-half of the evidence loop:
 *   Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction
 *
 * - POST /api/validation-loop/outcomes   record a realized outcome (front-half intake, the missing piece)
 * - GET  /api/validation-loop/status     honest admin surface: counts · coverage · calibration · abstain
 * - GET  /api/validation-loop/calibration calibration detail (realized + demo)
 *
 * Strictly additive + reversible + flag-gated (`validationLoop`, FF_VALIDATION_LOOP, default OFF):
 *   - OFF → every route 503; ensure-schema is NEVER reached → the table is never created →
 *     byte-identical legacy behaviour incl. schema.
 *   - GET handlers use a to_regclass PROBE (never DDL) so a read never writes.
 *   - ensure-schema runs ONLY on the POST path, behind the flag.
 * Reuses the EXISTING calibration engine (buildCalibrationModel) — no new engine, never fabricates.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { isFlagEnabled } from '../config/feature-flags';
import {
  OUTCOME_TYPES,
  isValidOutcomeType,
  toCalibrationPairs,
  terminalCandidatesToPairs,
  calibrationSummary,
  evidenceVerdict,
  VALIDATION_K_MIN,
  VALIDATION_LANGUAGE_POLICY,
  VALIDATION_LOOP_VERSION,
  type OutcomeRow,
} from '../services/validation-loop-engine';
import { buildCalibrationModel } from './employer-tig';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  const p = path.join(__dirname, '../migrations/20260623_validation_loop_outcomes.sql');
  const sql = fs.readFileSync(p, 'utf-8');
  await pool.query(sql);
  await pool.query('SELECT 1 FROM validation_loop_outcomes LIMIT 1');
  schemaReady = true;
}

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('validationLoop')) {
    return res.status(503).json({ ok: false, error: 'validation_loop_disabled' });
  }
  next();
}

/** Read-only count helper — returns null when the table is absent/unreadable (honest coverage gap). */
async function safeCount(pool: Pool, sql: string, params: any[] = []): Promise<number | null> {
  try {
    const r = await pool.query(sql, params);
    return Number(r.rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

async function tablePresent(pool: Pool, qualified: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [qualified]);
    return r.rows[0]?.t != null;
  } catch {
    return false;
  }
}

export function registerValidationLoopRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // ── POST intake — the missing front-half realized-outcome capture ───────────────────────────────
  app.post('/api/validation-loop/outcomes', flagGate, requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      await ensureSchema(pool);
      const b = (req.body ?? {}) as Record<string, any>;
      const type = String(b.outcome_type ?? '').toLowerCase();
      if (!isValidOutcomeType(type)) {
        return res.status(400).json({ ok: false, error: 'invalid_outcome_type', allowed: OUTCOME_TYPES });
      }
      const email = String(b.subject_email ?? '').trim().toLowerCase();
      if (!email) return res.status(400).json({ ok: false, error: 'subject_email_required' });

      const kind = b.outcome_kind === 'continuous' ? 'continuous' : 'binary';
      const value = Number(b.outcome_value);
      if (!Number.isFinite(value)) return res.status(400).json({ ok: false, error: 'outcome_value_must_be_numeric' });
      if (kind === 'binary' && value !== 0 && value !== 1) {
        return res.status(400).json({ ok: false, error: 'binary_outcome_value_must_be_0_or_1' });
      }

      let pred: number | null = b.predicted_prob_at_decision == null ? null : Number(b.predicted_prob_at_decision);
      if (pred != null && (!Number.isFinite(pred) || pred < 0 || pred > 1)) {
        return res.status(400).json({ ok: false, error: 'predicted_prob_at_decision_must_be_0_to_1' });
      }

      const row = await pool.query(
        `INSERT INTO validation_loop_outcomes
           (subject_email, subject_user_id, assessment_ref, outcome_type, outcome_kind, outcome_value,
            predicted_prob_at_decision, predicted_basis, decision_at, source, is_demo, ref_id, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (outcome_type, ref_id) WHERE ref_id IS NOT NULL DO UPDATE SET
           outcome_value = EXCLUDED.outcome_value,
           outcome_kind = EXCLUDED.outcome_kind,
           predicted_prob_at_decision = EXCLUDED.predicted_prob_at_decision,
           predicted_basis = EXCLUDED.predicted_basis,
           observed_at = now(),
           detail = EXCLUDED.detail
         RETURNING *`,
        [
          email,
          b.subject_user_id != null ? String(b.subject_user_id) : null,
          b.assessment_ref != null ? String(b.assessment_ref) : null,
          type,
          kind,
          value,
          pred,
          b.predicted_basis != null ? String(b.predicted_basis) : null,
          b.decision_at ?? null,
          b.source != null ? String(b.source) : 'manual',
          b.is_demo === true,
          b.ref_id != null ? String(b.ref_id) : null,
          JSON.stringify(b.detail ?? {}),
        ],
      );
      return res.json({ ok: true, outcome: row.rows[0] });
    } catch (err) {
      console.error('[validation-loop] intake error:', err);
      return res.status(500).json({ ok: false, error: 'intake_failed' });
    }
  });

  // ── GET status — honest admin surface (read-only, never writes) ─────────────────────────────────
  // Persona-agnostic flag probe (no auth — flag STATE is not sensitive). Lets non-super-admin
  // surfaces (employer, candidate) gate their MX-75X tabs so flag-OFF stays byte-identical in the UI.
  // flagGate runs first → 503 when validationLoop is OFF; res.ok=true only when the loop is ON.
  app.get('/api/validation-loop/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/validation-loop/status', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const present = await tablePresent(pool, 'public.validation_loop_outcomes');

      // Intake counts per type (realized = non-demo, demo separate). Empty when the table is absent.
      const intake: Record<string, { realized: number; demo: number }> = {};
      for (const t of OUTCOME_TYPES) intake[t] = { realized: 0, demo: 0 };
      let allRows: OutcomeRow[] = [];
      let demoRows: OutcomeRow[] = [];

      if (present) {
        const counts = await pool.query(
          `SELECT outcome_type, is_demo, COUNT(*)::int AS count
             FROM validation_loop_outcomes GROUP BY outcome_type, is_demo`,
        );
        for (const r of counts.rows) {
          const t = String(r.outcome_type);
          if (!intake[t]) intake[t] = { realized: 0, demo: 0 };
          if (r.is_demo) intake[t].demo += Number(r.count);
          else intake[t].realized += Number(r.count);
        }
        const data = await pool.query(
          `SELECT outcome_kind, outcome_value, predicted_prob_at_decision, is_demo
             FROM validation_loop_outcomes`,
        );
        allRows = data.rows.filter(r => !r.is_demo);
        demoRows = data.rows.filter(r => r.is_demo);
      }

      // Calibration over REALIZED (non-demo) pairs — the evidence-backed axis.
      const realizedPairs = toCalibrationPairs(allRows);
      const realizedModel = buildCalibrationModel(realizedPairs);
      // Calibration over DEMO pairs — proves the mechanism RUNS; NEVER evidence-backed.
      const demoPairs = toCalibrationPairs(demoRows);
      const demoModel = buildCalibrationModel(demoPairs);

      // MX-75X CONNECTION — realized pairs already present in the employer hiring pipeline
      // (terminal decision + decision-time prediction snapshot), demo-excluded. Read-only:
      // this CONNECTS the pre-existing feeder into the loop WITHOUT any manual intake.
      let connectedPairs: { predicted: number; outcome: 0 | 1 }[] = [];
      try {
        const ec = await pool.query(
          `SELECT stage, predicted_prob_at_decision, email
             FROM employer_candidates
            WHERE stage IN ('Hired','Rejected') AND predicted_prob_at_decision IS NOT NULL`,
        );
        connectedPairs = terminalCandidatesToPairs(ec.rows);
      } catch { connectedPairs = []; }
      const connectedModel = buildCalibrationModel(connectedPairs);

      // Platform realized = manual intake + connected feeders — the honest TOTAL evidence axis.
      const platformPairs = [...realizedPairs, ...connectedPairs];
      const platformModel = buildCalibrationModel(platformPairs);

      // Coverage of the broader (fragmented, pre-existing) realized-outcome surfaces — read-only.
      const [careerOutcomes, hiringOutcomes, interviewOutcomes, tiPredictions, tigCalibration, employerTerminal] =
        await Promise.all([
          safeCount(pool, `SELECT COUNT(*)::int AS count FROM career_outcomes WHERE is_demo = false`),
          safeCount(pool, `SELECT COUNT(*)::int AS count FROM hiring_outcomes`),
          safeCount(pool, `SELECT COUNT(*)::int AS count FROM interview_outcomes`),
          safeCount(pool, `SELECT COUNT(*)::int AS count FROM ti_outcome_predictions`),
          safeCount(pool, `SELECT COUNT(*)::int AS count FROM tig_calibration`),
          safeCount(pool, `SELECT COUNT(*)::int AS count FROM employer_candidates WHERE stage IN ('Hired','Rejected')`),
        ]);

      // Evidence verdict folds in the connected feeder — the loop now reflects ALL real evidence.
      const verdict = evidenceVerdict(platformPairs.length);

      return res.json({
        ok: true,
        version: VALIDATION_LOOP_VERSION,
        loop: ['Assessment', 'Hiring', 'Performance', 'Promotion', 'Retention', 'Outcome', 'Calibration', 'Prediction'],
        intake: { table_present: present, by_type: intake },
        calibration: {
          realized: calibrationSummary(realizedModel),
          connected: calibrationSummary(connectedModel),
          platform_realized: calibrationSummary(platformModel),
          demo_illustrative: calibrationSummary(demoModel),
        },
        // Coverage axis: which realized-outcome substrates exist + how populated (null = table absent).
        coverage: {
          validation_loop_realized: realizedPairs.length,
          connected_realized: connectedPairs.length,
          platform_realized: platformPairs.length,
          career_outcomes: careerOutcomes,
          hiring_outcomes: hiringOutcomes,
          interview_outcomes: interviewOutcomes,
          ti_outcome_predictions: tiPredictions,
          tig_calibration: tigCalibration,
          employer_candidates_terminal: employerTerminal,
        },
        // Prediction axis — abstained. The engines exist upstream; empirical accuracy is NOT claimed.
        prediction: {
          engines_wired: [
            'talent-outcome-prediction (ti_outcome_predictions)',
            'predictive-competency-engine',
            'pil/prediction-engine (+ prediction-validation honesty guard)',
          ],
          empirical_accuracy_available: false,
          outcome_coverage: platformPairs.length,
          abstained: platformPairs.length < VALIDATION_K_MIN,
          reason: platformPairs.length === 0
            ? 'no_realized_outcomes'
            : platformPairs.length < VALIDATION_K_MIN
              ? `insufficient_outcomes (${platformPairs.length}/${VALIDATION_K_MIN})`
              : null,
          note: 'Predictions are produced by the existing engines; empirical accuracy is deliberately NOT claimed until realized outcomes accrue.',
        },
        // Confidence axis — distinct from accuracy.
        confidence: {
          engine_wired: 'competency-confidence-engine (/api/confidence)',
          kind: 'model_confidence',
          note: 'Model confidence (reliability/consistency/evidence) ≠ empirical accuracy; the latter requires realized outcomes (abstained).',
        },
        evidence: verdict,
        verdict: verdict.evidence_backed
          ? 'EVIDENCE-BACKED — realized outcomes have reached k_min; calibration is trusted.'
          : 'PARTIAL — loop is structurally wired and the intake is live; predictions stay ABSTAINED until realized outcomes accrue. No outcome is fabricated.',
        language_policy: VALIDATION_LANGUAGE_POLICY,
        read_only: true,
      });
    } catch (err) {
      console.error('[validation-loop] status error:', err);
      return res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // ── GET calibration — calibration detail (realized + demo illustrative) ──────────────────────────
  app.get('/api/validation-loop/calibration', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const present = await tablePresent(pool, 'public.validation_loop_outcomes');
      let realized: OutcomeRow[] = [];
      let demo: OutcomeRow[] = [];
      if (present) {
        const data = await pool.query(
          `SELECT outcome_kind, outcome_value, predicted_prob_at_decision, is_demo
             FROM validation_loop_outcomes`,
        );
        realized = data.rows.filter(r => !r.is_demo);
        demo = data.rows.filter(r => r.is_demo);
      }
      const realizedPairs = toCalibrationPairs(realized);
      const realizedModel = buildCalibrationModel(realizedPairs);
      const demoModel = buildCalibrationModel(toCalibrationPairs(demo));
      // MX-75X CONNECTION — fold in the employer hiring feeder (read-only, demo-excluded).
      let connectedPairs: { predicted: number; outcome: 0 | 1 }[] = [];
      try {
        const ec = await pool.query(
          `SELECT stage, predicted_prob_at_decision, email
             FROM employer_candidates
            WHERE stage IN ('Hired','Rejected') AND predicted_prob_at_decision IS NOT NULL`,
        );
        connectedPairs = terminalCandidatesToPairs(ec.rows);
      } catch { connectedPairs = []; }
      const connectedModel = buildCalibrationModel(connectedPairs);
      const platformModel = buildCalibrationModel([...realizedPairs, ...connectedPairs]);
      return res.json({
        ok: true,
        version: VALIDATION_LOOP_VERSION,
        k_min: VALIDATION_K_MIN,
        realized: realizedModel,
        connected: connectedModel,
        platform_realized: platformModel,
        demo_illustrative: demoModel,
        note: 'Realized = manual intake (non-demo). Connected = employer hiring feeder (terminal decision + decision-time prediction, demo-excluded). Platform = their union (the honest total evidence axis). Demo is illustrative only and never claimed as validated.',
        read_only: true,
      });
    } catch (err) {
      console.error('[validation-loop] calibration error:', err);
      return res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  console.log('[validation-loop] Phase 7 routes registered — outcome intake + honest calibration/abstain surface');
}
