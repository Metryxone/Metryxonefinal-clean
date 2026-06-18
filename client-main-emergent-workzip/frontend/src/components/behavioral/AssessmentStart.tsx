import { useState, useEffect } from 'react';
import { Screen } from '../../App';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Brain,
  Clock,
  Target,
  Sparkles,
  Play,
  CheckCircle,
  Shield,
  Eye,
  Lightbulb,
  Zap,
  Heart,
  Users,
  BookOpen,
  Star,
  ChevronRight,
  Lock,
  Award,
  Activity,
  Headphones,
  MessageCircle,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

interface LbiDomain {
  id: string;
  name: string;
  icon: any;
  description: string;
  questionCount: number;
  estimatedTime: string;
  status: 'available' | 'completed' | 'locked';
  score?: number;
  color: string;
}

const LBI_DOMAINS: LbiDomain[] = [
  { id: 'd1', name: 'Emotional Regulation', icon: Heart, description: 'How you manage feelings during learning', questionCount: 14, estimatedTime: '8 min', status: 'available', color: '#ef4444' },
  { id: 'd2', name: 'Focus & Attention', icon: Eye, description: 'Your concentration patterns and consistency', questionCount: 12, estimatedTime: '7 min', status: 'available', color: '#0B3C5D' },
  { id: 'd3', name: 'Self-Motivation', icon: Zap, description: 'What drives your learning energy', questionCount: 10, estimatedTime: '6 min', status: 'available', color: '#f59e0b' },
  { id: 'd4', name: 'Social Learning', icon: Users, description: 'How you learn with and from others', questionCount: 11, estimatedTime: '7 min', status: 'locked', color: '#0B3C5D' },
  { id: 'd5', name: 'Study Habits', icon: BookOpen, description: 'Your approach to organizing study time', questionCount: 13, estimatedTime: '8 min', status: 'locked', color: '#4ECDC4' },
  { id: 'd6', name: 'Critical Thinking', icon: Lightbulb, description: 'How you analyze and solve problems', questionCount: 12, estimatedTime: '7 min', status: 'locked', color: '#4ECDC4' },
  { id: 'd7', name: 'Resilience & Grit', icon: Shield, description: 'How you bounce back from setbacks', questionCount: 10, estimatedTime: '6 min', status: 'locked', color: '#1B6B9A' },
];

const TIPS = [
  { icon: Headphones, text: 'Find a quiet space with minimal distractions' },
  { icon: Clock, text: 'Each module takes 6-8 minutes — pace yourself' },
  { icon: MessageCircle, text: 'No right or wrong answers — be honest' },
  { icon: Shield, text: 'Your responses are private and secure' },
  { icon: Activity, text: 'Take breaks between modules if needed' },
];

const BENEFITS = [
  'Discover your unique learning strengths',
  'Get personalized study recommendations',
  'Track behavioral growth over time',
  'Unlock insights parents & teachers can use',
];

export function AssessmentStart({ onNavigate }: Props) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [activeTip, setActiveTip] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [showAllDomains, setShowAllDomains] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTip(prev => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const completedCount = LBI_DOMAINS.filter(d => d.status === 'completed').length;
  const availableCount = LBI_DOMAINS.filter(d => d.status === 'available').length;
  const totalQuestions = LBI_DOMAINS.reduce((sum, d) => sum + d.questionCount, 0);
  const overallProgress = (completedCount / LBI_DOMAINS.length) * 100;

  const visibleDomains = showAllDomains ? LBI_DOMAINS : LBI_DOMAINS.slice(0, 4);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('student-consent-explainer')}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#f1f5f9] text-[var(--text-secondary)] transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#344E86]">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-[#344E86]">LBI Assessment</h1>
              <p className="text-[11px] text-[var(--text-muted)]">Learning Behavior Index</p>
            </div>
          </div>
          <Badge className="bg-[#4ECDC4]/10 text-[#4ECDC4] border-none text-xs font-semibold">
            {completedCount}/{LBI_DOMAINS.length} Modules
          </Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* HERO SECTION - Full Width */}
        <div className="bg-[#344E86] rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(52,78,134,0.25)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-[#4ECDC4]/10 translate-y-1/2 -translate-x-1/4" />
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-[#4ECDC4]" />
                  <span className="text-[#4ECDC4] text-sm font-semibold">Behavioral Intelligence</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                  Ready to Explore Your Mind?
                </h2>
                <p className="text-white/70 text-sm sm:text-base leading-relaxed">
                  This assessment maps your unique learning behaviors across 7 cognitive domains. 
                  Discover what makes you tick and unlock personalized learning strategies.
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-5">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
                    <Clock className="w-4 h-4 text-[#4ECDC4]" />
                    <span className="text-white text-sm font-medium">~45 min total</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
                    <Target className="w-4 h-4 text-[#4ECDC4]" />
                    <span className="text-white text-sm font-medium">{totalQuestions} questions</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
                    <Brain className="w-4 h-4 text-[#4ECDC4]" />
                    <span className="text-white text-sm font-medium">7 domains</span>
                  </div>
                </div>
              </div>

              {/* Overall Progress Ring */}
              <div className="flex items-center gap-6 lg:gap-8">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none" stroke="#4ECDC4" strokeWidth="10"
                      strokeDasharray={`${overallProgress * 3.14} ${314 - overallProgress * 3.14}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{Math.round(overallProgress)}%</span>
                    <span className="text-xs text-white/60">Complete</span>
                  </div>
                </div>
                <div className="hidden sm:block space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#4ECDC4]" />
                    <span className="text-white/80 text-sm">{completedCount} Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/40" />
                    <span className="text-white/80 text-sm">{availableCount} Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/15" />
                    <span className="text-white/60 text-sm">{LBI_DOMAINS.length - completedCount - availableCount} Locked</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* THREE-COLUMN PARTITION LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT COLUMN - Domain Selection (8 cols) */}
          <div className="lg:col-span-8 space-y-6">

            {/* Assessment Modules */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(52,78,134,0.06)' }}>
              <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#344E86]" />
                  <h3 className="font-bold text-[var(--text-primary)]">Assessment Modules</h3>
                </div>
                <span className="text-xs text-[var(--text-muted)]">Select a module to begin</span>
              </div>
              <div className="p-5 space-y-3">
                {visibleDomains.map((domain, idx) => {
                  const Icon = domain.icon;
                  const isSelected = selectedDomain === domain.id;
                  const isLocked = domain.status === 'locked';
                  const isCompleted = domain.status === 'completed';

                  return (
                    <button
                      key={domain.id}
                      onClick={() => !isLocked && setSelectedDomain(isSelected ? null : domain.id)}
                      disabled={isLocked}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group relative",
                        isSelected && "border-[#4ECDC4] bg-[#4ECDC4]/5",
                        isCompleted && !isSelected && "border-[#4ECDC4]/30 bg-[#4ECDC4]/5",
                        isLocked && "border-[var(--border-subtle)] bg-[var(--bg-secondary)] opacity-60 cursor-not-allowed",
                        !isSelected && !isCompleted && !isLocked && "border-[var(--border-subtle)] hover:border-[#344E86]/30 hover:bg-[var(--bg-secondary)]",
                      )}
                      style={isSelected ? { boxShadow: '0 0 0 1px rgba(78,205,196,0.15), 0 4px 12px rgba(78,205,196,0.1)' } : undefined}
                      data-testid={`domain-${domain.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all",
                            isLocked ? "bg-[#f1f5f9]" : isCompleted ? "bg-[#4ECDC4]/15" : ""
                          )}
                          style={!isLocked && !isCompleted ? { backgroundColor: `${domain.color}15` } : undefined}
                        >
                          {isLocked ? (
                            <Lock className="w-5 h-5 text-[#cbd5e1]" />
                          ) : isCompleted ? (
                            <CheckCircle className="w-5 h-5 text-[#4ECDC4]" />
                          ) : (
                            <Icon className="w-5 h-5" style={{ color: domain.color }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={cn("font-semibold text-sm", isLocked ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]")}>{domain.name}</h4>
                            {isCompleted && domain.score !== undefined && (
                              <Badge className="bg-[#4ECDC4]/10 text-[#4ECDC4] border-none text-[10px]">{domain.score}%</Badge>
                            )}
                          </div>
                          <p className={cn("text-xs mt-0.5", isLocked ? "text-[#cbd5e1]" : "text-[var(--text-muted)]")}>{domain.description}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className={cn("text-xs font-medium", isLocked ? "text-[#cbd5e1]" : "text-[var(--text-secondary)]")}>{domain.questionCount} Q</p>
                            <p className={cn("text-[10px]", isLocked ? "text-[var(--border-subtle)]" : "text-[var(--text-muted)]")}>{domain.estimatedTime}</p>
                          </div>
                          {!isLocked && !isCompleted && (
                            <ChevronRight className={cn("w-4 h-4 transition-transform", isSelected ? "text-[#4ECDC4] translate-x-0.5" : "text-[#cbd5e1] group-hover:translate-x-0.5")} />
                          )}
                          {isCompleted && (
                            <div className="w-6 h-6 rounded-full bg-[#4ECDC4] flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-[#4ECDC4]/20" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {domain.estimatedTime}</span>
                              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {domain.questionCount} questions</span>
                            </div>
                            <Button
                              size="sm"
                              className="bg-[#344E86] hover:bg-[#2a3f6d] text-white rounded-lg gap-1.5 h-9 px-4 font-semibold text-xs"
                              onClick={(e) => { e.stopPropagation(); onNavigate('interactive-task'); }}
                              data-testid={`btn-start-${domain.id}`}
                            >
                              <Play className="w-3.5 h-3.5" /> Start Module
                            </Button>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}

                {!showAllDomains && LBI_DOMAINS.length > 4 && (
                  <button
                    onClick={() => setShowAllDomains(true)}
                    className="w-full py-3 text-center text-sm font-medium text-[#344E86] hover:bg-[#f1f5f9] rounded-xl transition-colors flex items-center justify-center gap-1"
                    data-testid="btn-show-all-domains"
                  >
                    Show All {LBI_DOMAINS.length} Modules <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Start CTA */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-5" style={{ boxShadow: '0 1px 4px rgba(52,78,134,0.06)' }}>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-7 h-7 text-[#4ECDC4]" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-[var(--text-primary)]">Ready to begin?</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">Select a module above, or start with the recommended path</p>
                </div>
                <Button
                  className="bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#0c1220] font-bold rounded-xl gap-2 h-12 px-6 shrink-0"
                  style={{ boxShadow: '0 4px 20px rgba(78,205,196,0.3)' }}
                  onClick={() => onNavigate('interactive-task')}
                  data-testid="button-begin-assessment"
                >
                  <Play className="w-5 h-5" />
                  Begin Assessment
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Info Panels (4 cols) */}
          <div className="lg:col-span-4 space-y-5">

            {/* Rotating Tips */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-5" style={{ boxShadow: '0 1px 4px rgba(52,78,134,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-[#f59e0b]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Tips for Success</h3>
              </div>
              <div className="space-y-2.5">
                {TIPS.map((tip, idx) => {
                  const TipIcon = tip.icon;
                  const isActive = idx === activeTip;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl transition-all duration-500",
                        isActive ? "bg-[#344E86]/5 border border-[#344E86]/10" : "opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                        isActive ? "bg-[#344E86]/10" : "bg-[#f1f5f9]"
                      )}>
                        <TipIcon className={cn("w-4 h-4", isActive ? "text-[#344E86]" : "text-[var(--text-muted)]")} />
                      </div>
                      <p className={cn("text-sm leading-snug mt-1", isActive ? "text-[#334155] font-medium" : "text-[var(--text-muted)]")}>{tip.text}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-1.5 mt-4">
                {TIPS.map((_, idx) => (
                  <div key={idx} className={cn("h-1 rounded-full transition-all duration-500", idx === activeTip ? "w-6 bg-[#344E86]" : "w-1.5 bg-[var(--border-subtle)]")} />
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-5" style={{ boxShadow: '0 1px 4px rgba(52,78,134,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-[#4ECDC4]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">What You'll Discover</h3>
              </div>
              <div className="space-y-3">
                {BENEFITS.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5 text-[#4ECDC4]" />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy & Trust */}
            <div className="bg-[#344E86]/5 rounded-2xl border border-[#344E86]/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-[#344E86]" />
                <h3 className="font-bold text-sm text-[#344E86]">Your Privacy Matters</h3>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                All your responses are encrypted and private. Only you and your authorized guardians can access your results. 
                There are no right or wrong answers — just be yourself.
              </p>
            </div>

            {/* Readiness Checklist */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-5" style={{ boxShadow: '0 1px 4px rgba(52,78,134,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-[#4ECDC4]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Readiness Checklist</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Quiet environment', checked: true },
                  { label: 'Stable internet', checked: true },
                  { label: '15-20 minutes free', checked: true },
                  { label: 'Feeling relaxed', checked: isReady },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => idx === 3 && setIsReady(!isReady)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all text-sm",
                      item.checked ? "text-[#334155]" : "text-[var(--text-muted)]",
                      idx === 3 && "hover:bg-[#f1f5f9] cursor-pointer"
                    )}
                    data-testid={`checklist-${idx}`}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all shrink-0",
                      item.checked ? "bg-[#4ECDC4] border-[#4ECDC4]" : "border-[#cbd5e1]"
                    )}>
                      {item.checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className={cn(item.checked && "font-medium")}>{item.label}</span>
                  </button>
                ))}
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
