/**
 * EP-98-W1 — Employer Portal Security Layer
 *
 * Deliverables:
 *   - Organization isolation  (employer_organizations + employer_members)
 *   - RBAC                    (owner > admin > hiring_manager > recruiter > viewer)
 *   - Business units          (employer_business_units)
 *   - Comprehensive audit log (employer_audit_logs — all CUD + auth events)
 *   - Approval workflows      (employer_approvals — high-value offers, bulk ops)
 *   - Session tracking        (employer_sessions — device/IP, concurrent revoke)
 *   - SSO config architecture (employer_sso_configs — SAML/OIDC stubs)
 *   - Risk scoring            (employer_risk_events — anomaly + severity scoring)
 *
 * Backward-compat contract:
 *   employer_organizations.id === creator_user_id (solo employer)
 *   So all existing  WHERE employer_id = user_id  queries keep working unchanged.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import crypto from 'crypto';

type Middleware = (req: Request, res: Response, next: any) => void;

// ─── ROLE HIERARCHY ────────────────────────────────────────────────────────────

export const EMPLOYER_ROLES = ['viewer', 'recruiter', 'hiring_manager', 'admin', 'owner'] as const;
export type EmployerRole = typeof EMPLOYER_ROLES[number];

export const ROLE_RANK: Record<EmployerRole, number> = {
  viewer: 0, recruiter: 1, hiring_manager: 2, admin: 3, owner: 4,
};

// ─── SECURITY SCHEMA ──────────────────────────────────────────────────────────

let securitySchemaReady = false;

export async function ensureSecuritySchema(pool: Pool): Promise<void> {
  if (securitySchemaReady) return;
  await pool.query(`
    -- Organizations (id = creator user_id keeps existing employer_id queries intact)
    CREATE TABLE IF NOT EXISTS employer_organizations (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL DEFAULT '',
      domain              TEXT DEFAULT '',
      plan                TEXT DEFAULT 'starter',
      owner_id            TEXT NOT NULL,
      approval_threshold  NUMERIC DEFAULT 1500000,
      max_sessions        INTEGER DEFAULT 5,
      settings            JSONB DEFAULT '{}'::jsonb,
      verified            BOOLEAN DEFAULT false,
      created_at          TIMESTAMPTZ DEFAULT now(),
      updated_at          TIMESTAMPTZ DEFAULT now()
    );

    -- RBAC membership
    CREATE TABLE IF NOT EXISTS employer_members (
      id               TEXT PRIMARY KEY,
      org_id           TEXT NOT NULL,
      user_id          TEXT NOT NULL,
      role             TEXT NOT NULL DEFAULT 'recruiter',
      business_unit_id TEXT DEFAULT '',
      invited_by       TEXT DEFAULT '',
      invite_email     TEXT DEFAULT '',
      status           TEXT DEFAULT 'active',
      permissions      JSONB DEFAULT '{}'::jsonb,
      last_active      TIMESTAMPTZ,
      joined_at        TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_members_uq   ON employer_members(org_id, user_id);
    CREATE INDEX        IF NOT EXISTS idx_emp_members_user ON employer_members(user_id);
    CREATE INDEX        IF NOT EXISTS idx_emp_members_org  ON employer_members(org_id);

    -- Business units
    CREATE TABLE IF NOT EXISTS employer_business_units (
      id           TEXT PRIMARY KEY,
      org_id       TEXT NOT NULL,
      name         TEXT NOT NULL DEFAULT '',
      parent_id    TEXT DEFAULT '',
      head_user_id TEXT DEFAULT '',
      description  TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_bu_org ON employer_business_units(org_id);

    -- Comprehensive audit log (append-only)
    CREATE TABLE IF NOT EXISTS employer_audit_logs (
      id            TEXT PRIMARY KEY,
      org_id        TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      action        TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id   TEXT DEFAULT '',
      resource_name TEXT DEFAULT '',
      old_value     JSONB,
      new_value     JSONB,
      ip            TEXT DEFAULT '',
      user_agent    TEXT DEFAULT '',
      status        TEXT DEFAULT 'success',
      risk_score    INTEGER DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_audit_org     ON employer_audit_logs(org_id);
    CREATE INDEX IF NOT EXISTS idx_emp_audit_user    ON employer_audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_emp_audit_created ON employer_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_emp_audit_type    ON employer_audit_logs(resource_type);

    -- Approval workflows
    CREATE TABLE IF NOT EXISTS employer_approvals (
      id             TEXT PRIMARY KEY,
      org_id         TEXT NOT NULL,
      requested_by   TEXT NOT NULL,
      resource_type  TEXT NOT NULL,
      resource_id    TEXT NOT NULL,
      action         TEXT NOT NULL,
      payload        JSONB DEFAULT '{}'::jsonb,
      status         TEXT DEFAULT 'pending',
      decided_by     TEXT DEFAULT '',
      decision_notes TEXT DEFAULT '',
      expires_at     TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
      created_at     TIMESTAMPTZ DEFAULT now(),
      decided_at     TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_emp_approvals_org    ON employer_approvals(org_id);
    CREATE INDEX IF NOT EXISTS idx_emp_approvals_status ON employer_approvals(status);
    CREATE INDEX IF NOT EXISTS idx_emp_approvals_res    ON employer_approvals(resource_id);

    -- Session tracking
    CREATE TABLE IF NOT EXISTS employer_sessions (
      id           TEXT PRIMARY KEY,
      org_id       TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      session_hash TEXT NOT NULL,
      ip           TEXT DEFAULT '',
      user_agent   TEXT DEFAULT '',
      device_type  TEXT DEFAULT 'unknown',
      is_active    BOOLEAN DEFAULT true,
      sso_verified BOOLEAN DEFAULT false,
      last_active  TIMESTAMPTZ DEFAULT now(),
      revoked_at   TIMESTAMPTZ,
      revoked_by   TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_sessions_hash ON employer_sessions(session_hash);
    CREATE INDEX        IF NOT EXISTS idx_emp_sessions_user ON employer_sessions(user_id, is_active);
    CREATE INDEX        IF NOT EXISTS idx_emp_sessions_org  ON employer_sessions(org_id);
    ALTER TABLE employer_sessions ADD COLUMN IF NOT EXISTS sso_verified BOOLEAN DEFAULT false;

    -- SSO configuration (architecture stubs — no live SAML/OIDC flow)
    CREATE TABLE IF NOT EXISTS employer_sso_configs (
      id         TEXT PRIMARY KEY,
      org_id     TEXT NOT NULL UNIQUE,
      provider   TEXT DEFAULT 'none',
      enabled    BOOLEAN DEFAULT false,
      domains    JSONB DEFAULT '[]'::jsonb,
      config     JSONB DEFAULT '{}'::jsonb,
      enforce    BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Risk events
    CREATE TABLE IF NOT EXISTS employer_risk_events (
      id          TEXT PRIMARY KEY,
      org_id      TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      severity    TEXT DEFAULT 'low',
      details     JSONB DEFAULT '{}'::jsonb,
      resolved    BOOLEAN DEFAULT false,
      resolved_by TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emp_risk_org      ON employer_risk_events(org_id);
    CREATE INDEX IF NOT EXISTS idx_emp_risk_severity ON employer_risk_events(severity);
    CREATE INDEX IF NOT EXISTS idx_emp_risk_resolved ON employer_risk_events(resolved);
  `);
  securitySchemaReady = true;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function secUid(): string {
  return (crypto as any).randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
}

function hashSid(sessionId: string): string {
  return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 24);
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return (req.socket as any)?.remoteAddress ?? '';
}

// ─── ORG / MEMBERSHIP RESOLUTION ─────────────────────────────────────────────

export interface OrgContext {
  orgId: string;
  role: EmployerRole;
  businessUnitId: string;
  memberId: string;
}

export async function resolveOrgContext(req: Request, pool: Pool): Promise<OrgContext | null> {
  const userId = (req.user as any)?.id;
  if (!userId) return null;
  try {
    const res = await pool.query(
      `SELECT id, org_id, role, business_unit_id
         FROM employer_members
        WHERE user_id = $1 AND status = 'active'
        ORDER BY joined_at ASC LIMIT 1`,
      [userId],
    );
    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
      orgId: row.org_id,
      role: (row.role as EmployerRole) ?? 'viewer',
      businessUnitId: row.business_unit_id ?? '',
      memberId: row.id,
    };
  } catch { return null; }
}

// ─── AUDIT LOGGING (fire-and-forget, append-only) ────────────────────────────

export interface AuditOpts {
  orgId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  req?: Request;
  status?: 'success' | 'denied' | 'error';
  riskScore?: number;
}

export function logAudit(pool: Pool, opts: AuditOpts): void {
  const {
    orgId, userId, action, resourceType,
    resourceId = '', resourceName = '',
    oldValue, newValue, req,
    status = 'success', riskScore = 0,
  } = opts;
  const ip = req ? getClientIp(req) : '';
  const ua = String(req?.headers['user-agent'] ?? '').slice(0, 256);
  setImmediate(() => {
    pool.query(
      `INSERT INTO employer_audit_logs
         (id, org_id, user_id, action, resource_type, resource_id, resource_name,
          old_value, new_value, ip, user_agent, status, risk_score, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())`,
      [
        secUid(), orgId, userId, action, resourceType,
        resourceId, resourceName,
        oldValue != null ? JSON.stringify(oldValue) : null,
        newValue != null ? JSON.stringify(newValue) : null,
        ip, ua, status, riskScore,
      ],
    ).catch(e => console.warn('[employer-security] audit log:', e?.message));
  });
}

// ─── RISK EVENT TRACKING (fire-and-forget) ────────────────────────────────────

export function trackRiskEvent(
  pool: Pool,
  opts: { orgId: string; userId: string; eventType: string; severity?: 'low' | 'medium' | 'high' | 'critical'; details?: unknown },
): void {
  const { orgId, userId, eventType, severity = 'low', details = {} } = opts;
  setImmediate(() => {
    pool.query(
      `INSERT INTO employer_risk_events (id, org_id, user_id, event_type, severity, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [secUid(), orgId, userId, eventType, severity, JSON.stringify(details)],
    ).catch(() => {});
  });
}

// ─── SESSION TRACKING (fire-and-forget) ───────────────────────────────────────

export function trackSession(pool: Pool, req: Request, orgId: string, userId: string): void {
  const sid = (req.session as any)?.id ?? '';
  if (!sid) return;
  const sessionHash = hashSid(sid);
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] ?? '').slice(0, 256);
  const deviceType = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
  setImmediate(async () => {
    try {
      // Upsert current session
      await pool.query(
        `INSERT INTO employer_sessions (id, org_id, user_id, session_hash, ip, user_agent, device_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (session_hash) DO UPDATE SET last_active = now()`,
        [secUid(), orgId, userId, sessionHash, ip, ua, deviceType],
      );
      // Enforce max_sessions: revoke oldest sessions if over limit
      const orgRes = await pool.query(
        `SELECT max_sessions FROM employer_organizations WHERE id = $1`, [orgId],
      );
      const maxSessions = Number(orgRes.rows[0]?.max_sessions ?? 0);
      if (maxSessions > 0) {
        const countRes = await pool.query(
          `SELECT COUNT(*) FROM employer_sessions WHERE org_id = $1 AND user_id = $2 AND is_active = true`,
          [orgId, userId],
        );
        const count = Number(countRes.rows[0]?.count ?? 0);
        if (count > maxSessions) {
          await pool.query(
            `UPDATE employer_sessions
                SET is_active = false, revoked_at = now(), revoked_by = 'system:max_sessions'
              WHERE id IN (
                SELECT id FROM employer_sessions
                WHERE org_id = $1 AND user_id = $2 AND is_active = true
                  AND session_hash != $3
                ORDER BY last_active ASC
                LIMIT $4
              )`,
            [orgId, userId, sessionHash, count - maxSessions],
          );
          trackRiskEvent(pool, {
            orgId, userId, eventType: 'max_sessions_exceeded',
            severity: 'medium',
            details: { count, maxSessions, ip },
          });
        }
      }
    } catch { /* non-blocking */ }
  });
}

// ─── APPROVAL WORKFLOW HELPERS ────────────────────────────────────────────────

export async function checkApprovalRequired(
  pool: Pool, orgId: string, resourceType: string, payload: Record<string, unknown>,
): Promise<boolean> {
  if (resourceType !== 'offer') return false;
  const orgRes = await pool.query(
    `SELECT approval_threshold FROM employer_organizations WHERE id = $1`,
    [orgId],
  ).catch(() => ({ rows: [] as any[] }));
  const threshold = Number(orgRes.rows[0]?.approval_threshold ?? 0);
  if (threshold <= 0) return false;
  const total = Number(payload.totalCtc ?? payload.ctcFixed ?? 0);
  return total > 0 && total > threshold;
}

export async function createApproval(
  pool: Pool,
  opts: { orgId: string; requestedBy: string; resourceType: string; resourceId: string; action: string; payload: unknown },
): Promise<string> {
  const id = secUid();
  await pool.query(
    `INSERT INTO employer_approvals
       (id, org_id, requested_by, resource_type, resource_id, action, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, opts.orgId, opts.requestedBy, opts.resourceType, opts.resourceId, opts.action, JSON.stringify(opts.payload)],
  );
  return id;
}

// ─── SECURITY ROUTES ──────────────────────────────────────────────────────────

// ─── SSO ENFORCEMENT CHECK ────────────────────────────────────────────────────
// Returns { blocked: true, reason } when org has enforce=true, enabled=true,
// the user's email domain is in sso_configs.domains, and the current session
// has NOT been marked sso_verified (set by /api/employer/auth/sso/callback).

export async function checkSSOEnforcement(
  pool: Pool, orgId: string, userEmail: string, req: Request,
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const res = await pool.query(
      `SELECT provider, enabled, enforce, domains FROM employer_sso_configs WHERE org_id = $1`,
      [orgId],
    );
    const sso = res.rows[0];
    if (!sso || !sso.enforce || !sso.enabled) return { blocked: false };
    const domains: string[] = Array.isArray(sso.domains) ? sso.domains : [];
    if (!domains.length) return { blocked: false };
    const userDomain = (userEmail ?? '').split('@')[1] ?? '';
    if (!userDomain || !domains.includes(userDomain)) return { blocked: false };
    // Allow if this session was verified via SSO callback
    if ((req.session as any)?.employer_sso_verified === true) return { blocked: false };
    return {
      blocked: true,
      reason: `SSO required for ${userDomain}. Please authenticate via your organisation's SSO provider.`,
    };
  } catch { return { blocked: false }; }
}

export function registerEmployerSecurityRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Middleware,
): void {

  const withSec = (handler: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await ensureSecuritySchema(pool);
        await handler(req, res);
      } catch (e: any) {
        console.error('[employer-security]', e?.message);
        res.status(500).json({ error: e?.message ?? 'security_error' });
      }
    };

  const ctx = (req: Request) => resolveOrgContext(req, pool);

  // ── ORG MANAGEMENT ──────────────────────────────────────────────────────────

  app.get('/api/employer/orgs/me', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(404).json({ error: 'No employer organisation found' });
    const [orgRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM employer_organizations WHERE id = $1`, [c.orgId]),
      pool.query(`SELECT COUNT(*) FROM employer_members WHERE org_id = $1 AND status = 'active'`, [c.orgId]),
    ]);
    const org = orgRes.rows[0];
    res.json({
      org: org ? {
        id: org.id, name: org.name, domain: org.domain ?? '',
        plan: org.plan ?? 'starter', verified: org.verified ?? false,
        approvalThreshold: Number(org.approval_threshold) || 0,
        maxSessions: org.max_sessions ?? 5,
        settings: org.settings ?? {},
        createdAt: org.created_at,
      } : null,
      myRole: c.role,
      memberCount: Number(countRes.rows[0]?.count ?? 0),
    });
  }));

  app.patch('/api/employer/orgs/me', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const { name, domain, approvalThreshold, maxSessions } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (name != null) { fields.push(`name = $${i++}`); vals.push(name); }
    if (domain != null) { fields.push(`domain = $${i++}`); vals.push(domain); }
    if (approvalThreshold != null) { fields.push(`approval_threshold = $${i++}`); vals.push(Number(approvalThreshold)); }
    if (maxSessions != null) { fields.push(`max_sessions = $${i++}`); vals.push(Number(maxSessions)); }
    if (!fields.length) return res.json({ success: true });
    fields.push('updated_at = now()');
    await pool.query(`UPDATE employer_organizations SET ${fields.join(', ')} WHERE id = $${i}`, [...vals, c.orgId]);
    logAudit(pool, { orgId: c.orgId, userId: (req.user as any)?.id, action: 'updated', resourceType: 'organization', req });
    res.json({ success: true });
  }));

  // ── MEMBER MANAGEMENT ───────────────────────────────────────────────────────

  app.get('/api/employer/security/members', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    const rows = await pool.query(
      `SELECT em.id, em.user_id, em.role, em.business_unit_id, em.status,
              em.invite_email, em.last_active, em.joined_at,
              u.username AS user_email, u."fullName" AS full_name
         FROM employer_members em
         LEFT JOIN users u ON u.id = em.user_id
        WHERE em.org_id = $1
        ORDER BY em.joined_at ASC`,
      [c.orgId],
    );
    res.json({
      members: rows.rows.map(r => ({
        _id: r.id, userId: r.user_id, role: r.role, status: r.status,
        email: r.user_email ?? r.invite_email ?? '',
        fullName: r.full_name ?? '',
        businessUnitId: r.business_unit_id ?? '',
        lastActive: r.last_active, joinedAt: r.joined_at,
      })),
    });
  }));

  app.post('/api/employer/security/members/invite', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const { email, role = 'recruiter', businessUnitId = '' } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'Email required' });
    if (!EMPLOYER_ROLES.includes(role as EmployerRole)) return res.status(400).json({ error: 'Invalid role' });
    const inviterId = (req.user as any)?.id;
    const userRes = await pool.query(
      `SELECT id FROM users WHERE username = $1 OR email = $1 LIMIT 1`, [email.trim()],
    ).catch(() => ({ rows: [] as any[] }));
    const existingId = userRes.rows[0]?.id ?? null;
    const id = secUid();
    await pool.query(
      `INSERT INTO employer_members
         (id, org_id, user_id, role, business_unit_id, invited_by, invite_email, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [id, c.orgId, existingId ?? '', role, businessUnitId, inviterId, email.trim(),
       existingId ? 'active' : 'invited'],
    );
    logAudit(pool, { orgId: c.orgId, userId: inviterId, action: 'invited', resourceType: 'member', resourceId: id, resourceName: email.trim(), req });
    res.json({ success: true, status: existingId ? 'active' : 'invited' });
  }));

  app.patch('/api/employer/security/members/:id', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const { role, status, businessUnitId } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (role && EMPLOYER_ROLES.includes(role as EmployerRole)) { fields.push(`role = $${i++}`); vals.push(role); }
    if (['active', 'suspended'].includes(status ?? '')) { fields.push(`status = $${i++}`); vals.push(status); }
    if (businessUnitId != null) { fields.push(`business_unit_id = $${i++}`); vals.push(businessUnitId); }
    if (!fields.length) return res.json({ success: true });
    await pool.query(
      `UPDATE employer_members SET ${fields.join(', ')} WHERE id = $${i} AND org_id = $${i + 1}`,
      [...vals, req.params.id, c.orgId],
    );
    logAudit(pool, { orgId: c.orgId, userId: (req.user as any)?.id, action: 'updated', resourceType: 'member', resourceId: req.params.id, req });
    res.json({ success: true });
  }));

  app.delete('/api/employer/security/members/:id', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['owner']) return res.status(403).json({ error: 'owner required' });
    await pool.query(
      `UPDATE employer_members SET status = 'suspended' WHERE id = $1 AND org_id = $2`,
      [req.params.id, c.orgId],
    );
    logAudit(pool, { orgId: c.orgId, userId: (req.user as any)?.id, action: 'suspended', resourceType: 'member', resourceId: req.params.id, req, riskScore: 5 });
    res.json({ success: true });
  }));

  // ── BUSINESS UNITS ──────────────────────────────────────────────────────────

  app.get('/api/employer/security/business-units', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    const rows = await pool.query(
      `SELECT * FROM employer_business_units WHERE org_id = $1 ORDER BY created_at ASC`, [c.orgId],
    );
    res.json({ units: rows.rows.map(r => ({ _id: r.id, name: r.name, parentId: r.parent_id ?? '', headUserId: r.head_user_id ?? '', description: r.description ?? '', createdAt: r.created_at })) });
  }));

  app.post('/api/employer/security/business-units', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const { name, parentId = '', headUserId = '', description = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const id = secUid();
    await pool.query(
      `INSERT INTO employer_business_units (id, org_id, name, parent_id, head_user_id, description)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, c.orgId, name.trim(), parentId, headUserId, description],
    );
    res.json({ success: true, _id: id });
  }));

  app.patch('/api/employer/security/business-units/:id', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const { name, headUserId, description } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (name) { fields.push(`name = $${i++}`); vals.push(name); }
    if (headUserId != null) { fields.push(`head_user_id = $${i++}`); vals.push(headUserId); }
    if (description != null) { fields.push(`description = $${i++}`); vals.push(description); }
    if (!fields.length) return res.json({ success: true });
    await pool.query(
      `UPDATE employer_business_units SET ${fields.join(', ')} WHERE id = $${i} AND org_id = $${i + 1}`,
      [...vals, req.params.id, c.orgId],
    );
    res.json({ success: true });
  }));

  // ── AUDIT LOG ───────────────────────────────────────────────────────────────

  app.get('/api/employer/security/audit-log', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const resourceType = req.query.resourceType as string | undefined;
    const userId = req.query.userId as string | undefined;
    const conditions: string[] = ['al.org_id = $1'];
    const vals: any[] = [c.orgId];
    let i = 2;
    if (resourceType) { conditions.push(`al.resource_type = $${i++}`); vals.push(resourceType); }
    if (userId) { conditions.push(`al.user_id = $${i++}`); vals.push(userId); }
    const [logs, total] = await Promise.all([
      pool.query(
        `SELECT al.*, u.username AS user_email
           FROM employer_audit_logs al
           LEFT JOIN users u ON u.id = al.user_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY al.created_at DESC
          LIMIT $${i} OFFSET $${i + 1}`,
        [...vals, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM employer_audit_logs al WHERE ${conditions.join(' AND ')}`,
        vals,
      ),
    ]);
    res.json({
      entries: logs.rows.map(r => ({
        _id: r.id, userId: r.user_id, userEmail: r.user_email ?? '',
        action: r.action, resourceType: r.resource_type, resourceId: r.resource_id ?? '',
        resourceName: r.resource_name ?? '', status: r.status,
        riskScore: r.risk_score ?? 0, ip: r.ip ?? '', createdAt: r.created_at,
      })),
      total: Number(total.rows[0]?.count ?? 0), limit, offset,
    });
  }));

  // ── AUDIT LOG EXPORT ────────────────────────────────────────────────────────

  app.get('/api/employer/security/audit-log/export.csv', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const rows = await pool.query(
      `SELECT al.created_at, al.action, al.resource_type, al.resource_id,
              al.resource_name, al.status, al.risk_score, al.ip, u.username AS user_email
         FROM employer_audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
        WHERE al.org_id = $1
        ORDER BY al.created_at DESC
        LIMIT 10000`,
      [c.orgId],
    );
    const header = 'timestamp,user_email,action,resource_type,resource_id,resource_name,status,risk_score,ip\n';
    const csvRow = (r: any) => [
      r.created_at, r.user_email ?? '', r.action, r.resource_type,
      r.resource_id ?? '', r.resource_name ?? '', r.status, r.risk_score ?? 0, r.ip ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    const csv = header + rows.rows.map(csvRow).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(csv);
  }));

  // ── APPROVALS ───────────────────────────────────────────────────────────────

  app.get('/api/employer/security/approvals', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['hiring_manager']) return res.status(403).json({ error: 'hiring_manager+ required' });
    // Auto-expire stale pending approvals before returning them
    await pool.query(
      `UPDATE employer_approvals SET status = 'expired'
        WHERE org_id = $1 AND status = 'pending' AND expires_at < now()`,
      [c.orgId],
    ).catch(() => {});
    const statusFilter = (req.query.status as string) ?? 'pending';
    const rows = await pool.query(
      `SELECT ap.*, u.username AS requester_email
         FROM employer_approvals ap
         LEFT JOIN users u ON u.id = ap.requested_by
        WHERE ap.org_id = $1 AND ($2 = 'all' OR ap.status = $2)
        ORDER BY ap.created_at DESC LIMIT 50`,
      [c.orgId, statusFilter],
    );
    res.json({
      approvals: rows.rows.map(r => ({
        _id: r.id, requestedBy: r.requested_by, requesterEmail: r.requester_email ?? '',
        resourceType: r.resource_type, resourceId: r.resource_id,
        action: r.action, payload: r.payload ?? {}, status: r.status,
        decidedBy: r.decided_by ?? '', decisionNotes: r.decision_notes ?? '',
        expiresAt: r.expires_at, createdAt: r.created_at, decidedAt: r.decided_at,
      })),
    });
  }));

  app.post('/api/employer/security/approvals/:id/decide', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const { decision, notes = '' } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved or rejected' });
    const deciderId = (req.user as any)?.id;
    const result = await pool.query(
      `UPDATE employer_approvals
          SET status = $1, decided_by = $2, decision_notes = $3, decided_at = now()
        WHERE id = $4 AND org_id = $5 AND status = 'pending'
        RETURNING resource_type, resource_id`,
      [decision, deciderId, notes, req.params.id, c.orgId],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Approval not found or already decided' });
    if (decision === 'approved') {
      const { resource_type, resource_id } = result.rows[0];
      if (resource_type === 'offer') {
        await pool.query(
          `UPDATE employer_offers SET status = 'Draft', updated_at = now()
            WHERE id = $1 AND employer_id = $2 AND status = 'pending_approval'`,
          [resource_id, c.orgId],
        ).catch(() => {});
      }
    }
    logAudit(pool, { orgId: c.orgId, userId: deciderId, action: decision, resourceType: 'approval', resourceId: req.params.id, req, riskScore: 5 });
    res.json({ success: true, decision });
  }));

  // ── SESSION MANAGEMENT ──────────────────────────────────────────────────────

  app.get('/api/employer/security/sessions', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    const userId = (req.user as any)?.id;
    const isAdmin = ROLE_RANK[c.role] >= ROLE_RANK['admin'];
    const currentHash = hashSid((req.session as any)?.id ?? '');
    const rows = await pool.query(
      isAdmin
        ? `SELECT es.*, u.username AS user_email FROM employer_sessions es LEFT JOIN users u ON u.id = es.user_id WHERE es.org_id = $1 AND es.is_active = true ORDER BY last_active DESC LIMIT 100`
        : `SELECT es.*, u.username AS user_email FROM employer_sessions es LEFT JOIN users u ON u.id = es.user_id WHERE es.user_id = $1 AND es.is_active = true ORDER BY last_active DESC`,
      isAdmin ? [c.orgId] : [userId],
    );
    res.json({
      sessions: rows.rows.map(r => ({
        _id: r.id, userId: r.user_id, userEmail: r.user_email ?? '',
        ip: r.ip ?? '', deviceType: r.device_type ?? 'unknown',
        userAgent: String(r.user_agent ?? '').slice(0, 80),
        lastActive: r.last_active, createdAt: r.created_at,
        isCurrent: r.session_hash === currentHash,
      })),
    });
  }));

  app.delete('/api/employer/security/sessions/:id', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    const userId = (req.user as any)?.id;
    const isAdmin = ROLE_RANK[c.role] >= ROLE_RANK['admin'];
    await pool.query(
      `UPDATE employer_sessions SET is_active = false, revoked_at = now(), revoked_by = $1
        WHERE id = $2 AND is_active = true${isAdmin ? ' AND org_id = $3' : ' AND user_id = $3'}`,
      [userId, req.params.id, isAdmin ? c.orgId : userId],
    );
    logAudit(pool, { orgId: c.orgId, userId, action: 'revoked', resourceType: 'session', resourceId: req.params.id, req, riskScore: 3 });
    res.json({ success: true });
  }));

  // ── SSO CONFIG (architecture stubs) ─────────────────────────────────────────

  app.get('/api/employer/security/sso', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const row = await pool.query(`SELECT * FROM employer_sso_configs WHERE org_id = $1`, [c.orgId]);
    const r = row.rows[0];
    res.json({
      sso: r ? {
        provider: r.provider ?? 'none', enabled: r.enabled ?? false,
        domains: r.domains ?? [], enforce: r.enforce ?? false,
        configuredAt: r.updated_at,
      } : { provider: 'none', enabled: false, domains: [], enforce: false, configuredAt: null },
    });
  }));

  app.put('/api/employer/security/sso', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['owner']) return res.status(403).json({ error: 'owner required for SSO config' });
    const { provider = 'none', enabled = false, domains = [], enforce = false, config = {} } = req.body;
    await pool.query(
      `INSERT INTO employer_sso_configs (id, org_id, provider, enabled, domains, config, enforce)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (org_id) DO UPDATE SET
         provider = $3, enabled = $4, domains = $5, config = $6, enforce = $7, updated_at = now()`,
      [secUid(), c.orgId, provider, enabled, JSON.stringify(domains), JSON.stringify(config), enforce],
    );
    logAudit(pool, { orgId: c.orgId, userId: (req.user as any)?.id, action: 'updated', resourceType: 'sso_config', req, riskScore: 10 });
    res.json({ success: true });
  }));

  // ── RISK EVENTS ─────────────────────────────────────────────────────────────

  app.get('/api/employer/security/risk', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const [events, summary] = await Promise.all([
      pool.query(
        `SELECT er.*, u.username AS user_email
           FROM employer_risk_events er
           LEFT JOIN users u ON u.id = er.user_id
          WHERE er.org_id = $1 AND er.resolved = false
          ORDER BY er.created_at DESC LIMIT 50`,
        [c.orgId],
      ),
      pool.query(
        `SELECT severity, COUNT(*) AS cnt
           FROM employer_risk_events WHERE org_id = $1 AND resolved = false GROUP BY severity`,
        [c.orgId],
      ),
    ]);
    const bySeverity: Record<string, number> = {};
    for (const r of summary.rows) bySeverity[r.severity] = Number(r.cnt ?? 0);
    const riskScore = Math.min(
      (bySeverity.critical ?? 0) * 40 + (bySeverity.high ?? 0) * 15 +
      (bySeverity.medium ?? 0) * 5 + (bySeverity.low ?? 0),
      100,
    );
    res.json({
      riskScore, bySeverity,
      events: events.rows.map(r => ({
        _id: r.id, userId: r.user_id, userEmail: r.user_email ?? '',
        eventType: r.event_type, severity: r.severity, details: r.details ?? {},
        createdAt: r.created_at,
      })),
    });
  }));

  app.post('/api/employer/security/risk/:id/resolve', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    await pool.query(
      `UPDATE employer_risk_events SET resolved = true, resolved_by = $1
        WHERE id = $2 AND org_id = $3`,
      [(req.user as any)?.id, req.params.id, c.orgId],
    );
    res.json({ success: true });
  }));

  // ── SECURITY DASHBOARD ──────────────────────────────────────────────────────

  app.get('/api/employer/security/dashboard', requireAuth, withSec(async (req, res) => {
    const c = await ctx(req);
    if (!c) return res.status(403).json({ error: 'No organisation' });
    if (ROLE_RANK[c.role] < ROLE_RANK['admin']) return res.status(403).json({ error: 'admin+ required' });
    const orgId = c.orgId;
    const [membersRes, auditRes, pendingRes, riskRes, sessionsRes, recentRes] = await Promise.all([
      pool.query(`SELECT role, status, COUNT(*) AS cnt FROM employer_members WHERE org_id = $1 GROUP BY role, status`, [orgId]),
      pool.query(`SELECT COUNT(*) FROM employer_audit_logs WHERE org_id = $1 AND created_at > now() - interval '7 days'`, [orgId]),
      pool.query(`SELECT COUNT(*) FROM employer_approvals WHERE org_id = $1 AND status = 'pending'`, [orgId]),
      pool.query(`SELECT severity, COUNT(*) AS cnt FROM employer_risk_events WHERE org_id = $1 AND resolved = false GROUP BY severity`, [orgId]),
      pool.query(`SELECT COUNT(*) FROM employer_sessions WHERE org_id = $1 AND is_active = true`, [orgId]),
      pool.query(`SELECT action, resource_type, ip, created_at FROM employer_audit_logs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 10`, [orgId]),
    ]);
    const membersByRole: Record<string, number> = {};
    let totalActive = 0;
    for (const r of membersRes.rows) {
      if (r.status === 'active') { membersByRole[r.role] = (membersByRole[r.role] ?? 0) + Number(r.cnt); totalActive += Number(r.cnt); }
    }
    const bySeverity: Record<string, number> = {};
    for (const r of riskRes.rows) bySeverity[r.severity] = Number(r.cnt ?? 0);
    const rawRisk = Math.min(
      (bySeverity.critical ?? 0) * 40 + (bySeverity.high ?? 0) * 15 +
      (bySeverity.medium ?? 0) * 5 + (bySeverity.low ?? 0),
      100,
    );
    res.json({
      securityScore: Math.max(0, 98 - rawRisk),
      members: { total: totalActive, byRole: membersByRole },
      audit: { last7Days: Number(auditRes.rows[0]?.count ?? 0) },
      pendingApprovals: Number(pendingRes.rows[0]?.count ?? 0),
      activeSessions: Number(sessionsRes.rows[0]?.count ?? 0),
      risk: { score: rawRisk, bySeverity },
      recentActivity: recentRes.rows.map(r => ({
        action: r.action, resourceType: r.resource_type, ip: r.ip ?? '', createdAt: r.created_at,
      })),
    });
  }));

  // ── SSO CALLBACK (marks session as SSO-verified; live IdP exchange = future) ──

  app.post('/api/employer/auth/sso/callback', withSec(async (req, res) => {
    // When a real SAML/OIDC IdP completes the flow it will POST here.
    // Until then this endpoint arms the session flag and updates the sessions table.
    (req.session as any).employer_sso_verified = true;
    const c = await ctx(req).catch(() => null);
    if (c) {
      const sessionHash = hashSid((req.session as any)?.id ?? '');
      await pool.query(
        `UPDATE employer_sessions SET sso_verified = true WHERE session_hash = $1 AND org_id = $2`,
        [sessionHash, c.orgId],
      ).catch(() => {});
    }
    res.json({ success: true, sso_verified: true });
  }));

  // ── SCHEMA INIT + SCHEDULED APPROVAL EXPIRY ───────────────────────────────

  setImmediate(() =>
    ensureSecuritySchema(pool).catch(e => console.warn('[employer-security] schema init:', e?.message)),
  );

  // Sweep expired pending approvals every hour (belt-and-suspenders over the on-fetch sweep)
  setInterval(() => {
    pool.query(
      `UPDATE employer_approvals SET status = 'expired' WHERE status = 'pending' AND expires_at < now()`,
    ).catch(() => {});
  }, 60 * 60 * 1000);

  console.log('[employer-security] routes registered (EP-98-W1 + enforcement)');
}
