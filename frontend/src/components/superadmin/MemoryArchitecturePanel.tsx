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

export default function MemoryArchitecturePanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "episodes" | "interventions">("overview");
  const [selectedEmail, setSelectedEmail] = useState("");
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [drawerEmail, setDrawerEmail] = useState<string | null>(null);
  const [intervForm, setIntervForm] = useState({ email: "", intervention_type: "", effectiveness_rating: "", outcome_notes: "" });
  const [addingInterv, setAddingInterv] = useState(false);
  const [consolidateEmail, setConsolidateEmail] = useState("");

  const { data: dashboard } = useQuery({
    queryKey: ["memory-dashboard"],
    queryFn: () => fetch(API("/admin/memory/dashboard")).then(r => r.json()),
  });

  const consolidateAll = useMutation({
    mutationFn: () => fetch(API("/memory/consolidate-all"), { method: "POST" }).then(r => r.json()),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["memory-dashboard"] }), 3000),
  });

  const consolidateOne = useMutation({
    mutationFn: (email: string) => fetch(API("/memory/consolidate"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory-dashboard"] }),
  });

  const addIntervention = useMutation({
    mutationFn: (data: typeof intervForm) => fetch(API("/memory/intervention"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, intervention_type: data.intervention_type, effectiveness_rating: parseFloat(data.effectiveness_rating) || null, outcome_notes: data.outcome_notes }),
    }).then(r => r.json()),
    onSuccess: () => { setAddingInterv(false); setIntervForm({ email: "", intervention_type: "", effectiveness_rating: "", outcome_notes: "" }); qc.invalidateQueries({ queryKey: ["memory-dashboard"] }); },
  });

  const openProfile = async (email: string) => {
    setDrawerEmail(email);
    const d = await fetch(API(`/admin/memory/episodes/${encodeURIComponent(email)}`)).then(r => r.json());
    setProfileData(d);
  };

  const episodicKpi = dashboard?.episodic_kpi || {};
  const behaviouralKpi = dashboard?.behavioural_kpi || {};
  const interventionKpi = dashboard?.intervention_kpi || {};
  const recentEpisodes = dashboard?.recent_episodes || [];
  const topInterventions = dashboard?.top_interventions || [];
  const valenceDist = dashboard?.valence_distribution || [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <Archive className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Memory Architecture</h1>
            <p className="text-sm text-gray-500">Episodic memory, behavioural memory & intervention history — longitudinal continuity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            <input value={consolidateEmail} onChange={e => setConsolidateEmail(e.target.value)} placeholder="Consolidate email…"
              className="border border-gray-200 rounded-l-lg px-3 py-2 text-sm w-44 focus:outline-none" />
            <button onClick={() => consolidateOne.mutate(consolidateEmail)} disabled={!consolidateEmail || consolidateOne.isPending}
              className="px-3 py-2 text-white text-sm rounded-r-lg disabled:opacity-40" style={{ backgroundColor: BRAND }}>
              {consolidateOne.isPending ? "…" : "Run"}
            </button>
          </div>
          <button onClick={() => consolidateAll.mutate()} disabled={consolidateAll.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: BRAND }}>
            <RefreshCw className={`w-4 h-4 ${consolidateAll.isPending ? "animate-spin" : ""}`} />
            {consolidateAll.isPending ? "Consolidating…" : "Consolidate All"}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Episodic Memories", value: episodicKpi.total_episodes, color: BRAND },
          { label: "Memory Users", value: episodicKpi.unique_users, color: "#6366f1" },
          { label: "Positive Episodes", value: episodicKpi.positive_episodes, color: "#10b981" },
          { label: "Negative Episodes", value: episodicKpi.negative_episodes, color: "#ef4444" },
          { label: "Behavioural Keys", value: behaviouralKpi.total_keys, color: "#f59e0b" },
          { label: "Interventions Logged", value: interventionKpi.total_interventions, color: "#8b5cf6", sub: `${Math.round(Number(interventionKpi.avg_effectiveness || 0) * 100)}% avg effectiveness` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-[10px] text-gray-500 mb-1 leading-tight">{c.label}</p>
            <p className="text-xl font-bold" style={{ color: c.color }}>{c.value ?? "—"}</p>
            {c.sub && <p className="text-[10px] text-gray-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["overview", "episodes", "interventions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "overview" ? "Overview" : t === "episodes" ? "Recent Episodes" : "Interventions"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-pink-500" />Emotional Valence Distribution</h3>
            <div className="space-y-3">
              {valenceDist.map((v: Record<string, unknown>) => (
                <div key={String(v.emotional_valence)} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: VALENCE_COLORS[String(v.emotional_valence)] || "#6b7280" }} />
                  <span className="text-sm text-gray-700 w-20 capitalize">{String(v.emotional_valence)}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(v.cnt) * 15)}%`, backgroundColor: VALENCE_COLORS[String(v.emotional_valence)] || "#6b7280" }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-8 text-right">{String(v.cnt)}</span>
                </div>
              ))}
              {!valenceDist.length && <p className="text-sm text-gray-400 text-center py-8">No memory data — run Consolidate All</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Zap className="w-4 h-4" style={{ color: BRAND }} />Top Intervention Types</h3>
            <div className="space-y-2">
              {topInterventions.map((iv: Record<string, unknown>) => (
                <div key={String(iv.intervention_type)} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{String(iv.intervention_type)}</p>
                    <p className="text-xs text-gray-400">{String(iv.cnt)} logged</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: BRAND }}>{Math.round(Number(iv.avg_effectiveness || 0) * 100)}%</p>
                    <p className="text-xs text-gray-400">effectiveness</p>
                  </div>
                </div>
              ))}
              {!topInterventions.length && <p className="text-sm text-gray-400 text-center py-8">No interventions logged yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "episodes" && (
        <>
          <div className="flex gap-2 mb-3">
            <input value={selectedEmail} onChange={e => setSelectedEmail(e.target.value)} placeholder="Load episodes for email…"
              className="border border-gray-200 rounded-l-lg px-3 py-2 text-sm w-56 focus:outline-none" />
            <button onClick={() => openProfile(selectedEmail)} disabled={!selectedEmail}
              className="px-4 py-2 rounded-r-lg text-white text-sm disabled:opacity-40" style={{ backgroundColor: BRAND }}>Load</button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["User","Type","Concern","Emotional Valence","Significance","Date"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {recentEpisodes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No episodes yet — run Consolidate All</td></tr>
                ) : recentEpisodes.map((e: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => openProfile(String(e.user_email))}>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[140px] truncate">{String(e.user_email || "")}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{String(e.episode_type || "")}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{String(e.concern_name || "—")}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: `${VALENCE_COLORS[String(e.emotional_valence)] || "#6b7280"}20`, color: VALENCE_COLORS[String(e.emotional_valence)] || "#6b7280" }}>
                        {String(e.emotional_valence || "")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Number(e.significance_score || 0) * 100}%`, backgroundColor: BRAND }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(Number(e.significance_score || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(String(e.created_at)).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "interventions" && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setAddingInterv(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: BRAND }}>
              <Plus className="w-4 h-4" />Log Intervention
            </button>
          </div>
          {addingInterv && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Log New Intervention Memory</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "email", label: "User Email", placeholder: "user@example.com" },
                  { key: "intervention_type", label: "Intervention Type", placeholder: "counsellor_session, pacing_adjustment…" },
                  { key: "effectiveness_rating", label: "Effectiveness (0-1)", placeholder: "0.75" },
                  { key: "outcome_notes", label: "Outcome Notes", placeholder: "Observed improvement in…" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                    <input value={intervForm[f.key as keyof typeof intervForm]}
                      onChange={e => setIntervForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => addIntervention.mutate(intervForm)} disabled={addIntervention.isPending}
                  className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50" style={{ backgroundColor: BRAND }}>
                  {addIntervention.isPending ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setAddingInterv(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">Cancel</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["User","Intervention Type","Effectiveness","Notes","Date"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {topInterventions.length === 0
                  ? <tr><td colSpan={5} className="text-center py-12 text-gray-400">No intervention logs yet</td></tr>
                  : topInterventions.map((iv: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">Various</td>
                    <td className="px-4 py-3 text-gray-700">{String(iv.intervention_type)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold" style={{ color: BRAND }}>{Math.round(Number(iv.avg_effectiveness || 0) * 100)}%</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{String(iv.cnt)} records</td>
                    <td className="px-4 py-3 text-gray-400">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Drawer */}
      {drawerEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => { setDrawerEmail(null); setProfileData(null); }}>
          <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-900">Memory Profile</h2>
              <button onClick={() => { setDrawerEmail(null); setProfileData(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4 break-all">{drawerEmail}</p>
            {profileData ? (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Brain className="w-3.5 h-3.5" style={{ color: BRAND }} />Episodic Memories ({(profileData.episodes as unknown[])?.length || 0})</h3>
                <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
                  {((profileData.episodes as Record<string, unknown>[]) || []).map((ep, i) => {
                    const summary = ep.episode_summary as Record<string, unknown> || {};
                    return (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg border-l-2" style={{ borderColor: VALENCE_COLORS[String(ep.emotional_valence)] || "#6b7280" }}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-700 capitalize">{String(ep.episode_type)}</span>
                          <span className="text-xs" style={{ color: VALENCE_COLORS[String(ep.emotional_valence)] || "#6b7280" }}>{String(ep.emotional_valence)}</span>
                        </div>
                        {summary.concern_name && <p className="text-xs text-gray-500 mt-0.5">{String(summary.concern_name)}</p>}
                        {summary.score !== undefined && <p className="text-xs text-gray-500">Score: {String(summary.score)}</p>}
                      </div>
                    );
                  })}
                </div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Archive className="w-3.5 h-3.5 text-amber-500" />Behavioural Memory Keys ({(profileData.behavioural_keys as unknown[])?.length || 0})</h3>
                <div className="space-y-1 mb-5 max-h-40 overflow-y-auto">
                  {((profileData.behavioural_keys as Record<string, unknown>[]) || []).map((bm, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-amber-50 rounded text-xs">
                      <span className="font-medium text-amber-800">{String(bm.memory_key).replace(/_/g, " ")}</span>
                      <span className="text-amber-600">×{String(bm.reinforcement_count)}</span>
                    </div>
                  ))}
                </div>
                {(profileData.interventions as unknown[])?.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-purple-500" />Intervention History</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {((profileData.interventions as Record<string, unknown>[]) || []).map((iv, i) => (
                        <div key={i} className="p-2 bg-purple-50 rounded text-xs">
                          <span className="font-medium text-purple-800">{String(iv.intervention_type)}</span>
                          {iv.effectiveness_rating && <span className="ml-2 text-purple-600">{Math.round(Number(iv.effectiveness_rating) * 100)}% effective</span>}
                          {iv.outcome_notes && <p className="text-gray-500 mt-0.5">{String(iv.outcome_notes)}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : <p className="text-center text-gray-400 py-12">Loading memory profile…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
