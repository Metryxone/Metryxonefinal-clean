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

export default function SemanticReasoningPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "profiles" | "library">("dashboard");
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [profileChains, setProfileChains] = useState<Record<string, unknown>[] | null>(null);
  const [analyzeEmail, setAnalyzeEmail] = useState("");

  const { data: dashboard } = useQuery({
    queryKey: ["semantic-dashboard"],
    queryFn: () => fetch(API("/admin/semantic/dashboard")).then(r => r.json()),
    enabled: tab === "dashboard",
  });

  const { data: profiles } = useQuery({
    queryKey: ["semantic-profiles", page, severity, search],
    queryFn: () => fetch(API(`/admin/semantic/profiles?page=${page}&limit=25${severity ? `&severity=${severity}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`)).then(r => r.json()),
    enabled: tab === "profiles",
  });

  const { data: library } = useQuery({
    queryKey: ["semantic-library"],
    queryFn: () => fetch(API("/admin/semantic/pattern-library")).then(r => r.json()),
    enabled: tab === "library",
  });

  const analyzeAll = useMutation({
    mutationFn: () => fetch(API("/semantic/analyze-all"), { method: "POST" }).then(r => r.json()),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["semantic-dashboard", "semantic-profiles"] }), 3000),
  });

  const analyzeOne = useMutation({
    mutationFn: (email: string) => fetch(API("/semantic/analyze"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["semantic-dashboard"] }),
  });

  const openProfile = async (email: string) => {
    setSelectedEmail(email);
    const d = await fetch(API(`/admin/semantic/profiles/${encodeURIComponent(email)}`)).then(r => r.json());
    setProfileChains(d.chains || []);
  };

  const kpi = dashboard?.kpi || {};
  const topPatterns = dashboard?.top_patterns || [];
  const severityDist = dashboard?.severity_distribution || [];
  const recentChains = dashboard?.recent_chains || [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <GitBranch className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Semantic Reasoning Engine</h1>
            <p className="text-sm text-gray-500">Causal chain detection — behavioural signal → pattern → predicted outcome</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            <input value={analyzeEmail} onChange={e => setAnalyzeEmail(e.target.value)} placeholder="Analyze email…"
              className="border border-gray-200 rounded-l-lg px-3 py-2 text-sm w-44 focus:outline-none" />
            <button onClick={() => analyzeOne.mutate(analyzeEmail)} disabled={!analyzeEmail || analyzeOne.isPending}
              className="px-3 py-2 text-white text-sm rounded-r-lg disabled:opacity-40" style={{ backgroundColor: BRAND }}>
              {analyzeOne.isPending ? "…" : "Run"}
            </button>
          </div>
          <button onClick={() => analyzeAll.mutate()} disabled={analyzeAll.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: BRAND }}>
            <RefreshCw className={`w-4 h-4 ${analyzeAll.isPending ? "animate-spin" : ""}`} />
            {analyzeAll.isPending ? "Analysing…" : "Analyse All"}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Chains Detected", value: kpi.total_chains, color: BRAND },
          { label: "Affected Users", value: kpi.affected_users, color: "#6366f1" },
          { label: "Critical Chains", value: kpi.critical_chains, color: "#dc2626" },
          { label: "High-Severity", value: kpi.high_chains, color: "#ef4444", sub: `Last 7d: ${kpi.last_7d || 0}` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value ?? "—"}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["dashboard", "profiles", "library"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "dashboard" ? "Chain Analysis" : t === "profiles" ? "User Profiles" : "Pattern Library"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Top Detected Patterns</h3>
            <div className="space-y-3">
              {topPatterns.map((p: Record<string, unknown>) => (
                <div key={String(p.pattern_name)} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="text-xl">{OUTCOME_ICONS[String(p.outcome_prediction)] || "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{String(p.pattern_name || "").replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-500">→ {String(p.outcome_prediction || "").replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: SEVERITY_COLORS[String(p.severity)] || BRAND }}>{String(p.occurrences)}</p>
                    <p className="text-xs text-gray-400">hits</p>
                  </div>
                </div>
              ))}
              {!topPatterns.length && <p className="text-sm text-gray-400 text-center py-8">No patterns detected yet — run Analyse All</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Recent Causal Chains</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {recentChains.map((c: Record<string, unknown>, i: number) => {
                const chain = (c.causal_chain as unknown[]) || [];
                return (
                  <div key={i} className="p-3 rounded-lg border" style={{ borderColor: `${SEVERITY_COLORS[String(c.severity)] || "#6b7280"}30` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 truncate max-w-[140px]">{String(c.user_email || "")}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${SEVERITY_COLORS[String(c.severity)]}20`, color: SEVERITY_COLORS[String(c.severity)] }}>{String(c.severity)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(chain as string[]).map((step, j) => (
                        <span key={j} className="flex items-center gap-0.5 text-[10px] text-gray-500">
                          {j > 0 && <ChevronRight className="w-2.5 h-2.5 text-gray-300" />}
                          {step.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs mt-1" style={{ color: BRAND }}>→ {String(c.outcome_prediction || "").replace(/_/g, " ")}</p>
                  </div>
                );
              })}
              {!recentChains.length && <p className="text-sm text-gray-400 text-center py-8">No chains yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "profiles" && (
        <>
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search email…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none" />
            <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All Severities</option>
              {["critical","high","medium","low"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["User","Total Chains","Critical","High","Outcomes Detected","Last Detected"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {!profiles?.rows?.length
                  ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">No profiles yet</td></tr>
                  : (profiles.rows as Record<string, unknown>[]).map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => openProfile(String(p.user_email))}>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{String(p.user_email || "")}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: BRAND }}>{String(p.chain_count)}</td>
                    <td className="px-4 py-3 text-red-500 font-semibold">{String(p.critical_count)}</td>
                    <td className="px-4 py-3 text-orange-500 font-semibold">{String(p.high_count)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {(p.outcomes as string[] || []).filter(Boolean).map(o => o.replace(/_/g, " ")).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(String(p.last_detected)).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "library" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(library?.patterns || []).map((p: Record<string, unknown>) => {
            const chain = JSON.parse(String(p.chain_template || "[]")) as string[];
            return (
              <div key={String(p.pattern_name)} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xl mr-2">{OUTCOME_ICONS[String(p.predicted_outcome)] || "🔗"}</span>
                    <span className="font-semibold text-gray-800 capitalize">{String(p.pattern_name).replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${SEVERITY_COLORS[String(p.severity)]}20`, color: SEVERITY_COLORS[String(p.severity)] }}>{String(p.severity)}</span>
                    <span className="text-xs text-gray-400">{String(p.match_count)} hits</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap mb-3">
                  {chain.map((step, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs text-gray-600">
                      {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                      <span className="bg-gray-50 px-1.5 py-0.5 rounded">{step.replace(/_/g, " ")}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-gray-700">→ {String(p.predicted_outcome || "").replace(/_/g, " ")}</span>
                </div>
                <p className="text-xs text-gray-500 bg-blue-50 rounded p-2 border border-blue-100">
                  💡 {String(p.recommended_intervention || "")}
                </p>
              </div>
            );
          })}
          {!library?.patterns?.length && (
            <div className="col-span-2 text-center py-12 text-gray-400">Pattern library loading…</div>
          )}
        </div>
      )}

      {/* Chain detail drawer */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => { setSelectedEmail(null); setProfileChains(null); }}>
          <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-900">Semantic Chains</h2>
              <button onClick={() => { setSelectedEmail(null); setProfileChains(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4 break-all">{selectedEmail}</p>
            <div className="space-y-4">
              {(profileChains || []).map((c, i) => {
                const chain = (c.causal_chain as unknown[]) || [];
                return (
                  <div key={i} className="p-4 rounded-xl border" style={{ borderColor: `${SEVERITY_COLORS[String(c.severity)]}40` }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">{String(c.pattern_name || "").replace(/_/g, " ")}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${SEVERITY_COLORS[String(c.severity)]}20`, color: SEVERITY_COLORS[String(c.severity)] }}>{String(c.severity)}</span>
                    </div>
                    <div className="space-y-1 mb-2">
                      {(chain as string[]).map((step, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0" style={{ backgroundColor: BRAND }}>{j + 1}</span>
                          {step.replace(/_/g, " ")}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-semibold" style={{ color: SEVERITY_COLORS[String(c.severity)] }}>→ {String(c.outcome_prediction || "").replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-400 mt-1">Confidence: {Math.round(Number(c.outcome_confidence || 0) * 100)}%</p>
                  </div>
                );
              })}
              {profileChains?.length === 0 && <p className="text-center text-gray-400 py-8">No chains detected for this user yet</p>}
              {!profileChains && <p className="text-center text-gray-400 py-8">Loading…</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
