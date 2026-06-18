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

export default function NHDAIntelligencePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [regionId, setRegionId] = useState('');
  const [simType, setSimType] = useState('workforce_evolution');
  const [nodeKey, setNodeKey] = useState('');
  const [nodeType, setNodeType] = useState('Citizen');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['nhda-intel-master'], queryFn: () => fetchJson('/api/admin/nhda/intelligence/master'), enabled: tab === 'master', refetchInterval: 30000 });
  const driftQ = useQuery({ queryKey: ['nhda-drift'], queryFn: () => fetchJson('/api/admin/nhda/drift/dashboard'), enabled: tab === 'drift' });
  const contagionQ = useQuery({ queryKey: ['nhda-contagion'], queryFn: () => fetchJson('/api/admin/nhda/contagion/dashboard'), enabled: tab === 'contagion' });
  const graphQ = useQuery({ queryKey: ['nhda-graph'], queryFn: () => fetchJson('/api/admin/nhda/knowledge-graph/dashboard'), enabled: tab === 'graph' });
  const twinsQ = useQuery({ queryKey: ['nhda-twins'], queryFn: () => fetchJson('/api/admin/nhda/digital-twins/dashboard'), enabled: tab === 'digital-twins' });
  const civQ = useQuery({ queryKey: ['nhda-civ'], queryFn: () => fetchJson('/api/admin/nhda/civilization/dashboard'), enabled: tab === 'civilization' });
  const simsQ = useQuery({ queryKey: ['nhda-sims'], queryFn: () => fetchJson('/api/admin/nhda/simulations/dashboard'), enabled: tab === 'simulations' });
  const forecastsQ = useQuery({ queryKey: ['nhda-forecasts'], queryFn: () => fetchJson('/api/admin/nhda/forecasts/dashboard'), enabled: tab === 'forecasts' });

  const recordDrift = useMutation({
    mutationFn: () => fetch('/api/nhda/drift/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-drift'] })
  });
  const detectContagion = useMutation({
    mutationFn: () => fetch('/api/nhda/contagion/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, contagion_type: 'burnout', severity: 'moderate', affected_population: 50000, spread_velocity: 2.5 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-contagion'] })
  });
  const addNode = useMutation({
    mutationFn: () => fetch('/api/nhda/knowledge-graph/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, node_type: nodeType, node_key: nodeKey, node_label: nodeKey }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nhda-graph'] }); setNodeKey(''); }
  });
  const syncTwin = useMutation({
    mutationFn: () => fetch('/api/nhda/digital-twin/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, twin_type: 'population', twin_state: { synced_at: new Date().toISOString() } }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-twins'] })
  });
  const calcCiv = useMutation({
    mutationFn: () => fetch('/api/nhda/civilization/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-civ'] })
  });
  const runSim = useMutation({
    mutationFn: () => fetch('/api/nhda/simulations/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, simulation_type: simType, iterations: 200 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-sims'] })
  });
  const genForecast = useMutation({
    mutationFn: () => fetch('/api/nhda/forecasts/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, outcome_type: 'workforce_development', forecast_horizon: '1y' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-forecasts'] })
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Overview' }, { id: 'drift', label: 'Drift & Entropy' }, { id: 'contagion', label: 'Contagion' },
    { id: 'graph', label: 'Knowledge Graph' }, { id: 'digital-twins', label: 'Digital Twins' }, { id: 'civilization', label: 'Civilization' },
    { id: 'simulations', label: 'Simulations' }, { id: 'forecasts', label: 'Forecast Market' }
  ];
  const SIM_TYPES = ['workforce_evolution','resilience_recovery','innovation_acceleration','educational_reform_impact','societal_collapse_prevention','policy_optimization'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: NHDA_INTEL }}>🔮</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">NHDA — National Intelligence Layer</h2>
          <p className="text-xs text-gray-500">Sections 13–20: Drift, Contagion, Knowledge Graph, Digital Twins, Civilization, Simulation, Forecast Market</p>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input placeholder="Region ID" value={regionId} onChange={e => setRegionId(e.target.value)} className="max-w-xs" />
        {tab === 'drift' && <Button onClick={() => recordDrift.mutate()} disabled={!regionId || recordDrift.isPending} style={{ background: NHDA_INTEL, color: '#fff' }}>Record Drift</Button>}
        {tab === 'contagion' && <Button onClick={() => detectContagion.mutate()} disabled={!regionId || detectContagion.isPending} style={{ background: '#EF4444', color: '#fff' }}>Detect Contagion</Button>}
        {tab === 'graph' && (<>
          <Input placeholder="Node Key" value={nodeKey} onChange={e => setNodeKey(e.target.value)} className="max-w-xs" />
          <select className="border rounded-lg px-3 py-2 text-sm" value={nodeType} onChange={e => setNodeType(e.target.value)}>
            {['Citizen','Institution','Workforce','Behaviour','Outcome','Policy','Risk','Opportunity'].map(t => <option key={t}>{t}</option>)}
          </select>
          <Button onClick={() => addNode.mutate()} disabled={!nodeKey || addNode.isPending} style={{ background: NHDA_INTEL, color: '#fff' }}>Add Node</Button>
        </>)}
        {tab === 'digital-twins' && <Button onClick={() => syncTwin.mutate()} disabled={!regionId || syncTwin.isPending} style={{ background: NHDA_INTEL, color: '#fff' }}>Sync Twin</Button>}
        {tab === 'civilization' && <Button onClick={() => calcCiv.mutate()} disabled={!regionId || calcCiv.isPending} style={{ background: NHDA_INTEL, color: '#fff' }}>Calculate Civilization</Button>}
        {tab === 'simulations' && (<>
          <select className="border rounded-lg px-3 py-2 text-sm" value={simType} onChange={e => setSimType(e.target.value)}>
            {SIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <Button onClick={() => runSim.mutate()} disabled={!regionId || runSim.isPending} style={{ background: NHDA_INTEL, color: '#fff' }}>{runSim.isPending ? 'Running…' : 'Run Simulation'}</Button>
        </>)}
        {tab === 'forecasts' && <Button onClick={() => genForecast.mutate()} disabled={!regionId || genForecast.isPending} style={{ background: NHDA_INTEL, color: '#fff' }}>Generate Forecast</Button>}
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: NHDA_INTEL } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'master' && masterQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Entropy (7d)" value={masterQ.data.avg_entropy_7d} color="#F59E0B" />
          <KpiCard label="Critical Drift Alerts" value={masterQ.data.critical_drift_alerts} color="#EF4444" />
          <KpiCard label="Spreading Contagions" value={masterQ.data.spreading_contagions} color="#EF4444" />
          <KpiCard label="Knowledge Nodes" value={masterQ.data.knowledge_nodes} color={NHDA_INTEL} />
          <KpiCard label="Active Digital Twins" value={masterQ.data.active_digital_twins} color={NHDA_INTEL} />
          <KpiCard label="Avg Civilization Evolution" value={masterQ.data.avg_civilization_evolution} color="#10B981" />
          <KpiCard label="Total Simulations" value={masterQ.data.total_simulations} />
          <KpiCard label="Total Forecasts" value={masterQ.data.total_forecasts} />
        </div>
      )}

      {tab === 'drift' && driftQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Avg Entropy Score" value={driftQ.data.kpis?.avg_entropy} color="#F59E0B" />
            <KpiCard label="Avg Workforce Drift" value={driftQ.data.kpis?.avg_workforce_drift} />
            <KpiCard label="Avg Fragmentation" value={driftQ.data.kpis?.avg_fragmentation} color="#EF4444" />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Alert Level Distribution</CardTitle></CardHeader>
            <CardContent><div className="flex gap-3 flex-wrap">
              {(driftQ.data.alert_distribution || []).map((a: any) => (
                <div key={a.alert_level} className="text-center px-4 py-2 rounded-lg bg-gray-50 border">
                  <p className="text-xs text-gray-500 capitalize">{a.alert_level}</p>
                  <p className="text-xl font-bold" style={{ color: a.alert_level === 'critical' ? '#EF4444' : a.alert_level === 'warning' ? '#F59E0B' : '#6B7280' }}>{a.cnt}</p>
                </div>
              ))}
            </div></CardContent>
          </Card>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Entropy','WF Drift','Edu Drift','Alert'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(driftQ.data.region_snapshots || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name}</td>
                    <td className="px-3 py-2 font-semibold">{r.entropy_score}</td>
                    <td className="px-3 py-2">{r.workforce_drift}</td>
                    <td className="px-3 py-2">{r.educational_drift}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.alert_level === 'critical' ? 'bg-red-100 text-red-700' : r.alert_level === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{r.alert_level}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'contagion' && contagionQ.data && (
        <div className="space-y-4">
          <KpiCard label="Spreading Events" value={contagionQ.data.kpis?.spreading} color="#EF4444" />
          <div className="grid grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle className="text-sm">By Type</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(contagionQ.data.type_breakdown || []).map((t: any) => (
                  <div key={t.contagion_type} className="flex items-center gap-2">
                    <span className="text-xs w-20 capitalize">{t.contagion_type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-purple-500" style={{ width: `${Math.min(100, parseInt(t.cnt) * 20)}%` }} /></div>
                    <span className="text-xs font-semibold">{t.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm">By Severity</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(contagionQ.data.severity_distribution || []).map((s: any) => (
                  <div key={s.severity} className="flex justify-between items-center text-xs">
                    <span className="capitalize">{s.severity}</span>
                    <span className="font-bold">{s.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'graph' && graphQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Nodes" value={graphQ.data.kpis?.nodes} color={NHDA_INTEL} />
            <KpiCard label="Total Edges" value={graphQ.data.kpis?.edges} color={NHDA_INTEL} />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Node Type Distribution</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">
              {(graphQ.data.node_types || []).map((t: any) => (
                <div key={t.node_type} className="flex items-center gap-2">
                  <span className="text-xs w-24">{t.node_type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: NHDA_INTEL, width: `${Math.min(100, parseInt(t.cnt) * 15)}%` }} /></div>
                  <span className="text-xs font-semibold">{t.cnt}</span>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'digital-twins' && twinsQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Twins" value={twinsQ.data.kpis?.total} color={NHDA_INTEL} />
            <KpiCard label="Simulation Ready" value={twinsQ.data.kpis?.simulation_ready} color="#10B981" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Twin Type','Version','Ready','Last Sync'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(twinsQ.data.twins || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name}</td>
                    <td className="px-3 py-2 capitalize">{r.twin_type}</td>
                    <td className="px-3 py-2">v{r.twin_version}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.simulation_ready ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.simulation_ready ? 'Ready' : 'Pending'}</span></td>
                    <td className="px-3 py-2">{new Date(r.last_sync_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'civilization' && civQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Avg Evolution Score" value={civQ.data.kpis?.avg_evolution} color="#10B981" />
            <KpiCard label="Avg Resilience" value={civQ.data.kpis?.avg_resilience} />
            <KpiCard label="Avg Innovation Sustainability" value={civQ.data.kpis?.avg_innovation} />
            <KpiCard label="Stagnating Regions" value={civQ.data.kpis?.stagnating_regions} color="#EF4444" />
          </div>
        </div>
      )}

      {tab === 'simulations' && simsQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Simulations" value={simsQ.data.kpis?.total} color={NHDA_INTEL} />
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Type','Status','Confidence','Created'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(simsQ.data.recent_simulations || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name}</td>
                    <td className="px-3 py-2 capitalize">{r.simulation_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'complete' ? 'bg-green-100 text-green-700' : r.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                    <td className="px-3 py-2">{r.confidence ? (parseFloat(r.confidence) * 100).toFixed(0) + '%' : '—'}</td>
                    <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'forecasts' && forecastsQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Forecasts" value={forecastsQ.data.kpis?.total} color={NHDA_INTEL} />
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Outcome','Horizon','Probability','CI Range'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(forecastsQ.data.recent_forecasts || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name}</td>
                    <td className="px-3 py-2">{r.outcome_type}</td>
                    <td className="px-3 py-2">{r.forecast_horizon}</td>
                    <td className="px-3 py-2 font-bold">{(parseFloat(r.probability) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{(parseFloat(r.confidence_interval_low || 0) * 100).toFixed(1)}–{(parseFloat(r.confidence_interval_high || 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!forecastsQ.data.recent_forecasts?.length && <p className="text-center text-xs text-gray-400 py-6">No forecasts yet. Enter a region ID and generate above.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
