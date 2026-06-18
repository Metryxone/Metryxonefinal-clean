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

export default function LDETemporalPanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [userId, setUserId] = useState('');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['lde-temporal-master'], queryFn: () => fetchJson('/api/admin/lde/temporal/master') });
  const eventsQ = useQuery({ queryKey: ['lde-events-log'], queryFn: () => fetchJson('/api/admin/lde/events/log'), enabled: tab === 'events' });
  const featQ = useQuery({ queryKey: ['lde-feat-coverage'], queryFn: () => fetchJson('/api/admin/lde/features/coverage'), enabled: tab === 'features' });

  const ingestEvent = useMutation({
    mutationFn: () => fetch('/api/lde/events/ingest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, event_type: 'SIGNAL_CAPTURED', event_payload: { source: 'admin_trigger' } })
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lde-events-log'] }); qc.invalidateQueries({ queryKey: ['lde-temporal-master'] }); }
  });

  const replayEvents = useMutation({
    mutationFn: () => fetch('/api/lde/events/replay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    }).then(r => r.json()),
    onSuccess: (d) => alert(`Replayed ${d.replayed} events. Summary: ${JSON.stringify(d.feature_state?.summary)}`)
  });

  const upsertFeatures = useMutation({
    mutationFn: () => fetch('/api/lde/features/upsert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, behavioural_features: { score: 0.72 }, resilience_features: { score: 0.65 }, emotional_features: { score: 0.58 } })
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-feat-coverage'] })
  });

  const generateEmbeddings = useMutation({
    mutationFn: () => fetch('/api/lde/embeddings/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    }).then(r => r.json()),
    onSuccess: (d) => alert(`Generated ${d.generated} embeddings for ${userId}`)
  });

  const aggregateSignals = useMutation({
    mutationFn: () => fetch('/api/lde/signals/aggregate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, raw_signals: [{ strength: 0.7 }, { strength: 0.4 }, { strength: 0.9 }] })
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lde-temporal-master'] })
  });

  const updateTimeline = useMutation({
    mutationFn: () => fetch('/api/lde/timeline/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, behavioural_score: 68, emotional_score: 61, resilience_score: 72, employability_score: 65, leadership_score: 55 })
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lde-temporal-master'] }); alert('Timeline checkpoint recorded!'); }
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Master Dashboard' },
    { id: 'events', label: 'Event Sourcing' },
    { id: 'features', label: 'Feature Store' },
    { id: 'embeddings', label: 'Embeddings' },
    { id: 'signals', label: 'Signal Aggregation' },
    { id: 'timeline', label: 'Timeline Engine' }
  ];

  const master = masterQ.data;
  const num = (v: any, d = 0) => v != null ? parseFloat(v).toFixed(d) : '—';
  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>LDE — Temporal Intelligence</h2>
          <p className="text-sm text-gray-500">Longitudinal Development Engine · Data Lake, Event Sourcing, Feature Store, Embeddings, Timeline</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-48" />
          <Button onClick={() => ingestEvent.mutate()} disabled={!userId || ingestEvent.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {ingestEvent.isPending ? 'Ingesting…' : '+ Ingest Event'}
          </Button>
          <Button onClick={() => replayEvents.mutate()} disabled={!userId || replayEvents.isPending} size="sm" variant="outline">
            {replayEvents.isPending ? 'Replaying…' : '↺ Replay Events'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${tab === t.id ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            style={tab === t.id ? { background: NAV } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'master' && master && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Feature Store Users" value={master.feature_store?.total} sub={`${pct(master.feature_store?.avg_coverage)} avg coverage`} />
            <KpiCard label="Timeline Entries" value={master.timeline?.total} sub={`${master.timeline?.users} users`} />
            <KpiCard label="Avg Entropy" value={num(master.feature_store?.avg_entropy, 3)} color="#f97316" />
            <KpiCard label="Signal Anomalies (7d)" value={master.signal_aggregation?.total_anomalies} color="#dc2626" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Events by Type (Last 7d)</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(master.events_7d || []).map((r: any) => (
                  <div key={r.event_type} className="flex justify-between items-center py-1 border-b last:border-0">
                    <Pill val={r.event_type} map={EVT_COLORS} />
                    <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                  </div>
                ))}
                {(!master.events_7d?.length) && <p className="text-xs text-gray-400">No events yet — use Ingest Event above</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Timeline & Signal Health</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Timeline checkpoints</span><span className="font-bold text-sm" style={{ color: NAV }}>{master.timeline?.total || 0}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Latest checkpoint</span><span className="text-xs">{master.timeline?.latest_checkpoint || '—'}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-xs text-gray-600">Avg signal entropy</span><span className="text-xs">{num(master.signal_aggregation?.avg_entropy, 3)}</span></div>
                <div className="flex justify-between py-1"><span className="text-xs text-gray-600">Feature users</span><span className="text-xs">{master.feature_store?.total || 0}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          {eventsQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {eventsQ.data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Total Events" value={eventsQ.data.kpi?.total} />
                <KpiCard label="Unique Users" value={eventsQ.data.kpi?.unique_users} />
                <KpiCard label="Unprocessed" value={eventsQ.data.kpi?.unprocessed} color="#f97316" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(eventsQ.data.by_type || []).map((r: any) => (
                  <div key={r.event_type} className={`px-3 py-1.5 rounded-lg text-center ${EVT_COLORS[r.event_type] || 'bg-gray-100 text-gray-600'}`}>
                    <p className="text-lg font-bold">{r.cnt}</p>
                    <p className="text-xs truncate max-w-[110px]">{r.event_type}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Events</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Type</th><th>User</th><th>Source</th><th>Created</th></tr></thead>
                      <tbody>{(eventsQ.data.events || []).slice(0, 25).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1"><Pill val={r.event_type} map={EVT_COLORS} /></td>
                          <td className="truncate max-w-[100px]">{r.user_id}</td>
                          <td>{r.source}</td>
                          <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'features' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => upsertFeatures.mutate()} disabled={!userId || upsertFeatures.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {upsertFeatures.isPending ? 'Upserting…' : '↑ Upsert Feature Bundle'}
            </Button>
          </div>
          {featQ.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {featQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Users" value={featQ.data.kpi?.total_users} />
                <KpiCard label="Avg Coverage" value={pct(featQ.data.kpi?.avg_coverage)} color="#10b981" />
                <KpiCard label="Avg Entropy" value={num(featQ.data.kpi?.avg_entropy, 3)} color="#f97316" />
                <KpiCard label="Anomalies" value={featQ.data.kpi?.anomaly_count} color="#dc2626" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Recent Feature Bundles</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Coverage</th><th>Entropy</th><th>Version</th><th>Updated</th></tr></thead>
                    <tbody>{(featQ.data.recent || []).map((r: any) => (
                      <tr key={r.user_id} className="border-t">
                        <td className="py-1 truncate max-w-[120px]">{r.user_id}</td>
                        <td>{pct(r.coverage_pct)}</td>
                        <td>{num(r.entropy_score, 3)}</td>
                        <td style={{ color: NAV }}>v{r.feature_version}</td>
                        <td>{new Date(r.computed_at).toLocaleDateString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === 'embeddings' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => generateEmbeddings.mutate()} disabled={!userId || generateEmbeddings.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {generateEmbeddings.isPending ? 'Generating…' : '⚡ Generate Embeddings'}
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Enter a user email above and click Generate Embeddings. The engine will compute 6 embedding types (behavioural, emotional, resilience, developmental, cognitive, composite) using normalised CAPADEX scores.</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {['behavioural','emotional','resilience','developmental','cognitive','composite'].map(t => (
                  <div key={t} className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 capitalize">{t}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: NAV }}>32-dim vector</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'signals' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => aggregateSignals.mutate()} disabled={!userId || aggregateSignals.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {aggregateSignals.isPending ? 'Aggregating…' : '📡 Aggregate Signals'}
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Signal aggregation performs weak-signal amplification, entropy scoring, and anomaly detection across raw behavioural/emotional/cognitive signals.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3"><p className="text-xs text-gray-500">Amplification Factor</p><p className="font-bold" style={{ color: NAV }}>1.0× – 3.5×</p></div>
                <div className="border rounded-lg p-3"><p className="text-xs text-gray-500">Anomaly Threshold</p><p className="font-bold text-red-500">Strength &gt; 0.8</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => updateTimeline.mutate()} disabled={!userId || updateTimeline.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {updateTimeline.isPending ? 'Recording…' : '📅 Record Timeline Checkpoint'}
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 mb-4">Multi-dimension timeline captures behavioural, emotional, resilience, employability, and leadership scores at each checkpoint. Used for trajectory modelling and momentum computation.</p>
              <div className="grid grid-cols-3 gap-3">
                {['Behavioural','Emotional','Resilience','Employability','Leadership'].map(d => (
                  <div key={d} className="border rounded-lg p-3">
                    <p className="text-xs text-gray-500">{d}</p>
                    <p className="font-bold text-sm mt-1" style={{ color: NAV }}>0–100 scale</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
