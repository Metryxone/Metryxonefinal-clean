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

export default function PsychometricsPanel() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [tab, setTab] = useState<"reports" | "items">("reports");
  const [calibrating, setCalibrating] = useState(false);
  const [calResult, setCalResult] = useState<Record<string, unknown> | null>(null);
  const [calForm, setCalForm] = useState({ assessment_type: "CAPADEX", concern_name: "", stage_code: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["psychometrics-reports", page, type, tab],
    queryFn: () => fetch(API(`/admin/psychometrics/reports?page=${page}&limit=25${type ? `&type=${type}` : ""}`)).then(r => r.json()),
    enabled: tab === "reports",
  });

  const { data: itemsData } = useQuery({
    queryKey: ["irt-items", page],
    queryFn: () => fetch(API(`/admin/psychometrics/items?page=${page}&limit=50`)).then(r => r.json()),
    enabled: tab === "items",
  });

  const calibrateAll = useMutation({
    mutationFn: () => fetch(API("/psychometrics/calibrate-all"), { method: "POST" }).then(r => r.json()),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["psychometrics-reports"] }), 3000),
  });

  const calibrateOne = async () => {
    setCalibrating(true); setCalResult(null);
    try {
      const r = await fetch(API("/psychometrics/calibrate"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calForm),
      }).then(r => r.json());
      setCalResult(r);
      qc.invalidateQueries({ queryKey: ["psychometrics-reports"] });
    } finally { setCalibrating(false); }
  };

  const reports = data?.rows || [];
  const kpi = data?.kpi || {};
  const gradeDist = data?.grade_distribution || [];
  const itemStats = data?.item_stats || {};
  const items = itemsData?.rows || [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <FlaskConical className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Psychometrics Engine</h1>
            <p className="text-sm text-gray-500">IRT calibration, Cronbach Alpha, reliability/validity analysis, bias detection</p>
          </div>
        </div>
        <button onClick={() => calibrateAll.mutate()} disabled={calibrateAll.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: BRAND }}>
          <RefreshCw className={`w-4 h-4 ${calibrateAll.isPending ? "animate-spin" : ""}`} />
          {calibrateAll.isPending ? "Calibrating…" : "Calibrate All Stages"}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg Cronbach α", value: kpi.avg_alpha, color: BRAND, sub: "Reliability" },
          { label: "Avg Validity", value: kpi.avg_validity, color: "#10b981" },
          { label: "Excellent Grade", value: kpi.excellent_count, color: "#10b981", sub: `${kpi.good_count || 0} good` },
          { label: "High Bias Risk", value: kpi.high_bias_count, color: "#ef4444", sub: "items flagged" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value ?? "—"}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* On-demand calibration */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4" style={{ color: BRAND }} />Run Calibration</h3>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Assessment Type</label>
            <select value={calForm.assessment_type} onChange={e => setCalForm(f => ({ ...f, assessment_type: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              {["CAPADEX","SDI","LBI","Competency"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Stage (optional)</label>
            <select value={calForm.stage_code} onChange={e => setCalForm(f => ({ ...f, stage_code: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">All Stages</option>
              {["CAP_CUR","CAP_INS","CAP_GRW","CAP_MAS"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <button onClick={calibrateOne} disabled={calibrating}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: BRAND }}>
            {calibrating ? "Running…" : "Calibrate"}
          </button>
        </div>
        {calResult?.report && (() => {
          const r = calResult.report as Record<string, unknown>;
          const g = String(r.reliability_grade || "");
          const gc = GRADE_COLORS[g] || GRADE_COLORS.Acceptable;
          const GIcon = gc.icon;
          return (
            <div className="mt-4 p-4 rounded-xl border" style={{ backgroundColor: gc.bg, borderColor: gc.text + "30" }}>
              <div className="flex items-center gap-2 mb-2">
                <GIcon className="w-5 h-5" style={{ color: gc.text }} />
                <span className="font-semibold" style={{ color: gc.text }}>{g} Reliability</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Cronbach α</p><p className="font-bold" style={{ color: gc.text }}>{String(r.cronbach_alpha || "—")}</p></div>
                <div><p className="text-xs text-gray-500">Sample Size</p><p className="font-bold text-gray-800">{String(r.sample_size || "—")}</p></div>
                <div><p className="text-xs text-gray-500">Validity</p><p className="font-bold text-gray-800">{String(r.validity_score || "—")}</p></div>
                <div><p className="text-xs text-gray-500">Avg Difficulty</p><p className="font-bold text-gray-800">{String(r.avg_difficulty || "—")}</p></div>
                <div><p className="text-xs text-gray-500">Avg Discrimination</p><p className="font-bold text-gray-800">{String(r.avg_discrimination || "—")}</p></div>
                <div><p className="text-xs text-gray-500">Bias Risk</p><p className="font-bold" style={{ color: BIAS_COLORS[String(r.bias_risk)] || "#6b7280" }}>{String(r.bias_risk || "")}</p></div>
              </div>
            </div>
          );
        })()}
        {calResult?.error && <p className="mt-3 text-sm text-red-500">{String(calResult.error)}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["reports", "items"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "reports" ? "Reliability Reports" : "IRT Item Parameters"}
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {["Assessment","Stage","Sample","Cronbach α","Reliability","Validity","Avg Difficulty","Bias Risk"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
              : reports.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No reports yet — run calibration above</td></tr>
              : reports.map((r: Record<string, unknown>, i: number) => {
                const g = String(r.reliability_grade || "Acceptable");
                const gc = GRADE_COLORS[g] || GRADE_COLORS.Acceptable;
                const GIcon = gc.icon;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{String(r.assessment_type || "")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(r.stage_code || "—")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(r.sample_size || "")}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: gc.text }}>{String(r.cronbach_alpha || "—")}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: gc.bg, color: gc.text }}>
                        <GIcon className="w-3 h-3" />{g}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{String(r.validity_score || "—")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(r.avg_difficulty || "—")}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: BIAS_COLORS[String(r.bias_risk)] || "#6b7280" }}>{String(r.bias_risk || "")}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "items" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Items Calibrated", value: itemStats.total_items, color: BRAND },
              { label: "Avg Difficulty", value: itemStats.avg_difficulty, color: "#f59e0b" },
              { label: "Avg Discrimination", value: itemStats.avg_discrimination, color: "#10b981" },
              { label: "Total Responses", value: itemStats.total_responses, color: "#6366f1" },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className="text-xl font-bold" style={{ color: c.color }}>{c.value ?? "—"}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Item ID","Source","Difficulty b","Discrimination a","Guessing c","Responses","Confidence"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-gray-400">No IRT parameters yet — run Calibrate All Stages</td></tr>
                : items.map((item: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[120px] truncate">{String(item.item_id || "")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(item.item_source || "")}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{String(item.difficulty_param || "")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(item.discrimination_param || "")}</td>
                    <td className="px-4 py-3 text-gray-400">{String(item.guessing_param || "")}</td>
                    <td className="px-4 py-3 text-gray-600">{String(item.response_count || "")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Number(item.confidence_level || 0) * 100}%`, backgroundColor: BRAND }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(Number(item.confidence_level || 0) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
