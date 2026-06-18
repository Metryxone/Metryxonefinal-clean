import type { Express } from "express";
import pg from "pg";

function zScore(value: number, mean: number, stdDev: number): number {
  return stdDev > 0 ? Math.round(((value - mean) / stdDev) * 1000) / 1000 : 0;
}

function biasSeverity(z: number): string {
  const abs = Math.abs(z);
  if (abs >= 2.5) return 'high';
  if (abs >= 1.5) return 'medium';
  if (abs >= 0.8) return 'low';
  return 'none';
}

async function runFairnessAnalysis(client: pg.PoolClient) {
  const reports: Array<Record<string, unknown>> = [];
  const biases: Array<Record<string, unknown>> = [];

  // Global baseline
  const global = await client.query(
    `SELECT ROUND(AVG(score)::numeric,2) as avg_score,
            ROUND(STDDEV(score)::numeric,2) as stddev_score,
            ROUND(COUNT(*)::numeric,0) as sample_size
     FROM capadex_sessions WHERE status='completed' AND score IS NOT NULL`
  );
  const globalAvg  = Number(global.rows[0].avg_score)   || 60;
  const globalStd  = Number(global.rows[0].stddev_score) || 15;
  const globalN    = Number(global.rows[0].sample_size)  || 0;

  if (globalN < 5) {
    return { reports: [], biases: [], message: 'insufficient data for fairness analysis' };
  }

  // Fairness by age_band
  const ageBandRes = await client.query(
    `SELECT age_band, ROUND(AVG(score)::numeric,2) as avg_score,
            ROUND(STDDEV(score)::numeric,2) as stddev_score, COUNT(*) as cnt
     FROM capadex_sessions WHERE status='completed' AND score IS NOT NULL AND age_band IS NOT NULL
     GROUP BY age_band`
  );
  for (const row of ageBandRes.rows) {
    const deviationPct = globalAvg > 0 ? Math.round(((Number(row.avg_score) - globalAvg) / globalAvg) * 100 * 10) / 10 : 0;
    const drift = Math.abs(deviationPct) > 10;
    reports.push({
      scope: 'age_band', group_label: row.age_band, metric_type: 'avg_score',
      metric_value: Number(row.avg_score), global_baseline: globalAvg,
      deviation_pct: deviationPct, drift_detected: drift,
      severity: Math.abs(deviationPct) > 20 ? 'moderate' : drift ? 'minor' : 'none',
    });
    // IRT bias check
    const z = zScore(Number(row.avg_score), globalAvg, globalStd);
    const sev = biasSeverity(z);
    if (sev !== 'none') {
      biases.push({
        model_type: 'Assessment', bias_type: 'age_bias',
        affected_group: `age_band_${row.age_band}`, severity: sev, z_score: z,
        evidence: { group_avg: Number(row.avg_score), global_avg: globalAvg, sample: Number(row.cnt) },
        recommendation: z < 0
          ? `Age band ${row.age_band} may require easier entry-level questions`
          : `Age band ${row.age_band} may be under-challenged; increase difficulty`,
        resolved: false,
      });
    }
  }

  // Fairness by stage_code
  const stageRes = await client.query(
    `SELECT stage_code, ROUND(AVG(score)::numeric,2) as avg_score, COUNT(*) as cnt
     FROM capadex_sessions WHERE status='completed' AND score IS NOT NULL
     GROUP BY stage_code`
  );
  const stageAvgs = stageRes.rows.map(r => Number(r.avg_score));
  const stageMean = stageAvgs.length > 0 ? stageAvgs.reduce((a,b)=>a+b,0)/stageAvgs.length : globalAvg;
  const stageStd  = stageAvgs.length > 1
    ? Math.sqrt(stageAvgs.map(v=>(v-stageMean)**2).reduce((a,b)=>a+b,0)/stageAvgs.length)
    : 10;

  for (const row of stageRes.rows) {
    const deviationPct = globalAvg > 0 ? Math.round(((Number(row.avg_score) - globalAvg) / globalAvg) * 100 * 10) / 10 : 0;
    reports.push({
      scope: 'stage', group_label: row.stage_code, metric_type: 'avg_score',
      metric_value: Number(row.avg_score), global_baseline: globalAvg,
      deviation_pct: deviationPct, drift_detected: Math.abs(deviationPct) > 15,
      severity: Math.abs(deviationPct) > 25 ? 'severe' : Math.abs(deviationPct) > 15 ? 'moderate' : 'none',
    });
    const z = zScore(Number(row.avg_score), stageMean, stageStd);
    if (Math.abs(z) >= 1.5) {
      biases.push({
        model_type: 'Assessment', bias_type: 'stage_bias',
        affected_group: row.stage_code, severity: biasSeverity(z), z_score: z,
        evidence: { stage_avg: Number(row.avg_score), mean: stageMean, sample: Number(row.cnt) },
        recommendation: z < -1.5 ? `Stage ${row.stage_code} may be excessively difficult` : `Stage ${row.stage_code} may not discriminate sufficiently`,
        resolved: false,
      });
    }
  }

  // Completion rate fairness by age_band
  const completionRes = await client.query(
    `SELECT age_band,
      ROUND(COUNT(*) FILTER (WHERE status='completed')::numeric / NULLIF(COUNT(*),0) * 100, 2) as completion_rate,
      COUNT(*) as total
     FROM capadex_sessions WHERE age_band IS NOT NULL GROUP BY age_band`
  );
  const compRates = completionRes.rows.map(r => Number(r.completion_rate));
  const compMean = compRates.length > 0 ? compRates.reduce((a,b)=>a+b,0)/compRates.length : 70;
  const compStd  = compRates.length > 1
    ? Math.sqrt(compRates.map(v=>(v-compMean)**2).reduce((a,b)=>a+b,0)/compRates.length)
    : 10;

  for (const row of completionRes.rows) {
    const deviationPct = compMean > 0 ? Math.round(((Number(row.completion_rate) - compMean) / compMean) * 100 * 10) / 10 : 0;
    reports.push({
      scope: 'age_band', group_label: row.age_band, metric_type: 'completion_rate',
      metric_value: Number(row.completion_rate), global_baseline: compMean,
      deviation_pct: deviationPct, drift_detected: Math.abs(deviationPct) > 15,
      severity: Math.abs(deviationPct) > 20 ? 'moderate' : 'none',
    });
    const z = zScore(Number(row.completion_rate), compMean, compStd);
    if (Math.abs(z) >= 1.5 && Number(row.total) >= 3) {
      biases.push({
        model_type: 'Assessment', bias_type: 'completion_bias',
        affected_group: `age_band_${row.age_band}`, severity: biasSeverity(z), z_score: z,
        evidence: { completion_rate: Number(row.completion_rate), mean: compMean, sample: Number(row.total) },
        recommendation: z < -1.5 ? `Age band ${row.age_band} has significantly lower completion — consider UX adaptation` : `Investigate potential ceiling effects for age band ${row.age_band}`,
        resolved: false,
      });
    }
  }

  return { reports, biases };
}

export function registerFairnessEngineRoutes(app: Express, pool: pg.Pool) {

  // POST /api/fairness/analyze
  app.post('/api/fairness/analyze', async (_req, res) => {
    const client = await pool.connect();
    try {
      const result = await runFairnessAnalysis(client);
      if ('message' in result && typeof result.message === 'string') {
        return res.json({ success: false, message: result.message });
      }
      // Store reports
      for (const r of result.reports) {
        await client.query(
          `INSERT INTO fairness_reports (scope,group_label,metric_type,metric_value,global_baseline,deviation_pct,drift_detected,severity,generated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [r.scope, r.group_label, r.metric_type, r.metric_value, r.global_baseline, r.deviation_pct, r.drift_detected, r.severity]
        );
      }
      // Store bias detections
      for (const b of result.biases) {
        await client.query(
          `INSERT INTO bias_detections (model_type,bias_type,affected_group,severity,z_score,evidence,recommendation,resolved,detected_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [b.model_type, b.bias_type, b.affected_group, b.severity, b.z_score, JSON.stringify(b.evidence), b.recommendation, b.resolved]
        );
      }
      res.json({ success: true, reports_generated: result.reports.length, biases_detected: result.biases.length });
    } catch (err) {
      console.error('Fairness analyze error:', err);
      res.status(500).json({ error: 'analysis failed' });
    } finally { client.release(); }
  });

  // GET /api/admin/fairness/dashboard
  app.get('/api/admin/fairness/dashboard', async (_req, res) => {
    try {
      const [kpi, driftReports, biasDetections, biasByType, severityDist] = await Promise.all([
        pool.query(`SELECT COUNT(*) as total_reports,
          COUNT(*) FILTER (WHERE drift_detected) as drift_count,
          COUNT(*) FILTER (WHERE severity='severe') as severe_count,
          COUNT(*) FILTER (WHERE severity='moderate') as moderate_count
          FROM fairness_reports WHERE generated_at > NOW()-INTERVAL '30 days'`),
        pool.query(`SELECT * FROM fairness_reports WHERE drift_detected ORDER BY generated_at DESC LIMIT 20`),
        pool.query(`SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE severity='high') as high_severity,
          COUNT(*) FILTER (WHERE severity='medium') as medium_severity,
          COUNT(*) FILTER (WHERE resolved=false) as unresolved
          FROM bias_detections`),
        pool.query(`SELECT bias_type, COUNT(*) as cnt, MAX(severity) as max_severity FROM bias_detections WHERE resolved=false GROUP BY bias_type ORDER BY cnt DESC`),
        pool.query(`SELECT severity, COUNT(*) as cnt FROM fairness_reports GROUP BY severity ORDER BY cnt DESC`),
      ]);
      const recentBiases = await pool.query(`SELECT * FROM bias_detections ORDER BY detected_at DESC LIMIT 15`);
      res.json({
        fairness_kpi: kpi.rows[0],
        bias_kpi: biasDetections.rows[0],
        drift_reports: driftReports.rows,
        bias_by_type: biasByType.rows,
        severity_distribution: severityDist.rows,
        recent_biases: recentBiases.rows,
      });
    } catch (err) {
      console.error('Fairness dashboard error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/fairness/reports
  app.get('/api/admin/fairness/reports', async (req, res) => {
    const { page='1', limit='50', scope, drift } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params: unknown[] = [];
    const where: string[] = [];
    if (scope) { params.push(scope); where.push(`scope=$${params.length}`); }
    if (drift === 'true') where.push(`drift_detected=true`);
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
      const [countRes, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM fairness_reports ${wc}`, params),
        pool.query(
          `SELECT * FROM fairness_reports ${wc} ORDER BY generated_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows });
    } catch (err) {
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/fairness/biases
  app.get('/api/admin/fairness/biases', async (req, res) => {
    const { resolved } = req.query as Record<string,string>;
    const where = resolved !== undefined ? `WHERE resolved=${resolved === 'true'}` : '';
    try {
      const rows = await pool.query(`SELECT * FROM bias_detections ${where} ORDER BY detected_at DESC`);
      res.json({ biases: rows.rows });
    } catch (err) {
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // PATCH /api/admin/fairness/biases/:id
  app.patch('/api/admin/fairness/biases/:id', async (req, res) => {
    const { id } = req.params;
    const { resolved } = req.body;
    try {
      const row = await pool.query(`UPDATE bias_detections SET resolved=$1 WHERE id=$2 RETURNING *`, [resolved, id]);
      res.json({ success: true, bias: row.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'update failed' });
    }
  });
}
