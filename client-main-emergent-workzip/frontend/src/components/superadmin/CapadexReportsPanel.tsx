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
  Cpu, Archive, Bot, Network, Minus, MessageSquare, Edit3
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
const NAVY = '#344E86';
const NAVY_BG = '#EEF2FA';
const NAVY_DARK = '#1E2F52';

// Canonical behavioural progression spectrum (low → high), each tier mapped to
// a unique colour. The legacy DB label 'Mastery' is collapsed into 'Advanced'
// via normalizeLevel() rather than kept as a duplicate key.
const LEVEL_META: Record<string, { color: string; bg: string }> = {
  Forming:    { color: '#64748B', bg: '#F1F5F9' },
  Emerging:   { color: '#EF4444', bg: '#FEF2F2' },
  Developing: { color: '#D97706', bg: '#FFFBEB' },
  Proficient: { color: '#059669', bg: '#ECFDF5' },
  Advanced:   { color: '#8B5CF6', bg: '#F5F3FF' },
};

// Map any stored score_level onto the canonical spectrum. Legacy rows persisted
// 'Mastery'; the current scoring model emits 'Advanced' — they are the same tier.
function normalizeLevel(level: string | null | undefined): string {
  return level === 'Mastery' ? 'Advanced' : (level || '');
}

function getLevelFromScore(score: number): string {
  if (score >= 80) return 'Advanced';
  if (score >= 60) return 'Proficient';
  if (score >= 40) return 'Developing';
  return 'Emerging';
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  CAP_CUR: { label: 'Curiosity', color: '#2563EB' },
  CAP_INS: { label: 'Insight',   color: '#7C3AED' },
  CAP_GRW: { label: 'Growth',    color: '#059669' },
  CAP_MAS: { label: 'Mastery',   color: '#344E86' },
};

const STAGE_SIGN_OFFS: Record<string, { signOff: string; teamSignOff: string }> = {
  CAP_CUR: { signOff: 'Curiosity is where every meaningful change begins.', teamSignOff: '— The MetryxOne Behavioural Intelligence Team' },
  CAP_INS: { signOff: 'Insight turns awareness into direction.', teamSignOff: '— The MetryxOne Behavioural Intelligence Team' },
  CAP_GRW: { signOff: 'Growth is the proof that insight became action.', teamSignOff: '— The MetryxOne Behavioural Intelligence Team' },
  CAP_MAS: { signOff: 'Mastery is consistency made visible over time.', teamSignOff: '— The MetryxOne Behavioural Intelligence Team' },
};

const STATUS_STEPS = ['pending', 'in_review', 'approved', 'published'] as const;

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; step: number; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', step: 0, icon: Clock },
  in_review: { label: 'In review', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', step: 1, icon: Eye },
  approved:  { label: 'Approved',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', step: 2, icon: CheckCircle },
  published: { label: 'Published', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', step: 3, icon: Globe },
};

const BRAND = { primary: '#344E86', accent: '#4ECDC4', cyan: '#4ECDC4', lightBg: '#f8fafc', dark: '#1e293b', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1' };
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

/* ──────────────────────────────────────────────────────────────────────────
 * Telemetry Intelligence Terminal — dark-substrate scientific console
 * (data provenance · OMEGA-X integrity · 4-tier taxonomy). Metrics shown here
 * are illustrative reference scales until per-report telemetry is persisted.
 * ────────────────────────────────────────────────────────────────────────── */

type ClaritySource = 'master_curated' | 'adaptive_bank' | 'static_fallback';

interface ReportRow {
  id: string;
  session_id: string;
  user_name: string;
  concern_area: string;
  macro_score: number;
  status: 'pending' | 'in_review' | 'approved' | 'published';
  clarity_source: ClaritySource;
  contradiction_count: number;
  telemetry_pacing_ms: number;
  updated_at: string;
}

const TELEMETRY = {
  deepCyber: '#040814',
  slateNavy: '#0B1120',
};

const CLARITY_SOURCE_META: Record<ClaritySource, { label: string; tier: string; text: string; bg: string; border: string; hex: string }> = {
  master_curated:  { label: 'Master curated', tier: 'Empirical base',   text: 'text-[#00F5D4]', bg: 'bg-[#00F5D4]/10', border: 'border-[#00F5D4]/20', hex: '#00F5D4' },
  adaptive_bank:   { label: 'Adaptive bank',  tier: 'Graph extension',  text: 'text-[#9D4EDD]', bg: 'bg-[#9D4EDD]/10', border: 'border-[#9D4EDD]/20', hex: '#9D4EDD' },
  static_fallback: { label: 'Static fallback',tier: 'System default',   text: 'text-[#3A86FF]', bg: 'bg-[#3A86FF]/10', border: 'border-[#3A86FF]/20', hex: '#3A86FF' },
};

// Illustrative provenance composition keyed by the dominant clarity source.
const PROVENANCE_MIX: Record<ClaritySource, { master_curated: number; adaptive_bank: number; static_fallback: number }> = {
  master_curated:  { master_curated: 70, adaptive_bank: 20, static_fallback: 10 },
  adaptive_bank:   { master_curated: 25, adaptive_bank: 60, static_fallback: 15 },
  static_fallback: { master_curated: 15, adaptive_bank: 25, static_fallback: 60 },
};

function DataProvenanceTracker({ source }: { source: ClaritySource }) {
  const mix = PROVENANCE_MIX[source] || PROVENANCE_MIX.master_curated;
  const order: ClaritySource[] = ['master_curated', 'adaptive_bank', 'static_fallback'];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Data provenance</p>
        <span className="text-[8px] font-mono text-slate-500">illustrative mix</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        {order.map(k => (
          <div key={k} style={{ width: `${mix[k]}%`, backgroundColor: CLARITY_SOURCE_META[k].hex }} className="h-full transition-all" />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {order.map(k => {
          const m = CLARITY_SOURCE_META[k];
          const active = k === source;
          return (
            <div key={k} className={`rounded-md border px-2 py-1.5 ${m.bg} ${m.border} ${active ? 'ring-1 ring-white/20' : 'opacity-70'}`}>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.hex }} />
                <span className={`text-[8px] font-bold ${m.text}`}>{mix[k]}%</span>
              </div>
              <p className="text-[7.5px] text-slate-400 mt-0.5 truncate">{m.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OmegaXIntegrityMonitor({ macroScore, contradictionCount, pacingMs }: { macroScore: number; contradictionCount: number; pacingMs: number }) {
  const integrity = Math.max(0, Math.min(100, Math.round(macroScore)));
  const R = 30, C = 2 * Math.PI * R;
  const dash = (integrity / 100) * C;
  const ringColor = contradictionCount > 0 ? '#FF007F' : integrity >= 60 ? '#00F5A0' : '#FFB703';
  const velocity = pacingMs >= 2200 ? 'Deliberate' : pacingMs >= 1200 ? 'Steady' : 'Rapid';
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">OMEGA-X integrity</p>
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 76, height: 76 }}>
          <svg width="76" height="76" className="-rotate-90">
            <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle cx="38" cy="38" r={R} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`} className="transition-all" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[17px] font-black leading-none" style={{ color: ringColor }}>{integrity}</span>
            <span className="text-[6.5px] uppercase tracking-wider text-slate-500">index</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between rounded-md border border-[#FFB703]/20 bg-[#FFB703]/10 px-2 py-1.5">
            <span className="flex items-center gap-1 text-[8px] font-semibold text-[#FFB703]"><Zap className="h-2.5 w-2.5" /> Cognitive velocity</span>
            <span className="text-[9px] font-bold text-[#FFB703]">{velocity} · {pacingMs}ms</span>
          </div>
          <div className={`flex items-center justify-between rounded-md border px-2 py-1.5 ${contradictionCount > 0 ? 'border-[#FF007F]/20 bg-[#FF007F]/10' : 'border-[#00F5A0]/20 bg-[#00F5A0]/10'}`}>
            <span className={`flex items-center gap-1 text-[8px] font-semibold ${contradictionCount > 0 ? 'text-[#FF007F]' : 'text-[#00F5A0]'}`}>
              <AlertTriangle className="h-2.5 w-2.5" /> Contradiction flags
            </span>
            <span className={`text-[9px] font-bold ${contradictionCount > 0 ? 'text-[#FF007F]' : 'text-[#00F5A0]'}`}>{contradictionCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Native 4-tier taxonomy: Strategic Domain → Behavioral Family → Explicit Signal → Atomic Touchpoint
function buildTaxonomy(concern: string) {
  const c = (concern || 'Behavioural signal').trim();
  return [
    {
      label: 'Strategic domain', value: c, icon: Layers,
      children: [
        {
          label: 'Behavioural family', value: `${c} · regulation`, icon: Network,
          children: [
            {
              label: 'Explicit signal', value: 'Response consistency', icon: Activity,
              children: [
                { label: 'Atomic touchpoint', value: 'Item-level latency variance', icon: Cpu },
                { label: 'Atomic touchpoint', value: 'Option-switch frequency', icon: Cpu },
              ],
            },
            {
              label: 'Explicit signal', value: 'Cognitive load', icon: Activity,
              children: [
                { label: 'Atomic touchpoint', value: 'Pacing drift', icon: Cpu },
              ],
            },
          ],
        },
      ],
    },
  ];
}

function TaxonomyNode({ node, depth }: { node: any; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const Icon = node.icon;
  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-white/5 transition-colors"
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        {hasChildren
          ? (open ? <ChevronDown className="h-2.5 w-2.5 text-slate-500" /> : <ChevronRight className="h-2.5 w-2.5 text-slate-500" />)
          : <span className="w-2.5" />}
        <Icon className="h-2.5 w-2.5 text-[#00F5D4]" />
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{node.label}</span>
        <span className="text-[9px] font-medium text-slate-200 truncate">{node.value}</span>
      </button>
      {hasChildren && open && (
        <div className="border-l border-white/5 ml-[10px]">
          {node.children.map((child: any, i: number) => <TaxonomyNode key={i} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function FourTierTaxonomyAccordion({ concern }: { concern: string }) {
  const tree = useMemo(() => buildTaxonomy(concern), [concern]);
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Signal taxonomy</p>
      <div className="rounded-lg border border-white/5 bg-black/20 p-1.5">
        {tree.map((node, i) => <TaxonomyNode key={i} node={node} depth={0} />)}
      </div>
    </div>
  );
}

function TelemetryIntelligenceTerminal({ report }: { report: any }) {
  const source = (report.clarity_source || 'master_curated') as ClaritySource;
  const macroScore = Number(report.macro_score ?? report.score ?? 0);
  const contradictionCount = Number(report.contradiction_count ?? 0);
  const pacingMs = Number(report.telemetry_pacing_ms ?? 1420);
  const sm = CLARITY_SOURCE_META[source] || CLARITY_SOURCE_META.master_curated;

  // External email preview trigger (opens the server-rendered HTML in a new tab).
  const openEmailPreview = () => {
    const concern = report.concern_area || report.concern_name || '';
    const score = report.macro_score ?? report.score ?? 0;
    const stage = report.stage_code || 'CAP_CUR';
    const url = `/api/admin/email-preview/capadex-report?stage=${encodeURIComponent(stage)}&concern=${encodeURIComponent(concern)}&score=${score}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 space-y-4" style={{ backgroundColor: TELEMETRY.deepCyber }}>
      <div className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: TELEMETRY.slateNavy }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-[#00F5D4]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Telemetry terminal</span>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[7.5px] font-bold ${sm.bg} ${sm.border} ${sm.text}`}>{sm.tier}</span>
        </div>
        <button
          onClick={openEmailPreview}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#00F5D4]/20 bg-[#00F5D4]/10 py-1.5 text-[9px] font-bold text-[#00F5D4] transition-all hover:bg-[#00F5D4]/20"
        >
          <Mail className="h-2.5 w-2.5" /> Open email preview
        </button>
      </div>
      <div className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: TELEMETRY.slateNavy }}>
        <DataProvenanceTracker source={source} />
      </div>
      <div className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: TELEMETRY.slateNavy }}>
        <OmegaXIntegrityMonitor macroScore={macroScore} contradictionCount={contradictionCount} pacingMs={pacingMs} />
      </div>
      <div className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: TELEMETRY.slateNavy }}>
        <FourTierTaxonomyAccordion concern={report.concern_area || report.concern_name || ''} />
      </div>
      <p className="text-[7.5px] text-slate-500 text-center leading-relaxed">
        Telemetry metrics are illustrative reference scales until per-report signal capture is persisted.
      </p>
    </div>
  );
}

export default function CapadexReportsPanel() {
  const { toast } = useToast();

  // Main view
  const [mainView, setMainView] = useState<MainView>('reports');

  // Pricing state
  const [pricingRows, setPricingRows]   = useState<StagePricing[]>([]);
  const [pricingEdit, setPricingEdit]   = useState<Record<string, StagePricing>>({});
  const [pricingSaving, setPricingSaving] = useState<string | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const res  = await fetch('/api/admin/capadex/pricing');
      const rows: StagePricing[] = await res.json();
      setPricingRows(rows);
      const map: Record<string, StagePricing> = {};
      rows.forEach(r => { map[r.stage_code] = { ...r }; });
      setPricingEdit(map);
    } catch { toast({ title: 'Failed to load pricing', variant: 'destructive' }); }
    finally { setPricingLoading(false); }
  }, []);

  useEffect(() => { if (mainView === 'pricing') fetchPricing(); }, [mainView, fetchPricing]);

  const savePricing = async (stage_code: string) => {
    const row = pricingEdit[stage_code];
    if (!row) return;
    setPricingSaving(stage_code);
    try {
      const res = await fetch(`/api/admin/capadex/pricing/${stage_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: row.price, price_note: row.price_note, tag: row.tag,
          description: row.description, benefits: row.benefits,
          whatsapp_number: row.whatsapp_number, is_active: row.is_active,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setPricingRows(prev => prev.map(r => r.stage_code === stage_code ? { ...row } : r));
      toast({ title: `${row.stage_name} pricing saved`, description: 'Changes are live for all new report views.' });
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    finally { setPricingSaving(null); }
  };

  const updatePricingField = (code: string, field: keyof StagePricing, value: string | boolean | string[]) => {
    setPricingEdit(prev => ({ ...prev, [code]: { ...prev[code], [field]: value } }));
  };

  const updateBenefit = (code: string, idx: number, value: string) => {
    const benefits = [...(pricingEdit[code]?.benefits || [])];
    benefits[idx] = value;
    updatePricingField(code, 'benefits', benefits);
  };

  const addBenefit = (code: string) => {
    const benefits = [...(pricingEdit[code]?.benefits || []), ''];
    updatePricingField(code, 'benefits', benefits);
  };

  const removeBenefit = (code: string, idx: number) => {
    const benefits = (pricingEdit[code]?.benefits || []).filter((_, i) => i !== idx);
    updatePricingField(code, 'benefits', benefits);
  };

  // List state
  const [reports, setReports]   = useState<CapadexReport[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);

  // Filters
  const [search, setSearch]               = useState('');
  const [filterConcern, setFilterConcern] = useState('');
  const [filterStage, setFilterStage]     = useState('all');
  const [filterLevel, setFilterLevel]     = useState('');
  const [filterStatus, setFilterStatus]   = useState('');

  // Detail panel
  const [selected, setSelected]       = useState<CapadexReport | null>(null);
  const [activeTab, setActiveTab]     = useState<DetailTab>('overview');
  const [subdomains, setSubdomains]   = useState<Subdomain[]>([]);
  const [subLoading, setSubLoading]   = useState(false);

  // Override edit state
  const [editNotes, setEditNotes]                         = useState('');
  const [editScoreOverride, setEditScoreOverride]         = useState('');
  const [editHeadline, setEditHeadline]                   = useState('');
  const [editNarrative, setEditNarrative]                 = useState('');
  const [editReason, setEditReason]                       = useState('');
  const [editStatus, setEditStatus]                       = useState('pending');
  const [savingContent, setSavingContent]                 = useState(false);
  const [savingStatus, setSavingStatus]                   = useState<string | null>(null);

  // Email preview state
  const [previewOpen, setPreviewOpen]         = useState(false);
  const [previewHtml, setPreviewHtml]         = useState('');
  const [previewSubject, setPreviewSubject]   = useState('');
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [previewStage, setPreviewStage]       = useState('CAP_CUR');
  const [previewReport, setPreviewReport]     = useState<CapadexReport | null>(null);
  const [sendingEmail, setSendingEmail]       = useState(false);
  const [emailSentIds, setEmailSentIds]       = useState<Set<string>>(new Set());

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search)        p.set('search', search);
      if (filterConcern) p.set('concern', filterConcern);
      if (filterStage && filterStage !== 'all')   p.set('stage', filterStage);
      if (filterLevel)   p.set('level', filterLevel);
      if (filterStatus)  p.set('reviewed', filterStatus === 'pending' ? 'no' : 'yes');
      p.set('limit', '500');
      const res = await fetch(`/api/admin/capadex/reports?${p}`);
      const data = await res.json();
      setReports(data.rows || []);
      setStats(data.stats || null);
      setTotal(data.total || 0);
    } catch {
      toast({ title: 'Failed to load reports', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [search, filterConcern, filterStage, filterLevel, filterStatus]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Open detail
  const openReport = (r: CapadexReport) => {
    setSelected(r);
    setActiveTab('overview');
    setEditNotes(r.admin_notes || '');
    setEditScoreOverride(r.score_override != null ? String(Math.round(Number(r.score_override))) : '');
    setEditHeadline(r.headline_override || '');
    setEditNarrative(r.narrative_override || '');
    setEditReason(r.override_reason || '');
    setEditStatus(r.review_status || 'pending');
    setSubdomains([]);
    setScoreTrace(null);
    setTraceOpen(false);
  };

  const [scoreTrace, setScoreTrace] = useState<SessionScoreTrace | null>(null);
  const [traceOpen, setTraceOpen]   = useState(false);

  // Fetch subdomains + score trace for Domains tab
  const fetchSubdomains = useCallback(async (id: string) => {
    setSubLoading(true);
    try {
      const res = await fetch(`/api/admin/capadex/reports/${id}`);
      const data = await res.json();
      const subs: Subdomain[] = data.subdomains
        ? (typeof data.subdomains === 'string' ? JSON.parse(data.subdomains) : data.subdomains)
        : [];
      setSubdomains(subs);
      if (data.session_score_trace) {
        setScoreTrace(typeof data.session_score_trace === 'string'
          ? JSON.parse(data.session_score_trace)
          : data.session_score_trace);
      } else {
        setScoreTrace(null);
      }
    } catch { setSubdomains([]); setScoreTrace(null); } finally { setSubLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'domains' && selected && subdomains.length === 0 && !subLoading) {
      fetchSubdomains(selected.id);
    }
  }, [activeTab, selected]);

  // Save content overrides
  const saveContent = async () => {
    if (!selected) return;
    setSavingContent(true);
    try {
      const res = await fetch(`/api/admin/capadex/reports/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_notes: editNotes,
          score_override: editScoreOverride,
          headline_override: editHeadline,
          narrative_override: editNarrative,
          override_reason: editReason,
          reviewed_by: 'superadmin@metryx.one',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Failed');
      const updated = { ...selected, ...data.report, admin_notes: editNotes || null,
        score_override: editScoreOverride || null, headline_override: editHeadline || null,
        narrative_override: editNarrative || null, override_reason: editReason || null };
      setSelected(updated);
      setReports(prev => prev.map(r => r.id === selected.id ? updated : r));
      toast({ title: 'Overrides saved', description: editStatus === 'published' ? 'Changes are now live for participants.' : 'Saved as draft — publish to go live.' });
    } catch { toast({ title: 'Save failed', variant: 'destructive' }); }
    finally { setSavingContent(false); }
  };

  // Change review status
  const changeStatus = async (newStatus: string) => {
    if (!selected) return;
    setSavingStatus(newStatus);
    try {
      const res = await fetch(`/api/admin/capadex/reports/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: newStatus, reviewed_by: 'superadmin@metryx.one' }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = { ...selected, review_status: newStatus,
        published_at: newStatus === 'published' ? new Date().toISOString() : selected.published_at };
      setSelected(updated);
      setEditStatus(newStatus);
      setReports(prev => prev.map(r => r.id === selected.id ? updated : r));
      toast({ title: STATUS_META[newStatus]?.label, description: newStatus === 'published' ? 'Overrides are now live for this participant.' : `Status moved to ${STATUS_META[newStatus]?.label}.` });
    } catch { toast({ title: 'Status update failed', variant: 'destructive' }); }
    finally { setSavingStatus(null); }
  };

  // Fetch email preview
  const fetchPreview = useCallback(async (reportId: string, stage: string) => {
    setPreviewLoading(true);
    setPreviewHtml('');
    setPreviewSubject('');
    try {
      const res = await fetch('/api/admin/capadex/email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, stageCode: stage }),
      });
      if (!res.ok) throw new Error('Preview failed');
      const data = await res.json();
      setPreviewHtml(data.html || '');
      setPreviewSubject(data.subject || '');
    } catch {
      toast({ title: 'Preview failed', description: 'Could not generate email preview.', variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const openPreview = (r: CapadexReport) => {
    const stage = r.stage_code || 'CAP_CUR';
    setPreviewReport(r);
    setPreviewStage(stage);
    setPreviewOpen(true);
    fetchPreview(r.id, stage);
  };

  const sendEmail = async () => {
    if (!previewReport) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/admin/capadex/reports/${previewReport.id}/send-email`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Email delivery failed. The provider may be unavailable.');
      setEmailSentIds(prev => new Set([...prev, previewReport.id]));
      setPreviewReport(prev => prev ? { ...prev, email_sent: true } : prev);
      if (selected?.id === previewReport.id) setSelected(prev => prev ? { ...prev, email_sent: true } : prev);
      toast({ title: 'Email sent', description: `Report delivered to ${data.email || previewReport.email || 'participant'}.` });
      fetchReports();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send the email. Please try again.';
      toast({ title: 'Send failed', description: msg, variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  // Derived data
  const concerns = useMemo(() => [...new Set(reports.map(r => r.concern_name))].sort(), [reports]);

  const topConcerns = useMemo(() => {
    const counts: Record<string, { count: number; totalScore: number }> = {};
    for (const r of reports) {
      if (!counts[r.concern_name]) counts[r.concern_name] = { count: 0, totalScore: 0 };
      counts[r.concern_name].count++;
      counts[r.concern_name].totalScore += Number(r.score);
    }
    return Object.entries(counts)
      .map(([name, { count, totalScore }]) => ({ name, count, avg: Math.round(totalScore / count) }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  }, [reports]);

  const maxConcernCount = topConcerns[0]?.count || 1;

  // Live score override preview
  const overrideScoreNum = editScoreOverride ? parseInt(editScoreOverride) : null;
  const overrideLevel    = overrideScoreNum != null ? getLevelFromScore(overrideScoreNum) : null;
  const rawScore         = selected ? Math.round(Number(selected.score)) : 0;
  const rawLevel         = selected ? normalizeLevel(selected.score_level) : '';

  const STAGE_COLORS: Record<string, { col: string; bg: string; bdr: string }> = {
    CAP_INS: { col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE' },
    CAP_GRW: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' },
    CAP_MAS: { col: NAVY,      bg: NAVY_BG,   bdr: '#D4DBF0' },
  };

  // ── If pricing view, render pricing manager ──────────────────────────
  if (mainView === 'pricing') {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* Header */}
        <div className="bg-white border-b px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: NAVY }} />
            <h2 className="text-sm font-bold" style={{ color: NAVY }}>Stage Pricing</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-gray-400 border-gray-200">3 stages</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPricing} className="gap-1.5 text-xs h-7">
              <RefreshCw className={`h-3 w-3 ${pricingLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setMainView('reports')} className="gap-1.5 text-xs h-7 text-white" style={{ backgroundColor: NAVY }}>
              <ArrowRight className="h-3 w-3" /> Reports
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
          {pricingLoading && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading pricing…
            </div>
          )}

          {!pricingLoading && pricingRows.length === 0 && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No pricing data yet. Prices seed automatically on first backend start.</div>
          )}

          {!pricingLoading && pricingRows.map(row => {
            const edit = pricingEdit[row.stage_code];
            if (!edit) return null;
            const sc = STAGE_COLORS[row.stage_code] || { col: NAVY, bg: NAVY_BG, bdr: '#D4DBF0' };
            const saving = pricingSaving === row.stage_code;
            const stageNum = row.stage_code === 'CAP_INS' ? 2 : row.stage_code === 'CAP_GRW' ? 3 : 4;
            return (
              <div key={row.stage_code} className="rounded-xl overflow-hidden bg-white" style={{ border: `1.5px solid ${sc.bdr}` }}>
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: sc.bg, borderBottom: `1px solid ${sc.bdr}` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-black" style={{ backgroundColor: sc.col }}>{stageNum}</div>
                    <span className="text-[15px] font-black" style={{ color: sc.col }}>{row.stage_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${sc.col}15`, color: sc.col, border: `1px solid ${sc.bdr}` }}>{row.stage_code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-[11px] text-gray-500">Active</span>
                      <div
                        className="w-8 h-4 rounded-full relative cursor-pointer transition-colors"
                        style={{ backgroundColor: edit.is_active ? sc.col : '#D1D5DB' }}
                        onClick={() => updatePricingField(row.stage_code, 'is_active', !edit.is_active)}
                      >
                        <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all" style={{ left: edit.is_active ? '17px' : '2px' }} />
                      </div>
                    </label>
                    <Button size="sm" onClick={() => savePricing(row.stage_code)} disabled={saving}
                      className="h-7 text-xs font-bold text-white gap-1.5" style={{ backgroundColor: sc.col }}>
                      {saving ? <><RefreshCw className="h-3 w-3 animate-spin" /> Saving…</> : <><Save className="h-3 w-3" /> Save</>}
                    </Button>
                  </div>
                </div>

                {/* Fields */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  {/* Price */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Price</label>
                    <Input value={edit.price} onChange={e => updatePricingField(row.stage_code, 'price', e.target.value)}
                      className="h-8 text-sm font-bold" style={{ color: sc.col }} placeholder="₹499" />
                  </div>
                  {/* Tag */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Badge Label</label>
                    <Input value={edit.tag} onChange={e => updatePricingField(row.stage_code, 'tag', e.target.value)}
                      className="h-8 text-sm" placeholder="Most Popular" />
                  </div>
                  {/* Price note */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Price Note</label>
                    <Input value={edit.price_note} onChange={e => updatePricingField(row.stage_code, 'price_note', e.target.value)}
                      className="h-8 text-xs" placeholder="one-time · results in 24 hrs" />
                  </div>
                  {/* WhatsApp number */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">WhatsApp Number</label>
                    <Input value={edit.whatsapp_number} onChange={e => updatePricingField(row.stage_code, 'whatsapp_number', e.target.value)}
                      className="h-8 text-xs font-mono" placeholder="919XXXXXXXXX" />
                  </div>
                  {/* Description — full width */}
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Description</label>
                    <Textarea value={edit.description} onChange={e => updatePricingField(row.stage_code, 'description', e.target.value)}
                      className="text-xs resize-none" rows={2} placeholder="Stage description shown on the report…" />
                  </div>
                  {/* Benefits — full width */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Benefits (What You Get)</label>
                      <Button variant="outline" size="sm" className="h-5 text-[9px] px-2 gap-1" onClick={() => addBenefit(row.stage_code)}>
                        <Plus className="h-2.5 w-2.5" /> Add
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {(edit.benefits || []).map((b, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.col }} />
                          <Input value={b} onChange={e => updateBenefit(row.stage_code, i, e.target.value)}
                            className="h-7 text-xs flex-1" placeholder={`Benefit ${i + 1}`} />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                            onClick={() => removeBenefit(row.stage_code, i)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-center text-[10px] text-gray-400 pb-4">
            Changes saved here are immediately reflected in all new Curiosity Stage report views.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ══ LEFT SIDEBAR ════════════════════════════════════════════════════ */}
      <div className="w-52 flex-shrink-0 border-r bg-gray-50 overflow-y-auto flex flex-col">
        <div className="px-3 py-3 border-b bg-white">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Analytics</p>
        </div>

        {/* Score distribution */}
        {stats && (
          <div className="px-3 py-3 border-b">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">Score Distribution</p>
            {([
              { key: 'Advanced',   statKey: 'mastery' },
              { key: 'Proficient', statKey: 'proficient' },
              { key: 'Developing', statKey: 'developing' },
              { key: 'Emerging',   statKey: 'emerging' },
            ] as const).map(({ key: l, statKey }) => {
              const m = LEVEL_META[l];
              const count = parseInt((stats as Record<string,string>)[statKey] || '0');
              const pct   = total > 0 ? (count / total) * 100 : 0;
              return (
                <button key={l} onClick={() => setFilterLevel(filterLevel === l ? '' : l)}
                  className="w-full mb-1.5 text-left"
                  style={{ opacity: filterLevel && filterLevel !== l ? 0.45 : 1 }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-semibold" style={{ color: m.color }}>{l}</span>
                    <span className="text-[9px] font-bold" style={{ color: m.color }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Review pipeline */}
        {stats && (
          <div className="px-3 py-3 border-b">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">Review Pipeline</p>
            {STATUS_STEPS.map(s => {
              const m = STATUS_META[s];
              const key = `status_${s}` as keyof Stats;
              const count = parseInt(stats[key] || '0');
              return (
                <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                  className="w-full flex items-center gap-2 mb-1.5 px-1.5 py-1 rounded-lg transition-all"
                  style={{
                    backgroundColor: filterStatus === s ? m.bg : 'transparent',
                    border: `1px solid ${filterStatus === s ? m.border : 'transparent'}`,
                  }}>
                  <m.icon className="h-3 w-3 flex-shrink-0" style={{ color: m.color }} />
                  <span className="text-[9px] flex-1 text-left" style={{ color: m.color }}>{m.label}</span>
                  <span className="text-[9px] font-bold" style={{ color: m.color }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Top concerns */}
        <div className="px-3 py-3 flex-1">
          <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">Top Concerns</p>
          {topConcerns.map(({ name, count, avg }) => (
            <button key={name} onClick={() => setFilterConcern(filterConcern === name ? '' : name)}
              className="w-full mb-2 text-left"
              style={{ opacity: filterConcern && filterConcern !== name ? 0.45 : 1 }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8.5px] font-medium text-gray-700 truncate max-w-[110px]">{name}</span>
                <span className="text-[8px] text-gray-400 ml-1">{count}</span>
              </div>
              <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxConcernCount) * 100}%`, backgroundColor: NAVY }} />
              </div>
              <p className="text-[7.5px] text-gray-400 mt-0.5">avg {avg}/100</p>
            </button>
          ))}
        </div>
      </div>

      {/* ══ MAIN TABLE ══════════════════════════════════════════════════════ */}
      <div className={`flex flex-col ${selected ? 'flex-1 min-w-0' : 'flex-1'} overflow-hidden`}>

        {/* Toolbar */}
        <div className="bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: NAVY }} />
              <h2 className="text-sm font-bold" style={{ color: NAVY }}>CAPADEX Reports</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-gray-400 border-gray-200">{total}</span>
              {stats && parseInt(stats.overridden) > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                  {stats.overridden} calibrated
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMainView('pricing')} className="gap-1.5 text-xs h-7" style={{ borderColor: NAVY, color: NAVY }}>
                <Zap className="h-3 w-3" /> Pricing
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => window.open('/api/admin/email-preview/capadex-report?stage=CAP_CUR&concern=Screen+Addiction&score=62', '_blank')}
                className="gap-1.5 text-xs h-7"
                title="Preview the report email template with sample data (opens in new tab)">
                <Eye className="h-3 w-3" /> Preview Email Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(reports)} className="gap-1.5 text-xs h-7">
                <Download className="h-3 w-3" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={fetchReports} className="gap-1.5 text-xs h-7">
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>

          {/* Stat chips */}
          {stats && (
            <div className="flex gap-2 mb-2.5 flex-wrap">
              {[
                { label: 'Avg Score', value: stats.avg_score ?? '—', icon: BarChart3, color: NAVY },
                { label: 'Published', value: stats.status_published, icon: Globe, color: '#059669' },
                { label: 'Overridden', value: stats.overridden, icon: SlidersHorizontal, color: '#D97706' },
                { label: 'Emailed', value: stats.emailed, icon: Mail, color: '#7C3AED' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs" style={{ borderColor: `${color}25`, backgroundColor: `${color}08` }}>
                  <Icon className="h-3 w-3" style={{ color }} />
                  <span className="text-gray-500">{label}:</span>
                  <span className="font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Search + filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, concern…" className="pl-8 h-7 text-xs" />
            </div>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {Object.entries(STAGE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterConcern || filterLevel || filterStatus) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400"
                onClick={() => { setFilterConcern(''); setFilterLevel(''); setFilterStatus(''); }}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading…
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Sparkles className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No reports match filters</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b z-10 shadow-sm">
                <tr>
                  {['Participant', 'Concern', 'Stage', 'Score', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 text-[9px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(r => {
                  const lm = LEVEL_META[normalizeLevel(r.score_level)] || LEVEL_META.Developing;
                  const sm = STAGE_META[r.stage_code]  || STAGE_META.CAP_CUR;
                  const st = STATUS_META[r.review_status || 'pending'] || STATUS_META.pending;
                  const isSel = selected?.id === r.id;
                  const dispScore = r.review_status === 'published' && r.score_override != null
                    ? Math.round(Number(r.score_override))
                    : Math.round(Number(r.score));
                  return (
                    <tr key={r.id} onClick={() => openReport(r)} className={`cursor-pointer transition-colors hover:bg-blue-50/60 ${isSel ? 'bg-blue-50 border-l-2' : ''}`}
                      style={isSel ? { borderLeftColor: NAVY } : {}}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #3B5BA5 100%)` }}>
                            {(r.participant_name || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate max-w-[110px]">{r.participant_name || '—'}</p>
                            <p className="text-[9px] text-gray-400 truncate max-w-[110px]">{r.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 max-w-[120px]">
                        <span className="truncate block text-gray-700">{r.concern_name}</span>
                        <span className="text-[9px] text-gray-400">{r.participant_age}y</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap" style={{ backgroundColor: `${sm.color}18`, color: sm.color }}>{sm.label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm" style={{ color: lm.color }}>{dispScore}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: lm.bg, color: lm.color }}>{normalizeLevel(r.score_level)}</span>
                          {r.review_status === 'published' && r.score_override != null && (
                            <span className="text-[7px] rounded px-1" style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}>✦</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <st.icon className="h-3 w-3 flex-shrink-0" style={{ color: st.color }} />
                          <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: st.color }}>{st.label}</span>
                        </div>
                        {r.admin_notes && <MessageSquare className="h-2.5 w-2.5 text-blue-400 mt-0.5" />}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap text-[9px]">
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-3 py-2.5">
                        <Eye className="h-3.5 w-3.5 text-gray-300 hover:text-gray-500 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ RIGHT DETAIL PANEL ══════════════════════════════════════════════ */}
      {selected && (() => {
        const lm = LEVEL_META[normalizeLevel(selected.score_level)] || LEVEL_META.Developing;
        const sm = STAGE_META[selected.stage_code]  || STAGE_META.CAP_CUR;
        const st = STATUS_META[editStatus] || STATUS_META.pending;
        const dispScore = selected.review_status === 'published' && selected.score_override != null
          ? Math.round(Number(selected.score_override))
          : Math.round(Number(selected.score));

        return (
          <div className="w-[440px] flex-shrink-0 border-l bg-white flex flex-col overflow-hidden">

            {/* Panel header */}
            <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b" style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 100%)` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">Report Detail</span>
                    <span className="text-[8px] font-mono text-white/30">{selected.id.slice(0,8).toUpperCase()}</span>
                  </div>
                  <p className="text-[15px] font-bold text-white truncate">{selected.participant_name || 'Unknown'}</p>
                  <p className="text-[10px] text-white/50 truncate">{selected.email} · {selected.participant_age}y · {selected.total_sessions} session{parseInt(selected.total_sessions) !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors ml-2 mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Status bar */}
              <div className="flex items-center gap-1">
                {STATUS_STEPS.map((s, i) => {
                  const m = STATUS_META[s];
                  const active = STATUS_META[editStatus]?.step >= m.step;
                  const isCurrent = editStatus === s;
                  return (
                    <React.Fragment key={s}>
                      <button onClick={() => changeStatus(s)} disabled={!!savingStatus}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full transition-all text-[8px] font-bold"
                        style={{
                          backgroundColor: isCurrent ? 'rgba(255,255,255,0.2)' : active ? 'rgba(255,255,255,0.08)' : 'transparent',
                          color: isCurrent ? 'white' : active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                          border: `1px solid ${isCurrent ? 'rgba(255,255,255,0.4)' : 'transparent'}`,
                        }}>
                        {savingStatus === s ? <RefreshCw className="h-2 w-2 animate-spin" /> : <m.icon className="h-2 w-2" />}
                        {m.label}
                      </button>
                      {i < 3 && <ArrowRight className="h-2 w-2 text-white/20 flex-shrink-0" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b bg-gray-50 flex-shrink-0">
              {([
                { id: 'overview',  label: 'Overview',  icon: Eye        },
                { id: 'telemetry', label: 'Telemetry', icon: Activity   },
                { id: 'overrides', label: 'Overrides', icon: Edit3      },
                { id: 'domains',   label: 'Domains',   icon: BarChart3  },
                { id: 'audit',     label: 'Audit',     icon: Clock      },
              ] as const).map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                const hasBadge = id === 'overrides' && (selected.score_override || selected.headline_override || selected.narrative_override);
                return (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-2 text-[9px] font-semibold transition-all border-b-2 ${active ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    <div className="relative">
                      <Icon className="h-3.5 w-3.5" />
                      {hasBadge && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400" />}
                    </div>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Overview ── */}
              {activeTab === 'overview' && (
                <div className="p-4 space-y-3">
                  {/* Score hero */}
                  <div className="rounded-xl p-4 border" style={{ background: `linear-gradient(135deg, ${NAVY_BG} 0%, #F8FAFF 100%)`, borderColor: '#D4DBF0' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">{sm.label} Assessment</p>
                        <p className="text-[13px] font-bold" style={{ color: NAVY_DARK }}>{selected.concern_name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-3xl font-black" style={{ color: lm.color }}>{dispScore}</span>
                          <div>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full block mb-0.5" style={{ backgroundColor: lm.bg, color: lm.color }}>{normalizeLevel(selected.score_level)}</span>
                            {selected.review_status === 'published' && selected.score_override != null && (
                              <span className="text-[7.5px] text-orange-500">system: {Math.round(Number(selected.score))}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <st.icon className="h-6 w-6 mb-1 ml-auto" style={{ color: st.color }} />
                        <p className="text-[9px] font-bold" style={{ color: st.color }}>{st.label}</p>
                        {selected.published_at && (
                          <p className="text-[8px] text-gray-400 mt-0.5">
                            Live since {new Date(selected.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Participant info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Email',    value: selected.email || '—',  icon: Mail      },
                      { label: 'Phone',    value: selected.phone || '—',  icon: User      },
                      { label: 'Sessions', value: selected.total_sessions, icon: BarChart3 },
                      { label: 'Emailed',  value: selected.email_sent ? 'Yes' : 'No', icon: CheckCircle },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-lg border p-2.5" style={{ borderColor: '#E5E8F0' }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="h-3 w-3 text-gray-400" />
                          <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                        </div>
                        <p className="text-[10px] font-medium text-gray-700 truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Auto-generated insight */}
                  <div className="rounded-lg border p-3" style={{ borderColor: '#E5E8F0', backgroundColor: '#FAFBFD' }}>
                    <p className="text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 text-gray-400 mb-1.5">
                      <Brain className="h-2.5 w-2.5" /> System Insight
                    </p>
                    <p className="text-[10px] text-gray-600 leading-relaxed italic">"{selected.insight}"</p>
                  </div>

                  {/* Admin notes preview */}
                  {selected.admin_notes && (
                    <div className="rounded-lg border p-3" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }}>
                      <p className="text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 text-blue-500 mb-1.5">
                        <MessageSquare className="h-2.5 w-2.5" /> Admin Notes
                      </p>
                      <p className="text-[10px] text-blue-800 leading-relaxed">{selected.admin_notes}</p>
                    </div>
                  )}

                  {/* Email preview button */}
                  <button
                    onClick={() => openPreview(selected)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all hover:border-blue-300 hover:bg-blue-50"
                    style={{ borderColor: '#D4DBF0', color: NAVY }}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Preview report email
                  </button>
                </div>
              )}

              {/* ── Telemetry Intelligence Terminal ── */}
              {activeTab === 'telemetry' && (
                <TelemetryIntelligenceTerminal report={selected} />
              )}

              {/* ── Overrides ── */}
              {activeTab === 'overrides' && (
                <div className="p-4 space-y-4">

                  {/* Publication notice */}
                  <div className="rounded-lg border p-3 flex gap-2 items-start"
                    style={{ backgroundColor: editStatus === 'published' ? '#ECFDF5' : '#FFFBEB', borderColor: editStatus === 'published' ? '#A7F3D0' : '#FDE68A' }}>
                    {editStatus === 'published'
                      ? <Globe className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />}
                    <p className="text-[9.5px] leading-relaxed" style={{ color: editStatus === 'published' ? '#065F46' : '#92400E' }}>
                      {editStatus === 'published'
                        ? 'Overrides are LIVE. Participants see calibrated score and narrative. Change status to remove from view.'
                        : 'Overrides are draft only. Use the status bar above to Publish and make them live for participants.'}
                    </p>
                  </div>

                  {/* Score override */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-2" style={{ color: NAVY }}>
                      <SlidersHorizontal className="h-3 w-3" /> Score Calibration
                    </label>
                    <Input type="number" min="0" max="100" value={editScoreOverride}
                      onChange={e => setEditScoreOverride(e.target.value)}
                      placeholder={`System score: ${Math.round(Number(selected.score))}`}
                      className="h-9 text-sm mb-2" />
                    {/* Live preview */}
                    <div className="rounded-lg border p-3" style={{ borderColor: '#E5E8F0', backgroundColor: '#F8FAFF' }}>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">Impact Preview</p>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-[8px] text-gray-400 mb-0.5">System</p>
                          <p className="text-xl font-black" style={{ color: LEVEL_META[rawLevel]?.color }}>{rawScore}</p>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: LEVEL_META[rawLevel]?.bg, color: LEVEL_META[rawLevel]?.color }}>{rawLevel}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300" />
                        <div className="text-center">
                          <p className="text-[8px] text-orange-400 mb-0.5 font-semibold">Override</p>
                          {overrideScoreNum != null && overrideLevel ? (
                            <>
                              <p className="text-xl font-black" style={{ color: LEVEL_META[overrideLevel]?.color }}>{overrideScoreNum}</p>
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: LEVEL_META[overrideLevel]?.bg, color: LEVEL_META[overrideLevel]?.color }}>{overrideLevel}</span>
                              {overrideLevel !== rawLevel && (
                                <p className="text-[7.5px] text-orange-500 mt-0.5 font-semibold">Level changes!</p>
                              )}
                            </>
                          ) : (
                            <p className="text-[10px] text-gray-300 mt-1">— no override —</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Headline override */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1.5" style={{ color: NAVY }}>
                      <Zap className="h-3 w-3" /> Expert Headline
                      <span className="text-[8px] font-normal text-gray-400 normal-case ml-1">replaces computed headline</span>
                    </label>
                    <Input value={editHeadline} onChange={e => setEditHeadline(e.target.value)}
                      placeholder="e.g. Lakshman shows exceptional pattern awareness — here's what it reveals." className="h-9 text-xs" />
                  </div>

                  {/* Narrative override */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider flex items-center justify-between mb-1.5" style={{ color: NAVY }}>
                      <span className="flex items-center gap-1"><Edit3 className="h-3 w-3" /> Expert Narrative</span>
                      <span className="text-[8px] font-normal text-gray-400 normal-case">{editNarrative.length} chars</span>
                    </label>
                    <Textarea value={editNarrative} onChange={e => setEditNarrative(e.target.value)}
                      placeholder="Write the full personalised assessment narrative shown to the participant…"
                      className="text-xs resize-none" rows={5} />
                  </div>

                  {/* Override reason */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1.5" style={{ color: NAVY }}>
                      <FileText className="h-3 w-3" /> Override Reason
                      <span className="text-[8px] font-normal text-gray-400 normal-case ml-1">audit trail</span>
                    </label>
                    <Input value={editReason} onChange={e => setEditReason(e.target.value)}
                      placeholder="e.g. Score adjusted to account for environmental factors discussed in parent interview."
                      className="h-9 text-xs" />
                  </div>

                  {/* Admin notes */}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1.5" style={{ color: NAVY }}>
                      <MessageSquare className="h-3 w-3" /> Internal Notes
                      <span className="text-[8px] font-normal text-gray-400 normal-case ml-1">never shown to participant</span>
                    </label>
                    <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      placeholder="Flag for follow-up, anomaly notes, counsellor referral…" className="text-xs resize-none" rows={3} />
                  </div>

                  {/* Revert link */}
                  {(editScoreOverride || editHeadline || editNarrative) && (
                    <button onClick={() => { setEditScoreOverride(''); setEditHeadline(''); setEditNarrative(''); setEditReason(''); }}
                      className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-red-500 transition-colors">
                      <RotateCcw className="h-2.5 w-2.5" /> Clear all overrides
                    </button>
                  )}
                </div>
              )}

              {/* ── Domains ── */}
              {activeTab === 'domains' && (
                <div className="p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Subdomain Profile
                  </p>
                  {subLoading ? (
                    <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Loading…
                    </div>
                  ) : subdomains.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 text-xs">No domain data available</div>
                  ) : (
                    <>
                      {/* Strong areas */}
                      {subdomains.filter(sd => Number(sd.avg_score) >= 70).length > 0 && (
                        <div className="mb-4">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Strength Areas</p>
                          {subdomains.filter(sd => Number(sd.avg_score) >= 70).sort((a,b) => Number(b.avg_score) - Number(a.avg_score)).map(sd => {
                            const pct = Math.round(Number(sd.avg_score));
                            return (
                              <div key={sd.subdomain_name} className="mb-2">
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[10px] text-gray-700 font-medium">{sd.subdomain_name}</span>
                                  <span className="text-[10px] font-bold text-emerald-600">{pct}%</span>
                                </div>
                                <div className="h-1.5 bg-emerald-50 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Building areas */}
                      {subdomains.filter(sd => Number(sd.avg_score) < 70).length > 0 && (
                        <div className="mb-4">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-amber-600 mb-2">Growth Areas</p>
                          {subdomains.filter(sd => Number(sd.avg_score) < 70).sort((a,b) => Number(a.avg_score) - Number(b.avg_score)).map(sd => {
                            const pct = Math.round(Number(sd.avg_score));
                            const col = pct >= 50 ? '#F59E0B' : '#EF4444';
                            return (
                              <div key={sd.subdomain_name} className="mb-2">
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[10px] text-gray-700 font-medium">{sd.subdomain_name}</span>
                                  <span className="text-[10px] font-bold" style={{ color: col }}>{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${col}18` }}>
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: col }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Score Breakdown (collapsible) ── */}
                      {scoreTrace?.session && (
                        <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: '#E5E8F0' }}>
                          <button
                            onClick={() => setTraceOpen(o => !o)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-50"
                            style={{ backgroundColor: traceOpen ? `${NAVY_BG}` : 'transparent' }}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: NAVY }}>
                              <FlaskConical className="h-3 w-3" /> Score Breakdown
                            </span>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform text-gray-400 ${traceOpen ? 'rotate-90' : ''}`} />
                          </button>
                          {traceOpen && (
                            <div className="px-3 pb-3 pt-2 bg-gray-50 border-t space-y-2" style={{ borderColor: '#E5E8F0' }}>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: 'Responses', value: scoreTrace.session.total_responses },
                                  { label: 'Total Weighted', value: scoreTrace.session.total_weighted.toFixed(1) },
                                  { label: 'Max Possible', value: scoreTrace.session.max_possible },
                                ].map(({ label, value }) => (
                                  <div key={label} className="rounded-lg border bg-white p-2 text-center" style={{ borderColor: '#E5E8F0' }}>
                                    <div className="text-[13px] font-bold" style={{ color: NAVY }}>{value}</div>
                                    <div className="text-[8px] text-gray-400 mt-0.5">{label}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="rounded-lg border bg-white px-3 py-2 space-y-1" style={{ borderColor: '#E5E8F0' }}>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">Formula</p>
                                <p className="text-[9px] text-gray-600 font-mono leading-relaxed">{scoreTrace.session.formula}</p>
                              </div>
                              <div className="rounded-lg border bg-white px-3 py-2" style={{ borderColor: '#E5E8F0' }}>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Result</p>
                                <p className="text-[9px] text-gray-600 font-mono">
                                  {scoreTrace.session.total_weighted.toFixed(1)} / {scoreTrace.session.max_possible} × 100
                                  {' = '}
                                  <span className="font-bold" style={{ color: NAVY }}>{scoreTrace.session.norm_score}</span>
                                </p>
                              </div>
                              <p className="text-[8px] text-gray-400 text-right">
                                Computed {new Date(scoreTrace.computed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Audit ── */}
              {activeTab === 'audit' && (
                <div className="p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Review Timeline
                  </p>
                  <div className="relative pl-4 space-y-4">
                    {/* Timeline line */}
                    <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-100" />
                    {[
                      {
                        ts: selected.created_at, label: 'Report generated', sub: `${sm.label} stage · Score ${Math.round(Number(selected.score))} · ${normalizeLevel(selected.score_level)}`,
                        icon: FileText, color: NAVY,
                      },
                      ...(selected.reviewed_at ? [{
                        ts: selected.reviewed_at, label: 'Reviewed by admin',
                        sub: selected.reviewed_by || 'superadmin@metryx.one',
                        icon: ShieldCheck, color: '#2563EB',
                      }] : []),
                      ...(selected.score_override != null ? [{
                        ts: selected.updated_at || selected.reviewed_at || selected.created_at,
                        label: 'Score calibrated',
                        sub: `System: ${Math.round(Number(selected.score))} → Override: ${Math.round(Number(selected.score_override))} (${getLevelFromScore(Number(selected.score_override))})`,
                        icon: SlidersHorizontal, color: '#D97706',
                      }] : []),
                      ...(selected.headline_override || selected.narrative_override ? [{
                        ts: selected.updated_at || selected.created_at,
                        label: 'Narrative override applied',
                        sub: selected.override_reason || 'Expert narrative set',
                        icon: Edit3, color: '#7C3AED',
                      }] : []),
                      ...(selected.published_at ? [{
                        ts: selected.published_at, label: 'Published to participant',
                        sub: 'Overrides now live — participant sees calibrated report',
                        icon: Globe, color: '#059669',
                      }] : []),
                    ].sort((a,b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()).map(({ ts, label, sub, icon: Icon, color }, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-4 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: color }}>
                          <Icon className="h-1.5 w-1.5 text-white" />
                        </div>
                        <p className="text-[10px] font-semibold text-gray-800">{label}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>
                        <p className="text-[8px] text-gray-300 mt-0.5">{new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    ))}
                    {/* Metadata footer */}
                    <div className="rounded-lg border p-3 mt-4" style={{ borderColor: '#E5E8F0' }}>
                      {[
                        ['Report ID', selected.id.slice(0,8).toUpperCase()],
                        ['Email sent', selected.email_sent ? 'Yes' : 'No'],
                        ['Override reason', selected.override_reason || '—'],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between py-0.5">
                          <span className="text-[8.5px] text-gray-400">{l}</span>
                          <span className="text-[8.5px] font-medium text-gray-700">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save button — only on overrides tab */}
            {activeTab === 'overrides' && (
              <div className="flex-shrink-0 border-t px-4 py-3 bg-gray-50">
                <div className="flex gap-2">
                  <Button className="flex-1 h-9 text-xs font-bold text-white gap-1.5"
                    style={{ backgroundColor: NAVY }} onClick={saveContent} disabled={savingContent}>
                    {savingContent ? <><RefreshCw className="h-3 w-3 animate-spin" /> Saving…</> : <><Save className="h-3 w-3" /> Save Overrides</>}
                  </Button>
                  {editStatus !== 'published' && (
                    <Button className="h-9 px-3 text-xs font-bold gap-1.5 text-white"
                      style={{ backgroundColor: '#059669' }}
                      onClick={async () => { await saveContent(); await changeStatus('published'); }}
                      disabled={savingContent || !!savingStatus}>
                      <Globe className="h-3 w-3" /> Publish
                    </Button>
                  )}
                  {editStatus === 'published' && (
                    <Button variant="outline" className="h-9 px-3 text-xs font-bold gap-1.5 text-gray-500"
                      onClick={() => changeStatus('approved')} disabled={!!savingStatus}>
                      <RotateCcw className="h-3 w-3" /> Unpublish
                    </Button>
                  )}
                </div>
                <p className="text-center text-[8px] text-gray-400 mt-1.5">
                  {editStatus === 'published' ? '✦ Overrides are live for this participant' : 'Publish to apply overrides to participant report'}
                </p>
              </div>
            )}
          </div>
        );
      })()}
    </div>

    {/* ══ EMAIL PREVIEW MODAL ══════════════════════════════════════════════ */}
    {previewOpen && (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)' }}
      >
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10"
          style={{ backgroundColor: NAVY_DARK }}>
          <div className="flex items-center gap-3 min-w-0">
            <Mail className="h-4 w-4 text-white/60 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Email Preview</p>
              <p className="text-xs font-semibold text-white truncate max-w-[500px]">
                {previewSubject || 'Generating preview…'}
              </p>
            </div>
          </div>

          {/* Stage selector + Send + Close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wide">Stage</span>
            <div className="flex gap-1">
              {Object.entries(STAGE_META).map(([code, meta]) => (
                <button
                  key={code}
                  onClick={() => {
                    setPreviewStage(code);
                    if (previewReport) fetchPreview(previewReport.id, code);
                  }}
                  className="px-2.5 py-1 rounded-full text-[9px] font-bold transition-all"
                  style={{
                    backgroundColor: previewStage === code ? meta.color : 'rgba(255,255,255,0.08)',
                    color: previewStage === code ? '#fff' : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${previewStage === code ? meta.color : 'transparent'}`,
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>

            {/* Send Email button */}
            {(() => {
              const alreadySent = previewReport
                ? (emailSentIds.has(previewReport.id) || previewReport.email_sent)
                : false;
              return (
                <button
                  onClick={sendEmail}
                  disabled={sendingEmail || alreadySent || !previewReport?.email}
                  className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: alreadySent ? 'rgba(5,150,105,0.25)' : 'rgba(255,255,255,0.12)',
                    color: alreadySent ? '#6EE7B7' : sendingEmail ? 'rgba(255,255,255,0.5)' : '#fff',
                    border: `1px solid ${alreadySent ? 'rgba(5,150,105,0.4)' : 'rgba(255,255,255,0.18)'}`,
                  }}
                  title={!previewReport?.email ? 'No email address for this participant' : alreadySent ? 'Email already sent' : 'Send report email to participant'}
                >
                  {sendingEmail ? (
                    <><RefreshCw className="h-3 w-3 animate-spin" /> Sending…</>
                  ) : alreadySent ? (
                    <><CheckCircle className="h-3 w-3" /> Sent</>
                  ) : (
                    <><Mail className="h-3 w-3" /> Send email</>
                  )}
                </button>
              );
            })()}

            <button
              onClick={() => setPreviewOpen(false)}
              className="ml-1 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sign-off callout strip */}
        {(() => {
          const so = STAGE_SIGN_OFFS[previewStage];
          const stageMeta = STAGE_META[previewStage];
          if (!so) return null;
          return (
            <div
              className="flex-shrink-0 flex items-start gap-3 px-5 py-3 border-b"
              style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <div
                className="flex-shrink-0 mt-0.5 w-1.5 h-full rounded-full self-stretch min-h-[28px]"
                style={{ backgroundColor: stageMeta?.color ?? '#6B7280' }}
              />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Sign-off · {stageMeta?.label ?? previewStage}
                </p>
                <p className="text-[11px] leading-relaxed font-light italic" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {so.signOff}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {so.teamSignOff}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Preview body */}
        <div className="flex-1 overflow-hidden flex items-start justify-center py-6 px-4" style={{ backgroundColor: '#0F172A' }}>
          {previewLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <RefreshCw className="h-6 w-6 animate-spin mb-3" />
              <p className="text-xs">Building email preview…</p>
            </div>
          ) : previewHtml ? (
            <div className="w-full max-w-[640px] h-full rounded-xl overflow-hidden shadow-2xl">
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                style={{ minHeight: '600px', height: '100%' }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <Mail className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-xs">No preview available</p>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
