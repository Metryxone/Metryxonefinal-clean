import type { Pool } from 'pg';

// ── Schema ─────────────────────────────────────────────────────────────────
export async function ensureEnterpriseAnalyticsSchema(pool: Pool): Promise<void> {
  await pool.query(`
    -- ── Data Lake: append-only raw events ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_event_lake (
      id          BIGSERIAL PRIMARY KEY,
      event_type  TEXT        NOT NULL,
      user_id     TEXT,
      session_id  TEXT,
      tenant_id   INTEGER,
      event_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload     JSONB       NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS anl_event_lake_type_at ON anl_event_lake(event_type, event_at DESC);
    CREATE INDEX IF NOT EXISTS anl_event_lake_user    ON anl_event_lake(user_id);
    CREATE INDEX IF NOT EXISTS anl_event_lake_session ON anl_event_lake(session_id);

    -- ── Fact: Sessions ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_fact_sessions (
      id                  BIGSERIAL PRIMARY KEY,
      source_session_id   TEXT        NOT NULL UNIQUE,
      user_id             TEXT,
      session_type        TEXT        NOT NULL DEFAULT 'capadex',
      started_at          TIMESTAMPTZ,
      completed_at        TIMESTAMPTZ,
      is_complete         BOOLEAN     NOT NULL DEFAULT FALSE,
      duration_seconds    INTEGER,
      score               NUMERIC(5,2),
      concern_count       INTEGER,
      answered_items      INTEGER,
      age_band            TEXT,
      persona             TEXT,
      stage_code          TEXT,
      outcome_model       TEXT,
      journey_destination TEXT,
      behaviour_score     NUMERIC(5,3),
      refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS anl_fact_sessions_complete ON anl_fact_sessions(is_complete, completed_at);
    CREATE INDEX IF NOT EXISTS anl_fact_sessions_user     ON anl_fact_sessions(user_id);

    -- ── Fact: Assessments ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_fact_assessments (
      id                  BIGSERIAL  PRIMARY KEY,
      source_passport_id  INTEGER    UNIQUE,
      user_id             TEXT,
      assessment_type     TEXT       NOT NULL DEFAULT 'competency',
      created_at          TIMESTAMPTZ,
      completeness_score  NUMERIC(5,2),
      total_competencies  INTEGER    NOT NULL DEFAULT 0,
      high_proficiency    INTEGER    NOT NULL DEFAULT 0,
      low_proficiency     INTEGER    NOT NULL DEFAULT 0,
      avg_proficiency     NUMERIC(5,2),
      verified_count      INTEGER    NOT NULL DEFAULT 0,
      refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── Fact: Daily Scores ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_fact_scores (
      id           BIGSERIAL   PRIMARY KEY,
      user_id      TEXT        NOT NULL,
      score_date   DATE        NOT NULL,
      score_type   TEXT        NOT NULL,
      score_value  NUMERIC(8,3),
      source_table TEXT,
      refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, score_date, score_type)
    );
    CREATE INDEX IF NOT EXISTS anl_fact_scores_type_date ON anl_fact_scores(score_type, score_date DESC);

    -- ── Dimension: Users ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_dim_users (
      id                    BIGSERIAL   PRIMARY KEY,
      user_key              TEXT        NOT NULL UNIQUE,
      first_seen_at         TIMESTAMPTZ,
      last_seen_at          TIMESTAMPTZ,
      age_band              TEXT,
      persona               TEXT,
      stage_code            TEXT,
      total_sessions        INTEGER     NOT NULL DEFAULT 0,
      completed_sessions    INTEGER     NOT NULL DEFAULT 0,
      total_assessments     INTEGER     NOT NULL DEFAULT 0,
      latest_capadex_score  NUMERIC(5,2),
      latest_readiness_score NUMERIC(5,2),
      latest_behaviour_score NUMERIC(5,3),
      user_segment          TEXT        NOT NULL DEFAULT 'new',
      refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── Dimension: Time (date spine) ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_dim_time (
      date_key     DATE PRIMARY KEY,
      year         INTEGER NOT NULL,
      quarter      INTEGER NOT NULL,
      month        INTEGER NOT NULL,
      month_name   TEXT    NOT NULL,
      week_of_year INTEGER NOT NULL,
      day_of_week  INTEGER NOT NULL,
      day_name     TEXT    NOT NULL,
      is_weekend   BOOLEAN NOT NULL
    );

    -- ── Dimension: Domain ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_dim_domain (
      id           BIGSERIAL   PRIMARY KEY,
      domain_key   TEXT        NOT NULL UNIQUE,
      domain_name  TEXT,
      family_count INTEGER     NOT NULL DEFAULT 0,
      signal_count INTEGER     NOT NULL DEFAULT 0,
      concern_count INTEGER    NOT NULL DEFAULT 0,
      refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── Dimension: Cohort ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_dim_cohort (
      id               BIGSERIAL   PRIMARY KEY,
      cohort_key       TEXT        NOT NULL UNIQUE,
      cohort_type      TEXT        NOT NULL,
      cohort_label     TEXT,
      first_entry_date DATE,
      user_count       INTEGER     NOT NULL DEFAULT 0,
      refreshed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── KPI Daily ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_kpi_daily (
      id              BIGSERIAL   PRIMARY KEY,
      date_key        DATE        NOT NULL,
      metric_name     TEXT        NOT NULL,
      metric_value    NUMERIC(14,4),
      metric_label    TEXT,
      dimension       TEXT        NOT NULL DEFAULT 'overall',
      dimension_value TEXT        NOT NULL DEFAULT 'all',
      refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(date_key, metric_name, dimension, dimension_value)
    );
    CREATE INDEX IF NOT EXISTS anl_kpi_daily_date   ON anl_kpi_daily(date_key DESC);
    CREATE INDEX IF NOT EXISTS anl_kpi_daily_metric ON anl_kpi_daily(metric_name, date_key DESC);

    -- ── Cohort Analysis ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_cohort_analysis (
      id                BIGSERIAL   PRIMARY KEY,
      cohort_key        TEXT        NOT NULL,
      cohort_type       TEXT        NOT NULL DEFAULT 'weekly',
      period_offset     INTEGER     NOT NULL DEFAULT 0,
      period_label      TEXT,
      users_in_cohort   INTEGER     NOT NULL DEFAULT 0,
      active_in_period  INTEGER     NOT NULL DEFAULT 0,
      retention_rate    NUMERIC(5,4) NOT NULL DEFAULT 0,
      avg_sessions      NUMERIC(6,2) NOT NULL DEFAULT 0,
      avg_score         NUMERIC(5,2),
      completed_in_period INTEGER   NOT NULL DEFAULT 0,
      refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(cohort_key, period_offset)
    );

    -- ── Benchmark Snapshots ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_benchmark_snapshot (
      id             BIGSERIAL   PRIMARY KEY,
      snapshot_date  DATE        NOT NULL,
      metric         TEXT        NOT NULL,
      cohort_segment TEXT        NOT NULL DEFAULT 'overall',
      p10            NUMERIC(8,3),
      p25            NUMERIC(8,3),
      p50            NUMERIC(8,3),
      p75            NUMERIC(8,3),
      p90            NUMERIC(8,3),
      mean           NUMERIC(8,3),
      stddev         NUMERIC(8,3),
      sample_size    INTEGER     NOT NULL DEFAULT 0,
      suppressed     BOOLEAN     NOT NULL DEFAULT FALSE,
      min_cohort_size INTEGER    NOT NULL DEFAULT 30,
      refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(snapshot_date, metric, cohort_segment)
    );

    -- ── Predictive Feature Store ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS anl_predictive_features (
      id                     BIGSERIAL   PRIMARY KEY,
      user_key               TEXT        NOT NULL,
      feature_date           DATE        NOT NULL,
      session_count          INTEGER     NOT NULL DEFAULT 0,
      completed_session_count INTEGER    NOT NULL DEFAULT 0,
      completion_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
      avg_score              NUMERIC(5,2),
      last_score             NUMERIC(5,2),
      score_trend            NUMERIC(6,4),
      motivation             NUMERIC(5,3),
      confidence             NUMERIC(5,3),
      risk_score             NUMERIC(5,3),
      engagement             NUMERIC(5,3),
      adaptability           NUMERIC(5,3),
      behaviour_dims_present INTEGER     NOT NULL DEFAULT 0,
      competency_count       INTEGER     NOT NULL DEFAULT 0,
      avg_proficiency        NUMERIC(5,2),
      high_proficiency_count INTEGER     NOT NULL DEFAULT 0,
      days_active            INTEGER     NOT NULL DEFAULT 0,
      days_since_last_session INTEGER,
      target_will_complete   BOOLEAN,
      target_high_performer  BOOLEAN,
      target_at_risk         BOOLEAN,
      feature_version        INTEGER     NOT NULL DEFAULT 1,
      refreshed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_key, feature_date)
    );
    CREATE INDEX IF NOT EXISTS anl_pred_features_user ON anl_predictive_features(user_key, feature_date DESC);
  `).catch((e: any) => console.error('[anl-schema] DDL error:', e.message));
}

// ── ETL Materializers ──────────────────────────────────────────────────────

async function materializeFactSessions(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    INSERT INTO anl_fact_sessions
      (source_session_id, user_id, session_type, started_at, completed_at, is_complete,
       duration_seconds, score, concern_count, answered_items, age_band, persona,
       stage_code, outcome_model, journey_destination, refreshed_at)
    SELECT
      cs.session_uuid::text,
      COALESCE(cs.user_id::text, cs.guest_email),
      'capadex',
      cs.created_at,
      CASE WHEN cs.status='complete' THEN cs.updated_at END,
      cs.status = 'complete',
      CASE WHEN cs.updated_at IS NOT NULL AND cs.created_at IS NOT NULL
           THEN EXTRACT(EPOCH FROM (cs.updated_at - cs.created_at))::integer END,
      cs.score,
      cs.concern_count,
      cs.answered_items,
      cs.age_band,
      cs.persona,
      cs.stage_code,
      COALESCE(wo.primary_outcome_model, wo.outcome_model),
      COALESCE(wj.journey_destination, wj.destination),
      NOW()
    FROM capadex_sessions cs
    LEFT JOIN LATERAL (
      SELECT outcome_model, primary_outcome_model
        FROM wc3_outcome_intelligence
       WHERE session_id = cs.session_uuid::text
       LIMIT 1
    ) wo ON TRUE
    LEFT JOIN LATERAL (
      SELECT journey_destination, destination
        FROM wc3_journey_intelligence
       WHERE session_id = cs.session_uuid::text
       LIMIT 1
    ) wj ON TRUE
    ON CONFLICT (source_session_id) DO UPDATE SET
      is_complete         = EXCLUDED.is_complete,
      completed_at        = EXCLUDED.completed_at,
      score               = EXCLUDED.score,
      duration_seconds    = EXCLUDED.duration_seconds,
      outcome_model       = EXCLUDED.outcome_model,
      journey_destination = EXCLUDED.journey_destination,
      refreshed_at        = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  return rows.length;
}

async function materializeFactAssessments(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    INSERT INTO anl_fact_assessments
      (source_passport_id, user_id, assessment_type, created_at,
       completeness_score, total_competencies, high_proficiency, low_proficiency,
       avg_proficiency, verified_count, refreshed_at)
    SELECT
      p.id,
      p.user_id::text,
      'competency',
      p.created_at,
      p.completeness_score,
      COUNT(c.id)::integer,
      COUNT(c.id) FILTER (WHERE c.proficiency_score >= 70)::integer,
      COUNT(c.id) FILTER (WHERE c.proficiency_score < 40 AND c.proficiency_score IS NOT NULL)::integer,
      AVG(c.proficiency_score),
      COUNT(c.id) FILTER (WHERE c.is_verified = TRUE)::integer,
      NOW()
    FROM cp_passport p
    LEFT JOIN cp_competencies c ON c.passport_id = p.id
    GROUP BY p.id, p.user_id, p.created_at, p.completeness_score
    ON CONFLICT (source_passport_id) DO UPDATE SET
      completeness_score  = EXCLUDED.completeness_score,
      total_competencies  = EXCLUDED.total_competencies,
      high_proficiency    = EXCLUDED.high_proficiency,
      low_proficiency     = EXCLUDED.low_proficiency,
      avg_proficiency     = EXCLUDED.avg_proficiency,
      verified_count      = EXCLUDED.verified_count,
      refreshed_at        = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  return rows.length;
}

async function materializeFactScores(pool: Pool): Promise<number> {
  let count = 0;
  // CAPADEX scores
  const { rows: cs } = await pool.query(`
    INSERT INTO anl_fact_scores (user_id, score_date, score_type, score_value, source_table, refreshed_at)
    SELECT COALESCE(user_id::text, guest_email), updated_at::date, 'capadex', score, 'capadex_sessions', NOW()
    FROM capadex_sessions
    WHERE score IS NOT NULL AND (updated_at IS NOT NULL OR created_at IS NOT NULL)
    ON CONFLICT (user_id, score_date, score_type) DO UPDATE SET
      score_value = GREATEST(EXCLUDED.score_value, anl_fact_scores.score_value),
      refreshed_at = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  count += cs.length;

  // Behaviour scores from wcl0
  const { rows: bh } = await pool.query(`
    INSERT INTO anl_fact_scores (user_id, score_date, score_type, score_value, source_table, refreshed_at)
    SELECT user_id::text, updated_at::date,
           'behaviour',
           ROUND((COALESCE(motivation,0)+COALESCE(confidence,0)+COALESCE(risk,0)+COALESCE(engagement,0)+COALESCE(adaptability,0))::numeric /
             NULLIF((CASE WHEN motivation IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN confidence IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN risk IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN engagement IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN adaptability IS NOT NULL THEN 1 ELSE 0 END), 0), 3),
           'wcl0_user_intelligence', NOW()
    FROM wcl0_user_intelligence
    WHERE behaviour_dims_present > 0 AND updated_at IS NOT NULL
    ON CONFLICT (user_id, score_date, score_type) DO UPDATE SET
      score_value  = EXCLUDED.score_value,
      refreshed_at = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  count += bh.length;

  // Readiness scores
  const { rows: rs } = await pool.query(`
    INSERT INTO anl_fact_scores (user_id, score_date, score_type, score_value, source_table, refreshed_at)
    SELECT crs.user_id::text, crs.computed_at::date, 'readiness', crs.readiness_score, 'cp_readiness_scores', NOW()
    FROM cp_readiness_scores crs
    WHERE crs.readiness_score IS NOT NULL
    ON CONFLICT (user_id, score_date, score_type) DO UPDATE SET
      score_value  = EXCLUDED.score_value,
      refreshed_at = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  count += rs.length;

  // LBI learning behaviour scores (E9)
  const { rows: lb } = await pool.query(`
    INSERT INTO anl_fact_scores (user_id, score_date, score_type, score_value, source_table, refreshed_at)
    SELECT u.id::text, l.calculated_at::date, 'lbi', l.overall_lbi, 'lbi_scores', NOW()
    FROM lbi_scores l
    JOIN users u ON LOWER(COALESCE(NULLIF(TRIM(u.email),''), u.username)) = l.user_email
    WHERE l.overall_lbi IS NOT NULL
    ON CONFLICT (user_id, score_date, score_type) DO UPDATE SET
      score_value  = EXCLUDED.score_value,
      refreshed_at = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  count += lb.length;

  return count;
}

async function materializeDimUsers(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    INSERT INTO anl_dim_users
      (user_key, first_seen_at, last_seen_at, age_band, persona, stage_code,
       total_sessions, completed_sessions, latest_capadex_score, user_segment, refreshed_at)
    SELECT
      COALESCE(cs.user_id::text, cs.guest_email) AS user_key,
      MIN(cs.created_at)         AS first_seen_at,
      MAX(cs.updated_at)         AS last_seen_at,
      MODE() WITHIN GROUP (ORDER BY cs.age_band) AS age_band,
      MODE() WITHIN GROUP (ORDER BY cs.persona)  AS persona,
      MODE() WITHIN GROUP (ORDER BY cs.stage_code) AS stage_code,
      COUNT(*)::integer          AS total_sessions,
      COUNT(*) FILTER (WHERE cs.status='complete')::integer AS completed_sessions,
      MAX(cs.score) FILTER (WHERE cs.status='complete') AS latest_capadex_score,
      CASE
        WHEN MAX(cs.updated_at) < NOW() - INTERVAL '30 days' THEN 'churned'
        WHEN MAX(cs.updated_at) > NOW() - INTERVAL '7 days'  THEN 'active'
        WHEN COUNT(*) > 1 THEN 'returning'
        ELSE 'new'
      END AS user_segment,
      NOW()
    FROM capadex_sessions cs
    WHERE COALESCE(cs.user_id::text, cs.guest_email) IS NOT NULL
    GROUP BY COALESCE(cs.user_id::text, cs.guest_email)
    ON CONFLICT (user_key) DO UPDATE SET
      last_seen_at           = EXCLUDED.last_seen_at,
      total_sessions         = EXCLUDED.total_sessions,
      completed_sessions     = EXCLUDED.completed_sessions,
      latest_capadex_score   = EXCLUDED.latest_capadex_score,
      user_segment           = EXCLUDED.user_segment,
      refreshed_at           = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  return rows.length;
}

async function materializeDimTime(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    INSERT INTO anl_dim_time
      (date_key, year, quarter, month, month_name, week_of_year, day_of_week, day_name, is_weekend)
    SELECT
      d::date,
      EXTRACT(year    FROM d)::integer,
      EXTRACT(quarter FROM d)::integer,
      EXTRACT(month   FROM d)::integer,
      TO_CHAR(d, 'Month'),
      EXTRACT(week    FROM d)::integer,
      EXTRACT(isodow  FROM d)::integer,
      TO_CHAR(d, 'Day'),
      EXTRACT(isodow  FROM d) IN (6,7)
    FROM GENERATE_SERIES(
      (CURRENT_DATE - INTERVAL '2 years')::date,
      (CURRENT_DATE + INTERVAL '1 year')::date,
      '1 day'::interval
    ) AS g(d)
    ON CONFLICT (date_key) DO NOTHING
    RETURNING date_key
  `).catch(() => ({ rows: [] }));
  return rows.length;
}

async function materializeDimDomain(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    INSERT INTO anl_dim_domain (domain_key, domain_name, family_count, signal_count, concern_count, refreshed_at)
    SELECT
      LOWER(REPLACE(COALESCE(o.domain, 'unknown'), ' ', '_')) AS domain_key,
      COALESCE(o.domain, 'Unknown') AS domain_name,
      COUNT(DISTINCT o.family_name)::integer   AS family_count,
      COUNT(DISTINCT o.signal_name)::integer   AS signal_count,
      COUNT(DISTINCT cm.id)::integer           AS concern_count,
      NOW()
    FROM capadex_ontology_families o
    LEFT JOIN concerns_master cm ON cm.domain = o.domain
    WHERE o.domain IS NOT NULL
    GROUP BY LOWER(REPLACE(COALESCE(o.domain,'unknown'),' ','_')), COALESCE(o.domain,'Unknown')
    ON CONFLICT (domain_key) DO UPDATE SET
      family_count  = EXCLUDED.family_count,
      signal_count  = EXCLUDED.signal_count,
      concern_count = EXCLUDED.concern_count,
      refreshed_at  = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  return rows.length;
}

async function materializeDimCohort(pool: Pool): Promise<number> {
  const { rows } = await pool.query(`
    INSERT INTO anl_dim_cohort (cohort_key, cohort_type, cohort_label, first_entry_date, user_count, refreshed_at)
    SELECT
      'weekly_' || TO_CHAR(DATE_TRUNC('week', first_seen), 'YYYY_IW') AS cohort_key,
      'weekly',
      'Week of ' || TO_CHAR(DATE_TRUNC('week', first_seen), 'Mon DD, YYYY'),
      DATE_TRUNC('week', first_seen)::date,
      COUNT(*)::integer,
      NOW()
    FROM (
      SELECT MIN(created_at) AS first_seen
      FROM capadex_sessions
      WHERE COALESCE(user_id::text, guest_email) IS NOT NULL
      GROUP BY COALESCE(user_id::text, guest_email)
    ) u
    GROUP BY DATE_TRUNC('week', first_seen)
    ON CONFLICT (cohort_key) DO UPDATE SET
      user_count   = EXCLUDED.user_count,
      refreshed_at = NOW()
    RETURNING id
  `).catch(() => ({ rows: [] }));
  return rows.length;
}

// ── KPI Computation ────────────────────────────────────────────────────────

export async function computeKPIs(pool: Pool): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const metrics: Array<{ name: string; value: number | null; label: string }> = [];

  const q = async (sql: string): Promise<number | null> => {
    try {
      const { rows } = await pool.query(sql);
      const v = rows[0]?.v;
      return v == null ? null : Number(v);
    } catch { return null; }
  };

  metrics.push({ name: 'total_users',        label: 'Total Users',          value: await q(`SELECT COUNT(*) v FROM anl_dim_users`) });
  metrics.push({ name: 'new_users_7d',        label: 'New Users (7d)',       value: await q(`SELECT COUNT(*) v FROM anl_dim_users WHERE first_seen_at > NOW()-INTERVAL '7 days'`) });
  metrics.push({ name: 'active_users_7d',     label: 'Active Users (7d)',    value: await q(`SELECT COUNT(*) v FROM anl_dim_users WHERE last_seen_at  > NOW()-INTERVAL '7 days'`) });
  metrics.push({ name: 'active_users_30d',    label: 'Active Users (30d)',   value: await q(`SELECT COUNT(*) v FROM anl_dim_users WHERE last_seen_at  > NOW()-INTERVAL '30 days'`) });
  metrics.push({ name: 'sessions_total',      label: 'Total Sessions',       value: await q(`SELECT COUNT(*) v FROM anl_fact_sessions`) });
  metrics.push({ name: 'sessions_completed',  label: 'Completed Sessions',   value: await q(`SELECT COUNT(*) v FROM anl_fact_sessions WHERE is_complete=TRUE`) });
  metrics.push({ name: 'assessments_total',   label: 'Assessments',          value: await q(`SELECT COUNT(*) v FROM anl_fact_assessments`) });

  const total = await q(`SELECT NULLIF(COUNT(*),0) v FROM anl_fact_sessions`);
  const done  = await q(`SELECT COUNT(*) v FROM anl_fact_sessions WHERE is_complete=TRUE`);
  metrics.push({ name: 'completion_rate', label: 'Completion Rate', value: total != null && total > 0 ? Number(((done ?? 0) / total).toFixed(4)) : null });

  metrics.push({ name: 'avg_score',        label: 'Avg CAPADEX Score',  value: await q(`SELECT ROUND(AVG(score),2) v FROM anl_fact_sessions WHERE is_complete=TRUE AND score IS NOT NULL`) });
  metrics.push({ name: 'p50_score',        label: 'Median Score',       value: await q(`SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score),2) v FROM anl_fact_sessions WHERE is_complete=TRUE AND score IS NOT NULL`) });
  metrics.push({ name: 'p75_score',        label: 'P75 Score',          value: await q(`SELECT ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score),2) v FROM anl_fact_sessions WHERE is_complete=TRUE AND score IS NOT NULL`) });
  metrics.push({ name: 'avg_behaviour',    label: 'Avg Behaviour Score', value: await q(`SELECT ROUND(AVG(score_value)::numeric,3) v FROM anl_fact_scores WHERE score_type='behaviour'`) });
  metrics.push({ name: 'high_performers',  label: 'High Performers (≥75)', value: await q(`SELECT COUNT(*) v FROM anl_dim_users WHERE latest_capadex_score >= 75`) });
  metrics.push({ name: 'at_risk_users',    label: 'At-Risk (>30d inactive)', value: await q(`SELECT COUNT(*) v FROM anl_dim_users WHERE user_segment='churned'`) });
  metrics.push({ name: 'returning_users',  label: 'Returning Users',    value: await q(`SELECT COUNT(*) v FROM anl_dim_users WHERE user_segment IN ('returning','active')`) });

  let inserted = 0;
  for (const m of metrics) {
    if (m.value == null) continue;
    await pool.query(`
      INSERT INTO anl_kpi_daily (date_key, metric_name, metric_value, metric_label, dimension, dimension_value, refreshed_at)
      VALUES ($1,$2,$3,$4,'overall','all',NOW())
      ON CONFLICT (date_key, metric_name, dimension, dimension_value)
      DO UPDATE SET metric_value=EXCLUDED.metric_value, metric_label=EXCLUDED.metric_label, refreshed_at=NOW()
    `, [today, m.name, m.value, m.label]).catch(() => null);
    inserted++;
  }
  return inserted;
}

// ── Cohort Analysis ────────────────────────────────────────────────────────

export async function computeCohortAnalysis(pool: Pool): Promise<number> {
  const cohortRows = await pool.query(`
    SELECT cohort_key, first_entry_date, user_count FROM anl_dim_cohort WHERE cohort_type='weekly'
  `).catch(() => ({ rows: [] as any[] }));

  let inserted = 0;
  for (const cohort of cohortRows.rows) {
    const wStart = new Date(cohort.first_entry_date);
    for (const offset of [0, 1, 2, 4, 8, 12]) {
      const periodStart = new Date(wStart.getTime() + offset * 7 * 86400000);
      const periodEnd   = new Date(periodStart.getTime() + 7 * 86400000);
      const periodLabel = `Week ${offset}`;

      const cohortUsers = await pool.query(`
        SELECT COALESCE(user_id::text, guest_email) AS uid
        FROM capadex_sessions
        WHERE created_at >= $1 AND created_at < $2
          AND COALESCE(user_id::text, guest_email) IS NOT NULL
        GROUP BY COALESCE(user_id::text, guest_email)
      `, [wStart, new Date(wStart.getTime() + 7 * 86400000)]).catch(() => ({ rows: [] as any[] }));

      if (cohortUsers.rows.length === 0) continue;
      const uids = cohortUsers.rows.map((r: any) => r.uid);

      const activeRes = await pool.query(`
        SELECT COUNT(DISTINCT COALESCE(user_id::text, guest_email)) AS active,
               ROUND(AVG(score),2) AS avg_score,
               COUNT(*) FILTER (WHERE status='complete') AS completed
        FROM capadex_sessions
        WHERE COALESCE(user_id::text, guest_email) = ANY($1)
          AND created_at >= $2 AND created_at < $3
      `, [uids, periodStart, periodEnd]).catch(() => ({ rows: [{ active: 0, avg_score: null, completed: 0 }] }));

      const active    = Number(activeRes.rows[0]?.active ?? 0);
      const avgScore  = activeRes.rows[0]?.avg_score ?? null;
      const completed = Number(activeRes.rows[0]?.completed ?? 0);
      const retention = uids.length > 0 ? active / uids.length : 0;

      await pool.query(`
        INSERT INTO anl_cohort_analysis
          (cohort_key, cohort_type, period_offset, period_label, users_in_cohort,
           active_in_period, retention_rate, avg_score, completed_in_period, refreshed_at)
        VALUES ($1,'weekly',$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (cohort_key, period_offset) DO UPDATE SET
          users_in_cohort    = EXCLUDED.users_in_cohort,
          active_in_period   = EXCLUDED.active_in_period,
          retention_rate     = EXCLUDED.retention_rate,
          avg_score          = EXCLUDED.avg_score,
          completed_in_period = EXCLUDED.completed_in_period,
          refreshed_at       = NOW()
      `, [cohort.cohort_key, offset, periodLabel, uids.length, active, retention, avgScore, completed]).catch(() => null);
      inserted++;
    }
  }
  return inserted;
}

// ── Benchmark Snapshots ────────────────────────────────────────────────────

export async function computeBenchmarkSnapshots(pool: Pool): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const MIN_K = 30;
  const metrics: Array<{ name: string; sql: string }> = [
    { name: 'capadex_score',   sql: `SELECT score::numeric v FROM anl_fact_sessions WHERE is_complete=TRUE AND score IS NOT NULL` },
    { name: 'behaviour_score', sql: `SELECT score_value::numeric v FROM anl_fact_scores WHERE score_type='behaviour' AND score_value IS NOT NULL` },
    { name: 'readiness_score', sql: `SELECT score_value::numeric v FROM anl_fact_scores WHERE score_type='readiness' AND score_value IS NOT NULL` },
    { name: 'competency_avg',  sql: `SELECT avg_proficiency::numeric v FROM anl_fact_assessments WHERE avg_proficiency IS NOT NULL` },
    { name: 'session_count',   sql: `SELECT total_sessions::numeric v FROM anl_dim_users WHERE total_sessions > 0` },
    { name: 'completion_rate', sql: `SELECT completion_rate::numeric v FROM anl_predictive_features WHERE completion_rate IS NOT NULL` },
  ];

  let inserted = 0;
  for (const m of metrics) {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::integer                                                        AS n,
        ROUND(PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY v)::numeric, 3)      AS p10,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY v)::numeric, 3)     AS p25,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)::numeric, 3)      AS p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY v)::numeric, 3)     AS p75,
        ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY v)::numeric, 3)      AS p90,
        ROUND(AVG(v)::numeric, 3)                                               AS mean,
        ROUND(STDDEV(v)::numeric, 3)                                            AS sd
      FROM (${m.sql}) t
    `).catch(() => ({ rows: [] as any[] }));

    const r = rows[0];
    const n = Number(r?.n ?? 0);
    const suppressed = n < MIN_K;
    await pool.query(`
      INSERT INTO anl_benchmark_snapshot
        (snapshot_date, metric, cohort_segment, p10, p25, p50, p75, p90, mean, stddev, sample_size, suppressed, min_cohort_size, refreshed_at)
      VALUES ($1,$2,'overall',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (snapshot_date, metric, cohort_segment) DO UPDATE SET
        p10=EXCLUDED.p10, p25=EXCLUDED.p25, p50=EXCLUDED.p50,
        p75=EXCLUDED.p75, p90=EXCLUDED.p90, mean=EXCLUDED.mean,
        stddev=EXCLUDED.stddev, sample_size=EXCLUDED.sample_size,
        suppressed=EXCLUDED.suppressed, refreshed_at=NOW()
    `, [today, m.name, suppressed ? null : r?.p10, suppressed ? null : r?.p25,
        suppressed ? null : r?.p50, suppressed ? null : r?.p75, suppressed ? null : r?.p90,
        suppressed ? null : r?.mean, suppressed ? null : r?.sd, n, suppressed, MIN_K]).catch(() => null);
    inserted++;
  }
  return inserted;
}

// ── Predictive Feature Store ───────────────────────────────────────────────

export async function computePredictiveFeatures(pool: Pool): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const { rows } = await pool.query(`
    SELECT
      u.user_key,
      u.total_sessions              AS session_count,
      u.completed_sessions          AS completed_session_count,
      ROUND(CASE WHEN u.total_sessions > 0 THEN u.completed_sessions::numeric / u.total_sessions ELSE 0 END, 4) AS completion_rate,
      u.latest_capadex_score        AS last_score,
      (SELECT ROUND(AVG(score),2) FROM anl_fact_sessions s WHERE s.user_id=u.user_key AND is_complete=TRUE) AS avg_score,
      w.motivation, w.confidence, w.risk AS risk_score, w.engagement, w.adaptability,
      w.behaviour_dims_present,
      a.total_competencies          AS competency_count,
      a.avg_proficiency,
      a.high_proficiency            AS high_proficiency_count,
      EXTRACT(EPOCH FROM (NOW() - u.last_seen_at)) / 86400 AS days_since_last_session,
      (SELECT COUNT(DISTINCT created_at::date) FROM capadex_sessions cs
        WHERE COALESCE(cs.user_id::text, cs.guest_email)=u.user_key) AS days_active
    FROM anl_dim_users u
    LEFT JOIN wcl0_user_intelligence w ON w.user_id::text = u.user_key
    LEFT JOIN anl_fact_assessments   a ON a.user_id = u.user_key
  `).catch(() => ({ rows: [] as any[] }));

  let inserted = 0;
  for (const r of rows) {
    const dsl = r.days_since_last_session != null ? Number(r.days_since_last_session) : null;
    const lastScore = r.last_score != null ? Number(r.last_score) : null;
    const compRate  = Number(r.completion_rate ?? 0);

    await pool.query(`
      INSERT INTO anl_predictive_features
        (user_key, feature_date, session_count, completed_session_count, completion_rate,
         avg_score, last_score, motivation, confidence, risk_score, engagement, adaptability,
         behaviour_dims_present, competency_count, avg_proficiency, high_proficiency_count,
         days_active, days_since_last_session,
         target_will_complete, target_high_performer, target_at_risk,
         feature_version, refreshed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,1,NOW())
      ON CONFLICT (user_key, feature_date) DO UPDATE SET
        session_count          = EXCLUDED.session_count,
        completed_session_count= EXCLUDED.completed_session_count,
        completion_rate        = EXCLUDED.completion_rate,
        avg_score              = EXCLUDED.avg_score,
        last_score             = EXCLUDED.last_score,
        motivation             = EXCLUDED.motivation,
        confidence             = EXCLUDED.confidence,
        risk_score             = EXCLUDED.risk_score,
        engagement             = EXCLUDED.engagement,
        adaptability           = EXCLUDED.adaptability,
        behaviour_dims_present = EXCLUDED.behaviour_dims_present,
        competency_count       = EXCLUDED.competency_count,
        avg_proficiency        = EXCLUDED.avg_proficiency,
        high_proficiency_count = EXCLUDED.high_proficiency_count,
        days_active            = EXCLUDED.days_active,
        days_since_last_session= EXCLUDED.days_since_last_session,
        target_will_complete   = EXCLUDED.target_will_complete,
        target_high_performer  = EXCLUDED.target_high_performer,
        target_at_risk         = EXCLUDED.target_at_risk,
        refreshed_at           = NOW()
    `, [
      r.user_key, today,
      Number(r.session_count ?? 0), Number(r.completed_session_count ?? 0), compRate,
      r.avg_score ?? null, lastScore,
      r.motivation ?? null, r.confidence ?? null, r.risk_score ?? null,
      r.engagement ?? null, r.adaptability ?? null,
      Number(r.behaviour_dims_present ?? 0),
      Number(r.competency_count ?? 0), r.avg_proficiency ?? null, Number(r.high_proficiency_count ?? 0),
      Number(r.days_active ?? 0), dsl,
      compRate >= 0.5,
      lastScore != null && lastScore >= 75,
      dsl != null && dsl > 30,
    ]).catch(() => null);
    inserted++;
  }
  return inserted;
}

// ── Full Refresh Orchestrator ──────────────────────────────────────────────

export interface RefreshResult {
  started_at:  string;
  finished_at: string;
  steps: Record<string, { rows: number; duration_ms: number; error?: string }>;
}

export async function refreshAllAnalytics(pool: Pool): Promise<RefreshResult> {
  const started = Date.now();
  const steps: RefreshResult['steps'] = {};

  const step = async (name: string, fn: () => Promise<number>) => {
    const t0 = Date.now();
    try {
      const rows = await fn();
      steps[name] = { rows, duration_ms: Date.now() - t0 };
    } catch (e: any) {
      steps[name] = { rows: 0, duration_ms: Date.now() - t0, error: e.message };
    }
  };

  // Ordered: schema → facts → dims → analytics
  await step('schema',               () => ensureEnterpriseAnalyticsSchema(pool).then(() => 0));
  await step('fact_sessions',        () => materializeFactSessions(pool));
  await step('fact_assessments',     () => materializeFactAssessments(pool));
  await step('fact_scores',          () => materializeFactScores(pool));
  await step('dim_time',             () => materializeDimTime(pool));
  await step('dim_domain',           () => materializeDimDomain(pool));
  await step('dim_users',            () => materializeDimUsers(pool));
  await step('dim_cohort',           () => materializeDimCohort(pool));
  await step('kpis',                 () => computeKPIs(pool));
  await step('cohort_analysis',      () => computeCohortAnalysis(pool));
  await step('benchmark_snapshots',  () => computeBenchmarkSnapshots(pool));
  await step('predictive_features',  () => computePredictiveFeatures(pool));

  return {
    started_at:  new Date(started).toISOString(),
    finished_at: new Date().toISOString(),
    steps,
  };
}

// ── Warehouse Status ───────────────────────────────────────────────────────

export interface TableStatus { table: string; rows: number; last_refreshed: string | null; category: string }

export async function getWarehouseStatus(pool: Pool): Promise<TableStatus[]> {
  const anl: Array<{ table: string; category: string; refresh_col?: string }> = [
    { table: 'anl_event_lake',          category: 'data_lake',        refresh_col: 'event_at' },
    { table: 'anl_fact_sessions',       category: 'fact',             refresh_col: 'refreshed_at' },
    { table: 'anl_fact_assessments',    category: 'fact',             refresh_col: 'refreshed_at' },
    { table: 'anl_fact_scores',         category: 'fact',             refresh_col: 'refreshed_at' },
    { table: 'anl_dim_users',           category: 'dimension',        refresh_col: 'refreshed_at' },
    { table: 'anl_dim_time',            category: 'dimension',        refresh_col: null },
    { table: 'anl_dim_domain',          category: 'dimension',        refresh_col: 'refreshed_at' },
    { table: 'anl_dim_cohort',          category: 'dimension',        refresh_col: 'refreshed_at' },
    { table: 'anl_kpi_daily',           category: 'kpi',              refresh_col: 'refreshed_at' },
    { table: 'anl_cohort_analysis',     category: 'cohort',           refresh_col: 'refreshed_at' },
    { table: 'anl_benchmark_snapshot',  category: 'benchmark',        refresh_col: 'refreshed_at' },
    { table: 'anl_predictive_features', category: 'predictive',       refresh_col: 'refreshed_at' },
  ];
  const ops: Array<{ table: string; category: string }> = [
    { table: 'capadex_sessions',         category: 'operational' },
    { table: 'wcl0_user_intelligence',   category: 'operational' },
    { table: 'cp_passport',              category: 'operational' },
    { table: 'cp_competencies',          category: 'operational' },
    { table: 'cp_readiness_scores',      category: 'operational' },
    { table: 'wc3_outcome_intelligence', category: 'operational' },
    { table: 'wc3_journey_intelligence', category: 'operational' },
  ];

  const results: TableStatus[] = [];
  for (const t of [...anl, ...ops]) {
    const col = (t as any).refresh_col;
    const { rows } = await pool.query(
      col
        ? `SELECT COUNT(*) n, MAX(${col})::text AS lr FROM ${t.table}`
        : `SELECT COUNT(*) n, NULL AS lr FROM ${t.table}`
    ).catch(() => ({ rows: [{ n: '0', lr: null }] }));
    results.push({ table: t.table, rows: Number(rows[0]?.n ?? 0), last_refreshed: rows[0]?.lr ?? null, category: t.category });
  }
  return results;
}
