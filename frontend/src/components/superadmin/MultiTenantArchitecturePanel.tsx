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
import { useQuery } from '@tanstack/react-query';
import {
  Building2, ShieldCheck, Settings, CheckCircle2, AlertTriangle, RefreshCw, Info,
  Network, Users, Layers, Lock,
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

type ViewKey = 'management' | 'isolation' | 'configuration' | 'validation';

export default function MultiTenantArchitecturePanel() {
  const [view, setView] = useState<ViewKey>('management');

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
    : view === 'configuration' ? configuration : validation;
  const tabs: { key: ViewKey; label: string; icon: any }[] = [
    { key: 'management', label: 'Management', icon: Building2 },
    { key: 'isolation', label: 'Isolation Audit', icon: ShieldCheck },
    { key: 'configuration', label: 'Configuration', icon: Settings },
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
    </div>
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
