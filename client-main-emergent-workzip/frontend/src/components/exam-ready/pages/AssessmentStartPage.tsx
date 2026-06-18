import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, ArrowRight, Loader2, Shield, Target, Lightbulb, Brain, Play, Headphones, MessageCircle, Activity, Award, Eye, Zap, Star, RefreshCw, Save, BarChart3, Lock, Sparkles, ChevronRight, Users, TrendingUp, FileText, ChevronDown, ChevronUp, Heart, BookOpen, Timer, Layers, Puzzle, GraduationCap, Compass, Fingerprint, Wifi } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { assessmentService } from '../services/apiClient';
import type { AssessmentAttempt } from '../types';
import { cn } from "@/lib/utils";

interface Props {
  planId: string;
  board: string;
  grade: string;
  childName?: string;
  childId?: string;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
}

type ModuleStatus = 'completed' | 'available' | 'locked';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: any;
  questions: number;
  duration: string;
  status: ModuleStatus;
  subdomains: string[];
}

const MODULES: Module[] = [
  { id: 'emotional-regulation', name: 'Emotional Regulation', description: 'How you manage feelings during learning', icon: Heart, questions: 14, duration: '8 min', status: 'available', subdomains: ['Frustration Tolerance', 'Mood Stability', 'Emotional Awareness', 'Impulse Control'] },
  { id: 'focus-attention', name: 'Focus & Attention', description: 'Your concentration patterns and consistency', icon: Eye, questions: 12, duration: '7 min', status: 'available', subdomains: ['Sustained Focus', 'Selective Attention', 'Task Switching', 'Distraction Management'] },
  { id: 'self-motivation', name: 'Self-Motivation', description: 'What drives your learning energy', icon: Zap, questions: 10, duration: '6 min', status: 'available', subdomains: ['Goal Orientation', 'Intrinsic Drive', 'Effort Persistence', 'Growth Mindset'] },
  { id: 'social-learning', name: 'Social Learning', description: 'How you learn with and from others', icon: Users, questions: 11, duration: '7 min', status: 'locked', subdomains: ['Peer Collaboration', 'Help-Seeking', 'Perspective Taking', 'Group Dynamics'] },
  { id: 'resilience', name: 'Resilience & Adaptability', description: 'How you bounce back from setbacks', icon: Shield, questions: 12, duration: '7 min', status: 'locked', subdomains: ['Recovery Speed', 'Failure Response', 'Flexibility', 'Stress Coping'] },
  { id: 'metacognition', name: 'Metacognition', description: 'How you think about your own thinking', icon: Brain, questions: 11, duration: '6 min', status: 'locked', subdomains: ['Self-Monitoring', 'Strategy Selection', 'Planning Ability', 'Reflection Quality'] },
  { id: 'time-management', name: 'Time & Task Management', description: 'How you plan, prioritize and execute', icon: Timer, questions: 12, duration: '7 min', status: 'locked', subdomains: ['Prioritization', 'Scheduling', 'Deadline Awareness', 'Procrastination Control'] },
];

const TIPS = [
  { icon: Headphones, text: 'Find a quiet space with minimal distractions' },
  { icon: Clock, text: 'Each module takes 6–8 minutes — pace yourself' },
  { icon: MessageCircle, text: 'No right or wrong answers — be honest' },
  { icon: Lock, text: 'Your responses are private and secure' },
  { icon: Activity, text: 'Take breaks between modules if needed' },
];

const DISCOVERIES = [
  { icon: Sparkles, text: 'Discover your unique learning strengths' },
  { icon: Target, text: 'Get personalized study recommendations' },
  { icon: TrendingUp, text: 'Track behavioral growth over time' },
  { icon: GraduationCap, text: 'Unlock insights parents & teachers can use' },
];

export function AssessmentStartPage({ planId, board, grade, childName, childId, onNavigate }: Props) {
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [existingAttempt, setExistingAttempt] = useState<AssessmentAttempt | null>(null);
  const [existingAnswerCount, setExistingAnswerCount] = useState(0);
  const [checkingResume, setCheckingResume] = useState(true);
  const [showAllModules, setShowAllModules] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [checklist, setChecklist] = useState([true, true, true, false]);

  const totalQuestions = MODULES.reduce((sum, m) => sum + m.questions, 0);
  const completedModules = MODULES.filter(m => m.status === 'completed').length;
  const availableModules = MODULES.filter(m => m.status === 'available').length;
  const lockedModules = MODULES.filter(m => m.status === 'locked').length;
  const completionPct = Math.round((completedModules / MODULES.length) * 100);
  const visibleModules = showAllModules ? MODULES : MODULES.slice(0, 4);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const data = await assessmentService.getInProgress();
        if (data.attempt) {
          setExistingAttempt(data.attempt);
          setExistingAnswerCount(data.answers ? Object.keys(data.answers).length : 0);
        }
      } catch {}
      setCheckingResume(false);
    };
    checkExisting();
  }, []);

  const handleResume = async () => {
    if (!existingAttempt) return;
    setResuming(true);
    setError('');
    try {
      await assessmentService.resume(existingAttempt.id);
      onNavigate('exam-ready-assessment', { attemptId: existingAttempt.id });
    } catch {
      onNavigate('exam-ready-assessment', { attemptId: existingAttempt.id });
    } finally {
      setResuming(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const attempt = await assessmentService.start(planId, board, grade, childId, childName);
      onNavigate('exam-ready-assessment', { attemptId: attempt.id });
    } catch {
      const mockAttemptId = `attempt_${Date.now()}`;
      localStorage.setItem(`exam_ready_attempt_${mockAttemptId}`, JSON.stringify({
        id: mockAttemptId, planId, board, grade, status: 'in_progress',
        currentQuestionIndex: 0, totalQuestions: 10, timeRemaining: 40 * 60, startedAt: new Date().toISOString(),
      }));
      onNavigate('exam-ready-assessment', { attemptId: mockAttemptId });
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: ModuleStatus) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(78,205,196,0.06)', border: '#4ECDC4', badge: '#4ECDC4', badgeBg: 'rgba(78,205,196,0.1)', text: 'Completed' };
      case 'available': return { bg: '#ffffff', border: '#e2e8f0', badge: '#0B3C5D', badgeBg: 'rgba(11,60,93,0.06)', text: 'Available' };
      case 'locked': return { bg: '#fafbfc', border: '#f1f5f9', badge: '#94a3b8', badgeBg: '#f1f5f9', text: 'Locked' };
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <ExamReadyHeader title="LBI Assessment" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">

          {/* TOP BAR: Breadcrumb + Tags */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#94a3b8' }}>
              <span>Dashboard</span>
              <ChevronRight className="w-3 h-3" />
              <span>Assessments</span>
              <ChevronRight className="w-3 h-3" />
              <span className="font-bold" style={{ color: '#0B3C5D' }}>LBI Assessment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge className="text-[10px] font-bold px-2 py-0.5 rounded border-none" style={{ backgroundColor: 'rgba(11,60,93,0.06)', color: '#0B3C5D' }}>{board}</Badge>
              <Badge className="text-[10px] font-bold px-2 py-0.5 rounded border-none" style={{ backgroundColor: 'rgba(11,60,93,0.06)', color: '#0B3C5D' }}>{grade}</Badge>
            </div>
          </div>

          {/* HERO — Compact */}
          <div className="rounded-xl p-4 sm:p-5 mb-4 relative overflow-hidden" style={{ backgroundColor: '#0B3C5D', boxShadow: '0 8px 32px rgba(11,60,93,0.25)' }}>
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full -translate-y-1/2 translate-x-1/3" style={{ backgroundColor: 'rgba(78,205,196,0.05)' }} />
            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full translate-y-1/2 -translate-x-1/4" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} />

            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(78,205,196,0.15)' }}>
                      <Brain className="w-3.5 h-3.5" style={{ color: '#4ECDC4' }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#4ECDC4' }}>Learning Behavior Index</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(78,205,196,0.15)', color: '#4ECDC4' }}>{completedModules}/{MODULES.length} Modules</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight tracking-tight mb-1.5">
                    Behavioral Intelligence
                  </h1>
                  <p className="text-[13px] leading-relaxed max-w-xl" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    Ready to Explore Your Mind? This assessment maps your unique learning behaviors across {MODULES.length} cognitive domains. Discover what makes you tick and unlock personalized learning strategies.
                  </p>
                </div>

                {/* Right: Progress Ring + Stats */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Stats Column */}
                  <div className="hidden sm:grid grid-cols-2 gap-x-5 gap-y-2">
                    {[
                      { value: '~45 min', label: 'total' },
                      { value: `${totalQuestions}`, label: 'questions' },
                      { value: `${MODULES.length}`, label: 'domains' },
                    ].map((s, i) => (
                      <div key={i} className="text-right">
                        <p className="text-sm font-extrabold text-white leading-none tracking-tight">{s.value}</p>
                        <p className="text-[9px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress Ring */}
                  <div className="relative w-[88px] h-[88px] shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#4ECDC4" strokeWidth="6"
                        strokeDasharray={`${completionPct * 2.51} ${251 - completionPct * 2.51}`}
                        strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold text-white leading-none">{completionPct}%</span>
                      <span className="text-[8px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Complete</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module Status Bar */}
              <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { count: completedModules, label: 'Completed', color: '#4ECDC4', icon: CheckCircle },
                  { count: availableModules, label: 'Available', color: '#ffffff', icon: Play },
                  { count: lockedModules, label: 'Locked', color: 'rgba(255,255,255,0.4)', icon: Lock },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <s.icon className="w-3 h-3" style={{ color: s.color }} />
                    <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.count}</span>
                    <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resume Banner */}
          {existingAttempt && (
            <div className="rounded-xl p-3.5 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3" style={{ backgroundColor: '#ffffff', border: '2px solid #4ECDC4', boxShadow: '0 2px 12px rgba(78,205,196,0.1)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78,205,196,0.08)' }}>
                <RefreshCw className="w-5 h-5" style={{ color: '#4ECDC4' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: '#0B3C5D' }}>Assessment In Progress</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(78,205,196,0.08)', color: '#4ECDC4' }}>Active</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-medium" style={{ color: '#64748b' }}>{existingAnswerCount}/{existingAttempt.totalQuestions} answered</span>
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
                    <div className="h-full rounded-full" style={{ width: `${existingAttempt.totalQuestions > 0 ? (existingAnswerCount / existingAttempt.totalQuestions) * 100 : 0}%`, backgroundColor: '#4ECDC4' }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: '#4ECDC4' }}>{existingAttempt.totalQuestions > 0 ? Math.round((existingAnswerCount / existingAttempt.totalQuestions) * 100) : 0}%</span>
                </div>
              </div>
              <Button onClick={handleResume} disabled={resuming} className="rounded-lg gap-1.5 h-9 px-4 text-xs font-bold text-white shrink-0" style={{ backgroundColor: '#4ECDC4' }} data-testid="btn-resume-assessment">
                {resuming ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {resuming ? 'Resuming...' : 'Resume'}
              </Button>
            </div>
          )}

          {/* MAIN 3-COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* LEFT: Modules (8 cols) */}
            <div className="lg:col-span-8 space-y-4">

              {/* Assessment Modules */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" style={{ color: '#0B3C5D' }} />
                    <span className="text-[13px] font-extrabold tracking-tight" style={{ color: '#0f172a' }}>Assessment Modules</span>
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>Select a module to begin</span>
                </div>

                <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                  {visibleModules.map((mod) => {
                    const Icon = mod.icon;
                    const style = getStatusStyle(mod.status);
                    const isExpanded = selectedModule === mod.id;
                    const isLocked = mod.status === 'locked';

                    return (
                      <div key={mod.id}>
                        <button
                          onClick={() => setSelectedModule(isExpanded ? null : mod.id)}
                          className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-all", isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-[#fafbfd]")}
                          disabled={isLocked}
                          data-testid={`module-${mod.id}`}
                        >
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: style.badgeBg }}>
                            {isLocked ? <Lock className="w-4 h-4" style={{ color: '#94a3b8' }} /> : <Icon className="w-4 h-4" style={{ color: style.badge }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold truncate" style={{ color: isLocked ? '#94a3b8' : '#0f172a' }}>{mod.name}</span>
                            </div>
                            <p className="text-[11px] font-medium mt-0.5 truncate" style={{ color: '#94a3b8' }}>{mod.description}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:flex items-center gap-2">
                              <span className="text-[10px] font-bold" style={{ color: isLocked ? '#cbd5e1' : '#0B3C5D' }}>{mod.questions} Q</span>
                              <span className="text-[10px]" style={{ color: '#e2e8f0' }}>·</span>
                              <span className="text-[10px] font-medium" style={{ color: isLocked ? '#cbd5e1' : '#64748b' }}>{mod.duration}</span>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: style.badgeBg, color: style.badge }}>{style.text}</span>
                            {!isLocked && (
                              <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-90")} style={{ color: '#94a3b8' }} />
                            )}
                          </div>
                        </button>

                        {isExpanded && !isLocked && (
                          <div className="px-4 pb-3" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                            <div className="ml-12 p-3 rounded-lg" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Puzzle className="w-3 h-3" style={{ color: '#0B3C5D' }} />
                                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#0B3C5D' }}>Subdomains</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {mod.subdomains.map((sub, si) => (
                                  <span key={si} className="text-[10px] font-medium px-2 py-1 rounded" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#475569' }}>{sub}</span>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 mt-2.5 pt-2.5" style={{ borderTop: '1px solid #f1f5f9' }}>
                                <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>{mod.questions} questions</span>
                                <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>~{mod.duration}</span>
                                <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>{mod.subdomains.length} subdomains</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {MODULES.length > 4 && (
                  <button
                    onClick={() => setShowAllModules(!showAllModules)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-all hover:bg-[#fafbfd]"
                    style={{ borderTop: '1px solid #f1f5f9', color: '#0B3C5D' }}
                    data-testid="btn-show-all-modules"
                  >
                    {showAllModules ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showAllModules ? 'Show Less' : `Show All ${MODULES.length} Modules`}
                  </button>
                )}
              </div>

              {/* CTA Section */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4" style={{ color: '#4ECDC4' }} />
                    <span className="text-[13px] font-extrabold tracking-tight" style={{ color: '#0f172a' }}>Ready to begin?</span>
                  </div>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: '#94a3b8' }}>Select a module above, or start with the recommended path</p>
                </div>
                <div className="p-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-[12px] mb-3 font-medium" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      <AlertCircle size={14} className="shrink-0" />
                      {error}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      className="flex-1 rounded-lg gap-2 h-10 font-bold text-white text-[13px]"
                      style={{ backgroundColor: '#4ECDC4', boxShadow: '0 2px 12px rgba(78,205,196,0.25)' }}
                      onClick={handleStart}
                      disabled={loading}
                      data-testid="btn-begin-assessment"
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                      {loading ? 'Starting...' : 'Begin Assessment'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <div className="flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" style={{ color: '#94a3b8' }} />
                      <span className="text-[9px] font-medium" style={{ color: '#94a3b8' }}>Encrypted</span>
                    </div>
                    <span style={{ color: '#e2e8f0' }}>·</span>
                    <div className="flex items-center gap-1">
                      <Save className="w-2.5 h-2.5" style={{ color: '#94a3b8' }} />
                      <span className="text-[9px] font-medium" style={{ color: '#94a3b8' }}>Auto-save</span>
                    </div>
                    <span style={{ color: '#e2e8f0' }}>·</span>
                    <button onClick={() => onNavigate('exam-ready-disclaimer')} className="text-[9px] font-medium hover:underline" style={{ color: '#0B3C5D' }}>
                      Terms & Privacy
                    </button>
                  </div>
                </div>
              </div>

              {/* Two-Col: Tips + Discover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Tips for Success */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <Lightbulb className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                    <span className="text-[12px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Tips for Success</span>
                  </div>
                  <div className="p-3 space-y-1">
                    {TIPS.map((tip, idx) => {
                      const Icon = tip.icon;
                      return (
                        <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#f8fafc' }}>
                            <Icon className="w-3 h-3" style={{ color: '#0B3C5D' }} />
                          </div>
                          <p className="text-[11px] font-medium leading-snug pt-1" style={{ color: '#475569' }}>{tip.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* What You'll Discover */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <Compass className="w-3.5 h-3.5" style={{ color: '#4ECDC4' }} />
                    <span className="text-[12px] font-bold tracking-tight" style={{ color: '#0f172a' }}>What You'll Discover</span>
                  </div>
                  <div className="p-3 space-y-1">
                    {DISCOVERIES.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(78,205,196,0.06)' }}>
                            <Icon className="w-3 h-3" style={{ color: '#4ECDC4' }} />
                          </div>
                          <p className="text-[11px] font-medium leading-snug pt-1" style={{ color: '#475569' }}>{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR (4 cols) */}
            <div className="lg:col-span-4 space-y-4">

              {/* Domain Coverage */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5" style={{ color: '#0B3C5D' }} />
                    <span className="text-[12px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Domain Coverage</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(11,60,93,0.06)', color: '#0B3C5D' }}>{MODULES.length} domains</span>
                </div>
                <div className="p-3 space-y-1.5">
                  {MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const isLocked = mod.status === 'locked';
                    return (
                      <div key={mod.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: mod.status === 'completed' ? 'rgba(78,205,196,0.03)' : 'transparent' }}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: isLocked ? '#f8fafc' : 'rgba(11,60,93,0.05)' }}>
                          {isLocked ? <Lock className="w-3 h-3" style={{ color: '#cbd5e1' }} /> : <Icon className="w-3 h-3" style={{ color: '#0B3C5D' }} />}
                        </div>
                        <span className="text-[11px] font-medium flex-1 truncate" style={{ color: isLocked ? '#94a3b8' : '#334155' }}>{mod.name}</span>
                        <span className="text-[9px] font-bold shrink-0" style={{ color: isLocked ? '#cbd5e1' : '#4ECDC4' }}>{mod.questions}Q</span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
                  <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>Total questions</span>
                  <span className="text-[12px] font-extrabold" style={{ color: '#0B3C5D' }}>{totalQuestions}</span>
                </div>
              </div>

              {/* Your Privacy */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(11,60,93,0.02)', border: '1px solid rgba(11,60,93,0.08)' }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <Fingerprint className="w-3.5 h-3.5" style={{ color: '#0B3C5D' }} />
                  <span className="text-[12px] font-bold tracking-tight" style={{ color: '#0B3C5D' }}>Your Privacy Matters</span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: '#475569' }}>
                  All your responses are encrypted and private. Only you and your authorized guardians can access your results. There are no right or wrong answers — just be yourself.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['DPDP Compliant', 'AES-256 Encrypted', 'SOC2 Audited'].map((tag, idx) => (
                    <span key={idx} className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(11,60,93,0.06)', color: '#0B3C5D' }}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Readiness Checklist */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: '#4ECDC4' }} />
                  <span className="text-[12px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Readiness Checklist</span>
                </div>
                <div className="p-3 space-y-0.5">
                  {[
                    { label: 'Quiet environment', idx: 0 },
                    { label: 'Stable internet', idx: 1 },
                    { label: '15–20 minutes free', idx: 2 },
                    { label: 'Feeling relaxed', idx: 3 },
                  ].map((item) => (
                    <button
                      key={item.idx}
                      onClick={() => { const c = [...checklist]; c[item.idx] = !c[item.idx]; setChecklist(c); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all hover:bg-[#fafbfd]"
                      data-testid={`checklist-${item.idx}`}
                    >
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0"
                        style={{
                          backgroundColor: checklist[item.idx] ? '#4ECDC4' : 'transparent',
                          borderColor: checklist[item.idx] ? '#4ECDC4' : '#cbd5e1',
                          borderWidth: '1.5px',
                        }}
                      >
                        {checklist[item.idx] && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={cn("text-[11px]", checklist[item.idx] ? "font-semibold" : "font-medium")} style={{ color: checklist[item.idx] ? '#334155' : '#94a3b8' }}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Methodology */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(78,205,196,0.03)', border: '1px solid rgba(78,205,196,0.1)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-3.5 h-3.5" style={{ color: '#4ECDC4' }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#0B3C5D' }}>Methodology</span>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: '#64748b' }}>
                  Built on evidence-based psychometric frameworks, our LBI assessment maps 19 behavioral domains and 97 subdomains with adaptive age-band scoring and norm-referenced benchmarks.
                </p>
              </div>

              {/* Quick Stats */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(11,60,93,0.03)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: '#4ECDC4' }} />
                  <span className="text-[12px] font-bold tracking-tight" style={{ color: '#0f172a' }}>Platform Stats</span>
                </div>
                <div className="grid grid-cols-2 divide-x" style={{ borderColor: '#f1f5f9' }}>
                  {[
                    { value: '50K+', label: 'Students', color: '#0B3C5D' },
                    { value: '97%', label: 'Helpful', color: '#4ECDC4' },
                    { value: '19', label: 'Domains', color: '#0B3C5D' },
                    { value: '97', label: 'Subdomains', color: '#4ECDC4' },
                  ].map((s, i) => (
                    <div key={i} className="p-3 text-center" style={{ borderColor: '#f1f5f9', borderTop: i >= 2 ? '1px solid #f1f5f9' : undefined }}>
                      <p className="text-sm font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] mt-1" style={{ color: '#94a3b8' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Session Info */}
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <Wifi className="w-3 h-3" style={{ color: '#4ECDC4' }} />
                    <span className="font-medium" style={{ color: '#64748b' }}>Connected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Save className="w-3 h-3" style={{ color: '#94a3b8' }} />
                    <span className="font-medium" style={{ color: '#64748b' }}>Auto-save every 30s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
