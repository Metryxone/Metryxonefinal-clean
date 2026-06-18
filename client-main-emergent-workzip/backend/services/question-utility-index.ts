/**
 * Question Downstream-Utility Index — CAPADEX (2026-06-02).
 *
 * CAPADEX is a behavioural INVESTIGATION: every clarity question only earns its
 * place if the answer travels somewhere useful — Signal → Composite → Pattern →
 * Intervention → report section. A question whose concern chain dead-ends before
 * an intervention produces no report utility no matter how well it is worded.
 *
 * This module is **strictly read-only**. It reuses the production chain validator
 * (`validateConcernSignalChain`) — the SAME engines the live runtime uses — and
 * projects its per-concern reachability onto the `master_bridge_tag` axis that
 * clarity questions are keyed by, via `capadex_concern_signal_map`'s own
 * `relational_bridge_tag` column (no fabricated joins).
 *
 * Honesty contract:
 *   • A bridge tag is only ever a `dead_end` when it is genuinely MAPPED to one
 *     or more concerns and NONE of them reach an intervention. A tag with no
 *     mapping rows is `unknown` (utility unmeasured), never a dead end.
 *   • The whole index self-disables (`mapped:false`) when the signal-map table
 *     has no tier-3 rows — before mappings exist, "no utility" is not a finding,
 *     it is missing data. Nothing is ever flagged on absent evidence.
 */
import type { Pool } from 'pg';
import { validateConcernSignalChain, type ChainStage } from './concern-signal-chain-validator';

export type UtilityStatus = 'reaches_intervention' | 'dead_end' | 'unknown';

export interface TagUtility {
  bridge_tag: string;
  status: UtilityStatus;
  concern_count: number;        // concerns mapped to this tag
  complete_count: number;       // of those, how many reach an intervention
  /** Worst (earliest) break stage among linked concerns; null when any complete. */
  breaks_at: ChainStage | null;
}

export interface UtilityIndex {
  generated_at: string;
  /** False when the signal-map has no tier-3 rows yet → utility is unmeasurable. */
  mapped: boolean;
  total_tags: number;
  dead_end_tags: number;
  byTag: Map<string, TagUtility>;
}

// Earliest-break ordering so an aggregated tag reports its WEAKEST concern stage.
const STAGE_RANK: Record<ChainStage, number> = { signal: 0, composite: 1, pattern: 2, intervention: 3 };

export async function buildUtilityIndex(pool: Pool): Promise<UtilityIndex> {
  const generatedAt = new Date().toISOString();

  // bridge_tag ⇄ concern_pk, straight from the mapping table's own column.
  const { rows: links } = await pool.query<{ concern_pk: number; relational_bridge_tag: string | null }>(
    `SELECT DISTINCT concern_pk, relational_bridge_tag
       FROM capadex_concern_signal_map
      WHERE relational_bridge_tag IS NOT NULL AND TRIM(relational_bridge_tag) <> ''`,
  );

  // Gate: no tier-3 rows ⇒ mappings not built ⇒ utility unmeasurable. Don't flag.
  const { rows: tier3 } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM capadex_concern_signal_map WHERE signal_tier = 'tier3'`,
  );
  const mapped = Number(tier3[0]?.n ?? 0) > 0;
  if (!mapped) {
    return { generated_at: generatedAt, mapped: false, total_tags: 0, dead_end_tags: 0, byTag: new Map() };
  }

  const chain = await validateConcernSignalChain(pool);
  const byConcernPk = new Map<number, (typeof chain.results)[number]>();
  for (const r of chain.results) byConcernPk.set(r.concern_pk, r);

  // tag → linked concern pks
  const tagConcerns = new Map<string, number[]>();
  for (const l of links) {
    const tag = l.relational_bridge_tag!.trim();
    const list = tagConcerns.get(tag) ?? [];
    list.push(l.concern_pk);
    tagConcerns.set(tag, list);
  }

  const byTag = new Map<string, TagUtility>();
  let deadEnd = 0;
  for (const [tag, pks] of Array.from(tagConcerns.entries())) {
    let completeCount = 0;
    let worstBreak: ChainStage | null = null;
    let evaluated = 0;
    for (const pk of pks) {
      const res = byConcernPk.get(pk);
      if (!res) continue;
      evaluated++;
      if (res.complete) completeCount++;
      else if (res.breaks_at) {
        if (worstBreak === null || STAGE_RANK[res.breaks_at] < STAGE_RANK[worstBreak]) {
          worstBreak = res.breaks_at;
        }
      }
    }
    let status: UtilityStatus;
    if (evaluated === 0) status = 'unknown';
    else if (completeCount > 0) status = 'reaches_intervention';
    else status = 'dead_end';
    if (status === 'dead_end') deadEnd++;
    byTag.set(tag, {
      bridge_tag: tag,
      status,
      concern_count: evaluated,
      complete_count: completeCount,
      breaks_at: status === 'reaches_intervention' ? null : worstBreak,
    });
  }

  return {
    generated_at: generatedAt,
    mapped: true,
    total_tags: byTag.size,
    dead_end_tags: deadEnd,
    byTag,
  };
}
