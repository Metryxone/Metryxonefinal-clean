import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import crypto from 'crypto';
import { ensureCareerPassportSchema, computePassportCompleteness } from '../services/career-passport-schema';
import { syncPassportFromPlatform } from '../services/career-passport-bridge';

// ── Feature flag ───────────────────────────────────────────────────────────
const FLAG = 'FF_CAREER_PASSPORT';
function isEnabled(): boolean {
  const v = (process.env[FLAG] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

// ── Section config — whitelists allowed fields per section ─────────────────
const SECTION_CONFIG: Record<string, {
  table: string; required: string[]; allowed: string[]; orderBy: string;
}> = {
  competencies: {
    table: 'cp_competencies',
    required: ['skill_name'],
    allowed: ['skill_name','category','proficiency_level','proficiency_score','is_visible','evidence_url','source','source_ref'],
    orderBy: 'skill_name ASC',
  },
  assessments: {
    table: 'cp_assessments',
    required: ['assessment_type','title'],
    allowed: ['assessment_type','provider','title','score','band','percentile','raw_ref','completed_at','is_visible'],
    orderBy: 'completed_at DESC NULLS LAST',
  },
  projects: {
    table: 'cp_projects',
    required: ['title'],
    allowed: ['title','description','outcomes','skills_used','role','org','url','start_date','end_date','is_current','is_highlighted','is_visible','sort_order'],
    orderBy: 'is_current DESC, end_date DESC NULLS FIRST',
  },
  achievements: {
    table: 'cp_achievements',
    required: ['title'],
    allowed: ['category','title','issuer','issued_at','description','evidence_url','is_visible'],
    orderBy: 'issued_at DESC NULLS LAST',
  },
  certifications: {
    table: 'cp_certifications',
    required: ['title','issuer'],
    allowed: ['title','issuer','credential_id','issued_at','expires_at','credential_url','skills_covered','is_visible'],
    orderBy: 'issued_at DESC NULLS LAST',
  },
  experience: {
    table: 'cp_experience',
    required: ['org','role','start_date'],
    allowed: ['org','role','employment_type','start_date','end_date','is_current','description','skills_used','achievements','is_visible','sort_order'],
    orderBy: 'is_current DESC, start_date DESC NULLS LAST',
  },
  learning: {
    table: 'cp_learning_history',
    required: ['title'],
    allowed: ['activity_type','title','provider','completed_at','hours','skills','certificate_url','is_visible','source','source_ref'],
    orderBy: 'completed_at DESC NULLS LAST',
  },
  goals: {
    table: 'cp_career_goals',
    required: ['title'],
    allowed: ['goal_type','title','description','target_date','status','milestones','is_visible'],
    orderBy: 'status ASC, target_date ASC NULLS LAST',
  },
  scores: {
    table: 'cp_readiness_scores',
    required: ['score_type','score','computed_at'],
    allowed: ['score_type','score','band','confidence','computed_at','source_system','source_ref','is_visible'],
    orderBy: 'computed_at DESC',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
async function ensurePassport(userId: string, pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO cp_passport (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [userId],
  );
  return rows[0].id as number;
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function userId(req: any): string {
  return String(req.user?.id ?? req.user?.userId ?? '');
}

// Array fields that need to be passed as JSON strings from body and parsed
const ARRAY_FIELDS = new Set(['skills_used','achievements','skills','skills_covered']);

function coerceBody(body: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    if (ARRAY_FIELDS.has(key)) {
      if (Array.isArray(body[key])) { out[key] = body[key]; continue; }
      if (typeof body[key] === 'string') {
        try { out[key] = JSON.parse(body[key] as string); } catch { out[key] = (body[key] as string).split(',').map(s => s.trim()); }
        continue;
      }
    }
    if (key === 'milestones' && typeof body[key] === 'string') {
      try { out[key] = JSON.parse(body[key] as string); } catch { out[key] = []; }
      continue;
    }
    out[key] = body[key];
  }
  return out;
}

export function registerCareerPassportRoutes(
  app: Express,
  pool: Pool,
  requireAuth: (req: Request, res: Response, next: any) => void,
  requireSuperAdmin: (req: Request, res: Response, next: any) => void,
): void {
  // Lazy schema init
  let schemaReady = false;
  const ensureSchema = async () => {
    if (schemaReady) return;
    await ensureCareerPassportSchema(pool);
    schemaReady = true;
  };

  const FLAG_GUARD = (_req: Request, res: Response, next: any) => {
    if (!isEnabled()) return res.status(503).json({ __flagOff: true, error: 'Career Passport not enabled' });
    next();
  };

  // ── User Routes ──────────────────────────────────────────────────────────

  /** GET /api/passport/overview */
  app.get('/api/passport/overview', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const { rows: meta } = await pool.query(
        `SELECT * FROM cp_passport WHERE id = $1`, [passportId],
      );
      const { completeness, strength, section_counts } = await computePassportCompleteness(passportId, pool);
      // Update scores in DB
      await pool.query(
        `UPDATE cp_passport SET completeness_score=$1, strength_score=$2, updated_at=NOW() WHERE id=$3`,
        [completeness, strength, passportId],
      ).catch(() => null);
      return res.json({
        ok: true,
        passport: { ...meta[0], completeness_score: completeness, strength_score: strength },
        section_counts,
      });
    } catch (e: any) { return res.status(500).json({ error: 'Failed to load passport' }); }
  });

  /** GET /api/passport/items/:section */
  app.get('/api/passport/items/:section', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const section = req.params.section as string;
    const config = SECTION_CONFIG[section];
    if (!config) return res.status(400).json({ error: 'Invalid section' });
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const { rows } = await pool.query(
        `SELECT * FROM ${config.table} WHERE passport_id=$1 ORDER BY ${config.orderBy}`,
        [passportId],
      );
      return res.json({ items: rows, total: rows.length });
    } catch { return res.status(500).json({ error: 'Failed to load items' }); }
  });

  /** POST /api/passport/items/:section */
  app.post('/api/passport/items/:section', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const section = req.params.section as string;
    const config = SECTION_CONFIG[section];
    if (!config) return res.status(400).json({ error: 'Invalid section' });

    const body = coerceBody(req.body ?? {}, config.allowed);
    for (const req_field of config.required) {
      if (!body[req_field]) return res.status(400).json({ error: `${req_field} is required` });
    }

    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const fields = Object.keys(body);
      const values: unknown[] = [passportId];
      const cols = ['passport_id', ...fields].join(',');
      for (const f of fields) {
        if (ARRAY_FIELDS.has(f)) values.push(Array.isArray(body[f]) ? body[f] : [body[f]]);
        else if (f === 'milestones') values.push(JSON.stringify(body[f] ?? []));
        else values.push(body[f]);
      }
      const params = values.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(
        `INSERT INTO ${config.table} (${cols}) VALUES (${params}) RETURNING *`,
        values,
      );
      return res.status(201).json({ ok: true, item: rows[0] });
    } catch (e: any) { return res.status(500).json({ error: 'Failed to create item' }); }
  });

  /** PATCH /api/passport/items/:section/:id */
  app.patch('/api/passport/items/:section/:id', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const section = req.params.section as string;
    const itemId = Number(req.params.id);
    if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid id' });
    const config = SECTION_CONFIG[section];
    if (!config) return res.status(400).json({ error: 'Invalid section' });

    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      // Ownership check
      const { rows: own } = await pool.query(
        `SELECT id FROM ${config.table} WHERE id=$1 AND passport_id=$2`, [itemId, passportId],
      );
      if (!own.length) return res.status(404).json({ error: 'Not found' });

      const body = coerceBody(req.body ?? {}, config.allowed);
      const updates: string[] = []; const values: unknown[] = [];
      for (const [k, v] of Object.entries(body)) {
        values.push(ARRAY_FIELDS.has(k) ? (Array.isArray(v) ? v : [v]) : v);
        updates.push(`${k}=$${values.length}`);
      }
      if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
      values.push(itemId);
      const { rows } = await pool.query(
        `UPDATE ${config.table} SET ${updates.join(',')} WHERE id=$${values.length} RETURNING *`,
        values,
      );
      return res.json({ ok: true, item: rows[0] });
    } catch { return res.status(500).json({ error: 'Failed to update item' }); }
  });

  /** DELETE /api/passport/items/:section/:id */
  app.delete('/api/passport/items/:section/:id', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const section = req.params.section as string;
    const itemId = Number(req.params.id);
    if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid id' });
    const config = SECTION_CONFIG[section];
    if (!config) return res.status(400).json({ error: 'Invalid section' });

    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const { rowCount } = await pool.query(
        `DELETE FROM ${config.table} WHERE id=$1 AND passport_id=$2`, [itemId, passportId],
      );
      if (!rowCount) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'Failed to delete item' }); }
  });

  /** POST /api/passport/sync — auto-populate from platform data */
  app.post('/api/passport/sync', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const result = await syncPassportFromPlatform(uid, passportId, pool);
      return res.json({ ok: true, synced: result });
    } catch (e: any) { return res.status(500).json({ error: 'Sync failed' }); }
  });

  /** PATCH /api/passport/settings — update passport-level settings */
  app.patch('/api/passport/settings', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const allowed = ['display_name','headline','bio','section_visibility','share_scores'];
    const body = req.body ?? {};
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const updates: string[] = []; const values: unknown[] = [];
      for (const k of allowed) {
        if (body[k] === undefined) continue;
        const v = k === 'section_visibility' ? JSON.stringify(body[k]) : body[k];
        values.push(v); updates.push(`${k}=$${values.length}`);
      }
      if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
      values.push(passportId);
      updates.push('updated_at=NOW()');
      const { rows } = await pool.query(
        `UPDATE cp_passport SET ${updates.join(',')} WHERE id=$${values.length} RETURNING *`,
        values,
      );
      return res.json({ ok: true, passport: rows[0] });
    } catch { return res.status(500).json({ error: 'Settings update failed' }); }
  });

  // ── Sharing ──────────────────────────────────────────────────────────────

  /** GET /api/passport/shares */
  app.get('/api/passport/shares', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const { rows } = await pool.query(
        `SELECT id, token, sections, label, expires_at, view_count, created_at, revoked_at
         FROM cp_share_tokens WHERE passport_id=$1 ORDER BY created_at DESC`,
        [passportId],
      );
      return res.json({ shares: rows });
    } catch { return res.status(500).json({ error: 'Failed to load shares' }); }
  });

  /** POST /api/passport/share */
  app.post('/api/passport/share', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const { sections, label, expires_in_days } = req.body ?? {};
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const token = randomToken(32);
      const expiresAt = expires_in_days
        ? new Date(Date.now() + Number(expires_in_days) * 86_400_000).toISOString()
        : null;
      const { rows } = await pool.query(
        `INSERT INTO cp_share_tokens (passport_id, token, sections, label, expires_at)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [passportId, token, sections ?? null, label ?? null, expiresAt],
      );
      return res.status(201).json({ ok: true, token, share: rows[0] });
    } catch { return res.status(500).json({ error: 'Failed to create share link' }); }
  });

  /** DELETE /api/passport/share/:token */
  app.delete('/api/passport/share/:token', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const { rowCount } = await pool.query(
        `UPDATE cp_share_tokens SET revoked_at=NOW()
         WHERE token=$1 AND passport_id=$2 AND revoked_at IS NULL`,
        [req.params.token, passportId],
      );
      if (!rowCount) return res.status(404).json({ error: 'Share not found or already revoked' });
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'Failed to revoke share' }); }
  });

  // ── Public share reader ──────────────────────────────────────────────────

  /** GET /api/passport/shared/:token — public, no auth */
  app.get('/api/passport/shared/:token', FLAG_GUARD, async (req: Request, res: Response) => {
    const { token } = req.params;
    try {
      await ensureSchema();
      const { rows: tokenRows } = await pool.query(
        `SELECT * FROM cp_share_tokens WHERE token=$1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [token],
      );
      if (!tokenRows.length) return res.status(404).json({ error: 'Share link not found or expired' });
      const shareRow = tokenRows[0];
      const passportId: number = shareRow.passport_id;

      // Increment view count
      await pool.query(`UPDATE cp_share_tokens SET view_count=view_count+1 WHERE id=$1`, [shareRow.id]).catch(() => null);

      // Get passport meta
      const { rows: meta } = await pool.query(
        `SELECT display_name, headline, bio, section_visibility, share_scores, completeness_score, strength_score FROM cp_passport WHERE id=$1`,
        [passportId],
      );
      if (!meta.length) return res.status(404).json({ error: 'Passport not found' });
      const passport = meta[0];
      const allowedSections: string[] | null = shareRow.sections;
      const visibility: Record<string, string> = passport.section_visibility ?? {};

      // Helper: should section be included?
      const allowed = (sec: string) => {
        if (allowedSections && !allowedSections.includes(sec)) return false;
        const v = visibility[sec] ?? 'private';
        return v === 'public' || v === 'connections';
      };

      const sections: Record<string, unknown[]> = {};
      for (const [sec, config] of Object.entries(SECTION_CONFIG)) {
        if (sec === 'scores' && !passport.share_scores) continue;
        if (!allowed(sec)) continue;
        try {
          const { rows } = await pool.query(
            `SELECT * FROM ${config.table}
             WHERE passport_id=$1 AND is_visible=true
             ORDER BY ${config.orderBy}`,
            [passportId],
          );
          sections[sec] = rows;
        } catch { /* skip section */ }
      }

      return res.json({
        ok: true,
        passport: {
          display_name: passport.display_name,
          headline: passport.headline,
          bio: passport.bio,
          completeness_score: passport.completeness_score,
          strength_score: passport.strength_score,
        },
        sections,
        share: { label: shareRow.label, created_at: shareRow.created_at },
      });
    } catch { return res.status(500).json({ error: 'Failed to load shared passport' }); }
  });

  // ── Verification ─────────────────────────────────────────────────────────

  /** POST /api/passport/verify-request */
  app.post('/api/passport/verify-request', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    const { item_type, item_id, verifier_email, verifier_name, verifier_org } = req.body ?? {};
    if (!item_type || !item_id || !verifier_email) {
      return res.status(400).json({ error: 'item_type, item_id, verifier_email required' });
    }
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const token = randomToken(32);
      const { rows } = await pool.query(
        `INSERT INTO cp_verification_requests
           (passport_id, item_type, item_id, verifier_email, verifier_name, verifier_org, token)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, token`,
        [passportId, item_type, item_id, verifier_email, verifier_name, verifier_org, token],
      );
      return res.status(201).json({ ok: true, request_id: rows[0].id, token });
    } catch { return res.status(500).json({ error: 'Failed to create verification request' }); }
  });

  /** PATCH /api/passport/verify/:token — verifier accepts */
  app.patch('/api/passport/verify/:token', FLAG_GUARD, async (req: Request, res: Response) => {
    const { token } = req.params;
    const { action, notes } = req.body ?? {};
    if (!['verified','declined'].includes(action)) {
      return res.status(400).json({ error: "action must be 'verified' or 'declined'" });
    }
    try {
      await ensureSchema();
      const { rows } = await pool.query(
        `SELECT * FROM cp_verification_requests
         WHERE token=$1 AND status='pending' AND expires_at > NOW()`,
        [token],
      );
      if (!rows.length) return res.status(404).json({ error: 'Request not found or expired' });
      const vreq = rows[0];
      const now = new Date().toISOString();
      await pool.query(
        `UPDATE cp_verification_requests SET status=$1, ${action === 'verified' ? 'verified_at' : 'declined_at'}=$2, notes=$3 WHERE id=$4`,
        [action, now, notes ?? null, vreq.id],
      );
      if (action === 'verified') {
        const config = SECTION_CONFIG[vreq.item_type];
        if (config) {
          await pool.query(
            `UPDATE ${config.table} SET is_verified=true, verification_status='third_party_verified',
             verified_by=$1, verified_at=$2 WHERE id=$3`,
            [vreq.verifier_email, now, vreq.item_id],
          ).catch(() => null);
        }
      }
      return res.json({ ok: true, status: action });
    } catch { return res.status(500).json({ error: 'Verification failed' }); }
  });

  // ── Analytics ────────────────────────────────────────────────────────────

  /** GET /api/passport/analytics */
  app.get('/api/passport/analytics', FLAG_GUARD, requireAuth, async (req: any, res: Response) => {
    const uid = userId(req);
    try {
      await ensureSchema();
      const passportId = await ensurePassport(uid, pool);
      const { completeness, strength, section_counts } = await computePassportCompleteness(passportId, pool);

      // Verification breakdown
      const { rows: verRows } = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM cp_competencies WHERE passport_id=$1)::int AS total_competencies,
           (SELECT COUNT(*) FROM cp_competencies WHERE passport_id=$1 AND is_verified=true)::int AS verified_competencies,
           (SELECT COUNT(*) FROM cp_assessments  WHERE passport_id=$1 AND platform_verified=true)::int AS platform_assessments,
           (SELECT COUNT(*) FROM cp_certifications WHERE passport_id=$1 AND is_verified=true)::int AS verified_certs,
           (SELECT COUNT(*) FROM cp_share_tokens WHERE passport_id=$1 AND revoked_at IS NULL)::int AS active_shares,
           (SELECT COALESCE(SUM(view_count),0) FROM cp_share_tokens WHERE passport_id=$1)::int AS total_views,
           (SELECT COUNT(*) FROM cp_verification_requests WHERE passport_id=$1 AND status='verified')::int AS verifications_received`,
        [passportId],
      );
      const v = verRows[0] ?? {};

      // Score trajectory
      const { rows: scoreHistory } = await pool.query(
        `SELECT score_type, score, band, computed_at FROM cp_readiness_scores
         WHERE passport_id=$1 ORDER BY computed_at DESC LIMIT 20`,
        [passportId],
      );

      return res.json({
        ok: true,
        completeness,
        strength,
        section_counts,
        verification: {
          total_competencies: v.total_competencies ?? 0,
          verified_competencies: v.verified_competencies ?? 0,
          platform_assessments: v.platform_assessments ?? 0,
          verified_certs: v.verified_certs ?? 0,
          verifications_received: v.verifications_received ?? 0,
        },
        sharing: {
          active_shares: v.active_shares ?? 0,
          total_views: v.total_views ?? 0,
        },
        score_history: scoreHistory,
        privacy_rules: {
          description: 'Section visibility is owner-controlled. is_visible per item. PII never shared. Scores shared only when share_scores=true.',
          permissions: {
            owner: 'Full CRUD on all sections and settings',
            share_viewer: 'Read-only — filtered by sections array in share token and section_visibility setting',
            verifier: 'Can attest one specific item via email token — no other access',
            platform: 'Can auto-populate assessments/scores, marks platform_verified=true',
          },
        },
      });
    } catch { return res.status(500).json({ error: 'Analytics failed' }); }
  });

  // ── Admin ────────────────────────────────────────────────────────────────

  /** GET /api/admin/passport/stats */
  app.get('/api/admin/passport/stats', FLAG_GUARD, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      await ensureSchema();
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM cp_passport)::int AS total_passports,
          (SELECT AVG(completeness_score)::numeric(5,1) FROM cp_passport)::text AS avg_completeness,
          (SELECT AVG(strength_score)::numeric(5,1) FROM cp_passport)::text AS avg_strength,
          (SELECT COUNT(*) FROM cp_assessments WHERE platform_verified=true)::int AS platform_verified_assessments,
          (SELECT COUNT(*) FROM cp_share_tokens WHERE revoked_at IS NULL)::int AS active_shares,
          (SELECT COUNT(*) FROM cp_verification_requests WHERE status='verified')::int AS total_verifications
      `);
      return res.json({ ok: true, stats: rows[0] ?? {} });
    } catch { return res.status(500).json({ error: 'Failed to load stats' }); }
  });
}
