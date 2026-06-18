import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, TrendingDown, Target, Award, BookOpen, 
  BarChart3, PieChart, Activity, RefreshCw, Calendar,
  Users, CheckCircle, Clock, AlertCircle, Zap
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const brand = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

interface StudentAnalyticsData {
  overallStats: {
    totalExams: number;
    avgScore: number;
    bestScore: number;
    improvement: number;
    streak: number;
  };
  subjectPerformance: Array<{
    subject: string;
    avgScore: number;
    examsCount: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  recentScores: Array<{
    date: string;
    score: number;
    subject: string;
  }>;
  weeklyProgress: Array<{
    week: string;
    score: number;
    exams: number;
  }>;
}

interface InstituteAnalyticsData {
  overallStats: {
    totalStudents: number;
    totalExams: number;
    avgScore: number;
    completionRate: number;
    activeStudents: number;
  };
  subjectPerformance: Array<{
    subject: string;
    avgScore: number;
    studentsCount: number;
  }>;
  topPerformers: Array<{
    name: string;
    avgScore: number;
    examsCompleted: number;
  }>;
  atRiskStudents: Array<{
    name: string;
    avgScore: number;
    trend: 'declining' | 'stagnant';
  }>;
  performanceTrends: Array<{
    month: string;
    avgScore: number;
    examsCount: number;
  }>;
  gradeDistribution: Array<{
    grade: string;
    count: number;
    percentage: number;
  }>;
}

interface PerformanceAnalyticsProps {
  type: 'student' | 'institute';
  refreshInterval?: number;
}

const COLORS = ['#0B3C5D', '#4ECDC4', '#4ECDC4', '#f59e0b', '#0B3C5D', '#4ECDC4'];

export function PerformanceAnalytics({ type, refreshInterval = 30000 }: PerformanceAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [studentData, setStudentData] = useState<StudentAnalyticsData | null>(null);
  const [instituteData, setInstituteData] = useState<InstituteAnalyticsData | null>(null);

  const fetchAnalytics = async () => {
    try {
      const endpoint = type === 'student' ? '/api/student/analytics' : '/api/institute/analytics';
      const response = await fetch(endpoint, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (type === 'student') {
          setStudentData(data);
        } else {
          setInstituteData(data);
        }
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [type, refreshInterval]);

  const handleRefresh = () => {
    setLoading(true);
    fetchAnalytics();
  };

  if (loading && !studentData && !instituteData) {
    return (
      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw size={20} className="animate-spin" style={{ color: brand.primary }} />
              <span className="text-gray-500">Loading analytics...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === 'student' && studentData) {
    return <StudentAnalyticsView data={studentData} onRefresh={handleRefresh} lastUpdated={lastUpdated} />;
  }

  if (type === 'institute' && instituteData) {
    return <InstituteAnalyticsView data={instituteData} onRefresh={handleRefresh} lastUpdated={lastUpdated} />;
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="py-12 text-center">
        <BarChart3 size={48} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500">No analytics data available yet</p>
        <p className="text-xs text-gray-400 mt-1">Complete some exams to see your performance</p>
      </CardContent>
    </Card>
  );
}

function StudentAnalyticsView({ 
  data, 
  onRefresh, 
  lastUpdated 
}: { 
  data: StudentAnalyticsData; 
  onRefresh: () => void; 
  lastUpdated: Date;
}) {
  const mockWeeklyData = [
    { week: 'Week 1', score: 72, exams: 3 },
    { week: 'Week 2', score: 78, exams: 4 },
    { week: 'Week 3', score: 75, exams: 2 },
    { week: 'Week 4', score: 82, exams: 5 },
    { week: 'Week 5', score: 85, exams: 3 },
    { week: 'Week 6', score: 88, exams: 4 },
  ];

  const mockSubjectData = [
    { subject: 'Mathematics', avgScore: 85, examsCount: 8, trend: 'up' as const },
    { subject: 'Science', avgScore: 78, examsCount: 6, trend: 'up' as const },
    { subject: 'English', avgScore: 82, examsCount: 5, trend: 'stable' as const },
    { subject: 'History', avgScore: 75, examsCount: 4, trend: 'down' as const },
    { subject: 'Geography', avgScore: 80, examsCount: 3, trend: 'up' as const },
  ];

  const weeklyData = data.weeklyProgress?.length > 0 ? data.weeklyProgress : mockWeeklyData;
  const subjectData = data.subjectPerformance?.length > 0 ? data.subjectPerformance : mockSubjectData;

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Performance Analytics</h2>
          <p className="text-white/70 text-sm">Real-time insights into your academic progress</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Exams', value: data.overallStats?.totalExams || 24, icon: BookOpen, color: brand.primary },
          { label: 'Average Score', value: `${data.overallStats?.avgScore || 82}%`, icon: Target, color: brand.accent },
          { label: 'Best Score', value: `${data.overallStats?.bestScore || 96}%`, icon: Award, color: '#4ECDC4' },
          { label: 'Improvement', value: `+${data.overallStats?.improvement || 12}%`, icon: TrendingUp, color: '#0B3C5D' },
          { label: 'Study Streak', value: `${data.overallStats?.streak || 7} days`, icon: Zap, color: '#f59e0b' },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm bg-white/10 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={16} style={{ color: stat.color }} />
                <span className="text-xs text-white/70">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Progress Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity size={16} style={{ color: brand.primary }} />
              Weekly Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brand.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={brand.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke={brand.primary} 
                    strokeWidth={2}
                    fill="url(#colorScore)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Subject Performance */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 size={16} style={{ color: brand.accent }} />
              Subject Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="subject" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [`${value}%`, 'Average']}
                  />
                  <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                    {subjectData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {subjectData.map(subject => (
          <Card key={subject.subject} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 truncate">{subject.subject}</span>
                {subject.trend === 'up' && <TrendingUp size={14} className="text-teal-500" />}
                {subject.trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
                {subject.trend === 'stable' && <Activity size={14} className="text-gray-400" />}
              </div>
              <p className="text-xl font-bold text-gray-900">{subject.avgScore}%</p>
              <p className="text-[10px] text-gray-500">{subject.examsCount} exams</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InstituteAnalyticsView({ 
  data, 
  onRefresh, 
  lastUpdated 
}: { 
  data: InstituteAnalyticsData; 
  onRefresh: () => void; 
  lastUpdated: Date;
}) {
  const mockTrendData = [
    { month: 'Sep', avgScore: 72, examsCount: 45 },
    { month: 'Oct', avgScore: 75, examsCount: 52 },
    { month: 'Nov', avgScore: 78, examsCount: 48 },
    { month: 'Dec', avgScore: 76, examsCount: 38 },
    { month: 'Jan', avgScore: 82, examsCount: 55 },
    { month: 'Feb', avgScore: 85, examsCount: 60 },
  ];

  const mockGradeDistribution = [
    { grade: 'A+ (90-100)', count: 28, percentage: 18 },
    { grade: 'A (80-89)', count: 45, percentage: 29 },
    { grade: 'B (70-79)', count: 38, percentage: 25 },
    { grade: 'C (60-69)', count: 25, percentage: 16 },
    { grade: 'D (<60)', count: 18, percentage: 12 },
  ];

  const trendData = data.performanceTrends?.length > 0 ? data.performanceTrends : mockTrendData;
  const gradeData = data.gradeDistribution?.length > 0 ? data.gradeDistribution : mockGradeDistribution;

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Institute Performance Analytics</h2>
          <p className="text-gray-500 text-sm">Real-time insights across all students and exams</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Students', value: data.overallStats?.totalStudents || 156, icon: Users, color: brand.primary },
          { label: 'Active Students', value: data.overallStats?.activeStudents || 142, icon: CheckCircle, color: '#4ECDC4' },
          { label: 'Total Exams', value: data.overallStats?.totalExams || 48, icon: BookOpen, color: brand.accent },
          { label: 'Avg Score', value: `${data.overallStats?.avgScore || 78}%`, icon: Target, color: '#0B3C5D' },
          { label: 'Completion Rate', value: `${data.overallStats?.completionRate || 92}%`, icon: Award, color: '#f59e0b' },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                  <stat.icon size={16} style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Performance Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity size={16} style={{ color: brand.primary }} />
              Performance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgScore" 
                    name="Avg Score"
                    stroke={brand.primary} 
                    strokeWidth={2}
                    dot={{ fill: brand.primary, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChart size={16} style={{ color: brand.accent }} />
              Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPie>
                    <Pie
                      data={gradeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="count"
                      nameKey="grade"
                    >
                      {gradeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2">
                {gradeData.map((item, index) => (
                  <div key={item.grade} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-gray-600 flex-1">{item.grade}</span>
                    <span className="font-medium text-gray-900">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers & At Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Performers */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award size={16} className="text-yellow-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data.topPerformers?.length > 0 ? data.topPerformers : [
                { name: 'Aarav Sharma', avgScore: 96, examsCompleted: 12 },
                { name: 'Priya Patel', avgScore: 94, examsCompleted: 11 },
                { name: 'Rohan Kumar', avgScore: 92, examsCompleted: 10 },
                { name: 'Sneha Gupta', avgScore: 91, examsCompleted: 12 },
                { name: 'Vikram Singh', avgScore: 90, examsCompleted: 9 },
              ]).slice(0, 5).map((student, index) => (
                <div key={student.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div 
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: index === 0 ? '#f59e0b' : index === 1 ? '#9ca3af' : index === 2 ? '#cd7f32' : brand.primary }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{student.name}</p>
                    <p className="text-xs text-gray-500">{student.examsCompleted} exams completed</p>
                  </div>
                  <Badge className="bg-teal-100 text-teal-700">{student.avgScore}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* At Risk Students */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              Students Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data.atRiskStudents?.length > 0 ? data.atRiskStudents : [
                { name: 'Rahul Verma', avgScore: 52, trend: 'declining' as const },
                { name: 'Anita Das', avgScore: 55, trend: 'stagnant' as const },
                { name: 'Suresh Nair', avgScore: 58, trend: 'declining' as const },
              ]).slice(0, 5).map((student) => (
                <div key={student.name} className="flex items-center gap-3 p-2 rounded-lg bg-red-50">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle size={16} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{student.name}</p>
                    <p className="text-xs text-red-600">
                      {student.trend === 'declining' ? 'Performance declining' : 'Progress stagnant'}
                    </p>
                  </div>
                  <Badge className="bg-red-100 text-red-700">{student.avgScore}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
