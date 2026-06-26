import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MessageCircle, Plus, Edit2, Archive, Link, Unlink, RefreshCw } from 'lucide-react';

type Tab = 'concerns' | 'questions' | 'mapping';

const SEVERITIES = ['low','moderate','high','critical'];
const PERSONAS = ['all','student','professional','transitioning'];
const ASSESSMENT_TYPES = ['behavioral','technical','situational','self_report','manager_rating','portfolio','observation','feedback_360','knowledge_check','simulation'];
const RESPONSE_FORMATS = ['likert_5','likert_7','mcq','open_text','situational','rating_scale'];
const STATUS_COLORS: Record<string, string> = {
  draft:'bg-gray-100 text-gray-700', in_review:'bg-yellow-100 text-yellow-700',
  approved:'bg-blue-100 text-blue-700', published:'bg-green-100 text-green-700',
  deprecated:'bg-orange-100 text-orange-700', archived:'bg-red-100 text-red-700',
};
const SEV_COLORS: Record<string, string> = {
  low:'bg-green-100 text-green-700', moderate:'bg-yellow-100 text-yellow-700',
  high:'bg-orange-100 text-orange-700', critical:'bg-red-100 text-red-700',
};

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
}
function StatusBadge({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>;
}

// ── Concerns Tab ──────────────────────────────────────────────────────────────
function ConcernsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ont-concerns', search, severity, page],
    queryFn: async () => {
      const p = new URLSearchParams({ search, page: String(page), limit: '50', ...(severity !== 'all' && { severity }) });
      return apiFetch(`/api/ontology/ont-concerns?${p}`).then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); });
    },
  });

  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sync = useMutation({
    mutationFn: async () => {
      const r = await apiFetch('/api/ontology/ont-concerns/sync-from-capadex', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Sync failed');
      return j as { ok: boolean; synced: number; capadex_total: number; message: string };
    },
    onSuccess: (j) => {
      setSyncMsg({ ok: j.ok !== false, text: j.message || `Mirrored ${j.synced} concern(s) from CAPADEX.` });
      qc.invalidateQueries({ queryKey: ['ont-concerns'] });
    },
    onError: (e: any) => setSyncMsg({ ok: false, text: String(e?.message || e) }),
  });

  const items: any[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
        <p>
          Concerns are sourced from the <span className="font-semibold">CAPADEX Concerns Master</span> — the single
          source of truth. They are read-only here; use <span className="font-semibold">Sync from CAPADEX</span> to
          mirror the latest concerns. Existing concern&nbsp;↔&nbsp;indicator and concern&nbsp;↔&nbsp;question links are preserved on sync.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search concerns, bridge tags…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-gray-500">{total}</span>
        <button onClick={() => { setSyncMsg(null); sync.mutate(); }} disabled={sync.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${sync.isPending ? 'animate-spin' : ''}`} /> {sync.isPending ? 'Syncing…' : 'Sync from CAPADEX'}
        </button>
      </div>

      {syncMsg && (
        <div className={`rounded-lg px-4 py-2 text-sm ${syncMsg.ok ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {syncMsg.text}
        </div>
      )}

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : isError ? (
        <div className="text-center py-8 text-gray-500">
          Couldn't load concerns. <button onClick={() => refetch()} className="underline font-medium">Retry</button>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Domain</th>
              <th className="px-4 py-3 text-left">Bridge Tag</th>
              <th className="px-4 py-3 text-left">Indicators</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLORS[row.severity] ?? 'bg-gray-100 text-gray-500'}`}>{row.severity}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.domain ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[140px] truncate" title={row.concern_bridge_tag}>{row.concern_bridge_tag ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.indicator_count ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No concerns yet — use <span className="font-medium">Sync from CAPADEX</span> to mirror them.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-between items-center text-sm">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
          <span className="text-gray-500">Page {page} of {Math.ceil(total/50)}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p+1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

// ── Assessment Questions Tab ───────────────────────────────────────────────────
function QuestionsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [assessType, setAssessType] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ont-questions', search, assessType, page],
    queryFn: async () => {
      const p = new URLSearchParams({ search, page: String(page), limit: '50', ...(assessType !== 'all' && { assessment_type: assessType }) });
      return apiFetch(`/api/ontology/assessment-questions?${p}`).then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); });
    },
  });

  const save = useMutation({
    mutationFn: async (body: any) => {
      const r = body.id
        ? await apiFetch(`/api/ontology/assessment-questions/${body.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/api/ontology/assessment-questions', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ont-questions'] }); setForm(null); },
  });

  const archive = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/ontology/assessment-questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ont-questions'] }),
  });

  const items: any[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search code or stem…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={assessType} onChange={e => setAssessType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All types</option>
          {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-sm text-gray-500">{total}</span>
        <button onClick={() => setForm({})}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Question
        </button>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : isError ? (
        <div className="text-center py-8 text-gray-500">
          Couldn't load questions. <button onClick={() => refetch()} className="underline font-medium">Retry</button>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left w-80">Stem</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Format</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Difficulty</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs max-w-[300px]">
                    <div className="line-clamp-2" title={row.stem}>{row.stem}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs capitalize">{row.assessment_type}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.response_format}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.source}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.difficulty_tier}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setForm(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archive.mutate(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Archive className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={8} className="text-center py-8 text-gray-400">No questions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-between items-center text-sm">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
          <span className="text-gray-500">Page {page} of {Math.ceil(total/50)}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p+1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg">{form.id ? 'Edit Question' : 'New Question'}</h3>
            {!form.id && <div>
              <label className="text-xs font-medium text-gray-500">Code *</label>
              <input value={form.code||''} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="Q_WRTCOMM_BEH_001" />
            </div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Stem (question text) *</label>
              <textarea value={form.stem||''} onChange={e => setForm({...form, stem: e.target.value})}
                rows={3} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="I am able to express my ideas clearly in writing." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Assessment Type</label>
                <select value={form.assessment_type||'behavioral'} onChange={e => setForm({...form, assessment_type: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Response Format</label>
                <select value={form.response_format||'likert_5'} onChange={e => setForm({...form, response_format: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {RESPONSE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Polarity</label>
                <select value={form.polarity||'positive'} onChange={e => setForm({...form, polarity: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  <option value="positive">positive</option>
                  <option value="negative">negative</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Difficulty</label>
                <select value={form.difficulty_tier||'medium'} onChange={e => setForm({...form, difficulty_tier: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['easy','medium','hard','extreme'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Source</label>
                <select value={form.source||'native'} onChange={e => setForm({...form, source: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['native','caf','capadex','external'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Time Estimate (secs)</label>
                <input type="number" value={form.time_estimate_secs||90} onChange={e => setForm({...form, time_estimate_secs: parseInt(e.target.value)})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select value={form.status||'draft'} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['draft','in_review','approved','published','deprecated','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.reverse_score} onChange={e => setForm({...form, reverse_score: e.target.checked})} />
              Reverse Score
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={save.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {save.error && <p className="text-red-600 text-xs">{String(save.error)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mapping Chain Viewer ───────────────────────────────────────────────────────
function MappingTab() {
  const { data: statsData } = useQuery({
    queryKey: ['concerns-mapping-stats'],
    queryFn: () => apiFetch('/api/ontology/concerns-mapping/stats').then(r => r.json()),
  });
  const s = statsData?.stats;

  const chainLinks = [
    { from: 'Micro Competency', to: 'Concern', table: 'map_micro_concern', count: s?.micro_concern_links },
    { from: 'Concern', to: 'Indicator', table: 'map_concern_indicator', count: s?.concern_indicator_links },
    { from: 'Indicator', to: 'Question', table: 'map_indicator_question', count: s?.indicator_question_links },
    { from: 'Micro Competency', to: 'Question', table: 'map_micro_question', count: s?.micro_question_links, direct: true },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-900 mb-1">Assessment Chain Coverage</h3>
        <p className="text-sm text-indigo-700 mb-4">
          The assessment chain connects Micro Competencies → Concerns → Indicators → Assessment Questions.
          Use the entity detail views to add / remove links on individual records.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {chainLinks.map(l => (
            <div key={l.table} className={`bg-white rounded-lg p-4 ${l.direct ? 'border-2 border-dashed border-indigo-200' : ''}`}>
              <div className="text-2xl font-bold text-indigo-700">{l.count ?? '—'}</div>
              <div className="text-xs text-gray-500 mt-1">
                {l.from} → {l.to}
                {l.direct && <span className="ml-1 text-indigo-400">(direct)</span>}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-1">{l.table}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {s && [
          { label: 'Ontology Concerns', value: s.concerns_total, sub: `${s.concerns_published} published · ${s.concerns_bridged} CAPADEX-bridged` },
          { label: 'Assessment Questions', value: s.questions_total, sub: `${s.questions_published} published` },
        ].map(card => (
          <div key={card.label} className="bg-white border rounded-xl p-5">
            <div className="text-3xl font-bold text-gray-800">{card.value}</div>
            <div className="font-medium text-gray-600 mt-1">{card.label}</div>
            <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>How to link entities:</strong> Navigate to the Micro Competency, Concern, or Indicator record in the table above,
        and use the "Link Concerns / Link Indicators / Link Questions" action on its detail row.
        API endpoints: <code className="bg-amber-100 px-1 rounded font-mono text-xs">/api/ontology/micro-competencies/:id/concerns</code>,
        <code className="bg-amber-100 px-1 rounded font-mono text-xs">/api/ontology/concerns/:id/indicators</code>,
        <code className="bg-amber-100 px-1 rounded font-mono text-xs">/api/ontology/indicators/:id/questions</code>.
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'concerns',  label: 'Ontology Concerns',    icon: AlertTriangle },
  { id: 'questions', label: 'Assessment Questions', icon: MessageCircle },
  { id: 'mapping',   label: 'Mapping Chain',        icon: Link },
];

const NAV_TO_TAB: Record<string, Tab> = {
  'ont-concerns': 'concerns', 'ont-assessment-questions': 'questions',
};

export default function ConcernsMappingPanel({ initialTab }: { initialTab?: string }) {
  const startTab = (initialTab && NAV_TO_TAB[initialTab]) ?? 'concerns';
  const [tab, setTab] = useState<Tab>(startTab);

  React.useEffect(() => {
    if (initialTab && NAV_TO_TAB[initialTab]) setTab(NAV_TO_TAB[initialTab]);
  }, [initialTab]);
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Behavioural Mapping</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage Ontology Concerns, Assessment Questions, and the mapping chain that connects them.
          </p>
        </div>
        <div className="flex gap-1 border-b">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'concerns'  && <ConcernsTab />}
        {tab === 'questions' && <QuestionsTab />}
        {tab === 'mapping'   && <MappingTab />}
      </div>
    </div>
  );
}
