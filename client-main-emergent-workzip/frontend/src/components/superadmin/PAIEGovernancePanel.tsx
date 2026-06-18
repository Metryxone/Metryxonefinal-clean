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

export default function PAIEGovernancePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [simName, setSimName] = useState('stress_test_1');
  const [simType, setSimType] = useState('burnout_escalation');
  const [agentName, setAgentName] = useState('risk');
  const [agentTask, setAgentTask] = useState('analyse_user_risk_profile');
  const [modelName, setModelName] = useState('behavioural_forecaster');
  const [orchestrateTask, setOrchestrateTask] = useState('full_risk_assessment');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['paie-gov-master'], queryFn: () => fetchJson('/api/admin/paie/governance/master') });
  const simQ = useQuery({ queryKey: ['paie-sims'], queryFn: () => fetchJson('/api/admin/paie/simulations'), enabled: tab === 'simulations' });
  const agentQ = useQuery({ queryKey: ['paie-agents'], queryFn: () => fetchJson('/api/admin/paie/agents/status'), enabled: tab === 'agents' || tab === 'master' });
  const evolQ = useQuery({ queryKey: ['paie-evol'], queryFn: () => fetchJson('/api/admin/paie/model/evolution'), enabled: tab === 'evolution' });
  const metaQ = useQuery({ queryKey: ['paie-meta'], queryFn: () => fetchJson('/api/admin/paie/meta/dashboard'), enabled: tab === 'meta' });
  const fairQ = useQuery({ queryKey: ['paie-fair'], queryFn: () => fetchJson('/api/admin/paie/fairness/dashboard'), enabled: tab === 'fairness' });
  const eventQ = useQuery({ queryKey: ['paie-events'], queryFn: () => fetchJson('/api/admin/paie/events'), enabled: tab === 'events' });
  const obsQ = useQuery({ queryKey: ['paie-obs'], queryFn: () => fetchJson('/api/admin/paie/observability/dashboard'), enabled: tab === 'observability' });

  const runSim = useMutation({
    mutationFn: () => fetch('/api/paie/simulation/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ simulation_name: simName, simulation_type: simType, population_size: 100 }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-sims'] })
  });

  const invokeAgent = useMutation({
    mutationFn: () => fetch(`/api/admin/paie/agents/${agentName}/invoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: agentTask }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-agents'] })
  });

  const orchestrate = useMutation({
    mutationFn: () => fetch('/api/admin/paie/agents/orchestrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: orchestrateTask }) }).then(r => r.json()),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['paie-agents'] }); alert(`Orchestrated ${d.agents_invoked} agents`); }
  });

  const evolveModel = useMutation({
    mutationFn: () => fetch('/api/paie/model/evolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_name: modelName, trigger: 'manual' }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-evol'] })
  });

  const metaPredict = useMutation({
    mutationFn: () => fetch('/api/paie/meta/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_name: modelName }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-meta'] })
  });

  const auditAll = useMutation({
    mutationFn: () => fetch('/api/paie/fairness/audit-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-fair'] })
  });

  const seedMetrics = useMutation({
    mutationFn: () => fetch('/api/admin/paie/observability/seed-metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-obs'] })
  });

  const processEvent = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/paie/events/${id}/process`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-events'] })
  });

  const tabs = [
    { id: 'master' as Tab, label: 'Master Dashboard' },
    { id: 'simulations' as Tab, label: 'Simulations' },
    { id: 'agents' as Tab, label: 'Multi-Agent' },
    { id: 'evolution' as Tab, label: 'Self-Evolving AI' },
    { id: 'meta' as Tab, label: 'Meta-Prediction' },
    { id: 'fairness' as Tab, label: 'Fairness & Ethics' },
    { id: 'events' as Tab, label: 'Event Stream' },
    { id: 'observability' as Tab, label: 'Observability' },
  ];

  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';
  const num = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '—';
  const master = masterQ.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>PAIE — Governance Engine</h2>
          <p className="text-sm text-gray-500">Sections 19–28 · Simulation, Multi-Agent, Self-Evolving AI, Fairness, Events, Observability</p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Simulations" value={master.simulations?.total} sub={`${master.simulations?.completed} completed`} />
            <KpiCard label="PAIE Agents" value={master.agents?.total_agents} sub={`${num(master.agents?.avg_invocations, 0)} avg invocations`} />
            <KpiCard label="Model Evolutions" value={master.evolution?.total_evolutions} sub={`+${pct(master.evolution?.avg_improvement)} avg improvement`} color="#10b981" />
            <KpiCard label="Self-Heals" value={master.meta?.self_heals} color="#a855f7" />
            <KpiCard label="Avg Fairness" value={pct(master.fairness?.avg_fairness)} color="#10b981" />
            <KpiCard label="Bias Events" value={master.fairness?.bias_events} color="#f97316" />
            <KpiCard label="Ethical Escalations" value={master.fairness?.escalations} color="#dc2626" />
            <KpiCard label="Observability Anomalies" value={master.observability?.anomalies} sub={`${num(master.observability?.avg_latency, 0)}ms avg latency`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Events (Last 24h)</CardTitle></CardHeader>
              <CardContent>{(master.events_24h || []).map((r: any) => (
                <div key={r.event_type} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-xs text-gray-700">{r.event_type}</span>
                  <span className="font-bold text-sm" style={{ color: NAV }}>{r.cnt}</span>
                </div>
              ))}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Agent Overview</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(agentQ.data?.agents || []).map((a: any) => (
                  <div key={a.agent_name} className="flex flex-col items-center px-2 py-1 border rounded text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status}</span>
                    <span className="text-xs font-medium mt-0.5">{a.agent_name}</span>
                    <span className="text-xs text-gray-400">{a.invocation_count} calls</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SIMULATIONS */}
      {tab === 'simulations' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={simName} onChange={e => setSimName(e.target.value)} placeholder="simulation name" className="border rounded px-2 py-1.5 text-sm w-40" />
            <select value={simType} onChange={e => setSimType(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {['resilience_collapse','burnout_escalation','intervention_outcomes','cohort_instability','behavioural_contagion','stress_test','fairness_validation','custom'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <Button onClick={() => runSim.mutate()} disabled={runSim.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {runSim.isPending ? 'Running…' : '▶ Run Simulation'}
            </Button>
          </div>
          {simQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {simQ.data && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Simulation Types</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Type</th><th>Count</th><th>Avg Robustness</th><th>Avg Fairness</th></tr></thead>
                    <tbody>{(simQ.data.by_type || []).map((r: any) => <tr key={r.simulation_type} className="border-t"><td className="py-1 capitalize">{r.simulation_type?.replace(/_/g,' ')}</td><td style={{ color: NAV }}>{r.cnt}</td><td>{pct(r.avg_robustness)}</td><td className="text-green-600">{pct(r.avg_fairness)}</td></tr>)}</tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Simulations</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Name</th><th>Type</th><th>Population</th><th>Robustness</th><th>Status</th></tr></thead>
                      <tbody>{(simQ.data.simulations || []).slice(0, 15).map((r: any) => <tr key={r.id} className="border-t"><td className="py-1 truncate max-w-[100px]">{r.simulation_name}</td><td>{r.simulation_type?.replace(/_/g,' ')}</td><td>{r.simulated_population_size}</td><td>{pct(r.forecast_robustness_score)}</td><td><span className={`px-1.5 py-0.5 rounded text-xs ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{r.status}</span></td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* AGENTS */}
      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <select value={agentName} onChange={e => setAgentName(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {['risk','opportunity','resilience','intervention','governance','explainability','recovery','meta','temporal','behavioural','cognitive','emotional'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input value={agentTask} onChange={e => setAgentTask(e.target.value)} placeholder="task description" className="border rounded px-2 py-1.5 text-sm w-48" />
            <Button onClick={() => invokeAgent.mutate()} disabled={invokeAgent.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {invokeAgent.isPending ? 'Invoking…' : 'Invoke Agent'}
            </Button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input value={orchestrateTask} onChange={e => setOrchestrateTask(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-56" />
            <Button onClick={() => orchestrate.mutate()} disabled={orchestrate.isPending} size="sm" variant="outline">
              {orchestrate.isPending ? 'Orchestrating…' : '⚡ Orchestrate All Agents'}
            </Button>
          </div>
          {agentQ.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(agentQ.data.agents || []).map((a: any) => (
                <Card key={a.agent_name}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold capitalize" style={{ color: NAV }}>{a.agent_name} Agent</p>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status}</span>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{a.invocation_count} invocations</p>
                        <p>{num(a.avg_latency_ms, 0)}ms avg</p>
                      </div>
                    </div>
                    {a.last_reasoning?.conclusion && (
                      <p className="text-xs text-gray-600 italic truncate">{a.last_reasoning.conclusion}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EVOLUTION */}
      {tab === 'evolution' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="model_name" className="border rounded px-2 py-1.5 text-sm w-48" />
            <Button onClick={() => evolveModel.mutate()} disabled={evolveModel.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {evolveModel.isPending ? 'Evolving…' : '🧬 Evolve Model'}
            </Button>
          </div>
          {evolQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {evolQ.data && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Model Versions</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Model</th><th>Latest Ver</th><th>Total Evolutions</th><th>Avg Improvement</th></tr></thead>
                    <tbody>{(evolQ.data.by_model || []).map((r: any) => <tr key={r.model_name} className="border-t"><td className="py-1">{r.model_name}</td><td style={{ color: NAV }}>v{r.latest_version}</td><td>{r.total_evolutions}</td><td className="text-green-600 font-semibold">+{pct(r.avg_improvement)}</td></tr>)}</tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Evolution History</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-40">
                    <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Model</th><th>Version</th><th>Trigger</th><th>Before</th><th>After</th></tr></thead>
                      <tbody>{(evolQ.data.history || []).slice(0, 15).map((r: any) => <tr key={r.id} className="border-t"><td className="py-1">{r.model_name}</td><td>v{r.version}</td><td>{r.recalibration_trigger}</td><td>{pct(r.performance_before)}</td><td className="text-green-600 font-semibold">{pct(r.performance_after)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* META */}
      {tab === 'meta' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="model_name" className="border rounded px-2 py-1.5 text-sm w-48" />
            <Button onClick={() => metaPredict.mutate()} disabled={metaPredict.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {metaPredict.isPending ? 'Predicting…' : '🔮 Meta-Predict'}
            </Button>
          </div>
          {metaQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {metaQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Checks" value={metaQ.data.kpi?.total} />
                <KpiCard label="Avg Drift" value={pct(metaQ.data.kpi?.avg_drift)} color="#f97316" />
                <KpiCard label="Avg Degradation" value={pct(metaQ.data.kpi?.avg_degradation)} color="#dc2626" />
                <KpiCard label="Self-Heals" value={metaQ.data.kpi?.self_heals} color="#10b981" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Meta-Prediction by Model</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Model</th><th>Checks</th><th>Avg Drift</th><th>Self-Heals</th></tr></thead>
                    <tbody>{(metaQ.data.by_model || []).map((r: any) => <tr key={r.model_name} className="border-t"><td className="py-1">{r.model_name}</td><td>{r.checks}</td><td className={parseFloat(r.avg_drift) > 0.3 ? 'text-orange-500 font-bold' : ''}>{pct(r.avg_drift)}</td><td className="text-green-600">{r.heals}</td></tr>)}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* FAIRNESS */}
      {tab === 'fairness' && (
        <div className="space-y-4">
          <Button onClick={() => auditAll.mutate()} disabled={auditAll.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {auditAll.isPending ? 'Auditing…' : '⚖️ Run Full Fairness Audit'}
          </Button>
          {fairQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {fairQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Audits" value={fairQ.data.kpi?.total} />
                <KpiCard label="Avg Fairness Score" value={pct(fairQ.data.kpi?.avg_fairness)} color="#10b981" />
                <KpiCard label="Bias Events" value={fairQ.data.kpi?.bias_count} color="#f97316" />
                <KpiCard label="Ethical Escalations" value={fairQ.data.kpi?.escalations} color="#dc2626" />
              </div>
              {fairQ.data.kpi?.constitutional_flags > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <span className="text-red-700 font-semibold text-sm">⚠️ {fairQ.data.kpi?.constitutional_flags} Constitutional Violation(s) Detected</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Fairness by Audit Type</CardTitle></CardHeader>
                  <CardContent>
                    {(fairQ.data.by_type || []).map((r: any) => (
                      <div key={r.audit_type} className="flex justify-between items-center py-1 border-b last:border-0">
                        <span className="text-xs capitalize">{r.audit_type?.replace(/_/g,' ')}</span>
                        <div className="flex items-center gap-2">
                          {parseInt(r.bias_cnt) > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">{r.bias_cnt} bias</span>}
                          <span className={`font-semibold text-sm ${parseFloat(r.avg_fairness) < 0.75 ? 'text-red-500' : parseFloat(r.avg_fairness) < 0.85 ? 'text-yellow-500' : 'text-green-600'}`}>{pct(r.avg_fairness)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Bias Severity Distribution</CardTitle></CardHeader>
                  <CardContent className="flex gap-4 flex-wrap">
                    {(fairQ.data.by_severity || []).map((r: any) => (
                      <div key={r.bias_severity} className="text-center">
                        <span className="text-2xl font-bold" style={{ color: NAV }}>{r.cnt}</span>
                        <p className={`mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${SEV_COLORS[r.bias_severity] || 'bg-gray-100'}`}>{r.bias_severity}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* EVENTS */}
      {tab === 'events' && (
        <div className="space-y-4">
          {eventQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {eventQ.data && (
            <>
              <div className="flex gap-3 flex-wrap">
                {(eventQ.data.by_type || []).map((r: any) => (
                  <div key={r.event_type} className="px-3 py-2 border rounded-lg text-center">
                    <p className="text-xl font-bold" style={{ color: NAV }}>{r.cnt}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{r.event_type}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Event Stream</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Type</th><th>User</th><th>Processed</th><th>Created</th><th>Action</th></tr></thead>
                      <tbody>{(eventQ.data.events || []).slice(0, 25).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[120px]">{r.event_type}</td>
                          <td className="truncate max-w-[80px]">{r.user_id || '—'}</td>
                          <td>{r.processed ? <span className="text-green-600">✓</span> : <span className="text-orange-500">○</span>}</td>
                          <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                          <td>{!r.processed && <button onClick={() => processEvent.mutate(r.id)} className="text-xs text-blue-600 hover:underline">Process</button>}</td>
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

      {/* OBSERVABILITY */}
      {tab === 'observability' && (
        <div className="space-y-4">
          <Button onClick={() => seedMetrics.mutate()} disabled={seedMetrics.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {seedMetrics.isPending ? 'Seeding…' : '📊 Seed Observability Metrics'}
          </Button>
          {obsQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {obsQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Metrics" value={obsQ.data.kpi?.total_metrics} />
                <KpiCard label="Anomalies" value={obsQ.data.kpi?.anomalies} color="#dc2626" />
                <KpiCard label="Drift Detections" value={obsQ.data.kpi?.drift_detections} color="#f97316" />
                <KpiCard label="Avg Value" value={num(obsQ.data.kpi?.avg_value, 2)} />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Metrics Overview</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Metric</th><th>Count</th><th>Avg Value</th><th>Anomalies</th></tr></thead>
                    <tbody>{(obsQ.data.by_metric || []).map((r: any) => <tr key={r.metric_name} className="border-t"><td className="py-1">{r.metric_name?.replace(/_/g,' ')}</td><td>{r.cnt}</td><td>{num(r.avg_val, 2)}</td><td>{parseInt(r.anomaly_cnt) > 0 ? <span className="text-red-600 font-bold">{r.anomaly_cnt}</span> : '—'}</td></tr>)}</tbody>
                  </table>
                </CardContent>
              </Card>
              {(obsQ.data.trend_24h || []).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">24h Trend</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-1 items-end h-16">
                      {obsQ.data.trend_24h.map((r: any, i: number) => {
                        const maxVal = Math.max(...obsQ.data.trend_24h.map((x: any) => parseFloat(x.avg_val) || 0));
                        const h = maxVal > 0 ? Math.max(4, (parseFloat(r.avg_val) / maxVal) * 60) : 4;
                        return <div key={i} style={{ height: h, background: NAV, opacity: 0.7, flex: 1, borderRadius: 2 }} title={`${new Date(r.hr).toLocaleTimeString()}: ${num(r.avg_val, 1)}`} />;
                      })}
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
