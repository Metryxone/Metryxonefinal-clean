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

export default function LDEGovernancePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [userId, setUserId] = useState('');
  const [expName, setExpName] = useState('lde_intervention_study_1');
  const [expType, setExpType] = useState('intervention_effectiveness');
  const [modelName, setModelName] = useState('lde_core');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['lde-gov-master'], queryFn: () => fetchJson('/api/admin/lde/governance/master') });
  const coevQ = useQuery({ queryKey: ['lde-coev'], queryFn: () => fetchJson('/api/admin/lde/coevolution'), enabled: tab === 'coevolution' });
  const constQ = useQuery({ queryKey: ['lde-constitutional'], queryFn: () => fetchJson('/api/admin/lde/constitutional'), enabled: tab === 'constitutional' });
  const researchQ = useQuery({ queryKey: ['lde-research'], queryFn: () => fetchJson('/api/admin/lde/research'), enabled: tab === 'research' });
  const recursiveQ = useQuery({ queryKey: ['lde-recursive'], queryFn: () => fetchJson('/api/admin/lde/recursive/history'), enabled: tab === 'recursive' });
  const obsQ = useQuery({ queryKey: ['lde-obs'], queryFn: () => fetchJson('/api/admin/lde/observability/dashboard'), enabled: tab === 'observability' });

  const post = (url: string, body: any) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

  const recordCoevolution = useMutation({
    mutationFn: () => post('/api/lde/coevolution/record', { user_id: userId || undefined, feedback_event: 'intervention_outcome', intervention_outcome: { success: true, delta: 0.12 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-coev'] })
  });

  const generateExplanation = useMutation({
    mutationFn: () => post('/api/lde/explain', { user_id: userId, insight_type: 'trajectory_change' }),
    onSuccess: (d) => alert(`Explanation: "${d.why_explanation?.slice(0, 100)}…"\nConfidence: ${parseFloat(d.confidence).toFixed(2)}`)
  });

  const runConstitutional = useMutation({
    mutationFn: () => post('/api/lde/constitutional/check', {}),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-constitutional'] }); alert(`Constitutional audit: ${d.passed} passed, ${d.violations} violations`); }
  });

  const createExperiment = useMutation({
    mutationFn: () => post('/api/lde/research/experiment', { experiment_name: expName, experiment_type: expType, hypothesis: 'LDE-guided intervention improves resilience outcomes.' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-research'] })
  });

  const evolveModel = useMutation({
    mutationFn: () => post('/api/lde/recursive/evolve', { model_name: modelName, trigger: 'manual' }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-recursive'] }); alert(`Model ${d.model_name} evolved to v${d.version}. Improvement: +${parseFloat(d.improvement_pct).toFixed(2)}%`); }
  });

  const seedObs = useMutation({
    mutationFn: () => post('/api/admin/lde/observability/seed', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-obs'] })
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Master Dashboard' },
    { id: 'coevolution', label: 'Co-Evolution' },
    { id: 'explainability', label: 'Explainability' },
    { id: 'constitutional', label: 'Constitutional AI' },
    { id: 'research', label: 'Research Engine' },
    { id: 'recursive', label: 'Recursive AI' },
    { id: 'observability', label: 'Observability' }
  ];

  const master = masterQ.data;
  const num = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '—';
  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>LDE — Governance Engine</h2>
          <p className="text-sm text-gray-500">Co-Evolution · Explainability · Constitutional AI · Research · Recursive Self-Evolving AI · Observability</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-44" />
          <Button onClick={() => runConstitutional.mutate()} disabled={runConstitutional.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {runConstitutional.isPending ? 'Auditing…' : '⚖️ Constitutional Audit'}
          </Button>
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

      {tab === 'master' && master && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Co-Evolution Events" value={master.coevolution?.total_events} sub={`${num(master.coevolution?.avg_velocity, 3)} avg velocity`} />
            <KpiCard label="Explanations Generated" value={master.explainability?.total} sub={`${master.explainability?.users_covered} users covered`} />
            <KpiCard label="Constitutional Violations" value={master.constitutional?.violations} sub={`${master.constitutional?.high_severity} high severity`} color={parseInt(master.constitutional?.violations) > 0 ? '#dc2626' : '#10b981'} />
            <KpiCard label="Research Experiments" value={master.research?.total_experiments} sub={`${master.research?.completed} completed`} />
            <KpiCard label="Recursive Evolutions" value={master.recursive_evolution?.total_evolutions} sub={`+${num(master.recursive_evolution?.avg_improvement, 2)}% avg gain`} color="#10b981" />
            <KpiCard label="Latest Model Version" value={master.recursive_evolution?.latest_version ? `v${master.recursive_evolution.latest_version}` : '—'} />
            <KpiCard label="Observability Anomalies" value={master.observability?.anomalies} color="#f97316" />
            <KpiCard label="Research Results" value={master.research?.total_results} />
          </div>
          {parseInt(master.constitutional?.violations) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-red-700 font-semibold text-sm">⚠️ {master.constitutional?.violations} Constitutional Violation(s) — {master.constitutional?.high_severity} high severity</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Governance Health Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Constitutional checks</span><span className="font-bold text-sm" style={{ color: NAV }}>{master.constitutional?.total_checks || 0}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Pass rate</span><span className={`font-bold text-sm ${parseInt(master.constitutional?.violations) > 0 ? 'text-red-500' : 'text-green-600'}`}>{master.constitutional?.total_checks > 0 ? `${(((master.constitutional?.total_checks - master.constitutional?.violations) / master.constitutional?.total_checks) * 100).toFixed(0)}%` : '—'}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Avg co-evolution velocity</span><span className="text-xs">{num(master.coevolution?.avg_velocity, 3)}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-gray-600">Model throughput (1h)</span><span className="text-xs">{num(master.observability?.throughput, 0)}/min</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={() => runConstitutional.mutate()} disabled={runConstitutional.isPending} size="sm" className="w-full" style={{ background: NAV, color: '#fff' }}>
                  {runConstitutional.isPending ? 'Auditing…' : '⚖️ Run Full Constitutional Audit'}
                </Button>
                <Button onClick={() => evolveModel.mutate()} disabled={evolveModel.isPending} size="sm" className="w-full" variant="outline">
                  {evolveModel.isPending ? 'Evolving…' : '🧬 Trigger Model Self-Evolution'}
                </Button>
                <Button onClick={() => seedObs.mutate()} disabled={seedObs.isPending} size="sm" className="w-full" variant="outline">
                  {seedObs.isPending ? 'Seeding…' : '📊 Seed Observability Metrics'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'coevolution' && (
        <div className="space-y-4">
          <Button onClick={() => recordCoevolution.mutate()} disabled={recordCoevolution.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {recordCoevolution.isPending ? 'Recording…' : '🔄 Record Co-Evolution Event'}
          </Button>
          {coevQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {coevQ.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Events" value={coevQ.data.kpi?.total_events} />
                <KpiCard label="Avg Adaptation Velocity" value={num(coevQ.data.kpi?.avg_velocity, 3)} color="#10b981" />
                <KpiCard label="Avg Recursive Rate" value={pct(coevQ.data.kpi?.avg_recursive_rate)} color="#a855f7" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Co-Evolution by Feedback Event</CardTitle></CardHeader>
                <CardContent>
                  {(coevQ.data.by_event || []).map((r: any) => (
                    <div key={r.feedback_event} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700">{r.feedback_event}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">velocity: {num(r.avg_velocity, 3)}</span>
                        <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Co-Evolution Records</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Event</th><th>User</th><th>Velocity</th><th>Recursive Rate</th><th>Recorded</th></tr></thead>
                      <tbody>{(coevQ.data.records || []).slice(0, 15).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1">{r.feedback_event}</td>
                          <td className="truncate max-w-[80px]">{r.user_id || '—'}</td>
                          <td>{num(r.adaptation_velocity, 3)}</td>
                          <td>{pct(r.recursive_improvement_rate)}</td>
                          <td>{new Date(r.recorded_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'explainability' && (
        <div className="space-y-4">
          <Button onClick={() => generateExplanation.mutate()} disabled={!userId || generateExplanation.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {generateExplanation.isPending ? 'Generating…' : '💡 Generate Explanation'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">LDE explainability generates temporal causal explanations for each developmental insight: trajectory changes, intervention impacts, breakthroughs, drift events, and fractures. All explanations include causal contributors, intervention influence scores, and future impact forecasts.</p>
              <div className="grid grid-cols-2 gap-3">
                {['trajectory_change','intervention_impact','breakthrough','drift','fracture'].map(t => (
                  <div key={t} className="border rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700">{t.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-400 mt-1">Rule-based temporal explanation template</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'constitutional' && (
        <div className="space-y-4">
          <Button onClick={() => runConstitutional.mutate()} disabled={runConstitutional.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {runConstitutional.isPending ? 'Checking…' : '⚖️ Run Full Constitutional Audit'}
          </Button>
          {constQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {constQ.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Checks" value={constQ.data.kpi?.total} />
                <KpiCard label="Violations" value={constQ.data.kpi?.violations} color={parseInt(constQ.data.kpi?.violations) > 0 ? '#dc2626' : '#10b981'} />
                <KpiCard label="High Severity" value={constQ.data.kpi?.high_severity} color="#dc2626" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">By Check Type</CardTitle></CardHeader>
                <CardContent>
                  {(constQ.data.by_type || []).map((r: any) => (
                    <div key={r.check_type} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="text-xs text-gray-700 capitalize">{r.check_type.replace(/_/g,' ')}</span>
                      <div className="flex items-center gap-3">
                        {parseInt(r.violations) > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">{r.violations} violations</span>}
                        <span className={`text-xs font-semibold ${parseFloat(r.pass_rate) >= 0.9 ? 'text-green-600' : parseFloat(r.pass_rate) >= 0.7 ? 'text-yellow-500' : 'text-red-500'}`}>{pct(r.pass_rate)} pass rate</span>
                        <span className="text-xs text-gray-500">{r.cnt} checks</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Checks</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Check Type</th><th>Passed</th><th>Severity</th><th>Remediation</th></tr></thead>
                      <tbody>{(constQ.data.checks || []).slice(0, 15).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 capitalize">{r.check_type.replace(/_/g,' ')}</td>
                          <td>{r.passed ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}</td>
                          <td><Pill val={r.severity} map={SEV_COLORS} /></td>
                          <td className="truncate max-w-[140px] text-gray-500">{r.remediation_applied || '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'research' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={expName} onChange={e => setExpName(e.target.value)} placeholder="experiment name" className="border rounded px-2 py-1.5 text-sm w-52" />
            <select value={expType} onChange={e => setExpType(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {['psychometric_validation','intervention_effectiveness','resilience_study','trajectory_study'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
            <Button onClick={() => createExperiment.mutate()} disabled={createExperiment.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {createExperiment.isPending ? 'Creating…' : '🔬 Create Experiment'}
            </Button>
          </div>
          {researchQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {researchQ.data && (
            <>
              <div className="flex gap-2 flex-wrap">
                {(researchQ.data.by_status || []).map((r: any) => (
                  <div key={r.status} className={`px-4 py-2 rounded-lg text-center ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    <p className="text-xl font-bold">{r.cnt}</p>
                    <p className="text-xs capitalize">{r.status}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Research Experiments</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Name</th><th>Type</th><th>Results</th><th>Status</th><th>Export</th></tr></thead>
                      <tbody>{(researchQ.data.experiments || []).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[120px]">{r.experiment_name}</td>
                          <td className="truncate max-w-[100px]">{r.experiment_type?.replace(/_/g,' ')}</td>
                          <td style={{ color: NAV }}>{r.result_count}</td>
                          <td><Pill val={r.status} map={STATUS_COLORS} /></td>
                          <td><a href={`/api/lde/research/export/${r.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Export</a></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'recursive' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="model_name" className="border rounded px-2 py-1.5 text-sm w-44" />
            <Button onClick={() => evolveModel.mutate()} disabled={evolveModel.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {evolveModel.isPending ? 'Evolving…' : '🧬 Trigger Self-Evolution'}
            </Button>
          </div>
          {recursiveQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {recursiveQ.data && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Model Evolution History</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Model</th><th>Latest Ver</th><th>Total Evolutions</th><th>Avg Improvement</th></tr></thead>
                    <tbody>{(recursiveQ.data.by_model || []).map((r: any) => (
                      <tr key={r.model_name} className="border-t">
                        <td className="py-1">{r.model_name}</td>
                        <td style={{ color: NAV }}>v{r.latest_version}</td>
                        <td>{r.total_evolutions}</td>
                        <td className="text-green-600 font-semibold">+{num(r.avg_improvement, 2)}%</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Evolution Log</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Model</th><th>Version</th><th>Trigger</th><th>Before</th><th>After</th><th>Gain</th></tr></thead>
                      <tbody>{(recursiveQ.data.history || []).slice(0, 15).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1">{r.model_name}</td>
                          <td>v{r.version}</td>
                          <td>{r.trigger}</td>
                          <td>{pct(r.performance_before)}</td>
                          <td className="text-green-600 font-semibold">{pct(r.performance_after)}</td>
                          <td className="text-emerald-600">+{num(r.improvement_pct, 2)}%</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'observability' && (
        <div className="space-y-4">
          <Button onClick={() => seedObs.mutate()} disabled={seedObs.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {seedObs.isPending ? 'Seeding…' : '📊 Seed Observability Metrics'}
          </Button>
          {obsQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {obsQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Metrics" value={obsQ.data.kpi?.total_metrics} />
                <KpiCard label="Anomalies" value={obsQ.data.kpi?.anomaly_count} color="#dc2626" />
                <KpiCard label="Drift Detections" value={obsQ.data.kpi?.drift_count} color="#f97316" />
                <KpiCard label="Avg Value" value={num(obsQ.data.kpi?.avg_value, 2)} />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Metrics by Name</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Metric</th><th>Avg Value</th><th>Count</th><th>Anomalies</th></tr></thead>
                    <tbody>{(obsQ.data.by_metric || []).map((r: any) => (
                      <tr key={r.metric_name} className="border-t">
                        <td className="py-1 truncate max-w-[160px]">{r.metric_name}</td>
                        <td>{num(r.avg_val, 2)}</td>
                        <td>{r.cnt}</td>
                        <td className={parseInt(r.anomaly_cnt) > 0 ? 'text-red-500 font-bold' : 'text-gray-400'}>{r.anomaly_cnt}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
              {obsQ.data.anomalies?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm text-red-600">⚠️ Anomalous Metrics</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-32">
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-500"><th className="text-left py-1">Metric</th><th>Value</th><th>Recorded</th></tr></thead>
                        <tbody>{(obsQ.data.anomalies || []).map((r: any) => (
                          <tr key={r.id} className="border-t">
                            <td className="py-1">{r.metric_name}</td>
                            <td className="text-red-500 font-bold">{num(r.metric_value, 2)}</td>
                            <td>{new Date(r.recorded_at).toLocaleTimeString()}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
