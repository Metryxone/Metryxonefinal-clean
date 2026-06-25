import { BRAND } from '@/design-system/tokens';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, ShieldX, GitBranch, AlertTriangle, CheckCircle2, XCircle, Undo2, Layers } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';


const BASE = '/api/v2/onet-crosswalk-governance';

const BAND_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  moderate: 'bg-amber-100 text-amber-800',
  low: 'bg-orange-100 text-orange-800',
  very_low: 'bg-red-100 text-red-700',
  none: 'bg-gray-100 text-gray-500',
};

type Bands = { high: number; moderate: number; low: number; very_low: number; none: number };
type ConfRow = {
  id: number;
  entity_ref: string;
  ont_id: number | null;
  ont_code: string | null;
  match_method: string | null;
  confidence: string | null;
  confidence_band: string;
  confidence_numeric: number | null;
  verified: boolean | null;
  decision: string | null;
};
type Confidence = {
  roleBridge: { table: string; total: number; resolved: number; unresolved: number; coverage_pct: number | null; band_distribution: Bands; rows: ConfRow[]; note: string };
  competencyMapping: { total: number; resolved: number; coverage_pct: number | null; band_distribution: Bands; note: string };
  industry: { measurable: false; reason: string; note: string; ont_industries_count: number | null };
};
type UnlinkedRole = { ont_role_id: number; code: string | null; title: string | null; family_name: string | null; family_linked_siblings: number; verdict: string; rationale: string };
type Missing = {
  unresolvedRoleBridges: { count: number; rows: Array<{ id: number; onto_role_id: string }>; note: string };
  rolesWithoutCompetencies: { count: number; total_active_roles: number | null; note: string };
  competenciesWithoutCrosswalk: { ont_uncrosswalked: number | null; ont_total: number | null; onto_uncrosswalked: number | null; onto_total: number | null; note: string };
};
type Decision = { id: number; entity_type: string; entity_id: number; entity_ref: string | null; decision: string; rationale: string | null; decided_by: string; decided_at: string };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return res.json();
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: BRAND.primary }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function BandBar({ bands }: { bands: Bands }) {
  const entries: Array<[keyof Bands, string]> = [['high', 'High'], ['moderate', 'Moderate'], ['low', 'Low'], ['very_low', 'Very low'], ['none', 'None']];
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, label]) => (bands[k] > 0 ? (
        <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${BAND_COLORS[k]}`}>{label}: {bands[k]}</span>
      ) : null))}
    </div>
  );
}

export default function OnetCrosswalkGovernancePanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [decideRow, setDecideRow] = useState<ConfRow | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [rationale, setRationale] = useState('');
  const [rollbackConfirm, setRollbackConfirm] = useState(false);

  const overview = useQuery({ queryKey: [BASE, 'status'], queryFn: () => getJson<any>('/status'), staleTime: 15000 });
  const confidence = useQuery({ queryKey: [BASE, 'confidence'], queryFn: () => getJson<{ confidence: Confidence }>('/confidence'), staleTime: 15000 });
  const missing = useQuery({ queryKey: [BASE, 'missing'], queryFn: () => getJson<{ missing: Missing }>('/missing'), staleTime: 15000 });
  const unlinked = useQuery({ queryKey: [BASE, 'unlinked'], queryFn: () => getJson<{ unlinked: { total_unlinked: number; inheritance_closable: number; genuinely_unmappable: number; roles: UnlinkedRole[]; note: string } }>('/unlinked-analysis'), staleTime: 15000 });
  const duplicates = useQuery({ queryKey: [BASE, 'duplicates'], queryFn: () => getJson<{ duplicates: { total_duplicate_groups: number } }>('/duplicates'), staleTime: 15000 });
  const decisions = useQuery({ queryKey: [BASE, 'decisions'], queryFn: () => getJson<{ decisions: Decision[]; count: number }>('/decisions'), staleTime: 10000 });

  const invalidateAll = () => {
    [overview, confidence, missing, unlinked, duplicates, decisions].forEach(() => {});
    qc.invalidateQueries({ queryKey: [BASE] });
  };

  const decide = useMutation({
    mutationFn: async (payload: { entityId: number; decision: 'approved' | 'rejected'; rationale: string }) => {
      const res = await fetch(`${BASE}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ entityType: 'role_bridge', entityId: payload.entityId, decision: payload.decision, rationale: payload.rationale }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      return body;
    },
    onSuccess: () => { toast({ title: 'Decision recorded' }); setDecideRow(null); setRationale(''); invalidateAll(); },
    onError: (e: Error) => toast({ title: 'Decision failed', description: e.message, variant: 'destructive' }),
  });

  const rollback = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/rollback`, { method: 'POST', credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      return body.result as { decisions_deleted: number; verified_restored: number };
    },
    onSuccess: (r) => { toast({ title: 'Rolled back', description: `${r.decisions_deleted} decisions deleted · ${r.verified_restored} verified restored` }); setRollbackConfirm(false); invalidateAll(); },
    onError: (e: Error) => toast({ title: 'Rollback failed', description: e.message, variant: 'destructive' }),
  });

  const ov = overview.data?.overview;
  const conf = confidence.data?.confidence;
  const miss = missing.data?.missing;
  const unl = unlinked.data?.unlinked;
  const isLoading = overview.isLoading || confidence.isLoading;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}><GitBranch className="h-5 w-5" />O*NET Crosswalk Governance</h2>
          <p className="text-sm text-gray-500">Coverage (a mapping exists) and Confidence (it is trustworthy) are separate axes. O*NET is a reference layer — never a scoring source. Industry abstains (no role↔industry linkage).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={invalidateAll}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => setRollbackConfirm(true)} disabled={!ov?.decisions?.recorded}><Undo2 className="h-4 w-4 mr-2" />Roll back decisions</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Role crosswalk coverage" value={conf?.roleBridge.coverage_pct == null ? '—' : `${conf.roleBridge.coverage_pct}%`} sub={`${conf?.roleBridge.resolved ?? 0}/${conf?.roleBridge.total ?? 0} resolved`} />
            <StatCard label="Competency crosswalk coverage" value={conf?.competencyMapping.coverage_pct == null ? '—' : `${conf.competencyMapping.coverage_pct}%`} sub={`${conf?.competencyMapping.resolved ?? 0}/${conf?.competencyMapping.total ?? 0} mapped`} />
            <StatCard label="Duplicate groups" value={duplicates.data?.duplicates.total_duplicate_groups ?? '—'} sub="curated↔O*NET conflicts" />
            <StatCard label="Decisions recorded" value={ov?.decisions?.recorded ?? 0} sub={`${ov?.decisions?.approved ?? 0} approved · ${ov?.decisions?.rejected ?? 0} rejected`} />
          </div>

          {/* Role bridge confidence + approve/reject */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">Role crosswalk — per-mapping confidence</div>
                <div className="text-xs text-gray-500">{conf?.roleBridge.note}</div>
              </div>
              {conf && <BandBar bands={conf.roleBridge.band_distribution} />}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead>Curated role (onto · TEXT)</TableHead>
                  <TableHead>O*NET role (ont · INT)</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-right">Govern</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(conf?.roleBridge.rows ?? []).map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50">
                    <TableCell><code className="text-xs">{r.entity_ref}</code></TableCell>
                    <TableCell>{r.ont_id != null ? <span><span className="text-sm">{r.ont_id}</span> {r.ont_code && <code className="text-[11px] text-gray-400">{r.ont_code}</code>}</span> : <span className="text-xs text-gray-400">Unresolved</span>}</TableCell>
                    <TableCell className="text-sm text-gray-500">{r.match_method || '—'}</TableCell>
                    <TableCell>{r.ont_id != null ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BAND_COLORS[r.confidence_band] || BAND_COLORS.none}`}>{r.confidence || r.confidence_band}{r.confidence_numeric != null ? ` (${r.confidence_numeric})` : ''}</span> : '—'}</TableCell>
                    <TableCell>{r.verified ? <ShieldCheck className="h-4 w-4 text-green-500" /> : <ShieldX className="h-4 w-4 text-gray-300" />}</TableCell>
                    <TableCell>{r.decision ? <Badge variant={r.decision === 'approved' ? 'default' : 'destructive'}>{r.decision}</Badge> : <span className="text-xs text-gray-400">—</span>}</TableCell>
                    <TableCell className="text-right">
                      {r.ont_id == null ? (
                        <span className="text-xs text-gray-400">n/a (unresolved)</span>
                      ) : r.decision ? (
                        <span className="text-xs text-gray-400">decided</span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => { setDecideRow(r); setDecision('approved'); setRationale(''); }}>Review</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Missing + competency coverage + industry abstain */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Missing mappings</div>
              <div className="text-sm text-gray-600">Unresolved role bridges: <strong>{miss?.unresolvedRoleBridges.count ?? '—'}</strong>{miss?.unresolvedRoleBridges.rows?.length ? ` (${miss.unresolvedRoleBridges.rows.map(x => x.onto_role_id).join(', ')})` : ''}</div>
              <div className="text-sm text-gray-600">Active roles with no competency links: <strong>{miss?.rolesWithoutCompetencies.count ?? '—'}</strong> of {miss?.rolesWithoutCompetencies.total_active_roles ?? '—'}</div>
              <div className="text-sm text-gray-600">O*NET competencies uncrosswalked: <strong>{miss?.competenciesWithoutCrosswalk.ont_uncrosswalked ?? '—'}</strong> of {miss?.competenciesWithoutCrosswalk.ont_total ?? '—'}</div>
              <div className="text-sm text-gray-600">Curated competencies uncrosswalked: <strong>{miss?.competenciesWithoutCrosswalk.onto_uncrosswalked ?? '—'}</strong> of {miss?.competenciesWithoutCrosswalk.onto_total ?? '—'}</div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="font-semibold text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-gray-400" />Industry confidence</div>
              <Badge variant="outline">Abstains — not measurable</Badge>
              <div className="text-xs text-gray-500">{conf?.industry.note}</div>
              <div className="text-xs text-gray-400">Reason: <code>{conf?.industry.reason}</code> · O*NET industries (reference): {conf?.industry.ont_industries_count ?? '—'}</div>
            </div>
          </div>

          {/* Unlinked-role inheritance closure */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <div className="font-semibold text-sm">Unlinked roles — inheritance-closure analysis</div>
              <div className="text-xs text-gray-500">{unl?.note}</div>
              <div className="text-xs text-gray-500 mt-1">Total: <strong>{unl?.total_unlinked ?? 0}</strong> · inheritance-closable: <strong>{unl?.inheritance_closable ?? 0}</strong> · genuinely unmappable: <strong>{unl?.genuinely_unmappable ?? 0}</strong></div>
            </div>
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white">
                    <TableHead>Role</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Linked siblings</TableHead>
                    <TableHead>Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(unl?.roles ?? []).map((r) => (
                    <TableRow key={r.ont_role_id}>
                      <TableCell><div className="text-sm">{r.title || '—'}</div><code className="text-[11px] text-gray-400">{r.code}</code></TableCell>
                      <TableCell className="text-sm text-gray-600">{r.family_name || '—'}</TableCell>
                      <TableCell className="text-sm">{r.family_linked_siblings}</TableCell>
                      <TableCell>{r.verdict === 'inheritance_closable' ? <Badge className="bg-amber-100 text-amber-800">closable</Badge> : <Badge variant="outline" className="text-gray-500">genuinely unmappable</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Decision audit log */}
          {(decisions.data?.count ?? 0) > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b font-semibold text-sm">Decision audit log ({decisions.data?.count})</div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-white"><TableHead>Entity</TableHead><TableHead>Decision</TableHead><TableHead>By</TableHead><TableHead>When</TableHead><TableHead>Rationale</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(decisions.data?.decisions ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><code className="text-xs">{d.entity_ref || d.entity_id}</code></TableCell>
                      <TableCell>{d.decision === 'approved' ? <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />approved</span> : <span className="text-red-600 text-sm flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />rejected</span>}</TableCell>
                      <TableCell className="text-xs text-gray-500">{d.decided_by}</TableCell>
                      <TableCell className="text-xs text-gray-400">{new Date(d.decided_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-gray-500">{d.rationale || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Decision dialog */}
      <Dialog open={!!decideRow} onOpenChange={(o) => { if (!o) setDecideRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Review crosswalk mapping</DialogTitle></DialogHeader>
          {decideRow && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-gray-50 border p-3 text-sm">
                <div><span className="text-gray-500">Curated role:</span> <code>{decideRow.entity_ref}</code></div>
                <div><span className="text-gray-500">O*NET role:</span> {decideRow.ont_id} {decideRow.ont_code && <code className="text-gray-400">{decideRow.ont_code}</code>}</div>
                <div><span className="text-gray-500">Match:</span> {decideRow.match_method} · <span className={`text-xs px-2 py-0.5 rounded-full ${BAND_COLORS[decideRow.confidence_band]}`}>{decideRow.confidence}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant={decision === 'approved' ? 'default' : 'outline'} className="flex-1" style={decision === 'approved' ? { backgroundColor: '#16a34a', color: 'white' } : {}} onClick={() => setDecision('approved')}><CheckCircle2 className="h-4 w-4 mr-2" />Approve</Button>
                <Button variant={decision === 'rejected' ? 'destructive' : 'outline'} className="flex-1" onClick={() => setDecision('rejected')}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
              </div>
              <div className="text-xs text-gray-500">{decision === 'approved' ? 'Approving marks the O*NET mapping as verified (human-confirmed). Write-once and reversible via roll back.' : 'Rejecting records a write-once rejection and clears the verified flag.'}</div>
              <div>
                <Label>Rationale (optional)</Label>
                <Textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} placeholder="Why this decision?" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideRow(null)}>Cancel</Button>
            <Button onClick={() => decideRow && decide.mutate({ entityId: decideRow.id, decision, rationale })} disabled={decide.isPending} style={{ backgroundColor: BRAND.primary, color: 'white' }}>
              {decide.isPending ? 'Recording…' : 'Record decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback confirm */}
      <Dialog open={rollbackConfirm} onOpenChange={(o) => { if (!rollback.isPending) setRollbackConfirm(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Roll back all decisions?</DialogTitle></DialogHeader>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>This deletes every governance decision in this phase and restores each role mapping's prior <strong>verified</strong> value. It fully reverses the manual approve/reject workflow.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackConfirm(false)} disabled={rollback.isPending}>Cancel</Button>
            <Button onClick={() => rollback.mutate()} disabled={rollback.isPending} style={{ backgroundColor: BRAND.primary, color: 'white' }}>{rollback.isPending ? 'Rolling back…' : 'Roll back'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
