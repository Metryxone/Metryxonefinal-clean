import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Target,
  BookOpen,
  TrendingUp,
  Star
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface TestResult {
  marksObtained: number;
  totalMarks: number;
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  completedAt: string;
  testTitle?: string;
  subject?: string;
}

interface StudentParentTestResultsProps {
  assignmentId: string;
  onBack: () => void;
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export function StudentParentTestResults({ assignmentId, onBack }: StudentParentTestResultsProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await authFetch(`/api/student/tests/${assignmentId}/result`);

        if (!response.ok) {
          throw new Error('Failed to load results');
        }

        const data = await response.json();
        setResult(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
        setLoading(false);
      }
    };

    fetchResult();
  }, [assignmentId]);

  const getGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-teal-400', bg: 'bg-teal-500/20' };
    if (score >= 80) return { grade: 'A', color: 'text-teal-400', bg: 'bg-teal-500/20' };
    if (score >= 70) return { grade: 'B+', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (score >= 50) return { grade: 'C', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (score >= 40) return { grade: 'D', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { grade: 'F', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const getEncouragement = (score: number) => {
    if (score >= 90) return "Outstanding performance! Keep up the excellent work!";
    if (score >= 80) return "Great job! You're doing really well.";
    if (score >= 70) return "Good effort! A little more practice will help you improve.";
    if (score >= 60) return "Keep going! Review the topics and you'll do better next time.";
    if (score >= 50) return "Don't give up! Practice makes perfect.";
    return "Keep trying! Talk to your parent/teacher for extra help.";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4ECDC4] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-gray-800 border-gray-700 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Results</h2>
            <p className="text-gray-400 mb-4">{error || "Results not found"}</p>
            <Button onClick={onBack} variant="outline" className="border-gray-600">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gradeInfo = getGrade(result.score);
  const totalQuestions = result.correctAnswers + result.incorrectAnswers;

  return (
    <div className="min-h-screen bg-gray-900 text-white" data-testid="student-parent-test-results">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 z-10 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="back-button"
            className="text-gray-400"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold text-sm" data-testid="result-title">Test Results</h1>
            {result.testTitle && (
              <p className="text-xs text-gray-400">{result.testTitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Card className={`${gradeInfo.bg} border-0`}>
          <CardContent className="pt-6">
            <div className="text-center">
              <Trophy className={`h-16 w-16 ${gradeInfo.color} mx-auto mb-4`} />
              <div className={`text-6xl font-bold ${gradeInfo.color} mb-2`} data-testid="grade">
                {gradeInfo.grade}
              </div>
              <p className="text-gray-400 text-lg mb-4" data-testid="score">
                Score: {result.score}%
              </p>
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <BookOpen className="h-4 w-4" />
                <span>{result.subject || 'Test'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-white" data-testid="marks-obtained">
                {result.marksObtained}
              </div>
              <p className="text-sm text-gray-400">Marks Obtained</p>
              <p className="text-xs text-gray-500 mt-1">out of {result.totalMarks}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-[#4ECDC4]" data-testid="correct-count">
                {result.correctAnswers}
              </div>
              <p className="text-sm text-gray-400">Correct Answers</p>
              <p className="text-xs text-gray-500 mt-1">out of {totalQuestions}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Accuracy</span>
                <span className="text-gray-300">{result.score}%</span>
              </div>
              <Progress value={result.score} className="h-3 bg-gray-700" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-teal-500/20">
                  <CheckCircle2 className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{result.correctAnswers}</p>
                  <p className="text-xs text-gray-400">Correct</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/20">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{result.incorrectAnswers}</p>
                  <p className="text-xs text-gray-400">Incorrect</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0B3C5D]/20/20 border-[#4ECDC4]/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-[#4ECDC4]/20">
                <Star className="h-6 w-6 text-[#4ECDC4]" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Encouragement</h3>
                <p className="text-gray-300" data-testid="encouragement">
                  {getEncouragement(result.score)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <TrendingUp className="h-4 w-4" />
              <span>
                Completed on {new Date(result.completedAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="pt-4">
          <Button 
            onClick={onBack}
            data-testid="done-button"
            className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}