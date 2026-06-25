import { BRAND } from '@/design-system/tokens';
/**
 * Phase 6.9 — Enterprise Governance console (READ-ONLY).
 * Surfaces the composite governance overview: a transparent Compliance posture index + RBAC /
 * Security Center, Approval Workflows, Audit Trails and Data Governance.
 *
 * Reads GET /api/admin/governance/console/overview. The tab is only rendered when the
 * `enterpriseGovernanceConsole` flag is ON (the SuperAdminDashboard probes /console/ping before
 * mounting this panel), so flag-OFF is byte-identical legacy. Every figure is REAL recorded
 * governance activity; absent substrate renders honest "not activated / no data yet" states —
 * never fabricated numbers.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, Shield, Lock, ScrollText, ClipboardCheck, FileWarning,
  AlertTriangle, RefreshCw, Info, Gauge, KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';



function formatNum(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

interface AuditTrailView {
  substrate: { admin_audit_logs: boolean; rbac_failed_logins: boolean };
  audit: {
    total: number; last_30d: number;
    by_category: { category: string; events: number }[];
    recent: { id: any; admin_user_id: string | null; action_type: string | null; target_type: string | null; category: string; ip_address: string | null; created_at: any }[];
  };
  failed_logins: { total: number; last_24h: number; recent: { id: any; email: string | null; ip_address: string | null; reason: string | null; created_at: any }[] };
  notes: string[];
}
interface ApprovalWorkflowView {
  substrate: { rbac_approval_requests: boolean; intervention_approvals: boolean };
  totals: { total: number; pending: number; approved: number; rejected: number; other: number };
  rbac_approvals: { total: number; by_status: { status: string; count: number }[]; by_type: { type: string; count: number }[] };
  intervention_approvals: { total: number; by_status: { status: string; count: number }[]; by_priority: { priority: string; count: number }[] };
  pending_queue: { source: string; id: any; type: string; label: string | null; status: string; requested_by: string | null; created_at: any }[];
  notes: string[];
}
interface SecurityCenterView {
  substrate: Record<string, boolean>;
  rbac: { roles: number; permissions: number; grants: number; hierarchies: number; permission_groups: number; admin_status_rows: number };
  live_vs_formal: { live_super_admins: number | null; formal_roles: number; note: string };
  flag_changes: { total: number; recent: { id: any; flag_key: string; old_value: string | null; new_value: string | null; changed_by_email: string | null; created_at: any }[] };
  suspicious_activity: { window_hours: number; threshold: number; items: { key: string; email: string | null; ip: string | null; attempts: number; last_attempt: any }[] };
  notes: string[];
}
interface DataGovernanceView {
  substrate: { governance_events: boolean };
  total: number; last_30d: number; consent_events: number; data_access_events: number; risk_flag_events: number;
  by_type: { event_type: string; count: number }[];
  by_severity: { severity: string; count: number }[];
}
interface EnterpriseGovernanceOverview {
  generated_at: string;
  degraded: boolean;
  headline: {
    roles: number; permissions: number; audit_events_30d: number; pending_approvals: number;
    failed_logins_24h: number; data_governance_events_30d: number; compliance_score: number | null;
  };
  compliance: { measurable: boolean; score: number | null; pillars: { key: string; value: number; weight: number }[]; reason?: string };
  data_governance: DataGovernanceView;
  audit: AuditTrailView;
  approvals: ApprovalWorkflowView;
  security: SecurityCenterView;
  notes: string[];
}

const PILLAR_LABEL: Record<string, string> = {
  rbac_defined: 'RBAC catalogue defined',
  audit_active: 'Audit logging active',
  approvals_resolved: 'Approvals resolved',
  datagov_tracked: 'Data governance tracked',
};

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

export default function EnterpriseGovernancePanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<EnterpriseGovernanceOverview>({
    queryKey: ['/api/admin/governance/console/overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/governance/console/overview', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <ShieldCheck className="h-6 w-6" /> Enterprise Governance
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            RBAC &amp; security controls, approval workflows, audit trails, data governance and compliance —
            composed read-only from the existing governance subsystem. Honest empties where nothing is recorded yet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading governance overview…</p>}
      {isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load governance overview.
        </CardContent></Card>
      )}

      {data && (
        <>
          {data.degraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Some sources were unreadable or the governance subsystem is not fully activated; figures below reflect available data only.
            </div>
          )}

          {/* Compliance posture */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" /> Compliance Posture</CardTitle>
              <CardDescription>Transparent blend of RBAC definition, audit activity, approval resolution and data-governance tracking — weights renormalised over measurable pillars only.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {data.compliance.measurable ? (
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-4xl font-bold" style={{ color: BRAND.primary }}>{data.compliance.score}<span className="text-lg text-gray-400">/100</span></div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {data.compliance.pillars.map((p) => (
                      <div key={p.key} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5">
                        <span className="text-gray-500">{PILLAR_LABEL[p.key] ?? p.key}:</span>{' '}
                        <span className="font-semibold">{Math.round(p.value * 100)}%</span>{' '}
                        <span className="text-xs text-gray-400">(w {p.weight})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{data.compliance.reason ?? 'Not measurable yet.'}</p>
              )}
            </CardContent>
          </Card>

          {/* Headline metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Shield} label="RBAC Roles" value={formatNum(data.headline.roles)} sub={`${formatNum(data.headline.permissions)} permissions`} />
            <Stat icon={ScrollText} label="Audit Events (30d)" value={formatNum(data.headline.audit_events_30d)} />
            <Stat icon={ClipboardCheck} label="Pending Approvals" value={formatNum(data.headline.pending_approvals)} />
            <Stat icon={KeyRound} label="Failed Logins (24h)" value={formatNum(data.headline.failed_logins_24h)} sub={`${formatNum(data.headline.data_governance_events_30d)} data-gov events (30d)`} />
          </div>

          {/* RBAC / Security Center */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> RBAC &amp; Security Center</CardTitle>
              <CardDescription>{data.security.live_vs_formal.note}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-0 text-sm md:grid-cols-4 lg:grid-cols-6">
              <div><p className="text-gray-500">Roles</p><p className="text-lg font-semibold">{formatNum(data.security.rbac.roles)}</p></div>
              <div><p className="text-gray-500">Permissions</p><p className="text-lg font-semibold">{formatNum(data.security.rbac.permissions)}</p></div>
              <div><p className="text-gray-500">Grants</p><p className="text-lg font-semibold">{formatNum(data.security.rbac.grants)}</p></div>
              <div><p className="text-gray-500">Hierarchies</p><p className="text-lg font-semibold">{formatNum(data.security.rbac.hierarchies)}</p></div>
              <div><p className="text-gray-500">Permission groups</p><p className="text-lg font-semibold">{formatNum(data.security.rbac.permission_groups)}</p></div>
              <div><p className="text-gray-500">Live super admins</p><p className="text-lg font-semibold">{formatNum(data.security.live_vs_formal.live_super_admins)}</p></div>
            </CardContent>
          </Card>

          {/* Approvals + Suspicious activity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4" /> Approval Workflows</CardTitle>
                <CardDescription>
                  {formatNum(data.approvals.totals.total)} total · {formatNum(data.approvals.totals.pending)} pending · {formatNum(data.approvals.totals.approved)} approved · {formatNum(data.approvals.totals.rejected)} rejected
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Requested By</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.approvals.pending_queue.length === 0
                      ? <EmptyRow cols={3} text="No pending approvals." />
                      : data.approvals.pending_queue.map((r, i) => (
                        <TableRow key={`${r.source}-${r.id}-${i}`}>
                          <TableCell className="font-medium">{r.type}{r.label ? <span className="text-xs text-gray-400"> · {r.label}</span> : null}</TableCell>
                          <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                          <TableCell className="text-xs text-gray-500">{r.requested_by ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Suspicious Activity</CardTitle>
                <CardDescription>≥{data.security.suspicious_activity.threshold} failed logins from one key in {data.security.suspicious_activity.window_hours}h</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Key</TableHead><TableHead className="text-right">Attempts</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.security.suspicious_activity.items.length === 0
                      ? <EmptyRow cols={2} text="No suspicious login activity in window." />
                      : data.security.suspicious_activity.items.map((r, i) => (
                        <TableRow key={`${r.key}-${i}`}>
                          <TableCell className="font-medium">{r.email || r.ip || r.key}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.attempts)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Audit trail + Data governance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4" /> Audit Trail</CardTitle>
                <CardDescription>{formatNum(data.audit.audit.total)} total events · {formatNum(data.audit.audit.last_30d)} in last 30d</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Events</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.audit.audit.by_category.length === 0
                      ? <EmptyRow cols={2} text="No audit events recorded yet." />
                      : data.audit.audit.by_category.map((r, i) => (
                        <TableRow key={`${r.category}-${i}`}>
                          <TableCell className="font-medium capitalize">{r.category.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.events)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><FileWarning className="h-4 w-4" /> Data Governance</CardTitle>
                <CardDescription>
                  {formatNum(data.data_governance.consent_events)} consent · {formatNum(data.data_governance.data_access_events)} data-access · {formatNum(data.data_governance.risk_flag_events)} risk-flag events
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Event Type</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.data_governance.by_type.length === 0
                      ? <EmptyRow cols={2} text="No data-governance events captured yet." />
                      : data.data_governance.by_type.map((r, i) => (
                        <TableRow key={`${r.event_type}-${i}`}>
                          <TableCell className="font-medium">{r.event_type}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNum(r.count)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {(data.notes.length > 0 || data.audit.notes.length > 0 || data.approvals.notes.length > 0 || data.security.notes.length > 0) && (
            <Card>
              <CardContent className="space-y-1.5 p-4">
                {[...data.notes, ...data.audit.notes, ...data.approvals.notes, ...data.security.notes].map((n, i) => (
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
