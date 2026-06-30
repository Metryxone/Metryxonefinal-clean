import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Building2, Users, Briefcase, CreditCard,
  CheckCircle, XCircle, Clock, AlertTriangle, Settings,
  FileText, UserCheck, DollarSign, TrendingUp, Activity,
  Eye, UserPlus, Ban, RefreshCw, Search, Filter, LayoutGrid, LayoutList,
  Key, Lock, Unlock, ScrollText, BookOpen, Wallet, Receipt,
  Globe, Hash, GraduationCap, AlertCircle, ChevronDown,
  ChevronRight, Download, Upload, MoreHorizontal, LogOut,
  Fingerprint, ShieldCheck, Database, Server, BarChart3,
  PieChart, ArrowUpRight, ArrowDownRight, Building, Heart,
  FileCheck, UserCog, ClipboardList, Landmark, Scale,
  Plus, Trash2, Edit, Edit2, Check, X, Bell, Menu, Home, RotateCcw, ArrowRight,
  ToggleRight,
  Brain, Target, LineChart, Award, HelpCircle, Sparkles,
  Mail, Smartphone, Zap, Save, ToggleLeft, Loader2, Info, Send,
  Star, Calendar, MailCheck, History, Layers, Play,
  Crown, Package, Baby, UserCircle2, School, BookMarked,
  HeartPulse, Stethoscope, MapPin, Phone, Link2, ChevronLeft,
  ChevronUp, BadgeCheck, BadgeX, Clipboard, Repeat2, GitBranch,
  Calculator, SlidersHorizontal, FlaskConical, BarChart2, Percent,
  Cpu, Archive, Bot, Network
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';


const PKG_CATEGORIES_DEFAULT = ['Psychometric', 'Academic', 'Counselling', 'Career', 'Wellness', 'Digital Skills', 'Leadership', 'Life Skills'];
const PKG_SUBCATEGORIES_DEFAULT = ['Entry', 'Standard', 'Premium', 'Enterprise'];

function formatEntityType(type?: string): string {
  if (!type) return '';
  switch (type.toLowerCase()) {
    case 'ngo': return 'NGO'; case 'lei': return 'LEI';
    default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}
function formatDate(d?: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function formatDateTime(d?: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } }
function formatCurrency(n?: number | null) { if (n == null) return '—'; return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = { active: 'bg-green-100 text-green-800', inactive: 'bg-gray-100 text-gray-800', pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', suspended: 'bg-red-100 text-red-800', verified: 'bg-blue-100 text-blue-800' };
  return map[s] || 'bg-gray-100 text-gray-700';
}

const TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string; kpiKey: string }> = {
  school:     { label: 'Schools',      color: '#2563EB', emoji: '🏫', kpiKey: 'schools' },
  university: { label: 'Universities', color: '#7C3AED', emoji: '🎓', kpiKey: 'universities' },
  enterprise: { label: 'Enterprises',  color: '#0EA5E9', emoji: '🏢', kpiKey: 'enterprises' },
  government: { label: 'Government',    color: '#059669', emoji: '🏛️', kpiKey: 'governments' },
  ngo:        { label: 'NGOs',         color: '#DB2777', emoji: '🤝', kpiKey: 'ngos' },
};
const TIER_CONFIG: Record<string, { color: string }> = {
  basic:        { color: '#9CA3AF' },
  standard:     { color: '#3B82F6' },
  professional: { color: '#8B5CF6' },
  pro:          { color: '#8B5CF6' },
  enterprise:   { color: '#F59E0B' },
};
const TENANT_TYPES = Object.keys(TYPE_CONFIG);
const TIERS = ['basic', 'standard', 'professional', 'enterprise'];
const EMPTY = { tenant_code: '', tenant_name: '', tenant_type: 'school', contact_email: '', subscription_tier: 'basic', max_users: 100 };

export default function TenantsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState<number|null>(null);
  const [err, setErr] = useState('');

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (search) params.set('search', search);
  if (typeFilter) params.set('type', typeFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', page, search, typeFilter],
    queryFn: async () => (await fetch(`/api/admin/tenants?${params}`)).json(),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch('/api/admin/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (d) => { if (d.error) { setErr(d.error); return; } closeModal(); qc.invalidateQueries({ queryKey: ['tenants'] }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      fetch(`/api/admin/tenants/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (d) => { if (d.error) { setErr(d.error); return; } closeModal(); qc.invalidateQueries({ queryKey: ['tenants'] }); },
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/tenants/${id}/toggle`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/tenants/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { setDeleteId(null); qc.invalidateQueries({ queryKey: ['tenants'] }); },
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(''); setModalOpen(true); }
  function openEdit(t: Record<string, unknown>) {
    setEditing(t);
    setForm({
      tenant_code: t.tenant_code as string,
      tenant_name: t.tenant_name as string,
      tenant_type: t.tenant_type as string,
      contact_email: (t.contact_email as string) || '',
      subscription_tier: t.subscription_tier as string,
      max_users: t.max_users as number,
    });
    setErr('');
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); setErr(''); }

  function handleSubmit() {
    if (!form.tenant_code || !form.tenant_name) { setErr('Tenant code and name are required.'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id as number, body: { ...form } });
    } else {
      createMut.mutate({ ...form });
    }
  }

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const kpi = data?.kpi || {};

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
            <Building2 size={22} style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: BRAND.primary }}>Multi-Tenant Management</h1>
            <p className="text-xs text-gray-500">Schools, universities, enterprises, governments — all tenant organisations</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5 text-xs text-white"
          style={{ backgroundColor: BRAND.primary }}>
          <Plus size={13} /> Add Tenant
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tenants', value: Number(kpi.total||0), color: BRAND.primary },
          { label: 'Active Tenants', value: Number(kpi.active||0), color: '#10B981' },
          { label: 'Total Users', value: Number(kpi.total_users||0).toLocaleString(), color: '#6366F1' },
          { label: 'Enterprise', value: Number(kpi.enterprises||0), color: BRAND.accent },
        ].map(k => (
          <Card key={k.label} className="border shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tenant Type Summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const count = Number(kpi[cfg.kpiKey] ?? kpi[`${key}s`] ?? kpi[key] ?? 0);
          return (
            <button key={key} onClick={() => { setTypeFilter(typeFilter===key ? '' : key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${typeFilter===key ? 'text-white border-transparent' : 'bg-white text-gray-600 hover:border-gray-300'}`}
              style={typeFilter===key ? { backgroundColor: cfg.color } : {}}>
              <span>{cfg.emoji}</span> {cfg.label} <span className={`font-semibold ${typeFilter===key ? 'text-white' : ''}`} style={typeFilter!==key ? {color:cfg.color} : {}}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>
              Tenants <span className="font-normal text-gray-400">({total})</span>
            </CardTitle>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name / code / email…" className="pl-7 h-7 text-xs w-56" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading tenants…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No tenants found. Create your first tenant to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {['Code','Name','Type','Tier','Contact','Users','Status','Actions'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t: Record<string, unknown>) => {
                    const tcfg = TYPE_CONFIG[t.tenant_type as string] || { label: t.tenant_type as string, color: '#6B7280', emoji: '🏢' };
                    const tiercfg = TIER_CONFIG[t.subscription_tier as string] || { color: '#9CA3AF' };
                    return (
                      <tr key={t.id as number} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{t.tenant_code as string}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: BRAND.primary }}>{t.tenant_name as string}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: tcfg.color }}>
                            {tcfg.emoji} {tcfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize" style={{ color: tiercfg.color, backgroundColor: `${tiercfg.color}15` }}>
                            {t.subscription_tier as string}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{(t.contact_email as string) || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">
                          <span style={{ color: BRAND.primary }}>{t.active_users as number}</span>
                          <span className="text-gray-400"> / {t.max_users as number}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            {t.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Edit">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => toggleMut.mutate(t.id as number)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Toggle active">
                              {t.is_active ? <ToggleRight size={13} className="text-green-500" /> : <ToggleLeft size={13} />}
                            </button>
                            <button onClick={() => setDeleteId(t.id as number)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > 25 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-gray-500">Showing {(page-1)*25+1}–{Math.min(page*25,total)} of {total}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page*25>=total} onClick={() => setPage(p=>p+1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: BRAND.primary }}>
                {editing ? 'Edit Tenant' : 'Add New Tenant'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{err}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tenant Code *</label>
                  <Input value={form.tenant_code} onChange={e => setForm(f => ({...f, tenant_code: e.target.value.toUpperCase()}))}
                    placeholder="e.g. SCHOOL_01" className="h-8 text-xs font-mono" disabled={!!editing} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Type</label>
                  <select value={form.tenant_type} onChange={e => setForm(f => ({...f, tenant_type: e.target.value}))}
                    className="w-full h-8 text-xs border rounded-md px-2 bg-white">
                    {TENANT_TYPES.map(t => <option key={t} value={t} className="capitalize">{TYPE_CONFIG[t]?.emoji} {TYPE_CONFIG[t]?.label || t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tenant Name *</label>
                <Input value={form.tenant_name} onChange={e => setForm(f => ({...f, tenant_name: e.target.value}))}
                  placeholder="Full organisation name" className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Contact Email</label>
                <Input value={form.contact_email} onChange={e => setForm(f => ({...f, contact_email: e.target.value}))}
                  placeholder="admin@organisation.com" className="h-8 text-xs" type="email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Subscription Tier</label>
                  <select value={form.subscription_tier} onChange={e => setForm(f => ({...f, subscription_tier: e.target.value}))}
                    className="w-full h-8 text-xs border rounded-md px-2 bg-white capitalize">
                    {TIERS.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max Users</label>
                  <Input value={form.max_users} onChange={e => setForm(f => ({...f, max_users: parseInt(e.target.value)||100}))}
                    type="number" min="1" className="h-8 text-xs" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={closeModal} className="flex-1 text-xs h-8">Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}
                className="flex-1 text-xs h-8 text-white flex items-center justify-center gap-1"
                style={{ backgroundColor: BRAND.primary }}>
                <Save size={13} /> {editing ? 'Save Changes' : 'Create Tenant'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-red-600">Delete Tenant?</h2>
            <p className="text-xs text-gray-600">This will permanently remove the tenant record. This action cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1 text-xs h-8">Cancel</Button>
              <Button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex-1 text-xs h-8 bg-red-500 hover:bg-red-600 text-white">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
