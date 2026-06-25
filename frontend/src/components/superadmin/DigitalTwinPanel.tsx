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

export default function DigitalTwinPanel() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [drawerData, setDrawerData] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["twins", page, search, stage],
    queryFn: () => fetch(API(`/admin/twins?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}${stage ? `&stage=${stage}` : ""}`)).then(r => r.json()),
  });

  const { data: analytics } = useQuery({
    queryKey: ["twins-analytics"],
    queryFn: () => fetch(API("/admin/twins/analytics")).then(r => r.json()),
  });

  const synthAll = useMutation({
    mutationFn: () => fetch(API("/twin/synthesize-all"), { method: "POST" }).then(r => r.json()),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["twins"] }), 3000),
  });

  const openDrawer = async (email: string) => {
    setSelected({ user_email: email });
    const d = await fetch(API(`/admin/twins/${encodeURIComponent(email)}`)).then(r => r.json());
    setDrawerData(d);
  };

  const rows = data?.rows || [];
  const kpi = data?.kpi || {};
  const stageDist = data?.stage_distribution || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <Cpu className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Human Digital Twin Engine</h1>
            <p className="text-sm text-gray-500">Synthesized evolving developmental model — CSI + LBI + Cognitive + Emotional + Behavioural</p>
          </div>
        </div>
        <button onClick={() => synthAll.mutate()} disabled={synthAll.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND }}>
          <RefreshCw className={`w-4 h-4 ${synthAll.isPending ? "animate-spin" : ""}`} />
          {synthAll.isPending ? "Synthesising..." : "Synthesise All"}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Twins", value: kpi.total, color: BRAND },
          { label: "Avg HIS Score", value: kpi.avg_his, color: "#8b5cf6", sub: "Human Intelligence Score" },
          { label: "Avg CSI", value: kpi.avg_csi, color: "#10b981" },
          { label: "Advanced Twins", value: kpi.advanced_count, color: "#6366f1", sub: `${kpi.low_count || 0} need support` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value ?? "—"}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Stage Distribution */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: BRAND }} /> Developmental Stage Distribution
        </h3>
        <div className="flex gap-4 flex-wrap">
          {stageDist.map((s: Record<string, unknown>) => (
            <div key={String(s.developmental_stage)} className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: STAGE_COLORS[String(s.developmental_stage)] || "#6b7280" }}>
                {String(s.cnt)}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 capitalize">{String(s.developmental_stage)}</p>
                <p className="text-xs text-gray-400">avg {String(s.avg_his || "—")}</p>
              </div>
            </div>
          ))}
          {!stageDist.length && <p className="text-sm text-gray-400 py-2">No twins synthesised yet — click Synthesise All</p>}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search email…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none" />
        <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Stages</option>
          {["forming","emerging","developing","proficient","advanced"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            {["User", "HIS", "CSI", "LBI", "Cognitive", "Emotional", "Behavioural", "Stage", "Version"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">No twins yet — click "Synthesise All"</td></tr>
            ) : rows.map((r: Record<string, unknown>, i: number) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => openDrawer(String(r.user_email))}>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[150px] truncate">{String(r.user_email || "")}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-base" style={{ color: "#8b5cf6" }}>{Math.round(Number(r.human_intelligence_score) || 0)}</span>
                </td>
                {["csi_score","lbi_score","cognitive_score","emotional_score","behavioural_score"].map(key => (
                  <td key={key} className="px-4 py-3 text-gray-600">{Math.round(Number(r[key]) || 0)}</td>
                ))}
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: `${STAGE_COLORS[String(r.developmental_stage)] || "#6b7280"}20`, color: STAGE_COLORS[String(r.developmental_stage)] || "#6b7280" }}>
                    {String(r.developmental_stage || "")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">v{String(r.twin_version || 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{total} twins</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
          <span className="px-3 py-1">Page {page}</span>
          <button disabled={rows.length < 25} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      </div>

      {/* Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => { setSelected(null); setDrawerData(null); }}>
          <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-900">Digital Twin Profile</h2>
              <button onClick={() => { setSelected(null); setDrawerData(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4 break-all">{String(selected.user_email || "")}</p>
            {drawerData?.twin ? (() => {
              const twin = drawerData.twin as Record<string, unknown>;
              const hist = (drawerData.history as Record<string, unknown>[]) || [];
              return (
                <>
                  <HISMeter score={Number(twin.human_intelligence_score) || 0} />
                  <div className="mt-4 space-y-1">
                    <DimBar label="CSI Score" value={Number(twin.csi_score)||0} icon={TrendingUp} color="#10b981" />
                    <DimBar label="LBI Score" value={Number(twin.lbi_score)||0} icon={Zap} color={BRAND} />
                    <DimBar label="Cognitive" value={Number(twin.cognitive_score)||0} icon={Brain} color="#6366f1" />
                    <DimBar label="Emotional" value={Number(twin.emotional_score)||0} icon={Heart} color="#ec4899" />
                    <DimBar label="Behavioural" value={Number(twin.behavioural_score)||0} icon={Users} color="#f59e0b" />
                  </div>
                  <div className="mt-4 p-3 rounded-lg text-center" style={{ backgroundColor: `${STAGE_COLORS[String(twin.developmental_stage)] || "#6b7280"}15` }}>
                    <p className="text-xs text-gray-500">Stage</p>
                    <p className="font-bold capitalize" style={{ color: STAGE_COLORS[String(twin.developmental_stage)] || "#6b7280" }}>{String(twin.developmental_stage || "forming")}</p>
                    <p className="text-xs text-gray-400 mt-1">v{String(twin.twin_version || 1)} · responsiveness {Math.round(Number(twin.intervention_responsiveness || 0) * 100)}%</p>
                  </div>
                  {hist.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">HIS Trajectory</p>
                      <div className="flex items-end gap-1 h-16">
                        {hist.slice().reverse().map((h, i) => {
                          const v = Number(h.human_intelligence_score) || 0;
                          return <div key={i} className="flex-1 rounded-t" title={`${v}`} style={{ height: `${Math.max(4, v)}%`, backgroundColor: BRAND, opacity: 0.6 + (i / hist.length) * 0.4 }} />;
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })() : <p className="text-center text-gray-400 py-12">Loading twin data…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
