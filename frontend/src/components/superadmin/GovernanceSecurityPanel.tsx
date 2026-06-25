import { BRAND } from '@/design-system/tokens';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, Users, Key, ScrollText, AlertTriangle, CheckCircle, XCircle,
  Clock, RefreshCw, Lock, GitBranch, Activity, Ban, Loader2, Info, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';



const j = (url: string) => fetch(url).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
}
const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-800', suspended: 'bg-amber-100 text-amber-800', terminated: 'bg-red-100 text-red-800',
  pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-700',
};

export default function GovernanceSecurityPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('rbac');
  const [permSearch, setPermSearch] = useState('');

  // Status drives flag-gating: a 503 means the governanceRbacV2 flag is OFF → hide the panel content.
  const statusQ = useQuery({
    queryKey: ['gov-status'],
    queryFn: () => j('/api/admin/governance/status'),
    retry: false,
  });

  const disabled = statusQ.data?.status === 503;
  const enabled = statusQ.data?.status === 200;

  // ── Data queries (only when enabled) ─────────────────────────────
  const matrixQ = useQuery({ queryKey: ['gov-matrix'], queryFn: () => j('/api/admin/governance/permission-matrix'), enabled });
  const hierQ = useQuery({ queryKey: ['gov-hierarchy'], queryFn: () => j('/api/admin/governance/role-hierarchy'), enabled });
  const adminsQ = useQuery({ queryKey: ['gov-admins'], queryFn: () => j('/api/admin/governance/admins'), enabled });
  const approvalsQ = useQuery({ queryKey: ['gov-approvals'], queryFn: () => j('/api/admin/governance/approvals'), enabled });
  const auditQ = useQuery({ queryKey: ['gov-audit'], queryFn: () => j('/api/admin/governance/audit?limit=300'), enabled });
  const secQ = useQuery({ queryKey: ['gov-security'], queryFn: () => j('/api/admin/governance/security-overview'), enabled });

  const seedMut = useMutation({
    mutationFn: () => fetch('/api/admin/governance/seed', { method: 'POST' }).then((r) => r.json()),
    onSuccess: (d) => {
      toast({ title: 'Seed complete', description: `roles ${d?.seeded?.roles ?? '—'} · perms ${d?.seeded?.permissions ?? '—'} (idempotent)` });
      qc.invalidateQueries({ queryKey: ['gov-matrix'] });
      qc.invalidateQueries({ queryKey: ['gov-status'] });
    },
    onError: () => toast({ title: 'Seed failed', variant: 'destructive' }),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      fetch(`/api/admin/governance/approvals/${id}/decide`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      }).then((r) => r.json()),
    onSuccess: () => { toast({ title: 'Decision recorded' }); qc.invalidateQueries({ queryKey: ['gov-approvals'] }); },
    onError: () => toast({ title: 'Decision failed', variant: 'destructive' }),
  });

  const matrix = matrixQ.data?.body || {};
  const roles: any[] = matrix.roles || [];
  const permissions: any[] = matrix.permissions || [];
  const grants: any[] = matrix.grants || [];
  const grantSet = useMemo(() => new Set(grants.map((g: any) => `${g.role_id}|${g.permission_id}`)), [grants]);
  const filteredPerms = useMemo(
    () => permissions.filter((p) => !permSearch || (p.permission_key || '').toLowerCase().includes(permSearch.toLowerCase())),
    [permissions, permSearch],
  );

  if (statusQ.isLoading) {
    return <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>;
  }

  // Flag OFF → byte-identical hide: render a calm disabled notice, no data surfaced.
  if (disabled) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="max-w-lg border-dashed">
          <CardContent className="p-8 text-center">
            <Lock className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Governance & Security is disabled</h3>
            <p className="text-sm text-slate-500">
              The <code className="px-1 bg-slate-100 rounded">governanceRbacV2</code> feature flag is OFF.
              Enable <code className="px-1 bg-slate-100 rounded">FF_GOVERNANCE_RBAC_V2</code> to activate operational
              RBAC, the audit trail and the security center.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const security = secQ.data?.body || {};

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: BRAND.primary }}>
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Governance & Security</h1>
            <p className="text-sm text-slate-500">Operational RBAC · audit trail · approvals · security center</p>
          </div>
        </div>
        <Button variant="outline" size="sm" disabled={seedMut.isPending} onClick={() => seedMut.mutate()}>
          {seedMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Re-seed canon
        </Button>
      </div>

      {/* Honesty banner */}
      <div className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>
          RBAC roles/permissions are the <strong>formal governance model</strong> (canonical system config). Live
          access enforcement remains the <strong>super_admin gate</strong>; these grants and admin-status changes are
          advisory and are not silently swapped into the runtime authorization path.
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Roles', value: roles.length, icon: Users, color: BRAND.primary },
          { label: 'Permissions', value: permissions.length, icon: Key, color: BRAND.accent },
          { label: 'Grants', value: grants.length, icon: GitBranch, color: BRAND.success },
          { label: 'Audit events', value: security?.auditEvents?.total ?? auditQ.data?.body?.total ?? 0, icon: ScrollText, color: BRAND.warning },
          { label: 'Failed logins', value: security?.failedLogins?.total ?? 0, icon: AlertTriangle, color: BRAND.danger },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}1a` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-800">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="rbac"><Key className="w-4 h-4 mr-1.5" /> RBAC Matrix</TabsTrigger>
          <TabsTrigger value="admins"><Users className="w-4 h-4 mr-1.5" /> Admin Directory</TabsTrigger>
          <TabsTrigger value="approvals"><CheckCircle className="w-4 h-4 mr-1.5" /> Approvals</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="w-4 h-4 mr-1.5" /> Audit Trail</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5" /> Security Center</TabsTrigger>
        </TabsList>

        {/* ── RBAC Matrix ── */}
        <TabsContent value="rbac" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Role × Permission matrix</CardTitle>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input className="pl-8 h-9 w-64" placeholder="Filter permissions…" value={permSearch} onChange={(e) => setPermSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!matrix.populated && (
                <div className="text-sm text-slate-500 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Matrix not populated — run “Re-seed canon”.
                </div>
              )}
              <ScrollArea className="w-full" style={{ maxHeight: 460 }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white">Permission</TableHead>
                      {roles.map((r) => (
                        <TableHead key={r.id} className="text-center whitespace-nowrap text-xs">{r.display_name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPerms.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="sticky left-0 bg-white font-mono text-xs whitespace-nowrap">{p.permission_key}</TableCell>
                        {roles.map((r) => (
                          <TableCell key={r.id} className="text-center">
                            {grantSet.has(`${r.id}|${p.id}`)
                              ? <CheckCircle className="w-4 h-4 mx-auto" style={{ color: BRAND.success }} />
                              : <span className="text-slate-200">·</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><GitBranch className="w-4 h-4" /> Role hierarchy</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(hierQ.data?.body?.hierarchy || []).map((h: any, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">{h.parent_role} → {h.child_role}</Badge>
              ))}
              {(hierQ.data?.body?.hierarchy || []).length === 0 && <span className="text-sm text-slate-500">No hierarchy edges.</span>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Admin Directory ── */}
        <TabsContent value="admins">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Admin directory <span className="text-xs font-normal text-slate-400">(status is advisory)</span></CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Changed</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(adminsQ.data?.body?.admins || []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.email}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.role}</Badge></TableCell>
                      <TableCell><Badge className={`text-xs ${statusColor[a.status] || 'bg-gray-100 text-gray-700'}`}>{a.status}</Badge></TableCell>
                      <TableCell className="text-xs text-slate-500">{a.changed_at ? fmtDateTime(a.changed_at) : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(adminsQ.data?.body?.admins || []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-slate-400 py-6">No admin-class users found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Approvals ── */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Approval requests</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Type</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead><TableHead>Requested</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(approvalsQ.data?.body?.requests || []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium">{r.request_type}</TableCell>
                      <TableCell className="text-sm text-slate-600">{r.target_label || r.target_ref || '—'}</TableCell>
                      <TableCell><Badge className={`text-xs ${statusColor[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</Badge></TableCell>
                      <TableCell className="text-xs text-slate-500">{fmtDateTime(r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex gap-1.5 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={decideMut.isPending}
                              onClick={() => decideMut.mutate({ id: String(r.id), decision: 'approved' })}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" disabled={decideMut.isPending}
                              onClick={() => decideMut.mutate({ id: String(r.id), decision: 'rejected' })}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(approvalsQ.data?.body?.requests || []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-slate-400 py-6">No approval requests recorded yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audit Trail ── */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audit trail</CardTitle>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {Object.entries(auditQ.data?.body?.byCategory || {}).map(([cat, n]: any) => (
                  <Badge key={cat} variant="outline" className="text-xs">{cat}: {n}</Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea style={{ maxHeight: 460 }}>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Category</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>When</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditQ.data?.body?.events || []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell><Badge variant="outline" className="text-xs">{e.category}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{e.action_type}</TableCell>
                        <TableCell className="text-xs text-slate-600">{e.target_type || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{fmtDateTime(e.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {(auditQ.data?.body?.events || []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-slate-400 py-6">No audit events recorded yet (honest zero).</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Center ── */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Suspicious activity <span className="text-xs font-normal text-slate-400">(≥{security?.suspiciousActivity?.threshold ?? 5} fails / {security?.suspiciousActivity?.windowHours ?? 24}h)</span></CardTitle></CardHeader>
            <CardContent>
              {(security?.suspiciousActivity?.items || []).length === 0 ? (
                <div className="text-sm text-slate-500 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> No suspicious activity in window.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Attempts</TableHead><TableHead>Last</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {security.suspiciousActivity.items.map((s: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{s.email || s.ip || s.key}</TableCell>
                        <TableCell><Badge className="bg-red-100 text-red-700 text-xs">{s.attempts}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-500">{fmtDateTime(s.lastAttempt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Ban className="w-4 h-4 text-red-500" /> Failed logins</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea style={{ maxHeight: 300 }}>
                <Table>
                  <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>IP</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(security?.failedLogins?.recent || []).map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm">{f.email || '—'}</TableCell>
                        <TableCell className="text-xs">{f.ip_address || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-600">{f.reason}</TableCell>
                        <TableCell className="text-xs text-slate-500">{fmtDateTime(f.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {(security?.failedLogins?.recent || []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-slate-400 py-6">No failed logins recorded.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Feature-flag changes</CardTitle></CardHeader>
            <CardContent>
              {(security?.flagChanges?.recent || []).length === 0 ? (
                <div className="text-sm text-slate-500">No flag changes recorded.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Flag</TableHead><TableHead>Change</TableHead><TableHead>By</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {security.flagChanges.recent.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-mono">{c.flag_key}</TableCell>
                        <TableCell className="text-xs">{c.old_value} → {c.new_value}</TableCell>
                        <TableCell className="text-xs">{c.changed_by_email || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500">{fmtDateTime(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
