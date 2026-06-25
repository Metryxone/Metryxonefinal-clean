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

export default function CounterfactualSimulatorPanel() {
  const [email, setEmail] = useState('');
  const [levers, setLevers] = useState<Record<LeverKey, boolean>>({
    add_mentorship: false,
    reduce_overload: false,
    optimise_pacing: false,
    add_peer_support: false,
    delay_emotional_support: false,
  });
  const [result, setResult] = useState<SimResult | null>(null);
  const [simulatedEmail, setSimulatedEmail] = useState('');
  const [simulatedLevers, setSimulatedLevers] = useState<Record<LeverKey, boolean>>({
    add_mentorship: false,
    reduce_overload: false,
    optimise_pacing: false,
    add_peer_support: false,
    delay_emotional_support: false,
  });
  const [error, setError] = useState('');
  const initialScenarios = React.useRef(loadFromSession()).current;
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => initialScenarios);
  const [showComparison, setShowComparison] = useState(() => initialScenarios.length > 0);

  const [justSaved, setJustSaved] = useState(false);
  const [showCreateIntervention, setShowCreateIntervention] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingName, setPendingName] = useState('');

  useEffect(() => {
    saveToSession(savedScenarios);
  }, [savedScenarios]);

  const mutation = useMutation({
    mutationFn: async () => {
      const frozenEmail = email.trim();
      const frozenLevers = { ...levers };
      const res = await fetch('/api/rie/counterfactual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: frozenEmail, levers: frozenLevers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const data = await res.json() as SimResult;
      return { data, frozenEmail, frozenLevers };
    },
    onSuccess: ({ data, frozenEmail, frozenLevers }) => {
      setResult(data);
      setSimulatedEmail(frozenEmail);
      setSimulatedLevers(frozenLevers);
      setError('');
      setJustSaved(false);
    },
    onError: (err: Error) => {
      setError(err.message);
      setResult(null);
    },
  });

  const toggleLever = (key: LeverKey) => setLevers(prev => ({ ...prev, [key]: !prev[key] }));
  const anyLeverOn = Object.values(levers).some(Boolean);

  const canSave = result !== null && savedScenarios.length < 3 && !justSaved;
  const alreadySaved3 = savedScenarios.length >= 3;

  function promptSaveScenario() {
    if (!result || savedScenarios.length >= 3) return;
    setPendingName('');
    setPendingSave(true);
  }

  function confirmSaveScenario() {
    if (!result || savedScenarios.length >= 3) return;
    const customLabel = pendingName.trim();
    const newScenario: SavedScenario = {
      id: `${Date.now()}-${Math.random()}`,
      label: customLabel || nextUnusedScenarioLabel(savedScenarios),
      email: simulatedEmail,
      levers: { ...simulatedLevers },
      result,
      savedAt: new Date().toISOString(),
    };
    setSavedScenarios(prev => [...prev, newScenario]);
    setJustSaved(true);
    setPendingSave(false);
    setPendingName('');
    if (savedScenarios.length === 0) setShowComparison(true);
  }

  function cancelSaveScenario() {
    setPendingSave(false);
    setPendingName('');
  }

  function removeScenario(id: string) {
    setSavedScenarios(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) setShowComparison(false);
      setJustSaved(false);
      return filtered;
    });
  }

  const deltaMetrics: DeltaMetric[] = result
    ? [
        {
          key: 'dropout_risk',
          label: 'Dropout Risk',
          baseline: Math.round(result.baseline.context.dropout_risk ?? 0),
          projected: Math.round(result.projected.context.dropout_risk ?? 0),
          delta: Math.round(result.delta.dropout_risk),
          lowerIsBetter: true,
        },
        {
          key: 'burnout_probability',
          label: 'Burnout Probability',
          baseline: Math.round(result.baseline.context.burnout_probability ?? 0),
          projected: Math.round(result.projected.context.burnout_probability ?? 0),
          delta: Math.round(result.delta.burnout_probability),
          lowerIsBetter: true,
        },
        {
          key: 'engagement_score',
          label: 'Engagement Score',
          baseline: Math.round(result.baseline.context.engagement_score ?? 0),
          projected: Math.round(result.projected.context.engagement_score ?? 0),
          delta: Math.round(result.delta.engagement_score),
          lowerIsBetter: false,
        },
        {
          key: 'leadership_emergence',
          label: 'Leadership Emergence',
          baseline: Math.round(result.baseline.context.leadership_emergence ?? 0),
          projected: Math.round(result.projected.context.leadership_emergence ?? 0),
          delta: Math.round(result.delta.leadership_emergence),
          lowerIsBetter: false,
        },
        {
          key: 'emotional_load',
          label: 'Emotional Load',
          baseline: Math.round(result.baseline.context.emotional_load ?? 0),
          projected: Math.round(result.projected.context.emotional_load ?? 0),
          delta: Math.round(result.delta.emotional_load),
          lowerIsBetter: true,
        },
        {
          key: 'cognitive_load',
          label: 'Cognitive Load',
          baseline: Math.round(result.baseline.context.cognitive_load ?? 0),
          projected: Math.round(result.projected.context.cognitive_load ?? 0),
          delta: Math.round(result.delta.cognitive_load),
          lowerIsBetter: true,
        },
      ]
    : [];

  const baselineRecs = result?.baseline.recommendations.slice(0, 3) ?? [];
  const projectedRecs = result?.projected.recommendations.slice(0, 3) ?? [];
  const crisisChange = result?.delta.crisis_risk_change;
  const momentum = result?.projected.recovery_momentum;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND }}>
          <FlaskConical className="h-6 w-6" />
          Counterfactual Simulator
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Model what-if intervention outcomes for any user — no data is written. Save up to 3 scenarios and compare side-by-side.
        </p>
      </div>

      {savedScenarios.length > 0 && (
        <button
          onClick={() => setShowComparison(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border-2 transition-all w-full"
          style={{ borderColor: BRAND, color: BRAND, backgroundColor: `${BRAND}08` }}
        >
          <Layers className="h-4 w-4" />
          {showComparison ? 'Hide' : 'Show'} Scenario Comparison
          <Badge className="ml-1 text-[10px]" style={{ backgroundColor: BRAND, color: '#fff' }}>
            {savedScenarios.length} saved
          </Badge>
          {showComparison
            ? <ChevronUp className="h-4 w-4 ml-auto" />
            : <ChevronDown className="h-4 w-4 ml-auto" />
          }
        </button>
      )}

      {showComparison && savedScenarios.length > 0 && (
        <ComparisonTable scenarios={savedScenarios} onRemove={removeScenario} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" style={{ color: BRAND }} />
                User Lookup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="user@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && email.trim() && anyLeverOn) mutation.mutate(); }}
              />
              {error && (
                <p className="text-xs text-red-500 bg-red-50 px-2 py-1.5 rounded">{error}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ToggleRight className="h-4 w-4" style={{ color: BRAND }} />
                Intervention Levers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {LEVERS.map(lever => {
                const active = levers[lever.key];
                const Icon = lever.icon;
                return (
                  <button
                    key={lever.key}
                    onClick={() => toggleLever(lever.key)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      active
                        ? 'border-opacity-100 shadow-sm'
                        : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                    }`}
                    style={active ? { borderColor: lever.color, backgroundColor: `${lever.color}0d` } : {}}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: active ? `${lever.color}22` : '#F3F4F6' }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: active ? lever.color : '#9CA3AF' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{lever.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight mt-0.5 line-clamp-2">{lever.description}</p>
                      </div>
                      <div className="shrink-0">
                        {active
                          ? <ToggleRight className="h-5 w-5" style={{ color: lever.color }} />
                          : <ToggleLeft className="h-5 w-5 text-gray-300" />
                        }
                      </div>
                    </div>
                    {!lever.positive && (
                      <p className="text-[10px] text-red-400 mt-1.5 ml-9">Warning lever — negative impact expected</p>
                    )}
                  </button>
                );
              })}

              <Button
                className="w-full mt-2"
                style={{ backgroundColor: BRAND }}
                disabled={!email.trim() || !anyLeverOn || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Simulating…</>
                  : <><FlaskConical className="h-4 w-4 mr-2" /> Run Simulation</>
                }
              </Button>
              {!anyLeverOn && (
                <p className="text-[10px] text-center text-gray-400">Toggle at least one lever to run</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && !mutation.isPending && (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-200 rounded-2xl">
              <FlaskConical className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-400">No simulation run yet</p>
              <p className="text-xs text-gray-300 mt-1">Enter a user email, toggle levers, and click Run Simulation</p>
            </div>
          )}

          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 mb-3" style={{ borderColor: BRAND }} />
              <p className="text-sm text-gray-400">Running counterfactual projection…</p>
            </div>
          )}

          {result && !mutation.isPending && (
            <>
              <Card className="border-l-4" style={{ borderLeftColor: BRAND }}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(result.levers_applied)
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <Badge key={k} className="text-[10px]" style={{ backgroundColor: `${BRAND}18`, color: BRAND, border: `1px solid ${BRAND}44` }}>
                          {k.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    {crisisChange === 'resolved' && (
                      <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">Crisis risk resolved</Badge>
                    )}
                    {crisisChange === 'emerged' && (
                      <Badge className="text-[10px] bg-red-50 text-red-700 border border-red-200">Crisis risk emerged</Badge>
                    )}
                    {momentum !== undefined && (
                      <Badge className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Recovery momentum: {momentum}%
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                    {pendingSave ? (
                      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                        <Input
                          autoFocus
                          value={pendingName}
                          onChange={e => setPendingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmSaveScenario();
                            if (e.key === 'Escape') cancelSaveScenario();
                          }}
                          placeholder={`Name (e.g. "Mentorship only") — leave blank for ${nextUnusedScenarioLabel(savedScenarios)}`}
                          className="h-8 text-xs w-64 max-w-full"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          style={{ backgroundColor: BRAND }}
                          onClick={confirmSaveScenario}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={cancelSaveScenario}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="flex items-center gap-1.5 text-xs h-8"
                        style={{ backgroundColor: canSave ? BRAND : undefined }}
                        variant={canSave ? 'default' : 'outline'}
                        disabled={!canSave}
                        onClick={promptSaveScenario}
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        {justSaved
                          ? 'Saved!'
                          : alreadySaved3
                          ? 'Max 3 saved'
                          : `Save as ${nextUnusedScenarioLabel(savedScenarios)}`}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex items-center gap-1.5 text-xs h-8"
                      style={{ backgroundColor: '#059669' }}
                      onClick={() => setShowCreateIntervention(true)}
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Create Intervention
                    </Button>
                    {savedScenarios.length > 0 && (
                      <button
                        onClick={() => setShowComparison(v => !v)}
                        className="text-xs font-medium underline underline-offset-2"
                        style={{ color: BRAND }}
                      >
                        {showComparison ? 'Hide comparison' : 'View comparison table'}
                      </button>
                    )}
                    {savedScenarios.length === 0 && (
                      <p className="text-[11px] text-gray-400">Save up to 3 scenarios to compare side-by-side</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: BRAND }} />
                    Baseline vs Projected — Key Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {deltaMetrics.map(m => (
                      <DeltaBar key={m.key} metric={m} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-gray-500 uppercase tracking-widest">
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                      Baseline Top Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {baselineRecs.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-3">No recommendations</p>
                      : baselineRecs.map((r, i) => <RecRow key={i} rec={r} />)
                    }
                  </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-emerald-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5 text-emerald-600 uppercase tracking-widest">
                      <Sparkles className="h-3.5 w-3.5" />
                      Projected Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {projectedRecs.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-3">No recommendations</p>
                      : projectedRecs.map((r, i) => <RecRow key={i} rec={r} />)
                    }
                    {result.delta.recommendation_count_change !== 0 && (
                      <p className="text-[10px] text-center text-emerald-600 pt-1">
                        {result.delta.recommendation_count_change > 0 ? '+' : ''}
                        {result.delta.recommendation_count_change} recommendation{Math.abs(result.delta.recommendation_count_change) !== 1 ? 's' : ''} change
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreateIntervention && result && (
        <CreateInterventionFromSimModal
          simulatedEmail={simulatedEmail}
          leversApplied={result.levers_applied}
          summary={result.summary}
          onClose={() => setShowCreateIntervention(false)}
        />
      )}
    </div>
  );
}
