/**
 * CAPADEX PIL — Phase 6C: Report Explainability Engine (pure, read-only).
 *
 *   Second of the three 6C engines. Given the 6C report sections (each carrying a
 *   lineage `anchor`) and the resolved pipeline lineage, it:
 *
 *     1. Attaches an honest per-statement TRACE — the resolved hops from the start
 *        of the chain up to (and including) the section's anchor node. Statements
 *        that legitimately sit outside the concern-diagnostic chain (strengths)
 *        carry their own `self_trace` and use it verbatim.
 *     2. Computes EXPLAINABILITY COVERAGE — the fraction of surfaced statements that
 *        resolve to at least one trace node, overall and per section.
 *
 *   The full chain is:
 *     Response → Signal → Concern → Capability → Problem → Behavior → Archetype
 *             → Intervention
 *
 * CANON: read-only, deterministic, never fabricates. A statement only counts as
 *   "traced" when a REAL resolved hop (or real self-trace) supports it — coverage is
 *   honest, not inflated. Honest empty-note sections contribute zero statements
 *   (nothing to explain). Never throws.
 */
import type { PipelineHop, HopKey } from './pipeline-resolver';
import type { ReportSection, ReportItem, TraceNode } from './report-section-engine';

// ── Public shapes ────────────────────────────────────────────────────────────
export interface TracedItem extends ReportItem {
  /** Ordered Response→…→anchor chain of RESOLVED nodes supporting this statement. */
  trace: TraceNode[];
  traced: boolean;
}

export interface TracedSection {
  key: string;
  title: string;
  items: TracedItem[];
  note: string | null;
  anchor: HopKey;
}

export interface SectionCoverage {
  key: string;
  title: string;
  statements: number;
  traced: number;
  coverage: number; // 0..1
}

export interface ExplainabilityCoverage {
  total_statements: number;
  traced_statements: number;
  coverage: number; // 0..1, rounded to 4dp
  fully_traceable: boolean; // coverage === 1 (every surfaced statement supported)
  by_section: SectionCoverage[];
  /** The full resolved + unresolved lineage chain (verbatim pipeline hops). */
  lineage: PipelineHop[];
}

export interface TracedReport {
  sections: TracedSection[];
  explainability: ExplainabilityCoverage;
}

// Canonical hop order — drives "how deep does this section's content reach?".
const HOP_ORDER: HopKey[] = [
  'response_to_signal',
  'signal_to_concern',
  'concern_to_capability',
  'capability_to_problem',
  'problem_to_behavior',
  'behavior_to_archetype',
  'archetype_to_intervention',
];

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Resolved hops from the start of the chain up to and including `anchor`. */
function chainTo(lineage: PipelineHop[], anchor: HopKey): TraceNode[] {
  const anchorIdx = HOP_ORDER.indexOf(anchor);
  if (anchorIdx < 0) return [];
  const allowed = new Set(HOP_ORDER.slice(0, anchorIdx + 1));
  return lineage
    .filter((h) => h.resolved && allowed.has(h.key))
    .sort((a, b) => a.step - b.step)
    .map((h) => ({ step: h.step, key: h.key, label: h.label, summary: h.summary }));
}

/** Attach traces to one section and tally its coverage. */
function traceSection(section: ReportSection, lineage: PipelineHop[]): {
  traced: TracedSection;
  coverage: SectionCoverage;
} {
  const lineageTrace = chainTo(lineage, section.anchor);
  const items: TracedItem[] = section.items.map((item) => {
    // Strengths (and other off-chain statements) carry their own honest trace.
    const trace = item.self_trace && item.self_trace.length ? item.self_trace : lineageTrace;
    return { ...item, trace, traced: trace.length > 0 };
  });
  const tracedCount = items.filter((i) => i.traced).length;
  return {
    traced: {
      key: section.key,
      title: section.title,
      items,
      note: section.note,
      anchor: section.anchor,
    },
    coverage: {
      key: section.key,
      title: section.title,
      statements: items.length,
      traced: tracedCount,
      coverage: items.length ? round4(tracedCount / items.length) : 1,
    },
  };
}

/**
 * Pure: attach per-statement traces to every section and compute overall +
 * per-section explainability coverage. `coverage` of an empty report (no surfaced
 * statements) is 1 (vacuously fully explainable — there is nothing unsupported).
 */
export function attachExplainability(
  sections: ReportSection[],
  lineage: PipelineHop[],
): TracedReport {
  const tracedSections: TracedSection[] = [];
  const by_section: SectionCoverage[] = [];
  let total = 0;
  let traced = 0;

  for (const section of sections) {
    const { traced: ts, coverage } = traceSection(section, lineage);
    tracedSections.push(ts);
    by_section.push(coverage);
    total += coverage.statements;
    traced += coverage.traced;
  }

  const coverage = total ? round4(traced / total) : 1;
  return {
    sections: tracedSections,
    explainability: {
      total_statements: total,
      traced_statements: traced,
      coverage,
      fully_traceable: coverage === 1,
      by_section,
      lineage,
    },
  };
}

export { HOP_ORDER, chainTo };
