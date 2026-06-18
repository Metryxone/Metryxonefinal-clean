/**
 * CAPADEX WC-L5 — Memory Retrieval Engine (read-only).
 *
 * Pure, read-only accessors over `wcl5_memory`. NO intelligence generation, NO scoring, NO writes,
 * NO schema DDL (a missing table ⇒ empty result, never created here — creation is the persist path's
 * job, gated by the flag). Every function never throws: any error ⇒ empty array.
 *
 * Provided views:
 *   • getLatestMemory(email)   — the most recent value remembered for each (memory_type, memory_key).
 *   • getMemoryTimeline(email) — every memory row for a user, ordered by the session's completion time
 *                                (cross-session continuity / recall surface).
 *   • getMemoryByType(type)    — every row of a memory type (optionally scoped to one user).
 *   • getMemoryByUser(email)   — every memory row for a user.
 */
import type { Pool } from 'pg';
import type { MemoryType } from './memory-registry';

export interface StoredMemoryRow {
  id: number;
  session_id: string;
  user_email: string | null;
  memory_type: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  source: string;
  confidence: number | null;
  created_at: string;
  updated_at: string;
  /** Present only on the timeline view (joined session completion time). */
  session_created_at?: string | null;
}

/** Every memory row for a user (chronological by snapshot creation). */
export async function getMemoryByUser(pool: Pool, email: string): Promise<StoredMemoryRow[]> {
  if (!email) return [];
  try {
    const { rows } = await pool.query<StoredMemoryRow>(
      `SELECT * FROM wcl5_memory
        WHERE LOWER(user_email) = LOWER($1)
        ORDER BY created_at ASC, memory_type, memory_key`,
      [email],
    );
    return rows;
  } catch {
    return [];
  }
}

/** Every row of a given memory type, optionally scoped to a single user. */
export async function getMemoryByType(
  pool: Pool,
  memoryType: MemoryType,
  email?: string,
): Promise<StoredMemoryRow[]> {
  try {
    if (email) {
      const { rows } = await pool.query<StoredMemoryRow>(
        `SELECT * FROM wcl5_memory
          WHERE memory_type = $1 AND LOWER(user_email) = LOWER($2)
          ORDER BY created_at ASC, memory_key`,
        [memoryType, email],
      );
      return rows;
    }
    const { rows } = await pool.query<StoredMemoryRow>(
      `SELECT * FROM wcl5_memory
        WHERE memory_type = $1
        ORDER BY created_at ASC, memory_key`,
      [memoryType],
    );
    return rows;
  } catch {
    return [];
  }
}

/**
 * The latest value remembered for each (memory_type, memory_key) for a user — i.e. "what do we
 * currently remember about this person", collapsing across their session history to the freshest row.
 */
export async function getLatestMemory(pool: Pool, email: string): Promise<StoredMemoryRow[]> {
  if (!email) return [];
  try {
    const { rows } = await pool.query<StoredMemoryRow>(
      `SELECT DISTINCT ON (memory_type, memory_key) *
         FROM wcl5_memory
        WHERE LOWER(user_email) = LOWER($1)
        ORDER BY memory_type, memory_key, created_at DESC, updated_at DESC`,
      [email],
    );
    return rows;
  } catch {
    return [];
  }
}

/**
 * Every memory row for a user across all sessions, ordered by the originating session's completion
 * time — the cross-session recall surface (earlier-session memory remains retrievable at a later one).
 */
export async function getMemoryTimeline(pool: Pool, email: string): Promise<StoredMemoryRow[]> {
  if (!email) return [];
  try {
    const { rows } = await pool.query<StoredMemoryRow>(
      `SELECT m.*, s.created_at AS session_created_at
         FROM wcl5_memory m
         LEFT JOIN capadex_sessions s ON s.id = m.session_id
        WHERE LOWER(m.user_email) = LOWER($1)
        ORDER BY s.created_at ASC NULLS LAST, m.session_id, m.memory_type, m.memory_key`,
      [email],
    );
    return rows;
  } catch {
    return [];
  }
}
