import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, CircleSlash, Boxes, Layers, ShieldCheck, GitBranch, ListChecks } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BASE = '/api/admin/question-management';

/** null/undefined → "not measurable" (amber); 0 stays 0. null ≠ 0. */
function Metric({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{String(value)}</span>;
}
function Present({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">unknown</span>;
  return value
    ? <span className="text-emerald-700 text-xs font-medium">present</span>
    : <span className="text-slate-500 text-xs">absent</span>;
}
function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status ?? '').toUpperCase();
  const cls =
    s === 'SUPPORTED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : s === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border-amber-300'
        : s === 'DEAD_END' ? 'bg-red-100 text-red-800 border-red-300'
          : 'bg-slate-100 text-slate-700 border-slate-300';
  return <Badge variant="outline" className={cls}>{s || '—'}</Badge>;
}
function statusLine(sc: any): string {
  if (!sc) return '—';
  return `${sc.SUPPORTED ?? 0} SUP · ${sc.PARTIAL ?? 0} PART · ${sc.DEAD_END ?? 0} DEAD · ${sc.MISSING ?? 0} MISS`;
}
function Section({ title, icon, subtitle, children }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-slate-50/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold" style={{ color: BRAND.primary }}>{title}</h3>
      </div>
      {subtitle && <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}
function Stat({ label, value, hint }: { label: string; value: number | null | undefined; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg"><Metric value={value} /></div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function QuestionManagementPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    summary: any | null;
    dimensions: any | null;
    gaps: any | null;
    adoption: any | null;
  }>({
    queryKey: [`${BASE}/console`],
    queryFn: async () => {
      const probe = await fetch(`/api/question-management/enabled`, { credentials: 'include' });
      // 403/503 = flag genuinely OFF. 401/5xx/network = load error (surface, not "disabled").
      if (probe.status === 403 || probe.status === 503) return { disabled: true, summary: null, dimensions: null, gaps: null, adoption: null };
      if (!probe.ok) throw new Error(`question-management enabled probe failed: ${probe.status}`);
      const getJson = async (p: string) => {
        try { const r = await fetch(`${BASE}${p}`, { credentials: 'include' }); return r.ok ? await r.json() : null; }
        catch { return null; }
      };
      const [summary, dimensions, gaps, adoption] = await Promise.all([
        getJson('/summary'), getJson('/dimensions'), getJson('/gaps'), getJson('/adoption'),
      ]);
      return {
        disabled: false,
        summary: summary?.summary ?? null,
        dimensions: dimensions?.dimensions ?? null,
        gaps: gaps ?? null,
        adoption: adoption?.adoption ?? null,
      };
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading Question Management Platform certification…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load Question Management Platform certification.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Question Management Platform is disabled (flag <code>questionManagementPlatform</code> OFF).
        </div>
      </div>
    );
  }

  const s = data.summary ?? {};
  const dims: any[] = data.dimensions?.dimensions ?? [];
  const repo = s.repository_alignment ?? {};
  const ado = data.adoption ?? {};
  const resolved: any[] = data.gaps?.resolved_gaps ?? [];
  const openGaps: any[] = data.gaps?.gaps ?? [];
  const gapTotal = data.gaps?.gap_total ?? 0;

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Boxes className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Enterprise Question Management Platform</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only certification of the ONE canonical platform COMPOSING the existing question services under one
              registry + additive <code>qmp_*</code> overlay. The EIGHT dimensions (platform · library · metadata · governance ·
              version_management · workflow · apis · frontend) are reported SEPARATELY — never composited. Adoption is a
              SEPARATE usage axis, never a gap. null = not measurable (never a fabricated 0).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Verdict */}
      {s.enterprise_ready && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />
            <span className="text-sm font-semibold">Verdict:</span>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">{s.enterprise_ready.verdict}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{s.enterprise_ready.note}</p>
        </div>
      )}

      {/* Dimension roll-up */}
      <Section title="Eight certification dimensions (never composited)" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Each dimension certified SEPARATELY. Coverage ⟂ Confidence ⟂ Adoption.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Dimensions" value={s.dimensions?.dimension_count} hint={statusLine(s.dimensions?.status_counts)} />
          <Stat label="Type catalog" value={s.type_catalog?.type_count} hint={statusLine(s.type_catalog?.status_counts)} />
          <Stat label="Metadata fields" value={s.metadata?.field_count} hint={`${s.metadata?.fields_covered ?? '—'} covered · ${s.metadata?.source_count ?? '—'} sources`} />
          <Stat label="Lifecycle states" value={s.lifecycle?.state_count} hint={statusLine(s.lifecycle?.mapping_status_counts)} />
          <Stat label="Governance" value={s.governance?.control_count} hint={statusLine(s.governance?.status_counts)} />
          <Stat label="Version mgmt" value={s.version_management?.capability_count} hint={statusLine(s.version_management?.status_counts)} />
          <Stat label="Workflow stages" value={s.workflow?.stage_count} hint={statusLine(s.workflow?.status_counts)} />
          <Stat label="Library scopes" value={s.library?.scope_count} hint="unified by reference" />
        </div>
      </Section>

      {/* Per-dimension detail */}
      {dims.length > 0 && (
        <Section title="Dimension inventory (verified vs live repo + DB)" icon={<ListChecks className="h-4 w-4" style={{ color: BRAND.primary }} />}
          subtitle="Evidence present counts are verified independently. null (unknown) ≠ 0 (absent).">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">Dimension</th><th className="py-1 pr-3">Status</th>
                  <th className="py-1 pr-3">Services</th><th className="py-1 pr-3">Routes</th>
                  <th className="py-1 pr-3">Frontend</th><th className="py-1 pr-3">Tables</th>
                </tr>
              </thead>
              <tbody>
                {dims.map((d: any) => (
                  <tr key={d.key} className="border-t">
                    <td className="py-1 pr-3 font-medium">{d.label}</td>
                    <td className="py-1 pr-3"><StatusBadge status={d.status} /></td>
                    <td className="py-1 pr-3 tabular-nums">{d.evidence?.services?.present}/{d.evidence?.services?.total}</td>
                    <td className="py-1 pr-3 tabular-nums">{d.evidence?.routes?.present}/{d.evidence?.routes?.total}</td>
                    <td className="py-1 pr-3 tabular-nums">{d.evidence?.frontend?.present}/{d.evidence?.frontend?.total}</td>
                    <td className="py-1 pr-3 tabular-nums">{d.evidence?.tables?.present}/{d.evidence?.tables?.total}{d.evidence?.tables?.unknown ? ` (${d.evidence.tables.unknown}?)` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Repository alignment */}
      <Section title="Repository alignment (Coverage-only)" icon={<GitBranch className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Every evidence claim verified vs the live filesystem + DB. Overlay tables absent while the flag has never run its write paths — honest.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Services" value={repo.services?.present} hint={`of ${repo.services?.total ?? '—'}`} />
          <Stat label="Routes" value={repo.routes?.present} hint={`of ${repo.routes?.total ?? '—'}`} />
          <Stat label="Frontend" value={repo.frontend?.present} hint={`of ${repo.frontend?.total ?? '—'}`} />
          <Stat label="Tables" value={repo.tables?.present} hint={`of ${repo.tables?.total ?? '—'} · absent ${repo.tables?.absent ?? '—'} · unknown ${repo.tables?.unknown ?? '—'}`} />
        </div>
      </Section>

      {/* Adoption (separate axis) */}
      <Section title="Adoption — real question volume (SEPARATE axis, never a gap)" icon={<Boxes className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. null (unreadable) ≠ 0 (empty).">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Metadata rows" value={ado.metadata?.rows} hint={`owned ${ado.metadata?.owned ?? '—'} · tagged ${ado.metadata?.tagged ?? '—'}`} />
          <Stat label="Versioned questions" value={ado.versions?.versioned_questions} hint={`${ado.versions?.total_versions ?? '—'} versions · ${ado.versions?.branches ?? '—'} branches`} />
          <Stat label="Workflow transitions" value={ado.workflow?.transitions} hint={`approved ${ado.workflow?.approved ?? '—'} · published ${ado.workflow?.published ?? '—'}`} />
          <Stat label="Collections" value={ado.collections?.collections} hint={`${ado.collections?.scopes ?? '—'} scopes`} />
          <Stat label="Saved searches" value={ado.saved_searches?.saved_searches} />
          <Stat label="Bulk jobs" value={ado.bulk_jobs?.jobs} hint={`completed ${ado.bulk_jobs?.completed ?? '—'}`} />
        </div>
      </Section>

      {/* Gaps */}
      <Section title={`Gaps — ${gapTotal} OPEN · ${resolved.length} RESOLVED (engineering-closed via reuse)`} icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="All true gaps engineering-closed via reuse-before-build. What remains is adoption — never a gap.">
        {openGaps.length === 0
          ? <p className="text-xs text-emerald-700">No open engineering gaps.</p>
          : (
            <ul className="mb-3 space-y-1 text-xs">
              {openGaps.map((g: any) => (
                <li key={g.id}><span className="font-medium">{g.id}</span> <span className="text-muted-foreground">[{g.severity} · {g.dimension}]</span> — {g.summary}</li>
              ))}
            </ul>
          )}
        {resolved.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">ID</th><th className="py-1 pr-3">Was</th>
                  <th className="py-1 pr-3">Dimension</th><th className="py-1 pr-3">Gap → mechanism (reuse)</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((g: any) => (
                  <tr key={g.id} className="border-t align-top">
                    <td className="py-1 pr-3 font-medium">{g.id}</td>
                    <td className="py-1 pr-3">{g.severity}</td>
                    <td className="py-1 pr-3">{g.dimension}</td>
                    <td className="py-1 pr-3"><span className="text-slate-700">{g.summary}</span> <span className="text-emerald-700">→ {g.mechanism}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
