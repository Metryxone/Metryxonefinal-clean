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

export default function IILGovernancePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [instId, setInstId] = useState('');
  const [simType, setSimType] = useState('resilience_recovery');
  const [forecastType, setForecastType] = useState('institutional_health');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['iil-gov-master'], queryFn: () => fetchJson('/api/admin/iil/governance/master'), enabled: tab === 'master', refetchInterval: 30000 });
  const simsQ = useQuery({ queryKey: ['iil-sims'], queryFn: () => fetchJson('/api/admin/iil/simulations/dashboard'), enabled: tab === 'simulations' });
  const forecastsQ = useQuery({ queryKey: ['iil-forecasts'], queryFn: () => fetchJson('/api/admin/iil/forecasts/dashboard'), enabled: tab === 'forecasts' });
  const fairnessQ = useQuery({ queryKey: ['iil-fairness'], queryFn: () => fetchJson('/api/admin/iil/fairness/dashboard'), enabled: tab === 'fairness' });
  const govQ = useQuery({ queryKey: ['iil-gov'], queryFn: () => fetchJson('/api/admin/iil/governance/dashboard'), enabled: tab === 'governance' });
  const explainQ = useQuery({ queryKey: ['iil-explain'], queryFn: () => fetchJson('/api/admin/iil/explainability/logs?limit=20'), enabled: tab === 'explainability' });
  const safetyQ = useQuery({ queryKey: ['iil-safety'], queryFn: () => fetchJson('/api/admin/iil/safety/dashboard'), enabled: tab === 'safety' });
  const researchQ = useQuery({ queryKey: ['iil-research'], queryFn: () => fetchJson('/api/admin/iil/research/dashboard'), enabled: tab === 'research' });
  const evolutionQ = useQuery({ queryKey: ['iil-evolution'], queryFn: () => fetchJson('/api/admin/iil/self-evolution/dashboard'), enabled: tab === 'evolution' });
  const eventsQ = useQuery({ queryKey: ['iil-events'], queryFn: () => fetchJson('/api/admin/iil/events/log?limit=30'), enabled: tab === 'events' });
  const auditQ = useQuery({ queryKey: ['iil-audit'], queryFn: () => fetchJson('/api/admin/iil/audit?limit=30'), enabled: tab === 'audit' });

  const runSim = useMutation({
    mutationFn: () => fetch('/api/iil/simulations/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId, simulation_type: simType, iterations: 200 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-sims'] })
  });
  const genForecast = useMutation({
    mutationFn: () => fetch('/api/iil/forecasts/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId, outcome_type: forecastType, forecast_horizon: '90d' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-forecasts'] })
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Overview' }, { id: 'simulations', label: 'Simulations' }, { id: 'forecasts', label: 'Forecast Market' },
    { id: 'fairness', label: 'Fairness' }, { id: 'governance', label: 'Governance' }, { id: 'explainability', label: 'Explainability' },
    { id: 'safety', label: 'AI Safety' }, { id: 'research', label: 'Research' }, { id: 'evolution', label: 'Self-Evolution' },
    { id: 'events', label: 'Events' }, { id: 'audit', label: 'Audit' }
  ];

  const SIM_TYPES = ['ecosystem_instability','resilience_recovery','workforce_evolution','collapse','innovation_acceleration','policy_optimization'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: GOV }}>🛡</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">IIL — Institutional Governance & Intelligence</h2>
          <p className="text-xs text-gray-500">Sections 27–40: Simulation, Forecast Market, Fairness, Governance, Explainability, AI Safety, Research, Self-Evolution, Events, Audit</p>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input placeholder="Institution ID" value={instId} onChange={e => setInstId(e.target.value)} className="max-w-xs" />
        {tab === 'simulations' && (
          <>
            <select className="border rounded-lg px-3 py-2 text-sm" value={simType} onChange={e => setSimType(e.target.value)}>
              {SIM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <Button onClick={() => runSim.mutate()} disabled={!instId || runSim.isPending} style={{ background: GOV, color: '#fff' }}>
              {runSim.isPending ? 'Running…' : 'Run Simulation'}
            </Button>
          </>
        )}
        {tab === 'forecasts' && (
          <>
            <Input placeholder="Outcome Type" value={forecastType} onChange={e => setForecastType(e.target.value)} className="max-w-xs" />
            <Button onClick={() => genForecast.mutate()} disabled={!instId || genForecast.isPending} style={{ background: GOV, color: '#fff' }}>Generate Forecast</Button>
          </>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: GOV } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'master' && masterQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Simulations Done" value={masterQ.data.simulations?.done} color={GOV} />
          <KpiCard label="Simulations Running" value={masterQ.data.simulations?.running} color="#F59E0B" />
          <KpiCard label="Total Forecasts" value={masterQ.data.forecasts} />
          <KpiCard label="Fairness Open" value={masterQ.data.fairness_open} color="#F59E0B" />
          <KpiCard label="Governance Pending" value={masterQ.data.governance_pending} color="#F59E0B" />
          <KpiCard label="Safety Violations" value={masterQ.data.safety_violations} color="#EF4444" />
          <KpiCard label="Research Experiments" value={masterQ.data.research_experiments} color={GOV} />
          <KpiCard label="Evolution Logs" value={masterQ.data.evolution_logs} color={GOV} />
        </div>
      )}

      {tab === 'simulations' && simsQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Simulations" value={simsQ.data.kpis?.total} color={GOV} />
          <div className="grid grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle className="text-sm">By Type</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(simsQ.data.type_breakdown || []).map((t: any) => (
                  <div key={t.simulation_type} className="flex items-center gap-2">
                    <span className="text-xs w-32 truncate capitalize">{t.simulation_type?.replace(/_/g, ' ')}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: GOV, width: `${Math.min(100, parseInt(t.cnt) * 20)}%` }} /></div>
                    <span className="text-xs font-semibold">{t.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(simsQ.data.status_distribution || []).map((s: any) => (
                  <div key={s.status} className="flex justify-between text-xs">
                    <span className="capitalize">{s.status}</span>
                    <span className="font-semibold">{s.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'safety' && safetyQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Violations" value={safetyQ.data.kpis?.total_violations} color="#EF4444" />
            <KpiCard label="Triggered Constraints" value={safetyQ.data.kpis?.triggered_constraints} color="#F59E0B" />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Safety Constraints</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">
              {(safetyQ.data.constraints || []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b text-xs">
                  <div>
                    <p className="font-medium">{c.constraint_name}</p>
                    <p className="text-gray-500 capitalize">{c.constraint_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Triggered: {c.triggered_count}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Disabled'}</span>
                  </div>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'research' && researchQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Experiments" value={researchQ.data.kpis?.total} color={GOV} />
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Experiment','Type','Status','Institution'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(researchQ.data.recent_experiments || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.experiment_name}</td>
                    <td className="px-3 py-2 capitalize">{r.experiment_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'complete' ? 'bg-green-100 text-green-700' : r.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                    <td className="px-3 py-2">{r.institution_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!researchQ.data.recent_experiments?.length && <p className="text-center text-xs text-gray-400 py-6">No experiments yet.</p>}
          </div>
        </div>
      )}

      {tab === 'evolution' && evolutionQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Evolutions" value={evolutionQ.data.kpis?.total_evolutions} color={GOV} />
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Component','Evolution Type','Delta','Approved','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(evolutionQ.data.recent_evolutions || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.model_component}</td>
                    <td className="px-3 py-2 capitalize">{r.evolution_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2" style={{ color: parseFloat(r.performance_delta) > 0 ? '#10B981' : '#EF4444' }}>{parseFloat(r.performance_delta) > 0 ? '+' : ''}{r.performance_delta}</td>
                    <td className="px-3 py-2">{r.approved ? '✓' : 'Pending'}</td>
                    <td className="px-3 py-2">{new Date(r.evolved_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!evolutionQ.data.recent_evolutions?.length && <p className="text-center text-xs text-gray-400 py-6">No evolution logs yet.</p>}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b"><tr>{['Event Type','Institution','Payload Preview','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {(eventsQ.data?.rows || []).map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.event_type}</td>
                  <td className="px-3 py-2">{r.institution_name || r.institution_id?.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-gray-400">{JSON.stringify(r.payload || {}).slice(0, 60)}…</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!eventsQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No events yet.</p>}
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b"><tr>{['Actor','Action','Resource','Institution','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {(auditQ.data?.rows || []).map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{r.actor || '—'}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">{r.resource_type || '—'}</td>
                  <td className="px-3 py-2">{r.institution_name || '—'}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!auditQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No audit records yet.</p>}
        </div>
      )}

      {tab === 'fairness' && fairnessQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Audits" value={fairnessQ.data.kpis?.total} />
            <KpiCard label="Unresolved" value={fairnessQ.data.kpis?.unresolved} color="#EF4444" />
          </div>
        </div>
      )}

      {tab === 'governance' && govQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Total Records" value={govQ.data.kpis?.total} />
            <KpiCard label="Pending" value={govQ.data.kpis?.pending} color="#F59E0B" />
            <KpiCard label="Escalated" value={govQ.data.kpis?.escalated} color="#EF4444" />
          </div>
        </div>
      )}

      {tab === 'explainability' && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b"><tr>{['Insight Type','Risk','Confidence','Institution','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {(explainQ.data?.rows || []).map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{r.insight_type}</td>
                  <td className="px-3 py-2">{r.institutional_risk || '—'}</td>
                  <td className="px-3 py-2">{(parseFloat(r.confidence) * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2">{r.institution_name || '—'}</td>
                  <td className="px-3 py-2">{new Date(r.generated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!explainQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No explainability logs yet.</p>}
        </div>
      )}

      {tab === 'forecasts' && forecastsQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Forecasts" value={forecastsQ.data.kpis?.total} color={GOV} />
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Outcome Type','Horizon','Probability','CI Low','CI High','Institution'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(forecastsQ.data.recent_forecasts || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.outcome_type}</td>
                    <td className="px-3 py-2">{r.forecast_horizon}</td>
                    <td className="px-3 py-2 font-bold">{(parseFloat(r.probability) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{(parseFloat(r.confidence_interval_low || 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{(parseFloat(r.confidence_interval_high || 0) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{r.institution_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!forecastsQ.data.recent_forecasts?.length && <p className="text-center text-xs text-gray-400 py-6">No forecasts yet. Enter an institution ID and generate above.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
