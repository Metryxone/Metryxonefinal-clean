import { BRAND } from '@/design-system/tokens';
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, AlertTriangle, Gauge, Coins, Search, BarChart3, User, Info, TrendingUp,
  SlidersHorizontal, Save, Check, RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';



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

interface PlanQuotaRow {
  plan_id: string;
  plan_code: string;
  plan_name: string;
  product_id: string | null;
  product_name: string | null;
  segment: string | null;
  is_active: boolean;
  billing_interval: string;
  quotas: Record<string, number>;
}
interface PlanQuotaOverview {
  generated_at: string;
  degraded: boolean;
  dimensions: string[];
  plans: PlanQuotaRow[];
}
interface UsageOverrideRow {
  email: string;
  usage_type: string;
  limit_value: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
interface UsageOverrideOverview {
  generated_at: string;
  degraded: boolean;
  dimensions: string[];
  overrides: UsageOverrideRow[];
}
interface TrendPoint {
  period: string;
  events: number;
  quantity: number;
}
interface DimensionTrend {
  dimension: string;
  kind: DimensionKind;
  substrate: boolean;
  series: TrendPoint[];
}
interface UsageTrend {
  generated_at: string;
  degraded: boolean;
  granularity: 'week' | 'month';
  periods: string[];
  by_dimension: DimensionTrend[];
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
  override_enforced: 'Per-customer override',
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

// ── Per-plan quota editor ────────────────────────────────────────────────────────────────────────
// Declared quotas live on the plan (comm_plans.metadata.quotas). Editing them here is the canonical way
// to change the limits enforced by the meter (fail-closed at 429) and shown in the consumption view —
// no code change. A blank field = unmetered (no declared quota). Only whole non-negative numbers.
function PlanQuotaEditor() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savedPlan, setSavedPlan] = useState<string | null>(null);
  const [errorPlan, setErrorPlan] = useState<{ id: string; msg: string } | null>(null);

  const {
    data, isLoading, isError, refetch, isFetching,
  } = useQuery<PlanQuotaOverview | null>({
    queryKey: ['/api/admin/commercial/metering/quotas'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/metering/quotas', { credentials: 'include' });
      if (!res.ok) throw new Error(`quotas ${res.status}`);
      return res.json();
    },
  });

  const dimensions = data?.dimensions ?? [];

  const saveMutation = useMutation({
    mutationFn: async ({ planId, quotas }: { planId: string; quotas: Record<string, string> }) => {
      const res = await fetch(`/api/admin/commercial/metering/quotas/${encodeURIComponent(planId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotas }),
      });
      if (!res.ok) {
        let msg = `Save failed (${res.status})`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (_r, vars) => {
      setErrorPlan(null);
      setSavedPlan(vars.planId);
      setDrafts((prev) => { const next = { ...prev }; delete next[vars.planId]; return next; });
      // Refresh the quota list AND the consumption/overview views so the new limit/remaining shows.
      qc.invalidateQueries({ queryKey: ['/api/admin/commercial/metering/quotas'] });
      qc.invalidateQueries({ queryKey: ['metering-consumption'] });
      qc.invalidateQueries({ queryKey: ['/api/admin/commercial/metering/dimensions'] });
      window.setTimeout(() => setSavedPlan((cur) => (cur === vars.planId ? null : cur)), 2500);
    },
    onError: (err: any, vars) => {
      setErrorPlan({ id: vars.planId, msg: err?.message || 'Save failed' });
    },
  });

  // Current input value for a plan+dimension: the in-progress draft if present, else the server value.
  const valueFor = (plan: PlanQuotaRow, dim: string): string => {
    const draft = drafts[plan.plan_id]?.[dim];
    if (draft !== undefined) return draft;
    const v = plan.quotas[dim];
    return v == null ? '' : String(v);
  };

  const setValue = (planId: string, dim: string, val: string) => {
    setDrafts((prev) => ({ ...prev, [planId]: { ...(prev[planId] || {}), [dim]: val } }));
  };

  const isDirty = (plan: PlanQuotaRow): boolean => {
    const draft = drafts[plan.plan_id];
    if (!draft) return false;
    return dimensions.some((dim) => {
      const server = plan.quotas[dim] == null ? '' : String(plan.quotas[dim]);
      const cur = draft[dim];
      return cur !== undefined && cur.trim() !== server;
    });
  };

  const invalidDim = (plan: PlanQuotaRow): boolean =>
    dimensions.some((dim) => {
      const v = valueFor(plan, dim).trim();
      if (v === '') return false;
      const n = Number(v);
      return !Number.isFinite(n) || n < 0 || !Number.isInteger(n);
    });

  const savePlan = (plan: PlanQuotaRow) => {
    const quotas: Record<string, string> = {};
    for (const dim of dimensions) quotas[dim] = valueFor(plan, dim).trim();
    saveMutation.mutate({ planId: plan.plan_id, quotas });
  };

  const resetPlan = (planId: string) => {
    setDrafts((prev) => { const next = { ...prev }; delete next[planId]; return next; });
    if (errorPlan?.id === planId) setErrorPlan(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-5 w-5" style={{ color: BRAND.primary }} /> Plan usage limits
            </CardTitle>
            <CardDescription>
              Set the per-period quota each plan grants per dimension. A blank field means unmetered (no declared
              quota). Changes apply immediately to every identity on that plan — the meter fails closed once a
              limit is reached.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-slate-600">
              Couldn&apos;t load plan quotas. The metering feature may be disabled or you may not be signed in as a
              super-admin.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : !data || data.plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-slate-500">
            <Info className="h-6 w-6 text-slate-400" />
            No plans found. Create plans in the catalog first, then set their usage limits here.
          </div>
        ) : (
          <div className="space-y-4">
            {data.degraded && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 text-amber-800 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Some plans failed to read — the list below is partial (honest degraded state).
              </div>
            )}
            {data.plans.map((plan) => {
              const dirty = isDirty(plan);
              const invalid = invalidDim(plan);
              const saving = saveMutation.isPending && saveMutation.variables?.planId === plan.plan_id;
              return (
                <div key={plan.plan_id} className="rounded-lg border border-slate-200 p-4 bg-white">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-700 flex items-center gap-2">
                        {plan.plan_name}
                        {!plan.is_active && <Badge className="bg-slate-100 text-slate-500 text-[10px]">Inactive</Badge>}
                      </div>
                      <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-mono">{plan.plan_code}</span>
                        {plan.product_name && <span>· {plan.product_name}</span>}
                        {plan.segment && <span>· {plan.segment}</span>}
                        <span>· {plan.billing_interval}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savedPlan === plan.plan_id && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <Check className="h-4 w-4" /> Saved
                        </span>
                      )}
                      {dirty && (
                        <Button variant="ghost" size="sm" onClick={() => resetPlan(plan.plan_id)} disabled={saving}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Reset
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => savePlan(plan)}
                        disabled={!dirty || invalid || saving}
                        style={{ backgroundColor: BRAND.primary }}
                        className="text-white"
                      >
                        {saving
                          ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          : <Save className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                    </div>
                  </div>
                  {errorPlan?.id === plan.plan_id && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-red-50 text-red-700 text-xs">
                      <AlertTriangle className="h-4 w-4" /> {errorPlan.msg}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dimensions.map((dim) => (
                      <div key={dim}>
                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                          {DIMENSION_LABELS[dim] ?? dim}
                        </label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={valueFor(plan, dim)}
                          onChange={(e) => setValue(plan.plan_id, dim, e.target.value)}
                          placeholder="Unmetered"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Per-customer override editor ───────────────────────────────────────────────────────────────────
// A per-identity override sets a limit for ONE customer + dimension that takes precedence over their
// plan quota (regardless of subscription). Setting one is the way to grant/restrict a single customer
// without changing their plan; clearing it reverts them to the plan quota. Only whole non-negative
// numbers; credits are excluded (a consumable balance, not a per-period quota).
function OverridesEditor() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [dimension, setDimension] = useState('');
  const [limit, setLimit] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    data, isLoading, isError, refetch, isFetching,
  } = useQuery<UsageOverrideOverview | null>({
    queryKey: ['/api/admin/commercial/metering/overrides'],
    queryFn: async () => {
      const res = await fetch('/api/admin/commercial/metering/overrides', { credentials: 'include' });
      if (!res.ok) throw new Error(`overrides ${res.status}`);
      return res.json();
    },
  });

  const dimensions = data?.dimensions ?? [];
  // Default the dimension select to the first available once the list loads.
  const effectiveDimension = dimension || dimensions[0] || '';

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['/api/admin/commercial/metering/overrides'] });
    qc.invalidateQueries({ queryKey: ['metering-consumption'] });
    qc.invalidateQueries({ queryKey: ['/api/admin/commercial/metering/dimensions'] });
  };

  const upsertMutation = useMutation({
    mutationFn: async (payload: { email: string; usage_type: string; limit: string; note: string }) => {
      const res = await fetch('/api/admin/commercial/metering/overrides', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          usage_type: payload.usage_type,
          limit: Number(payload.limit),
          note: payload.note || undefined,
        }),
      });
      if (!res.ok) {
        let msg = `Save failed (${res.status})`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      setFormError(null);
      setSaved(true);
      setEmail(''); setLimit(''); setNote('');
      invalidateAll();
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: any) => setFormError(err?.message || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: { email: string; usage_type: string }) => {
      const qs = `email=${encodeURIComponent(row.email)}&usage_type=${encodeURIComponent(row.usage_type)}`;
      const res = await fetch(`/api/admin/commercial/metering/overrides?${qs}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = `Clear failed (${res.status})`;
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => { setFormError(null); invalidateAll(); },
    onError: (err: any) => setFormError(err?.message || 'Clear failed'),
  });

  const limitTrim = limit.trim();
  const limitNum = Number(limitTrim);
  const limitInvalid = limitTrim !== '' && (!Number.isFinite(limitNum) || limitNum < 0 || !Number.isInteger(limitNum));
  const canSubmit =
    email.trim() !== '' && effectiveDimension !== '' && limitTrim !== '' && !limitInvalid && !upsertMutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    upsertMutation.mutate({ email: email.trim(), usage_type: effectiveDimension, limit: limitTrim, note: note.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" style={{ color: BRAND.primary }} /> Per-customer overrides
            </CardTitle>
            <CardDescription>
              Override a usage limit for a single customer. An override takes precedence over the customer&apos;s plan
              quota (regardless of subscription) and applies immediately. Clear it to revert them to the plan quota.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* ── Set / update form ── */}
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Customer email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Dimension</label>
              <select
                value={effectiveDimension}
                onChange={(e) => setDimension(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {dimensions.length === 0 && <option value="">—</option>}
                {dimensions.map((dim) => (
                  <option key={dim} value={dim}>{DIMENSION_LABELS[dim] ?? dim}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Limit</label>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="e.g. 5000"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Note (optional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="Why this override was granted"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={submit}
                disabled={!canSubmit}
                style={{ backgroundColor: BRAND.primary }}
                className="text-white w-full"
              >
                {upsertMutation.isPending
                  ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  : <Save className="h-4 w-4 mr-1" />}
                Set override
              </Button>
            </div>
          </div>
          {limitInvalid && (
            <p className="mt-2 text-xs text-red-600">Limit must be a whole non-negative number.</p>
          )}
          {saved && (
            <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600"><Check className="h-4 w-4" /> Override saved</p>
          )}
          {formError && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 text-red-700 text-xs">
              <AlertTriangle className="h-4 w-4" /> {formError}
            </div>
          )}
        </div>

        {/* ── Existing overrides ── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-slate-600">
              Couldn&apos;t load overrides. The metering feature may be disabled or you may not be signed in as a
              super-admin.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : !data || data.overrides.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-slate-500">
            <Info className="h-6 w-6 text-slate-400" />
            No per-customer overrides. Every customer is on their plan quota.
          </div>
        ) : (
          <div className="space-y-3">
            {data.degraded && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 text-amber-800 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Some overrides failed to read — the list below is partial (honest degraded state).
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Dimension</th>
                    <th className="py-2 pr-4">Limit</th>
                    <th className="py-2 pr-4">Note</th>
                    <th className="py-2 pr-4">Updated</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.overrides.map((row) => {
                    const clearing = deleteMutation.isPending
                      && deleteMutation.variables?.email === row.email
                      && deleteMutation.variables?.usage_type === row.usage_type;
                    return (
                      <tr key={`${row.email}::${row.usage_type}`} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium text-slate-700 break-all">{row.email}</td>
                        <td className="py-2 pr-4">{DIMENSION_LABELS[row.usage_type] ?? row.usage_type}</td>
                        <td className="py-2 pr-4">{fmt(row.limit_value)}</td>
                        <td className="py-2 pr-4 text-slate-500 max-w-[220px] truncate" title={row.note ?? ''}>
                          {row.note ?? '—'}
                        </td>
                        <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(row.updated_at).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate({ email: row.email, usage_type: row.usage_type })}
                            disabled={clearing}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {clearing
                              ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              : <RotateCcw className="h-4 w-4 mr-1" />}
                            Clear
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
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

  const [activeTab, setActiveTab] = useState<'current' | 'trends'>('current');
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');
  const periodCount = granularity === 'week' ? 8 : 6;

  const {
    data: trend,
    isLoading: trendLoading,
    isError: trendError,
    isFetching: trendFetching,
    refetch: refetchTrend,
  } = useQuery<UsageTrend | null>({
    // Only fetch trends once the Trends tab is opened — avoids unnecessary admin API traffic
    // (and background error noise) for admins who only view Current.
    enabled: activeTab === 'trends',
    queryKey: ['metering-trends', granularity, periodCount],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/commercial/metering/trends?granularity=${granularity}&periods=${periodCount}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`trends ${res.status}`);
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'current' | 'trends')} className="space-y-6">
        <TabsList>
          <TabsTrigger value="current">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Current
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-1.5" /> Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
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

      <PlanQuotaEditor />

      <OverridesEditor />
        </TabsContent>

        {/* ── Usage trends over time ─────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5" style={{ color: BRAND.primary }} /> Consumption trend over time
                  </CardTitle>
                  <CardDescription>
                    {trend?.generated_at
                      ? `Last ${trend.periods.length} ${trend.granularity === 'week' ? 'weeks' : 'months'} · generated ${new Date(trend.generated_at).toLocaleString('en-IN')}`
                      : 'Per-dimension consumption bucketed by period, derived live from the usage & credit ledgers.'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                    {(['week', 'month'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGranularity(g)}
                        className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                          granularity === g ? 'text-white' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        style={granularity === g ? { backgroundColor: BRAND.primary } : undefined}
                      >
                        {g === 'week' ? 'Weekly' : 'Monthly'}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchTrend()} disabled={trendFetching}>
                    <RefreshCw className={`h-4 w-4 ${trendFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
                </div>
              ) : trendError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-slate-600">
                    Couldn&apos;t load usage trends. The metering feature may be disabled or you may not be signed in as a super-admin.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetchTrend()}>Retry</Button>
                </div>
              ) : !trend ? null : (
                <>
                  {trend.degraded && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md bg-amber-50 text-amber-800 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Some dimensions failed to read — the charts below are partial (honest degraded state, not fabricated zeros).
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {trend.by_dimension.map((dim) => (
                      <DimensionTrendChart key={dim.dimension} dim={dim} granularity={trend.granularity} />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function periodTickLabel(iso: string, granularity: 'week' | 'month'): string {
  const d = new Date(iso);
  if (granularity === 'month') {
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function DimensionTrendChart({ dim, granularity }: { dim: DimensionTrend; granularity: 'week' | 'month' }) {
  const isCredits = dim.dimension === 'credits';
  const label = DIMENSION_LABELS[dim.dimension] ?? dim.dimension;

  // Credits quantity is paise SPENT (debits); render in rupees. Everything else is a raw count.
  const chartData = dim.series.map((p) => ({
    period: periodTickLabel(p.period, granularity),
    value: isCredits ? Math.round(p.quantity / 100) : p.quantity,
  }));
  const hasActivity = dim.series.some((p) => p.quantity !== 0 || p.events !== 0);

  const valueLabel = isCredits
    ? 'Credits used (₹)'
    : dim.kind === 'level'
      ? 'Current total'
      : 'Quantity';

  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-white">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {isCredits
          ? <Coins className="h-4 w-4" style={{ color: BRAND.warning }} />
          : <Gauge className="h-4 w-4" style={{ color: BRAND.accent }} />}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">{valueLabel}</div>

      {!dim.substrate ? (
        <div className="flex flex-col items-center justify-center h-[180px] text-center gap-2">
          <Info className="h-5 w-5 text-amber-500" />
          <span className="text-xs text-slate-500">No data substrate yet</span>
        </div>
      ) : !hasActivity ? (
        <div className="flex flex-col items-center justify-center h-[180px] text-center gap-2">
          <Info className="h-5 w-5 text-slate-400" />
          <span className="text-xs text-slate-500">No activity in this window</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} width={44} />
            <Tooltip
              formatter={(v: any) => [isCredits ? `₹${new Intl.NumberFormat('en-IN').format(Number(v))}` : fmt(Number(v)), valueLabel]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={isCredits ? BRAND.warning : BRAND.primary}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
