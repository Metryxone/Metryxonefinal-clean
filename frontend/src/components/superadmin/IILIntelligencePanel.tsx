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

export default function IILIntelligencePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [instId, setInstId] = useState('');
  const [nodeKey, setNodeKey] = useState('');
  const [nodeType, setNodeType] = useState('Institution');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['iil-intel-master'], queryFn: () => fetchJson('/api/admin/iil/intelligence/master'), enabled: tab === 'master', refetchInterval: 30000 });
  const economicQ = useQuery({ queryKey: ['iil-economic'], queryFn: () => fetchJson('/api/admin/iil/economic/dashboard'), enabled: tab === 'economic' });
  const reputationQ = useQuery({ queryKey: ['iil-reputation'], queryFn: () => fetchJson('/api/admin/iil/reputation/dashboard'), enabled: tab === 'reputation' });
  const lifecycleQ = useQuery({ queryKey: ['iil-lifecycle'], queryFn: () => fetchJson('/api/admin/iil/lifecycle/dashboard'), enabled: tab === 'lifecycle' });
  const graphQ = useQuery({ queryKey: ['iil-graph'], queryFn: () => fetchJson('/api/admin/iil/knowledge-graph/dashboard'), enabled: tab === 'graph' });
  const causalQ = useQuery({ queryKey: ['iil-causal'], queryFn: () => fetchJson('/api/admin/iil/causal/dashboard'), enabled: tab === 'causal' });
  const federatedQ = useQuery({ queryKey: ['iil-federated'], queryFn: () => fetchJson('/api/admin/iil/federated/dashboard'), enabled: tab === 'federated' });
  const twinsQ = useQuery({ queryKey: ['iil-twins'], queryFn: () => fetchJson('/api/admin/iil/digital-twins/dashboard'), enabled: tab === 'digital-twins' });

  const recordEconomic = useMutation({
    mutationFn: () => fetch('/api/iil/economic/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-economic'] })
  });
  const recordReputation = useMutation({
    mutationFn: () => fetch('/api/iil/reputation/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-reputation'] })
  });
  const addNode = useMutation({
    mutationFn: () => fetch('/api/iil/knowledge-graph/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId, node_type: nodeType, node_key: nodeKey, node_label: nodeKey }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iil-graph'] }); setNodeKey(''); }
  });
  const syncTwin = useMutation({
    mutationFn: () => fetch('/api/iil/digital-twin/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId, twin_state: { synced_at: new Date().toISOString() } }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-twins'] })
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Overview' }, { id: 'economic', label: 'Economic' }, { id: 'reputation', label: 'Reputation' },
    { id: 'lifecycle', label: 'Lifecycle' }, { id: 'graph', label: 'Knowledge Graph' }, { id: 'causal', label: 'Causal Chains' },
    { id: 'federated', label: 'Federated' }, { id: 'digital-twins', label: 'Digital Twins' }
  ];

  const STAGE_COLORS: Record<string, string> = { birth: 'bg-green-100 text-green-700', growth: 'bg-blue-100 text-blue-700', scaling: 'bg-indigo-100 text-indigo-700', maturity: 'bg-purple-100 text-purple-700', transformation: 'bg-yellow-100 text-yellow-700', decline: 'bg-red-100 text-red-700', recovery: 'bg-emerald-100 text-emerald-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: INTEL }}>🧠</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">IIL — Institutional Intelligence Layer</h2>
          <p className="text-xs text-gray-500">Sections 20–26: Economic, Reputation, Lifecycle, Knowledge Graph, Causal, Federated, Digital Twins</p>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input placeholder="Institution ID" value={instId} onChange={e => setInstId(e.target.value)} className="max-w-xs" />
        {tab === 'economic' && <Button onClick={() => recordEconomic.mutate()} disabled={!instId || recordEconomic.isPending} style={{ background: INTEL, color: '#fff' }}>Record Economic</Button>}
        {tab === 'reputation' && <Button onClick={() => recordReputation.mutate()} disabled={!instId || recordReputation.isPending} style={{ background: INTEL, color: '#fff' }}>Record Reputation</Button>}
        {tab === 'digital-twins' && <Button onClick={() => syncTwin.mutate()} disabled={!instId || syncTwin.isPending} style={{ background: INTEL, color: '#fff' }}>Sync Digital Twin</Button>}
        {tab === 'graph' && (
          <>
            <Input placeholder="Node Key" value={nodeKey} onChange={e => setNodeKey(e.target.value)} className="max-w-xs" />
            <select className="border rounded-lg px-3 py-2 text-sm" value={nodeType} onChange={e => setNodeType(e.target.value)}>
              {['Institution','Cohort','Behaviour','Intervention','Outcome','Domain','Risk','Opportunity'].map(t => <option key={t}>{t}</option>)}
            </select>
            <Button onClick={() => addNode.mutate()} disabled={!nodeKey || addNode.isPending} style={{ background: INTEL, color: '#fff' }}>Add Node</Button>
          </>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: INTEL } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'master' && masterQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Avg Sustainability" value={masterQ.data.avg_sustainability} color="#10B981" />
          <KpiCard label="Avg Reputation" value={masterQ.data.avg_reputation} />
          <KpiCard label="Knowledge Graph Nodes" value={masterQ.data.knowledge_graph_nodes} color={INTEL} />
          <KpiCard label="Causal Chains" value={masterQ.data.causal_chains} color={INTEL} />
          <KpiCard label="Active Digital Twins" value={masterQ.data.active_digital_twins} color={INTEL} />
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Top Lifecycle Stages</p>
            <div className="mt-1 space-y-1">
              {(masterQ.data.top_lifecycle_stages || []).map((s: any) => (
                <div key={s.lifecycle_stage} className="flex justify-between items-center text-xs">
                  <span className={`px-2 py-0.5 rounded-full ${STAGE_COLORS[s.lifecycle_stage] || 'bg-gray-100'}`}>{s.lifecycle_stage}</span>
                  <span className="font-semibold">{s.cnt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'economic' && economicQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Avg Sustainability" value={economicQ.data.kpis?.avg_sustainability} color="#10B981" />
            <KpiCard label="Avg Intervention ROI" value={economicQ.data.kpis?.avg_intervention_roi} color="#10B981" />
            <KpiCard label="Avg Workforce ROI" value={economicQ.data.kpis?.avg_workforce_roi} />
            <KpiCard label="Instability Alerts" value={economicQ.data.kpis?.economic_instability_alerts} color="#EF4444" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Institution','Sustainability','Int. ROI','Workforce ROI','Wastage'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(economicQ.data.snapshots?.rows || economicQ.data.snapshots || []).slice(0, 15).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.institution_name || r.institution_id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{r.sustainability_score}</td>
                    <td className="px-3 py-2">{r.intervention_roi}</td>
                    <td className="px-3 py-2">{r.workforce_roi}</td>
                    <td className="px-3 py-2">{(parseFloat(r.resource_wastage) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'graph' && graphQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Nodes" value={graphQ.data.kpis?.total_nodes} color={INTEL} />
            <KpiCard label="Total Edges" value={graphQ.data.kpis?.total_edges} color={INTEL} />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Node Type Distribution</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">
              {(graphQ.data.node_type_distribution || []).map((t: any) => (
                <div key={t.node_type} className="flex items-center gap-2">
                  <span className="text-xs w-24">{t.node_type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: INTEL, width: `${Math.min(100, parseInt(t.cnt) * 10)}%` }} /></div>
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
            <KpiCard label="Total Digital Twins" value={twinsQ.data.kpis?.total_twins} color={INTEL} />
            <KpiCard label="Simulation Ready" value={twinsQ.data.kpis?.simulation_ready} color="#10B981" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Institution','Version','Simulation Ready','Last Sync'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(twinsQ.data.twins || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.institution_name || r.institution_id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">v{r.twin_version}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.simulation_ready ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.simulation_ready ? 'Ready' : 'Not Ready'}</span></td>
                    <td className="px-3 py-2">{new Date(r.last_sync_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lifecycle' && lifecycleQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Transitions" value={lifecycleQ.data.kpis?.total_transitions} />
            <KpiCard label="Rebirths Initiated" value={lifecycleQ.data.kpis?.rebirths} color="#10B981" />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Current Stage Distribution</CardTitle></CardHeader>
            <CardContent><div className="flex gap-3 flex-wrap">
              {(lifecycleQ.data.stage_distribution || []).map((s: any) => (
                <div key={s.lifecycle_stage} className="text-center px-3 py-2 rounded-lg bg-gray-50 border">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[s.lifecycle_stage] || 'bg-gray-100'}`}>{s.lifecycle_stage}</span>
                  <p className="text-xl font-bold mt-1">{s.cnt}</p>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'causal' && causalQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Chains" value={causalQ.data.kpis?.total_chains} color={INTEL} />
            <KpiCard label="Validated" value={causalQ.data.kpis?.validated} color="#10B981" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Chain Name','Root Cause','Terminal Outcome','Probability','Validated'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(causalQ.data.causal_chains || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.chain_name}</td>
                    <td className="px-3 py-2">{r.root_cause}</td>
                    <td className="px-3 py-2">{r.terminal_outcome}</td>
                    <td className="px-3 py-2">{(parseFloat(r.probability) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{r.validated ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!causalQ.data.causal_chains?.length && <p className="text-center text-xs text-gray-400 py-6">No causal chains yet.</p>}
          </div>
        </div>
      )}

      {tab === 'federated' && federatedQ.data && (
        <div className="space-y-4">
          <KpiCard label="Total Federated Shares" value={federatedQ.data.kpis?.total_shared} color={INTEL} />
          <Card><CardHeader><CardTitle className="text-sm">Data Type Breakdown</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">
              {(federatedQ.data.type_breakdown || []).map((t: any) => (
                <div key={t.data_type} className="flex items-center gap-2">
                  <span className="text-xs w-32">{t.data_type?.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: INTEL, width: `${Math.min(100, parseInt(t.cnt) * 10)}%` }} /></div>
                  <span className="text-xs font-semibold">{t.cnt}</span>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'reputation' && reputationQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Composite Reputation" value={reputationQ.data.kpis?.avg_composite} color="#10B981" />
          <KpiCard label="Avg Employer Perception" value={reputationQ.data.kpis?.avg_employer} />
          <KpiCard label="Avg Degradation Risk" value={reputationQ.data.kpis?.avg_degradation} color="#EF4444" />
          <KpiCard label="Degrading Count" value={reputationQ.data.kpis?.degrading_count} color="#EF4444" />
        </div>
      )}
    </div>
  );
}
