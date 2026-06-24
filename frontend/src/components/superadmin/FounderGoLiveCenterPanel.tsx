import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Building2, AlertTriangle, Info, CircleSlash, TrendingDown, ListChecks, Rocket } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BRAND = { primary: '#344E86' };
const BASE = '/api/admin/go-live';

function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{value}%</span>;
}

function Stat({ label, value, pct, hint }: { label: string; value?: number | null; pct?: number | null; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg">
        {pct !== undefined
          ? <Pct value={pct} />
          : (value === null || value === undefined ? <span className="text-amber-600 italic text-xs">not measurable</span> : <span className="font-semibold tabular-nums">{String(value)}</span>)}
      </div>
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
        : v === 'NOT_MEASURABLE' ? 'bg-slate-100 text-slate-600 border-slate-300'
          : 'bg-red-100 text-red-800 border-red-300';
  return <Badge variant="outline" className={cls}>{v.replace('_', ' ')}</Badge>;
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = String(status ?? '').toUpperCase();
  const cls = s === 'FAIL' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300';
  return <Badge variant="outline" className={cls}>{s}</Badge>;
}

export default function FounderGoLiveCenterPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ disabled: boolean; founder: any | null }>({
    queryKey: [`${BASE}/founder-view`],
    queryFn: async () => {
      const probe = await fetch(`${BASE}/enabled`, { credentials: 'include' });
      if (!probe.ok) return { disabled: true, founder: null };
      try {
        const r = await fetch(`${BASE}/founder`, { credentials: 'include' });
        if (!r.ok) return { disabled: false, founder: null };
        return { disabled: false, founder: await r.json() };
      } catch { return { disabled: false, founder: null }; }
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading founder go-live center…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load founder go-live center.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Founder Go-Live Center is disabled (flag <code>goLiveCertification</code> OFF).
        </div>
      </div>
    );
  }

  const f = data.founder;
  const ex = f?.executive;
  const market = ex?.market;
  const gaps = Array.isArray(f?.top_gaps) ? f.top_gaps : [];
  const risks = Array.isArray(f?.top_risks) ? f.top_risks : [];

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Founder Go-Live Center</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Executive read-only view. Each percentage is its OWN separate axis; overall is go-live checklist completion (share of 9 questions = YES),
              NOT an average of the axes. null = not measurable (never a fabricated 0).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Certification level + recommendation */}
      <Section title="Go-Live Certification" icon={<Rocket className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="5-level certificate. The recommendation reflects the highest level whose gates are all met.">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Certification Level</div>
            <div className="mt-1 text-xl font-bold" style={{ color: BRAND.primary }}>{f?.certification_level?.label ?? '—'}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">level {f?.certification_level?.index ?? '—'} / 4</div>
          </div>
          <Stat label="Overall checklist" pct={ex?.overall_checklist_pct ?? null} hint="questions = YES (not an axis avg)" />
        </div>
        {f?.go_live_recommendation && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-[11px] text-indigo-900">{f.go_live_recommendation}</div>
        )}
      </Section>

      {/* Executive percentages — each its own axis */}
      <Section title="Executive Readiness (six separate axes)" icon={<ListChecks className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Structural ⟂ Activation ⟂ Adoption ⟂ Operational ⟂ Outcome ⟂ Market. Never composited into one score.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Structural" pct={ex?.structural_pct ?? null} />
          <Stat label="Activation" pct={ex?.activation_pct ?? null} />
          <Stat label="Adoption" pct={ex?.adoption_pct ?? null} />
          <Stat label="Operational" pct={ex?.operational_pct ?? null} />
          <Stat label="Outcome coverage" pct={ex?.outcome_coverage_pct ?? null} hint={ex?.outcome_confidence ? `confidence: ${ex.outcome_confidence.state}` : undefined} />
          <Stat label="Enterprise cert" pct={ex?.enterprise_certification_pct ?? null} />
          <div className="rounded-lg border bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Market</div>
            <div className="mt-1 text-sm">{market?.status === 'evidence_present' ? <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">evidence present</Badge> : <span className="text-amber-600 italic text-xs">not measurable</span>}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">no fabricated %</div>
          </div>
        </div>
        {ex?.note && <div className="mt-3 text-[11px] italic text-muted-foreground">{ex.note}</div>}
      </Section>

      {/* Scalability + security verdicts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Scalability</div>
          <div className="mt-1 flex items-center gap-2"><VerdictBadge verdict={f?.scalability?.verdict} /><Pct value={f?.scalability?.structural_pct ?? null} /></div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Security &amp; Governance</div>
          <div className="mt-1 flex items-center gap-2"><VerdictBadge verdict={f?.security_governance?.verdict} /><Pct value={f?.security_governance?.structural_pct ?? null} /></div>
        </div>
      </div>

      {/* Top gaps */}
      <Section title="Top Structural Gaps" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} subtitle="Subsystems with missing structural tables (FAIL first, then PARTIAL).">
        {gaps.length > 0 ? (
          <div className="space-y-2">
            {gaps.map((g: any) => (
              <div key={g.key} className="flex items-start justify-between gap-3 rounded-lg border bg-white p-3">
                <div>
                  <div className="text-xs font-medium">{g.label}</div>
                  {Array.isArray(g.missing_tables) && g.missing_tables.length > 0 && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">missing: {g.missing_tables.join(', ')}</div>
                  )}
                </div>
                <StatusBadge status={g.status} />
              </div>
            ))}
          </div>
        ) : <div className="text-[11px] text-emerald-700">No structural gaps — all subsystems structurally present.</div>}
      </Section>

      {/* Top risks */}
      <Section title="Top Risks" icon={<TrendingDown className="h-4 w-4 text-amber-500" />} subtitle="Wired-but-OFF subsystems (activation) + structural broken links.">
        {risks.length > 0 ? (
          <div className="space-y-2">
            {risks.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border bg-white p-3 text-[11px]">
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">{String(r.type ?? '').replace('_', ' ')}</Badge>
                <span>{r.label ? <span className="font-medium">{r.label} — </span> : null}{r.detail ? (typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)) : ''}</span>
              </div>
            ))}
          </div>
        ) : <div className="text-[11px] text-emerald-700">No activation or broken-link risks detected.</div>}
      </Section>

      {f?.disclaimer && (
        <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-[11px] text-muted-foreground">
          <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>{f.disclaimer}</span>
        </div>
      )}
    </div>
  );
}
