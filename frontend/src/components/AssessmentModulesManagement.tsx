import { BRAND } from '@/design-system/tokens';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Search, RefreshCw, Download, Layers, Target, Sparkles, Zap,
  Package, CheckCircle, FileText, Clock, Users, Edit2, Trash2,
  ToggleLeft, ToggleRight, AlertTriangle, X, Save, Eye,
  Grid3X3, List, Tag, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import FrameworkPanel from '@/components/admin/FrameworkPanel';
import { LBI_CONFIG, COMPETENCY_CONFIG, SDI_CONFIG } from '@/components/admin/framework-configs';

const safeGet = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });



const FRAMEWORK_META: Record<string, { label: string; color: string; bg: string; icon: any; description: string }> = {
  lbi:        { label: 'LBI Behavioural',  color: '#3b82f6', bg: '#eff6ff', icon: Brain,    description: 'Stress · Adjustment · Discipline · Communication' },
  competency: { label: 'Competency',       color: '#6366f1', bg: '#eef2ff', icon: Target,   description: 'Cognitive · Leadership · Execution · Communication' },
  sdi:        { label: 'CAPADEX', color: '#7c3aed', bg: '#f5f3ff', icon: Sparkles, description: 'Students · Parents · Employers · Employees · Job Market Intelligence' },
  custom:     { label: 'Custom',           color: '#10b981', bg: '#ecfdf5', icon: Zap,       description: 'Custom-built assessment module' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: '#f3f4f6' },
  published: { label: 'Published', color: '#0284c7', bg: '#e0f2fe' },
  active:    { label: 'Active',    color: '#059669', bg: '#d1fae5' },
  archived:  { label: 'Archived',  color: '#dc2626', bg: '#fee2e2' },
};

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy:   { label: 'Easy',   color: '#059669' },
  medium: { label: 'Medium', color: '#d97706' },
  hard:   { label: 'Hard',   color: '#dc2626' },
};

interface Module {
  id: number;
  module_code: string;
  module_name: string;
  description?: string;
  framework: string;
  icon_key?: string;
  color?: string;
  category?: string;
  subcategory?: string;
  total_questions: number;
  package_ids?: string[] | string;
  status: string;
  is_active: boolean;
  display_order: number;
  domain_codes?: string[] | string;
  subdomain_codes?: string[] | string;
  age_band_codes?: string[] | string;
  min_age?: number;
  max_age?: number;
  duration_minutes?: number;
  difficulty?: string;
  tags?: string[] | string;
  created_at?: string;
  updated_at?: string;
}

const parseJSON = (val: any): any[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
};

const defaultForm = {
  module_name: '', module_code: '', description: '', framework: 'lbi',
  category: '', subcategory: '', total_questions: 0, status: 'draft',
  is_active: true, display_order: 0, domain_codes: [] as string[],
  subdomain_codes: [] as string[], age_band_codes: [] as string[],
  min_age: '', max_age: '', duration_minutes: 30, difficulty: 'medium',
  tags: '',
};

interface Props {
  onNavigate?: (screen: string) => void;
  modulesOnly?: boolean;
}

export default function AssessmentModulesManagement({ onNavigate, modulesOnly }: Props) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'modules' | 'frameworks'>('modules');
  const [frameworkTab, setFrameworkTab] = useState<'lbi' | 'competency' | 'sdi'>('lbi');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Module | null>(null);
  const [detailModule, setDetailModule] = useState<Module | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [formStep, setFormStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: modules = [], isLoading, refetch } = useQuery<Module[]>({
    queryKey: ['/api/lbi/admin/custom-modules'],
    queryFn: () => safeGet('/api/lbi/admin/custom-modules'),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 30000 : false,
  });

  const { data: lbiStats } = useQuery<any>({
    queryKey: ['/api/lbi/admin/stats'],
    queryFn: () => safeGet('/api/lbi/admin/stats'),
    enabled: isAuthenticated,
  });

  const { data: lbiDomains = [] } = useQuery<any[]>({
    queryKey: ['/api/lbi/admin/modules'],
    queryFn: () => safeGet('/api/lbi/admin/modules'),
    enabled: isAuthenticated,
  });

  const categories = Array.from(new Set(modules.map(m => m.category).filter(Boolean))) as string[];

  const filtered = modules.filter(m => {
    const s = search.toLowerCase();
    const matchSearch = !s || m.module_name.toLowerCase().includes(s) || (m.module_code || '').toLowerCase().includes(s) || (m.category || '').toLowerCase().includes(s);
    const matchFw = filterFramework === 'all' || m.framework === filterFramework;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    const matchCat = filterCategory === 'all' || m.category === filterCategory;
    return matchSearch && matchFw && matchStatus && matchCat;
  });

  const stats = {
    total: modules.length,
    active: modules.filter(m => m.is_active && m.status === 'active').length,
    published: modules.filter(m => m.status === 'published').length,
    draft: modules.filter(m => m.status === 'draft').length,
    totalQuestions: modules.reduce((s, m) => s + (m.total_questions || 0), 0),
  };

  const openCreate = () => {
    setForm({ ...defaultForm });
    setFormStep(0);
    setShowCreate(true);
    setEditModule(null);
  };

  const openEdit = (m: Module) => {
    setForm({
      module_name: m.module_name, module_code: m.module_code, description: m.description || '',
      framework: m.framework, category: m.category || '', subcategory: m.subcategory || '',
      total_questions: m.total_questions, status: m.status, is_active: m.is_active,
      display_order: m.display_order, domain_codes: parseJSON(m.domain_codes),
      subdomain_codes: parseJSON(m.subdomain_codes), age_band_codes: parseJSON(m.age_band_codes),
      min_age: m.min_age ? String(m.min_age) : '', max_age: m.max_age ? String(m.max_age) : '',
      duration_minutes: m.duration_minutes || 30, difficulty: m.difficulty || 'medium',
      tags: parseJSON(m.tags).join(', '),
    });
    setFormStep(0);
    setEditModule(m);
    setShowCreate(true);
  };

  const closeForm = () => { setShowCreate(false); setEditModule(null); setForm({ ...defaultForm }); };

  const handleSave = async () => {
    if (!form.module_name.trim()) { toast({ title: 'Error', description: 'Module name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        min_age: form.min_age ? parseInt(form.min_age as string) : null,
        max_age: form.max_age ? parseInt(form.max_age as string) : null,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        total_questions: Number(form.total_questions) || 0,
        duration_minutes: Number(form.duration_minutes) || 30,
        display_order: Number(form.display_order) || 0,
      };
      const url = editModule ? `/api/lbi/admin/custom-modules/${editModule.id}` : '/api/lbi/admin/custom-modules';
      const method = editModule ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Save failed'); }
      await refetch();
      toast({ title: editModule ? 'Module updated' : 'Module created', description: form.module_name });
      closeForm();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (m: Module) => {
    try {
      const res = await fetch(`/api/lbi/admin/custom-modules/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ is_active: !m.is_active }),
      });
      if (!res.ok) throw new Error('Failed');
      await refetch();
      toast({ title: !m.is_active ? 'Module enabled' : 'Module disabled', description: m.module_name });
    } catch { toast({ title: 'Update failed', variant: 'destructive' }); }
  };

  const handleStatusChange = async (m: Module, status: string) => {
    try {
      const res = await fetch(`/api/lbi/admin/custom-modules/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      await refetch();
      toast({ title: `Moved to ${status}`, description: m.module_name });
    } catch { toast({ title: 'Status update failed', variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/lbi/admin/custom-modules/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      await refetch();
      toast({ title: 'Module deleted', description: deleteTarget.module_name });
      setDeleteTarget(null);
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  };

  const handleExport = () => {
    const rows = modules.map(m => ({
      code: m.module_code, name: m.module_name, framework: m.framework,
      category: m.category, status: m.status, questions: m.total_questions,
      duration: m.duration_minutes, difficulty: m.difficulty,
    }));
    const csv = [Object.keys(rows[0] || {}).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'assessment-modules.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const fwMeta = (fw: string) => FRAMEWORK_META[fw] || FRAMEWORK_META.custom;
  const stMeta = (st: string) => STATUS_META[st] || STATUS_META.draft;

  return (
    <div className="space-y-0">

      {/* ── Top Tab Bar — hidden when modulesOnly (frameworks are direct sidebar items) ── */}
      {!modulesOnly && (
        <div className="flex items-center justify-between border-b bg-white -mx-1 px-1 mb-5">
          <div className="flex gap-0">
            {([
              { id: 'modules' as const,    label: 'Modules',    icon: Package },
              { id: 'frameworks' as const, label: 'Frameworks', icon: Layers  },
            ]).map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all"
                  style={{
                    borderBottomColor: active ? BRAND.primary : 'transparent',
                    color: active ? BRAND.primary : '#6b7280',
                  }}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {tab.id === 'modules' && modules.length > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${BRAND.primary}18`, color: BRAND.primary }}
                    >
                      {modules.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Context actions — only on Modules tab */}
          {activeTab === 'modules' && (
            <div className="flex gap-2 pb-1">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={modules.length === 0}>
                <Download className="h-4 w-4 mr-1.5" /> Export
              </Button>
              <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> New Module
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Action bar when modulesOnly (no Frameworks tab) ── */}
      {modulesOnly && (
        <div className="flex items-center justify-between border-b bg-white -mx-1 px-1 mb-5 pb-1">
          <div className="flex items-center gap-2 px-2 py-3">
            <Package className="h-4 w-4" style={{ color: BRAND.primary }} />
            <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>Custom Modules</span>
            {modules.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}18`, color: BRAND.primary }}>
                {modules.length}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={modules.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> Export
            </Button>
            <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" /> New Module
            </Button>
          </div>
        </div>
      )}

      {/* ── Stats Row (Modules tab only) ── */}
      {activeTab === 'modules' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Modules',   value: stats.total,          icon: Package,      color: BRAND.primary },
            { label: 'Active',          value: stats.active,          icon: CheckCircle,  color: '#059669' },
            { label: 'Published',       value: stats.published,       icon: Eye,          color: '#0284c7' },
            { label: 'Draft',           value: stats.draft,           icon: FileText,     color: '#d97706' },
            { label: 'Total Questions', value: stats.totalQuestions,  icon: Brain,        color: BRAND.accent },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.color}18` }}>
                  <s.icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 leading-none">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══════════════ MODULES TAB ══════════════ */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 items-center p-3 bg-gray-50 rounded-xl border">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm bg-white" placeholder="Search modules..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border rounded-lg px-3 py-1.5 text-sm bg-white" value={filterFramework} onChange={e => setFilterFramework(e.target.value)}>
              <option value="all">All Frameworks</option>
              {Object.entries(FRAMEWORK_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-1.5 text-sm bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {categories.length > 0 && (
              <select className="border rounded-lg px-3 py-1.5 text-sm bg-white" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {(search || filterFramework !== 'all' || filterStatus !== 'all' || filterCategory !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterFramework('all'); setFilterStatus('all'); setFilterCategory('all'); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">{filtered.length}/{modules.length}</span>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><Grid3X3 className="h-3.5 w-3.5" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}><List className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-52 rounded-xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-12 w-12 text-gray-300 mb-3" />
                <h4 className="font-semibold text-gray-700 mb-1">{modules.length === 0 ? 'No modules yet' : 'No modules match your filters'}</h4>
                <p className="text-sm text-gray-500 mb-4">{modules.length === 0 ? 'Create your first assessment module to get started.' : 'Try clearing your filters.'}</p>
                {modules.length === 0 && (
                  <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1.5" /> Create First Module
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(m => {
                const fw = fwMeta(m.framework);
                const st = stMeta(m.status);
                const FwIcon = fw.icon;
                const tags = parseJSON(m.tags);
                const ageBands = parseJSON(m.age_band_codes);
                return (
                  <Card key={m.id} className={`relative overflow-hidden transition-all hover:shadow-md border-l-4 ${!m.is_active ? 'opacity-60' : ''}`}
                    style={{ borderLeftColor: fw.color }}>
                    <CardContent className="p-4 space-y-3">
                      {/* Top Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: fw.bg }}>
                            <FwIcon className="h-4.5 w-4.5" style={{ color: fw.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{m.module_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{m.module_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Edit2 className="h-3.5 w-3.5 text-gray-500" /></button>
                          <button onClick={() => setDetailModule(m)} className="p-1.5 rounded hover:bg-gray-100" title="View details"><Eye className="h-3.5 w-3.5 text-gray-500" /></button>
                          <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded hover:bg-red-50" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: fw.bg, color: fw.color }}>{fw.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                        {m.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{m.category}</span>}
                        {m.difficulty && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${DIFFICULTY_META[m.difficulty]?.color}18`, color: DIFFICULTY_META[m.difficulty]?.color }}>{DIFFICULTY_META[m.difficulty]?.label}</span>}
                      </div>

                      {/* Description */}
                      {m.description && <p className="text-xs text-gray-500 line-clamp-2">{m.description}</p>}

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center py-2 border-y">
                        <div>
                          <p className="text-base font-bold text-gray-900">{m.total_questions || 0}</p>
                          <p className="text-[10px] text-gray-400">Questions</p>
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900">{m.duration_minutes || '–'}</p>
                          <p className="text-[10px] text-gray-400">Minutes</p>
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900">{ageBands.length || '–'}</p>
                          <p className="text-[10px] text-gray-400">Age Bands</p>
                        </div>
                      </div>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-0.5">
                              <Tag className="h-2.5 w-2.5" /> {t}
                            </span>
                          ))}
                          {tags.length > 3 && <span className="text-[10px] text-gray-400">+{tags.length - 3}</span>}
                        </div>
                      )}

                      {/* Actions Row */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleToggle(m)}
                          className="flex items-center gap-1 text-xs font-medium transition-colors"
                          style={{ color: m.is_active ? '#059669' : '#6b7280' }}
                        >
                          {m.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          {m.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <div className="ml-auto flex gap-1">
                          {m.status === 'draft' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleStatusChange(m, 'published')}>
                              Publish
                            </Button>
                          )}
                          {m.status === 'published' && (
                            <Button size="sm" className="h-6 text-[10px] px-2 text-white" style={{ backgroundColor: '#059669' }} onClick={() => handleStatusChange(m, 'active')}>
                              Activate
                            </Button>
                          )}
                          {m.status === 'active' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-red-500 border-red-200" onClick={() => handleStatusChange(m, 'archived')}>
                              Archive
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b">
                    <th className="text-left px-4 py-3">Module</th>
                    <th className="text-left px-4 py-3">Framework</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-center px-4 py-3">Questions</th>
                    <th className="text-center px-4 py-3">Duration</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Active</th>
                    <th className="text-center px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => {
                    const fw = fwMeta(m.framework);
                    const st = stMeta(m.status);
                    const FwIcon = fw.icon;
                    return (
                      <tr key={m.id} className={`border-b hover:bg-gray-50 transition-colors ${!m.is_active ? 'opacity-60' : ''} ${idx === filtered.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: fw.bg }}>
                              <FwIcon className="h-3.5 w-3.5" style={{ color: fw.color }} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{m.module_name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{m.module_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: fw.bg, color: fw.color }}>{fw.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{m.category || '–'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">{m.total_questions || 0}</td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">{m.duration_minutes ? `${m.duration_minutes}m` : '–'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleToggle(m)}>
                            {m.is_active ? <ToggleRight className="h-5 w-5 text-green-500 mx-auto" /> : <ToggleLeft className="h-5 w-5 text-gray-400 mx-auto" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(m)} className="p-1 rounded hover:bg-gray-200" title="Edit"><Edit2 className="h-3.5 w-3.5 text-gray-500" /></button>
                            <button onClick={() => setDetailModule(m)} className="p-1 rounded hover:bg-gray-200" title="Details"><Eye className="h-3.5 w-3.5 text-gray-500" /></button>
                            <button onClick={() => setDeleteTarget(m)} className="p-1 rounded hover:bg-red-100" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ FRAMEWORKS TAB ══════════════ */}
      {activeTab === 'frameworks' && (
        <div className="space-y-0">
          {/* Framework sub-tab bar */}
          <div className="flex border-b bg-white rounded-t-xl overflow-hidden">
            {([
              {
                id: 'lbi' as const,
                label: 'LBI Behavioural Framework',
                sub: '19 domains · 97 subdomains · Ages 6–22+',
                icon: Brain,
                activeColor: '#344E86',
                activeBg: '#344E8608',
                iconColor: '#344E86',
              },
              {
                id: 'competency' as const,
                label: 'Professional Competency',
                sub: '10 domains · 101 competencies · 7 roles',
                icon: Target,
                activeColor: '#4ECDC4',
                activeBg: '#4ECDC408',
                iconColor: '#0d9488',
              },
              {
                id: 'sdi' as const,
                label: 'Student Dev Index',
                sub: '18 domains · 54 subdomains · K-12',
                icon: Sparkles,
                activeColor: '#f59e0b',
                activeBg: '#f59e0b08',
                iconColor: '#d97706',
              },
            ] as const).map((fw) => {
              const Icon = fw.icon;
              const isActive = frameworkTab === fw.id;
              return (
                <button
                  key={fw.id}
                  onClick={() => setFrameworkTab(fw.id)}
                  className="flex-1 flex items-center gap-3 px-5 py-3.5 text-left border-b-2 transition-all group"
                  style={{
                    borderBottomColor: isActive ? fw.activeColor : 'transparent',
                    backgroundColor: isActive ? fw.activeBg : 'transparent',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{ backgroundColor: isActive ? `${fw.activeColor}18` : '#f3f4f6' }}
                  >
                    <Icon className="h-4 w-4 transition-colors" style={{ color: isActive ? fw.activeColor : '#9ca3af' }} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate transition-colors"
                      style={{ color: isActive ? fw.activeColor : '#374151' }}
                    >
                      {fw.label}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{fw.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Unified framework panel — same layout for all 3 */}
          <div className="border border-t-0 rounded-b-xl bg-white overflow-hidden p-4">
            {frameworkTab === 'lbi'        && <FrameworkPanel config={LBI_CONFIG}        />}
            {frameworkTab === 'competency' && <FrameworkPanel config={COMPETENCY_CONFIG} />}
            {frameworkTab === 'sdi'        && <FrameworkPanel config={SDI_CONFIG}        />}
          </div>
        </div>
      )}


      {/* ══════════════ CREATE / EDIT MODAL ══════════════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{editModule ? 'Edit Module' : 'Create Assessment Module'}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editModule ? `Editing: ${editModule.module_code}` : 'Fill in the details below'}</p>
              </div>
              <button onClick={closeForm} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            {/* Steps */}
            <div className="flex border-b px-6 gap-1">
              {['Basic Info', 'Configuration', 'Domains & Bands'].map((step, i) => (
                <button key={i} onClick={() => setFormStep(i)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${formStep === i ? '' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  style={formStep === i ? { borderBottomColor: BRAND.primary, color: BRAND.primary } : {}}>
                  {i + 1}. {step}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* Step 0: Basic Info */}
              {formStep === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Module Name *</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Behavioral Assessment Lite" value={form.module_name} onChange={e => setForm(f => ({ ...f, module_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Module Code</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="e.g. BA_LITE_01" value={form.module_code} onChange={e => setForm(f => ({ ...f, module_code: e.target.value.toUpperCase() }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
                    <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={3} placeholder="Describe what this assessment module measures..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Framework</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.framework} onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}>
                        {Object.entries(FRAMEWORK_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. School, Corporate, Clinical" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Subcategory</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. K–6, Enterprise" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Tags (comma-separated)</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. behavioral, school, tier-1" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Step 1: Configuration */}
              {formStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Total Questions</label>
                      <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.total_questions} onChange={e => setForm(f => ({ ...f, total_questions: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Duration (minutes)</label>
                      <input type="number" min={1} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Difficulty</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Min Age</label>
                      <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. 6" value={form.min_age} onChange={e => setForm(f => ({ ...f, min_age: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Max Age</label>
                      <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. 22" value={form.max_age} onChange={e => setForm(f => ({ ...f, max_age: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Display Order</label>
                    <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))} />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} className="focus:outline-none">
                      {form.is_active ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                    </button>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Module {form.is_active ? 'Enabled' : 'Disabled'}</p>
                      <p className="text-xs text-gray-400">Disabled modules are hidden from users</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Domains & Bands */}
              {formStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Domain Codes</label>
                    <div className="flex flex-wrap gap-1.5 p-3 border rounded-lg bg-gray-50 min-h-[56px]">
                      {form.domain_codes.map((code: string) => (
                        <span key={code} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-mono" style={{ backgroundColor: BRAND.primary + '18', color: BRAND.primary }}>
                          {code}
                          <button onClick={() => setForm(f => ({ ...f, domain_codes: f.domain_codes.filter((c: string) => c !== code) }))} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <select className="flex-1 border rounded-lg px-3 py-2 text-sm" defaultValue="" onChange={e => {
                        const val = e.target.value;
                        if (val && !form.domain_codes.includes(val)) setForm(f => ({ ...f, domain_codes: [...f.domain_codes, val] }));
                        e.target.value = '';
                      }}>
                        <option value="">+ Add from LBI domains</option>
                        {lbiDomains.map((d: any) => <option key={d.moduleCode} value={d.moduleCode}>{d.moduleCode} — {d.moduleName}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Or type custom code:</p>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono mt-1" placeholder="e.g. STR, ADJ, DIS" onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                        if (val && !form.domain_codes.includes(val)) setForm(f => ({ ...f, domain_codes: [...f.domain_codes, val] }));
                        (e.target as HTMLInputElement).value = '';
                      }
                    }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Age Band Codes</label>
                    <div className="flex flex-wrap gap-1.5 p-3 border rounded-lg bg-gray-50 min-h-[48px]">
                      {form.age_band_codes.map((code: string) => (
                        <span key={code} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-mono">
                          {code}
                          <button onClick={() => setForm(f => ({ ...f, age_band_codes: f.age_band_codes.filter((c: string) => c !== code) }))}>
                            <X className="h-3 w-3 hover:text-red-500" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['B1','B2','B3','B4','B5','B6'].map(b => (
                        <button key={b} onClick={() => { if (!form.age_band_codes.includes(b)) setForm(f => ({ ...f, age_band_codes: [...f.age_band_codes, b] })); }}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${form.age_band_codes.includes(b) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:border-blue-300 text-gray-600'}`}>
                          Band {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 sticky bottom-0">
              <div className="flex gap-2">
                {formStep > 0 && <Button variant="outline" size="sm" onClick={() => setFormStep(s => s - 1)}>← Back</Button>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
                {formStep < 2 ? (
                  <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white" onClick={() => setFormStep(s => s + 1)}>Next →</Button>
                ) : (
                  <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white" onClick={handleSave} disabled={saving}>
                    {saving ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5 mr-1.5" /> {editModule ? 'Update Module' : 'Create Module'}</>}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ DETAIL DRAWER ══════════════ */}
      {detailModule && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setDetailModule(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-900">Module Details</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDetailModule(null); openEdit(detailModule); }}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <button onClick={() => setDetailModule(null)} className="p-1.5 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Identity */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: fwMeta(detailModule.framework).bg }}>
                  {(() => { const FwIcon = fwMeta(detailModule.framework).icon; return <FwIcon className="h-6 w-6" style={{ color: fwMeta(detailModule.framework).color }} />; })()}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{detailModule.module_name}</h4>
                  <p className="text-xs font-mono text-gray-400">{detailModule.module_code}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: fwMeta(detailModule.framework).bg, color: fwMeta(detailModule.framework).color }}>{fwMeta(detailModule.framework).label}</span>
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: stMeta(detailModule.status).bg, color: stMeta(detailModule.status).color }}>{stMeta(detailModule.status).label}</span>
                {detailModule.category && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{detailModule.category}</span>}
                {detailModule.difficulty && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${DIFFICULTY_META[detailModule.difficulty]?.color}18`, color: DIFFICULTY_META[detailModule.difficulty]?.color }}>{DIFFICULTY_META[detailModule.difficulty]?.label}</span>}
              </div>

              {/* Description */}
              {detailModule.description && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-600">{detailModule.description}</p>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Questions', value: detailModule.total_questions || 0, icon: Brain },
                  { label: 'Duration', value: detailModule.duration_minutes ? `${detailModule.duration_minutes}m` : '–', icon: Clock },
                  { label: 'Age Range', value: (detailModule.min_age && detailModule.max_age) ? `${detailModule.min_age}–${detailModule.max_age}` : '–', icon: Users },
                  { label: 'Display Order', value: detailModule.display_order ?? 0, icon: List },
                ].map(m => (
                  <div key={m.label} className="p-3 rounded-lg bg-gray-50 flex items-center gap-2">
                    <m.icon className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{m.value}</p>
                      <p className="text-[10px] text-gray-400">{m.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Domain Codes */}
              {parseJSON(detailModule.domain_codes).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Domains Covered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseJSON(detailModule.domain_codes).map((c: string) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ backgroundColor: BRAND.primary + '15', color: BRAND.primary }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Age Bands */}
              {parseJSON(detailModule.age_band_codes).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Age Bands</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseJSON(detailModule.age_band_codes).map((b: string) => (
                      <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono">Band {b}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {parseJSON(detailModule.tags).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseJSON(detailModule.tags).map((t: string) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
                        <Tag className="h-2.5 w-2.5" />{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              {detailModule.created_at && (
                <div className="pt-3 border-t space-y-1">
                  <p className="text-[10px] text-gray-400">Created: {new Date(detailModule.created_at).toLocaleString()}</p>
                  {detailModule.updated_at && <p className="text-[10px] text-gray-400">Updated: {new Date(detailModule.updated_at).toLocaleString()}</p>}
                </div>
              )}

              {/* Status Actions */}
              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-gray-500">Change Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(STATUS_META).filter(s => s !== detailModule.status).map(s => (
                    <Button key={s} size="sm" variant="outline" className="text-xs h-7"
                      style={{ borderColor: STATUS_META[s].color, color: STATUS_META[s].color }}
                      onClick={() => { handleStatusChange(detailModule, s); setDetailModule({ ...detailModule, status: s }); }}>
                      → {STATUS_META[s].label}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleToggle(detailModule)}>
                  {detailModule.is_active ? <><ToggleLeft className="h-3.5 w-3.5 mr-1.5" /> Disable Module</> : <><ToggleRight className="h-3.5 w-3.5 mr-1.5" /> Enable Module</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ DELETE CONFIRM ══════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Module?</h3>
                <p className="text-xs text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              You're about to permanently delete <strong>{deleteTarget.module_name}</strong> ({deleteTarget.module_code}). All configuration data will be removed.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
