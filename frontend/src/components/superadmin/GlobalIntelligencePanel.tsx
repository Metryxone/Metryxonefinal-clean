import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Globe, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86' };
const BASE = '/api/global-intel';

type RegionRow = {
  canonical_code: string;
  label: string;
  crosswalk: { phase8: string | null; m4_parent: string | null; m4_coarse: string | null };
  coverage: {
    competency_models: number | string | null;
    role_library: number | string | null;
    demand_intelligence: number | null;
    benchmark_cohorts: number | null;
    market_signals: number | null;
  };
  status: 'native' | 'partial_native' | 'empty';
  source: string;
};
type CountryRow = {
  iso2: string;
  name: string;
  m4_region: string;
  canonical_regions: string[];
  language: string;
  labor_regime: string;
  currency: { currency: string; locale: string; source: string };
};
type Overview = {
  ok: boolean;
  version?: string;
  summary?: {
    canonical_regions: number;
    regions_with_content: number;
    empty_regions: string[];
    localized_countries: number;
    benchmark_tiers: Record<string, number>;
    report_languages: number;
  };
  regions?: { regions: RegionRow[]; taxonomy_note?: string };
  countries?: { localized: CountryRow[]; localized_count: number; note?: string };
  benchmarks?: { tiers: Record<string, number>; region_cohorts_latent?: boolean; country_tier?: string; note?: string };
  localization?: {
    report_languages: string[];
    ui_languages: string[];
    report_only_languages: string[];
    currency_resolver: { countries: string[]; default: { currency: string; locale: string }; fx_conversion: boolean; note?: string };
    note?: string;
  };
  honesty?: string;
  error?: string;
};

/** Render a coverage cell honestly: null → "Insufficient Evidence", never a 0 that implies measured emptiness. */
function CoverageCell({ value }: { value: number | string | null }) {
  if (value === null || value === undefined) {
    return <span className="text-amber-600 text-xs italic">Insufficient Evidence</span>;
  }
  if (value === 'base') return <Badge variant="outline" className="text-xs">base (native)</Badge>;
  return <span className="font-medium tabular-nums">{value}</span>;
}

function StatusBadge({ status }: { status: RegionRow['status'] }) {
  if (status === 'native') return <Badge className="bg-emerald-600 hover:bg-emerald-600">native</Badge>;
  if (status === 'partial_native') return <Badge className="bg-sky-600 hover:bg-sky-600">partial-native</Badge>;
  return <Badge variant="outline" className="text-amber-600 border-amber-400">empty</Badge>;
}

export default function GlobalIntelligencePanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Overview>({
    queryKey: [`${BASE}/overview`],
    queryFn: async () => {
      const res = await fetch(`${BASE}/overview`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 503) return { ok: false, error: 'global_intelligence_disabled' } as Overview;
        throw new Error(`overview ${res.status}`);
      }
      return res.json();
    },
  });

  const s = data?.summary;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: BRAND.primary }}>Global Intelligence</h2>
            <p className="text-sm text-muted-foreground">
              Read-only composer over region · country · benchmark · localization assets (MX-76X).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4" /> Failed to load Global Intelligence overview.
        </div>
      )}
      {data && data.ok === false && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
          <Info className="w-4 h-4" /> Global Intelligence is disabled (flag <code>globalIntelligence</code> OFF).
        </div>
      )}

      {s && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Regions with content</div>
              <div className="text-2xl font-semibold">{s.regions_with_content}<span className="text-base text-muted-foreground"> / {s.canonical_regions}</span></div>
              {s.empty_regions.length > 0 && (
                <div className="text-xs text-amber-600 mt-1">empty: {s.empty_regions.join(', ')}</div>
              )}
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Localized countries</div>
              <div className="text-2xl font-semibold">{s.localized_countries}</div>
              <div className="text-xs text-muted-foreground mt-1">others → not_localized</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Benchmark tiers</div>
              <div className="text-2xl font-semibold">{Object.keys(s.benchmark_tiers).length}</div>
              <div className="text-xs text-muted-foreground mt-1">region tier latent</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Report languages</div>
              <div className="text-2xl font-semibold">{s.report_languages}</div>
            </div>
          </div>

          {/* Region coverage */}
          <section className="space-y-2">
            <h3 className="font-medium">Region Coverage</h3>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Competency</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Demand</TableHead>
                    <TableHead>Bench cohorts</TableHead>
                    <TableHead>Market signals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.regions?.regions.map((r) => (
                    <TableRow key={r.canonical_code}>
                      <TableCell>
                        <div className="font-medium">{r.canonical_code}</div>
                        <div className="text-xs text-muted-foreground" title={`phase8=${r.crosswalk.phase8 ?? '—'} · m4=${r.crosswalk.m4_parent ?? '—'}`}>{r.label}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell><CoverageCell value={r.coverage.competency_models} /></TableCell>
                      <TableCell><CoverageCell value={r.coverage.role_library} /></TableCell>
                      <TableCell><CoverageCell value={r.coverage.demand_intelligence} /></TableCell>
                      <TableCell><CoverageCell value={r.coverage.benchmark_cohorts} /></TableCell>
                      <TableCell><CoverageCell value={r.coverage.market_signals} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data?.regions?.taxonomy_note && (
              <p className="text-xs text-muted-foreground flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0" />{data.regions.taxonomy_note}</p>
            )}
          </section>

          {/* Country localization */}
          <section className="space-y-2">
            <h3 className="font-medium">Country Localization</h3>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ISO2</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>m4 region</TableHead>
                    <TableHead>Canonical</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Labor regime</TableHead>
                    <TableHead>Currency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.countries?.localized.map((c) => (
                    <TableRow key={c.iso2}>
                      <TableCell className="font-medium">{c.iso2}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.m4_region}</TableCell>
                      <TableCell className="text-xs">{c.canonical_regions.join(', ') || '—'}</TableCell>
                      <TableCell>{c.language}</TableCell>
                      <TableCell className="text-xs">{c.labor_regime}</TableCell>
                      <TableCell>{c.currency.currency}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data?.countries?.note && <p className="text-xs text-muted-foreground">{data.countries.note}</p>}
          </section>

          {/* Benchmarks + Localization */}
          <div className="grid md:grid-cols-2 gap-6">
            <section className="space-y-2">
              <h3 className="font-medium">Benchmark Tiers</h3>
              <div className="rounded-lg border p-4 space-y-2">
                {Object.entries(data?.benchmarks?.tiers ?? {}).map(([tier, n]) => (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{tier}</span>
                    <span className="font-medium tabular-nums">{n}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span>country</span>
                  <span className="text-amber-600 text-xs italic">Not Measurable</span>
                </div>
                {data?.benchmarks?.note && <p className="text-xs text-muted-foreground pt-2 border-t">{data.benchmarks.note}</p>}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Localization</h3>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Report languages</span>
                  <span className="text-right">{data?.localization?.report_languages.join(', ')}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">UI languages</span>
                  <span className="text-right">{data?.localization?.ui_languages.join(', ')}</span>
                </div>
                {data?.localization && data.localization.report_only_languages.length > 0 && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-amber-600">Report-only (no UI)</span>
                    <span className="text-right text-amber-600">{data.localization.report_only_languages.join(', ')}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-4 pt-2 border-t">
                  <span className="text-muted-foreground">Currency resolver</span>
                  <span className="text-right">{data?.localization?.currency_resolver.countries.length} countries · default {data?.localization?.currency_resolver.default.currency} ({data?.localization?.currency_resolver.default.locale}) · FX {data?.localization?.currency_resolver.fx_conversion ? 'on' : 'off'}</span>
                </div>
              </div>
            </section>
          </div>

          {data.honesty && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 border rounded p-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <span><strong>Honesty:</strong> {data.honesty} <span className="opacity-60">({data.version})</span></span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
