import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Network, PieChart, TrendingUp, Brain, Plus, Edit2, Archive, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

type Tab = 'layers' | 'clusters' | 'competencies' | 'micros';

const LAYER_TYPES = ['proficiency','functional','behavioral','leadership','specialist','threshold'];
const COMPETENCY_TYPES = ['core','functional','leadership','specialist','threshold'];
const PROFICIENCY_LEVELS = ['novice','developing','intermediate','advanced','expert'];
const STATUS_COLORS: Record<string, string> = {
  draft:'bg-gray-100 text-gray-700', in_review:'bg-yellow-100 text-yellow-700',
  approved:'bg-blue-100 text-blue-700', published:'bg-green-100 text-green-700',
  deprecated:'bg-orange-100 text-orange-700', archived:'bg-red-100 text-red-700',
};

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>;
}

// ── Layers ────────────────────────────────────────────────────────────────────
function LayersTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [lt, setLt] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['ont-layers', search, lt],
    queryFn: async () => {
      const p = new URLSearchParams({ search, ...(lt !== 'all' && { layer_type: lt }) });
      const r = await apiFetch(`/api/ontology/layers?${p}`);
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async (body: any) => {
      const r = body.id
        ? await apiFetch(`/api/ontology/layers/${body.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/api/ontology/layers', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ont-layers'] }); setForm(null); },
  });

  const archive = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/ontology/layers/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ont-layers'] }),
  });

  const items: any[] = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search layers…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={lt} onChange={e => setLt(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All types</option>
          {LAYER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setForm({})}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Layer
        </button>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Clusters</th>
              <th className="px-4 py-3 text-left">Weight</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{row.layer_type}</td>
                  <td className="px-4 py-3 text-gray-600">{row.cluster_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{row.scoring_weight}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setForm(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archive.mutate(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Archive className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No layers yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">{form.id ? 'Edit Layer' : 'New Layer'}</h3>
            {!form.id && <div>
              <label className="text-xs font-medium text-gray-500">Code *</label>
              <input value={form.code||''} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="LAYER_FOUNDATION" />
            </div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Name *</label>
              <input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea value={form.description||''} onChange={e => setForm({...form, description: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Layer Type</label>
                <select value={form.layer_type||'proficiency'} onChange={e => setForm({...form, layer_type: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {LAYER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Scoring Weight</label>
                <input type="number" step="0.001" value={form.scoring_weight||1}
                  onChange={e => setForm({...form, scoring_weight: parseFloat(e.target.value)})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select value={form.status||'draft'} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['draft','in_review','approved','published','deprecated','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Sort Order</label>
                <input type="number" value={form.sort_order||0}
                  onChange={e => setForm({...form, sort_order: parseInt(e.target.value)})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
            </div>
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

// ── Competency Clusters ────────────────────────────────────────────────────────
function ClustersTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [search, setSearch] = useState('');

  const { data: layerData } = useQuery({ queryKey: ['ont-layers-all'], queryFn: () => apiFetch('/api/ontology/layers?limit=200').then(r => r.json()) });
  const layers: any[] = layerData?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['ont-clusters', search],
    queryFn: async () => {
      const p = new URLSearchParams({ search });
      return apiFetch(`/api/ontology/clusters?${p}`).then(r => r.json());
    },
  });

  const save = useMutation({
    mutationFn: async (body: any) => {
      const r = body.id
        ? await apiFetch(`/api/ontology/clusters/${body.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/api/ontology/clusters', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ont-clusters'] }); setForm(null); },
  });

  const archive = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/ontology/clusters/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ont-clusters'] }),
  });

  const items: any[] = data?.items ?? [];
  const CATEGORIES = ['technical','behavioral','leadership','domain','cross_functional','cognitive','threshold'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clusters…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={() => setForm({})}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Cluster
        </button>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Layer</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Competencies</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.layer_name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-600 text-xs">{row.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.competency_count ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setForm(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archive.mutate(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Archive className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No clusters yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">{form.id ? 'Edit Cluster' : 'New Cluster'}</h3>
            {!form.id && <div>
              <label className="text-xs font-medium text-gray-500">Code *</label>
              <input value={form.code||''} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="CLUS_COMM_INFLUENCE" />
            </div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Name *</label>
              <input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea value={form.description||''} onChange={e => setForm({...form, description: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Layer</label>
                <select value={form.layer_id||''} onChange={e => setForm({...form, layer_id: e.target.value||null})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  <option value="">— None —</option>
                  {layers.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Category</label>
                <select value={form.category||''} onChange={e => setForm({...form, category: e.target.value||null})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  <option value="">— None —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select value={form.status||'draft'} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['draft','in_review','approved','published','deprecated','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Default Weight</label>
                <input type="number" step="0.001" value={form.weight_default||1}
                  onChange={e => setForm({...form, weight_default: parseFloat(e.target.value)})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
            </div>
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

// ── Competencies ──────────────────────────────────────────────────────────────
function CompetenciesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: clusterData } = useQuery({ queryKey: ['ont-clusters-all'], queryFn: () => apiFetch('/api/ontology/clusters?limit=500').then(r => r.json()) });
  const clusters: any[] = clusterData?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['ont-competencies', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ search, page: String(page), limit: '50' });
      return apiFetch(`/api/ontology/competencies?${p}`).then(r => r.json());
    },
  });

  const save = useMutation({
    mutationFn: async (body: any) => {
      const r = body.id
        ? await apiFetch(`/api/ontology/competencies/${body.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/api/ontology/competencies', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ont-competencies'] }); setForm(null); },
  });

  const archive = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/api/ontology/competencies/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ont-competencies'] }),
    onError: (e: any) => alert(e.message),
  });

  const items: any[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search competencies…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <span className="text-sm text-gray-500">{total} total</span>
        <button onClick={() => setForm({})}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Competency
        </button>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Cluster</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Micros</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.cluster_name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-600 text-xs">{row.competency_type}</td>
                  <td className="px-4 py-3 text-gray-600">{row.micro_count ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setForm(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archive.mutate(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Archive className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No competencies yet</td></tr>}
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
            <h3 className="font-semibold text-lg">{form.id ? 'Edit Competency' : 'New Competency'}</h3>
            {!form.id && <div>
              <label className="text-xs font-medium text-gray-500">Code *</label>
              <input value={form.code||''} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="COMP_WRITTEN_COMMS" />
            </div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Name *</label>
              <input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea value={form.description||''} onChange={e => setForm({...form, description: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Cluster</label>
                <select value={form.cluster_id||''} onChange={e => setForm({...form, cluster_id: e.target.value||null})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  <option value="">— None —</option>
                  {clusters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Type</label>
                <select value={form.competency_type||'core'} onChange={e => setForm({...form, competency_type: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {COMPETENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Development Guide</label>
              <textarea value={form.development_guide||''} onChange={e => setForm({...form, development_guide: e.target.value})}
                rows={3} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="How to develop this competency…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select value={form.status||'draft'} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['draft','in_review','approved','published','deprecated','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">External Ref</label>
                <input value={form.external_ref||''} onChange={e => setForm({...form, external_ref: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="SFIA / O*NET code" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.is_threshold} onChange={e => setForm({...form, is_threshold: e.target.checked})} />
                Threshold (mandatory entry)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_measurable !== false} onChange={e => setForm({...form, is_measurable: e.target.checked})} />
                Measurable
              </label>
            </div>
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

// ── Micro Competencies ─────────────────────────────────────────────────────────
function MicrosTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: compData } = useQuery({ queryKey: ['ont-comp-all'], queryFn: () => apiFetch('/api/ontology/competencies?limit=500').then(r => r.json()) });
  const comps: any[] = compData?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['ont-micros', search, compFilter, page],
    queryFn: async () => {
      const p = new URLSearchParams({ search, page: String(page), limit: '50', ...(compFilter && { competency_id: compFilter }) });
      return apiFetch(`/api/ontology/micro-competencies?${p}`).then(r => r.json());
    },
  });

  const save = useMutation({
    mutationFn: async (body: any) => {
      const r = body.id
        ? await apiFetch(`/api/ontology/micro-competencies/${body.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/api/ontology/micro-competencies', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ont-micros'] }); setForm(null); },
  });

  const archive = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/ontology/micro-competencies/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ont-micros'] }),
  });

  const items: any[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search micro competencies…"
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={compFilter} onChange={e => { setCompFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All competencies</option>
          {comps.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setForm({})}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Micro
        </button>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Competency</th>
              <th className="px-4 py-3 text-left">Proficiency</th>
              <th className="px-4 py-3 text-left w-48">Observable Behaviour</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.competency_name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-gray-600 text-xs">{row.proficiency_level ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate" title={row.observable_behavior}>{row.observable_behavior || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setForm(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archive.mutate(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Archive className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No micro competencies yet</td></tr>}
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
            <h3 className="font-semibold text-lg">{form.id ? 'Edit Micro Competency' : 'New Micro Competency'}</h3>
            {!form.id && <div>
              <label className="text-xs font-medium text-gray-500">Code *</label>
              <input value={form.code||''} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="MC_WRTCOMM_ADV_001" />
            </div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Name *</label>
              <input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Competency *</label>
                <select value={form.competency_id||''} onChange={e => setForm({...form, competency_id: parseInt(e.target.value)||null})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  <option value="">— Select —</option>
                  {comps.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Proficiency Level</label>
                <select value={form.proficiency_level||''} onChange={e => setForm({...form, proficiency_level: e.target.value||null})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  <option value="">— None —</option>
                  {PROFICIENCY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Observable Behaviour (when PRESENT) *</label>
              <textarea value={form.observable_behavior||''} onChange={e => setForm({...form, observable_behavior: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="What you observe when this micro competency is present…" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Absence Indicator (when ABSENT)</label>
              <textarea value={form.absence_indicator||''} onChange={e => setForm({...form, absence_indicator: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="What you observe when this micro competency is absent…" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Development Focus</label>
              <textarea value={form.development_focus||''} onChange={e => setForm({...form, development_focus: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="How to develop this micro competency…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select value={form.status||'draft'} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['draft','in_review','approved','published','deprecated','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">IRT Difficulty (b)</label>
                <input type="number" step="0.01" value={form.irt_b||''} onChange={e => setForm({...form, irt_b: e.target.value||null})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="e.g. 0.5" />
              </div>
            </div>
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

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const { data } = useQuery({
    queryKey: ['competency-core-stats'],
    queryFn: () => apiFetch('/api/ontology/competency-core/stats').then(r => r.json()),
    refetchInterval: 30000,
  });
  const s = data?.stats;
  if (!s) return null;
  const items = [
    { label: 'Layers', value: s.layers_total, pub: s.layers_published, color: 'text-purple-700 bg-purple-50' },
    { label: 'Clusters', value: s.clusters_total, pub: s.clusters_published, color: 'text-blue-700 bg-blue-50' },
    { label: 'Competencies', value: s.competencies_total, pub: s.competencies_published, color: 'text-green-700 bg-green-50' },
    { label: 'Micro Competencies', value: s.micros_total, pub: s.micros_published, color: 'text-orange-700 bg-orange-50' },
    { label: 'Role Links', value: s.role_comp_links, pub: null, color: 'text-gray-700 bg-gray-50' },
  ];
  return (
    <div className="flex gap-3 flex-wrap mb-4">
      {items.map(i => (
        <div key={i.label} className={`px-4 py-2 rounded-xl ${i.color} text-xs`}>
          <div className="font-bold text-base">{i.value}</div>
          <div className="opacity-70">{i.label}{i.pub !== null ? ` · ${i.pub} published` : ''}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'layers',        label: 'Layers',              icon: Network },
  { id: 'clusters',      label: 'Competency Clusters', icon: PieChart },
  { id: 'competencies',  label: 'Competencies',        icon: TrendingUp },
  { id: 'micros',        label: 'Micro Competencies',  icon: Brain },
];

const NAV_TO_TAB: Record<string, Tab> = {
  'ont-layers': 'layers', 'ont-clusters': 'clusters',
  'ont-competencies': 'competencies', 'ont-micro-competencies': 'micros',
};

export default function CompetencyCorePanel({ initialTab }: { initialTab?: string }) {
  const startTab = (initialTab && NAV_TO_TAB[initialTab]) ?? 'layers';
  const [tab, setTab] = useState<Tab>(startTab);

  React.useEffect(() => {
    if (initialTab && NAV_TO_TAB[initialTab]) setTab(NAV_TO_TAB[initialTab]);
  }, [initialTab]);

  return (
    <div className="h-full flex flex-col gap-0">
      <div className="px-6 pt-6 pb-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Competency Framework Core</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage Layers, Clusters, Competencies, and Micro Competencies — the core 4-level framework structure.
          </p>
        </div>
        <StatsBar />
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
        {tab === 'layers'       && <LayersTab />}
        {tab === 'clusters'     && <ClustersTab />}
        {tab === 'competencies' && <CompetenciesTab />}
        {tab === 'micros'       && <MicrosTab />}
      </div>
    </div>
  );
}
