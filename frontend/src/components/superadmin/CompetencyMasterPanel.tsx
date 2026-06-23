import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, ShieldCheck, CheckCircle2, Info, RefreshCw, Search, Save } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', gray: '#6b7280' };

const ELIGIBILITY_FLAGS = [
  { key: 'assessment_eligible', label: 'Assessment' },
  { key: 'ei_eligible', label: 'EI' },
  { key: 'career_builder_eligible', label: 'Career Builder' },
  { key: 'employer_eligible', label: 'Employer' },
  { key: 'learning_eligible', label: 'Learning' },
  { key: 'future_ready_eligible', label: 'Future Ready' },
] as const;
type EligibilityKey = (typeof ELIGIBILITY_FLAGS)[number]['key'];

const STATUSES = ['active', 'inactive', 'deprecated'] as const;

interface MasterRow {
  competency_id: string;
  code: string;
  name: string;
  description: string | null;
  type_key: string | null;
  type_label: string | null;
  status: string | null;
  assessment_eligible: boolean | null;
  ei_eligible: boolean | null;
  career_builder_eligible: boolean | null;
  employer_eligible: boolean | null;
  learning_eligible: boolean | null;
  future_ready_eligible: boolean | null;
  source: string | null;
}

interface Summary {
  version: string;
  competencies_total: number | null;
  enhanced: number;
  coverage_pct: number | null;
  status_breakdown: { status: string; count: number }[];
  eligibility: { key: string; label: string; eligible: number; ineligible: number }[];
  source_breakdown: { source: string; count: number }[];
  findings: string[];
}

// Tri-state checkbox: null underlying value (row not yet enhanced) renders
// indeterminate so "unknown" is never misrepresented as "ineligible" (false).
function TriCheckbox({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = value === null; }, [value]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={value === true}
      title={value === null ? 'Not enhanced yet (unknown)' : undefined}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 accent-[#344E86] cursor-pointer"
    />
  );
}

// Select-all checkbox: indeterminate when some-but-not-all visible rows are selected.
function HeaderCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title="Select all (filtered)"
      className="h-4 w-4 accent-[#344E86] cursor-pointer"
    />
  );
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: (color || BRAND.primary) + '15' }}>
            <Icon className="h-5 w-5" style={{ color: color || BRAND.primary }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompetencyMasterPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [edits, setEdits] = React.useState<Record<string, Partial<MasterRow>>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState('');
  const [bulkElig, setBulkElig] = React.useState<Record<string, '' | 'yes' | 'no'>>({});
  const [bulkSaving, setBulkSaving] = React.useState(false);

  const summaryQ = useQuery({
    queryKey: ['competency-master-summary'],
    queryFn: async () => {
      const r = await fetch('/api/admin/competency-intelligence/master-summary', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('summary failed');
      return (await r.json()).data as Summary;
    },
  });

  const listQ = useQuery({
    queryKey: ['competency-master-list'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/master', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('list failed');
      return (await r.json()).data as MasterRow[];
    },
  });

  const disabled = (summaryQ.data as any)?.__disabled || (listQ.data as any)?.__disabled;

  if (summaryQ.isLoading || listQ.isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading competency master…</div>;
  }
  if (disabled) {
    return (
      <div className="p-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/60">
          <CardContent className="pt-6 pb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700">Competency Master is disabled</p>
              <p className="text-sm text-gray-500 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-100 rounded">FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1</code> to
                enable the enhanced competency entity (Status + module eligibility). Flag OFF keeps every existing screen
                byte-identical.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (summaryQ.isError || listQ.isError || !listQ.data || !summaryQ.data) {
    return <div className="p-6 text-sm text-red-600">Failed to load competency master.</div>;
  }

  const summary = summaryQ.data as Summary;
  const allRows = listQ.data as MasterRow[];
  const s = search.trim().toLowerCase();
  const rows = allRows.filter((r) => {
    if (statusFilter && (r.status ?? '') !== statusFilter) return false;
    if (s && !r.name.toLowerCase().includes(s) && !r.code.toLowerCase().includes(s)) return false;
    return true;
  });

  const effective = (r: MasterRow): MasterRow => ({ ...r, ...edits[r.competency_id] });
  const isDirty = (id: string) => !!edits[id] && Object.keys(edits[id]).length > 0;

  const setField = (r: MasterRow, field: keyof MasterRow, value: any) => {
    setEdits((prev) => {
      const base = prev[r.competency_id] ?? {};
      const next = { ...base, [field]: value };
      // drop keys that match the server value again
      if ((r as any)[field] === value) delete (next as any)[field];
      return { ...prev, [r.competency_id]: next };
    });
  };

  const save = async (r: MasterRow) => {
    const patch = edits[r.competency_id];
    if (!patch || Object.keys(patch).length === 0) return;
    setSaving((p) => ({ ...p, [r.competency_id]: true }));
    try {
      const resp = await fetch(`/api/admin/competency-intelligence/master/${encodeURIComponent(r.competency_id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!resp.ok) throw new Error('save failed');
      setEdits((prev) => { const n = { ...prev }; delete n[r.competency_id]; return n; });
      await qc.invalidateQueries({ queryKey: ['competency-master-list'] });
      await qc.invalidateQueries({ queryKey: ['competency-master-summary'] });
    } catch {
      // keep the dirty edit so the user can retry
    } finally {
      setSaving((p) => ({ ...p, [r.competency_id]: false }));
    }
  };

  // ---- Multi-select / bulk edit ----
  const toggleRow = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.competency_id));
  const someVisibleSelected = rows.some((r) => selected.has(r.competency_id)) && !allVisibleSelected;
  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) rows.forEach((r) => n.delete(r.competency_id));
      else rows.forEach((r) => n.add(r.competency_id));
      return n;
    });
  const clearSelection = () => setSelected(new Set());
  const bulkHasChange = !!bulkStatus || ELIGIBILITY_FLAGS.some((f) => bulkElig[f.key]);

  const applyBulk = async () => {
    if (selected.size === 0 || !bulkHasChange) return;
    const patch: Record<string, any> = {};
    if (bulkStatus) patch.status = bulkStatus;
    for (const f of ELIGIBILITY_FLAGS) {
      const v = bulkElig[f.key];
      if (v === 'yes') patch[f.key] = true;
      else if (v === 'no') patch[f.key] = false;
    }
    setBulkSaving(true);
    try {
      const resp = await fetch('/api/admin/competency-intelligence/master/bulk', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competency_ids: Array.from(selected), patch }),
      });
      if (!resp.ok) throw new Error('bulk failed');
      setSelected(new Set());
      setBulkStatus('');
      setBulkElig({});
      await qc.invalidateQueries({ queryKey: ['competency-master-list'] });
      await qc.invalidateQueries({ queryKey: ['competency-master-summary'] });
    } catch {
      // keep selection so the user can retry
    } finally {
      setBulkSaving(false);
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['competency-master-list'] });
    qc.invalidateQueries({ queryKey: ['competency-master-summary'] });
  };

  const curated = summary.source_breakdown.find((x) => x.source === 'curated')?.count ?? 0;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="h-5 w-5" style={{ color: BRAND.primary }} /> Competency Master
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            The enhanced competency entity — Code · Name · Type · Description · Status + six module-eligibility fields.
            Additive over the canonical genome; editing never creates a duplicate competency.
          </p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md px-3 py-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Boxes} label="Competencies" value={summary.competencies_total ?? '—'} sub="canonical genome" />
        <MetricCard icon={CheckCircle2} label="Enhanced" value={summary.enhanced} sub={summary.coverage_pct != null ? `${summary.coverage_pct}% coverage` : undefined} color={BRAND.success} />
        <MetricCard icon={ShieldCheck} label="Admin-curated" value={curated} sub="rest = default baseline" color={BRAND.accent} />
        <MetricCard icon={Info} label="Statuses" value={summary.status_breakdown.map((x) => `${x.count} ${x.status}`).join(' · ') || '—'} color={BRAND.warning} />
      </div>

      {/* Eligibility roll-up */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Module eligibility (count eligible / total enhanced)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {summary.eligibility.map((e) => (
              <div key={e.key} className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">{e.label}</p>
                <p className="text-lg font-bold text-gray-900">{e.eligible}<span className="text-sm text-gray-400 font-normal"> / {e.eligible + e.ineligible}</span></p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Findings */}
      {summary.findings.length > 0 && (
        <Card className="bg-blue-50/40 border-blue-200">
          <CardContent className="pt-4 pb-4 space-y-1.5">
            {summary.findings.map((f, i) => (
              <p key={i} className="text-sm text-gray-700 flex items-start gap-2"><Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />{f}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border rounded-md px-3 py-2">
          <option value="">All statuses</option>
          {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <span className="text-sm text-gray-500">{rows.length} shown</span>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <Card className="border-[#344E86]/40 bg-[#344E86]/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm font-semibold text-[#344E86]">{selected.size} selected</span>
              <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-800 underline">Clear</button>
              <div className="h-5 w-px bg-gray-300 hidden sm:block" />
              <label className="text-xs text-gray-600 flex items-center gap-1.5">
                Status
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="text-xs border rounded px-2 py-1">
                  <option value="">— leave —</option>
                  {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </label>
              {ELIGIBILITY_FLAGS.map((f) => (
                <label key={f.key} className="text-xs text-gray-600 flex items-center gap-1">
                  {f.label}
                  <select
                    value={bulkElig[f.key] ?? ''}
                    onChange={(e) => setBulkElig((p) => ({ ...p, [f.key]: e.target.value as '' | 'yes' | 'no' }))}
                    className="text-xs border rounded px-1.5 py-1"
                  >
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              ))}
              <button
                disabled={bulkSaving || !bulkHasChange}
                onClick={applyBulk}
                className={`ml-auto inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 ${bulkHasChange && !bulkSaving ? 'bg-[#344E86] text-white hover:opacity-90' : 'bg-gray-200 text-gray-400 cursor-default'}`}
              >
                <Save className="h-4 w-4" /> {bulkSaving ? 'Applying…' : `Apply to ${selected.size}`}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Leave a field on “—” to keep each row’s current value. Applying stamps the affected rows as admin-curated.</p>
          </CardContent>
        </Card>
      )}

      {/* Editable table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-2 w-8">
                  <HeaderCheckbox checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={toggleAll} />
                </th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {ELIGIBILITY_FLAGS.map((f) => <th key={f.key} className="px-2 py-2 font-medium text-center whitespace-nowrap">{f.label}</th>)}
                <th className="px-3 py-2 font-medium text-right">Save</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((raw) => {
                const r = effective(raw);
                const dirty = isDirty(r.competency_id);
                return (
                  <tr key={r.competency_id} className={`border-b hover:bg-gray-50/60 ${dirty ? 'bg-amber-50/50' : selected.has(r.competency_id) ? 'bg-[#344E86]/5' : ''}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.competency_id)}
                        onChange={() => toggleRow(r.competency_id)}
                        className="h-4 w-4 accent-[#344E86] cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{r.code}</td>
                    <td className="px-3 py-2 text-gray-900">
                      {r.name}
                      {r.source === 'curated' && <Badge className="ml-2 bg-teal-100 text-teal-700 border-teal-300 text-[10px]">curated</Badge>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.type_label ?? '—'}</td>
                    <td className="px-3 py-2">
                      <select
                        value={r.status ?? ''}
                        onChange={(e) => setField(raw, 'status', e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        {r.status == null && <option value="" disabled>— not enhanced</option>}
                        {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                    {ELIGIBILITY_FLAGS.map((f) => (
                      <td key={f.key} className="px-2 py-2 text-center">
                        <TriCheckbox
                          value={(r as any)[f.key as EligibilityKey] ?? null}
                          onChange={(v) => setField(raw, f.key as keyof MasterRow, v)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <button
                        disabled={!dirty || saving[r.competency_id]}
                        onClick={() => save(raw)}
                        className={`inline-flex items-center gap-1 text-xs rounded-md px-2.5 py-1 ${dirty ? 'bg-[#344E86] text-white hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-default'}`}
                      >
                        <Save className="h-3.5 w-3.5" /> {saving[r.competency_id] ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6 + ELIGIBILITY_FLAGS.length} className="px-3 py-8 text-center text-gray-400">No competencies match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
