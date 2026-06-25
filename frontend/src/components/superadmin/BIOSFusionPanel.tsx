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

export default function BIOSFusionPanel() {
  const [tab, setTab] = useState<'overview' | 'fusion' | 'metalearn' | 'traits' | 'phases'>('overview');
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({});
  const [traits, setTraits]       = useState<unknown[]>([]);
  const [metaRows, setMetaRows]   = useState<unknown[]>([]);
  const [phases, setPhases]       = useState<unknown[]>([]);
  const [computeId, setComputeId] = useState('');
  const [computeResult, setComputeResult] = useState<Record<string, unknown> | null>(null);
  const [fusionResult, setFusionResult]   = useState<Record<string, unknown> | null>(null);
  const [fusionId, setFusionId]           = useState('');

  useEffect(() => { loadAll(); }, [tab]);

  async function loadAll() {
    const d = await fetch('/api/admin/bios/fusion/dashboard').then(r => r.json()).catch(() => ({}));
    setDashboard(d as Record<string, unknown>);
    if (tab === 'traits') {
      const t = await fetch('/api/admin/bios/latent-traits').then(r => r.json()).catch(() => ({}));
      setTraits((t as Record<string, unknown[]>).rows || []);
    }
    if (tab === 'metalearn') {
      const m = await fetch('/api/admin/bios/meta-learning').then(r => r.json()).catch(() => ({}));
      setMetaRows((m as Record<string, unknown[]>).rows || []);
    }
    if (tab === 'phases') {
      const p = await fetch('/api/admin/bios/phase-transitions').then(r => r.json()).catch(() => ({}));
      setPhases((p as Record<string, unknown[]>).rows || []);
    }
  }

  async function computeTraits() {
    if (!computeId.trim()) return;
    const [tr, ml, fus] = await Promise.all([
      fetch('/api/bios/latent-traits/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: computeId }) }).then(r => r.json()),
      fetch('/api/bios/meta-learning/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: computeId }) }).then(r => r.json()),
    ]);
    setComputeResult({ traits: (tr as Record<string, unknown>).traits, phase: (tr as Record<string, unknown>).phase_stage, preferred_style: (ml as Record<string, unknown>).preferred_style });
    loadAll();
  }

  async function computeFusion() {
    if (!fusionId.trim()) return;
    const [f, mm, ph] = await Promise.all([
      fetch('/api/bios/fusion/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: fusionId }) }).then(r => r.json()),
      fetch('/api/bios/multimodal/fuse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: fusionId }) }).then(r => r.json()),
      fetch('/api/bios/phase-transition/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: fusionId }) }).then(r => r.json()),
    ]);
    setFusionResult({ fusion: f, multimodal: mm, transition: ph });
    loadAll();
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'fusion', label: 'Emotion-Cognitive Fusion' },
    { id: 'metalearn', label: 'Meta-Learning' },
    { id: 'traits', label: 'Latent Traits' },
    { id: 'phases', label: 'Phase Transitions' },
  ] as const;

  const dash = dashboard as Record<string, Record<string, unknown>>;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1f2937' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Layers size={28} color={NAVY} />
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NAVY }}>BIOS Fusion Intelligence</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Emotional-Cognitive · Meta-Learning · Latent Traits · Multi-Modal · Phase Transitions</p>
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
            <KpiCard label="Fusion Profiles" value={String(dash.fusion?.total || 0)} sub={`${dash.fusion?.overloaded || 0} overloaded`} />
            <KpiCard label="Meta-Learning Profiles" value={String(dash.meta_learning?.total || 0)} sub={`Top style: ${dash.meta_learning?.top_style || '—'}`} color="#7c3aed" />
            <KpiCard label="Latent Trait Profiles" value={String(dash.latent_traits?.total || 0)} sub={`Avg resilience: ${dash.latent_traits?.avg_resilience || '—'}`} color="#f59e0b" />
            <KpiCard label="Phase Transitions" value={String(dash.phase_transitions?.total || 0)} sub={`${dash.phase_transitions?.regressions || 0} regressions`} color="#ef4444" />
            <KpiCard label="Multi-Modal Fusions" value={String(dash.multimodal?.total || 0)} sub={`Avg fusion: ${dash.multimodal?.avg_fusion || '—'}`} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Compute Fusion Profile</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={fusionId} onChange={e => setFusionId(e.target.value)} placeholder="User email / ID" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
                <button onClick={computeFusion} style={{ padding: '8px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Fuse</button>
              </div>
              {fusionResult && (
                <div style={{ background: '#f5f3ff', borderRadius: 8, padding: 12, fontSize: 12 }}>
                  <div><b>Fusion State:</b> {String((fusionResult.fusion as Record<string, unknown>)?.fusion_state || '')}</div>
                  <div><b>Dominant Pattern:</b> {String((fusionResult.fusion as Record<string, unknown>)?.dominant_pattern || '')}</div>
                  <div><b>Multimodal Score:</b> {String((fusionResult.multimodal as Record<string, unknown>)?.fusion_score || '')}</div>
                  <div><b>Phase Transition:</b> {(fusionResult.transition as Record<string, unknown>)?.transition ? `${(fusionResult.transition as Record<string, string[]>)?.from_phase} → ${(fusionResult.transition as Record<string, string>)?.to_phase}` : 'No transition'}</div>
                </div>
              )}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Compute Traits + Meta-Learning</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={computeId} onChange={e => setComputeId(e.target.value)} placeholder="User email / ID" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }} />
                <button onClick={computeTraits} style={{ padding: '8px 14px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Compute</button>
              </div>
              {computeResult && (
                <div style={{ background: '#f0f4ff', borderRadius: 8, padding: 12, fontSize: 12 }}>
                  <div><b>Phase:</b> {String(computeResult.phase)}</div>
                  <div><b>Learning Style:</b> {String(computeResult.preferred_style)}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {Object.entries((computeResult.traits as Record<string, number>) || {}).map(([k, v]) => (
                      <span key={k} style={{ background: '#e0e7ff', color: NAVY, borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{k.replace(/_/g, ' ')}: <b>{v}</b></span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'fusion' && (
        <div>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 13 }}>Emotional-Cognitive fusion profiles — identify users whose emotional load is impairing cognitive performance.</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <KpiCard label="Overloaded" value={String(dash.fusion?.overloaded || 0)} color="#dc2626" sub="Both emotional + cognitive high" />
            <KpiCard label="Synchronized" value={String(dash.fusion?.synchronized || 0)} color="#22c55e" sub="Resonance >70" />
            <KpiCard label="Avg Emotional Load" value={String(dash.fusion?.avg_emotional || '—')} color="#f59e0b" />
            <KpiCard label="Avg Cognitive Load" value={String(dash.fusion?.avg_cognitive || '—')} color="#3b82f6" />
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, fontSize: 13, color: '#166534' }}>
            Use the "Compute Fusion Profile" on the Overview tab to generate profiles for specific users. Profiles are upserted per user and update automatically after each CAPADEX session.
          </div>
        </div>
      )}

      {tab === 'metalearn' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <KpiCard label="Profiles" value={String(dash.meta_learning?.total || 0)} />
            <KpiCard label="Avg Neuroadaptive" value={String(dash.meta_learning?.avg_neuroadaptive || '—')} color="#7c3aed" />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['User', 'Preferred Style', 'Neuroadaptive', 'Velocity', 'Adaptive Pacing', 'Updated'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(metaRows as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', color: NAVY, fontWeight: 600 }}>{String(row.user_id)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.preferred_style)} color={STYLE_COLORS[String(row.preferred_style)] || NAVY} /></td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{Math.round(Number(row.neuroadaptive_index || 0))}</td>
                    <td style={{ padding: '10px 14px' }}>{Number(row.learning_velocity || 0) > 0 ? <ArrowUpRight size={14} color="#22c55e" /> : <ArrowDownRight size={14} color="#ef4444" />} {Number(row.learning_velocity || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 14px' }}>{Math.round(Number(row.adaptive_pacing_score || 0))}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(row.updated_at)).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!metaRows.length && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No profiles yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'traits' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['User', 'Phase', 'Resilience', 'Leadership', 'Adaptability', 'Emotional Reg.', 'Exec. Function'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(traits as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', color: NAVY, fontWeight: 600, fontSize: 12 }}>{String(row.user_id)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.phase_stage)} color={PHASE_COLORS[String(row.phase_stage)] || NAVY} /></td>
                    {['resilience_latent', 'leadership_latent', 'adaptability_latent', 'emotional_regulation', 'executive_function_latent'].map(k => (
                      <td key={k} style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{Math.round(Number(row[k] || 0))}</div>
                        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginTop: 3, width: 50 }}>
                          <div style={{ height: 4, borderRadius: 2, width: `${Number(row[k] || 0)}%`, background: NAVY }} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {!traits.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No latent trait profiles yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'phases' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <KpiCard label="Transitions" value={String((dash.phase_transitions as Record<string, unknown>)?.total || 0)} />
            <KpiCard label="Regressions" value={String((dash.phase_transitions as Record<string, unknown>)?.regressions || 0)} color="#dc2626" />
            <KpiCard label="Accelerated" value={String((dash.phase_transitions as Record<string, unknown>)?.accelerated || 0)} color="#22c55e" />
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>{['User', 'From Phase', 'To Phase', 'Type', 'Regression?', 'Confidence', 'Detected'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(phases as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', color: NAVY, fontWeight: 600, fontSize: 12 }}>{String(row.user_id)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.from_phase)} color="#9ca3af" /></td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.to_phase)} color={PHASE_COLORS[String(row.to_phase)] || NAVY} /></td>
                    <td style={{ padding: '10px 14px' }}><Badge text={String(row.transition_type)} color="#7c3aed" /></td>
                    <td style={{ padding: '10px 14px' }}>{row.is_regression ? <Badge text="Regression" color="#dc2626" /> : <Badge text="Progress" color="#22c55e" />}</td>
                    <td style={{ padding: '10px 14px' }}>{Math.round(Number(row.confidence || 0) * 100)}%</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{new Date(String(row.detected_at)).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!phases.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No phase transitions detected yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
