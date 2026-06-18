/**
 * Scientific Competency Intelligence — Phase 2 explorer page
 * Read-only consumer of /api/sci/* endpoints. Enhancement-only; does not
 * modify existing CompetencyDashboard.tsx.
 */
import { useEffect, useMemo, useState } from 'react';

type AnyObj = Record<string, any>;
const API = '/api/sci';
const PANELS = ['BARS', 'Frameworks', 'Dependency Graph', 'Psychometrics', 'Confidence', 'Gaps'] as const;
type Panel = typeof PANELS[number];

const LAYERS = ['IC', 'LEAD', 'MGR', 'STRAT', 'EXEC'];
const COMPS = ['EIQ', 'COM', 'COG', 'EXE', 'LEA', 'STR', 'LBI', 'ADP', 'TEC'];
const DEMO_SCORES: Record<string, number> = {
  EIQ: 62, COM: 58, COG: 71, EXE: 66, LEA: 48, STR: 41, LBI: 55, ADP: 60, TEC: 64,
};

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function Section({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Tag({ children, color = 'slate' }: { children: React.ReactNode; color?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'purple' }) {
  const map: any = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    red:   'bg-rose-100 text-rose-700',
    blue:  'bg-sky-100 text-sky-700',
    purple:'bg-violet-100 text-violet-700',
  };
  return <span className={`inline-block text-[10px] uppercase tracking-wide font-semibold rounded-md px-1.5 py-0.5 ${map[color]}`}>{children}</span>;
}

// ─── BARS Panel ───────────────────────────────────────────────────────
function BarsPanel() {
  const [comp, setComp] = useState('COM');
  const [layer, setLayer] = useState('MGR');
  const [score, setScore] = useState(72);
  const [anchors, setAnchors] = useState<AnyObj[]>([]);
  const [resolved, setResolved] = useState<AnyObj | null>(null);
  useEffect(() => {
    fetchJSON(`${API}/bars/${comp}/${layer}`).then(r => setAnchors(r.data || []));
    fetchJSON(`${API}/bars/${comp}/${layer}/resolve?score=${score}`).then(r => setResolved(r.data));
  }, [comp, layer, score]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs"><div className="text-slate-500 mb-1">Competency</div>
          <select value={comp} onChange={e => setComp(e.target.value)} className="border rounded px-2 py-1">
            {COMPS.map(c => <option key={c}>{c}</option>)}
          </select></label>
        <label className="text-xs"><div className="text-slate-500 mb-1">Role layer</div>
          <select value={layer} onChange={e => setLayer(e.target.value)} className="border rounded px-2 py-1">
            {LAYERS.map(l => <option key={l}>{l}</option>)}
          </select></label>
        <label className="text-xs"><div className="text-slate-500 mb-1">Score 0–100</div>
          <input type="number" min={0} max={100} value={score} onChange={e => setScore(+e.target.value)}
            className="border rounded px-2 py-1 w-20" /></label>
      </div>
      {resolved && (
        <Section title={`Resolved → ${resolved.current_level ?? '—'}`} subtitle={`Score ${score} at ${layer}`}>
          <p className="text-sm text-slate-700">{resolved.current_anchor}</p>
          <p className="text-xs text-slate-500 mt-1">Observable: {resolved.observable_behavior}</p>
          {resolved.next_level && (
            <p className="text-xs text-sky-700 mt-2">↗ Next: <b>{resolved.next_level}</b> — {resolved.next_anchor}</p>
          )}
        </Section>
      )}
      <Section title="All 5 BARS levels" subtitle="Foundational → Developing → Proficient → Advanced → Expert">
        <div className="grid gap-2">
          {anchors.map(a => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag color="purple">{a.proficiency_level}</Tag>
                <span className="text-xs text-slate-500">Score {a.score_min}–{a.score_max}</span>
              </div>
              <p className="text-sm text-slate-800">{a.behavioral_anchor}</p>
              <p className="text-xs text-slate-500 mt-1">{a.observable_behavior}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Frameworks Panel ─────────────────────────────────────────────────
function FrameworksPanel() {
  const [frameworks, setFrameworks] = useState<AnyObj[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [scored, setScored] = useState<AnyObj | null>(null);
  useEffect(() => { fetchJSON(`${API}/frameworks`).then(r => {
    setFrameworks(r.data || []);
    if (r.data?.[0]) setSelected(r.data[0].id);
  }); }, []);
  useEffect(() => {
    if (!selected) return;
    fetchJSON(`${API}/frameworks/${selected}`).then(r => setDetail(r.data));
    fetchJSON(`${API}/frameworks/${selected}/score?scores=${encodeURIComponent(JSON.stringify(DEMO_SCORES))}`)
      .then(r => setScored(r.data));
  }, [selected]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {frameworks.map(f => (
          <button key={f.id} onClick={() => setSelected(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${selected === f.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-700 border-slate-300'}`}>
            {f.code} <span className="opacity-60 ml-1">{f.authority}</span>
          </button>
        ))}
      </div>
      {detail && (
        <Section title={detail.name} subtitle={detail.description}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(detail.competencies || []).map((c: AnyObj) => (
              <div key={c.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Tag color="blue">{c.external_code}</Tag>
                  {c.ontology_competency_id && <Tag color="green">→ {c.ontology_competency_id}</Tag>}
                  {c.proficiency_level && <span className="text-[10px] text-slate-500">{c.proficiency_level}</span>}
                </div>
                <p className="text-sm font-medium text-slate-800">{c.name}</p>
                <p className="text-xs text-slate-500 mt-1">{c.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {scored && (
        <Section title="Demo scoring through framework lens" subtitle={`Coverage ${(scored.coverage * 100).toFixed(0)}% · Avg ${scored.average_score?.toFixed(1) ?? '—'}`}>
          <ul className="text-xs space-y-1">
            {scored.items.filter((i: AnyObj) => i.mapped_score != null).map((i: AnyObj) => (
              <li key={i.framework_competency_id} className="flex justify-between gap-2">
                <span>{i.external_code} · {i.name}</span>
                <span className="font-mono text-slate-700">→ {i.ontology_competency_id} = {i.mapped_score}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── Graph Panel ──────────────────────────────────────────────────────
function GraphPanel() {
  const [edges, setEdges] = useState<AnyObj[]>([]);
  const [target, setTarget] = useState('LEA');
  const [paths, setPaths] = useState<AnyObj[]>([]);
  const [seq, setSeq] = useState<AnyObj[]>([]);
  const [pathFrom, setPathFrom] = useState('EIQ');
  const [pathTo, setPathTo] = useState('STR');
  useEffect(() => { fetchJSON(`${API}/graph/edges`).then(r => setEdges(r.data || [])); }, []);
  useEffect(() => {
    fetchJSON(`${API}/graph/sequence/${target}?scores=${encodeURIComponent(JSON.stringify(DEMO_SCORES))}`)
      .then(r => setSeq(r.data || []));
  }, [target]);
  useEffect(() => {
    fetchJSON(`${API}/graph/paths?from=${pathFrom}&to=${pathTo}&max_depth=5`).then(r => setPaths(r.data || []));
  }, [pathFrom, pathTo]);
  const relColor = (t: string): 'blue'|'amber'|'purple'|'green'|'slate' => {
    if (t === 'prerequisite') return 'amber';
    if (t === 'amplification') return 'purple';
    if (t === 'leadership_progression') return 'blue';
    if (t === 'acceleration') return 'green';
    return 'slate';
  };
  return (
    <div className="space-y-4">
      <Section title="Edges" subtitle={`${edges.length} relationships across the competency graph`}>
        <ul className="text-xs space-y-1">
          {edges.map(e => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="font-mono">{e.source_competency_id}</span>
              <Tag color={relColor(e.relationship_type)}>{e.relationship_type}</Tag>
              <span className="font-mono">→ {e.target_competency_id}</span>
              <span className="text-slate-400">· w {e.strength}</span>
              <span className="text-slate-500 ml-2 truncate">{e.evidence_basis}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Path traversal (BFS depth-capped)" subtitle="Find ranked paths between two competencies">
        <div className="flex gap-2 items-end mb-2">
          <label className="text-xs">From <select value={pathFrom} onChange={e => setPathFrom(e.target.value)} className="border rounded px-2 py-1 ml-1">{COMPS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="text-xs">To <select value={pathTo} onChange={e => setPathTo(e.target.value)} className="border rounded px-2 py-1 ml-1">{COMPS.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        {paths.length === 0 && <p className="text-xs text-slate-500">No paths found within depth 5.</p>}
        <ul className="text-xs space-y-1">
          {paths.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-mono">{p.path.join(' → ')}</span>
              <Tag color="green">strength {p.cumulative_strength}</Tag>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Intervention sequencing" subtitle={`Develop ${target} — prerequisites ranked by priority`}>
        <div className="flex gap-2 mb-2">
          <label className="text-xs">Target <select value={target} onChange={e => setTarget(e.target.value)} className="border rounded px-2 py-1 ml-1">{COMPS.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <ul className="text-xs space-y-1">
          {seq.map(s => (
            <li key={s.competency_id} className="border border-slate-200 rounded p-2">
              <div className="flex items-center gap-2">
                <Tag color={relColor(s.relationship_type)}>{s.relationship_type}</Tag>
                <span className="font-mono">{s.competency_id}</span>
                <span className="text-slate-500">priority {s.priority}</span>
              </div>
              <p className="text-slate-600 mt-1">{s.rationale}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ─── Psychometrics Panel ──────────────────────────────────────────────
function PsychometricsPanel() {
  const [seed, setSeed] = useState(42);
  const [data, setData] = useState<AnyObj | null>(null);
  useEffect(() => { fetchJSON(`${API}/psychometrics/demo?seed=${seed}`).then(r => setData(r.data)); }, [seed]);
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <label className="text-xs">Seed <input type="number" value={seed} onChange={e => setSeed(+e.target.value)} className="border rounded px-2 py-1 w-20 ml-1" /></label>
        <p className="text-xs text-slate-500">Synthetic 8-item × 30-respondent matrix.</p>
      </div>
      <Section title="Cronbach α — internal consistency" subtitle="α = k/(k-1) × (1 − Σ Var(i) / Var(total))">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-violet-700">{data.cronbach.alpha.toFixed(3)}</div>
          <div>
            <Tag color={data.reliability_tier === 'A' ? 'green' : data.reliability_tier === 'B' ? 'blue' : 'amber'}>
              Tier {data.reliability_tier}
            </Tag>
            <p className="text-xs text-slate-500 mt-1">k={data.cronbach.k_items} items · n={data.cronbach.n_respondents} respondents</p>
          </div>
        </div>
      </Section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Section title="Test-retest r" subtitle="Pearson correlation across administrations">
          <div className="text-2xl font-bold text-sky-700">{data.test_retest.r.toFixed(3)}</div>
        </Section>
        <Section title="Inter-rater κ" subtitle="Cohen's kappa">
          <div className="text-2xl font-bold text-emerald-700">{data.inter_rater.kappa.toFixed(3)}</div>
          <p className="text-xs text-slate-500 mt-1">Agreement {(data.inter_rater.agreement * 100).toFixed(0)}%</p>
        </Section>
        <Section title="Fairness — adverse impact" subtitle="Four-fifths rule (≥ 0.80)">
          <div className="text-2xl font-bold">{data.fairness.ratio?.toFixed(3) ?? '—'}</div>
          <Tag color={data.fairness.passes_four_fifths ? 'green' : 'red'}>{data.fairness.passes_four_fifths ? 'Passes' : 'Fails'}</Tag>
        </Section>
      </div>
    </div>
  );
}

// ─── Confidence Panel ─────────────────────────────────────────────────
function ConfidencePanel() {
  const [vec, setVec] = useState<AnyObj[]>([]);
  useEffect(() => {
    fetchJSON(`${API}/confidence/vector?scores=${encodeURIComponent(JSON.stringify(DEMO_SCORES))}`)
      .then(r => setVec(r.data || []));
  }, []);
  return (
    <Section title="Confidence-weighted competency vector" subtitle="Each row carries raw score + composite confidence + reliability tier + evidence strength">
      <div className="grid gap-2">
        {vec.map(r => {
          const pct = Math.round(r.confidence * 100);
          const color = r.reliability_tier === 'A' ? 'green' : r.reliability_tier === 'B' ? 'blue' : r.reliability_tier === 'C' ? 'amber' : 'red';
          return (
            <div key={r.competency_id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{r.competency_id}</span>
                  <Tag color={color as any}>Tier {r.reliability_tier}</Tag>
                  <Tag color="purple">{r.evidence_strength.replace('_', ' ')}</Tag>
                </div>
                <span className="text-sm text-slate-600">raw <b>{r.raw_score}</b> · conf <b>{pct}%</b></span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-sky-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Gaps Panel ───────────────────────────────────────────────────────
function GapsPanel() {
  const [data, setData] = useState<AnyObj[]>([]);
  useEffect(() => {
    fetchJSON(`${API}/gaps/compute?current=${encodeURIComponent(JSON.stringify(DEMO_SCORES))}`)
      .then(r => setData(r.data || []));
  }, []);
  const sevColor = (s: string) => s === 'critical' ? 'red' : s === 'high' ? 'amber' : s === 'medium' ? 'blue' : s === 'low' ? 'slate' : 'green';
  const typeColor = (t: string) => t === 'leadership' ? 'purple' : t === 'strategic' ? 'blue' : t === 'cognitive' ? 'green' : t === 'readiness' ? 'amber' : 'slate';
  return (
    <Section title="Typed gap analysis (priority-ranked)" subtitle="Behavioural / Cognitive / Functional / Leadership / Strategic / Readiness — priority = severity × criticality × market × dependency-boost">
      <div className="grid gap-2">
        {data.map(g => (
          <div key={g.competency_id} className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm">{g.competency_id}</span>
              <Tag color={typeColor(g.gap_type) as any}>{g.gap_type}</Tag>
              <Tag color={sevColor(g.severity) as any}>{g.severity}</Tag>
              <span className="text-xs text-slate-500">Δ {g.delta}</span>
              <span className="ml-auto text-xs font-semibold">priority {g.priority}</span>
            </div>
            <p className="text-xs text-slate-600">{g.rationale}</p>
            {g.dependency_unlocks.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1">Unlocks: {g.dependency_unlocks.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────
export default function ScientificCompetencyPage(_props: { onNavigate?: (s: any) => void } = {}) {
  const [panel, setPanel] = useState<Panel>('BARS');
  const [versions, setVersions] = useState<AnyObj | null>(null);
  useEffect(() => { fetchJSON(`${API}/_meta/versions`).then(r => setVersions(r)); }, []);
  const content = useMemo(() => {
    switch (panel) {
      case 'BARS': return <BarsPanel />;
      case 'Frameworks': return <FrameworksPanel />;
      case 'Dependency Graph': return <GraphPanel />;
      case 'Psychometrics': return <PsychometricsPanel />;
      case 'Confidence': return <ConfidencePanel />;
      case 'Gaps': return <GapsPanel />;
    }
  }, [panel]);
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Scientific Competency Intelligence</h1>
            <Tag color="purple">Phase 2 · v2.0.0</Tag>
          </div>
          <p className="text-sm text-slate-600">BARS calibration · Functional frameworks · Competency dependency graph · Psychometric validation · Confidence-weighted scoring · Typed gap intelligence — all enhancement-only over existing competency engine.</p>
          {versions && (
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              versions: {Object.entries(versions.data || {}).map(([k, v]) => `${k}=${v}`).join(' · ')}
            </p>
          )}
        </header>
        <nav className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
          {PANELS.map(p => (
            <button key={p} onClick={() => setPanel(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${panel === p ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300'}`}>
              {p}
            </button>
          ))}
        </nav>
        {content}
      </div>
    </div>
  );
}
