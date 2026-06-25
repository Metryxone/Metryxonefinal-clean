/**
 * Phase 3 — Market Intelligence + Evidence + Mobility explorer.
 * Additive page. Existing CompetencyDashboard / CareerBuilder / Trajectory pages preserved.
 */
import { useEffect, useMemo, useState } from 'react';

type AnyObj = Record<string, any>;
const API = '/api/m3';
const PANELS = ['Market Demand', 'Role Normalization', 'Evidence Graph', 'Career Mobility', 'Dynamic Ontology', 'Confidence v2'] as const;
type Panel = typeof PANELS[number];
const DEMO_SCORES = { TEC: 78, LEA: 62, EIQ: 70, STR: 58, COM: 66, ADP: 68, COG: 72 };

async function getJSON(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function postJSON(url: string, body: any) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
function Tag({ children, color = 'slate' }: { children: React.ReactNode; color?: 'slate'|'green'|'amber'|'red'|'blue'|'purple' }) {
  const map: any = {
    slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800', red: 'bg-rose-100 text-rose-700',
    blue:  'bg-sky-100 text-sky-700',     purple:'bg-violet-100 text-violet-700',
  };
  return <span className={`inline-block text-[10px] uppercase tracking-wide font-semibold rounded-md px-1.5 py-0.5 ${map[color]}`}>{children}</span>;
}
function Bar({ value, max = 100, color = 'bg-sky-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Market Demand panel ──────────────────────────────────────────────
function MarketDemandPanel() {
  const [comps, setComps] = useState<AnyObj[]>([]);
  const [roles, setRoles] = useState<AnyObj[]>([]);
  const [forecasts, setForecasts] = useState<AnyObj[]>([]);
  const [velocity, setVelocity] = useState<AnyObj[]>([]);
  const [emerging, setEmerging] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      getJSON(`${API}/demand/competency`), getJSON(`${API}/demand/role`),
      getJSON(`${API}/demand/forecasts`), getJSON(`${API}/demand/velocity`), getJSON(`${API}/emerging`),
    ]).then(([c, r, f, v, e]) => {
      setComps(c.data); setRoles(r.data); setForecasts(f.data); setVelocity(v.data); setEmerging(e.data);
    }).catch(() => setError("Couldn't load data. Please try again."))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-slate-500">Loading…</p>}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      <Card title="Competency market demand" subtitle="Composite = 0.30·hiring + 0.20·salary + 0.20·industry + 0.25·future − 0.15·automation">
        <div className="grid gap-2">
          {comps.map(c => (
            <div key={c.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm">{c.ontology_competency_id}</span>
                <Tag color="purple">demand {Number(c.market_demand).toFixed(1)}</Tag>
                <Tag color="amber">future {Number(c.future_relevance).toFixed(0)}</Tag>
                <Tag color="red">automation {Number(c.automation_risk).toFixed(0)}</Tag>
              </div>
              <Bar value={Number(c.market_demand)} color="bg-gradient-to-r from-violet-500 to-sky-500" />
              <p className="text-[11px] text-slate-500 mt-1">hiring {Number(c.hiring_frequency).toFixed(0)} · salary {Number(c.salary_velocity).toFixed(0)} · industry {Number(c.industry_growth).toFixed(0)}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Role market score">
          <ul className="text-sm divide-y divide-slate-100">
            {roles.map(r => (
              <li key={r.id} className="py-2 flex justify-between">
                <span className="font-mono text-xs">{r.ontology_role_id}</span>
                <span><Tag color="blue">{Number(r.market_score).toFixed(1)}</Tag></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Market velocity" subtitle="rising / stable / declining">
          <ul className="text-sm divide-y divide-slate-100">
            {velocity.map(v => (
              <li key={v.id} className="py-2 flex justify-between">
                <span className="font-mono text-xs">{v.ontology_competency_id ?? v.ontology_role_id}</span>
                <span className="flex items-center gap-2">
                  <Tag color={v.trend_direction === 'rising' ? 'green' : v.trend_direction === 'declining' ? 'red' : 'slate'}>{v.trend_direction}</Tag>
                  <span className="font-mono">{Number(v.velocity_score).toFixed(1)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Future skill forecasts" subtitle="Horizon & confidence per competency">
        <ul className="text-sm divide-y divide-slate-100">
          {forecasts.map(f => (
            <li key={f.id} className="py-2 grid grid-cols-4 gap-2 items-center">
              <span className="font-mono text-xs">{f.ontology_competency_id}</span>
              <span>{f.horizon_months}mo</span>
              <span><Tag color="purple">forecast {Number(f.forecast_score).toFixed(0)}</Tag></span>
              <span className="text-xs text-slate-500">confidence {Number(f.confidence).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Emerging competencies" subtitle="Detected by source-attributed drivers">
        <ul className="text-sm space-y-1">
          {emerging.map(e => (
            <li key={e.id} className="flex items-center gap-2">
              <Tag color="green">+{Number(e.emergence_score).toFixed(0)}</Tag>
              <span>{e.market_skill}</span>
              <span className="text-xs text-slate-500">→ {e.ontology_competency_id ?? 'unmapped'}</span>
              <span className="text-xs text-slate-400 ml-auto">{e.forecast_horizon_months}mo horizon</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── Role Normalization ───────────────────────────────────────────────
function NormalizationPanel() {
  const [title, setTitle] = useState('Talent Acquisition Partner');
  const [resolved, setResolved] = useState<AnyObj | null>(null);
  const [similar, setSimilar] = useState<AnyObj[]>([]);
  const [clusters, setClusters] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!title) return;
    const t = encodeURIComponent(title);
    setLoading(true); setError(null);
    Promise.all([
      getJSON(`${API}/normalize/resolve?title=${t}`).then(r => setResolved(r.data)),
      getJSON(`${API}/normalize/similar?title=${t}&k=5`).then(r => setSimilar(r.data)),
    ]).catch(() => setError("Couldn't load data. Please try again."))
      .finally(() => setLoading(false));
  }, [title]);
  useEffect(() => { getJSON(`${API}/normalize/clusters`).then(r => setClusters(r.data)).catch(() => setError("Couldn't load data. Please try again.")); }, []);
  const methodColor = (m: string) =>
    m === 'exact' ? 'green' : m === 'alias' ? 'blue' : m === 'embedding' ? 'purple' : 'amber';
  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-slate-500">Loading…</p>}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      <Card title="Resolve raw title → canonical role" subtitle="exact → alias → 16-dim cosine embedding; unresolved spawns emerging-role candidate">
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Sr. Software Developer" />
        {resolved && (
          <div className="mt-3 border border-slate-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Tag color={methodColor(resolved.method) as any}>{resolved.method}</Tag>
              <span className="text-slate-500">similarity</span>
              <span className="font-mono">{Number(resolved.similarity).toFixed(3)}</span>
            </div>
            {resolved.market_title ? (
              <p className="text-slate-800">→ <b>{resolved.market_title}</b> <span className="text-xs text-slate-500 font-mono">({resolved.market_role_id})</span></p>
            ) : (
              <p className="text-amber-700">Unresolved — emerging candidate <span className="font-mono">{resolved.emerging_candidate_id}</span> created.</p>
            )}
          </div>
        )}
      </Card>
      <Card title="Cosine-similar market roles">
        <ul className="text-sm divide-y divide-slate-100">
          {similar.map(s => (
            <li key={s.market_role_id} className="py-2 flex justify-between">
              <span>{s.market_title}</span>
              <span className="font-mono">{Number(s.similarity).toFixed(3)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Semantic role clusters">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {clusters.map((c, i) => (
            <div key={i} className="border border-slate-200 rounded p-3">
              <p className="font-medium text-sm">{c.label}</p>
              <p className="text-xs text-slate-500 mt-1">{c.members.join(' · ')}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Evidence Graph ───────────────────────────────────────────────────
function EvidencePanel() {
  const [subject, setSubject] = useState('demo_user');
  const [evidence, setEvidence] = useState<AnyObj[]>([]);
  const [conf, setConf] = useState<AnyObj[]>([]);
  const [sources, setSources] = useState<AnyObj[]>([]);
  const [newComp, setNewComp] = useState('TEC');
  const [newSrc, setNewSrc] = useState('mes_cert');
  const [newStrength, setNewStrength] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    setLoading(true); setError(null);
    Promise.all([
      getJSON(`${API}/evidence/${subject}`).then(r => setEvidence(r.data)),
      getJSON(`${API}/evidence/${subject}/confidence`).then(r => setConf(r.data)),
    ]).catch(() => setError("Couldn't load data. Please try again."))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [subject]);
  useEffect(() => { getJSON(`${API}/evidence/sources`).then(r => setSources(r.data)).catch(() => setError("Couldn't load data. Please try again.")); }, []);
  const verifColor = (v: string) =>
    v === 'verified' ? 'green' : v === 'strong' ? 'blue' : v === 'moderate' ? 'amber' : 'red';
  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-slate-500">Loading…</p>}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex gap-2 items-end">
        <label className="text-xs">Subject ID
          <input value={subject} onChange={e => setSubject(e.target.value)} className="border rounded px-2 py-1 ml-2 text-sm" /></label>
      </div>
      <Card title="Capability confidence (evidence-backed)" subtitle="Aggregated from evidence nodes weighted by source trust">
        <div className="grid gap-2">
          {conf.map(c => (
            <div key={c.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm">{c.ontology_competency_id}</span>
                <Tag color={verifColor(c.verification_level) as any}>{c.verification_level}</Tag>
                <span className="text-xs text-slate-500 ml-auto">{c.evidence_count} evidence nodes</span>
              </div>
              <Bar value={Number(c.evidence_strength) * 100} color="bg-emerald-500" />
              <p className="text-xs text-slate-500 mt-1 font-mono">strength {Number(c.evidence_strength).toFixed(3)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Evidence nodes" subtitle="Source · kind · observed strength · trust-weighted">
        <ul className="text-sm divide-y divide-slate-100">
          {evidence.map(e => (
            <li key={e.id} className="py-2">
              <div className="flex items-center gap-2">
                <Tag color="purple">{e.evidence_kind}</Tag>
                <Tag color={e.verification_status === 'verified' ? 'green' : 'slate'}>{e.verification_status}</Tag>
                <span className="text-xs font-mono text-slate-600">{e.source_code}</span>
                <span className="text-xs text-slate-400 ml-auto font-mono">w {Number(e.weight).toFixed(2)}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">{(e.evidence_payload?.summary) ?? '—'} · comp <b>{e.ontology_competency_id}</b></p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add evidence" subtitle="Post a new evidence node — auto-refreshes confidence">
        <div className="grid grid-cols-4 gap-2 items-end">
          <label className="text-xs">Competency
            <select value={newComp} onChange={e => setNewComp(e.target.value)} className="border rounded px-2 py-1 w-full mt-1">
              {['TEC','LEA','EIQ','STR','COM','ADP','COG'].map(c => <option key={c}>{c}</option>)}
            </select></label>
          <label className="text-xs">Source
            <select value={newSrc} onChange={e => setNewSrc(e.target.value)} className="border rounded px-2 py-1 w-full mt-1">
              {sources.map((s: any) => <option key={s.id} value={s.id}>{s.source_code}</option>)}
            </select></label>
          <label className="text-xs">Strength
            <input type="number" min={0} max={1} step={0.05} value={newStrength}
              onChange={e => setNewStrength(+e.target.value)} className="border rounded px-2 py-1 w-full mt-1" /></label>
          <button className="bg-slate-900 text-white text-sm rounded px-3 py-2 h-[34px]"
            onClick={async () => {
              const src = sources.find((s: any) => s.id === newSrc);
              await postJSON(`${API}/evidence/add`, {
                subject_id: subject, ontology_competency_id: newComp,
                evidence_source_id: newSrc, evidence_kind: src?.source_type ?? 'project',
                observed_strength: newStrength, verification_status: 'self',
                evidence_payload: { summary: 'Added from UI' },
              });
              refresh();
            }}>Add</button>
        </div>
      </Card>
    </div>
  );
}

// ─── Career Mobility ──────────────────────────────────────────────────
function MobilityPanel() {
  const [role, setRole] = useState('mrole_eng_sr');
  const [target, setTarget] = useState('mrole_pm_sr');
  const [adj, setAdj] = useState<AnyObj[]>([]);
  const [rec, setRec] = useState<AnyObj[]>([]);
  const [paths, setPaths] = useState<AnyObj[]>([]);
  const [tr, setTr] = useState<AnyObj[]>([]);
  const [cp, setCp] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      getJSON(`${API}/mobility/adjacent/${role}`).then(r => setAdj(r.data)),
      getJSON(`${API}/mobility/recommend?role=${role}&scores=${encodeURIComponent(JSON.stringify(DEMO_SCORES))}`).then(r => setRec(r.data)),
    ]).catch(() => setError("Couldn't load data. Please try again."))
      .finally(() => setLoading(false));
  }, [role]);
  useEffect(() => { getJSON(`${API}/mobility/paths?to=${target}&depth=3`).then(r => setPaths(r.data)).catch(() => setError("Couldn't load data. Please try again.")); }, [target]);
  useEffect(() => {
    getJSON(`${API}/mobility/transitions`).then(r => setTr(r.data)).catch(() => setError("Couldn't load data. Please try again."));
    getJSON(`${API}/mobility/career-paths`).then(r => setCp(r.data)).catch(() => setError("Couldn't load data. Please try again."));
  }, []);
  const allRoles = ['mrole_eng_sr','mrole_pm_sr','mrole_ds_lead','mrole_ta_spec','mrole_cyber_an'];
  const readyColor = (l: string) => l === 'ready' ? 'green' : l === 'developing' ? 'blue' : 'amber';
  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-slate-500">Loading…</p>}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs">Current role
          <select value={role} onChange={e => setRole(e.target.value)} className="border rounded px-2 py-1 ml-2">{allRoles.map(r => <option key={r}>{r}</option>)}</select></label>
        <label className="text-xs">Target role
          <select value={target} onChange={e => setTarget(e.target.value)} className="border rounded px-2 py-1 ml-2">{allRoles.map(r => <option key={r}>{r}</option>)}</select></label>
      </div>
      <Card title="Adjacent roles" subtitle="Mobility = 0.40·capability + 0.25·market + 0.20·experience + 0.15·learning">
        <ul className="text-sm divide-y divide-slate-100">
          {adj.map(a => (
            <li key={a.id} className="py-2 grid grid-cols-4 gap-2 items-center">
              <span className="font-mono text-xs">{a.to_ontology_role_id}</span>
              <span><Tag color="purple">mob {Number(a.mobility_score).toFixed(2)}</Tag></span>
              <span><Tag color="blue">adj {Number(a.adjacency_score).toFixed(2)}</Tag></span>
              <span className="text-xs text-slate-500">{a.rationale}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Recommendations for you" subtitle={`Using demo scores avg ${Math.round(Object.values(DEMO_SCORES).reduce((s,v)=>s+v,0)/Object.values(DEMO_SCORES).length)}/100`}>
        <ul className="text-sm divide-y divide-slate-100">
          {rec.map(r => (
            <li key={r.target_role_id} className="py-2 grid grid-cols-4 gap-2 items-center">
              <span className="font-mono text-xs">{r.target_role_id}</span>
              <span><Tag color="purple">mob {Number(r.mobility_score).toFixed(2)}</Tag></span>
              <span><Tag color={readyColor(r.readiness_label) as any}>{r.readiness_label}</Tag></span>
              <span className="text-xs text-slate-500">{r.rationale}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Paths into target" subtitle="BFS depth ≤ 3 · cumulative strength">
          {paths.length === 0 && <p className="text-xs text-slate-500">No paths within depth 3.</p>}
          <ul className="text-sm space-y-1">
            {paths.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="font-mono text-xs">{p.path.join(' → ')}</span>
                <Tag color="green">{Number(p.score).toFixed(3)}</Tag>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Transition probabilities">
          <ul className="text-sm divide-y divide-slate-100">
            {tr.map(t => (
              <li key={t.id} className="py-2 grid grid-cols-3 gap-2 items-center">
                <span className="font-mono text-xs">{t.from_ontology_role_id} → {t.to_ontology_role_id}</span>
                <span><Tag color="blue">{(Number(t.probability)*100).toFixed(0)}%</Tag></span>
                <span className="text-xs text-slate-500">median {t.median_months}mo</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Canonical career paths">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {cp.map(p => (
            <div key={p.id} className="border border-slate-200 rounded p-3">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-slate-500 mt-1 font-mono">{(p.steps as string[]).join(' → ')}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Dynamic Ontology ─────────────────────────────────────────────────
function DynOntologyPanel() {
  const [roles, setRoles] = useState<AnyObj[]>([]);
  const [skills, setSkills] = useState<AnyObj[]>([]);
  const [events, setEvents] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    setLoading(true); setError(null);
    Promise.all([
      getJSON(`${API}/dyn/emerging-roles?threshold=50`).then(r => setRoles(r.data)),
      getJSON(`${API}/dyn/emerging-skills?threshold=50`).then(r => setSkills(r.data)),
      getJSON(`${API}/dyn/events`).then(r => setEvents(r.data)),
    ]).catch(() => setError("Couldn't load data. Please try again."))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);
  const statusColor = (s: string) => s === 'promoted' ? 'green' : s === 'rejected' ? 'red' : s === 'under_review' ? 'amber' : 'slate';
  const setStatus = async (kind: 'role'|'skill', id: string, status: string) => {
    await postJSON(`${API}/dyn/review`, { kind, id, status });
    refresh();
  };
  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-slate-500">Loading…</p>}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
      <Card title="Emerging role candidates" subtitle="Auto-detected from ingest pipeline; promotion is a governance decision">
        <ul className="text-sm divide-y divide-slate-100">
          {roles.map(r => (
            <li key={r.id} className="py-2 grid grid-cols-5 gap-2 items-center">
              <span className="col-span-2">{r.raw_title}</span>
              <span><Tag color="purple">score {Number(r.emergence_score).toFixed(0)}</Tag></span>
              <span><Tag color={statusColor(r.status) as any}>{r.status}</Tag></span>
              <span className="text-right space-x-1">
                <button className="text-xs underline" onClick={() => setStatus('role', r.id, 'under_review')}>review</button>
                <button className="text-xs underline text-emerald-600" onClick={() => setStatus('role', r.id, 'promoted')}>promote</button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Emerging skill candidates">
        <ul className="text-sm divide-y divide-slate-100">
          {skills.map(s => (
            <li key={s.id} className="py-2 grid grid-cols-5 gap-2 items-center">
              <span className="col-span-2">{s.raw_skill}</span>
              <span><Tag color="purple">score {Number(s.emergence_score).toFixed(0)}</Tag></span>
              <span><Tag color={statusColor(s.status) as any}>{s.status}</Tag></span>
              <span className="text-right space-x-1">
                <button className="text-xs underline" onClick={() => setStatus('skill', s.id, 'under_review')}>review</button>
                <button className="text-xs underline text-emerald-600" onClick={() => setStatus('skill', s.id, 'promoted')}>promote</button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Evolution event log" subtitle="Proposals only — onto_* tables untouched until manual governance promotion">
        <ul className="text-xs divide-y divide-slate-100">
          {events.map(e => (
            <li key={e.id} className="py-2 flex items-center gap-2">
              <Tag color="blue">{e.event_type}</Tag>
              <span className="font-mono">{e.target_id ?? '—'}</span>
              <span className="text-slate-500 ml-2 truncate">{e.payload?.reason ?? ''}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── Confidence v2 ────────────────────────────────────────────────────
function ConfidenceV2Panel() {
  const [vec, setVec] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true); setError(null);
    getJSON(`${API}/confidence/vector?subject_id=demo_user&scores=${encodeURIComponent(JSON.stringify(DEMO_SCORES))}`)
      .then(r => setVec(r.data))
      .catch(() => setError("Couldn't load data. Please try again."))
      .finally(() => setLoading(false));
  }, []);
  const levelColor = (l: string) => l === 'verified' ? 'green' : l === 'strong' ? 'blue' : l === 'moderate' ? 'amber' : 'red';
  return (
    <Card title="Capability confidence v2" subtitle="0.25·reliability + 0.25·evidence + 0.15·history + 0.20·market + 0.15·benchmark">
      {loading && <p className="text-xs text-slate-500 mb-2">Loading…</p>}
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 mb-2">{error}</p>}
      <div className="grid gap-2">
        {vec.map(r => (
          <div key={r.competency_id} className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm">{r.competency_id}</span>
              <Tag color={levelColor(r.verification_level) as any}>{r.verification_level}</Tag>
              <span className="text-xs text-slate-500 ml-auto">raw <b>{r.raw_score}</b> · conf <b>{Math.round(r.confidence * 100)}%</b></span>
            </div>
            <Bar value={r.confidence * 100} color="bg-gradient-to-r from-violet-500 to-emerald-500" />
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              rel {r.components.assessment_reliability.toFixed(2)} · ev {r.components.evidence_strength.toFixed(2)} · hist {r.components.historical_consistency.toFixed(2)} · mkt {r.components.market_validation.toFixed(2)} · bench {r.components.benchmark_stability.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function MarketIntelligencePage(_props: { onNavigate?: (s: any) => void } = {}) {
  const [panel, setPanel] = useState<Panel>('Market Demand');
  const [versions, setVersions] = useState<AnyObj | null>(null);
  useEffect(() => { getJSON(`${API}/_meta/versions`).then(r => setVersions(r.data)); }, []);
  const content = useMemo(() => {
    switch (panel) {
      case 'Market Demand':     return <MarketDemandPanel />;
      case 'Role Normalization':return <NormalizationPanel />;
      case 'Evidence Graph':    return <EvidencePanel />;
      case 'Career Mobility':   return <MobilityPanel />;
      case 'Dynamic Ontology':  return <DynOntologyPanel />;
      case 'Confidence v2':     return <ConfidenceV2Panel />;
    }
  }, [panel]);
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Market Intelligence</h1>
            <Tag color="purple">Phase 3 · v3.0.0</Tag>
          </div>
          <p className="text-sm text-slate-600">
            Real-time workforce intelligence · AI role normalization · evidence-backed capabilities · career mobility ·
            dynamic ontology evolution · market-aware confidence. Enhancement-only on top of existing ontology / benchmark / BARS / psychometric engines.
          </p>
          {versions && (
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              versions: {Object.entries(versions).map(([k, v]) => `${k}=${v}`).join(' · ')}
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
