import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Network, Database, Layers, GitBranch, RefreshCw, CheckCircle2, Upload,
  AlertTriangle, Info, Boxes, Link2, ShieldCheck, Tags, ListChecks,
  Eye, ChevronDown,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', gray: '#6b7280' };

interface AssetReadiness {
  key: string; label: string; namespace: string; table: string;
  category: string; expectation: string; confidence: string;
  coverage_rows: number | null;
  status: 'consumable' | 'empty_pending_import' | 'unknown';
}
interface IdSpace { space: string; description: string; total: number | null; matched: number | null; unmatched: number | null; read_status: 'ok' | 'unknown'; sample_unmatched: { source_id: string; source_label: string }[] }
interface ConsumerNs { consumer: string; identifier_space: string; status: string; note: string }
interface ReadinessData {
  generated_at: string;
  spine: {
    canonical_library: string; canonical_namespace: string; canonical_description: string;
    attached_namespace: string; attached_description: string; unify_strategy: string;
  };
  summary: { total_assets: number; consumable: number; empty_pending_import: number; unknown: number };
  assets: AssetReadiness[];
  crosswalk: { canonical_table: string; canonical_total: number | null; id_spaces: IdSpace[]; consumer_namespaces: ConsumerNs[] };
}

interface TypeMasterRow { type_key: string; label: string; definition: string; examples: string; display_order: number; mapped_count: number | null }
interface TypeMapRow { competency_id: string; canonical_name: string; domain_id: string | null; family_id: string | null; scientific_type: string | null; type_key: string; confidence: string; needs_review: boolean; provenance: string; evidence: string }
interface ClassificationReport {
  generated_at: string;
  version: string;
  types: TypeMasterRow[];
  coverage: { competencies_total: number | null; mapped: number | null; unmapped: number | null; coverage_pct: number | null };
  distribution: { type_key: string; label: string; count: number; pct: number }[];
  confidence: { high: number; medium: number; low: number };
  needs_review_count: number;
  needs_review: TypeMapRow[];
  findings: string[];
}

const TYPE_COLORS: Record<string, string> = {
  behavioral: '#344E86', cognitive: '#7c3aed', functional: '#0891b2', technical: '#f59e0b', future_skills: '#ec4899',
};

function StatusBadge({ status }: { status: AssetReadiness['status'] }) {
  if (status === 'consumable') return <Badge className="bg-green-100 text-green-700 border-green-300">consumable</Badge>;
  if (status === 'empty_pending_import') return <Badge className="bg-amber-100 text-amber-700 border-amber-300">empty · pending import</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-300">unknown</Badge>;
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: (color || BRAND.primary) + '15' }}>
            <Icon className="h-5 w-5" style={{ color: color || BRAND.primary }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AssetRowsResult {
  key: string; table: string; label: string | null;
  columns: string[]; rows: Record<string, unknown>[];
  total: number | null; note?: string;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function AssetRowsTable({ assetKey, table }: { assetKey: string; table: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['competency-framework-asset-rows', assetKey],
    queryFn: async () => {
      const r = await fetch(`/api/admin/competency-intelligence/asset-rows/${encodeURIComponent(assetKey)}`, { credentials: 'include' });
      if (!r.ok) throw new Error('asset rows failed');
      const j = await r.json();
      return j.data as AssetRowsResult;
    },
  });

  if (isLoading) return <div className="px-4 py-3 text-xs text-gray-500">Loading rows from <code>{table}</code>…</div>;
  if (isError || !data) return <div className="px-4 py-3 text-xs text-red-600">Failed to load rows from <code>{table}</code>.</div>;

  if (data.note) {
    return (
      <div className="px-4 py-3 text-xs text-gray-500 flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" /> {data.note} (<code>{table}</code>).
      </div>
    );
  }
  if (data.rows.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-gray-500 flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" /> Table <code>{table}</code> exists but has no rows yet.
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-1">
      <div className="text-xs text-gray-400 mb-1.5">
        Showing {data.rows.length}{data.total != null && data.total > data.rows.length ? ` of ${data.total}` : ''} row{data.rows.length === 1 ? '' : 's'} from <code>{table}</code>
        {data.total != null && data.total > data.rows.length ? ' (capped at 200)' : ''}
      </div>
      <div className="max-h-80 overflow-auto rounded-md border border-gray-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left text-gray-500 border-b">
              {data.columns.map((c) => (
                <th key={c} className="py-1.5 px-2 font-medium whitespace-nowrap font-mono">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50/60">
                {data.columns.map((c) => (
                  <td key={c} className="py-1.5 px-2 align-top text-gray-700 max-w-[22rem] truncate" title={formatCell(row[c])}>
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CompetencyFrameworkIntelligencePanel() {
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['competency-framework-intelligence-readiness'],
    queryFn: async () => {
      const r = await fetch('/api/admin/competency-intelligence/readiness', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('readiness failed');
      const j = await r.json();
      return j.data as ReadinessData;
    },
  });

  const cls = useQuery({
    queryKey: ['competency-framework-intelligence-classification'],
    queryFn: async () => {
      const r = await fetch('/api/admin/competency-intelligence/classification-report', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('classification failed');
      const j = await r.json();
      return j.data as ClassificationReport;
    },
  });

  if (q.isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading framework readiness…</div>;
  }
  if (q.data && (q.data as any).__disabled) {
    return (
      <div className="p-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/60">
          <CardContent className="pt-6 pb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700">Competency Framework Intelligence is disabled</p>
              <p className="text-sm text-gray-500 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-100 rounded">FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1</code> to
                enable the read-only framework spine, crosswalk and readiness report. Flag OFF keeps every existing
                screen byte-identical.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <div className="p-6 text-sm text-red-600">Failed to load framework readiness.</div>;
  }

  const d = q.data as ReadinessData;
  const consumablePct = d.summary.total_assets > 0 ? Math.round((d.summary.consumable / d.summary.total_assets) * 100) : 0;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-5 w-5 text-[#344E86]" /> Competency Framework Intelligence
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Phase 1 foundation — treats the existing competency framework as one read-only master spine by composing the
            two namespaces. Coverage (does data exist) and Confidence (is it trustworthy) are reported as separate axes.
            Empty assets are reported honestly; no rows are fabricated.
          </p>
        </div>
        <button
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['competency-framework-intelligence-readiness'] });
            qc.invalidateQueries({ queryKey: ['competency-framework-intelligence-classification'] });
          }}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Spine decision */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#344E86]" /> Canonical Spine Decision</CardTitle>
          <CardDescription>How the two physically-disjoint namespaces relate (unified at the service + crosswalk layer only — never physically merged).</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-[#344E86]/30 bg-[#344E86]/5 p-3">
            <p className="font-semibold text-[#344E86]">Canonical master · {d.spine.canonical_namespace}</p>
            <p className="text-gray-600 mt-1">{d.spine.canonical_description}</p>
            <p className="text-xs text-gray-400 mt-1">table: <code>{d.spine.canonical_library}</code></p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="font-semibold text-gray-700">Attached · {d.spine.attached_namespace}</p>
            <p className="text-gray-600 mt-1">{d.spine.attached_description}</p>
          </div>
          <div className="md:col-span-2 flex items-start gap-2 text-xs text-gray-500">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {d.spine.unify_strategy}
          </div>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Boxes} label="Framework assets" value={d.summary.total_assets} />
        <MetricCard icon={CheckCircle2} label="Consumable" value={d.summary.consumable} sub={`${consumablePct}% of assets`} color={BRAND.success} />
        <MetricCard icon={AlertTriangle} label="Empty · pending import" value={d.summary.empty_pending_import} color={BRAND.warning} />
        <MetricCard icon={Database} label="Canonical competencies" value={d.crosswalk.canonical_total ?? '—'} sub={d.crosswalk.canonical_table} color={BRAND.primary} />
      </div>

      {/* Assets table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-[#344E86]" /> Asset Readiness</CardTitle>
          <CardDescription>Per-asset Coverage (row count) and Confidence (provenance/trust) — two separate axes. Rows pending import show an Upload link that opens the platform's Bulk Upload tool.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 px-3 font-medium">Namespace</th>
                <th className="py-2 px-3 font-medium text-right">Coverage (rows)</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Confidence</th>
                <th className="py-2 pl-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {d.assets.map((a) => (
                <React.Fragment key={a.key}>
                <tr className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-gray-900">{a.label}</div>
                    <div className="text-xs text-gray-400"><code>{a.table}</code></div>
                  </td>
                  <td className="py-2 px-3"><Badge variant="outline" className="font-mono text-xs">{a.namespace}</Badge></td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">{a.coverage_rows == null ? '—' : a.coverage_rows}</td>
                  <td className="py-2 px-3"><StatusBadge status={a.status} /></td>
                  <td className="py-2 px-3 text-xs text-gray-500">{a.confidence}</td>
                  <td className="py-2 pl-3 text-right">
                    <div className="inline-flex items-center gap-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setOpenAsset((cur) => (cur === a.key ? null : a.key))}
                        title="View this asset's backing table rows inline"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#344E86] hover:text-[#243a66] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {openAsset === a.key ? 'Hide' : 'View'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openAsset === a.key ? 'rotate-180' : ''}`} />
                      </button>
                      {a.status === 'empty_pending_import' && (
                        <a
                          href={`/api/admin/competency-intelligence/upload?asset=${encodeURIComponent(a.key)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open the Bulk Upload tool to import data for this asset"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#344E86] hover:text-[#243a66] hover:underline"
                        >
                          <Upload className="h-3.5 w-3.5" /> Upload
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
                {openAsset === a.key && (
                  <tr className="bg-gray-50/40">
                    <td colSpan={6} className="p-0 border-b last:border-0">
                      <AssetRowsTable assetKey={a.key} table={a.table} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Crosswalk id-spaces */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4 text-[#344E86]" /> Crosswalk Registry</CardTitle>
          <CardDescription>Fragmented competency identifiers mapped to the canonical id. Unmatched ids are reported as honest gaps — never fabricated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {d.crosswalk.id_spaces.map((s) => {
            const unknown = s.read_status === 'unknown' || s.total == null || s.matched == null;
            const pct = !unknown && (s.total as number) > 0 ? Math.round(((s.matched as number) / (s.total as number)) * 100) : 0;
            return (
              <div key={s.space} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800 font-mono text-sm">{s.space}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {unknown ? (
                      <>
                        <p className="text-lg font-bold text-gray-400">unknown</p>
                        <p className="text-xs text-gray-400">source unreadable</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-gray-900">{s.matched}/{s.total}</p>
                        <p className="text-xs text-gray-400">{pct}% matched · {s.unmatched} gap</p>
                      </>
                    )}
                  </div>
                </div>
                {s.sample_unmatched.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.sample_unmatched.map((u) => (
                      <Badge key={u.source_id} variant="outline" className="text-xs text-gray-500 border-amber-200 bg-amber-50">
                        {u.source_label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Consumer namespaces (Phase 2) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4 text-[#344E86]" /> Consumer Namespaces</CardTitle>
          <CardDescription>Downstream systems whose competency identifiers live in code. Crosswalk + migration is Phase 2 — declared honestly, not fabricated here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.crosswalk.consumer_namespaces.map((c) => (
            <div key={c.consumer} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
              <Badge className="bg-gray-100 text-gray-600 border-gray-300 shrink-0 mt-0.5">{c.status.replace(/_/g, ' ')}</Badge>
              <div>
                <p className="font-medium text-gray-800">{c.consumer}</p>
                <p className="text-xs text-gray-500">{c.identifier_space} — {c.note}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Phase 1.1 — Competency Type classification */}
      {cls.data && !(cls.data as any).__disabled && (() => {
        const c = cls.data as ClassificationReport;
        const cov = c.coverage;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Tags className="h-4 w-4 text-[#344E86]" /> Competency Type Classification <Badge variant="outline" className="ml-1 text-xs">Phase 1.1</Badge></CardTitle>
              <CardDescription>
                Additive 5-type axis (Behavioral · Cognitive · Functional · Technical · Future Skills) over the canonical genome.
                Coverage (every competency mapped) and Confidence (assignment quality) are separate axes. The existing
                <code className="px-1">scientific_type</code> / <code className="px-1">domain_id</code> columns are never mutated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Coverage + confidence metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={CheckCircle2} label="Coverage" value={cov.coverage_pct == null ? '—' : `${cov.coverage_pct}%`} sub={`${cov.mapped ?? '—'}/${cov.competencies_total ?? '—'} mapped`} color={cov.unmapped === 0 ? BRAND.success : BRAND.warning} />
                <MetricCard icon={ShieldCheck} label="High confidence" value={c.confidence.high} sub="curated scientific_type / family" color={BRAND.success} />
                <MetricCard icon={Info} label="Medium / Low" value={`${c.confidence.medium} / ${c.confidence.low}`} sub="keyword-derived" color={BRAND.primary} />
                <MetricCard icon={ListChecks} label="Needs review" value={c.needs_review_count} sub="flagged for human check" color={c.needs_review_count > 0 ? BRAND.warning : BRAND.gray} />
              </div>

              {/* Per-type distribution */}
              <div className="space-y-2">
                {c.distribution.map((t) => {
                  const color = TYPE_COLORS[t.type_key] || BRAND.primary;
                  const def = c.types.find((x) => x.type_key === t.type_key);
                  return (
                    <div key={t.type_key} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="font-semibold text-gray-800">{t.label}</span>
                          {t.count === 0 && <Badge variant="outline" className="text-xs border-pink-200 bg-pink-50 text-pink-600">content gap</Badge>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-bold text-gray-900">{t.count}</span>
                          <span className="text-xs text-gray-400 ml-1">{t.pct}%</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.pct}%`, backgroundColor: color }} />
                      </div>
                      {def && <p className="text-xs text-gray-500 mt-2">{def.definition}</p>}
                    </div>
                  );
                })}
              </div>

              {/* Honest findings */}
              <div className="rounded-lg border border-[#344E86]/20 bg-[#344E86]/5 p-3">
                <p className="text-sm font-semibold text-[#344E86] flex items-center gap-1.5 mb-1.5"><Info className="h-3.5 w-3.5" /> Validation findings</p>
                <ul className="space-y-1 text-xs text-gray-600 list-disc pl-4">
                  {c.findings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>

              {/* Needs-review list (only when present) */}
              {c.needs_review.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Needs review ({c.needs_review.length})</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-3 font-medium">Competency</th>
                        <th className="py-2 px-3 font-medium">Assigned type</th>
                        <th className="py-2 px-3 font-medium">Confidence</th>
                        <th className="py-2 pl-3 font-medium">Provenance / evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.needs_review.map((r) => (
                        <tr key={r.competency_id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium text-gray-900">{r.canonical_name}</td>
                          <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{r.type_key}</Badge></td>
                          <td className="py-2 px-3 text-xs text-gray-500">{r.confidence}</td>
                          <td className="py-2 pl-3 text-xs text-gray-500"><code>{r.provenance}</code> · {r.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <p className="text-xs text-gray-400">Generated {new Date(d.generated_at).toLocaleString()}</p>
    </div>
  );
}
