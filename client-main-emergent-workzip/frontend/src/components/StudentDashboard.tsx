import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Screen } from '../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AIStudyRecommendations from "./AIStudyRecommendations";
import StudentStudyPlanner from "./StudentStudyPlanner";
import StudentAssignments from "./StudentAssignments";
import { StudentParentTestPlayer } from "./StudentParentTestPlayer";
import { ParentEducationPlanner } from "./ParentEducationPlanner";
import { ParentMentorServices } from "./ParentMentorServices";
import { ParentEnterpriseHub } from "./ParentEnterpriseHub";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Play,
  LogOut,
  Calendar,
  Award,
  ChevronRight,
  BookOpen,
  Brain,
  TrendingUp,
  TrendingDown,
  BarChart3,
  GraduationCap,
  Sun,
  Moon,
  RefreshCw,
  Flame,
  Star,
  Trophy,
  Bell,
  Activity,
  PieChart,
  Sparkles,
  Target,
  User,
  Lock,
  ArrowRight,
  Rocket,
  Zap,
  Heart,
  MessageCircle,
  AlertCircle,
  Timer,
  CalendarDays,
  Users,
  Home,
  Shield,
  ClipboardList,
  Briefcase,
  HeartPulse,
  BarChart2,
  School,
  Map,
  Search,
} from 'lucide-react';
import metryxLogo from '@/assets/metryx-logo-light.png';
import { Progress } from "@/components/ui/progress";
import { SideMenu } from "./SideMenu";
import { ExamTrends } from "./ExamTrends";
import { StudentLearningForum } from "./StudentLearningForum";
import { QuickTour } from "./QuickTour";
import { shouldShowTour } from "@/lib/tourUtils";
import { GlobalSearch } from "./GlobalSearch";
import { StudentCollabHub } from "./StudentCollabHub";
import { RoleSwitcher } from "./RoleSwitcher";
import { fetchUser } from "@/lib/api";
import type { User as UserType } from "@shared/schema";
import NotificationCenter from '@/components/NotificationCenter';
import { FirstLoginProfileModal } from '@/components/FirstLoginProfileModal';

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade?: string;
  examType?: string;
  status: 'Pending' | 'Completed' | 'In Progress';
  score?: number;
  totalMarks?: number;
  scheduledDate?: string;
  duration?: number;
  questionsCount?: number;
}

interface LbiInsight {
  id: string;
  category: string;
  value: number;
  description: string;
  completedAt?: string;
  isLocked?: boolean;
  lockedUntil?: string;
}

interface StudentProfile {
  id: string;
  name: string;
  age: number;
  grade?: string;
  schoolName?: string;
  lbiConsent: boolean;
}

interface Props {
  onNavigate: (screen: Screen, params?: any) => void;
  onLogout?: () => void;
  onSelectExam?: (examId: string) => void;
}

type ActiveView = 'dashboard' | 'progress' | 'profile' | 'exam-trends' | 'analytics' | 'forum' | 'missions' | 'rewards' | 'collab' | 'study-planner' | 'assignments' | 'education' | 'ai-reports' | 'metryxai' | 'packages' | 'mentor-services' | 'wellness' | 'exam-ready';

const LEVELS = [
  { level: 1, title: 'Explorer',  minXp: 0,    maxXp: 199,  color: '#64748b' },
  { level: 2, title: 'Learner',   minXp: 200,  maxXp: 499,  color: '#0B3C5D' },
  { level: 3, title: 'Achiever',  minXp: 500,  maxXp: 999,  color: '#0B3C5D' },
  { level: 4, title: 'Leader',    minXp: 1000, maxXp: 1999, color: '#f59e0b' },
  { level: 5, title: 'Master',    minXp: 2000, maxXp: 9999, color: '#ef4444' },
];

const TITLES: Record<string, string[]> = {
  study:    ['Bookworm', 'Quiz Champion', 'Knowledge Seeker'],
  behavior: ['Focus Warrior', 'Discipline Star', 'Mindful Scholar'],
  skill:    ['Strategist', 'Brain Athlete', 'Problem Solver'],
};

const DAILY_MISSIONS = [
  { id: 'm1', type: 'Study',    label: 'Complete a practice test',        description: 'Take any available exam or quiz',            xp: 50, coins: 20, actionLabel: 'Go to Exams',      action: 'exams' },
  { id: 'm2', type: 'Study',    label: 'Review your score trends',        description: 'Check your recent performance charts',       xp: 30, coins: 10, actionLabel: 'View Trends',      action: 'exam-trends' },
  { id: 'm3', type: 'Skill',    label: 'Complete a behavioral assessment',description: 'Take the LBI behavioural intelligence test', xp: 40, coins: 15, actionLabel: 'Start LBI',        action: 'lbi' },
  { id: 'm4', type: 'Behavior', label: 'Post in the learning forum',      description: 'Ask or answer a question to help peers',    xp: 25, coins: 10, actionLabel: 'Open Forum',       action: 'forum' },
  { id: 'm5', type: 'Behavior', label: 'Check your progress overview',    description: 'Visit My Progress and review your stats',   xp: 20, coins: 8,  actionLabel: 'View Progress',    action: 'progress' },
];

const REWARD_CATALOG = [
  { id: 'r1', name: 'Amazon Gift Card',     description: '&#x20B9;100 gift card redeemable on Amazon.in',    coins: 500,  type: 'voucher',      emoji: '\uD83C\uDF81' },
  { id: 'r2', name: 'Online Course Pass',   description: '7-day access to any premium course module',         coins: 300,  type: 'course',       emoji: '\uD83D\uDCDA' },
  { id: 'r3', name: '1-on-1 Mentorship',    description: '30-min session with a MetryxOne mentor',            coins: 800,  type: 'mentorship',   emoji: '\uD83E\uDDD1\u200D\uD83C\uDFEB' },
  { id: 'r4', name: 'Internship Boost',     description: 'Priority application to partner internships',       coins: 1000, type: 'internship',   emoji: '\uD83D\uDE80' },
  { id: 'r5', name: 'Flipkart Gift Card',   description: '&#x20B9;50 gift card redeemable on Flipkart.com',  coins: 250,  type: 'voucher',      emoji: '\uD83C\uDFAB' },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Aarav S.',  xpGained: 420, streak: 14, title: 'Achiever' },
  { rank: 2, name: 'Priya M.',  xpGained: 380, streak: 12, title: 'Learner'  },
  { rank: 3, name: 'Rohit K.',  xpGained: 310, streak: 9,  title: 'Learner'  },
  { rank: 4, name: 'Sneha T.',  xpGained: 275, streak: 7,  title: 'Learner'  },
  { rank: 5, name: 'Dev P.',    xpGained: 220, streak: 5,  title: 'Explorer' },
];

function getLevel(xp: number) {
  return LEVELS.find(l => xp >= l.minXp && xp <= l.maxXp) ?? LEVELS[LEVELS.length - 1];
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

interface StudentAnalytics {
  overallStats: {
    totalExams: number;
    completedExams: number;
    avgScore: number;
    bestScore: number;
    worstScore: number;
    improvementRate: number;
  };
  subjectPerformance: {
    subject: string;
    avgScore: number;
    examCount: number;
    bestScore: number;
    worstScore: number;
  }[];
  recentTrends: {
    date: string;
    score: number;
    examTitle: string;
    subject: string;
  }[];
  strengths: string[];
  areasToImprove: string[];
}

export function StudentDashboard({ onNavigate, onLogout, onSelectExam }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [lbiInsights, setLbiInsights] = useState<LbiInsight[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedPieSegment, setSelectedPieSegment] = useState<string | null>(null);
  const [consentRequired, setConsentRequired] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [showTour, setShowTour] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeParentTestId, setActiveParentTestId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { toast } = useToast();

  const loadGamification = () => {
    try {
      const raw = localStorage.getItem('metryx_gamification');
      if (raw) return JSON.parse(raw) as { xp: number; coins: number; streakDays: number; missionsCompletedToday: string[]; lastMissionDate: string; earnedTitle: string };
    } catch {}
    return { xp: 0, coins: 0, streakDays: 7, missionsCompletedToday: [], lastMissionDate: '', earnedTitle: 'Focus Warrior' };
  };
  const [gamification, setGamification] = useState(loadGamification);

  const saveGamification = (next: typeof gamification) => {
    localStorage.setItem('metryx_gamification', JSON.stringify(next));
    setGamification(next);
  };

  // ── Real API gamification state ───────────────────────────────────────────
  interface ApiGamificationProfile {
    xp: number; coins: number; level: number; streakDays: number;
    missionsCompleted: number; xpInLevel: number; xpNeeded: number;
    levelProgress: number; canClaimLoginReward: boolean;
  }
  interface XpTransaction { id: number; amount: number; source: string; reference_id: string | null; created_at: string; }
  interface ApiLeaderboardEntry { user_id: string; xp: number; level: number; streak_days: number; name: string | null; }
  interface ApiReward { id: number; name: string; description: string; type: string; coin_cost: number; stock: number | null; }

  const [apiProfile, setApiProfile] = useState<ApiGamificationProfile | null>(null);
  const [xpHistory, setXpHistory] = useState<XpTransaction[]>([]);
  const [apiLeaderboard, setApiLeaderboard] = useState<ApiLeaderboardEntry[]>([]);
  const [apiRewards, setApiRewards] = useState<ApiReward[]>([]);
  const [apiMyRank, setApiMyRank] = useState<number | null>(null);
  const [claimingLogin, setClaimingLogin] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [gamificationLoaded, setGamificationLoaded] = useState(false);

  const gToken = () => localStorage.getItem('metryx_token');
  const gHeaders = () => { const t = gToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  const fetchApiGamification = async () => {
    const token = gToken();
    if (!token) return;
    try {
      const [profileRes, historyRes, lbRes, rewardsRes] = await Promise.all([
        fetch('/api/gamification/profile', { headers: gHeaders() }),
        fetch('/api/gamification/xp/history?limit=12', { headers: gHeaders() }),
        fetch('/api/gamification/leaderboard?limit=10', { headers: gHeaders() }),
        fetch('/api/gamification/rewards', { headers: gHeaders() }),
      ]);
      if (profileRes.ok) {
        const p = await profileRes.json() as ApiGamificationProfile;
        setApiProfile(p);
        saveGamification({ ...loadGamification(), xp: p.xp, coins: p.coins, streakDays: p.streakDays });
      }
      if (historyRes.ok) { const d = await historyRes.json(); setXpHistory(d.transactions ?? []); }
      if (lbRes.ok) { const d = await lbRes.json(); setApiLeaderboard(d.leaderboard ?? []); setApiMyRank(d.myRank ?? null); }
      if (rewardsRes.ok) { const d = await rewardsRes.json(); setApiRewards(d.rewards ?? []); }
    } catch {}
    setGamificationLoaded(true);
  };

  useEffect(() => { fetchApiGamification(); }, []);

  const claimLoginReward = async () => {
    if (claimingLogin) return;
    setClaimingLogin(true);
    try {
      const res = await fetch('/api/gamification/login-reward', {
        method: 'POST', headers: { ...gHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) { toast({ title: '🔥 Login Reward!', description: data.message }); fetchApiGamification(); }
      else { toast({ title: 'Already claimed', description: 'Come back tomorrow!', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Could not claim reward', variant: 'destructive' }); }
    setClaimingLogin(false);
  };

  const redeemApiReward = async (rewardId: number, cost: number, name: string) => {
    const coins = apiProfile?.coins ?? gamification.coins;
    if (coins < cost) { toast({ title: 'Not enough coins', description: `Need ${cost - coins} more coins`, variant: 'destructive' }); return; }
    setRedeemingId(rewardId);
    try {
      const res = await fetch(`/api/gamification/rewards/${rewardId}/redeem`, {
        method: 'POST', headers: { ...gHeaders(), 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await res.json();
      if (res.ok) { toast({ title: `🎁 ${name} redeemed!`, description: data.message }); fetchApiGamification(); }
      else if (data.error === 'INSUFFICIENT_COINS') toast({ title: 'Not enough coins', variant: 'destructive' });
      else if (data.error === 'OUT_OF_STOCK') toast({ title: 'Out of stock', description: 'This reward is no longer available.', variant: 'destructive' });
      else toast({ title: 'Error', description: 'Could not redeem', variant: 'destructive' });
    } catch { toast({ title: 'Error', description: 'Could not redeem', variant: 'destructive' }); }
    setRedeemingId(null);
  };

  const XP_SOURCE_META: Record<string, { label: string; icon: string; color: string }> = {
    lbi_complete:        { label: 'LBI Assessment Completed',        icon: '🧠', color: '#4ECDC4' },
    exam_ready_complete: { label: 'Behavioral Assessment Completed', icon: '🎯', color: '#0B3C5D' },
    mission_complete:    { label: 'Mission Completed',               icon: '✅', color: '#D97706' },
    login_reward:        { label: 'Daily Login Reward',              icon: '🔥', color: '#f97316' },
    exam_complete:       { label: 'Exam Completed',                  icon: '📝', color: '#8b5cf6' },
  };

  const completeMission = (missionId: string, missionXp: number, missionCoins: number) => {
    const today = todayKey();
    const prev = { ...gamification };
    if (prev.missionsCompletedToday.includes(missionId)) return;
    const updatedCompleted = prev.lastMissionDate === today
      ? [...prev.missionsCompletedToday, missionId]
      : [missionId];
    const next = {
      ...prev,
      xp: prev.xp + missionXp,
      coins: prev.coins + missionCoins,
      missionsCompletedToday: updatedCompleted,
      lastMissionDate: today,
    };
    saveGamification(next);
    toast({ title: `+${missionXp} XP \u00B7 +${missionCoins} Coins earned!`, description: 'Mission complete. Keep going!' });
  };

  const redeemReward = (_rewardId: string, cost: number, rewardName: string) => {
    if (gamification.coins < cost) {
      toast({ title: 'Not enough coins', description: `You need ${cost - gamification.coins} more coins.`, variant: 'destructive' });
      return;
    }
    saveGamification({ ...gamification, coins: gamification.coins - cost });
    toast({ title: `${rewardName} redeemed!`, description: 'Check your registered email for details.' });
  };

  const todayMissions = (() => {
    const today = todayKey();
    const completed = gamification.lastMissionDate === today ? gamification.missionsCompletedToday : [];
    return DAILY_MISSIONS.map(m => ({ ...m, done: completed.includes(m.id) }));
  })();

  const levelInfo = getLevel(gamification.xp);
  const nextLevel = LEVELS.find(l => l.level === levelInfo.level + 1);
  const xpIntoLevel = gamification.xp - levelInfo.minXp;
  const xpForLevel = (nextLevel?.minXp ?? levelInfo.maxXp + 1) - levelInfo.minXp;
  const levelProgress = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100));

  // Dynamic motivational messages based on time and performance
  const getMotivationalMessage = () => {
    const hour = new Date().getHours();
    const messages = {
      morning: [
        "Rise and shine! Today is full of possibilities! 🌅",
        "Good morning, champion! Ready to conquer new knowledge?",
        "A fresh day, a fresh start. Let's make it count!",
        "Morning star! Your potential is limitless today!"
      ],
      afternoon: [
        "Keep the momentum going! You're doing amazing!",
        "Halfway through the day and going strong! 💪",
        "Great progress today! Every step counts.",
        "Your dedication is inspiring. Keep pushing forward!"
      ],
      evening: [
        "Evening achiever! Reflect on today's wins! 🌟",
        "What a productive day! Be proud of yourself.",
        "Winding down? You've earned a great night's rest!",
        "Evening brilliance! Tomorrow holds more adventures."
      ]
    };
    
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const dayMessages = messages[timeOfDay];
    return dayMessages[Math.floor(Math.random() * dayMessages.length)];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getEncouragementBadge = () => {
    if (avgScore >= 90) return { text: 'Star Performer', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (avgScore >= 80) return { text: 'High Achiever', icon: Trophy, color: 'text-[#0B3C5D]', bg: 'bg-[rgba(11,60,93,0.08)]/20' };
    if (avgScore >= 70) return { text: 'Rising Star', icon: Rocket, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (avgScore >= 60) return { text: 'Making Progress', icon: TrendingUp, color: 'text-teal-400', bg: 'bg-teal-500/20' };
    return { text: 'Keep Going', icon: Heart, color: 'text-[#4ECDC4]', bg: 'bg-[rgba(78,205,196,0.10)]/20' };
  };

  const handleRoleChange = (newRole: string) => {
    const screenMap: Record<string, Screen> = {
      'parent': 'unified-parent-dashboard',
      'student': 'student-dashboard',
      'institute': 'unified-institute-dashboard',
      'teacher': 'unified-institute-dashboard',
      'ngo': 'ngo-dashboard',
      'admin': 'unified-institute-dashboard'
    };
    const targetScreen = screenMap[newRole] || 'landing';
    onNavigate(targetScreen as Screen);
  };

  // MetryxOne Brand Colors
  const BRAND = {
    primary: '#0B3C5D',
    accent: '#4ECDC4',
    primaryLight: '#0B3C5D15',
    accentLight: '#4ECDC415',
  };

  // Theme colors
  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    cardBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    cardBorder: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    headerBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    activeBg: isDarkMode ? 'bg-[#4ECDC4]/20' : 'bg-[#0B3C5D]/10',
    activeText: isDarkMode ? 'text-[#4ECDC4]' : 'text-[#0B3C5D]',
    primary: isDarkMode ? '#4ECDC4' : '#0B3C5D',
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowTour('student')) setShowTour(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeView === 'analytics') {
      fetchAnalytics();
    }
  }, [activeView]);

  // Polling for real-time updates when on analytics view
  useEffect(() => {
    if (activeView !== 'analytics') return;
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [activeView]);

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) setAnalyticsLoading(true);
      const res = await fetch('/api/student/analytics', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      if (!silent) setAnalyticsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [examsRes, profileRes, insightsRes, userRes] = await Promise.all([
        fetch('/api/student/exams', { credentials: 'include' }),
        fetch('/api/student/profile', { credentials: 'include' }),
        fetch('/api/student/behavioral-insights', { credentials: 'include' }).catch(() => null),
        fetchUser().catch(() => null)
      ]);

      if (examsRes.ok) {
        const data = await examsRes.json();
        setExams(data);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        setStudentProfile(data);
      }

      if (insightsRes?.ok) {
        const data = await insightsRes.json();
        setLbiInsights(data.insights || []);
        setConsentRequired(data.consentRequired || false);
      }

      if (userRes) {
        setUserData(userRes);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate exam statistics
  const totalExams = exams.length;
  const completedExams = exams.filter(e => e.status === 'Completed').length;
  const pendingExams = exams.filter(e => e.status === 'Pending').length;
  const avgScore = completedExams > 0 
    ? Math.round(exams.filter(e => e.status === 'Completed' && e.score !== undefined)
        .reduce((sum, e) => sum + (e.score || 0), 0) / completedExams)
    : 0;

  // Calculate LBI statistics
  const totalModules = 7;
  const completedModules = lbiInsights.length;
  const totalLbiScore = lbiInsights.reduce((sum, i) => sum + i.value, 0);
  const maxLbiScore = totalModules * 100;
  const avgLbiScore = completedModules > 0 ? Math.round(totalLbiScore / completedModules) : 0;

  // Score distribution for pie chart
  const strong = lbiInsights.filter(i => i.value >= 80).length;
  const moderate = lbiInsights.filter(i => i.value >= 60 && i.value < 80).length;
  const developing = lbiInsights.filter(i => i.value >= 40 && i.value < 60).length;
  const needsAttention = lbiInsights.filter(i => i.value < 40).length;

  // Recent completed exams
  const recentExams = exams
    .filter(e => e.status === 'Completed')
    .sort((a, b) => new Date(b.scheduledDate || '').getTime() - new Date(a.scheduledDate || '').getTime())
    .slice(0, 5);

  // Upcoming exams
  const upcomingExams = exams
    .filter(e => e.status === 'Pending')
    .sort((a, b) => new Date(a.scheduledDate || '').getTime() - new Date(b.scheduledDate || '').getTime())
    .slice(0, 3);

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin w-14 h-14 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${BRAND.accent}30`, borderTopColor: BRAND.primary }} />
            <img src={metryxLogo} alt="MetryxOne" className="h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ marginTop: '-8px' }} />
          </div>
          <p className={`${theme.textMuted} mt-2`}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} flex`}>
      {/* Side Menu - Fixed Position */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-40">
        <SideMenu 
          role="student" 
          activeItem={activeView}
          onMenuSelect={(itemId) => {
            if (itemId === 'dashboard') setActiveView('dashboard');
            else if (itemId === 'missions') setActiveView('missions');
            else if (itemId === 'rewards') setActiveView('rewards');
            else if (itemId === 'exams') onNavigate('student-exam-list', { tab: 'exams' });
            else if (itemId === 'lbi') onNavigate('student-exam-list', { tab: 'lbi' });
            else if (itemId === 'exam-trends') setActiveView('exam-trends');
            else if (itemId === 'exam-ready') setActiveView('exam-ready');
            else if (itemId === 'progress') setActiveView('progress');
            else if (itemId === 'profile') setActiveView('profile');
            else if (itemId === 'analytics') setActiveView('analytics');
            else if (itemId === 'forum') setActiveView('forum');
            else if (itemId === 'collab') setActiveView('collab');
            else if (itemId === 'study-planner') setActiveView('study-planner');
            else if (itemId === 'assignments') setActiveView('assignments');
            else if (itemId === 'education') setActiveView('education');
            else if (itemId === 'ai-reports') setActiveView('ai-reports');
            else if (itemId === 'metryxai') setActiveView('metryxai');
            else if (itemId === 'packages') setActiveView('packages');
            else if (itemId === 'mentor-services') setActiveView('mentor-services');
            else if (itemId === 'wellness') setActiveView('wellness');
            else if (itemId === 'career') onNavigate('student-career-portal');
            else if (itemId === 'profile') setActiveView('dashboard');
          }}
          onLogout={onLogout || (() => onNavigate('login'))}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">

        {/* ── Sticky Top Header ── */}
        <header
          className="sticky top-0 z-30 flex-shrink-0 flex items-center justify-between px-4 md:px-6"
          style={{
            height: 56,
            background: isDarkMode ? '#1f2937' : '#ffffff',
            borderBottom: `1px solid ${isDarkMode ? '#374151' : '#E8ECF2'}`,
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          }}
        >
          {/* Left: logo on mobile, section title on desktop */}
          <div className="flex items-center gap-2">
            <img src={metryxLogo} alt="MetryxOne" className="h-7 md:hidden" />
            <div className="hidden md:flex items-center gap-2">
              <span
                className="text-[13px] font-semibold"
                style={{ color: isDarkMode ? '#f9fafb' : '#1A2236' }}
              >
                {activeView === 'dashboard'       ? 'Dashboard'
                : activeView === 'missions'       ? 'Daily Missions'
                : activeView === 'rewards'        ? 'XP & Rewards'
                : activeView === 'exam-trends'    ? 'Exam Analytics'
                : activeView === 'progress'       ? 'My Progress'
                : activeView === 'profile'        ? 'My Profile'
                : activeView === 'analytics'      ? 'Analytics'
                : activeView === 'forum'          ? 'Learning Forum'
                : activeView === 'collab'         ? 'Collab Hub'
                : activeView === 'study-planner'  ? 'Study Planner'
                : activeView === 'assignments'    ? 'Assignments'
                : activeView === 'education'      ? 'Education Planner'
                : activeView === 'ai-reports'     ? 'AI Reports'
                : activeView === 'metryxai'       ? 'MetryxAI Assistant'
                : activeView === 'packages'       ? 'My Packages'
                : activeView === 'mentor-services'? 'Mentor Services'
                : activeView === 'wellness'       ? 'Wellness Hub'
                : activeView === 'exam-ready'    ? 'Exam Readiness Index'
                : 'Student Portal'}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            {userData && userData.roles && userData.roles.length > 1 && (
              <RoleSwitcher
                currentRole={userData.role}
                availableRoles={userData.roles}
                onRoleChange={handleRoleChange}
                variant="minimal"
              />
            )}
            <button
              onClick={() => setShowSearch(true)}
              className={`hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              title="Search (⌘K)"
              data-testid="btn-global-search"
            >
              <Search size={13} />
              <span>Search</span>
              <kbd className={`ml-1 text-[9px] px-1 py-0.5 rounded font-mono border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>⌘K</kbd>
            </button>
            <NotificationCenter variant={isDarkMode ? 'dark' : 'default'} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTour(true)}
              className={`hidden sm:flex items-center gap-1.5 text-xs font-medium ${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title="Quick Tour"
            >
              <Map size={14} />
              Quick Tour
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}
              data-testid="theme-toggle"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout || (() => onNavigate('login'))}
              className={isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}
              data-testid="logout-button"
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>

      <div className="flex-1 p-4 md:p-6">
        {/* Welcome Banner — redesigned */}
        <div
          className="mb-6 rounded-2xl overflow-hidden shadow-lg"
          data-testid="nav-dashboard"
          style={{
            background: '#0B3C5D',
            position: 'relative',
          }}
        >
          {/* Decorative blobs */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', bottom: '-40px', right: '20%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(78,205,196,0.18)' }} />
            <div style={{ position: 'absolute', top: '10px', left: '40%', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            {/* Dot grid pattern */}
            <svg style={{ position: 'absolute', right: 0, top: 0, opacity: 0.07 }} width="220" height="100" viewBox="0 0 220 100">
              {Array.from({ length: 6 }).map((_, row) =>
                Array.from({ length: 11 }).map((_, col) => (
                  <circle key={`${row}-${col}`} cx={col * 20 + 10} cy={row * 17 + 8} r="2" fill="white" />
                ))
              )}
            </svg>
          </div>

          <div className="px-5 py-5 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

              {/* Left: Avatar + Info */}
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl"
                    style={{ background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(6px)' }}
                  >
                    <User size={30} className="text-white drop-shadow" />
                  </div>
                  {/* Level badge */}
                  <div
                    className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md"
                    style={{ background: '#F59E0B', color: '#fff', border: '2px solid rgba(255,255,255,0.6)' }}
                  >
                    {levelInfo.level}
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-white drop-shadow-sm tracking-tight" data-testid="welcome-message">
                      {getGreeting()}, {studentProfile?.name || 'Student'}!
                    </h1>
                    {(() => {
                      const badge = getEncouragementBadge();
                      const IconComponent = badge.icon;
                      return (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(255,255,255,0.20)', color: '#fff', border: '1px solid rgba(255,255,255,0.30)', backdropFilter: 'blur(4px)' }}
                        >
                          <IconComponent size={11} />
                          {badge.text}
                        </span>
                      );
                    })()}
                  </div>

                  <p className="text-[12px] mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <span className="font-semibold text-white/90">{gamification.earnedTitle || levelInfo.title}</span>
                    {studentProfile?.grade ? ` · Grade ${studentProfile.grade}` : ''}
                    {studentProfile?.schoolName ? ` · ${studentProfile.schoolName}` : ''}
                  </p>

                  <p className="text-[12px] mt-1 font-medium" style={{ color: '#A5F3FC' }} data-testid="motivational-message">
                    <Sparkles size={12} className="inline mr-1" />
                    {getMotivationalMessage()}
                  </p>

                  {/* XP Progress Bar */}
                  <div className="mt-3 max-w-[280px]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        Lv {levelInfo.level} · {xpIntoLevel} / {xpForLevel} XP
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: '#FDE68A' }}>
                        {levelProgress}% → Lv {levelInfo.level + 1}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${levelProgress}%`, background: '#FDE68A', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Stats */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                {/* Streak */}
                <div
                  className="flex flex-col items-center justify-center px-4 py-2.5 rounded-xl min-w-[72px]"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
                >
                  <span className="text-xl leading-none mb-0.5">🔥</span>
                  <p className="text-base font-bold text-white leading-none">{gamification.streakDays}</p>
                  <p className="text-[9px] font-semibold mt-0.5" style={{ color: '#FED7AA', letterSpacing: '0.04em' }}>DAY STREAK</p>
                </div>

                {/* Completed */}
                <div
                  className="flex flex-col items-center justify-center px-4 py-2.5 rounded-xl min-w-[72px]"
                  style={{ background: 'rgba(78,205,196,0.22)', border: '1.5px solid rgba(78,205,196,0.45)', backdropFilter: 'blur(8px)' }}
                >
                  <CheckCircle size={18} style={{ color: '#4ECDC4', marginBottom: 2 }} />
                  <p className="text-base font-bold text-white leading-none">{completedExams}</p>
                  <p className="text-[9px] font-semibold mt-0.5" style={{ color: '#A5F3FC', letterSpacing: '0.04em' }}>COMPLETED</p>
                </div>

                {/* Average */}
                <div
                  className="flex flex-col items-center justify-center px-4 py-2.5 rounded-xl min-w-[72px]"
                  style={{ background: 'rgba(251,191,36,0.18)', border: '1.5px solid rgba(251,191,36,0.35)', backdropFilter: 'blur(8px)' }}
                >
                  <Trophy size={18} style={{ color: '#FDE68A', marginBottom: 2 }} />
                  <p className="text-base font-bold text-white leading-none">{avgScore}%</p>
                  <p className="text-[9px] font-semibold mt-0.5" style={{ color: '#FDE68A', letterSpacing: '0.04em' }}>AVERAGE</p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Upcoming Reminders & Notifications Banner */}
        {upcomingExams.length > 0 && activeView === 'dashboard' && (
          <div 
            className={`mb-6 p-4 rounded-xl border ${theme.cardBorder} flex items-center justify-between`}
            style={{ backgroundColor: isDarkMode ? '#1e3a5f' : '#e0f2fe', borderColor: BRAND.primary }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                <CalendarDays size={20} className="text-white" />
              </div>
              <div>
                <p className={`font-semibold ${theme.text}`}>
                  <Timer size={14} className="inline mr-1" style={{ color: BRAND.accent }} />
                  Next Exam: {upcomingExams[0].title}
                </p>
                <p className={`text-sm ${theme.textMuted}`}>
                  {upcomingExams[0].subject} • {upcomingExams[0].scheduledDate ? new Date(upcomingExams[0].scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Schedule TBD'}
                  {upcomingExams[0].duration && ` • ${upcomingExams[0].duration} mins`}
                </p>
              </div>
            </div>
            <Button 
              className="text-white gap-2"
              style={{ backgroundColor: BRAND.primary }}
              onClick={() => onNavigate('student-exam-list', { tab: 'exams' })}
              data-testid="btn-start-next-exam"
            >
              <Play size={16} />
              Start Now
            </Button>
          </div>
        )}

        {/* Conditional Content Based on Active View */}
        {activeView === 'exam-trends' && (
          <div data-testid="exam-trends-view">
            <ExamTrends 
              isDarkMode={isDarkMode} 
              isParentView={false}
              onNavigate={(screen, data) => onNavigate(screen as any, data)}
            />
          </div>
        )}

        {activeView === 'progress' && (
          <div data-testid="progress-view">
            {/* Progress Header */}
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={22} style={{ color: '#0B3C5D' }} />
              <h2 className="text-xl font-bold" style={{ color: '#0B3C5D' }}>My Progress</h2>
            </div>

            {/* Overall Progress Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0B3C5D15' }}>
                      <FileText size={20} style={{ color: '#0B3C5D' }} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="progress-total-exams">{totalExams}</p>
                      <p className={`text-xs ${theme.textMuted}`}>Total Exams</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4ECDC415' }}>
                      <CheckCircle size={20} style={{ color: '#4ECDC4' }} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="progress-completed">{completedExams}</p>
                      <p className={`text-xs ${theme.textMuted}`}>Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0B3C5D12' }}>
                      <Award size={20} style={{ color: '#0B3C5D' }} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="progress-avg-score">{avgScore}%</p>
                      <p className={`text-xs ${theme.textMuted}`}>Avg Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4ECDC420' }}>
                      <Brain size={20} style={{ color: '#4ECDC4' }} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${theme.text}`} data-testid="progress-lbi">{completedModules}/7</p>
                      <p className={`text-xs ${theme.textMuted}`}>Assessments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Exam Progress by Subject */}
            <Card className={`${theme.cardBg} ${theme.cardBorder} border mb-6`}>
              <CardHeader>
                <CardTitle className={theme.text}>Exam Performance by Subject</CardTitle>
                <CardDescription className={theme.textMuted}>Your scores across different subjects</CardDescription>
              </CardHeader>
              <CardContent>
                {exams.filter(e => e.status === 'Completed').length > 0 ? (
                  <div className="space-y-4" data-testid="subject-progress-list">
                    {Array.from(new Set(exams.filter(e => e.status === 'Completed').map(e => e.subject))).map(subject => {
                      const subjectExams = exams.filter(e => e.subject === subject && e.status === 'Completed');
                      const subjectAvg = Math.round(subjectExams.reduce((sum, e) => sum + (e.score || 0), 0) / subjectExams.length);
                      return (
                        <div key={subject} className="space-y-2" data-testid={`subject-progress-${subject}`}>
                          <div className="flex justify-between items-center">
                            <span className={theme.text}>{subject}</span>
                            <span className={`font-semibold ${subjectAvg >= 80 ? 'text-teal-400' : subjectAvg >= 60 ? 'text-blue-400' : subjectAvg >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                              {subjectAvg}%
                            </span>
                          </div>
                          <Progress value={subjectAvg} className="h-2" />
                          <p className={`text-xs ${theme.textMuted}`}>{subjectExams.length} exam{subjectExams.length > 1 ? 's' : ''} completed</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText size={48} className={theme.textMuted + " mx-auto mb-4 opacity-50"} />
                    <p className={theme.textMuted}>No completed exams yet</p>
                    <Button 
                      className="mt-4 text-gray-900 font-semibold hover:opacity-90"
                      style={{ backgroundColor: '#4ECDC4' }}
                      onClick={() => onNavigate('student-exam-list', { tab: 'exams' })}
                      data-testid="btn-view-exams-progress"
                    >
                      View Available Exams
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* LBI Progress */}
            <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
              <CardHeader>
                <CardTitle className={theme.text}>Behavioral Assessment Progress</CardTitle>
                <CardDescription className={theme.textMuted}>Your LBI assessment completion</CardDescription>
              </CardHeader>
              <CardContent>
                {lbiInsights.length > 0 ? (
                  <div className="space-y-4" data-testid="lbi-progress-list">
                    {lbiInsights.map(insight => (
                      <div key={insight.id} className="space-y-2" data-testid={`lbi-progress-${insight.id}`}>
                        <div className="flex justify-between items-center">
                          <span className={theme.text}>{insight.category}</span>
                          <span className={`font-semibold ${insight.value >= 80 ? 'text-teal-400' : insight.value >= 60 ? 'text-blue-400' : insight.value >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {Math.round(insight.value)}%
                          </span>
                        </div>
                        <Progress value={insight.value} className="h-2" />
                        {insight.completedAt && (
                          <p className={`text-xs ${theme.textMuted}`}>
                            Completed: {new Date(insight.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain size={48} className={theme.textMuted + " mx-auto mb-4 opacity-50"} />
                    <p className={theme.textMuted}>No assessments completed yet</p>
                    <Button 
                      className="mt-4 text-gray-900 font-semibold hover:opacity-90"
                      style={{ backgroundColor: '#4ECDC4' }}
                      onClick={() => onNavigate('lbi-assessment', { ageBandId: 'ab2', domainId: 'd1' })}
                      data-testid="btn-start-assessment-progress"
                    >
                      Start LBI Assessment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === 'analytics' && (
          <div data-testid="analytics-view">
            {/* Analytics Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 size={22} style={{ color: '#0B3C5D' }} />
                <h2 className="text-xl font-bold" style={{ color: '#0B3C5D' }}>Performance Analytics</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${theme.textMuted}`}>
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAnalytics()}
                  disabled={analyticsLoading}
                  className={`${theme.cardBorder}`}
                  data-testid="btn-refresh-analytics"
                >
                  <RefreshCw size={14} className={analyticsLoading ? 'animate-spin' : ''} />
                  <span className="ml-1">Refresh</span>
                </Button>
              </div>
            </div>

            {analyticsLoading && !analytics ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#4ECDC4] border-t-transparent rounded-full" />
              </div>
            ) : analytics ? (
              <>
                {/* Overall Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: '#0B3C5D' }} data-testid="analytics-total-exams">
                        {analytics.overallStats.totalExams}
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>Total Exams</p>
                    </CardContent>
                  </Card>
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: '#4ECDC4' }} data-testid="analytics-completed">
                        {analytics.overallStats.completedExams}
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>Completed</p>
                    </CardContent>
                  </Card>
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: '#0B3C5D' }} data-testid="analytics-avg-score">
                        {analytics.overallStats.avgScore}%
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>Avg Score</p>
                    </CardContent>
                  </Card>
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: '#4ECDC4' }} data-testid="analytics-best-score">
                        {analytics.overallStats.bestScore}%
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>Best Score</p>
                    </CardContent>
                  </Card>
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-bold text-amber-500`} data-testid="analytics-worst-score">
                        {analytics.overallStats.worstScore}%
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>Lowest Score</p>
                    </CardContent>
                  </Card>
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {analytics.overallStats.improvementRate >= 0 ? (
                          <TrendingUp size={18} style={{ color: '#4ECDC4' }} />
                        ) : (
                          <TrendingDown size={18} className="text-red-500" />
                        )}
                        <p className={`text-2xl font-bold`} style={{ color: analytics.overallStats.improvementRate >= 0 ? '#4ECDC4' : '#ef4444' }}>
                          {analytics.overallStats.improvementRate > 0 ? '+' : ''}{analytics.overallStats.improvementRate}%
                        </p>
                      </div>
                      <p className={`text-xs ${theme.textMuted}`}>Improvement</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Score Trends - AreaChart */}
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-base ${theme.text}`}>Score Trends</CardTitle>
                      <CardDescription>Your exam performance over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {analytics.recentTrends.length > 0 ? (
                        <div data-testid="chart-score-trends" style={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={analytics.recentTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <XAxis dataKey="date" tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }} stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <YAxis domain={[0, 100]} tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }} stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <Tooltip
                                contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`, borderRadius: 8, fontFamily: 'Inter, sans-serif' }}
                                labelStyle={{ color: isDarkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}
                                itemStyle={{ color: '#4ECDC4' }}
                                formatter={(value: number, name: string, props: any) => [`${value}%`, props.payload.examTitle]}
                                labelFormatter={(label) => `Date: ${label}`}
                              />
                              <Area type="monotone" dataKey="score" stroke="#4ECDC4" fill="#4ECDC4" fillOpacity={0.2} strokeWidth={2} dot={{ fill: '#4ECDC4', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#4ECDC4' }} />
                              {analytics.overallStats.avgScore > 0 && (
                                <Area type="monotone" dataKey={() => analytics.overallStats.avgScore} stroke={isDarkMode ? '#d1d5db' : '#6b7280'} strokeDasharray="5 5" fill="none" strokeWidth={1.5} dot={false} name="Average" />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center" style={{ height: 260 }}>
                          <p className={theme.textMuted}>No exam data yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Subject Performance - RadarChart */}
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-base ${theme.text}`}>Subject Performance</CardTitle>
                      <CardDescription>How you're doing in each subject</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {analytics.subjectPerformance.length > 0 ? (
                        <div data-testid="chart-subject-radar" style={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <RadarChart data={analytics.subjectPerformance} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                              <PolarGrid stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 11, fontFamily: 'Inter, sans-serif' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 10 }} stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <Radar name="Avg Score" dataKey="avgScore" stroke="#0B3C5D" fill="#0B3C5D" fillOpacity={0.3} strokeWidth={2} />
                              <Tooltip
                                contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`, borderRadius: 8, fontFamily: 'Inter, sans-serif' }}
                                labelStyle={{ color: isDarkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}
                                formatter={(value: number) => [`${value}%`, 'Avg Score']}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center" style={{ height: 260 }}>
                          <p className={theme.textMuted}>No subject data yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Subject Comparison - Horizontal BarChart */}
                {analytics.subjectPerformance.length > 0 && (
                  <div className="mb-6">
                    <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-base ${theme.text}`}>Subject Comparison</CardTitle>
                        <CardDescription>Average and best scores by subject</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div data-testid="chart-subject-comparison" style={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={analytics.subjectPerformance} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <XAxis type="number" domain={[0, 100]} tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }} stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                              <YAxis type="category" dataKey="subject" tick={{ fill: isDarkMode ? '#d1d5db' : '#6b7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }} stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} width={75} />
                              <Tooltip
                                contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`, borderRadius: 8, fontFamily: 'Inter, sans-serif' }}
                                labelStyle={{ color: isDarkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}
                                formatter={(value: number, name: string) => [`${value}%`, name === 'avgScore' ? 'Avg Score' : 'Best Score']}
                              />
                              <Bar dataKey="avgScore" name="avgScore" fill="#0B3C5D" radius={[0, 4, 4, 0]} barSize={16} />
                              <Bar dataKey="bestScore" name="bestScore" fill="#4ECDC4" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Strengths and Areas to Improve */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} style={{ color: '#4ECDC4' }} />
                        <CardTitle className={`text-base ${theme.text}`}>Your Strengths</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {analytics.strengths.length > 0 ? (
                        <div className="flex flex-wrap gap-2" data-testid="strengths-list">
                          {analytics.strengths.map((strength, idx) => (
                            <Badge 
                              key={idx} 
                              style={{ backgroundColor: isDarkMode ? 'rgba(78, 205, 196, 0.15)' : 'rgba(78, 205, 196, 0.1)', color: isDarkMode ? '#4ECDC4' : '#0B3C5D', border: `1px solid ${isDarkMode ? 'rgba(78, 205, 196, 0.3)' : 'rgba(11, 60, 93, 0.2)'}` }}
                              data-testid={`strength-${idx}`}
                            >
                              <CheckCircle size={12} className="mr-1" />
                              {strength}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${theme.textMuted}`}>Complete more exams to identify your strengths</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Target size={18} style={{ color: '#0B3C5D' }} />
                        <CardTitle className={`text-base ${theme.text}`}>Areas to Improve</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {analytics.areasToImprove.length > 0 ? (
                        <div className="flex flex-wrap gap-2" data-testid="areas-improve-list">
                          {analytics.areasToImprove.map((area, idx) => (
                            <Badge 
                              key={idx} 
                              style={{ backgroundColor: isDarkMode ? 'rgba(11, 60, 93, 0.2)' : 'rgba(11, 60, 93, 0.08)', color: isDarkMode ? '#d1d5db' : '#0B3C5D', border: `1px solid ${isDarkMode ? 'rgba(11, 60, 93, 0.4)' : 'rgba(11, 60, 93, 0.2)'}` }}
                              data-testid={`area-improve-${idx}`}
                            >
                              <ArrowRight size={12} className="mr-1" />
                              {area}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${theme.textMuted}`}>Great job! No major areas needing improvement</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <BarChart3 size={48} className={`mx-auto mb-4 ${theme.textMuted}`} />
                <p className={theme.textMuted}>No analytics data available yet</p>
                <p className={`text-sm ${theme.textMuted} mt-2`}>Complete some exams to see your performance analytics</p>
              </div>
            )}
          </div>
        )}

        {activeView === 'profile' && (() => { setActiveView('dashboard'); return null; })()}
        {false && activeView === '_profile_hidden' && (
          <div data-testid="profile-view" className="space-y-4">

            {/* ── Hero Profile Banner ── */}
            <div className={`rounded-2xl border ${theme.cardBg} ${theme.cardBorder} overflow-hidden`}>
              <div className="h-1.5 w-full" style={{ backgroundColor: BRAND.primary }} />
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Avatar + Identity */}
                  <div className="flex items-start gap-5 flex-1">
                    <div className="relative flex-shrink-0">
                      <div className="h-20 w-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                        <User size={40} className="text-white" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: levelInfo.color, borderColor: isDarkMode ? '#1f2937' : '#fff' }}>
                        {levelInfo.level}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`text-2xl font-bold ${theme.text}`} data-testid="profile-name">{studentProfile?.name || 'Student'}</h2>
                      <p className="text-sm font-semibold mb-2" style={{ color: levelInfo.color }}>{gamification.earnedTitle || levelInfo.title}</p>
                      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${theme.textMuted} mb-3`}>
                        {studentProfile?.age && <span className="flex items-center gap-1" data-testid="profile-age"><User size={11} />{studentProfile.age} yrs</span>}
                        {studentProfile?.grade && <span className="flex items-center gap-1" data-testid="profile-grade"><GraduationCap size={11} />Grade {studentProfile.grade}</span>}
                        {studentProfile?.schoolName && <span className="flex items-center gap-1" data-testid="profile-school"><School size={11} />{studentProfile.schoolName}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }} data-testid="profile-badge-student">Student</span>
                        {studentProfile?.lbiConsent && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }} data-testid="profile-badge-consent">LBI Enabled</span>}
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}>Lv {levelInfo.level} · {levelInfo.title}</span>
                      </div>
                    </div>
                  </div>
                  {/* Gamification pills */}
                  <div className="flex md:flex-col flex-wrap gap-2 md:items-end">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#D9770615', color: '#D97706' }}>
                      <Flame size={14} />
                      {gamification.streakDays} Day Streak
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                      <Zap size={14} />
                      {gamification.xp.toLocaleString()} XP
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#D9770615', color: '#d97706' }}>
                      <Star size={14} />
                      {gamification.coins} Coins
                    </div>
                  </div>
                </div>
                {/* XP Bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium ${theme.textMuted}`}>Level {levelInfo.level} · {xpIntoLevel.toLocaleString()} / {xpForLevel.toLocaleString()} XP</span>
                    <span className="text-xs font-semibold" style={{ color: levelInfo.color }}>{levelProgress}% to Level {levelInfo.level + 1}</span>
                  </div>
                  <div className={`h-2.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${levelProgress}%`, backgroundColor: levelInfo.color }} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── 6 KPI Tiles ── */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {([
                { label: 'Total Exams',  value: totalExams,            color: BRAND.primary,  icon: FileText,    testId: 'profile-stat-exams' },
                { label: 'Completed',   value: completedExams,         color: BRAND.accent,   icon: CheckCircle, testId: 'profile-stat-completed' },
                { label: 'Pending',     value: pendingExams,           color: '#D97706',      icon: Clock,       testId: 'profile-stat-pending' },
                { label: 'Avg Score',   value: `${avgScore}%`,         color: BRAND.primary,  icon: TrendingUp,  testId: 'profile-stat-avg' },
                { label: 'LBI Modules', value: `${completedModules}/7`,color: BRAND.accent,   icon: Brain,       testId: 'profile-stat-assessments' },
                { label: 'Day Streak',  value: gamification.streakDays,color: '#D97706',      icon: Flame,       testId: 'profile-stat-streak' },
              ] as { label: string; value: string | number; color: string; icon: React.ElementType; testId: string }[]).map((kpi) => (
                <div key={kpi.label} className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-3 text-center`} data-testid={kpi.testId}>
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center mx-auto mb-1.5" style={{ backgroundColor: `${kpi.color}15` }}>
                    <kpi.icon size={13} style={{ color: kpi.color }} />
                  </div>
                  <p className="text-xl font-bold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* ── Main 3-col Grid ── */}
            <div className="grid lg:grid-cols-3 gap-4">

              {/* Left 2/3 */}
              <div className="lg:col-span-2 space-y-4">

                {/* Recent Exams */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-3.5 flex items-center justify-between border-b ${theme.cardBorder}`}>
                    <div className="flex items-center gap-2">
                      <FileText size={14} style={{ color: BRAND.primary }} />
                      <h3 className={`text-sm font-semibold ${theme.text}`}>Recent Exam Results</h3>
                    </div>
                    <button onClick={() => onNavigate('student-exam-list', { tab: 'exams' })} className="text-xs font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity" style={{ color: BRAND.primary }}>View All <ChevronRight size={12} /></button>
                  </div>
                  <div className={`divide-y ${isDarkMode ? 'divide-gray-700/50' : 'divide-gray-50'}`}>
                    {recentExams.length > 0 ? recentExams.map((exam) => {
                      const pct = exam.score !== undefined && exam.totalMarks ? Math.round((exam.score / exam.totalMarks) * 100) : exam.score;
                      const scoreColor = pct !== undefined ? (pct >= 75 ? '#4ECDC4' : pct >= 50 ? '#f59e0b' : '#ef4444') : BRAND.primary;
                      return (
                        <div key={exam.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
                            <BookOpen size={13} style={{ color: BRAND.primary }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${theme.text}`}>{exam.title}</p>
                            <p className={`text-xs ${theme.textMuted}`}>{exam.subject}{exam.scheduledDate ? ` · ${new Date(exam.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {pct !== undefined && <span className="text-sm font-bold" style={{ color: scoreColor }}>{pct}%</span>}
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#4ECDC415', color: '#4ECDC4' }}>Done</span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="px-5 py-8 text-center">
                        <FileText size={28} className={`mx-auto mb-2 opacity-25 ${theme.textMuted}`} />
                        <p className={`text-sm ${theme.textMuted}`}>No completed exams yet</p>
                        <button onClick={() => onNavigate('student-exam-list', { tab: 'exams' })} className="mt-2 text-xs font-semibold" style={{ color: BRAND.primary }}>Browse Exams →</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Exams */}
                {upcomingExams.length > 0 && (
                  <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                    <div className={`px-5 py-3.5 flex items-center justify-between border-b ${theme.cardBorder}`}>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} style={{ color: '#D97706' }} />
                        <h3 className={`text-sm font-semibold ${theme.text}`}>Upcoming Exams</h3>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#D9770615', color: '#D97706' }}>{upcomingExams.length} pending</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {upcomingExams.map((exam) => {
                        const daysLeft = exam.scheduledDate ? Math.ceil((new Date(exam.scheduledDate).getTime() - Date.now()) / 86400000) : null;
                        const urgency = daysLeft !== null ? (daysLeft <= 2 ? '#ef4444' : daysLeft <= 7 ? '#D97706' : BRAND.primary) : BRAND.primary;
                        return (
                          <div key={exam.id} className={`rounded-xl border p-4 ${isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{exam.subject}</span>
                              {daysLeft !== null && <span className="text-[10px] font-bold" style={{ color: urgency }}>{daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}</span>}
                            </div>
                            <p className={`text-sm font-semibold truncate ${theme.text}`}>{exam.title}</p>
                            {exam.scheduledDate && <p className={`text-xs mt-1 ${theme.textMuted}`}>{new Date(exam.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
                            <button onClick={() => onNavigate('student-exam-list', { tab: 'exams' })} className="mt-3 w-full text-xs py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>View Details</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subject Performance */}
                {analytics && analytics.subjectPerformance && analytics.subjectPerformance.length > 0 && (
                  <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                    <div className={`px-5 py-3.5 flex items-center gap-2 border-b ${theme.cardBorder}`}>
                      <BarChart2 size={14} style={{ color: BRAND.accent }} />
                      <h3 className={`text-sm font-semibold ${theme.text}`}>Subject Performance</h3>
                    </div>
                    <div className="p-5 space-y-3.5">
                      {analytics.subjectPerformance.slice(0, 6).map((sub: { subject: string; avgScore: number }) => {
                        const barColor = sub.avgScore >= 75 ? '#4ECDC4' : sub.avgScore >= 50 ? BRAND.accent : '#D97706';
                        return (
                          <div key={sub.subject}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-xs font-medium ${theme.text}`}>{sub.subject}</span>
                              <span className="text-xs font-bold" style={{ color: barColor }}>{sub.avgScore}%</span>
                            </div>
                            <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sub.avgScore}%`, backgroundColor: barColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Today's Missions */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`} data-testid="nav-missions">
                  <div className={`px-5 py-3.5 flex items-center justify-between border-b ${theme.cardBorder}`}>
                    <div className="flex items-center gap-2">
                      <Zap size={14} style={{ color: '#D97706' }} />
                      <h3 className={`text-sm font-semibold ${theme.text}`}>Today's Missions</h3>
                    </div>
                    <button onClick={() => setActiveView('missions')} className="text-xs font-medium flex items-center gap-0.5 hover:opacity-80" style={{ color: '#D97706' }}>Go <ChevronRight size={12} /></button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {todayMissions.map((m) => (
                      <div key={m.id} className={`rounded-xl p-3 border flex items-start gap-3 ${m.done ? (isDarkMode ? 'bg-teal-900/20 border-teal-800/40' : 'bg-teal-50 border-teal-100') : (isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-100')}`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${m.done ? 'bg-teal-500' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                          {m.done ? <CheckCircle size={13} className="text-white" /> : <Zap size={13} className={theme.textMuted} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold leading-snug ${m.done ? 'line-through opacity-50' : ''} ${theme.text}`}>{m.label}</p>
                          <p className={`text-[10px] mt-0.5 ${theme.textMuted}`}>+{m.xp} XP · +{m.coins} coins</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right 1/3 */}
              <div className="space-y-4">

                {/* Gamification Panel */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`} data-testid="nav-gamification">
                  <div className="px-5 py-4" style={{ backgroundColor: BRAND.primary }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-white/60 mb-0.5">Your Rank</p>
                        <p className="text-lg font-bold text-white">{levelInfo.title}</p>
                        <p className="text-xs text-white/60 mt-0.5">{gamification.earnedTitle}</p>
                      </div>
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                        <Trophy size={22} className="text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] ${theme.textMuted}`}>Level {levelInfo.level} → {levelInfo.level + 1}</span>
                        <span className="text-[10px] font-semibold" style={{ color: levelInfo.color }}>{levelProgress}%</span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <div className="h-full rounded-full" style={{ width: `${levelProgress}%`, backgroundColor: levelInfo.color }} />
                      </div>
                    </div>
                    {[
                      { label: 'Total XP',       value: gamification.xp.toLocaleString(), icon: Zap,      color: BRAND.accent },
                      { label: 'Coins',          value: gamification.coins,               icon: Star,     color: '#d97706' },
                      { label: 'Streak',         value: `${gamification.streakDays} days`,icon: Flame,    color: '#D97706' },
                      { label: 'Missions Today', value: `${todayMissions.filter(m => m.done).length}/${todayMissions.length}`, icon: CheckCircle, color: '#4ECDC4' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <row.icon size={13} style={{ color: row.color }} />
                          <span className={`text-xs ${theme.textMuted}`}>{row.label}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <button onClick={() => setActiveView('rewards')} className="w-full mt-1 text-xs py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                      View XP & Rewards →
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-3.5 border-b ${theme.cardBorder}`}>
                    <h3 className={`text-sm font-semibold ${theme.text}`}>Quick Actions</h3>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {([
                      { label: 'Career Score', icon: Award,         color: '#6366f1', action: () => onNavigate('student-competency') },
                      { label: 'Study Planner', icon: CalendarDays,  color: '#0B3C5D', action: () => setActiveView('study-planner') },
                      { label: 'Assignments',   icon: ClipboardList, color: '#D97706', action: () => setActiveView('assignments') },
                      { label: 'Wellness',      icon: HeartPulse,    color: '#4ECDC4', action: () => setActiveView('wellness') },
                      { label: 'Career Intel',  icon: Briefcase,     color: BRAND.primary, action: () => onNavigate('student-career-portal') },
                      { label: 'Exam Portal',   icon: GraduationCap, color: '#4ECDC4',     action: () => onNavigate('competitive-exam-portal') },
                      { label: 'Forum',         icon: MessageCircle, color: BRAND.accent, action: () => setActiveView('forum') },
                      { label: 'Collab Hub',    icon: Users,         color: '#0B3C5D', action: () => setActiveView('collab') },
                    ] as { label: string; icon: React.ElementType; color: string; action: () => void }[]).map((qa) => (
                      <button key={qa.label} onClick={qa.action} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all hover:shadow-sm active:scale-95 ${isDarkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${qa.color}18` }}>
                          <qa.icon size={15} style={{ color: qa.color }} />
                        </div>
                        <span className={`text-[10px] font-medium leading-tight ${theme.text}`}>{qa.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* LBI / Behavioral Status */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-3.5 border-b ${theme.cardBorder} flex items-center gap-2`}>
                    <Brain size={14} style={{ color: BRAND.primary }} />
                    <h3 className={`text-sm font-semibold ${theme.text}`}>Behavioral Profile</h3>
                  </div>
                  <div className="p-4">
                    {studentProfile?.lbiConsent ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle size={13} className="text-teal-500" />
                          <span className={`text-xs font-medium ${theme.text}`}>Consent Granted</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { label: 'Strong',     value: strong,         color: '#4ECDC4' },
                            { label: 'Moderate',   value: moderate,        color: BRAND.accent },
                            { label: 'Developing', value: developing,       color: '#f59e0b' },
                            { label: 'Focus',      value: needsAttention,  color: '#ef4444' },
                          ] as { label: string; value: number; color: string }[]).map((s) => (
                            <div key={s.label} className="rounded-xl p-2.5 text-center border" style={{ backgroundColor: `${s.color}10`, borderColor: `${s.color}25` }}>
                              <p className="text-base font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                              <p className={`text-[9px] mt-0.5 ${theme.textMuted}`}>{s.label}</p>
                            </div>
                          ))}
                        </div>
                        <p className={`text-[10px] ${theme.textMuted}`}>{completedModules}/7 modules · {avgLbiScore > 0 ? `Avg ${avgLbiScore}%` : 'Start assessing'}</p>
                        <button
                          onClick={() => onNavigate('student-exam-list', { tab: 'lbi' })}
                          className="w-full text-xs py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}
                          data-testid="btn-take-lbi-assessment"
                        >
                          {completedModules < 7 ? 'Continue Assessment →' : 'View LBI Report →'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: '#f59e0b15' }}>
                          <Lock size={18} className="text-amber-500" />
                        </div>
                        <p className={`text-xs font-semibold mb-1 ${theme.text}`}>Consent Required</p>
                        <p className={`text-[10px] mb-3 ${theme.textMuted}`}>{(studentProfile?.age || 0) < 18 ? 'Parent/guardian must grant consent' : 'Enable to start assessments'}</p>
                        <div className="text-[10px] px-3 py-1.5 rounded-xl font-medium" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>Pending Authorization</div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ── LBI Domain Breakdown (full width) ── */}
            {lbiInsights.length > 0 && (
              <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${theme.cardBorder} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Brain size={15} style={{ color: BRAND.accent }} />
                    <h3 className={`text-sm font-semibold ${theme.text}`}>Behavioral Intelligence — Domain Breakdown</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{completedModules} / 7 Complete</span>
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-4">
                  {lbiInsights.map((insight) => {
                    const barColor = insight.value >= 80 ? '#4ECDC4' : insight.value >= 60 ? BRAND.accent : insight.value >= 40 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={insight.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-medium ${theme.text}`}>{insight.category}</span>
                          <span className="text-xs font-bold" style={{ color: barColor }}>{insight.value}%</span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${insight.value}%`, backgroundColor: barColor }} />
                        </div>
                        <p className={`text-[10px] mt-1 truncate ${theme.textMuted}`}>{insight.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {activeView === 'dashboard' && (
          <>
        {/* ── Enterprise Dashboard ────────────────────────────── */}
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5" data-testid="nav-kpi">
          {([
            { label: 'Total Exams',  value: totalExams,       icon: FileText,   color: BRAND.primary, testId: 'kpi-total-exams' },
            { label: 'Completed',    value: completedExams,   icon: CheckCircle, color: BRAND.accent,  testId: 'kpi-completed'   },
            { label: 'Avg Score',    value: `${avgScore}%`,   icon: TrendingUp,  color: BRAND.primary, testId: 'kpi-avg-score'   },
            { label: 'XP Earned',   value: gamification.xp,  icon: Star,        color: BRAND.accent,  testId: 'kpi-xp'          },
          ] as { label: string; value: string | number; icon: React.ElementType; color: string; testId: string }[]).map((kpi) => (
            <div key={kpi.label} className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 flex items-center gap-3`} data-testid={kpi.testId}>
              <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${kpi.color}14` }}>
                <kpi.icon size={16} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Enterprise Grid */}
        <div className="grid lg:grid-cols-3 gap-4 mb-4">

          {/* Left: Feature Nav (2/3) */}
          <div className="lg:col-span-2 space-y-4" data-testid="nav-quick-access">
            <div className="flex items-center justify-between">
              <p className={`text-[11px] font-semibold uppercase tracking-widest ${theme.textMuted}`}>Quick Access</p>
              {upcomingExams.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
                  {upcomingExams.length} exam{upcomingExams.length !== 1 ? 's' : ''} pending
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2" data-testid="stats-grid">
              {([
                { label: 'My Exams',       sub: `${completedExams} done · ${pendingExams} pending`,       value: totalExams,                                        icon: FileText,                           color: BRAND.primary, testId: 'stat-total-exams', action: () => onNavigate('student-exam-list', { tab: 'exams' }) },
                { label: 'LBI Assessment', sub: consentRequired ? 'Awaiting consent' : 'Behavioural intelligence', value: `${completedModules}/7`,                  icon: consentRequired ? Lock : Brain,     color: BRAND.accent,  testId: 'stat-lbi',        action: () => !consentRequired && onNavigate('student-exam-list', { tab: 'lbi' }), disabled: consentRequired },
                { label: 'Exam Readiness', sub: 'Avg performance',                                         value: `${avgScore}%`,                                    icon: Target,                             color: BRAND.accent,  testId: 'stat-avg-score',  action: () => onNavigate('exam-ready') },
                { label: 'Daily Missions', sub: 'Earn XP & coins today',                                   value: `${todayMissions.filter(m=>m.done).length}/${todayMissions.length}`, icon: Zap,            color: '#D97706',     testId: 'stat-missions',   action: () => setActiveView('missions') },
                { label: 'Learning Forum', sub: 'Ask peers & mentors',                                     value: 'Q&A',                                             icon: MessageCircle,                      color: BRAND.primary, testId: 'stat-forum',      action: () => setActiveView('forum') },
                { label: 'XP & Rewards',   sub: 'Redeem your coins',                                       value: gamification.coins,                                icon: Trophy,                             color: '#D97706',     testId: 'stat-rewards',    action: () => setActiveView('rewards') },
                { label: 'Collab Hub',     sub: 'Connect & study together',                                value: 'Hub',                                             icon: Users,                              color: BRAND.accent,  testId: 'stat-collab',     action: () => setActiveView('collab') },
                { label: 'Study Planner', sub: 'Track daily study tasks',                                  value: 'Plan',                                            icon: Calendar,                           color: '#0B3C5D',     testId: 'stat-planner',    action: () => setActiveView('study-planner') },
                { label: 'Assignments',   sub: 'Tests, tasks & sessions',                                  value: 'View',                                            icon: BookOpen,                           color: '#D97706',     testId: 'stat-assignments', action: () => setActiveView('assignments') },
              ] as { label: string; sub: string; value: string | number; icon: React.ElementType; color: string; testId: string; action: () => void; disabled?: boolean }[]).map((card) => (
                <button
                  key={card.label}
                  onClick={card.action}
                  disabled={card.disabled}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150 group
                    ${card.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm hover:-translate-y-px active:scale-[0.99]'}
                    ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
                >
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${card.color}16` }}>
                    <card.icon size={16} style={{ color: card.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-none ${theme.text}`}>{card.label}</p>
                    <p className={`text-xs mt-0.5 truncate ${theme.textMuted}`}>{card.sub}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-base font-semibold" style={{ color: card.color }} data-testid={card.testId}>{card.value}</span>
                    <ChevronRight size={12} className={`${theme.textMuted} opacity-0 group-hover:opacity-50 transition-opacity`} />
                  </div>
                </button>
              ))}
            </div>

            {studentProfile && (
              <div>
                <AIStudyRecommendations childId={studentProfile.id} childName={studentProfile.name || 'Student'} />
              </div>
            )}

            {/* Recent Exam Results */}
            <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
              <div className={`px-5 py-3.5 flex items-center justify-between border-b ${theme.cardBorder}`}>
                <div className="flex items-center gap-2">
                  <FileText size={14} style={{ color: BRAND.primary }} />
                  <h3 className={`text-sm font-semibold ${theme.text}`}>Recent Exam Results</h3>
                </div>
                <button onClick={() => onNavigate('student-exam-list', { tab: 'exams' })} className="text-xs font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity" style={{ color: BRAND.primary }}>View All <ChevronRight size={12} /></button>
              </div>
              <div className={`divide-y ${isDarkMode ? 'divide-gray-700/40' : 'divide-gray-50'}`}>
                {recentExams.length > 0 ? recentExams.map((exam) => {
                  const pct = exam.score !== undefined && exam.totalMarks ? Math.round((exam.score / exam.totalMarks) * 100) : exam.score;
                  const scoreColor = pct !== undefined ? (pct >= 75 ? '#4ECDC4' : pct >= 50 ? '#f59e0b' : '#ef4444') : BRAND.primary;
                  return (
                    <div key={exam.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
                        <BookOpen size={13} style={{ color: BRAND.primary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${theme.text}`}>{exam.title}</p>
                        <p className={`text-xs ${theme.textMuted}`}>{exam.subject}{exam.scheduledDate ? ` · ${new Date(exam.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {pct !== undefined && <span className="text-sm font-bold" style={{ color: scoreColor }}>{pct}%</span>}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#4ECDC415', color: '#4ECDC4' }}>Done</span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="px-5 py-6 text-center">
                    <FileText size={24} className={`mx-auto mb-2 opacity-20 ${theme.textMuted}`} />
                    <p className={`text-sm ${theme.textMuted}`}>No completed exams yet</p>
                    <button onClick={() => onNavigate('student-exam-list', { tab: 'exams' })} className="mt-1 text-xs font-semibold" style={{ color: BRAND.primary }}>Browse Exams →</button>
                  </div>
                )}
              </div>
            </div>

            {/* Subject Performance */}
            {analytics && analytics.subjectPerformance && analytics.subjectPerformance.length > 0 && (
              <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                <div className={`px-5 py-3.5 flex items-center gap-2 border-b ${theme.cardBorder}`}>
                  <BarChart2 size={14} style={{ color: BRAND.accent }} />
                  <h3 className={`text-sm font-semibold ${theme.text}`}>Subject Performance</h3>
                </div>
                <div className="p-5 space-y-3.5">
                  {analytics.subjectPerformance.slice(0, 5).map((sub: { subject: string; avgScore: number }) => {
                    const barColor = sub.avgScore >= 75 ? '#4ECDC4' : sub.avgScore >= 50 ? BRAND.accent : '#D97706';
                    return (
                      <div key={sub.subject}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-medium ${theme.text}`}>{sub.subject}</span>
                          <span className="text-xs font-bold" style={{ color: barColor }}>{sub.avgScore}%</span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sub.avgScore}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Right: Gamification Panel (1/3) */}
          <div className="space-y-3">
            {/* Level + XP */}
            <div className="rounded-xl overflow-hidden" style={{ background: `#0a2d47` }}>
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: BRAND.accent }}>{levelInfo.title}</p>
                    <p className="text-2xl font-semibold text-white leading-none">
                      {gamification.xp} <span className="text-sm font-normal text-white/40">XP</span>
                    </p>
                    {nextLevel && <p className="text-[10px] text-white/35 mt-1">{nextLevel.minXp - gamification.xp} XP to Level {nextLevel.level}</p>}
                  </div>
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-xl font-semibold text-white flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.15)' }}>
                    {levelInfo.level}
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <div className="h-full rounded-full" style={{ width: `${levelProgress}%`, background: `#86efba` }} />
                </div>
                <p className="text-[9px] text-white/30 mt-1 text-right">{levelProgress}%</p>
              </div>
            </div>

            {/* Motivator Tiles */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { emoji: '🪙', value: gamification.coins,                        label: 'Coins',   color: BRAND.accent, action: () => setActiveView('rewards')  },
                { emoji: '🔥', value: gamification.streakDays,                   label: 'Streak',  color: '#D97706',    action: () => setActiveView('missions') },
                { emoji: '🏅', value: todayMissions.filter(m => m.done).length, label: 'Done',    color: '#D97706',    action: () => setActiveView('missions') },
              ] as { emoji: string; value: number; label: string; color: string; action: () => void }[]).map((t) => (
                <button key={t.label} onClick={t.action}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all hover:scale-[1.03] active:scale-[0.97] ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                  <span className="text-xl leading-none mb-1.5">{t.emoji}</span>
                  <span className="text-base font-semibold leading-none" style={{ color: t.color }}>{t.value}</span>
                  <span className={`text-[9px] mt-0.5 ${theme.textMuted}`}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Today's Missions */}
            <div className={`rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${isDarkMode ? '#374151' : '#f3f4f6'}` }}>
                <p className={`text-xs font-semibold ${theme.text}`}>Today&rsquo;s Missions</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.accent}18`, color: BRAND.accent }}>
                  {todayMissions.filter(m => m.done).length}/{todayMissions.length}
                </span>
              </div>
              <div className="p-2 space-y-0.5">
                {todayMissions.slice(0, 4).map((m) => (
                  <div key={m.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg ${m.done ? (isDarkMode ? 'bg-[#4ECDC4]/08' : 'bg-[#4ECDC4]/05') : ''}`}>
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${m.done ? '' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-100')}`}
                      style={m.done ? { backgroundColor: `${BRAND.accent}25` } : {}}>
                      {m.done ? <CheckCircle size={11} style={{ color: BRAND.accent }} /> : <div className={`h-1.5 w-1.5 rounded-full ${isDarkMode ? 'bg-gray-500' : 'bg-gray-300'}`} />}
                    </div>
                    <p className={`text-xs flex-1 leading-snug ${m.done ? theme.textMuted + ' line-through' : theme.text}`}>{m.label}</p>
                    <span className={`text-[9px] font-medium whitespace-nowrap ${theme.textMuted}`}>+{m.xp} XP</span>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3">
                <button onClick={() => setActiveView('missions')}
                  className="w-full text-xs font-medium py-2 rounded-lg transition-colors"
                  style={{ color: BRAND.primary, backgroundColor: `${BRAND.primary}08` }}>
                  View all missions &rarr;
                </button>
              </div>
            </div>

            {/* Next Exam pill */}
            {upcomingExams[0] && (
              <div className={`rounded-xl border p-3.5 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${theme.textMuted}`}>Next Exam</p>
                <p className={`text-sm font-medium leading-snug ${theme.text}`}>{upcomingExams[0].title}</p>
                <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{upcomingExams[0].subject}</p>
                <button className="mt-3 w-full text-xs font-semibold py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: BRAND.primary }}
                  onClick={() => onNavigate('student-exam-list', { tab: 'exams' })}
                  data-testid="btn-start-next-exam">
                  Start Now
                </button>
              </div>
            )}

            {/* Behavioral Profile card */}
            <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className={`px-4 py-3 flex items-center gap-2 border-b ${theme.cardBorder}`}>
                <Brain size={13} style={{ color: BRAND.primary }} />
                <h3 className={`text-xs font-semibold ${theme.text}`}>Behavioral Profile</h3>
              </div>
              <div className="p-3">
                {studentProfile?.lbiConsent ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={12} className="text-teal-500" />
                      <span className={`text-[10px] font-medium ${theme.text}`}>Consent Granted · {completedModules}/7 modules</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { label: 'Strong',     value: strong,        color: '#4ECDC4' },
                        { label: 'Moderate',   value: moderate,       color: BRAND.accent },
                        { label: 'Developing', value: developing,     color: '#f59e0b' },
                        { label: 'Focus',      value: needsAttention, color: '#ef4444' },
                      ] as { label: string; value: number; color: string }[]).map((s) => (
                        <div key={s.label} className="rounded-lg p-2 text-center border" style={{ backgroundColor: `${s.color}10`, borderColor: `${s.color}20` }}>
                          <p className="text-sm font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                          <p className={`text-[9px] mt-0.5 ${theme.textMuted}`}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {avgLbiScore > 0 && <p className={`text-[10px] ${theme.textMuted}`}>Average score: {avgLbiScore}%</p>}
                    <button
                      onClick={() => onNavigate('student-exam-list', { tab: 'lbi' })}
                      className="w-full text-[10px] py-1.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}
                    >
                      {completedModules < 7 ? 'Continue Assessment →' : 'View LBI Report →'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-1">
                    <Lock size={16} className="mx-auto mb-1.5 text-amber-500" />
                    <p className={`text-[10px] font-semibold ${theme.text}`}>Consent Required</p>
                    <p className={`text-[9px] mt-0.5 ${theme.textMuted}`}>{(studentProfile?.age || 0) < 18 ? 'Parent must grant consent' : 'Enable to start assessments'}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Analytics Row */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity size={15} style={{ color: BRAND.accent }} />
                <CardTitle className={`text-sm font-semibold ${theme.text}`}>Overall Progress</CardTitle>
              </div>
              <CardDescription className={`text-xs ${theme.textMuted}`}>Academic &amp; behavioral performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${theme.text}`}>Academic Performance</span>
                  <span className="text-xs font-semibold" style={{ color: avgScore >= 60 ? BRAND.accent : '#f59e0b' }}>{avgScore}%</span>
                </div>
                <Progress value={avgScore} className="h-1.5" />
                <p className={`text-[10px] ${theme.textMuted} mt-1`}>Based on {completedExams} exam{completedExams !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${theme.text}`}>Behavioral Profile</span>
                  <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>{totalLbiScore}/{maxLbiScore}</span>
                </div>
                <Progress value={(totalLbiScore / maxLbiScore) * 100} className="h-1.5" />
                <p className={`text-[10px] ${theme.textMuted} mt-1`}>{completedModules}/{totalModules} modules</p>
              </div>
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`} data-testid="cycles-history">
                <div className="flex items-center justify-between mb-2.5">
                  <p className={`text-xs font-medium ${theme.text}`}>Performance History</p>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-500 border-amber-500/25">Projected</Badge>
                </div>
                {(() => {
                  const s = avgLbiScore || avgScore;
                  return [
                    { label: 'Current',     score: s },
                    { label: 'Jul–Dec 25',  score: Math.max(40, s - 8) },
                    { label: 'Jan–Jun 25',  score: Math.max(35, s - 15) },
                    { label: 'Jul–Dec 24',  score: Math.max(30, s - 22) },
                  ].map((c, i) => (
                    <div key={c.label} className="flex items-center gap-2 mb-1.5 last:mb-0">
                      <span className={`text-[10px] w-16 flex-shrink-0 font-medium ${i !== 0 ? theme.textMuted : ''}`} style={{ color: i === 0 ? BRAND.accent : undefined }}>{c.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                        <div className="h-full rounded-full" style={{ width: `${c.score}%`, backgroundColor: i === 0 ? BRAND.accent : BRAND.primary, opacity: i === 0 ? 1 : 0.45 }} />
                      </div>
                      <span className={`text-[10px] w-6 text-right flex-shrink-0 ${theme.textMuted}`}>{c.score}%</span>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className={`${theme.cardBg} ${theme.cardBorder} border`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <PieChart size={15} style={{ color: BRAND.accent }} />
                <CardTitle className={`text-sm font-semibold ${theme.text}`}>Score Distribution</CardTitle>
              </div>
              <CardDescription className={`text-xs ${theme.textMuted}`}>Click segments to see details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-5">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      const total = completedModules || 1;
                      const pieData = [
                        { value: strong,       color: '#4ECDC4', hoverColor: '#4ECDC4', label: 'Strong'          },
                        { value: moderate,     color: '#0B3C5D', hoverColor: '#0B3C5D', label: 'Moderate'        },
                        { value: developing,   color: '#f59e0b', hoverColor: '#d97706', label: 'Developing'      },
                        { value: needsAttention, color: '#ef4444', hoverColor: '#dc2626', label: 'Needs Attention' }
                      ].filter(d => d.value > 0);
                      if (pieData.length === 0) return <circle cx="50" cy="50" r="40" fill={isDarkMode ? '#374151' : '#e5e7eb'} />;
                      let ca = 0;
                      return pieData.map((seg, idx) => {
                        const angle = (seg.value / total) * 360;
                        const sa = ca; ca += angle;
                        const isSel = selectedPieSegment === seg.label;
                        const r = isSel ? 43 : 40;
                        const s = (sa * Math.PI) / 180, e = ((sa + angle) * Math.PI) / 180;
                        if (pieData.length === 1) return (
                          <circle key={idx} cx="50" cy="50" r={r} fill={isSel ? seg.hoverColor : seg.color}
                            className="cursor-pointer" data-testid={`pie-segment-${seg.label.toLowerCase().replace(/\s+/g,'-')}`}
                            onClick={() => setSelectedPieSegment(isSel ? null : seg.label)} />
                        );
                        return (
                          <path key={idx}
                            d={`M 50 50 L ${50+r*Math.cos(s)} ${50+r*Math.sin(s)} A ${r} ${r} 0 ${angle>180?1:0} 1 ${50+r*Math.cos(e)} ${50+r*Math.sin(e)} Z`}
                            fill={isSel ? seg.hoverColor : seg.color}
                            className="cursor-pointer hover:opacity-90 transition-all"
                            data-testid={`pie-segment-${seg.label.toLowerCase().replace(/\s+/g,'-')}`}
                            style={{ filter: isSel ? 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' : 'none' }}
                            onClick={() => setSelectedPieSegment(isSel ? null : seg.label)} />
                        );
                      });
                    })()}
                    <circle cx="50" cy="50" r="22" fill={isDarkMode ? '#1f2937' : 'white'} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-base font-semibold ${theme.text}`}>
                      {selectedPieSegment
                        ? (selectedPieSegment==='Strong' ? strong : selectedPieSegment==='Moderate' ? moderate : selectedPieSegment==='Developing' ? developing : needsAttention)
                        : completedModules}
                    </span>
                    <span className={`text-[9px] ${theme.textMuted} text-center px-1 leading-tight`}>{selectedPieSegment || 'Modules'}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5" data-testid="pie-legend">
                  {[
                    { label: 'Strong',         range: '80%+',   color: 'bg-teal-500', value: strong        },
                    { label: 'Moderate',       range: '60–79%', color: 'bg-blue-500',  value: moderate      },
                    { label: 'Developing',     range: '40–59%', color: 'bg-amber-500', value: developing    },
                    { label: 'Needs Attention',range: '<40%',   color: 'bg-red-500',   value: needsAttention},
                  ].map((item) => (
                    <div key={item.label} data-testid={`legend-item-${item.label.toLowerCase().replace(/\s+/g,'-')}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs
                        ${selectedPieSegment===item.label ? (isDarkMode?'bg-gray-700':'bg-gray-100') : (isDarkMode?'hover:bg-gray-700/50':'hover:bg-gray-50')}
                        ${item.value===0?'opacity-35 cursor-not-allowed':''}`}
                      onClick={() => item.value>0 && setSelectedPieSegment(selectedPieSegment===item.label?null:item.label)}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                      <span className={theme.text}>{item.label}</span>
                      <span className={`ml-auto font-medium ${theme.text}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selectedPieSegment && (
                <div className={`mt-3 p-3 rounded-lg border ${isDarkMode?'bg-gray-700/50 border-gray-600':'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-xs font-medium mb-1.5 ${theme.text}`}>{selectedPieSegment} Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {lbiInsights.filter(i => {
                      if (selectedPieSegment==='Strong') return i.value>=80;
                      if (selectedPieSegment==='Moderate') return i.value>=60&&i.value<80;
                      if (selectedPieSegment==='Developing') return i.value>=40&&i.value<60;
                      return i.value<40;
                    }).map(i => <Badge key={i.id} variant="secondary" className="text-[10px]">{i.category}: {i.value}%</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Exams + LBI Row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* My Exams */}
          <Card className={`${theme.cardBg} ${theme.cardBorder} border overflow-hidden`}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${isDarkMode?'#374151':'#f3f4f6'}` }}>
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: BRAND.primary }} />
                <p className={`text-sm font-semibold ${theme.text}`}>My Exams</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: BRAND.accent }}><span data-testid="stat-completed">{completedExams}</span> done</span>
                <span className={`text-xs ${theme.textMuted}`}><span data-testid="stat-pending">{pendingExams}</span> pending</span>
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-xl ${isDarkMode?'bg-gray-700/40':'bg-gray-50'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}18` }}>
                    <Trophy size={14} style={{ color: BRAND.accent }} />
                  </div>
                  <span className={`text-sm ${theme.textMuted}`}>Average Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold" style={{ color: BRAND.primary }}>{avgScore}%</span>
                  <Badge className="text-[10px] h-5 px-1.5 border-none"
                    style={{ backgroundColor: avgScore>=80?`${BRAND.accent}20`:avgScore>=60?`${BRAND.primary}14`:'#f59e0b20', color: avgScore>=80?BRAND.accent:avgScore>=60?BRAND.primary:'#f59e0b' }}>
                    {avgScore>=80?'Excellent':avgScore>=60?'Good':'Keep Going'}
                  </Badge>
                </div>
              </div>
              {upcomingExams.length > 0 ? (
                <div className="space-y-2" data-testid="upcoming-exams-list">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.textMuted}`}>Upcoming</p>
                  {upcomingExams.slice(0,2).map(exam => (
                    <div key={exam.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors group ${isDarkMode?'hover:bg-gray-700/40':'hover:bg-gray-50'}`}
                      onClick={() => onSelectExam?.(exam.id)} data-testid={`exam-card-${exam.id}`}>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND.primary}12` }}>
                        <BookOpen size={13} style={{ color: BRAND.primary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${theme.text}`}>{exam.title}</p>
                        <p className={`text-xs ${theme.textMuted}`}>{exam.subject}{exam.duration?` · ${exam.duration} min`:''}</p>
                      </div>
                      <ChevronRight size={13} className={`${theme.textMuted} group-hover:translate-x-0.5 transition-transform flex-shrink-0`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-5 rounded-xl ${isDarkMode?'bg-gray-700/30':'bg-gray-50'}`}>
                  <CheckCircle size={20} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
                  <p className={`text-sm font-medium ${theme.text}`}>All caught up!</p>
                </div>
              )}
              <Button className="w-full text-white h-9 text-sm gap-2 hover:opacity-90" style={{ backgroundColor: BRAND.primary }}
                onClick={() => onNavigate('student-exam-list', { tab: 'exams' })} data-testid="view-all-exams">
                <FileText size={13} /> View All Exams <ArrowRight size={12} />
              </Button>
            </CardContent>
          </Card>

          {/* LBI Assessment */}
          <Card className={`${theme.cardBg} ${theme.cardBorder} border overflow-hidden`}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${isDarkMode?'#374151':'#f3f4f6'}` }}>
              <div className="flex items-center gap-2">
                <Brain size={14} style={{ color: BRAND.accent }} />
                <p className={`text-sm font-semibold ${theme.text}`}>LBI Assessment</p>
              </div>
              <span className="text-xs" style={{ color: BRAND.accent }}>{completedModules}/7 complete</span>
            </div>
            <CardContent className="p-4 space-y-3">
              <div className={`p-3 rounded-xl ${isDarkMode?'bg-gray-700/40':'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs ${theme.textMuted}`}>Assessment Progress</span>
                  <span className="text-sm font-semibold" style={{ color: BRAND.accent }}>{completedModules}/7</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDarkMode?'#374151':'#e5e7eb' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(completedModules/7)*100}%`, backgroundColor: BRAND.accent }} />
                </div>
              </div>
              {consentRequired ? (
                <div className={`text-center py-5 rounded-xl ${isDarkMode?'bg-gray-700/30':'bg-gray-50'}`} data-testid="consent-required-notice">
                  <Lock size={20} className="mx-auto mb-2 text-amber-500" />
                  <p className={`text-sm font-medium ${theme.text}`}>Parental Consent Required</p>
                  <p className={`text-xs mt-1 ${theme.textMuted}`}>Your parent must approve behavioral assessments</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Cognitive Style', icon: Brain,    done: completedModules >= 1 },
                    { name: 'Emotional IQ',    icon: Heart,    done: completedModules >= 2 },
                    { name: 'Social Skills',   icon: Users,    done: completedModules >= 3 },
                    { name: 'Learning Type',   icon: BookOpen, done: completedModules >= 4 },
                  ].map(m => (
                    <div key={m.name} className={`flex items-center gap-2 p-2.5 rounded-lg ${isDarkMode?'bg-gray-700/40':'bg-gray-50'} ${m.done?'':'opacity-50'}`}>
                      <m.icon size={12} style={{ color: m.done ? BRAND.accent : undefined }} />
                      <span className={`text-xs font-medium ${theme.text}`}>{m.name}</span>
                      {m.done && <CheckCircle size={10} className="ml-auto flex-shrink-0 text-teal-500" />}
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full text-gray-900 font-semibold h-9 text-sm gap-2 hover:opacity-90" style={{ backgroundColor: BRAND.accent }}
                onClick={() => onNavigate('student-exam-list', { tab: 'lbi' })} data-testid="view-all-lbi" disabled={consentRequired}>
                <Brain size={13} /> {completedModules<7?'Continue Assessment':'View Full Report'} <ArrowRight size={12} />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Results */}
        {recentExams.length > 0 && (
          <Card className={`${theme.cardBg} ${theme.cardBorder} border mt-4`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Award size={14} style={{ color: BRAND.accent }} />
                <CardTitle className={`text-sm font-semibold ${theme.text}`}>Recent Results</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-5 gap-2" data-testid="recent-results-grid">
                {recentExams.map(exam => (
                  <div key={exam.id} className={`p-3 rounded-xl text-center border ${isDarkMode?'bg-gray-700/40 border-gray-700':'bg-gray-50 border-gray-100'}`}
                    data-testid={`recent-exam-${exam.id}`}>
                    <p className={`text-xs font-medium truncate ${theme.text}`} data-testid={`recent-exam-title-${exam.id}`}>{exam.title}</p>
                    <p className="text-xl font-semibold mt-1" style={{ color: (exam.score||0)>=60?BRAND.accent:'#f59e0b' }}
                      data-testid={`recent-exam-score-${exam.id}`}>{exam.score||0}%</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>{exam.subject}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
          </>
        )}

        {/* Forum View */}
        {activeView === 'forum' && (
          <div data-testid="forum-view" className="space-y-6">
            <StudentLearningForum isStudentView={true} />
          </div>
        )}

        {/* Collab Hub View */}
        {activeView === 'collab' && (
          <div data-testid="collab-view">
            <StudentCollabHub
              currentUserId={userData?.id}
              currentUserName={userData?.fullName || 'Student'}
            />
          </div>
        )}

        {/* ─── STUDY PLANNER VIEW ─── */}
        {activeView === 'study-planner' && (
          <div data-testid="study-planner-view">
            <StudentStudyPlanner
              isDarkMode={isDarkMode}
              onNavigate={(view) => setActiveView(view as ActiveView)}
            />
          </div>
        )}

        {/* ─── ASSIGNMENTS VIEW ─── */}
        {activeView === 'assignments' && !activeParentTestId && (
          <div data-testid="assignments-view">
            <StudentAssignments
              isDarkMode={isDarkMode}
              onStartExam={(templateId, assignmentId) => onNavigate('student-exam-list', { tab: 'exams', templateId, assignmentId })}
              onStartParentTest={(id) => setActiveParentTestId(id)}
            />
          </div>
        )}

        {/* ─── EDUCATION PLANNER ─── */}
        {activeView === 'education' && (
          <div data-testid="education-view">
            <ParentEducationPlanner
              childId={studentProfile?.id ?? ''}
              childName={studentProfile?.name ?? 'Student'}
              childGrade={studentProfile?.grade ?? undefined}
            />
          </div>
        )}

        {/* ─── AI REPORTS ─── */}
        {activeView === 'ai-reports' && studentProfile && (
          <div data-testid="ai-reports-view">
            <AIStudyRecommendations
              childId={studentProfile.id}
              childName={studentProfile.name}
            />
          </div>
        )}

        {/* ─── METRYXAI ASSISTANT — redirects to AI Reports ─── */}
        {activeView === 'metryxai' && (() => { setActiveView('ai-reports'); return null; })()}

        {/* ─── MY PACKAGES ─── */}
        {activeView === 'packages' && (
          <div data-testid="packages-view" className="space-y-4">
            <h2 className={`text-lg font-semibold ${theme.text}`}>My Packages</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'Student Starter', status: 'Active', color: BRAND.accent, features: ['LBI Assessment', 'Exam Readiness', '5 Exams/month', 'AI Reports (Basic)'] },
                { name: 'Student Pro',     status: 'Upgrade', color: BRAND.primary, features: ['Everything in Starter', 'Unlimited Exams', 'Mentor Sessions (2/mo)', 'Advanced AI Reports', 'Education Planner'] },
                { name: 'Student Elite',  status: 'Upgrade', color: '#0B3C5D', features: ['Everything in Pro', 'Priority Mentor Access', 'Career Intelligence', 'Scholarship Finder', 'Dedicated Counsellor'] },
              ].map(pkg => (
                <div key={pkg.name} className={`rounded-xl border p-5 flex flex-col gap-3 ${theme.cardBg} ${theme.cardBorder}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${theme.text}`}>{pkg.name}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: pkg.status === 'Active' ? `${pkg.color}20` : '#f3f4f6', color: pkg.status === 'Active' ? pkg.color : '#6b7280' }}>{pkg.status}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {pkg.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs" style={{ color: isDarkMode ? '#9ca3af' : '#64748b' }}>
                        <CheckCircle size={12} style={{ color: pkg.color, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {pkg.status !== 'Active' && (
                    <Button size="sm" className="mt-auto text-white text-xs" style={{ backgroundColor: pkg.color }}>
                      Upgrade
                    </Button>
                  )}
                  {pkg.status === 'Active' && (
                    <p className="text-[11px] mt-auto" style={{ color: BRAND.accent }}>✓ Currently active</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── MENTOR SERVICES ─── */}
        {activeView === 'mentor-services' && (
          <div data-testid="mentor-services-view">
            <ParentMentorServices
              selectedChild={studentProfile ? {
                id: studentProfile.id,
                name: studentProfile.name,
                grade: studentProfile.grade,
                age: studentProfile.age,
                lbiConsent: studentProfile.lbiConsent,
              } : null}
              onNavigate={(screen, data) => onNavigate(screen as any, data)}
            />
          </div>
        )}

        {/* ─── EXAM READINESS INDEX ─── */}
        {activeView === 'exam-ready' && (
          <div data-testid="exam-ready-view" className="space-y-6 max-w-3xl mx-auto">

            {/* Hero */}
            <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(11,60,93,0.18)', background: 'rgba(11,60,93,0.04)' }}>
              <div className="flex flex-wrap gap-2 mb-4">
                {[{ label: '30–40 minutes' }, { label: 'Ages 10–18' }, { label: 'New', accent: true }].map(t => (
                  <span key={t.label} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                    style={{ borderColor: t.accent ? '#4ECDC4' : 'rgba(11,60,93,0.25)', color: t.accent ? '#4ECDC4' : '#0B3C5D', background: t.accent ? 'rgba(78,205,196,0.08)' : 'rgba(11,60,93,0.06)' }}>
                    {t.label}
                  </span>
                ))}
              </div>
              <h2 className="text-2xl font-black mb-1" style={{ color: '#0B3C5D' }}>
                ExamReadiness Index<span className="text-base align-super" style={{ color: '#4ECDC4' }}>™</span>
              </h2>
              <p className="text-base font-semibold text-gray-600 mb-2">Measure Psychological Exam Readiness, Not Academic Knowledge</p>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                Reveals whether you are mentally, emotionally, and strategically prepared to perform at your best — regardless of how much you have studied. Powered by the LBI engine.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { val: '6',      unit: 'Modules',       sub: '22 subdomains' },
                  { val: '100+',   unit: 'Questions',     sub: 'age-adaptive' },
                  { val: '5',      unit: 'Report Types',  sub: 'AI-powered' },
                  { val: 'Instant', unit: 'Analysis',     sub: 'real-time AI' },
                ].map(s => (
                  <div key={s.unit} className="rounded-xl border text-center py-3 px-2" style={{ borderColor: 'rgba(11,60,93,0.15)', background: '#ffffff' }}>
                    <div className="text-2xl font-black" style={{ color: '#0B3C5D' }}>{s.val}</div>
                    <div className="text-xs font-bold text-gray-700">{s.unit}</div>
                    <div className="text-[10px] text-gray-400">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mb-5">
                <button onClick={() => onNavigate('exam-ready')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: '#0B3C5D', color: '#ffffff' }}>
                  <Target size={15} /> Start Assessment
                </button>
                <button onClick={() => onNavigate('exam-ready-compare')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
                  style={{ borderColor: '#0B3C5D', color: '#0B3C5D', background: '#ffffff' }}>
                  Compare Plans
                </button>
              </div>

              {/* Trust markers */}
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: <CheckCircle size={13} />, label: 'Non-Diagnostic' },
                  { icon: <Shield size={13} />, label: 'DPDP Compliant' },
                  { icon: <Brain size={13} />, label: 'AI-Powered Reports' },
                  { icon: <Lock size={13} />, label: '256-bit Encrypted' },
                ].map(m => (
                  <span key={m.label} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <span style={{ color: '#4ECDC4' }}>{m.icon}</span>{m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Feature pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <GraduationCap size={18} />, title: 'Beyond Academics', sub: 'Measures readiness, not knowledge' },
                { icon: <Brain size={18} />,          title: 'AI-Powered',       sub: '5 report types with AI insights' },
                { icon: <Target size={18} />,          title: 'Behavioural Focus', sub: 'Psychological exam preparedness' },
                { icon: <Lock size={18} />,            title: 'Privacy First',    sub: 'DPDP compliant, encrypted' },
              ].map(p => (
                <div key={p.title} className="rounded-xl border p-4 flex flex-col gap-2" style={{ borderColor: 'rgba(11,60,93,0.12)', background: '#ffffff' }}>
                  <span style={{ color: '#4ECDC4' }}>{p.icon}</span>
                  <p className="text-sm font-bold text-gray-800 leading-tight">{p.title}</p>
                  <p className="text-xs text-gray-500 leading-snug">{p.sub}</p>
                </div>
              ))}
            </div>

            {/* 6 Dimensions */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#4ECDC4' }}>What We Measure</p>
              <h3 className="text-lg font-black mb-1" style={{ color: '#0B3C5D' }}>6 Dimensions of Exam Readiness</h3>
              <p className="text-xs text-gray-500 mb-4">Not how much you have studied — but whether you are psychologically prepared to perform.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: <Brain size={16} />,         title: 'Mental Preparedness',    sub: 'Cognitive readiness, processing speed under time constraints, and mental stamina for long exams' },
                  { icon: <Heart size={16} />,          title: 'Emotional Resilience',   sub: 'Ability to manage anxiety, maintain composure, and channel stress productively during exams' },
                  { icon: <BarChart3 size={16} />,      title: 'Pressure Tolerance',     sub: 'Capacity to handle setbacks, time pressure, unexpected questions, and competitive environments' },
                  { icon: <TrendingUp size={16} />,     title: 'Strategic Thinking',     sub: 'Question prioritisation, time allocation, difficulty assessment, and exam navigation strategies' },
                  { icon: <BookOpen size={16} />,       title: 'Metacognitive Awareness', sub: 'Self-monitoring during exams — knowing what you know, skipping strategically, and reviewing efficiently' },
                  { icon: <Award size={16} />,          title: 'Confidence Calibration', sub: 'Alignment between self-assessed readiness and actual preparedness — avoiding overconfidence and under-confidence' },
                ].map(d => (
                  <div key={d.title} className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'rgba(11,60,93,0.12)', background: '#ffffff' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#4ECDC4' }}>{d.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-0.5">{d.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{d.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{ borderColor: 'rgba(78,205,196,0.3)', background: 'rgba(78,205,196,0.05)' }}>
              <div>
                <p className="text-sm font-bold text-gray-800">Ready to know your exam readiness score?</p>
                <p className="text-xs text-gray-500 mt-0.5">Takes 30–40 minutes · Instant AI report · No diagnostic labels</p>
              </div>
              <button onClick={() => onNavigate('exam-ready')}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#0B3C5D', color: '#ffffff' }}>
                <Target size={14} /> Start Now
              </button>
            </div>

          </div>
        )}

        {/* ─── WELLNESS HUB ─── */}
        {activeView === 'wellness' && (
          <div data-testid="wellness-view">
            <ParentEnterpriseHub
              child={null}
              allChildren={[]}
            />
          </div>
        )}

        {/* ─── PARENT TEST PLAYER (full-screen overlay) ─── */}
        {activeParentTestId && (
          <div data-testid="parent-test-player-view">
            <StudentParentTestPlayer
              assignmentId={activeParentTestId}
              onComplete={() => { setActiveParentTestId(null); setActiveView('assignments'); }}
              onBack={() => setActiveParentTestId(null)}
            />
          </div>
        )}

        {/* ─── DAILY MISSIONS VIEW ─── */}
        {activeView === 'missions' && (
          <div data-testid="missions-view" className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={22} className="text-amber-500" />
                <h2 className={`text-xl font-bold ${theme.text}`}>Today&apos;s Missions</h2>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={theme.textMuted}>{todayMissions.filter(m => m.done).length}/{todayMissions.length} completed</span>
                <Flame size={16} className="text-orange-500" />
                <span className={`font-bold ${theme.text}`}>{gamification.streakDays}d streak</span>
              </div>
            </div>

            {/* Overall daily progress */}
            <div className={`p-4 rounded-xl border ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${theme.text}`}>Daily Progress</span>
                <span className="text-sm font-bold" style={{ color: BRAND.accent }}>{todayMissions.filter(m => m.done).length * 20}% done</span>
              </div>
              <Progress value={todayMissions.filter(m => m.done).length * 20} className="h-3" />
              <p className={`text-xs mt-1.5 ${theme.textMuted}`}>Complete all 5 missions to earn a bonus +25 XP</p>
            </div>

            {/* Mission cards */}
            <div className="space-y-3">
              {todayMissions.map((mission) => {
                const typeColors: Record<string, string> = { Study: '#0B3C5D', Skill: '#0B3C5D', Behavior: '#4ECDC4' };
                const typeBg: Record<string, string> = { Study: '#0B3C5D15', Skill: '#0B3C5D15', Behavior: '#4ECDC415' };
                return (
                  <div key={mission.id} className={`p-4 rounded-xl border transition-all ${theme.cardBg} ${mission.done ? 'opacity-60' : ''}`} style={{ borderColor: mission.done ? '#4ECDC440' : undefined, borderWidth: 1 }}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {mission.done
                          ? <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center"><CheckCircle size={14} className="text-white" /></div>
                          : <div className="w-6 h-6 rounded-full border-2 border-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${theme.text} ${mission.done ? 'line-through opacity-60' : ''}`}>{mission.label}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: typeBg[mission.type], color: typeColors[mission.type] }}>{mission.type}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{mission.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-semibold text-amber-600">+{mission.xp} XP</span>
                          <span className="text-xs font-semibold text-yellow-600">+{mission.coins} coins</span>
                        </div>
                      </div>
                      {!mission.done && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              completeMission(mission.id, mission.xp, mission.coins);
                              if (mission.action === 'exams') onNavigate('student-exam-list', { tab: 'exams' });
                              else if (mission.action === 'lbi') onNavigate('student-exam-list', { tab: 'lbi' });
                              else if (mission.action === 'exam-trends' || mission.action === 'progress' || mission.action === 'forum') setActiveView(mission.action as ActiveView);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: typeColors[mission.type] }}
                          >
                            {mission.actionLabel}
                          </button>
                          <button
                            onClick={() => completeMission(mission.id, mission.xp, mission.coins)}
                            className="px-3 py-1 text-[10px] font-medium rounded-lg border transition-colors text-center"
                            style={{ borderColor: '#4ECDC440', color: '#4ECDC4' }}
                          >
                            Mark done
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {todayMissions.every(m => m.done) && (
              <div className="text-center py-8 rounded-xl border" style={{ borderColor: '#4ECDC440', backgroundColor: '#f0fdf4' }}>
                <Trophy size={40} className="mx-auto text-yellow-500 mb-3" />
                <p className="font-bold text-teal-700 text-lg">All missions complete!</p>
                <p className="text-sm text-teal-600 mt-1">You&apos;ve earned a bonus +25 XP. Come back tomorrow for new missions.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── XP HUB (REWARDS VIEW) ─── */}
        {activeView === 'rewards' && (() => {
          const live = apiProfile;
          const totalXp   = live?.xp   ?? gamification.xp;
          const totalCoins= live?.coins ?? gamification.coins;
          const streak    = live?.streakDays ?? gamification.streakDays;
          const lvl       = live ? LEVELS.find(l => l.level === live.level) ?? LEVELS[0] : levelInfo;
          const lvlPct    = live?.levelProgress ?? levelProgress;
          const xpIn      = live?.xpInLevel ?? xpIntoLevel;
          const xpNd      = live?.xpNeeded ?? xpForLevel;
          const nextLvl   = LEVELS.find(l => l.level === lvl.level + 1);
          const canClaim  = live?.canClaimLoginReward ?? false;
          const lvlEmoji  = ['🌱','📘','⚡','🏅','👑'][Math.min(lvl.level - 1, 4)];

          const lbSource  = apiLeaderboard.length > 0 ? apiLeaderboard : MOCK_LEADERBOARD.map((e, i) => ({ user_id: String(i), xp: e.xpGained, level: 1, streak_days: e.streak, name: e.name }));
          const rewardSource = apiRewards.length > 0 ? apiRewards : REWARD_CATALOG.map((r, i) => ({ id: i, name: r.name, description: r.description.replace(/&#\w+;/g,''), type: 'digital', coin_cost: r.coins, stock: null }));

          const BADGES: { id: string; label: string; desc: string; icon: string; earned: boolean }[] = [
            { id: 'first_login',    label: 'Day One',          desc: 'Logged in for the first time',       icon: '🚀', earned: true },
            { id: 'streak_3',       label: '3-Day Streak',     desc: 'Logged in 3 days in a row',          icon: '🔥', earned: streak >= 3 },
            { id: 'streak_7',       label: 'Week Warrior',     desc: '7-day login streak',                 icon: '🗓️', earned: streak >= 7 },
            { id: 'streak_14',      label: 'Fortnight Hero',   desc: '14-day login streak',                icon: '💪', earned: streak >= 14 },
            { id: 'xp_50',         label: 'First Steps',      desc: 'Earned 50+ XP',                     icon: '⚡', earned: totalXp >= 50 },
            { id: 'xp_200',        label: 'Rising Star',      desc: 'Earned 200+ XP',                    icon: '🌟', earned: totalXp >= 200 },
            { id: 'xp_500',        label: 'High Achiever',    desc: 'Earned 500+ XP',                    icon: '🏆', earned: totalXp >= 500 },
            { id: 'lbi_done',      label: 'LBI Scholar',      desc: 'Completed an LBI assessment',        icon: '🧠', earned: xpHistory.some(t => t.source === 'lbi_complete') },
            { id: 'behavioral',    label: 'Mind Mapper',       desc: 'Completed a behavioral assessment',  icon: '🎯', earned: xpHistory.some(t => t.source === 'exam_ready_complete') },
            { id: 'mission_5',     label: 'Mission Maker',    desc: 'Completed 5+ missions',              icon: '✅', earned: (live?.missionsCompleted ?? 0) >= 5 },
            { id: 'coins_100',     label: 'Coin Collector',   desc: 'Accumulated 100+ coins',             icon: '🪙', earned: totalCoins >= 100 },
          ];

          return (
            <div data-testid="rewards-view" className="space-y-5">

              {/* ── Header ── */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Zap size={22} className="text-amber-500" />
                  <h2 className={`text-xl font-bold ${theme.text}`}>XP Hub</h2>
                  {!gamificationLoaded && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                </div>
                <button onClick={fetchApiGamification} className={`text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg border ${theme.cardBorder} ${theme.textMuted} hover:opacity-80 transition-opacity`}>
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {/* ── Level Card ── */}
              <div className="relative overflow-hidden rounded-2xl text-white p-5"
                style={{ background: `#1B4F72` }}>
                {/* decorative blobs */}
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff', transform: 'translate(30%, -30%)' }} />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#4ECDC4', transform: 'translate(-20%, 30%)' }} />

                <div className="relative flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-lg"
                      style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                      {lvlEmoji}
                    </div>
                    <div>
                      <p className="text-xs opacity-60 uppercase tracking-wider font-medium">Current Level</p>
                      <p className="text-2xl font-black mt-0.5">Lv.{lvl.level} — {lvl.title}</p>
                      <p className="text-sm opacity-75 mt-0.5">{gamification.earnedTitle || lvl.title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-60 uppercase tracking-wider">Total XP</p>
                    <p className="text-4xl font-black mt-0.5" style={{ textShadow: '0 0 20px rgba(253,230,138,0.5)' }}>{totalXp.toLocaleString()}</p>
                  </div>
                </div>

                {/* XP Bar */}
                <div className="relative mt-5">
                  <div className="flex justify-between text-xs opacity-60 mb-1.5">
                    <span>{xpIn.toLocaleString()} XP into level</span>
                    <span>{nextLvl ? `${(xpNd - xpIn).toLocaleString()} XP to ${nextLvl.title}` : '🏆 Max Level!'}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${lvlPct}%`, background: '#FDE68A', boxShadow: '0 0 12px rgba(245,158,11,0.7)' }} />
                  </div>
                  <p className="text-[10px] mt-1 opacity-50 text-right">{lvlPct}% complete</p>
                </div>

                {/* Stats + Login Reward */}
                <div className="relative mt-4 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-base">🪙</span>
                    <div><p className="text-sm font-bold leading-none">{totalCoins.toLocaleString()}</p><p className="text-[9px] opacity-60 mt-0.5">COINS</p></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-base">🔥</span>
                    <div><p className="text-sm font-bold leading-none">{streak}</p><p className="text-[9px] opacity-60 mt-0.5">DAY STREAK</p></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-base">✅</span>
                    <div><p className="text-sm font-bold leading-none">{live?.missionsCompleted ?? 0}</p><p className="text-[9px] opacity-60 mt-0.5">MISSIONS</p></div>
                  </div>
                  <button
                    onClick={claimLoginReward}
                    disabled={claimingLogin || !canClaim}
                    className="ml-auto px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    style={{ background: canClaim ? '#F59E0B' : 'rgba(255,255,255,0.15)', color: '#fff', border: canClaim ? 'none' : '1px solid rgba(255,255,255,0.3)' }}
                  >
                    {claimingLogin ? '...' : canClaim ? '🎁 Claim Daily Reward' : '✓ Reward Claimed'}
                  </button>
                </div>
              </div>

              {/* ── 2-col: XP History + Leaderboard ── */}
              <div className="grid md:grid-cols-2 gap-4">

                {/* XP Activity Feed */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-4 py-3 flex items-center gap-2 border-b ${theme.cardBorder}`}>
                    <Zap size={14} className="text-amber-500" />
                    <h3 className={`text-sm font-semibold ${theme.text}`}>XP Activity</h3>
                    <span className={`ml-auto text-[10px] ${theme.textMuted}`}>Recent earnings</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    {xpHistory.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Zap size={24} className={`mx-auto mb-2 opacity-20 ${theme.textMuted}`} />
                        <p className={`text-xs ${theme.textMuted}`}>No XP earned yet</p>
                        <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Complete missions & assessments to earn XP</p>
                      </div>
                    ) : xpHistory.map((tx) => {
                      const meta = XP_SOURCE_META[tx.source] ?? { label: tx.source, icon: '⭐', color: '#64748b' };
                      const date = new Date(tx.created_at);
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ background: `${meta.color}15` }}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${theme.text}`}>{meta.label}</p>
                            <p className={`text-[10px] ${theme.textMuted}`}>{isToday ? 'Today' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          </div>
                          <span className="text-sm font-black flex-shrink-0" style={{ color: meta.color }}>+{tx.amount} XP</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leaderboard */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-4 py-3 flex items-center gap-2 border-b ${theme.cardBorder}`}>
                    <Trophy size={14} className="text-amber-500" />
                    <h3 className={`text-sm font-semibold ${theme.text}`}>Top Learners</h3>
                    {apiMyRank && <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BRAND.primary}15`, color: BRAND.primary }}>Rank #{apiMyRank}</span>}
                  </div>
                  <div className="divide-y" style={{ borderColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    {lbSource.slice(0, 7).map((entry, i) => {
                      const rank = i + 1;
                      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                      return (
                        <div key={entry.user_id ?? i} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rank <= 3 ? '' : isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
                            style={rank <= 3 ? { background: '#f59e0b20', color: '#d97706' } : { color: '#94a3b8' }}>
                            {medal ?? `#${rank}`}
                          </div>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: BRAND.primary }}>
                            {((entry.name ?? 'U').charAt(0)).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${theme.text}`}>{entry.name ?? 'Anonymous'}</p>
                            <p className={`text-[10px] ${theme.textMuted}`}>Lvl {entry.level} · {entry.streak_days ?? 0}d streak</p>
                          </div>
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: BRAND.primary }}>{(entry.xp ?? 0).toLocaleString()} XP</span>
                        </div>
                      );
                    })}
                    {lbSource.length === 0 && (
                      <div className="p-8 text-center">
                        <Trophy size={24} className={`mx-auto mb-2 opacity-20 ${theme.textMuted}`} />
                        <p className={`text-xs ${theme.textMuted}`}>No rankings yet — be the first!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Achievement Badges ── */}
              <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                <div className={`px-4 py-3 flex items-center justify-between border-b ${theme.cardBorder}`}>
                  <div className="flex items-center gap-2">
                    <Award size={14} style={{ color: BRAND.accent }} />
                    <h3 className={`text-sm font-semibold ${theme.text}`}>Achievements</h3>
                  </div>
                  <span className={`text-[10px] ${theme.textMuted}`}>{BADGES.filter(b => b.earned).length}/{BADGES.length} earned</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {BADGES.map((badge) => (
                    <div key={badge.id}
                      className={`rounded-xl p-3 flex flex-col items-center text-center gap-1.5 border transition-all ${badge.earned ? '' : 'opacity-40'}`}
                      style={{
                        background: badge.earned ? (isDarkMode ? 'rgba(78,205,196,0.12)' : 'rgba(78,205,196,0.06)') : (isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                        borderColor: badge.earned ? 'rgba(78,205,196,0.3)' : (isDarkMode ? '#374151' : '#e2e8f0'),
                      }}>
                      <span className="text-2xl">{badge.earned ? badge.icon : '🔒'}</span>
                      <p className={`text-[10px] font-semibold leading-tight ${theme.text}`}>{badge.label}</p>
                      <p className={`text-[9px] leading-tight ${theme.textMuted}`}>{badge.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Reward Store ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-bold ${theme.text}`}>Reward Store</h3>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: '#D9770615', color: '#D97706' }}>
                    <Star size={12} /> {totalCoins.toLocaleString()} coins
                  </div>
                </div>
                {rewardSource.length === 0 ? (
                  <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl p-8 text-center`}>
                    <p className={`text-sm ${theme.textMuted}`}>No rewards available right now. Check back soon!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rewardSource.map((reward, idx) => {
                      const id = (reward as any).id ?? idx;
                      const cost = (reward as any).coin_cost ?? (reward as any).coins ?? 0;
                      const canAfford = totalCoins >= cost;
                      const typeColor: Record<string, string> = { digital: '#8b5cf6', academic: BRAND.primary, career: '#059669', physical: '#f97316', voucher: '#D97706', course: '#0B3C5D', mentorship: '#4ECDC4', internship: '#ef4444' };
                      const tc = typeColor[(reward as any).type] ?? BRAND.primary;
                      return (
                        <div key={id} className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${theme.cardBg} ${!canAfford ? 'opacity-60' : ''}`}
                          style={{ borderColor: canAfford ? `${tc}30` : (isDarkMode ? '#374151' : '#e2e8f0') }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: `${tc}12` }}>
                            {(reward as any).emoji ?? { digital: '💻', academic: '📚', career: '🚀', physical: '🎁', voucher: '🎟️', course: '📖', mentorship: '🧑‍🏫', internship: '🏢' }[(reward as any).type] ?? '🎁'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className={`text-sm font-semibold ${theme.text}`}>{reward.name}</p>
                                <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{reward.description}</p>
                                {(reward as any).stock !== null && (
                                  <p className="text-[10px] mt-1" style={{ color: ((reward as any).stock ?? 0) < 5 ? '#ef4444' : '#64748b' }}>
                                    {(reward as any).stock} left in stock
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                              <span className="text-sm font-black" style={{ color: '#D97706' }}>🪙 {cost}</span>
                              <button
                                onClick={() => apiRewards.length > 0
                                  ? redeemApiReward(id, cost, reward.name)
                                  : redeemReward(String(id), cost, reward.name)}
                                disabled={!canAfford || redeemingId === id}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: canAfford ? tc : '#94a3b8' }}
                              >
                                {redeemingId === id ? '...' : canAfford ? 'Redeem' : 'Need coins'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className={`text-[11px] mt-3 text-center ${theme.textMuted}`}>
                  Complete assessments & daily missions to earn XP and coins · Redemptions processed within 24 hrs
                </p>
              </div>

            </div>
          );
        })()}
      </div>

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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t px-1 py-2 z-20" style={{ backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', borderColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
        <div className="flex justify-around">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
              activeView === 'dashboard' ? '' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
            style={activeView === 'dashboard' ? { color: isDarkMode ? BRAND.accent : BRAND.primary } : {}}
            data-testid="mobile-nav-home"
          >
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveView('missions')}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg relative transition-colors ${
              activeView === 'missions' ? '' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
            style={activeView === 'missions' ? { color: '#f59e0b' } : {}}
            data-testid="mobile-nav-missions"
          >
            <Zap size={20} />
            <span className="text-[10px] font-medium">Missions</span>
            {todayMissions.filter(m => !m.done).length > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
            )}
          </button>
          <button
            onClick={() => onNavigate('student-exam-list', { tab: 'exams' })}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            data-testid="mobile-nav-exams"
          >
            <FileText size={20} />
            <span className="text-[10px] font-medium">Exams</span>
          </button>
          <button
            onClick={() => setActiveView('rewards')}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
              activeView === 'rewards' ? '' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
            style={activeView === 'rewards' ? { color: isDarkMode ? BRAND.accent : BRAND.primary } : {}}
            data-testid="mobile-nav-rewards"
          >
            <Trophy size={20} />
            <span className="text-[10px] font-medium">Rewards</span>
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg relative transition-colors ${
              activeView === 'analytics' ? '' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
            style={activeView === 'analytics' ? { color: isDarkMode ? BRAND.accent : BRAND.primary } : {}}
            data-testid="mobile-nav-analytics"
          >
            <Activity size={20} />
            <span className="text-[10px] font-medium">Analytics</span>
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ backgroundColor: BRAND.accent }} />
          </button>
        </div>
      </nav>

      <FirstLoginProfileModal
        onCompleteNow={() => setActiveView('dashboard')}
      />

      {showTour && (
        <QuickTour
          type="student"
          onClose={() => setShowTour(false)}
          onNavigate={(section) => {
            const viewMap: Partial<Record<string, ActiveView>> = {
              'dashboard':    'dashboard',
              'kpi':          'dashboard',
              'quick-access': 'dashboard',
              'gamification': 'dashboard',
              'missions':     'missions',
              'study-planner':'study-planner',
              'assignments':  'assignments',
              'wellness':     'wellness',
            };
            const view = viewMap[section];
            if (view) setActiveView(view);
          }}
        />
      )}

      {showSearch && (
        <GlobalSearch
          role="student"
          onNavigate={(screen) => onNavigate(screen as any)}
          onMenuSelect={(item) => {
            const viewMap: Record<string, ActiveView> = {
              'dashboard': 'dashboard',
              'lbi-assessment': 'lbi-assessment',
              'missions': 'missions',
              'study-planner': 'study-planner',
              'assignments': 'assignments',
              'wellness': 'wellness',
              'exam-readiness': 'exam-readiness',
              'analytics': 'analytics',
              'learning-forum': 'learning-forum',
              'collab-hub': 'collab-hub',
              'mentor': 'mentor',
              'rewards': 'rewards',
            };
            const view = viewMap[item] as ActiveView;
            if (view) setActiveView(view);
          }}
          onClose={() => setShowSearch(false)}
          onShowTour={() => setShowTour(true)}
        />
      )}

      </div>
    </div>
  );
}
