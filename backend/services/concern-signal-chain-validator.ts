/**
 * CAPADEX Concern → Signal → Composite → Pattern → Intervention chain validator
 * (Task #16, step 5).
 *
 * **Strictly read-only.** Given the persisted concern→signal mappings, it walks
 * the full intelligence spine for every concern using the SAME production engines
 * the live runtime uses, and reports — per concern — whether the chain is
 * complete or exactly where it breaks. It computes nothing new and writes
 * nothing; it only inspects reachability:
 *
 *   Concern ──(mapping)──▶ Tier-3 Signal
 *           │
 *           ├─▶ Composite    reachable ⇔ the signal's core-token is a required
 *           │                signal of some composite definition the composite
 *           │                engine derives from the ontology.
 *           ├─▶ Pattern      reachable ⇔ a composite is reachable (the pattern
 *           │                engine always synthesises a composite-derived
 *           │                pattern from a detected composite — structural).
 *           └─▶ Intervention reachable ⇔ the signal's core-token maps to a
 *                            construct in the intervention ontology AND that
 *                            construct has at least one library entry.
 *
 * A concern's chain is "complete" when at least one of its mapped Tier-3 signals
 * traverses all the way to an intervention. Concerns whose only mapping is an
 * `orphan` row — OR which have no map row at all (partial-population state) — are
 * reported as orphans (the chain never starts) — a real finding, never hidden.
 */
import type { Pool } from 'pg';
import { coreToken, loadCompositeRuntime } from './composite-signal-engine';
import { loadInterventionRuntime } from './capadex-intervention-engine';

export type ChainStage = 'signal' | 'composite' | 'pattern' | 'intervention';

export interface ConcernChainResult {
  concern_pk: number;
  concern_id: string | null;
  tier3_count: number;
  has_composite: boolean;
  has_pattern: boolean;
  has_intervention: boolean;
  complete: boolean;
  /** First stage that no mapped signal could traverse past (null when complete). */
  breaks_at: ChainStage | null;
  signals: Array<{
    signal_ref: string;
    signal_name: string | null;
    token: string;
    composite: boolean;
    pattern: boolean;
    intervention: boolean;
  }>;
}

export interface ChainValidationReport {
  generated_at: string;
  total_concerns: number;
  complete: number;
  orphan: number;
  breaks: Record<ChainStage, number>;
  /** Distinct Tier-3 signals that never reach a composite / intervention. */
  signals_without_composite: string[];
  signals_without_intervention: string[];
  results: ConcernChainResult[];
}

interface MapRow {
  concern_pk: number;
  concern_id: string | null;
  signal_tier: string;
  signal_ref: string;
  signal_name: string | null;
}

export async function validateConcernSignalChain(pool: Pool): Promise<ChainValidationReport> {
  const [compRuntime, intvRuntime, mapRes, masterRes] = await Promise.all([
    loadCompositeRuntime(pool, true),
    loadInterventionRuntime(pool, true),
    pool.query<MapRow>(
      `SELECT concern_pk, concern_id, signal_tier, signal_ref, signal_name
         FROM capadex_concern_signal_map
        WHERE signal_tier IN ('tier3', 'orphan')
        ORDER BY concern_pk`,
    ),
    // Full concern universe — so a concern with NO map row at all (partial-
    // population state) is still counted as a signal-stage break, never silently
    // dropped from the denominator.
    pool.query<{ concern_pk: number; concern_id: string | null }>(
      `SELECT id AS concern_pk, concern_id FROM capadex_concerns_master`,
    ),
  ]);

  // Tokens that participate in at least one composite definition.
  const compositeTokens = new Set<string>();
  for (const def of compRuntime.definitions) for (const t of def.required_signals) compositeTokens.add(t);

  const tokenReachesComposite = (token: string) => compositeTokens.has(token);
  const tokenReachesIntervention = (token: string) => {
    const meta = intvRuntime.ontology.get(token);
    if (!meta) return false;
    const lib = intvRuntime.library.get(meta.construct_key);
    return !!lib && lib.length > 0;
  };

  // Group mapping rows by concern.
  const byConcern = new Map<number, MapRow[]>();
  for (const r of mapRes.rows) {
    const list = byConcern.get(r.concern_pk) ?? [];
    list.push(r);
    byConcern.set(r.concern_pk, list);
  }

  // Seed the FULL concern universe so concerns with no map row at all (partial
  // population) are still evaluated — they fall into the tier3.length===0 branch
  // below and are counted as orphans / signal-stage breaks, never dropped.
  const concernIdByPk = new Map<number, string | null>();
  for (const m of masterRes.rows) {
    concernIdByPk.set(m.concern_pk, m.concern_id);
    if (!byConcern.has(m.concern_pk)) byConcern.set(m.concern_pk, []);
  }

  const results: ConcernChainResult[] = [];
  const breaks: Record<ChainStage, number> = { signal: 0, composite: 0, pattern: 0, intervention: 0 };
  const noComposite = new Set<string>();
  const noIntervention = new Set<string>();
  let complete = 0;
  let orphan = 0;

  for (const [concern_pk, rows] of Array.from(byConcern.entries())) {
    const tier3 = rows.filter((r) => r.signal_tier === 'tier3');
    const concern_id = rows[0]?.concern_id ?? concernIdByPk.get(concern_pk) ?? null;

    if (tier3.length === 0) {
      orphan++;
      breaks.signal++;
      results.push({
        concern_pk, concern_id, tier3_count: 0,
        has_composite: false, has_pattern: false, has_intervention: false,
        complete: false, breaks_at: 'signal', signals: [],
      });
      continue;
    }

    const signals = tier3.map((r) => {
      const token = coreToken(r.signal_name || r.signal_ref);
      const composite = tokenReachesComposite(token);
      const intervention = tokenReachesIntervention(token);
      if (!composite) noComposite.add(r.signal_name || r.signal_ref);
      if (!intervention) noIntervention.add(r.signal_name || r.signal_ref);
      return { signal_ref: r.signal_ref, signal_name: r.signal_name, token, composite, pattern: composite, intervention };
    });

    const has_composite = signals.some((s) => s.composite);
    const has_pattern = has_composite;
    const has_intervention = signals.some((s) => s.intervention);
    const isComplete = signals.some((s) => s.composite && s.pattern && s.intervention);

    let breaks_at: ChainStage | null = null;
    if (isComplete) {
      complete++;
    } else if (!has_composite) {
      breaks_at = 'composite';
      breaks.composite++;
    } else if (!has_pattern) {
      breaks_at = 'pattern';
      breaks.pattern++;
    } else {
      breaks_at = 'intervention';
      breaks.intervention++;
    }

    results.push({
      concern_pk, concern_id, tier3_count: tier3.length,
      has_composite, has_pattern, has_intervention, complete: isComplete, breaks_at, signals,
    });
  }

  results.sort((a, b) => a.concern_pk - b.concern_pk);

  return {
    generated_at: new Date().toISOString(),
    total_concerns: results.length,
    complete,
    orphan,
    breaks,
    signals_without_composite: Array.from(noComposite).sort(),
    signals_without_intervention: Array.from(noIntervention).sort(),
    results,
  };
}
