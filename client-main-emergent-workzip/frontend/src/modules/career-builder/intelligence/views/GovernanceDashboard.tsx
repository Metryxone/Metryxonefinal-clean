import { useEffect, useState } from 'react';

type Model = { model_key: string; version: string; owner: string | null; status: string; metadata: Record<string, unknown> };
type Audit = { decision_key: string; user_id: number | null; flagged: boolean; policy_check: { ok: boolean; violations: string[] }; created_at: string };
type Reliability = { competency_key: string; reliability_type: string; coefficient: string; sample_size: number | null; computed_at: string };
type Fairness = { cohort_key: string; metric: string; protected_group: string; reference_group: string; score: string; status: string; evaluated_at: string };

export default function GovernanceDashboard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [reliability, setReliability] = useState<Reliability[]>([]);
  const [fairness, setFairness] = useState<Fairness[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v2/gov/feature-flag', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null).then((j) => setEnabled(!!j?.feature_flag?.governanceScienceV2)).catch(() => setEnabled(false));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [m, a, r, f] = await Promise.all([
        fetch('/api/v2/gov/models', { credentials: 'include' }).then((x) => x.json()),
        fetch('/api/v2/gov/audits?limit=20', { credentials: 'include' }).then((x) => x.json()),
        fetch('/api/v2/gov/reliability', { credentials: 'include' }).then((x) => x.json()),
        fetch('/api/v2/gov/fairness', { credentials: 'include' }).then((x) => x.json()),
      ]);
      setModels(m?.models ?? []);
      setAudits(a?.audits ?? []);
      setReliability(r?.reliability ?? []);
      setFairness(f?.evaluations ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (enabled) load(); }, [enabled]);

  if (enabled === false) return null;
  if (enabled === null) return <div className="text-xs text-slate-400">Loading governance dashboard…</div>;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Governance & explainability</h3>
          <p className="mt-1 text-xs text-slate-500">Model registry · AI decision audits · reliability/validity · fairness audits. All metrics developmental — never used as hiring/promotion verdicts.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Model registry ({models.length})</h4>
          <ul className="space-y-1 text-xs text-slate-700">
            {models.map((m) => (
              <li key={m.model_key} className="flex items-center justify-between gap-2">
                <span><strong>{m.model_key}</strong> v{m.version}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${m.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{m.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent audits ({audits.length})</h4>
          <ul className="space-y-1 text-xs text-slate-700">
            {audits.slice(0, 8).map((a, i) => (
              <li key={i} className={a.flagged ? 'text-red-700' : ''}>
                {a.flagged ? '⚠ ' : ''}{a.decision_key} · {a.policy_check?.ok ? 'policy ok' : `violations: ${a.policy_check?.violations?.join(', ')}`}
              </li>
            ))}
            {!audits.length && <li className="text-slate-400">No audits recorded yet.</li>}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Reliability ({reliability.length})</h4>
          <ul className="space-y-1 text-xs text-slate-700">
            {reliability.slice(0, 8).map((r, i) => (
              <li key={i}><strong>{r.competency_key}</strong> · {r.reliability_type} = <strong>{Number(r.coefficient).toFixed(3)}</strong> (n={r.sample_size ?? '—'})</li>
            ))}
            {!reliability.length && <li className="text-slate-400">No reliability data yet — run /api/v2/gov/psychometrics/compute.</li>}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Fairness evaluations ({fairness.length})</h4>
          <ul className="space-y-1 text-xs text-slate-700">
            {fairness.slice(0, 8).map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{f.metric} · {f.protected_group} vs {f.reference_group} = <strong>{Number(f.score).toFixed(3)}</strong></span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${f.status === 'pass' ? 'bg-emerald-100 text-emerald-700' : f.status === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{f.status}</span>
              </li>
            ))}
            {!fairness.length && <li className="text-slate-400">No fairness evaluations yet — run /api/v2/gov/fairness/evaluate.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
