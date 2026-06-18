/**
 * Phase 4 — AI Governance + Predictive Workforce Intelligence Page
 *
 * Tabs:
 *   Governance       — policies · model registry · risk classifications · decision log · hallucinations
 *   Fairness         — fairness scores · bias detection · protected attributes · run suite
 *   Localization     — countries · profile · cultural weights · adapt scores
 *   Predictive       — trajectories · classifications · future readiness · promotion · burnout
 *   Simulation       — scenarios · run · results
 *   Organizational   — capability risk · succession · leadership gap · resilience · critical
 *   Observability    — forecast accuracy · drift · monitoring · logs
 */
import React, { useEffect, useMemo, useState } from 'react';

type Tab = 'governance' | 'fairness' | 'localization' | 'predictive' | 'simulation' | 'risk' | 'observability';

const TABS: { id: Tab; label: string }[] = [
  { id: 'governance',   label: 'AI Governance' },
  { id: 'fairness',     label: 'Fairness & Bias' },
  { id: 'localization', label: 'Localization' },
  { id: 'predictive',   label: 'Predictive Workforce' },
  { id: 'simulation',   label: 'Workforce Simulation' },
  { id: 'risk',         label: 'Organizational Risk' },
  { id: 'observability',label: 'AI Observability' },
];

async function api<T = any>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
    const j = await r.json();
    return (j?.data ?? j) as T;
  } catch { return null; }
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const h3: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' };
const sub: React.CSSProperties = { fontSize: 12, color: '#64748b', marginTop: 4 };
const badge = (status?: string): React.CSSProperties => {
  const c = status === 'pass' || status === 'low' || status === 'meets' ? '#10b981'
          : status === 'warn' || status === 'moderate' || status === 'approaching' || status === 'developing' ? '#f59e0b'
          : status === 'fail' || status === 'high' || status === 'critical' || status === 'gap' ? '#ef4444'
          : status === 'elevated' ? '#f97316'
          : '#64748b';
  return { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#fff', background: c };
};

function Section({ title, sub: s, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={h3}>{title}</div>
      {s && <div style={sub}>{s}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: any[] }) {
  if (!rows || rows.length === 0) return <div style={{ fontSize: 12, color: '#94a3b8' }}>No data.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            {cols.map(c => <th key={c} style={{ textAlign: 'left', padding: '8px 6px', color: '#475569', fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {cols.map(c => {
                const v = r[c.toLowerCase().replace(/ /g, '_')];
                if (typeof v === 'object' && v !== null) return <td key={c} style={{ padding: '6px', color: '#475569' }}><code style={{ fontSize: 11 }}>{JSON.stringify(v)}</code></td>;
                if (c.toLowerCase().includes('status') || c.toLowerCase().includes('band') || c.toLowerCase().includes('tier'))
                  return <td key={c} style={{ padding: '6px' }}>{v ? <span style={badge(String(v))}>{String(v)}</span> : '—'}</td>;
                return <td key={c} style={{ padding: '6px', color: '#334155' }}>{v ?? '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------- Tab panels ------------------------------------------------------

function GovernanceTab() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [hallucinations, setHallu] = useState<any[]>([]);
  useEffect(() => {
    api('/api/m4/gov/policies').then(d => setPolicies(d ?? []));
    api('/api/m4/gov/models').then(d => setModels(d ?? []));
    api('/api/m4/gov/risk').then(d => setRisks(d ?? []));
    api('/api/m4/gov/decisions?limit=20').then(d => setDecisions(d ?? []));
    api('/api/m4/gov/hallucinations').then(d => setHallu(d ?? []));
  }, []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Governance Policies" sub="Active rules — language, fairness, explainability, safety, risk">
        <Table cols={['policy_code','category','enforcement','scope','version']} rows={policies} />
      </Section>
      <Section title="Model Registry" sub="Versioned AI models with risk tiering">
        <Table cols={['model_code','family','purpose','current_version','risk_tier']} rows={models} />
      </Section>
      <Section title="Risk Classifications" sub="Per-model tier + controls">
        <Table cols={['model_id','risk_tier','drivers','controls']} rows={risks} />
      </Section>
      <Section title="Recent Decisions" sub="With confidence + fairness status">
        <Table cols={['decision_type','subject_id','confidence','fairness_status']} rows={decisions} />
      </Section>
      <div style={{ gridColumn: '1 / -1' }}>
        <Section title="Hallucination + Safe-Language Flags" sub="Raised when forbidden phrasing or unsupported claims appear">
          <Table cols={['flag_type','severity','detail','flagged_at']} rows={hallucinations} />
        </Section>
      </div>
    </div>
  );
}

function FairnessTab() {
  const [scores, setScores] = useState<any[]>([]);
  const [bias, setBias] = useState<any[]>([]);
  const [pa, setPa] = useState<any[]>([]);
  const [runResult, setRunResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const refresh = () => {
    api('/api/m4/fair/scores').then(d => setScores(d ?? []));
    api('/api/m4/fair/bias').then(d => setBias(d ?? []));
    api('/api/m4/fair/protected-attributes').then(d => setPa(d ?? []));
  };
  useEffect(refresh, []);
  const run = async () => {
    setRunning(true);
    const r = await api('/api/m4/fair/run', { method: 'POST', body: JSON.stringify({ model_id: 'm4m_pred', n: 400 }) });
    setRunResult(r); setRunning(false); refresh();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Fairness Scores" sub="Most recent demographic_parity / disparate_impact / equal_opportunity per model">
        <Table cols={['model_id','metric','value','status','cohort']} rows={scores} />
      </Section>
      <Section title="Bias Detection" sub="Per protected attribute + drift delta vs. previous run">
        <Table cols={['model_id','protected_attr','bias_score','drift_delta','status']} rows={bias} />
      </Section>
      <Section title="Protected Attributes" sub="Excluded / monitored / controlled policy">
        <Table cols={['attr','policy','rationale']} rows={pa} />
      </Section>
      <Section title="Run Fairness Suite" sub="On-demand demographic parity + disparate impact + equal opportunity">
        <button onClick={run} disabled={running}
          style={{ padding: '8px 14px', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {running ? 'Running…' : 'Run on demo cohort (n=400)'}
        </button>
        {runResult && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#334155' }}>
            <div>Overall: <span style={badge(runResult.overall_status)}>{runResult.overall_status}</span></div>
            <pre style={{ background: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 8, overflow: 'auto', maxHeight: 220 }}>
{JSON.stringify({
  demographic_parity: runResult.demographic_parity,
  disparate_impact:   runResult.disparate_impact,
  equal_opportunity:  runResult.equal_opportunity,
}, null, 2)}
            </pre>
          </div>
        )}
      </Section>
    </div>
  );
}

function LocalizationTab() {
  const [countries, setCountries] = useState<any[]>([]);
  const [sel, setSel] = useState<string>('m4c_jp');
  const [profile, setProfile] = useState<any>(null);
  const [weights, setWeights] = useState<any>(null);
  const [adapted, setAdapted] = useState<any>(null);
  useEffect(() => { api('/api/m4/loc/countries').then(d => setCountries(d ?? [])); }, []);
  useEffect(() => {
    if (!sel) return;
    api(`/api/m4/loc/profile/${sel}`).then(setProfile);
    api(`/api/m4/loc/weights/${sel}?competencies=LEA,STR,COM,EIQ,ADP,TEC`).then(setWeights);
    api(`/api/m4/loc/adapt/${sel}?scores=${encodeURIComponent(JSON.stringify({LEA:70,STR:68,COM:72,EIQ:71,ADP:67,TEC:78}))}`).then(setAdapted);
  }, [sel]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Countries" sub="Select to compare regional intelligence">
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 }}>
          {countries.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.iso2})</option>)}
        </select>
        {profile?.country && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
            <div><b>Region:</b> {profile.country.region}</div>
            <div><b>Language:</b> {profile.country.language}</div>
            <div><b>Labor regime:</b> {profile.country.labor_regime}</div>
            <div><b>Market maturity:</b> {profile.workforce_profile?.market_maturity}</div>
            <div><b>Formality:</b> {profile.workforce_profile?.formality}</div>
            <div style={{ marginTop: 8 }}><b>Leadership model:</b> {profile.leadership_model?.model_name}</div>
          </div>
        )}
      </Section>
      <Section title="Cultural Norms" sub="Hofstede-style behavioural dimensions">
        <Table cols={['dimension','score','source']} rows={profile?.cultural_norms ?? []} />
      </Section>
      <Section title="Localized Weights" sub="base × cultural_modifier (clipped 0.7–1.3)">
        {weights && (
          <Table cols={['competency','base','cultural_modifier','localized']}
            rows={Object.entries(weights).map(([k,v]: any) => ({ competency: k, ...v }))} />
        )}
      </Section>
      <Section title="Score Adaptation" sub="Raw scores vs regional expected anchors">
        {adapted && (
          <Table cols={['competency','raw_score','regional_anchor','ratio','status','cultural_modifier']}
            rows={Object.entries(adapted).map(([k,v]: any) => ({ competency: k, ...v }))} />
        )}
      </Section>
    </div>
  );
}

function PredictiveTab() {
  const subject = 'demo_user';
  const [traj, setTraj] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [promo, setPromo] = useState<any[]>([]);
  const [lead, setLead] = useState<any>(null);
  const [burnout, setBurnout] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [decay, setDecay] = useState<any[]>([]);
  useEffect(() => {
    api(`/api/m4/pred/trajectories?subject_id=${subject}`).then(d => setTraj(d ?? []));
    api(`/api/m4/pred/classify?subject_id=${subject}`).then(d => setClasses(d ?? []));
    api(`/api/m4/pred/future-readiness?subject_id=${subject}&horizon_months=12`).then(setReadiness);
    api(`/api/m4/pred/promotion?subject_id=${subject}`).then(d => setPromo(d ?? []));
    api(`/api/m4/pred/leadership-potential?subject_id=${subject}`).then(setLead);
    api(`/api/m4/pred/burnout?subject_id=${subject}`).then(setBurnout);
    api(`/api/m4/pred/future-gaps?subject_id=${subject}`).then(d => setGaps(d ?? []));
    api(`/api/m4/pred/skill-decay?subject_id=${subject}`).then(d => setDecay(d ?? []));
  }, []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Capability Trajectories" sub="Velocity + acceleration + trajectory class">
        <Table cols={['competency_id','baseline','current','velocity','acceleration','trajectory']} rows={traj} />
      </Section>
      <Section title="Trajectory Classification" sub="accelerating · stable · plateauing · declining · high_potential · leadership_emerging">
        <Table cols={['competency_id','trajectory','velocity','acceleration']} rows={classes} />
      </Section>
      <Section title="Future Readiness (12mo)" sub="current + velocity·h + experience·h + market·h·0.25 − decay·h, band widens with (1−consistency)">
        {readiness && (
          <div style={{ fontSize: 13, color: '#334155' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1d4ed8' }}>{readiness.projection}</div>
            <div style={{ marginTop: 4, fontSize: 12 }}>Band: <b>{readiness.band_low}</b> — <b>{readiness.band_high}</b> · Confidence: <b>{readiness.confidence}</b></div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
              Contributors: {Object.entries(readiness.contributors ?? {}).map(([k,v]) => `${k}=${v}`).join(' · ')}
            </div>
          </div>
        )}
      </Section>
      <Section title="Promotion Readiness" sub="Developmental band per target role — capability alignment, never a hiring prediction">
        <Table cols={['target_role_id','readiness','horizon_months','confidence','band']} rows={promo} />
      </Section>
      <Section title="Leadership Potential" sub="Emergence horizon + driver competencies">
        {lead && (
          <div style={{ fontSize: 13, color: '#334155' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>{lead.potential} <span style={{ fontSize: 12 }}><span style={badge(lead.band)}>{lead.band}</span></span></div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Emergence horizon: {lead.emergence_horizon_months} months</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Drivers: {JSON.stringify(lead.drivers)}</div>
          </div>
        )}
      </Section>
      <Section title="Burnout Risk (well-being signal, not diagnosis)" sub="0.50·workload + 0.25·(1−recovery) + 0.25·variance">
        {burnout && (
          <div style={{ fontSize: 13, color: '#334155' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0891b2' }}>{burnout.risk} <span style={{ fontSize: 12 }}><span style={badge(burnout.band)}>{burnout.band}</span></span></div>
            <pre style={{ background: '#f8fafc', padding: 10, borderRadius: 8, fontSize: 11, marginTop: 8 }}>{JSON.stringify(burnout.drivers, null, 2)}</pre>
          </div>
        )}
      </Section>
      <Section title="Future Capability Gaps" sub="Forecast vs required levels">
        <Table cols={['competency_id','current','required','gap','horizon_months']} rows={gaps} />
      </Section>
      <Section title="Skill Decay Forecasts" sub="Decay rate (pts/month) and obsolescence horizon">
        <Table cols={['competency_id','decay_rate','half_life_months','obsolescence_horizon_months']} rows={decay} />
      </Section>
    </div>
  );
}

function SimulationTab() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [pick, setPick] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    api('/api/m4/sim/scenarios').then(d => { setScenarios(d ?? []); if (d && d[0]) setPick(d[0].scenario_code); });
  }, []);
  const run = async () => {
    if (!pick) return;
    setRunning(true);
    const r = await api('/api/m4/sim/run', { method: 'POST', body: JSON.stringify({ scenario: pick, subject_id: 'demo_user', horizon_months: 12 }) });
    setResult(r); setRunning(false);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Scenarios" sub="What-if uplift / promotion / pipeline simulations">
        <Table cols={['scenario_code','name','kind']} rows={scenarios} />
      </Section>
      <Section title="Run Simulation" sub="Projects readiness over 12mo using capability uplift model">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={pick} onChange={e => setPick(e.target.value)}
            style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 }}>
            {scenarios.map((s: any) => <option key={s.scenario_code} value={s.scenario_code}>{s.name}</option>)}
          </select>
          <button onClick={run} disabled={running || !pick}
            style={{ padding: '8px 14px', borderRadius: 8, border: 0, background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
        {result && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>
            <div>Baseline: <b>{result.baseline_readiness}</b> → Projected: <b style={{ color: '#7c3aed' }}>{result.projected_readiness}</b> ({result.delta >= 0 ? '+' : ''}{result.delta} pts over {result.horizon_months}mo)</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{result.rationale}</div>
            <div style={{ marginTop: 10 }}>
              <Table cols={['competency_id','baseline','after_uplift','projection','band_low','band_high','confidence']} rows={result.per_competency ?? []} />
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function RiskTab() {
  const [caps, setCaps] = useState<any[]>([]);
  const [succ, setSucc] = useState<any[]>([]);
  const [lead, setLead] = useState<any[]>([]);
  const [res, setRes] = useState<any[]>([]);
  const [crit, setCrit] = useState<any[]>([]);
  useEffect(() => {
    api('/api/m4/risk/capabilities').then(d => setCaps(d ?? []));
    api('/api/m4/risk/succession').then(d => setSucc(d ?? []));
    api('/api/m4/risk/leadership-gaps').then(d => setLead(d ?? []));
    api('/api/m4/risk/resilience').then(d => setRes(d ?? []));
    api('/api/m4/risk/critical').then(d => setCrit(d ?? []));
  }, []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Capability Risks" sub="Org-unit × competency coverage gap"><Table cols={['org_unit','competency_id','risk','band']} rows={caps} /></Section>
      <Section title="Succession Risk" sub="Successor windows + readiness across 24mo"><Table cols={['role_id','successors_n','ready_now','ready_12m','ready_24m','risk','band']} rows={succ} /></Section>
      <Section title="Leadership Gap" sub="Forecast gap % per org unit"><Table cols={['org_unit','horizon_months','gap_pct']} rows={lead} /></Section>
      <Section title="Workforce Resilience" sub="0.40·redundancy + 0.35·mobility + 0.25·learning_velocity"><Table cols={['org_unit','resilience','contributors']} rows={res} /></Section>
      <div style={{ gridColumn: '1 / -1' }}>
        <Section title="Critical Capability Risks" sub="High-criticality + low-coverage capabilities"><Table cols={['competency_id','org_unit','criticality','coverage','risk']} rows={crit} /></Section>
      </div>
    </div>
  );
}

function ObservabilityTab() {
  const [acc, setAcc] = useState<any[]>([]);
  const [drift, setDrift] = useState<any[]>([]);
  const [mon, setMon] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    api('/api/m4/obs/accuracy').then(d => setAcc(d ?? []));
    api('/api/m4/obs/drift').then(d => setDrift(d ?? []));
    api('/api/m4/obs/monitoring').then(d => setMon(d ?? []));
    api('/api/m4/obs/logs').then(d => setLogs(d ?? []));
  }, []);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Section title="Forecast Accuracy" sub="MAPE + Brier per model × horizon"><Table cols={['model_id','horizon_months','mape','brier','sample_n']} rows={acc} /></Section>
      <Section title="Model Drift" sub="PSI default; warn ≥0.10, fail ≥0.20"><Table cols={['model_id','drift_metric','value','threshold','status']} rows={drift} /></Section>
      <Section title="Prediction Monitoring" sub="Live metric stream"><Table cols={['model_id','metric','value','status']} rows={mon} /></Section>
      <Section title="Observability Logs" sub="Recent engine events"><Table cols={['level','source','event','recorded_at']} rows={logs} /></Section>
    </div>
  );
}

// -------- Page shell ------------------------------------------------------

export default function AIGovernancePage() {
  const [tab, setTab] = useState<Tab>('governance');
  const [versions, setVersions] = useState<Record<string, string>>({});
  useEffect(() => { api('/api/m4/_meta/versions').then(d => setVersions(d ?? {})); }, []);
  const versionRow = useMemo(() => Object.entries(versions).map(([k, v]) => `${k}=${v}`).join(' · '), [versions]);
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>AI Governance + Predictive Workforce Intelligence</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569', maxWidth: 760 }}>
              Phase 4 — explainable AI governance, fairness + bias detection, localization intelligence, predictive workforce forecasting,
              what-if simulation, organizational risk, and AI observability. All outputs are <b>developmental signals</b> — never hiring or
              promotion predictions.
            </p>
          </div>
          <a href="?screen=market-intelligence" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>← Market Intelligence (Phase 3)</a>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (tab === t.id ? '#1d4ed8' : '#cbd5e1'),
                background: tab === t.id ? '#1d4ed8' : '#fff',
                color: tab === t.id ? '#fff' : '#334155',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{t.label}</button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {tab === 'governance'    && <GovernanceTab />}
          {tab === 'fairness'      && <FairnessTab />}
          {tab === 'localization'  && <LocalizationTab />}
          {tab === 'predictive'    && <PredictiveTab />}
          {tab === 'simulation'    && <SimulationTab />}
          {tab === 'risk'          && <RiskTab />}
          {tab === 'observability' && <ObservabilityTab />}
        </div>

        <div style={{ marginTop: 24, fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
          {versionRow || 'loading versions…'}
        </div>
      </div>
    </div>
  );
}
