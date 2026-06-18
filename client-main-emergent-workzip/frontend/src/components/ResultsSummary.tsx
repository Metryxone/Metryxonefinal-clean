import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  TrendingUp,
  Award,
  BookOpen,
  Home
} from 'lucide-react';
import { SideMenu } from "./SideMenu";

interface Props {
  onNavigate: (screen: Screen) => void;
  examId?: string;
}

interface ResultData {
  examTitle: string;
  subject: string;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTaken: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  grade: string;
  rank?: string;
  topicsPerformance: {
    topic: string;
    correct: number;
    total: number;
    percentage: number;
  }[];
}

export function ResultsSummary({ onNavigate, examId }: Props) {
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false); // Start with light mode

  // Theme colors based on mode
  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    cardBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    headerBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
  };

  useEffect(() => {
    const mockResult: ResultData = {
      examTitle: 'Mathematics Mid-Term',
      subject: 'Mathematics',
      score: 85,
      totalMarks: 100,
      percentage: 85,
      timeTaken: '42 min',
      totalQuestions: 25,
      correctAnswers: 21,
      wrongAnswers: 3,
      unanswered: 1,
      grade: 'A',
      rank: '5th of 42',
      topicsPerformance: [
        { topic: 'Algebra', correct: 8, total: 10, percentage: 80 },
        { topic: 'Geometry', correct: 7, total: 8, percentage: 87.5 },
        { topic: 'Trigonometry', correct: 4, total: 4, percentage: 100 },
        { topic: 'Statistics', correct: 2, total: 3, percentage: 66.7 }
      ]
    };
    
    setTimeout(() => {
      setResult(mockResult);
      setLoading(false);
    }, 500);
  }, []);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-teal-400';
      case 'B+':
      case 'B':
        return 'text-blue-400';
      case 'C+':
      case 'C':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-teal-400';
    if (percentage >= 60) return 'text-blue-400';
    if (percentage >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-teal-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-[#4ECDC4] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={theme.textMuted}>Loading results...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <p className={theme.textMuted}>No results found</p>
      </div>
    );
  }

  const handleMenuSelect = (itemId: string) => {
    if (itemId === 'dashboard') onNavigate('student-dashboard');
    else if (itemId === 'exams') onNavigate('student-exam-list');
    else if (itemId === 'lbi') onNavigate('student-exam-list');
    else if (itemId === 'progress') onNavigate('student-dashboard');
    else if (itemId === 'profile') onNavigate('student-dashboard');
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex`}>
      {/* Desktop Sidebar - Fixed Position */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-40">
        <SideMenu
          role="student"
          activeItem="exams"
          onMenuSelect={handleMenuSelect}
          onLogout={() => onNavigate('login')}
        />
      </div>

      <div className="flex-1 md:ml-64">
        <header className={`${theme.headerBg} px-4 py-3 sticky top-0 z-10 border-b ${theme.cardBorder}`}>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`${theme.textMuted} ${theme.hoverBg} -ml-2`}
              onClick={() => onNavigate('student-exam-list')}
              data-testid="button-back"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="font-semibold">Exam Results</h1>
              <p className="text-xs text-gray-400">{result.examTitle}</p>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <Card className="bg-[#4ECDC4]/20/20 border-0 overflow-hidden" data-testid="result-summary-card">
          <CardContent className="p-6 text-center relative">
            <div className="absolute top-4 right-4">
              <Trophy className="h-8 w-8 text-amber-400 opacity-50" />
            </div>
            
            <div className="mb-4">
              <p className={`text-4xl md:text-6xl font-bold ${getGradeColor(result.grade)}`} data-testid="text-grade">
                {result.grade}
              </p>
              <p className={`${theme.textMuted} mt-1`}>Grade</p>
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`text-2xl md:text-4xl font-bold ${getPercentageColor(result.percentage)}`} data-testid="text-score">
                {result.score}
              </span>
              <span className={`text-lg md:text-2xl ${theme.textMuted}`}>/ {result.totalMarks}</span>
            </div>

            <div className="flex justify-center gap-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${theme.text}`} data-testid="text-percentage">{result.percentage}%</p>
                <p className={`text-xs ${theme.textMuted}`}>Score</p>
              </div>
              {result.rank && (
                <div className="text-center">
                  <p className={`text-2xl font-bold ${theme.text}`} data-testid="text-rank">{result.rank}</p>
                  <p className={`text-xs ${theme.textMuted}`}>Rank</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className={`${theme.cardBg} ${theme.cardBorder}`} data-testid="kpi-correct">
            <CardContent className="p-3 text-center">
              <CheckCircle className="h-5 w-5 mx-auto mb-1 text-teal-400" />
              <p className={`text-xl font-bold ${theme.text}`} data-testid="value-correct">{result.correctAnswers}</p>
              <p className={`text-xs ${theme.textMuted}`}>Correct</p>
            </CardContent>
          </Card>
          <Card className={`${theme.cardBg} ${theme.cardBorder}`} data-testid="kpi-wrong">
            <CardContent className="p-3 text-center">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-400" />
              <p className={`text-xl font-bold ${theme.text}`} data-testid="value-wrong">{result.wrongAnswers}</p>
              <p className={`text-xs ${theme.textMuted}`}>Wrong</p>
            </CardContent>
          </Card>
          <Card className={`${theme.cardBg} ${theme.cardBorder}`} data-testid="kpi-time">
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-blue-400" />
              <p className={`text-xl font-bold ${theme.text}`} data-testid="value-time">{result.timeTaken}</p>
              <p className={`text-xs ${theme.textMuted}`}>Time</p>
            </CardContent>
          </Card>
        </div>

        <Card className={`${theme.cardBg} ${theme.cardBorder}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base flex items-center gap-2 ${theme.text}`}>
              <TrendingUp size={18} className="text-[#4ECDC4]" />
              Topic-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.topicsPerformance.map((topic, idx) => (
              <div key={idx} data-testid={`topic-${idx}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm ${theme.text}`}>{topic.topic}</span>
                  <span className={`text-sm font-medium ${getPercentageColor(topic.percentage)}`}>
                    {topic.correct}/{topic.total} ({Math.round(topic.percentage)}%)
                  </span>
                </div>
                <div className={`h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                  <div 
                    className={`h-full ${getProgressColor(topic.percentage)} transition-all duration-500`}
                    style={{ width: `${topic.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={`${theme.cardBg} ${theme.cardBorder}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base flex items-center gap-2 ${theme.text}`}>
              <Target size={18} className="text-amber-400" />
              Areas to Improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.topicsPerformance
                .filter(t => t.percentage < 80)
                .sort((a, b) => a.percentage - b.percentage)
                .slice(0, 3)
                .map((topic, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-3 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}
                    data-testid={`improvement-${idx}`}
                  >
                    <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <BookOpen size={16} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${theme.text}`}>{topic.topic}</p>
                      <p className={`text-xs ${theme.textMuted}`}>
                        {topic.total - topic.correct} question{topic.total - topic.correct !== 1 ? 's' : ''} missed
                      </p>
                    </div>
                    <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                      {Math.round(topic.percentage)}%
                    </Badge>
                  </div>
                ))}
              {result.topicsPerformance.filter(t => t.percentage < 80).length === 0 && (
                <div className="text-center py-4">
                  <Award className="h-8 w-8 mx-auto mb-2 text-[#4ECDC4]" />
                  <p className={`text-sm ${theme.textMuted}`}>Great job! You performed well in all topics.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 pb-6">
          <Button 
            className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            onClick={() => onNavigate('student-exam-list')}
            data-testid="button-back-to-exams"
          >
            Back to Exams
          </Button>
          <Button 
            variant="outline"
            className={`w-full ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            onClick={() => onNavigate('student-dashboard')}
            data-testid="button-go-to-dashboard"
          >
            <Home size={16} className="mr-2" />
            Go to Dashboard
          </Button>
        </div>
      </main>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
