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

export default function IILEvolutionPanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [instId, setInstId] = useState('');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['iil-evo-master'], queryFn: () => fetchJson('/api/admin/iil/evolution/master'), enabled: tab === 'master', refetchInterval: 30000 });
  const collapseQ = useQuery({ queryKey: ['iil-collapse'], queryFn: () => fetchJson('/api/admin/iil/collapse/dashboard'), enabled: tab === 'collapse' });
  const recoveryQ = useQuery({ queryKey: ['iil-recovery'], queryFn: () => fetchJson('/api/admin/iil/recovery/dashboard'), enabled: tab === 'recovery' });
  const oppsQ = useQuery({ queryKey: ['iil-opps'], queryFn: () => fetchJson('/api/admin/iil/opportunities/dashboard'), enabled: tab === 'opportunities' });
  const driftQ = useQuery({ queryKey: ['iil-drift'], queryFn: () => fetchJson('/api/admin/iil/drift/dashboard'), enabled: tab === 'drift' });
  const trustQ = useQuery({ queryKey: ['iil-trust'], queryFn: () => fetchJson('/api/admin/iil/trust/dashboard'), enabled: tab === 'trust' });
  const facultyQ = useQuery({ queryKey: ['iil-faculty'], queryFn: () => fetchJson('/api/admin/iil/faculty/dashboard'), enabled: tab === 'faculty' });
  const leadershipQ = useQuery({ queryKey: ['iil-leadership'], queryFn: () => fetchJson('/api/admin/iil/leadership/dashboard'), enabled: tab === 'leadership' });
  const contagionQ = useQuery({ queryKey: ['iil-contagion'], queryFn: () => fetchJson('/api/admin/iil/contagion/dashboard'), enabled: tab === 'contagion' });
  const benchmarkQ = useQuery({ queryKey: ['iil-benchmarks'], queryFn: () => fetchJson('/api/admin/iil/benchmarks/dashboard'), enabled: tab === 'benchmarks' });
  const employQ = useQuery({ queryKey: ['iil-employ'], queryFn: () => fetchJson('/api/admin/iil/employability/dashboard'), enabled: tab === 'employability' });

  const forecastCollapse = useMutation({
    mutationFn: (type: string) => fetch('/api/iil/collapse/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId, forecast_type: type }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-collapse'] })
  });
  const detectOpportunity = useMutation({
    mutationFn: () => fetch('/api/iil/opportunities/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId, opportunity_type: 'innovation_emergence', title: 'Auto-detected opportunity', strength_score: 70 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-opps'] })
  });
  const recordDrift = useMutation({
    mutationFn: () => fetch('/api/iil/drift/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-drift'] })
  });
  const recordTrust = useMutation({
    mutationFn: () => fetch('/api/iil/trust/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ institution_id: instId }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iil-trust'] })
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Overview' }, { id: 'collapse', label: 'Collapse' }, { id: 'recovery', label: 'Recovery' },
    { id: 'opportunities', label: 'Opportunities' }, { id: 'drift', label: 'Drift/Entropy' }, { id: 'trust', label: 'Trust' },
    { id: 'faculty', label: 'Faculty' }, { id: 'leadership', label: 'Leadership' }, { id: 'contagion', label: 'Contagion' },
    { id: 'benchmarks', label: 'Benchmarks' }, { id: 'employability', label: 'Employability' }
  ];

  const SEV_COLORS: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', moderate: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: '#7C3AED' }}>⚡</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">IIL — Institutional Evolution Intelligence</h2>
          <p className="text-xs text-gray-500">Sections 10–19: Collapse, Recovery, Opportunity, Drift, Trust, Faculty, Leadership, Contagion, Benchmarking, Employability</p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Input placeholder="Institution ID for actions" value={instId} onChange={e => setInstId(e.target.value)} className="max-w-xs" />
        {tab === 'collapse' && <Button onClick={() => forecastCollapse.mutate('disengagement_cascade')} disabled={!instId || forecastCollapse.isPending} style={{ background: '#7C3AED', color: '#fff' }}>Forecast Collapse</Button>}
        {tab === 'opportunities' && <Button onClick={() => detectOpportunity.mutate()} disabled={!instId || detectOpportunity.isPending} style={{ background: '#10B981', color: '#fff' }}>Detect Opportunity</Button>}
        {tab === 'drift' && <Button onClick={() => recordDrift.mutate()} disabled={!instId || recordDrift.isPending} style={{ background: '#F59E0B', color: '#fff' }}>Record Drift</Button>}
        {tab === 'trust' && <Button onClick={() => recordTrust.mutate()} disabled={!instId || recordTrust.isPending} style={{ background: NAV, color: '#fff' }}>Record Trust</Button>}
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: '#7C3AED' } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'master' && masterQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Critical Collapse Risks" value={masterQ.data.collapse?.critical} color="#EF4444" />
          <KpiCard label="Active Collapse Forecasts" value={masterQ.data.collapse?.active} color="#F59E0B" />
          <KpiCard label="Avg Recovery Momentum" value={masterQ.data.avg_recovery_momentum} color="#10B981" />
          <KpiCard label="New Opportunities" value={masterQ.data.opportunities?.new} color="#10B981" />
          <KpiCard label="Realised Opportunities" value={masterQ.data.opportunities?.realised} color="#10B981" />
          <KpiCard label="Avg Entropy (7d)" value={masterQ.data.avg_entropy_7d} color="#F59E0B" />
          <KpiCard label="Spreading Contagions" value={masterQ.data.spreading_contagions} color="#EF4444" />
        </div>
      )}

      {tab === 'collapse' && collapseQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Critical Forecasts" value={collapseQ.data.kpis?.critical_count} color="#EF4444" />
            <KpiCard label="High Severity" value={collapseQ.data.kpis?.high_count} color="#F59E0B" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Institution','Type','Probability','Severity','Early Warnings'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(collapseQ.data.active_forecasts || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.institution_name || r.institution_id?.slice(0, 8)}</td>
                    <td className="px-3 py-2">{r.forecast_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 font-bold">{(parseFloat(r.probability) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLORS[r.severity] || ''}`}>{r.severity}</span></td>
                    <td className="px-3 py-2">{(r.early_warning_signals || []).length} signals</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!collapseQ.data.active_forecasts?.length && <p className="text-center text-xs text-gray-400 py-6">No active collapse forecasts.</p>}
          </div>
        </div>
      )}

      {tab === 'drift' && driftQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
            <KpiCard label="Avg Entropy Score" value={driftQ.data.kpis?.avg_entropy} color="#F59E0B" />
            <KpiCard label="Avg Behavioural Drift" value={driftQ.data.kpis?.avg_behavioural_drift} color="#EF4444" />
          </div>
          <Card><CardHeader><CardTitle className="text-sm">Alert Level Distribution</CardTitle></CardHeader>
            <CardContent><div className="flex gap-3 flex-wrap">
              {(driftQ.data.alert_distribution || []).map((a: any) => (
                <div key={a.alert_level} className="text-center px-3 py-2 rounded-lg bg-gray-50 border">
                  <p className="text-xs text-gray-500 capitalize">{a.alert_level}</p>
                  <p className="text-xl font-bold" style={{ color: a.alert_level === 'critical' ? '#EF4444' : a.alert_level === 'warning' ? '#F59E0B' : NAV }}>{a.cnt}</p>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'trust' && trustQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Trust Composite" value={trustQ.data.kpis?.avg_trust} color="#10B981" />
          <KpiCard label="Avg Collapse Risk" value={trustQ.data.kpis?.avg_collapse_risk} color="#EF4444" />
          <KpiCard label="Avg Leader Trust" value={trustQ.data.kpis?.avg_leader_trust} />
          <KpiCard label="Collapse Alerts" value={trustQ.data.kpis?.collapse_alerts} color="#EF4444" />
        </div>
      )}

      {tab === 'faculty' && facultyQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Faculty" value={facultyQ.data.kpis?.total_faculty} />
            <KpiCard label="Avg Growth" value={facultyQ.data.kpis?.avg_growth} color="#10B981" />
            <KpiCard label="Burnout Risk Count" value={facultyQ.data.kpis?.burnout_risk_count} color="#EF4444" />
            <KpiCard label="Leadership Emerging" value={facultyQ.data.kpis?.leadership_emerging} color="#10B981" />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Faculty','Growth','Mentorship','Burnout Risk','Leadership'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(facultyQ.data.faculty_profiles || []).slice(0, 15).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.faculty_name || r.faculty_id}</td>
                    <td className="px-3 py-2">{r.growth_score}</td>
                    <td className="px-3 py-2">{r.mentorship_quality}</td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${parseFloat(r.burnout_risk) > 0.5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{(parseFloat(r.burnout_risk) * 100).toFixed(0)}%</span></td>
                    <td className="px-3 py-2">{r.leadership_emergence ? '✓ Emerging' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'leadership' && leadershipQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Leaders" value={leadershipQ.data.kpis?.total} />
          <KpiCard label="Avg Effectiveness" value={leadershipQ.data.kpis?.avg_effectiveness} color="#10B981" />
          <KpiCard label="Fragile Governance" value={leadershipQ.data.kpis?.fragile_governance} color="#EF4444" />
          <KpiCard label="Hidden Potential" value={leadershipQ.data.kpis?.hidden_potential} color="#10B981" />
        </div>
      )}

      {tab === 'contagion' && contagionQ.data && (
        <div className="space-y-4">
          <KpiCard label="Spreading Events" value={contagionQ.data.kpis?.spreading_events} color="#EF4444" />
          <Card><CardHeader><CardTitle className="text-sm">Type Breakdown</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">
              {(contagionQ.data.type_breakdown || []).map((t: any) => (
                <div key={t.contagion_type} className="flex items-center gap-2">
                  <span className="text-xs w-24 capitalize">{t.contagion_type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full bg-purple-500" style={{ width: `${Math.min(100, parseInt(t.cnt) * 20)}%` }} /></div>
                  <span className="text-xs font-semibold">{t.cnt}</span>
                </div>
              ))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {tab === 'benchmarks' && benchmarkQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard label="Total Benchmarks" value={benchmarkQ.data.kpis?.total} />
          <KpiCard label="Avg Percentile" value={benchmarkQ.data.kpis?.avg_percentile} />
          <KpiCard label="Avg Score" value={benchmarkQ.data.kpis?.avg_score} />
        </div>
      )}

      {tab === 'employability' && employQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Avg Readiness" value={employQ.data.kpis?.avg_readiness} color="#10B981" />
          <KpiCard label="Avg Alignment" value={employQ.data.kpis?.avg_alignment} />
          <KpiCard label="Avg Placement Health" value={employQ.data.kpis?.avg_placement} />
          <KpiCard label="Fragile Institutions" value={employQ.data.kpis?.fragile_institutions} color="#EF4444" />
        </div>
      )}
    </div>
  );
}
