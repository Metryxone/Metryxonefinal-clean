import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Rocket, AlertTriangle, Info, CheckCircle2, CircleSlash, Layers, Gauge, ShieldCheck, Server } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BRAND = { primary: '#344E86' };
const BASE = '/api/admin/go-live';

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
        : v === 'NOT_MEASURABLE' ? 'bg-slate-100 text-slate-600 border-slate-300'
          : 'bg-red-100 text-red-800 border-red-300';
  return <Badge variant="outline" className={cls}>{v.replace('_', ' ')}</Badge>;
}

function StatusDot({ status }: { status?: string | null }) {
  const s = String(status ?? '').toLowerCase();
  const map: Record<string, string> = {
    healthy: 'bg-emerald-500', ready: 'bg-emerald-500', evidence_present: 'bg-emerald-500',
    partial: 'bg-amber-500', dormant: 'bg-slate-400',
    gap: 'bg-red-500', fail: 'bg-red-500', not_ready: 'bg-red-500',
    not_measurable: 'bg-slate-300', gated: 'bg-indigo-400',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[s] ?? 'bg-slate-300'}`} title={status ?? 'unknown'} />;
}

function AnswerBadge({ answer }: { answer?: string | null }) {
  const a = String(answer ?? '').toLowerCase();
  if (a === 'yes') return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">yes</Badge>;
  if (a === 'no') return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">no</Badge>;
  return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">abstain</Badge>;
}

export default function GoLiveCenterPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    disabled: boolean;
    overview: any | null;
    axes: any | null;
    scalability: any | null;
    security: any | null;
    command: any | null;
    certification: any | null;
  }>({
    queryKey: [`${BASE}/all`],
    queryFn: async () => {
      const probe = await fetch(`${BASE}/enabled`, { credentials: 'include' });
      if (!probe.ok) return { disabled: true, overview: null, axes: null, scalability: null, security: null, command: null, certification: null };
      const get = async (p: string): Promise<any | null> => {
        try {
          const r = await fetch(`${BASE}/${p}`, { credentials: 'include' });
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      };
      const [overview, axes, scalability, security, command, certification] = await Promise.all([
        get('overview'), get('axes'), get('scalability'), get('security'), get('command-center'), get('certification'),
      ]);
      return { disabled: false, overview, axes, scalability, security, command, certification };
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading go-live certification…</div>;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Failed to load go-live certification.</div>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
      </div>
    );
  }
  if (data.disabled) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleSlash className="h-4 w-4" /> Go-Live Certification is disabled (flag <code>goLiveCertification</code> OFF).
        </div>
      </div>
    );
  }

  const ov = data.overview;
  const axes = Array.isArray(data.axes?.axes) ? data.axes.axes : [];
  const scal = data.scalability;
  const sec = data.security;
  const command = data.command;
  const cert = data.certification;
  const launch = command?.launch_readiness;

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Rocket className="mt-0.5 h-6 w-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Go-Live Center</h2>
            <p className="max-w-3xl text-xs text-muted-foreground">
              Read-only composition (superset of Enterprise Certification). Six readiness axes —
              Structural ⟂ Activation ⟂ Adoption ⟂ Operational ⟂ Outcome ⟂ Market — are SEPARATE and never composited.
              null = not measurable (never a fabricated 0); live evidence that cannot be measured (load, real customers) reads as not measurable.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Certification level headline */}
      <Section title="Go-Live Certification" icon={<Rocket className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="5-level ladder + 9 yes/no questions. Overall = checklist completion (share of questions = YES), reported ALONGSIDE the axes — never an average of them.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Level</div>
            <div className="mt-1 text-base font-bold" style={{ color: BRAND.primary }}>{cert?.level?.label ?? '—'}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">level {cert?.level?.index ?? '—'} / 4</div>
          </div>
          <Stat label="Checklist" pct={cert?.overall_checklist_pct ?? null} hint="questions = YES" />
          <Stat label="Answered yes" value={cert?.summary?.answered_yes ?? null} hint={`of ${cert?.summary?.total ?? '—'}`} />
          <Stat label="Abstained" value={cert?.summary?.abstained ?? null} hint="not measurable" />
        </div>
        {cert?.recommendation && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-[11px] text-indigo-900">{cert.recommendation}</div>
        )}
        {Array.isArray(cert?.questions) && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Go-Live Question</th>
                  <th className="py-2 pr-3">Axis</th>
                  <th className="py-2 pr-3">Answer</th>
                </tr>
              </thead>
              <tbody>
                {cert.questions.map((q: any) => (
                  <tr key={q.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{q.question}</td>
                    <td className="py-2 pr-3"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{q.axis}</span></td>
                    <td className="py-2 pr-3"><AnswerBadge answer={q.answer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Six-axis readiness */}
      <Section title="Six-Axis Readiness" icon={<Layers className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Structural ⟂ Activation ⟂ Adoption ⟂ Operational ⟂ Outcome ⟂ Market — independent axes, never composited.">
        {axes.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {axes.map((a: any) => (
              <div key={a.axis} className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><StatusDot status={a.status} /><span className="text-xs font-semibold">{a.label}</span></div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{String(a.status).replace('_', ' ')}</span>
                </div>
                <div className="mt-1 text-lg">{a.score === null || a.score === undefined ? <span className="text-amber-600 italic text-xs">not measurable</span> : <Pct value={a.score} />}</div>
                {a.confidence && <div className="mt-0.5 text-[10px] text-muted-foreground">confidence: {a.confidence.state} (k≥{a.confidence.k_min})</div>}
                {a.note && <div className="mt-1 text-[10px] text-muted-foreground">{a.note}</div>}
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-amber-600 italic">Axis detail not measurable.</div>}
        {data.axes?.axes_note && <div className="mt-3 border-t pt-2 text-[11px] italic text-muted-foreground">{data.axes.axes_note}</div>}
      </Section>

      {/* Scalability + Security verdicts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Scalability Certification" icon={<Server className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Structural/config readiness only. Load capacity under stress is a SEPARATE axis and is not measurable here.">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Verdict</div>
              <div className="mt-1"><VerdictBadge verdict={scal?.verdict} /></div>
            </div>
            <Stat label="Structural" pct={scal?.structural_readiness_pct ?? null} hint={`${scal?.structural_dimensions_ready ?? '—'}/${scal?.structural_dimensions_total ?? '—'} dims`} />
            <Stat label="Tenants" value={scal?.dimensions?.multi_tenant?.tenant_count ?? null} hint="multi-tenant substrate" />
            <Stat label="Health snapshots" value={scal?.dimensions?.health_monitoring?.snapshot_count ?? null} hint="monitoring instrumented" />
          </div>
          <div className="mt-2 text-[10px] italic text-amber-600">Load capacity: not measurable (no live load/stress test).</div>
        </Section>

        <Section title="Security & Governance" icon={<ShieldCheck className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Formal RBAC is advisory; the live super_admin gate is authoritative. MX-106X composes the existing engines and does not change enforcement.">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Verdict</div>
              <div className="mt-1"><VerdictBadge verdict={sec?.verdict} /></div>
            </div>
            <Stat label="Structural" pct={sec?.structural_readiness_pct ?? null} hint={`${sec?.structural_dimensions_ready ?? '—'}/${sec?.structural_dimensions_total ?? '—'} dims`} />
            <Stat label="RBAC roles" value={sec?.dimensions?.rbac?.roles ?? null} hint="advisory" />
            <Stat label="AI-gov substrate" pct={sec?.dimensions?.ai_governance?.structural_pct ?? null} hint="explainability/fairness" />
          </div>
        </Section>
      </div>

      {/* Launch readiness (from command center) */}
      {launch && (
        <Section title="Launch Readiness" icon={<Gauge className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Composed snapshot. Each axis kept separate; certification level reported alongside.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Scalability</div>
              <div className="mt-1"><VerdictBadge verdict={launch?.scalability?.verdict} /></div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Security</div>
              <div className="mt-1"><VerdictBadge verdict={launch?.security_governance?.verdict} /></div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cert level</div>
              <div className="mt-1 text-sm font-bold" style={{ color: BRAND.primary }}>{launch?.certification_level?.label ?? '—'}</div>
            </div>
            <Stat label="Checklist" pct={launch?.certification_level?.overall_checklist_pct ?? null} />
          </div>
        </Section>
      )}

      {/* Per-domain platform health */}
      <Section title="Platform Health by Domain" icon={<Gauge className="h-4 w-4" style={{ color: BRAND.primary }} />} subtitle="Reuses the Super Admin command center. Structural (machinery) and Adoption (live data) are separate axes; null adoption = not measurable.">
        {Array.isArray(command?.domains) ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {command.domains.map((c: any) => (
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
        ) : <div className="text-xs text-amber-600 italic">Domain detail not measurable.</div>}
      </Section>

      {(ov?.disclaimer || command?.disclaimer) && (
        <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-[11px] text-muted-foreground">
          <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>{ov?.disclaimer ?? command?.disclaimer}</span>
        </div>
      )}
    </div>
  );
}
