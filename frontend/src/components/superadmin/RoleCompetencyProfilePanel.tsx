import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Grid3x3, Gauge, Info, RefreshCw, Search, Plus, Trash2, AlertTriangle, Target } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';



const CRIT_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  important: 'bg-blue-100 text-blue-700 border-blue-300',
  desirable: 'bg-gray-100 text-gray-600 border-gray-300',
  optional: 'bg-gray-50 text-gray-400 border-gray-200',
};
const CRIT_TIERS = ['critical', 'important', 'desirable', 'optional'];
const LEVEL_LABELS: Record<number, string> = { 1: 'Awareness', 2: 'Basic', 3: 'Independent', 4: 'Advanced', 5: 'Expert' };

interface CompetencyReq {
  id: number;
  role_id: string;
  role_title: string | null;
  competency_id: string;
  competency_name: string | null;
  competency_deprecated: boolean | null;
  required_level: number;
  required_level_label: string | null;
  weight: number;
  criticality: string;
  rationale: string | null;
  source: string;
  active: boolean;
}
interface RoleProfile {
  role_id: string;
  role_title: string | null;
  role_family: string | null;
  competency_count: number;
  weight_total: number;
  weight_balanced: boolean;
  competencies: CompetencyReq[];
}
interface MatrixView {
  roles: { role_id: string; role_title: string | null; weight_total: number; weight_balanced: boolean; competency_count: number }[];
  competencies: { competency_id: string; competency_name: string | null }[];
  cells: Record<string, { required_level: number; weight: number; criticality: string }>;
}
interface ReadinessGap {
  competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null;
  weight: number; criticality: string; attainment: number | null; gap: number | null; blocking: boolean;
}
interface ReadinessResult {
  role_id: string; role_title: string | null; measured: boolean;
  readiness_score: number | null; readiness_band: string | null; readiness_label: string | null;
  coverage_pct: number | null; weight_total: number; weight_assessed: number; blocking_gaps: number;
  gaps: ReadinessGap[]; notes: string[];
}
interface Summary {
  version: string;
  roles_total: number | null;
  roles_profiled: number;
  role_coverage_pct: number | null;
  requirements_total: number;
  competencies_referenced: number;
  avg_competencies_per_role: number | null;
  criticality_breakdown: { criticality: string; count: number }[];
  source_breakdown: { source: string; count: number }[];
  weight_integrity: { role_id: string; role_title: string | null; weight_total: number; balanced: boolean }[];
  unbalanced_roles: number;
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

function CritBadge({ c }: { c: string }) {
  return <Badge className={`${CRIT_STYLE[c] ?? CRIT_STYLE.optional} text-[10px] capitalize`}>{c}</Badge>;
}

const bandColor = (band: string | null): string => {
  switch (band) {
    case 'ready': return BRAND.success;
    case 'nearly_ready': return BRAND.accent;
    case 'developing': return BRAND.warning;
    default: return BRAND.danger;
  }
};

export default function RoleCompetencyProfilePanel() {
  const qc = useQueryClient();
  const [view, setView] = React.useState<'profiles' | 'matrix' | 'readiness'>('profiles');
  const [search, setSearch] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Add-requirement form state.
  const [formRole, setFormRole] = React.useState('');
  const [formComp, setFormComp] = React.useState('');
  const [formLevel, setFormLevel] = React.useState('3');
  const [formWeight, setFormWeight] = React.useState('10');
  const [formCrit, setFormCrit] = React.useState('important');
  const [formError, setFormError] = React.useState('');

  // Readiness state.
  const [readinessRole, setReadinessRole] = React.useState('');
  const [actuals, setActuals] = React.useState<Record<string, string>>({});

  const summaryQ = useQuery({
    queryKey: ['role-profiles-summary'],
    queryFn: async () => {
      const r = await fetch('/api/admin/competency-intelligence/role-profiles/summary', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('summary failed');
      return (await r.json()).data as Summary;
    },
  });
  const profilesQ = useQuery({
    queryKey: ['role-profiles'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/role-profiles', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('profiles failed');
      return (await r.json()).data as RoleProfile[];
    },
  });
  const matrixQ = useQuery({
    queryKey: ['role-matrix'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/role-matrix', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('matrix failed');
      return (await r.json()).data as MatrixView;
    },
  });
  const compsQ = useQuery({
    queryKey: ['role-competency-picker'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/master', { credentials: 'include' });
      if (r.status === 503) return [] as CompetencyLite[];
      if (!r.ok) throw new Error('comps failed');
      return ((await r.json()).data as any[]).map((c) => ({ competency_id: c.competency_id, name: c.name }));
    },
  });

  const disabled = (summaryQ.data as any)?.__disabled || (profilesQ.data as any)?.__disabled;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['role-profiles'] });
    qc.invalidateQueries({ queryKey: ['role-profiles-summary'] });
    qc.invalidateQueries({ queryKey: ['role-matrix'] });
  };

  const addRequirement = async () => {
    setFormError('');
    if (!formRole) { setFormError('Pick a role.'); return; }
    if (!formComp) { setFormError('Pick a competency.'); return; }
    setBusy(true);
    try {
      const resp = await fetch('/api/admin/competency-intelligence/role-profiles', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: formRole, competency_id: formComp,
          required_level: Number(formLevel), weight: Number(formWeight), criticality: formCrit,
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setFormError(j?.error ? `Could not add: ${j.error}` : 'Could not add requirement.');
        return;
      }
      setFormComp('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: CompetencyReq) => {
    await fetch(`/api/admin/competency-intelligence/role-profiles/${row.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !row.active }),
    });
    refresh();
  };
  const remove = async (row: CompetencyReq) => {
    await fetch(`/api/admin/competency-intelligence/role-profiles/${row.id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
  };

  const readinessQ = useQuery({
    queryKey: ['role-readiness', readinessRole, actuals],
    enabled: !!readinessRole && view === 'readiness',
    queryFn: async () => {
      const pairs = Object.entries(actuals)
        .filter(([, v]) => v && Number(v) >= 1 && Number(v) <= 5)
        .map(([k, v]) => `${k}:${v}`).join(',');
      const url = `/api/competency-intelligence/role-readiness/${encodeURIComponent(readinessRole)}${pairs ? `?actuals=${encodeURIComponent(pairs)}` : ''}`;
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error('readiness failed');
      return (await r.json()).data as ReadinessResult;
    },
  });

  if (summaryQ.isLoading || profilesQ.isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading role competency profiles…</div>;
  }
  if (disabled) {
    return (
      <div className="p-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/60">
          <CardContent className="pt-6 pb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700">Role Competency Profile Engine is disabled</p>
              <p className="text-sm text-gray-500 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-100 rounded">FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1</code> to
                enable role → competency requirement profiles. Flag OFF keeps every existing screen byte-identical.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (summaryQ.isError || profilesQ.isError || !profilesQ.data || !summaryQ.data) {
    return <div className="p-6 text-sm text-red-600">Failed to load role competency profiles.</div>;
  }

  const summary = summaryQ.data as Summary;
  const profiles = profilesQ.data as RoleProfile[];
  const comps = (compsQ.data as CompetencyLite[] | undefined) ?? [];
  const roleOptions = profiles.map((p) => ({ role_id: p.role_id, title: p.role_title ?? p.role_id }));
  const s = search.trim().toLowerCase();
  const shown = profiles.filter((p) =>
    !s || (p.role_title ?? '').toLowerCase().includes(s) || p.competencies.some((c) => (c.competency_name ?? '').toLowerCase().includes(s)),
  );

  const readinessProfile = profiles.find((p) => p.role_id === readinessRole);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5" style={{ color: BRAND.primary }} /> Role Competency Profile Engine
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Role → Competency → Required Level → Weight → Criticality. Every requirement references existing roles and
            competencies — the canonical genome is never mutated. Weights are reported as-is (never auto-normalised).
          </p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md px-3 py-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Briefcase} label="Roles profiled" value={summary.roles_profiled} sub={summary.role_coverage_pct != null ? `${summary.role_coverage_pct}% of roles` : undefined} />
        <MetricCard icon={Target} label="Requirements" value={summary.requirements_total} sub={summary.avg_competencies_per_role != null ? `avg ${summary.avg_competencies_per_role}/role` : undefined} color={BRAND.success} />
        <MetricCard icon={Grid3x3} label="Competencies used" value={summary.competencies_referenced} sub="distinct, reused" color={BRAND.accent} />
        <MetricCard icon={AlertTriangle} label="Unbalanced roles" value={summary.unbalanced_roles} sub="weights ≠ 100" color={summary.unbalanced_roles > 0 ? BRAND.warning : BRAND.gray} />
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

      {/* View switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {([['profiles', 'Profiles', Briefcase], ['matrix', 'Matrix', Grid3x3], ['readiness', 'Readiness', Gauge]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ---- PROFILES VIEW ---- */}
      {view === 'profiles' && (
        <>
          <Card>
            <CardContent className="pt-5 pb-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Plus className="h-4 w-4" /> Add role competency requirement</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="text-sm border rounded-md px-3 py-2 min-w-[180px]">
                  <option value="">Role…</option>
                  {roleOptions.map((r) => <option key={r.role_id} value={r.role_id}>{r.title}</option>)}
                </select>
                <span className="text-gray-400">→</span>
                <select value={formComp} onChange={(e) => setFormComp(e.target.value)} className="text-sm border rounded-md px-3 py-2 min-w-[200px]">
                  <option value="">Competency…</option>
                  {comps.map((c) => <option key={c.competency_id} value={c.competency_id}>{c.name}</option>)}
                </select>
                <select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} className="text-sm border rounded-md px-2 py-2" title="Required level">
                  {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>L{l} · {LEVEL_LABELS[l]}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={100} value={formWeight} onChange={(e) => setFormWeight(e.target.value)} className="text-sm border rounded-md px-2 py-2 w-20" title="Weight %" />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <select value={formCrit} onChange={(e) => setFormCrit(e.target.value)} className="text-sm border rounded-md px-2 py-2 capitalize" title="Criticality">
                  {CRIT_TIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={addRequirement} disabled={busy} className="inline-flex items-center gap-1.5 text-sm rounded-md px-3 py-2 bg-[#344E86] text-white hover:opacity-90 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> {busy ? 'Adding…' : 'Add'}
                </button>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </CardContent>
          </Card>

          <div className="relative max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search role or competency…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          <div className="space-y-4">
            {shown.map((p) => (
              <Card key={p.role_id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-4 w-4" style={{ color: BRAND.primary }} />
                    <span className="font-semibold text-gray-900">{p.role_title}</span>
                    <span className="font-mono text-[11px] text-gray-400">{p.role_id}</span>
                    <Badge className={`${p.weight_balanced ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'} text-[10px] ml-auto`}>
                      weight Σ {p.weight_total}{p.weight_balanced ? ' ✓' : ' ⚠'}
                    </Badge>
                    <span className="text-xs text-gray-400">{p.competency_count} competenc{p.competency_count === 1 ? 'y' : 'ies'}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-gray-400">
                        <th className="py-1 font-medium">Competency</th>
                        <th className="py-1 font-medium">Required level</th>
                        <th className="py-1 font-medium">Weight</th>
                        <th className="py-1 font-medium">Criticality</th>
                        <th className="py-1 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.competencies.map((c) => (
                        <tr key={c.id} className={`border-t border-gray-100 ${c.active ? '' : 'opacity-50'}`}>
                          <td className="py-1.5 text-gray-900">{c.competency_name}{c.competency_deprecated && <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px] ml-1">deprecated</Badge>}</td>
                          <td className="py-1.5"><Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 text-[10px]">L{c.required_level} · {c.required_level_label ?? LEVEL_LABELS[c.required_level]}</Badge></td>
                          <td className="py-1.5 text-gray-700">{c.weight}%</td>
                          <td className="py-1.5"><CritBadge c={c.criticality} /></td>
                          <td className="py-1.5">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => toggleActive(c)} className="text-xs text-gray-500 hover:text-gray-800 border rounded px-2 py-0.5">{c.active ? 'Deactivate' : 'Activate'}</button>
                              <button onClick={() => remove(c)} className="text-xs text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {p.competencies.length === 0 && <tr><td colSpan={5} className="py-2 text-sm text-gray-400">No competency requirements yet.</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
            {shown.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-8 pb-8 text-center text-gray-400 text-sm">
                  No role competency profiles yet. Add one above, or run the seed (<code className="px-1 bg-gray-100 rounded">scripts/seed-role-competency-profile.ts</code>).
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ---- MATRIX VIEW ---- */}
      {view === 'matrix' && matrixQ.data && !(matrixQ.data as any).__disabled && (() => {
        const m = matrixQ.data as MatrixView;
        return (
          <Card>
            <CardContent className="pt-4 pb-4 overflow-auto">
              <p className="text-sm text-gray-500 mb-3">Each cell shows the required level and weight. Colour indicates criticality. Empty = competency not required for that role.</p>
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white z-10 text-left p-2 border-b border-gray-200 min-w-[180px]">Competency \ Role</th>
                    {m.roles.map((r) => (
                      <th key={r.role_id} className="p-2 border-b border-gray-200 text-center min-w-[110px]">
                        <div className="font-semibold text-gray-800">{r.role_title}</div>
                        <div className={`text-[10px] ${r.weight_balanced ? 'text-green-600' : 'text-amber-600'}`}>Σ {r.weight_total}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.competencies.map((c) => (
                    <tr key={c.competency_id} className="hover:bg-gray-50">
                      <td className="sticky left-0 bg-white z-10 p-2 border-b border-gray-100 text-gray-800">{c.competency_name}</td>
                      {m.roles.map((r) => {
                        const cell = m.cells[`${r.role_id}::${c.competency_id}`];
                        return (
                          <td key={r.role_id} className="p-1.5 border-b border-gray-100 text-center">
                            {cell ? (
                              <div className={`rounded px-1.5 py-1 ${CRIT_STYLE[cell.criticality] ?? CRIT_STYLE.optional}`}>
                                <div className="font-semibold">L{cell.required_level}</div>
                                <div className="text-[10px] opacity-80">{cell.weight}%</div>
                              </div>
                            ) : <span className="text-gray-200">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-2 mt-4">
                {CRIT_TIERS.map((c) => <CritBadge key={c} c={c} />)}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ---- READINESS VIEW ---- */}
      {view === 'readiness' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 pb-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Gauge className="h-4 w-4" /> Role Readiness Framework</p>
              <p className="text-sm text-gray-500">
                Pick a role, then enter actual proficiency levels to compute weighted readiness. Coverage (assessed weight)
                and the readiness score are separate axes — with no actuals, readiness is honestly unmeasured.
              </p>
              <select
                value={readinessRole}
                onChange={(e) => { setReadinessRole(e.target.value); setActuals({}); }}
                className="text-sm border rounded-md px-3 py-2 min-w-[220px]"
              >
                <option value="">Select a role…</option>
                {roleOptions.map((r) => <option key={r.role_id} value={r.role_id}>{r.title}</option>)}
              </select>
            </CardContent>
          </Card>

          {readinessProfile && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Enter actual proficiency levels (leave blank = unassessed)</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-gray-400">
                      <th className="py-1 font-medium">Competency</th>
                      <th className="py-1 font-medium">Required</th>
                      <th className="py-1 font-medium">Weight</th>
                      <th className="py-1 font-medium">Criticality</th>
                      <th className="py-1 font-medium">Actual level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readinessProfile.competencies.filter((c) => c.active).map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="py-1.5 text-gray-900">{c.competency_name}</td>
                        <td className="py-1.5"><Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 text-[10px]">L{c.required_level}</Badge></td>
                        <td className="py-1.5 text-gray-700">{c.weight}%</td>
                        <td className="py-1.5"><CritBadge c={c.criticality} /></td>
                        <td className="py-1.5">
                          <select
                            value={actuals[c.competency_id] ?? ''}
                            onChange={(e) => setActuals((prev) => ({ ...prev, [c.competency_id]: e.target.value }))}
                            className="text-sm border rounded-md px-2 py-1"
                          >
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>L{l}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {readinessQ.data && (() => {
            const rr = readinessQ.data as ReadinessResult;
            return (
              <Card>
                <CardContent className="pt-5 pb-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold" style={{ color: rr.measured ? bandColor(rr.readiness_band) : BRAND.gray }}>
                        {rr.measured ? `${rr.readiness_score}%` : '—'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{rr.measured ? rr.readiness_label : 'Unmeasured'}</div>
                    </div>
                    <div className="text-sm space-y-1">
                      <div><span className="text-gray-500">Coverage:</span> <span className="font-semibold text-gray-800">{rr.coverage_pct != null ? `${rr.coverage_pct}%` : '—'}</span> <span className="text-gray-400">({rr.weight_assessed} of {rr.weight_total} weight assessed)</span></div>
                      <div><span className="text-gray-500">Blocking gaps:</span> <span className={`font-semibold ${rr.blocking_gaps > 0 ? 'text-red-600' : 'text-gray-800'}`}>{rr.blocking_gaps}</span> <span className="text-gray-400">(critical below required)</span></div>
                    </div>
                  </div>

                  {rr.notes.length > 0 && (
                    <div className="space-y-1">
                      {rr.notes.map((n, i) => <p key={i} className="text-sm text-gray-600 flex items-start gap-2"><Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />{n}</p>)}
                    </div>
                  )}

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-gray-400">
                        <th className="py-1 font-medium">Competency</th>
                        <th className="py-1 font-medium">Required</th>
                        <th className="py-1 font-medium">Actual</th>
                        <th className="py-1 font-medium">Gap</th>
                        <th className="py-1 font-medium">Attainment</th>
                        <th className="py-1 font-medium">Criticality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rr.gaps.map((g) => (
                        <tr key={g.competency_id} className={`border-t border-gray-100 ${g.blocking ? 'bg-red-50' : ''}`}>
                          <td className="py-1.5 text-gray-900">{g.competency_name}{g.blocking && <AlertTriangle className="h-3.5 w-3.5 text-red-500 inline ml-1" />}</td>
                          <td className="py-1.5">L{g.required_level}</td>
                          <td className="py-1.5">{g.actual_level != null ? `L${g.actual_level}` : <span className="text-gray-400">—</span>}</td>
                          <td className="py-1.5">{g.gap != null ? (g.gap > 0 ? <span className="text-red-600">-{g.gap}</span> : <span className="text-green-600">✓</span>) : <span className="text-gray-400">—</span>}</td>
                          <td className="py-1.5">{g.attainment != null ? `${g.attainment}%` : <span className="text-gray-400">—</span>}</td>
                          <td className="py-1.5"><CritBadge c={g.criticality} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
}
