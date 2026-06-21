/**
 * Phase 6.11 — Multi-Tenant Architecture console (READ-ONLY).
 * Surfaces tenant_management (5 categories), tenant_isolation audit, tenant_configuration and a
 * PASS/WARN/FAIL validation harness — composed read-only from the existing tenants substrate plus the
 * additive relationship models.
 *
 * Reads GET /api/admin/tenant-architecture/console/{management,isolation,configuration,validation}.
 * The tab is only rendered when the `tenantManagementConsole` flag is ON (SuperAdminDashboard probes
 * /console/ping before mounting), so flag-OFF is byte-identical legacy. Every figure is REAL composed
 * data; absent substrate renders honest "not provisioned / not measurable" states — never fabricated.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, ShieldCheck, Settings, CheckCircle2, AlertTriangle, RefreshCw, Info,
  Network, Users, Layers, Lock, Handshake, Wallet, GitBranch, Plus, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

function formatNum(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}
function formatPct(n?: number | null) {
  if (n == null) return '—';
  return `${n}%`;
}

const CATEGORY_LABEL: Record<string, string> = {
  institution: 'Institutions',
  employer: 'Employers',
  partner: 'Partners',
  franchise: 'Franchise',
  channel_partner: 'Channel Partners',
};

interface TenantManagement {
  generated_at: string;
  degraded: boolean;
  headline: {
    total_tenants: number; active_tenants: number; total_seats: number; active_users: number;
    seat_utilization_pct: number | null; relationships: number; partner_agreements: number; channel_referrals: number;
  };
  categories: { category: string; tenants: number; active: number; seats: number; active_users: number }[];
  tenants: {
    id: number; tenant_code: string; tenant_name: string; tenant_type: string | null; category: string;
    extra_categories: string[]; subscription_tier: string | null; max_users: number; active_users: number;
    seat_utilization_pct: number | null; is_active: boolean; parent_count: number; child_count: number;
    partner_agreements: number; channel_referrals: number;
  }[];
  relationships: {
    id: number; parent_tenant_id: number; parent_name: string | null; child_tenant_id: number;
    child_name: string | null; relationship_type: string; status: string;
  }[];
  notes: string[];
}

interface TenantIsolationAudit {
  generated_at: string;
  degraded: boolean;
  summary: {
    tenant_scoped_tables: number; namespaces: number; deep_scanned: number; measurable_tables: number;
    fully_isolated_tables: number; tables_with_null_tenant: number; tables_with_orphans: number;
    isolation_index: number | null; total_rows_scanned: number; total_null_tenant_rows: number;
  };
  namespaces: { namespace: string; tables: number; measurable: number; fully_isolated: number }[];
  gaps: {
    table: string; namespace: string; total_rows: number | null; null_tenant_rows: number | null;
    orphan_tenant_rows: number | null; coverage_pct: number | null;
  }[];
  notes: string[];
}

interface TenantConfiguration {
  generated_at: string;
  degraded: boolean;
  substrate: { branding_table: boolean; permissions_table: boolean; agreements_table: boolean; referrals_table: boolean; relationships_table: boolean };
  tier_distribution: { tier: string; tenants: number; seats: number }[];
  tenants: {
    id: number; tenant_code: string; tenant_name: string; subscription_tier: string | null;
    max_users: number; active_users: number; seat_utilization_pct: number | null;
    seat_status: 'ok' | 'near_cap' | 'over_cap' | 'no_cap'; has_branding: boolean;
    permission_count: number | null; partner_agreements: number; channel_referrals: number; child_tenants: number;
  }[];
  notes: string[];
}

interface EnforcementStatus {
  generated_at: string;
  enforcement_flag: boolean;
  guard_available: boolean;
  tables: { table: string; exists: boolean; rls_enabled: boolean; rls_forced: boolean; policies: string[]; armed: boolean }[];
  armed_count: number;
  armable_count: number;
  notes: string[];
}

type Status = 'PASS' | 'WARN' | 'FAIL';
interface TenantValidation {
  generated_at: string;
  overall: Status;
  summary: { pass: number; warn: number; fail: number };
  areas: { area: string; status: Status; detail: string; checks: { name: string; status: Status; detail: string }[] }[];
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
function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    WARN: 'bg-amber-50 text-amber-700 border-amber-200',
    FAIL: 'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}
function SeatBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    near_cap: { label: 'Near cap', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    over_cap: { label: 'Over cap', cls: 'bg-red-50 text-red-700 border-red-200' },
    no_cap: { label: 'No cap', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  const m = map[status] ?? map.no_cap;
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

type ViewKey = 'management' | 'isolation' | 'configuration' | 'validation' | 'partner';

export default function MultiTenantArchitecturePanel() {
  const [view, setView] = useState<ViewKey>('management');

  // Phase 6.12 — Partner Ecosystem sub-tab gate. The partner routes have their own flag; when OFF the
  // ping 503s and the tab self-hides → byte-identical to the 6.11 panel.
  const { data: partnerEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/tenant-architecture/console/partner-ecosystem/ping', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/partner-ecosystem/ping', { credentials: 'include' });
      return res.ok;
    },
  });

  const management = useQuery<TenantManagement>({
    queryKey: ['/api/admin/tenant-architecture/console/management'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/management', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'management',
  });
  const isolation = useQuery<TenantIsolationAudit>({
    queryKey: ['/api/admin/tenant-architecture/console/isolation'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/isolation', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'isolation',
  });
  const configuration = useQuery<TenantConfiguration>({
    queryKey: ['/api/admin/tenant-architecture/console/configuration'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/configuration', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'configuration',
  });
  const enforcement = useQuery<EnforcementStatus>({
    queryKey: ['/api/admin/tenant-architecture/console/enforcement'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/enforcement', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'isolation',
  });
  const validation = useQuery<TenantValidation>({
    queryKey: ['/api/admin/tenant-architecture/console/validation'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenant-architecture/console/validation', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: view === 'validation',
  });

  const active = view === 'management' ? management : view === 'isolation' ? isolation
    : view === 'configuration' ? configuration : view === 'validation' ? validation : management;
  const tabs: { key: ViewKey; label: string; icon: any }[] = [
    { key: 'management', label: 'Management', icon: Building2 },
    { key: 'isolation', label: 'Isolation Audit', icon: ShieldCheck },
    { key: 'configuration', label: 'Configuration', icon: Settings },
    ...(partnerEnabled ? [{ key: 'partner' as ViewKey, label: 'Partner Ecosystem', icon: Handshake }] : []),
    { key: 'validation', label: 'Validation', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <Building2 className="h-6 w-6" /> Multi-Tenant Architecture
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Unified tenant management across Institutions, Employers, Partners, Franchise and Channel Partners —
            with a tenant-isolation audit, configuration view and honesty harness. Read-only; honest empties
            where nothing is provisioned yet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => active.refetch()} disabled={active.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${active.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              view === t.key ? 'text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            style={view === t.key ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : undefined}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {active.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {active.isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load this view.
        </CardContent></Card>
      )}

      {/* ── Management ───────────────────────────────────────────────────────── */}
      {view === 'management' && management.data && (
        <>
          {management.data.degraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Some sources were unreadable; figures reflect available data only.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Building2} label="Total Tenants" value={formatNum(management.data.headline.total_tenants)} sub={`${formatNum(management.data.headline.active_tenants)} active`} />
            <Stat icon={Users} label="Seats" value={formatNum(management.data.headline.total_seats)} sub={`${formatNum(management.data.headline.active_users)} active users · ${formatPct(management.data.headline.seat_utilization_pct)}`} />
            <Stat icon={Network} label="Relationships" value={formatNum(management.data.headline.relationships)} sub={`${formatNum(management.data.headline.partner_agreements)} agreements`} />
            <Stat icon={Layers} label="Channel Referrals" value={formatNum(management.data.headline.channel_referrals)} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Categories</CardTitle>
              <CardDescription>Tenant distribution across the five first-class categories</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Category</TableHead><TableHead className="text-right">Tenants</TableHead>
                  <TableHead className="text-right">Active</TableHead><TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Active Users</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {management.data.categories.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium">{CATEGORY_LABEL[c.category] ?? c.category}</TableCell>
                      <TableCell className="text-right">{formatNum(c.tenants)}</TableCell>
                      <TableCell className="text-right">{formatNum(c.active)}</TableCell>
                      <TableCell className="text-right">{formatNum(c.seats)}</TableCell>
                      <TableCell className="text-right">{formatNum(c.active_users)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Tenants</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tenant</TableHead><TableHead>Category</TableHead><TableHead>Tier</TableHead>
                  <TableHead className="text-right">Seats</TableHead><TableHead className="text-right">Util</TableHead>
                  <TableHead className="text-right">Children</TableHead><TableHead className="text-right">Agreements</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {management.data.tenants.length === 0
                    ? <EmptyRow cols={7} text="No tenants yet." />
                    : management.data.tenants.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.tenant_name}<span className="ml-1 text-xs text-gray-400">{t.tenant_code}</span></TableCell>
                        <TableCell>{CATEGORY_LABEL[t.category] ?? t.category}</TableCell>
                        <TableCell className="capitalize">{t.subscription_tier ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatNum(t.active_users)}/{formatNum(t.max_users)}</TableCell>
                        <TableCell className="text-right">{formatPct(t.seat_utilization_pct)}</TableCell>
                        <TableCell className="text-right">{formatNum(t.child_count)}</TableCell>
                        <TableCell className="text-right">{formatNum(t.partner_agreements)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {management.data.relationships.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4" /> Relationships</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Parent</TableHead><TableHead>Child</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {management.data.relationships.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.parent_name ?? `#${r.parent_tenant_id}`}</TableCell>
                        <TableCell>{r.child_name ?? `#${r.child_tenant_id}`}</TableCell>
                        <TableCell className="capitalize">{r.relationship_type}</TableCell>
                        <TableCell className="capitalize">{r.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {management.data.notes.length > 0 && <NoteCard notes={management.data.notes} />}
          <GeneratedAt at={management.data.generated_at} />
        </>
      )}

      {/* ── Isolation ────────────────────────────────────────────────────────── */}
      {view === 'isolation' && isolation.data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Lock} label="Isolation Index" value={isolation.data.summary.isolation_index == null ? '—' : formatPct(isolation.data.summary.isolation_index)} sub={`${formatNum(isolation.data.summary.measurable_tables)} measurable tables`} />
            <Stat icon={Layers} label="Tenant-Scoped Tables" value={formatNum(isolation.data.summary.tenant_scoped_tables)} sub={`${formatNum(isolation.data.summary.namespaces)} namespaces`} />
            <Stat icon={ShieldCheck} label="Fully Isolated" value={formatNum(isolation.data.summary.fully_isolated_tables)} sub={`${formatNum(isolation.data.summary.tables_with_null_tenant)} with null tenant`} />
            <Stat icon={AlertTriangle} label="Tables w/ Orphans" value={formatNum(isolation.data.summary.tables_with_orphans)} sub={`${formatNum(isolation.data.summary.deep_scanned)} deep-scanned`} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Isolation Gaps</CardTitle>
              <CardDescription>Measurable tenant-scoped tables holding rows with a NULL or orphan tenant_id</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Table</TableHead><TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Null tenant</TableHead><TableHead className="text-right">Orphans</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isolation.data.gaps.length === 0
                    ? <EmptyRow cols={5} text="No isolation gaps in measurable tables." />
                    : isolation.data.gaps.map((g) => (
                      <TableRow key={g.table}>
                        <TableCell className="font-mono text-xs">{g.table}</TableCell>
                        <TableCell className="text-right">{formatNum(g.total_rows)}</TableCell>
                        <TableCell className="text-right text-amber-700">{formatNum(g.null_tenant_rows)}</TableCell>
                        <TableCell className="text-right text-red-700">{formatNum(g.orphan_tenant_rows)}</TableCell>
                        <TableCell className="text-right">{formatPct(g.coverage_pct)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Namespaces</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Namespace</TableHead><TableHead className="text-right">Tables</TableHead>
                  <TableHead className="text-right">Measurable</TableHead><TableHead className="text-right">Fully Isolated</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isolation.data.namespaces.slice(0, 40).map((n) => (
                    <TableRow key={n.namespace}>
                      <TableCell className="font-mono text-xs">{n.namespace}_*</TableCell>
                      <TableCell className="text-right">{formatNum(n.tables)}</TableCell>
                      <TableCell className="text-right">{formatNum(n.measurable)}</TableCell>
                      <TableCell className="text-right">{formatNum(n.fully_isolated)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {isolation.data.notes.length > 0 && <NoteCard notes={isolation.data.notes} />}

          {/* Enforcement posture (opt-in RLS). Separate axis from the coverage audit above. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Enforcement Posture</CardTitle>
              <CardDescription>
                Opt-in RLS arming on the additive relationship tables. Armed status is distinct from
                isolation coverage — nothing is rewritten on the legacy path.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {enforcement.isLoading && <p className="text-sm text-gray-500">Loading enforcement status…</p>}
              {enforcement.isError && (
                <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> Could not load enforcement status.</p>
              )}
              {enforcement.data && (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={enforcement.data.enforcement_flag ? 'border-emerald-200 text-emerald-700' : 'border-gray-200 text-gray-500'}>
                      Enforcement flag: {enforcement.data.enforcement_flag ? 'ON' : 'OFF'}
                    </Badge>
                    <Badge variant="outline" className="border-gray-200 text-gray-600">
                      Armed {formatNum(enforcement.data.armed_count)} / {formatNum(enforcement.data.armable_count)}
                    </Badge>
                    <Badge variant="outline" className={enforcement.data.guard_available ? 'border-emerald-200 text-emerald-700' : 'border-gray-200 text-gray-400'}>
                      Scope guard: {enforcement.data.guard_available ? 'available' : 'unavailable'}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Table</TableHead><TableHead>Present</TableHead><TableHead>RLS</TableHead>
                      <TableHead>Forced</TableHead><TableHead className="text-right">Policies</TableHead><TableHead>Armed</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {enforcement.data.tables.map((t) => (
                        <TableRow key={t.table}>
                          <TableCell className="font-mono text-xs">{t.table}</TableCell>
                          <TableCell>{t.exists ? 'yes' : 'no'}</TableCell>
                          <TableCell>{t.rls_enabled ? 'enabled' : 'disabled'}</TableCell>
                          <TableCell>{t.rls_forced ? 'forced' : 'no'}</TableCell>
                          <TableCell className="text-right">{formatNum(t.policies.length)}</TableCell>
                          <TableCell>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                              t.armed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}>{t.armed ? 'Armed' : 'Not armed'}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {enforcement.data.notes.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {enforcement.data.notes.map((n, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-xs text-gray-500"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {n}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <GeneratedAt at={isolation.data.generated_at} />
        </>
      )}

      {/* ── Configuration ────────────────────────────────────────────────────── */}
      {view === 'configuration' && configuration.data && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" /> Config Substrate</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {Object.entries(configuration.data.substrate).map(([k, v]) => (
                <Badge key={k} variant="outline" className={v ? 'border-emerald-200 text-emerald-700' : 'border-gray-200 text-gray-400'}>
                  {k.replace(/_/g, ' ')}: {v ? 'present' : 'absent'}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Tier Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tier</TableHead><TableHead className="text-right">Tenants</TableHead><TableHead className="text-right">Seats</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {configuration.data.tier_distribution.length === 0
                    ? <EmptyRow cols={3} text="No tiers configured." />
                    : configuration.data.tier_distribution.map((t) => (
                      <TableRow key={t.tier}>
                        <TableCell className="font-medium capitalize">{t.tier}</TableCell>
                        <TableCell className="text-right">{formatNum(t.tenants)}</TableCell>
                        <TableCell className="text-right">{formatNum(t.seats)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Per-Tenant Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tenant</TableHead><TableHead>Tier</TableHead><TableHead className="text-right">Seats</TableHead>
                  <TableHead>Seat Status</TableHead><TableHead>Branding</TableHead><TableHead className="text-right">Permissions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {configuration.data.tenants.length === 0
                    ? <EmptyRow cols={6} text="No tenants yet." />
                    : configuration.data.tenants.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.tenant_name}</TableCell>
                        <TableCell className="capitalize">{t.subscription_tier ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatNum(t.active_users)}/{formatNum(t.max_users)}</TableCell>
                        <TableCell><SeatBadge status={t.seat_status} /></TableCell>
                        <TableCell>{t.has_branding ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell className="text-right">{t.permission_count == null ? '—' : formatNum(t.permission_count)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {configuration.data.notes.length > 0 && <NoteCard notes={configuration.data.notes} />}
          <GeneratedAt at={configuration.data.generated_at} />
        </>
      )}

      {/* ── Validation ───────────────────────────────────────────────────────── */}
      {view === 'validation' && validation.data && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Overall:</span>
            <StatusBadge status={validation.data.overall} />
            <span className="text-xs text-gray-400">
              {validation.data.summary.pass} pass · {validation.data.summary.warn} warn · {validation.data.summary.fail} fail
            </span>
          </div>
          {validation.data.areas.map((a) => (
            <Card key={a.area}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">{a.area} <StatusBadge status={a.status} /></CardTitle>
                <CardDescription>{a.detail}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {a.checks.map((c) => (
                  <div key={c.name} className="flex items-start gap-2 text-xs">
                    <StatusBadge status={c.status} />
                    <span className="font-mono text-gray-500">{c.name}</span>
                    <span className="text-gray-600">— {c.detail}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          <GeneratedAt at={validation.data.generated_at} />
        </>
      )}

      {/* ── Partner Ecosystem (Phase 6.12) ───────────────────────────────────── */}
      {view === 'partner' && <PartnerEcosystemView />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Phase 6.12 — Partner Ecosystem sub-view (agreement lifecycle · referral attribution · payouts).
// ════════════════════════════════════════════════════════════════════════════════
const P_BASE = '/api/admin/tenant-architecture/console/partner-ecosystem';

interface PartnerMeta {
  partner_types: string[];
  agreement_statuses: string[];
  agreement_transitions: Record<string, string[]>;
  referral_statuses: string[];
  referral_transitions: Record<string, string[]>;
}
interface PAgreement {
  id: number; tenant_id: number; tenant_name: string | null; tenant_code: string | null;
  partner_type: string; agreement_code: string; status: string; commission_pct: number | null;
  start_date: string | null; end_date: string | null; updated_at: string | null;
}
interface PReferral {
  id: number; channel_partner_tenant_id: number; channel_partner_name: string | null;
  referred_tenant_id: number | null; referred_tenant_name: string | null; referral_code: string;
  status: string; commission_pct: number | null; commission_amount: number | null; currency: string;
  deal_value: number | null; deal_value_source: string | null; commission_amount_source: string | null;
  referred_at: string | null; converted_at: string | null;
}
interface PPayout {
  channel_partner_tenant_id: number; channel_partner_name: string | null; referrals_total: number;
  converted: number; pending: number; expired: number; rejected: number; earned_commission: number;
  currencies: string[]; converted_without_amount: number; auto_derived: number;
}
interface PartnerEco {
  generated_at: string; degraded: boolean;
  substrate: { agreements_table: boolean; referrals_table: boolean; events_table: boolean };
  headline: {
    total_agreements: number; agreements_by_status: Record<string, number>; total_referrals: number;
    referrals_by_status: Record<string, number>; conversion_rate_pct: number | null;
    total_earned_commission: number; partners_with_payouts: number; converted_without_amount: number;
    auto_derived_count: number;
  };
  agreements: PAgreement[]; referrals: PReferral[]; payouts: PPayout[]; notes: string[];
}

const AGREEMENT_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  terminated: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
};
const REFERRAL_BADGE: Record<string, string> = {
  pending: 'bg-blue-50 text-blue-700 border-blue-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

function PartnerEcosystemView() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const eco = useQuery<PartnerEco>({
    queryKey: [P_BASE],
    queryFn: async () => {
      const r = await fetch(P_BASE, { credentials: 'include' });
      if (!r.ok) throw new Error('failed to load partner ecosystem');
      return r.json();
    },
  });
  const meta = useQuery<PartnerMeta>({
    queryKey: [`${P_BASE}/meta`],
    queryFn: async () => {
      const r = await fetch(`${P_BASE}/meta`, { credentials: 'include' });
      if (!r.ok) throw new Error('failed to load meta');
      return r.json();
    },
  });

  // New-agreement form state
  const [agTenant, setAgTenant] = useState('');
  const [agType, setAgType] = useState('channel');
  const [agCode, setAgCode] = useState('');
  const [agPct, setAgPct] = useState('');
  // New-referral form state
  const [rfPartner, setRfPartner] = useState('');
  const [rfReferred, setRfReferred] = useState('');
  const [rfCode, setRfCode] = useState('');
  const [rfPct, setRfPct] = useState('');
  const [rfAmount, setRfAmount] = useState('');
  const [rfDeal, setRfDeal] = useState('');

  function exportCsv(path: string) {
    window.open(`${P_BASE}${path}`, '_blank');
  }

  async function post(path: string, body: any) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${P_BASE}${path}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(data?.message || data?.error || `request failed (${r.status})`); return false; }
      await qc.invalidateQueries({ queryKey: [P_BASE] });
      return true;
    } catch (e: any) {
      setErr(e?.message || 'request failed'); return false;
    } finally {
      setBusy(false);
    }
  }

  if (eco.isLoading) return <p className="text-sm text-gray-500">Loading partner ecosystem…</p>;
  if (eco.isError || !eco.data) return <p className="text-sm text-red-600">Failed to load partner ecosystem.</p>;
  const d = eco.data;
  const m = meta.data;
  const noSubstrate = !d.substrate.agreements_table && !d.substrate.referrals_table;

  return (
    <div className="space-y-5">
      {err && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {err}
        </div>
      )}

      {noSubstrate && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-gray-600">Partner substrate not provisioned yet.</p>
            <Button size="sm" disabled={busy} onClick={() => post('/setup', {})}>Provision tables</Button>
          </CardContent>
        </Card>
      )}

      {/* Headline */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PStat label="Agreements" value={d.headline.total_agreements} icon={Handshake} />
        <PStat label="Referrals" value={d.headline.total_referrals} icon={GitBranch} />
        <PStat label="Conversion" value={d.headline.conversion_rate_pct == null ? '—' : `${d.headline.conversion_rate_pct}%`} icon={CheckCircle2} />
        <PStat label="Earned commission" value={d.headline.total_earned_commission} icon={Wallet} />
      </div>

      {/* Agreements */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Handshake className="h-4 w-4" /> Partner Agreements</CardTitle>
              <CardDescription>Lifecycle: draft → active → suspended/expired → terminated.</CardDescription>
            </div>
            <Button size="sm" variant="outline" disabled={d.agreements.length === 0}
              onClick={() => exportCsv('/agreements/export.csv')}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New agreement form */}
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-3">
            <Field label="Tenant ID"><input className="h-8 rounded border border-gray-300 px-2 text-sm" value={agTenant} onChange={(e) => setAgTenant(e.target.value)} placeholder="e.g. 1" /></Field>
            <Field label="Type">
              <select className="h-8 rounded border border-gray-300 px-2 text-sm" value={agType} onChange={(e) => setAgType(e.target.value)}>
                {(m?.partner_types ?? ['channel']).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Agreement code"><input className="h-8 rounded border border-gray-300 px-2 text-sm" value={agCode} onChange={(e) => setAgCode(e.target.value)} placeholder="AGR-001" /></Field>
            <Field label="Commission %"><input className="h-8 w-24 rounded border border-gray-300 px-2 text-sm" value={agPct} onChange={(e) => setAgPct(e.target.value)} placeholder="10" /></Field>
            <Button size="sm" disabled={busy || !agTenant || !agCode} onClick={async () => {
              const ok = await post('/agreements', { tenant_id: agTenant, partner_type: agType, agreement_code: agCode, commission_pct: agPct || null });
              if (ok) { setAgCode(''); setAgPct(''); }
            }}><Plus className="mr-1 h-3.5 w-3.5" /> Save (draft)</Button>
          </div>

          {d.agreements.length === 0 ? (
            <p className="text-sm text-gray-500">No agreements yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Tenant</TableHead><TableHead>Type</TableHead>
                  <TableHead>Commission</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.agreement_code}</TableCell>
                    <TableCell className="text-sm">{a.tenant_name || `#${a.tenant_id}`}</TableCell>
                    <TableCell className="text-sm">{a.partner_type}</TableCell>
                    <TableCell className="text-sm">{a.commission_pct == null ? '—' : `${a.commission_pct}%`}</TableCell>
                    <TableCell><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${AGREEMENT_BADGE[a.status] ?? 'bg-gray-100 text-gray-600'}`}>{a.status}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m?.agreement_transitions[a.status] ?? []).map((to) => (
                          <Button key={to} size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={busy}
                            onClick={() => post(`/agreements/${a.id}/transition`, { status: to })}>→ {to}</Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Referrals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" /> Channel Referrals</CardTitle>
              <CardDescription>Attribution from a channel-partner tenant to a referred tenant; status drives payouts.</CardDescription>
            </div>
            <Button size="sm" variant="outline" disabled={d.referrals.length === 0}
              onClick={() => exportCsv('/referrals/export.csv')}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-gray-100 bg-gray-50 p-3">
            <Field label="Partner tenant ID"><input className="h-8 rounded border border-gray-300 px-2 text-sm" value={rfPartner} onChange={(e) => setRfPartner(e.target.value)} placeholder="1" /></Field>
            <Field label="Referred tenant ID"><input className="h-8 rounded border border-gray-300 px-2 text-sm" value={rfReferred} onChange={(e) => setRfReferred(e.target.value)} placeholder="(optional)" /></Field>
            <Field label="Referral code"><input className="h-8 rounded border border-gray-300 px-2 text-sm" value={rfCode} onChange={(e) => setRfCode(e.target.value)} placeholder="REF-001" /></Field>
            <Field label="Commission %"><input className="h-8 w-24 rounded border border-gray-300 px-2 text-sm" value={rfPct} onChange={(e) => setRfPct(e.target.value)} placeholder="5" /></Field>
            <Field label="Amount"><input className="h-8 w-28 rounded border border-gray-300 px-2 text-sm" value={rfAmount} onChange={(e) => setRfAmount(e.target.value)} placeholder="(optional)" /></Field>
            <Field label="Deal value"><input className="h-8 w-28 rounded border border-gray-300 px-2 text-sm" value={rfDeal} onChange={(e) => setRfDeal(e.target.value)} placeholder="(optional)" /></Field>
            <Button size="sm" disabled={busy || !rfPartner || !rfCode} onClick={async () => {
              const ok = await post('/referrals', {
                channel_partner_tenant_id: rfPartner, referred_tenant_id: rfReferred || null,
                referral_code: rfCode, commission_pct: rfPct || null, commission_amount: rfAmount || null,
                deal_value: rfDeal || null,
              });
              if (ok) { setRfCode(''); setRfPct(''); setRfAmount(''); setRfReferred(''); setRfDeal(''); }
            }}><Plus className="mr-1 h-3.5 w-3.5" /> Add referral</Button>
          </div>

          {d.referrals.length === 0 ? (
            <p className="text-sm text-gray-500">No referrals yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Partner</TableHead><TableHead>Referred</TableHead>
                  <TableHead>Deal value</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.referrals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.referral_code}</TableCell>
                    <TableCell className="text-sm">{r.channel_partner_name || `#${r.channel_partner_tenant_id}`}</TableCell>
                    <TableCell className="text-sm">{r.referred_tenant_name || (r.referred_tenant_id ? `#${r.referred_tenant_id}` : '—')}</TableCell>
                    <TableCell className="text-sm">
                      {r.deal_value == null ? '—' : <span>{r.deal_value} {r.currency}{r.deal_value_source ? <span className="ml-1 text-xs text-gray-400">({r.deal_value_source})</span> : null}</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.commission_amount == null ? '—' : <span>{r.commission_amount} {r.currency}{r.commission_amount_source === 'derived' ? <span className="ml-1 text-xs text-blue-500">(auto)</span> : null}</span>}
                    </TableCell>
                    <TableCell><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${REFERRAL_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m?.referral_transitions[r.status] ?? []).map((to) => (
                          <Button key={to} size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={busy}
                            onClick={() => {
                              if (to === 'converted') {
                                const raw = window.prompt(
                                  'Deal value for this conversion (currency units).\n' +
                                  '• Enter a number to set it explicitly.\n' +
                                  '• Leave blank to auto-link from the referred tenant\'s subscriptions/payments.\n' +
                                  '• Enter 0 (or "none") to record no deal value.',
                                  '',
                                );
                                if (raw === null) return; // cancelled
                                const trimmed = raw.trim();
                                if (trimmed === '') { post(`/referrals/${r.id}/transition`, { status: to, link_deal: true }); return; }
                                if (trimmed.toLowerCase() === 'none') { post(`/referrals/${r.id}/transition`, { status: to }); return; }
                                const num = Number(trimmed);
                                if (!Number.isFinite(num) || num < 0) { setErr('Deal value must be a non-negative number.'); return; }
                                if (num === 0) { post(`/referrals/${r.id}/transition`, { status: to }); return; } // 0 == no deal value
                                post(`/referrals/${r.id}/transition`, { status: to, deal_value: num });
                                return;
                              }
                              post(`/referrals/${r.id}/transition`, { status: to });
                            }}>→ {to}</Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payouts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Commission Payouts</CardTitle>
              <CardDescription>Read-only. Earned = sum of converted-referral amounts — explicit, or auto-derived as commission&nbsp;%&nbsp;×&nbsp;deal&nbsp;value. Converted referrals with neither an amount nor a linkable deal value are an explicit coverage gap, never inferred.</CardDescription>
            </div>
            <Button size="sm" variant="outline" disabled={d.payouts.length === 0}
              onClick={() => exportCsv('/payouts/export.csv')}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {d.payouts.length === 0 ? (
            <p className="text-sm text-gray-500">No payouts to compute yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead><TableHead>Referrals</TableHead><TableHead>Converted</TableHead>
                  <TableHead>Earned</TableHead><TableHead>Auto-derived</TableHead><TableHead>Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.payouts.map((p) => (
                  <TableRow key={p.channel_partner_tenant_id}>
                    <TableCell className="text-sm">{p.channel_partner_name || `#${p.channel_partner_tenant_id}`}</TableCell>
                    <TableCell className="text-sm">{p.referrals_total}</TableCell>
                    <TableCell className="text-sm">{p.converted}</TableCell>
                    <TableCell className="text-sm font-medium">{p.earned_commission}{p.currencies.length ? ` ${p.currencies.join('/')}` : ''}</TableCell>
                    <TableCell className="text-sm">{p.auto_derived > 0 ? <span className="text-blue-600">{p.auto_derived}</span> : '—'}</TableCell>
                    <TableCell className="text-sm">{p.converted_without_amount > 0 ? <span className="text-amber-600">{p.converted_without_amount} no amount</span> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {d.notes.length > 0 && <NoteCard notes={d.notes} />}
      <GeneratedAt at={d.generated_at} />
    </div>
  );
}

function PStat({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-gray-100 p-2"><Icon className="h-4 w-4 text-gray-600" /></div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-semibold text-gray-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function NoteCard({ notes }: { notes: string[] }) {
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4">
        {notes.map((n, i) => (
          <p key={i} className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {n}</p>
        ))}
      </CardContent>
    </Card>
  );
}
function GeneratedAt({ at }: { at: string }) {
  return <p className="text-right text-xs text-gray-400">Generated {new Date(at).toLocaleString('en-IN')}</p>;
}
