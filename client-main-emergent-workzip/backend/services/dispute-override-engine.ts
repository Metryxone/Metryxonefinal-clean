/**
 * Phase 5 — Dispute & Human Override workflow.
 *
 * Lifecycle:
 *   open → in_review → (resolved_upheld | resolved_overturned | withdrawn)
 * Overturn may attach a wos_human_overrides record (field-level correction).
 * All transitions audit-logged via wos_audit_logs.
 */

import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export const DISPUTE_OVERRIDE_VERSION = '5.0.0';

export type DisputeStatus =
  'open' | 'in_review' | 'resolved_upheld' | 'resolved_overturned' | 'withdrawn';
export type DisputeSubject =
  'recommendation' | 'benchmark_score' | 'mobility_score' | 'assessment_result' | 'intervention';
export type ReasonCode = 'inaccurate' | 'unfair' | 'privacy' | 'irrelevant' | 'other';

const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open:                ['in_review', 'withdrawn'],
  in_review:           ['resolved_upheld', 'resolved_overturned', 'withdrawn'],
  resolved_upheld:     [],
  resolved_overturned: [],
  withdrawn:           [],
};

export function canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function fileDispute(pool: Pool, args: {
  user_id: string; tenant_id?: number | null;
  subject_type: DisputeSubject; subject_ref: string;
  reason_code: ReasonCode; description?: string;
}): Promise<{ id: string }> {
  const id = `disp_${randomUUID().slice(0, 12)}`;
  await pool.query(
    `INSERT INTO wos_disputes
       (id, user_id, tenant_id, subject_type, subject_ref, reason_code, description, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open')`,
    [id, args.user_id, args.tenant_id ?? null,
     args.subject_type, args.subject_ref, args.reason_code, args.description ?? null]);
  return { id };
}

export async function getDispute(pool: Pool, id: string) {
  const { rows } = await pool.query(
    `SELECT id, user_id, tenant_id, subject_type, subject_ref, reason_code, description,
            status, resolution, reviewer_id, override_applied, override_payload,
            created_at, updated_at
       FROM wos_disputes WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listDisputes(pool: Pool, opts: {
  status?: DisputeStatus; tenant_id?: number; user_id?: string; limit?: number;
} = {}) {
  const where: string[] = []; const params: any[] = [];
  if (opts.status)    { params.push(opts.status);    where.push(`status = $${params.length}`); }
  if (opts.tenant_id != null) { params.push(opts.tenant_id); where.push(`tenant_id = $${params.length}`); }
  if (opts.user_id)   { params.push(opts.user_id);   where.push(`user_id = $${params.length}`); }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const { rows } = await pool.query(`
    SELECT id, user_id, tenant_id, subject_type, subject_ref, reason_code, description,
           status, resolution, reviewer_id, override_applied, created_at, updated_at
      FROM wos_disputes
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY
       CASE status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT ${limit}
  `, params);
  return rows;
}

/** Transition a dispute through its workflow. Optionally apply a human override. */
export async function transitionDispute(pool: Pool, args: {
  dispute_id: string; to_status: DisputeStatus;
  reviewer_id: string; resolution?: string;
  override?: { subject_type: string; subject_ref: string; field_path: string;
               prior_value: unknown; new_value: unknown; justification: string;
               expires_at?: string | null };
}): Promise<{ ok: true; status: DisputeStatus; override_id?: number } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ status: DisputeStatus }>(
      `SELECT status FROM wos_disputes WHERE id = $1 FOR UPDATE`, [args.dispute_id]);
    if (!rows[0]) { await client.query('ROLLBACK'); return { ok: false, error: 'not_found' }; }
    const cur = rows[0].status;
    if (!canTransition(cur, args.to_status)) {
      await client.query('ROLLBACK');
      return { ok: false, error: `invalid_transition_${cur}_to_${args.to_status}` };
    }

    let overrideId: number | undefined;
    let overrideApplied = false;
    if (args.to_status === 'resolved_overturned' && args.override) {
      overrideApplied = true;
      const o = args.override;
      const { rows: oRows } = await client.query<{ id: number }>(
        `INSERT INTO wos_human_overrides
           (dispute_id, subject_type, subject_ref, field_path, prior_value, new_value,
            reviewer_id, justification, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [args.dispute_id, o.subject_type, o.subject_ref, o.field_path,
         JSON.stringify(o.prior_value ?? null), JSON.stringify(o.new_value ?? null),
         args.reviewer_id, o.justification, o.expires_at ?? null],
      );
      overrideId = Number(oRows[0].id);
    }

    await client.query(
      `UPDATE wos_disputes
          SET status = $1, reviewer_id = $2, resolution = COALESCE($3, resolution),
              override_applied = $4, updated_at = NOW()
        WHERE id = $5`,
      [args.to_status, args.reviewer_id, args.resolution ?? null,
       overrideApplied || undefined, args.dispute_id],
    );
    await client.query('COMMIT');
    return { ok: true, status: args.to_status, override_id: overrideId };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function listOverrides(pool: Pool, opts: {
  subject_type?: string; subject_ref?: string; active?: boolean; limit?: number;
} = {}) {
  const where: string[] = []; const params: any[] = [];
  if (opts.subject_type) { params.push(opts.subject_type); where.push(`subject_type = $${params.length}`); }
  if (opts.subject_ref)  { params.push(opts.subject_ref);  where.push(`subject_ref = $${params.length}`); }
  if (opts.active != null) { params.push(opts.active);     where.push(`active = $${params.length}`); }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const { rows } = await pool.query(`
    SELECT id, dispute_id, subject_type, subject_ref, field_path,
           prior_value, new_value, reviewer_id, justification, expires_at, active, applied_at
      FROM wos_human_overrides
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY applied_at DESC
     LIMIT ${limit}
  `, params);
  return rows;
}

/** Apply override field substitutions to an arbitrary payload. */
export function applyOverridesToPayload<T extends Record<string, any>>(
  payload: T,
  overrides: Array<{ field_path: string; new_value: unknown; active: boolean; expires_at: string | null }>,
): { payload: T; applied_paths: string[] } {
  const applied: string[] = [];
  const out: any = JSON.parse(JSON.stringify(payload));
  const now = Date.now();
  for (const o of overrides) {
    if (!o.active) continue;
    if (o.expires_at && new Date(o.expires_at).getTime() < now) continue;
    setByPath(out, o.field_path, o.new_value);
    applied.push(o.field_path);
  }
  return { payload: out as T, applied_paths: applied };
}

function setByPath(obj: any, path: string, value: unknown) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
