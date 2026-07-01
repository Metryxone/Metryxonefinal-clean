import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, CircleSlash, Boxes, Layers, ShieldCheck, GitBranch, ListChecks, GitCompare, Sigma } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import BenchmarkIntelligenceWorkbench from '../benchmark-intelligence/BenchmarkIntelligenceWorkbench';

const BASE = '/api/admin/benchmark-intelligence';

/** null/undefined → "not measurable" (amber); 0 stays 0. null ≠ 0. */
function Metric({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{String(value)}</span>;
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

export default function BenchmarkIntelligencePanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    summary: any | null;
    dimensions: any | null;
    gaps: any | null;
    adoption: any | null;
    orgConfigs: any[] | null;
  }>({
    queryKey: [`${BASE}/console`],
    queryFn: async () => {
      const probe = await fetch(`/api/benchmark-intelligence/enabled`, { credentials: 'include' });
      // 403/503 = flag genuinely OFF. 401/5xx/network = load error (surface, not "disabled").
      if (probe.status === 403 || probe.status === 503) return { disabled: true, summary: null, dimensions: null, gaps: null, adoption: null, orgConfigs: null };
      if (!probe.ok) throw new Error(`benchmark-intelligence enabled probe failed: ${probe.status}`);
      const getJson = async (p: string) => {
        try { const r = await fetch(`${BASE}${p}`, { credentials: 'include' }); return r.ok ? await r.json() : null; }
        catch { return null; }
      };
      const [summary, dimensions, gaps, adoption, orgConfigs] = await Promise.all([
        getJson('/summary'), getJson('/dimensions'), getJson('/gaps'), getJson('/adoption'),
        getJson('/configs?scope=organization'),
      ]);
      return {
        disabled: false,
        summary: summary?.summary ?? null,
        dimensions: dimensions?.dimensions ?? null,
        gaps: gaps ?? null,
        adoption: adoption?.adoption ?? null,
        orgConfigs: Array.isArray(orgConfigs?.configs) ? orgConfigs.configs : null,
      };
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading Benchmark Intelligence certification…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load Benchmark Intelligence certification.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Benchmark Intelligence is disabled (flag <code>benchmarkIntelligence</code> OFF).
        </div>
      </div>
    );
  }

  const s = data.summary ?? {};
  const dims: any[] = data.dimensions?.dimensions ?? [];
  const repo = s.repository_alignment ?? {};
  const ado = data.adoption?.overlay ?? {};
  const resolved: any[] = data.gaps?.resolved_gaps ?? [];
  const openGaps: any[] = data.gaps?.gaps ?? [];
  const gapTotal = data.gaps?.gap_total ?? 0;
  const orgConfigs: any[] = data.orgConfigs ?? [];

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <GitCompare className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Enterprise Benchmark Intelligence</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only certification of the ONE canonical BENCHMARK &amp; COMPARISON layer COMPOSING the existing
              benchmark substrate (peer / cohort / role / industry / historical reference groups; pure z → percentile
              transforms) under one registry + the 3.8 structured-AST formula engine (NO eval / new Function) for the
              composite benchmark index + an additive <code>abmk_*</code> overlay — NO duplicate benchmark engine, NO
              V2. Scope is BENCHMARK &amp; COMPARISON ONLY: it turns a STANDARDIZED result (3.9 builds on 3.8) into
              cohort-relative z-scores, percentiles, deltas, quartiles, trends and multi-group comparisons and NEVER
              re-scores, re-standardizes or re-validates the instrument. The NINE dimensions are reported SEPARATELY —
              never composited. Adoption is a SEPARATE usage axis, never a gap. null = not measurable (never a
              fabricated 0). Benchmarking ABSTAINS below k_min real members in the reference group.
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

      {/* Certification readiness */}
      {s.ready_for_certification && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2">
            <Sigma className="h-4 w-4" style={{ color: BRAND.primary }} />
            <span className="text-sm font-semibold">Ready for certification?</span>
            <Badge variant="outline" className={s.ready_for_certification.ready ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>{s.ready_for_certification.verdict}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{s.ready_for_certification.note}</p>
        </div>
      )}

      {/* Dimension roll-up */}
      <Section title="Nine certification dimensions (never composited)" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Each dimension certified SEPARATELY. Coverage ⟂ Confidence ⟂ Adoption.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Dimensions" value={s.dimensions?.dimension_count} hint={statusLine(s.dimensions?.status_counts)} />
          <Stat label="Benchmark types" value={s.benchmark_types?.count} hint={statusLine(s.benchmark_types?.status_counts)} />
          <Stat label="Comparison dimensions" value={s.comparison_dimensions?.count} hint={statusLine(s.comparison_dimensions?.status_counts)} />
          <Stat label="Time modes" value={s.time_modes?.count} hint={statusLine(s.time_modes?.status_counts)} />
          <Stat label="Benchmark config scopes" value={s.benchmark_config?.count} hint={statusLine(s.benchmark_config?.status_counts)} />
          <Stat label="Governance states" value={s.governance_states?.count} hint={statusLine(s.governance_states?.status_counts)} />
          <Stat label="Super-admin surfaces" value={s.super_admin_surfaces?.count} hint={statusLine(s.super_admin_surfaces?.status_counts)} />
          <Stat label="Frontend surfaces" value={s.frontend_surfaces?.count} hint={statusLine(s.frontend_surfaces?.status_counts)} />
          <Stat label="UX criteria" value={s.ux_criteria?.count} hint={statusLine(s.ux_criteria?.status_counts)} />
          <Stat label="API groups" value={s.api_groups?.count} hint={statusLine(s.api_groups?.status_counts)} />
          <Stat label="Traceability links" value={s.traceability?.link_count} hint={statusLine(s.traceability?.trace_status_counts)} />
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
      <Section title="Adoption — real benchmarked / governed / audited VOLUME (SEPARATE axis, never a gap)" icon={<Boxes className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. Benchmarking ABSTAINS below k_min real members. null (unreadable) ≠ 0 (empty).">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Reference groups" value={ado.groups} />
          <Stat label="Scoped configs" value={ado.configs} />
          <Stat label="Benchmark results" value={ado.results} hint={`suppressed ${ado.suppressed_results ?? '—'} · abstained ${ado.abstained_results ?? '—'}`} />
          <Stat label="Governance events" value={ado.governance_events} />
          <Stat label="Audit events" value={ado.audit_events} />
          <Stat label="Saved views" value={ado.saved_views} />
        </div>
      </Section>

      {/* Organization overrides (scoped configs) */}
      <Section title="Organization overrides — organization-scoped benchmark configs" icon={<Boxes className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Organization-scoped config rows (abmk_configs, scope=organization) that override the default reference group / composite index via most-specific-wins resolution. Resolve any context interactively in the workbench below. Populated org configs are a SEPARATE adoption axis — honest 0, never a coverage gap. null (unreadable) ≠ 0 (empty).">
        {orgConfigs.length === 0
          ? <p className="text-xs text-muted-foreground">No organization-scoped configs — honestly 0 (a SEPARATE adoption axis, never a gap). The resolution mechanism is fully wired; author one via the config save mechanism.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Config key</th><th className="py-1 pr-3">Ver</th>
                    <th className="py-1 pr-3">Scope ref</th><th className="py-1 pr-3">Benchmark type</th>
                    <th className="py-1 pr-3">Group</th><th className="py-1 pr-3">Formula</th>
                  </tr>
                </thead>
                <tbody>
                  {orgConfigs.map((c: any, i: number) => (
                    <tr key={`${c.config_key ?? 'cfg'}-${c.version ?? i}`} className="border-t align-top">
                      <td className="py-1 pr-3 font-medium">{c.config_key ?? '—'}{c.label ? <span className="ml-1 text-muted-foreground">({c.label})</span> : null}</td>
                      <td className="py-1 pr-3 tabular-nums">{c.version ?? '—'}</td>
                      <td className="py-1 pr-3">{c.scope_ref ?? '—'}</td>
                      <td className="py-1 pr-3">{c.benchmark_type ?? '—'}</td>
                      <td className="py-1 pr-3">{c.group_key ?? '—'}</td>
                      <td className="py-1 pr-3">{c.formula_key ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Section>

      {/* Live benchmark workbench (engineering-closed gaps) */}
      <Section title="Benchmark workbench — reference stats · comparison (z/percentile/delta/quartile) · percentile rank · multi-group · trend · distribution · structured-AST composite index · scoped resolve" icon={<GitCompare className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="The pure, deterministic mechanisms that engineering-close the benchmark & comparison gaps via reuse-before-build. The composite benchmark index is a STRUCTURED AST (no eval). Benchmarking ABSTAINS below k_min real members — never fabricated. Interactive demos; persists nothing unless a write mechanism is called explicitly.">
        <BenchmarkIntelligenceWorkbench />
      </Section>

      {/* Gaps */}
      <Section title={`Gaps — ${gapTotal} OPEN · ${resolved.length} RESOLVED (engineering-closed via reuse)`} icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="True engineering gaps closed via reuse-before-build. Remaining OPEN gaps are Future/Medium deferrals; adoption is never a gap.">
        {openGaps.length === 0
          ? <p className="text-xs text-emerald-700">No open engineering gaps.</p>
          : (
            <ul className="mb-3 space-y-1 text-xs">
              {openGaps.map((g: any) => (
                <li key={g.id}><span className="font-medium">{g.id}</span> <span className="text-muted-foreground">[{g.severity} · {g.axis}]</span> — {g.title}: {g.detail}</li>
              ))}
            </ul>
          )}
        {resolved.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">ID</th><th className="py-1 pr-3">Was</th>
                  <th className="py-1 pr-3">Axis</th><th className="py-1 pr-3">Title → resolution (reuse)</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((g: any) => (
                  <tr key={g.id} className="border-t align-top">
                    <td className="py-1 pr-3 font-medium">{g.id}</td>
                    <td className="py-1 pr-3">{g.severity}</td>
                    <td className="py-1 pr-3">{g.axis}</td>
                    <td className="py-1 pr-3"><span className="text-slate-700">{g.title}</span> <span className="text-emerald-700">→ {g.resolution}</span></td>
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
