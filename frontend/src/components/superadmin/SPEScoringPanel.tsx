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

export default function SPEScoringPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['spe-dashboard'],
    queryFn: () => fetch('/api/admin/spe/dashboard').then(r => r.json()),
  });
  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['spe-scores', page, search],
    queryFn: () => fetch(`/api/admin/spe/scores?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`).then(r => r.json()),
  });
  const { data: assessments } = useQuery({
    queryKey: ['spe-assessments'],
    queryFn: () => fetch('/api/spe/assessments?limit=50').then(r => r.json()),
  });

  const d = dash || {};
  const sc = d.scores || {};
  const bh = d.behavioural || {};
  const cg = d.cognitive || {};
  const as = d.assessments || {};
  const total = scores?.total || 0;
  const pageCount = Math.ceil(total / 20);

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#f8f9fc' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: NAV }}>S</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">SPE — Scoring Engine</h1>
          <p className="text-xs text-gray-400">Raw scoring · IRT · Behavioural · Cognitive (Sections 1–3)</p>
        </div>
      </div>

      {dashLoading ? (
        <div className="text-sm text-gray-400 animate-pulse">Loading dashboard…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCard('Assessments', as.active || 0, `${as.total || 0} total`)}
            {kpiCard('Scores Generated', sc.total_scores || 0, `${sc.unique_users || 0} users`)}
            {kpiCard('Avg Score', sc.avg_score || '—', 'composite normalised')}
            {kpiCard('Avg Confidence', sc.avg_confidence ? `${Math.round(Number(sc.avg_confidence) * 100)}%` : '—', `${sc.low_confidence || 0} low-conf`)}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCard('Avg Persistence', bh.avg_persistence || '—', 'behavioural', '#7c3aed')}
            {kpiCard('Avg Focus', bh.avg_focus || '—', 'behavioural', '#7c3aed')}
            {kpiCard('Avg Reasoning', cg.avg_reasoning || '—', 'cognitive', '#0891b2')}
            {kpiCard('Cognitive Overload', cg.overload_count || 0, 'users at risk', '#dc2626')}
          </div>
        </>
      )}

      {/* Assessments list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Assessments ({assessments?.total || 0})</h2>
        <div className="flex flex-wrap gap-2">
          {(assessments?.rows || []).map((a: Record<string, unknown>) => (
            <span key={String(a.id)} className="text-xs px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
              {String(a.name)} <span className="text-gray-400 ml-1">·</span> <span className="font-semibold text-gray-800">{String(a.respondent_count || 0)} respondents</span>
            </span>
          ))}
          {!assessments?.rows?.length && <span className="text-xs text-gray-400">No assessments yet — POST /api/spe/assessments to create one.</span>}
        </div>
      </div>

      {/* Scores table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Score Records ({total})</h2>
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2">
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search user…" className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-300" />
            <button type="submit" className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold" style={{ background: NAV }}>Search</button>
          </form>
        </div>
        {scoresLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading scores…</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-left">Assessment</th>
                    <th className="px-4 py-2 text-left">Composite</th>
                    <th className="px-4 py-2 text-left">Behavioural</th>
                    <th className="px-4 py-2 text-left">Cognitive</th>
                    <th className="px-4 py-2 text-left">Confidence</th>
                    <th className="px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(scores?.rows || []).map((row: Record<string, unknown>) => <ScoreRow key={String(row.score_id || row.id || Math.random())} row={row} />)}
                </tbody>
              </table>
            </div>
            {!scores?.rows?.length && <div className="p-8 text-center text-sm text-gray-400">No scores found. Use POST /api/spe/score to generate scores.</div>}
            {pageCount > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">Page {page} of {pageCount}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Prev</button>
                  <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent scores */}
      {d.recent_scores?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {d.recent_scores.slice(0, 5).map((s: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                <span className="font-mono">{String(s.user_id || '').slice(0, 20)}</span>
                <span className="text-gray-400">{String(s.assessment_name || '').slice(0, 20)}</span>
                <span className="font-semibold" style={{ color: NAV }}>{Math.round(Number(s.normalized_score))} pts</span>
                <span className="text-gray-400">{s.created_at ? new Date(String(s.created_at)).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
