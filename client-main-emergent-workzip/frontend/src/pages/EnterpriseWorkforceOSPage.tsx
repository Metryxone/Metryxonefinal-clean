import { DashboardIntro } from '../components/career/DashboardIntro';
import React, { useEffect, useMemo, useState } from 'react';

type Tab =
  | 'workforce'
  | 'executive'
  | 'succession'
  | 'heatmap'
  | 'simulation'
  | 'coaching'
  | 'benchmark'
  | 'graph'
  | 'observability';

const TABS: { id: Tab; label: string }[] = [
  { id: 'workforce', label: 'Workforce Command' },
  { id: 'executive', label: 'Executive Intelligence' },
  { id: 'succession', label: 'Succession' },
  { id: 'heatmap', label: 'Org Heatmap' },
  { id: 'simulation', label: 'Workforce Simulation' },
  { id: 'coaching', label: 'AI Coaching' },
  { id: 'benchmark', label: 'Enterprise Benchmark' },
  { id: 'graph', label: 'Org Graph' },
  { id: 'observability', label: 'Observability' },
];

async function api<T = any>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(path, init);
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.data ?? j) as T;
  } catch { return null; }
}

const RISK_COLOR: Record<string, string> = { red: '#dc2626', amber: '#d97706', green: '#16a34a' };

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{title}</div>
    {subtitle && <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>{subtitle}</div>}
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string | number; tone?: 'good' | 'warn' | 'bad' }> = ({ label, value, tone }) => {
  const color = tone === 'good' ? '#16a34a' : tone === 'warn' ? '#d97706' : tone === 'bad' ? '#dc2626' : '#111827';
  return (
    <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
};

const Table: React.FC<{ rows: any[]; cols: string[] }> = ({ rows, cols }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>{cols.map(c => (
          <th key={c} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500 }}>{c}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 16, color: '#9ca3af', textAlign: 'center' }}>No data</td></tr>}
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
            {cols.map(c => {
              const v = r[c];
              return <td key={c} style={{ padding: '8px 10px' }}>{
                typeof v === 'number' ? v.toFixed(c.includes('pct') || c.includes('score') ? 1 : 2)
                : typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 80)
                : String(v ?? '—')
              }</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SeverityChip: React.FC<{ value: string }> = ({ value }) => {
  const tone = ['high', 'critical', 'red'].includes(value) ? '#dc2626'
             : ['medium', 'amber', 'warn'].includes(value) ? '#d97706'
             : '#16a34a';
  return <span style={{ background: `${tone}22`, color: tone, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{value}</span>;
};

// ============================================================================
// Workforce Command tab
// ============================================================================
const WorkforceTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [eci, setEci] = useState<any>(null);
  const [maturity, setMaturity] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [indices, setIndices] = useState<any>(null);

  useEffect(() => {
    api(`/api/m5/wfi/eci?org_id=${orgId}`).then(setEci);
    api(`/api/m5/wfi/maturity?org_id=${orgId}`).then(setMaturity);
    api(`/api/m5/wfi/readiness?org_id=${orgId}`).then(setReadiness);
    api<any[]>(`/api/m5/wfi/skill-gaps?org_id=${orgId}`).then(d => setGaps(d ?? []));
    api<any[]>(`/api/m5/wfi/departments?org_id=${orgId}`).then(d => setDepts(d ?? []));
    api(`/api/m5/wfi/indices?org_id=${orgId}`).then(setIndices);
  }, [orgId]);

  return (
    <>
      <Card title="Enterprise Capability Index" subtitle="Composite of workforce, leadership, future readiness, agility, resilience">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat label="ECI" value={eci?.enterprise_capability_index?.toFixed(1) ?? '—'} tone="good" />
          <Stat label="Maturity Level" value={`L${maturity?.maturity_level ?? '—'}`} />
          <Stat label="Maturity Score" value={maturity?.maturity_score?.toFixed(1) ?? '—'} />
          <Stat label="Readiness" value={readiness?.readiness_score?.toFixed(1) ?? '—'} />
          <Stat label="Readiness Band" value={readiness ? `${readiness.band_low?.toFixed(0)} – ${readiness.band_high?.toFixed(0)}` : '—'} />
          <Stat label="Consistency" value={readiness?.consistency ?? '—'} />
        </div>
      </Card>
      <Card title="Enterprise Indices" subtitle="Per-dimension index values with contributors">
        <Table rows={indices?.indices ?? []} cols={['index_type', 'index_value', 'confidence_tier']} />
      </Card>
      <Card title="Department Capability Scores">
        <Table rows={depts} cols={['department', 'capability_score', 'leadership_score', 'readiness_score']} />
      </Card>
      <Card title="Organizational Skill Gaps" subtitle="Ranked by gap magnitude × population affected">
        <Table rows={gaps} cols={['competency_id', 'current', 'target', 'gap', 'affected_population', 'severity']} />
      </Card>
    </>
  );
};

// ============================================================================
// Executive Intelligence tab
// ============================================================================
const ExecutiveTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [insights, setInsights] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [transformation, setTransformation] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);

  useEffect(() => {
    api<any[]>(`/api/m5/exec/insights?org_id=${orgId}`).then(d => setInsights(d ?? []));
    api<any[]>(`/api/m5/exec/strategic-risks?org_id=${orgId}`).then(d => setRisks(d ?? []));
    api(`/api/m5/exec/transformation-readiness?org_id=${orgId}`).then(setTransformation);
    api<any[]>(`/api/m5/exec/recommendations?org_id=${orgId}`).then(d => setRecs(d ?? []));
    api<any[]>(`/api/m5/exec/interventions?org_id=${orgId}`).then(d => setInterventions(d ?? []));
  }, [orgId]);

  return (
    <>
      <Card title="Transformation Readiness">
        {transformation ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Stat label="Readiness" value={transformation.readiness_score?.toFixed(1)} tone="warn" />
            <Stat label="Band" value={transformation.band ?? '—'} />
            {transformation.pillars && Object.entries(transformation.pillars).map(([k, v]: any) => (
              <Stat key={k} label={k} value={typeof v === 'number' ? v.toFixed(0) : String(v)} />
            ))}
          </div>
        ) : <div style={{ color: '#9ca3af' }}>No transformation snapshot yet.</div>}
      </Card>
      <Card title="Executive Insights">
        {insights.map(i => (
          <div key={i.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{i.headline}</strong>
              <SeverityChip value={i.severity} />
            </div>
            <div style={{ color: '#4b5563', fontSize: 13, marginTop: 4 }}>{i.detail}</div>
          </div>
        ))}
      </Card>
      <Card title="Strategic Workforce Risks" subtitle="Ranked by composite risk = likelihood × impact">
        <Table rows={risks} cols={['risk_type', 'likelihood', 'impact', 'composite_risk', 'mitigation']} />
      </Card>
      <Card title="Executive Recommendations" subtitle="With evidence + expected impact + confidence">
        {recs.map(r => (
          <div key={r.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>P{r.priority}</span>
              <strong>{r.recommendation}</strong>
              <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 12 }}>conf {(+r.confidence).toFixed(2)}</span>
            </div>
            <div style={{ color: '#4b5563', fontSize: 13, marginTop: 4 }}>{r.rationale}</div>
            {r.expected_impact && <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Impact: {JSON.stringify(r.expected_impact)}</div>}
          </div>
        ))}
      </Card>
      <Card title="Intervention Recommendations">
        <Table rows={interventions} cols={['scope', 'intervention', 'expected_outcome', 'status']} />
      </Card>
    </>
  );
};

// ============================================================================
// Succession tab
// ============================================================================
const SuccessionTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => { api(`/api/m5/succ/summary?org_id=${orgId}`).then(setSummary); }, [orgId]);
  if (!summary) return <Card title="Loading succession data…"><div /></Card>;
  return (
    <>
      <Card title="Succession Health">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat label="Total Candidates" value={summary.total_candidates} />
          <Stat label="Ready Now" value={summary.ready_now} tone={summary.ready_now > 0 ? 'good' : 'bad'} />
          <Stat label="Ready 12m" value={summary.ready_12m} tone="warn" />
          <Stat label="Avg Bench Strength" value={summary.avg_bench_strength} />
        </div>
      </Card>
      <Card title="Top Successor Candidates" subtitle="Ranked by composite readiness (LC + SR + MA + FP, modulated by reliability)">
        <Table rows={summary.top_candidates ?? []} cols={['user_id', 'target_role_id', 'readiness_score', 'readiness_band', 'time_to_ready_months', 'reliability_confidence']} />
      </Card>
      <Card title="Critical Roles & Successor Depth">
        <Table rows={summary.critical_roles ?? []} cols={['role_id', 'criticality', 'successor_count', 'bench_depth']} />
      </Card>
      <Card title="Leadership Gap Risks">
        <Table rows={summary.gap_risks ?? []} cols={['layer', 'open_positions', 'ready_now', 'ready_12m', 'ready_24m', 'risk_level']} />
      </Card>
      <Card title="Bench Strength by Layer">
        <Table rows={summary.bench_strength ?? []} cols={['layer', 'strength_score', 'depth', 'diversity_index']} />
      </Card>
    </>
  );
};

// ============================================================================
// Heatmap tab
// ============================================================================
const HeatmapTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/api/m5/wfi/heatmap?org_id=${orgId}`).then(d => setRows(d ?? [])); }, [orgId]);

  const grid = useMemo(() => {
    const depts = Array.from(new Set(rows.map(r => r.department)));
    const comps = Array.from(new Set(rows.map(r => r.competency_id)));
    const cell = (d: string, c: string) => rows.find(r => r.department === d && r.competency_id === c);
    return { depts, comps, cell };
  }, [rows]);

  return (
    <Card title="Workforce Capability Heatmap" subtitle="Department × competency intensity (red = critical · amber = at-risk · green = healthy)">
      {grid.depts.length === 0 ? <div style={{ color: '#9ca3af' }}>No heatmap data.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 500 }}></th>
                {grid.comps.map(c => <th key={c} style={{ padding: '8px 10px', textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.depts.map(d => (
                <tr key={d}>
                  <td style={{ padding: '8px 10px', fontWeight: 500 }}>{d}</td>
                  {grid.comps.map(c => {
                    const x = grid.cell(d, c);
                    if (!x) return <td key={c}></td>;
                    const color = RISK_COLOR[x.risk_tier] ?? '#9ca3af';
                    return (
                      <td key={c} style={{ padding: 4 }}>
                        <div style={{ background: `${color}33`, color, fontWeight: 600, borderRadius: 6, textAlign: 'center', padding: '10px 12px', minWidth: 70 }}>
                          {(+x.intensity).toFixed(0)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

// ============================================================================
// Simulation tab
// ============================================================================
const SimulationTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [chosen, setChosen] = useState<string>('LEADERSHIP_UPLIFT_12');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<any[]>(`/api/m5/sim/scenarios?org_id=${orgId}`).then(d => setScenarios(d ?? []));
    api(`/api/m5/sim/future-forecast?org_id=${orgId}&horizon_months=18`).then(setForecast);
  }, [orgId]);

  async function run() {
    setBusy(true);
    const r = await fetch('/api/m5/sim/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, scenario_code: chosen, horizon_months: 12 }),
    }).then(r => r.json()).catch(() => null);
    setResult(r?.data ?? null);
    setBusy(false);
  }

  return (
    <>
      <Card title="Future Workforce Forecast (18 months)" subtitle="Conservative projection bands">
        {forecast && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat label="Projected Capability" value={forecast.projected_capability?.toFixed(1)} />
            <Stat label="Projected Leadership" value={forecast.projected_leadership?.toFixed(1)} />
            <Stat label="Projected Resilience" value={forecast.projected_resilience?.toFixed(1)} />
            <Stat label="Band" value={`${forecast.band_low?.toFixed(0)} – ${forecast.band_high?.toFixed(0)}`} />
          </div>
        )}
      </Card>
      <Card title="Run Organizational Simulation">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <select value={chosen} onChange={e => setChosen(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
            {scenarios.map(s => <option key={s.scenario_code} value={s.scenario_code}>{s.scenario_name}</option>)}
          </select>
          <button onClick={run} disabled={busy} style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Running…' : 'Run Simulation'}
          </button>
        </div>
        {result && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Stat label="Baseline Avg" value={result.baseline_avg?.toFixed(1)} />
              <Stat label="Projected Avg" value={result.projected_avg?.toFixed(1)} tone="good" />
              <Stat label="Composite Δ" value={`+${result.composite_delta?.toFixed(2)}`} tone="good" />
              <Stat label="Leadership Lift %" value={`+${result.derived?.leadership_capability_lift_pct?.toFixed(1)}%`} />
              <Stat label="Succession Lift %" value={`+${result.derived?.succession_readiness_lift_pct?.toFixed(1)}%`} />
              <Stat label="Resilience Lift %" value={`+${result.derived?.organizational_resilience_lift_pct?.toFixed(1)}%`} />
            </div>
            <Table rows={result.capability_uplifts ?? []} cols={['competency_id', 'baseline', 'uplift_pct', 'projected', 'band_low', 'band_high']} />
            {result.learning_impact && (
              <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                <strong>Learning ROI:</strong> ROI {result.learning_impact.expected_roi}× · Capability lift +{result.learning_impact.capability_lift} · Payback {result.learning_impact.payback_months} mo
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
};

// ============================================================================
// AI Coaching tab
// ============================================================================
const CoachingTab: React.FC = () => {
  const [plan, setPlan] = useState<any>(null);
  const [learning, setLearning] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);

  useEffect(() => {
    api(`/api/m5/coach/growth-plan?user_id=demo_user&target_role_id=role_director_engineering&horizon_months=12`).then(setPlan);
    api<any[]>(`/api/m5/coach/learning?user_id=demo_user`).then(d => setLearning(d ?? []));
    api<any[]>(`/api/m5/coach/mentors?user_id=demo_user`).then(d => setMentors(d ?? []));
  }, []);

  return (
    <>
      <Card title="Adaptive Growth Roadmap" subtitle="Current capability + target role + market demand + learning velocity → ranked steps">
        {plan && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="Confidence" value={(+plan.confidence).toFixed(2)} />
            <Stat label="Total Gap" value={plan.total_gap?.toFixed(1)} />
            <Stat label="Projected Uplift" value={`+${plan.total_projected_uplift?.toFixed(1)}`} tone="good" />
            <Stat label="Horizon" value={`${plan.horizon_months} mo`} />
          </div>
        )}
        <Table rows={plan?.steps ?? []} cols={['competency_id', 'baseline', 'target', 'gap', 'market_demand', 'priority', 'projected_uplift']} />
      </Card>
      <Card title="Learning Recommendations">
        <Table rows={learning} cols={['competency_id', 'resource_type', 'resource_title', 'expected_uplift', 'priority']} />
      </Card>
      <Card title="Mentor Matches">
        <Table rows={mentors} cols={['mentor_user_id', 'match_score', 'rationale']} />
      </Card>
    </>
  );
};

// ============================================================================
// Benchmark tab
// ============================================================================
const BenchmarkTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [orgB, setOrgB] = useState<any[]>([]);
  const [industry, setIndustry] = useState<any[]>([]);
  const [leadership, setLeadership] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>(`/api/m5/bench/org?org_id=${orgId}`).then(d => setOrgB(d ?? []));
    api<any[]>(`/api/m5/bench/industry?industry=technology`).then(d => setIndustry(d ?? []));
    api<any[]>(`/api/m5/bench/leadership?industry=technology`).then(d => setLeadership(d ?? []));
  }, [orgId]);
  return (
    <>
      <Card title="Organization vs Peer Cohort">
        <Table rows={orgB} cols={['metric', 'org_value', 'cohort_p50', 'cohort_p90', 'percentile']} />
      </Card>
      <Card title="Industry Benchmarks (Technology)">
        <Table rows={industry} cols={['metric', 'p25', 'p50', 'p75', 'p90', 'sample_n']} />
      </Card>
      <Card title="Leadership Benchmarks">
        <Table rows={leadership} cols={['layer', 'capability_p50', 'bench_depth_p50', 'succession_p50']} />
      </Card>
    </>
  );
};

// ============================================================================
// Org Graph tab
// ============================================================================
const GraphTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [risk, setRisk] = useState<any>(null);
  useEffect(() => {
    api<any[]>(`/api/m5/graph/nodes?org_id=${orgId}`).then(d => setNodes(d ?? []));
    api<any[]>(`/api/m5/graph/departments?org_id=${orgId}`).then(d => setDepts(d ?? []));
    api<any[]>(`/api/m5/graph/leadership-influence?org_id=${orgId}`).then(d => setLeaders(d ?? []));
    api(`/api/m5/graph/concentration-risk?org_id=${orgId}`).then(setRisk);
  }, [orgId]);
  return (
    <>
      <Card title="Concentration Risk" subtitle="Capability concentration; departments ≥40% collaboration share are fragile">
        {risk && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Stat label="Concentration Index" value={(+risk.concentration_index).toFixed(2)} tone={risk.fragile_nodes?.length ? 'warn' : 'good'} />
            <Stat label="Fragile Nodes" value={risk.fragile_nodes?.length ?? 0} tone={risk.fragile_nodes?.length ? 'bad' : 'good'} />
          </div>
        )}
        {risk?.dept_shares && <div style={{ marginTop: 12 }}><Table rows={risk.dept_shares} cols={['dept', 'share']} /></div>}
      </Card>
      <Card title="Organizational Nodes">
        <Table rows={nodes} cols={['node_type', 'node_id', 'label']} />
      </Card>
      <Card title="Department Collaboration Graph">
        <Table rows={depts} cols={['dept_a', 'dept_b', 'collaboration_strength', 'shared_capabilities']} />
      </Card>
      <Card title="Leadership Influence">
        <Table rows={leaders} cols={['leader_user_id', 'influence_score', 'influence_radius', 'centrality']} />
      </Card>
    </>
  );
};

// ============================================================================
// Observability tab
// ============================================================================
const ObservabilityTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [drift, setDrift] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    api(`/api/m5/obs/drift?org_id=${orgId}`).then(setDrift);
    api<any[]>(`/api/m5/obs/logs?org_id=${orgId}`).then(d => setLogs(d ?? []));
  }, [orgId]);
  return (
    <>
      <Card title="Forecast Drift Status">
        {drift && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Stat label="Total Forecasts" value={drift.total} />
              <Stat label="Stable" value={drift.breakdown?.stable ?? 0} tone="good" />
              <Stat label="Warning" value={drift.breakdown?.warning ?? 0} tone="warn" />
              <Stat label="Critical" value={drift.breakdown?.critical ?? 0} tone="bad" />
            </div>
            <Table rows={drift.rows ?? []} cols={['forecast_type', 'mape', 'brier', 'psi', 'drift_status']} />
          </>
        )}
      </Card>
      <Card title="Observability Event Log">
        <Table rows={logs.slice(0, 50)} cols={['event_type', 'occurred_at', 'payload']} />
      </Card>
    </>
  );
};

// ============================================================================
// Page
// ============================================================================
const EnterpriseWorkforceOSPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('workforce');
  const [orgId, setOrgId] = useState('demo_org');

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '24px 32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Enterprise Workforce Intelligence OS</h1>
            <p style={{ color: '#4b5563', maxWidth: 800, margin: '4px 0 0' }}>
              Phase 5 — workforce command center, succession intelligence, AI coaching, organizational simulation,
              executive decision intelligence, enterprise benchmarking, organizational graph, and observability.
              All outputs are <strong>developmental signals</strong> — never hiring or promotion predictions.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <label style={{ color: '#6b7280' }}>org:</label>
            <input value={orgId} onChange={e => setOrgId(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: 140 }} />
          </div>
        </div>

        <DashboardIntro
          title="Enterprise Workforce OS"
          whatItIs="The executive command center — succession readiness, AI coaching, organisational simulation, observability, fairness monitoring and enterprise benchmarking in one place."
          whenToUse="Strategic workforce decisions, scenario planning, board-level reporting and governance reviews."
          audience="Executives · Admins · CHRO office"
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: tab === t.id ? '#1d4ed8' : '#fff',
                color: tab === t.id ? '#fff' : '#374151',
                fontWeight: tab === t.id ? 600 : 500, fontSize: 13,
                border: tab === t.id ? 'none' : '1px solid #e5e7eb',
              }}>{t.label}</button>
          ))}
        </div>

        {tab === 'workforce' && <WorkforceTab orgId={orgId} />}
        {tab === 'executive' && <ExecutiveTab orgId={orgId} />}
        {tab === 'succession' && <SuccessionTab orgId={orgId} />}
        {tab === 'heatmap' && <HeatmapTab orgId={orgId} />}
        {tab === 'simulation' && <SimulationTab orgId={orgId} />}
        {tab === 'coaching' && <CoachingTab />}
        {tab === 'benchmark' && <BenchmarkTab orgId={orgId} />}
        {tab === 'graph' && <GraphTab orgId={orgId} />}
        {tab === 'observability' && <ObservabilityTab orgId={orgId} />}
      </div>
    </div>
  );
};

export default EnterpriseWorkforceOSPage;
