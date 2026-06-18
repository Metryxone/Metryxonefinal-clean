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

export default function NHDAGovernancePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [regionId, setRegionId] = useState('');
  const [studyForm, setStudyForm] = useState({ study_name: '', study_type: 'longitudinal' });
  const [healingForm, setHealingForm] = useState({ model_component: '', healing_type: 'weight_recalibration', performance_delta: '' });
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['nhda-gov-master'], queryFn: () => fetchJson('/api/admin/nhda/governance/master'), enabled: tab === 'master', refetchInterval: 30000 });
  const fairnessQ = useQuery({ queryKey: ['nhda-fairness'], queryFn: () => fetchJson('/api/admin/nhda/fairness/dashboard'), enabled: tab === 'fairness' });
  const govQ = useQuery({ queryKey: ['nhda-gov'], queryFn: () => fetchJson('/api/admin/nhda/governance/dashboard'), enabled: tab === 'governance' });
  const researchQ = useQuery({ queryKey: ['nhda-research'], queryFn: () => fetchJson('/api/admin/nhda/research/dashboard'), enabled: tab === 'research' });
  const healingQ = useQuery({ queryKey: ['nhda-healing'], queryFn: () => fetchJson('/api/admin/nhda/self-healing/dashboard'), enabled: tab === 'self-healing' });
  const eventsQ = useQuery({ queryKey: ['nhda-events'], queryFn: () => fetchJson('/api/admin/nhda/events/log?limit=30'), enabled: tab === 'events' });
  const auditQ = useQuery({ queryKey: ['nhda-audit'], queryFn: () => fetchJson('/api/admin/nhda/audit?limit=30'), enabled: tab === 'audit' });

  const auditFairness = useMutation({
    mutationFn: () => fetch('/api/nhda/fairness/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, audit_type: 'regional', dimension: 'nhdi_equality', severity: 'moderate' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nhda-fairness'] })
  });
  const createStudy = useMutation({
    mutationFn: () => fetch('/api/nhda/research/studies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region_id: regionId, ...studyForm }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nhda-research'] }); setStudyForm({ study_name: '', study_type: 'longitudinal' }); }
  });
  const logHealing = useMutation({
    mutationFn: () => fetch('/api/nhda/self-healing/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...healingForm, performance_delta: parseFloat(healingForm.performance_delta) || 0, population_impact: 100000 }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nhda-healing'] }); setHealingForm({ model_component: '', healing_type: 'weight_recalibration', performance_delta: '' }); }
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Overview' }, { id: 'fairness', label: 'Fairness & AI Safety' }, { id: 'governance', label: 'Governance' },
    { id: 'research', label: 'Research Cloud' }, { id: 'self-healing', label: 'Self-Healing AI' }, { id: 'events', label: 'Sovereign Events' }, { id: 'audit', label: 'Audit Trail' }
  ];

  const STUDY_TYPES = ['longitudinal','workforce_readiness','psychometric_validation','policy_experimentation','resilience_study','innovation_study'];
  const HEALING_TYPES = ['weight_recalibration','anomaly_correction','norm_update','pattern_discovery','threshold_adjustment','autonomous_reoptimization'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: NHDA_GOV }}>⚖</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">NHDA — Sovereign Governance & Intelligence</h2>
          <p className="text-xs text-gray-500">Sections 21–30: Fairness, Governance, Research Cloud, Self-Healing AI, Events, Audit</p>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input placeholder="Region ID" value={regionId} onChange={e => setRegionId(e.target.value)} className="max-w-xs" />
        {tab === 'fairness' && <Button onClick={() => auditFairness.mutate()} disabled={!regionId || auditFairness.isPending} style={{ background: NHDA_GOV, color: '#fff' }}>Run Fairness Audit</Button>}
      </div>

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={tab === t.id ? { background: NHDA_GOV } : {}}>{t.label}</button>
        ))}
      </div>

      {tab === 'master' && masterQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Fairness Audits Open" value={masterQ.data.fairness_open} color="#F59E0B" />
          <KpiCard label="Governance Pending" value={masterQ.data.governance_pending} color="#F59E0B" />
          <KpiCard label="Governance Escalated" value={masterQ.data.governance_escalated} color="#EF4444" />
          <KpiCard label="Research Studies" value={masterQ.data.research_studies} color={NHDA_GOV} />
          <KpiCard label="Healing Logs" value={masterQ.data.healing_logs} color={NHDA_GOV} />
          <KpiCard label="Pending Events" value={masterQ.data.events_pending} />
          <KpiCard label="Audit Records" value={masterQ.data.audit_records} />
        </div>
      )}

      {tab === 'fairness' && fairnessQ.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Audits" value={fairnessQ.data.kpis?.total} />
            <KpiCard label="Unresolved" value={fairnessQ.data.kpis?.unresolved} color="#EF4444" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle className="text-sm">Severity Distribution</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(fairnessQ.data.severity_distribution || []).map((s: any) => (
                  <div key={s.severity} className="flex items-center gap-2">
                    <span className="text-xs w-16 capitalize">{s.severity}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ background: s.severity === 'critical' ? '#EF4444' : s.severity === 'high' ? '#F59E0B' : NHDA_GOV, width: `${Math.min(100, parseInt(s.cnt) * 15)}%` }} /></div>
                    <span className="text-xs font-semibold">{s.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-sm">Audit Type Breakdown</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {(fairnessQ.data.type_breakdown || []).map((t: any) => (
                  <div key={t.audit_type} className="flex justify-between text-xs">
                    <span className="capitalize">{t.audit_type}</span>
                    <span className="font-bold">{t.cnt}</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Region','Type','Dimension','Bias Score','Severity','Status'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(fairnessQ.data.active_audits || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.region_name || r.region_id?.slice(0, 8) || '—'}</td>
                    <td className="px-3 py-2 capitalize">{r.audit_type}</td>
                    <td className="px-3 py-2">{r.dimension}</td>
                    <td className="px-3 py-2">{(parseFloat(r.bias_score) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.severity === 'critical' ? 'bg-red-100 text-red-700' : r.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.severity}</span></td>
                    <td className="px-3 py-2">{r.resolved ? '✓ Resolved' : 'Open'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!fairnessQ.data.active_audits?.length && <p className="text-center text-xs text-gray-400 py-6">No active audits. Run a fairness audit above.</p>}
          </div>
        </div>
      )}

      {tab === 'research' && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Create Research Study</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input placeholder="Study Name" value={studyForm.study_name} onChange={e => setStudyForm(f => ({ ...f, study_name: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-sm" value={studyForm.study_type} onChange={e => setStudyForm(f => ({ ...f, study_type: e.target.value }))}>
                {STUDY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <Button onClick={() => createStudy.mutate()} disabled={!studyForm.study_name || createStudy.isPending} style={{ background: NHDA_GOV, color: '#fff' }}>Create Study</Button>
            </div></CardContent>
          </Card>
          {researchQ.data && <KpiCard label="Total Studies" value={researchQ.data.kpis?.total} color={NHDA_GOV} />}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Study Name','Type','Status','Dataset Size','Region'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(researchQ.data?.recent_studies || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.study_name}</td>
                    <td className="px-3 py-2 capitalize">{r.study_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'complete' ? 'bg-green-100 text-green-700' : r.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                    <td className="px-3 py-2">{r.dataset_size?.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.region_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!researchQ.data?.recent_studies?.length && <p className="text-center text-xs text-gray-400 py-6">No research studies yet.</p>}
          </div>
        </div>
      )}

      {tab === 'self-healing' && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Log Healing Event</CardTitle></CardHeader>
            <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Model Component" value={healingForm.model_component} onChange={e => setHealingForm(f => ({ ...f, model_component: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-sm" value={healingForm.healing_type} onChange={e => setHealingForm(f => ({ ...f, healing_type: e.target.value }))}>
                {HEALING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <Input type="number" placeholder="Performance Delta" value={healingForm.performance_delta} onChange={e => setHealingForm(f => ({ ...f, performance_delta: e.target.value }))} />
              <Button onClick={() => logHealing.mutate()} disabled={!healingForm.model_component || logHealing.isPending} style={{ background: NHDA_GOV, color: '#fff' }}>Log Healing</Button>
            </div></CardContent>
          </Card>
          {healingQ.data && <KpiCard label="Total Healing Events" value={healingQ.data.kpis?.total} color={NHDA_GOV} />}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Component','Healing Type','Delta','Population Impact','Approved'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(healingQ.data?.recent_healings || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{r.model_component}</td>
                    <td className="px-3 py-2 capitalize">{r.healing_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2" style={{ color: parseFloat(r.performance_delta) > 0 ? '#10B981' : '#EF4444' }}>{parseFloat(r.performance_delta) > 0 ? '+' : ''}{r.performance_delta}</td>
                    <td className="px-3 py-2">{parseInt(r.population_impact).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.approved ? '✓' : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!healingQ.data?.recent_healings?.length && <p className="text-center text-xs text-gray-400 py-6">No healing events yet.</p>}
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
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b"><tr>{['Action','Type','Actor','Role','Region','Status'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
              <tbody>
                {(govQ.data.recent_records || []).map((r: any) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.action}</td>
                    <td className="px-3 py-2 capitalize">{r.record_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">{r.actor || '—'}</td>
                    <td className="px-3 py-2">{r.actor_role || '—'}</td>
                    <td className="px-3 py-2">{r.region_name || '—'}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'resolved' ? 'bg-green-100 text-green-700' : r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!govQ.data.recent_records?.length && <p className="text-center text-xs text-gray-400 py-6">No governance records yet.</p>}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b"><tr>{['Event Type','Region','Payload Preview','Processed','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {(eventsQ.data?.rows || []).map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.event_type}</td>
                  <td className="px-3 py-2">{r.region_name || r.region_id?.slice(0, 8) || '—'}</td>
                  <td className="px-3 py-2 text-gray-400">{JSON.stringify(r.payload || {}).slice(0, 60)}…</td>
                  <td className="px-3 py-2">{r.processed ? '✓' : 'Pending'}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!eventsQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No sovereign events yet.</p>}
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b"><tr>{['Actor','Role','Action','Resource','Region','Date'].map(h => <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
            <tbody>
              {(auditQ.data?.rows || []).map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{r.actor || '—'}</td>
                  <td className="px-3 py-2">{r.actor_role || '—'}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">{r.resource_type || '—'}</td>
                  <td className="px-3 py-2">{r.region_name || '—'}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!auditQ.data?.rows?.length && <p className="text-center text-xs text-gray-400 py-6">No sovereign audit records yet.</p>}
        </div>
      )}
    </div>
  );
}
