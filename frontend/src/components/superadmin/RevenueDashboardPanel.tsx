/**
 * Phase 6.6 — Revenue Intelligence dashboard (READ-ONLY).
 * Surfaces the composite revenue analytics: MRR / ARR / collections + revenue by
 * Product / Customer / Segment / Institution / Employer / Geography.
 *
 * Reads GET /api/admin/commercial/revenue/analytics. The tab is only rendered when the
 * `commercialRevenueIntelligence` flag is ON (the SuperAdminDashboard probes /ping before
 * mounting this panel), so flag-OFF is byte-identical legacy. Every figure is REAL recorded
 * revenue; empty substrate renders honest "no data yet" states — never fabricated numbers.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet, TrendingUp, Repeat2, Package, Users, Building2, Briefcase,
  MapPin, Layers, RefreshCw, Info, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

function formatCurrency(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function formatNum(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

interface RevByProduct { source: string; product_code: string; product_name: string; segment: string | null; payments: number; rupees: number; }
interface RevByCustomer { email: string; name: string | null; segment: string | null; payments: number; rupees: number; }
interface RevBySegment { segment: string; customers: number; payments: number; rupees: number; }
interface RevByOrg { email: string; name: string | null; payments: number; rupees: number; }
interface RevByGeo { state_code: string; invoices: number; rupees: number; }
interface RevenueAnalytics {
  generated_at: string;
  degraded: boolean;
  substrate: Record<string, boolean>;
  recurring: {
    mrr_rupees: number; arr_rupees: number; active_subscriptions: number;
    by_interval: { interval: string; subscriptions: number; mrr_rupees: number }[];
    renewals: { window_days: number; due_soon: number; in_grace: number; churning: number };
    forecast: any;
  };
  totals: { recurring_collections_rupees: number; onetime_rupees: number; total_rupees: number };
  by_product: RevByProduct[];
  by_customer: RevByCustomer[];
  by_segment: RevBySegment[];
  by_institution: RevByOrg[];
  by_employer: RevByOrg[];
  by_geography: { rows: RevByGeo[]; invoiced_rupees: number; coverage_pct: number };
  notes: string[];
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: BRAND.primary }}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
          </div>
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${BRAND.accent}22` }}>
            <Icon className="h-5 w-5" style={{ color: BRAND.primary }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-6 text-center text-sm text-gray-400">{text}</TableCell>
    </TableRow>
  );
}

export default function RevenueDashboardPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<RevenueAnalytics>({
    queryKey: ['/api/admin/commercial/revenue/analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/revenue/analytics', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <Wallet className="h-6 w-6" /> Revenue Intelligence
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            MRR / ARR and revenue broken down by product, customer, segment, institution, employer and geography.
            All figures are real recorded revenue.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading revenue analytics…</p>}
      {isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load revenue analytics.
        </CardContent></Card>
      )}

      {data && (
        <>
          {data.degraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Some sources were unreadable; figures below reflect available data only.
            </div>
          )}

          {/* Headline metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Repeat2} label="MRR" value={formatCurrency(data.recurring.mrr_rupees)} sub={`${formatNum(data.recurring.active_subscriptions)} active subs`} />
            <Stat icon={TrendingUp} label="ARR" value={formatCurrency(data.recurring.arr_rupees)} />
            <Stat icon={Wallet} label="Total Collected" value={formatCurrency(data.totals.total_rupees)} sub={`${formatCurrency(data.totals.recurring_collections_rupees)} recurring · ${formatCurrency(data.totals.onetime_rupees)} one-time`} />
            <Stat icon={MapPin} label="Invoiced (Geo)" value={formatCurrency(data.by_geography.invoiced_rupees)} sub={`${data.by_geography.coverage_pct}% of collected revenue`} />
          </div>

          {/* Renewals */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Renewals ({data.recurring.renewals.window_days}-day window)</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-6 pt-0 text-sm">
              <div><span className="text-gray-500">Due soon:</span> <span className="font-semibold">{formatNum(data.recurring.renewals.due_soon)}</span></div>
              <div><span className="text-gray-500">In grace:</span> <span className="font-semibold">{formatNum(data.recurring.renewals.in_grace)}</span></div>
              <div><span className="text-gray-500">Churning:</span> <span className="font-semibold">{formatNum(data.recurring.renewals.churning)}</span></div>
            </CardContent>
          </Card>

          {/* Revenue by Product */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Revenue by Product</CardTitle>
              <CardDescription>Recurring products + one-time CAPADEX stages</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead><TableHead>Source</TableHead><TableHead>Segment</TableHead>
                  <TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Revenue</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.by_product.length === 0
                    ? <EmptyRow cols={5} text="No realised product revenue yet." />
                    : data.by_product.map((r, i) => (
                      <TableRow key={`${r.source}-${r.product_code}-${i}`}>
                        <TableCell className="font-medium">{r.product_name}</TableCell>
                        <TableCell><Badge variant="outline">{r.source === 'subscription' ? 'Recurring' : 'One-time'}</Badge></TableCell>
                        <TableCell className="text-gray-500">{r.segment ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatNum(r.payments)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.rupees)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Revenue by Segment */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Revenue by Segment</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Segment</TableHead><TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Revenue</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.by_segment.length === 0
                    ? <EmptyRow cols={4} text="No recurring segment revenue yet." />
                    : data.by_segment.map((r, i) => (
                      <TableRow key={`${r.segment}-${i}`}>
                        <TableCell className="font-medium capitalize">{r.segment.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right">{formatNum(r.customers)}</TableCell>
                        <TableCell className="text-right">{formatNum(r.payments)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.rupees)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Top Customers</CardTitle>
              <CardDescription>Union of recurring + one-time spend (top 25)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Customer</TableHead><TableHead>Segment</TableHead>
                  <TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Revenue</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.by_customer.length === 0
                    ? <EmptyRow cols={4} text="No customer revenue yet." />
                    : data.by_customer.map((r, i) => (
                      <TableRow key={`${r.email}-${i}`}>
                        <TableCell className="font-medium">{r.name || r.email}</TableCell>
                        <TableCell className="text-gray-500">{r.segment ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatNum(r.payments)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.rupees)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Institutions + Employers */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Revenue by Institution</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Institution</TableHead><TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.by_institution.length === 0
                      ? <EmptyRow cols={3} text="No institution revenue yet." />
                      : data.by_institution.map((r, i) => (
                        <TableRow key={`${r.email}-${i}`}>
                          <TableCell className="font-medium">{r.name || r.email}</TableCell>
                          <TableCell className="text-right">{formatNum(r.payments)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.rupees)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4" /> Revenue by Employer</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Employer</TableHead><TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.by_employer.length === 0
                      ? <EmptyRow cols={3} text="No employer revenue yet." />
                      : data.by_employer.map((r, i) => (
                        <TableRow key={`${r.email}-${i}`}>
                          <TableCell className="font-medium">{r.name || r.email}</TableCell>
                          <TableCell className="text-right">{formatNum(r.payments)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.rupees)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Geography */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Revenue by Geography</CardTitle>
              <CardDescription>GST invoice state proxy · {data.by_geography.coverage_pct}% of collected revenue is invoiced</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>State</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Revenue</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.by_geography.rows.length === 0
                    ? <EmptyRow cols={3} text="No invoice substrate — geography is invoice-derived." />
                    : data.by_geography.rows.map((r, i) => (
                      <TableRow key={`${r.state_code}-${i}`}>
                        <TableCell className="font-medium">{r.state_code}</TableCell>
                        <TableCell className="text-right">{formatNum(r.invoices)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.rupees)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.notes.length > 0 && (
            <Card>
              <CardContent className="space-y-1.5 p-4">
                {data.notes.map((n, i) => (
                  <p key={i} className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {n}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-right text-xs text-gray-400">Generated {new Date(data.generated_at).toLocaleString('en-IN')}</p>
        </>
      )}
    </div>
  );
}
