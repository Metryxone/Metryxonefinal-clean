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


const METRYX_NAVY = '#344E86';
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

function SignalsTabStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8 h-full flex items-center justify-center">
      <div className="max-w-md text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: METRYX_NAVY + '15' }}>
          <Activity className="w-6 h-6" style={{ color: METRYX_NAVY }} />
        </div>
        <h3 className="text-[15px] font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-[13px] text-gray-500">{description}</p>
      </div>
    </div>
  );
}
function SessionSignalsTab() {
  return <SignalsTabStub title="Session Signals" description="Live BIOS session capture surfaces will land here. Signal endpoints are active under /api/signals/* and /api/admin/signals/*." />;
}
function BehaviouralProfilesTab() {
  return <SignalsTabStub title="Behavioural Profiles" description="Aggregated linguistic + behavioural profiles per user. Use /api/admin/signals/profiles to inspect data while the UI is being rebuilt." />;
}

export default function SignalIntelligencePanel() {
  const [subTab, setSubTab] = useState<'session' | 'behavioural'>('session');

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="px-6 pt-6 pb-0 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: METRYX_NAVY }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[17px] font-black" style={{ color: METRYX_NAVY }}>Signal Intelligence</h2>
            <p className="text-[12px] text-gray-400">Unified behavioural signal capture · canonical 14-type taxonomy</p>
          </div>
        </div>
        <div className="flex gap-0">
          {([
            { key: 'session',     label: 'Session Signals' },
            { key: 'behavioural', label: 'Behavioural Profiles' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className={`px-5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                subTab === t.key
                  ? 'border-b-[#344E86] text-[#344E86]'
                  : 'border-b-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {subTab === 'session'     && <SessionSignalsTab />}
        {subTab === 'behavioural' && <BehaviouralProfilesTab />}
      </div>
    </div>
  );
}
