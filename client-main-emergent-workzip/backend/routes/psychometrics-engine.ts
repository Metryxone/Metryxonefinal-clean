import type { Express } from "express";
import pg from "pg";

function reliabilityGrade(alpha: number): string {
  if (alpha >= 0.90) return 'Excellent';
  if (alpha >= 0.80) return 'Good';
  if (alpha >= 0.70) return 'Acceptable';
  if (alpha >= 0.60) return 'Questionable';
  return 'Poor';
}

function biasRisk(sampleSize: number, alpha: number): string {
  if (sampleSize < 10) return 'high';
  if (sampleSize < 30 || alpha < 0.65) return 'medium';
  return 'low';
}

async function calibrateIRT(concernName: string | null, stageCode: string | null, source: string, client: pg.PoolClient) {
  // Pull response data for this assessment scope
  const whereClause = concernName
    ? `AND cs.concern_name=$3`
    : stageCode ? `AND cs.stage_code=$3` : '';
  const params: unknown[] = [source === 'short_assessment' ? 'short_assessment_questions' : 'sdi_items'];

  const query = `
    SELECT cr.item_id, cr.raw_score, cr.weighted_score, cr.response_value,
           cs.score as session_score
    FROM capadex_responses cr
    JOIN capadex_sessions cs ON cs.id=cr.session_id
    WHERE cs.status='completed'
    ${concernName ? `AND cs.concern_name='${concernName.replace(/'/g,"''")}'` : ''}
    ${stageCode ? `AND cs.stage_code='${stageCode.replace(/'/g,"''")}'` : ''}
    LIMIT 2000
  `;
  const respRes = await client.query(query);
  const responses = respRes.rows;
  if (responses.length < 5) return null;

  // Group by item_id
  const itemMap: Record<string, { scores: number[]; sessionScores: number[] }> = {};
  for (const r of responses) {
    if (!itemMap[r.item_id]) itemMap[r.item_id] = { scores: [], sessionScores: [] };
    itemMap[r.item_id].scores.push(Number(r.raw_score) || 0);
    itemMap[r.item_id].sessionScores.push(Number(r.session_score) || 0);
  }

  const items = Object.entries(itemMap);
  const allSessionScores = responses.map(r => Number(r.session_score) || 0);
  const sessionMean = allSessionScores.reduce((a, b) => a + b, 0) / allSessionScores.length;
  const sessionVar = allSessionScores.map(s => (s - sessionMean) ** 2).reduce((a, b) => a + b, 0) / allSessionScores.length;

  // Cronbach Alpha: α = (n/(n-1)) * (1 - Σitem_variance/total_variance)
  let sumItemVariance = 0;
  const itemCount = items.length;
  for (const [, data] of items) {
    const mean = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const variance = data.scores.map(s => (s - mean) ** 2).reduce((a, b) => a + b, 0) / data.scores.length;
    sumItemVariance += variance;
  }
  const totalVariance = sessionVar * items[0][1].scores.length;
  const cronbach_alpha = itemCount > 1 && totalVariance > 0
    ? Math.round(((itemCount / (itemCount - 1)) * (1 - sumItemVariance / Math.max(1, totalVariance))) * 1000) / 1000
    : 0;

  // Per-item IRT calibration
  const irtParams = [];
  for (const [itemId, data] of items) {
    const n = data.scores.length;
    const correctRate = data.scores.filter(s => s >= 50).length / n;
    const difficulty_param = Math.round((1 - correctRate) * 6 - 3) * 0.33; // -2 to +2 scale normalized

    // Discrimination: point-biserial correlation between item score and session score
    const itemMean = data.scores.reduce((a, b) => a + b, 0) / n;
    const sessMean = data.sessionScores.reduce((a, b) => a + b, 0) / n;
    const cov = data.scores.map((s, i) => (s - itemMean) * (data.sessionScores[i] - sessMean)).reduce((a, b) => a + b, 0) / n;
    const itemSD = Math.sqrt(data.scores.map(s => (s - itemMean) ** 2).reduce((a, b) => a + b, 0) / n);
    const sessSD  = Math.sqrt(data.sessionScores.map(s => (s - sessMean) ** 2).reduce((a, b) => a + b, 0) / n);
    const discrimination_param = itemSD > 0 && sessSD > 0 ? Math.round((cov / (itemSD * sessSD)) * 1000) / 1000 : 0.5;
    const guessing_param = 1 / Math.max(2, 4); // assume 4-option MCQ

    irtParams.push({ itemId, difficulty_param, discrimination_param, guessing_param, n });

    await client.query(
      `INSERT INTO item_irt_params (item_id,item_source,difficulty_param,discrimination_param,guessing_param,confidence_level,response_count,calibrated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (item_id,item_source) DO UPDATE SET
         difficulty_param=$3,discrimination_param=$4,guessing_param=$5,confidence_level=$6,response_count=$7,calibrated_at=NOW()`,
      [itemId, source, difficulty_param, discrimination_param, guessing_param,
       n >= 30 ? 0.90 : n >= 10 ? 0.70 : 0.50, n]
    );
  }

  const avgDifficulty     = irtParams.reduce((a, p) => a + p.difficulty_param, 0) / irtParams.length;
  const avgDiscrimination = irtParams.reduce((a, p) => a + p.discrimination_param, 0) / irtParams.length;
  const sampleSize = responses.length;

  // Clamp all values to NUMERIC(5,3) safe range (-9.999 to 9.999) and sensible domain bounds
  const clampAlpha = (v: number) => Math.round(Math.min(9.999, Math.max(-9.999, isFinite(v) ? v : 0)) * 1000) / 1000;
  const clampedAlpha = clampAlpha(cronbach_alpha);
  const validity_score = Math.round(Math.min(1, Math.max(0, (clampedAlpha + 1) / 2)) * 1000) / 1000;
  const clampNum = (v: number) => Math.round(Math.min(9.999, Math.max(-9.999, isFinite(v) ? v : 0)) * 1000) / 1000;

  return { cronbach_alpha: clampedAlpha, sampleSize, avgDifficulty: clampNum(avgDifficulty),
           avgDiscrimination: clampNum(avgDiscrimination), validity_score,
           itemCount, biasRisk: biasRisk(sampleSize, clampedAlpha),
           reliabilityGrade: reliabilityGrade(clampedAlpha) };
}

export function registerPsychometricsRoutes(app: Express, pool: pg.Pool) {

  // POST /api/psychometrics/calibrate
  app.post('/api/psychometrics/calibrate', async (req, res) => {
    const { assessment_type='CAPADEX', concern_name, stage_code } = req.body;
    const client = await pool.connect();
    try {
      const source = assessment_type === 'CAPADEX' ? 'short_assessment' : 'sdi';
      const result = await calibrateIRT(concern_name || null, stage_code || null, source, client);
      if (!result) return res.status(400).json({ error: 'insufficient data for calibration (minimum 5 responses required)' });

      await client.query(
        `INSERT INTO psychometric_reports (assessment_type,concern_name,stage_code,sample_size,cronbach_alpha,reliability_grade,validity_score,avg_difficulty,avg_discrimination,bias_risk,generated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        [assessment_type, concern_name||null, stage_code||null, result.sampleSize, result.cronbach_alpha,
         result.reliabilityGrade, result.validity_score, result.avgDifficulty, result.avgDiscrimination, result.biasRisk]
      );

      res.json({ success: true, report: {
        assessment_type, concern_name, stage_code,
        sample_size: result.sampleSize, item_count: result.itemCount,
        cronbach_alpha: result.cronbach_alpha, reliability_grade: result.reliabilityGrade,
        validity_score: result.validity_score, avg_difficulty: result.avgDifficulty,
        avg_discrimination: result.avgDiscrimination, bias_risk: result.biasRisk,
      }});
    } catch (err) {
      console.error('Psychometrics calibrate error:', err);
      res.status(500).json({ error: 'calibration failed' });
    } finally { client.release(); }
  });

  // POST /api/psychometrics/calibrate-all
  app.post('/api/psychometrics/calibrate-all', async (_req, res) => {
    res.json({ message: 'bulk calibration started in background' });
    (async () => {
      const client = await pool.connect();
      try {
        const stages = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'];
        for (const stage of stages) {
          try {
            const result = await calibrateIRT(null, stage, 'short_assessment', client);
            if (result) {
              await client.query(
                `INSERT INTO psychometric_reports (assessment_type,stage_code,sample_size,cronbach_alpha,reliability_grade,validity_score,avg_difficulty,avg_discrimination,bias_risk,generated_at)
                 VALUES ('CAPADEX',$1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
                [stage, result.sampleSize, result.cronbach_alpha, result.reliabilityGrade,
                 result.validity_score, result.avgDifficulty, result.avgDiscrimination, result.biasRisk]
              );
            }
          } catch { /* skip */ }
        }
      } finally { client.release(); }
    })();
  });

  // GET /api/admin/psychometrics/reports
  app.get('/api/admin/psychometrics/reports', async (req, res) => {
    const { page='1', limit='25', type } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    try {
      const where = type ? `WHERE assessment_type=$1` : '';
      const params: unknown[] = type ? [type] : [];
      const [countRes, rows, kpi, gradeDist, itemStats] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM psychometric_reports ${where}`, params),
        pool.query(
          `SELECT * FROM psychometric_reports ${where} ORDER BY generated_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
        pool.query(`SELECT ROUND(AVG(cronbach_alpha)::numeric,3) as avg_alpha,
          ROUND(AVG(validity_score)::numeric,3) as avg_validity,
          ROUND(AVG(sample_size)::numeric,0) as avg_sample,
          COUNT(*) FILTER (WHERE reliability_grade='Excellent') as excellent_count,
          COUNT(*) FILTER (WHERE reliability_grade='Good') as good_count,
          COUNT(*) FILTER (WHERE reliability_grade IN ('Questionable','Poor')) as poor_count,
          COUNT(*) FILTER (WHERE bias_risk='high') as high_bias_count
          FROM psychometric_reports`),
        pool.query(`SELECT reliability_grade, COUNT(*) as cnt FROM psychometric_reports GROUP BY reliability_grade ORDER BY cnt DESC`),
        pool.query(`SELECT COUNT(*) as total_items, ROUND(AVG(difficulty_param)::numeric,3) as avg_difficulty,
          ROUND(AVG(discrimination_param)::numeric,3) as avg_discrimination,
          ROUND(AVG(confidence_level)::numeric,2) as avg_confidence,
          SUM(response_count) as total_responses FROM item_irt_params`),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows,
                 kpi: kpi.rows[0], grade_distribution: gradeDist.rows, item_stats: itemStats.rows[0] });
    } catch (err) {
      console.error('Psychometrics reports error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });

  // GET /api/admin/psychometrics/items
  app.get('/api/admin/psychometrics/items', async (req, res) => {
    const { page='1', limit='50', source } = req.query as Record<string,string>;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const where = source ? `WHERE item_source=$1` : '';
    const params: unknown[] = source ? [source] : [];
    try {
      const [countRes, rows] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM item_irt_params ${where}`, params),
        pool.query(
          `SELECT * FROM item_irt_params ${where} ORDER BY response_count DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
          [...params, parseInt(limit), offset]
        ),
      ]);
      res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), rows: rows.rows });
    } catch (err) {
      console.error('IRT items error:', err);
      res.status(500).json({ error: 'fetch failed' });
    }
  });
}
