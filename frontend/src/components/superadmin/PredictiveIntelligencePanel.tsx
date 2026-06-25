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

export default function PredictiveIntelligencePanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [riskFilter, setRiskFilter] = useState('');
  const [trajPage, setTrajPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'profiles'|'trajectories'>('profiles');

  const { data: dash } = useQuery({
    queryKey: ['pred-dashboard'],
    queryFn: async () => (await fetch('/api/admin/predictions/dashboard')).json(),
  });

  const { data: profiles, isLoading: profLoading } = useQuery({
    queryKey: ['pred-profiles', page, search, riskFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) p.set('search', search);
      if (riskFilter) p.set('risk', riskFilter);
      return (await fetch(`/api/admin/predictions/profiles?${p}`)).json();
    },
  });

  const { data: trajs, isLoading: trajLoading } = useQuery({
    queryKey: ['pred-trajectories', trajPage],
    queryFn: async () => (await fetch(`/api/admin/predictions/trajectories?page=${trajPage}&limit=30`)).json(),
    enabled: activeTab === 'trajectories',
  });

  const detectMut = useMutation({
    mutationFn: () => fetch('/api/admin/predictions/detect-trajectories', { method: 'POST' }),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['pred-trajectories'] }), 2000),
  });

  const dist = dash?.risk_distribution || {};
  const totalUsers = dash?.total || 0;
  const rows = profiles?.rows || [];
  const total = profiles?.total || 0;
  const trajRows = trajs?.rows || [];
  const trajTotal = trajs?.total || 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
            <TrendingUp size={22} style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: BRAND.primary }}>Predictive Intelligence</h1>
            <p className="text-xs text-gray-500">Dropout risk, burnout probability, employability readiness, leadership emergence</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => detectMut.mutate()} disabled={detectMut.isPending}
          className="flex items-center gap-1.5 text-xs">
          <RefreshCw size={13} className={detectMut.isPending ? 'animate-spin' : ''} />
          Detect Trajectories
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Avg Dropout Risk',       value: `${dash?.avg_dropout_risk||0}%`,      color: '#EF4444' },
          { label: 'Avg Burnout Probability', value: `${dash?.avg_burnout_probability||0}%`, color: '#F97316' },
          { label: 'Avg Employability',       value: `${dash?.avg_employability||0}%`,     color: '#10B981' },
          { label: 'Profiles Analysed',       value: totalUsers,                            color: BRAND.primary },
        ].map(k => (
          <Card key={k.label} className="border shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk distribution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5" style={{ color: BRAND.primary }}>
              <AlertTriangle size={14} style={{ color: '#EF4444' }} /> Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {Object.entries(RISK_CONFIG).map(([key, cfg]) => {
              const count = dist[key] || 0;
              const pct = totalUsers ? Math.round((count/totalUsers)*100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs w-14 font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>Trajectory Types</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            {(dash?.trajectories || []).slice(0,6).map((t: Record<string,unknown>) => {
              const cfg = TRAJECTORY_CONFIG[t.trajectory_type as string] || { label: t.trajectory_type as string, color: '#6B7280', icon: '•' };
              return (
                <div key={`${t.trajectory_type}-${t.trend_direction}`} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{cfg.icon}</span>
                    <span style={{ color: cfg.color }} className="font-medium">{cfg.label}</span>
                    <span className="text-gray-400">({t.trend_direction as string})</span>
                  </span>
                  <span className="text-gray-500 font-semibold">{t.count as number}</span>
                </div>
              );
            })}
            {(!dash?.trajectories || dash.trajectories.length === 0) && (
              <p className="text-xs text-gray-400 py-2">No trajectories detected yet. Click "Detect Trajectories".</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {[['profiles','Risk Profiles'],['trajectories','Developmental Trajectories']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id as 'profiles'|'trajectories')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab===id ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            style={activeTab===id ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'profiles' && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>
                User Risk Profiles <span className="font-normal text-gray-400">({total})</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {['','critical','high','medium','low'].map(r => {
                    const cfg = r ? RISK_CONFIG[r] : null;
                    return (
                      <button key={r} onClick={() => { setRiskFilter(r); setPage(1); }}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${riskFilter===r ? 'text-white border-transparent' : 'bg-white text-gray-500'}`}
                        style={riskFilter===r ? { backgroundColor: cfg?.color || BRAND.primary } : {}}>
                        {cfg?.label || 'All'}
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search email…" className="pl-7 h-7 text-xs w-44" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {profLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading profiles…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No profiles found. Scores are computed from CSI + LBI data.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {['User','Dropout Risk','Burnout Prob','Employability','Leadership','Composite','Risk','Last Active'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: Record<string, unknown>) => (
                      <tr key={r.user_email as string} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium" style={{ color: BRAND.primary }}>{r.user_email as string}</td>
                        {[
                          { val: r.dropout_risk, color: '#EF4444' },
                          { val: r.burnout_probability, color: '#F97316' },
                          { val: r.employability_readiness, color: '#10B981' },
                          { val: r.leadership_emergence, color: '#6366F1' },
                          { val: r.composite_risk, color: BRAND.primary },
                        ].map(({ val, color }, i) => (
                          <td key={i} className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: color }} />
                              </div>
                              <span className="font-semibold" style={{ color }}>{val as number}%</span>
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-2"><RiskBadge level={r.risk_label as string} /></td>
                        <td className="px-3 py-2 text-gray-400">{r.last_active ? new Date(r.last_active as string).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {total > 25 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-gray-500">Showing {(page-1)*25+1}–{Math.min(page*25,total)} of {total}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page*25>=total} onClick={() => setPage(p=>p+1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'trajectories' && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold" style={{ color: BRAND.primary }}>
              Developmental Trajectories <span className="font-normal text-gray-400">({trajTotal})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {trajLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading trajectories…</div>
            ) : trajRows.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No trajectories detected. Click "Detect Trajectories" above.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {['User','Trajectory','Direction','Confidence','Detected'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trajRows.map((r: Record<string, unknown>, i: number) => {
                    const cfg = TRAJECTORY_CONFIG[r.trajectory_type as string] || { label: r.trajectory_type as string, color: '#6B7280', icon: '•' };
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium" style={{ color: BRAND.primary }}>{r.user_email as string}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5" style={{ color: cfg.color }}>
                            <span>{cfg.icon}</span> <span className="font-medium">{cfg.label}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 capitalize text-gray-600">{r.trend_direction as string}</td>
                        <td className="px-3 py-2 text-gray-600">{Math.round(Number(r.confidence)*100)}%</td>
                        <td className="px-3 py-2 text-gray-400">{r.detected_at ? new Date(r.detected_at as string).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {trajTotal > 30 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-gray-500">Page {trajPage}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={trajPage===1} onClick={() => setTrajPage(p=>p-1)}>Prev</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={trajPage*30>=trajTotal} onClick={() => setTrajPage(p=>p+1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
