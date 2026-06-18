import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';

// ── API helpers ──────────────────────────────────────────────────────────────
const api = async (url: string, opts?: RequestInit) => {
  const r = await fetch(url, { credentials: 'include', ...opts });
  if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText); }
  return r.json();
};
const post = (url: string, body: unknown) =>
  api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const put  = (url: string, body: unknown) =>
  api(url, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const del  = (url: string) => api(url, { method: 'DELETE' });

// ── Palette ──────────────────────────────────────────────────────────────────
const P = ['#6366f1','#22d3ee','#10b981','#f59e0b','#f43f5e','#a855f7','#3b82f6','#84cc16'];
const SEV: Record<string, string> = { critical:'#f43f5e', high:'#f97316', medium:'#f59e0b', low:'#10b981', info:'#22d3ee', warning:'#f59e0b' };

// ── Shared components ─────────────────────────────────────────────────────────
function Badge({ label, color = '#6366f1' }: { label: string; color?: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-bold uppercase tracking-wide" style={{ background: color }}>
      {label}
    </span>
  );
}
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:'#10b981', draft:'#94a3b8', deprecated:'#f59e0b',
    archived:'#6b7280', available:'#10b981', testing:'#a855f7',
    unavailable:'#f43f5e', completed:'#10b981', failed:'#f43f5e',
    running:'#22d3ee', pending:'#f59e0b', paused:'#f59e0b',
    confirmed:'#f43f5e', reviewed:'#10b981', dismissed:'#94a3b8',
    passed:'#10b981', enforce:'#6366f1', warn:'#f59e0b', audit_only:'#94a3b8',
  };
  return <Badge label={status} color={colors[status] ?? '#6366f1'} />;
}
function KPI({ label, value, accent = '#6366f1', sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
function Hdr({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
function EmptyState({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-400 py-10 text-center">{msg}</p>;
}
function SevDot({ s }: { s: string }) {
  return <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ background: SEV[s] ?? '#94a3b8' }} />;
}

// ── Table shell ───────────────────────────────────────────────────────────────
function Table({ cols, rows, empty = 'No data' }: {
  cols: string[]; rows: React.ReactNode[][]; empty?: string;
}) {
  if (!rows.length) return <EmptyState msg={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{cols.map(c => <th key={c} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{c}</th>)}</tr>
        </thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">{r.map((c, j) => <td key={j} className="px-4 py-2.5">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ── Tab types ─────────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'prompts' | 'models' | 'workflows' | 'rules' | 'safety' | 'audit' | 'monitoring';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'dashboard',  label: 'Dashboard',         icon: '📊' },
  { id: 'prompts',    label: 'Prompt Studio',      icon: '✏️' },
  { id: 'models',     label: 'Model Registry',     icon: '🤖' },
  { id: 'workflows',  label: 'AI Workflows',       icon: '⚙️' },
  { id: 'rules',      label: 'Rules Engine',       icon: '📐' },
  { id: 'safety',     label: 'Evaluation & Safety',icon: '🛡️' },
  { id: 'audit',      label: 'Audit Logs',         icon: '📋' },
  { id: 'monitoring', label: 'Monitoring',         icon: '📡' },
];

const BASE = '/api/governance/ai';

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════════════════════════════════════════════
function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: [BASE + '/dashboard'],
    queryFn: () => api(BASE + '/dashboard'),
    staleTime: 30_000,
    retry: false,
  });
  const qc = useQueryClient();
  const refresh = useMutation({ mutationFn: () => post(BASE + '/monitoring/refresh', {}), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/dashboard'] }) });

  if (isLoading) return <EmptyState msg="Loading dashboard…" />;
  const s = data?.summary;

  const metricTrend = (() => {
    const by: Record<string, any[]> = {};
    for (const m of (data?.metrics ?? [])) {
      if (!by[m.metric_name]) by[m.metric_name] = [];
      by[m.metric_name].push({ t: m.recorded_at?.slice(11, 16), v: Number(m.metric_value) });
    }
    const keys = ['workflow_error_rate', 'hallucination_rate', 'eval_pass_rate'];
    const times = [...new Set((data?.metrics ?? []).map((m: any) => m.recorded_at?.slice(11, 16)))].slice(-12);
    return times.map((t: string) => {
      const row: any = { t };
      for (const k of keys) row[k] = (by[k] ?? []).find((x: any) => x.t === t)?.v ?? 0;
      return row;
    });
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Hdr title="AI Governance Overview" sub="Real-time view across all governance subsystems" />
        <button onClick={() => refresh.mutate()}
          className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold"
          style={{ background: refresh.isPending ? '#94a3b8' : '#6366f1' }}>
          {refresh.isPending ? 'Refreshing…' : '⟳ Refresh Metrics'}
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Active Prompts"      value={s?.prompts?.active ?? 0}               accent="#6366f1" />
        <KPI label="Models Available"    value={s?.models?.available ?? 0}             accent="#22d3ee" sub={s?.models?.default_model ?? '—'} />
        <KPI label="Workflows Active"    value={s?.workflows?.active ?? 0}             accent="#10b981" sub={`${s?.workflows?.runs_today ?? 0} runs today`} />
        <KPI label="Error Rate"          value={((s?.workflows?.error_rate ?? 0) * 100).toFixed(1) + '%'} accent={s?.workflows?.error_rate > 0.1 ? '#f43f5e' : '#10b981'} />
        <KPI label="Insight Rules On"    value={s?.rules?.insight_active ?? 0}         accent="#a855f7" />
        <KPI label="Rec Rules On"        value={s?.rules?.recommendation_active ?? 0}  accent="#3b82f6" />
        <KPI label="Flags Pending"       value={s?.safety?.flags_pending ?? 0}         accent={s?.safety?.flags_critical > 0 ? '#f43f5e' : '#f59e0b'} sub={`${s?.safety?.flags_critical ?? 0} critical`} />
        <KPI label="Eval Pass Rate"      value={(s?.safety?.eval_pass_rate ?? 0).toFixed(1) + '%'} accent={s?.safety?.eval_pass_rate > 70 ? '#10b981' : '#f43f5e'} />
        <KPI label="Policies Active"     value={s?.policies?.active ?? 0}              accent="#84cc16" />
        <KPI label="Audit Actions/24h"   value={s?.audit?.actions_today ?? 0}          accent="#6366f1" />
        <KPI label="Hourly Cost"         value={'$' + (s?.monitoring?.hourly_cost_usd ?? 0).toFixed(4)} accent="#f59e0b" />
        <KPI label="Tokens Today"        value={(s?.monitoring?.total_tokens_today ?? 0).toLocaleString()} accent="#22d3ee" />
      </div>

      {/* Trend chart */}
      {metricTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <Hdr title="Metric Trends (last recorded hours)" />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metricTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
              <Tooltip formatter={(v: any) => typeof v === 'number' ? (v * 100).toFixed(1) + '%' : v} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="hallucination_rate" name="Hallucination Rate" stroke="#f43f5e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="eval_pass_rate"     name="Eval Pass Rate"     stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="workflow_error_rate" name="Error Rate"        stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent runs + recent flags side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <Hdr title="Recent Workflow Runs" />
          <Table
            cols={['Workflow','Status','Duration','H-Score','Eval']}
            empty="No workflow runs yet"
            rows={(data?.recent_runs ?? []).slice(0, 8).map((r: any) => [
              <span className="text-xs text-gray-700 max-w-[120px] truncate block">{r.workflow_name}</span>,
              <StatusBadge status={r.status} />,
              <span className="text-xs text-gray-500">{r.duration_ms != null ? r.duration_ms + 'ms' : '—'}</span>,
              <span className="text-xs" style={{ color: r.hallucination_score > 0.2 ? '#f43f5e' : '#10b981' }}>{r.hallucination_score != null ? (r.hallucination_score * 100).toFixed(0) + '%' : '—'}</span>,
              <span className="text-xs" style={{ color: r.evaluation_score < 0.65 ? '#f43f5e' : '#10b981' }}>{r.evaluation_score != null ? (r.evaluation_score * 100).toFixed(0) + '%' : '—'}</span>,
            ])}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <Hdr title="Recent Hallucination Flags" />
          <Table
            cols={['Severity','Reason','Status','Time']}
            empty="No flags — content is clean"
            rows={(data?.recent_flags ?? []).slice(0, 8).map((f: any) => [
              <span className="flex items-center text-xs"><SevDot s={f.severity} />{f.severity}</span>,
              <span className="text-xs text-gray-600 max-w-[140px] truncate block">{f.reason ?? '—'}</span>,
              <StatusBadge status={f.review_status} />,
              <span className="text-xs text-gray-400">{f.created_at ? new Date(f.created_at).toLocaleTimeString() : '—'}</span>,
            ])}
          />
        </div>
      </div>

      {/* Recent audit */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Hdr title="Recent Audit Activity" />
        <Table
          cols={['Action','Entity','Outcome','Time']}
          empty="No audit events yet"
          rows={(data?.recent_audit ?? []).slice(0, 10).map((a: any) => [
            <span className="text-xs font-mono text-gray-700">{a.action}</span>,
            <span className="text-xs text-gray-500">{a.entity_type}{a.entity_id ? ` · ${String(a.entity_id).slice(0, 8)}…` : ''}</span>,
            <StatusBadge status={a.outcome} />,
            <span className="text-xs text-gray-400">{a.ts ? new Date(a.ts).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROMPT STUDIO TAB
// ══════════════════════════════════════════════════════════════════════════════
function PromptsTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', category: 'insight', tags: '' });
  const [verForm, setVerForm] = useState({ template: '', system_context: '', changelog: '' });
  const [showVerForm, setShowVerForm] = useState(false);
  const [showTcForm, setShowTcForm] = useState(false);
  const [tcForm, setTcForm] = useState({ name: '', input_variables: '{}', expected_output: '' });
  const [tcRunResult, setTcRunResult] = useState<Record<string, any>>({});
  const [runningTc, setRunningTc] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: [BASE + '/prompts'], queryFn: () => api(BASE + '/prompts'), staleTime: 30_000 });
  const { data: detail } = useQuery({
    queryKey: [BASE + '/prompts', selected?.id],
    queryFn: () => api(BASE + '/prompts/' + selected?.id),
    enabled: !!selected?.id,
    staleTime: 30_000,
  });
  const { data: tcData, refetch: refetchTc } = useQuery({
    queryKey: [BASE + '/prompts', selected?.id, 'test-cases'],
    queryFn: () => api(BASE + '/prompts/' + selected?.id + '/test-cases'),
    enabled: !!selected?.id,
    staleTime: 20_000,
  });

  const createMut    = useMutation({ mutationFn: () => post(BASE + '/prompts', { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) }), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/prompts'] }); setShowForm(false); setForm({ name:'',slug:'',description:'',category:'insight',tags:'' }); } });
  const createVerMut = useMutation({ mutationFn: () => post(BASE + '/prompts/' + selected?.id + '/versions', verForm), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/prompts', selected?.id] }); setShowVerForm(false); setVerForm({ template:'', system_context:'', changelog:'' }); } });
  const activateMut  = useMutation({ mutationFn: (vid: string) => post(BASE + '/prompt-versions/' + vid + '/activate', {}), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/prompts', selected?.id] }) });
  const archiveMut   = useMutation({ mutationFn: (id: string) => del(BASE + '/prompts/' + id), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/prompts'] }); setSelected(null); } });
  const createTcMut  = useMutation({
    mutationFn: () => {
      let vars = {};
      try { vars = JSON.parse(tcForm.input_variables); } catch { vars = {}; }
      return post(BASE + '/prompts/' + selected?.id + '/test-cases', { name: tcForm.name, input_variables: vars, expected_output: tcForm.expected_output || null });
    },
    onSuccess: () => { refetchTc(); setShowTcForm(false); setTcForm({ name:'', input_variables:'{}', expected_output:'' }); },
  });

  const runTc = async (tcId: string) => {
    setRunningTc(tcId);
    try {
      const r = await post(BASE + '/prompts/' + selected?.id + '/test-cases/' + tcId + '/run', {});
      setTcRunResult(prev => ({ ...prev, [tcId]: r }));
      refetchTc();
    } catch (e: any) {
      setTcRunResult(prev => ({ ...prev, [tcId]: { error: e.message } }));
    } finally {
      setRunningTc(null);
    }
  };

  const prompts: any[]  = data?.prompts ?? [];
  const versions: any[] = detail?.versions ?? [];
  const testCases: any[] = tcData?.test_cases ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Hdr title="Prompt Repository" sub="Version-controlled prompt templates for all AI operations" />
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold bg-indigo-600 hover:bg-indigo-700">
          + New Prompt
        </button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-800">Create Prompt</p>
          <div className="grid grid-cols-2 gap-3">
            {[['Name','name','text'],['Slug (URL-safe)','slug','text'],['Category','category','text'],['Tags (comma-sep)','tags','text']].map(([l,k]) => (
              <div key={k}><label className="text-xs text-gray-600">{l}</label>
                <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
              </div>
            ))}
            <div className="col-span-2"><label className="text-xs text-gray-600">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" rows={2} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold">
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prompt list */}
        <div className="md:col-span-1 space-y-2">
          {prompts.map(p => (
            <div key={p.id} onClick={() => setSelected(p)}
              className={`bg-white rounded-xl border p-3 shadow-sm cursor-pointer transition ${selected?.id === p.id ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{p.slug}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge label={p.category} color="#6366f1" />
                <span className="text-xs text-gray-400">v{p.current_version} · {p.version_count ?? 0} versions</span>
              </div>
            </div>
          ))}
          {!prompts.length && <EmptyState msg="No prompts yet" />}
        </div>

        {/* Version detail */}
        <div className="md:col-span-2">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">
              Select a prompt to view versions
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{selected.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selected.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowVerForm(v => !v)} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">
                    + New Version
                  </button>
                  <button onClick={() => archiveMut.mutate(selected.id)} className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg">
                    Archive
                  </button>
                </div>
              </div>

              {showVerForm && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 space-y-3">
                  <p className="text-xs font-semibold text-indigo-800">New Version</p>
                  <div><label className="text-xs text-gray-600">Template</label>
                    <textarea value={verForm.template} onChange={e => setVerForm(f => ({ ...f, template: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono mt-0.5" rows={6} />
                  </div>
                  <div><label className="text-xs text-gray-600">System Context</label>
                    <textarea value={verForm.system_context} onChange={e => setVerForm(f => ({ ...f, system_context: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mt-0.5" rows={2} />
                  </div>
                  <div><label className="text-xs text-gray-600">Changelog</label>
                    <input value={verForm.changelog} onChange={e => setVerForm(f => ({ ...f, changelog: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => createVerMut.mutate()} disabled={createVerMut.isPending} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">
                      {createVerMut.isPending ? 'Saving…' : 'Save Version'}
                    </button>
                    <button onClick={() => setShowVerForm(false)} className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {versions.map(v => (
                  <div key={v.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">v{v.version}</span>
                        {v.is_active && <Badge label="Active" color="#10b981" />}
                        {v.token_estimate && <span className="text-xs text-gray-400">~{v.token_estimate} tokens</span>}
                        {v.test_pass_rate != null && <span className="text-xs text-gray-400">Tests: {(v.test_pass_rate * 100).toFixed(0)}% pass</span>}
                        {v.content_hash && <span className="text-xs text-gray-300 font-mono">{v.content_hash}</span>}
                      </div>
                      {!v.is_active && (
                        <button onClick={() => activateMut.mutate(v.id)} className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-semibold hover:bg-indigo-100">
                          Activate
                        </button>
                      )}
                    </div>
                    {v.changelog && <p className="text-xs text-gray-500 mt-1">{v.changelog}</p>}
                    <pre className="mt-2 bg-gray-950 text-green-400 text-[10px] rounded-lg p-3 overflow-x-auto max-h-40 font-mono whitespace-pre-wrap leading-relaxed">
                      {v.template}
                    </pre>
                    {v.variables?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {v.variables.map((vr: string) => (
                          <span key={vr} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{vr}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!versions.length && <EmptyState msg="No versions yet — create the first version above" />}
              </div>

              {/* ── Test Cases ─────────────────────────────────────────── */}
              <div className="border-t border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">🧪 Test Cases</p>
                  <button onClick={() => setShowTcForm(v => !v)} className="px-2 py-0.5 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-semibold">
                    + Add Test Case
                  </button>
                </div>

                {showTcForm && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-2">
                    <div><label className="text-[10px] text-gray-600">Name</label>
                      <input value={tcForm.name} onChange={e => setTcForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs mt-0.5" placeholder="e.g. Basic insight check" />
                    </div>
                    <div><label className="text-[10px] text-gray-600">Input Variables (JSON)</label>
                      <textarea value={tcForm.input_variables} onChange={e => setTcForm(f => ({ ...f, input_variables: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-mono mt-0.5" rows={2} placeholder='{"concern": "procrastination"}' />
                    </div>
                    <div><label className="text-[10px] text-gray-600">Expected Output (optional — used for scoring)</label>
                      <textarea value={tcForm.expected_output} onChange={e => setTcForm(f => ({ ...f, expected_output: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[10px] mt-0.5" rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => createTcMut.mutate()} disabled={createTcMut.isPending || !tcForm.name.trim()} className="px-2 py-1 text-[10px] bg-indigo-600 text-white rounded-lg font-semibold">
                        {createTcMut.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setShowTcForm(false)} className="px-2 py-1 text-[10px] bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {testCases.map((tc: any) => {
                    const res = tcRunResult[tc.id];
                    const score = res?.score ?? tc.last_score;
                    return (
                      <div key={tc.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{tc.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-mono truncate">{JSON.stringify(tc.input_variables)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {score != null && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${score >= 0.65 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {score >= 0.65 ? '✓' : '✗'} {(score * 100).toFixed(0)}%
                              </span>
                            )}
                            <button
                              onClick={() => runTc(tc.id)}
                              disabled={runningTc === tc.id}
                              className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded-lg font-semibold hover:bg-green-200 whitespace-nowrap"
                            >
                              {runningTc === tc.id ? '⟳ Running…' : '▶ Run'}
                            </button>
                          </div>
                        </div>
                        {res && !res.error && (
                          <div className="mt-2 bg-gray-950 text-green-400 text-[10px] font-mono rounded p-2 leading-relaxed max-h-24 overflow-y-auto">
                            <p className="text-gray-500 mb-1">Output · {res.execution?.duration_ms ?? '—'}ms · {res.execution?.model_used ?? '—'} · ${(res.execution?.cost_usd ?? 0).toFixed(5)}</p>
                            {res.actual_output}
                          </div>
                        )}
                        {res?.error && <p className="text-[10px] text-red-500 mt-1">{res.error}</p>}
                        {!res && tc.last_run_at && (
                          <p className="text-[10px] text-gray-400 mt-1">Last run: {new Date(tc.last_run_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                      </div>
                    );
                  })}
                  {!testCases.length && <p className="text-[10px] text-gray-400 text-center py-2">No test cases yet — add one above</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODEL REGISTRY TAB
// ══════════════════════════════════════════════════════════════════════════════
function ModelsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [form, setForm] = useState({ provider: 'openai', model_name: '', model_version: 'latest', context_window: '8192', cost_in: '0', cost_out: '0' });
  const [cfgForm, setCfgForm] = useState({ config_name: '', temperature: '0.7', max_tokens: '1024', use_case: 'general' });
  const [showCfg, setShowCfg] = useState(false);

  const { data } = useQuery({ queryKey: [BASE + '/models'], queryFn: () => api(BASE + '/models'), staleTime: 30_000 });
  const { data: cfgs } = useQuery({ queryKey: [BASE + '/models', selectedModel?.id, 'configs'], queryFn: () => api(BASE + '/models/' + selectedModel?.id + '/configs'), enabled: !!selectedModel?.id, staleTime: 30_000 });

  const createMut = useMutation({ mutationFn: () => post(BASE + '/models', { provider: form.provider, model_name: form.model_name, model_version: form.model_version, context_window: Number(form.context_window), cost_per_1k_input_tokens: Number(form.cost_in), cost_per_1k_output_tokens: Number(form.cost_out) }), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/models'] }); setShowForm(false); } });
  const setDefaultMut = useMutation({ mutationFn: (id: string) => put(BASE + '/models/' + id, { is_default: true }), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/models'] }) });
  const createCfgMut = useMutation({ mutationFn: () => post(BASE + '/models/' + selectedModel?.id + '/configs', { config_name: cfgForm.config_name, temperature: Number(cfgForm.temperature), max_tokens: Number(cfgForm.max_tokens), use_case: cfgForm.use_case }), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/models', selectedModel?.id, 'configs'] }); setShowCfg(false); } });

  const models: any[] = data?.models ?? [];
  const providerColors: Record<string, string> = { openai: '#10b981', anthropic: '#a855f7', google: '#3b82f6', local: '#f59e0b' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Hdr title="Model Registry" sub="Registered AI models, capabilities, and cost tracking" />
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold bg-indigo-600">+ Register Model</button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-800">Register Model</p>
          <div className="grid grid-cols-3 gap-3">
            {[['Provider','provider'],['Model Name','model_name'],['Version','model_version'],['Context Window','context_window'],['Cost/1k Input ($)','cost_in'],['Cost/1k Output ($)','cost_out']].map(([l,k]) => (
              <div key={k}><label className="text-xs text-gray-600">{l}</label>
                <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold">{createMut.isPending ? 'Registering…' : 'Register'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map(m => (
          <div key={m.id} onClick={() => setSelectedModel(m)} className={`bg-white rounded-xl border p-4 shadow-sm cursor-pointer transition ${selectedModel?.id === m.id ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-100 hover:border-gray-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: providerColors[m.provider] ?? '#6366f1' }}>{m.provider}</span>
                <span className="font-semibold text-gray-800 text-sm">{m.model_name}</span>
                <span className="text-xs text-gray-400">{m.model_version}</span>
              </div>
              <div className="flex items-center gap-1">
                {m.is_default && <Badge label="Default" color="#10b981" />}
                <StatusBadge status={m.status} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div><span className="text-gray-400">Context</span><p className="font-semibold text-gray-700">{m.context_window?.toLocaleString()}</p></div>
              <div><span className="text-gray-400">In $/1k</span><p className="font-semibold text-gray-700">${Number(m.cost_per_1k_input_tokens).toFixed(4)}</p></div>
              <div><span className="text-gray-400">Out $/1k</span><p className="font-semibold text-gray-700">${Number(m.cost_per_1k_output_tokens).toFixed(4)}</p></div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {(m.capabilities ?? []).map((c: string) => <span key={c} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{c}</span>)}
              <span className="text-xs text-gray-400 ml-auto">{m.run_count ?? 0} runs · {m.config_count ?? 0} configs</span>
              {!m.is_default && (
                <button onClick={e => { e.stopPropagation(); setDefaultMut.mutate(m.id); }} className="text-xs text-indigo-600 hover:underline">Set Default</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Config profiles for selected model */}
      {selectedModel && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Hdr title={`Config Profiles — ${selectedModel.model_name}`} sub="Tuned parameter sets per use case" />
            <button onClick={() => setShowCfg(v => !v)} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">+ Add Config</button>
          </div>
          {showCfg && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-3 grid grid-cols-4 gap-3">
              {[['Config Name','config_name'],['Temperature','temperature'],['Max Tokens','max_tokens'],['Use Case','use_case']].map(([l,k]) => (
                <div key={k}><label className="text-xs text-gray-600">{l}</label>
                  <input value={(cfgForm as any)[k]} onChange={e => setCfgForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs mt-0.5" />
                </div>
              ))}
              <div className="col-span-4 flex gap-2">
                <button onClick={() => createCfgMut.mutate()} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">Save</button>
                <button onClick={() => setShowCfg(false)} className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          <Table
            cols={['Config Name','Use Case','Temp','Max Tokens','P','F-Pen','P-Pen']}
            empty="No configs yet"
            rows={(cfgs?.configs ?? []).map((c: any) => [
              <span className="text-xs font-mono font-semibold text-gray-700">{c.config_name}</span>,
              <Badge label={c.use_case ?? 'general'} color="#6366f1" />,
              <span className="text-xs">{c.temperature}</span>,
              <span className="text-xs">{c.max_tokens}</span>,
              <span className="text-xs">{c.top_p}</span>,
              <span className="text-xs">{c.frequency_penalty}</span>,
              <span className="text-xs">{c.presence_penalty}</span>,
            ])}
          />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AI WORKFLOWS TAB
// ══════════════════════════════════════════════════════════════════════════════
function WorkflowsTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', trigger_type: 'manual' });
  const [runResult, setRunResult] = useState<any>(null);

  const { data } = useQuery({ queryKey: [BASE + '/ai-workflows'], queryFn: () => api(BASE + '/ai-workflows'), staleTime: 30_000 });
  const { data: runs } = useQuery({ queryKey: [BASE + '/ai-workflows', selected?.id, 'runs'], queryFn: () => api(BASE + '/ai-workflows/' + selected?.id + '/runs?limit=20'), enabled: !!selected?.id, staleTime: 15_000 });

  const createMut = useMutation({
    mutationFn: () => post(BASE + '/ai-workflows', { ...form, steps: [{ step: 1, type: 'prompt', prompt_slug: 'insight_generation_v1' }, { step: 2, type: 'validate', evaluator: 'rule_based', pass_threshold: 0.7 }] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/ai-workflows'] }); setShowForm(false); }
  });
  const runMut = useMutation({
    mutationFn: (id: string) => post(BASE + '/ai-workflows/' + id + '/run', { input: { user_id: 'demo', context: 'governance_test' } }),
    onSuccess: (d) => { setRunResult(d); qc.invalidateQueries({ queryKey: [BASE + '/ai-workflows', selected?.id, 'runs'] }); }
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => put(BASE + '/ai-workflows/' + id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/ai-workflows'] }),
  });

  const workflows: any[] = data?.workflows ?? [];
  const wfRuns: any[] = runs?.runs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Hdr title="AI Workflow Engine" sub="Multi-step AI pipelines with execution tracing and evaluation" />
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold bg-indigo-600">+ New Workflow</button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          {[['Workflow Name','name'],['Description','description'],['Trigger Type','trigger_type']].map(([l,k]) => (
            <div key={k}><label className="text-xs text-gray-600">{l}</label>
              <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate()} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold">{createMut.isPending ? 'Creating…' : 'Create'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {workflows.map(w => (
            <div key={w.id} onClick={() => setSelected(w)} className={`bg-white rounded-xl border p-4 shadow-sm cursor-pointer transition ${selected?.id === w.id ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{w.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{w.description}</p>
                </div>
                <StatusBadge status={w.status} />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>v{w.version}</span>
                <span>{w.total_runs ?? 0} runs</span>
                <span>{w.failed_runs ?? 0} failed</span>
                <span>Trigger: {w.trigger_type}</span>
              </div>
              <div className="flex gap-2 mt-2">
                {w.status === 'active' && (
                  <button onClick={e => { e.stopPropagation(); runMut.mutate(w.id); }} disabled={runMut.isPending} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-lg font-semibold hover:bg-green-200">
                    ▶ Run
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); toggleMut.mutate({ id: w.id, status: w.status === 'active' ? 'paused' : 'active' }); }} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                  {w.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
          {!workflows.length && <EmptyState msg="No workflows yet" />}
        </div>

        <div className="space-y-3">
          {runResult && (
            <div className="bg-gray-950 text-green-400 rounded-xl p-3 font-mono text-[10px]">
              <p className="text-gray-400 mb-1">
                Run — <span className={runResult.status === 'completed' ? 'text-green-400' : 'text-red-400'}>{runResult.status}</span>
                {' '}in {runResult.duration_ms}ms
                {runResult.cost_usd != null && runResult.cost_usd > 0 && <span className="text-yellow-400"> · ${runResult.cost_usd.toFixed(5)} cost</span>}
              </p>
              <p className="text-gray-300">
                Hallucination: {runResult.hallucination_score != null ? ((runResult.hallucination_score) * 100).toFixed(0) + '%' : '—'}
                {'  '}Eval: {runResult.evaluation_score != null ? ((runResult.evaluation_score) * 100).toFixed(0) + '%' : '—'}
              </p>
              {(runResult.steps_trace ?? []).map((s: any) => (
                <p key={s.step} className={s.status === 'failed' ? 'text-red-400' : s.status === 'skipped' ? 'text-gray-500' : 'text-green-400'}>
                  {s.status === 'completed' ? '✓' : s.status === 'skipped' ? '⊘' : '✗'} Step {s.step} ({s.type}) — {s.duration_ms}ms
                  {s.tokens ? <span className="text-gray-500"> · {s.tokens} tok</span> : ''}
                  {s.cost_usd ? <span className="text-yellow-600"> · ${s.cost_usd.toFixed(5)}</span> : ''}
                  {s.error ? <span className="text-red-400"> — {s.error}</span> : ''}
                </p>
              ))}
            </div>
          )}

          {selected && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <Hdr title={`Run History — ${selected.name}`} />
              <Table
                cols={['Status','Duration','Cost','H-Score','Eval','Time']}
                empty="No runs yet — click ▶ Run to execute"
                rows={wfRuns.map(r => [
                  <StatusBadge status={r.status} />,
                  <span className="text-xs">{r.duration_ms != null ? r.duration_ms + 'ms' : '—'}</span>,
                  <span className="text-xs text-yellow-600">{r.cost_usd != null && Number(r.cost_usd) > 0 ? '$' + Number(r.cost_usd).toFixed(5) : '—'}</span>,
                  <span className="text-xs" style={{ color: r.hallucination_score > 0.2 ? '#f43f5e' : '#10b981' }}>{r.hallucination_score != null ? (r.hallucination_score * 100).toFixed(0) + '%' : '—'}</span>,
                  <span className="text-xs" style={{ color: r.evaluation_score < 0.65 ? '#f43f5e' : '#10b981' }}>{r.evaluation_score != null ? (r.evaluation_score * 100).toFixed(0) + '%' : '—'}</span>,
                  <span className="text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>,
                ])}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RULES ENGINE TAB
// ══════════════════════════════════════════════════════════════════════════════
function RulesTab() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'insight' | 'recommendation'>('insight');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', rule_type: 'threshold', priority: '50', confidence_floor: '0.6', output_template: '' });
  const [recForm, setRecForm] = useState({ name: '', description: '', rule_type: 'stage_based', priority: '50', min_confidence: '0.5', cooldown_hours: '24' });

  const { data: ir } = useQuery({ queryKey: [BASE + '/insight-rules'], queryFn: () => api(BASE + '/insight-rules'), staleTime: 30_000 });
  const { data: rr } = useQuery({ queryKey: [BASE + '/recommendation-rules'], queryFn: () => api(BASE + '/recommendation-rules'), staleTime: 30_000 });

  const createIR = useMutation({ mutationFn: () => post(BASE + '/insight-rules', { ...form, priority: Number(form.priority), confidence_floor: Number(form.confidence_floor), condition_logic: { field: 'score', operator: 'gte', threshold: 0.7 } }), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/insight-rules'] }); setShowForm(false); } });
  const createRR = useMutation({ mutationFn: () => post(BASE + '/recommendation-rules', { ...recForm, priority: Number(recForm.priority), min_confidence: Number(recForm.min_confidence), cooldown_hours: Number(recForm.cooldown_hours), eligibility_criteria: { requires: ['capadex_session'] }, recommendation_template: { type: 'general', template: 'Recommendation: {insight}', cta: 'Learn More' } }), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/recommendation-rules'] }); setShowForm(false); } });
  const toggleIR = useMutation({ mutationFn: (r: any) => put(BASE + '/insight-rules/' + r.id, { is_active: !r.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/insight-rules'] }) });
  const toggleRR = useMutation({ mutationFn: (r: any) => put(BASE + '/recommendation-rules/' + r.id, { is_active: !r.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/recommendation-rules'] }) });

  const insightRules: any[] = ir?.rules ?? [];
  const recRules: any[]    = rr?.rules ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Hdr title="Rules Engine" sub="Insight generation and recommendation rules — conditions, outputs, and priorities" />
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['insight','recommendation'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setShowForm(false); }} className={`px-3 py-1 rounded-md text-xs font-semibold transition ${mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>{m === 'insight' ? '💡 Insight' : '🎯 Recommendation'}</button>
            ))}
          </div>
          <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold bg-indigo-600">+ New Rule</button>
        </div>
      </div>

      {showForm && mode === 'insight' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 grid grid-cols-2 gap-3">
          <p className="col-span-2 text-sm font-semibold text-indigo-800">New Insight Rule</p>
          {[['Name','name'],['Description','description'],['Rule Type','rule_type'],['Priority (0-100)','priority'],['Confidence Floor','confidence_floor']].map(([l,k]) => (
            <div key={k}><label className="text-xs text-gray-600">{l}</label>
              <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
            </div>
          ))}
          <div className="col-span-2"><label className="text-xs text-gray-600">Output Template</label>
            <textarea value={form.output_template} onChange={e => setForm(f => ({ ...f, output_template: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" rows={2} />
          </div>
          <div className="col-span-2 flex gap-2">
            <button onClick={() => createIR.mutate()} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold">{createIR.isPending ? 'Creating…' : 'Create'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {showForm && mode === 'recommendation' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 grid grid-cols-2 gap-3">
          <p className="col-span-2 text-sm font-semibold text-indigo-800">New Recommendation Rule</p>
          {[['Name','name'],['Description','description'],['Rule Type','rule_type'],['Priority','priority'],['Min Confidence','min_confidence'],['Cooldown (hrs)','cooldown_hours']].map(([l,k]) => (
            <div key={k}><label className="text-xs text-gray-600">{l}</label>
              <input value={(recForm as any)[k]} onChange={e => setRecForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
            </div>
          ))}
          <div className="col-span-2 flex gap-2">
            <button onClick={() => createRR.mutate()} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold">{createRR.isPending ? 'Creating…' : 'Create'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table
          cols={mode === 'insight' ? ['Name','Type','Priority','Confidence','Triggers','Status',''] : ['Name','Type','Priority','Min Conf','Cooldown','Acceptance','Status','']}
          empty={`No ${mode} rules yet`}
          rows={mode === 'insight' ? insightRules.map(r => [
            <div><p className="text-sm font-semibold text-gray-800">{r.name}</p><p className="text-xs text-gray-400 mt-0.5">{r.description}</p></div>,
            <Badge label={r.rule_type ?? 'threshold'} color="#a855f7" />,
            <span className="text-xs font-bold text-gray-700">{r.priority}</span>,
            <span className="text-xs">{(Number(r.confidence_floor) * 100).toFixed(0)}%</span>,
            <span className="text-xs">{r.trigger_count ?? 0}</span>,
            <StatusBadge status={r.is_active ? 'active' : 'draft'} />,
            <button onClick={() => toggleIR.mutate(r)} className="text-xs text-indigo-600 hover:underline">{r.is_active ? 'Disable' : 'Enable'}</button>,
          ]) : recRules.map(r => [
            <div><p className="text-sm font-semibold text-gray-800">{r.name}</p><p className="text-xs text-gray-400 mt-0.5">{r.description}</p></div>,
            <Badge label={r.rule_type} color="#3b82f6" />,
            <span className="text-xs font-bold">{r.priority}</span>,
            <span className="text-xs">{(Number(r.min_confidence) * 100).toFixed(0)}%</span>,
            <span className="text-xs">{r.cooldown_hours}h</span>,
            <span className="text-xs">{r.acceptance_rate != null ? r.acceptance_rate + '%' : '—'}</span>,
            <StatusBadge status={r.is_active ? 'active' : 'draft'} />,
            <button onClick={() => toggleRR.mutate(r)} className="text-xs text-indigo-600 hover:underline">{r.is_active ? 'Disable' : 'Enable'}</button>,
          ])}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EVALUATION & SAFETY TAB
// ══════════════════════════════════════════════════════════════════════════════
function SafetyTab() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'evaluations' | 'flags' | 'filters'>('evaluations');
  const [scanText, setScanText] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [filterForm, setFilterForm] = useState({ filter_name: '', filter_type: 'keyword', pattern: '', severity: 'medium', action: 'flag' });
  const [showFilterForm, setShowFilterForm] = useState(false);
  const [evalForm, setEvalForm] = useState({ output: '' });

  const { data: evals } = useQuery({ queryKey: [BASE + '/evaluations'], queryFn: () => api(BASE + '/evaluations?limit=50'), staleTime: 30_000, enabled: mode === 'evaluations' });
  const { data: flags } = useQuery({ queryKey: [BASE + '/hallucination-flags'], queryFn: () => api(BASE + '/hallucination-flags?limit=50'), staleTime: 30_000, enabled: mode === 'flags' });
  const { data: filters } = useQuery({ queryKey: [BASE + '/content-filters'], queryFn: () => api(BASE + '/content-filters'), staleTime: 30_000, enabled: mode === 'filters' });

  const scanMut = useMutation({ mutationFn: () => post(BASE + '/hallucination-check', { text: scanText }), onSuccess: setScanResult });
  const evalMut = useMutation({ mutationFn: () => post(BASE + '/evaluations', { output: evalForm.output, context: {} }), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/evaluations'] }); } });
  const reviewMut = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => post(BASE + '/hallucination-flags/' + id + '/review', { review_status: status }), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/hallucination-flags'] }) });
  const createFilterMut = useMutation({ mutationFn: () => post(BASE + '/content-filters', filterForm), onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/content-filters'] }); setShowFilterForm(false); } });
  const deleteFilterMut = useMutation({ mutationFn: (id: string) => del(BASE + '/content-filters/' + id), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/content-filters'] }) });

  const evalList: any[]   = evals?.evaluations ?? [];
  const flagList: any[]   = flags?.flags ?? [];
  const filterList: any[] = filters?.filters ?? [];

  const evalStats = evals?.stats;
  const flagStats = (flags?.stats ?? []).reduce((acc: any, r: any) => { acc[r.review_status] = (acc[r.review_status] ?? 0) + r.n; return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Hdr title="Evaluation & Safety" sub="Evaluation framework, hallucination controls, and content filters" />
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['evaluations','flags','filters'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition ${mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>
              {m === 'evaluations' ? '📊 Evaluations' : m === 'flags' ? '🚩 Hal. Flags' : '🔒 Content Filters'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'evaluations' && (
        <div className="space-y-4">
          {evalStats && (
            <div className="grid grid-cols-3 gap-3">
              <KPI label="Total (7d)" value={evalStats.total ?? 0} accent="#6366f1" />
              <KPI label="Passed (7d)" value={evalStats.passed ?? 0} accent="#10b981" />
              <KPI label="Avg Score" value={typeof evalStats.avg_score === 'number' ? (evalStats.avg_score * 100).toFixed(1) + '%' : '—'} accent="#22d3ee" />
            </div>
          )}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-3 items-end">
            <div className="flex-1"><label className="text-xs text-gray-600">Evaluate AI Output</label>
              <textarea value={evalForm.output} onChange={e => setEvalForm(f => ({ ...f, output: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono mt-0.5" rows={3} placeholder='Paste AI output JSON or text…' />
            </div>
            <button onClick={() => evalMut.mutate()} disabled={evalMut.isPending || !evalForm.output.trim()} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg font-semibold whitespace-nowrap">
              {evalMut.isPending ? 'Evaluating…' : 'Run Evaluation'}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table
              cols={['Evaluator','Method','Overall','Passed','Time']}
              empty="No evaluations yet — run one above"
              rows={evalList.map(e => [
                <Badge label={e.evaluator ?? 'rule_based'} color="#6366f1" />,
                <Badge label={e.evaluator?.includes('llm') ? '🤖 LLM' : '📐 Rule'} color={e.evaluator?.includes('llm') ? '#10b981' : '#94a3b8'} />,
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full"><div className="h-1.5 rounded-full" style={{ background: e.overall_score >= 0.65 ? '#10b981' : '#f43f5e', width: ((e.overall_score ?? 0) * 100) + '%' }} /></div>
                  <span className="text-xs">{e.overall_score != null ? (e.overall_score * 100).toFixed(0) + '%' : '—'}</span>
                </div>,
                e.passed ? <Badge label="Pass" color="#10b981" /> : <Badge label="Fail" color="#f43f5e" />,
                <span className="text-xs text-gray-400">{e.evaluated_at ? new Date(e.evaluated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>,
              ])}
            />
          </div>
        </div>
      )}

      {mode === 'flags' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Pending" value={flagStats.pending ?? 0} accent="#f59e0b" />
            <KPI label="Confirmed" value={flagStats.confirmed ?? 0} accent="#f43f5e" />
            <KPI label="Dismissed" value={flagStats.dismissed ?? 0} accent="#94a3b8" />
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-3 items-end">
            <div className="flex-1"><label className="text-xs text-gray-600">Scan Text for Hallucination Signals</label>
              <textarea value={scanText} onChange={e => setScanText(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono mt-0.5" rows={3} placeholder="Paste AI-generated text to scan…" />
            </div>
            <button onClick={() => scanMut.mutate()} disabled={scanMut.isPending || !scanText.trim()} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg font-semibold whitespace-nowrap">
              {scanMut.isPending ? 'Scanning…' : 'Scan Text'}
            </button>
          </div>
          {scanResult && (
            <div className={`rounded-xl border p-3 text-sm ${scanResult.score > 0.3 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="font-semibold" style={{ color: scanResult.score > 0.3 ? '#f43f5e' : '#10b981' }}>
                Hallucination Score: {(scanResult.score * 100).toFixed(0)}% — {scanResult.score > 0.3 ? '⚠️ High risk' : '✓ Clean'}
              </p>
              {scanResult.flags.map((f: any, i: number) => (
                <p key={i} className="text-xs text-gray-600 mt-1"><SevDot s={f.severity} />{f.reason} — matched: <code>{f.pattern}</code></p>
              ))}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table
              cols={['Severity','Method','Reason','Status','Time','']}
              empty="No hallucination flags yet"
              rows={flagList.map(f => [
                <span className="flex items-center text-xs"><SevDot s={f.severity} />{f.severity}</span>,
                <Badge label={f.detection_method ?? 'keyword'} color="#6366f1" />,
                <span className="text-xs text-gray-600 max-w-[180px] truncate block">{f.reason ?? '—'}</span>,
                <StatusBadge status={f.review_status} />,
                <span className="text-xs text-gray-400">{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</span>,
                f.review_status === 'pending' ? (
                  <div className="flex gap-1">
                    <button onClick={() => reviewMut.mutate({ id: f.id, status: 'confirmed' })} className="text-xs text-red-600 hover:underline">Confirm</button>
                    <button onClick={() => reviewMut.mutate({ id: f.id, status: 'dismissed' })} className="text-xs text-gray-500 hover:underline">Dismiss</button>
                  </div>
                ) : <span />,
              ])}
            />
          </div>
        </div>
      )}

      {mode === 'filters' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowFilterForm(v => !v)} className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold bg-indigo-600">+ Add Filter</button>
          </div>
          {showFilterForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 grid grid-cols-2 gap-3">
              {[['Filter Name','filter_name'],['Type (keyword/regex)','filter_type'],['Pattern','pattern'],['Scope (output/input/both)','scope'],['Severity','severity'],['Action (flag/block/redact)','action']].map(([l,k]) => (
                <div key={k}><label className="text-xs text-gray-600">{l}</label>
                  <input value={(filterForm as any)[k]} onChange={e => setFilterForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5" />
                </div>
              ))}
              <div className="col-span-2 flex gap-2">
                <button onClick={() => createFilterMut.mutate()} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">Save</button>
                <button onClick={() => setShowFilterForm(false)} className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table
              cols={['Name','Type','Pattern','Scope','Severity','Action','Matches','']}
              empty="No content filters"
              rows={filterList.map(f => [
                <span className="text-xs font-semibold text-gray-700">{f.filter_name}</span>,
                <Badge label={f.filter_type} color="#a855f7" />,
                <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 max-w-[120px] truncate block">{f.pattern}</code>,
                <span className="text-xs">{f.scope}</span>,
                <span className="flex items-center text-xs"><SevDot s={f.severity} />{f.severity}</span>,
                <Badge label={f.action} color={f.action === 'block' ? '#f43f5e' : f.action === 'redact' ? '#f59e0b' : '#6366f1'} />,
                <span className="text-xs">{f.match_count ?? 0}</span>,
                f.is_active ? <button onClick={() => deleteFilterMut.mutate(f.id)} className="text-xs text-red-500 hover:underline">Disable</button> : <Badge label="Disabled" color="#94a3b8" />,
              ])}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS TAB
// ══════════════════════════════════════════════════════════════════════════════
function AuditTab() {
  const [filters, setFilters] = useState({ action: '', entity_type: '', limit: '100' });
  const { data, refetch, isFetching } = useQuery({
    queryKey: [BASE + '/audit-logs', filters],
    queryFn: () => {
      const params = new URLSearchParams({ limit: filters.limit });
      if (filters.action) params.set('action', filters.action);
      if (filters.entity_type) params.set('entity_type', filters.entity_type);
      return api(BASE + '/audit-logs?' + params);
    },
    staleTime: 15_000,
  });
  const logs: any[] = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <Hdr title="Audit Logs" sub="Append-only record of all AI governance operations (domain: ai_governance)" />
      <div className="flex gap-3 items-end flex-wrap">
        {[['Action filter','action'],['Entity type','entity_type'],['Limit','limit']].map(([l,k]) => (
          <div key={k}><label className="text-xs text-gray-600">{l}</label>
            <input value={(filters as any)[k]} onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5 min-w-[120px]" />
          </div>
        ))}
        <button onClick={() => refetch()} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-semibold">
          {isFetching ? 'Loading…' : 'Search'}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table
          cols={['Time','Actor','Action','Entity','Outcome','IP']}
          empty="No audit logs yet"
          rows={logs.map(l => [
            <span className="text-xs text-gray-500 whitespace-nowrap">{l.ts ? new Date(l.ts).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '—'}</span>,
            <span className="text-xs text-gray-700">{l.actor ?? 'system'}</span>,
            <span className="text-xs font-mono text-indigo-700">{l.action}</span>,
            <span className="text-xs text-gray-500">{l.entity_type}{l.entity_id ? ` · ${String(l.entity_id).slice(0, 8)}` : ''}</span>,
            <StatusBadge status={l.outcome ?? 'success'} />,
            <span className="text-xs text-gray-300">{l.ip_address ?? '—'}</span>,
          ])}
        />
      </div>
      <p className="text-xs text-gray-400">{logs.length} records returned · Read-only (append-only table)</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MONITORING TAB
// ══════════════════════════════════════════════════════════════════════════════
function MonitoringTab() {
  const qc = useQueryClient();
  const [hours, setHours] = useState('24');
  const [alertForm, setAlertForm] = useState({ alert_name: '', alert_type: 'threshold', severity: 'warning', metric: '', operator: 'gt', threshold: '' });
  const [showAlertForm, setShowAlertForm] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: [BASE + '/monitoring', hours],
    queryFn: () => api(BASE + '/monitoring?hours=' + hours),
    staleTime: 30_000,
  });
  const refreshMut = useMutation({ mutationFn: () => post(BASE + '/monitoring/refresh', {}), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/monitoring'] }) });
  const ackMut = useMutation({ mutationFn: (id: string) => post(BASE + '/alerts/' + id + '/acknowledge', {}), onSuccess: () => qc.invalidateQueries({ queryKey: [BASE + '/monitoring'] }) });
  const createAlertMut = useMutation({
    mutationFn: () => post(BASE + '/alerts', { alert_name: alertForm.alert_name, alert_type: alertForm.alert_type, severity: alertForm.severity, condition: { metric: alertForm.metric, operator: alertForm.operator, threshold: Number(alertForm.threshold), window_minutes: 60 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [BASE + '/monitoring'] }); setShowAlertForm(false); }
  });
  const { data: pols } = useQuery({ queryKey: [BASE + '/policies'], queryFn: () => api(BASE + '/policies'), staleTime: 60_000 });

  const allAlerts: any[]    = data?.alerts ?? [];
  const triggered: any[]    = data?.triggered_alerts ?? [];
  const latest: any         = data?.latest_metrics ?? {};
  const policies: any[]     = pols?.policies ?? [];

  const metricKeys = ['workflow_error_rate','hallucination_rate','eval_pass_rate','workflow_runs_total','hourly_cost_usd'];
  const sparkData = metricKeys.map(k => ({ metric: k.replace(/_/g,' '), value: Number(latest[k] ?? 0) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Hdr title="Monitoring & Governance" sub="Live metrics, alert conditions, and governance policy enforcement" />
        <div className="flex gap-2 items-center">
          <select value={hours} onChange={e => setHours(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
            {[['1h','1'],['6h','6'],['24h','24'],['7d','168']].map(([l,v]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending} className="px-3 py-1.5 text-xs rounded-lg text-white font-semibold" style={{ background: refreshMut.isPending ? '#94a3b8' : '#6366f1' }}>
            {refreshMut.isPending ? 'Refreshing…' : '⟳ Refresh Metrics'}
          </button>
        </div>
      </div>

      {/* Live metrics */}
      <div>
        <Hdr title="Current Metrics" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <KPI label="Error Rate"      value={((latest.workflow_error_rate ?? 0) * 100).toFixed(1) + '%'} accent={latest.workflow_error_rate > 0.1 ? '#f43f5e' : '#10b981'} />
          <KPI label="Hallucination"   value={((latest.hallucination_rate ?? 0) * 100).toFixed(1) + '%'} accent={latest.hallucination_rate > 0.2 ? '#f43f5e' : '#10b981'} />
          <KPI label="Eval Pass Rate"  value={((latest.eval_pass_rate ?? 0) * 100).toFixed(1) + '%'} accent={latest.eval_pass_rate < 0.7 ? '#f43f5e' : '#10b981'} />
          <KPI label="Runs Total"      value={latest.workflow_runs_total ?? 0} accent="#6366f1" />
          <KPI label="Hourly Cost"     value={'$' + (latest.hourly_cost_usd ?? 0).toFixed(4)} accent="#f59e0b" />
        </div>
      </div>

      {/* Metric bar chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Hdr title="Metric Snapshot" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sparkData} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
            <YAxis type="category" dataKey="metric" tick={{ fontSize: 10 }} width={140} />
            <Tooltip formatter={(v: any) => typeof v === 'number' ? v.toFixed(4) : v} />
            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]}>
              {sparkData.map((_, i) => <Cell key={i} fill={P[i % P.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">⚠️ {triggered.length} Alert{triggered.length !== 1 ? 's' : ''} Currently Triggered</p>
          {triggered.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-red-100 first:border-0">
              <div className="flex items-center gap-2">
                <SevDot s={a.severity} />
                <span className="text-sm font-semibold text-gray-800">{a.alert_name}</span>
                <StatusBadge status={a.severity} />
              </div>
              {!a.acknowledged_at && (
                <button onClick={() => ackMut.mutate(a.id)} className="px-2 py-0.5 text-xs bg-white border border-red-200 text-red-700 rounded-lg font-semibold hover:bg-red-100">
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* All alerts */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <Hdr title="Alert Definitions" />
          <button onClick={() => setShowAlertForm(v => !v)} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">+ New Alert</button>
        </div>
        {showAlertForm && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 grid grid-cols-3 gap-3">
            {[['Alert Name','alert_name'],['Type','alert_type'],['Severity','severity'],['Metric Key','metric'],['Operator (gt/lt)','operator'],['Threshold','threshold']].map(([l,k]) => (
              <div key={k}><label className="text-xs text-gray-600">{l}</label>
                <input value={(alertForm as any)[k]} onChange={e => setAlertForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs mt-0.5" />
              </div>
            ))}
            <div className="col-span-3 flex gap-2">
              <button onClick={() => createAlertMut.mutate()} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-semibold">Save</button>
              <button onClick={() => setShowAlertForm(false)} className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded-lg">Cancel</button>
            </div>
          </div>
        )}
        <Table
          cols={['Alert Name','Type','Severity','Condition','Triggers','Last Triggered','']}
          empty="No alerts defined"
          rows={allAlerts.map(a => [
            <span className="text-xs font-semibold text-gray-800">{a.alert_name}</span>,
            <Badge label={a.alert_type} color="#6366f1" />,
            <span className="flex items-center text-xs"><SevDot s={a.severity} />{a.severity}</span>,
            <span className="text-xs font-mono text-gray-500">{a.condition?.metric} {a.condition?.operator} {a.condition?.threshold}</span>,
            <span className="text-xs">{a.trigger_count ?? 0}</span>,
            <span className="text-xs text-gray-400">{a.last_triggered_at ? new Date(a.last_triggered_at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</span>,
            a.acknowledged_at ? <Badge label="Acked" color="#94a3b8" /> : <span />,
          ])}
        />
      </div>

      {/* Governance Policies */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <Hdr title="Governance Policies" sub="Active enforcement rules — rate limits, cost caps, content filters, data retention" />
        </div>
        <Table
          cols={['Policy Name','Type','Scope','Mode','Active','Violations','Configuration']}
          empty="No policies"
          rows={policies.map(p => [
            <span className="text-xs font-semibold text-gray-800">{p.name}</span>,
            <Badge label={p.policy_type} color="#a855f7" />,
            <span className="text-xs text-gray-500">{p.scope}</span>,
            <StatusBadge status={p.enforcement_mode ?? 'enforce'} />,
            p.is_active ? <Badge label="On" color="#10b981" /> : <Badge label="Off" color="#94a3b8" />,
            <span className="text-xs">{p.violation_count ?? 0}</span>,
            <details className="cursor-pointer"><summary className="text-xs text-indigo-600 hover:underline">View</summary>
              <pre className="text-[9px] font-mono bg-gray-50 p-2 rounded mt-1 max-w-[200px] overflow-auto">{JSON.stringify(p.configuration, null, 2)}</pre>
            </details>,
          ])}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
export default function AiGovernancePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { data: status, isError } = useQuery({
    queryKey: [BASE + '/status'],
    queryFn: () => api(BASE + '/status'),
    staleTime: 60_000,
    retry: false,
  });

  const flagOff = isError || !status?.flag;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🛡️</span> AI Governance Platform
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              15-table aig_* warehouse — Prompts · Versioning · Workflows · Models · Rules · Evaluation · Hallucination Controls · Audit · Monitoring
            </p>
          </div>
          {status?.summary && (
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Platform Active</span>
              <span>{status.summary.prompts?.active ?? 0} prompts</span>
              <span>{status.summary.models?.available ?? 0} models</span>
              <span>{status.summary.workflows?.active ?? 0} workflows</span>
            </div>
          )}
        </div>

        {flagOff && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <strong>FF_AI_GOVERNANCE</strong> is disabled. Add it to the Backend API workflow command to enable.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'dashboard'  && <DashboardTab />}
        {activeTab === 'prompts'    && <PromptsTab />}
        {activeTab === 'models'     && <ModelsTab />}
        {activeTab === 'workflows'  && <WorkflowsTab />}
        {activeTab === 'rules'      && <RulesTab />}
        {activeTab === 'safety'     && <SafetyTab />}
        {activeTab === 'audit'      && <AuditTab />}
        {activeTab === 'monitoring' && <MonitoringTab />}
      </div>
    </div>
  );
}
