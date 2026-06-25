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

export default function BIOSAgentsPanel() {
  const [tab, setTab] = useState<'agents' | 'population' | 'institutional' | 'federated'>('agents');
  const [agentStatus, setAgentStatus]   = useState<Record<string, unknown>>({});
  const [population, setPopulation]     = useState<Record<string, unknown>>({});
  const [events, setEvents]             = useState<unknown[]>([]);
  const [dispatchAgent, setDispatchAgent] = useState(AGENTS[0]);
  const [dispatchUser, setDispatchUser]   = useState('');
  const [dispatchResult, setDispatchResult] = useState<Record<string, unknown> | null>(null);
  const [orchUser, setOrchUser]           = useState('');
  const [orchResult, setOrchResult]       = useState<Record<string, unknown> | null>(null);
  const [cohortName, setCohortName]       = useState('');
  const [instTenant, setInstTenant]       = useState('');
  const [computeResult, setComputeResult] = useState<Record<string, unknown> | null>(null);
  const [fedNorms, setFedNorms]           = useState<Record<string, unknown>>({});
  const [loading, setLoading]             = useState(false);

  useEffect(() => { loadAll(); }, [tab]);

  async function loadAll() {
    const s = await fetch('/api/admin/bios/agents/status').then(r => r.json()).catch(() => ({}));
    setAgentStatus(s as Record<string, unknown>);
    const ev = await fetch('/api/admin/bios/agents/events').then(r => r.json()).catch(() => ({}));
    setEvents((ev as Record<string, unknown[]>).rows || []);
    if (tab === 'population') {
      const p = await fetch('/api/admin/bios/population').then(r => r.json()).catch(() => ({}));
      setPopulation(p as Record<string, unknown>);
    }
    if (tab === 'federated') {
      const f = await fetch('/api/admin/bios/federated/norms').then(r => r.json()).catch(() => ({}));
      setFedNorms(f as Record<string, unknown>);
    }
  }

  async function dispatch() {
    setLoading(true);
    const r = await fetch('/api/bios/agents/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_type: dispatchAgent, event_type: 'manual_trigger', user_id: dispatchUser }) }).then(r => r.json()).catch(() => ({}));
    setDispatchResult(r as Record<string, unknown>);
    loadAll();
    setLoading(false);
  }

  async function orchestrate() {
    if (!orchUser.trim()) return;
    setLoading(true);
    const r = await fetch('/api/bios/agents/orchestrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: orchUser }) }).then(r => r.json()).catch(() => ({}));
    setOrchResult(r as Record<string, unknown>);
    loadAll();
    setLoading(false);
  }

  async function computeCohort() {
    if (!cohortName.trim()) return;
    setLoading(true);
    const r = await fetch('/api/bios/population/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cohort_name: cohortName, cohort_type: 'school' }) }).then(r => r.json()).catch(() => ({}));
    setComputeResult(r as Record<string, unknown>);
    loadAll();
    setLoading(false);
  }

  async function computeInst() {
    if (!instTenant.trim()) return;
    setLoading(true);
    const r = await fetch('/api/bios/institutional/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: instTenant, institution_name: `Tenant ${instTenant}`, institution_type: 'school' }) }).then(r => r.json()).catch(() => ({}));
    setComputeResult(r as Record<string, unknown>);
    loadAll();
    setLoading(false);
  }

  const TABS = [
    { id: 'agents', label: 'Agent Swarm' },
    { id: 'population', label: 'Population Intelligence' },
    { id: 'institutional', label: 'Institutional Intelligence' },
    { id: 'federated', label: 'Federated Norms' },
  ] as const;

  const states = (agentStatus.states as Array<Record<string, unknown>>) || [];
  const kpi    = (agentStatus.kpi as Record<string, unknown>) || {};
  const cohorts = (population.cohorts as Array<Record<string, unknown>>) || [];
  const institutional = (population.institutional as Array<Record<string, unknown>>) || [];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1f2937' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Bot size={28} color={NAVY} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NAVY }}>BIOS Agent & Population Intelligence</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Multi-Agent Orchestration · Population Intelligence · Institutional AI · Federated Learning</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: tab === t.id ? NAVY : '#f3f4f6', color: tab === t.id ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{t.label}</button>
        ))}
      </div>

      {tab === 'agents' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Total Events" value={String(kpi.total_events || 0)} />
            <KpiCard label="Users Served" value={String(kpi.users_served || 0)} color="#7c3aed" />
            <KpiCard label="Avg Latency" value={`${kpi.avg_latency || 0}ms`} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            {states.map((a) => {
              const health = Number(a.health || 0);
              const stat = ((agentStatus.event_stats as Array<Record<string, unknown>>) || []).find(e => e.agent_type === a.agent_type) || {};
              return (
                <div key={String(a.agent_type)} style={{ background: '#fff', borderRadius: 10, border: `2px solid ${health > 0.7 ? '#22c55e' : '#f59e0b'}40`, padding: 16 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{AGENT_ICONS[String(a.agent_type)] || '🤖'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{String(a.agent_type).replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Runs: {String(a.run_count || 0)} · Avg: {String(stat.avg_latency || '—')}ms</div>
                  <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb' }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${health * 100}%`, background: health > 0.7 ? '#22c55e' : '#f59e0b', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Health: {Math.round(health * 100)}%</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Dispatch Single Agent</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Agent</label>
                <select value={dispatchAgent} onChange={e => setDispatchAgent(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
                  {AGENTS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>User ID (optional)</label>
                <input value={dispatchUser} onChange={e => setDispatchUser(e.target.value)} placeholder="email or ID" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={dispatch} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                <Play size={13} />Dispatch
              </button>
              {dispatchResult && <div style={{ marginTop: 10, fontSize: 12, background: '#f0f4ff', borderRadius: 7, padding: 10 }}><b>Output:</b> {JSON.stringify((dispatchResult as Record<string, unknown>).output)}</div>}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Orchestrate All Agents</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>User ID</label>
                <input value={orchUser} onChange={e => setOrchUser(e.target.value)} placeholder="email or ID" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={orchestrate} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                <Network size={13} />Orchestrate All
              </button>
              {orchResult && <div style={{ marginTop: 10, fontSize: 12, background: '#f5f3ff', borderRadius: 7, padding: 10 }}>{String((orchResult as Record<string, unknown>).agents_run)} agents run in {String((orchResult as Record<string, unknown>).total_latency_ms)}ms</div>}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: NAVY, fontSize: 14 }}>Recent Agent Events</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['Agent', 'Event', 'User', 'Latency', 'Status', 'Time'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(events as Array<Record<string, unknown>>).slice(0, 10).map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px' }}>{AGENT_ICONS[String(e.agent_type)] || '🤖'} {String(e.agent_type).replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{String(e.event_type)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{String(e.user_id || '—')}</td>
                    <td style={{ padding: '10px 14px' }}>{String(e.latency_ms)}ms</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(e.status)} color="#22c55e" /></td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(e.created_at)).toLocaleString()}</td>
                  </tr>
                ))}
                {!events.length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No events yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'population' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Compute Population Cohort</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={cohortName} onChange={e => setCohortName(e.target.value)} placeholder="Cohort name (e.g. Grade 10, Engineering Dept)" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
              <button onClick={computeCohort} disabled={loading} style={{ padding: '8px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Compute</button>
            </div>
            {computeResult && <div style={{ marginTop: 10, background: '#f0f4ff', borderRadius: 7, padding: 10, fontSize: 12 }}>{JSON.stringify(computeResult)}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {cohorts.map((c, i) => {
              const traj = String(c.trajectory);
              const trajColor = traj === 'thriving' ? '#22c55e' : traj === 'at_risk' ? '#dc2626' : '#f59e0b';
              return (
                <div key={i} style={{ background: '#fff', borderRadius: 10, border: `2px solid ${trajColor}30`, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{String(c.cohort_name)}</div>
                    <Badge text={traj} color={trajColor} />
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{String(c.cohort_type)} · {String(c.member_count)} members</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '6px 10px' }}><div style={{ color: '#9ca3af' }}>Avg CSI</div><div style={{ fontWeight: 700, color: NAVY }}>{String(c.avg_csi)}</div></div>
                    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '6px 10px' }}><div style={{ color: '#9ca3af' }}>Burnout</div><div style={{ fontWeight: 700, color: '#f59e0b' }}>{String(c.burnout_rate)}%</div></div>
                    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '6px 10px' }}><div style={{ color: '#9ca3af' }}>Dropout Risk</div><div style={{ fontWeight: 700, color: '#dc2626' }}>{String(c.dropout_risk_rate)}%</div></div>
                  </div>
                </div>
              );
            })}
            {!cohorts.length && <div style={{ padding: 20, color: '#9ca3af', textAlign: 'center', gridColumn: '1/-1' }}>No cohort intelligence computed yet</div>}
          </div>
        </div>
      )}

      {tab === 'institutional' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Compute Institutional Intelligence</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={instTenant} onChange={e => setInstTenant(e.target.value)} placeholder="Tenant ID (UUID)" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
              <button onClick={computeInst} disabled={loading} style={{ padding: '8px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Compute</button>
            </div>
            {computeResult && <div style={{ marginTop: 10, background: '#f5f3ff', borderRadius: 7, padding: 10, fontSize: 12 }}><b>Health:</b> {String((computeResult as Record<string, unknown>).overall_health)} · <b>Workforce:</b> {String((computeResult as Record<string, unknown>).workforce_readiness)}</div>}
          </div>
          {institutional.map((inst, i) => {
            const health = Number(inst.overall_health || 0);
            return (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: NAVY }}>{String(inst.institution_name || 'Institution')}</div>
                  <Badge text={String(inst.institution_type)} color={NAVY} />
                </div>
                <div style={{ marginBottom: 6 }}><span style={{ fontSize: 12, color: '#6b7280' }}>Overall Health: </span><b style={{ color: health > 70 ? '#22c55e' : health > 50 ? '#f59e0b' : '#dc2626' }}>{Math.round(health)}</b></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  {[['Resilience', inst.resilience_score, '#22c55e'], ['Engagement', inst.engagement_score, '#3b82f6'], ['Workforce', inst.workforce_readiness, '#7c3aed'], ['Intervention ROI', inst.intervention_roi, '#f59e0b']].map(([lbl, val, col]) => (
                    <div key={String(lbl)} style={{ background: '#f9fafb', borderRadius: 7, padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{lbl}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: String(col) }}>{Math.round(Number(val || 0))}</div>
                    </div>
                  ))}
                </div>
                {((inst.recommendations as string[]) || []).length > 0 && (
                  <div style={{ background: '#fffbeb', borderRadius: 7, padding: 10, fontSize: 12 }}>
                    <b>Recommendations:</b>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                      {((inst.recommendations as string[]) || []).map((r: string, j: number) => <li key={j}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          {!institutional.length && <div style={{ padding: 20, color: '#9ca3af', textAlign: 'center' }}>No institutional intelligence computed yet</div>}
        </div>
      )}

      {tab === 'federated' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Tenant Norms" value={String((fedNorms.kpi as Record<string, unknown>)?.tenants || 0)} />
            <KpiCard label="Total Norm Records" value={String((fedNorms.kpi as Record<string, unknown>)?.total_norms || 0)} color="#7c3aed" />
            <KpiCard label="Global Mean Score" value={String((fedNorms.kpi as Record<string, unknown>)?.global_mean || '—')} color="#22c55e" />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['Tenant', 'Score Type', 'Mean', 'Std Dev', 'Sample Size', 'Updated'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {((fedNorms.norms as Array<Record<string, unknown>>) || []).map((n, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{String(n.tenant_id || 'Global')}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(n.score_type)} color={NAVY} /></td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{String(n.mean_score)}</td>
                    <td style={{ padding: '10px 14px' }}>{String(n.std_dev)}</td>
                    <td style={{ padding: '10px 14px' }}>{String(n.sample_size)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(n.updated_at)).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!((fedNorms.norms as unknown[]) || []).length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No federated norms yet — scores accumulate from tenant assessments</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
