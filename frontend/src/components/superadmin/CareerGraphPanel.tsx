import React, { useState, useEffect, useCallback } from 'react';
import {
  Network, TrendingUp, BookOpen, BarChart3, Layers,
  AlertCircle, RefreshCw, Loader2, Plus, ChevronDown, Trash2, Pencil,
} from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    ...opts,
  });
  return res.json();
}

interface Stats {
  roles: number; edges: number; tracks: number;
  users_scored: number; skill_gaps: number; recs_stored: number;
  top_roles: Array<{ title: string; rec_count: number }>;
  readiness_distribution: Array<{ readiness_band: string; n: number }>;
}

interface RoleRow {
  id: number; role_key: string; title: string;
  seniority: string; function_area: string | null;
  industry: string | null; demand_score: number;
  automation_risk: number; is_active: boolean;
}

interface EdgeRow {
  id: number; from_title: string; to_title: string;
  edge_type: string; avg_months_transition: number; transition_probability: number;
}

interface Track {
  id: number; track_key: string; name: string;
  description: string | null; domain: string | null;
  waypoints?: Array<{ role_id: number; role_title: string; step_order: number; is_optional: boolean }>;
}

interface Resource {
  id: number; title: string; resource_type: string;
  provider: string | null; duration_hours: number | null;
  cost_band: string; difficulty: string; is_active: boolean;
}

type PanelTab = 'roles' | 'edges' | 'tracks' | 'learning' | 'analytics';

const PANEL_TABS: Array<{ id: PanelTab; label: string; Icon: React.ElementType }> = [
  { id: 'roles',     label: 'Roles',     Icon: Layers },
  { id: 'edges',     label: 'Edges',     Icon: Network },
  { id: 'tracks',    label: 'Tracks',    Icon: TrendingUp },
  { id: 'learning',  label: 'Learning',  Icon: BookOpen },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
];

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const BAND_COLORS: Record<string, string> = {
  overqualified: 'bg-emerald-400',
  ready:         'bg-emerald-500',
  approaching:   'bg-blue-400',
  developing:    'bg-amber-400',
  not_ready:     'bg-rose-400',
};

function AnalyticsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((bust = false) => {
    setLoading(true);
    apiFetch(`/api/admin/career-graph/stats${bust ? '?refresh=1' : ''}`)
      .then(d => { if (d.ok) setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> Loading analytics…</div>;
  if (!stats)  return null;

  const totalBandUsers = stats.readiness_distribution.reduce((s, d) => s + d.n, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Platform stats</h3>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Roles"         value={stats.roles}        sub="active" />
        <StatCard label="Graph edges"   value={stats.edges}        sub="transitions" />
        <StatCard label="Tracks"        value={stats.tracks}       sub="career paths" />
        <StatCard label="Users scored"  value={stats.users_scored} sub="readiness" />
        <StatCard label="Skill gaps"    value={stats.skill_gaps}   sub="tracked" />
        <StatCard label="Recs stored"   value={stats.recs_stored}  sub="recommendations" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top recommended roles */}
        {stats.top_roles.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Top recommended roles</p>
            {stats.top_roles.map(r => (
              <div key={r.title} className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-700 truncate">{r.title}</p>
                <span className="text-xs text-slate-500 shrink-0">{r.rec_count} recs</span>
              </div>
            ))}
          </div>
        )}

        {/* Readiness distribution */}
        {stats.readiness_distribution.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Readiness distribution</p>
            {stats.readiness_distribution.map(d => {
              const pct = totalBandUsers > 0 ? Math.round((d.n / totalBandUsers) * 100) : 0;
              const barColor = BAND_COLORS[d.readiness_band] ?? 'bg-slate-300';
              return (
                <div key={d.readiness_band} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span className="capitalize">{d.readiness_band.replace('_', ' ')}</span>
                    <span>{d.n} users · {pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AddRoleForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ role_key: '', title: '', seniority: 'mid', function_area: '', industry: '', demand_score: 50 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.role_key || !form.title) return;
    setSaving(true);
    await apiFetch('/api/admin/career-graph/roles', { method: 'POST', body: JSON.stringify(form) }).catch(() => {});
    setSaving(false);
    setOpen(false);
    setForm({ role_key: '', title: '', seniority: 'mid', function_area: '', industry: '', demand_score: 50 });
    onSaved();
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
      <Plus size={14} /> Add role
    </button>
  );

  return (
    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-3 max-w-2xl">
      <p className="text-sm font-medium text-slate-700">New role</p>
      <div className="grid grid-cols-2 gap-3">
        {(['role_key', 'title', 'function_area', 'industry'] as const).map(k => (
          <input key={k} placeholder={k.replace('_', ' ')} value={String(form[k])}
            onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
        ))}
        <select value={form.seniority} onChange={e => setForm(p => ({ ...p, seniority: e.target.value }))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400">
          {['entry','mid','senior','lead','principal','executive'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
      </div>
    </div>
  );
}

function AddResourceForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', resource_type: 'course', provider: '', url: '', cost_band: 'free', difficulty: 'beginner' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title) return;
    setSaving(true);
    await apiFetch('/api/admin/career-graph/learning-resources', { method: 'POST', body: JSON.stringify(form) }).catch(() => {});
    setSaving(false);
    setOpen(false);
    onSaved();
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
      <Plus size={14} /> Add resource
    </button>
  );

  return (
    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-3 max-w-2xl">
      <p className="text-sm font-medium text-slate-700">New learning resource</p>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          className="col-span-2 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
        <input placeholder="Provider" value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
        <input placeholder="URL" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
        <select value={form.resource_type} onChange={e => setForm(p => ({ ...p, resource_type: e.target.value }))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400">
          {['course','video','article','book','workshop','certification','podcast'].map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={form.cost_band} onChange={e => setForm(p => ({ ...p, cost_band: e.target.value }))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400">
          {['free','low','mid','premium'].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
      </div>
    </div>
  );
}

function TrackAccordion({ track }: { track: Track }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left">
        <div>
          <p className="font-medium text-sm text-slate-800">{track.name}</p>
          <p className="text-xs text-slate-400">{track.track_key}{track.domain ? ` · ${track.domain}` : ''}</p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 bg-slate-50 space-y-2 border-t border-slate-100">
          {track.description && <p className="text-xs text-slate-500 pt-2">{track.description}</p>}
          {(track.waypoints ?? []).length > 0 ? (
            <div className="flex flex-col gap-1 mt-2">
              {(track.waypoints ?? []).sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0)).map(w => (
                <div key={w.role_id} className="flex items-center gap-2 text-xs text-slate-700 py-1">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                    {w.step_order}
                  </span>
                  <span>{w.role_title}</span>
                  {w.is_optional && <span className="text-slate-400">(optional)</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">No waypoints defined</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CareerGraphPanel() {
  const [tab, setTab]           = useState<PanelTab>('roles');
  const [roles, setRoles]       = useState<RoleRow[]>([]);
  const [edges, setEdges]       = useState<EdgeRow[]>([]);
  const [tracks, setTracks]     = useState<Track[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState('');
  const [editCell, setEditCell] = useState<{ id: number; field: string; value: string } | null>(null);

  const load = useCallback(async (t: PanelTab, bust = false) => {
    if (t === 'analytics') return;
    setLoading(true);
    setError('');
    try {
      const q = bust ? '?refresh=1' : '';
      if (t === 'roles') {
        const d = await apiFetch(`/api/admin/career-graph/roles?limit=200${q}`);
        if (d.ok) setRoles(d.roles ?? []);
        else setError(d.error ?? 'Error loading roles');
      } else if (t === 'edges') {
        const filter = edgeTypeFilter ? `&edge_type=${edgeTypeFilter}` : '';
        const d = await apiFetch(`/api/admin/career-graph/edges?limit=300${filter}${q}`);
        if (d.ok) setEdges(d.edges ?? []);
        else setError(d.error ?? 'Error loading edges');
      } else if (t === 'tracks') {
        const d = await apiFetch(`/api/admin/career-graph/tracks${q}`);
        if (d.ok) {
          const rawTracks: Track[] = d.tracks ?? [];
          const wayRes = await apiFetch('/api/admin/career-graph/track-waypoints').catch(() => ({ ok: false }));
          const allWp: Array<{ track_id: number; role_id: number; role_title: string; step_order: number; is_optional: boolean }> = wayRes.ok ? (wayRes.waypoints ?? []) : [];
          setTracks(rawTracks.map(tr => ({
            ...tr,
            waypoints: allWp.filter((w: { track_id: number }) => w.track_id === tr.id),
          })));
        } else setError(d.error ?? 'Error loading tracks');
      } else if (t === 'learning') {
        const d = await apiFetch(`/api/admin/career-graph/learning-resources?limit=150${q}`);
        if (d.ok) setResources(d.resources ?? []);
        else setError(d.error ?? 'Error loading resources');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [edgeTypeFilter]);

  useEffect(() => { load(tab); }, [tab]);

  const commitCell = () => {
    if (!editCell) return;
    const { id, field, value } = editCell;
    setEditCell(null);
    const num = Number(value);
    if (isNaN(num)) return;
    if (field === 'demand_score' || field === 'automation_risk') {
      apiFetch(`/api/admin/career-graph/roles/${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: num }) })
        .then(() => load('roles', true)).catch(() => {});
    } else if (field === 'transition_probability') {
      apiFetch(`/api/admin/career-graph/edges/${id}`, { method: 'PATCH', body: JSON.stringify({ transition_probability: num / 100 }) })
        .then(() => load('edges', true)).catch(() => {});
    } else if (field === 'avg_months_transition') {
      apiFetch(`/api/admin/career-graph/edges/${id}`, { method: 'PATCH', body: JSON.stringify({ avg_months_transition: num }) })
        .then(() => load('edges', true)).catch(() => {});
    }
  };

  const filteredRoles = roles.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.role_key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg"><Network size={18} className="text-indigo-600" /></div>
            <div>
              <h1 className="font-semibold text-slate-800">Career Graph Intelligence</h1>
              <p className="text-xs text-slate-400">Role graph · tracks · learning · analytics</p>
            </div>
          </div>
          <button
            onClick={() => load(tab, true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="flex gap-1 mt-4 overflow-x-auto">
          {PANEL_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab === id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {loading && tab !== 'analytics' && (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertCircle size={16} />{error}
          </div>
        )}

        {tab === 'analytics' && <AnalyticsTab />}

        {!loading && !error && tab === 'roles' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AddRoleForm onSaved={() => load('roles', true)} />
              <input
                placeholder="Search roles…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 w-56"
              />
              <span className="text-xs text-slate-400">{filteredRoles.length} of {roles.length}</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{['Title', 'Key', 'Seniority', 'Function', 'Industry', 'Demand', 'Auto-risk', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoles.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{r.role_key}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{r.seniority}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.function_area ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.industry ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 cursor-pointer group"
                        onClick={() => setEditCell(ec => ec?.id===r.id && ec.field==='demand_score' ? null : { id: r.id, field: 'demand_score', value: String(r.demand_score) })}>
                        {editCell?.id===r.id && editCell.field==='demand_score'
                          ? <input autoFocus className="w-14 px-1 py-0.5 text-xs border border-indigo-400 rounded" value={editCell.value}
                              onChange={e => setEditCell(ec => ec ? { ...ec, value: e.target.value } : null)}
                              onBlur={commitCell}
                              onKeyDown={e => { if (e.key==='Enter') commitCell(); if (e.key==='Escape') setEditCell(null); }} />
                          : <span className="flex items-center gap-1">{r.demand_score}/100 <Pencil size={9} className="opacity-0 group-hover:opacity-40" /></span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 cursor-pointer group"
                        onClick={() => setEditCell(ec => ec?.id===r.id && ec.field==='automation_risk' ? null : { id: r.id, field: 'automation_risk', value: String(r.automation_risk) })}>
                        {editCell?.id===r.id && editCell.field==='automation_risk'
                          ? <input autoFocus className="w-14 px-1 py-0.5 text-xs border border-indigo-400 rounded" value={editCell.value}
                              onChange={e => setEditCell(ec => ec ? { ...ec, value: e.target.value } : null)}
                              onBlur={commitCell}
                              onKeyDown={e => { if (e.key==='Enter') commitCell(); if (e.key==='Escape') setEditCell(null); }} />
                          : <span className="flex items-center gap-1">{r.automation_risk}% <Pencil size={9} className="opacity-0 group-hover:opacity-40" /></span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { if (confirm('Delete role "' + r.title + '"?')) apiFetch(`/api/admin/career-graph/roles/${r.id}`, { method:'DELETE' }).then(() => load('roles', true)).catch(()=>{}); }}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors" title="Delete role">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRoles.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">No roles. Add one above.</div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && tab === 'edges' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select value={edgeTypeFilter} onChange={e => { setEdgeTypeFilter(e.target.value); load('edges'); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400">
                <option value="">All types</option>
                {['promotion', 'lateral', 'pivot', 'diagonal', 'stretch'].map(t => <option key={t}>{t}</option>)}
              </select>
              <span className="text-xs text-slate-400">{edges.length} edges</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{['From role', 'To role', 'Type', 'Avg months', 'Probability', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {edges.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 text-sm">{e.from_title}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{e.to_title}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{e.edge_type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 cursor-pointer group"
                        onClick={() => setEditCell(ec => ec?.id===e.id && ec.field==='avg_months_transition' ? null : { id: e.id, field: 'avg_months_transition', value: String(e.avg_months_transition) })}>
                        {editCell?.id===e.id && editCell.field==='avg_months_transition'
                          ? <input autoFocus className="w-12 px-1 py-0.5 text-xs border border-indigo-400 rounded" value={editCell.value}
                              onChange={ev => setEditCell(ec => ec ? { ...ec, value: ev.target.value } : null)}
                              onBlur={commitCell}
                              onKeyDown={ev => { if (ev.key==='Enter') commitCell(); if (ev.key==='Escape') setEditCell(null); }} />
                          : <span className="flex items-center gap-1">{e.avg_months_transition}mo <Pencil size={9} className="opacity-0 group-hover:opacity-40" /></span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 cursor-pointer group"
                        onClick={() => setEditCell(ec => ec?.id===e.id && ec.field==='transition_probability' ? null : { id: e.id, field: 'transition_probability', value: String(Math.round(e.transition_probability * 100)) })}>
                        {editCell?.id===e.id && editCell.field==='transition_probability'
                          ? <input autoFocus className="w-12 px-1 py-0.5 text-xs border border-indigo-400 rounded" value={editCell.value}
                              onChange={ev => setEditCell(ec => ec ? { ...ec, value: ev.target.value } : null)}
                              onBlur={commitCell}
                              onKeyDown={ev => { if (ev.key==='Enter') commitCell(); if (ev.key==='Escape') setEditCell(null); }} />
                          : <span className="flex items-center gap-1">{Math.round(e.transition_probability * 100)}% <Pencil size={9} className="opacity-0 group-hover:opacity-40" /></span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => apiFetch(`/api/admin/career-graph/edges/${e.id}`, { method:'DELETE' }).then(() => load('edges', true)).catch(()=>{})}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors" title="Delete edge">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {edges.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">No edges loaded. Try adjusting filters.</div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && tab === 'tracks' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{tracks.length} tracks</p>
            {tracks.map(t => <TrackAccordion key={t.id} track={t} />)}
            {tracks.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">No tracks seeded yet.</div>
            )}
          </div>
        )}

        {!loading && !error && tab === 'learning' && (
          <div className="space-y-4">
            <AddResourceForm onSaved={() => load('learning', true)} />
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{['Title', 'Type', 'Provider', 'Duration', 'Cost', 'Difficulty', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resources.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">{r.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 capitalize">{r.resource_type}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.provider ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.duration_hours ? `${r.duration_hours}h` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          r.cost_band === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>{r.cost_band}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 capitalize">{r.difficulty}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.is_active ? 'Active' : 'Off'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { if (confirm('Delete "' + r.title + '"?')) apiFetch(`/api/admin/career-graph/learning-resources/${r.id}`, { method:'DELETE' }).then(() => load('learning', true)).catch(()=>{}); }}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors" title="Delete resource">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resources.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">No resources yet. Add one above.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
