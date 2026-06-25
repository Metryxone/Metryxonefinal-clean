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
const NAVY = '#344E86';


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

export default function BIOSSimulationPanel() {
  const [tab, setTab] = useState<'simulation' | 'economics' | 'knowledge' | 'ethics'>('simulation');
  const [simRuns, setSimRuns]     = useState<unknown[]>([]);
  const [simKpi, setSimKpi]       = useState<Record<string, unknown>>({});
  const [econRows, setEconRows]   = useState<unknown[]>([]);
  const [econKpi, setEconKpi]     = useState<Record<string, unknown>>({});
  const [econTypes, setEconTypes] = useState<unknown[]>([]);
  const [kgData, setKgData]       = useState<Record<string, unknown>>({});
  const [ethicsLog, setEthicsLog] = useState<unknown[]>([]);
  const [ethicsKpi, setEthicsKpi] = useState<Record<string, unknown>>({});
  const [loading, setLoading]     = useState(false);

  // Simulation form
  const [simName, setSimName]     = useState('Baseline Cohort');
  const [simScenario, setSimScenario] = useState('baseline');
  const [simSize, setSimSize]     = useState(100);
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);

  // Economics form
  const [econUser, setEconUser]   = useState('');
  const [econResult, setEconResult] = useState<Record<string, unknown> | null>(null);

  // KG form
  const [kgLabel, setKgLabel]     = useState('');
  const [kgType, setKgType]       = useState('concern');
  const [kgNodes, setKgNodes]     = useState<unknown[]>([]);

  useEffect(() => { loadAll(); }, [tab]);

  async function loadAll() {
    if (tab === 'simulation') {
      const d = await fetch('/api/admin/bios/simulations').then(r => r.json()).catch(() => ({}));
      setSimRuns((d as Record<string, unknown[]>).runs || []);
      setSimKpi((d as Record<string, unknown>).kpi || {});
    }
    if (tab === 'economics') {
      const d = await fetch('/api/admin/bios/economics').then(r => r.json()).catch(() => ({}));
      setEconRows((d as Record<string, unknown[]>).rows || []);
      setEconKpi((d as Record<string, unknown>).kpi || {});
      setEconTypes((d as Record<string, unknown[]>).intervention_types || []);
    }
    if (tab === 'knowledge') {
      const d = await fetch('/api/admin/bios/knowledge-graph/overview').then(r => r.json()).catch(() => ({}));
      setKgData(d as Record<string, unknown>);
      setKgNodes((d as Record<string, unknown[]>).nodes || []);
    }
    if (tab === 'ethics') {
      const d = await fetch('/api/admin/bios/ethics/audit-log').then(r => r.json()).catch(() => ({}));
      setEthicsLog((d as Record<string, unknown[]>).rows || []);
      setEthicsKpi((d as Record<string, unknown>).kpi || {});
    }
  }

  async function runSimulation() {
    setLoading(true);
    const r = await fetch('/api/bios/simulate/population', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ simulation_name: simName, scenario_type: simScenario, population_size: simSize }) }).then(r => r.json()).catch(() => ({}));
    setSimResult(r as Record<string, unknown>);
    loadAll();
    setLoading(false);
  }

  async function computeEcon() {
    if (!econUser.trim()) return;
    setLoading(true);
    const r = await fetch('/api/bios/economics/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: econUser }) }).then(r => r.json()).catch(() => ({}));
    setEconResult(r as Record<string, unknown>);
    loadAll();
    setLoading(false);
  }

  async function addKgNode() {
    if (!kgLabel.trim()) return;
    await fetch('/api/bios/knowledge-graph/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node_type: kgType, label: kgLabel }) }).catch(() => {});
    setKgLabel('');
    loadAll();
  }

  async function runEthicsAudit() {
    setLoading(true);
    await fetch('/api/bios/ethics/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
    loadAll();
    setLoading(false);
  }

  const TABS = [
    { id: 'simulation', label: 'Synthetic Simulation' },
    { id: 'economics', label: 'Behavioural Economics' },
    { id: 'knowledge', label: 'Knowledge Graph' },
    { id: 'ethics', label: 'Ethical Auditing' },
  ] as const;

  const kgStats = (kgData.stats as Record<string, unknown>) || {};
  const nodeTypes = (kgData.node_types as Array<Record<string, unknown>>) || [];
  const NODE_TYPE_COLORS: Record<string, string> = { concern: '#dc2626', behaviour: '#f59e0b', competency: '#22c55e', risk: '#dc2626', intervention: '#7c3aed', outcome: '#3b82f6' };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1f2937' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FlaskConical size={28} color={NAVY} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NAVY }}>BIOS Simulation & Knowledge</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Synthetic Population · Behavioural Economics · Knowledge Graph · Constitutional Ethics</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: tab === t.id ? NAVY : '#f3f4f6', color: tab === t.id ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{t.label}</button>
        ))}
      </div>

      {tab === 'simulation' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Simulation Runs" value={String(simKpi.total || 0)} />
            <KpiCard label="Total Simulated" value={String(simKpi.total_simulated || 0)} sub="synthetic profiles" color="#7c3aed" />
            <KpiCard label="Scenario Types" value={String(simKpi.scenario_types || 0)} color="#22c55e" />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Run New Simulation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Simulation Name</label>
                <input value={simName} onChange={e => setSimName(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Scenario</label>
                <select value={simScenario} onChange={e => setSimScenario(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
                  {Object.keys(SCENARIO_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Population</label>
                <input type="number" min={10} max={500} value={simSize} onChange={e => setSimSize(parseInt(e.target.value))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={runSimulation} disabled={loading} style={{ padding: '8px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {loading ? 'Running...' : 'Run'}
              </button>
            </div>
            {simResult && (
              <div style={{ marginTop: 14, background: '#f0f4ff', borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8 }}>Results — Population: {String((simResult as Record<string, Record<string, unknown>>).results?.population_size)}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <div><b>Avg CSI:</b> {String((simResult as Record<string, Record<string, unknown>>).results?.avg_csi)}</div>
                  <div><b>Avg Burnout:</b> {String((simResult as Record<string, Record<string, unknown>>).results?.avg_burnout)}%</div>
                  <div><b>With Intervention:</b> {String((simResult as Record<string, Record<string, unknown>>).results?.intervention_rate)}</div>
                </div>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, fontSize: 12, color: '#374151' }}>
                  {((simResult as Record<string, string[]>).insights || []).map((ins: string, j: number) => <li key={j}>{ins}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['Name', 'Scenario', 'Population', 'Key Insight', 'Ran At'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(simRuns as Array<Record<string, unknown>>).map((run, i) => {
                  const results = (run.results as Record<string, unknown>) || {};
                  const insights = (run.insights as string[]) || [];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: NAVY }}>{String(run.simulation_name)}</td>
                      <td style={{ padding: '10px 14px' }}><Badge text={String(run.scenario_type)} color={SCENARIO_COLORS[String(run.scenario_type)] || NAVY} /></td>
                      <td style={{ padding: '10px 14px' }}>{String(run.population_size)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, maxWidth: 250 }}>{insights[0] || `Avg CSI: ${results.avg_csi || '—'}`}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(run.ran_at)).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {!simRuns.length && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No simulations run yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'economics' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Profiles" value={String(econKpi.total || 0)} />
            <KpiCard label="Avg Motivation" value={String(econKpi.avg_motivation || '—')} color="#f59e0b" />
            <KpiCard label="Avg Reward Sensitivity" value={String(econKpi.avg_reward_sens || '—')} color="#7c3aed" />
            <KpiCard label="Low Motivation" value={String(econKpi.low_motivation || 0)} color="#dc2626" sub="motivation < 40" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Profile User Economics</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={econUser} onChange={e => setEconUser(e.target.value)} placeholder="User email / ID" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
                <button onClick={computeEcon} disabled={loading} style={{ padding: '8px 14px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Profile</button>
              </div>
              {econResult && (
                <div style={{ marginTop: 10, background: '#fffbeb', borderRadius: 8, padding: 12, fontSize: 12 }}>
                  <div><b>Motivation:</b> {String((econResult as Record<string, unknown>).motivation_level)}</div>
                  <div><b>Reward Sensitivity:</b> {String((econResult as Record<string, unknown>).reward_sensitivity)}</div>
                  <div><b>Optimal Intervention:</b> <Badge text={String((econResult as Record<string, unknown>).optimal_intervention)} color={ECON_COLORS[String((econResult as Record<string, unknown>).optimal_intervention)] || NAVY} /></div>
                </div>
              )}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Optimal Intervention Types</div>
              {(econTypes as Array<Record<string, unknown>>).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Badge text={String(t.optimal_intervention_type)} color={ECON_COLORS[String(t.optimal_intervention_type)] || NAVY} />
                  <span style={{ fontWeight: 700 }}>{String(t.n)} users</span>
                </div>
              ))}
              {!econTypes.length && <div style={{ color: '#9ca3af', fontSize: 13 }}>No profiles yet</div>}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['User', 'Motivation', 'Reward Sens.', 'Effort Cap.', 'Loss Aversion', 'Optimal Intervention'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(econRows as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', color: NAVY, fontWeight: 600, fontSize: 12 }}>{String(row.user_id)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: Number(row.motivation_level || 0) < 40 ? '#dc2626' : '#22c55e' }}>{Math.round(Number(row.motivation_level || 0))}</td>
                    <td style={{ padding: '10px 14px' }}>{Math.round(Number(row.reward_sensitivity || 0))}</td>
                    <td style={{ padding: '10px 14px' }}>{Math.round(Number(row.cognitive_effort_capacity || 0))}</td>
                    <td style={{ padding: '10px 14px' }}>{Math.round(Number(row.loss_aversion_index || 0))}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.optimal_intervention_type).replace(/_/g, ' ')} color={ECON_COLORS[String(row.optimal_intervention_type)] || NAVY} /></td>
                  </tr>
                ))}
                {!econRows.length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No economics profiles yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Graph Nodes" value={String(kgStats.total_nodes || 0)} />
            <KpiCard label="Graph Edges" value={String(kgStats.total_edges || 0)} color="#7c3aed" />
            <KpiCard label="Avg Edge Weight" value={String(kgStats.avg_weight || '—')} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Add Knowledge Node</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={kgType} onChange={e => setKgType(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
                  {['concern', 'behaviour', 'competency', 'risk', 'intervention', 'outcome'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={kgLabel} onChange={e => setKgLabel(e.target.value)} placeholder="Node label" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
                <button onClick={addKgNode} style={{ padding: '8px 14px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Add</button>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Node Type Distribution</div>
              {nodeTypes.map((nt, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Badge text={String((nt as Record<string, unknown>).node_type)} color={NODE_TYPE_COLORS[String((nt as Record<string, unknown>).node_type)] || NAVY} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{String((nt as Record<string, unknown>).count)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['Type', 'Label', 'Out Edges', 'In Edges', 'Added'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(kgNodes as Array<Record<string, unknown>>).slice(0, 20).map((n, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(n.node_type)} color={NODE_TYPE_COLORS[String(n.node_type)] || NAVY} /></td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{String(n.label)}</td>
                    <td style={{ padding: '10px 14px' }}>{String(n.out_degree || 0)}</td>
                    <td style={{ padding: '10px 14px' }}>{String(n.in_degree || 0)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(n.created_at)).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ethics' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Audits Run" value={String(ethicsKpi.total || 0)} />
            <KpiCard label="Passed" value={String(ethicsKpi.passed || 0)} color="#22c55e" />
            <KpiCard label="High/Critical Risk" value={String(ethicsKpi.high_risk || 0)} color="#dc2626" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={runEthicsAudit} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              <Scale size={15} />{loading ? 'Auditing...' : 'Run Full Ethics Audit'}
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['Audit Type', 'Component', 'Status', 'Risk Level', 'Violations', 'Audited At'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(ethicsLog as Array<Record<string, unknown>>).map((row, i) => {
                  const risk = String(row.risk_level);
                  const riskC = risk === 'critical' ? '#dc2626' : risk === 'high' ? '#f59e0b' : risk === 'medium' ? '#3b82f6' : '#22c55e';
                  const violations = (row.violations as string[]) || [];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px' }}><Badge text={String(row.audit_type).replace(/_/g, ' ')} color={NAVY} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#6b7280' }}>{String(row.component_audited)}</td>
                      <td style={{ padding: '10px 14px' }}><Badge text={row.passed ? 'Passed' : 'Failed'} color={row.passed ? '#22c55e' : '#dc2626'} /></td>
                      <td style={{ padding: '10px 14px' }}><Badge text={risk} color={riskC} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 11 }}>{violations.length ? violations[0] : '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(row.audited_at)).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {!ethicsLog.length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No audits run yet — click Run Full Ethics Audit</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
