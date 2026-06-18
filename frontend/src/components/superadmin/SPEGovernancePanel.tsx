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

export default function SPEGovernancePanel() {
  const [tab, setTab] = useState<'overview' | 'adversarial' | 'reviews' | 'trust' | 'meta'>('overview');
  const [reviewStatus, setReviewStatus] = useState('pending');
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: govData, isLoading: govLoading } = useQuery({
    queryKey: ['spe-governance'],
    queryFn: () => fetch('/api/admin/spe/governance').then(r => r.json()),
  });
  const { data: adversarialData, isLoading: adversarialLoading } = useQuery({
    queryKey: ['spe-adversarial'],
    queryFn: () => fetch('/api/admin/spe/adversarial?limit=20').then(r => r.json()),
    enabled: tab === 'adversarial',
  });
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['spe-reviews', reviewStatus],
    queryFn: () => fetch(`/api/admin/spe/reviews?limit=20&status=${reviewStatus}`).then(r => r.json()),
    enabled: tab === 'reviews',
  });

  const resolveAdversarial = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/spe/adversarial/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolved: true }) }),
    onSuccess: () => { toast({ title: 'Flag resolved' }); qc.invalidateQueries({ queryKey: ['spe-adversarial'] }); qc.invalidateQueries({ queryKey: ['spe-governance'] }); },
  });
  const resolveReview = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => fetch(`/api/admin/spe/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: 'Review resolved' }); qc.invalidateQueries({ queryKey: ['spe-reviews'] }); },
  });

  const g = govData || {};
  const av = g.adversarial || {};
  const rv = g.reviews || {};
  const tr = g.trust || {};
  const mt = g.meta || {};

  const tabs = [
    { id: 'overview', label: 'Governance Overview' },
    { id: 'adversarial', label: 'Adversarial Detection' },
    { id: 'reviews', label: 'Human Review Queue' },
    { id: 'trust', label: 'Trust Calibration' },
    { id: 'meta', label: 'Meta-Scoring' },
  ] as const;

  const SEVERITY: Record<string, string> = {
    high: 'bg-red-50 text-red-700', medium: 'bg-yellow-50 text-yellow-700', low: 'bg-gray-100 text-gray-600'
  };
  const PRIORITY: Record<string, string> = {
    critical: 'bg-red-50 text-red-700', high: 'bg-orange-50 text-orange-700', medium: 'bg-yellow-50 text-yellow-700', low: 'bg-gray-100 text-gray-600'
  };

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#f8f9fc' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: NAV }}>G</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">SPE — Governance Engine</h1>
          <p className="text-xs text-gray-400">Adversarial robustness · Human-AI review · Trust calibration · Meta-scoring · Explainability (Sections 10, 14–18)</p>
        </div>
      </div>

      {/* Overview KPIs */}
      {!govLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Adversarial Flags</div>
            <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{av.open || 0}<span className="text-sm font-normal text-gray-400 ml-1">open</span></div>
            <div className="text-xs text-gray-400 mt-1">{av.high || 0} high-severity</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Review Queue</div>
            <div className="text-2xl font-bold" style={{ color: rv.urgent > 0 ? '#dc2626' : NAV }}>{rv.pending || 0}<span className="text-sm font-normal text-gray-400 ml-1">pending</span></div>
            <div className="text-xs text-gray-400 mt-1">{rv.urgent || 0} urgent</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Avg Trust Score</div>
            <div className="text-2xl font-bold" style={{ color: Number(tr.avg_trust) < 0.4 ? '#dc2626' : '#22c55e' }}>{tr.avg_trust ? Math.round(Number(tr.avg_trust) * 100) + '%' : '—'}</div>
            <div className="text-xs text-gray-400 mt-1">{tr.low_trust || 0} low-trust users</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">System Health</div>
            <div className="text-2xl font-bold" style={{ color: Number(mt.overall_system_health) > 0.7 ? '#22c55e' : '#f59e0b' }}>{mt.overall_system_health ? Math.round(Number(mt.overall_system_health) * 100) + '%' : '—'}</div>
            <div className="text-xs text-gray-400 mt-1">{mt.alerts ? JSON.parse(mt.alerts || '[]').length : 0} alerts</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {mt.alerts && JSON.parse(mt.alerts || '[]').length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-sm font-semibold text-red-700 mb-2">System Alerts</div>
          {JSON.parse(mt.alerts || '[]').map((a: string, i: number) => (
            <div key={i} className="text-xs text-red-600 flex items-center gap-2 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />{a}</div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`text-xs px-3 py-2 rounded-lg font-semibold transition-all ${tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`} style={{ background: tab === t.id ? NAV : 'transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Adversarial Summary</h3>
            {[['Total Flags', av.total], ['High Severity', av.high], ['Open', av.open], ['Flagged Users', av.flagged_users]].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between text-xs"><span className="text-gray-500">{l}</span><span className="font-semibold">{v || 0}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Review Summary</h3>
            {[['Total Reviews', rv.total], ['Pending', rv.pending], ['Completed', rv.completed], ['Urgent', rv.urgent]].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between text-xs"><span className="text-gray-500">{l}</span><span className="font-semibold">{v || 0}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Trust Summary</h3>
            {[['Users Profiled', tr.total], ['Avg Trust Score', tr.avg_trust ? Math.round(Number(tr.avg_trust) * 100) + '%' : '—'], ['Low Trust (<40%)', tr.low_trust]].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between text-xs"><span className="text-gray-500">{l}</span><span className="font-semibold">{v || 0}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Meta-Scoring Health</h3>
            {[['Scoring Stability', mt.scoring_stability ? Math.round(Number(mt.scoring_stability) * 100) + '%' : '—'], ['Fairness Health', mt.fairness_health ? Math.round(Number(mt.fairness_health) * 100) + '%' : '—'], ['Overall System', mt.overall_system_health ? Math.round(Number(mt.overall_system_health) * 100) + '%' : '—']].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between text-xs"><span className="text-gray-500">{l}</span><span className="font-semibold" style={{ color: NAV }}>{v}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Adversarial */}
      {tab === 'adversarial' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Adversarial Flags (Sections 14)</h2>
            <p className="text-xs text-gray-400">Auto-detected: rapid-fire, uniform timing, perfect patterns, entropy anomalies</p>
          </div>
          {adversarialLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Flag Type</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Anomaly Score</th>
                <th className="px-4 py-2 text-left">Detected</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr></thead>
              <tbody>
                {(adversarialData?.rows || []).map((r: Record<string, unknown>) => (
                  <tr key={String(r.id)} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-mono text-gray-600">{String(r.user_id || '').slice(0, 18)}</td>
                    <td className="px-4 py-2 text-xs font-medium">{String(r.flag_type || '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${SEVERITY[String(r.severity)] || 'bg-gray-100 text-gray-600'}`}>{String(r.severity)}</span></td>
                    <td className="px-4 py-2 text-xs font-mono">{Math.round(Number(r.anomaly_score) || 0)}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{r.detected_at ? new Date(String(r.detected_at)).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.resolved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.resolved ? 'Resolved' : 'Open'}</span></td>
                    <td className="px-4 py-2">
                      {!r.resolved && (
                        <button onClick={() => resolveAdversarial.mutate(String(r.id))} disabled={resolveAdversarial.isPending} className="text-xs px-2 py-1 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: NAV }}>Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!adversarialLoading && !adversarialData?.rows?.length && <div className="p-8 text-center text-sm text-gray-400">No adversarial flags. POST /api/spe/adversarial/analyze to check users.</div>}
        </div>
      )}

      {/* Reviews */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['pending', 'completed', 'escalated'].map(s => (
              <button key={s} onClick={() => setReviewStatus(s)} className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${reviewStatus === s ? 'border-transparent text-white' : 'border-gray-200 text-gray-500 bg-white'}`} style={{ background: reviewStatus === s ? NAV : undefined }}>{s}</button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Human-AI Review Queue (Section 15)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Escalated when: uncertainty high · emotional risk · contradictory signals · low confidence</p>
            </div>
            {reviewsLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Trigger</th>
                  <th className="px-4 py-2 text-left">Priority</th>
                  <th className="px-4 py-2 text-left">AI Score</th>
                  <th className="px-4 py-2 text-left">Uncertainty</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Escalated</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr></thead>
                <tbody>
                  {(reviewsData?.rows || []).map((r: Record<string, unknown>) => (
                    <tr key={String(r.id)} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{String(r.user_id || '').slice(0, 18)}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{String(r.trigger_reason || '').slice(0, 28)}</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY[String(r.priority)] || 'bg-gray-100 text-gray-600'}`}>{String(r.priority)}</span></td>
                      <td className="px-4 py-2 text-xs">{r.ai_score != null ? Math.round(Number(r.ai_score)) : '—'}</td>
                      <td className="px-4 py-2 text-xs">{Math.round(Number(r.uncertainty_level) * 100)}%</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>{String(r.status)}</span></td>
                      <td className="px-4 py-2 text-xs text-gray-400">{r.escalated_at ? new Date(String(r.escalated_at)).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2">
                        {r.status === 'pending' && (
                          <button onClick={() => resolveReview.mutate({ id: String(r.id), data: { status: 'completed', reviewer_email: 'admin@metryx.one' } })} disabled={resolveReview.isPending} className="text-xs px-2 py-1 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: NAV }}>Close</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!reviewsLoading && !reviewsData?.rows?.length && <div className="p-8 text-center text-sm text-gray-400">No reviews with status: {reviewStatus}. POST /api/spe/review/escalate to add one.</div>}
          </div>
        </div>
      )}

      {/* Trust */}
      {tab === 'trust' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Trust Calibration (Section 16)</h2>
          <p className="text-xs text-gray-400 mb-4">Trust = psychometric reliability × behavioural consistency × longitudinal stability × scoring consistency.<br/>POST /api/spe/trust/compute with user_id to compute.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Users Profiled', val: tr.total || 0 },
              { label: 'Avg Trust Score', val: tr.avg_trust ? Math.round(Number(tr.avg_trust) * 100) + '%' : '—' },
              { label: 'Low Trust Users', val: tr.low_trust || 0 },
            ].map(c => (
              <div key={c.label} className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold mb-1" style={{ color: NAV }}>{c.val}</div>
                <div className="text-xs text-gray-400">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      {tab === 'meta' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Meta-Scoring Engine (Section 17)</h2>
          <p className="text-xs text-gray-400 mb-4">Monitors scoring system health — detects instability, calibration drift, unfair scoring.<br/>POST /api/spe/meta/compute to refresh.</p>
          {mt.id ? (
            <div className="space-y-3">
              {[
                { label: 'Overall System Health', val: Math.round(Number(mt.overall_system_health) * 100) + '%', color: Number(mt.overall_system_health) > 0.7 ? '#22c55e' : '#f59e0b' },
                { label: 'Scoring Stability', val: Math.round(Number(mt.scoring_stability) * 100) + '%' },
                { label: 'Fairness Health', val: Math.round(Number(mt.fairness_health) * 100) + '%' },
                { label: 'Psychometric Health', val: Math.round(Number(mt.psychometric_health) * 100) + '%' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-40">{c.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: c.val, background: (c as { color?: string }).color || NAV }} />
                  </div>
                  <span className="text-xs font-semibold w-12 text-right">{c.val}</span>
                </div>
              ))}
              {JSON.parse(mt.alerts || '[]').length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold text-red-600">Active Alerts</div>
                  {JSON.parse(mt.alerts || '[]').map((a: string, i: number) => (
                    <div key={i} className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{a}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center py-8">No meta-score computed. POST /api/spe/meta/compute to generate.</div>
          )}
        </div>
      )}
    </div>
  );
}
