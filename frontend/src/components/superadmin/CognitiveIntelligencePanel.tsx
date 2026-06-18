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

export default function CognitiveIntelligencePanel() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [overload, setOverload] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"profiles" | "states" | "meta">("profiles");

  const { data, isLoading } = useQuery({
    queryKey: ["cognitive-profiles", page, search, overload],
    queryFn: () => fetch(API(`/admin/cognitive/profiles?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}${overload ? `&overload=${overload}` : ""}`)).then(r => r.json()),
  });

  const { data: statesData } = useQuery({
    queryKey: ["human-states"],
    queryFn: () => fetch(API("/admin/cognitive/states?days=7")).then(r => r.json()),
    enabled: tab === "states",
  });

  const computeAll = useMutation({
    mutationFn: () => fetch(API("/cognitive/compute-all"), { method: "POST" }).then(r => r.json()),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["cognitive-profiles"] }), 3000),
  });

  const computeOne = useMutation({
    mutationFn: (email: string) => fetch(API("/cognitive/compute"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cognitive-profiles"] }),
  });

  const profiles = data?.rows || [];
  const kpi = data?.kpi || {};
  const metaStyles = data?.meta_styles || [];
  const recentStates = data?.recent_states || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <Brain className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cognitive Intelligence Engine</h1>
            <p className="text-sm text-gray-500">Working memory, attention, cognitive flexibility, human state & meta-learning profiles</p>
          </div>
        </div>
        <button onClick={() => computeAll.mutate()} disabled={computeAll.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND }}>
          <RefreshCw className={`w-4 h-4 ${computeAll.isPending ? "animate-spin" : ""}`} />
          {computeAll.isPending ? "Computing..." : "Compute All"}
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Avg Cognitive Score" value={kpi.avg_cognitive} color={BRAND} />
        <KpiCard label="Avg Working Memory" value={kpi.avg_wm} color="#6366f1" />
        <KpiCard label="Avg Attention Stability" value={kpi.avg_attention} color="#10b981" />
        <KpiCard label="Critical Overload" value={kpi.critical_overload} color="#ef4444" sub={`+ ${kpi.high_overload || 0} high`} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["profiles", "states", "meta"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "profiles" ? "Cognitive Profiles" : t === "states" ? "Human States" : "Meta-Learning"}
          </button>
        ))}
      </div>

      {tab === "profiles" && (
        <>
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search email…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2" style={{ "--tw-ring-color": BRAND } as React.CSSProperties} />
            <select value={overload} onChange={e => { setOverload(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All Overload Levels</option>
              {["low","medium","high","critical"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["User", "Cognitive Score", "Working Memory", "Attention", "Overload Risk", "Reasoning Style", "Meta-Style", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : profiles.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    No profiles yet — click "Compute All" to generate
                  </td></tr>
                ) : profiles.map((p: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelected(p)}>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{String(p.user_email || "")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Number(p.composite_cognitive_score) || 0}%`, backgroundColor: BRAND }} /></div>
                        <span className="font-semibold" style={{ color: BRAND }}>{Math.round(Number(p.composite_cognitive_score) || 0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{Math.round(Number(p.working_memory_score) || 0)}</td>
                    <td className="px-4 py-3 text-gray-600">{Math.round(Number(p.attention_stability) || 0)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${OVERLOAD_COLORS[String(p.overload_risk) || "low"]}20`, color: OVERLOAD_COLORS[String(p.overload_risk) || "low"] }}>
                        {String(p.overload_risk || "low")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{String(p.reasoning_style || "")}</td>
                    <td className="px-4 py-3">
                      {p.primary_style && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${STYLE_COLORS[String(p.primary_style)] || "#6366f1"}20`, color: STYLE_COLORS[String(p.primary_style)] || "#6366f1" }}>
                          {String(p.primary_style).replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); computeOne.mutate(String(p.user_email)); }}
                        className="text-gray-400 hover:text-gray-600"><RefreshCw className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{total} profiles</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
              <span className="px-3 py-1">Page {page}</span>
              <button disabled={profiles.length < 25} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}

      {tab === "states" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" style={{ color: BRAND }} />Human State Distribution (Last 7 Days)</h3>
            <div className="space-y-3">
              {(statesData?.distribution || []).map((s: Record<string, unknown>) => (
                <div key={String(s.state_type)} className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: STATE_COLORS[String(s.state_type)] || "#6b7280" }} />
                  <span className="text-sm text-gray-700 capitalize w-28">{String(s.state_type)}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(s.cnt) * 20)}%`, backgroundColor: STATE_COLORS[String(s.state_type)] || "#6b7280" }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-8 text-right">{String(s.cnt)}</span>
                </div>
              ))}
              {(!statesData?.distribution?.length) && <p className="text-sm text-gray-400 text-center py-8">No state data yet — run Compute All first</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Zap className="w-4 h-4" style={{ color: BRAND }} />Recent State Detections</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(statesData?.recent || []).slice(0, 20).map((s: Record<string, unknown>, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATE_COLORS[String(s.state_type)] || "#6b7280" }} />
                  <span className="text-xs font-medium text-gray-800 capitalize w-20">{String(s.state_type)}</span>
                  <span className="text-xs text-gray-500 flex-1 truncate">{String(s.user_email || "")}</span>
                  <span className="text-xs text-gray-400">{String(Math.round(Number(s.confidence) * 100))}%</span>
                </div>
              ))}
              {(!statesData?.recent?.length) && <p className="text-sm text-gray-400 text-center py-8">No state detections yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "meta" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" style={{ color: BRAND }} />Learning Style Distribution</h3>
            <div className="space-y-3">
              {metaStyles.map((s: Record<string, unknown>) => (
                <div key={String(s.primary_style)} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STYLE_COLORS[String(s.primary_style)] || "#6366f1" }} />
                  <span className="text-sm text-gray-700 w-32 capitalize">{String(s.primary_style).replace("_", " ")}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(s.cnt) * 25)}%`, backgroundColor: STYLE_COLORS[String(s.primary_style)] || "#6366f1" }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{String(s.cnt)}</span>
                </div>
              ))}
              {!metaStyles.length && <p className="text-sm text-gray-400 text-center py-8">No meta-learning profiles yet — run Compute All first</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Layers className="w-4 h-4" style={{ color: BRAND }} />Meta-Learning Insights</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="font-semibold text-indigo-700 mb-1">Exploratory Learners</p>
                <p>Thrive with varied concerns, need moderate challenge, prefer immediate feedback</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="font-semibold text-green-700 mb-1">Reflective Learners</p>
                <p>Need longer sessions, benefit from guided pacing, prefer detailed delayed feedback</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="font-semibold text-amber-700 mb-1">Challenge-Driven Learners</p>
                <p>Fast-paced, intensive sessions, reward-based progression</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="font-semibold text-blue-700 mb-1">Visual Learners</p>
                <p>Short focused bursts, high engagement on fewer topics</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-gray-900">Cognitive Profile</h2>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4 break-all">{String(selected.user_email || "")}</p>
            <div className="p-4 rounded-xl mb-4 text-center" style={{ backgroundColor: `${BRAND}10` }}>
              <p className="text-4xl font-bold mb-1" style={{ color: BRAND }}>{Math.round(Number(selected.composite_cognitive_score) || 0)}</p>
              <p className="text-sm text-gray-500">Composite Cognitive Score</p>
            </div>
            <div className="space-y-1 mb-5">
              <ScoreBar label="Working Memory" value={Number(selected.working_memory_score) || 0} color="#6366f1" />
              <ScoreBar label="Attention Stability" value={Number(selected.attention_stability) || 0} color="#10b981" />
              <ScoreBar label="Cognitive Flexibility" value={Number(selected.cognitive_flexibility) || 0} color="#f59e0b" />
              <ScoreBar label="Processing Depth" value={Number(selected.processing_depth) || 0} color={BRAND} />
              <ScoreBar label="Metacognition" value={Number(selected.metacognition_score) || 0} color="#8b5cf6" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-gray-50 text-center">
                <p className="text-xs text-gray-500">Reasoning Style</p>
                <p className="font-semibold text-gray-800 capitalize">{String(selected.reasoning_style || "")}</p>
              </div>
              <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${OVERLOAD_COLORS[String(selected.overload_risk) || "low"]}15` }}>
                <p className="text-xs text-gray-500">Overload Risk</p>
                <p className="font-semibold capitalize" style={{ color: OVERLOAD_COLORS[String(selected.overload_risk) || "low"] }}>{String(selected.overload_risk || "low")}</p>
              </div>
            </div>
            {selected.primary_style && (
              <div className="p-3 rounded-lg border mb-4" style={{ borderColor: STYLE_COLORS[String(selected.primary_style)] + "40", backgroundColor: STYLE_COLORS[String(selected.primary_style)] + "10" }}>
                <p className="text-xs text-gray-500 mb-1">Meta-Learning Style</p>
                <p className="font-semibold capitalize" style={{ color: STYLE_COLORS[String(selected.primary_style)] }}>{String(selected.primary_style).replace("_", " ")}</p>
                {selected.secondary_style && <p className="text-xs text-gray-500 mt-1">Secondary: {String(selected.secondary_style).replace("_", " ")}</p>}
                {selected.pacing && <p className="text-xs text-gray-500">Pacing: {String(selected.pacing).replace("_", " ")} · Difficulty: {String(selected.optimal_difficulty || "")}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
