/**
 * D15 — Talent Outcome Prediction Engine (Blueprint-keyed)
 * 6 prediction types: Promotion Probability, Role Success, Leadership Potential,
 * Future Employability, Career Velocity, Talent Risk.
 * Reads readiness + EI + LBI + talent scores — purely compositive, never fabricates.
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { recordPromotionOutcome, type RecordOutcomeResult } from '../services/validation-loop-intake';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;
const getCached = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < CACHE_TTL ? e.data as T : null; };
const setCache = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });
const bustCache = () => cache.clear();

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ti_outcome_predictions (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      rf_id INTEGER,
      rf_name TEXT,
      blueprint_key TEXT,
      promotion_probability NUMERIC(5,4),
      role_success_probability NUMERIC(5,4),
      leadership_potential NUMERIC(5,4),
      future_employability NUMERIC(5,4),
      career_velocity NUMERIC(5,4),
      talent_risk NUMERIC(5,4),
      prediction_confidence NUMERIC(5,4),
      prediction_basis JSONB DEFAULT '{}',
      key_drivers JSONB DEFAULT '[]',
      risk_factors JSONB DEFAULT '[]',
      predicted_at TIMESTAMPTZ DEFAULT NOW(),
      valid_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
      UNIQUE(user_email, rf_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ti_op_email ON ti_outcome_predictions(user_email);
    CREATE INDEX IF NOT EXISTS idx_ti_op_rf ON ti_outcome_predictions(rf_id);
    CREATE INDEX IF NOT EXISTS idx_ti_op_promo ON ti_outcome_predictions(promotion_probability DESC);
    CREATE INDEX IF NOT EXISTS idx_ti_op_risk ON ti_outcome_predictions(talent_risk DESC);
    CREATE TABLE IF NOT EXISTS ti_prediction_history (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      rf_id INTEGER,
      promotion_probability NUMERIC(5,4),
      role_success_probability NUMERIC(5,4),
      leadership_potential NUMERIC(5,4),
      talent_risk NUMERIC(5,4),
      snapshot_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ti_ph_email ON ti_prediction_history(user_email);
  `);
  schemaReady = true;
}

// ── Prediction Engine ─────────────────────────────────────────────────────────

function sigmoid(x: number, centre: number = 55, steepness: number = 0.08): number {
  return Math.round((1 / (1 + Math.exp(-steepness * (x - centre)))) * 10000) / 10000;
}

function clamp(v: number, min = 0, max = 1): number { return Math.max(min, Math.min(max, v)); }

interface PredictionInput {
  composite_score: number;
  ei_score: number | null;
  lbi_score: number | null;
  csi_score: number | null;
  gap_severity: 'none' | 'minor' | 'moderate' | 'critical';
  critical_gap_count: number;
  readiness_score: number | null;
  promotion_readiness: number | null;
  leadership_readiness: number | null;
  session_count: number;
  rf_name: string;
  blueprint_key: string;
}

function predictOutcomes(inp: PredictionInput): {
  promotion_probability: number; role_success_probability: number;
  leadership_potential: number; future_employability: number;
  career_velocity: number; talent_risk: number;
  confidence: number; key_drivers: string[]; risk_factors: string[]; basis: Record<string, number>;
} {
  const basis: Record<string, number> = {};
  const presentSources: string[] = [];

  if (inp.composite_score > 0) { basis.composite_score = inp.composite_score; presentSources.push('TalentScore'); }
  if (inp.ei_score !== null) { basis.ei_score = inp.ei_score; presentSources.push('EI'); }
  if (inp.lbi_score !== null) { basis.lbi_score = inp.lbi_score; presentSources.push('LBI'); }
  if (inp.csi_score !== null) { basis.csi_score = inp.csi_score; presentSources.push('CSI'); }
  if (inp.readiness_score !== null) { basis.role_readiness = inp.readiness_score; }
  if (inp.promotion_readiness !== null) { basis.promotion_readiness = inp.promotion_readiness; }
  if (inp.leadership_readiness !== null) { basis.leadership_readiness = inp.leadership_readiness; }

  const confidence = clamp(presentSources.length / 4, 0, 1);

  if (presentSources.length === 0) {
    return {
      promotion_probability: 0, role_success_probability: 0, leadership_potential: 0,
      future_employability: 0, career_velocity: 0, talent_risk: 0.5, confidence: 0,
      key_drivers: [], risk_factors: ['No assessment data — complete EI/LBI/competency assessments'], basis: {},
    };
  }

  // Promotion Probability: driven by promotion_readiness + EI + composite
  const promoBase = inp.promotion_readiness !== null ? inp.promotion_readiness : inp.composite_score * 0.85;
  const eiBoost = inp.ei_score !== null ? (inp.ei_score - 50) * 0.15 : 0;
  const promoRaw = clamp((promoBase + eiBoost) / 100);
  const gapPenalty = inp.critical_gap_count * 0.07;
  const promotion_probability = clamp(sigmoid(promoRaw * 100) - gapPenalty);

  // Role Success: composite + LBI (learning agility predicts success)
  const successBase = inp.readiness_score !== null ? inp.readiness_score : inp.composite_score;
  const lbiBoost = inp.lbi_score !== null ? (inp.lbi_score - 50) * 0.1 : 0;
  const role_success_probability = clamp(sigmoid(successBase + lbiBoost, 50, 0.07) - gapPenalty * 0.5);

  // Leadership Potential: EI + LBI + CSI weighted heavily
  const lepBase = ((inp.ei_score ?? 50) * 0.4 + (inp.lbi_score ?? 50) * 0.3 + (inp.csi_score ?? 50) * 0.2 + inp.composite_score * 0.1);
  const leadership_potential = clamp(sigmoid(lepBase, 55, 0.07));

  // Future Employability: composite + LBI (learning agility) + future_relevance of role
  const empBase = inp.composite_score * 0.5 + (inp.lbi_score ?? 50) * 0.3 + (inp.ei_score ?? 50) * 0.2;
  const future_employability = clamp(sigmoid(empBase, 55, 0.06));

  // Career Velocity: rate of growth — LBI (learning speed) + EI + assessment engagement
  const sessionBoost = Math.min(inp.session_count * 2, 10);
  const velocityBase = (inp.lbi_score ?? 50) * 0.4 + (inp.ei_score ?? 50) * 0.3 + inp.composite_score * 0.2 + sessionBoost * 0.1;
  const career_velocity = clamp(sigmoid(velocityBase, 55, 0.07));

  // Talent Risk: inverse of retention signals (low readiness + low EI + critical gaps)
  const retentionBase = clamp((inp.readiness_score ?? inp.composite_score) / 100);
  const eiRetention = clamp((inp.ei_score ?? 50) / 100);
  const retentionScore = retentionBase * 0.5 + eiRetention * 0.3 + (1 - clamp(inp.critical_gap_count * 0.1)) * 0.2;
  const talent_risk = clamp(1 - retentionScore - 0.05 + (inp.gap_severity === 'critical' ? 0.15 : 0));

  // Key drivers & risk factors
  const key_drivers: string[] = [];
  const risk_factors: string[] = [];

  if (inp.composite_score > 70) key_drivers.push('Strong competency score');
  if (inp.ei_score && inp.ei_score > 70) key_drivers.push('High emotional intelligence');
  if (inp.lbi_score && inp.lbi_score > 70) key_drivers.push('Strong learning agility');
  if (inp.critical_gap_count === 0) key_drivers.push('No critical competency gaps');

  if (inp.critical_gap_count > 0) risk_factors.push(`${inp.critical_gap_count} critical competency gap(s) require attention`);
  if (inp.composite_score < 50) risk_factors.push('Overall competency score below threshold');
  if (inp.ei_score !== null && inp.ei_score < 45) risk_factors.push('EI score indicates people management risk');
  if (inp.lbi_score !== null && inp.lbi_score < 45) risk_factors.push('Low learning agility may limit adaptability');

  return { promotion_probability, role_success_probability, leadership_potential, future_employability, career_velocity, talent_risk, confidence, key_drivers, risk_factors, basis };
}

async function computePredictionsForUser(pool: Pool, email: string): Promise<any[]> {
  const [scores, gaps, ei, lbi, csi, readiness, sessions] = await Promise.all([
    pool.query('SELECT * FROM talent_role_scores WHERE user_email=$1 ORDER BY composite_score DESC LIMIT 15', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT rf_id, severity, COUNT(*) as cnt FROM talent_gaps WHERE user_email=$1 GROUP BY rf_id, severity', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_ei FROM mei_scores WHERE user_email=$1 ORDER BY computed_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT overall_lbi FROM lbi_scores WHERE user_email=$1 ORDER BY created_at DESC LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query('SELECT csi_score FROM csi_profiles WHERE user_email=$1 LIMIT 1', [email]).catch(() => ({ rows: [] })),
    pool.query(`SELECT rf_id, readiness_type, readiness_score FROM ri_readiness_scores WHERE user_email=$1`, [email]).catch(() => ({ rows: [] })),
    pool.query(`SELECT COUNT(*) as cnt FROM capadex_sessions WHERE guest_email=$1 AND status='completed'`, [email]).catch(() => ({ rows: [{ cnt: 0 }] })),
  ]);

  const eiScore = ei.rows[0] ? Number(ei.rows[0].overall_ei) : null;
  const lbiScore = lbi.rows[0] ? Number(lbi.rows[0].overall_lbi) : null;
  const csiScore = csi.rows[0] ? Number(csi.rows[0].csi_score) : null;
  const sessionCount = Number(sessions.rows[0]?.cnt || 0);

  const results: any[] = [];
  for (const score of scores.rows) {
    const rfId = score.rf_id;
    const rfGaps = gaps.rows.filter((g: any) => g.rf_id === rfId);
    const criticalGaps = rfGaps.filter((g: any) => g.severity === 'critical');
    const highestSeverity = criticalGaps.length > 0 ? 'critical' : rfGaps.find((g: any) => g.severity === 'moderate') ? 'moderate' : rfGaps.find((g: any) => g.severity === 'minor') ? 'minor' : 'none';
    const roleReadiness = readiness.rows.find((r: any) => r.rf_id === rfId && r.readiness_type === 'role');
    const promoReadiness = readiness.rows.find((r: any) => r.rf_id === rfId && r.readiness_type === 'promotion');
    const leadReadiness = readiness.rows.find((r: any) => r.rf_id === 0 && r.readiness_type === 'leadership');

    const inp: PredictionInput = {
      composite_score: Number(score.composite_score || 0),
      ei_score: eiScore, lbi_score: lbiScore, csi_score: csiScore,
      gap_severity: highestSeverity as any,
      critical_gap_count: Number(criticalGaps.reduce((a: number, g: any) => a + Number(g.cnt), 0)),
      readiness_score: roleReadiness ? Number(roleReadiness.readiness_score) : null,
      promotion_readiness: promoReadiness ? Number(promoReadiness.readiness_score) : null,
      leadership_readiness: leadReadiness ? Number(leadReadiness.readiness_score) : null,
      session_count: sessionCount,
      rf_name: score.rf_name || String(rfId),
      blueprint_key: score.blueprint_key || '',
    };

    const prediction = predictOutcomes(inp);
    await pool.query(
      `INSERT INTO ti_outcome_predictions(user_email,rf_id,rf_name,blueprint_key,promotion_probability,role_success_probability,leadership_potential,future_employability,career_velocity,talent_risk,prediction_confidence,prediction_basis,key_drivers,risk_factors)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT(user_email,rf_id) DO UPDATE SET
         promotion_probability=$5,role_success_probability=$6,leadership_potential=$7,future_employability=$8,career_velocity=$9,talent_risk=$10,prediction_confidence=$11,prediction_basis=$12,key_drivers=$13,risk_factors=$14,predicted_at=NOW(),valid_until=NOW()+INTERVAL '90 days'`,
      [email, rfId, inp.rf_name, inp.blueprint_key,
       prediction.promotion_probability, prediction.role_success_probability,
       prediction.leadership_potential, prediction.future_employability,
       prediction.career_velocity, prediction.talent_risk,
       prediction.confidence, JSON.stringify(prediction.basis),
       JSON.stringify(prediction.key_drivers), JSON.stringify(prediction.risk_factors)]
    );
    await pool.query(`INSERT INTO ti_prediction_history(user_email,rf_id,promotion_probability,role_success_probability,leadership_potential,talent_risk) VALUES($1,$2,$3,$4,$5,$6)`,
      [email, rfId, prediction.promotion_probability, prediction.role_success_probability, prediction.leadership_potential, prediction.talent_risk]).catch(() => {});
    results.push({ rf_id: rfId, rf_name: inp.rf_name, blueprint_key: inp.blueprint_key, ...prediction });
  }
  return results;
}

// ── Realized PROMOTION outcome (the missing back-half of the promotion prediction) ──────────────
// The engine PREDICTS promotion_probability (ti_outcome_predictions) but the platform had no event
// that records a REALIZED employee promotion, so the promotion calibration axis could never move
// past ABSTAIN without fabricating an outcome. This helper turns a genuine promotion DECISION
// (promoted = 1 / passed-over = 0) into a durable validation_loop_outcomes row, using the standing
// decision-time promotion_probability as the prediction snapshot (NULL when no prediction exists →
// Coverage-only, never coerced into a fake pair). Idempotent per (email, rf_id, decision_ref) so
// re-recording the same promotion cycle is safe; a NEW cycle (new decision_ref) is a distinct row.
// Flag-gated (validationLoop) / demo-aware (@example.com → is_demo) / never-throws inside the recorder.
export interface RealizedPromotionArgs {
  email: string;
  /** Optional role-family id to bind the decision to a specific prediction; else the most recent. */
  rfId?: number | null;
  /** Realized binary decision: 1 = promoted, 0 = passed over. */
  outcome: 0 | 1;
  /** Distinct promotion-cycle marker so recurring promotions of the same person stay separate rows. */
  decisionRef?: string | null;
}

export async function recordRealizedPromotionOutcome(
  pool: Pool,
  args: RealizedPromotionArgs,
): Promise<RecordOutcomeResult & { rf_id?: number | null; predicted_prob?: number | null; ref_id?: string }> {
  const email = String(args.email ?? '').trim().toLowerCase();
  if (!email) return { recorded: false, reason: 'subject_email_required' };
  if (args.outcome !== 0 && args.outcome !== 1) return { recorded: false, reason: 'outcome_must_be_0_or_1' };
  // A per-cycle marker is REQUIRED on every call path (not just the HTTP route) so two real
  // promotion cycles for the same (email, rf_id) can never collapse into one idempotent key.
  const decisionRefIn = String(args.decisionRef ?? '').trim();
  if (!decisionRefIn) return { recorded: false, reason: 'decision_ref_required' };

  // Decision-time prediction snapshot: the standing promotion_probability at record time IS the
  // prediction the promotion decision was made against (mirrors how hiring snapshots at terminal move).
  let predRow: { id: number; rf_id: number; rf_name: string | null; promotion_probability: string | number | null; predicted_at: Date | string | null } | null = null;
  try {
    const r = args.rfId != null
      ? await pool.query(
          `SELECT id, rf_id, rf_name, promotion_probability, predicted_at
             FROM ti_outcome_predictions WHERE user_email=$1 AND rf_id=$2 LIMIT 1`,
          [email, args.rfId],
        )
      : await pool.query(
          `SELECT id, rf_id, rf_name, promotion_probability, predicted_at
             FROM ti_outcome_predictions WHERE user_email=$1 ORDER BY predicted_at DESC LIMIT 1`,
          [email],
        );
    predRow = r.rows[0] ?? null;
  } catch (err) {
    // Never-throws: a lookup failure degrades to a Coverage-only (NULL-prediction) row rather than
    // failing the realized-promotion capture — but log it so an operational issue is not silent.
    console.warn('[talent-outcome-prediction] promotion prediction lookup failed:', (err as any)?.message ?? err);
    predRow = null;
  }

  const pred = predRow?.promotion_probability != null ? Number(predRow.promotion_probability) : null;
  const rfId = predRow?.rf_id ?? args.rfId ?? null;
  const refId = `ti_promotion:${email}:${rfId ?? 'na'}:${decisionRefIn}`;

  const result = await recordPromotionOutcome(pool, {
    subjectEmail: email,
    outcomeValue: args.outcome,
    predictedProb: pred,
    predictedBasis: 'promotion_probability',
    source: 'talent_promotion_decision',
    refId,
    detail: {
      rf_id: rfId,
      rf_name: predRow?.rf_name ?? null,
      prediction_id: predRow?.id ?? null,
      predicted_at: predRow?.predicted_at ?? null,
      decision_ref: decisionRefIn,
    },
  });
  return { ...result, rf_id: rfId, predicted_prob: pred, ref_id: refId };
}

export function registerTalentOutcomePredictionRoutes(app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn): void {
  if (!flagOn()) return;
  ensureSchema(pool).catch(() => {});

  // POST /api/admin/talent/predictions/compute/:email
  app.post('/api/admin/talent/predictions/compute/:email', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const results = await computePredictionsForUser(pool, email);
      bustCache();
      res.json({ ok: true, email, predictions: results.length, computed_at: new Date().toISOString() });
    } catch (err) { console.error('Prediction compute error:', err); res.status(500).json({ error: 'compute failed' }); }
  });

  // POST /api/admin/talent/predictions/compute-all
  app.post('/api/admin/talent/predictions/compute-all', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'prediction computation started in background' });
    (async () => {
      const users = await pool.query('SELECT DISTINCT user_email FROM talent_role_scores LIMIT 500').catch(() => ({ rows: [] }));
      let done = 0;
      for (const u of users.rows) { try { await computePredictionsForUser(pool, u.user_email); done++; } catch { /* skip */ } }
      console.log(`[outcome-prediction] Bulk complete: ${done}/${users.rows.length}`);
    })();
  });

  // POST /api/admin/talent/predictions/:email/promotion-outcome
  // Record a REALIZED promotion decision (promoted=1 / passed-over=0) for a talent, snapshotting the
  // standing promotion_probability as the decision-time prediction. This is the genuine realized-
  // promotion event the loop needs: it accrues promotion outcomes toward Coverage while calibration
  // stays ABSTAINED until non-demo realized pairs reach k_min (never fabricates an outcome).
  app.post('/api/admin/talent/predictions/:email/promotion-outcome', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const b = (req.body ?? {}) as Record<string, unknown>;
      const outcome = Number(b.outcome);
      if (outcome !== 0 && outcome !== 1) {
        return res.status(400).json({ ok: false, error: 'outcome_must_be_0_or_1', hint: '1 = promoted, 0 = passed over' });
      }
      const rfId = b.rf_id != null && Number.isFinite(Number(b.rf_id)) ? Number(b.rf_id) : null;
      // Require an explicit promotion-cycle marker so two real cycles for the same (email, rf_id)
      // never collapse into one idempotent key (a silent under-count of realized outcomes).
      const decisionRef = String(b.decision_ref ?? '').trim();
      if (!decisionRef) {
        return res.status(400).json({ ok: false, error: 'decision_ref_required', hint: 'a stable per-promotion-cycle marker, e.g. "2026-H1"' });
      }
      const result = await recordRealizedPromotionOutcome(pool, { email, rfId, outcome: outcome as 0 | 1, decisionRef });
      bustCache();
      return res.json({
        ok: result.recorded,
        email,
        ...result,
        note: result.recorded
          ? 'Realized promotion recorded with its decision-time prediction; calibration stays ABSTAINED until non-demo pairs reach k_min.'
          : `Not recorded (${result.reason ?? 'unknown'}).`,
      });
    } catch (err) {
      console.error('Promotion outcome record error:', err);
      return res.status(500).json({ ok: false, error: 'record failed' });
    }
  });

  // GET /api/admin/talent/predictions — list with filters
  app.get('/api/admin/talent/predictions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cacheKey = `predictions_${JSON.stringify(req.query)}`;
    const cached = getCached(cacheKey);
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const { sort_by = 'promotion_probability', rf_id, search, page = '1', limit = '25' } = req.query as Record<string, string>;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const validSorts = ['promotion_probability','role_success_probability','leadership_potential','future_employability','career_velocity','talent_risk','prediction_confidence'];
      const sortCol = validSorts.includes(sort_by) ? sort_by : 'promotion_probability';
      const sortDir = sort_by === 'talent_risk' ? 'DESC' : 'DESC';
      const params: unknown[] = [];
      const where: string[] = [];
      if (rf_id) { params.push(parseInt(rf_id)); where.push(`rf_id=$${params.length}`); }
      if (search) { params.push(`%${search}%`); where.push(`user_email ILIKE $${params.length}`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [countRes, rows, kpi] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM ti_outcome_predictions ${wc}`, params),
        pool.query(`SELECT * FROM ti_outcome_predictions ${wc} ORDER BY ${sortCol} ${sortDir} LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), offset]),
        pool.query(`SELECT COUNT(*)::int as total, ROUND(AVG(promotion_probability)::numeric,3) as avg_promo_prob, ROUND(AVG(role_success_probability)::numeric,3) as avg_success_prob, ROUND(AVG(leadership_potential)::numeric,3) as avg_leadership, ROUND(AVG(talent_risk)::numeric,3) as avg_talent_risk, COUNT(*) FILTER (WHERE promotion_probability>0.75) as high_promo_count, COUNT(*) FILTER (WHERE talent_risk>0.6) as high_risk_count FROM ti_outcome_predictions ${wc}`, params),
      ]);
      const result = { total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows, kpi: kpi.rows[0] };
      setCache(cacheKey, result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/talent/predictions/:email — user predictions
  app.get('/api/talent/predictions/:email', requireAuth, async (req: Request, res: Response) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();
      const [predictions, history] = await Promise.all([
        pool.query(`SELECT * FROM ti_outcome_predictions WHERE user_email=$1 ORDER BY promotion_probability DESC`, [email]),
        pool.query(`SELECT * FROM ti_prediction_history WHERE user_email=$1 ORDER BY snapshot_at DESC LIMIT 20`, [email]),
      ]);
      if (!predictions.rows.length) return res.json({ email, predictions: [], history: [], message: 'No predictions yet — run compute first' });
      res.json({ email, predictions: predictions.rows, history: history.rows, generated_at: new Date().toISOString() });
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/predictions/high-risk — talent at risk report
  app.get('/api/admin/talent/predictions/high-risk', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('high_risk');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const rows = await pool.query(`
        SELECT user_email, rf_name, talent_risk, promotion_probability, future_employability, risk_factors, predicted_at
        FROM ti_outcome_predictions WHERE talent_risk > 0.5 ORDER BY talent_risk DESC LIMIT 50`);
      const result = { count: rows.rows.length, high_risk_talent: rows.rows };
      setCache('high_risk', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  // GET /api/admin/talent/predictions/high-potential — high promotion potential
  app.get('/api/admin/talent/predictions/high-potential', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    const cached = getCached('high_potential');
    if (cached && req.query.refresh !== '1') return res.json(cached);
    try {
      const rows = await pool.query(`
        SELECT user_email, rf_name, promotion_probability, leadership_potential, career_velocity, key_drivers, predicted_at
        FROM ti_outcome_predictions WHERE promotion_probability > 0.65 AND leadership_potential > 0.6
        ORDER BY promotion_probability DESC LIMIT 50`);
      const result = { count: rows.rows.length, high_potential_talent: rows.rows };
      setCache('high_potential', result);
      res.json(result);
    } catch (err) { res.status(500).json({ error: 'fetch failed' }); }
  });

  console.log('[talent-outcome-prediction] D15 routes registered — 6 blueprint-keyed outcome predictions');
}
