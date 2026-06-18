/**
 * Contextual Benchmark V2 Panel — additive, feature-flagged.
 *
 * Renders cohort confidence, percentile distribution, readiness envelopes,
 * and explainability lineage. Mounts at the top of `BenchmarkDashboardPage`
 * (and is suitable for embedding in a peer-benchmark modal / explainability
 * drawer too). Renders nothing when the flag is off.
 */
import { useCallback, useEffect, useState } from 'react';
import { contextualBenchmarkV2, type V2ContextualResponse, type V2ReadinessEnvelope } from '@/lib/services/contextualBenchmarkV2Service';

const CANONICAL_CODES = ['COG', 'COM', 'LEA', 'EXE', 'ADP', 'TEC', 'EIQ'] as const;

export default function ContextualBenchmarkV2Panel({
  context,
  scores,
}: {
  context: { role?: string; layer?: string; industry?: string; geography?: string; seniority?: string };
  scores?: Partial<Record<(typeof CANONICAL_CODES)[number], number>>;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [primary, setPrimary] = useState<V2ContextualResponse | null>(null);
  const [readiness, setReadiness] = useState<V2ReadinessEnvelope[] | null>(null);
  const [selectedComp, setSelectedComp] = useState<typeof CANONICAL_CODES[number]>('COG');
  const [loading, setLoading] = useState(false);

  useEffect(() => { contextualBenchmarkV2.isEnabled().then(setEnabled); }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const sc = (scores ?? {}) as Record<string, number>;
      const raw = Number(sc[selectedComp] ?? 65);
      const [c, r] = await Promise.all([
        contextualBenchmarkV2.contextual({
          competency: selectedComp, raw, expected: 70,
          role: context.role, layer: context.layer, industry: context.industry,
          geography: context.geography, seniority: context.seniority,
        }),
        Object.keys(sc).length
          ? contextualBenchmarkV2.readiness(sc, { role: context.role, layer: context.layer, industry: context.industry })
          : Promise.resolve(null),
      ]);
      setPrimary(c);
      setReadiness(r?.readiness ?? null);
    } finally {
      setLoading(false);
    }
  }, [enabled, selectedComp, scores, context.role, context.layer, context.industry, context.geography, context.seniority]);

  useEffect(() => { void load(); }, [load]);

  if (enabled === null) return null;
  if (enabled === false) return null;

  return (
    <div className="bg-gradient-to-br from-violet-50 via-white to-indigo-50 border border-violet-200 rounded-2xl p-5 space-y-4" data-testid="contextual-benchmark-v2-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold tracking-wide">V2 CONTEXTUAL</span>
          <h3 className="text-base font-semibold text-gray-900">Contextual Benchmark & Readiness</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-gray-600">Competency
            <select value={selectedComp} onChange={(e) => setSelectedComp(e.target.value as typeof CANONICAL_CODES[number])}
              className="ml-2 border border-gray-200 rounded px-2 py-1 text-xs">
              {CANONICAL_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {loading && <span className="text-gray-400">loading…</span>}
        </div>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Developmental signals only — cohort-relative percentiles and readiness probabilities, never hiring or promotion predictions.
      </p>

      {primary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Score card */}
          <div className="bg-white border border-violet-100 rounded-xl p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold">Contextual score · {primary.competency}</div>
            <div className="flex items-end gap-3">
              <div className="text-3xl font-bold tabular-nums text-gray-900">{primary.scored.contextual_score.toFixed(0)}</div>
              <div className="text-[11px] text-gray-500 pb-1">
                raw {primary.raw_score.toFixed(0)} · expected {primary.expected_level.toFixed(0)}<br />
                growth-adj {primary.scored.growth_adjusted_score.toFixed(0)}
              </div>
            </div>
            <div className="text-[11px] text-gray-700">
              Percentile <b className="tabular-nums">P{primary.percentile}</b> · Readiness <b className="capitalize">{primary.readiness.band}</b>
              <span className="text-gray-400"> · p={primary.readiness.probability.toFixed(2)}</span>
            </div>
            <div className="flex gap-3 text-[10px] text-gray-500 pt-1 border-t border-gray-100">
              <span>Confidence <b className="text-gray-700">{(primary.scored.confidence * 100).toFixed(0)}%</b></span>
              <span>Reliability <b className="text-gray-700">{(primary.scored.reliability * 100).toFixed(0)}%</b></span>
            </div>
          </div>

          {/* Distribution card */}
          <div className="bg-white border border-violet-100 rounded-xl p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold">Cohort distribution</div>
            <div className="text-[11px] text-gray-600">
              {primary.cohort.cohort_label ?? primary.cohort.label} · n={primary.cohort.sample_size ?? primary.cohort.n ?? 0}
              {(primary.cohort.is_provisional ?? primary.cohort.provisional) && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold">PROVISIONAL</span>
              )}
              <span className="ml-2 text-gray-400">({primary.distribution.source})</span>
            </div>
            <div className="flex items-end gap-1 h-16 mt-2">
              {[primary.distribution.p10, primary.distribution.p25, primary.distribution.p50, primary.distribution.p75, primary.distribution.p90].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-violet-200 rounded-t" style={{ height: `${v}%`, minHeight: 4 }} />
                  <div className="text-[9px] text-gray-500 mt-0.5">P{[10,25,50,75,90][i]}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-500">
              μ={primary.distribution.mean.toFixed(1)} · σ={primary.distribution.std.toFixed(1)}
            </div>
          </div>

          {/* Explainability card */}
          <div className="bg-white border border-violet-100 rounded-xl p-4 space-y-2 text-[11px] text-gray-700">
            <div className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold">Why this benchmark</div>
            <div><b className="text-gray-900">Cohort.</b> {primary.explainability.why_cohort}</div>
            <div><b className="text-gray-900">Percentile.</b> {primary.explainability.why_percentile}</div>
            <div><b className="text-gray-900">Readiness.</b> {primary.explainability.why_readiness}</div>
            <div><b className="text-gray-900">Confidence.</b> {primary.explainability.why_confidence}</div>
          </div>
        </div>
      )}

      {readiness && readiness.length > 0 && (
        <div className="bg-white border border-violet-100 rounded-xl p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold">Readiness envelopes</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
            {readiness.map((r) => (
              <div key={r.domain} className="border border-gray-200 rounded p-2">
                <div className="capitalize font-semibold text-gray-800">{r.domain}</div>
                <div className="text-lg font-bold tabular-nums text-gray-900">{r.composite_score.toFixed(0)}</div>
                <div className="text-[10px] text-gray-500 capitalize">{r.band} · p={r.probability.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
