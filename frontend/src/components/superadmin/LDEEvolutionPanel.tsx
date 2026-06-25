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

export default function LDEEvolutionPanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [userId, setUserId] = useState('');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['lde-evolution-master'], queryFn: () => fetchJson('/api/admin/lde/evolution/master') });
  const twinsQ = useQuery({ queryKey: ['lde-twins'], queryFn: () => fetchJson('/api/admin/lde/twins'), enabled: tab === 'twin' });
  const fracturesQ = useQuery({ queryKey: ['lde-fractures-list'], queryFn: () => fetchJson('/api/admin/lde/fractures'), enabled: tab === 'fracture' });
  const driftQ = useQuery({ queryKey: ['lde-drift-alerts'], queryFn: () => fetchJson('/api/admin/lde/drift/alerts'), enabled: tab === 'drift' });

  const mutateFn = (url: string, body: any) => () =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

  const simulateTwin = useMutation({
    mutationFn: mutateFn('/api/lde/twin/simulate', { user_id: userId, simulation_scenario: 'admin_trigger' }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-twins'] }); qc.invalidateQueries({ queryKey: ['lde-evolution-master'] }); alert(`Twin simulated. Momentum: ${JSON.stringify(d.delta)}`); }
  });

  const seedOntology = useMutation({
    mutationFn: mutateFn('/api/lde/ontology/seed', {}),
    onSuccess: (d) => alert(`Seeded ${d.seeded_nodes} nodes and ${d.seeded_edges} edges`)
  });

  const computeMomentum = useMutation({
    mutationFn: mutateFn('/api/lde/momentum/compute', { user_id: userId }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-evolution-master'] }); alert(`Momentum: ${d.momentum_state} (score: ${d.momentum_score})`); }
  });

  const scanFractures = useMutation({
    mutationFn: mutateFn('/api/lde/fracture/scan', { user_id: userId }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-fractures-list'] }); alert(`Detected ${d.fractures_detected} fractures`); }
  });

  const detectHidden = useMutation({
    mutationFn: mutateFn('/api/lde/hidden/detect', { user_id: userId }),
    onSuccess: (d) => alert(`Detected ${d.detected} hidden transformations`)
  });

  const detectDrift = useMutation({
    mutationFn: mutateFn('/api/lde/drift/detect', { user_id: userId }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['lde-drift-alerts'] }); alert(`Detected ${d.drifts_detected} drift events`); }
  });

  const generateNarrative = useMutation({
    mutationFn: mutateFn('/api/lde/narrative/generate', { user_id: userId }),
    onSuccess: (d) => alert(`Narrative: "${d.title}"\n${d.content?.slice(0, 150)}…`)
  });

  const recordIdentity = useMutation({
    mutationFn: mutateFn('/api/lde/identity/checkpoint', { user_id: userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lde-evolution-master'] }); alert('Identity checkpoint recorded'); }
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Master Dashboard' },
    { id: 'twin', label: 'Digital Twin' },
    { id: 'ontology', label: 'Ontology' },
    { id: 'identity', label: 'Identity Evolution' },
    { id: 'narrative', label: 'Narrative Engine' },
    { id: 'momentum', label: 'Momentum' },
    { id: 'fracture', label: 'Fracture Detection' },
    { id: 'hidden', label: 'Hidden Transformation' },
    { id: 'trust', label: 'Trust Evolution' },
    { id: 'emotional', label: 'Emotional Memory' },
    { id: 'drift', label: 'Drift Detection' }
  ];

  const master = masterQ.data;
  const num = (v: any, d = 2) => v != null ? parseFloat(v).toFixed(d) : '—';
  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>LDE — Evolution Intelligence</h2>
          <p className="text-sm text-gray-500">Digital Twin · Ontology · Identity · Narrative · Momentum · Fracture · Hidden · Trust · Drift</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-44" />
          <Button onClick={() => computeMomentum.mutate()} disabled={!userId || computeMomentum.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {computeMomentum.isPending ? 'Computing…' : '⚡ Momentum'}
          </Button>
          <Button onClick={() => scanFractures.mutate()} disabled={!userId || scanFractures.isPending} size="sm" variant="outline">
            {scanFractures.isPending ? 'Scanning…' : '🔍 Fracture Scan'}
          </Button>
          <Button onClick={() => detectDrift.mutate()} disabled={!userId || detectDrift.isPending} size="sm" variant="outline">
            {detectDrift.isPending ? 'Detecting…' : '📊 Drift Detect'}
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
            <KpiCard label="Digital Twins" value={master.twins?.total} sub={`${num(master.twins?.avg_simulations, 0)} avg simulations`} />
            <KpiCard label="Ontology Nodes" value={master.ontology_size} />
            <KpiCard label="Active Fractures" value={master.fractures?.active} sub={`${master.fractures?.critical} critical`} color="#dc2626" />
            <KpiCard label="Silent Drifts" value={master.drift?.silent} color="#f97316" />
            <KpiCard label="Hidden Transformations" value={master.hidden_transformations?.total} color="#10b981" />
            <KpiCard label="Identity Breakthroughs" value={master.identity?.breakthroughs} color="#a855f7" />
            <KpiCard label="Avg Twin Accuracy" value={pct(master.twins?.avg_accuracy)} />
            <KpiCard label="Total Drift Events" value={master.drift?.total} color="#f59e0b" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Momentum Distribution</CardTitle></CardHeader>
              <CardContent>
                {(master.momentum_distribution || []).map((r: any) => (
                  <div key={r.momentum_state} className="flex justify-between items-center py-1 border-b last:border-0">
                    <Pill val={r.momentum_state} map={MOM_COLORS} />
                    <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                  </div>
                ))}
                {(!master.momentum_distribution?.length) && <p className="text-xs text-gray-400">Trigger momentum computation to populate</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Identity & Hidden Signals</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Total identity checkpoints</span><span className="font-bold text-sm" style={{ color: NAV }}>{master.identity?.total || 0}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Breakthroughs detected</span><span className="font-bold text-sm text-emerald-600">{master.identity?.breakthroughs || 0}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Hidden transformations</span><span className="font-bold text-sm text-purple-600">{master.hidden_transformations?.total || 0}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-gray-600">Avg transformation confidence</span><span className="text-xs">{pct(master.hidden_transformations?.avg_confidence)}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'twin' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => simulateTwin.mutate()} disabled={!userId || simulateTwin.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {simulateTwin.isPending ? 'Simulating…' : '🤖 Run Twin Simulation'}
            </Button>
          </div>
          {twinsQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {twinsQ.data && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Digital Twins</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Simulations</th><th>Accuracy</th><th>Last Simulated</th></tr></thead>
                    <tbody>{(twinsQ.data.twins || []).map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1 truncate max-w-[120px]">{r.user_id}</td>
                        <td style={{ color: NAV }}>{r.simulation_count}</td>
                        <td>{pct(r.accuracy_score)}</td>
                        <td>{new Date(r.last_simulated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'ontology' && (
        <div className="space-y-4">
          <Button onClick={() => seedOntology.mutate()} disabled={seedOntology.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {seedOntology.isPending ? 'Seeding…' : '🌱 Seed Developmental Ontology'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">The developmental ontology models human growth stages, construct hierarchies, and capability taxonomies. Nodes represent states, capabilities, and constructs. Edges represent developmental transitions and dependencies.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Stage Nodes', val: '5', desc: 'Forming → Advanced' },
                  { label: 'Construct Nodes', val: '5', desc: 'Resilience, EI, Adaptability…' },
                  { label: 'Capability Nodes', val: '3', desc: 'Leadership, Self-Reg, Growth Mindset' },
                  { label: 'Ontology Nodes', val: '2', desc: 'Root + v1 taxonomy' },
                  { label: 'Transition Edges', val: '4', desc: 'Stage progressions' },
                  { label: 'Enabling Edges', val: '5', desc: 'Capability dependencies' }
                ].map(i => (
                  <div key={i.label} className="border rounded-lg p-3">
                    <p className="text-xs text-gray-500">{i.label}</p>
                    <p className="text-xl font-bold" style={{ color: NAV }}>{i.val}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{i.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'identity' && (
        <div className="space-y-4">
          <Button onClick={() => recordIdentity.mutate()} disabled={!userId || recordIdentity.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {recordIdentity.isPending ? 'Recording…' : '🪞 Record Identity Checkpoint'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Identity evolution tracks four dimensions at each checkpoint: confidence, self-efficacy, aspiration, and motivation. Breakthrough flags are raised when confidence gains exceed 15% between checkpoints.</p>
              <div className="grid grid-cols-2 gap-3">
                {['Confidence', 'Self-Efficacy', 'Aspiration', 'Motivation', 'Identity Coherence'].map(d => (
                  <div key={d} className="border rounded-lg p-3 flex justify-between items-center">
                    <span className="text-xs text-gray-600">{d}</span>
                    <span className="text-xs font-bold" style={{ color: NAV }}>0.0 – 1.0</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'narrative' && (
        <div className="space-y-4">
          <Button onClick={() => generateNarrative.mutate()} disabled={!userId || generateNarrative.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {generateNarrative.isPending ? 'Generating…' : '✍️ Generate Developmental Narrative'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Rule-based narrative generation synthesises timeline data, identity evolution, and momentum state into a coherent developmental story. Tone adapts based on current state (celebratory/analytical/supportive/urgent).</p>
              <div className="grid grid-cols-3 gap-3">
                {['accelerating', 'breakthrough', 'recovery', 'stagnation', 'fracture', 'stable'].map(s => (
                  <div key={s} className={`px-3 py-2 rounded-lg text-center ${MOM_COLORS[s] || 'bg-gray-100 text-gray-600'}`}>
                    <p className="text-xs font-semibold capitalize">{s}</p>
                    <p className="text-xs text-gray-500 mt-0.5">template ready</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'momentum' && (
        <div className="space-y-4">
          <Button onClick={() => computeMomentum.mutate()} disabled={!userId || computeMomentum.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {computeMomentum.isPending ? 'Computing…' : '⚡ Compute Momentum'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Momentum = growth_velocity × 0.5 + stability × 0.3 + sustainability × 0.2. States: acceleration | breakthrough | stable | recovery | stagnation | collapse.</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { name: 'Growth Velocity', desc: 'Δ score between last two checkpoints' },
                  { name: 'Stability Score', desc: 'Variance across recent sessions' },
                  { name: 'Sustainability', desc: 'Forecast consistency over 30d' }
                ].map(d => (
                  <div key={d.name} className="border rounded-lg p-3">
                    <p className="text-xs font-semibold" style={{ color: NAV }}>{d.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{d.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'fracture' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => scanFractures.mutate()} disabled={!userId || scanFractures.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {scanFractures.isPending ? 'Scanning…' : '🔍 Run Fracture Scan'}
            </Button>
          </div>
          {fracturesQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {fracturesQ.data && (
            <>
              <div className="flex gap-3 flex-wrap">
                {(fracturesQ.data.distribution || []).map((r: any) => (
                  <div key={`${r.fracture_type}-${r.severity}`} className={`px-3 py-2 rounded-lg text-center ${SEV_COLORS[r.severity] || 'bg-gray-100'}`}>
                    <p className="text-lg font-bold">{r.cnt}</p>
                    <p className="text-xs">{r.fracture_type}</p>
                    <p className="text-xs font-semibold">{r.severity}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Active Fractures</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Type</th><th>Severity</th><th>Recovery %</th><th>Forecast (days)</th></tr></thead>
                      <tbody>{(fracturesQ.data.fractures || []).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[100px]">{r.user_id}</td>
                          <td className="capitalize">{r.fracture_type}</td>
                          <td><Pill val={r.severity} map={SEV_COLORS} /></td>
                          <td>{pct(r.recovery_probability)}</td>
                          <td>{r.stabilization_forecast_days}d</td>
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

      {tab === 'hidden' && (
        <div className="space-y-4">
          <Button onClick={() => detectHidden.mutate()} disabled={!userId || detectHidden.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {detectHidden.isPending ? 'Detecting…' : '🔬 Detect Hidden Transformations'}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Detects latent capabilities, leadership emergence, silent acceleration, hidden resilience, and breakthrough potential via cross-domain signal correlation and temporal convergence analysis.</p>
              <div className="grid grid-cols-2 gap-3">
                {['latent_capability','leadership_emergence','silent_acceleration','hidden_resilience','breakthrough_potential'].map(t => (
                  <div key={t} className="border rounded-lg p-2">
                    <p className="text-xs font-semibold text-gray-700">{t.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">confidence threshold: 0.45</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'trust' && (
        <div className="space-y-4">
          <Button onClick={() => fetch('/api/lde/trust/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()).then(d => alert(`Trust state: ${d.trust_state} (overall: ${d.overall_trust})`)) }
            disabled={!userId} size="sm" style={{ background: NAV, color: '#fff' }}>
            📈 Record Trust Checkpoint
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Trust evolution monitors three dimensions: intervention trust, mentor trust, and institutional trust. States: collapse | recovering | stabilizing | stable | growing.</p>
              <div className="grid grid-cols-3 gap-3">
                {['Intervention Trust','Mentor Trust','Institutional Trust'].map(d => (
                  <div key={d} className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">{d}</p>
                    <div className="flex justify-center gap-1 mt-2">
                      {Object.entries(TRUST_COLORS).map(([k, v]) => (
                        <span key={k} className={`px-1 py-0.5 rounded text-xs ${v}`}>{k.slice(0, 3)}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'emotional' && (
        <div className="space-y-4">
          <Button onClick={() => fetch('/api/lde/emotional-memory/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()).then(d => alert(`Stored: ${d.emotional_peak} (intensity: ${d.peak_intensity})`))}
            disabled={!userId} size="sm" style={{ background: NAV, color: '#fff' }}>
            🧠 Store Emotional Memory
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Emotional memory captures trigger events, emotional peaks, recovery patterns, and burnout flags. Enables longitudinal emotional cycle analysis and pattern recognition.</p>
              <div className="grid grid-cols-4 gap-2">
                {['joy','anxiety','frustration','hope','despair','confusion','determination'].map(e => (
                  <div key={e} className="border rounded px-2 py-1 text-center text-xs text-gray-600 capitalize">{e}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'drift' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => detectDrift.mutate()} disabled={!userId || detectDrift.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {detectDrift.isPending ? 'Detecting…' : '📊 Run Drift Detection'}
            </Button>
          </div>
          {driftQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {driftQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(driftQ.data.by_type || []).map((r: any) => (
                  <KpiCard key={r.drift_type} label={r.drift_type} value={num(r.avg_mag, 3)} sub={`${r.silent} silent`} color={parseFloat(r.avg_mag) > 0.2 ? '#dc2626' : NAV} />
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Drift Alerts (by severity)</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Type</th><th>Severity</th><th>Magnitude</th><th>Silent</th><th>Urgency</th></tr></thead>
                      <tbody>{(driftQ.data.alerts || []).slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[100px]">{r.user_id}</td>
                          <td className="capitalize">{r.drift_type}</td>
                          <td><Pill val={r.drift_severity} map={SEV_COLORS} /></td>
                          <td>{num(r.drift_magnitude, 3)}</td>
                          <td>{r.silent_deterioration_flag ? <span className="text-red-500">✓</span> : '—'}</td>
                          <td className="capitalize">{r.intervention_urgency}</td>
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
    </div>
  );
}
