// ============================================================
// Governance / RBAC — canonical SYSTEM seed (Critical Gaps #2 & #3)
// ------------------------------------------------------------
// Idempotent (ON CONFLICT) seed of the canonical role/permission model. These
// are SYSTEM CONFIGURATION rows (not demo/usage data): the 10 platform roles,
// the atomic permissions, logical permission groups, per-role grants and the
// role hierarchy. Seeding them is exactly what closes Gap #2 (role_definitions=0).
//
// Only ever called behind the governanceRbacV2 flag. Re-running is safe: every
// insert is conflict-guarded so counts never inflate.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";

// --- 10 canonical system roles (higher level = broader authority) ---
const ROLES: { name: string; display: string; level: number; description: string }[] = [
  { name: "super_admin", display: "Super Admin", level: 100, description: "Unrestricted platform owner. Holds every permission." },
  { name: "platform_admin", display: "Platform Admin", level: 90, description: "Operates the platform: users, billing, content, configuration." },
  { name: "institution_admin", display: "Institution Admin", level: 70, description: "Administers a single institution: its faculty, students and assessments." },
  { name: "employer_admin", display: "Employer Admin", level: 70, description: "Administers a single employer: recruiters, jobs and candidates." },
  { name: "recruiter", display: "Recruiter", level: 50, description: "Manages job postings and reviews candidates." },
  { name: "faculty", display: "Faculty", level: 50, description: "Manages cohorts and reviews student assessments." },
  { name: "assessor", display: "Assessor", level: 40, description: "Administers and scores assessments." },
  { name: "counselor", display: "Counselor", level: 40, description: "Guides students/candidates; reads reports, no destructive actions." },
  { name: "student", display: "Student", level: 10, description: "End user taking assessments and viewing their own results." },
  { name: "candidate", display: "Candidate", level: 10, description: "Job seeker maintaining a profile and applying to roles." },
];

// --- Atomic permissions, grouped by resource. key = "<resource>.<action>" ---
const PERMS: { resource: string; action: string; display: string; category: string }[] = [
  // platform / users
  { resource: "users", action: "view", display: "View users", category: "platform" },
  { resource: "users", action: "create", display: "Create users", category: "platform" },
  { resource: "users", action: "update", display: "Update users", category: "platform" },
  { resource: "users", action: "delete", display: "Delete users", category: "platform" },
  { resource: "users", action: "suspend", display: "Suspend / activate users", category: "platform" },
  // rbac
  { resource: "roles", action: "view", display: "View roles", category: "rbac" },
  { resource: "roles", action: "create", display: "Create / edit roles", category: "rbac" },
  { resource: "roles", action: "assign", display: "Assign roles to users", category: "rbac" },
  { resource: "permissions", action: "view", display: "View permissions", category: "rbac" },
  { resource: "permissions", action: "grant", display: "Grant permissions", category: "rbac" },
  { resource: "permissions", action: "revoke", display: "Revoke permissions", category: "rbac" },
  // billing
  { resource: "payments", action: "view", display: "View payments", category: "billing" },
  { resource: "payments", action: "refund", display: "Issue refunds", category: "billing" },
  { resource: "invoices", action: "view", display: "View invoices", category: "billing" },
  { resource: "invoices", action: "override", display: "Override invoices", category: "billing" },
  { resource: "subscriptions", action: "view", display: "View subscriptions", category: "billing" },
  { resource: "subscriptions", action: "change", display: "Change subscriptions", category: "billing" },
  { resource: "subscriptions", action: "cancel", display: "Cancel subscriptions", category: "billing" },
  // assessments
  { resource: "assessments", action: "view", display: "View assessments", category: "assessment" },
  { resource: "assessments", action: "manage", display: "Configure assessments", category: "assessment" },
  { resource: "assessments", action: "score", display: "Score assessments", category: "assessment" },
  { resource: "assessments", action: "take", display: "Take assessments", category: "assessment" },
  // reports
  { resource: "reports", action: "view", display: "View reports", category: "reporting" },
  { resource: "reports", action: "publish", display: "Publish reports", category: "reporting" },
  { resource: "reports", action: "export", display: "Export reports", category: "reporting" },
  // institution / employer
  { resource: "institutions", action: "view", display: "View institutions", category: "org" },
  { resource: "institutions", action: "manage", display: "Manage institution", category: "org" },
  { resource: "cohorts", action: "manage", display: "Manage cohorts", category: "org" },
  { resource: "employers", action: "view", display: "View employers", category: "org" },
  { resource: "employers", action: "manage", display: "Manage employer", category: "org" },
  { resource: "jobs", action: "view", display: "View jobs", category: "talent" },
  { resource: "jobs", action: "manage", display: "Manage job postings", category: "talent" },
  { resource: "candidates", action: "view", display: "View candidates", category: "talent" },
  { resource: "candidates", action: "manage", display: "Manage candidates", category: "talent" },
  // self
  { resource: "profile", action: "view", display: "View own profile", category: "self" },
  { resource: "profile", action: "update", display: "Update own profile", category: "self" },
  { resource: "applications", action: "manage", display: "Manage own applications", category: "self" },
  // governance / security
  { resource: "audit", action: "view", display: "View audit trail", category: "governance" },
  { resource: "security", action: "view", display: "View security center", category: "governance" },
  { resource: "feature_flags", action: "view", display: "View feature flags", category: "governance" },
  { resource: "feature_flags", action: "change", display: "Change feature flags", category: "governance" },
  { resource: "approvals", action: "view", display: "View approval requests", category: "governance" },
  { resource: "approvals", action: "request", display: "Submit approval requests", category: "governance" },
  { resource: "approvals", action: "decide", display: "Decide approval requests", category: "governance" },
];

const GROUPS: { key: string; display: string; description: string; match: (p: { resource: string; category: string }) => boolean }[] = [
  { key: "platform_management", display: "Platform Management", description: "User & account administration.", match: (p) => p.category === "platform" },
  { key: "access_control", display: "Access Control", description: "Roles & permissions.", match: (p) => p.category === "rbac" },
  { key: "billing_operations", display: "Billing Operations", description: "Payments, invoices, subscriptions.", match: (p) => p.category === "billing" },
  { key: "assessment_operations", display: "Assessment Operations", description: "Assessment configuration & scoring.", match: (p) => p.category === "assessment" },
  { key: "reporting", display: "Reporting", description: "Reports & exports.", match: (p) => p.category === "reporting" },
  { key: "talent_operations", display: "Talent Operations", description: "Jobs & candidates.", match: (p) => p.category === "talent" },
  { key: "org_administration", display: "Org Administration", description: "Institutions, employers, cohorts.", match: (p) => p.category === "org" },
  { key: "governance_security", display: "Governance & Security", description: "Audit, security, flags, approvals.", match: (p) => p.category === "governance" },
];

// Per-role permission grants by permission key. super_admin = ALL (handled below).
const ROLE_GRANTS: Record<string, string[]> = {
  platform_admin: [
    "users.view", "users.create", "users.update", "users.suspend",
    "roles.view", "roles.assign", "permissions.view",
    "payments.view", "payments.refund", "invoices.view", "invoices.override",
    "subscriptions.view", "subscriptions.change", "subscriptions.cancel",
    "assessments.view", "assessments.manage", "reports.view", "reports.publish", "reports.export",
    "institutions.view", "institutions.manage", "employers.view", "employers.manage",
    "jobs.view", "jobs.manage", "candidates.view", "candidates.manage",
    "audit.view", "security.view", "feature_flags.view", "approvals.view", "approvals.decide",
  ],
  institution_admin: [
    "users.view", "users.create", "users.update", "roles.assign",
    "assessments.view", "assessments.manage", "assessments.score",
    "reports.view", "reports.publish", "reports.export",
    "institutions.view", "institutions.manage", "cohorts.manage",
    "subscriptions.view", "invoices.view", "approvals.request",
  ],
  employer_admin: [
    "users.view", "users.create", "users.update", "roles.assign",
    "employers.view", "employers.manage", "jobs.view", "jobs.manage",
    "candidates.view", "candidates.manage", "reports.view", "reports.export",
    "subscriptions.view", "invoices.view", "approvals.request",
  ],
  recruiter: [
    "jobs.view", "jobs.manage", "candidates.view", "candidates.manage",
    "reports.view", "reports.export", "profile.view", "profile.update",
  ],
  faculty: [
    "cohorts.manage", "assessments.view", "assessments.score",
    "reports.view", "reports.export", "candidates.view", "profile.view", "profile.update",
  ],
  assessor: [
    "assessments.view", "assessments.manage", "assessments.score",
    "reports.view", "profile.view", "profile.update",
  ],
  counselor: [
    "assessments.view", "reports.view", "candidates.view", "profile.view", "profile.update",
  ],
  student: [
    "assessments.view", "assessments.take", "reports.view",
    "profile.view", "profile.update",
  ],
  candidate: [
    "jobs.view", "candidates.view", "applications.manage",
    "profile.view", "profile.update",
  ],
};

// Hierarchy: parent inherits the permissions of the child.
const HIERARCHY: [string, string][] = [
  ["super_admin", "platform_admin"],
  ["platform_admin", "institution_admin"],
  ["platform_admin", "employer_admin"],
  ["institution_admin", "faculty"],
  ["institution_admin", "assessor"],
  ["institution_admin", "counselor"],
  ["employer_admin", "recruiter"],
  ["faculty", "student"],
  ["recruiter", "candidate"],
];

export interface SeedResult {
  roles: number;
  permissions: number;
  groups: number;
  groupMembers: number;
  grants: number;
  hierarchyEdges: number;
}

export async function seedRbac(pool: Pool): Promise<SeedResult> {
  await ensureGovernanceSchema(pool);

  // Roles
  for (const r of ROLES) {
    await pool.query(
      `INSERT INTO role_definitions (role_name, display_name, description, level, is_system, is_active)
       VALUES ($1,$2,$3,$4,true,true)
       ON CONFLICT (role_name) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         description = EXCLUDED.description,
         level = EXCLUDED.level,
         is_system = true,
         updated_at = now()`,
      [r.name, r.display, r.description, r.level]
    );
  }

  // Permissions
  for (const p of PERMS) {
    const key = `${p.resource}.${p.action}`;
    await pool.query(
      `INSERT INTO permission_definitions (permission_key, display_name, description, category, resource, action, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)
       ON CONFLICT (permission_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         category = EXCLUDED.category,
         resource = EXCLUDED.resource,
         action = EXCLUDED.action`,
      [key, p.display, p.display, p.category, p.resource, p.action]
    );
  }

  // Resolve id maps
  const roleRows = (await pool.query(`SELECT id, role_name FROM role_definitions`)).rows;
  const permRows = (await pool.query(`SELECT id, permission_key, resource, category FROM permission_definitions`)).rows;
  const roleId = new Map<string, string>(roleRows.map((r: any) => [r.role_name, r.id]));
  const permId = new Map<string, string>(permRows.map((p: any) => [p.permission_key, p.id]));

  // Permission groups + members
  let groupMembers = 0;
  for (const g of GROUPS) {
    await pool.query(
      `INSERT INTO rbac_permission_groups (group_key, display_name, description)
       VALUES ($1,$2,$3)
       ON CONFLICT (group_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description`,
      [g.key, g.display, g.description]
    );
    const gid = (await pool.query(`SELECT id FROM rbac_permission_groups WHERE group_key=$1`, [g.key])).rows[0]?.id;
    if (!gid) continue;
    for (const p of permRows) {
      if (g.match({ resource: p.resource, category: p.category })) {
        const r = await pool.query(
          `INSERT INTO rbac_permission_group_members (group_id, permission_id)
           VALUES ($1,$2) ON CONFLICT (group_id, permission_id) DO NOTHING`,
          [gid, p.id]
        );
        groupMembers += r.rowCount || 0;
      }
    }
  }

  // Grants. super_admin gets ALL permissions; others per ROLE_GRANTS.
  let grants = 0;
  const grantPair = async (rid: string, pid: string) => {
    const r = await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id, granted_by)
       VALUES ($1,$2,'system-seed') ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [rid, pid]
    );
    grants += r.rowCount || 0;
  };
  const superId = roleId.get("super_admin");
  if (superId) {
    for (const p of permRows) await grantPair(superId, p.id);
  }
  for (const [roleName, keys] of Object.entries(ROLE_GRANTS)) {
    const rid = roleId.get(roleName);
    if (!rid) continue;
    for (const k of keys) {
      const pid = permId.get(k);
      if (pid) await grantPair(rid, pid);
    }
  }

  // Hierarchy edges
  let hierarchyEdges = 0;
  for (const [parent, child] of HIERARCHY) {
    const pid = roleId.get(parent);
    const cid = roleId.get(child);
    if (!pid || !cid) continue;
    const r = await pool.query(
      `INSERT INTO rbac_role_hierarchies (parent_role_id, child_role_id)
       VALUES ($1,$2) ON CONFLICT (parent_role_id, child_role_id) DO NOTHING`,
      [pid, cid]
    );
    hierarchyEdges += r.rowCount || 0;
  }

  return {
    roles: ROLES.length,
    permissions: PERMS.length,
    groups: GROUPS.length,
    groupMembers,
    grants,
    hierarchyEdges,
  };
}

export const RBAC_CANON = { ROLES, PERMS, GROUPS, ROLE_GRANTS, HIERARCHY };
