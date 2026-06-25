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

export default function PAIEOpportunityPanel() {
  const [tab, setTab] = useState<Tab>('master');
  const [userId, setUserId] = useState('');
  const [cfScenario, setCfScenario] = useState('optimize_pacing');
  const [intType, setIntType] = useState('mentorship');
  const qc = useQueryClient();

  const masterQ = useQuery({ queryKey: ['paie-opp-master'], queryFn: () => fetchJson('/api/admin/paie/opportunity/master') });
  const oppQ = useQuery({ queryKey: ['paie-opp-dash'], queryFn: () => fetchJson('/api/admin/paie/opportunity/dashboard'), enabled: tab === 'opportunity' });
  const potQ = useQuery({ queryKey: ['paie-pot-dash'], queryFn: () => fetchJson('/api/admin/paie/potential/dashboard'), enabled: tab === 'potential' });
  const cfQ = useQuery({ queryKey: ['paie-cf'], queryFn: () => fetchJson('/api/admin/paie/counterfactuals'), enabled: tab === 'counterfactual' });
  const intQ = useQuery({ queryKey: ['paie-int'], queryFn: () => fetchJson('/api/admin/paie/interventions/predictions'), enabled: tab === 'intervention' });

  const computeOpp = useMutation({
    mutationFn: (endpoint: string) => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paie-opp-master'] }); alert('Computed!'); }
  });

  const runCF = useMutation({
    mutationFn: () => fetch('/api/paie/counterfactual/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, scenario_name: cfScenario }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-cf'] })
  });

  const predictInt = useMutation({
    mutationFn: () => fetch('/api/paie/intervention/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, intervention_type: intType }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-int'] })
  });

  const updateIntStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/admin/paie/interventions/predictions/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paie-int'] })
  });

  const tabs = [
    { id: 'master' as Tab, label: 'Master Dashboard' },
    { id: 'opportunity' as Tab, label: 'Opportunity Forecast' },
    { id: 'potential' as Tab, label: 'Human Potential' },
    { id: 'counterfactual' as Tab, label: 'Counterfactual' },
    { id: 'intervention' as Tab, label: 'Intervention Prediction' },
  ];

  const pct = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';
  const pct2 = (v: any) => v != null ? `${(parseFloat(v) * 100).toFixed(0)}%` : '—';

  const master = masterQ.data;

  return (
    <div className="space-y-4">
      <SimulatedDataBanner />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAV }}>PAIE — Opportunity Engine</h2>
          <p className="text-sm text-gray-500">Sections 6–7, 9–10 · Opportunity, Potential, Counterfactual, Intervention</p>
        </div>
        <div className="flex gap-2 items-center">
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="user@email.com" className="border rounded px-3 py-1.5 text-sm w-48" />
          <Button onClick={() => computeOpp.mutate('/api/paie/opportunity/compute')} disabled={!userId || computeOpp.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            Compute Opportunity
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

      {/* MASTER */}
      {tab === 'master' && master && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="High Potential Users" value={master.opportunities_by_tier?.find((r: any) => r.opportunity_tier === 'high')?.cnt || 0} color="#10b981" />
            <KpiCard label="Breakthrough Candidates" value={master.potential_by_phase?.find((r: any) => r.developmental_phase === 'advanced')?.cnt || 0} color="#a855f7" />
            <KpiCard label="Opp Detected (7d)" value={master.opportunities_7d} color={NAV} />
            <KpiCard label="Active Interventions" value={master.interventions_by_status?.find((r: any) => r.status === 'active')?.cnt || 0} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Opportunity Tiers</CardTitle></CardHeader>
              <CardContent>{(master.opportunities_by_tier || []).map((r: any) => (
                <div key={r.opportunity_tier} className="flex justify-between items-center py-1 border-b last:border-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_COLORS[r.opportunity_tier] || 'bg-gray-100 text-gray-600'}`}>{r.opportunity_tier}</span>
                  <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                </div>
              ))}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Developmental Phases</CardTitle></CardHeader>
              <CardContent>{(master.potential_by_phase || []).map((r: any) => (
                <div key={r.developmental_phase} className="flex justify-between items-center py-1 border-b last:border-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PHASE_COLORS[r.developmental_phase] || 'bg-gray-100'}`}>{r.developmental_phase}</span>
                  <span className="text-sm font-bold" style={{ color: NAV }}>{r.cnt}</span>
                </div>
              ))}</CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Counterfactual Scenarios</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Scenario</th><th>Count</th><th>Avg Score Delta</th><th>Avg Risk Delta</th></tr></thead>
                <tbody>{(master.top_scenarios || []).map((r: any) => <tr key={r.scenario_name} className="border-t"><td className="py-1">{r.scenario_name?.replace(/_/g,' ')}</td><td>{r.cnt}</td><td className={parseFloat(r.avg_delta) > 0 ? 'text-green-600' : 'text-red-600'}>{pct(r.avg_delta)}</td><td>{pct(r.avg_risk)}</td></tr>)}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* OPPORTUNITY */}
      {tab === 'opportunity' && (
        <div className="space-y-4">
          {oppQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {oppQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users" value={oppQ.data.kpi?.users} />
                <KpiCard label="Avg Leadership" value={pct(oppQ.data.kpi?.avg_leadership)} color={NAV} />
                <KpiCard label="Avg Employability" value={pct(oppQ.data.kpi?.avg_employability)} color="#10b981" />
                <KpiCard label="Avg Innovation" value={pct(oppQ.data.kpi?.avg_innovation)} color="#a855f7" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Top Opportunities</CardTitle></CardHeader>
                  <CardContent>{(oppQ.data.top_opportunities || []).map((r: any) => (
                    <div key={r.top_opportunity} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-xs text-gray-700">{r.top_opportunity?.replace(/_/g,' ')}</span>
                      <span className="font-bold text-sm" style={{ color: NAV }}>{r.cnt}</span>
                    </div>
                  ))}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">High Potential Users (Sample)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-40">
                      <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Leadership</th><th>Tier</th></tr></thead>
                        <tbody>{(oppQ.data.high_potential || []).slice(0, 10).map((r: any) => <tr key={r.id} className="border-t"><td className="py-1 truncate max-w-[100px]">{r.user_id}</td><td>{pct2(r.leadership_emergence_probability)}</td><td><span className={`px-1.5 py-0.5 rounded text-xs ${TIER_COLORS[r.opportunity_tier] || ''}`}>{r.opportunity_tier}</span></td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* POTENTIAL */}
      {tab === 'potential' && (
        <div className="space-y-4">
          {potQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {potQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Users" value={potQ.data.kpi?.users} />
                <KpiCard label="Hidden Capability" value={pct(potQ.data.kpi?.avg_hidden)} color={NAV} />
                <KpiCard label="Breakthrough Prob" value={pct(potQ.data.kpi?.avg_breakthrough)} color="#a855f7" />
                <KpiCard label="Breakthrough Count" value={potQ.data.kpi?.breakthrough_count} color="#10b981" />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Developmental Phases</CardTitle></CardHeader>
                <CardContent className="flex gap-6 flex-wrap">
                  {(potQ.data.phases || []).map((r: any) => (
                    <div key={r.developmental_phase} className="text-center">
                      <span className="text-3xl font-bold" style={{ color: NAV }}>{r.cnt}</span>
                      <p className={`mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PHASE_COLORS[r.developmental_phase] || 'bg-gray-100'}`}>{r.developmental_phase}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
          <Button onClick={() => computeOpp.mutate('/api/paie/potential/compute')} disabled={!userId || computeOpp.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
            Compute Potential for User
          </Button>
        </div>
      )}

      {/* COUNTERFACTUAL */}
      {tab === 'counterfactual' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <select value={cfScenario} onChange={e => setCfScenario(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              {['delay_intervention','optimize_pacing','add_mentorship','reduce_overload','custom'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <Button onClick={() => runCF.mutate()} disabled={!userId || runCF.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {runCF.isPending ? 'Simulating…' : '▶ Run Simulation'}
            </Button>
          </div>
          {cfQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {cfQ.data && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Simulation Results</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Scenario</th><th>Score Delta</th><th>Risk Delta</th><th>Confidence</th><th>Recommendation</th></tr></thead>
                      <tbody>{(cfQ.data.simulations || []).slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[80px]">{r.user_id}</td>
                          <td>{r.scenario_name?.replace(/_/g,' ')}</td>
                          <td className={parseFloat(r.delta_score) > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{pct(r.delta_score)}</td>
                          <td className={parseFloat(r.delta_risk) < 0 ? 'text-green-600' : 'text-red-600'}>{pct(r.delta_risk)}</td>
                          <td>{pct(r.confidence)}</td>
                          <td className="truncate max-w-[120px]">{r.recommendation}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Scenario Effectiveness Summary</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="text-left py-1">Scenario</th><th>Count</th><th>Avg Score Delta</th></tr></thead>
                    <tbody>{(cfQ.data.stats || []).map((r: any) => <tr key={r.scenario_name} className="border-t"><td className="py-1">{r.scenario_name?.replace(/_/g,' ')}</td><td>{r.cnt}</td><td className={parseFloat(r.avg_delta) > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{pct(r.avg_delta)}</td></tr>)}</tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* INTERVENTION */}
      {tab === 'intervention' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={intType} onChange={e => setIntType(e.target.value)} placeholder="intervention_type" className="border rounded px-2 py-1.5 text-sm w-40" />
            <Button onClick={() => predictInt.mutate()} disabled={!userId || predictInt.isPending} size="sm" style={{ background: NAV, color: '#fff' }}>
              {predictInt.isPending ? 'Predicting…' : '▶ Predict Intervention'}
            </Button>
          </div>
          {intQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {intQ.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Predictions" value={intQ.data.kpi?.total} />
                <KpiCard label="Avg Success" value={pct(intQ.data.kpi?.avg_success)} color="#10b981" />
                <KpiCard label="Avg Fatigue Risk" value={pct(intQ.data.kpi?.avg_fatigue)} color="#f97316" />
                <KpiCard label="Avg Resilience Gain" value={pct(intQ.data.kpi?.avg_resilience)} color={NAV} />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Intervention Predictions</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">User</th><th>Type</th><th>Success</th><th>Fatigue</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>{(intQ.data.predictions || []).slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="py-1 truncate max-w-[80px]">{r.user_id}</td>
                          <td>{r.intervention_type}</td>
                          <td className="text-green-600 font-semibold">{pct(r.success_probability)}</td>
                          <td className="text-orange-500">{pct(r.fatigue_risk)}</td>
                          <td><span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>{r.status}</span></td>
                          <td className="flex gap-1">
                            {r.status === 'pending' && <button onClick={() => updateIntStatus.mutate({ id: r.id, status: 'active' })} className="text-xs text-blue-600 hover:underline">Activate</button>}
                            {r.status === 'active' && <button onClick={() => updateIntStatus.mutate({ id: r.id, status: 'completed' })} className="text-xs text-green-600 hover:underline">Complete</button>}
                          </td>
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
    </div>
  );
}
