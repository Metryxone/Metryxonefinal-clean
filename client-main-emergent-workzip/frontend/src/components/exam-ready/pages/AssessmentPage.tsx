import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, Save, Flag, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { QuestionRenderer } from '../components/QuestionRenderer';
import { CategorySwitcher } from '../components/CategorySwitcher';
import { Timer } from '../components/Timer';
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { assessmentService } from '../services/apiClient';
import type { AssessmentAttempt, AssessmentQuestion, DomainInfo } from '../types';

interface Props {
  attemptId: string;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
}

const SECONDS_PER_QUESTION = 90;

export function AssessmentPage({ attemptId, onNavigate }: Props) {
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [maxTime, setMaxTime] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [error, setError] = useState('');

  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [filterSubdomain, setFilterSubdomain] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const questionViewedAtRef = useRef<number>(Date.now());
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});

  // Build domain list from question data
  const domainMap = new Map<string, DomainInfo>();
  for (const q of questions) {
    if (q.domainCode && !domainMap.has(q.domainCode)) {
      domainMap.set(q.domainCode, {
        code: q.domainCode,
        name: q.category || q.domainCode,
        subdomains: [],
      });
    }
    if (q.domainCode && q.subdomainCode) {
      const domain = domainMap.get(q.domainCode);
      if (domain && !domain.subdomains.find((s) => s.code === q.subdomainCode)) {
        domain.subdomains.push({
          code: q.subdomainCode!,
          name: q.subcategory || q.subdomainCode!,
        });
      }
    }
  }
  const availableDomains = Array.from(domainMap.values());

  const filteredQuestions = questions.filter((q) => {
    if (filterDomain && q.domainCode !== filterDomain) return false;
    if (filterSubdomain && q.subdomainCode !== filterSubdomain) return false;
    return true;
  });

  const total = filteredQuestions.length;
  const currentQuestion = total > 0 ? filteredQuestions[currentIndex] : null;
  const answeredCount = filteredQuestions.filter((q) => answers[q.id] !== undefined).length;
  const totalAnswered = questions.filter((q) => answers[q.id] !== undefined).length;

  useEffect(() => {
    questionViewedAtRef.current = Date.now();
  }, [currentQuestion?.id]);

  // Load Attempt
  useEffect(() => {
    const loadAttempt = async () => {
      setLoading(true);
      try {
        const data = await assessmentService.getAttempt(attemptId);
        setAttempt(data.attempt);
        setQuestions(data.questions || []);

        const totalQ = (data.questions || []).length;
        const calculatedTime = totalQ * SECONDS_PER_QUESTION;
        setMaxTime(calculatedTime);
        setTimeRemaining(calculatedTime);

        if (data.answers) {
          setAnswers(data.answers);
        }
      } catch (err: any) {
        console.error('[AssessmentPage] Failed to load attempt:', err);
        if (err?.message?.includes('404') || err?.message?.includes('not found') || err?.message?.includes('Non-JSON')) {
          onNavigate('exam-ready-assessment-start');
          return;
        }
        setError(err?.message || 'Failed to load assessment');
      } finally {
        setLoading(false);
      }
    };

    loadAttempt();
    submittingRef.current = false;
  }, [attemptId]);

  // Timer
  useEffect(() => {
    if (loading || submitting || maxTime === 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowTimeUpModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitting, maxTime]);

  const handleAnswer = useCallback(
    async (questionId: string, answer: string | number) => {
      const now = Date.now();
      const timeSpent = Math.round((now - questionViewedAtRef.current) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || 0) + timeSpent,
      }));
      questionViewedAtRef.current = now;

      setAnswers((prev) => ({ ...prev, [questionId]: answer }));

      const totalTime = (questionTimes[questionId] || 0) + timeSpent;
      try {
        await assessmentService.submitAnswer(attemptId, questionId, answer, totalTime);
      } catch {
        // Offline — answer saved locally
      }
    },
    [attemptId, questionTimes]
  );

  const handlePause = useCallback(async () => {
    setSaving(true);
    try {
      await assessmentService.pause(attemptId);
    } catch {}
    setSaving(false);
    onNavigate('exam-ready');
  }, [attemptId, onNavigate]);

  const handleSubmit = useCallback(async (force = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      await assessmentService.submit(attemptId, force);
      try {
        const scoreResult = await assessmentService.score(attemptId) as any;
        if (scoreResult?.pointsAwarded) {
          sessionStorage.setItem('metryx_points_awarded', JSON.stringify(scoreResult.pointsAwarded));
        }
      } catch (scoreErr) {
        console.warn('[AssessmentPage] Score trigger failed:', scoreErr);
      }
      onNavigate('exam-ready-report-status', { attemptId });
    } catch (err: any) {
      setError(err?.message || 'Failed to submit assessment');
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, onNavigate]);

  // Auto-submit after time-up
  useEffect(() => {
    if (!showTimeUpModal) return;
    const timeout = setTimeout(() => {
      handleSubmit(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [showTimeUpModal, handleSubmit]);

  const handleToggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  }, [currentQuestion]);

  const handlePrevSwap = useCallback(async () => {
    if (currentIndex === 0 || swapping) return;

    const prevIndex = currentIndex - 1;
    const prevQuestion = filteredQuestions[prevIndex];
    if (!prevQuestion) return;

    if (answers[prevQuestion.id] !== undefined) {
      setCurrentIndex(prevIndex);
      return;
    }

    setSwapping(true);
    try {
      const result = await assessmentService.swapQuestion(attemptId, prevQuestion.id);
      if (result.success && result.newQuestion) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === result.oldQuestionId ? result.newQuestion : q))
        );
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[result.oldQuestionId];
          return next;
        });
      }
      setCurrentIndex(prevIndex);
    } catch {
      setCurrentIndex(prevIndex);
    } finally {
      setSwapping(false);
    }
  }, [attemptId, currentIndex, filteredQuestions, swapping, answers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-[#0B3C5D]" />
          <p className="text-gray-500">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4 p-8 rounded-xl bg-white shadow-lg max-w-md">
          <AlertTriangle size={48} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Failed to Load</h2>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button onClick={() => onNavigate('exam-ready')} variant="outline">Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ExamReadyHeader title="Assessment" />

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full py-6 px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Timer timeRemaining={timeRemaining} maxTime={maxTime} />
            <Button variant="outline" size="sm" onClick={handlePause} disabled={saving || submitting} data-testid="btn-save-pause">
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
              Save & Exit
            </Button>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-[#4ECDC4]">{totalAnswered}/{questions.length} answered</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-[#0B3C5D] rounded-full transition-all duration-300"
            style={{ width: `${(totalAnswered / questions.length) * 100}%` }}
          />
        </div>

        {/* Category Switcher */}
        {availableDomains.length > 0 && (
          <div className="mb-4">
            <CategorySwitcher
              domains={availableDomains}
              selectedDomain={filterDomain}
              selectedSubdomain={filterSubdomain}
              onDomainChange={(d) => { setFilterDomain(d); setCurrentIndex(0); }}
              onSubdomainChange={(s) => { setFilterSubdomain(s); setCurrentIndex(0); }}
            />
          </div>
        )}

        {/* Question Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
              {currentQuestion ? (
                <>
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="ghost" size="sm" onClick={handleToggleFlag}
                      className={flagged.has(currentQuestion.id) ? 'text-amber-500' : 'text-gray-400'}
                      data-testid="btn-flag"
                    >
                      <Flag size={18} />
                    </Button>
                  </div>

                  <QuestionRenderer
                    question={currentQuestion}
                    questionNumber={currentIndex + 1}
                    totalQuestions={total}
                    selectedAnswer={answers[currentQuestion.id] ?? null}
                    onAnswer={handleAnswer}
                  />

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    <Button
                      variant="outline" onClick={handlePrevSwap}
                      disabled={currentIndex === 0 || swapping || submitting}
                      data-testid="btn-prev"
                    >
                      {swapping ? (
                        <><Loader2 size={16} className="mr-2 animate-spin" />Swapping...</>
                      ) : (
                        <><ArrowLeft size={16} className="mr-2" />Previous</>
                      )}
                    </Button>

                    {currentIndex < total - 1 ? (
                      <Button
                        className="bg-[#0B3C5D] hover:bg-[#0B3C5D]/90"
                        onClick={() => setCurrentIndex((prev) => Math.min(total - 1, prev + 1))}
                        disabled={submitting}
                        data-testid="btn-next"
                      >
                        Next <ArrowRight size={16} className="ml-2" />
                      </Button>
                    ) : (
                      <Button
                        className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-[#0f172a]"
                        onClick={() => setShowSubmitModal(true)}
                        disabled={submitting}
                        data-testid="btn-submit"
                      >
                        {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
                        Submit Assessment
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No questions available for the selected filters.</p>
                  <Button variant="outline" className="mt-4" onClick={() => { setFilterDomain(null); setFilterSubdomain(null); }}>
                    Show All Questions
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-64">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Questions</h3>
              <div className="grid grid-cols-6 lg:grid-cols-4 gap-2">
                {filteredQuestions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 w-9 rounded-lg text-xs font-medium transition-all ${
                      idx === currentIndex
                        ? 'bg-[#0B3C5D] text-white ring-2 ring-[#0B3C5D]/30'
                        : answers[q.id] !== undefined
                          ? 'bg-[#4ECDC4] text-white'
                          : flagged.has(q.id)
                            ? 'bg-amber-100 text-amber-700 border border-amber-300'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-[#0B3C5D]" /> Current</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-[#4ECDC4]" /> Answered ({answeredCount})</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-amber-100 border border-amber-300" /> Flagged ({flagged.size})</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-gray-100 border border-gray-200" /> Unanswered ({total - answeredCount})</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Submit Assessment?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Total Questions</span><span className="font-medium text-gray-800">{questions.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Answered</span><span className="font-medium text-[#4ECDC4]">{totalAnswered}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Unanswered</span><span className="font-medium text-red-500">{questions.length - totalAnswered}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Flagged</span><span className="font-medium text-amber-500">{flagged.size}</span></div>
            </div>

            {questions.length - totalAnswered > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertTriangle size={14} />
                You must answer all {questions.length - totalAnswered} remaining question(s) before submitting.
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowSubmitModal(false)} disabled={submitting}>
                {questions.length - totalAnswered > 0 ? 'Go Back & Answer' : 'Continue Assessment'}
              </Button>
              <Button
                className="flex-1 bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-[#0f172a] disabled:opacity-50"
                onClick={() => handleSubmit(false)}
                disabled={submitting || questions.length - totalAnswered > 0}
                data-testid="btn-confirm-submit"
              >
                {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Time's up modal */}
      {showTimeUpModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Time's Up!</h3>
            <p className="text-gray-600">Your time has expired. Your answered questions will be submitted automatically.</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Answered</span><span className="font-medium text-[#4ECDC4]">{totalAnswered} of {questions.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Unanswered</span><span className="font-medium text-red-500">{questions.length - totalAnswered}</span></div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Submitting your answers...</>
              ) : (
                'Auto-submitting in a few seconds...'
              )}
            </div>
            <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => handleSubmit(true)} disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin mr-2" />}
              Submit Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
