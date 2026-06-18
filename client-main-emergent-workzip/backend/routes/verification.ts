/**
 * Verification Routes — Phase 3
 *
 * User-facing:
 *   GET    /api/verification/providers           — list available providers (status, weight)
 *   GET    /api/verification/my                  — list current user's verifications
 *   POST   /api/verification/consent             — grant consent (explicit + logged)
 *   POST   /api/verification/consent/revoke      — revoke a consent
 *   POST   /api/verification/begin               — start a verification flow
 *   POST   /api/verification/complete            — submit external_id / OAuth code
 *   POST   /api/verification/:id/revoke          — revoke a verified credential
 *   GET    /api/verification/trust               — current trust breakdown
 *
 * Admin-only:
 *   GET    /api/admin/verification/events        — full audit log (paginated)
 *   POST   /api/admin/verification/:id/override  — manual admin verification
 *
 * Consent is REQUIRED before any provider call. Every action writes a
 * verification_events row.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { getProviderAdapter, listProviderCodes } from '../services/verification-providers';
import { loadUserVerifications, computeTrust, upsertTrustCache } from '../services/trust-engine';
import { resolveProfile } from '../services/ei-resolver';
import { computeOfficialEI } from '../services/ei-engine';

type GuardMW = (req: Request, res: Response, next: NextFunction) => void;

function clientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function userIdFromReq(req: Request): string | null {
  // SECURITY: user identity is taken EXCLUSIVELY from the authenticated session
  // (req.user, populated by requireAuth). We intentionally do not accept
  // X-User-Id headers or body.user_id — those would allow an attacker to
  // impersonate any user_id once they were authenticated themselves.
  const u = (req as any).user;
  if (u?.id) return String(u.id);
  if (u?.user_id) return String(u.user_id);
  return null;
}

async function logEvent(pool: Pool, args: {
  userId: string | null; verifId?: string | null; providerCode?: string | null;
  eventType: string; actorType?: string; actorId?: string | null;
  ip?: string; ua?: string; payload?: Record<string, unknown>;
  outcome?: string; errorCode?: string;
}) {
  try {
    await pool.query(
      `INSERT INTO verification_events
        (user_id, verification_id, provider_code, event_type, actor_type, actor_id,
         ip_address, user_agent, payload, outcome, error_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [args.userId, args.verifId || null, args.providerCode || null, args.eventType,
       args.actorType || 'user', args.actorId || args.userId || null,
       args.ip || null, args.ua || null, JSON.stringify(args.payload || {}),
       args.outcome || null, args.errorCode || null],
    );
  } catch (e) {
    console.warn('[verification] event log failed', (e as Error).message);
  }
}

async function ensureConsent(pool: Pool, userId: string, providerCode: string, scope: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM verification_consents
      WHERE user_id=$1 AND provider_code=$2 AND scope=$3
        AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [userId, providerCode, scope],
  );
  return Boolean(r.rowCount);
}

export function registerVerificationRoutes(
  app: Express,
  pool: Pool,
  requireAuth?: GuardMW,
  requireSuperAdmin?: GuardMW,
) {
  const authChain = [requireAuth].filter(Boolean) as GuardMW[];
  const adminChain = [requireAuth, requireSuperAdmin].filter(Boolean) as GuardMW[];

  // ── Public list of providers (drives UI) ──────────────────
  app.get('/api/verification/providers', async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, provider_code, provider_name, provider_category, integration_type,
                authority_country, authority_url, default_trust_weight, status, notes, config
           FROM verification_providers
          ORDER BY status DESC, provider_name ASC`,
      );
      res.json({ ok: true, providers: r.rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Current user's verifications ──────────────────────────
  app.get('/api/verification/my', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    try {
      const rows = await loadUserVerifications(pool, userId);
      res.json({ ok: true, verifications: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Consent grant ─────────────────────────────────────────
  app.post('/api/verification/consent', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });

    const { provider_code, scope, consent_text, consent_version, expires_at } = req.body || {};
    if (!provider_code || !scope || !consent_text) {
      await logEvent(pool, { userId, providerCode: provider_code || null, eventType: 'consent_grant',
        ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { reason: 'missing_required_fields' }, outcome: 'error', errorCode: 'bad_request' });
      return res.status(400).json({ ok: false, error: 'provider_code, scope, consent_text required' });
    }

    try {
      const p = await pool.query(`SELECT id FROM verification_providers WHERE provider_code=$1`, [provider_code]);
      if (!p.rowCount) {
        await logEvent(pool, { userId, providerCode: provider_code, eventType: 'consent_grant',
          ip: clientIp(req), ua: req.header('user-agent') || undefined,
          payload: { scope }, outcome: 'error', errorCode: 'unknown_provider' });
        return res.status(404).json({ ok: false, error: 'unknown provider' });
      }

      const r = await pool.query(
        `INSERT INTO verification_consents
          (user_id, provider_id, provider_code, scope, consent_text, consent_version,
           ip_address, user_agent, expires_at)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,'v1'),$7,$8,$9)
         RETURNING id, granted_at,
           (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) AS active`,
        [userId, p.rows[0].id, provider_code, scope, consent_text, consent_version || null,
         clientIp(req), req.header('user-agent') || null, expires_at || null],
      );
      await logEvent(pool, {
        userId, providerCode: provider_code, eventType: 'consent_grant',
        actorType: 'user', ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { scope, consent_version: consent_version || 'v1' }, outcome: 'success',
      });
      res.json({ ok: true, consent: r.rows[0] });
    } catch (e: any) {
      await logEvent(pool, { userId, providerCode: provider_code, eventType: 'consent_grant',
        ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { scope }, outcome: 'error', errorCode: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Consent revoke ────────────────────────────────────────
  app.post('/api/verification/consent/revoke', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { provider_code, scope, reason } = req.body || {};
    if (!provider_code || !scope) {
      await logEvent(pool, { userId, providerCode: provider_code || null, eventType: 'consent_revoke',
        ip: clientIp(req), payload: { reason: 'missing_required_fields' }, outcome: 'error', errorCode: 'bad_request' });
      return res.status(400).json({ ok: false, error: 'provider_code, scope required' });
    }
    try {
      const r = await pool.query(
        `UPDATE verification_consents
            SET revoked_at = NOW(), revoked_reason = $4
          WHERE user_id=$1 AND provider_code=$2 AND scope=$3 AND revoked_at IS NULL
          RETURNING id`,
        [userId, provider_code, scope, reason || null],
      );
      await logEvent(pool, {
        userId, providerCode: provider_code, eventType: 'consent_revoke',
        actorType: 'user', ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { scope, reason: reason || null }, outcome: r.rowCount ? 'success' : 'noop',
      });
      res.json({ ok: true, revoked_count: r.rowCount });
    } catch (e: any) {
      await logEvent(pool, { userId, providerCode: provider_code, eventType: 'consent_revoke',
        ip: clientIp(req), payload: { scope }, outcome: 'error', errorCode: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Begin verification ────────────────────────────────────
  app.post('/api/verification/begin', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });

    const { provider_code, subject_type, subject_id, subject_canonical, raw_input, redirect_uri, scope } = req.body || {};
    if (!provider_code || !subject_type) {
      await logEvent(pool, { userId, providerCode: provider_code || null, eventType: 'request',
        ip: clientIp(req), payload: { reason: 'missing_required_fields' }, outcome: 'error', errorCode: 'bad_request' });
      return res.status(400).json({ ok: false, error: 'provider_code, subject_type required' });
    }

    const adapter = getProviderAdapter(provider_code);
    if (!adapter) {
      await logEvent(pool, { userId, providerCode: provider_code, eventType: 'request',
        ip: clientIp(req), payload: { subject_type }, outcome: 'error', errorCode: 'unknown_provider' });
      return res.status(404).json({ ok: false, error: 'unknown provider' });
    }

    // Consent required for any non-MANUAL provider.
    if (provider_code !== 'MANUAL') {
      const consentScope = scope || 'read_credentials';
      const hasConsent = await ensureConsent(pool, userId, provider_code, consentScope);
      if (!hasConsent) {
        await logEvent(pool, {
          userId, providerCode: provider_code, eventType: 'request',
          ip: clientIp(req), ua: req.header('user-agent') || undefined,
          payload: { reason: 'consent_missing', scope: consentScope }, outcome: 'error', errorCode: 'consent_required',
        });
        return res.status(412).json({ ok: false, error: 'consent_required', scope: consentScope });
      }
    }

    try {
      const out = await adapter.begin({
        user_id: userId, subject_type, subject_id, subject_canonical,
        raw_input, redirect_uri,
      });
      await logEvent(pool, {
        userId, providerCode: provider_code, eventType: 'request',
        ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { subject_type, subject_id, raw_input, result_status: out.status },
        outcome: out.status === 'redirect' || out.status === 'pending' ? 'success' : 'noop',
      });
      res.json({ ok: true, ...out });
    } catch (e: any) {
      await logEvent(pool, {
        userId, providerCode: provider_code, eventType: 'request',
        outcome: 'error', errorCode: e.message,
      });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Complete verification ─────────────────────────────────
  app.post('/api/verification/complete', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });

    const { provider_code, subject_type, subject_id, subject_canonical, raw_input,
            callback_payload, external_id, evidence } = req.body || {};
    if (!provider_code || !subject_type) {
      await logEvent(pool, { userId, providerCode: provider_code || null, eventType: 'callback',
        ip: clientIp(req), payload: { reason: 'missing_required_fields' }, outcome: 'error', errorCode: 'bad_request' });
      return res.status(400).json({ ok: false, error: 'provider_code, subject_type required' });
    }

    const adapter = getProviderAdapter(provider_code);
    if (!adapter) {
      await logEvent(pool, { userId, providerCode: provider_code, eventType: 'callback',
        ip: clientIp(req), payload: { subject_type }, outcome: 'error', errorCode: 'unknown_provider' });
      return res.status(404).json({ ok: false, error: 'unknown provider' });
    }

    // Consent gate (same logic as /begin) — MANUAL is admin-driven and exempt.
    if (provider_code !== 'MANUAL') {
      const consentScope = (req.body || {}).scope || 'read_credentials';
      const hasConsent = await ensureConsent(pool, userId, provider_code, consentScope);
      if (!hasConsent) {
        await logEvent(pool, {
          userId, providerCode: provider_code, eventType: 'callback',
          ip: clientIp(req), ua: req.header('user-agent') || undefined,
          payload: { reason: 'consent_missing', scope: consentScope }, outcome: 'error', errorCode: 'consent_required',
        });
        return res.status(412).json({ ok: false, error: 'consent_required', scope: consentScope });
      }
    }

    try {
      const out = await adapter.complete({ user_id: userId, callback_payload, external_id, evidence });

      const p = await pool.query(`SELECT id FROM verification_providers WHERE provider_code=$1`, [provider_code]);
      if (!p.rowCount) {
        await logEvent(pool, { userId, providerCode: provider_code, eventType: 'callback',
          ip: clientIp(req), payload: { subject_type }, outcome: 'error', errorCode: 'provider_not_registered' });
        return res.status(404).json({ ok: false, error: 'provider not registered' });
      }

      const ins = await pool.query(
        `INSERT INTO credential_verifications
          (user_id, provider_id, provider_code, subject_type, subject_id, subject_canonical,
           raw_input, external_id, external_url, evidence, status, confidence_score, trust_weight,
           verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
           CASE WHEN $11='verified' THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id, provider_code, subject_type, COALESCE(external_id,''))
         DO UPDATE SET
           evidence = EXCLUDED.evidence,
           status   = EXCLUDED.status,
           confidence_score = EXCLUDED.confidence_score,
           trust_weight    = EXCLUDED.trust_weight,
           verified_at     = CASE WHEN EXCLUDED.status='verified' THEN NOW() ELSE credential_verifications.verified_at END,
           updated_at      = NOW()
         RETURNING id, status`,
        [userId, p.rows[0].id, provider_code, subject_type, subject_id || null, subject_canonical || null,
         raw_input || null, out.external_id, out.external_url, JSON.stringify(out.evidence || {}),
         out.status, out.confidence_score, out.trust_weight],
      );

      const verifId = ins.rows[0].id;
      await logEvent(pool, {
        userId, verifId, providerCode: provider_code,
        eventType: out.status === 'verified' ? 'verified' : (out.status === 'failed' ? 'failed' : 'callback'),
        actorType: 'system', ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { subject_type, subject_id, external_id: out.external_id, message: out.message || null },
        outcome: out.status === 'verified' || out.status === 'pending' ? 'success' : 'error',
      });

      res.json({ ok: true, verification_id: verifId, ...out });
    } catch (e: any) {
      await logEvent(pool, { userId, providerCode: provider_code, eventType: 'callback',
        ip: clientIp(req), payload: { subject_type, subject_id }, outcome: 'error', errorCode: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Revoke a verified credential ──────────────────────────
  app.post('/api/verification/:id/revoke', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { reason } = req.body || {};
    try {
      const r = await pool.query(
        `UPDATE credential_verifications
            SET status='revoked', revoked_at=NOW(), revoked_reason=$3, updated_at=NOW()
          WHERE id=$1 AND user_id=$2
          RETURNING id, provider_code`,
        [req.params.id, userId, reason || null],
      );
      if (!r.rowCount) {
        await logEvent(pool, { userId, verifId: req.params.id, eventType: 'revoked',
          actorType: 'user', ip: clientIp(req), payload: { reason: reason || null },
          outcome: 'error', errorCode: 'not_found' });
        return res.status(404).json({ ok: false, error: 'not found' });
      }
      await logEvent(pool, {
        userId, verifId: r.rows[0].id, providerCode: r.rows[0].provider_code,
        eventType: 'revoked', actorType: 'user', ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { reason: reason || null }, outcome: 'success',
      });
      res.json({ ok: true });
    } catch (e: any) {
      await logEvent(pool, { userId, verifId: req.params.id, eventType: 'revoked',
        actorType: 'user', ip: clientIp(req), outcome: 'error', errorCode: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Current trust breakdown (uses cache when fresh) ───────
  app.get('/api/verification/trust', ...authChain, async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    try {
      const cached = await pool.query(`SELECT * FROM trust_score_components WHERE user_id=$1`, [userId]);
      if (cached.rowCount) return res.json({ ok: true, trust: cached.rows[0] });
      res.json({ ok: true, trust: null });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Admin: audit log ──────────────────────────────────────
  app.get('/api/admin/verification/events', ...adminChain, async (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));
    try {
      const r = await pool.query(
        `SELECT * FROM verification_events ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      res.json({ ok: true, events: r.rows, limit, offset });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Admin: override (manual verification) ─────────────────
  app.post('/api/admin/verification/override', ...adminChain, async (req, res) => {
    const { user_id, subject_type, subject_id, subject_canonical, external_id, evidence, status } = req.body || {};
    if (!user_id || !subject_type) return res.status(400).json({ ok: false, error: 'user_id, subject_type required' });

    const actor = (req as any).user?.email || (req as any).user?.id || 'admin';
    const adapter = getProviderAdapter('MANUAL')!;
    const out = await adapter.complete({ user_id, external_id, evidence, admin_actor: actor });
    if (status === 'verified') out.status = 'verified';

    try {
      const p = await pool.query(`SELECT id FROM verification_providers WHERE provider_code='MANUAL'`);
      const ins = await pool.query(
        `INSERT INTO credential_verifications
          (user_id, provider_id, provider_code, subject_type, subject_id, subject_canonical,
           external_id, evidence, status, confidence_score, trust_weight, verified_at)
         VALUES ($1,$2,'MANUAL',$3,$4,$5,$6,$7,$8,$9,$10,
           CASE WHEN $8='verified' THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id, provider_code, subject_type, COALESCE(external_id,''))
         DO UPDATE SET status=EXCLUDED.status, evidence=EXCLUDED.evidence, updated_at=NOW(),
           verified_at=CASE WHEN EXCLUDED.status='verified' THEN NOW() ELSE credential_verifications.verified_at END
         RETURNING id`,
        [user_id, p.rows[0].id, subject_type, subject_id || null, subject_canonical || null,
         out.external_id, JSON.stringify(out.evidence || {}), out.status, out.confidence_score, out.trust_weight],
      );
      await logEvent(pool, {
        userId: user_id, verifId: ins.rows[0].id, providerCode: 'MANUAL',
        eventType: 'admin_override', actorType: 'admin', actorId: actor,
        ip: clientIp(req), ua: req.header('user-agent') || undefined,
        payload: { subject_type, subject_id, external_id: out.external_id }, outcome: 'success',
      });
      res.json({ ok: true, verification_id: ins.rows[0].id, ...out });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  console.log(`[verification] routes registered — ${listProviderCodes().length} adapters`);
}

/**
 * Helper exported for /api/ei/resolve to compute trust inline when a user_id
 * is supplied. Returns null when no user context.
 */
export async function computeAndCacheTrust(
  pool: Pool,
  userId: string,
  resolution: Awaited<ReturnType<typeof resolveProfile>>,
  capabilityEI: ReturnType<typeof computeOfficialEI>,
) {
  const verifications = await loadUserVerifications(pool, userId);
  const trust = computeTrust({ capabilityEI, resolution, verifications });
  await upsertTrustCache(pool, userId, trust);
  return trust;
}
