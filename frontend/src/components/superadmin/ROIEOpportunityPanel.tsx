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

export default function ROIEOpportunityPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'opportunity' | 'potential' | 'recovery' | 'trajectory' | 'forecast' | 'intervention'>('opportunity');
  const [drawer, setDrawer] = useState<any>(null);
  const [computeUser, setComputeUser] = useState('demo@metryx.one');
  const [newIntervention, setNewIntervention] = useState({ user_id: '', intervention_type: 'mentor_escalation', priority: 'medium', trigger_reason: '' });

  const opp = useQuery({ queryKey: ['roie-opp'], queryFn: () => fetch('/api/admin/roie/opportunity/dashboard').then(r => r.json()) });
  const potential = useQuery({ queryKey: ['roie-potential'], queryFn: () => fetch('/api/admin/roie/potential').then(r => r.json()), enabled: activeTab === 'potential' });
  const recovery = useQuery({ queryKey: ['roie-recovery'], queryFn: () => fetch('/api/admin/roie/recovery').then(r => r.json()), enabled: activeTab === 'recovery' });
  const trajectories = useQuery({ queryKey: ['roie-trajectories'], queryFn: () => fetch('/api/admin/roie/trajectories').then(r => r.json()), enabled: activeTab === 'trajectory' });
  const forecasts = useQuery({ queryKey: ['roie-forecasts'], queryFn: () => fetch('/api/admin/roie/forecasts').then(r => r.json()), enabled: activeTab === 'forecast' });
  const interventions = useQuery({ queryKey: ['roie-interventions'], queryFn: () => fetch('/api/admin/roie/interventions').then(r => r.json()), enabled: activeTab === 'intervention' });

  const computeOpp = useMutation({
    mutationFn: (userId: string) => fetch('/api/roie/opportunity/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-opp'] }),
  });

  const runForecast = useMutation({
    mutationFn: (userId: string) => fetch('/api/roie/forecast/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-forecasts'] }),
  });

  const addIntervention = useMutation({
    mutationFn: (body: any) => fetch('/api/roie/intervention/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roie-interventions'] }); setNewIntervention({ user_id: '', intervention_type: 'mentor_escalation', priority: 'medium', trigger_reason: '' }); },
  });

  const updateIntervention = useMutation({
    mutationFn: ({ id, ...body }: any) => fetch(`/api/admin/roie/interventions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-interventions'] }),
  });

  const tabs = [
    { id: 'opportunity', label: 'Opportunity', icon: Star },
    { id: 'potential', label: 'Human Potential', icon: TrendingUp },
    { id: 'recovery', label: 'Recovery', icon: Activity },
    { id: 'trajectory', label: 'Trajectories', icon: Activity },
    { id: 'forecast', label: 'Forecasting', icon: Target },
    { id: 'intervention', label: 'Interventions', icon: Zap },
  ];

  const d = opp.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-black" style={{ color: NAVY }}>Opportunity Intelligence Engine</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Human Potential · Recovery · Longitudinal Trajectory · Predictive Forecasting · Intervention</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={computeUser} onChange={e => setComputeUser(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52" placeholder="user email" />
          <button onClick={() => computeOpp.mutate(computeUser)} disabled={computeOpp.isPending} className="px-4 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90" style={{ backgroundColor: '#10B981' }}>
            <RefreshCw size={13} className={`inline mr-1 ${computeOpp.isPending ? 'animate-spin' : ''}`} />
            Compute Opportunity
          </button>
          <button onClick={() => runForecast.mutate(computeUser)} disabled={runForecast.isPending} className="px-4 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90" style={{ backgroundColor: '#8B5CF6' }}>
            {runForecast.isPending ? 'Forecasting…' : 'Run Forecast'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {d && (
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Opportunity Profiles" value={d.kpi?.total} />
          <KpiCard label="Avg Leadership" value={d.kpi?.avg_leadership} color="#8B5CF6" sub="emergence score" />
          <KpiCard label="Avg Employability" value={d.kpi?.avg_employability} color="#3B82F6" />
          <KpiCard label="Breakthroughs" value={d.kpi?.breakthroughs} color="#10B981" sub="tier: breakthrough" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={activeTab === t.id ? { background: NAVY, color: '#fff' } : { background: '#f1f5f9', color: '#64748b' }}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      {/* ── OPPORTUNITY ── */}
      {activeTab === 'opportunity' && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Opportunity Tier Distribution</p>
              {d.tiers?.map((t: any) => (
                <div key={t.opportunity_tier} className="flex items-center gap-3 mb-2">
                  <span className="w-24 text-[12px] font-semibold capitalize" style={{ color: TIER_COLOR[t.opportunity_tier] }}>{t.opportunity_tier}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.n / (d.kpi?.total || 1)) * 100)}%`, backgroundColor: TIER_COLOR[t.opportunity_tier] }} /></div>
                  <span className="text-[11px] text-gray-400">{t.n}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Top Opportunities by Type</p>
              {d.top_opportunities?.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] font-medium capitalize">{t.top_opportunity?.replace(/_/g, ' ')}</span>
                  <Badge color="#10B981">{t.n} users</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50"><tr>{['User', 'Tier', 'Leadership', 'Employability', 'Innovation', 'Top Opportunity', 'Compounding'].map(h => <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {d.rows?.slice(0, 12).map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setDrawer(r)}>
                    <td className="px-4 py-2.5 font-medium text-[12px]">{r.user_id}</td>
                    <td className="px-4 py-2.5"><Badge color={TIER_COLOR[r.opportunity_tier]}>{r.opportunity_tier}</Badge></td>
                    <td className="px-4 py-2.5 font-bold text-[12px]" style={{ color: '#8B5CF6' }}>{Number(r.leadership_emergence).toFixed(0)}</td>
                    <td className="px-4 py-2.5 font-bold text-[12px]" style={{ color: '#3B82F6' }}>{Number(r.employability_acceleration).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-[12px]">{Number(r.innovation_potential).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-700 capitalize">{r.top_opportunity?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-[11px] text-gray-400">{(r.compounding_factors || []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HUMAN POTENTIAL ── */}
      {activeTab === 'potential' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Emergences" value={potential.data?.kpi?.total} />
            <KpiCard label="Avg Confidence" value={potential.data?.kpi?.avg_confidence} color="#10B981" />
            <KpiCard label="Breakthroughs" value={potential.data?.kpi?.breakthroughs} color="#8B5CF6" />
            <KpiCard label="Users" value={potential.data?.kpi?.users} color={NAVY} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Emergence Types</p>
              {potential.data?.types?.map((t: any) => (
                <div key={t.emergence_type} className="flex items-center gap-3 mb-2">
                  <span className="w-24 text-[12px] font-semibold capitalize">{t.emergence_type}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(100, t.n * 20)}%` }} /></div>
                  <span className="text-[11px] text-gray-400">{Number(t.avg_prob).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 overflow-y-auto max-h-72">
              {potential.data?.rows?.map((r: any) => (
                <div key={r.id} className="rounded-lg border border-gray-100 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="#8B5CF6">{r.emergence_type}</Badge>
                    <span className="text-[12px] font-bold text-gray-700">{r.phase_transition}</span>
                  </div>
                  <p className="text-[12px] text-gray-600">{r.emergence_signal}</p>
                  <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                    <span>Confidence: {Number(r.confidence).toFixed(2)}</span>
                    <span>Breakthrough: {Number(r.breakthrough_probability).toFixed(2)}</span>
                    <span>{r.user_id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RECOVERY ── */}
      {activeTab === 'recovery' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Recovery Profiles" value={recovery.data?.kpi?.total} />
            <KpiCard label="Avg Momentum" value={recovery.data?.kpi?.avg_momentum} color="#10B981" sub="velocity × stability × sustainability" />
            <KpiCard label="Complete" value={recovery.data?.kpi?.complete} color="#8B5CF6" />
            <KpiCard label="Avg Velocity" value={recovery.data?.kpi?.avg_velocity} color="#3B82F6" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Recovery Stage Distribution</p>
              {recovery.data?.stages?.map((s: any) => (
                <div key={s.recovery_stage} className="flex items-center gap-3 mb-2">
                  <span className="w-24 text-[12px] font-semibold capitalize" style={{ color: STAGE_COLOR[s.recovery_stage] || '#6B7280' }}>{s.recovery_stage}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (s.n / (recovery.data?.kpi?.total || 1)) * 100)}%`, backgroundColor: STAGE_COLOR[s.recovery_stage] || '#6B7280' }} /></div>
                  <span className="text-[11px] text-gray-400">{s.n}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['User', 'Stage', 'Momentum', 'Velocity', 'ETA'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {recovery.data?.rows?.slice(0, 8).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium">{r.user_id}</td>
                      <td className="px-3 py-2"><Badge color={STAGE_COLOR[r.recovery_stage] || '#6B7280'}>{r.recovery_stage}</Badge></td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: '#10B981' }}>{Number(r.recovery_momentum).toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.recovery_velocity).toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-500 text-[12px]">{r.recovery_eta_days ? `${r.recovery_eta_days}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TRAJECTORIES ── */}
      {activeTab === 'trajectory' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Snapshots" value={trajectories.data?.kpi?.total} />
            <KpiCard label="Growth" value={trajectories.data?.kpi?.growth} color="#10B981" />
            <KpiCard label="Unstable" value={trajectories.data?.kpi?.unstable} color="#EF4444" />
            <KpiCard label="Avg Volatility" value={trajectories.data?.kpi?.avg_volatility} color="#F59E0B" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Trajectory Types</p>
              {trajectories.data?.types?.map((t: any) => (
                <div key={t.trajectory_type} className="flex items-center gap-3 mb-2">
                  <span className="w-36 text-[12px] font-semibold capitalize" style={{ color: TRAJ_COLOR[t.trajectory_type] }}>{t.trajectory_type.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.n / (trajectories.data?.kpi?.total || 1)) * 100)}%`, backgroundColor: TRAJ_COLOR[t.trajectory_type] }} /></div>
                  <span className="text-[11px] text-gray-400">{t.n}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['User', 'Type', 'Volatility', 'Collapse Risk', 'Instability'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {trajectories.data?.rows?.slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium">{r.user_id}</td>
                      <td className="px-3 py-2"><Badge color={TRAJ_COLOR[r.trajectory_type]}>{r.trajectory_type.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.volatility_index).toFixed(3)}</td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: r.collapse_risk > 0.4 ? '#EF4444' : '#10B981' }}>{Number(r.collapse_risk).toFixed(2)}</td>
                      <td className="px-3 py-2 text-[12px]">{r.instability_detected ? <Badge color="#EF4444">Yes</Badge> : <Badge color="#10B981">No</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FORECASTING ── */}
      {activeTab === 'forecast' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Forecasts" value={forecasts.data?.kpi?.total} />
            <KpiCard label="Users Forecasted" value={forecasts.data?.kpi?.users} color={NAVY} />
            <KpiCard label="Avg Burnout Prob" value={forecasts.data?.kpi?.avg_burnout} color="#EF4444" />
            <KpiCard label="Avg Employability" value={forecasts.data?.kpi?.avg_employability} color="#10B981" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Forecast Horizons</p>
              {forecasts.data?.horizons?.map((h: any) => (
                <div key={h.forecast_horizon} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-[13px] font-bold" style={{ color: NAVY }}>{h.forecast_horizon}</span>
                  <div className="flex gap-4 text-[11px] text-gray-500">
                    <span>Burnout: <b style={{ color: '#EF4444' }}>{Number(h.avg_burnout).toFixed(2)}</b></span>
                    <span>Leadership: <b style={{ color: '#8B5CF6' }}>{Number(h.avg_leadership).toFixed(2)}</b></span>
                    <span>N: {h.n}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['User', 'Horizon', 'Burnout', 'Dropout', 'Employability', 'Leadership', 'Resilience'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {forecasts.data?.rows?.slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium">{r.user_id}</td>
                      <td className="px-3 py-2"><Badge color={NAVY}>{r.forecast_horizon}</Badge></td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: r.burnout_probability > 0.5 ? '#EF4444' : '#10B981' }}>{Number(r.burnout_probability).toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.dropout_probability).toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.employability_readiness).toFixed(2)}</td>
                      <td className="px-3 py-2 font-semibold text-[12px]" style={{ color: '#8B5CF6' }}>{Number(r.leadership_emergence_prob).toFixed(2)}</td>
                      <td className="px-3 py-2 text-[11px]"><Badge color={r.resilience_trajectory === 'improving' ? '#10B981' : r.resilience_trajectory === 'stable' ? '#6B7280' : '#EF4444'}>{r.resilience_trajectory}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERVENTIONS ── */}
      {activeTab === 'intervention' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Total" value={interventions.data?.kpi?.total} />
            <KpiCard label="Active" value={interventions.data?.kpi?.active} color="#F97316" />
            <KpiCard label="Completed" value={interventions.data?.kpi?.completed} color="#10B981" />
            <KpiCard label="Avg Effectiveness" value={interventions.data?.kpi?.avg_effectiveness} color="#8B5CF6" />
          </div>

          {/* Initiate form */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-600 mb-3">Initiate Intervention</p>
            <div className="flex gap-2 flex-wrap">
              <input value={newIntervention.user_id} onChange={e => setNewIntervention(p => ({ ...p, user_id: e.target.value }))} placeholder="User email" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40" />
              <select value={newIntervention.intervention_type} onChange={e => setNewIntervention(p => ({ ...p, intervention_type: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {['mentor_escalation', 'pacing_optimization', 'emotional_support', 'resilience_recovery', 'behavioural_coaching', 'opportunity_amplification'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={newIntervention.priority} onChange={e => setNewIntervention(p => ({ ...p, priority: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={newIntervention.trigger_reason} onChange={e => setNewIntervention(p => ({ ...p, trigger_reason: e.target.value }))} placeholder="Trigger reason" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40" />
              <button onClick={() => addIntervention.mutate(newIntervention)} disabled={!newIntervention.user_id || addIntervention.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: NAVY }}>Initiate</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50"><tr>{['User', 'Type', 'Priority', 'Status', 'Timing', 'Effectiveness', 'Actions'].map(h => <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {interventions.data?.rows?.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 font-medium text-[12px]">{r.user_id}</td>
                    <td className="px-4 py-2.5 text-[12px] capitalize">{r.intervention_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5"><Badge color={{ critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#10B981' }[r.priority] || '#6B7280'}>{r.priority}</Badge></td>
                    <td className="px-4 py-2.5"><Badge color={{ active: '#3B82F6', completed: '#10B981', pending: '#F59E0B', failed: '#EF4444' }[r.status] || '#6B7280'}>{r.status}</Badge></td>
                    <td className="px-4 py-2.5 text-[11px] text-gray-500">{r.optimized_timing}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-500">{r.effectiveness_score ? Number(r.effectiveness_score).toFixed(2) : '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.status === 'pending' && <button onClick={() => updateIntervention.mutate({ id: r.id, status: 'active' })} className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium hover:bg-blue-100">Activate</button>}
                      {r.status === 'active' && <button onClick={() => updateIntervention.mutate({ id: r.id, status: 'completed', effectiveness_score: 0.74 })} className="text-[11px] px-2 py-1 rounded bg-green-50 text-green-600 font-medium hover:bg-green-100">Complete</button>}
                    </td>
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
          <div className="w-[380px] bg-white h-full overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-black" style={{ color: NAVY }}>Opportunity Profile</h3>
              <button onClick={() => setDrawer(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-[13px] font-semibold mb-2">{drawer.user_id}</p>
            <Badge color={TIER_COLOR[drawer.opportunity_tier]}>{drawer.opportunity_tier}</Badge>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Leadership Emergence', val: drawer.leadership_emergence, color: '#8B5CF6' },
                { label: 'Employability Acceleration', val: drawer.employability_acceleration, color: '#3B82F6' },
                { label: 'Resilience Growth', val: drawer.resilience_growth, color: '#10B981' },
                { label: 'Rapid Learning Potential', val: drawer.rapid_learning_potential, color: '#F59E0B' },
                { label: 'Innovation Potential', val: drawer.innovation_potential, color: '#EC4899' },
                { label: 'Specialization Readiness', val: drawer.specialization_readiness, color: '#06B6D4' },
                { label: 'Mentorship Readiness', val: drawer.mentorship_readiness, color: '#6366F1' },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-bold" style={{ color }}>{Number(val).toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, val)}%`, backgroundColor: color }} /></div>
                </div>
              ))}
            </div>
            {drawer.compounding_factors?.length > 0 && (
              <div className="mt-4">
                <p className="text-[12px] font-bold text-gray-500 mb-2">Compounding Factors</p>
                {drawer.compounding_factors.map((f: string, i: number) => <p key={i} className="text-[12px] text-gray-600 p-2 rounded bg-purple-50 mb-1">{f}</p>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
