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

export default function EthicsGovernancePanel() {
  const [tab, setTab] = useState<"overview" | "audit" | "retention">("overview");
  const [filter, setFilter] = useState({ event_type: "", actor: "", limit: "100" });

  const { data: gov, isLoading: govLoading, refetch: refetchGov } = useQuery({
    queryKey: ["audit-governance"],
    queryFn: () => fetch("/api/admin/audit/governance").then(r => r.json()),
  });

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["audit-events", filter],
    queryFn: () => {
      const qs = new URLSearchParams({
        limit: filter.limit,
        ...(filter.event_type ? { event_type: filter.event_type } : {}),
        ...(filter.actor      ? { actor: filter.actor }           : {}),
      });
      return fetch(`/api/admin/audit/events?${qs}`).then(r => r.json());
    },
    enabled: tab === "audit",
  });

  const consent   = gov?.consent   || {};
  const retention = gov?.retention  || {};
  const volume    = (gov?.event_volume || []) as Array<{ event_type: string; count: string; last_seen: string }>;

  const auditRows  = (auditData?.rows  || []) as Array<Record<string, unknown>>;
  const auditTotal = auditData?.total  ?? 0;
  const eventTypes = (auditData?.event_types || []) as Array<{ event_type: string; count: string }>;

  const DATA_POLICY = [
    { title: "Data minimisation", body: "Only concern name, age band and stage code are stored alongside session responses. No PII is required to start an assessment." },
    { title: "Consent first", body: "Before a report is saved, users are prompted for explicit consent. Withdrawal is honoured immediately — the record is soft-deleted." },
    { title: "Audit trail", body: "Every admin action that mutates a report, risk flag, or intervention is recorded in the canonical `capadex_audit_events` table with actor, timestamp and payload." },
    { title: "Score overrides tracked", body: "Any manual score override stores the reviewer identity, original score, and override reason — making changes fully reversible and explainable." },
    { title: "Retention limits (target)", body: "Responses: 24 months. Reports: 36 months. Consent records: 60 months. Audit events: 84 months. Automated purge jobs are pending configuration." },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
            <ShieldCheck className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ethics & Governance</h1>
            <p className="text-sm text-gray-500">Consent records · Audit trail · Data retention · Explainability</p>
          </div>
        </div>
        <button
          onClick={() => { refetchGov(); refetchAudit(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["overview", "audit", "retention"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "overview" ? "Overview" : t === "audit" ? "Audit Log" : "Data Retention"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {govLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading governance data…</div>
          ) : (
            <>
              {/* Consent KPIs */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Consent Records
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {kpi("Total consents", consent.total, undefined, BRAND)}
                  {kpi("Active", consent.active, "currently consented", "#10b981")}
                  {kpi("Withdrawn", consent.withdrawn, "revoked consent", "#ef4444")}
                  {kpi("Unique users", consent.unique_users, "distinct identities", ACCENT)}
                </div>
              </div>

              {/* Audit event volume */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Audit Event Volume — Last 30 Days
                </p>
                {volume.length === 0 ? (
                  <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-400">
                    No audit events recorded yet. Admin actions (report overrides, risk flag resolutions, interventions) will appear here automatically.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                    {volume.map((v, i) => {
                      const pct = Math.round((parseInt(v.count) / (volume[0] ? parseInt(volume[0].count) : 1)) * 100);
                      const color = EVENT_COLORS[v.event_type] || "#6b7280";
                      return (
                        <div key={i} className="flex items-center gap-4 px-5 py-3">
                          <div className="w-40 shrink-0">
                            <EventTypeBadge type={v.event_type} />
                          </div>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 w-10 text-right">{v.count}</span>
                          <span className="text-xs text-gray-400 w-24 text-right hidden sm:block">
                            {v.last_seen ? new Date(v.last_seen).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Data policy */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Data Policy Summary
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DATA_POLICY.map((p, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <p className="text-sm font-semibold text-gray-800 mb-1">{p.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{p.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── AUDIT LOG TAB ────────────────────────────────────────────────────── */}
      {tab === "audit" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Event type</label>
              <select
                value={filter.event_type}
                onChange={e => setFilter(f => ({ ...f, event_type: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">All types</option>
                {Object.keys(EVENT_COLORS).map(k => (
                  <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Actor</label>
              <input
                value={filter.actor}
                onChange={e => setFilter(f => ({ ...f, actor: e.target.value }))}
                placeholder="Search actor…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Limit</label>
              <select
                value={filter.limit}
                onChange={e => setFilter(f => ({ ...f, limit: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {["50","100","250","500"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Summary chips */}
          {!auditLoading && eventTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {eventTypes.slice(0, 8).map(et => (
                <button
                  key={et.event_type}
                  onClick={() => setFilter(f => ({ ...f, event_type: f.event_type === et.event_type ? "" : et.event_type }))}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${filter.event_type === et.event_type ? "border-transparent text-white" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"}`}
                  style={filter.event_type === et.event_type ? { backgroundColor: EVENT_COLORS[et.event_type] || BRAND } : {}}
                >
                  {et.event_type.replace(/_/g, " ")} <span className="opacity-70">({et.count})</span>
                </button>
              ))}
            </div>
          )}

          {auditLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading audit events…</div>
          ) : (
            <>
              <p className="text-xs text-gray-400">{auditTotal} total events matching filter</p>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["Event Type", "Actor", "User ID", "Payload Preview", "Timestamp"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-400">
                          No audit events found. Admin actions will appear here automatically once recorded.
                        </td>
                      </tr>
                    ) : auditRows.map((row, i) => {
                      let payloadStr = "—";
                      try {
                        const pl = typeof row.payload === "string" ? JSON.parse(row.payload as string) : row.payload;
                        payloadStr = Object.entries(pl as Record<string, unknown>)
                          .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                          .slice(0, 2)
                          .join(" · ");
                      } catch { /**/ }
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <EventTypeBadge type={String(row.event_type)} />
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs font-medium max-w-[120px] truncate">
                            {String(row.actor || "system")}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono max-w-[100px] truncate">
                            {row.user_id ? String(row.user_id).slice(0, 8) + "…" : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs max-w-[220px] truncate">
                            {payloadStr}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {row.created_at
                              ? new Date(String(row.created_at)).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DATA RETENTION TAB ──────────────────────────────────────────────── */}
      {tab === "retention" && (
        <div className="space-y-5">
          {govLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading data retention stats…</div>
          ) : (
            <>
              {/* Row counts */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" /> Live Table Row Counts
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {kpi("Users", retention.users, "capadex_users", BRAND)}
                  {kpi("Sessions", retention.sessions, "capadex_sessions", "#3b82f6")}
                  {kpi("Reports", retention.reports, "capadex_reports", "#8b5cf6")}
                  {kpi("Responses", retention.responses, "capadex_responses", ACCENT)}
                </div>
              </div>

              {/* Retention schedule */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Retention Schedule
                </p>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {["Table", "Data Type", "Target Retention", "Status"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { table: "capadex_responses",        type: "Assessment item responses",   retention: "24 months", status: "Pending" },
                        { table: "capadex_sessions",         type: "Assessment sessions",          retention: "36 months", status: "Pending" },
                        { table: "capadex_reports",          type: "Generated reports",            retention: "36 months", status: "Pending" },
                        { table: "capadex_users",            type: "User profiles",                retention: "60 months", status: "Pending" },
                        { table: "capadex_consent_records",  type: "Consent records",              retention: "60 months", status: "Pending" },
                        { table: "capadex_audit_events",     type: "Admin audit log",              retention: "84 months", status: "Pending" },
                        { table: "capadex_risk_flags",       type: "Risk flag history",            retention: "24 months", status: "Pending" },
                        { table: "capadex_recommendations",  type: "Recommendation outcomes",      retention: "36 months", status: "Pending" },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.table}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{row.type}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-gray-800">{row.retention}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 border border-amber-100">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Automated purge jobs require a scheduled task runner to be configured. Manual purges can be run via the database console.
                </p>
              </div>

              {/* Explainability note */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <div className="flex gap-3">
                  <FileText className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 mb-1">Explainability Layer — Active</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Every recommendation generated now includes a plain-English <strong>reasoning</strong> field (e.g. "Score of 23 in digital concern — below the 40-point threshold for structured intervention").
                      CSI negative factors include a <strong>why</strong> field explaining the subdomain's drag on the composite score.
                      All admin score overrides are stored with <strong>override_reason</strong> and indexed in the audit log.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
