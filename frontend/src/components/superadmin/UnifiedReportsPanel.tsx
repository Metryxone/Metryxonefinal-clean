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
import CapadexReportsPanel from './CapadexReportsPanel';


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

// ── Report source registry ───────────────────────────────────────────────
// The Reports console aggregates assessment reports across MetryxOne's
// intelligence engines. `'all'` is handled separately (overview grid + back
// pill); `SOURCES` lists the individual engines surfaced as filter pills.
type SourceType = 'all' | 'capadex' | 'lbi' | 'sdi' | 'competency';

interface SourceMeta {
  id: Exclude<SourceType, 'all'>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const SOURCES: SourceMeta[] = [
  { id: 'capadex',    label: 'CAPADEX',    description: 'Behavioural assessment reports',  icon: Brain,         color: BRAND.primary },
  { id: 'lbi',        label: 'LBI',        description: 'Leadership Behaviour Index',      icon: Layers,        color: BRAND.purple },
  { id: 'sdi',        label: 'SDI',        description: 'Skill Development Index',         icon: GraduationCap, color: BRAND.accent },
  { id: 'competency', label: 'Competency', description: 'Competency assessment reports',   icon: Target,        color: BRAND.indigo },
];

function SourceTab({
  source, active, count, onClick,
}: {
  source: SourceMeta;
  active: boolean;
  count: number | null;
  onClick: () => void;
}) {
  const Icon = source.icon;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
      style={
        active
          ? { background: source.color, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
          : { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {source.label}
      {count !== null && (
        <span
          className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
          style={
            active
              ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
              : { background: '#374151', color: '#fff' }
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}

function AllSourcesOverview({
  sourceCounts, onSelect,
}: {
  sourceCounts: Record<SourceType, number | null>;
  onSelect: (s: SourceType) => void;
}) {
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {SOURCES.map(s => {
        const Icon = s.icon;
        const count = sourceCounts[s.id];
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${s.color}15` }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold" style={{ color: s.color }}>
                {count ?? '—'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{s.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: s.color }}>
              View reports <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptySourcePanel({ source }: { source: SourceMeta }) {
  const Icon = source.icon;
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${source.color}15` }}
      >
        <Icon className="w-7 h-7" style={{ color: source.color }} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">No {source.label} reports yet</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">
        {source.description} will appear here once {source.label} assessments are completed.
      </p>
    </div>
  );
}

export default function UnifiedReportsPanel() {
  const [activeSource, setActiveSource] = useState<SourceType>('all');
  const [sourceCounts, setSourceCounts] = useState<Record<SourceType, number | null>>({
    all: null, capadex: null, lbi: null, sdi: null, competency: null,
  });
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [countsError, setCountsError] = useState<string | null>(null);

  // Fetch counts for the overview tabs
  useEffect(() => {
    async function loadCounts() {
      setLoadingCounts(true);
      setCountsError(null);
      try {
        // CAPADEX — use existing reports endpoint
        const r = await fetch('/api/admin/capadex/reports?limit=1');
        if (r.ok) {
          const d = await r.json();
          const cap = Number(d.total ?? 0);
          setSourceCounts(prev => ({
            ...prev,
            capadex: cap,
            lbi: 0,
            sdi: 0,
            competency: 0,
            all: cap, // will grow as others get data
          }));
        } else {
          setCountsError("Couldn't load data. Please try again.");
        }
      } catch {
        setCountsError("Couldn't load data. Please try again.");
      } finally {
        setLoadingCounts(false);
      }
    }
    loadCounts();
  }, []);

  const currentSource = SOURCES.find(s => s.id === activeSource);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BarChart2 className="w-5 h-5 text-[#344E86]" />
              <h2 className="text-base font-bold text-gray-900">Reports</h2>
              {sourceCounts.all !== null && (
                <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FA] text-[#344E86]">
                  {sourceCounts.all} total
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Unified repository of all assessment reports generated across MetryxOne
            </p>
          </div>
          {activeSource !== 'all' && currentSource && (
            <button
              onClick={() => setActiveSource('all')}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              ← All sources
            </button>
          )}
        </div>

        {/* Source type pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* "All" pill */}
          <button
            onClick={() => setActiveSource('all')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={
              activeSource === 'all'
                ? { background: '#1E2F52', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                : { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }
            }
          >
            <TrendingUp className="w-3.5 h-3.5" />
            All Sources
            {sourceCounts.all !== null && (
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
                style={
                  activeSource === 'all'
                    ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                    : { background: '#374151', color: '#fff' }
                }
              >
                {sourceCounts.all}
              </span>
            )}
          </button>

          {/* Per-source pills */}
          {SOURCES.map(s => (
            <SourceTab
              key={s.id}
              source={s}
              active={activeSource === s.id}
              count={sourceCounts[s.id]}
              onClick={() => setActiveSource(s.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {activeSource === 'all' && (
          <div className="h-full overflow-y-auto">
            {loadingCounts && (
              <div className="mx-6 mt-6 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-medium text-gray-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            )}
            {countsError && !loadingCounts && (
              <div className="mx-6 mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {countsError}
              </div>
            )}
            <AllSourcesOverview
              sourceCounts={sourceCounts}
              onSelect={setActiveSource}
            />
          </div>
        )}

        {activeSource === 'capadex' && (
          <div className="flex flex-col h-full overflow-hidden">
            <CapadexReportsPanel />
          </div>
        )}

        {activeSource === 'lbi' && currentSource && (
          <EmptySourcePanel source={currentSource} />
        )}

        {activeSource === 'sdi' && currentSource && (
          <EmptySourcePanel source={currentSource} />
        )}

        {activeSource === 'competency' && currentSource && (
          <EmptySourcePanel source={currentSource} />
        )}
      </div>
    </div>
  );
}
