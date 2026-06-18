import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain, ChevronLeft, User, CheckCircle, Clock, Shield, Lightbulb,
  Target, Heart, Users, MessageSquare, Flame, AlertTriangle, Lock,
  FileText, Award, TrendingUp, Activity, Zap, BarChart3, Calendar,
  ArrowRight, Info, Sparkles, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SideMenu } from "./SideMenu";
import { LbiTestModule } from "./LbiTestModule";
import { LbiAssessmentPlayer } from "./LbiAssessmentPlayer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Brand ────────────────────────────────────────────────────────────────────
const B = { blue: '#0B3C5D', green: '#4ECDC4' };

// ── Types ────────────────────────────────────────────────────────────────────
interface Child { id: string; name: string; age: number; grade: string; lbiConsent: boolean }
interface SessionResult {
  id: string; moduleName: string; moduleCode: string; rawScore: number;
  percentileScore: number; totalQuestions: number; questionsAnswered: number; completedAt: string;
}
interface LbiModule {
  id: string; moduleCode: string; moduleName: string; description?: string;
  subModules: { id: string; subModuleCode: string; subModuleName: string; questionType: string }[];
  lastScore: number | null; lastCompletedAt: string | null;
}
interface LbiSession {
  id: string; moduleId: string; moduleCode: string; moduleName: string; status: string;
  totalQuestions: number; questionsAnswered: number; rawScore?: number; maxScore?: number;
  percentileScore?: number; startedAt: string; completedAt?: string;
}
interface LbiProps {
  onNavigate: (s: Screen) => void;
  initialChildId?: string | null;
  onChildChange?: (childId: string) => void;
  initialLbiTab?: 'assessments' | 'insights' | 'reports';
}

// ── Module meta ───────────────────────────────────────────────────────────────
const MODULE_ICONS: Record<string, any> = {
  ACE: Lightbulb, ANT: Target, SEI: Heart, ADJ: Users,
  DIS: Clock, COM: MessageSquare, DRI: Flame, STP: AlertTriangle,
};
const MODULE_COLORS: Record<string, string> = {
  ACE: '#0B3C5D', ANT: '#0B3C5D', SEI: '#1D8055', ADJ: '#4ECDC4',
  DIS: '#1B6B9A', COM: '#0B3C5D', DRI: '#0B3C5D', STP: '#0B3C5D',
};

const getGrade = (p: number) => {
  if (p >= 90) return { label: 'A+', color: B.green };
  if (p >= 80) return { label: 'A',  color: B.green };
  if (p >= 70) return { label: 'B+', color: B.blue };
  if (p >= 60) return { label: 'B',  color: B.blue };
  if (p >= 50) return { label: 'C',  color: '#0B3C5D' };
  return               { label: 'D',  color: '#0B3C5D' };
};

// ── Shared card shell ─────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${className}`} style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function ParentLbiScreen({ onNavigate, initialChildId, onChildChange, initialLbiTab = 'assessments' }: LbiProps) {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(initialChildId || null);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [viewingResults, setViewingResults] = useState<SessionResult | null>(null);
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [pendingSessionStart, setPendingSessionStart] = useState<{ moduleId: string } | null>(null);
  const [activeLbiTab, setActiveLbiTab] = useState<'assessments' | 'insights' | 'reports'>(initialLbiTab);
  const [lbiModules, setLbiModules] = useState<LbiModule[]>([]);
  const [lbiSessions, setLbiSessions] = useState<LbiSession[]>([]);
  const [parentName, setParentName] = useState<string | undefined>(undefined);
  const [parentEmail, setParentEmail] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/user', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) { setParentName(u.fullName || u.full_name || u.name); setParentEmail(u.email); } })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchChildren(); }, []);
  useEffect(() => { if (selectedChildId) fetchLbiData(selectedChildId); }, [selectedChildId]);

  const fetchLbiData = async (childId: string) => {
    try {
      const [modRes, sesRes] = await Promise.all([
        fetch(`/api/lbi/modules?childId=${childId}`, { credentials: 'include' }),
        fetch(`/api/lbi/sessions?childId=${childId}`, { credentials: 'include' }),
      ]);
      if (modRes.ok) setLbiModules(await modRes.json());
      if (sesRes.ok) setLbiSessions(await sesRes.json());
    } catch {}
  };

  const fetchChildren = async () => {
    try {
      const res = await fetch('/api/children', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setChildren(data);
        if (data.length > 0 && !selectedChildId) {
          const valid = initialChildId && data.find((c: Child) => c.id === initialChildId);
          const childToSelect = valid ? initialChildId : data[0].id;
          setSelectedChildId(childToSelect);
          if (onChildChange) onChildChange(childToSelect);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load children', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  const handleStartAssessment = (sessionId: string) => setActiveSession(sessionId);
  const handleRequestStart = (moduleId: string) => { setPendingSessionStart({ moduleId }); setShowReadyConfirm(true); };

  const handleConfirmReady = async () => {
    if (!pendingSessionStart || !selectedChildId) return;
    setShowReadyConfirm(false);
    try {
      const response = await fetch('/api/lbi/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ moduleId: pendingSessionStart.moduleId, childId: selectedChildId }),
      });
      if (response.ok) {
        const session = await response.json();
        toast({ title: 'Assessment Started', description: 'Good luck!' });
        setActiveSession(session.id);
      } else {
        const err = await response.json();
        toast({ title: 'Error', description: err.message || 'Failed to start', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Failed to start', variant: 'destructive' }); }
    finally { setPendingSessionStart(null); }
  };

  const handleAssessmentComplete = () => {
    setActiveSession(null);
    toast({ title: 'Completed', description: 'Results saved.' });
    if (selectedChildId) fetchLbiData(selectedChildId);
  };

  const handleLogout = async () => {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch {}
    localStorage.removeItem('metryx_token');
    localStorage.removeItem('metryx_user');
    localStorage.removeItem('metryx_dashboard');
    window.dispatchEvent(new CustomEvent('metryx:logout'));
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const completedSessions = lbiSessions.filter(s => s.status === 'Completed');
  const inProgressSessions = lbiSessions.filter(s => s.status === 'In Progress');
  const completedModuleIds = new Set(completedSessions.map(s => s.moduleId));
  const inProgressModuleIds = new Set(inProgressSessions.map(s => s.moduleId));
  const completedCount = completedModuleIds.size;
  const totalModules = lbiModules.length || 8;
  const overallProgress = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((s, x) => s + (x.percentileScore || 0), 0) / completedSessions.length) : 0;
  const profilePct = children.length > 0
    ? Math.round((children.filter(c => c.lbiConsent).length / children.length) * 100)
    : 0;

  const kpiModules = lbiModules.length > 0
    ? lbiModules.map(m => ({
        icon: MODULE_ICONS[m.moduleCode] || Brain, label: m.moduleName,
        color: MODULE_COLORS[m.moduleCode] || '#64748b', moduleId: m.id,
        xp: 50,
        subCount: m.subModules.length,
        isCompleted: completedModuleIds.has(m.id),
        isInProgress: inProgressModuleIds.has(m.id),
        score: completedSessions.find(s => s.moduleId === m.id)?.percentileScore ?? null,
      }))
    : [
        { icon: Lightbulb, label: 'Academic & Cognitive', color: '#0B3C5D', moduleId: '', xp: 50, subCount: 3, isCompleted: false, isInProgress: false, score: null },
        { icon: Target,    label: 'Analytical Thinking',  color: '#0B3C5D', moduleId: '', xp: 50, subCount: 4, isCompleted: false, isInProgress: false, score: null },
        { icon: Heart,     label: 'Social & Emotional',   color: '#4ECDC4', moduleId: '', xp: 50, subCount: 4, isCompleted: false, isInProgress: false, score: null },
        { icon: Users,     label: 'Adjustment',           color: '#4ECDC4', moduleId: '', xp: 50, subCount: 3, isCompleted: false, isInProgress: false, score: null },
        { icon: Clock,     label: 'Discipline',           color: '#1B6B9A', moduleId: '', xp: 50, subCount: 4, isCompleted: false, isInProgress: false, score: null },
        { icon: MessageSquare, label: 'Communication',   color: '#0B3C5D', moduleId: '', xp: 50, subCount: 3, isCompleted: false, isInProgress: false, score: null },
        { icon: Flame,     label: 'Drive & Integrity',    color: '#0B3C5D', moduleId: '', xp: 50, subCount: 4, isCompleted: false, isInProgress: false, score: null },
        { icon: AlertTriangle, label: 'Stress & Pressures', color: '#0B3C5D', moduleId: '', xp: 50, subCount: 3, isCompleted: false, isInProgress: false, score: null },
      ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-8 h-8 animate-pulse" style={{ color: B.green }} />
          <p className="text-sm text-gray-400">Loading LBI Assessment Hub…</p>
        </div>
      </div>
    );
  }

  // ── Full-screen assessment player ─────────────────────────────────────────
  if (activeSession) {
    return (
      <LbiAssessmentPlayer
        sessionId={activeSession}
        onComplete={handleAssessmentComplete}
        onExit={() => setActiveSession(null)}
        isDarkMode={false}
        onThemeToggle={() => {}}
      />
    );
  }

  // ── Results detail view ───────────────────────────────────────────────────
  if (viewingResults) {
    const g = getGrade(viewingResults.percentileScore);
    return (
      <div className="min-h-screen bg-gray-50 flex" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="hidden md:block h-screen sticky top-0">
          <SideMenu
            role="parent"
            activeItem="lbi"
            onMenuSelect={() => setViewingResults(null)}
            onLogout={handleLogout}
            userName={parentName}
            userEmail={parentEmail}
            childCount={children.length}
            progressPct={profilePct}
          />
        </div>
        <div className="flex-1 p-6 max-w-3xl mx-auto">
          <button
            onClick={() => setViewingResults(null)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-800 mb-6 transition-colors"
            data-testid="button-back-results"
          >
            <ChevronLeft size={14} /> Back to Assessments
          </button>
          <div className="bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
            <div className="h-1.5" style={{ background: `${B.blue}` }} />
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${g.color}15` }}>
                  <span className="text-2xl font-bold" style={{ color: g.color }}>{g.label}</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: B.blue }}>{viewingResults.moduleName}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${B.blue}10`, color: B.blue }}>{viewingResults.moduleCode}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Raw Score', value: viewingResults.rawScore, color: B.green },
                  { label: 'Percentile', value: `${viewingResults.percentileScore.toFixed(0)}%`, color: B.blue },
                  { label: 'Questions', value: `${viewingResults.questionsAnswered}/${viewingResults.totalQuestions}`, color: '#374151' },
                ].map((s, i) => (
                  <div key={i} className="text-center p-3 rounded-xl" style={{ background: 'rgba(11,60,93,0.04)' }}>
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-5">
                <span className="flex items-center gap-1"><Calendar size={11} /> {viewingResults.completedAt ? new Date(viewingResults.completedAt).toLocaleDateString('en-IN') : 'N/A'}</span>
                <span className="flex items-center gap-1"><User size={11} /> {selectedChild?.name}</span>
              </div>
              <button onClick={() => setViewingResults(null)} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: B.green }} data-testid="button-done">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'assessments' as const, label: 'Assessments', icon: FileText },
    { id: 'insights'    as const, label: 'Insights',    icon: Lightbulb },
    { id: 'reports'     as const, label: 'Reports',     icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif', background: '#F7F9FC' }}>
      {/* Sidebar */}
      <div className="hidden md:block h-screen sticky top-0">
        <SideMenu
          role="parent"
          activeItem="lbi"
          onMenuSelect={(id) => { if (id === 'dashboard') onNavigate('unified-parent-dashboard'); }}
          onLogout={handleLogout}
          userName={parentName}
          userEmail={parentEmail}
          childCount={children.length}
          progressPct={profilePct}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="bg-white border-b sticky top-0 z-10 px-5 py-3" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('unified-parent-dashboard')}
                className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-800 transition-colors"
                data-testid="button-back"
              >
                <ChevronLeft size={15} /> Dashboard
              </button>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: `${B.blue}12` }}>
                  <Brain size={13} style={{ color: B.blue }} />
                </div>
                <span className="text-[13px] font-bold" style={{ color: B.blue }}>LBI Assessment Hub</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: `${B.green}12`, color: B.green }}>
                <Shield size={10} /> DPDP Compliant
              </span>
              {selectedChild && (
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: B.blue }}>
                    {selectedChild.name.charAt(0)}
                  </div>
                  {children.length > 1 && (
                    <Select value={selectedChildId || ''} onValueChange={(id) => { setSelectedChildId(id); if (onChildChange) onChildChange(id); }}>
                      <SelectTrigger className="h-7 text-[11px] w-32 border" style={{ borderColor: 'rgba(11,60,93,0.15)' }} data-testid="select-child">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {children.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Child identity bar ────────────────────────────────────────────── */}
        {selectedChild && (
          <div className="bg-white border-b px-5 py-2.5" style={{ borderColor: 'rgba(11,60,93,0.06)' }}>
            <div className="max-w-5xl mx-auto flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: `${B.blue}` }}>
                {selectedChild.name.charAt(0)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold" style={{ color: B.blue }}>{selectedChild.name}</span>
                {selectedChild.age < 18 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>Minor</span>
                )}
                {selectedChild.lbiConsent && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: `${B.green}12`, color: B.green }}>
                    <CheckCircle size={8} /> Consent
                  </span>
                )}
                <span className="text-[11px] text-gray-400">Age {selectedChild.age} · {selectedChild.grade}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div className="bg-white border-b px-5" style={{ borderColor: 'rgba(11,60,93,0.06)' }}>
          <div className="max-w-5xl mx-auto flex gap-1">
            {tabs.map(tab => {
              const active = activeLbiTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveLbiTab(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium border-b-2 transition-all"
                  style={{
                    borderColor: active ? B.blue : 'transparent',
                    color: active ? B.blue : '#94A3B8',
                    fontWeight: active ? 600 : 400,
                  }}
                  data-testid={`lbi-tab-${tab.id}`}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 px-5 py-5">
          <div className="max-w-5xl mx-auto">

            {/* ══ Assessments Tab ══════════════════════════════════════════ */}
            {activeLbiTab === 'assessments' && (
              children.length === 0 ? (
                <Card className="p-12 text-center">
                  <User className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-semibold mb-1" style={{ color: B.blue }}>No Children Added</p>
                  <p className="text-[11px] text-gray-400 mb-4">Add a child in your dashboard first</p>
                  <button onClick={() => onNavigate('unified-parent-dashboard')} className="px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ background: B.blue }}>
                    Go to Dashboard
                  </button>
                </Card>
              ) : (
                <div className="grid lg:grid-cols-3 gap-5">
                  {/* ── Left 2 cols: LBI modules ─────────────────────────── */}
                  <div className="lg:col-span-2 space-y-4">

                    {/* LBI banner */}
                    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: `#1A4F7A` }} data-testid="kpi-header">
                      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                          <Brain size={22} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold tracking-widest uppercase text-white/50">MetryxOne</p>
                          <p className="text-[15px] font-bold text-white leading-tight">Learning Behavior Index <span className="text-[10px] font-bold tracking-wider text-white/60 ml-1">LBI™</span></p>
                        </div>
                        <div className="ml-auto flex gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-white">{totalModules}</p>
                            <p className="text-[9px] text-white/50 uppercase tracking-wider">Modules</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold" style={{ color: B.green }}>{completedCount}</p>
                            <p className="text-[9px] text-white/50 uppercase tracking-wider">Done</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold" style={{ color: B.green }}>{avgScore > 0 ? `${avgScore}%` : '0%'}</p>
                            <p className="text-[9px] text-white/50 uppercase tracking-wider">Avg</p>
                          </div>
                        </div>
                      </div>

                      {/* Module grid */}
                      <div className="grid grid-cols-4 gap-2 px-5 pb-5">
                        {kpiModules.map((mod, i) => (
                          <div
                            key={i}
                            className={`relative rounded-xl p-2.5 transition-all ${mod.isCompleted ? 'bg-white/20 ring-1 ring-white/30' : mod.isInProgress ? 'bg-white/12 ring-1 ring-yellow-300/30' : 'bg-white/8 hover:bg-white/15'}`}
                            data-testid={`kpi-${i}`}
                          >
                            {mod.isCompleted && <CheckCircle size={9} className="absolute top-1.5 right-1.5" style={{ color: B.green }} />}
                            {mod.isInProgress && !mod.isCompleted && <Clock size={9} className="absolute top-1.5 right-1.5 text-yellow-300" />}
                            <mod.icon size={15} style={{ color: mod.color }} className="mb-1" />
                            <p className="text-[9px] font-semibold text-white/85 leading-tight">{mod.label}</p>
                            {mod.isCompleted && mod.score !== null
                              ? <p className="text-[9px] font-bold mt-0.5" style={{ color: '#86EFAC' }}>{mod.score.toFixed(0)}%</p>
                              : mod.isInProgress
                                ? <p className="text-[8px] text-yellow-300 mt-0.5">In Progress</p>
                                : <p className="text-[8px] text-white/35 mt-0.5">Not Started</p>}
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div className="px-5 pb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-white/60">Assessment Modules</span>
                          <span className="text-[10px] font-semibold text-white/80">{completedCount}/{totalModules} completed</span>
                          <span className="text-[10px] font-bold" style={{ color: overallProgress === 100 ? B.green : '#0B3C5D' }}>
                            {overallProgress}% done
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/15">
                          <div className="h-full rounded-full transition-all" style={{ width: `${overallProgress}%`, background: B.green }} />
                        </div>
                        {completedCount < totalModules && (
                          <p className="text-[9px] text-white/40 mt-1.5">Complete all {totalModules} modules to unlock your full behavioral intelligence profile</p>
                        )}
                      </div>
                    </div>

                    {/* LBI module list / consent gate */}
                    {selectedChild?.lbiConsent ? (
                      <LbiTestModule
                        role="parent"
                        childId={selectedChildId || undefined}
                        childName={selectedChild?.name}
                        hasConsent={selectedChild?.lbiConsent}
                        isDarkMode={false}
                        onStartAssessment={handleStartAssessment}
                        onRequestStart={handleRequestStart}
                        onViewResults={async (sessionId) => {
                          try {
                            const res = await fetch(`/api/lbi/sessions/${sessionId}/results`, { credentials: 'include' });
                            if (res.ok) {
                              const result = await res.json();
                              setViewingResults({
                                id: result.sessionId,
                                moduleName: result.moduleName || 'Assessment',
                                moduleCode: result.moduleCode || '',
                                rawScore: result.summary?.rawScore || 0,
                                percentileScore: result.summary?.percentileScore || 0,
                                totalQuestions: result.summary?.totalQuestions || 0,
                                questionsAnswered: result.summary?.totalQuestions || 0,
                                completedAt: result.completedAt || '',
                              });
                            }
                          } catch {}
                        }}
                      />
                    ) : (
                      <Card>
                        <div className="p-8 text-center">
                          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${B.blue}10` }}>
                            <Lock size={24} style={{ color: B.blue }} />
                          </div>
                          <h3 className="text-sm font-bold mb-1" style={{ color: B.blue }}>Parental Consent Required</h3>
                          <p className="text-[11px] text-gray-500 max-w-xs mx-auto mb-5">
                            Under DPDP Act 2023, parental consent is required for minors. Grant consent to enable behavioural assessments.
                          </p>
                          <button onClick={() => onNavigate('unified-parent-dashboard')} className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ background: B.green }} data-testid="button-consent">
                            <Shield size={13} /> Grant Consent
                          </button>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* ── Right col: stats & info ────────────────────────────── */}
                  <div className="space-y-4">
                    {/* Performance Overview */}
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Activity size={15} style={{ color: B.green }} />
                            <span className="text-[12px] font-bold" style={{ color: B.blue }}>Performance Overview</span>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${B.green}12`, color: B.green }}>Live</span>
                        </div>
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] mb-1.5">
                            <span className="text-gray-400">Overall Progress</span>
                            <span className="font-semibold" style={{ color: B.blue }}>{completedCount}/{totalModules} Modules</span>
                          </div>
                          <Progress value={overallProgress} className="h-2" />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(11,60,93,0.04)' }}>
                            <p className="text-xl font-bold" style={{ color: B.green }}>{avgScore > 0 ? `${avgScore}%` : '—'}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Avg Percentile</p>
                          </div>
                          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(11,60,93,0.04)' }}>
                            <p className="text-xl font-bold" style={{ color: B.blue }}>{avgScore > 0 ? getGrade(avgScore).label : '—'}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Overall Grade</p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Domain Breakdown (only if completed) */}
                    {completedSessions.length > 0 && (
                      <Card>
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={14} style={{ color: B.green }} />
                            <span className="text-[12px] font-bold" style={{ color: B.blue }}>Domain Breakdown</span>
                          </div>
                          <div className="space-y-2.5">
                            {kpiModules.filter(m => m.isCompleted && m.score !== null).map((mod, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <mod.icon size={11} style={{ color: mod.color }} />
                                    <span className="text-[10px] font-medium text-gray-700 truncate max-w-[110px]">{mod.label}</span>
                                  </div>
                                  <span className="text-[10px] font-bold" style={{ color: (mod.score ?? 0) >= 70 ? B.green : (mod.score ?? 0) >= 50 ? '#0B3C5D' : '#0B3C5D' }}>
                                    {mod.score?.toFixed(0)}%
                                  </span>
                                </div>
                                <Progress value={mod.score ?? 0} className="h-1.5" />
                              </div>
                            ))}
                            {kpiModules.filter(m => !m.isCompleted).length > 0 && (
                              <p className="text-[9px] text-gray-400 pt-1">{kpiModules.filter(m => !m.isCompleted).length} domains pending</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Recent Activity */}
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock size={14} style={{ color: B.blue }} />
                          <span className="text-[12px] font-bold" style={{ color: B.blue }}>Recent Activity</span>
                        </div>
                        {lbiSessions.length === 0 ? (
                          <div className="text-center py-4">
                            <Brain size={22} className="mx-auto mb-2 text-gray-200" />
                            <p className="text-[10px] text-gray-400">No assessments taken yet</p>
                            <p className="text-[9px] text-gray-300 mt-0.5">Start a domain to see activity here</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {lbiSessions.slice(0, 4).map(s => (
                              <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: 'rgba(11,60,93,0.03)' }}>
                                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: s.status === 'Completed' ? `${B.green}15` : 'rgba(11,60,93,0.1)' }}>
                                  {s.status === 'Completed'
                                    ? <CheckCircle size={13} style={{ color: B.green }} />
                                    : <Clock size={13} style={{ color: '#0B3C5D' }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-semibold text-gray-800 truncate">{s.moduleName}</p>
                                  <p className="text-[9px] text-gray-400">
                                    {s.status === 'Completed' && s.completedAt
                                      ? `Completed ${new Date(s.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                                      : `Started ${new Date(s.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                  </p>
                                </div>
                                {s.status === 'Completed' && s.percentileScore !== undefined && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${B.green}12`, color: B.green }}>
                                    {s.percentileScore.toFixed(0)}%
                                  </span>
                                )}
                                {s.status === 'In Progress' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: '#FEF3C7', color: '#92400E' }}>Active</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Insights */}
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles size={14} style={{ color: B.green }} />
                          <span className="text-[12px] font-bold" style={{ color: B.blue }}>Insights</span>
                        </div>
                        {completedSessions.length === 0 ? (
                          <div className="text-center py-3">
                            <Info size={18} className="mx-auto mb-2 text-gray-200" />
                            <p className="text-[10px] text-gray-400">Complete assessments to unlock insights</p>
                          </div>
                        ) : (() => {
                          const best = [...completedSessions].sort((a, b) => (b.percentileScore ?? 0) - (a.percentileScore ?? 0))[0];
                          const worst = [...completedSessions].sort((a, b) => (a.percentileScore ?? 0) - (b.percentileScore ?? 0))[0];
                          const remaining = totalModules - completedCount;
                          return (
                            <div className="space-y-2">
                              {best && (
                                <div className="p-2.5 rounded-xl" style={{ background: `${B.green}08`, border: `1px solid ${B.green}25` }}>
                                  <div className="flex items-start gap-2">
                                    <TrendingUp size={12} style={{ color: B.green }} className="mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-[10px] font-semibold text-gray-800">Strongest: {best.moduleName}</p>
                                      <p className="text-[9px] text-gray-500 mt-0.5">{best.percentileScore?.toFixed(0)}% percentile</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {worst && worst.id !== best?.id && (worst.percentileScore ?? 0) < 70 && (
                                <div className="p-2.5 rounded-xl" style={{ background: `${B.blue}06`, border: `1px solid ${B.blue}20` }}>
                                  <div className="flex items-start gap-2">
                                    <Target size={12} style={{ color: B.blue }} className="mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-[10px] font-semibold text-gray-800">Focus: {worst.moduleName}</p>
                                      <p className="text-[9px] text-gray-500 mt-0.5">{worst.percentileScore?.toFixed(0)}% — room to grow</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {remaining > 0 && (
                                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(11,60,93,0.04)', border: '1px solid rgba(11,60,93,0.15)' }}>
                                  <div className="flex items-start gap-2">
                                    <Zap size={12} style={{ color: '#0B3C5D' }} className="mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-[10px] font-semibold text-gray-800">{remaining} domain{remaining !== 1 ? 's' : ''} remaining</p>
                                      <p className="text-[9px] text-gray-500 mt-0.5">Complete all 8 for full LBI report</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </Card>

                    {/* Data Protection */}
                    <Card>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield size={14} style={{ color: B.green }} />
                          <span className="text-[12px] font-bold" style={{ color: B.blue }}>Data Protection</span>
                        </div>
                        <div className="space-y-1.5">
                          {[
                            { icon: Lock, label: '256-bit Encryption' },
                            { icon: FileText, label: 'DPDP Act 2023 Compliant' },
                            { icon: Shield, label: 'Data Stored in India' },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                              <item.icon size={12} style={{ color: B.green }} /> {item.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )
            )}

            {/* ══ Insights Tab ══════════════════════════════════════════════ */}
            {activeLbiTab === 'insights' && (
              <div className="space-y-4" data-testid="lbi-insights-view">
                <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: `#1A4F7A` }}>
                  <div className="px-6 py-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
                      <Lightbulb size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase text-white/50">AI Analysis</p>
                      <p className="text-[15px] font-bold text-white">Learning Behavior Insights</p>
                      <p className="text-[11px] text-white/60">AI-powered analysis of {selectedChild?.name}'s learning patterns</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { title: 'Cognitive Strengths', desc: 'Pattern recognition, memory retention, analytical thinking', icon: Brain, color: '#0B3C5D' },
                    { title: 'Learning Style', desc: 'Visual learner with strong verbal comprehension', icon: Target, color: B.green },
                    { title: 'Focus Patterns', desc: 'Peak productivity in morning hours, needs breaks every 45 mins', icon: Clock, color: '#0B3C5D' },
                    { title: 'Social Dynamics', desc: 'Works well in small groups, peer collaboration enhances learning', icon: Users, color: '#4ECDC4' },
                  ].map((item, i) => (
                    <Card key={i}>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${item.color}12` }}>
                            <item.icon size={14} style={{ color: item.color }} />
                          </div>
                          <span className="text-[12px] font-bold" style={{ color: B.blue }}>{item.title}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </Card>
                  ))}
                </div>

                <Card>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} style={{ color: B.green }} />
                        <span className="text-[13px] font-bold" style={{ color: B.blue }}>AI Recommendations</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: `${B.green}12`, color: B.green }}>MetryxAI</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2.5">
                      {[
                        'Schedule study sessions between 8–11 AM for optimal focus',
                        'Incorporate visual aids and diagrams in learning materials',
                        'Use 45-minute study blocks with 10-minute breaks',
                        'Encourage group study for collaborative subjects',
                      ].map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(11,60,93,0.03)' }}>
                          <CheckCircle size={11} style={{ color: B.green }} className="mt-0.5 shrink-0" />
                          <p className="text-[11px] text-gray-600">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ══ Reports Tab ════════════════════════════════════════════════ */}
            {activeLbiTab === 'reports' && (
              <div className="space-y-4" data-testid="lbi-reports-view">
                <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: `#1A4F7A` }}>
                  <div className="px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
                        <BarChart3 size={22} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase text-white/50">Comprehensive</p>
                        <p className="text-[15px] font-bold text-white">LBI Assessment Reports</p>
                        <p className="text-[11px] text-white/60">Behavioral intelligence for {selectedChild?.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-5 text-center">
                      {[
                        { label: 'LBI Score', value: avgScore > 0 ? `${avgScore}%` : '—', color: B.green },
                        { label: 'Completed', value: completedCount, color: 'white' },
                        { label: 'Improvement', value: '+12%', color: '#86EFAC' },
                      ].map((s, i) => (
                        <div key={i}>
                          <p className="text-2xl font-bold" style={{ color: s.color as string }}>{s.value}</p>
                          <p className="text-[9px] text-white/50 uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Card>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText size={14} style={{ color: B.blue }} />
                      <span className="text-[13px] font-bold" style={{ color: B.blue }}>Available Reports</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { name: 'Monthly LBI Summary', date: 'Jan 2026' },
                        { name: 'Academic Correlation Report', date: 'Jan 2026' },
                        { name: 'Stress & Wellbeing Analysis', date: 'Dec 2025' },
                        { name: 'Social-Emotional Development', date: 'Q4 2025' },
                      ].map((report, i) => (
                        <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border transition-all hover:shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.08)', background: 'rgba(11,60,93,0.02)' }}>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${B.blue}10` }}>
                              <FileText size={14} style={{ color: B.blue }} />
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold" style={{ color: B.blue }}>{report.name}</p>
                              <p className="text-[10px] text-gray-400">{report.date}</p>
                            </div>
                          </div>
                          <button className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80" style={{ borderColor: `${B.green}40`, color: B.green }}>
                            View <ChevronRight size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Ready Confirm Dialog ─────────────────────────────────────────── */}
      <AlertDialog open={showReadyConfirm} onOpenChange={setShowReadyConfirm}>
        <AlertDialogContent style={{ fontFamily: 'Inter, sans-serif' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[15px]">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${B.blue}` }}>
                <Brain size={15} className="text-white" />
              </div>
              Ready to Start?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5 mt-3">
                <p className="text-[12px] font-semibold text-gray-700">Before {selectedChild?.name} begins:</p>
                <ul className="space-y-1.5 mt-2">
                  {['Quiet environment with no distractions', 'Enough time to complete — no rush', 'No right or wrong answers', 'Answer honestly — it helps the most'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px] text-gray-600">
                      <CheckCircle size={11} style={{ color: B.green }} className="shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="text-[12px] h-8 rounded-lg" data-testid="button-not-yet">Not Yet</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReady} className="text-[12px] h-8 rounded-lg text-white" style={{ backgroundColor: B.green }} data-testid="button-ready">
              I'm Ready →
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
