/**
 * Phase 3 — Mobility Engine.
 *
 * Computes:
 *   - role overlap (weighted Role-DNA intersection)
 *   - transferable strengths (per-competency transfer × user strength)
 *   - competency / leadership / strategic / execution gaps
 *   - mobility score (composite)
 *
 * READ-ONLY against onto_*, bench_*, mobility_*. Language is developmental —
 * never hiring/predictive.
 */

import type { Pool } from 'pg';
import { ensureOntoRoleWeightSourceColumn } from './onet-onto-weight-bridge.js';

export const MOBILITY_VERSION = '3.0.0';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const cached = async <T>(k: string, get: () => Promise<T>): Promise<T> => {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const v = await get();
  cache.set(k, { at: Date.now(), value: v });
  return v;
};

interface RoleWeightRow {
  competency_id: string;
  canonical_name: string;
  family_id: string;
  domain_id: string;
  leadership_relevance: number;
  weight: number;
  expected_level: number;
  source: string;
}

async function getRoleVector(pool: Pool, roleId: string): Promise<RoleWeightRow[]> {
  return cached(`mob:rv:${roleId}`, async () => {
    // `source` carries provenance so downstream surfaces can flag estimated /
    // inherited competencies. onto_role_weights now carries a real provenance
    // column: 'curated' for hand-authored weights, 'onet_derived' for weights
    // bridged from related O*NET occupations (see onet-onto-weight-bridge.ts).
    // COALESCE keeps any pre-migration legacy row honest.
    await ensureOntoRoleWeightSourceColumn(pool);
    const { rows } = await pool.query<RoleWeightRow>(`
      SELECT w.competency_id, c.canonical_name, c.family_id, c.domain_id,
             c.leadership_relevance::float AS leadership_relevance,
             w.weight::float AS weight, w.expected_level,
             COALESCE(w.source, 'curated') AS source
        FROM onto_role_weights w
        JOIN onto_dna_profiles p ON p.id = w.dna_profile_id AND p.is_current
        JOIN onto_competencies c ON c.id = w.competency_id
       WHERE p.role_id = $1
       ORDER BY w.weight DESC
    `, [roleId]);
    return rows;
  });
}

interface XferRow { transferability_score: number; transfer_type: string; rationale: string }

/** Prefetch the full transferability sub-matrix needed for one comparison in ONE query. */
async function getTransferMatrix(pool: Pool, sourceIds: string[], targetIds: string[]): Promise<Map<string, XferRow>> {
  if (!sourceIds.length || !targetIds.length) return new Map();
  const key = `mob:xfer-mat:${sourceIds.slice().sort().join(',')}|${targetIds.slice().sort().join(',')}`;
  return cached(key, async () => {
    const { rows } = await pool.query<XferRow & { source_competency_id: string; target_competency_id: string }>(
      `SELECT source_competency_id, target_competency_id,
              transferability_score::float AS transferability_score, transfer_type, rationale
         FROM mobility_transferability_maps
        WHERE source_competency_id = ANY($1::text[])
          AND target_competency_id = ANY($2::text[])`,
      [sourceIds, targetIds]);
    const map = new Map<string, XferRow>();
    for (const r of rows) {
      map.set(`${r.source_competency_id}::${r.target_competency_id}`, {
        transferability_score: r.transferability_score,
        transfer_type: r.transfer_type, rationale: r.rationale,
      });
    }
    return map;
  });
}

// ---- public --------------------------------------------------------------

export interface RoleComparison {
  from_role_id: string;
  to_role_id: string;
  overlap_score: number;             // 0..100
  transferability_score: number;     // 0..100
  gap_size_score: number;            // 0..100 (100 = no gap)
  mobility_score: number;            // 0..100 composite
  transferable_strengths: Array<{
    competency_id: string; canonical_name: string;
    user_score: number; transferability: number; contribution: number;
    transfer_type: string; rationale: string;
  }>;
  competency_gaps: Array<{
    competency_id: string; canonical_name: string;
    user_score: number; target_anchor: number; gap: number;
    weight: number; family_id: string; domain_id: string;
    category: 'leadership'|'strategic'|'execution'|'interpersonal'|'cognitive'|'general';
    status: 'meets'|'close'|'develop'|'priority';
    source: string;
  }>;
  gap_categories: Record<string, { count: number; avg_gap: number; total_weighted_gap: number }>;
  development_priorities: Array<{ competency_id: string; canonical_name: string;
                                   priority_score: number; reason: string }>;
  version: string;
}

const LEVEL_ANCHORS = [0, 30, 50, 65, 80, 92] as const;

function categoriseGap(r: RoleWeightRow): RoleComparison['competency_gaps'][number]['category'] {
  if (r.family_id === 'fam_leadership' || r.leadership_relevance >= 0.8) return 'leadership';
  if (r.family_id === 'fam_strategic_reasoning' || r.domain_id === 'dom_strategic') return 'strategic';
  if (r.family_id === 'fam_execution') return 'execution';
  if (r.domain_id === 'dom_interpersonal') return 'interpersonal';
  if (r.domain_id === 'dom_cognitive') return 'cognitive';
  return 'general';
}

export async function compareRoles(pool: Pool, params: {
  from_role_id: string; to_role_id: string;
  user_scores: Record<string, number>;
}): Promise<RoleComparison> {
  const [src, tgt] = await Promise.all([
    getRoleVector(pool, params.from_role_id),
    getRoleVector(pool, params.to_role_id),
  ]);
  const srcIds = new Set(src.map(r => r.competency_id));

  // ---- overlap: weighted intersection of competency vectors ----
  let overlapNum = 0;
  let overlapDen = 0;
  for (const t of tgt) {
    overlapDen += t.weight;
    if (srcIds.has(t.competency_id)) {
      const s = src.find(x => x.competency_id === t.competency_id)!;
      overlapNum += Math.min(s.weight, t.weight);
    }
  }
  const overlap = overlapDen > 0 ? (overlapNum / overlapDen) * 100 : 0;

  // ---- prefetch the full transferability sub-matrix in ONE query ----
  // Only consider source competencies the user has scored.
  const scoredSrcIds = src.map(r => r.competency_id).filter(id => typeof params.user_scores[id] === 'number');
  const targetIds = tgt.map(r => r.competency_id);
  const xferMatrix = await getTransferMatrix(pool, scoredSrcIds, targetIds);

  // ---- transferable strengths + gaps ----
  const transferable: RoleComparison['transferable_strengths'] = [];
  const gaps: RoleComparison['competency_gaps'] = [];
  const gapCategories: RoleComparison['gap_categories'] = {};
  let weightedTransferSum = 0;
  let weightedTransferDen = 0;
  let weightedGapSum = 0;

  for (const t of tgt) {
    const targetAnchor = LEVEL_ANCHORS[Math.min(5, Math.max(0, t.expected_level))];
    // Best-source pick: rank candidate sources by combined ranking score
    //   rankScore = transferability * (userScore/100)
    // but keep `bestTransfer` as the RAW transferability (0..1) so the proxy
    // user score doesn't double-apply the user score factor.
    let bestRank = 0;
    let bestTransfer = 0;            // raw transferability_score
    let bestSrcComp: RoleWeightRow | null = null;
    let bestRationale = '';
    let bestType = 'unrelated';
    let bestUserScore = 0;

    for (const s of src) {
      const userScore = params.user_scores[s.competency_id];
      if (typeof userScore !== 'number') continue;
      const row = xferMatrix.get(`${s.competency_id}::${t.competency_id}`);
      if (!row) continue;
      const rank = row.transferability_score * (userScore / 100);
      if (rank > bestRank) {
        bestRank = rank;
        bestTransfer = row.transferability_score;
        bestSrcComp = s;
        bestRationale = row.rationale;
        bestType = row.transfer_type;
        bestUserScore = userScore;
      }
    }

    weightedTransferDen += t.weight;
    if (bestSrcComp && bestTransfer >= 0.40) {
      weightedTransferSum += bestTransfer * t.weight;
      transferable.push({
        competency_id: t.competency_id, canonical_name: t.canonical_name,
        user_score: bestUserScore,
        transferability: Math.round(bestTransfer * 100) / 100,
        contribution: Math.round(bestRank * t.weight * 100) / 100,
        transfer_type: bestType, rationale: bestRationale,
      });
    }

    // Gap analysis: prefer direct competency score; fall back to best-transfer proxy
    //   proxyUser (0..100) = userScore × transferability  — single application only.
    const directUser = params.user_scores[t.competency_id];
    const proxyUser = bestSrcComp ? bestUserScore * bestTransfer : 0;
    const proxiedScore = typeof directUser === 'number' ? directUser : proxyUser;
    const gap = Math.round((proxiedScore - targetAnchor) * 10) / 10;
    const cat = categoriseGap(t);
    const status: RoleComparison['competency_gaps'][number]['status'] =
        gap >= 0       ? 'meets'
      : gap >= -10     ? 'close'
      : gap >= -25     ? 'develop' : 'priority';
    gaps.push({
      competency_id: t.competency_id, canonical_name: t.canonical_name,
      user_score: Math.round(proxiedScore),
      target_anchor: targetAnchor, gap,
      weight: Math.round(t.weight * 1000) / 1000,
      family_id: t.family_id, domain_id: t.domain_id,
      category: cat, status, source: t.source,
    });
    weightedGapSum += Math.max(0, -gap) * t.weight;

    gapCategories[cat] ??= { count: 0, avg_gap: 0, total_weighted_gap: 0 };
    gapCategories[cat].count += 1;
    gapCategories[cat].avg_gap += gap;
    gapCategories[cat].total_weighted_gap += Math.max(0, -gap) * t.weight;
  }
  for (const k of Object.keys(gapCategories)) {
    gapCategories[k].avg_gap = Math.round((gapCategories[k].avg_gap / gapCategories[k].count) * 10) / 10;
    gapCategories[k].total_weighted_gap = Math.round(gapCategories[k].total_weighted_gap * 100) / 100;
  }

  const transferability = weightedTransferDen > 0
    ? (weightedTransferSum / weightedTransferDen) * 100 : 0;
  // Gap-size score: invert weighted gap (max possible gap = 100 per competency)
  const gapSize = Math.max(0, 100 - (weightedGapSum / Math.max(0.01, weightedTransferDen)));

  // Composite mobility: 0.40 overlap + 0.35 transferability + 0.25 gapSize
  const mobility = 0.40 * overlap + 0.35 * transferability + 0.25 * gapSize;

  // Development priorities = top weighted gaps with developmental status
  const priorities = gaps
    .filter(g => g.status === 'priority' || g.status === 'develop')
    .map(g => ({
      competency_id: g.competency_id, canonical_name: g.canonical_name,
      priority_score: Math.round((-g.gap) * g.weight * 100) / 100,
      reason: `${g.category} gap of ${Math.abs(g.gap)} pts against target anchor ${g.target_anchor}`,
    }))
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 6);

  return {
    from_role_id: params.from_role_id,
    to_role_id:   params.to_role_id,
    overlap_score:         Math.round(overlap * 10) / 10,
    transferability_score: Math.round(transferability * 10) / 10,
    gap_size_score:        Math.round(gapSize * 10) / 10,
    mobility_score:        Math.round(mobility * 10) / 10,
    transferable_strengths: transferable.sort((a,b) => b.contribution - a.contribution).slice(0, 8),
    competency_gaps:        gaps.sort((a,b) => a.gap - b.gap),
    gap_categories:         gapCategories,
    development_priorities: priorities,
    version: MOBILITY_VERSION,
  };
}

// ---- adjacent roles -----------------------------------------------------

export async function adjacentRoles(pool: Pool, roleId: string) {
  return cached(`mob:adj:${roleId}`, async () => {
    const { rows } = await pool.query(
      `SELECT a.adjacent_role_id AS role_id, r.title, r.layer_id, r.seniority,
              a.adjacency_score::float AS adjacency_score, a.basis
         FROM mobility_adjacent_role_mappings a
         JOIN onto_roles r ON r.id = a.adjacent_role_id
        WHERE a.role_id = $1
        ORDER BY a.adjacency_score DESC`, [roleId]);
    return rows;
  });
}

// ---- mobility graph: from this role, score all reachable targets --------

export async function mobilityGraph(pool: Pool, params: {
  from_role_id: string; user_scores: Record<string, number>;
}) {
  // Batch fetch: targets + transitions + per-target role vectors in parallel.
  const [{ rows: targets }, { rows: transitions }] = await Promise.all([
    pool.query<{ id: string; title: string; layer_id: string; seniority: string|null }>(
      `SELECT id, title, layer_id, seniority FROM onto_roles WHERE id <> $1 AND deprecated = false`,
      [params.from_role_id]),
    pool.query<{ to_role_id: string; transition_type: string; difficulty: string;
                  typical_duration_months: number; frequency_band: string|null }>(
      `SELECT to_role_id, transition_type, difficulty, typical_duration_months, frequency_band
         FROM mobility_role_transitions WHERE from_role_id = $1`, [params.from_role_id]),
  ]);
  const transByTarget = new Map(transitions.map(t => [t.to_role_id, t]));

  // Run comparisons concurrently; each uses cached role vectors + matrix queries.
  const cmps = await Promise.all(targets.map(t =>
    compareRoles(pool, { from_role_id: params.from_role_id, to_role_id: t.id,
                          user_scores: params.user_scores })));

  return targets.map((t, i) => ({
    role_id: t.id, title: t.title, layer_id: t.layer_id, seniority: t.seniority,
    mobility_score: cmps[i].mobility_score, overlap: cmps[i].overlap_score,
    transferability: cmps[i].transferability_score, gap_size: cmps[i].gap_size_score,
    transition: transByTarget.get(t.id) ?? null,
    top_priority: cmps[i].development_priorities[0] ?? null,
  })).sort((a, b) => b.mobility_score - a.mobility_score);
}
