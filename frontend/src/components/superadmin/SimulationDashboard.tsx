import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlayCircle, CheckCircle2, AlertTriangle, XCircle, Loader2, FlaskConical, Users,
} from 'lucide-react';

type Verdict = 'pass' | 'warn' | 'fail';

interface ConfigResp {
  enabled: boolean;
  targets: any;
  personas: Array<{ key: string; label: string; role: string; concern: string; track: string; ageBand: string }>;
}

interface Condition {
  key: string; label: string; value: number; threshold: number;
  comparator: 'gte' | 'lte'; severity: 'hard' | 'soft'; applicable: boolean; passed: boolean;
}

interface RunRow {
  id: string;
  created_at: string;
  profile_count: number;
  sample_size: number;
  seed: number;
  duration_ms: number;
  verdict: Verdict;
  metrics: any;
  conditions?: Condition[];
  per_persona?: Record<string, { runs: number; relevance: number; reportUsefulness: number; confidenceAccuracy: number }>;
  failed_conditions?: string[];
  trigger_reason?: string | null;
}

async function getJSON(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const pct = (n: any) => (Number.isFinite(Number(n)) ? `${Math.round(Number(n) * 100)}%` : '—');

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; Icon: any; label: string }> = {
  pass: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', Icon: CheckCircle2, label: 'PASS' },
  warn: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', Icon: AlertTriangle, label: 'WARN' },
  fail: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', Icon: XCircle, label: 'FAIL' },
};

function MetricCard({ label, value, target }: { label: string; value: string; target?: string }) {
  return (
    <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-[#344E86]">{value}</div>
      {target && <div className="text-[11px] text-slate-400">target {target}</div>}
    </div>
  );
}

export default function SimulationDashboard() {
  const qc = useQueryClient();
  const [sampleSize, setSampleSize] = useState(10);

  const config = useQuery<ConfigResp>({
    queryKey: ['sim-config'],
    queryFn: () => getJSON('/api/admin/simulation/config'),
  });

  const enabled = !!config.data?.enabled;

  const latest = useQuery<{ run: RunRow | null }>({
    queryKey: ['sim-latest'],
    queryFn: () => getJSON('/api/admin/simulation/latest'),
    enabled,
  });

  const runs = useQuery<{ runs: RunRow[] }>({
    queryKey: ['sim-runs'],
    queryFn: () => getJSON('/api/admin/simulation/runs?limit=15'),
    enabled,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/simulation/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileCount: 1000, sampleSize, reason: 'manual SuperAdmin run' }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || `HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sim-latest'] });
      qc.invalidateQueries({ queryKey: ['sim-runs'] });
    },
  });

  if (config.isLoading) {
    return <div className="p-8 text-slate-400"><Loader2 className="animate-spin inline mr-2" size={16} />Loading…</div>;
  }

  // Flag OFF → the panel self-hides entirely (the nav item is also filtered out).
  if (!enabled) return null;

  const run = latest.data?.run || null;
  const m = run?.metrics || {};
  const t = config.data?.targets || {};

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FlaskConical className="text-[#344E86]" size={22} />
          <div>
            <h2 className="text-xl font-black text-[#344E86]">Simulation &amp; Validation</h2>
            <p className="text-[11px] text-slate-400">Black-box validation of the live CAPADEX pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Sample
            <input
              type="number" min={1} max={100} value={sampleSize}
              onChange={(e) => setSampleSize(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="ml-2 w-16 rounded-lg border border-[#E8EBF4] px-2 py-1 text-sm text-slate-700"
            />
          </label>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-[#344E86] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {runMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />}
            {runMutation.isPending ? 'Running…' : 'Run simulation'}
          </button>
        </div>
      </div>

      {runMutation.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Run failed: {(runMutation.error as Error)?.message}
        </div>
      )}

      {!run && (
        <div className="rounded-xl border border-[#E8EBF4] bg-white p-8 text-center text-slate-400">
          No runs yet. Click <span className="font-black">Run simulation</span> to validate the pipeline.
        </div>
      )}

      {run && (() => {
        const vs = VERDICT_STYLE[run.verdict] || VERDICT_STYLE.pass;
        return (
          <>
            <div className={`rounded-xl border p-5 flex items-center gap-4 ${vs.bg}`}>
              <vs.Icon className={vs.text} size={32} />
              <div>
                <div className={`text-2xl font-black ${vs.text}`}>{vs.label}</div>
                <div className="text-[11px] text-slate-500">
                  {run.sample_size} of {run.profile_count} profiles · seed {run.seed} · {run.duration_ms} ms ·{' '}
                  {new Date(run.created_at).toLocaleString()}
                </div>
              </div>
              {Array.isArray(run.failed_conditions) && run.failed_conditions.length > 0 && (
                <div className="ml-auto text-[11px] text-rose-700">
                  Failed: {run.failed_conditions.join(', ')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Relevance" value={pct(m.relevance)} target={pct(t?.relevance?.initial ?? 0.85)} />
              <MetricCard label="Repetition" value={pct(m.repetition)} target={`≤ ${pct(t?.repetitionMax ?? 0.02)}`} />
              <MetricCard label="Report quality" value={pct(m.reportUsefulness)} target={pct(t?.reportQuality ?? 0.9)} />
              <MetricCard label="Question quality" value={pct(m.questionQuality)} target={pct(t?.questionQuality ?? 0.9)} />
              <MetricCard label="Option quality" value={pct(m.optionQuality)} target={pct(t?.optionQuality ?? 0.9)} />
              <MetricCard label="Confidence accuracy" value={pct(m.confidenceAccuracy)} target={pct(t?.confidenceAccuracyMin ?? 0.7)} />
              <MetricCard label="Confidence stability" value={pct(m.confidenceStability)} target={pct(t?.confidenceStabilityMin ?? 0.75)} />
              <MetricCard label="Recommendation quality" value={pct(m.recommendationQuality)} target={pct(t?.recommendationQualityMin ?? 0.8)} />
            </div>

            {Array.isArray(run.conditions) && run.conditions.length > 0 && (
              <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Validation conditions</div>
                <div className="space-y-1">
                  {run.conditions.map((c) => (
                    <div key={c.key} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="flex items-center gap-2">
                        {!c.applicable ? <span className="text-slate-300">○</span>
                          : c.passed ? <CheckCircle2 className="text-emerald-500" size={14} />
                          : c.severity === 'hard' ? <XCircle className="text-rose-500" size={14} />
                          : <AlertTriangle className="text-amber-500" size={14} />}
                        <span className={c.applicable ? 'text-slate-700' : 'text-slate-300'}>{c.label}</span>
                        <span className="text-[10px] uppercase text-slate-300">{c.severity}</span>
                      </span>
                      <span className="text-slate-500">
                        {c.applicable ? `${pct(c.value)} (${c.comparator === 'gte' ? '≥' : '≤'} ${pct(c.threshold)})` : 'n/a'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {run.per_persona && Object.keys(run.per_persona).length > 0 && (
              <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <Users size={13} /> Persona breakdown
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-slate-400">
                      <th className="py-1">Persona</th><th>Runs</th><th>Relevance</th><th>Report</th><th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(run.per_persona).map(([key, v]) => {
                      const p = config.data?.personas.find((x) => x.key === key);
                      return (
                        <tr key={key} className="border-t border-slate-50">
                          <td className="py-1.5 text-slate-700">{p?.label || key}</td>
                          <td>{v.runs}</td>
                          <td>{pct(v.relevance)}</td>
                          <td>{pct(v.reportUsefulness)}</td>
                          <td>{pct(v.confidenceAccuracy)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      })()}

      {runs.data?.runs && runs.data.runs.length > 0 && (
        <div className="rounded-xl border border-[#E8EBF4] bg-white p-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Run history</div>
          <div className="space-y-1">
            {runs.data.runs.map((r) => {
              const vs = VERDICT_STYLE[r.verdict] || VERDICT_STYLE.pass;
              return (
                <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <span className="flex items-center gap-2">
                    <vs.Icon className={vs.text} size={14} />
                    <span className={`font-black ${vs.text}`}>{vs.label}</span>
                    <span className="text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
                  </span>
                  <span className="text-slate-500">
                    rel {pct(r.metrics?.relevance)} · rep {pct(r.metrics?.repetition)} · {r.sample_size} runs
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
