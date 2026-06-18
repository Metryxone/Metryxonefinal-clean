/**
 * Coverage Registry Service — READ-ONLY (CAPADEX Phase 2, 2026-05-31).
 *
 * Builds, entirely from existing tables, a bridge-tag coverage picture:
 *   • Registry      — per bridge tag: question_count, concern_count, coverage_status,
 *                     runtime_remap_target + route.
 *   • Recovery      — for every UNCOVERED tag: hypothesis profile, behavioural intent,
 *                     root-cause categories, estimated question inventory required.
 *   • Prioritisation— 3 tiers (GENERAL_CONCERN remaps → sibling remaps → low volume).
 *   • Stats         — aggregate covered/uncovered/remapped + inventory totals.
 *
 * NO writes, NO DDL — only SELECTs against capadex_concerns_master and
 * capadex_clarity_questions. The runtime route is computed with the SAME shared
 * resolver the production picker uses (services/bridge-tag-resolver.ts), so the
 * registry can never drift from real behaviour.
 */
import type { Pool } from 'pg';
import {
  classifyBridgeTagRoute,
  COVERED_BRIDGE_TAGS,
  type BridgeTagRoute,
} from './bridge-tag-resolver';

// Estimated minimum curated bank per uncovered tag. Deliberately conservative —
// the goal is "no repetition / concern-specific coverage", NOT a huge bank.
const MIN_BANK = 8;
const PER_CONCERN = 2;
const MAX_BANK = 40;

export type CoverageTier = 1 | 2 | 3;

export interface RegistryRow {
  bridge_tag: string;
  question_count: number;
  concern_count: number;
  coverage_status: 'covered' | 'uncovered';
  runtime_remap_target: string | null;
  runtime_route: BridgeTagRoute;
  in_covered_set: boolean;
}

export interface RecoveryRow {
  bridge_tag: string;
  concern_count: number;
  cluster_count: number;
  remap_target: string | null;
  remap_route: BridgeTagRoute;
  tier: CoverageTier;
  hypothesis_profile: {
    modal_persona: string | null;
    modal_cluster: string | null;
    domains: string[];
    severity_mix: Record<string, number>;
    top_priority: string | null;
  };
  behavioral_intent: string;
  root_cause_categories: string[];
  signal_clusters: string[];
  estimated_question_inventory: number;
  sample_concerns: string[];
}

export interface CoverageStats {
  generated_at: string;
  total_bridge_tags: number;
  covered_tags: number;
  uncovered_tags: number;
  remap_routes: Record<BridgeTagRoute, number>; // among uncovered tags
  general_concern_dependent_tags: number;
  total_questions_existing: number;
  estimated_questions_required: number;
  tier_counts: Record<CoverageTier, number>;
  covered_set_size: number;
}

export interface CoverageData {
  generated_at: string;
  stats: CoverageStats;
  registry: RegistryRow[];
  roadmap: RecoveryRow[];
}

interface MasterRow {
  tag: string;
  concern_id: string | null;
  concern_cluster: string | null;
  domain: string | null;
  primary_persona: string | null;
  root_cause_group: string | null;
  signal_cluster: string | null;
  severity: string | null;
  capadex_priority: string | null;
  display_label: string | null;
}

function norm(tag: string | null | undefined): string {
  return String(tag || '').toUpperCase().trim();
}

function modeOf(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = (v || '').trim();
    if (!s) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}

function distinctNonEmpty(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v || '').trim();
    if (s) set.add(s);
  }
  return Array.from(set);
}

function tierFor(route: BridgeTagRoute, concernCount: number): CoverageTier {
  if (route === 'general' || route === 'none') return 1; // still generic catch-all
  if (concernCount >= 2) return 2;                        // sibling remap, real volume
  return 3;                                               // low-volume sibling remap
}

function behavioralIntent(cluster: string | null, domain: string | null): string {
  const c = (cluster || '').trim();
  const d = (domain || '').trim();
  if (c && d) return `Surface and stabilise "${c}" within the ${d} domain`;
  if (c) return `Surface and stabilise "${c}"`;
  if (d) return `Surface concern signals within the ${d} domain`;
  return 'Surface the concern-specific behavioural signals for this bridge tag';
}

function estimateInventory(concernCount: number): number {
  return Math.max(MIN_BANK, Math.min(MAX_BANK, concernCount * PER_CONCERN));
}

/**
 * Build the full coverage picture. Read-only; safe to call from a route or a script.
 */
export async function buildCoverageData(pool: Pool): Promise<CoverageData> {
  const generatedAt = new Date().toISOString();

  // 1. All master concern rows (2.5k) — aggregate per bridge tag in JS.
  const masterRes = await pool.query<MasterRow>(
    `SELECT UPPER(TRIM(relational_bridge_tag)) AS tag,
            concern_id, concern_cluster, domain, primary_persona,
            root_cause_group, signal_cluster, severity, capadex_priority, display_label
       FROM capadex_concerns_master
      WHERE relational_bridge_tag IS NOT NULL AND TRIM(relational_bridge_tag) <> ''`
  );

  // 2. Clarity question counts per master_bridge_tag (the curated banks).
  const clarityRes = await pool.query<{ tag: string; qcount: string }>(
    `SELECT UPPER(TRIM(master_bridge_tag)) AS tag, COUNT(*)::int AS qcount
       FROM capadex_clarity_questions
      WHERE master_bridge_tag IS NOT NULL AND TRIM(master_bridge_tag) <> ''
      GROUP BY UPPER(TRIM(master_bridge_tag))`
  );

  const questionCountByTag = new Map<string, number>();
  let totalQuestions = 0;
  for (const r of clarityRes.rows) {
    const n = Number(r.qcount) || 0;
    questionCountByTag.set(r.tag, n);
    totalQuestions += n;
  }

  // Group master rows by tag.
  const byTag = new Map<string, MasterRow[]>();
  for (const row of masterRes.rows) {
    const t = norm(row.tag);
    if (!t) continue;
    (byTag.get(t) || byTag.set(t, []).get(t)!).push(row);
  }

  // Universe of bridge tags = master tags ∪ clarity tags.
  const allTags = new Set<string>([...byTag.keys(), ...questionCountByTag.keys()]);

  const registry: RegistryRow[] = [];
  const roadmap: RecoveryRow[] = [];
  const remapRoutes: Record<BridgeTagRoute, number> = {
    covered_self: 0, override: 0, keyword: 0, general: 0, none: 0,
  };
  const tierCounts: Record<CoverageTier, number> = { 1: 0, 2: 0, 3: 0 };
  let coveredTags = 0;
  let estimatedRequired = 0;

  for (const tag of allTags) {
    const rows = byTag.get(tag) || [];
    const concernCount = rows.length;
    const questionCount = questionCountByTag.get(tag) || 0;
    const covered = questionCount > 0;
    const resolution = classifyBridgeTagRoute(tag);

    registry.push({
      bridge_tag: tag,
      question_count: questionCount,
      concern_count: concernCount,
      coverage_status: covered ? 'covered' : 'uncovered',
      runtime_remap_target: covered ? tag : resolution.target,
      runtime_route: covered ? 'covered_self' : resolution.route,
      in_covered_set: COVERED_BRIDGE_TAGS.has(tag),
    });

    if (covered) {
      coveredTags++;
      continue;
    }

    // Uncovered → recovery row.
    remapRoutes[resolution.route] = (remapRoutes[resolution.route] || 0) + 1;
    const tier = tierFor(resolution.route, concernCount);
    tierCounts[tier]++;

    const modalCluster = modeOf(rows.map((r) => r.concern_cluster));
    const modalPersona = modeOf(rows.map((r) => r.primary_persona));
    const domains = distinctNonEmpty(rows.map((r) => r.domain));
    const rootCauses = distinctNonEmpty(rows.map((r) => r.root_cause_group));
    const signalClusters = distinctNonEmpty(rows.map((r) => r.signal_cluster));
    const clusterCount = distinctNonEmpty(rows.map((r) => r.concern_cluster)).length;
    const topPriority = modeOf(rows.map((r) => r.capadex_priority));

    const severityMix: Record<string, number> = {};
    for (const r of rows) {
      const s = (r.severity || 'Unspecified').trim() || 'Unspecified';
      severityMix[s] = (severityMix[s] || 0) + 1;
    }

    const est = estimateInventory(concernCount);
    estimatedRequired += est;

    roadmap.push({
      bridge_tag: tag,
      concern_count: concernCount,
      cluster_count: clusterCount,
      remap_target: resolution.target,
      remap_route: resolution.route,
      tier,
      hypothesis_profile: {
        modal_persona: modalPersona,
        modal_cluster: modalCluster,
        domains,
        severity_mix: severityMix,
        top_priority: topPriority,
      },
      behavioral_intent: behavioralIntent(modalCluster, domains[0] || null),
      root_cause_categories: rootCauses,
      signal_clusters: signalClusters,
      estimated_question_inventory: est,
      sample_concerns: distinctNonEmpty(
        rows.map((r) => r.display_label || r.concern_cluster || r.concern_id)
      ).slice(0, 5),
    });
  }

  // Sort: registry uncovered-first then by concern volume; roadmap by tier then volume.
  registry.sort((a, b) => {
    if (a.coverage_status !== b.coverage_status) return a.coverage_status === 'uncovered' ? -1 : 1;
    return b.concern_count - a.concern_count || a.bridge_tag.localeCompare(b.bridge_tag);
  });
  roadmap.sort((a, b) =>
    a.tier - b.tier ||
    b.concern_count - a.concern_count ||
    a.bridge_tag.localeCompare(b.bridge_tag)
  );

  const uncoveredTags = allTags.size - coveredTags;
  const stats: CoverageStats = {
    generated_at: generatedAt,
    total_bridge_tags: allTags.size,
    covered_tags: coveredTags,
    uncovered_tags: uncoveredTags,
    remap_routes: remapRoutes,
    general_concern_dependent_tags: remapRoutes.general + remapRoutes.none,
    total_questions_existing: totalQuestions,
    estimated_questions_required: estimatedRequired,
    tier_counts: tierCounts,
    covered_set_size: COVERED_BRIDGE_TAGS.size,
  };

  return { generated_at: generatedAt, stats, registry, roadmap };
}
