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

export default function IILCorePanel() {
  const [tab, setTab] = useState<Tab>('os');
  const [instForm, setInstForm] = useState({ name: '', institution_type: 'school', tier: 'standard', country: 'IN', city: '' });
  const [sigForm, setSigForm] = useState({ institution_id: '', signal_type: 'student_behavioural' });
  const [calcInstId, setCalcInstId] = useState('');
  const qc = useQueryClient();

  const osQ = useQuery({ queryKey: ['iil-os'], queryFn: () => fetchJson('/api/iil/os/status'), refetchInterval: 30000 });
  const masterQ = useQuery({ queryKey: ['iil-core-master'], queryFn: () => fetchJson('/api/admin/iil/core/master'), enabled: tab === 'os' });
  const instQ = useQuery({ queryKey: ['iil-institutions'], queryFn: () => fetchJson('/api/admin/iil/institutions?limit=50'), enabled: tab === 'institutions' });
  const sigQ = useQuery({ queryKey: ['iil-sig-dash'], queryFn: () => fetchJson('/api/admin/iil/signals/dashboard'), enabled: tab === 'signals' });
  const dnaQ = useQuery({ queryKey: ['iil-dna-analytics'], queryFn: () => fetchJson('/api/admin/iil/dna/analytics'), enabled: tab === 'dna' });
  const dnaProfilesQ = useQuery({ queryKey: ['iil-dna-profiles'], queryFn: () => fetchJson('/api/admin/iil/dna/profiles?limit=20'), enabled: tab === 'dna' });
  const cultureQ = useQuery({ queryKey: ['iil-culture'], queryFn: () => fetchJson('/api/admin/iil/culture/dashboard'), enabled: tab === 'culture' });
  const emotionalQ = useQuery({ queryKey: ['iil-emotional'], queryFn: () => fetchJson('/api/admin/iil/emotional-climate/dashboard'), enabled: tab === 'emotional' });
  const cognitiveQ = useQuery({ queryKey: ['iil-cognitive'], queryFn: () => fetchJson('/api/admin/iil/cognitive-load/dashboard'), enabled: tab === 'cognitive' });
  const healthQ = useQuery({ queryKey: ['iil-health'], queryFn: () => fetchJson('/api/admin/iil/health/dashboard'), enabled: tab === 'health' });
  const resilienceQ = useQuery({ queryKey: ['iil-resilience'], queryFn: () => fetchJson('/api/admin/iil/resilience/dashboard'), enabled: tab === 'resilience' });
  const trajQ = useQuery({ queryKey: ['iil-trajectory'], queryFn: () => fetchJson('/api/admin/iil/trajectory/dashboard'), enabled: tab === 'trajectory' });

  const createInst = useMutation({
    mutationFn: () => fetch('/api/admin/iil/institutions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(instForm) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iil-institutions'] }); setInstForm({ name: '', institution_type: 'school', tier: 'standard', country: 'IN', city: '' }); }
  });
  const ingestSignal = useMutation({
    mutationFn: () => fetch('/api/iil/signals/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sigForm) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-sig-dash'] })
  });
  const calcDNA = useMutation({
    mutationFn: () => fetch('/api/iil/dna/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: calcInstId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iil-dna-profiles'] }); qc.invalidateQueries({ queryKey: ['iil-dna-analytics'] }); }
  });
  const calcHealth = useMutation({
    mutationFn: () => fetch('/api/iil/health/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: calcInstId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-health'] })
  });
  const calcCulture = useMutation({
    mutationFn: () => fetch('/api/iil/culture/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: calcInstId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-culture'] })
  });
  const calcResilience = useMutation({
    mutationFn: () => fetch('/api/iil/resilience/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: calcInstId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-resilience'] })
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'os', label: 'OS Status' }, { id: 'institutions', label: 'Institutions' }, { id: 'signals', label: 'Signals' },
    { id: 'dna', label: 'DNA/Genome' }, { id: 'culture', label: 'Culture' }, { id: 'emotional', label: 'Emotional Climate' },
    { id: 'cognitive', label: 'Cognitive Load' }, { id: 'health', label: 'Health Index' }, { id: 'resilience', label: 'Resilience' },
    { id: 'trajectory', label: 'Trajectory' }
  ];

  const HEALTH_COLORS: Record<string, string> = { Thriving: 'bg-green-100 text-green-700', Stable: 'bg-blue-100 text-blue-700', Developing: 'bg-yellow-100 text-yellow-700', Fragile: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: NAV }}>🏛</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">IIL — Institutional Core Intelligence</h2>
          <p className="text-xs text-gray-500">Sections 1–9: OS, Signals, DNA, Culture, Emotional, Cognitive, Health, Resilience, Trajectory</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${osQ.data?.status === 'operational' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{osQ.data?.status || 'checking...'}</span>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: NAV } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'os' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Active Institutions" value={osQ.data?.active_institutions ?? '—'} />
            <KpiCard label="Signals (24h)" value={osQ.data?.signals_24h ?? '—'} />
            <KpiCard label="Pending Events" value={osQ.data?.pending_events ?? '—'} />
            <KpiCard label="Uptime (s)" value={osQ.data?.uptime_seconds ? Math.round(osQ.data.uptime_seconds) : '—'} />
          </div>
          {masterQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Avg Health Index" value={masterQ.data.avg_health_index} color="#10B981" />
              <KpiCard label="Thriving Institutions" value={masterQ.data.thriving_institutions} color="#10B981" />
              <KpiCard label="Avg Resilience" value={masterQ.data.avg_resilience} />
              <KpiCard label="Avg Culture Score" value={masterQ.data.avg_culture_score} />
              <KpiCard label="Total Institutions" value={masterQ.data.institutions?.total ?? '—'} />
            </div>
          )}
          {osQ.data?.engines && (
            <Card><CardHeader><CardTitle className="text-sm">Engine Status</CardTitle></CardHeader>
              <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(osQ.data.engines).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${v === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'institutions' && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Register Institution</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input placeholder="Institution Name" value={instForm.name} onChange={e => setInstForm(f => ({ ...f, name: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-sm" value={instForm.institution_type} onChange={e => setInstForm(f => ({ ...f, institution_type: e.target.value }))}>
                {['school','university','enterprise','government','ngo','skilling'].map(t => <option key={t}>{t}</option>)}
              </select>
              <select className="border rounded-lg px-3 py-2 text-sm" value={instForm.tier} onChange={e => setInstForm(f => ({ ...f, tier: e.target.value }))}>
                {['starter','standard','professional','enterprise','flagship'].map(t => <option key={t}>{t}</option>)}
              </select>
              <Input placeholder="City" value={instForm.city} onChange={e => setInstForm(f => ({ ...f, city: e.target.value }))} />
              <Button onClick={() => createInst.mutate()} disabled={!instForm.name || createInst.isPending} style={{ background: NAV, color: '#fff' }}>
                {createInst.isPending ? 'Creating…' : 'Create Institution'}
              </Button>
            </div></CardContent>
          </Card>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Name','Type','Tier','City','Status'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {(instQ.data?.rows || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 capitalize">{r.institution_type}</td>
                    <td className="px-3 py-2 capitalize">{r.tier}</td>
                    <td className="px-3 py-2">{r.city || '—'}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!instQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No institutions yet. Create one above.</p>}
          </div>
        </div>
      )}

      {tab === 'signals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard label="Total Signals" value={sigQ.data?.kpis?.total_signals ?? '—'} />
            <KpiCard label="Anomaly Signals" value={sigQ.data?.kpis?.anomaly_signals ?? '—'} color="#F59E0B" />
            <KpiCard label="Systemic Signals" value={sigQ.data?.kpis?.systemic_signals ?? '—'} color="#EF4444" />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Ingest Signal</CardTitle></CardHeader>
            <CardContent><div className="flex gap-2 flex-wrap">
              <Input placeholder="Institution ID (UUID)" value={sigForm.institution_id} onChange={e => setSigForm(f => ({ ...f, institution_id: e.target.value }))} className="flex-1" />
              <select className="border rounded-lg px-3 py-2 text-sm" value={sigForm.signal_type} onChange={e => setSigForm(f => ({ ...f, signal_type: e.target.value }))}>
                {['student_behavioural','teacher','emotional_ecosystem','resilience','interaction','workforce_readiness','intervention','environmental','governance'].map(t => <option key={t}>{t}</option>)}
              </select>
              <Button onClick={() => ingestSignal.mutate()} disabled={!sigForm.institution_id || ingestSignal.isPending} style={{ background: NAV, color: '#fff' }}>Ingest</Button>
            </div></CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle className="text-sm">Signal Type Breakdown</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(sigQ.data?.signal_type_breakdown || []).map((s: any) => (
                  <div key={s.signal_type} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-32 truncate">{s.signal_type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: NAV, width: `${Math.min(100, parseInt(s.cnt) * 10)}%` }} /></div>
                    <span className="text-xs font-semibold">{s.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm">Recent Signals</CardTitle></CardHeader>
              <CardContent><div className="space-y-1 max-h-48 overflow-y-auto">
                {(sigQ.data?.recent_signals || []).slice(0, 10).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-1 border-b text-xs">
                    <span>{s.signal_type}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${s.is_systemic ? 'bg-red-100 text-red-600' : s.weak_signal ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>{s.is_systemic ? 'Systemic' : s.weak_signal ? 'Weak' : 'Normal'}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </div>
      )}

      {(tab === 'dna' || tab === 'culture' || tab === 'emotional' || tab === 'cognitive' || tab === 'health' || tab === 'resilience' || tab === 'trajectory') && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <Input placeholder="Institution ID to calculate/record" value={calcInstId} onChange={e => setCalcInstId(e.target.value)} className="flex-1" />
            {tab === 'dna' && <Button onClick={() => calcDNA.mutate()} disabled={!calcInstId || calcDNA.isPending} style={{ background: NAV, color: '#fff' }}>Calculate DNA</Button>}
            {tab === 'culture' && <Button onClick={() => calcCulture.mutate()} disabled={!calcInstId || calcCulture.isPending} style={{ background: NAV, color: '#fff' }}>Calculate Culture</Button>}
            {tab === 'health' && <Button onClick={() => calcHealth.mutate()} disabled={!calcInstId || calcHealth.isPending} style={{ background: NAV, color: '#fff' }}>Calculate Health</Button>}
            {tab === 'resilience' && <Button onClick={() => calcResilience.mutate()} disabled={!calcInstId || calcResilience.isPending} style={{ background: NAV, color: '#fff' }}>Calculate Resilience</Button>}
          </div>

          {tab === 'dna' && dnaQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total DNA Profiles" value={dnaQ.data.kpis?.total_profiles} />
              <KpiCard label="Avg Identity Score" value={dnaQ.data.kpis?.avg_identity_score} color="#10B981" />
              <KpiCard label="Avg Resilience DNA" value={dnaQ.data.kpis?.avg_resilience_dna} />
              <KpiCard label="Mutations Detected" value={dnaQ.data.kpis?.mutations_detected} color="#F59E0B" />
            </div>
          )}
          {tab === 'dna' && (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b"><tr>{['Institution','Identity','Resilience DNA','Genome Ver','Calculated'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {(dnaProfilesQ.data?.rows || []).map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{r.institution_name || r.institution_id?.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-semibold">{r.identity_score}</td>
                      <td className="px-3 py-2">{r.resilience_dna}</td>
                      <td className="px-3 py-2">v{r.genome_version}</td>
                      <td className="px-3 py-2">{new Date(r.calculated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!dnaProfilesQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No DNA profiles yet. Enter an institution ID above and calculate.</p>}
            </div>
          )}

          {tab === 'health' && healthQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Avg Health Index" value={healthQ.data.kpis?.avg_health_index} color="#10B981" />
                <KpiCard label="Avg Engagement" value={healthQ.data.kpis?.avg_engagement} />
                <KpiCard label="Avg Resilience" value={healthQ.data.kpis?.avg_resilience} />
                <KpiCard label="Avg Trust" value={healthQ.data.kpis?.avg_trust} />
              </div>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b"><tr>{['Institution','Health Index','Grade','Engagement','Trust','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
                  <tbody>
                    {(healthQ.data.institution_snapshots || []).map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{r.institution_name || r.institution_id?.slice(0, 8)}</td>
                        <td className="px-3 py-2 font-bold">{r.health_index}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${HEALTH_COLORS[r.health_grade] || ''}`}>{r.health_grade}</span></td>
                        <td className="px-3 py-2">{r.engagement_score}</td>
                        <td className="px-3 py-2">{r.trust_score}</td>
                        <td className="px-3 py-2">{r.period_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!healthQ.data.institution_snapshots?.length && <p className="text-center text-xs text-gray-400 py-6">No health data yet. Enter an institution ID above and calculate.</p>}
              </div>
            </>
          )}

          {tab === 'culture' && cultureQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Avg Culture Score" value={cultureQ.data.kpis?.avg_composite} color="#10B981" />
              <KpiCard label="Avg Collaboration" value={cultureQ.data.kpis?.avg_collaboration} />
              <KpiCard label="Avg Innovation" value={cultureQ.data.kpis?.avg_innovation} />
              <KpiCard label="Toxic Risk Count" value={cultureQ.data.kpis?.toxic_risk_count} color="#EF4444" />
            </div>
          )}

          {tab === 'emotional' && emotionalQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Avg Stability" value={emotionalQ.data.kpis?.avg_stability} color="#10B981" />
              <KpiCard label="Avg Anxiety" value={emotionalQ.data.kpis?.avg_anxiety} color="#F59E0B" />
              <KpiCard label="Avg Burnout" value={emotionalQ.data.kpis?.avg_burnout} color="#EF4444" />
              <KpiCard label="Avg Morale" value={emotionalQ.data.kpis?.avg_morale} />
              <KpiCard label="Contagion Risk" value={emotionalQ.data.kpis?.avg_contagion_risk} color="#F59E0B" />
              <KpiCard label="High Collapse Risk" value={emotionalQ.data.kpis?.high_collapse_risk} color="#EF4444" />
            </div>
          )}

          {tab === 'cognitive' && cognitiveQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Avg Academic Overload" value={cognitiveQ.data.kpis?.avg_academic_overload} color="#F59E0B" />
              <KpiCard label="Avg Teacher Overload" value={cognitiveQ.data.kpis?.avg_teacher_overload} color="#F59E0B" />
              <KpiCard label="Avg Fragmentation" value={cognitiveQ.data.kpis?.avg_fragmentation} color="#EF4444" />
              <KpiCard label="Avg Cascade Risk" value={cognitiveQ.data.kpis?.avg_cascade_risk} color="#EF4444" />
              <KpiCard label="Cascade Alerts" value={cognitiveQ.data.kpis?.cascade_risk_alerts} color="#EF4444" />
            </div>
          )}

          {tab === 'resilience' && resilienceQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard label="Avg Resilience" value={resilienceQ.data.kpis?.avg_resilience} color="#10B981" />
              <KpiCard label="Avg Collapse Risk" value={resilienceQ.data.kpis?.avg_collapse_risk} color="#EF4444" />
              <KpiCard label="Avg Fragility" value={resilienceQ.data.kpis?.avg_fragility} color="#F59E0B" />
              <KpiCard label="Total Profiles" value={resilienceQ.data.kpis?.total_profiles} />
              <KpiCard label="Fragile Count" value={resilienceQ.data.kpis?.fragile_count} color="#EF4444" />
            </div>
          )}

          {tab === 'trajectory' && trajQ.data && (
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
              <KpiCard label="Breakthroughs Detected" value={trajQ.data.kpis?.breakthroughs} color="#10B981" />
              <KpiCard label="Hidden Declines" value={trajQ.data.kpis?.hidden_declines} color="#EF4444" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
