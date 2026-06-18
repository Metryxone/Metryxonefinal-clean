import { useEffect, useState } from 'react';

type Profile = { competency_key: string; mean_level: number; median_level: number; p25: number; p75: number; population_size: number };
type Readiness = { readiness_score: number; drivers: Array<{ k: string; contribution: number }>; bottlenecks: string[] };
type Risk = { competency: string; mean: number; coverage: number; risk_band: string; reason: string };
type Brief = { tenant_id: string; org_readiness: Readiness; capability_risk: Risk[]; resilience: { resilience_score: number; drivers: Array<{ k: string; contribution: number }> }; heatmap: Array<{ competency: string; mean: number; band: string }>; succession_signals: Array<{ competency: string; succession_strength: number }>; workforce_risk_index: number };
type Health = { performance: Array<{ component: string; avg_latency: string | null; avg_error_rate: string | null; samples: string }>; orchestration: Array<{ step: string; avg_ms: string | null; samples: string }>; ai_runtime: Array<{ model_key: string; calls: string; avg_latency: string | null; errors: string }> };

type Props = { tenantId?: string };

export default function EnterpriseWorkforceOSDashboard({ tenantId = 'default' }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [dashboard, setDashboard] = useState<{ profiles: Profile[]; readiness: Readiness; capability_risk: Risk[] } | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [health, setHealth] = useState<{ health: Health; summary: { status: string; slow_components: string[]; flaky_components: string[] } } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v2/wos/feature-flag', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null).then((j) => setEnabled(!!j?.feature_flag?.enterpriseWorkforceOSV2)).catch(() => setEnabled(false));
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const [d, e, o] = await Promise.all([
        fetch(`/api/v2/wos/dashboard?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include' }).then((x) => x.json()),
        fetch(`/api/v2/wos/executive-intelligence?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include' }).then((x) => x.json()),
        fetch('/api/v2/wos/observability?lookbackHours=24', { credentials: 'include' }).then((x) => x.json()),
      ]);
      setDashboard(d?.ok ? { profiles: d.profiles, readiness: d.readiness, capability_risk: d.capability_risk } : null);
      setBrief(e?.brief ?? null);
      setHealth(o?.ok ? { health: o.health, summary: o.summary } : null);
    } finally { setLoading(false); }
  };

  if (enabled === false) return null;
  if (enabled === null) return <div className="text-xs text-slate-400">Loading Workforce OS…</div>;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Enterprise Workforce OS — {tenantId}</h3>
          <p className="mt-1 text-xs text-slate-500">Capability profile · readiness · risk · executive brief · runtime observability. Aggregate signals only, never individual hiring/promotion verdicts.</p>
        </div>
        <button onClick={refresh} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
      </header>

      {!dashboard && <p className="text-xs text-slate-500">Click Refresh to load tenant data. POST to /api/v2/wos/profiles/build first to seed.</p>}

      {brief && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-[11px] uppercase tracking-wide text-slate-500">Org readiness</div><div className="text-2xl font-semibold text-slate-900">{brief.org_readiness.readiness_score}</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-[11px] uppercase tracking-wide text-slate-500">Resilience</div><div className="text-2xl font-semibold text-slate-900">{brief.resilience.resilience_score}</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-[11px] uppercase tracking-wide text-slate-500">Workforce risk index</div><div className={`text-2xl font-semibold ${brief.workforce_risk_index >= 50 ? 'text-red-600' : brief.workforce_risk_index >= 25 ? 'text-amber-600' : 'text-emerald-600'}`}>{brief.workforce_risk_index}%</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-[11px] uppercase tracking-wide text-slate-500">Bottlenecks</div><div className="text-sm font-medium text-slate-700">{brief.org_readiness.bottlenecks.length ? brief.org_readiness.bottlenecks.join(', ') : 'none'}</div></div>
        </div>
      )}

      {brief && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Capability heatmap</h4>
          <div className="flex flex-wrap gap-2">
            {brief.heatmap.map((h) => (
              <div key={h.competency} className={`rounded-md px-3 py-2 text-xs font-medium ${h.band === 'hot' ? 'bg-red-100 text-red-800' : h.band === 'warm' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                <div>{h.competency}</div>
                <div className="text-base font-semibold">{Math.round(h.mean)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Capability risk</h4>
          <ul className="space-y-1 text-xs text-slate-700">
            {dashboard.capability_risk.map((r) => (
              <li key={r.competency} className="flex items-center justify-between gap-2">
                <span><strong>{r.competency}</strong> · mean {r.mean} · coverage {Math.round(r.coverage * 100)}% — {r.reason}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.risk_band === 'high' ? 'bg-red-100 text-red-700' : r.risk_band === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.risk_band}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {health && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Runtime observability</h4>
          <div className="mb-2 text-xs text-slate-600">Status: <span className={`font-semibold ${health.summary.status === 'green' ? 'text-emerald-700' : health.summary.status === 'amber' ? 'text-amber-700' : 'text-red-700'}`}>{health.summary.status.toUpperCase()}</span></div>
          {health.summary.slow_components.length > 0 && <div className="text-xs text-amber-700">Slow: {health.summary.slow_components.join(', ')}</div>}
          {health.summary.flaky_components.length > 0 && <div className="text-xs text-red-700">Flaky: {health.summary.flaky_components.join(', ')}</div>}
          <div className="mt-2 text-[11px] text-slate-500">Performance samples: {health.health.performance.length} · Orchestration samples: {health.health.orchestration.length} · AI runtime samples: {health.health.ai_runtime.length}</div>
        </div>
      )}
    </section>
  );
}
