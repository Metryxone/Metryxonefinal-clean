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

export default function ShortAssessmentsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient() ?? defaultClient;

  const [selectedConcernId, setSelectedConcernId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [bandFilter, setBandFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyQ });
  const [confirmDelete, setConfirmDelete] = useState<Question | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadStage, setUploadStage] = useState<Stage>('Curiosity');
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [bandsOpen, setBandsOpen] = useState(false);
  const [bandsDraft, setBandsDraft] = useState<AgeBand[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const bandsQ = useQuery<{ bands: AgeBand[] }>({
    queryKey: ['/api/short-assessments/age-bands'],
    queryFn: async () => {
      const r = await fetch('/api/short-assessments/age-bands', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load bands');
      return r.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const bands = bandsQ.data?.bands ?? [];
  const activeBands = bands.filter(b => b.is_active);

  const saveBandsMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('PUT', '/api/short-assessments/admin/age-bands', { bands: bandsDraft });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: 'Age bands saved' });
      setBandsOpen(false);
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/age-bands'] });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  const openBands = async () => {
    let latest: AgeBand[] = bands;
    try {
      const r = await fetch('/api/short-assessments/age-bands', { credentials: 'include', cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        latest = Array.isArray(data?.bands) ? data.bands : bands;
        qc.setQueryData(['/api/short-assessments/age-bands'], data);
      }
    } catch {/* fall back to cached */}
    // If the backend has no bands yet, seed the canonical 6 codes for first use
    const draft: AgeBand[] = (latest.length > 0 ? latest : ['A','B','C','D','E','E1'].map((c,i) => ({
      code: c, ages: '', is_active: false, sort_order: i+1, description: '', question_count: 0,
    })))
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((b, i) => {
        const { from, to } = parseAges(b.ages);
        return { ...b, sort_order: i + 1, _from: from, _to: to, description: b.description ?? '' };
      });
    setBandsDraft(draft);
    setBandsOpen(true);
  };

  const addBandRow = () => {
    setBandsDraft(d => {
      // Suggest the next free letter (A..Z) or "Bn" code
      const used = new Set(d.map(x => x.code));
      let suggested = '';
      for (let c = 65; c <= 90; c++) {
        const letter = String.fromCharCode(c);
        if (!used.has(letter)) { suggested = letter; break; }
      }
      if (!suggested) suggested = `B${d.length + 1}`;
      return [...d, { code: suggested, ages: '', is_active: false, sort_order: d.length + 1, description: '', question_count: 0, _from: '', _to: '' }];
    });
  };
  const updateBand = (i: number, patch: Partial<AgeBand>) => {
    setBandsDraft(d => d.map((x, idx) => {
      if (idx !== i) return x;
      const merged = { ...x, ...patch };
      // Keep ages in sync with _from/_to whenever they change
      if ('_from' in patch || '_to' in patch) {
        merged.ages = formatAges(merged._from ?? '', merged._to ?? '');
      }
      return merged;
    }));
  };
  const removeBandRow = (i: number) => {
    setBandsDraft(d => d.filter((_, idx) => idx !== i).map((x, j) => ({ ...x, sort_order: j + 1 })));
  };

  const summaryQ = useQuery<{ summary: SummaryRow[] }>({
    queryKey: ['/api/short-assessments/summary'],
    queryFn: async () => {
      const r = await fetch('/api/short-assessments/summary', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load');
      return r.json();
    },
    staleTime: 15000,
  });

  const summary = summaryQ.data?.summary ?? [];

  // Default to the first concern that has questions
  useEffect(() => {
    if (selectedConcernId == null && summary.length > 0) {
      const firstWith = summary.find(s => s.stages.some(x => x.count > 0)) ?? summary[0];
      setSelectedConcernId(firstWith.concern_area_id);
    }
  }, [summary, selectedConcernId]);

  const questionsQ = useQuery<{ questions: Question[] }>({
    queryKey: ['/api/short-assessments/admin/list', selectedConcernId, stageFilter],
    enabled: selectedConcernId != null,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedConcernId != null) params.set('concern_area_id', String(selectedConcernId));
      if (stageFilter !== 'all') params.set('stage', stageFilter);
      const r = await fetch(`/api/short-assessments/admin/list?${params}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load');
      return r.json();
    },
  });

  const questions = questionsQ.data?.questions ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = questions;
    if (bandFilter !== 'all') {
      list = list.filter(x => (x.age_band ?? '') === bandFilter);
    }
    if (!q) return list;
    return list.filter(x =>
      x.question_text.toLowerCase().includes(q) ||
      x.question_code.toLowerCase().includes(q) ||
      (x.dimension ?? '').toLowerCase().includes(q) ||
      (x.focus_area ?? '').toLowerCase().includes(q)
    );
  }, [questions, search, bandFilter]);

  const totals = useMemo(() => {
    const t: Record<string, number> = { Curiosity: 0, Insight: 0, Growth: 0, Mastery: 0, all: 0 };
    for (const s of summary) for (const st of s.stages) {
      t[st.stage] = (t[st.stage] ?? 0) + st.count;
      t.all += st.count;
    }
    return t;
  }, [summary]);

  const selectedConcern = summary.find(s => s.concern_area_id === selectedConcernId) || null;

  // ── Multi-selection helpers ──────────────────────────────────────────
  const allFilteredIds = filtered.map(q => q.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  const toggleRow = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => new Set([...prev, ...allFilteredIds]));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedQuestions = filtered.filter(q => selectedIds.has(q.id));

  // ── Export helpers ───────────────────────────────────────────────────
  const exportRows = (qs: Question[], format: 'tsv' | 'csv') => {
    const sep = format === 'tsv' ? '\t' : ',';
    const esc = (v: string) => format === 'csv' ? `"${String(v ?? '').replace(/"/g, '""')}"` : String(v ?? '');
    const headers = ['code', 'concern_area_id', 'stage', 'age_band', 'focus_area', 'dimension',
                     'question_text', 'response_options', 'polarity', 'weight', 'logic',
                     'is_anchor', 'sort_order'];
    const rows = qs.map(q => [
      q.question_code, q.concern_area_id, q.stage, q.age_band ?? '',
      q.focus_area ?? '', q.dimension ?? '', q.question_text,
      q.response_options ?? '', q.polarity ?? '', q.weight ?? '1',
      q.logic ?? '', q.is_anchor ? '1' : '0', q.sort_order ?? '',
    ].map(v => esc(String(v))).join(sep));
    const content = [headers.join(sep), ...rows].join('\n');
    const blob = new Blob([content], { type: format === 'tsv' ? 'text/tab-separated-values' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions_export_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Bulk delete mutation ─────────────────────────────────────────────
  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.all(ids.map(id =>
        fetch(`/api/short-assessments/${id}`, { method: 'DELETE', credentials: 'include' })
      ));
      if (results.some(r => !r.ok)) throw new Error('Some deletes failed');
    },
    onSuccess: () => {
      clearSelection();
      setBulkDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['/api/short-assessments/admin/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/short-assessments/summary'] });
      toast({ title: `${selectedIds.size} question${selectedIds.size !== 1 ? 's' : ''} deleted` });
    },
    onError: () => toast({ title: 'Bulk delete failed', variant: 'destructive' }),
  });

  const openCreate = () => {
    if (selectedConcernId == null) {
      toast({ title: 'Select a concern first', variant: 'destructive' });
      return;
    }
    setEditId(null);
    setForm({
      ...emptyQ,
      options: DEFAULT_OPTIONS.slice(),
      concern_area_id: selectedConcernId,
      stage: stageFilter === 'all' ? 'Curiosity' : stageFilter,
      sort_order: questions.length + 1,
      question_code: `Q-${Date.now().toString().slice(-6)}`,
    });
    setDialogOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditId(q.id);
    // options comes from the DB as either a parsed array or a raw JSON string — handle both
    const resolveOpts = (): OptionRow[] => {
      let raw: any = q.options;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = null; }
      }
      if (Array.isArray(raw) && raw.length > 0) return raw as OptionRow[];
      return deriveDefaults(q.response_options, q.logic, q.polarity);
    };
    const opts = resolveOpts();
    setForm({
      concern_area_id: q.concern_area_id,
      question_code: q.question_code,
      stage: q.stage,
      age_band: q.age_band ?? '',
      is_anchor: !!q.is_anchor,
      focus_area: q.focus_area ?? '',
      layer: q.layer ?? '',
      dimension: q.dimension ?? '',
      question_text: q.question_text,
      response_options: q.response_options ?? '',
      polarity: q.polarity ?? '',
      weight: q.weight ?? '1',
      logic: q.logic ?? '',
      options: opts,
      target_personas: Array.isArray(q.target_personas) ? q.target_personas : [],
      sort_order: q.sort_order ?? 0,
      is_active: !!q.is_active,
    });
    setDialogOpen(true);
  };

  const togglePersona = (key: string) => {
    setForm(f => ({
      ...f,
      target_personas: f.target_personas.includes(key)
        ? f.target_personas.filter(p => p !== key)
        : [...f.target_personas, key],
    }));
  };

  const setOption = (i: number, patch: Partial<OptionRow>) => {
    setForm(f => ({ ...f, options: f.options.map((o, idx) => idx === i ? { ...o, ...patch } : o) }));
  };
  const addOption = () => {
    setForm(f => {
      const nextKey = String.fromCharCode(65 + f.options.length); // F, G, ...
      return { ...f, options: [...f.options, { key: nextKey, text: '', score: f.options.length + 1 }] };
    });
  };
  const removeOption = (i: number) => {
    setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/short-assessments/admin/${editId}` : '/api/short-assessments/admin';
      const method = editId ? 'PATCH' : 'POST';
      const r = await apiRequest(method, url, form);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editId ? 'Question updated' : 'Question added' });
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/admin/list'] });
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/summary'] });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest('DELETE', `/api/short-assessments/admin/${id}`);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: 'Question deleted' });
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/admin/list'] });
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/summary'] });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' }),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest('POST', '/api/short-assessments/admin/upload', {
        concern_area_id: selectedConcernId,
        stage_default: uploadStage,
        mode: uploadMode,
        text: uploadText,
      });
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `Uploaded ${data?.inserted ?? 0} questions` });
      setUploadOpen(false);
      setUploadText('');
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/admin/list'] });
      qc.invalidateQueries({ queryKey: ['/api/short-assessments/summary'] });
    },
    onError: (e: any) => toast({ title: 'Upload failed', description: e?.message, variant: 'destructive' }),
  });

  const handleFile = async (file: File) => {
    const text = await file.text();
    setUploadText(text);
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Short Assessments</h2>
          <p className="text-gray-500 mt-1">
            Build short assessments tied to each concern area, organised across four progression stages.
            Curiosity is the free tier wired to the home page; Insight, Growth and Mastery unlock with paid plans.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openBands}>
            <Settings2 className="h-4 w-4 mr-1" />Age Bands
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={selectedConcernId == null}>
            <Upload className="h-4 w-4 mr-1" />Upload TSV/CSV
          </Button>

          {/* Export dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              disabled={selectedConcernId == null}
              onClick={() => setExportMenuOpen(v => !v)}
              onBlur={() => setTimeout(() => setExportMenuOpen(false), 150)}
            >
              <Download className="h-4 w-4 mr-1" />Export
              <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  onMouseDown={() => { exportRows(filtered, 'tsv'); setExportMenuOpen(false); }}
                >
                  Export all as TSV
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  onMouseDown={() => { exportRows(filtered, 'csv'); setExportMenuOpen(false); }}
                >
                  Export all as CSV
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      style={{ color: BRAND.primary }}
                      onMouseDown={() => { exportRows(selectedQuestions, 'tsv'); setExportMenuOpen(false); }}
                    >
                      Export {selectedIds.size} selected · TSV
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      style={{ color: BRAND.primary }}
                      onMouseDown={() => { exportRows(selectedQuestions, 'csv'); setExportMenuOpen(false); }}
                    >
                      Export {selectedIds.size} selected · CSV
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <Button onClick={openCreate} className="text-white" style={{ backgroundColor: BRAND.primary }}>
            <Plus className="h-4 w-4 mr-1" />New Question
          </Button>
        </div>
      </div>

      {/* Stage stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAGES.map(s => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: STAGE_META[s].color }}>
                    {STAGE_META[s].label}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{STAGE_META[s].sub}</div>
                </div>
                <Badge className="font-normal" style={{ backgroundColor: STAGE_META[s].bg, color: STAGE_META[s].color }}>
                  {totals[s] ?? 0}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Concern picker + filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center flex-wrap">
        <Select value={selectedConcernId ? String(selectedConcernId) : ''} onValueChange={(v) => setSelectedConcernId(Number(v))}>
          <SelectTrigger className="md:w-[420px]">
            <SelectValue placeholder="Select a concern area..." />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {summary.map(s => {
              const total = s.stages.reduce((a, x) => a + x.count, 0);
              return (
                <SelectItem key={s.concern_area_id} value={String(s.concern_area_id)}>
                  <span className="font-medium">{s.concern_area}</span>
                  <span className="text-gray-500 ml-2">— {s.category} · {total} Qs</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={bandFilter} onValueChange={setBandFilter}>
          <SelectTrigger className="md:w-44"><SelectValue placeholder="Age band" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All age bands</SelectItem>
            {activeBands.map(b => (
              <SelectItem key={b.code} value={b.ages || b.code}>
                {b.code}{b.ages ? ` · ${b.ages}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="md:max-w-sm" placeholder="Search question, code, dimension..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Active age bands reflection strip */}
      {activeBands.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <span className="text-xs text-gray-500">Active age bands:</span>
          {activeBands.map(b => (
            <span
              key={b.code}
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: '#E8FAF7', color: BRAND.teal }}
            >
              {b.code}{b.ages ? ` · ${b.ages}` : ''}
            </span>
          ))}
          <button
            type="button"
            onClick={openBands}
            className="text-[11px] underline text-gray-500 hover:text-gray-700 ml-1"
          >
            edit
          </button>
        </div>
      )}

      {/* Concern context strip */}
      {selectedConcern && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <Badge style={{ backgroundColor: '#E8EDFB', color: BRAND.primary }} className="font-normal">
              {selectedConcern.category}
            </Badge>
            <span className="font-semibold text-gray-900">{selectedConcern.concern_area}</span>
            <span className="text-gray-500 italic">"{selectedConcern.parent_worry}"</span>
            <span className="ml-auto flex gap-2">
              {STAGES.map(s => {
                const c = selectedConcern.stages.find(x => x.stage === s)?.count ?? 0;
                return (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: STAGE_META[s].bg, color: STAGE_META[s].color }}>
                    {s}: {c}
                  </span>
                );
              })}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Questions table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: BRAND.bg }}>
                <tr className="text-left text-gray-700">
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 cursor-pointer"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      title={allSelected ? 'Deselect all' : 'Select all'}
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold w-24">Code</th>
                  <th className="px-3 py-3 font-semibold w-36">Title</th>
                  <th className="px-3 py-3 font-semibold w-24">Stage</th>
                  <th className="px-3 py-3 font-semibold">Question</th>
                  <th className="px-3 py-3 font-semibold w-48">Personas</th>
                  <th className="px-3 py-3 font-semibold w-20">Age</th>
                  <th className="px-3 py-3 font-semibold w-16">Wt</th>
                  <th className="px-3 py-3 font-semibold w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedConcernId == null && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                    Select a concern area to view its questions.
                  </td></tr>
                )}
                {selectedConcernId != null && questionsQ.isLoading && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
                )}
                {selectedConcernId != null && !questionsQ.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                    No questions yet. Use "New Question" or upload a TSV/CSV.
                  </td></tr>
                )}
                {filtered.map((q) => (
                  <tr
                    key={q.id}
                    className={`border-t border-gray-100 hover:bg-gray-50 align-top ${selectedIds.has(q.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleRow(q.id)}
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                      <span className="inline-block px-1 py-0.5 rounded text-[10px] font-bold mr-1"
                        style={{ backgroundColor: STAGE_META[q.stage].bg, color: STAGE_META[q.stage].color }}>
                        {q.stage[0]}
                      </span>
                      {q.question_code}
                      {q.is_anchor && <div className="text-[10px] uppercase mt-1" style={{ color: BRAND.teal }}>Anchor</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700 max-w-[140px]">
                      {q.concern_label || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className="font-normal" style={{ backgroundColor: STAGE_META[q.stage].bg, color: STAGE_META[q.stage].color }}>
                        {q.stage}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-gray-900 max-w-xs">
                      <p className="line-clamp-2 text-sm">{q.question_text}</p>
                      {q.focus_area && <p className="text-[10px] text-gray-400 mt-0.5">{q.focus_area}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(q.target_personas ?? []).length === 0
                          ? <span className="text-[10px] text-gray-400">All</span>
                          : (q.target_personas ?? []).map(p => {
                              const lbl = ALL_PERSONAS.find(x => x.key === p)?.label ?? p;
                              return (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: '#EEF1F8', color: BRAND.primary }}>
                                  {lbl}
                                </span>
                              );
                            })
                        }
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700 text-xs">{q.age_band || '—'}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs">{q.weight || '1'}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(q)} className="px-2">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(q)} className="px-2 text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Floating multi-select action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-gray-200"
          style={{ backgroundColor: '#fff', minWidth: 380 }}>
          <span className="text-sm font-semibold text-gray-800 mr-1">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => exportRows(selectedQuestions, 'tsv')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ color: BRAND.primary }}
          >
            Export TSV
          </button>
          <button
            onClick={() => exportRows(selectedQuestions, 'csv')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ color: BRAND.primary }}
          >
            Export CSV
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none font-light"
            title="Clear selection"
          >
            ×
          </button>
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} question{selectedIds.size !== 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              This will permanently remove {selectedIds.size} selected question{selectedIds.size !== 1 ? 's' : ''}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMut.isPending}
              onClick={() => bulkDeleteMut.mutate([...selectedIds])}
            >
              {bulkDeleteMut.isPending ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Question' : 'New Question'}</DialogTitle>
            <DialogDescription>
              Define a single short-assessment question for the selected concern.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
            {/* Row 1: Code / Stage / Age Band */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Code <span className="text-red-500">*</span></label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.question_code}
                  onChange={(e) => setForm(f => ({ ...f, question_code: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Stage <span className="text-red-500">*</span></label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.stage}
                  onChange={(e) => setForm(f => ({ ...f, stage: e.target.value as Stage }))}
                >
                  {STAGES.map(s => (
                    <option key={s} value={s}>{s} — {STAGE_META[s].sub}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Age Band</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.age_band}
                  onChange={(e) => setForm(f => ({ ...f, age_band: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  {activeBands.map(b => (
                    <option key={b.code} value={b.ages || b.code}>
                      {b.code}{b.ages ? ` · ${b.ages}` : ''}
                    </option>
                  ))}
                  {/* Preserve cross-band or unlisted age ranges */}
                  {form.age_band &&
                    !activeBands.some(b => (b.ages || b.code) === form.age_band) && (
                    <option value={form.age_band}>{form.age_band}</option>
                  )}
                </select>
                {activeBands.length === 0 && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    No active bands. Click <span className="font-medium">Age Bands</span> in the toolbar to configure.
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Focus Area / Layer */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Focus Area</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.focus_area}
                  onChange={(e) => setForm(f => ({ ...f, focus_area: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Layer</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.layer}
                  onChange={(e) => setForm(f => ({ ...f, layer: e.target.value }))}
                />
              </div>
            </div>

            {/* Dimension */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Dimension</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.dimension}
                onChange={(e) => setForm(f => ({ ...f, dimension: e.target.value }))}
              />
            </div>

            {/* Item Text */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Item Text (Statement) <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Enter the assessment statement or question..."
                value={form.question_text}
                onChange={(e) => setForm(f => ({ ...f, question_text: e.target.value }))}
                required
              />
            </div>

            {/* Polarity / Weight / Logic */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Polarity</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.polarity}
                  onChange={(e) => setForm(f => ({ ...f, polarity: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="(+)">(+) Positive</option>
                  <option value="(-)">(-) Negative / Reverse</option>
                  <option value="(±)">(±) Neutral</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Weight</label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.weight}
                  onChange={(e) => setForm(f => ({ ...f, weight: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Logic</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.logic}
                  onChange={(e) => setForm(f => ({ ...f, logic: e.target.value }))}
                  placeholder="e.g. Linear (1-5)"
                />
              </div>
            </div>

            {/* Target Personas */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: BRAND.primary }}>
                  Target Personas
                </label>
                <span className="text-[11px] text-gray-500">
                  {form.target_personas.length === 0 ? 'All personas see this' : `${form.target_personas.length} selected`}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Leave empty to show to all personas. Select one or more to restrict to specific roles.
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_PERSONAS.map(p => {
                  const active = form.target_personas.includes(p.key);
                  return (
                    <button
                      type="button"
                      key={p.key}
                      onClick={() => togglePersona(p.key)}
                      className="text-xs rounded-full border px-3 py-1.5 inline-flex items-center gap-1 transition-colors"
                      style={{
                        borderColor: active ? BRAND.primary : '#E5E7EB',
                        backgroundColor: active ? '#D6DCF0' : '#FFFFFF',
                        color: active ? BRAND.primary : '#374151',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {active && <span className="text-[10px]">✓</span>}
                      {p.label}
                    </button>
                  );
                })}
              </div>
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

            {/* Anchor / Active checkboxes */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_anchor}
                  onChange={(e) => setForm(f => ({ ...f, is_anchor: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">Anchor Item</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <div className="ml-auto">
                <label className="text-xs font-medium text-gray-700 mb-1 block">Sort Order</label>
                <input
                  type="number"
                  className="w-24 border rounded-lg px-3 py-1.5 text-sm"
                  value={form.sort_order}
                  onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Response Options & Scores — A-E rows like LBI */}
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-600">Response Options &amp; Scores</p>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, options: DEFAULT_OPTIONS.slice() }))}
                  className="text-xs underline"
                  style={{ color: BRAND.primary }}
                >
                  Reset to 5-point Likert
                </button>
              </div>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="w-10 border rounded px-2 py-1 text-xs font-bold text-center text-gray-600 bg-white"
                      value={opt.key}
                      maxLength={3}
                      onChange={(e) => setOption(i, { key: e.target.value.toUpperCase() })}
                    />
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm bg-white"
                      placeholder={`Option ${opt.key} text`}
                      value={opt.text}
                      onChange={(e) => setOption(i, { text: e.target.value })}
                    />
                    <input
                      type="number"
                      className="w-16 border rounded px-2 py-1 text-sm bg-white"
                      placeholder="Score"
                      value={opt.score}
                      onChange={(e) => setOption(i, { score: Number(e.target.value) || 0 })}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="text-gray-400 hover:text-red-600 px-1"
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {form.options.length < 7 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-xs flex items-center gap-1 mt-1"
                    style={{ color: BRAND.primary }}
                  >
                    <Plus className="h-3 w-3" /> Add option
                  </button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                className="text-white"
                style={{ backgroundColor: BRAND.primary }}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this question?</DialogTitle>
            <DialogDescription>
              {confirmDelete && <span className="font-semibold text-gray-900">{confirmDelete.question_code}</span>} will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDelete && delMut.mutate(confirmDelete.id)} disabled={delMut.isPending}>
              {delMut.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Age Bands Configuration */}
      <Dialog open={bandsOpen} onOpenChange={setBandsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Age Bands Configuration</DialogTitle>
                <DialogDescription>
                  Add, edit or remove age bands. Set a From–To range (leave To blank for open-ended e.g. "30+"), add an optional description, and toggle Active. Active bands appear in the question editor and filters.
                </DialogDescription>
              </div>
              <span className="shrink-0 text-xs px-2.5 py-1 rounded-full border bg-white text-gray-700 font-medium">
                {bandsDraft.length} bands
              </span>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {bandsDraft.map((b, i) => {
              const active = b.is_active;
              const dupCode = bandsDraft.filter(x => x.code.trim().toUpperCase() === b.code.trim().toUpperCase()).length > 1;
              const qCount = b.question_count ?? 0;
              return (
                <div key={i}
                  className="relative rounded-xl border bg-white p-4 flex flex-col items-center text-center transition-all"
                  style={{ borderColor: active ? BRAND.teal + '66' : '#E5E7EB', boxShadow: active ? `0 0 0 1px ${BRAND.teal}33` : 'none' }}>

                  {/* question count badge */}
                  {qCount > 0 && (
                    <div className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: '#E8EDFB', color: BRAND.primary }}>
                      {qCount}Q
                    </div>
                  )}

                  {/* delete */}
                  <button type="button" onClick={() => removeBandRow(i)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 text-base"
                    title="Delete band">×</button>

                  {/* editable code circle */}
                  <input
                    className="w-14 h-14 rounded-full text-center text-xl font-bold mt-2 mb-1 border-0 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    style={{ backgroundColor: '#E8FAF7', color: BRAND.teal }}
                    value={b.code}
                    maxLength={8}
                    title="Click to rename band code"
                    onChange={(e) => updateBand(i, { code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  />
                  {dupCode && <div className="text-[10px] text-red-600 mb-1">Duplicate code</div>}

                  {/* From – To age number inputs */}
                  <div className="w-full mt-2 mb-2">
                    <div className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide font-medium">Age Range</div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 flex flex-col">
                        <span className="text-[9px] text-gray-400 mb-0.5">From</span>
                        <input type="number" min={0} max={120}
                          className="w-full text-center border rounded-md px-1 py-1.5 text-sm focus:outline-none focus:ring-1"
                          style={{ borderColor: '#E5E7EB' }}
                          placeholder="0"
                          value={b._from ?? ''}
                          onChange={(e) => updateBand(i, { _from: e.target.value })}
                        />
                      </div>
                      <span className="text-gray-400 text-xs pt-4">–</span>
                      <div className="flex-1 flex flex-col">
                        <span className="text-[9px] text-gray-400 mb-0.5">To (blank = +)</span>
                        <input type="number" min={0} max={120}
                          className="w-full text-center border rounded-md px-1 py-1.5 text-sm focus:outline-none focus:ring-1"
                          style={{ borderColor: '#E5E7EB' }}
                          placeholder="∞"
                          value={b._to ?? ''}
                          onChange={(e) => updateBand(i, { _to: e.target.value })}
                        />
                      </div>
                    </div>
                    {b.ages && (
                      <div className="text-[10px] mt-1 font-medium" style={{ color: BRAND.teal }}>→ {b.ages}</div>
                    )}
                  </div>

                  {/* Optional description */}
                  <input
                    className="w-full border rounded-md px-2 py-1 text-xs text-center text-gray-600 focus:outline-none focus:ring-1 mb-3"
                    style={{ borderColor: '#E5E7EB' }}
                    placeholder="Description (optional)"
                    maxLength={80}
                    value={b.description ?? ''}
                    onChange={(e) => updateBand(i, { description: e.target.value })}
                  />

                  {/* Active / Inactive toggle */}
                  <button type="button"
                    onClick={() => updateBand(i, { is_active: !active })}
                    className="text-xs font-semibold px-4 py-1.5 rounded-full transition w-full"
                    style={active
                      ? { backgroundColor: BRAND.teal, color: '#FFF' }
                      : { backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                    {active ? '● Active' : 'Inactive'}
                  </button>
                </div>
              );
            })}

            {/* + Add Band card */}
            <button type="button" onClick={addBandRow}
              className="rounded-xl border-2 border-dashed bg-white p-4 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition"
              style={{ borderColor: '#D1D5DB', color: '#9CA3AF', minHeight: '260px' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mb-2"
                style={{ backgroundColor: '#F3F4F6' }}>+</div>
              <div className="text-sm font-medium text-gray-600">Add Band</div>
              <div className="text-[11px] text-gray-400 mt-1">New age range</div>
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => setBandsDraft(d => d.map(x => ({ ...x, is_active: true })))}
              className="underline"
              style={{ color: BRAND.primary }}
            >
              Activate all
            </button>
            <button
              type="button"
              onClick={() => setBandsDraft(d => d.map(x => ({ ...x, is_active: false })))}
              className="underline"
            >
              Deactivate all
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBandsOpen(false)}>Cancel</Button>
            <Button
              className="text-white"
              style={{ backgroundColor: BRAND.primary }}
              onClick={() => {
                // Validate: no duplicate non-empty codes
                const codes = bandsDraft.map(b => b.code.trim().toUpperCase()).filter(Boolean);
                const dup = codes.find((c, i) => codes.indexOf(c) !== i);
                if (dup) {
                  toast({ title: 'Duplicate code', description: `"${dup}" appears more than once`, variant: 'destructive' });
                  return;
                }
                saveBandsMut.mutate();
              }}
              disabled={saveBandsMut.isPending}
            >
              {saveBandsMut.isPending ? 'Applying...' : 'Apply Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Questions (TSV / CSV)</DialogTitle>
            <DialogDescription>
              Paste tab- or comma-separated rows, or upload a file. Required columns: <code>ID</code> and <code>Question</code>.
              Optional: Anchor, Focus Area, Layer, Dimension, Response, Polarity, Wt, Logic, Age Band, Stage.
              Rows missing a Stage column use the default below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Default Stage</Label>
                <Select value={uploadStage} onValueChange={(v) => setUploadStage(v as Stage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s} value={s}>{s} — {STAGE_META[s].sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={uploadMode} onValueChange={(v) => setUploadMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append (keep existing)</SelectItem>
                    <SelectItem value="replace">Replace (delete existing for this concern)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="file" accept=".tsv,.csv,.txt"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="text-sm" />
              <span className="text-xs text-gray-500">— or paste below</span>
            </div>

            <Textarea rows={10} value={uploadText} onChange={(e) => setUploadText(e.target.value)}
              placeholder={"ID\tAnchor\tFocus Area\tLayer\tDimension\tQuestion\tResponse\tPolarity\tWt\tLogic\tAge Band\tStage\nFSA-01\tYes\tDeep Cognitive\t1\tSustained Focus\tHow long can you study?\t<15m to 1h+\t(+)\t1.5\tLinear (1-5)\t11-18\tCuriosity"}
              className="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button className="text-white" style={{ backgroundColor: BRAND.primary }}
              onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending || !uploadText.trim()}>
              <FileText className="h-4 w-4 mr-1" />
              {uploadMut.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
