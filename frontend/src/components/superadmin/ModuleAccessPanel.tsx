import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, ShieldCheck, Search, User, Plus, X, CheckCircle2, Package,
  AlertTriangle, Layers, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';

const NAVY = '#344E86';
const TEAL = '#4ECDC4';

interface ModuleDefinition {
  code: string;
  name: string;
  description: string;
  surface: 'individual' | 'employer';
  route_prefix: string;
}

interface OverviewRow {
  module: string;
  name: string;
  plan_identities: number;
  grant_identities: number;
}
interface Overview {
  generated_at: string;
  degraded: boolean;
  reason: string;
  total_identities_with_access: number;
  per_module: OverviewRow[];
  modules: ModuleDefinition[];
}

interface AccessState {
  has_identity: boolean;
  email: string | null;
  modules: string[];
  sources: { plans: string[]; grants: string[] };
  degraded: boolean;
  reason: string;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  billing_interval: string;
  price_paise: number;
  currency: string;
  is_active: boolean;
  product_name: string | null;
  modules: string[];
}

async function getJson<T>(url: string): Promise<{ ok: boolean; data?: T }> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return { ok: false };
  const j = await res.json().catch(() => null);
  return { ok: !!j?.ok, data: j?.data as T };
}

function formatPrice(paise: number, currency: string): string {
  const amount = (Number(paise) || 0) / 100;
  return `${currency || 'INR'} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Section 1 — platform module coverage overview. */
function CoverageSection() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Overview | null>({
    queryKey: ['/api/entitlement/admin/overview'],
    queryFn: async () => {
      const r = await getJson<Overview>('/api/entitlement/admin/overview');
      if (!r.ok || !r.data) throw new Error('failed');
      return r.data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base" style={{ color: NAVY }}>
            <Layers size={18} /> Module coverage
          </CardTitle>
          <CardDescription>
            How many billing identities currently own each of the 7 product modules
            {data ? ` · ${data.total_identities_with_access} identities with any access` : ''}.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : isError || !data ? (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle size={16} /> Could not load coverage.
          </div>
        ) : (
          <>
            {data.degraded && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle size={15} /> Entitlement ledger degraded — counts may be incomplete.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                    <th className="py-2 pr-4">Module</th>
                    <th className="py-2 pr-4 text-right">Via plans</th>
                    <th className="py-2 pr-4 text-right">Via grants</th>
                  </tr>
                </thead>
                <tbody>
                  {data.per_module.map((row) => (
                    <tr key={row.module} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium" style={{ color: NAVY }}>{row.name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.plan_identities}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.grant_identities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Section 2 — per-user module access lookup + grant/revoke. */
function UserAccessSection({ modules }: { modules: ModuleDefinition[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [emailInput, setEmailInput] = useState('');
  const [queryEmail, setQueryEmail] = useState('');
  const [grantModule, setGrantModule] = useState('');
  const [grantReason, setGrantReason] = useState('');

  const accessKey = ['/api/entitlement/admin/access', queryEmail] as const;
  const { data: access, isLoading, isError, refetch } = useQuery<AccessState | null>({
    queryKey: accessKey,
    enabled: !!queryEmail,
    queryFn: async () => {
      const r = await getJson<AccessState>(`/api/entitlement/admin/access/${encodeURIComponent(queryEmail)}`);
      if (!r.ok || !r.data) throw new Error('failed');
      return r.data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: accessKey });
    qc.invalidateQueries({ queryKey: ['/api/entitlement/admin/overview'] });
    refetch();
  };

  const grant = useMutation({
    mutationFn: async (payload: { email: string; module: string; reason: string }) => {
      const res = await fetch('/api/entitlement/admin/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: payload.email, module: payload.module, reason: payload.reason || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'grant failed');
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Module granted' }); setGrantModule(''); setGrantReason(''); invalidate(); },
    onError: (e: any) => toast({ title: 'Grant failed', description: String(e?.message ?? e), variant: 'destructive' }),
  });

  const revoke = useMutation({
    mutationFn: async (payload: { email: string; module: string }) => {
      const res = await fetch('/api/entitlement/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'revoke failed');
      return res.json();
    },
    onSuccess: (r: any) => {
      toast({ title: r?.data?.revoked ? 'Grant revoked' : 'No active grant to revoke' });
      invalidate();
    },
    onError: (e: any) => toast({ title: 'Revoke failed', description: String(e?.message ?? e), variant: 'destructive' }),
  });

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    modules.forEach((mod) => m.set(mod.code, mod.name));
    return m;
  }, [modules]);

  const grantOnlyModules = access ? access.sources.grants : [];

  const submitLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setQueryEmail(emailInput.trim().toLowerCase());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base" style={{ color: NAVY }}>
          <User size={18} /> Per-user access
        </CardTitle>
        <CardDescription>
          Look up any billing identity's module access, then grant or revoke a module manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submitLookup} className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-8"
              type="email"
              placeholder="user@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>
          <Button type="submit" style={{ background: NAVY }} disabled={!emailInput.trim()}>Look up</Button>
        </form>

        {queryEmail && (
          isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400"><RefreshCw size={15} className="animate-spin" /> Loading…</div>
          ) : isError || !access ? (
            <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={15} /> Could not load access for this identity.</div>
          ) : (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium" style={{ color: NAVY }}>{access.email}</div>
                <Badge variant="outline">{access.modules.length} module{access.modules.length === 1 ? '' : 's'}</Badge>
              </div>
              {access.degraded && (
                <div className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                  <AlertTriangle size={13} /> Ledger degraded — this may be incomplete.
                </div>
              )}
              {access.modules.length === 0 ? (
                <div className="text-sm text-gray-500">No module access ({access.reason.replace(/_/g, ' ')}).</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {access.modules.map((code) => {
                    const viaGrant = grantOnlyModules.includes(code);
                    const viaPlan = access.sources.plans.includes(code);
                    return (
                      <div key={code} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                        style={{ borderColor: `${TEAL}55`, background: `${TEAL}0D` }}>
                        <CheckCircle2 size={13} style={{ color: TEAL }} />
                        <span className="font-medium" style={{ color: NAVY }}>{nameByCode.get(code) ?? code}</span>
                        <span className="text-gray-400">
                          {viaPlan && viaGrant ? 'plan+grant' : viaPlan ? 'plan' : 'grant'}
                        </span>
                        {viaGrant && (
                          <button
                            title="Revoke this grant"
                            className="ml-0.5 text-gray-400 hover:text-red-500"
                            onClick={() => revoke.mutate({ email: access.email!, module: code })}
                            disabled={revoke.isPending}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grant a module */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <select
                  className="text-sm border rounded-lg px-2.5 py-2 outline-none"
                  style={{ borderColor: '#E2E8F0' }}
                  value={grantModule}
                  onChange={(e) => setGrantModule(e.target.value)}
                >
                  <option value="">Grant a module…</option>
                  {modules.map((m) => (
                    <option key={m.code} value={m.code}>{m.name}</option>
                  ))}
                </select>
                <Input
                  className="flex-1 min-w-[160px]"
                  placeholder="Reason (optional)"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                />
                <Button
                  size="sm"
                  style={{ background: TEAL, color: '#04302c' }}
                  disabled={!grantModule || grant.isPending}
                  onClick={() => grant.mutate({ email: access.email!, module: grantModule, reason: grantReason })}
                >
                  <Plus size={14} /> Grant
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Manual grants override plan-derived access. Plan-derived modules can only be changed in the
                Plan mapping section below.
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

/** Section 3 — plan → module mapping editor. */
function PlanMappingSection({ modules }: { modules: ModuleDefinition[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});

  const key = ['/api/entitlement/admin/plans'] as const;
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ plans: PlanRow[] } | null>({
    queryKey: key,
    queryFn: async () => {
      const r = await getJson<{ plans: PlanRow[]; modules: ModuleDefinition[] }>('/api/entitlement/admin/plans');
      if (!r.ok || !r.data) throw new Error('failed');
      return r.data;
    },
  });

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>();
    modules.forEach((mod) => m.set(mod.code, mod.name));
    return m;
  }, [modules]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['/api/entitlement/admin/overview'] });
  };

  const attach = useMutation({
    mutationFn: async (payload: { plan_id: string; module: string }) => {
      const res = await fetch('/api/entitlement/admin/plan-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'attach failed');
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Module attached to plan' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Attach failed', description: String(e?.message ?? e), variant: 'destructive' }),
  });

  const detach = useMutation({
    mutationFn: async (payload: { plan_id: string; module: string }) => {
      const res = await fetch('/api/entitlement/admin/plan-modules/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'detach failed');
      return res.json();
    },
    onSuccess: () => { toast({ title: 'Module removed from plan' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Remove failed', description: String(e?.message ?? e), variant: 'destructive' }),
  });

  const plans = data?.plans ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base" style={{ color: NAVY }}>
            <Package size={18} /> Plan → module mapping
          </CardTitle>
          <CardDescription>
            Attach modules to subscription plans so an active purchase confers module access automatically.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-400"><RefreshCw size={20} className="animate-spin" /></div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={16} /> Could not load plans.</div>
        ) : plans.length === 0 ? (
          <div className="text-sm text-gray-500">No subscription plans found. Create plans in Pricing &amp; Packages first.</div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const availableModules = modules.filter((m) => !plan.modules.includes(m.code));
              const pick = selected[plan.id] ?? '';
              return (
                <div key={plan.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NAVY }}>
                        {plan.name}
                        {!plan.is_active && <Badge variant="outline" className="text-gray-400">inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {plan.product_name && (
                          <span className="flex items-center gap-1"><Building2 size={11} /> {plan.product_name}</span>
                        )}
                        <span>{plan.billing_interval}</span>
                        <span>{formatPrice(plan.price_paise, plan.currency)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="text-sm border rounded-lg px-2 py-1.5 outline-none"
                        style={{ borderColor: '#E2E8F0' }}
                        value={pick}
                        onChange={(e) => setSelected((s) => ({ ...s, [plan.id]: e.target.value }))}
                        disabled={availableModules.length === 0}
                      >
                        <option value="">{availableModules.length === 0 ? 'All modules mapped' : 'Add module…'}</option>
                        {availableModules.map((m) => (
                          <option key={m.code} value={m.code}>{m.name}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        style={{ background: TEAL, color: '#04302c' }}
                        disabled={!pick || attach.isPending}
                        onClick={() => { attach.mutate({ plan_id: plan.id, module: pick }); setSelected((s) => ({ ...s, [plan.id]: '' })); }}
                      >
                        <Plus size={14} /> Add
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plan.modules.length === 0 ? (
                      <span className="text-xs text-gray-400">No modules mapped.</span>
                    ) : (
                      plan.modules.map((code) => (
                        <div key={code} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                          style={{ borderColor: `${NAVY}33`, background: `${NAVY}08` }}>
                          <ShieldCheck size={13} style={{ color: NAVY }} />
                          <span className="font-medium" style={{ color: NAVY }}>{nameByCode.get(code) ?? code}</span>
                          <button
                            title="Remove module from plan"
                            className="ml-0.5 text-gray-400 hover:text-red-500"
                            onClick={() => detach.mutate({ plan_id: plan.id, module: code })}
                            disabled={detach.isPending}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))
                    )}
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

export default function ModuleAccessPanel() {
  const { data: modules = [], isLoading, isError } = useQuery<ModuleDefinition[]>({
    queryKey: ['/api/entitlement/modules'],
    queryFn: async () => {
      const r = await getJson<{ modules: ModuleDefinition[] }>('/api/entitlement/modules');
      if (!r.ok || !r.data) throw new Error('failed');
      return r.data.modules;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold" style={{ color: NAVY }}>
          <ShieldCheck size={22} /> Module Access Control
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Control access to the 7 product surfaces per billing identity — via subscription plans or manual grants.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400"><RefreshCw size={24} className="animate-spin" /></div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={16} /> Could not load the module registry.</div>
      ) : (
        <>
          <CoverageSection />
          <PlanMappingSection modules={modules} />
          <UserAccessSection modules={modules} />
        </>
      )}
    </div>
  );
}
