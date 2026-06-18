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

export default function CapadexInterventionsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [riskFilter, setRiskFilter] = useState('all');
  const [intStatus, setIntStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'risk' | 'interventions'>('risk');

  const { data: riskData, isLoading: riskLoading, refetch: refetchRisk } = useQuery({
    queryKey: ['capadex-risk-flags', riskFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (riskFilter === 'open')     p.set('resolved', 'false');
      if (riskFilter === 'resolved') p.set('resolved', 'true');
      if (['critical','high','medium','low'].includes(riskFilter)) p.set('severity', riskFilter);
      return fetch(`/api/admin/capadex/risk-flags?${p}`).then(r => r.json());
    },
  });

  const { data: intData, isLoading: intLoading, refetch: refetchInt } = useQuery({
    queryKey: ['capadex-interventions', intStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (intStatus !== 'all') p.set('status', intStatus);
      return fetch(`/api/admin/capadex/interventions?${p}`).then(r => r.json());
    },
  });

  const risks: RiskFlag[] = riskData?.rows || [];
  const riskStats = riskData?.stats || {};
  const interventions: Intervention[] = intData?.rows || [];
  const intStats = intData?.stats || {};

  const resolveRisk = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/capadex/risk-flags/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true, resolved_by: 'super-admin' }),
    }),
    onSuccess: () => { toast({ title: 'Risk flag resolved' }); refetchRisk(); },
  });

  const updateIntervention = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => fetch(`/api/admin/capadex/interventions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => { toast({ title: 'Intervention updated' }); refetchInt(); },
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Risk & Interventions</h2>
          <p className="text-sm text-gray-500 mt-0.5">Monitor behavioural risk flags and manage intervention plans</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchRisk(); refetchInt(); }} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="flex items-center gap-2" style={{ backgroundColor: NAVY }}>
            <Plus className="w-4 h-4" /> New Intervention
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Risk Flags',  value: riskStats.open      ?? 0, color: '#DC2626', icon: AlertTriangle },
          { label: 'Critical Risks',   value: riskStats.critical   ?? 0, color: '#EA580C', icon: AlertTriangle },
          { label: 'Active Interventions', value: intStats.active ?? 0, color: '#2563EB', icon: Activity },
          { label: 'Completed',        value: intStats.completed   ?? 0, color: '#059669', icon: CheckCircle },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + '18' }}>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([['risk', 'Risk Flags', riskStats.open ?? 0], ['interventions', 'Interventions', intStats.active ?? 0]] as const).map(([tab, label, count]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
            {Number(count) > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: NAVY + '18', color: NAVY }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'risk' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['all','open','resolved','critical','high','medium','low'].map(f => (
              <button key={f} onClick={() => setRiskFilter(f)}
                className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${riskFilter === f ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-300'}`}
                style={riskFilter === f ? { backgroundColor: NAVY } : {}}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {riskLoading ? (
            <div className="flex items-center justify-center h-40"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: NAVY }} /></div>
          ) : risks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No risk flags found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {risks.map(flag => (
                <RiskCard key={flag.id} flag={flag} onResolve={(id) => resolveRisk.mutate(id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'interventions' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['all','pending','active','completed','cancelled'].map(s => (
              <button key={s} onClick={() => setIntStatus(s)}
                className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${intStatus === s ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-300'}`}
                style={intStatus === s ? { backgroundColor: NAVY } : {}}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {intLoading ? (
            <div className="flex items-center justify-center h-40"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: NAVY }} /></div>
          ) : interventions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No interventions found</p>
              <Button size="sm" onClick={() => setShowCreate(true)} className="mt-3" style={{ backgroundColor: NAVY }}>
                Create First Intervention
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {interventions.map(iv => (
                <InterventionCard key={iv.id} iv={iv}
                  onUpdate={(id, data) => updateIntervention.mutate({ id, data })} />
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateInterventionModal onClose={() => setShowCreate(false)} onCreated={() => { refetchInt(); }} />
      )}
    </div>
  );
}
