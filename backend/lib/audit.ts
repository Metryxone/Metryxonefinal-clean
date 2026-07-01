/**
 * Unified Audit Writer
 *
 * Single canonical function for writing audit events to `capadex_audit_events`.
 * All admin action handlers import from here instead of writing raw SQL directly.
 */
import type { Pool } from 'pg';
import { redactJson } from './redact';

// ── Canonical event-type registry ─────────────────────────────────────────────
export const AUDIT_EVENT = {
  REPORT_SCORE_OVERRIDE:     'report_score_override',
  REPORT_STATUS_CHANGE:      'report_status_change',
  RISK_FLAG_RESOLVED:        'risk_flag_resolved',
  INTERVENTION_CREATED:      'intervention_created',
  INTERVENTION_UPDATED:      'intervention_updated',
  CONCERN_CATEGORY_UPDATED:  'concern_category_updated',
  USER_ROLE_CHANGED:         'user_role_changed',
  ASSESSMENT_COMPLETED:      'assessment_completed',
  SCORE_COMPUTED:            'score_computed',
  USAGE_QUOTA_CHANGED:       'usage_quota_changed',
} as const;

export type AuditEventType = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

export interface AuditEventInput {
  event_type:  AuditEventType | string;
  actor:       string;
  user_id?:    string | null;
  session_id?: string | null;
  payload?:    Record<string, unknown>;
}

/**
 * Write a single audit event to `capadex_audit_events`.
 * Non-throwing — logs errors but never crashes the caller.
 */
export async function writeAuditEvent(
  pool: Pool,
  event: AuditEventInput,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO capadex_audit_events
         (event_type, actor, user_id, session_id, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        event.event_type,
        event.actor || 'system',
        event.user_id   ?? null,
        event.session_id ?? null,
        redactJson(event.payload ?? {}) ?? '{}',
      ],
    );
  } catch (err) {
    console.error('[audit] writeAuditEvent error:', err);
  }
}
