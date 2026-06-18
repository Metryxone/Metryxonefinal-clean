// ============================================================
// Governance / Feature-flag change log (Critical Gap #3 — WS6)
// ------------------------------------------------------------
// Records operator-initiated feature-flag changes into rbac_flag_change_log and
// reads them back for the security center. Recording never throws; reads degrade
// to empty. This is the audit surface for flag changes — it does NOT toggle flags.
// ============================================================

import type { Pool } from "pg";
import { ensureGovernanceSchema } from "./rbac-schema";

export async function recordFlagChange(
  pool: Pool,
  d: {
    flagKey: string;
    oldValue?: string | boolean | null;
    newValue?: string | boolean | null;
    changedBy?: string | null;
    changedByEmail?: string | null;
    note?: string | null;
  }
): Promise<void> {
  try {
    await ensureGovernanceSchema(pool);
    await pool.query(
      `INSERT INTO rbac_flag_change_log (flag_key, old_value, new_value, changed_by, changed_by_email, note)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        d.flagKey,
        d.oldValue == null ? null : String(d.oldValue),
        d.newValue == null ? null : String(d.newValue),
        d.changedBy ?? null,
        d.changedByEmail ?? null,
        (d.note ?? "").slice(0, 500) || null,
      ]
    );
  } catch {
    /* never throw */
  }
}

export async function listFlagChanges(pool: Pool, limit = 200): Promise<any[]> {
  try {
    await ensureGovernanceSchema(pool);
    const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    return (
      await pool.query(
        `SELECT id, flag_key, old_value, new_value, changed_by, changed_by_email, note, created_at
         FROM rbac_flag_change_log ORDER BY created_at DESC LIMIT $1`,
        [lim]
      )
    ).rows;
  } catch {
    return [];
  }
}
