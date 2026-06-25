import { BRAND } from '@/design-system/tokens';
/**
 * ReferenceIntelligencePanel
 * Phase 1 admin UI for canonical reference data powering Employability Index.
 *
 * 8 tabs:
 *   Institutions | Qualifications | Certifications | Skills | Occupations
 *   Provenance   | Review Queue   | Audit Logs
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, GraduationCap, Award, Code2, Briefcase,
  ShieldCheck, Inbox, ScrollText, Search, Plus, Pencil, Trash2,
  Tag, Layers, RefreshCw, Database, Star, Loader2, Sparkles, Crown,
} from 'lucide-react';



type EntityKey = 'institutions' | 'qualifications' | 'certifications' | 'skills' | 'occupations';

const ENTITY_META: Record<EntityKey, { label: string; icon: any; nameField: string; shortField?: string }> = {
  institutions:   { label: 'Institutions',   icon: Building2,    nameField: 'canonical_name', shortField: 'short_name' },
  qualifications: { label: 'Qualifications', icon: GraduationCap, nameField: 'canonical_name', shortField: 'short_name' },
  certifications: { label: 'Certifications', icon: Award,        nameField: 'canonical_name', shortField: 'short_name' },
  skills:         { label: 'Skills',         icon: Code2,        nameField: 'canonical_name' },
  occupations:    { label: 'Occupations',    icon: Briefcase,    nameField: 'canonical_title' },
};

async function api(method: string, url: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const text = await res.text();
  let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(json?.error || json?.detail || res.statusText);
  return json;
}

function TierBadge({ tier }: { tier?: number | null }) {
  if (!tier) return <Badge variant="outline" className="text-xs">—</Badge>;
  const colour = tier === 1 ? '#10b981' : tier === 2 ? '#f59e0b' : '#94a3b8';
  return <Badge style={{ background: colour, color: '#fff' }} className="text-xs">Tier {tier}</Badge>;
}

function CertTierBadge({ tier }: { tier?: string }) {
  const map: any = { top: '#10b981', mid: '#3b82f6', generic: '#94a3b8' };
  return <Badge style={{ background: map[tier || ''] || '#94a3b8', color: '#fff' }} className="text-xs uppercase">{tier || '—'}</Badge>;
}

export default function ReferenceIntelligencePanel() {
  const { toast } = useToast();
  const [tab, setTab] = useState<EntityKey | 'provenance' | 'review' | 'audit'>('institutions');
  const [stats, setStats] = useState<any>(null);
  const [seedRunning, setSeedRunning] = useState(false);

  const loadStats = async () => {
    try { setStats(await api('GET', '/api/admin/reference/stats')); } catch (e: any) { /* ignore */ }
  };
  useEffect(() => { loadStats(); }, []);

  const runSeed = async () => {
    if (!confirm('Load curated seed data (institutions, qualifications, certifications, skills, occupations)?\n\nSafe to re-run — uses upsert.')) return;
    setSeedRunning(true);
    try {
      const r = await api('POST', '/api/admin/reference/seed', { reason: 'manual admin trigger' });
      toast({ title: 'Seed complete', description: `Inst ${r.institutions} • Qual ${r.qualifications} • Cert ${r.certifications} • Skill ${r.skills} • Occ ${r.occupations}` });
      await loadStats();
    } catch (e: any) {
      toast({ title: 'Seed failed', description: e.message, variant: 'destructive' });
    } finally { setSeedRunning(false); }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BRAND.primary}08, ${BRAND.primary}14)` }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: BRAND.primary }}>
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: BRAND.primary }}>Reference Intelligence</h1>
                <p className="text-xs text-slate-600">Canonical institutions, qualifications, certifications, skills & occupations — with provenance &amp; governance.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={loadStats}><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
            <Button size="sm" onClick={runSeed} disabled={seedRunning} style={{ background: BRAND.accent, color: '#fff' }}>
              {seedRunning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              Load Seed Data
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-7 gap-3 mt-4">
            {(['institutions','qualifications','certifications','skills','occupations'] as EntityKey[]).map(k => (
              <div key={k} className="bg-white rounded-lg border px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{ENTITY_META[k].label}</div>
                <div className="text-lg font-semibold" style={{ color: BRAND.primary }}>{stats[k]?.active ?? 0} <span className="text-xs text-slate-400">/ {stats[k]?.total ?? 0}</span></div>
              </div>
            ))}
            <div className="bg-white rounded-lg border px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Provenance</div>
              <div className="text-lg font-semibold" style={{ color: BRAND.primary }}>{stats.provenance_records ?? 0}</div>
            </div>
            <div className="bg-white rounded-lg border px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Review Queue</div>
              <div className="text-lg font-semibold" style={{ color: BRAND.warning }}>{stats.review_queue?.pending ?? 0}</div>
            </div>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="px-4 pt-3 bg-white border-b flex-shrink-0 flex gap-1 overflow-x-auto">
          {(Object.keys(ENTITY_META) as EntityKey[]).map(k => {
            const Icon = ENTITY_META[k].icon;
            return <TabsTrigger key={k} value={k} className="gap-1.5"><Icon className="w-3.5 h-3.5" />{ENTITY_META[k].label}</TabsTrigger>;
          })}
          <TabsTrigger value="provenance" className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Provenance</TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5"><Inbox className="w-3.5 h-3.5" />Review Queue</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="w-3.5 h-3.5" />Audit</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          {(Object.keys(ENTITY_META) as EntityKey[]).map(k => (
            <TabsContent key={k} value={k} className="m-0 p-4">
              <EntityTab entity={k} onChange={loadStats} />
            </TabsContent>
          ))}
          <TabsContent value="provenance" className="m-0 p-4"><ProvenanceTab /></TabsContent>
          <TabsContent value="review" className="m-0 p-4"><ReviewQueueTab onChange={loadStats} /></TabsContent>
          <TabsContent value="audit" className="m-0 p-4"><AuditTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function EntityTab({ entity, onChange }: { entity: EntityKey; onChange: () => void }) {
  const meta = ENTITY_META[entity];
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api('GET', `/api/admin/reference/entities/${entity}?q=${encodeURIComponent(q)}&limit=200`);
      setItems(r.items || []); setTotal(r.total || 0);
    } catch (e: any) { toast({ title: 'Load failed', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" placeholder={`Search ${meta.label.toLowerCase()}…`} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Badge variant="outline">{loading ? '…' : `${items.length} of ${total}`}</Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setCreating(true)} style={{ background: BRAND.primary, color: '#fff' }}>
          <Plus className="w-3.5 h-3.5 mr-1" />New
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-slate-700">Name</th>
                {entity === 'institutions' && <><th className="px-3 py-2 font-medium text-slate-700">Type</th><th className="px-3 py-2 font-medium text-slate-700">Location</th><th className="px-3 py-2 font-medium text-slate-700">Tier</th></>}
                {entity === 'qualifications' && <><th className="px-3 py-2 font-medium text-slate-700">Type</th><th className="px-3 py-2 font-medium text-slate-700">NSQF</th><th className="px-3 py-2 font-medium text-slate-700">Regulator</th><th className="px-3 py-2 font-medium text-slate-700">Weight</th></>}
                {entity === 'certifications' && <><th className="px-3 py-2 font-medium text-slate-700">Issuer</th><th className="px-3 py-2 font-medium text-slate-700">Category</th><th className="px-3 py-2 font-medium text-slate-700">Tier</th><th className="px-3 py-2 font-medium text-slate-700">Verifiable</th></>}
                {entity === 'skills' && <><th className="px-3 py-2 font-medium text-slate-700">Category</th><th className="px-3 py-2 font-medium text-slate-700">Demand</th><th className="px-3 py-2 font-medium text-slate-700">Future</th></>}
                {entity === 'occupations' && <><th className="px-3 py-2 font-medium text-slate-700">Family</th><th className="px-3 py-2 font-medium text-slate-700">Seniority</th><th className="px-3 py-2 font-medium text-slate-700">Weight</th></>}
                <th className="px-3 py-2 font-medium text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(row => (
                <tr key={row.id} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{row[meta.nameField]}</div>
                    {meta.shortField && row[meta.shortField] && <div className="text-xs text-slate-500">{row[meta.shortField]}</div>}
                    {!row.is_active && <Badge variant="outline" className="text-[10px] mt-1">inactive</Badge>}
                  </td>
                  {entity === 'institutions' && <>
                    <td className="px-3 py-2 text-slate-600">{row.institution_type}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{[row.city, row.state, row.country_code].filter(Boolean).join(', ')}</td>
                    <td className="px-3 py-2"><TierBadge tier={row.tier_computed} />{row.tier_overridden && <Crown className="inline w-3 h-3 ml-1 text-amber-500" />}</td>
                  </>}
                  {entity === 'qualifications' && <>
                    <td className="px-3 py-2 text-slate-600">{row.qualification_type}</td>
                    <td className="px-3 py-2 text-slate-600">{row.nsqf_level ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{row.regulator ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{Number(row.qualification_weight).toFixed(2)}</td>
                  </>}
                  {entity === 'certifications' && <>
                    <td className="px-3 py-2 text-slate-600">{row.issuer_name}</td>
                    <td className="px-3 py-2 text-slate-600">{row.issuer_category}</td>
                    <td className="px-3 py-2"><CertTierBadge tier={row.tier} /></td>
                    <td className="px-3 py-2">{row.verification_supported ? <Badge style={{ background: BRAND.success, color: '#fff' }} className="text-[10px]">{row.verification_method || 'yes'}</Badge> : <span className="text-xs text-slate-400">no</span>}</td>
                  </>}
                  {entity === 'skills' && <>
                    <td className="px-3 py-2 text-slate-600">{row.skill_category}</td>
                    <td className="px-3 py-2 text-slate-600">{Number(row.market_demand_score).toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{Number(row.future_relevance_score).toFixed(2)}</td>
                  </>}
                  {entity === 'occupations' && <>
                    <td className="px-3 py-2 text-slate-600">{row.role_family}</td>
                    <td className="px-3 py-2 text-slate-600">{row.seniority_level}</td>
                    <td className="px-3 py-2 text-slate-600">{Number(row.seniority_weight).toFixed(2)}</td>
                  </>}
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(row)}><Pencil className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-sm">No records. Try "Load Seed Data" above.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && <DetailDialog entity={entity} item={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); onChange(); }} />}
      {creating && <CreateDialog entity={entity} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); onChange(); }} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function CreateDialog({ entity, onClose, onSaved }: { entity: EntityKey; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(entity === 'occupations' ? { canonical_title: '', role_family: 'engineering', seniority_level: 'mid', seniority_weight: 0.55 }
    : entity === 'institutions' ? { canonical_name: '', short_name: '', institution_type: 'university', country_code: 'IN', state: '', city: '', established_year: null, website: '' }
    : entity === 'qualifications' ? { canonical_name: '', short_name: '', qualification_type: 'bachelors', nsqf_level: null, regulator: '', qualification_weight: 0.65 }
    : entity === 'certifications' ? { canonical_name: '', short_name: '', issuer_name: '', issuer_category: 'other', tier: 'mid', market_recognition_score: 0.5, technical_depth_score: 0.5, verification_supported: false }
    : { canonical_name: '', skill_category: 'technical', market_demand_score: 0.5, future_relevance_score: 0.5 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api('POST', `/api/admin/reference/entities/${entity}`, form);
      toast({ title: 'Created' });
      onSaved();
    } catch (e: any) { toast({ title: 'Create failed', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New {ENTITY_META[entity].label.slice(0, -1)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {Object.keys(form).map(k => (
            <div key={k} className={['established_year','website','reason'].includes(k) ? 'col-span-1' : 'col-span-1'}>
              <Label className="text-xs">{k}</Label>
              <Input value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value === '' ? null : (typeof form[k] === 'number' ? Number(e.target.value) : e.target.value) })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: BRAND.primary, color: '#fff' }}>{saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
function DetailDialog({ entity, item, onClose, onSaved }: { entity: EntityKey; item: any; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newRanking, setNewRanking] = useState({ ranking_source: 'NIRF', ranking_category: 'Overall', ranking_year: new Date().getFullYear(), ranking_value: 0, source_url: '' });
  const [newAccred, setNewAccred] = useState({ accreditation_authority: 'NAAC', accreditation_grade: 'A', source_url: '' });
  const [overrideTier, setOverrideTier] = useState<{ tier: number; reason: string } | null>(null);

  const load = async () => {
    try {
      const d = await api('GET', `/api/admin/reference/entities/${entity}/${item.id}`);
      setDetail(d); setEditing({ ...d, aliases: undefined, rankings: undefined, accreditations: undefined, provenance: undefined });
    } catch (e: any) { toast({ title: 'Load failed', description: e.message, variant: 'destructive' }); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [item.id]);

  if (!detail || !editing) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...patch } = editing;
      await api('PATCH', `/api/admin/reference/entities/${entity}/${item.id}`, patch);
      toast({ title: 'Saved' });
      onSaved();
    } catch (e: any) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const addAlias = async () => {
    if (!newAlias.trim()) return;
    try { await api('POST', `/api/admin/reference/entities/${entity}/${item.id}/aliases`, { alias_name: newAlias }); setNewAlias(''); await load(); }
    catch (e: any) { toast({ title: 'Add failed', description: e.message, variant: 'destructive' }); }
  };
  const removeAlias = async (aliasId: string) => {
    try { await api('DELETE', `/api/admin/reference/entities/${entity}/aliases/${aliasId}`); await load(); }
    catch (e: any) { toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }); }
  };

  const addRanking = async () => {
    try { await api('POST', `/api/admin/reference/institutions/${item.id}/rankings`, newRanking); toast({ title: 'Ranking added — tier recomputed' }); await load(); }
    catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };
  const addAccred = async () => {
    try { await api('POST', `/api/admin/reference/institutions/${item.id}/accreditations`, newAccred); toast({ title: 'Accreditation added — tier recomputed' }); await load(); }
    catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };
  const doOverrideTier = async () => {
    if (!overrideTier) return;
    try { await api('POST', `/api/admin/reference/institutions/${item.id}/override-tier`, { tier_computed: overrideTier.tier, reason: overrideTier.reason }); toast({ title: 'Tier overridden' }); setOverrideTier(null); await load(); }
    catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };
  const softDelete = async () => {
    if (!confirm('Mark as inactive? (soft delete — record preserved)')) return;
    try { await api('DELETE', `/api/admin/reference/entities/${entity}/${item.id}`); toast({ title: 'Deactivated' }); onSaved(); }
    catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };

  const meta = ENTITY_META[entity];
  const editableKeys = Object.keys(editing).filter(k => !['id', 'created_at', 'updated_at', 'tier_basis', 'tier_overridden', 'tier_override_reason'].includes(k));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><meta.icon className="w-4 h-4" />{detail[meta.nameField]}</DialogTitle></DialogHeader>

        {/* Fields */}
        <Card className="mb-3">
          <CardHeader className="py-2"><CardTitle className="text-sm">Fields</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {editableKeys.map(k => (
                <div key={k}>
                  <Label className="text-xs">{k}</Label>
                  <Input value={editing[k] ?? ''} onChange={e => setEditing({ ...editing, [k]: e.target.value === '' ? null : (typeof editing[k] === 'number' ? Number(e.target.value) : (typeof editing[k] === 'boolean' ? (e.target.value === 'true') : e.target.value)) })} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tier explanation (institutions only) */}
        {entity === 'institutions' && detail.tier_basis && (
          <Card className="mb-3 border-blue-200 bg-blue-50/30">
            <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4" />Tier Computation</CardTitle></CardHeader>
            <CardContent className="text-xs">
              <div className="flex items-center gap-2 mb-2">
                <TierBadge tier={detail.tier_computed} />
                {detail.tier_overridden && <Badge style={{ background: BRAND.warning, color: '#fff' }} className="text-[10px]">overridden: {detail.tier_override_reason}</Badge>}
                <div className="text-slate-600">basis-score = {detail.tier_basis.score}</div>
              </div>
              <pre className="bg-white p-2 rounded text-[11px] overflow-auto">{JSON.stringify(detail.tier_basis, null, 2)}</pre>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setOverrideTier({ tier: detail.tier_computed || 2, reason: '' })}>Override Tier</Button>
              </div>
              {overrideTier && (
                <div className="mt-2 p-2 border rounded bg-white">
                  <div className="flex gap-2 items-end">
                    <div>
                      <Label className="text-xs">New Tier</Label>
                      <Select value={String(overrideTier.tier)} onValueChange={v => setOverrideTier({ ...overrideTier, tier: Number(v) })}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3].map(t => <SelectItem key={t} value={String(t)}>Tier {t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Reason (required)</Label>
                      <Input value={overrideTier.reason} onChange={e => setOverrideTier({ ...overrideTier, reason: e.target.value })} />
                    </div>
                    <Button size="sm" disabled={!overrideTier.reason.trim()} onClick={doOverrideTier}>Apply</Button>
                    <Button size="sm" variant="outline" onClick={() => setOverrideTier(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Aliases */}
        {meta.shortField !== undefined || ['institutions', 'qualifications', 'certifications', 'skills'].includes(entity) ? (
          <Card className="mb-3">
            <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4" />Aliases ({detail.aliases?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-2">
                <Input placeholder="New alias…" value={newAlias} onChange={e => setNewAlias(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAlias()} />
                <Button size="sm" onClick={addAlias}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(detail.aliases || []).map((a: any) => (
                  <Badge key={a.id} variant="outline" className="gap-1">
                    {a.alias_name} <span className="text-slate-400 text-[10px]">({a.alias_type})</span>
                    <button onClick={() => removeAlias(a.id)} className="ml-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </Badge>
                ))}
                {(!detail.aliases || detail.aliases.length === 0) && <span className="text-xs text-slate-400">No aliases yet</span>}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Institution Rankings & Accreditations */}
        {entity === 'institutions' && (
          <>
            <Card className="mb-3">
              <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4" />Rankings ({detail.rankings?.length || 0})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-2 mb-2 items-end">
                  <div><Label className="text-xs">Source</Label><Select value={newRanking.ranking_source} onValueChange={v => setNewRanking({ ...newRanking, ranking_source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['NIRF', 'QS', 'THE', 'ARWU', 'FT'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Category</Label><Input value={newRanking.ranking_category} onChange={e => setNewRanking({ ...newRanking, ranking_category: e.target.value })} /></div>
                  <div><Label className="text-xs">Year</Label><Input type="number" value={newRanking.ranking_year} onChange={e => setNewRanking({ ...newRanking, ranking_year: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Rank</Label><Input type="number" value={newRanking.ranking_value} onChange={e => setNewRanking({ ...newRanking, ranking_value: Number(e.target.value) })} /></div>
                  <div className="col-span-1"><Label className="text-xs">Source URL</Label><Input value={newRanking.source_url} onChange={e => setNewRanking({ ...newRanking, source_url: e.target.value })} /></div>
                  <Button size="sm" onClick={addRanking}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left">Source</th><th className="px-2 py-1 text-left">Category</th><th className="px-2 py-1 text-left">Year</th><th className="px-2 py-1 text-left">Rank</th><th className="px-2 py-1 text-left">URL</th></tr></thead>
                  <tbody>
                    {(detail.rankings || []).map((r: any) => (
                      <tr key={r.id} className="border-b"><td className="px-2 py-1">{r.ranking_source}</td><td className="px-2 py-1">{r.ranking_category}</td><td className="px-2 py-1">{r.ranking_year}</td><td className="px-2 py-1 font-medium">{r.ranking_value}</td><td className="px-2 py-1"><a href={r.source_url} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate inline-block max-w-[180px]">{r.source_url}</a></td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="mb-3">
              <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Accreditations ({detail.accreditations?.length || 0})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2 mb-2 items-end">
                  <div><Label className="text-xs">Authority</Label><Select value={newAccred.accreditation_authority} onValueChange={v => setNewAccred({ ...newAccred, accreditation_authority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['UGC', 'AICTE', 'NAAC', 'NBA', 'NMC', 'BCI', 'PCI', 'COA', 'ICAR'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs">Grade</Label><Input value={newAccred.accreditation_grade} onChange={e => setNewAccred({ ...newAccred, accreditation_grade: e.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Source URL</Label><Input value={newAccred.source_url} onChange={e => setNewAccred({ ...newAccred, source_url: e.target.value })} /></div>
                  <Button size="sm" onClick={addAccred}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left">Authority</th><th className="px-2 py-1 text-left">Grade</th><th className="px-2 py-1 text-left">Valid From</th><th className="px-2 py-1 text-left">Valid Until</th></tr></thead>
                  <tbody>
                    {(detail.accreditations || []).map((a: any) => (
                      <tr key={a.id} className="border-b"><td className="px-2 py-1">{a.accreditation_authority}</td><td className="px-2 py-1 font-medium">{a.accreditation_grade}</td><td className="px-2 py-1">{a.valid_from || '—'}</td><td className="px-2 py-1">{a.valid_until || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Provenance */}
        <Card className="mb-3">
          <CardHeader className="py-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4" />Provenance ({detail.provenance?.length || 0})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(detail.provenance || []).slice(0, 10).map((p: any) => (
                <div key={p.id} className="text-xs flex items-center gap-2 border-b py-1">
                  <Badge variant="outline" className="text-[10px]">{p.source_authority}</Badge>
                  <span className="text-slate-600">{p.entity_type}</span>
                  {p.source_url && <a href={p.source_url} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate flex-1">{p.source_url}</a>}
                  <span className="text-slate-400">conf {Number(p.confidence_score).toFixed(2)}</span>
                  <span className="text-slate-400">{p.last_verified_at ? new Date(p.last_verified_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
              {(!detail.provenance || detail.provenance.length === 0) && <div className="text-xs text-slate-400">No provenance recorded yet.</div>}
            </div>
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={softDelete} className="text-red-600 mr-auto"><Trash2 className="w-3.5 h-3.5 mr-1" />Deactivate</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={save} disabled={saving} style={{ background: BRAND.primary, color: '#fff' }}>{saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
function ProvenanceTab() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState({ entity_type: '', source_authority: '' });
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter.entity_type) qs.set('entity_type', filter.entity_type);
      if (filter.source_authority) qs.set('source_authority', filter.source_authority);
      const r = await api('GET', `/api/admin/reference/provenance?${qs}`);
      setItems(r.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter.entity_type, filter.source_authority]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={filter.entity_type || 'all'} onValueChange={v => setFilter({ ...filter, entity_type: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Entity type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All entities</SelectItem>{['institution', 'qualification', 'certification', 'skill', 'occupation', 'ranking', 'accreditation'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter.source_authority || 'all'} onValueChange={v => setFilter({ ...filter, source_authority: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Source authority" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All sources</SelectItem>{['NIRF', 'NAAC', 'NBA', 'UGC', 'AICTE', 'QS', 'THE', 'ESCO', 'ONET', 'CREDLY'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="outline">{loading ? '…' : `${items.length} records`}</Badge>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b"><tr><th className="px-3 py-2 text-left">Entity</th><th className="px-3 py-2 text-left">Authority</th><th className="px-3 py-2 text-left">URL</th><th className="px-3 py-2 text-left">Snapshot</th><th className="px-3 py-2 text-left">Conf.</th><th className="px-3 py-2 text-left">Verified</th></tr></thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 text-xs"><Badge variant="outline" className="text-[10px]">{p.entity_type}</Badge> <span className="text-slate-400 ml-1">{p.entity_id?.slice(0, 8)}</span></td>
                <td className="px-3 py-2"><Badge style={{ background: BRAND.primary, color: '#fff' }} className="text-[10px]">{p.source_authority}</Badge></td>
                <td className="px-3 py-2 text-xs"><a href={p.source_url} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate inline-block max-w-[300px]">{p.source_url}</a></td>
                <td className="px-3 py-2 text-xs text-slate-600">{p.source_snapshot_date || '—'}</td>
                <td className="px-3 py-2 text-xs">{Number(p.confidence_score).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{p.last_verified_at ? new Date(p.last_verified_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-sm">No provenance records.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function ReviewQueueTab({ onChange }: { onChange: () => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const load = async () => {
    try { const r = await api('GET', `/api/admin/reference/review-queue?status=${status}`); setItems(r.items || []); } catch {}
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const resolve = async (item: any, action: 'merged' | 'created' | 'rejected', note?: string, merge_into_id?: string) => {
    try {
      await api('PATCH', `/api/admin/reference/review-queue/${item.id}/resolve`, { status: action, resolution_note: note, merge_into_id, create_new: action === 'created' });
      toast({ title: `Marked as ${action}` }); await load(); onChange();
    } catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{['pending', 'merged', 'created', 'rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="outline">{items.length} items</Badge>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b"><tr><th className="px-3 py-2 text-left">Entity</th><th className="px-3 py-2 text-left">Submitted Name</th><th className="px-3 py-2 text-left">Best Match</th><th className="px-3 py-2 text-left">Created</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{item.entity_type}</Badge></td>
                <td className="px-3 py-2 font-medium">{item.submitted_name}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{item.suggested_match_id ? <>match: <code>{item.suggested_match_id.slice(0, 8)}</code> ({Number(item.suggested_match_score || 0).toFixed(2)})</> : '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{new Date(item.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  {status === 'pending' && <div className="flex gap-1 justify-end">
                    {item.suggested_match_id && <Button size="sm" variant="outline" onClick={() => resolve(item, 'merged', 'fuzzy-match accepted', item.suggested_match_id)}>Merge</Button>}
                    <Button size="sm" onClick={() => resolve(item, 'created', 'new canonical entry')} style={{ background: BRAND.success, color: '#fff' }}>Create New</Button>
                    <Button size="sm" variant="outline" onClick={() => resolve(item, 'rejected', 'noise')} className="text-red-600">Reject</Button>
                  </div>}
                  {status !== 'pending' && <span className="text-xs text-slate-400">{item.resolution_note || '—'}</span>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">Queue empty.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function AuditTab() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState({ entity_type: '', action_type: '' });
  const load = async () => {
    const qs = new URLSearchParams();
    if (filter.entity_type) qs.set('entity_type', filter.entity_type);
    if (filter.action_type) qs.set('action_type', filter.action_type);
    try { const r = await api('GET', `/api/admin/reference/audit-logs?${qs}`); setItems(r.items || []); } catch {}
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter.entity_type, filter.action_type]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={filter.entity_type || 'all'} onValueChange={v => setFilter({ ...filter, entity_type: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem>{['institution', 'qualification', 'certification', 'skill', 'occupation', 'institution_ranking', 'institution_accreditation', 'reference_seed'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter.action_type || 'all'} onValueChange={v => setFilter({ ...filter, action_type: v === 'all' ? '' : v })}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem>{['create', 'update', 'delete', 'merge', 'override_tier', 'seed', 'resolve_review'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="outline">{items.length} events</Badge>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b"><tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Admin</th><th className="px-3 py-2 text-left">Action</th><th className="px-3 py-2 text-left">Entity</th><th className="px-3 py-2 text-left">Reason</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">{a.admin_email || a.admin_user_id || '—'}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{a.action_type}</Badge></td>
                <td className="px-3 py-2 text-xs">{a.entity_type} <span className="text-slate-400">{a.entity_id?.slice(0, 8)}</span></td>
                <td className="px-3 py-2 text-xs text-slate-600">{a.reason || '—'}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">No audit events.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
