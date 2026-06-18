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

export default function FairnessPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "reports" | "biases">("overview");
  const [driftOnly, setDriftOnly] = useState(false);
  const [scope, setScope] = useState("");
  const [resolving, setResolving] = useState<number | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["fairness-dashboard"],
    queryFn: () => fetch(API("/admin/fairness/dashboard")).then(r => r.json()),
  });

  const { data: reports } = useQuery({
    queryKey: ["fairness-reports", scope, driftOnly],
    queryFn: () => fetch(API(`/admin/fairness/reports?limit=100${scope ? `&scope=${scope}` : ""}${driftOnly ? "&drift=true" : ""}`)).then(r => r.json()),
    enabled: tab === "reports",
  });

  const { data: biasData } = useQuery({
    queryKey: ["fairness-biases", tab],
    queryFn: () => fetch(API("/admin/fairness/biases?resolved=false")).then(r => r.json()),
    enabled: tab === "biases",
  });

  const runAnalysis = useMutation({
    mutationFn: () => fetch(API("/fairness/analyze"), { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fairness-dashboard"] });
      qc.invalidateQueries({ queryKey: ["fairness-reports"] });
      qc.invalidateQueries({ queryKey: ["fairness-biases"] });
    },
  });

  const resolveBias = useMutation({
    mutationFn: (id: number) => fetch(API(`/admin/fairness/biases/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved: true }) }).then(r => r.json()),
    onSuccess: () => { setResolving(null); qc.invalidateQueries({ queryKey: ["fairness-biases"] }); },
  });

  const fairnessKpi = dashboard?.fairness_kpi || {};
  const biasKpi = dashboard?.bias_kpi || {};
  const driftReports = dashboard?.drift_reports || [];
  const biasByType = dashboard?.bias_by_type || [];
  const severityDist = dashboard?.severity_distribution || [];
  const recentBiases = dashboard?.recent_biases || [];

  // Group reports by metric type for display
  const ageBandReports = (reports?.rows || []).filter((r: Record<string, unknown>) => r.scope === "age_band" && r.metric_type === "avg_score");
  const stageReports = (reports?.rows || []).filter((r: Record<string, unknown>) => r.scope === "stage");

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <Scale className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fairness & Bias Engine</h1>
            <p className="text-sm text-gray-500">Demographic fairness analysis, IRT bias detection, scoring drift & equity monitoring</p>
          </div>
        </div>
        <button onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND }}>
          <RefreshCw className={`w-4 h-4 ${runAnalysis.isPending ? "animate-spin" : ""}`} />
          {runAnalysis.isPending ? "Analysing…" : "Run Fairness Analysis"}
        </button>
      </div>

      {runAnalysis.data?.message && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">{runAnalysis.data.message}</div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Reports Generated", value: fairnessKpi.total_reports, color: BRAND },
          { label: "Drift Detected", value: fairnessKpi.drift_count, color: "#f59e0b", sub: `${fairnessKpi.severe_count || 0} severe` },
          { label: "Bias Detections", value: biasKpi.total, color: "#ef4444", sub: `${biasKpi.unresolved || 0} unresolved` },
          { label: "High-Severity Biases", value: biasKpi.high_severity, color: "#dc2626", sub: `${biasKpi.medium_severity || 0} medium` },
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
        {(["overview", "reports", "biases"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "overview" ? "Overview" : t === "reports" ? "Fairness Reports" : "Bias Detections"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Severity Distribution</h3>
            <div className="space-y-2">
              {severityDist.map((s: Record<string, unknown>) => (
                <div key={String(s.severity)} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[String(s.severity)] || "#6b7280" }} />
                  <span className="text-sm text-gray-700 w-20 capitalize">{String(s.severity)}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(s.cnt) * 20)}%`, backgroundColor: SEVERITY_COLORS[String(s.severity)] || "#6b7280" }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-8 text-right">{String(s.cnt)}</span>
                </div>
              ))}
              {!severityDist.length && <p className="text-sm text-gray-400 text-center py-6">Run analysis to populate</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Active Bias Types</h3>
            <div className="space-y-2">
              {biasByType.map((b: Record<string, unknown>) => (
                <div key={String(b.bias_type)} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: `${BIAS_SEV_COLORS[String(b.max_severity)] || "#6b7280"}10` }}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{String(b.bias_type).replace(/_/g, " ")}</p>
                    <p className="text-xs text-gray-500">{String(b.cnt)} detections</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded capitalize" style={{ backgroundColor: `${BIAS_SEV_COLORS[String(b.max_severity)]}20`, color: BIAS_SEV_COLORS[String(b.max_severity)] || "#6b7280" }}>{String(b.max_severity)}</span>
                </div>
              ))}
              {!biasByType.length && <p className="text-sm text-gray-400 text-center py-6">No active biases detected</p>}
            </div>
          </div>

          {driftReports.length > 0 && (
            <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm border border-amber-200">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />Drift Detected ({driftReports.length} reports)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {driftReports.slice(0, 6).map((r: Record<string, unknown>, i: number) => (
                  <div key={i} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-amber-800 capitalize">{String(r.scope)} — {String(r.group_label)}</span>
                      <span className="text-xs text-amber-600">{String(r.metric_type).replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-900">{Math.round(Number(r.metric_value) * 10) / 10}</span>
                      <span className="text-xs text-amber-600">vs {Math.round(Number(r.global_baseline) * 10) / 10} baseline</span>
                      <span className="text-xs font-medium ml-auto" style={{ color: Math.abs(Number(r.deviation_pct)) > 15 ? "#ef4444" : "#f59e0b" }}>
                        {Number(r.deviation_pct) >= 0 ? "+" : ""}{Math.round(Number(r.deviation_pct) * 10) / 10}%
                      </span>
                    </div>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: `${SEVERITY_COLORS[String(r.severity)]}20`, color: SEVERITY_COLORS[String(r.severity)] }}>{String(r.severity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <>
          <div className="flex gap-3 mb-3">
            <select value={scope} onChange={e => setScope(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All Scopes</option>
              {["age_band","stage","global"].map(v => <option key={v}>{v}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={driftOnly} onChange={e => setDriftOnly(e.target.checked)} className="rounded" />
              Drift only
            </label>
          </div>

          {ageBandReports.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Age Band Score Fairness</h3>
              {ageBandReports.map((r: Record<string, unknown>) => (
                <FairnessBar key={String(r.group_label)} group={`Age Band ${r.group_label}`}
                  value={Number(r.metric_value)} baseline={Number(r.global_baseline)} />
              ))}
            </div>
          )}

          {stageReports.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Stage Score Fairness</h3>
              {stageReports.map((r: Record<string, unknown>) => (
                <FairnessBar key={String(r.group_label)} group={String(r.group_label)}
                  value={Number(r.metric_value)} baseline={Number(r.global_baseline)} />
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Scope","Group","Metric","Value","Baseline","Deviation","Drift","Severity"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {!(reports?.rows?.length) ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Run Fairness Analysis to populate</td></tr>
                : (reports.rows as Record<string, unknown>[]).map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 capitalize text-gray-700">{String(r.scope)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{String(r.group_label || "global")}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{String(r.metric_type).replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{Math.round(Number(r.metric_value) * 10) / 10}</td>
                    <td className="px-4 py-3 text-gray-500">{Math.round(Number(r.global_baseline) * 10) / 10}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: Math.abs(Number(r.deviation_pct)) > 10 ? "#ef4444" : "#10b981" }}>
                      {Number(r.deviation_pct) >= 0 ? "+" : ""}{Math.round(Number(r.deviation_pct) * 10) / 10}%
                    </td>
                    <td className="px-4 py-3">
                      {r.drift_detected ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${SEVERITY_COLORS[String(r.severity)]}20`, color: SEVERITY_COLORS[String(r.severity)] }}>{String(r.severity)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "biases" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {["Model","Bias Type","Affected Group","Severity","Z-Score","Recommendation","Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {!(biasData?.biases?.length) ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">No active bias detections — run analysis</td></tr>
              : (biasData.biases as Record<string, unknown>[]).map((b, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-700">{String(b.model_type)}</td>
                  <td className="px-4 py-3 text-gray-600">{String(b.bias_type).replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-gray-500">{String(b.affected_group)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${BIAS_SEV_COLORS[String(b.severity)]}20`, color: BIAS_SEV_COLORS[String(b.severity)] }}>{String(b.severity)}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{String(b.z_score)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">{String(b.recommendation || "—")}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => resolveBias.mutate(Number(b.id))} disabled={resolving === Number(b.id) || resolveBias.isPending}
                      className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40">
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
