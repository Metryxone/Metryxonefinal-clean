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

export default function BIOSFrontierPanel() {
  const [tab, setTab] = useState<'overview' | 'neuro' | 'causal' | 'emergent' | 'healing'>('overview');
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({});
  const [neuroRows, setNeuroRows]   = useState<unknown[]>([]);
  const [causalRows, setCausalRows] = useState<unknown[]>([]);
  const [emergent, setEmergent]     = useState<unknown[]>([]);
  const [healLog, setHealLog]       = useState<unknown[]>([]);
  const [healKpi, setHealKpi]       = useState<Record<string, unknown>>({});
  const [scanLoading, setScanLoading] = useState(false);
  const [healLoading, setHealLoading] = useState(false);
  const [analyzeInput, setAnalyzeInput] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { loadAll(); }, [tab]);

  async function loadAll() {
    try {
      const d = await fetch('/api/admin/bios/frontier/dashboard').then(r => r.json());
      setDashboard(d);
    } catch {}
    if (tab === 'neuro') {
      const d = await fetch('/api/admin/bios/neuro-symbolic/dashboard').then(r => r.json()).catch(() => ({}));
      setNeuroRows((d as Record<string, unknown[]>).recent || []);
    }
    if (tab === 'causal') {
      const d = await fetch('/api/admin/bios/causal-chains').then(r => r.json()).catch(() => ({}));
      setCausalRows((d as Record<string, unknown[]>).rows || []);
    }
    if (tab === 'emergent') {
      const d = await fetch('/api/admin/bios/emergent-patterns').then(r => r.json()).catch(() => ({}));
      setEmergent((d as Record<string, unknown[]>).patterns || []);
    }
    if (tab === 'healing') {
      const d = await fetch('/api/admin/bios/self-healing/log').then(r => r.json()).catch(() => ({}));
      setHealLog((d as Record<string, unknown[]>).rows || []);
      setHealKpi((d as Record<string, unknown>).kpi || {});
    }
  }

  async function runScan() {
    setScanLoading(true);
    await fetch('/api/bios/emergent/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
    await loadAll();
    setScanLoading(false);
  }

  async function runHeal() {
    setHealLoading(true);
    await fetch('/api/bios/self-heal/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
    await loadAll();
    setHealLoading(false);
  }

  async function runAnalyze() {
    if (!analyzeInput.trim()) return;
    const r = await fetch('/api/bios/neuro-symbolic/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: analyzeInput }) }).then(r => r.json()).catch(() => ({}));
    setAnalyzeResult(r as Record<string, unknown>);
    loadAll();
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'neuro', label: 'Neuro-Symbolic' },
    { id: 'causal', label: 'Causal Chains' },
    { id: 'emergent', label: 'Emergent Patterns' },
    { id: 'healing', label: 'Self-Healing' },
  ] as const;

  const dash = dashboard as Record<string, Record<string, unknown>>;
  const ns = dash.neuro_symbolic || {}; const ca = dash.causal || {}; const em = dash.emergent || {}; const sh = dash.self_healing || {};
  const agents: Array<Record<string, unknown>> = (dash.agents as Array<Record<string, unknown>>) || [];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1f2937' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Brain size={28} color={NAVY} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NAVY }}>BIOS Frontier Intelligence</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Neuro-Symbolic · Causal · Emergent · Self-Healing · Multi-Agent</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: tab === t.id ? NAVY : '#f3f4f6', color: tab === t.id ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <KpiCard label="Neuro-Symbolic Analyses" value={String(ns.total || 0)} sub={`Avg confidence: ${ns.avg_confidence || '—'}`} />
            <KpiCard label="Causal Chains" value={String(ca.total || 0)} sub={`${ca.users || 0} users covered`} />
            <KpiCard label="Emergent Patterns" value={String(em.total || 0)} sub={`${em.high_risk || 0} high risk`} color="#f59e0b" />
            <KpiCard label="Self-Healing Events" value={String(sh.total || 0)} sub={`${sh.healed || 0} resolved`} color="#22c55e" />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Agent Swarm Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {agents.map((a) => {
                const health = Number(a.health || 0);
                return (
                  <div key={String(a.agent_type)} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{String(a.agent_type).replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Runs: {String(a.run_count || 0)}</div>
                    <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: '#e5e7eb' }}>
                      <div style={{ height: 6, borderRadius: 3, width: `${health * 100}%`, background: health > 0.7 ? '#22c55e' : health > 0.4 ? '#f59e0b' : '#dc2626' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Health: {Math.round(health * 100)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={runScan} disabled={scanLoading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              <Activity size={15} />{scanLoading ? 'Scanning...' : 'Scan Emergent Patterns'}
            </button>
            <button onClick={runHeal} disabled={healLoading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              <Shield size={15} />{healLoading ? 'Healing...' : 'Trigger Self-Heal'}
            </button>
          </div>
        </div>
      )}

      {tab === 'neuro' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Analyse User</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={analyzeInput} onChange={e => setAnalyzeInput(e.target.value)} placeholder="Enter user email / ID" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
              <button onClick={runAnalyze} style={{ padding: '8px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Run</button>
            </div>
            {analyzeResult && (
              <div style={{ marginTop: 14, background: '#f0f4ff', borderRadius: 8, padding: 14 }}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: 6 }}>{String(analyzeResult.conclusion || '')}</div>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}><b>Reasoning path:</b> {String(analyzeResult.reasoning_path || '')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries((analyzeResult.neural_scores as Record<string, number>) || {}).map(([k, v]) => (
                    <div key={k} style={{ background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #c7d2fe' }}>
                      <b>{k.replace(/_/g, ' ')}:</b> {v}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['User', 'Conclusion', 'Confidence', 'Hidden Patterns', 'Date'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(neuroRows as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', color: NAVY, fontWeight: 600 }}>{String(row.user_id)}</td>
                    <td style={{ padding: '10px 14px', maxWidth: 300, fontSize: 12 }}>{String(row.conclusion || '')}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={`${Math.round(Number(row.confidence || 0) * 100)}%`} color={NAVY} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 11 }}>{String(((row.hidden_patterns as unknown[]) || []).length)} signals</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(row.created_at)).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!neuroRows.length && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No analyses yet — run an analysis above</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'causal' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>{['User', 'Cause Signal', 'Effect Signal', 'Lag (days)', 'Effect Size', 'Confidence', 'Type'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(causalRows as Array<Record<string, unknown>>).map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', color: NAVY, fontWeight: 600 }}>{String(row.user_id)}</td>
                  <td style={{ padding: '10px 14px' }}><Badge text={String(row.cause_signal)} color={NAVY} /></td>
                  <td style={{ padding: '10px 14px' }}><Badge text={String(row.effect_signal)} color="#7c3aed" /></td>
                  <td style={{ padding: '10px 14px' }}>{String(row.lag_days)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{String(row.effect_size)}</td>
                  <td style={{ padding: '10px 14px' }}><Badge text={`${Math.round(Number(row.confidence || 0) * 100)}%`} color="#22c55e" /></td>
                  <td style={{ padding: '10px 14px', fontSize: 11 }}>{String(row.causal_type)}</td>
                </tr>
              ))}
              {!causalRows.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No causal chains detected yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'emergent' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={runScan} disabled={scanLoading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              <RefreshCw size={14} />{scanLoading ? 'Scanning...' : 'Rescan Population'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {(emergent as Array<Record<string, unknown>>).map((p, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: `2px solid ${riskColor(String(p.risk_level))}40`, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{String(p.pattern_name)}</div>
                  <Badge text={String(p.risk_level)} color={riskColor(String(p.risk_level))} />
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{String(p.pattern_type)}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <div><span style={{ color: '#9ca3af' }}>Affected:</span> <b>{String(p.affected_users)}</b></div>
                  <div><span style={{ color: '#9ca3af' }}>Prevalence:</span> <b>{(Number(p.prevalence || 0) * 100).toFixed(1)}%</b></div>
                </div>
              </div>
            ))}
            {!emergent.length && <div style={{ padding: 20, color: '#9ca3af', textAlign: 'center', gridColumn: '1/-1' }}>No patterns detected — click Rescan Population</div>}
          </div>
        </div>
      )}

      {tab === 'healing' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Total Healing Events" value={String(healKpi.total || 0)} />
            <KpiCard label="Successfully Healed" value={String(healKpi.healed || 0)} color="#22c55e" />
            <KpiCard label="Drift Types Addressed" value={String(healKpi.drift_types || 0)} color="#7c3aed" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={runHeal} disabled={healLoading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              <Shield size={14} />{healLoading ? 'Running...' : 'Trigger Self-Heal Now'}
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['Drift Type', 'Component', 'Healing Action', 'Magnitude', 'Status', 'Triggered'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(healLog as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.drift_type).replace(/_/g, ' ')} color={NAVY} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{String(row.affected_component)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{String(row.healing_action).replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{String(Number(row.drift_magnitude || 0).toFixed(2))}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={row.success ? 'Healed' : 'Failed'} color={row.success ? '#22c55e' : '#dc2626'} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(row.triggered_at)).toLocaleString()}</td>
                  </tr>
                ))}
                {!healLog.length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No healing events — trigger a scan above</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
