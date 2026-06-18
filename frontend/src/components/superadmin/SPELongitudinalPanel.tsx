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

export default function SPELongitudinalPanel() {
  const [tab, setTab] = useState<'longitudinal' | 'predictive' | 'interventions'>('longitudinal');
  const [riskFilter, setRiskFilter] = useState('');

  const { data: longData, isLoading: longLoading } = useQuery({
    queryKey: ['spe-longitudinal'],
    queryFn: () => fetch('/api/admin/spe/longitudinal').then(r => r.json()),
  });
  const { data: predData, isLoading: predLoading } = useQuery({
    queryKey: ['spe-predictive', riskFilter],
    queryFn: () => fetch(`/api/admin/spe/predictive?limit=20${riskFilter ? `&risk_level=${riskFilter}` : ''}`).then(r => r.json()),
    enabled: tab === 'predictive',
  });
  const { data: ivData, isLoading: ivLoading } = useQuery({
    queryKey: ['spe-interventions'],
    queryFn: () => fetch('/api/admin/spe/interventions?limit=20').then(r => r.json()),
    enabled: tab === 'interventions',
  });

  const lk = longData?.kpi || {};
  const pk = predData?.kpi || {};
  const ik = ivData?.kpi || {};

  const tabs = [
    { id: 'longitudinal', label: 'Longitudinal Tracking' },
    { id: 'predictive', label: 'Predictive Scoring' },
    { id: 'interventions', label: 'Intervention Attribution' },
  ] as const;

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#f8f9fc' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: NAV }}>L</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">SPE — Longitudinal & Predictive Engine</h1>
          <p className="text-xs text-gray-400">Trajectory tracking · Burnout/dropout prediction · Intervention attribution (Sections 11–13)</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {longLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />) : [
          { label: 'Tracked Users', val: lk.tracked_users || 0 },
          { label: 'Accelerating', val: lk.accelerating || 0, color: '#22c55e' },
          { label: 'Burnout Risk', val: lk.at_burnout_risk || 0, color: '#dc2626' },
          { label: 'Stagnant', val: lk.stagnant || 0, color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: (c as { color?: string }).color || NAV }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`text-xs px-4 py-2 rounded-lg font-semibold transition-all ${tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`} style={{ background: tab === t.id ? NAV : 'transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Longitudinal */}
      {tab === 'longitudinal' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Trajectory Snapshots</h2>
          </div>
          {longLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Velocity</th>
                <th className="px-4 py-2 text-left">Acceleration</th>
                <th className="px-4 py-2 text-left">Pattern</th>
                <th className="px-4 py-2 text-left">Updated</th>
              </tr></thead>
              <tbody>
                {(longData?.trajectories || []).map((r: Record<string, unknown>) => (
                  <tr key={String(r.user_id)} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-mono text-gray-600">{String(r.user_id || '').slice(0, 22)}</td>
                    <td className="px-4 py-2"><span className="font-bold text-sm" style={{ color: NAV }}>{Math.round(Number(r.composite_score))}</span></td>
                    <td className="px-4 py-2 text-xs font-mono">{Number(r.velocity) >= 0 ? '+' : ''}{Number(r.velocity).toFixed(2)}</td>
                    <td className="px-4 py-2 text-xs font-mono">{Number(r.acceleration) >= 0 ? '+' : ''}{Number(r.acceleration).toFixed(2)}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TRAJECTORY_COLOR[String(r.pattern)] || 'bg-gray-100 text-gray-600'}`}>{String(r.pattern || 'stable').replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-2 text-xs text-gray-400">{r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!longLoading && !longData?.trajectories?.length && <div className="p-8 text-center text-sm text-gray-400">No trajectories yet. POST /api/spe/longitudinal/snapshot to compute.</div>}
        </div>
      )}

      {/* Predictive */}
      {tab === 'predictive' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Users Predicted', val: pk.total || 0 },
              { label: 'High Risk', val: pk.high_risk || 0, color: '#dc2626' },
              { label: 'Avg Burnout Prob', val: pk.avg_burnout ? `${pk.avg_burnout}%` : '—' },
              { label: 'Avg Employability', val: pk.avg_employability || '—' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: (c as { color?: string }).color || NAV }}>{c.val}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {['', 'low', 'medium', 'high'].map(r => (
              <button key={r} onClick={() => setRiskFilter(r)} className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${riskFilter === r ? 'border-transparent text-white' : 'border-gray-200 text-gray-500'}`} style={{ background: riskFilter === r ? NAV : 'white' }}>{r || 'All'}</button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {predLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Risk</th>
                  <th className="px-4 py-2 text-left">Burnout</th>
                  <th className="px-4 py-2 text-left">Dropout</th>
                  <th className="px-4 py-2 text-left">Employability</th>
                  <th className="px-4 py-2 text-left">Leadership</th>
                  <th className="px-4 py-2 text-left">30d CSI</th>
                </tr></thead>
                <tbody>
                  {(predData?.rows || []).map((r: Record<string, unknown>) => (
                    <tr key={String(r.user_id)} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{String(r.user_id || '').slice(0, 22)}</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RISK_COLOR[String(r.risk_level)] || 'bg-gray-100'}`}>{String(r.risk_level || 'low')}</span></td>
                      <td className="px-4 py-2 text-xs font-semibold" style={{ color: Number(r.burnout_probability) > 60 ? '#dc2626' : '#374151' }}>{Math.round(Number(r.burnout_probability))}%</td>
                      <td className="px-4 py-2 text-xs">{Math.round(Number(r.dropout_probability))}%</td>
                      <td className="px-4 py-2 text-xs" style={{ color: NAV }}>{Math.round(Number(r.employability_readiness))}</td>
                      <td className="px-4 py-2 text-xs">{Math.round(Number(r.leadership_emergence))}</td>
                      <td className="px-4 py-2 text-xs font-semibold">{r.predicted_csi_30d ? Math.round(Number(r.predicted_csi_30d)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!predLoading && !predData?.rows?.length && <div className="p-8 text-center text-sm text-gray-400">No predictions. POST /api/spe/predict per user to compute.</div>}
          </div>
        </div>
      )}

      {/* Interventions */}
      {tab === 'interventions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Interventions', val: ik.total || 0 },
              { label: 'Active', val: ik.active || 0 },
              { label: 'Avg Effectiveness', val: ik.avg_effectiveness != null ? `+${ik.avg_effectiveness}` : '—', color: '#22c55e' },
              { label: 'Positive Impact', val: ik.positive_impact || 0, color: '#22c55e' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: (c as { color?: string }).color || NAV }}>{c.val}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {ivLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Intervention</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Pre Score</th>
                  <th className="px-4 py-2 text-left">Post Score</th>
                  <th className="px-4 py-2 text-left">Effectiveness</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr></thead>
                <tbody>
                  {(ivData?.rows || []).map((r: Record<string, unknown>) => (
                    <tr key={String(r.id)} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{String(r.user_id || '').slice(0, 18)}</td>
                      <td className="px-4 py-2 text-xs font-medium text-gray-700">{String(r.intervention_name || '').slice(0, 25)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{String(r.intervention_type || '')}</td>
                      <td className="px-4 py-2 text-xs">{r.pre_score ? Math.round(Number(r.pre_score)) : '—'}</td>
                      <td className="px-4 py-2 text-xs">{r.post_score ? Math.round(Number(r.post_score)) : '—'}</td>
                      <td className="px-4 py-2 text-xs font-semibold" style={{ color: Number(r.effectiveness) > 0 ? '#22c55e' : Number(r.effectiveness) < 0 ? '#dc2626' : '#6b7280' }}>
                        {r.effectiveness != null ? `${Number(r.effectiveness) > 0 ? '+' : ''}${Math.round(Number(r.effectiveness))}` : '—'}
                      </td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.status === 'active' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{String(r.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!ivLoading && !ivData?.rows?.length && <div className="p-8 text-center text-sm text-gray-400">No interventions. POST /api/spe/interventions to log one.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
