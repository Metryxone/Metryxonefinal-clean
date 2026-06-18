import React, { useState, useEffect, useCallback } from "react";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Flag, 
  Send, 
  CheckCircle2, 
  
  XCircle,
  AlertTriangle,
  BookOpen
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface Question {
  id: string;
  questionText: string;
  questionType: "mcq" | "true_false" | "short_answer";
  options?: string[];
  marks: number;
}

interface TestData {
  assignmentId: string;
  testId: string;
  title: string;
  subject: string;
  duration: number;
  totalMarks: number;
  questions: Question[];
}

interface StudentParentTestPlayerProps {
  assignmentId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function StudentParentTestPlayer({ assignmentId, onComplete, onBack }: StudentParentTestPlayerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [testData, setTestData] = useState<TestData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const response = await authFetch(`/api/student/tests/${assignmentId}/start`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to load test');
        }

        const data = await response.json();
        setTestData(data);
        setTimeRemaining(data.duration * 60);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test');
        setLoading(false);
      }
    };

    fetchTest();
  }, [assignmentId]);

  useEffect(() => {
    if (timeRemaining <= 0 || !testData) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, testData]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const toggleFlag = () => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestionIndex)) {
        newSet.delete(currentQuestionIndex);
      } else {
        newSet.add(currentQuestionIndex);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!testData) return;

    setIsSubmitting(true);
    setShowSubmitDialog(false);

    try {
      const response = await authFetch(`/api/student/tests/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers })
      });

      if (!response.ok) {
        throw new Error('Failed to submit test');
      }

      toast({
        title: "Test Submitted",
        description: "Your answers have been submitted successfully.",
      });

      onComplete();
    } catch (err) {
      toast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Failed to submit test",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4ECDC4] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading test...</p>
        </div>
      </div>
    );
  }

  if (error || !testData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-gray-800 border-gray-700 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Test</h2>
            <p className="text-gray-400 mb-4">{error || "Test not found"}</p>
            <Button onClick={onBack} variant="outline" className="border-gray-600">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = testData.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / testData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-900 text-white" data-testid="student-parent-test-player">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 z-10 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-[#4ECDC4]" />
            <div>
              <h1 className="font-semibold text-sm" data-testid="test-title">{testData.title}</h1>
              <p className="text-xs text-gray-400">{testData.subject}</p>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            timeRemaining < 300 ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'
          }`}>
            <Clock className="h-4 w-4" />
            <span className="font-mono text-sm" data-testid="test-timer">{formatTime(timeRemaining)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Question {currentQuestionIndex + 1} of {testData.questions.length}
          </span>
          <span className="text-gray-400">
            {answeredCount}/{testData.questions.length} answered
          </span>
        </div>
        
        <Progress value={progress} className="h-2 bg-gray-700" />

        <div className="flex gap-2 overflow-x-auto py-2">
          {testData.questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentQuestionIndex(idx)}
              data-testid={`question-nav-${idx}`}
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                idx === currentQuestionIndex
                  ? 'bg-[#4ECDC4] text-white'
                  : answers[testData.questions[idx].id]
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                  : flaggedQuestions.has(idx)
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {idx + 1}
              {flaggedQuestions.has(idx) && (
                <Flag className="h-2 w-2 absolute -top-1 -right-1" />
              )}
            </button>
          ))}
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-gray-600 text-gray-400">
                {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFlag}
                data-testid="flag-question"
                className={flaggedQuestions.has(currentQuestionIndex) ? 'text-yellow-400' : 'text-gray-400'}
              >
                <Flag className="h-4 w-4 mr-1" />
                {flaggedQuestions.has(currentQuestionIndex) ? 'Flagged' : 'Flag'}
              </Button>
            </div>
            <CardTitle className="text-lg text-white mt-2" data-testid="question-text">
              {currentQuestion.questionText}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentQuestion.questionType === 'mcq' && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-3"
              >
                {currentQuestion.options.map((option, idx) => (
                  <div
                    key={idx}
                    data-testid={`option-${idx}`}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                      answers[currentQuestion.id] === option
                        ? 'border-[#4ECDC4] bg-[#4ECDC4]/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                    }`}
                  >
                    <RadioGroupItem value={option} id={`option-${idx}`} />
                    <Label htmlFor={`option-${idx}`} className="text-gray-200 cursor-pointer flex-1">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.questionType === 'true_false' && (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-3"
              >
                {['True', 'False'].map((option) => (
                  <div
                    key={option}
                    data-testid={`option-${option.toLowerCase()}`}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                      answers[currentQuestion.id] === option
                        ? 'border-[#4ECDC4] bg-[#4ECDC4]/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                    }`}
                  >
                    <RadioGroupItem value={option} id={`tf-${option}`} />
                    <Label htmlFor={`tf-${option}`} className="text-gray-200 cursor-pointer flex-1">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.questionType === 'short_answer' && (
              <Textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Type your answer here..."
                data-testid="short-answer-input"
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 min-h-[120px]"
              />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            data-testid="prev-question"
            className="border-gray-600"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          {currentQuestionIndex < testData.questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(testData.questions.length - 1, prev + 1))}
              data-testid="next-question"
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => setShowSubmitDialog(true)}
              data-testid="submit-test"
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Test
            </Button>
          )}
        </div>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-teal-500/20 border border-teal-500/30"></div>
                  <span className="text-gray-400">Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30"></div>
                  <span className="text-gray-400">Flagged ({flaggedQuestions.size})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-700"></div>
                  <span className="text-gray-400">Unanswered ({testData.questions.length - answeredCount})</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Submit Test?</DialogTitle>
            <DialogDescription className="text-gray-400">
              You have answered {answeredCount} out of {testData.questions.length} questions.
              {testData.questions.length - answeredCount > 0 && (
                <span className="text-yellow-400 block mt-2">
                  Warning: {testData.questions.length - answeredCount} question(s) are unanswered.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="text-center p-4 bg-teal-500/10 rounded-lg border border-teal-500/20">
              <CheckCircle2 className="h-8 w-8 text-teal-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-teal-400">{answeredCount}</p>
              <p className="text-xs text-gray-400">Answered</p>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-400">{testData.questions.length - answeredCount}</p>
              <p className="text-xs text-gray-400">Unanswered</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)} className="border-gray-600">
              Review Answers
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            >
              {isSubmitting ? 'Submitting...' : 'Confirm Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}