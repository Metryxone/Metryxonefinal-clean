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
import SimulatedDataBanner from './SimulatedDataBanner';


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

export default function PAIEForecastingPanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [computeUser, setComputeUser] = useState('');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['paie-forecast-master'], queryFn: () => fetchJson('/api/admin/paie/forecasting/master') });
  const sigQ = useQuery({ queryKey: ['paie-sig-dash'], queryFn: () => fetchJson('/api/admin/paie/signals/dashboard'), enabled: tab === 'signals' });
  const tempQ = useQuery({ queryKey: ['paie-temp-dash'], queryFn: () => fetchJson('/api/admin/paie/temporal/dashboard'), enabled: tab === 'temporal' });
  const behQ = useQuery({ queryKey: ['paie-beh-dash'], queryFn: () => fetchJson('/api/admin/paie/behavioural/dashboard'), enabled: tab === 'behavioural' });
  const cogQ = useQuery({ queryKey: ['paie-cog-dash'], queryFn: () => fetchJson('/api/admin/paie/cognitive/dashboard'), enabled: tab === 'cognitive' });
  const emoQ = useQuery({ queryKey: ['paie-emo-dash'], queryFn: () => fetchJson('/api/admin/paie/emotional/dashboard'), enabled: tab === 'emotional' });
  const trajQ = useQuery({ queryKey: ['paie-traj'], queryFn: () => fetchJson('/api/admin/paie/trajectories'), enabled: tab === 'trajectories' });
  const bsQ = useQuery({ queryKey: ['paie-bs'], queryFn: () => fetchJson('/api/admin/paie/black-swan/dashboard'), enabled: tab === 'blackswan' });
  const ewQ = useQuery({ queryKey: ['paie-ew'], queryFn: () => fetchJson('/api/admin/paie/early-warnings'), enabled: tab === 'warnings' });
  const trustQ = useQuery({ queryKey: ['paie-trust'], queryFn: () => fetchJson('/api/admin/paie/trust/dashboard'), enabled: tab === 'trust' });

  const computeAll = useMutation({
    mutationFn: () => fetch('/api/paie/compute-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: computeUser }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paie-forecast-master'] }); alert('All PAIE engines triggered!'); }
  });

  const resolveBS = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/paie/black-swan/${id}/resolve`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-bs'] })
  });

  const ackEW = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/paie/early-warnings/${id}/acknowledge`, { method: 'PATCH' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-ew'] })
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'master', label: 'Master Dashboard' },
    { id: 'signals', label: 'Signal Aggregation' },
    { id: 'temporal', label: 'Temporal Intelligence' },
    { id: 'behavioural', label: 'Behavioural Forecast' },
    { id: 'cognitive', label: 'Cognitive Forecast' },
    { id: 'emotional', label: 'Emotional Forecast' },
    { id: 'trajectories', label: 'Trajectory Engine' },
    { id: 'blackswan', label: 'Black Swan' },
    { id: 'warnings', label: 'Early Warnings' },
    { id: 'trust', label: 'Trust & Confidence' },
  ];

  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';
  const num = (v: any, d = 0) => v != null ? parseFloat(v).toFixed(d) : '—';

  const master = masterQ.data;

  return (
    <div className="space-y-4">
      <SimulatedDataBanner />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>PAIE — Forecasting Engine</h2>
          <p className="text-sm text-gray-500">Predictive AI Engine · Sections 1–5, 8, 11–13</p>
        </div>
        <div className="flex gap-2 items-center">
          <input value={computeUser} onChange={e => setComputeUser(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-48" />
          <Button onClick={() => computeAll.mutate()} disabled={!computeUser || computeAll.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            {computeAll.isPending ? 'Running…' : '▶ Compute All'}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap border-b pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors ${tab === t.id ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            style={tab === t.id ? { background: NAV } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* MASTER */}
      {tab === 'master' && master && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Signals" value={master.signals?.total} sub={`${master.signals?.anomalies} anomalies`} />
            <KpiCard label="Temporal Users" value={master.temporal?.users} />
            <KpiCard label="Avg Disengagement" value={pct(master.behavioural?.avg_dis)} color="#ef4444" />
            <KpiCard label="Avg Burnout" value={pct(master.emotional?.avg_burnout)} color="#f97316" />
            <KpiCard label="Avg Overload" value={pct(master.cognitive?.avg_overload)} color="#a855f7" />
            <KpiCard label="Black Swan Events" value={master.black_swan?.total} sub={`${master.black_swan?.critical} critical`} color="#dc2626" />
            <KpiCard label="Early Warnings" value={master.early_warnings?.total} sub={`${master.early_warnings?.critical} critical`} color="#f59e0b" />
            <KpiCard label="Avg Trust Score" value={pct(master.trust?.avg_trust)} sub={`${master.trust?.degraded} degraded`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Trajectory Distribution</CardTitle></CardHeader>
              <CardContent>
                {(master.trajectories || []).map((r: any) => (
                  <div key={r.trend_direction} className="flex justify-between items-center py-1 border-b last:border-0">
                    <Pill val={r.trend_direction} map={TREND_COLORS} />
                    <span className="text-sm font-semibold">{r.cnt}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Events (Last 24h)</CardTitle></CardHeader>
              <CardContent>
                {(master.events_24h || []).map((r: any) => (
                  <div key={r.event_type} className="flex justify-between items-center py-1 border-b last:border-0">
                    <span className="text-xs text-gray-600">{r.event_type}</span>
                    <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SIGNALS */}
      {tab === 'signals' && (
        <div className="space-y-4">
          {sigQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {sigQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Signals" value={sigQ.data.kpi?.total} />
                <KpiCard label="Avg Confidence" value={pct(sigQ.data.kpi?.avg_confidence)} />
                <KpiCard label="Anomalies" value={sigQ.data.kpi?.anomaly_count} color="#ef4444" />
                <KpiCard label="Avg Entropy" value={num(sigQ.data.kpi?.avg_entropy, 3)} color="#a855f7" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Signal Type Distribution</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(sigQ.data.signal_types || []).map((r: any) => (
                      <div key={r.signal_type} className="flex justify-between items-center border-b pb-1 last:border-0">
                        <span className="text-xs text-gray-700">{r.signal_type}</span>
                        <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Recent Anomalies</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-48">
                      <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left pb-1">User</th><th className="text-left pb-1">Type</th><th className="text-left pb-1">Entropy</th></tr></thead>
                        <tbody>{(sigQ.data.anomalies || []).map((r: any) => <tr key={r.id} className="border-t"><td className="py-1 truncate max-w-[100px]">{r.user_id}</td><td>{r.signal_type}</td><td>{num(r.entropy_score, 3)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* TEMPORAL */}
      {tab === 'temporal' && (
        <div className="space-y-4">
          {tempQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {tempQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users Forecasted" value={tempQ.data.kpi?.users} />
                <KpiCard label="Avg Confidence" value={pct(tempQ.data.kpi?.avg_confidence)} />
                <KpiCard label="Avg Volatility" value={pct(tempQ.data.kpi?.avg_volatility)} color="#f97316" />
                <KpiCard label="Silent Risk" value={pct(tempQ.data.kpi?.avg_silent_risk)} color="#dc2626" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Dimensions</CardTitle></CardHeader>
                  <CardContent>{(tempQ.data.dimensions || []).map((r: any) => (
                    <div key={r.dimension} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700 capitalize">{r.dimension}</span>
                      <span className="text-xs">{pct(r.avg_value)} · vol {pct(r.avg_vol)}</span>
                    </div>
                  ))}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Trend Directions</CardTitle></CardHeader>
                  <CardContent>{(tempQ.data.trends || []).map((r: any) => (
                    <div key={r.trend_direction} className="flex justify-between items-center py-1 border-b last:border-0">
                      <Pill val={r.trend_direction} map={TREND_COLORS} />
                      <span className="text-sm font-bold">{r.cnt}</span>
                    </div>
                  ))}</CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* BEHAVIOURAL */}
      {tab === 'behavioural' && (
        <div className="space-y-4">
          {behQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {behQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users" value={behQ.data.kpi?.users} />
                <KpiCard label="Avg Disengagement" value={pct(behQ.data.kpi?.avg_disengagement)} color="#ef4444" />
                <KpiCard label="Avg Volatility" value={pct(behQ.data.kpi?.avg_volatility)} color="#f97316" />
                <KpiCard label="High Risk Count" value={behQ.data.kpi?.high_risk_count} color="#dc2626" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Biomarkers (Average)</CardTitle></CardHeader>
                  <CardContent>{behQ.data.biomarkers && Object.entries(behQ.data.biomarkers).map(([k, v]: [string, any]) => (
                    <div key={k} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700 capitalize">{k.replace('_', ' ')}</span>
                      <span className="text-xs font-bold">{pct(v)}</span>
                    </div>
                  ))}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Dominant Risks</CardTitle></CardHeader>
                  <CardContent>{(behQ.data.dominant_risks || []).map((r: any) => (
                    <div key={r.dominant_risk} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700">{r.dominant_risk || 'unknown'}</span>
                      <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                    </div>
                  ))}</CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* COGNITIVE */}
      {tab === 'cognitive' && (
        <div className="space-y-4">
          {cogQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {cogQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users" value={cogQ.data.kpi?.users} />
                <KpiCard label="Avg Overload" value={pct(cogQ.data.kpi?.avg_overload)} color="#a855f7" />
                <KpiCard label="Avg Fatigue" value={pct(cogQ.data.kpi?.avg_fatigue)} color="#f97316" />
                <KpiCard label="Avg Recovery" value={pct(cogQ.data.kpi?.avg_recovery)} color="#10b981" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Cognitive Trajectories</CardTitle></CardHeader>
                <CardContent className="flex gap-4 flex-wrap">{(cogQ.data.trajectories || []).map((r: any) => (
                  <div key={r.cognitive_trajectory} className="flex flex-col items-center">
                    <span className="text-2xl font-bold" style={{ color: NAV }}>{r.cnt}</span>
                    <span className="text-xs text-gray-500 capitalize">{r.cognitive_trajectory?.replace(/_/g,' ')}</span>
                  </div>
                ))}</CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* EMOTIONAL */}
      {tab === 'emotional' && (
        <div className="space-y-4">
          {emoQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {emoQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users" value={emoQ.data.kpi?.users} />
                <KpiCard label="Avg Burnout" value={pct(emoQ.data.kpi?.avg_burnout)} color="#ef4444" />
                <KpiCard label="Avg Resilience" value={pct(emoQ.data.kpi?.avg_resilience)} color="#10b981" />
                <KpiCard label="Escalation Flags" value={emoQ.data.kpi?.escalation_flags} color="#dc2626" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Emotional Trajectories</CardTitle></CardHeader>
                <CardContent className="flex gap-6 flex-wrap">{(emoQ.data.trajectories || []).map((r: any) => (
                  <div key={r.emotional_trajectory} className="text-center">
                    <span className="text-2xl font-bold" style={{ color: NAV }}>{r.cnt}</span>
                    <p className="text-xs text-gray-500 capitalize">{r.emotional_trajectory?.replace(/_/g,' ')}</p>
                  </div>
                ))}</CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TRAJECTORIES */}
      {tab === 'trajectories' && (
        <div className="space-y-4">
          {trajQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {trajQ.data && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Trajectory Stats</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left py-1">Type</th><th className="text-left">Direction</th><th className="text-left">Count</th><th className="text-left">Avg Magnitude</th><th className="text-left">Avg Collapse Risk</th></tr></thead>
                    <tbody>{(trajQ.data.stats || []).map((r: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 capitalize">{r.trajectory_type}</td>
                        <td><Pill val={r.trend_direction} map={TREND_COLORS} /></td>
                        <td className="font-bold" style={{ color: NAV }}>{r.cnt}</td>
                        <td>{pct(r.avg_mag)}</td>
                        <td>{pct(r.avg_collapse)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* BLACK SWAN */}
      {tab === 'blackswan' && (
        <div className="space-y-4">
          {bsQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {bsQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total Events" value={bsQ.data.kpi?.total} />
                <KpiCard label="Affected Users" value={bsQ.data.kpi?.affected_users} />
                <KpiCard label="Critical" value={bsQ.data.kpi?.critical} color="#dc2626" />
                <KpiCard label="High" value={bsQ.data.kpi?.high} color="#f97316" />
                <KpiCard label="Silent Collapses" value={bsQ.data.kpi?.silent_collapses} color="#a855f7" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Active Black Swan Events</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Type</th><th>Probability</th><th>Severity</th><th>Urgency</th><th>Action</th></tr></thead>
                      <tbody>{(bsQ.data.active_events || []).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[80px]">{r.user_id}</td>
                          <td className="truncate max-w-[100px]">{r.event_type?.replace(/_/g,' ')}</td>
                          <td>{pct(r.probability)}</td>
                          <td><Pill val={r.severity} map={SEV_COLORS} /></td>
                          <td><Pill val={r.intervention_urgency} map={URGENCY_COLORS} /></td>
                          <td><button onClick={() => resolveBS.mutate(r.id)} className="text-xs text-blue-600 hover:underline">Resolve</button></td>
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

      {/* EARLY WARNINGS */}
      {tab === 'warnings' && (
        <div className="space-y-4">
          {ewQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {ewQ.data && (
            <>
              <div className="flex gap-3 flex-wrap">
                {(ewQ.data.by_urgency || []).map((r: any) => (
                  <div key={r.urgency} className={`px-4 py-2 rounded-lg text-center ${URGENCY_COLORS[r.urgency] || 'bg-gray-100 text-gray-600'}`}>
                    <p className="text-2xl font-bold">{r.cnt}</p>
                    <p className="text-xs capitalize">{r.urgency}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Pending Warnings</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Type</th><th>Strength</th><th>Urgency</th><th>Recommendation</th><th>Action</th></tr></thead>
                      <tbody>{(ewQ.data.warnings || []).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[80px]">{r.user_id}</td>
                          <td>{r.warning_type?.replace(/_/g,' ')}</td>
                          <td>{pct(r.signal_strength)}</td>
                          <td><Pill val={r.urgency} map={URGENCY_COLORS} /></td>
                          <td className="truncate max-w-[120px]">{r.recommended_action}</td>
                          <td><button onClick={() => ackEW.mutate(r.id)} className="text-xs text-blue-600 hover:underline">Ack</button></td>
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

      {/* TRUST */}
      {tab === 'trust' && (
        <div className="space-y-4">
          {trustQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {trustQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users" value={trustQ.data.kpi?.users} />
                <KpiCard label="Avg Trust" value={pct(trustQ.data.kpi?.avg_trust)} color="#10b981" />
                <KpiCard label="Avg Uncertainty" value={pct(trustQ.data.kpi?.avg_uncertainty)} color="#f97316" />
                <KpiCard label="Degraded" value={trustQ.data.kpi?.degraded_count} color="#dc2626" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Confidence Trends</CardTitle></CardHeader>
                  <CardContent>{(trustQ.data.trends || []).map((r: any) => (
                    <div key={r.confidence_trend} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs capitalize">{r.confidence_trend}</span>
                      <span className="font-bold text-sm" style={{ color: NAV }}>{r.cnt}</span>
                    </div>
                  ))}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Degraded Users</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-40">
                      <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Trust</th><th>Uncertainty</th></tr></thead>
                        <tbody>{(trustQ.data.degraded_users || []).map((r: any) => <tr key={r.id} className="border-t"><td className="py-1 truncate max-w-[100px]">{r.user_id}</td><td>{pct(r.trust_score)}</td><td>{pct(r.uncertainty_level)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
