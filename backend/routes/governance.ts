// ============================================================
// Governance & Security routes (Critical Gaps #2 & #3)
// ------------------------------------------------------------
// All endpoints live under /api/admin/governance/*, behind:
//   1. the governanceRbacV2 flag (requireGovernanceFlag → 503 when OFF), and
//   2. the existing requireAuth + requireSuperAdmin gate.
// Flag-OFF is byte-identical: the routes 503 BEFORE touching the DB (no schema
// ensure, no seed). Literal sub-paths are registered before any :param route.
// ============================================================

import type { Express } from "express";
import type { Pool } from "pg";
import { isGovernanceRbacEnabled } from "../config/feature-flags";
import { ensureGovernanceSchema } from "../services/governance/rbac-schema";
import { seedRbac } from "../services/governance/rbac-seed";
import {
  listRoles,
  listPermissions,
  listGroups,
  listHierarchy,
  resolveEffectivePermissions,
  getPermissionMatrix,
  grantPermission,
  revokePermission,
} from "../services/governance/rbac-engine";
import { getAdminDirectory, setAdminStatus, ADMIN_STATUSES } from "../services/governance/admin-lifecycle";
import {
  createApprovalRequest,
  decideApproval,
  listApprovals,
  APPROVAL_TYPES,
} from "../services/governance/approval-engine";
import { queryAuditEvents, queryFailedLogins, AUDIT_CATEGORIES } from "../services/governance/audit-engine";
import { buildSecurityOverview } from "../services/governance/security-overview";
import { recordFlagChange, listFlagChanges } from "../services/governance/flag-change-log";

export function registerGovernanceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: any,
  requireSuperAdmin: any
) {
  // Flag gate FIRST — 503 before any DB work so flag-OFF is byte-identical.
  const requireGovernanceFlag = (_req: any, res: any, next: any) => {
    if (!isGovernanceRbacEnabled()) {
      return res.status(503).json({
        enabled: false,
        error: "Governance/RBAC subsystem is disabled (governanceRbacV2 flag OFF).",
      });
    }
    next();
  };
  const guard = [requireGovernanceFlag, requireAuth, requireSuperAdmin];

  const actor = (req: any) => ({ id: req.user?.id ?? null, email: req.user?.email ?? null });

  // ---------------- Status / meta ----------------
  app.get("/api/admin/governance/status", guard, async (_req, res) => {
    await ensureGovernanceSchema(pool);
    const matrix = await getPermissionMatrix(pool);
    res.json({
      enabled: true,
      populated: matrix.populated,
      counts: {
        roles: matrix.roles.length,
        permissions: matrix.permissions.length,
        groups: matrix.groups.length,
        grants: matrix.grants.length,
      },
      approvalTypes: APPROVAL_TYPES,
      auditCategories: AUDIT_CATEGORIES,
      adminStatuses: ADMIN_STATUSES,
    });
  });

  // Idempotent re-seed (canonical system roles/permissions).
  app.post("/api/admin/governance/seed", guard, async (req, res) => {
    try {
      const result = await seedRbac(pool);
      res.json({ ok: true, seeded: result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "seed failed" });
    }
  });

  // ---------------- WS1/WS2: RBAC framework ----------------
  app.get("/api/admin/governance/permission-matrix", guard, async (_req, res) => {
    res.json(await getPermissionMatrix(pool));
  });
  app.get("/api/admin/governance/roles", guard, async (_req, res) => {
    res.json({ roles: await listRoles(pool) });
  });
  app.get("/api/admin/governance/permissions", guard, async (_req, res) => {
    res.json({ permissions: await listPermissions(pool) });
  });
  app.get("/api/admin/governance/permission-groups", guard, async (_req, res) => {
    res.json({ groups: await listGroups(pool) });
  });
  app.get("/api/admin/governance/role-hierarchy", guard, async (_req, res) => {
    res.json({ hierarchy: await listHierarchy(pool) });
  });

  // Grant / revoke (literal sub-paths under /roles before the :roleName param route).
  app.post("/api/admin/governance/roles/:roleId/grant", guard, async (req, res) => {
    const { permissionId } = req.body || {};
    if (!req.params.roleId || !permissionId) {
      return res.status(400).json({ error: "roleId and permissionId required" });
    }
    try {
      await grantPermission(pool, req.params.roleId, permissionId, actor(req));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "grant failed" });
    }
  });
  app.post("/api/admin/governance/roles/:roleId/revoke", guard, async (req, res) => {
    const { permissionId } = req.body || {};
    if (!req.params.roleId || !permissionId) {
      return res.status(400).json({ error: "roleId and permissionId required" });
    }
    try {
      await revokePermission(pool, req.params.roleId, permissionId, actor(req));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "revoke failed" });
    }
  });
  // Effective permissions for a role (param route last).
  app.get("/api/admin/governance/roles/:roleName/effective", guard, async (req, res) => {
    res.json(await resolveEffectivePermissions(pool, req.params.roleName));
  });

  // ---------------- WS3: Admin management ----------------
  app.get("/api/admin/governance/admins", guard, async (_req, res) => {
    res.json(await getAdminDirectory(pool));
  });
  app.post("/api/admin/governance/admins/:id/status", guard, async (req, res) => {
    const { status, reason } = req.body || {};
    if (!ADMIN_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${ADMIN_STATUSES.join(", ")}` });
    }
    try {
      const r = await setAdminStatus(pool, {
        adminUserId: req.params.id,
        status,
        reason: reason ?? null,
        changedBy: actor(req).id,
      });
      res.json({ ...r, note: "Advisory governance status. Live enforcement remains the super_admin gate." });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "status change failed" });
    }
  });

  // ---------------- WS5: Approval workflows ----------------
  app.get("/api/admin/governance/approvals", guard, async (req, res) => {
    res.json(
      await listApprovals(pool, {
        status: req.query.status as string | undefined,
        requestType: req.query.type as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      })
    );
  });
  app.post("/api/admin/governance/approvals", guard, async (req, res) => {
    const { requestType, targetRef, targetLabel, payload } = req.body || {};
    if (!(APPROVAL_TYPES as readonly string[]).includes(requestType)) {
      return res.status(400).json({ error: `requestType must be one of ${APPROVAL_TYPES.join(", ")}` });
    }
    try {
      const row = await createApprovalRequest(pool, {
        requestType,
        targetRef,
        targetLabel,
        payload,
        requestedBy: actor(req).id,
        requestedByEmail: actor(req).email,
      });
      res.status(201).json({ ok: true, request: row });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "create failed" });
    }
  });
  app.post("/api/admin/governance/approvals/:id/decide", guard, async (req, res) => {
    const { decision, reason } = req.body || {};
    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be approved or rejected" });
    }
    try {
      const r = await decideApproval(pool, {
        id: req.params.id,
        decision,
        decidedBy: actor(req).id,
        reason: reason ?? null,
      });
      if (!r.ok) return res.status(409).json(r); // fail-closed on non-pending
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || "decision failed" });
    }
  });

  // ---------------- WS4: Audit trail ----------------
  app.get("/api/admin/governance/audit", guard, async (req, res) => {
    res.json(
      await queryAuditEvents(pool, {
        category: req.query.category as string | undefined,
        targetType: req.query.target as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      })
    );
  });
  app.get("/api/admin/governance/failed-logins", guard, async (req, res) => {
    res.json({ failedLogins: await queryFailedLogins(pool, req.query.limit ? Number(req.query.limit) : 200) });
  });

  // ---------------- WS6: Security center ----------------
  app.get("/api/admin/governance/security-overview", guard, async (_req, res) => {
    res.json(await buildSecurityOverview(pool));
  });
  app.get("/api/admin/governance/flag-changes", guard, async (req, res) => {
    res.json({ flagChanges: await listFlagChanges(pool, req.query.limit ? Number(req.query.limit) : 200) });
  });
  // Record a flag change (audit surface only; does not toggle the flag).
  app.post("/api/admin/governance/flag-changes", guard, async (req, res) => {
    const { flagKey, oldValue, newValue, note } = req.body || {};
    if (!flagKey) return res.status(400).json({ error: "flagKey required" });
    await recordFlagChange(pool, {
      flagKey,
      oldValue,
      newValue,
      changedBy: actor(req).id,
      changedByEmail: actor(req).email,
      note,
    });
    res.status(201).json({ ok: true });
  });
}
