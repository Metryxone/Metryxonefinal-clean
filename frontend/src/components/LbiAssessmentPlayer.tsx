import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  AlertCircle,
  Brain,
  Flag,
  Sun,
  Moon,
  Save,
  Sparkles,
  Shield,
  Target,
  Lightbulb
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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

interface Question {
  id: string;
  questionCode: string;
  questionType: string;
  questionText: string;
  passageText?: string;
  subModuleName: string;
  subModuleCode: string;
  options: { key: string; text: string }[];
}

interface Props {
  sessionId: string;
  onComplete: (results: any) => void;
  onExit: () => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
}

interface QuestionTiming {
  questionId: string;
  startTime: number;
  endTime?: number;
  timeSpentMs?: number;
}

const EMOTIONAL_EMOJIS: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '😰', label: 'Very anxious' },
  1: { emoji: '😟', label: 'Somewhat nervous' },
  2: { emoji: '😐', label: 'Neutral' },
  3: { emoji: '🙂', label: 'Fairly calm' },
  4: { emoji: '😌', label: 'Relaxed & prepared' },
};

const MICROCOPY: Record<number, string> = {
  0: "It's okay. Awareness is the first step toward readiness.",
  1: "A little nervousness can sharpen your focus.",
  2: "A balanced perspective is a great starting point.",
  3: "That's a strong mindset. Let's explore further.",
  4: "Wonderful composure. You're ready for anything.",
};

const ENCOURAGEMENTS = [
  "Small steps create strong results.",
  "Consistency beats stress every time.",
  "Clarity comes with reflection.",
  "Every answer reveals a strength.",
  "Self-awareness is your superpower.",
  "You're building a clearer picture of yourself.",
  "Trust the process — insights are forming.",
  "Each response helps us understand you better.",
];

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export function LbiAssessmentPlayer({ sessionId, onComplete, onExit, isDarkMode = true, onThemeToggle }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [questionTimings, setQuestionTimings] = useState<Record<string, QuestionTiming>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState<number>(1);
  const [ageGroup, setAgeGroup] = useState<string>('');
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const questionStartTime = useRef<number>(Date.now());
  const { toast } = useToast();

  const dk = isDarkMode;

  useEffect(() => { fetchQuestions(); }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      const q = questions[currentIndex];
      if (q && !questionTimings[q.id]) {
        setQuestionTimings(prev => ({ ...prev, [q.id]: { questionId: q.id, startTime: Date.now() } }));
      }
      questionStartTime.current = Date.now();
    }
  }, [currentIndex, questions]);

  useEffect(() => {
    const q = questions[currentIndex];
    if (q && answers[q.id]) {
      const idx = q.options.findIndex(o => o.key === answers[q.id]);
      setSelectedFeedback(idx >= 0 ? idx : null);
    } else {
      setSelectedFeedback(null);
    }
  }, [currentIndex, questions, answers]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const q = questions[currentIndex];
    if (!q) return;
    if (e.key >= '1' && e.key <= '5') {
      const i = parseInt(e.key) - 1;
      if (i < q.options.length) handleSelectAnswer(q.id, q.options[i].key);
    }
    if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) handleNext();
    if (e.key === 'ArrowLeft' && currentIndex > 0) handlePrevious();
  }, [currentIndex, questions]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`/api/lbi/sessions/${sessionId}/questions`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions);
        setDifficultyLevel(data.difficultyLevel);
        setAgeGroup(data.ageGroup);
      } else {
        toast({ title: "Error", description: "Failed to load assessment questions", variant: "destructive" });
        onExit();
      }
    } catch {
      toast({ title: "Error", description: "Failed to load assessment", variant: "destructive" });
      onExit();
    } finally {
      setLoading(false);
    }
  };

  const recordQuestionTime = async () => {
    const q = questions[currentIndex];
    if (q) {
      const timeSpent = Date.now() - questionStartTime.current;
      setQuestionTimings(prev => ({
        ...prev,
        [q.id]: { ...prev[q.id], endTime: Date.now(), timeSpentMs: (prev[q.id]?.timeSpentMs || 0) + timeSpent }
      }));
      try {
        await authFetch(`/api/lbi/sessions/${sessionId}/time`, {
          method: 'POST', body: JSON.stringify({ questionId: q.id, timeSpentMs: timeSpent })
        });
      } catch {}
    }
  };

  const handleSelectAnswer = async (questionId: string, option: string) => {
    const timeSpent = Date.now() - questionStartTime.current;
    const q = questions[currentIndex];
    if (q) {
      const idx = q.options.findIndex(o => o.key === option);
      setSelectedFeedback(idx >= 0 ? idx : null);
    }
    setAnswers(prev => ({ ...prev, [questionId]: option }));
    try {
      await authFetch(`/api/lbi/sessions/${sessionId}/responses`, {
        method: 'POST', body: JSON.stringify({ questionId, selectedOption: option, responseTimeMs: timeSpent })
      });
    } catch {}
  };

  const handleNext = () => {
    recordQuestionTime();
    if (currentIndex < questions.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => { setCurrentIndex(prev => prev + 1); setIsTransitioning(false); }, 180);
    }
  };

  const handlePrevious = () => {
    recordQuestionTime();
    if (currentIndex > 0) {
      setIsTransitioning(true);
      setTimeout(() => { setCurrentIndex(prev => prev - 1); setIsTransitioning(false); }, 180);
    }
  };

  const handleToggleFlag = () => {
    const id = questions[currentIndex].id;
    setFlagged(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleSubmit = async () => {
    recordQuestionTime();
    setSubmitting(true);
    try {
      const response = await authFetch(`/api/lbi/sessions/${sessionId}/complete`, { method: 'POST' });
      if (response.ok) {
        const results = await response.json();
        toast({ title: "Assessment Complete!", description: `Your score: ${results.summary.percentileScore}%` });
        if (results.pointsAwarded) {
          setTimeout(() => {
            toast({
              title: `+${results.pointsAwarded.xp} XP & +${results.pointsAwarded.coins} Coins Earned!`,
              description: 'Great job completing your LBI assessment. Keep it up!',
            });
          }, 1200);
        }
        onComplete(results);
      } else {
        toast({ title: "Error", description: "Failed to submit assessment", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit assessment", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const currentQuestion = questions[currentIndex];

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", dk ? "bg-[#0c1220]" : "bg-[#f0f4f8]")}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: dk ? 'rgba(78,205,196,0.15)' : 'rgba(11,60,93,0.1)' }}>
            <Brain className="w-10 h-10 text-[#4ECDC4]" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
          <p className={cn("text-lg font-medium", dk ? "text-white" : "text-[#0B3C5D]")}>Preparing your assessment</p>
          <p className={cn("text-sm mt-1", dk ? "text-[#64748b]" : "text-[#94a3b8]")}>Building your personalized experience...</p>
        </div>
      </div>
    );
  }

  if (!loading && questions.length === 0) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", dk ? "bg-[#0c1220]" : "bg-[#f0f4f8]")}>
        <div className="text-center max-w-md px-6">
          <Brain className={cn("w-16 h-16 mx-auto mb-4", dk ? "text-[#475569]" : "text-[#94a3b8]")} />
          <h2 className={cn("text-xl font-semibold mb-2", dk ? "text-white" : "text-[#0B3C5D]")}>No Questions Available</h2>
          <p className={cn("mb-6", dk ? "text-[#64748b]" : "text-[#94a3b8]")}>Please try another module or check back later.</p>
          <Button onClick={onExit} className="bg-[#0B3C5D] hover:bg-[#2a3f6d]" data-testid="btn-exit-empty">Return to Modules</Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const getTimerMsg = () => {
    const m = Math.floor(elapsedTime / 60);
    if (m < 5) return "Take your time";
    if (m < 15) return "You're doing great";
    if (m < 25) return "Steady pace";
    return "No rush";
  };

  return (
    <>
      <div className={cn("min-h-screen flex flex-col", dk ? "bg-[#0c1220]" : "bg-[#f0f4f8]")}>
        {/* TOP BAR */}
        <header className={cn(
          "px-4 py-3 border-b sticky top-0 z-20",
          dk ? "bg-[#0c1220]/95 border-[#1e293b] backdrop-blur-md" : "bg-white/95 border-[#e2e8f0] backdrop-blur-md"
        )}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#0B3C5D]">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={cn("font-bold text-sm", dk ? "text-white" : "text-[#0B3C5D]")}>LBI Assessment</h1>
                <p className={cn("text-[11px]", dk ? "text-[#64748b]" : "text-[#94a3b8]")}>Level {difficultyLevel} · {ageGroup}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {onThemeToggle && (
                <button onClick={onThemeToggle} className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", dk ? "hover:bg-[#1e293b] text-[#64748b]" : "hover:bg-[#f1f5f9] text-[#94a3b8]")} data-testid="btn-theme-toggle-assessment">
                  {dk ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", dk ? "bg-[#1e293b]" : "bg-[#f1f5f9]")}>
                <Clock className={cn("w-4 h-4", dk ? "text-[#4ECDC4]" : "text-[#0B3C5D]")} />
                <span className={cn("font-mono text-sm font-medium", dk ? "text-white" : "text-[#0B3C5D]")}>{formatTime(elapsedTime)}</span>
                <span className={cn("text-[10px] hidden sm:inline", dk ? "text-[#64748b]" : "text-[#94a3b8]")}>{getTimerMsg()}</span>
              </div>
              {/* <Button variant="outline" size="sm" onClick={onExit} className={cn("rounded-lg text-xs gap-1.5", dk ? "border-[#1e293b] text-[#94a3b8] hover:bg-[#1e293b]" : "border-[#e2e8f0]")} data-testid="btn-save-exit">
                <Save className="w-3.5 h-3.5" /> Save & Exit
              </Button> */}
            </div>
          </div>
        </header>

        {/* MAIN CONTENT - TWO COLUMN LAYOUT */}
        <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full">
          {/* LEFT SIDEBAR - Progress & Navigator */}
          <aside className={cn(
            "lg:w-72 xl:w-80 lg:border-r lg:min-h-0 p-4 lg:p-6 lg:sticky lg:top-[57px] lg:self-start lg:max-h-[calc(100vh-57px)] lg:overflow-y-auto",
            dk ? "border-[#1e293b]" : "border-[#e2e8f0]"
          )}>
            {/* Progress Section */}
            <div className={cn("rounded-xl p-4 mb-4", dk ? "bg-[#141d2e]" : "bg-white")} style={{ boxShadow: dk ? 'none' : '0 1px 3px rgba(11,60,93,0.08)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-xs font-semibold uppercase tracking-wider", dk ? "text-[#64748b]" : "text-[#94a3b8]")}>Progress</span>
                <span className={cn("text-sm font-bold", dk ? "text-[#4ECDC4]" : "text-[#0B3C5D]")}>{Math.round(progress)}%</span>
              </div>
              <div className={cn("w-full h-3 rounded-full overflow-hidden", dk ? "bg-[#1e293b]" : "bg-[#e2e8f0]")}>
                <div className="h-full rounded-full transition-all duration-700 ease-out bg-[#4ECDC4]" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                {[0, 25, 50, 75, 100].map(m => (
                  <div key={m} className="flex flex-col items-center">
                    <div className={cn("w-1.5 h-1.5 rounded-full transition-all", progress >= m ? "bg-[#4ECDC4]" : dk ? "bg-[#1e293b]" : "bg-[#cbd5e1]")} />
                  </div>
                ))}
              </div>
              <p className={cn("text-[10px] text-center mt-2", dk ? "text-[#475569]" : "text-[#94a3b8]")}>
                {answeredCount} of {questions.length} answered
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 mb-4">
              <div className={cn("rounded-xl p-3 flex items-center gap-3", dk ? "bg-[#141d2e]" : "bg-white")} style={{ boxShadow: dk ? 'none' : '0 1px 3px rgba(11,60,93,0.08)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#4ECDC4]/15">
                  <CheckCircle className="w-4 h-4 text-[#4ECDC4]" />
                </div>
                <div>
                  <p className={cn("text-lg font-bold leading-none", dk ? "text-white" : "text-[#0B3C5D]")}>{answeredCount}</p>
                  <p className={cn("text-[10px]", dk ? "text-[#475569]" : "text-[#94a3b8]")}>Answered</p>
                </div>
              </div>
              <div className={cn("rounded-xl p-3 flex items-center gap-3", dk ? "bg-[#141d2e]" : "bg-white")} style={{ boxShadow: dk ? 'none' : '0 1px 3px rgba(11,60,93,0.08)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#0B3C5D]/15">
                  <Target className="w-4 h-4 text-[#0B3C5D]" />
                </div>
                <div>
                  <p className={cn("text-lg font-bold leading-none", dk ? "text-white" : "text-[#0B3C5D]")}>{questions.length - answeredCount}</p>
                  <p className={cn("text-[10px]", dk ? "text-[#475569]" : "text-[#94a3b8]")}>Remaining</p>
                </div>
              </div>
              <div className={cn("rounded-xl p-3 flex items-center gap-3", dk ? "bg-[#141d2e]" : "bg-white")} style={{ boxShadow: dk ? 'none' : '0 1px 3px rgba(11,60,93,0.08)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EDF2F7]/15">
                  <Flag className="w-4 h-4 text-[#4ECDC4]" />
                </div>
                <div>
                  <p className={cn("text-lg font-bold leading-none", dk ? "text-white" : "text-[#0B3C5D]")}>{flagged.size}</p>
                  <p className={cn("text-[10px]", dk ? "text-[#475569]" : "text-[#94a3b8]")}>Flagged</p>
                </div>
              </div>
            </div>

            {/* Question Navigator */}
            <div className={cn("rounded-xl p-4", dk ? "bg-[#141d2e]" : "bg-white")} style={{ boxShadow: dk ? 'none' : '0 1px 3px rgba(11,60,93,0.08)' }}>
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-3", dk ? "text-[#64748b]" : "text-[#94a3b8]")}>Questions</p>
              <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
                {questions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isCurrent = idx === currentIndex;
                  const isFlagged = flagged.has(q.id);
                  return (
                    <button
                      key={q.id}
                      onClick={() => { recordQuestionTime(); setIsTransitioning(true); setTimeout(() => { setCurrentIndex(idx); setIsTransitioning(false); }, 180); }}
                      className={cn(
                        "w-full aspect-square rounded-lg text-xs font-bold transition-all duration-200 relative flex items-center justify-center",
                        isCurrent && "bg-[#0B3C5D] text-white shadow-lg ring-2 ring-[#4ECDC4] ring-offset-1",
                        isCurrent && (dk ? "ring-offset-[#141d2e]" : "ring-offset-white"),
                        !isCurrent && isAnswered && (dk ? "bg-[#4ECDC4]/20 text-[#4ECDC4]" : "bg-[#4ECDC4]/15 text-[#4ECDC4]"),
                        !isCurrent && !isAnswered && (dk ? "bg-[#1e293b] text-[#475569] hover:bg-[#243044]" : "bg-[#f1f5f9] text-[#94a3b8] hover:bg-[#e2e8f0]"),
                      )}
                      data-testid={`nav-question-${idx + 1}`}
                      title={`Q${idx + 1} — ${q.subModuleName}${isAnswered ? ' (Answered)' : isFlagged ? ' (Flagged)' : ''}`}
                    >
                      {idx + 1}
                      {isFlagged && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#4ECDC4] rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT - Question Area */}
          <main className="flex-1 p-4 lg:p-8 min-w-0">
            <div className={cn("transition-all duration-200", isTransitioning ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0")}>
              {/* Question Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                    dk ? "bg-[#4ECDC4]/15 text-[#4ECDC4]" : "bg-[#4ECDC4]/10 text-[#4ECDC4]"
                  )}>
                    {currentQuestion.subModuleName}
                  </span>
                </div>
                <button
                  onClick={handleToggleFlag}
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-all",
                    flagged.has(currentQuestion.id)
                      ? "bg-[#EDF2F7]/15 text-[#4ECDC4]"
                      : dk ? "text-[#475569] hover:bg-[#1e293b]" : "text-[#94a3b8] hover:bg-[#f1f5f9]"
                  )}
                  data-testid="btn-flag-question"
                >
                  <Flag className="w-3 h-3" />
                  {flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag'}
                </button>
              </div>

              <p className={cn("text-xs mb-4", dk ? "text-[#475569]" : "text-[#94a3b8]")}>
                Question {currentIndex + 1} of {questions.length}
              </p>

              {/* Question Card */}
              <div className={cn(
                "rounded-2xl p-6 sm:p-8 mb-6 border",
                dk ? "bg-[#141d2e] border-[#1e293b]" : "bg-white border-[#e2e8f0]"
              )} style={{ boxShadow: dk ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(11,60,93,0.06)' }}>
                {currentQuestion.passageText && (
                  <div className={cn("mb-6 p-4 rounded-xl border-l-4 border-[#4ECDC4]", dk ? "bg-[#1e293b]" : "bg-[#f8f9fc]")}>
                    <p className={cn("text-sm leading-relaxed", dk ? "text-[#94a3b8]" : "text-[#475569]")}>{currentQuestion.passageText}</p>
                  </div>
                )}

                <h2 className={cn("text-xl sm:text-2xl font-bold leading-relaxed mb-2", dk ? "text-white" : "text-[#1e293b]")} data-testid="question-text">
                  {currentQuestion.questionText}
                </h2>
                <p className={cn("text-xs mb-8", dk ? "text-[#475569]" : "text-[#94a3b8]")}>Select the option that best describes you</p>

                {/* Options */}
                <div className="space-y-3">
                  {currentQuestion.options.map((option, optIdx) => {
                    const isSelected = answers[currentQuestion.id] === option.key;
                    const isHovered = hoveredOption === optIdx;
                    const emoji = EMOTIONAL_EMOJIS[optIdx];
                    return (
                      <button
                        key={option.key}
                        onClick={() => handleSelectAnswer(currentQuestion.id, option.key)}
                        onMouseEnter={() => setHoveredOption(optIdx)}
                        onMouseLeave={() => setHoveredOption(null)}
                        className={cn(
                          "w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 group",
                          isSelected && "border-[#4ECDC4]",
                          isSelected && (dk ? "bg-[#4ECDC4]/10" : "bg-[#4ECDC4]/5"),
                          !isSelected && (dk ? "border-[#1e293b] hover:border-[#0B3C5D]/50 hover:bg-[#1a2332]" : "border-[#e2e8f0] hover:border-[#0B3C5D]/30 hover:bg-[#f8f9fc]"),
                        )}
                        style={isSelected ? { boxShadow: `0 0 0 1px rgba(78,205,196,0.2), 0 4px 16px rgba(78,205,196,${dk ? '0.15' : '0.08'})` } : undefined}
                        data-testid={`option-${option.key}`}
                        aria-label={`Option ${option.key}: ${option.text}`}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold transition-all",
                          isSelected ? "bg-[#4ECDC4] text-white" : dk ? "bg-[#1e293b] text-[#64748b] group-hover:bg-[#0B3C5D]/20 group-hover:text-[#0B3C5D]" : "bg-[#f1f5f9] text-[#94a3b8] group-hover:bg-[#0B3C5D]/10 group-hover:text-[#0B3C5D]"
                        )}>
                          {option.key}
                        </div>
                        <span className={cn("flex-1 font-medium text-sm sm:text-base", dk ? "text-[#e2e8f0]" : "text-[#334155]")}>{option.text}</span>
                        <span className={cn(
                          "text-2xl transition-all duration-300 shrink-0",
                          (isSelected || isHovered) ? "opacity-100 scale-110" : "opacity-0 scale-75"
                        )}>
                          {emoji?.emoji}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Microcopy Feedback */}
                {selectedFeedback !== null && (
                  <div className={cn(
                    "mt-6 flex items-start gap-3 p-4 rounded-xl",
                    dk ? "bg-[#4ECDC4]/8" : "bg-[#4ECDC4]/5"
                  )} style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
                    <Lightbulb className={cn("w-5 h-5 shrink-0 mt-0.5", dk ? "text-[#4ECDC4]" : "text-[#4ECDC4]")} />
                    <p className={cn("text-sm italic", dk ? "text-[#4ECDC4]/80" : "text-[#4ECDC4]")}>
                      {MICROCOPY[selectedFeedback]}
                    </p>
                  </div>
                )}
              </div>

              {/* Encouragement */}
              <div className={cn("text-center mb-6")} style={{ animation: 'fadeSlideIn 0.5s ease-out' }}>
                <p className={cn("text-xs italic flex items-center justify-center gap-1.5", dk ? "text-[#4ECDC4]/30" : "text-[#0B3C5D]/30")}>
                  <Sparkles className="w-3 h-3" />
                  {ENCOURAGEMENTS[currentIndex % ENCOURAGEMENTS.length]}
                </p>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className={cn("rounded-xl gap-1.5 h-11 px-5", dk ? "border-[#1e293b] text-[#94a3b8] hover:bg-[#1e293b]" : "border-[#e2e8f0]")}
                  data-testid="btn-previous"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                {currentIndex === questions.length - 1 ? (
                  <Button
                    onClick={() => setShowSubmitDialog(true)}
                    className="bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#0c1220] font-bold rounded-xl gap-1.5 h-11 px-6 shadow-lg"
                    style={{ boxShadow: '0 4px 20px rgba(78,205,196,0.35)' }}
                    data-testid="btn-submit"
                  >
                    <CheckCircle className="w-4 h-4" /> Submit Assessment
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="bg-[#0B3C5D] hover:bg-[#2a3f6d] font-bold rounded-xl gap-1.5 h-11 px-6 shadow-lg"
                    style={{ boxShadow: '0 4px 20px rgba(11,60,93,0.35)' }}
                    data-testid="btn-next"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Keyboard hint */}
              <p className={cn("text-center text-[10px] mt-4", dk ? "text-[#334155]" : "text-[#cbd5e1]")}>
                Press 1–5 to select · Arrow keys to navigate
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent className={cn(
          "rounded-2xl border",
          dk ? "bg-[#141d2e] border-[#1e293b]" : "bg-white border-[#e2e8f0]"
        )} style={{ boxShadow: dk ? '0 8px 40px rgba(0,0,0,0.5)' : '0 8px 40px rgba(11,60,93,0.15)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn("flex items-center gap-2", dk ? "text-white" : "text-[#1e293b]")}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#4ECDC4]/15">
                <Shield className="w-4 h-4 text-[#4ECDC4]" />
              </div>
              Submit Assessment?
            </AlertDialogTitle>
            <AlertDialogDescription className={dk ? "text-[#64748b]" : undefined}>
              You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && (
                <span className="flex items-center gap-1.5 mt-3 text-[#4ECDC4]">
                  <AlertCircle className="w-4 h-4" />
                  {questions.length - answeredCount} question(s) remain unanswered.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={cn("rounded-xl", dk ? "bg-[#1e293b] border-[#1e293b] text-[#94a3b8] hover:bg-[#243044]" : "")}>
              Review Answers
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting} className="bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#0c1220] font-bold rounded-xl">
              {submitting ? 'Submitting...' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
