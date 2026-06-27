/**
 * MX-302G — Learning Intelligence ↔ Career Passport routes.
 *
 * Additive, read-only surfaces that sit alongside the existing Career Passport
 * (routes/career-passport.ts, FF_CAREER_PASSPORT). Everything here is gated by
 * `learningPassportLoop`:
 *   - `/api/passport/loop/enabled` — UNGATED flag probe (platform convention):
 *      200 {enabled:true} ON, 200 {enabled:false} OFF. Only DATA routes 503.
 *   - `/api/passport/learning-hub`   — composed Learning Hub (read-only).
 *   - `/api/passport/employer-matches` — talent-engine role alignment (honest).
 *   - `/api/passport/freshness`      — stale indicator (source activity vs sync).
 *   - `/api/passport/loop/refresh`   — POST: run the auto-sync now (parity w/ Sync).
 *
 * Every DATA route 503s BEFORE auth / DB / ensure-schema when the flag is OFF, so
 * the feature is byte-identical-OFF (no new tables, no behaviour). User scoping is
 * IDOR-safe (passport keyed on the authenticated users.id).
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isLearningPassportLoopEnabled } from '../config/feature-flags';
import { registerLearningPassportLoop, autoSyncPassportForUser } from '../services/learning-passport-loop';
import { composeLearningHub } from '../services/learning-hub-composer';
import { rankRolesForCandidateProfile } from '../services/talent-matching-engine';

function authUserId(req: any): string {
  return String(req.user?.id ?? req.user?.userId ?? '').trim();
}

/** Flag gate that runs BEFORE auth/DB so OFF is 503 (byte-identical: no auth,
 *  no DB, no ensure-schema reached when the flag is OFF). */
function loopGate(message: string) {
  return (_req: Request, res: Response, next: () => void) => {
    if (!isLearningPassportLoopEnabled()) {
      return res.status(503).json({ ok: false, message });
    }
    next();
  };
}

async function getPassportId(pool: Pool, userId: string): Promise<number | null> {
  try {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM cp_passport WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function registerLearningPassportRoutes(
  app: Express,
  pool: Pool,
  requireAuth: (req: Request, res: Response, next: () => void) => void,
): void {
  // Register the event-bus loop listener once (no-op at runtime when flag OFF).
  registerLearningPassportLoop(pool);

  // ── Ungated flag probe ─────────────────────────────────────────────────────
  app.get('/api/passport/loop/enabled', (_req, res) => {
    return res.json({ enabled: isLearningPassportLoopEnabled() });
  });

  // ── Learning Hub (composed, read-only) ─────────────────────────────────────
  app.get('/api/passport/learning-hub', loopGate('Learning Hub is not enabled'), requireAuth, async (req, res) => {
    try {
      const uid = authUserId(req);
      if (!uid) return res.status(401).json({ ok: false, message: 'Not authenticated' });
      const passportId = await getPassportId(pool, uid);
      if (passportId == null) {
        return res.json({ ok: true, available: false, message: 'No passport yet — create or sync your passport first.', hub: null });
      }
      const hub = await composeLearningHub(pool, uid, passportId);
      return res.json({ ok: true, available: true, hub });
    } catch (e: any) {
      return res.status(200).json({ ok: false, available: false, message: 'Learning Hub temporarily unavailable', error: String(e?.message ?? e) });
    }
  });

  // ── Employer Matches (talent-matching engine; honest, never an endorsement) ─
  app.get('/api/passport/employer-matches', loopGate('Employer Matches is not enabled'), requireAuth, async (req, res) => {
    try {
      const uid = authUserId(req);
      if (!uid) return res.status(401).json({ ok: false, message: 'Not authenticated' });
      const passportId = await getPassportId(pool, uid);
      if (passportId == null) {
        return res.json({ ok: true, available: false, message: 'No passport yet — create or sync your passport first.', matches: [] });
      }

      // Build an in-memory candidate from the passport owner's OWN data. Skills
      // (cp_competencies) drive conservative keyword-inferred evidence; measured
      // 0–5 competency levels are not stored on the passport, so evidence stays
      // honestly "inferred"/"none" rather than fabricating measured depth.
      const [{ rows: skillRows }, { rows: scoreRows }, { rows: pp }] = await Promise.all([
        pool.query<{ skill_name: string }>(
          `SELECT skill_name FROM cp_competencies WHERE passport_id = $1 LIMIT 200`, [passportId]),
        pool.query<{ score_type: string; score: string }>(
          `SELECT score_type, score FROM cp_readiness_scores WHERE passport_id = $1 ORDER BY computed_at DESC LIMIT 20`, [passportId]),
        pool.query<{ display_name: string; headline: string }>(
          `SELECT display_name, headline FROM cp_passport WHERE id = $1 LIMIT 1`, [passportId]),
      ]);
      const skills = skillRows.map((r) => r.skill_name).filter(Boolean);
      const eiRow = scoreRows.find((r) => r.score_type === 'lbi') ?? scoreRows.find((r) => r.score_type === 'fri');
      const eiScore = eiRow?.score != null ? Number(eiRow.score) : null;

      if (skills.length === 0) {
        return res.json({
          ok: true, available: true, measurable: false,
          message: 'No skills on the passport yet — add or sync skills to see role alignment.',
          candidate_name: pp[0]?.display_name ?? null, matches: [],
        });
      }

      const result = await rankRolesForCandidateProfile(
        pool,
        { id: uid, name: pp[0]?.display_name ?? null, candidate_role: pp[0]?.headline ?? null, skills, ei_score: eiScore },
        { limit: 10 },
      );
      if (!result.ok) {
        return res.json({ ok: true, available: true, measurable: false, message: result.error?.message ?? 'No role profiles available', matches: [] });
      }
      const roles = result.data.roles;
      return res.json({
        ok: true,
        available: true,
        measurable: roles.length > 0,
        candidate_name: result.data.candidate_name,
        disclaimer: 'Developmental alignment from your own evidence — not a hiring decision or employer endorsement. Match (breadth), Fit (depth), and Confidence are SEPARATE axes; skill-only evidence is keyword-inferred and keeps confidence honestly low.',
        matches: roles,
      });
    } catch (e: any) {
      return res.status(200).json({ ok: false, available: false, message: 'Employer Matches temporarily unavailable', error: String(e?.message ?? e), matches: [] });
    }
  });

  // ── Freshness / stale indicator ────────────────────────────────────────────
  app.get('/api/passport/freshness', loopGate('Freshness indicator is not enabled'), requireAuth, async (req, res) => {
    try {
      const uid = authUserId(req);
      if (!uid) return res.status(401).json({ ok: false, message: 'Not authenticated' });
      const passportId = await getPassportId(pool, uid);
      if (passportId == null) {
        return res.json({ ok: true, available: false, stale: false, message: 'No passport yet' });
      }

      // last reflected: most recent PLATFORM-sourced row recorded on the passport
      const reflected = await pool.query<{ ts: string }>(
        `SELECT MAX(ts) AS ts FROM (
           SELECT MAX(completed_at) AS ts FROM cp_learning_history WHERE passport_id = $1 AND source = 'platform'
           UNION ALL SELECT MAX(computed_at) FROM cp_readiness_scores WHERE passport_id = $1 AND platform_verified = true
           UNION ALL SELECT MAX(completed_at) FROM cp_assessments WHERE passport_id = $1 AND platform_verified = true
         ) t`,
        [passportId],
      ).catch(() => ({ rows: [{ ts: null }] as any[] }));
      const lastSynced: string | null = reflected.rows[0]?.ts ?? null;

      // latest source activity across the platform for this user
      const activity = await pool.query<{ ts: string }>(
        `SELECT MAX(ts) AS ts FROM (
           SELECT MAX(updated_at) AS ts FROM cpi_growth_plans WHERE user_id = $1 AND status = 'completed'
           UNION ALL SELECT MAX(updated_at) FROM career_seeker_goals WHERE user_id = $1 AND completed = true
           UNION ALL SELECT MAX(created_at) FROM p4_competency_history WHERE user_id = $1
         ) t`,
        [uid],
      ).catch(() => ({ rows: [{ ts: null }] as any[] }));
      const latestActivity: string | null = activity.rows[0]?.ts ?? null;

      // stale only when there is genuinely-newer source activity than the passport reflects
      let stale = false;
      if (latestActivity != null) {
        stale = lastSynced == null || new Date(latestActivity).getTime() > new Date(lastSynced).getTime() + 1000;
      }
      return res.json({
        ok: true,
        available: true,
        stale,
        last_synced_at: lastSynced,
        latest_activity_at: latestActivity,
        auto_sync: true, // the loop keeps this fresh automatically on completion
        message: stale ? 'New learning activity is not yet reflected — refresh to update.' : 'Passport reflects your latest learning activity.',
      });
    } catch (e: any) {
      return res.status(200).json({ ok: false, available: false, stale: false, error: String(e?.message ?? e) });
    }
  });

  // ── Force refresh (parity with manual Sync, via the loop path) ──────────────
  app.post('/api/passport/loop/refresh', loopGate('Auto-sync loop is not enabled'), requireAuth, async (req, res) => {
    try {
      const uid = authUserId(req);
      if (!uid) return res.status(401).json({ ok: false, message: 'Not authenticated' });
      const result = await autoSyncPassportForUser(pool, uid);
      if (!result) return res.status(200).json({ ok: false, message: 'Nothing to sync (no passport)' });
      return res.json({ ok: true, result });
    } catch (e: any) {
      return res.status(200).json({ ok: false, error: String(e?.message ?? e) });
    }
  });
}
