// ============================================================
// STEP 12 — Security Center (VISIBILITY-ONLY)
// ------------------------------------------------------------
// Additive, read-only / never-throws surfaces over the EXISTING security
// model. NOTHING here changes who can access what — the live enforcement
// rule remains the single `super_admin` gate on /api/admin/* (see routes.ts).
//
// Design decision (honesty + no-duplicates): this platform already ships an
// audit subsystem (`admin_audit_logs` + GET /api/admin/audit-logs + the
// "Audit Logs" view in SecurityPanel) and a sessions endpoint
// (GET /api/admin/sessions). Those tables were never migrated into this DB,
// so both surfaces were effectively broken/empty. Rather than building a
// PARALLEL audit_logs system, we:
//   - ensure the canonical `admin_audit_logs` table exists, and
//   - point the new global audit middleware at it,
// which ACTIVATES the existing audit viewer with real data — no duplicate
// table, no duplicate endpoint, no duplicate screen.
//
// Provides:
//   - ensureSecuritySchema(pool): lazily create admin_audit_logs + the formal
//     RBAC tables (role_definitions / permission_definitions / role_permissions)
//     IF NOT EXISTS, mirroring backend/shared/schema.ts. Never throws.
//   - createAdminAuditMiddleware(pool): records mutating admin actions into
//     admin_audit_logs (fire-and-forget; never blocks or alters the response).
//   - registerSecurityCenterRoutes(...): the ONE genuinely-new read surface,
//       GET /api/admin/security/permission-matrix
//     (the existing /api/admin/audit-logs and /api/admin/sessions cover the
//     other two viewers — reused, not duplicated).
//
// Honesty: the formal RBAC tables are surfaced as-is. If empty, that is
// reported as an honest finding alongside the REAL access reality computed from
// live data (roles actually present in `users` and the live super_admin gate).
// No grants are fabricated.
// ============================================================

import type { Express } from "express";
import type { Pool } from "pg";

let schemaReady: Promise<void> | null = null;

// Lazy ensure-schema. Mirrors backend/shared/schema.ts (admin_audit_logs) plus
// the formal RBAC tables. CREATE TABLE IF NOT EXISTS is idempotent and safe
// alongside any canonical migration. Never throws to the caller.
export function ensureSecuritySchema(pool: Pool): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    // Canonical admin audit log (matches `adminAuditLogs` in shared/schema.ts).
    // The existing GET /api/admin/audit-logs + Audit Logs view read this table.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id varchar,
        action_type text NOT NULL,
        target_type text NOT NULL,
        target_id varchar NOT NULL,
        previous_state text,
        new_state text,
        ip_address text,
        notes text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs (created_at DESC);`
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_definitions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        role_name text NOT NULL UNIQUE,
        display_name text NOT NULL,
        description text,
        level integer NOT NULL DEFAULT 0,
        is_system boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permission_definitions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        permission_key text NOT NULL UNIQUE,
        display_name text NOT NULL,
        description text,
        category text NOT NULL DEFAULT 'general',
        resource text NOT NULL,
        action text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id varchar NOT NULL,
        permission_id varchar NOT NULL,
        granted_by varchar,
        granted_at timestamp NOT NULL DEFAULT now()
      );
    `);
  })().catch((err) => {
    // Reset so a later call can retry; never propagate.
    console.error("[security-center] ensureSecuritySchema failed:", err?.message || err);
    schemaReady = null;
  });
  return schemaReady;
}

// Derive a coarse target type from an /api/admin/<segment>/... path so audit
// rows are queryable by area without storing the full URL as the target.
function segmentFromPath(path: string): string {
  // path is relative to the /api/admin mount, e.g. "/users/123"
  return path.replace(/^\/+/, "").split(/[/?]/)[0] || "admin";
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Global audit middleware. Mount on /api/admin AFTER the auth gate so req.user
// is populated. Records only mutating, successful (<400) admin actions. Logging
// happens on response 'finish' so it never adds latency to the response and a
// logging failure can never break the request. Writes into the canonical
// admin_audit_logs table consumed by the existing audit viewer.
export function createAdminAuditMiddleware(pool: Pool) {
  void ensureSecuritySchema(pool);
  return function adminAudit(req: any, res: any, next: any) {
    if (!MUTATING.has(req.method)) return next();
    res.on("finish", () => {
      try {
        if (res.statusCode >= 400) return; // only record actions that took effect
        const userId = req.user?.id ?? null;
        const seg = segmentFromPath(req.path || req.originalUrl || "");
        const targetId =
          (req.params && (req.params.id || req.params.userId || req.params.sessionId)) || seg;
        const ip =
          (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) ||
          req.ip ||
          req.socket?.remoteAddress ||
          null;
        const notes =
          `${req.method} ${req.baseUrl || ""}${req.path || ""} → ${res.statusCode}`.slice(0, 1000);
        // fire-and-forget; do not await
        pool
          .query(
            `INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, notes, ip_address)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [userId, req.method, seg, targetId, notes, ip]
          )
          .catch(() => {});
      } catch {
        /* never throw from audit */
      }
    });
    next();
  };
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function registerSecurityCenterRoutes(
  app: Express,
  pool: Pool,
  requireAuth: any,
  requireSuperAdmin: any
) {
  const guard = [requireAuth, requireSuperAdmin];

  // ---- Permission Matrix (read-only; honest about empty + real reality) ----
  // The ONLY new read endpoint. Audit logs and sessions reuse the existing
  // /api/admin/audit-logs and /api/admin/sessions endpoints (no duplicates).
  app.get("/api/admin/security/permission-matrix", guard, async (_req, res) => {
    await ensureSecuritySchema(pool);
    const out: any = {
      roles: [],
      permissions: [],
      grants: [],
      liveReality: {
        // The actual enforcement rule in force today.
        enforcement:
          "Single gate: all /api/admin/* routes require an authenticated user with role 'super_admin' (requireAuth + requireSuperAdmin). One documented exemption: /api/admin/lbi-catalog allows any authenticated user.",
        formalRbacPopulated: false,
        rolesInUse: [] as { role: string; users: number }[],
      },
      honesty:
        "Formal RBAC tables are surfaced as-is. The platform currently enforces a single super_admin gate; any grants shown are advisory definitions, not the live enforcement path. This viewer is read-only and changes no access.",
    };
    try {
      const roles = await pool.query(
        `SELECT id, role_name, display_name, description, level, is_system, is_active
         FROM role_definitions ORDER BY level DESC, role_name`
      );
      out.roles = roles.rows;
    } catch {
      out.roles = [];
    }
    try {
      const perms = await pool.query(
        `SELECT id, permission_key, display_name, category, resource, action, is_active
         FROM permission_definitions ORDER BY category, resource, action`
      );
      out.permissions = perms.rows;
    } catch {
      out.permissions = [];
    }
    try {
      const grants = await pool.query(
        `SELECT role_id, permission_id FROM role_permissions`
      );
      out.grants = grants.rows;
    } catch {
      out.grants = [];
    }
    try {
      const real = await pool.query(
        `SELECT COALESCE(role, account_type, 'unknown') AS role, COUNT(*)::int AS users
         FROM users GROUP BY 1 ORDER BY users DESC`
      );
      out.liveReality.rolesInUse = real.rows.map((r: any) => ({
        role: r.role,
        users: safeNum(r.users),
      }));
    } catch {
      out.liveReality.rolesInUse = [];
    }
    out.liveReality.formalRbacPopulated =
      (out.roles?.length || 0) > 0 && (out.grants?.length || 0) > 0;
    res.json(out);
  });
}

// Read the live express-session store and return an honest snapshot of active
// sessions. Exported so the existing GET /api/admin/sessions handler can reuse
// it (repairing that endpoint, which previously read a non-existent
// user_sessions table) WITHOUT introducing a duplicate route.
export async function readActiveSessions(pool: Pool) {
  try {
    const result = await pool.query(
      `SELECT sid, sess, expire FROM express_sessions
       WHERE expire > now() ORDER BY expire DESC LIMIT 500`
    );
    const userIds = new Set<string>();
    const parsed = result.rows.map((r: any) => {
      let sess: any = r.sess;
      if (typeof sess === "string") {
        try {
          sess = JSON.parse(sess);
        } catch {
          sess = {};
        }
      }
      const uid = sess?.passport?.user ?? null;
      if (uid) userIds.add(String(uid));
      return { sid: r.sid, userId: uid, authenticated: !!uid, expire: r.expire };
    });
    const idMap: Record<string, { email?: string; role?: string; fullName?: string }> = {};
    if (userIds.size > 0) {
      const ids = Array.from(userIds);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
      try {
        const users = await pool.query(
          `SELECT id, email, role, full_name FROM users WHERE id IN (${placeholders})`,
          ids
        );
        for (const u of users.rows) {
          idMap[String(u.id)] = { email: u.email, role: u.role, fullName: u.full_name };
        }
      } catch {
        /* identity resolution is best-effort */
      }
    }
    const sessions = parsed.map((s) => ({
      sid: s.sid,
      userId: s.userId,
      authenticated: s.authenticated,
      expire: s.expire,
      email: s.userId ? idMap[String(s.userId)]?.email ?? null : null,
      role: s.userId ? idMap[String(s.userId)]?.role ?? null : null,
      fullName: s.userId ? idMap[String(s.userId)]?.fullName ?? null : null,
    }));
    const authenticated = sessions.filter((s) => s.authenticated);
    return {
      sessions,
      total: sessions.length,
      authenticatedCount: authenticated.length,
      anonymousCount: sessions.length - authenticated.length,
      empty: sessions.length === 0,
    };
  } catch {
    return {
      sessions: [],
      total: 0,
      authenticatedCount: 0,
      anonymousCount: 0,
      empty: true,
      error: "session store unavailable",
    };
  }
}
