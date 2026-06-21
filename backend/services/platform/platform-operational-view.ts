/**
 * Phase 6.10 — Platform Intelligence · operational view (READ-ONLY).
 *
 * Provides the genuinely-NEW measurements that the existing commercial engines
 * (engagement / retention / revenue) do NOT expose, and which Platform Intelligence needs for its
 * Platform Health, Growth, Conversion and Operational categories:
 *   • data_quality      (avg behavioral_reliability_index over capadex_runtime_contexts)
 *   • operational       (capadex_sessions total/completed/in_progress, capadex_responses volume,
 *                        capadex_session_telemetry rows, active express_sessions)
 *   • growth_trend      (signups in the last 30d vs the preceding 30d window — measurable only when
 *                        the prior window has a non-zero base; never a fabricated rate)
 *   • conversion_funnel (distinct assessment-session emails → distinct completed → distinct paid;
 *                        free→paid % measurable only when the session base is non-zero)
 *
 * GET-NEVER-WRITES: probes table existence with to_regclass, NEVER creates schema, and degrades to
 * honest empties when a table/column is absent or a read fails. We never fabricate: "no_substrate"
 * (table absent, surfaced via `substrate`) and an empty result over a present table (honest zero)
 * are DISTINCT states. Probe failures (vs genuine absence) flip `degraded`.
 */
import type { Pool } from 'pg';

async function tableExists(pool: Pool, name: string, onError?: () => void): Promise<boolean> {
  try {
    const { rows } = await pool.query(`SELECT to_regclass($1) AS oid`, [name]);
    return rows[0]?.oid != null;
  } catch {
    // Probe FAILED (not a genuine absence) — flag degraded so a fault is never
    // silently reported as "no substrate". Returns false but the caller knows.
    onError?.();
    return false;
  }
}

export interface DataQualityMetrics {
  measurable: boolean;
  runtime_contexts: number;
  avg_reliability_index: number | null; // 0..1 avg behavioral_reliability_index, null when no contexts
}
export interface OperationalMetrics {
  sessions_total: number;
  sessions_completed: number;
  sessions_in_progress: number;
  responses_total: number;
  telemetry_rows: number;
  active_sessions: number | null; // null when express_sessions absent (distinct from honest 0)
}
export interface GrowthTrend {
  measurable: boolean;
  new_users_30d: number;
  prev_30d: number; // signups in the window [60d, 30d)
  delta: number;
  growth_pct: number | null; // null when prior window base is 0 (no honest denominator)
}
export interface ConversionFunnel {
  session_emails: number; // distinct emails that started an assessment
  completed_emails: number; // distinct emails that completed an assessment
  paying_emails: number; // distinct emails with a paid capadex payment
  free_to_paid_pct: number | null; // paying / session_emails, null when no session base
}

export interface PlatformOperationalView {
  generated_at: string;
  degraded: boolean;
  substrate: {
    capadex_runtime_contexts: boolean;
    capadex_sessions: boolean;
    capadex_responses: boolean;
    capadex_session_telemetry: boolean;
    capadex_payments: boolean;
    users: boolean;
    express_sessions: boolean;
  };
  data_quality: DataQualityMetrics;
  operational: OperationalMetrics;
  growth_trend: GrowthTrend;
  conversion_funnel: ConversionFunnel;
  notes: string[];
}

/** Phase 6.10 operational/quality/growth/conversion reads. Read-only, never throws, never fabricates. */
export async function buildPlatformOperationalView(pool: Pool): Promise<PlatformOperationalView> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const substrate = {
    capadex_runtime_contexts: await tableExists(pool, 'capadex_runtime_contexts', fail),
    capadex_sessions: await tableExists(pool, 'capadex_sessions', fail),
    capadex_responses: await tableExists(pool, 'capadex_responses', fail),
    capadex_session_telemetry: await tableExists(pool, 'capadex_session_telemetry', fail),
    capadex_payments: await tableExists(pool, 'capadex_payments', fail),
    users: await tableExists(pool, 'users', fail),
    express_sessions: await tableExists(pool, 'express_sessions', fail),
  };

  const scalar = async (sql: string): Promise<number> => {
    const rows = await pool.query(sql).then((r) => r.rows).catch(() => { fail(); return [] as any[]; });
    return Number(rows[0]?.n ?? 0);
  };

  // ── Data quality (behavioral reliability index over runtime contexts) ───────────────────────────
  const data_quality: DataQualityMetrics = { measurable: false, runtime_contexts: 0, avg_reliability_index: null };
  if (substrate.capadex_runtime_contexts) {
    const rows = await pool
      .query(`SELECT COUNT(*) AS contexts, AVG(behavioral_reliability_index) AS avg_bri
                FROM capadex_runtime_contexts WHERE behavioral_reliability_index IS NOT NULL`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    data_quality.runtime_contexts = Number(rows[0]?.contexts ?? 0);
    if (data_quality.runtime_contexts > 0 && rows[0]?.avg_bri != null) {
      data_quality.measurable = true;
      data_quality.avg_reliability_index = Math.round(Number(rows[0].avg_bri) * 1000) / 1000;
    } else {
      notes.push('Data quality not measurable yet (no behavioral_reliability_index recorded in capadex_runtime_contexts).');
    }
  } else {
    notes.push('Data quality unavailable (capadex_runtime_contexts table absent).');
  }

  // ── Operational volume ──────────────────────────────────────────────────────────────────────────
  const operational: OperationalMetrics = {
    sessions_total: 0, sessions_completed: 0, sessions_in_progress: 0,
    responses_total: 0, telemetry_rows: 0, active_sessions: null,
  };
  if (substrate.capadex_sessions) {
    const rows = await pool
      .query(`SELECT COUNT(*) AS total,
                     COUNT(*) FILTER (WHERE status='completed')   AS completed,
                     COUNT(*) FILTER (WHERE status='in_progress') AS in_progress
                FROM capadex_sessions`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    operational.sessions_total = Number(rows[0]?.total ?? 0);
    operational.sessions_completed = Number(rows[0]?.completed ?? 0);
    operational.sessions_in_progress = Number(rows[0]?.in_progress ?? 0);
  }
  if (substrate.capadex_responses) operational.responses_total = await scalar(`SELECT COUNT(*) AS n FROM capadex_responses`);
  if (substrate.capadex_session_telemetry) operational.telemetry_rows = await scalar(`SELECT COUNT(*) AS n FROM capadex_session_telemetry`);
  if (substrate.express_sessions) {
    operational.active_sessions = await scalar(`SELECT COUNT(*) AS n FROM express_sessions WHERE expire > now()`);
  } else {
    notes.push('Active sessions unavailable (express_sessions table absent).');
  }

  // ── Growth trend (last-30d vs preceding-30d signups) ────────────────────────────────────────────
  const growth_trend: GrowthTrend = { measurable: false, new_users_30d: 0, prev_30d: 0, delta: 0, growth_pct: null };
  if (substrate.users) {
    const rows = await pool
      .query(`SELECT COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS cur,
                     COUNT(*) FILTER (WHERE created_at >= now() - interval '60 days'
                                        AND created_at <  now() - interval '30 days') AS prev
                FROM users`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    growth_trend.new_users_30d = Number(rows[0]?.cur ?? 0);
    growth_trend.prev_30d = Number(rows[0]?.prev ?? 0);
    growth_trend.delta = growth_trend.new_users_30d - growth_trend.prev_30d;
    if (growth_trend.prev_30d > 0) {
      growth_trend.measurable = true;
      growth_trend.growth_pct = Math.round((growth_trend.delta / growth_trend.prev_30d) * 1000) / 10;
    } else {
      notes.push('Growth rate not measurable yet (no signups in the preceding 30-day window to compare against).');
    }
  } else {
    notes.push('Growth trend unavailable (users table absent).');
  }

  // ── Conversion funnel (assessment started → completed → paid, distinct emails) ──────────────────
  const conversion_funnel: ConversionFunnel = { session_emails: 0, completed_emails: 0, paying_emails: 0, free_to_paid_pct: null };
  if (substrate.capadex_sessions) {
    const rows = await pool
      .query(`SELECT COUNT(DISTINCT lower(guest_email)) AS started,
                     COUNT(DISTINCT lower(guest_email)) FILTER (WHERE status='completed') AS completed
                FROM capadex_sessions WHERE guest_email IS NOT NULL AND guest_email <> ''`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    conversion_funnel.session_emails = Number(rows[0]?.started ?? 0);
    conversion_funnel.completed_emails = Number(rows[0]?.completed ?? 0);
  }
  if (substrate.capadex_payments) {
    conversion_funnel.paying_emails = await scalar(
      `SELECT COUNT(DISTINCT lower(email)) AS n FROM capadex_payments WHERE status='paid' AND email IS NOT NULL AND email <> ''`,
    );
  }
  if (conversion_funnel.session_emails > 0) {
    conversion_funnel.free_to_paid_pct = Math.round((conversion_funnel.paying_emails / conversion_funnel.session_emails) * 1000) / 10;
  } else {
    notes.push('Free→paid conversion not measurable yet (no assessment sessions with a captured email).');
  }

  return {
    generated_at: new Date().toISOString(),
    degraded,
    substrate,
    data_quality,
    operational,
    growth_trend,
    conversion_funnel,
    notes,
  };
}
