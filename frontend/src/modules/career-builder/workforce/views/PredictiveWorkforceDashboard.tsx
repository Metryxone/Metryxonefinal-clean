import { useEffect, useState } from 'react';

type Readiness = { user_id: number; target_role: string; probability: number; eta_months: number | null; drivers: Array<{ competency: string; level: number; weight: number }> };
type Burnout = { user_id: number; risk_score: number; risk_band: string; drivers: Array<{ driver: string; contribution: number }> };
type Leadership = { user_id: number; emergence_score: number; signals: string[] };
type Forecast = { forecast: { user_id: number; competency_key: string; horizon_months: number; predicted_level: number; confidence: number; method: string; inputs: Record<string, unknown> }; promotion: { current_stage: string; next_stage: string; proximity: number; evidence: string[] }; decay: { decay_rate_per_month: number; projected_loss_3mo: number; months_since_last_use: number } };

type Props = { userId: number };

export default function PredictiveWorkforceDashboard({ userId }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [burnout, setBurnout] = useState<Burnout | null>(null);
  const [leadership, setLeadership] = useState<Leadership | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v2/predictive/feature-flag', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null).then((j) => setEnabled(!!j?.feature_flag?.predictiveIntelligenceV2)).catch(() => setEnabled(false));
  }, []);

  const refresh = async () => {
    setLoading(true);
    const qs = `COG=65&COM=70&LEA=58&EXE=62&ADP=60&TEC=72&EIQ=55&targetRole=manager&tenureMonths=24`;
    try {
      const [r, b, l, f] = await Promise.all([
        fetch(`/api/v2/predictive/readiness?${qs}`, { credentials: 'include' }).then((x) => x.json()),
        fetch(`/api/v2/predictive/burnout-risk?weeklyHours=52&recentTrendDelta=-5&supportSignal=0.4&tenureMonths=24`, { credentials: 'include' }).then((x) => x.json()),
        fetch(`/api/v2/predictive/leadership?${qs}&teamSize=8&mentorshipCount=4`, { credentials: 'include' }).then((x) => x.json()),
        fetch(`/api/v2/predictive/forecast?competency=LEA&currentLevel=58&horizonMonths=6&history=1.2,0.8,1.5,1.0&currentStage=team_lead&nextStage=manager&tenureMonths=24`, { credentials: 'include' }).then((x) => x.json()),
      ]);
      setReadiness(r?.readiness ?? null);
      setBurnout(b?.burnout ?? null);
      setLeadership(l?.leadership ?? null);
      setForecast(f ?? null);
    } finally { setLoading(false); }
  };

  if (enabled === false) return null;
  if (enabled === null) return <div className="text-xs text-slate-400">Loading predictive dashboard…</div>;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Predictive workforce intelligence</h3>
          <p className="mt-1 text-xs text-slate-500">Heuristic forecasts of readiness, burnout, leadership emergence, competency growth — developmental signals only, not hiring or promotion predictions.</p>
        </div>
        <button onClick={refresh} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">{loading ? 'Computing…' : 'Refresh'}</button>
      </header>

      {!readiness && <p className="text-xs text-slate-500">Click Refresh to compute predictions for user {userId}.</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {readiness && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Readiness → {readiness.target_role}</h4>
            <div className="text-2xl font-semibold text-slate-900">{Math.round(readiness.probability * 100)}%</div>
            <div className="text-xs text-slate-500">ETA: {readiness.eta_months != null ? `${readiness.eta_months} months` : '—'}</div>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {readiness.drivers.slice(0, 3).map((d) => (
                <li key={d.competency}><strong>{d.competency}</strong>: level {d.level} · weight {Math.round(d.weight * 100)}%</li>
              ))}
            </ul>
          </div>
        )}

        {burnout && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Burnout risk</h4>
            <div className={`text-2xl font-semibold ${burnout.risk_band === 'high' ? 'text-red-600' : burnout.risk_band === 'moderate' ? 'text-amber-600' : 'text-emerald-600'}`}>{burnout.risk_score}/100</div>
            <div className="text-xs text-slate-500 capitalize">{burnout.risk_band} risk band</div>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {burnout.drivers.slice(0, 3).map((d) => (
                <li key={d.driver}><strong>{d.driver}</strong>: +{d.contribution}</li>
              ))}
            </ul>
          </div>
        )}

        {leadership && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Leadership emergence</h4>
            <div className="text-2xl font-semibold text-slate-900">{leadership.emergence_score}/100</div>
            <ul className="mt-2 flex flex-wrap gap-1 text-xs">
              {leadership.signals.map((s) => (
                <li key={s} className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {forecast && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{forecast.forecast.competency_key} forecast · {forecast.forecast.horizon_months}mo</h4>
            <div className="text-2xl font-semibold text-slate-900">{forecast.forecast.predicted_level}</div>
            <div className="text-xs text-slate-500">confidence {Math.round(forecast.forecast.confidence * 100)}% · method {forecast.forecast.method}</div>
            <div className="mt-2 text-xs text-slate-600">
              <div><strong>Promotion proximity</strong>: {Math.round(forecast.promotion.proximity * 100)}% ({forecast.promotion.current_stage} → {forecast.promotion.next_stage})</div>
              <div><strong>Decay</strong>: {(forecast.decay.decay_rate_per_month * 100).toFixed(2)}%/mo · projected 3mo loss {forecast.decay.projected_loss_3mo}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
