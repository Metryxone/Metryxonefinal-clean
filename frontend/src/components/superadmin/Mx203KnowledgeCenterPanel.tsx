import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, BookOpen, AlertTriangle, Info, Layers, Gauge, Database, ListChecks } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BRAND = { primary: '#344E86' };
const BASE = '/api/admin/mx203-knowledge';

/** null/undefined → "not measurable" (amber); 0 stays 0 (never coerced). */
function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">not measurable</span>;
  return <span className="font-semibold tabular-nums">{value}%</span>;
}
function Num({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-amber-600 italic text-xs">n/a</span>;
  return <span className="font-semibold tabular-nums">{value.toLocaleString()}</span>;
}
function Stat({ label, pct, value, hint }: { label: string; pct?: number | null; value?: number | null; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg">{pct !== undefined ? <Pct value={pct} /> : <Num value={value} />}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
function Section({ title, icon, children, subtitle }: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
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
const STATUS_CLS: Record<string, string> = {
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  partial: 'bg-amber-100 text-amber-800 border-amber-300',
  not_ready: 'bg-red-100 text-red-800 border-red-300',
  not_measurable: 'bg-slate-100 text-slate-500 border-slate-300 italic',
};
function StatusBadge({ s }: { s: string }) {
  return <Badge variant="outline" className={STATUS_CLS[s] ?? 'bg-slate-100'}>{s.replace(/_/g, ' ')}</Badge>;
}

export default function Mx203KnowledgeCenterPanel() {
  const opts = { credentials: 'include' as const };
  const founder = useQuery<any>({ queryKey: [`${BASE}/founder`], queryFn: async () => (await fetch(`${BASE}/founder`, opts)).json() });
  const coverage = useQuery<any>({ queryKey: [`${BASE}/coverage`], queryFn: async () => (await fetch(`${BASE}/coverage`, opts)).json() });
  const consumers = useQuery<any>({ queryKey: [`${BASE}/consumers`, 1], queryFn: async () => (await fetch(`${BASE}/consumers?limit=1`, opts)).json() });

  const isFetching = founder.isFetching || coverage.isFetching || consumers.isFetching;
  const refetchAll = () => { founder.refetch(); coverage.refetch(); consumers.refetch(); };

  const f = founder.data; const cov = coverage.data; const con = consumers.data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: BRAND.primary }}>
            <BookOpen className="h-5 w-5" /> Knowledge Center — Enterprise Knowledge Population (MX-203)
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Read-only. Verified · Draft · Approved coverage are three <strong>independent</strong> axes — never combined into one
            number. Governed drafts are rule-based proposals awaiting human approval; nothing auto-promotes. <strong>null ≠ 0.</strong>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Coverage — three separate axes */}
      <Section title="Knowledge Coverage (three independent axes)" icon={<Gauge className="h-4 w-4" />}
        subtitle="Verified = source-backed factual truth (LIVE). Draft = governed proposals (NOT live). Approved = human-promoted (LIVE in canonical homes).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Verified coverage" pct={cov?.coverage?.verified_pct} hint="source-backed, live" />
          <Stat label="Draft coverage" pct={cov?.coverage?.draft_pct} hint="governed, needs review" />
          <Stat label="Approved coverage" pct={cov?.coverage?.approved_pct} hint="human-approved, live" />
        </div>
        {cov?.notes?.phase1_data_block && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>Phase 1 is data-blocked.</strong> {cov.notes.phase1_data_block}</span>
          </div>
        )}
      </Section>

      {/* Verified breakdown + governed attribute matrix */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Verified attribute breakdown" icon={<Database className="h-4 w-4" />} subtitle="Live, source-backed coverage per factual attribute (of 419 genome).">
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-muted-foreground"><tr><th className="px-3 py-2">Attribute</th><th className="px-3 py-2 text-right">Competencies</th></tr></thead>
              <tbody>
                {(cov?.verified_breakdown ?? []).map((v: any) => (
                  <tr key={v.attribute} className="border-t">
                    <td className="px-3 py-1.5">{v.attribute}</td>
                    <td className="px-3 py-1.5 text-right"><Num value={v.live_n} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Governed attribute pipeline" icon={<Layers className="h-4 w-4" />} subtitle="Drafts vs human-approved per governed attribute type (MX-202B + MX-203).">
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-muted-foreground"><tr><th className="px-3 py-2">Attribute</th><th className="px-3 py-2 text-right">Draft</th><th className="px-3 py-2 text-right">Approved</th></tr></thead>
              <tbody>
                {(cov?.governed_attribute_matrix ?? []).map((a: any) => (
                  <tr key={a.attribute} className="border-t">
                    <td className="px-3 py-1.5">{a.attribute.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-1.5 text-right"><Num value={a.draft_comps} /></td>
                    <td className="px-3 py-1.5 text-right"><Num value={a.approved_comps} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* Consumer readiness matrix */}
      <Section title="Consumer readiness (9 consumers)" icon={<ListChecks className="h-4 w-4" />}
        subtitle="A consumer is 'ready' ONLY when its real backing data is present. Drafts make a consumer 'partial' at most. Absent backing → not measurable.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(con?.rollup ?? {}).map(([consumer, r]: [string, any]) => (
            <div key={consumer} className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{consumer.replace(/_/g, ' ')}</span>
                <Pct value={r.ready_pct} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                <span className="text-emerald-700">ready {r.ready}</span>
                <span className="text-amber-700">· partial {r.partial}</span>
                <span className="text-red-700">· not ready {r.not_ready}</span>
                {r.not_measurable > 0 && <span className="text-slate-400">· n/m {r.not_measurable}</span>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Founder rollup */}
      <Section title="Founder rollup" icon={<Info className="h-4 w-4" />} subtitle="Knowledge completion, SME review backlog, weakest competencies and highest-risk consumer surfaces.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="SME drafts pending" value={f?.sme_review_backlog?.drafts_pending} hint="human-approval queue" />
          <Stat label="Competencies in backlog" value={f?.sme_review_backlog?.competencies_pending} />
          <Stat label="Healthy competencies" value={f?.health_distribution?.healthy} hint="≥75% verified attrs" />
          <Stat label="Weak competencies" value={f?.health_distribution?.weak} hint="<40% verified attrs" />
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Weakest competencies (lowest health)</div>
            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="w-full text-xs">
                <tbody>
                  {(f?.weakest_competencies ?? []).slice(0, 10).map((w: any) => (
                    <tr key={w.competency_id} className="border-t first:border-t-0">
                      <td className="px-3 py-1.5">{w.canonical_name}</td>
                      <td className="px-3 py-1.5 text-right"><Pct value={w.health_pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Highest-risk consumers (lowest ready %)</div>
            <div className="space-y-1.5">
              {(f?.highest_risk_consumers ?? []).map((r: any) => (
                <div key={r.consumer} className="flex items-center justify-between rounded-lg border bg-white px-3 py-1.5 text-xs">
                  <span>{r.consumer.replace(/_/g, ' ')}</span><Pct value={r.ready_pct} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {f?.honesty && <p className="mt-3 text-[10px] italic text-muted-foreground">{f.honesty}</p>}
      </Section>

      {(founder.isError || coverage.isError || consumers.isError) && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">Failed to load knowledge data. Try Refresh.</div>
      )}
    </div>
  );
}
