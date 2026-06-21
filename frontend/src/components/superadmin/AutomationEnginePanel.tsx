/**
 * Phase 6.13 — Automation Engine console (READ-ONLY).
 * Surfaces automation posture across the 7 process types (eligible_now composed from the live substrate),
 * the workflow engine (definitions + instance rollup + due steps), the campaign engine (definitions +
 * composed eios_campaigns / employer_pool_outreach) and execution status.
 *
 * Reads GET /api/admin/automation/console/{automations,workflows,campaigns,execution,validation}.
 * The tab is only rendered when the `automationEngine` flag is ON (SuperAdminDashboard probes
 * /console/ping before mounting), so flag-OFF is byte-identical legacy. Every figure is REAL composed
 * data; absent substrate renders honest "not provisioned / unmeasurable" states — never fabricated.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Workflow, Zap, Megaphone, PlayCircle, CheckCircle2, AlertTriangle, RefreshCw, Info, Activity,
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

type Tab = 'automations' | 'workflows' | 'campaigns' | 'execution';

const TABS: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'execution', label: 'Execution', icon: PlayCircle },
];

function useConsole<T>(slug: string, enabled: boolean) {
  return useQuery<T>({
    queryKey: [`/api/admin/automation/console/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/console/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${slug} ${res.status}`);
      return res.json();
    },
    enabled,
  });
}

function NotesCard({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BRAND.accent }} />
          <ul className="list-disc pl-4 space-y-1">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AutomationEnginePanel() {
  const [tab, setTab] = useState<Tab>('automations');

  const automations = useConsole<any>('automations', tab === 'automations');
  const workflows = useConsole<any>('workflows', tab === 'workflows');
  const campaigns = useConsole<any>('campaigns', tab === 'campaigns');
  const execution = useConsole<any>('execution', tab === 'execution');

  const active = { automations, workflows, campaigns, execution }[tab];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Automation Engine</h2>
          <p className="text-sm text-slate-500">
            Read-only automation, workflow &amp; campaign posture — composed from the live platform substrate.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => active.refetch()} disabled={active.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${active.isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === id ? 'border-current' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            style={tab === id ? { color: BRAND.primary } : undefined}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {active.isLoading && <Card><CardContent className="py-10 text-center text-slate-400">Loading…</CardContent></Card>}
      {active.isError && (
        <Card><CardContent className="py-10 text-center text-amber-600 flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Could not load this view.
        </CardContent></Card>
      )}

      {tab === 'automations' && automations.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Automation Types" value={automations.data.totals?.types} />
            <Stat label="Measurable" value={automations.data.totals?.measurable} />
            <Stat label="Eligible Now (total)" value={automations.data.totals?.eligible_total} />
            <Stat label="Runs Logged" value={automations.data.runs?.total} />
          </div>
          <Card>
            <CardHeader><CardTitle>Process Automation Posture</CardTitle>
              <CardDescription>Eligible-now counts composed read-only from live source tables.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Process</TableHead><TableHead>Sources</TableHead>
                  <TableHead className="text-right">Eligible Now</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {automations.data.automation_types?.map((t: any) => (
                    <TableRow key={t.key}>
                      <TableCell>
                        <div className="font-medium">{t.label}</div>
                        <div className="text-xs text-slate-500">{t.description}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {t.present_sources?.length ? t.present_sources.join(', ') : t.sources?.join(', ')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatNum(t.eligible_now)}</TableCell>
                      <TableCell>
                        {t.measured
                          ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">measured</Badge>
                          : <Badge variant="outline" className="border-slate-300 text-slate-500">unmeasurable</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {automations.data.runs?.recent?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Automation</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Eligible</TableHead><TableHead className="text-right">Executed</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {automations.data.runs.recent.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.automation_key}</TableCell>
                        <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                        <TableCell className="text-right">{formatNum(r.eligible_count)}</TableCell>
                        <TableCell className="text-right">{formatNum(r.executed_count)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <NotesCard notes={automations.data.notes} />
        </>
      )}

      {tab === 'workflows' && workflows.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Definitions" value={workflows.data.summary?.total_definitions} />
            <Stat label="Enabled" value={workflows.data.summary?.enabled_definitions} />
            <Stat label="Instances" value={workflows.data.instances?.total} />
            <Stat label="Active" value={workflows.data.instances?.active} />
          </div>
          {!workflows.data.provisioned && (
            <Card><CardContent className="py-6 text-sm text-slate-500 flex items-center gap-2">
              <Info className="h-4 w-4" /> Workflow tables not provisioned. Run console setup to enable workflow storage.
            </CardContent></Card>
          )}
          {workflows.data.definitions?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Workflow Definitions</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Key</TableHead><TableHead>Name</TableHead>
                    <TableHead className="text-right">Steps</TableHead><TableHead>Enabled</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {workflows.data.definitions.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.workflow_key}</TableCell>
                        <TableCell>{d.name}</TableCell>
                        <TableCell className="text-right">{formatNum(d.step_count)}</TableCell>
                        <TableCell>{d.is_enabled ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {workflows.data.due_steps?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Due Steps</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Workflow</TableHead><TableHead>Subject</TableHead>
                    <TableHead className="text-right">Step</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {workflows.data.due_steps.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.workflow_key}</TableCell>
                        <TableCell className="text-xs">{s.subject_ref ?? '—'}</TableCell>
                        <TableCell className="text-right">{s.current_step} / {s.total_steps}</TableCell>
                        <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <NotesCard notes={workflows.data.notes} />
        </>
      )}

      {tab === 'campaigns' && campaigns.data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Definitions" value={campaigns.data.summary?.total_definitions} />
            <Stat label="Active" value={campaigns.data.summary?.active_definitions} />
            <Stat label="EIOS Campaigns" value={campaigns.data.composed?.eios_campaigns?.count} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>EIOS Campaign Substrate</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {campaigns.data.composed?.eios_campaigns ? (
                  <>
                    <Row k="Campaigns" v={formatNum(campaigns.data.composed.eios_campaigns.count)} />
                    <Row k="Target total" v={formatNum(campaigns.data.composed.eios_campaigns.target_total)} />
                    <Row k="Sent total" v={formatNum(campaigns.data.composed.eios_campaigns.sent_total)} />
                    <Row k="Completed total" v={formatNum(campaigns.data.composed.eios_campaigns.completed_total)} />
                  </>
                ) : <span className="text-slate-400">Not present.</span>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Employer Outreach Substrate</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {campaigns.data.composed?.employer_outreach ? (
                  <>
                    <Row k="Total" v={formatNum(campaigns.data.composed.employer_outreach.total)} />
                    <Row k="Sent" v={formatNum(campaigns.data.composed.employer_outreach.sent)} />
                    <Row k="Pending" v={formatNum(campaigns.data.composed.employer_outreach.pending)} />
                  </>
                ) : <span className="text-slate-400">Not present.</span>}
              </CardContent>
            </Card>
          </div>
          <NotesCard notes={campaigns.data.notes} />
        </>
      )}

      {tab === 'execution' && execution.data && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Execution Status
            </CardTitle>
              <CardDescription>
                Schema readiness and last intent-only run. Execution sub-flag:{' '}
                <Badge variant="outline">{execution.data.execution_flag ? 'ON' : 'OFF'}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3 text-sm">
                {execution.data.schema_ready
                  ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Schema ready</span>
                  : <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-4 w-4" /> Schema incomplete — run setup</span>}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Table</TableHead><TableHead>Exists</TableHead><TableHead className="text-right">Rows</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {execution.data.tables?.map((t: any) => (
                    <TableRow key={t.table}>
                      <TableCell className="font-mono text-xs">{t.table}</TableCell>
                      <TableCell>{t.exists ? 'Yes' : 'No'}</TableCell>
                      <TableCell className="text-right">{formatNum(t.row_count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <NotesCard notes={execution.data.notes} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number | null }) {
  return (
    <Card><CardContent className="pt-4">
      <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>{formatNum(value)}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </CardContent></Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>;
}
