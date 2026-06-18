/**
 * LBI Report Generator  (W7)
 *
 * Composes profile + trends + risks + recommendations + longitudinal
 * into a structured LBI report snapshot.
 *
 * Three report types: standard · summary · parent
 * Additive · never-throws.
 */

import pg from 'pg';
import { buildCompositeProfile }           from './lbi-profile-builder';
import { getTrends }                        from './lbi-trend-engine';
import { getRiskProfile }                   from './lbi-risk-engine';
import { getRecommendations, getInterventions } from './lbi-recommendation-engine';
import { getLongitudinal }                  from './lbi-longitudinal-engine';

export type ReportType = 'standard' | 'summary' | 'parent';

export interface LbiReport {
  id: number;
  user_email: string;
  report_type_code: ReportType;
  overall_lbi: number | null;
  lbi_band: string;
  report_data: LbiReportData;
  generated_at: string;
}

export interface LbiReportData {
  type: ReportType;
  learner: ReturnType<typeof buildCompositeProfile> extends Promise<infer T> ? T['learner'] : never;
  behavior: ReturnType<typeof buildCompositeProfile> extends Promise<infer T> ? T['behavior'] : never;
  velocity: ReturnType<typeof buildCompositeProfile> extends Promise<infer T> ? T['velocity'] : never;
  trends: Awaited<ReturnType<typeof getTrends>>;
  risks: Awaited<ReturnType<typeof getRiskProfile>>;
  recommendations: Awaited<ReturnType<typeof getRecommendations>>;
  longitudinal: Awaited<ReturnType<typeof getLongitudinal>>;
  executive_summary: string;
  key_insights: string[];
  generated_at: string;
}

// ── Schema ────────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(pool: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_reports (
      id               SERIAL PRIMARY KEY,
      user_email       TEXT    NOT NULL,
      report_type_code TEXT    DEFAULT 'standard',
      overall_lbi      NUMERIC(5,2),
      report_data      JSONB   NOT NULL DEFAULT '{}',
      generated_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_lbi_reports_email_type
      ON lbi_reports(user_email, report_type_code, generated_at DESC);
  `);
  schemaReady = true;
}

// ── Executive Summary ─────────────────────────────────────────────────────────

function buildExecutiveSummary(
  lbi: number | null,
  style: string | null,
  trajectory: string,
  riskCount: number,
  reportType: ReportType
): string {
  const score = lbi != null ? Math.round(lbi) : null;
  const tier = score == null ? 'has not yet been scored'
    : score >= 75 ? 'shows strong learning behaviour'
    : score >= 55 ? 'shows developing learning behaviour with clear strengths'
    : score >= 35 ? 'is in the early stages of building effective learning habits'
    : 'is at the beginning of their learning behaviour journey';

  const trajectoryText = trajectory === 'improving' ? 'and is trending upward'
    : trajectory === 'stable'    ? 'and is holding steady'
    : trajectory === 'declining' ? 'with some areas needing attention'
    : '';

  const riskText = riskCount > 0
    ? ` ${riskCount} active area${riskCount > 1 ? 's' : ''} of attention ${riskCount > 1 ? 'have' : 'has'} been identified.`
    : ' No active risk indicators have been detected.';

  if (reportType === 'parent') {
    return `Your child ${tier}${trajectoryText ? ' ' + trajectoryText : ''}.${riskText} This report highlights practical ways you can support their learning at home.`;
  }
  if (reportType === 'summary') {
    return `Your Learning Behaviour Index (LBI) score is ${score ?? 'pending'}. You ${tier}${trajectoryText ? ' ' + trajectoryText : ''}.${riskText}`;
  }
  // Standard
  return `This Learning Behaviour Index report provides a full analysis of your learning patterns across five core dimensions. Your current LBI of ${score ?? 'pending'} indicates you ${tier}${trajectoryText ? ' ' + trajectoryText : ''}.${riskText} Review the recommendations below to activate targeted growth.`;
}

function buildKeyInsights(data: {
  lbi: number | null;
  style: string | null;
  peakDim: string | null;
  weakDim: string | null;
  trajectory: string;
  riskCount: number;
  topRec: string | null;
}): string[] {
  const insights: string[] = [];
  if (data.peakDim) insights.push(`Your strongest learning dimension is ${data.peakDim.replace('_score', '').replace('_', ' ')} — build on this as your anchor.`);
  if (data.weakDim) insights.push(`Your lowest-scoring dimension is ${data.weakDim.replace('_score', '').replace('_', ' ')} — this is your highest-leverage improvement area.`);
  if (data.style) insights.push(`Your dominant learning style is ${data.style} — understanding this helps you choose techniques that work for your brain.`);
  if (data.trajectory === 'improving') insights.push('Your overall trend is upward — your recent effort is producing measurable results. Keep the momentum going.');
  if (data.trajectory === 'declining') insights.push('Your recent trend shows a slight dip — a short reset routine (even 3 days of consistent practice) typically restores trajectory.');
  if (data.riskCount > 0) insights.push(`${data.riskCount} attention area${data.riskCount > 1 ? 's' : ''} identified — see the Risk section for targeted guidance.`);
  if (data.topRec) insights.push(`Top recommendation: ${data.topRec}`);
  if (insights.length === 0) insights.push('Complete more CAPADEX sessions to generate personalised insights.');
  return insights;
}

// ── Generate ──────────────────────────────────────────────────────────────────

export async function generateReport(
  email: string,
  reportType: ReportType = 'standard',
  pool: pg.Pool
): Promise<LbiReport | null> {
  try {
    await ensureSchema(pool);

    const [composite, trends, risks, recs, longitudinal] = await Promise.all([
      buildCompositeProfile(email, pool),
      getTrends(email, pool),
      getRiskProfile(email, pool),
      getRecommendations(email, pool, 8),
      getLongitudinal(email, pool),
    ]);

    const lbi = composite.learner.overall_lbi;
    const summary = buildExecutiveSummary(
      lbi, composite.learner.learning_style,
      longitudinal.trajectory, risks.risk_count, reportType
    );
    const insights = buildKeyInsights({
      lbi,
      style:       composite.learner.learning_style,
      peakDim:     trends.learning_trend?.peak_dimension ?? null,
      weakDim:     trends.learning_trend?.weak_dimension ?? null,
      trajectory:  longitudinal.trajectory,
      riskCount:   risks.risk_count,
      topRec:      recs[0]?.title ?? null,
    });

    const reportData: LbiReportData = {
      type:             reportType,
      learner:          composite.learner,
      behavior:         composite.behavior,
      velocity:         composite.velocity,
      trends,
      risks,
      recommendations:  recs,
      longitudinal,
      executive_summary: summary,
      key_insights:      insights,
      generated_at:      new Date().toISOString(),
    };

    const insertRes = await pool.query(`
      INSERT INTO lbi_reports (user_email, report_type_code, overall_lbi, report_data, generated_at)
      VALUES ($1,$2,$3,$4,NOW())
      RETURNING id, generated_at
    `, [email, reportType, lbi, JSON.stringify(reportData)]);

    const { id, generated_at } = insertRes.rows[0];

    // Archive to rf_generated_reports (non-blocking)
    pool.query(
      `INSERT INTO rf_generated_reports (user_id, report_type, status, data_snapshot, generated_content, completed_at)
       SELECT u.id, 'lbi', 'completed', $2::jsonb, $3::jsonb, NOW()
         FROM users u WHERE LOWER(COALESCE(NULLIF(TRIM(u.email),''), u.username)) = LOWER($1)
         LIMIT 1`,
      [
        email,
        JSON.stringify({ overall_lbi: lbi, report_type: reportType, lbi_report_id: id }),
        JSON.stringify({ executive_summary: summary, key_insights: insights }),
      ],
    ).catch((e: Error) => console.warn('[lbi-report] rf archive non-blocking fail:', e.message));

    return {
      id,
      user_email: email,
      report_type_code: reportType,
      overall_lbi: lbi,
      lbi_band: composite.learner.lbi_band,
      report_data: reportData,
      generated_at: generated_at instanceof Date ? generated_at.toISOString() : String(generated_at),
    };
  } catch (err) {
    console.error('[lbi-report] generateReport error:', err);
    return null;
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getReport(id: number, pool: pg.Pool): Promise<LbiReport | null> {
  try {
    await ensureSchema(pool);
    const res = await pool.query(
      `SELECT id, user_email, report_type_code, overall_lbi, report_data, generated_at
       FROM lbi_reports WHERE id=$1 LIMIT 1`, [id]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id:               r.id,
      user_email:       r.user_email,
      report_type_code: r.report_type_code,
      overall_lbi:      r.overall_lbi != null ? Number(r.overall_lbi) : null,
      lbi_band:         r.report_data?.learner?.lbi_band ?? 'no_data',
      report_data:      typeof r.report_data === 'string' ? JSON.parse(r.report_data) : r.report_data,
      generated_at:     r.generated_at instanceof Date ? r.generated_at.toISOString() : String(r.generated_at),
    };
  } catch (err) {
    console.error('[lbi-report] getReport error:', err);
    return null;
  }
}

export async function getLatestReport(
  email: string,
  reportType: ReportType = 'standard',
  pool: pg.Pool
): Promise<LbiReport | null> {
  try {
    await ensureSchema(pool);
    const res = await pool.query(
      `SELECT id, user_email, report_type_code, overall_lbi, report_data, generated_at
       FROM lbi_reports
       WHERE user_email=$1 AND report_type_code=$2
       ORDER BY generated_at DESC LIMIT 1`,
      [email, reportType]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id:               r.id,
      user_email:       r.user_email,
      report_type_code: r.report_type_code,
      overall_lbi:      r.overall_lbi != null ? Number(r.overall_lbi) : null,
      lbi_band:         r.report_data?.learner?.lbi_band ?? 'no_data',
      report_data:      typeof r.report_data === 'string' ? JSON.parse(r.report_data) : r.report_data,
      generated_at:     r.generated_at instanceof Date ? r.generated_at.toISOString() : String(r.generated_at),
    };
  } catch (err) {
    console.error('[lbi-report] getLatestReport error:', err);
    return null;
  }
}
