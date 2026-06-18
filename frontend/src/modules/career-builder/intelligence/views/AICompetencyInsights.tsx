import { useEffect, useMemo, useState } from 'react';

const COMP_LABEL: Record<string, string> = {
  COG: 'Cognitive', COM: 'Communication', LEA: 'Leadership',
  EXE: 'Execution', ADP: 'Adaptability', TEC: 'Technical', EIQ: 'Emotional Intel',
};

type Evidence = { source: string; signal: string; weight: number };
type Reasoning = {
  why_inferred: string; confidence_reasoning: string;
  behavioral_evidence: Evidence[]; readiness_rationale: string;
  alternatives: string[]; caveats: string[];
};
type InferredCompetency = {
  competency_key: string; inferred_level: number; confidence: number;
  evidence: Evidence[]; source_mix: Array<{ source: string; weight: number; level: number }>;
  reasoning: Reasoning;
};
type InferenceResult = {
  user_id: number; competencies: InferredCompetency[];
  overall_confidence: number; sources_used: string[]; generated_at: string;
};

type Props = {
  userId: number;
  /** Optional pre-fetched inference (e.g., from parent). When omitted, the panel shows the call-to-infer hint. */
  inference?: InferenceResult | null;
  /** Optional callback to trigger inference from parent. */
  onRunInference?: () => Promise<void>;
};

export default function AICompetencyInsights({ userId, inference, onRunInference }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/v2/ai/feature-flag', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (alive) setEnabled(!!j?.feature_flag?.aiInferenceV2); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  const trigger = async () => {
    if (!onRunInference) return;
    setLoading(true);
    try { await onRunInference(); } finally { setLoading(false); }
  };

  const sorted = useMemo(
    () => (inference?.competencies ?? []).slice().sort((a, b) => b.inferred_level - a.inferred_level),
    [inference],
  );

  if (enabled === false) return null;
  if (enabled === null) return <div className="text-xs text-slate-400">Loading AI insights…</div>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">AI competency insights</h3>
          <p className="mt-1 text-xs text-slate-500">
            Heuristic inference from resume / LinkedIn / GitHub / portfolio signals — developmental only, never a hiring or promotion prediction.
          </p>
        </div>
        {onRunInference && (
          <button
            onClick={trigger}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Inferring…' : 'Run inference'}
          </button>
        )}
      </header>

      {!inference && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No inference yet for user {userId}. Provide a resume, LinkedIn export, or GitHub snapshot and run inference.
        </div>
      )}

      {inference && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span>Overall confidence: <strong className="text-slate-900">{Math.round(inference.overall_confidence * 100)}%</strong></span>
            <span>Sources used: <strong className="text-slate-900">{inference.sources_used.join(', ') || 'none'}</strong></span>
            <span>Generated: <strong className="text-slate-900">{new Date(inference.generated_at).toLocaleString()}</strong></span>
          </div>

          <div className="space-y-3">
            {sorted.map((c) => (
              <details key={c.competency_key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-semibold text-white">{c.competency_key}</span>
                    <span className="text-sm font-medium text-slate-800">{COMP_LABEL[c.competency_key] ?? c.competency_key}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">conf {Math.round(c.confidence * 100)}%</span>
                    <span className="inline-flex w-32 items-center gap-2">
                      <span className="flex-1 overflow-hidden rounded-full bg-slate-200">
                        <span className="block h-2 rounded-full bg-slate-700" style={{ width: `${c.inferred_level}%` }} />
                      </span>
                      <span className="w-8 text-right text-xs font-semibold text-slate-800">{c.inferred_level}</span>
                    </span>
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p><strong className="text-slate-800">Why:</strong> {c.reasoning.why_inferred}</p>
                  <p><strong className="text-slate-800">Confidence:</strong> {c.reasoning.confidence_reasoning}</p>
                  <p><strong className="text-slate-800">Readiness:</strong> {c.reasoning.readiness_rationale}</p>
                  {c.reasoning.behavioral_evidence.length > 0 && (
                    <div>
                      <strong className="text-slate-800">Evidence:</strong>
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {c.reasoning.behavioral_evidence.map((e, i) => (
                          <li key={i} className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                            {e.source}: {e.signal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.reasoning.caveats.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-amber-700">
                      {c.reasoning.caveats.map((cv, i) => <li key={i}>{cv}</li>)}
                    </ul>
                  )}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
