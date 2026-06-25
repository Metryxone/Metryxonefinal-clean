import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, AlertTriangle, Info, CheckCircle2, CircleSlash, Layers, Gauge, Building2, Award } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';


const BASE = '/api/admin/enterprise-certification';

/** null/undefined → "not measurable" (amber); 0 stays 0. */
function Metric({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-amber-600 italic text-xs">not measurable</span>;
  }
  return <span className="font-semibold tabular-nums">{String(value)}</span>;
}

function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-amber-600 italic text-xs">not measurable</span>;
  }
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
  const map: Record<string, string> = {
    healthy: 'bg-emerald-500', pass: 'bg-emerald-500',
    partial: 'bg-amber-500', dormant: 'bg-slate-400',
    gap: 'bg-red-500', fail: 'bg-red-500', gated: 'bg-indigo-400',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[s] ?? 'bg-slate-300'}`} title={status ?? 'unknown'} />;
}

export default function EnterpriseCertificationPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    overview: any | null;
    journey: any | null;
    outcomes: any | null;
    command: any | null;
    founder: any | null;
    certification: any | null;
  }>({
    queryKey: [`${BASE}/all`],
    queryFn: async () => {
      const probe = await fetch(`${BASE}/enabled`, { credentials: 'include' });
      if (!probe.ok) return { disabled: true, overview: null, journey: null, outcomes: null, command: null, founder: null, certification: null };
      const get = async (p: string): Promise<any | null> => {
        try {
          const r = await fetch(`${BASE}/${p}`, { credentials: 'include' });
          if (!r.ok) return null;
          return await r.json();
        } catch {
          return null;
        }
      };
      const [overview, journey, outcomes, command, founder, certification] = await Promise.all([
        get('overview'), get('journey'), get('outcomes'), get('command-center'), get('founder'), get('certification'),
      ]);
      return { disabled: false, overview, journey, outcomes, command, founder, certification };
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading enterprise certification…</div>;
  }
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Failed to load enterprise certification.
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="mr-1 h-3 w-3" /> Retry
        </Button>
      </div>
    );
  }

  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Enterprise Certification is disabled (flag <code>enterpriseCertification</code> OFF).
        </div>
      </div>
    );
  }

  const ov = data.overview;
  const cert = data.certification;
  const journey = data.journey;
  const outcomes = data.outcomes;
  const command = data.command;
  const founder = data.founder;

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Enterprise Certification</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only composition of the existing activation / certification / health / outcome engines.
              Structural ⟂ Activation ⟂ Adoption ⟂ Outcome-Confidence are SEPARATE axes — never composited.
              null = not measurable (never a fabricated 0).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Enterprise certification headline */}
      <Section title="Enterprise Certification Score" icon={<Award className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Structural readiness across all subsystems (verdict axis = structural only).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Verdict</div>
            <div className="mt-1"><VerdictBadge verdict={cert?.verdict ?? ov?.enterprise_certification?.verdict} /></div>
          </div>
          <Stat label="Structural" pct={cert?.enterprise_structural_pct ?? ov?.enterprise_certification?.structural_pct ?? null} hint="machinery present" />
          <Stat label="Subsystems PASS" value={cert?.summary?.pass ?? ov?.enterprise_certification?.subsystems_pass ?? null} hint={`of ${cert?.summary?.total ?? ov?.enterprise_certification?.subsystems_total ?? '—'}`} />
          <Stat label="Activated" value={cert?.summary?.activated ?? ov?.enterprise_certification?.activated ?? null} hint="flag on (separate axis)" />
          <Stat label="Adopted" value={cert?.summary?.adopted ?? ov?.enterprise_certification?.adopted ?? null} hint="live rows (separate axis)" />
          <Stat label="Tables present" value={cert?.structural_tables_present ?? null} hint={`of ${cert?.structural_tables_total ?? '—'}`} />
        </div>
        {cert?.target && <div className="mt-3 text-[11px] italic text-muted-foreground">{cert.target}</div>}
      </Section>

      {/* Recertification subsystems — 4 separate axes */}
      <Section title="Subsystem Re-Certification (15 subsystems · 4 axes)" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Each axis is independent: Structural (tables) · Activation (flag) · Adoption (live rows) · Outcome-Confidence.">
        {Array.isArray(cert?.subsystems) ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Subsystem</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Structural</th>
                  <th className="py-2 pr-3">Activation</th>
                  <th className="py-2 pr-3">Adoption</th>
                  <th className="py-2 pr-3">Outcome-Conf.</th>
                </tr>
              </thead>
              <tbody>
                {cert.subsystems.map((s: any) => (
                  <tr key={s.key} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{s.label}</td>
                    <td className="py-2 pr-3"><span className="inline-flex items-center gap-1.5"><StatusDot status={s.status} />{s.status}</span></td>
                    <td className="py-2 pr-3">{s.structural?.present}/{s.structural?.total}{Array.isArray(s.structural?.missing) && s.structural.missing.length > 0 && <span className="ml-1 text-red-500" title={s.structural.missing.join(', ')}>⚠</span>}</td>
                    <td className="py-2 pr-3">{s.activation?.always_on ? <span className="text-muted-foreground">always-on</span> : s.activation?.switched_on ? <span className="text-emerald-700">on</span> : <span className="text-slate-400">off</span>}</td>
                    <td className="py-2 pr-3"><Metric value={s.adoption?.live_rows} /></td>
                    <td className="py-2 pr-3">{s.outcome_confidence?.applies ? <Badge variant="outline" className="text-[10px]">{s.outcome_confidence.state}</Badge> : <span className="text-muted-foreground">n/a</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-amber-600 italic">Subsystem detail not measurable.</div>
        )}
        {cert?.axes_note && <div className="mt-3 border-t pt-2 text-[11px] italic text-muted-foreground">{cert.axes_note}</div>}
      </Section>

      {/* Unified journey */}
      <Section title="Unified Journey (candidate + employer)" icon={<Gauge className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="End-to-end validation. Broken links (structural) vs dependency gaps (flag OFF) reported separately.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-2 text-xs font-semibold">Candidate</div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Structural" pct={journey?.candidate?.completion?.structural_pct ?? null} />
              <Stat label="Activation live" value={journey?.candidate?.completion?.activation_live ?? null} hint="adoption axis" />
            </div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span>Employer</span><VerdictBadge verdict={journey?.employer?.verdict} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Coverage" pct={journey?.employer?.completion?.coverage_pct ?? null} />
              <Stat label="Real-data stages" value={journey?.employer?.completion?.real_data_stages ?? null} hint="adoption axis" />
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">Broken links (structural) · {Array.isArray(journey?.broken_links) ? journey.broken_links.length : '—'}</div>
            {Array.isArray(journey?.broken_links) && journey.broken_links.length > 0 ? (
              <ul className="space-y-1 text-[11px]">
                {journey.broken_links.map((b: any, i: number) => (<li key={i}><span className="font-medium">{b.surface}/{b.step}</span> — {b.reason}</li>))}
              </ul>
            ) : <div className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> none</div>}
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Dependency gaps (flag OFF) · {Array.isArray(journey?.dependency_gaps) ? journey.dependency_gaps.length : '—'}</div>
            {Array.isArray(journey?.dependency_gaps) && journey.dependency_gaps.length > 0 ? (
              <ul className="space-y-1 text-[11px]">
                {journey.dependency_gaps.map((b: any, i: number) => (<li key={i}><span className="font-medium">{b.surface}/{b.step}</span> — {b.reason}</li>))}
              </ul>
            ) : <div className="text-[11px] text-muted-foreground">none</div>}
          </div>
        </div>
      </Section>

      {/* Outcome readiness */}
      <Section title="Outcome Readiness (MX-102X)" icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Coverage ⟂ Confidence ⟂ accuracy. Accuracy abstains until a single type reaches k_min.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Outcome types" value={outcomes?.coverage?.type_count ?? null} />
          <Stat label="Types w/ coverage" value={outcomes?.coverage?.types_with_coverage ?? null} />
          <Stat label="Realized coverage" pct={outcomes?.coverage?.realized_coverage ?? null} />
          <div className="rounded-lg border bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Evidence-backed</div>
            <div className="mt-1">{outcomes?.confidence?.evidence_backed ? <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">yes</Badge> : <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">abstained</Badge>}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">k_min {outcomes?.confidence?.k_min ?? 30}</div>
          </div>
        </div>
        {outcomes?.note && <div className="mt-3 text-[11px] italic text-muted-foreground">{outcomes.note}</div>}
      </Section>

      {/* Command center — 12 health categories */}
      <Section title="Super Admin Command Center (12 health categories)" icon={<Gauge className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Structural (machinery) and Adoption (live data) are separate axes; null adoption = not measurable.">
        {Array.isArray(command?.categories) ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {command.categories.map((c: any) => (
              <div key={c.key} className="flex items-center justify-between rounded-lg border bg-white p-3">
                <div className="flex items-center gap-2">
                  <StatusDot status={c.status} />
                  <div>
                    <div className="text-xs font-medium">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.structural ? 'structural ✓' : 'structural ✗'} · {c.status}</div>
                  </div>
                </div>
                <div className="text-sm"><Metric value={c.adoption} /></div>
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-amber-600 italic">Category detail not measurable.</div>}
        {command?.summary && (
          <div className="mt-3 flex flex-wrap gap-4 border-t pt-2 text-[11px] text-muted-foreground">
            <span>Structural OK: <Metric value={command.summary.structural_ok} />/{command.summary.category_count}</span>
            <span>Structural %: <Pct value={command.summary.structural_pct} /></span>
            <span>Healthy adoption: <Metric value={command.summary.healthy_adoption} /> (separate axis)</span>
          </div>
        )}
      </Section>

      {/* Founder command center — 12 exec metrics */}
      <Section title="Founder Command Center (12 exec metrics)" icon={<Building2 className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Each metric tags its axis (structural / adoption / outcome). null = not measurable.">
        {Array.isArray(founder?.metrics) ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {founder.metrics.map((mm: any) => (
              <div key={mm.key} className="rounded-lg border bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{mm.label}</div>
                <div className="mt-1 text-lg">{mm.unit === 'pct' ? <Pct value={mm.value} /> : <Metric value={mm.value} />}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{mm.axis}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-amber-600 italic">Founder metrics not measurable.</div>}
      </Section>

      {ov?.disclaimer && (
        <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-[11px] text-muted-foreground">
          <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>{ov.disclaimer}</span>
        </div>
      )}
    </div>
  );
}
