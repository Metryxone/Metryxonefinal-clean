import { useState, useEffect, useCallback, useRef } from 'react';
import { Screen } from '../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Flag,
  CheckCircle,
  AlertTriangle,
  Send,
  Zap,
  TrendingUp,
  Brain
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Difficulty = 'easy' | 'medium' | 'hard';

interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  marks: number;
  difficulty?: Difficulty;
}

interface Props {
  onNavigate: (screen: Screen) => void;
  examId?: string;
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export function ExamPlayer({ onNavigate, examId }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Adaptive engine state
  const [answerTimes, setAnswerTimes] = useState<Record<string, number>>({});
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<Difficulty>('medium');
  const [adaptiveHint, setAdaptiveHint] = useState<string | null>(null);
  const questionStartRef = useRef<number>(Date.now());
  const { toast } = useToast();

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    cardBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    headerBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    optionBg: isDarkMode ? 'bg-gray-700' : 'bg-gray-100',
    optionHover: isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200',
    optionSelected: isDarkMode ? 'bg-[#4ECDC4]/30 border-[#4ECDC4]' : 'bg-[#0B3C5D]/10 border-[#0B3C5D]',
  };

  useEffect(() => {
    const startExam = async () => {
      if (!examId) {
        toast({ title: "Error", description: "No exam selected", variant: "destructive" });
        onNavigate('student-dashboard');
        return;
      }
      
      try {
        const response = await authFetch(`/api/student/exams/${examId}/start`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to start exam');
        }
        
        const data = await response.json();
        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        setLoading(false);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        onNavigate('student-dashboard');
      }
    };
    
    startExam();
  }, [examId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleAutoSubmit = async () => {
    await submitExam(true);
  };

  const submitExam = async (isAutoSubmit = false) => {
    if (!attemptId || !examId) return;
    
    setSubmitting(true);
    try {
      const responses = Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption,
        timeSpentSeconds: answerTimes[questionId] ?? null,
      }));

      const response = await authFetch(`/api/student/exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ attemptId, responses })
      });

      if (!response.ok) {
        throw new Error('Failed to submit exam');
      }

      const result = await response.json();
      
      toast({
        title: isAutoSubmit ? "Time's Up!" : "Exam Submitted",
        description: `Score: ${result.score}/${result.totalMarks} (${result.percentage}%)`,
        variant: isAutoSubmit ? "destructive" : "default"
      });
      
      onNavigate('results-summary');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    setAnswerTimes(prev => ({ ...prev, [questionId]: elapsed }));
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));

    // Adaptive difficulty: fast answers (<20s) → increase difficulty; slow (>90s) → decrease
    setAdaptiveDifficulty(prev => {
      if (elapsed < 20) return prev === 'easy' ? 'medium' : 'hard';
      if (elapsed > 90) return prev === 'hard' ? 'medium' : 'easy';
      return prev;
    });

    // Adaptive hint: slow learners get a gentle nudge
    if (elapsed > 60) {
      setAdaptiveHint('Tip: Try eliminating the obviously wrong options first, then compare the remaining two.');
    } else {
      setAdaptiveHint(null);
    }
  };

  const handleToggleFlag = (questionId: string) => {
    setFlagged(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      questionStartRef.current = Date.now();
      setAdaptiveHint(null);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      questionStartRef.current = Date.now();
      setAdaptiveHint(null);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitDialogOpen(false);
    await submitExam(false);
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = flagged.size;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const currentQuestion = questions[currentIndex];
  const isAnswered = currentQuestion && answers[currentQuestion.id];
  const isFlagged = currentQuestion && flagged.has(currentQuestion.id);

  const getTimeColor = () => {
    if (timeRemaining < 300) return 'text-red-400';
    if (timeRemaining < 600) return 'text-amber-400';
    return 'text-white';
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-[#4ECDC4] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={theme.textMuted}>Loading exam...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col`}>
      <header className={`${theme.headerBg} px-4 py-3 sticky top-0 z-10 border-b ${theme.cardBorder}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`font-semibold ${theme.text}`}>Mathematics Mid-Term</h1>
            <p className={`text-xs ${theme.textMuted}`}>Question {currentIndex + 1} of {questions.length}</p>
          </div>
          <div className={`flex items-center gap-2 ${getTimeColor()}`}>
            <Clock size={18} />
            <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
          </div>
        </div>
        <Progress value={progress} className={`mt-3 h-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {currentQuestion && (
          <div className="space-y-6">
            <Card className={`${theme.cardBg} ${theme.cardBorder}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${theme.textMuted}`}>
                      Q{currentIndex + 1} · {currentQuestion.marks} marks
                    </span>
                    {/* Adaptive difficulty badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: adaptiveDifficulty === 'easy' ? '#4ECDC420' : adaptiveDifficulty === 'hard' ? '#0B3C5D20' : '#6B8DD620',
                        color: adaptiveDifficulty === 'easy' ? '#2a9d6e' : adaptiveDifficulty === 'hard' ? '#0B3C5D' : '#5a70b5',
                      }}>
                      {adaptiveDifficulty === 'easy' && <><Zap size={9} /> Easy</>}
                      {adaptiveDifficulty === 'medium' && <><TrendingUp size={9} /> Medium</>}
                      {adaptiveDifficulty === 'hard' && <><Brain size={9} /> Hard</>}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${isFlagged ? 'text-amber-400' : theme.textMuted} hover:text-amber-400`}
                    onClick={() => handleToggleFlag(currentQuestion.id)}
                    data-testid="button-flag"
                  >
                    <Flag size={16} className="mr-1" />
                    {isFlagged ? 'Flagged' : 'Flag'}
                  </Button>
                </div>
                <p className={`text-lg leading-relaxed ${theme.text}`}>{currentQuestion.text}</p>

                {/* Adaptive hint */}
                {adaptiveHint && !answers[currentQuestion.id] && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ background: '#4ECDC415', border: '1px solid #4ECDC440' }}>
                    <Brain size={13} style={{ color: '#4ECDC4', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-[11px] leading-relaxed" style={{ color: '#0B3C5D' }}>{adaptiveHint}</p>
                  </div>
                )}

                {/* Per-question time spent (shown after answering) */}
                {answers[currentQuestion.id] && answerTimes[currentQuestion.id] !== undefined && (
                  <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: '#4ECDC4' }}>
                    <Clock size={9} />
                    Answered in {answerTimes[currentQuestion.id]}s
                    {answerTimes[currentQuestion.id] < 20 && ' · ⚡ Quick'}
                    {answerTimes[currentQuestion.id] > 90 && ' · 🐢 Take your time on next ones'}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[currentQuestion.id] === option.id;
                return (
                  <button
                    key={option.id}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      isSelected 
                        ? theme.optionSelected
                        : `${theme.cardBg} ${theme.cardBorder} ${theme.text} ${theme.optionHover}`
                    }`}
                    onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                    data-testid={`option-${option.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isSelected 
                          ? 'bg-[#4ECDC4] text-white' 
                          : isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{option.text}</span>
                      {isSelected && <CheckCircle size={18} className="ml-auto text-[#4ECDC4]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <div className={`${theme.headerBg} border-t ${theme.cardBorder} p-4`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 text-sm">
            <span className="text-[#4ECDC4]">
              <CheckCircle size={14} className="inline mr-1" />
              {answeredCount} answered
            </span>
            <span className={theme.textMuted}>
              {unansweredCount} remaining
            </span>
            {flaggedCount > 0 && (
              <span className="text-amber-400">
                <Flag size={14} className="inline mr-1" />
                {flaggedCount} flagged
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <Button
            variant="outline"
            className={`flex-1 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            data-testid="button-previous"
          >
            <ChevronLeft size={18} className="mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            className={`flex-1 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            data-testid="button-next"
          >
            Next
            <ChevronRight size={18} className="ml-1" />
          </Button>
        </div>

        <Button
          className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
          onClick={() => setIsSubmitDialogOpen(true)}
          data-testid="button-submit-exam"
        >
          <Send size={16} className="mr-2" />
          Submit Exam
        </Button>
      </div>

      <div className={`${theme.headerBg} border-t ${theme.cardBorder} p-4`}>
        <p className={`text-xs ${theme.textMuted} mb-3 text-center`}>Question Navigator</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {questions.map((q, idx) => {
            const isActive = idx === currentIndex;
            const hasAnswer = answers[q.id];
            const hasFlagged = flagged.has(q.id);
            
            return (
              <button
                key={q.id}
                className={`h-8 w-8 rounded text-sm font-medium transition-all ${
                  isActive
                    ? `ring-2 ring-[#4ECDC4] ring-offset-2 ${isDarkMode ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                    : ''
                } ${
                  hasAnswer
                    ? 'bg-[#4ECDC4] text-white'
                    : hasFlagged
                    ? 'bg-amber-500 text-white'
                    : isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                }`}
                onClick={() => setCurrentIndex(idx)}
                data-testid={`nav-question-${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className={`${theme.cardBg} ${theme.cardBorder} ${theme.text}`}>
          <DialogHeader>
            <DialogTitle className={theme.text}>Submit Exam?</DialogTitle>
            <DialogDescription className={theme.textMuted}>
              Are you sure you want to submit your exam? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className={theme.textMuted}>Answered</span>
              <span className="text-[#4ECDC4] font-medium">{answeredCount}/{questions.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={theme.textMuted}>Unanswered</span>
              <span className={unansweredCount > 0 ? 'text-amber-400 font-medium' : 'font-medium'}>{unansweredCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={theme.textMuted}>Flagged for review</span>
              <span className="font-medium">{flaggedCount}</span>
            </div>
            {unansweredCount > 0 && (
              <div className="mt-4 p-3 bg-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-300">
                  You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. 
                  Are you sure you want to submit?
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSubmitDialogOpen(false)}
              className={isDarkMode ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-100"}
            >
              Continue Exam
            </Button>
            <Button 
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
              onClick={handleSubmit}
              data-testid="button-confirm-submit"
            >
              Submit Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
