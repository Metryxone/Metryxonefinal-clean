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

export default function CapadexAnalyticsPanel() {
  const [dateRange] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['capadex-analytics', dateRange],
    queryFn: () => fetch('/api/admin/capadex/analytics').then(r => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  const overall = data?.overall || {};
  const funnel: any[] = data?.funnel || [];
  const completion: any[] = data?.completion || [];
  const topConcerns: any[] = data?.top_concerns || [];
  const scoreDist = data?.score_distribution || {};
  const ageDist: any[] = data?.age_distribution || [];
  const dailySessions: any[] = data?.daily_sessions || [];
  const personas: any[] = data?.personas || [];

  const totalScore = Number(scoreDist.emerging || 0) + Number(scoreDist.developing || 0) + Number(scoreDist.proficient || 0) + Number(scoreDist.advanced || 0);
  const completionRate = Number(overall.total_sessions) > 0
    ? Math.round((Number(overall.completed) / Number(overall.total_sessions)) * 100)
    : 0;
  const goodOutcomeRate = Number(overall.completed) > 0
    ? Math.round((Number(overall.good_outcomes) / Number(overall.completed)) * 100)
    : 0;

  const maxDailySession = Math.max(...dailySessions.map((d: any) => Number(d.sessions || 0)), 1);
  const maxConcernSessions = Math.max(...topConcerns.map((c: any) => Number(c.sessions || 0)), 1);

  const funnel4 = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'].map(code => {
    const found = funnel.find(f => f.stage_code === code);
    const comp = completion.find(c => c.stage_code === code);
    return {
      code, label: STAGE_LABEL[code], color: STAGE_COLOR[code],
      started: Number(found?.started || 0),
      completed: Number(found?.completed || 0),
      rate: Number(comp?.rate || 0),
    };
  });
  const maxFunnelStarted = Math.max(...funnel4.map(f => f.started), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>CAPADEX Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Cohort intelligence, funnel analysis and engagement metrics</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Activity}  label="Total Sessions"  value={Number(overall.total_sessions || 0).toLocaleString()} color={NAVY} />
        <StatCard icon={Users}     label="Unique Users"    value={Number(overall.unique_users || 0).toLocaleString()} sub="with email" color="#059669" />
        <StatCard icon={CheckCircle} label="Completion Rate" value={`${completionRate}%`} sub={`${Number(overall.completed || 0)} sessions`} color="#2563EB" />
        <StatCard icon={TrendingUp} label="Good Outcomes" value={`${goodOutcomeRate}%`} sub="Score ≥ 60" color="#7C3AED" />
      </div>

      {/* Stage Conversion Funnel */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: NAVY }} /> Stage Conversion Funnel
        </h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {funnel4.map((stage, i) => (
            <div key={stage.code} className="text-center relative">
              {i > 0 && (
                <div className="absolute -left-1.5 top-1/3 text-gray-300 text-lg pointer-events-none hidden md:block">›</div>
              )}
              <div className="rounded-xl p-4 mb-2" style={{ backgroundColor: stage.color + '12', border: `2px solid ${stage.color}30` }}>
                <div className="text-2xl font-bold" style={{ color: stage.color }}>{stage.started}</div>
                <div className="text-xs text-gray-500">Started</div>
                <div className="text-sm font-semibold mt-1" style={{ color: stage.color }}>{stage.completed}</div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
              <div className="text-xs font-semibold text-gray-700">{stage.label}</div>
              <div className="text-xs text-gray-400">{stage.rate}% completion</div>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {funnel4.map(stage => (
            <div key={stage.code} className="flex items-center gap-3">
              <div className="w-20 text-xs text-gray-500 font-medium">{stage.label}</div>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${maxFunnelStarted > 0 ? (stage.started / maxFunnelStarted) * 100 : 0}%`, backgroundColor: stage.color }} />
              </div>
              <div className="text-xs text-gray-500 w-8 text-right">{stage.rate}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4" style={{ color: NAVY }} /> Score Distribution
          </h3>
          <div className="space-y-3">
            {[
              { key: 'advanced',   label: 'Advanced (80+)',   color: '#7C3AED' },
              { key: 'proficient', label: 'Proficient (60–79)', color: '#2563EB' },
              { key: 'developing', label: 'Developing (40–59)', color: '#D97706' },
              { key: 'emerging',   label: 'Emerging (<40)',     color: '#DC2626' },
            ].map(({ key, label, color }) => {
              const val = Number(scoreDist[key] || 0);
              const pct = totalScore > 0 ? Math.round((val / totalScore) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{label}</span>
                    <span className="font-semibold" style={{ color }}>{val} ({pct}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t text-xs text-gray-400 text-right">
            Total: {totalScore} completed sessions
          </div>
        </div>

        {/* Age Band Distribution */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: NAVY }} /> Age Band & Persona Distribution
          </h3>
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Age Bands</div>
            {ageDist.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No age band data</p>
            ) : ageDist.map((a: any, i: number) => (
              <HBar key={a.age_band} label={`Band ${a.age_band}`} value={Number(a.sessions)}
                max={Math.max(...ageDist.map((x: any) => Number(x.sessions)), 1)}
                color={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][i % 4]} />
            ))}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Personas</div>
            {personas.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No persona data</p>
            ) : personas.slice(0, 6).map((p: any, i: number) => (
              <HBar key={p.persona} label={p.persona} value={Number(p.sessions)}
                max={Math.max(...personas.map((x: any) => Number(x.sessions)), 1)}
                color={[NAVY, '#059669', '#D97706', '#8B5CF6', '#DC2626', '#0891B2'][i % 6]} />
            ))}
          </div>
        </div>
      </div>

      {/* Top Concerns */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: NAVY }} /> Top Concerns by Volume
        </h3>
        {topConcerns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No concern data yet</p>
        ) : (
          <div className="space-y-1">
            {topConcerns.slice(0, 15).map((c: any) => (
              <HBar key={c.concern_name} label={c.concern_name} value={Number(c.sessions)}
                max={maxConcernSessions} color={NAVY}
                suffix={c.avg_score ? ` (avg ${Math.round(Number(c.avg_score))})` : ''} />
            ))}
          </div>
        )}
      </div>

      {/* Daily Sessions (last 30 days) */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: NAVY }} /> Daily Sessions (Last 30 Days)
        </h3>
        {dailySessions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No session data in last 30 days</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-24 min-w-max">
              {dailySessions.map((d: any) => {
                const height = maxDailySession > 0 ? Math.max(4, Math.round((Number(d.sessions) / maxDailySession) * 88)) : 4;
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1 group">
                    <div className="relative">
                      <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: {d.sessions} sessions
                      </div>
                    </div>
                    <div className="w-3 rounded-t-sm transition-all" style={{ height, backgroundColor: NAVY + 'CC' }} />
                    <div className="text-gray-400 text-xs" style={{ fontSize: '8px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 28 }}>
                      {new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
