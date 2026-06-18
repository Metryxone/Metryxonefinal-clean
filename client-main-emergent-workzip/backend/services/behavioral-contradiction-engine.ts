/**
 * Behavioral Contradiction Engine — Phase 4 (additive, shadow-mode).
 *
 * Detects four classes of contradictions:
 *   - inconsistent_response   (same competency, divergent quality across questions)
 *   - inflated_claim          (self-rating ≫ evidence-backed signal)
 *   - leadership_inconsistency (leadership-tagged answers contradict prior)
 *   - execution_contradiction (claims action verbs but no evidence citations)
 *
 * Pure-function `detectContradictions` + best-effort persistence.
 * Audit only — never feeds scoring or runtime decisions.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export const CONTRADICTION_ENGINE_VERSION = '1.0.0';

export type ContradictionType =
  | 'inconsistent_response'
  | 'inflated_claim'
  | 'leadership_inconsistency'
  | 'execution_contradiction';

export type ContradictionSeverity = 'low' | 'medium' | 'high';

export type ResponseRecord = {
  questionId: string;
  competencyId: string;
  questionType?: string;            // 'situational' | 'behavioral' | 'leadership' | 'analytical' | 'technical' | ...
  selfRating?: number;              // 0..1
  qualityScore?: number;            // 0..1 — evidence-backed
  evidenceCitations?: number;
  actionVerbCount?: number;
  leadershipMarkers?: number;
};

export type Contradiction = {
  type: ContradictionType;
  severity: ContradictionSeverity;
  competencyIds: string[];
  rationale: string;
  evidence: Record<string, unknown>;
};

function abs(n: number): number { return n < 0 ? -n : n; }

export function detectContradictions(responses: ResponseRecord[]): Contradiction[] {
  if (!responses.length) return [];
  const out: Contradiction[] = [];

  // 1. Inconsistent response: same competency, qualityScore variance > 0.4
  const byComp = new Map<string, ResponseRecord[]>();
  for (const r of responses) {
    const arr = byComp.get(r.competencyId) ?? [];
    arr.push(r); byComp.set(r.competencyId, arr);
  }
  for (const [cid, rs] of byComp) {
    if (rs.length < 2) continue;
    const q = rs.map((r) => r.qualityScore ?? 0);
    const max = Math.max(...q); const min = Math.min(...q);
    if (max - min >= 0.4) {
      out.push({
        type: 'inconsistent_response',
        severity: max - min >= 0.6 ? 'high' : 'medium',
        competencyIds: [cid], rationale: `Quality varied by ${(max - min).toFixed(2)} across ${rs.length} answers`,
        evidence: { min, max, sampleSize: rs.length },
      });
    }
  }

  // 2. Inflated claim: selfRating - qualityScore >= 0.35
  for (const r of responses) {
    if (r.selfRating == null || r.qualityScore == null) continue;
    const gap = r.selfRating - r.qualityScore;
    if (gap >= 0.35) {
      out.push({
        type: 'inflated_claim',
        severity: gap >= 0.55 ? 'high' : 'medium',
        competencyIds: [r.competencyId],
        rationale: `Self-rating exceeds evidence by ${gap.toFixed(2)}`,
        evidence: { questionId: r.questionId, selfRating: r.selfRating, qualityScore: r.qualityScore },
      });
    }
  }

  // 3. Leadership inconsistency: leadership-type answers with leadershipMarkers === 0 AND selfRating >= 0.7
  for (const r of responses) {
    if (r.questionType !== 'leadership') continue;
    const markers = r.leadershipMarkers ?? 0;
    const claim = r.selfRating ?? 0;
    if (markers === 0 && claim >= 0.7) {
      out.push({
        type: 'leadership_inconsistency',
        severity: claim >= 0.85 ? 'high' : 'low',
        competencyIds: [r.competencyId],
        rationale: 'Leadership claim without leadership markers in response',
        evidence: { questionId: r.questionId, selfRating: claim, leadershipMarkers: markers },
      });
    }
  }

  // 4. Execution contradiction: actionVerbCount > 0 but evidenceCitations === 0 AND qualityScore < 0.4
  for (const r of responses) {
    const verbs = r.actionVerbCount ?? 0;
    const cites = r.evidenceCitations ?? 0;
    const qs = r.qualityScore ?? 0;
    if (verbs >= 3 && cites === 0 && qs < 0.4) {
      out.push({
        type: 'execution_contradiction',
        severity: qs < 0.25 ? 'medium' : 'low',
        competencyIds: [r.competencyId],
        rationale: 'Action verbs without supporting evidence',
        evidence: { questionId: r.questionId, actionVerbCount: verbs, evidenceCitations: cites, qualityScore: qs },
      });
    }
  }

  return out;
}

export async function persistContradictions(
  pool: Pool,
  args: { userId: string; sessionId?: string; contradictions: Contradiction[] },
): Promise<number> {
  let written = 0;
  for (const c of args.contradictions) {
    try {
      await pool.query(
        `INSERT INTO behavioral_contradiction_logs
           (id, user_id, session_id, contradiction_type, severity, competencies, evidence, rationale, engine_version)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
        [randomUUID(), args.userId, args.sessionId ?? null,
         c.type, c.severity, JSON.stringify(c.competencyIds),
         JSON.stringify(c.evidence), c.rationale, CONTRADICTION_ENGINE_VERSION],
      );
      written += 1;
    } catch (err) {
      console.warn('[contradiction-engine] persist failed:', (err as Error).message);
    }
  }
  return written;
}

export async function recentContradictions(
  pool: Pool, userId: string, limit = 20,
): Promise<Array<{ type: string; severity: string; competencies: string[]; rationale: string; detected_at: string }>> {
  try {
    const r = await pool.query(
      `SELECT contradiction_type AS type, severity, competencies, rationale, detected_at
         FROM behavioral_contradiction_logs
         WHERE user_id = $1
         ORDER BY detected_at DESC LIMIT $2`,
      [userId, Math.max(1, Math.min(200, limit))],
    );
    return r.rows.map((row: any) => ({
      type: String(row.type), severity: String(row.severity),
      competencies: Array.isArray(row.competencies) ? row.competencies : [],
      rationale: String(row.rationale ?? ''),
      detected_at: row.detected_at?.toISOString?.() ?? String(row.detected_at),
    }));
  } catch {
    return [];
  }
}
