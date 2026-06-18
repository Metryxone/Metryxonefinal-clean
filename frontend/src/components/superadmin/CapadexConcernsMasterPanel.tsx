import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type ConcernRow = {
  id: number;
  concern_id: string;
  domain: string;
  concern_cluster: string;
  display_label: string | null;
  concern_search: string | null;
  relevance_in_india: string | null;
  parent_anxiety_level: string | null;
  growth_trend: string | null;
  severity: string | null;
  capadex_priority: string | null;
  common_indian_context: string | null;
  primary_persona: string | null;
  contextual_modifier: string | null;
  concern_category: string | null;
  intelligence_layer: string | null;
  signal_cluster: string | null;
  assessment_dimension: string;
  root_cause_group: string;
  intervention_lens: string;
  capability_mapping: string;
  relational_bridge_tag: string;
  age_min: number | null;
  age_max: number | null;
  source_row_index: number | null;
};

type ListResp = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  rows: ConcernRow[];
};

type Facets = {
  domains: string[];
  personas: string[];
  severities: string[];
  priorities: string[];
  bridges: string[];
};

type Stats = {
  total: number;
  distinct_ids: number;
  distinct_domains: number;
  distinct_bridges: number;
  missing_age: number;
  unassigned_dim: number;
  unassigned_rcg?: number;
  unassigned_lens?: number;
  unassigned_cap?: number;
  unassigned_any_routing?: number;
  topDomains:  Array<{ domain: string; n: number }>;
  byPersona:   Array<{ persona: string; n: number }>;
  bySeverity:  Array<{ severity: string; n: number }>;
  byPriority:  Array<{ priority: string; n: number }>;
  topBridges:  Array<{ bridge: string; n: number }>;
};

type ImportSummary = {
  mode: string;
  dryRun: boolean;
  parsed: number;
  phantomDropped: number;
  validRows: number;
  errors: Array<{ row: number; reason: string }>;
  errorCount: number;
  written: number;
  inserted?: number;
  updated?: number;
};

const PAGE_SIZE = 50;
const API_BASE = '/api/admin/capadex/concerns-master';

const FIELD_LABELS: Record<keyof Omit<ConcernRow, 'id'>, string> = {
  concern_id:            'Concern ID',
  domain:                'Domain',
  concern_cluster:       'Concern Cluster',
  display_label:         'Display Label (user-facing)',
  concern_search:        'Concern Search',
  relevance_in_india:    'Relevance in India',
  parent_anxiety_level:  'Parent Anxiety Level',
  growth_trend:          'Growth Trend',
  severity:              'Severity',
  capadex_priority:      'CAPADEX Priority',
  common_indian_context: 'Common Indian Context',
  primary_persona:       'Primary Persona',
  contextual_modifier:   'Contextual Modifier',
  concern_category:      'Concern Category',
  intelligence_layer:    'Intelligence Layer',
  signal_cluster:        'Signal Cluster',
  assessment_dimension:  'Assessment Dimension',
  root_cause_group:      'Root Cause Group',
  intervention_lens:     'Intervention Lens',
  capability_mapping:    'Capability Mapping',
  relational_bridge_tag: 'Relational Bridge Tag',
  age_min:               'Age Min',
  age_max:               'Age Max',
  source_row_index:      'Source Row #',
};
const REQUIRED_FIELDS = new Set<keyof ConcernRow>([
  'concern_id', 'domain', 'concern_cluster',
  'assessment_dimension', 'root_cause_group', 'intervention_lens',
  'capability_mapping', 'relational_bridge_tag',
]);
const ROUTING_SENTINEL = 'UNASSIGNED_ROUTING_NODE';

export default function CapadexConcernsMasterPanel() {
  const qc = useQueryClient();
  const [search, setSearch]     = useState('');
  const [domain, setDomain]     = useState('');
  const [persona, setPersona]   = useState('');
  const [severity, setSeverity] = useState('');
  const [priority, setPriority] = useState('');
  const [bridge, setBridge]     = useState('');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState<ConcernRow | null>(null);
  const [showEditor, setShowEditor] = useState<{ mode: 'create' | 'edit'; row: Partial<ConcernRow> } | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { setPage(1); }, [search, domain, persona, severity, priority, bridge]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search)   p.set('search', search);
    if (domain)   p.set('domain', domain);
    if (persona)  p.set('persona', persona);
    if (severity) p.set('severity', severity);
    if (priority) p.set('priority', priority);
    if (bridge)   p.set('bridge', bridge);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    return p.toString();
  }, [search, domain, persona, severity, priority, bridge, page]);

  const exportQs = useMemo(() => {
    const p = new URLSearchParams();
    if (search)   p.set('search', search);
    if (domain)   p.set('domain', domain);
    if (persona)  p.set('persona', persona);
    if (severity) p.set('severity', severity);
    if (priority) p.set('priority', priority);
    if (bridge)   p.set('bridge', bridge);
    return p.toString();
  }, [search, domain, persona, severity, priority, bridge]);

  const facetsQ = useQuery<Facets>({
    queryKey: [`${API_BASE}/facets`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/facets`, { credentials: 'include' });
      if (!res.ok) throw new Error('facets load failed');
      return res.json();
    },
  });
  const statsQ = useQuery<Stats>({
    queryKey: [`${API_BASE}/stats`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('stats load failed');
      return res.json();
    },
  });
  const listQ = useQuery<ListResp>({
    queryKey: [API_BASE, qs],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}?${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error('list load failed');
      return res.json();
    },
  });

  const stats = statsQ.data;
  const facets = facetsQ.data;
  const data = listQ.data;
  const loadError = listQ.isError || statsQ.isError || facetsQ.isError;

  function refreshAll() {
    qc.invalidateQueries({ queryKey: [API_BASE] });
    qc.invalidateQueries({ queryKey: [`${API_BASE}/stats`] });
    qc.invalidateQueries({ queryKey: [`${API_BASE}/facets`] });
  }

  async function handleDelete(row: ConcernRow) {
    if (!confirm(`Delete concern "${row.concern_id}"? This cannot be undone.`)) return;
    const res = await fetch(`${API_BASE}/${row.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { alert(`Delete failed: ${await res.text()}`); return; }
    setSelected(null);
    refreshAll();
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-auto" data-testid="panel-capadex-concerns-master">
      <header className="space-y-1 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">CAPADEX Concerns Master</h1>
          <p className="text-sm text-slate-600">
            Audited behavioural-intelligence concerns catalogue —{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">capadex_concerns_master</code>.
            Manage rows directly, or import/export the catalogue as CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEditor({ mode: 'create', row: { assessment_dimension: ROUTING_SENTINEL, root_cause_group: ROUTING_SENTINEL, intervention_lens: ROUTING_SENTINEL, capability_mapping: ROUTING_SENTINEL } })}
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            data-testid="button-new-concern"
          >+ New concern</button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50"
            data-testid="button-import-concerns"
          >Import CSV</button>
          <a
            href={`${API_BASE}/export.csv${exportQs ? `?${exportQs}` : ''}`}
            className="px-3 py-2 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50"
            data-testid="link-export-concerns"
          >Export CSV</a>
          <button
            onClick={refreshAll}
            className="px-3 py-2 text-sm rounded border border-slate-300 bg-white hover:bg-slate-50"
            data-testid="button-refresh-concerns"
          >Refresh</button>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="concerns-master-error"
        >
          <strong className="font-semibold">Could not load concerns catalogue.</strong>{' '}
          {String(listQ.error ?? statsQ.error ?? facetsQ.error ?? 'Unknown error')}.{' '}
          The endpoint is auth-gated — confirm you are signed in as a super-admin and that{' '}
          <code className="bg-red-100 px-1 rounded">capadex_concerns_master</code> has been seeded
          (<code className="bg-red-100 px-1 rounded">node backend/scripts/seed-capadex-concerns-master.mjs</code>).
        </div>
      )}

      {/* Stat strip */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {([
          ['Total rows',        stats?.total],
          ['Distinct IDs',      stats?.distinct_ids],
          ['Distinct domains',  stats?.distinct_domains],
          ['Bridge buckets',    stats?.distinct_bridges],
          ['Missing age',       stats?.missing_age],
          ['Unassigned routing', stats?.unassigned_any_routing ?? stats?.unassigned_dim],
        ] as Array<[string, number | undefined]>).map(([label, n]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-xl font-semibold text-slate-900">{n?.toLocaleString() ?? '—'}</div>
          </div>
        ))}
      </section>

      {/* Filters */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search id / domain / cluster / context …"
            aria-label="Search concerns"
            className="md:col-span-2 border border-slate-300 rounded px-3 py-2 text-sm"
            data-testid="input-concerns-search"
          />
          <FacetSelect label="Domain"   value={domain}   onChange={setDomain}   options={facets?.domains} />
          <FacetSelect label="Persona"  value={persona}  onChange={setPersona}  options={facets?.personas} />
          <FacetSelect label="Severity" value={severity} onChange={setSeverity} options={facets?.severities} />
          <FacetSelect label="Priority" value={priority} onChange={setPriority} options={facets?.priorities} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FacetSelect label="Bridge tag" value={bridge} onChange={setBridge} options={facets?.bridges} />
          <div className="md:col-span-2 flex items-center justify-end text-xs text-slate-500">
            {listQ.isLoading && 'Loading …'}
            {data && <>Showing <b className="text-slate-700">{data.rows.length}</b> of <b className="text-slate-700">{data.total.toLocaleString()}</b> rows · page <b>{data.page}</b>/<b>{data.pageCount}</b></>}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left">Concern ID</th>
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">Cluster</th>
                <th className="px-3 py-2 text-left">Persona</th>
                <th className="px-3 py-2 text-left">Severity</th>
                <th className="px-3 py-2 text-left">Priority</th>
                <th className="px-3 py-2 text-left">Bridge</th>
                <th className="px-3 py-2 text-left">Age</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[11px]">{row.concern_id}</td>
                  <td className="px-3 py-2 text-slate-800">{row.domain}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-md truncate" title={row.concern_cluster}>{row.concern_cluster}</td>
                  <td className="px-3 py-2 text-slate-600">{row.primary_persona ?? '—'}</td>
                  <td className="px-3 py-2"><SeverityChip value={row.severity} /></td>
                  <td className="px-3 py-2 text-slate-700">{row.capadex_priority ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-violet-700">{row.relational_bridge_tag}</td>
                  <td className="px-3 py-2 text-slate-600">{row.age_min != null && row.age_max != null ? `${row.age_min}–${row.age_max}` : '—'}</td>
                  <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                    <button onClick={() => setSelected(row)} className="text-xs text-blue-600 hover:underline" data-testid={`button-view-${row.id}`}>View</button>
                    <button onClick={() => setShowEditor({ mode: 'edit', row })} className="text-xs text-slate-600 hover:underline" data-testid={`button-edit-${row.id}`}>Edit</button>
                    <button onClick={() => handleDelete(row)} className="text-xs text-red-600 hover:underline" data-testid={`button-delete-${row.id}`}>Delete</button>
                  </td>
                </tr>
              ))}
              {!data?.rows.length && !listQ.isLoading && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400 text-sm">No concerns matched the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 rounded border border-slate-300 bg-white disabled:opacity-40">← Prev</button>
          <span className="text-slate-600 text-xs">Page {data?.page ?? 1} of {data?.pageCount ?? 1}</span>
          <button disabled={!data || page >= data.pageCount} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded border border-slate-300 bg-white disabled:opacity-40">Next →</button>
        </div>
      </section>

      {selected && (
        <DetailDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setShowEditor({ mode: 'edit', row: selected }); setSelected(null); }}
          onDelete={() => handleDelete(selected)}
        />
      )}

      {showEditor && (
        <EditorModal
          mode={showEditor.mode}
          initial={showEditor.row}
          onClose={() => setShowEditor(null)}
          onSaved={() => { setShowEditor(null); refreshAll(); }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); refreshAll(); }}
        />
      )}
    </div>
  );
}

function FacetSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options?: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={`Filter by ${label.toLowerCase()}`}
      className="border border-slate-300 rounded px-3 py-2 text-sm bg-white"
      data-testid={`select-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <option value="">{`All ${label.toLowerCase()}s`}</option>
      {(options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function SeverityChip({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const tone =
    /critical|severe|high/i.test(value) ? 'bg-red-100 text-red-700' :
    /medium|moderate/i.test(value)      ? 'bg-amber-100 text-amber-700' :
    /low|mild/i.test(value)             ? 'bg-emerald-100 text-emerald-700' :
                                          'bg-slate-100 text-slate-700';
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${tone}`}>{value}</span>;
}

function DetailDrawer({
  row, onClose, onEdit, onDelete,
}: { row: ConcernRow; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const fields = (Object.keys(FIELD_LABELS) as Array<keyof ConcernRow>).map(k => {
    const v = (row as any)[k];
    return [FIELD_LABELS[k as keyof typeof FIELD_LABELS], v] as [string, unknown];
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="concern-detail-heading">
      <aside className="w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="drawer-concern-detail">
        <header className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="text-xs font-mono text-slate-500">{row.concern_id}</div>
            <h2 id="concern-detail-heading" className="text-lg font-semibold text-slate-900">{row.domain}</h2>
            <p className="text-sm text-slate-600 mt-1">{row.concern_cluster}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Edit</button>
            <button onClick={onDelete} className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50">Delete</button>
            <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
          </div>
        </header>
        <dl className="px-5 py-4 space-y-3 text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-2">
              <dt className="text-slate-500 text-xs uppercase tracking-wide col-span-1">{k}</dt>
              <dd className="col-span-2 text-slate-800 whitespace-pre-wrap">{v == null || v === '' ? <span className="text-slate-400">—</span> : String(v)}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

function EditorModal({
  mode, initial, onClose, onSaved,
}: { mode: 'create' | 'edit'; initial: Partial<ConcernRow>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<ConcernRow>>(() => ({ ...initial }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setField(k: keyof ConcernRow, v: any) {
    setForm(prev => ({ ...prev, [k]: v === '' ? null : v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // client-side required check
    for (const f of REQUIRED_FIELDS) {
      const v = (form as any)[f];
      if (v == null || String(v).trim() === '') {
        setError(`${FIELD_LABELS[f as keyof typeof FIELD_LABELS]} is required`);
        return;
      }
    }
    setSaving(true);
    try {
      const url = mode === 'create' ? API_BASE : `${API_BASE}/${(initial as ConcernRow).id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const fields = Object.keys(FIELD_LABELS) as Array<keyof ConcernRow>;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="concern-editor-heading">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl h-full bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()} data-testid="modal-concern-editor">
        <header className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 id="concern-editor-heading" className="text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'New concern' : `Edit ${(initial as ConcernRow).concern_id ?? ''}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
          {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs">{error}</div>}
          {fields.map(f => {
            const required = REQUIRED_FIELDS.has(f);
            const isInt = f === 'age_min' || f === 'age_max' || f === 'source_row_index';
            const isLong = f === 'common_indian_context' || f === 'concern_cluster';
            return (
              <label key={f} className="block">
                <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                  {FIELD_LABELS[f as keyof typeof FIELD_LABELS]}{required && <span className="text-red-500"> *</span>}
                </span>
                {isLong ? (
                  <textarea
                    value={(form as any)[f] ?? ''}
                    onChange={e => setField(f, e.target.value)}
                    rows={2}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                    data-testid={`input-${f}`}
                  />
                ) : (
                  <input
                    type={isInt ? 'number' : 'text'}
                    value={(form as any)[f] ?? ''}
                    onChange={e => setField(f, isInt ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                    data-testid={`input-${f}`}
                  />
                )}
              </label>
            );
          })}
        </div>
        <footer className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" data-testid="button-save-concern">
            {saving ? 'Saving …' : mode === 'create' ? 'Create' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'append' | 'upsert' | 'replace'>('upsert');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(dryRun: boolean) {
    setError(null);
    const f = fileRef.current?.files?.[0];
    if (!f) { setError('Choose a CSV file first.'); return; }
    const fd = new FormData();
    fd.append('file', f);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/import?mode=${mode}${dryRun ? '&dryRun=1' : ''}`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      setSummary(body as ImportSummary);
      if (!dryRun) {
        onImported();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="concern-import-heading">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()} data-testid="modal-import-concerns">
        <header className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 id="concern-import-heading" className="text-lg font-semibold text-slate-900">Import CSV</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </header>
        <div className="px-5 py-4 space-y-4 text-sm">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="block w-full text-sm" data-testid="input-import-file" />
            <p className="text-xs text-slate-500 mt-1">
              Headers may use either "Concern ID" / "Domain" form OR snake_case (<code>concern_id</code>, <code>domain</code>, …).
              Required columns: <code>concern_id, domain, concern_cluster</code> + 4 routing slots.
              Routing slots default to <code>UNASSIGNED_ROUTING_NODE</code> when blank.
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Mode</label>
            <div className="space-y-1.5">
              {[
                ['upsert',  'Upsert by concern_id (insert new, update existing)'],
                ['append',  'Append (insert all rows; may create duplicates)'],
                ['replace', 'Replace (TRUNCATE table then insert all rows)'],
              ].map(([k, label]) => (
                <label key={k} className="flex items-start gap-2">
                  <input type="radio" name="import-mode" checked={mode === k} onChange={() => setMode(k as any)} className="mt-1" />
                  <span><b className="text-slate-800">{k}</b> — <span className="text-slate-600">{label}</span></span>
                </label>
              ))}
            </div>
          </div>

          {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs">{error}</div>}

          {summary && (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1">
              <div><b>Mode:</b> {summary.mode}{summary.dryRun && ' (dry run)'}</div>
              <div><b>Parsed:</b> {summary.parsed} · <b>Phantoms dropped:</b> {summary.phantomDropped} · <b>Valid:</b> {summary.validRows}</div>
              {summary.errorCount > 0 && <div className="text-red-700"><b>Errors:</b> {summary.errorCount} (showing first {summary.errors.length})</div>}
              {summary.errors.slice(0, 5).map((e, i) => <div key={i} className="font-mono text-[10px] text-red-700">  row {e.row}: {e.reason}</div>)}
              {!summary.dryRun && summary.written > 0 && (
                <div className="text-emerald-700"><b>Written:</b> {summary.written} (inserted {summary.inserted ?? 0}, updated {summary.updated ?? 0})</div>
              )}
            </div>
          )}
        </div>
        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white">Close</button>
          <button onClick={() => submit(true)} disabled={busy} className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white disabled:opacity-50" data-testid="button-import-dryrun">
            {busy ? 'Working …' : 'Dry-run'}
          </button>
          <button onClick={() => submit(false)} disabled={busy} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" data-testid="button-import-submit">
            {busy ? 'Importing …' : 'Import'}
          </button>
        </footer>
      </div>
    </div>
  );
}
