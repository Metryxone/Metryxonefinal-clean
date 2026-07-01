# 14 · Visualization Blueprint (Layer 11)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED.**

## Canonical Definition
Visualization resolves scored/benchmarked data into chart-ready payloads: radar/spider, heatmap, trend, growth, timeline, benchmark charts, progress charts. Primary implementation: `services/viz-data-resolver.ts` (resolves SQL → Recharts-ready JSON), with `benchmark-engine.ts` (percentile bands) and `lib/intelligence/progressLedger.ts` (progress/readiness).

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Radar / Spider | SUPPORTED | `viz-data-resolver.ts` (`competency` source, `chart_type: 'radar'`). |
| Heatmap | SUPPORTED | `viz-data-resolver.ts` (`competency` source, `chart_type: 'heatmap'`). |
| Trend | SUPPORTED | `enterprise-analytics.ts` (KPI trend sparkline). |
| Growth / Timeline | SUPPORTED | `viz-data-resolver.ts` (`career` source, `chart_type: 'line'` score history). |
| Benchmark Charts | SUPPORTED | `benchmark-engine.ts` (p25/p50/p75 comparison bands). |
| Progress Charts | SUPPORTED | `lib/intelligence/progressLedger.ts`; `viz-data-resolver.ts` (completion/readiness). |

## Visualization Integrity
- **Six data-source dispatchers** in `viz-data-resolver.ts` map each chart to a real query; a chart with no data resolves to honest-empty, not a fabricated series.
- **Benchmark viz respects k=30 suppression** — suppressed cohorts render as masked, not invented.

## Gaps
None at Layer 11. (Additional chart types, e.g. distribution/violin plots, are additive over the resolver — not gaps.)

## Freeze Position
**FREEZE.** `viz-data-resolver.ts` is the canonical visualization data layer. New chart types add dispatchers to the resolver, never a parallel viz pipeline.
