/**
 * EI Demo Intelligence Seed — P-R6
 *
 * POST /api/admin/ei/seed-demo-intelligence   (requireSuperAdmin)
 *
 * Seeds realistic demo data for all 7 EI intelligence layers so the
 * EIIntelligencePanel shows populated content instead of empty states.
 *
 * What is seeded (all idempotent — safe to re-run):
 *   1. capadex_sessions       — 4 completed sessions over 4 months (WCL2 forecast)
 *   2. capadex_session_patterns — 4 patterns per session, trend = burnout↓ growth↑
 *   3. ei_snapshot_versions   — 8 monthly snapshots for target user (trajectory)
 *   4. ei_snapshot_versions   — 35 cohort rows (fake user IDs, for comparative k≥30)
 *   5. career_seeker_profiles — minimal profile for cohort key resolution
 *
 * Body params:
 *   target_user_id  — defaults to the calling admin's own user ID
 *   target_email    — defaults to admin's email/username
 *   wipe_first      — if true, removes prior demo data for this user (re-seeds fresh)
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';

export const EI_DEMO_SEED_VERSION = '1.0.0';

const DEMO_CONCERN = 'Career Transition Stress';
const DEMO_PERSONA = 'professional';
const DEMO_STAGE   = 'EXPLORING';

// Four CAPADEX sessions, 4→1 months ago.
const SESSION_OFFSETS_DAYS = [120, 90, 60, 30];

// Pattern trajectory: burnout drops, growth rises (shows clear positive trend).
const PATTERN_PROGRESSION: Array<{
  key: string; label: string;
  confidence: number[]; // one per session (oldest→newest)
}> = [
  { key: 'burnout_cluster',            label: 'Burnout Indicators',    confidence: [0.74, 0.61, 0.46, 0.31] },
  { key: 'stress_cluster',             label: 'Stress Load',           confidence: [0.68, 0.55, 0.40, 0.28] },
  { key: 'growth_cluster',             label: 'Growth Orientation',    confidence: [0.22, 0.38, 0.54, 0.70] },
  { key: 'resilience_cluster',         label: 'Resilience Signals',    confidence: [0.18, 0.33, 0.50, 0.66] },
  { key: 'stress_regulation_cluster',  label: 'Stress Regulation',     confidence: [0.21, 0.36, 0.52, 0.68] },
  { key: 'self_regulation_cluster',    label: 'Self-Regulation',       confidence: [0.19, 0.34, 0.51, 0.67] },
];

// EI score trajectory: 8 months of steady improvement.
const EI_TRAJECTORY: Array<{ monthsAgo: number; score: number; band: string }> = [
  { monthsAgo: 8, score: 53, band: 'developing'   },
  { monthsAgo: 7, score: 56, band: 'developing'   },
  { monthsAgo: 6, score: 59, band: 'developing'   },
  { monthsAgo: 5, score: 62, band: 'capable'      },
  { monthsAgo: 4, score: 65, band: 'capable'      },
  { monthsAgo: 3, score: 68, band: 'capable'      },
  { monthsAgo: 2, score: 72, band: 'strong'       },
  { monthsAgo: 1, score: 76, band: 'strong'       },
];

// Cohort pool: 35 fake users spread across bands for realistic comparative data.
function buildCohortRows(excludeUserId: string): Array<{ userId: string; score: number; band: string }> {
  const dist = [
    // developing (30%)
    ...Array.from({ length: 11 }, (_, i) => ({ userId: `demo-cohort-dev-${String(i + 1).padStart(3, '0')}`, score: 38 + i * 2, band: 'developing' })),
    // capable (40%)
    ...Array.from({ length: 14 }, (_, i) => ({ userId: `demo-cohort-cap-${String(i + 1).padStart(3, '0')}`, score: 60 + i * 2, band: 'capable' })),
    // strong (20%)
    ...Array.from({ length: 7 },  (_, i) => ({ userId: `demo-cohort-str-${String(i + 1).padStart(3, '0')}`, score: 73 + i * 2, band: 'strong' })),
    // exceptional (10%)
    ...Array.from({ length: 3 },  (_, i) => ({ userId: `demo-cohort-exc-${String(i + 1).padStart(3, '0')}`, score: 85 + i * 3, band: 'exceptional' })),
  ];
  return dist.filter(r => r.userId !== excludeUserId);
}

function monthsAgoDate(n: number): string {
  const d = new Date();
  d.setDate(1); // stable day to avoid month overflow
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString();
}

interface RegisterDeps {
  app:               Express;
  pool:              Pool;
  requireAuth:       RequestHandler;
  requireSuperAdmin: RequestHandler;
}

export function registerEIDemoSeedRoute({ app, pool, requireAuth, requireSuperAdmin }: RegisterDeps) {

  // ── POST /api/admin/ei/seed-demo-intelligence ─────────────────────────────
  app.post(
    '/api/admin/ei/seed-demo-intelligence',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const authUser = (req as any).user;
        const targetUserId: string =
          String((req.body as any)?.target_user_id ?? authUser?.id ?? authUser?.userId ?? '').trim();
        const wipeFirst: boolean = (req.body as any)?.wipe_first === true;

        if (!targetUserId) {
          return res.status(400).json({ ok: false, error: 'No target_user_id — could not determine calling user.' });
        }

        // ── Resolve email ─────────────────────────────────────────────────────
        let targetEmail: string = String((req.body as any)?.target_email ?? '').trim().toLowerCase();
        if (!targetEmail) {
          const { rows: ur } = await pool.query(
            `SELECT COALESCE(NULLIF(TRIM(email),''), CASE WHEN username LIKE '%@%' THEN username ELSE NULL END) AS email
               FROM users WHERE id = $1 LIMIT 1`,
            [targetUserId],
          );
          targetEmail = ur[0]?.email
            ? String(ur[0].email).toLowerCase()
            : `demo-${targetUserId.slice(0, 8)}@metryx-demo.internal`;

          // If no real email on the user, write a demo one so WCL2 resolves it.
          if (!ur[0]?.email) {
            await pool.query(
              `UPDATE users SET email = $1 WHERE id = $2 AND (email IS NULL OR TRIM(email) = '')`,
              [targetEmail, targetUserId],
            ).catch(() => null);
          }
        }

        // ── Optional wipe ─────────────────────────────────────────────────────
        if (wipeFirst) {
          await pool.query(
            `DELETE FROM capadex_session_patterns
              WHERE session_id IN (
                SELECT id FROM capadex_sessions WHERE LOWER(guest_email) = $1
              )`,
            [targetEmail],
          ).catch(() => null);
          await pool.query(
            `DELETE FROM capadex_sessions WHERE LOWER(guest_email) = $1`,
            [targetEmail],
          ).catch(() => null);
          await pool.query(
            `DELETE FROM ei_snapshot_versions WHERE user_id = $1`,
            [targetUserId],
          ).catch(() => null);
          // Wipe demo cohort rows (identifiable by the demo-cohort prefix in user_id)
          await pool.query(
            `DELETE FROM ei_snapshot_versions WHERE user_id LIKE 'demo-cohort-%'`,
          ).catch(() => null);
        }

        const seeded: Record<string, number> = {
          capadex_sessions:         0,
          capadex_session_patterns: 0,
          ei_snapshots_user:        0,
          ei_snapshots_cohort:      0,
          career_seeker_profile:    0,
        };

        // ── 1. CAPADEX sessions ──────────────────────────────────────────────
        // Each session gets a stable deterministic UUID based on user+offset.
        const sessionIds: string[] = [];
        for (let i = 0; i < SESSION_OFFSETS_DAYS.length; i++) {
          const created = daysAgoISO(SESSION_OFFSETS_DAYS[i]);
          // Use a predictable UUID so re-runs are idempotent
          const stableId = await pool.query(
            `SELECT md5(($1 || '-sess-' || $2)::text)::uuid AS uid`,
            [targetUserId, i],
          ).then(r => r.rows[0].uid as string).catch(() => crypto.randomUUID?.() ?? `00000000-0000-0000-0000-${String(i).padStart(12,'0')}`);

          sessionIds.push(stableId);

          const r = await pool.query(
            `INSERT INTO capadex_sessions
               (id, guest_email, guest_name, concern_name, user_age, age_band,
                stage_code, stage_index, status, persona,
                score, omega_x_payload, created_at, updated_at)
             VALUES
               ($1, $2, 'Demo User', $3, 25, 'young_adult',
                $4, 1, 'completed', $5,
                $6, '{}', $7, $7)
             ON CONFLICT (id) DO NOTHING`,
            [stableId, targetEmail, DEMO_CONCERN, DEMO_STAGE, DEMO_PERSONA,
             60 + i * 5, created],
          ).catch(() => ({ rowCount: 0 }));
          seeded.capadex_sessions += (r as any).rowCount ?? 0;
        }

        // ── 2. CAPADEX session patterns ──────────────────────────────────────
        for (let si = 0; si < sessionIds.length; si++) {
          const sessId = sessionIds[si];
          for (const pat of PATTERN_PROGRESSION) {
            const conf = pat.confidence[si] ?? pat.confidence[pat.confidence.length - 1];
            const patId = await pool.query(
              `SELECT md5(($1 || '-pat-' || $2)::text)::uuid AS uid`,
              [sessId, pat.key],
            ).then(r => r.rows[0].uid as string).catch(() => undefined);

            if (!patId) continue;

            const r = await pool.query(
              `INSERT INTO capadex_session_patterns
                 (id, session_id, pattern_key, label, confidence,
                  signal_refs, composite_refs, evidence_refs,
                  created_at, updated_at)
               VALUES
                 ($1, $2, $3, $4, $5,
                  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                  NOW(), NOW())
               ON CONFLICT (id) DO NOTHING`,
              [patId, sessId, pat.key, pat.label, conf],
            ).catch(() => ({ rowCount: 0 }));
            seeded.capadex_session_patterns += (r as any).rowCount ?? 0;
          }
        }

        // ── 3. EI snapshots for target user ──────────────────────────────────
        for (const snap of EI_TRAJECTORY) {
          const snapDate = monthsAgoDate(snap.monthsAgo);
          const breakdown = JSON.stringify({
            dimensions: { adaptability: snap.score - 5, growth_potential: snap.score + 3, market_relevance: snap.score - 2, competency_depth: snap.score - 1, engagement_signal: snap.score + 1 },
            _demo: true,
          });
          const r = await pool.query(
            `INSERT INTO ei_snapshot_versions
               (user_id, snapshot_date, capability_score, trusted_score,
                band, breakdown, ei_version, ruleset_version, source, computation_ms)
             VALUES
               ($1, $2, $3, $4,
                $5, $6::jsonb, '4.0', 'demo-v1', 'demo_seed', 0)
             ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
               capability_score = EXCLUDED.capability_score,
               trusted_score    = EXCLUDED.trusted_score,
               band             = EXCLUDED.band,
               breakdown        = EXCLUDED.breakdown,
               source           = 'demo_seed'`,
            [targetUserId, snapDate, snap.score, snap.score - 1, snap.band, breakdown],
          ).catch(() => ({ rowCount: 0 }));
          seeded.ei_snapshots_user += (r as any).rowCount ?? 0;
        }

        // ── 4. Cohort EI snapshots (for comparative / peer / percentile) ─────
        const cohort = buildCohortRows(targetUserId);
        for (const c of cohort) {
          const snapDate = monthsAgoDate(1);
          const breakdown = JSON.stringify({ dimensions: { adaptability: c.score - 3, growth_potential: c.score + 2 }, _demo: true });
          const r = await pool.query(
            `INSERT INTO ei_snapshot_versions
               (user_id, snapshot_date, capability_score, trusted_score,
                band, breakdown, ei_version, ruleset_version, source, computation_ms)
             VALUES
               ($1, $2, $3, $4,
                $5, $6::jsonb, '4.0', 'demo-v1', 'demo_seed', 0)
             ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
               capability_score = EXCLUDED.capability_score,
               band             = EXCLUDED.band,
               source           = 'demo_seed'`,
            [c.userId, snapDate, c.score, c.score - 1, c.band, breakdown],
          ).catch(() => ({ rowCount: 0 }));
          seeded.ei_snapshots_cohort += (r as any).rowCount ?? 0;
        }

        // ── 5. Career seeker profile (for cohort key resolution) ─────────────
        const profileData = JSON.stringify({
          seniority_level: 'mid',
          domain:          'technology',
          role_family:     'engineering',
          target_domain:   'technology',
          _demo:           true,
        });
        const pr = await pool.query(
          `INSERT INTO career_seeker_profiles (user_id, data)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data`,
          [targetUserId, profileData],
        ).catch(() => ({ rowCount: 0 }));
        seeded.career_seeker_profile += (pr as any).rowCount ?? 0;

        res.json({
          ok:           true,
          version:      EI_DEMO_SEED_VERSION,
          target_user_id: targetUserId,
          target_email,
          seeded,
          note:         'Re-run with { wipe_first: true } to replace existing demo data.',
          generated_at: new Date().toISOString(),
        });

      } catch (e: any) {
        res.status(500).json({ ok: false, error: e.message });
      }
    },
  );

  // ── GET /api/admin/ei/demo-seed-status ────────────────────────────────────
  app.get('/api/admin/ei/demo-seed-status', requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      const authUser = (req as any).user;
      const userId = String(authUser?.id ?? authUser?.userId ?? '').trim();
      try {
        const [snapshotCount, sessionCount, cohortCount] = await Promise.all([
          pool.query(`SELECT COUNT(*) FROM ei_snapshot_versions WHERE user_id = $1`, [userId])
            .then(r => Number(r.rows[0].count)),
          pool.query(
            `SELECT COUNT(*) FROM capadex_sessions cs
              JOIN users u ON LOWER(u.email) = LOWER(cs.guest_email) OR LOWER(u.username) = LOWER(cs.guest_email)
             WHERE u.id = $1 AND cs.status = 'completed'`, [userId])
            .then(r => Number(r.rows[0].count)).catch(() => 0),
          pool.query(`SELECT COUNT(*) FROM ei_snapshot_versions WHERE user_id LIKE 'demo-cohort-%'`)
            .then(r => Number(r.rows[0].count)),
        ]);
        res.json({
          ok: true,
          user_id: userId,
          ei_snapshots:   snapshotCount,
          capadex_sessions: sessionCount,
          cohort_rows:    cohortCount,
          seeded:         snapshotCount >= 2,
        });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e.message });
      }
    });
}
