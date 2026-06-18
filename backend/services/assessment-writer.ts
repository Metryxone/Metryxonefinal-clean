/**
 * Assessment Writer — single chokepoint that turns a Competency Assessment
 * completion into durable snapshots across the Phase 1-5 data layer.
 *
 * Writes:
 *  - user_assessment_snapshots (header)
 *  - p4_competency_history     (append-only, one row per competency)
 *  - user_competency_scores    (latest-value upsert)
 *  - bench_audit_logs          (non-blocking)
 *  - m5_audit_logs             (non-blocking, only if org_id supplied)
 */
import type { Pool } from 'pg';
import { recordCompetencyHistory } from './longitudinal-engine';

export const ASSESSMENT_WRITER_VERSION = '1.0.0';

export interface SnapshotInput {
  userId: string;
  orgId?: string | null;
  roleId?: string | null;
  scores: Record<string, number>;          // { competency_id: 0-100 }
  reliability?: number;                    // 0..1, default 0.78
  source?: 'assessment' | 'self_rated' | 'imported' | 'mentor' | 'backfill';
  takenAt?: Date;
  sessionId?: string;
  assessmentVersion?: string;
}

export interface SnapshotResult {
  snapshot_id: string;
  user_id: string;
  org_id: string | null;
  role_id: string | null;
  n_competencies: number;
  composite_score: number;
  reliability: number;
  taken_at: string;
  history_rows: number;
  upserted_scores: number;
  source: string;
  version: string;
}

/** Pure: simple unweighted mean composite. Used when no role weights resolve. */
export function composeScoreVector(scores: Record<string, number>): {
  composite: number; n: number;
} {
  const vals = Object.values(scores).filter(v => Number.isFinite(v));
  const n = vals.length;
  const composite = n > 0 ? vals.reduce((a, b) => a + b, 0) / n : 0;
  return { composite: Math.round(composite * 100) / 100, n };
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createAssessmentWriter(pool: Pool) {
  async function writeSnapshot(input: SnapshotInput): Promise<SnapshotResult> {
    const userId = input.userId;
    if (!userId) throw new Error('userId is required');
    const scores = input.scores ?? {};
    const compIds = Object.keys(scores).filter(k => Number.isFinite(scores[k]));
    if (compIds.length === 0) throw new Error('scores must contain at least one numeric value');

    const reliability = Math.max(0, Math.min(1, input.reliability ?? 0.78));
    const source = input.source ?? 'assessment';
    const takenAt = input.takenAt ?? new Date();
    const assessmentVersion = input.assessmentVersion ?? '1.0.0';

    const { composite, n } = composeScoreVector(scores);
    const snapshotId = uid('snap');

    // 1. Header
    await pool.query(
      `INSERT INTO user_assessment_snapshots
         (id, user_id, org_id, role_id, assessment_version, source, taken_at,
          composite_score, n_competencies, reliability, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [snapshotId, userId, input.orgId ?? null, input.roleId ?? null,
       assessmentVersion, source, takenAt, composite, n, reliability,
       JSON.stringify({ session_id: input.sessionId ?? null, writer_version: ASSESSMENT_WRITER_VERSION })]
    );

    // 2. Append-only history (one row per competency)
    let historyRows = 0;
    for (const competencyId of compIds) {
      try {
        await recordCompetencyHistory(pool, {
          user_id: userId,
          session_id: input.sessionId ?? snapshotId,
          competency_id: competencyId,
          score: Number(scores[competencyId]),
          source,
        });
        // stamp snapshot_id on the just-inserted row (best effort)
        await pool.query(
          `UPDATE p4_competency_history
              SET snapshot_id = $1
            WHERE user_id = $2 AND competency_id = $3 AND snapshot_id IS NULL
              AND captured_at > (NOW() - INTERVAL '1 minute')`,
          [snapshotId, userId, competencyId]
        ).catch(() => {});
        historyRows++;
      } catch { /* non-blocking */ }
    }

    // 3. Latest-value upsert
    let upserts = 0;
    for (const competencyId of compIds) {
      try {
        await pool.query(
          `INSERT INTO user_competency_scores
             (user_id, competency_id, score, reliability, source, snapshot_id, assessed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (user_id, competency_id)
           DO UPDATE SET score = EXCLUDED.score,
                         reliability = EXCLUDED.reliability,
                         source = EXCLUDED.source,
                         snapshot_id = EXCLUDED.snapshot_id,
                         assessed_at = EXCLUDED.assessed_at`,
          [userId, competencyId, Number(scores[competencyId]), reliability,
           source, snapshotId, takenAt]
        );
        upserts++;
      } catch { /* non-blocking */ }
    }

    // 4. Audit log entries (non-blocking)
    pool.query(
      `INSERT INTO bench_audit_logs (id, event_type, user_id, payload, recorded_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [uid('benchlog'), 'assessment_snapshot', userId,
       JSON.stringify({ snapshot_id: snapshotId, n_competencies: n, composite, source })]
    ).catch(() => {});

    if (input.orgId) {
      pool.query(
        `INSERT INTO m5_audit_logs (id, domain, action, actor, org_id, subject_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uid('m5a'), 'assessment_writer', 'snapshot_written', userId,
         input.orgId, snapshotId,
         JSON.stringify({ n_competencies: n, composite, source, writer_version: ASSESSMENT_WRITER_VERSION })]
      ).catch(() => {});
    }

    return {
      snapshot_id: snapshotId,
      user_id: userId,
      org_id: input.orgId ?? null,
      role_id: input.roleId ?? null,
      n_competencies: n,
      composite_score: composite,
      reliability,
      taken_at: takenAt.toISOString(),
      history_rows: historyRows,
      upserted_scores: upserts,
      source,
      version: ASSESSMENT_WRITER_VERSION,
    };
  }

  async function realUserScores(userId: string): Promise<Record<string, number> | null> {
    if (!userId) return null;
    try {
      const r = await pool.query(
        `SELECT competency_id, score
           FROM user_competency_scores
          WHERE user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) return null;
      const out: Record<string, number> = {};
      for (const row of r.rows) out[row.competency_id] = Number(row.score);
      return out;
    } catch { return null; }
  }

  async function latestSnapshot(userId: string) {
    try {
      const r = await pool.query(
        `SELECT * FROM user_assessment_snapshots
          WHERE user_id = $1
          ORDER BY taken_at DESC
          LIMIT 1`,
        [userId]
      );
      return r.rows[0] ?? null;
    } catch { return null; }
  }

  async function snapshotHistory(userId: string, limit = 50) {
    try {
      const r = await pool.query(
        `SELECT id, user_id, org_id, role_id, source, taken_at,
                composite_score, n_competencies, reliability
           FROM user_assessment_snapshots
          WHERE user_id = $1
          ORDER BY taken_at DESC
          LIMIT $2`,
        [userId, limit]
      );
      return r.rows;
    } catch { return []; }
  }

  return { writeSnapshot, realUserScores, latestSnapshot, snapshotHistory };
}
