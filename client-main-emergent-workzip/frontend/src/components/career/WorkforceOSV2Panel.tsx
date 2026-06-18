/**
 * Workforce OS V2 Panel — additive, feature-flagged.
 * Renders a 6-tile workspace covering: forecasting, scenario simulation,
 * fairness drift, ABAC evaluation, learning attribution, and SLA-policy lookup.
 * Renders nothing when the workforceOSV2 flag is off.
 */
import { useEffect, useState } from 'react';
import { workforceOsV2 } from '@/lib/services/workforceOsV2Service';

const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #ddd6fe', borderRadius: 12, padding: 16,
};
const titleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: '#6d28d9', marginBottom: 8,
};
const valStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#111827', tabularNums: 'lining' as never };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#6b7280' };
const ratStyle: React.CSSProperties = { fontSize: 11, color: '#374151', marginTop: 8, lineHeight: 1.45 };

export default function WorkforceOSV2Panel({ tenantId }: { tenantId: number }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [horizonWeeks, setHorizonWeeks] = useState<number>(12);
  const [forecast, setForecast] = useState<Awaited<ReturnType<typeof workforceOsV2.marketForecast>>>(null);
  const [scenario, setScenario] = useState<Awaited<ReturnType<typeof workforceOsV2.simulate>>>(null);
  const [drift, setDrift] = useState<Awaited<ReturnType<typeof workforceOsV2.fairnessDrift>>>(null);
  const [abac, setAbac] = useState<Awaited<ReturnType<typeof workforceOsV2.abacEvaluate>>>(null);
  const [attribution, setAttribution] = useState<Awaited<ReturnType<typeof workforceOsV2.attribution>>>(null);

  useEffect(() => { workforceOsV2.isEnabled().then(setEnabled); }, []);

  useEffect(() => {
    if (!enabled) return;
    void Promise.all([
      workforceOsV2.marketForecast({ signalKey: 'genai_demand', horizonWeeks, history: [{ value: 10 }, { value: 12 }, { value: 15 }, { value: 17 }, { value: 22 }], tenantId }).then(setForecast),
      workforceOsV2.simulate({ scenarioName: 'preview', baseline: { headcount: 500, attritionAnnual: 0.14, hiringPerQuarter: 40, skillCoverage: 72 }, knobs: { attritionShockPct: 0.05, hiringScalePct: 0.9, upskillProgramLift: 6, horizonQuarters: 4 }, tenantId }).then(setScenario),
      workforceOsV2.fairnessDrift({ suiteKey: 'preview', groupLabel: 'overall', metric: 'tpr_gap', baseline: 0.72, current: 0.61, baselineN: 400, currentN: 380, tenantId }).then(setDrift),
      workforceOsV2.abacEvaluate({ resource: 'fairness:suite', action: 'read', attributes: { role: 'compliance_lead' }, tenantId }).then(setAbac),
      workforceOsV2.attribution({ interventionKey: 'leadership_lab', cohortLabel: 'preview', observations: [{ pre: 62, post: 74 }, { pre: 58, post: 70 }, { pre: 65, post: 72 }, { pre: 60, post: 71 }], baselineDelta: 3, tenantId }).then(setAttribution),
    ]);
  }, [enabled, tenantId, horizonWeeks]);

  if (!enabled) return null;

  return (
    <section
      data-testid="workforce-os-v2-panel"
      style={{
        background: 'linear-gradient(135deg, #faf5ff, #ffffff 60%, #eef2ff)',
        border: '1px solid #c4b5fd', borderRadius: 14, padding: 20, marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ padding: '2px 8px', borderRadius: 999, background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>V2 WORKFORCE OS</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Predictive Depth — Forecast · Simulate · Drift · ABAC · ROI</h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 14px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
          Developmental + planning signals only — never individual hiring/termination predictions.
        </p>
        <label style={{ fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          Forecast horizon
          <select value={horizonWeeks} onChange={e => setHorizonWeeks(Number(e.target.value))}
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: 11, background: '#fff' }}
                  data-testid="wos-v2-horizon-select">
            {[4, 8, 12, 26, 52].map(w => <option key={w} value={w}>{w}w</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <div style={titleStyle}>Market forecast ({horizonWeeks}w)</div>
          {forecast ? (
            <>
              <div style={valStyle}>{forecast.forecast.projected_value.toFixed(1)}</div>
              <div style={labelStyle}>now {forecast.forecast.current_value.toFixed(1)} · Δ/wk {forecast.forecast.delta_per_week.toFixed(2)} · <b style={{ color: '#6d28d9' }}>{forecast.forecast.trend}</b></div>
              <div style={labelStyle}>confidence {(forecast.forecast.confidence * 100).toFixed(0)}%</div>
              <div style={ratStyle}>{forecast.forecast.rationale}</div>
            </>
          ) : <div style={labelStyle}>loading…</div>}
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Scenario · 4Q</div>
          {scenario ? (
            <>
              <div style={valStyle}>HC {scenario.outcome.projected_headcount}</div>
              <div style={labelStyle}>gap {scenario.outcome.projected_gap_pct.toFixed(1)}% · risk <b style={{ color: scenario.outcome.risk_band === 'critical' ? '#b91c1c' : scenario.outcome.risk_band === 'high' ? '#ea580c' : '#16a34a' }}>{scenario.outcome.risk_band}</b></div>
              <div style={labelStyle}>+{scenario.outcome.cumulative_hires} hires · −{scenario.outcome.cumulative_attritions} attr</div>
              <div style={ratStyle}>{scenario.outcome.rationale}</div>
            </>
          ) : <div style={labelStyle}>loading…</div>}
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Fairness drift · tpr_gap</div>
          {drift ? (
            <>
              <div style={valStyle}>z = {drift.drift.z_score.toFixed(2)}</div>
              <div style={labelStyle}>Δ {drift.drift.delta.toFixed(2)} · {drift.drift.is_significant
                ? <b style={{ color: '#b91c1c' }}>significant</b>
                : <b style={{ color: '#16a34a' }}>not significant</b>}</div>
              <div style={ratStyle}>{drift.drift.rationale}</div>
            </>
          ) : <div style={labelStyle}>loading…</div>}
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>ABAC decision</div>
          {abac ? (
            <>
              <div style={valStyle}><span style={{ color: abac.decision.effect === 'allow' ? '#16a34a' : '#b91c1c' }}>{abac.decision.effect.toUpperCase()}</span></div>
              <div style={labelStyle}>matched: {abac.decision.matched_policy ?? '—'} · {abac.policy_count} candidate{abac.policy_count === 1 ? '' : 's'}</div>
              <div style={ratStyle}>{abac.decision.rationale}</div>
            </>
          ) : <div style={labelStyle}>loading…</div>}
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Learning attribution</div>
          {attribution ? (
            <>
              <div style={valStyle}>{(attribution.attribution.attribution_share * 100).toFixed(0)}%</div>
              <div style={labelStyle}>Δ {attribution.attribution.delta_mean.toFixed(1)}±{attribution.attribution.delta_sigma.toFixed(1)} · d={attribution.attribution.cohen_d.toFixed(2)} · n={attribution.attribution.cohort_size}</div>
              <div style={ratStyle}>{attribution.attribution.rationale}</div>
            </>
          ) : <div style={labelStyle}>loading…</div>}
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>SLA policy (default)</div>
          <div style={valStyle}>24h / 120h</div>
          <div style={labelStyle}>triage / resolve budgets</div>
          <div style={ratStyle}>Escalation chain: ops_lead → compliance_lead → exec_sponsor. Per-dispute envelopes available at <code>GET /api/wos/v2/dispute/sla/:id</code>.</div>
        </div>
      </div>
    </section>
  );
}
