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
  Plus, Trash2, Edit, Check, X, Bell, Menu, Home, RotateCcw, ArrowRight,
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
import { apiRequest, queryClient as defaultClient } from '@/lib/queryClient';
import { CONCERN_CATEGORIES } from '@/data/concernAreas';
import { CONSTRUCTS, CONSTRUCT_MAP, CLUSTERS } from '@/data/behaviouralConstructs';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', cyan: '#4ECDC4', teal: '#4ECDC4', bg: '#f1f5f9', lightBg: '#f8fafc', dark: '#1e293b', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1' };
const PKG_CATEGORIES_DEFAULT = ['Psychometric', 'Academic', 'Counselling', 'Career', 'Wellness', 'Digital Skills', 'Leadership', 'Life Skills'];
const PKG_SUBCATEGORIES_DEFAULT = ['Entry', 'Standard', 'Premium', 'Enterprise'];

const ALL_PERSONAS: Array<{ key: string; label: string }> = [
  { key: 'parent',      label: 'Parent' },
  { key: 'student',     label: 'Student' },
  { key: 'teacher',     label: 'Teacher' },
  { key: 'counsellor',  label: 'Counsellor' },
  { key: 'corporate',   label: 'Corporate / Manager' },
  { key: 'job_seeker',  label: 'Job Seeker' },
  { key: 'institute',   label: 'Institute' },
  { key: 'mentor',      label: 'Mentor' },
];
const SERVICES: string[] = [
  'Counselling', 'Coaching', 'Assessment', 'Therapy', 'Workshop',
  'Mentoring', 'Tutoring', 'Career Guidance', 'Skill Training', 'Group Programme',
];
const ROLES: string[] = [
  'Psychologist', 'Counsellor', 'Therapist', 'Career Coach', 'Life Coach',
  'Academic Tutor', 'Special Educator', 'Mentor', 'Trainer', 'Consultant',
];

type ConcernRow = {
  id: number;
  category: string;
  concern_area: string;
  parent_worry: string;
  impact_on_child: string;
  assessment_type?: string | null;
  search_keywords?: string | null;
  services?: string[] | null;
  roles?: string[] | null;
  target_personas?: string[] | null;
  construct_key?: string | null;
  construct_label?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

type FormState = {
  category: string;
  concern_area: string;
  parent_worry: string;
  impact_on_child: string;
  assessment_type: string;
  search_keywords: string;
  services: string[];
  roles: string[];
  target_personas: string[];
  is_active: boolean;
  sort_order: number;
};

const emptyForm: FormState = {
  category: '',
  concern_area: '',
  parent_worry: '',
  impact_on_child: '',
  assessment_type: 'lbi',
  search_keywords: '',
  services: [],
  roles: [],
  target_personas: [],
  is_active: true,
  sort_order: 0,
};

function ChipPicker({
  options, selected, onToggle, getLabel,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  getLabel?: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            {getLabel ? getLabel(o) : o}
          </button>
        );
      })}
    </div>
  );
}

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

export default function ConcernAreasPanel() {
  const { toast } = useToast();
  const qc = useQueryClient() ?? defaultClient;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [personaFilter, setPersonaFilter] = useState<string>('all');
  const [constructFilter, setConstructFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<ConcernRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ concerns: ConcernRow[] }>({
    queryKey: ['/api/concerns/admin/list'],
    queryFn: async () => {
      const res = await fetch('/api/concerns/admin/list', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load concerns');
      return res.json();
    },
    staleTime: 15000,
  });

  const concerns = data?.concerns ?? [];

  const allCategories = useMemo(() => {
    const set = new Set<string>([...CONCERN_CATEGORIES, ...concerns.map(c => c.category)]);
    return Array.from(set).filter(Boolean).sort();
  }, [concerns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return concerns.filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (personaFilter !== 'all' && !(c.target_personas ?? []).includes(personaFilter)) return false;
      if (constructFilter !== 'all' && c.construct_key !== constructFilter) return false;
      if (!q) return true;
      return (
        c.concern_area.toLowerCase().includes(q) ||
        c.parent_worry.toLowerCase().includes(q) ||
        c.impact_on_child.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.construct_label ?? '').toLowerCase().includes(q)
      );
    });
  }, [concerns, search, category, personaFilter, constructFilter]);

  const byCategoryCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of concerns) counts[c.category] = (counts[c.category] || 0) + 1;
    return counts;
  }, [concerns]);

  const byConstructCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of concerns) {
      if (c.construct_key) counts[c.construct_key] = (counts[c.construct_key] || 0) + 1;
    }
    return counts;
  }, [concerns]);

  const unmappedCount = useMemo(
    () => concerns.filter(c => !c.construct_key).length,
    [concerns]
  );

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, sort_order: concerns.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (c: ConcernRow) => {
    setEditId(c.id);
    setForm({
      category: c.category,
      concern_area: c.concern_area,
      parent_worry: c.parent_worry,
      impact_on_child: c.impact_on_child,
      assessment_type: c.assessment_type ?? 'lbi',
      search_keywords: c.search_keywords ?? '',
      services: Array.isArray(c.services) ? c.services : [],
      roles: Array.isArray(c.roles) ? c.roles : [],
      target_personas: Array.isArray(c.target_personas) ? c.target_personas : [],
      is_active: !!c.is_active,
      sort_order: c.sort_order ?? 0,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editId == null) {
        const res = await apiRequest('POST', '/api/concerns/admin', payload);
        return res.json();
      }
      const res = await apiRequest('PATCH', `/api/concerns/admin/${editId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editId ? 'Concern updated' : 'Concern added' });
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['/api/concerns/admin/list'] });
      refetch();
    },
    onError: (e: any) => {
      toast({ title: 'Save failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/concerns/admin/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Concern deleted' });
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ['/api/concerns/admin/list'] });
      refetch();
    },
    onError: (e: any) => {
      toast({ title: 'Delete failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category || !form.concern_area || !form.parent_worry || !form.impact_on_child) {
      toast({ title: 'Missing fields', description: 'Category, concern, parent worry and impact are required.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const toggleArr = (key: 'services' | 'roles' | 'target_personas', v: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v],
    }));
  };

  const personaLabel = (key: string) => ALL_PERSONAS.find(p => p.key === key)?.label ?? key;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Concern Areas</h2>
          <p className="text-gray-500 mt-1">
            Manage concern areas powering assessments — each mapped to one of 32 canonical behavioural constructs.
          </p>
        </div>
        <Button onClick={openCreate} className="text-white" style={{ backgroundColor: BRAND.primary }}>
          <Plus className="h-4 w-4 mr-1" /> New Concern
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total Concerns</div>
          <div className="text-2xl font-bold mt-1" style={{ color: BRAND.primary }}>{concerns.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Constructs Used</div>
          <div className="text-2xl font-bold mt-1" style={{ color: BRAND.primary }}>{Object.keys(byConstructCount).length}<span className="text-sm font-normal text-gray-400"> / 32</span></div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Showing</div>
          <div className="text-2xl font-bold mt-1" style={{ color: BRAND.teal }}>{filtered.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Unmapped</div>
          <div className="text-2xl font-bold mt-1" style={{ color: unmappedCount > 0 ? '#f59e0b' : '#10b981' }}>{unmappedCount}</div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
        <Input
          placeholder="Search concern, parent worry, construct..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:max-w-sm"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-52"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories ({concerns.length})</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat} ({byCategoryCount[cat] ?? 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={constructFilter} onValueChange={setConstructFilter}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="All constructs" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All constructs ({concerns.length})</SelectItem>
            {CLUSTERS.map(cluster => (
              <React.Fragment key={cluster}>
                <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-gray-400 font-semibold border-t mt-1 pt-2">
                  {cluster}
                </div>
                {CONSTRUCTS.filter(c => c.cluster === cluster).map(c => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label} ({byConstructCount[c.key] ?? 0})
                  </SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
        <Select value={personaFilter} onValueChange={setPersonaFilter}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="All personas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All personas</SelectItem>
            {ALL_PERSONAS.map(p => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: BRAND.bg }}>
                <tr className="text-left text-gray-700">
                  <th className="px-4 py-3 font-semibold w-10">#</th>
                  <th className="px-4 py-3 font-semibold w-28">Category</th>
                  <th className="px-4 py-3 font-semibold">Concern Area</th>
                  <th className="px-4 py-3 font-semibold w-44">Construct</th>
                  <th className="px-4 py-3 font-semibold">Parent Worry</th>
                  <th className="px-4 py-3 font-semibold w-44">Personas</th>
                  <th className="px-4 py-3 font-semibold w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
                )}
                {isError && !isLoading && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-red-500">
                    Failed to load. Make sure you are signed in as super admin.
                  </td></tr>
                )}
                {!isLoading && !isError && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No concern areas match your filters.
                  </td></tr>
                )}
                {filtered.map((c, idx) => {
                  const constructInfo = c.construct_key ? CONSTRUCT_MAP[c.construct_key] : null;
                  return (
                    <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-normal text-[11px]" style={{ backgroundColor: '#D6DCF0', color: BRAND.primary }}>
                          {c.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.concern_area}</p>
                        {!c.is_active && <span className="text-[10px] uppercase text-gray-400">(inactive)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {constructInfo ? (
                          <div>
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${constructInfo.color}18`, color: constructInfo.color }}
                            >
                              {constructInfo.label}
                            </span>
                            <p className="text-[10px] text-gray-400 mt-0.5">{constructInfo.cluster}</p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-500 italic">Unmapped</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 italic text-[13px]">{c.parent_worry}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.target_personas ?? []).length === 0
                            ? <span className="text-xs text-gray-400">All personas</span>
                            : (c.target_personas ?? []).map(p => (
                              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: '#EEF1F8', color: BRAND.primary }}>
                                {personaLabel(p)}
                              </span>
                            ))
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="px-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c)} className="px-2 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Concern Area' : 'Add Concern Area'}</DialogTitle>
            <DialogDescription>
              Define the concern, how it is described, its impact, and which personas should see it in their search.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cat">Category *</Label>
                <Input
                  id="cat" list="cat-options"
                  value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Focus, Academics"
                  required
                />
                <datalist id="cat-options">
                  {allCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <Label htmlFor="atype">Assessment Type</Label>
                <Input id="atype" value={form.assessment_type}
                  onChange={(e) => setForm(f => ({ ...f, assessment_type: e.target.value }))}
                  placeholder="lbi or capadex" />
              </div>
            </div>

            <div>
              <Label htmlFor="ca">Concern Area *</Label>
              <Input id="ca" value={form.concern_area}
                onChange={(e) => setForm(f => ({ ...f, concern_area: e.target.value }))}
                placeholder="Short concern label" maxLength={255} required />
            </div>

            <div>
              <Label htmlFor="pw">Parent / User Worry *</Label>
              <Textarea id="pw" rows={2} value={form.parent_worry}
                onChange={(e) => setForm(f => ({ ...f, parent_worry: e.target.value }))}
                placeholder="How the user describes this concern" maxLength={500} required />
            </div>

            <div>
              <Label htmlFor="ic">Impact *</Label>
              <Textarea id="ic" rows={2} value={form.impact_on_child}
                onChange={(e) => setForm(f => ({ ...f, impact_on_child: e.target.value }))}
                placeholder="What the impact looks like" maxLength={500} required />
            </div>

            <div>
              <Label htmlFor="kw">Search Keywords</Label>
              <Textarea id="kw" rows={2} value={form.search_keywords}
                onChange={(e) => setForm(f => ({ ...f, search_keywords: e.target.value }))}
                placeholder="Comma separated keywords" />
            </div>

            {/* Persona Targeting */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold" style={{ color: BRAND.primary }}>
                  Target Personas
                </Label>
                <span className="text-[11px] text-gray-500">
                  {form.target_personas.length === 0 ? 'Visible to all' : `${form.target_personas.length} selected`}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Select which personas see this concern in their search. Leave empty to show to everyone.
              </p>
              <ChipPicker
                options={ALL_PERSONAS.map(p => p.key)}
                selected={form.target_personas}
                onToggle={(v) => toggleArr('target_personas', v)}
                getLabel={personaLabel}
              />
              {form.target_personas.length > 0 && (
                <button
                  type="button"
                  className="text-[11px] text-gray-400 hover:text-gray-600 underline"
                  onClick={() => setForm(f => ({ ...f, target_personas: [] }))}
                >
                  Clear — show to all personas
                </button>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Mapped Services</Label>
              <ChipPicker options={SERVICES} selected={form.services}
                onToggle={(v) => toggleArr('services', v)} />
            </div>

            <div>
              <Label className="mb-2 block">Mapped Roles</Label>
              <ChipPicker options={ROLES} selected={form.roles}
                onToggle={(v) => toggleArr('roles', v)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="so">Sort Order</Label>
                <Input id="so" type="number" value={form.sort_order}
                  onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-end gap-2">
                <Switch id="active" checked={form.is_active}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="text-white"
                style={{ backgroundColor: BRAND.primary }}
                disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : (editId ? 'Save Changes' : 'Add Concern')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this concern?</DialogTitle>
            <DialogDescription>
              {confirmDelete && (
                <><span className="font-semibold text-gray-900">{confirmDelete.concern_area}</span> will be permanently removed. This cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
