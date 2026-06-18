import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Play,
  LogOut,
  Calendar,
  Award,
  ChevronRight,
  Brain,
  TrendingUp,
  Sun,
  Moon,
  Bell,
  Trophy,
  ClipboardList,
  Timer,
  AlertCircle,
  BarChart3,
  GraduationCap
} from 'lucide-react';
import metryxLogo from '@/assets/metryx-logo-light.png';
import { Progress } from "@/components/ui/progress";
import { LbiTestModule } from "./LbiTestModule";
import { LbiAssessmentPlayer } from "./LbiAssessmentPlayer";
import { SideMenu } from "./SideMenu";

interface Exam {
  id: string;
  title: string;
  subject: string;
  status: 'Pending' | 'Completed' | 'In Progress';
  score?: number;
  totalMarks?: number;
  scheduledDate?: string;
  duration?: number;
  questionsCount?: number;
}

interface Props {
  onNavigate: (screen: Screen, data?: any) => void;
  onLogout?: () => void;
  onSelectExam?: (examId: string) => void;
  initialTab?: 'exams' | 'lbi';
}

interface SessionResult {
  id: string;
  moduleName: string;
  moduleCode: string;
  rawScore: number;
  percentileScore: number;
  totalQuestions: number;
  questionsAnswered: number;
  completedAt: string;
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export function StudentExamList({ onNavigate, onLogout, onSelectExam, initialTab = 'exams' }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'exams' | 'lbi'>(initialTab);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [viewingResults, setViewingResults] = useState<SessionResult | null>(null);
  const [studentProfile, setStudentProfile] = useState<{ id: string; name: string; age: number; lbiConsent: boolean } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false); // Start with light mode
  const { toast } = useToast();

  // Update activeTab when initialTab prop changes (for navigation from other screens)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // MetryxOne Brand Colors
  const BRAND = {
    primary: '#0B3C5D',
    accent: '#4ECDC4',
    primaryLight: '#0B3C5D20',
    accentLight: '#4ECDC420',
  };

  // Theme colors based on mode
  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    cardBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    headerBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    navBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    navBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    hoverBg: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    activeBg: isDarkMode ? 'bg-[#4ECDC4]/20' : 'bg-[#0B3C5D]/10',
    activeText: isDarkMode ? 'text-[#4ECDC4]' : 'text-[#0B3C5D]',
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, profileRes] = await Promise.all([
          authFetch('/api/student/exams'),
          authFetch('/api/student/profile')
        ]);

        if (examsRes.ok) {
          const data = await examsRes.json();
          setExams(data);
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setStudentProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [toast]);

  const handleLogout = async () => {
    try {
      await authFetch('/api/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('metryx_token');
    localStorage.removeItem('metryx_user');
    localStorage.removeItem('metryx_dashboard');
    window.dispatchEvent(new CustomEvent('metryx:logout'));
  };

  const handleStartAssessment = (sessionId: string) => {
    setActiveSession(sessionId);
  };

  const handleAssessmentComplete = (results: any) => {
    setActiveSession(null);
    setActiveTab('lbi');
    toast({
      title: "Assessment Complete!",
      description: `Your score: ${results.summary.percentileScore}%`
    });
  };

  const handleStartExam = (examId: string) => {
    if (onSelectExam) {
      onSelectExam(examId);
    }
    onNavigate('exam-player');
  };

  const handleViewResults = (examId: string) => {
    if (onSelectExam) {
      onSelectExam(examId);
    }
    onNavigate('results-summary');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredExams = exams.filter(exam => {
    // Status filter
    if (activeFilter === 'pending' && exam.status !== 'Pending') return false;
    if (activeFilter === 'completed' && exam.status !== 'Completed') return false;
    // Subject filter
    if (subjectFilter !== 'all' && exam.subject !== subjectFilter) return false;
    return true;
  });

  // Get unique subjects for filter dropdown
  const uniqueSubjects = Array.from(new Set(exams.map(e => e.subject).filter(Boolean))).sort();

  const pendingCount = exams.filter(e => e.status === 'Pending').length;
  const completedCount = exams.filter(e => e.status === 'Completed').length;

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-teal-400';
    if (percentage >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${BRAND.accent}30`, borderTopColor: BRAND.primary }} />
          </div>
          <p className={theme.textMuted}>Loading your exams...</p>
        </div>
      </div>
    );
  }

  if (activeSession) {
    return (
      <LbiAssessmentPlayer
        sessionId={activeSession}
        onComplete={handleAssessmentComplete}
        onExit={() => setActiveSession(null)}
        isDarkMode={isDarkMode}
        onThemeToggle={() => setIsDarkMode(!isDarkMode)}
      />
    );
  }

  if (viewingResults) {
    const getGrade = (percentile: number) => {
      if (percentile >= 90) return { grade: 'A+', color: 'text-teal-400' };
      if (percentile >= 80) return { grade: 'A', color: 'text-teal-400' };
      if (percentile >= 70) return { grade: 'B+', color: 'text-blue-400' };
      if (percentile >= 60) return { grade: 'B', color: 'text-blue-400' };
      if (percentile >= 50) return { grade: 'C', color: 'text-yellow-400' };
      return { grade: 'D', color: 'text-red-400' };
    };
    const gradeInfo = getGrade(viewingResults.percentileScore);
    
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex`} data-testid="results-view">
        {/* Desktop Sidebar - Fixed Position */}
        <div className="hidden md:block fixed left-0 top-0 h-full z-40">
          <SideMenu
            role="student"
            activeItem="lbi"
            onMenuSelect={(itemId) => {
              setViewingResults(null);
              if (itemId === 'dashboard') onNavigate('student-dashboard');
              else if (itemId === 'exams') setActiveTab('exams');
              else if (itemId === 'lbi') setActiveTab('lbi');
              else if (itemId === 'progress') onNavigate('student-dashboard');
              else if (itemId === 'forum') onNavigate('student-dashboard');
              else if (itemId === 'collab') onNavigate('student-dashboard');
              else if (itemId === 'study-planner') onNavigate('student-dashboard');
              else if (itemId === 'assignments') onNavigate('student-dashboard');
              else if (itemId === 'wellness') onNavigate('student-dashboard');
              else if (itemId === 'career') onNavigate('student-career-portal');
              else if (itemId === 'profile') onNavigate('student-dashboard');
            }}
            onLogout={handleLogout}
          />
        </div>

        <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
          {/* Mobile Header */}
          <header className={`md:hidden ${theme.headerBg} px-4 py-3 sticky top-0 z-10 border-b ${theme.navBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#4ECDC4]/20 flex items-center justify-center">
                  <Award size={20} className="text-[#4ECDC4]" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Assessment Results</h1>
                  <p className={`text-xs ${theme.textMuted}`}>{viewingResults.moduleCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`${theme.textMuted} ${theme.hoverBg}`}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  data-testid="button-theme-toggle-results-mobile"
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`${theme.textMuted} ${theme.hoverBg}`}
                  onClick={() => setViewingResults(null)}
                  data-testid="button-close-results-mobile"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 max-w-2xl mx-auto w-full pb-20 md:pb-6">
            <div className="hidden md:flex md:justify-between md:items-center mb-6">
              <Button
                variant="ghost"
                onClick={() => setViewingResults(null)}
                className={`${theme.textMuted} ${theme.hoverBg}`}
                data-testid="button-back-bg-results"
              >
                <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                Back to Assessments
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={`${theme.cardBorder} ${theme.textMuted} ${theme.hoverBg}`}
                onClick={() => setIsDarkMode(!isDarkMode)}
                data-testid="button-theme-toggle-results"
              >
                {isDarkMode ? <Sun size={16} className="mr-2" /> : <Moon size={16} className="mr-2" />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Button>
            </div>

            <Card className={`${theme.cardBg} ${theme.cardBorder} mb-6`}>
              <CardContent className="p-6 text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                  <span className={`text-4xl font-bold ${gradeInfo.color}`} data-testid="text-grade">{gradeInfo.grade}</span>
                </div>
                <h2 className={`text-2xl font-bold ${theme.text} mb-2`} data-testid="text-module-name">{viewingResults.moduleName}</h2>
                <Badge className="border" style={{ backgroundColor: '#0B3C5D15', color: '#0B3C5D', borderColor: '#0B3C5D30' }} data-testid="badge-module-code">
                  {viewingResults.moduleCode}
                </Badge>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className={`${theme.cardBg} ${theme.cardBorder}`} data-testid="card-raw-score">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold" style={{ color: '#4ECDC4' }} data-testid="value-raw-score">{viewingResults.rawScore}</p>
                  <p className={`text-xs ${theme.textMuted}`}>Raw Score</p>
                </CardContent>
              </Card>
              <Card className={`${theme.cardBg} ${theme.cardBorder}`} data-testid="card-percentile">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold" style={{ color: '#0B3C5D' }} data-testid="value-percentile">{viewingResults.percentileScore.toFixed(1)}%</p>
                  <p className={`text-xs ${theme.textMuted}`}>Percentile</p>
                </CardContent>
              </Card>
            </div>

            <Card className={`${theme.cardBg} ${theme.cardBorder} mb-6`} data-testid="card-details">
              <CardContent className="p-4">
                <h3 className={`font-semibold ${theme.text} mb-3`}>Assessment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Questions Answered</span>
                    <span className={theme.text} data-testid="value-questions">{viewingResults.questionsAnswered} / {viewingResults.totalQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Completed</span>
                    <span className={theme.text} data-testid="value-completed-date">
                      {viewingResults.completedAt 
                        ? new Date(viewingResults.completedAt).toLocaleDateString('en-IN', { 
                            day: 'numeric', month: 'short', year: 'numeric' 
                          }) 
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
              onClick={() => setViewingResults(null)}
              data-testid="button-done-results"
            >
              Done
            </Button>
          </main>
        </div>
      </div>
    );
  }

  const handleMenuSelect = (itemId: string) => {
    if (itemId === 'dashboard') onNavigate('student-dashboard');
    else if (itemId === 'exams') setActiveTab('exams');
    else if (itemId === 'lbi') setActiveTab('lbi');
    else if (itemId === 'progress') onNavigate('student-dashboard');
    else if (itemId === 'forum') onNavigate('student-dashboard');
    else if (itemId === 'collab') onNavigate('student-dashboard');
    else if (itemId === 'study-planner') onNavigate('student-dashboard');
    else if (itemId === 'assignments') onNavigate('student-dashboard');
    else if (itemId === 'wellness') onNavigate('student-dashboard');
    else if (itemId === 'career') onNavigate('student-career-portal');
    else if (itemId === 'profile') onNavigate('student-dashboard');
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex`}>
      {/* Desktop Sidebar - Fixed Position */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-40">
        <SideMenu
          role="student"
          activeItem={activeTab === 'exams' ? 'exams' : 'lbi'}
          onMenuSelect={handleMenuSelect}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* ── Sticky Top Header (mobile + desktop) ── */}
        <header
          className="sticky top-0 z-30 flex-shrink-0 flex items-center justify-between px-4 md:px-6"
          style={{
            height: 56,
            background: isDarkMode ? '#1f2937' : '#ffffff',
            borderBottom: `1px solid ${isDarkMode ? '#374151' : '#E8ECF2'}`,
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          }}
        >
          {/* Left: logo (mobile) / section title (desktop) */}
          <div className="flex items-center gap-2">
            <img src={metryxLogo} alt="MetryxOne" className="h-7 md:hidden" />
            <span
              className="hidden md:block text-[13px] font-semibold"
              style={{ color: isDarkMode ? '#f9fafb' : '#1A2236' }}
            >
              {activeTab === 'exams' ? 'My Exams' : 'LBI Assessment'}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}
              data-testid="button-theme-toggle-mobile"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className={isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}
              data-testid="button-logout"
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full pb-20 md:pb-6">
          {/* Enterprise Header Card — welcome/title section only */}
          <div className={`rounded-xl mb-6 overflow-hidden shadow-sm border ${theme.cardBorder}`} style={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }}>
            <div className="p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div 
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    <ClipboardList size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className={`text-xl font-semibold ${theme.text}`}>
                      {activeTab === 'exams' ? 'My Exams' : 'Learning Behavior Index (LBI)'}
                    </h1>
                    <p className={`${theme.textMuted} text-sm`}>
                      {activeTab === 'exams' 
                        ? 'Track your assessments, take exams, and view results' 
                        : 'Discover your unique learning patterns and cognitive strengths'}
                    </p>
                  </div>
                </div>
                
                {/* Tab Switcher - Professional */}
                <div className={`flex items-center gap-1 p-1 rounded-lg border ${theme.cardBorder}`} style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                  <button
                    onClick={() => setActiveTab('exams')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'exams' ? 'bg-white shadow-sm text-gray-900' : theme.textMuted
                    }`}
                    style={activeTab === 'exams' ? { color: BRAND.primary } : {}}
                    data-testid="tab-exams"
                  >
                    <FileText size={16} />
                    Exams
                  </button>
                  <button
                    onClick={() => setActiveTab('lbi')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'lbi' ? 'bg-white shadow-sm' : theme.textMuted
                    }`}
                    style={activeTab === 'lbi' ? { color: BRAND.accent } : {}}
                    data-testid="tab-lbi"
                  >
                    <Brain size={16} />
                    LBI
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile Tabs - Hidden on desktop now */}
          <div className={`flex gap-2 mb-6 border-b ${theme.navBorder} pb-3 md:hidden`}>
            <Button
              variant={activeTab === 'exams' ? 'default' : 'ghost'}
              className={activeTab === 'exams' 
                ? 'text-white' 
                : `${theme.textMuted} ${theme.hoverBg}`}
              style={{ backgroundColor: activeTab === 'exams' ? BRAND.primary : undefined }}
              onClick={() => setActiveTab('exams')}
              data-testid="tab-exams-mobile"
            >
              <FileText className="mr-2 h-4 w-4" />
              Exams
            </Button>
            <Button
              variant={activeTab === 'lbi' ? 'default' : 'ghost'}
              className={activeTab === 'lbi' 
                ? 'text-white' 
                : `${theme.textMuted} ${theme.hoverBg}`}
              style={{ backgroundColor: activeTab === 'lbi' ? BRAND.accent : undefined }}
              onClick={() => setActiveTab('lbi')}
              data-testid="tab-lbi-mobile"
            >
              <Brain className="mr-2 h-4 w-4" />
              LBI
            </Button>
          </div>

        {activeTab === 'exams' && (
          <>
            {/* Stats Cards - Professional Design */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`} data-testid="kpi-total">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                      <FileText size={20} style={{ color: BRAND.primary }} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="value-total">{exams.length}</p>
                      <p className={`text-xs ${theme.textMuted}`}>Total Exams</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`} data-testid="kpi-pending">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-500/15">
                      <Timer size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="value-pending">{pendingCount}</p>
                      <p className={`text-xs ${theme.textMuted}`}>Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`} data-testid="kpi-completed">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                      <CheckCircle size={20} style={{ color: BRAND.accent }} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="value-completed">{completedCount}</p>
                      <p className={`text-xs ${theme.textMuted}`}>Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`} data-testid="kpi-success">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-teal-500/15">
                      <Trophy size={20} className="text-teal-600" />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="value-success">
                        {completedCount > 0 ? Math.round((exams.filter(e => e.status === 'Completed' && e.score && e.totalMarks && (e.score/e.totalMarks) >= 0.6).length / completedCount) * 100) : 0}%
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>Pass Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Filter Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <Button 
                  size="sm"
                  variant={activeFilter === 'all' ? 'default' : 'outline'}
                  className={activeFilter === 'all' 
                    ? 'text-white' 
                    : `${theme.cardBorder} ${theme.textMuted} ${theme.hoverBg}`}
                  style={{ backgroundColor: activeFilter === 'all' ? BRAND.primary : undefined }}
                  onClick={() => setActiveFilter('all')}
                  data-testid="filter-all"
                >
                  <FileText size={14} className="mr-1.5" />
                  All ({exams.length})
                </Button>
                <Button 
                  size="sm"
                  variant={activeFilter === 'pending' ? 'default' : 'outline'}
                  className={activeFilter === 'pending' 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : `${theme.cardBorder} ${theme.textMuted} ${theme.hoverBg}`}
                  onClick={() => setActiveFilter('pending')}
                  data-testid="filter-pending"
                >
                  <Timer size={14} className="mr-1.5" />
                  Pending ({pendingCount})
                </Button>
                <Button 
                  size="sm"
                  variant={activeFilter === 'completed' ? 'default' : 'outline'}
                  className={activeFilter === 'completed' 
                    ? 'text-white' 
                    : `${theme.cardBorder} ${theme.textMuted} ${theme.hoverBg}`}
                  style={{ backgroundColor: activeFilter === 'completed' ? BRAND.accent : undefined }}
                  onClick={() => setActiveFilter('completed')}
                  data-testid="filter-completed"
                >
                  <CheckCircle size={14} className="mr-1.5" />
                  Completed ({completedCount})
                </Button>
              </div>
              
              {/* Subject Filter Dropdown */}
              {uniqueSubjects.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${theme.textMuted}`}>Subject:</span>
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className={`px-3 py-1.5 text-sm rounded-md border ${theme.cardBg} ${theme.cardBorder} ${theme.text}`}
                    data-testid="filter-subject"
                  >
                    <option value="all">All Subjects</option>
                    {uniqueSubjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredExams.length === 0 ? (
                <div className="text-center py-12 md:col-span-2 lg:col-span-3">
                  <div className="h-20 w-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                    <FileText size={32} style={{ color: BRAND.primary }} />
                  </div>
                  <p className={`${theme.text} font-semibold mb-1`}>No exams found</p>
                  <p className={`${theme.textMuted} text-sm`}>Check back later for new assignments</p>
                </div>
              ) : (
                filteredExams.map(exam => (
                  <Card 
                    key={exam.id} 
                    className={`${theme.cardBg} ${theme.cardBorder} transition-all duration-200 hover:shadow-lg hover:scale-[1.02] overflow-hidden`}
                    data-testid={`exam-card-${exam.id}`}
                  >
                    {/* Status Ribbon */}
                    <div 
                      className="h-1" 
                      style={{ backgroundColor: exam.status === 'Pending' ? '#f59e0b' : BRAND.accent }}
                    />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div 
                            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: exam.status === 'Pending' ? '#fef3c7' : `${BRAND.accent}15` }}
                          >
                            {exam.status === 'Pending' ? (
                              <Clock size={18} className="text-amber-600" />
                            ) : (
                              <CheckCircle size={18} style={{ color: BRAND.accent }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className={`font-semibold ${theme.text} truncate`}>{exam.title}</h3>
                            <Badge 
                              variant="outline" 
                              className={`text-xs mt-1 ${theme.cardBorder}`}
                              style={{ color: BRAND.primary, borderColor: BRAND.primary }}
                            >
                              {exam.subject}
                            </Badge>
                          </div>
                        </div>
                        {exam.status === 'Pending' ? (
                          <Badge className="bg-amber-500/20 text-amber-600 border-0 font-medium">
                            <AlertCircle size={12} className="mr-1" />
                            Pending
                          </Badge>
                        ) : (
                          <Badge className="border-0 font-medium" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
                            <CheckCircle size={12} className="mr-1" />
                            Done
                          </Badge>
                        )}
                      </div>

                      {exam.status === 'Pending' && (
                        <>
                          <div className={`flex flex-wrap items-center gap-3 text-sm ${theme.textMuted} mb-4 p-3 rounded-lg`} style={{ backgroundColor: isDarkMode ? '#374151' : '#f9fafb' }}>
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} style={{ color: BRAND.primary }} />
                              <span>{exam.scheduledDate && formatDate(exam.scheduledDate)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Timer size={14} className="text-amber-500" />
                              <span>{exam.duration} min</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <FileText size={14} style={{ color: BRAND.accent }} />
                              <span>{exam.questionsCount} Q</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium`} style={{ color: BRAND.primary }}>
                              {exam.totalMarks} marks total
                            </p>
                            <Button 
                              size="sm" 
                              className="text-white shadow-md transition-all hover:scale-105"
                              style={{ backgroundColor: BRAND.primary }}
                              onClick={() => handleStartExam(exam.id)}
                              data-testid={`start-exam-${exam.id}`}
                            >
                              <Play size={14} className="mr-1.5" />
                              Start Exam
                            </Button>
                          </div>
                        </>
                      )}

                      {exam.status === 'Completed' && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 p-3 rounded-lg flex-1" style={{ backgroundColor: isDarkMode ? '#374151' : '#f9fafb' }}>
                            <div 
                              className="h-12 w-12 rounded-xl flex items-center justify-center"
                              style={{ 
                                backgroundColor: ((exam.score || 0) / (exam.totalMarks || 100)) >= 0.8 ? '#dcfce7' : 
                                                ((exam.score || 0) / (exam.totalMarks || 100)) >= 0.6 ? '#fef3c7' : '#fee2e2'
                              }}
                            >
                              <Trophy 
                                size={24} 
                                style={{ 
                                  color: ((exam.score || 0) / (exam.totalMarks || 100)) >= 0.8 ? '#4ECDC4' : 
                                        ((exam.score || 0) / (exam.totalMarks || 100)) >= 0.6 ? '#d97706' : '#dc2626'
                                }} 
                              />
                            </div>
                            <div>
                              <p className={`text-xl font-bold ${theme.text}`}>
                                {exam.score}/{exam.totalMarks}
                              </p>
                              <p className={`text-xs ${theme.textMuted}`}>
                                {Math.round(((exam.score || 0) / (exam.totalMarks || 100)) * 100)}% Score
                              </p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            className="text-white transition-all hover:scale-105"
                            style={{ backgroundColor: BRAND.accent }}
                            onClick={() => handleViewResults(exam.id)}
                            data-testid={`view-results-${exam.id}`}
                          >
                            View Results
                            <ChevronRight size={14} className="ml-1" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'lbi' && (
          <>
            <LbiTestModule
              role="student"
              hasConsent={studentProfile?.lbiConsent ?? true}
              onStartAssessment={handleStartAssessment}
              isDarkMode={isDarkMode}
              onViewResults={async (sessionId) => {
                try {
                  const res = await authFetch(`/api/lbi/sessions/${sessionId}/results`);
                  if (res.ok) {
                    const result = await res.json();
                    // API returns: { sessionId, moduleName, moduleCode, status, startedAt, completedAt, summary: { totalQuestions, rawScore, percentileScore, grade, insights } }
                    setViewingResults({
                      id: result.sessionId,
                      moduleName: result.moduleName || 'Assessment',
                      moduleCode: result.moduleCode || '',
                      rawScore: result.summary?.rawScore || 0,
                      percentileScore: result.summary?.percentileScore || 0,
                      totalQuestions: result.summary?.totalQuestions || 0,
                      questionsAnswered: result.summary?.totalQuestions || 0,
                      completedAt: result.completedAt || ''
                    });
                  } else {
                    const error = await res.json().catch(() => ({ message: 'Unknown error' }));
                    toast({
                      title: "Error",
                      description: error.message || "Failed to load results",
                      variant: "destructive"
                    });
                  }
                } catch (error) {
                  console.error('Failed to load results:', error);
                  toast({
                    title: "Error",
                    description: "Failed to load results",
                    variant: "destructive"
                  });
                }
              }}
            />
          </>
        )}
      </main>

      {/* ── Page Footer ── */}
      <footer
        className="hidden md:flex flex-shrink-0 items-center justify-between px-6 py-3"
        style={{
          borderTop: `1px solid ${isDarkMode ? '#374151' : '#E8ECF2'}`,
          background: isDarkMode ? '#1f2937' : '#F8FAFC',
        }}
      >
        <p className="text-[11px]" style={{ color: isDarkMode ? '#6b7280' : '#9AA4B2' }}>
          © {new Date().getFullYear()} MetryxOne · Behavioural Intelligence Platform
        </p>
        <div className="flex items-center gap-3">
          {['Privacy Policy', 'Terms of Use', 'Help & Support'].map((link, i) => (
            <span key={link} className="flex items-center gap-3">
              {i > 0 && <span style={{ color: isDarkMode ? '#4b5563' : '#D1D5DB' }}>·</span>}
              <button
                className="text-[11px] transition-colors"
                style={{ color: isDarkMode ? '#6b7280' : '#9AA4B2' }}
                onMouseEnter={e => (e.currentTarget.style.color = isDarkMode ? '#d1d5db' : '#0B3C5D')}
                onMouseLeave={e => (e.currentTarget.style.color = isDarkMode ? '#6b7280' : '#9AA4B2')}
              >
                {link}
              </button>
            </span>
          ))}
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${theme.navBg} border-t ${theme.navBorder} px-2 py-2 z-20`}>
        <div className="flex justify-around">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg ${
              activeTab === 'exams' ? (isDarkMode ? 'text-[#4ECDC4]' : 'text-[#0B3C5D]') : theme.textMuted
            }`}
            data-testid="nav-exams"
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs">Exams</span>
          </button>
          <button
            onClick={() => setActiveTab('lbi')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg ${
              activeTab === 'lbi' ? (isDarkMode ? 'text-[#4ECDC4]' : 'text-[#0B3C5D]') : theme.textMuted
            }`}
            data-testid="nav-lbi"
          >
            <Brain className="h-5 w-5" />
            <span className="text-xs">LBI</span>
          </button>
          <button
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg ${theme.textMuted}`}
            data-testid="nav-progress"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </button>
          <button
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg ${theme.textMuted}`}
            data-testid="nav-profile"
          >
            <GraduationCap className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>
      </div>

    </div>
  );
}
