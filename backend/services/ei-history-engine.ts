/**
 * Phase 3.11 — EI History Engine (ei_history deliverable).
 *
 * COMPOSES already-persisted history into one read-only timeline:
 *   - Assessment History — employability_scoring_runs (listScoringRuns).
 *   - EI History         — ei_profile_snapshots headline timeline (listEiProfileHistory).
 *   - Dimension History  — per-dimension score series extracted from each
 *                          snapshot's stored full-profile JSON.
 *
 * Honesty / discipline:
 *   - Read-only & never-throws: each source is guarded; a failure degrades that
 *     section to an honest empty (with a note), never the whole response.
 *   - ZERO DDL: reads tables whose CREATE lives on already-approved write paths
 *     (probe + degrade). Byte-identical flag-OFF is enforced by the route gate.
 *   - Coverage (measured) is reported SEPARATELY from totals; NULL scores stay
 *     NULL (never coerced to 0).
 */

import type { Pool } from 'pg';
import { listScoringRuns, type ScoringRunRecord } from './employability-scoring-engine.js';
import {
  listEiProfileHistory,
  listEiProfileSnapshotsWithProfile,
  type EiProfileSnapshotRow,
} from './ei-profile-history.js';

export const EI_HISTORY_ENGINE_VERSION = '3.11.0';

export interface DimensionHistoryPoint {
  snapshot_id: number;
  captured_at: string;
  score: number | null; // NULL = unmeasured in that snapshot (never 0)
  band: string | null;
}

export interface DimensionHistorySeries {
  ei_dimension_id: string;
  dimension_name: string | null;
  points: DimensionHistoryPoint[];
  measured_count: number; // points with a non-null score
}

export interface EiHistory {
  subject_id: string;
  assessment_history: {
    provisioned: boolean;
    count: number;
    measured_count: number;
    runs: ScoringRunRecord[]; // newest-first (as listScoringRuns returns)
  };
  ei_history: {
    count: number;
    measured_count: number;
    snapshots: EiProfileSnapshotRow[]; // newest-first
  };
  dimension_history: DimensionHistorySeries[]; // oldest-first points
  notes: string[];
}

/** Build the unified history for one subject. Read-only; never throws. */
export async function buildEiHistory(pool: Pool, subjectId: string): Promise<EiHistory> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];

  // --- Assessment History (scoring runs) -----------------------------------
  const assessment = await listScoringRuns(pool, sid).catch(() => ({ provisioned: false, runs: [] as ScoringRunRecord[] }));
  if (!assessment.provisioned) {
    notes.push('Assessment history store not provisioned — no scoring runs captured yet (honest empty, not fabricated).');
  } else if (assessment.runs.length === 0) {
    notes.push('No scoring runs captured for this subject yet.');
  }

  // --- EI History (snapshot headlines) -------------------------------------
  const snapshots = await listEiProfileHistory(pool, sid).catch(() => [] as EiProfileSnapshotRow[]);
  if (snapshots.length === 0) {
    notes.push('No EI profile snapshots captured for this subject yet — capture snapshots over time to build history.');
  }

  // --- Dimension History (per-dimension series from snapshot JSON) ----------
  const withProfiles = await listEiProfileSnapshotsWithProfile(pool, sid).catch(
    () => [] as Awaited<ReturnType<typeof listEiProfileSnapshotsWithProfile>>,
  );
  const dimension_history = buildDimensionSeries(withProfiles);
  if (withProfiles.length > 0 && dimension_history.length === 0) {
    notes.push('Snapshots present but no dimension scores recorded in their profiles.');
  }

  return {
    subject_id: sid,
    assessment_history: {
      provisioned: assessment.provisioned,
      count: assessment.runs.length,
      measured_count: assessment.runs.filter((r) => r.ei_score != null).length,
      runs: assessment.runs,
    },
    ei_history: {
      count: snapshots.length,
      measured_count: snapshots.filter((s) => s.ei_score != null).length,
      snapshots,
    },
    dimension_history,
    notes,
  };
}

/**
 * Pivot snapshot profiles into per-dimension series (oldest-first points).
 * A dimension absent from a snapshot is simply not emitted for that point; a
 * present-but-unmeasured dimension emits a NULL score (never 0).
 */
export function buildDimensionSeries(
  snapshots: Awaited<ReturnType<typeof listEiProfileSnapshotsWithProfile>>,
): DimensionHistorySeries[] {
  const byDim = new Map<string, DimensionHistorySeries>();
  // snapshots arrive oldest-first from listEiProfileSnapshotsWithProfile.
  for (const snap of snapshots) {
    const dims = Array.isArray(snap.profile?.dimension_scores) ? snap.profile.dimension_scores : [];
    for (const d of dims) {
      const id = String(d.ei_dimension_id ?? '').trim();
      if (!id) continue;
      let series = byDim.get(id);
      if (!series) {
        series = { ei_dimension_id: id, dimension_name: d.dimension_name ?? null, points: [], measured_count: 0 };
        byDim.set(id, series);
      }
      if (series.dimension_name == null && d.dimension_name != null) series.dimension_name = d.dimension_name;
      const score = d.score != null ? Number(d.score) : null;
      series.points.push({
        snapshot_id: snap.id,
        captured_at: snap.created_at,
        score: score != null && Number.isFinite(score) ? score : null,
        band: d.band ?? null,
      });
      if (score != null && Number.isFinite(score)) series.measured_count += 1;
    }
  }
  return [...byDim.values()].sort((a, b) => a.ei_dimension_id.localeCompare(b.ei_dimension_id));
}
