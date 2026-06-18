import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Brain, 
  Clock,
  CheckCircle, 
  TrendingUp,
  Target,
  Award,
  Lock,
  Download,
  Flame,
  BarChart2,
  Star,
  Activity,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  description?: string;
  subModules: SubModule[];
  isLocked?: boolean;
  lockedUntil?: string | null;
  lastScore?: number | null;
  lastCompletedAt?: string | null;
}

interface SubModule {
  id: string;
  subModuleCode: string;
  subModuleName: string;
  questionType: string;
}

interface Session {
  id: string;
  moduleId: string;
  moduleName?: string;
  moduleCode?: string;
  status: string;
  totalQuestions: number;
  questionsAnswered: number;
  rawScore?: number;
  maxScore?: number;
  percentileScore?: number;
  percentageScore?: number;
  startedAt?: string;
  completedAt?: string;
}

interface Props {
  role: 'parent' | 'student';
  childId?: string;
  childName?: string;
  hasConsent?: boolean;
  onStartAssessment?: (sessionId: string) => void;
  onViewResults?: (sessionId: string) => void;
  onRequestStart?: (moduleId: string) => void;
  isDarkMode?: boolean;
}

export function LbiTestModule({ role, childId, childName, hasConsent = true, onStartAssessment, onViewResults, onRequestStart, isDarkMode: propDarkMode }: Props) {
  const [modules, setModules] = useState<Module[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingModule, setStartingModule] = useState<string | null>(null);
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [pendingModuleId, setPendingModuleId] = useState<string | null>(null);
  const { toast } = useToast();

  const isDarkMode = propDarkMode !== undefined ? propDarkMode : false;
  const brandPrimary = '#0B3C5D';
  const brandAccent = '#4ECDC4';

  useEffect(() => {
    fetchData();
  }, [childId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const modulesUrl = childId ? `/api/lbi/modules?childId=${childId}` : '/api/lbi/modules';
      const sessionsUrl = childId ? `/api/lbi/sessions?childId=${childId}` : '/api/lbi/sessions';
      const [modulesRes, sessionsRes] = await Promise.all([
        fetch(modulesUrl, { credentials: 'include' }),
        fetch(sessionsUrl, { credentials: 'include' })
      ]);
      if (modulesRes.ok) setModules(await modulesRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch (error) {
      console.error('Error fetching lbi data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestStart = (moduleId: string) => {
    if (!hasConsent && role === 'parent') {
      toast({ title: "Consent Required", description: "Please grant consent first", variant: "destructive" });
      return;
    }
    setPendingModuleId(moduleId);
    setShowReadyConfirm(true);
  };

  const handleConfirmStart = () => {
    if (pendingModuleId) handleStartAssessment(pendingModuleId);
    setShowReadyConfirm(false);
    setPendingModuleId(null);
  };

  const handleStartAssessment = async (moduleId: string) => {
    try {
      setStartingModule(moduleId);
      const response = await fetch('/api/lbi/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moduleId, childId })
      });
      if (response.ok) {
        const session = await response.json();
        toast({ title: "Started", description: "Good luck!" });
        onStartAssessment?.(session.id);
        fetchData();
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.message || "Failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to start", variant: "destructive" });
    } finally {
      setStartingModule(null);
    }
  };

  const getModuleSession = (moduleId: string) => sessions.find(s => s.moduleId === moduleId);

  const completedModuleIds = new Set(sessions.filter(s => s.status === 'Completed').map(s => s.moduleId));
  const completedCount = completedModuleIds.size;
  const totalModules = modules.length;
  const overallProgress = totalModules > 0 ? (completedCount / totalModules) * 100 : 0;

  const avgScore = (() => {
    const scored = sessions.filter(s => s.status === 'Completed' && s.percentileScore != null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((sum, s) => sum + (s.percentileScore || 0), 0) / scored.length);
  })();

  const HERO_BG   = '#1B2860';
  const HERO_CARD = 'rgba(255,255,255,0.08)';

  if (loading) {
    return (
      <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3" style={{ background: HERO_BG }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(78,205,196,0.15)' }}>
          <Brain className="w-5 h-5 animate-pulse" style={{ color: brandAccent }} />
        </div>
        <p className="text-sm text-white/50">Loading assessment modules…</p>
      </div>
    );
  }

  if (!hasConsent && role === 'parent') {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center" style={{ background: HERO_BG }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(78,205,196,0.12)' }}>
          <Lock className="w-6 h-6" style={{ color: brandAccent }} />
        </div>
        <p className="text-white font-semibold">Consent Required</p>
        <p className="text-white/50 text-sm max-w-xs">Grant parental consent to unlock behavioral intelligence assessments for your child.</p>
        <Button size="sm" className="mt-1 text-white text-sm px-5" style={{ background: brandAccent, border: 'none' }} data-testid="btn-grant-consent">
          Grant Consent
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ══════════════════════════════════════════════
          HERO BANNER — dark navy enterprise header
      ══════════════════════════════════════════════ */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: HERO_BG }}>
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'transparent' }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Icon + title */}
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.25)' }}>
              <Brain className="w-6 h-6" style={{ color: brandAccent }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white leading-tight">
                  Learning Behavior Index
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(78,205,196,0.18)', color: brandAccent, border: '1px solid rgba(78,205,196,0.3)' }}>
                  LBI™
                </span>
              </div>
              <p className="text-white/50 text-xs mt-0.5">
                {childName ? `Behavioural profile for ${childName}` : 'Uncover your cognitive strengths · Build your behavioural profile'}
              </p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex gap-2 flex-shrink-0">
            {[
              { icon: <Flame className="w-3.5 h-3.5" />, val: totalModules,    label: 'Modules',   color: '#4ECDC4' },
              { icon: <CheckCircle className="w-3.5 h-3.5" />, val: completedCount, label: 'Done', color: '#4ECDC4' },
              { icon: <Star className="w-3.5 h-3.5" />, val: `${avgScore}%`,   label: 'Avg',       color: brandAccent },
            ].map(chip => (
              <div key={chip.label} className="rounded-xl px-3 py-2 text-center flex-shrink-0 min-w-[60px]" style={{ background: HERO_CARD, border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: chip.color }} className="flex justify-center mb-0.5">{chip.icon}</span>
                <p className="text-sm font-black text-white leading-none">{chip.val}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{chip.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PROGRESS BLOCK
      ══════════════════════════════════════════════ */}
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'rgba(11,60,93,0.12)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: brandPrimary }} />
            <span className="text-sm font-bold" style={{ color: brandPrimary }}>Assessment Modules</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{completedCount}/{totalModules} completed</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${brandAccent}18`, color: brandAccent }}>
              {totalModules > 0 ? Math.round(overallProgress) : 0}% done
            </span>
          </div>
        </div>
        <Progress value={overallProgress} className="h-2.5 rounded-full" />
        <p className="text-xs text-gray-400 mt-2">
          {completedCount === totalModules && totalModules > 0
            ? '🎉 All modules complete — your full behavioral profile is ready'
            : `Complete all ${totalModules} modules to unlock your full behavioral intelligence profile`}
        </p>
      </div>

      {/* ══════════════════════════════════════════════
          MODULE LIST  (mission-card style)
      ══════════════════════════════════════════════ */}
      <div className="space-y-2">
        {modules.map((module, index) => {
          const session    = getModuleSession(module.id);
          const isCompleted  = session?.status === 'Completed';
          const isInProgress = session?.status === 'In Progress';
          const score        = session?.percentileScore ?? session?.percentageScore;
          const xp           = (module.subModules.length || 1) * 10 + 20;

          return (
            <div
              key={module.id}
              className="rounded-xl border bg-white transition-all hover:shadow-md"
              style={{
                borderColor: isCompleted ? 'rgba(78,205,196,0.3)' : isInProgress ? 'rgba(11,60,93,0.2)' : 'rgba(11,60,93,0.1)',
              }}
              data-testid={`module-card-${module.moduleCode}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">

                  {/* Status indicator */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5 border-2"
                    style={{
                      background: isCompleted ? brandAccent : isInProgress ? '#4ECDC4' : 'transparent',
                      borderColor: isCompleted ? brandAccent : isInProgress ? '#4ECDC4' : 'rgba(11,60,93,0.25)',
                      color: isCompleted || isInProgress ? '#fff' : brandPrimary,
                    }}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{module.moduleName}</p>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(11,60,93,0.08)', color: brandPrimary }}
                        >
                          {module.moduleCode}
                        </span>
                        {isInProgress && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EDF2F7] text-[#0B3C5D]">
                            In Progress
                          </span>
                        )}
                        {module.isLocked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            <Lock className="w-2.5 h-2.5" />
                            {module.lockedUntil ? `Unlocks ${new Date(module.lockedUntil).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` : 'Locked'}
                          </span>
                        )}
                      </div>

                      {/* Score badge for completed */}
                      {isCompleted && score !== undefined && (
                        <span className="text-sm font-black flex-shrink-0" style={{ color: score >= 70 ? brandAccent : score >= 50 ? '#4ECDC4' : '#0B3C5D' }}>
                          {Math.round(score)}%
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {module.description || `Explore ${module.subModules.length} sub-module${module.subModules.length !== 1 ? 's' : ''} · Behavioural Intelligence`}
                    </p>

                    {/* XP line */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-semibold" style={{ color: '#4ECDC4' }}>+{xp} XP</span>
                      <span className="text-xs text-gray-400">{module.subModules.length} sub-module{module.subModules.length !== 1 ? 's' : ''}</span>
                      {isCompleted && session?.completedAt && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* Score bar for completed */}
                    {isCompleted && score !== undefined && (
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={score} className="h-1.5 flex-1 max-w-[140px]" />
                        <span className="text-xs text-gray-400">{Math.round(score)}% score</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                    {!isCompleted && !module.isLocked && (
                      <Button
                        size="sm"
                        className="h-8 px-4 text-xs text-white font-semibold shadow-sm"
                        style={{ background: brandPrimary, border: 'none' }}
                        onClick={() => {
                          if (isInProgress) handleStartAssessment(module.id);
                          else if (onRequestStart) onRequestStart(module.id);
                          else handleRequestStart(module.id);
                        }}
                        disabled={startingModule === module.id}
                        data-testid={`btn-start-${module.moduleCode}`}
                      >
                        {startingModule === module.id ? '…' : isInProgress ? 'Continue' : 'Begin'}
                        {startingModule !== module.id && <ChevronRight className="w-3.5 h-3.5 ml-1" />}
                      </Button>
                    )}

                    {isCompleted && !module.isLocked && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs font-semibold text-white"
                          style={{ background: brandAccent, border: 'none' }}
                          onClick={() => onViewResults?.(session!.id)}
                          data-testid={`btn-results-${module.moduleCode}`}
                        >
                          View Report
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            style={{ borderColor: 'rgba(11,60,93,0.2)', color: brandPrimary }}
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/lbi/sessions/${session!.id}/results`, { credentials: 'include' });
                                if (!res.ok) throw new Error();
                                const data = await res.json();
                                const blob = new Blob([
                                  `LBI Assessment Report\n${'='.repeat(40)}\n`,
                                  `Module: ${data.moduleName} (${data.moduleCode})\n`,
                                  `Child: ${childName || 'N/A'}\n`,
                                  `Date: ${data.completedAt ? new Date(data.completedAt).toLocaleDateString('en-IN') : 'N/A'}\n\n`,
                                  `OVERALL SCORE\n${'-'.repeat(30)}\n`,
                                  `Score: ${data.summary?.percentileScore?.toFixed(1) ?? 0}%\n`,
                                  `Raw Score: ${data.summary?.rawScore ?? 0} / ${data.summary?.maxScore ?? 0}\n`,
                                  `Questions: ${data.summary?.questionsAnswered ?? 0} / ${data.summary?.totalQuestions ?? 0}\n\n`,
                                  `SUB-MODULE BREAKDOWN\n${'-'.repeat(30)}\n`,
                                  ...(data.subModuleResults || []).map((sm: any) =>
                                    `${sm.name}: ${sm.score}% (${sm.rawScore}/${sm.maxScore})\n`
                                  ),
                                ], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `LBI_${data.moduleCode}_Report.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch {
                                toast({ title: 'Error', description: 'Could not download report', variant: 'destructive' });
                              }
                            }}
                            data-testid={`btn-download-${module.moduleCode}`}
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            style={{ borderColor: 'rgba(11,60,93,0.2)', color: brandPrimary }}
                            onClick={() => handleRequestStart(module.id)}
                            disabled={startingModule === module.id}
                            data-testid={`btn-retake-${module.moduleCode}`}
                          >
                            Retake
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          PERFORMANCE SUMMARY (dark, after modules done)
      ══════════════════════════════════════════════ */}
      {sessions.filter(s => s.status === 'Completed').length > 0 && (
        <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: HERO_BG }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4" style={{ color: brandAccent }} />
              <p className="text-xs font-black uppercase tracking-widest text-white/60">Performance Overview</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Award className="w-4 h-4" />, val: `${avgScore}%`, label: 'Avg Score',   color: '#4ECDC4' },
                { icon: <Target className="w-4 h-4" />, val: completedCount, label: 'Completed',  color: brandAccent },
                { icon: <TrendingUp className="w-4 h-4" />, val: totalModules - completedCount, label: 'Remaining', color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: HERO_CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</span>
                  <p className="text-xl font-black text-white">{s.val}</p>
                  <p className="text-[11px] text-white/40">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          READY CONFIRMATION DIALOG
      ══════════════════════════════════════════════ */}
      <AlertDialog open={showReadyConfirm} onOpenChange={setShowReadyConfirm}>
        <AlertDialogContent style={{ borderColor: 'rgba(11,60,93,0.2)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${brandAccent}18` }}>
                <Brain className="w-4 h-4" style={{ color: brandAccent }} />
              </div>
              Ready to Begin?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <ul className="space-y-2 mt-2">
                {['Find a quiet environment', 'Set aside 10–15 minutes', 'There are no right or wrong answers', 'Answer every question honestly'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: brandAccent }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1">
            <AlertDialogCancel className="text-sm">Not Yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStart}
              className="text-sm text-white font-semibold"
              style={{ background: brandPrimary, border: 'none' }}
            >
              I'm Ready
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
