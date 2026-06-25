import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, AlertTriangle, Info, CheckCircle2, CircleSlash, Layers, Gauge, Building2, Award, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BRAND = { primary: '#344E86' };
const BASE = '/api/admin/platform-completion';

/** null/undefined → "not measurable" (amber); 0 stays 0. */
function Metric({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{String(value)}</span>;
}
function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{value}%</span>;
}
function Stat({ label, value, pct, hint }: { label: string; value?: number | null; pct?: number | null; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg">{pct !== undefined ? <Pct value={pct} /> : <Metric value={value} />}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
function Section({ title, icon, children, subtitle }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-slate-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold" style={{ color: BRAND.primary }}>{title}</h3>
      </div>
      {subtitle && <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}
function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  const v = String(verdict).toUpperCase();
  const cls =
    v === 'PASS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : v === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-red-100 text-red-800 border-red-300';
  return <Badge variant="outline" className={cls}>{v}</Badge>;
}
function StatusDot({ status }: { status?: string | null }) {
  const s = String(status ?? '').toLowerCase();
  const map: Record<string, string> = { pass: 'bg-emerald-500', partial: 'bg-amber-500', fail: 'bg-red-500' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[s] ?? 'bg-slate-300'}`} title={status ?? 'unknown'} />;
}
function sevColor(sev: string) {
  return sev === 'high' ? 'text-red-700' : sev === 'medium' ? 'text-amber-700' : 'text-slate-600';
}

export default function PlatformCompletionPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ disabled: boolean; founder: any | null }>({
    queryKey: [`${BASE}/founder-view`],
    queryFn: async () => {
      const probe = await fetch(`${BASE}/enabled`, { credentials: 'include' });
      // 403/503 = flag genuinely OFF (disabled). 401/5xx/network = load error (let it surface, not "disabled").
      if (probe.status === 403 || probe.status === 503) return { disabled: true, founder: null };
      if (!probe.ok) throw new Error(`platform-completion enabled probe failed: ${probe.status}`);
      try {
        const r = await fetch(`${BASE}/founder`, { credentials: 'include' });
        if (!r.ok) return { disabled: false, founder: null };
        return { disabled: false, founder: await r.json() };
      } catch {
        return { disabled: false, founder: null };
      }
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading platform completion certification…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load platform completion certification.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Platform Completion is disabled (flag <code>platformCompletion</code> OFF).
        </div>
      </div>
    );
  }

  const f = data.founder;
  const completion = f?.completion;
  const areas = completion?.areas ?? {};
  const dim = f?.dimensions ?? {};
  const mods = f?.modules;
  const cp = f?.content_probe ?? {};
  const risks: any[] = f?.top_risks ?? [];
  const rec = f?.recommendation ?? {};
  const oc = dim?.outcome_confidence ?? {};

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Award className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Platform Completion Certification</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only composition of every existing certification / activation / health composer + new content probes.
              The FIVE dimensions (Implementation ⟂ Structural ⟂ Activation ⟂ Adoption ⟂ Outcome-Confidence) are SEPARATE —
              never composited. null = not measurable (never a fabricated 0).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {f == null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-700">
          Certification data not measurable right now (composer degraded). Try Refresh.
        </div>
      )}

      {f != null && (
        <>
          {/* Overall completion breakdown */}
          <Section title="Overall Completion (5 SEPARATE areas)" icon={<Gauge className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Each area is a separate honest %. Overall = mean of the measurable areas — a completion measure, NOT a blend of the five dimensions.">
            <div className="mb-3 rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall completion</div>
              <div className="mt-1 text-2xl"><Pct value={completion?.overall_completion_pct} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Engineering" pct={areas.engineering_pct ?? null} hint="engines built & responsive" />
              <Stat label="Content" pct={areas.content_pct ?? null} hint="genome / questions / Role-DNA" />
              <Stat label="Integration" pct={areas.integration_pct ?? null} hint="cross-module journeys" />
              <Stat label="Governance" pct={areas.governance_pct ?? null} hint="security & governance" />
              <Stat label="Dashboard" pct={areas.dashboard_pct ?? null} hint="command-center structural" />
            </div>
          </Section>

          {/* Five dimensions */}
          <Section title="The Five Certification Dimensions (NEVER composited)" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Reported side-by-side. Coverage ⟂ Confidence kept separate.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="1 · Implementation" pct={dim?.implementation?.pct ?? null} hint="overall (incl. content)" />
              <Stat label="2 · Structural" pct={dim?.structural?.pct ?? null} hint="table machinery present" />
              <Stat label="3 · Activation" pct={dim?.activation?.pct ?? null} hint={`${dim?.activation?.activated_subsystems ?? '—'}/${dim?.activation?.subsystems_total ?? '—'} subsystems`} />
              <Stat label="4 · Adoption" pct={dim?.adoption?.pct ?? null} hint={`${dim?.adoption?.adopted_subsystems ?? '—'}/${dim?.adoption?.subsystems_total ?? '—'} subsystems`} />
              <div className="rounded-lg border bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">5 · Outcome-Confidence</div>
                <div className="mt-1"><Badge variant="outline" className={oc?.state === 'calibrated' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>{oc?.state ?? 'n/a'}</Badge></div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  coverage {oc?.realized_coverage == null ? <span className="italic text-amber-600">n/m</span> : `${oc.realized_coverage}%`}
                  {' · '}k_min {oc?.k_min == null ? <span className="italic text-amber-600">n/m</span> : oc.k_min}
                </div>
              </div>
            </div>
          </Section>

          {/* Per-module verdicts */}
          <Section title={`Per-Module Certification (${mods?.summary?.pass ?? '—'} PASS · ${mods?.summary?.partial ?? '—'} PARTIAL · ${mods?.summary?.fail ?? '—'} FAIL)`} icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Structural verdict (composed) lowered by honest content/adoption/outcome caps — never raised. Demo data excluded.">
            {Array.isArray(mods?.modules) ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Module</th>
                      <th className="py-2 pr-3">Verdict</th>
                      <th className="py-2 pr-3">Structural</th>
                      <th className="py-2 pr-3">Capped by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mods.modules.map((m: any) => (
                      <tr key={m.key} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{m.label}</td>
                        <td className="py-2 pr-3"><span className="inline-flex items-center gap-1.5"><StatusDot status={m.status} />{m.status}</span></td>
                        <td className="py-2 pr-3">{m.structural}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{Array.isArray(m.capped_by) ? m.capped_by.join('; ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-xs text-amber-600 italic">Module detail not measurable.</div>}
          </Section>

          {/* Content probe */}
          <Section title="Content & Structure Probe" icon={<FileText className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Genuinely-new read-only measurement of content reality. Sparse cells are honest authoring gaps, never fabricated.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Genome competencies" value={cp?.genome_total ?? null} />
              <Stat label="Attribute completeness" pct={cp?.attribute_completeness_pct ?? null} />
              <Stat label="Indicator coverage" pct={cp?.indicators?.coverage_pct ?? null} hint={`${cp?.indicators?.competencies_with_indicator ?? '—'}/${cp?.genome_total ?? '—'}`} />
              <Stat label="Question coverage (precise)" pct={cp?.question_density?.precise_coverage_pct ?? null} hint={`${cp?.question_density?.precise_competencies_covered ?? '—'}/${cp?.genome_total ?? '—'}`} />
              <Stat label="Template bank approved" value={cp?.question_density?.template_bank_approved ?? null} hint={`of ${cp?.question_density?.template_bank_total ?? '—'} drafts`} />
              <Stat label="Role-DNA coverage" pct={cp?.role_dna?.genome_coverage_pct ?? null} hint={`${cp?.role_dna?.roles_with_dna ?? '—'} roles · ${cp?.role_dna?.requirements ?? '—'} reqs`} />
              <Stat label="O*NET roles" value={cp?.onet_reference?.roles ?? null} hint={`${cp?.onet_reference?.role_competency_links ?? '—'} links`} />
              <Stat label="Content completion" pct={cp?.content_completion_pct ?? null} hint="conservative mean" />
            </div>
            {Array.isArray(cp?.genome_attributes) && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-1.5 pr-3">Attribute</th><th className="py-1.5 pr-3">Present</th><th className="py-1.5 pr-3">%</th></tr></thead>
                  <tbody>
                    {cp.genome_attributes.map((a: any) => (
                      <tr key={a.key} className="border-b last:border-0"><td className="py-1.5 pr-3">{a.key}</td><td className="py-1.5 pr-3">{a.present}/{a.total}</td><td className="py-1.5 pr-3"><Pct value={a.pct} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Top risks */}
          <Section title="Top Risks" icon={<AlertTriangle className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Honest findings — content authoring gaps and adoption/outcome maturity, not structural defects.">
            {risks.length === 0 ? (
              <div className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> No material risks surfaced.</div>
            ) : (
              <ul className="space-y-2 text-xs">
                {risks.map((r, i) => (
                  <li key={i} className="rounded-lg border bg-white p-2.5">
                    <span className={`mr-2 text-[10px] font-bold uppercase ${sevColor(r.severity)}`}>{r.severity}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">[{r.area}]</span>
                    <div className="mt-1">{r.risk}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Recommendation */}
          <Section title="Go-Live Recommendation" icon={<Building2 className="h-4 w-4" style={{ color: BRAND.primary }} />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Certification level</div>
                <div className="mt-1 text-sm font-semibold">{rec?.certification_level?.label ?? rec?.certification_level ?? '—'}</div>
              </div>
              <Stat label="Checklist completion" pct={rec?.checklist_pct ?? null} />
              <div className="rounded-lg border bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Verdict</div>
                <div className="mt-1"><VerdictBadge verdict={mods?.summary?.fail > 0 ? 'FAIL' : (mods?.summary?.partial > 0 ? 'PARTIAL' : 'PASS')} /></div>
              </div>
            </div>
            {rec?.go_live_recommendation && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-800">{rec.go_live_recommendation}</div>}
            {rec?.platform_completion_note && <div className="mt-2 text-[11px] italic text-muted-foreground">{rec.platform_completion_note}</div>}
          </Section>

          {f?.disclaimer && (
            <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-[11px] text-muted-foreground">
              <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              <span>{f.disclaimer}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
