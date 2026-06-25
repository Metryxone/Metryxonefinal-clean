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
const NAVY = '#344E86';


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

export default function ROIERiskPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'cascading' | 'compound' | 'behavioural' | 'cognitive' | 'emotional' | 'warnings' | 'states' | 'environmental'>('overview');
  const [drawer, setDrawer] = useState<any>(null);
  const [computeUser, setComputeUser] = useState('demo@metryx.one');

  const riskDash = useQuery({ queryKey: ['roie-risk-dash'], queryFn: () => fetch('/api/admin/roie/risk/dashboard').then(r => r.json()) });
  const cascade = useQuery({ queryKey: ['roie-cascade'], queryFn: () => fetch('/api/admin/roie/cascading').then(r => r.json()), enabled: activeTab === 'cascading' });
  const compound = useQuery({ queryKey: ['roie-compound'], queryFn: () => fetch('/api/admin/roie/compound').then(r => r.json()), enabled: activeTab === 'compound' });
  const behavioural = useQuery({ queryKey: ['roie-behavioural'], queryFn: () => fetch('/api/admin/roie/behavioural').then(r => r.json()), enabled: activeTab === 'behavioural' });
  const cognitive = useQuery({ queryKey: ['roie-cognitive'], queryFn: () => fetch('/api/admin/roie/cognitive').then(r => r.json()), enabled: activeTab === 'cognitive' });
  const emotional = useQuery({ queryKey: ['roie-emotional'], queryFn: () => fetch('/api/admin/roie/emotional').then(r => r.json()), enabled: activeTab === 'emotional' });
  const warnings = useQuery({ queryKey: ['roie-warnings'], queryFn: () => fetch('/api/admin/roie/early-warnings').then(r => r.json()), enabled: activeTab === 'warnings' });
  const states = useQuery({ queryKey: ['roie-states'], queryFn: () => fetch('/api/admin/roie/human-states').then(r => r.json()), enabled: activeTab === 'states' });
  const environmental = useQuery({ queryKey: ['roie-env'], queryFn: () => fetch('/api/admin/roie/environmental').then(r => r.json()), enabled: activeTab === 'environmental' });

  const computeAll = useMutation({
    mutationFn: (userId: string) => fetch('/api/roie/compute-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-risk-dash'] }),
  });

  const ackWarning = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/roie/early-warnings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledged: true }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-warnings'] }),
  });

  const tabs = [
    { id: 'overview', label: 'Risk Overview', icon: Shield },
    { id: 'cascading', label: 'Cascading', icon: Zap },
    { id: 'compound', label: 'Compound', icon: AlertTriangle },
    { id: 'behavioural', label: 'Behavioural', icon: Brain },
    { id: 'cognitive', label: 'Cognitive', icon: Brain },
    { id: 'emotional', label: 'Emotional', icon: Heart },
    { id: 'warnings', label: 'Early Warnings', icon: AlertTriangle },
    { id: 'states', label: 'Human States', icon: Eye },
    { id: 'environmental', label: 'Environmental', icon: Shield },
  ];

  const d = riskDash.data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-black" style={{ color: NAVY }}>Risk Intelligence Engine</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Cascading · Compound · Behavioural · Cognitive · Emotional · Environmental · Early Warning</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={computeUser} onChange={e => setComputeUser(e.target.value)} placeholder="user email" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52" />
          <button
            onClick={() => computeAll.mutate(computeUser)}
            disabled={computeAll.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: NAVY }}
          >
            <RefreshCw size={14} className={computeAll.isPending ? 'animate-spin' : ''} />
            {computeAll.isPending ? 'Computing…' : 'Compute All Risks'}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {d && (
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Total Profiles" value={d.kpi?.total} sub="risk profiles computed" />
          <KpiCard label="Avg Risk Score" value={d.kpi?.avg_score} sub="0–100 scale" color="#F59E0B" />
          <KpiCard label="Critical" value={d.kpi?.critical} sub="require immediate action" color="#EF4444" />
          <KpiCard label="High Risk" value={d.kpi?.high} sub="escalation required" color="#F97316" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={activeTab === t.id ? { background: NAVY, color: '#fff' } : { background: '#f1f5f9', color: '#64748b' }}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && d && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3">Risk Tier Distribution</p>
            <div className="space-y-2">
              {d.tiers?.map((t: any) => (
                <div key={t.risk_tier} className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold capitalize w-20" style={{ color: TIER_COLOR[t.risk_tier] || NAVY }}>{t.risk_tier}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.n / (d.kpi?.total || 1)) * 100)}%`, backgroundColor: TIER_COLOR[t.risk_tier] || NAVY }} />
                  </div>
                  <span className="text-[12px] text-gray-500 w-6">{t.n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3">Cascading & Compound</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ backgroundColor: '#EF444410' }}>
                <p className="text-[11px] text-gray-400 font-medium mb-1">Cascading Chains</p>
                <p className="text-[24px] font-black" style={{ color: '#EF4444' }}>{d.cascade?.total ?? 0}</p>
                <p className="text-[11px] text-gray-400">avg prob {Number(d.cascade?.avg_prob ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: '#F9731610' }}>
                <p className="text-[11px] text-gray-400 font-medium mb-1">Compound Risks</p>
                <p className="text-[24px] font-black" style={{ color: '#F97316' }}>{d.compound?.total ?? 0}</p>
                <p className="text-[11px] text-gray-400">avg amp ×{Number(d.compound?.avg_amp ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3">Recent High-Risk Profiles</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-gray-100">{['User', 'Score', 'Tier', 'Present Risks', 'Computed'].map(h => <th key={h} className="text-left py-2 pr-4 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {d.recent?.map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setDrawer(r)}>
                      <td className="py-2 pr-4 font-medium">{r.user_id}</td>
                      <td className="py-2 pr-4 font-black" style={{ color: TIER_COLOR[r.risk_tier] }}>{r.overall_risk_score}</td>
                      <td className="py-2 pr-4"><Badge color={TIER_COLOR[r.risk_tier]}>{r.risk_tier}</Badge></td>
                      <td className="py-2 pr-4 text-gray-500">{(r.present_risks || []).length} present, {(r.emerging_risks || []).length} emerging</td>
                      <td className="py-2 text-gray-400">{new Date(r.computed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CASCADING ── */}
      {activeTab === 'cascading' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Total Chains" value={cascade.data?.kpi?.total} sub="detected" color="#EF4444" />
            <KpiCard label="Avg Chain Length" value={cascade.data?.kpi?.avg_length} sub="steps" color="#F97316" />
            <KpiCard label="Avg Escalation Prob" value={cascade.data?.kpi?.avg_prob} sub="probability 0–1" color="#F59E0B" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            {cascade.data?.rows?.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-bold" style={{ color: NAVY }}>{r.root_risk}</span>
                  <div className="flex items-center gap-2">
                    <Badge color="#EF4444">{r.severity}</Badge>
                    <span className="text-[12px] text-gray-400">{r.user_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {(r.chain || []).map((step: any, i: number) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>{step.risk}</span>
                      {i < r.chain.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
                  <span>Escalation prob: <b style={{ color: '#EF4444' }}>{Number(r.escalation_probability).toFixed(2)}</b></span>
                  <span>Terminal: <b>{r.terminal_risk}</b></span>
                  {r.time_to_terminal_days && <span>ETA: {r.time_to_terminal_days}d</span>}
                </div>
              </div>
            ))}
            {!cascade.data?.rows?.length && <p className="text-gray-400 text-center py-8">No cascading chains detected yet. Use "Compute All Risks" to detect.</p>}
          </div>
        </div>
      )}

      {/* ── COMPOUND ── */}
      {activeTab === 'compound' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Compound Risks" value={compound.data?.kpi?.total} color="#F97316" />
            <KpiCard label="Avg Severity" value={compound.data?.kpi?.avg_severity} color="#EF4444" />
            <KpiCard label="Avg Amplification" value={`×${Number(compound.data?.kpi?.avg_amp ?? 0).toFixed(2)}`} color="#F59E0B" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            {compound.data?.rows?.map((r: any) => (
              <div key={r.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-bold" style={{ color: NAVY }}>{r.compound_label}</span>
                  <Badge color="#F97316">{r.interaction_type}</Badge>
                </div>
                <div className="flex gap-1 flex-wrap mb-2">
                  {(r.risk_components || []).map((c: string, i: number) => <Badge key={i} color="#6B7280">{c}</Badge>)}
                </div>
                <p className="text-[12px] text-gray-500 font-mono">{r.example_pattern}</p>
                <div className="flex gap-4 mt-1 text-[11px] text-gray-400">
                  <span>Severity: <b style={{ color: '#EF4444' }}>{Number(r.compound_severity).toFixed(2)}</b></span>
                  <span>Amplification: <b>×{Number(r.amplification_factor).toFixed(2)}</b></span>
                  <span>{r.user_id}</span>
                </div>
              </div>
            ))}
            {!compound.data?.rows?.length && <p className="text-gray-400 text-center py-8">No compound risks detected yet.</p>}
          </div>
        </div>
      )}

      {/* ── BEHAVIOURAL ── */}
      {activeTab === 'behavioural' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Profiles" value={behavioural.data?.kpi?.total} />
            <KpiCard label="Drifting" value={behavioural.data?.kpi?.drifting} color="#EF4444" />
            <KpiCard label="Avg Disengagement" value={behavioural.data?.kpi?.avg_disengagement} color="#F97316" />
            <KpiCard label="Avg Volatility" value={behavioural.data?.kpi?.avg_volatility} color="#F59E0B" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50"><tr>{['User', 'Disengagement', 'Volatility', 'Impulsivity', 'Drift', 'Contagion Risk', 'Direction'].map(h => <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {behavioural.data?.rows?.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-[12px]">{r.user_id}</td>
                    <td className="px-4 py-2.5"><div className="w-20 h-1.5 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${r.disengagement_score}%`, backgroundColor: '#F97316' }} /></div></td>
                    <td className="px-4 py-2.5"><div className="w-20 h-1.5 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${r.volatility_score}%`, backgroundColor: '#F59E0B' }} /></div></td>
                    <td className="px-4 py-2.5 text-gray-600">{Number(r.impulsivity_index).toFixed(1)}</td>
                    <td className="px-4 py-2.5">{r.drift_detected ? <Badge color="#EF4444">drift</Badge> : <Badge color="#10B981">stable</Badge>}</td>
                    <td className="px-4 py-2.5 text-gray-500">{Number(r.contagion_risk).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.drift_direction || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COGNITIVE ── */}
      {activeTab === 'cognitive' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Profiles" value={cognitive.data?.kpi?.total} />
            <KpiCard label="Avg Overload" value={cognitive.data?.kpi?.avg_overload} color="#F97316" sub="0–100 scale" />
            <KpiCard label="Avg Fatigue" value={cognitive.data?.kpi?.avg_fatigue} color="#EF4444" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50"><tr>{['User', 'Overload', 'Fatigue', 'Exec Dysfunction', 'Reasoning Instability', 'Recovery ETA', 'Escalation Prob'].map(h => <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {cognitive.data?.rows?.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-[12px]">{r.user_id}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: r.overload_score > 65 ? '#EF4444' : '#F59E0B' }}>{Number(r.overload_score).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{Number(r.cognitive_fatigue).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{Number(r.executive_dysfunction).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{Number(r.reasoning_instability).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.recovery_eta_days ? `${r.recovery_eta_days}d` : '—'}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: r.overload_escalation_prob > 0.4 ? '#EF4444' : '#10B981' }}>{Number(r.overload_escalation_prob).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EMOTIONAL ── */}
      {activeTab === 'emotional' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Profiles" value={emotional.data?.kpi?.total} />
            <KpiCard label="Avg Burnout" value={emotional.data?.kpi?.avg_burnout} color="#EF4444" />
            <KpiCard label="High Burnout" value={emotional.data?.kpi?.high_burnout} color="#F97316" sub=">65 score" />
            <KpiCard label="Avg Anxiety" value={emotional.data?.kpi?.avg_anxiety} color="#F59E0B" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Emotional Trajectory Distribution</p>
              <div className="space-y-2">
                {emotional.data?.trajectory?.map((t: any) => (
                  <div key={t.emotional_trajectory} className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold w-24 capitalize" style={{ color: TRAJ_COLOR[t.emotional_trajectory] || '#6B7280' }}>{t.emotional_trajectory}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.n / (emotional.data?.kpi?.total || 1)) * 100)}%`, backgroundColor: TRAJ_COLOR[t.emotional_trajectory] || '#6B7280' }} />
                    </div>
                    <span className="text-[12px] text-gray-400">{t.n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['User', 'Burnout', 'Hopelessness', 'Anxiety', 'Trajectory', 'Collapse Prob'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {emotional.data?.rows?.slice(0, 8).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 font-medium text-[11px]">{r.user_id}</td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: r.burnout_score > 65 ? '#EF4444' : '#F59E0B' }}>{Number(r.burnout_score).toFixed(0)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.hopelessness_index).toFixed(0)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.anxiety_escalation).toFixed(0)}</td>
                      <td className="px-3 py-2"><Badge color={TRAJ_COLOR[r.emotional_trajectory] || '#6B7280'}>{r.emotional_trajectory}</Badge></td>
                      <td className="px-3 py-2 font-semibold text-[12px]" style={{ color: r.resilience_collapse_prob > 0.4 ? '#EF4444' : '#10B981' }}>{Number(r.resilience_collapse_prob).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EARLY WARNINGS ── */}
      {activeTab === 'warnings' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total Warnings" value={warnings.data?.kpi?.total} />
            <KpiCard label="Unacknowledged" value={warnings.data?.kpi?.unacknowledged} color="#F59E0B" />
            <KpiCard label="Critical" value={warnings.data?.kpi?.critical} color="#EF4444" />
            <KpiCard label="Affected Users" value={warnings.data?.kpi?.users} color={NAVY} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            {warnings.data?.rows?.map((w: any) => (
              <div key={w.id} className="rounded-lg border p-3 flex items-start justify-between gap-4" style={{ borderColor: `${SEV_COLOR[w.severity] || '#6B7280'}30`, backgroundColor: `${SEV_COLOR[w.severity] || '#6B7280'}06` }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={SEV_COLOR[w.severity] || '#6B7280'}>{w.severity}</Badge>
                    <span className="text-[13px] font-bold text-gray-800">{w.warning_label}</span>
                    {w.acknowledged && <Badge color="#6B7280">ack'd</Badge>}
                  </div>
                  <p className="text-[12px] text-gray-500">Signals: {(w.detected_signals || []).join(', ')}</p>
                  <p className="text-[12px] text-gray-600 mt-0.5">Action: {w.recommended_action}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{w.user_id} · confidence {Number(w.confidence).toFixed(2)}</p>
                </div>
                {!w.acknowledged && (
                  <button onClick={() => ackWarning.mutate(w.id)} className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: NAVY }}>Acknowledge</button>
                )}
              </div>
            ))}
            {!warnings.data?.rows?.length && <p className="text-gray-400 text-center py-8">No early warnings detected.</p>}
          </div>
        </div>
      )}

      {/* ── HUMAN STATES ── */}
      {activeTab === 'states' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="State Records" value={states.data?.kpi?.total} />
            <KpiCard label="Avg Composite Score" value={states.data?.kpi?.avg_score} color={NAVY} />
            <KpiCard label="Users" value={states.data?.kpi?.users} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Emotional State Distribution</p>
              <div className="space-y-1.5">
                {states.data?.emotional_states?.map((s: any) => (
                  <div key={s.emotional_state} className="flex items-center gap-2 text-[12px]">
                    <span className="w-20 text-gray-600 capitalize">{s.emotional_state}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, s.n * 15)}%` }} /></div>
                    <span className="w-5 text-gray-400">{s.n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Cognitive State Distribution</p>
              <div className="space-y-1.5">
                {states.data?.cognitive_states?.map((s: any) => (
                  <div key={s.cognitive_state} className="flex items-center gap-2 text-[12px]">
                    <span className="w-20 text-gray-600 capitalize">{s.cognitive_state}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(100, s.n * 15)}%` }} /></div>
                    <span className="w-5 text-gray-400">{s.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ENVIRONMENTAL ── */}
      {activeTab === 'environmental' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Assessments" value={environmental.data?.kpi?.total} />
            <KpiCard label="Avg Toxic Score" value={environmental.data?.kpi?.avg_toxic} color="#EF4444" />
            <KpiCard label="Avg Resilience" value={environmental.data?.kpi?.avg_resilience} color="#10B981" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50"><tr>{['Scope', 'User', 'Toxic Env', 'Institutional Stress', 'Ecosystem Instability', 'Resilience', 'Assessed'].map(h => <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {environmental.data?.rows?.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5"><Badge color={NAVY}>{r.scope}</Badge></td>
                    <td className="px-4 py-2.5 text-[12px]">{r.user_id || '—'}</td>
                    <td className="px-4 py-2.5 font-bold text-[12px]" style={{ color: r.toxic_environment_score > 50 ? '#EF4444' : '#F59E0B' }}>{Number(r.toxic_environment_score).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-[12px]">{Number(r.institutional_stress_index).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-[12px]">{Number(r.ecosystem_instability).toFixed(0)}</td>
                    <td className="px-4 py-2.5 font-bold text-[12px]" style={{ color: r.environmental_resilience > 60 ? '#10B981' : '#F59E0B' }}>{Number(r.environmental_resilience).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-[11px]">{new Date(r.assessed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawer(null)}>
          <div className="flex-1 bg-black/30" />
          <div className="w-[420px] bg-white h-full overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[17px] font-black" style={{ color: NAVY }}>Risk Profile</h3>
              <button onClick={() => setDrawer(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-[13px] font-semibold text-gray-700 mb-1">{drawer.user_id}</p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[32px] font-black" style={{ color: TIER_COLOR[drawer.risk_tier] }}>{drawer.overall_risk_score}</span>
              <Badge color={TIER_COLOR[drawer.risk_tier]}>{drawer.risk_tier}</Badge>
            </div>
            {[{ label: 'Present Risks', key: 'present_risks', color: '#EF4444' }, { label: 'Emerging Risks', key: 'emerging_risks', color: '#F97316' }, { label: 'Latent Risks', key: 'latent_risks', color: '#F59E0B' }].map(({ label, key, color }) => (
              <div key={key} className="mb-3">
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                {(drawer[key] || []).map((r: any, i: number) => (
                  <div key={i} className="rounded-lg p-2 mb-1" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                    <span className="text-[12px] font-semibold" style={{ color }}>{r.name}</span>
                    <span className="text-[11px] text-gray-400 ml-2">{r.severity}</span>
                  </div>
                ))}
                {!(drawer[key] || []).length && <p className="text-[12px] text-gray-300">None</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
