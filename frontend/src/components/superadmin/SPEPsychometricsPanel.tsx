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

export default function SPEPsychometricsPanel() {
  const [tab, setTab] = useState<'reports' | 'items' | 'ability' | 'fairness'>('reports');

  const { data, isLoading } = useQuery({
    queryKey: ['spe-psychometrics'],
    queryFn: () => fetch('/api/admin/spe/psychometrics').then(r => r.json()),
  });
  const { data: abilityData, isLoading: abilityLoading } = useQuery({
    queryKey: ['spe-ability'],
    queryFn: () => fetch('/api/admin/spe/ability').then(r => r.json()),
    enabled: tab === 'ability',
  });
  const { data: fairnessData, isLoading: fairnessLoading } = useQuery({
    queryKey: ['spe-fairness'],
    queryFn: () => fetch('/api/admin/spe/fairness').then(r => r.json()),
    enabled: tab === 'fairness',
  });

  const kpi = data?.kpi || {};
  const ak  = abilityData?.kpi || {};
  const fk  = fairnessData?.kpi || {};

  const tabs = [
    { id: 'reports', label: 'Reliability Reports' },
    { id: 'items', label: 'IRT Item Params' },
    { id: 'ability', label: 'Bayesian Ability' },
    { id: 'fairness', label: 'Fairness & DIF' },
  ] as const;

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#f8f9fc' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: NAV }}>Ψ</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">SPE — Psychometrics Engine</h1>
          <p className="text-xs text-gray-400">IRT calibration · Bayesian estimation · Normalization · Reliability · Fairness (Sections 4–9)</p>
        </div>
      </div>

      {/* KPI row */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Reports Generated', val: kpi.total_reports || 0 },
            { label: 'Avg Cronbach α', val: kpi.avg_alpha || '—' },
            { label: 'Excellent Reliability', val: kpi.excellent || 0 },
            { label: 'Good Reliability', val: kpi.good || 0 },
            { label: 'Avg Sample Size', val: kpi.avg_sample || 0 },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</div>
              <div className="text-2xl font-bold" style={{ color: NAV }}>{c.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`text-xs px-4 py-2 rounded-lg font-semibold transition-all ${tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`} style={{ background: tab === t.id ? NAV : 'transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Reliability Reports */}
      {tab === 'reports' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Reliability & Validity Reports</h2>
            <p className="text-xs text-gray-400 mt-0.5">POST /api/spe/calibrate/:assessmentId to generate</p>
          </div>
          {isLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left">Assessment</th>
                <th className="px-4 py-2 text-left">Cronbach α</th>
                <th className="px-4 py-2 text-left">Grade</th>
                <th className="px-4 py-2 text-left">Confidence</th>
                <th className="px-4 py-2 text-left">Sample</th>
                <th className="px-4 py-2 text-left">Generated</th>
              </tr></thead>
              <tbody>
                {(data?.reports || []).map((r: Record<string, unknown>) => (
                  <tr key={String(r.id)} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-medium text-gray-700">{String(r.assessment_name || '—').slice(0, 30)}</td>
                    <td className="px-4 py-2 text-xs font-mono font-bold" style={{ color: NAV }}>{r.cronbach_alpha || '—'}</td>
                    <td className="px-4 py-2">{badge(String(r.reliability_grade || 'Unrated'), gradeColor(String(r.reliability_grade)))}</td>
                    <td className="px-4 py-2 text-xs">{r.psychometric_confidence ? `${Math.round(Number(r.psychometric_confidence) * 100)}%` : '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">n={r.sample_size || 0}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{r.generated_at ? new Date(String(r.generated_at)).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !data?.reports?.length && <div className="p-8 text-center text-sm text-gray-400">No reports yet. Run calibration first.</div>}
        </div>
      )}

      {/* IRT Item Parameters */}
      {tab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">IRT Calibrated Item Parameters</h2>
          </div>
          {isLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left">Question</th>
                <th className="px-4 py-2 text-left">Difficulty (b)</th>
                <th className="px-4 py-2 text-left">Discrimination (a)</th>
                <th className="px-4 py-2 text-left">Guessing (c)</th>
                <th className="px-4 py-2 text-left">Information</th>
                <th className="px-4 py-2 text-left">n</th>
              </tr></thead>
              <tbody>
                {(data?.items || []).map((item: Record<string, unknown>) => (
                  <tr key={String(item.id)} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">{String(item.question_text || '').slice(0, 40)}{String(item.question_text || '').length > 40 ? '…' : ''}</td>
                    <td className="px-4 py-2 text-xs font-mono">{Number(item.difficulty).toFixed(3)}</td>
                    <td className="px-4 py-2 text-xs font-mono">{Number(item.discrimination).toFixed(3)}</td>
                    <td className="px-4 py-2 text-xs font-mono">{Number(item.guessing).toFixed(3)}</td>
                    <td className="px-4 py-2 text-xs font-mono" style={{ color: NAV }}>{Number(item.information_value).toFixed(3)}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{item.response_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !data?.items?.length && <div className="p-8 text-center text-sm text-gray-400">No calibrated items yet.</div>}
        </div>
      )}

      {/* Bayesian Ability Estimates */}
      {tab === 'ability' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Estimates', val: ak.total || 0 },
              { label: 'Avg Ability Score', val: ak.avg_ability || '—' },
              { label: 'Avg Confidence', val: ak.avg_confidence ? `${Math.round(Number(ak.avg_confidence) * 100)}%` : '—' },
              { label: 'Converged', val: ak.converged_count || 0 },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: NAV }}>{c.val}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {abilityLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Ability Score</th>
                  <th className="px-4 py-2 text-left">θ (posterior)</th>
                  <th className="px-4 py-2 text-left">Confidence</th>
                  <th className="px-4 py-2 text-left">Uncertainty</th>
                  <th className="px-4 py-2 text-left">Converged</th>
                </tr></thead>
                <tbody>
                  {(abilityData?.rows || []).map((r: Record<string, unknown>) => (
                    <tr key={String(r.id)} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{String(r.user_id || '').slice(0, 20)}</td>
                      <td className="px-4 py-2"><span className="text-sm font-bold" style={{ color: NAV }}>{Math.round(Number(r.ability_score))}</span></td>
                      <td className="px-4 py-2 text-xs font-mono">{Number(r.posterior_ability).toFixed(3)}</td>
                      <td className="px-4 py-2 text-xs">{Math.round(Number(r.confidence) * 100)}%</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{Number(r.uncertainty).toFixed(3)}</td>
                      <td className="px-4 py-2">{r.converged ? badge('Yes', 'bg-green-50 text-green-700') : badge('No', 'bg-gray-50 text-gray-500')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!abilityLoading && !abilityData?.rows?.length && <div className="p-8 text-center text-sm text-gray-400">No ability estimates. POST /api/spe/ability to compute.</div>}
          </div>
        </div>
      )}

      {/* Fairness & DIF */}
      {tab === 'fairness' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Items Analyzed', val: fk.total || 0 },
              { label: 'DIF Detected', val: fk.dif_count || 0, color: '#dc2626' },
              { label: 'Avg Effect Size', val: fk.avg_effect || '—' },
              { label: 'Resolved', val: fk.resolved || 0, color: '#22c55e' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</div>
                <div className="text-2xl font-bold" style={{ color: (c as { color?: string }).color || NAV }}>{c.val}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {fairnessLoading ? <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div> : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2 text-left">Question</th>
                  <th className="px-4 py-2 text-left">DIF</th>
                  <th className="px-4 py-2 text-left">Effect Size</th>
                  <th className="px-4 py-2 text-left">Bias Type</th>
                  <th className="px-4 py-2 text-left">Recommended Action</th>
                  <th className="px-4 py-2 text-left">Resolved</th>
                </tr></thead>
                <tbody>
                  {(fairnessData?.reports || []).map((r: Record<string, unknown>) => (
                    <tr key={String(r.id)} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-600">{String(r.question_text || '—').slice(0, 35)}…</td>
                      <td className="px-4 py-2">{r.dif_detected ? badge('DIF', 'bg-red-50 text-red-700') : badge('Clear', 'bg-green-50 text-green-700')}</td>
                      <td className="px-4 py-2 text-xs font-mono">{Number(r.effect_size).toFixed(3)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{String(r.bias_type || '—')}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{String(r.recommended_action || '—').slice(0, 35)}</td>
                      <td className="px-4 py-2">{r.resolved ? badge('Yes', 'bg-green-50 text-green-700') : badge('Open', 'bg-yellow-50 text-yellow-700')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!fairnessLoading && !fairnessData?.reports?.length && <div className="p-8 text-center text-sm text-gray-400">No DIF reports yet. POST /api/spe/fairness/dif to analyze.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
