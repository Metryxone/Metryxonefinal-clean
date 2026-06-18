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
const NAVY = '#344E86';

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

export default function ROIEGovernancePanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trust' | 'fairness' | 'agents' | 'evolution' | 'events' | 'observability' | 'governance'>('dashboard');
  const [orchestrateUser, setOrchestrateUser] = useState('demo@metryx.one');
  const [orchestrateResult, setOrchestrateResult] = useState<any>(null);
  const [dispatchAgent, setDispatchAgent] = useState('risk');

  const masterDash = useQuery({ queryKey: ['roie-master'], queryFn: () => fetch('/api/admin/roie/master-dashboard').then(r => r.json()) });
  const trust = useQuery({ queryKey: ['roie-trust'], queryFn: () => fetch('/api/admin/roie/trust').then(r => r.json()), enabled: activeTab === 'trust' });
  const fairness = useQuery({ queryKey: ['roie-fairness'], queryFn: () => fetch('/api/admin/roie/fairness').then(r => r.json()), enabled: activeTab === 'fairness' });
  const agents = useQuery({ queryKey: ['roie-agents'], queryFn: () => fetch('/api/admin/roie/agents/status').then(r => r.json()), enabled: activeTab === 'agents' });
  const evolution = useQuery({ queryKey: ['roie-evolution'], queryFn: () => fetch('/api/admin/roie/evolution').then(r => r.json()), enabled: activeTab === 'evolution' });
  const events = useQuery({ queryKey: ['roie-events'], queryFn: () => fetch('/api/admin/roie/events').then(r => r.json()), enabled: activeTab === 'events' });
  const observability = useQuery({ queryKey: ['roie-observability'], queryFn: () => fetch('/api/admin/roie/observability').then(r => r.json()), enabled: activeTab === 'observability' });
  const governance = useQuery({ queryKey: ['roie-governance'], queryFn: () => fetch('/api/admin/roie/governance').then(r => r.json()), enabled: activeTab === 'governance' });

  const runFairness = useMutation({
    mutationFn: () => fetch('/api/roie/fairness/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-fairness'] }),
  });

  const assessTrust = useMutation({
    mutationFn: (userId: string) => fetch('/api/roie/trust/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-trust'] }),
  });

  const recalibrate = useMutation({
    mutationFn: () => fetch('/api/admin/roie/evolution/recalibrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-evolution'] }),
  });

  const orchestrateAll = useMutation({
    mutationFn: (userId: string) => fetch('/api/admin/roie/agents/orchestrate-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: (data) => { setOrchestrateResult(data); qc.invalidateQueries({ queryKey: ['roie-agents'] }); },
  });

  const dispatchOne = useMutation({
    mutationFn: (agent: string) => fetch('/api/admin/roie/agents/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_name: agent, user_id: orchestrateUser }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-agents'] }),
  });

  const processPending = useMutation({
    mutationFn: () => fetch('/api/admin/roie/events/process-pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-events'] }),
  });

  const tabs = [
    { id: 'dashboard', label: 'Master Dashboard', icon: Activity },
    { id: 'trust', label: 'Trust & Confidence', icon: Shield },
    { id: 'fairness', label: 'Fairness & Ethics', icon: CheckCircle },
    { id: 'agents', label: 'Multi-Agent', icon: Cpu },
    { id: 'evolution', label: 'Self-Evolving', icon: RefreshCw },
    { id: 'events', label: 'Event Orchestration', icon: Clock },
    { id: 'observability', label: 'Observability', icon: Activity },
    { id: 'governance', label: 'Governance & RBAC', icon: Shield },
  ];

  const md = masterDash.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-black" style={{ color: NAVY }}>Governance & Trust Intelligence</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Trust · Fairness · Multi-Agent Orchestration · Self-Evolving · Events · Observability · RBAC</p>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={activeTab === t.id ? { background: NAVY, color: '#fff' } : { background: '#f1f5f9', color: '#64748b' }}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      {/* ── MASTER DASHBOARD ── */}
      {activeTab === 'dashboard' && md && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Risk Profiles" value={md.risk?.total} sub={`${md.risk?.critical} critical`} color="#EF4444" />
            <KpiCard label="Opportunities" value={md.opportunity?.total} sub={`${md.opportunity?.breakthroughs} breakthroughs`} color="#10B981" />
            <KpiCard label="Open Warnings" value={md.warnings?.unacknowledged} sub={`${md.warnings?.total} total`} color="#F59E0B" />
            <KpiCard label="Active Interventions" value={md.interventions?.active} sub={`${md.interventions?.total} total`} color="#F97316" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Recovery Profiles" value={md.recovery?.total} sub={`avg momentum ${Number(md.recovery?.avg_momentum || 0).toFixed(2)}`} color="#3B82F6" />
            <KpiCard label="Events (24h)" value={md.events_24h} color="#8B5CF6" />
            <KpiCard label="Fairness Passed" value={`${md.fairness?.passed}/${md.fairness?.total}`} color="#10B981" />
            <KpiCard label="Avg Risk Score" value={md.risk?.avg_score} color="#EF4444" />
          </div>
          {/* Agent status summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-500 mb-3">ROIE Agent Constellation</p>
            <div className="flex gap-2 flex-wrap">
              {md.agents?.map((a: any) => (
                <div key={a.agent_name} className="rounded-xl border p-3 flex flex-col items-center gap-1 w-28" style={{ borderColor: `${AGENT_COLOR[a.agent_name]}30`, backgroundColor: `${AGENT_COLOR[a.agent_name]}06` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${AGENT_COLOR[a.agent_name]}15` }}>
                    <Cpu size={14} style={{ color: AGENT_COLOR[a.agent_name] }} />
                  </div>
                  <span className="text-[12px] font-bold capitalize" style={{ color: AGENT_COLOR[a.agent_name] }}>{a.agent_name}</span>
                  <Badge color={a.status === 'completed' ? '#10B981' : a.status === 'idle' ? '#6B7280' : '#F97316'}>{a.status}</Badge>
                  <span className="text-[10px] text-gray-400">{a.invocation_count} invocations</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-[12px] text-gray-400 mb-2">ROIE System Generated At</p>
            <p className="text-[14px] font-bold" style={{ color: NAVY }}>{new Date(md.generated_at).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── TRUST & CONFIDENCE ── */}
      {activeTab === 'trust' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={orchestrateUser} onChange={e => setOrchestrateUser(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52" placeholder="User email" />
            <button onClick={() => assessTrust.mutate(orchestrateUser)} disabled={assessTrust.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: NAVY }}>Assess Trust</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Assessments" value={trust.data?.kpi?.total} />
            <KpiCard label="Avg Trust" value={trust.data?.kpi?.avg_trust} color="#10B981" />
            <KpiCard label="Degrading" value={trust.data?.kpi?.degrading} color="#EF4444" />
            <KpiCard label="Avg Contradictory" value={trust.data?.kpi?.avg_contradictory} color="#F59E0B" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Trust Trend Distribution</p>
              {trust.data?.trends?.map((t: any) => (
                <div key={t.trust_trend} className="flex items-center gap-3 mb-2">
                  <span className="w-20 text-[12px] font-semibold capitalize" style={{ color: t.trust_trend === 'improving' ? '#10B981' : t.trust_trend === 'stable' ? '#6B7280' : '#EF4444' }}>{t.trust_trend}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, t.n * 15)}%`, backgroundColor: t.trust_trend === 'improving' ? '#10B981' : t.trust_trend === 'stable' ? '#6B7280' : '#EF4444' }} /></div>
                  <span className="text-[11px] text-gray-400">{t.n}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['User/Scope', 'Overall Trust', 'Prediction', 'Risk Conf', 'Opp Conf', 'Trend'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {trust.data?.rows?.slice(0, 8).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium">{r.user_id || r.scope}</td>
                      <td className="px-3 py-2 font-black text-[12px]" style={{ color: r.overall_trust > 0.82 ? '#10B981' : r.overall_trust > 0.72 ? '#F59E0B' : '#EF4444' }}>{Number(r.overall_trust).toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.prediction_confidence).toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.risk_confidence).toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.opportunity_confidence).toFixed(3)}</td>
                      <td className="px-3 py-2"><Badge color={r.trust_trend === 'improving' ? '#10B981' : r.trust_trend === 'stable' ? '#6B7280' : '#EF4444'}>{r.trust_trend}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FAIRNESS & ETHICS ── */}
      {activeTab === 'fairness' && (
        <div className="space-y-3">
          <button onClick={() => runFairness.mutate()} disabled={runFairness.isPending} className="px-4 py-2 rounded-lg text-white text-sm font-bold flex items-center gap-2" style={{ backgroundColor: NAVY }}>
            <CheckCircle size={14} />{runFairness.isPending ? 'Auditing…' : 'Run Full Fairness Audit (6 types)'}
          </button>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total Audits" value={fairness.data?.kpi?.total} />
            <KpiCard label="Passed" value={fairness.data?.kpi?.passed} color="#10B981" />
            <KpiCard label="Avg Fairness Score" value={fairness.data?.kpi?.avg_score} color="#3B82F6" />
            <KpiCard label="Dignity Violations" value={fairness.data?.kpi?.total_dignity_violations} color="#EF4444" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Audit Types</p>
              {fairness.data?.types?.map((t: any) => (
                <div key={t.audit_type} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] font-medium capitalize">{t.audit_type.replace(/_/g, ' ')}</span>
                  <div className="flex gap-2 text-[11px]">
                    <span className="text-gray-500">Score: <b>{Number(t.avg_score).toFixed(3)}</b></span>
                    {Number(t.failed) > 0 ? <Badge color="#EF4444">{t.failed} failed</Badge> : <Badge color="#10B981">all pass</Badge>}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['Type', 'Passed', 'Score', 'Bias', 'Dignity', 'Child', 'Auto-Remediated'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {fairness.data?.rows?.slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium capitalize">{r.audit_type.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2">{r.passed ? <Badge color="#10B981">Pass</Badge> : <Badge color="#EF4444">Fail</Badge>}</td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: r.fairness_score > 0.85 ? '#10B981' : '#F59E0B' }}>{Number(r.fairness_score).toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{(r.bias_detected || []).length}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{r.dignity_violations}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{r.child_protection_flags}</td>
                      <td className="px-3 py-2">{r.auto_remediated ? <Badge color="#10B981">Yes</Badge> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MULTI-AGENT ── */}
      {activeTab === 'agents' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <input value={orchestrateUser} onChange={e => setOrchestrateUser(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52" placeholder="User email (context)" />
            <select value={dispatchAgent} onChange={e => setDispatchAgent(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {['risk', 'opportunity', 'resilience', 'intervention', 'governance', 'explainability', 'recovery'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={() => dispatchOne.mutate(dispatchAgent)} disabled={dispatchOne.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: AGENT_COLOR[dispatchAgent] }}>
              {dispatchOne.isPending ? 'Dispatching…' : `Dispatch ${dispatchAgent} Agent`}
            </button>
            <button onClick={() => orchestrateAll.mutate(orchestrateUser)} disabled={orchestrateAll.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: NAVY }}>
              <Cpu size={13} className={`inline mr-1 ${orchestrateAll.isPending ? 'animate-spin' : ''}`} />
              {orchestrateAll.isPending ? 'Orchestrating…' : 'Orchestrate All 7 Agents'}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {agents.data?.agents?.map((a: any) => (
              <div key={a.agent_name} className="bg-white rounded-xl border p-4" style={{ borderColor: `${AGENT_COLOR[a.agent_name]}30` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${AGENT_COLOR[a.agent_name]}15` }}>
                    <Cpu size={14} style={{ color: AGENT_COLOR[a.agent_name] }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold capitalize" style={{ color: AGENT_COLOR[a.agent_name] }}>{a.agent_name}</p>
                    <Badge color={a.status === 'completed' ? '#10B981' : '#6B7280'}>{a.status}</Badge>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">Invocations: {a.invocation_count}</p>
                <p className="text-[11px] text-gray-400">Avg latency: {Number(a.avg_latency_ms || 0).toFixed(0)}ms</p>
                {a.last_reasoning?.conclusion && <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{a.last_reasoning.conclusion.substring(0, 80)}…</p>}
              </div>
            ))}
          </div>

          {orchestrateResult && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-bold" style={{ color: NAVY }}>Orchestration Result — {orchestrateResult.total_latency_ms}ms</p>
                <Badge color="#10B981">7 agents completed</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg p-3 bg-gray-50">
                  <p className="text-[11px] text-gray-400 font-bold mb-1">SHARED INTELLIGENCE</p>
                  <p className="text-[12px] text-gray-700">Risk Tier: <b>{orchestrateResult.shared_memory?.consensus_risk_tier}</b></p>
                  <p className="text-[12px] text-gray-700">Top Opportunity: <b>{orchestrateResult.shared_memory?.top_opportunity}</b></p>
                  <p className="text-[12px] text-gray-700">Recommended Intervention: <b>{orchestrateResult.shared_memory?.recommended_intervention}</b></p>
                  <p className="text-[12px] text-gray-700">Avg Confidence: <b>{Number(orchestrateResult.shared_memory?.confidence_mean || 0).toFixed(3)}</b></p>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(orchestrateResult.agents || {}).map(([name, result]: [string, any]) => (
                    <div key={name} className="rounded-lg p-2 border" style={{ borderColor: `${AGENT_COLOR[name]}20`, backgroundColor: `${AGENT_COLOR[name]}06` }}>
                      <span className="text-[11px] font-bold capitalize" style={{ color: AGENT_COLOR[name] }}>{name}:</span>
                      <span className="text-[11px] text-gray-600 ml-1">{result.conclusion?.substring(0, 60)}…</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SELF-EVOLVING ── */}
      {activeTab === 'evolution' && (
        <div className="space-y-3">
          <button onClick={() => recalibrate.mutate()} disabled={recalibrate.isPending} className="px-4 py-2 rounded-lg text-white text-sm font-bold flex items-center gap-2" style={{ backgroundColor: NAVY }}>
            <RefreshCw size={14} className={recalibrate.isPending ? 'animate-spin' : ''} />
            {recalibrate.isPending ? 'Recalibrating…' : 'Trigger Autonomous Recalibration'}
          </button>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Evolution Cycles" value={evolution.data?.kpi?.total} />
            <KpiCard label="Autonomous" value={evolution.data?.kpi?.autonomous} color="#8B5CF6" />
            <KpiCard label="Avg Improvement Delta" value={evolution.data?.kpi?.avg_improvement} color="#10B981" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Evolution Types</p>
              {evolution.data?.types?.map((t: any) => (
                <div key={t.evolution_type} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] font-medium capitalize">{t.evolution_type.replace(/_/g, ' ')}</span>
                  <div className="flex gap-2 text-[11px]">
                    <span className="text-gray-500">{t.n} cycles</span>
                    <span className="font-bold" style={{ color: '#10B981' }}>Δ+{Number(t.avg_delta).toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['Type', 'Trigger', 'Improvement', 'Auto', 'Logged'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {evolution.data?.rows?.map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium capitalize">{r.evolution_type.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-gray-500 text-[11px]">{r.trigger_event}</td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: '#10B981' }}>Δ+{Number(r.improvement_delta).toFixed(3)}</td>
                      <td className="px-3 py-2">{r.autonomous ? <Badge color="#8B5CF6">Auto</Badge> : <Badge color="#6B7280">Manual</Badge>}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-400">{new Date(r.logged_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EVENTS ── */}
      {activeTab === 'events' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => processPending.mutate()} disabled={processPending.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: NAVY }}>
              {processPending.isPending ? 'Processing…' : 'Process All Pending Events'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Total Events" value={events.data?.kpi?.total} />
            <KpiCard label="Pending" value={events.data?.kpi?.pending} color="#F59E0B" />
            <KpiCard label="Event Types" value={events.data?.kpi?.event_types} color={NAVY} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Event Type Distribution</p>
              {events.data?.types?.map((t: any) => (
                <div key={t.event_type} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[12px] font-mono font-semibold" style={{ color: NAVY }}>{t.event_type}</span>
                  <Badge color={NAVY}>{t.n}</Badge>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['Event Type', 'User', 'Processed', 'Emitted'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {events.data?.events?.slice(0, 10).map((e: any) => (
                    <tr key={e.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 font-mono text-[11px]" style={{ color: NAVY }}>{e.event_type}</td>
                      <td className="px-3 py-2 text-[11px]">{e.user_id || '—'}</td>
                      <td className="px-3 py-2">{e.processed ? <Badge color="#10B981">Yes</Badge> : <Badge color="#F59E0B">Pending</Badge>}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-400">{new Date(e.emitted_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── OBSERVABILITY ── */}
      {activeTab === 'observability' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Active Risks" value={observability.data?.system_health?.active_risks} color="#EF4444" />
            <KpiCard label="Critical Risks" value={observability.data?.system_health?.critical_risks} color="#EF4444" />
            <KpiCard label="Open Warnings" value={observability.data?.system_health?.open_warnings} color="#F59E0B" />
            <KpiCard label="Events (24h)" value={observability.data?.system_health?.events_24h} color="#8B5CF6" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-500 mb-3">Metric Types</p>
            <div className="space-y-2">
              {observability.data?.metric_types?.map((t: any) => (
                <div key={t.metric_type} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] font-medium capitalize">{t.metric_type.replace(/_/g, ' ')}</span>
                  <div className="flex gap-3 text-[11px]">
                    <span className="text-gray-500">{t.n} records</span>
                    <span className="font-bold" style={{ color: NAVY }}>{t.avg_value ? Number(t.avg_value).toFixed(2) : '—'}</span>
                  </div>
                </div>
              ))}
              {!observability.data?.metric_types?.length && <p className="text-gray-400 text-[13px]">No custom metrics recorded yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── GOVERNANCE ── */}
      {activeTab === 'governance' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Log Entries" value={governance.data?.kpi?.total} />
            <KpiCard label="Denied" value={governance.data?.kpi?.denied} color="#EF4444" />
            <KpiCard label="Escalated" value={governance.data?.kpi?.escalated} color="#F97316" />
            <KpiCard label="Actors" value={governance.data?.kpi?.actors} color={NAVY} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Top Actions</p>
              {governance.data?.actions?.map((a: any) => (
                <div key={a.action} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] font-mono font-medium" style={{ color: NAVY }}>{a.action}</span>
                  <Badge color={NAVY}>{a.n}</Badge>
                </div>
              ))}
              {!governance.data?.actions?.length && <p className="text-gray-400 text-[13px]">No governance events yet.</p>}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['Actor', 'Action', 'Resource', 'Role', 'Decision', 'Logged'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {governance.data?.rows?.slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium">{r.actor_id || 'system'}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.action}</td>
                      <td className="px-3 py-2 text-gray-500 text-[11px]">{r.resource || '—'}</td>
                      <td className="px-3 py-2 text-[11px]"><Badge color={NAVY}>{r.rbac_role}</Badge></td>
                      <td className="px-3 py-2">{r.decision === 'allow' ? <Badge color="#10B981">allow</Badge> : r.decision === 'deny' ? <Badge color="#EF4444">deny</Badge> : <Badge color="#F97316">escalate</Badge>}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-400">{new Date(r.logged_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
