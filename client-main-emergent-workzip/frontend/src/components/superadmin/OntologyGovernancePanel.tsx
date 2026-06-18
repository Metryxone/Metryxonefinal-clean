import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, History, GitBranch, Calendar, Plus, Edit2, RefreshCw, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

type Tab = 'ref' | 'versions' | 'lifecycle' | 'reviews';

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
}

function StatCard({ label, value, sub, color = 'text-indigo-700 bg-indigo-50' }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className={`px-5 py-4 rounded-xl ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Reference Data ─────────────────────────────────────────────────────────────
function RefDataTab() {
  const [active, setActive] = useState<'seniority' | 'proficiency' | 'categories' | 'assessment_types' | 'transitions'>('seniority');

  const queries: Record<string, string> = {
    seniority: '/api/ontology/ref/seniority-levels',
    proficiency: '/api/ontology/ref/proficiency-levels',
    categories: '/api/ontology/ref/competency-categories',
    assessment_types: '/api/ontology/ref/assessment-types',
    transitions: '/api/ontology/ref/lifecycle-transitions',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ref', active],
    queryFn: () => apiFetch(queries[active]).then(r => r.json()),
  });
  const items: any[] = data?.items ?? [];

  const refTabs = [
    { id: 'seniority', label: 'Seniority Levels' },
    { id: 'proficiency', label: 'Proficiency Levels' },
    { id: 'categories', label: 'Competency Categories' },
    { id: 'assessment_types', label: 'Assessment Types' },
    { id: 'transitions', label: 'Lifecycle Transitions' },
  ];

  const renderRow = (row: any) => {
    if (active === 'seniority') return (
      <tr key={row.code} className="hover:bg-gray-50">
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
        <td className="px-4 py-3 font-medium">{row.label}</td>
        <td className="px-4 py-3 text-center text-gray-600">{row.level_order}</td>
        <td className="px-4 py-3 text-center">{row.is_leadership ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
      </tr>
    );
    if (active === 'proficiency') return (
      <tr key={row.code} className="hover:bg-gray-50">
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
        <td className="px-4 py-3 font-medium">{row.label}</td>
        <td className="px-4 py-3 text-center text-gray-600">{row.level_order}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{row.score_band_min}–{row.score_band_max}</td>
        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.description}</td>
      </tr>
    );
    if (active === 'categories') return (
      <tr key={row.code} className="hover:bg-gray-50">
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
        <td className="px-4 py-3 font-medium">{row.label}</td>
        <td className="px-4 py-3">
          {row.color_hex && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: row.color_hex }} />{row.color_hex}</span>}
        </td>
        <td className="px-4 py-3 text-center text-gray-600">{row.sort_order}</td>
      </tr>
    );
    if (active === 'assessment_types') return (
      <tr key={row.code} className="hover:bg-gray-50">
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.code}</td>
        <td className="px-4 py-3 font-medium">{row.label}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{row.default_format}</td>
        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.description}</td>
      </tr>
    );
    if (active === 'transitions') return (
      <tr key={row.id} className="hover:bg-gray-50">
        <td className="px-4 py-3 text-xs text-gray-600">{row.entity_type}</td>
        <td className="px-4 py-3">
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">{row.from_status}</span>
          <span className="mx-2 text-gray-400">→</span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-mono">{row.to_status}</span>
        </td>
        <td className="px-4 py-3 text-center">{row.requires_approval ? <CheckCircle className="w-4 h-4 text-orange-500 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
      </tr>
    );
    return null;
  };

  const headers: Record<string, string[]> = {
    seniority: ['Code', 'Label', 'Order', 'Leadership'],
    proficiency: ['Code', 'Label', 'Order', 'Score Band', 'Description'],
    categories: ['Code', 'Label', 'Color', 'Sort'],
    assessment_types: ['Code', 'Label', 'Default Format', 'Description'],
    transitions: ['Entity Type', 'Transition', 'Needs Approval'],
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
        Reference data is seeded at startup and is read-only from the admin UI.
        To add/modify entries, update the seed in <code className="bg-blue-100 px-1 rounded font-mono text-xs">backend/routes/ontology-governance.ts</code>.
      </div>
      <div className="flex gap-2 flex-wrap">
        {refTabs.map(t => (
          <button key={t.id} onClick={() => setActive(t.id as typeof active)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              {headers[active].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(row => renderRow(row))}
              {!items.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Version History ────────────────────────────────────────────────────────────
function VersionsTab() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['ont-versions', search, entityType, page],
    queryFn: async () => {
      const p = new URLSearchParams({ search, page: String(page), limit: '50', ...(entityType && { entity_type: entityType }) });
      return apiFetch(`/api/ontology/versions?${p}`).then(r => r.json());
    },
  });

  const { data: changesData, isLoading: changesLoading } = useQuery({
    queryKey: ['ont-changes', search, entityType, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '50', ...(entityType && { entity_type: entityType }) });
      return apiFetch(`/api/ontology/changes?${p}`).then(r => r.json());
    },
  });

  const [view, setView] = useState<'snapshots' | 'changes'>('changes');
  const snapshots: any[] = data?.items ?? [];
  const changes: any[] = changesData?.items ?? [];

  const ENTITY_TYPES = [
    'ont_layers','ont_competency_clusters','ont_competencies','ont_micro_competencies',
    'ont_concerns','ont_assessment_questions','ont_indicators','ont_benchmarks',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['changes','snapshots'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${view === v ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {v}
            </button>
          ))}
        </div>
        <select value={entityType} onChange={e => setEntityType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All entity types</option>
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or label…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {view === 'changes' ? (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Field</th>
              <th className="px-4 py-3 text-left">Old</th>
              <th className="px-4 py-3 text-left">New</th>
              <th className="px-4 py-3 text-left">Changed By</th>
              <th className="px-4 py-3 text-left">When</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {changes.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono text-gray-600">{row.entity_type}</div>
                    <div className="font-medium text-xs">{row.entity_code ?? `#${row.entity_id}`}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700">{row.field_name}</td>
                  <td className="px-4 py-3 text-xs text-red-600 max-w-[120px] truncate" title={row.old_value}>{row.old_value ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-green-700 max-w-[120px] truncate" title={row.new_value}>{row.new_value ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.changed_by}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(row.changed_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {!changes.length && !changesLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No changes recorded yet</td></tr>}
              {changesLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Label</th>
              <th className="px-4 py-3 text-left">Version</th>
              <th className="px-4 py-3 text-left">Triggered By</th>
              <th className="px-4 py-3 text-left">When</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{row.entity_type}</td>
                  <td className="px-4 py-3 text-xs font-mono text-indigo-600">{row.entity_code ?? `#${row.entity_id}`}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{row.entity_label ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">v{row.version}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.triggered_by}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(row.snapshot_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {!snapshots.length && !isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No snapshots recorded yet</td></tr>}
              {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Lifecycle Events ──────────────────────────────────────────────────────────
function LifecycleTab() {
  const [entityType, setEntityType] = useState('');
  const [toStatus, setToStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['lfc-events', entityType, toStatus, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '50', ...(entityType && { entity_type: entityType }), ...(toStatus && { to_status: toStatus }) });
      return apiFetch(`/api/ontology/lifecycle?${p}`).then(r => r.json());
    },
  });

  const STATUSES = ['draft','in_review','approved','published','deprecated','archived'];
  const STATUS_COLORS: Record<string, string> = {
    draft:'bg-gray-100 text-gray-700', in_review:'bg-yellow-100 text-yellow-700',
    approved:'bg-blue-100 text-blue-700', published:'bg-green-100 text-green-700',
    deprecated:'bg-orange-100 text-orange-700', archived:'bg-red-100 text-red-700',
  };

  const items: any[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input value={entityType} onChange={e => setEntityType(e.target.value)} placeholder="Entity type filter…"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={toStatus} onChange={e => setToStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All transitions</option>
          {STATUSES.map(s => <option key={s} value={s}>→ {s}</option>)}
        </select>
        <span className="text-sm text-gray-500">{total} events</span>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Label</th>
              <th className="px-4 py-3 text-left">Transition</th>
              <th className="px-4 py-3 text-left">Triggered By</th>
              <th className="px-4 py-3 text-left">Note</th>
              <th className="px-4 py-3 text-left">When</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-xs font-mono text-gray-600">{row.entity_type}</div>
                    <div className="text-xs text-gray-500">{row.entity_code ?? `#${row.entity_id}`}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-[180px] truncate" title={row.entity_label}>{row.entity_label ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.from_status && (
                      <><span className={`px-2 py-0.5 rounded text-xs font-mono ${STATUS_COLORS[row.from_status] ?? 'bg-gray-100 text-gray-600'}`}>{row.from_status}</span>
                      <span className="mx-1 text-gray-400">→</span></>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${STATUS_COLORS[row.to_status] ?? 'bg-gray-100 text-gray-600'}`}>{row.to_status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.triggered_by}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate" title={row.trigger_note}>{row.trigger_note ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(row.occurred_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No lifecycle events yet</td></tr>}
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

// ── Reviews & Quality Gates ───────────────────────────────────────────────────
function ReviewsTab() {
  const qc = useQueryClient();
  const [view, setView] = useState<'schedules' | 'instances' | 'quality'>('schedules');
  const [qualityEntityType, setQualityEntityType] = useState('');
  const [ruleForm, setRuleForm] = useState<any>(null);

  const { data: statsData } = useQuery({
    queryKey: ['gov-stats'],
    queryFn: () => apiFetch('/api/ontology/governance/stats').then(r => r.json()),
    refetchInterval: 30000,
  });
  const s = statsData?.stats;

  const { data: schedulesData } = useQuery({
    queryKey: ['gov-schedules'],
    queryFn: () => apiFetch('/api/ontology/governance/schedules').then(r => r.json()),
    enabled: view === 'schedules',
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['gov-reviews'],
    queryFn: () => apiFetch('/api/ontology/governance/reviews?limit=50').then(r => r.json()),
    enabled: view === 'instances',
  });

  const { data: rulesData } = useQuery({
    queryKey: ['gov-quality-rules', qualityEntityType],
    queryFn: () => apiFetch(`/api/ontology/governance/quality-rules?entity_type=${qualityEntityType}`).then(r => r.json()),
    enabled: view === 'quality',
  });

  const saveRule = useMutation({
    mutationFn: async (body: any) => {
      const r = body.id
        ? await apiFetch(`/api/ontology/governance/quality-rules/${body.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/api/ontology/governance/quality-rules', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-quality-rules'] }); setRuleForm(null); },
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/ontology/governance/quality-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gov-quality-rules'] }),
  });

  const schedules: any[] = schedulesData?.items ?? [];
  const reviews: any[] = reviewsData?.items ?? [];
  const rules: any[] = rulesData?.items ?? [];

  const SEV_COLORS: Record<string, string> = {
    error: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-4">
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Snapshots" value={s.snapshots_total} color="text-indigo-700 bg-indigo-50" />
          <StatCard label="Change Events" value={s.changes_total} color="text-blue-700 bg-blue-50" />
          <StatCard label="Active Quality Rules" value={s.active_rules} color="text-green-700 bg-green-50" />
          <StatCard label="Overdue Reviews" value={s.overdue_reviews}
            color={s.overdue_reviews > 0 ? 'text-red-700 bg-red-50' : 'text-gray-700 bg-gray-50'} />
        </div>
      )}

      {statsData?.overdue?.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" /> Overdue Reviews
          </div>
          <div className="space-y-1">
            {statsData.overdue.map((r: any) => (
              <div key={r.entity_type} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{r.entity_type}</span>
                <span className="text-orange-600 text-xs">{r.owner_role}</span>
                <span className="text-red-600 text-xs font-medium">{r.next_review_due}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['schedules','instances','quality'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${view === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {v === 'schedules' ? 'Review Schedules' : v === 'instances' ? 'Review History' : 'Quality Gate Rules'}
          </button>
        ))}
      </div>

      {view === 'schedules' && (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Entity Type</th>
              <th className="px-4 py-3 text-left">Frequency</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-left">Last Reviewed</th>
              <th className="px-4 py-3 text-left">Next Due</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.entity_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.review_frequency_days}d</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.owner_role ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{row.last_reviewed_at ? new Date(row.last_reviewed_at).toLocaleDateString('en-IN') : 'Never'}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.next_review_due ? (
                      <span className={new Date(row.next_review_due) <= new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {row.next_review_due}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
              {!schedules.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No schedules</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'instances' && (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Reviewer</th>
              <th className="px-4 py-3 text-left">Outcome</th>
              <th className="px-4 py-3 text-left">Findings</th>
              <th className="px-4 py-3 text-left">When</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {reviews.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{row.entity_type}</td>
                  <td className="px-4 py-3 text-xs capitalize text-gray-500">{row.review_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.reviewer}</td>
                  <td className="px-4 py-3">
                    {row.outcome ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.outcome === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.outcome}</span>
                    ) : <span className="text-gray-300 text-xs">pending</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={row.findings}>{row.findings ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(row.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
              {!reviews.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No review history yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'quality' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input value={qualityEntityType} onChange={e => setQualityEntityType(e.target.value)}
              placeholder="Filter by entity type…"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => setRuleForm({})}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> New Rule
            </button>
          </div>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                <th className="px-4 py-3 text-left">Rule Code</th>
                <th className="px-4 py-3 text-left">Entity Type</th>
                <th className="px-4 py-3 text-left">Rule Name</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Check Type</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.rule_code}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.entity_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.rule_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLORS[row.severity] ?? 'bg-gray-100 text-gray-600'}`}>{row.severity}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.check_type}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setRuleForm(row)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteRule.mutate(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rules.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No quality rules</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ruleForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">{ruleForm.id ? 'Edit Rule' : 'New Quality Rule'}</h3>
            {!ruleForm.id && <div>
              <label className="text-xs font-medium text-gray-500">Rule Code *</label>
              <input value={ruleForm.rule_code||''} onChange={e => setRuleForm({...ruleForm, rule_code: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1 font-mono" placeholder="COMP_003" />
            </div>}
            <div>
              <label className="text-xs font-medium text-gray-500">Rule Name *</label>
              <input value={ruleForm.rule_name||''} onChange={e => setRuleForm({...ruleForm, rule_name: e.target.value})}
                className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Entity Type *</label>
                <input value={ruleForm.entity_type||''} onChange={e => setRuleForm({...ruleForm, entity_type: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1 font-mono" placeholder="ont_competencies" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Severity</label>
                <select value={ruleForm.severity||'warning'} onChange={e => setRuleForm({...ruleForm, severity: e.target.value})}
                  className="w-full border rounded px-3 py-2 text-sm mt-1">
                  {['info','warning','error'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <textarea value={ruleForm.description||''} onChange={e => setRuleForm({...ruleForm, description: e.target.value})}
                rows={2} className="w-full border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setRuleForm(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveRule.mutate(ruleForm)} disabled={saveRule.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saveRule.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {saveRule.error && <p className="text-red-600 text-xs">{String(saveRule.error)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ref',       label: 'Reference Data',     icon: ShieldCheck },
  { id: 'versions',  label: 'Change History',     icon: History },
  { id: 'lifecycle', label: 'Lifecycle Events',   icon: GitBranch },
  { id: 'reviews',   label: 'Reviews & Quality',  icon: Calendar },
];

export default function OntologyGovernancePanel() {
  const [tab, setTab] = useState<Tab>('reviews');
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Ontology Governance</h2>
          <p className="text-sm text-gray-500 mt-1">
            Reference tables, version snapshots, lifecycle transitions, review schedules, and quality gate rules.
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
        {tab === 'ref'       && <RefDataTab />}
        {tab === 'versions'  && <VersionsTab />}
        {tab === 'lifecycle' && <LifecycleTab />}
        {tab === 'reviews'   && <ReviewsTab />}
      </div>
    </div>
  );
}
