import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users2, Plus, Pencil, Archive, Search, RefreshCw, X } from 'lucide-react';
import SubmitForReviewButton from './SubmitForReviewButton';

interface RoleFamily {
  id:          number;
  code:        string;
  name:        string;
  description: string | null;
  career_track_archetype: string | null;
  is_active:   boolean;
  status:      string;
  sort_order:  number;
  created_at:  string;
  updated_at:  string;
}

interface FormState {
  code:        string;
  name:        string;
  description: string;
  career_track_archetype: string;
  sort_order:  string;
  status:      string;
}

const BLANK: FormState = {
  code: '', name: '', description: '', career_track_archetype: 'ic', sort_order: '0', status: 'draft',
};

const ARCHETYPE_OPTIONS = ['ic', 'management', 'specialist', 'executive', 'operational'] as const;
const STATUS_OPTIONS    = ['draft', 'in_review', 'approved', 'published', 'deprecated', 'archived'] as const;

const STATUS_BADGE: Record<string, string> = {
  draft:      'bg-slate-100 text-slate-600',
  in_review:  'bg-yellow-100 text-yellow-700',
  approved:   'bg-blue-100 text-blue-700',
  published:  'bg-emerald-100 text-emerald-700',
  deprecated: 'bg-orange-100 text-orange-700',
  archived:   'bg-red-100 text-red-700',
};

function RoleFamilyForm({
  initial,
  onSave,
  onCancel,
  isLoading,
}: {
  initial: FormState;
  onSave:  (f: FormState) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
          <input
            value={f.code}
            onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, ''))}
            placeholder="RF-SWE"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
          <input
            value={f.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Software Engineer Family"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea
          value={f.description}
          onChange={e => set('description', e.target.value)}
          rows={2}
          placeholder="IC engineering roles across product, platform and infrastructure"
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Career Track Archetype</label>
          <select
            value={f.career_track_archetype}
            onChange={e => set('career_track_archetype', e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {ARCHETYPE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={f.status}
            onChange={e => set('status', e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sort Order</label>
          <input
            type="number"
            value={f.sort_order}
            onChange={e => set('sort_order', e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(f)}
          disabled={!f.code.trim() || !f.name.trim() || isLoading}
          className="px-4 py-2 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium disabled:opacity-50"
        >
          {isLoading ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function RoleFamiliesPanel() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('all');
  const [editing, setEditing] = useState<RoleFamily | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [formErr, setFormErr] = useState('');

  const { data, isLoading, refetch } = useQuery<{ items: RoleFamily[]; total: number }>({
    queryKey: ['role-families', search, status],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status !== 'all') p.set('status', status);
      return fetch(`/api/ontology/role-families?${p}`).then(r => r.json());
    },
    staleTime: 30_000,
  });

  const items = data?.items ?? [];

  const createMut = useMutation({
    mutationFn: async (f: FormState) => {
      const res = await fetch('/api/ontology/role-families', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          code:        f.code,
          name:        f.name,
          description: f.description || null,
          career_track_archetype: f.career_track_archetype || null,
          sort_order:  parseInt(f.sort_order) || 0,
          status:      f.status,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['role-families'] }); setAdding(false); setFormErr(''); },
    onError: (e: Error) => setFormErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, f }: { id: number; f: FormState }) => {
      const res = await fetch(`/api/ontology/role-families/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        f.name,
          description: f.description || null,
          career_track_archetype: f.career_track_archetype || null,
          sort_order:  parseInt(f.sort_order) || 0,
          status:      f.status,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['role-families'] }); setEditing(null); setFormErr(''); },
    onError: (e: Error) => setFormErr(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ontology/role-families/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['role-families'] }),
  });

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Role Families</h2>
          <span className="text-xs text-slate-400">{data?.total ?? 0} total</span>
        </div>
        <div className="flex gap-2">
          <SubmitForReviewButton entityType="role-family" entityId="module" entityLabel="Role Families" />
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {!adding && (
            <button
              onClick={() => { setAdding(true); setEditing(null); setFormErr(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700"
            >
              <Plus className="w-3.5 h-3.5" /> Add Role Family
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-700">New Role Family</span>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          {formErr && <p className="text-xs text-red-500 mb-2">{formErr}</p>}
          <RoleFamilyForm
            initial={BLANK}
            onSave={f => createMut.mutate(f)}
            onCancel={() => { setAdding(false); setFormErr(''); }}
            isLoading={createMut.isPending}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            placeholder="Search code or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          No role families yet. Use the button above to add one, or import via Import/Export.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Code', 'Name', 'Archetype', 'Status', 'Sort', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 group">
                  {editing?.id === item.id ? (
                    <td colSpan={6} className="px-4 py-3">
                      {formErr && <p className="text-xs text-red-500 mb-2">{formErr}</p>}
                      <RoleFamilyForm
                        initial={{
                          code:        item.code,
                          name:        item.name,
                          description: item.description ?? '',
                          career_track_archetype: item.career_track_archetype ?? 'ic',
                          sort_order:  String(item.sort_order),
                          status:      item.status,
                        }}
                        onSave={f => updateMut.mutate({ id: item.id, f })}
                        onCancel={() => { setEditing(null); setFormErr(''); }}
                        isLoading={updateMut.isPending}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{item.code}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {item.name}
                        {item.description && (
                          <div className="text-slate-400 font-normal truncate max-w-xs">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{item.career_track_archetype ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{item.sort_order}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditing(item); setAdding(false); setFormErr(''); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Archive "${item.name}"?`)) archiveMut.mutate(item.id); }}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
