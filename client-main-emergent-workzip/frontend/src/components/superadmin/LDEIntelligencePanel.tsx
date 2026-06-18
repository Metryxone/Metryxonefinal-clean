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

export default function LDEIntelligencePanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [userId, setUserId] = useState('');
  const [simName, setSimName] = useState('lde_trajectory_sim_1');
  const [simType, setSimType] = useState('developmental_trajectory');
  const [genLabel, setGenLabel] = useState('Gen-Z');
  const [nodeName, setNodeName] = useState('school_node_1');
  const [cohortId, setCohortId] = useState('cohort_001');
  const [seedResults, setSeedResults] = useState<SeedResult[]>([]);
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['lde-intel-master'], queryFn: () => fetchJson('/api/admin/lde/intelligence/master') });
  const cohortsQ = useQuery({ queryKey: ['lde-cohorts'], queryFn: () => fetchJson('/api/admin/lde/cohorts'), enabled: tab === 'cohort' });
  const multigenQ = useQuery({ queryKey: ['lde-multigen'], queryFn: () => fetchJson('/api/admin/lde/multigenerational'), enabled: tab === 'multigen' });
  const fedQ = useQuery({ queryKey: ['lde-federated'], queryFn: () => fetchJson('/api/admin/lde/federated'), enabled: tab === 'federated' });
  const simQ = useQuery({ queryKey: ['lde-sims'], queryFn: () => fetchJson('/api/admin/lde/simulations'), enabled: tab === 'simulation' });

  const post = (url: string, body: any) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

  const seedGraph = useMutation({
    mutationFn: () => post('/api/lde/graph/seed', {}),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['lde-intel-master'] });
      setSeedResults(prev => [{ op: 'graph', ts: new Date(), data: d }, ...prev.slice(0, 4)]);
    }
  });

  const seedOntology = useMutation({
    mutationFn: () => post('/api/lde/ontology/seed', {}),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['lde-intel-master'] });
      setSeedResults(prev => [{ op: 'ontology', ts: new Date(), data: d }, ...prev.slice(0, 4)]);
    }
  });

  const syncDomains = useMutation({
    mutationFn: () => post('/api/lde/graph/seed/domains', {}),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['lde-intel-master'] });
      setSeedResults(prev => [{ op: 'sync', ts: new Date(), data: d }, ...prev.slice(0, 4)]);
    }
  });

  const runReasoning = useMutation({
    mutationFn: () => post('/api/lde/semantic/reason', { user_id: userId, inference_type: 'temporal' }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-intel-master'] }); alert(`Reasoning chain generated: ${d.chain_name} (confidence: ${parseFloat(d.confidence).toFixed(2)})`); }
  });

  const computeBenchmark = useMutation({
    mutationFn: () => post('/api/lde/benchmark/compute', { user_id: userId }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-intel-master'] }); alert(`Computed ${d.computed} benchmark dimensions`); }
  });

  const updateCohort = useMutation({
    mutationFn: () => post('/api/lde/cohort/update', { cohort_id: cohortId, cohort_name: cohortId, member_count: 150 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-cohorts'] })
  });

  const recordMultigen = useMutation({
    mutationFn: () => post('/api/lde/multigenerational/record', { generation_label: genLabel, cohort_year: new Date().getFullYear() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-multigen'] })
  });

  const syncFederated = useMutation({
    mutationFn: () => post('/api/lde/federated/sync', { node_name: nodeName, institution_type: 'school' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-federated'] })
  });

  const runSimulation = useMutation({
    mutationFn: () => post('/api/lde/simulation/run', { simulation_name: simName, simulation_type: simType, population_size: 100 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-sims'] })
  });

  const runMetaCheck = useMutation({
    mutationFn: () => post('/api/lde/meta/check', { model_name: 'lde_core' }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-intel-master'] }); alert(`Meta health score: ${parseFloat(d.health_score).toFixed(2)} · Self-heal: ${d.self_healing_triggered}`); }
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Master Dashboard' },
    { id: 'graph', label: 'Knowledge Graph' },
    { id: 'semantic', label: 'Semantic Reasoning' },
    { id: 'benchmark', label: 'Benchmarking' },
    { id: 'cohort', label: 'Cohort Intelligence' },
    { id: 'multigen', label: 'Multi-Generational' },
    { id: 'federated', label: 'Federated Nodes' },
    { id: 'simulation', label: 'Simulation Engine' },
    { id: 'meta', label: 'Meta-Intelligence' }
  ];

  const master = masterQ.data;
  const num = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '—';
  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>LDE — Intelligence Engine</h2>
          <p className="text-sm text-gray-500">Knowledge Graph · Semantic Reasoning · Benchmarking · Cohort · Multi-Gen · Federated · Simulation · Meta</p>
        </div>
        <div className="flex gap-2 items-center">
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-44" />
          <Button onClick={() => runMetaCheck.mutate()} disabled={runMetaCheck.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {runMetaCheck.isPending ? 'Checking…' : '🔮 Meta Health Check'}
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
            <KpiCard label="Graph Nodes" value={master.knowledge_graph?.node_count} sub={`${master.knowledge_graph?.edge_count} edges`} />
            <KpiCard label="Semantic Chains" value={master.semantic_chains?.total} sub={`${pct(master.semantic_chains?.avg_confidence)} avg conf`} />
            <KpiCard label="Benchmarked Users" value={master.benchmarks?.users_benchmarked} sub={`${num(master.benchmarks?.avg_percentile, 0)}th avg percentile`} />
            <KpiCard label="Cohorts Tracked" value={master.cohorts?.total} sub={`${master.cohorts?.deteriorating} deteriorating`} color={parseInt(master.cohorts?.deteriorating) > 0 ? '#dc2626' : '#10b981'} />
            <KpiCard label="Federated Nodes" value={master.federated_nodes?.total} sub={`${master.federated_nodes?.synced} synced`} />
            <KpiCard label="Simulations Run" value={master.simulations?.total} sub={`${pct(master.simulations?.avg_robustness)} avg robustness`} />
            <KpiCard label="Meta Health Score" value={num(master.meta_health?.avg_health, 2)} color={parseFloat(master.meta_health?.avg_health) > 0.7 ? '#10b981' : '#dc2626'} />
            <KpiCard label="Self-Heals" value={master.meta_health?.self_heals} color="#a855f7" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Knowledge Graph Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Total nodes</span><span className="font-bold text-sm" style={{ color: NAV }}>{master.knowledge_graph?.node_count || 0}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Total edges</span><span className="font-bold text-sm" style={{ color: NAV }}>{master.knowledge_graph?.edge_count || 0}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-gray-500">Seed to populate</span><Button size="sm" variant="outline" onClick={() => seedGraph.mutate()} disabled={seedGraph.isPending} className="text-xs h-6">{seedGraph.isPending ? '…' : 'Seed Graph'}</Button></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Intelligence Health</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Semantic chains</span><span className="font-bold text-sm" style={{ color: NAV }}>{master.semantic_chains?.total || 0}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Avg semantic confidence</span><span className="text-xs">{pct(master.semantic_chains?.avg_confidence)}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Meta health avg</span><span className={`text-xs font-bold ${parseFloat(master.meta_health?.avg_health) > 0.7 ? 'text-green-600' : 'text-red-500'}`}>{num(master.meta_health?.avg_health, 2)}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-gray-600">Self-healing events</span><span className="text-xs">{master.meta_health?.self_heals || 0}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'graph' && (
        <div className="space-y-4">
          {/* Status banner — last-seeded timestamps from master endpoint (persisted in DB) */}
          {(() => {
            const st = master?.seed_timestamps;
            const entries: { label: string; icon: string; ts: string | null; count: number }[] = [
              { label: 'Knowledge Graph', icon: '🕸️', ts: st?.last_graph_seed_at || null, count: st?.graph_run_count || 0 },
              { label: 'Ontology', icon: '🧬', ts: st?.last_ontology_seed_at || null, count: st?.ontology_run_count || 0 },
              { label: 'Domain Sync', icon: '🔄', ts: st?.last_domain_sync_at || null, count: st?.domain_sync_run_count || 0 }
            ];
            const hasAny = entries.some(e => e.ts);
            if (!hasAny) return (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Not yet seeded</span>
                <span className="text-xs text-gray-400">— use the buttons below to populate the knowledge graph</span>
              </div>
            );
            return (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex flex-wrap gap-4 items-center">
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Last seeded</span>
                {entries.filter(e => e.ts).map(e => (
                  <span key={e.label} className="text-xs text-green-700 flex items-center gap-1">
                    {e.icon} <span className="font-medium">{e.label}</span>
                    <span className="text-green-500">— {new Date(e.ts!).toLocaleString()}</span>
                    {e.count > 1 && <span className="text-green-400">({e.count}×)</span>}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => seedGraph.mutate()} disabled={seedGraph.isPending || seedOntology.isPending || syncDomains.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {seedGraph.isPending ? 'Seeding…' : '🕸️ Seed Knowledge Graph'}
            </Button>
            <Button onClick={() => seedOntology.mutate()} disabled={seedGraph.isPending || seedOntology.isPending || syncDomains.isPending} size="sm" style={{ background: '#5b6fa8', color: '#fff' }}>
              {seedOntology.isPending ? 'Seeding…' : '🧬 Seed Ontology'}
            </Button>
            <Button onClick={() => syncDomains.mutate()} disabled={seedGraph.isPending || seedOntology.isPending || syncDomains.isPending} size="sm" variant="outline">
              {syncDomains.isPending ? 'Syncing…' : '🔄 Sync from DB'}
            </Button>
          </div>

          {/* Result breakdown for the most recent seed operation */}
          {seedResults.length > 0 && (() => {
            const latest = seedResults[0];
            const d = latest.data;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {latest.op === 'graph' && '🕸️ Knowledge Graph Seed Result'}
                    {latest.op === 'ontology' && '🧬 Ontology Seed Result'}
                    {latest.op === 'sync' && '🔄 Domain Sync Result'}
                    <span className="text-xs font-normal text-gray-400 ml-auto">{latest.ts.toLocaleString()}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {d?.error ? (
                    <p className="text-xs text-red-600 font-medium">{d.error}</p>
                  ) : (
                    <>
                      <div className="flex gap-6">
                        {latest.op !== 'sync' && (
                          <>
                            <div className="text-center">
                              <p className="text-2xl font-bold" style={{ color: NAV }}>{d?.seeded_nodes ?? '—'}</p>
                              <p className="text-xs text-gray-500">nodes seeded</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold" style={{ color: NAV }}>{d?.seeded_edges ?? d?.new_edges_this_run ?? '—'}</p>
                              <p className="text-xs text-gray-500">edges</p>
                            </div>
                          </>
                        )}
                        {latest.op === 'sync' && (
                          <>
                            <div className="text-center">
                              <p className="text-2xl font-bold" style={{ color: NAV }}>{d?.synced_nodes ?? '—'}</p>
                              <p className="text-xs text-gray-500">nodes synced</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold" style={{ color: NAV }}>{d?.new_edges_this_run ?? '—'}</p>
                              <p className="text-xs text-gray-500">new edges</p>
                            </div>
                            {d?.skipped_links_missing_parent != null && (
                              <div className="text-center">
                                <p className="text-2xl font-bold text-orange-500">{d.skipped_links_missing_parent}</p>
                                <p className="text-xs text-gray-500">skipped links</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {d?.breakdown && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2">Breakdown by type</p>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(d.breakdown).map(([k, v]) => (
                              <div key={k} className="border rounded px-3 py-1.5 flex justify-between items-center">
                                <span className="text-xs text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                                <span className="text-xs font-bold" style={{ color: NAV }}>{v as any}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {d?.message && <p className="text-xs text-gray-400 italic">{d.message}</p>}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Node types reference */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Knowledge Graph Schema</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">The LDE Knowledge Graph links Time ↔ Behaviour ↔ Emotion ↔ Cognition ↔ Intervention ↔ Outcome nodes with weighted causal edges and temporal lag annotations.</p>
              <div className="grid grid-cols-4 gap-2">
                {['Time','Behaviour','Emotion','Cognition','Intervention','Outcome','Trajectory','Signal'].map(t => (
                  <div key={t} className="border rounded-lg p-2 text-center">
                    <p className="text-xs font-semibold text-gray-700">{t}</p>
                    <p className="text-xs text-gray-400">node type</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['causes','predicts','enables','blocks','amplifies','inhibits','precedes','follows'].map(r => (
                  <div key={r} className="border rounded px-2 py-1 text-center">
                    <p className="text-xs text-gray-600 font-medium">{r}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'semantic' && (
        <div className="space-y-4">
          <Button onClick={() => runReasoning.mutate()} disabled={!userId || runReasoning.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {runReasoning.isPending ? 'Reasoning…' : '🧠 Run Semantic Reasoning'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Recursive temporal causal reasoning: behavioural evolution → intervention dependency mapping → longitudinal inference. Supports temporal, counterfactual, and longitudinal inference types.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { step: '1', name: 'Temporal Feature Extraction', desc: 'Extract signal patterns from feature store' },
                  { step: '2', name: 'Intervention Dependency Mapping', desc: 'Map causal intervention chains' },
                  { step: '3', name: 'Longitudinal Inference', desc: 'Project developmental trajectory forward' }
                ].map(s => (
                  <div key={s.step} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center" style={{ background: NAV }}>{s.step}</span>
                      <p className="text-xs font-semibold">{s.name}</p>
                    </div>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'benchmark' && (
        <div className="space-y-4">
          <Button onClick={() => computeBenchmark.mutate()} disabled={!userId || computeBenchmark.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {computeBenchmark.isPending ? 'Computing…' : '📊 Compute Benchmarks'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Computes percentile benchmarks across cohort, institution, age-band, CSI-group, and employability dimensions. Results show relative standing against peer populations.</p>
              <div className="grid grid-cols-3 gap-3">
                {['cohort','institution','age_band','csi_group','employability','global'].map(bt => (
                  <div key={bt} className="border rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-600 font-medium capitalize">{bt.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">5 dimensions</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'cohort' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={cohortId} onChange={e => setCohortId(e.target.value)} placeholder="cohort_id" className="border rounded px-2 py-1.5 text-sm w-36" />
            <Button onClick={() => updateCohort.mutate()} disabled={updateCohort.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {updateCohort.isPending ? 'Updating…' : '👥 Update Cohort Profile'}
            </Button>
          </div>
          {cohortsQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {cohortsQ.data && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Total Cohorts" value={cohortsQ.data.kpi?.total} />
                <KpiCard label="Avg Resilience" value={pct(cohortsQ.data.kpi?.avg_resilience)} color="#10b981" />
                <KpiCard label="Avg Engagement" value={pct(cohortsQ.data.kpi?.avg_engagement)} />
                <KpiCard label="Deteriorating" value={cohortsQ.data.kpi?.deteriorating} color="#dc2626" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Cohort Profiles</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Cohort</th><th>Type</th><th>Members</th><th>Resilience</th><th>Engagement</th><th>Status</th></tr></thead>
                    <tbody>{(cohortsQ.data.cohorts || []).map((r: any) => (
                      <tr key={r.cohort_id} className="border-t">
                        <td className="py-1 truncate max-w-[100px]">{r.cohort_name}</td>
                        <td>{r.cohort_type}</td>
                        <td style={{ color: NAV }}>{r.member_count}</td>
                        <td>{pct(r.avg_resilience_score)}</td>
                        <td>{pct(r.avg_engagement_score)}</td>
                        <td>{r.systemic_deterioration_flag ? <span className="text-red-500 text-xs">⚠ deteriorating</span> : <span className="text-green-600 text-xs">✓ stable</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'multigen' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <select value={genLabel} onChange={e => setGenLabel(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {['Gen-Z','Millennial','Gen-Alpha','Gen-X'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <Button onClick={() => recordMultigen.mutate()} disabled={recordMultigen.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {recordMultigen.isPending ? 'Recording…' : '🌍 Record Generational Data'}
            </Button>
          </div>
          {multigenQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {multigenQ.data && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {(multigenQ.data.by_generation || []).map((r: any) => (
                  <Card key={r.generation_label}>
                    <CardHeader><CardTitle className="text-sm">{r.generation_label}</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex justify-between"><span className="text-xs text-gray-500">Avg Capability</span><span className="text-xs font-bold" style={{ color: NAV }}>{pct(r.avg_capability)}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-gray-500">Workforce Readiness</span><span className="text-xs font-bold">{pct(r.avg_workforce)}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-gray-500">Resilience Shift</span><span className={`text-xs font-bold ${parseFloat(r.avg_resilience_shift) > 0 ? 'text-green-600' : 'text-red-500'}`}>{parseFloat(r.avg_resilience_shift) > 0 ? '+' : ''}{num(r.avg_resilience_shift, 3)}</span></div>
                      <div className="flex justify-between"><span className="text-xs text-gray-500">Records</span><span className="text-xs">{r.records}</span></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'federated' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={nodeName} onChange={e => setNodeName(e.target.value)} placeholder="node_name" className="border rounded px-2 py-1.5 text-sm w-40" />
            <Button onClick={() => syncFederated.mutate()} disabled={syncFederated.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {syncFederated.isPending ? 'Syncing…' : '🔗 Sync Federated Node'}
            </Button>
          </div>
          {fedQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {fedQ.data && (
            <>
              <div className="flex gap-2 flex-wrap">
                {(fedQ.data.by_status || []).map((r: any) => (
                  <div key={r.sync_status} className={`px-4 py-2 rounded-lg text-center ${STATUS_COLORS[r.sync_status] || 'bg-gray-100 text-gray-600'}`}>
                    <p className="text-xl font-bold">{r.cnt}</p>
                    <p className="text-xs">{r.sync_status}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Federated Institution Nodes (privacy-preserving)</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Node</th><th>Type</th><th>Noise Level</th><th>Status</th><th>Last Sync</th></tr></thead>
                    <tbody>{(fedQ.data.nodes || []).map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1 truncate max-w-[100px]">{r.node_name}</td>
                        <td>{r.institution_type}</td>
                        <td>{(parseFloat(r.privacy_noise_level) * 100).toFixed(0)}%</td>
                        <td><Pill val={r.sync_status} map={STATUS_COLORS} /></td>
                        <td>{r.last_sync_at ? new Date(r.last_sync_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'simulation' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={simName} onChange={e => setSimName(e.target.value)} placeholder="simulation name" className="border rounded px-2 py-1.5 text-sm w-44" />
            <select value={simType} onChange={e => setSimType(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {['developmental_trajectory','burnout_resilience','intervention_outcomes','breakthrough_transformation','custom'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <Button onClick={() => runSimulation.mutate()} disabled={runSimulation.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {runSimulation.isPending ? 'Simulating…' : '▶ Run Simulation'}
            </Button>
          </div>
          {simQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {simQ.data && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Simulation Results</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Name</th><th>Type</th><th>Population</th><th>Robustness</th><th>Fairness</th><th>Status</th></tr></thead>
                      <tbody>{(simQ.data.simulations || []).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[100px]">{r.simulation_name}</td>
                          <td className="truncate max-w-[100px]">{r.simulation_type?.replace(/_/g,' ')}</td>
                          <td>{r.population_size}</td>
                          <td>{pct(r.robustness_score)}</td>
                          <td className="text-green-600">{pct(r.fairness_score)}</td>
                          <td><Pill val={r.status} map={SIM_STATUS} /></td>
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

      {tab === 'meta' && (
        <div className="space-y-4">
          <Button onClick={() => runMetaCheck.mutate()} disabled={runMetaCheck.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {runMetaCheck.isPending ? 'Checking…' : '🔮 Run Meta Health Check'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Meta-longitudinal health monitoring checks temporal model drift, trajectory instability, and calibration degradation. Self-healing is triggered when drift exceeds 0.35.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Temporal Drift', desc: 'Model deviation from baseline temporal patterns', threshold: '> 0.35 → self-heal' },
                  { name: 'Trajectory Instability', desc: 'Variance in developmental trajectory predictions', threshold: '> 0.35 → self-heal' },
                  { name: 'Calibration Degradation', desc: 'Accuracy loss in scoring calibration', threshold: 'Monitored continuously' }
                ].map(m => (
                  <div key={m.name} className="border rounded-lg p-3">
                    <p className="text-xs font-semibold" style={{ color: NAV }}>{m.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{m.desc}</p>
                    <p className="text-xs text-orange-500 mt-1">{m.threshold}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
