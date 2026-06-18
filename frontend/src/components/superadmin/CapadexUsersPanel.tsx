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

export default function CapadexUsersPanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['capadex-users', search, verified, sort, offset],
    queryFn: () => {
      const p = new URLSearchParams({ limit: String(LIMIT), offset: String(offset), sort });
      if (search)  p.set('search', search);
      if (verified !== 'all') p.set('verified', verified);
      return fetch(`/api/admin/capadex/users?${p}`).then(r => r.json());
    },
  });

  const users: CapadexUser[] = data?.rows || [];
  const stats = data?.stats || {};
  const total = data?.total || 0;

  function exportCSV() {
    const headers = ['ID','Name','Email','Phone','Verified','Sessions','Completed','Concerns','Avg Score','XP','Level','Risks','Joined'];
    const lines = [headers.join(','), ...users.map(u => [
      u.id.slice(0,8), `"${u.name}"`, `"${u.email}"`, `"${u.phone}"`,
      u.email_verified ? 'Yes' : 'No', u.total_sessions, u.completed_sessions,
      u.unique_concerns, u.avg_score ?? '', u.total_xp ?? 0, u.level ?? 1,
      u.open_risks, new Date(u.created_at).toLocaleDateString('en-IN'),
    ].join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `CAPADEX_Users_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>CAPADEX Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage user journeys, risk flags and interventions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total ?? 0, icon: Users, color: NAVY },
          { label: 'Verified',    value: stats.verified ?? 0, icon: CheckCircle, color: '#059669' },
          { label: 'This Week',   value: stats.new_this_week ?? 0, icon: TrendingUp, color: '#F59E0B' },
          { label: 'This Month',  value: stats.new_this_month ?? 0, icon: Award, color: '#7C3AED' },
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap bg-white rounded-xl border p-4">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search name, email, phone…" value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}
            className="pl-9" />
        </div>
        <Select value={verified} onValueChange={v => { setVerified(v); setOffset(0); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="yes">Verified</SelectItem>
            <SelectItem value="no">Unverified</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => { setSort(v); setOffset(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="active">Most Active</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b" style={{ backgroundColor: '#F8FAFF' }}>
                {['User', 'Status', 'Sessions', 'Concerns', 'Avg Score', 'XP / Level', 'Risks', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading users…
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No users found</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{user.name || '—'}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />{user.email}
                    </div>
                    {user.phone && <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />{user.phone}
                    </div>}
                  </td>
                  <td className="px-4 py-3">
                    {user.email_verified
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Verified</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Unverified</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{user.completed_sessions}</div>
                    <div className="text-xs text-gray-400">of {user.total_sessions}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{user.unique_concerns}</td>
                  <td className="px-4 py-3">{(() => {
                    const s = user.avg_score == null ? null : Number(user.avg_score);
                    if (s == null || Number.isNaN(s)) return <span className="text-gray-300">—</span>;
                    const tone = s >= 75 ? 'text-green-700 bg-green-50' : s >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
                    return <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>{s.toFixed(0)}</span>;
                  })()}</td>
                  <td className="px-4 py-3">
                    {user.total_xp != null ? (
                      <div>
                        <span className="font-semibold text-purple-700">{user.total_xp} XP</span>
                        <span className="text-xs text-gray-400 ml-1">L{user.level}</span>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {user.open_risks > 0
                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{user.open_risks}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => setSelectedUserId(user.id)}
                      className="text-xs flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> Journey
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm text-gray-600">
            <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>← Prev</Button>
              <Button size="sm" variant="outline" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Next →</Button>
            </div>
          </div>
        )}
      </div>

      {selectedUserId && (
        <UserJourneyDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}
