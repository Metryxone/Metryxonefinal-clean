/**
 * MX-74X — Career Path engine (additive, flag-gated, compose-only, read-only).
 *
 * THE FIRST MISSING LINK: Career Intelligence → Career Path generation.
 *
 * Every score this surfaces is already computed by an existing engine. This layer
 * COMPOSES them with the Career Graph role network (cg_roles + cg_role_edges +
 * cg_tracks) to SEQUENCE a graph-backed progression path from the subject's
 * anchor role onward — it NEVER recomputes a score and NEVER fabricates an edge.
 *
 *   anchor role (career-match)         — where the subject is anchored
 *     → advancement waypoints           — real cg_role_edges with rising seniority
 *     → lateral options                 — real cg_role_edges, same/adjacent seniority
 *     → canonical track (if any)        — cg_tracks ladder containing the anchor
 *   current readiness (role-readiness)  — how ready they already are
 *   next focus (career-gap)             — the single most material blocking gap
 *
 * Honesty contract:
 *   - No catalog-matched anchor role  → measurable:false, empty path, honest note.
 *   - Path length is bounded by REAL edges in the graph (coverage, never padded).
 *   - Coverage (how much of the path is graph-backed) and Confidence (edge-data
 *     density / requirement backing) are reported as SEPARATE axes.
 *   - Every advancement edge is a real row; seniority ordering is a disclosed
 *     heuristic (basis = 'seniority_rank_heuristic'), never asserted as fact.
 *   - Reads are DDL-free: cg_* tables are probed with to_regclass; absent → empty.
 */

import type { Pool } from 'pg';
import { buildCareerMatch, CAREER_MATCH_VERSION } from './career-match-engine.js';
import { computeRoleReadinessV2 } from './role-readiness-v2.js';
import {
  buildCareerGap,
  competencyRuntimeReady,
  CAREER_GAP_VERSION,
} from './career-gap-engine.js';

export const CAREER_PATH_VERSION = '74x.1.0';

/** Developmental language only — never a hiring/promotion/suitability prediction. */
const LANGUAGE_POLICY = {
  allowed: ['developmental path', 'progression option', 'graph-backed transition', 'readiness'],
  disallowed: ['guaranteed promotion', 'hiring decision', 'suitability verdict', 'you will be promoted'],
} as const;

/** Disclosed seniority ordering used ONLY to label an edge as advancement vs lateral.
 *  Grounded in the live cg_roles.seniority vocabulary. Unknown → 0 (unranked). */
const SENIORITY_RANK: Record<string, number> = {
  entry: 1,
  junior: 2,
  mid: 3,
  senior: 4,
  lead: 5,
  principal: 6,
  executive: 7,
};

function seniorityRank(s: string | null | undefined): number {
  return SENIORITY_RANK[String(s ?? '').trim().toLowerCase()] ?? 0;
}

type CatalogRole = {
  id: number;
  title: string;
  seniority: string | null;
  function_area: string | null;
  demand_score: number | null;
  automation_risk: number | null;
  growth_30mo: number | null;
};

type RoleEdge = {
  from_role_id: number;
  to_role_id: number;
  edge_type: string | null;
  transition_probability: number | null;
  avg_months_transition: number | null;
  difficulty: string | null;
};

export interface PathWaypoint {
  step: number;
  role_id: number;
  role_title: string;
  seniority: string | null;
  function_area: string | null;
  /** The real cg_role_edges row that connects the PRIOR waypoint to this one. */
  transition: {
    edge_type: string | null;
    transition_probability: number | null;
    avg_months_transition: number | null;
    difficulty: string | null;
  } | null;
  market: {
    demand_score: number | null;
    automation_risk: number | null;
    growth_30mo: number | null;
  };
}

export interface LateralOption {
  role_id: number;
  role_title: string;
  seniority: string | null;
  edge_type: string | null;
  transition_probability: number | null;
  difficulty: string | null;
}

export interface CoverageConfidence {
  coverage: { measurable: boolean; coverage_pct: number | null; detail: string };
  confidence: { band: 'high' | 'moderate' | 'low' | 'none'; basis: string; caps: string[] };
}

export interface CareerPathEnvelope {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  measurable: boolean;
  anchor: {
    role_id: string | null;
    role_title: string | null;
    catalog_role_id: number | null;
    seniority: string | null;
    function_area: string | null;
    matched_in_catalog: boolean;
  };
  current_position: {
    readiness_score: number | null;
    readiness_band: string | null;
    measured: boolean;
  };
  /** Ordered advancement path (anchor first, then rising-seniority real edges). */
  path: PathWaypoint[];
  /** Same/adjacent-seniority real edges out of the anchor (alternative moves). */
  lateral_options: LateralOption[];
  /** A canonical cg_tracks ladder that contains the anchor, from the anchor onward. */
  canonical_track: {
    track_key: string;
    name: string;
    function_area: string | null;
    estimated_years: number | null;
    from_anchor: { step_order: number; role_id: number; role_title: string }[];
  } | null;
  /** The single most material blocking gap to act on next (from career-gap). */
  next_focus: {
    competency_id: string;
    competency_name: string | null;
    gap: number;
    rationale: string;
  } | null;
  summary: {
    advancement_steps: number;
    lateral_options: number;
    terminal_role: string | null;
    horizon_months: number | null;
  };
  axes: CoverageConfidence;
  language_policy: typeof LANGUAGE_POLICY;
  source_versions: Record<string, string>;
  notes: string[];
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${name}`]);
    return Boolean(r.rows?.[0]?.reg);
  } catch {
    return false;
  }
}

function emptyEnvelope(sid: string, notes: string[]): CareerPathEnvelope {
  return {
    ok: true,
    subject_id: sid,
    version: CAREER_PATH_VERSION,
    generated_at: new Date().toISOString(),
    measurable: false,
    anchor: {
      role_id: null,
      role_title: null,
      catalog_role_id: null,
      seniority: null,
      function_area: null,
      matched_in_catalog: false,
    },
    current_position: { readiness_score: null, readiness_band: null, measured: false },
    path: [],
    lateral_options: [],
    canonical_track: null,
    next_focus: null,
    summary: { advancement_steps: 0, lateral_options: 0, terminal_role: null, horizon_months: null },
    axes: {
      coverage: { measurable: false, coverage_pct: null, detail: 'No graph-backed path could be derived.' },
      confidence: { band: 'none', basis: 'no anchor role or no role-graph data', caps: ['no_anchor_or_no_graph'] },
    },
    language_policy: LANGUAGE_POLICY,
    source_versions: {
      career_path: CAREER_PATH_VERSION,
      career_match: CAREER_MATCH_VERSION,
      career_gap: CAREER_GAP_VERSION,
    },
    notes,
  };
}

/**
 * Compose a graph-backed career path for `subjectId`. Never throws — composition
 * failures degrade to honest empties with an explanatory note.
 */
export async function buildCareerPath(pool: Pool, subjectId: string): Promise<CareerPathEnvelope> {
  const sid = String(subjectId ?? '').trim();
  const notes: string[] = [];
  const MAX_DEPTH = 4;

  // ---- Anchor role (compose career-match; never recompute) -------------------
  const match = await buildCareerMatch(pool, sid).catch((e) => {
    notes.push(`Career match composition unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });
  const anchorCatalogId = match?.anchor?.catalog_role_id ?? null;
  const anchorTitle = match?.anchor?.role_title ?? null;
  const anchorRoleId = match?.anchor?.role_id ?? null;

  if (anchorCatalogId == null) {
    notes.push(
      'No catalog-matched anchor role for this subject — a graph-backed path requires an anchor in cg_roles.',
    );
    const env = emptyEnvelope(sid, notes);
    env.anchor.role_id = anchorRoleId;
    env.anchor.role_title = anchorTitle;
    return env;
  }

  // ---- Role-graph substrate must exist (read-only, to_regclass probe) --------
  const haveRoles = await tableExists(pool, 'cg_roles');
  const haveEdges = await tableExists(pool, 'cg_role_edges');
  if (!haveRoles || !haveEdges) {
    notes.push('Career Graph role network (cg_roles/cg_role_edges) is absent — no path substrate.');
    const env = emptyEnvelope(sid, notes);
    env.anchor.role_id = anchorRoleId;
    env.anchor.role_title = anchorTitle;
    env.anchor.catalog_role_id = anchorCatalogId;
    env.anchor.matched_in_catalog = true;
    return env;
  }

  // ---- Load the role catalog + outgoing edges (read-only) --------------------
  const rolesRes = await pool
    .query(
      `SELECT id, title, seniority, function_area, demand_score, automation_risk, growth_30mo
         FROM cg_roles WHERE is_active IS NOT FALSE`,
    )
    .catch(() => ({ rows: [] as any[] }));
  const roleById = new Map<number, CatalogRole>();
  for (const r of rolesRes.rows) {
    roleById.set(Number(r.id), {
      id: Number(r.id),
      title: String(r.title ?? ''),
      seniority: r.seniority ?? null,
      function_area: r.function_area ?? null,
      demand_score: r.demand_score == null ? null : Number(r.demand_score),
      automation_risk: r.automation_risk == null ? null : Number(r.automation_risk),
      growth_30mo: r.growth_30mo == null ? null : Number(r.growth_30mo),
    });
  }

  const edgesRes = await pool
    .query(
      `SELECT from_role_id, to_role_id, edge_type, transition_probability,
              avg_months_transition, difficulty
         FROM cg_role_edges`,
    )
    .catch(() => ({ rows: [] as any[] }));
  const edgesFrom = new Map<number, RoleEdge[]>();
  for (const e of edgesRes.rows) {
    const from = Number(e.from_role_id);
    const edge: RoleEdge = {
      from_role_id: from,
      to_role_id: Number(e.to_role_id),
      edge_type: e.edge_type ?? null,
      transition_probability: e.transition_probability == null ? null : Number(e.transition_probability),
      avg_months_transition: e.avg_months_transition == null ? null : Number(e.avg_months_transition),
      difficulty: e.difficulty ?? null,
    };
    const arr = edgesFrom.get(from) ?? [];
    arr.push(edge);
    edgesFrom.set(from, arr);
  }

  const anchorRole = roleById.get(anchorCatalogId) ?? null;

  // ---- Greedily follow rising-seniority edges (advancement waypoints) --------
  // Advancement = the destination role outranks the source by the disclosed
  // seniority heuristic. Among candidates, prefer the highest transition
  // probability (real edge data), tie-broken by smaller seniority jump.
  const path: PathWaypoint[] = [];
  const visited = new Set<number>([anchorCatalogId]);
  if (anchorRole) {
    path.push({
      step: 0,
      role_id: anchorRole.id,
      role_title: anchorRole.title,
      seniority: anchorRole.seniority,
      function_area: anchorRole.function_area,
      transition: null,
      market: {
        demand_score: anchorRole.demand_score,
        automation_risk: anchorRole.automation_risk,
        growth_30mo: anchorRole.growth_30mo,
      },
    });
  }

  let cursor = anchorCatalogId;
  let horizonMonths = 0;
  let horizonKnown = false;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const fromRank = seniorityRank(roleById.get(cursor)?.seniority);
    const candidates = (edgesFrom.get(cursor) ?? [])
      .filter((e) => {
        if (visited.has(e.to_role_id)) return false;
        const tgt = roleById.get(e.to_role_id);
        if (!tgt) return false;
        return seniorityRank(tgt.seniority) > fromRank;
      })
      .sort((a, b) => {
        const pa = a.transition_probability ?? -1;
        const pb = b.transition_probability ?? -1;
        if (pb !== pa) return pb - pa;
        const ja = seniorityRank(roleById.get(a.to_role_id)?.seniority) - fromRank;
        const jb = seniorityRank(roleById.get(b.to_role_id)?.seniority) - fromRank;
        return ja - jb;
      });
    const best = candidates[0];
    if (!best) break;
    const tgt = roleById.get(best.to_role_id)!;
    visited.add(tgt.id);
    if (best.avg_months_transition != null) {
      horizonMonths += best.avg_months_transition;
      horizonKnown = true;
    }
    path.push({
      step: path.length,
      role_id: tgt.id,
      role_title: tgt.title,
      seniority: tgt.seniority,
      function_area: tgt.function_area,
      transition: {
        edge_type: best.edge_type,
        transition_probability: best.transition_probability,
        avg_months_transition: best.avg_months_transition,
        difficulty: best.difficulty,
      },
      market: {
        demand_score: tgt.demand_score,
        automation_risk: tgt.automation_risk,
        growth_30mo: tgt.growth_30mo,
      },
    });
    cursor = tgt.id;
  }

  // ---- Lateral / adjacent options out of the anchor (real edges) ------------
  const anchorRank = seniorityRank(anchorRole?.seniority);
  const lateral_options: LateralOption[] = (edgesFrom.get(anchorCatalogId) ?? [])
    .filter((e) => {
      const tgt = roleById.get(e.to_role_id);
      if (!tgt) return false;
      return seniorityRank(tgt.seniority) <= anchorRank; // same or lower seniority = sideways move
    })
    .sort((a, b) => (b.transition_probability ?? -1) - (a.transition_probability ?? -1))
    .slice(0, 6)
    .map((e) => {
      const tgt = roleById.get(e.to_role_id)!;
      return {
        role_id: tgt.id,
        role_title: tgt.title,
        seniority: tgt.seniority,
        edge_type: e.edge_type,
        transition_probability: e.transition_probability,
        difficulty: e.difficulty,
      };
    });

  // ---- Canonical track containing the anchor (cg_tracks ladder) -------------
  let canonical_track: CareerPathEnvelope['canonical_track'] = null;
  const haveTracks = (await tableExists(pool, 'cg_tracks')) && (await tableExists(pool, 'cg_track_waypoints'));
  if (haveTracks) {
    const trackRes = await pool
      .query(
        `SELECT t.track_key, t.name, t.function_area, t.estimated_years, w.step_order, w.role_id
           FROM cg_tracks t
           JOIN cg_track_waypoints w ON w.track_id = t.id
          WHERE t.is_active IS NOT FALSE
            AND t.id IN (SELECT track_id FROM cg_track_waypoints WHERE role_id = $1)
          ORDER BY t.id, w.step_order`,
        [anchorCatalogId],
      )
      .catch(() => ({ rows: [] as any[] }));
    if (trackRes.rows.length > 0) {
      // Pick the first track that contains the anchor; surface waypoints at/after the anchor.
      const firstKey = trackRes.rows[0].track_key;
      const rows = trackRes.rows.filter((r) => r.track_key === firstKey);
      const anchorStepRow = rows.find((r) => Number(r.role_id) === anchorCatalogId);
      const anchorStep = anchorStepRow ? Number(anchorStepRow.step_order) : 0;
      canonical_track = {
        track_key: String(firstKey),
        name: String(rows[0].name ?? ''),
        function_area: rows[0].function_area ?? null,
        estimated_years: rows[0].estimated_years == null ? null : Number(rows[0].estimated_years),
        from_anchor: rows
          .filter((r) => Number(r.step_order) >= anchorStep)
          .map((r) => ({
            step_order: Number(r.step_order),
            role_id: Number(r.role_id),
            role_title: roleById.get(Number(r.role_id))?.title ?? `role#${r.role_id}`,
          })),
      };
    }
  }

  // ---- Current readiness (compose role-readiness; never recompute) ----------
  const runtimeReady = await competencyRuntimeReady(pool).catch(() => false);
  let readinessScore: number | null = null;
  let readinessBand: string | null = null;
  let readinessMeasured = false;
  if (runtimeReady) {
    const rr = await computeRoleReadinessV2(pool, sid).catch(() => null);
    if (rr) {
      readinessScore = rr.readiness?.score ?? null;
      readinessBand = rr.readiness?.band ?? null;
      readinessMeasured = Boolean(rr.readiness?.measured);
    }
  } else {
    notes.push('Competency runtime not ready — current-readiness context withheld (honest absence).');
  }

  // ---- Next focus (compose career-gap; most material blocking gap) ----------
  let next_focus: CareerPathEnvelope['next_focus'] = null;
  const gap = await buildCareerGap(pool, sid).catch(() => null);
  const material = gap?.summary?.most_material ?? null;
  if (material) {
    next_focus = {
      competency_id: material.competency_id,
      competency_name: material.competency_name ?? null,
      gap: material.gap,
      rationale: material.blocking
        ? 'Highest-impact blocking gap for the anchor role — closing it most advances readiness.'
        : 'Most material development gap for the anchor role.',
    };
  }

  // ---- Coverage & Confidence (SEPARATE axes) --------------------------------
  const advancementSteps = Math.max(0, path.length - 1);
  const requestedSteps = MAX_DEPTH;
  const coveragePct = requestedSteps > 0 ? Math.round((advancementSteps / requestedSteps) * 100) : null;
  const edgesWithProb = path.filter((w) => w.transition && w.transition.transition_probability != null).length;
  let confidenceBand: CoverageConfidence['confidence']['band'] = 'none';
  const caps: string[] = [];
  if (advancementSteps === 0) {
    confidenceBand = 'none';
    caps.push('no_advancement_edges_from_anchor');
  } else if (edgesWithProb >= advancementSteps && advancementSteps >= 3) {
    confidenceBand = 'high';
  } else if (edgesWithProb >= 1) {
    confidenceBand = 'moderate';
  } else {
    confidenceBand = 'low';
    caps.push('edges_lack_transition_probability');
  }
  if (!readinessMeasured) caps.push('current_readiness_unmeasured');

  const terminal = path.length > 0 ? path[path.length - 1].role_title : null;

  return {
    ok: true,
    subject_id: sid,
    version: CAREER_PATH_VERSION,
    generated_at: new Date().toISOString(),
    measurable: advancementSteps > 0 || lateral_options.length > 0,
    anchor: {
      role_id: anchorRoleId,
      role_title: anchorTitle,
      catalog_role_id: anchorCatalogId,
      seniority: anchorRole?.seniority ?? null,
      function_area: anchorRole?.function_area ?? null,
      matched_in_catalog: true,
    },
    current_position: {
      readiness_score: readinessScore,
      readiness_band: readinessBand,
      measured: readinessMeasured,
    },
    path,
    lateral_options,
    canonical_track,
    next_focus,
    summary: {
      advancement_steps: advancementSteps,
      lateral_options: lateral_options.length,
      terminal_role: terminal,
      horizon_months: horizonKnown ? horizonMonths : null,
    },
    axes: {
      coverage: {
        measurable: advancementSteps > 0,
        coverage_pct: coveragePct,
        detail: `${advancementSteps} of up to ${requestedSteps} advancement steps are graph-backed.`,
      },
      confidence: {
        band: confidenceBand,
        basis: 'cg_role_edges transition-probability density + seniority_rank_heuristic',
        caps,
      },
    },
    language_policy: LANGUAGE_POLICY,
    source_versions: {
      career_path: CAREER_PATH_VERSION,
      career_match: CAREER_MATCH_VERSION,
      career_gap: CAREER_GAP_VERSION,
    },
    notes,
  };
}
