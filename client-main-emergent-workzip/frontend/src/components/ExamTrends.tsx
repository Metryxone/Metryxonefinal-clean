import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  BarChart3, 
  Calendar,
  Target,
  Award,
  BookOpen,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface ExamTrendData {
  id: string;
  subject: string;
  examTitle: string;
  examDate: string;
  score: number;
  totalMarks: number;
  trend: 'up' | 'down' | 'stable';
  percentChange?: number;
}

interface SubjectTrend {
  subject: string;
  exams: ExamTrendData[];
  averageScore: number;
  trend: 'up' | 'down' | 'stable';
  latestScore: number;
  improvement: number;
}

interface Props {
  studentId?: string;
  childId?: string;
  isDarkMode?: boolean;
  isParentView?: boolean;
  onNavigate?: (screen: string, data?: Record<string, unknown>) => void;
}

const MOCK_EXAM_DATA: ExamTrendData[] = [
  { id: '1', subject: 'Mathematics', examTitle: 'Mid-Term Exam', examDate: '2025-12-15', score: 85, totalMarks: 100, trend: 'up', percentChange: 8 },
  { id: '2', subject: 'Mathematics', examTitle: 'Unit Test 3', examDate: '2025-11-20', score: 78, totalMarks: 100, trend: 'up', percentChange: 5 },
  { id: '3', subject: 'Mathematics', examTitle: 'Unit Test 2', examDate: '2025-10-10', score: 74, totalMarks: 100, trend: 'stable', percentChange: 0 },
  { id: '4', subject: 'Science', examTitle: 'Mid-Term Exam', examDate: '2025-12-16', score: 92, totalMarks: 100, trend: 'up', percentChange: 12 },
  { id: '5', subject: 'Science', examTitle: 'Unit Test 3', examDate: '2025-11-22', score: 82, totalMarks: 100, trend: 'down', percentChange: -3 },
  { id: '6', subject: 'Science', examTitle: 'Unit Test 2', examDate: '2025-10-12', score: 85, totalMarks: 100, trend: 'up', percentChange: 7 },
  { id: '7', subject: 'English', examTitle: 'Mid-Term Exam', examDate: '2025-12-17', score: 88, totalMarks: 100, trend: 'stable', percentChange: 1 },
  { id: '8', subject: 'English', examTitle: 'Unit Test 3', examDate: '2025-11-24', score: 87, totalMarks: 100, trend: 'up', percentChange: 5 },
  { id: '9', subject: 'Social Studies', examTitle: 'Mid-Term Exam', examDate: '2025-12-18', score: 76, totalMarks: 100, trend: 'down', percentChange: -4 },
  { id: '10', subject: 'Social Studies', examTitle: 'Unit Test 2', examDate: '2025-10-15', score: 79, totalMarks: 100, trend: 'up', percentChange: 6 },
];

export function ExamTrends({ isDarkMode = false, isParentView = false, onNavigate }: Props) {
  const [examData, setExamData] = useState<ExamTrendData[]>([]);
  const [subjectTrends, setSubjectTrends] = useState<SubjectTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('6months');

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    cardBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    hoverBg: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
  };

  useEffect(() => {
    fetchExamTrends();
  }, [timeRange]);

  const fetchExamTrends = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setExamData(MOCK_EXAM_DATA);
      
      const subjects = Array.from(new Set(MOCK_EXAM_DATA.map(e => e.subject)));
      const trends: SubjectTrend[] = subjects.map(subject => {
        const subjectExams = MOCK_EXAM_DATA.filter(e => e.subject === subject).sort(
          (a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime()
        );
        const avgScore = Math.round(subjectExams.reduce((sum, e) => sum + e.score, 0) / subjectExams.length);
        const latestScore = subjectExams[0]?.score || 0;
        const oldestScore = subjectExams[subjectExams.length - 1]?.score || 0;
        const improvement = latestScore - oldestScore;
        
        return {
          subject,
          exams: subjectExams,
          averageScore: avgScore,
          trend: improvement > 0 ? 'up' : improvement < 0 ? 'down' : 'stable',
          latestScore,
          improvement,
        };
      });
      
      setSubjectTrends(trends);
    } catch (error) {
      console.error('Error fetching exam trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-[#4ECDC4]" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'text-[#4ECDC4]';
      case 'down': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-[#4ECDC4]';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const filteredData = selectedSubject === 'all' 
    ? examData 
    : examData.filter(e => e.subject === selectedSubject);

  const overallAverage = examData.length > 0
    ? Math.round(examData.reduce((sum, e) => sum + e.score, 0) / examData.length)
    : 0;

  const overallTrend = subjectTrends.filter(s => s.trend === 'up').length > subjectTrends.length / 2 ? 'up' : 
                       subjectTrends.filter(s => s.trend === 'down').length > subjectTrends.length / 2 ? 'down' : 'stable';

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${theme.bg}`}>
        <RefreshCw className="h-8 w-8 animate-spin text-[#4ECDC4]" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${theme.bg} p-4`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${theme.text}`}>Exam Trends</h2>
          <p className={theme.textMuted}>
            {isParentView ? "Track your child's academic progress over time" : "Track your academic progress over time"}
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[150px]" data-testid="select-subject-filter">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {Array.from(new Set(examData.map(e => e.subject))).map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[130px]" data-testid="select-time-range">
              <SelectValue placeholder="6 Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">3 Months</SelectItem>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`${theme.cardBg} border ${theme.cardBorder}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Overall Average</p>
                <p className={`text-3xl font-bold ${getScoreColor(overallAverage)}`}>{overallAverage}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#0B3C5D]/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-[#0B3C5D]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`${theme.cardBg} border ${theme.cardBorder}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Overall Trend</p>
                <div className="flex items-center gap-2">
                  {getTrendIcon(overallTrend)}
                  <span className={`text-xl font-semibold ${getTrendColor(overallTrend)}`}>
                    {overallTrend === 'up' ? 'Improving' : overallTrend === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-[#4ECDC4]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`${theme.cardBg} border ${theme.cardBorder}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Total Exams</p>
                <p className={`text-3xl font-bold ${theme.text}`}>{examData.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`${theme.cardBg} border ${theme.cardBorder}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Best Subject</p>
                <p className={`text-xl font-bold ${theme.text}`}>
                  {subjectTrends.sort((a, b) => b.averageScore - a.averageScore)[0]?.subject || 'N/A'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-[rgba(11,60,93,0.08)] flex items-center justify-center">
                <Award className="h-6 w-6 text-[#0B3C5D]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={`${theme.cardBg} border ${theme.cardBorder}`}>
        <CardHeader>
          <CardTitle className={theme.text}>Subject Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subjectTrends.map((subject) => (
              <div key={subject.subject} className={`p-4 rounded-lg border ${theme.cardBorder}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-[#0B3C5D]" />
                    <span className={`font-semibold ${theme.text}`}>{subject.subject}</span>
                    <Badge variant="outline" className={getTrendColor(subject.trend)}>
                      {getTrendIcon(subject.trend)}
                      <span className="ml-1">
                        {subject.improvement > 0 ? '+' : ''}{subject.improvement}%
                      </span>
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${getScoreColor(subject.averageScore)}`}>
                      {subject.averageScore}%
                    </span>
                    <p className={`text-xs ${theme.textMuted}`}>average</p>
                  </div>
                </div>
                <Progress 
                  value={subject.averageScore} 
                  className="h-2"
                />
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {subject.exams.slice(0, 5).map((exam) => (
                    <div 
                      key={exam.id}
                      className={`flex-shrink-0 px-3 py-2 rounded-lg border ${theme.cardBorder} ${theme.hoverBg} cursor-pointer`}
                      data-testid={`exam-trend-${exam.id}`}
                    >
                      <p className={`text-xs ${theme.textMuted}`}>{exam.examTitle}</p>
                      <div className="flex items-center gap-1">
                        <span className={`font-semibold ${getScoreColor(exam.score)}`}>{exam.score}%</span>
                        {getTrendIcon(exam.trend)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={`${theme.cardBg} border ${theme.cardBorder}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={theme.text}>Recent Exam History</CardTitle>
            <Calendar className={`h-5 w-5 ${theme.textMuted}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredData.slice(0, 8).map((exam) => (
              <div 
                key={exam.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${theme.cardBorder} ${theme.hoverBg}`}
                data-testid={`exam-history-${exam.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg bg-[#0B3C5D]/10 flex items-center justify-center`}>
                    <BookOpen className="h-5 w-5 text-[#0B3C5D]" />
                  </div>
                  <div>
                    <p className={`font-medium ${theme.text}`}>{exam.examTitle}</p>
                    <p className={`text-sm ${theme.textMuted}`}>
                      {exam.subject} • {new Date(exam.examDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getScoreColor(exam.score)}`}>
                      {exam.score}/{exam.totalMarks}
                    </p>
                    {exam.percentChange !== undefined && exam.percentChange !== 0 && (
                      <p className={`text-xs ${getTrendColor(exam.trend)}`}>
                        {exam.percentChange > 0 ? '+' : ''}{exam.percentChange}% from previous
                      </p>
                    )}
                  </div>
                  {getTrendIcon(exam.trend)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {onNavigate && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => onNavigate('exam-ready')}
            className="gap-2"
            data-testid="btn-exam-ready-cta"
          >
            Try ExamReadiness Index™ Assessment
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
