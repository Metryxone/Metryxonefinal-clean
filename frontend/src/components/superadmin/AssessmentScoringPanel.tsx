import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, CircleSlash, Boxes, Layers, ShieldCheck, GitBranch, ListChecks, Calculator, Sigma } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import ScoringWorkbench from '../scoring/ScoringWorkbench';

const BASE = '/api/admin/assessment-scoring';

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

export default function AssessmentScoringPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    summary: any | null;
    dimensions: any | null;
    gaps: any | null;
    adoption: any | null;
  }>({
    queryKey: [`${BASE}/console`],
    queryFn: async () => {
      const probe = await fetch(`/api/assessment-scoring/enabled`, { credentials: 'include' });
      // 403/503 = flag genuinely OFF. 401/5xx/network = load error (surface, not "disabled").
      if (probe.status === 403 || probe.status === 503) return { disabled: true, summary: null, dimensions: null, gaps: null, adoption: null };
      if (!probe.ok) throw new Error(`assessment-scoring enabled probe failed: ${probe.status}`);
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

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading Assessment Measurement & Scoring certification…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load Assessment Measurement & Scoring certification.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Assessment Measurement & Scoring is disabled (flag <code>assessmentScoring</code> OFF).
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
          <Calculator className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Assessment Measurement & Scoring</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only certification of the ONE canonical MEASUREMENT & SCORING engine COMPOSING the existing scoring
              services (competency-scoring · dimension-scoring-engine · competency-ei-scoring-shared · caf/scoring-engine ·
              mei/employability/contextual/omega-x scoring) under one registry + an additive <code>as_*</code> overlay —
              NO duplicate scoring engine, NO V2. Scope is scoring models · scoring rules · response processing ·
              measurement types · scoring configuration · validation · frontend · APIs: it transforms responses into
              MEASURABLE scores/indicators and does NOT run psychometric item analysis, reliability, validity, norms,
              standardization, benchmarking, AI-interpretation, or reports (Phase 3.6+). The SEVEN dimensions
              (measurement_engine · scoring_engine · formula_engine · rule_engine · validation · apis · frontend) are
              reported SEPARATELY — never composited. Adoption is a SEPARATE usage axis, never a gap. null = not
              measurable (never a fabricated 0).
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

      {/* Phase 3.6 readiness */}
      {s.ready_for_phase_3_6 && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2">
            <Sigma className="h-4 w-4" style={{ color: BRAND.primary }} />
            <span className="text-sm font-semibold">Ready for Phase 3.6 (Psychometrics & Item Analysis)?</span>
            <Badge variant="outline" className={s.ready_for_phase_3_6.ready ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>{s.ready_for_phase_3_6.verdict}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{s.ready_for_phase_3_6.note}</p>
        </div>
      )}

      {/* Dimension roll-up */}
      <Section title="Seven certification dimensions (never composited)" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Each dimension certified SEPARATELY. Coverage ⟂ Confidence ⟂ Adoption.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Dimensions" value={s.dimensions?.dimension_count} hint={statusLine(s.dimensions?.status_counts)} />
          <Stat label="Scoring models" value={s.scoring_models?.count} hint={statusLine(s.scoring_models?.status_counts)} />
          <Stat label="Response processing" value={s.response_processing?.count} hint={statusLine(s.response_processing?.status_counts)} />
          <Stat label="Measurement types" value={s.measurement_types?.count} hint={statusLine(s.measurement_types?.status_counts)} />
          <Stat label="Scoring rules" value={s.scoring_rules?.count} hint={statusLine(s.scoring_rules?.status_counts)} />
          <Stat label="Scoring config" value={s.scoring_config?.count} hint={statusLine(s.scoring_config?.status_counts)} />
          <Stat label="Validation checks" value={s.validation_checks?.count} hint={statusLine(s.validation_checks?.status_counts)} />
          <Stat label="Mapping steps" value={s.mapping?.step_count} hint={statusLine(s.mapping?.mapping_status_counts)} />
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
      <Section title="Adoption — real scored-assessment volume (SEPARATE axis, never a gap)" icon={<Boxes className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. null (unreadable) ≠ 0 (empty).">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Scoring configs" value={ado.configs?.configs} hint={`active ${ado.configs?.active ?? '—'} · formulas ${ado.configs?.formulas ?? '—'} · rules ${ado.configs?.rules ?? '—'}`} />
          <Stat label="Scores" value={ado.scores?.scores} hint={`subjects ${ado.scores?.subjects ?? '—'} · models ${ado.scores?.models_used ?? '—'}`} />
          <Stat label="Measurements" value={ado.measurements?.measurements} hint={`subjects ${ado.measurements?.subjects ?? '—'} · types ${ado.measurements?.types_used ?? '—'}`} />
          <Stat label="Validations" value={ado.validations?.validations} hint={`passed ${ado.validations?.passed ?? '—'} · failed ${ado.validations?.failed ?? '—'}`} />
        </div>
      </Section>

      {/* Live scoring workbench (engineering-closed GAP-AS-1..) */}
      <Section title="Scoring workbench — compute · formula · rule · configuration · responses" icon={<Calculator className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="The pure, deterministic scoring mechanisms that engineering-close the scoring gaps via reuse-before-build. Structured formula AST — NO eval / new Function. Interactive demos with sample content; persists nothing unless a write mechanism is called explicitly.">
        <ScoringWorkbench />
      </Section>

      {/* Gaps */}
      <Section title={`Gaps — ${gapTotal} OPEN · ${resolved.length} RESOLVED (engineering-closed via reuse)`} icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="True engineering gaps closed via reuse-before-build. Remaining OPEN gaps are Future/Low deferrals; adoption is never a gap.">
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
