/**
 * Shared "parity tab" components for LBI and SDI admin pages.
 * Each tab takes API endpoint paths as props so the same component works for both frameworks.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Edit2, Trash2, RefreshCw, Save, History, Sparkles, Zap,
  Calculator, FileText, Eye, TrendingUp, Trophy, Anchor, GitBranch,
  ChevronDown, ChevronRight, AlertCircle,
  BookOpen, Users, Heart, Target, Cpu, Sliders,
} from 'lucide-react';
import { toast } from 'sonner';

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function jsend(method: string, url: string, body?: any): Promise<any> {
  const r = await fetch(url, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} — ${await r.text()}`);
  return r.json();
}

// ─── NORMS TAB ───────────────────────────────────────────────────────────
export function NormsTab({ basePath, stagesPath, stageKey, stageLabel, generatePath }: {
  basePath: string; stagesPath: string; stageKey: string; stageLabel: string; generatePath?: string;
}) {
  const norms = useQuery<any[]>({ queryKey: [basePath], queryFn: () => jget(basePath) });
  const stages = useQuery<any[]>({ queryKey: [stagesPath], queryFn: () => jget(stagesPath) });
  const [filter, setFilter] = useState<string>('');
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<any>({ min_score: 20, median_score: 50, top10_score: 85 });
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const save = useMutation({
    mutationFn: (n: any) => n.id
      ? jsend('PATCH', `${basePath}/${n.id}`, n)
      : jsend('POST', basePath, n),
    onSuccess: () => { setEditing(null); setAdding(false); norms.refetch(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => jsend('DELETE', `${basePath}/${id}`),
    onSuccess: () => { norms.refetch(); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: () => jsend('POST', generatePath!, {}),
    onSuccess: (d: any) => {
      setConfirmGenerate(false);
      norms.refetch();
      toast.success(`Generated ${d.normsAdded} norm rows across ${d.bands ?? d.stages ?? '?'} ${stageLabel.toLowerCase()}s`);
    },
    onError: (e: any) => { setConfirmGenerate(false); toast.error(e.message); },
  });

  const filtered = (norms.data ?? []).filter(n => !filter || n[stageKey] === filter);
  const stageOptions = stages.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{stageLabel} × Subdomain Norms</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{filtered.length} of {norms.data?.length ?? 0}</Badge>
            <select className="border rounded-md px-2 py-1 text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All {stageLabel.toLowerCase()}s</option>
              {stageOptions.map((s: any) => {
                const code = s.stage_code ?? s.band_code ?? s.code;
                const name = s.stage_name ?? s.band_name ?? s.name ?? code;
                return <option key={code} value={code}>{code} — {name}</option>;
              })}
            </select>
            <Button size="sm" variant="outline" onClick={() => { setNewRow({ min_score: 20, median_score: 50, top10_score: 85 }); setAdding(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Row
            </Button>
            {generatePath && (
              <Button size="sm" variant="outline"
                style={{ color: MX_NAVY, borderColor: '#B8C4E0' }}
                className="hover:bg-gray-50"
                onClick={() => norms.data && norms.data.length > 0 ? setConfirmGenerate(true) : generate.mutate()}
                disabled={generate.isPending}>
                <Zap className="h-3.5 w-3.5 mr-1" />
                {generate.isPending ? 'Generating…' : 'Generate Defaults'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">
          Defines min / median / top-10% expected scores per {stageLabel.toLowerCase()} per subdomain.
          Scoring engine uses these for benchmarking and gap analysis.
          {norms.data?.length === 0 && generatePath && (
            <span className="ml-1 font-medium" style={{ color: MX_NAVY }}>No norms yet — click "Generate Defaults" to bootstrap from existing {stageLabel.toLowerCase()}s × subdomains.</span>
          )}
        </p>

        {norms.isLoading ? (
          <div className="text-center py-10 text-gray-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />Loading norms…
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed rounded-lg py-12 text-center text-gray-400 text-sm">
            {norms.data?.length === 0
              ? <><Zap className="h-8 w-8 mx-auto mb-2 text-gray-300" />No norms yet.{generatePath && ' Use "Generate Defaults" to create all rows automatically.'}</>
              : 'No rows match this filter.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-semibold">{stageLabel}</th>
                  <th className="text-left p-2 font-semibold">Subdomain</th>
                  <th className="text-right p-2 font-semibold">Min</th>
                  <th className="text-right p-2 font-semibold">Median</th>
                  <th className="text-right p-2 font-semibold">Top 10%</th>
                  <th className="text-right p-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.slice(0, 300).map((n: any) => (
                  <tr key={n.id} className="hover:bg-gray-50 group">
                    <td className="p-2 font-mono text-gray-600 text-[11px]">{n[stageKey]}</td>
                    <td className="p-2 font-mono text-gray-600 text-[11px]">{n.subdomain_code}</td>
                    <td className="p-2 text-right tabular-nums">{n.min_score}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{n.median_score}</td>
                    <td className="p-2 text-right tabular-nums font-semibold" style={{ color: '#344E86' }}>{n.top10_score}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(n)}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                          onClick={() => { if (confirm(`Delete norm ${n[stageKey]} · ${n.subdomain_code}?`)) del.mutate(n.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && <p className="text-[10px] text-center p-2 text-gray-400">Showing first 300 of {filtered.length}. Use the filter above to narrow down.</p>}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit norm</DialogTitle>
              <DialogDescription>{editing?.[stageKey]} · {editing?.subdomain_code}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Min score</Label><Input type="number" min={0} max={100} step={0.1} value={editing?.min_score ?? 0} onChange={e => setEditing((s: any) => ({ ...s, min_score: parseFloat(e.target.value) }))} /></div>
              <div><Label>Median score</Label><Input type="number" min={0} max={100} step={0.1} value={editing?.median_score ?? 50} onChange={e => setEditing((s: any) => ({ ...s, median_score: parseFloat(e.target.value) }))} /></div>
              <div><Label>Top 10% score</Label><Input type="number" min={0} max={100} step={0.1} value={editing?.top10_score ?? 85} onChange={e => setEditing((s: any) => ({ ...s, top10_score: parseFloat(e.target.value) }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add new row dialog */}
        <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add norm row</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{stageLabel} code *</Label>
                  <select className="w-full border rounded-md px-2 py-2 text-sm" value={newRow[stageKey] || ''} onChange={e => setNewRow((s: any) => ({ ...s, [stageKey]: e.target.value }))}>
                    <option value="">Select…</option>
                    {stageOptions.map((s: any) => {
                      const code = s.stage_code ?? s.band_code ?? s.code;
                      const name = s.stage_name ?? s.band_name ?? s.name ?? code;
                      return <option key={code} value={code}>{code} — {name}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <Label>Subdomain code *</Label>
                  <Input value={newRow.subdomain_code || ''} onChange={e => setNewRow((s: any) => ({ ...s, subdomain_code: e.target.value }))} placeholder="e.g. SD01_01" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Min</Label><Input type="number" min={0} max={100} step={0.1} value={newRow.min_score ?? 20} onChange={e => setNewRow((s: any) => ({ ...s, min_score: parseFloat(e.target.value) }))} /></div>
                <div><Label>Median</Label><Input type="number" min={0} max={100} step={0.1} value={newRow.median_score ?? 50} onChange={e => setNewRow((s: any) => ({ ...s, median_score: parseFloat(e.target.value) }))} /></div>
                <div><Label>Top 10%</Label><Input type="number" min={0} max={100} step={0.1} value={newRow.top10_score ?? 85} onChange={e => setNewRow((s: any) => ({ ...s, top10_score: parseFloat(e.target.value) }))} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={() => save.mutate(newRow)} disabled={!newRow[stageKey] || !newRow.subdomain_code || save.isPending}>
                {save.isPending ? 'Saving…' : 'Add row'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm overwrite generate */}
        <Dialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Regenerate defaults?</DialogTitle>
              <DialogDescription>
                There are already {norms.data?.length} norm rows. Generating defaults will add any missing rows (existing rows are kept unchanged).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmGenerate(false)}>Cancel</Button>
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? 'Generating…' : 'Generate missing rows'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── WEIGHTS TAB ─────────────────────────────────────────────────────────
export function WeightsTab({ basePath, stagesPath, stageKey, stageLabel, generatePath }: {
  basePath: string; stagesPath: string; stageKey: string; stageLabel: string; generatePath?: string;
}) {
  const weights = useQuery<any[]>({ queryKey: [basePath], queryFn: () => jget(basePath) });
  const stages = useQuery<any[]>({ queryKey: [stagesPath], queryFn: () => jget(stagesPath) });
  const [filter, setFilter] = useState<string>('');
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<any>({ weight: 1.0, weight_type: 'core' });
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const save = useMutation({
    mutationFn: (w: any) => w.id
      ? jsend('PATCH', `${basePath}/${w.id}`, w)
      : jsend('POST', basePath, w),
    onSuccess: () => { setEditing(null); setAdding(false); weights.refetch(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => jsend('DELETE', `${basePath}/${id}`),
    onSuccess: () => { weights.refetch(); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: () => jsend('POST', generatePath!, {}),
    onSuccess: (d: any) => {
      setConfirmGenerate(false);
      weights.refetch();
      toast.success(`Generated ${d.weightsAdded} weight rows`);
    },
    onError: (e: any) => { setConfirmGenerate(false); toast.error(e.message); },
  });

  const filtered = (weights.data ?? []).filter(w => !filter || w[stageKey] === filter);
  const stageOptions = stages.data ?? [];

  const TYPE_COLORS: Record<string, string> = {
    core:          'border',
    differentiator:'border',
    supporting:    'border bg-gray-50 text-gray-500 border-gray-200',
  };
  const TYPE_STYLES: Record<string, React.CSSProperties> = {
    core:          { backgroundColor: '#D6DCF0', color: '#0d1f42', borderColor: '#B8C4E0' },
    differentiator:{ backgroundColor: '#EEF1F8', color: '#1e3461', borderColor: '#D6DCF0' },
    supporting:    {},
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{stageLabel} × Subdomain Weights</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{filtered.length} of {weights.data?.length ?? 0}</Badge>
            <select className="border rounded-md px-2 py-1 text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All {stageLabel.toLowerCase()}s</option>
              {stageOptions.map((s: any) => {
                const code = s.stage_code ?? s.band_code ?? s.code ?? s.role_code;
                const name = s.stage_name ?? s.band_name ?? s.name ?? s.role_name ?? code;
                return <option key={code} value={code}>{code} — {name}</option>;
              })}
            </select>
            <Button size="sm" variant="outline" onClick={() => { setNewRow({ weight: 1.0, weight_type: 'core' }); setAdding(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Row
            </Button>
            {generatePath && (
              <Button size="sm" variant="outline"
                style={{ color: MX_NAVY, borderColor: '#B8C4E0' }}
                className="hover:bg-gray-50"
                onClick={() => weights.data && weights.data.length > 0 ? setConfirmGenerate(true) : generate.mutate()}
                disabled={generate.isPending}>
                <Zap className="h-3.5 w-3.5 mr-1" />
                {generate.isPending ? 'Generating…' : 'Generate Defaults'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">
          Importance gravity per {stageLabel.toLowerCase()} per subdomain. Drives weighted score → composite index.
          {weights.data?.length === 0 && generatePath && (
            <span className="ml-1 font-medium" style={{ color: MX_NAVY }}>No weights yet — click "Generate Defaults" to bootstrap.</span>
          )}
        </p>

        {weights.isLoading ? (
          <div className="text-center py-10 text-gray-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />Loading weights…
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed rounded-lg py-12 text-center text-gray-400 text-sm">
            {weights.data?.length === 0
              ? <><Zap className="h-8 w-8 mx-auto mb-2 text-gray-300" />No weights yet.{generatePath && ' Use "Generate Defaults" to create all rows automatically.'}</>
              : 'No rows match this filter.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-semibold">{stageLabel}</th>
                  <th className="text-left p-2 font-semibold">Subdomain</th>
                  <th className="text-right p-2 font-semibold">Weight</th>
                  <th className="text-left p-2 font-semibold">Type</th>
                  <th className="text-right p-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.slice(0, 300).map((w: any) => (
                  <tr key={w.id} className="hover:bg-gray-50 group">
                    <td className="p-2 font-mono text-gray-600 text-[11px]">{w[stageKey]}</td>
                    <td className="p-2 font-mono text-gray-600 text-[11px]">{w.subdomain_code}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{w.weight}</td>
                    <td className="p-2">
                      <span
                        className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${TYPE_COLORS[w.weight_type] ?? TYPE_COLORS.supporting}`}
                        style={TYPE_STYLES[w.weight_type] ?? {}}
                      >
                        {w.weight_type}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(w)}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                          onClick={() => { if (confirm(`Delete weight for ${w.subdomain_code}?`)) del.mutate(w.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && <p className="text-[10px] text-center p-2 text-gray-400">Showing first 300 of {filtered.length}. Use the filter above to narrow down.</p>}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit weight</DialogTitle>
              <DialogDescription>{editing?.[stageKey]} · {editing?.subdomain_code}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Weight</Label><Input type="number" min={0} max={10} step={0.1} value={editing?.weight ?? 1} onChange={e => setEditing((s: any) => ({ ...s, weight: parseFloat(e.target.value) }))} /></div>
              <div>
                <Label>Type</Label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={editing?.weight_type || 'core'} onChange={e => setEditing((s: any) => ({ ...s, weight_type: e.target.value }))}>
                  <option value="core">core</option>
                  <option value="differentiator">differentiator</option>
                  <option value="supporting">supporting</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add new row dialog */}
        <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add weight row</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{stageLabel} code *</Label>
                  <select className="w-full border rounded-md px-2 py-2 text-sm" value={newRow[stageKey] || ''} onChange={e => setNewRow((s: any) => ({ ...s, [stageKey]: e.target.value }))}>
                    <option value="">Select…</option>
                    {stageOptions.map((s: any) => {
                      const code = s.stage_code ?? s.band_code ?? s.code ?? s.role_code;
                      const name = s.stage_name ?? s.band_name ?? s.name ?? s.role_name ?? code;
                      return <option key={code} value={code}>{code} — {name}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <Label>Subdomain code *</Label>
                  <Input value={newRow.subdomain_code || ''} onChange={e => setNewRow((s: any) => ({ ...s, subdomain_code: e.target.value }))} placeholder="e.g. SD01_01" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Weight</Label><Input type="number" min={0} max={10} step={0.1} value={newRow.weight ?? 1.0} onChange={e => setNewRow((s: any) => ({ ...s, weight: parseFloat(e.target.value) }))} /></div>
                <div>
                  <Label>Type</Label>
                  <select className="w-full border rounded-md px-2 py-2 text-sm" value={newRow.weight_type || 'core'} onChange={e => setNewRow((s: any) => ({ ...s, weight_type: e.target.value }))}>
                    <option value="core">core</option>
                    <option value="differentiator">differentiator</option>
                    <option value="supporting">supporting</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={() => save.mutate(newRow)} disabled={!newRow[stageKey] || !newRow.subdomain_code || save.isPending}>
                {save.isPending ? 'Saving…' : 'Add row'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm generate */}
        <Dialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add missing defaults?</DialogTitle>
              <DialogDescription>
                There are {weights.data?.length} weight rows. This will add any missing {stageLabel.toLowerCase()} × subdomain combinations (existing rows are unchanged).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmGenerate(false)}>Cancel</Button>
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? 'Generating…' : 'Generate missing rows'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── CLUSTERS TAB ────────────────────────────────────────────────────────
export function ClustersTab({
  basePath,
  subdomainsPath,
  codeField = 'subdomain_code',
  nameField = 'subdomain_name',
  groupField = 'domain_code',
}: {
  basePath: string;
  subdomainsPath: string;
  codeField?: string;
  nameField?: string;
  groupField?: string;
}) {
  const clusters = useQuery<any[]>({ queryKey: [basePath], queryFn: () => jget(basePath) });
  const subs = useQuery<any[]>({ queryKey: [subdomainsPath], queryFn: () => jget(subdomainsPath) });
  const [editing, setEditing] = useState<any | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('');

  const groups = useMemo(() => {
    if (!subs.data) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of subs.data) {
      const g = s[groupField];
      if (g && !seen.has(g)) { seen.add(g); result.push(g); }
    }
    return result;
  }, [subs.data, groupField]);

  const filteredSubs = useMemo(() => {
    if (!subs.data) return [];
    if (!groupFilter) return subs.data;
    return subs.data.filter((s: any) => s[groupField] === groupFilter);
  }, [subs.data, groupFilter, groupField]);

  const save = useMutation({
    mutationFn: async (c: any) => {
      const r = c.id
        ? await jsend('PATCH', `${basePath}/${c.id}`, c)
        : await jsend('POST', basePath, c);
      await jsend('POST', `${basePath}/${r.id}/subdomains`, { subdomain_codes: picked });
      return r;
    },
    onSuccess: () => { setEditing(null); setPicked([]); setGroupFilter(''); clusters.refetch(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => jsend('DELETE', `${basePath}/${id}`),
    onSuccess: () => { clusters.refetch(); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = async (c: any) => {
    setEditing(c);
    setGroupFilter('');
    if (c.id) {
      try {
        const codes = await jget<string[]>(`${basePath}/${c.id}/subdomains`);
        setPicked(Array.isArray(codes) ? codes : []);
      } catch { setPicked([]); }
    } else {
      setPicked([]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Cross-cutting groupings of subdomains for reporting (e.g. "Stress Resilience").</p>
        <Button size="sm" onClick={() => openEdit({ is_active: true })}>
          <Plus className="h-4 w-4 mr-1.5" />Add Cluster
        </Button>
      </div>

      {clusters.isLoading && (
        <div className="text-center py-10 text-gray-400 text-sm">Loading clusters…</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {clusters.data?.map((c: any) => {
          const mappedCodes: string[] = Array.isArray(c.subdomain_codes) && c.subdomain_codes.length > 0
            ? c.subdomain_codes
            : Array.isArray(c.competencies)
              ? c.competencies.map((x: any) => x.code)
              : [];
          return (
            <Card key={c.id} className="transition-colors" style={{ ['--hover-border' as any]: '#B8C4E0' }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{c.code}</span>
                  <div className="flex items-center gap-1">
                    {mappedCodes.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{mappedCodes.length} items</Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(c)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => { if (confirm(`Delete cluster "${c.name}"?`)) del.mutate(c.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm">{c.name}</h3>
                {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                {mappedCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {mappedCodes.slice(0, 4).map(code => (
                      <span key={code} className="text-[10px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: '#D6DCF0', color: MX_NAVY2 }}>{code}</span>
                    ))}
                    {mappedCodes.length > 4 && (
                      <span className="text-[10px] text-gray-400">+{mappedCodes.length - 4} more</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!clusters.isLoading && clusters.data?.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-400 border border-dashed rounded-lg text-sm">
            No clusters yet — click <strong>Add Cluster</strong> to create one.
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setGroupFilter(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit cluster' : 'New cluster'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input
                  value={editing?.code || ''}
                  onChange={e => setEditing((s: any) => ({ ...s, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. STRESS_RESILIENCE"
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  value={editing?.name || ''}
                  onChange={e => setEditing((s: any) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Stress Resilience"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editing?.description || ''}
                onChange={e => setEditing((s: any) => ({ ...s, description: e.target.value }))}
                rows={2}
                placeholder="What this cluster measures…"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>
                  Mapped items
                  <span className="ml-1.5 text-gray-400 font-normal">
                    ({picked.length} selected of {subs.data?.length ?? 0})
                  </span>
                </Label>
                {groups.length > 1 && (
                  <select
                    className="text-xs border rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1"
                    style={{ ['--tw-ring-color' as any]: MX_NAVY }}
                    value={groupFilter}
                    onChange={e => setGroupFilter(e.target.value)}
                  >
                    <option value="">All groups ({subs.data?.length ?? 0})</option>
                    {groups.map(g => (
                      <option key={g} value={g}>
                        {g} ({subs.data?.filter((s: any) => s[groupField] === g).length ?? 0})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="border rounded-md max-h-64 overflow-y-auto p-2 grid grid-cols-2 gap-1 bg-gray-50">
                {subs.isLoading && (
                  <div className="col-span-2 text-center text-xs text-gray-400 py-6">Loading items…</div>
                )}
                {filteredSubs.map((s: any) => {
                  const code = s[codeField];
                  const name = s[nameField];
                  const isChecked = picked.includes(code);
                  return (
                    <label
                      key={s.id ?? code}
                      className="text-xs flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors border"
                      style={isChecked
                        ? { backgroundColor: '#D6DCF0', borderColor: '#B8C4E0' }
                        : { backgroundColor: '#fff', borderColor: 'transparent' }}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={isChecked}
                        onChange={e =>
                          setPicked(p => e.target.checked ? [...p, code] : p.filter(x => x !== code))
                        }
                      />
                      <span className="font-mono text-gray-400 shrink-0 text-[10px]">{code}</span>
                      <span className="truncate text-gray-700">{name}</span>
                    </label>
                  );
                })}
                {!subs.isLoading && filteredSubs.length === 0 && (
                  <div className="col-span-2 text-center text-xs text-gray-400 py-6">No items to show</div>
                )}
              </div>

              {picked.length > 0 && (
                <p className="text-xs mt-1.5" style={{ color: MX_NAVY }}>
                  {picked.length} item{picked.length !== 1 ? 's' : ''} selected
                  {' · '}
                  <button
                    type="button"
                    className="underline hover:no-underline"
                    onClick={() => setPicked([])}
                  >
                    Clear all
                  </button>
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setEditing(null); setGroupFilter(''); }}>Cancel</Button>
            <Button
              onClick={() => save.mutate(editing)}
              disabled={!editing?.code || !editing?.name || save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save cluster'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── LEARNING MAPPINGS TAB ──────────────────────────────────────────────
export function LearningMappingsTab({ basePath, subdomainsPath }: { basePath: string; subdomainsPath: string }) {
  const maps = useQuery<any[]>({ queryKey: [basePath], queryFn: () => jget(basePath) });
  const subs = useQuery<any[]>({ queryKey: [subdomainsPath], queryFn: () => jget(subdomainsPath) });
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (m: any) => m.id ? jsend('PATCH', `${basePath}/${m.id}`, m) : jsend('POST', basePath, m),
    onSuccess: () => { setEditing(null); maps.refetch(); toast.success('Saved'); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => jsend('DELETE', `${basePath}/${id}`),
    onSuccess: () => { maps.refetch(); toast.success('Deleted'); },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Learning / IDP Mappings</CardTitle>
          <Button size="sm" onClick={() => setEditing({ level: 3 })}><Plus className="h-4 w-4 mr-1.5" />Add Mapping</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">Per-subdomain learning resources surfaced when a user has a gap at the given proficiency level.</p>
        <div className="space-y-2">
          {maps.data?.map((m: any) => (
            <div key={m.id} className="p-3 border rounded-lg flex items-start justify-between hover:border-gray-300 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-mono">{m.subdomain_code}</Badge>
                  <Badge variant="outline" className="text-[10px]">L{m.level}</Badge>
                  {m.action_type && <Badge variant="outline" className="text-[10px]">{m.action_type}</Badge>}
                </div>
                <p className="text-sm font-medium mt-1">{m.title || '(no title)'}</p>
                {m.resource_link && <a className="text-xs hover:underline" style={{ color: MX_NAVY }} href={m.resource_link} target="_blank" rel="noopener noreferrer">{m.resource_link}</a>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(m)}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { if (confirm('Delete?')) del.mutate(m.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {maps.data?.length === 0 && <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg text-sm">No learning mappings yet</div>}
        </div>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Add'} mapping</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Subdomain *</Label>
                <select className="w-full border rounded-md px-2 py-2 text-sm" value={editing?.subdomain_code || ''} onChange={e => setEditing((s: any) => ({ ...s, subdomain_code: e.target.value }))}>
                  <option value="">Select…</option>
                  {subs.data?.map((s: any) => <option key={s.id} value={s.subdomain_code}>{s.subdomain_code} — {s.subdomain_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Level (1–5)</Label><Input type="number" min={1} max={5} value={editing?.level ?? 3} onChange={e => setEditing((s: any) => ({ ...s, level: parseInt(e.target.value) }))} /></div>
                <div><Label>Type</Label><Input value={editing?.action_type || ''} onChange={e => setEditing((s: any) => ({ ...s, action_type: e.target.value }))} placeholder="course / video / book" /></div>
              </div>
              <div><Label>Title</Label><Input value={editing?.title || ''} onChange={e => setEditing((s: any) => ({ ...s, title: e.target.value }))} /></div>
              <div><Label>Resource link</Label><Input value={editing?.resource_link || ''} onChange={e => setEditing((s: any) => ({ ...s, resource_link: e.target.value }))} placeholder="https://…" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save.mutate(editing)} disabled={!editing?.subdomain_code || save.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── VERSIONS TAB ────────────────────────────────────────────────────────
export function VersionsTab({ basePath, summaryPath }: { basePath: string; summaryPath: string }) {
  const versions = useQuery<any[]>({ queryKey: [basePath], queryFn: () => jget(basePath) });
  const summary = useQuery<Record<string, number>>({ queryKey: [summaryPath], queryFn: () => jget(summaryPath) });
  const [showSnap, setShowSnap] = useState(false);
  const [form, setForm] = useState({ label: '', notes: '' });

  const create = useMutation({
    mutationFn: () => jsend('POST', basePath, form),
    onSuccess: () => { setShowSnap(false); setForm({ label: '', notes: '' }); versions.refetch(); summary.refetch(); toast.success('Snapshot saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: MX_NAVY }} />Engine Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {summary.data && Object.entries(summary.data).map(([k, v]) => (
              <div key={k} className="bg-gradient-to-br from-slate-50 to-white border rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{v as number}</div>
                <div className="text-xs text-gray-500">{k.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" style={{ color: MX_NAVY }} />Version History</CardTitle>
            <Button size="sm" onClick={() => setShowSnap(true)}><Save className="h-4 w-4 mr-1.5" />Take Snapshot</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {versions.data?.map((v: any) => (
            <div key={v.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: '#D6DCF0', color: MX_NAVY2 }}>v{v.version}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{v.label}</div>
                {v.notes && <div className="text-xs text-gray-500">{v.notes}</div>}
                <div className="text-xs text-gray-400 mt-1">{new Date(v.created_at).toLocaleString()}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(v.change_summary || {}).map(([k, val]) => (
                    <Badge key={k} variant="outline" className="text-[10px]">{k}: {val as number}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Dialog open={showSnap} onOpenChange={setShowSnap}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Take snapshot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Label</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnap(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SHARED CONSTANTS ─────────────────────────────────────────────────────
const MX_NAVY   = '#344E86';
const MX_NAVY2  = '#1e3461';
const MX_NAVY3  = '#0d1f42';

// MetryxOne single-hue navy palette — sequential shades, no multi-color
// N0=#0d1f42  N1=#1e3461  N2=#344E86  N3=#3d5a9a  N4=#4F6BBD  N5=#6279C4  N6=#7B8FCF  N7=#B8C4E0  N8=#D6DCF0  NT=#EEF1F8
const REPORT_COLORS: Record<string, string> = {
  // LBI (darkest → lightest across 4 types)
  CURIOSITY:   '#0d1f42',  INSIGHT:    '#1e3461',  GROWTH:     '#344E86',  MASTERY:    '#3d5a9a',
  // CAPADEX
  ACADEMIC:    '#1e3461',  SOCIAL:     '#0d1f42',  WELLNESS:   '#344E86',
  // Competency
  CORE:        '#344E86',  TECHNICAL:  '#1e3461',  LEADERSHIP: '#3d5a9a',  FUNCTIONAL: '#4F6BBD',  BEHAVIORAL: '#344E86',
};
const REPORT_LIGHT: Record<string, string> = {
  CURIOSITY:   '#D6DCF0',  INSIGHT:    '#EEF1F8',  GROWTH:     '#D6DCF0',  MASTERY:    '#EEF1F8',
  ACADEMIC:    '#EEF1F8',  SOCIAL:     '#D6DCF0',  WELLNESS:   '#EEF1F8',
  CORE:        '#EEF1F8',  TECHNICAL:  '#D6DCF0',  LEADERSHIP: '#EEF1F8',  FUNCTIONAL: '#D6DCF0',  BEHAVIORAL: '#EEF1F8',
};
const REPORT_MID: Record<string, string> = {
  CURIOSITY:   '#1e3461',  INSIGHT:    '#344E86',  GROWTH:     '#3d5a9a',  MASTERY:    '#4F6BBD',
  ACADEMIC:    '#3d5a9a',  SOCIAL:     '#1e3461',  WELLNESS:   '#3d5a9a',
  CORE:        '#4F6BBD',  TECHNICAL:  '#3d5a9a',  LEADERSHIP: '#4F6BBD',  FUNCTIONAL: '#6279C4',  BEHAVIORAL: '#344E86',
};

const CUTOFF_LABELS = [
  { key: 'needs_attention', label: 'Needs Attention', pct: '≤ 40%',  color: '#0d1f42', bg: '#EEF1F8' },
  { key: 'developing',      label: 'Developing',      pct: '41–60%', color: '#1e3461', bg: '#D6DCF0' },
  { key: 'proficient',      label: 'Proficient',      pct: '61–80%', color: '#0d1f42', bg: '#B8C4E0' },
  { key: 'advanced',        label: 'Advanced',         pct: '> 80%',  color: '#ffffff', bg: '#344E86' },
];

const PAGE_SIZE = 25;

export function ScoringTab({
  scoringApi, anchorItemsApi, color, frameworkName,
}: {
  scoringApi: string;
  anchorItemsApi?: string;
  color: string;
  frameworkName?: string;
}) {
  const [filterReport, setFilterReport] = useState('ALL');
  const [filterDomain, setFilterDomain] = useState('all');
  const [search, setSearch]             = useState('');
  const [showAnchors, setShowAnchors]   = useState(false);
  const [anchorReport, setAnchorReport] = useState('');
  const [page, setPage]                 = useState(1);

  const rules   = useQuery<any[]>({ queryKey: [scoringApi],  queryFn: () => jget(scoringApi) });
  const anchors = useQuery<any[]>({
    queryKey: [anchorItemsApi || '', anchorReport],
    queryFn:  () => jget(`${anchorItemsApi}${anchorReport ? `?report_type=${anchorReport}` : ''}`),
    enabled:  !!anchorItemsApi && showAnchors,
  });

  const uniqueTypes = useMemo(
    () => [...new Set((rules.data || []).map((r: any) => r.report_type_code).filter(Boolean))],
    [rules.data],
  );

  const domains = useMemo(() => {
    if (!rules.data) return [];
    const seen = new Set<string>();
    return rules.data.filter(r => { if (seen.has(r.domain_code)) return false; seen.add(r.domain_code); return true; });
  }, [rules.data]);

  const filtered = useMemo(() => {
    if (!rules.data) return [];
    return rules.data.filter(r => {
      if (filterReport !== 'ALL' && r.report_type_code !== filterReport) return false;
      if (filterDomain !== 'all' && r.domain_code  !== filterDomain)  return false;
      if (search && !`${r.subdomain_code} ${r.subdomain_name} ${r.domain_name}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rules.data, filterReport, filterDomain, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // reset page when filters change
  useMemo(() => setPage(1), [filterReport, filterDomain, search]);

  const total    = rules.data?.length ?? 0;
  const maxScore = rules.data?.[0]?.max_score ?? 15;

  if (rules.isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-28 rounded-xl bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: '#EEF1F8' }}>
            <Calculator className="h-4 w-4" style={{ color: MX_NAVY }} />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">Scoring Engine</p>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">Subdomain Scoring Rules</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { val: total,              lbl: 'Active Rules'  },
            { val: uniqueTypes.length, lbl: 'Report Types'  },
          ].map(({ val, lbl }) => (
            <div key={lbl} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border" style={{ borderColor: '#D6DCF0', backgroundColor: '#EEF1F8' }}>
              <span className="text-sm font-semibold" style={{ color: MX_NAVY }}>{val || '—'}</span>
              <span className="text-[10px] text-gray-400 font-medium">{lbl}</span>
            </div>
          ))}
          <span className="text-[11px] text-gray-400 hidden md:block">Likert · {maxScore} pts max · percentile norm</span>
        </div>
      </div>

      {/* ── Report type stat cards ───────────────────────────────────────── */}
      {uniqueTypes.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {uniqueTypes.map(rt => {
            const count       = rules.data?.filter(r => r.report_type_code === rt).length ?? 0;
            const anchorCount = rules.data?.filter(r => r.report_type_code === rt && r.is_anchor_subdomain).length ?? 0;
            const pct         = total > 0 ? Math.round((count / total) * 100) : 0;
            const dark        = REPORT_COLORS[rt] || MX_NAVY;
            const light       = REPORT_LIGHT[rt]  || '#f3f4f6';
            const mid         = REPORT_MID[rt]    || MX_NAVY;
            const active      = filterReport === rt;
            const meta        = REPORT_META[rt];
            const ReportIcon  = meta?.icon ?? FileText;
            return (
              <button
                key={rt}
                onClick={() => { setFilterReport(active ? 'ALL' : rt); setPage(1); }}
                className="text-left rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg focus:outline-none group"
                style={{
                  borderColor:     active ? dark : '#e5e7eb',
                  boxShadow:       active ? `0 0 0 3px ${dark}20` : undefined,
                }}
              >
                {/* card top */}
                <div className="p-4" style={{ backgroundColor: active ? light : '#ffffff' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="rounded-xl p-2.5"
                      style={{ backgroundColor: active ? dark : light }}
                    >
                      <ReportIcon className="h-4 w-4" style={{ color: active ? '#fff' : dark }} />
                    </div>
                    {active && (
                      <span
                        className="text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: dark }}
                      >active</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold leading-none" style={{ color: dark }}>{count}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-700 mt-1">{rt}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{anchorCount} anchor subdomains</div>
                </div>
                {/* progress foot */}
                <div className="px-4 pb-3.5 pt-2" style={{ backgroundColor: active ? light : '#fafafa', borderTop: `1px solid ${active ? dark+'20' : '#f0f0f0'}` }}>
                  <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: mid }} />
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1.5 font-medium">{pct}% of framework</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Scoring Logic Key ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 flex items-center gap-3 border-b border-gray-100 bg-white">
          <div className="rounded-md p-1.5 shrink-0" style={{ backgroundColor: '#EEF1F8' }}>
            <Calculator className="h-3.5 w-3.5" style={{ color: MX_NAVY }} />
          </div>
          <span className="text-sm font-semibold text-gray-800">Scoring Logic — Likert 5-Point Scale</span>
          <span className="ml-auto text-[11px] text-gray-400 font-mono bg-gray-100 px-2.5 py-1 rounded-md">
            raw ÷ {maxScore} × 100 = %ile
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
          {CUTOFF_LABELS.map((c, i) => (
            <div key={c.key} className="p-5 flex flex-col items-center text-center">
              <div className="text-xl font-semibold mb-1.5" style={{ color: c.color }}>{c.pct}</div>
              <div
                className="text-[11px] font-medium px-3 py-1 rounded-full mb-1.5"
                style={{ backgroundColor: c.bg, color: c.color }}
              >{c.label}</div>
              <div className="text-[10px] text-gray-400 font-medium">Band {i + 1} of 4</div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-100" style={{ backgroundColor: '#fafafa' }}>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Questions per subdomain × max 5 pts each = <strong className="text-gray-700">{maxScore} raw points</strong>.
            &nbsp;Reverse-scored items are <strong className="text-gray-700">auto-inverted</strong>.
            &nbsp;Anchor subdomains are the most diagnostically sensitive nodes in each report type.
          </p>
        </div>
      </div>

      {/* ── Rules Table ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* toolbar */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-gray-800">Subdomain Scoring Rules</span>
            <span
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: MX_NAVY }}
            >{filtered.length}</span>
            {filtered.length !== total && (
              <span className="text-[10px] text-gray-400">of {total}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Input
                placeholder="Search subdomains…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="h-8 text-xs w-44 bg-white pl-3"
              />
            </div>
            <select
              className="border border-gray-200 rounded-lg px-2 h-8 text-xs bg-white text-gray-700 focus:ring-2 focus:outline-none"
              style={{ ['--tw-ring-color' as any]: MX_NAVY }}
              value={filterDomain}
              onChange={e => { setFilterDomain(e.target.value); setPage(1); }}
            >
              <option value="all">All domains</option>
              {domains.map(d => (
                <option key={d.domain_code} value={d.domain_code}>{d.domain_code} — {d.domain_name}</option>
              ))}
            </select>
            <select
              className="border border-gray-200 rounded-lg px-2 h-8 text-xs bg-white text-gray-700"
              value={filterReport}
              onChange={e => { setFilterReport(e.target.value); setPage(1); }}
            >
              <option value="ALL">All report types</option>
              {uniqueTypes.map(rt => (
                <option key={rt} value={rt}>{rt}</option>
              ))}
            </select>
            {anchorItemsApi && (
              <Button
                variant={showAnchors ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowAnchors(v => !v)}
                className="h-8 text-xs gap-1.5 border"
                style={showAnchors
                  ? { backgroundColor: MX_NAVY, borderColor: MX_NAVY, color: '#fff' }
                  : { borderColor: MX_NAVY, color: MX_NAVY }}
              >
                <Anchor className="h-3 w-3" />
                Anchor Items
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Subdomain','Name','Domain','Method','Max Pts','Cutoff Bands','Report Type','Anchor','Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((r: any, i: number) => {
                const dark  = REPORT_COLORS[r.report_type_code] || '#6b7280';
                const light = REPORT_LIGHT[r.report_type_code]  || '#f3f4f6';
                return (
                  <tr
                    key={r.id}
                    className="transition-colors duration-75 hover:bg-gray-50"
                    style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}
                  >
                    <td className="px-3 py-2.5 font-mono text-[10px] text-gray-400 whitespace-nowrap">{r.subdomain_code}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[200px]">
                      <span className="block truncate">{r.subdomain_name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="font-mono text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: `${MX_NAVY}10`, color: MX_NAVY }}
                      >{r.domain_code}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] border border-gray-200 rounded-md px-2 py-0.5 text-gray-500 bg-white font-normal">
                        {r.calculation_type === 'mean' ? 'Mean avg' : r.calculation_type === 'sum' ? 'Sum' : 'Weighted'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className="font-semibold text-gray-800">{r.max_score}</span>
                      <span className="text-gray-400 text-[9px] ml-0.5">pts</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-0.5">
                        {CUTOFF_LABELS.map(cl => (
                          <span
                            key={cl.key}
                            className="text-[8px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap"
                            style={{ backgroundColor: cl.bg, color: cl.color }}
                          >{cl.pct}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.report_type_code ? (
                        <span
                          className="text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: light, color: dark, border: `1px solid ${dark}35` }}
                        >{r.report_type_code}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {r.is_anchor_subdomain ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                          style={{ backgroundColor: '#D6DCF0' }}
                        >
                          <Anchor className="h-2.5 w-2.5" style={{ color: MX_NAVY }} />
                        </span>
                      ) : (
                        <span className="text-gray-200 text-base leading-none">·</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={r.status === 'Active'
                          ? { backgroundColor: '#D6DCF0', color: MX_NAVY2 }
                          : { backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
                      >{r.status ?? 'Active'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* empty state */}
        {filtered.length === 0 && !rules.isLoading && (
          <div className="text-center py-14">
            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No rules match the selected filters</p>
          </div>
        )}

        {/* pagination */}
        {totalPages > 1 && (
          <div
            className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between"
            style={{ backgroundColor: '#fafafa' }}
          >
            <span className="text-[11px] text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline" size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >‹ Prev</Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <Button
                    key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                    className="h-7 w-7 px-0 text-xs"
                    style={p === page ? { backgroundColor: MX_NAVY, borderColor: MX_NAVY } : {}}
                    onClick={() => setPage(p)}
                  >{p}</Button>
                );
              })}
              <Button
                variant="outline" size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >Next ›</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Anchor Items panel (LBI only) ─────────────────────────────────── */}
      {showAnchors && anchorItemsApi && (
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid #B8C4E0` }}>
          <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md p-1.5" style={{ backgroundColor: '#EEF1F8' }}>
                <Anchor className="h-3.5 w-3.5" style={{ color: MX_NAVY }} />
              </div>
              <span className="text-sm font-semibold text-gray-800">Anchor Items</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF1F8', color: MX_NAVY }}>
                {anchors.data?.length ?? 0}
              </span>
            </div>
            <select
              className="rounded-lg px-2 h-8 text-xs bg-white text-gray-700"
              style={{ border: '1px solid #B8C4E0' }}
              value={anchorReport}
              onChange={e => setAnchorReport(e.target.value)}
            >
              <option value="">All report types</option>
              {uniqueTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </select>
          </div>
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-[11px] leading-relaxed" style={{ color: `${MX_NAVY2}cc` }}>
              Anchor items are <strong>reverse-scored questions in anchor subdomains</strong> — the most diagnostically sensitive items within each report type.
              They most reliably differentiate learner profiles and flag areas needing clinical attention.
            </p>
          </div>
          {anchors.isLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: '#EEF1F8' }} />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Code','Question','Subdomain','Domain','Report','Keying'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ borderColor: '#EEF1F8' }} className="divide-y">
                  {(anchors.data || []).map((a: any, i: number) => {
                    const dark  = REPORT_COLORS[a.anchor_report_type] || MX_NAVY;
                    const light = REPORT_LIGHT[a.anchor_report_type]  || '#EEF1F8';
                    return (
                      <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#EEF1F8' }}>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-gray-400 whitespace-nowrap">{a.question_code}</td>
                        <td className="px-3 py-2.5 text-gray-700 max-w-xs">
                          <span className="block truncate">{(a.question_text || '').slice(0, 90)}{(a.question_text || '').length > 90 ? '…' : ''}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500 whitespace-nowrap">{a.subdomain_code}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-medium" style={{ backgroundColor: `${MX_NAVY}10`, color: MX_NAVY }}>{a.domain_code}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: light, color: dark }}>
                            {a.anchor_report_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {a.reverse_scored
                            ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#D6DCF0', color: MX_NAVY2 }}>↺ Reverse</span>
                            : <span className="text-gray-400 text-[10px]">Standard</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(anchors.data?.length ?? 0) === 0 && !anchors.isLoading && (
            <div className="text-center py-10 text-sm font-medium" style={{ color: MX_NAVY }}>No anchor items found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────
const REPORT_META: Record<string, { icon: any; label: string; tagline: string }> = {
  // LBI
  CURIOSITY:  { icon: Sparkles,   label: 'Curiosity',            tagline: 'What fuels learning?' },
  INSIGHT:    { icon: Eye,        label: 'Insight',              tagline: 'How well do I know myself?' },
  GROWTH:     { icon: TrendingUp, label: 'Growth',               tagline: 'What am I building?' },
  MASTERY:    { icon: Trophy,     label: 'Mastery',              tagline: 'What can I perform under pressure?' },
  // CAPADEX
  ACADEMIC:   { icon: BookOpen,   label: 'Academic Development', tagline: 'Cognitive & scholastic capabilities' },
  SOCIAL:     { icon: Users,      label: 'Social & Emotional',   tagline: 'Relationship intelligence & leadership' },
  WELLNESS:   { icon: Heart,      label: 'Wellness & Health',    tagline: 'Physical & holistic well-being' },
  // Competency
  CORE:       { icon: Target,     label: 'Core Competencies',    tagline: 'Foundation of all professional roles' },
  TECHNICAL:  { icon: Cpu,        label: 'Technical',            tagline: 'Domain-specific skill proficiencies' },
  LEADERSHIP: { icon: Trophy,     label: 'Leadership',           tagline: 'Influence, direction & team performance' },
  FUNCTIONAL: { icon: Sliders,    label: 'Functional',           tagline: 'Role-specific operational competencies' },
  BEHAVIORAL: { icon: Sparkles,   label: 'Behavioral',           tagline: 'Workplace behaviours that shape culture' },
};

export function ReportsTab({
  reportTypesApi, clusterCorrelationsApi, color, frameworkName,
}: {
  reportTypesApi: string;
  clusterCorrelationsApi?: string;
  color: string;
  frameworkName?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCorr, setShowCorr] = useState(false);

  const types = useQuery<any[]>({
    queryKey: [reportTypesApi],
    queryFn:  () => jget(reportTypesApi),
  });

  const subdomains = useQuery<any[]>({
    queryKey: [`${reportTypesApi}/${selected}/subdomains`],
    queryFn:  () => jget(`${reportTypesApi}/${selected}/subdomains`),
    enabled:  !!selected,
  });

  // Eager cluster fetch — loads count immediately, full data when expanded
  const clusters = useQuery<any[]>({
    queryKey: [clusterCorrelationsApi || ''],
    queryFn:  () => jget(clusterCorrelationsApi!),
    enabled:  !!clusterCorrelationsApi,
    staleTime: 60_000,
  });

  const subsByDomain = useMemo(() => {
    if (!subdomains.data) return {};
    return subdomains.data.reduce<Record<string, any[]>>((acc, s) => {
      const key = `${s.domain_code} — ${s.domain_name}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
  }, [subdomains.data]);

  if (types.isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-28 rounded-xl animate-pulse" style={{ backgroundColor: `${MX_NAVY}20` }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const totalSubs  = (types.data || []).reduce((s: number, rt: any) => s + (rt.subdomain_count || 0), 0);
  const typeNames  = (types.data || []).map((rt: any) => rt.type_name || rt.type_code);
  const clusterCnt = clusters.data?.length ?? null;

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: '#EEF1F8' }}>
            <FileText className="h-4 w-4" style={{ color: MX_NAVY }} />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">Report Intelligence</p>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">
              {frameworkName ? `${frameworkName} — ` : ''}Report Type Architecture
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(types.data || []).map((rt: any) => (
            <div key={rt.type_code} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border" style={{ borderColor: '#D6DCF0', backgroundColor: '#EEF1F8' }}>
              <span className="text-sm font-semibold" style={{ color: MX_NAVY }}>{rt.subdomain_count}</span>
              <span className="text-[10px] text-gray-400 font-medium">{rt.type_code}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border" style={{ borderColor: '#D6DCF0', backgroundColor: '#EEF1F8' }}>
            <span className="text-sm font-semibold" style={{ color: MX_NAVY }}>{totalSubs}</span>
            <span className="text-[10px] text-gray-400 font-medium">Subdomains</span>
          </div>
        </div>
      </div>

      {/* ── Report type cards 2×N grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(types.data || []).map((rt: any) => {
          const dark   = REPORT_COLORS[rt.type_code] || MX_NAVY;
          const light  = REPORT_LIGHT[rt.type_code]  || '#f3f4f6';
          const mid    = REPORT_MID[rt.type_code]    || dark;
          const meta   = REPORT_META[rt.type_code]   || { icon: FileText, label: rt.type_name || rt.type_code, tagline: '' };
          const Icon   = meta.icon;
          const isOpen = selected === rt.type_code;
          const pct    = totalSubs > 0 ? Math.round((rt.subdomain_count / totalSubs) * 100) : 0;

          return (
            <div key={rt.type_code} className="flex flex-col">
              <div
                className="rounded-xl border-2 overflow-hidden transition-all shadow-sm hover:shadow-md"
                style={{
                  borderColor: isOpen ? dark : '#e5e7eb',
                  boxShadow:   isOpen ? `0 0 0 3px ${dark}18` : undefined,
                }}
              >
                {/* ── Card header (coloured tint) ── */}
                <button
                  onClick={() => setSelected(isOpen ? null : rt.type_code)}
                  className="w-full text-left focus:outline-none"
                >
                  <div className="px-5 pt-5 pb-4" style={{ backgroundColor: light }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="rounded-xl p-2.5 shrink-0 shadow-sm"
                          style={{ backgroundColor: dark }}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm leading-tight" style={{ color: dark }}>
                            {meta.label}
                          </div>
                          <div className="text-[11px] font-normal mt-0.5" style={{ color: `${dark}99` }}>
                            {meta.tagline}
                          </div>
                        </div>
                      </div>
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 mt-1 shrink-0" style={{ color: dark }} />
                        : <ChevronRight className="h-4 w-4 mt-1 shrink-0" style={{ color: `${dark}60` }} />}
                    </div>
                  </div>

                  {/* ── Stats row ── */}
                  <div
                    className="bg-white px-5 py-3.5 flex items-center gap-5 border-t"
                    style={{ borderColor: `${dark}18` }}
                  >
                    <div>
                      <div className="text-xl font-bold leading-none" style={{ color: dark }}>
                        {rt.subdomain_count}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium mt-0.5">Subdomains</div>
                    </div>
                    <div className="w-px h-8 bg-gray-100 shrink-0" />
                    <div>
                      <div className="text-xl font-bold leading-none" style={{ color: MX_NAVY2 }}>
                        {rt.anchor_subdomain_count ?? 0}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium mt-0.5">Anchor Subs</div>
                    </div>
                    <div className="w-px h-8 bg-gray-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-500 font-medium">Share of framework</span>
                        <span className="text-[11px] font-semibold" style={{ color: dark }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: mid }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Description ── */}
                  {rt.description && (
                    <div className="bg-white px-5 pb-4 pt-0 border-t border-gray-50">
                      <p className="text-[11px] text-gray-500 leading-relaxed">{rt.description}</p>
                    </div>
                  )}
                </button>

                {/* ── Expanded subdomain drawer ── */}
                {isOpen && (
                  <div className="border-t-2" style={{ borderColor: `${dark}25` }}>
                    <div className="px-5 py-2.5 flex items-center gap-2" style={{ backgroundColor: `${light}cc` }}>
                      <Anchor className="h-3 w-3 shrink-0" style={{ color: dark }} />
                      <span className="text-[11px] font-semibold" style={{ color: dark }}>
                        Anchor subdomains highlighted · primary diagnostic differentiators
                      </span>
                    </div>
                    <div className="bg-white p-4">
                      {subdomains.isLoading ? (
                        <div className="space-y-2">
                          {[1,2,3].map(i => <div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse" />)}
                        </div>
                      ) : Object.keys(subsByDomain).length === 0 ? (
                        <p className="text-[11px] text-gray-400 text-center py-4">No subdomains found</p>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(subsByDomain).map(([domainKey, subs]) => (
                            <div key={domainKey}>
                              <div
                                className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2 pb-1.5 border-b"
                                style={{ color: MX_NAVY2, borderColor: `${MX_NAVY}18` }}
                              >{domainKey}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {(subs as any[]).map((s: any) => (
                                  <div
                                    key={s.subdomain_code}
                                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-all"
                                    style={s.is_anchor_subdomain
                                      ? { backgroundColor: light, color: dark, borderColor: `${dark}45` }
                                      : { backgroundColor: '#f9fafb', color: '#4b5563', borderColor: '#e5e7eb' }
                                    }
                                  >
                                    {s.is_anchor_subdomain && (
                                      <Anchor className="h-2.5 w-2.5 shrink-0" style={{ color: dark }} />
                                    )}
                                    <span className="font-mono text-[9px] opacity-50">{s.subdomain_code}</span>
                                    <span>{s.subdomain_name}</span>
                                    {(s.anchor_item_count ?? 0) > 0 && (
                                      <span
                                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white ml-0.5"
                                        style={{ backgroundColor: dark }}
                                      >{s.anchor_item_count}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Cluster–Report Correlations ───────────────────────────────────── */}
      {clusterCorrelationsApi && (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <button
            className="w-full text-left px-5 py-3.5 flex items-center justify-between border-b border-gray-100 focus:outline-none bg-white"
            onClick={() => setShowCorr(v => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md p-1.5 shrink-0" style={{ backgroundColor: '#EEF1F8' }}>
                <GitBranch className="h-3.5 w-3.5" style={{ color: MX_NAVY }} />
              </div>
              <span className="text-sm font-semibold text-gray-800">Cluster–Report Correlations</span>
              {clusterCnt !== null && (
                <span className="text-[11px] text-gray-400 font-medium">
                  {clusterCnt} behaviour cluster{clusterCnt !== 1 ? 's' : ''} mapped to report types
                </span>
              )}
            </div>
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: MX_NAVY, color: MX_NAVY, backgroundColor: `${MX_NAVY}08` }}
            >
              {showCorr
                ? <><ChevronDown className="h-3.5 w-3.5" />Collapse</>
                : <><ChevronRight className="h-3.5 w-3.5" />Expand</>}
            </div>
          </button>

          {showCorr && (
            <div className="p-5">
              <p className="text-[11px] text-gray-500 mb-5 leading-relaxed max-w-2xl">
                Clusters group statistically correlated subdomains for cross-domain behavioural pattern analysis.
                Each cluster's members are colour-coded by report type — enabling composite cluster scores
                to feed into the appropriate report type output.
              </p>
              {clusters.isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : clusters.isError ? (
                <div
                  className="flex items-center gap-2.5 text-sm rounded-xl px-4 py-3.5 border"
                  style={{ backgroundColor: '#EEF1F8', borderColor: '#B8C4E0', color: MX_NAVY2 }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Could not load cluster correlations — no clusters may be configured yet</span>
                </div>
              ) : (clusters.data || []).length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-400 font-medium">No clusters configured for this framework</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(clusters.data || []).map((cl: any) => {
                    const reportCounts: Record<string, number> = {};
                    (cl.subdomains || []).forEach((s: any) => {
                      if (s.report_type_code) reportCounts[s.report_type_code] = (reportCounts[s.report_type_code] || 0) + 1;
                    });
                    const dominant = Object.entries(reportCounts).sort((a, b) => b[1] - a[1])[0];
                    const clColor  = dominant ? REPORT_COLORS[dominant[0]] : MX_NAVY;
                    const clLight  = dominant ? REPORT_LIGHT[dominant[0]] : '#f3f4f6';

                    return (
                      <div
                        key={cl.cluster_code}
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: `${clColor}28` }}
                      >
                        {/* cluster header */}
                        <div
                          className="px-4 py-3 flex items-center justify-between"
                          style={{ backgroundColor: clLight }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: clColor }} />
                            <span className="font-semibold text-sm" style={{ color: clColor }}>
                              {cl.cluster_name}
                            </span>
                            <span className="font-mono text-[10px] text-gray-400 bg-white/70 px-1.5 py-0.5 rounded">
                              {cl.cluster_code}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {Object.entries(reportCounts).map(([rt, cnt]) => (
                              <span
                                key={rt}
                                className="text-[10px] font-medium text-white rounded-full px-2.5 py-0.5"
                                style={{ backgroundColor: REPORT_COLORS[rt] || MX_NAVY }}
                              >{rt} ×{cnt}</span>
                            ))}
                          </div>
                        </div>
                        {/* subdomain chips */}
                        <div className="bg-white p-3 flex flex-wrap gap-1.5">
                          {(cl.subdomains || []).map((s: any) => {
                            const sDark  = s.report_type_code ? REPORT_COLORS[s.report_type_code] : '#9ca3af';
                            const sLight = s.report_type_code ? REPORT_LIGHT[s.report_type_code]  : '#f3f4f6';
                            return (
                              <span
                                key={s.subdomain_code}
                                className="flex items-center gap-1 text-[10px] rounded-lg px-2 py-1 font-semibold border"
                                style={{ backgroundColor: sLight, color: sDark, borderColor: `${sDark}35` }}
                              >
                                {s.is_anchor && <Anchor className="h-2 w-2 shrink-0" />}
                                {s.subdomain_code}
                              </span>
                            );
                          })}
                        </div>
                        {cl.cluster_description && (
                          <div className="bg-white px-4 pb-3 pt-2 border-t border-gray-50">
                            <p className="text-[11px] text-gray-500 leading-relaxed">{cl.cluster_description}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
