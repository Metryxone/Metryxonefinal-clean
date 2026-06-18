/**
 * S8: Longitudinal Memory Engine
 *
 * Builds a structured memory object from a user's historical CAPADEX sessions
 * and CSI trajectory — no new data collection required. Detects:
 *
 *   recurring_constructs  — subdomains / concerns appearing in ≥2 sessions < 50
 *   behavioural_drift     — CSI score slope (improving / stable / declining)
 *   burnout_periods       — 3+ consecutive low-score sessions (< 35)
 *   resilience_recoveries — score rebounds ≥ 15 points after a low
 *   growth_patterns       — sustained score improvement over ≥ 3 sessions
 *
 * Each pattern carries a `decay_after_days` field; staleness is flagged when
 * `now() - detected_at > decay_after_days`. Patterns never permanently label
 * users.
 *
 * Feature-flag: longitudinal_memory (see feature_flags table)
 */

import type { Pool } from 'pg';

// ─── Output types ──────────────────────────────────────────────────────────────

export interface RecurringConstruct {
  construct_key: string;
  frequency:     number;
  avg_score:     number;
  trend:         'improving' | 'stable' | 'declining';
  last_seen:     string;
  decay_after_days: number;
}

export interface BehaviouralDrift {
  direction:  'improving' | 'stable' | 'declining';
  slope:      number;
  confidence: 'high' | 'medium' | 'low';
  first_csi:  number;
  last_csi:   number;
}

export interface BurnoutPeriod {
  started_at:       string;
  ended_at:         string;
  avg_score:        number;
  concern_name:     string;
  decay_after_days: number;
}

export interface ResilienceRecovery {
  detected_at:      string;
  low_score:        number;
  high_score:       number;
  rebound_points:   number;
  concern_name:     string;
  decay_after_days: number;
}

export interface GrowthPattern {
  detected_at:      string;
  starting_score:   number;
  current_score:    number;
  improvement:      number;
  sessions_span:    number;
  concern_name:     string;
  decay_after_days: number;
}

export interface LongitudinalMemory {
  recurring_constructs:  RecurringConstruct[];
  behavioural_drift:     BehaviouralDrift | null;
  burnout_periods:       BurnoutPeriod[];
  resilience_recoveries: ResilienceRecovery[];
  growth_patterns:       GrowthPattern[];
  session_count:         number;
  first_seen:            string | null;
  last_seen:             string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function linearSlope(ys: number[]): number {
  if (ys.length < 2) return 0;
  const n  = ys.length;
  const xs = ys.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num   = xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0);
  const den   = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
}

function trendFromScores(scores: number[]): 'improving' | 'stable' | 'declining' {
  const slope = linearSlope(scores);
  if (slope > 2)  return 'improving';
  if (slope < -2) return 'declining';
  return 'stable';
}

// ─── Core builder ──────────────────────────────────────────────────────────────

export async function buildMemory(
  pool:      Pool,
  email:     string,
  sessionId?: string,
): Promise<LongitudinalMemory> {
  const emailLower = email.toLowerCase().trim();

  // ── 1. Load all completed sessions for this email ─────────────────────────
  const { rows: sessions } = await pool.query<{
    id:           string;
    stage_code:   string;
    score:        number;
    concern_name: string;
    created_at:   string;
  }>(
    `SELECT id, stage_code, score::numeric::float AS score, concern_name, created_at
     FROM capadex_sessions
     WHERE LOWER(guest_email) = $1 AND status = 'completed'
     ORDER BY created_at ASC`,
    [emailLower]
  );

  if (sessions.length === 0) {
    return {
      recurring_constructs:  [],
      behavioural_drift:     null,
      burnout_periods:       [],
      resilience_recoveries: [],
      growth_patterns:       [],
      session_count:         0,
      first_seen:            null,
      last_seen:             null,
    };
  }

  // ── 2. Load subdomain scores from stored reports ──────────────────────────
  const sessionIds = sessions.map(s => s.id);
  const { rows: reports } = await pool.query<{
    session_id: string;
    subdomains: Array<{ subdomain_name?: string; subdomain_code?: string; avg_score?: string }>;
  }>(
    `SELECT session_id::text, subdomains FROM capadex_reports
     WHERE session_id = ANY($1::uuid[]) AND subdomains IS NOT NULL`,
    [sessionIds]
  );

  const reportBySession: Record<string, Array<{ name: string; score: number }>> = {};
  for (const rep of reports) {
    const subs: Array<{ name: string; score: number }> = [];
    const rawSubs = Array.isArray(rep.subdomains) ? rep.subdomains : [];
    for (const sub of rawSubs) {
      const name  = (sub.subdomain_name || sub.subdomain_code || '').trim();
      const score = parseFloat(sub.avg_score ?? '0');
      if (name) subs.push({ name, score });
    }
    reportBySession[rep.session_id] = subs;
  }

  // ── 3. Load CSI trajectory ────────────────────────────────────────────────
  const { rows: csiRows } = await pool.query<{
    csi_score:  number;
    created_at: string;
  }>(
    `SELECT csi_score::numeric::float AS csi_score, created_at
     FROM csi_trajectory
     WHERE LOWER(user_email) = $1
     ORDER BY created_at ASC`,
    [emailLower]
  );

  // ── 4. Recurring constructs ───────────────────────────────────────────────
  // Collect per-construct appearances: subdomain scores OR concern scores when no report exists.
  const constructMap: Record<string, { scores: number[]; lastSeen: string }> = {};

  for (const sess of sessions) {
    const subdomains = reportBySession[sess.id] ?? [];
    if (subdomains.length > 0) {
      for (const sub of subdomains) {
        if (!constructMap[sub.name]) constructMap[sub.name] = { scores: [], lastSeen: sess.created_at };
        constructMap[sub.name].scores.push(sub.score);
        constructMap[sub.name].lastSeen = sess.created_at;
      }
    } else {
      // No subdomain report: use concern + stage as construct proxy
      const key = `${sess.concern_name}/${sess.stage_code}`;
      if (!constructMap[key]) constructMap[key] = { scores: [], lastSeen: sess.created_at };
      constructMap[key].scores.push(sess.score);
      constructMap[key].lastSeen = sess.created_at;
    }
  }

  const recurringConstructs: RecurringConstruct[] = [];
  for (const [key, { scores, lastSeen }] of Object.entries(constructMap)) {
    if (scores.length < 2) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Threshold: avg ≥ 50 = proficient enough that it does not constitute a recurring struggle.
    // Constructs scoring below 50 are flagged as recurring concerns per spec.
    if (avg >= 50) continue;
    recurringConstructs.push({
      construct_key:    key,
      frequency:        scores.length,
      avg_score:        Math.round(avg * 10) / 10,
      trend:            trendFromScores(scores),
      last_seen:        lastSeen,
      decay_after_days: 90,
    });
  }
  recurringConstructs.sort((a, b) => b.frequency - a.frequency || a.avg_score - b.avg_score);

  // ── 5. Behavioural drift (CSI slope) ─────────────────────────────────────
  let behaviouralDrift: BehaviouralDrift | null = null;
  if (csiRows.length >= 2) {
    const csiScores = csiRows.map(r => r.csi_score);
    const slope     = linearSlope(csiScores);
    const direction = slope > 2 ? 'improving' : slope < -2 ? 'declining' : 'stable';
    const confidence: 'high' | 'medium' | 'low' =
      csiRows.length >= 6 ? 'high' :
      csiRows.length >= 3 ? 'medium' : 'low';

    behaviouralDrift = {
      direction,
      slope,
      confidence,
      first_csi: csiScores[0],
      last_csi:  csiScores[csiScores.length - 1],
    };
  } else if (sessions.length >= 2) {
    // Fall back to raw session scores when CSI trajectory is sparse
    const scores    = sessions.map(s => s.score);
    const slope     = linearSlope(scores);
    const direction = slope > 2 ? 'improving' : slope < -2 ? 'declining' : 'stable';
    behaviouralDrift = {
      direction,
      slope,
      confidence: 'low',
      first_csi:  scores[0],
      last_csi:   scores[scores.length - 1],
    };
  }

  // ── 6–8. Per-concern temporal pattern detection ───────────────────────────
  // Burnout, recovery, and growth are only meaningful within the same concern —
  // mixing unrelated concerns (e.g. "Screen Addiction" vs "Exam Anxiety") would
  // produce invalid cross-concern conclusions.
  // Group sessions by concern_name, then scan each group independently.

  const BURNOUT_THRESHOLD   = 35;
  const BURNOUT_MIN_STREAK  = 3;
  const RECOVERY_THRESHOLD   = 50;
  const RECOVERY_MIN_REBOUND = 15;
  const GROWTH_MIN_SESSIONS  = 3;
  const GROWTH_MIN_DELTA     = 5;

  const sessionsByConcern = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.concern_name || 'unknown';
    if (!sessionsByConcern.has(key)) sessionsByConcern.set(key, []);
    sessionsByConcern.get(key)!.push(s);
  }

  const burnoutPeriods:       BurnoutPeriod[]       = [];
  const resilienceRecoveries: ResilienceRecovery[]   = [];
  const growthPatterns:       GrowthPattern[]        = [];

  for (const [concernName, concernSessions] of sessionsByConcern) {
    // ── 6. Burnout periods (within concern) ────────────────────────────────
    let burnoutStart: number | null = null;
    for (let i = 0; i < concernSessions.length; i++) {
      const s = concernSessions[i];
      if (s.score < BURNOUT_THRESHOLD) {
        if (burnoutStart === null) burnoutStart = i;
      } else {
        if (burnoutStart !== null) {
          const streak = i - burnoutStart;
          if (streak >= BURNOUT_MIN_STREAK) {
            const period = concernSessions.slice(burnoutStart, i);
            const avgScore = period.reduce((a, b) => a + b.score, 0) / period.length;
            burnoutPeriods.push({
              started_at:       period[0].created_at,
              ended_at:         period[period.length - 1].created_at,
              avg_score:        Math.round(avgScore * 10) / 10,
              concern_name:     concernName,
              decay_after_days: 180,
            });
          }
          burnoutStart = null;
        }
      }
    }
    if (burnoutStart !== null && concernSessions.length - burnoutStart >= BURNOUT_MIN_STREAK) {
      const period = concernSessions.slice(burnoutStart);
      const avgScore = period.reduce((a, b) => a + b.score, 0) / period.length;
      burnoutPeriods.push({
        started_at:       period[0].created_at,
        ended_at:         period[period.length - 1].created_at,
        avg_score:        Math.round(avgScore * 10) / 10,
        concern_name:     concernName,
        decay_after_days: 180,
      });
    }

    // ── 7. Resilience recoveries (within concern) ──────────────────────────
    for (let i = 1; i < concernSessions.length; i++) {
      const prev = concernSessions[i - 1];
      const curr = concernSessions[i];
      if (prev.score < RECOVERY_THRESHOLD) {
        const rebound = curr.score - prev.score;
        if (rebound >= RECOVERY_MIN_REBOUND) {
          resilienceRecoveries.push({
            detected_at:      curr.created_at,
            low_score:        prev.score,
            high_score:       curr.score,
            rebound_points:   rebound,
            concern_name:     concernName,
            decay_after_days: 365,
          });
        }
      }
    }

    // ── 8. Growth patterns (within concern) ────────────────────────────────
    let growthStart: number | null = null;
    for (let i = 1; i < concernSessions.length; i++) {
      const prev = concernSessions[i - 1];
      const curr = concernSessions[i];
      if (curr.score - prev.score >= GROWTH_MIN_DELTA) {
        if (growthStart === null) growthStart = i - 1;
      } else {
        if (growthStart !== null) {
          const span = i - growthStart;
          if (span >= GROWTH_MIN_SESSIONS - 1) {
            const from = concernSessions[growthStart];
            const to   = concernSessions[i - 1];
            growthPatterns.push({
              detected_at:    to.created_at,
              starting_score: from.score,
              current_score:  to.score,
              improvement:    to.score - from.score,
              sessions_span:  span + 1,
              concern_name:   concernName,
              decay_after_days: 365,
            });
          }
          growthStart = null;
        }
      }
    }
    if (growthStart !== null) {
      const span = concernSessions.length - 1 - growthStart;
      if (span >= GROWTH_MIN_SESSIONS - 1) {
        const from = concernSessions[growthStart];
        const to   = concernSessions[concernSessions.length - 1];
        growthPatterns.push({
          detected_at:    to.created_at,
          starting_score: from.score,
          current_score:  to.score,
          improvement:    to.score - from.score,
          sessions_span:  span + 1,
          concern_name:   concernName,
          decay_after_days: 365,
        });
      }
    }
  }

  return {
    recurring_constructs:  recurringConstructs,
    behavioural_drift:     behaviouralDrift,
    burnout_periods:       burnoutPeriods,
    resilience_recoveries: resilienceRecoveries,
    growth_patterns:       growthPatterns,
    session_count:         sessions.length,
    first_seen:            sessions[0].created_at,
    last_seen:             sessions[sessions.length - 1].created_at,
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────────

/**
 * Builds the memory object for `email`, upserts `longitudinal_patterns`,
 * and appends newly detected events to `longitudinal_pattern_events`.
 * Safe to call multiple times — always upserts.
 */
export async function buildAndPersistMemory(
  pool:      Pool,
  email:     string,
  sessionId?: string,
): Promise<LongitudinalMemory> {
  const emailLower = email.toLowerCase().trim();
  const memory     = await buildMemory(pool, email, sessionId);

  // Upsert summary row
  await pool.query(
    `INSERT INTO longitudinal_patterns (user_email, memory, session_count, first_seen, last_seen, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_email) DO UPDATE SET
       memory        = EXCLUDED.memory,
       session_count = EXCLUDED.session_count,
       first_seen    = COALESCE(longitudinal_patterns.first_seen, EXCLUDED.first_seen),
       last_seen     = EXCLUDED.last_seen,
       updated_at    = NOW()`,
    [
      emailLower,
      JSON.stringify(memory),
      memory.session_count,
      memory.first_seen,
      memory.last_seen,
    ]
  );

  // Replace-strategy: delete all current non-stale events for this user then
  // re-insert the freshly computed set. This prevents event inflation on every
  // rebuild while preserving already-stale historical events for audit purposes.
  await pool.query(
    `DELETE FROM longitudinal_pattern_events
     WHERE user_email = $1 AND is_stale = FALSE`,
    [emailLower]
  ).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[longitudinal-memory] event delete warning: ${msg}`);
  });

  // Build the current event snapshot (≤ 50 entries)
  const eventsToInsert: Array<{
    event_type:       string;
    construct_key:    string | null;
    severity:         string;
    description:      string;
    decay_after_days: number;
  }> = [];

  for (const rc of memory.recurring_constructs) {
    eventsToInsert.push({
      event_type:       'recurring_construct',
      construct_key:    rc.construct_key,
      severity:         rc.avg_score < 30 ? 'high' : rc.avg_score < 45 ? 'medium' : 'low',
      description:      `'${rc.construct_key}' appeared in ${rc.frequency} sessions (avg ${rc.avg_score}) — trend: ${rc.trend}`,
      decay_after_days: rc.decay_after_days,
    });
  }

  if (memory.behavioural_drift) {
    const d = memory.behavioural_drift;
    eventsToInsert.push({
      event_type:       'behavioural_drift',
      construct_key:    null,
      severity:         d.direction === 'declining' ? 'medium' : 'low',
      description:      `CSI drift: ${d.direction} (slope ${d.slope > 0 ? '+' : ''}${d.slope}/session, confidence: ${d.confidence}). First: ${Math.round(d.first_csi)}, Last: ${Math.round(d.last_csi)}`,
      decay_after_days: 90,
    });
  }

  for (const bp of memory.burnout_periods) {
    eventsToInsert.push({
      event_type:       'burnout_period',
      construct_key:    bp.concern_name,
      severity:         bp.avg_score < 20 ? 'critical' : bp.avg_score < 28 ? 'high' : 'medium',
      description:      `Burnout period for '${bp.concern_name}' — avg ${bp.avg_score} from ${bp.started_at.slice(0, 10)} to ${bp.ended_at.slice(0, 10)}`,
      decay_after_days: bp.decay_after_days,
    });
  }

  for (const rr of memory.resilience_recoveries) {
    eventsToInsert.push({
      event_type:       'resilience_recovery',
      construct_key:    rr.concern_name,
      severity:         'low',
      description:      `Recovery for '${rr.concern_name}': +${rr.rebound_points} pts (${rr.low_score} → ${rr.high_score})`,
      decay_after_days: rr.decay_after_days,
    });
  }

  for (const gp of memory.growth_patterns) {
    eventsToInsert.push({
      event_type:       'growth_pattern',
      construct_key:    gp.concern_name,
      severity:         'low',
      description:      `Growth for '${gp.concern_name}': +${gp.improvement} pts over ${gp.sessions_span} sessions (${gp.starting_score} → ${gp.current_score})`,
      decay_after_days: gp.decay_after_days,
    });
  }

  // Insert fresh snapshot (up to 50 rows)
  for (const ev of eventsToInsert.slice(0, 50)) {
    await pool.query(
      `INSERT INTO longitudinal_pattern_events
         (user_email, event_type, construct_key, severity, description, decay_after_days)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [emailLower, ev.event_type, ev.construct_key, ev.severity, ev.description, ev.decay_after_days]
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[longitudinal-memory] event insert warning: ${msg}`);
    });
  }

  // Mark stale events (applies to historical entries preserved by the replace-strategy)
  await pool.query(
    `UPDATE longitudinal_pattern_events
     SET is_stale = TRUE
     WHERE user_email = $1
       AND is_stale = FALSE
       AND detected_at + (decay_after_days || ' days')::interval < NOW()`,
    [emailLower]
  ).catch(() => { /* non-fatal */ });

  return memory;
}
