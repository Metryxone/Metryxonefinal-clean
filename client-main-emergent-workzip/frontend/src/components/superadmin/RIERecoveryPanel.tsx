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

export default function RIERecoveryPanel() {
  const [search, setSearch] = useState('');
  const [trajectoryFilter, setTrajectoryFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rie-recovery', search, trajectoryFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (search) params.set('search', search);
      if (trajectoryFilter !== 'all') params.set('trajectory', trajectoryFilter);
      return fetch(`/api/admin/rie/recovery-profiles?${params}`).then(r => r.json());
    },
  });

  const profiles = data?.profiles || [];
  const stats = data?.stats || {};
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {selected && <ProfileDrawer profile={selected} onClose={() => setSelected(null)} />}

      <div>
        <h2 className="text-2xl font-bold" style={{ color: BRAND }}>RIE Recovery Profiles</h2>
        <p className="text-sm text-gray-500 mt-1">Recovery momentum, trajectory, and collapse detection per user</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold" style={{ color: BRAND }}>{stats.avg_momentum ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Avg Momentum</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.accelerating_count ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Accelerating</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.collapsing_count ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Collapsing</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.fatigue_count ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Fatigue Detected</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search user…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={trajectoryFilter} onValueChange={setTrajectoryFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trajectories</SelectItem>
            {['accelerating', 'improving', 'stable', 'declining', 'collapsing', 'plateaued'].map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BRAND }} />
        </div>
      ) : profiles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No recovery profiles found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {profiles.map((p: any) => {
            const trajColor = TRAJ_COLORS[p.trajectory] || '#9CA3AF';
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4 rounded-xl border bg-white hover:shadow-sm cursor-pointer"
                onClick={() => setSelected(p)}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm" style={{ backgroundColor: `${trajColor}18`, color: trajColor }}>
                  {p.momentum_score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.user_email}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-[10px] text-gray-400">V: {p.velocity}</span>
                    <span className="text-[10px] text-gray-400">S: {p.stability}</span>
                    <span className="text-[10px] text-gray-400">Sus: {p.sustainability}</span>
                    <span className="text-[10px] text-gray-400">{p.sessions_analyzed} sessions</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="text-[10px] capitalize" style={{ backgroundColor: `${trajColor}18`, color: trajColor, border: 'none' }}>{p.trajectory}</Badge>
                  {p.collapse_detected && <Badge className="text-[10px] bg-red-50 text-red-700 border-0">Collapse</Badge>}
                  {p.fatigue_detected && <Badge className="text-[10px] bg-amber-50 text-amber-700 border-0">Fatigue</Badge>}
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">Page {page + 1} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
