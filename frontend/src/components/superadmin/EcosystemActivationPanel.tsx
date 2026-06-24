import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Gauge, AlertTriangle, Info, CheckCircle2, CircleSlash } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BRAND = { primary: '#344E86' };
const BASE = '/api/admin/ecosystem-activation';

type Provenance = { tables: string[]; notes?: string[] };
type View<T = any> = {
  view: string;
  available: boolean;
  provenance: Provenance;
  data: T;
  disclaimer?: string;
  error?: string;
};

/** Render a metric value honestly: null → "not measurable" (amber), 0 stays 0. */
function Metric({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-amber-600 italic text-xs">not measurable</span>;
  }
  return <span className="font-semibold tabular-nums">{String(value)}</span>;
}

/** A percentage value: null → "not measurable", number → "x%". */
function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-amber-600 italic text-xs">not measurable</span>;
  }
  return <span className="font-semibold tabular-nums">{value}%</span>;
}

function Stat({ label, value, pct }: { label: string; value?: number | null; pct?: number | null }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg">
        {pct !== undefined ? <Pct value={pct} /> : <Metric value={value} />}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  subtitle,
}: {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
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

function ProvenanceNote({ provenance }: { provenance?: Provenance }) {
  if (!provenance) return null;
  return (
    <div className="mt-3 space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
      {provenance.notes?.map((n, i) => (
        <div key={i} className="flex items-start gap-1">
          <Info className="mt-[1px] h-3 w-3 shrink-0" />
          <span>{n}</span>
        </div>
      ))}
      {provenance.tables?.length ? (
        <div className="italic">Source: {provenance.tables.join(', ')}</div>
      ) : null}
    </div>
  );
}

export default function EcosystemActivationPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    funnel: View | null;
    careerBuilder: View | null;
    passport: View | null;
    employability: View | null;
    analytics: View | null;
    certification: View | null;
  }>({
    queryKey: [`${BASE}/all`],
    queryFn: async () => {
      const probe = await fetch(`${BASE}/enabled`, { credentials: 'include' });
      if (!probe.ok) return { disabled: true, funnel: null, careerBuilder: null, passport: null, employability: null, analytics: null, certification: null };
      const get = async (p: string): Promise<View | null> => {
        try {
          const r = await fetch(`${BASE}/${p}`, { credentials: 'include' });
          if (!r.ok) return null;
          return (await r.json()) as View;
        } catch {
          return null;
        }
      };
      const [funnel, careerBuilder, passport, employability, analytics, certification] = await Promise.all([
        get('journey-funnel'),
        get('career-builder'),
        get('passport'),
        get('employability'),
        get('journey-analytics'),
        get('certification'),
      ]);
      return { disabled: false, funnel, careerBuilder, passport, employability, analytics, certification };
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading ecosystem activation…</div>;
  }
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Failed to load ecosystem activation.
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="mr-1 h-3 w-3" /> Retry
        </Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Candidate &amp; Career Ecosystem Activation is disabled (flag <code>ecosystemActivation</code> OFF).
      </div>
    );
  }

  const founder = (data.funnel?.data as any)?.founder ?? {};
  const funnelStages = (data.funnel?.data as any)?.funnel ?? [];
  const dataVolume = (data.funnel?.data as any)?.data_volume ?? {};
  const cb = (data.careerBuilder?.data as any) ?? {};
  const pp = (data.passport?.data as any) ?? {};
  const emp = (data.employability?.data as any) ?? {};
  const transitions = (data.analytics?.data as any)?.transitions ?? [];
  const cert = (data.certification?.data as any) ?? {};

  const verdictColor =
    cert.verdict === 'PASS' ? 'bg-emerald-600' : cert.verdict === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-600';

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-base font-semibold" style={{ color: BRAND.primary }}>
              Candidate &amp; Career Ecosystem
            </h2>
            <p className="text-xs text-muted-foreground">
              Read-only journey activation — Structural (machinery) and Activation (live data) shown separately.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Certification banner — Structural ⟂ Activation */}
      {data.certification && (
        <div className="rounded-xl border p-4" style={{ background: '#f8fafc' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge className={`${verdictColor} hover:${verdictColor}`}>{cert.verdict ?? '—'}</Badge>
              <span className="text-xs text-muted-foreground">Structural verdict (machinery presence)</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Structural readiness</span>{' '}
                <Pct value={cert.structural_readiness_pct} />{' '}
                <span className="text-xs text-muted-foreground">
                  ({cert.structural_tables_present}/{cert.structural_tables_total} tables)
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Activation</span>{' '}
                <span className="font-semibold tabular-nums">
                  {cert.readiness_score?.activation_steps_live}/{cert.readiness_score?.activation_steps_total}
                </span>{' '}
                <span className="text-xs text-muted-foreground">steps live</span>
              </div>
            </div>
          </div>
          {cert.activation_note && (
            <p className="mt-2 text-xs text-muted-foreground">{cert.activation_note}</p>
          )}
        </div>
      )}

      {/* Founder counts */}
      <Section title="Founder Counts" icon={<Gauge className="h-4 w-4 text-slate-500" />}
        subtitle="Registered candidates (excl. super-admin + demo) reaching each journey stage.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Registered" value={founder.registered_candidates} />
          <Stat label="Assessed" value={founder.assessed_candidates} />
          <Stat label="Employability" value={founder.employability_profiles} />
          <Stat label="Career Builder" value={founder.career_builder_users} />
          <Stat label="Passport" value={founder.career_passport_users} />
          <Stat label="Assessment Completion" pct={founder.assessment_completion_pct} />
          <Stat label="Journey Completion" pct={founder.journey_completion_pct} />
        </div>
        <ProvenanceNote provenance={data.funnel?.provenance} />
      </Section>

      {/* Candidate Readiness (funnel) + Journey Analytics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Candidate Readiness Funnel" icon={<CheckCircle2 className="h-4 w-4 text-slate-500" />}>
          <div className="space-y-2">
            {funnelStages.map((s: any) => (
              <div key={s.key} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
                <span>{s.label}</span>
                <div className="flex items-center gap-3">
                  <Metric value={s.count} />
                  {s.conversion_pct !== null && s.conversion_pct !== undefined && (
                    <span className="text-xs text-muted-foreground">({s.conversion_pct}%)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Journey Analytics" icon={<CheckCircle2 className="h-4 w-4 text-slate-500" />}
          subtitle="Per-step conversion and drop-off (null when denominator stage is empty).">
          <div className="space-y-2">
            {transitions.map((t: any, i: number) => (
              <div key={i} className="rounded border bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t.from} → {t.to}</span>
                  <span className="text-xs">
                    conv <Pct value={t.conversion_pct} /> · drop{' '}
                    {t.dropoff_pct === null || t.dropoff_pct === undefined
                      ? <span className="text-amber-600 italic">n/a</span>
                      : <span className="tabular-nums">{t.dropoff_pct}%</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Career Builder + Employability */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Career Builder Activation" icon={<Gauge className="h-4 w-4 text-slate-500" />}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Activation Runs" value={cb.activation_runs} />
            <Stat label="Distinct Users" value={cb.distinct_users} />
            <Stat label="Role DNA Graph (roles)" value={cb.role_dna_graph_roles} />
            <Stat label="Career Paths" value={cb.career_paths} />
            <Stat label="Role Recommendations" value={cb.role_recommendations} />
            <Stat label="Skill Gaps" value={cb.skill_gaps} />
            <Stat label="Development Recs" value={cb.development_recs} />
            <Stat label="Role Readiness Rows" value={cb.role_readiness_rows} />
          </div>
          {Array.isArray(cb.readiness_bands) && cb.readiness_bands.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cb.readiness_bands.map((b: any) => (
                <Badge key={b.band} variant="outline">{b.band}: {b.count}</Badge>
              ))}
            </div>
          )}
          <ProvenanceNote provenance={data.careerBuilder?.provenance} />
        </Section>

        <Section title="Employability Activation" icon={<Gauge className="h-4 w-4 text-slate-500" />}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="FRI Readiness Rows" value={emp.fri_readiness_rows} />
            <Stat label="FRI Distinct Users" value={emp.fri_distinct_users} />
            <Stat label="Career Readiness Profiles" value={emp.career_readiness_profiles} />
            <Stat label="LBI Scores" value={emp.lbi_scores} />
          </div>
          {Array.isArray(emp.fri_bands) && emp.fri_bands.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {emp.fri_bands.map((b: any) => (
                <Badge key={b.band} variant="outline">{b.band}: {b.count}</Badge>
              ))}
            </div>
          )}
          <ProvenanceNote provenance={data.employability?.provenance} />
        </Section>
      </div>

      {/* Passport */}
      <Section title="Career Passport Activation" icon={<Gauge className="h-4 w-4 text-slate-500" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Foundation (career_passport_snapshots)</div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Snapshots" value={pp.foundation?.snapshots} />
              <Stat label="Distinct Subjects" value={pp.foundation?.distinct_subjects} />
              <Stat label="Competency Section" value={pp.foundation?.sections?.competency} />
              <Stat label="Employability Section" value={pp.foundation?.sections?.employability} />
              <Stat label="Career Section" value={pp.foundation?.sections?.career} />
              <Stat label="Readiness Section" value={pp.foundation?.sections?.readiness} />
              <Stat label="Achievements" value={pp.foundation?.sections?.achievements_total} />
              <Stat label="Journey Events" value={pp.foundation?.sections?.journey_events_total} />
              <Stat label="Avg Coverage" pct={pp.foundation?.sections?.avg_coverage_pct} />
              <Stat label="Measurable Subjects" value={pp.foundation?.sections?.measurable_subjects} />
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">careerPassport (cp_*)</div>
            {pp.cp_passport?.present ? (
              <Stat label="Passports" value={pp.cp_passport?.passports} />
            ) : (
              <div className="flex items-center gap-2 rounded border bg-white p-3 text-xs text-muted-foreground">
                <CircleSlash className="h-4 w-4" />
                cp_* schema not materialized (flag OFF / never activated) — null, not 0.
              </div>
            )}
          </div>
        </div>
        <ProvenanceNote provenance={data.passport?.provenance} />
      </Section>

      {/* Certification questions */}
      {Array.isArray(cert.questions) && (
        <Section title="Re-Certification (Phase 6)" icon={<CheckCircle2 className="h-4 w-4 text-slate-500" />}
          subtitle="Structural (machinery) and Activation (live data) per journey step — separate axes.">
          <div className="space-y-2">
            {cert.questions.map((q: any, i: number) => (
              <div key={i} className="rounded border bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{q.q}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={q.structural ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-500'}>
                      {q.structural ? 'structural ✓' : 'structural ⚠'}
                    </Badge>
                    <Badge variant="outline" className={q.activation_na ? 'border-slate-300 text-slate-500' : q.activation ? 'border-emerald-400 text-emerald-700' : 'border-amber-400 text-amber-700'}>
                      {q.activation_na ? 'n/a (by design)' : q.activation ? 'live data' : 'no data yet'}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{q.answer}</p>
              </div>
            ))}
          </div>
          {cert.remaining_blockers && (
            <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs">
              <div className="rounded border bg-white p-3">
                <div className="mb-1 font-medium text-slate-700">Structural blockers</div>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {cert.remaining_blockers.structural?.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
              </div>
              <div className="rounded border bg-white p-3">
                <div className="mb-1 font-medium text-slate-700">Activation blockers</div>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {cert.remaining_blockers.activation?.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            </div>
          )}
          <ProvenanceNote provenance={data.certification?.provenance} />
        </Section>
      )}

      {/* Data volume (raw, not funnel) */}
      <Section title="Raw Data Volume (not funnel)" icon={<Info className="h-4 w-4 text-slate-500" />}
        subtitle="Subject-level totals that can exceed registered users (e.g. seeded competency history). Reported separately by design.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Competency-History Subjects" value={dataVolume.competency_history_subjects} />
          <Stat label="CRA-Scored Subjects" value={dataVolume.cra_scored_subjects} />
          <Stat label="Behavioural Users (CAPADEX)" value={dataVolume.behavioural_capadex_users} />
          <Stat label="Behavioural Reports" value={dataVolume.behavioural_capadex_reports} />
          <Stat label="Career-Seeker Profiles" value={dataVolume.career_seeker_profiles} />
        </div>
      </Section>

      <p className="text-[11px] text-muted-foreground">{data.funnel?.disclaimer}</p>
    </div>
  );
}
