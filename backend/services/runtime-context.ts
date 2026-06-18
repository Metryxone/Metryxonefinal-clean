/**
 * runtime-context.ts — Orchestration Context derivation + persistence.
 *
 * Maps the user-facing (persona, assesseeType, age) tuple onto the formal
 * `capadex_runtime_sessions` row contract used by downstream orchestration
 * (FSM state machine, question pickers that need actor-vs-target awareness,
 * future safety/relief routing).
 *
 * Mapping rules (small, explicit, append-only):
 *   ┌───────────────┬──────────────────┬───────────┬───────────────┬───────────────────┐
 *   │ persona       │ assesseeType     │ actor     │ target        │ relationship_type │
 *   ├───────────────┼──────────────────┼───────────┼───────────────┼───────────────────┤
 *   │ parent        │ my-child         │ PARENT    │ STUDENT       │ parent_child      │
 *   │ teacher       │ a-student        │ TEACHER   │ STUDENT       │ teacher_student   │
 *   │ counsellor    │ someone-else     │ COUNSELLOR│ CLIENT        │ counsellor_client │
 *   │ corporate     │ someone-else     │ MANAGER   │ REPORT        │ manager_report    │
 *   │ *             │ myself           │ <persona> │ <persona>     │ self              │
 *   │ *             │ (anything else)  │ <persona> │ <persona>     │ direct            │
 *   └───────────────┴──────────────────┴───────────┴───────────────┴───────────────────┘
 *
 * The persist step is best-effort: if the table is missing or the DB call
 * fails, we log and return null — the analyze endpoint must never 500 on
 * an orchestration-context write failure. The derived envelope is always
 * returned to the client regardless, so the funnel keeps moving.
 */

import type { Pool } from 'pg';

export type AssesseeType = 'myself' | 'my-child' | 'a-student' | 'someone-else' | string | null | undefined;

export interface RuntimeContext {
  actor_persona: string;
  target_persona: string;
  relationship_type: string;
  target_age: number | null;
}

export interface PersistedRuntimeContext extends RuntimeContext {
  id?: number;
  session_id?: string | null;
  persisted: boolean;
}

const norm = (s: string | null | undefined) => (s ?? '').toString().trim().toUpperCase();

export function deriveRuntimeContext(input: {
  persona?: string | null;
  assesseeType?: AssesseeType;
  age?: number | null;
}): RuntimeContext {
  const persona = norm(input.persona) || 'SELF';
  const assessee = (input.assesseeType ?? '').toString().trim().toLowerCase();

  // Explicit on-behalf paths
  if (persona === 'PARENT' && assessee === 'my-child') {
    return { actor_persona: 'PARENT', target_persona: 'STUDENT', relationship_type: 'parent_child', target_age: input.age ?? null };
  }
  if (persona === 'TEACHER' && assessee === 'a-student') {
    return { actor_persona: 'TEACHER', target_persona: 'STUDENT', relationship_type: 'teacher_student', target_age: input.age ?? null };
  }
  if (persona === 'COUNSELLOR' && assessee === 'someone-else') {
    return { actor_persona: 'COUNSELLOR', target_persona: 'CLIENT', relationship_type: 'counsellor_client', target_age: input.age ?? null };
  }
  if (persona === 'CORPORATE' && assessee === 'someone-else') {
    return { actor_persona: 'MANAGER', target_persona: 'REPORT', relationship_type: 'manager_report', target_age: input.age ?? null };
  }

  // Self-paths
  if (assessee === 'myself' || assessee === '') {
    return { actor_persona: persona, target_persona: persona, relationship_type: 'self', target_age: input.age ?? null };
  }

  // Unmapped combo — keep actor=target so downstream pickers don't mis-route.
  return { actor_persona: persona, target_persona: persona, relationship_type: 'direct', target_age: input.age ?? null };
}

/**
 * Insert one row into `capadex_runtime_sessions`. Returns the row id + the
 * `persisted` flag. Never throws — caller can ignore failure safely.
 *
 * `sessionId` is optional: the analyze endpoint is called BEFORE a capadex
 * session row exists for many flows, so the FK column is left null in that
 * case (the underlying column is nullable).
 */
export async function persistRuntimeContext(
  pool: Pool | undefined,
  ctx: RuntimeContext,
  sessionId?: string | null,
): Promise<PersistedRuntimeContext> {
  if (!pool) {
    return { ...ctx, session_id: sessionId ?? null, persisted: false };
  }
  try {
    const result = await pool.query(
      `INSERT INTO capadex_runtime_sessions
         (session_id, actor_persona, target_persona, relationship_type, target_age, fsm_state)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        sessionId ?? null,
        ctx.actor_persona,
        ctx.target_persona,
        ctx.relationship_type,
        ctx.target_age,
        'analyzed',
      ],
    );
    return {
      ...ctx,
      id: result.rows?.[0]?.id,
      session_id: sessionId ?? null,
      persisted: true,
    };
  } catch (err) {
    // Hardened: this helper MUST never throw — callers treat persistence as
    // best-effort. Defensive .message extraction handles non-Error throws
    // (e.g. raw strings, nulls) without re-raising.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[runtime-context] persist skipped:', msg);
    return { ...ctx, session_id: sessionId ?? null, persisted: false };
  }
}
