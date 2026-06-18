import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, GitBranch, Link2, Tag, Info, RefreshCw, Search, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', gray: '#6b7280' };

interface ChildRow {
  id: number;
  parent_competency_id: string;
  child_competency_id: string | null;
  micro_label: string;
  sort_order: number;
  source: string;
  active: boolean;
  linked: boolean;
  child_name: string | null;
  child_deprecated: boolean | null;
}

interface ParentGroup {
  parent_competency_id: string;
  parent_name: string;
  parent_family: string | null;
  child_count: number;
  children: ChildRow[];
}

interface Summary {
  version: string;
  competencies_total: number | null;
  parents_total: number;
  relationships_total: number;
  linked_children: number;
  named_only_children: number;
  active_children: number;
  parent_coverage_pct: number | null;
  avg_children_per_parent: number | null;
  source_breakdown: { source: string; count: number }[];
  named_only: { parent_name: string; micro_label: string }[];
  findings: string[];
}

interface CompetencyLite { competency_id: string; name: string }

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

export default function CompetencyMicroFrameworkPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [formParent, setFormParent] = React.useState('');
  const [formChild, setFormChild] = React.useState('');
  const [formLabel, setFormLabel] = React.useState('');
  const [formMode, setFormMode] = React.useState<'linked' | 'named'>('linked');
  const [formError, setFormError] = React.useState('');

  const summaryQ = useQuery({
    queryKey: ['micro-framework-summary'],
    queryFn: async () => {
      const r = await fetch('/api/admin/competency-intelligence/micro-framework/summary', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('summary failed');
      return (await r.json()).data as Summary;
    },
  });

  const frameworkQ = useQuery({
    queryKey: ['micro-framework'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/micro-framework', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('framework failed');
      return (await r.json()).data as ParentGroup[];
    },
  });

  // Competency picker source (reuse the master read view).
  const compsQ = useQuery({
    queryKey: ['micro-competency-picker'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/master', { credentials: 'include' });
      if (r.status === 503) return [] as CompetencyLite[];
      if (!r.ok) throw new Error('comps failed');
      return ((await r.json()).data as any[]).map((c) => ({ competency_id: c.competency_id, name: c.name }));
    },
  });

  const disabled = (summaryQ.data as any)?.__disabled || (frameworkQ.data as any)?.__disabled;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['micro-framework'] });
    qc.invalidateQueries({ queryKey: ['micro-framework-summary'] });
  };

  const addRelationship = async () => {
    setFormError('');
    if (!formParent) { setFormError('Pick a parent competency.'); return; }
    if (formMode === 'linked' && !formChild) { setFormError('Pick a child competency.'); return; }
    if (formMode === 'named' && !formLabel.trim()) { setFormError('Enter a micro-competency name.'); return; }
    setBusy(true);
    try {
      const body = formMode === 'linked'
        ? { parent_competency_id: formParent, child_competency_id: formChild }
        : { parent_competency_id: formParent, micro_label: formLabel.trim() };
      const resp = await fetch('/api/admin/competency-intelligence/micro-framework', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setFormError(j?.error ? `Could not add: ${j.error}` : 'Could not add relationship.');
        return;
      }
      setFormChild(''); setFormLabel('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: ChildRow) => {
    await fetch(`/api/admin/competency-intelligence/micro-framework/${row.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !row.active }),
    });
    refresh();
  };

  const remove = async (row: ChildRow) => {
    await fetch(`/api/admin/competency-intelligence/micro-framework/${row.id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
  };

  if (summaryQ.isLoading || frameworkQ.isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading micro competency framework…</div>;
  }
  if (disabled) {
    return (
      <div className="p-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/60">
          <CardContent className="pt-6 pb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700">Micro Competency Framework is disabled</p>
              <p className="text-sm text-gray-500 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-100 rounded">FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1</code> to
                enable the parent-child structure. Flag OFF keeps every existing screen byte-identical.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (summaryQ.isError || frameworkQ.isError || !frameworkQ.data || !summaryQ.data) {
    return <div className="p-6 text-sm text-red-600">Failed to load micro competency framework.</div>;
  }

  const summary = summaryQ.data as Summary;
  const groups = frameworkQ.data as ParentGroup[];
  const comps = (compsQ.data as CompetencyLite[] | undefined) ?? [];
  const s = search.trim().toLowerCase();
  const shown = groups.filter((g) =>
    !s || g.parent_name.toLowerCase().includes(s) || g.children.some((c) => c.micro_label.toLowerCase().includes(s)),
  );

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-5 w-5" style={{ color: BRAND.primary }} /> Micro Competency Framework
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Parent-child structure over the canonical genome. Children are EITHER existing competencies (linked) or
            named-only micros (no competency row yet). Additive — the genome is never mutated.
          </p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md px-3 py-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={GitBranch} label="Parent competencies" value={summary.parents_total} sub={summary.parent_coverage_pct != null ? `${summary.parent_coverage_pct}% of genome` : undefined} />
        <MetricCard icon={Network} label="Relationships" value={summary.relationships_total} sub={summary.avg_children_per_parent != null ? `avg ${summary.avg_children_per_parent}/parent` : undefined} color={BRAND.success} />
        <MetricCard icon={Link2} label="Linked children" value={summary.linked_children} sub="reuse existing competencies" color={BRAND.accent} />
        <MetricCard icon={Tag} label="Named-only micros" value={summary.named_only_children} sub="promotion candidates" color={BRAND.warning} />
      </div>

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

      {/* Add relationship */}
      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Plus className="h-4 w-4" /> Add parent-child relationship</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={formParent} onChange={(e) => setFormParent(e.target.value)} className="text-sm border rounded-md px-3 py-2 min-w-[200px]">
              <option value="">Parent competency…</option>
              {comps.map((c) => <option key={c.competency_id} value={c.competency_id}>{c.name}</option>)}
            </select>
            <span className="text-gray-400">→</span>
            <select value={formMode} onChange={(e) => setFormMode(e.target.value as 'linked' | 'named')} className="text-sm border rounded-md px-3 py-2">
              <option value="linked">Linked competency</option>
              <option value="named">Named-only micro</option>
            </select>
            {formMode === 'linked' ? (
              <select value={formChild} onChange={(e) => setFormChild(e.target.value)} className="text-sm border rounded-md px-3 py-2 min-w-[200px]">
                <option value="">Child competency…</option>
                {comps.filter((c) => c.competency_id !== formParent).map((c) => <option key={c.competency_id} value={c.competency_id}>{c.name}</option>)}
              </select>
            ) : (
              <input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Micro-competency name…" className="text-sm border rounded-md px-3 py-2 min-w-[200px]" />
            )}
            <button onClick={addRelationship} disabled={busy} className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 bg-[#344E86] text-white hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parent or micro…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <span className="text-sm text-gray-500">{shown.length} parent{shown.length === 1 ? '' : 's'} shown</span>
      </div>

      {/* Framework tree */}
      <div className="space-y-4">
        {shown.map((g) => (
          <Card key={g.parent_competency_id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4" style={{ color: BRAND.primary }} />
                <span className="font-semibold text-gray-900">{g.parent_name}</span>
                <span className="font-mono text-[11px] text-gray-400">{g.parent_competency_id}</span>
                {g.parent_family && <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">{g.parent_family}</Badge>}
                <span className="text-xs text-gray-400 ml-auto">{g.child_count} micro{g.child_count === 1 ? '' : 's'}</span>
              </div>
              <ul className="space-y-1.5 pl-6">
                {g.children.map((c) => (
                  <li key={c.id} className={`flex items-center gap-2 text-sm rounded-md px-2 py-1.5 ${c.active ? '' : 'opacity-50'} hover:bg-gray-50`}>
                    <span className="text-gray-300">—</span>
                    <span className="text-gray-900">{c.micro_label}</span>
                    {c.linked ? (
                      <Badge className="bg-teal-100 text-teal-700 border-teal-300 text-[10px]"><Link2 className="h-2.5 w-2.5 mr-0.5 inline" />linked</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]"><Tag className="h-2.5 w-2.5 mr-0.5 inline" />named-only</Badge>
                    )}
                    {c.child_deprecated && <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px]">deprecated</Badge>}
                    {c.source === 'curated' && <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px]">curated</Badge>}
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => toggleActive(c)} className="text-xs text-gray-500 hover:text-gray-800 border rounded px-2 py-0.5">{c.active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => remove(c)} className="text-xs text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
                {g.children.length === 0 && <li className="text-sm text-gray-400">No micro-competencies yet.</li>}
              </ul>
            </CardContent>
          </Card>
        ))}
        {shown.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="pt-8 pb-8 text-center text-gray-400 text-sm">
              No parent-child relationships yet. Add one above, or run the seed (<code className="px-1 bg-gray-100 rounded">scripts/seed-micro-competency.ts</code>) to load the baseline framework.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
