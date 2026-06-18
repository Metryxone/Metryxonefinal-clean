/**
 * Behavioural Memory Service — Phase 2.
 *
 * Persists `SignalScore[]` snapshots + evidence + contradictions and exposes
 * evolution queries that the Career Velocity tab and Stage Guidance surface
 * consume. Append-only — never mutates prior snapshots.
 *
 * Tables (see `backend/migrations/20260521_behavioural_signals_phase2.sql`):
 *   - bsig_signal_snapshots        (one row per signal per snapshot)
 *   - bsig_evidence                (top evidence hits)
 *   - bsig_contradiction_history   (flagged developmental gaps)
 *   - bsig_audit_logs              (event log)
 */

import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import type { SignalScore, EvidenceHit } from './behavioral-signal-engine.js';
import type { EvidenceSource } from './evidence-extractor.js';
import type { ContradictionResult } from './contradiction-detector.js';

export interface MemoryEvolutionPoint {
  signal_key: string;
  snapshot_ts: string;
  behavioural_strength: number;
  confidence: number;
  evidence_count: number;
}

export interface MemoryEvolutionSummary {
  signal_key: string;
  label: string;
  competency_id: string;
  points: MemoryEvolutionPoint[];
  /** Trend across the window: improving | steady | declining | insufficient. */
  trend: 'improving' | 'steady' | 'declining' | 'insufficient';
  delta_30d: number;
  delta_90d: number;
  maturity_band: 'emerging' | 'developing' | 'consistent' | 'mature';
}

export interface PersistBehaviouralSnapshotInput {
  user_id: string;
  scores: SignalScore[];
  sources: EvidenceSource[];
  contradictions?: ContradictionResult;
}

export async function persistBehaviouralSnapshot(
  pool: Pool,
  input: PersistBehaviouralSnapshotInput,
): Promise<{ snapshot_count: number; evidence_count: number; source_hash: string }> {
  const sourceHash = hashSources(input.sources);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let snapshotCount = 0;
    for (const s of input.scores) {
      await client.query(
        `INSERT INTO bsig_signal_snapshots
           (user_id, signal_key, competency_id, frequency, confidence,
            evidence_count, recency_weight, behavioural_strength, source_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [input.user_id, s.signal_key, s.competency_id, s.frequency, s.confidence,
         s.evidence_count, s.recency_weight, s.behavioural_strength, sourceHash],
      );
      snapshotCount++;
    }

    // Cap stored evidence to top 3 per signal (already trimmed in scoreSignal).
    let evidenceCount = 0;
    for (const s of input.scores) {
      for (const e of s.evidence) {
        await client.query(
          `INSERT INTO bsig_evidence
             (user_id, signal_key, source_type, source_id, snippet,
              match_strength, occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [input.user_id, s.signal_key, e.source_type, e.source_id, e.snippet,
           e.match_strength, e.occurred_at],
        );
        evidenceCount++;
      }
    }

    if (input.contradictions) {
      for (const f of input.contradictions.contradiction_flags) {
        await client.query(
          `INSERT INTO bsig_contradiction_history
             (user_id, contradiction_score, rule_id, severity, title, detail, source_ids)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [input.user_id, input.contradictions.contradiction_score, f.rule_id,
           f.severity, f.title, f.detail, JSON.stringify(f.source_ids ?? [])],
        );
      }
    }

    await client.query(
      `INSERT INTO bsig_audit_logs (user_id, event_type, payload)
       VALUES ($1, 'snapshot_persisted', $2::jsonb)`,
      [input.user_id, JSON.stringify({
        snapshot_count: snapshotCount,
        evidence_count: evidenceCount,
        source_count:   input.sources.length,
        source_hash:    sourceHash,
      })],
    );

    await client.query('COMMIT');
    return { snapshot_count: snapshotCount, evidence_count: evidenceCount, source_hash: sourceHash };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Pull evolution timelines for the user's signals over `windowDays`.
 * Returns one summary per distinct signal_key, with trend + maturity_band.
 */
export async function getBehaviouralEvolution(
  pool: Pool,
  userId: string,
  windowDays = 180,
): Promise<MemoryEvolutionSummary[]> {
  const { rows } = await pool.query<{
    signal_key: string; competency_id: string; snapshot_ts: string;
    behavioural_strength: string; confidence: string; evidence_count: number;
  }>(
    `SELECT signal_key, competency_id, snapshot_ts,
            behavioural_strength, confidence, evidence_count
       FROM bsig_signal_snapshots
      WHERE user_id = $1
        AND snapshot_ts > NOW() - ($2 || ' days')::interval
      ORDER BY signal_key, snapshot_ts ASC`,
    [userId, String(windowDays)],
  );

  // Lazy import to avoid circular deps
  const { SIGNALS_BY_KEY } = await import('./behavioral-signal-engine.js');

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = grouped.get(r.signal_key) ?? [];
    arr.push(r);
    grouped.set(r.signal_key, arr);
  }

  const out: MemoryEvolutionSummary[] = [];
  const now = Date.now();
  for (const [signal_key, pts] of grouped) {
    const points: MemoryEvolutionPoint[] = pts.map(p => ({
      signal_key,
      snapshot_ts: p.snapshot_ts,
      behavioural_strength: Number(p.behavioural_strength),
      confidence: Number(p.confidence),
      evidence_count: p.evidence_count,
    }));

    const latest = points[points.length - 1];
    const find = (daysAgo: number) => {
      const cutoff = now - daysAgo * 86_400_000;
      return [...points].reverse().find(p => Date.parse(p.snapshot_ts) <= cutoff);
    };
    const ref30 = find(30);
    const ref90 = find(90);
    const delta_30d = ref30 ? round3(latest.behavioural_strength - ref30.behavioural_strength) : 0;
    const delta_90d = ref90 ? round3(latest.behavioural_strength - ref90.behavioural_strength) : 0;

    const trend: MemoryEvolutionSummary['trend'] =
      points.length < 2          ? 'insufficient' :
      delta_30d >  0.05          ? 'improving'    :
      delta_30d < -0.05          ? 'declining'    : 'steady';

    const m = latest.behavioural_strength;
    const maturity_band: MemoryEvolutionSummary['maturity_band'] =
      m >= 0.75 ? 'mature'     :
      m >= 0.55 ? 'consistent' :
      m >= 0.35 ? 'developing' : 'emerging';

    const def = SIGNALS_BY_KEY[signal_key as keyof typeof SIGNALS_BY_KEY];
    out.push({
      signal_key,
      label: def?.label ?? signal_key,
      competency_id: pts[0].competency_id,
      points,
      trend,
      delta_30d,
      delta_90d,
      maturity_band,
    });
  }

  out.sort((a, b) => b.delta_30d - a.delta_30d);
  return out;
}

export async function getLatestSnapshot(pool: Pool, userId: string):
  Promise<{ snapshot_ts: string | null; signal_count: number }> {
  const { rows } = await pool.query<{ snapshot_ts: string; n: string }>(
    `WITH latest AS (
       SELECT MAX(snapshot_ts) AS ts FROM bsig_signal_snapshots WHERE user_id = $1
     )
     SELECT (SELECT ts FROM latest) AS snapshot_ts,
            COUNT(*)::text AS n
       FROM bsig_signal_snapshots s, latest
      WHERE s.user_id = $1 AND s.snapshot_ts = latest.ts`,
    [userId]);
  return {
    snapshot_ts: rows[0]?.snapshot_ts ?? null,
    signal_count: Number(rows[0]?.n ?? 0),
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────

function hashSources(sources: EvidenceSource[]): string {
  const normalised = sources
    .map(s => `${s.source_type}:${s.source_id}:${(s.text ?? '').replace(/\s+/g, ' ').trim()}`)
    .sort()
    .join('|');
  return createHash('sha256').update(normalised).digest('hex').slice(0, 32);
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }

// Re-export for direct UI consumption type-safety
export type { EvidenceHit };
