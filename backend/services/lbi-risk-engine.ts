/**
 * LBI Risk Engine  (W4)
 *
 * Pure classifier over the current LBI profile.
 * Writes detected risks to lbi_risk_indicators.
 * Four risk types: attention_risk · motivation_risk · disengagement_risk · overload_risk
 *
 * Additive · never-throws.
 */

import pg from 'pg';

export type RiskType     = 'attention_risk' | 'motivation_risk' | 'disengagement_risk' | 'overload_risk';
export type RiskSeverity = 'high' | 'medium' | 'low';

export interface RiskIndicator {
  risk_type:           RiskType;
  severity:            RiskSeverity;
  risk_score:          number;        // 0–100
  dimensions_involved: string[];
  message:             string;
  is_active:           boolean;
  triggered_at:        string;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(pool: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_risk_indicators (
      id                  SERIAL PRIMARY KEY,
      user_email          TEXT    NOT NULL,
      risk_type           TEXT    NOT NULL,
      severity            TEXT    NOT NULL DEFAULT 'low',
      risk_score          INTEGER DEFAULT 0,
      dimensions_involved TEXT[],
      message             TEXT,
      is_active           BOOLEAN DEFAULT TRUE,
      triggered_at        TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, risk_type)
    );
  `);
  schemaReady = true;
}

// ── Risk classification rules ─────────────────────────────────────────────────

interface LbiProfile {
  attention_score:    number | null;
  consistency_score:  number | null;
  persistence_score:  number | null;
  velocity_score:     number | null;
  adaptability_score: number | null;
  overall_lbi:        number | null;
  sessions_analyzed:  number;
}

interface ClassifiedRisk {
  type:     RiskType;
  active:   boolean;
  severity: RiskSeverity;
  score:    number;
  dims:     string[];
  message:  string;
}

function scoreToSeverity(score: number): RiskSeverity {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function classifyRisks(p: LbiProfile): ClassifiedRisk[] {
  const risks: ClassifiedRisk[] = [];

  // ── Attention Risk: attention_score < 40 ──────────────────────────────────
  {
    const attn = p.attention_score;
    if (attn != null) {
      const active = attn < 40;
      const score  = active ? Math.round(100 - (attn / 40) * 60) : 0;
      risks.push({
        type:     'attention_risk',
        active,
        severity: active ? scoreToSeverity(score) : 'low',
        score:    active ? score : 0,
        dims:     ['attention_score'],
        message:  active
          ? `Attention score is ${Math.round(attn)} — difficulty sustaining focus during learning tasks is likely. Targeted focus exercises are recommended.`
          : 'Attention score is within healthy range.',
      });
    }
  }

  // ── Motivation Risk: BOTH consistency < 38 AND persistence < 38 ──────────
  {
    const con = p.consistency_score;
    const per = p.persistence_score;
    if (con != null && per != null) {
      const active = con < 38 && per < 38;
      const combined = (con + per) / 2;
      const score = active ? Math.round(100 - (combined / 38) * 55) : 0;
      risks.push({
        type:     'motivation_risk',
        active,
        severity: active ? scoreToSeverity(score) : 'low',
        score:    active ? score : 0,
        dims:     ['consistency_score', 'persistence_score'],
        message:  active
          ? `Consistency (${Math.round(con)}) and Persistence (${Math.round(per)}) are both low — risk of reduced learning motivation and task avoidance.`
          : 'Motivational dimensions are within healthy range.',
      });
    }
  }

  // ── Disengagement Risk: low velocity + low overall ────────────────────────
  {
    const vel = p.velocity_score;
    const ov  = p.overall_lbi;
    if (vel != null && ov != null) {
      const active = vel < 32 && ov < 45;
      const score  = active ? Math.round((1 - (vel + ov) / 77) * 90) : 0;
      risks.push({
        type:     'disengagement_risk',
        active,
        severity: active ? scoreToSeverity(Math.min(score, 95)) : 'low',
        score:    active ? Math.min(score, 95) : 0,
        dims:     ['velocity_score', 'overall_lbi'],
        message:  active
          ? `Learning velocity (${Math.round(vel)}) and overall LBI (${Math.round(ov)}) are both low — risk of progressive disengagement from learning.`
          : 'Engagement profile is within healthy range.',
      });
    }
  }

  // ── Overload Risk: high persistence but low adaptability (rigid + stuck) ──
  {
    const per  = p.persistence_score;
    const adp  = p.adaptability_score;
    if (per != null && adp != null) {
      const active = per > 68 && adp < 30;
      const score  = active ? Math.round(((per - 68) / 32 + (30 - adp) / 30) * 40) : 0;
      risks.push({
        type:     'overload_risk',
        active,
        severity: active ? scoreToSeverity(Math.min(score, 80)) : 'low',
        score:    active ? Math.min(score, 80) : 0,
        dims:     ['persistence_score', 'adaptability_score'],
        message:  active
          ? `High persistence (${Math.round(per)}) combined with low adaptability (${Math.round(adp)}) may indicate cognitive overload or rigid, inefficient study habits.`
          : 'Persistence-adaptability balance is healthy.',
      });
    }
  }

  return risks;
}

// ── Compute & Persist ─────────────────────────────────────────────────────────

export async function computeAndPersistRisks(
  email: string,
  pool: pg.Pool
): Promise<void> {
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const scoreRes = await client.query(
        `SELECT attention_score, consistency_score, persistence_score,
                velocity_score, adaptability_score, overall_lbi, sessions_analyzed
         FROM lbi_scores
         WHERE user_email = $1
         LIMIT 1`,
        [email]
      );
      if (!scoreRes.rows[0]) return;

      const p: LbiProfile = {
        attention_score:    scoreRes.rows[0].attention_score    != null ? Number(scoreRes.rows[0].attention_score)    : null,
        consistency_score:  scoreRes.rows[0].consistency_score  != null ? Number(scoreRes.rows[0].consistency_score)  : null,
        persistence_score:  scoreRes.rows[0].persistence_score  != null ? Number(scoreRes.rows[0].persistence_score)  : null,
        velocity_score:     scoreRes.rows[0].velocity_score     != null ? Number(scoreRes.rows[0].velocity_score)     : null,
        adaptability_score: scoreRes.rows[0].adaptability_score != null ? Number(scoreRes.rows[0].adaptability_score) : null,
        overall_lbi:        scoreRes.rows[0].overall_lbi        != null ? Number(scoreRes.rows[0].overall_lbi)        : null,
        sessions_analyzed:  Number(scoreRes.rows[0].sessions_analyzed ?? 0),
      };

      const risks = classifyRisks(p);

      for (const r of risks) {
        await client.query(`
          INSERT INTO lbi_risk_indicators
            (user_email, risk_type, severity, risk_score, dimensions_involved, message, is_active, triggered_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
          ON CONFLICT (user_email, risk_type) DO UPDATE SET
            severity=$3, risk_score=$4, dimensions_involved=$5,
            message=$6, is_active=$7, triggered_at=NOW()
        `, [email, r.type, r.severity, r.score, r.dims, r.message, r.active]);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-risk] computeAndPersistRisks error:', err);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getRiskProfile(
  email: string,
  pool: pg.Pool
): Promise<{ active_risks: RiskIndicator[]; resolved_risks: RiskIndicator[]; risk_count: number; highest_severity: RiskSeverity | 'none'; computed_at: string }> {
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT risk_type, severity, risk_score, dimensions_involved, message, is_active, triggered_at
         FROM lbi_risk_indicators WHERE user_email=$1 ORDER BY risk_score DESC`,
        [email]
      );
      const all: RiskIndicator[] = res.rows.map(r => ({
        risk_type:           r.risk_type as RiskType,
        severity:            r.severity as RiskSeverity,
        risk_score:          Number(r.risk_score ?? 0),
        dimensions_involved: Array.isArray(r.dimensions_involved) ? r.dimensions_involved : [],
        message:             r.message ?? '',
        is_active:           Boolean(r.is_active),
        triggered_at:        r.triggered_at instanceof Date ? r.triggered_at.toISOString() : String(r.triggered_at),
      }));
      const active   = all.filter(r => r.is_active);
      const resolved = all.filter(r => !r.is_active);
      const sevOrder: RiskSeverity[] = ['high', 'medium', 'low'];
      const highest = (active.map(r => r.severity).sort((a, b) => sevOrder.indexOf(a) - sevOrder.indexOf(b))[0] ?? 'none') as RiskSeverity | 'none';
      return { active_risks: active, resolved_risks: resolved, risk_count: active.length, highest_severity: highest, computed_at: new Date().toISOString() };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-risk] getRiskProfile error:', err);
    return { active_risks: [], resolved_risks: [], risk_count: 0, highest_severity: 'none', computed_at: new Date().toISOString() };
  }
}
