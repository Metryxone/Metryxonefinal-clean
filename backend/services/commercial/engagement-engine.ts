/**
 * Phase 6.8 — Customer Success Intelligence · engagement engine (READ-ONLY).
 *
 * COMPOSES (never recomputes) existing product substrate into the adoption / engagement /
 * assessment-completion / product-usage signals that Customer Success tracks:
 *   • Adoption    (users: total, new-30d, new-7d, by account_type)
 *   • Engagement  (express_sessions active, ei_events active-users 30d/7d + by event_type)
 *   • Completion  (capadex_sessions completed %, onto_competency_profiles scored, exam_attempts)
 *   • EI usage    (ei_profile_snapshots)
 *   • Career usage(career_seeker_profiles + avg completeness)
 *   • Employer    (employer_candidates / employer_jobs / eios_campaigns)
 *
 * GET-NEVER-WRITES: probes table existence with to_regclass, never creates schema, and degrades to
 * honest empties when a table/column is absent or a read fails. We never fabricate: "no_substrate"
 * (table absent, surfaced via `substrate`) and an empty result over a present table (honest zero)
 * are DISTINCT states.
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

export interface AdoptionMetrics {
  total_users: number;
  new_users_30d: number;
  new_users_7d: number;
  by_account_type: { account_type: string; users: number }[];
}
export interface EngagementMetrics {
  active_sessions: number | null; // null when express_sessions absent (distinct from honest 0)
  active_users_30d: number;
  active_users_7d: number;
  events_30d: number;
  by_event_type: { event_type: string; events: number }[];
}
export interface CompletionMetrics {
  capadex_total: number;
  capadex_completed: number;
  capadex_completion_pct: number;
  competency_scored_subjects: number;
  exam_attempts: number;
}
export interface ProductUsageMetrics {
  ei_snapshots: number;
  ei_subjects: number;
  career_profiles: number;
  career_avg_completeness: number | null;
  employer_candidates: number;
  employer_jobs: number;
  eios_campaigns: number;
}

export interface EngagementAnalytics {
  generated_at: string;
  degraded: boolean;
  substrate: {
    users: boolean;
    express_sessions: boolean;
    ei_events: boolean;
    capadex_sessions: boolean;
    onto_competency_profiles: boolean;
    exam_attempts: boolean;
    ei_profile_snapshots: boolean;
    career_seeker_profiles: boolean;
    employer_candidates: boolean;
    employer_jobs: boolean;
    eios_campaigns: boolean;
  };
  adoption: AdoptionMetrics;
  engagement: EngagementMetrics;
  completion: CompletionMetrics;
  product_usage: ProductUsageMetrics;
  notes: string[];
}

/** Phase 6.8 engagement analytics. Read-only, never throws, never fabricates. */
export async function buildEngagementAnalytics(pool: Pool): Promise<EngagementAnalytics> {
  let degraded = false;
  const fail = () => { degraded = true; };
  const notes: string[] = [];

  const substrate = {
    users: await tableExists(pool, 'users', fail),
    express_sessions: await tableExists(pool, 'express_sessions', fail),
    ei_events: await tableExists(pool, 'ei_events', fail),
    capadex_sessions: await tableExists(pool, 'capadex_sessions', fail),
    onto_competency_profiles: await tableExists(pool, 'onto_competency_profiles', fail),
    exam_attempts: await tableExists(pool, 'exam_attempts', fail),
    ei_profile_snapshots: await tableExists(pool, 'ei_profile_snapshots', fail),
    career_seeker_profiles: await tableExists(pool, 'career_seeker_profiles', fail),
    employer_candidates: await tableExists(pool, 'employer_candidates', fail),
    employer_jobs: await tableExists(pool, 'employer_jobs', fail),
    eios_campaigns: await tableExists(pool, 'eios_campaigns', fail),
  };

  const scalar = async (sql: string): Promise<number> => {
    const rows = await pool.query(sql).then((r) => r.rows).catch(() => { fail(); return [] as any[]; });
    return Number(rows[0]?.n ?? 0);
  };

  // ── Adoption ────────────────────────────────────────────────────────────────────────────────────
  const adoption: AdoptionMetrics = { total_users: 0, new_users_30d: 0, new_users_7d: 0, by_account_type: [] };
  if (substrate.users) {
    const rows = await pool
      .query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new30,
                COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')  AS new7
           FROM users`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    adoption.total_users = Number(rows[0]?.total ?? 0);
    adoption.new_users_30d = Number(rows[0]?.new30 ?? 0);
    adoption.new_users_7d = Number(rows[0]?.new7 ?? 0);

    const atRows = await pool
      .query(`SELECT COALESCE(account_type,'unknown') AS account_type, COUNT(*) AS users FROM users GROUP BY 1 ORDER BY users DESC`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    adoption.by_account_type = atRows.map((r) => ({ account_type: String(r.account_type), users: Number(r.users ?? 0) }));
  }

  // ── Engagement (sessions + ei_events) ─────────────────────────────────────────────────────────────
  const engagement: EngagementMetrics = {
    active_sessions: null,
    active_users_30d: 0,
    active_users_7d: 0,
    events_30d: 0,
    by_event_type: [],
  };
  if (substrate.express_sessions) {
    engagement.active_sessions = await scalar(`SELECT COUNT(*) AS n FROM express_sessions WHERE expire > now()`);
  } else {
    notes.push('Active sessions unavailable (express_sessions table absent).');
  }
  if (substrate.ei_events) {
    const rows = await pool
      .query(
        `SELECT COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days') AS au30,
                COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '7 days')  AS au7,
                COUNT(*)               FILTER (WHERE created_at >= now() - interval '30 days')  AS ev30
           FROM ei_events`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    engagement.active_users_30d = Number(rows[0]?.au30 ?? 0);
    engagement.active_users_7d = Number(rows[0]?.au7 ?? 0);
    engagement.events_30d = Number(rows[0]?.ev30 ?? 0);

    const byType = await pool
      .query(
        `SELECT event_type, COUNT(*) AS events FROM ei_events
          WHERE created_at >= now() - interval '30 days'
          GROUP BY event_type ORDER BY events DESC LIMIT 10`,
      )
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    engagement.by_event_type = byType.map((r) => ({ event_type: String(r.event_type ?? 'unknown'), events: Number(r.events ?? 0) }));
  }

  // ── Assessment completion ─────────────────────────────────────────────────────────────────────────
  const completion: CompletionMetrics = {
    capadex_total: 0, capadex_completed: 0, capadex_completion_pct: 0,
    competency_scored_subjects: 0, exam_attempts: 0,
  };
  if (substrate.capadex_sessions) {
    const rows = await pool
      .query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='completed') AS completed FROM capadex_sessions`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    completion.capadex_total = Number(rows[0]?.total ?? 0);
    completion.capadex_completed = Number(rows[0]?.completed ?? 0);
    completion.capadex_completion_pct = completion.capadex_total > 0
      ? Math.round((completion.capadex_completed / completion.capadex_total) * 1000) / 10
      : 0;
  }
  if (substrate.onto_competency_profiles) {
    completion.competency_scored_subjects = await scalar(`SELECT COUNT(DISTINCT subject_id) AS n FROM onto_competency_profiles`);
  }
  if (substrate.exam_attempts) {
    completion.exam_attempts = await scalar(`SELECT COUNT(*) AS n FROM exam_attempts`);
  }

  // ── Product usage (EI / Career / Employer) ───────────────────────────────────────────────────────
  const product_usage: ProductUsageMetrics = {
    ei_snapshots: 0, ei_subjects: 0, career_profiles: 0, career_avg_completeness: null,
    employer_candidates: 0, employer_jobs: 0, eios_campaigns: 0,
  };
  if (substrate.ei_profile_snapshots) {
    const rows = await pool
      .query(`SELECT COUNT(*) AS snaps, COUNT(DISTINCT subject_id) AS subjects FROM ei_profile_snapshots`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    product_usage.ei_snapshots = Number(rows[0]?.snaps ?? 0);
    product_usage.ei_subjects = Number(rows[0]?.subjects ?? 0);
  }
  if (substrate.career_seeker_profiles) {
    const rows = await pool
      .query(`SELECT COUNT(*) AS n, AVG(completeness) AS avg_c FROM career_seeker_profiles`)
      .then((r) => r.rows)
      .catch(() => { fail(); return [] as any[]; });
    product_usage.career_profiles = Number(rows[0]?.n ?? 0);
    product_usage.career_avg_completeness = rows[0]?.avg_c != null ? Math.round(Number(rows[0].avg_c) * 10) / 10 : null;
  }
  if (substrate.employer_candidates) product_usage.employer_candidates = await scalar(`SELECT COUNT(*) AS n FROM employer_candidates`);
  if (substrate.employer_jobs) product_usage.employer_jobs = await scalar(`SELECT COUNT(*) AS n FROM employer_jobs`);
  if (substrate.eios_campaigns) product_usage.eios_campaigns = await scalar(`SELECT COUNT(*) AS n FROM eios_campaigns`);

  if (!substrate.users) notes.push('No users substrate present — adoption metrics are zeroed.');

  return {
    generated_at: new Date().toISOString(),
    degraded,
    substrate,
    adoption,
    engagement,
    completion,
    product_usage,
    notes,
  };
}
