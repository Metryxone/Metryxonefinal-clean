import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Search, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

interface AuditRow {
  id:           number;
  actor_id:     string;
  actor_email:  string | null;
  actor_role:   string;
  action:       string;
  entity_type:  string;
  entity_id:    string | null;
  entity_label: string | null;
  before_state: unknown;
  after_state:  unknown;
  metadata:     unknown;
  ip_address:   string | null;
  created_at:   string;
}

const ACTION_COLORS: Record<string, string> = {
  create:        'bg-green-100 text-green-700',
  update:        'bg-blue-100 text-blue-700',
  archive:       'bg-orange-100 text-orange-700',
  delete:        'bg-red-100 text-red-700',
  import:        'bg-purple-100 text-purple-700',
  export:        'bg-indigo-100 text-indigo-700',
  submit_review: 'bg-yellow-100 text-yellow-700',
  approve:       'bg-emerald-100 text-emerald-700',
  reject:        'bg-rose-100 text-rose-700',
};

function SnapshotDiff({ before, after }: { before: unknown; after: unknown }) {
  const [open, setOpen] = useState(false);
  if (!before && !after) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {open ? 'Hide snapshot' : 'View snapshot diff'}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {before != null && (
            <div>
              <div className="font-semibold text-slate-500 mb-1">Before</div>
              <pre className="bg-red-50 border border-red-100 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
          )}
          {after != null && (
            <div>
              <div className="font-semibold text-slate-500 mb-1">After</div>
              <pre className="bg-green-50 border border-green-100 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                {JSON.stringify(after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlatformAuditLogPanel() {
  const [entityType, setEntityType] = useState('');
  const [action,     setAction]     = useState('');
  const [actor,      setActor]      = useState('');
  const [search,     setSearch]     = useState('');
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [offset,     setOffset]     = useState(0);
  const LIMIT = 50;

  const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
  if (entityType) params.set('entity_type', entityType);
  if (action)     params.set('action', action);
  if (actor)      params.set('actor', actor);
  if (search)     params.set('search', search);
  if (from)       params.set('from', from);
  if (to)         params.set('to', to);

  const { data, isLoading, refetch } = useQuery<{
    rows: AuditRow[];
    total: number;
    entity_types: { entity_type: string; count: number }[];
  }>({
    queryKey: ['platform-audit', entityType, action, actor, search, from, to, offset],
    queryFn: () => fetch(`/api/admin/platform-audit?${params}`).then(r => r.json()),
    staleTime: 30_000,
  });

  const rows         = data?.rows ?? [];
  const total        = data?.total ?? 0;
  const entityTypes  = data?.entity_types ?? [];

  function applyFilter() { setOffset(0); refetch(); }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Platform Audit Log</h2>
          <span className="text-xs text-slate-400">{total.toLocaleString()} total entries</span>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Entity type quick-filter pills */}
      {entityTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setEntityType(''); setOffset(0); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              !entityType ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            All
          </button>
          {entityTypes.map(et => (
            <button
              key={et.entity_type}
              onClick={() => { setEntityType(et.entity_type); setOffset(0); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                entityType === et.entity_type
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {et.entity_type} <span className="opacity-60">({et.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            placeholder="Search label / id / action…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilter()}
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setOffset(0); }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
        >
          <option value="">All actions</option>
          {['create','update','archive','delete','import','export','submit_review','approve','reject'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          placeholder="From date"
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="To date"
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading audit log…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          No audit entries yet. Admin mutations will appear here automatically.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Time','Actor','Action','Module','Entity','IP'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 group">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-mono">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-700">{row.actor_email ?? row.actor_id}</div>
                    <div className="text-slate-400">{row.actor_role}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[row.action] ?? 'bg-slate-100 text-slate-600'}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 font-medium">{row.entity_type}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-700">{row.entity_label ?? '—'}</div>
                    {row.entity_id && <div className="text-slate-400 font-mono">#{row.entity_id}</div>}
                    <SnapshotDiff before={row.before_state} after={row.after_state} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">{row.ip_address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset(o => o + LIMIT)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
