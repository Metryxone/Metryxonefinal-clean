import type { Pool } from 'pg';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface ResolvedChartData {
  labels: string[];
  datasets: ChartDataset[];
  metadata: {
    source: string;
    resolved_at: string;
    row_count: number;
    user_filtered: boolean;
    chart_type: string;
    config_key: string;
  };
}

export interface VizResolveParams {
  configKey: string;
  userId?: string;
  sessionId?: string;
  reportDataSnapshot?: Record<string, unknown>;
}

// ── Source resolvers ───────────────────────────────────────────────────────

// capadex: domain / concern score breakdown from sessions
async function resolveCapadex(pool: Pool, binding: Record<string, unknown>, params: VizResolveParams): Promise<ResolvedChartData> {
  const sessionId = params.sessionId;
  const chartType = String(binding.chart_type ?? 'bar');

  if (sessionId) {
    // Per-session response breakdown by item
    const { rows } = await pool.query(
      `SELECT cs.concern_name AS label, cs.score::numeric AS value
       FROM capadex_sessions cs
       WHERE cs.id = $1::uuid AND cs.status = 'complete'
       LIMIT 30`,
      [sessionId],
    ).catch(() => ({ rows: [] as any[] }));

    if (rows.length) {
      return {
        labels: rows.map(r => String(r.label ?? '')),
        datasets: [{ label: 'CAPADEX Score', data: rows.map(r => Math.round(Number(r.value || 0))) }],
        metadata: { source: 'capadex', resolved_at: new Date().toISOString(), row_count: rows.length, user_filtered: true, chart_type: chartType, config_key: params.configKey },
      };
    }
  }

  // Aggregate: top concerns by avg score across all completed sessions
  const { rows } = await pool.query(
    `SELECT concern_name AS label, ROUND(AVG(score)::numeric, 1) AS value, COUNT(*) AS cnt
     FROM capadex_sessions
     WHERE status = 'complete' AND score IS NOT NULL
     GROUP BY concern_name
     ORDER BY cnt DESC
     LIMIT 12`,
    [],
  ).catch(() => ({ rows: [] as any[] }));

  const labels = rows.map(r => String(r.label ?? ''));
  const data   = rows.map(r => Number(r.value ?? 0));
  return {
    labels,
    datasets: [{ label: 'Average CAPADEX Score', data }],
    metadata: { source: 'capadex', resolved_at: new Date().toISOString(), row_count: rows.length, user_filtered: false, chart_type: chartType, config_key: params.configKey },
  };
}

// career: readiness score series from cp_readiness_scores
async function resolveCareer(pool: Pool, binding: Record<string, unknown>, params: VizResolveParams): Promise<ResolvedChartData> {
  const chartType = String(binding.chart_type ?? 'line');
  const valField  = String(binding.values_field ?? 'score');
  const labField  = String(binding.labels_field ?? 'score_type');

  // Line chart: score history by score_type
  if (chartType === 'line' || binding.x_field === 'snapshot_date') {
    const { rows } = await pool.query(
      `SELECT crs.score_type AS series, crs.score::numeric AS value, DATE(crs.computed_at) AS label
       FROM cp_readiness_scores crs
       JOIN cp_passport cp ON cp.id = crs.passport_id
       WHERE crs.is_visible = true AND crs.score IS NOT NULL
       ORDER BY crs.computed_at DESC
       LIMIT 60`,
      [],
    ).catch(() => ({ rows: [] as any[] }));

    // Group by score_type into datasets
    const seriesMap: Record<string, { labels: string[]; data: number[] }> = {};
    for (const r of rows) {
      const s = String(r.series ?? 'score');
      if (!seriesMap[s]) seriesMap[s] = { labels: [], data: [] };
      seriesMap[s].labels.push(String(r.label ?? ''));
      seriesMap[s].data.push(Number(r.value ?? 0));
    }

    const allLabels = [...new Set(rows.map(r => String(r.label ?? '')))].sort();
    const datasets: ChartDataset[] = Object.entries(seriesMap).map(([lbl, d]) => ({ label: lbl, data: d.data }));

    return {
      labels: allLabels,
      datasets: datasets.length ? datasets : [{ label: 'No data', data: [] }],
      metadata: { source: 'career', resolved_at: new Date().toISOString(), row_count: rows.length, user_filtered: false, chart_type: chartType, config_key: params.configKey },
    };
  }

  // Gauge / bar: latest scores by type
  const { rows } = await pool.query(
    `SELECT crs.score_type AS label, ROUND(AVG(crs.score)::numeric, 1) AS value
     FROM cp_readiness_scores crs
     WHERE crs.is_visible = true AND crs.score IS NOT NULL
     GROUP BY crs.score_type
     ORDER BY label
     LIMIT 20`,
    [],
  ).catch(() => ({ rows: [] as any[] }));

  const labels = rows.map(r => String(r[labField] ?? r.label ?? ''));
  const data   = rows.map(r => Number(r[valField] ?? r.value ?? 0));
  return {
    labels,
    datasets: [{ label: 'Avg Readiness Score', data }],
    metadata: { source: 'career', resolved_at: new Date().toISOString(), row_count: rows.length, user_filtered: false, chart_type: chartType, config_key: params.configKey },
  };
}

// employability: the Employability Index (EI) score for a headline gauge.
// Reads the EI value straight from the report's data snapshot so the gauge ALWAYS
// matches the intro narrative (both consume the same {{ei_score}}). No fabrication:
// an absent / non-numeric ei_score yields an empty dataset (gauge has no value).
function resolveEmployability(binding: Record<string, unknown>, params: VizResolveParams): ResolvedChartData {
  const chartType = String(binding.chart_type ?? 'gauge');
  const valField  = String(binding.value_field ?? 'ei_score');
  const snap = params.reportDataSnapshot ?? {};
  const raw = snap[valField];
  const num = raw == null || raw === '' ? null : Number(raw);
  const value = num != null && Number.isFinite(num) ? num : null;
  return {
    labels: ['Employability Index'],
    datasets: [{ label: 'Employability Index', data: value != null ? [value] : [] }],
    metadata: { source: 'employability', resolved_at: new Date().toISOString(), row_count: value != null ? 1 : 0, user_filtered: false, chart_type: chartType, config_key: params.configKey },
  };
}

// competency: proficiency scores per category from cp_competencies
async function resolveCompetency(pool: Pool, binding: Record<string, unknown>, params: VizResolveParams): Promise<ResolvedChartData> {
  const chartType = String(binding.chart_type ?? 'radar');
  const xField    = String(binding.x_field ?? 'category');
  const yField    = String(binding.y_field ?? 'level');
  const valField  = String(binding.value_field ?? 'count');

  if (chartType === 'heatmap') {
    // Heatmap: category × proficiency_level → count
    const { rows } = await pool.query(
      `SELECT category AS cat, proficiency_level AS lvl, COUNT(*)::int AS cnt
       FROM cp_competencies
       WHERE proficiency_level IS NOT NULL AND category IS NOT NULL
       GROUP BY category, proficiency_level
       ORDER BY category, proficiency_level
       LIMIT 100`,
      [],
    ).catch(() => ({ rows: [] as any[] }));

    const categories = [...new Set(rows.map(r => String(r.cat ?? '')))];
    const levels     = [...new Set(rows.map(r => String(r.lvl ?? '')))];
    const dataMap: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const cat = String(r.cat ?? '');
      const lvl = String(r.lvl ?? '');
      if (!dataMap[cat]) dataMap[cat] = {};
      dataMap[cat][lvl] = Number(r.cnt ?? 0);
    }

    const datasets: ChartDataset[] = levels.map(lvl => ({
      label: lvl,
      data: categories.map(cat => dataMap[cat]?.[lvl] ?? 0),
    }));

    return {
      labels: categories,
      datasets,
      metadata: { source: 'competency', resolved_at: new Date().toISOString(), row_count: rows.length, user_filtered: false, chart_type: chartType, config_key: params.configKey },
    };
  }

  // Radar/bar: avg proficiency by category
  const { rows } = await pool.query(
    `SELECT category AS label, ROUND(AVG(proficiency_score)::numeric, 1) AS value, COUNT(*) AS cnt
     FROM cp_competencies
     WHERE proficiency_score IS NOT NULL AND category IS NOT NULL
     GROUP BY category
     ORDER BY label
     LIMIT 15`,
    [],
  ).catch(() => ({ rows: [] as any[] }));

  const labels = rows.map(r => String(r.label ?? ''));
  const data   = rows.map(r => Number(r.value ?? 0));
  return {
    labels,
    datasets: [{ label: 'Avg Proficiency', data }],
    metadata: { source: 'competency', resolved_at: new Date().toISOString(), row_count: rows.length, user_filtered: false, chart_type: chartType, config_key: params.configKey },
  };
}

// passport: section item counts across all passports
async function resolvePassport(pool: Pool, binding: Record<string, unknown>, params: VizResolveParams): Promise<ResolvedChartData> {
  const chartType = String(binding.chart_type ?? 'donut');

  const SECTIONS: { label: string; table: string }[] = [
    { label: 'Competencies',   table: 'cp_competencies' },
    { label: 'Assessments',    table: 'cp_assessments' },
    { label: 'Projects',       table: 'cp_projects' },
    { label: 'Achievements',   table: 'cp_achievements' },
    { label: 'Certifications', table: 'cp_certifications' },
    { label: 'Experience',     table: 'cp_experience' },
    { label: 'Learning',       table: 'cp_learning_history' },
    { label: 'Goals',          table: 'cp_career_goals' },
    { label: 'Scores',         table: 'cp_readiness_scores' },
  ];

  const labels: string[] = [];
  const data: number[] = [];
  let rowCount = 0;

  for (const sec of SECTIONS) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM ${sec.table}`, [],
    ).catch(() => ({ rows: [{ cnt: 0 }] as any[] }));
    const cnt = Number(rows[0]?.cnt ?? 0);
    labels.push(sec.label);
    data.push(cnt);
    rowCount += cnt;
  }

  return {
    labels,
    datasets: [{ label: 'Item Count', data }],
    metadata: { source: 'passport', resolved_at: new Date().toISOString(), row_count: rowCount, user_filtered: false, chart_type: chartType, config_key: params.configKey },
  };
}

// custom: pull from report data_snapshot
function resolveCustom(binding: Record<string, unknown>, params: VizResolveParams): ResolvedChartData {
  const snap = params.reportDataSnapshot ?? {};
  const labField = String(binding.labels_field ?? 'labels');
  const valField = String(binding.values_field ?? 'values');
  const labels = Array.isArray(snap[labField]) ? (snap[labField] as string[]).map(String) : [];
  const values = Array.isArray(snap[valField]) ? (snap[valField] as number[]).map(Number) : [];
  return {
    labels,
    datasets: [{ label: 'Data', data: values }],
    metadata: { source: 'custom', resolved_at: new Date().toISOString(), row_count: labels.length, user_filtered: false, chart_type: String(binding.chart_type ?? 'bar'), config_key: params.configKey },
  };
}

// ── Main resolver ──────────────────────────────────────────────────────────

export async function resolveVizData(pool: Pool, params: VizResolveParams): Promise<ResolvedChartData> {
  // Load the config
  const cfgRes = await pool.query(
    `SELECT * FROM rf_visualization_configs WHERE config_key=$1 AND is_active=true`, [params.configKey],
  ).catch(() => ({ rows: [] as any[] }));

  if (!cfgRes.rows.length) {
    return {
      labels: [],
      datasets: [],
      metadata: { source: 'unknown', resolved_at: new Date().toISOString(), row_count: 0, user_filtered: false, chart_type: 'bar', config_key: params.configKey },
    };
  }

  const cfg = cfgRes.rows[0];
  const dataSource: string = cfg.data_source ?? 'custom';
  const binding: Record<string, unknown> = { ...(cfg.data_binding ?? {}), chart_type: cfg.chart_type };

  switch (dataSource) {
    case 'capadex':       return resolveCapadex(pool, binding, params);
    case 'employability': return resolveEmployability(binding, params);
    case 'career':        return resolveCareer(pool, binding, params);
    case 'competency':    return resolveCompetency(pool, binding, params);
    case 'passport':      return resolvePassport(pool, binding, params);
    // 'any' = aggregate across all primary score sources: capadex + readiness
    case 'any': {
      const ct = String(binding.chart_type ?? 'bar');
      const capPromise = resolveCapadex(pool, binding, params);
      const carPromise = resolveCareer(pool, { ...binding, chart_type: 'bar' }, params);
      const [cap, car] = await Promise.all([capPromise, carPromise]);
      const merged: ResolvedChartData = {
        labels: [...cap.labels, ...car.labels].slice(0, 15),
        datasets: [
          { label: 'CAPADEX', data: cap.datasets[0]?.data ?? [] },
          { label: 'Readiness', data: car.datasets[0]?.data ?? [] },
        ],
        metadata: { source: 'any', resolved_at: new Date().toISOString(), row_count: cap.metadata.row_count + car.metadata.row_count, user_filtered: false, chart_type: ct, config_key: params.configKey },
      };
      return merged;
    }
    case 'custom':
    default:            return resolveCustom(binding, params);
  }
}
