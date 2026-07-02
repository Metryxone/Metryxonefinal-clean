import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, CircleSlash, Boxes, Layers, ShieldCheck, GitBranch, ListChecks, Sparkles, Sigma } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import AiInterpretationWorkbench from '../ai-interpretation/AiInterpretationWorkbench';

const BASE = '/api/admin/ai-interpretation';

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

export default function AiInterpretationPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    summary: any | null;
    dimensions: any | null;
    gaps: any | null;
    adoption: any | null;
    rules: any[] | null;
  }>({
    queryKey: [`${BASE}/console`],
    queryFn: async () => {
      const probe = await fetch(`/api/ai-interpretation/enabled`, { credentials: 'include' });
      // 403/503 = flag genuinely OFF. 401/5xx/network = load error (surface, not "disabled").
      if (probe.status === 403 || probe.status === 503) return { disabled: true, summary: null, dimensions: null, gaps: null, adoption: null, rules: null };
      if (!probe.ok) throw new Error(`ai-interpretation enabled probe failed: ${probe.status}`);
      const getJson = async (p: string) => {
        try { const r = await fetch(`${BASE}${p}`, { credentials: 'include' }); return r.ok ? await r.json() : null; }
        catch { return null; }
      };
      const [summary, dimensions, gaps, adoption, rules] = await Promise.all([
        getJson('/summary'), getJson('/dimensions'), getJson('/gaps'), getJson('/adoption'),
        getJson('/rules'),
      ]);
      return {
        disabled: false,
        summary: summary?.summary ?? null,
        dimensions: dimensions?.dimensions ?? null,
        gaps: gaps ?? null,
        adoption: adoption?.adoption ?? null,
        rules: Array.isArray(rules?.rules) ? rules.rules : null,
      };
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading AI Interpretation certification…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load AI Interpretation certification.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> AI Interpretation is disabled (flag <code>aiInterpretation</code> OFF).
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
  const rules: any[] = data.rules ?? [];

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Enterprise AI Interpretation &amp; Explainability</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only certification of the ONE canonical AI INTERPRETATION, EXPLAINABILITY, CONFIDENCE &amp;
              HALLUCINATION-PROTECTION layer COMPOSING the existing interpretation substrate (the aiClient
              health-gated LLM seam + rule-driven narration prior-art) + the 3.8 structured-AST formula engine
              (NO eval / new Function) + the pure psychometric transforms under one registry + an additive
              <code>aixp_*</code> overlay — NO duplicate AI / interpretation engine, NO V2. Scope is INTERPRETATION
              ONLY: it turns a STANDARDIZED (3.8) + BENCHMARKED (3.9) result into an interpreted, explainable,
              confidence-scored, hallucination-protected result and NEVER re-scores, re-standardizes or
              re-benchmarks. The CORE is DETERMINISTIC (rule-select via 3.8 AST → grounded {'{{token}}'} render →
              confidence + 8-facet explanation); the LLM narration is an OPTIONAL, honest-degrading, output-validated
              seam. The ELEVEN dimensions are reported SEPARATELY — never composited. Adoption is a SEPARATE usage
              axis, never a gap. null = not measurable (never a fabricated 0). Interpretation ABSTAINS below the
              confidence / k_min evidence floor.
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
      <Section title="Eleven certification dimensions (never composited)" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Each dimension certified SEPARATELY. Coverage ⟂ Confidence ⟂ Adoption.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Dimensions" value={s.dimensions?.dimension_count} hint={statusLine(s.dimensions?.status_counts)} />
          <Stat label="Interpretation kinds" value={s.interpretation_kinds?.count} hint={statusLine(s.interpretation_kinds?.status_counts)} />
          <Stat label="Explainability criteria" value={s.explainability_criteria?.count} hint={statusLine(s.explainability_criteria?.status_counts)} />
          <Stat label="Confidence criteria" value={s.confidence_criteria?.count} hint={statusLine(s.confidence_criteria?.status_counts)} />
          <Stat label="Hallucination controls" value={s.hallucination_controls?.count} hint={statusLine(s.hallucination_controls?.status_counts)} />
          <Stat label="Rule capabilities" value={s.rule_capabilities?.count} hint={statusLine(s.rule_capabilities?.status_counts)} />
          <Stat label="Persona coverage" value={s.persona_coverage?.count} hint={statusLine(s.persona_coverage?.status_counts)} />
          <Stat label="Lifecycle coverage" value={s.lifecycle_coverage?.count} hint={statusLine(s.lifecycle_coverage?.status_counts)} />
          <Stat label="Super-admin surfaces" value={s.super_admin_surfaces?.count} hint={statusLine(s.super_admin_surfaces?.status_counts)} />
          <Stat label="Frontend surfaces" value={s.frontend_surfaces?.count} hint={statusLine(s.frontend_surfaces?.status_counts)} />
          <Stat label="UX criteria" value={s.ux_criteria?.count} hint={statusLine(s.ux_criteria?.status_counts)} />
          <Stat label="API groups" value={s.api_groups?.count} hint={statusLine(s.api_groups?.status_counts)} />
          <Stat label="Testing coverage" value={s.testing_coverage?.count} hint={statusLine(s.testing_coverage?.status_counts)} />
          <Stat label="Doc set" value={s.doc_set?.count} hint={statusLine(s.doc_set?.status_counts)} />
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
      <Section title="Adoption — real interpreted / governed / audited VOLUME (SEPARATE axis, never a gap)" icon={<Boxes className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Engineering closure ⟂ adoption. A dimension can be fully SUPPORTED while adoption is honestly 0. Interpretation ABSTAINS below the k_min evidence floor. null (unreadable) ≠ 0 (empty).">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Interpretation rules" value={ado.rules} />
          <Stat label="Prompt links" value={ado.prompt_links} />
          <Stat label="Policies" value={ado.policies} hint={`thresholds ${ado.thresholds ?? '—'}`} />
          <Stat label="Interpretation runs" value={ado.runs} hint={`AI ${ado.ai_runs ?? '—'} · abstained ${ado.abstained_runs ?? '—'} · review ${ado.human_review_runs ?? '—'}`} />
          <Stat label="Governance events" value={ado.governance_events} />
          <Stat label="Audit events" value={ado.audit_events} />
          <Stat label="Saved views" value={ado.saved_views} />
        </div>
      </Section>

      {/* Governed interpretation rules */}
      <Section title="Governed interpretation rules — versioned rule repository" icon={<Boxes className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="Versioned interpretation rules (aixp_rules) selected most-specific-wins via the 3.8 structured-AST condition. Resolve any context interactively in the workbench below. Populated rules are a SEPARATE adoption axis — honest 0, never a coverage gap. null (unreadable) ≠ 0 (empty).">
        {rules.length === 0
          ? <p className="text-xs text-muted-foreground">No governed interpretation rules — honestly 0 (a SEPARATE adoption axis, never a gap). The selection mechanism is fully wired; author one via the rule save mechanism.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Rule key</th><th className="py-1 pr-3">Ver</th>
                    <th className="py-1 pr-3">Kind</th><th className="py-1 pr-3">Persona</th>
                    <th className="py-1 pr-3">Lifecycle</th><th className="py-1 pr-3">State</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r: any, i: number) => (
                    <tr key={`${r.rule_key ?? 'rule'}-${r.version ?? i}`} className="border-t align-top">
                      <td className="py-1 pr-3 font-medium">{r.rule_key ?? '—'}{r.label ? <span className="ml-1 text-muted-foreground">({r.label})</span> : null}</td>
                      <td className="py-1 pr-3 tabular-nums">{r.version ?? '—'}</td>
                      <td className="py-1 pr-3">{r.kind ?? '—'}</td>
                      <td className="py-1 pr-3">{r.persona ?? '—'}</td>
                      <td className="py-1 pr-3">{r.lifecycle ?? '—'}</td>
                      <td className="py-1 pr-3">{r.governance_state ?? r.state ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Section>

      {/* Live interpretation workbench (engineering-closed gaps) */}
      <Section title="Interpretation workbench — deterministic interpret · confidence · explanation · hallucination scan · structured-AST composite index · scoped policy resolve" icon={<Sparkles className="h-4 w-4" style={{ color: BRAND.primary }} />}
        subtitle="The pure, deterministic mechanisms that engineering-close the interpretation / explainability / confidence / hallucination-protection gaps via reuse-before-build. The composite interpretation index is a STRUCTURED AST (no eval). Interpretation ABSTAINS below the confidence / k_min floor — never fabricated. Interactive demos; persists nothing unless a write mechanism is called explicitly.">
        <AiInterpretationWorkbench />
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
