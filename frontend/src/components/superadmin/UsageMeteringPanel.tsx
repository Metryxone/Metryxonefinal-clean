import { BRAND } from '@/design-system/tokens';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, AlertTriangle, Gauge, Coins, Search, BarChart3, User, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';



type DimensionKind = 'period_count' | 'level' | 'credit_balance';

interface DimensionOverviewRow {
  dimension: string;
  kind: DimensionKind;
  events: number;
  quantity: number;
  identities: number;
}
interface DimensionOverview {
  generated_at: string;
  degraded: boolean;
  by_dimension: DimensionOverviewRow[];
}
interface DimensionConsumption {
  dimension: string;
  kind: DimensionKind;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  balance: number | null;
  reason: string;
}
interface IdentityConsumption {
  email: string;
  generated_at: string;
  degraded: boolean;
  dimensions: DimensionConsumption[];
}

const DIMENSION_LABELS: Record<string, string> = {
  assessments: 'Assessments',
  candidates: 'Candidates',
  jobs: 'Jobs',
  employers: 'Employers',
  institutions: 'Institutions',
  api: 'API Usage',
  storage: 'Storage',
  credits: 'Credits',
};

const KIND_LABELS: Record<DimensionKind, string> = {
  period_count: 'Period count',
  level: 'Current level',
  credit_balance: 'Credit balance',
};

// Map an honest backend reason code to user-facing copy. We NEVER turn an honest
// "no_substrate"/"degraded"/"no_declared_quota" into a fabricated zero.
const REASON_LABELS: Record<string, string> = {
  within_quota: 'Within quota',
  over_quota: 'Over quota',
  no_declared_quota: 'No declared quota (unmetered)',
  no_substrate: 'No data substrate yet',
  no_customer: 'No customer record',
  degraded: 'Read failed (degraded)',
  empty: 'No activity',
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

function reasonTone(reason: string): string {
  if (reason === 'over_quota' || reason === 'degraded') return 'bg-red-100 text-red-800';
  if (reason === 'no_substrate' || reason === 'no_customer') return 'bg-amber-100 text-amber-800';
  if (reason === 'no_declared_quota') return 'bg-slate-100 text-slate-700';
  return 'bg-emerald-100 text-emerald-800';
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

function fmtDimensionValue(row: DimensionOverviewRow): string {
  if (row.dimension === 'credits') {
    // quantity is a net paise balance across all customers
    return `₹${new Intl.NumberFormat('en-IN').format(Math.round(row.quantity / 100))}`;
  }
  return fmt(row.quantity);
}

function quantityLabel(row: DimensionOverviewRow): string {
  if (row.dimension === 'credits') return 'Net balance';
  if (row.kind === 'level') return 'Current total';
  return 'Total quantity';
}

export default function UsageMeteringPanel() {
  const [emailInput, setEmailInput] = useState('');
  const [lookupEmail, setLookupEmail] = useState<string | null>(null);

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
    isFetching: overviewFetching,
  } = useQuery<DimensionOverview | null>({
    queryKey: ['/api/admin/commercial/metering/dimensions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/metering/dimensions', { credentials: 'include' });
      if (!res.ok) throw new Error(`overview ${res.status}`);
      return res.json();
    },
  });

  const consumptionUrl = lookupEmail
    ? `/api/commercial/metering/consumption?email=${encodeURIComponent(lookupEmail)}`
    : '/api/commercial/metering/consumption';

  const {
    data: consumption,
    isLoading: consumptionLoading,
    isError: consumptionError,
    isFetching: consumptionFetching,
    refetch: refetchConsumption,
  } = useQuery<IdentityConsumption | null>({
    queryKey: ['metering-consumption', lookupEmail ?? '__self__'],
    queryFn: async () => {
      const res = await fetch(consumptionUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`consumption ${res.status}`);
      return res.json();
    },
  });

  const runLookup = () => {
    const trimmed = emailInput.trim();
    setLookupEmail(trimmed ? trimmed : null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
            <Gauge className="h-6 w-6" /> Usage & Credits
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            System-wide consumption across the eight business dimensions, plus a per-identity quota &amp; credit view.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchOverview()} disabled={overviewFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${overviewFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* ── System-wide overview ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" style={{ color: BRAND.primary }} /> System-wide usage by dimension
          </CardTitle>
          <CardDescription>
            {overview?.generated_at
              ? `Generated ${new Date(overview.generated_at).toLocaleString('en-IN')}`
              : 'Live counts derived from the usage & credit ledgers.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overviewLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
            </div>
          ) : overviewError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-slate-600">
                Couldn&apos;t load the system-wide overview. The metering feature may be disabled or you may not be signed in as a super-admin.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchOverview()}>Retry</Button>
            </div>
          ) : !overview ? null : (
            <>
              {overview.degraded && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md bg-amber-50 text-amber-800 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Some dimensions failed to read — figures below are partial (honest degraded state, not fabricated zeros).
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {overview.by_dimension.map((row) => (
                  <div key={row.dimension} className="rounded-lg border border-slate-200 p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        {DIMENSION_LABELS[row.dimension] ?? row.dimension}
                      </span>
                      {row.dimension === 'credits'
                        ? <Coins className="h-4 w-4" style={{ color: BRAND.warning }} />
                        : <Gauge className="h-4 w-4" style={{ color: BRAND.accent }} />}
                    </div>
                    <div className="mt-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
                      {fmtDimensionValue(row)}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">{quantityLabel(row)}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{fmt(row.events)} {row.dimension === 'credits' ? 'ledger entries' : 'events'}</span>
                      <span>·</span>
                      <span>{fmt(row.identities)} {row.dimension === 'credits' ? 'customers' : 'identities'}</span>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-[10px]">{KIND_LABELS[row.kind]}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Per-identity consumption ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" style={{ color: BRAND.primary }} /> Per-identity consumption
          </CardTitle>
          <CardDescription>
            Used / limit / remaining per dimension and the credit balance. Leave the box empty to inspect your own
            identity, or enter an email to inspect another (super-admin only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runLookup(); }}
                placeholder="identity@example.com (blank = me)"
                className="pl-9"
              />
            </div>
            <Button onClick={runLookup} style={{ backgroundColor: BRAND.primary }} className="text-white">
              Look up
            </Button>
            <Button variant="outline" onClick={() => refetchConsumption()} disabled={consumptionFetching}>
              <RefreshCw className={`h-4 w-4 ${consumptionFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {consumptionLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
            </div>
          ) : consumptionError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-slate-600">
                Couldn&apos;t load consumption for this identity. A non-super-admin can only inspect their own identity.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchConsumption()}>Retry</Button>
            </div>
          ) : !consumption ? null : (
            <>
              <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
                <Info className="h-4 w-4 text-slate-400" />
                Showing <span className="font-semibold">{consumption.email}</span>
                {consumption.degraded && (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">Partial (degraded)</Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b">
                      <th className="py-2 pr-4">Dimension</th>
                      <th className="py-2 pr-4">Used</th>
                      <th className="py-2 pr-4">Limit</th>
                      <th className="py-2 pr-4">Remaining / Balance</th>
                      <th className="py-2 pr-4">Utilization</th>
                      <th className="py-2 pr-4">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumption.dimensions.map((d) => {
                      const isCredits = d.dimension === 'credits';
                      const pct = (d.limit != null && d.limit > 0 && d.used != null)
                        ? Math.min(100, Math.round((d.used / d.limit) * 100))
                        : null;
                      return (
                        <tr key={d.dimension} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium text-slate-700">
                            {DIMENSION_LABELS[d.dimension] ?? d.dimension}
                            <div className="text-[10px] text-slate-400">{KIND_LABELS[d.kind]}</div>
                          </td>
                          <td className="py-2 pr-4">{isCredits ? '—' : fmt(d.used)}</td>
                          <td className="py-2 pr-4">{isCredits ? '—' : (d.limit == null ? 'Unmetered' : fmt(d.limit))}</td>
                          <td className="py-2 pr-4">
                            {isCredits
                              ? <span className="font-semibold" style={{ color: BRAND.warning }}>{fmt(d.balance)} credits</span>
                              : (d.remaining == null ? '—' : fmt(d.remaining))}
                          </td>
                          <td className="py-2 pr-4 w-40">
                            {pct == null ? (
                              <span className="text-slate-400 text-xs">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-2 w-24" />
                                <span className="text-xs text-slate-500">{pct}%</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge className={`${reasonTone(d.reason)} text-[10px]`}>{reasonLabel(d.reason)}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
