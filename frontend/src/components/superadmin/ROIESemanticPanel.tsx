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

export default function ROIESemanticPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'semantic' | 'graph' | 'socioeconomic' | 'population' | 'contagion' | 'simulation'>('semantic');
  const [analyzeUser, setAnalyzeUser] = useState('demo@metryx.one');
  const [simScenario, setSimScenario] = useState('resilience_collapse');
  const [simPop, setSimPop] = useState(100);
  const [simResult, setSimResult] = useState<any>(null);
  const [socUser, setSocUser] = useState('demo@metryx.one');

  const semantic = useQuery({ queryKey: ['roie-semantic'], queryFn: () => fetch('/api/admin/roie/semantic').then(r => r.json()), enabled: activeTab === 'semantic' });
  const graph = useQuery({ queryKey: ['roie-graph'], queryFn: () => fetch('/api/roie/knowledge-graph/traverse').then(r => r.json()), enabled: activeTab === 'graph' });
  const socio = useQuery({ queryKey: ['roie-socio'], queryFn: () => fetch('/api/admin/roie/socioeconomic').then(r => r.json()), enabled: activeTab === 'socioeconomic' });
  const population = useQuery({ queryKey: ['roie-population'], queryFn: () => fetch('/api/admin/roie/population').then(r => r.json()), enabled: activeTab === 'population' });
  const contagion = useQuery({ queryKey: ['roie-contagion'], queryFn: () => fetch('/api/admin/roie/contagion').then(r => r.json()), enabled: activeTab === 'contagion' });
  const simHistory = useQuery({ queryKey: ['roie-sim-history'], queryFn: () => fetch('/api/admin/roie/simulation/history').then(r => r.json()), enabled: activeTab === 'simulation' });

  const analyzeSemantic = useMutation({
    mutationFn: (userId: string) => fetch('/api/roie/semantic/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-semantic'] }),
  });

  const computePopulation = useMutation({
    mutationFn: (data: any) => fetch('/api/roie/population/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-population'] }),
  });

  const profileSocio = useMutation({
    mutationFn: (userId: string) => fetch('/api/roie/socioeconomic/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roie-socio'] }),
  });

  const runSimulation = useMutation({
    mutationFn: (data: any) => fetch('/api/roie/simulation/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: (data) => { setSimResult(data); qc.invalidateQueries({ queryKey: ['roie-sim-history'] }); },
  });

  const tabs = [
    { id: 'semantic', label: 'Semantic Reasoning', icon: Network },
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'socioeconomic', label: 'Socioeconomic', icon: Globe },
    { id: 'population', label: 'Population', icon: Users },
    { id: 'contagion', label: 'Contagion', icon: Users },
    { id: 'simulation', label: 'Simulation', icon: Play },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-black" style={{ color: NAVY }}>Semantic & Population Intelligence</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Semantic Reasoning · Knowledge Graph · Socioeconomic · Population · Contagion · Simulation</p>
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

      {/* ── SEMANTIC REASONING ── */}
      {activeTab === 'semantic' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={analyzeUser} onChange={e => setAnalyzeUser(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs" placeholder="User email" />
            <button onClick={() => analyzeSemantic.mutate(analyzeUser)} disabled={analyzeSemantic.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold hover:opacity-90" style={{ backgroundColor: NAVY }}>
              <RefreshCw size={13} className={`inline mr-1 ${analyzeSemantic.isPending ? 'animate-spin' : ''}`} />
              Analyze
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Analyses" value={semantic.data?.kpi?.total} />
            <KpiCard label="Users" value={semantic.data?.kpi?.users} color={NAVY} />
            <KpiCard label="Semantic Clusters" value={semantic.data?.kpi?.clusters} color="#8B5CF6" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Semantic Clusters</p>
              {semantic.data?.clusters?.map((c: any) => (
                <div key={c.semantic_cluster} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] capitalize">{c.semantic_cluster?.replace(/_/g, ' ')}</span>
                  <Badge color="#8B5CF6">{c.n}</Badge>
                </div>
              ))}
              {!semantic.data?.clusters?.length && <p className="text-gray-400 text-[13px]">No analyses yet. Run analysis above.</p>}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 max-h-72 overflow-y-auto">
              <p className="text-[13px] font-bold text-gray-500 mb-2">Recent Analyses</p>
              {semantic.data?.recent?.map((r: any) => (
                <div key={r.id} className="rounded-lg border border-gray-100 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold" style={{ color: NAVY }}>{r.user_id}</span>
                    <Badge color="#8B5CF6">{r.semantic_cluster}</Badge>
                  </div>
                  <p className="text-[12px] text-gray-600 leading-relaxed">{r.reasoning_output}</p>
                  <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                    <span>Causal chains: {(r.causal_chains || []).length}</span>
                    <span>Hidden patterns: {(r.hidden_patterns || []).length}</span>
                    <span>Horizon: {r.memory_horizon_days}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KNOWLEDGE GRAPH ── */}
      {activeTab === 'graph' && graph.data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Total Nodes" value={graph.data.total_nodes} color={NAVY} />
            <KpiCard label="Total Edges" value={graph.data.total_edges} color="#8B5CF6" />
            <KpiCard label="Semantic Clusters" value={graph.data.cluster_count} color="#10B981" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Node Types (Semantic Clusters)</p>
              {Object.entries(graph.data.semantic_clusters || {}).map(([type, nodes]: [string, any]) => (
                <div key={type} className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-bold capitalize" style={{ color: NAVY }}>{type}</span>
                    <Badge color={NAVY}>{nodes.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {nodes.slice(0, 4).map((n: any) => (
                      <span key={n.id} className="text-[11px] px-2 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-100">{n.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Concern → Risk → Intervention Pathway</p>
              <div className="space-y-2">
                {[
                  { from: 'Screen Addiction', rel: 'triggers', to: 'Concentration Deficit', color: '#EF4444' },
                  { from: 'Exam Anxiety', rel: 'leads_to', to: 'Burnout Risk', color: '#F97316' },
                  { from: 'Mindfulness Training', rel: 'reduces', to: 'Burnout Risk', color: '#10B981' },
                  { from: 'Cognitive Reframing', rel: 'improves', to: 'Academic Resilience', color: '#3B82F6' },
                  { from: 'Impulsivity', rel: 'correlates_with', to: 'Avoidance', color: '#8B5CF6' },
                ].map((edge, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{edge.from}</span>
                    <span className="text-gray-400 text-[10px]">—{edge.rel}→</span>
                    <span className="px-2 py-0.5 rounded font-medium" style={{ background: `${edge.color}12`, color: edge.color }}>{edge.to}</span>
                  </div>
                ))}
              </div>
              {graph.data.isolated_nodes?.length > 0 && (
                <div className="mt-3 p-2 rounded-lg bg-yellow-50 border border-yellow-100">
                  <p className="text-[11px] text-yellow-700 font-bold mb-1">Isolated Nodes (no edges yet)</p>
                  <div className="flex flex-wrap gap-1">
                    {graph.data.isolated_nodes.slice(0, 5).map((n: any) => <span key={n.id} className="text-[11px] text-gray-500">{n.label}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SOCIOECONOMIC ── */}
      {activeTab === 'socioeconomic' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={socUser} onChange={e => setSocUser(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs" placeholder="User email" />
            <button onClick={() => profileSocio.mutate(socUser)} disabled={profileSocio.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: NAVY }}>Profile</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Profiles" value={socio.data?.kpi?.total} />
            <KpiCard label="Avg Financial Stress" value={socio.data?.kpi?.avg_financial_stress} color="#EF4444" />
            <KpiCard label="Avg Disadvantage" value={socio.data?.kpi?.avg_disadvantage} color="#F97316" />
            <KpiCard label="Severely Constrained" value={socio.data?.kpi?.severe} color="#EF4444" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Socioeconomic Tier Distribution</p>
              {socio.data?.tiers?.map((t: any) => (
                <div key={t.socioeconomic_tier} className="flex items-center gap-3 mb-2">
                  <span className="w-36 text-[12px] font-semibold capitalize" style={{ color: TIER_COLOR[t.socioeconomic_tier] }}>{t.socioeconomic_tier?.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (t.n / (socio.data?.kpi?.total || 1)) * 100)}%`, backgroundColor: TIER_COLOR[t.socioeconomic_tier] }} /></div>
                  <span className="text-[11px] text-gray-400">{t.n}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['User', 'Tier', 'Financial Stress', 'Access Gap', 'Risk Delta', 'Opp Delta'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {socio.data?.rows?.slice(0, 8).map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[11px] font-medium">{r.user_id}</td>
                      <td className="px-3 py-2"><Badge color={TIER_COLOR[r.socioeconomic_tier]}>{r.socioeconomic_tier?.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: r.financial_stress_index > 50 ? '#EF4444' : '#F59E0B' }}>{Number(r.financial_stress_index).toFixed(0)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.access_inequality_index).toFixed(0)}</td>
                      <td className="px-3 py-2 text-[12px]" style={{ color: r.contextualized_risk_delta > 5 ? '#EF4444' : '#10B981' }}>+{Number(r.contextualized_risk_delta).toFixed(1)}</td>
                      <td className="px-3 py-2 text-[12px]" style={{ color: r.contextualized_opportunity_delta < 0 ? '#EF4444' : '#10B981' }}>{Number(r.contextualized_opportunity_delta).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── POPULATION ── */}
      {activeTab === 'population' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => computePopulation.mutate({ cohort_label: 'Test Cohort', cohort_size: 50 })} disabled={computePopulation.isPending} className="px-4 py-1.5 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: NAVY }}>
              {computePopulation.isPending ? 'Computing…' : 'Compute Population Intelligence'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Cohorts" value={population.data?.kpi?.total} />
            <KpiCard label="Total Users" value={population.data?.kpi?.total_users} color={NAVY} />
            <KpiCard label="Avg Risk" value={population.data?.kpi?.avg_risk} color="#EF4444" />
            <KpiCard label="Avg Fragility" value={population.data?.kpi?.avg_fragility} color="#F97316" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Engagement Ecosystem Health</p>
              {population.data?.ecosystems?.map((e: any) => (
                <div key={e.engagement_ecosystem} className="flex items-center gap-3 mb-2">
                  <span className="w-20 text-[12px] font-semibold capitalize" style={{ color: ECO_COLOR[e.engagement_ecosystem] }}>{e.engagement_ecosystem}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (e.n / (population.data?.kpi?.total || 1)) * 100)}%`, backgroundColor: ECO_COLOR[e.engagement_ecosystem] }} /></div>
                  <span className="text-[11px] text-gray-400">{e.n}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50"><tr>{['Cohort', 'Size', 'Avg Risk', 'Fragility', 'Workforce', 'Ecosystem'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {population.data?.rows?.map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-[12px] font-medium">{r.cohort_label}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{r.cohort_size}</td>
                      <td className="px-3 py-2 font-bold text-[12px]" style={{ color: r.avg_risk_score > 60 ? '#EF4444' : '#F59E0B' }}>{Number(r.avg_risk_score).toFixed(0)}</td>
                      <td className="px-3 py-2 text-gray-600 text-[12px]">{Number(r.institutional_fragility).toFixed(0)}</td>
                      <td className="px-3 py-2 text-[12px] font-semibold" style={{ color: '#10B981' }}>{Number(r.workforce_readiness).toFixed(0)}</td>
                      <td className="px-3 py-2"><Badge color={ECO_COLOR[r.engagement_ecosystem] || '#6B7280'}>{r.engagement_ecosystem}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTAGION ── */}
      {activeTab === 'contagion' && contagion.data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Avg Spread" value={contagion.data.stats?.avg_spread} sub="disengagement contagion rate" color="#F97316" />
            <KpiCard label="Max Spread" value={contagion.data.stats?.max_spread} color="#EF4444" />
            <KpiCard label="Cohorts Monitored" value={contagion.data.stats?.cohorts} color={NAVY} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Contagion Model Parameters</p>
              <div className="space-y-2">
                {[
                  ['Peer Influence Radius', contagion.data.model?.peer_influence_radius],
                  ['Spread Velocity', contagion.data.model?.spread_velocity],
                  ['Contagion Pattern', contagion.data.model?.cohort_contagion_pattern],
                  ['Intervention Effectiveness', `${Math.round((contagion.data.model?.intervention_effectiveness || 0) * 100)}%`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-[13px] py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-bold" style={{ color: NAVY }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-500 mb-3">Top Contagion Spreaders</p>
              {contagion.data.model?.top_spreaders?.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-[13px] font-medium">{s.cohort_label}</span>
                  <div className="flex gap-2 text-[11px] text-gray-500">
                    <span>Spread: <b style={{ color: '#F97316' }}>{Number(s.disengagement_spread).toFixed(3)}</b></span>
                    <span>Risk: {Number(s.avg_risk_score).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SIMULATION ── */}
      {activeTab === 'simulation' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-600 mb-3">Configure Simulation</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">Scenario</label>
                <select value={simScenario} onChange={e => setSimScenario(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  {SCENARIOS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">Population Size</label>
                <input type="number" value={simPop} onChange={e => setSimPop(Number(e.target.value))} min={10} max={500} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-28" />
              </div>
              <button onClick={() => runSimulation.mutate({ scenario: simScenario, population_size: simPop })} disabled={runSimulation.isPending} className="px-5 py-1.5 rounded-lg text-white text-sm font-bold hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: NAVY }}>
                <Play size={13} />{runSimulation.isPending ? 'Simulating…' : 'Run Simulation'}
              </button>
            </div>
          </div>

          {simResult && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[15px] font-bold" style={{ color: NAVY }}>{simResult.scenario_label}</p>
                <div className="flex gap-2">
                  <Badge color={NAVY}>n={simResult.population_size}</Badge>
                  <Badge color="#8B5CF6">{simResult.timeline_weeks}w timeline</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <KpiCard label="Avg CSI" value={simResult.avg_csi} color={NAVY} />
                <KpiCard label="Avg Burnout" value={`${simResult.avg_burnout}%`} color="#EF4444" />
                <KpiCard label="Intervention Efficacy" value={`${Math.round(simResult.intervention_efficacy * 100)}%`} color="#10B981" />
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {Object.entries(simResult.outcomes || {}).map(([label, count]) => (
                  <div key={label} className="rounded-lg p-2 text-center" style={{ backgroundColor: `${{ thriving: '#10B981', stable: '#3B82F6', at_risk: '#F59E0B', deteriorating: '#F97316', collapsed: '#EF4444' }[label] || '#6B7280'}10` }}>
                    <p className="text-[20px] font-black" style={{ color: { thriving: '#10B981', stable: '#3B82F6', at_risk: '#F59E0B', deteriorating: '#F97316', collapsed: '#EF4444' }[label] || '#6B7280' }}>{count as number}</p>
                    <p className="text-[11px] text-gray-500 capitalize">{label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {simResult.insights?.map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
                    <span style={{ color: NAVY }}>→</span>{insight}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[13px] font-bold text-gray-500 mb-3">Simulation History</p>
            <div className="space-y-2">
              {simHistory.data?.runs?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-[12px]">
                  <span className="font-medium">{r.simulation_name}</span>
                  <div className="flex gap-3 text-gray-500">
                    <span>n={r.population_size}</span>
                    <Badge color="#10B981">{r.status}</Badge>
                    <span>{new Date(r.ran_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {!simHistory.data?.runs?.length && <p className="text-gray-400 text-[13px]">No simulations run yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
