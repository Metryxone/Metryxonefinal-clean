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
import SimulatedDataBanner from './SimulatedDataBanner';

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

export default function PAIEIntelligencePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [userId, setUserId] = useState('');
  const [traverseKey, setTraverseKey] = useState('screen_addiction');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['paie-intel-master'], queryFn: () => fetchJson('/api/admin/paie/intelligence/master') });
  const causalQ = useQuery({ queryKey: ['paie-causal'], queryFn: () => fetchJson('/api/admin/paie/causal/dashboard'), enabled: tab === 'causal' });
  const graphQ = useQuery({ queryKey: ['paie-graph'], queryFn: () => fetchJson('/api/admin/paie/graph/dashboard'), enabled: tab === 'graph' });
  const traverseQ = useQuery({ queryKey: ['paie-traverse', traverseKey], queryFn: () => fetchJson(`/api/admin/paie/graph/traverse?node_key=${traverseKey}`), enabled: false });
  const popQ = useQuery({ queryKey: ['paie-pop'], queryFn: () => fetchJson('/api/admin/paie/population/dashboard'), enabled: tab === 'population' });
  const instQ = useQuery({ queryKey: ['paie-inst'], queryFn: () => fetchJson('/api/admin/paie/institutional/dashboard'), enabled: tab === 'institutional' });
  const socioQ = useQuery({ queryKey: ['paie-socio'], queryFn: () => fetchJson('/api/admin/paie/socioeconomic/dashboard'), enabled: tab === 'socioeconomic' });

  const detectCausal = useMutation({
    mutationFn: () => fetch('/api/paie/causal/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-causal'] })
  });

  const seedGraph = useMutation({
    mutationFn: () => fetch('/api/paie/graph/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paie-graph'] }); alert('Graph seeded!'); }
  });

  const computePop = useMutation({
    mutationFn: () => fetch('/api/paie/population/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cohort_type: 'school', cohort_size: 50 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-pop'] })
  });

  const computeInst = useMutation({
    mutationFn: () => fetch('/api/paie/institutional/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: `inst_${Date.now()}`, institution_name: 'Sample Institution' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-inst'] })
  });

  const profileSocio = useMutation({
    mutationFn: () => fetch('/api/paie/socioeconomic/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-socio'] })
  });

  const tabs = [
    { id: 'master' as Tab, label: 'Master Dashboard' },
    { id: 'causal' as Tab, label: 'Semantic Causal' },
    { id: 'graph' as Tab, label: 'Knowledge Graph' },
    { id: 'population' as Tab, label: 'Population' },
    { id: 'institutional' as Tab, label: 'Institutional Collapse' },
    { id: 'socioeconomic' as Tab, label: 'Socioeconomic' },
  ];

  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';
  const num = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '—';
  const master = masterQ.data;

  return (
    <div className="space-y-4">
      <SimulatedDataBanner />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>PAIE — Intelligence Engine</h2>
          <p className="text-sm text-gray-500">Sections 14–18 · Semantic Causal, Knowledge Graph, Population, Institutional, Socioeconomic</p>
        </div>
        <div className="flex gap-2 items-center">
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-48" />
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${tab === t.id ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            style={tab === t.id ? { background: NAV } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* MASTER */}
      {tab === 'master' && master && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Causal Chains" value={master.causal?.chains} sub={`${master.causal?.hidden_patterns || 0} hidden`} />
            <KpiCard label="Graph Nodes" value={master.graph?.nodes} />
            <KpiCard label="Graph Edges" value={master.graph?.edges} />
            <KpiCard label="Cohorts Tracked" value={master.population?.cohorts} sub={`${master.population?.burnout_count || 0} burnout`} color="#f97316" />
            <KpiCard label="Institutions" value={master.institutional?.institutions} color="#a855f7" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Causal Intelligence</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Causal Strength</span><span className="font-bold">{pct(master.causal?.avg_strength)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Hidden Patterns</span><span className="font-bold text-orange-500">{master.causal?.hidden_patterns || 0}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Ecosystem Health</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Fragility</span><span className="font-bold text-orange-500">{pct(master.population?.avg_fragility)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Socioeconomic Users</span><span className="font-bold">{master.socioeconomic?.users || 0}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Financial Stress</span><span className="font-bold text-red-500">{pct(master.socioeconomic?.avg_fsi)}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* CAUSAL */}
      {tab === 'causal' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => detectCausal.mutate()} disabled={!userId || detectCausal.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {detectCausal.isPending ? 'Detecting…' : 'Detect Causal Chains'}
            </Button>
          </div>
          {causalQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {causalQ.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Chains" value={causalQ.data.stats?.total} />
                <KpiCard label="Avg Strength" value={pct(causalQ.data.stats?.avg_strength)} />
                <KpiCard label="Hidden Patterns" value={causalQ.data.stats?.hidden_patterns} color="#a855f7" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Causal Chain Patterns</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Chain</th><th>Cause</th><th>Effect</th><th>Avg Strength</th><th>Hidden</th><th>Count</th></tr></thead>
                    <tbody>{(causalQ.data.chains || []).map((r: any) => (
                      <tr key={r.chain_name} className="border-t">
                        <td className="py-1 font-medium">{r.chain_name?.replace(/_/g,' ')}</td>
                        <td className="text-gray-600">{r.cause?.replace(/_/g,' ')}</td>
                        <td className="text-gray-600">{r.effect?.replace(/_/g,' ')}</td>
                        <td className="font-semibold">{pct(r.avg_strength)}</td>
                        <td>{parseInt(r.hidden_count) > 0 ? <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">{r.hidden_count}</span> : '—'}</td>
                        <td style={{ color: NAV }}>{r.cnt}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* GRAPH */}
      {tab === 'graph' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <Button onClick={() => seedGraph.mutate()} disabled={seedGraph.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {seedGraph.isPending ? 'Seeding…' : 'Seed Knowledge Graph'}
            </Button>
            <input value={traverseKey} onChange={e => setTraverseKey(e.target.value)} placeholder="node_key" className="border rounded px-2 py-1.5 text-sm w-40" />
            <Button onClick={() => traverseQ.refetch()} disabled={traverseQ.isFetching} size="sm" variant="outline">Traverse</Button>
          </div>
          {graphQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {graphQ.data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Total Nodes" value={graphQ.data.stats?.total_nodes} />
                <KpiCard label="Total Edges" value={graphQ.data.stats?.total_edges} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Nodes by Type</CardTitle></CardHeader>
                  <CardContent>{(graphQ.data.nodes_by_type || []).map((r: any) => (
                    <div key={r.node_type} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700 capitalize">{r.node_type}</span>
                      <span className="font-bold text-sm" style={{ color: NAV }}>{r.cnt}</span>
                    </div>
                  ))}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Top Connected Nodes</CardTitle></CardHeader>
                  <CardContent>{(graphQ.data.top_nodes || []).map((r: any) => (
                    <div key={r.label} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs truncate max-w-[140px]">{r.label}</span>
                      <span className="text-xs text-gray-500">{r.node_type} · {r.connections} conn</span>
                    </div>
                  ))}</CardContent>
                </Card>
              </div>
              {traverseQ.data && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Traversal: {traverseQ.data.root?.label}</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Neighbor</th><th>Type</th><th>Relationship</th><th>Weight</th></tr></thead>
                      <tbody>{(traverseQ.data.neighbors || []).map((r: any) => <tr key={r.id} className="border-t"><td className="py-1">{r.label}</td><td className="text-gray-500">{r.node_type}</td><td>{r.relationship}</td><td>{num(r.weight, 2)}</td></tr>)}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* POPULATION */}
      {tab === 'population' && (
        <div className="space-y-4">
          <Button onClick={() => computePop.mutate()} disabled={computePop.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {computePop.isPending ? 'Computing…' : 'Compute Population Forecast'}
          </Button>
          {popQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {popQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Cohorts" value={popQ.data.kpi?.cohorts} />
                <KpiCard label="Avg Fragility" value={pct(popQ.data.kpi?.avg_fragility)} color="#f97316" />
                <KpiCard label="Avg Engagement" value={pct(popQ.data.kpi?.avg_engagement)} color="#10b981" />
                <KpiCard label="Burnout Institutions" value={popQ.data.kpi?.burnout_institutions} color="#dc2626" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">By Cohort Type</CardTitle></CardHeader>
                  <CardContent>{(popQ.data.by_type || []).map((r: any) => (
                    <div key={r.cohort_type} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs capitalize">{r.cohort_type}</span>
                      <span className="text-xs">{r.cnt} cohorts · {pct(r.avg_fragility)} fragility</span>
                    </div>
                  ))}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Cohort Trajectories</CardTitle></CardHeader>
                  <CardContent>{(popQ.data.trajectories || []).map((r: any) => (
                    <div key={r.cohort_trajectory} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TRAJ_COLORS[r.cohort_trajectory] || 'bg-gray-100'}`}>{r.cohort_trajectory}</span>
                      <span className="font-bold text-sm" style={{ color: NAV }}>{r.cnt}</span>
                    </div>
                  ))}</CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* INSTITUTIONAL */}
      {tab === 'institutional' && (
        <div className="space-y-4">
          <Button onClick={() => computeInst.mutate()} disabled={computeInst.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {computeInst.isPending ? 'Forecasting…' : 'Forecast Institution'}
          </Button>
          {instQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {instQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Institutions" value={instQ.data.kpi?.total} />
                <KpiCard label="Avg Disengagement" value={pct(instQ.data.kpi?.avg_disengagement)} color="#f97316" />
                <KpiCard label="Avg Collapse Risk" value={pct(instQ.data.kpi?.avg_collapse_risk)} color="#dc2626" />
                <KpiCard label="At-Risk" value={instQ.data.kpi?.at_risk_count} color="#dc2626" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Institutions (sorted by collapse risk)</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Institution</th><th>Collapse Risk</th><th>Burnout Risk</th><th>Stabilization</th><th>Timeline (days)</th></tr></thead>
                    <tbody>{(instQ.data.institutions || []).slice(0, 15).map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1">{r.institution_name || r.institution_id}</td>
                        <td className={parseFloat(r.resilience_ecosystem_collapse_risk) > 0.6 ? 'text-red-600 font-bold' : 'font-semibold'}>{pct(r.resilience_ecosystem_collapse_risk)}</td>
                        <td>{pct(r.cohort_burnout_risk)}</td>
                        <td className="text-green-600">{pct(r.stabilization_probability)}</td>
                        <td>{r.collapse_timeline_days ? <span className="text-red-600 font-bold">{r.collapse_timeline_days}d</span> : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* SOCIOECONOMIC */}
      {tab === 'socioeconomic' && (
        <div className="space-y-4">
          <Button onClick={() => profileSocio.mutate()} disabled={!userId || profileSocio.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {profileSocio.isPending ? 'Profiling…' : 'Create Socioeconomic Profile'}
          </Button>
          {socioQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {socioQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users Profiled" value={socioQ.data.kpi?.users} />
                <KpiCard label="Avg Financial Stress" value={pct(socioQ.data.kpi?.avg_fsi)} color="#dc2626" />
                <KpiCard label="Avg Deprivation" value={pct(socioQ.data.kpi?.avg_deprivation)} color="#f97316" />
                <KpiCard label="Avg Risk Delta" value={pct(socioQ.data.kpi?.avg_risk_delta)} color="#a855f7" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Socioeconomic Tier Distribution</CardTitle></CardHeader>
                <CardContent className="flex gap-4 flex-wrap">{(socioQ.data.by_tier || []).map((r: any) => (
                  <div key={r.socioeconomic_tier} className="text-center">
                    <span className="text-2xl font-bold" style={{ color: NAV }}>{r.cnt}</span>
                    <p className={`mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_COLORS[r.socioeconomic_tier] || 'bg-gray-100'}`}>{r.socioeconomic_tier?.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-500">{pct(r.avg_fsi)} stress</p>
                  </div>
                ))}</CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
