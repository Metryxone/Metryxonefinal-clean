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

export default function NHDACorePanel() {
  const [tab, setTab] = useState<Tab>('os');
  const [regionForm, setRegionForm] = useState({ region_name: '', region_type: 'state', country: 'IN', population: '' });
  const [regionId, setRegionId] = useState('');
  const qc = useQueryClient();

  const osQ = useQuery({ queryKey: ['nhda-os'], queryFn: () => fetchJson('/api/nhda/os/status'), refetchInterval: 30000 });
  const masterQ = useQuery({ queryKey: ['nhda-core-master'], queryFn: () => fetchJson('/api/admin/nhda/core/master'), enabled: tab === 'os' });
  const regionsQ = useQuery({ queryKey: ['nhda-regions'], queryFn: () => fetchJson('/api/admin/nhda/regions?limit=50'), enabled: tab === 'regions' });
  const sigQ = useQuery({ queryKey: ['nhda-sig-dash'], queryFn: () => fetchJson('/api/admin/nhda/signals/dashboard'), enabled: tab === 'signals' });
  const genomeQ = useQuery({ queryKey: ['nhda-genome'], queryFn: () => fetchJson('/api/admin/nhda/genome/dashboard'), enabled: tab === 'genome' });
  const behavQ = useQuery({ queryKey: ['nhda-behav'], queryFn: () => fetchJson('/api/admin/nhda/behavioural-climate/dashboard'), enabled: tab === 'behavioural' });
  const emotQ = useQuery({ queryKey: ['nhda-emot'], queryFn: () => fetchJson('/api/admin/nhda/emotional-climate/dashboard'), enabled: tab === 'emotional' });
  const cogQ = useQuery({ queryKey: ['nhda-cog'], queryFn: () => fetchJson('/api/admin/nhda/cognitive-capacity/dashboard'), enabled: tab === 'cognitive' });
  const nhdiQ = useQuery({ queryKey: ['nhda-hdi'], queryFn: () => fetchJson('/api/admin/nhda/hdi/dashboard'), enabled: tab === 'nhdi' });
  const collapseQ = useQuery({ queryKey: ['nhda-collapse'], queryFn: () => fetchJson('/api/admin/nhda/collapse/dashboard'), enabled: tab === 'collapse' });
  const oppsQ = useQuery({ queryKey: ['nhda-opps'], queryFn: () => fetchJson('/api/admin/nhda/opportunities/dashboard'), enabled: tab === 'opportunities' });
  const cohesionQ = useQuery({ queryKey: ['nhda-cohesion'], queryFn: () => fetchJson('/api/admin/nhda/identity-cohesion/dashboard'), enabled: tab === 'cohesion' });
  const talentQ = useQuery({ queryKey: ['nhda-talent'], queryFn: () => fetchJson('/api/admin/nhda/talent-mobility/dashboard'), enabled: tab === 'talent' });

  const createRegion = useMutation({
    mutationFn: () => fetch('/api/admin/nhda/regions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...regionForm, population: parseInt(regionForm.population) || 0 }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nhda-regions'] }); setRegionForm({ region_name: '', region_type: 'state', country: 'IN', population: '' }); }
  });
  const ingestSignal = useMutation({
    mutationFn: (type: string) => fetch('/api/nhda/signals/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, signal_type: type, population_size: 10000 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-sig-dash'] })
  });
  const calcGenome = useMutation({
    mutationFn: () => fetch('/api/nhda/genome/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-genome'] })
  });
  const calcNHDI = useMutation({
    mutationFn: () => fetch('/api/nhda/hdi/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-hdi'] })
  });
  const recordBehav = useMutation({
    mutationFn: () => fetch('/api/nhda/behavioural-climate/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-behav'] })
  });
  const recordEmot = useMutation({
    mutationFn: () => fetch('/api/nhda/emotional-climate/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-emot'] })
  });
  const recordCog = useMutation({
    mutationFn: () => fetch('/api/nhda/cognitive-capacity/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-cog'] })
  });
  const forecastCollapse = useMutation({
    mutationFn: () => fetch('/api/nhda/collapse/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, forecast_type: 'workforce_instability' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-collapse'] })
  });
  const detectOpp = useMutation({
    mutationFn: () => fetch('/api/nhda/opportunities/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, opportunity_type: 'workforce_strength', title: 'Emerging workforce strength detected' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-opps'] })
  });
  const recordCohesion = useMutation({
    mutationFn: () => fetch('/api/nhda/identity-cohesion/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-cohesion'] })
  });
  const recordTalent = useMutation({
    mutationFn: () => fetch('/api/nhda/talent-mobility/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-talent'] })
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'os', label: 'Sovereign OS' }, { id: 'regions', label: 'Regions' }, { id: 'signals', label: 'Population Signals' },
    { id: 'genome', label: 'Human Genome' }, { id: 'behavioural', label: 'Behavioural Climate' }, { id: 'emotional', label: 'Emotional Climate' },
    { id: 'cognitive', label: 'Cognitive Capacity' }, { id: 'nhdi', label: 'NHDI Engine' }, { id: 'collapse', label: 'Collapse Forecast' },
    { id: 'opportunities', label: 'Opportunities' }, { id: 'cohesion', label: 'Identity & Cohesion' }, { id: 'talent', label: 'Talent Mobility' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: NHDA }}>🌏</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">NHDA — National Human Development Core</h2>
          <p className="text-xs text-gray-500">Sections 1–12: Sovereign OS, Population Signals, Genome, Climates, NHDI, Collapse, Opportunity, Cohesion, Talent</p>
        </div>
        <div className="ml-auto">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${osQ.data?.status?.includes('operational') ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{osQ.data?.status || 'checking…'}</span>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input placeholder="Region ID for calculations" value={regionId} onChange={e => setRegionId(e.target.value)} className="max-w-xs" />
        {tab === 'signals' && <Button onClick={() => ingestSignal.mutate('behavioural')} disabled={!regionId || ingestSignal.isPending} style={{ background: NHDA, color: '#fff' }}>Ingest Signal</Button>}
        {tab === 'genome' && <Button onClick={() => calcGenome.mutate()} disabled={!regionId || calcGenome.isPending} style={{ background: NHDA, color: '#fff' }}>Calculate Genome</Button>}
        {tab === 'nhdi' && <Button onClick={() => calcNHDI.mutate()} disabled={!regionId || calcNHDI.isPending} style={{ background: NHDA, color: '#fff' }}>Calculate NHDI</Button>}
        {tab === 'behavioural' && <Button onClick={() => recordBehav.mutate()} disabled={!regionId || recordBehav.isPending} style={{ background: NHDA, color: '#fff' }}>Record Climate</Button>}
        {tab === 'emotional' && <Button onClick={() => recordEmot.mutate()} disabled={!regionId || recordEmot.isPending} style={{ background: NHDA, color: '#fff' }}>Record Climate</Button>}
        {tab === 'cognitive' && <Button onClick={() => recordCog.mutate()} disabled={!regionId || recordCog.isPending} style={{ background: NHDA, color: '#fff' }}>Record Capacity</Button>}
        {tab === 'collapse' && <Button onClick={() => forecastCollapse.mutate()} disabled={!regionId || forecastCollapse.isPending} style={{ background: '#EF4444', color: '#fff' }}>Forecast Collapse</Button>}
        {tab === 'opportunities' && <Button onClick={() => detectOpp.mutate()} disabled={!regionId || detectOpp.isPending} style={{ background: '#10B981', color: '#fff' }}>Detect Opportunity</Button>}
        {tab === 'cohesion' && <Button onClick={() => recordCohesion.mutate()} disabled={!regionId || recordCohesion.isPending} style={{ background: NHDA, color: '#fff' }}>Record Cohesion</Button>}
        {tab === 'talent' && <Button onClick={() => recordTalent.mutate()} disabled={!regionId || recordTalent.isPending} style={{ background: NHDA, color: '#fff' }}>Record Mobility</Button>}
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: NHDA } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'os' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Active Regions" value={osQ.data?.active_regions ?? '—'} />
            <KpiCard label="Signals (24h)" value={osQ.data?.signals_24h ?? '—'} />
            <KpiCard label="National NHDI" value={osQ.data?.national_nhdi ?? '—'} color="#10B981" />
            <KpiCard label="Pending Events" value={osQ.data?.pending_events ?? '—'} />
          </div>
          {masterQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Total Regions" value={masterQ.data.regions?.total} />
              <KpiCard label="Avg NHDI" value={masterQ.data.avg_nhdi} color="#10B981" />
              <KpiCard label="Thriving Regions" value={masterQ.data.thriving_regions} color="#10B981" />
              <KpiCard label="Critical Collapse Risks" value={masterQ.data.critical_collapse_risks} color="#EF4444" />
              <KpiCard label="New Opportunities" value={masterQ.data.new_opportunities} color="#10B981" />
            </div>
          )}
          {osQ.data?.engines && (
            <Card><CardHeader><CardTitle className="text-sm">Sovereign Engine Status</CardTitle></CardHeader>
              <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(osQ.data.engines).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${v === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'regions' && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Add Region</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Region Name" value={regionForm.region_name} onChange={e => setRegionForm(f => ({ ...f, region_name: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-sm" value={regionForm.region_type} onChange={e => setRegionForm(f => ({ ...f, region_type: e.target.value }))}>
                {['national','state','district','city','zone'].map(t => <option key={t}>{t}</option>)}
              </select>
              <Input placeholder="Population" type="number" value={regionForm.population} onChange={e => setRegionForm(f => ({ ...f, population: e.target.value }))} />
              <Button onClick={() => createRegion.mutate()} disabled={!regionForm.region_name || createRegion.isPending} style={{ background: NHDA, color: '#fff' }}>Add Region</Button>
            </div></CardContent>
          </Card>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Type','Country','Population','ID'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(regionsQ.data?.rows || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setRegionId(r.id)}>
                    <td className="px-3 py-2 font-medium">{r.region_name}</td>
                    <td className="px-3 py-2 capitalize">{r.region_type}</td>
                    <td className="px-3 py-2">{r.country}</td>
                    <td className="px-3 py-2">{r.population?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{r.id?.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-center text-xs text-gray-400 py-2">Click a row to use its ID in calculations</p>
          </div>
        </div>
      )}

      {tab === 'signals' && sigQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Total Signals" value={sigQ.data.kpis?.total} />
            <KpiCard label="Anomaly Signals" value={sigQ.data.kpis?.anomalies} color="#F59E0B" />
            <KpiCard label="Systemic Signals" value={sigQ.data.kpis?.systemic} color="#EF4444" />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Signal Type Breakdown</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">
              {(sigQ.data.signal_types || []).map((s: any) => (
                <div key={s.signal_type} className="flex items-center gap-2">
                  <span className="text-xs w-28 truncate capitalize">{s.signal_type?.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: NHDA, width: `${Math.min(100, parseInt(s.cnt) * 10)}%` }} /></div>
                  <span className="text-xs font-semibold">{s.cnt}</span>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'genome' && genomeQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Profiles" value={genomeQ.data.kpis?.total} />
            <KpiCard label="Avg Resilience DNA" value={genomeQ.data.kpis?.avg_resilience} color="#10B981" />
            <KpiCard label="Avg Innovation DNA" value={genomeQ.data.kpis?.avg_innovation} color={NHDA} />
            <KpiCard label="Innovation Hubs" value={genomeQ.data.kpis?.innovation_hubs} color="#10B981" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Resilience DNA','Innovation DNA','Learning Adaptability','Version'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(genomeQ.data.profiles || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name} <span className="text-gray-400 text-xs capitalize">({r.region_type})</span></td>
                    <td className="px-3 py-2 font-semibold">{r.resilience_dna}</td>
                    <td className="px-3 py-2 font-semibold">{r.innovation_dna}</td>
                    <td className="px-3 py-2">{r.learning_adaptability}</td>
                    <td className="px-3 py-2">v{r.genome_version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!genomeQ.data.profiles?.length && <p className="text-center text-xs text-gray-400 py-6">No genome profiles yet. Enter a region ID above and calculate.</p>}
          </div>
        </div>
      )}

      {tab === 'nhdi' && nhdiQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Avg NHDI" value={nhdiQ.data.kpis?.avg_nhdi} color="#10B981" />
            <KpiCard label="Avg Education" value={nhdiQ.data.kpis?.avg_education} />
            <KpiCard label="Avg Employability" value={nhdiQ.data.kpis?.avg_employability} />
            <KpiCard label="Total Measurements" value={nhdiQ.data.kpis?.total_measurements} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle className="text-sm">Grade Distribution</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(nhdiQ.data.grade_distribution || []).map((g: any) => (
                  <div key={g.nhdi_grade} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-20 text-center ${GRADE_COLORS[g.nhdi_grade] || ''}`}>{g.nhdi_grade}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: NHDA, width: `${Math.min(100, parseInt(g.cnt) * 20)}%` }} /></div>
                    <span className="text-xs font-semibold">{g.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b"><tr>{['Region','NHDI','Grade','Education','Employability'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {(nhdiQ.data.region_snapshots || []).slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{r.region_name}</td>
                      <td className="px-3 py-2 font-bold">{r.nhdi_score}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${GRADE_COLORS[r.nhdi_grade] || ''}`}>{r.nhdi_grade}</span></td>
                      <td className="px-3 py-2">{r.education_score}</td>
                      <td className="px-3 py-2">{r.employability_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!nhdiQ.data.region_snapshots?.length && <p className="text-center text-xs text-gray-400 py-6">No NHDI data yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'collapse' && collapseQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Critical Risks" value={collapseQ.data.kpis?.critical} color="#EF4444" />
            <KpiCard label="High Severity" value={collapseQ.data.kpis?.high} color="#F59E0B" />
            <KpiCard label="Active Forecasts" value={collapseQ.data.kpis?.active} />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Type','Probability','Severity','Warnings','Recommendation'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(collapseQ.data.active_forecasts || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name || r.region_id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{r.forecast_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 font-bold">{(parseFloat(r.probability) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.severity === 'critical' ? 'bg-red-100 text-red-700' : r.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.severity}</span></td>
                    <td className="px-3 py-2">{(r.early_warning_signals || []).length}</td>
                    <td className="px-3 py-2 text-gray-500">{r.policy_recommendation?.slice(0, 40)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!collapseQ.data.active_forecasts?.length && <p className="text-center text-xs text-gray-400 py-6">No active collapse forecasts. Enter a region ID above to forecast.</p>}
          </div>
        </div>
      )}

      {tab === 'behavioural' && behavQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Avg Climate Score" value={behavQ.data.kpis?.avg_composite} color="#10B981" />
          <KpiCard label="Avg Engagement" value={behavQ.data.kpis?.avg_engagement} />
          <KpiCard label="Avg Disengagement Risk" value={behavQ.data.kpis?.avg_disengagement_risk} color="#EF4444" />
        </div>
      )}

      {tab === 'emotional' && emotQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Stability" value={emotQ.data.kpis?.avg_stability} color="#10B981" />
          <KpiCard label="Avg Anxiety" value={emotQ.data.kpis?.avg_anxiety} color="#F59E0B" />
          <KpiCard label="Avg Burnout" value={emotQ.data.kpis?.avg_burnout} color="#EF4444" />
          <KpiCard label="Avg Collapse Risk" value={emotQ.data.kpis?.avg_collapse_risk} color="#EF4444" />
        </div>
      )}

      {tab === 'cognitive' && cogQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Learning Capacity" value={cogQ.data.kpis?.avg_learning} color="#10B981" />
          <KpiCard label="Avg Innovation" value={cogQ.data.kpis?.avg_innovation} />
          <KpiCard label="Avg Adaptability" value={cogQ.data.kpis?.avg_adaptability} />
          <KpiCard label="Stagnating Regions" value={cogQ.data.kpis?.stagnating_regions} color="#EF4444" />
        </div>
      )}

      {tab === 'opportunities' && oppsQ.data && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Title','Type','Strength','Amplification','Segment','Region'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(oppsQ.data.top_opportunities || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.title}</td>
                    <td className="px-3 py-2 capitalize">{r.opportunity_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">{r.strength_score}</td>
                    <td className="px-3 py-2">{(parseFloat(r.amplification_potential) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">{r.population_segment || '—'}</td>
                    <td className="px-3 py-2">{r.region_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!oppsQ.data.top_opportunities?.length && <p className="text-center text-xs text-gray-400 py-6">No opportunities detected yet.</p>}
          </div>
        </div>
      )}

      {tab === 'cohesion' && cohesionQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Cohesion" value={cohesionQ.data.kpis?.avg_cohesion} color="#10B981" />
          <KpiCard label="Avg Institutional Trust" value={cohesionQ.data.kpis?.avg_trust} />
          <KpiCard label="Avg Polarization" value={cohesionQ.data.kpis?.avg_polarization} color="#EF4444" />
          <KpiCard label="Fragile Regions" value={cohesionQ.data.kpis?.fragile_count} color="#EF4444" />
        </div>
      )}

      {tab === 'talent' && talentQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Migration Rate" value={talentQ.data.kpis?.avg_migration_rate} />
          <KpiCard label="Avg Capability Flow" value={talentQ.data.kpis?.avg_capability_flow} color="#10B981" />
          <KpiCard label="Avg Drain Risk" value={talentQ.data.kpis?.avg_drain_risk} color="#EF4444" />
          <KpiCard label="Drain Risk Alerts" value={talentQ.data.kpis?.drain_risk_alerts} color="#EF4444" />
        </div>
      )}
    </div>
  );
}
