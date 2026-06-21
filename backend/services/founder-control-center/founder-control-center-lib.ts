/**
 * Phase 6.15 — Founder Control Center shared helpers (READ-ONLY, never-throws).
 * Probe-then-read primitives so every engine degrades to honest null on an absent/unreadable
 * source — never a fabricated 0. A present-but-empty source legitimately yields 0.
 */
import pg from 'pg';

export const PAID_STATUSES = ['paid', 'captured', 'success', 'completed'];

/** Returns a numeric scalar (first column of first row) or null on error / SQL NULL / no rows. */
export async function safeScalar(pool: pg.Pool, sql: string, params: any[] = []): Promise<number | null> {
  try {
    const r = await pool.query(sql, params);
    if (!r.rows.length) return null;
    const v = (r.rows[0] as any)[Object.keys(r.rows[0])[0]];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

/** Returns an ISO timestamp scalar or null on error / SQL NULL / no rows. */
export async function safeTimestamp(pool: pg.Pool, sql: string, params: any[] = []): Promise<string | null> {
  try {
    const r = await pool.query(sql, params);
    if (!r.rows.length) return null;
    const v = (r.rows[0] as any)[Object.keys(r.rows[0])[0]];
    if (v == null) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
}

export async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

export async function presenceMap(pool: pg.Pool, tables: string[]): Promise<Map<string, boolean>> {
  const uniq = Array.from(new Set(tables));
  const m = new Map<string, boolean>();
  await Promise.all(uniq.map(async (t) => m.set(t, await tableExists(pool, t))));
  return m;
}

/** Ratio → 0..100 percent, or null when the denominator is absent/zero (unmeasurable). */
export function ratioPct(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  const pct = (numerator / denominator) * 100;
  if (!Number.isFinite(pct)) return null;
  return clampScore(pct);
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export type Direction = 'up' | 'down' | 'flat' | null;

export interface Trend {
  current: number | null;
  previous: number | null;
  delta_pct: number | null;
  direction: Direction;
}

/** Honest period-over-period trend. delta_pct is null when previous is null/0 (no safe base). */
export function buildTrend(current: number | null, previous: number | null): Trend {
  let delta_pct: number | null = null;
  let direction: Direction = null;
  if (current != null && previous != null) {
    direction = current > previous ? 'up' : current < previous ? 'down' : 'flat';
    if (previous > 0) delta_pct = Math.round(((current - previous) / previous) * 1000) / 10;
  }
  return { current, previous, delta_pct, direction };
}

/** Average of only the measurable component scores; null when none are measurable. */
export function meanMeasurable(values: (number | null)[]): number | null {
  const measured = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!measured.length) return null;
  return clampScore(measured.reduce((a, b) => a + b, 0) / measured.length);
}

export type HealthBand = 'healthy' | 'watch' | 'at_risk' | 'unmeasurable';

export function healthBand(score: number | null): HealthBand {
  if (score == null) return 'unmeasurable';
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'watch';
  return 'at_risk';
}
