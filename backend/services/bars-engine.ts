/**
 * BARS Engine — Behavioural Anchored Rating System
 * Phase 2 Scientific Competency Intelligence (v2.0.0)
 * Read-only over sci_competency_bars + anchors + examples.
 */
import type { Pool } from 'pg';

export const BARS_ENGINE_VERSION = '2.0.0';

export interface BarsRow {
  id: string;
  competency_id: string;
  role_layer: string;
  score_min: number;
  score_max: number;
  proficiency_level: string;
  behavioral_anchor: string;
  observable_behavior: string | null;
}

const cache = new Map<string, { v: any; t: number }>();
const TTL_MS = 60_000;
function memo<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.t < TTL_MS) return Promise.resolve(hit.v);
  return fn().then(v => { cache.set(k, { v, t: Date.now() }); return v; });
}

export function createBarsEngine(pool: Pool) {
  async function getAnchors(competencyId: string, roleLayer: string): Promise<BarsRow[]> {
    return memo(`bars:${competencyId}:${roleLayer}`, async () => {
      const { rows } = await pool.query(
        `SELECT id, competency_id, role_layer, score_min, score_max,
                proficiency_level, behavioral_anchor, observable_behavior
           FROM sci_competency_bars
          WHERE competency_id = $1 AND role_layer = $2 AND deleted_at IS NULL
          ORDER BY score_min ASC`,
        [competencyId, roleLayer]
      );
      return rows;
    });
  }

  async function listLayers(): Promise<string[]> {
    return memo('bars:layers', async () => {
      const { rows } = await pool.query(
        `SELECT DISTINCT role_layer FROM sci_competency_bars WHERE deleted_at IS NULL ORDER BY role_layer`
      );
      return rows.map((r: any) => r.role_layer);
    });
  }

  async function listCompetencies(): Promise<string[]> {
    return memo('bars:comps', async () => {
      const { rows } = await pool.query(
        `SELECT DISTINCT competency_id FROM sci_competency_bars WHERE deleted_at IS NULL ORDER BY competency_id`
      );
      return rows.map((r: any) => r.competency_id);
    });
  }

  /** Resolve the behavioural anchor row that a numeric score falls into. */
  async function resolveAnchor(competencyId: string, roleLayer: string, score: number): Promise<BarsRow | null> {
    const anchors = await getAnchors(competencyId, roleLayer);
    return anchors.find(a => score >= a.score_min && score <= a.score_max) ?? null;
  }

  /** Map a vector of competency scores to anchors at a given layer (batch). */
  async function mapScores(roleLayer: string, scores: Record<string, number>): Promise<Array<{
    competency_id: string; score: number; anchor: BarsRow | null;
  }>> {
    const ids = Object.keys(scores);
    const out = await Promise.all(ids.map(async id => ({
      competency_id: id,
      score: scores[id],
      anchor: await resolveAnchor(id, roleLayer, scores[id]),
    })));
    return out;
  }

  /** Build a developmental description from anchor + neighbouring levels. */
  async function describeProficiency(competencyId: string, roleLayer: string, score: number) {
    const anchors = await getAnchors(competencyId, roleLayer);
    const current = anchors.find(a => score >= a.score_min && score <= a.score_max) ?? null;
    const next = current ? anchors.find(a => a.score_min === current.score_max + 1 || a.score_min > current.score_max) ?? null : null;
    const prev = current ? [...anchors].reverse().find(a => a.score_max < current.score_min) ?? null : null;
    return {
      score,
      current_level: current?.proficiency_level ?? null,
      current_anchor: current?.behavioral_anchor ?? null,
      observable_behavior: current?.observable_behavior ?? null,
      next_level: next?.proficiency_level ?? null,
      next_anchor: next?.behavioral_anchor ?? null,
      prior_level: prev?.proficiency_level ?? null,
    };
  }

  return { getAnchors, resolveAnchor, mapScores, describeProficiency, listLayers, listCompetencies };
}
